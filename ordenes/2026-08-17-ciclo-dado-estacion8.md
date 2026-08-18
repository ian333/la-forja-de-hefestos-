# ORDEN: EL CICLO DEL DADO — estación 8: ENFRIAMIENTO (cap 9)

BASE: 8f0420b

OBJETIVO: **el rey del ciclo**. El motor del cap 9 YA EXISTE COMPLETO
(`coolingDesign()`: los 7 pasos de §9.2 con fórmula + sustitución + resultado
narrados, `fallas` como veredicto). Esta estación NO escribe física nueva:
ata el motor al dado, talla LAS LÍNEAS DE AGUA en el acero, y cobra EL
HALLAZGO que el propio libro anticipa en §9.2.1 (A-179) — y que en el dado
es brutal:

```
   t_c PARED 2 mm   (Eq 9.5)  =  8.5 s
   t_c SPRUE ⌀8.27  (Eq 9.6)  = 69.7 s   ← ×8.2  EL BEBEDERO MANDA
```

Literal del libro: *"the cycle time can be dominated by the cooling of the
cold runners, so it is important to minimize the runner diameters not just
for material savings but also to maintain a productive molding process"*.
El ciclo del dado NO es el de su pared: es el de su colada.

## EL DIBUJO (lo que se verá)
```
   ESCENA E8 · el molde con SU AGUA (corte de vidrio)
   ┌──────────────────────────────────────────────────────────────┐
   │   ═══○═══○═══○═══   líneas lado A (cavidad)  ⌀D a H de la     │
   │        ┌───╨───┐     superficie, pitch W (Eqs 9.15-9.24)      │
   │        │ DADO  │                                              │
   │        └───┬───┘                                              │
   │   ═══○═══○═╧═○═══   líneas lado B (núcleo)                    │
   │   ⚠ interferencia §9.2.7: ½⌀ de acero a bushing/insertos/pins  │
   ├──────────────────────────────────────────────────────────────┤
   │ PANEL CicloE8 — LOS 7 PASOS NARRADOS (fórmula→sustitución→=)  │
   │  1 t_c 8.5 s (Eq 9.5) · pero SPRUE 69.7 s (Eq 9.6) → MANDA    │
   │  2 potencia: m·Cp·ΔT / t_c   3 caudal (Eq 9.13) + controlador │
   │  4 ⌀ [D_min, D_max] → estándar DME  5 H (2D<H<5D + fatiga)    │
   │  6 pitch W (H<W<2H, Menges)  7 ruteo + interferencia          │
   ├──────────────────────────────────────────────────────────────┤
   │ EL VEREDICTO DEL CICLO + las 3 salidas CON DINERO:            │
   │  (a) vivir con ⌀8.27 → 69.7 s      $/pza = ?                  │
   │  (b) bushing MÍNIMO que aún empaca (cruce E6) → 41.1 s        │
   │  (c) sprue CALIENTE (hot bushing) → vuelve a 8.5 s, +molde    │
   └──────────────────────────────────────────────────────────────┘
```

## LO QUE SE CONSTRUYE
1. `estacion8Dado(pkg, d, o?)` en `estudio-molde-datos.ts` (patrón E4-E7):
   - `coolingDesign()` con los números REALES del dado (1 cav, pieza 14.14 cc,
     colada `volumenColadaCc(d)`, pared 2 mm, ABS de `PLASTICOS_A`, P20 de
     `ACEROS_MOLDE`, banda = huella 40 mm, línea = ancho de la base) ⇒ sus
     `pasos` (narrados) y `fallas` entran TAL CUAL al panel.
   - **EL VEREDICTO DEL CICLO**: `max` sobre secciones — pieza por Eq 9.5,
     bebedero por Eq 9.6 (`coolingTimeRod`, ya existente y verificada) —
     con el matiz honesto del libro: *"the runner need not be as rigid as the
     part"* ⇒ el veredicto ADMITE descuento con juicio, y se declara.
   - **LA OPTIMIZACIÓN ACOTADA (el cruce E6↔E8)**: recorrer
     `BUSHING_ORIFICIOS_MM` y elegir el ⌀ MÍNIMO que TODAVÍA empaca
     (`gateFreezeCylS ≥ t_pack`, el criterio de la E6) — dos estaciones
     tirando en direcciones opuestas, resueltas por número. Esperado: ⌀6.35
     (freeze 10.9 s ≥ 8.48 · ciclo 41.1 s = −41 %).
   - **RETORNO a la E2 con DINERO**: la economía usó Eq 3.23 (`4·h²·eff`),
     que sólo ve la PARED y es CIEGA a la colada. Se imprime Δ$/pza =
     (ciclo_real − ciclo_Eq3.23)·tarifa/3600 para las 3 salidas (a)(b)(c).
     DECLARADO: no se re-corre `moldMachine` (su ciclo interno es el de cap 3);
     se reporta el delta con SU tarifa, que es el número que decide.
   - **RETORNO a la E5**: el ⌀ del bebedero ya no lo fija sólo el empaque.
