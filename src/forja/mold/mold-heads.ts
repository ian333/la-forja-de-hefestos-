/**
 * CABEZAS DE TORNILLO — por REGLA, no por catálogo de fotos (user 2026-07-15:
 * "faltan los tipos de cabeza… así no son los reales, tienen chaflanes",
 * "debe haber reglas estandarizadas").
 *
 * MISMA IDEA QUE LA ROSCA: la rosca no salió de una tabla, salió del triángulo
 * ISO 68-1. La cabeza igual — cada norma define una REGLA geométrica y la malla
 * se muestrea de un campo radial r(φ,z). Un solo muestreador sirve para todas:
 *
 *   DIN 912 / ISO 4762  cilíndrica Allen ... k = d EXACTO (M3→M24) · chaflán de canto
 *   DIN 933 / ISO 4017  hexagonal ......... chaflán superior 30° que trunca el hexágono
 *                                            en el círculo Ø≈s → los ARCOS de las caras
 *   DIN 7991 / ISO10642 avellanada ........ cono de 90° ⇒ k = (dk−d)/2 (sale del ángulo)
 *   ISO 7380            botón ............. casquete esférico
 *   DIN 7984            cabeza baja ....... cilíndrica, k ≈ 0.6·d
 *
 * HONESTIDAD DIMENSIONAL (regla dura del proyecto: PROHIBIDO inventar cotas).
 * Cada HeadSpec declara `source`:
 *   · 'tabla' → cota LITERAL de la tabla DIN verificada que ya vive en el repo
 *               (src/lib/parts/fasteners/din.ts: DIN 912 y DIN 933, M3..M24).
 *   · 'regla' → cota derivada de la REGLA geométrica de la norma. El ángulo (90°,
 *               30°) es definitorio y por tanto exacto; la PROPORCIÓN de dk es
 *               nominal. Verificada exacta contra DIN 7991 en M4..M12 (dk=2d,
 *               k=d/2); en M16+ la norma tabula cabezas algo menores (dk=30 vs 32
 *               que daría la proporción) → `nominal:true` para que el BOM lo marque
 *               "confirmar contra norma". No se finge exactitud que no tenemos.
 */
// directo a din.ts (NO al index): el index reexporta geometry.ts, que arrastra el
// motor SDF completo a un módulo que solo necesita las TABLAS.
import { THREAD, SOCKET_CAP, HEX_HEAD, SIZES as CAT_SIZES, type MetricSize } from '../../lib/parts/fasteners/din';
import { computeNormals, type Mesh } from './mold-threads';

export type HeadStd = 'DIN912' | 'DIN933' | 'DIN7991' | 'ISO7380' | 'DIN7984';

export interface HeadSpec {
  std: HeadStd;
  desig: string;          // "DIN 912 M10"
  major: number;          // d nominal (mm)
  dk: number;             // Ø de cabeza (mm)
  k: number;              // altura de cabeza (mm)
  sw?: number;            // entre-caras: hexágono INTERIOR (Allen) o llave exterior
  socketDepth?: number;   // profundidad del hueco Allen
  hexOuter: boolean;      // cabeza hexagonal EXTERNA (DIN 933)
  countersunk: boolean;   // se asienta a ras en un avellanado cónico
  angleDeg?: number;      // ángulo del cono (90° avellanado · 30° chaflán hex)
  chamfer: number;        // chaflán del canto (mm)
  bearingDia: number;     // Ø de apoyo (lo que aprieta contra la placa)
  source: 'tabla' | 'regla';
  nominal: boolean;       // true ⇒ proporción de regla, confirmar contra norma
  rule: string;           // la regla que la define (para el manual/BOM)
}

/** medida DIN más cercana al Ø (las tablas del catálogo son M3..M24). */
function nearestSize(dMm: number): MetricSize {
  let best = CAT_SIZES[0];
  for (const s of CAT_SIZES) if (Math.abs(THREAD[s].d - dMm) < Math.abs(THREAD[best].d - dMm)) best = s;
  return best;
}

