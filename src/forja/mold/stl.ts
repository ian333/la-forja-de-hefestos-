/**
 * PARSER STL — binario y ASCII, browser y node, sin dependencias.
 * ============================================================================
 * Devuelve la sopa de triángulos {positions, indices} que consumen dfmFromMesh,
 * solidFromMesh, meshVolumeArea y gripEjectorLayout. NO decima: la fidelidad la
 * gobiernan los consumidores (el raster de dfm acota su rejilla, el campo de
 * flujo acota sus vóxeles). Decimar aquí rompería la paridad del ray-cast
 * (clustering de vértices → agujeros → vóxeles inalcanzables fantasma).
 */
import type { MeshLike } from './flowlen-mesh';
import { matriculaDeMalla, mallaEnPalabras, type Matricula } from '../verificacion/matricula';
import { dfmFromMesh, type DfmMeshReport } from './dfm-mesh';
import { contrasalidaQueHariaFalta, type ContrasalidaDictamen } from './ejectortypes';
import { ABS_EJECT } from './ejection';

/** ¿El buffer es STL binario? El header ASCII arranca con "solid ", pero el
 *  criterio FIRME es el conteo: 84 + n·50 debe calzar con el tamaño real. */
function esBinario(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 84) return false;
  const n = new DataView(buf).getUint32(80, true);
  return 84 + n * 50 === buf.byteLength;
}

export function parseSTL(buf: ArrayBuffer): MeshLike {
  if (esBinario(buf)) {
    const dv = new DataView(buf);
    const n = dv.getUint32(80, true);
    const positions = new Float32Array(n * 9);
    const indices = new Uint32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = 84 + i * 50 + 12;                       // salta el normal (12 bytes)
      for (let v = 0; v < 9; v++) positions[i * 9 + v] = dv.getFloat32(o + v * 4, true);
      indices[i * 3] = i * 3; indices[i * 3 + 1] = i * 3 + 1; indices[i * 3 + 2] = i * 3 + 2;
    }
    return { positions, indices };
  }
  // ASCII: "vertex x y z" por línea, 3 por facet
  const txt = new TextDecoder().decode(buf);
  const P: number[] = [];
  const re = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) P.push(+m[1], +m[2], +m[3]);
  const nv = Math.floor(P.length / 9) * 9;              // triángulos completos
  const positions = new Float32Array(P.slice(0, nv));
  const indices = new Uint32Array(nv / 3);
  for (let i = 0; i < indices.length; i++) indices[i] = i;
  if (!indices.length) throw new Error('STL vacío o ilegible (ni binario ni ASCII con vertex)');
  return { positions, indices };
}

/** Lo que trae una pieza cargada por el operador, además de su malla. */
export interface MallaCargada {
  mesh: MeshLike;
  /** 'stl' | 'step' — de dónde salió la malla */
  fuente: 'stl' | 'step';
  /** sólidos que traía el STEP (1 = pieza limpia; >1 = un ENSAMBLE, ver `puerta.cuerpos`); en un STL, los CUERPOS sueltos
   *  de la malla (componentes conexas de la matrícula — antes era un 1 fijo: orden C, 2026-10-24) */
  solidos: number;
  /** volumen exacto del kernel (solo STEP; la malla no tiene "exacto" contra qué compararse) */
  volKernelMm3?: number;
  /** LA ENTRADA (orden 2026-09-18-la-entrada): qué sólido se tomó y cómo se paró — el estudio la REUSA al reconstruir */
  entrada?: import('./draw-axis').PiezaDelSTEP;
  /** supuestos y advertencias DECLARADOS — se pintan, no se esconden */
  notas: string[];
  /** LA PUERTA (orden C, 2026-10-24): lo que el paso 2 dice ANTES del molde y del precio */
  puerta?: PuertaDeLaPieza;
}

/** Lo que el operador ya contestó al soltar (la puerta pregunta; la respuesta vuelve a cargar con esto). */
export interface OpcionesCarga {
  /** STEP con varios sólidos: cuál se moldea (índice en el orden del archivo). Sin él se mide el MAYOR y la puerta PREGUNTA. */
  solido?: number;
  /** STL diminuto: el operador respondió las unidades (pulgadas ⇒ la malla se escala ×25.4) */
  unidades?: 'mm' | 'pulgadas';
}

/* ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * LA PUERTA QUE DICE NO (orden C · 2026-10-24, del debate de 25 expertos: juez A, disputa D7)
 * ══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * Hasta hoy La Forja nunca decía NO: la tapa con contrasalidas (1594C Lid) salía «con-mecanismos» en el DFM y aun así armaba
 * un molde de 2 placas con precio. Aquí, al soltar y ANTES del kernel del molde, se mide y se dice:
 *   · la MALLA (matrícula: cerrada / abierta / volteada) · los CUERPOS (¿cuál moldeo?) · las UNIDADES (solo STL)
 *   · las CONTRASALIDAS sobre la dirección de apertura del paso 5 (+Z, la misma de `partingLoops`), con `dfmFromMesh` (§2.3.7)
 *     y el juez del libro `checkUndercut` (§11.3.5) para decir qué haría falta.
 * Si no se puede: la razón, lo que haría falta, y el camino se CIERRA desde un paso (`cierraDesde`): 3 mientras espera una
 * respuesta (qué sólido, qué unidades), 6 cuando el molde y el precio no van (contrasalidas, STL, sólido inválido).
 * PURO salvo el kernel del STEP (que ya venía): node lo prueba sin navegador.
 */
