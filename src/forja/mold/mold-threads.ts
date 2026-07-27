/**
 * ROSCA como el CAD real: DATOS (7 números) + SUPERFICIE PROCEDURAL. Ningún CAD
 * serio guarda la hélice como sólido pesado (booleanas fallan en paso fino, pesa
 * un mundo). La cuerda métrica está TOTALMENTE definida por el triángulo ISO 68-1
 * y unos pocos números; la superficie es una FUNCIÓN cerrada r(φ,z) que se muestrea
 * en malla a cualquier paso (M0.5 ultra-fino → M64), sin una sola booleana.
 *
 * Perfil ISO 68-1 (métrica, flanco 60°):
 *   H  = P·√3/2 = 0.8660·P     (triángulo fundamental)
 *   h  = 5/8·H  = 0.5413·P     (prof. del hilo, cresta truncada ⅛H, raíz ¼H)
 *   d2 = d − 0.6495·P          (Ø primitivo)   d1 = d − 1.0825·P (Ø menor)
 *   d3 = d − 1.2269·P          (Ø menor real, raíz redondeada) → área de esfuerzo
 */

export interface ThreadSpec {
  desig: string;          // "M10×1.5"
  major: number;          // d (mm)
  pitch: number;          // P (mm)
  minor: number;          // d1 = d − 1.0825·P
  pitchDia: number;       // d2 = d − 0.6495·P
  hand: 'RH' | 'LH';
  starts: number;
  klass: string;          // ajuste (6g externo · 6H interno)
  stressAreaMm2: number;  // As = (π/4)·((d2+d3)/2)²  (para §12.4)
  tapDrillMm: number;     // broca del piloto ≈ d − P (rosca 100 %→75 %)
}

export type Mesh = { positions: Float32Array; normals: Float32Array; indices: Uint32Array };

/** tabla métrica (grueso + fino) — de M1 ULTRA-CHICO a M64; el paso fino se elige
 *  con `fine`. Cubre "muchos tipos y pasos" (la queja del user). */
const COARSE: Record<number, number> = {
  1: 0.25, 1.6: 0.35, 2: 0.4, 2.5: 0.45, 3: 0.5, 4: 0.7, 5: 0.8, 6: 1.0,
  8: 1.25, 10: 1.5, 12: 1.75, 16: 2.0, 20: 2.5, 24: 3.0, 30: 3.5, 36: 4.0, 42: 4.5, 48: 5.0, 64: 6.0,
};
const FINE: Record<number, number> = { 8: 1.0, 10: 1.25, 12: 1.25, 16: 1.5, 20: 1.5, 24: 2.0, 30: 2.0, 36: 3.0 };
const SIZES = Object.keys(COARSE).map(Number).sort((a, b) => a - b);

export function threadDims(d: number, P: number) {
  const H = (P * Math.sqrt(3)) / 2, h = (5 / 8) * H;
  const d2 = d - 0.6495 * P, d1 = d - 1.0825 * P, d3 = d - 1.2269 * P;
  return { H, h, d1, d2, d3 };
}

/** resuelve una rosca desde un Ø medido (auto-detección como Fusion). */
export function resolveThread(dMm: number, o?: { fine?: boolean; hand?: 'RH' | 'LH'; starts?: number; internal?: boolean }): ThreadSpec {
  let d = SIZES[0];
  for (const s of SIZES) if (Math.abs(s - dMm) < Math.abs(d - dMm)) d = s;
  const P = (o?.fine && FINE[d]) ? FINE[d] : COARSE[d];
  const { d1, d2, d3 } = threadDims(d, P);
  const As = (Math.PI / 4) * Math.pow((d2 + d3) / 2, 2);
  return {
    desig: `M${d}×${P}`, major: d, pitch: P, minor: +d1.toFixed(3), pitchDia: +d2.toFixed(3),
    hand: o?.hand ?? 'RH', starts: o?.starts ?? 1, klass: o?.internal ? '6H' : '6g',
    stressAreaMm2: +As.toFixed(1), tapDrillMm: +(d - P).toFixed(2),
  };
}

