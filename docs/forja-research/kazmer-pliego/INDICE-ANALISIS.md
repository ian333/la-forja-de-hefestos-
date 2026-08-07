# ÍNDICE MAESTRO DE ANÁLISIS — Kazmer, *Injection Mold Design Engineering*
## Los 292 análisis que el libro corre en la cabeza de Kazmer, en un solo espacio de IDs

> Este archivo se **genera**. No lo edites a mano: edita los cuatro tomos y vuelve a correr
> `scripts/pliego-indice.cjs`. Los cuatro tomos se escribieron por separado y dos de ellos
> reiniciaron en `A-01`; el 2026-08-07 se renumeró todo a un espacio único **`A-001 … A-292`**,
> en **orden de libro** (caps. 1-3 → 4-6 → 7-9 → 10-13). La columna *era* conserva el ID viejo.

## Marcador

| estado | qué significa | análisis | % |
|---|---|---:|---:|
| 🟩 **SÍ** | implementado y localizable en `src/forja/mold/` | 130 | 44.5 |
| 🟨 **PARCIAL** | existe el cálculo pero le falta salida, criterio o alcance | 97 | 33.2 |
| 🟥 **FALTA** | el libro lo corre y nosotros no | 64 | 21.9 |
| ⬛ **DIVERGE** | lo implementamos **distinto** de lo que dice el libro (desviación declarada) | 1 | 0.3 |
| | **total** | **292** | |

### Por tomo

| tomo | caps. | IDs | era | 🟩 | 🟨 | 🟥 | ⬛ |
|---|---|---|---|---:|---:|---:|---:|
| [`analisis-caps1-3.md`](./analisis-caps1-3.md) | 1–3 | A-001…A-059 | A-01…A-59 | 27 | 19 | 12 | 1 |
| [`analisis-caps4-6.md`](./analisis-caps4-6.md) | 4–6 | A-060…A-137 | A-01…A-78 | 34 | 30 | 14 | 0 |
| [`analisis-caps7-9.md`](./analisis-caps7-9.md) | 7–9 | A-138…A-208 | A-01…A-71 | 38 | 20 | 13 | 0 |
| [`analisis-caps10-13.md`](./analisis-caps10-13.md) | 10–13 | A-209…A-292 | A-60…A-143 | 31 | 28 | 25 | 0 |

---

## Los 292


## Tomo caps. 1–3 — [`analisis-caps1-3.md`](./analisis-caps1-3.md)

### FASE 0 — ADMISIÓN Y ENCUADRE (cap. 1 §1.2/§1.5 · cap. 2 §2.1–§2.2)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-001** | Suficiencia del intake (¿puedo arrancar?) | 🟥 FALTA | A-01 |
| **A-002** | Clasificación restricción-vs-salida de cada campo de producción | 🟨 PARCIAL | A-02 |
| **A-003** | Capacidad requerida: cavidades mínimas por throughput | 🟨 PARCIAL | A-03 |
| **A-004** | Auditoría de tolerancias (¿alcanzable o sobre-especificada?) | 🟥 FALTA | A-04 |
| **A-005** | Auditoría regulatoria y estética | 🟥 FALTA | A-05 |
| **A-006** | Semáforo meta-vs-estimado de costo por pieza | 🟥 FALTA | A-06 |
| **A-007** | Ficha de material: verificación y documentación de supuestos | 🟨 PARCIAL | A-07 |
| **A-008** | Detección de conflictos entre subsistemas y arbitraje por importancia relativa | 🟨 PARCIAL | A-08 |
| **A-009** | Clasificación FIRME vs DIFUSO para compra concurrente | 🟥 FALTA | A-09 |

### FASE 1 — DFM DE LA PIEZA (cap. 2 §2.2.4 y §2.3)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-010** | Checklist DFM de 9 puntos (agregador) | 🟨 PARCIAL | A-10 |
| **A-011** | Checklist DFA de 6 puntos | 🟥 FALTA | A-11 |
| **A-012** | Uniformidad de pared y dirección de la transición | 🟩 SÍ | A-12 |
| **A-013** | Trade-off espesor nominal vs pared delgada + costillas | 🟥 FALTA | A-13 |
| **A-014** | Verificación de costilla (rib) | 🟩 SÍ | A-14 |
| **A-015** | Verificación de boss y gusset | 🟨 PARCIAL | A-15 |
| **A-016** | Verificación de esquinas (filetes y chaflanes) | 🟩 SÍ | A-16 |
| **A-017** | Disponibilidad de herramienta para el radio elegido | 🟥 FALTA | A-17 |
| **A-018** | Draft requerido por acabado y material | 🟩 SÍ | A-18 |
| **A-019** | Selección de acabado y sus TRES efectos simultáneos | 🟨 PARCIAL | A-19 |
| **A-020** | Detección y clasificación de undercuts | 🟩 SÍ | A-20 |
| **A-021** | Decisión eliminar-vs-conservar el undercut | 🟨 PARCIAL | A-21 |
| **A-022** | Propuesta de rediseño que abarata el molde del cliente | 🟥 FALTA | A-22 |

