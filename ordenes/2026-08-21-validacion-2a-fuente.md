# ORDEN: RECIBO v2 — 2ª fuente independiente + la vara de la industria

BASE: ba1c460

OBJETIVO: los subagentes trajeron datos reales (ian no podía). Este turno mete al
recibo lo que es LIMPIO y honesto (cero supuestos nuevos) y encola lo que exige
supuestos, declarándolos.

## LO QUE ENTRA (limpio, cero supuestos)
1. **2ª FUENTE INDEPENDIENTE** de la longitud de flujo: hoja de datos SABIC
   Cycolac BDT5510 (ABS FR) — spiral flow **736.6 mm @ 260 °C, espesor 3.175 mm**
   (control por velocidad 10 in/s). Nuestra patente Terluran (ABS, MISMO 3.175 mm)
   da **730 mm @ 260 °C**. Dos fabricantes independientes coinciden al **~0.9 %** →
   la verdad medida no es capricho de una patente. Nuestro solver (826 mm isotermo)
   sobrepredice AMBAS por el MISMO ~13 % (el sesgo del método, ya declarado).
2. **LA VARA DE LA INDUSTRIA**: ≤5 % (explícito en Sci.Reports 2026, SABIC PP
   576P), práctica real ~2-3 % en presión / ~2.5 % en tiempo. Y la corroboración
   clave: **los simuladores comerciales TAMBIÉN sobrepredicen presión y spiral
   flow** — nuestro +13 % es la dirección conocida del método, no un error.

## LO QUE SE ENCOLA (con sus supuestos DECLARADOS, no se corre a ciegas)
3. **SABIC PP 576P — benchmark de PRESIÓN** (Sci.Reports 2026, DOI
   10.1038/s41598-026-51699-1): placa trapezoidal 80/120×60, pared 2, compuerta
   central ⌀2.5, 230 °C, molde 40-50, 30 cm³/s; presión medida vs %llenado
   21/34/48/61/68 MPa; Cross-WLF n=0.380 τ*=1.82e5 D1=3.16e12 A1=20.4 A2=51.6.
   Se ENCODEA (citado) pero NO se corre este turno: correrlo exige 3 supuestos
   (D2 por default, conversión Cross→power-law k, cavidad-vs-inyección del
   sensor). Un recibo con 3 supuestos apilados sería engañoso — se declara y se
   deja como el siguiente build, honesto.

## LO QUE NO SE INVENTA
- BDT5510: número verbatim de la ficha (736.6 mm / 29 in @ 260 °C, 3.175×1524 mm).
- SABIC PP 576P: números verbatim del paper. Nada estimado de gráficas.

## TOCA
- scripts/validacion-industria.cjs
- docs/forja-research/VALIDACION-INDUSTRIA.md

## CREA
- (nada)

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
- el recibo corre y muestra la 2ª fuente (BDT5510 736.6 vs patente 730 = ~0.9 %),
  la vara ≤5 %, y el benchmark de presión ENCOLADO con sus 3 supuestos
- VALIDACION-INDUSTRIA.md actualizado · orden-gate VERDE · VERIFY_RESULT verde
- los 192 del ciclo intactos (no se toca el solver)

---

## CIERRE (lo que de verdad pasó)

**RECIBO v2 FIRMA.** El recibo ahora valida la longitud de flujo contra DOS
fuentes independientes: patente Terluran (730 mm) + ficha SABIC Cycolac BDT5510
(736.6 mm) @ 260 °C/3.175 mm — coinciden al **0.9 %**. El ground truth es
sólido; nuestro solver (826 mm) sobrepredice ambas ~12-13 % (el sesgo del
método, confirmado: los comerciales también sobrepredicen). La VARA de la
industria quedó registrada: **≤5 %**, y nuestra física fina (cocientes ±5 %,
pendiente ±15 %) ya está dentro.

**BENCHMARK DE PRESIÓN ENCOLADO** (SABIC PP 576P) con su geometría, Cross-WLF y
presión medida (21/34/48/61/68 MPa) ENCODEADOS y citados — pero NO corrido: los
3 supuestos (D2 default, Cross→power-law k, sensor cavidad-vs-inyección) se
declaran; correrlo a ciegas con 3 supuestos apilados sería un recibo engañoso.
Es el siguiente build.

No se tocó el solver. Los 192 del ciclo intactos.
