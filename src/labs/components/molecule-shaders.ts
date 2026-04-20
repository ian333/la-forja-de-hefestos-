/**
 * ══════════════════════════════════════════════════════════════════════
 *  molecule-shaders — Shader GPU general para orbitales moleculares
 * ══════════════════════════════════════════════════════════════════════
 *
 * Evalúa ψ_m(r) = Σ_i c_{m,i}·φ_{n,l,atom}(r) para cada MO m, después
 * computa la densidad total |ψ|²·ocupación sobre MOs ocupados, y
 * renderiza cada punto de una grilla fija coloreado según el MO
 * dominante y su signo.
 *
 * Dimensiones compile-time (pueden subirse si hace falta):
 *   MAX_ATOMS    = 6    (cubre H₂…O₂, HF, CO, Li₂, incluso H₂O con un
 *                        tercero; polyatomics con más requieren subir)
 *   MAX_MOS      = 12   (suficiente para N₂ valence + core)
 *   MAX_CONTRIBS = 32   (combinaciones LCAO individuales)
 *
 * Orbitales atómicos soportados:
 *   0 = 1s
 *   1 = 2s
 *   2 = 2p_x   (lóbulos +x / −x)
 *   3 = 2p_y   (+y / −y)
 *   4 = 2p_z   (+z / −z)
 *
 * Coste: 125k puntos × ~500 ops (loops anidados) ≈ 60M ops/frame.
 * GPU moderna: <1 ms.
 */

// Dimensiones fijas del shader — compartidas TS/GLSL
export const MAX_ATOMS = 6;
export const MAX_MOS = 12;
export const MAX_CONTRIBS = 32;

// Tipo de orbital atómico por ID (coincide con shader switch)
export const ORBITAL_TYPE_ID: Record<string, number> = {
  '1s': 0,
  '2s': 1,
  '2px': 2,
  '2py': 3,
  '2pz': 4,
  // Fallbacks visuales hasta implementar 3s,3p,3d rigurosos
  '3s':  1,
  '3pz': 4,
  '3px': 2,
  '3py': 3,
  '3dz2':   1,
  '3dxy':   1,
  '3dxz':   1,
  '3dx2y2': 1,
};

// Simetría por ID
export const SYMMETRY_ID = {
  bonding:     0,
  antibonding: 1,
  nonbonding:  2,
} as const;

// ═══════════════════════════════════════════════════════════════
// VERTEX SHADER
// ═══════════════════════════════════════════════════════════════

