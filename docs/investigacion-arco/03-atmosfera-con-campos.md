# 03 · ¿Los gases salen ionizados y podemos crear nuestra propia atmósfera con campos?

Investigación del arco, 2026-11-05. Alambre: Truper MICRO-1 E71T-GS de 0.8 mm, sin gas, DCEN.
Script: `scripts/investigacion-arco/03_atmosfera_con_campos.py`. Salida cruda: `03_atmosfera_con_campos.out`, de donde salen todos los números de este reporte.

## 1. La pregunta

¿Se puede imprimir metal sin gas, con el mismo alambre, aprovechando que los gases salen ionizados para sujetarlos o empujarlos con campos? ¿O hay otra palanca de control que sí funcione?

## 2. Respuesta corta

- **Casi nada sale ionizado.** El gas conductor ocupa un radio de 1.0 a 1.7 mm alrededor del eje. Fuera de él queda el 0.3–0.4 % de los electrones; más allá de 3 mm, una fracción de 10⁻⁹. Al enfriarse, la carga muere en 1–300 ns (recombinación disociativa y captura por O₂, 13 ns en aire). Lo poco que queda es cuasi-neutro, con longitud de Debye de 4–40 µm, así que un campo E no lo puede agarrar. **FALSA.**
- **El confinamiento magnético a 1 atm es imposible.** Para magnetizar los electrones (ω_c·τ = 1) hacen falta 0.6 T en la capa fría y 6–16 T en el arco. Los iones necesitan 400–1800 T. Con 1 T, ω_ce·τ = 0.15 y ω_ci·τ = 10⁻³. Además, el B que alcanzaría para frenar el gas (1 T) empuja la corriente del arco con 900 veces el momento de su chorro y lo apaga. **FALSA.**
- **Una cortina de viento iónico no protege.** Da como mucho 1–40 Pa (1–8 m/s), y lo que mueve es aire. La bomba propia del arco empuja con 40–400 Pa a 40 A, así que la cortina pierde por 10 a 100 veces. Pone kV junto a un conductor. Sus 1–7 mg/h de ozono son poco al lado de los 6–12 g/h de humo del propio alambre. **FALSA** como escudo.
- **La palanca real es la bomba de Maecker, y se controla con la corriente y el largo del arco. PASA en lo cualitativo; las magnitudes son INCIERTAS.** A 40 A la raíz del arco bombea 1.2–3.8 mg/s, y la columna arrastra 1.3–2.5 mg/s por cada mm de largo. El fundente produce del orden de 2.5–12.5 mg/s de vapor (supuesto). Por eso **el largo del arco es la perilla dominante**: cada mm de arco pesa lo mismo que toda la bomba de la raíz. Lincoln documenta que el N del metal depositado pasa de 0.020 % a 0.036 % (inaceptable) cambiando solo la forma de onda y el voltaje.
- **La nube del fundente es un canal con su propia banda.** Su constante de tiempo es τ ≈ 0.3–2 ms, o sea un corte de f_c ≈ 80–600 Hz. Con la misma corriente media, un pulso lento de 130/10 A mete en el pico 1.5 veces más aire del que la nube repone; el campanazo de 668 Hz mete 0.91 veces y queda por encima de la banda de la nube. **Pulsos lentos con pico alto: no. Campanazo: sí.**
- **El campo axial o transversal empeora la protección. FALSA como escudo.** Un campo transversal de 3 mT tuerce el arco 50–70° a 40 A, y la pinza de tierra mal puesta (0.8 mT) lo tuerce 20–35°. Un campo axial de 3 mT da un número de giro S = 1.3 > 0.6: el vórtice se rompe y arrastra más aire. Solo podría servir para agitar el charco (INCIERTO).
- **La protección real es química, y la ley de Sieverts lo explica.** Con 25 % de aire en la atmósfera del arco el equilibrio ya da 0.020 % de N, y diluir el aire 10 veces solo baja el N 3.2 veces. Por eso el alambre trae Al, Mg, Li y fluoruros. Al imprimir capa sobre capa, desde la 3.ª capa el depósito queda con todo su Al (≈ 1.75–1.8 %), cuando el E71T-GS está clasificado para UNA pasada. Además, la escoria hay que quitarla en cada capa.

