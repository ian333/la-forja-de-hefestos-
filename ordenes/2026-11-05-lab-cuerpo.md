# ORDEN L: el cuerpo del laboratorio (la figura impresa que es estructura Y cableado)

ESTADO: hoy, agente de fondo. ian: «divide y vencerás… 3 agentes… pasos mínimos… quiero todo a medida para no atornillar… que la misma figura impresa lleve el cableado… todo soldado, el mínimo de componentes».

BASE: d675896

OBJETIVO: la base, la cubierta, las mordazas de la placa y la columna con el riel hembra, impresas en TEJAS que caben en la K1 y se unen sin tornillos (colas de milano y broches). Adentro:
- un canal para CADA conexión del contrato, de puerto a puerto, por fuera de las bahías ajenas, con llenado ≤ 40 %, doblez ≥ 6·Ø y potencia separada de señal;
- tapas a presión y peines que sujetan cada cable soldado;
- aire del ventilador sobre el disipador de C;
- ventanas: USB, IEC, PARO y los puertos de la columna;
- la boca del extractor.

Salidas:
- generador puro + jueces (el revisor del cableado ahora sobre canales reales) + pruebas;
- STL de cada teja y FMSH;
- `piezasCuerpo()`.

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

- src/forja/lab/cuerpo.ts
- src/forja/lab/__tests__/cuerpo.test.ts

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
- src/forja/lab/alambre.ts
- src/forja/lab/__tests__/alambre.test.ts
- src/forja/lab/placa.ts
- src/forja/lab/__tests__/placa.test.ts

## EVIDENCIA (se declara ANTES de trabajar)

- `vitest` en iangpu:
  - cada conexión tiene su canal continuo de puerto a puerto;
  - llenado, doblez y separación;
  - cada teja cabe en la K1 y se imprime sin soportes (o se dice cuál y por qué);
  - deformación de los broches ≤ la admisible del material (ε = 1.5·y·h/L²);
  - la base aguanta la LRS y la placa;
  - errores sembrados: canal faltante, canal lleno, doblez cerrado, potencia pegada a señal.
