# EL PLIEGO DE ANÁLISIS — Kazmer caps. 7–9
## Ingeniería inversa del modelo mental: qué se calcula, en qué orden, y qué decide

**Fecha:** 2026-08-06 · **Alcance:** cap. 7 (compuertas), cap. 8 (venteo), cap. 9 (enfriamiento),
más los dos análisis del cap. 10 que **cierran** el argumento del cap. 9 (contracción y alabeo).

---

## Por qué existe este documento

El libro de Kazmer **no tiene** un capítulo llamado "análisis a realizar". Tiene a un ingeniero
razonando en voz alta. Cada vez que compara, despeja, sustituye un número o dicta un veredicto,
eso es un análisis — y el grafo que los conecta lo da por obvio porque lo tiene en la cabeza.
Este pliego lo vuelve explícito.

Ya se hicieron dos lecturas del mismo corpus con otras lentes:
- **UI** — `pliego-UI-v2.md`, `pliego-caps7-9.md`, `libro-caps7-9.md` (qué pantallas hacen falta).
- **Verificación visual** — `verificaciones-visuales.md`, 122 fichas (qué se juzga MIRANDO).

Ésta es la tercera: **ANÁLISIS** (qué se calcula, con qué entra, qué sale, y qué decide).

## Qué cuenta como "análisis" aquí

Unidad de razonamiento que **toma datos, produce un número o un veredicto, y alimenta una decisión**.
Si no alimenta ninguna decisión, es lección, no análisis, y no tiene ficha.

Cada ficha lleva nueve campos fijos:

| Campo | Qué contiene |
|---|---|
| **ID y nombre** | `A-nn`, numeración corrida a lo largo de los tres capítulos |
| **CUÁNDO** | en qué momento del flujo se corre |
| **ENTRADAS** | y de qué análisis vienen (`←A-nn`) — esto es lo que arma el grafo |
| **EL CÁLCULO** | ecuación literal con su número de ecuación del libro; si es cualitativo, se dice |
| **SALIDA** | con unidades |
| **DECIDE** | la decisión concreta que alimenta |
| **CRITERIO** | umbral del libro / comparación / juicio humano — se declara CUÁL de los tres |
| **INVALIDA** | qué lo tira a la basura y obliga a recorrerlo |
| **¿TENEMOS?** | archivo y función en `src/forja/mold/`, o **FALTA** |

## Fuente y su límite (regla dura)

Los tomos crudos del libro **ya no existen** (se perdieron en una limpieza de disco). Este pliego se
construyó sobre el corpus DERIVADO, que sí conserva **citas literales verificadas con grep**:
`libro-caps7-9.md`, `pliego-caps7-9.md`, `verificaciones-visuales.md` (fichas V7.x/V8.x/V9.x) y `cruce.md`.

- **Toda cita entre comillas de este documento existe textualmente en el corpus.** Verificado con
  `grep -rlF` archivo por archivo.
- Lo que no es cita y es deducción mía va marcado **`INFERIDO`**.
- Lo que sospecho que el libro dice y el corpus derivado **no capturó** va marcado
  **`NO OBSERVADO EN EL CORPUS`** — es información útil (dice dónde volver a leer si el tomo reaparece),
  no un fracaso.

## Convenciones

- Fórmulas en ASCII. `alpha` = difusividad térmica, `gammadot` = tasa de corte, `Vdot` = caudal
  volumétrico, `Qdot` = potencia, `mu` = viscosidad, `rho` = densidad.
- **[LIBRO]** = umbral numérico explícito del libro · **[COMPARA]** = el criterio es una comparación
  entre dos análisis · **[JUICIO]** = Kazmer decide sin número (y lo dice).
- Las tres piezas de ejemplo del libro se citan por su nombre: **bezel** (marco de tablet, ABS,
  pared 1.5 mm), **cup** (vaso, ABS, pared 3 mm) y **lid** (tapa, ABS, pared 2 mm).

---
