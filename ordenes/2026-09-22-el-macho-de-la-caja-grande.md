# ORDEN: EL MACHO DE LA CAJA GRANDE — en la 1599HBK el núcleo no sube a llenar la pieza: 31.5 mm de plástico macizo donde debía haber acero

ESTADO: hoy
PRIORIDAD: 1

BASE: 2438d60

OBJETIVO: que el núcleo de TODA pieza soltada forme su interior. En la 1599HBK (caja grande, 220×110×35.5, base 396×296) el acero
del núcleo se queda plano a la altura de la partición en el centro de la pieza, y la pieza queda hueca encima: moldeado así, el
centro saldría como un bloque MACIZO de ~31.5 mm de plástico. En la carcasa, la tapa y el ensamble el macho sí llena (1.1 ✓).

## LO QUE SE MIDIÓ (inspección sobre la fusión de EL REPARTO, 2026-09-22 — public/evidencia/2026-09-21-el-reparto-de-la-inspeccion/)
- Inspector 1.1 (rayo contra la malla, no fórmula): en el centro (198.4, 148.3) la cara del núcleo está en z 184.6 y el piso
  interior de la pieza en z 241.5 (pared ahí 2.5) → **−56.9 mm**; la partición está en z 210. Alrededor de los pines la cara del
  núcleo sale en z 210 (= la partición) y las puntas suben 31.5 mm hasta el piso: los pines están de pie en un hueco vacío.
- La 1.1 de la cámara (tarjeta de la fusión): el núcleo ámbar plano bajo la pieza cian hueca. La vio también la pasada 1 (−1.04
  con la fórmula, que lo tapaba) y el agente de LA CÁMARA DEL INSPECTOR (31.5 mm de hueco antes de que la pila creciera).
- OJO, no confundir: el agente de LOS PINES reportó 0.000 contra `max[2]` del rol `nucleo` — el MÁXIMO de toda la malla, que
  sí llega a algún lado; el rayo local dice que en el centro no llega. Medir en varios puntos de la huella, no un máximo.

## HIPÓTESIS A MEDIR (no decididas)
- `construirAceroE3` (estudio-molde-datos.ts:1799) / `splitMold` con la pieza de 10 sólidos → el mayor (LA ENTRADA): ¿el núcleo
  se talla con la pieza correcta y con la altura del inserto Hk suficiente para esta pieza de 35.5?
- ¿La pieza tiene un fondo abierto o costillas internas que el split plano no resuelve? (mirar la malla local en planta).
- `insertDims`/Hk para la base 396×296.

## EJERCICIOS
- [x] medir la cara del núcleo en una rejilla de 10×5 puntos de la huella (inspeccion.caraEn) antes → después.
- [x] encontrar la causa en E3 con evidencia (malla del núcleo vs malla de la pieza, en corte por x y por y).
- [x] las 4 piezas: 1.1 ✓ en la rejilla completa; cubo 266/266; tsc sin nuevos.

## TOCA
- ordenes/2026-09-22-el-macho-de-la-caja-grande.md
- src/forja/mold/mold.ts
- src/forja/brep/occt.ts

(mold.ts: `splitMold` — el macho = TODOS los cuerpos que suben a la partición, no el menor · occt.ts: `solidsOf`, el desarme en
cuerpos que ya vivía dentro de `keepSolid`, sacado para reusarlo)

## CREA
- public/evidencia/2026-09-22-el-macho-de-la-caja-grande/resultados.json
- public/evidencia/2026-09-22-el-macho-de-la-caja-grande/corte-macho-1599HBK.png
- public/evidencia/2026-09-22-el-macho-de-la-caja-grande/tarjeta-1-1-1599HBK.png

## EVIDENCIA (se declara ANTES de trabajar)
- Rejilla de la huella: |cara del núcleo − piso interior| ≤ 0.5 mm en ≥ 95 % de los puntos de las 4 piezas; tarjeta 1.1 de la 1599HBK.

## ENMIENDA 2026-09-22
- Entran al TOCA `src/forja/mold/mold.ts` y `src/forja/brep/occt.ts`: la causa está en `splitMold` (mold.ts), no en
  `construirAceroE3`; y el desarme en cuerpos vivía escondido dentro de `keepSolid` (occt.ts) — se saca como `solidsOf`
  para que haya UNA sola forma de separar cuerpos.
- Entra al CREA la carpeta de evidencia (resultados.json + el corte + la tarjeta 1.1), como en las órdenes anteriores.

## CIERRE (2026-09-22 · MEDIDO, no contado)

**La causa (con evidencia).** No era Hk ni la colocación: `splitMold` resta la pieza del bloque y se quedaba con el cuerpo
MÁS CHICO como «el macho» (`keepSolid(molde, 'smallest')`). Con 2 cuerpos eso es cierto. La 1599HBK tiene 4 torres de
tornillo huecas (agujero de 4×4) que llegan hasta la partición: el acero dentro de cada torre queda aislado del macho por la
propia torre → el bloque parte en **6 cuerpos** (cavidad 2 270 050 mm³ · macho 692 077 · 4 postes de 395.8). El más chico era
UN POSTE de 4×4×31.5 mm (su caja: x 97–101, y 190–194, z 210–241.5); el núcleo = placa plana en la partición + ese poste.
Rayo por el poste: pieza en z 241.5/244 (el techo de la torre) y la pared de la torre a 3 mm (pieza z 209.5–244).
Corte por x (y = 148.05) y por y (x = 198.07): `corte-macho-1599HBK.png` — antes el macho ámbar se queda en la partición y la
pieza cian queda hueca encima; después llena hasta el piso.