### FASE 2 — COSTO DEL MOLDE (cap. 3 §3.3)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-023** | Dimensiones del inserto de cavidad | 🟩 SÍ | A-23 |
| **A-024** | Selección del acero del inserto | 🟩 SÍ | A-24 |
| **A-025** | Costo de material del inserto | 🟩 SÍ | A-25 |
| **A-026** | Tiempo de maquinado volumétrico | 🟩 SÍ | A-26 |
| **A-027** | Tiempo de maquinado por área | 🟩 SÍ | A-27 |
| **A-028** | Factor de complejidad de la pieza | 🟩 SÍ | A-28 |
| **A-029** | Factor de maquinado por mezcla de procesos | 🟨 PARCIAL | A-29 |
| **A-030** | Costo de maquinado del inserto | 🟩 SÍ | A-30 |
| **A-031** | Tiempo y costo de acabado por zonas | 🟨 PARCIAL | A-31 |
| **A-032** | Costo de un juego de cavidad | 🟩 SÍ | A-32 |
| **A-033** | Descuento por multiplicidad de juegos de cavidad | 🟩 SÍ | A-33 |
| **A-034** | Dimensiones del mold base | 🟩 SÍ | A-34 |
| **A-035** | Masa y costo del mold base | 🟩 SÍ | A-35 |
| **A-036** | Costo de customización por subsistema | 🟩 SÍ | A-36 |
| **A-037** | Costo total del molde | 🟩 SÍ | A-37 |

### FASE 3 — COSTO POR PIEZA (cap. 3 §3.4)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-038** | Factor de mantenimiento | 🟨 PARCIAL | A-38 |
| **A-039** | Costo de molde amortizado por pieza | 🟩 SÍ | A-39 |
| **A-040** | Factor de desperdicio del feed y decisión de regrind | 🟨 PARCIAL | A-40 |
| **A-041** | Costo de material por pieza | 🟩 SÍ | A-41 |
| **A-042** | Tiempo de ciclo estimado | 🟩 SÍ | A-42 |
| **A-043** | Tonelaje de cierre | ⬛ DIVERGE | A-43 |
| **A-044** | Tarifa horaria de la máquina de moldeo | 🟨 PARCIAL | A-44 |
| **A-045** | Costo de proceso por pieza | 🟩 SÍ | A-45 |
| **A-046** | Yield esperado | 🟨 PARCIAL | A-46 |
| **A-047** | Costo por pieza | 🟩 SÍ | A-47 |

### FASE 4 — LECTURA, COMPARACIÓN Y CIERRE (cap. 3 §3.1, §3.2, §3.4.4, §3.5 + cap. 4 intro)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-048** | Costo total de producción por escenario | 🟩 SÍ | A-48 |
| **A-049** | Break-even entre arquitecturas | 🟩 SÍ | A-49 |
| **A-050** | Banda de sensibilidad sobre la cantidad de producción | 🟥 FALTA | A-50 |
| **A-051** | Barrido de escenarios (la tabla comparativa) | 🟩 SÍ | A-51 |
| **A-052** | Payback del hot runner de alta cavitación | 🟥 FALTA | A-52 |
| **A-053** | Vetos no económicos sobre el ganador | 🟨 PARCIAL | A-53 |
| **A-054** | Veredicto de SOBREDISEÑO (la lectura de la proporción) | 🟩 SÍ | A-54 |
| **A-055** | Sanity check geográfico del resultado | 🟨 PARCIAL | A-55 |
| **A-056** | Convergencia de la especificación del molde | 🟨 PARCIAL | A-56 |
| **A-057** | Costo verdadero vs precio, y términos de pago | 🟨 PARCIAL | A-57 |
| **A-058** | Calendario de desembolsos del proyecto | 🟥 FALTA | A-58 |
| **A-059** | Iteración inserto ↔ base discreta (frontera con el cap. 4) | 🟨 PARCIAL | A-59 |

## Tomo caps. 4–6 — [`analisis-caps4-6.md`](./analisis-caps4-6.md)

### CAPÍTULO 4 — ARQUITECTURA DEL MOLDE · A-060 … A-081

