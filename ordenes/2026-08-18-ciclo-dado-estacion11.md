# ORDEN: EL CICLO DEL DADO — estación 11: ESTRUCTURA (cap 12)

BASE: c68c2fd

OBJETIVO: la estación donde TODO LO QUE PERFORAMOS rinde cuentas. Tres
estaciones haciéndole hoyos al acero (anillo+serpentina+baffle E8b, salidas
de venteo E7, 8 barrenos de pines E10) y el cap 12 pregunta lo incómodo:
¿el acero que quedó AGUANTA? Motores completos ya existen (`structural.ts`,
`platesizing.ts` con flashOk, `cores.ts` hoop, `lamina-vonmises.ts` con
kBarrenoLibro y las ERRATAS P20/QC7 documentadas) — la estación los ATA al
dado con sus barrenos REALES y cierra con el checklist R90 de 3 veredictos.

## LO MEDIDO AL PREPARAR LA ORDEN (los cruces, ya con número)
```
  SOPORTE (pkg): 22 mm · gobierna DEFLEXIÓN · δ = 0.0081 mm < 0.02 = EL
    VENTEO DE LA E7 (flashOk ✓ — la alarma maestra R70, y el ventGap del
    motor ES nuestro vent: el lazo E7↔E11 ya estaba cableado) · 0 pilares
    (la placa aguanta SOLA — declarado, sin ciclo que ejercer aquí)
  K de NUESTROS barrenos (Eq 12.19, R79 "K≈3 aunque esté lejos"):
    agua-A → cavidad (d 13.36):  K 3.17 → σ 124 @39 MPa  ≪ 456 endurance
    baffle → flanco del macho:   K 3.45 → σ 134          ≪ 456
    pin → land de 2 mm (d 0.206): K 84 — EL CASO R81 LITERAL: el modelo
      explota pero "el barreno se apoya en el pin y la grieta se FRENA";
      el riesgo real es OVALIZACIÓN → binding ("abajo del yield ≠ seguro")
  HOOP del macho con su bore de baffle (R83): 53 @39 · 272 @200 MPa ·
    hueco máx 32.9 ≫ 9.53 ✓ · regla P20 (⅔φ y φ/6) ✓ doble veredicto
```

## LO QUE SE CONSTRUYE
1. `estacion11Dado(pkg, d, circuito, e10)` en `estudio-molde-datos.ts`:
   - σ_limit por R68/R69: P20 endurance 456 (con su ERRATA impresa: texto
     450 vs Fig 456 — dos fuentes contra una) · sobrepresión de máquina
     (~200 MPa, un ciclo malo) contra yield ≈ 2×endurance (relación del
     libro R69, declarada como derivada).
   - LADO MÓVIL (R67: el fijo va en compresión pura; el móvil FLEXIONA
     porque el bolsillo del eyector no soporta): compresión del stack
     (R72, "no necesita más consideración" declarado) + la placa de
     SOPORTE del paquete con su flashOk contra EL VENTEO DE LA E7 (R70).
   - LOS BARRENOS NUESTROS (R79/R80/R81): K de Eq 12.19 con las distancias
     MEDIDAS por el juez de la E8b — agua-A, baffle, y el caso R81 del pin
     (ADVIERTE honesto: la grieta se frena en el pin, el riesgo es binding;
     blade R53 anotada por tercera vez).
   - HOOP del macho (R83, cores.ts): doble veredicto fatiga@39 + yield@200.
   - PILARES (R74): n=0 del motor — "la placa aguanta sola" DECLARADO; el
     juez de choque pilar↔pin queda ESCRITO para cuando una pieza los pida.
   - R90 · EL CHECKLIST DE CIERRE con 3 veredictos INDEPENDIENTES:
     (1) no cede a UNA sobrepresión · (2) no fatiga a los ciclos objetivo
     (100k/año, P20 = vida infinita bajo endurance) · (3) no flexiona más
     que el venteo (flash). Cada uno con su número.
   - RETORNO A LA E3: el espesor de soporte del paquete == el del stack
     armado ⇒ NO se reabre (declarado con el número; si engordara, el
     daylight de 8 mm de la E3 se re-juzga).
   - Anuncios: E12 (los 3 veredictos + erratas al acta).