export type EstadoPuerta = 'verde' | 'ambar' | 'rojo' | 'pregunta';
export interface SolidoDelArchivo { i: number; volCc: number; tamMm: [number, number, number] }
export interface FilaPuerta { id: 'malla' | 'cuerpos' | 'unidades' | 'contrasalidas' | 'molde'; estado: 'ok' | 'aviso' | 'falla' | 'pregunta'; texto: string; detalle?: string }
export interface RegionDeLaPuerta {
  /** índice en `dfm.regionsDetail` */
  k: number;
  /** caja de la región en coordenadas de la PIEZA (las del visor), y su centro */
  min: [number, number, number]; max: [number, number, number]; centro: [number, number, number];
  volMm3: number; cols: number; dir: [number, number] | null;
  dictamen: ContrasalidaDictamen;
}
/** Lo medido, crudo: de aquí `armarPuerta` saca el veredicto (y lo re-saca cuando el operador contesta, sin volver a medir). */
export interface MedidaPuerta {
  fuente: 'stl' | 'step';
  malla: { estado: 'sana' | 'abierta' | 'volteada' | 'revuelta'; frase: string; detalle: string; componentes: number; aristasSueltas: number; aristas3: number; volteadas: number; volMm3: number; triangulos: number;
    /** STEP con malla abierta: ¿el SÓLIDO es válido (BRepCheck)? null = no se preguntó (la malla salió sana) */
    brepValido: boolean | null; volteadaCorregida: boolean };
  cuerpos: { lista: SolidoDelArchivo[]; elegido: number; confirmado: boolean };
  unidades: { diagMm: number; tamMm: [number, number, number]; respuesta: 'mm' | 'pulgadas' | null };
  contrasalidas: { moldable: 'si' | 'con-mecanismos' | 'no'; regiones: RegionDeLaPuerta[]; ruido: number; triangulos: Uint32Array; paredMm: number };
  /** desde que llegó el archivo hasta el veredicto (lo que ve el cliente) */
  ms: number;
  /** de dónde salen esos ms: leer el archivo en el kernel, pararlo en su eje, teselarlo, y LA PUERTA misma (matrícula + DFM +
   *  BRepCheck si hizo falta). Medido 2026-10-24: la puerta cuesta decenas de ms; lo caro es el kernel que ya estaba. */
  tiempos?: { importarMs: number; entradaMs: number; teselaMs: number; puertaMs: number };
}
export interface PuertaDeLaPieza {
  estado: EstadoPuerta;
  /** desde qué paso del camino se cierra (null = abierto) */
  cierraDesde: number | null;
  titulo: string;
  /** la razón del NO (o de la pregunta), en palabras de taller */
  razon: string | null;
  hariaFalta: string[];
  filas: FilaPuerta[];
  medida: MedidaPuerta;
}

/** STL más chico que esto (diagonal de su caja) ⇒ «¿está en pulgadas?». Regla de Hefestos, sin cita. La orden C la puso en 5 mm
 *  (juez A, D7); la orden D midió que la 1594C Box en pulgadas (÷25.4) mide 5.10 mm de diagonal y pasaba por una décima. El sólido más
 *  chico de los 73 Hammond mide 35.3 mm: 10 mm deja margen de los dos lados. */
export const DIAGONAL_SOSPECHA_PULGADAS_MM = 10;