| ID | análisis | estado | era |
|---|---|---|---|
| **A-060** | Dirección de apertura del molde | 🟨 PARCIAL | A-01 |
| **A-061** | Ubicación de la línea de partición — prueba de visibilidad | 🟩 SÍ | A-02 |
| **A-062** | Planaridad de la línea y complejidad del plano de partición | 🟨 PARCIAL | A-03 |
| **A-063** | Ángulo de las features de interlock del plano de partición | 🟩 SÍ | A-04 |
| **A-064** | Conteo de shut-offs contra ventanas de la pieza | 🟨 PARCIAL | A-05 |
| **A-065** | Altura del inserto por línea de enfriamiento | 🟩 SÍ | A-06 |
| **A-066** | Redondeo de la altura del inserto al incremento de placa (hacia ARRIBA) | 🟨 PARCIAL | A-07 |
| **A-067** | Altura TOTAL del core para procuración | 🟥 FALTA | A-08 |
| **A-068** | Largo y ancho del inserto: agua contra estructura, y cuál domina | 🟩 SÍ | A-09 |
| **A-069** | Selección del layout de cavidades | 🟨 PARCIAL | A-10 |
| **A-070** | Relación de aspecto de la envolvente de cavidades | 🟩 SÍ | A-11 |
| **A-071** | Área usable del plano de partición (holgura ≥ ½·D por vecino) | 🟨 PARCIAL | A-12 |
| **A-072** | Dimensionado del mold base (L×W, A, B, S, E, C, stack) | 🟨 PARCIAL | A-13 |
| **A-073** | Compatibilidad con la máquina 1 — ancho entre tie bars | 🟩 SÍ | A-14 |
| **A-074** | Compatibilidad con la máquina 2 — daylight (falla por los dos lados) | 🟩 SÍ | A-15 |
| **A-075** | Compatibilidad con la máquina 3 — ventana de disparo | 🟩 SÍ | A-16 |
| **A-076** | Compatibilidad con la máquina 4 — tonelaje (suficiente y no excesivo) | 🟩 SÍ | A-17 |
| **A-077** | Difusividad térmica del acero del molde | 🟨 PARCIAL | A-18 |
| **A-078** | Factores de costo de fabricación y de operación del molde | 🟥 FALTA | A-19 |
| **A-079** | Selección del material de insertos por la matriz de Tabla 4.1 | 🟨 PARCIAL | A-20 |
| **A-080** | Compatibilidad del material elegido con el catálogo de mold bases | 🟩 SÍ | A-21 |
| **A-081** | Calificación del proveedor de mold base | 🟥 FALTA | A-22 |

### CAPÍTULO 5 — ANÁLISIS DE LLENADO · A-082 … A-107

| ID | análisis | estado | era |
|---|---|---|---|
| **A-082** | Temperatura de melt de análisis | 🟨 PARCIAL | A-23 |
| **A-083** | Tasa de corte y esfuerzo cortante nominales | 🟨 PARCIAL | A-24 |
| **A-084** | Gradiente de presión por esfuerzo de pared | 🟥 FALTA | A-25 |
| **A-085** | Curva de viscosidad Cross-WLF | 🟥 FALTA | A-26 |
| **A-086** | Modelo newtoniano de canal rectangular | 🟨 PARCIAL | A-27 |
| **A-087** | Modelo power law | 🟩 SÍ | A-28 |
| **A-088** | Velocidad de llenado recomendada, con lazo de convergencia | 🟩 SÍ | A-29 |
| **A-089** | Tiempo de llenado y caudal | 🟨 PARCIAL | A-30 |
| **A-090** | Check de banda de velocidad lineal | 🟩 SÍ | A-31 |
| **A-091** | Construcción y segmentación del lay-flat | 🟨 PARCIAL | A-32 |
| **A-092** | Ubicación de gates para balancear el flujo | 🟨 PARCIAL | A-33 |
| **A-093** | Presión de llenado de la cavidad | 🟩 SÍ | A-34 |
| **A-094** | Check de la banda de presión de cavidad (techo Y cola baja) | 🟩 SÍ | A-35 |
| **A-095** | Espesor mínimo de pared por la curva P(h) | 🟥 FALTA | A-36 |
| **A-096** | Área proyectada de la cavidad | 🟨 PARCIAL | A-37 |
| **A-097** | Tonelaje al final del llenado | 🟨 PARCIAL | A-38 |
| **A-098** | Tonelaje al inicio del empaque, con piso de 50 MPa | 🟨 PARCIAL | A-39 |
| **A-099** | Selección del tonelaje gobernante | 🟥 FALTA | A-40 |
| **A-100** | Predicción del patrón de llenado (arcos y phantom gates) | 🟩 SÍ | A-41 |
| **A-101** | Detección de race-tracking | 🟩 SÍ | A-42 |
| **A-102** | Longitudes de flujo comparadas | 🟩 SÍ | A-43 |
| **A-103** | Localización de líneas de soldadura | 🟩 SÍ | A-44 |
| **A-104** | Trampas de gas y última zona en llenar | 🟨 PARCIAL | A-45 |
| **A-105** | Dimensionado del flow leader | 🟩 SÍ | A-46 |
| **A-106** | Re-verificación del remedio (lo que costó el flow leader) | 🟥 FALTA | A-47 |
| **A-107** | Contraste análisis-a-mano contra simulación (Tabla 5.1) | 🟥 FALTA | A-48 |

