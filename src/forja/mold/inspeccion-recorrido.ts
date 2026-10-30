/**
 * LA INSPECCIÓN · EL RECORRIDO — el paso 7 del pipeline: la máquina revisa tu molde, capítulo por capítulo del libro.
 * ============================================================================
 * ian (2026-10-22): «el análisis del video del inspector no es algo aparte: es parte del pipeline».
 * KAZMER (revisión de la película, 2026-10-27, `Downloads/la-pelicula/kazmer/LA-INSPECCION-SEGUN-KAZMER.md`):
 *   «La película sí. La inspección todavía no: muestra cuatro palomitas y se salta los cuatro rojos.»
 * ORDEN I (2026-10-29, «va» de ian): los rojos se ven, la pieza siempre presente, un corte por lo medido.
 *
 * EL RECORRIDO (en el orden de los capítulos del libro; cada punto: 2 s de CONTEXTO —el molde completo con el punto
 * marcado— y luego el MACRO, con la pieza presente, sólida o en fantasma, y un corte que pasa por lo medido):
 *   0. El dictamen ........................ cuántos criterios y cuántos ✗, leídos del dictamen VIVO (no se fijan cuatro)
 *   1. La colada (cap 6) .................. ΔP contra su presupuesto y los dos relojes (bebedero contra pared), corte por el eje
 *   2. La compuerta (cap 7) ............... SOLO si su ✗ sale: el número contra el límite y la mejor vista (falta su sólido: se dice)
 *   3. Qué manda el ciclo (cap 9) ......... corte por un poste con el campo de ENFRIAMIENTO + el agua acotada línea por línea (H, W)
 *   4. Menos acero junto al agua (cap 9) .. el par más justo del Foco, con la placa de contexto y el CLARO del dictamen al lado
 *   5. Los botadores en su agarre (cap 11)  pieza en fantasma, cada pin con su fuerza y su pared; la fuerza total contra la máquina
 *   6. Abre, sale y empuja (§6.3.1) ....... UNA apertura (la del molde que se corta), la carrera contra su caja
 *   7. La placa de soporte (cap 12) ....... la flecha contra el venteo, deformada ×N sobre sus pilares
 *   8. La máquina (§4.3.3) ................ cierre, ancho con tapones contra barras, daylight y disparo — con cotas, sin máquina 3D
 *   ·  cualquier otro ✗ del dictamen ...... su número contra su límite en su capítulo, con lo que falta rotulado
 *   9. El cierre .......................... cada ✗ con la decisión que pide, y lo que NO se revisó
 * Cada punto trae la pregunta, el número de HOY, su límite, el veredicto, la frase física y lo que la escena dibuja — de UNA
 * sola verdad: el número que se lee es el del motor/dictamen, y la cota que se ve es la distancia que se juzga.
 *
 * Puro: entra lo que el estudio ya calculó (piezas del molde en el marco del molde, mm; el dictamen; la lente; las estaciones),
 * sale el recorrido. Nada aquí recalcula física: solo lee, mide geometría y arma la pregunta.
 */
import { crucesVerticales, cuerposDe, type PiezaMolde, type ResultadoFoco } from './foco-molde';
import { tituloCorto, type ContratoReporte, type Criterio } from './mold-contratos';

type V3 = [number, number, number];

export type Veredicto = 'ok' | 'falla' | 'aviso';
export interface MarcaRecorrido {
  tipo: 'punto' | 'cruz' | 'circulo' | 'linea';
  p: V3; color: Veredicto | 'neutro' | 'pin'; r?: number;
  /** solo `linea`: la polilínea (marco del molde) */
  pts?: V3[];
  /** [desde, hasta] en s desde que arranca el MACRO: una sobreimpresión que dura poco (el centroide de Hefestos, 2 s) */
  ventana?: [number, number];
}
/** Una barra de la tarjeta: el número de hoy contra su límite, con el mismo color del veredicto. */
export interface BarraRecorrido {
  etiqueta: string; valor: number; unidad: string;
  /** el tope (max) o el piso (min) contra el que se juzga */
  limite?: number; tipo?: 'max' | 'min';
  veredicto: Veredicto | 'neutro';
  /** lo que va a la derecha del número (p. ej. «de 150 t · 26 %») */
  nota?: string;
}
/** Un rótulo DOM pegado a un punto 3D (marco del molde): «EP-01 · 485 N». */
export interface Etiqueta3D { p: V3; texto: string; color: Veredicto | 'neutro' | 'pin' }
export interface CamaraRecorrido { az: number; el: number; r: number; objetivo: V3 }
export interface PuntoRecorrido {
  id: string;
  /** el capítulo del libro al que pertenece («Colada · cap 6») */
  capitulo: string;
  pregunta: string;
  /** el número que se juzga, con su unidad y su límite, en una línea */
  numero: string;
  limite: string;
  veredicto: Veredicto;
  /** el rótulo del veredicto cuando «de panzazo» no es lo que pasa (p. ej. «manda el bebedero»): el color sigue siendo el del veredicto */
  textoVeredicto?: string;
  /** qué pasa físicamente → el número de hoy → el límite (el estilo que ian aprobó) */
  frase: string;
  regla: string;
  /** los ✗ del dictamen VIVO que este punto enseña (títulos cortos) */
  rojos?: string[];
  barras?: BarraRecorrido[];
  /** lo que la vista NO tiene todavía (se rotula, no se esconde) */
  falta?: string;
  /** lo exagerado lleva su «×N» */
  exagera?: string;
  /** lo que se dibuja */
  marcas: MarcaRecorrido[];
  cotas: Array<{ a: V3; b: V3; etiqueta: string; ok?: boolean }>;
  etiquetas?: Etiqueta3D[];
  /** dónde se marca el punto durante los 2 s de contexto (molde completo) */
  contexto: V3;
  /** segundos que dura el punto (contexto + macro): el ritmo lo marca la lectura de la tarjeta */
  dur: number;
  /** la pieza va pintada con el campo de una lente (la de ENFRIAMIENTO) */
  pinta?: 'enfriamiento';
  /** la vista: qué se aísla (y qué queda tenue), el corte y la cámara (az, el, r, objetivo) */
  vista: {
    roles: string[]; tenues?: string[]; opacs?: Record<string, number>;
    corte?: { eje: 'x' | 'y' | 'z'; mm: number; voltea?: boolean } | null;
    camara: CamaraRecorrido;
    /** un segundo encuadre a los `en` s del macro (p. ej. del poste al corte entero con el agua) */
    camara2?: CamaraRecorrido & { en: number };
    /** el punto anima la pose del molde (abre-sale-empuja) */
    anima?: 'abre-expulsa';
  };
}

const caja = (p: PiezaMolde) => {
  const P = p.positions; const mn: V3 = [1e18, 1e18, 1e18], mx: V3 = [-1e18, -1e18, -1e18];
  for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; }
  return { mn, mx };
};
const cajaDe = (ps: PiezaMolde[]) => {
  const mn: V3 = [1e18, 1e18, 1e18], mx: V3 = [-1e18, -1e18, -1e18];
  for (const p of ps) { const b = caja(p); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], b.mn[k]); mx[k] = Math.max(mx[k], b.mx[k]); } }
  return { mn, mx };
};
const centro = (b: { mn: V3; mx: V3 }): V3 => [(b.mn[0] + b.mx[0]) / 2, (b.mn[1] + b.mx[1]) / 2, (b.mn[2] + b.mx[2]) / 2];
const f0 = (x: number) => x.toFixed(0), f1 = (x: number) => x.toFixed(1), f2 = (x: number) => x.toFixed(2);
const fN = (x: number) => Math.round(x).toLocaleString('es-MX');
const sinPlatinas = (piezas: PiezaMolde[]) => piezas.filter((p) => !p.role.startsWith('platina'));
/** EL LADO DE LA CARA DEL CORTE (medido con los ojos, 2026-10-29): `inspeccion.corte` conserva el lado − del eje y su cara mira a
 *  +eje; la órbita pone az 0 en −Y del molde (three z = −y CAD). Con az 0 en un corte en Y la cámara miraba el lado de AFUERA de lo
 *  que quedó (las líneas de agua venían hacia la lente y la pieza era su cara exterior). Aquí sale el az que ve la cara cortada. */
export function azDelCorte(eje: 'x' | 'y', voltea = false): number {
  return eje === 'y' ? (voltea ? 0 : 180) : (voltea ? -90 : 90);
}

/** La CÁMARA DE CONTEXTO de Kazmer: «primero 2 s de contexto con el molde completo y el punto marcado». La usan todos los puntos. */
export function camaraDeContexto(piezas: PiezaMolde[]): CamaraRecorrido {
  const b = cajaDe(sinPlatinas(piezas));
  const d = Math.hypot(b.mx[0] - b.mn[0], b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]);
  return { az: 34, el: 24, r: Math.max(160, d * 1.25), objetivo: centro(b) };
}

/* ───────────────────────── EL DICTAMEN VIVO ───────────────────────── */

export interface RojoDictamen { id: string; titulo: string; subsistema: string; cita: string; medido?: number; limite?: number; unidad?: string; detalle: string }
/** Los ✗ del dictamen VIVO, en el orden de sus subsistemas. NO se fijan cuatro: la orden H re-juzga en paralelo y el conjunto
 *  cambia (CLARO puede pasar a ✓). Lo que llegue aquí es lo que la inspección enseña. */