/** del veredicto medido a la tarjeta: el orden de las preguntas es el del taller (¿qué es?, ¿está sana?, ¿sale del molde?) */
export function armarPuerta(m: MedidaPuerta): PuertaDeLaPieza {
  const filas: FilaPuerta[] = [];
  const hariaFalta: string[] = [];
  const cierres: number[] = [];
  let estado = 'verde' as EstadoPuerta;   // `as`: que TS no lo angoste a 'verde' (lo sube un cierre)
  const sube = (e: EstadoPuerta) => { const rango = { verde: 0, ambar: 1, pregunta: 2, rojo: 3 }; if (rango[e] > rango[estado]) estado = e; };
  let titulo = '', razon: string | null = null;
  const f1 = (x: number) => x.toFixed(1);
  const tam = m.unidades.tamMm.map((v) => f1(v)).join(' × ');   // un decimal SIEMPRE: la cota del Foco dice 106.5, no 107

  // ── 1 · LOS CUERPOS: ¿cuál moldeo? ──
  const N = m.cuerpos.lista.length;
  const esperaCuerpo = m.fuente === 'step' && N > 1 && !m.cuerpos.confirmado;
  if (m.fuente === 'step') {
    if (N > 1) {
      const el = m.cuerpos.lista.find((s) => s.i === m.cuerpos.elegido);
      filas.push({ id: 'cuerpos', estado: esperaCuerpo ? 'pregunta' : 'ok',
        texto: esperaCuerpo ? `tu archivo trae ${N} sólidos: ¿cuál moldeo?` : `de ${N} sólidos moldeo el que elegiste: n.º ${m.cuerpos.elegido + 1}${el ? `, ${el.volCc.toFixed(2)} cc` : ''}`,
        detalle: esperaCuerpo ? `mientras eliges, en pantalla está el mayor (${el ? `${el.volCc.toFixed(2)} cc` : '—'})` : undefined });
      if (esperaCuerpo) { sube('pregunta'); cierres.push(3); }
    } else filas.push({ id: 'cuerpos', estado: 'ok', texto: '1 sólido' });
  } else {
    const c = m.malla.componentes;
    filas.push({ id: 'cuerpos', estado: c > 1 ? 'aviso' : 'ok', texto: c > 1 ? `${c} cuerpos sueltos en la malla: reviso el conjunto` : '1 cuerpo',
      detalle: c > 1 ? 'para moldear uno, mándame el STEP (o un STL por pieza)' : undefined });
    if (c > 1) sube('ambar');
  }

  // ── 2 · LA MALLA: ¿está cerrada? ──
  const ma = m.malla;
  if (ma.estado === 'abierta') {
    if (m.fuente === 'stl') {
      filas.push({ id: 'malla', estado: 'falla', texto: `tu malla está ${ma.frase}`, detalle: ma.detalle });
      sube('rojo'); cierres.push(3);
      hariaFalta.push('cerrar los huecos de la malla (o mandar el STEP): sin superficie cerrada no sé qué es «dentro» y la pared y el enfriamiento mentirían');
    } else if (ma.brepValido === false) {
      filas.push({ id: 'malla', estado: 'falla', texto: 'tu sólido no pasa la revisión del kernel (BRepCheck)', detalle: `${ma.frase} · ${ma.detalle}` });
      sube('rojo'); cierres.push(6);
      hariaFalta.push('reexportar el STEP desde tu CAD como sólido (no superficies) o repararlo: el molde se corta del sólido');
    } else {
      // la grieta es de NUESTRA tesela, no de tu archivo (red-team r2: «nunca culpar al cliente»)
      filas.push({ id: 'malla', estado: 'aviso', texto: 'tu sólido está sano; la malla con la que mido salió con huecos', detalle: `${ma.frase} — es de mi teselado, no de tu archivo (BRepCheck: válido). El molde se corta del sólido; pared y enfriamiento pueden fallar cerca de esos huecos` });
      sube('ambar');
    }
  } else if (ma.estado === 'volteada' || ma.volteadaCorregida) {
    filas.push({ id: 'malla', estado: 'aviso', texto: 'cerrada; sus caras miraban hacia adentro y las volteé', detalle: ma.detalle });
    sube('ambar');
  } else if (ma.estado === 'revuelta') {
    filas.push({ id: 'malla', estado: 'aviso', texto: ma.frase, detalle: `${ma.detalle} — el volumen no es de fiar; la pared y el enfriamiento sí (se miden por rayos)` });
    sube('ambar');
  } else filas.push({ id: 'malla', estado: 'ok', texto: ma.frase, detalle: ma.detalle });

  // ── 3 · LAS UNIDADES (solo STL: el STEP las declara) ──
  const sospecha = m.fuente === 'stl' && m.unidades.diagMm < DIAGONAL_SOSPECHA_PULGADAS_MM && m.unidades.respuesta == null;
  if (m.fuente === 'step') filas.push({ id: 'unidades', estado: 'ok', texto: `el STEP declara sus unidades: ${tam} mm` });
  else if (sospecha) {
    filas.push({ id: 'unidades', estado: 'pregunta', texto: `mide ${tam} mm: ¿está en pulgadas?`, detalle: `la diagonal es ${m.unidades.diagMm.toFixed(2)} mm (< ${DIAGONAL_SOSPECHA_PULGADAS_MM} mm): un STL no dice sus unidades` });
    sube('pregunta'); cierres.push(3);
  } else filas.push({ id: 'unidades', estado: 'ok', texto: m.unidades.respuesta === 'pulgadas' ? `en pulgadas, como dijiste: ${tam} mm` : `${tam} mm${m.unidades.respuesta === 'mm' ? ' (dijiste milímetros)' : ''}` });

  // ── 4 · LAS CONTRASALIDAS sobre la apertura del paso 5 ──
  const cs = m.contrasalidas;
  const n = cs.regiones.length;
  if (cs.moldable === 'no') {
    filas.push({ id: 'contrasalidas', estado: 'falla', texto: 'tiene un hueco encerrado por todos lados: no se puede inyectar', detalle: 'ni una corredera lo alcanza (Kazmer §2.3.7)' });
    sube('rojo'); cierres.push(6);
    hariaFalta.push('abrir ese hueco hacia un lado o partir la pieza en dos: así como está no sale de ningún molde (§2.3.7)');
  } else if (n > 0) {
    filas.push({ id: 'contrasalidas', estado: 'falla', texto: `${n} ${n === 1 ? 'zona que no sale' : 'zonas que no salen'} del molde en línea recta${ma.estado === 'abierta' && m.fuente === 'stl' ? ' (con la malla abierta, no es de fiar)' : ''}`,
      detalle: `contrasalidas sobre la apertura del paso 5, Kazmer §2.3.7 — material, hueco y material otra vez en la misma columna${cs.ruido ? ` (más ${cs.ruido} menores al piso de ruido, sin contar)` : ''}` });
    sube('rojo'); cierres.push(6);
    const elasticas = cs.regiones.filter((r) => r.dictamen.check?.ok).length;
    hariaFalta.push(`un mecanismo por zona — corredera o botador inclinado (§11.3.6–7) — o cambiar la pieza para que cada zona salga en línea recta`);
    if (elasticas) hariaFalta.push(`${elasticas} de ${n} podría${elasticas === 1 ? '' : 'n'} botarse estirándose con placa extractora (§11.3.5, ε < 2 %) — tampoco la diseño aquí`);
  } else filas.push({ id: 'contrasalidas', estado: 'ok', texto: 'sale del molde en línea recta: 0 contrasalidas', detalle: `sobre la apertura del paso 5 (Kazmer §2.3.7)${cs.ruido ? ` · ${cs.ruido} menores al piso de ruido (artefactos del raster de 0.8 mm)` : ''}` });

  // ── 5 · EL MOLDE Y EL PRECIO: una fila que dice qué pasos quedan cerrados y por qué ──
  const soloSTL = m.fuente === 'stl' && !cierres.length;          // nada más lo cierra: solo que es STL
  if (m.fuente === 'stl') { cierres.push(6); sube('ambar'); }
  const esperando = esperaCuerpo || sospecha;
  if (esperando) estado = 'pregunta';                              // la respuesta puede cambiar el veredicto: primero se pregunta
  const cierraDesde = cierres.length ? Math.min(...cierres) : null;
  if (cierraDesde == null) filas.push({ id: 'molde', estado: 'ok', texto: 'el molde y el precio: abiertos (pasos 6–9)' });
  else if (cierraDesde <= 3) filas.push({ id: 'molde', estado: esperando ? 'pregunta' : 'falla', texto: esperando ? 'el camino espera tu respuesta (pasos 3–9)' : 'pasos 3–9 cerrados: así no se puede medir' });
  else if (soloSTL) filas.push({ id: 'molde', estado: 'aviso', texto: 'el molde y el precio piden el STEP (pasos 6–9)', detalle: 'el molde se corta de un sólido con caras: un STL solo trae triángulos' });
  else filas.push({ id: 'molde', estado: 'falla', texto: 'el molde y el precio, no (pasos 6–9 cerrados)' });

  // ── el título y la razón: lo que más pesa manda ──
  // una malla abierta va PRIMERO: con huecos, ni el conteo de contrasalidas es de fiar (los rayos no saben qué es «dentro»)
  if (m.fuente === 'stl' && ma.estado === 'abierta') { titulo = 'TU MALLA ESTÁ ABIERTA'; razon = 'Le faltan caras: así no sé qué es «dentro» de tu pieza y la pared, el enfriamiento y hasta las contrasalidas mentirían. Repárala o mándame el STEP.'; }
  else if (cs.moldable === 'no') { titulo = 'ASÍ NO SE PUEDE INYECTAR'; razon = 'Tu pieza tiene un hueco encerrado por todos lados (Kazmer §2.3.7): ningún molde lo alcanza. Te doy el dictamen de tu pieza y su enfriamiento; el molde y el precio, no.'; }
  else if (n > 0) { titulo = `ASÍ NO SALE DEL MOLDE: ${n} ${n === 1 ? 'CONTRASALIDA' : 'CONTRASALIDAS'}`; razon = `Tu pieza tiene ${n} ${n === 1 ? 'zona que no sale' : 'zonas que no salen'} del molde en línea recta (contrasalidas, Kazmer §2.3.7). Aquí no diseño correderas: te doy el dictamen de tu pieza y su enfriamiento; el molde y el precio, no.`; }
  else if (ma.brepValido === false) { titulo = 'TU SÓLIDO NO ES VÁLIDO'; razon = 'El kernel no lo acepta como sólido (BRepCheck): el molde se cortaría mal. Te doy el dictamen de la malla; el molde y el precio, no.'; }
  if (esperaCuerpo) { titulo = `TU ARCHIVO TRAE ${N} SÓLIDOS: ¿CUÁL MOLDEO?`; razon = `Es un ensamble. Elige la pieza que quieres moldear; el camino espera tu elección${n > 0 ? ' (el mayor, que ves ahora, tiene contrasalidas)' : ''}.`; }
  else if (sospecha) { titulo = '¿ESTÁ EN PULGADAS?'; razon = `Tu pieza mide ${tam} mm de punta a punta: muy chica para inyectar. Un STL no dice sus unidades; si la dibujaste en pulgadas, la escalo ×25.4.`; }
  if (!titulo) {
    if (m.fuente === 'stl') { titulo = 'CON UN STL REVISO TU PIEZA'; razon = 'Te doy el dictamen de tu pieza y su enfriamiento. El molde y el precio piden el STEP (un sólido con caras).'; }
    else if (estado === 'ambar') titulo = 'TU PIEZA PASA LA PUERTA, CON UN AVISO';
    else titulo = 'TU PIEZA PASA LA PUERTA';
  }
  return { estado, cierraDesde, titulo, razon, hariaFalta, filas, medida: m };
}

