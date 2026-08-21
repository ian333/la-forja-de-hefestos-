# ORDEN: EL CICLO DEL DADO — estación 12: EL ACTA (§13.10) — SE FIRMA EL CUBO

BASE: 79d5505

OBJETIVO: la estación que NO calcula — COBRA. R92 literal: "las decisiones
críticas se APRUEBAN y DOCUMENTAN entre todas las partes con entendimiento
común de costos, beneficios y riesgos — acta + registro de decisiones.
ENTREGABLE". Once estaciones dejaron decisiones a medias, retornos cerrados,
erratas cazadas y deudas declaradas: el acta los junta EN UN DOCUMENTO, con
el plan de tryout steel-safe unificado (R119: "especifica corto, prueba,
crece") — y con eso EL CUBO QUEDA CERRADO, listo para calar otras figuras.

## LO QUE FIRMA EL ACTA
1. **LA ARQUITECTURA (la decisión estrella, E2→E8)**: bebedero CALIENTE —
   costo: molde más caro (la variante hot de la E2, número impreso);
   beneficio: $0.423/pza vs $1.162 del frío con ciclo real + cero colada/
   regrind; riesgo: mantenimiento del hot tip. PLAN B documentado: frío con
   bushing ⌀6.35 (el mínimo que empaca, cruce E6↔E8) a $0.776.
2. Contracción (E9): proveedor 0.5–0.8 con perilla 39 MPa · opción A
   steel-safe · responsable ian · techo del proceso 84 MPa (s=0).
3. Venteo (E7): 4 fin-de-flujo 0.02 mm + esquinas DIFERIDAS a tryout ·
   knit → pines.
4. Expulsión (E10): 8 escalonados ⌀1.588/3.175 · tabla keyed R37.
5. Estructura (E11): R90 (sobrepresión·fatiga·flash) con sus números.
6. Proceso: pack 39 MPa (banda proveedor) · techo 84 · masa 17.1 g como
   observable de báscula.
+ **RETORNOS CERRADOS** (los ciclos, contados y con su historia de una
  línea: E4→E6, E3→E9, E2→E8, E7→E10, E9→E10, E8b↔E10 A-239, E8→E9
  pandeo, E5→E6 Fig 7.2, E7→E11 ventGap…)
+ **ERRATAS DEL LIBRO cazadas** (T_eject 97.6 · Tabla 7.4 strip ×2 · P20
  450/456 · QC7 420/545 · rv 0.31 · y el ⌀4.76 de NUESTRO pliego)
+ **PENDIENTES DECLARADOS** (N2b pvT · N3 campo térmico del molde ·
  prototipo si ±0.1 % · deudas chicas)
+ **EL CONTEO**: 11 estaciones · 175 checks · ≥15 números impresos del
  libro reproducidos · los ciclos ejercidos.

## LO QUE SE CONSTRUYE
1. `estacion12Dado(pkg, d)` en `estudio-molde-datos.ts`: RE-CORRE los
   motores puros de las estaciones (E6-E11, sub-segundo — sin FAN) y arma
   `ActaDado`: decisiones (cada una con costo/beneficio/riesgo/responsable,
   R92), retornos cerrados, tryout R119, pendientes, erratas, conteo, y el
   VEREDICTO: FIRMADO solo si las ONCE estaciones entregan — un acta
   incompleta se declara INCOMPLETA (control negativo del gate).
2. `cicloEstacion12` (useMoldStudio, guard estación 11) + botón
   `btn-ciclo-e12` en CicloE11 + panel `CicloE12` (el acta rendida).
3. **Gate**: FIRMADO con 11/11 · la arquitectura con LOS DOS números ·
   decisiones ≥6 todas con responsable · retornos ≥8 · erratas ≥5 · tryout
   ≥5 pasos steel-safe · CONTROL NEGATIVO: acta sin una estación ⇒
   INCOMPLETO (el acta no firma huecos) · los 175 existentes verdes.
4. Video 4K `dado-acta-4k.mp4` (CICLO=1 + cadena E12): el ciclo completo
   trabajando con EL ACTA en pantalla — el video de cierre del cubo.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- scripts/ciclo-dado-test.cjs
- scripts/llenado-video.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
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
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json

## EVIDENCIA (declarada antes de trabajar)
- gate: FIRMADO 11/11 · arquitectura con números · retornos/erratas/tryout
  contados · control negativo INCOMPLETO · 175 verdes · orden-gate VERDE.
- video 4K APROBADO → AMBAS PCs · deploy · cierre + commit · memoria:
  **EL CUBO CERRADO — listo para calar otras figuras**.


---

## CIERRE (lo que de verdad pasó)

**FIRMADO.** `estacion12Dado(pkg, d)` re-corre los motores puros de las once
estaciones (sub-segundo, sin FAN) y arma el acta: **11 estaciones · 6
decisiones · 9 retornos cerrados · 6 pasos de tryout · 6 erratas · 4
pendientes**. Veredicto `FIRMADO` solo si las once entregan; con `omitir:'e10'`
el acta se declara `INCOMPLETO` y no firma nada — el control negativo del gate.

**Gate: 181/181 verdes** (los 175 previos + 6 de la E12).

**EL DEFECTO QUE CAZARON MIS OJOS EN LA SONDA 720p.** El gate daba verde y el
juez del arnés daba verde, y el video estaba MAL: el acta vivía en el registro
del curso — 11 px, gris sobre gris, con encabezado ajeno ("curso Alwis · paso
12/6") encima y CORTADA por el panel de abajo. Un acta que no se lee no cobra.
Arreglo: el acta se rotula EN LA ESCENA con el mismo mecanismo de cotas de la
E11 (un cambio, no una UI nueva) — tres líneas: el veredicto con el conteo, la
arquitectura con LOS DOS números, y el tryout/erratas/pendientes. Y el arnés
ganó un juez que MIDE que estén visibles, dentro del cuadro y con tamaño de
letra legible — porque el juez viejo aprobaba un acta invisible.

Se les quitó el sufijo `11 = 11 ✓` del formateador de cotas: el acta DECLARA,
no mide, y un "= ✓" ahí finge una verificación que no existe.

**GOTCHA NUEVO (costó dos corridas):** `vite` DEV con `VITE_NO_WATCH=1` sirve
el módulo VIEJO aunque el archivo ya esté en disco — el juez cazó "0/3
etiquetas" con el código nuevo sincronizado. Se ve con
`curl -s http://127.0.0.1:5178/src/.../useMoldStudio.ts | grep <lo nuevo>`.
Cura: matar vite POR PID (un `pkill -f "vite ..."` desde ssh mata también la
propia shell del ssh), `rm -rf node_modules/.vite` y relanzar con `--force`.

**Corrección honesta:** `conteo.checksGate` decía 175 (los checks ANTES del
acta). Ahora dice **181** — el número que cualquiera reproduce corriendo
`node --import tsx scripts/ciclo-dado-test.cjs`.

**Video 4K:** `dado-acta-4k.mp4` — 3840×2160, el ciclo completo TRABAJANDO
(llenar → abrir 100 mm → expulsar 48 mm) con el acta legible en el cuadro.
12/12 checks del arnés.

**EL CUBO QUEDA CERRADO** — listo para calar otras figuras.
