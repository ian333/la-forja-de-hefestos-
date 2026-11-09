# 07 · El charco como segunda campana

**Script:** `scripts/investigacion-arco/07_charco_resonante.py` → `07_charco_resonante.out`. Corre en ~80 s en la laptop, con semillas fijas, y reproduce todos los números de este reporte.

## 1. La pregunta

El charco también suena. ¿A qué frecuencia lo hace en nuestro proceso? ¿Se ve en V(t)? ¿Conviene que la gota caiga en una fase dada? ¿Sirve como sensor de ancho, altura, temperatura y penetración? ¿Se estorban las dos campanas (la gota y el charco) en el mismo cable?

## 2. Respuesta corta

- **El charco es una campana medida y con fórmula** (Xiao & den Ouden 1990/1993, verificada contra sus datos con un error de 10–25 %):
  - charco parcial: f = 5.84·√(γ/ρ)·D^−3/2, que da 100–400 Hz en GTA;
  - charco total: f = 1.08·√(γ/(ρ_s·H))/D_eq, que da 25–80 Hz, cae de golpe (×3–6) y suena ×2.5 más fuerte.
- **En nuestro proceso el charco es chico, así que suena agudo.** Según Rosenthal, sobre la placa de 3 mm a 40–60 A y 6 mm/s:
  - ancho 2.5–3.7 mm, profundidad 1.3–2.1 mm, parcial;
  - modo 1 a **310–680 Hz**, modo 2 a 180–400 Hz.
  - A 3 mm/s y 50–60 A **perfora la placa** y el charco baja a 24–47 Hz.
  - Pared de 3 mm: según qué modo se excite, de 4 a 520 Hz (**INCIERTO**).
- **Cada gota golpea el charco con 20–200 µm** (nominal 60 µm). Con los 10 V/mm de ian eso es 0.2–2 V en el arco; con el gradiente típico de la literatura (~1.5 V/mm) sería ~0.09 V.
  - La salpicadura por impacto **no existe**: We = 0.4–4 y K = 3–12, contra un umbral de ~2000.
  - Sincronizar no quita salpicadura de impacto. Lo que quita son **cortos**:
    - soltar la gota en el VALLE del charco (aterriza ~¼ de periodo después, con el charco subiendo, y lo frena) baja la cresta al soltar de +41 µm a −15…−20 µm con Q = 10, y de +162 µm a −19…−26 µm con Q = 30;
    - eso equivale a 0.6–1.9 V de hueco de arco.
  - Regla barata: **f_charco/f_gotas = n + ½, nunca un entero** (un entero bombea ×1.6–5.3).
  - Solo vale si el Q del charco es ≥ 10. Con Q = 3 no cambia nada.
- **Las dos campanas se separan en el actuador (I²), pero NO siempre en el sensor.**
  - **Charco grave:** un charco de 1 V a 250 Hz **mata el oído del canon**: 0 % de gotas sueltas. Un pasa-altos Butterworth de 4º orden a 450 Hz lo arregla (2.7 µm).
  - **Charco agudo:** si el charco suena a 550 Hz, encima de f₂ (esto pasa con charcos de 2.5–3.5 mm), el pasa-altos no sirve: solo se suelta el 22 % de las gotas.
  - **El límite:** el oído escucha 3 ms, y en 3 ms no se separan dos tonos a menos de ~330 Hz.
- **El charco SÍ se puede leer debajo de la gota**, aunque en la FFT cruda no se vea (0.067 V aparentes contra 0.82 V reales). El truco es usar los instantes de golpe y la fase de la ráfaga, que los pone el firmware.
  - Con eso se mide f_p a ±0.3–3.5 Hz (sesgo de ~1 %) en ventanas de 5 gotas (67 ms).
  - Eso da el ancho a ±14–43 µm y T₀ a ±4–17 K (en simulación).
  - La altura de capa la da el DC del arco, no el charco (1 V por cada 0.1 mm).

## 3. Método

**Fuentes primarias leídas completas** (PDFs del archivo de Welding Journal; URLs en §8):
- Xiao & den Ouden 1990 y 1993;
- Hermans & den Ouden 1999;
- Kotecki, Cheever & Howden 1972;
- Renwick & Richardson 1983;
- Ebrahimi et al. 2021 (arXiv).

