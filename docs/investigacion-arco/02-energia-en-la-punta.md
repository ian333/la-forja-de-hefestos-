# 02 · Energía en la punta: ¿qué concentra de verdad la energía en la punta del alambre?

> ian, 2026-11-05: «crear resonancia de campos para concentrar el punto de energía en la punta».
> Script: `scripts/investigacion-arco/02_energia_en_la_punta.py` → `02_energia_en_la_punta.out`. Todos los números de este reporte salen de ahí, salvo los citados de fuentes. ngspice con los mismos modelos que `scripts/la-pluma/`.

## 1. La pregunta

¿Qué mecanismos físicos reales meten más energía en la punta del alambre (la gota) y menos en la columna y la pieza? El hardware es el buck de 48 V con 41 µH a 20–100 kHz, la LRS-1200-48 y el E71T-GS de 0.8 mm tubular.

## 2. La respuesta corta

- **La punta es un canal LINEAL.** El calor que entra por la caída del electrodo vale `V_e·⟨I⟩`. Calibrado con la tabla Lincoln en DC−, `V_e` queda entre 3 y 5 V (usamos 4.1 V). Este canal solo oye la corriente MEDIA. Cualquier onda de media cero le es invisible: rizo, HF o «resonancia». Los canales cuadráticos (Joule del stickout, pellizco) sí oyen la onda, pero solo por su potencia `⟨I_ac²⟩`. Con nuestro buck eso es +1.0 % a 20 kHz (14 A pp) y +0.04 % a 100 kHz (2.9 A pp). En la simulación del quemado libre, 20 kHz contra 100 kHz cambia la fusión en **+0.01 %**.
- **HF tipo UHFP: con nuestro buck no se puede, y además apunta al lado equivocado.**
  - La literatura (Li 2020) usa una onda cuadrada de 40/80 A a 20–40 kHz con flancos de 50 A/µs. Mide +30 a +81 % de fuerza de arco y +31 a +43 % de presión. Es 3–7 veces más de lo que explica `⟨I²⟩` (+11 %). El mecanismo no está cerrado.
  - Nuestro buck sube a 0.6–0.8 A/µs, **71 veces más lento**. Su mayor triángulo es de 14.5 A pp a 20 kHz.
  - Ese efecto concentra el arco sobre la **pieza**: la penetración pasa de 1.87 a 2.40 mm y el área fundida crece 31–61 %. Es lo contrario de lo que pide una impresora, donde la pieza limita la velocidad.
- **El efecto piel no sirve con 40 A de DC.**
  - El acero está casi saturado: H = 15.9 kA/m en la superficie, µ incremental ≈ 9. A 20 kHz, `R_ac/R_dc` = 1.00, y el rizo pone 0.21 W de los 19.3 W del stickout.
  - Arriba de Curie (770 °C) el alambre de 0.8 mm no tiene piel por debajo de unos MHz.
  - El precalentador real es la DC más el stickout (ley de Lagrange): 22.8 mm de stickout llevan la punta a 700 °C a 40 A. Hoy, con 15 mm, llega a 359 °C.
- **Ni el campo axial ni el pellizco concentran a 40 A.**
  - El campo axial rota el arco y lo ensancha. En el modelo de TIG el arco queda hueco, con presión central negativa.
  - El pellizco propio a 40 A es 4 % de la tensión superficial, y la presión de Maecker es de ~51 Pa a R = 1 mm.
- **Tanque LC y descarga de capacitor: no.**
  - El tanque a f₂ queda con Q = 1.7–3.4, contra Q ≈ 30 de la gota. Además, f₂ baja 19 % mientras la gota crece.
  - El buck ya da pulsos de 70–100 A sin pasarse de la LRS: ≤1196 W de promedio a 75 pulsos/s.
  - La descarga de capacitor da 226–496 A en 14–39 µs: es un golpe de banda ancha que excita todos los modos.
- **Las perillas reales de energía a la gota a 40 A:**
  1. **Largo de arco.** Cada mm se lleva 400 W a la columna. Bajar de 1 a 0.5 mm sube la fracción a la gota de 18.7 a 23.5 %.
  2. **Polaridad DCEN.** Funde +29–50 % más (dato de fuente; verificar que la pluma sea negativa).
  3. **Stickout.** Pasar de 10 a 20 mm da +11 % de depósito.

  Hallazgo lateral: el canon supone 3 m/min con 40 A de base, pero 40 A medios funden **~1.8 m/min** (ver §4.10).

## 3. El método

- **Buck.**
  - Rizo: `ΔI = (V_bus − V_o)·D/(L·f)`.
  - Pendientes: `(48 − V_arco)/L` subiendo y `(V_arco + V_D)/L` bajando.
  - ngspice: lazo abierto con el duty ajustado a 40 A medios, mismos modelos IRFB4227, MBR40100CT e IR2110 (Rg 17/38 Ω) que La Pluma. Carga: arco de 18 V + 20 mΩ, más 25 mΩ de stickout. Se miden 3 ms y se promedia el último 0.5 ms.
