# ORDEN: VALIDACIÓN CONTRA MOLDE REAL — los recibos (superar el estándar)

BASE: 6cb120b

OBJETIVO: encargo de ian — "cumplir y superar los estándares de la industria",
rumbo elegido: VALIDAR CONTRA MOLDE REAL. La industria no valida contra un libro
(fórmulas de Kazmer): valida contra realidad instrumentada. Ya tenemos UNA
validación real (la espiral de la patente US11230635, 552/635/730 mm medidos de
ABS) pero está ENTERRADA como 4 checks dentro del gate de 192. Este turno la
saca a un RECIBO de primera clase: predicho vs medido, con error cuantificado,
citado, y con el ROADMAP honesto de qué observables faltan.

## LA VERDAD (lo que ya se valida, honesto)
- `espiralN2Corrida(T)` (modelo térmico completo: piel erf × Cross-WLF ×
  power-law) corre las 3 isotermas de la patente (238/249/260 °C).
- Contra 552/635/730 mm MEDIDOS: los COCIENTES L(T)/L(238) cuadran ±5 % (la
  física reproduce la FORMA de la curva) y la PENDIENTE dL/dT ±15 %; el offset
  absoluto +13..16 % es sesgo DECLARADO (grado GP22NR del paper vs MG47 nuestro
  + intensificación 10:1 nominal). Es el test de moldeabilidad ESTÁNDAR de la
  industria (spiral flow), desde primeros principios, contra números ajenos.

## LO QUE SE CONSTRUYE
1. `scripts/validacion-industria.cjs` — EL RECIBO: corre el solver contra la
   patente medida y emite una tabla "predicho vs medido" con:
   - longitud de flujo por temperatura + % error + los tests SIN sesgo
     (cocientes ±5 %, pendiente ±15 %) que son la física fina.
   - presión de inyección (pMaxMPa) y tiempo de llenado (tFillS) que el solver
     PREDICE — declarados como PREDICCIÓN (no hay traza de presión medida
     independiente: el paper MDPI PMC8512013 publica gráficas, no tablas).
   - el sesgo sistemático DECLARADO y su causa.
   - VERIFY_RESULT (pasa = física sin-sesgo dentro de tolerancia).
2. `docs/forja-research/VALIDACION-INDUSTRIA.md` — el roadmap: qué observable se
   valida hoy (flujo, real medido), contra qué (patente, citada), y qué falta
   para superar a Moldflow de verdad (traza de presión instrumentada con
   condiciones completas + warp en CMM). Honesto sobre por qué el MDPI no sirve
   como número duro (sin T_melt, sin tabla de presión).

## LO QUE NO SE INVENTA (regla dura)
- CERO números fabricados. Solo la patente (552/635/730, real) como verdad
  ajena. El MDPI se cita como CANDIDATO no-usable-aún, no como dato.
- No se toca el solver ni los motores (es medición, no cambio del modelo).

## TOCA
- (nada)

## CREA
- scripts/validacion-industria.cjs
- docs/forja-research/VALIDACION-INDUSTRIA.md

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/render-clip.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/video.sh
- scripts/guiones/
- scripts/video-subs.py
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- `validacion-industria.cjs` corre y emite el recibo con NÚMEROS REALES
  (predicho vs 552/635/730), cocientes ±5 %, VERIFY_RESULT verde
- VALIDACION-INDUSTRIA.md con el roadmap honesto · orden-gate VERDE
- los 192 del ciclo intactos (no se tocó el solver)

---

## CIERRE (lo que de verdad pasó)

**EL RECIBO FIRMA.** `scripts/validacion-industria.cjs` corre el solver (modelo
térmico N2) contra la espiral MEDIDA de US11230635 y emite predicho vs medido:
640/730/826 vs 552/635/730 mm. La física fina (sin sesgo) cuadra: cociente
L(249)/L(238) **1.141 vs 1.150 medido (±5 %)**, pendiente **8.5 vs 8.1 mm/°C
(±15 %)**, monotónica. Offset absoluto +14.7 % DECLARADO (grado GP22NR vs MG47 +
10:1). VERIFY_RESULT verde.

**HONESTO SOBRE LO QUE FALTA** (VALIDACION-INDUSTRIA.md): una observable (flujo)
contra una fuente (patente). El roadmap para SUPERAR: traza de presión medida
(el MDPI no sirve — gráficas sin T_melt), warp en CMM, 2ª fuente de flujo,
tryout científico. La presión hoy es PREDICCIÓN (~69 MPa fill-limited).

**No se tocó el solver ni los motores** — solo se añadieron 2 archivos nuevos
(script + doc). Los 192 del ciclo quedan intactos POR CONSTRUCCIÓN (cero
ediciones a lo que el gate importa). Sin cambio prod-facing → sin deploy.

**SIGUIENTE**: conseguir un dataset de presión medida (o instrumentar uno) para
añadir la 2ª observable; y/o surface el recibo como panel "recibos vs realidad"
en el CAD (escuela vive en el CAD).
