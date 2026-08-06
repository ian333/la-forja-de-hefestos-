/**
 * EL CICLO — la lógica PURA (sin DOM, sin React, sin three).
 * ============================================================================
 * "Me gustan, pero no entiendo qué significan los resultados. **Son estudios,
 *  deberían de funcionar en el tiempo.**" (operador)
 *
 * Tiene razón: la inyección ES un proceso en el tiempo — inyectar → empacar →
 * enfriar → abrir → expulsar — y hasta hoy se lo estábamos dando como CAPAS
 * estáticas que se prenden y apagan. El eje natural del estudio es el CICLO.
 *
 * Este archivo arma LA LÍNEA DE TIEMPO en SEGUNDOS REALES. Nada de números
 * tecleados: cada fase trae su duración CON SU ORIGEN (ecuación, § del libro y
 * archivo del repo que la calcula), y cada duración se saca de un motor que YA
 * existe. Lo que NO sale del libro se marca `delLibro: false` y la pantalla lo
 * pinta distinto — porque lo no medido nunca se pinta como bueno.
 *
 * DE DÓNDE SALE CADA SEGUNDO
 * ──────────────────────────
 *  · INYECCIÓN   t = L_flujo / v̄.  v̄ es la velocidad de diseño CONVERGIDA de
 *    Eq 5.23 (§5.5.1), la que ya publica `moldMachine().diseno.velocidad.vMs`.
 *    §5.4 asume caudal constante ⇒ la fracción de volumen llenado es PROPORCIONAL
 *    al tiempo, que es justo el `t` 0..1 de la vista de llenado.
 *  · EMPAQUE     t = min(freeze del gate, t_c de la pared).  El freeze sale de la
 *    Tabla 7.4 (`gating.ts`, ya resuelto en `diseno.gate.freezeS`): cuando la
 *    compuerta congela, YA NO ENTRA MATERIAL aunque el husillo siga empujando.
 *  · ENFRIAMIENTO  lo que le QUEDA al t_c de Eq 9.5 después del empaque. El
 *    empaque ocurre DENTRO del enfriamiento (el plástico ya se está enfriando
 *    mientras se empaca), así que restarlo evita contar el mismo segundo dos
 *    veces — y así la suma de las fases cierra exacto contra el ciclo.
 *  · APERTURA y EXPULSIÓN  el libro NO da tiempos de máquina. El repo reparte
 *    5 s gruesos (`factory.ts:103` — `cicloS = cool.cycleCoolingS + 5`, comentado
 *    "+ apertura/cierre/inyección"). Aquí se usa ESE reparto, se le descuenta la
 *    inyección (que sí se calcula) y lo que queda se parte EN PROPORCIÓN A LAS
 *    CARRERAS REALES: apertura 2.5×H (§6.3.2, `moldOpeningStrokeMm`) contra
 *    expulsión = alto del macho (mínimo geométrico; `lamina-apertura.ts` lo dice
 *    literal: "el libro no da regla de carrera de expulsores"). Las dos fases
 *    van marcadas `delLibro: false`.
 *
 * EL MATERIAL: el ÚNICO con datos verificados contra los ejemplos resueltos del
 * libro es el ABS de Kazmer (`ABS_KAZMER`: α 8.69e-8, 239/60/97.6 °C). Si la
 * pieza declara otra resina, `material.esProxy` lo marca y la pantalla lo dice —
 * misma doctrina que `mold-thermal-fdm.ts`.
 */
import { ABS_KAZMER, coolingTimePlate, centerlineTemperature, type CoolingMaterial } from './cooling';
import { moldMachine, type MoldPackage } from './moldmachine';
import { packageToAssemblySpec } from './mold-plano-set';
import type { MoldAssemblySpec } from './mold-assembly';

/* ────────────────────────────────────────────────────────────────────────── */
/* Tipos                                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

export type FaseId = 'inyeccion' | 'empaque' | 'enfriamiento' | 'apertura' | 'expulsion';

/** Las vistas 3D que YA existen y que el reloj enciende. No se rehace ninguna. */
export type VistaId = 'llenado' | 'agua' | 'apertura' | 'corte' | 'alabeo';

export interface OrigenTiempo {
  /** la ecuación numerada del libro, o el archivo del repo si no la hay */
  ecuacion: string;
  seccion: string;
  /** archivo · función que produce el número (para poder ir a verlo) */
  archivo: string;
  /** true = la duración sale del LIBRO. false = reparto grueso del repo. */
  delLibro: boolean;
  /** la sustitución numérica, para que el número sea auditable y no un dicho */
  sustitucion: string;
}

/**
 * Cómo se mapea el reloj (segundos reales) al control `t` 0..1 de la vista 3D.
 *  · `lineal`      — la fase avanza el control de 0 a 1 (llenado, agua).
 *  · `fijo`        — el control se queda en `valor` (la geometría no se mueve).
 *  · `aperturaSeg` — la vista de apertura recorre apertura Y DESPUÉS expulsión en
 *    un solo `t`; el reparto real depende de las carreras del molde construido,
 *    por eso se pasa `fracApertura` al evaluar.
 */