- **Efecto piel.**
  - Impedancia interna exacta con funciones de Bessel, para el alambre sólido y para el tubo con núcleo no conductor. La forma es `Z = kρ/(2πb)·[J0(kb)Y1(ka) − Y0(kb)J1(ka)]/[J1(kb)Y1(ka) − Y1(kb)J1(ka)]`, con `k = (1−j)/δ`.
  - Chequeo en DC: 0.46 mΩ/mm, igual a ρ/A.
  - La permeabilidad incremental sale de un ajuste B-H de acero 1010 (foro de COMSOL sobre datos de Fermilab; **no verificado**). Por eso se barre µ de 1 a 300.
- **Alambre en tránsito.** Se integra en la coordenada del alambre, igual que en la revisión del 31 de octubre: el acero conduce, el fundente solo absorbe calor, y hay radiación con ε = 0.5. El balance en la punta es `I·V_e = v_f·[A_s ρ (h_gota − h(T_punta)) + A_f ρ_f (h_f − c_f ΔT)]`.
  - **Calibración de V_e:** con la tabla «calculation data» de Lincoln Innershield NR-211-MP (autoprotegido, DC−, 0.9 mm, stick-out eléctrico de 10 mm).
- **Tablas de acero:** las mismas del canon (±15 %).
- **SUPUESTOS**
  - Pared del tubo de 0.15 mm: acero 0.306 mm², fundente 0.196 mm², llenado en masa 19.7 %. Da 2.99 g/m contra 3.95 g/m del macizo; no hay dato del fabricante.
  - Fundente: ρ = 3000 kg/m³, c_f = 1000 J/(kg·K), 1.88 MJ/kg para volverlo escoria.
  - Gota a 2400 °C (Watkins: 2400–3100 K).
  - Misma fracción de acero en el 0.9 mm de Lincoln.
  - `V_e(DCEP) = V_e(DCEN)/1.29…1.5`, según las fuentes de polaridad.
- **Literatura.**
  - Li 2020: texto completo leído.
  - Zheng 2021, Yang 2015, Cook y Eassa 1985, Crystals 2022 y los campos axiales: solo resumen.
  - Hoja de la LRS-1200 y tabla de Lincoln: leídas.

## 4. Resultados con telemetría

### 4.1 La HF en el arco: lo que da nuestro buck contra lo que usa la literatura

Rizo del buck a 40 A medios (analítico). La resistencia de lazo es choque + cable + stickout + arco = 71 mΩ:

| V_arco | D | ΔI_pp a 20 kHz | 40 kHz | 50 kHz | 100 kHz | ⟨I²⟩/⟨I⟩²−1 a 20k | a 100k |
|---|---|---|---|---|---|---|---|
| 14 V | 0.351 | 13.33 A | 6.67 | 5.33 | 2.67 | 0.93 % | 0.037 % |
| 16 V | 0.393 | 13.96 | 6.98 | 5.58 | 2.79 | 1.01 % | 0.041 % |
| 19 V | 0.455 | 14.52 | 7.26 | 5.81 | 2.90 | 1.10 % | 0.044 % |
| 24 V | 0.559 | 14.43 | 7.21 | 5.77 | 2.89 | 1.08 % | 0.043 % |

El máximo posible (D = 0.5) es 14.6 A pp a 20 kHz, 5.9 a 50 kHz y 2.9 a 100 kHz. La subida va de 0.59 a 0.78 A/µs y la bajada (por D1) de 0.40 a 0.60 A/µs. Un escalón de 40 a 80 A tarda 51–68 µs.

| | Li et al. 2020 (UHFP-GTAW) | Nuestro buck a 20 kHz |
|---|---|---|
| forma | cuadrada 40/80 A, 50 %, I_m 60 A | triángulo ±7 A sobre 40 A |
| flanco | **50 A/µs** (dos inversores + conmutador) | **0.71 A/µs** (71× más lento); para 50 A/µs haría falta L = 0.58 µH |
| ⟨I²⟩/I_m² − 1 | +11.1 % | +1.05 % |
| fuerza de arco medida | +30 % (20 kHz), **+80.6 %** (40 kHz) | — |
| presión (calculada por los autores) | 193.4 → 253.1 → 277.2 Pa | — |
| núcleo / área del arco | 38.9 → 39.8 → 40.6 %; D_I 4.24 → 4.69 → 4.76 mm (el núcleo CRECE) | — |
| pieza (80 A medios) | penetración 1.87 → 2.13 → 2.40 mm; área fundida 6.01 → 7.89 → 9.68 mm² | — |

Otras fuentes de HF:
- UFP-GMAW (Zheng 2021, «una gota por pulso»): la velocidad de desprendimiento sube hasta +13 % y la fuerza motriz hasta +19.9 %, **sin cambiar el tamaño de gota**.
- Cook y Eassa (1985, teoría): con pulsos de más de 5 kHz, la presión puede llegar a 10 veces la de un arco DC de igual potencia, y la ventaja cae con el factor de forma.