**Lo que cambia:** nada de alto voltaje, imanes ni cortinas. El control de la atmósfera ya lo tiene el circuito, porque es la corriente y el largo del arco. El firmware fija el arco más corto estable, prohíbe pulsos lentos con pico alto y registra ⟨I⟩, I_rms, ⟨I^1.5⟩ y V por cordón. El banco necesita una tierra simétrica, el choque lejos de la antorcha y extracción de humo.

## 3. Método

| Bloque | Modelo | Supuestos clave | Fuente |
|---|---|---|---|
| Ionización | Saha, LTE, ionización simple, neutralidad con varias especies a 1 atm | Partición: 2U⁺/U₀ con pesos del estado base [MEM]; NO de equilibrio de Zeldovich K = 20·e^(−21700/T) [MEM]; la nube del fundente es 55 % Fe, 12 % Mg, 4 % Al, 3 % Li, 4 % Ca, 2 % Mn y 20 % F [SUP]; perfil T(r) gaussiano más halo (dos escenarios) [SUP] | estándar |
| Vida de la carga | 3 cuerpos 8.75×10⁻²⁷ T_e^−4.5 cm⁶/s; radiativa 2.7×10⁻¹³ T^−½ cm³/s; disociativa ~4×10⁻⁷ (300/T)^½ cm³/s; captura en O₂ 0.76×10⁸ s⁻¹; ion-ion 2×10⁻⁶ cm³/s | coeficientes de libro | NRL (vía arXiv 1403.0637), Dogariu y col. (Princeton); radiativa, disociativa e ion-ion son [MEM] |
| Hall / MHD | ν_en = n σ v (σ_en ~ 10⁻¹⁹ m²), ν_ei de Spitzer, ν_in con σ_in ~ 7×10⁻¹⁹ m²; Stuart N = σB²L/(ρu) | secciones eficaces de orden [MEM] | estándar |
| EHD | presión máxima ½ε₀E² con E por debajo de la ruptura (3 MV/m) | eficiencia de la corona ~1 % | Moreau y col.; CPB 2019; Chen y Davidson |
| Bomba de Maecker | Δp = µ₀IJ/4π, v = c·√(2Δp/ρ), ṁ = ρ·v·πR², R = √(I/πJ) | c = 0.53, calibrado con la Tabla 3 de Mendez (argón 200 A: 256 m/s numérico contra 482 m/s de Maecker); ρ_plasma = 0.04 kg/m³ y J = 10⁷–10⁸ A/m² [SUP] | Mendez 2000 |
| Arrastre de la columna | chorro redondo laminar de Schlichting, ṁ(x) = 8π·µ·x (no depende del momento) | µ en el borde 5×10⁻⁵–10⁻⁴ Pa·s [MEM]; Re = 5–35, laminar | [MEM] Schlichting |
| Nube del fundente G | G = masa del alambre × relleno × fracción volátil; G ∝ ⟨I⟩ | 3 m/min a 40 A (canon); relleno de 15–25 % y volátil de 10–30 % [SUP] | — |
| Nitrógeno | Sieverts: [N] = 0.045 %·√p_N₂ a 1600 °C | equilibrio con N₂ (el N monoatómico del arco lo supera) | Pehlke y Elliott; Lincoln US8759715 |
| Campos sobre el arco | desvío ≈ F/(momento del chorro), con F = I·B·L; par axial T = I·B_z·R²/2; giro S = T/(R·ṁ·v) | el arco tratado como chorro libre (en realidad está anclado en ambos extremos); umbral de rotura del vórtice S ≈ 0.6 [MEM] | — |

[MEM] = de memoria (libro de texto), no verificado en línea. [SUP] = supuesto mío. Todo lo marcado así se cambia en el script.

## 4. Resultados (telemetría cruda del `.out`)

### 4.1 ¿Cuánto sale ionizado? (Saha a 1 atm, x_e = n_e/n_pesados)

| T [K] | aire atómico | aire molecular + NO | vapor de Fe | aire + 1 % K | nube del fundente | n_e en la nube [m⁻³] |
|---|---|---|---|---|---|---|
| 2000 | 2.4e-17 | 1.0e-12 | 1.5e-9 | 2.6e-6 | 2.2e-7 | 8.2e17 |
| 3000 | 2.5e-11 | 3.3e-8 | 5.1e-6 | 2.8e-4 | 7.7e-5 | 1.9e20 |
| 4000 | 3.2e-8 | 6.5e-6 | 3.3e-4 | 2.9e-3 | 1.7e-3 | 3.1e21 |
| 5000 | 2.6e-6 | 1.7e-4 | 4.4e-3 | 7.6e-3 | 1.2e-2 | 1.7e22 |
| 6000 | 5.1e-5 | — | 2.5e-2 | 9.6e-3 | 4.3e-2 | 5.1e22 |
| 8000 | 2.4e-3 | — | 0.24 | 1.1e-2 | 0.25 | 1.8e23 |
| 10000 | 2.5e-2 | — | 0.71 | 3.1e-2 | 0.61 | 2.8e23 |

