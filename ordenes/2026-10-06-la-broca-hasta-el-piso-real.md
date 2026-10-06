# ORDEN: LA BROCA HASTA EL PISO REAL — cada barreno de pin en el núcleo llega a donde llega SU punta

ESTADO: cerrada (2026-10-06)
PRIORIDAD: 1

BASE: d0e0136

OBJETIVO: el barrenado de los insertos corta el barreno de cada pin hasta «base − pared MEDIANA + 0.2» (useMoldStudio.ts:~1602 →
estudio-molde-datos.ts:~1928) mientras la punta del pin va al piso REAL medido por rayo bajo cada pin. Resultado: queda una piel de
acero sobre cada punta — **0.86 mm en los 8 pines de la tapa, 0.57–0.66 mm en el ensamble** (0 en carcasa y caja grande). El estudio
de contacto da 0 pares pin↔núcleo y el inspector dice CUMPLE: nadie lo veía. Que la broca de cada pin use EL MISMO piso que su punta
(una sola fuente), y que el contacto/inspector vea un pin metido en acero.

## LO MEDIDO (revisión cruzada 2026-09-28, app real dev5)
- focos/revision/corte.md + corte/tapa_7_2.png: rayo vertical en el eje de cada pin → barreno termina en z 155.94, acero hasta 156.8,
  punta en 156.8. Tapa: mediana 1.06 bajo el piso real − 0.2 = 0.86 (cuadra al centésimo).

## DECISIÓN DE IAN
- 2026-09-22: cada pin a SU largo (LOS BOTADORES CON NOMBRE). 2026-10-06: «repara los errores… juzga todo visualmente».

## EJERCICIOS
- [x] una sola fuente del piso por pin para la punta Y para la broca; piel de acero sobre cada punta = 0 en las 4 piezas (rayo en el eje).
- [x] el estudio de contacto / juez detecta pin↔acero del núcleo (prueba: con el código viejo lo marca; con el nuevo, 0).
- [x] captura en corte por la fila de pines de la tapa, antes/después, juzgada con los ojos.
- [x] cubo verde (o ACTA R94), tsc sin nuevos, orden-gate VERDE.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- (el agente declara el resto por ENMIENDA)

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- docs/CANON-VIDEO.md
- public/comando/analisis-ig.json
- public/comando/comentarios.json
- public/comando/metricas.json
- public/comando/respuestas-comentarios.json
- public/comando/telemetria-sitio.json
- src/cinematic/CinematicMolecule.tsx
- videos/atomo-c.json
- videos/atomo-ne.json
- videos/atomo-si.json
- videos/tutorial-01-nota-de-venta.json
- videos/tutorial-02-alta-de-producto.json
- videos/tutorial-03-alta-de-cliente.json
- videos/tutorial-04-cotizacion.json
- videos/tutorial-05-facturacion-portal.json
- videos/tutorial-06-remision.json
- videos/tutorial-07-editar-nota.json
- videos/tutorial-08-orden-de-compra.json
- videos/tutorial-09-cancelar-nota.json
- videos/tutorial-10-registrar-pago.json
- videos/tutorial-11-factura-desde-erp.json
- videos/tutorial-12-factura-global.json
- videos/tutorial-13-rep-complemento-pago.json
- videos/tutorial-14-calculadora-precios.json
- videos/tutorial-15-nota-de-venta-pro.json
- videos/tutorial-16-detalle-de-producto.json
- videos/tutorial-18-ajuste-masivo-inventario.json
- videos/tutorial-20-pdf-imprimir.json
- videos/tutorial-21-nota-de-credito.json
- videos/tutorial-22-gasto-operativo.json
- videos/tutorial-23-alta-de-proveedor.json
- videos/tutorial-24-buscar-clave-sat.json
- videos/tutorial-25-reportes-jugosos.json
- public/comando/growth.json
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/guiones/atomo-mg.txt
- scripts/guiones/atomo-n.txt
- scripts/playlist-tutoriales.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- videos/tutorial-29-anatomia-producto.json

## EVIDENCIA (se declara ANTES de trabajar)
- piel de acero por pin (8 por pieza) antes → después; captura en corte de la tapa; ciclo-dado-test; tsc; orden-gate.

## CIERRE (2026-10-06 · MEDIDO, no contado)

**Orden vs entregado.** La broca de cada pin y su punta salen ahora de UNA función, `pisoDelPin(pin, respaldo)`
(estudio-molde-datos.ts): la E7 construye la punta ahí y `barrenarInsertos` barrena ahí, pin por pin (antes: un solo
`zPisoMm` = base − pared MEDIANA para las 8 brocas). El hombro/asiento del cuerpo se mueve con su punta. Nuevo
**juez pin ↔ acero** (`juezPinesEnAcero`): la punta TAL CUAL la construye la E7 ∩ el núcleo YA barrenado, en B-Rep
exacto (`common` + volumen), tolerancia 0.01 mm de largo equivalente (regla de Hefestos: la centésima de la cota).
Toma los pines de la E7, no los de la broca: si la broca se va por su lado, truena. Corre en la E8 justo después del
barrenado (0.26–4.0 s), escribe `JUEZ_PINES_ACERO` en consola, va a `ciclo.e3barrenado.juezPinesAcero`, a las notas
del barrenado y a una línea del curso de la E8 («LAS PUNTAS LIBRES» / «⚠ PUNTAS EN EL ACERO»).