Maruo & Hirata 1993 está en japonés; su ecuación la tomé de Ebrahimi (ec. 30–33).

**Modelos (todos en el script):**

| bloque | modelo | supuestos |
|---|---|---|
| frecuencias | Xiao & den Ouden: parcial ω² = γk³/ρ, k = c/D (modo 1 c = 11.04, modo 2 c = 7.66); total = membrana de dos caras (= Maruo & Hirata); casquete sésil = Rayleigh l = 2; chapoteo largo = dispersión capilar-gravedad con fondo | γ = 1.0 (Xiao) y 1.5 (canon); ρ = 7000 |
| tamaño del charco | Rosenthal 3D con imágenes (placa de 3 mm, loseta adiabática); Rosenthal 2D en semiplano (pared); punto fijo transitorio con erfc | k = 30 W/mK, α = 5.7e-6, T_f = 1500 °C, η = 0.8, V = 18 V; ±30 % cerca de la fuente |
| Q | cota viscosa: Lamb + capa límite en la pared | lo real es más bajo; **se supone Q = 10 (rango 3–30)** |
| patada de la gota | impulso m·v sobre la masa modal ρ⟨ψ²⟩S/k; proyección del volumen nuevo; escalón de presión µ0·I²/8π | ⟨ψ²⟩ = 0.25, v = 0.3–1 m/s; la gota pesa ~70 % de la masa modal, así que el modelo lineal se rompe |
| sincronía | oscilador exacto entre golpes; tren de golpes; control que suelta en el valle | vuelo 1 ms, jitter 0.1 ms |
| dos campanas | (G1) COPIA del modo «oído» de `canon_gota.py`, más el tono del charco, más un pasa-altos causal; (G2) V(t) sintético (diente de sierra + ráfaga a f₂ + gota nueva timbrando a 1.66 kHz + charco + ruido) y un estimador por mínimos cuadrados de 5 ciclos; (G3) tabla de mezcla de I² | ruido blanco 10–300 mV |

**Lente del operador.**
- **Dos canales en el mismo cable:** V(t) = DC (altura) ⊕ peine a f_d (diente de sierra de la gota) ⊕ campana de la gota (668–1268 Hz) ⊕ campana del charco.
- **Postulado de canal:** un canal existe solo si hay un selector.
  - En frecuencia, el selector exige Δf·T ≥ 1.
  - Cuando eso no alcanza, el selector puede ser la **fase conocida**: el firmware sabe cuándo pega cada gota y con qué fase empuja la ráfaga.
- **El estado z = q + i·q'/ω del charco gira entre golpes, y cada golpe es un salto sobre el eje de la velocidad.**
  - Si el golpe va en contra de la velocidad, frena.
  - Si va a favor, bombea.
- **I² mezcla:** la corriente base I₀ es la portadora que vuelve lineales a los dos canales (2·I₀·I₁ para la gota, 2·I₀·I_p para el charco).

## 4. Resultados (telemetría cruda del `.out`)

### 4.1 Las fórmulas contra sus propios datos

| fuente | medido | fórmula γ = 1.0 | γ = 1.5 | γ que lo clava |
|---|---|---|---|---|
| Xiao 1990, parcial, D = 3.7 mm | 330 Hz | 310 | 380 | 1.13 |
| Xiao 1990, parcial, D = 9.9 mm | 80 Hz | 71 | 87 | 1.27 |
| Renwick 1983, parcial, 3.73–7.21 mm | 130–393 Hz | 114–306 | 140–375 | ~1.3–1.6 |
| Kotecki 1972, total, Fe, 1.27 mm, F-2 | 69.0 Hz | 50.4 | 61.8 | 1.8 (Fe puro) → 67.7 |
| Kotecki 1972, total, F-4 | 45.7 Hz | 35.2 | 43.1 | 1.8 → 47.2 |
| Xiao 1993, en movimiento | parcial 336→204 Hz, total 100→37 Hz | — | — | — |
| Hermans 1999, GMAW-S | f_corto = f_charco hasta ~150 Hz → ancho de 5.8 mm | — | — | γ = 0.9 |

