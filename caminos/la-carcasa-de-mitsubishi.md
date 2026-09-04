# CAMINO: LA CARCASA DE MITSUBISHI

ACTOR: el ingeniero más pro de Mitsubishi, con la carcasa de la siguiente consola en STEP
PROMESA: sube su archivo y sale con su molde DISEÑADO Y COTIZADO — sin aprender nuestro CAD
PIEZA: test-parts/inyeccion-reales/1594C Box.stp  (una carcasa de consola de verdad: postes, labio, nervios)
NOTA: el ingeniero diseñó moldeable (draft, sin undercuts). Los mecanismos son OTRO camino. El video del enfriamiento va en el expediente, no en la caminata. DECIDIDO por ian (2026-09-04): la promesa es DISEÑADO Y COTIZADO («de creado obviamente no»); el video va en el expediente; 1594C Box es la pieza controlada. Deseo registrado: ver el enfriamiento ANIMADO en vivo en el CAD, no solo en el video (vive en DESPUES-DE-V1).

## PASOS
- 1 · abrir la Forja · lienzo limpio, sin cuadrado · ok · -
- 2 · soltar el STEP en cualquier parte · carga, el Foco se prende solo, 3 cotas sobre la pieza · ok · 2026-09-01-x4-el-happy-path
- 3 · ENFRIAMIENTO · el campo pintado en ≤2.5 s y LA FICHA sobre el punto que manda el ciclo · ok · 2026-08-30-u10-el-foco-es-el-analisis
- 4 · D → EL DICTAMEN · qué viola, qué cambiar, teñido por el estado · ok · 2026-09-02-x6-la-lamina-viva
- 5 · PARTIR · la línea de partición sobre la carcasa · falla · 2026-08-28-t7-linea-de-particion
- 6 · EL MOLDE · placas, colada, agua, expulsores sobre ESA pieza · bloqueado · 2026-08-28-t6-piezas-complejas
- 7 · LOS PLANOS · el juego de planos del molde · bloqueado · 2026-08-28-t7-linea-de-particion
- 8 · EL EXPEDIENTE · dictamen + planos + cotización en un archivo (y el video, después) · parcial · 2026-08-28-t5-expediente-que-se-ve

## RUNNER
Lo que la máquina hace y mide por paso (lo lee `scripts/camino-runner.cjs`; el tablero lo ignora).
Formato: `n · gestos del arnés (JSON) · check · check…` con `testid:<id>[@timeoutMs][<=maxMs]`, `count:<selector>>=n`, `js:<expr>`.
CONTRATO para los tickets que deben pasos rojos: T7 expone `linea-particion` sobre la pieza; T6 expone `molde-de-la-pieza`; T7/T5 exponen `planos-del-molde` y `expediente-de-la-pieza`. Cuando existan, el runner los pone en verde solo.
- 1 · [] · testid:lienzo-vacio · js:(function(){var cs=getComputedStyle(document.querySelector('[data-testid="lienzo-vacio"]'));return cs.borderWidth==='0px'&&cs.backgroundColor==='rgba(0, 0, 0, 0)'&&cs.backdropFilter==='none'})()
- 2 · [{"type":"drop","file":"test-parts/inyeccion-reales/1594C Box.stp","settle":0}] · testid:el-parte-foco@90000 · count:[data-testid="foco-cotas-overlay"] [data-testid^="cota-"]>=3
- 3 · [{"type":"tclick","testid":"parte-lente-enfriamiento","settle":0}] · testid:parte-leyenda@60000 · js:(function(){var v=parseFloat((document.querySelector('[data-testid="el-parte-foco"]').textContent.match(/vóxeles\s·\s([\d.]+) s/)||[])[1]);return v<=2.5&&(v+' s declarados por el módulo')})() · testid:ficha-en-el-mundo
- 4 · [{"type":"key","key":"d","settle":700}] · testid:lamina-dictamen · js:!!document.querySelector('[data-testid="lamina-dictamen"]').dataset.tinte
- 5 · [] · testid:linea-particion@3000
- 6 · [] · testid:molde-de-la-pieza@3000
- 7 · [] · testid:planos-del-molde@3000
- 8 · [] · testid:lamina-dictamen · testid:expediente-de-la-pieza@3000

## MEDIDO
- 20 Hammond reales (v1-gate): importan 20/20 · cotizan 17/20 · parten 2/20. El paso 5 es el muro; 6 y 7 existen y funcionan en el dado, pero dependen de 5.
- runner · 2026-09-04 20:11 UTC · https://university.gaiaprime.com.mx/forja-brep.html · servido 6026a20 · iangpu · 4/8 ok · se rompe en el paso 5 · 1:2/2 2:2/2 3:3/3 4:2/2 5:0/1 6:0/1 7:0/1 8:1/2
