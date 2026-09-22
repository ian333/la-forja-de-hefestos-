/**
 * LOS SIETE CAPÍTULOS DE DON CHUY — la cuenta de cada video, hecha función.
 * ============================================================================
 * Quien llega a `chuy.html?c=NN` acaba de ver 40 s de un vendedor de naranjas y
 * una cuenta que le cuadró en la cabeza. Esta página le da la MISMA cuenta con
 * SUS números. Así que aquí no hay curvas inventadas ni multiplicadores mágicos:
 * cada `calcular()` es la aritmética que la voz dice en el video, literal.
 *
 * Fuente de verdad de los números y de las frases:
 *   /home/ian/Orkesta/lia-video-engine/projects/economia/negocio/<NN-slug>/guion.json
 * Si un guion cambia, este archivo cambia con él — no al revés.
 *
 * Es un `.ts` sin React a propósito: las fórmulas se pueden leer (y discutir)
 * sin abrir un componente, y la página solo las pinta.
 */

// ── Formato de dinero ────────────────────────────────────────────────────────
// Un peso siempre se ve igual en toda la página: separador de miles, sin
// centavos (nadie fía $10.50 de naranjas) y el signo ANTES del $ cuando falta
// dinero, porque «-$200» se lee de un golpe y «$-200» no.
const MILES = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });

export function money(n: number): string {
  const v = Number.isFinite(n) ? Math.round(n) : 0;
  return (v < 0 ? "-$" : "$") + MILES.format(Math.abs(v));
}