export interface MapaVista {
  vista: VistaId;
  tipo: 'lineal' | 'fijo' | 'aperturaSeg';
  valor?: number;
  seg?: 'apertura' | 'expulsion';
  /** qué significa el control de esa vista en esta fase (se IMPRIME) */
  nota: string;
}

export interface Fase {
  id: FaseId;
  nombre: string;
  icono: string;
  color: string;
  /** segundos REALES desde el arranque del ciclo */
  t0S: number;
  t1S: number;
  durS: number;
  origen: OrigenTiempo;
  mapa: MapaVista;
}

export interface Ciclo {
  fases: Fase[];
  /** el ciclo de ESTA línea de tiempo = suma exacta de las fases (s) */
  cicloS: number;
  /** el paquete de la Máquina (una sola fuente de verdad para todas las vistas) */
  pkg: MoldPackage;
  /** el ensamble que se le pasa a las vistas: así ninguna deriva su propio molde */
  asm: MoldAssemblySpec | null;
  material: { m: CoolingMaterial; resina: string; esProxy: boolean; nota: string };
  /** espesor de pared que gobierna (mm) y el t_c de Eq 9.5 completo (s) */
  paredMm: number;
  tEnfriamientoTotalS: number;
  /** longitud de flujo usada para el tiempo de inyección (mm) y de dónde salió */
  flowLenMm: number;
  flowLenNota: string;
  /** la CURVA de enfriamiento T_centro(t) en el reloj del ciclo (Eq 9.4, 6 términos) */
  curva: Array<{ tS: number; tempC: number }>;
  /** instante del reloj en que el centro llega a T_eject (= fin del enfriamiento) */
  tCruceS: number;
  /** el ciclo que supone el COSTEO (Eq 3.23 = 4·h²·f_eff) — para comparar, no manda */
  cicloCosteoS: number;
  /** hallazgos que el operador tiene que leer (en cristiano, ya redactados) */
  hallazgos: string[];
  /** cosas declaradas: aproximaciones, materiales prestados, repartos del repo */
  avisos: string[];
  ms: number;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Construcción                                                               */
/* ────────────────────────────────────────────────────────────────────────── */

const COLOR: Record<FaseId, string> = {
  inyeccion: '#4f9ad4',
  empaque: '#c9a227',
  enfriamiento: '#2ec4a6',
  apertura: '#e08a3c',
  expulsion: '#e04a2f',
};

/** El reparto grueso del repo (`factory.ts:103`). NO es del libro y se declara. */
export const REPARTO_MAQUINA_S = 5;

/** Piso duro de las fases de máquina: sin él, una pieza con inyección larga las
 *  dejaría en cero y la línea de tiempo tendría tramos de ancho nulo (invisibles
 *  y con `tVista` indefinido). Se declara en `avisos` cuando entra en juego. */
const PISO_MAQUINA_S = 0.4;

/**
 * TÉRMINOS de la serie de Eq 9.4. El default de `centerlineTemperature` es 6 y
 * NO SIRVE aquí: con 6 términos la curva **SUBE** durante el primer medio segundo
 * (medido: +1.46 °C en la carcasa RPi4, y T(0) sale en 229.6 °C en vez de 239).
 * No es física, es el truncamiento de una serie ALTERNANTE — la suma parcial de
 * Leibniz arranca en π/4 − 1/(4N) y "se recupera" conforme los términos altos
 * mueren. Con N ≥ 24 el artefacto desaparece por completo del muestreo; se usan
 * 400 para que el error en t = 0 quede en ±0.14 °C. Cuesta 400 exp() por punto:
 * nada. Y lo verifica el invariante `temp-baja`, que MIDE la monotonía.
 */
const TERMINOS = 400;

const f2 = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '—');

export interface EntradaCiclo {
  /** `MachineSpec` de la pieza (el mismo que arma EstudioVivo para su capa térmica) */
  spec: any;
  /** longitud de flujo medida (mm). Si falta, se usa el largo de la caja —
   *  la MISMA aproximación que `moldmachine.clampFor` ("L de flujo ≈ largo"). */
  flowLenMm?: number;
}