Escala del pellizco (A4):

| I | µ0I²/4π | % de 2πr_wσ = 3.77 mN | p de Maecker con R = 0.5 / 1 / 1.5 mm |
|---|---|---|---|
| 40 A | 0.160 mN | 4.2 % | 204 / 51 / 23 Pa |
| 60 A | 0.360 mN | 9.5 % | 458 / 115 / 51 Pa |
| 80 A | 0.640 mN | 17.0 % | 815 / 204 / 91 Pa |
| 194 A | 3.764 mN | 99.8 % | 4792 / 1198 / 532 Pa |

### 4.2 ngspice: el buck con el arco a 20, 50 y 100 kHz (pérdidas reales del modelo)

| f | D | I_media | I_max / I_min | rizo pp | P_Q1 | P_D1 | P_choque | P_snubber | P_arco | P_entrada | eficiencia | Vds máx |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 kHz | 0.4554 | 39.71 A | 46.73 / 32.65 | **14.07 A** | 24.0 W | 16.0 W | 35.1 W | 0.32 W | 786.8 W | 884.0 W | 0.890 | 79.9 V |
| 50 kHz | 0.4471 | 39.61 | 42.39 / 36.75 | 5.64 | 27.9 | 15.8 | 34.6 | 0.82 | 784.0 | 886.7 | 0.884 | 79.8 |
| 100 kHz | 0.4322 | 39.75 | 41.18 / 38.26 | **2.92** | 34.9 | 15.7 | 34.8 | 1.65 | 786.6 | 897.3 | 0.877 | 79.5 |

Pasar de 20 a 100 kHz cuesta **+12.2 W** en Q1 más snubber. El rizo de ngspice coincide con la fórmula: 14.07 contra 14.5 A pp.

### 4.3 El efecto piel en el alambre

Permeabilidad incremental, la que ve el rizo montado en la DC (ajuste 1010, no verificado):

| H | B | µ amplitud | µ incremental |
|---|---|---|---|
| 1 kA/m | 1.36 T | 1086 | 172 |
| 5 kA/m | 1.67 T | 265 | 28 |
| **15.9 kA/m (40 A)** | **1.87 T** | 93 | **8.7** |
| 25 kA/m | 1.95 T | 62 | 5.5 |

En la superficie del alambre: con 10 A de DC, µ_inc ≈ 35.5; con 20 A, 17.4; con 40 A, 8.7; con 70 A (H = 27.9 kA/m), 5.0.

Si la costura del tubo tiene un entrehierro de 10 µm (SUPUESTO), µ = 100 baja a 67 efectiva y µ = 1000 baja a 172. Otra razón para que µ sea baja.

Profundidad de piel y R_ac/R_dc. En el tubo, la pared de 0.15 mm es la que importa:

| estado | µ_r | f | δ | R_ac/R_dc sólido | R_ac/R_dc tubo |
|---|---|---|---|---|---|
| frío 20 °C | 7 (con 40 A de DC) | 20 kHz | 0.507 mm | 1.01 | **1.00** |
| frío 20 °C | 7 | 100 kHz | 0.227 mm | 1.17 | 1.01 |
| frío 20 °C | 100 (sin DC) | 20 kHz | 0.134 mm | 1.76 | 1.10 |
| frío 20 °C | 100 | 100 kHz | 0.060 mm | 3.60 | 2.17 |
| frío 20 °C | 300 | 100 kHz | 0.035 mm | 6.03 | 3.68 |
| tibio 600 °C | 100 | 100 kHz | 0.132 mm | 1.78 | 1.11 |
| caliente 900 °C | 1 | 20 / 100 kHz | 3.73 / 1.67 mm | 1.00 | 1.00 |

En DC, el tubo caliente tiene 7.7 veces la resistencia del frío: 3.59 contra 0.46 mΩ/mm. Ese es el «canal» que sí reparte calor: la DC ya calienta más donde el alambre está más caliente.

El rizo como precalentador (40 A, 15 mm, DCEN):

| PWM | rizo | µ_frío | P_stickout | parte del rizo |
|---|---|---|---|---|
| 20 kHz | 14.52 A pp (4.19 A rms) | 7 | 19.33 W | 0.210 W (1.09 %) |
| 20 kHz | 14.52 A pp | 100 | 19.35 W | 0.218 W (1.13 %) |
| 100 kHz | 2.90 A pp | 7 | 19.00 W | 0.008 W (0.04 %) |
| 100 kHz | 2.90 A pp | 100 | 19.01 W | 0.014 W (0.07 %) |

Inducción con una bobina sobre el alambre libre (regla d/δ ≥ 2.5):
- Debajo de Curie, con µ = 100, basta f ≥ 3.5 kHz.
- Arriba de Curie hace falta f ≥ **2.7 MHz**. La inducción se **auto-limita en 770 °C**.

### 4.4 El alambre libre como precalentador, y cuánto funde la punta