- El aire caliente por debajo de 5000 K se ioniza casi solo por el NO (IP 9.26 eV): 1000 veces más que el N y el O atómicos a 3000 K.
- La captura de electrones por el F de los fluoruros (afinidad de 3.4 eV) baja todavía más la n_e de la nube.

Perfil radial (supuesto) y electrones fuera del canal conductor (x_e > 10⁻³):

| Escenario | Radio del canal | e⁻/m dentro | e⁻/m fuera | Fracción fuera | Fracción fuera de 3 mm |
|---|---|---|---|---|---|
| estrecho (9000 K, w 1.0 mm, halo de 1500 K) | 1.01 mm | 2.2e17 | 8.6e14 | 0.40 % | 0 |
| ancho (10000 K, w 1.5 mm, halo de 2500 K) | 1.68 mm | 7.3e17 | 2.4e15 | 0.32 % | 8.7e-10 |

### 4.2 ¿Cuánto vive la carga a 1 atm?

| T [K] | n_e [m⁻³] | τ 3 cuerpos | τ radiativa | τ disociativa (iones moleculares) |
|---|---|---|---|---|
| 10000 | 1e22 | 0.59 µs | 0.34 ms | 1.4 ns |
| 5000 | 1e20 | 0.26 ms | 24 ms | 0.10 µs |
| 3000 | 1e20 | 26 µs | 19 ms | 79 ns |
| 3000 | 1e18 | 0.26 s | 1.9 s | 7.9 µs |

- El gas tarda 20–300 µs en recorrer 1–3 mm.
- Cota alta de ionización «congelada», contando solo recombinación de 3 cuerpos: 3×10¹⁹–4×10²⁰ m⁻³. En aire, la recombinación disociativa la mata en 28–270 ns.
- En aire frío, un electrón libre se pega a un O₂ en **13 ns**.
- Los iones que quedan, a 10¹⁴ m⁻³, viven 5 ms. Es una carga minúscula y cuasi-neutra: la longitud de Debye es de 4 µm a 10¹⁸ m⁻³ y de 38 µm a 10¹⁶ m⁻³.

### 4.3 ¿Se puede confinar con B? (parámetro de Hall)

| T [K] | n_e | σ [S/m] | B para ω_ce·τ = 1 | B para ω_ci·τ = 1 (N⁺) | B para ω_ci·τ = 1 (Fe⁺) |
|---|---|---|---|---|---|
| 2000 | 8.2e17 | 0.23 | 0.58 T | 917 T | 1833 T |
| 3000 | 1.9e20 | 52 | 0.58 T | 748 T | 1497 T |
| 6000 | 5.1e22 | 1230 | 6.6 T | 529 T | 1058 T |
| 10000 | 2.8e23 | 2850 | 15.7 T | 410 T | 820 T |

- A 6000 K, con 0.3 T: ω_ce·τ = 0.046 y ω_ci·τ = 3×10⁻⁴.
- **Frenar el gas con B** pide un número de Stuart N ≳ 1. A 3000 K con 1 T, N = 0.26. Solo en la capa de 4000 K con 1 T se llega a N = 2.5, y esa capa está pegada al arco.
- Con ese mismo 1 T, la fuerza sobre la corriente del arco (40 A, 2 mm) es de 80 mN, **886 veces** el momento del chorro.

### 4.4 Viento iónico (EHD)

| E [MV/m] | Presión máxima [Pa] | v máxima [m/s] |
|---|---|---|
| 0.5 | 1.1 | 1.4 |
| 1.0 | 4.4 | 2.7 |
| 3.0 (ruptura) | 40 | 8.2 |

- Una cortina de 30×10 mm a 2 m/s cuesta 1.4 mW cinéticos, unos 144 mW eléctricos. Barato, pero mueve **aire**, y la bomba del arco empuja con 40–400 Pa.
- Ozono a 10–50 g/kWh [MEM]: 1.4–7.2 mg/h. El humo del alambre a 1–2 % de la masa [MEM] es de **6–12 g/h**: ese es el riesgo real, junto con fluoruros y Mn.