export function construirCiclo(e: EntradaCiclo): Ciclo {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const spec = e.spec;
  const pkg = moldMachine(spec);
  const d = pkg.diseno;

  const avisos: string[] = [];
  const hallazgos: string[] = [];

  /* ── MATERIAL ── */
  const resina = String(spec.plastic ?? 'ABS');
  const esProxy = resina.toUpperCase() !== 'ABS';
  const material = {
    m: ABS_KAZMER,
    resina,
    esProxy,
    nota: esProxy
      ? `la pieza declara ${resina} pero los tiempos corren con los datos del ABS de Kazmer (α 8.69e-8, 239/60/97.6 °C): es el ÚNICO material verificado contra los ejemplos resueltos del libro. TODOS los segundos de esta línea son PRESTADOS.`
      : 'ABS de Kazmer (α 8.69e-8 m²/s · T_melt 239 · T_agua 60 · T_eject 97.6 °C), verificado contra los ejemplos resueltos del cap 9.',
  };
  if (esProxy) avisos.push(material.nota);

  /* ── 1. INYECCIÓN — §5.5.1 (Eq 5.23 convergida) + §5.4 (caudal constante) ── */
  const vMs = d.velocidad.vMs;
  const flowLenMm = e.flowLenMm && e.flowLenMm > 0 ? e.flowLenMm : Number(spec.Lmm) || 100;
  const flowLenNota = e.flowLenMm && e.flowLenMm > 0
    ? 'longitud de flujo MEDIDA por el campo (Dijkstra sobre resistencia, §5.5.5)'
    : 'longitud de flujo ≈ el LARGO de la caja — la misma aproximación que usa `moldmachine.clampFor` ("L de flujo ≈ largo"). Es una cota BAJA: el camino real serpentea.';
  const tIny = (flowLenMm / 1000) / Math.max(1e-6, vMs);

  /* ── 2/3. EMPAQUE y ENFRIAMIENTO — Eq 9.5 + Tabla 7.4 ── */
  const paredMm = Number(spec.wallMm) > 0 ? Number(spec.wallMm) : 2;
  const hM = paredMm / 1000;
  const tCoolTot = coolingTimePlate(hM, material.m);
  const freezeS = d.gate.freezeS;
  const packNeedS = d.gate.tPackNeededS;
  const tEmp = Math.max(0, Math.min(freezeS, tCoolTot));
  const tEnf = Math.max(0, tCoolTot - tEmp);

  if (d.gate.freezeCorto) {
    hallazgos.push(
      `LA COMPUERTA CONGELA ANTES DE TIEMPO: aguanta ${f2(freezeS)} s de empaque y la pieza necesita ${f2(packNeedS)} s. `
      + `Lo que vas a ver en la pieza: hundimientos en las paredes gruesas y huecos por dentro (el plástico se encogió y ya no entró material a rellenar). `
      + `Se arregla engrosando la compuerta, subiendo la presión de empaque, o adelgazando la pared. §7.1.5`,
    );
  }
  if (Math.abs(packNeedS - tCoolTot) / Math.max(1e-9, tCoolTot) > 0.02) {
    avisos.push(
      `dos Eq 9.5 con α distinta: la línea usa ${f2(tCoolTot)} s (cooling.ts con α del ABS de Kazmer 8.69e-8) y el gate se juzgó contra ${f2(packNeedS)} s `
      + `(feed.ts con α 8.73e-8 del apéndice A). La diferencia es de la constante, no del criterio.`,
    );
  }

  /* ── 4/5. APERTURA y EXPULSIÓN — reparto del REPO, carreras del libro ── */
  const carreraAbrirMm = d.maquina.seleccion.apertura.strokeMm;             // §6.3.2 = 2.5 × H
  const carreraExpulsarMm = Math.max(1, Number(spec.Hmm) || 1);            // alto del macho (mínimo geométrico)
  const resto = REPARTO_MAQUINA_S - tIny;
  const restoUsado = Math.max(PISO_MAQUINA_S, resto);
  if (resto < PISO_MAQUINA_S) {
    avisos.push(
      `la inyección (${f2(tIny)} s) se come casi todos los ${REPARTO_MAQUINA_S} s del reparto del repo: apertura+expulsión se fijaron en el piso de ${PISO_MAQUINA_S} s `
      + `para que los tramos existan. El ciclo total de esta línea YA NO es t_c + 5.`,
    );
  }
  const fracAbrir = carreraAbrirMm / Math.max(1e-9, carreraAbrirMm + carreraExpulsarMm);
  const tAbrir = restoUsado * fracAbrir;
  const tExpulsar = restoUsado * (1 - fracAbrir);

  /* ── LA LÍNEA ── */
  const crudas: Array<{ id: FaseId; nombre: string; icono: string; durS: number; origen: OrigenTiempo; mapa: MapaVista }> = [
    {
      id: 'inyeccion', nombre: 'INYECCIÓN (llenado)', icono: '≈', durS: tIny,
      origen: {
        ecuacion: 'Eq 5.23 (v̄ convergida) → t = L/v̄',
        seccion: '§5.5.1 · §5.4',
        archivo: 'filling.ts · convergeVelocityTraced (vía moldmachine.diseno.velocidad)',
        delLibro: true,
        sustitucion: `${f2(flowLenMm, 1)} mm / ${f2(vMs, 3)} m/s = ${f2(tIny)} s`,
      },
      mapa: {
        vista: 'llenado', tipo: 'lineal',
        nota: 'el control de la vista es la FRACCIÓN DE VOLUMEN inyectada; §5.4 la toma a caudal constante, así que va lineal con el reloj',
      },
    },
    {
      id: 'empaque', nombre: 'EMPAQUE / SOSTENIMIENTO', icono: '⇉', durS: tEmp,
      origen: {
        ecuacion: 'Tabla 7.4 — congelamiento del gate',
        seccion: '§7.3.4 · §7.1.5',
        archivo: 'gating.ts · gateFreezeCylS/StripS (vía moldmachine.diseno.gate.freezeS)',
        delLibro: true,
        sustitucion: `min(freeze ${f2(freezeS)} s, t_c de la pared ${f2(tCoolTot)} s) = ${f2(tEmp)} s`,
      },
      mapa: {
        vista: 'llenado', tipo: 'fijo', valor: 1,
        nota: 'la cavidad está LLENA y el control se queda en 1: en el empaque no se mueve geometría, se mueve PRESIÓN',
      },
    },
    {
      id: 'enfriamiento', nombre: 'ENFRIAMIENTO', icono: '❄', durS: tEnf,
      origen: {
        ecuacion: 'Eq 9.5 — t_c = h²/(π²α)·ln[(4/π)(T_melt−T_agua)/(T_eject−T_agua)]',
        seccion: '§9.1',
        archivo: 'cooling.ts · coolingTimePlate',
        delLibro: true,
        sustitucion: `t_c total ${f2(tCoolTot)} s − empaque ${f2(tEmp)} s = ${f2(tEnf)} s (el empaque ocurre DENTRO del enfriamiento: no se cuenta dos veces)`,
      },
      mapa: {
        vista: 'agua', tipo: 'lineal',
        nota: 'el control de la vista es el RECORRIDO del refrigerante por el circuito, no un reloj: aquí se engancha al reloj para VER el agua avanzando mientras la pieza enfría. Animación DECLARADA, no un tiempo de tránsito medido.',
      },
    },
    {
      id: 'apertura', nombre: 'APERTURA DEL MOLDE', icono: '⇕', durS: tAbrir,
      origen: {
        ecuacion: 'reparto grueso del repo (factory.ts:103) × proporción de carreras',
        seccion: 'carrera §6.3.2 (2.5×H)',
        archivo: 'factory.ts:103 `cicloS = cool.cycleCoolingS + 5` · threeplate.ts · moldOpeningStrokeMm',
        delLibro: false,
        sustitucion: `(${REPARTO_MAQUINA_S} − ${f2(tIny)}) × ${f2(carreraAbrirMm, 1)}/(${f2(carreraAbrirMm, 1)}+${f2(carreraExpulsarMm, 1)}) mm = ${f2(tAbrir)} s`,
      },
      mapa: {
        vista: 'apertura', tipo: 'aperturaSeg', seg: 'apertura',
        nota: 'la vista recorre apertura y DESPUÉS expulsión en un solo control; aquí se le da el primer tramo, cortado en la carrera real del molde construido',
      },
    },
    {
      id: 'expulsion', nombre: 'EXPULSIÓN', icono: '↥', durS: tExpulsar,
      origen: {
        ecuacion: 'reparto grueso del repo (factory.ts:103) × proporción de carreras',
        seccion: 'carrera = mínimo geométrico (alto del macho)',
        archivo: 'factory.ts:103 · lamina-apertura.ts ("el libro no da regla de carrera de expulsores")',
        delLibro: false,
        sustitucion: `(${REPARTO_MAQUINA_S} − ${f2(tIny)}) × ${f2(carreraExpulsarMm, 1)}/(${f2(carreraAbrirMm, 1)}+${f2(carreraExpulsarMm, 1)}) mm = ${f2(tExpulsar)} s`,
      },
      mapa: {
        vista: 'apertura', tipo: 'aperturaSeg', seg: 'expulsion',
        nota: 'el segundo tramo del control de la misma vista: los pines empujando',
      },
    },
  ];

  let acc = 0;
  const fases: Fase[] = crudas.map((c) => {
    const t0S = acc;
    const t1S = acc + c.durS;
    acc = t1S;
    return { id: c.id, nombre: c.nombre, icono: c.icono, color: COLOR[c.id], t0S, t1S, durS: c.durS, origen: c.origen, mapa: c.mapa };
  });
  const cicloS = acc;

  /* ── LA CURVA: T del CENTRO contra el reloj (Eq 9.4, serie de Fourier) ── */
  const tIny0 = fases[0].t1S;                       // la cavidad se llena aquí
  const tCruceS = tIny0 + tCoolTot;                 // aquí el centro llega a T_eject
  const N = 160;
  const curva: Array<{ tS: number; tempC: number }> = [];
  for (let i = 0; i <= N; i++) {
    const tau = (tCoolTot * i) / N;                 // reloj propio del enfriamiento
    curva.push({
      tS: tIny0 + tau,
      tempC: i === 0 ? material.m.tMelt : centerlineTemperature(hM, tau, material.m, TERMINOS),
    });
  }

  /* ── EL COSTEO dice otra cosa: se COMPARA, no se esconde ── */
  const cicloCosteoS = d.enfriamiento.cicloS;       // = Eq 3.23 = 4·h²·f_eff
  const dif = cicloCosteoS - cicloS;
  hallazgos.push(
    `EL CICLO DE ESTA LÍNEA: ${f2(cicloS, 1)} s (suma exacta de las 5 fases). El COSTEO de la Máquina supone ${f2(cicloCosteoS, 1)} s `
    + `(Eq 3.23 = 4·h²·f_eff, Tabla 3.13) — ${Math.abs(dif) < 0.05 ? 'coinciden' : `${dif > 0 ? 'MÁS' : 'MENOS'} por ${f2(Math.abs(dif), 1)} s (${f2(100 * Math.abs(dif) / Math.max(1e-9, cicloS), 0)} %)`}. `
    + `Eq 3.23 es una CORRELACIÓN de costeo, no una simulación: si mandas la línea de tiempo, el costo por pieza cambia ${f2(100 * dif / Math.max(1e-9, cicloCosteoS), 0)} % en la parte de máquina.`,
  );
  hallazgos.push(
    `EL ENFRIAMIENTO SE COME EL CICLO: ${f2(tEmp + tEnf, 1)} s de ${f2(cicloS, 1)} s (${f2(100 * (tEmp + tEnf) / Math.max(1e-9, cicloS), 0)} %). `
    + `Y va con el CUADRADO de la pared: con ${f2(paredMm, 2)} mm son ${f2(tCoolTot, 1)} s; con ${f2(paredMm * 0.75, 2)} mm bajaría a ${f2(coolingTimePlate(hM * 0.75, material.m), 1)} s `
    + `y con ${f2(paredMm * 1.25, 2)} mm subiría a ${f2(coolingTimePlate(hM * 1.25, material.m), 1)} s. Adelgazar la pared es la palanca más grande que tienes sobre el costo.`,
  );

  avisos.push(
    `los ${REPARTO_MAQUINA_S} s de apertura+cierre+inyección son el REPARTO GRUESO DEL REPO (factory.ts:103), NO del libro. `
    + `Kazmer no publica tiempos de máquina. Lo único del libro en esas dos fases es la PROPORCIÓN entre carreras (§6.3.2: 2.5×H).`,
  );
  avisos.push(flowLenNota);

  let asm: MoldAssemblySpec | null = null;
  try { asm = packageToAssemblySpec(pkg); } catch (err) {
    avisos.push(`no se pudo derivar el ensamble (packageToAssemblySpec): ${String(err).slice(0, 120)} — cada vista derivará el suyo`);
  }

  return {
    fases, cicloS, pkg, asm, material,
    paredMm, tEnfriamientoTotalS: tCoolTot,
    flowLenMm, flowLenNota,
    curva, tCruceS, cicloCosteoS,
    hallazgos, avisos,
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Estado en el reloj                                                         */
/* ────────────────────────────────────────────────────────────────────────── */

export interface EstadoCiclo {
  tS: number;
  fase: Fase;
  /** avance DENTRO de la fase, 0..1 */
  u: number;
  /** el control 0..1 que hay que darle a la vista 3D en este instante */
  tVista: number;
  /** T del centro de la pared (°C), o null si el plástico todavía no está adentro
   *  o la pieza ya salió del molde (la ecuación no la sigue en el aire) */
  tempCentroC: number | null;
  /** segundos que faltan para que el centro llegue a T_eject (0 si ya llegó) */
  faltaParaAbrirS: number;
  pctCiclo: number;
}

export function faseEn(c: Ciclo, tS: number): Fase {
  const t = Math.max(0, Math.min(c.cicloS, tS));
  for (const f of c.fases) if (t < f.t1S) return f;
  return c.fases[c.fases.length - 1];
}

/**
 * El control 0..1 de la vista para este instante.
 * `fracApertura` = aperturaTotalMm / (aperturaTotalMm + expulsionMm) del molde
 * REALMENTE construido; la vista lo publica en su escena. Mientras no llegue se
 * usa la estimación del libro (2.5H contra H) y la pantalla lo declara.
 */
export function tVistaEn(f: Fase, tS: number, fracApertura: number): number {
  const u = f.durS > 1e-9 ? Math.max(0, Math.min(1, (tS - f.t0S) / f.durS)) : 1;
  const m = f.mapa;
  if (m.tipo === 'fijo') return m.valor ?? 1;
  if (m.tipo === 'lineal') return u;
  const k = Math.max(0.01, Math.min(0.99, fracApertura));
  return m.seg === 'apertura' ? u * k : k + u * (1 - k);
}

/** T del centro de la pared en el reloj del ciclo (Eq 9.4). null fuera del molde. */
export function tempCentroEn(c: Ciclo, tS: number): number | null {
  const tIny0 = c.fases[0].t1S;
  if (tS < tIny0) return null;                       // el plástico va en camino
  if (tS > c.tCruceS + 1e-9) return null;            // el molde ya abrió: fuera de dominio
  const tau = tS - tIny0;
  // en τ = 0 la cavidad acaba de llenarse: TODO el espesor está a T_melt. La serie
  // truncada ahí vale π/4 − 1/(4N) y devolvería un número ligeramente distinto; el
  // valor exacto es el dato, no la aproximación.
  if (tau <= 0) return c.material.m.tMelt;
  return centerlineTemperature(c.paredMm / 1000, tau, c.material.m, TERMINOS);
}

export function estadoCiclo(c: Ciclo, tS: number, fracApertura: number): EstadoCiclo {
  const t = Math.max(0, Math.min(c.cicloS, tS));
  const f = faseEn(c, t);
  const u = f.durS > 1e-9 ? Math.max(0, Math.min(1, (t - f.t0S) / f.durS)) : 1;
  return {
    tS: t, fase: f, u,
    tVista: tVistaEn(f, t, fracApertura),
    tempCentroC: tempCentroEn(c, t),
    faltaParaAbrirS: Math.max(0, c.tCruceS - t),
    pctCiclo: c.cicloS > 0 ? (100 * t) / c.cicloS : 0,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* EN CRISTIANO — qué está pasando y qué se hace si va mal                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Cristiano {
  titulo: string;
  /** lo que está pasando AHORA, en frases cortas */
  pasa: string[];
  /** la consecuencia física: por qué esto importa en la pieza */
  porque: string;
  /** si algo va mal: qué se ve y qué se hace. null = nada que reportar aquí. */
  mal: string | null;
}

/**
 * El texto del panel. NO es la cita del §, es la CONSECUENCIA.
 * `vivo` trae lo que las vistas 3D reportan en este instante (soldaduras, trampas
 * de gas, choques) — lo que no llegue simplemente no se menciona: no se inventa.
 */
export function cristiano(
  c: Ciclo,
  est: EstadoCiclo,
  vivo?: {
    llenadoPct?: number; soldaduras?: number; trampasInterior?: number; lenFrenteMm?: number;
    choques?: number; areaChoqueMm2?: number;
  },
): Cristiano {
  const d = c.pkg.diseno;
  const g = d.gate;
  const v = vivo ?? {};

  switch (est.fase.id) {
    case 'inyeccion': {
      const pct = v.llenadoPct != null ? v.llenadoPct : est.u * 100;
      return {
        titulo: 'El plástico está ENTRANDO',
        pasa: [
          `Va ${f2(pct, 0)} % de la cavidad llena. El frente sale de la compuerta y empuja el aire hacia afuera.`,
          `Tarda ${f2(est.fase.durS)} s: el fundido corre a ${f2(d.velocidad.vMs, 2)} m/s y tiene que recorrer ${f2(c.flowLenMm, 0)} mm.`,
          v.lenFrenteMm != null ? `El punto más lejano que ya se mojó está a ${f2(v.lenFrenteMm, 0)} mm de la compuerta.` : '',
        ].filter(Boolean),
        porque:
          'El orden en que se llena NO es por cercanía, es por RESISTENCIA: una pared gruesa lejos se llena antes que una delgada cerca. '
          + 'Por eso el color de la vista es "a qué % de llenado llega cada punto" y no una distancia.',
        mal: v.trampasInterior && v.trampasInterior > 0
          ? `Hay ${v.trampasInterior} punto(s) donde el frente CIERRA por dentro de la pieza: ahí el aire queda atrapado, se comprime y QUEMA el plástico (mancha negra). `
            + 'La partición no ventea ahí. Se arregla ventilando por un expulsor en ese punto, o moviendo la compuerta para que el cierre caiga en el borde.'
          : null,
      };
    }
    case 'empaque': {
      return {
        titulo: 'La cavidad ya está llena — ahora se EMPACA',
        pasa: [
          'El plástico ya llegó a todos lados y deja de moverse. Lo que sigue no se ve: el husillo sigue empujando.',
          `Al enfriarse, el plástico se ENCOGE. El empaque mete más material para rellenar ese encogimiento, y solo puede hacerlo mientras la compuerta esté abierta: ${f2(g.freezeS)} s.`,
          `Compuerta tipo ${g.type} de ${f2(g.thicknessMm)} mm${g.widthMm ? ` × ${f2(g.widthMm)} mm` : ''}.`,
          v.soldaduras && v.soldaduras > 0
            ? `Quedaron ${v.soldaduras} línea(s) de soldadura: ahí se encontraron dos frentes. Se ve como una raya y es la zona MÁS DÉBIL de la pieza.`
            : '',
        ].filter(Boolean),
        porque:
          'Cuando la compuerta congela, la pieza queda sellada con la presión que tenga en ese momento. Todo lo que se encoja después ya no se puede rellenar: '
          + 'sale como hundimiento en la superficie o como hueco en el interior.',
        mal: g.freezeCorto
          ? `LA COMPUERTA CONGELA ANTES DE TIEMPO: aguanta ${f2(g.freezeS)} s y la pieza necesita ${f2(g.tPackNeededS)} s. `
            + 'Vas a ver hundimientos en las paredes gruesas y huecos por dentro. Se arregla engrosando la compuerta, subiendo la presión de empaque, o adelgazando la pared. '
            + 'Ojo: esto REPRUEBA la compuerta aunque el cortante y la caída de presión estén bien (§7.1.5).'
          : `La compuerta aguanta el empaque que la pieza necesita (${f2(g.freezeS)} s ≥ ${f2(g.tPackNeededS)} s). `
            + 'La ecuación da el MÍNIMO: ignora el calor que trae el flujo, así que el real será algo mayor.',
      };
    }
    case 'enfriamiento': {
      const T = est.tempCentroC;
      return {
        titulo: 'Aquí no se ve nada — y es lo que más tarda',
        pasa: [
          T != null
            ? `El CENTRO de la pared va en ${f2(T, 0)} °C. Tiene que bajar a ${f2(c.material.m.tEject, 0)} °C.`
            : `El centro de la pared ya llegó a ${f2(c.material.m.tEject, 0)} °C.`,
          est.faltaParaAbrirS > 0.01
            ? `Faltan ${f2(est.faltaParaAbrirS, 1)} s para que el molde pueda abrir.`
            : 'Ya se puede abrir.',
          `El enfriamiento son ${f2(c.tEnfriamientoTotalS, 1)} s de los ${f2(c.cicloS, 1)} s del ciclo: ${f2(100 * c.tEnfriamientoTotalS / Math.max(1e-9, c.cicloS), 0)} %.`,
          `El agua se lleva ${d.enfriamiento.qTotalW} W por las líneas del molde.`,
        ],
        porque:
          'El molde no puede abrir antes: si abres con el centro caliente, la pieza sale blanda, los pines la marcan o la perforan, y se deforma al enfriarse afuera. '
          + `El tiempo va con el CUADRADO de la pared — bajar de ${f2(c.paredMm, 2)} a ${f2(c.paredMm * 0.75, 2)} mm te llevaría de ${f2(c.tEnfriamientoTotalS, 1)} a ${f2(coolingTimePlate(c.paredMm * 0.75 / 1000, c.material.m), 1)} s.`,
        mal: c.material.esProxy
          ? `Los ${f2(c.tEnfriamientoTotalS, 1)} s están calculados con datos de ABS y la pieza declara ${c.material.resina}: este tiempo es PRESTADO, no lo lleves a producción sin la α de tu resina.`
          : null,
      };
    }
    case 'apertura': {
      const ap = d.maquina.seleccion.apertura;
      return {
        titulo: 'El molde ABRE',
        pasa: [
          `La mitad móvil se separa ${f2(ap.strokeMm, 0)} mm (§6.3.2 pide 2-3 alturas de pieza para que salga del núcleo y caiga).`,
          `La máquina necesita ${f2(ap.needMm, 0)} mm de daylight (molde cerrado ${f2(ap.stackMm, 0)} + carrera) y le sobran ${f2(ap.holguraMm, 0)} mm.`,
          d.maquina.seleccion.machine ? `Inyectora ${d.maquina.seleccion.machine.name}.` : '',
        ].filter(Boolean),
        porque:
          'La pieza TIENE que quedarse del lado del núcleo (la mitad móvil): ahí están los expulsores. Si se queda pegada en la cavidad, no hay nada que la empuje '
          + 'y hay que sacarla a mano — con el molde parado.',
        mal: v.choques && v.choques > 0
          ? `HAY ${v.choques} CHOQUE(S) durante la carrera${v.areaChoqueMm2 ? ` (${f2(v.areaChoqueMm2, 1)} mm² de penetración)` : ''}: eso es acero contra acero mientras el molde se mueve. `
            + 'Se arregla recortando la carrera, reubicando el componente que cruza, o alargando el housing. No se resuelve "con cuidado".'
          : (ap.holguraMm < 0
            ? `LA MÁQUINA NO LO ABRE: faltan ${f2(-ap.holguraMm, 0)} mm de daylight. El molde CIERRA pero no abre — molde más compacto o pieza menos honda.`
            : null),
      };
    }
    default: {
      const ex = d.expulsion;
      return {
        titulo: 'Los pines EMPUJAN',
        pasa: [
          `Hay que vencer ${f2(ex.vector.fEjectN, 0)} N: la pieza se encogió SOBRE el macho y lo está apretando.`,
          `Los pines tienen que ser de ⌀ ${f2(Math.max(3, ex.pines.dMinMm), 1)} mm o más para no doblarse ni marcar.`,
          `Carrera: ${f2(Number(c.pkg.spec.Hmm) || 0, 0)} mm — lo mínimo para que la pieza libre el macho.`,
        ],
        porque:
          'Toda esa fuerza entra por la punta de los pines. Si son pocos o delgados, la presión local se dispara: primero marcan la pieza, después la perforan. '
          + 'Por eso los pines van donde la pieza es RÍGIDA (paredes, costillas), nunca en el centro de una cara delgada.',
        mal: ex.vector.notas.length ? ex.vector.notas.join(' · ') : null,
      };
    }
  }
}

/* ────────────────────────────────────────────────────────────────────────── */
/* VERIFICACIÓN — invariantes que se MIDEN, no se suponen                     */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Invariante { id: string; que: string; ok: boolean; medido: string }

export function verificarCiclo(c: Ciclo): { invariantes: Invariante[]; ok: boolean } {
  const inv: Invariante[] = [];

  /* 1. la suma de las fases ES el ciclo */
  const suma = c.fases.reduce((s, f) => s + f.durS, 0);
  inv.push({
    id: 'suma-fases',
    que: 'la suma de las fases = el ciclo total',
    ok: Math.abs(suma - c.cicloS) < 1e-6,
    medido: `Σ = ${suma.toFixed(6)} s · ciclo = ${c.cicloS.toFixed(6)} s · Δ = ${Math.abs(suma - c.cicloS).toExponential(1)} s`,
  });

  /* 2. el tiempo es monótono y sin huecos */
  let mono = c.fases.length > 0 && Math.abs(c.fases[0].t0S) < 1e-9;
  let peor = 0;
  for (let i = 0; i < c.fases.length; i++) {
    if (!(c.fases[i].durS > 0)) mono = false;
    if (i > 0) {
      const hueco = Math.abs(c.fases[i].t0S - c.fases[i - 1].t1S);
      if (hueco > peor) peor = hueco;
      if (hueco > 1e-9) mono = false;
    }
  }
  inv.push({
    id: 'tiempo-monotono',
    que: 'el tiempo es monótono: cada fase empieza donde acabó la anterior y ninguna dura 0',
    ok: mono,
    medido: `${c.fases.length} fases · peor hueco ${peor.toExponential(1)} s · dur mín ${Math.min(...c.fases.map((f) => f.durS)).toFixed(3)} s`,
  });

  /* 3. la T del centro BAJA monótona durante el enfriamiento.
     TOLERANCIA de 1e-9 °C: sumar 400 exponenciales en doble precisión deja un
     temblor del orden de 1e-14 °C entre muestras vecinas (medido: 2.8e-14). Eso es
     ruido de coma flotante, no una subida de temperatura — pero el número se
     IMPRIME de todas formas para que se pueda ver de qué tamaño es. */
  const RUIDO_C = 1e-9;
  let baja = true, peorSubida = 0;
  for (let i = 1; i < c.curva.length; i++) {
    const dT = c.curva[i].tempC - c.curva[i - 1].tempC;
    if (dT > 0) peorSubida = Math.max(peorSubida, dT);
    if (dT > RUIDO_C) baja = false;
  }
  inv.push({
    id: 'temp-baja',
    que: 'la T del centro BAJA monótona durante todo el enfriamiento (tolerancia 1e-9 °C de ruido numérico)',
    ok: baja,
    medido: `${c.curva.length} muestras · ${c.curva[0].tempC.toFixed(1)} → ${c.curva[c.curva.length - 1].tempC.toFixed(1)} °C · peor subida ${peorSubida.toExponential(1)} °C (umbral ${RUIDO_C.toExponential(0)})`,
  });

  /* 4. la curva CRUZA T_eject justo al final del enfriamiento (esa es Eq 9.5) */
  const tFin = c.curva[c.curva.length - 1].tempC;
  inv.push({
    id: 'cruce-teject',
    que: 'la curva llega a T_eject exactamente al terminar el enfriamiento (definición de Eq 9.5)',
    ok: Math.abs(tFin - c.material.m.tEject) < 0.5,
    medido: `T(t_c) = ${tFin.toFixed(2)} °C · T_eject = ${c.material.m.tEject} °C · Δ = ${Math.abs(tFin - c.material.m.tEject).toFixed(3)} °C`,
  });

  /* 5. el reloj cubre las 5 fases sin saltarse ninguna */
  const vistas = new Set<FaseId>();
  const N = 400;
  for (let i = 0; i <= N; i++) vistas.add(faseEn(c, (c.cicloS * i) / N).id);
  inv.push({
    id: 'cinco-fases',
    que: 'barrer el reloj de 0 al ciclo pasa por las 5 fases',
    ok: vistas.size === 5,
    medido: `${vistas.size}/5 fases alcanzadas: ${[...vistas].join(', ')}`,
  });

  return { invariantes: inv, ok: inv.every((i) => i.ok) };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Formato del reloj                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

export function reloj(tS: number): string {
  const s = Math.max(0, tS);
  return `${s.toFixed(2)} s`;
}