Más datos de la literatura:
- **Amplitud medida:** parcial ~100 mV, total ~250 mV, con E ≈ 1 V/mm, que corresponde a ~0.1 mm de superficie (Xiao 1990). Renwick midió ~1 V pico a pico con E ≈ 0.8 V/mm (en helio, V = 20.36·h[in] + 6.39).
- **Penetración:** la transición ocurre cuando el fondo fundido mide ~H/2 (Xiao 1993) o ~1.2·H (Xiao 1990, estacionario).

### 4.2 Tamaño del charco y frecuencias en NUESTRO proceso (placa de 3 mm)

| I A | v mm/s | T₀ °C | L mm | W mm | prof mm | total | f modo 1 (γ 1.0 / 1.5) | f modo 3 |
|---|---|---|---|---|---|---|---|---|
| 40 | 6 | 25 | 3.1 | 2.50 | 1.28 | no | 558 / 684 | — |
| 50 | 6 | 25 | 3.9 | 2.90 | 1.53 | no | 447 / 547 | — |
| 60 | 6 | 25 | 4.7 | 3.40 | 1.80 | no | 352 / 431 | — |
| 50 | 6 | 400 | 5.4 | 3.60 | 2.05 | no | 323 / 396 | — |
| 40 | 3 | 25 | 4.0 | 3.40 | 1.85 | no | 352 / 431 | — |
| 50 | 3 | 25 | 5.4 | 4.10 | 3.00 | **SÍ** (fondo 1.3) | — | 47 |
| 60 | 3 | 25 | 7.2 | 5.00 | 3.00 | **SÍ** (fondo 3.7) | — | 37 |
| 60 | 6 | 400 | 6.9 | 4.20 | 3.00 | **SÍ** (fondo 1.4) | — | 41 |

El modo 2 (chapoteo de adelante hacia atrás, el que forma joroba según Xiao 1993) suena a 0.58× el modo 1. Las 27 combinaciones están en el `.out`, sección B1.

**Pared de una gota** (720 W, 6 mm/s; Hz con γ = 1.5):

| w mm | T₀ °C | L mm | prof mm | modo 1 D = w | modo 1 D_eq | modo 2 D_eq | chapoteo largo | casquete sésil l = 2 |
|---|---|---|---|---|---|---|---|---|
| 3.0 | 25 | 9.3 | 2.18 | 520 | 224 | 129 | 14 | 113 |
| 3.0 | 400 | 16.5 | 3.08 | 520 | 145 | 84 | 7 | 113 |
| 3.0 | 600 | 24.5 | 3.85 | 520 | 108 | 62 | 4 | 113 |
| 4.0 | 25 | 5.2 | 1.53 | 338 | 278 | 160 | 31 | 74 |

### 4.3 Q y voltaje

| D mm | modo 1 (γ 1.5) | modo 3 (H = 3) | Q, cota viscosa | τ del timbre con Q = 10 |
|---|---|---|---|---|
| 3 | 520 Hz | 91 Hz | 34 | 6.1 ms |
| 4 | 338 Hz | 68 Hz | 38 | 9.4 ms |
| 6 | 184 Hz | 45 Hz | 44 | 17.3 ms |

- La cota viscosa de Q es 29–48. Lo real tiene que ser menor: zona pastosa, Marangoni, línea de contacto y **la escoria del E71T-GS**, que no está modelada. Kotecki: «cada perturbación deja unas pocas ondas antes de apagarse».
- Superficie → voltaje: 10 µm → 100 mV (10 V/mm) / 15 mV (1.5 V/mm); 100 µm → 1.0 V / 0.15 V. El ADC con divisor /16 da 7.8 cuentas por cada 100 mV.

### 4.4 La patada de cada gota (cordón a 50 A, 6 mm/s)

**Datos:**
- **Charco:** W = 2.9 mm, f₁ = 547 Hz, masa modal 4.0 mg.
- **Gota:** 2.85 mg, el 71 % de la masa modal del charco.

**Cada fuente de excitación:**