### CAPÍTULO 6 — SISTEMA DE ALIMENTACIÓN · A-108 … A-137

| ID | análisis | estado | era |
|---|---|---|---|
| **A-108** | Selección del tipo de feed system | 🟨 PARCIAL | A-49 |
| **A-109** | Comparación económica y de plazo de la arquitectura | 🟨 PARCIAL | A-50 |
| **A-110** | Selección del layout del feed system | 🟩 SÍ | A-51 |
| **A-111** | Presupuesto de caída de presión del feed system | 🟩 SÍ | A-52 |
| **A-112** | Presupuesto de volumen del feed system | 🟩 SÍ | A-53 |
| **A-113** | Verificación de régimen laminar | 🟩 SÍ | A-54 |
| **A-114** | Caída de presión por segmento del feed | 🟨 PARCIAL | A-55 |
| **A-115** | Volumen total del feed system | 🟩 SÍ | A-56 |
| **A-116** | Reparto del presupuesto de ΔP por longitud | 🟩 SÍ | A-57 |
| **A-117** | Solver de radio por restricción de presión | 🟨 PARCIAL | A-58 |
| **A-118** | Barrido volumen contra presupuesto de presión | 🟥 FALTA | A-59 |
| **A-119** | Balanceo artificial de un molde familia | 🟥 FALTA | A-60 |
| **A-120** | Verificación de cierre del balanceo | 🟨 PARCIAL | A-61 |
| **A-121** | Métrica de regrind y su lectura económica | 🟩 SÍ | A-62 |
| **A-122** | Tiempo de enfriamiento del feed contra el de la cavidad | 🟩 SÍ | A-63 |
| **A-123** | Vueltas y tiempo de residencia del hot runner | 🟥 FALTA | A-64 |
| **A-124** | Diámetro hidráulico y eficiencia de la sección del runner | 🟩 SÍ | A-65 |
| **A-125** | Sección anular del valve gate | 🟨 PARCIAL | A-66 |
| **A-126** | Redondeo a diámetro de cortador estándar | 🟨 PARCIAL | A-67 |
| **A-127** | Ajuste steel-safe (redondear HACIA ABAJO) | 🟨 PARCIAL | A-68 |
| **A-128** | Re-verificación post-redondeo | 🟨 PARCIAL | A-69 |
| **A-129** | Monotonía de diámetros aguas abajo | 🟥 FALTA | A-70 |
| **A-130** | Orificio de boquilla contra entrada del sprue | 🟩 SÍ | A-71 |
| **A-131** | Velocidad y tiempo de apertura del molde | 🟩 SÍ | A-72 |
| **A-132** | Comparativa dimensional dos placas contra tres placas | 🟩 SÍ | A-73 |
| **A-133** | Apertura A–B y longitudes libres de los stripper bolts | 🟩 SÍ | A-74 |
| **A-134** | Dimensionado de sucker pins | 🟨 PARCIAL | A-75 |
| **A-135** | Longitud total y número de ramas del feed | 🟥 FALTA | A-76 |
| **A-136** | La regla de velocidad constante, como CONTRAEJEMPLO | 🟩 SÍ | A-77 |
| **A-137** | Aislamiento térmico del hot runner | 🟨 PARCIAL | A-78 |

## Tomo caps. 7–9 — [`analisis-caps7-9.md`](./analisis-caps7-9.md)

