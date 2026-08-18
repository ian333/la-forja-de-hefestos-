# ORDEN: E10b — EL CICLO EN MOVIMIENTO (la máquina TRABAJANDO)

BASE: 50e89d4

OBJETIVO: ian: *"nunca los veo funcionando :D jamás"* — y es verdad: diez
estaciones construyendo la máquina y TODOS los videos enseñan el llenado con
el resto posando de estatua. Los pines nunca expulsan, el molde nunca abre.
La cinemática YA EXISTE (`MoldOpenDriver` + `__moldOpen(t, e)` determinista,
con la MISMA queja ya pagada por otro usuario: "los eyectores no eyectan
cuando doy play") — lo que falta es ENRUTARLE los roles del DADO y hacer EL
VIDEO DEL CICLO COMPLETO: llenar → abrir → expulsar.

## EL DIBUJO (la película, 3 actos)
```
   ACTO 1 · LLENAR (0–55 %)     el melt baja por el sprue y llena (lo de siempre)
   ACTO 2 · ABRIR (62–82 %)     el lado A SUBE (cavidad + placa A + su agua +
                                sus tapones): el sprue SALE del bushing y la
                                pieza+colada SE QUEDAN abrazando el macho
                                (la física de la E9/E10: el agarre CTE·ΔT)
   ACTO 3 · EXPULSAR (84–100 %) la placa botadora empuja: los 8 pines
                                escalonados SUBEN con la pieza y la colada —
                                la pieza se DESPEGA del macho y queda libre
   (apertura 100 mm = 2.5×altura §6.3.2 · carrera 48 mm ≥ profundidad cap 11)
```

## LO QUE SE CONSTRUYE
1. `MoldOpenDriver` (MoldScene) gana enrutamiento EXTENSIBLE: `aSideRoles/
   aSidePrefixes/ejectRoles/ejectPrefixes/pieceRef` — el dado enruta:
   A-side = cavidad + placa-a-ghost + su agua (agua-A-*, tapones/orings A);
   eyección = pin-* + COLADA (sprue directo 2 placas: la colada viaja CON la
   pieza, no con A — al abrir se ve el sprue SALIENDO del bushing) + LA PIEZA
   (el melt, vía pieceRef). El tupper/flanera no cambian (sets existentes).
2. useMoldStudio: los tapones/orings del circuito E8b llevan su LADO en el
   rol (agua-tapon-A-*/B-*, agua-oring-A-*/B-*) para poder enrutarse.
3. ForgeBRepStudio: `pieceRef` envolviendo el melt (FrenteSuperficie), los
   props del dado al driver (apertura 100 = 2.5×40 §6.3.2 cuando no hay
   liveMoldSpec pero SÍ ciclo del dado; carrera 48 = 40+8 cap 11), y el API
   `animZ(role)` para que el JUEZ del video mida las posiciones ANIMADAS
   (moldGeom lee geometría cruda, no la animación — medido).
4. `llenado-video.cjs` modo CICLO=1 (sobre la cadena E10): la línea de
   tiempo de 3 actos + el juez AMPLIADO: llenado monótono EN SU ACTO ·
   `animZ('cavidad') ≈ apertura` al final · `animZ('pin-punta-0') ≈ carrera`
   · la imagen cambia por tercio · sin errores de página.
   OUT: `dado-ciclo-completo-4k.mp4`.
5. Video 4K juzgado + ojos + AMBAS PCs + deploy.

## YA-EXISTE (literal)
- MoldOpenDriver con `__moldOpen(t, e)` manual determinista + suavizados ·
  moldAnimRefs por rol · la cadena E10 completa del arnés · el juez de video.

## TOCA
- src/forja/brep/MoldScene.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/useMoldStudio.ts
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
- juez del video: los 3 actos verificados por NÚMERO (animZ) + llenado
  monótono + imagen cambia · sin errores · orden-gate VERDE.
- video 4K APROBADO (juez + ojos: SE VE abrir y expulsar) → AMBAS PCs ·
  deploy · cierre + commit.

## CIERRE (2026-08-18)
- **El video del CICLO COMPLETO existe**: llenar (colormap) → ABRIR (la placa
  A sube 100 mm con su cavidad, su anillo de agua y sus tapones; el sprue SALE
  del bushing y la pieza+colada SE QUEDAN abrazando el macho — la física de la
  E9/E10 en pantalla) → EXPULSAR (los 8 pines escalonados empujan la pieza y
  la colada 48 mm sobre el macho, con aire visible entre pieza y partición).
- Juez AMPLIADO 10/10: los actos verificados POR NÚMERO — animZ(cavidad) =
  100.0 mm exactos, animZ(pin) = animZ(pieza) = 48.0 mm (viajan JUNTOS) — y
  la imagen cambia por tercio 0.19 → 5.77 → **19.49** (vs ~0.3 de los videos
  estatua: la máquina se MUEVE de verdad).
- Reusado, no reinventado: MoldOpenDriver + `__moldOpen(t,e)` ya existían
  (con la misma queja pagada por otro usuario: "los eyectores no eyectan") —
  solo se le enseñaron los roles del DADO (enrutamiento extensible) + la
  PIEZA vía pieceRef + `animZ(role)` para que el juez mida la ANIMACIÓN
  (moldGeom lee geometría cruda — medido y documentado).
- Gotchas del día, reincidencias cazadas: (1) el `tail -15` volvió a tragarse
  al juez (lección E6, tercera vez — correr SIN pipe); (2) el corte del acto
  de llenado con floor cerraba UN frame antes del lleno (pct 98.98) → ceil.
- Video 4K APROBADO + ojos → AMBAS PCs · deploy · commit.