export function rojosDelDictamen(c: ContratoReporte | null | undefined): RojoDictamen[] {
  if (!c) return [];
  return c.subsistemas.flatMap((s) => s.criterios.filter((k) => k.estado === 'VIOLA').map((k) => ({
    id: k.id, titulo: tituloCorto(k.id), subsistema: k.subsistema, cita: k.cita, medido: k.medido, limite: k.limite, unidad: k.unidad, detalle: k.detalle,
  })));
}
const criterio = (c: ContratoReporte | null | undefined, id: string): Criterio | undefined => c?.subsistemas.flatMap((s) => s.criterios).find((k) => k.id === id);
const esRojo = (k?: Criterio) => k?.estado === 'VIOLA';
/** los títulos de los ✗ (de esta lista de ids) que el punto ENSEÑA: así un rojo con vista propia no se repite como «sin vista» */
const rojosDe = (c: ContratoReporte | null | undefined, ids: string[]) => ids.map((id) => criterio(c, id)).filter((k) => esRojo(k)).map((k) => tituloCorto(k!.id));
const verDe = (k?: Criterio): Veredicto => (k?.estado === 'VIOLA' ? 'falla' : k?.estado === 'ADVIERTE' ? 'aviso' : 'ok');

/** 0 · EL DICTAMEN — «69 criterios, 4 no cumplen; los vas a ver cada uno en su capítulo». */
export function puntoDelDictamen(piezas: PiezaMolde[], c: ContratoReporte | null | undefined): PuntoRecorrido | null {
  if (!c) return null;
  const R = rojosDelDictamen(c), t = c.total;
  const cam = camaraDeContexto(piezas);
  return {
    id: 'dictamen', capitulo: 'El dictamen · cap 13', pregunta: '¿Qué reglas no cumple tu molde?',
    numero: `${R.length} de ${t.criterios} no cumplen`, limite: `${t.cumple} cumplen · ${t.advierte} de panzazo`, veredicto: R.length ? 'falla' : 'ok',
    frase: R.length
      ? `El dictamen revisó ${t.criterios} reglas del libro: ${R.length} no cumplen (${R.map((r) => r.titulo).join(', ')}). Vas a ver cada una en su capítulo, con su número contra su límite.`
      : `El dictamen revisó ${t.criterios} reglas del libro y ninguna sale en rojo. Lo que va de panzazo se ve en su capítulo.`,
    regla: 'el juez de contratos de Kazmer (69 criterios con su §) — leído del dictamen vivo, no de una lista fija',
    rojos: R.map((r) => r.titulo),
    marcas: [], cotas: [], contexto: cam.objetivo, dur: 6.5,
    vista: { roles: ['*'], corte: null, camara: cam },
  };
}

/* ───────────────────────── 1 · LA COLADA (cap 6) ───────────────────────── */

/** LA COLADA EN UN CORTE (Kazmer §3, el S 1): ΔP contra su presupuesto y los dos relojes, bebedero contra pared. Los dos ✗ dependen
 *  del MISMO diámetro (p.149: «the diameter of the sprue can be reduced albeit with a higher pressure drop») — son UNA decisión. */
export function laColada(piezas: PiezaMolde[], c: ContratoReporte | null | undefined): PuntoRecorrido | null {
  const col = piezas.find((p) => p.role === 'colada'), pz = piezas.find((p) => p.role === 'pieza');
  const dp = criterio(c, 'feed-dp'), ci = criterio(c, 'feed-ciclo');
  if (!col || !pz || (!dp && !ci)) return null;
  const B = caja(col), P = caja(pz); const cc = centro(B);
  const Lc = B.mx[2] - B.mn[2];
  const v: Veredicto = esRojo(dp) || esRojo(ci) ? 'falla' : verDe(dp) === 'aviso' || verDe(ci) === 'aviso' ? 'aviso' : 'ok';
  const barras: BarraRecorrido[] = [];
  if (dp?.medido != null && dp.limite != null) barras.push({ etiqueta: 'presión que se come la colada', valor: dp.medido, unidad: 'MPa', limite: dp.limite, tipo: 'max', veredicto: verDe(dp), nota: `presupuesto ${f1(dp.limite)}` });
  if (ci?.medido != null && ci.limite != null) {
    barras.push({ etiqueta: 'reloj del bebedero (enfría)', valor: ci.medido, unidad: 's', limite: ci.limite, tipo: 'max', veredicto: verDe(ci), nota: 'barra · Eq 9.6' });
    barras.push({ etiqueta: 'reloj de la pared de tu pieza', valor: ci.limite, unidad: 's', veredicto: 'neutro', nota: 'placa · Eq 9.5' });
  }
  // EL BEBEDERO QUE SE JUZGA vs EL QUE SE CORTA (orden B lo vio, la orden H los une): si difieren, se DICE en pantalla
  const mDict = /⌀\s*([\d.]+)\s*mm,\s*sprue L=([\d.]+)/.exec(dp?.detalle ?? '');
  const mDib = /⌀([\d.]+)→⌀([\d.]+)/.exec(col.name ?? '');
  const dosBebederos = mDict && mDib && Math.abs(+mDict[1] - +mDib[2]) > 0.05 * +mDib[2]
    ? `Dos bebederos: el dictamen juzgó ⌀${(+mDict[1]).toFixed(2)} × ${(+mDict[2]).toFixed(1)} mm; se corta ⌀${(+mDib[2]).toFixed(2)} × ${f1(Lc)} sobre la pieza.`
    : '';
  const frase = [
    dp?.medido != null && dp.limite != null
      ? `El plástico pierde ${f1(dp.medido)} MPa solo en el bebedero; el libro le da ${f1(dp.limite)}${esRojo(dp) ? ', y se pasa' : ''}.` : '',
    ci?.medido != null && ci.limite != null
      ? `Y el bebedero tarda ${f0(ci.medido)} s en ponerse firme contra ${f1(ci.limite)} s de la pared: ${ci.medido > ci.limite ? 'él manda el ciclo' : 'la pieza manda el ciclo'}.` : '',
    esRojo(dp) || esRojo(ci) ? 'Los dos dependen del mismo diámetro: más delgado enfría antes, pero se come más presión.' : '',
  ].filter(Boolean).join(' ');
  return {
    id: 'colada', capitulo: 'Colada · cap 6', pregunta: '¿La colada se come la presión y manda el ciclo?',
    numero: dp?.medido != null ? `${f1(dp.medido)} MPa en la colada` : `${f0(ci!.medido ?? 0)} s el bebedero`,
    limite: dp?.limite != null ? `presupuesto ${f1(dp.limite)} MPa` : `pared ${f1(ci?.limite ?? 0)} s`, veredicto: v,
    frase, rojos: [dp, ci].filter((k) => esRojo(k)).map((k) => tituloCorto(k!.id)),
    regla: '§6.4 p.132: «no greater than 50% of the pressure required to fill the mold cavities or 50 MPa» · §6.4.7 p.148: «…greatly exceeds the cooling time of the mold cavities… redesign the feed system» · p.149: «can be reduced albeit with a higher pressure drop»',
    falta: dosBebederos ? `${dosBebederos} El número es el del dictamen (los une la orden «un veredicto»).` : undefined,
    barras,
    marcas: [{ tipo: 'punto', p: [cc[0], cc[1], B.mn[2]], color: v }],
    cotas: [{ a: [B.mx[0] + 6, cc[1], B.mn[2]], b: [B.mx[0] + 6, cc[1], B.mx[2]], etiqueta: 'bebedero sobre la pieza' }],
    contexto: cc, dur: 15,
    vista: {
      roles: ['colada', 'pieza', 'cavidad', 'clamp', 'anillo', 'placa-a-ghost'], tenues: ['nucleo', 'placa-b-ghost'],
      opacs: { colada: 1, pieza: 0.9, cavidad: 0.35, clamp: 0.3, anillo: 0.35, 'placa-a-ghost': 0.12 },
      corte: { eje: 'y', mm: cc[1] },
      camara: { az: azDelCorte('y'), el: 8, r: Math.max(220, (B.mx[2] - P.mn[2]) * 2.4), objetivo: [cc[0], cc[1], (B.mx[2] + P.mn[2]) / 2] },
    },
  };
}

/* ───────────────────────── 2 · LA COMPUERTA (cap 7) ───────────────────────── */

/** LA COMPUERTA QUE SE CONGELA — solo entra si su criterio NO cumple. Es M en Kazmer (falta el sólido 3D de la compuerta):
 *  va su número contra el límite y la mejor vista que existe — el pie del bebedero sobre la pieza, en el mismo corte. */