### FASE A — COMPUERTAS (cap. 7)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-138** | Ruta de degatado (¿quién separa la colada de la pieza?) | 🟨 PARCIAL | A-01 |
| **A-139** | Selección del TIPO de compuerta (Tabla 7.1) | 🟩 SÍ | A-02 |
| **A-140** | Zona gateable y destino del vestigio | 🟨 PARCIAL | A-03 |
| **A-141** | Caudal volumétrico supuesto por compuerta | 🟨 PARCIAL | A-04 |
| **A-142** | Semilla dimensional de la compuerta | 🟩 SÍ | A-05 |
| **A-143** | Tasa de corte de la compuerta y su veredicto | 🟨 PARCIAL | A-06 |
| **A-144** | Despeje inverso: la dimensión que da el corte objetivo | 🟩 SÍ | A-07 |
| **A-145** | Reducción a geometría equivalente (diafragma y fan) | 🟥 FALTA | A-08 |
| **A-146** | Viscosidad evaluada a la tasa de corte de la compuerta | 🟨 PARCIAL | A-09 |
| **A-147** | Caída de presión de la compuerta y su veredicto | 🟩 SÍ | A-10 |
| **A-148** | Tiempo de congelamiento de la compuerta | 🟩 SÍ | A-11 |
| **A-149** | Semáforo congelamiento vs empaque requerido (el veredicto que puede tirar todo) | 🟩 SÍ | A-12 |
| **A-150** | ¿La compuerta entra a una sección delgada? | 🟨 PARCIAL | A-13 |
| **A-151** | Geometría del túnel: los tres números que "must be specified" | 🟩 SÍ | A-14 |
| **A-152** | Retención del sistema de alimentación del lado del núcleo | 🟩 SÍ | A-15 |
| **A-153** | Criterios de flujo lineal (fan, flash, diafragma) | 🟥 FALTA | A-16 |
| **A-154** | Decisión steel-safe de la compuerta | 🟩 SÍ | A-17 |
| **A-155** | ¿Se puede balancear el llenado con las compuertas? | 🟥 FALTA | A-18 |
| **A-156** | Remedios contra contracción volumétrica excesiva por congelamiento prematuro | 🟥 FALTA | A-19 |
| **A-157** | Checklist de cierre de compuertas (§7.4) | 🟨 PARCIAL | A-20 |

### FASE B — VENTEO (cap. 8)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-158** | Gasto de aire desplazado | 🟨 PARCIAL | A-21 |
| **A-159** | Reparto del flujo de aire entre venteos (la regla anti-prorrateo) | 🟩 SÍ | A-22 |
| **A-160** | Mapa de ubicaciones candidatas (los tres tipos) | 🟩 SÍ | A-23 |
| **A-161** | Clasificación obligatorio / opcional / diferido, y el corte | 🟩 SÍ | A-24 |
| **A-162** | Espesor MÍNIMO del venteo (Eq 8.2) | 🟩 SÍ | A-25 |
| **A-163** | Tiempo de solidificación DENTRO del venteo (t_flash) | 🟥 FALTA | A-26 |
| **A-164** | Presión del fundido en el instante del flash (Eq 8.4) | 🟩 SÍ | A-27 |
| **A-165** | Espesor MÁXIMO del venteo por rebaba (Eq 8.3) | 🟩 SÍ | A-28 |
| **A-166** | Banda de espesor y su palanca | 🟩 SÍ | A-29 |
| **A-167** | Contraste contra los handbooks (Tabla 8.1) | 🟩 SÍ | A-30 |
| **A-168** | Espesor del venteo de expulsor a partir de la holgura de manufactura | 🟩 SÍ | A-31 |
| **A-169** | Anatomía del venteo (land, alivio, salida) | 🟥 FALTA | A-32 |
| **A-170** | Rebaba por deflexión de placas sobre cara estética | 🟩 SÍ | A-33 |
| **A-171** | Solución para cada bolsa muerta | 🟥 FALTA | A-34 |
| **A-172** | Ruteo del canal de venteo contra las líneas de agua | 🟨 PARCIAL | A-35 |
| **A-173** | Checklist de cierre de venteo (§8.4) | 🟨 PARCIAL | A-36 |

### FASE C — ENFRIAMIENTO (cap. 9)

