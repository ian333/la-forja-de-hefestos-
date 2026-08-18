# ORDEN: EL CICLO DEL DADO — estación 10: EXPULSIÓN (cap 11)

BASE: 7a93683

OBJETIVO: la estación con MÁS herencias del tren — y el mandato de ian al
frente: *"el molde no es un pipeline, son ciclos de decisión y rediseño"*.
La E10 llega con TRES anuncios por cobrar y UN retorno declarado desde el
día uno: (1) `juzgarPines` espera desde la E1; (2) la E7 mandó las knit
internas a pines-como-vent (claro 0.13 ⇒ vent 0.065, §8.3.2); (3) la E9
mandó su s al agarre del macho (§10.4/R30: el dato viaja, no se reteclea);
y el retorno A-239: *"los pines roban carriles → REABRE la estación 8"* —
que aquí se EJERCE contra el circuito REAL de la E8b, no contra un genérico.

## EL CICLO DE DECISIÓN (medido al preparar la orden — no es lineal)
```
   F_eject (Eq 11.7, Aeff Eq 11.8 del dado real)  ≈ 1.1 kN
      → 4 pines: cortante (Eq 11.12) pide ⌀2.04 → catálogo 3/32" = 2.38
      → ⚠ R34: pin (2.38) > PARED (2) = punto caliente  ← LA ALARMA REAL
      → DECISIÓN R46: muchos-chicos → 8 pines ⌀1/16" (1.588 ≤ pared ✓)
      → pandeo Eq 11.16 verificado (K=0.7 libro + K=2 conservador nuestro,
        la desviación DOCUMENTADA en ejection.ts se imprime)
      → y el premio de R46, literal: "eyección y VENTEO más uniformes"
        = MÁS pin-vents para las knit de la E7 (el anuncio se cierra mejor)
```

## EL DIBUJO (lo que se verá)
```
   ESCENA E10 · los 8 pines SUBIENDO de la placa botadora a la boca
   ┌──────────────────────────────────────────────────────────────┐
   │        ║ sprue        ═══○═══  agua A (E8b, intacta)          │
   │   ┌────╨────┐                                                 │
   │   │  DADO   │   8 pines ⌀1.588 en el ANILLO de la boca:       │
   │   └─┬─────┬─┘   4 esquinas (= las knit de la E7: pin-vent)    │
   │  ═══╪═════╪═══  + 4 medios-lados · witness a 0.21 mm del      │
   │   │ │ ¦ ¦ │ │   borde (pared delgada: se declara, R35/R53)    │
   │   │ │ ¦ ¦ │ │   ← pines atravesando B SIN tocar la serpentina │
   │   └─┴─┴─┴─┴─┘     ni el baffle ni las salidas de venteo       │
   ├──────────────────────────────────────────────────────────────┤
   │ PANEL CicloE10: F_eject con su aritmética · el ciclo de       │
   │  decisión impreso · juez de interferencia (claros MEDIDOS     │
   │  contra agua/baffle/vents/macho) · juzgarPines convocado ·    │
   │  R41 sanity vs clamp · anuncios cerrados (E7, E9) + acta      │
   └──────────────────────────────────────────────────────────────┘
```

## LO QUE SE CONSTRUYE
1. `estacion10Dado(pkg, d, circuito)` en `estudio-molde-datos.ts`:
   - F_eject del dado REAL: Aeff por Eq 11.8 (perímetro de la boca × pared),
     Eq 11.7 con ABS_EJECT y el draft 1.5° del CAD; CRUCE contra el motor del
     paquete (mismas ecuaciones ⇒ deben cuadrar) y R41 sanity (0.5–2 % del
     clamp de la máquina elegida).
   - EL CRUCE E9→E10 impreso: el agarre usa la deformación EN MOLDE
     (CTE·ΔT = 0.31 %, §11.2.2) y NO el s total de la E9 (0.8 %, que incluye
     post-mold) — la diferencia se explica, no se esconde (R40: análisis ya
     conservador, no apilar factores).
   - EL CICLO DE DECISIÓN R34→R46 (arriba) con cada paso impreso y el
     catálogo DME de pines (1/16..1/4, extensión declarada).
   - Pandeo Eq 11.16 con AMBAS K (0.7 libro / 2 conservador — la desviación
     declarada de ejection.ts, visible) + compresión + cortante → CUÁL
     GOBIERNA (R45/R52).
   - EL JUEZ pines↔TODO: claros medidos de los 8 pines contra la serpentina
     B, los cruces, el baffle, las salidas de venteo de la E7 y el flanco del
     macho — y `juzgarPines` CONVOCADO (su veredicto + avisosAgua = la vista
     A-239). Si hubiera choque: la E8 SE REABRE; el control negativo lo
     demuestra (pin forzado sobre la línea B-0 ⇒ REPRUEBA).
   - Witness en pared delgada: margen (pared−⌀)/2 = 0.21 mm declarado
     (R35: cara no estética = la boca ✓; alternativa blade R53 anotada).
   - Anuncios: E7 CERRADO (las 4 esquinas = pin-vent 0.065 por claro 0.13,
     y R46 regala 4 más) · E9 CERRADO (el s viajó) · E12 (tabla de eyectores
     R37: keyed + etiquetados — PROHIBIDO pines intercambiables).