2. `cicloEstacion8` (useMoldStudio, guard estación 7): las LÍNEAS DE AGUA
   como cilindros barrenados REALES (⌀D del diseño, a profundidad H de cada
   cara de moldeo, pitch W, ambos lados) + **check de interferencia §9.2.7**
   medido contra bbox del bushing/insertos/pines (mínimo ½⌀ de acero).
   Botón `btn-ciclo-e8` en `CicloE7` + panel `CicloE8` con LOS PASOS.
   Sin exageración: ⌀6.35 y H≈25 mm SE VEN a escala real (nada de bandera).
3. **Gate** (`ciclo-dado-test.cjs`):
   - ORÁCULOS DEL LIBRO (los 3 impresos, con `ABS_KAZMER` T_eject 97.6 — la
     errata ya cazada y documentada): lid 2 mm = **8.4 s**, cup 3 mm =
     **18.9 s**, runner **⌀4.76** = **22.9 s**. (De paso: el pliego-UI decía
     "⌀6.25" — despejando la Eq 9.6 sale 4.76 = 3/16" DME; se corrige el
     resumen, el libro manda.)
   - EL SPRUE MANDA: t_c(sprue ⌀8.27) ≥ 5× t_c(pared) y el veredicto lo dice.
   - LA OPTIMIZACIÓN: el ⌀ elegido es el MÍNIMO del catálogo con
     freeze ≥ t_pack (y el inmediato inferior VIOLA el empaque).
   - las líneas del diseño respetan 2D<H<5D, H<W<2H y H<k/1000 (Eq 9.22/9.24).
   - INTERFERENCIA: 0 conflictos a ≥½⌀; y CONTROL NEGATIVO: forzar H=1D
     dispara la alarma de fatiga (σ=3.3·P) o pitch 4H dispara la variación
     de flujo de Menges — el veredicto DISTINGUE.
   - los 134 existentes verdes.
4. Video 4K `dado-enfriamiento-4k.mp4` (arnés E8=1 + MOLDE=1): el molde con
   su agua — juzgado + ojos + AMBAS PCs + deploy.

## YA-EXISTE (literal — esta orden casi no inventa)
- `coolingDesign()` (7 pasos §9.2 narrados + fallas) · `tcPlateS` (Eq 9.5) ·
  `coolingTimePlate/coolingTimeRod` + `ABS_KAZMER` (Eqs 9.5/9.6 verificadas
  contra los 3 ejemplos del libro) · `PLASTICOS_A` · `ACEROS_MOLDE` (P20 k=32,
  σ_endurance 456) · `PLUGS_DME` (Tabla 9.2) · `CONTROLADORES` (Tabla 9.1) ·
  `gateFreezeCylS` + `BUSHING_ORIFICIOS_MM` (el cruce con la E6) ·
  `volumenColadaCc` · el patrón estación (filas/anuncios/CicloPanel/cursoPart).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/mold/cooling-design.ts
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
- docs/QUE-HACER-CON-LA-ATENCION.md
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
- gate: los 3 oráculos impresos del libro EXACTOS · el sprue manda · la
  optimización acotada con su cruce E6 · rangos de H/W/D del libro ·
  interferencia + control negativo · 134 verdes · orden-gate VERDE.
- video E8 4K APROBADO (juez + ojos) → AMBAS PCs · deploy · cierre + commit.
- el RETORNO a la E2 impreso CON DINERO (las 3 salidas y su $/pza).

