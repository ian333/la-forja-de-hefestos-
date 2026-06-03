# Diseño generativo — verificación sobre PIEZAS REALES (CPU)

`scripts/generative-farm.cjs` corre la optimización topológica SIMP (`topopt.ts`) sobre 6
piezas que un maker / estudiante / taller de LATAM diseña de verdad. **Todo CPU** (node
single-thread + occt WASM; el GPU solo dibuja). **6/6 pasaron** los invariantes (compliance
baja monótona, volumen conservado, material vaciado en estructura, objetivo convergido).

| Pieza (uso) | ↓ compliance | volumen (obj.) | vaciado | celdas | tiempo |
|---|---|---|---|---|---|
| Ménsula de pared (repisa al muro) | 80.6% | 0.40 (±3e-4) | 39% | 378 | 7.5 s |
| Brazo voladizo (lever) | 80.9% | 0.35 | 30% | 144 | 4.3 s |
| Base de motor (mount) | 70.8% | 0.40 | 30% | 1152 | 27 s |
| Cartabón (carga lateral) | 93.5% | 0.35 | 50% | 588 | 23 s |
| Columna excéntrica | 85.5% | 0.30 | 34% | 468 | 9 s |
| Viga bi-empotrada (puente) | 74.5% | 0.40 | 31% | 192 | 3 s |

Cada pieza quedó **3–15× más rígida** a su fracción de volumen objetivo (conservada exacta),
vaciando 30–50% del material. Reproducible: `bash scripts/run-farm.sh` (con cd horneado).

## Por qué importa
En LATAM el diseño generativo **no se usa**: está tras la *Simulation Extension* de Fusion
(cientos de USD sobre los ~$1,500/año) y casi no hay tutoriales (menos en español). El muro
es **precio + acceso**, no capacidad. Aquí el motor corre **gratis, en CPU, en el navegador**,
sobre piezas reales. Siguiente multiplicador: **WebGPU matrix-free** → tiempo real en el GPU
del propio estudiante (ver [[feedback_forja_build_from_manuals]] y LA-FORJA-PLAN-MAESTRO.md).
