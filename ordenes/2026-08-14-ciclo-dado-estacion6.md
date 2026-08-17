# ORDEN: EL CICLO DEL DADO — estación 6: EMPAQUE (cap 7)

BASE: d6b66ff

OBJETIVO: la estación que el anuncio de la E4 lleva TRES estaciones esperando:
*"la compuerta CONGELA antes de terminar de empacar"*. El empaque compensa la
contracción pvT manteniendo presión (LA FASE 2 del switchover, recién forjada y
validada contra Washburn) hasta que la compuerta congela y aísla la cavidad.
Como la E5: **NO se escribe ninguna fórmula nueva** — los motores existen:
`gating.ts` (freeze Tabla 7.4, veredicto §7.3.4), `shrinkage.ts` (**ABS_TAIT pvT
real**, ya usado por factory a 0.8·p_fill), `fan.ts` fase 2 (presión impuesta,
Q decae), t_c de pared (Eq 9.5).

## EL DIBUJO (lo que se verá — para aprobar ANTES de construir)

```
   ESCENA E6 · el dado LLENO dentro del molde de vidrio (la vista nueva)
   ┌──────────────────────────────────────────────────────────────┐
   │              ║ bebedero (P_pack sostenida: 0.8·p_fill)        │
   │        ┌─────╨─────┐                                          │
   │        │  EL DADO  │   ← lleno al 100 %, ahora EMPACANDO:     │
   │        │  (cubo)   │     el colormap cambia a PRESIÓN DE      │
   │        └───────────┘     EMPAQUE alcanzada por zona           │
   │   ⏱ LA COMPUERTA: congela en {freezeS} s                     │
   │      la pieza necesita {tPackNeededS} s  →  VEREDICTO         │
   ├──────────────────────────────────────────────────────────────┤
   │ PANEL CicloE6 (filas cap 7, patrón E4/E5):                    │
   │  · p_empaque = 0.8·p_llenado (§7.3, la de factory)    CUMPLE  │
   │  · freeze del gate (Tabla 7.4) vs empaque necesario   ⚠/✓     │
   │  · EL RETORNO RESUELTO: gate steel-safe AGRANDADO →           │
   │    re-freeze ≥ t_pack — el anuncio de la E4 se CIERRA aquí    │
   │  · contracción pvT (Tait ABS): % lineal + moldScale → ANUNCIA │
   │    a la E9 (la escala 1.0 de la E3 por fin tiene su número)   │
   │  · masa del disparo: pieza + colada (venta a la E2/costos)    │
   │  · Q de compensación (fase 2): decae — la curva de máquina    │
   └──────────────────────────────────────────────────────────────┘
```

## LO QUE SE CONSTRUYE
1. `estacion6Dado(pkg, e5datums)` en `estudio-molde-datos.ts` (patrón estacion4/5):
   filas del cap 7 con los motores existentes — p_pack (0.8·p_fill como factory),
   y EL GATE REAL: tras el volteo Fig 7.2 el gate del dado es el SPRUE DIRECTO
   (no el edge genérico de la máquina) — freeze del cilindro (Tabla 7.4) al
   ⌀base del bebedero vs t_pack necesario (Eq 9.5, alimentacion.tcPartS).
   **El RETORNO RESUELTO — y honesto**: el sprue NO es agrandable en tryout
   (GATE_AGRANDABLE: lo fija el bushing) ⇒ la resolución es de DISEÑO: elegir
   el ORIFICIO DE BUSHING estándar (catálogo en 1/32": 2.38/3.18/3.97/4.76/
   5.56/6.35 mm — EXTENSIÓN DECLARADA) que dé freeze ≥ t_pack, con la cadena
   impresa (de ⌀X a ⌀Y) y el costo anunciado (más colada = más regrind, a la
   fila §6.2.3 de la E5); contracción pvT (shrinkage/ABS_TAIT a p_pack real)
   con su ANUNCIO a la E9; masa del disparo.
   **LA EXAGERACIÓN CON BANDERA (pedido de ian)**: la contracción visual va
   ×EXAG (default 20) con el rótulo permanente "⚠ CONTRACCIÓN EXAGERADA ×20
   (real: X %)" — práctica estándar de la industria (Moldflow pinta el warp
   escalado y SIEMPRE rotulado). El número real manda en filas y gates; la
   exageración es SOLO del ojo, y jamás sin bandera.
2. `cicloEstacion6` (useMoldStudio) + botón `btn-ciclo-e6` + `CicloE6` (MoldPanels,
   patrón CicloE5): el panel de filas + el veredicto del anuncio.