export function laCompuerta(piezas: PiezaMolde[], c: ContratoReporte | null | undefined): PuntoRecorrido | null {
  const fr = criterio(c, 'gate-freeze');
  if (!fr || fr.estado === 'CUMPLE' || fr.medido == null || fr.limite == null) return null;
  const col = piezas.find((p) => p.role === 'colada'), pz = piezas.find((p) => p.role === 'pieza');
  if (!col || !pz) return null;
  const B = caja(col); const pie: V3 = [(B.mn[0] + B.mx[0]) / 2, (B.mn[1] + B.mx[1]) / 2, B.mn[2]];
  const v = verDe(fr);
  return {
    id: 'compuerta', capitulo: 'Compuerta · cap 7', pregunta: '¿La compuerta deja empacar?',
    numero: `se congela a los ${f1(fr.medido)} s`, limite: `el empaque pide ${f1(fr.limite)} s`, veredicto: v,
    frase: `Mientras la pieza se encoge al enfriar, la máquina sigue metiendo plástico por la compuerta. Se congela a los ${f1(fr.medido)} s y la pieza pide ${f1(fr.limite)} s de empaque: ${fr.medido < fr.limite ? 'se cierra antes y la pieza se encoge de más (rechupes).' : 'alcanza.'}`,
    regla: '§7.3.4 p.179 tiempo de congelación · §7.1.5: «the dimensions should be adjusted even if the shear rates and pressure drops were found acceptable» · §7.3.5 en orden: empaque, compuerta más gruesa, pieza más delgada',
    rojos: esRojo(fr) ? [tituloCorto(fr.id)] : [],
    falta: 'Falta el sólido 3D de la compuerta: la vista es el pie del bebedero, donde el plástico entra a tu pieza.',
    barras: [{ etiqueta: 'la compuerta se congela', valor: fr.medido, unidad: 's', limite: fr.limite, tipo: 'min', veredicto: v, nota: `pide ${f1(fr.limite)}` }],
    marcas: [{ tipo: 'punto', p: pie, color: v, r: 1.2 }],
    cotas: [], contexto: pie, dur: 11,
    vista: {
      roles: ['colada', 'pieza', 'cavidad'], tenues: ['nucleo'], opacs: { colada: 1, pieza: 0.85, cavidad: 0.3 },
      corte: { eje: 'y', mm: pie[1] },
      camara: { az: azDelCorte('y'), el: 12, r: 150, objetivo: pie },
    },
  };
}

/* ───────────────────────── 3 · QUÉ MANDA EL CICLO (cap 9) ───────────────────────── */

/** La transformación del marco del STEP (donde vive la lente) al del molde: la pieza entra VOLTEADA (π sobre x) y trasladada
 *  (`volteaMalla`, useMoldStudio). Se deduce de las dos cajas y se COMPRUEBA: si las medidas no casan (pieza re-orientada), null —
 *  y la vista lo dice en vez de cortar en otro lado. */
export function transformadaPieza(step: ArrayLike<number>, molde: ArrayLike<number>): { aMolde: (p: V3) => V3; aStep: (p: V3) => V3 } | null {
  const bb = (P: ArrayLike<number>) => { const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); } return { mn, mx }; };
  const S = bb(step), M = bb(molde);
  for (let k = 0; k < 3; k++) if (Math.abs((S.mx[k] - S.mn[k]) - (M.mx[k] - M.mn[k])) > 0.6) return null;
  const tx = M.mn[0] - S.mn[0], ty = M.mn[1] + S.mx[1], tz = M.mn[2] + S.mx[2];
  return { aMolde: (p) => [p[0] + tx, -p[1] + ty, -p[2] + tz], aStep: (p) => [p[0] - tx, ty - p[1], tz - p[2]] };
}

/** Pinta la pieza del molde con los colores de la lente (vértice más cercano en el marco del STEP). La malla del molde no es la
 *  misma teselación que la de la lente (13,280 contra 6,074 vértices en la 1594C), así que se busca por cercanía en una rejilla. */
export function pintaDesdeLente(molde: ArrayLike<number>, step: ArrayLike<number>, colores: ArrayLike<number>, aStep: (p: V3) => V3): Float32Array {
  const h = 4; const cel = new Map<string, number[]>();
  const key = (x: number, y: number, z: number) => `${Math.floor(x / h)},${Math.floor(y / h)},${Math.floor(z / h)}`;
  for (let i = 0; i < step.length / 3; i++) { const k = key(step[i * 3], step[i * 3 + 1], step[i * 3 + 2]); const a = cel.get(k); if (a) a.push(i); else cel.set(k, [i]); }
  const out = new Float32Array(molde.length);
  for (let v = 0; v < molde.length / 3; v++) {
    const q = aStep([molde[v * 3], molde[v * 3 + 1], molde[v * 3 + 2]]);
    const cx = Math.floor(q[0] / h), cy = Math.floor(q[1] / h), cz = Math.floor(q[2] / h);
    let best = -1, bd = 1e18;
    for (let r = 1; r <= 4 && best < 0; r++) {
      for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (let k = -r; k <= r; k++) {
        const a = cel.get(`${cx + i},${cy + j},${cz + k}`); if (!a) continue;
        for (const s of a) { const d = (step[s * 3] - q[0]) ** 2 + (step[s * 3 + 1] - q[1]) ** 2 + (step[s * 3 + 2] - q[2]) ** 2; if (d < bd) { bd = d; best = s; } }
      }
    }
    if (best >= 0) { out[v * 3] = colores[best * 3]; out[v * 3 + 1] = colores[best * 3 + 1]; out[v * 3 + 2] = colores[best * 3 + 2]; }
    else { out[v * 3] = 0.25; out[v * 3 + 1] = 0.28; out[v * 3 + 2] = 0.32; }
  }
  return out;
}

/** La SECCIÓN de una malla por el plano eje = mm: segmentos 2D en los otros dos ejes (u, w). */
function seccion(p: PiezaMolde, eje: 0 | 1 | 2, mm: number): Array<[number, number, number, number]> {
  const P = p.positions; const n = Math.floor(P.length / 3);
  const I = p.indices && p.indices.length ? p.indices : Array.from({ length: n }, (_, i) => i);
  const u = eje === 0 ? 1 : 0, w = eje === 2 ? 1 : 2; const segs: Array<[number, number, number, number]> = [];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const vs = [I[t], I[t + 1], I[t + 2]].map((i) => [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]]);
    const pts: Array<[number, number]> = [];
    for (let a = 0; a < 3; a++) {
      const A = vs[a], Bv = vs[(a + 1) % 3]; const da = A[eje] - mm, db = Bv[eje] - mm;
      if ((da < 0 && db >= 0) || (da >= 0 && db < 0)) { const k = da / (da - db); pts.push([A[u] + k * (Bv[u] - A[u]), A[w] + k * (Bv[w] - A[w])]); }
    }
    if (pts.length === 2) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]]);
  }
  return segs;
}
function masCercano(segs: Array<[number, number, number, number]>, pu: number, pw: number): { d: number; u: number; w: number } | null {
  let best: { d: number; u: number; w: number } | null = null;
  for (const [a, b, c, d] of segs) {
    const vx = c - a, vy = d - b, L2 = vx * vx + vy * vy;
    const k = L2 > 0 ? Math.max(0, Math.min(1, ((pu - a) * vx + (pw - b) * vy) / L2)) : 0;
    const x = a + k * vx, y = b + k * vy, dd = Math.hypot(pu - x, pw - y);
    if (!best || dd < best.d) best = { d: dd, u: x, w: y };
  }
  return best;
}

export interface CicloDeLaLente { gruesoMm: number; barraS: number; placaS: number; paredMm: number; paredS: number; lugares: number }
/** 3 · ¿QUÉ MANDA EL CICLO? (Kazmer §3, el S 2) — corte por un poste con el campo térmico de ENFRIAMIENTO, y en el MISMO corte el
 *  agua: profundidad 2D < H < 5D (Eq 9.22, p.213) y paso H < W < 2H (Eq 9.24, p.214), acotados línea por línea.
 *  H se MIDE en el acero dibujado: del centro de la línea a la cara de la pieza más cercana en ese corte (la «cooling line depth»
 *  de la Fig 9.4); W entre centros vecinos de la misma fila. Las líneas que no ven la pieza (H > 2·5D) se nombran, no se acotan. */