| ID | análisis | estado | era |
|---|---|---|---|
| **A-174** | Sección gobernante (la más gruesa) | 🟩 SÍ | A-37 |
| **A-175** | Temperatura de expulsión (T_eject) | 🟩 SÍ | A-38 |
| **A-176** | Tiempo de enfriamiento (Eqs 9.5 y 9.6) | 🟩 SÍ | A-39 |
| **A-177** | Contraste con la regla de dedo (Eqs 9.8 y 9.9) | 🟩 SÍ | A-40 |
| **A-178** | Corrección por frontera convectiva | 🟨 PARCIAL | A-41 |
| **A-179** | Tiempo de enfriamiento del runner contra el de la pieza | 🟩 SÍ | A-42 |
| **A-180** | Tiempo de ciclo gobernante del molde | 🟨 PARCIAL | A-43 |
| **A-181** | Flujo de calor por un solo lado (h → 2h) | 🟨 PARCIAL | A-44 |
| **A-182** | Orden de las capas en two-shot | 🟥 FALTA | A-45 |
| **A-183** | Masa del disparo | 🟩 SÍ | A-46 |
| **A-184** | Calor a extraer por ciclo (Eq 9.10) | 🟩 SÍ | A-47 |
| **A-185** | Potencia de enfriamiento total y por línea (Eqs 9.11 y 9.12) | 🟩 SÍ | A-48 |
| **A-186** | ΔT admisible del refrigerante | 🟨 PARCIAL | A-49 |
| **A-187** | Caudal de refrigerante por línea (Eq 9.13) | 🟨 PARCIAL | A-50 |
| **A-188** | Factibilidad contra el controlador comercial (Tabla 9.1) | 🟩 SÍ | A-51 |
| **A-189** | Diámetro MÁXIMO por turbulencia (Eqs 9.14 y 9.15) | 🟩 SÍ | A-52 |
| **A-190** | Diámetro MÍNIMO por caída de presión (Eqs 9.16 y 9.17) | 🟩 SÍ | A-53 |
| **A-191** | Selección del diámetro estándar (Tabla 9.2) | 🟩 SÍ | A-54 |
| **A-192** | Refrigerante viscoso: régimen laminar (Eq 9.18) | 🟨 PARCIAL | A-55 |
| **A-193** | Profundidad por concentración de esfuerzo (Eq 9.19) | 🟩 SÍ | A-56 |
| **A-194** | Profundidad por transferencia de calor (Eqs 9.20 y 9.21) | 🟩 SÍ | A-57 |
| **A-195** | Ventana de profundidad 2D < H < 5D (Eq 9.22) | 🟩 SÍ | A-58 |
| **A-196** | Paso entre líneas (Eqs 9.23 y 9.24) | 🟩 SÍ | A-59 |
| **A-197** | La trampa del material conductivo a paso ancho | 🟥 FALTA | A-60 |
| **A-198** | Ruteo: interferencia y claro de medio diámetro | 🟨 PARCIAL | A-61 |
| **A-199** | Campo térmico del molde y gradiente del núcleo profundo | 🟩 SÍ | A-62 |
| **A-200** | Selector de enfriamiento para núcleo esbelto (Tabla 9.3) | 🟩 SÍ | A-63 |
| **A-201** | Integridad estructural del núcleo con el dispositivo dentro | 🟨 PARCIAL | A-64 |
| **A-202** | Material asimétrico núcleo / cavidad | 🟥 FALTA | A-65 |
| **A-203** | Retorno de inversión del material conductivo | 🟥 FALTA | A-66 |
| **A-204** | Arquitectura del circuito | 🟥 FALTA | A-67 |
| **A-205** | Usabilidad del circuito para el operador | 🟨 PARCIAL | A-68 |
| **A-206** | Expulsores dentro del área sellada por gasket | 🟥 FALTA | A-69 |
| **A-207** | Checklist de cierre de enfriamiento (§9.4) | 🟨 PARCIAL | A-70 |

### FRONTERA CON EL CAP. 10 — el análisis que cierra el argumento del cap. 9

| ID | análisis | estado | era |
|---|---|---|---|
| **A-208** | Alabeo por contracción diferencial a través del espesor (Ecs. 10.17 y 10.18) | 🟩 SÍ | A-71 |

## Tomo caps. 10–13 — [`analisis-caps10-13.md`](./analisis-caps10-13.md)

### CAPÍTULO 10 — CONTRACCIÓN Y ALABEO

| ID | análisis | estado | era |
|---|---|---|---|
| **A-209** | Condiciones de proceso nominales | 🟨 PARCIAL | A-60 |
| **A-210** | Volumen específico PvT (Tait doble dominio) | 🟩 SÍ | A-61 |
| **A-211** | Gate de sanidad del modelo PvT contra el dato del proveedor | 🟥 FALTA | A-62 |
| **A-212** | Contracción volumétrica del ciclo | 🟩 SÍ | A-63 |
| **A-213** | Contracción anisotrópica (LCP y reforzados con fibra) | 🟥 FALTA | A-64 |
| **A-214** | Banda de contracción (límites inferior y superior) | 🟩 SÍ | A-65 |
| **A-215** | Alarma de sobre-empaque (s ≤ 0) | 🟩 SÍ | A-66 |
| **A-216** | Recomendación final de contracción y asignación de responsabilidad | 🟨 PARCIAL | A-67 |
| **A-217** | Escalado del acero desde la contracción | 🟩 SÍ | A-68 |
| **A-218** | Mapa de contracción NO uniforme (validación por simulación) | 🟥 FALTA | A-69 |
| **A-219** | Sesgo steel-safe de cavidad y corazón | 🟨 PARCIAL | A-70 |
| **A-220** | Sensibilidad de la contracción al proceso y perfilado de empaque | 🟥 FALTA | A-71 |
| **A-221** | Bandera de semicristalino | 🟨 PARCIAL | A-72 |
| **A-222** | Corrección por rellenos sin PvT propio | 🟥 FALTA | A-73 |
| **A-223** | Clasificación topológica de la región (¿área cerrada o marco?) | 🟩 SÍ | A-74 |
| **A-224** | Pandeo por contracción diferencial A TRAVÉS DEL ÁREA | 🟩 SÍ | A-75 |
| **A-225** | Checklist de uniformidad anti-alabeo (diseño del molde) | 🟨 PARCIAL | A-76 |
| **A-226** | Escalera de remedios de alabeo, con su costo | 🟥 FALTA | A-77 |

