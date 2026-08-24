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
