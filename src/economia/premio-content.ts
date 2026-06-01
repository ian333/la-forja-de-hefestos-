/**
 * premio-content.ts — contenido de cada hub de premio Nobel.
 *
 * Filosofía (calibrada contra el guion de las masterclass, p.ej. econ-01-limones):
 * la experiencia NO es teoría. Es:
 *
 *   1. GANCHO visceral   — una frase que pega en el estómago (no una pregunta tibia).
 *   2. EL CLICK          — el lab interactivo: "no te lo explico, pégale tú".
 *                          + 2-4 líneas que nombran el "ajá" que acabas de sentir.
 *   3. USOS, USOS, USOS  — dónde vive esto en TU vida. Cascada concreta, mexicana,
 *                          sin jerga. El equivalente a "mismo modelo, otro mercado".
 *
 * El link al paper / comité Nobel existe pero va chiquito al pie: nadie lo lee,
 * no es la experiencia.
 */

import { EXTRA_CONTENT } from './premio-content-extra';

export interface PremioUse {
  /** Dónde vive (corto, en negritas): "Tu negocio", "La bolsa", "Banxico". */
  where: string;
  /** El golpe concreto, 1-2 frases. Visceral, mexicano, cero teoría. */
  punch: string;
}

export interface PremioContent {
  /** id del catálogo NOBEL_CATALOG. */
  id: string;
  /** Gancho de estómago: la frase grande del hero. */
  hook: string;
  /** Línea que invita a jugar, justo arriba del lab. Solo si hay lab. */
  playPrompt?: string;
  /** El "ajá" en 2-4 líneas cortas y punzantes (lo que sentiste con el lab). */
  click: string[];
  /** La cascada de usos reales. Esto es la carne. */
  usos: PremioUse[];
  /** Golpe final, opcional. */
  closer?: string;
  /** Referencia chiquita al pie. `url` opcional: si falta, la página la arma desde el año. */
  paper?: { ref: string; url?: string };
}

const NOBEL_1969 = 'https://www.nobelprize.org/prizes/economic-sciences/1969/summary/';