/** Para contar cosas (naranjas, vecinos), donde el $ estorbaría. */
export function num(n: number): string {
  return MILES.format(Number.isFinite(n) ? Math.round(n) : 0);
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export type Campo = {
  id: string;
  /** Lo que se lee arriba del cuadro. En segunda persona: es SU negocio. */
  etiqueta: string;
  /** El número de Don Chuy: la precarga. Se entra con la cuenta ya cuadrada. */
  valor: number;
  /** `$` o `%` pegado al cuadro; los conteos no llevan ninguno. */
  prefijo?: "$" | "%";
  /** Unidad chiquita a la derecha ("naranjas", "vecinos"). */
  unidad?: string;
  /**
   * Ocupa la fila COMPLETA de la cuadrícula. No es cosmético: en dos columnas,
   * los campos se leen de a pares, y un par mal armado MIENTE (poner «a ese
   * precio vendes 100» junto a «si lo subes a $12» sugiere que las 100 son al
   * precio nuevo). Con esto, el campo suelto se aparta y cada fila es un par.
   */
  ancho?: boolean;
};

export type Color = "rojo" | "ambar" | "verde";

export type Resultado = {
  /** La cifra que va en la pastilla sobre la lata. Es el resultado del capítulo. */
  lata: number;
  color: Color;
  /** Una o dos líneas que explican la cifra. Nunca tres: esto se lee de pie. */
  lineas: string[];
  /** El letrerito del precio en el mantel, cuando el capítulo habla de precios. */
  letrero?: { texto: string; antes?: string };
  /** Cuántas naranjas de la pila se dibujan podridas (capítulo de la merma). */
  podridas?: number;
};

export type Capitulo = {
  /** `00`…`06`, tal como llega en `?c=`. */
  id: string;
  /** La carpeta del guion, para poder rastrear de dónde salió cada número. */
  slug: string;
  /** El gancho del video, para que reconozca de dónde viene. */
  hook: string;
  /** La idea en una línea. Es el título de la página. */
  frase: string;
  /** El encabezado de la cuenta editable. */
  pregunta: string;
  campos: Campo[];
  calcular: (v: Record<string, number>) => Resultado;
  /** Un objeto extra del dibujo, cuando el capítulo lo pide. */
  escena?: "casa" | "basura";
  /** Un pie corto, para lo que no cabe en una cuenta (el Nobel de Yunus). */
  nota?: string;
};

/** Los inputs vacíos llegan como NaN: un campo en blanco vale 0, no «roto». */
const n0 = (x: number | undefined) => (Number.isFinite(x) ? (x as number) : 0);

export const CAPITULOS: Capitulo[] = [
  // ══════════════════════════════════════════════════════════════════════════
  // 00 — EL FIADO. Vende las 100 y se va con $0 porque cobró solo la mitad.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "00",
    slug: "00-el-fiado",
    hook: "Vendió todo… y $0",
    frase: "Vender no es cobrar.",
    pregunta: "¿Y en tu negocio?",
    campos: [
      { id: "piezas", etiqueta: "Cuántas te deja el proveedor", valor: 100, unidad: "naranjas" },
      { id: "costo", etiqueta: "Lo que te cobra el proveedor", valor: 500, prefijo: "$" },
      { id: "precio", etiqueta: "Tu precio por naranja", valor: 10, prefijo: "$" },
      { id: "fiadas", etiqueta: "Cuántas fías (no te pagan hoy)", valor: 50, unidad: "naranjas" },
    ],
    calcular: (v) => {
      const piezas = n0(v.piezas), costo = n0(v.costo), precio = n0(v.precio);
      const fiadas = Math.min(n0(v.fiadas), piezas);   // no puedes fiar más de las que tienes
      const cobrado = (piezas - fiadas) * precio;      // lo que SÍ entró a la lata
      const lata = cobrado - costo;                    // lo que queda después del proveedor
      const siPagaran = piezas * precio - costo;       // el día bueno, para comparar
      return {
        lata,
        color: lata <= 0 ? "rojo" : lata < siPagaran ? "ambar" : "verde",
        lineas: [
          `Cobras ${money(cobrado)} y el proveedor se lleva ${money(costo)}. Te quedan ${money(lata)}.`,
          `Si te pagaran todas: ${money(siPagaran)}. En la calle traes ${money(fiadas * precio)} fiados.`,
        ],
        letrero: { texto: `${money(precio)} c/u` },
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 01 — TE LA DEJO EN 8. La rebaja no sale del precio: sale de la ganancia.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "01",
    slug: "01-te-la-dejo-en-8",
    hook: "$2 de rebaja… $200 menos",
    frase: "La rebaja sale de lo que ganas.",
    pregunta: "¿Y en tu negocio?",
    campos: [
      { id: "piezas", etiqueta: "Cuántas vendes al día", valor: 100, unidad: "naranjas" },
      { id: "costoU", etiqueta: "Lo que te cuesta cada una", valor: 5, prefijo: "$" },
      { id: "precio", etiqueta: "Tu precio", valor: 10, prefijo: "$" },
      { id: "rebajado", etiqueta: "El precio con la rebaja", valor: 8, prefijo: "$" },
    ],
    calcular: (v) => {
      const piezas = n0(v.piezas), costoU = n0(v.costoU);
      const precio = n0(v.precio), rebajado = n0(v.rebajado);
      const con = piezas * (rebajado - costoU);   // con la rebaja
      const sin = piezas * (precio - costoU);     // sin ella, mismos clientes
      const cuesta = sin - con;
      return {
        lata: con,
        color: con <= 0 ? "rojo" : con < sin ? "ambar" : "verde",
        lineas: [
          `Te quedan ${money(con)}. Con los mismos clientes, sin la rebaja: ${money(sin)}.`,
          cuesta > 0
            ? `Rebajar ${money(precio - rebajado)} por naranja te cuesta ${money(cuesta)} al día.`
            : `La rebaja no te quita nada: le estás vendiendo arriba de tu precio.`,
        ],
        letrero: { texto: money(rebajado), antes: money(precio) },
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 02 — ESA LATA NO ES TUYA. La caja trae dinero con dueño.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "02",
    slug: "02-esa-lata-no-es-tuya",
    hook: "Tenía $1,000… y no pudo surtir",
    frase: "Lo que hay en la caja no es todo tuyo.",
    pregunta: "¿Y en tu caja?",
    campos: [
      { id: "caja", etiqueta: "Lo que hay hoy en tu caja", valor: 1000, prefijo: "$" },
      { id: "proveedor", etiqueta: "Lo que le debes al proveedor", valor: 500, prefijo: "$" },
      { id: "casa", etiqueta: "Lo que sacaste para tu casa", valor: 300, prefijo: "$" },
      { id: "luz", etiqueta: "Lo que pagaste de luz", valor: 400, prefijo: "$" },
    ],
    calcular: (v) => {
      const caja = n0(v.caja), proveedor = n0(v.proveedor);
      const queda = caja - n0(v.casa) - n0(v.luz);   // lo que amanece en la lata
      const falta = proveedor - queda;               // lo que le faltará para surtir
      const tuyo = caja - proveedor;                 // lo que de verdad era suyo
      return {
        lata: queda,
        color: falta > 0 ? "rojo" : "verde",
        lineas: falta > 0
          ? [
            `Mañana el proveedor te cobra ${money(proveedor)} y en la caja hay ${money(queda)}: te faltan ${money(falta)}.`,
            `Tuyo de verdad era ${money(tuyo)}. El resto ya tenía dueño.`,
          ]
          : [
            `Quedan ${money(queda)} y el proveedor cobra ${money(proveedor)}: sí surtes mañana.`,
            `Tuyo de verdad es ${money(tuyo)}; lo demás es del proveedor aunque esté en tu caja.`,
          ],
      };
    },
    escena: "casa",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 03 — LAS NARANJAS QUE TIRAS. El proveedor cobra lo que deja, no lo que vendes.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "03",
    slug: "03-las-naranjas-que-tiras",
    hook: "Pagó 100… vendió 90",
    frase: "Lo que tiras también lo pagaste.",
    pregunta: "¿Y en tu negocio?",
    campos: [
      { id: "piezas", etiqueta: "Cuántas pagaste", valor: 100, unidad: "naranjas" },
      { id: "costo", etiqueta: "Lo que te cobró el proveedor", valor: 500, prefijo: "$" },
      { id: "precio", etiqueta: "Tu precio por naranja", valor: 10, prefijo: "$" },
      { id: "tiradas", etiqueta: "Cuántas se te echan a perder", valor: 10, unidad: "naranjas" },
    ],
    calcular: (v) => {
      const piezas = n0(v.piezas), costo = n0(v.costo), precio = n0(v.precio);
      const tiradas = Math.min(n0(v.tiradas), piezas);
      const vendidas = piezas - tiradas;
      const lata = vendidas * precio - costo;
      const sinMerma = piezas * precio - costo;
      return {
        lata,
        color: lata <= 0 ? "rojo" : lata < sinMerma ? "ambar" : "verde",
        lineas: [
          `Vendes ${num(vendidas)} y juntas ${money(vendidas * precio)}. Te quedan ${money(lata)}.`,
          tiradas > 0
            ? `Sin tirar ninguna: ${money(sinMerma)}. Lo que fue a la basura te costó ${money(sinMerma - lata)}.`
            : `Nada a la basura: te quedas con los ${money(lata)} completos.`,
        ],
        letrero: { texto: `${money(precio)} c/u` },
        // 15 naranjas dibujadas son el total: la merma se ve en proporción.
        podridas: piezas > 0 ? Math.round((tiradas / piezas) * 15) : 0,
      };
    },
    escena: "basura",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 04 — VENDIÓ MENOS Y GANÓ MÁS. Importa lo que queda, no cuántas salen.
  // Son CINCO campos y no cuatro a propósito: con menos habría que inventar
  // cuántos clientes se van al subir el precio, y eso no se inventa — lo sabe
  // el dueño, no la página. (FÍSICA REAL, versión tiendita.)
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "04",
    slug: "04-vendio-menos-y-gano-mas",
    hook: "Vendió menos… y ganó más",
    frase: "No importa cuántas vendes: importa cuánto te queda.",
    pregunta: "¿Y si subes tu precio?",
    campos: [
      { id: "costoU", etiqueta: "Lo que te cuesta cada una", valor: 5, prefijo: "$", ancho: true },
      { id: "precio", etiqueta: "Tu precio de hoy", valor: 10, prefijo: "$" },
      { id: "vende", etiqueta: "A ese precio vendes", valor: 100, unidad: "naranjas" },
      { id: "precioNuevo", etiqueta: "Si lo subes a", valor: 12, prefijo: "$" },
      { id: "vendeNuevo", etiqueta: "Y solo te compran", valor: 80, unidad: "naranjas" },
    ],
    calcular: (v) => {
      const costoU = n0(v.costoU);
      const precio = n0(v.precio), vende = n0(v.vende);
      const precioNuevo = n0(v.precioNuevo), vendeNuevo = n0(v.vendeNuevo);
      const hoy = vende * (precio - costoU);
      const nuevo = vendeNuevo * (precioNuevo - costoU);
      const menosClientes = vende - vendeNuevo;
      const dif = nuevo - hoy;
      return {
        lata: nuevo,
        color: nuevo <= 0 ? "rojo" : dif >= 0 ? "verde" : "ambar",
        lineas: [
          `A ${money(precioNuevo)} vendes ${num(vendeNuevo)} y te quedan ${money(nuevo)}.`,
          `A ${money(precio)} te quedaban ${money(hoy)}: ${dif >= 0 ? `son ${money(dif)} MÁS` : `son ${money(-dif)} menos`}`
          + (menosClientes > 0 ? ` con ${num(menosClientes)} clientes menos.` : `.`),
        ],
        letrero: { texto: money(precioNuevo), antes: money(precio) },
      };
    },
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 05 — ¿A CAMBIO DE QUÉ? El préstamo que también fija tu precio.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "05",
    slug: "05-a-cambio-de-que",
    hook: "Le prestaron $500… y trabajó para otro",
    frase: "Si el que te presta pone el precio, trabajas para él.",
    pregunta: "¿Y tu préstamo?",
    campos: [
      { id: "piezas", etiqueta: "Cuántas surtes con ese dinero", valor: 100, unidad: "naranjas" },
      { id: "prestamo", etiqueta: "Lo que te prestan", valor: 500, prefijo: "$" },
      { id: "impuesto", etiqueta: "El precio al que te obliga a venderle", valor: 5, prefijo: "$" },
      { id: "calle", etiqueta: "Tu precio en la calle", valor: 10, prefijo: "$" },
    ],
    calcular: (v) => {
      const piezas = n0(v.piezas), prestamo = n0(v.prestamo);
      const impuesto = n0(v.impuesto), calle = n0(v.calle);
      const cobras = piezas * impuesto;
      const lata = cobras - prestamo;          // lo que te queda con la condición
      const libre = piezas * calle - prestamo; // lo que te quedaría vendiendo tú
      return {
        lata,
        color: lata <= 0 ? "rojo" : lata < libre ? "ambar" : "verde",
        lineas: [
          `Cobras ${money(cobras)} y pagas el préstamo de ${money(prestamo)}: te quedan ${money(lata)}.`,
          `Vendiendo tú a ${money(calle)} te quedarían ${money(libre)}. Esa diferencia de ${money(libre - lata)} es lo que cuesta el préstamo.`,
        ],
        letrero: { texto: money(impuesto), antes: money(calle) },
      };
    },
    nota: "Romper esa trampa le valió el Nobel de la Paz a Muhammad Yunus: encontró en Bangladesh a 42 personas atrapadas así por 27 dólares entre todas.",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // 06 — ANOTAR ES VER. El capítulo del que nació esta página.
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "06",
    slug: "06-anotar-es-ver",
    hook: "Nadie le robó… y le faltan $200",
    frase: "Lo que no se anota, no se cobra.",
    pregunta: "¿Y a ti, cuánto te deben?",
    campos: [
      { id: "cuantos", etiqueta: "A cuántos les fiaste esta semana", valor: 5, unidad: "vecinos" },
      { id: "cada", etiqueta: "Cuánto le fiaste a cada uno", valor: 100, prefijo: "$" },
      { id: "recordados", etiqueta: "De cuántos te acordaste el sábado", valor: 3, unidad: "vecinos" },
    ],
    calcular: (v) => {
      const cuantos = n0(v.cuantos), cada = n0(v.cada);
      const recordados = Math.min(n0(v.recordados), cuantos);
      const fiado = cuantos * cada;
      const cobrado = recordados * cada;
      const perdido = fiado - cobrado;
      return {
        lata: -perdido,                       // en rojo: es lo que NO entró
        color: perdido > 0 ? "rojo" : "verde",
        lineas: perdido > 0
          ? [
            `Fiaste ${money(fiado)} y cobraste ${money(cobrado)}: ${money(perdido)} se quedaron en la calle.`,
            `Nadie te robó. Se te olvidó… igual que a ellos.`,
          ]
          : [
            `Fiaste ${money(fiado)} y te acordaste de todos: cobraste ${money(cobrado)}.`,
            `Eso es la libreta funcionando. Sigue anotando aquí abajo.`,
          ],
      };
    },
  },
];

/** `?c=03` → el capítulo 03. Cualquier otra cosa → el 00, que es la puerta. */
export function capituloDe(c: string | null): Capitulo {
  return CAPITULOS.find((x) => x.id === (c ?? "").padStart(2, "0")) ?? CAPITULOS[0];
}

/** Los valores iniciales de un capítulo: los números de Don Chuy. */
export function valoresIniciales(cap: Capitulo): Record<string, number> {
  const v: Record<string, number> = {};
  for (const campo of cap.campos) v[campo.id] = campo.valor;
  return v;
}