### 4.5 La bomba de Maecker (con J = 3×10⁷ A/m²; el rango completo de J está en el `.out`)

| I [A] | R de la raíz | Δp [Pa] | v [m/s] | ṁ de la raíz [mg/s] | Re | respuesta |
|---|---|---|---|---|---|---|
| 20 | 0.46 mm | 60 | 29 | 0.78 | 5 | 32 µs |
| 40 | 0.65 mm | 120 | 41 | 2.20 | 11 | 32 µs |
| 70 | 0.86 mm | 210 | 54 | 5.08 | 19 | 32 µs |
| 130 | 1.17 mm | 390 | 74 | 12.9 | 35 | 32 µs |

- Con J de 10⁷ a 10⁸ A/m², a 40 A: ṁ = 1.2–3.8 mg/s y Δp = 40–400 Pa.
- El chorro sigue a la corriente hasta ~10 kHz.
- La columna arrastra 1.26, 1.76 o 2.51 mg/s por mm (con µ_borde = 5×10⁻⁵, 7×10⁻⁵ o 10⁻⁴ Pa·s).
- El alambre a 3 m/min son 25.1 mm³/s, unos 0.167 g/s. La nube G sale de 2.5, 6.7 o 12.5 mg/s (escenarios bajo, medio y alto).

**Envolvente de protección en DC:** toma de aire = f·ṁ_raíz + 8πµL < G, con f = 0.5 la fracción de aire en la zona de succión de la raíz.

| I [A] | G [mg/s] | ṁ de la raíz | L_max (G medio) | L_max (G bajo … alto) |
|---|---|---|---|---|
| 20 | 3.3 | 0.78 | 1.7 mm | 0.5 … 3.3 mm |
| 40 | 6.7 | 2.20 | 3.2 mm | 0.8 … 6.5 mm |
| 60 | 10.0 | 4.03 | 4.5 mm | 1.0 … 9.5 mm |
| 100 | 16.7 | 8.68 | 7.0 mm | 1.1 … 15.3 mm |

- La forma es robusta y la escala no. L_max crece con I porque el vapor crece como ⟨I⟩ y el arrastre de la columna no depende de I. Eso coincide con las tablas de los fabricantes, donde el voltaje sube con la velocidad del alambre.
- La «corriente de cruce» I*, a partir de la cual la raíz sola bombea más de lo que el fundente produce, sale de 52 A en el escenario bajo a 369 A en el medio. **INCIERTO.**

**Formas de onda con la misma corriente media (40 A, misma fusión):**

| Onda | I_rms | ⟨I²⟩/DC | ⟨I^1.5⟩/DC | aire a L = 2 mm [mg/s] | pico/G medio | pico/G instantáneo | L_max en el pico |
|---|---|---|---|---|---|---|---|
| DC 40 A | 40.0 | 1.00 | 1.00 | 4.62 | 0.69 | 0.69 | 3.16 mm |
| campanazo 40 + 30·sen, 668 Hz | 45.3 | 1.28 | 1.11 | 4.74 | 0.91 | 0.52 | 2.34 mm |
| pulso 70/10 A, 50 % | 50.0 | 1.56 | 1.22 | 4.86 | 0.91 | 0.52 | 2.34 mm |
| pulso 130/10 A, 25 % | 65.6 | 2.69 | 1.56 | 5.23 | **1.49** | 0.46 | **0.13 mm** |
| pulso 190/10 A, 16.7 % | 78.1 | 3.81 | 1.83 | 5.53 | **2.23** | 0.47 | **< 0** |
| DC + rizo de 3 A a 100 kHz | 40.1 | 1.003 | 1.001 | 4.62 | 0.71 | 0.66 | 3.09 mm |

**La nube como canal** (volumen de unos 3 mm de lado, 30 g/mol): τ_nube = 0.26–1.97 ms y f_c = 81–604 Hz. Si la onda es más rápida que f_c, la nube promedia: el promedio a L = 2 mm sube solo +3 % con el campanazo y +13 % con el pulso de 130/10. Si es más lenta, manda el pico (columna «pico/G medio»). El vapor de la punta responde en ~8 ms [SUP], así que la verdad está entre las columnas «G medio» y «G instantáneo». **El banco decide.**

### 4.6 Nitrógeno (Sieverts, 1600 °C)