export function queMandaElCiclo(piezas: PiezaMolde[], o: {
  lente: CicloDeLaLente | null; posteMolde: V3 | null; colada?: Criterio; aguaProf?: Criterio; aguaPaso?: Criterio;
  /** el CLARO del dictamen: su límite es ½·⌀ EXACTO del agua que juzgó (el «H 19.1 = 2.00×⌀» del detalle viene redondeado: daba ⌀9.6) */
  aguaClaro?: Criterio;
}): PuntoRecorrido | null {
  const pz = piezas.find((p) => p.role === 'pieza'); if (!pz || !o.lente) return null;
  const P = caja(pz); const L = o.lente;
  // el corte: por el poste (y = la del poste), perpendicular a las líneas que corren en Y (las del macho y dos de la cavidad)
  const poste: V3 = o.posteMolde ?? centro(P);
  const yc = poste[1];
  const segs = seccion(pz, 1, yc);
  // las líneas de agua que el corte atraviesa de frente: su eje largo es Y y su tramo contiene yc
  const lineas = piezas.filter((p) => /^agua-[AB]-/.test(p.role) && !/tapon|oring|baffle|lamina/.test(p.role)).map((p) => {
    const b = caja(p); const ext = [b.mx[0] - b.mn[0], b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]];
    const largo = ext.indexOf(Math.max(...ext));
    // el ⌀ del NOMBRE («⌀6.35»): la caja de un cilindro teselado mide 6.3–6.4 según la cara
    const mD = /⌀([\d.]+)/.exec(p.name ?? '');
    return { role: p.role, b, largo, d: mD ? +mD[1] : Math.min(ext[0], ext[2]) };
  }).filter((l) => l.largo === 1 && l.b.mn[1] <= yc && l.b.mx[1] >= yc).map((l) => {
    const cx = (l.b.mn[0] + l.b.mx[0]) / 2, cz = (l.b.mn[2] + l.b.mx[2]) / 2;
    const m = masCercano(segs, cx, cz);
    return { ...l, cx, cz, H: m?.d ?? Infinity, cara: m ? [m.u, yc, m.w] as V3 : null };
  }).sort((a, b) => a.cz - b.cz || a.cx - b.cx);
  const D = lineas.length ? lineas[0].d : 0;
  const lo = 2 * D, hi = 5 * D;
  const cotas: PuntoRecorrido['cotas'] = []; const lejos: string[] = [];
  const nombre = (r: string) => r.replace(/^agua-/, '').replace(/-linea/, '-');
  for (const l of lineas) {
    if (!l.cara || !Number.isFinite(l.H)) continue;
    if (l.H > 2 * hi) { lejos.push(`${nombre(l.role)} (${f0(l.H)} mm)`); continue; }
    cotas.push({ a: [l.cx, yc, l.cz], b: l.cara, etiqueta: `H ${nombre(l.role)}`, ok: l.H >= lo && l.H <= hi });
  }
  // W: vecinos de la misma fila (misma z ± 1 mm), solo entre las acotadas
  const acot = lineas.filter((l) => l.cara && l.H <= 2 * hi);
  for (let i = 1; i < acot.length; i++) {
    const a = acot[i - 1], b = acot[i]; if (Math.abs(a.cz - b.cz) > 1) continue;
    const W = Math.abs(b.cx - a.cx), Hm = Math.max(a.H, b.H);
    cotas.push({ a: [a.cx, yc, a.cz - 9], b: [b.cx, yc, b.cz - 9], etiqueta: `W`, ok: W >= Math.min(a.H, b.H) && W <= 2 * Hm });
  }
  const tcCol = o.colada?.medido;
  const manda = Math.max(L.barraS, L.paredS, tcCol ?? 0);
  const quien = tcCol != null && tcCol >= L.barraS && tcCol >= L.paredS ? 'el bebedero' : L.barraS >= L.paredS ? 'los postes' : 'la pared';
  const barras: BarraRecorrido[] = [
    { etiqueta: `la pared de ${f1(L.paredMm)} mm`, valor: L.paredS, unidad: 's', veredicto: 'neutro', nota: 'placa · Eq 9.5' },
    { etiqueta: `un poste de ${f1(L.gruesoMm)} mm (barra)`, valor: L.barraS, unidad: 's', veredicto: 'aviso', nota: `hasta ${f0(L.placaS)} como placa (cota alta)` },
  ];
  if (tcCol != null) barras.push({ etiqueta: 'el bebedero', valor: tcCol, unidad: 's', veredicto: verDe(o.colada), nota: 'barra · Eq 9.6' });
  const malas = cotas.filter((k) => k.ok === false).length;
  // ¿el dictamen juzgó la MISMA agua que se dibuja? (su H/⌀ trae el ⌀: «H 19.1 mm = 2.00×⌀» → ⌀9.53 contra ⌀6.35 dibujado)
  const mH = /H ([\d.]+) mm = ([\d.]+)×⌀/.exec(o.aguaProf?.detalle ?? '');
  const dDict = o.aguaClaro?.limite != null ? 2 * o.aguaClaro.limite : mH && +mH[2] > 0 ? +mH[1] / +mH[2] : null;
  const aguaDict = dDict != null && D > 0 && Math.abs(dDict - D) > 0.1 && o.aguaPaso?.detalle
    ? `El dictamen juzgó otra agua: ⌀${f2(dDict)}, ${o.aguaProf!.detalle.split(' · ')[0]}, ${o.aguaPaso.detalle.split(' · ')[0]}.` : '';
  return {
    id: 'ciclo', capitulo: 'Enfriamiento · cap 9', pregunta: '¿Qué manda el ciclo, y el agua está donde enfría?',
    numero: `${f0(manda)} s manda ${quien}`, limite: `la pared sola: ${f1(L.paredS)} s`, veredicto: manda > 1.25 * L.paredS ? 'aviso' : 'ok',
    textoVeredicto: manda > 1.25 * L.paredS ? `◇ ${quien.startsWith('los ') ? 'MANDAN' : 'MANDA'} ${quien.toUpperCase()}` : undefined,
    frase: `El molde no abre hasta que lo más grueso esté firme: tu pared de ${f1(L.paredMm)} mm tarda ${f1(L.paredS)} s; ${L.lugares > 1 ? `los ${L.lugares} postes` : 'el poste'} de ${f1(L.gruesoMm)} mm, como barra, ${f0(L.barraS)} s${tcCol != null ? `; el bebedero, ${f0(tcCol)} s` : ''}. Manda ${quien}. `
      + `En el corte, el agua: H de ${f1(lo)} a ${f1(hi)} mm (⌀${f2(D)}) y W entre H y 2H —`
      + (malas ? ` ${malas} cota${malas > 1 ? 's' : ''} fuera.` : ' todas dentro.') + (lejos.length ? ` Lejos de la pieza: ${lejos.join(', ')}.` : ''),
    falta: aguaDict ? `${aguaDict} La une la orden «un veredicto».` : undefined,
    regla: '§9.2.1 p.203: «consider the thickest section» · poste = barra (Eq 9.6), pared = placa (Eq 9.5) · Eq 9.22 p.213: 2D < H < 5D · Eq 9.24 p.214: H < W < 2H · H del centro de la línea a la cara de la pieza, en este corte',
    barras, pinta: 'enfriamiento',
    rojos: [o.aguaProf, o.aguaPaso].filter((k) => esRojo(k)).map((k) => tituloCorto(k!.id)),
    marcas: [{ tipo: 'punto', p: poste, color: 'aviso', r: 2.2 }],
    cotas, contexto: poste, dur: 18,
    vista: {
      roles: ['pieza', 'agua-A-*', 'agua-B-*'], tenues: ['nucleo', 'cavidad', 'placa-a-ghost', 'placa-b-ghost'],
      opacs: { pieza: 1, nucleo: 0.1, cavidad: 0.1 },
      corte: { eje: 'y', mm: yc },
      camara: { az: azDelCorte('y'), el: 8, r: 150, objetivo: [poste[0], yc, (P.mn[2] + P.mx[2]) / 2] },
      camara2: { az: azDelCorte('y'), el: 4, r: Math.max(300, (lineas.length ? Math.max(...lineas.map((l) => l.cx)) - Math.min(...lineas.map((l) => l.cx)) : 120) * 1.35), objetivo: [(P.mn[0] + P.mx[0]) / 2, yc, (P.mn[2] + P.mx[2]) / 2 - 10], en: 6.5 },
    },
  };
}

/* ───────────────────────── 4 · MENOS ACERO JUNTO AL AGUA (cap 9) ───────────────────────── */

/** 4 · ¿DÓNDE QUEDA MENOS ACERO JUNTO AL AGUA? — el par más justo que midió el Foco (eje↔eje, menos radios), arrancando con la
 *  placa de contexto y la pieza en fantasma, y con el CLARO del dictamen al lado: «Y debe coincidir con el dictamen» (Kazmer §2.10).
 *  Si no coinciden, la pantalla dice qué mide cada uno — no elige a escondidas. */
