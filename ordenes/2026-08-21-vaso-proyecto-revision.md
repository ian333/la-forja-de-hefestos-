# ORDEN: EL VASO COMO PROYECTO NUEVO + REVISIÓN DEL CICLO (1 → 10 productos)

BASE: 1113722

OBJETIVO: encargo de ian — "hazlo como proyecto nuevo, quiero cargarlo y que
esté todo el ciclo como el del cubo. Ya hiciste la máquina, rómpela. Saca ss
también, revisa todo, hay millones de cosas a cambiar. AHORA SOLO ES REVISIÓN,
no revisión y cambios. Primero revisemos 10 productos, ahora solo hay 1."

Lectura: la máquina (E1→E12) tiene UN producto cableado a mano — el cubo. El
vaso entra como PRODUCTO #2, cargable desde el lobby igual que el dado. Este
turno es de REVISIÓN: cargar el vaso, correrlo contra la máquina, sacar
screenshots estación por estación y DOCUMENTAR todo lo que hay que cambiar —
SIN arreglar nada de la máquina.

## LO QUE SE CONSTRUYE (mínimo, sin tocar la máquina)
1. `vasoDoc()` en `ForgeBRepStudio.tsx` — el vaso como DocState EDITABLE
   (sketch círculo r40 → extrude 20 → shell 3 tapa abierta), la geometría que
   SÍ pasó el juez de eyección la vez pasada (⌀80×20 pared 3 → pin, 8×⌀10,
   628 mm² ≤ 726 mm² de borde). Se construye como el `cycloidalReducerDoc()`.
2. Una tarjeta en `switcherStarters`: `st-vaso` → `loadDoc(vasoDoc())`. Es
   una TARJETA DE PROYECTO del lobby (patrón ProjectSwitcher), NO un botón de
   cinta.

## LO QUE NO SE HACE (es lo que se REVISA, no se cambia)
- NO se generalizan los motores `estacion*Dado` (siguen cableados al cubo:
  `DADO_SPEC`, `dadoRectoShape`, `dentroDadoLocal`). Que el vaso NO pueda
  correr el ciclo ES el hallazgo — se documenta con screenshots, no se arregla.
- NO se toca `chooseEjectorType` (el §11.2.5 faltante, hallazgo previo).
- NO se toca el draft ciego a cilindros.
- NO se crea el puente pieza→molde.

## LO QUE SE ENTREGA
- El vaso CARGABLE como proyecto (screenshot del lobby + del vaso cargado).
- Screenshots del intento de correr el ciclo (MOLD TOOLS deshabilitado, sin
  botones de estación para el vaso).
- REVISIÓN estación por estación: qué está cableado al cubo en cada motor y
  qué haría falta para que el vaso (y 8 productos más) tengan el ciclo. Es el
  mapa de "millones de cosas a cambiar" — el trabajo del siguiente turno.

## TOCA
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- docs/forja-research/REVISION-VASO-CICLO.md

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
- el vaso aparece como TARJETA en el lobby y CARGA (screenshot)
- screenshots del ciclo: qué se habilita y qué NO con el vaso cargado
- REVISION-VASO-CICLO.md con el mapa estación×estación (qué cambiar para 10 productos)
- los 181 del cubo SIGUEN verdes (no toqué la máquina) · orden-gate VERDE · deploy

---

## CIERRE (lo que de verdad pasó)

**EL VASO ES PRODUCTO #2, cargable.** `vasoDoc()` + tarjeta `st-vaso` en el
lobby (patrón ProjectSwitcher, NO botón de cinta). Carga como pieza EDITABLE
(Boceto→Extrude→Shell), volumen **27,416.679 mm³** = π·40²·20 − π·37²·17 exacto.
Verificado EN VIVO en university.gaiaprime.com.mx: tarjeta presente, carga,
`docName="EL VASO · ⌀80×20 pared 3"`, cero errores de página. Deploy 25/25.

**LA REVISIÓN (docs/forja-research/REVISION-VASO-CICLO.md):** el vaso carga pero
NO tiene el ciclo, porque la máquina E1→E12 es la máquina DEL CUBO. Mapa
motor×motor con archivo y línea: `DADO_SPEC`, `dadoRectoShape`,
`dentroDadoLocal`, y las dos estaciones sin-args (`estacion1Dado`/
`estacion2Dado`). Bloqueador #0: el puente pieza-del-árbol → `cursoRef.pieza`.
Punto de divergencia real: E3 (el vaso recto sin draft no parte con splitMold).

**NO se tocó ningún motor** (revisión, no cambios). Gate del cubo **181/181**
intacto (prueba de que la máquina no se movió). 3 screenshots entregados a ian.

**SIGUIENTE (próximo turno, ya con luz verde de cambios):** el puente, luego
`PartSpec` + E1/E2 parametrizados, luego E3 (stripper/revolución del vaso).