Calibración de V_e con Lincoln NR-211-MP de 0.9 mm (DC−, stick-out de 10 mm):

| I | v_f | V_arco | T_punta | P_stickout | P_punta = I·V_e | V_e | P_gota/P_arco |
|---|---|---|---|---|---|---|---|
| 30 A | 20.8 mm/s | 14.0 V | 106 °C | 3.9 W | 154.0 W | 5.13 V | 0.37 |
| 65 A | 30.0 | 15.0 | 425 °C | 28.6 | 198.8 | 3.06 | 0.23 |
| 90 A | 38.3 | 16.0 | 820 °C | 87.2 | 203.5 | 2.26 | 0.19 |
| 120 A | 46.7 | 16.5 | 1480 °C (funde) | 195.7 | 159.4 | 1.33 | 0.16 |

Usamos V_e = 4.10 V, el promedio de los dos puntos bajos, que son los relevantes a 40 A. A corriente alta el modelo de Joule sobra calor (en 120 A funde en el stickout), así que la pared supuesta o el stickout real difieren. Por eso V_e queda INCIERTO entre 3 y 5 V, y eso es lo que decide el experimento de §7.

Predicción para el 0.8 mm (v_f de equilibrio, DCEN, V_e = 4.10 V):

| I | stickout 10 mm | 15 mm | 20 mm | T_punta a 15 mm | P_stick a 15 mm |
|---|---|---|---|---|---|
| 30 A | 21.4 mm/s (1.29 m/min) | 22.1 | 22.9 | 256 °C | 9.3 W |
| **40 A** | **29.1 (1.75)** | **30.5 (1.83)** | **32.4 (1.94)** | 359 °C | 19.0 W |
| 50 A | 37.2 (2.23) | 39.9 | 43.5 | 472 °C | 34.0 W |
| 70 A | 55.0 (3.30) | 62.2 | 71.4 | 691 °C | 85.6 W |

- Polaridad, a 40 A y 15 mm: en DCEP v_f = 24.9 mm/s (con −29 %) o 22.4 mm/s (con −50 %), contra 30.5 en DCEN.
- Precalentar en serio a 700 °C cuesta **42.7 W** y recorta **23.4 %** de la energía que pide la punta: **+30 % de depósito** con la misma corriente.
  - Gratis, con la DC: un stickout de **22.8 mm** da 700 °C en la punta a 40 A.
  - Con inducción: una bobina más su inversor resonante.

### 4.5 El balance de energía a 40 A

`V_arco = 14 + 10·L_arco` (medido por ian). A la gota llegan `P_punta = I·V_e` y `P_stick`. La columna y la caída de la pieza, `I·(V_arco − V_e)`, van a la placa y a la radiación.

| stickout | L_arco | V_arco | P_arco | P_stick | P_punta | P_gota | % a la gota | columna + pieza |
|---|---|---|---|---|---|---|---|---|
| 10 mm | 0.5 mm | 19 V | 760 W | 10.5 W | 163.9 W | 174.4 W | 22.6 % | 596 W |
| 10 mm | 1.0 mm | 24 V | 960 W | 10.5 | 163.9 | 174.4 | 18.0 % | 796 W |
| 10 mm | 2.0 mm | 34 V | 1360 W | 10.5 | 163.9 | 174.4 | 12.7 % | 1196 W |
| 20 mm | 0.5 mm | 19 V | 760 W | 30.3 | 163.9 | 194.2 | **24.6 %** | 596 W |
| 20 mm | 1.0 mm | 24 V | 960 W | 30.3 | 163.9 | 194.2 | 19.6 % | 796 W |
| 20 mm | 3.0 mm | 44 V | 1760 W | 30.3 | 163.9 | 194.2 | 10.8 % | 1596 W |

Como referencia, Watkins (1990) mide en GMAW con acero de 0.89 mm y Ar-2%O₂: la componente de la gota es 40 % del calor del arco y la eficiencia total 85 %. Es a corriente más alta, en spray. Nuestro 18–25 % a 40 A en arco corto es del mismo orden.

### 4.6 El campo axial

El campo propio del arco a 40 A vale 20 mT en la superficie del alambre, 8 mT a r = 1 mm y 4 mT a 2 mm.

Bobina de Ø 24/40 mm × 20 mm, llenado 0.6, cobre a ~60 °C:

| arco a z bajo la cara | 2 mT | 5 mT | 10 mT |
|---|---|---|---|
| 5 mm | 118 A·v, 0.3 W | 294 A·v, 1.8 W | 588 A·v, 7.2 W |
| 10 mm | 182 A·v, 0.7 W | 456 A·v, 4.3 W | 911 A·v, 17.4 W |
| 15 mm | 284 A·v, 1.7 W | 711 A·v, 10.6 W | 1421 A·v, 42.3 W |

Gratis: 10 vueltas del cable de la antorcha (R = 20 mm) a 40 A dan 12.6 mT en el centro y 6.4 mT a 15 mm. Ese campo es proporcional a I y no tiene perilla propia.