/** el operador eligió el sólido que YA estaba en pantalla: no hay que volver a medir, solo dejar de esperar */
export function confirmarSolido(p: PuertaDeLaPieza): PuertaDeLaPieza {
  return armarPuerta({ ...p.medida, cuerpos: { ...p.medida.cuerpos, confirmado: true } });
}

/** los triángulos de la malla que caen DENTRO de una región significativa (su caja + una celda del raster): lo que se pinta.
 *  Los tres vértices adentro — un triángulo grande de una pared plana que solo roza la región no se pinta (la pintaría entera). */
export function triangulosEnContrasalidas(mesh: MeshLike, d: DfmMeshReport): Uint32Array {
  const U = d.undercutMap, P = mesh.positions, I = mesh.indices;
  const cajas = d.regionsDetail.filter((r) => r.significativa).map((r) => ({
    x0: U.x0 + r.x0 - U.sx, x1: U.x0 + r.x1 + U.sx, y0: U.y0 + r.y0 - U.sy, y1: U.y0 + r.y1 + U.sy, z0: U.z0 + r.zLo - 0.3, z1: U.z0 + r.zHi + 0.3,
  }));
  if (!cajas.length) return new Uint32Array(0);
  const out: number[] = [];
  const dentro = (k: number, c: typeof cajas[number]) => P[k] >= c.x0 && P[k] <= c.x1 && P[k + 1] >= c.y0 && P[k + 1] <= c.y1 && P[k + 2] >= c.z0 && P[k + 2] <= c.z1;
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    for (const q of cajas) if (dentro(a, q) && dentro(b, q) && dentro(c, q)) { out.push(t / 3); break; }
  }
  return Uint32Array.from(out);
}

