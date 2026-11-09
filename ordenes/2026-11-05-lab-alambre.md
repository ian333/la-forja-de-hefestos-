# ORDEN K: el módulo del alambre (carrete + empuje NEMA 17 + distancia + la punta)

ESTADO: hoy, agente de fondo. ian: «divide y vencerás… 3 agentes… pasos mínimos… quiero todo a medida para no atornillar… que la misma figura impresa lleve el cableado… todo soldado, el mínimo de componentes».

BASE: d675896

OBJETIVO: el cartucho impreso que entra en el riel de la columna:
- carrete de 1 kg (D100) con su freno;
- empuje con NEMA 17 sobre el rodillo moleteado de la SOMI (metal donde hay desgaste);
- rueda loca con imán + AS5600 que MIDE el alambre real;
- guía recta y continua hasta la punta de contacto (la distancia se controla porque entre el rodillo y la punta no hay juego);
- el portapuntas de metal con la entrada de OUT− y el calor de la punta lejos del PETG.

La topología la elige la física (directo contra reducción impresa) y no la costumbre. Sin tornillos donde se pueda. Salidas:
- generador puro + jueces + pruebas;
- STL de cada pieza impresa y FMSH para verla;
- `piezasAlambre()` para La Forja.

LA FRONTERA es `src/forja/lab/laboratorio-contrato.ts` (bahías, puertos, conexiones, riel, reglas). Se lee y NO se edita. Si algo no cabe: se diseña con lo que hay y se escribe «CAMBIO DE CONTRATO PEDIDO», con números, en el reporte.

## YA-EXISTE (prueba de ausencia)

- Del mismo cuidado que La Pluma se reúsa:
  - física y DFM: `src/forja/mech/dfm.ts`, `printinplace.ts`, `factor-seguridad.ts`, `evolucion.ts` (las fórmulas son el juez), `gcode-k1.ts`, `printsim.ts` (la K1);
  - la optimización topológica: `src/forja/brep/topopt.ts`;
  - el kernel OCCT en Node: `scripts/precompute-banco-arco.cjs` (cargar el wasm, `occt.ts`, teselar, escribir FMSH).
- Los números de la etapa de potencia están en `src/forja/brep/plumaSistema.ts` y en `docs/investigacion-arco/11-SINTESIS.md`.

## TOCA

- (nada)

## CREA

- src/forja/lab/alambre.ts
- src/forja/lab/__tests__/alambre.test.ts

## BORRA

- (nada)

## PREEXISTENTE

- public/
- videos/
- scripts/
- models/
- docs/
- ordenes/
- src/lib/physics/
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/CampoReal.tsx
- src/forja/brep/ArcoVivo.tsx
- src/forja/brep/arcoFisica.ts
- src/forja/brep/plumaSistema.ts
- src/forja/brep/PlumaCircuito.tsx
- src/forja/brep/__tests__/plumaSistema.test.ts
- src/forja/brep/brazoVivo.ts
- src/forja/brep/BrazoVivo.tsx
- src/forja/brep/__tests__/brazoVivo.test.ts
- src/forja/lab/laboratorio-contrato.ts
- src/forja/lab/cuerpo.ts
- src/forja/lab/__tests__/cuerpo.test.ts
- src/forja/lab/placa.ts
- src/forja/lab/__tests__/placa.test.ts

## EVIDENCIA (se declara ANTES de trabajar)

- `vitest` en iangpu, contra fórmulas y con errores sembrados:
  - par y velocidad del NEMA contra la fuerza de empuje;
  - pandeo del alambre en el tramo sin guía;
  - temperatura del PETG junto a la punta;
  - resolución en µm por micropaso;
  - el ajuste del riel con la holgura de dfm;
  - cada pieza cabe en la cama de la K1;
  - voladizos;
  - ningún camino metálico paralelo de corriente.