**El arreglo (flujo de datos, TODA pieza).** `splitMold`: la cavidad sigue siendo el cuerpo mayor; el macho = la UNIÓN de
todos los demás cuerpos cuya cara llega a la partición (macho + postes), y eso se une a la placa (Fig 6-34: los postes
descansan en el mismo respaldo). Un cuerpo que no llegue a la partición no se une y se REPORTA (no pasó en las 4 piezas).
Con 2 cuerpos el resultado es bit-igual. El reporte del split lo dice: «macho = 5 cuerpos que suben a la partición
(692076.8 + 395.8 ×4 mm³)».

**Rejilla 10×5 de la huella** (|techo del macho − piso de la pieza| ≤ 0.5 mm), kernel en node · antes → después:

| pieza | cuerpos | antes | después | app (después, `caraEn`) |
|---|---|---|---|---|
| 1594C Box (carcasa) | 2 | 50/50 | 50/50 (bit-igual) | 50/50 |
| 1594C Lid (tapa) | 2 | 50/50 | 50/50 (bit-igual) | 50/50 |
| **1599HBK (caja grande)** | 6 | **1/50** (49 HUECO, hasta 31.5 mm) | **50/50** | **50/50** |
| 1557BGY (ensamble) | 2 | 38/50 | 38/50 (bit-igual) | 38 toca · 10 fuera · 2 sin pieza |

En la 1557BGY los 12 que no «tocan» NO son hueco: 2 caen fuera de la pieza (esquinas) y 9–10 son dos franjas a lo largo de
los lados donde el plástico solo está arriba (z 200–204) con ACERO DE LA CAVIDAD debajo desde la partición — ahí la pieza
no está sobre el macho. De los puntos donde la pieza SÍ está sobre el macho: **38/38 = 100 %**. En total: 188/200 = 94 %
contra el 95 % declarado; los 12 no son del macho (ver pregunta 1).

**Inspector (la app real, 1599HBK):** 1.1 **−56.9 mm → 0.00 mm ✓** (rayo en 198.4, 148.3: techo del macho z 241.5 = piso
z 241.5); 6.1 FALLA → ✓ (las 8 puntas en la cara real, 0 mm). Fallas 6 → **4** (quedan 2.3, 2.5, 5.1, 6.2; ok 9 → 10).
Tarjeta: `tarjeta-1-1-1599HBK.png`.

**Gates:** cubo 266/266 (después del último cambio) · tsc: 67 errores = los 66 de la base + `src/comando/Logos.tsx` (JSX
namespace), que llegó con 500d732 (LA CARA DE GAIA), no es de esta orden; mold.ts y occt.ts sin errores · orden-gate VERDE.
Costo: la E3 de la 1599HBK tarda 13.4 → 19.7 s en node (la unión de 5 cuerpos); las otras 3 igual.

**Visto, no es de esta orden:**
- 2.3 agua B ↔ cuerpos de pin (72 pares se cruzan en z; linea0↔pin-cuerpo-2, linea1↔pin-cuerpo-6, linea4↔pin-cuerpo-0 a 0 mm)
  — es de LOS BOTADORES CON NOMBRE («se mueve el pin»). OJO para la fusión: ahora el macho de la 1599HBK sube 31.5 mm y los
  pines van hasta z 241.5 (antes se paraban en el hueco).
- 2.5 agua B ↔ pines de retorno (1.5 y 1.11 mm) — es de LAS REGLAS DE HEFESTOS (retornos que no caben).
- 6.2 balance de la expulsión (centroide a 13.26 mm) y 5.1 (pared de 4.9 mm contra 2.46 típica: 51 s contra 12.7 s) —
  de ninguna de las cuatro.
- 1557BGY: las franjas con acero de la cavidad bajo el plástico (pregunta 1) — de ninguna de las cuatro.

**Archivos (para la fusión):** `src/forja/mold/mold.ts` (solo `splitMold`, la elección del macho) · `src/forja/brep/occt.ts`
(`solidsOf` nuevo; `keepSolid` lo usa, mismo resultado) · esta orden · `public/evidencia/2026-09-22-el-macho-de-la-caja-grande/`.
No toqué estudio-molde-datos.ts: sin choque con los botadores ni con el corte. ACTA: no cambió ningún literal del cubo.

**Preguntas para ian:**
1. *La tapa del ensamble tiene un alero.* En la 1557BGY, a lo largo de sus dos lados largos, el plástico solo está arriba
   (una ceja de ~4 mm a 25 mm sobre la partición) y debajo de la ceja hay acero de la cavidad. Al abrir, la cavidad sube y
   ese acero choca contra la ceja: la pieza no sale, o se rompe la ceja. Hoy son 10 de 50 puntos de la huella (20 %).
   ¿Lo resolvemos subiendo la partición a la ceja en esos lados (partición escalonada) o con un lado móvil?
   Mi recomendación: partición escalonada; un lado móvil cuesta más y la ceja no es contrasalida si la partición pasa por ella.
2. *Los postes dentro de las torres.* En la caja grande el acero que forma el agujero de cada torre de tornillo es un poste
   de 4×4 mm y 31.5 mm de alto. Hoy va de una pieza con el macho. Un poste así de delgado (casi 8 veces más alto que ancho) se
   suele hacer como pieza aparte, cambiable, porque es lo primero que se rompe. ¿Los dejamos macizos con el macho o los
   hacemos postes insertados? Mi recomendación: insertados, en una orden aparte (hay que buscar la cita en Kazmer primero).