export const PREMIO_CONTENT: Record<string, PremioContent> = {
  // ═══════════════════════ #1 · 1969 · FRISCH & TINBERGEN ═══════════════════════
  'econ-1969-frisch-tinbergen': {
    id: 'econ-1969-frisch-tinbergen',
    hook: 'Tu peor error con el dinero no es perderlo. Es confundir un buen día con una buena racha.',
    playPrompt: 'No te lo explico. Pégale tú al caballito. 🏏',
    click: [
      'Le pegaste con golpes al puro azar. Y aun así se meció con ritmo.',
      'Ese ritmo no lo pusieron los golpes. Lo puso el caballito.',
      'Apaga los golpes (botón de arriba) y se queda quieto. Sin sorpresas, no hay ciclo. El vaivén no nace del azar — nace de cómo lo digieres.',
    ],
    usos: [
      {
        where: 'Tu negocio',
        punch:
          'Vendiste el triple un sábado porque cayó una boda. ¿Ya despegaste? No. Te pegó un golpe. El lunes vuelves a tu ritmo. El error más caro del changarro es rentar más grande, contratar o endeudarte por UN golpe, creyendo que es tendencia.',
      },
      {
        where: 'La bolsa',
        punch:
          'Los gráficos del mercado "se ven" llenos de patrones cíclicos. La mayoría es ruido meciéndose. Por eso casi todos los que "le leen patrones" al chart pierden: confunden el golpe con la señal.',
      },
      {
        where: 'Tu tarjeta y Banxico',
        punch:
          '¿Por qué Banxico no mueve la tasa cada vez que la inflación brinca un mes? Porque sabe que un dato es un golpe, no una tendencia. Espera a ver el ritmo. Tú deberías hacer lo mismo antes de cambiar de chamba por un mes bueno.',
      },
      {
        where: 'Tu cuerpo',
        punch:
          'Una semana mala de dieta o de gym es un golpe, no quién eres. Tu peso sigue su propio ritmo. La gente abandona porque reacciona al golpe y nunca ve el ritmo.',
      },
      {
        where: 'Tu gente',
        punch:
          'Una pelea fea es un golpe. La relación tiene su propio vaivén. Confundir el golpe con "esto se acabó" rompe cosas que nada más se estaban meciendo.',
      },
      {
        where: 'Todo lo demás',
        punch:
          'El mismo caballito mece el tráfico de tu ciudad, las olas de El Niño, una población de conejos. Inercia + golpes al azar = ciclos. Siempre. Por eso este fue el primer Nobel de economía: Tinbergen lo volvió ecuaciones y nació la econometría.',
      },
    ],
    closer:
      'Aprende a ver la diferencia entre el golpe y el ritmo, y dejas de tomar decisiones estúpidas con tu dinero, tu cuerpo y tu gente.',
    paper: {
      ref: 'Frisch (1933), “Propagation and Impulse Problems” · Tinbergen (1939) · comité Nobel 1969',
      url: NOBEL_1969,
    },
  },

  // ═══════════════════════ #2 · 1970 · PAUL SAMUELSON ═══════════════════════
  'econ-1970-samuelson': {
    id: 'econ-1970-samuelson',
    hook: 'Nadie decide el precio justo. El mercado lo encuentra solo — como una canica que rueda al fondo de un tazón.',
    playPrompt: 'Avienta la canica del precio. Mira a dónde cae sola. 🥣',
    click: [
      'Soltaste el precio donde quisiste. Rodó solo hasta el fondo: ahí oferta y demanda se cruzan.',
      'Nadie puso ese punto. Lo encontró el mercado, como el agua encuentra su nivel.',
      'Ahora pon un techo de precio y aguanta la canica fuera del fondo: aparece la escasez. Eso son, literal, las colas de la gasolina subsidiada.',
    ],
    usos: [
      { where: 'Tu changarro', punch: 'No adivinas tu precio: lo tanteas. Subes y baja la venta; bajas y se acaba el producto. El mercado te empuja al fondo del tazón sin que leas un libro.' },
      { where: 'Gasolina y renta controladas', punch: 'Cuando el gobierno fija un precio abajo del justo (gasolina en Venezuela, renta tope en algunas ciudades), la canica no llega al fondo: faltan cosas. Colas, mercado negro, escasez. No es maldad — es el tazón.' },
      { where: 'Boletos y reventa', punch: '¿Por qué hay reventa? El precio oficial quedó abajo del fondo. El revendedor nada más empuja la canica a donde ya quería caer.' },
      { where: 'Tu sueldo', punch: 'Tu salario también busca su nivel: si vales más de lo que te pagan, otra oferta te jala hacia arriba. Quédate quieto y nunca llegas al fondo que te toca.' },
      { where: 'El método', punch: 'Samuelson demostró con matemáticas QUE la canica cae al fondo y QUÉ tan rápido. Convirtió la economía de cuento a ciencia: predicciones que se pueden comprobar o tirar.' },
    ],
    closer: 'El precio justo no es opinión de nadie. Es el fondo del tazón. Tu trabajo es no pelearte con la gravedad.',
    paper: { ref: 'Samuelson, Foundations of Economic Analysis (1947) · comité Nobel 1970', url: 'https://www.nobelprize.org/prizes/economic-sciences/1970/summary/' },
  },

  // ═══════════════════════ #3 · 1971 · SIMON KUZNETS ═══════════════════════
  'econ-1971-kuznets': {
    id: 'econ-1971-kuznets',
    hook: 'El hombre que inventó el PIB pasó el resto de su vida rogando que no lo usaras para medir si tu vida va bien.',
    playPrompt: 'Préndele y apágale a tu vida. Mira qué cuenta el PIB… y qué no. 📟',
    click: [
      'Cocinaste para tu familia: tu vida mejora, el PIB ni se entera. Te divorcias y comes fuera: el PIB sube.',
      'El PIB no mide si vives mejor. Mide cuánto dinero cambia de manos.',
      'Por eso un derrame de petróleo SUBE el PIB (alguien cobra por limpiarlo) y cuidar gratis a tu mamá no cuenta nada.',
    ],
    usos: [
      { where: 'Tu casa', punch: 'Cocinar, criar, cuidar: mueve al país y vale oro. Para el PIB vale cero, porque no se factura. Por eso el trabajo del hogar (casi siempre de mujeres) es invisible en las cifras.' },
      { where: 'Tu país en las noticias', punch: 'Te dicen "creció el PIB 3%" y tú no sientes nada. Normal: pudo crecer por más choques, más enfermos, más cárceles. Crecer no es lo mismo que estar mejor.' },
      { where: 'Tu negocio', punch: 'No midas tu changarro solo por ventas (tu "PIB"). Un mes vendiste más porque rematas a pérdida: el número sube, tú estás peor. Mide lo que importa, no lo que es fácil de contar.' },
      { where: 'Lo gratis', punch: 'Wikipedia, el software libre, la receta de tu abuela: valor enorme, PIB casi cero. Lo mejor de la vida no se factura.' },
    ],
    closer: 'Lo que mides, lo persigues. Si mides solo dinero, persigues solo dinero. Kuznets te avisó hace medio siglo.',
    paper: { ref: 'Kuznets, National Income 1929–1932 (1934) · comité Nobel 1971', url: 'https://www.nobelprize.org/prizes/economic-sciences/1971/summary/' },
  },

  // ═══════════════════════ 1992 · GARY BECKER ═══════════════════════
  'econ-1992-becker': {
    id: 'econ-1992-becker',
    hook: '¿Por qué te casas, por qué estudias, por qué no robas? Becker dice: estás haciendo cuentas, aunque no lo sepas.',
    click: [
      'El amor, el crimen, los hijos, la escuela: Becker los metió a todos a una hoja de cálculo invisible.',
      'No es que seas frío. Es que tu cerebro pesa costos y beneficios hasta en lo que parece puro corazón.',
      'Ver eso es un superpoder: descubres los incentivos detrás de decisiones que creías irracionales.',
    ],
    usos: [
      { where: 'Estudiar', punch: '¿Vale la pena la universidad? Becker lo llamó "capital humano": inviertes años y dinero hoy para cobrar más toda la vida. A veces sí, a veces es mal negocio. Haz la cuenta antes de endeudarte por una carrera.' },
      { where: 'El crimen', punch: 'Un criminal también calcula: ganancia esperada vs. probabilidad de que lo atrapen × castigo. Por eso bajar el crimen no siempre es más años de cárcel — a veces es más probabilidad de caer.' },
      { where: 'Tener hijos', punch: 'La gente tiene menos hijos cuando criar a cada uno cuesta más (escuela, tiempo, ciudad cara). No es egoísmo: es el mismo cálculo. Por eso los países ricos tienen menos hijos.' },
      { where: 'Discriminación', punch: 'Becker demostró que discriminar SALE CARO: si no contratas al mejor por prejuicio, tu competencia sí lo hace y te gana. El mercado castiga al prejuicioso… cuando hay competencia de verdad.' },
    ],
    closer: 'La economía no es solo dinero. Es la lógica escondida en CADA decisión humana. Eso es lo que Becker te enseña a ver.',
    paper: { ref: 'Becker, The Economic Approach to Human Behavior (1976) · comité Nobel 1992', url: 'https://www.nobelprize.org/prizes/economic-sciences/1992/summary/' },
  },

  // ═══════════════════════ 1997 · MERTON & SCHOLES ═══════════════════════
  'econ-1997-merton-scholes': {
    id: 'econ-1997-merton-scholes',
    hook: 'Una sola ecuación mueve billones de dólares al día. Y por poco quiebra al mundo cuando sus propios autores la usaron.',
    click: [
      'Black, Scholes y Merton encontraron cómo ponerle precio a una apuesta sobre el futuro: una opción.',
      'El truco: puedes "fabricar" esa apuesta combinando el activo y deuda — así su precio justo deja de ser opinión y se vuelve fórmula.',
      'El lado oscuro: la fórmula asume que el mundo se porta "normal". Cuando entra en pánico, falla. En 1998 el propio fondo de ellos (LTCM) voló por los aires.',
    ],
    usos: [
      { where: 'Tu seguro', punch: 'Un seguro ES una opción: pagas una prima por el derecho a cobrar si algo malo pasa. La misma matemática que le pone precio a tu seguro de auto.' },
      { where: 'Tu chamba en una startup', punch: 'Te dan "opciones" sobre acciones. ¿Cuánto valen? No es el precio de hoy — es esta fórmula, que pesa cuánto pueden subir antes de que venzan.' },
      { where: 'Por qué algo "barato" sale caro', punch: 'El precio de una opción sube con la incertidumbre. Más caos = más vale el seguro. Por eso asegurar algo volátil cuesta un ojo de la cara.' },
      { where: 'La lección de humildad', punch: 'Los modelos son mapas, no el territorio. LTCM tenía dos premios Nobel y quebró en semanas por confiar de más en la fórmula. Úsala, pero no le reces.' },
    ],
    closer: 'Le puedes poner número al riesgo. Lo que no puedes es olvidar que el número asume que mañana se parece a ayer — hasta que deja de parecerse.',
    paper: { ref: 'Black & Scholes (1973); Merton (1973) · comité Nobel 1997', url: 'https://www.nobelprize.org/prizes/economic-sciences/1997/summary/' },
  },

  // ═══════════════════════ 2005 · SCHELLING & AUMANN ═══════════════════════
  'econ-2005-aumann-schelling': {
    id: 'econ-2005-aumann-schelling',
    hook: 'Nadie en tu colonia es extremista. Y aun así tu colonia está partida en dos. Schelling demostró por qué — con monedas en un tablero.',
    playPrompt: 'Dale play. Mira a la ciudad partirse sola. 🏙️',
    click: [
      'Cada quien quería UNA cosa tibia: que algunos de sus vecinos fueran como él. Nada más.',
      'Sumaste miles de preferencias tibias y salió un muro que nadie quiso ni construyó.',
      'Baja la tolerancia en el lab de arriba: el orden (o el apartheid) emerge solo, sin que nadie lo ordene.',
    ],
    usos: [
      { where: 'Tu colonia', punch: 'Las ciudades se segregan aunque casi nadie sea racista. Basta que cada quien prefiera "tantito" estar con los suyos. El muro lo levanta la suma de gente normal, no el odio de unos cuantos.' },
      { where: 'Tu timeline', punch: 'Tu burbuja en redes (puros que piensan como tú) nadie la diseñó. Emergió de mil clics tibios de "mejor sigo a este". Echo chamber, puro Schelling.' },
      { where: 'La escuela y la cafetería', punch: 'Por qué los grupitos se forman solos y en el comedor todos terminan sentados por bando. Preferencia local chiquita → orden global que nadie convocó.' },
      { where: 'Coordinarse sin jefe', punch: 'El otro gran hallazgo de Schelling: pierdes a tu amigo en el centro sin haber quedado, y los dos caminan al reloj o al zócalo. Ese "punto obvio" coordina sin contrato — como el carril derecho o la fila.' },
    ],
    closer: 'El orden que ves en tu ciudad casi nadie lo eligió a propósito: emergió de preferencias tibias. Entender eso es ver la mano invisible… a veces armando muros.',
    paper: { ref: 'Schelling, "Dynamic Models of Segregation" (1971) + The Strategy of Conflict (1960) · comité Nobel 2005', url: 'https://www.nobelprize.org/prizes/economic-sciences/2005/summary/' },
  },

  // ═══════════════════════ 1999 · ROBERT MUNDELL ═══════════════════════
  'econ-1999-mundell': {
    id: 'econ-1999-mundell',
    hook: 'Hay tres cosas que todo país quiere de su dinero. Mundell demostró que solo puedes tener DOS. Elige.',
    click: [
      'El trilema: (1) tipo de cambio fijo, (2) libre flujo de capital, (3) política monetaria propia. Las tres juntas son imposibles.',
      'Si fijas el peso al dólar Y dejas entrar y salir capital, pierdes el control de tus tasas. Si quieres tus tasas, suelta una de las otras dos.',
      'Argentina lo aprendió a golpes: fijó el peso 1 a 1 al dólar, y cuando ya no pudo sostenerlo, todo explotó (2001).',
    ],
    usos: [
      { where: 'Por qué el peso flota', punch: 'México dejó flotar el peso después del 94. Eligió: tasas propias + capital libre = el tipo de cambio se mueve. Por eso el dólar sube y baja todos los días.' },
      { where: 'El euro', punch: 'Europa eligió tipo fijo (la misma moneda) + capital libre = ningún país tiene política monetaria propia. Por eso Grecia no pudo "imprimir" para salir de su crisis.' },
      { where: 'Tu negocio que importa', punch: 'Si compras mercancía en dólares, el trilema te pega: el peso flota y tus costos cambian de un día a otro. Por eso los importadores cubren (hedge) el tipo de cambio.' },
      { where: 'China', punch: 'China eligió tipo casi fijo + tasas propias = tuvo que controlar el capital (no puedes sacar tu dinero libremente). Las tres no se pueden, ni siendo China.' },
    ],
    closer: 'En el dinero, como en la vida, no puedes tenerlo todo. Mundell te enseña a ver cuál de las tres estás sacrificando — porque siempre estás sacrificando una.',
    paper: { ref: 'Mundell (1963), "Capital Mobility and Stabilization Policy" · comité Nobel 1999', url: 'https://www.nobelprize.org/prizes/economic-sciences/1999/summary/' },
  },
};

// Mezcla el contenido generado por workflow (los 50 premios restantes). Las
// 7 entradas hechas a mano arriba mandan: solo se agrega lo que no exista ya.
for (const c of EXTRA_CONTENT) {
  if (!(c.id in PREMIO_CONTENT)) PREMIO_CONTENT[c.id] = c;
}

export function getPremioContent(id: string): PremioContent | undefined {
  return PREMIO_CONTENT[id];
}

/** ¿Este premio ya tiene contenido extendido (gancho, click, usos)? */
export function hasPremioContent(id: string): boolean {
  return id in PREMIO_CONTENT;
}
