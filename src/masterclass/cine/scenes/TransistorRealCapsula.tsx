/**
 * TransistorRealCapsula — CÁPSULA #3 v2: EL TRANSISTOR DE VERDAD (60 s, 9:16).
 *
 * La v1 se rechazó por INVENTADA ("eso no es un transistor real"). Aquí cada
 * dato del guion sale de `scripts/transistor-real.py` (que los calcula) y cada
 * átomo de `precompute-transistor.py` (que verifica que el ángulo sp³ EMERGE
 * con error 0.000000° antes de escribir el .bin).
 *
 * El guion NO adorna: los números reales son más fuertes que cualquier invento.
 *   · "2 nm" no mide 2 nm — nada en él mide 2 nm (gate pitch REAL = 48 nm)
 *   · 62,925 átomos en el canal (a=5.431 Å medido, 8 átomos/celda)
 *   · 153 dopantes en la fuente — se cuentan uno por uno
 *   · el canal va SIN dopar, a propósito (random dopant fluctuation)
 *   · el electrón del dopante mide 2.38 nm (a* = a0·εr / (m* ÷ m0)); el canal, 6 nm
 *     → NO CABE. Por eso el canal moderno es intrínseco.
 *   · 313 millones de transistores por mm² [TSMC N2]
 *
 * Tiempos PROVISIONALES: retimar con las duraciones reales de Matilda
 * (narracion-gen.py → assemble-offsets.py) ANTES del render 4K.
 */
import { CineStage } from '@/masterclass/cine';
import TransistorReal, { T } from './TransistorReal';

// GUION — cada línea afirma algo MEDIDO o CALCULADO. Nada decorativo.
// Los números salen de transistor-real.py y transistor-cuantico.py (que se
// niegan a correr si la física no cuadra: el campo lleva assert contra la
// ruptura del Si, y los electrones contra el pozo).
const LINES: [number, string][] = [
  [0.5,  'A esto le dicen "dos nanómetros".'],
  [3.4,  'Es mentira. Nada aquí mide dos nanómetros.'],
  [6.6,  'Es silicio: cada punto, un átomo real, en su lugar real.'],
  [11.0, 'El canal entero son sesenta y dos mil novecientos veinticinco átomos.'],
  [15.4, 'Estos de oro son las impurezas. Ciento cincuenta y tres. Se cuentan.'],
  [21.0, 'Pero mira el canal: no tiene ni una. Ninguna. A propósito.'],
  [25.6, 'Está vacío. Cero electrones libres. Es un interruptor apagado.'],
  [30.0, 'Hasta que la compuerta enciende. Esto es el campo eléctrico, resuelto.'],
  [35.4, 'Y entonces los electrones vienen. Nadie los empuja: el campo los LLAMA.'],
  [41.0, 'Cruzan catorce nanómetros chocando solo tres veces. Casi vuelan.'],
  [46.2, 'Y no tocan las paredes: la onda se los prohíbe. Viven en el centro.'],
  [51.4, 'Cada electrón tarda ciento treinta y tres femtosegundos en cruzar.'],
  [56.0, 'Y de esto hay trescientos trece millones por milímetro cuadrado.'],
];
const END = T.fin;
const subtitles = LINES.map(([at, text], i) => ({
  text, at, until: i < LINES.length - 1 ? LINES[i + 1][0] - 0.25 : END - 0.5,
}));

export default function TransistorRealCapsula() {
  return (
    <CineStage
      mood="studio"
      envIntensity={0.0}
      duration={END}
      fov={44}
      cameraPos={[0, 8, 70]}
      background="#000"
      postfx={{ intensity: 1.15, threshold: 0.2, smoothing: 0.6, vignette: 0.68, aberration: 0.001 }}
      brand={{ name: 'El transistor', sub: '2 nm', at: 2.4 }}
      subtitles={subtitles}
    >
      {/* la cámara vive DENTRO de TransistorReal (fórmulas puras en t) — aquí
          no va CineCamera. El mundo ES el cristal: sin NebulaWorld. */}
      <TransistorReal />
    </CineStage>
  );
}
