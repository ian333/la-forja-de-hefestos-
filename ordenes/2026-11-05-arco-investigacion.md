# ORDEN F: diez agentes investigan el arco desde el Operador Ian

ESTADO: hoy. ian presente: «DALE RECIO, YO LANZARÍA HASTA 10 AGENTES EN INVESTIGACIÓN, VER LAS POSIBILIDADES DESDE EL OPERADOR IAN».

BASE: d675896

OBJETIVO: diez reportes con números (y los scripts que los reproducen) que respondan las preguntas de ian:
- **Menos componentes y más control:** 05, 06 y 04.
- **Millones de ondas:** 01.
- **Concentrar la energía en la punta:** 02.
- **Una atmósfera propia hecha con campos:** 03.
- **El charco como segunda campana:** 07.
- **Límites térmicos, de precisión y de velocidad:** 08.
- **El campo real y el arc blow:** 09.
- **Lo que ya existe y la seguridad:** 10.

Solo docs y scripts de cálculo. No se toca la app. El contexto común está en `docs/investigacion-arco/00-CONTEXTO.md`.

## YA-EXISTE (prueba de ausencia)

- Canon de la gota y canales del operador: `scripts/canon/` (campanazo, canales, apuntar; bombeo 2ω FALSADO sin retroalimentación).
- Circuito La Pluma simulado: `scripts/la-pluma/`. Revisión del operador del 31 de octubre: `scripts/operador-revision-impresora-2026-10-31.*`.
- El modelo en TS (`src/forja/brep/arcoFisica.ts`) y su prueba.
- NO existen: un estudio de control óptimo multimodo, el sensado sin sensores, la atmósfera con campos, el charco como resonador, el arc blow del banco, la arquitectura mínima ni la revisión de lo que ya existe y la seguridad.

## TOCA

- (nada)

## CREA

- docs/investigacion-arco/00-CONTEXTO.md
- docs/investigacion-arco/11-SINTESIS.md
- docs/investigacion-arco/01-ondas-control-optimo.md
- scripts/investigacion-arco/01_ondas_control_optimo.py
- scripts/investigacion-arco/01_ondas_control_optimo.out
- docs/investigacion-arco/02-energia-en-la-punta.md
- scripts/investigacion-arco/02_energia_en_la_punta.py
- scripts/investigacion-arco/02_energia_en_la_punta.out
- docs/investigacion-arco/03-atmosfera-con-campos.md
- scripts/investigacion-arco/03_atmosfera_con_campos.py
- scripts/investigacion-arco/03_atmosfera_con_campos.out
- docs/investigacion-arco/04-sensado-sin-sensores.md
- scripts/investigacion-arco/04_sensado_sin_sensores.py
- scripts/investigacion-arco/04_sensado_sin_sensores.out
- docs/investigacion-arco/05-componentes-minimos.md
- scripts/investigacion-arco/05_componentes_minimos.py
- scripts/investigacion-arco/05_componentes_minimos.out
- docs/investigacion-arco/06-operador-canales-control.md
- scripts/investigacion-arco/06_operador_canales_control.py
- scripts/investigacion-arco/06_operador_canales_control.out
- docs/investigacion-arco/07-charco-resonante.md
- scripts/investigacion-arco/07_charco_resonante.py
- scripts/investigacion-arco/07_charco_resonante.out
- docs/investigacion-arco/08-limites-termicos-precision.md
- scripts/investigacion-arco/08_limites_termicos_precision.py
- scripts/investigacion-arco/08_limites_termicos_precision.out
- docs/investigacion-arco/09-campo-real-arc-blow.md
- scripts/investigacion-arco/09_campo_real_arc_blow.py
- scripts/investigacion-arco/09_campo_real_arc_blow.out
- docs/investigacion-arco/10-estado-del-arte-seguridad.md
- scripts/investigacion-arco/10_estado_del_arte_seguridad.py
- scripts/investigacion-arco/10_estado_del_arte_seguridad.out