| Aire en la atmósfera del arco | p_N₂ | [N] de equilibrio |
|---|---|---|
| 100 % | 0.79 atm | 0.040 % (400 ppm) |
| 25 % | 0.20 atm | 0.020 % |
| 10 % | 0.079 atm | 0.0126 % |
| 1 % | 0.008 atm | 0.0040 % |

- Lincoln, NR-233 (US8759715, Fig. 29): de 0.020 % a 0.036 % («inaceptable») solo cambiando la forma de onda y el voltaje.

### 4.7 Campos sobre el arco

- **Campo propio** a 1 mm del eje: 8 mT a 40 A y 14 mT a 70 A. Un campo externo de unos pocos mT ya compite con él.
- **Desvío transversal a 40 A** (momento del chorro: 90 µN):

| B⊥ | L = 1 mm | L = 2 mm |
|---|---|---|
| 0.8 mT | 20° | 35° |
| 3 mT | 53° | 69° |
| 10 mT | 77° | 84° |

- Los 3 mT de «apuntar» la gota del canon tuercen el arco igual. Ese es el soplo de arco que el canon dejó sin modelar.
- **Giro con campo axial a 40 A:** S = 0.44 con 1 mT, 1.33 con 3 mT, 4.4 con 10 mT y 13 con 30 mT. Por encima de S ≈ 0.6 se forma una burbuja de recirculación, y el chorro arrastra más y se abre en campana.
- **El choque de 41 µH en serie** produce, a 40 A, 18 mT por dentro y unos 9 mT en la boca. Si su eje apunta al arco, es una bobina axial «gratis» y no deseada. También está cerca del ACS758.

### 4.8 Gota (lado; cota baja, sin convección interna; D_N = 10⁻⁸ m²/s [MEM])

| Gota | Tiempo colgada | Piel de N | Fracción del volumen |
|---|---|---|---|
| campanazo, 0.45 mm | 13 ms | 11.5 µm | 15 % |
| globular, 1.63 mm | 623 ms | 79 µm | 26 % |

- El vuelo por 2 mm de arco dura 2.5 ms.
- La gota chica del campanazo pasa menos tiempo expuesta por unidad de masa. Es un punto a favor del campanazo (**INCIERTO**: falta la convección).

### 4.9 Capa sobre capa: el Al del depósito

| Dilución | Capas 1 a 6 (% Al; tope del alambre 1.8) |
|---|---|
| 0.2 | 1.44, 1.73, 1.79, 1.80, 1.80, 1.80 |
| 0.3 | 1.26, 1.64, 1.75, 1.79, 1.80, 1.80 |
| 0.5 | 0.90, 1.35, 1.58, 1.69, 1.74, 1.77 |

## 5. Veredictos