| fuente | amplitud |
|---|---|
| impacto a 0.3 / 0.6 / 1.0 m/s | 62 / 124 / 206 µm |
| volumen nuevo proyectado (cota superior) | 186 µm |
| escalón de I² en la ráfaga (40 A + 30 A ac) | 22 µN → **0.5 µm** estático: despreciable |
| We / Re / K = We^½·Re^¼ a 0.3–1.0 m/s | 0.4–4.3 / 322–1073 / 2.6–11.9 → **no salpica** |

Para lo que sigue se usó **A1 = 60 µm**. Si el valor real es otro, todas las amplitudes escalan linealmente.

### 4.5 Sincronía gota–charco

**Tren de golpes iguales** (amplitud estacionaria tras cada golpe, en unidades de A1):

| f_p/f_d | Q = 3 | Q = 10 | Q = 30 |
|---|---|---|---|
| 2.00 | 1.14 | 2.14 | 5.29 |
| 2.50 | 0.93 | 0.69 | 0.57 |
| 3.00 | 1.05 | 1.64 | 3.71 |
| 3.50 | 0.98 | 0.75 | 0.59 |
| 4.00 | 1.02 | 1.40 | 2.92 |

**Simulación** (Q = 10 salvo donde se indica, A1 = 60 µm). La cresta es la altura del charco en el instante de soltar; positiva significa hacia la gota:

| f_p | f_d | razón | modo | RMS z | cresta media | cresta máx | dispersión de volumen |
|---|---|---|---|---|---|---|---|
| 225 | 75 | 3.00 | libre | 46.5 µm | **+40.5** | +41.4 | 0.7 % |
| 225 | 75 | 3.00 | fase | 20.9 µm | **−19.9** | −15.1 | 0.9 % |
| 262.5 | 75 | 3.50 | libre | 20.6 µm | −16.0 | −14.0 | 0.7 % |
| 300 | 75 | 4.00 | libre | 36.2 µm | +23.9 | +25.8 | 0.7 % |
| 300 | 75 | 4.00 | fase | 20.9 µm | −16.2 | −13.5 | 0.8 % |
| 225 (Q = 30) | 75 | 3.00 | libre | 130.6 µm | **+162.4** | +166.6 | 0.7 % |
| 225 (Q = 30) | 75 | 3.00 | fase | 21.1 µm | **−26.3** | −19.0 | 4.5 % |
| 225 (Q = 3) | 75 | 3.00 | libre / fase | 17.9 / 17.7 µm | +3.4 / −5.2 | | 0.7 / 0.9 % |

- **Hueco para no hacer corto al soltar:** L₀ > q·a + cresta, es decir 0.46 mm + cresta.
  - Sin charco: V > 18.6 V.
  - Con una cresta de 120 µm: V > 19.8 V.
- **Hallazgo cruzado para el cañón:** la punta de la gota en q = 1 ya se come 0.46 mm de un arco de 0.4–0.6 mm, aun sin el charco. El margen es delgado.

### 4.6 El charco como sensor

| caso | f a T₀ = 25 / 200 / 400 °C | sensibilidad |
|---|---|---|
| placa, 50 A, 6 mm/s, modo 1 | 547 / 472 / 396 Hz | −7.8 %/100 K |
| placa, 40 A, 6 mm/s, modo 1 | 684 / 609 / 495 Hz | −6.2 %/100 K |
| pared de 3 mm, modo 1 D_eq | 224 / 185 / 145 Hz | −9.8 %/100 K |
| pared de 3 mm, chapoteo largo | 11 / 8 / 5 Hz | −19 %/100 K |

Relaciones útiles:
- **Ancho:** dD/D = −(2/3)·df/f. Si γ tiene ±20 % de incertidumbre, el valor absoluto de D queda a ±7 %, así que hay que calibrar con un cordón medido. La tendencia no depende de γ.
- **Altura:** h = V̇/(v·w), con 25 mm³/s, 6 mm/s y w = 3.0 mm, da 1.39 mm. Si w se lee a ±2 %, h queda a ±28 µm.

### 4.7 Dos campanas en el mismo cable

**G3 · El actuador I² mezcla, pero cada campana tiene su canal.** Respuesta = A² × ganancia de resonancia; la gota a f₂ = 668 Hz con Q = 30, el charco a 250 Hz con Q = 10:

| término | f Hz | A² | respuesta de la gota | respuesta del charco |
|---|---|---|---|---|
| 2·I₀·I₁ @f₂ | 668 | 2400 | **72000** | 391 |
| 2·I₀·I_p @f_p | 250 | 400 | 465 | **4000** |
| I₁·I_p @f₂−f_p | 418 | 150 | 246 | 83 |
| I₁·I_p @f₂+f_p | 918 | 150 | 169 | 12 |

Los términos cruzados quedan a ≥ 30 dB. No hace falta un pulso propio para excitar el charco: la gota ya es el martillo (60 µm, contra ~4 µm de un vaivén de 5 A en resonancia).

**G1 · El oído del canon con el charco sonando** (Q gota = 30, ruido de 10 mV, 40 gotas por caso; HP = Butterworth de 4º orden a 450 Hz):

| charco | filtro | sueltan | tamaño | dispersión | error |
|---|---|---|---|---|---|
| nada | — | 100 % | 0.465 mm | 1.8 µm | +5.5 µm (= canon) |
| 30 µm @250 Hz | — | 100 % | 0.466 | 3.9 | +5.9 |
| 30 µm @250 Hz | HP | 100 % | 0.466 | 2.3 | +5.8 |
| **100 µm (1 V) @250 Hz** | — | **0 %** | — | — | — |
| 100 µm @250 Hz | HP | 100 % | 0.467 | 2.7 | +6.9 |
| **30 µm @550 Hz** | HP | **22.5 %** | 0.469 | 7.1 | +9.3 |
| 30 µm @550 Hz | HP + veto | 35 % | 0.466 | 4.8 | +5.9 |
| 100 µm @550 Hz | HP + veto | 40 % | 0.537 | 11.5 | +77.4 |
| 10 µm @550 Hz | HP | 85 % | 0.466 | 5.9 | +6.4 |
| 3 µm @550 Hz | HP | 100 % | 0.466 | 4.1 | +6.2 |

Dentro de la banda de la gota, el oído tolera ~3 µm (30 mV). Restar el modelo del charco tendría que dar 20–30 dB.

**G2 · Leer el charco con la gota sonando encima.**

*Espectro crudo de V(t)*, con el charco a 250 Hz y 82 µm reales (0.82 V):

| banda | amplitud |
|---|---|
| f_d = 75 Hz | 1.28 V |
| 2·f_d | 0.72 V |
| 3·f_d | 0.68 V |
| **charco, 240–260 Hz** | **0.067 V** |
| ráfaga de la gota | 1.22 V |
| gota nueva (1.66 kHz) | 0.22 V |

El charco, golpeado cada 13 ms, no es un tono: reparte su energía en el peine de f_d. Por eso la FFT no lo ve, y Hermans («prácticamente imposible en GMAW por las gotas») tenía razón para el voltaje crudo.

*Estimador con instantes de golpe y fase de ráfaga conocidos*, ventana de 67 ms:

| f_p | ruido | sesgo | dispersión | D ± | T₀ ± |
|---|---|---|---|---|---|
| 150 | 30 mV | +0.10 Hz | 0.45 Hz | 14 µm | 4 K |
| 150 | 300 mV | −0.60 | 0.85 | 32 µm | 9 K |
| 250 | 30 mV | +2.60 | 0.41 | 34 µm | 14 K |
| 250 | 300 mV | +2.20 | 2.50 | 43 µm | 17 K |
| 400 | 300 mV | +3.30 | 2.20 | 24 µm | 13 K |
| 550 | 300 mV | +2.10 | 3.51 | 14 µm | 10 K |

El sesgo de +2–4 Hz (~1 %) se calibra. El método separa el charco aunque suene a 550 Hz, encima de la gota, porque la gota va guiada por una fase conocida y el charco timbra libre.

### 4.8 Predicción del punto fijo (placa de 3 mm sobre loseta)