- STL y FMSH en iangpu.
- `tsc --noEmit` en iangpu sin errores nuevos (la base son 58).
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-05-lab-cuerpo.md` en VERDE.

## CIERRE (se llena al terminar)

- orden vs entregado:
  - `src/forja/lab/cuerpo.ts` (puro):
    - `disenarCuerpo()`: mesa disipadora, A* de canales, tejas, uniones, broches, estructura, aire, extractor, lazo del arco y operaciones de sólido por teja (una sola fuente de la geometría);
    - `juzgarCuerpo(d)`: reglas C1–C8, T1–T3, S1–S5, H1–H5 y A1–A3; lo que el contrato no deja hacer sale con nivel «contrato» y su pedido;
    - `piezasCuerpo(d)`: tejas como malla, canales como tubo con color por función, lo comprado con primitivas, y la LRS con su malla.
  - `src/forja/lab/__tests__/cuerpo.test.ts`: 30 pruebas contra fórmulas y 11 errores sembrados.
  - `scripts/laboratorio/cuerpo-solidos.cjs`: OCCT en Node. Mide la LRS en su STEP y escribe STL (en orientación de impresión) y FMSH (en el marco del doc) de las 13 tejas, con la revisión de voladizos de dfm.
  - Salidas: `models/stl/laboratorio/cuerpo/*.stl` + `resumen.json`, y `public/modelos/laboratorio/cuerpo/*.bin`.
  - Corrección del orquestador aplicada: la mesa es un DISIPADOR CONTROLADO (bloque de aluminio con aletas, ventilador propio y NTC), no un aislante.
  - Datos de C aplicados:
    - C.MESA, con K11 (NTC) y K12 (ventilador) por el aire frío del ducto;
    - abrazaderas a ≤ 15 mm de la isla en C.BUS y C.OUTN;
    - el difusor de 125 mm no cabe (P8).
  - Pendiente: las tiras de las tapas (27 tapas, dimensionadas, ε 0.75 %) y la geometría de los broches col-col y charola-cubierta (dimensionados). Hoy la columna la aprietan sus espigas y la charola cuelga de sus alas.
  - Sin topopt: la columna trabaja a σ 0.32 MPa contra 24.75 admisibles (SF 78), así que su forma la mandan el ducto, el riel y los canales, no el esfuerzo. topopt quitaría material hasta el grueso mínimo imprimible, que es el que ya tiene.
- números:
  - **Tejas:** 13 tejas que caben en la K1, 0 tornillos.
    - base: 4 de 150×150×105;
    - cubierta: 4 de hasta 170×150×33 (boca abajo);
    - charola del ducto: 2 de 138×200×10;
    - columna: 2 de 110×40×240 y 110×65×220;
    - mordazas: 1 cama de 104×104×34.
  - **Impresión:** 1 681 cm³ extruidos, 2.1 kg de PETG y ~58 h a 8 mm³/s (SUPUESTO).
  - **Soportes** (área que dfm marca): 0–9.3 % por teja; la peor es base-ti con 5 540 mm² en codos de K04 y K02. col-2 lleva soporte de árbol bajo el collar (1 384 mm²).
  - **Uniones:** 16 colas de milano (holgura 0.42 de dfm), 2 espigas y 20 ganchos.
  - **Broches:** ε de 0.75 a 1.20 % (admisible SUPUESTO 1.5 %).
  - **Canales** (largo, R disponible contra el que pide 6·Ø, llenado; el llenado es ≤ 37 % en todos):

    | conexión | largo | R | pide | llenado |
    |---|---|---|---|---|
    | K01 | 693 mm | 45 | 14.4 | 36 % |
    | K02 | 598 mm | 15 | 14.4 | 36 % |
    | K03 | 115 mm | 25 | 14.4 | 18 % |
    | K04 | 489 mm | 25.9 | 25.8 | 37 % |
    | K06 | 302 mm | 30 | 40.8 → P3 | 36 % |
    | K07 | 282 mm | 112 | 8.4 | 25 % |
    | K08 | 362 mm | 20 | 6 | 9 % |
    | K11 | 15 mm | — | — | ducto |
    | K12 | 138 mm | — | — | ducto |

  - **Señal:** a ≥ 15 mm de la potencia en todo el recorrido.
  - **Sin ruta con el contrato:** K05 (P1), K09 (P2) y K10 (P4).
  - **Lazo K05/K06:** 179 cm² (K05 como recta).
  - **Mesa:** aletas de 3 mm a paso 12. Sostiene 150–300 °C con el ventilador a tope y el arco 35–89 % del tiempo.
    - escape ≤ 62.8 °C;
    - PETG ≤ 62.8 °C en los 9 lugares medidos;
    - τ 6.6 min;
    - fuga: 326 °C con ventilador, 521 sin él (termostato pedido en P6).
  - **Estructura:** columna SF 78 · pie SF 16 (Kt 3.83) · espiga SF 37 · cubierta SF 19 · postes de silicato SF 3.7 · la punta baja 86 µm.
  - **Aire:**
    - C: 26 m³/h, el aire sube 4.7 K;
    - LRS: las rejillas se comen 6 % de su presión;
    - extractor: 41 m³/h y captura de 0.29 m/s (P5).
  - **LRS (STEP):** bornera AC centrada en y 80.5 adelante y DC en y 151.1 atrás. Confirma la bornera a −x.
- evidencia:
  - vitest 30/30 en iangpu;
  - tsc: 59 errores = 58 de la base + 1 en `src/forja/lab/alambre.ts` (agente A, `IMPRESORA.margin`); 0 en mis archivos;
  - STL y FMSH de 13 tejas sin operaciones fallidas;
  - gate VERDE.
- preguntas abiertas:
  - **Contrato:** CAMBIO DE CONTRATO PEDIDO P1–P8 (en `PEDIDOS` de `cuerpo.ts`).
  - **Material:** ¿PETG confirmado? ¿Qué silicato de calcio compras (k y resistencia)?
  - **Ventilador de la mesa:** ¿uno de 80×80×38 de 0.55 A (SUPUESTO) o lo que diga C (hasta 1 A)?
  - **MARCO:** ¿te parece soldadura fuerte de plata en la oreja (el marco llega a 300 °C)?
  - **Escudo para A:** la cara de abajo del módulo A ve la placa con F 0.92 y llegaría a ~300 °C; necesita escudo.
