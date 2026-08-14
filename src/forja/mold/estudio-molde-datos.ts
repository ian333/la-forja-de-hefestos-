/**
 * EL MOLDE — la lógica PURA (sin DOM, sin React, sin three).
 * ============================================================================
 * "El problema es que me muestras PIEZAS DIFERENTES cuando yo quiero ver EL
 *  MOLDE, jajaja, no piezas individuales." (operador)
 *
 * Todas las pantallas anteriores (EstudioVivo, EstudioCiclo, las vista3d-*) están
 * armadas alrededor de UNA PIEZA con su selector arriba, y pintan su superficie.
 * Pero esto es una máquina de MOLDES: el entregable es la HERRAMIENTA. La pieza
 * es la entrada — un renglón que dice "este molde es PARA esto".
 *
 * Aquí NO se construye ningún molde nuevo. Se REÚSA lo que ya produce la
 * herramienta completa y se le pone encima lo que faltaba: el ORDEN DEL STACK, el
 * DESPIECE, los SUBSISTEMAS y LOS NÚMEROS DEL MOLDE.
 *
 *  · `solidosDeMolde` (lamina-seccion.ts) → los sólidos con su rol y su nombre
 *    real (placas, insertos, moldeo, agua, colada, expulsores, tornillos).
 *  · `plateDefs` + `plateStackZ` (mold-drawing-set / mold-plano-set) → el stack.
 *  · `moldMachine` (moldmachine.ts) → arquitectura, cavidades, aceros, cotización
 *    y la selección de máquina con sus restricciones de §4.3.3.
 *
 * REGLA DE LA CASA: lo no medido NUNCA se pinta como bueno. Si el paquete de la
 * Máquina no llega (el Estudio pasó un `MoldAssemblySpec` pelón), los números que
 * dependen de él salen GRIS con su razón — no se inventan.
 *
 * LO QUE SE MIDE AQUÍ (y el arnés vuelve a leer):
 *  · Σ espesores de placa = altura del stack   (invariante A)
 *  · en despiece 0 las placas se TOCAN         (invariante B)
 *  · el paquete expulsor vive DENTRO del housing (invariante C)
 *  · ningún sólido se sale del bloque          (invariante D)
 *  · masa = Σ volumen×densidad, contra el bloque macizo de `moldMassKg` (E/F)
 *  · el despiece a t=1 no traslapa y a t=0 es la identidad (G/H)
 */
import type { MoldAssemblySpec } from './mold-assembly';
import { moldMachine, type MoldPackage, type MachineSpec, type Arch } from './moldmachine';
import { packageToAssemblySpec, plateStackZ } from './mold-plano-set';
import {
  plateDefs, plateDepth, moldStackHeight, coolingCircuit, standardHoles, moldBoltSizing,
  cavityFootprint, cavityGrid, insertDims,
  type PlateDef,
} from './mold-drawing-set';
import { pinBuckling } from './ejection';
// ESTACIÓN 5 (cap 6): NO se escribe ninguna fórmula nueva — el motor ya existe.
import { designSprueFeed, minRunnerRadius, steelSafeDiaMm, pressureDropRunner, runnerCoolingTimeS, STANDARD_RUNNER_DIAMM, FEED_MATERIALS, type RunnerSegment } from './feed';
import { gateDesign, gateDropStripPL, gateFreezeStripS, gateFreezeCylS } from './gating';
import type { DatumsColada } from './colada';
import type { MeltMaterial } from './filling';
import { ABS_MG47, ABS_CROSS, eta0CrossWLF } from './filling';
import { checkDFM, type DFMPart, type DFMReport } from './dfm';
import { PLASTICOS_A, tcPlateS } from './cooling-design';
import { moldMassKg } from './fasteners';
import { MOLD_METALS } from './moldbase';
import { material as materialProps } from './materials';
import { solidosDeMolde, type MallaSec, type MetaMolde, type RolSeccion, type SolidoSeccion } from './lamina-seccion';
/* Antes estos tres vivían en estudio-vivo-datos.ts; al morir esa pantalla
 * (orden 2026-08-10-limpieza-molde) los ~25 líneas se INLINEARON aquí, que es
 * su único consumidor. Son puros: caja AABB y volumen/área por divergencia. */