export function aguaMasJusta(foco: ResultadoFoco | null, c?: ContratoReporte | null, piezas?: PiezaMolde[]): PuntoRecorrido | null {
  const m = foco?.masJusto; if (!m) return null;
  const v: Veredicto = m.acero < 0 ? 'falla' : m.acero < m.limite ? 'falla' : m.acero < m.limite + 0.5 ? 'aviso' : 'ok';
  const u: V3 = [m.c2[0] - m.c1[0], m.c2[1] - m.c1[1], m.c2[2] - m.c1[2]]; const n = Math.hypot(...u) || 1;
  const s1: V3 = [m.c1[0] + u[0] / n * m.rA, m.c1[1] + u[1] / n * m.rA, m.c1[2] + u[2] / n * m.rA];
  const s2: V3 = [m.c2[0] - u[0] / n * m.rB, m.c2[1] - u[1] / n * m.rB, m.c2[2] - u[2] / n * m.rB];
  const eje = m.ejeAgua === 0 ? 'x' : m.ejeAgua === 1 ? 'y' : 'z';
  // LA PIEZA SIEMPRE PRESENTE (medido 2026-10-29): el par más justo vive en la esquina de la base (interlock 4) y el corte conservaba
  // el lado de ESA esquina — se llevaba la pieza entera. Se conserva el lado donde está la pieza y la cámara ve la cara del corte.
  const pzC = (() => { const pz = (piezas ?? []).find((p) => p.role === 'pieza'); return pz ? centro(caja(pz)) : null; })();
  const voltea = !!pzC && m.ejeAgua !== 2 && pzC[m.ejeAgua] > m.lugar[m.ejeAgua];
  const cl = criterio(c, 'agua-claro');
  // ¿en qué placa está? la placa de CONTEXTO es la que contiene el lugar (Kazmer: «que se vea en qué placa está»)
  const placas = (piezas ?? []).filter((p) => /^(placa-[ab]-ghost|cavidad|nucleo|clamp|support)$/.test(p.role));
  const enPlaca = placas.find((p) => { const b = caja(p); return [0, 1, 2].every((k) => m.lugar[k] >= b.mn[k] - 0.5 && m.lugar[k] <= b.mx[k] + 0.5); });
  const nombrePlaca = enPlaca ? (enPlaca.name ?? enPlaca.role).split(/[—·(]/)[0].replace(/\s*\d+(\.\d+)?×\d+(\.\d+)?×\d+(\.\d+)?/, '').trim() : '';
  const dict = cl?.medido != null && cl.limite != null
    ? (Math.abs(cl.medido - m.acero) < 0.05 && Math.abs(cl.limite - m.limite) < 0.05
      ? ` El dictamen mide lo mismo: ${f2(cl.medido)} contra ${f2(cl.limite)}.`
      : ` El dictamen, antes de armar el molde, midió ${f2(cl.medido)} contra ${f2(cl.limite)}${Math.abs(cl.limite - m.limite) > 0.05 ? ` con otra agua (⌀${f2(2 * cl.limite)}; aquí ⌀${f2(2 * m.limite)})` : ' en otro par'}${esRojo(cl) ? ': por eso sale en rojo' : ''}.`)
    : '';
  return {
    id: 'agua-justa', capitulo: 'Enfriamiento · cap 9', pregunta: '¿Dónde queda menos acero junto al agua?',
    numero: `${f2(m.acero)} mm de acero`, limite: `mínimo ${f2(m.limite)} mm`, veredicto: v,
    frase: (m.acero < 0
      ? `${m.nombreA} atraviesa ${m.nombreB}: se meten ${f2(-m.acero)} mm. En la máquina es una fuga y una pieza atorada.`
      : `El punto más justo del molde${nombrePlaca ? `, en la ${nombrePlaca.replace(/^placa\s*/i, 'placa ')}` : ''}: entre ${m.nombreA} y ${m.nombreB} quedan ${f2(m.acero)} mm de acero; el mínimo es ${f2(m.limite)}. ${v === 'ok' ? 'Cumple con margen.' : v === 'aviso' ? 'Cumple, de panzazo.' : 'No cumple.'}`) + dict,
    regla: '§9.2.7 p.216: «at least half a cooling diameter between the surface of the cooling line and the surface of any other mold component» · distancia eje a eje entre cilindros exactos, menos los dos radios',
    rojos: esRojo(cl) ? [tituloCorto(cl!.id)] : [],
    marcas: [{ tipo: 'punto', p: m.lugar, color: v }],
    cotas: [{ a: s1, b: s2, etiqueta: 'acero que queda', ok: v !== 'falla' }],
    contexto: m.lugar, dur: 12,
    vista: {
      roles: [m.roleA, m.roleB, 'pieza'], tenues: enPlaca ? [enPlaca.role] : [],
      opacs: { [m.roleA]: 0.9, [m.roleB]: 0.85, pieza: 0.4, ...(enPlaca ? { [enPlaca.role]: 0.1 } : {}) },
      corte: { eje, mm: m.lugar[m.ejeAgua], voltea },
      camara: { az: eje === 'z' ? 0 : azDelCorte(eje, voltea), el: eje === 'z' ? 80 : 12, r: 90, objetivo: m.lugar },
      // el segundo encuadre se abre hacia la pieza: el objetivo a medio camino entre el par y el centro de la pieza
      camara2: { az: eje === 'z' ? 0 : azDelCorte(eje, voltea), el: 20, r: pzC ? Math.max(230, 1.6 * Math.hypot(pzC[0] - m.lugar[0], pzC[1] - m.lugar[1], pzC[2] - m.lugar[2])) : 210,
        objetivo: pzC ? [(m.lugar[0] + pzC[0]) / 2, (m.lugar[1] + pzC[1]) / 2, (m.lugar[2] + pzC[2]) / 2] : m.lugar, en: 5.5 },
    },
  };
}

/* ───────────────────────── 5 · LOS BOTADORES EN SU AGARRE (cap 11) ───────────────────────── */

export interface PinesDeLaE10 {
  n: number; fPorPinN: number; fEjectN: number;
  filas: Array<{ id: string; x: number; y: number; zPisoMm: number }>;
  equilibrio?: { desvioMm: number; topeMm: number; ok: boolean };
}
/** distancia de un punto a un triángulo (3D) */
function dPuntoTri(p: V3, a: V3, b: V3, c: V3): number {
  const sub = (u: V3, v: V3): V3 => [u[0] - v[0], u[1] - v[1], u[2] - v[2]]; const dot = (u: V3, v: V3) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const ab = sub(b, a), ac = sub(c, a), ap = sub(p, a);
  const d1 = dot(ab, ap), d2 = dot(ac, ap); if (d1 <= 0 && d2 <= 0) return Math.hypot(...ap);
  const bp = sub(p, b), d3 = dot(ab, bp), d4 = dot(ac, bp); if (d3 >= 0 && d4 <= d3) return Math.hypot(...bp);
  const vc = d1 * d4 - d3 * d2; if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); return Math.hypot(...sub(p, [a[0] + v * ab[0], a[1] + v * ab[1], a[2] + v * ab[2]])); }
  const cp = sub(p, c), d5 = dot(ab, cp), d6 = dot(ac, cp); if (d6 >= 0 && d5 <= d6) return Math.hypot(...cp);
  const vb = d5 * d2 - d1 * d6; if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); return Math.hypot(...sub(p, [a[0] + w * ac[0], a[1] + w * ac[1], a[2] + w * ac[2]])); }
  const va = d3 * d6 - d5 * d4; if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); return Math.hypot(...sub(p, [b[0] + w * (c[0] - b[0]), b[1] + w * (c[1] - b[1]), b[2] + w * (c[2] - b[2])])); }
  const den = 1 / (va + vb + vc), v = vb * den, w = vc * den;
  return Math.hypot(...sub(p, [a[0] + ab[0] * v + ac[0] * w, a[1] + ab[1] * v + ac[1] * w, a[2] + ab[2] * v + ac[2] * w]));
}
/** 5 · ¿CADA BOTADOR ESTÁ DONDE SE PEGA? (Kazmer §3, el S 5) — la pieza en fantasma sobre el macho tenue, vista desde abajo; cada pin
 *  con su fuerza y la distancia a la PARED VERTICAL de tu pieza más cercana (lo que §11.2.5 p.273 pide: «ribs and bosses will tend to
 *  shrink onto the core and so require nearby ejector pins»). La fuerza total contra la que da la máquina (§11.2.2 p.269). El centro
 *  de los pines (regla de Hefestos) va de sobreimpresión 2.5 s: no es el número estrella (Kazmer §4). */
export function botadoresEnSuAgarre(piezas: PiezaMolde[], e10: PinesDeLaE10 | null, maq: { nombre: string; expulsionKN: number; cierreT: number } | null, c?: ContratoReporte | null): PuntoRecorrido | null {
  const pz = piezas.find((p) => p.role === 'pieza'); if (!pz || !e10 || !e10.filas.length) return null;
  const B = caja(pz); const Pp = pz.positions; const nV = Math.floor(Pp.length / 3);
  const I = pz.indices && pz.indices.length ? pz.indices : Array.from({ length: nV }, (_, i) => i);
  const vt = (i: number): V3 => [Pp[i * 3], Pp[i * 3 + 1], Pp[i * 3 + 2]];
  // solo caras VERTICALES (|nz| < 0.5): paredes, nervios y postes — el piso de la pieza no agarra
  const verticales: Array<[V3, V3, V3]> = [];
  for (let t = 0; t + 2 < I.length; t += 3) {
    const a = vt(I[t]), b = vt(I[t + 1]), c = vt(I[t + 2]);
    const n: V3 = [(b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])];
    const ln = Math.hypot(...n) || 1; if (Math.abs(n[2] / ln) < 0.5) verticales.push([a, b, c]);
  }
  const etiquetas: Etiqueta3D[] = []; const marcas: MarcaRecorrido[] = []; const dists: number[] = [];
  for (const f of e10.filas) {
    // la distancia de la PUNTA (en su piso, a media pared hacia la boca) a la pared vertical más cercana
    let d = Infinity;
    for (const zf of [f.zPisoMm - 2, f.zPisoMm - 8]) for (const [a, b, c] of verticales) d = Math.min(d, dPuntoTri([f.x, f.y, zf], a, b, c));
    dists.push(d);
    const corto = f.id.replace(/^.*-(EP-\d+)$/, '$1');
    etiquetas.push({ p: [f.x, f.y, f.zPisoMm], texto: `${corto} · ${fN(e10.fPorPinN)} N · pared a ${f1(d)} mm`, color: 'pin' });
    marcas.push({ tipo: 'punto', p: [f.x, f.y, f.zPisoMm], color: 'pin', r: 2.0 });
  }
  // el centro de los pines y el del área (regla de Hefestos): sobreimpresión de 2.5 s al arrancar el macro
  const cP: V3 = [e10.filas.reduce((s, f) => s + f.x, 0) / e10.filas.length, e10.filas.reduce((s, f) => s + f.y, 0) / e10.filas.length, B.mn[2]];
  if (e10.equilibrio) {
    const ok = e10.equilibrio.ok;
    marcas.push({ tipo: 'circulo', p: cP, r: e10.equilibrio.topeMm, color: ok ? 'ok' : 'falla', ventana: [0, 2.5] });
    marcas.push({ tipo: 'cruz', p: cP, color: 'neutro', ventana: [0, 2.5] });
  }
  const FkN = e10.fEjectN / 1000;
  const v: Veredicto = maq && FkN > maq.expulsionKN ? 'falla' : 'ok';
  const barras: BarraRecorrido[] = [];
  if (maq) {
    barras.push({ etiqueta: `fuerza para despegar contra la ${maq.nombre.split(' (')[0]}`, valor: FkN, unidad: 'kN', limite: maq.expulsionKN, tipo: 'max', veredicto: v, nota: `da ${f1(maq.expulsionKN)} kN` });
    barras.push({ etiqueta: 'lo típico de una máquina: 2 % del cierre', valor: 0.02 * maq.cierreT * 9.80665, unidad: 'kN', veredicto: 'neutro', nota: `2 % de ${f0(maq.cierreT)} t` });
  }
  const dmax = Math.max(...dists);
  return {
    id: 'botadores', capitulo: 'Expulsión · cap 11', pregunta: '¿Cada botador está donde se pega tu pieza?',
    numero: `${f1(FkN)} kN para despegarla`, limite: maq ? `la máquina da ${f1(maq.expulsionKN)} kN` : 'sin máquina', veredicto: v,
    frase: `Al enfriar, tu pieza abraza el macho: hay que empujarla con ${fN(e10.fEjectN)} N. Cada uno de los ${e10.n} botadores carga ${fN(e10.fPorPinN)} N junto a una pared (el más lejos, a ${f1(dmax)} mm)`
      + (maq ? `. La máquina empuja con ${f1(maq.expulsionKN)} kN: le sobra.` : '.'),
    regla: '§11.2.5 p.273: «ribs and bosses will tend to shrink onto the core and so require nearby ejector pins» · §11.2.2 p.269: la máquina da «typically 2% of the clamp tonnage»'
      + (e10.equilibrio ? ` · el círculo (2 s): centro de los pines a ${f2(e10.equilibrio.desvioMm)} mm del de la pieza, tope 0.1·L = ${f2(e10.equilibrio.topeMm)}, regla de Hefestos` : ''),
    rojos: rojosDe(c, ['eject-fuerza', 'eject-layout', 'eject-driver', 'eject-acero-minimo']),
    barras, etiquetas, marcas, cotas: [], contexto: [cP[0], cP[1], (B.mn[2] + B.mx[2]) / 2], dur: 15,
    vista: {
      // solo las PUNTAS (las que tocan la pieza): desde abajo los cuerpos ⌀4.76 tapaban todo (captura 2026-10-29)
      roles: ['pieza', 'pin-punta-*'], tenues: ['nucleo'], opacs: { pieza: 0.32, nucleo: 0.1 },
      corte: null,
      camara: { az: 20, el: -55, r: Math.max(B.mx[0] - B.mn[0], B.mx[1] - B.mn[1]) * 2.3, objetivo: [cP[0], cP[1], (B.mn[2] + B.mx[2]) / 2] },
    },
  };
}