Literatura:
- CO₂, campo longitudinal: 2 mT da globular suave y 3–4 mT da repelida rotatoria.
- Metal-cored a 320 A con 6 mT: la frecuencia de gotas casi no cambia y la penetración va de 3.7 a 4.2 mm.
- TIG axial (modelo): el arco queda hueco y la presión en el eje pasa de +97 Pa a −3038 Pa a 150 mT.

### 4.7 Tanque LC, descarga de capacitor y pulsos con el mismo buck

LRS-1200-48 (hoja de Mean Well):
- 25 A nominales.
- **Pico de 37.5 A / 1800 W por ≤5 s**, con ciclo ≤35 % y promedio ≤1200 W.
- Si pasa de 105 % por más de 5 s, se **apaga** y hay que re-energizarla.

Tanque serie a f₂ = 668 Hz con L = 41 µH: C = 1.38 mF. Con R_lazo de 50 mΩ, Q = 3.4; con 100 mΩ, Q = 1.7. La gota tiene Q ≈ 30 (supuesto), y su f₂ baja 19 % mientras crece de 0.40 a 0.46 mm.

Pulsos con el mismo buck (40 A de base, pulsos de 1 ms, 75 por segundo):

| I_pico | subida | bajada | E del pulso | I de entrada pico | caída del bulk por pulso | P media | D1 prom |
|---|---|---|---|---|---|---|---|
| 70 A | 53.5 µs | 48.1 µs | 1.75 J | 39.2 A | 0.39 V | 1136 W (ok) | 20.2 A |
| 100 A | 107 µs | 96 µs | 2.50 J | 56.0 A | 4.21 V | 1196 W (al límite) | 21.3 A |
| 150 A | 196 µs | 177 µs | 3.75 J | 84.0 A | 10.6 V | **1297 W (>1200)** | 23.1 A |
| 200 A | 285 µs | 257 µs | 5.00 J | 112 A | 16.9 V | **1398 W (>1200)** | 24.9 A |

Descarga de capacitor directa a 48 V, por un lazo de 1 µH / 30 mΩ contra un arco de 20 V:

| C | E | I_pico a t | pellizco al pico | Δv de la gota de 0.46 mm (3.2 mg) | banda |
|---|---|---|---|---|---|
| 100 µF | 0.12 J | 226 A a 14 µs | 5.1 mN (1.4× la tensión) | ~0.02 m/s | plana hasta ~35 kHz |
| 1000 µF | 1.15 J | 496 A a 39 µs | 24.6 mN (6.5×) | ~0.30 m/s | plana hasta ~13 kHz |

### 4.8 «Resonancia de campos»: dónde hay resonancia y dónde no

| cosa | número |
|---|---|
| λ a 668 Hz / 20 kHz / 100 kHz | 449 km / 15 km / 3 km (todo es cuasi-estático) |
| media onda EM en un stickout de 20 mm | 7.5 GHz |
| media onda EM en un arco de 2 mm | 75 GHz |
| frecuencia de plasma del arco (n_e = 10²²–10²³ m⁻³) | 0.9–2.8 THz |

Resonancias REALES a nuestro alcance:
1. La mecánica de la gota: l = 2 a 668 Hz, Q ~ 30 supuesto.
2. El umbral de Curie: a 770 °C, µ pasa de ~100 a 1. Es un termostato, no una resonancia.
3. Un LC concentrado.

### 4.9 Lente del operador: los canales de la punta

| canal | ley | qué oye de I(t) | qué lo selecciona | sirve para |
|---|---|---|---|---|
| C0 punta (caída del electrodo) | P = V_e·⟨I⟩ | solo el **momento 1** (la media) | polaridad (DCEN), material, fundente | calentar la gota: **la perilla grande** |
| C1 Joule del stickout | P = Σ_k I_k²·R(f_k, T) | momento 2 de todos los tonos | largo del stickout; µ(T), con Curie como umbral | precalentar; la HF aporta ≤1 % |
| C2 columna + pieza | P = ⟨I⟩·10 V/mm·L_arco | la media | largo de arco | sumidero hacia la pieza y la radiación |
| C3 fuerza (pellizco y chorro) | F ∝ I² (más los flancos, según UHFP) | momento 2; la gota l=2 solo oye f₂ ± f₂/Q | la frecuencia (selectiva por el Q de la gota) | **soltar**, no calentar |
| C4 campo externo | J × B_ext | — | una bobina | apuntar (l=1, transversal) o rotar (axial) |

El postulado de canal dice que cada modo necesita un canal selectivo propio, o se diluye. Aplicado aquí:

