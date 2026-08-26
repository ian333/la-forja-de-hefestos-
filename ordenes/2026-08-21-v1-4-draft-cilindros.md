# ORDEN: v1·4 — DRAFT EN CILINDROS (o el mensaje honesto)

BASE: 96559a3

OBJETIVO: que el feature Draft del árbol aplique a caras cilíndricas (hoy:
"draftFaces: ninguna cara aplicable (paredes ⊥ pullDir)"). Un vaso —la pieza
moldeada más clásica— no se desmoldea con las funciones del árbol. §2.3.6 manda
draft ≥0.5°; sin draft no hay molde. Si OCC-WASM no lo soporta limpio, el
camino honesto es: el draft rechaza CON explicación y ofrece revolución.

## YA-EXISTE
- `occt.ts:draftFaces` resiliente — solo caras planas ⊥ pullDir.
- el vaso del lobby (`vasoDoc`) es el caso de prueba: cilindro + shell.

## ENMIENDA (al diseñar, antes de tocar)
- OCC BRepOffsetAPI_DraftAngle SÍ come caras cilíndricas (cilindro→CONO): el fix
  real es aceptar en `draftFacesMin` cilindros con EJE ∥ pullDir (mismo signo
  por COM, mismo umbral minArea). La escalera de resiliencia gana una 2ª pasada:
  si Build truena CON cilindros, reintenta SIN ellos (= comportamiento de hoy,
  cero regresión posible en tut1/tina). El mensaje de "ninguna cara aplicable"
  se vuelve honesto (§2.3.6 + sugiere revolución con conicidad).
- La regresión vive en `scripts/occt-features-test.cjs` (ya prueba draft 3° de
  caja): se agregan los casos cilindro→cono con la trigonometría exacta
  (frustum) y el control 0°. ForgeBRepStudio: solo si hace falta tocar el
  mensaje (TOCA es permiso, no obligación).
- WIP: corre mientras `temis-modulo-comando` (sesión paralela) tiene el slot
  EN CURSO; pasa proximo→cerrado directo (tapa ≤1).

## TOCA
- src/forja/brep/occt.ts
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/occt-features-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-21-v1-4-draft-cilindros/01-vaso-draft-cono.jpg
- public/evidencia/2026-08-21-v1-4-draft-cilindros/02-vaso-draft-e1-236-resuelto.jpg

## EVIDENCIA
- drive: vaso del lobby → Más▾ Draft 1.5° → `listFaces` reporta la lateral como
  cono (no cilindro) y el volumen cambia lo que la trigonometría dice
- control: draft 0° deja el sólido igual
- orden-gate VERDE

## PREEXISTENTE (otras sesiones en paralelo — NO es mío, no entra a mis commits)
- scripts/temis-tablero.cjs
- scripts/temis-deploy-stamp.cjs
- scripts/forja-deploy.sh
- public/temis-deploy.json
- src/forja/brep/TemisBoard.tsx
- src/forja/brep/ProjectSwitcher.tsx
- src/comando/ComandoCenter.tsx
- deploy-atlas-build.sh
- ordenes/2026-08-25-temis-modulo-comando.md
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- public/comando/
- public/atrio/
- public/precomputed/
- index.html
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
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
- src/lib/chem/

## CIERRE (2026-08-25)
EL VASO POR FIN SE DESMOLDEA DESDE EL ÁRBOL. `draftFaces` acepta cilindros con
eje ∥ al desmoldeo (DraftAngle de OCC: cilindro→CONO); la escalera de
resiliencia gana una 2ª pasada SIN cilindros (= el comportamiento previo
exacto: tut1/tina no pueden regresar rotos); 0° = identidad; el mensaje de
rechazo ahora explica QUÉ toma y sugiere Revolución para lo demás.

EL BUG QUE CAZÓ EL DRIVE (por qué se verifica por DOS caminos): el signo
exterior/interior por orientación topológica se INVERTÍA entre el vaso por
croquis+shell (UI: 27290.585, paredes cerrando) y el MISMO vaso por booleana
(nodo: 27542.811, abriendo). Fix: el signo lo decide una SONDA GEOMÉTRICA de
material (cajita 0.2 mm a 0.35 mm del radio + common()): material afuera →
pared interior (+α, acompaña); aire → exterior (−α, se ABRE hacia el pull).

Números (occt-features-test, +5 checks):
- cilindro R40×20 · 1.5°: 101852.957423875 vs trig 101852.9574238750 (1e-9 rel)
- vaso (⌀80·pared 3): 27542.8114853644 = integral exacta del frustum hueco;
  2 conos; pared CONSERVADA (giro en bloque)
- control 0°: identidad exacta
Regresión de TODOS los consumidores: features PASS · mold-engine pass ·
bezel MOLD_OK · kicad 8✓/4⚠/0✗ · ciclo del dado 222/222.

UI (drive iangpu, GPU): Más▾→Draft 1.5° sobre el vaso del lobby →
listFaces [cylinder,…]→[cone,plane,plane,cone,plane], VOLUMEN 27542.811 en la
barra, y la E1 reprueba SOLO §2.3.4 (aristas) — §2.3.6 RESUELTO: el draft va
declarado por el feature Y tallado en el sólido (la E3 lo medirá 1.5≈1.5).
ForgeBRepStudio: 0 cambios (TOCA era permiso; el mensaje vive en occt.ts).
WIP: próximo→cerrado directo (sesión paralela tiene el slot EN CURSO).