| # | Hipótesis | Veredicto | Por qué | Qué medición lo decide |
|---|---|---|---|---|
| H1 | «Los gases salen ionizados y se pueden agarrar con campos» | **FALSA** | 0.3–0.4 % de los e⁻ fuera del canal y 10⁻⁹ fuera de 3 mm; la carga muere en ns; es cuasi-neutra (Debye 4–40 µm), así que E no ejerce fuerza neta | Sonda de Langmuir o placa a ±50 V a 5 mm del arco: se espera una corriente de µA, contra los 40 A del arco |
| H2 | Confinamiento magnético a 1 atm | **FALSA** | ω_ce·τ = 0.15 con 1 T; los iones necesitan ~10³ T; el B que frena el gas (N ≳ 1) apaga el arco (886 veces su momento) | No hace falta banco: la física sola lo cierra |
| H3 | Cortina EHD de corona en kV | **FALSA** como escudo | 1–40 Pa contra 40–400 Pa de la bomba del arco; empuja aire; pone kV junto al plasma conductor y a 48 V | — (si algo, un precipitador electrostático de humo LEJOS del arco: INCIERTO, fuera de alcance) |
| H4a | La forma de onda controla cuánto aire se traga el arco | **PASA** (cualitativo) | El chorro sigue a I en ~30 µs; la bomba ∝ I^1.5 y la presión ∝ I²; Lincoln mueve el N de 0.020 % a 0.036 % solo con la onda y el voltaje | Experimento de la §7 |
| H4b | El largo del arco es la perilla dominante | **PASA** (cualitativo), magnitud **INCIERTA** | 1.3–2.5 mg/s por mm contra 1.2–3.8 mg/s de toda la raíz; coincide con la práctica (Kobelco, Lincoln: arco corto, ventana de voltaje angosta) | Poros contra V a corriente fija (§7) |
| H4c | La nube del fundente es un canal con f_c ≈ 80–600 Hz: pulsos lentos con pico alto meten aire y los rápidos no | **INCIERTO** (predicción nueva) | Pulso 130/10: pico/G = 1.49 si la nube no sigue, 0.46 si sigue; el campanazo de 668 Hz queda arriba de la banda | Mismo pulso a 100 Hz y a 1 kHz (§7) |
| H5a | Un campo transversal u oscilante mejora la protección | **FALSA** | Unos mT tuercen el arco 20–85°, el arco se alarga y entra más aire | Cordón con la pinza de tierra en un extremo contra centrada: los poros siguen al lado alargado |
| H5b | Un campo axial (giro) mejora la protección | **FALSA** (predicción), con signo **INCIERTO** | S > 0.6 desde 3 mT: rompe el vórtice y arrastra más; a favor solo tiene agitar el charco (en Al baja la porosidad por H, otro mecanismo) | Bobina de 12 vueltas en serie (20 mT): poros con y sin ella |
| H6a | La protección del E71T-GS es química (fluoruros, Al, Mg, Li) más un arco corto | **PASA** (literatura) | Patentes: CaF₂ forma escoria y protege, Al desoxida y desnitrura (AlN), Mg desoxida y protege con su vapor, LiF/BaLiF₃ contra el N; Sieverts: diluir 10 veces el aire baja el N solo 3.2 veces | — |
| H6b | DCEN es la polaridad correcta | **PASA** (el fabricante lo dice), mecanismo **INCIERTO** | Distribuidores: DCEN; Zhang 2022: en DCEP el centro del arco tiene más T y n_e que en DCEN con los mismos parámetros | 2 cordones DCEN contra DCEP: poros |
| H6c | Se puede imprimir capa sobre capa con E71T-GS sin consecuencias | **FALSA** | Desde la 3.ª capa queda Al ≈ 1.75–1.8 % sin diluir (el alambre es de UNA pasada) y la escoria queda atrapada si no se quita | Corte transversal de un muro de 6 capas: inclusiones y dureza |

**Lente del operador.** El arco es un canal ionizado que sí responde a los campos, por la fuerza j×B. Ese es su canal selectivo. El gas de alrededor no tiene canal propio: el parámetro de Hall es ≪ 1, es cuasi-neutro y su carga muere en ns. Por el postulado de canal, ningún campo externo lo direcciona directamente. Su único acoplamiento es la bomba del propio arco: presión ∝ I², caudal ∝ I^1.5 y alcance ∝ L.

La atmósfera del fundente es un canal más, con su propia banda (DC hasta unos cientos de Hz). Ya hay un mapa de canales separados por frecuencia:

| Canal | Banda | Actuador |
|---|---|---|
| volumen de la gota (l = 0) | DC | ⟨I⟩ |
| atmósfera | < f_c ≈ 80–600 Hz | ⟨I^1.5⟩, L |
| soltar la gota (l = 2) | 668 Hz | I a ω₂ |
| chorro | hasta ~10 kHz | — |

El campanazo cae arriba de la banda de la atmósfera, así que la nube solo ve su promedio: +28 % en ⟨I²⟩ y +11 % en la bomba. Como el actuador I² mezcla los canales, toda onda con pico alto y lenta contamina el canal de la atmósfera. Esto es una predicción que el banco tiene que confirmar, no un hecho.

## 6. Qué cambia

- **Quita** de la lista de ideas y de componentes: fuente de alto voltaje, electrodos de corona, imanes o bobinas «de confinamiento». No hacen falta y estorban.
- **Firmware, modo atmósfera:**
  1. El objetivo primario es el **arco más corto que sea estable**. Usa el voltaje de arco que ya mide (el balance volt-segundo) con un tope de V_min + 1–2 V.
  2. Registra por cordón ⟨I⟩, I_rms, ⟨I^1.5⟩, V medio y la fracción del tiempo en corto. Es la telemetría para correlacionar con los poros.
  3. Regla provisional, hasta que el experimento la confirme: **prohibido un pico mayor de 2.5 veces ⟨I⟩ a menos de ~700 Hz**. El campanazo (70 A de pico, 668 Hz) pasa; un pulso de 130/10 A a 100 Hz no.
