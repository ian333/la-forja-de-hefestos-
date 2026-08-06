# EL PLIEGO DE ANÁLISIS — Kazmer caps. 4–6
## Ingeniería inversa del modelo mental: qué se calcula, en qué orden, y qué decide

**Fecha:** 2026-08-06 · **Alcance:** cap. 4 (arquitectura del molde: dirección de apertura, línea y
superficie de partición, shut-offs, insertos, layout de cavidades, mold base, compatibilidad con la
máquina, materiales), cap. 5 (análisis de llenado de la cavidad), cap. 6 (sistema de alimentación).

Documento hermano de `analisis-caps7-9.md`: mismos nueve campos por ficha, mismas convenciones,
mismo cierre con GRAFO. Este tomo va **antes** en el libro y **antes** en el flujo de diseño.

---

## Por qué existe este documento

El libro de Kazmer **no tiene** un capítulo llamado "análisis a realizar". Tiene a un ingeniero
razonando en voz alta. Cada vez que compara, despeja, sustituye un número o dicta un veredicto,
eso es un análisis — y el grafo que los conecta lo da por obvio porque lo tiene en la cabeza.
Este pliego lo vuelve explícito.

Ya se hicieron dos lecturas del mismo corpus con otras lentes:
- **UI** — `pliego-UI-v2.md`, `pliego-caps4-6.md`, `libro-caps4-6.md` (qué pantallas hacen falta).
- **Verificación visual** — `verificaciones-visuales.md`, fichas V4.1–V4.13, V5.1–V5.6, V6.1–V6.6
  (qué se juzga MIRANDO).

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
`libro-caps4-6.md`, `pliego-caps4-6.md`, `verificaciones-visuales.md` (fichas V4.x/V5.x/V6.x) y `cruce.md`.

- **Toda cita entre comillas de este documento existe textualmente en el corpus.** Verificado con
  `grep -F` frase por frase.
- Lo que no es cita y es deducción mía va marcado **`INFERIDO`**.
- Lo que sospecho que el libro dice y el corpus derivado **no capturó** va marcado
  **`NO OBSERVADO EN EL CORPUS`** — es información útil (dice dónde volver a leer si el tomo reaparece),
  no un fracaso.

## Convenciones

- Fórmulas en ASCII. `alpha` = difusividad térmica, `gammadot` = tasa de corte, `Vdot` = caudal
  volumétrico, `mu`/`eta` = viscosidad, `rho` = densidad, `Cp` = calor específico, `k` = conductividad.
- **[LIBRO]** = umbral numérico explícito del libro · **[COMPARA]** = el criterio es una comparación
  entre dos cantidades calculadas, sin número absoluto · **[JUICIO]** = Kazmer decide sin número
  (y lo dice).
- Las piezas de ejemplo del libro se citan por su nombre: **bezel** (marco de laptop, ABS, pared
  1.5 mm, 2 gates), **cup** (taza, ABS, pared 3 mm), **lid** (tapa, ABS, pared 2 mm) y el
  **contenedor** 100×160×60 mm (2 mm de pared, *"2° draft with 10 mm fillets"*).
- **Numeración:** `A-01 … A-76` son locales a este tomo. Como los caps. 4–6 van PRIMERO en el libro y
  en el flujo, al fusionar los cuatro tomos estos IDs conservan su orden y los de `analisis-caps7-9.md`
  se corren a partir de A-77.

## Tres cosas que este tomo trata como de primera clase, porque el libro las trata así

1. **Las bandas de DOS colas.** Un ΔP bajo también REPRUEBA (§5.1 en la cavidad, §6.5.1 en el runner);
   un molde demasiado chico para la máquina también reprueba (§4.3.3); un tonelaje excesivo también
   daña. Un optimizador que minimice ΔP produce exactamente el diseño que Kazmer rechaza.
2. **La dirección del redondeo.** No hay `round()` simétrico en este libro: alturas de inserto hacia
   ARRIBA (§4.2.1), diámetros del feed system hacia ABAJO (§6.5.5). La dirección ES el análisis.
3. **El sesgo declarado del método.** *"all the models always over predicted the filling pressures"*
   (§5.4). El análisis no pretende ser exacto: pretende errar del lado seguro, y el libro dice cuánto
   y por qué. Eso convierte el contraste contra simulación (A-46, Tabla 5.1) en parte del método,
   no en un extra.

---