/** LA MEDIDA de la puerta sobre una malla ya parada en su eje de apertura (+Z): matrícula + contrasalidas. */
function medirMalla(mesh: MeshLike, mat: Matricula): { malla: Omit<MedidaPuerta['malla'], 'brepValido' | 'volteadaCorregida'>; contrasalidas: MedidaPuerta['contrasalidas']; unidades: Omit<MedidaPuerta['unidades'], 'respuesta'> } {
  const pal = mallaEnPalabras(mat);
  const bb = mat.bbox;
  const d = dfmFromMesh(mesh as { positions: Float32Array; indices: Uint32Array });
  const U = d.undercutMap;
  const sig = d.regionsDetail.map((r, k) => ({ r, k })).filter((x) => x.r.significativa);
  const regiones: RegionDeLaPuerta[] = sig.map(({ r, k }) => {
    const min: [number, number, number] = [U.x0 + r.x0, U.y0 + r.y0, U.z0 + r.zLo];
    const max: [number, number, number] = [U.x0 + r.x1, U.y0 + r.y1, U.z0 + r.zHi];
    return { k, min, max, centro: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], volMm3: r.volMm3, cols: r.cols, dir: r.dir,
      dictamen: contrasalidaQueHariaFalta(ABS_EJECT, r, d.wall.p50Mm) };
  });
  return {
    malla: { estado: pal.estado, frase: pal.frase, detalle: pal.detalle, componentes: mat.componentes, aristasSueltas: mat.bordesFrontera, aristas3: mat.bordesNoManifold,
      volteadas: mat.bordesMalOrientados, volMm3: Math.abs(mat.volumenConSigno), triangulos: mat.F },
    contrasalidas: { moldable: d.moldable, regiones, ruido: d.regionsDetail.length - sig.length, triangulos: triangulosEnContrasalidas(mesh, d), paredMm: d.wall.p50Mm },
    unidades: { diagMm: mat.diagonal, tamMm: [bb.x1 - bb.x0, bb.y1 - bb.y0, bb.z1 - bb.z0] },
  };
}