/** designación → spec (parser: "M10×1.5", "M10x1.5-LH", "M6"). */
export function parseThread(desig: string): ThreadSpec | null {
  const m = desig.match(/M\s*([\d.]+)\s*[×x]?\s*([\d.]+)?(?:\s*-?\s*(LH|RH))?/i);
  if (!m) return null;
  const d = parseFloat(m[1]);
  const P = m[2] ? parseFloat(m[2]) : COARSE[d];
  if (!P) return resolveThread(d);
  const { d1, d2, d3 } = threadDims(d, P);
  return { desig: `M${d}×${P}`, major: d, pitch: P, minor: +d1.toFixed(3), pitchDia: +d2.toFixed(3),
    hand: (m[3]?.toUpperCase() as 'RH' | 'LH') ?? 'RH', starts: 1, klass: '6g',
    stressAreaMm2: +((Math.PI / 4) * Math.pow((d2 + d3) / 2, 2)).toFixed(1), tapDrillMm: +(d - P).toFixed(2) };
}

/** ¿ACOPLA un tornillo con un barreno roscado? (el "¿puedo unir las placas?"): mismo
 *  Ø mayor, mismo paso, mismo sentido — el ajuste externo/interno es complementario. */
export function threadsMate(bolt: ThreadSpec, hole: ThreadSpec): boolean {
  return Math.abs(bolt.major - hole.major) < 0.01 && Math.abs(bolt.pitch - hole.pitch) < 0.001 && bolt.hand === hole.hand;
}

/** perfil ISO 68-1: radio(u) dentro de UN paso (u∈[0,1)): cresta plana ⅛P, flancos
 *  a 30°, raíz plana ¼P. Cerrado, exacto, evaluable a cualquier P. */
function radiusAt(u: number, rMajor: number, h: number): number {
  const cw = 0.125, rw = 0.25, ff = (1 - cw - rw) / 2;   // cresta / raíz / flanco
  const uu = ((u % 1) + 1) % 1;
  if (uu < cw) return rMajor;                                            // cresta
  if (uu < cw + ff) return rMajor - h * (uu - cw) / ff;                  // baja al menor
  if (uu < cw + ff + rw) return rMajor - h;                             // raíz
  return rMajor - h + h * (uu - cw - ff - rw) / ff;                      // sube a la cresta
}

/** CHAFLÁN DE PUNTA — ISO 4753 (extremos de sujetadores): la punta se achaflana a
 *  45° hasta ≈ el Ø MENOR d1, para que el tornillo ENTRE al barreno. Es REGLA, no
 *  tabla: la profundidad radial es (d−d1)/2 = 0.541·P y a 45° el avance axial es el
 *  mismo → sale del paso. Devuelve el radio MÁXIMO permitido por el cono a la altura
 *  `dz` medida desde el extremo (dz≥cLen ⇒ sin recorte).
 *  ISO 4753 pide punta REDONDEADA en Ø<3 mm; ahí el cono se sustituye por el radio. */
export function chamferCapR(dz: number, major: number, pitch: number): number {
  const r1 = (major - 1.0825 * pitch) / 2;              // radio menor d1/2
  const cLen = major / 2 - r1;                          // = 0.541·P (45° ⇒ radial = axial)
  if (dz >= cLen) return Infinity;                      // fuera del chaflán: sin recorte
  if (major < 3) {                                      // ISO 4753: punta redondeada
    const t = Math.max(0, Math.min(1, dz / cLen));
    return r1 + cLen * Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)));
  }
  return r1 + dz;                                       // cono a 45°
}

/**
 * SUPERFICIE HELICOIDAL de rosca EXTERNA como MALLA — r(φ,z) real, cualquier paso.
 * lod = muestras por paso en Z (6 basta para verse real; 10+ para primer plano).
 * Devuelve malla con NORMALES calculadas (los flancos sombrean → hilos visibles).
 * Ultraliviano: el hilo M10×1.5 en 50 mm ≈ 4-6k tris; escala con L/P.
 * `chamfer`: 'start' (z=0, la PUNTA — por defecto), 'end', 'both' o 'none' — ISO 4753.
 */
