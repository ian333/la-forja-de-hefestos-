/**
 * EL MOLDE ABRE — la lógica PURA de la vista 3D animada (sin React, sin three).
 * ============================================================================
 * "Esas vistas no me sirven de nada si no es en 3D e integrada a La Forja." (operador,
 * tres veces). La lámina L6 ya tiene la cinemática, los mecanismos y el BARRIDO DE
 * INTERFERENCIA verificados; lo que faltaba era poder VERLO moverse. Este archivo no
 * inventa física nueva: **reúsa `lamina-apertura.ts` tal cual** y solo le arma a la
 * escena 3D lo que necesita para pintar un frame:
 *
 *   · los SÓLIDOS con su malla 3D (`solidosApertura`) — los mismos que corta la lámina
 *   · el DESPLAZAMIENTO de cada uno en función de t (`cinematica` + `estadoEn`)
 *   · las COLISIONES REALES en ese t (`interseccionPoligonos` sobre la sección) —
 *     no una bandera precocinada: se mide en el t que estás viendo
 *   · los VEREDICTOS de §11 (`medirApertura`) para poder decir QUÉ está mal, con su cita
 *
 * DOS REGLAS DURAS QUE SE CUMPLEN AQUÍ:
 *
 *  1. **PURO EN t.** Nada de `Math.random()`, nada de reloj. `estadoDe(esc, t)` con el
 *     mismo t devuelve exactamente lo mismo siempre ⇒ la animación se puede capturar,
 *     comparar entre corridas y reproducir. Es lo que permite que el arnés juzgue.
 *
 *  2. **LO NO MEDIDO NO SE PINTA COMO BUENO.** El rojo de colisión sale de la
 *     penetración de sección MEDIDA en ese t (mm²), no de "parece que se tocan". Un par
 *     que el barrido EXCLUYE (barreno no restado por el modelo) se declara excluido y
 *     no se pinta ni verde ni rojo.
 *
 * LÍMITE DECLARADO: la penetración se mide en el PLANO DE CORTE del sprue (es donde
 * `lamina-apertura` tiene su motor de polígonos exacto). Un choque que ocurra fuera de
 * ese plano NO lo ve este barrido. Se dice, no se esconde.
 */

import {
  solidosApertura, seccionPlana, barrerRecorrido, medirApertura, posesDelCiclo,
  estadoEn, cinematica, despPlano, interseccionPoligonos, distanciaPoligonos,
  TOL_PENETRACION_MM2,
  type OpcionesApertura, type MetaApertura, type Pose, type ParVigilado,
  type MedidasApertura, type VeredictoL6, type PiezaPlana,
} from './lamina-apertura';
import type { SolidoSeccion, Vec2, Vec3, RolSeccion } from './lamina-seccion';
import { moldMachine } from './moldmachine';
import { packageToAssemblySpec } from './mold-plano-set';
import { dfmFromMesh } from './dfm-mesh';
import { volumenArea, type Caja, type MallaSimple } from './estudio-vivo-datos';

/* ────────────────────────────────────────────────────────────────────────── */
/* Paleta — la MISMA de la lámina L6, para que el 3D y el papel se lean igual  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface EstiloRol { hex: string; opacidad: number; metal: number; rug: number; nombre: string }

export const ESTILO_ROL: Record<RolSeccion, EstiloRol> = {
  // Las PLACAS van SEMITRANSPARENTES y el molde se sirve CORTADO por el plano del
  // sprue (el mismo de la lámina L6). Probado y descartado: rayos X puro (placas al
  // 0.10, molde entero). El resultado MEDIDO fue un ladrillo ámbar — el apilado de
  // ocho placas translúcidas + los sólidos opacos de adentro sumaba a una masa donde
  // no se distinguía NADA: ni el paquete expulsor, ni el agua, ni el mecanismo. Con
  // el corte, lo de adentro se ve porque no hay acero delante, no porque el acero
  // sea "un poco transparente".
  placa: { hex: '#8ea4c2', opacidad: 0.5, metal: 0.55, rug: 0.42, nombre: 'placa' },
  inserto: { hex: '#b9d0ea', opacidad: 0.72, metal: 0.60, rug: 0.34, nombre: 'inserto' },
  componente: { hex: '#d7b23c', opacidad: 1, metal: 0.72, rug: 0.30, nombre: 'componente' },
  moldeo: { hex: '#ff9d4d', opacidad: 1, metal: 0.05, rug: 0.55, nombre: 'MOLDEO (la pieza)' },
  agua: { hex: '#2aa6e8', opacidad: 1, metal: 0.20, rug: 0.35, nombre: 'línea de agua' },
  colada: { hex: '#e3c96a', opacidad: 1, metal: 0.10, rug: 0.45, nombre: 'colada' },
};

/** ROJO de colisión. Es un color RESERVADO: ningún rol lo usa en reposo. */
export const ROJO_CHOQUE = '#ff3b30';
/** ÁMBAR de contacto (holgura 0 SIN penetración: el talón de §11.4 debe tocar). */
export const AMBAR_CONTACTO = '#ffb347';

