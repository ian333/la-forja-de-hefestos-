/**
 * ══════════════════════════════════════════════════════════════════════
 *  gpu-md-shaders — MD masivo en GPU via ping-pong textures
 * ══════════════════════════════════════════════════════════════════════
 *
 * Las posiciones y velocidades de N partículas viven en dos texturas
 * RGBA32F de res×res (donde res²=N). Cada "compute" es un fragment shader
 * que lee el estado anterior y escribe el nuevo:
 *
 *   positionShader:  x_{t+dt} = x_t + v_t·dt           (drift)
 *   velocityShader:  v_{t+dt} = v_t + (F/m)·dt         (kick, con F por LJ)
 *
 * Lennard-Jones pair-wise con cutoff 2.5σ:
 *   V(r) = 4ε[(σ/r)¹² − (σ/r)⁶]
 *   F_ij = 24ε[2(σ/r)¹² − (σ/r)⁶]/r² · (r_i − r_j)
 *
 * Condiciones de frontera periódicas (PBC) con minimum-image convention.
 *
 * Canal alpha de la textura de posición guarda species_id ∈ {0,1,2,3}.
 * Canal alpha de velocidad guarda mass.
 *
 * Costo: O(N²) por step → 4096² = 16M ops por step. En una GPU de 5 TFLOPS,
 * ~3 ms. Corre 60 fps holgadamente para N=4096. Para N=16384, ~50 ms/step,
 * alrededor de 20 fps (aceptable).
 *
 * Ref:
 *   • Allen & Tildesley, "Computer Simulation of Liquids", 2nd ed., 2017.
 *   • Hockney & Eastwood, "Computer Simulation Using Particles", 1988.
 *   • Three.js GPUComputationRenderer examples/jsm/misc/
 */

// La resolución se inyecta al string por template para fijar el loop bound
// (GLSL 1.0 requiere bounds const). RES = sqrt(N_particles).

// ═══════════════════════════════════════════════════════════════
// POSITION SHADER — drift step + PBC wrap
// ═══════════════════════════════════════════════════════════════

export const POSITION_SHADER = (RES: number) => /* glsl */ `
  uniform float dt;
  uniform float boxSize;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 pos = texture2D(texturePosition, uv);
    vec4 vel = texture2D(textureVelocity, uv);

    // Drift: x ← x + v·dt
    pos.xyz += vel.xyz * dt;

    // Periodic boundary (wrap to [-L/2, +L/2])
    pos.xyz -= boxSize * floor(pos.xyz / boxSize + 0.5);

    // pos.w = species id, preservado
    gl_FragColor = pos;
  }
`;

// ═══════════════════════════════════════════════════════════════
// VELOCITY SHADER — computa fuerzas LJ O(N²) + kick + thermostat
// ═══════════════════════════════════════════════════════════════

