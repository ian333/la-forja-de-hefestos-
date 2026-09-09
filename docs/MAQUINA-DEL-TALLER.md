# LA MÁQUINA DEL TALLER — FCS HT-150SV (2022)

> ian, 2026-09-08, con la máquina entrando al taller: «todos los datos de la forja serán ahora con
> datos de este bebé · ya busqué placa de datos y modelo y nop · es 2022». No hay placa legible.
> **La fuente es el catálogo oficial de FCS**, no una estimación. Cada número de abajo tiene su celda
> en una captura del catálogo (`public/evidencia/2026-09-08-la-inyectora-del-taller/`). Lo que el
> catálogo NO trae está marcado **SIN DATO** con la instrucción de dónde leerlo en la máquina.
> En código: `src/forja/mold/machinesizing.ts:MAQUINA_DEL_TALLER` (selector la juzga PRIMERO) y
> `src/forja/mold/moldbase.ts:MACHINES` (última entrada).

## Fuentes (bajadas 2026-09-08, copias locales en `docs/forja-research/manuales/`, no versionadas)

| # | documento | de dónde | sha256 (16) | qué trae |
|---|-----------|----------|-------------|----------|
| A | FCS *Servo Power-Saving Injection Molding Machine (HT Series)*, catálogo 2022, 10 pág. A3 | `mitchellindustries.com/wp-content/uploads/2022/06/HT-catalog.pdf` (distribuidor FCS EE.UU.) | `7a7f44cb2f696f2e` | tablas HT(220V) y HT(380V) pp. 9–12 con **columna HT-150**; dibujo de platina HT-150 p. 13 |
| B | FCS *HT-SV Series* brochure 2016, 12 pág. | `immtechnical.co.uk/wp-content/uploads/2016/05/HT-SV_Brochure.pdf` (distribuidor FCS UK) | `f3408f98bfe5be98` | tabla p. 9–10 con **columna HT-150SV** (dos tipos de unidad de inyección I/II) |
| C | FCS *HT Series* brochure 2025, 12 pág. | `fcs.com.tw/pdf/7762/…(HT Series)_2025.pdf` (oficial) | `2fe81c541da6307c` | **sin tablas**: salta de la p. 8 a la 17; solo confirma la línea HT-100…HT-1600 y los accesorios |

El sitio de FCS (`fcs.com.tw/download_pdcata`) enlaza los PDF de `/pdf/4887/…` pero devuelve 404; la
página del producto enlaza C (sin tablas). Los distribuidores publican el catálogo completo. La
máquina de ian es de 2022 → **A es la edición que le toca**; B confirma con el nombre exacto «HT-150SV».
Windsor/FCS en K2016 (SD-150SV, mismo grupo de cierre): 1 500 kN, platinas 670×670, molde 130–550,
daylight 1 010 mm, tie bars 460×460 — coincide.

## La tabla (columna HT-150 / HT-150SV)

Tres tornillos por modelo: **A ⌀40 · B ⌀44 · C ⌀50 mm**. Cuál trae la del taller: **SIN DATO**
(ver abajo). El código usa **B** por defecto y lo dice.

| ítem (FCS) | unidad | A · 2022 (HT-150) | B · 2016 (HT-150SV) | en código |
|---|---|---|---|---|
| Screw diameter 螺桿直徑 | mm | 40 · **44** · 50 | 40 · 44 · 50 | shot/presión por tornillo B |
| Screw stroke 射出行程 | mm | 200 | 200 | — |
| Theoretical shot volume 理論射出容積 | cm³ | 251 · **304** · 393 | 251 · 304 · 393 | `shotCc: 304` |
| Shot weight (PS) 理論射出量 | g | 229 · 277 · 357 | 229 · 277 · 357 | — |
| Injection pressure 射出壓力 | kgf/cm² | 2205 · **1822** · 1411 | tipo I: 1785 · 1475 · 1142 / tipo II: 2205 · 1822 · 1411 | `maxInjPressureMPa: 178.7` (1822 × 0.0980665) |
| Injection speed 射出速度 | mm/s | 97 | I 128 / II 108 | — |
| Injection rate 射出率 | cm³/s | 122 · 147 · 190 | I 161 · 195 · 252 / II 135 · 164 · 212 | — |
| Mold clamping force 閉模力 | tonf | **150** | 150 | `clampTons: 150` (1 471 kN) |
| Mold clamping stroke 夾模行程 | mm | 460 | 460 | daylight = 550 + 460 |
| Mold thickness 模厚 | mm | **130 ~ 550** | 130 ~ 550 | `minDaylightMm: 130`; `maxDaylightMm: 1010` |
| Suggested min. mold dim. (H×V) | mm | 299 × 299 | 299 × 299 | — (aviso de placas chicas: pendiente) |
| Tie bar spacing (H×V) 大柱內距 | mm | **462 × 462** | 460 × 460 | `tieHmm/tieVmm: 462` (ed. 2022) |
| Mold platen (H×V) 模盤尺寸 | mm | 670 × 670 | 670 × 670 | — |
| Ejector stroke 頂出行程 | mm | 110 | 110 | — |
| Ejector force 頂出力 | tonf | **4.0** | 4.0 | `ejectionForceKN: 39.2` |
| Max. pump driving motor | kW | **13.4 (220 V)** / 18.2 (380 V) | 11 / 15 | — · la del taller es 220 V (ian, 2026-09-09) |
| Temperature controller | set | 5 | (0–400 °C) × 4 | — |
| Heater capacity 電熱容量 | kW | 11.4 | 11.41 | — |
| Machine dimensions (L×W×H) | mm | 5300 × 1600 × 1800 | 5050 × 1380 × 1730 | — |
| Oil tank capacity | L | 270 | 270 | — |
| Machine weight | t | 5.5 | 5.5 | — |
| Max. system pressure | kgf/cm² | 140 | 140 | — |

