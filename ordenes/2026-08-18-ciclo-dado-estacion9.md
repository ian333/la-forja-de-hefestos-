# ORDEN: EL CICLO DEL DADO — estación 9: CONTRACCIÓN (cap 10)

BASE: e4e2713

OBJETIVO: pagar la deuda MÁS VIEJA del tren: la escala 1.0 que la E3 dejó
declarada ("splitMold corre HOY con escala 1.0 — la E9 reabre este acero").
El acero se talla ESCALADO por fin — y no con un número mágico, sino con el
PROCESO del cap 10: fuentes confrontadas (§10.1.7), banda §10.1.6, decisión
steel-safe §10.2.2, responsable registrado (R13), y las cotas MEDIDAS del
B-Rep re-tallado (la regla de ian desde la E3: toda dimensión medida del
sólido). El gancho de splitMold espera desde la E3; hoy se jala.

## LA DECISIÓN (el corazón de la estación — R7/R12/R18, declarada aquí)
- FUENTES CONFRONTADAS (§10.1.7, registradas): (1) PROVEEDOR Cycolac MG47:
  0.5–0.8 % lineal; (2) TAIT nuestro a 0.8·p_fill = 1.45 % — LA BRECHA se
  muestra ("no es necesariamente un error", R7: nuestro fill es bajito
  10.7 MPa ⇒ pack débil); (3) TAIT a la PERILLA de la E6 (39 MPa) ≈ 0.8 % —
  cae EN el tope del proveedor: las fuentes CONVERGEN si el proceso empaca
  como la E6 pidió. NUNCA se auto-corrige en silencio.
- ELEGIDA: banda del PROVEEDOR con proceso a la perilla E6 · s esperada
  0.65 % (media).
- STEEL-SAFE §10.2.2 opción (A): CAVIDAD con s bajo (0.5 %) y MACHO con s
  alto (0.8 %) — acero de reserva en los dos: corregir siempre es QUITAR
  acero. Con la advertencia literal del libro: (A) "garantiza maquinado
  posterior" porque el nominal saldrá fuera — se declara, no se esconde.
- RESPONSABLE (R13): ian (diseñador) — el acta E12 hereda la decisión.

## EL DIBUJO (lo que se verá)
```
   ESCENA E9 · el acero RE-TALLADO con su escala, y las COTAS diciéndolo
   ┌──────────────────────────────────────────────────────────────┐
   │        cavidad (s 0.5 %):  boca X  40 → 40.20  ✓ medido       │
   │        macho  (s 0.8 %):  base    36 → 36.29  ✓ medido       │
   │        alto               40 → 40.26 (s media en z: mezcla)   │
   │   ⚠ DESCALCE del shutoff MEDIDO (~0.04 mm/lado): la reserva   │
   │     steel-safe vive en la arista — se ajusta en banco         │
   │     (spotting), como en el taller                             │
   ├──────────────────────────────────────────────────────────────┤
   │ PANEL CicloE9: fuentes confrontadas + banda §10.1.6 + SPI ±.4 │
   │  + pandeo de la tapa (Eq 10.19): pandea si ΔT core↔cav > X °C │
   │    → LA DEFENSA es la E8b (baffle + pitch 2H) — lazo cerrado  │
   │  + anuncios: E10 (s→fuerza de expulsión) · E12 (acta)         │
   └──────────────────────────────────────────────────────────────┘
```

## LO QUE SE CONSTRUYE
1. `construirAceroE3` gana `escala?: { cav: number; core: number }`: corre
   splitMold DOS veces (pieza escalada a 1+s_cav → cavityPlate; a 1+s_core →
   macho+corePlate) — la mezcla steel-safe (A). El DESCALCE que eso crea en
   el shutoff se MIDE y se declara (es la reserva, y en el taller se llama
   spotting). Escala 1.0 por default: la E3 no se mueve.
2. `estacion9Dado(pkg, o?)` en `estudio-molde-datos.ts` (patrón E4-E8):
   filas = LA DECISIÓN (fuentes/brecha/elegida/responsable) · banda §10.1.6
   (motor existente `shrinkageRecommendation`, con su alarma de sobre-empaque)
   · SPI §10.1 (±0.4 % estándar CUMPLE con span del proveedor ±0.15; ±0.1 %
   apretada VIOLA → prototipo, R20/§10.1) · PANDEO de la tapa (Eq 10.19:
   Δs_crit = 0.44(h/W)² = 0.11 %, y con CVTE de Tait (Eq 10.8) el ΔT
   core↔cavidad que lo dispara — la fila CIERRA el lazo con la E8b: baffle +
   pitch W=2H son la defensa) · warp Eq 10.17-10.18 con ΔT=2 °C del ejemplo
   del libro, para calibrar el ojo.
   Anuncios: E10 (R30: s alimenta la fuerza de expulsión — el dato viaja, no
   se reteclea) · E12 (acta: fuente + opción + responsable) · el retorno de
   la E3 se CIERRA (la escala 1.0 pagada).
3. `cicloEstacion9` (useMoldStudio, guard estación 8): re-talla el acero con
   la escala (reemplaza cavidad/núcleo/partición en moldParts), MIDE del
   B-Rep las cotas clave (boca X/Y de la cavidad · base del macho · descalce
   del shutoff) y las manda por la tubería de COTAS 3D de la E3 (doble cifra,
   rojo si no cuadra). Botón `btn-ciclo-e9` en CicloE8 + panel `CicloE9`.
   NADA exagerado: el 0.5 % vive en las COTAS, no en la geometría inflada.