### CAPÍTULO 11 — SISTEMA DE EXPULSIÓN

| ID | análisis | estado | era |
|---|---|---|---|
| **A-227** | Planos de partición y direcciones de expulsión | 🟩 SÍ | A-78 |
| **A-228** | Jerarquía de accionamiento del corazón móvil | 🟨 PARCIAL | A-79 |
| **A-229** | Área efectiva de expulsión (A_eff) | 🟩 SÍ | A-80 |
| **A-230** | Fuerza de expulsión | 🟩 SÍ | A-81 |
| **A-231** | Sanity-check de la fuerza contra la máquina | 🟩 SÍ | A-82 |
| **A-232** | Área mínima de empuje (compresión en el acero del pin) | 🟩 SÍ | A-83 |
| **A-233** | Perímetro mínimo (cortante en el PLÁSTICO) — la vara que gobierna | 🟩 SÍ | A-84 |
| **A-234** | Pandeo del pin de expulsión | 🟨 PARCIAL | A-85 |
| **A-235** | Restricción gobernante del pin (el peor de tres) | 🟩 SÍ | A-86 |
| **A-236** | Pocos y grandes vs muchos y chicos | 🟨 PARCIAL | A-87 |
| **A-237** | Acero mínimo entre barreno de eyector y cavidad | 🟩 SÍ | A-88 |
| **A-238** | Layout: distancia de cada pin al punto de agarre | 🟩 SÍ | A-89 |
| **A-239** | Conflicto pin ↔ línea de agua (RETORNO) | 🟨 PARCIAL | A-90 |
| **A-240** | Interferencia térmica del pin | 🟥 FALTA | A-91 |
| **A-241** | Decisión de marcas testigo | 🟨 PARCIAL | A-92 |
| **A-242** | Largo del pin contorneado contra el espesor de venteo | 🟥 FALTA | A-93 |
| **A-243** | Cuchilla (ejector blade): largo máximo por pandeo | 🟩 SÍ | A-94 |
| **A-244** | Carrera de servicio de la cuchilla | 🟥 FALTA | A-95 |
| **A-245** | Sleeve: stack-up de concentricidad | 🟥 FALTA | A-96 |
| **A-246** | Stripper plate: balance de fuerzas y punto de contacto | 🟨 PARCIAL | A-97 |
| **A-247** | Expulsión elástica de undercut (¿hace falta mecanismo?) | 🟩 SÍ | A-98 |
| **A-248** | Core pull: fuerza que debe vencer el actuador | 🟩 SÍ | A-99 |
| **A-249** | Core pull: diámetro de cilindro y carrera | 🟨 PARCIAL | A-100 |
| **A-250** | Slide con perno ángel: ángulo y carrera | 🟩 SÍ | A-101 |
| **A-251** | Retorno de expulsores: resortes contra retorno positivo | 🟨 PARCIAL | A-102 |
| **A-252** | Holguras de detallado del pin | 🟨 PARCIAL | A-103 |

### CAPÍTULO 12 — SISTEMA ESTRUCTURAL