**Números (app real dev5 :5196, RTX 4070 Ti, rayo vertical en el EJE de cada pin contra el `nucleo`, la misma
medida de la revisión cruzada; 8 pines por pieza).**

| pieza | piel ANTES (BASE d0e0136) | piel DESPUÉS | juez DESPUÉS | juez con la broca VIEJA (contraprueba) |
|---|---|---|---|---|
| tapa 1594C Lid | 0.86 ×8 | 0 ×8 | VERDE 0/8 · 0.00 mm³ | ROJO 8/8: 0.86 ×6, 0.586 ×2 (3.83 / 2.61 mm³) |
| ensamble 1557BGY | 0.57/0.57/0.66/0.66/0/0/0.66/0.66 | 0 ×8 | VERDE 0/8 | ROJO 8/8: 0.47–0.66 mm |
| carcasa 1594C Box | 0 ×8 | 0 ×8 | VERDE 0/8 | — |
| caja grande 1599HBK | 0 ×8 | 0 ×8 | VERDE 0/8 | — |

- La contraprueba = el código nuevo con SOLO la broca devuelta a la pared mediana (parche temporal en dev5, no en
  la rama): el juez marca los 8 pines en las dos piezas, **incluidos los 2 del ensamble (k4, k5) que el rayo del eje
  leía en 0** (0.55 mm de acero por volumen): el rayo en el eje no los veía; el juez sí. En la tapa k4/k5 dan 0.586
  (la cara sobre ellos no es plana a lo ancho de la punta).
- El estudio de contacto de vóxel (`moldSolidCollisions`, ForgeBRepStudio.tsx — archivo de EL FOCO) NO se tocó:
  bajo 0.6 mm es ruido; el juez nuevo es el que ve la centésima.

**Juzgado con los ojos.** Corte x = cte por el eje del pin 0 de la tapa (núcleo gris, punta ámbar, 1536×864 ·
DPR 2.5): ANTES se ve el techo del barreno como un anillo oscuro que cruza la punta 0.86 mm bajo la cara — la punta
sigue metida en el acero arriba de él; DESPUÉS no hay anillo, la punta sube lisa hasta la cara. La vista de la fila
(los 2 pines de esa x) cuenta lo mismo: el anillo cerca de la punta desaparece en ambos.

**Evidencia.** iangpu `/home/ian/el-plan-dev5/broca/` (`antes/ despues/ contraprueba/` con `<pieza>_<etq>.json` y
capturas `*_corte-cerca-*.png`, `*_corte-fila.png`; `evidencia/tapa_antes-despues_punta.png`; arnés `mide-broca.cjs`
+ `lote.sh`). Copia en `C:\Users\sebas\Downloads\inspeccion-del-molde\la-broca\`.
Cubo: `ciclo-dado-test` **266/266** (después del último cambio). tsc: 67 errores vs 66 de la base; el único nuevo es
`src/comando/Logos.tsx: Cannot find namespace 'JSX'`, que entró con main (no es de esta orden). orden-gate: VERDE.
Sin ACTA R94: no cambió ningún literal del cubo.

**Visto, no es mío.** La tarjeta 7.2 del inspector (`inspecciona-molde.cjs`, de EL FOCO) sigue sin leer este juez:
puede leer `JUEZ_PINES_ACERO` de consola o `ciclo.e3barrenado.juezPinesAcero`.

**Archivos tocados:** `src/forja/mold/estudio-molde-datos.ts` (pisoDelPin, juezPinesEnAcero, barrenarInsertos por pin),
`src/forja/brep/useMoldStudio.ts` (la punta usa pisoDelPin; la broca recibe el piso de cada pin; el juez en la E8),
esta orden.

**Pregunta para ian.**
- *La punta que choca con acero:* cada botador empuja la pieza desde un agujero en el macho; si el agujero se queda
  corto, la punta del botador topa con una tapita de acero y no puede subir hasta la pieza. Hoy, después del cambio,
  la tapita mide **0 mm en los 32 botadores de las 4 piezas** (antes 0.86 mm en la tapa y hasta 0.66 en el ensamble);
  el límite es 0 (una centésima de tolerancia). ¿Quieres que el inspector muestre este juez en su tarjeta 7.2
  (es de EL FOCO)? Recomendación: sí — la tarjeta decía CUMPLE con las 8 puntas topando; que lea el juez exacto.