## CIERRE (2026-08-18)
- **Gate 147/147 verdes** (13 nuevos de la E8). ORDEN_GATE VERDE.
- **CINCO ORÁCULOS IMPRESOS del libro, reproducidos exactos** (el motor ya
  existía; esto prueba que dice la verdad): lid 2 mm **8.4 s** · cup 3 mm
  **18.9 s** · runner **22.9 s** (Eq 9.5/9.6, con la errata T_eject 97.6 ya
  documentada) · SCF **3.3** a 1D y **2.6** a 4D · P20 a 4D **175 MPa** ·
  trampa del aluminio QC-7 a 1D **50 MPa** · Menges **<5 %** hasta W=2H y
  **217 %** a 4H. De paso queda CAZADO que el runner del ejemplo es **⌀4.76
  (3/16" DME)**: nuestro `pliego-UI-v2.md` decía "⌀6.25" (daría 39.5 s) — el
  resumen estaba mal, el libro manda (despejado de su propia ecuación).
- **EL HALLAZGO (§9.2.1, el retorno que el libro anticipa)**: t_c pared
  **8.5 s** vs t_c bebedero ⌀8.27 **69.7 s** ⇒ **el bebedero MANDA el ciclo
  ×8.2**. El ciclo del dado no es el de su pieza.
- **EL CRUCE E6↔E8 resuelto por número**: la E6 quiere el bebedero grueso
  (freeze ≥ t_pack) y la E8 delgado (ciclo = dinero). Catálogo: ⌀5.56 empaca
  8.32 s **< 8.48 s VIOLA por 0.16 s**; ⌀6.35 empaca 10.85 s ✓ ⇒ ciclo
  69.7 → 41.1 s (**−41 %**).
- **EL RETORNO A LA E2 CON DINERO — y cambia la arquitectura**: la economía
  cotizó con Eq 3.23 (`4·h²·eff` = 16 s), **ciega a la colada**. Con el ciclo
  real: (a) ⌀8.27 → 69.7 s → **$1.1624/pza** (2.7× lo cotizado) · (b) bushing
  mínimo ⌀6.35 → 41.1 s → **$0.7756** · (c) **bebedero CALIENTE → 8.5 s →
  $0.4230**, MÁS BARATO que el $0.4361 que declaró la E2 con molde frío. La
  estación de enfriamiento **le cambia la arquitectura al molde**.
- **§9.2.7 · LA TRAMPA DE LA FIG 9.9, LITERAL EN EL DADO** (la cazó el ojo en
  el probe y la confirmó el número): con n impar y el patrón centrado, la línea
  del MEDIO pasaba por el eje del bebedero — claro medido **0.00 mm**. Fix por
  el libro (estrategia B: alejar manteniendo pitch:profundidad): correr el
  patrón **½ pitch** ⇒ claro 19.04 mm ≥ 8.9 exigido (r_bebedero + ⌀, o sea ½⌀
  de acero por lado). El bebedero queda ENTRE dos líneas.
- **DOS hallazgos finos de física**: (1) el agua sale **LAMINAR** (Re 865)
  porque la carga es diminuta (17 g cada ~70 s) ⇒ la restricción se INVIERTE y
  **el caudal lo fija la turbulencia**, no el ΔT: 0.237 GPM/línea para Re 4000,
  ΔT real 0.22 °C (uniformidad regalada), 1.42 GPM totales ≤ controlador
  VacTherm — EXTENSIÓN DECLARADA (Eq 9.14 despejada en V̇). (2) el core
  36×37.5 (L/D 1.04) cae en el rango del **BAFFLE** (Tabla 9.3), el remedio
  que el libro prefiere por ser componente estándar.
- **Líneas en el CAD a escala REAL** (⌀4.76 JP-250, H 19.04 = 4.0D, W 38.08 =
  2.0H, 3 por lado, 196 mm de largo): nada exagerado, nada con bandera.
- GOTCHA operativo del día: un `python3 -c` de reemplazo falló en SILENCIO por
  un typo en el patrón y el gate reprobó por "redondeo" — la lección quedó:
  **todo reemplazo lleva `assert` del patrón**, si no es un no-op invisible.
- INCIDENTE: iangpu se apagó a media estación (WSL `Stopped` — el
  `wsl --shutdown` que se propuso para curar drvfs). Revivido por el host
  (`systemctl start ssh tailscaled`) + `lanza-vite.sh`; de paso **los montajes
  /mnt/c y /mnt/e quedaron SANOS otra vez**.
