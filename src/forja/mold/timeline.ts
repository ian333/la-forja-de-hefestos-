/**
 * LÍNEA DE TIEMPO — la historia EDITABLE del molde (user 2026-07-15: "en Fusion cada
 * componente tiene su historia independiente y modificable, desde su sketch; todas las
 * herramientas dejan histórico. Eso hace falta si se automatiza la mayoría, pero DEBE
 * haber libertad para editarlo yo como usuario").
 *
 * EL PROBLEMA QUE RESUELVE: hasta hoy el generador emitía MALLAS MUERTAS + un
 * `features: string[]` que era un COMENTARIO (texto de lo que se hizo). No se podía
 * editar nada: si el cliente pedía mover una línea de agua, la única salida era
 * regenerar todo y rezar. La máquina acierta el 80% y el usuario necesita el 20%.
 *
 * EL PRINCIPIO (el mismo de la rosca y las cabezas): la máquina hace LO QUE HARÍA UN
 * HUMANO, con las MISMAS herramientas. El generador ya no llama primitivas por debajo
 * — escribe una RECETA de croquis/extrusiones/barrenos, idéntica a la que dejaría una
 * persona. Por eso el resultado tiene historia: nació con ella.
 *
 *   moldMachine(spec) → RECETA (Component[] { timeline: Feature[] })
 *                          ↓  rebuild(K, oc, timeline)
 *                       sólido + medidas
 *
 * `rebuild` es PURA en (timeline, kernel): misma receta ⇒ mismo sólido. La usan por
 * igual el generador automático y el usuario que cambia una cota. Editar = devolver
 * una receta nueva (inmutable) y re-evaluar.
 */
import type { Pt2 } from '../brep/occt';

export type FeatureType =
  | 'sketch-rect'      // croquis: rectángulo (el perfil de una placa)
  | 'sketch-circle'    // croquis: círculo
  | 'extrude'          // extruir el croquis anterior → sólido base
  | 'holes'            // barrenos (patrón de posiciones, un Ø)
  | 'pocket'           // caja/bolsa restada (asiento de inserto, canal)
  | 'fillet' | 'chamfer'
  | 'draft'            // salida §2.3.6
  | 'shell';           // vaciado: de macizo a PIEZA de pared uniforme (§2.3.1)

/** UN paso de la historia. `params` es lo que el usuario EDITA. */
export interface Feature {
  id: string;
  type: FeatureType;
  label: string;                    // lo que se lee en el árbol
  params: Record<string, number | string | boolean | Pt2[] | undefined>;
  suppressed?: boolean;             // apagar un paso sin borrarlo (como Fusion)
  /** POR QUÉ la máquina puso este paso (la cita del libro). El usuario merece saber
   *  qué regla está rompiendo si lo edita. */
  why?: string;
}

export interface Component {
  name: string; role: string; material?: string;
  timeline: Feature[];
}

export interface StepResult {
  id: string; label: string; ok: boolean; ms: number; error?: string;
  /** el paso SÍ salió, pero el kernel NO hizo exactamente lo pedido (p.ej. bajó el radio
   *  del fillet porque no cabía). Un "ok" silencioso ahí sería una mentira: la pieza no
   *  tendría la cota que el usuario tecleó. */
  note?: string;
}
export interface RebuildResult {
  shape: unknown | null;
  steps: StepResult[];
  /** medidas del sólido resultante — para VERIFICAR que las cotas cuadran */
  measure?: { bbox: [number, number, number]; volumeMm3: number; min: [number, number, number] };
  /** por qué no se pudo medir (si aplica) — nunca callado */
  measureError?: string;
}

// ── edición inmutable de la receta (el usuario manda) ────────────────────────
export const editFeature = (tl: Feature[], id: string, patch: Feature['params']): Feature[] =>
  tl.map((f) => (f.id === id ? { ...f, params: { ...f.params, ...patch } } : f));
export const suppressFeature = (tl: Feature[], id: string, on = true): Feature[] =>
  tl.map((f) => (f.id === id ? { ...f, suppressed: on } : f));
export const removeFeature = (tl: Feature[], id: string): Feature[] => tl.filter((f) => f.id !== id);
export const insertAfter = (tl: Feature[], afterId: string | null, f: Feature): Feature[] => {
  if (!afterId) return [f, ...tl];
  const i = tl.findIndex((x) => x.id === afterId);
  return i < 0 ? [...tl, f] : [...tl.slice(0, i + 1), f, ...tl.slice(i + 1)];
};

