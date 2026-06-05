/**
 * ENSAMBLE — simula el ensamble del cicloidal y detecta CHOQUES. Lo clave que validó la
 * pieza física: el eje descentrado (runout) empuja los discos contra los rodillos → chocan.
 * Aquí se cuantifica: la holgura de malla CON un decentrado δ (el runout del eje), y cómo
 * el cono lo lleva a ~0 → ya no choca. Puro, testeable. Reusa la geometría cicloidal real.
 */
import { cycloidalDisc, pinPositions, type Pt2 } from './cycloidal';

const d2seg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
};

export interface MeshGB { lobes: number; R: number; Rr: number; E: number; gap: number; discs: number; }
/**
 * Holgura de malla (lóbulo↔rodillo) con el disco DECENTRADO una distancia `decenter` en la
 * dirección `dirDeg` (= el runout del eje). Negativo = CHOQUE. Recorre θ del giro y toma lo peor.
 */
export function meshClearanceDecentered(gb: MeshGB, decenter: number, dirDeg: number, thetaSteps = 24): number {
  const prof = cycloidalDisc({ lobes: gb.lobes, R: gb.R, Rr: gb.Rr + gb.gap, E: gb.E, segments: Math.max(90, gb.lobes * 9) }).profile;
  const rollers = pinPositions(gb.R, gb.lobes + 1);
  const dx = decenter * Math.cos((dirDeg * Math.PI) / 180), dy = decenter * Math.sin((dirDeg * Math.PI) / 180);
  let worst = Infinity;
  for (let s = 0; s < thetaSteps; s++) {
    const th = (2 * Math.PI * s) / thetaSteps;
    const cc = Math.cos(-th / gb.lobes), ss = Math.sin(-th / gb.lobes);  // relojeado
    const ox = gb.E * Math.cos(th) + dx, oy = gb.E * Math.sin(th) + dy;
    const pts = prof.map((p) => ({ x: p.x * cc - p.y * ss + ox, y: p.x * ss + p.y * cc + oy }));
    for (const r of rollers) {
      let md = Infinity;
      for (let j = 0; j < pts.length; j++) md = Math.min(md, d2seg(r.x, r.y, pts[j].x, pts[j].y, pts[(j + 1) % pts.length].x, pts[(j + 1) % pts.length].y));
      worst = Math.min(worst, md - gb.Rr);
    }
  }
  return +worst.toFixed(4);
}
/** La PEOR holgura sobre todas las direcciones del decentrado (el runout puede ir a cualquier lado). */
export function worstMeshOverDirections(gb: MeshGB, decenter: number, dirSteps = 12): { worst: number; collides: boolean } {
  let worst = Infinity;
  for (let d = 0; d < dirSteps; d++) worst = Math.min(worst, meshClearanceDecentered(gb, decenter, (360 * d) / dirSteps));
  return { worst: +worst.toFixed(4), collides: worst < 0 };
}

// ── El RUNOUT del eje: 1 apoyo (voladizo) vs 2 conos ──
/** Runout en una leva a altura h: 1 apoyo de largo ℓ con holgura c amplifica el cabeceo. */
export function runoutOneBearing(c: number, h: number, ell: number): number { return +(c * (1 + (2 * h) / ell)).toFixed(3); }
/** 2 apoyos separados L: el runout queda acotado a ~c (no amplificado). */
export function runoutTwoBearings(c: number): number { return +c.toFixed(3); }
/** Cono: con carga axial F_ax centra geométricamente → runout ~0 (solo la película). */
export function runoutCone(filmUm = 5): number { return +(filmUm / 1000).toFixed(4); }

// ── Chequeo de ensamble completo: ¿choca con el runout de cada esquema? ──
export interface AssemblyInput extends MeshGB { shaftClearance: number; topDiscHeight: number; baseBearingLen: number; }
export function assemblyCheck(gb: AssemblyInput) {
  const c = gb.shaftClearance;
  const r1 = runoutOneBearing(c, gb.topDiscHeight, gb.baseBearingLen);
  const r2 = runoutTwoBearings(c);
  const rc = runoutCone();
  const nominal = worstMeshOverDirections(gb, 0);
  const oneBearing = worstMeshOverDirections(gb, r1);
  const twoBearing = worstMeshOverDirections(gb, r2);
  const cone = worstMeshOverDirections(gb, rc);
  return {
    nominalClearance: nominal.worst,
    runout: { oneBearing: r1, twoBearing: r2, cone: rc },
    mesh: {
      oneBearing: { runout: r1, worst: oneBearing.worst, collides: oneBearing.collides },
      twoBearing: { runout: r2, worst: twoBearing.worst, collides: twoBearing.collides },
      cone: { runout: rc, worst: cone.worst, collides: cone.collides },
    },
    verdict: `1 apoyo: runout ${r1}mm → malla ${oneBearing.worst}mm ${oneBearing.collides ? 'CHOCA ✗' : 'ok'} · ` +
      `2 conos: runout ${rc}mm → malla ${cone.worst}mm ${cone.collides ? 'CHOCA ✗' : 'LIBRA ✓'}`,
  };
}