| I | t | D arriba | prof | D fondo | modo | f (γ 1.0 / 1.5) | V pico |
|---|---|---|---|---|---|---|---|
| 40 A | 0.25 s | 2.12 | 1.08 | 0 | 1 | 715 / 876 Hz | 0.6 V |
| 40 A | 1 s | 2.88 | 1.48 | 0 | 1 | 452 / 553 | 0.6 V |
| 40 A | 2 s | 3.40 | 1.86 | 0 | 1 | 352 / 431 | 0.6 V |
| 40 A | 4 s | 4.16 | 2.84 | 0 | 1 | 260 / 319 | 0.6 V |
| 40 A | 6 s | 4.76 | 3.00 | 2.84 | **3** | **59 / 72** | 1.5 V |
| 50 A | 1 s | 3.36 | 1.78 | 0 | 1 | 358 / 439 | 0.6 V |
| 50 A | 3 s | 4.64 | 3.00 | 2.36 | **3** | **64 / 78** | 1.5 V |

Diámetros y profundidades en mm. Rosenthal exagera cerca de la fuente, así que los tiempos van a ±30 %.

## 5. Veredictos

| # | hipótesis | veredicto | qué lo decide |
|---|---|---|---|
| H1 | El charco es una campana cuya f depende del tamaño (parcial ∝ D^−3/2, total ∝ 1/D) | **PASA** en la literatura (4 grupos, ±10–25 %) | — |
| H2 | En NUESTRO proceso suena a 260–880 Hz (parcial) y a 40–80 Hz (total) | **INCIERTO**: γ, la escoria y el modo excitado no están medidos | el punto fijo (§7) |
| H3 | Se ve en V(t) con amplitud útil (0.2–2 V con 10 V/mm) | **INCIERTO**; si E es en realidad ~1.5 V/mm, son 30–300 mV y sigue siendo legible | el anillo tras cada golpe |
| H4 | Sincronizar reduce la salpicadura por impacto | **FALSA**: We ≤ 4 y K ≤ 12, contra un umbral de ~2000 (dato de memoria) | — |
| H5 | Soltar en el valle (aterrizando en la subida) reduce cortos y agitación | **PASA** en el modelo si Q_p ≥ 10 (cresta de +41/+162 → −20/−26 µm; 0.6–1.9 V de hueco); **FALSA** si Q_p ≤ 3 | Q_p medido |
| H6 | Sincronizar mejora la altura de capa | **FALSA en lo importante**: las ondas quedan separadas v/f ≈ 20 µm y miden decenas de µm (≤ 2–3 % de la capa); la altura la ponen el balance de masa y el calor | — |
| H7 | f_p mide el ancho | **PASA** en simulación (±14–43 µm por ventana de 67 ms, tras calibrar γ) | punto fijo + calibre |
| H8 | f_p mide la altura | **FALSA** directo; el DC del arco lo hace mejor (1 V por 0.1 mm). Indirecto por balance de masa: sí | — |
| H9 | f_p es un termómetro de entrecapa | **PASA** en el modelo (−6…−10 %/100 K, ±4–17 K); **INCIERTO** en la práctica (confusores: γ(T) y calor de entrada) | serie de capas |
| H10 | Bandera de perforación (×3–6 de caída, ×2.5 de amplitud) | **PASA** en la literatura; predicho a 50 A, 3 mm/s, en la placa de 3 mm | punto fijo de 6 s |
| H11 | Las dos campanas se separan solas en frecuencia | **FALSA** para charcos chicos (W 2.5–3.5 mm → 400–700 Hz, encima de f₂); **PASA** si W ≥ 4 mm (f_p ≤ 340 Hz) con el pasa-altos | punto fijo: el cruce |
| H12 | Las campanas se acoplan por el actuador | **FALSA**: los cruces de I² quedan a ≥ 30 dB. Se acoplan por el hueco (cortos) y por el sensor | — |
| H13 | «Medir el charco con V es imposible en GMAW» (Hermans 1999) | **FALSA para nosotros** en simulación (instantes de golpe conocidos → ~1 %); **INCIERTO** hasta el banco | punto fijo |

## 6. Qué cambia

**Componentes.** Nada nuevo: el sensor del charco sale gratis del mismo cable de V y del mismo ADC. No se agrega un pulso propio para excitar el charco; la gota es el martillo.

