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
- 5 · PARTIR · la línea de partición sobre la carcasa · ok · 2026-08-28-t7-linea-de-particion
- 6 · EL MOLDE · placas, colada, agua, expulsores sobre ESA pieza · parcial · 2026-08-28-t6-piezas-complejas
- 7 · LOS PLANOS · el juego de planos del molde, con la inyectora del taller (FCS HT-150SV) juzgada en la lámina de análisis · ok · 2026-08-28-t7-linea-de-particion
- 8 · EL EXPEDIENTE · dictamen + planos + cotización en un archivo (y el video, después) · ok · 2026-08-28-t5-expediente-que-se-ve

## PARA CERRARLO (el orden, decidido 2026-09-04 tras el primer paseo)
El muro es el paso 5 y se derriba en este orden, un ticket a la vez, cada uno medido por el runner y con su paseo:
1. QUÉ SIGUE — después de soltar, la tira dice el siguiente paso, y P es el gesto de PARTIR sobre la pieza soltada (hoy no hay puerta).
2. T7 por MALLA — la silueta de partición y la dirección de apertura desde la malla (part-silueta, part-direccion, part-en-la-lamina): el paso 5 pasa a verde en su forma de malla, y la lámina deja de decir SIN CABLEAR.
3. El drop CONSERVA EL SÓLIDO cuando el archivo es STEP (memoria del navegador, no servidores): malla para el Foco, B-Rep para partir/molde/planos.
4. T7 de VERDAD + T6 — el acero se separa en dos cuerpos con la pieza real; el molde sobre ESA pieza: pasos 6 y 7.
5. T5 — el expediente que se ve: paso 8 completo. Entonces el camino está verde y el pipeline lo publica.

## RUNNER
Lo que la máquina hace y mide por paso (lo lee `scripts/camino-runner.cjs`; el tablero lo ignora).
Formato: `n · gestos del arnés (JSON) · check · check…` con `testid:<id>[@timeoutMs][<=maxMs]`, `count:<selector>>=n`, `js:<expr>`.
CONTRATO para los tickets que deben pasos rojos: T7 expone `linea-particion` sobre la pieza; T6 expone `molde-de-la-pieza`; T7/T5 exponen `planos-del-molde` y `expediente-de-la-pieza`. Cuando existan, el runner los pone en verde solo.
- 1 · [] · testid:lienzo-vacio@60000 · js:(function(){var cs=getComputedStyle(document.querySelector('[data-testid="lienzo-vacio"]'));return cs.borderWidth==='0px'&&cs.backgroundColor==='rgba(0, 0, 0, 0)'&&cs.backdropFilter==='none'})()
- 2 · [{"type":"drop","file":"test-parts/inyeccion-reales/1594C Box.stp","settle":0}] · testid:el-parte-foco@90000 · count:[data-testid="foco-cotas-overlay"] [data-testid^="cota-"]>=3 · js:(function(){var i=window.__forgeBrep&&window.__forgeBrep.invariants;return !!(i&&i.vol_kernel>0)&&('sólido en el kernel: '+i.n_faces+' caras, '+i.vol_kernel.toFixed(0)+' mm³')})()@60000
- 3 · [{"type":"tclick","testid":"parte-lente-enfriamiento","settle":0}] · testid:parte-leyenda@60000 · js:(function(){var v=parseFloat((document.querySelector('[data-testid="el-parte-foco"]').textContent.match(/vóxeles\s·\s([\d.]+) s/)||[])[1]);return v<=2.5&&(v+' s declarados por el módulo')})() · testid:ficha-en-el-mundo
- 4 · [{"type":"key","key":"d","settle":700}] · testid:lamina-dictamen · js:!!document.querySelector('[data-testid="lamina-dictamen"]').dataset.tinte
- 5 · [{"type":"key","key":"Escape","settle":500},{"type":"tclick","testid":"parte-lente-particion","settle":900}] · testid:linea-particion@5000
- 6 · [{"type":"tclick","testid":"parte-lente-molde","settle":1500}] · js:(function(){var m=document.querySelector('[data-testid="molde-de-la-pieza"]');return !!m&&+m.dataset.estacion>=3&&('E'+m.dataset.estacion+' | pared '+m.dataset.pared+' mm | '+m.dataset.roles)})()@150000 · js:(function(){var r=(document.querySelector('[data-testid="molde-de-la-pieza"]')||{dataset:{}}).dataset.roles||'';return /cavidad/.test(r)&&/nucleo/.test(r)&&'placas: cavidad + núcleo'})() · js:(function(){var r=(document.querySelector('[data-testid="molde-de-la-pieza"]')||{dataset:{}}).dataset.roles||'';return /colada/.test(r)&&'colada'})()@60000 · js:(function(){var r=(document.querySelector('[data-testid="molde-de-la-pieza"]')||{dataset:{}}).dataset.roles||'';return /agua|canal/.test(r)&&'agua'})() · js:(function(){var r=(document.querySelector('[data-testid="molde-de-la-pieza"]')||{dataset:{}}).dataset.roles||'';return /expulsor|pin/.test(r)&&'expulsores'})()
- 7 · [{"type":"tclick","testid":"parte-lente-planos","force":true,"settle":1500},{"type":"expect","label":"espera-planos","testid":"planos-del-molde","timeout":120000,"settle":0},{"type":"tclick","testid":"planos-del-molde-pagina-1","force":true,"settle":1500}] · testid:planos-del-molde@120000 · js:(function(){var p=document.querySelector('[data-testid="planos-del-molde"]');return !!p&&+p.dataset.paginas>=3&&(p.dataset.paginas+' láminas')})()@120000 · testid:planos-del-molde-svg@30000 · js:(function(){var t=document.body.textContent;var i=t.indexOf('inyectora');if(i<0)return false;var s=t.slice(i,i+140);var m=s.match(/(FCS HT-150SV \(taller\)|IM-\d+|HM320[^CVA]*)\s*(CUMPLE|VIOLA|ADVIERTE)/);return !!m&&m[1].indexOf('FCS HT-150SV')===0&&('la del taller: '+m[1]+' '+m[2])})()@30000
- 8 · [{"type":"tclick","testid":"btn-planos-molde-close","force":true,"settle":600},{"type":"tclick","testid":"parte-lente-expediente","force":true,"settle":1500}] · testid:expediente-de-la-pieza@30000 · js:(function(){var e=document.querySelector('[data-testid="expediente-de-la-pieza"]');return !!e&&e.dataset.dictamen==='1'&&'dictamen | '+e.dataset.decisiones+' decisiones'})() · js:(function(){var e=document.querySelector('[data-testid="expediente-de-la-pieza"]');return !!e&&e.dataset.cotizacion==='1'&&'cotización'})() · js:(function(){var e=document.querySelector('[data-testid="expediente-de-la-pieza"]');return !!e&&+e.dataset.planos>=3&&(e.dataset.planos+' planos')})()

## MEDIDO
- 20 Hammond reales (v1-gate): importan 20/20 · cotizan 17/20 · parten 2/20. El paso 5 es el muro; 6 y 7 existen y funcionan en el dado, pero dependen de 5.
- runner · 2026-09-08 23:21 UTC · http://localhost:5194/forja-brep.html · servido 6f70032 · iangpu · 7/8 ok · 1:2/2 2:3/3 3:3/3 4:2/2 5:1/1 6:3/5 7:4/4 8:4/4