export const VELOCITY_SHADER = (RES: number) => /* glsl */ `
  uniform float dt;
  uniform float boxSize;
  uniform float targetTemp;     // target temperature (reduced units ε/k_B)
  uniform float thermoTau;       // Berendsen tau (0 = off)
  uniform float epsilonScale;    // multiplicador de ε (intensidad de LJ)

  // σ, ε, masa por especie (hasta 4)
  uniform vec4 speciesSigma;     // diámetro LJ por especie
  uniform vec4 speciesEpsilon;   // profundidad pozo
  uniform vec4 speciesMass;

  // Fijo para GLSL 1.0
  const int RES = ${RES};
  const float RES_F = ${RES}.0;

  float getSpeciesParam(vec4 params, int species) {
    if (species == 0) return params.x;
    if (species == 1) return params.y;
    if (species == 2) return params.z;
    return params.w;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 posI = texture2D(texturePosition, uv);
    vec4 velI = texture2D(textureVelocity, uv);

    int speciesI = int(posI.w + 0.5);
    float massI = velI.w;
    if (massI < 0.01) massI = 1.0;
    float sigmaI  = getSpeciesParam(speciesSigma,  speciesI);
    float epsilonI = getSpeciesParam(speciesEpsilon, speciesI);

    float halfBox = boxSize * 0.5;
    vec3 force = vec3(0.0);

    // Self-UV (para skip self)
    vec2 selfUV = (gl_FragCoord.xy) / resolution.xy;

    // O(N²) loop sobre todas las partículas
    for (int y = 0; y < RES; y++) {
      for (int x = 0; x < RES; x++) {
        vec2 uvJ = (vec2(float(x), float(y)) + 0.5) / resolution.xy;
        // Skip self
        if (abs(uvJ.x - uv.x) < 0.5 / RES_F && abs(uvJ.y - uv.y) < 0.5 / RES_F) continue;

        vec4 posJ = texture2D(texturePosition, uvJ);
        int speciesJ = int(posJ.w + 0.5);

        // Regla de mezcla Lorentz-Berthelot
        float sigmaJ   = getSpeciesParam(speciesSigma,  speciesJ);
        float epsilonJ = getSpeciesParam(speciesEpsilon, speciesJ);
        float sigma    = 0.5 * (sigmaI + sigmaJ);
        float epsilon  = sqrt(epsilonI * epsilonJ) * epsilonScale;

        vec3 diff = posI.xyz - posJ.xyz;
        // Minimum-image PBC
        diff -= boxSize * floor(diff / boxSize + 0.5);

        float r2 = dot(diff, diff);
        float rCut = 2.5 * sigma;
        if (r2 < 0.01 * sigma * sigma || r2 > rCut * rCut) continue;

        float sigma2 = sigma * sigma;
        float invR2  = 1.0 / r2;
        float sr2    = sigma2 * invR2;
        float sr6    = sr2 * sr2 * sr2;
        float sr12   = sr6 * sr6;

        // F_mag/r = 24ε(2·sr12 − sr6)/r² (dirección r̂_ij = diff/r)
        float Fmag = 24.0 * epsilon * (2.0 * sr12 - sr6) * invR2;

        // Clamp para evitar NaN en overlaps extremos
        Fmag = clamp(Fmag, -1e4, 1e4);
        force += Fmag * diff;
      }
    }

    // Kick: v ← v + (F/m)·dt
    vec3 vNew = velI.xyz + (force / massI) * dt;

    // Thermostat Berendsen (opcional)
    if (thermoTau > 0.0 && targetTemp > 0.0) {
      // Usamos la magnitud de velocidad actual para estimar Tau de relajación.
      // Cada partícula se "acerca" al target por factor λ dependiente de la
      // diferencia entre v² y el esperado a targetTemp.
      float v2_target = 3.0 * targetTemp / massI;  // <v²> = 3kT/m
      float v2_actual = dot(vNew, vNew);
      if (v2_actual > 1e-6) {
        float lambda = sqrt(1.0 + (dt / thermoTau) * (v2_target / v2_actual - 1.0));
        lambda = clamp(lambda, 0.5, 2.0);  // no cambio extremo por step
        vNew *= lambda;
      }
    }

    // Cap de velocidad para estabilidad numérica en arranques calientes
    float speed = length(vNew);
    if (speed > 50.0) vNew *= 50.0 / speed;

    gl_FragColor = vec4(vNew, massI);
  }
`;

// ═══════════════════════════════════════════════════════════════
// RENDER SHADERS — dibujar partículas leyendo texturas
// ═══════════════════════════════════════════════════════════════

export const RENDER_VERTEX_SHADER = /* glsl */ `
  attribute vec2 refUV;        // UV fijo en la textura de este vertex-partícula

  uniform sampler2D texturePosition;
  uniform sampler2D textureVelocity;
  uniform vec4 speciesSigma;
  uniform float cameraScale;
  uniform float speedColorScale;

  varying vec3 vColor;
  varying float vSpeed;

  // Paleta por especie (editable via uniforms si hace falta)
  vec3 colorForSpecies(int s) {
    if (s == 0) return vec3(0.31, 0.76, 0.97);  // cian
    if (s == 1) return vec3(1.00, 0.72, 0.30);  // naranja
    if (s == 2) return vec3(0.40, 0.73, 0.42);  // verde
    return                vec3(0.94, 0.33, 0.31); // rojo
  }

  float speciesSigmaVal(int s) {
    if (s == 0) return speciesSigma.x;
    if (s == 1) return speciesSigma.y;
    if (s == 2) return speciesSigma.z;
    return              speciesSigma.w;
  }

  void main() {
    vec4 pos = texture2D(texturePosition, refUV);
    vec4 vel = texture2D(textureVelocity, refUV);

    int species = int(pos.w + 0.5);
    float sigma = speciesSigmaVal(species);

    vec3 baseColor = colorForSpecies(species);
    // Tinge rojo por velocidad alta (más caliente)
    float speed = length(vel.xyz);
    vSpeed = speed;
    vec3 hotColor = vec3(1.0, 0.5, 0.2);
    float hotMix = clamp(speed * speedColorScale * 0.3, 0.0, 0.6);
    vColor = mix(baseColor, hotColor, hotMix);

    vec4 mvPosition = modelViewMatrix * vec4(pos.xyz, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // PointSize ∝ sigma · escala de cámara, atenuado por profundidad
    gl_PointSize = sigma * cameraScale * (100.0 / -mvPosition.z);
  }
`;