/** la caja de un sólido por sus ARISTAS (sin mallar): medido en 1557BGY, 19 sólidos en 130 ms y a ≤0.1 mm de la caja óptima
 *  (`AddOptimal`: 11 s); la de polos (`Add` de la forma) inflaba 15× con BSpline. Un toro (empaque) sale delgado: se dice «≈». */
function cajaPorAristas(oc: any, s: any): [number, number, number] {
  const b = new oc.Bnd_Box_1();
  const ex = new oc.TopExp_Explorer_2(s, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  while (ex.More()) { oc.BRepBndLib.Add(ex.Current(), b, false); ex.Next(); }
  ex.delete?.();
  if (b.IsVoid()) { b.delete?.(); return [0, 0, 0]; }
  const a = b.CornerMin(), z = b.CornerMax();
  const r: [number, number, number] = [+(z.X() - a.X()).toFixed(1), +(z.Y() - a.Y()).toFixed(1), +(z.Z() - a.Z()).toFixed(1)];
  b.delete?.();
  return r;
}

const ahora = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * ARCHIVO → MALLA: el cargador de "suelta TU pieza".
 * ============================================================================
 * Decide por extensión y devuelve SIEMPRE la misma `MeshLike` que consume
 * `revisarModelo` (camino B). Es la única pieza que faltaba: el parser de STL,
 * el tesela del kernel y el motor de revisión ya existían por separado.
 *
 * · `.stl` → `parseSTL` (binario o ASCII, sin kernel: la rama ligera).
 * · `.step`/`.stp` → `importSTEP` + `tessellate` del kernel, que se carga por
 *   import DINÁMICO para que el camino STL siga sin dependencias (este módulo
 *   lo usan scripts de node que no arrancan OCCT).
 *
 * Medido 2026-08-28 (deflexión 0.1 / ángulo 0.5): el volumen de la malla queda
 * a 0.04 % del volumen exacto del kernel en 1594C Lid, 0.09 % en 1594C Box y
 * 0.19 % en 1553B — la tesela NO es la fuente del error de una cotización.
 *
 * HONESTIDAD SOBRE EL MULTI-SÓLIDO: un STEP de fabricante casi nunca trae UNA
 * pieza (1553B trae 10 sólidos: la caja, su tapa y sus postes). Desde LA PUERTA (orden C) la lista sale en la tarjeta del
 * paso 2 y el camino ESPERA a que elijas; mientras, se mide el mayor. `o.solido` es la elección (vuelve a cargar con ella).
 *
 * LA PUERTA (orden C): toda carga trae `puerta` — matrícula, cuerpos, unidades y contrasalidas, medidas sobre la MISMA
 * malla que verá el Foco. Medido en node (iangpu, 2026-10-24): la carcasa 1594C Box 34 ms de matrícula + 43 ms de DFM; la
 * tapa 1594C Lid 8 + 8 ms.
 */
export async function mallaDesdeArchivo(nombre: string, buf: ArrayBuffer, o: OpcionesCarga = {}): Promise<MallaCargada> {
  const ext = (nombre.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  if (ext === 'stl') {
    const t0 = ahora();
    let mesh = parseSTL(buf);
    const notas = [`STL: ${mesh.indices.length / 3} triángulos (malla tal cual, sin decimar)`];
    if (o.unidades === 'pulgadas') {
      const P = Float32Array.from(mesh.positions, (v) => v * 25.4);
      mesh = { positions: P, indices: mesh.indices };
      notas.push('dijiste pulgadas: la malla se escaló ×25.4 a milímetros');
    }
    const tP = ahora();
    const mat = matriculaDeMalla(mesh);
    // caras al revés en una malla cerrada y coherente: se VOLTEAN (y se dice) — es reparar, no inventar
    let volteada = false;
    if (mat.cerrada && mat.devanadoCoherente && mat.volumenConSigno < 0) {
      const I = Uint32Array.from(mesh.indices);
      for (let t = 0; t + 2 < I.length; t += 3) { const b = I[t + 1]; I[t + 1] = I[t + 2]; I[t + 2] = b; }
      mesh = { positions: mesh.positions, indices: I };
      volteada = true;
      notas.push('las caras de tu malla miraban hacia adentro (volumen negativo): se voltearon');
    }
    const med = medirMalla(mesh, mat);
    const puerta = armarPuerta({ fuente: 'stl', malla: { ...med.malla, brepValido: null, volteadaCorregida: volteada },
      cuerpos: { lista: [], elegido: 0, confirmado: true }, unidades: { ...med.unidades, respuesta: o.unidades ?? null },
      contrasalidas: med.contrasalidas, ms: Math.round(ahora() - t0),
      tiempos: { importarMs: Math.round(tP - t0), entradaMs: 0, teselaMs: 0, puertaMs: Math.round(ahora() - tP) } });
    if (mat.componentes > 1) notas.push(`la malla trae ${mat.componentes} cuerpos sueltos: se revisan juntos`);
    return { mesh, fuente: 'stl', solidos: mat.componentes, notas, puerta };
  }
  if (ext === 'step' || ext === 'stp') {
    const t0 = ahora();
    const K = await import('../brep/occt');
    const oc = await K.getOCCT();
    const crudo = K.importSTEP(oc, new TextDecoder().decode(buf));
    const tImp = ahora();
    // LA ENTRADA: 15 de los 20 STEP Hammond son ENSAMBLES (caja+tapa+PCB+tornillos) — el Foco medía el ladrillo
    // fundido y acostado. Aquí se toma el sólido (el elegido, o el mayor mientras eliges) y se para en su eje de apertura
    // (la misma decisión que el estudio aplica al B-Rep: se entrega en `entrada` para no medir dos veces).
    const { prepararPiezaDelSTEP } = await import('./draw-axis');
    let entrada: import('./draw-axis').PiezaDelSTEP | undefined;
    let lista: SolidoDelArchivo[] = [];
    let volElegido = NaN;
    const solids: any[] = (() => { try { return K.uniqueSubShapes(oc, crudo, oc.TopAbs_ShapeEnum.TopAbs_SOLID); } catch { return []; } })();
    if (solids.length > 1) {
      // LA LISTA «¿cuál moldeo?»: el volumen exacto de cada sólido (el mismo costo que ya pagaba la entrada para escoger el
      // mayor) y su caja por aristas. La entrada se mide sobre el sólido ELEGIDO solo — mismo resultado que sobre el
      // compuesto (mismo sólido, mismos giros alrededor de su centro), y `aplicarEntrada` lo reaplica con `indice`.
      const vols = solids.map((s) => { try { return K.volume(oc, s); } catch { return 0; } });
      lista = solids.map((s, i) => ({ i, volCc: +(vols[i] / 1000).toFixed(2), tamMm: (() => { try { return cajaPorAristas(oc, s); } catch { return [0, 0, 0] as [number, number, number]; } })() }));
      const mayor = vols.indexOf(Math.max(...vols));
      const k = o.solido != null && o.solido >= 0 && o.solido < solids.length ? o.solido : mayor;
      try {
        const e1 = prepararPiezaDelSTEP(oc, solids[k]);
        entrada = { ...e1, solidos: solids.length, indice: k, volsCc: [...vols].sort((a, b) => b - a).map((v) => +(v / 1000).toFixed(2)),
          elegido: { ...e1.elegido, volCc: +(vols[k] / 1000).toFixed(2) } };
        volElegido = vols[k];
      } catch { entrada = undefined; }
    } else {
      try { entrada = prepararPiezaDelSTEP(oc, crudo); } catch { entrada = undefined; }
    }
    const shape = entrada ? entrada.shape : crudo;
    const volKernelMm3 = Number.isFinite(volElegido) ? volElegido : K.volume(oc, shape);
    if (!(volKernelMm3 > 0)) throw new Error('STEP importado sin volumen (¿superficies sueltas, no un sólido?)');
    const tEnt = ahora();
    const t = K.tessellate(oc, shape, 0.1, 0.5);
    const tTes = ahora();
    if (!t.triangleCount) throw new Error('STEP importado pero la tesela salió vacía');
    let solidos = entrada ? entrada.solidos : solids.length;
    if (!entrada && !solids.length) try {
      const ex = new oc.TopExp_Explorer_2(crudo, oc.TopAbs_ShapeEnum.TopAbs_SOLID, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
      while (ex.More()) { solidos++; ex.Next(); }
    } catch { solidos = 0; }
    const notas = [`STEP: ${t.triangleCount} triángulos teselados (deflexión 0.1 mm) · volumen exacto del kernel ${volKernelMm3.toFixed(1)} mm³`];
    const eligio = o.solido != null && solidos > 1;
    if (solidos > 1 && entrada) notas.push(eligio
      ? `el archivo trae ${solidos} sólidos (un ENSAMBLE): se mide y se moldea el que elegiste (n.º ${entrada.indice + 1}), ${entrada.elegido.volCc} cc — los otros ${solidos - 1} quedan fuera`
      : `el archivo trae ${solidos} sólidos (un ENSAMBLE): mientras eliges, se mide la pieza MAYOR, ${entrada.elegido.volCc} cc — los otros ${solidos - 1} quedan fuera`);
    else if (solidos > 1) notas.push(`⚠ el archivo trae ${solidos} sólidos y se están midiendo FUSIONADOS (la entrada no pudo separarlos)`);
    else if (solidos === 0) notas.push('⚠ no se pudo contar sólidos en este STEP (se mide la forma completa)');
    if (entrada?.giro) notas.push(`parada en su eje de apertura: ${entrada.giro}`);
    const mesh = { positions: t.positions, indices: t.indices };
    // LA PUERTA sobre la MISMA malla que verá el Foco. Si salió abierta, se le pregunta al kernel por el SÓLIDO (BRepCheck,
    // medido 0.2–1.2 s: solo se paga cuando hace falta) — la grieta de nuestra tesela no es culpa del cliente.
    const mat = matriculaDeMalla(mesh);
    const med = medirMalla(mesh, mat);
    let brepValido: boolean | null = null;
    if (med.malla.estado === 'abierta') {
      try { const an = new oc.BRepCheck_Analyzer(shape, true); brepValido = !!(an.IsValid_2 ? an.IsValid_2() : an.IsValid_1()); an.delete?.(); } catch { brepValido = null; }
    }
    const elegido = entrada ? entrada.indice : 0;
    const puerta = armarPuerta({ fuente: 'step', malla: { ...med.malla, brepValido, volteadaCorregida: false },
      cuerpos: { lista, elegido, confirmado: solidos <= 1 || eligio }, unidades: { ...med.unidades, respuesta: null },
      contrasalidas: med.contrasalidas, ms: Math.round(ahora() - t0),
      tiempos: { importarMs: Math.round(tImp - t0), entradaMs: Math.round(tEnt - tImp), teselaMs: Math.round(tTes - tEnt), puertaMs: Math.round(ahora() - tTes) } });
    return { mesh, fuente: 'step', solidos, volKernelMm3, notas, entrada, puerta };
  }
  throw new Error(`extensión no soportada: "${ext || nombre}". El cargador acepta .stl, .step y .stp`);
}

/**
 * MALLA → LO QUE DIBUJA EL VISOR (T1: "revisar ESTA pieza, dentro del CAD").
 * ============================================================================
 * El renderer del CAD (`SolidMesh`) consume un `TessellatedMesh` del kernel:
 * posiciones + NORMALES + índices + faceIds/faceGroups. Un STL trae la sopa de
 * triángulos y nada más, así que aquí se completa lo que falta:
 *  · normales POR CARA replicadas a sus 3 vértices — que es exactamente lo
 *    correcto para un STL (facetado plano; suavizar mentiría sobre la malla).
 *  · un faceId por triángulo. Un STL NO tiene caras topológicas, así que se
 *    declara UNA sola "cara" (0): mejor una verdad pobre que inventar caras
 *    que el archivo no trae. Lo que dependa de caras reales pedirá un STEP.
 * Sin esto, una malla del operador no puede mostrarse en el visor y la revisión
 * se queda en una estampa al lado del CAD — el defecto que ian reportó.
 */
export interface MallaVisor {
  positions: Float32Array; normals: Float32Array; indices: Uint32Array;
  vertexCount: number; triangleCount: number;
  faceIds: Uint32Array;
  faceGroups: Array<{ faceId: number; start: number; count: number }>;
}
export function mallaParaElVisor(mesh: MeshLike): MallaVisor {
  const P = mesh.positions instanceof Float32Array ? mesh.positions : new Float32Array(mesh.positions);
  const I = mesh.indices instanceof Uint32Array ? mesh.indices : new Uint32Array(mesh.indices);
  const nTri = Math.floor(I.length / 3);
  const normals = new Float32Array(P.length);
  for (let t = 0; t < nTri; t++) {
    const a = I[t * 3] * 3, b = I[t * 3 + 1] * 3, c = I[t * 3 + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L; ny /= L; nz /= L;
    for (const o of [a, b, c]) { normals[o] += nx; normals[o + 1] += ny; normals[o + 2] += nz; }
  }
  // normalizar el acumulado (vértices compartidos promedian; en STL crudo cada
  // vértice pertenece a UN triángulo, así que queda la normal de su cara)
  for (let i = 0; i < normals.length; i += 3) {
    const L = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    normals[i] /= L; normals[i + 1] /= L; normals[i + 2] /= L;
  }
  return {
    positions: P, normals, indices: I,
    vertexCount: Math.floor(P.length / 3), triangleCount: nTri,
    faceIds: new Uint32Array(nTri),                                  // una sola "cara": el STL no trae topología
    faceGroups: [{ faceId: 0, start: 0, count: I.length }],
  };
}

/** Caja mínima de una malla (mm) — para encuadrar la cámara y para el gate. */
export function bboxDeMalla(mesh: MeshLike): { min: [number, number, number]; max: [number, number, number]; centro: [number, number, number]; diagonal: number } {
  const P = mesh.positions;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < P.length; i += 3) {
    if (P[i] < x0) x0 = P[i]; if (P[i] > x1) x1 = P[i];
    if (P[i + 1] < y0) y0 = P[i + 1]; if (P[i + 1] > y1) y1 = P[i + 1];
    if (P[i + 2] < z0) z0 = P[i + 2]; if (P[i + 2] > z1) z1 = P[i + 2];
  }
  return {
    min: [x0, y0, z0], max: [x1, y1, z1],
    centro: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
    diagonal: Math.hypot(x1 - x0, y1 - y0, z1 - z0),
  };
}
