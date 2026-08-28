# ORDEN: T4 · LA VOZ QUE TE GUÍA — Matilda dicta el veredicto mientras la pieza gira

BASE: 3f86e47

OBJETIVO: ian: «añádele generación de voz para que sea más llevable… mientras se calcula todo
se pueden ir generando voces; así sentirán una UX diferente — ¿cuándo has escuchado un CAD
hablarte? JAMÁS».

La idea resuelve el problema técnico sola: Matilda tarda ~1-3 s por frase, pero el análisis
tarda MÁS (raster, campo de flujo, 69 contratos). Si la voz se sintetiza DURANTE el cálculo, la
latencia desaparece: cuando la máquina termina de pensar, ya tiene qué decir.

Al terminar: sueltas tu pieza, la ves girar, y el CAD te DICTA su veredicto en orden de
severidad — y lo que nombra se ilumina solo (se casa con T3).

DECISIÓN DE IAN: la voz es **Matilda** (XTTS en iangpu), no la del navegador. Caché por hash de
la frase; si una frase no está cacheada y iangpu no responde, **se queda el texto en silencio**
— nunca una voz robótica de emergencia que arruine la impresión.

## EJERCICIOS
- voz-durante · La síntesis arranca con el PRIMER hallazgo, no al final · cola en segundo plano · el cálculo no se retrasa (Δt del análisis ≤3 % vs sin voz) y hay audio listo antes de terminar
- voz-orden · Dicta por severidad: lo más grave primero · orden de la tabla · el primer audio corresponde al hallazgo con más críticos
- voz-cache · La misma frase no se sintetiza dos veces · hash del texto · la 2ª pieza igual reproduce en <100 ms (0 llamadas a iangpu)
- voz-precalienta · El catálogo se pre-genera en lote · las 20 Hammond + las 12 del lote · ≥200 frases cacheadas como assets tras una corrida nocturna
- voz-sin-iangpu · Sin iangpu no se rompe nada · degradación honesta · con la máquina apagada el panel sigue, el texto se lee, y NO suena voz robótica
- voz-senala · Lo que nombra, se ilumina · sincronía con T3 · al sonar "pines lejos del agarre" los pines quedan resaltados (still en el instante del audio)

## YA-EXISTE (prueba de ausencia)
- Matilda: `/home/ian/tts-venv/bin/python` + refs `mat_*.mp3` en iangpu (one-shot XTTS).
- El pipeline de narración de la escuela (`scripts/escuela/parrilla.sh`) YA cachea voz por línea
  (`PREPRO_V`) — el mismo patrón de hash sirve aquí.
- Los textos a dictar ya existen: cada contrato trae su § y su detalle vivo.
- NO existe: síntesis disparada por el panel, ni caché servido como asset, ni la sincronía
  audio↔resaltado.

## TOCA
- src/forja/mold/RevisarPiezaPanel.tsx
- scripts/escuela/parrilla.sh
- scripts/ciclo-dado-test.cjs
- public/temis.json

## CREA
- scripts/voz-dictamen.py
- public/evidencia/2026-08-28-t4-la-voz-que-guia/resultados.json

## BORRA
- (nada)

## PREEXISTENTE
- (se llena al activarla)

## EVIDENCIA (declarada ANTES de trabajar)
- medición del Δt del análisis con y sin voz · conteo de frases cacheadas
- VIDEO (no solo still): la pieza girando mientras Matilda dicta y el resaltado la sigue
- orden-gate VERDE · Temis n/6

## CIERRE (se llena al terminar)
