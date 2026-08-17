# ORDEN: EL CICLO DEL DADO — estación 7: VENTEO (cap 8)

BASE: fcae584

OBJETIVO: los venteos del dado EN LA PARTICIÓN, con el mapa de candidatos
MEDIDO del campo FAN (no de la intención — la trampa del §8.2.2: "las
ubicaciones pueden parecer obvias pero no son triviales"). El aire sale por
donde el plástico llega AL ÚLTIMO, y nuestro `frente` ya lo sabe por celda.
Como E5/E6: **cero fórmulas nuevas inventadas** — Eq 8.2 (h_min), Eqs 8.3–8.4
(h_max con freeze de Tabla 7.4 al espesor del vent), §8.2.1 (V̇_aire = V̇_melt,
heredado VIVO del llenado), §8.2.3 (NO dividir el caudal entre vents), §8.3.1
(anatomía land→alivio→salida + "pocos y delgados" steel-safe), Tabla 8.1 (los
3 handbooks que difieren 10× — nunca un número mágico único).

## EL DIBUJO (lo que se verá)
```
   ESCENA E7 · el dado llenándose en su molde de vidrio + LA PARTICIÓN
   ┌──────────────────────────────────────────────────────────────┐
   │        ║ sprue (arriba)                                       │
   │   ┌────╨────┐   el melt BAJA por las 4 paredes …              │
   │   │  DADO   │   … y llega AL ÚLTIMO a la BOCA (abajo)         │
   │   └─┬─────┬─┘   = EL PLANO DE PARTICIÓN (Fig 7.2: geometría   │
   │  ═══╪═════╪═══     AUTO-VENTEADA — el campo lo DEMUESTRA)      │
   │   [vent] [vent]  4 venteos land→alivio en las posiciones      │
   │                  MEDIDAS del último llenado (⚠ espesor ×20    │
   │                  exagerado con bandera; real: 0.02 mm)        │
   ├──────────────────────────────────────────────────────────────┤
   │ PANEL CicloE7 (filas cap 8):                                  │
   │  · último llenado EN partición: {pct} % (MEDIDO del campo)    │
   │  · mapa: 4 fin-de-flujo OBLIGATORIOS (medidos) + 4 esquinas   │
   │    opcionales (§8.2.2) + knit internas → PIN (anuncio E10)    │
   │  · reparto §8.2.3: V̇/4 por lado y CADA vent con TODO su flujo │
   │  · banda: h_min (Eq 8.2) ≤ 0.02 (§8.3.1) ≤ h_max (Eq 8.3–8.4) │
   │  · Tabla 8.1: Glanvill/Rosato/Menges (difieren 10× — citados)  │
   │  · plan tryout steel-safe: agregar/engrosar (§8.4, patrón 119)│
   └──────────────────────────────────────────────────────────────┘
```

## LO QUE SE CONSTRUYE
1. `estacion7Dado(pkg, d, campo)` en `estudio-molde-datos.ts` (patrón E4-E6):
   recibe el CAMPO del llenado (frente + rejilla + Q) y MIDE: el conjunto de
   último-llenado (top 2 % de llegada entre celdas de PIEZA, membresía por
   `colocacionEnLaBase`+`dentroDadoLocal` — la misma fuente de forma), su
   distancia a la partición (d.zPartMm), el candidato por LADO (centroide del
   último llenado proyectado a la boca), y diseña el vent por lado:
   V̇_local = V̇/4 (simetría; §8.2.3: NO se divide más — cada vent carga TODO
   su flujo local), W=10, land L=2, h propuesto 0.02 (§8.3.1 con moderación),
   h_min por Eq 8.2 (μ_aire 1.8e-5, ΔP 1 atm) y h_max por Eqs 8.3–8.4
   (t_flash = Tabla 7.4 strip AL espesor del vent; rampa ≤100 MPa/s;
   μ_melt ~10 Pa·s shear-thinned; testigo L_flash 0.2 — TODOS del libro).
   DETECTOR de aire fuera de partición: si el último llenado NO cae en la
   partición (dead pocket), lo dice y anuncia pin/inserto (§8.3.2/§8.3.3).
   Anuncios: knit internas → E10 (pin como vent: claro diametral 0.13 mm de
   fits.ts ⇒ vent 0.065 mm, §8.3.2) · plan tryout steel-safe (§8.4).
2. `cicloEstacion7` (useMoldStudio, guard estación 6): construye además los
   CUERPOS de los 4 vents (land dorado + canal de alivio hacia el borde del
   inserto) en las posiciones MEDIDAS — espesor visual ×20 SIEMPRE con bandera
   (patrón E6; el real 0.02 mm es invisible a escala). Botón `btn-ciclo-e7`
   en CicloE6 + panel `CicloE7` (MoldPanels).
3. ForgeBRepStudio: el bloque del encogimiento E6 se ata a `estacion === 6`
   (hoy se ata a `e6` presente y contaminaría la escena E7, que vuelve a ser
   EL LLENADO con los vents visibles).
4. **Gate** (`ciclo-dado-test.cjs`):
   - ORÁCULO del libro Eq 8.2: el ejemplo del bezel (100 cc/s, W=10, L=10)
     reproduce h_min = 0.06 mm EXACTO.
   - ORÁCULO Eqs 8.3–8.4: con los números del libro (t_flash 0.003 s,
     L_flash 0.2) h_max ≈ 0.073 (el libro imprime 0.08 — redondeo declarado).
   - EL CAMPO DEMUESTRA la geometría auto-venteada: ≥90 % del último llenado
     a ≤1.5 celdas de la partición · candidato en LOS 4 lados.
   - banda del dado: h_min ≤ 0.02 ≤ h_max (semáforo de dos lados).
   - reparto §8.2.3: el V̇ de diseño de CADA vent = V̇/4 (no V̇/4/n).
   - CONTROL NEGATIVO: campo con gate EN LA BOCA (invertido) → el último
     llenado migra a la base CERRADA (lejos de partición) → el detector lo
     REPORTA (aire fuera de partición + anuncio pin/inserto). El veredicto
     DISTINGUE.
   - los 127 existentes verdes.
5. Video 4K `dado-venteo-4k.mp4` (arnés E7=1 + MOLDE=1): el llenado completo
   con los vents en la partición — el melt llega al último JUSTO donde están.
   Juzgado + ojos + AMBAS PCs + deploy.

## YA-EXISTE (literal)
- `frente`/`tArrivalS` por celda (fan.ts, la ranura universal) · esPieza /
  dentroDadoLocal + colocacionEnLaBase (membresía y volteo) · gateFreezeStripS
  (Tabla 7.4, para t_flash) · fits.ts claro pin 0.13 mm · el patrón estación
  (filas/anuncios/CicloPanel/cursoPart) · moldVista · el arnés E5/E6.

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/ciclo-dado-test.cjs
- scripts/llenado-video.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
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
- gate: 2 oráculos del libro (bezel Eq 8.2 exacto · h_max ≈ libro) · el campo
  demuestra la partición (≥90 %) · banda de dos lados · reparto sin dividir ·
  control negativo gate-en-boca (el detector distingue) · 127 verdes ·
  orden-gate VERDE.
- video E7 4K APROBADO (juez + ojos) → AMBAS PCs · deploy · cierre + commit.

## CIERRE (2026-08-17)
- **Gate 134/134 verdes** (7 E7 nuevos + los 127). ORDEN_GATE VERDE.
- **Oráculos del libro**: bezel Eq 8.2 → h_min 0.06 mm EXACTO; Eqs 8.3–8.4
  con sus números → 0.073 (el libro imprime 0.08 — redondeo declarado).
- **EL CAMPO DEMOSTRÓ la geometría auto-venteada**: 91.5 % del último llenado
  (top-2 % de llegada) a ≤1.5 celdas de la partición — el volteo de la Fig 7.2
  que la E5 tomó POR LIBRO resultó resolver también el venteo, y ahora está
  MEDIDO, no supuesto. Candidatos simétricos en los 4 lados de la boca:
  (118,98)/(78,98)/(98,118)/(98,78).
- **Banda del dado**: 0.0121 ≤ 0.02 ≤ 0.674 mm (V̇/4 = 4.10 cc/s por vent,
  §8.2.3 sin dividir; t_flash 3.3e-4 s del propio vent — congela ANTES de
  flashear con margen enorme: pared delgada = vent generoso).
- **CONTROL NEGATIVO que distingue**: gate en LA BOCA → solo 7 % del último
  llenado en partición y el dead pocket aparece en (79.3, 97.3, 160.3) —
  contra la base CERRADA, como debe — con su anuncio pin/inserto (§8.3.2/3).
- **Anuncios**: E10 (knit internas → pins como vent, claro 0.13 de fits.ts ⇒
  0.065 mm) · E12 (diferidos-a-tryout declarados, patrón steel-safe 119).
- **Escena**: 4 vents (land dorado + alivio al borde del inserto) TALLADOS en
  la cara de partición en las posiciones MEDIDAS; espesor ×20 SIEMPRE con
  bandera (patrón E6). El colormap del llenado pinta el ámbar (último llenado)
  JUSTO donde están los vents — la física se lee en un cuadro.
- **Video 4K APROBADO 8/8 + ojos en crops 1:1** → AMBAS PCs
  (`dado-venteo-4k.mp4` + `AAA-VENTEO-DEL-DADO-4k.mp4`) + E:\forja-videos
  (vía sshd de Windows — drvfs de iangpu sigue muerto). Deploy con build
  fresco lanzado (deploy-e7.log).
- ForgeBRepStudio: el encogimiento E6 quedó atado a `estacion === 6` (antes se
  ataba a `e6` presente y habría contaminado la escena E7).

## ENMIENDA (2026-08-17, caza de ian: "ese venteo está ENORME")
- Tenía razón: el LAND (10×2×0.02, ×20 rotulado) era del libro, pero el
  ALIVIO lo dibujé como TABLÓN de 10 mm de ancho corriendo 38 mm al borde —
  y la Fig 8.6 dice **canal de alivio de 2 mm + salida ⌀3 barrenada**. Eso no
  era exageración rotulada: era ANATOMÍA INVENTADA. Regla que queda: la
  bandera de exageración SOLO ampara la dimensión declarada (el espesor del
  land); el resto de la anatomía va a PROPORCIÓN DE LIBRO.
- Corregido: alivio 3×12×2 mm (profundo REAL, sin exagerar — 2 mm es su
  tamaño de verdad) + salida ⌀3×12 barrenada hacia abajo (se ve por el molde
  de vidrio). El espesor propuesto 0.02 se defendió con cita (§8.3.1 ·
  Menges 0.015–0.03 en Tabla 8.1) y quedó impreso en la bandera del panel.
- Re-probe 720 APROBADO + ojos (rayitas de maquinista, no tablones) →
  re-render 4K + re-entrega con los mismos nombres.