/** Chaflán del canto de cabeza: rompe-aristas proporcional. Es acabado, no cota
 *  funcional — la norma lo deja como arista rota; usamos 0.05·dk acotado a [0.2,1]. */
const edgeChamfer = (dk: number) => Math.min(1, Math.max(0.2, 0.05 * dk));

/** resuelve la cabeza de una norma para un Ø dado. */
export function resolveHead(std: HeadStd, dMm: number): HeadSpec {
  const size = nearestSize(dMm), d = THREAD[size].d;
  const base = { std, major: d, hexOuter: false, countersunk: false, nominal: false } as const;
  switch (std) {
    case 'DIN912': {
      const { dk, k, sw } = SOCKET_CAP[size];            // TABLA verificada en el repo
      return { ...base, desig: `DIN 912 ${size}`, dk, k, sw, socketDepth: +(k * 0.6).toFixed(2),
        chamfer: edgeChamfer(dk), bearingDia: dk, source: 'tabla', nominal: false,
        rule: 'ISO 4762: cabeza cilíndrica, k = d EXACTO; dk y sw de tabla' };
    }
    case 'DIN933': {
      const { s, k } = HEX_HEAD[size];                   // TABLA verificada en el repo
      return { ...base, desig: `DIN 933 ${size}`, dk: +(s / Math.sqrt(3) * 2).toFixed(2), k, sw: s,
        hexOuter: true, angleDeg: 30, chamfer: edgeChamfer(s), bearingDia: s,
        source: 'tabla', nominal: false,
        rule: 'ISO 4017: prisma hexagonal s (tabla) + chaflán superior 30° que trunca en Ø≈s → arcos en las caras' };
    }
    case 'DIN7991': {
      const dk = 2 * d, k = (dk - d) / 2;                // REGLA: cono 90° ⇒ k=(dk−d)/2
      return { ...base, desig: `DIN 7991 ${size}`, dk, k, sw: SOCKET_CAP[size].sw,
        socketDepth: +(k * 0.6).toFixed(2), countersunk: true, angleDeg: 90,
        chamfer: 0, bearingDia: dk, source: 'regla', nominal: d > 12,
        rule: 'ISO 10642: cono de 90° ⇒ k=(dk−d)/2. dk=2·d exacto en M4..M12; M16+ la norma tabula menor' };
    }
    case 'ISO7380': {
      const dk = +(1.75 * d).toFixed(2), k = +(0.55 * d).toFixed(2);
      return { ...base, desig: `ISO 7380 ${size}`, dk, k, sw: SOCKET_CAP[size].sw,
        socketDepth: +(k * 0.6).toFixed(2), chamfer: 0, bearingDia: dk,
        source: 'regla', nominal: true,
        rule: 'ISO 7380: casquete esférico; proporción nominal dk≈1.75·d, k≈0.55·d' };
    }
    case 'DIN7984': {
      const dk = SOCKET_CAP[size].dk, k = +(0.6 * d).toFixed(2);   // dk igual a 912; k bajo
      return { ...base, desig: `DIN 7984 ${size}`, dk, k, sw: SOCKET_CAP[size].sw,
        socketDepth: +(k * 0.6).toFixed(2), chamfer: edgeChamfer(dk), bearingDia: dk,
        source: 'regla', nominal: true,
        rule: 'DIN 7984: cabeza baja cilíndrica, k ≈ 0.6·d (proporción nominal)' };
    }
  }
}

/** radio de la cara plana que remata la cúpula del botón: el Allen necesita apoyo,
 *  así que la esfera se trunca justo afuera de la esquina del hexágono interior. */
function buttonTopR(hd: HeadSpec): number {
  return Math.min(hd.dk / 2 - 0.2, (hd.sw ?? hd.major * 0.6) / Math.sqrt(3) + 0.6);
}

/** frontera radial de un hexágono de entre-caras s, en polar. r va de s/2 (centro de
 *  cara) a s/√3 (esquina) — de aquí salen las 6 caras planas. */
