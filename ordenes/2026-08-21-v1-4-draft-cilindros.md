# ORDEN: v1·4 — DRAFT EN CILINDROS (o el mensaje honesto)

ESTADO: proximo
PRIORIDAD: 4

OBJETIVO: que el feature Draft del árbol aplique a caras cilíndricas (hoy:
"draftFaces: ninguna cara aplicable (paredes ⊥ pullDir)"). Un vaso —la pieza
moldeada más clásica— no se desmoldea con las funciones del árbol. §2.3.6 manda
draft ≥0.5°; sin draft no hay molde. Si OCC-WASM no lo soporta limpio, el
camino honesto es: el draft rechaza CON explicación y ofrece revolución.

## YA-EXISTE
- `occt.ts:draftFaces` resiliente — solo caras planas ⊥ pullDir.
- el vaso del lobby (`vasoDoc`) es el caso de prueba: cilindro + shell.

## TOCA
- src/forja/brep/occt.ts
- src/forja/brep/ForgeBRepStudio.tsx

## CREA
- (nada)

## EVIDENCIA
- drive: vaso del lobby → Más▾ Draft 1.5° → `listFaces` reporta la lateral como
  cono (no cilindro) y el volumen cambia lo que la trigonometría dice
- control: draft 0° deja el sólido igual
- orden-gate VERDE