3. **La ESCENA del empaque**: el dado LLENO (frente a t=1) mientras el reloj del
   video maneja la CONTRACCIÓN exagerada — el fundido se ENCOGE dentro del acero
   fijo (escala 1 → 1−s·EXAG·t sobre el centro de la pieza) y el hueco que se
   abre ES la historia del empaque (por eso se sostiene presión). Bandera visible.
   DECLARADO: la curva Q(t) del empaque con sumidero térmico por celda es del N2
   (sin compresibilidad/sumidero, el Q de empaque de un dominio lleno es 0 — no
   se finge); el reloj del empaque aquí es el freeze del gate (Tabla 7.4).
4. **Gate** (`ciclo-dado-test.cjs`):
   - las filas E6 cuadran con los motores (freeze de Tabla 7.4 reproducido,
     p_pack = 0.8·p_fill, contracción = shrinkage(ABS_TAIT) al mismo p_pack).
   - EL RETORNO: con el gate original freezeCorto=true; con el agrandado,
     re-freeze ≥ t_pack (y el ⌀ nuevo es un paso ESTÁNDAR, no inventado).
   - contracción ABS en banda de datasheet (0.5–0.8 % lineal — Cycolac MG47).
   - CONTROL NEGATIVO: una pared el doble de gruesa exige más empaque y vuelve
     freezeCorto al gate agrandado (el veredicto DISTINGUE).
   - los 110 existentes verdes.
5. Video 4K `dado-empaque-4k.mp4` (arnés E6=1 + MOLDE=1): el dado lleno
   sosteniendo presión, la cuenta regresiva del gate — juzgado + AMBAS PCs + deploy.

## YA-EXISTE (los motores, literal)
- `gateDesign/gateFreezeCylS/gateFreezeStripS` (Tabla 7.4 · §7.3) y el anuncio
  freezeCorto en `pkg.diseno.gate` · `shrinkage(ABS_TAIT, {tNoFlowK, pPackPa})`
  (factory lo usa a 0.8·dP) · `fan.ts` fase 2 (Washburn 0.5 %) · t_c Eq 9.5 ·
  el patrón estación (filas/anuncios/CicloPanel) · la vista MOLDE del video.

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
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- gate: filas E6 contra motores · el RETORNO resuelto con ⌀ estándar + su control
  negativo · contracción en banda de datasheet · 110 existentes verdes ·
  orden-gate VERDE.
- video E6 4K APROBADO (juez + ojos) → AMBAS PCs · deploy.
- el anuncio de la E4 queda CERRADO en el panel (con la cadena de decisión impresa).

## CIERRE (2026-08-17)
- **Gate 117/117 verdes** (los 7 E6 incluidos: freeze Tabla 7.4 al ⌀8.27 = 18.4 s ≥
  t_pack 8.48 s → el anuncio de la E4 CERRADO por la Fig 7.2; p_pack = 0.8·p_fill;
  contracción = shrinkage(ABS_TAIT) 1.45 % con perilla ~39 MPa a banda; masa 17.1 g;
  RETORNO edge-genérico-VIOLA / sprue-CUMPLE; control pared ×2 → ningún bushing
  aguanta, como debe). ORDEN_GATE VERDE.
- **El bug del primer render (REPROBADO, fundido invisible)**: el bloque E6 de la
  escena leía `e5datums.zBaseCerradaMm`, campo que NO existe en `DatumsColada`
  (es de `colocacionEnLaBase`) → `undefined − 20 = NaN` → posición NaN → Three no
  dibuja → frames idénticos. Lo cazó el criterio "LA IMAGEN CAMBIA" del juez. Fix:
  centro real por el volteo, `zPartMm + 19.75`. `vite build` no typechecka — por
  eso compiló; comentado en el código.
- **Video 4K APROBADO 8/8** (probe 720 primero, regla del peek) + OJOS con crops
  1:1 del master: el dado LLENO se despega de las 4 paredes de la cavidad al
  encoger (k=0.71 = ×20 de 1.45 %), bebedero retraído dentro del tubo dorado,
  bandera "⚠ CONTRACCIÓN EXAGERADA ×20 (real: 1.45 %)" visible TODO el video.
- **Entrega**: Downloads\FORJA-DADO en AMBAS PCs (`dado-empaque-4k.mp4` +
  `AAA-EMPAQUE-ENCOGIMIENTO-x20-4k.mp4`) + E:\forja-videos. ⚠ INCIDENTE: los
  montajes drvfs (/mnt/c, /mnt/e) de la WSL de iangpu murieron con EIO (canal 9p
  wedged; ni el remount root los revive) — la entrega a esa PC salió por el sshd
  de WINDOWS (100.116.134.86) directo a C:/E:. El fix de fondo (`wsl --shutdown`)
  mata vite y jobs de la otra sesión → decisión de ian, NO se ejecutó.
- Deploy lanzado desacoplado (deploy-e6.log). PREEXISTENTE enmendado:
  `scripts/render-clip.cjs` (captura cdp-jpeg de la sesión paralela, 2026-08-17).