export function hexRadius(phi: number, s: number): number {
  const a = Math.PI / 3;                                  // 60°
  const m = ((phi % a) + a) % a - a / 2;                   // −30°..+30° dentro de la cara
  return (s / 2) / Math.cos(m);
}

/**
 * CAMPO RADIAL de la cabeza: r(φ, z) con z medido DESDE LA CARA DE APOYO (z=0) hacia
 * arriba (z=k = cara superior). Aquí viven TODAS las reglas de forma + los CHAFLANES.
 */
export function headRadius(hd: HeadSpec, phi: number, z: number): number {
  const rk = hd.dk / 2, t = Math.max(0, Math.min(1, z / hd.k));
  if (hd.countersunk) return hd.major / 2 + (rk - hd.major / 2) * t;      // cono 90°
  if (hd.std === 'ISO7380') {
    // casquete esférico TRUNCADO: la cúpula NO llega a punta — remata en una cara
    // plana de radio rTop donde se aloja el Allen (si terminara en r=0 el ápice no
    // dejaría dónde poner la llave). Esfera por (rk,0) y (rTop,k):
    //   zc = (rTop² + k² − rk²) / (2k)   ·   Rs = √(rk² + zc²)
    const rTop = buttonTopR(hd);
    const zc = (rTop * rTop + hd.k * hd.k - rk * rk) / (2 * hd.k);
    const Rs = Math.sqrt(rk * rk + zc * zc);
    return Math.max(rTop, Math.sqrt(Math.max(0, Rs * Rs - (z - zc) * (z - zc))));
  }
  let r = hd.hexOuter ? hexRadius(phi, hd.sw!) : rk;
  if (hd.hexOuter && hd.angleDeg === 30) {
    // CHAFLÁN 30° (DIN 933): el cono trunca el hexágono desde arriba en Ø≈s. Por eso
    // un tornillo hexagonal real tiene ARCOS en las caras y no aristas vivas.
    const cap = hd.sw! / 2 + (hd.k - z) * Math.tan((30 * Math.PI) / 180);
    r = Math.min(r, cap);
  } else if (hd.chamfer > 0) {
    r = Math.min(r, rk - (hd.chamfer - (hd.k - z)));                      // chaflán de canto 45° arriba
    r = Math.min(hd.hexOuter ? hexRadius(phi, hd.sw!) : rk, Math.max(r, 0));
  }
  return r;
}

/** NIVELES EN Z donde la geometría DOBLA — no muestreo uniforme (un cilindro recto con
 *  60 niveles es puro desperdicio: 5× de malla para el mismo radio). Cono y cilindro son
 *  LINEALES en z ⇒ 2-3 niveles los dejan EXACTOS; solo la cúpula necesita densidad.
 *  Esto es lo que hace la cabeza ultraliviana SIN perder forma. */
function zLevels(hd: HeadSpec): number[] {
  const k = hd.k;
  if (hd.countersunk) return [0, k];                          // cono 90°: lineal ⇒ exacto con 2
  if (hd.std === 'ISO7380') { const n = 16; return Array.from({ length: n + 1 }, (_, i) => (k * i) / n); }  // cúpula: curva
  if (hd.hexOuter) {                                          // hex + chaflán 30°
    // el cono toca la ESQUINA (s/√3) cuando (k−z)·tan30° = s(1/√3 − 1/2) ⇒ banda = 0.134·s
    const band = Math.min(k, 0.134 * hd.sw!), z0 = Math.max(0, k - band), out = [0, z0];
    for (let i = 1; i <= 6; i++) out.push(z0 + (band * i) / 6);   // el codo min() depende de φ
    return out;
  }
  const z0 = Math.max(0, k - hd.chamfer);                     // cilindro recto + chaflán de canto
  return hd.chamfer > 0 ? [0, z0, k] : [0, k];                // ambos tramos lineales ⇒ exacto
}

/** revoluciona/barre el campo radial → malla de la cabeza (con hueco Allen si aplica).
 *  z0 = altura mundial de la cara de apoyo; la cabeza crece hacia +Z. */