- «Concentrar en la punta» significa subir C0 + C1 contra C2.
- La HF no tiene un canal propio hacia la punta. C0 es lineal y no rectifica una onda de media cero; C1 solo la oye por `⟨I_ac²⟩`.
- 𝔄 (empujar en cuadratura) solo acumula energía donde hay un oscilador con Q, y el único es la gota (C3). El resonador que ian intuye existe y es la gota, pero sirve para **soltar**, no para **calentar**.
- Para calentar, la «sintonía» real es un umbral: Curie.
- En «acuerdo o silencio», la evidencia sostiene C0, C1 y C2. La HF tipo UHFP queda en silencio (INCIERTO), y lo que sí está medido de ella apunta a la pieza.

### 4.10 Lateral: el canon y su «3 m/min con 40 A»

El canon dice: «campanazo con 40 A de base + 30 A a f₂, alambre a 3 m/min, 75 gotas/s de 0.4526 mm».

- 3 m/min son 50 mm/s.
- 75 gotas por segundo de 0.388 mm³ son **29.1 mm³/s**. A 50 mm/s el 0.8 tubular solo trae **25.1 mm³/s** en total, y de eso el acero es 15.3 mm³/s. El canon parece haber usado alambre macizo.
- La onda de 30 A tiene media cero y nunca baja de 10 A. Por eso **no agrega calor a la punta**. Solo sube Joule por I_rms² (45.3 A, ×1.28 sobre 19 W).

| V_e | 40 A DC funde | acero → gotas/s de 0.4526 mm | I media para 3 m/min |
|---|---|---|---|
| 3.0 V | 23.9 mm/s (1.43 m/min) | 7.32 mm³/s → 18.8/s | 67.4 A |
| 4.1 V | 30.5 mm/s (1.83 m/min) | 9.35 mm³/s → **24.1/s** | **59.7 A** |
| 5.1 V | 37.1 mm/s (2.23 m/min) | 11.36 mm³/s → 29.3/s | 52.0 A |

Comprobación independiente con Lincoln NR-211-MP de 0.9 mm en DC−, escalada a 0.8 mm por área: 40 A funden **~1.78 m/min**, y 3 m/min piden **~94 A**.

Conclusión: con 40 A de base salen ~20–30 gotas/s de 0.45 mm, no 75. Para 75 gotas/s hacen falta 60–94 A medios (y a esa corriente el pellizco ya pesa más: 9.5 % de la tensión a 60 A), o gotas más chicas. Esto no invalida el campanazo, que sirve para soltar; corrige su ritmo. El experimento de §7 lo decide: la pendiente DCEN es exactamente los mm/s que 40 A pueden fundir.

## 5. Veredictos

| # | Hipótesis | Veredicto | Qué lo decide |
|---|---|---|---|
| H1a | La HF superpuesta constriñe el arco y sube la presión | **PASA en la literatura** (GTAW con flancos de 50 A/µs: +30 a +81 % de fuerza). **FALSA con nuestro buck**: flancos 71× más lentos, ⟨I²⟩ +1 %. Ese efecto mete la energía en la **pieza**, no en la gota | Quemado libre a 20 contra 100 kHz más foto del arco (§7) |
| H1b | La HF mete más energía en la punta | **FALSA**: la punta es un canal lineal, y el quemado simulado da +0.01 % entre 20 y 100 kHz | §7: si la diferencia pasa de 5 %, se reabre |
| H2a | La HF calienta preferentemente la superficie del alambre libre | **FALSA** con 40 A de DC (µ_inc ≈ 9, R_ac/R_dc = 1.00 a 20 kHz). Solo es cierta sin DC y debajo de Curie (1.1–3.7×), y aun así sobre el 1 % de la potencia | Medir R_ac del alambre frío con y sin 40 A de DC (LCR más fuente) |
| H2b | Precalentar el alambre da más depósito con menos corriente | **PASA en física**: a 700 °C, +30 % de depósito. La vía gratis es DC + stickout (22.8 mm). La inducción dedicada (que se auto-limita en Curie) queda **INCIERTO / no para el MVP**: son más piezas | Quemado con stickout de 10 contra 20 mm: pendiente +11 % |
| H3a | El campo axial concentra el arco | **FALSA**: rota y ensancha; en el modelo, presión central negativa | — |
| H3b | El campo axial rota y cambia la transferencia con 2–6 mT | **PASA** (literatura). Que sirva para imprimir queda **INCIERTO** | 10 vueltas del cable: arranque contra sin ellas |
| H3c | El pellizco propio concentra a 40 A | **FALSA**: 4 % de la tensión, 51 Pa | — |
| H4a | Un tanque LC a f₂ para empujar la gota | **FALSA**: Q de 1.7–3.4 contra 30 de la gota, f fija contra f₂ que se corre 19 %, y el buck ya lo hace | — |
| H4b | Una descarga de capacitor para pasar del límite de la fuente | **FALSA para el MVP**: banda ancha, 226–496 A, más piezas. El buck da 70–100 A dentro de la LRS | — |
| H5 | Fracción a la gota a 40 A de ~19–25 %, y las perillas son arco, polaridad y stickout | **PASA (cálculo)**, con V_e **INCIERTO** (3–5 V) | §7 mide V_e y la polaridad |
| H6 | «Resonancia de campos» EM en la pluma | **FALSA**: λ = 3 km a 100 kHz; resonar en 20 mm pide 7.5 GHz | — |
| H7 | Lateral: el canon funde 3 m/min con 40 A de base | **FALSA** según dos estimaciones independientes (modelo y Lincoln escalado) | §7: la pendiente del quemado da los mm/s a 40 A |

