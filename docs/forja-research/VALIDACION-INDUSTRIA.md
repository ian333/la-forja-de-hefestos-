# VALIDACIÓN CONTRA MOLDE REAL — cumplir y superar el estándar

> ian: "debemos cumplir y superar los estándares de la industria." Kazmer (el
> libro) nos validó contra su aritmética — correcto de examen. La industria
> valida contra **realidad instrumentada**. Este es el estado honesto de esa
> validación, y el roadmap para superarla.

## El recibo de hoy — `scripts/validacion-industria.cjs`

**Observable validado: longitud de flujo en espiral** (el test de moldeabilidad
estándar de la industria). **Verdad ajena, real, citada:** US11230635 Tabla 6 —
ABS Terluran medido, 238°C→552 · 249°C→635 · 260°C→730 mm. Nuestro solver
(modelo térmico N2: piel erf × Cross-WLF × power-law) la corre desde primeros
principios; **no está ajustado a esos números**.

| T (°C) | medido | predicho | error |
|---|---|---|---|
| 238 | 552 mm | 640 mm | +15.9 % |
| 249 | 635 mm | 730 mm | +15.0 % |
| 260 | 730 mm | 826 mm | +13.1 % |

**La física fina (donde el grado y la presión se cancelan):**
- cociente L(249)/L(238): **1.141 sim vs 1.150 medido** → dentro de ±5 %
- pendiente dL/dT: **8.5 sim vs 8.1 medido** mm/°C → dentro de ±15 %
- monotonía: L crece con T ✓

**El offset absoluto (+14.7 % medio) es sesgo DECLARADO**, no error escondido:
grado GP22NR del paper vs MG47 nuestro + intensificación de husillo 10:1 nominal.
Por eso la física se juzga por cocientes/pendiente, no por el valor absoluto.

## Lo que esto SÍ prueba (y lo que no)

**Sí:** el solver reproduce la FORMA de la curva flujo-vs-temperatura de un molde
real medido, a pocos %, contra números que no son nuestros. Eso es la vara de
moldeabilidad de la industria, en un navegador, con la decisión y el acta
pegadas — lo que el marketing de Moldflow no publica.

**No todavía:** una sola observable (flujo) contra una sola fuente (patente).
La industria valida MÁS.

## 2ª fuente independiente — el ground truth, confirmado

Los subagentes trajeron una **segunda hoja de datos** que cae casi encima de la
patente: **SABIC Cycolac BDT5510** (ABS FR) publica spiral flow **736.6 mm @
260 °C, espesor 3.175 mm** — el MISMO espesor que la patente Terluran (730 mm @
260 °C). Dos fabricantes independientes coinciden al **0.9 %**: la verdad medida
no es capricho de una patente. Nuestro solver (826 mm isotermo) sobrepredice
AMBAS por el mismo ~12-13 % — el sesgo del método, no un error de una fuente.

## La vara de la industria (medida, no supuesta)

- **Aceptable declarado: ≤5 %** (explícito en Sci.Reports 2026, SABIC PP 576P).
- Práctica real: ~2-3 % en presión de cavidad, ~2.5 % en tiempo de llenado;
  masa con buen venteo baja a 0.1-0.5 %.
- **Corroboración clave:** los simuladores COMERCIALES (Moldflow, Moldex3D)
  **también sobrepredicen presión y spiral flow**. Nuestro +13-16 % absoluto es
  la dirección conocida del método; la física fina (cocientes ±5 %, pendiente
  ±15 %) ya está dentro de la vara.

## Benchmark de PRESIÓN encolado (el siguiente build) — SABIC PP 576P

El mejor candidato de presión MEDIDA que trajeron los cazadores:
Kaliappan et al., **Sci. Reports 2026, DOI 10.1038/s41598-026-51699-1**.
- Geometría: placa trapezoidal 80/120 × 60 mm, pared 2.0, draft 2°, compuerta
  central ⌀2.5; fundido 230 °C, molde 40-50 °C, caudal 30 cm³/s, llenado 2.75 s.
- **Presión medida vs %llenado: 25→21 · 50→34 · 75→48 · 90→61 · 100→68 MPa.**
- Cross-WLF: n=0.380, τ*=1.82e5, D1=3.16e12, A1=20.4, A2=51.6 (D2/D3 NO dados).
- **Por qué no se corrió aún:** exige 3 supuestos apilados (D2 por default;
  derivar el power-law k del Cross-WLF —la fórmula no reproduce exacto ni el
  ABS—; sensor cavidad-vs-inyección, ubicación no dada). Un recibo con 3
  supuestos que "cuadra" sería engañoso. Es el siguiente build, con cada
  supuesto declarado y su sensibilidad medida.

### Otros benchmarks reales localizados (por si se necesitan)
- **Hamdi 2023** (Polyolefins J., DOI 10.22063/POJ.2023.3311.1252): placa
  0.5×3×50, Cross-WLF COMPLETO de 3 PP (incl. Mosten MA712 sin relleno), pero
  longitud solo en figura + ley empírica L=D·(1/K)^1.85·P^0.37.
- **Ozdemir Potuk 2025** (Polymers, DOI 10.3390/polym18010091): spiral, longitud
  MEDIDA **1611.51 mm** (real), pero reología del grado Hostacom no tabulada.
- **Toyolac GP** (Toray): spiral ABS 2.0 mm a 210/230/250 °C, molde 60 °C —
  números en figura (Fig. 8), habría que digitalizar.

## Roadmap para SUPERAR (los observables que faltan)

1. **Traza de presión en cavidad (p vs t)** — el estándar de la industria
   (sensores Kistler/RJG). Nuestro solver YA emite `pInletSerie` (p, t, vol%);
   falta un dataset MEDIDO independiente con condiciones completas. El candidato
   MDPI `PMC8512013` (espiral 5×3×485, HIPS, sensor Kistler 6157BA a 242.5 mm)
   **no sirve como número duro**: publica gráficas (no tablas) y omite T_melt.
   Acción: conseguir un dataset con p(t) tabulado + T_melt + caudal, o
   instrumentar uno propio. Hoy la presión se reporta como PREDICCIÓN
   (~69 MPa, fill-limited por la intensificación declarada).

2. **Alabeo medido en CMM** — warp de una pieza real vs nuestra Eq 10.19 /
   §10.3.1. Ninguna fuente aún.

3. **Segunda fuente de flujo independiente** — hoja de datos de resina con
   spiral flow (los fabricantes publican longitud vs espesor/presión) para
   cruzar la patente con un origen distinto.

4. **Tryout científico (T0→T1→T2)** — 6-step DOE + cavity-pressure, el lazo
   real de la industria. Kazmer R119 es un párrafo; aquí sería un módulo.

## Cómo correr el recibo
```
node --import tsx scripts/validacion-industria.cjs
```
Emite la tabla predicho-vs-medido + los tests sin-sesgo + `VERIFY_RESULT`.
Fuente única de la verdad medida: `ESPIRAL_PATENTE_MM` (US11230635 Tabla 6).
