# ORDEN: CICLO DEL DADO — estación 3: ARQUITECTURA (cap 4) · nace el primer acero

BASE: da5e270

OBJETIVO: desde la estación 2, avanzar a la 3: el dado gana su draft REAL de 1.5°
(tallado por loft — decisión de ian: se VE el momento en que el molde le impone
geometría a la pieza; E1/E2 conservan el dado recto), splitMold talla los insertos
CAVIDAD y NÚCLEO del sólido real, el plano de PARTICIÓN dorado en la boca, las placas
A/B como fantasmas del acero comprado, y los semáforos §4.3.3 que ya existen DESPIERTAN
solos (el pkg aterriza en moldPkg). Panel con la aritmética de la base explicada
(envolvente 120 + 2×32 reserva → 196 de catálogo) y los retornos declarados.

## YA-EXISTE (prueba de ausencia)
- Draft real: `occt.loftSections` (secciones {pts,plane}, sólido NURBS exacto).
- Insertos del sólido: `mold.splitMold` (convención vaso: boca ARRIBA, cavity abajo,
  macho+placa arriba) — el MISMO que usa la flanera Core/Cav. scale:1 A PROPÓSITO
  (la contracción es la estación 9 — retorno declarado, no adelantado).
- Semáforos máquina: `MoldAnalisisPanel` COMPLETO — despierta con setMoldPkg(e2.pkg).
- Números de compra: `insertDims` (120×120×60 cavidad / ×16 núcleo) + `pkg.base`
  (aritmética de la reserva) + `plateDefs` (aceros por placa).

## TOCA
- src/forja/mold/estudio-molde-datos.ts
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/MoldPanels.tsx

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo)
- index.html
- public/comando/catalogo.json
- public/comando/produccion.json
- scripts/comando-catalogo.cjs
- public/atrio/
- scripts/reels-web.py

## EVIDENCIA (declarada antes de trabajar)
- Sonda node de estacion3Dado(pkg): base 196×196 con su aritmética (120+2×32=184→196),
  insertos 120×120×60/16, stack 248, aceros P20/C45 con porqué.
- Captura CAD (GPU): cavidad translúcida + macho + dado con draft + partición dorada +
  fantasmas de placas + semáforos despiertos (daylight ADVIERTE 8 mm visible).
- Entrega a /mnt/c/Users/sebas/Downloads (dado-e3-*.png) + /mnt/e/forja-videos.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL.

## CIERRE (2026-08-10)
- orden vs entregado: IDÉNTICO, sin enmiendas.
- números: draft 1.5° TALLADO por loft (pared nominal 2 medida EN la partición) ·
  splitMold escala 1.0 (contracción = estación 9, retorno declarado) · insertos
  120×120×60 / ×16 P20 · base 196×196 con su aritmética (120 + 2×32 = 184 → 196
  catálogo) · stack 248 con acero por placa (P20 solo moldeantes) · semáforos
  DESPIERTOS: 4 CUMPLE + daylight ADVIERTE 8 mm · chips ✓✓✓▶ · gate VERDE EXIT=0 ·
  censo IGUAL · build iangpu ✓ 46 s.
- evidencia: forja-shots/dado-e3/{01-acero-3d,02-panel-e3,03-semaforos-despiertos}.png
  revisadas con ojos → Downloads laptop (dado-e3-*.png) + /mnt/e/forja-videos.
- preguntas abiertas: estación 4 — LLENADO (cap 5): el toggle 💧 ya existe (flowlen
  sobre la pieza real); la estación lo suma al ciclo con sus números del cap 5.