Las dos ediciones coinciden en todo lo que dimensiona el molde (cierre, tornillos, shot, molde, platina,
expulsión). Difieren en tie bars (462 vs 460 mm), velocidad de inyección (97 vs 128/108 mm/s), motor y
huella de la máquina: **se toma la edición 2022** por ser la de la máquina; la 2016 se anota.

### Platina fija HT-150 (catálogo 2022 p. 13, `platina-ht150.png`)

- Platina 670 × 670 mm; luz entre columnas 462 × 462 mm.
- Anillo de centrado **⌀100 mm** (agujero central); saliente máxima del anillo «Max. 30».
- Patrón de roscas de sujeción **100 × M16 × 29 de profundidad**, en una malla a 75 / 125 / 150 /
  175 / 200 / 225 / 250 / 275 mm del centro (H y V); 4 × ⌀35 pasantes.
- Placa expulsora: **8 × M16 × 32**; patrón de barras expulsoras a 175 y 280 mm (H) · 200 mm (V);
  barra central con «R10, ⌀3» (radio de la punta).
- El dibujo completo está en la captura; **el molde de La Forja debe respetar este patrón** (anillo
  ⌀100 y agujeros KO) — hoy `moldbase.ts` no modela la platina: es trabajo siguiente, no de esta orden.

## SIN DATO (no se inventa; se lee en la máquina)

| dato | por qué importa | dónde leerlo |
|---|---|---|
| **Tornillo instalado (A ⌀40 / B ⌀44 / C ⌀50)** | fija shot (251/304/393 cm³) y presión máx (2205/1822/1411 kgf/cm²) | pantalla del controlador FCS-6500S/KEBA → parámetros de máquina («screw diameter»); o el grabado en el cañón/tornillo; o la hoja de embarque |
| **Unidad de inyección tipo I o II** (solo si es ed. 2016) | velocidad/presión distintas | misma pantalla de parámetros (presión máx: 1475 → I, 1822 → II con tornillo B) |
| ~~Tensión 220 / 380 V~~ **220 V** (ian, 2026-09-09) | motor de bomba **13.4 kW** (columna 220 V) | confirmado por ian; queda pendiente la foto de la placa del interruptor |
| **Orificio y radio de la punta de boquilla** | §6.3.1: orificio de boquilla < entrada del sprue; radio 10 ó 19 mm debe casar con el bebedero | medir la punta instalada con calibrador; la platina dice R10 en la barra central (no es la boquilla) |
| **Número de serie / año** | garantía, manual de la unidad | FCS pone la placa en el bastidor del lado del operador, cerca del gabinete, o dentro de la puerta del gabinete eléctrico; también en la pantalla «Machine info» del controlador |
| **Tasa de plastificación (g/s)** | residencia del fundido | no está en el catálogo (publica tasa de INYECCIÓN); se mide con un purgado cronometrado |
| **Patrón KO real / agujeros de la platina móvil** | expulsión del molde | fotografía de la platina móvil con cinta métrica; el catálogo dibuja la fija |

## Cómo lo usa La Forja desde esta orden

- `selectInjectionMachine(req, molde)` juzga **primero** la HT-150SV: si la pieza cabe (clamp ≤ 150 t,
  shot ≤ 85 % de 304 cc, presión ≤ 178.7 MPa, expulsión ≤ 39.2 kN, base entre 462×462, molde abierto
  ≤ 1010 mm), **esa es la máquina** aunque el mercado tenga una más chica (el shot < 25 % se avisa,
  no veta). Si no cabe, el veredicto dice **por qué** («no cabe en la FCS HT-150SV (taller): clamp
  157 t > 150 t → en el mercado: IM-250») y `seleccion.taller` lo conserva para el expediente.
- Los ejercicios del libro (cup → IM-50, bezel → IM-250) se corren con `taller = null`: siguen siendo
  del libro. Test: `node --import tsx scripts/mold-machinesizing-test.cjs` (20 checks).
- Pendiente (no de esta orden): modelar la platina (anillo ⌀100, roscas M16, KO) en `moldbase.ts`
  para que las placas del molde se dibujen con SU patrón de sujeción; aviso «molde < 299×299
  sugerido»; leer del controlador el tornillo real y actualizar `shotCc/maxInjPressureMPa`.
