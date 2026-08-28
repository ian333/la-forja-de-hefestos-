# ORDEN: T5 · EL EXPEDIENTE QUE SE VE — "no sé qué afecta si no lo veo"

BASE: 3f86e47

OBJETIVO: ian, sobre el expediente §13.10 (las 5 decisiones que esperan su firma): «esto
debería tener ayuda y más información… no está mal, pero no sé qué afecta si no lo veo».

Hoy el expediente te pide firmar cosas como *"el gate congela antes del empaque necesario:
freeze 81.32 s vs empaque necesario 211.95 s"* o *"la colada domina el ciclo (t_c 1174.4 s >
211.9 s de la pieza)"* — números correctos, consecuencia invisible. Nadie firma a ciegas.

Al terminar: pasar sobre una decisión MUESTRA qué cambia — el fantasma de la otra opción sobre
la pieza, el número que se mueve, y en una línea qué se gana y qué se paga.

## EJERCICIOS
- exp-consecuencia · Cada decisión dice qué NÚMERO mueve · costo/beneficio vivo · las 5 decisiones del engrane traen su "si eliges A: X; si eliges B: Y" con números reales
- exp-fantasma · La alternativa se VE sobre la pieza · overlay comparativo · elegir el ⌀ de colada más chico dibuja el fantasma del actual y la diferencia en mm
- exp-ayuda · Cada decisión trae su ayuda del libro (no solo el §) · texto del pliego · las 5 traen 2-4 líneas de "qué está en juego" citando el libro
- exp-orden · Los remedios salen EN SU ORDEN (§7.3.5) · orden del libro · el conflicto del gate lista sus remedios en el orden impreso, no alfabético
- exp-firma · Firmar cierra y queda en el expediente · registrarDecision · tras firmar 5/5 el expediente pasa de "NO CIERRA sin firmas" a cerrado, con responsable y fecha
- exp-no-inventa · Donde el libro NO elige, se DICE · honestidad · "many mold designers prefer…" se muestra como lo que es: el libro no decide, decides tú

## YA-EXISTE (prueba de ausencia)
- `src/forja/mold/expediente.ts::registrarDecision` + el panel ya pinta las decisiones, sus §,
  sus opciones y el botón FIRMAR (se ve en la captura de ian).
- Los números ya están calculados (freeze vs empaque, t_c de colada vs pieza, break-even).
- `docs/forja-research/kazmer-pliego/` tiene el texto del libro por § para la ayuda.
- NO existe: la consecuencia VISIBLE (fantasma/diff) ni la ayuda pegada a cada decisión.

## TOCA
- src/forja/mold/expediente.ts
- src/forja/mold/RevisarPiezaPanel.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- public/evidencia/2026-08-28-t5-expediente-que-se-ve/resultados.json

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al activarla)

## EVIDENCIA (declarada ANTES de trabajar)
- gate VERDE · stills del antes/después de una decisión (el fantasma visible)
- orden-gate VERDE · Temis n/6

## CIERRE (se llena al terminar)