## 6. Qué cambia en el banco, el circuito y el firmware

- **No se agrega nada para «resonar».** Fuera: bobina axial, tanque LC, banco de descarga, inductor chico o etapa UHFP, bobina de inducción. La lista de componentes se queda igual. Esto va con la meta de ian: menos piezas, más control.
- **Firmware: PWM a 100 kHz.** No es por energía en la punta (no cambia nada). Es por rizo (14.1 → 2.9 A pp) y por ancho de banda del lazo, lo que ya pedía el canon.
  - Cuesta +12.2 W en Q1 y el snubber. Q1 disipa 34.9 W a 100 kHz, así que el disipador tiene que aguantarlo.
  - El rizo de 20 kHz no hace nada útil: no se usa como «HF».
- **Firmware: el largo de arco SE CIERRA (CV o servo de alimentación). No es opcional.**
  - En CC con alimentación fija, el canal Joule es débil: dMR/dL_stickout = 0.33/s, o sea τ = **3.0 s**.
  - 1 % de error de alimentación mueve el arco **0.93 mm = 9.3 V**.
  - Con CV, ese mismo 1 % se corrige con 0.34 A.
- **Firmware: modo QUEMADO** (§7): para el motor, registra V por el ciclo de trabajo y corta a 38 V. Es la calibración de V_e y de la polaridad.
- **Banco: verificar la polaridad DCEN** (pluma negativa) antes que nada. Es la perilla más grande: +29–50 % de fusión según las fuentes. Además DCEN manda el calor al electrodo y no a la placa.
- **Perillas del arco:** arco corto (0.5–1 mm, 19–24 V) y stickout de 15–20 mm como precalentador.
- **Canon:** la velocidad de alambre de 3 m/min a 40 A no cuadra (§4.10). O se baja a ~1.8 m/min (menos gotas por segundo), o se sube la base.
- **Pulsos para soltar:** el buck alcanza ≤100 A de pico (1196 W medios a 75 pulsos/s) sin cambiar piezas. Arriba de eso la LRS pasa de 1200 W y se apaga a los 5 s.

## 7. El experimento más barato que lo decide: QUEMADO LIBRE

**Montaje:** cero piezas nuevas.
- 40 A fijos (CC).
- Antorcha fija con CTWD de 16 mm.
- Alimentación corriendo hasta el equilibrio (stickout ≈ 15 mm, arco ≈ 1 mm, ~24 V).

**Procedimiento:**
1. Se PARA el motor del alimentador.
2. El alambre se quema hacia atrás y el voltaje sube a `dV/dt = 10 V/mm × MR`.
3. El voltaje se lee por el ciclo de trabajo, con ~37 mV de ruido por periodo.
4. Se corta a 38 V (arco de 2.4 mm).
5. Se ajusta una recta entre 26 y 36 V.

Antes de empezar, se mide cuánto patina el motor al pararlo: se marca el alambre.

**Casos:** 10 tiros por caso.

| caso | pendiente predicha | MR | 24 → 38 V |
|---|---|---|---|
| DCEN, PWM 100 kHz | **305 V/s** (224–382 V/s si V_e = 3.0–5.1 V) | 30.5 mm/s | 46 ms |
| DCEN, PWM 20 kHz | **305 V/s (+0.01 %)** | 30.5 | 46 ms |
| DCEP, 100 kHz | **204–237 V/s** (0.67–0.78× DCEN) | 20.4–23.7 | 59–69 ms |

**Si la física estándar es cierta:**
- 20 kHz y 100 kHz dan la misma pendiente, con diferencia menor a 2 % (el error esperado es ±3–5 % por caso).
- DCEP queda 22–33 % por debajo de DCEN.
- La pendiente DCEN cae entre 220 y 380 V/s.
- Una foto del arco con el celular, a través del vidrio de careta, da el mismo ancho a 20 y a 100 kHz (±5 %).

**Qué lo falsea:**
- Si 20 kHz difiere de 100 kHz por más de 5 %, hay un efecto de la HF en la punta que no es Joule, y se reabre la «resonancia».
- Si DCEN/DCEP queda por debajo de 1.1, la polaridad no es perilla.
- Si la pendiente DCEN se sale de 220–380 V/s, V_e está fuera de rango y hay que recalcular la velocidad de alambre del canon.

**Costo:** firmware (parar el motor, registrar el duty, cortar a 38 V) y unos 40 tiros de 50 ms.

## 8. Fuentes