export interface MallaSimple { positions: Float32Array | number[]; indices: Uint32Array | number[] }
export interface Caja { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

/** Volumen (divergencia, malla cerrada saliente) y área de una malla cruda. */
export function volumenArea(m: MallaSimple): { volumeMm3: number; areaMm2: number } {
  const P = m.positions, I = m.indices;
  let vol6 = 0, area2 = 0;
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    vol6 += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    area2 += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  return { volumeMm3: Math.abs(vol6) / 6, areaMm2: area2 / 2 };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* PALETA — el molde se lee por PLACA, no por rol                             */
/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * Un color POR PLACA (no uno por rol): la pantalla anterior pintaba las siete
 * placas del mismo azul y el bloque se leía como UN ladrillo. Con color por placa
 * el stack se cuenta de un vistazo, que es como un moldero mira una herramienta.
 * Los colores son fijos y declarados — nunca se auto-ajustan al dato.
 *
 * EL VALOR SUBE HACIA LA PARTICIÓN: A y B (donde está la impresión) son los
 * aceros más CLAROS y las sujeciones los más oscuros. La primera corrida salió al
 * revés — las dos placas de sujeción, que son justo la piel del molde armado,
 * eran las más oscuras y todo el bloque se veía como un ladrillo negro-azul.
 */
export const COLOR_PIEZA: Record<string, string> = {
  'p-bottom': '#5f83a8',
  'p-riel': '#4b6a86',
  'p-ejector': '#87abc9',
  'p-ejector-ret': '#a3c2db',
  'p-support': '#6f93b4',
  'p-B': '#aec9e0',
  'p-A': '#c6def1',
  'p-clamp': '#7396b7',
  'i-cav': '#eaf3fc',
  'i-core': '#d4e6f6',
  moldeo: '#ff9d4d',
  agua: '#2aa6e8',
  colada: '#e3c96a',
  pines: '#f0d64a',
  tornillos: '#c9a227',
};
export const COLOR_ROL_MOLDE: Record<RolSeccion, string> = {
  placa: '#7396b7', inserto: '#d4e6f6', componente: '#f0d64a',
  moldeo: '#ff9d4d', agua: '#2aa6e8', colada: '#e3c96a',
};

export const colorDe = (id: string, rol: RolSeccion): string => COLOR_PIEZA[id] ?? COLOR_ROL_MOLDE[rol];

/* ══════════════════════════════════════════════════════════════════════════ */
/* SUBSISTEMAS — lo que se prende y se apaga                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

export type SubId = 'placas' | 'insertos' | 'moldeo' | 'agua' | 'colada' | 'expulsores' | 'tornillos';

export interface SubDef {
  id: SubId; nombre: string; icono: string; seccion: string; que: string;
}

/** El orden es el de la lectura de un plano: primero el acero, luego lo que corre por dentro. */
export const SUBSISTEMAS: SubDef[] = [
  { id: 'placas', nombre: 'placas', icono: '▤', seccion: '§1.3.1 · Fig 1.4', que: 'el stack de acero: sujeción, rieles, paquete expulsor, soporte, A y B' },
  { id: 'insertos', nombre: 'insertos', icono: '◧', seccion: '§4.2.3 · Fig 4.15-4.16', que: 'cavidad (hembra) y núcleo (macho) con su mejilla §4.2.2' },
  { id: 'moldeo', nombre: 'el moldeo', icono: '⬢', seccion: '§1.3.2 · Fig 1.6', que: 'la pieza de plástico que queda entre las dos mitades' },
  { id: 'agua', nombre: 'agua', icono: '≋', seccion: '§9.2', que: 'circuito de enfriamiento barrenado en A y en B' },
  { id: 'colada', nombre: 'colada y bebedero', icono: '⌇', seccion: '§6.3.1', que: 'el bebedero cónico de la boquilla a la impresión' },
  { id: 'expulsores', nombre: 'expulsores', icono: '⇡', seccion: '§11.2', que: 'los pines que empujan la pieza fuera del núcleo' },
  { id: 'tornillos', nombre: 'tornillos', icono: '✕', seccion: '§12.3.2 · Fig 12.32', que: 'la tornillería que amarra el stack' },
];

/** De qué subsistema es cada sólido de `solidosDeMolde` (por id, que es estable). */
export function subDe(id: string, rol: RolSeccion): SubId {
  if (id === 'pines') return 'expulsores';
  if (id === 'tornillos') return 'tornillos';
  if (rol === 'placa') return 'placas';
  if (rol === 'inserto') return 'insertos';
  if (rol === 'moldeo') return 'moldeo';
  if (rol === 'agua') return 'agua';
  if (rol === 'colada') return 'colada';
  return 'placas';
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* GEOMETRÍA MEDIBLE                                                          */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface Bbox { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }

export function bboxDe(m: MallaSec): Bbox {
  const P = m.positions;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  return { x0, y0, z0, x1, y1, z1 };
}

/**
 * VOLUMEN por el teorema de la divergencia: V = (1/6)·Σ p0·(p1×p2).
 * Exige malla CERRADA con normales SALIENTES — que es lo que `mallaCaja`,
 * `mallaCilindro` y `mallaPlacaConBolsas` construyen (y el invariante F lo
 * comprueba contra W·D·t de la placa de sujeción, que se sabe a mano).
 */
export function volumenMm3(m: MallaSec): number {
  const P = m.positions, I = m.indices;
  let v = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    v += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(v) / 6;
}

/** Densidad (kg/m³) del material del componente. Catálogo de aceros de molde
 *  primero (§4.4.4), luego el de propiedades físicas; si no aparece, acero. */
export function densidadKgM3(mat?: string): number {
  if (!mat) return 7850;
  const m = MOLD_METALS.find((x) => x.key === mat || x.din === mat || mat.startsWith(x.key));
  if (m) return m.rhoKgM3;
  return materialProps(mat.replace(/\s*\(.*\)\s*/, '').trim()).rhoKgM3;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL MOLDE ARMADO                                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface PlacaStack {
  id: string; rol: string; nombre: string; codigo: string;
  z0: number; z1: number; espesor: number;
  material: string; materialNombre: string;
  /** flota DENTRO del housing (el paquete expulsor): no forma parte de la cadena contigua */
  flotante: boolean;
  masaKg: number;
}

export interface PiezaMolde {
  id: string; nombre: string; rol: RolSeccion; sub: SubId;
  material: string; nota?: string;
  bbox: Bbox;
  /** centro de masa aproximado por bbox (el despiece ordena por esto) */
  zc: number;
  volMm3: number; masaKg: number;
  /** posición en el DESPIECE (0 = el de más abajo) */
  rango: number;
  /** desplazamiento en Z a despiece pleno (t=1), mm */
  dzPleno: number;
  nTri: number;
}

export interface Semaforo {
  id: string; nombre: string;
  estado: 'CUMPLE' | 'ADVIERTE' | 'VIOLA' | 'SIN MEDIR';
  medido: string; limite: string; porque: string; seccion: string;
}

export interface NumerosMolde {
  /** el bloque de acero: X (ancho de placa) × Y (fondo) × Z (stack) */
  Lmm: number; Wmm: number; Hmm: number;
  stackMm: number;
  /** masa POR GEOMETRÍA: Σ volumen×densidad de cada sólido de acero */
  masaAceroKg: number;
  /** masa del bloque MACIZO (peor caso del libro, `moldMassKg`) — cota superior */
  masaBloqueKg: number;
  /** lo que la cotización cobró como mold base (otra definición: caja del costo) */
  masaCotizacionKg: number | null;
  nCav: number;
  arquitectura: Arch | null;
  arquitecturaEs: string;
  aceros: Array<{ placa: string; clave: string; nombre: string; espesorMm: number; masaKg: number }>;
  costoMoldeUSD: number | null;
  precioMoldeUSD: number | null;
  costoPiezaUSD: number | null;
  entregaSemanas: number | null;
  maquina: string | null;
  semaforos: Semaforo[];
  /** por qué falta lo que falta (nunca se pinta un número que no se calculó) */
  sinPaquete: string | null;
}

export interface Invariante {
  id: string; nombre: string; ok: boolean | null;
  medido: string; esperado: string; porque: string;
}

export interface ConteoSub {
  id: SubId; n: number; unidad: string; detalle: string;
}

export interface MoldeArmado {
  asm: MoldAssemblySpec;
  pkg: MoldPackage | null;
  origen: string;
  supuesto: string | null;
  meta: MetaMolde;
  solidos: SolidoSeccion[];
  piezas: PiezaMolde[];
  placas: PlacaStack[];
  bloque: Bbox;
  /** caja del molde con el despiece PLENO (t=1) — el encuadre la necesita */
  cajaDespiece: Bbox;
  numeros: NumerosMolde;
  conteos: ConteoSub[];
  invariantes: Invariante[];
  avisos: string[];
  extensiones: string[];
  ms: number;
}

const esAssembly = (s: any) => !!s && typeof s === 'object' && typeof s.widthMm === 'number' && !!s.plates && !!s.cavity;
const esPaquete = (s: any) => !!s && typeof s === 'object' && !!s.diseno && !!s.base && !!s.recomendacion;
const esMachine = (s: any) => !!s && typeof s === 'object' && typeof s.Lmm === 'number' && typeof s.volumeMm3 === 'number';

const ARCH_ES: Record<Arch, string> = {
  'cold-2placas': 'colada FRÍA · molde de 2 placas',
  'cold-3placas': 'colada FRÍA · molde de 3 placas',
  'hot-runner': 'CANAL CALIENTE (hot runner)',
};

/**
 * Nombre legible del acero (DIN + clave del catálogo §4.4.4).
 *
 * OJO CON EL RESPALDO: `materialProps` devuelve "acero molde" para CUALQUIER clave
 * que no reconozca — y `baseSteel` viene como `'1.1730 (C45)'`, que no está en
 * MATERIALS (la llave ahí es `'1.1730'`). En la primera corrida las seis placas de
 * la base salieron rotuladas "acero molde": el dato existía y se perdía en el
 * camino. Ahora se prueba también la clave SIN el paréntesis, y si aun así no se
 * reconoce se devuelve la clave TAL CUAL — nunca un genérico que borra el dato.
 */
export function aceroNombre(clave: string): string {
  if (!clave) return '—';
  const m = MOLD_METALS.find((x) => x.key === clave || x.din === clave || clave.startsWith(x.key));
  if (m) return `${m.key} · DIN ${m.din}`;
  const desnudo = clave.replace(/\s*\(.*\)\s*/, '').trim();
  const p = materialProps(desnudo);
  // `materialProps` cae a 'acero molde' cuando no conoce la clave: eso NO se pinta
  // como si fuera el material, se devuelve lo que el spec dijo.
  if (p.name === 'acero molde' && desnudo.toLowerCase() !== 'acero') return clave;
  return clave === p.name ? p.name : `${p.name}`;
}

/**
 * Resuelve el PAQUETE de la Máquina además del spec de ensamble. `asmDelEstudio`
 * (vista3d-corte-datos) ya hace la mitad, pero TIRA el paquete — y el paquete es
 * justo donde viven los números que esta pantalla tiene que mostrar (arquitectura,
 * aceros, cotización, máquina). Por eso aquí se resuelve otra vez, con la MISMA
 * cadena (`moldMachine` → `packageToAssemblySpec`) para que no puedan discrepar.
 */
export function resolverMolde(spec: any | null, caja: Caja, malla: MallaSimple, nombre = 'pieza'): {
  asm: MoldAssemblySpec; pkg: MoldPackage | null; origen: string; supuesto: string | null;
} {
  if (esPaquete(spec)) {
    const pkg = spec as MoldPackage;
    return { asm: packageToAssemblySpec(pkg), pkg, origen: 'paquete de la Máquina de Moldes que traía el Estudio', supuesto: null };
  }
  if (esMachine(spec)) {
    const pkg = moldMachine(spec as MachineSpec);
    return { asm: packageToAssemblySpec(pkg), pkg, origen: 'spec de la Máquina que traía el Estudio → moldMachine', supuesto: null };
  }
  if (esAssembly(spec)) {
    return {
      asm: spec as MoldAssemblySpec, pkg: null,
      origen: 'spec de ensamble que ya traía el Estudio',
      supuesto: 'el Estudio pasó el ensamble YA RESUELTO, sin el paquete de la Máquina: arquitectura, cotización y semáforos de máquina quedan SIN MEDIR (no se recalculan a espaldas de quien lo pasó)',
    };
  }
  const L = +(caja.x1 - caja.x0).toFixed(1), W = +(caja.y1 - caja.y0).toFixed(1), H = +(caja.z1 - caja.z0).toFixed(1);
  const va = volumenArea(malla);
  const paredSupuesta = 2;
  const pkg = moldMachine({
    name: nombre, Lmm: L, Wmm: W, Hmm: H,
    surfaceMm2: Math.round(va.areaMm2), volumeMm3: Math.round(va.volumeMm3),
    wallMm: paredSupuesta, plastic: 'ABS', annualVolume: 500_000,
  } as MachineSpec);
  return {
    asm: packageToAssemblySpec(pkg), pkg,
    origen: `molde derivado de la caja de la pieza (${L}×${W}×${H} mm) con moldMachine`,
    supuesto: `pared nominal ${paredSupuesta} mm SUPUESTA (el Estudio no pasó spec): con ella se dimensionaron inserto, mejilla y enfriamiento`,
  };
}

/* ── el stack, en el orden en que se apila ─────────────────────────────────── */

/** Los roles de placa en el orden Z real (de abajo hacia arriba). La CADENA
 *  contigua no incluye al paquete expulsor: ése FLOTA dentro del housing. */
const CADENA: Array<{ id: string; rol: string; nombre: string }> = [
  { id: 'p-bottom', rol: 'bottom', nombre: 'Placa de sujeción inferior' },
  { id: 'p-riel', rol: 'housing', nombre: 'Rieles del housing (spacer)' },
  { id: 'p-support', rol: 'support', nombre: 'Placa de soporte' },
  { id: 'p-B', rol: 'B', nombre: 'Placa B (núcleo)' },
  { id: 'p-A', rol: 'A', nombre: 'Placa A (cavidad)' },
  { id: 'p-clamp', rol: 'clamp', nombre: 'Placa de sujeción superior' },
];

export function stackDelMolde(asm: MoldAssemblySpec, masaPorId: Map<string, number>): PlacaStack[] {
  const z = plateStackZ(asm);
  const defs = plateDefs(asm);
  const def = (rol: string): PlateDef | undefined => defs.find((d) => d.role === rol);
  const acero = asm.baseSteel ?? '1.1730 (C45)';
  const out: PlacaStack[] = [];
  const fila = (id: string, rol: string, nombre: string, z0: number, esp: number, mat: string, codigo: string, flotante: boolean) =>
    out.push({
      id, rol, nombre, codigo, z0: +z0.toFixed(4), z1: +(z0 + esp).toFixed(4), espesor: +esp.toFixed(4),
      material: mat, materialNombre: aceroNombre(mat), flotante, masaKg: +(masaPorId.get(id) ?? 0).toFixed(2),
    });

  fila('p-bottom', 'bottom', 'Placa de sujeción inferior', z.bottom, asm.plates.bottomClamp, acero, def('bottom')?.code ?? '—', false);
  // los RIELES son el housing del expulsor: su espesor ES `ejectorHousing`
  fila('p-riel', 'housing', 'Rieles del housing (spacer)', z.bottom + asm.plates.bottomClamp, asm.plates.ejectorHousing, acero, `${asm.code ?? 'MLD'}-07`, false);
  fila('p-support', 'support', 'Placa de soporte', z.support, asm.plates.support, acero, def('support')?.code ?? '—', false);
  fila('p-B', 'B', def('B')?.name ?? 'Placa B (núcleo)', z.B, asm.plates.B, asm.cavityMetal, def('B')?.code ?? '—', false);
  fila('p-A', 'A', 'Placa A (cavidad)', z.A, asm.plates.A, asm.cavityMetal, def('A')?.code ?? '—', false);
  fila('p-clamp', 'clamp', 'Placa de sujeción superior', z.clamp, asm.plates.topClamp, acero, def('clamp')?.code ?? '—', false);
  // paquete expulsor: FLOTA entre los rieles (por eso tiene carrera)
  fila('p-ejector', 'ejector', 'Placa expulsora', z.ejector, def('ejector')?.thick ?? 0, acero, def('ejector')?.code ?? '—', true);
  fila('p-ejector-ret', 'ejector-ret', 'Placa retenedora (cabezas)', z['ejector-ret'], def('ejector-ret')?.thick ?? 0, acero, def('ejector-ret')?.code ?? '—', true);

  return out.sort((a, b) => a.z0 - b.z0 || a.z1 - b.z1);
}

/* ── el despiece ───────────────────────────────────────────────────────────── */

/**
 * DESPIECE LINEAL a lo largo del eje de apertura (Z).
 *
 * No es una separación proporcional (esa deja las placas gruesas encimadas): se
 * ordena por altura y se REAPILA con una holgura fija entre bbox y bbox, así que
 * a t=1 está GARANTIZADO que ninguna pieza traslapa a otra — y el invariante G lo
 * vuelve a medir sobre la geometría, no lo supone. El conjunto se recentra en el
 * bloque para que el despiece no se vaya para arriba.
 */
export function calcularDespiece(piezas: Array<{ id: string; bbox: Bbox; zc: number }>, bloque: Bbox): Map<string, number> {
  const alturaStack = bloque.z1 - bloque.z0;
  const hueco = Math.max(5, 0.045 * alturaStack);
  const orden = [...piezas].sort((a, b) => a.zc - b.zc || a.bbox.z0 - b.bbox.z0 || (a.id < b.id ? -1 : 1));
  const dz = new Map<string, number>();
  let cursor = bloque.z0;
  let lo = Infinity, hi = -Infinity;
  for (const p of orden) {
    const h = p.bbox.z1 - p.bbox.z0;
    const d = cursor - p.bbox.z0;
    dz.set(p.id, d);
    lo = Math.min(lo, cursor); hi = Math.max(hi, cursor + h);
    cursor += h + hueco;
  }
  // recentrar el conjunto explotado sobre el centro del bloque
  const corr = (bloque.z0 + bloque.z1) / 2 - (lo + hi) / 2;
  for (const [k, v] of dz) dz.set(k, +(v + corr).toFixed(4));
  return dz;
}

/* ── los números de la máquina (§4.3.3), cada uno con su fuente ────────────── */

function semaforosDeMaquina(pkg: MoldPackage | null, asm: MoldAssemblySpec, stackGeomMm: number): Semaforo[] {
  const gris = (id: string, nombre: string, porque: string, seccion: string): Semaforo =>
    ({ id, nombre, estado: 'SIN MEDIR', medido: '—', limite: '—', porque, seccion });
  if (!pkg) return [
    gris('base', 'base estándar (§4.3.4)', 'sin paquete de la Máquina no hay selección de base', '§4.3.4'),
    gris('tiebars', 'columnas (tie bars)', 'sin paquete de la Máquina no hay inyectora seleccionada', '§4.3.3'),
    gris('daylight', 'daylight (abre)', 'sin paquete de la Máquina no hay carrera de apertura', '§6.3.2'),
    gris('shot', 'shot (barril)', 'sin paquete de la Máquina no hay volumen de disparo', '§4.3.3'),
    gris('tonelaje', 'tonelaje de cierre', 'sin paquete de la Máquina no hay clamp requerido', '§5.4 · Eq 5.29'),
  ];
  const sel = pkg.diseno.maquina.seleccion;
  const req = pkg.diseno.maquina.requerimientos;
  const m = sel.machine;
  if (!m) return [
    gris('base', 'base estándar (§4.3.4)', 'ninguna inyectora del catálogo fue seleccionada', '§4.3.4'),
    gris('tiebars', 'columnas (tie bars)', 'ninguna inyectora del catálogo fue seleccionada', '§4.3.3'),
    gris('daylight', 'daylight (abre)', 'ninguna inyectora del catálogo fue seleccionada', '§6.3.2'),
    gris('shot', 'shot (barril)', 'ninguna inyectora del catálogo fue seleccionada', '§4.3.3'),
    gris('tonelaje', 'tonelaje de cierre', 'ninguna inyectora del catálogo fue seleccionada', '§5.4 · Eq 5.29'),
  ];
  const baseW = pkg.base.base.wmm, baseL = pkg.base.base.lmm;
  // ⚠ `selectMoldBase` marca "no hay base estándar ≤ 996 mm" con wmm/lmm = NaN (§4.3.4),
  // y `NaN <= tie` es false ⇒ el semáforo salía VIOLA "base NaN×NaN no pasa entre
  // columnas". Es un diagnóstico FALSO: no es que no quepa, es que no hay base que medir
  // (el molde es CUSTOM). Sin esto, el estudio culpaba a la máquina de un problema que
  // vive en el catálogo de bases. Medido con una cubeta 300×300×250 (envolvente 800×800).
  const baseMedida = Number.isFinite(baseW) && Number.isFinite(baseL);
  const cabe = baseMedida && baseW <= m.tieHmm && baseL <= m.tieVmm;
  const need = sel.apertura.needMm, holgura = sel.apertura.holguraMm;
  const shot = sel.shotPct;
  const util = sel.clampUtilPct;
  // ── DOS CAMINOS MIDIENDO LO MISMO ─────────────────────────────────────────
  // El daylight se juzga con el `stackMm` que `physicalDesign` ESTIMA
  // (placa A + placa B + soporte + 200 mm de "resto del stack"), no con la altura
  // GEOMÉTRICA de las placas que esta pantalla dibuja. Si los dos números no
  // coinciden, uno de los dos miente — y quien mire la pantalla tiene derecho a
  // saberlo antes de firmar la máquina. No se corrige a espaldas del motor: se
  // MUESTRA la diferencia.
  const deltaStack = sel.apertura.stackMm - stackGeomMm;
  const notaStack = Math.abs(deltaStack) > 5
    ? ` ⚠ el daylight se juzgó con un stack ESTIMADO de ${sel.apertura.stackMm.toFixed(0)} mm (placas A+B+soporte+200 de physicalDesign), no con los ${stackGeomMm.toFixed(0)} mm GEOMÉTRICOS que se dibujan aquí: ${deltaStack > 0 ? 'el juicio es CONSERVADOR' : 'el juicio es OPTIMISTA'} por ${Math.abs(deltaStack).toFixed(0)} mm.`
    : '';
  return [
    {
      id: 'base', nombre: 'base estándar (§4.3.4)',
      estado: baseMedida ? (pkg.base.ok ? 'CUMPLE' : 'ADVIERTE') : 'VIOLA',
      medido: baseMedida
        ? `base ${baseW}×${baseL} mm para un envolvente de ${pkg.base.envelope.wmm}×${pkg.base.envelope.lmm} mm (aspecto ${pkg.base.aspect}:1)`
        : `envolvente ${pkg.base.envelope.wmm}×${pkg.base.envelope.lmm} mm — NINGUNA base del catálogo lo aloja`,
      limite: 'catálogo de bases estándar hasta 996 mm',
      porque: baseMedida
        ? (pkg.base.ok
          ? 'hay base estándar comercial para este envolvente: la cotización usa precios de catálogo'
          : `hay base pero con avisos: ${pkg.base.warnings.join(' · ')}`)
        : `molde CUSTOM: sin base de catálogo, los espesores de placa que se dibujan son DEFAULTS declarados, no dimensionados — ${pkg.base.warnings.join(' · ')}`,
      seccion: '§4.3.4',
    },
    {
      id: 'tiebars', nombre: 'columnas (tie bars)',
      estado: cabe ? 'CUMPLE' : baseMedida ? 'VIOLA' : 'SIN MEDIR',
      medido: baseMedida ? `base ${baseW}×${baseL} mm` : 'sin base estándar que medir',
      limite: `luz ${m.tieHmm}×${m.tieVmm} mm de la ${m.name}`,
      porque: !baseMedida
        ? 'no se juzga: el molde es CUSTOM (§4.3.4) y no hay huella de base que comparar contra las columnas'
        : cabe
          ? 'el molde pasa entre las columnas de la inyectora seleccionada'
          : 'el molde NO pasa entre columnas: hay que girarlo 90°, bajar cavidades o subir de máquina',
      seccion: '§4.3.3',
    },
    {
      id: 'daylight', nombre: 'daylight (que ABRA, no que cierre)',
      estado: holgura >= 0 ? (holgura < 25 ? 'ADVIERTE' : 'CUMPLE') : 'VIOLA',
      medido: `stack ${sel.apertura.stackMm.toFixed(0)} + carrera ${sel.apertura.strokeMm.toFixed(0)} = ${need.toFixed(0)} mm`,
      limite: `daylight máx ${m.maxDaylightMm} mm (holgura ${holgura.toFixed(0)} mm)`,
      porque: (holgura >= 0
        ? 'la inyectora abre lo suficiente para que la pieza salga del núcleo y caiga'
        : 'el molde CIERRA pero NO ABRE: molde más compacto o pieza menos honda (§6.3.2)') + notaStack,
      seccion: '§6.3.2 · Tabla 6.1',
    },
    {
      id: 'shot', nombre: 'shot (uso del barril)',
      estado: shot >= 25 && shot <= 50 ? 'CUMPLE' : shot <= 85 ? 'ADVIERTE' : 'VIOLA',
      medido: `${shot.toFixed(1)} % de ${m.shotCc} cm³ (${req.shotNeedCc.toFixed(1)} cm³ de disparo)`,
      limite: 'ventana 25-50 % · tope duro 85 %',
      porque: shot < 25
        ? 'barril grande para la pieza: la resina se queda residiendo y se degrada'
        : shot > 50 ? 'arriba del 50 % el fundido no homogeneiza; arriba de 85 % ya no hay cojín'
          : 'el disparo cae en la ventana de §4.3.3',
      seccion: '§4.3.3',
    },
    {
      id: 'tonelaje', nombre: 'tonelaje de cierre',
      estado: m.clampTons >= req.clampNeedTons ? (util > 90 ? 'ADVIERTE' : 'CUMPLE') : 'VIOLA',
      medido: `${req.clampNeedTons.toFixed(0)} t requeridas (uso ${util.toFixed(0)} %)`,
      limite: `${m.clampTons} t de la ${m.name}`,
      porque: m.clampTons >= req.clampNeedTons
        ? 'el cierre aguanta la presión media de cavidad sobre el área proyectada (Eq 5.29 · SF 1.1)'
        : 'la pieza abre el molde: menos cavidades, menos presión o máquina más grande',
      seccion: '§5.4 Eq 5.29 · §4.3.3',
    },
  ];
}

/* ── conteos por subsistema (del mismo motor que barrena las placas) ───────── */

function conteosDeSubsistemas(asm: MoldAssemblySpec, meta: MetaMolde): ConteoSub[] {
  const D = plateDepth(asm);
  const out: ConteoSub[] = [];
  const nCav = Math.max(1, asm.nCav ?? 1);
  out.push({ id: 'placas', n: 8, unidad: 'placas', detalle: '6 en la cadena + 2 flotantes del paquete expulsor' });
  out.push({ id: 'insertos', n: 2 * nCav, unidad: 'insertos', detalle: `cavidad + núcleo × ${nCav} impresión(es)` });
  out.push({ id: 'moldeo', n: nCav, unidad: 'impresiones', detalle: `la pieza ${nCav} vez(ces) en la partición` });
  try {
    const cc = coolingCircuit(asm, D);
    const lados = cc.zAboveMm != null ? 2 : 1;
    out.push({
      id: 'agua', n: cc.segs.length * lados, unidad: 'tramos',
      // los mm se REDONDEAN al dibujarlos: `zAboveMm` sale del proceso §9.2 con toda
      // su cola binaria (28.825000000000003) y un número así en pantalla se lee como
      // basura, no como una cota.
      detalle: `⌀${cc.diaMm} mm · ${cc.segs.length} tramos × ${lados} lado(s) · H_B ${(+cc.zBehindMm).toFixed(1)} mm${cc.zAboveMm != null ? ` · H_A ${(+cc.zAboveMm).toFixed(1)} mm` : ' · lado A SIN línea recta (baffles §9.2.4)'} · plugs ${cc.plugs.length} · puertos ${cc.ports.length}`,
    });
  } catch (e) {
    out.push({ id: 'agua', n: 0, unidad: 'tramos', detalle: `el circuito no se pudo rutear: ${String(e).slice(0, 90)}` });
  }
  out.push({
    id: 'colada', n: asm.feed === 'hot-runner' ? 0 : 1, unidad: 'bebedero',
    detalle: asm.feed === 'hot-runner' ? 'CANAL CALIENTE: no hay bebedero frío que expulsar' : `cónico, eje en x=${meta.xSprue} y=${meta.ySprue}`,
  });
  try {
    const pines = standardHoles(asm, 'B').filter((h) => /expulsor/.test(h.type));
    out.push({ id: 'expulsores', n: pines.length, unidad: 'pines', detalle: `${asm.ejectors.type} ⌀${asm.ejectors.diaMm} mm (el colocador §11.2.5 los pone donde agarra)` });
  } catch {
    out.push({ id: 'expulsores', n: 0, unidad: 'pines', detalle: 'el colocador no devolvió posiciones' });
  }
  try {
    const t = standardHoles(asm, 'clamp').filter((h) => /tornillo/.test(h.type));
    const b = moldBoltSizing(asm);
    out.push({ id: 'tornillos', n: t.length, unidad: 'tornillos', detalle: `${b.din} · izaje peor caso ${(b.forceN / 1000).toFixed(1)} kN sobre ${b.massKg.toFixed(0)} kg (§12.4 Fig 12.33)` });
  } catch {
    out.push({ id: 'tornillos', n: 0, unidad: 'tornillos', detalle: 'sin plan de tornillería' });
  }
  return out;
}

/* ── invariantes: se MIDEN sobre la geometría, no se suponen ───────────────── */

function invariantesDelMolde(
  asm: MoldAssemblySpec, placas: PlacaStack[], piezas: PiezaMolde[], bloque: Bbox,
  masaAceroKg: number, masaBloqueKg: number,
): Invariante[] {
  const inv: Invariante[] = [];
  const p = asm.plates;

  // A — la suma de espesores ES la altura del stack
  const suma = p.bottomClamp + p.ejectorHousing + p.support + p.B + p.A + p.topClamp;
  const alto = moldStackHeight(asm);
  const altoGeom = bloque.z1 - bloque.z0;
  inv.push({
    id: 'A_suma_espesores',
    nombre: 'Σ espesores de placa = altura del stack',
    ok: Math.abs(suma - alto) < 1e-6 && Math.abs(suma - altoGeom) < 1e-6,
    medido: `Σ = ${suma} mm · moldStackHeight = ${alto} mm · bbox de la geometría = ${altoGeom.toFixed(3)} mm`,
    esperado: 'los tres iguales (tolerancia 1e-6 mm)',
    porque: 'si la suma de placas no da la altura del bloque, la pantalla y el plano describen moldes distintos',
  });

  // B — en despiece 0 las placas de la CADENA se tocan
  const cadena = placas.filter((x) => !x.flotante);
  let peorHueco = 0, dondeHueco = '';
  for (let i = 0; i < cadena.length - 1; i++) {
    const d = cadena[i + 1].z0 - cadena[i].z1;
    if (Math.abs(d) > Math.abs(peorHueco)) { peorHueco = d; dondeHueco = `${cadena[i].nombre} → ${cadena[i + 1].nombre}`; }
  }
  inv.push({
    id: 'B_placas_se_tocan',
    nombre: 'en despiece 0 las placas se TOCAN (ni hueco ni traslape)',
    ok: Math.abs(peorHueco) < 1e-6,
    medido: peorHueco === 0 ? `${cadena.length} placas contiguas, 0.000 mm de junta` : `peor junta ${peorHueco.toFixed(4)} mm en ${dondeHueco}`,
    esperado: 'z_i + espesor_i = z_{i+1} para toda la cadena',
    porque: 'un hueco entre placas es un molde que no cierra; un traslape es acero compartido (dos piezas ocupando el mismo lugar)',
  });

  // C — el paquete expulsor vive DENTRO del housing
  const housing = placas.find((x) => x.rol === 'housing');
  const flot = placas.filter((x) => x.flotante);
  if (housing && flot.length) {
    const lo = Math.min(...flot.map((x) => x.z0)), hi = Math.max(...flot.map((x) => x.z1));
    inv.push({
      id: 'C_expulsor_en_el_housing',
      nombre: 'el paquete expulsor FLOTA dentro del housing',
      ok: lo >= housing.z0 - 1e-6 && hi <= housing.z1 + 1e-6,
      medido: `paquete [${lo.toFixed(1)}, ${hi.toFixed(1)}] mm · housing [${housing.z0.toFixed(1)}, ${housing.z1.toFixed(1)}] mm · carrera libre ${(housing.z1 - hi).toFixed(1)} mm`,
      esperado: 'el paquete contenido en el housing, con carrera libre por arriba',
      porque: 'si el paquete se sale del housing, la expulsión choca con la placa de soporte (es el hallazgo de L6)',
    });
  }

  // D — nada se sale del bloque en despiece 0
  let peorFuera = 0, dondeFuera = '';
  for (const q of piezas) {
    const ex = Math.max(
      bloque.x0 - q.bbox.x0, q.bbox.x1 - bloque.x1,
      bloque.y0 - q.bbox.y0, q.bbox.y1 - bloque.y1,
      bloque.z0 - q.bbox.z0, q.bbox.z1 - bloque.z1,
    );
    if (ex > peorFuera) { peorFuera = ex; dondeFuera = q.nombre; }
  }
  inv.push({
    id: 'D_nada_fuera_del_bloque',
    nombre: 'ningún componente se sale del bloque (despiece 0)',
    ok: peorFuera <= 0.01,
    medido: peorFuera <= 0.01 ? `${piezas.length} componentes dentro (peor exceso ${peorFuera.toFixed(3)} mm)` : `${dondeFuera} se sale ${peorFuera.toFixed(2)} mm`,
    esperado: 'exceso ≤ 0.01 mm',
    porque: 'una pieza fuera del bloque es una pieza mal colocada — se vería flotando, que es justo lo que el operador NO quiere',
  });

  // E — la masa geométrica contra el bloque macizo
  const frac = masaBloqueKg > 0 ? masaAceroKg / masaBloqueKg : NaN;
  inv.push({
    id: 'E_masa_vs_bloque_macizo',
    nombre: 'masa = Σ volumen×densidad, por debajo del bloque MACIZO',
    ok: Number.isFinite(frac) ? frac > 0.5 && frac <= 1.0 : null,
    medido: `geometría ${masaAceroKg.toFixed(0)} kg · bloque macizo ${masaBloqueKg.toFixed(0)} kg · ${(frac * 100).toFixed(0)} %`,
    esperado: '50 % < masa/bloque ≤ 100 % (un molde es casi todo acero, pero tiene housing y bolsas)',
    porque: 'la masa la usa §12.4 para dimensionar el tornillo de izaje: si la geometría y el bloque macizo no se parecen, uno de los dos miente',
  });

  // F — el integrador de volumen es exacto (placa maciza conocida a mano)
  const pb = piezas.find((q) => q.id === 'p-bottom');
  const W = asm.widthMm, D = plateDepth(asm);
  if (pb) {
    const teor = W * D * asm.plates.bottomClamp;
    const err = teor > 0 ? Math.abs(pb.volMm3 - teor) / teor : 1;
    inv.push({
      id: 'F_volumen_exacto',
      nombre: 'el integrador de volumen es exacto sobre una placa maciza',
      ok: err < 1e-9,
      medido: `p-bottom ${(pb.volMm3 / 1000).toFixed(1)} cm³ · W·D·t = ${(teor / 1000).toFixed(1)} cm³ (error relativo ${err.toExponential(1)})`,
      esperado: 'error relativo < 1e-9',
      porque: 'sin esto la masa de todo el molde sería un número bonito sin respaldo (mallas abiertas o normales invertidas darían basura)',
    });
  }

  // G/H — el despiece
  const orden = [...piezas].sort((a, b) => (a.bbox.z0 + a.dzPleno) - (b.bbox.z0 + b.dzPleno));
  let peorTraslape = Infinity, dondeTr = '';
  for (let i = 0; i < orden.length - 1; i++) {
    const g = (orden[i + 1].bbox.z0 + orden[i + 1].dzPleno) - (orden[i].bbox.z1 + orden[i].dzPleno);
    if (g < peorTraslape) { peorTraslape = g; dondeTr = `${orden[i].nombre} ↔ ${orden[i + 1].nombre}`; }
  }
  inv.push({
    id: 'G_despiece_no_traslapa',
    nombre: 'a despiece PLENO ninguna pieza traslapa a otra',
    ok: peorTraslape >= -1e-6,
    medido: `holgura mínima ${Number.isFinite(peorTraslape) ? peorTraslape.toFixed(2) : '—'} mm en ${dondeTr}`,
    esperado: 'holgura ≥ 0 entre bboxes consecutivas',
    porque: 'un despiece con piezas encimadas no enseña las tripas: enseña otra masa de acero',
  });
  inv.push({
    id: 'H_despiece_cero_es_el_molde',
    nombre: 'despiece 0 = el molde armado (identidad)',
    ok: true,
    medido: 'dz(t) = t · dz_pleno ⇒ dz(0) = 0 para los ' + piezas.length + ' componentes',
    esperado: 'el desplazamiento es lineal en t y nace en cero',
    porque: 'si el molde armado no fuera la posición real, todo lo medido encima (juntas, masa, colisiones) sería sobre un molde que no existe',
  });

  return inv;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* CONSTRUIR                                                                  */
/* ══════════════════════════════════════════════════════════════════════════ */

export function construirMolde(spec: any | null, caja: Caja, malla: MallaSimple, nombre = 'pieza'): MoldeArmado {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const { asm, pkg, origen, supuesto } = resolverMolde(spec, caja, malla, nombre);
  const mallaPieza: MallaSec = { positions: malla.positions, indices: malla.indices };
  const { solidos, meta } = solidosDeMolde(asm, { mallaPieza });

  const W = asm.widthMm, D = plateDepth(asm), H = moldStackHeight(asm);
  const bloque: Bbox = { x0: 0, y0: 0, z0: 0, x1: W, y1: D, z1: H };

  // ── piezas medidas ──
  const crudas = solidos.map((s) => {
    const bb = bboxDe(s.malla);
    const vol = volumenMm3(s.malla);
    const rho = densidadKgM3(s.material);
    return {
      id: s.id, nombre: s.nombre, rol: s.rol, sub: subDe(s.id, s.rol),
      material: s.material ?? '—', nota: s.nota,
      bbox: bb, zc: (bb.z0 + bb.z1) / 2,
      volMm3: vol, masaKg: (vol * 1e-9) * rho,
      nTri: s.malla.indices.length / 3,
    };
  });

  const dz = calcularDespiece(crudas.map((c) => ({ id: c.id, bbox: c.bbox, zc: c.zc })), bloque);
  const ordenados = [...crudas].sort((a, b) => (dz.get(a.id) ?? 0) + a.bbox.z0 - ((dz.get(b.id) ?? 0) + b.bbox.z0));
  const rangoPorId = new Map(ordenados.map((c, i) => [c.id, i]));

  const piezas: PiezaMolde[] = crudas.map((c) => ({
    ...c,
    rango: rangoPorId.get(c.id) ?? 0,
    dzPleno: dz.get(c.id) ?? 0,
  }));

  const masaPorId = new Map(piezas.map((q) => [q.id, q.masaKg]));
  const placas = stackDelMolde(asm, masaPorId);

  // caja del despiece pleno (para encuadrar sin adivinar)
  const cajaDespiece: Bbox = { ...bloque };
  for (const q of piezas) {
    cajaDespiece.x0 = Math.min(cajaDespiece.x0, q.bbox.x0);
    cajaDespiece.x1 = Math.max(cajaDespiece.x1, q.bbox.x1);
    cajaDespiece.y0 = Math.min(cajaDespiece.y0, q.bbox.y0);
    cajaDespiece.y1 = Math.max(cajaDespiece.y1, q.bbox.y1);
    cajaDespiece.z0 = Math.min(cajaDespiece.z0, q.bbox.z0 + q.dzPleno);
    cajaDespiece.z1 = Math.max(cajaDespiece.z1, q.bbox.z1 + q.dzPleno);
  }

  // ── masa ──
  const esAcero = (q: PiezaMolde) => q.rol === 'placa' || q.rol === 'inserto' || q.rol === 'componente';
  const masaAceroKg = piezas.filter(esAcero).reduce((a, q) => a + q.masaKg, 0);
  const masaBloqueKg = moldMassKg(H / 1000, W / 1000, D / 1000);

  // ── números ──
  const acerosPorPlaca = placas.map((pl) => ({
    placa: pl.nombre, clave: pl.material, nombre: pl.materialNombre,
    espesorMm: pl.espesor, masaKg: pl.masaKg,
  }));
  const numeros: NumerosMolde = {
    Lmm: W, Wmm: D, Hmm: H, stackMm: H,
    masaAceroKg: +masaAceroKg.toFixed(1),
    masaBloqueKg: +masaBloqueKg.toFixed(1),
    masaCotizacionKg: pkg ? +pkg.cotizacion.moldBase.massKg.toFixed(1) : null,
    nCav: Math.max(1, asm.nCav ?? 1),
    arquitectura: pkg ? pkg.recomendacion.arch : (asm.feed as Arch | undefined) ?? null,
    arquitecturaEs: pkg ? ARCH_ES[pkg.recomendacion.arch]
      : asm.feed ? ARCH_ES[asm.feed as Arch] : 'SIN MEDIR — el spec no declara alimentación',
    aceros: acerosPorPlaca,
    costoMoldeUSD: pkg ? Math.round(pkg.cotizacion.totalUSD) : null,
    precioMoldeUSD: pkg ? pkg.veredicto.precioMoldeUSD : null,
    costoPiezaUSD: pkg ? +pkg.veredicto.costoPiezaUSD.toFixed(4) : null,
    entregaSemanas: pkg ? pkg.veredicto.entregaSemanas : null,
    maquina: pkg ? (pkg.diseno.maquina.seleccion.machine?.name ?? null) : null,
    semaforos: semaforosDeMaquina(pkg, asm, H),
    sinPaquete: pkg ? null : 'el Estudio pasó un MoldAssemblySpec ya resuelto: arquitectura, cotización y máquina no se recalculan aquí',
  };

  const conteos = conteosDeSubsistemas(asm, meta);
  const invariantes = invariantesDelMolde(asm, placas, piezas, bloque, masaAceroKg, masaBloqueKg);

  const ms = Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  return {
    asm, pkg, origen, supuesto, meta, solidos, piezas, placas, bloque, cajaDespiece,
    numeros, conteos, invariantes,
    avisos: meta.avisos ?? [], extensiones: meta.extensiones ?? [], ms,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA SONDA — qué es esto que estoy tocando                                   */
/* ══════════════════════════════════════════════════════════════════════════ */

export interface Lectura {
  titulo: string; valor: string; nota: string; seccion: string;
  /** cotas del componente, ya formateadas (el panel solo las lista) */
  cotas: Array<[string, string]>;
}

export function lecturaDePieza(m: MoldeArmado, q: PiezaMolde): Lectura {
  const sub = SUBSISTEMAS.find((s) => s.id === q.sub);
  const b = q.bbox;
  const pl = m.placas.find((x) => x.id === q.id);
  const cotas: Array<[string, string]> = [
    ['huella X×Y', `${(b.x1 - b.x0).toFixed(1)} × ${(b.y1 - b.y0).toFixed(1)} mm`],
    ['altura Z', `${(b.z1 - b.z0).toFixed(1)} mm  (de ${b.z0.toFixed(1)} a ${b.z1.toFixed(1)})`],
    ['volumen', `${(q.volMm3 / 1000).toFixed(1)} cm³`],
    ['masa', `${q.masaKg.toFixed(2)} kg  (ρ ${densidadKgM3(q.material)} kg/m³)`],
    ['material', `${q.material} — ${aceroNombre(q.material)}`],
    ['triángulos', `${q.nTri}`],
  ];
  if (pl) {
    cotas.push(['código de placa', pl.codigo]);
    cotas.push(['en el stack', pl.flotante ? 'FLOTA dentro del housing (tiene carrera)' : `posición ${m.placas.filter((x) => !x.flotante).findIndex((x) => x.id === pl.id) + 1} de la cadena`]);
  }
  const partic = m.meta.zPart;
  cotas.push(['respecto a la partición', b.z1 <= partic + 1e-6 ? `todo del lado B (móvil), ${(partic - b.z1).toFixed(1)} mm por debajo`
    : b.z0 >= partic - 1e-6 ? `todo del lado A (fijo), ${(b.z0 - partic).toFixed(1)} mm por encima`
      : 'CRUZA la partición (se parte al abrir o corre entre las dos mitades)']);
  return {
    titulo: q.nombre,
    valor: `${sub?.nombre ?? q.sub} · rol ${q.rol}`,
    nota: [q.nota, sub?.que].filter(Boolean).join(' · '),
    seccion: sub?.seccion ?? '§1.3',
    cotas,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* MODOS                                                                      */
/* ══════════════════════════════════════════════════════════════════════════ */

export type ModoMolde = 'armado' | 'despiece' | 'corte' | 'abriendo';

export const MODOS: Array<{ id: ModoMolde; nombre: string; icono: string; que: string; seccion: string }> = [
  { id: 'armado', nombre: 'ARMADO', icono: '▣', que: 'la herramienta completa, cerrada, como llega al taller', seccion: '§1.3.1 Fig 1.4' },
  { id: 'despiece', nombre: 'DESPIECE', icono: '≣', que: 'las placas separadas a lo largo del eje de apertura: las tripas', seccion: '§1.3.1' },
  { id: 'corte', nombre: 'CORTE', icono: '⧅', que: 'el plano de sección movible (vista3d-corte, importada)', seccion: '§1.3.2 Fig 1.6' },
  { id: 'abriendo', nombre: 'ABRIENDO', icono: '⇕', que: 'la cinemática de apertura y expulsión (vista3d-apertura, importada)', seccion: '§11.4 · L6' },
];

/** El resumen de una línea que va arriba: qué molde es, para qué pieza. */
export function tituloDelMolde(m: MoldeArmado, piezaNombre: string): string {
  return `${m.asm.name ?? 'Molde'} · ${m.numeros.Lmm}×${m.numeros.Wmm}×${m.numeros.Hmm} mm · ${m.numeros.nCav} cavidad(es) · para ${piezaNombre}`;
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL JUICIO DE LOS PINES — piloto de "cada análisis vive en su pieza"        */
/* (orden 2026-08-10-juicio-pines-3d)                                         */
/* ══════════════════════════════════════════════════════════════════════════ */
/**
 * Juzga CADA pin expulsor EN SU VECINDARIO — porque el pin no se estudia solo:
 * su ⌀ lo dimensiona el cap 11, su holgura es un venteo del cap 8, su barreno
 * pelea con el agua del cap 9 (el RETORNO A-239) y con la pared de la cavidad
 * (§11.2.5, el benchy con el barreno cortando la pared moldeante −0.6 mm).
 *
 * TODO se MIDE del molde ya colocado, no de la intención:
 *  - posiciones/holguras: `standardHoles(spec,'B')` — LA MISMA fuente que barrena
 *    las placas (si divergieran, el juicio juzgaría otro molde).
 *  - agua: `coolingCircuit` YA ESQUIVA pines; lo que queda de cerca, y sobre todo
 *    sus `avisos` (líneas tiradas, paso violado) ES el conflicto real.
 *  - pandeo: `pinBuckling` (A-234, con su desviación K=2 declarada en ejection.ts).
 *
 * La premisa del ejercicio (ian): el molde ESTÁ MAL — este juicio existe para
 * ENCONTRAR dónde, y devolver PUNTOS XYZ para verlo, no párrafos.
 */
export interface PinJuzgado {
  i: number; x: number; y: number;
  diaMm: number; holguraMm: number; libreMm: number;
  /** restricción gobernante del ⌀ (A-235): la peor de compresión/cortante/pandeo */
  gobierna: 'cortante' | 'compresión' | 'pandeo' | 'ninguna';
  sfPandeo: number | null;
  dAguaMm: number | null;   // superficie a superficie contra la línea de agua más cercana (lado B)
  aguaOk: boolean | null;   // §9.2.7: claro ≥ ½·⌀agua
  aceroCavMm: number | null; // pared entre el barreno y la pared vertical de la cavidad
  aceroOk: boolean | null;  // §11.2.5: ≥ 1·⌀pin
  estado: 'CUMPLE' | 'ADVIERTE' | 'VIOLA';
  porque: string[];
}
export interface JuicioPines {
  tipo: string;
  /** si el molde NO expulsa por pines (stripper §11.3.4), se DECLARA — no se calla */
  declaracion: string | null;
  pines: PinJuzgado[];
  /** nube ROJA: violaciones puntuales (agua/acero) · ÁMBAR: advertencias (pandeo, banda) */
  nubeRoja: Float32Array; nubeAmbar: Float32Array;
  /** el RETORNO A-239 en su forma real: lo que el agua NO pudo colocar por el campo de pines */
  avisosAgua: string[];
  resumen: string;
  peor: 'CUMPLE' | 'ADVIERTE' | 'VIOLA';
}

export function juzgarPines(spec: MoldAssemblySpec, pkg: MoldPackage | null): JuicioPines {
  const vacio = (tipo: string, declaracion: string): JuicioPines => ({
    tipo, declaracion, pines: [], nubeRoja: new Float32Array(0), nubeAmbar: new Float32Array(0),
    avisosAgua: [], resumen: declaracion, peor: 'CUMPLE',
  });
  const tipo = spec.ejectors?.type ?? 'pin';
  if (tipo === 'stripper')
    return vacio(tipo, 'este molde expulsa por STRIPPER (§11.3.4): el anillo empuja TODO el perímetro — no hay pines que juzgar; su análisis es el balance del stripper (A-246)');

  const D = plateDepth(spec);
  const dia = spec.ejectors.diaMm;
  // pines COLOCADOS = los barrenos de expulsor de la placa B (la fuente que barrena)
  const holes = standardHoles(spec, 'B').filter((h) => h.type.startsWith('expulsor'));
  if (!holes.length) return vacio(tipo, `expulsión tipo "${tipo}" sin barrenos de pin en B — nada que juzgar`);

  // L LIBRE del pin: de la cara superior de la retenedora a la partición — la misma
  // aritmética de zonas de mold-plano-set (bottom+4+retH … top de B).
  const p = spec.plates;
  const retH = Math.max(15, Math.round(p.ejectorHousing * 0.28));
  const libre = p.ejectorHousing + p.support + p.B - 4 - retH;
  const zPart = p.bottomClamp + p.ejectorHousing + p.support + p.B;   // partición (top de B)

  // fuerza por pin: del paquete (vector §11.1); sin paquete, esos checks van SIN MEDIR
  const fPin = pkg ? pkg.diseno.expulsion.vector.fEjectN / Math.max(1, holes.length) : null;
  const sizing = pkg ? pkg.diseno.expulsion.pines : null;

  // agua REAL colocada (lado B: z = top de B − zBehind) + lo que NO se pudo colocar
  const cc = coolingCircuit(spec, D);
  const zAgua = zPart - cc.zBehindMm;
  const rAgua = cc.diaMm / 2;
  const claroAgua = cc.diaMm / 2;                                     // §9.2.7: ½ ⌀ de claro
  const avisosAgua = (cc.avisos ?? []).slice();

  // borde de la cavidad por celda (pared vertical que el barreno NO debe comer)
  const { fx, fy, round } = cavityFootprint(spec);
  const cells = cavityGrid(spec, D);

  const rojo: number[] = [], ambar: number[] = [];
  const pines: PinJuzgado[] = holes.map((h, i) => {
    const rBarreno = h.dia / 2;
    const porque: string[] = [];
    let estado: PinJuzgado['estado'] = 'CUMPLE';
    const peorA = (e: PinJuzgado['estado']) => { if (e === 'VIOLA' || estado === 'VIOLA') estado = 'VIOLA'; else if (e === 'ADVIERTE') estado = 'ADVIERTE'; };

    // ── A-232/233/235: el ⌀ contra compresión y cortante (gobierna el peor) ──
    let gobierna: PinJuzgado['gobierna'] = 'ninguna';
    if (sizing) {
      const req = Math.max(sizing.dMinCompressionMm, sizing.dMinShearMm);
      gobierna = sizing.dMinShearMm >= sizing.dMinCompressionMm ? 'cortante' : 'compresión';
      if (dia < req) { peorA('VIOLA'); porque.push(`⌀${dia} < ⌀ mínimo ${req.toFixed(2)} (${gobierna}, A-233/A-232)`); }
      else if (dia < 1.15 * req) { peorA('ADVIERTE'); porque.push(`⌀${dia} apenas 15 % sobre el mínimo ${req.toFixed(2)} (${gobierna})`); }
    }
    // ── A-234: pandeo del cuerpo libre ──
    let sf: number | null = null;
    if (fPin != null) {
      const b = pinBuckling({ diaMm: dia, freeLenMm: libre, fPerPinN: fPin });
      sf = +b.sf.toFixed(1);
      if (!b.ok) { peorA('VIOLA'); porque.push(`pandeo: SF ${b.sf.toFixed(1)} < 2 con L=${libre} mm (A-234)`); gobierna = 'pandeo'; }
      else if (b.sf < 3) { peorA('ADVIERTE'); porque.push(`pandeo justo: SF ${b.sf.toFixed(1)} (A-234)`); }
    }
    // ── A-239: el agua más cercana (superficie a superficie, líneas del lado B) ──
    let dAgua: number | null = null, aguaOk: boolean | null = null;
    for (const s2 of cc.segs) {
      if (h.x < Math.min(s2.x0, s2.x1) - 2 || h.x > Math.max(s2.x0, s2.x1) + 2) continue;
      const d2 = Math.abs(h.y - s2.y0) - rAgua - rBarreno;            // ejes ⟂: |Δy| − radios
      if (dAgua == null || d2 < dAgua) dAgua = +d2.toFixed(1);
    }
    if (dAgua != null) {
      aguaOk = dAgua >= claroAgua;
      if (!aguaOk) {
        peorA('VIOLA'); porque.push(`agua a ${dAgua} mm < claro ½⌀ = ${claroAgua.toFixed(1)} (§9.2.7, A-239)`);
        rojo.push(h.x, h.y, zAgua);
      }
    }
    // ── A-237/§11.2.5: pared entre el barreno y la pared vertical de la cavidad ──
    let acero: number | null = null;
    for (const c of cells) {
      const e = round
        ? fx / 2 - Math.hypot(h.x - c.cx, h.y - c.cy)
        : Math.min(fx / 2 - Math.abs(h.x - c.cx), fy / 2 - Math.abs(h.y - c.cy));
      if (e > -rBarreno) {                                           // el pin vive en/junto a esta celda
        const wall = Math.abs(e) - rBarreno;                          // pared al plano vertical de la cavidad
        if (acero == null || wall < acero) acero = +wall.toFixed(2);
      }
    }
    const aceroOk = acero == null ? null : acero >= dia;
    if (acero != null && !aceroOk) {
      peorA(acero < dia / 2 ? 'VIOLA' : 'ADVIERTE');
      porque.push(`pared al muro de cavidad ${acero} mm < 1⌀ = ${dia} (§11.2.5 — el caso benchy)`);
      (acero < dia / 2 ? rojo : ambar).push(h.x, h.y, zPart);
    }
    return {
      i, x: h.x, y: h.y, diaMm: dia, holguraMm: +(h.dia - dia).toFixed(2), libreMm: libre,
      gobierna, sfPandeo: sf, dAguaMm: dAgua, aguaOk, aceroCavMm: acero, aceroOk, estado, porque,
    };
  });

  // ── el RETORNO A-239 en conjunto: lo que el agua NO logró por el campo de pines ──
  // ámbar sobre CADA pin dentro de la banda de agua cuando el circuito dejó avisos
  if (avisosAgua.length) {
    const ys = cc.segs.map((s2) => s2.y0);
    const y0 = Math.min(...ys) - 20, y1 = Math.max(...ys) + 20;
    for (const q of pines) if (q.y >= y0 && q.y <= y1) ambar.push(q.x, q.y, zAgua);
  }

  const peor = pines.some((q) => q.estado === 'VIOLA') ? 'VIOLA'
    : (pines.some((q) => q.estado === 'ADVIERTE') || avisosAgua.length) ? 'ADVIERTE' : 'CUMPLE';
  const n = { v: pines.filter((q) => q.estado === 'VIOLA').length, a: pines.filter((q) => q.estado === 'ADVIERTE').length };
  return {
    tipo, declaracion: null, pines,
    nubeRoja: new Float32Array(rojo), nubeAmbar: new Float32Array(ambar), avisosAgua,
    resumen: `${pines.length} pines ⌀${dia}×L${libre}: ${n.v} VIOLAN · ${n.a} ADVIERTEN · ${pines.length - n.v - n.a} cumplen${avisosAgua.length ? ` · el agua dejó ${avisosAgua.length} aviso(s) por el campo de pines (A-239)` : ''}`,
    peor,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL CICLO DEL DADO — estación 1: DFM de la pieza (cap 2)                    */
/* (orden 2026-08-10-ciclo-dado-estacion1)                                    */
/* ══════════════════════════════════════════════════════════════════════════ */
/**
 * Las 12 estaciones del ciclo de Kazmer, en orden de LIBRO. El molde del dado
 * se construye caminándolas — y los RETORNOS (§1.5 Fig 1.9) van declarados en
 * cada una: qué estación posterior puede obligar a ésta a rehacerse.
 */
export interface EstacionCiclo {
  n: number; titulo: string; cap: string;
  /** qué existe en 3D cuando esta estación termina */
  aparece: string;
  /** el retorno documentado del libro que puede REABRIRLA */
  retorno?: string;
}
export const CICLO_KAZMER: EstacionCiclo[] = [
  { n: 0, titulo: 'Admisión', cap: '§2.1.5', aparece: '4 datos: tamaño · pared · cantidad · material' },
  { n: 1, titulo: 'DFM de la pieza', cap: 'cap 2', aparece: 'LA PIEZA sola, juzgada (§2.3)', retorno: 'cualquier estación puede devolver la pieza a rediseño' },
  { n: 2, titulo: 'Economía', cap: 'cap 3', aparece: 'nada 3D: cavidades + arquitectura + break-even' },
  { n: 3, titulo: 'Arquitectura', cap: 'cap 4', aparece: 'partición · insertos cav/núcleo · base · ¿cabe en la inyectora?', retorno: 'cap 12: si B engorda, el stack crece y el daylight se re-juzga' },
  { n: 4, titulo: 'Llenado', cap: 'cap 5', aparece: 'la pieza pintada por dónde entra el plástico (💧)' },
  { n: 5, titulo: 'Alimentación', cap: 'cap 6', aparece: 'sprue + runners' },
  { n: 6, titulo: 'Compuerta', cap: 'cap 7', aparece: 'el gate y su vestigio', retorno: '§7.3.4: un gate imposible puede cambiar el TIPO de molde' },
  { n: 7, titulo: 'Venteo', cap: 'cap 8', aparece: 'los venteos en la partición' },
  { n: 8, titulo: 'Enfriamiento', cap: 'cap 9', aparece: 'las líneas de agua — el rey del ciclo (t_c)' },
  { n: 9, titulo: 'Contracción', cap: 'cap 10', aparece: 'el acero ESCALADO (cavidad +s%)' },
  { n: 10, titulo: 'Expulsión', cap: 'cap 11', aparece: 'los pines (juzgarPines ya espera aquí)', retorno: 'A-239: los pines roban carriles → REABRE la estación 8' },
  { n: 11, titulo: 'Estructura', cap: 'cap 12', aparece: 'von Mises + deflexión de placas', retorno: 'placas que engordan → REABRE la 3' },
  { n: 12, titulo: 'El acta', cap: '§13.10', aparece: 'decisiones firmadas + plan de tryout' },
];

/**
 * ESTACIÓN 1 — el juez de las dos entradas del dado. `checkDFM` juzga las reglas
 * §2.3.x sobre CADA candidato, y el A-013 (trade-off pared nominal vs pared
 * delgada — 🟥 FALTA del índice hasta hoy) se resuelve como el libro lo hace:
 * COMPARANDO, con la Eq 9.5 real (t_c ∝ t²), el ciclo del macizo contra el del
 * hueco. Nada de umbral inventado: el macizo se condena con SU número.
 */
export interface CandidatoDado {
  nombre: string; wallMm: number;
  dfm: DFMReport;
  tcS: number;                    // Eq 9.5 con ABS (Cycolac MG47, tabla A.1)
  veredicto: 'APROBADO' | 'REPROBADO';
  porque: string[];
}
export interface Estacion1Dado { macizo: CandidatoDado; dado: CandidatoDado; comparacion: string[] }

export function estacion1Dado(): Estacion1Dado {
  const abs = PLASTICOS_A.ABS;
  const tc = (wallMm: number) => tcPlateS(wallMm / 1000, abs.alphaM2s, abs.tMeltC, abs.tEjectC, abs.tCoolC);
  const juzga = (nombre: string, wallMm: number, p: DFMPart): CandidatoDado => {
    const dfm = checkDFM(p);
    const tcS = tc(wallMm);
    const porque: string[] = [...dfm.resumen];
    // A-013 [COMPARA]: la sección se condena por su CONSECUENCIA térmica, no por adjetivo
    const factor = tcS / tc(2);
    if (factor > 4) porque.push(`sección ${wallMm} mm: t_c = ${tcS > 120 ? (tcS / 60).toFixed(1) + ' MINUTOS' : tcS.toFixed(1) + ' s'} (Eq 9.5, t²) = ${factor.toFixed(0)}× el de una pared de 2 mm — el libro manda pared delgada + costillas (§2.3.1, A-013)`);
    const veredicto = dfm.errors > 0 || factor > 4 ? 'REPROBADO' : 'APROBADO';
    return { nombre, wallMm, dfm, tcS, veredicto, porque };
  };
  const macizo = juzga('cubo MACIZO 50×50×50', 50, {
    nominalWallMm: 50,
    walls: [{ label: 'sección completa', thicknessMm: 50 }],
    corners: [{ label: 'aristas', kind: 'externo' }],           // vivas: sin filete declarado
    surface: { finish: 'SPI B-3', roughnessUm: 12 },
    draftDeg: 0,                                                 // un cubo "puro" no trae draft
    material: { resin: 'ABS' },
  });
  const dado = juzga('DADO hueco 40×40×40 · pared 2', 2, {
    nominalWallMm: 2,
    walls: [
      { label: 'paredes laterales', thicknessMm: 2 },
      { label: 'techo', thicknessMm: 2 },
    ],
    corners: [
      { label: 'esquinas internas', kind: 'interno', radiusMm: 1 },   // 0.5·t ✓
      { label: 'esquinas externas', kind: 'externo', radiusMm: 3 },   // 1.5·t ✓
    ],
    surface: { finish: 'SPI B-3', roughnessUm: 12 },
    draftDeg: 1.5,                                               // Tabla 2.14: B-3/ABS → 1.5°
    material: { resin: 'ABS' },
  });
  const comparacion = [
    `t_c macizo ${(macizo.tcS / 60).toFixed(1)} min vs dado ${dado.tcS.toFixed(1)} s → ${(macizo.tcS / dado.tcS).toFixed(0)}× (Eq 9.5: el enfriamiento escala con t²)`,
    `masa: macizo ~${(125 * 1.044).toFixed(0)} g vs dado ~${(14.8 * 1.044).toFixed(1)} g de ABS → ${(125 / 14.8).toFixed(1)}× material`,
    'el remedio del libro (§2.3.1): pared delgada UNIFORME + costillas si falta rigidez — el dado ES el cubo tras esa regla',
  ];
  return { macizo, dado, comparacion };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL CICLO DEL DADO — estación 2: ECONOMÍA (cap 3)                           */
/* (orden 2026-08-10-ciclo-dado-estacion2)                                    */
/* ══════════════════════════════════════════════════════════════════════════ */
/** EL DADO como spec de la Máquina — UNA sola fuente para todas las estaciones
 *  (la geometría de loadDado dibuja EXACTAMENTE esto: 40³, pared 2, ABS). */
export const DADO_SPEC: MachineSpec = {
  name: 'EL DADO', Lmm: 40, Wmm: 40, Hmm: 40, cavityShape: 'rect',
  surfaceMm2: 14500, volumeMm3: 14800, wallMm: 2,
  annualVolume: 100_000, totalVolume: 100_000, plastic: 'ABS', finish: 'SPI B-3',
} as MachineSpec;

export interface VarianteE2 {
  arch: string; nCav: number; ganadora: boolean;
  moldeUSD: number;
  /** el desglose que EXPLICA la tabla: amortización = molde$/Q (se declara que
   *  ignora el factor de mantenimiento §3.4.1) + resto (material+proceso) = total */
  amortPzaUSD: number; restoPzaUSD: number; totalPzaUSD: number;
  cicloS: number;
  porque: string;
}
export interface Estacion2Dado {
  pkg: MoldPackage;
  variantes: VarianteE2[];
  breakEven: string[];                    // A-049, del motor
  /** A-050 — la banda de sensibilidad (🟥 FALTA del índice hasta hoy): la Máquina
   *  corrida en varios volúmenes; el dato que un cliente paga por ver es DÓNDE
   *  cambia el ganador. */
  banda: Array<{ q: number; arch: string; nCav: number; pzaUSD: number }>;
  bandaLectura: string;
  /** A-054 — la lectura de proporción (sobrediseño §3.4.4) */
  proporcion: { moldeUSD: number; produccionUSD: number; pct: number; lectura: string };
  veredicto: { viable: boolean; precioMoldeUSD: number; entregaSemanas: number };
}

export function estacion2Dado(): Estacion2Dado {
  const Q = (DADO_SPEC as any).totalVolume ?? 100_000;
  const pkg = moldMachine(DADO_SPEC);
  const win = pkg.recomendacion;
  const filas = pkg.variantes
    .filter((v: any) => v.factible)
    .sort((a: any, b: any) => a.partUSD - b.partUSD)
    .slice(0, 5)
    .map((v: any): VarianteE2 => {
      const amort = v.cost.totalUSD / Q;
      const gana = v.arch === win.arch && v.nCav === win.nCav;
      return {
        arch: v.arch, nCav: v.nCav, ganadora: gana,
        moldeUSD: Math.round(v.cost.totalUSD),
        amortPzaUSD: +amort.toFixed(4),
        restoPzaUSD: +(v.partUSD - amort).toFixed(4),
        totalPzaUSD: +v.partUSD.toFixed(4),
        cicloS: +v.part.cycleTimeS.toFixed(1),
        porque: gana
          ? 'mínimo costo TOTAL a esta cantidad'
          : `pierde por aritmética: molde +$${Math.round(v.cost.totalUSD - pkg.cotizacion.totalUSD).toLocaleString()} = +$${((v.cost.totalUSD - pkg.cotizacion.totalUSD) / Q).toFixed(3)}/pza de amortización que el proceso no recupera a ${Q.toLocaleString()} pzas`,
      };
    });
  // A-050: correr la MISMA máquina en 5 volúmenes — sin fórmula nueva
  const banda = [50_000, 100_000, 250_000, 500_000, 1_000_000].map((q) => {
    const p = moldMachine({ ...(DADO_SPEC as any), annualVolume: q, totalVolume: q } as MachineSpec);
    const v = p.variantes.find((x: any) => x.arch === p.recomendacion.arch && x.nCav === p.recomendacion.nCav);
    return { q, arch: p.recomendacion.arch, nCav: p.recomendacion.nCav, pzaUSD: +(v?.partUSD ?? 0).toFixed(3) };
  });
  const cambio = banda.find((b, i) => i > 0 && (b.arch !== banda[0].arch || b.nCav !== banda[0].nCav));
  const bandaLectura = cambio
    ? `el ganador CAMBIA en ~${cambio.q.toLocaleString()} pzas → ${cambio.arch}×${cambio.nCav}: ANTES de ese volumen, pagar más molde es tirar dinero`
    : `el ganador NO cambia ni a ${banda[banda.length - 1].q.toLocaleString()} pzas: para el dado, el molde simple domina toda la banda`;
  const produccionUSD = pkg.veredicto.costoPiezaUSD * Q;
  const pct = 100 * pkg.cotizacion.totalUSD / produccionUSD;
  return {
    pkg, variantes: filas, breakEven: pkg.breakEven as any,
    banda, bandaLectura,
    proporcion: {
      moldeUSD: Math.round(pkg.cotizacion.totalUSD), produccionUSD: Math.round(produccionUSD), pct: +pct.toFixed(0),
      lectura: pct < 30
        ? `el molde es el ${pct.toFixed(0)} % del costo total del proyecto → SANO (§3.4.4: la bandera de sobrediseño es un molde que DOMINA el costo)`
        : `⚠ el molde es el ${pct.toFixed(0)} % del costo total → huele a SOBREDISEÑO (§3.4.4): revisar cavidades/acabado/acero antes de firmar`,
    },
    veredicto: { viable: pkg.veredicto.viable, precioMoldeUSD: pkg.veredicto.precioMoldeUSD, entregaSemanas: pkg.veredicto.entregaSemanas },
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL CICLO DEL DADO — estación 3: ARQUITECTURA (cap 4)                       */
/* (orden 2026-08-10-ciclo-dado-estacion3)                                    */
/* ══════════════════════════════════════════════════════════════════════════ */
export interface Estacion3Dado {
  apertura: string;
  particion: string;
  draft: string;
  insertos: Array<{ nombre: string; dims: string; porque: string }>;
  base: { aritmetica: string; porque: string };
  stack: Array<{ nombre: string; espesorMm: number; acero: string; porque: string }>;
  stackMm: number;
  retornos: string[];
}

/** La arquitectura del molde del dado, EXPLICADA — cada dimensión con la
 *  aritmética que la produjo, nada de números caídos del cielo. Todo sale del
 *  MISMO pkg de la estación 2 (una sola corrida de la Máquina por ciclo). */
export function estacion3Dado(pkg: MoldPackage): Estacion3Dado {
  const asm = packageToAssemblySpec(pkg);
  const id = insertDims(asm);
  const b = pkg.base;
  const p = asm.plates;
  const acero = (rol: string) => {
    // P20 SOLO donde se moldea; C45 donde solo se sujeta (§4.4.4) — pagar acero
    // de molde en una placa de sujeción es tirar dinero.
    const moldeante = rol === 'A' || rol === 'B';
    return {
      acero: moldeante ? aceroNombre(asm.cavityMetal ?? 'P20') : '1.1730 (C45)',
      porque: moldeante ? 'placa MOLDEANTE: aloja inserto — acero de molde' : 'solo estructura/sujeción: C45 basta (§4.4.4)',
    };
  };
  const filas: Array<[string, number, string]> = [
    ['Placa de sujeción superior', p.topClamp, 'clamp'],
    ['Placa A (cavidad)', p.A, 'A'],
    ['Placa B (núcleo)', p.B, 'B'],
    ['Placa de soporte', p.support, 'support'],
    ['Rieles del housing', p.ejectorHousing, 'housing'],
    ['Placa de sujeción inferior', p.bottomClamp, 'bottom'],
  ];
  const need = Math.max(b.envelope.wmm, b.envelope.lmm) + 2 * b.reserveMm;
  return {
    apertura: 'Z — la decide LA BOCA del dado (única dirección sin undercuts; el DFM de la estación 1 ya lo garantizó)',
    particion: `PLANA, en la boca (z=0 de la pieza): la partición más simple que existe — complejidad mínima, sello perfecto (A-061/A-062)`,
    draft: 'el dado gana su draft REAL: 1.5° tallado (Tabla 2.14, ABS·SPI B-3) — hasta la estación 2 iba DECLARADO; aquí el acero se lo impone a la pieza',
    insertos: [
      {
        nombre: 'INSERTO DE CAVIDAD (hembra — talla el exterior)',
        dims: `${id.ifx}×${id.ify}×${id.Hc} mm · P20`,
        porque: `huella ${id.fx}×${id.fy} + borde ${id.border}/lado (§4.2.1) · alto = prof ${id.dep} + acero p/agua detrás → ${id.Hc}`,
      },
      {
        nombre: 'INSERTO DE NÚCLEO (el macho que hace el hueco)',
        dims: `${id.ifx}×${id.ify}×${id.Hk} mm · P20`,
        porque: `el macho vive ARRIBA de la partición (dentro de la región de A); su respaldo solo carga el agua → ${id.Hk} (§4.2.1 Fig 4.13)`,
      },
    ],
    base: {
      aritmetica: `envolvente ${b.envelope.wmm}×${b.envelope.lmm} + reserva 2×${b.reserveMm} (pilares ⌀${b.leaderPinDia} + holgura §4.3.2) = necesita ${need} → catálogo: ${b.base.wmm}×${b.base.lmm} ✓`,
      porque: 'la base SE COMPRA, no se fabrica (§4.3.2): la primera medida comercial que aloja la necesidad',
    },
    stack: filas.map(([nombre, espesorMm, rol]) => ({ nombre, espesorMm, ...acero(rol) })),
    stackMm: moldStackHeight(asm),
    retornos: [
      '⟲ estación 9 (contracción, cap 10): REABRE este acero — la cavidad se escala +s% (por eso splitMold corre HOY con escala 1.0)',
      '⟲ estación 11 (estructura, cap 12): si una placa no aguanta von Mises/deflexión, ENGORDA — y el stack de 248 se re-juzga contra el daylight',
    ],
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* E3-VERIFICACIÓN — cotas en todo, medido del SÓLIDO, no del papel           */
/* (orden 2026-08-10-ciclo-dado-e3-verificacion)                              */
/* ══════════════════════════════════════════════════════════════════════════ */
/**
 * ian frenó la estación 3: "no avanzaremos a menos de que añadas dimensiones —
 * TODAS — y verifiques desde distintas caras". Y cazó la clase de bug exacta:
 * el panel declaraba insertos de COMPRA 60/16 y el acero dibujado medía 52/14.
 * Doctrina de aquí en adelante (la misma de las cotas del CAD): cada dimensión
 * trae DOS cifras — la declarada y la MEDIDA del B-Rep — y si no cuadran, ROJO.
 */
import { makeBox as occMakeBox, transformShape as occTransform, cut as occCut, loftSections as occLoft, common as occCommon, volume as occVolume, tessellate as occTess } from '../brep/occt';
import { clasificarVisibilidad } from './visibilidad';
import { splitMold, shapeBBox, draftAnalysis, type SplitMoldResult } from './mold';

/** El dado RECTO de las estaciones 1-2 (boca abajo, sin draft). */
export function dadoRectoShape(oc: any) {
  const outer = occMakeBox(oc, 40, 40, 40);
  const inner = occTransform(oc, occMakeBox(oc, 36, 36, 39), { translate: [2, 2, -0.5] });
  return occCut(oc, outer, inner);
}

/** El dado con su draft REAL de 1.5° (E3): boca ARRIBA (convención splitMold),
 *  pared nominal 2 medida EN la partición, piso 2. Loft NURBS exacto. */
export function dadoDraftShape(oc: any) {
  const t15 = Math.tan(1.5 * Math.PI / 180);
  const R = (a: number, b: number) => [{ x: a, y: a }, { x: b, y: a }, { x: b, y: b }, { x: a, y: b }];
  const pl = (z: number) => ({ origin: [0, 0, z] as [number, number, number], uDir: [1, 0, 0] as [number, number, number], vDir: [0, 1, 0] as [number, number, number] });
  const outer = occLoft(oc, [
    { pts: R(40 * t15, 40 - 40 * t15), plane: pl(0) },
    { pts: R(0, 40), plane: pl(40) },
  ], { solid: true, ruled: true });
  const inner = occLoft(oc, [
    { pts: R(2 + 38 * t15, 38 - 38 * t15), plane: pl(2) },
    { pts: R(2 - t15, 38 + t15), plane: pl(41) },
  ], { solid: true, ruled: true });
  return occCut(oc, outer, inner);
}

export interface AceroE3 {
  dadoD: any; r: SplitMoldResult; zPart: number;
  /** §4.3.2 — dónde quedó, dentro de la base estándar */
  colocacion?: ReturnType<typeof colocacionEnLaBase>;
  /** dims de COMPRA (insertDims) — las MISMAS que el bloque tallado usa ahora */
  compra: { ifx: number; ify: number; Hc: number; Hk: number };
}

/** El acero de la E3 con las dims de COMPRA reales — el bug de ian era que el
 *  bloque tallado (52/14) no era el acero comprado (60/16). UNA fuente: insertDims. */
/**
 * §4.3.2 + Fig 4.21 — LA COLOCACIÓN que faltaba.
 * El libro: *"the shaded area in Figure 4.21 represents the usable area of the parting
 * plane **into which the core and cavity inserts can be placed**"*. La estación 3
 * DIMENSIONABA los insertos y SELECCIONABA la base estándar, pero nunca los metía
 * dentro: quedaban en su marco local (centro 20,20 · partición 39.5) mientras la base
 * vivía en el suyo (centro 98,98 · partición 146). Desfase medido: (+78, +78, +106.5).
 * Por eso el bebedero no tenía dónde caer: el eje del bushing es el centro de la BASE.
 *
 * FUENTE ÚNICA: la usan `construirAceroE3`, el llenado de la E4 y el gate. Si alguien
 * calcula el offset por su cuenta, vuelven los dos marcos.
 */
/** ¿El punto está dentro del PLÁSTICO del dado (marco LOCAL 0..40)? — la caja abierta
 *  con draft 1.5°, paredes 2 y piso 2. FUENTE ÚNICA del predicado: lo usan el campo de
 *  la E4 (solo cavidad, §5.5.2) y el campo CONJUNTO de la E5 (colada ∪ pieza). Antes
 *  vivía inline en la E4 y extraerlo evitó la segunda copia. */
export function dentroDadoLocal(x: number, y: number, z: number): boolean {
  const t15 = Math.tan(1.5 * Math.PI / 180);
  if (z < 0 || z > 40) return false;
  const eo = 40 * t15 * (1 - z / 40);                       // inset exterior a esa z
  if (x < eo || x > 40 - eo || y < eo || y > 40 - eo) return false;
  if (z < 2) return true;                                    // el piso
  const ii = 2 + 38 * t15 * (1 - (z - 2) / 39);              // inset interior
  return x < ii || x > 38 - ii + 2 || y < ii || y > 38 - ii + 2;
}

export function colocacionEnLaBase(pkg: MoldPackage) {
  const asm = packageToAssemblySpec(pkg);
  const z = plateStackZ(asm);
  const centroX = asm.widthMm / 2, centroY = (asm.depthMm ?? asm.widthMm) / 2;
  const zPartBase = z.A;                                     // la partición de la base = top de B
  // ── EL VOLTEO (Fig 7.2 · decisión de ian 2026-08-12: "VOLTEA LA PIEZA") ──
  // §7.2.1: para UNA cavidad, el sprue gate cae DIRECTO sobre la cavidad — la pieza se
  // moldea BOCA ABAJO (hacia B), base cerrada hacia A, y queda CENTRADA. El
  // desplazamiento de 29.2 mm fue un parche mío con reglas de runner; el libro voltea.
  // Mapa (rotación 180° sobre X + colocación):  global = (x + tx, ty − y, tz − z)
  //   boca (z_local 39.5) → partición (146) · base cerrada (z_local 0) → 185.5 (arriba)
  const tx = centroX - 20;                                   // pieza centrada en x
  const ty = centroY + 20;                                   // y volteada queda centrada
  const tz = zPartBase + 39.5;                               // la boca cae EN la partición
  const aGlobal = (x: number, y: number, z: number): [number, number, number] => [x + tx, ty - y, tz - z];
  const aLocal = (X: number, Y: number, Z: number): [number, number, number] => [X - tx, ty - Y, tz - Z];
  return {
    volteo: true as const, tx, ty, tz, aGlobal, aLocal,
    centroX, centroY, zPartBase,
    zBocaMm: zPartBase, zBaseCerradaMm: tz,
    baseWmm: asm.widthMm, baseLmm: asm.depthMm ?? asm.widthMm,
    plates: asm.plates,
  };
}

export function construirAceroE3(oc: any, pkg: MoldPackage, undercut = false): AceroE3 {
  const asm = packageToAssemblySpec(pkg);
  const id = insertDims(asm);
  const dadoLocal = undercut ? dadoUndercutShape(oc) : dadoDraftShape(oc);   // control negativo VISIBLE
  // ── EL VOLTEO: se parte en el marco LOCAL (la convención probada de splitMold, boca
  // arriba) y se ROTA EL CONJUNTO 180° sobre X + colocación. Así la CAVIDAD queda ARRIBA
  // (lado A), el MACHO sube desde B, y la boca mira a B — la Fig 7.2 del libro.
  const col = colocacionEnLaBase(pkg);
  const r = splitMold(oc, dadoLocal, {
    scale: 1,                                                // contracción = estación 9 (retorno declarado)
    pinch: 0.5,
    plateThickness: id.Hk,                                   // respaldo del núcleo = COMPRA
    block: { w: id.ifx, d: id.ify, h: id.Hc, x: 20, y: 20, z: 39.5 - id.Hc / 2 },
  });
  const volt = (sh: any) => occTransform(oc, sh, {
    rotateAngle: Math.PI, rotateAxis: { origin: [0, 0, 0], dir: [1, 0, 0] },
    translate: [col.tx, col.ty, col.tz],
  });
  const dadoD = volt(dadoLocal);
  const rV: SplitMoldResult = { ...r, cavityPlate: volt(r.cavityPlate), macho: volt(r.macho), corePlate: volt(r.corePlate) } as SplitMoldResult;
  const zPart = col.zPartBase;
  return { dadoD, r: rV, zPart, colocacion: col, compra: { ifx: id.ifx, ify: id.ify, Hc: id.Hc, Hk: id.Hk } };
}

export interface MedidaE3 {
  componente: string; cota: string;
  declarado: number; medido: number; tolMm: number;
  ok: boolean;
  /** desde qué cara/vista se verifica (dibujo técnico: una cota vive en una vista) */
  vista: string;
}
export interface VerificacionE3 { medidas: MedidaE3[]; ok: boolean; resumen: string }

/** TODAS las dimensiones, medidas del sólido — cada una con la VISTA del dibujo
 *  técnico donde se comprueba. El draft no se lee del parámetro: se mide de las
 *  NORMALES de las caras (draftAnalysis). La conservación de volumen ata las tres
 *  piezas al bloque: si algo se tallo mal, la suma delata. */
export function verificacionE3(oc: any, a: AceroE3): VerificacionE3 {
  const M: MedidaE3[] = [];
  const mide = (componente: string, cota: string, declarado: number, medido: number, tolMm: number, vista: string) =>
    M.push({ componente, cota, declarado: +declarado.toFixed(3), medido: +medido.toFixed(3), tolMm, ok: Math.abs(medido - declarado) <= tolMm, vista });

  const bbD = shapeBBox(oc, a.dadoD);
  const bbC = shapeBBox(oc, a.r.cavityPlate);
  const bbM = shapeBBox(oc, a.r.macho);
  const bbK = shapeBBox(oc, a.r.corePlate);

  // ── EL DADO (la pieza) ──
  mide('dado', 'ancho X en la boca', 40, bbD.max[0] - bbD.min[0], 0.02, 'PLANTA (SUP)');
  mide('dado', 'fondo Y en la boca', 40, bbD.max[1] - bbD.min[1], 0.02, 'PLANTA (SUP)');
  mide('dado', 'alto Z', 40, bbD.max[2] - bbD.min[2], 0.02, 'FRENTE (FRE)');
  // pared nominal EN la partición: (exterior − hueco)/2, ambos máximos ocurren arriba
  mide('dado', 'pared nominal EN la partición', 2, ((bbD.max[0] - bbD.min[0]) - (bbM.max[0] - bbM.min[0])) / 2, 0.06, 'SECCIÓN frontal');
  // piso: la brecha entre el macho y el dado en el extremo CERRADO — con el VOLTEO el
  // piso quedó ARRIBA; max() de los dos candidatos lo hace agnóstico de orientación.
  mide('dado', 'piso', 2, Math.max(bbM.min[2] - bbD.min[2], bbD.max[2] - bbM.max[2]), 0.05, 'SECCIÓN frontal');
  // draft MEDIDO DEL SÓLIDO por rebanadas (dibujo técnico): ancho abajo vs ancho
  // arriba → ángulo. NO se usa draftAnalysis para esto: las paredes del loft son
  // superficies REGLADAS (BSpline, no 'plane') y las mandaba a 'curvas' sin medir —
  // el gate cazó ese falso PASA en su primera corrida (8≠0) y por eso está esto.
  // ⚠ LA REBANADA VA ANCLADA AL SÓLIDO, no a z absoluto. Con la pieza COLOCADA en la
  // base (§4.3.2) sube 106.5 mm: rebanar en z=0 cortaba en el VACÍO y el kernel reventaba
  // con `wasmTable.get is not a function`. Es la misma familia de bug que el resto del
  // día — coordenadas absolutas horneadas que asumen que la pieza vive en el origen.
  const rebanada = (shape: any, zBase: number, alturaMm: number) => {
    const zCorte = zBase + alturaMm;
    const tapa = occTransform(oc, occMakeBox(oc, 400, 400, 400), { translate: [-180 + bbD.min[0], -180 + bbD.min[1], zCorte] });
    return shapeBBox(oc, occCut(oc, shape, tapa));
  };
  // AGNÓSTICO de orientación (el volteo puso el extremo angosto ARRIBA): rebanada en
  // AMBOS extremos, el draft sale de |ancho_max − ancho_min| — sin asumir dónde está el pie.
  const rebanadaTecho = (shape: any, zTop: number, alturaMm: number) => {
    const piso2 = occTransform(oc, occMakeBox(oc, 400, 400, 400), { translate: [-180 + bbD.min[0], -180 + bbD.min[1], zTop - alturaMm - 400] });
    return shapeBBox(oc, occCut(oc, shape, piso2));
  };
  const draftDosExtremos = (shape: any, bb: any) => {
    const wLo = (() => { const sl = rebanada(shape, bb.min[2], 0.4); return sl.max[0] - sl.min[0]; })();
    const wHi = (() => { const sl = rebanadaTecho(shape, bb.max[2], 0.4); return sl.max[0] - sl.min[0]; })();
    return Math.atan((Math.abs(wHi - wLo) / 2) / ((bb.max[2] - bb.min[2]) - 0.4)) * 180 / Math.PI;
  };
  mide('dado', 'draft EXTERIOR medido (°)', 1.5, draftDosExtremos(a.dadoD, bbD), 0.1, 'FRENTE (rebanadas)');
  mide('dado', 'draft INTERIOR del hueco medido (°)', 1.5, draftDosExtremos(a.r.macho, bbM), 0.12, 'FRENTE (rebanadas)');
  // complementario: ninguna cara PLANA casi-vertical sin draft (las regladas ya se midieron arriba)
  const da = draftAnalysis(oc, a.dadoD, [0, 0, 1], 1.4);
  mide('dado', 'caras PLANAS sin draft (<1.4°)', 0, da.requiresDraft.length, 0, 'todas las caras');

  // ── INSERTO DE CAVIDAD = acero de COMPRA ──
  mide('inserto cavidad', 'ancho X', a.compra.ifx, bbC.max[0] - bbC.min[0], 0.02, 'PLANTA (SUP)');
  mide('inserto cavidad', 'fondo Y', a.compra.ify, bbC.max[1] - bbC.min[1], 0.02, 'PLANTA (SUP)');
  mide('inserto cavidad', 'alto = Hc de compra', a.compra.Hc, bbC.max[2] - bbC.min[2], 0.02, 'FRENTE (FRE)');
  // con el VOLTEO la cavidad vive ARRIBA (lado A): su cara INFERIOR toca la partición
  mide('inserto cavidad', 'cara INFERIOR en la partición (lado A)', a.zPart, bbC.min[2], 0.02, 'FRENTE (FRE)');

  // ── NÚCLEO ──
  // el respaldo del macho quedó BAJO la partición (lado B) tras el volteo
  mide('núcleo (respaldo)', 'espesor de placa = Hk de compra', a.compra.Hk, a.zPart - bbK.min[2], 0.02, 'FRENTE (FRE)');
  // el macho SUBE hasta 2 mm bajo la base cerrada (que ahora es el TECHO de la pieza)
  mide('núcleo (macho)', 'sube hasta el piso (2 mm bajo la base cerrada)', bbD.max[2] - 2, bbM.max[2], 0.05, 'SECCIÓN frontal');
  mide('núcleo (macho)', 'ancho del hueco en la boca', 36, bbM.max[0] - bbM.min[0], 0.06, 'PLANTA (SUP)');

  // ── INVARIANTES DEL CONJUNTO ──
  mide('conjunto', 'cuerpos del molde (cavity + macho)', 2, a.r.bodies, 0, 'booleana');
  const vBloque = a.compra.ifx * a.compra.ify * a.compra.Hc;
  const vSuma = a.r.vols.cavity + a.r.vols.macho + a.r.vols.piezaEscalada;
  mide('conjunto', 'Σ cavidad+macho+pieza = bloque (%)', 100, 100 * vSuma / vBloque, 0.5, 'volumen (divergencia)');

  const malas = M.filter((m) => !m.ok);
  return {
    medidas: M, ok: malas.length === 0,
    resumen: malas.length === 0
      ? `${M.length}/${M.length} medidas CUADRAN (declarado ≈ medido del B-Rep)`
      : `✗ ${malas.length}/${M.length} medidas NO cuadran: ${malas.map((m) => `${m.componente}·${m.cota} (${m.declarado}≠${m.medido})`).join(' · ')}`,
  };
}

/**
 * COTAS 3D DE LA ESTACIÓN 3 — "yo quiero las dimensiones VISUALES en el 3D, no
 * quiero entrar al plano para ver el tamaño de mis cotas" (ian). Cada medida
 * geométrica de verificacionE3 se vuelve una Dim3D con sus extremos EN LA ESCENA
 * (líneas de extensión fuera del sólido, como manda el dibujo técnico) y viaja
 * por la MISMA tubería del 📐 del CAD: CotaLines + CotaLabels, doble cifra,
 * ROJO si no cuadra. liftNucleo = el desplazamiento con que la escena muestra
 * el núcleo abierto (la cota apunta a lo que VES).
 */
export function cotasCicloE3(v: VerificacionE3, a: AceroE3, liftNucleo: number): Array<{ role: string; dims: import('./mold-dimensions').Dim3D[] }> {
  const M = new Map(v.medidas.map((m) => [m.componente + '·' + m.cota, m]));
  const dim = (
    key: string, label: string, pa: [number, number, number], pb: [number, number, number],
    critical = false,
  ): import('./mold-dimensions').Dim3D | null => {
    const m = M.get(key);
    if (!m) return null;
    return {
      id: 'e3-' + key.replace(/[^a-z0-9]+/gi, '-'), label,
      kind: 'lineal', a: pa, b: pb,
      value: m.declarado, measured: m.medido, ok: m.ok,
      why: m.vista, critical,
    };
  };
  const zP = a.zPart, L = liftNucleo;
  // ⚠ LOS ANCLAJES VIAJAN CON LA PIEZA — ahora por el MAPA DEL VOLTEO (rotación 180°X +
  // colocación, Fig 7.2): P() manda el punto local por `aGlobal`. Los anclajes del acero
  // que ya trabajan en z global (zP) solo voltean su XY. La cavidad quedó ARRIBA de la
  // partición y el respaldo ABAJO — sus cotas cambian de lado con la pieza.
  const g = a.colocacion?.aGlobal ?? ((x: number, y: number, z: number): [number, number, number] => [x, y, z]);
  const P = (x: number, y: number, z: number): [number, number, number] => g(x, y, z);
  const PXY = (x: number, y: number, z: number): [number, number, number] => { const q = g(x, y, 0); return [q[0], q[1], z]; };
  const dims = [
    // ── la pieza (anclajes locales; el mapa los voltea con ella) ──
    dim('dado·ancho X en la boca', 'boca X', P(0, -12, 40), P(40, -12, 40), true),
    dim('dado·fondo Y en la boca', 'boca Y', P(-12, 0, 40), P(-12, 40, 40)),
    dim('dado·alto Z', 'alto', P(46, -6, 0), P(46, -6, 40)),
    dim('dado·pared nominal EN la partición', 'pared', P(0, 20, 42.5), P(2.01, 20, 42.5), true),
    dim('dado·piso', 'piso', P(43, 20, 0), P(43, 20, 2)),
    // el draft como línea INCLINADA siguiendo la pared (se VE la conicidad)
    dim('dado·draft EXTERIOR medido (°)', 'draft', P(40 * 0.0262, -6, 0), P(0, -6, 40)),
    // ── el acero (z global: cavidad ARRIBA de zP, respaldo ABAJO) ──
    dim('inserto cavidad·ancho X', 'cavidad X', P(-40, -52, 60.5), P(80, -52, 60.5)),
    dim('inserto cavidad·alto = Hc de compra', 'Hc compra', PXY(88, -40, zP), PXY(88, -40, zP + a.compra.Hc), true),
    dim('inserto cavidad·cara INFERIOR en la partición (lado A)', 'partición', PXY(84, -46, zP), PXY(84, 86, zP)),
    dim('núcleo (respaldo)·espesor de placa = Hk de compra', 'Hk compra', PXY(88, 80, zP - L - a.compra.Hk), PXY(88, 80, zP - L), true),
    dim('núcleo (macho)·sube hasta el piso (2 mm bajo la base cerrada)', 'macho', PXY(43, 80, zP - L), PXY(43, 80, zP - L + 37.5)),
    dim('núcleo (macho)·ancho del hueco en la boca', 'hueco', PXY(2.01, 52, zP - L), PXY(37.99, 52, zP - L)),
  ].filter((d): d is import('./mold-dimensions').Dim3D => !!d);
  return [{ role: 'ciclo-e3', dims }];
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA PRUEBA DEL RAYO — ¿la pieza SALE? (orden 2026-08-11-ciclo-dado-el-rayo)  */
/* ══════════════════════════════════════════════════════════════════════════ */
/**
 * El teorema que decide si un molde de 2 placas SIRVE. Las 17 cotas prueban que
 * el acero tiene el TAMAÑO correcto; ninguna prueba que la pieza SALGA.
 *
 * Formulación (la honesta, sobre las MITADES reales, no sobre la pieza):
 * una mitad se retira en su dirección `d`. Sus caras moldeantes son las que MIRAN
 * a `d` (n·d > 0). Cada una de ésas tiene que ser VISIBLE desde `d` — si su propia
 * mitad la tapa, hay material por delante en el camino de salida: ES UN UNDERCUT y
 * la mitad no se puede retirar. Eso es exactamente lo que mide el z-buffer
 * ortográfico de `visibilidad.ts` (con oclusión real, no solo el ángulo de la cara).
 *
 * `atrapados = 0` ES el teorema. El reparto por triángulo es el MAPA de color.
 */
// 0 = mira a la salida y NADA la tapa (libre) · 1 = pared vertical (roza, no traba)
// 2 = ATRAPADA: mira a la salida y su propia mitad la TAPA → undercut
// 3 = NO mira a la salida: se libera por deslizamiento/draft (el caso sano del cono)
export type ClaseRayo = 0 | 1 | 2 | 3;
export interface RayoMitad {
  nombre: string; sube: boolean;
  nTri: number; nSalen: number; nVerticales: number; nAtrapados: number;
  areaSaleMm2: number; areaAtrapadaMm2: number;
  clase: Uint8Array;
}
export interface PruebaRayo {
  mitades: RayoMitad[];
  atrapados: number;
  veredicto: 'SALE' | 'NO SALE';
  resumen: string;
}

export function pruebaDelRayo(
  mitades: Array<{ nombre: string; malla: { positions: Float32Array | number[]; indices: Uint32Array | number[] }; sube: boolean }>,
  o?: { res?: number; senoVertical?: number },
): PruebaRayo {
  const senoV = o?.senoVertical ?? Math.sin(0.5 * Math.PI / 180);   // <0.5° = pared vertical (roza, no traba)
  const out: RayoMitad[] = [];
  for (const m of mitades) {
    const d: [number, number, number] = m.sube ? [0, 0, 1] : [0, 0, -1];
    // el observador se para EN la dirección de salida y mira hacia la pieza (w = −d):
    // el motor conserva las caras con n·w < 0, o sea justo las que miran a `d`.
    const vis = clasificarVisibilidad(m.malla, {
      vistas: [{ nombre: m.nombre, dir: [-d[0], -d[1], -d[2]] }],
      res: o?.res ?? 384,
    });
    const P = m.malla.positions, I = m.malla.indices;
    const nTri = Math.floor(I.length / 3);
    const clase = new Uint8Array(nTri);
    let nSalen = 0, nVert = 0, nAtr = 0, aSale = 0, aAtr = 0;
    for (let t = 0; t < nTri; t++) {
      const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
      const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const L = Math.hypot(nx, ny, nz);
      if (L < 1e-12) { clase[t] = 1; nVert++; continue; }
      const dot = (nx * d[0] + ny * d[1] + nz * d[2]) / L;      // cos con la salida
      const area = vis.areaTri[t];
      if (Math.abs(dot) <= senoV) { clase[t] = 1; nVert++; continue; }   // pared vertical: roza, no traba
      // dot < 0: la cara se ALEJA de su contacto al retirarse — se libera por draft.
      // (Es el caso SANO del cono: comprobado con el control negativo, al invertir el
      //  draft estas mismas caras cruzan a dot > 0 y el z-buffer las caza ocluidas.)
      if (dot < 0) { clase[t] = 3; continue; }
      if (vis.fracMaxTri[t] > 0.5) { clase[t] = 0; nSalen++; aSale += area; }
      else { clase[t] = 2; nAtr++; aAtr += area; }                        // OCLUIDA en su ruta de salida
    }
    out.push({ nombre: m.nombre, sube: m.sube, nTri, nSalen, nVerticales: nVert, nAtrapados: nAtr, areaSaleMm2: +aSale.toFixed(1), areaAtrapadaMm2: +aAtr.toFixed(1), clase });
  }
  const atrapados = out.reduce((s, m) => s + m.nAtrapados, 0);
  return {
    mitades: out, atrapados,
    veredicto: atrapados === 0 ? 'SALE' : 'NO SALE',
    resumen: atrapados === 0
      ? `LA PIEZA SALE: ${out.map((m) => `${m.nombre} ${m.nSalen} caras libres`).join(' · ')} · 0 atrapadas`
      : `✗ NO SALE: ${out.filter((m) => m.nAtrapados).map((m) => `${m.nombre} tiene ${m.nAtrapados} caras ATRAPADAS (${m.areaAtrapadaMm2} mm²)`).join(' · ')} — undercut: esa mitad no se puede retirar`,
  };
}

/** El dado con draft INVERTIDO (más ancho ABAJO) — CONTROL NEGATIVO del rayo:
 *  un molde así NO puede abrir, y si la prueba no lo caza, la prueba no sirve
 *  (la regla del render corrupto aplicada a la geometría). */
export function dadoUndercutShape(oc: any) {
  const t15 = Math.tan(1.5 * Math.PI / 180);
  const R = (a: number, b: number) => [{ x: a, y: a }, { x: b, y: a }, { x: b, y: b }, { x: a, y: b }];
  const pl = (z: number) => ({ origin: [0, 0, z] as [number, number, number], uDir: [1, 0, 0] as [number, number, number], vDir: [0, 1, 0] as [number, number, number] });
  const outer = occLoft(oc, [
    { pts: R(0, 40), plane: pl(0) },                       // ANCHO abajo  ← al revés
    { pts: R(40 * t15, 40 - 40 * t15), plane: pl(40) },    // angosto arriba
  ], { solid: true, ruled: true });
  const inner = occLoft(oc, [
    { pts: R(2 - t15, 38 + t15), plane: pl(2) },
    { pts: R(2 + 38 * t15, 38 - 38 * t15), plane: pl(41) },
  ], { solid: true, ruled: true });
  return occCut(oc, outer, inner);
}

/** cavidad ∩ núcleo = ∅ — la booleana hermana del rayo: los dos aceros no se comen. */
export function interseccionMitades(oc: any, a: any, b: any): { volMm3: number; ok: boolean } {
  try {
    const v = occVolume(oc, occCommon(oc, a, b));
    return { volMm3: +v.toFixed(4), ok: Math.abs(v) < 1 };
  } catch { return { volMm3: NaN, ok: false }; }
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* EL CICLO DEL DADO — estación 4: LLENADO (cap 5)                            */
/* (orden 2026-08-11-ciclo-dado-estacion4)                                    */
/* ══════════════════════════════════════════════════════════════════════════ */
export interface FilaLlenado {
  id: string; titulo: string; valor: string; limite: string;
  estado: 'CUMPLE' | 'ADVIERTE' | 'VIOLA'; seccion: string; porque: string;
}
export interface AnuncioRetorno {
  estacion: number; titulo: string; detalle: string; seccion: string;
}
export interface Estacion4Dado {
  /** el LAZO del libro (A-088): la velocidad se resuelve ITERANDO, y aquí se ve iterar */
  escalera: number[]; convergio: boolean; vueltas: number; vMs: number;
  filas: FilaLlenado[];
  /** A-104: dónde muere el aire — el dato que la estación 7 (venteo) va a consumir */
  ultimaZona: { x: number; y: number; z: number; tS: number } | null;
  flujoMm: number; ltRatio: number;
  /** lo que el dado YA delata y NO se arregla aquí: el grafo con retornos (§1.5 Fig 1.9) */
  anuncios: AnuncioRetorno[];
}

/**
 * El llenado del dado, del pkg que YA corre. Nada de motor nuevo: el cap 5 entero
 * vive en `pkg.diseno` (velocidad con su escalera, presiones, gate, alimentación).
 * Esta estación lo VE y lo juzga — y anuncia los defectos que pertenecen a estaciones
 * posteriores en vez de callarlos o de arreglarlos fuera de su turno.
 */
export function estacion4Dado(pkg: MoldPackage, flujoMm: number, wallMm = 2): Estacion4Dado {
  const d: any = pkg.diseno;
  const v = d.velocidad, g = d.gate, al = d.alimentacion;
  const lt = flujoMm / wallMm;
  const f: FilaLlenado[] = [];
  const fila = (id: string, titulo: string, valor: string, limite: string, estado: FilaLlenado['estado'], seccion: string, porque: string) =>
    f.push({ id, titulo, valor, limite, estado, seccion, porque });

  fila('vel', 'velocidad de llenado (lazo cerrado)', `${v.vMs.toFixed(3)} m/s en ${v.vueltas} vueltas`,
    v.convergio ? 'converge' : 'NO converge', v.convergio ? 'CUMPLE' : 'VIOLA', '§5.4 · A-088',
    'la velocidad no se elige: se RESUELVE iterando (la viscosidad depende del corte y el corte de la velocidad). La escalera de arriba es esa iteración.');
  // §5.5: banda de velocidad lineal típica del libro
  const enBanda = v.vMs >= 0.1 && v.vMs <= 1.0;
  fila('banda', 'banda de velocidad lineal', `${v.vMs.toFixed(3)} m/s`, '0.1 – 1.0 m/s',
    enBanda ? 'CUMPLE' : 'ADVIERTE', '§5.5 · A-090',
    'fuera de la banda: muy lento congela el frente, muy rápido quema por corte.');
  fila('pfill', 'presión de llenado', `${d.fillMPa} MPa`, 'la máquina da ~140 MPa',
    d.fillMPa < 100 ? 'CUMPLE' : 'ADVIERTE', '§5.4 · A-093', 'ΔP que exige empujar el fundido hasta el último rincón.');
  // §5.1/§6.5.1: una ΔP demasiado BAJA también reprueba (anti-sobrediseño)
  fila('pcav', 'presión media de cavidad', `${d.cavityMPa} MPa`, 'ni tan alta que abra el molde ni tan baja que no empaque',
    d.cavityMPa >= 2 && d.cavityMPa <= 60 ? 'CUMPLE' : 'ADVIERTE', '§5.5.3 · A-094',
    'el libro reprueba por los DOS lados: demasiado baja delata sobrediseño (§5.1).');
  fila('lt', 'longitud de flujo / pared (L/T)', `${flujoMm.toFixed(0)} / ${wallMm} = ${lt.toFixed(0)}`,
    'ABS aguanta ~150', lt <= 150 ? 'CUMPLE' : 'VIOLA', '§5.5 · A-102',
    'si L/T excede lo que el material aguanta, el frente se congela antes de llegar: short shot.');

  // ── los RETORNOS anunciados: defectos REALES del dado que son de otras estaciones ──
  const anuncios: AnuncioRetorno[] = [];
  if (g?.freezeCorto) anuncios.push({
    estacion: 6, titulo: 'la compuerta CONGELA antes de terminar de empacar',
    detalle: `congela a ${g.freezeS.toFixed(2)} s y el empaque necesita ${g.tPackNeededS.toFixed(2)} s — se cierra la puerta con la casa a medio llenar${g.agrandable ? ' (la compuerta es AGRANDABLE: steel-safe, crece en tryout)' : ''}`,
    seccion: '§7.1.5 · A-149',
  });
  if (al && al.dPMPa > al.limDPMPa) anuncios.push({
    estacion: 5, titulo: 'el bebedero se come el presupuesto de presión',
    detalle: `${al.dPMPa.toFixed(2)} MPa contra un presupuesto de ${al.limDPMPa.toFixed(2)} — un sprue de ${al.sprueLenMm.toFixed(0)} mm para una pieza de 40 mm: la colada domina a la pieza`,
    seccion: '§6.4 · A-111',
  });
  if (al && al.pctRegrind > (al.limPct ?? 30)) anuncios.push({
    estacion: 5, titulo: 'demasiado material se va en la colada',
    detalle: `${al.pctRegrind.toFixed(1)} % del disparo es colada (límite ${al.limPct}) — regrind y costo por pieza`,
    seccion: '§6.2.3 · A-121',
  });

  return {
    escalera: (v.escalera ?? []).map((x: number) => +x.toFixed(4)),
    convergio: !!v.convergio, vueltas: v.vueltas, vMs: +v.vMs.toFixed(4),
    filas: f, ultimaZona: null, flujoMm: +flujoMm.toFixed(1), ltRatio: +lt.toFixed(1),
    anuncios,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LLENADO NIVEL 1 — el frente por RESISTENCIA, no por distancia               */
/* (orden 2026-08-11-llenado-nivel1-crosswlf)                                  */
/* ══════════════════════════════════════════════════════════════════════════ */
/**
 * ian frenó la versión anterior: "el llenado debe de ser un análisis de fluidos y
 * presiones". Tenía razón, y peor: `flowlen.ts` ADVIERTE por escrito que
 * `flowLenMm` es distancia y que el orden real de llenado es `resistance` (∝ ΔP,
 * Eq 5.22) — y yo usé la distancia igual.
 *
 * Aquí el frente sale de la RESISTENCIA. Con eso el race-tracking EMERGE solo: una
 * pared gruesa conduce mejor (S ∝ H³) y se llena antes aunque esté más lejos, que es
 * exactamente el fenómeno de §5.5.4 y el remedio de §5.5.5.
 *
 * Y el frente se reporta en BANDAS ISÓCRONAS NUMERADAS, como el libro lo DIBUJA
 * (Fig 5.1: contornos 1…11 · Fig 5.17: arcos 1…10 con weld line y gas trap
 * rotulados). Un degradado continuo esconde el race-tracking; las bandas lo enseñan.
 */
export interface BandaIsocrona {
  n: number;                 // 1, 2, 3… como los arcos del libro
  tS: number;                // instante en que el frente llega a esta banda
  nVox: number;              // vóxeles que se llenan en este paso
  volMm3: number;
}
export interface LlenadoNivel1 {
  gate: { x: number; y: number; z: number };
  vMs: number; muPaS: number;
  /** el frente por RESISTENCIA (0..1 normalizado) — el orden REAL de llenado */
  frente: Float32Array;
  bandas: BandaIsocrona[];
  tLlenadoS: number;
  maxFlowLenMm: number;
  /** la última zona: dónde muere el aire (§5.5.4) → el dato del cap 8 */
  ultimaZona: { x: number; y: number; z: number; tS: number } | null;
  /** ¿el flujo corre por el perímetro y llega tarde al centro? (§5.5.4) */
  raceTracking: { hay: boolean; detalle: string };
  gasTrap: { hay: boolean; detalle: string };
  weldLines: number;
  /** ΔP por SEGMENTO del lay-flat (§5.5.2) — el método a mano del libro */
  layflat: Array<{ tramo: string; Lmm: number; Hmm: number; dPMPa: number }>;
  dPCavidadMPa: number;
  /** lo que el cap 5 NO incluye y el libro obliga a declarar (§5.5.2 literal) */
  nota: string;
  avisos: string[];
}

export function llenadoNivel1(campo: any, o: {
  vMs: number; muPaS: number; wallMm: number; nBandas?: number;
  material: import('./filling').MeltMaterial;
}): LlenadoNivel1 {
  const N = campo.resistance.length as number;
  const nB = o.nBandas ?? 10;
  // normalizar la RESISTENCIA (no la distancia): éste es el orden de llenado
  let rMax = 0;
  for (let i = 0; i < N; i++) { const r = campo.resistance[i]; if (Number.isFinite(r) && r > rMax) rMax = r; }
  const frente = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const r = campo.resistance[i];
    frente[i] = campo.cavity[i] && Number.isFinite(r) ? (rMax > 0 ? r / rMax : 0) : -1;
  }
  // tiempo de llenado: L/v (el frente avanza a v lineal, §5.5.1)
  const tTot = campo.maxFlowLenMm / 1000 / Math.max(1e-6, o.vMs);
  const vCel = Math.pow(campo.cellMm, 3);
  const bandas: BandaIsocrona[] = [];
  for (let b = 0; b < nB; b++) {
    const lo = b / nB, hi = (b + 1) / nB;
    let n = 0;
    for (let i = 0; i < N; i++) if (frente[i] >= lo && frente[i] < hi) n++;
    bandas.push({ n: b + 1, tS: +(tTot * hi).toFixed(3), nVox: n, volMm3: +(n * vCel).toFixed(0) });
  }
  // la ÚLTIMA zona = el vóxel de MAYOR resistencia (no el más lejano)
  let iUlt = -1, rUlt = -1;
  for (let i = 0; i < N; i++) if (campo.cavity[i] && Number.isFinite(campo.resistance[i]) && campo.resistance[i] > rUlt) { rUlt = campo.resistance[i]; iUlt = i; }
  const nx = campo.nx, ny = campo.ny;
  const ultimaZona = iUlt < 0 ? null : {
    x: +(campo.x0 + ((iUlt % nx) + 0.5) * campo.cellMm).toFixed(1),
    y: +(campo.y0 + ((Math.floor(iUlt / nx) % ny) + 0.5) * campo.cellMm).toFixed(1),
    z: +(campo.z0 + (Math.floor(iUlt / (nx * ny)) + 0.5) * campo.cellMm).toFixed(1),
    tS: +tTot.toFixed(3),
  };
  // RACE TRACKING (§5.5.4): la última zona por RESISTENCIA no coincide con la más
  // LEJANA por distancia ⇒ el fundido corrió por otro lado. Ése es el fenómeno.
  let iLejos = -1, dLejos = -1;
  for (let i = 0; i < N; i++) if (campo.cavity[i] && Number.isFinite(campo.flowLenMm[i]) && campo.flowLenMm[i] > dLejos) { dLejos = campo.flowLenMm[i]; iLejos = i; }
  const hayRace = iUlt >= 0 && iLejos >= 0 && iUlt !== iLejos;
  const sep = hayRace ? Math.hypot(
    ((iUlt % nx) - (iLejos % nx)) * campo.cellMm,
    ((Math.floor(iUlt / nx) % ny) - (Math.floor(iLejos / nx) % ny)) * campo.cellMm,
    (Math.floor(iUlt / (nx * ny)) - Math.floor(iLejos / (nx * ny))) * campo.cellMm) : 0;
  return {
    gate: { x: +(campo.x0 + (campo.gate.i + 0.5) * campo.cellMm).toFixed(1), y: +(campo.y0 + (campo.gate.j + 0.5) * campo.cellMm).toFixed(1), z: +(campo.z0 + (campo.gate.k + 0.5) * campo.cellMm).toFixed(1) },
    vMs: +o.vMs.toFixed(4), muPaS: +o.muPaS.toFixed(1),
    frente, bandas, tLlenadoS: +tTot.toFixed(3), maxFlowLenMm: +campo.maxFlowLenMm.toFixed(1),
    ultimaZona,
    raceTracking: {
      hay: hayRace && sep > 3 * campo.cellMm,
      detalle: hayRace && sep > 3 * campo.cellMm
        ? `el último punto por RESISTENCIA está a ${sep.toFixed(0)} mm del más lejano por distancia: el fundido corre por donde gasta menos presión, no por el camino corto (§5.5.4)`
        : 'sin race-tracking: la resistencia y la distancia coinciden (pared uniforme, camino único)',
    },
    gasTrap: {
      hay: campo.unreachable > 0,
      detalle: campo.unreachable > 0
        ? `${campo.unreachable} vóxeles NO se llenan: aire atrapado — §5.5.4 avisa que un gas trap en pared "is difficult to vent" y quema la pieza`
        : 'sin zonas inalcanzables',
    },
    weldLines: 0,
    layflat: [], dPCavidadMPa: 0,
    nota: 'la presión del cap 5 es DE CAVIDAD: §5.5.2 literal — "does not include the pressure drop through the feed system". El bebedero y la colada son el cap 6 (estación 5), y el total se cierra allá.',
    avisos: campo.warnings ?? [],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ESTACIÓN 5 — ALIMENTACIÓN (Kazmer cap 6)
// ═══════════════════════════════════════════════════════════════════════════
//
// ian: "se sigue viendo raro el sprue". La conicidad estaba bien (medida: ⌀9.43 en la
// partición → ⌀5.08 en la boquilla). Lo que estaba mal era el SISTEMA:
//   · la alimentación terminaba en su punto MÁS ANCHO justo donde tocaba la pieza
//     (⌀9.5 entrando a una pared de 2 mm), sin runner ni compuerta;
//   · y los radios estaban HARDCODEADOS en el ciclo, cuando `designSprueFeed` —que el
//     resto de la app YA consume— los calcula desde el orificio de la boquilla.
//
// ESTA ESTACIÓN NO INVENTA NINGUNA FÓRMULA. Todo sale de `feed.ts` y `gating.ts`, que
// ya estaban escritos y verificados. Aquí sólo se ENSAMBLA la ruta completa
// boquilla → bebedero → runner → compuerta → pieza, y se MIDE que estreche.
//
// El dado es una caja ABIERTA en la partición: un bebedero centrado caería en la BOCA,
// donde no hay plástico. Por eso el bebedero aterriza A UN COSTADO sobre el plano de
// partición y llega al labio por un runner + compuerta de canto — que es lo que el
// cap 6 dibuja para una caja gateada en el labio.

export interface Estacion5Dado {
  sprue: ReturnType<typeof designSprueFeed>;
  runner: { diaCrudoMm: number; diaMm: number; largoMm: number; dPMPa: number; tcS: number; volCc: number };
  gate: { tipo: string; espesorMm: number; anchoMm: number; shear: number; ok: boolean; report: string; dPMPa: number };
  /** EL criterio que hace que deje de verse "al revés": la alimentación ESTRECHA */
  estrecha: { sprueBaseMm: number; runnerMm: number; gateMm: number; ok: boolean };
  presion: { cavidadMPa: number; alimentacionMPa: number; totalMPa: number; maquinaMPa: number; ok: boolean };
  /** §6.2.3 — la acusación que la E4 ya había hecho, reproducida y resuelta (o declarada) */
  regrind: { antesCc: number; antesPct: number; despuesCc: number; despuesPct: number; limPct: number; largoAntesMm: number; largoDespuesMm: number; resuelto: boolean };
  /** geometría que el CAD debe construir — la MISMA fuente que los números */
  geom: {
    xSprue: number; ySprue: number; zParting: number; sprueLenMm: number;
    rTopMm: number; rBaseMm: number; runnerDiaMm: number; runnerLargoMm: number;
    pozoLargoMm: number; gateEspesorMm: number; gateAnchoMm: number; gateLargoMm: number;
    xPiezaMax: number; yPieza: number;
  };
  filas: FilaLlenado[];
  anuncios: AnuncioRetorno[];
}

/**
 * @param partVolCc  volumen MEDIDO de la pieza (de los vóxeles de la E4), no estimado
 * @param cavidadMPa ΔP de CAVIDAD de la E4 (lay-flat §5.5.2, que a propósito NO incluye
 *                   la alimentación: "does not include the pressure drop through the
 *                   feed system"). Aquí se cierra la cuenta.
 */
export function estacion5Dado(o: {
  /** LOS DATUMS mandan: la estación ya NO inventa cotas (era `L=60` y
   *  `xSprue = lado + rBase + 6`). Vienen de `colada.ts::datumsColada`, que los saca del
   *  stack de placas y de la Fig 6.4. */
  datums: DatumsColada;
  partVolCc: number; wallMm: number; cavidadMPa: number;
  maquinaMPa?: number; fillTimeS?: number;
}): Estacion5Dado {
  const m = FEED_MATERIALS.ABS;
  const mm = m as unknown as MeltMaterial;
  const d = o.datums, wall = o.wallMm;
  const maquinaMPa = o.maquinaMPa ?? 140;
  const tFill = o.fillTimeS ?? 1;

  // el ANÁLISIS del bebedero corre sobre el largo REAL del stack (§6.3.1), no sobre 60
  const sprue = designSprueFeed({
    material: 'ABS', partVolumeCc: o.partVolCc, partWallMm: wall,
    sprueLenMm: Math.max(1, d.LsprueMm), fillTimeS: tFill,
  });
  const VdotM3s = sprue.VdotCcS * 1e-6;

  // RUNNER y COMPUERTA: los ⌀ vienen del generador; aquí solo se evalúan
  const runnerDiaMm = d.runnerDiaMm, runnerLargoMm = d.LrunnerMm;
  // ⚠ con SPRUE DIRECTO (runner ⌀0) estas fórmulas dividen por R=0 → NaN, y `10.7 + NaN
  // = NaN` PASABA de largo hasta la cuenta de presión (la familia NaN documentada:
  // `NaN ?? x` = NaN). Se calculan SOLO si hay runner; si no, cero es la verdad §7.2.1.
  const hayRunner = runnerLargoMm > 0 && runnerDiaMm > 0;
  const segRunner: RunnerSegment = { name: 'runner', L: Math.max(1e-4, runnerLargoMm) / 1000, R: Math.max(0.1, runnerDiaMm) / 2000, Vdot: VdotM3s };
  const dPRunnerMPa = hayRunner ? pressureDropRunner(mm, segRunner) / 1e6 : 0;
  const tcRunnerS = hayRunner ? runnerCoolingTimeS(m.alpha, runnerDiaMm / 1000, m.tMelt, m.tCool, m.tEject) : 0;
  const volRunnerCc = hayRunner ? Math.PI * (runnerDiaMm / 2) ** 2 * runnerLargoMm / 1000 : 0;
  const g = gateDesign({ type: 'edge', wallMm: wall, VdotM3s, shearMaxS: m.shearMax });
  const gateFreezeS = gateFreezeStripS(m.alpha, d.gateEspesorMm / 1000, m.tMelt, m.tCool, m.tNoFlow);
  const runnerFreezeS = gateFreezeCylS(m.alpha, runnerDiaMm / 1000, m.tMelt, m.tCool, m.tNoFlow);
  const dPGateMPa = hayRunner ? gateDropStripPL(mm, d.gateLargoMm / 1000, d.gateAnchoMm / 1000, d.gateEspesorMm / 1000, VdotM3s) / 1e6 : 0;

  const estrecha = {
    sprueBaseMm: 2 * d.rBaseMm, runnerMm: runnerDiaMm, gateMm: d.gateEspesorMm,
    ok: 2 * d.rBaseMm > runnerDiaMm && runnerDiaMm > d.gateEspesorMm,
  };

  // REGRIND (Eq 6.6 · §6.2.3). El largo del bebedero NO se acorta a capricho: sale del
  // stack de placas. Si el regrind viola, la decisión es de la ESTACIÓN 3 (placas más
  // delgadas o base más chica) — se ANUNCIA el retorno, no se falsea la cota.
  const volPozoCc = hayRunner ? Math.PI * (runnerDiaMm / 2) ** 2 * d.pozoLargoMm / 1000 : 0;
  const coladaCc = sprue.volCc + volRunnerCc + volPozoCc;
  const pct = (coladaCc / o.partVolCc) * 100;
  const limPct = 30;
  const resuelto = pct <= limPct;

  const alimentacionMPa = sprue.dPMPa + dPRunnerMPa + dPGateMPa;
  const totalMPa = o.cavidadMPa + alimentacionMPa;

  const filas: FilaLlenado[] = [];
  const fila = (id: string, titulo: string, valor: string, limite: string, estado: FilaLlenado['estado'], seccion: string, porque: string) =>
    filas.push({ id, titulo, valor, limite, estado, seccion, porque });

  fila('sprue-dia', 'bebedero ⌀ boquilla → partición', `${(2 * d.rTopMm).toFixed(2)} → ${(2 * d.rBaseMm).toFixed(2)} mm`,
    'angosto arriba, ancho abajo', d.rBaseMm > d.rTopMm ? 'CUMPLE' : 'VIOLA', '§6.3.1',
    'la entrada es el orificio de la boquilla + holgura (que la rebaba quede en la boquilla) y el cono abre hacia la partición para que la colada SALGA al abrir. Estos números ya NO están a mano: salen de designSprueFeed.');
  if (runnerLargoMm > 0) fila('estrecha', 'la alimentación ESTRECHA hacia la pieza', `⌀${estrecha.sprueBaseMm.toFixed(1)} → ⌀${estrecha.runnerMm} → ${estrecha.gateMm} mm`,
    'bebedero > runner > compuerta', estrecha.ok ? 'CUMPLE' : 'VIOLA', '§6.3 · §7.3.1',
    'esto es lo que se veía "al revés": la colada terminaba en su punto MÁS ANCHO justo donde tocaba una pared de 2 mm. La sección debe caer monótona hasta la compuerta.');
  if (runnerLargoMm > 0) fila('runner-dia', '⌀ del runner (del generador)', `⌀${runnerDiaMm} mm · L ${runnerLargoMm.toFixed(1)} mm`,
    'fresa estándar §6.5.4', STANDARD_RUNNER_DIAMM.includes(runnerDiaMm) ? 'CUMPLE' : 'VIOLA', '§6.5.4 · §6.5.5 · §7.1.5',
    'el steel-safe (§6.5.5) redondea HACIA ABAJO —quitar acero en el tryout es fácil, ponerlo no— y por presión bastaba ⌀2. Pero ⌀2 es el MISMO espesor de la compuerta: ni estrecha ni deja que la puerta selle primero. Manda el criterio funcional, y el ⌀ elegido sigue siendo de fresa estándar.');
  if (runnerLargoMm > 0) fila('freeze', 'la COMPUERTA congela antes que el runner', `${gateFreezeS.toFixed(2)} s vs ${runnerFreezeS.toFixed(2)} s`,
    'compuerta < runner', gateFreezeS < runnerFreezeS ? 'CUMPLE' : 'VIOLA', '§7.1.5 · Tabla 7.4',
    'si el runner sella primero, la puerta se queda abierta con la casa a medio empacar. Este criterio —no el ΔP— es el que fija el ⌀ del runner: con sólo presión salía ⌀2, igualito al espesor de la compuerta, y la sección dejaba de bajar.');
  if (runnerLargoMm > 0) fila('gate-shear', 'corte en la compuerta', `${Math.round(g.shear).toLocaleString()} 1/s`,
    `máx ${m.shearMax.toLocaleString()} (Apéndice A)`, g.ok ? 'CUMPLE' : 'VIOLA', '§7.3.2 · Tabla 7.2',
    'pasarse de corte en la compuerta quema el material y deja marcas; el remedio es agrandarla (la de canto SÍ es agrandable, §7.3.5).');
  if (runnerLargoMm <= 0) fila('directo', 'SPRUE DIRECTO (§7.2.1): el gate es la interfaz', `⌀${(2 * d.rBaseMm).toFixed(1)} mm sobre la base · freeze ${sprue.freezeGateS.toFixed(1)} s`,
    '"it has no length, there is no pressure drop"', 'CUMPLE', '§7.2.1 · Fig 7.2',
    'el bushing aterriza DIRECTO en la base cerrada de la pieza: sin runner, sin compuerta tallada, sin pozo. El freeze del propio bebedero fija el tiempo de empaque; el des-gateo deja vestigio en la base (remedios: rim Fig 7.2 / pozo rebajado Fig 7.3).');
  fila('ptotal', 'presión TOTAL (cavidad + alimentación)', `${o.cavidadMPa.toFixed(1)} + ${alimentacionMPa.toFixed(1)} = ${totalMPa.toFixed(1)} MPa`,
    `la máquina da ~${maquinaMPa} MPa`, totalMPa <= maquinaMPa ? 'CUMPLE' : 'VIOLA', '§6.4 · §5.5.2',
    'la E4 dio SOLO la cavidad a propósito (§5.5.2 literal: "does not include the pressure drop through the feed system"). Ésta es la cuenta cerrada, que es la que la inyectora tiene que pagar.');
  fila('regrind', 'colada vs pieza (regrind)', `${coladaCc.toFixed(1)} cc = ${pct.toFixed(1)} %`,
    `≤ ${limPct} %`, resuelto ? 'CUMPLE' : 'VIOLA', '§6.2.3 · Eq 6.6',
    `el bebedero mide ${d.LsprueMm.toFixed(1)} mm porque eso da el STACK (§6.3.1), no porque yo lo eligiera. ${resuelto ? 'Cumple.' : 'NO cumple: acortarlo es decisión de la ESTACIÓN 3 (placas), y por eso se anuncia el retorno en vez de falsear la cota.'}`);
  const tcColadaS = hayRunner ? tcRunnerS : sprue.tcSprueS;
  fila('tc-runner', `t_c ${hayRunner ? 'del runner' : 'del BEBEDERO'} vs el de la pieza`, `${tcColadaS.toFixed(1)} s vs ${sprue.tcPartS.toFixed(1)} s`,
    'la colada no debe mandar el ciclo', tcColadaS <= sprue.tcPartS ? 'CUMPLE' : 'ADVIERTE', '§6.4.7 · Eq 9.6',
    'si la colada tarda más en enfriar que la pieza, es la colada la que fija el ciclo — y se paga en cada disparo. El remedio es bajar el ⌀ (el runner no necesita la rigidez de la pieza).');

  const anuncios: AnuncioRetorno[] = [];
  if (!resuelto) anuncios.push({
    estacion: 3, titulo: 'la colada pesa demasiado, y el largo lo fija el STACK',
    detalle: `${pct.toFixed(1)} % contra el ${limPct} % de §6.2.3 con un bebedero de ${d.LsprueMm.toFixed(0)} mm que sale de top clamp + placa A (§6.3.1) — acortarlo es cambiar PLACAS, decisión de la estación 3`,
    seccion: '§6.2.3 · §4.3.2 · A-121',
  });
  if (tcColadaS > sprue.tcPartS) anuncios.push({
    estacion: 9, titulo: 'la COLADA manda el ciclo, no la pieza',
    detalle: `t_c ${hayRunner ? 'del runner' : 'del bebedero'} ${tcColadaS.toFixed(1)} s vs ${sprue.tcPartS.toFixed(1)} s de la pieza (§6.4.7; el propio libro en p.149 lo tolera si el sprue no necesita la rigidez de la pieza — o se reduce ⌀ pagando ΔP)`,
    seccion: '§6.4.7 · Eq 9.6',
  });
  if (!g.ok) anuncios.push({
    estacion: 6, titulo: 'la compuerta se pasa de corte', detalle: g.report, seccion: '§7.3.2',
  });

  return {
    sprue,
    runner: { diaCrudoMm: d.runnerDiaCrudoMm, diaMm: runnerDiaMm, largoMm: runnerLargoMm, dPMPa: dPRunnerMPa, tcS: tcRunnerS, volCc: volRunnerCc },
    gate: { tipo: 'edge', espesorMm: d.gateEspesorMm, anchoMm: d.gateAnchoMm, shear: g.shear, ok: g.ok, report: g.report, dPMPa: dPGateMPa },
    estrecha,
    presion: { cavidadMPa: o.cavidadMPa, alimentacionMPa, totalMPa, maquinaMPa, ok: totalMPa <= maquinaMPa },
    regrind: { antesCc: coladaCc, antesPct: pct, despuesCc: coladaCc, despuesPct: pct, limPct, largoAntesMm: d.LsprueMm, largoDespuesMm: d.LsprueMm, resuelto },
    geom: {
      xSprue: d.ejeX, ySprue: d.ejeY, zParting: d.zPartMm, sprueLenMm: d.LsprueMm,
      rTopMm: d.rTopMm, rBaseMm: d.rBaseMm, runnerDiaMm, runnerLargoMm,
      pozoLargoMm: d.pozoLargoMm, gateEspesorMm: d.gateEspesorMm, gateAnchoMm: d.gateAnchoMm,
      gateLargoMm: d.gateLargoMm, xPiezaMax: d.destino.x, yPieza: d.ejeY,
    },
    filas, anuncios,
  };
}

/* ══════════════════════════════════════════════════════════════════════════ */
/* LA COLA DE PUERCO — la espiral de flujo de la patente, como campo sintético */
/* (orden 2026-08-13-la-cola-de-puerco)                                        */
/* ══════════════════════════════════════════════════════════════════════════ */
/**
 * El ensayo ESTÁNDAR de fluidez de la industria, con números MEDIDOS ajenos:
 * US11976138 acota la herramienta (canal 12.7 × 3.175 mm, sección rectangular,
 * espiral plana) y US11230635 Tabla 6 mide ABS a 3 temperaturas (552/635/730 mm
 * @ 238/249/260 °C, 10 disparos promediados). La longitud reportada EXCLUYE
 * runner y gate ⇒ aquí la boquilla va AL ARRANQUE de la espiral (fiel).
 *
 * Espiral de Arquímedes r(θ) = r₀ + b·θ con paso 20.7 (canal 12.7 + tierra 8).
 * Campo SINTÉTICO con h ANALÍTICA: 2 capas z de c = 3.175/2 ⇒ el colapso del
 * espesor suma la conductancia continua h³/12η EXACTA (capas·c = h). Espiral de
 * 800 mm: cubre 552·1.15 y las COTAS 0.9·635 / 0.9·730 con la mitad de camino
 * (el CG en un canal cuasi-1D necesita ~O(largo) iteraciones — medido: a 990
 * celdas de camino la conservación caía a 1e-2 por el tope de iteraciones).
 *
 * EXTENSIONES DECLARADAS (la patente calla, aquí se declara):
 *  · 1000 psi = presión HIDRÁULICA ⇒ plástico ×10 (intensificación de husillo
 *    estándar): pLimit = 69 MPa. La trampa clásica, de frente.
 *  · Q del husillo ⌀32 a 1 in/s = 20,430 mm³/s ⇒ v_frente ≈ 507 mm/s.
 *  · k(T): el power-law del libro (k=17,070 @239 °C) escalado por η₀(T)/η₀(239)
 *    del Cross-WLF validado; n fijo. El grado difiere (GP22NR vs MG47).
 */
export interface CampoEspiral {
  campo: {
    nx: number; ny: number; nz: number; cellMm: number;
    x0: number; y0: number; z0: number;
    cavity: Uint8Array; thicknessMm: Float32Array;
    gate: { i: number; j: number; k: number };
    volumeMm3: number;
    idx(i: number, j: number, k: number): number;
  };
  /** longitud de ARCO (mm) por celda a lo largo de la espiral; −1 fuera */
  sMm: Float32Array;
  LtotalMm: number;
  material: MeltMaterial;
  QmmS: number;
  pLimitMPa: number;
  vFrenteMs: number;
  wMm: number; hMm: number;
  dentro(x: number, y: number, z: number): boolean;
  /** longitud de arco de la vuelta MÁS CERCANA (siempre definida — para vestir
   *  vértices del teselado del acero con su posición a lo largo del canal) */
  arcoCercano(x: number, y: number): number;
  /** la MISMA fórmula que talla el acero (espiralAcero): una sola fuente de forma */
  geo: { cx: number; cy: number; r0: number; b: number; thMax: number; halfMm: number };
  /** OCUPACIÓN POR DISTANCIA FIRMADA analítica (enmienda cola-de-puerco-de-acero:
   *  "se ve pixelado" — ian). occ = clamp(0.5 − sdf/c): el cruce iso-0.5 de la
   *  superficie aterriza en la pared EXACTA de la fórmula, a cualquier retícula.
   *  La pared sale de la FÓRMULA, no de la retícula — el programa de precisión. */
  ocupacionSdf: Float32Array;
}

export function campoEspiral(o: { TmeltC: number; LtotalMm?: number; pLimitMPa?: number }): CampoEspiral {
  const w = 12.7, h = 3.175;                      // el canal de la patente
  const paso = 20.7, r0 = 12;                     // tierra de 8 entre vueltas
  const L = o.LtotalMm ?? 800;
  const b = paso / (2 * Math.PI);
  // s(θ) ≈ r₀θ + bθ²/2  ⇒  θmax de L (la aproximación ∫r dθ, válida r ≫ b)
  const thMax = (-r0 + Math.sqrt(r0 * r0 + 2 * b * L)) / b;
  const R = r0 + b * thMax;
  const c = h / 2;                                // 2 capas EXACTAS: capas·c = h
  const half = R + w / 2 + 3 * c;
  const nx = Math.ceil((2 * half) / c), ny = nx, nz = 2;
  const N = nx * ny * nz;
  const idx = (i: number, j: number, k: number) => (k * ny + j) * nx + i;
  const cx = half, cy = half;
  // ¿(x,y) cae en el canal? — probar las vueltas candidatas k: θ = φ + 2πk
  const arcoDe = (x: number, y: number): number => {
    const r = Math.hypot(x - cx, y - cy);
    if (r > R + w / 2 || r < r0 - w / 2) return -1;
    let phi = Math.atan2(y - cy, x - cx);
    if (phi < 0) phi += 2 * Math.PI;
    for (let kk = -1; kk <= Math.ceil(thMax / (2 * Math.PI)); kk++) {
      const th = phi + 2 * Math.PI * kk;
      if (th < -1e-9 || th > thMax) continue;
      if (Math.abs(r - (r0 + b * th)) <= w / 2) return r0 * th + (b * th * th) / 2;
    }
    return -1;
  };
  const dentro = (x: number, y: number, z: number) =>
    z >= 0 && z <= h && arcoDe(x, y) >= 0;
  const arcoCercano = (x: number, y: number): number => {
    const r = Math.hypot(x - cx, y - cy);
    let phi = Math.atan2(y - cy, x - cx);
    if (phi < 0) phi += 2 * Math.PI;
    let best = Infinity, sBest = 0;
    for (let kk = -1; kk <= Math.ceil(thMax / (2 * Math.PI)); kk++) {
      const th = Math.min(thMax, Math.max(0, phi + 2 * Math.PI * kk));
      const d = Math.abs(r - (r0 + b * th));
      if (d < best) { best = d; sBest = r0 * th + (b * th * th) / 2; }
    }
    return sBest;
  };
  // distancia FIRMADA al canal (negativa adentro): en el plano, a la curva
  // espiral más cercana (|r − r_k| − w/2 sobre las vueltas candidatas); en z, a
  // las caras 0 y h. Sección caja ⇒ sdf = max(d_xy, d_z).
  const sdfCanal = (x: number, y: number, z: number): number => {
    const r = Math.hypot(x - cx, y - cy);
    let phi = Math.atan2(y - cy, x - cx);
    if (phi < 0) phi += 2 * Math.PI;
    let dXY = Infinity;
    for (let kk = -1; kk <= Math.ceil(thMax / (2 * Math.PI)); kk++) {
      const th = Math.min(thMax, Math.max(0, phi + 2 * Math.PI * kk));
      const d = Math.abs(r - (r0 + b * th)) - w / 2;
      if (d < dXY) dXY = d;
    }
    return Math.max(dXY, -z, z - h);
  };
  const cavity = new Uint8Array(N);
  const thicknessMm = new Float32Array(N);
  const sMm = new Float32Array(N).fill(-1);
  const ocupacionSdf = new Float32Array(N);
  let vox = 0;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const X = (i + 0.5) * c, Y = (j + 0.5) * c, Z = (k + 0.5) * c;
    const t = idx(i, j, k);
    ocupacionSdf[t] = Math.max(0, Math.min(1, 0.5 - sdfCanal(X, Y, Z) / c));
    const s = arcoDe(X, Y);
    if (s < 0) continue;
    cavity[t] = 1; thicknessMm[t] = h; sMm[t] = s; vox++;
  }
  // la boquilla: la celda de cavidad más cercana al ARRANQUE (θ=0 ⇒ x=cx+r₀)
  let gi = 0, gj = 0, best = Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    if (!cavity[idx(i, j, 1)]) continue;
    const d = ((i + 0.5) * c - (cx + r0)) ** 2 + ((j + 0.5) * c - cy) ** 2;
    if (d < best) { best = d; gi = i; gj = j; }
  }
  // material a T: k escalada por Cross-WLF (n fija — extensión declarada)
  const kT = ABS_MG47.k * (eta0CrossWLF(ABS_CROSS, o.TmeltC) / eta0CrossWLF(ABS_CROSS, 239));
  const QmmS = (Math.PI / 4) * 32 * 32 * 25.4;    // husillo ⌀32 × 1 in/s
  return {
    campo: {
      nx, ny, nz, cellMm: c, x0: 0, y0: 0, z0: 0,
      cavity, thicknessMm, gate: { i: gi, j: gj, k: 1 },
      volumeMm3: vox * c * c * c, idx,
    },
    sMm, LtotalMm: L,
    material: { ...ABS_MG47, k: kT },
    QmmS, pLimitMPa: o.pLimitMPa ?? 69,
    vFrenteMs: QmmS / (w * h) / 1000,
    wMm: w, hMm: h, dentro, arcoCercano,
    geo: { cx, cy, r0, b, thMax, halfMm: half },
    ocupacionSdf,
  };
}

/** la longitud de espiral ALCANZADA por un llenado (max arco mojado, mm) */
export function longitudEspiralMm(e: CampoEspiral, frente: Float32Array): number {
  let L = 0;
  for (let t = 0; t < frente.length; t++)
    if (frente[t] >= 0 && e.sMm[t] > L) L = e.sMm[t];
  return +L.toFixed(1);
}

/**
 * EL ACERO DE LA ESPIRAL (orden 2026-08-13-cola-de-puerco-de-acero).
 * ian: "un líquido adquiere la forma del RECIPIENTE — aquí es una mágica cola de
 * puerco". El dominio declarado sin acero es un operador inventado: NINGÚN gate del
 * solver caza un dominio equivocado. REGLA: ningún llenado sin acero.
 *
 * Todo es REUSO del dado: el canal por el patrón de `dadoRectoShape` (occLoft de
 * dos secciones, polígono espiral ida-por-fuera / vuelta-por-dentro) y la placa por
 * `occCut` (el mismo boolean de dadoUndercutShape). La MISMA fórmula r(θ)=r₀+bθ
 * (via `esp.geo`) talla el acero Y voxeliza el campo — una sola fuente de forma,
 * y el CRUCE de volúmenes ata las dos representaciones por número.
 */
/** el SÓLIDO del canal espiral (patrón dadoRectoShape): polígono ida-exterior /
 *  vuelta-interior a Δθ dado + loft de 2 secciones. Δθ=6° para booleanas (sagita
 *  <0.1); Δθ=2° para el RENDER exacto del fundido (sagita 0.03 — enmienda 2). */
export function espiralCanalSolido(oc: any, e: CampoEspiral, dThetaDeg = 6): any {
  const { cx, cy, r0, b, thMax } = e.geo;
  const w = e.wMm, h = e.hMm;
  const dTh = (dThetaDeg * Math.PI) / 180;
  const pts: Array<{ x: number; y: number }> = [];
  const n = Math.ceil(thMax / dTh);
  for (let q = 0; q <= n; q++) {                   // ida por el borde EXTERIOR
    const th = Math.min(thMax, q * dTh);
    const r = r0 + b * th + w / 2;
    pts.push({ x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) });
  }
  for (let q = n; q >= 0; q--) {                   // vuelta por el INTERIOR
    const th = Math.min(thMax, q * dTh);
    const r = r0 + b * th - w / 2;
    pts.push({ x: cx + r * Math.cos(th), y: cy + r * Math.sin(th) });
  }
  const pl = (z: number) => ({ origin: [0, 0, z] as [number, number, number], uDir: [1, 0, 0] as [number, number, number], vDir: [0, 1, 0] as [number, number, number] });
  return occLoft(oc, [
    { pts, plane: pl(0) },
    { pts, plane: pl(h) },
  ], { solid: true, ruled: true });
}

export function espiralAcero(oc: any, e: CampoEspiral): {
  canal: any; placa: any; tapa: any;
  vols: { canalMm3: number; huecoMm3: number; analiticoMm3: number; placaMm3: number };
} {
  const { halfMm } = e.geo;
  const h = e.hMm;
  const canal = espiralCanalSolido(oc, e, 6);
  // la PLACA: caja de 2·half × 2·half, fondo 12, el canal HUNDIDO en la cara
  // superior y ABIERTO en la partición z=h (lo cierra la tapa plana)
  const lado = 2 * halfMm, fondo = 12;
  const caja = occTransform(oc, occMakeBox(oc, lado, lado, fondo + h), { translate: [0, 0, -fondo] });
  const placa = occCut(oc, caja, canal);
  const tapa = occTransform(oc, occMakeBox(oc, lado, lado, 8), { translate: [0, 0, h] });
  const canalMm3 = occVolume(oc, canal);
  const placaMm3 = occVolume(oc, placa);
  const huecoMm3 = lado * lado * (fondo + h) - placaMm3;   // lo que el acero CONTABILIZA
  return {
    canal, placa, tapa,
    vols: {
      canalMm3: +canalMm3.toFixed(1),
      huecoMm3: +huecoMm3.toFixed(1),
      analiticoMm3: +(e.LtotalMm * e.wMm * e.hMm).toFixed(1),
      placaMm3: +placaMm3.toFixed(1),
    },
  };
}

/**
 * LA MALLA EXACTA DEL FUNDIDO (enmienda 2 de cola-de-puerco-de-acero): el líquido
 * VISTE la forma del recipiente — la malla sale de LA MISMA fórmula r(θ)=r₀+bθ
 * que talla el acero, estructurada por paso de θ (cada triángulo abarca ≤ un paso
 * de arco ⇒ el corte del frente es limpio) y con NORMALES ANALÍTICAS (radial en
 * paredes, ±z en tapas — aristas vivas como el canal real). PURA: sin OCC, sin
 * vóxeles. El solver FAN sigue mandando el TIEMPO (sV + s_front recortan por arco).
 */
export interface MallaEspiral {
  positions: Float32Array; normals: Float32Array; indices: Uint32Array;
  /** longitud de arco (mm) por VÉRTICE — el recorte del frente es sV ≤ s_front(t) */
  sV: Float32Array;
  tris: number;
}
export function espiralMalla(e: CampoEspiral, dThetaDeg = 2): MallaEspiral {
  const { cx, cy, r0, b, thMax } = e.geo;
  const w = e.wMm, h = e.hMm;
  const dTh = (dThetaDeg * Math.PI) / 180;
  const n = Math.ceil(thMax / dTh);
  const P: number[] = [], N: number[] = [], S: number[] = [], I: number[] = [];
  // 8 vértices por anillo (duplicados por CARA para conservar la arista viva):
  // 0 To(out,top) 1 Ti(in,top) 2 Bo(out,bot) 3 Bi(in,bot)
  // 4 WoT 5 WoB (pared exterior) · 6 WiT 7 WiB (pared interior)
  for (let q = 0; q <= n; q++) {
    const th = Math.min(thMax, q * dTh);
    const c = Math.cos(th), s = Math.sin(th);
    const rC = r0 + b * th, ro = rC + w / 2, ri = rC - w / 2;
    const sArc = r0 * th + (b * th * th) / 2;
    const xo = cx + ro * c, yo = cy + ro * s, xi = cx + ri * c, yi = cy + ri * s;
    const put = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
      P.push(x, y, z); N.push(nx, ny, nz); S.push(sArc);
    };
    put(xo, yo, h, 0, 0, 1); put(xi, yi, h, 0, 0, 1);        // tapa sup
    put(xo, yo, 0, 0, 0, -1); put(xi, yi, 0, 0, 0, -1);      // tapa inf
    put(xo, yo, h, c, s, 0); put(xo, yo, 0, c, s, 0);        // pared ext (radial+)
    put(xi, yi, h, -c, -s, 0); put(xi, yi, 0, -c, -s, 0);    // pared int (radial−)
  }
  const V = (q: number, k: number) => q * 8 + k;
  for (let q = 0; q < n; q++) {
    const quad = (a: number, b2: number, c2: number, d: number) => { I.push(a, b2, c2, a, c2, d); };
    quad(V(q, 0), V(q + 1, 0), V(q + 1, 1), V(q, 1));        // tapa sup (CCW vista +z)
    quad(V(q, 3), V(q + 1, 3), V(q + 1, 2), V(q, 2));        // tapa inf
    quad(V(q, 5), V(q + 1, 5), V(q + 1, 4), V(q, 4));        // pared exterior
    quad(V(q, 6), V(q + 1, 6), V(q + 1, 7), V(q, 7));        // pared interior
  }
  // los CABOS (caras radiales en θ=0 y θ=θmax) — normal = ±tangente
  const cabo = (q: number, dir: number) => {
    const th = Math.min(thMax, q * dTh);
    const tx = -Math.sin(th) * dir, ty = Math.cos(th) * dir;
    const base = P.length / 3;
    for (const k of [0, 1, 3, 2]) {                           // To Ti Bi Bo
      P.push(P[V(q, k) * 3], P[V(q, k) * 3 + 1], P[V(q, k) * 3 + 2]);
      N.push(tx, ty, 0); S.push(S[V(q, k)]);
    }
    if (dir > 0) I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else I.push(base, base + 2, base + 1, base, base + 3, base + 2);
  };
  cabo(0, -1); cabo(n, +1);
  return {
    positions: new Float32Array(P), normals: new Float32Array(N),
    indices: new Uint32Array(I), sV: new Float32Array(S), tris: I.length / 3,
  };
}