const num = (v: unknown, d = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/**
 * VALIDA los parámetros ANTES de tocar el kernel. NO es cosmético: OCCT es C++ vía
 * WASM y una cota degenerada (extruir 0 mm) no "falla limpio" — CORROMPE EL HEAP
 * ("memory access out of bounds") y deja el CAD tostado: ya no puedes ni volver a la
 * receta buena. Medido: bastaba UNA edición imposible para matar la sesión.
 * Regla: la basura se detiene AQUÍ, con un mensaje que el usuario entienda —
 * el kernel solo recibe números sanos. Así explorar es seguro.
 */
function validate(f: Feature): string | null {
  const p = f.params;
  const pos = (k: string, nombre: string, min = 0.01) => {
    const v = num(p[k], NaN);
    if (!Number.isFinite(v)) return `${nombre} debe ser un número`;
    return v < min ? `${nombre} debe ser > ${min} mm (tienes ${v})` : null;
  };
  switch (f.type) {
    case 'sketch-rect': return pos('w', 'el ancho') ?? pos('h', 'el alto');
    case 'sketch-circle': return pos('r', 'el radio');
    case 'extrude': return pos('distance', 'la distancia de extrusión');
    case 'holes': {
      const at = (p.at as Pt2[]) ?? [];
      if (!at.length) return 'sin posiciones de barreno';
      return pos('dia', 'el diámetro') ?? pos('depth', 'la profundidad');
    }
    case 'pocket': return pos('w', 'el ancho') ?? pos('h', 'el alto') ?? pos('depth', 'la profundidad');
    case 'fillet': return pos('r', 'el radio');
    case 'chamfer': return pos('d', 'el chaflán');
    case 'draft': {
      const a = num(p.angleDeg, NaN);
      if (!Number.isFinite(a)) return 'el ángulo debe ser un número';
      return a <= 0 || a >= 45 ? `el ángulo de salida debe estar entre 0° y 45° (tienes ${a}°)` : null;
    }
    case 'shell': return pos('thickness', 'la pared');
    default: return null;
  }
}

/** rectángulo centrado → perfil de croquis (lo que dibujaría un humano). */
function rectPts(cx: number, cy: number, w: number, h: number): Pt2[] {
  return [{ x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 }, { x: cx - w / 2, y: cy + h / 2 }];
}

/**
 * EVALÚA la receta → sólido. Cada paso reporta ok/ms/error para que el árbol muestre
 * exactamente dónde truena si el usuario mete una cota imposible (eso es EXPLORAR).
 * Un paso que falla NO tumba la reconstrucción: se marca y se sigue con lo que había,
 * porque un CAD que se muere al editar no se puede explorar.
 */
export function rebuild(K: any, oc: any, timeline: Feature[]): RebuildResult {
  const steps: StepResult[] = [];
  let shape: any = null;
  let profile: Pt2[] | null = null;
  let sketchZ = 0;

  for (const f of timeline) {
    const t0 = Date.now();
    let note: string | undefined;
    if (f.suppressed) { steps.push({ id: f.id, label: f.label, ok: true, ms: 0 }); continue; }
    // PORTERO: la cota mala se rechaza AQUÍ y el kernel ni se entera (ver validate()).
    const bad = validate(f);
    if (bad) { steps.push({ id: f.id, label: f.label, ok: false, ms: 0, error: bad }); continue; }
    try {
      switch (f.type) {
        case 'sketch-rect':
          profile = rectPts(num(f.params.cx), num(f.params.cy), num(f.params.w, 10), num(f.params.h, 10));
          sketchZ = num(f.params.z);
          break;
        case 'sketch-circle': {
          const r = num(f.params.r, 5), n = 48, cx = num(f.params.cx), cy = num(f.params.cy);
          profile = Array.from({ length: n }, (_, i) => ({ x: cx + r * Math.cos(2 * Math.PI * i / n), y: cy + r * Math.sin(2 * Math.PI * i / n) }));
          sketchZ = num(f.params.z);
          break;
        }
        case 'extrude': {
          if (!profile) throw new Error('extruir sin croquis previo');
          const s = K.extrudePolygon(oc, profile, num(f.params.distance, 1), K.offsetPlane(K.PLANE_XY, sketchZ));
          shape = shape && f.params.op === 'add' ? K.fuse(oc, shape, s) : s;
          break;
        }
        case 'holes': {
          if (!shape) throw new Error('barrenos sin sólido');
          const at = (f.params.at as Pt2[]) ?? [];
          const dia = num(f.params.dia, 5), zTop = num(f.params.zTop), depth = num(f.params.depth, 10);
          for (const p of at) shape = K.drillHole(oc, shape, { x: p.x, y: p.y, diameter: dia, zTop, depth, through: !!f.params.through });
          break;
        }
        case 'pocket': {
          if (!shape) throw new Error('bolsa sin sólido');
          const tool = K.extrudePolygon(oc, rectPts(num(f.params.cx), num(f.params.cy), num(f.params.w, 10), num(f.params.h, 10)),
            num(f.params.depth, 5), K.offsetPlane(K.PLANE_XY, num(f.params.z)));
          shape = K.cut(oc, shape, tool);
          break;
        }
        case 'draft':
          if (!shape) throw new Error('salida sin sólido');
          shape = K.draftFaces(oc, shape, num(f.params.angleDeg, 1.5), [0, 0, 1], num(f.params.neutralZ));
          break;
        case 'shell': {
          if (!shape) throw new Error('vaciado sin sólido');
          // La cara abierta se elige por su NORMAL (+Z = la de arriba), NUNCA por índice:
          // los índices de cara BAILAN cuando se edita un paso anterior (un fillet crea
          // caras nuevas y renumera). Guardar "cara #7" convierte cualquier edición en
          // una bomba: el vaciado se abriría por la cara equivocada.
          const faces = K.enumerateFaces(oc, shape) as Array<{ normal?: number[]; center?: number[] }>;
          const wantUp = f.params.open !== 'bottom';
          let best = -1, bestScore = -2;
          for (let i = 0; i < faces.length; i++) {
            const n = faces[i]?.normal; if (!n) continue;
            const s = (wantUp ? n[2] : -n[2]) * 1 + (faces[i]?.center?.[2] ?? 0) * 1e-6;
            if (s > bestScore) { bestScore = s; best = i; }
          }
          if (best < 0 || bestScore < 0.85) throw new Error(`no se halló la cara ${wantUp ? 'superior' : 'inferior'} para vaciar`);
          shape = K.shellSolid(oc, shape, num(f.params.thickness, 2), [best]);
          break;
        }
        case 'fillet': {
          if (!shape) throw new Error('redondeo sin sólido');
          const r = num(f.params.r, 1);
          if (f.params.only === 'vertical') {
            // SOLO las esquinas VERTICALES. Dos razones, y las dos importan:
            //  1. INGENIERÍA: un contenedor lleva radio en las esquinas de pared, NO en
            //     la boca ni el fondo — redondear todo no es lo que se fabrica.
            //  2. KERNEL (medido): `filletAllEdges` deja un sólido que este build de
            //     OCCT-WASM ya NO puede VACIAR — MakeThickSolidByJoin truena con
            //     "wasmTable.get is not a function" (excepción C++ que el WASM no
            //     desenrolla). Aislado: caja→vacía ✓, caja+salida→vacía ✓,
            //     caja+radios→✗. Filetear solo las verticales lo deja vaciable.
            const E = K.enumerateEdgesGeom(oc, shape, 8) as Array<{ polyline: Array<[number, number, number]> }>;
            const vert: number[] = [];
            E.forEach((e, i) => {
              const a = e.polyline[0], b = e.polyline[e.polyline.length - 1];
              const dz = Math.abs(b[2] - a[2]), dxy = Math.hypot(b[0] - a[0], b[1] - a[1]);
              if (dz > 5 && dxy < dz * 0.2) vert.push(i);
            });
            if (!vert.length) throw new Error('no hay aristas verticales que redondear');
            shape = K.filletEdges(oc, shape, r, vert);
            note = `${vert.length} esquinas verticales`;
          } else {
            // OJO: filletAllEdgesResilient devuelve {shape, radiusUsedMm, ok, nota} — NO
            // la forma cruda. Pasarle el objeto al siguiente paso truena con "Cannot pass
            // [object Object] as a TopoDS_Shape". Y su `nota` no hay que tragársela: si el
            // radio pedido no cabía lo BAJA, y el usuario debe enterarse (su pieza no
            // tiene la cota que tecleó).
            const fr = K.filletAllEdgesResilient(oc, shape, r);
            shape = fr.shape;
            if (fr.radiusUsedMm < r - 0.01) note = `radio ${r} → ${fr.radiusUsedMm} mm (${fr.nota})`;
          }
          break;
        }
        case 'chamfer':
          if (!shape) throw new Error('chaflán sin sólido');
          shape = K.chamferEdges(oc, shape, num(f.params.d, 1));
          break;
      }
      steps.push({ id: f.id, label: f.label, ok: true, ms: Date.now() - t0, note });
    } catch (e) {
      // el paso truena → se REPORTA y se sigue (explorar > morir)
      steps.push({ id: f.id, label: f.label, ok: false, ms: Date.now() - t0, error: String((e as Error)?.message ?? e).slice(0, 120) });
    }
  }

  let measure: RebuildResult['measure'];
  let measureError: string | undefined;
  if (shape) {
    try {
      const m = K.tessellate(oc, shape, 0.6, 0.6);
      const P = m.positions; const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
      for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); }
      let vol = 0;
      try { vol = K.volume ? K.volume(oc, shape) : 0; } catch { vol = 0; }   // el volumen es extra: que no tumbe la medida
      measure = { bbox: [+(mx[0] - mn[0]).toFixed(2), +(mx[1] - mn[1]).toFixed(2), +(mx[2] - mn[2]).toFixed(2)],
        min: [+mn[0].toFixed(2), +mn[1].toFixed(2), +mn[2].toFixed(2)], volumeMm3: Math.round(vol) };
    } catch (e) {
      // NO tragarse el error: si no se puede medir, hay que saber POR QUÉ (un catch
      // mudo aquí escondía que el rebuild se degradaba tras una cota imposible).
      measureError = String((e as Error)?.message ?? e).slice(0, 160);
    }
  }
  return { shape, steps, measure, measureError };
}

/** malla del resultado (para pintar) — separada de rebuild para poder medir sin teselar 2×. */
export function rebuildMesh(K: any, oc: any, timeline: Feature[]) {
  const r = rebuild(K, oc, timeline);
  return r.shape ? { ...K.tessellate(oc, r.shape, 0.4, 0.4), steps: r.steps, measure: r.measure } : null;
}