- Li W., Lv G., Wang Q., Huang S. (2020). *Arc Characteristics and Weld Bead Microstructure of Ti-6Al-4V in UHFP-GTAW.* Materials Science (Medžiagotyra) 26(4). Texto completo leído: https://matsc.ktu.lt/index.php/MatSc/article/view/22329/14320 (doi 10.5755/j01.ms.26.4.22329)
- Yang M., Yang Z., Qi B. (2015). *The effect of pulsed frequency on the plasma jet force with ultra high-frequency pulsed arc welding.* Welding in the World 59(6):875–882, doi 10.1007/s40194-015-0261-0. Resumen: https://buaa.globalimpact.cn/en/publications/the-effect-of-pulsed-frequency-on-the-plasma-jet-force-with-ultra/
- Zheng H., Qi B., Yang M. (2021). *Dynamic analysis of the ultrasonic-frequency pulsed GMAW metal transfer process.* J. Manuf. Processes 62:283–290, doi 10.1016/j.jmapro.2020.12.049. Resumen: https://buaa.globalimpact.cn/en/publications/dynamic-analysis-of-the-ultrasonic-frequency-pulsed-gmaw-metal-tr/
- Zheng H., Qi B., Yang M., Liu H. (2022). *Effect of Arc Behaviour and Metal Transfer Process on Aluminium Welds during UFP-GMAW.* Crystals 12(5):586. Solo el resumen, vía búsqueda: https://www.mdpi.com/2073-4352/12/5/586
- Cook G.E., Eassa H.E.H. (1985). *The Effect of High-Frequency Pulsing of a Welding Arc.* IEEE Trans. Ind. Appl. IA-21(5):1294–1299, doi 10.1109/TIA.1985.349557. Solo el resumen, vía búsqueda.
- UHFP-GTAW de 20 a 80 kHz, de 0 a 50 A (2020): https://link.springer.com/article/10.1007/s40194-020-01016-9 (resumen, vía búsqueda). Applied Sciences 7(1):45 (2017): https://www.mdpi.com/2076-3417/7/1/45 (resumen, vía búsqueda).
- Patente de una fuente UFP-GMAW: https://data.epo.org/gpi/EP3244522B1
- Watkins A.D., Smartt H.B., Einerson C.J., Watkins J.A. (1990). *Heat and mass transfer in the GTAW and GMAW processes.* OSTI 6019827: https://www.osti.gov/biblio/6019827
- Chen G. et al. (2025). *Impact of Magnetic Fields on Arc Pressure, Temperature, Plasma Velocity, and Voltage in TIG Welding.* Micromachines 16(9):967: https://pmc.ncbi.nlm.nih.gov/articles/PMC12472086/
- Campo longitudinal en CO₂ (2–4 mT): https://www.mdpi.com/1996-1944/18/3/537. Metal-cored a 320 A con 6 mT: https://link.springer.com/article/10.1007/s00170-025-16581-w. Ambos solo por resumen, vía búsqueda.
- Lincoln Innershield NR-211-MP, hoja con «Calculation data» (tabla leída): https://www.prolineindustrial.co.nz/images/uploaded/ProductPDFs/1654060004815-Lincoln%20Innershield%20NR-211MP.pdf
- Mean Well LRS-1200, especificación (leída): https://www.meanwell.com/Upload/PDF/LRS-1200/LRS-1200-SPEC.PDF
- Polaridad y fusión:
  - DCEN +29 % contra DCEP con Ar+18CO₂: https://link.springer.com/article/10.1007/s00170-017-1349-z
  - Puhl, +40–50 % (citado en una revisión): https://scielo.br/j/si/a/hGvfRsvnLYmgV34PfLc733g/?lang=en
  - DCEN manda el calor al electrodo: https://WWW.HOBARTBROTHERS.COM/wp-content/uploads/2020/09/FabCOR-F6-White-Paper.pdf

  Las tres, vía búsqueda; no se leyeron completas.
- E71T-GS en DCEN: https://www.forneyind.com/products/e71t-gs-self-030-x-2-lbs-steel-mig-welding-wire y https://materialwelding.com/e71t-gs-welding-wire/
- Caída de cátodo de 12.7 V y de ánodo de 4.7 V en acero (tesis de UAlberta): https://era.library.ualberta.ca/items/4730be9a-a2da-4aa2-abf0-c9075620dee7 (vía búsqueda)
- Ajuste B-H de acero 1010 (foro; **no verificado**): https://www.comsol.com/forum/thread/37702/b-h-curve-for-soft-iron
- Resistividad del 1010 a 23 °C, 1.43–1.74×10⁻⁷ Ω·m: https://www.mfgrobots.com/Article/material/metal/35889.html
- MBR40100CT, IFSM de 300 A (8.3 ms): https://www.mccsemi.com/pdf/Products/MBR40100CT(TO-220AB).pdf
- Forma de la ley de fusión de Lesnewich, MR = αI + βLI² (vía una patente): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/7381923
- De memoria, sin verificar: el valor de µ0 y las ecuaciones de Maecker, de profundidad de piel y de solenoide (física estándar), y la frecuencia de plasma, `f_p ≈ 8.98·√n_e` Hz.