export const VERTEX_SHADER = /* glsl */ `
precision highp float;
precision highp int;

#define MAX_ATOMS     ${MAX_ATOMS}
#define MAX_MOS       ${MAX_MOS}
#define MAX_CONTRIBS  ${MAX_CONTRIBS}

// Átomos
uniform int   nAtoms;
uniform vec3  atomPos[MAX_ATOMS];

// MOs
uniform int   nMOs;
uniform float moOccupancy[MAX_MOS];
uniform int   moSymmetry[MAX_MOS];   // 0=bond, 1=antibond, 2=nonbond

// Contribuciones LCAO
uniform int   nContribs;
uniform int   contribAtomIdx[MAX_CONTRIBS];
uniform int   contribMOIdx[MAX_CONTRIBS];
uniform int   contribOrbitalType[MAX_CONTRIBS];  // 0=1s, 1=2s, 2=2px, 3=2py, 4=2pz
uniform float contribZeff[MAX_CONTRIBS];
uniform float contribCoef[MAX_CONTRIBS];

// Render
uniform float pointSize;
uniform float coreFadeInner;   // bohr: radio desde donde los puntos empiezan a reaparecer
uniform float coreFadeOuter;   // bohr: radio desde donde los puntos se ven completos

varying float vDensity;
varying vec3  vColor;

// ─── orbitales hidrogenoides ─────────────────────────────────────────
float phi1s(vec3 d, float Zeff) {
  float r = length(d);
  const float INV_SQRT_PI = 0.5641896;
  return pow(Zeff, 1.5) * exp(-Zeff * r) * INV_SQRT_PI;
}

float phi2s(vec3 d, float Zeff) {
  float r = length(d);
  float zr = Zeff * r;
  const float NORM = 0.0997356;  // 1/(4·sqrt(2π))
  return pow(Zeff, 1.5) * (2.0 - zr) * exp(-zr * 0.5) * NORM;
}

float phi2p(vec3 d, float Zeff, int axis) {
  float r = length(d);
  if (r < 1e-4) return 0.0;
  float zr = Zeff * r;
  float axial;
  if (axis == 0)      axial = d.x;
  else if (axis == 1) axial = d.y;
  else                axial = d.z;
  const float NORM = 0.0997356;
  return pow(Zeff, 1.5) * Zeff * axial * exp(-zr * 0.5) * NORM;
}

float evalOrbital(vec3 p, vec3 center, float Zeff, int typeId) {
  vec3 d = p - center;
  if (typeId == 0) return phi1s(d, Zeff);
  if (typeId == 1) return phi2s(d, Zeff);
  if (typeId == 2) return phi2p(d, Zeff, 0);
  if (typeId == 3) return phi2p(d, Zeff, 1);
  if (typeId == 4) return phi2p(d, Zeff, 2);
  return 0.0;
}

void main() {
  vec3 p = position;

  // 1) Acumular ψ por cada MO
  float mo_psi[MAX_MOS];
  for (int m = 0; m < MAX_MOS; m++) mo_psi[m] = 0.0;

  for (int c = 0; c < MAX_CONTRIBS; c++) {
    if (c >= nContribs) break;
    int   atIdx = contribAtomIdx[c];
    int   moIdx = contribMOIdx[c];
    int   tp    = contribOrbitalType[c];
    float Zeff  = contribZeff[c];
    float coef  = contribCoef[c];

    // Indexación por uniform int en GLSL 1: scan + match
    vec3 center = atomPos[0];
    for (int a = 0; a < MAX_ATOMS; a++) {
      if (a == atIdx) { center = atomPos[a]; }
    }

    float phi = evalOrbital(p, center, Zeff, tp);

    // Añadir al MO correspondiente
    for (int m = 0; m < MAX_MOS; m++) {
      if (m == moIdx) { mo_psi[m] += coef * phi; }
    }
  }

  // 2) Densidad total + MO dominante
  float rho = 0.0;
  float dom_rho = 0.0;
  int   dom_mo  = 0;
  float dom_psi = 0.0;

  for (int m = 0; m < MAX_MOS; m++) {
    if (m >= nMOs) break;
    float occ = moOccupancy[m];
    if (occ <= 0.0) continue;
    float psi = mo_psi[m];
    float partial = occ * psi * psi;
    rho += partial;
    if (partial > dom_rho) {
      dom_rho = partial;
      dom_mo  = m;
      dom_psi = psi;
    }
  }

  vDensity = rho;

  // 3) Color según simetría del MO dominante y signo de ψ
  int sym = 0;
  for (int m = 0; m < MAX_MOS; m++) {
    if (m == dom_mo) { sym = moSymmetry[m]; }
  }
  float sgn = dom_psi >= 0.0 ? 1.0 : -1.0;

  if (sym == 0) {
    // bonding: cian (+) / naranja (−)
    vColor = sgn > 0.0 ? vec3(0.31, 0.76, 0.97) : vec3(1.00, 0.72, 0.30);
  } else if (sym == 1) {
    // antibonding: verde (+) / rojo (−)
    vColor = sgn > 0.0 ? vec3(0.40, 0.73, 0.42) : vec3(0.94, 0.33, 0.31);
  } else {
    // nonbonding (par libre): violeta (+) / durazno (−)
    vColor = sgn > 0.0 ? vec3(0.74, 0.53, 0.93) : vec3(0.98, 0.66, 0.40);
  }

  // 4) Hueco visual alrededor de núcleos — NO cambia la física (la
  // densidad queda igual en el cálculo); solo desvanece los puntos
  // para que el núcleo dorado sea visible. Desactivable con coreFadeOuter=0.
  float minDistToNucleus = 1e9;
  for (int a = 0; a < MAX_ATOMS; a++) {
    if (a >= nAtoms) break;
    float d = distance(p, atomPos[a]);
    if (d < minDistToNucleus) minDistToNucleus = d;
  }
  float coreFade = coreFadeOuter > 0.0
    ? smoothstep(coreFadeInner, coreFadeOuter, minDistToNucleus)
    : 1.0;

  vDensity = rho * coreFade;  // también desvanece opacidad en fragmento

  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float sizeFactor = 1.0 + clamp(rho * 80.0, 0.0, 4.0);
  gl_PointSize = pointSize * sizeFactor * coreFade * (100.0 / -mvPosition.z);
}
`;

// ═══════════════════════════════════════════════════════════════
// FRAGMENT SHADER
// ═══════════════════════════════════════════════════════════════

export const FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying float vDensity;
varying vec3  vColor;

void main() {
  if (vDensity < 0.0006) discard;

  vec2 uv = gl_PointCoord - vec2(0.5);
  float d2 = dot(uv, uv) * 4.0;
  if (d2 > 1.0) discard;

  float falloff = exp(-d2 * 3.0);
  float alpha = falloff * min(1.0, vDensity * 180.0);
  gl_FragColor = vec4(vColor * 1.5, alpha);
}
`;

// ═══════════════════════════════════════════════════════════════
// Grilla de puntos — regular con jitter, una vez por molécula
// ═══════════════════════════════════════════════════════════════

export function makePointGrid(N: number, extent: number, seed = 1): Float32Array {
  let a = seed >>> 0;
  const rng = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const side = Math.round(Math.cbrt(N));
  const total = side * side * side;
  const positions = new Float32Array(total * 3);
  const spacing = (2 * extent) / side;
  const jitter = spacing * 0.45;

  let idx = 0;
  for (let i = 0; i < side; i++) {
    for (let j = 0; j < side; j++) {
      for (let k = 0; k < side; k++) {
        positions[idx * 3 + 0] = -extent + (i + 0.5) * spacing + (rng() - 0.5) * jitter;
        positions[idx * 3 + 1] = -extent + (j + 0.5) * spacing + (rng() - 0.5) * jitter;
        positions[idx * 3 + 2] = -extent + (k + 0.5) * spacing + (rng() - 0.5) * jitter;
        idx++;
      }
    }
  }
  return positions;
}

// ═══════════════════════════════════════════════════════════════
// Soporte: marca el MO como no-enlazante (lone pair) cuando
// su LCAO tiene un solo coeficiente (un átomo) — no modifica la
// estructura original, sólo deriva para rendering.
// ═══════════════════════════════════════════════════════════════

export function inferSymmetryId(
  symmetry: 'bonding' | 'antibonding' | 'nonbonding',
): number {
  return SYMMETRY_ID[symmetry];
}
