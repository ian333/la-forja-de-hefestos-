# La Forja — Catálogo de LIMITACIONES (recrear 196 componentes reales)

Experimento: recrear **a manita, por la interfaz** (SDK `ForjaAgent`) 196 componentes
reales con dimensiones de norma, para descubrir las paredes del tool camino a brazos
robóticos. Driver: `scripts/forja-recrear.cjs` + datos `scripts/componentes-reales.cjs`.

## ⚠️ Honestidad sobre el ORIGEN de los componentes
**No scrapeé 200 planos web.** Lancé 5 agentes para scrapear datasheets pero murieron
cuando la sesión anterior se cayó. Pivoteé y **compilé las dimensiones de mi
conocimiento de las NORMAS publicadas** (DIN/ISO/JEDEC, series de rodamiento, NEMA).
Son valores REALES de norma (un 608 sí mide 8×22×7 mm; un TO-220 sí mide 10.16×4.58×8.7
mm), pero NO salieron de PDFs scrapeados en vivo — salieron de las normas que conozco.
Si se quiere fidelidad literal de datasheet, falta el fetch real (se puede hacer).

## Resultado (snapshot)
~150/196 construidos. Por familia: power 20/20 ✓, gear 10/10 ✓, structural 7/7 ✓,
motor 16/18, fastener 32/41, bearing 26/35, connector 24/30, passive 15/23.
**Las fallas restantes son CRASHES del navegador (transitorias), NO límites del tool.**

## Hallazgo central
> **El KERNEL de geometría es sólido** — la mayoría de las piezas se recrean bien
> (extrude/revolve/círculo/hexágono/barrenos; engranes rectos, paquetes, perfiles).
> **Las paredes están en la capa de ENSAMBLE / RENDER / ROBUSTEZ** — justo la capa que
> debe volverse fuerte para armar mecanismos y brazos robóticos.

## A) Límites de ENSAMBLE / RENDER / ROBUSTEZ (los #1 para robots)
| # | Límite | Evidencia | Qué desbloquea |
|---|---|---|---|
| A1 | **El render se cae con >~6 cuerpos** | DIP-40/headers crashean; topé patas a 6 | modelar paquetes multi-pin, ensambles de muchas piezas |
| A2 | **Componentes solo rotan en Z (`rz`)** | rueda/pata axial/junta acodada no se orientan | ruedas reales, leads axiales, juntas en ángulo |
| A3 | **El heap WASM se degrada tras ~6-8 builds** | la app se desmonta; hubo que recargar cada 3 | que una IA construya 200 piezas sin reiniciar |
| A4 | **`updateComponent` corre detrás de `addComponent`** | componentes quedaban en tamaño default (r25·h60=117810 mm³) | API confiable para scripts/IA |
| A5 | **Crash total del navegador bajo carga** | 34 fallas transitorias = chrome muerto | correr lotes grandes sin perder trabajo |
| A6 | **Un solo material por ensamble** | rueda-de-hule + chasis-aluminio imposible | masa correcta de máquinas multi-material |
| A7 | **Sin juntas / DOF / movimiento** | clevis = horquilla+pasador SIN articulación | mecanismos que se mueven (¡brazos!) |

## B) Límites de MODELADO (cobertura de geometría)
| # | Límite | Piezas afectadas |
|---|---|---|
| B1 | **Sin roscas** | tornillos, tuercas, husillo T8, varilla roscada (salen cilindros lisos) |
| B2 | **Solo engranes RECTOS** | bisel/sinfín/cremallera/dentado-interno no modelables (B) |
| B3 | **Sin internos de rodamiento** | bolas/jaula/pistas (solo anillo macizo) |
| B4 | **No se cortan perfiles T-slot** | extrusión 2020/2040 = barra lisa con barreno (ranuras no) |
| B5 | **Sin devanado helicoidal sobre núcleo** | bobinas/toroides = núcleo desnudo (el sweep-hélice existe pero no envuelve un núcleo) |
| B6 | **Patrón replica el CUERPO, no la feature** | placa con fila de barrenos = fila de placas |
| B7 | **Sin chaflán cónico real / avellanado** | cabeza avellanada aprox cilíndrica |

## C) Lo que el tool SÍ hace bien (no tocar)
Extrude/revolve/loft/sweep exactos · barrenos · perfil libre (hexágonos, levas) ·
**engranes de involuta rectos** (10/10) · paquetes cuerpo+patas (power 20/20) ·
revolves escalonados (flechas, poleas, bridas) · masa exacta del kernel.

## Ruta a BRAZOS ROBÓTICOS (rankeada por impacto)
1. **Juntas + rotación 3-ejes de componentes + DOF** (A2+A7) — el bloqueador #1. Es el
   M2 del plan maestro, ahora con caso de uso concreto. Sin esto no hay mecanismo.
2. **Robustez multi-cuerpo** (A1+A3+A5) — render estable con muchas piezas + WASM que
   aguante muchas ops. Es la pared de infra que tumbó este experimento.
3. **Material por componente** (A6) — masa real de máquinas mixtas.
4. **Roscas + familias de engranes (bisel/sinfín/cremallera) + sweep helicoidal sobre
   núcleo** (B1+B2+B5) — cobertura de geometría para mecanismos reales.

> El experimento mismo fue el mejor test de robustez: la IA manejando el CAD a escala
> reveló que la capa de ensamble/render/automatización es el cuello de botella, no el
> modelado. Eso es exactamente lo que hay que endurecer para que "una IA lo maneje".