/* ───────────────────────── 6 · ABRE, SALE Y EMPUJA (§6.3.1 · §4.3.2) ───────────────────────── */

/** 6 · ¿ABRE, SALE Y EMPUJA? — UNA apertura: la del molde que se corta. La animación y este número salen de la MISMA función
 *  (`carreraDeApertura`: 2.5·H de pieza, §6.3.2 «two to three times the height», + el bebedero que se dibuja sobre ella) y se LEEN
 *  del molde abierto (`animZ`). El selector de máquina del paquete numérico usaba un bebedero ESTIMADO (placa A 60 + sujeción de 1"
 *  = 85.4 desde la partición) y daba 135.4: el bebedero que se corta mide lo que la sujeción superior + la placa A dibujadas
 *  (§6.3.1 p.123: «the length of the sprue is determined by the combined thicknesses of the top clamp plate and the A plate»).
 *  Lo que se PIDE: sacar la pieza con su colada (§6.3.1 p.123 «after the mold has opened sufficiently to remove the moldings»;
 *  Tabla 6.1 p.129: el molde de dos placas del libro abre 75 mm) + 10 mm de holgura (regla de Hefestos). La expulsora recorre lo
 *  hondo de la pieza (§4.3.2 p.81) y tiene que caber en su caja. */
export function abreSaleEmpuja(piezas: PiezaMolde[], o: { aperturaReal: number | null; carreraLibre: number | null; carreraPedida: number | null; aperturaMotor?: number | null }): PuntoRecorrido | null {
  const pz = piezas.find((p) => p.role === 'pieza'), col = piezas.find((p) => p.role === 'colada');
  if (!pz) return null;
  const B = caja(pz), H = B.mx[2] - B.mn[2], Lc = col ? caja(col).mx[2] - caja(col).mn[2] : 0;
  const pide = H + Lc + 10;
  const ab = o.aperturaReal, okA = ab != null && ab >= pide;
  const okC = o.carreraLibre != null && o.carreraPedida != null && o.carreraLibre >= o.carreraPedida;
  const v: Veredicto = okA && okC ? 'ok' : 'falla';
  const cx = (B.mn[0] + B.mx[0]) / 2, cy = (B.mn[1] + B.mx[1]) / 2;
  const motor = o.aperturaMotor != null && ab != null && Math.abs(o.aperturaMotor - ab) > 0.5
    ? ` (El selector de máquina usó ${f1(o.aperturaMotor)} con un bebedero estimado; el que se corta es éste.)` : '';
  return {
    id: 'abre-sale-empuja', capitulo: 'Expulsión · §6.3.1', pregunta: '¿Abre, sale y empuja?',
    numero: ab != null ? `abre ${f1(ab)} mm` : 'apertura sin medir', limite: `pide ${f1(pide)} mm`, veredicto: v,
    frase: `El molde abre ${ab != null ? f1(ab) : '?'} mm; tu pieza con su bebedero necesita ${f1(pide)}${ab != null ? ` (le sobran ${f1(ab - pide)})` : ''}. La pieza se queda abrazada al macho y jala el bebedero fuera de la mitad fija. `
      + (o.carreraLibre != null && o.carreraPedida != null ? `Luego la placa expulsora sube ${f1(o.carreraPedida)} mm (lo hondo de tu pieza, ${f1(H)}, más el despegue) y su caja deja ${f1(o.carreraLibre)}: ${okC ? 'cabe' : 'NO cabe'}.` : '') + motor,
    regla: '§6.3.1 p.123: abre «sufficiently to remove the moldings»; el bebedero mide la sujeción superior + la placa A · Tabla 6.1 p.129: 75 mm en el molde de dos placas del libro · + 10 mm de holgura (regla de Hefestos) · §4.3.2 p.81: «the ejector travel is set to be equal to the depth of the molded part» · carrera ≤ caja expulsora (Fig 4.22)',
    marcas: [], cotas: [], contexto: [cx, cy, B.mx[2]], dur: 14,
    vista: { roles: ['*'], corte: { eje: 'y', mm: cy }, camara: { az: 0, el: 6, r: 520, objetivo: [cx, cy, B.mx[2]] }, anima: 'abre-expulsa' },
  };
}

/* ───────────────────────── 7 · LA PLACA DE SOPORTE (cap 12) ───────────────────────── */

export interface SoporteDelPaquete { deltaMm: number; venteoMm: number; nPilares: number; espesorMm: number; usoPct?: number; topePct?: number }
/** 7 · ¿LA PLACA DE SOPORTE SE DOBLA MENOS QUE EL VENTEO? (Kazmer §3, el S 4) — corte por la caja expulsora, la placa con su
 *  deformada EXAGERADA ×N (rotulada) apoyada en los rieles y en los pilares que el corte atraviesa, y la huella de la cavidad
 *  sobre ella (§12.2.3 p.312: los pilares van «directly under the portions of the mold cavity that generate significant force»).
 *  La forma entre apoyos es la de una viga con carga pareja (5/384); el NÚMERO es el del motor (Eq 12.10), no el dibujo. */
