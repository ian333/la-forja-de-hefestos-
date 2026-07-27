// capas.ts — LAS CAPAS DE UNA SIMULACIÓN COMO OBJETOS.
//
// EL PROBLEMA que resuelve: la coreografía de las capas (prender/apagar el campo, presentar
// primero una nube y luego la otra, hacer arder el enlace) estaba QUEMADA en el motor como
// constantes con los segundos del guion de UN video:
//
//     const cloudGate = 1 - 0.42 * win(41.5, 50.8);      // ← segundos de "El puente"
//     const fieldGate = 1 - 0.85 * Math.max(win(7.2,19.6), win(61.8,68.8));
//
// → cada video nuevo obligaba a EDITAR CinematicMolecule.tsx. Aquí cada capa es un OBJETO
// direccionable y su coreografía es DATO (`CapasSpec`), que puede vivir en el manifiesto
// `videos/<id>.json` o servir botones de prender/apagar en el CAD.
//
// DETERMINISMO (regla dura): `evalCapas` es función PURA de t. Cero random, cero reloj.
// Ver docs/CANON-VIDEO.md (Regla #0.5: un video es DATOS, no archivos nuevos).

/** Un modulador: durante estas ventanas de tiempo, suma `a` al valor de la capa. */
export interface Mod {
  /** ventanas [inicio, fin] en segundos del guion */
  wins: [number, number][];
  /** amplitud que se suma en la ventana (negativa = baja la capa) */
  a: number;
  /** cómo se combinan varias ventanas del MISMO modulador (default 'max') */
  combine?: 'max' | 'sum';
  /** para qué es este beat (documentación viva, sale en el debug) */
  label?: string;
}

/** Una capa: su valor base y los moduladores que la coreografían. */
export interface CapaDef {
  base: number;
  mods?: Mod[];
}

/** La coreografía completa de una pieza: sus capas por nombre. */
export type CapasSpec = Record<string, CapaDef>;

/** smoothstep idéntico al que ya usaba el motor (no cambiar: rompería la identidad visual). */
const sw = (t: number, a: number, b: number) => {
  const x = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return x * x * (3 - 2 * x);
};

/** Ventana suave: 1 dentro de [a,b], con bordes de `edge` segundos. */
export const win = (t: number, a: number, b: number, edge = 0.6) =>
  sw(t, a - edge, a) * (1 - sw(t, b, b + edge));

/**
 * Evalúa TODAS las capas en el instante t. Puro en t.
 *   valor(capa) = base + Σ_mods ( a · combine(ventanas) )
 */
export function evalCapas(spec: CapasSpec, t: number, edge = 0.6): Record<string, number> {
  const out: Record<string, number> = {};
  for (const name in spec) {
    const def = spec[name];
    let v = def.base;
    for (const m of def.mods ?? []) {
      const ws = m.wins.map(([a, b]) => win(t, a, b, edge));
      const w = ws.length === 0 ? 0
        : (m.combine === 'sum' ? ws.reduce((s, x) => s + x, 0) : Math.max(...ws));
      v += m.a * w;
    }
    out[name] = v;
  }
  return out;
}

/** Azúcar: "en esta ventana SOLO se ve `capa`" → las demás bajan a `resto`. */
export function solo(spec: CapasSpec, capa: string, wins: [number, number][], resto = 0.15): CapasSpec {
  const out: CapasSpec = { ...spec };
  for (const name in out) {
    if (name === capa) continue;
    const d = out[name];
    out[name] = { ...d, mods: [...(d.mods ?? []), { wins, a: -(d.base * (1 - resto)), label: `solo:${capa}` }] };
  }
  return out;
}