export function threadSurfaceMesh(spec: ThreadSpec, length: number, o?: { nPhi?: number; lod?: number; chamfer?: 'start' | 'end' | 'both' | 'none' }): Mesh {
  const R = spec.major / 2, { h } = threadDims(spec.major, spec.pitch);
  const nPhi = o?.nPhi ?? 30;
  const perPitch = o?.lod ?? 5;
  const nz = Math.max(12, Math.ceil((length / spec.pitch) * perPitch));
  const hand = spec.hand === 'LH' ? -1 : 1;
  const row = nPhi + 1;
  const P = spec.pitch, starts = spec.starts;
  const ch = o?.chamfer ?? 'start';
  const cStart = ch === 'start' || ch === 'both', cEnd = ch === 'end' || ch === 'both';
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nz; j++) {
    const z = (length * j) / nz;
    // tope del chaflán ISO 4753 en esta altura (el más restrictivo de los dos extremos)
    let cap = Infinity;
    if (cStart) cap = Math.min(cap, chamferCapR(z, spec.major, P));
    if (cEnd) cap = Math.min(cap, chamferCapR(length - z, spec.major, P));
    for (let i = 0; i <= nPhi; i++) {
      const phi = (2 * Math.PI * i) / nPhi;
      // fase axial de la hélice (mono/multi-entrada): avanza P·starts por vuelta
      const s = z - hand * (phi / (2 * Math.PI)) * P * starts;
      const r = Math.min(radiusAt((s / P) % 1, R, h), cap);
      pos.push(r * Math.cos(phi), r * Math.sin(phi), z);
    }
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nPhi; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // tapas planas en los extremos (disco al menor) para que no se vea hueco
  const capBottom = (zc: number, dir: number) => {
    const rMin = R - h, base = pos.length / 3;
    pos.push(0, 0, zc);
    for (let i = 0; i <= nPhi; i++) { const phi = (2 * Math.PI * i) / nPhi; pos.push(rMin * Math.cos(phi), rMin * Math.sin(phi), zc); }
    for (let i = 0; i < nPhi; i++) { if (dir > 0) idx.push(base, base + 1 + i, base + 2 + i); else idx.push(base, base + 2 + i, base + 1 + i); }
  };
  capBottom(0, -1); capBottom(length, 1);
  const positions = new Float32Array(pos), indices = new Uint32Array(idx);
  const normals = computeNormals(positions, indices);
  return { positions, normals, indices };
}

/** vástago LISO (cilindro) como malla — barato (el tornillo real solo trae rosca en
 *  la zona de engrane; el resto es caña lisa). z∈[z0..z1] al radio r. */
export function plainShaftMesh(r: number, z0: number, z1: number, nPhi = 24): Mesh {
  const pos: number[] = [], idx: number[] = [];
  for (const z of [z0, z1]) for (let i = 0; i <= nPhi; i++) { const p = (2 * Math.PI * i) / nPhi; pos.push(r * Math.cos(p), r * Math.sin(p), z); }
  const row = nPhi + 1;
  for (let i = 0; i < nPhi; i++) { const a = i, b = a + 1, c = a + row, d = c + 1; idx.push(a, c, b, b, c, d); }
  const positions = new Float32Array(pos), indices = new Uint32Array(idx);
  return { positions, normals: computeNormals(positions, indices), indices };
}

/** normales por acumulación de caras (flancos del hilo sombreados). */
export function computeNormals(pos: Float32Array, idx: Uint32Array): Float32Array {
  const n = new Float32Array(pos.length);
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const q of [a, b, c]) { n[q] += nx; n[q + 1] += ny; n[q + 2] += nz; }
  }
  for (let i = 0; i < n.length; i += 3) { const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1; n[i] /= l; n[i + 1] /= l; n[i + 2] /= l; }
  return n;
}

/** MEDIDA de "rosca REAL" para el auditor: variación radial pico-a-pico a media
 *  altura. Una barra lisa da ~0; una rosca da ≈ h (0.54·P). CRÍTICO si ~0. */
export function threadRealnessMm(mesh: Mesh): number {
  const P = mesh.positions;
  let mnz = 1e18, mxz = -1e18;
  for (let i = 2; i < P.length; i += 3) { if (P[i] < mnz) mnz = P[i]; if (P[i] > mxz) mxz = P[i]; }
  const zc = (mnz + mxz) / 2, band = (mxz - mnz) * 0.08 + 1;
  let rMin = 1e18, rMax = -1e18;
  for (let i = 0; i < P.length; i += 3) {
    if (Math.abs(P[i + 2] - zc) > band) continue;
    const r = Math.hypot(P[i], P[i + 1]);
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
  }
  return rMax > 0 ? +(rMax - rMin).toFixed(3) : 0;
}