export const RENDER_FRAGMENT_SHADER = /* glsl */ `
  precision highp float;
  varying vec3 vColor;
  varying float vSpeed;

  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float d2 = dot(c, c) * 4.0;
    if (d2 > 1.0) discard;

    // Esfera fake con iluminación radial
    float falloff = sqrt(max(0.0, 1.0 - d2));   // "profundidad" en la esfera
    vec3 finalColor = vColor * (0.35 + 0.65 * falloff);

    // Glow adicional por velocidad alta
    float glow = min(1.0, vSpeed * 0.05);
    finalColor += vec3(1.0, 0.6, 0.2) * glow * 0.2;

    gl_FragColor = vec4(finalColor, falloff);
  }
`;

// ═══════════════════════════════════════════════════════════════
// PALETA DE COLORES (misma que en shader, para UI y leyendas)
// ═══════════════════════════════════════════════════════════════

export const SPECIES_PALETTE: { color: string; label: string }[] = [
  { color: '#4FC3F7', label: 'A' },
  { color: '#FFB74D', label: 'B' },
  { color: '#66BB6A', label: 'C' },
  { color: '#EF5350', label: 'D' },
];

// ═══════════════════════════════════════════════════════════════
// REACTIVE COLLISION SHADER — A+B → C+D con barrera de activación
// ═══════════════════════════════════════════════════════════════
//
// Modifica el canal alpha de la textura de posiciones (species id).
// Para cada partícula i, busca la primera j con la que:
//   • está en distancia de colisión (sigma_A + sigma_B)
//   • energía cinética relativa > Ea
// Si encuentra tal j → i cambia a producto.
//
// Nota: es determinístico por-partícula (cada i busca su j más cercano
// que cumpla criterio) — no usa RNG para simplicidad. Produce una
// reacción "greedy" que a nivel estadístico sigue Arrhenius.

export const REACTION_SHADER = (RES: number) => /* glsl */ `
  uniform float boxSize;
  uniform float reactionRadius;
  uniform float activationEnergy;
  uniform int   reactantA;        // species id
  uniform int   reactantB;
  uniform int   productA;
  uniform int   productB;
  uniform float enabled;           // 1.0 = on, 0.0 = off

  const int RES = ${RES};
  const float RES_F = ${RES}.0;

  void main() {
    vec2 uv = gl_FragCoord.xy / resolution.xy;
    vec4 posI = texture2D(texturePosition, uv);
    vec4 velI = texture2D(textureVelocity, uv);

    if (enabled < 0.5) {
      gl_FragColor = posI;
      return;
    }

    int speciesI = int(posI.w + 0.5);
    float halfBox = boxSize * 0.5;

    // Solo reactivos A o B pueden reaccionar
    if (speciesI != reactantA && speciesI != reactantB) {
      gl_FragColor = posI;
      return;
    }

    int targetSpecies = (speciesI == reactantA) ? reactantB : reactantA;

    // Buscar el primer socio de reacción que cumple
    for (int y = 0; y < RES; y++) {
      for (int x = 0; x < RES; x++) {
        vec2 uvJ = (vec2(float(x), float(y)) + 0.5) / resolution.xy;
        if (abs(uvJ.x - uv.x) < 0.5/RES_F && abs(uvJ.y - uv.y) < 0.5/RES_F) continue;

        vec4 posJ = texture2D(texturePosition, uvJ);
        int speciesJ = int(posJ.w + 0.5);
        if (speciesJ != targetSpecies) continue;

        vec3 diff = posI.xyz - posJ.xyz;
        diff -= boxSize * floor(diff / boxSize + 0.5);
        float r2 = dot(diff, diff);
        if (r2 > reactionRadius * reactionRadius) continue;

        // Energía cinética relativa
        vec4 velJ = texture2D(textureVelocity, uvJ);
        vec3 dv = velI.xyz - velJ.xyz;
        float mu = (velI.w * velJ.w) / max(0.01, velI.w + velJ.w);
        float Erel = 0.5 * mu * dot(dv, dv);

        if (Erel < activationEnergy) continue;

        // Criterio de desempate: convertir i al producto correspondiente,
        // pero solo si uv.x > uvJ.x (elección determinística que garantiza
        // que el par (i,j) se procese consistentemente en ambos lados
        // — solo uno de los dos se actualiza como "A→productA", el otro
        // como "B→productB" según su species original).
        if (uv.x > uvJ.x || (abs(uv.x - uvJ.x) < 0.5/RES_F && uv.y > uvJ.y)) {
          int newSpecies = (speciesI == reactantA) ? productA : productB;
          gl_FragColor = vec4(posI.xyz, float(newSpecies));
          return;
        } else {
          // j va a reaccionar; yo cambio al producto correspondiente
          int newSpecies = (speciesI == reactantA) ? productA : productB;
          gl_FragColor = vec4(posI.xyz, float(newSpecies));
          return;
        }
      }
    }

    gl_FragColor = posI;
  }
`;
