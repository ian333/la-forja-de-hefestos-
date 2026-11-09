# 08 · Límites térmicos y de precisión: imprimir gota a gota con E71T-GS 0.8 mm, sin gas, a 40–60 A

> Investigación del arco, 2026-11-05. Script: `scripts/investigacion-arco/08_limites_termicos_precision.py` → salida cruda `scripts/investigacion-arco/08_limites_termicos_precision.out` (corrido en iangpu, 10 procesos). Cada número de este reporte sale de ahí o de una fuente citada.

## 1. La pregunta

¿Qué precisión, qué velocidad y qué calidad permite la física al imprimir acero gota a gota con el Truper MICRO-1 (E71T-GS 0.030", tubular, sin gas) a 40–60 A? ¿Y la escoria deja imprimir capa sobre capa?

## 2. La respuesta corta

- **El arco cobra un impuesto de calor: ~50 J por cada mm³ que deposita** (49.5 J/mm³ a 40 A, 52.9 a 60 A, según las fichas). Fundir el acero cuesta 10.3 J/mm³, así que el arco mete 4.8 veces lo necesario. Con ese impuesto, la pieza manda: sobre la loseta, la placa de prueba pasa de 400 °C en 53 s de arco continuo y se estaciona en 852 °C. Los techos de velocidad de la revisión del 31-oct hay que dividirlos entre ~4.8.
- **Velocidad.** Con el arco prendido: 0.27 kg/h a 40 A y 0.40 kg/h a 60 A (34–51 cm³/h). Pero la espera entre capas, que hay que hacer para que la cara de arriba baje de 400 °C, deja el promedio real en **46–187 g/h**. Tiempos a 40 A:

  | pieza | sobre la loseta | sobre disipador |
  |---|---|---|
  | cubo de 20 mm | 87 min | 17 min |
  | engrane m1.5 z16 | 25 min | 4.5 min |
  | pared 50×50×3.5 | 54 min | 27 min (con aire) |
  | pared 50×50×1.2 | 31 min | 18 min (con aire) |

  La espera por capa crece con la altura: de 0.5 s a 10–50 s.
- **Precisión.** Una gota sola funde una mancha de ~1.3 mm, del tamaño de la gota. Pero con el arco de 40 A prendido sin parar, el calor se suma. Sobre una pared de 1.2 mm, la simulación de pared da un charco de **13–16 mm de largo a 16 mm/s y 7–8 mm a 31 mm/s**: esa pared se escurre y termina en ~3 mm.
  - Lo alcanzable con este arco es una pared de **3–4.5 mm, capa de 1 mm y ondulación de ±0.1–0.36 mm**, con altura controlada a ±30 µm por el voltaje.
  - La resolución de gota (pared de 1.2 mm, ±35–75 µm) pide bajar la potencia media sobre la pared a ≲200–300 W. Sin probar.
  - **La deformación (0.5–2.8 mm de flecha por pasada en la placa de 3 mm libre) es mayor que todo lo demás** si la placa no está sujeta.
- **LA ESCORIA ES EL BLOQUEO PRINCIPAL de «sin gas, mismo material».** Según el cálculo, que sale del fundente de la patente y de la eficiencia de las fichas (no está medido), el E71T-GS deja ~0.38 mm³ de escoria por cada mm³ de metal (rango 0.23–0.56): una costra de ~190 µm por cada capa de 0.5 mm. En autoprotegidos no existe un alambre sin escoria, porque la escoria y el vapor **son** la protección. Imprimir sin quitarla: **FALSA**. Con un cepillo automático en cada capa: **INCIERTO**, y solo en modo charco. Este alambre está clasificado «S», de **una sola pasada**: la norma no garantiza nada del metal cuando todo el depósito es metal de aporte, que es justo lo que es una pieza impresa.
- **Qué cambia:** quitar la loseta y sujetar la placa a un disipador (bloque grueso o placa con agua). Agregar cepillo rotativo + soplido entre capas. Firmware con espera por capa hasta que la cara de arriba baje de T_obj. Stickout largo (20–25 mm) para que el Joule funda el alambre en vez de calentar la pieza. Y, si se quiere multipaso sin gas, cambiar a un E71T-11 de 0.030" (NR-211-MP): mismo alimentador, misma polaridad.

## 3. Método

**El alambre real (§A del .out).** La ficha de Truper del MICRO-5 (13751, la misma línea en caja de 5 kg) dice E71T-GS de **0.030" = 0.762 mm**, hecho en China (el canon usa 0.800). No hay ficha de parámetros de Truper, así que se usan alambres equivalentes:
- Lincoln NR-211-MP (E71T-11) 0.030": 1.27 m/min ↔ 30 A y 2.54 m/min ↔ 60 A, con eficiencia de 81 % y 75 %.
- Lincoln EU 0.9 mm: 1.22 kg de alambre por kg de metal, Al 1.5 % en el metal depositado.
- Blue Demon E71T-GS 0.030": 50 A, 15 V, 80 ipm.
- Masa lineal: McMaster, 450 ft/lb → 3.31 g/m.

Con eficiencia 0.80, el metal que queda es **0.337 mm³ por mm de alambre**, el 74 % del área geométrica. El canon (TS) usa 0.503 mm² y sobreestima el metal ×1.49.

**Calor.** q_neto = η·V·I con η = 0.80. DuPont–Marder miden 0.84 para electrodo consumible; para FCAW-S no hay dato medido, así que η queda como supuesto (±10 %). V sale de las fichas: 14.5–15.5 V.

**Rosenthal (§C, §D).**
- Placa de 3 mm: fuente puntual móvil con imágenes (cara de abajo adiabática = loseta), comparada con el límite grueso (punto) y el delgado (línea), más el criterio de Adams.
- Pared: línea móvil en el borde de una placa de espesor w.
- Propiedades: k = 30 W/m·K, α = 5.88 mm²/s; isoterma de fusión 1490 °C.

**Gota quieta (§E).** El arco quieto mientras se forma una gota (29–44 ms): erfc en placa, E1 en la pared.

**Placa sola (§F).** Modelo concentrado: 118 g, ε = 0.7, h = 10 W/m²K, loseta ≈ 10 W/m²K.

**Pared 50×50 por diferencias finitas (§G).** Simulación 2D (x a lo largo, z hacia arriba), con el espesor fuera del plano y la placa 100×50×3 debajo.
- Propiedades: k(T) y c(T) con calor latente; conductividad del líquido ×3 (Marangoni, práctica común en modelos de WAAM).
- Pérdidas: radiación ε = 0.7 más convección; base a loseta (h = 10) o a disipador (h = 3000 W/m²K).
- Depósito: la capa nueva nace a 2100 °C (gota sobrecalentada); el resto del calor del arco entra como gaussiana de σ = 1 mm que avanza.
- Espera: implícita hasta que la cara de arriba (máximo de la capa recién puesta) baje de T_obj.
- Esquema explícito durante la pasada y backward Euler durante la espera.
- Telemetría por capa: temperatura entre capas, espera, largo del charco, profundidad de fusión y refusión (cuánto de la capa anterior se vuelve a fundir).

**Escoria (§J).** Masa de escoria = 10–17 % del alambre: el fundente es ~20.75 % del alambre (patente Lincoln US11648630), menos humo y chisporroteo dentro del 18–25 % que no llega al depósito. Densidad 3.0–4.2 g/cm³: valores de manual de BaF₂, CaF₂, Al₂O₃ y MgO, **de memoria**. Flotación por Stokes con µ = 6 mPa·s.

**Deformación (§K).** Fuerza de tendón F_T = 0.2·Q_neto (kN con Q en J/mm; las unidades son inferidas de la fuente) y flexión de la placa libre.

**Supuestos que no verifiqué y pesan:**
- η del arco en FCAW-S.
- Fracción y densidad de la escoria.
- Velocidad de Marangoni (0.1–0.5 m/s, de memoria).
- El modelo 2D trata la placa como «concentrada» a lo ancho, así que **subestima la fusión de la placa en las primeras 1–3 capas**.
- No se modela el soplo magnético (arc blow).

## 4. Resultados (telemetría)

### 4.1 El alambre y el impuesto del arco (§A, §B)

| I | wfs (fichas) | metal | kg/h | P arco | q_neto | **J a la pieza** | gotas r = 0.46/s | J por gota | t de formación |
|---|---|---|---|---|---|---|---|---|---|
| 40 A | 1.67 m/min | 9.38 mm³/s | 0.265 | 580 W | 464 W | **49.5 J/mm³** | 23.0 | 20.2 J | 43.5 ms |
| 50 A | 2.09 | 11.72 | 0.331 | 750 | 600 | **51.2** | 28.7 | 20.9 | 34.8 |
| 60 A | 2.50 | 14.06 | 0.397 | 930 | 744 | **52.9** | 34.5 | 21.6 | 29.0 |

- La gota de r = 0.46 mm pesa 3.20 mg y lleva 5.7–6.5 J (a 2100–2400 °C). El arco mete 20 J a la pieza por cada gota, **3.3 veces lo que trae la gota**.
- Las fichas dan J = 34–70 J/mm³ en todo el rango de 30 a 150 A.
- Como referencia, CMT con gas: 17.6 J/mm³ (§L).

**La ley del operador I ∝ √v_f, frente a los datos de arco:**

| par de fichas | n en I ∝ v_f^n |
|---|---|
| Lincoln 0.030" 30→60 A | 1.00 |
| Blue Demon 50→100 A | 0.67 |
| Blue Demon 100→150 A | 0.79 |
| Lincoln 0.9 30→90 A | 1.80 |

Joule puro daría n = 0.5. Con el stickout de catálogo (13 mm), a 40 A el Joule pone el 56 % de la acción de fusión (43–70 % según el área de la funda, 0.25–0.32 mm²). Fundir todo en tránsito pide stickout de **23 mm a 40 A**, 18.6 mm a 50 A y 15.5 mm a 60 A.

**Lo que dice esto del canon:**
- El campanazo supone 3 m/min con 40 A + 30 A AC (I_rms 45.3 A). Las fichas dan 1.89 m/min a esa corriente: **falta ×1.59**, o hacen falta ~33 mm de stickout.
- Con el metal real, 3 m/min son 16.9 mm³/s = **41 gotas/s**, no las 75 que reporta el TS.

### 4.2 Calor por mm de avance (J/mm)

| I | 2.8 mm/s | 5 | 10 | 16 | 32 | 40 |
|---|---|---|---|---|---|---|
| 40 A | 165.7 | 92.8 | 46.4 | 29.0 | 14.5 | 11.6 |
| 60 A | 265.7 | 148.8 | 74.4 | 46.5 | 23.2 | 18.6 |

### 4.3 Rosenthal en la placa de 3 mm (§C)

Charco en la superficie (ancho / largo, mm) y profundidad. La placa de 3 mm queda en régimen intermedio: τ de Adams entre 0.30 y 1.44.

| I | v mm/s | τ | placa 3 mm (imágenes) | prof. | grueso | t8/5 grueso / delgado |
|---|---|---|---|---|---|---|
| 40 A | 2.8 | 0.38 | 2.92 / 3.26 | 1.55 | 2.56 / 2.70 | 0.72 / 4.39 s |
| 40 A | 10 | 0.72 | 1.84 / 2.28 | 0.92 | 1.84 / 2.28 | 0.20 / 0.34 |
| 40 A | 40 | 1.44 | 1.08 / 1.94 | 0.54 | 1.08 / 1.94 | 0.05 / 0.02 |
| 60 A | 2.8 | 0.30 | 4.64 / 6.20 | **3.00 (atraviesa)** | 3.68 / 4.06 | 1.15 / 11.3 |
| 60 A | 10 | 0.57 | 2.52 / 3.52 | 1.28 | 2.52 / 3.42 | 0.32 / 0.88 |

Potencia máxima a la pieza para que el charco en la placa mida 1.2 mm (la mancha de una gota):

| v | q máximo |
|---|---|
| 4 mm/s | 193 W |
| 10 mm/s | 251 W |
| 20 mm/s | 344 W |
| 40 mm/s | 542 W |

A 40 A hay 464 W.

### 4.4 Rosenthal en la pared delgada (§D): largo del charco / profundidad de fusión (mm)

| w | q | 2.8 mm/s | 8 | 16 | 32 | 64 |
|---|---|---|---|---|---|---|
| 1.2 mm | 464 W | 53.5 / 8.5 | 18.7 / 3.0 | **9.3 / 1.5** | **4.7 / 0.7** | 2.3 / 0.4 |
| 1.2 mm | 744 W | >80 / 12.0 | 47.4 / 4.9 | 23.7 / 2.4 | 11.8 / 1.2 | 5.9 / 0.6 |
| 3.5 mm | 464 W | 6.4 / 2.2 | 2.2 / 0.8 | 1.1 / 0.4 | 0.5 / 0.2 | 0.3 / 0.1 |
| 3.5 mm | 744 W | 16.5 / 4.2 | 5.8 / 1.5 | 2.9 / 0.7 | 1.4 / 0.4 | 0.7 / 0.2 |

Potencia máxima para que el líquido sobre una pared de 1.2 mm no pase de π·w = 3.8 mm:

| v | q máximo |
|---|---|
| 4 mm/s | 147 W |
| 8 mm/s | 207 W |
| 16 mm/s | 294 W |
| 32 mm/s | 419 W |
| 64 mm/s | 595 W |

**A 40 A (464 W) hace falta barrer a ≳ 37 mm/s.**

### 4.5 La gota sola (§E)

Con el arco quieto mientras se forma la gota, el radio fundido al terminar es:

| I | placa | pared de 1.2 mm |
|---|---|---|
| 40 A | 0.63 mm | 0.63 mm |
| 50 A | 0.66 mm | 0.64 mm |
| 60 A | 0.67 mm | 0.64 mm |

En 30–45 ms el calor viaja √(αt) ≈ 0.5 mm, así que **una gota sola sí deja una mancha de ~1.3 mm**. Lo que rompe la resolución es la suma de gotas.

### 4.6 La placa de prueba sobre la loseta (§F)

| I | 200 °C | 400 °C | 600 °C | estacionario |
|---|---|---|---|---|
| 40 A (464 W) | 22 s | 53 s | 97 s | **852 °C** |
| 60 A (744 W) | 14 s | 32 s | 56 s | 1012 °C |

La placa sola tira 40 W a 250 °C y 87 W a 400 °C. Eso deja un ciclo de arco a 40 A de **8.7 % y 18.8 %**.

### 4.7 Pared 50×50 por diferencias finitas (§G): temperatura entre capas y espera

La espera es el tiempo hasta que la cara recién puesta baja de T_obj; «refunde» es cuánto de la capa anterior se vuelve a fundir. Modo gota = pared de 1.2 mm, capa de 0.5 mm, 15.6 mm/s. Modo charco = pared de 3.5 mm, capa de 1 mm, 2.7 mm/s. Ambos a 40 A (464 W).

| caso | montaje | T_obj | espera en capa 10 / 50 / 99 | T placa máx. | charco | refunde | **50 mm de alto** | arco | promedio |
|---|---|---|---|---|---|---|---|---|---|
| G1 gota | loseta | 400 | 5.5 / 17.5 / 19.5 s | 306 °C | 16 mm | 1.25 mm | **31.0 min** | 17 % | 1.61 mm³/s (46 g/h) |
| G2 gota | disipador | 400 | 2.5 / 13.5 / 17.5 s | 48 °C | 16 | 1.25 | **24.2 min** | 22 % | 2.07 (58 g/h) |
| G3 gota | disipador + aire (h 80) | 400 | 2.5 / 9.5 / 9.5 s | 50 °C | 14–15 | 1.25 | **17.7 min** | 30 % | 2.82 (80 g/h) |
| G4 gota | disipador + aire | **250** | 3.5 / 11.5 / 13.5 s | 47 °C | 13 | 1.00 | **23.1 min** | 23 % | 2.16 (61 g/h) |
| G5 gota | loseta, **sin espera** | — | 0 | 269 °C | 26 mm | 1.25–1.75 | **se ablanda en la capa 13** (6.5 mm, 0.7 min): la capa anterior queda en 1317 °C de promedio | 100 % | — |
| G6 gota h 0.25 a **31 mm/s** | disipador | 400 | 1.0 s (capa 10), 1.5 s (capa 19) | 48 °C | **7–8 mm** | 0.50 | 5 mm en 0.9 min (20 capas) | 62 % | 5.85 |
| C1 charco | loseta | 400 | 46.5 / 51.5 / 51.5 s (capas 10 / 30 / 49) | 381 °C | 9 mm | 1.50 | **53.7 min** | 29 % | 2.71 (77 g/h) |
| C2 charco | disipador | 400 | 7.5 / 23.5 / 36.5 s | 53 °C | 8–9 | 1.50 | **31.7 min** | 49 % | 4.60 (130 g/h) |
| C3 charco | disipador + aire | 400 | 7.5 / 17.5 / 21.5 s | 52 °C | 7–8 | 1.50 | **26.8 min** | 58 % | 5.44 (154 g/h) |
| C4 charco 60 A, w 4 mm | disipador + aire | 400 | 9.5 / 19.5 / 25.5 s | 69 °C | 12 | 2.00 | **25.2 min** | 47 % | 6.63 (187 g/h) |

Lo que dice la tabla:
- **La espera crece con la altura**, de ~0.5 s en las primeras capas a 10–50 s arriba. Una espera fija está mal al principio o al final.
- **En paredes altas el disipador ayuda poco**: en modo gota, de 31 a 24 min. La pared misma es la resistencia y su propio radiador, así que **soplar aire a las caras ayuda más** (de 24 a 17.7 min). En modo charco, el disipador sí pesa: de 53.7 a 31.7 min, porque la placa sobre la loseta se estaciona en ~380 °C y deja la cima sin margen.
- **El modo gota a 16 mm/s es una ilusión térmica.** El charco mide 13–16 mm de largo y 1.5 mm de hondo sobre una pared de 1.2 mm. La FD no deja que el líquido se escurra; en la realidad, esa pared se cae y se ensancha a ~3 mm. Ni a 31 mm/s (G6) el charco baja de 7–8 mm.
- Límite del modelo: la refusión mínima de 0 en las capas 1–2 es un artefacto, porque la placa 2D, «concentrada» a lo ancho, subestima su propia fusión.

### 4.8 Geometría y resolución (§H)

A 40 A (9.38 mm³/s), la sección por pasada es A = Qm/v:

| v | A | h si w = 1.2 | h si w = 3.5 | paso entre gotas |
|---|---|---|---|---|
| 2.8 mm/s | 3.35 mm² | 2.79 | 0.96 | 0.12 mm |
| 16 mm/s | 0.59 mm² | 0.49 | 0.17 | 0.70 mm (se enciman) |
| 32 mm/s | 0.29 mm² | 0.24 | 0.08 | **1.39 mm (gotas sueltas)** |

Referencia medida: CMT con 0.8 mm y gas a 50 A, 2.5 m/min y 6.7 mm/s da A = 3.14 mm² → pared de 3.1–3.8 mm y capa de 0.90–1.02 mm (Prado-Cerqueira 2018).

| modo | pared mínima | capa | ondulación por lado | limita |
|---|---|---|---|---|
| gota r = 0.46, potencia media sobre la pared ≲200–300 W (pulsos; **sin probar**) | **1.2–1.4 mm** | 0.25 mm | **±33–75 µm** | el charco acumulado (§D) |
| gota r = 0.46, arco continuo de 40 A (16–31 mm/s) | 2.5–4 mm (charco de 7–16 mm que se escurre) | 0.5–1.0 | ±65–300 µm | el calor, no la gota |
| cortocircuito / charco 40–60 A | 3–4.5 mm | 0.8–1.2 | ±0.10–0.36 mm | igual que CMT |
| globular CC 60 A (r = 1.63 mm) | ≥4–5 mm | 1.5–2.0 | ±0.2–0.6 mm | una gota = 18.1 mm³ = 44 gotas chicas |

Lo que el control sí alcanza:
- Altura, por el voltaje del arco (10 V/mm de ian, ruido 0.3 V): ±30 µm por lectura.
- Tamaño de gota con oído: ±1.5 µm.
- Apuntado: 80–90 µm (canon).

**Lo que no alcanza:** la deformación (§4.10) y la ondulación de capa.

### 4.9 Tiempos de construcción (§I)

Modelo concentrado por rebanadas; la cima se mantiene a T_obj.

| pieza | montaje | T_obj 250 °C | T_obj 400 °C (40 A) | 60 A, 400 °C |
|---|---|---|---|---|
| cubo 20 mm (8000 mm³, 62.8 g) | loseta | 174 min | **87 min** | 93 min |
| cubo 20 mm | disipador | 25 min | **17 min** | 16 min |
| engrane m1.5 z16 cara 6 (2545 mm³, 20 g) | loseta | 52 min | **25 min** | 26 min |
| engrane | disipador | 4.5 min | **4.5 min (lo limita el arco)** | 3.0 min |
| pared 50×50×1.2 (3000 mm³, 23.5 g), FD modo gota | loseta / disipador / disipador + aire | — / — / 23.1 min | **31.0 / 24.2 / 17.7 min** | — |
| pared 50×50×3.5 (8750 mm³, 68.7 g), FD modo charco | loseta / disipador / disipador + aire | — | **53.7 / 31.7 / 26.8 min** | 25.2 min (w = 4 mm, disipador + aire) |

Solo con el arco prendido: 0.27 kg/h (40 A), 0.33 kg/h (50 A) y 0.40 kg/h (60 A) = 34 / 42 / 51 cm³/h. Con las esperas, el promedio real queda en **1.6–6.6 mm³/s = 46–187 g/h**. Para las paredes, el modelo concentrado daba 79–164 min, porque supone que las caras irradian a la temperatura de la placa; la FD es la que vale.

### 4.10 Escoria, deformación y propiedades (§J, §K)

**Escoria por cada mm³ de metal:**

| escoria (% del alambre) | ρ escoria | V_esc / V_metal | por gota | película sobre la gota | costra por capa de 0.5 mm | por capa de 1 mm |
|---|---|---|---|---|---|---|
| 10 % | 4.2 | 0.23 | 0.095 mm³ | 36 µm | 117 µm | 234 µm |
| **14 %** | **3.6** | **0.38** | **0.156 mm³** | **59 µm** | **191 µm** | **382 µm** |
| 17 % | 3.0 | 0.56 | 0.227 mm³ | 85 µm | 278 µm | 556 µm |

**Flotación por Stokes** (Δρ = 4000 kg/m³). Distancia que sube la escoria antes de que el metal solidifique:

| partícula | v | gota sola (1.4 ms) | punto de gota (70 ms) | charco continuo (3.0 s = 8 mm / 2.7 mm/s) |
|---|---|---|---|---|
| 5 µm | 0.04 mm/s | 0 µm | 3 µm | 109 µm |
| 20 µm | 0.58 mm/s | 1 µm | 41 µm | 1.7 mm |
| 50 µm | 3.6 mm/s | 5 µm | 254 µm | 10.9 mm |

Lo que sale de aquí:
- En **modo charco** la escoria gruesa sí alcanza a flotar, siempre que la capa nueva refunde más que la costra. La FD da refusión de 1.5–2.0 mm contra una costra de 0.38 mm por capa. Pero flota hacia **arriba**, que es justo donde va la capa siguiente.
- En **modo gota** (punto de 70 ms), una partícula de 20 µm sube 41 µm y se queda atrapada.
- Las partículas de <5–10 µm se quedan siempre; es lo que ya pasa en toda soldadura FCAW-S (inclusiones de Al₂O₃, Welding Journal 2023).

Si la escoria flota y se junta arriba, hay que cepillar cada **N = refusión / (2 × costra) capas**:

| caso | N |
|---|---|
| modo charco (C1–C3) | 2.0 |
| charco a 60 A (C4) | 2.6 |
| modo gota a 16 mm/s (G1–G3) | 3.3 |
| gota a 31 mm/s (G6) | 2.6 |
| G4 | 2.6 |

**En la práctica: cepillar cada capa.**

**Deformación** (fuerza de tendón, placa de 50×3 libre, una pasada):

| caso | F_T | flecha en 100 mm |
|---|---|---|
| 40 A a 2.8 mm/s | 33 kN | **2.8 mm** |
| 40 A a 16 mm/s | 5.8 kN | **0.5 mm** |
| 60 A a 16 mm/s | 9.3 kN | 0.8 mm |

Tope físico: 35 kN (σ_y × sección). El esfuerzo residual longitudinal en la pared llega a ~σ_y del depósito, ~450 MPa (es lo usual en WAAM; de memoria y de la literatura de Cranfield).

## 5. Veredictos

**H1 · «Con la gota de 0.46 mm del campanazo se imprime con resolución de gota.»**
- **Gota sola: PASA.** La mancha mide 1.3 mm (§4.5).
- **Pared de gotas con arco continuo de 40 A: FALSA.** El charco sobre una pared de 1.2 mm mide 13–16 mm a 16 mm/s y 7–8 mm a 31 mm/s (FD G1–G6; Rosenthal da 9.3 y 4.7 mm sin acumulación). Esa pared se escurre y converge a ~3 mm, como CMT.
- **Resolución de gota (pared de 1.2–1.4 mm, ±35–75 µm): INCIERTO.** Requiere bajar la potencia media sobre la pared a ≲200–300 W (Rosenthal: 207 W a 8 mm/s, 294 W a 16, 419 W a 32), por ejemplo con un arco base bajo y pulsos de gota. Eso no está probado con FCAW-S: las fichas no bajan de 30 A.
- **Lo decide:** dos paredes de 10 capas, a 16 y a 32 mm/s, con 40 A continuos. Predicción del modelo: ancho medido con calibrador de ~3 mm en las dos, no 1.2 mm.

**H2 · «La pieza limita la velocidad» (lente del operador).**
- **PASA, y más fuerte de lo que dijo la revisión del 31-oct.** El calor por mm³ es 49.5 J (arco), no 10.3 J (entalpía).
- Los techos de la revisión (cubo 19.8 mm³/s, pared delgada en aire 0.93 mm³/s) bajan a ~4 y ~0.19 mm³/s.
- Con la loseta, el ciclo de arco tope es 8.7 % (250 °C) a 18.8 % (400 °C).
- **Lo decide:** termopar en la placa durante 60 s de arco a 40 A. Predicción: 400 °C a los ~53 s.

**H3 · «I ∝ √v_f».**
- **FALSA en el régimen de arco con stickout de catálogo:** las fichas dan n = 0.67–1.8.
- **INCIERTO como límite de stickout largo:** a 40 A el Joule pone el 56 % con 13 mm y el 100 % con ~23 mm.
- Aquí la lente sí señala la palanca: lo que funde el Joule entra al alambre y a la gota, no a la pieza como calor de ánodo. Más stickout = J más bajo = pieza más rápida.
- **Lo decide:** la quemada contra el stickout a 40 A fijos (13, 20 y 25 mm), con el CV del firmware. Predicción si es cierta: la quemada sube de ~1.7 a ≥2.5 m/min y J baja de ~50 a ≤35 J/mm³. Si no sube más de un 15 %, es falsa.
- Ojo: un CTWD más largo hace el arco más corto y deja más Al en el metal, lo que baja la tenacidad (Welding Journal 2023).

**H4 · «El canon: 3 m/min con 40 A + 30 A AC, 75 gotas/s».**
- **FALSA con stickout normal:** las fichas dan 1.89 m/min a 45.3 A rms, y el metal real es 0.337 mm³/mm, lo que da 41 gotas/s.
- **INCIERTO con stickout de ~33 mm.**
- **Cambio para `arcoFisica.ts`:** RW efectivo = √(0.337/π) = 0.33 mm para el caudal, y v_f(I) de las fichas.

**H5 · LA ESCORIA**
- **(a) «Imprimir capa sobre capa sin quitar la escoria» → FALSA (bloqueo).** Cada capa de 0.5 mm deja ~190 µm de costra (117–278).
  - La escoria flota solo si la capa siguiente refunde más que la costra y el charco vive lo suficiente.
    - En modo charco, la FD da refusión de 1.5–2.0 mm y un charco que vive 3 s, así que la escoria gruesa sube, pero **se junta encima** y a las 2–3 capas ya rebasa la mitad de lo que se refunde.
    - En modo gota no alcanza a subir (41 µm en 70 ms).
  - La literatura de FCAW-DED identifica las inclusiones de escoria como **el** defecto que manda (Kim et al. 2024: tuvieron que meter martilleo ultrasónico entre capas para romperla).
  - La práctica de soldadura multipaso con autoprotegidos es limpiar en cada pasada.
- **(b) «Con un cepillo automático cada capa» → INCIERTO.** Tiende a PASA en modo charco (paredes de 3–4 mm), porque eso es exactamente la soldadura multipaso. En modo gota tiende a FALSA, porque la escoria vive en cada interfaz gota-gota y el cepillo no entra ahí.
  - El cepillo cabe en la espera térmica: la espera mediana es de 10–20 s en modo gota y 16–52 s en modo charco, contra 2 s por pasada de cepillo. Solo en las primeras capas sobre disipador (espera de 0.5–2.5 s) agrega tiempo.
- **(c) «Hay alambres autoprotegidos con escoria mínima» → FALSA.** En los FCAW-S, el Al y el Mg limpian el O y el N **formando escoria** (Welding Journal 2023), y las fichas de los E71T-GS presumen «full slag coverage».
  - Los de menos escoria son los E71T-11 / GS de «fácil remoción», pero siguen dejando ~0.2–0.5 mm³ de escoria por mm³ de metal.
  - Los metal-cored (E70C-…) casi no dejan escoria, pero **necesitan gas** (hasta el E70C-GS es «gas shielded», según Airgas).
  - **Sin gas + sin escoria + acero = límite duro** del material, salvo que la atmósfera la ponga otra cosa (cámara o vacío: preguntas de otros agentes).

**H6 · «E71T-GS en multipaso da propiedades de diseño».**
- **INCIERTO, inclinado a FALSA.**
- AWS A5.20 clasifica los «-GS» como **de una sola pasada**. Solo exige tensión transversal y doblez guiado longitudinal, y no especifica composición, fluencia, elongación ni Charpy del metal de aporte.
- Una pieza impresa es 100 % metal de aporte, con dilución cero desde la capa 2–3.
- El Al que sobra se queda y da «menor tenacidad y mayor sensibilidad a grietas» (Welding Journal 2023).
- El pariente multipaso E71T-11 (NR-211-MP) da en el metal de aporte: Al 1.3–1.5 %, YS 450 MPa, UTS 580–610 MPa, elongación 22–23 %, Charpy no requerido. Y aun así Lincoln lo limita a **8 mm (5/16") de espesor** en diámetros ≤0.045".
- Esperable de una pieza de E71T-GS: UTS de ~500–650 MPa (la dureza manda), elongación entre 5 y 22 % según la escoria, Charpy bajo y disperso, y Z más débil que X si quedan líneas de escoria.
- **Lo decide:** doblez y dureza (§7).

**H7 · «La deformación no importa en piezas chicas».**
- **FALSA.** Una sola pasada a 40 A y 2.8 mm/s dobla 2.8 mm la placa libre de 3 mm en 100 mm.
- Sujetar la placa a un disipador es obligatorio. Martina et al. reportan que laminar entre pasadas reduce la distorsión más de la mitad (en Ti, Cranfield).

**H8 · «La temperatura entre capas se controla con una espera fija».**
- **FALSA.** La espera necesaria crece con la altura:
  - modo gota sobre disipador: 0.5 s (capas 1–5) → 13.5 s (capa 50) → 17.5 s (capa 99);
  - modo charco: 0.5 s → 36.5 s.
- **Sin espera (G5), la pared se ablanda en la capa 13**, a los 6.5 mm y 0.7 min: la capa anterior sigue en 1317 °C de promedio.
- El firmware necesita la ley de espera contra la altura (tabla de §4.7) o un sensor.
- **Lo decide:** un termopar K metido en un barreno de 1 mm a 5 mm bajo la cima de una pared de 30 capas en modo charco con disipador. Predicción: cada vez que pasa la cabeza, pico de >1000 °C, y espera a 400 °C de ~8 s en la capa 10 y ~20 s en la capa 30.

**La lente del operador (postulado de canal), en una línea por canal.** La corriente I es **un solo actuador que alimenta tres canales**:
- masa: fundir el alambre, ∝ I;
- calor a la pieza: la caída de ánodo, ∝ ⟨I⟩;
- fuerza: el pellizco que suelta la gota, ∝ I².

Por eso no se puede bajar el calor a la pieza sin bajar la masa: J ≈ 50 J/mm³ es la firma de esa mezcla. Los canales que sí son selectivos:
1. **El Joule del stickout**, ∝ I²·L/v_f: calienta el alambre y no la pieza (H3).
2. **La espera y el aire**: sacan calor de la pieza sin tocar la masa (§4.7).
3. **El disipador**: conductancia (§4.9).

**ESPECULATIVO, con números:** la onda AC del campanazo (30 A sobre 40 A de base) sube I_rms² un 28 % (de 1600 a 2050 A²), que va al alambre por Joule, y deja ⟨I⟩ igual, de modo que el calor de ánodo a la pieza no sube. Si eso es cierto, el campanazo **baja** J además de soltar la gota. Se decide midiendo la quemada con y sin la onda AC, a 40 A de base y stickout fijo.

## 6. Qué cambia en el banco, el circuito, el firmware y la lista de componentes

1. **Quita la loseta como base de impresión.** Úsala solo de aislante bajo el bloque. **Agrega un disipador:** la placa de 3 mm sujeta con 4 clips a un bloque de acero o aluminio de ≥20 mm, mejor con pasta térmica, o una placa de cobre o aluminio con agua (una bomba de pecera y una cubeta).
   - Efecto (§4.9): el cubo de 20 mm baja de 87 a 17 min, el engrane de 25 a 4.5 min y la pared de 3.5 mm de 54 a 32 min.
   - Además resuelve la deformación (§4.10).
   - Ojo con la masa: un bloque de 5 kg de acero sube ~0.13 K/s con 300 W, así que para piezas de horas hace falta agua.
2. **Agrega un cepillo rotativo** (motor de 12 V con cepillo de alambre de copa, como de Dremel) montado en la cabeza, con una pasada por capa durante la espera, y **soplido de aire** (un ventilador de 12 V con boquilla, h ≈ 80 W/m²K en las caras). El mismo aire baja el tiempo de la pared delgada de 24 a 18 min.
   - En el cuaderno, medir la costra por capa con báscula de 0.01 g. Predicción: ~0.24 g por capa de 50×3.5×1 mm (0.17–0.31 g).
3. **Firmware, espera por capa:**
   - La cabeza no empieza la capa n+1 hasta que la cara de arriba esté en T_obj (400 °C geometría, 250 °C metalurgia).
   - Sensor: un termopar K con MAX31855 en la placa, más la ley de espera contra la altura de la tabla de §4.7 como prealimentación.
   - Opción sin sensor nuevo: la propia ley de espera de la FD.
   - Las ráfagas de arco son de capa completa, no de gota (cada reencendido gasta un stickout, según la revisión del 31-oct).
4. **Firmware, stickout:** probar 20–25 mm con CV. Si la quemada sube (H3), J baja y todo lo demás mejora.
5. **Firmware, modo volumen** (el que sí funciona hoy): charco a 2.7–5 mm/s, paredes de 3.5–4 mm, capas de 1 mm.
   **Modo precisión** (experimental): barrido a ≥32 mm/s, capas de 0.25 mm, una gota cada ~1.4 mm, **y además** potencia media sobre la pared ≲200–300 W (pulsos con arco base bajo). Solo vale si un autoprotegido aguanta un arco base de <30 A, cosa que hay que medir.
6. **Lista de compras:** un carrete de 0.030" E71T-11 (NR-211-MP o Hobart 21B), para comparar contra el E71T-GS en el mismo banco. Es el único autoprotegido de 0.8 mm aprobado para multipaso.
7. **Canon (`arcoFisica.ts`):** el caudal de metal pasa a 0.337 mm³/mm (no 0.503) y v_f(I) sale de las fichas (0.0417 m/min por A con stickout de 13 mm). Esto queda como recomendación: no se tocó ningún archivo.

## 7. El experimento más barato que lo decide (la escoria)

**«Dos paredes gemelas».** En la placa de 3 mm **sujeta** a un bloque, imprimir dos paredes de 50 mm × 15 capas con el mismo programa: 40 A, modo charco, 2.7 mm/s, espera hasta ≤400 °C. Calibrar el termopar contra la placa.
- **Pared A:** cepillo de alambre a mano en cada capa, durante la espera.
- **Pared B:** sin tocarla.

Medir:
1. La masa de escoria que se quita por capa en A (báscula de 0.01 g).
2. El ancho y el alto con calibrador.
3. Cortar en transversal con disco, lijar a grano 600 y atacar con vinagre o nital: contar las líneas de escoria entre capas.
4. Doblar en tornillo de banco una rebanada de 3 mm cortada a través de las capas, alrededor de un redondo de 10 mm.

Predicción si **la escoria es el bloqueo** (lo que espera este reporte):
- En A, 0.17–0.31 g de escoria por capa.
- En B, una línea de escoria vidriosa cada 1–2 capas.
- B se abre entre capas antes de 30° de doblez, con superficie de fractura brillante y vidriosa.
- A dobla ≥90° sin abrirse.

Predicción si **es falso**:
- B no muestra líneas (la escoria flota sola y se escurre por los lados).
- Ambas doblan ≥90°.

En ese caso se elimina el cepillo de la lista.

Costo: cero piezas nuevas. Lo que sale de aquí calibra V_esc/V_metal (0.23–0.56) y la regla de cada cuántas capas hay que cepillar.

## 8. Fuentes

**Norma y clasificación**
- AWS A5.20/A5.20M:2025, vista previa. El índice separa la «Fig. 3, Test Assembly for Transverse Tension and Longitudinal Guided Bend Tests for Welds Made with Single-Pass Electrodes» del ensamble de propiedades del metal de aporte de multipaso: https://pubs.aws.org/Download_PDFS/A5.20-A5.20M-2025-Final-WebPV.pdf
- E71T-GS: S = una sola pasada; YS, elongación y CVN no especificados en A5.20: https://materialwelding.com/e71t-gs-welding-wire/
- Foro AWS sobre EXXT-G (multipaso) frente a EXXT-GS (una pasada): https://app.aws.org/forum/topic_show.pl?tid=5226

**El alambre y los equivalentes**
- Truper MICRO-5 13751 (misma familia que el MICRO-1 13750): E71T-GS, 0.030" (0.8 mm), fabricado en China: https://www.truper.com/ficha_merca/ficha-print.php?code=13751
- Lincoln NR-211-MP, ficha EU 2024: E71T-11, Al 1.3 %, YS 450 / UTS 610 / El 22 %, «5/16" maximum plate thickness for 0.045" and smaller»: https://josefgases.com/product_ref//spec-sheets/ED016354.pdf
- Lincoln NR-211-MP, ficha EU anterior (datos de 0.9 mm: wfs, A, V, kg/h, 1.22 kg de alambre por kg de metal, Al 1.5 %): https://gasiq.rapidwelding.com/files/ED016354.pdf
- Lincoln NR-211-MP 0.030": 1.3 m/min ↔ 30 A, 81 %; 2.5 m/min ↔ 60 A, 75 %. **Leído del extracto del buscador; la página dio 429**: https://weldingmart.com/products/lincoln-ed016354-innershield-nr-211-mp-flux-cored-fcaw-s-welding-wire-0-035-in-10-lb-spool
- Blue Demon E71T-GS 0.030": 50 A, 15 V, 80 ipm; 100 A, 16 V, 225 ipm; 150 A, 17 V, 375 ipm. **Extracto del buscador; la página dio 429**: https://canadaweldingsupply.ca/products/blue-demon-e71tgs-mild-steel-flux-cored-welding-wire
- McMaster, E71T-11 0.030" ≈ 450 ft/lb (extracto del buscador): https://www.mcmaster.com/electrodes/aws-material-code~e71t-11/
- Lincoln NR-152: solo una pasada, 0.8–4.8 mm (extracto del buscador): https://prodcd.lincolnelectric.com/en/Products/innershieldnr152_fcaws
- Fichas de E71T-GS con «full slag coverage»; Airgas lista el E70C-GS como «gas shielded» (extractos del buscador):
  - https://aabaco.com/collections/all/products/best-welds-e71t-gs-flux-cored-welding-wire-0-030-in-dia-2-lb-spool
  - https://stg2.airgas.com/product/Welding-Products/Filler-Metal/Tubular-Wires-%28FCAW%29/Tubular-Wires---Carbon-Steel-Self-Shielded/p/RAD64001400

**Escoria y metalurgia**
- Patente US11648630 (Lincoln, FCAW-S): llenado de 20.75 %; BaLiF₃ 9–10 %, óxidos 4.5 %, Al 2 %, Mg 1.8 % del alambre; el Al de más engrosa el grano y baja el CVN: https://patents.google.com/patent/US11648630
- R. Panday, «Renewed Opportunities for Girth Welding in High-Strength Pipelines», Welding Journal, marzo 2023 (Lincoln). El Al y el Mg limpian el O y el N «through slag formation»; «excess Al will remain in the weld… lower toughness and an increase in crack sensitivity»; evitar la ferrita δ; inclusiones de Al₂O₃: https://ch-delivery.lincolnelectric.com/api/public/content/b545ddf288d749728c84edaf7b899fba
- Kim et al., «Slag inclusion-free flux cored wire arc directed energy deposition process», Materials & Design 238 (2024) 112669, DOI 10.1016/j.matdes.2024.112669. Solo el resumen; los números del texto completo no se leyeron: https://doaj.org/article/d8738cacc1b148a390c027008435097c
- McNeil, Harwig et al., AWS 2024: WA-DED sin gas con consumibles autoprotegidos y limpieza entre pasadas con husillo (solo el resumen): https://programmaster.org/PM/PM.nsf/ApprovedAbstracts/F239D1A8A4F171C385258B490042ED5C
- WAAM con alambre tubular (maraging, con argón): «individual layers are covered with a thin layer of slag, no internal defects»: https://pmc.ncbi.nlm.nih.gov/articles/PMC8588459/
- DED con alambre tubular de recargue y esmeril para quitar escoria (extracto): https://link.springer.com/article/10.1007/s00170-021-08144-6

**Calor, geometría y comparación**
- Prado-Cerqueira et al. 2018, Materials 11:1449. CMT/MIG con ER70S-6 de 0.8 mm, 50–78 A, 2.5 m/min, 400 mm/min: pared de 3.1–6.6 mm, capa de 0.8–1.44 mm, η 0.8 / 0.52: https://pmc.ncbi.nlm.nih.gov/articles/PMC6119905/
- Tabernero et al. 2018, Procedia CIRP 68:358: CMT hasta 5 kg/h en inoxidable, 2.5 kg/h en Ti64; WAAM 5–6 kg/h: https://dsp.tecnalia.com/bitstream/11556/537/1/1-s2.0-S2212827117310363-main.pdf
- Anzalone, Zhang, Wijnen, Sanders, Pearce, «A Low-Cost Open-Source Metal 3-D Printer», IEEE Access 1:803 (2013), DOI 10.1109/ACCESS.2013.2293018:
  - https://digitalcommons.mtu.edu/materials_fp/120
  - https://www.eurekalert.org/news-releases/625443
- Nilsiam, Sanders, Pearce, Additive Manufacturing 18:110 (2017), «resolution of 1 mm bead widths»: https://reprap.org/wiki/Slicer_and_process_improvements_for_open-source_GMAW-based_metal_3-D_printing
- MOST v2 (Pearce): ER70S-6 0.030", C25, wfs ~25 mm/s, 7 mm/s, capa de 2 mm, ≥60 s de pausa por capa: https://www.appropedia.org/MOST_open-source_metal_3-D_printer_v2
- Oliveira, Gouveia, Santos, «Micro wire and arc additive manufacturing (µ-WAAM)», Additive Manufacturing Letters 2 (2022) 100032: alambre de 0.25 mm, 16 A, ~35 W: https://novaresearch.unl.pt/en/publications/micro-wire-and-arc-additive-manufacturing-%C2%B5-waam/
- Williams et al. 2016, «Wire + Arc Additive Manufacturing», Materials Science and Technology 32:641 (esfuerzos residuales y porosidad; solo el resumen): https://dspace.lib.cranfield.ac.uk/items/71fd5bd0-ee83-43f0-910d-f8ebd6d6e7fa/full
- Ondulación de CMT en acero de hasta 0.5 mm; envolvente de 0.5 mm (extracto): https://www.sfu.ca/~gwa5/pdf/2023_02.pdf
- Humping en CMT de acero dulce desde ~0.6 m/min (extracto; la página dio 403): https://www.epj-conferences.org/articles/epjconf/pdf/2010/05/epjconf_ICEM14_07002.pdf
- Esperas entre capas en WAAM: con esperas cortas se acumula calor y se escurre el cordón (extracto): https://mediatum.ub.tum.de/doc/1763899/1763899.pdf
- Temperatura de gota en GMAW, 2350–2700 (la fuente dice °C, quizá K; extracto): https://springerlink.bibliotecabuap.elogim.com/doi/10.1007/s40194-014-0193-0
- DuPont y Marder 1995, Welding Journal 74(12):406s: eficiencia de arco de 0.84 con electrodo consumible (resumen vía buscador): https://acnpsearch.tweb-dev.unibo.it/singlejournalindex/13001185
- Fuerza de tendón F_T = 0.2·Q_neto (JWRI 36(1); las unidades son inferidas): https://ir.library.osaka-u.ac.jp/repo/ouka/all/6722/jwri36_01_065.pdf

**Internas**
- `scripts/operador-revision-impresora-2026-10-31.out` (K = 1.483e16 A²s/m⁴, 10.3 J/mm³, techos de la pieza)
- `scripts/canon/canon_gota.out`
- `src/forja/brep/arcoFisica.ts` (vf 3 m/min, RW 0.4 mm)

**De memoria, sin verificar:**
- densidades de BaF₂ 4.89, CaF₂ 3.18, LiF 2.64, Al₂O₃ 3.95 y MgO 3.58 g/cm³;
- velocidades de Marangoni de 0.1–0.5 m/s;
- criterio de Adams;
- esfuerzo residual ≈ σ_y en WAAM;
- que una película líquida con bordes anclados y ángulo <90° es estable (Davis 1980), por eso π·w se usa solo como criterio práctico.