export function placaDeSoporte(piezas: PiezaMolde[], s: SoporteDelPaquete | null, c?: ContratoReporte | null): PuntoRecorrido | null {
  const sup = piezas.find((p) => p.role === 'support'), pz = piezas.find((p) => p.role === 'pieza');
  if (!sup || !pz || !s) return null;
  const S = caja(sup), P = caja(pz);
  const pil = piezas.find((p) => p.role === 'pilares-soporte'), rie = piezas.find((p) => p.role === 'rieles');
  const cuerposPil = pil ? cuerposDe(pil) : [];
  // el corte: por el pilar más cercano al centro de la huella (así la placa se ve APOYADA en él), si no por el centro
  const cP = centro(P);
  const pilC = cuerposPil.map((b) => [(b.min[0] + b.max[0]) / 2, (b.min[1] + b.max[1]) / 2, (b.max[0] - b.min[0]) / 2] as [number, number, number]);
  const yCorte = pilC.length ? pilC.reduce((a, b) => (Math.abs(b[1] - cP[1]) < Math.abs(a[1] - cP[1]) ? b : a))[1] : cP[1];
  // los apoyos: las caras interiores de los rieles y los pilares que el corte atraviesa
  const apoyos: number[] = [];
  if (rie) for (const b of cuerposDe(rie)) { const mid = (b.min[0] + b.max[0]) / 2; apoyos.push(mid < (S.mn[0] + S.mx[0]) / 2 ? b.max[0] : b.min[0]); }
  else apoyos.push(S.mn[0], S.mx[0]);
  for (const b of cuerposPil) if (b.min[1] <= yCorte && b.max[1] >= yCorte) apoyos.push((b.min[0] + b.max[0]) / 2);
  apoyos.sort((a, b) => a - b);
  // la deformada: tramos entre apoyos con la forma de una viga simplemente apoyada con carga pareja, solo donde la huella carga
  const zTop = S.mx[2]; const N = Math.max(100, Math.round(8 / Math.max(1e-6, s.deltaMm) / 100) * 100);
  const pts: V3[] = [];
  const forma = (xi: number) => (16 / 5) * (xi - 2 * xi ** 3 + xi ** 4);   // máx 1 en xi = ½
  let maxTramo = 0; const tramos: Array<[number, number, number]> = [];
  for (let i = 1; i < apoyos.length; i++) {
    const a = apoyos[i - 1], b = apoyos[i]; const carga = Math.max(0, Math.min(b, P.mx[0]) - Math.max(a, P.mn[0])) / (b - a);
    const amp = carga * (b - a) ** 4; tramos.push([a, b, amp]); maxTramo = Math.max(maxTramo, amp);
  }
  for (const [a, b, amp] of tramos) for (let k = 0; k <= 24; k++) {
    const xi = k / 24; const dz = maxTramo > 0 ? (amp / maxTramo) * s.deltaMm * N * forma(xi) : 0;
    pts.push([a + xi * (b - a), yCorte, zTop - dz]);
  }
  const huella: V3[] = [[P.mn[0], P.mn[1], zTop + 0.3], [P.mx[0], P.mn[1], zTop + 0.3], [P.mx[0], P.mx[1], zTop + 0.3], [P.mn[0], P.mx[1], zTop + 0.3], [P.mn[0], P.mn[1], zTop + 0.3]];
  const k = criterio(c, 'estr-deflexion-vs-venteo');
  const v: Veredicto = s.deltaMm > s.venteoMm ? 'falla' : k ? verDe(k) : 'ok';
  const pct = (100 * s.deltaMm) / s.venteoMm;
  return {
    id: 'placa-soporte', capitulo: 'Estructura · cap 12', pregunta: '¿La placa de soporte se dobla menos que el venteo?',
    numero: `se dobla ${s.deltaMm.toFixed(4)} mm`, limite: `venteo ≈ ${f2(s.venteoMm)} mm`, veredicto: v,
    frase: `Al inyectar, el plástico empuja el macho hacia abajo y la placa de soporte se dobla sobre la caja expulsora; si se dobla más que el venteo, se abre una rendija y sale rebaba. Hoy se dobla ${s.deltaMm.toFixed(4)} mm = ${f0(pct)} % del venteo, sobre ${s.nPilares} pilares bajo la cavidad.`,
    regla: '§12.1.2 p.304: venteo «typically on the order of 0.02 mm» · §12.2.3 p.312: pilares «directly under the portions of the mold cavity that generate significant force» · tope en % del venteo: regla de Hefestos · flecha del motor (Eq 12.10), forma de viga con carga pareja',
    exagera: `deformada ×${fN(N)}`,
    rojos: rojosDe(c, ['estr-deflexion-vs-venteo', 'estr-pilares', 'estr-flash-coherente']),
    barras: [{ etiqueta: 'flecha de la placa contra el venteo', valor: s.deltaMm, unidad: 'mm', limite: s.venteoMm, tipo: 'max', veredicto: v, nota: `${f0(pct)} %${s.topePct ? ` · tope ${f0(s.topePct)} % (Hefestos)` : ''}` }],
    marcas: [
      { tipo: 'linea', p: [cP[0], yCorte, zTop], pts, color: v },
      { tipo: 'linea', p: [cP[0], cP[1], zTop], pts: huella, color: 'neutro' },
      ...apoyos.map((x) => ({ tipo: 'punto' as const, p: [x, yCorte, zTop] as V3, color: 'neutro' as const, r: 1.8 })),
    ],
    cotas: [], contexto: [cP[0], yCorte, (S.mn[2] + S.mx[2]) / 2], dur: 13,
    vista: {
      roles: ['support', 'pilares-soporte', 'rieles', 'pieza', 'nucleo'], tenues: ['bottom', 'ejector', 'ejector-ret', 'placa-b-ghost'],
      opacs: { support: 0.55, 'pilares-soporte': 0.95, rieles: 0.6, pieza: 0.3, nucleo: 0.15 },
      corte: { eje: 'y', mm: yCorte },
      camara: { az: azDelCorte('y'), el: 10, r: Math.max(320, (S.mx[0] - S.mn[0]) * 1.45), objetivo: [(S.mn[0] + S.mx[0]) / 2, yCorte, S.mn[2] - 10] },
    },
  };
}

/* ───────────────────────── 8 · LA MÁQUINA (§4.3.3) ───────────────────────── */

export interface MaquinaDelPaquete {
  nombre: string; cierreT: number; cierreNecT: number; tieH: number; tieV: number; dayMin: number; dayMax: number;
  shotCc: number; shotNecCc: number; expulsionKN: number;
}
/** 8 · ¿CABE Y TRABAJA EN LA HT-150SV? (Kazmer §3, el S 8, con cotas; la máquina en 3D es M) — el cierre, el ancho del molde CON
 *  tapones contra las barras (§4.3.3 p.82 «including cooling plugs»), el daylight con la apertura de arriba (Fig 4.24) y el disparo
 *  dentro de la ventana cómoda (p.82: 120–250 cc de 490 en la Battenfeld del libro). El ancho y el alto se MIDEN del acero dibujado. */
export function laMaquina(piezas: PiezaMolde[], m: MaquinaDelPaquete | null, aperturaMm: number | null, dict?: ContratoReporte | null): PuntoRecorrido | null {
  if (!m) return null;
  const T = sinPlatinas(piezas); if (!T.length) return null;
  const b = cajaDe(T.filter((p) => p.role !== 'anillo'));   // el anillo centrador entra en la platina: no cuenta en el alto
  const ancho = b.mx[0] - b.mn[0], fondo = b.mx[1] - b.mn[1], alto = b.mx[2] - b.mn[2];
  const okBarras = ancho <= m.tieH && fondo <= m.tieV;
  const abierto = aperturaMm != null ? alto + aperturaMm : null;
  const okDay = abierto != null && abierto <= m.dayMax && alto >= m.dayMin;
  const pctCierre = (100 * m.cierreNecT) / m.cierreT, pctShot = (100 * m.shotNecCc) / m.shotCc;
  const okCierre = m.cierreNecT <= m.cierreT, enVentana = pctShot >= 25 && pctShot <= 50;
  const v: Veredicto = !okCierre || !okBarras || !okDay ? 'falla' : enVentana ? 'ok' : 'aviso';
  const c = centro(b);
  return {
    id: 'maquina', capitulo: 'La máquina · §4.3.3', pregunta: `¿Cabe y trabaja en la ${m.nombre.split(' (')[0]}?`,
    numero: `cierra con ${f1(m.cierreNecT)} t`, limite: `de ${f0(m.cierreT)} t · ${f0(pctCierre)} %`, veredicto: v,
    textoVeredicto: v === 'aviso' ? (pctShot < 25 ? '◇ CABE · BARRIL GRANDE' : '◇ CABE · BARRIL LLENO') : undefined,
    frase: `Necesita ${f1(m.cierreNecT)} t para no abrirse y la máquina da ${f0(m.cierreT)}. Con tapones mide ${f0(ancho)} × ${f0(fondo)} mm: pasa entre barras de ${f0(m.tieH)}. `
      + (abierto != null ? `Cerrado mide ${f0(alto)} mm; abierto, ${f0(abierto)}, y la máquina abre hasta ${fN(m.dayMax)}. ` : '')
      + `El disparo usa ${f0(pctShot)} % del barril${enVentana ? ': dentro de la ventana cómoda.' : `: ${pctShot < 25 ? 'abajo' : 'arriba'} de la ventana cómoda (25–50 %)${pctShot < 25 ? ', el plástico espera mucho tiempo caliente' : ''}.`}`,
    regla: '§4.3.3 p.82: el ancho entre barras «including cooling plugs» · Fig 4.24: daylight mínimo y máximo (aquí con el molde ABIERTO) · p.82: disparo cómodo 120–250 cc de 490 · Eq 5.29 el cierre · ancho y alto medidos del acero dibujado',
    falta: 'La máquina en 3D no está (es otra orden): van sus números con las cotas del molde.',
    rojos: rojosDe(dict, ['layout-maquina', 'layout-shot-ventana', 'layout-ancho-con-plugs', 'llenado-tonelaje']),
    barras: [
      { etiqueta: 'cierre', valor: m.cierreNecT, unidad: 't', limite: m.cierreT, tipo: 'max', veredicto: okCierre ? 'ok' : 'falla', nota: `de ${f0(m.cierreT)} · ${f0(pctCierre)} %` },
      { etiqueta: 'ancho con tapones', valor: Math.max(ancho, fondo), unidad: 'mm', limite: Math.min(m.tieH, m.tieV), tipo: 'max', veredicto: okBarras ? 'ok' : 'falla', nota: `barras ${f0(m.tieH)}` },
      ...(abierto != null ? [{ etiqueta: 'alto con el molde abierto', valor: abierto, unidad: 'mm', limite: m.dayMax, tipo: 'max' as const, veredicto: (okDay ? 'ok' : 'falla') as Veredicto, nota: `${f0(alto)} + ${f1(aperturaMm!)}` }] : []),
      { etiqueta: 'disparo del barril', valor: pctShot, unidad: '%', limite: 50, tipo: 'max', veredicto: enVentana ? 'ok' : 'aviso', nota: `${f0(m.shotNecCc)} de ${f0(m.shotCc)} cc · cómodo 25–50` },
    ],
    marcas: [], etiquetas: [],
    cotas: [
      { a: [b.mn[0], b.mn[1] - 14, b.mx[2]], b: [b.mx[0], b.mn[1] - 14, b.mx[2]], etiqueta: `ancho · barras ${f0(m.tieH)}`, ok: okBarras },
      { a: [b.mx[0] + 14, b.mn[1], b.mn[2]], b: [b.mx[0] + 14, b.mn[1], b.mx[2]], etiqueta: 'alto cerrado', ok: alto >= m.dayMin },
    ],
    contexto: c, dur: 13,
    vista: {
      roles: ['*'], corte: null,
      camara: { az: 0, el: 14, r: Math.max(ancho, alto) * 2.1, objetivo: c },
      // cenital: el molde completo con aire alrededor (a ×2.0 la sujeción superior llenaba media pantalla y se cortaba, captura 2026-10-29)
      camara2: { az: 0, el: 88, r: Math.max(ancho, fondo) * 2.7, objetivo: c, en: 6.5 },
    },
  };
}