4. **Gate** (`ciclo-dado-test.cjs`):
   - ORÁCULO del libro §10.1.4: el ejemplo impreso 66 MPa → s = 0.31 %
     (nuestro Tait al p_pack del ejemplo lo reproduce).
   - LA BRECHA R7: Tait a 0.8·fill (1.45 %) FUERA del proveedor y Tait a la
     perilla (39 MPa) DENTRO del tope — las fuentes convergen vía la E6.
   - EL TALLADO: cotas del B-Rep = nominal × (1+s) ± tol (cavidad a 0.5 %,
     macho a 0.8 %) y el DESCALCE del shutoff ≈ 40·(s_core−s_cav)/2 medido.
   - PANDEO: Δs_crit 0.11 % y el ΔT crítico > el gradiente que la E8b deja
     (la defensa CIERRA); con ΔT del ejemplo del libro (2 °C) NO pandea.
   - CONTROL NEGATIVO: escala invertida (cav ALTO / core BAJO — el
     anti-steel-safe) produce descalce NEGATIVO (agregar acero = imposible)
     y el veredicto lo DISTINGUE.
   - sobre-empaque: la banda del dado es POSITIVA (la alarma §10.1.6 dormida
     pero VIVA — se prueba con un fill alto sintético que sí la dispara).
   - los 153 existentes verdes.
5. Video 4K `dado-contraccion-4k.mp4` (arnés E9=1 + MOLDE=1 + 📐): el acero
   re-tallado con sus cotas dobles — juzgado + ojos + AMBAS PCs + deploy.

## YA-EXISTE (literal)
- `splitMold(scale)` — el gancho DECLARADO desde la E3 · `shrinkage`/
  `shrinkageRecommendation` (Tait §10.1.2-10.1.6 completo) · `pkg.diseno.
  contraccion` · la tubería de cotas 3D (CotaLines/CotaLabels, doble cifra)
  · `verificacionE3` (el patrón medir-del-sólido) · `construirAceroE3` ·
  el patrón estación completo · perilla E6 (pPackBandaMPa ≈ 39).

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
- gate: oráculo impreso §10.1.4 (0.31 %) · brecha R7 + convergencia vía la
  perilla E6 · cotas del B-Rep escaladas ± tol · descalce del shutoff medido
  · pandeo con la defensa E8b cerrada · control negativo anti-steel-safe ·
  alarma de sobre-empaque probada · 153 verdes · orden-gate VERDE.
- video 4K APROBADO (juez + ojos) → AMBAS PCs · deploy · cierre + commit ·
  memoria (el retorno de la E3 CERRADO).

## CIERRE (2026-08-18)
- **Gate 160/160 verdes** (7 nuevos E9, a la primera). ORDEN_GATE VERDE.
- **ORÁCULO §10.1.4**: 66 MPa → 0.293 % con precisión completa vs 0.31
  impreso — el del libro sale de SU rv redondeado a 4 cifras (0.9907 →
  0.311 %), misma familia de erratas ya cazadas. Banda ±0.03 declarada.
- **La deuda de la E3, PAGADA Y MEDIDA**: splitMold con cav ×1.0050 / macho
  ×1.0080 (steel-safe A) — macho medido ×1.0077 (bbox), hueco de cavidad
  ×1.0121 vs 1.0151 esperado (volumen, ruido de teselado en tolerancia).
  Descalce del shutoff +0.06 mm/lado = la reserva (spotting); control
  negativo: escala invertida da −0.06 (agregar acero = imposible) y se
  DISTINGUE.
- **ENMIENDA a la predicción de la orden** (el motor corrigió mi texto): la
  banda del dado NO es positiva en el límite práctico del libro — el techo de
  pack del §10.1.6 (100 MPa) SOBRE-EMPACA una pieza que llena a 10.7 MPa.
  **La alarma contraintuitiva del libro disparó EN NUESTRO dado**: s=0 a
  ~84 MPa = el techo REAL del proceso, registrado; la perilla E6 (39 MPa)
  trae margen 2.2×. No hizo falta el caso sintético: el real ES el caso.
- **La brecha R7 mostrada**: Tait a 0.8·fill = 1.45 % (fuera del proveedor,
  pack débil — se muestra, no se auto-corrige); a la perilla E6 = 0.79 % —
  las fuentes CONVERGEN en el tope del proveedor. Fuente elegida + opción A +
  responsable (ian) registrados → acta E12.
- **PANDEO de la tapa con su número**: Δs_crit 0.11 % (Eq 10.19) ⇒ ΔT crítico
  core↔cavidad **9.2 °C** (CVTE de Tait, Eq 10.8); warp a 2 °C = 0.095 mm
  (Eqs 10.17-18, consistente con W²/R al 5 %). La defensa es la E8b (baffle +
  pitch 2H) — el lazo agua↔contracción cerrado por número; el gradiente FINO
  queda anunciado al N3.
- **SPI**: estándar ±0.4 % ✓ · apretada ±0.1 % ✗ → prototipo (R12/R20) al acta.
- Escena: acero RE-TALLADO en los mismos roles + cotas 3D de DOBLE CIFRA
  medidas del B-Rep (cavidad por volumen del hueco ∛, macho por bbox,
  descalce impreso). NADA exagerado: el 0.5 % vive en las cotas.
- Video 4K APROBADO + ojos → AMBAS PCs · deploy · commit.
