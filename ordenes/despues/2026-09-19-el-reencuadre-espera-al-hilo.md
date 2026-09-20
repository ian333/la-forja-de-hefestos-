# ORDEN: EL REENCUADRE ESPERA AL HILO — en una pieza pesada el molde arranca con la cámara viendo a otro lado (~24 s de viewport vacío)

ESTADO: despues (hallazgo registrado; sube a PRÓXIMO con `git mv` cuando ian diga — PRÓXIMO ya estaba en 7/7)

BASE: be27ab4

OBJETIVO: el paso 6 promete «siempre centrado, nunca negro». En la carcasa se cumple. Soltando el ensamble 1557BGY
(la caja Hammond de 514 caras), desde el clic a MOLDE hasta que el acero de E3 termina de tallarse la cámara sigue con
el encuadre del FOCO: en pantalla solo se ve la panza de la placa A en el borde de arriba, ~24 s. Al final de esta
orden el reencuadre a la base pre-pintada de E3 se VE antes de que el kernel bloquee el hilo, en cualquier pieza.

## LO QUE SE MIDIÓ (2026-09-19 · paseo de LA ENTRADA, video 34)
- Hoja de contactos del video 34 (un cuadro cada 8 s): cuadros 20–22 con el viewport vacío. A tamaño real: a los 164 s
  «E3 · tallando la cavidad y el núcleo · 0/5 · 4 s» con la placa A cortada arriba; a los 176 s «acero tallado ✓» ya
  encuadra la base 246×246 con la caja colocada.
- `cicloEstacion3` pre-pinta la base y espera `respiraCuadro(350)` (useMoldStudio.ts) para que el reencuadre (timer
  de 30 ms en ForgeBRepStudio) corra ANTES de `construirAceroE3`. Esos 350 ms se midieron con la carcasa; con una
  escena pesada (malla del Foco de 89,944 triángulos + campos de la lente) el render + efectos pasan de 350 ms y el
  timer queda detrás del bloque de kernel (acero 17 s en esta pieza).
- La telemetría de esa corrida: E2 5.5 s · E3 acero 17.0 s · E3 total 44.7 s · E5 87.0 s · E6 3.3 s · E7 4.8 s.

## IDEA (a validar al abrir, no decidida)
Esperar al HECHO y no al reloj: que el reencuadre avise cuando se aplicó (una promesa que resuelve en el cuadro
pintado) y E3 espere esa promesa con un tope, en vez de 350 ms fijos. El check `encuadre()` del runner ya mide si lo
que hay se ve; falta pedirlo DURANTE el tallado y en una pieza pesada (hoy solo se pide al final y en la carcasa).

## EJERCICIOS
- [ ] reproducir con el reproductor mínimo (soltar 1557BGY → MOLDE) midiendo `encuadre()` cada 500 ms durante E3.
- [ ] el reencuadre se espera por hecho, con tope; carcasa sin perder su «primera placa ≤ 10 s».
- [ ] el camino gana una pieza pesada como segundo testigo del paso 6, o el check se pide a media E3.

## TOCA
- (se declara al abrir)

## CREA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- Hoja de contactos del paseo del ensamble sin cuadros vacíos entre el clic a MOLDE y la base de E3.