/* ───────────────────────── · CUALQUIER OTRO ✗ ───────────────────────── */

const CAPITULO: Record<string, string> = {
  'alimentación': 'Colada · cap 6', venteo: 'Venteo · cap 8', enfriamiento: 'Enfriamiento · cap 9', 'expulsión': 'Expulsión · cap 11',
  estructural: 'Estructura · cap 12', llenado: 'Llenado · cap 5', gates: 'Compuerta · cap 7', layout: 'La máquina · cap 4',
  costo: 'Costo · cap 3', 'contracción': 'Contracción · cap 10',
};
const ROLES_DE: Record<string, string[]> = {
  'alimentación': ['colada', 'pieza'], venteo: ['pieza', 'particion'], enfriamiento: ['agua-A-*', 'agua-B-*', 'pieza'], 'expulsión': ['pieza', 'pin-punta-*', 'pin-cuerpo-*'],
  estructural: ['support', 'pilares-soporte', 'pieza'], llenado: ['pieza', 'colada'], gates: ['colada', 'pieza'], 'contracción': ['pieza', 'cavidad', 'nucleo'],
};
/** Un ✗ del dictamen que NO tiene punto propio: su número contra su límite, en su capítulo, con la mejor vista que existe
 *  (lo de su subsistema aislado, la pieza presente) y lo que falta rotulado. Así ningún rojo se queda sin verse. */
export function rojoSinVista(piezas: PiezaMolde[], r: RojoDictamen): PuntoRecorrido {
  const roles = (ROLES_DE[r.subsistema] ?? ['*']);
  const presentes = piezas.filter((p) => roles.some((q) => (q.endsWith('*') ? p.role.startsWith(q.slice(0, -1)) : p.role === q)));
  const b = cajaDe(presentes.length ? presentes : sinPlatinas(piezas)); const c = centro(b);
  const d = Math.hypot(b.mx[0] - b.mn[0], b.mx[1] - b.mn[1], b.mx[2] - b.mn[2]);
  const u = r.unidad ? ` ${r.unidad}` : '';
  return {
    id: `rojo-${r.id}`, capitulo: CAPITULO[r.subsistema] ?? r.subsistema, pregunta: `${r.titulo}: ¿qué no cumple?`,
    numero: r.medido != null ? `${f2(r.medido)}${u}` : 'no cumple', limite: r.limite != null ? `límite ${f2(r.limite)}${u}` : r.cita, veredicto: 'falla',
    frase: r.detalle.length > 260 ? r.detalle.slice(0, 257).replace(/\s+\S*$/, '') + '…' : r.detalle,
    regla: `${r.cita} — criterio del dictamen`, rojos: [r.titulo],
    falta: 'Este rojo todavía no tiene su vista en 3D: va su número contra su límite y lo de su capítulo aislado.',
    marcas: [{ tipo: 'punto', p: c, color: 'falla', r: 2.4 }], cotas: [], contexto: c, dur: 10,
    vista: { roles: roles.includes('*') ? ['*'] : [...roles, 'pieza'], opacs: { pieza: 0.6 }, corte: null, camara: { az: 30, el: 22, r: Math.max(160, d * 1.3), objetivo: c } },
  };
}

/* ───────────────────────── 9 · EL CIERRE ───────────────────────── */

/** La decisión que pide cada ✗ (lo que el libro dice que se haga). Lo que no esté aquí lleva su propio criterio. */
const DECISION: Record<string, string> = {
  'feed-dp': 'el diámetro del bebedero (una sola decisión con COLADA VS CICLO): más delgado acorta su reloj y sube su caída; o colada caliente',
  'feed-ciclo': 'el mismo diámetro: el bebedero no debe mandar el ciclo (§6.4.7)',
  'gate-freeze': 'en este orden: subir el empaque, engrosar la compuerta, adelgazar la pieza (§7.3.5)',
  'agua-claro': 'aclarar qué agua juzga el dictamen contra la que se barrena; con la que se barrena el peor acero sale arriba',
};
export function cierreDeLaInspeccion(piezas: PiezaMolde[], rojos: RojoDictamen[], vistos: string[]): PuntoRecorrido {
  const cam = camaraDeContexto(piezas);
  const decs = rojos.map((r) => `${r.titulo}: ${DECISION[r.id] ?? r.detalle.split(/ — | · /)[0]}`);
  // los rayos del techo del macho: coherencia del CAD, no regla del libro (Kazmer §4) — una línea aquí, no un punto propio
  const ry = rejillaDelMacho(piezas);
  const rayos = ry && ry.total ? ` Coherencia del CAD (no es regla del libro): el techo del macho toca tu pieza en ${ry.tocan} de ${ry.total} rayos, uno cada ${f1(ry.pasoX)} × ${f1(ry.pasoY)} mm.` : '';
  return {
    id: 'cierre', capitulo: 'El cierre', pregunta: rojos.length ? `${rojos.length} ${rojos.length === 1 ? 'rojo pide' : 'rojos piden'} una decisión` : 'Ningún rojo',
    numero: `${rojos.length} por decidir`, limite: `${vistos.filter((v) => v !== 'dictamen').length} puntos revisados`, veredicto: rojos.length ? 'falla' : 'ok',
    frase: (decs.length ? decs.join(' · ') + '.' : 'El dictamen no tiene rojos: lo de panzazo quedó en su capítulo.') + rayos,
    regla: 'NO se revisó aquí: el llenado animado y el último punto en llenar · el venteo en el acero · la compuerta como sólido · la contracción con que se corta el acero · la máquina en 3D · agua contra agua y pines contra guías',
    rojos: rojos.map((r) => r.titulo),
    marcas: [], cotas: [], contexto: cam.objetivo, dur: 12,
    vista: { roles: ['*'], corte: null, camara: { ...cam, az: cam.az + 18, el: cam.el + 4 } },
  };
}

/* ───────────────────────── la rejilla del techo del macho (coherencia del CAD) ───────────────────────── */

/** EL TECHO DEL MACHO TOCA TU PIEZA — rejilla de rayos verticales. Kazmer (§4 de su revisión): «es coherencia del CAD y no lo trato
 *  en el libro» → ya no es un punto propio del recorrido; su resultado va al CIERRE como una línea. Puro, como siempre. */
export function rejillaDelMacho(piezas: PiezaMolde[], nx = 10, ny = 5): { tocan: number; total: number; pasoX: number; pasoY: number } | null {
  const pz = piezas.find((p) => p.role === 'pieza'), nu = piezas.find((p) => p.role === 'nucleo');
  if (!pz || !nu) return null;
  const B = caja(pz), N = caja(nu);
  const z0 = Math.min(B.mn[2], N.mn[2]) - 1;
  let tocan = 0, huecos = 0;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = B.mn[0] + (B.mx[0] - B.mn[0]) * (0.06 + 0.88 * (i + 0.5) / nx);
    const y = B.mn[1] + (B.mx[1] - B.mn[1]) * (0.06 + 0.88 * (j + 0.5) / ny);
    const o: V3 = [x + 1e-4, y + 2e-4, z0];
    const zp = crucesVerticales(pz, o, 1).map((d) => z0 + d);
    const zn = crucesVerticales(nu, o, 1).map((d) => z0 + d);
    if (zp.length < 2 || !zn.length) continue;
    const techo = Math.max(...zn);
    if (Math.min(...zp.map((z) => Math.abs(z - techo))) <= 0.5) tocan++; else huecos++;
  }
  return { tocan, total: tocan + huecos, pasoX: (0.88 * (B.mx[0] - B.mn[0])) / nx, pasoY: (0.88 * (B.mx[1] - B.mn[1])) / ny };
}

/** El RECORRIDO entero, en el orden de los capítulos: los puntos con vista propia y, en su capítulo, cada ✗ que no la tenga. */
export function armarRecorrido(P: Array<PuntoRecorrido | null>, piezas: PiezaMolde[], rojos: RojoDictamen[]): PuntoRecorrido[] {
  const puntos = P.filter((x): x is PuntoRecorrido => !!x);
  // el dictamen (0) y el cierre NOMBRAN todos los rojos pero no los ENSEÑAN: no cuentan como vista
  const cubiertos = new Set(puntos.filter((p) => p.id !== 'dictamen' && p.id !== 'cierre').flatMap((p) => p.rojos ?? []));
  const huerfanos = rojos.filter((r) => !cubiertos.has(r.titulo)).map((r) => rojoSinVista(piezas, r));
  // cada huérfano entra DESPUÉS del último punto de su capítulo (o antes de la máquina si su capítulo no tiene punto)
  const out = [...puntos];
  for (const h of huerfanos) {
    let at = -1; out.forEach((p, i) => { if (p.capitulo.split(' · ')[0] === h.capitulo.split(' · ')[0]) at = i; });
    if (at < 0) at = Math.max(0, out.findIndex((p) => p.id === 'maquina') - 1);
    out.splice(at + 1, 0, h);
  }
  return out;
}