2. `cicloEstacion11` (useMoldStudio, guard estación 10): las COTAS K sobre
   las líneas (agua-A K 3.17 · baffle K 3.45 · pin R81) por la tubería de
   cotas + panel `CicloE11` + botón `btn-ciclo-e11` en CicloE10.
3. **Gate**:
   - ORÁCULO R79: K(⌀ a 1.5⌀) = 3.40 EXACTO (el FEA impreso del libro).
   - ORÁCULO R75 (pilar del libro, consistencia DOBLE con una sola F
     inferida): F=328 kN → ⌀37.5 da 297 MPa y ⌀50 da 167 — ambos impresos.
   - flashOk del soporte con δ 0.0081 < 0.02 (y ventGap == vent E7).
   - K de los 3 barrenos y sus σ vs endurance/yield (el pin como ADVIERTE
     R81, no como CUMPLE mentiroso).
   - hoop doble veredicto + regla P20.
   - CONTROL NEGATIVO R69 (la trampa del aluminio): QC7 SIN ciclos ⇒
     sinLimiteFatiga (no hay σ_limit — el veredicto lo DISTINGUE) y con
     1M ciclos el límite cae a 170.
   - los 168 existentes verdes.
4. Video 4K `dado-estructura-4k.mp4` (CICLO=1 + cadena E11): el ciclo
   completo trabajando CON las cotas K visibles — juzgado + ojos + AMBAS
   PCs + deploy.

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

## EVIDENCIA (declarada antes de trabajar)
- gate: 2 oráculos impresos (K 3.40 · pilar doble 297/167) · flashOk contra
  el vent E7 · K de los 3 barrenos con el R81 honesto · hoop doble · trampa
  del aluminio distinguida · 168 verdes · orden-gate VERDE.
- video 4K APROBADO (juez del ciclo + ojos) → AMBAS PCs · deploy · cierre +
  commit · memoria (R90 firmado; el retorno a la E3 declarado sin reabrir).

## CIERRE (2026-08-18)
- **Gate 175/175 verdes** (7 nuevos E11, a la primera). ORDEN_GATE VERDE.
- **DOS oráculos impresos**: K(1.5⌀) = 3.396 vs "3.4" del FEA del libro
  (EXACTO) · el pilar R75 con consistencia DOBLE: F inferida 328 kN
  reproduce AMBOS números impresos (⌀37.5→297 y ⌀50→167.1 vs 167).
- **La alarma maestra R70, verde y con el lazo YA CABLEADO**: δ del soporte
  0.0081 < 0.02 mm — y el ventGap del motor ES el vent h de la E7 (dos
  estaciones que se hablaban sin saberlo). 0 pilares: la placa aguanta sola.
- **Los K de NUESTROS barrenos** (R79 "K≈3 aunque esté lejos"): agua-A 3.17
  (σ 124 ≪ 456 fatiga · 634 < 912 sobrepresión), baffle 3.45, y el pin K 84
  como **R81 HONESTO** (ADVIERTE, no CUMPLE mentiroso): la grieta se frena
  en el pin; el riesgo real es ovalización→binding; blade R53 anotada por
  tercera vez.
- **Hoop del macho**: 53/272 MPa (doble veredicto), hueco máx 32.9 ≫ bore
  9.53, regla P20 ✓.
- **R90 FIRMADO**: sobrepresión ✓ · fatiga ✓ (P20 = vida infinita bajo
  endurance) · flash ✓ — tres veredictos independientes, cada uno con número.
- **El retorno a la E3, cerrado sin reabrirse**: soporte 22 == 22 mm (la
  Máquina dimensionó consistente desde la E2) — declarado con el número.
- **Control negativo R69**: QC7 sin ciclos = SIN σ_limit (la trampa del
  aluminio, literal) y a 1M ciclos cae a 170 — el veredicto distingue.
- **Las ERRATAS del cap 12 al acta**: P20 450-texto vs 456-figura (mandan
  dos fuentes) · QC7 yield 420 vs 545 en el mismo libro.
- Escena: cotas K sobre el molde + R90 en pantalla; video = EL CICLO
  COMPLETO trabajando con la estructura firmada.