/* ────────────────────────────────────────────────────────────────────────── */
/* El spec: lo que llegue, o derivado de la malla (DECLARANDO qué se derivó)   */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SpecDeMolde {
  asm: any;
  maquina: { nombre: string; minDaylightMm: number; maxDaylightMm: number } | null;
  /** de dónde salió el ensamble: dato del Estudio o derivado aquí */
  origen: 'ensamble-dado' | 'machine-spec' | 'derivado-de-la-malla';
  nota: string;
}

const esEnsamble = (s: any) => !!s && typeof s === 'object' && !!s.plates && !!s.cavity && s.widthMm != null;
const esMachineSpec = (s: any) => !!s && typeof s === 'object' && s.Lmm != null && s.Wmm != null && s.Hmm != null;

/**
 * Normaliza lo que el Estudio pase en `spec` a un `MoldAssemblySpec` utilizable.
 * Si no pasa nada, se DERIVA de la malla — y se dice que se derivó: el número de
 * pared sale del raster de `dfm-mesh` (no de un default silencioso).
 */
export function specParaMolde(spec: any | null, malla: MallaSimple, caja: Caja, o?: { nombre?: string; paredMm?: number }): SpecDeMolde {
  if (esEnsamble(spec)) {
    return {
      asm: spec, maquina: null, origen: 'ensamble-dado',
      nota: 'ensamble de molde dado por el Estudio; sin máquina declarada ⇒ V6.1 (daylight) queda SIN CABLEAR',
    };
  }
  const sp = esMachineSpec(spec) ? { ...spec } : (() => {
    const va = volumenArea(malla);
    let pared = o?.paredMm && o.paredMm > 0 ? o.paredMm : 0;
    let comoPared = 'declarada por el Estudio';
    if (!pared) {
      try { pared = dfmFromMesh(malla).wall.p50Mm || 0; comoPared = 'mediana del raster de dfm-mesh'; } catch { /* abajo */ }
    }
    if (!pared) { pared = 2; comoPared = 'DEFAULT 2 mm — el raster no dio pared (dato NO medido)'; }
    return {
      name: o?.nombre ?? 'pieza',
      Lmm: +(caja.x1 - caja.x0).toFixed(1), Wmm: +(caja.y1 - caja.y0).toFixed(1), Hmm: +(caja.z1 - caja.z0).toFixed(1),
      surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
      wallMm: pared, plastic: 'ABS', annualVolume: 500_000,
      __comoPared: comoPared,
    } as any;
  })();
  const pkg = moldMachine(sp as any);
  const asm = packageToAssemblySpec(pkg);
  const mq = (pkg as any)?.diseno?.maquina?.seleccion;
  const maquina = mq && mq.machine
    ? { nombre: mq.machine.name, minDaylightMm: mq.machine.minDaylightMm, maxDaylightMm: mq.machine.maxDaylightMm }
    : null;
  return {
    asm, maquina,
    origen: esMachineSpec(spec) ? 'machine-spec' : 'derivado-de-la-malla',
    nota: esMachineSpec(spec)
      ? 'el molde lo resolvió moldMachine() a partir del spec del Estudio'
      : `molde derivado de la malla (L×W×H de la caja, volumen/área por divergencia, pared: ${(sp as any).__comoPared})`,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* La escena                                                                  */
/* ────────────────────────────────────────────────────────────────────────── */

export interface SolidoVista {
  id: string; nombre: string; rol: RolSeccion;
  grupo: 'fijo' | 'movil' | 'expulsor' | 'mecanismo' | 'sin-grupo';
  malla: { positions: Float32Array; indices: Uint32Array };
  /** caja del sólido en su posición CERRADA (mm de mundo) */
  caja: Caja;
  nota?: string;
}

export interface ChoqueVigilado {
  a: string; b: string;
  penetracionMaxMm2: number;
  tArranqueMm: number | null;
  holguraMinMm: number | null;
  estado: ParVigilado['estado'];
}

export interface EscenaApertura {
  meta: MetaApertura;
  solidos: SolidoVista[];
  piezasPlanas: PiezaPlana[];
  poses: Pose[];
  pares: ParVigilado[];
  medidas: MedidasApertura;
  /** los pares que el barrido marcó INTERFIERE o CONTACTO — los únicos que se re-miden por t */
  vigilados: ChoqueVigilado[];
  /** recorrido total del ciclo (apertura + expulsión) en mm */
  recorridoMm: number;
  /** caja del molde BARRIDA sobre todo el recorrido (nada se sale del encuadre) */
  cajaBarrida: Caja;
  spec: SpecDeMolde;
  /** ms que costó construir la escena (para la barra de verificación) */
  ms: number;
  avisos: string[];
  extensiones: string[];
}

const cajaDeMalla = (P: ArrayLike<number>): Caja => {
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  return { x0, y0, z0, x1, y1, z1 };
};

const f32 = (a: ArrayLike<number>) => (a instanceof Float32Array ? a : Float32Array.from(a as any));
const u32 = (a: ArrayLike<number>) => (a instanceof Uint32Array ? a : Uint32Array.from(a as any));

/**
 * CONSTRUYE la escena. Es lo caro (voxel cero, pero sí el barrido de interferencia con
 * `nMuestras` posiciones × pares × intersección exacta de polígonos), así que la vista
 * lo corre UNA vez por spec y lo cachea; después, mover el slider es aritmética.
 */
export function construirApertura(o: OpcionesApertura & { nMuestras?: number }, spec: SpecDeMolde): EscenaApertura {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const { solidos, meta } = solidosApertura(o);
  const { piezas } = seccionPlana(solidos, meta.plano);
  const poses = posesDelCiclo(meta);
  const { pares } = barrerRecorrido(meta, piezas, o.nMuestras ?? 200);
  const medidas = medirApertura(meta, piezas, pares, o);

  const vista: SolidoVista[] = (solidos as SolidoSeccion[]).map((s) => {
    const pos = f32(s.malla.positions);
    return {
      id: s.id, nombre: s.nombre, rol: s.rol,
      grupo: (meta.grupos.get(s.id) ?? 'sin-grupo') as SolidoVista['grupo'],
      malla: { positions: pos, indices: u32(s.malla.indices) },
      caja: cajaDeMalla(pos),
      nota: s.nota,
    };
  });

  const recorridoMm = meta.aperturaTotalMm + meta.expulsionMm;

  // ── CAJA BARRIDA: la unión de las cajas en todo el recorrido. Con esto el encuadre
  //    se elige UNA vez y nada entra ni sale del cuadro a media animación (el defecto
  //    clásico: la mitad móvil se va del frame justo cuando importa verla).
  const muestras = [0, ...poses.map((p) => p.tMm), recorridoMm];
  let cb: Caja | null = null;
  for (const tm of muestras) {
    const { d, e } = estadoEn(meta, tm);
    const mov = cinematica(meta, d, e);
    for (const s of vista) {
      const t = mov.get(s.id) ?? [0, 0, 0];
      const c: Caja = {
        x0: s.caja.x0 + t[0], x1: s.caja.x1 + t[0],
        y0: s.caja.y0 + t[1], y1: s.caja.y1 + t[1],
        z0: s.caja.z0 + t[2], z1: s.caja.z1 + t[2],
      };
      if (!Number.isFinite(c.x0)) continue;
      cb = cb ? {
        x0: Math.min(cb.x0, c.x0), y0: Math.min(cb.y0, c.y0), z0: Math.min(cb.z0, c.z0),
        x1: Math.max(cb.x1, c.x1), y1: Math.max(cb.y1, c.y1), z1: Math.max(cb.z1, c.z1),
      } : c;
    }
  }

  const vigilados: ChoqueVigilado[] = pares
    .filter((p) => p.estado !== 'OK')
    .map((p) => ({
      a: p.a, b: p.b, penetracionMaxMm2: p.penetracionMaxMm2,
      tArranqueMm: p.tArranqueMm, holguraMinMm: p.holguraMinMm, estado: p.estado,
    }));

  return {
    meta, solidos: vista, piezasPlanas: piezas, poses, pares, medidas, vigilados,
    recorridoMm,
    cajaBarrida: cb ?? { x0: 0, y0: 0, z0: 0, x1: 1, y1: 1, z1: 1 },
    spec,
    ms: Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0),
    avisos: meta.avisos.slice(), extensiones: meta.extensiones.slice(),
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* EL ESTADO EN t — puro                                                      */
/* ────────────────────────────────────────────────────────────────────────── */

const trasladarLazos = (lz: Vec2[][], du: number, dv: number): Vec2[][] =>
  lz.map((L) => L.map((q) => [q[0] + du, q[1] + dv] as Vec2));

export interface ChoqueEnT {
  a: string; b: string;
  /** área de penetración de sección MEDIDA en este t (mm²). 0 = no se penetran */
  areaMm2: number;
  /** distancia mínima (mm) cuando no hay penetración. 0 = contacto */
  holguraMm: number;
  toca: boolean;
  /** DÓNDE choca, en mm de MUNDO: el centroide (ponderado por área) de la penetración.
   *  Sin esto el rojo dice "estos dos se pegan" pero no en qué punto — y el punto es
   *  justo lo que el operador necesita para saber qué corregir. */
  mundo: Vec3 | null;
}

/** (u,v) del plano de corte → mm de MUNDO. El corte proyecta con P·u y P·v (sin restar
 *  p0), y todo punto del plano cumple P·w = p0·w ⇒ la inversa es esta. */
function uvAMundo(meta: MetaApertura, uc: number, vc: number): Vec3 {
  const { u, v, w } = meta.base;
  const p0 = meta.plano.p0;
  const dw = p0[0] * w[0] + p0[1] * w[1] + p0[2] * w[2];
  return [
    dw * w[0] + uc * u[0] + vc * v[0],
    dw * w[1] + uc * u[1] + vc * v[1],
    dw * w[2] + uc * u[2] + vc * v[2],
  ];
}

/** centroide (ponderado por área) de los trapecios que devuelve la intersección */
function centroide(trapecios: Vec2[][]): Vec2 | null {
  let sa = 0, sx = 0, sy = 0;
  for (const T of trapecios) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0; i < T.length; i++) {
      const p = T[i], q = T[(i + 1) % T.length];
      const cr = p[0] * q[1] - q[0] * p[1];
      a += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr;
    }
    a /= 2;
    if (Math.abs(a) < 1e-12) continue;
    sa += Math.abs(a); sx += Math.abs(a) * (cx / (6 * a)); sy += Math.abs(a) * (cy / (6 * a));
  }
  return sa > 0 ? [sx / sa, sy / sa] : null;
}

export interface EstadoApertura {
  t: number;
  /** recorrido acumulado del ciclo (mm) */
  tMm: number;
  /** apertura (mm) y expulsión (mm) */
  d: number; e: number;
  /** fase legible */
  fase: 'apertura' | 'expulsión';
  /** la pose del ciclo más cercana por debajo */
  pose: Pose;
  /** desplazamiento por sólido (mm de mundo) */
  desp: Map<string, Vec3>;
  /** choques MEDIDOS en este t */
  choques: ChoqueEnT[];
  /** ids en rojo (penetran) y en ámbar (tocan sin penetrar) */
  rojos: Set<string>; ambares: Set<string>;
}

/**
 * El estado completo en `t ∈ [0,1]`. PURO: mismo t ⇒ mismo resultado, sin reloj.
 *
 * El choque NO se lee de una bandera del barrido: se vuelve a MEDIR en este t con el
 * mismo motor exacto de polígonos (`interseccionPoligonos`). Por eso el rojo aparece
 * y desaparece donde de verdad ocurre, en vez de encenderse "desde el arranque y ya".
 * Solo se re-miden los pares que el barrido marcó como no-OK (son pocos): re-medir los
 * ~200 pares en cada movimiento del slider colgaría la pantalla.
 */
export function estadoApertura(esc: EscenaApertura, t: number): EstadoApertura {
  const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const tMm = u * esc.recorridoMm;
  const { d, e } = estadoEn(esc.meta, tMm);
  const desp = cinematica(esc.meta, d, e);

  let pose = esc.poses[0];
  for (const p of esc.poses) if (tMm >= p.tMm - 1e-9) pose = p;

  const porId = new Map(esc.piezasPlanas.map((p) => [p.id, p]));
  const choques: ChoqueEnT[] = [];
  const rojos = new Set<string>(), ambares = new Set<string>();
  for (const v of esc.vigilados) {
    const A = porId.get(v.a), B = porId.get(v.b);
    if (!A || !B || !A.lazos.length || !B.lazos.length) continue;
    const [au, av] = despPlano(esc.meta, v.a, d, e);
    const [bu, bv] = despPlano(esc.meta, v.b, d, e);
    const la = trasladarLazos(A.lazos, au, av), lb = trasladarLazos(B.lazos, bu, bv);
    const inter = interseccionPoligonos(la, lb);
    const area = inter.areaMm2;
    const dist = area > TOL_PENETRACION_MM2 ? 0 : distanciaPoligonos(la, lb);
    const toca = area > TOL_PENETRACION_MM2;
    if (toca) { rojos.add(v.a); rojos.add(v.b); }
    else if (dist <= 1e-9) { ambares.add(v.a); ambares.add(v.b); }
    if (toca || dist <= 1e-9) {
      const c = toca ? centroide(inter.trapecios) : null;
      choques.push({
        a: v.a, b: v.b, areaMm2: +area.toFixed(4), holguraMm: +dist.toFixed(4), toca,
        mundo: c ? uvAMundo(esc.meta, c[0], c[1]) : null,
      });
    }
  }
  choques.sort((x, y) => y.areaMm2 - x.areaMm2);

  return {
    t: u, tMm, d, e,
    fase: tMm <= esc.meta.aperturaTotalMm + 1e-9 ? 'apertura' : 'expulsión',
    pose, desp, choques, rojos, ambares,
  };
}

/* ────────────────────────────────────────────────────────────────────────── */
/* La LECTURA (lo que el panel imprime)                                       */
/* ────────────────────────────────────────────────────────────────────────── */

export interface LecturaVista { titulo: string; valor: string; nota?: string; seccion: string }

const nom = (esc: EscenaApertura, id: string) => esc.solidos.find((s) => s.id === id)?.nombre ?? id;

export function lecturaApertura(esc: EscenaApertura, st: EstadoApertura): LecturaVista {
  const valor = `${st.d.toFixed(1)} mm de apertura`
    + (st.e > 1e-9 ? ` · ${st.e.toFixed(1)} mm de expulsión` : '')
    + ` · ${st.pose.nombre}`;
  const rojos = st.choques.filter((c) => c.toca);
  const nota = rojos.length
    ? `⚠ CHOCA: ${rojos.slice(0, 3).map((c) => `${nom(esc, c.a)} ↔ ${nom(esc, c.b)} (${c.areaMm2.toFixed(2)} mm² de penetración)`).join(' · ')}`
      + (rojos.length > 3 ? ` · y ${rojos.length - 3} más` : '')
    : st.choques.length
      ? `contacto (holgura 0, sin penetrar): ${st.choques.slice(0, 2).map((c) => `${nom(esc, c.a)} ↔ ${nom(esc, c.b)}`).join(' · ')}`
      : `sin penetración de sección en este punto del recorrido (${esc.vigilados.length} pares vigilados)`;
  return { titulo: 'EL MOLDE ABRE', valor, nota, seccion: '§11.4 · L6' };
}

/** Los hallazgos DUROS del barrido — lo que el operador debe leer aunque no mueva nada. */
export function hallazgosApertura(esc: EscenaApertura): Array<{ id: string; texto: string; estado: VeredictoL6['estado'] }> {
  const out: Array<{ id: string; texto: string; estado: VeredictoL6['estado'] }> = [];
  for (const v of esc.medidas.veredictos) {
    if (v.estado !== 'VIOLA') continue;
    out.push({ id: v.id, texto: `${v.titulo} — ${v.medido ?? ''}`.trim(), estado: v.estado });
  }
  for (const p of esc.vigilados) {
    if (p.estado !== 'INTERFIERE') continue;
    out.push({
      id: 'choque', estado: 'VIOLA',
      texto: `${nom(esc, p.a)} ↔ ${nom(esc, p.b)}: ${p.penetracionMaxMm2.toFixed(2)} mm² desde ${(p.tArranqueMm ?? 0).toFixed(1)} mm de recorrido`,
    });
  }
  return out;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Encaje en la caja de la pieza (para montarse en el visor del Estudio)      */
/* ────────────────────────────────────────────────────────────────────────── */

export interface Encaje { escala: number; centro: [number, number, number]; centroMolde: [number, number, number] }

/**
 * EL CORTE — el mismo plano del sprue que la lámina L6 secciona, pero en 3D.
 * ============================================================================
 * Devuelve el plano de recorte YA EN COORDENADAS DE MUNDO (three clipea en mundo, y
 * el grupo de la vista lleva escala + traslación del encaje: sin transformarlo, el
 * corte cae en el lugar equivocado).
 *
 * QUÉ MITAD SE QUITA: la que da a la cámara. Con el encuadre del Estudio la cámara
 * está en (+1.15, −1.35, +1.05)·r respecto del centro; se compara esa dirección con la
 * normal del plano y se descarta el lado que tapa. Determinista (no depende de dónde
 * haya orbitado el operador: el corte no debe bailar con la cámara).
 *
 * `THREE.Plane(N, C)` conserva `N·w + C ≥ 0`. Queremos conservar `s·(m·n̂ − dw) ≤ 0`
 * con `w = off + k·m` ⇒ `N = −s·n̂` y `C = s·(off·n̂ + dw·k)`.
 */
export function planoDeCorte(
  meta: MetaApertura, escala: number, off: [number, number, number],
  camara: [number, number, number] = [1.15, -1.35, 1.05],
): { normal: [number, number, number]; constante: number } {
  const n = meta.base.w;
  const p0 = meta.plano.p0;
  const dw = p0[0] * n[0] + p0[1] * n[1] + p0[2] * n[2];
  const haciaCam = n[0] * camara[0] + n[1] * camara[1] + n[2] * camara[2];
  const s = haciaCam >= 0 ? 1 : -1;                    // quitar el lado que mira a la cámara
  const offN = off[0] * n[0] + off[1] * n[1] + off[2] * n[2];
  return {
    normal: [-s * n[0], -s * n[1], -s * n[2]],
    constante: s * (offN + dw * escala),
  };
}

/**
 * El molde mide ~10× la pieza y vive en SUS coordenadas de placa. El visor del Estudio
 * encuadra la CAJA DE LA PIEZA, así que sin esto el molde nace fuera de cuadro.
 *
 * Se resuelve con una SEMEJANZA (escala uniforme + traslación): el molde entra en una
 * ESFERA de `factor × (lado mayor de la pieza)` centrada en la pieza. La escala se
 * DECLARA en el panel — un render a escala sin decirlo sería mentir sobre el tamaño.
 * Los números (mm) que se reportan son SIEMPRE los del molde real, nunca los escalados.
 *
 * POR QUÉ LA DIAGONAL Y NO EL LADO MAYOR (medido, 2026-08-06): con el lado mayor el
 * molde SE SALÍA del cuadro. El encuadre del Estudio pone la cámara a 2.06·r con fov 38
 * ⇒ ve 1.42·r de alto; un LADRILLO de lado 1.45·r visto en 3/4 proyecta hasta su
 * diagonal (×√3 ≈ 2.5·r) y desborda por los cuatro lados. Lo que tiene que caber es la
 * ESFERA que envuelve al molde, no su lado.
 */
export function encajeEnCaja(cajaMolde: Caja, cajaPieza: Caja, factor = 1.15): Encaje {
  const dm = Math.hypot(cajaMolde.x1 - cajaMolde.x0, cajaMolde.y1 - cajaMolde.y0, cajaMolde.z1 - cajaMolde.z0) || 1;
  const lp = Math.max(cajaPieza.x1 - cajaPieza.x0, cajaPieza.y1 - cajaPieza.y0, cajaPieza.z1 - cajaPieza.z0) || 1;
  return {
    escala: (lp * factor) / dm,
    centro: [(cajaPieza.x0 + cajaPieza.x1) / 2, (cajaPieza.y0 + cajaPieza.y1) / 2, (cajaPieza.z0 + cajaPieza.z1) / 2],
    centroMolde: [(cajaMolde.x0 + cajaMolde.x1) / 2, (cajaMolde.y0 + cajaMolde.y1) / 2, (cajaMolde.z0 + cajaMolde.z1) / 2],
  };
}