export function headMesh(hd: HeadSpec, z0: number, o?: { nPhi?: number }): Mesh {
  const nPhi = o?.nPhi ?? 48;
  const lv = zLevels(hd), nz = lv.length - 1;
  const pos: number[] = [], idx: number[] = [], row = nPhi + 1;
  const push = (r: number, phi: number, z: number) => pos.push(r * Math.cos(phi), r * Math.sin(phi), z);
  // ── superficie exterior (niveles donde dobla, no uniformes) ──
  for (const z of lv) for (let i = 0; i <= nPhi; i++) { const phi = (2 * Math.PI * i) / nPhi; push(headRadius(hd, phi, z), phi, z0 + z); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nPhi; i++) { const a = j * row + i, b = a + 1, c = a + row, d = c + 1; idx.push(a, c, b, b, c, d); }
  // ── cara superior: anillo del hueco Allen al borde (o disco si no hay hueco) ──
  const hasSocket = !!hd.sw && !hd.hexOuter;
  const top = z0 + hd.k, base0 = pos.length / 3;
  for (let i = 0; i <= nPhi; i++) {
    const phi = (2 * Math.PI * i) / nPhi;
    const rIn = hasSocket ? hexRadius(phi, hd.sw!) : 0;
    push(rIn, phi, top); push(headRadius(hd, phi, hd.k), phi, top);
  }
  for (let i = 0; i < nPhi; i++) { const a = base0 + i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, b, c, b, d, c); }
  // ── hueco Allen: pared hexagonal + piso ──
  if (hasSocket && hd.socketDepth) {
    const zf = top - hd.socketDepth, bw = pos.length / 3;
    for (let i = 0; i <= nPhi; i++) { const phi = (2 * Math.PI * i) / nPhi; const r = hexRadius(phi, hd.sw!); push(r, phi, top); push(r, phi, zf); }
    for (let i = 0; i < nPhi; i++) { const a = bw + i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, c, d); }
    const bf = pos.length / 3; pos.push(0, 0, zf);
    for (let i = 0; i <= nPhi; i++) { const phi = (2 * Math.PI * i) / nPhi; push(hexRadius(phi, hd.sw!), phi, zf); }
    for (let i = 0; i < nPhi; i++) idx.push(bf, bf + 1 + i, bf + 2 + i);
  }
  // ── cara de apoyo (anillo del vástago al borde) ──
  const bb = pos.length / 3;
  for (let i = 0; i <= nPhi; i++) { const phi = (2 * Math.PI * i) / nPhi; push(hd.major / 2, phi, z0); push(headRadius(hd, phi, 0), phi, z0); }
  for (let i = 0; i < nPhi; i++) { const a = bb + i * 2, b = a + 1, c = a + 2, d = a + 3; idx.push(a, c, b, b, d, c); }
  const positions = new Float32Array(pos), indices = new Uint32Array(idx);
  return { positions, normals: computeNormals(positions, indices), indices };
}

/** ¿asienta a ras? El avellanado necesita su cono en la placa; los demás, caja. */
export function seatSpec(hd: HeadSpec): { kind: 'avellanado' | 'caja'; dia: number; depth: number; angleDeg?: number } {
  return hd.countersunk
    ? { kind: 'avellanado', dia: hd.dk, depth: hd.k, angleDeg: 90 }
    : { kind: 'caja', dia: +(hd.dk + 0.8).toFixed(2), depth: hd.k };
}

/** medida del chaflán de punta ISO 4753 (para el manual): profundidad radial y axial. */
export function tipChamfer(major: number, pitch: number) {
  const r1 = (major - 1.0825 * pitch) / 2, cLen = major / 2 - r1;
  return { toDia: +(2 * r1).toFixed(3), radialMm: +cLen.toFixed(3), axialMm: +cLen.toFixed(3),
    angleDeg: major < 3 ? 0 : 45, kind: major < 3 ? 'redondeada' : 'cónica 45°',
    rule: 'ISO 4753: punta achaflanada a 45° hasta ≈ Ø menor d1 (redondeada si Ø<3mm)' };
}