| ID | análisis | estado | era |
|---|---|---|---|
| **A-253** | Elección del esfuerzo límite: dos caminos EXCLUYENTES | 🟨 PARCIAL | A-104 |
| **A-254** | Vida objetivo en ciclos → límite de fatiga | 🟨 PARCIAL | A-105 |
| **A-255** | von Mises contra el esfuerzo límite | 🟩 SÍ | A-106 |
| **A-256** | Deflexión contra espesor de venteo (el criterio de flash) | 🟩 SÍ | A-107 |
| **A-257** | Compresión de placas y área de soporte efectiva | 🟨 PARCIAL | A-108 |
| **A-258** | Flexión de placa como viga | 🟨 PARCIAL | A-109 |
| **A-259** | Layout de pilares de soporte | 🟨 PARCIAL | A-110 |
| **A-260** | Superposición compresión + flexión del pilar | 🟥 FALTA | A-111 |
| **A-261** | Pre-carga de pilares | 🟩 SÍ | A-112 |
| **A-262** | Mejilla (cheek): cortante y deflexión de pared lateral | 🟨 PARCIAL | A-113 |
| **A-263** | Interlock en el plano de partición | 🟩 SÍ | A-114 |
| **A-264** | Concentración de esfuerzo alrededor de un barreno | 🟩 SÍ | A-115 |
| **A-265** | Distancia mínima de línea de agua a la cavidad | 🟨 PARCIAL | A-116 |
| **A-266** | Barreno de eyector: ovalización y vida a fatiga | 🟨 PARCIAL | A-117 |
| **A-267** | Corazón hueco: compresión axial | 🟩 SÍ | A-118 |
| **A-268** | Corazón hueco: esfuerzo de aro con DOBLE vara | 🟩 SÍ | A-119 |
| **A-269** | Flexión de corazón esbelto (core bending) | 🟨 PARCIAL | A-120 |
| **A-270** | Estimación del diferencial de presión sobre el corazón | 🟥 FALTA | A-121 |
| **A-271** | Ajustes (fits): límites dimensionales | 🟩 SÍ | A-122 |
| **A-272** | Fuerza de inserción del ajuste vs prensa del taller | 🟥 FALTA | A-123 |
| **A-273** | Tornillos SHCS por peor caso de izaje | 🟩 SÍ | A-124 |
| **A-274** | Dowels: juego esperado y peor caso de interferencia | 🟥 FALTA | A-125 |
| **A-275** | Cierre estructural: los tres veredictos independientes | 🟨 PARCIAL | A-126 |

### CAPÍTULO 13 — TECNOLOGÍAS DE MOLDE

| ID | análisis | estado | era |
|---|---|---|---|
| **A-276** | Selección de tecnología de molde (la decisión temprana) | 🟨 PARCIAL | A-127 |
| **A-277** | Meta-material de coinyección | 🟥 FALTA | A-128 |
| **A-278** | Canal de flujo para gas/water assist | 🟥 FALTA | A-129 |
| **A-279** | Espesor de la segunda capa en multi-shot | 🟥 FALTA | A-130 |
| **A-280** | Core-back: cuchillas divisorias | 🟥 FALTA | A-131 |
| **A-281** | Insulated runner: piel congelada | 🟥 FALTA | A-132 |
| **A-282** | Stack mold: clamp compartido contra sus cinco costos | 🟥 FALTA | A-133 |
| **A-283** | Desbalance térmico de runner ramificado (Melt Flipper) | 🟥 FALTA | A-134 |
| **A-284** | Pulsed cooling: energía por ciclo | 🟥 FALTA | A-135 |
| **A-285** | Conduction heating: potencia mínima contra el drenaje al agua | 🟥 FALTA | A-136 |
| **A-286** | Induction heating: ventana de potencia y gradiente | 🟥 FALTA | A-137 |
| **A-287** | In-mold labeling: carga sobre el film | 🟥 FALTA | A-138 |
| **A-288** | Collapsible core: colapso disponible contra el undercut | 🟩 SÍ | A-139 |
| **A-289** | Rotating core: anti-rotación y arquitectura de accionamiento | 🟨 PARCIAL | A-140 |
| **A-290** | Gobernanza: el acta de decisiones aprobada | 🟨 PARCIAL | A-141 |

### APÉNDICES — las bases de datos que alimentan los veredictos

| ID | análisis | estado | era |
|---|---|---|---|
| **A-291** | Selección de metal de molde por límite de fatiga | 🟨 PARCIAL | A-142 |
| **A-292** | Costo de maquinado y cotización | 🟩 SÍ | A-143 |

---

## Cómo se lee esto

Un análisis es una cosa que Kazmer **calcula y con la que decide algo**, no un párrafo del libro.
Cada ficha en los tomos trae siempre los mismos ocho campos: **CUÁNDO · ENTRADAS · EL CÁLCULO ·
SALIDA · DECIDE · CRITERIO · INVALIDA · ¿TENEMOS?**. Las `←A-nnn` en ENTRADAS son las aristas del
grafo: quién alimenta a quién. Los IDs de este índice son los mismos que citan los tomos y el
código (p. ej. `ejection.ts` cita **A-234**, `feed-layouts.ts` cita **A-136**).

**Lo que este índice dice de nosotros hoy:** 130 de 292 análisis (44.5 %) existen en el código.
Faltan **64** completos y hay **97** a medias. La suma 🟥+🟨 = **161** es el
trabajo pendiente medido contra el libro, no contra una opinión.
