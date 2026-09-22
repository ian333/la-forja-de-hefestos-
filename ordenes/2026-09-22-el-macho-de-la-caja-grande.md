# ORDEN: EL MACHO DE LA CAJA GRANDE — en la 1599HBK el núcleo no sube a llenar la pieza: 31.5 mm de plástico macizo donde debía haber acero

ESTADO: proximo
PRIORIDAD: 1

BASE: b3815ba

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
- [ ] medir la cara del núcleo en una rejilla de 10×5 puntos de la huella (inspeccion.caraEn) antes → después.
- [ ] encontrar la causa en E3 con evidencia (malla del núcleo vs malla de la pieza, en corte por x y por y).
- [ ] las 4 piezas: 1.1 ✓ en la rejilla completa; cubo 266/266; tsc sin nuevos.

## TOCA
- (se declara al abrir)

## CREA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- Rejilla de la huella: |cara del núcleo − piso interior| ≤ 0.5 mm en ≥ 95 % de los puntos de las 4 piezas; tarjeta 1.1 de la 1599HBK.