**Firmware:**
1. **Pasa-altos de 4º orden a 450 Hz** (2 biquads) antes del lock-in de la gota. Sin él, un charco de 1 V a 250 Hz deja sin soltar todas las gotas. Cuesta ~2 MMAC/s a 200 kS/s.
2. **Guardia de cruce de campanas:** si |f_p − f₂| < 330 Hz, el oído de la gota no es confiable. En ese caso hay tres opciones, en orden:
   - (a) mover el punto de operación para que el charco quede en W ≥ 4 mm y f_p ≤ 340 Hz: menos velocidad o más corriente;
   - (b) restar el modelo del charco (G2), que exige 20–30 dB;
   - (c) escuchar más tiempo (10 ms → Δf ≈ 100 Hz), con menos pings.
3. **Estimador del charco** (G2): ventana de 5 gotas, con los instantes de golpe (detección de desprendimiento + 1 ms) y la fase de la ráfaga. Da f_p, Q_p y la amplitud.
   - En la etapa de banco, offline en la laptop. En la Pico, decimado a 4 kS/s con búsqueda local de ±10 Hz.
   - Salidas: ancho, bandera de perforación (f cae ×3) y tendencia de T₀.
4. **Regla de ritmo:** elegir la velocidad de alambre para que f_p/f_d ≈ n + ½. Nunca un entero.
5. **Soltar en el valle**, solo si se midió Q_p ≥ 10: retrasar o adelantar el disparo hasta ±T_p/2 para que la gota se suelte con el charco abajo. El costo es una dispersión de volumen de 0.9 % (Q = 10) a 4.5 % (Q = 30). Si Q_p ≤ 5, no hacer nada.
6. **Pared:** la altura se lee del DC. Entre capas, esperar hasta que f_p vuelva a su valor objetivo (termómetro de entrecapa).
7. **Hueco mínimo** sin sincronía: L₀ ≥ 0.46 mm + cresta, es decir V ≥ 19–20 V con 10 V/mm.

## 7. El experimento más barato que lo decide

**«Punto que crece».** Sin piezas nuevas; es el campanazo ya planeado, con la antorcha quieta.

1. Antorcha fija sobre la placa de 3 mm en la loseta. 40 A de base más la campana del canon (gotas de 0.46 mm, ~75/s).
2. Puntos de 0.25, 0.5, 1, 2, 4 y 6 s.
3. Registrar V(t) a ≥ 50 kS/s, junto con el instante de cada disparo y de cada desprendimiento.
4. Medir con calibre el diámetro arriba y abajo de cada punto, y ver si atrás hay mancha fundida.
5. Analizar offline con el estimador G2.

**Si es CIERTO:**
- f_p baja con el tamaño:
  - **700–880 Hz a 0.25 s;**
  - **450–550 Hz a 1 s;**
  - **350–430 Hz a 2 s;**
  - **260–320 Hz a 4 s.**
- Los pares (f, D) caen sobre f = 5.84·√(γ/ρ)·D^−3/2 con una sola γ_eff entre 1.0 y 1.6, a ±15 %.
- Hacia los ~6 s (a 50 A, hacia los ~3 s) aparece la mancha detrás y **f cae de golpe a 55–80 Hz con ~2.5× de amplitud**.
- Q_p, sacado del decaimiento del anillo, queda entre 3 y 30.
- **Firma extra:**
  - mientras f_p > ~340 Hz (los primeros ~2–3 s a 40 A), el charco cae dentro de 330 Hz de f₂: la dispersión de tamaño de la gota del oído empeora y luego se recupera;
  - hay máximos de amplitud cuando f_p pasa por múltiplos enteros de 75 Hz (375, 300 Hz), visibles solo si Q_p ≥ 10.

**Si es FALSO:**
- ninguna componente entre 80 y 800 Hz sigue a D;
- o agregar el modelo del charco baja el residuo menos de 3 dB (escoria con Q < 3, o un E real mucho menor).

En ese caso se descarta el charco como sensor, y la sincronía no importa: con Q = 3 la tabla del tren de golpes es plana.

