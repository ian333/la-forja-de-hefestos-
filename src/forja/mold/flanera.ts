/**
 * flanera.ts — el VASO de la flanera (PRODUCTO), paramétrico y de REVOLUCIÓN.
 * ==========================================================================
 * Cono truncado con desmoldeo (el flan sale al voltear), fondo cerrado y reborde.
 * Se construye con `revolvePolygon` sobre el perfil de MEDIA SECCIÓN (x=radio,
 * y=alto) girando 360° alrededor de +Y — exactamente lo que el TORNO hace en
 * físico (superficie de revolución). Reproducible: cambia las cotas → nuevo vaso.
 *
 * Perfil (media sección, cerrado):
 *      reborde  ┌──┐  ← (rimR+lipW, H)
 *   pared ext  ╱   │
 *             ╱    │ pared int
 *   base ext ╱_____│
 *   fondo   ╱______|  ← (0, botT) inner bottom
 *          eje +Y (x=0)
 */
import { revolvePolygon, volume, type OC, type Shape, type Pt2 } from '../brep/occt';

export interface FlaneraParams {
  rimDia?: number;    // Ø del borde/boca (mm) — default 80
  baseDia?: number;   // Ø de la base (mm) — default 72 (la diferencia da el desmoldeo)
  height?: number;    // alto (mm) — default 40
  wall?: number;      // pared (mm) — default 1.2
  lipWidth?: number;  // ancho del reborde hacia afuera (mm) — default 2.5
  lipThk?: number;    // grosor del reborde (mm) — default 1.5
  bottomThk?: number; // grosor del fondo (mm) — default 1.2
}

export function flanera(oc: OC, p: FlaneraParams = {}): { shape: Shape; volMm3: number; draftDeg: number; report: string[] } {
  const rimD = p.rimDia ?? 80, baseD = p.baseDia ?? 72;
  const H = p.height ?? 40, w = p.wall ?? 1.2;
  const lipW = p.lipWidth ?? 2.5, lipT = p.lipThk ?? 1.5, botT = p.bottomThk ?? 1.2;
  const rimR = rimD / 2, baseR = baseD / 2;
  const innerRimR = rimR - w, innerBaseR = baseR - w;

  // media sección CERRADA (CCW), toda a x≥0 → sólido axisimétrico válido
  const profile: Pt2[] = [
    { x: 0,             y: 0 },        // centro del fondo exterior
    { x: baseR,         y: 0 },        // esquina base exterior
    { x: rimR,          y: H },        // borde exterior (pared con desmoldeo)
    { x: rimR + lipW,   y: H },        // reborde afuera
    { x: rimR + lipW,   y: H - lipT }, // reborde abajo
    { x: innerRimR,     y: H - lipT }, // regreso a la pared interior
    { x: innerBaseR,    y: botT },     // pared interior con desmoldeo → base interior
    { x: 0,             y: botT },     // centro del fondo interior
  ];

  const shape = revolvePolygon(oc, profile, 360);
  const vol = volume(oc, shape);
  const draftDeg = (Math.atan((rimR - baseR) / H) * 180) / Math.PI;

  return {
    shape, volMm3: vol, draftDeg,
    report: [
      `Flanera Ø${rimD}→Ø${baseD} · H${H} · pared ${w}mm`,
      `desmoldeo ${draftDeg.toFixed(1)}° por lado — el flan sale al voltear`,
      `reborde ${lipW}×${lipT}mm · fondo ${botT}mm`,
      `volumen de material ${(vol / 1000).toFixed(1)} cc (revolución, torneable)`,
    ],
  };
}