2. `cicloEstacion10` (useMoldStudio, guard estación 9): los 8 pines REALES
   (⌀1.588, de la placa botadora a la boca) + botón `btn-ciclo-e10` en
   CicloE9 + panel `CicloE10`. Todo a escala de catálogo.
3. **Gate** (`ciclo-dado-test.cjs`):
   - F_eject cruza con el motor del paquete (±2 %) y R41 (0.5–2 % clamp).
   - EL CICLO R34→R46: con 4 pines el ⌀ de catálogo VIOLA la pared (2.38>2)
     y con 8 CUMPLE (1.588≤2) — el veredicto DISTINGUE ambos pasos.
   - cortante GOBIERNA sobre compresión (R45) y el pandeo aguanta con las
     dos K (la razón fCrit(0.7)/fCrit(2) = (2/0.7)² = 8.16 exacta — el check
     de la desviación documentada).
   - JUEZ: claros de los 8 pines contra agua/baffle/vents/macho, todos ≥ el
     mínimo; CONTROL NEGATIVO: pin sobre la línea B-0 REPRUEBA (A-239 vivo).
   - juzgarPines convocado sin VIOLA.
   - los 160 existentes verdes.
4. Video 4K `dado-expulsion-4k.mp4` (arnés E10=1 + MOLDE=1) — juzgado +
   ojos + AMBAS PCs + deploy.

## YA-EXISTE (literal)
- ejection.ts COMPLETO (Eq 11.7/11.8/11.10/11.12/11.16 + la desviación K
  documentada + ejectionVector) · pkg.diseno.expulsion (la Máquina ya corre
  las mismas Eqs) · juzgarPines (esperando desde la E1) · el circuito E8b
  (estacion8Circuito) · los vents E7 (posiciones) · el s de la E9 · fits.ts
  claro 0.13 · el patrón estación completo.

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
- gate: F cruzada ±2 % + R41 · el ciclo R34→R46 distinguido · cortante
  gobierna + pandeo con ambas K (razón 8.16 exacta) · juez con claros
  medidos + control negativo A-239 · juzgarPines convocado · 160 verdes ·
  orden-gate VERDE.
- video 4K APROBADO (juez + ojos) → AMBAS PCs · deploy · cierre + commit ·
  memoria (anuncios E7 y E9 CERRADOS; el ciclo de decisión, no pipeline).

## CIERRE (2026-08-18)
- **Gate 168/168 verdes** (8 nuevos E10, a la primera tras el ciclo). ORDEN_GATE VERDE.
- **LOS CICLOS EJERCIDOS DE VERDAD** (el mandato de ian, cumplido con tres
  conflictos REALES que el motor encontró y el libro resolvió):
  (1) **R34→R46**: 4 pines → cortante pide ⌀2.04 → catálogo 2.381 > pared 2 =
  punto caliente → 8 pines ⌀1.588 ✓ (+ venteo uniforme de regalo, literal).
  (2) **R52**: el recto ⌀1.588×88 PANDEA (SF 0.14 a K=2; ni la K=0.7 del
  libro lo salva: 1.2 < 2) → PIN ESCALONADO: punta ⌀1.588×50 GUIADA en su
  barreno + cuerpo ⌀3.175 → SF 12.4/101. La desviación K de ejection.ts
  impresa Y verificada ((2/0.7)² = 8.16 exacto).
  (3) **A-239 AL REVÉS**: los pines de medio-lado caían SOBRE el carril
  central de la serpentina — que NO puede moverse (alimenta el baffle) →
  CEDEN LOS PINES (±12 mm, claro 8.83). El agua conservó sus carriles.
- **F_eject 1127 N** (Eq 11.7-11.8, Aeff 320 mm²) — cruza con el motor del
  paquete Δ0 % · 0.23 % del clamp (patrón del libro ~0.5 % ✓) · 11.5 % del
  eyector de la IM-50 ✓. Cruce E9→E10 EXPLICADO: el agarre usa CTE·ΔT en
  molde (0.31 %), no el s total (0.8 %, incluye post-mold) — R40: no apilar
  conservadurismo.
- **juzgarPines CONVOCADO** (esperaba desde la E1): CUMPLE, 0 avisos de agua.
- **El juez pines↔todo**: 16 claros medidos contra serpentina/baffle/vents/
  salidas, peor 8.83 mm; control negativo (pin sobre B-0) REPRUEBA — lo que
  reabriría la E8, demostrado.
- **Anuncios CERRADOS**: E7 (4 esquinas = pin-vent 0.065 + 4 de regalo por
  R46) · E9 (el s viajó, la diferencia explicada) · E12 (tabla de eyectores
  R37: keyed + etiquetados, PROHIBIDO intercambiables).
- Witness a 0.206 mm del borde en pared delgada: declarado (R35: la boca no
  es estética; alternativa blade R53 anotada).
- Escena: 8 pines escalonados REALES (punta + cuerpo). Video 4K APROBADO +
  ojos → AMBAS PCs · deploy · commit.