**Solo si sale Q_p ≥ 10, segundo paso:** fijar la velocidad de alambre para que f_p/f_d = 3.0 contra 3.5 y contar los cortos (V < 15 V).
- Predicción con Q = 10: con razón entera, la cresta al soltar es de +40 µm y hay más cortos; con medio entero, de −16 µm.
- Con Q = 30 la diferencia es de ~190 µm, unos 1.9 V de hueco.

## 8. Fuentes

**Leídas completas:**
- Xiao, Y.H. & den Ouden, G. (1990). *A study of GTA weld pool oscillation.* Welding Journal 69(8):289s–293s. https://s3.amazonaws.com/WJ-www.aws.org/supplement/WJ_1990_08_s289.pdf
- Xiao, Y.H. & den Ouden, G. (1993). *Weld pool oscillation during GTA welding of mild steel.* Welding Journal 72(8):428s–434s. https://s3.amazonaws.com/WJ-www.aws.org/supplement/WJ_1993_08_s428.pdf · https://www.osti.gov/biblio/6328378
- Hermans, M.J.M. & den Ouden, G. (1999). *Process behavior and stability in short circuit gas metal arc welding.* Welding Journal 78(4):137s–141s. https://s3.amazonaws.com/WJ-www.aws.org/supplement/WJ_1999_04_s137.pdf · resumen de 1996: https://www.osti.gov/biblio/442977
- Kotecki, D.J., Cheever, D.L. & Howden, D.G. (1972). *Mechanism of ripple formation during weld solidification.* Welding Journal 51(8):386s–391s. https://s3.amazonaws.com/WJ-www.aws.org/supplement/WJ_1972_08_s386.pdf
- Renwick, R.J. & Richardson, R.W. (1983). *Experimental investigation of GTA weld pool oscillations.* Welding Journal 62(2):29s–35s. https://s3.amazonaws.com/WJ-www.aws.org/supplement/WJ_1983_02_s29.pdf
- Ebrahimi, A., Kleijn, C.R., Hermans, M.J.M. & Richardson, I.M. (2021). *The effects of process parameters on melt-pool oscillatory behaviour in GTAW.* https://arxiv.org/abs/2104.02713 (ec. 30–33 = el modelo de Maruo & Hirata).

**Vistas solo de forma parcial:**
- Aendenroomer, A.J.R. & den Ouden, G. (1998). *Weld pool oscillation as a tool for penetration sensing during pulsed GTA welding.* Welding Journal 77(5):181s. https://s3.amazonaws.com/WJ-www.aws.org/supplement/WJ_1998_05_s181.pdf (pulsos de disparo de 300 A × 3 ms; no usado en los números).
- Maruo, H. & Hirata, Y. (1993). *Natural frequency and oscillation mode of weld pool.* Q. J. Japan Welding Soc. 11(1):50. https://www.jstage.jst.go.jp/article/qjjws1983/11/1/11_1_50/_article (texto en japonés; la ecuación se tomó vía Ebrahimi).

**Citadas a través de reseñas, no leídas:**
- Andersen, K., Cook, G.E., Barnett, R.J. & Strauss, A.M. (1997). IEEE Trans. Ind. Appl. 33(2):464 (oscilación síncrona con PLL). Vía https://www.intechopen.com/chapters/41018
- Zacksenhouse & Hardt (1983/84), ASME JDSMC. Vía Xiao 1990.
- Yudodibroto et al. (2004), STWJ 9:163. https://research.tudelft.nl/en/publications/weld-pool-oscillation-during-gtaw-with-filler-wire-addition/
- Patente US 4,711,986 (f ≤ 300 Hz, se reduce a la mitad al perforar; visto solo en un fragmento de búsqueda): https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/4711986
- Bostwick & Steen (2014), JFM 760:5 (gotas sésiles con línea de contacto anclada). https://www.cambridge.org/core/product/identifier/S0022112014005825/type/journal_article

**De memoria, sin verificar:**
- el umbral de salpicadura K ~ 2000 (Cossali et al. 1997);
- dγ/dT del Fe ≈ −0.4 mN/m/K;
- el gradiente típico de 1–2 V/mm en arcos de GMAW. Los 10 V/mm de ian son ~10× la literatura (Xiao usa 1 V/mm; Renwick midió 0.8 V/mm en helio). Esto cambia los mV, no las frecuencias.