- **Banco:**
  - Pinza de tierra junto al cordón, o doble y simétrica, para evitar el soplo de arco (0.8 mT ya lo tuercen 20–35°).
  - El choque de 41 µH a más de 15 cm de la antorcha, con su eje perpendicular a ella y lejos del ACS758 (dentro tiene 18 mT a 40 A).
  - Si se usa la bobina de «apuntar» de 3 mT, hay que contar con que también tuerce el arco 50–70°.
- **Proceso:**
  - DCEN, con CTWD de ~10 mm (3/8"). La ficha XTRweld para E71T-GS de 0.030" da 130 A, 16 V, 215 IPM y 3/8".
  - Sin viento cruzado sobre el arco.
  - **Quitar la escoria con cepillo de alambre en cada capa.**
  - Aceptar que la pieza impresa tendrá Al ≈ 1.8 %: sirve para demostrar, no para una pieza estructural.
- **Agrega** a la lista de componentes:
  - **Extractor de humo** que jale desde atrás o arriba y nunca sople sobre el arco: un ventilador con filtro y un ducto. Es el elemento de seguridad real, para 6–12 g/h de humo con fluoruros y Mn.
  - Cepillo de alambre.
- **Calibrar la ley V–L.** Con 10 V/mm, los 16 V de la ficha darían L = 0.2 mm. Si el gradiente real fuera de ~2 V/mm, darían L = 1 mm. El tope de voltaje del firmware depende de esto: mide L con la foto a través del vidrio de careta.

## 7. El experimento más barato que lo decide

**«Poros contra largo de arco y contra la frecuencia del pulso», sobre una placa de 100×50×3 mm.** Necesita el circuito, el alimentador y el cepillo; nada nuevo.

- **Montaje:**
  - DCEN, CTWD de 10 mm, misma velocidad de avance.
  - ⟨I⟩ = 40 A en todos los cordones, para que la fusión y el vapor G sean iguales.
  - Cordones de 25 mm.
- **Matriz de 12 cordones en 2 placas:** 3 voltajes (V_min, V_min + 2 V, V_min + 4 V) por 4 ondas:
  - (a) DC 40 A;
  - (b) campanazo 40 ± 30 A a 668 Hz;
  - (c) pulso de 130/10 A al 25 % a **100 Hz**;
  - (d) el mismo pulso a **1 kHz**.
- **Medir:** cepillar, contar los poros superficiales, limar 0.5 mm y volver a contar. Con la lupa del celular basta. Registrar ⟨I⟩, I_rms y V medio.

**Predicción si el modelo es cierto:**

1. **H4b:** los poros crecen con V en las cuatro ondas, y V es la variable dominante.
2. **H4c:** a igual V, (a), (b) y (d) dan lo mismo dentro del ruido, porque solo cambia el promedio (+3 a +13 % de aire). En cambio, (c) a 100 Hz sale porosa ya desde V_min (pico/G = 1.49 y L_max en el pico ≈ 0.1 mm).
3. El campanazo no es peor que DC (pico/G = 0.91 < 1).

**Si es falso:**

- Si (c) a 100 Hz sale igual que (d), la nube sigue al pico (el límite «G instantáneo», 0.46): la forma de onda es libre para la gota y **solo importa V**. Es buena noticia: la onda queda entera para el canal de la gota.
- Si los poros no cambian con V dentro de ±4 V, la protección la domina la química y la palanca del largo de arco es débil. Entonces el control está en la composición (otro alambre) y no en el circuito.
- Si salen poros incluso en V_min con DC, falta algo más (polaridad, CTWD, humedad del alambre). Repetir 2 cordones en DCEP y con CTWD de 15 mm.

## 8. Fuentes

- Lincoln Electric, US8759715 B2, *Method of AC welding with cored electrode* (NR-233; N de 0.020 % a 0.036 % con onda y voltaje; arco corto = menos exposición; Al del 5 al 20 % del relleno): https://patents.google.com/patent/US8759715B2/en
- P. F. Mendez y col. (2000), *Scaling of the cathode region of a long GTA welding arc* (Tabla 3: velocidades numéricas; la expresión de Maecker sobreestima): https://sites.ualberta.ca/~pmendez/Publications/Papers/2000ices.pdf
- Kobelco, OW-S50P (porosidad fuera de la ventana de voltaje y largo de arco): https://kobelco-welding.jp/products/product-spotlight/spotlight06.html
- Patente CA 2553062 (un arco corto limita la contaminación atmosférica en alambres autoprotegidos): https://brevets-patents.ic.gc.ca/opic-cipo/cpd/eng/patent/2553062/summary.html
- BJUT, *Influence of O, N and H on porosity in SSFCW* (O y N, no H, causan la porosidad): https://journal.bjut.edu.cn/bjgydxxb/en/article/id/a0eb1204-c4c3-4a65-ac0e-41c5a0a2769f
- Patente US 11318567, *Flux-cored wire* (CaF₂ escoria y protección, Al desoxida y desnitrura, Mg desoxida y protege; LiF y BaLiF₃): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/11318567
- US4571480A, *Flux cored wire electrodes for self-shielded arc welding*: https://patents.google.com/patent/US4571480
- Montanuniversität Leoben, desnitruración en alambres autoprotegidos: https://pureadmin.unileoben.ac.at/portal/files/1849735/AC06831353n01vt.pdf
- E71T-GS: «S» = una pasada; Al máximo 1.8 %: https://materialwelding.com/e71t-gs-welding-wire/
- XTRweld E71T-GS 0.030" (130 A, 16 V, 215 IPM, 3/8"): https://www.alliancemro.com/SP71TGS0302-XTRweld-E71T-GS-Filler-Metal-2-LB-Carbon-Steel-0030-Inch-Dia
- Airgas, autoprotegido en DCEN: https://www.airgas.com/product/Welding-Products/Filler-Metal/Tubular-Wires-%28FCAW%29/Tubular-Wires---Carbon-Steel-Self-Shielded/p/ESA242201812
- Zhang y col. (2022), *Spectroscopy and Spectral Analysis* 42(12) 3917 (FCAW-S: en DCEP, más T y n_e en el centro que en DCEN; distribución de Al y Mg): https://researching.cn/articles/OJ22851b72a2bde70f
- Pehlke y Elliott, solubilidad del N en Fe líquido (~0.044 % a 1600 °C y 1 atm; cumple Sieverts): https://onemine.org/documents/iron-and-steel-division-solubility-of-nitrogen-in-liquid-iron-alloys-1-thermodynamics
- Dogariu, Shneider y Miles, captura de electrones en aire 0.76×10⁸ s⁻¹: https://collaborate.princeton.edu/en/publications/versatile-radar-measurement-of-the-electron-loss-rate-in-air/
- Recombinación de 3 cuerpos ~9×10⁻²⁷ T_e^−4.5 cm⁶/s (NRL), citada en: https://arxiv.org/pdf/1403.0637
- Moreau y col., viento iónico de corona positiva y negativa: https://hal.archives-ouvertes.fr/hal-02316831
- Chinese Physics B 28 (2019) 075202, viento iónico (la positiva es más rápida): https://cpb.iphy.ac.cn/article/doi/10.1088/1674-1056/28/7/075202
- Chen y Davidson (2003), ozono en corona negativa (~10 veces la positiva): https://doi.org/10.1023/A:1023235032455
- AWS D1.1: viento máximo de 8 km/h (5 mph) para procesos con gas: https://materialwelding.com/maximum-wind-velocity-in-welding-area/ ; guía de 30–40 km/h para autoprotegidos (UFC): https://buildingcriteria1.tpub.com/ufc_3_320_01a/ufc_3_320_01a0064.htm
- Campo magnético longitudinal en GMAW de aluminio (gira el arco, agita el charco, baja la porosidad por H): https://link.springer.com/content/pdf/10.1007/s10853-022-08096-6.pdf
- Inclusiones de escoria en DED con alambre tubular y martillado ultrasónico: https://katalog.lib.cas.cz/KNAV/EdsRecord/edsdoj,edsdoj.8738cacc1b148a390c027008435097c
- WSU, WAAM sin gas con E71T1-8 autoprotegido (resumen): https://rex.libraries.wsu.edu/esploro/outputs/doctoral/HUMAN-INSPIRED-WIRE-ARC-ADDITIVE-MANUFACTURING-WITHOUT/99901195339401842
- De memoria, sin verificar en línea: funciones de partición, NO de Zeldovich, coeficientes radiativo, disociativo e ion-ion, secciones eficaces σ_en y σ_in, chorro laminar de Schlichting (ṁ = 8πµx), D_N en Fe líquido, umbral de giro S ≈ 0.6, rendimiento de ozono, generación de humo de FCAW-S del 1–2 %.