- STL y FMSH generados en iangpu con OCCT; se reportan triángulos y cajas.
- `tsc --noEmit` en iangpu sin errores nuevos (la base son 58).
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-05-lab-alambre.md` en VERDE.

## CIERRE (se llena al terminar)

- orden vs entregado:
  - `src/forja/lab/alambre.ts`: `SUPUESTOS`, `REQ_ALAMBRE`, `disenarAlambre()` (cada número sale de una regla), `juzgarAlambre()` (A1–A17, vuelve a calcular todo desde las decisiones guardadas), `piezasAlambre()` (5 mallas + compradas + escudos), la geometría como datos (`impresas[].prims`) que lee el script.
  - `src/forja/lab/__tests__/alambre.test.ts`: 33 pruebas contra fórmulas, con errores sembrados que el juez caza (pandeo, fricción, paso completo, entrada recta, cuello de cobre, nariz bajada, cable pegado, sin escudos, tornillo a PE, AS5600 pegado, OUT− al rodillo, holgura 0.1, broche corto, espina de 300, barreno sin gota, fondo a 30°, loca que aplasta, imán lejos).
  - `scripts/laboratorio/alambre-solidos.cjs` (OCCT en Node): STL en orientación de impresión → `models/stl/laboratorio/alambre/`; FMSH en el marco del doc → `public/modelos/laboratorio/alambre/`; `resumen.json` con caja, volumen y soporte (dfm.ts).
  - Cambios de criterio a media ronda (orquestador): retracción tipo CMT ±1 mm; VM = 12 V e I ≤ 1.4 A rms (dato de C); mesa a 150–300 °C (dato de B) → escudos.
- números:
  - Topología: DIRECTO NEMA→rodillo. Retracción tipo CMT: 39.1 Hz (±1 mm, 0.85 A rms, 12 V, J = 127 g·cm²: rotor 54 + rodillo 62 + loca 11). La 5:1 impresa da 19.1 Hz (la fcem a 12 V la ahoga), 75 µm de juego y +3 piezas. A 24 V el directo da lo mismo (manda la corriente): NO se pide VM 24 V.
  - Fuerza: 5.41 N (carrete 0.92 + boca y arco de PTFE 2.54, de ellos 1.14 por doblar el alambre en R34 + guía recta 2.86). Par: 81 mN·m contra 163 a 64 rpm con 0.7 A rms → ×2.01. 29.5 µm por micropaso (1/16).
  - NEMA: 0.85 A rms → 2.63 W → 63.9 °C (tope por el PETG que lo toca); 1.4 A daría 57 Hz pero 130 °C.
  - Pandeo: 8 mm sin guía, P_cr 581 N (×108). Juego en el PTFE 4×2: 27 µm. Colchón: el arco de PTFE aísla el carrete (f_n 0.38 Hz); recto y tenso le pasaría 47 N a 39 Hz.
  - Térmica: PETG empieza a z = 260 sobre el arco (pluma Heskestad + radiación: 66.5 °C); cuello inox 6×4 de 207 mm → zócalo 35 °C (latón 55, cobre 130); portapuntas 357 °C → OUT− con soldadura de plata; cable: 85 mm desnudo, silicona desde 179 °C, toca PETG a 274 mm con 58 °C. Mesa a 300 °C: sin escudos el PETG llega a 114 °C; con 6 tiras de aluminio 0.8 mm (hueco 5 mm) 67.1 °C; el carrete 126 → 65 °C con un escudo en L.
  - Loca: 37 N (agarre ≥ 21.6, aplasta a 87 → máx 43.3); resorte de acero 4 N/mm (la flexión impresa relaja a 15 N junto al NEMA a 64 °C). AS5600: 12.3 µm/cuenta (98 µm efectivos con un ADC de 9 bits), entrehierro 2 mm.
  - Riel: holgura 0.42 (dfm.ts, K1, PETG) → macho 29.01/38.48 × 7.58; broche ε 0.62 %, pestillo del NEMA ε 1.24 % (≤ 2.5 %). Tornillos: 0.
- evidencia:
  - `npx vitest run src/forja/lab/__tests__/alambre.test.ts` en iangpu: 33/33.
  - `npx tsc --noEmit -p .` en iangpu: 58 (la base; 0 de alambre).
  - OCCT: pie-carrete 636 tris, 1 sólido, 100 × 81.6 × 150, 0 soporte · espina-empuje 2780 tris, 1 sólido, 100 × 183.8 × 155, soporte sólo en puentes declarados (techo del NEMA 40.8 mm, ranura del broche 11 mm, anillos < 1.5 mm) · carro-loca 192 tris, 20 × 17.6 × 10.7, 0 · eje-carrete 522 tris, 20 × 19.9 × 57.3, labio de 0.65 mm · tapa-iman 500 tris, 15.2 × 15.2 × 3, 0. Todas caben en la K1.
- preguntas abiertas:
  - CAMBIO DE CONTRATO PEDIDO (opcional): A.POT en (−40, 150, ~210) en vez de z = 60: el cable OUT− sube junto al cuello y hoy tiene que bajar 150 mm otra vez hasta el puerto (se ahorran ~150 mm de cable y de lazo del arco).
  - Medir: pared del tubular (0.2), rizo del alambre al salir del carrete y del rodillo, fuerza real con un dinamómetro, Rth del NEMA en su bolsillo, T del extremo de la punta, la pluma (termopar a 200–300 mm sobre el arco), la emisividad del escudo con humo.
  - El cuello vibra de lado a 58 Hz (aviso con la retracción a 39 Hz).