## BORRA

- (nada)

## PREEXISTENTE

- public/comando/
- public/precomputed/
- public/modelos/banco-arco/
- public/temis-deploy.json
- public/temis.json
- videos/
- scripts/guiones/
- scripts/canon/
- scripts/la-pluma/
- models/step/banco-arco/
- docs/PLAN-MVP-LA-PLUMA.md
- scripts/forja-multicuerpo-diag.cjs
- scripts/precompute-banco-arco.cjs
- scripts/arco-fisica-prueba.cjs
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/ArcoVivo.tsx
- src/forja/brep/arcoFisica.ts
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/operador-revision-impresora-2026-10-31.out
- scripts/operador-revision-impresora-2026-10-31.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh
- src/lib/physics/em.ts
- src/lib/physics/campoB.worker.ts
- src/lib/physics/__tests__/em.test.ts
- src/forja/brep/CampoReal.tsx
- ordenes/

Los archivos de `src/` de arriba son de la orden G (`2026-11-05-campos-reales-banco-v2`), que corrió en paralelo con esta.

## EVIDENCIA (se declara ANTES de trabajar)

- Cada reporte trae:
  - la respuesta corta con números;
  - tablas de telemetría;
  - un veredicto PASA / FALSA / INCIERTO por hipótesis;
  - qué cambia en el banco, el circuito o el firmware;
  - el experimento más barato que lo decide, con números predichos.
- Cada número sale de su script (`.py` con su `.out`) o de una fuente citada con URL.
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-05-arco-investigacion.md` en VERDE.
- Censo: canvas, vite y html sin cambio.

## CIERRE (se llena al terminar)

- **orden vs entregado:**
  - Los 10 reportes con su script y su `.out`, más la síntesis `11-SINTESIS.md`: un solo plan, las contradicciones resueltas y el orden de 9 experimentos (E0–E8).
  - Se borró un `__pycache__` que dejó un agente.
  - No se tocó la app.
- **números (los que cambian el plan):**
  - **01 · ondas:** «millones de ondas» FALSA. Bang-bang en fase da 100 % en 4.8 ciclos, contra 70 % del chirp a ciegas.
  - **02 · energía en la punta:** no hay resonancia que concentre energía en la punta; 40 A funden ~1.8 m/min, no 3.
  - **03 · atmósfera:** no se puede una atmósfera de campos; 3 mT tuercen el arco 50–70°.
  - **04 · sensado:** contacto en 11 µs; E (V/mm) en duda.
  - **05 · componentes:** 63 → 47 piezas.
  - **06 · canales:** con I sola, rango 8/13; ventana de 40–45 A.
  - **07 · charco:** canta a 310–680 Hz → pasa-altas de 450 Hz.
  - **08 · límites:** escoria ≈0.38 mm³/mm³ = bloqueo; cubo de 20 mm en 17–87 min.
  - **09 · arc blow:** B en el arco 0.17–0.33 mT por la placa; apuntar la gota con campo FALSA.
  - **10 · estado del arte:** el núcleo ya existe (Kentucky 1997–2002); la LRS pide 180–305 Vac; el riesgo #1 es el Mn.
- **evidencia:**
  - Los scripts corrieron en la laptop o en iangpu y los `.out` traen la telemetría cruda.
  - Las fuentes están citadas con URL en cada reporte.
  - `node scripts/orden-gate.cjs --orden ordenes/2026-11-05-arco-investigacion.md` en VERDE.
- **preguntas abiertas:**
  - Todo es modelo y literatura, falta medir en el banco.
  - Los decisivos son E2 (la quema, para fijar E) y E3 (100 golpecitos: si el oído existe).
  - Lo que falta de ian: el motor del alimentador (voltaje y medidas), si hay contacto de 220 V, y la decisión de cambiar a E71T-11 o a gas para piezas estructurales.
