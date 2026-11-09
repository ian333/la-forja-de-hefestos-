# 06 · Control absoluto desde el Operador Ian: el proceso como canales

**Script:** `scripts/investigacion-arco/06_operador_canales_control.py`. Su salida está en `06_operador_canales_control.out` (17 s en la laptop). Todos los números de este reporte salen de ese script.
**Marca [S]:** supuesto sin medir. Todo lo demás es cálculo sobre el canon o física estándar.

---

## 1. La pregunta

Con un solo cable de corriente (actuador I(t), sensores V(t) e I(t)), ¿qué canales del proceso se pueden controlar y observar? ¿Qué más hace falta para el «control absoluto»?

## 2. La respuesta corta

- **Un cable solo no alcanza para todo.** Con solo I el rango de Kalman es **8 de 13**. Quedan fuera dos cosas, y son pruebas exactas (no dependen de los números):
  - **El metal M = Aw·ls + Vd.** Su derivada es dM/dt = Aw·vf, y ninguna I(t) la cambia: la simulación da 10⁻¹⁵. El flujo de metal lo pone **solo el motor**. I decide en cuántas gotas se reparte.
  - **El modo l=1 (apuntar), x e y.** Hay simetría de giro. Ninguna I(t) elige la dirección: el plano del mecerse se queda en 30.000000° con dos corrientes aleatorias de 10–70 A. Además, x e y comparten valor propio (multiplicidad 2), y por PBH eso exige **dos actuadores independientes: dos bobinas**.
- **La mezcla I² no abre canales nuevos en rango, pero sí da un segundo mando de corriente continua.** Los corchetes de Lie tienen componente 0 sobre M y sobre l=1.
  - Pero ⟨I⟩ y ⟨I²⟩ son mandos distintos: forman 75.8° en el plano lento (stickout, temperatura).
  - En estado estacionario, **⟨I⟩/vf fija la temperatura de la punta, ⟨I²⟩ fija el stickout (el largo del arco) y vf fija el flujo**. El rango estacionario pasa de 2 a 3 (condición 97).
  - Verificado con simulación: con ⟨I⟩ = 40 A, al agregar 30 A de onda el stickout pasa de 12.81 a 10.00 mm y la temperatura queda en 105.6 °C.
- **Lo que V ve:**
  - El largo del arco, a <1 µm en 4 ms.
  - l=2, con un pico de 200–310 mV/A a Q = 30 (65–100 mV/A a Q = 10) sobre un piso de 25 mV/A.
  - l=3.
  - El charco, como un bulto de 39 mV/A cerca de 177 Hz [S].
  - **No ve l=1** a primer orden: con 0.8 mT de la pinza aporta 0.08 mV/A. Solo lo ve como |r|² a 2f1: 42 mV con 88 µm de mecerse lineal, 0 mV si gira en círculo.
- **V sola confunde la altura H, el stickout y la gota** (λ = 0 doble; 10 V/mm de arco contra 20 mV/mm de stickout). Se rompe con dos inyecciones en el **mismo cable**:
  - **Golpecito** de 10 A × 0.8 ms (el oído): la gota sale a 0.11 µm con 10 mV de ruido, o 3.3 µm con 0.3 V.
  - **Sonda** de 3 A a 5 kHz: separa stickout de altura a 0.2–0.7 mm (10 mV) o 7–20 mm (0.3 V) en 4 ms.
- **Conjunto mínimo para control absoluto:** actuadores I(t) con forma de onda libre + motor vf + **2 bobinas** (Bx, By); sensores **V e I, nada más**. Las bobinas sirven también de referencia para leer l=1 por homodino [S]. Sin apuntar basta **I + vf** con V, I.
- **La potencia manda.** Con 1200 W y 10 V/mm, el arco puede medir 1.50 mm a 40 A, 0.88 mm a 50 A y 0.45 mm a 60 A. **A 60 A la gota libre no cabe**: la ventana real es 40–45 A.

## 3. El método

**Modelo de estado (14 estados, SI)**, linealizado por paso complejo (exacto a precisión de máquina):

| estado | física | de dónde |
|---|---|---|
| ls (stickout) | dls/dt = vf − vm | canon (dL/dt = vfusión − valim) |
| Vd (l=0) | dVd/dt = Aw·vm | conservación de masa |
| h (temperatura del alambre libre) | dh/dt = ρe(h)I²/(Ac·Aw) − h·vf/ls (Joule en la vaina, lavado por tránsito) | estándar; ρe(T) del acero 0.142 → 0.85 µΩ·m |
| fusión | vm = Veq·I/(Aw(Hv − h)), balance de energía en la punta; en estado estacionario da Lesnewich (αI + βLI²) | Veq = 7.64 V, calibrado al canon (3 m/min a 40 + 30 A) |
| q2 (l=2) | canon: q'' + (ω/Q)q' + ω²(1 − βs)q = ω²(s + gravedad), s = (I/194)², β = 1, Q = 30 | canon |
| q3 (l=3) | igual con ω3² = 30σ/ρa³, proyección del pellizco g3 = 0.3 [S] | Rayleigh; g3 [S] |
| x1, y1 (l=1) | ω1 = 0.5ω2 [S], Q1 = 30 [S], fuerza 2a·I·B/m | canon |
| z (charco) | modo (0,1) capilar, R = 2 mm, profundidad 0.6 mm → 177 Hz, Qp = 5 [S], fuerza del arco 1.6×10⁻⁷ N/A² [S] | estándar; parámetros [S] |
| H | distancia punta → charco, perturbación | — |
| salida | V = 14 + 10 V/mm·La + (20 mΩ + ls·ρe/Ac)·I, con La = H − ls − a(2 + q2 + q3) + (x1² + y1²)/(2a) + z | 10 V/mm de ian, 20 mΩ del spice del canon; la subida del péndulo [S] |

Más supuestos [S]: la vaina del tubular conduce el 75 % de la sección; Hv = 12.56 J/mm³ (fundir + 500 K de sobrecalentamiento).

**Herramientas:**
- **PBH (Hautus) por valor propio.** Es robusto con modos poco amortiguados y cuenta los defectos por multiplicidad.
- **Gramianos** a horizonte finito, de 12 ms (una gota) y de 1 s, por eigen-descomposición.
- **Corchetes de Lie.** F es exactamente cuadrática en I: F = F0 + I·F1 + I²·F2, así que g1 = ∂F/∂I y g2 = ∂²F/∂I² salen exactos.
- **Invariantes exactos** verificados por simulación RK4.
- **Balance armónico** (promedio por ciclo) para los mandos de corriente continua, verificado con 40 s de simulación.
- **Información de Fisher** del V(t) no lineal a 500 kS/s (cota de Cramér-Rao) según la forma de onda inyectada.
- **Z(f) = dV/dI**: el mapa como lo ve el cable.

**Escalas («unidades de resolución»):** ls 0.1 mm · Vd 1 % · h 5 K · q 0.01 · l=1 10 µm · charco 1 µm · H 0.1 mm; I 1 A · vf 1 mm/s · B 0.1 mT; V 10 mV por muestra.

## 4. Resultados (telemetría)

### 4.1 Puntos de operación (sección B del .out)

| I0 A | vf mm/s | T punta °C | R_stickout mΩ | V con La = 1 mm | P W | La máx @1200 W | f2 (a = 0.40 mm) |
|---|---|---|---|---|---|---|---|
| 40 | 49.6 | 83 | 4.6 | 24.99 | 999 | **1.50 mm** | 806 Hz |
| 50 | 62.4 | 103 | 4.9 | 25.25 | 1262 | 0.88 mm | 796 Hz |
| 60 | 75.6 | 125 | 5.2 | 25.51 | 1531 | **0.45 mm** | 783 Hz |

La gota de 0.46 mm al soltarse ocupa ~1.38 mm. A 60 A no cabe: hay corto.

**Temperatura de la punta a 40 A según el stickout:** 49 °C (5 mm), 83 °C (10 mm), 175 °C (20 mm), 309 °C (30 mm). A 10 mm, Joule aporta solo 7 W; el arco hace ~95 % de la fusión.

### 4.2 Los canales: valores propios a 40 A, gota de 0.40 mm (sección C)

| canal | λ (1/s) | f | Q o τ | multiplicidad |
|---|---|---|---|---|
| l=0 volumen + H | 0 | — | integrador | **2** |
| alambre (ls) | −0.154 | — | **τ 6.5 s** | 1 |
| alambre (h) | −3.875 | — | τ 0.26 s | 1 |
| charco | −111 ± 1104j | 176 Hz | Q 5 [S] | 1 |
| l=1 | −43 ± 2587j | 412 Hz [S] | Q 30 | **2** |
| l=2 | −86 ± 5064j | 806 Hz | Q 29.4 | 1 |
| l=3 | −167 ± 9806j | 1561 Hz | Q 29.4 | 1 |

La autorregulación del arco en corriente constante es lenta: τ = 6.5 s.

**Z(f) a baja frecuencia** (promedio por gota):

| f | 0.1 Hz | 1 Hz | 10 Hz |
|---|---|---|---|
| \|Z\| | 21 V/A | 2.0 V/A | 0.20 V/A |

Fase ≈ −90°: 1 A de más quema 1.24 mm/s de alambre. **Con avance fijo el largo deriva**: hace falta un lazo V → ⟨I²⟩ o V → vf.

### 4.3 Controlabilidad (PBH; H excluida, sección D)

| actuadores | rango | qué falta |
|---|---|---|
| A1: I | **8/13** | M (1) + l=1 (4) |
| A2: I + vf | 9/13 | l=1 (4) |
| A3: I + vf + By (1 bobina) | 11/13 | l=1 en y (2) |
| **A4: I + vf + Bx + By** | **13/13** | — |
| A5: I + vf con la pinza (By0 = 0.8 mT fijo) | 11/13 | l=1 en y |

En A5, el campo de la pinza vuelve a I un actuador de l=1 en x: margen 8.3 contra 46.6 de una bobina.

**Márgenes PBH (A4):**

| canal | margen |
|---|---|
| l=2 | 809 |
| l=3 | 468 |
| charco | 429 |
| l=1 | 46.6 |
| l=0 | 4.3 |
| alambre | 0.15 y 1.1 |

**Gramiano:**
- La dirección más difícil de mover es la **temperatura del alambre**. En una gota (12 ms) λ_min = 7×10⁻⁵ y la condición 5×10⁷. En 1 s, λ_min = 2.2 y la condición 2.5×10⁴: es un canal de segundos, no de gotas.
- **Si g3 = 0**, l=3 no se controla con nada de lo que hay. Es INCIERTO.

### 4.4 Observabilidad (PBH, sección D; gramianos, sección E)

| sensores | rango obs (de 14) | qué queda ciego |
|---|---|---|
| S1: V | 9 | l=1 (4) + una combinación de (gota, H) |
| S2: V + sonda R | 9 | lo mismo |
| S3: V + R + homodino x, y | 13 | (gota, H) |

- **(gota, H):** con la pinza, S3 llega a 14/14, pero por un camino débil (margen 4×10⁻⁴). No es práctico.
- **l=1:** si By0 = 0.8 mT fijo (pinza), una de las dos direcciones se vuelve observable con margen de 0.036. Tampoco es práctico.
- **En una gota (12 ms):** con V sola, la combinación (ls, H) está numéricamente muerta (rango 8). La sonda la revive, aunque débil (λ_min 5.7×10⁻⁷).

### 4.5 El mapa visto por el cable: Z(f) = dV/dI a 40 A (sección F)

| gota | picos con modo | piso |
|---|---|---|
| a = 0.30 mm | charco 168 Hz, 38 mV/A · **l=2 1243 Hz, 206 mV/A** · l=3 2418 Hz, 71 mV/A | 24.6 mV/A |
| a = 0.40 mm | charco 170 Hz, 39 · **l=2 807 Hz, 274** · l=3 1568 Hz, 89 | 24.6 |
| a = 0.46 mm | charco 171 Hz, 39 · **l=2 654 Hz, 315** · l=3 1272 Hz, 101 | 24.6 |

- El pico de l=2 analítico es |Z2| = E_A·a·Q·2I0/Ic²: 255 mV/A a Q = 30 y 85 mV/A a Q = 10.
- **No hay pico en f1.** El aporte de l=1 a Z(f1) es 0 sin campo, 0.078 mV/A con 0.8 mT y 1.09 mV/A con 3 mT.

### 4.6 Lo no lineal: corchetes de Lie e invariantes (sección G)

| campo | \|campo\| | componente M | componente l=1 | dominante |
|---|---|---|---|---|
| g1 = ∂F/∂I | 1.5×10³ | 2×10⁻¹⁴ | 0 | l=2 59 % + l=3 20 % |
| g2 = ∂²F/∂I² | 37 | 0 | 0 | l=2 60 % + l=3 20 % |
| [F, g1] | 9×10⁶ | 5×10⁻¹⁶ | 0 | l=3 / l=2 |
| [F, g2] | 2.3×10⁵ | 2×10⁻¹⁷ | 0 | l=3 / l=2 |
| [g1, g2] | 78 | 4×10⁻¹⁶ | 0 | l=2 / l=3 |

- **Ángulo entre g1 y g2:** 8.9° en todo el estado y **75.8° en el plano lento (ls, h)**.
- **Rango a profundidad 1:** el lineal span(b, Ab) da 2; el no lineal da 5. Los corchetes llegan antes a más direcciones, pero nunca a M ni a l=1.
- **Momento angular lateral:** L_z(5 ms)/L_z(0) = +0.677 y +0.679 con dos I(t) distintas. Solo decae y su signo nunca cambia.

### 4.7 Balance armónico: mandos que se pueden sostener (sección H)

**Con vf = 50 mm/s fijo, temperatura de punta que se puede sostener a cada stickout:**

| ls | ⟨I⟩ | T solo con corriente continua | con senoide (I1 ≤ ⟨I⟩ − 10) | con pulso 10/70 A |
|---|---|---|---|---|
| 5 mm | 40.9 A | 49 °C | 49–59 °C | 49–68 °C |
| 10 mm | 40.3 A | 84 °C | 84–106 °C | 84–130 °C |
| 20 mm | 39.0 A | 170 °C | 170–226 °C | 170–316 °C |
| 25 mm | 38.2 A | 221 °C | 221–298 °C | 221–440 °C |

**Ganancia estacionaria (escalada)** de (⟨I⟩, ⟨I²⟩, vf) hacia (ls, T, flujo):

```
ls:    -63.1  -4.83  +44.9
T:     -12.9   +0    +10.2
flujo:  +0     +0     +2
```

- Valores singulares 79.4 / 1.91 / 0.82: **rango 3, condición 97**. La matriz es triangular: vf da el flujo, ⟨I⟩ con vf da T, y ⟨I²⟩ da ls.
- Solo con corriente continua (⟨I²⟩ = ⟨I⟩²) el rango es 2.
- **Verificación** (40 s de simulación del subsistema lento contra el promedio):
  - 40 A en continua: ls 12.81 / 12.81 mm, T 105.6 / 105.6 °C.
  - 40 + 30 cos: ls 10.00 / 10.00 mm, T 105.6 / 105.6 °C.

### 4.8 Mezcla de frecuencias: coincidencias estructurales (sección I)

- f3/f2 = 1.9365, así que **2f2 = 1.033·f3**: cae a 3.3 % de l=3, cuyo ancho a Q = 30 es ±1.7 %. Esto vale **para cualquier tamaño de gota**, porque el cociente no depende de a.
- f4/f2 = **3.0000 exacto**: f2 + 2f2 = f4, y el tercer armónico de un pulso cuadrado a f2 cae exacto en l=4.
- Si f1 = 0.5·f2 [S], entonces 2f1 = f2 exacto.

**Respuesta estacionaria por forma de onda** (cota; gota de 0.46 mm, g3 = 0.3, g4 = 0.2 [S]):

| forma de onda | ⟨I⟩ | ⟨I²⟩ | q2 | q3 | q4 | líneas de I² en k·f2 (A²), k = 0..5 |
|---|---|---|---|---|---|---|
| W1: canon 40 + 30 cos | 40.0 | 2050 | 1.92 | 0.074 | 0.019 | 2050, 2400, **450**, 0, 0, 0 |
| W2: I = √(2050 + 1950 cos) | 41.6 | 2050 | 1.55 | **0.021** | 0.012 | 2050, 1950, 0, 0, 0, 0 |
| W3: 40 + 18 cos + 12 cos 2 | 40.0 | 1834 | 1.33 | 0.139 | 0.056 | 1834, 1656, 1122, **216**, 72, 0 |
| W4: pulso cuadrado 10/70 | 40.0 | 2500 | 2.44 | 0.040 | **0.183** | 2500, 3056, 0, **1019**, 0, 611 |

**En el tiempo, hasta soltar** (sección I, final):

| forma de onda | ciclos para soltar | \|q3\| máx |
|---|---|---|
| W1: canon | 7.3 | 0.065 |
| W2: raíz | 10.4 | 0.044 |
| W1': canon − 5.6 A a 2f2 | 8.3 | 0.053 |

**Apuntar l=1** (necesita B):

| cómo | l=1 en resonancia | l=2 de rebote |
|---|---|---|
| B = 1 mT a f1, I fija | 87.9 µm | q2 = 0 |
| B = 1 mT fijo, I = 40 + 10 cos(f1) | 22 µm | q2 = 0.068 |
| B = 1 mT fijo, I = 40 + 30 cos(f1) | 66 µm | q2 = **0.44** |

**Impactos de gota contra el charco:**
- A vf 30 mm/s salen 43 gotas/s; su 4.º armónico, **172 Hz**, cae a menos de 15 % del charco (177 Hz).
- A vf 50 mm/s salen 72 gotas/s y ningún armónico queda cerca.
- El charco de 1.5 / 2 / 3 mm de radio tiene su modo (0,1) a 287 / 177 / 85 Hz.

### 4.9 Riesgo paramétrico l=2 → l=1 (sección J)

Una semilla lateral de 5 µm durante el campanazo canónico (suelta en 7.3 ciclos) se amplifica así:

| f1/f2 | 0.40 | 0.45 | 0.48 | 0.50 | 0.52 | 0.55 | 0.60 |
|---|---|---|---|---|---|---|---|
| ε = 0.25 | 1.00 | 1.00 | 1.36 | 1.51 | 1.14 | 1.00 | 1.00 |
| ε = 0.5 | 1.00 | 1.05 | 2.97 | **3.35** | 2.70 | 1.00 | 1.00 |
| ε = 1.0 | 1.19 | 6.41 | 13.7 | **16.2** | 15.3 | 8.71 | 1.92 |

ε ≈ 0.5 corresponde a un péndulo que se alarga con q2 [S]. Crece la amplitud, pero la dirección la pone la semilla: es un bombeo sin brújula.

### 4.10 Observabilidad no lineal (sección K)

**l=1 visto en cuadrado** (la gota sube (x² + y²)/2a [S]):

| movimiento | señal en V |
|---|---|
| mecerse lineal de 10 / 30 / 88 µm | 0.54 / 4.9 / 42 mV en 2f1 |
| giro en círculo | 0 mV en alterna (solo 1–84 mV de continua, revueltos con el largo) |

**Homodino** (referencia conocida, puesta por la bobina):

| referencia × desconocido | línea cruzada en 2f1 | tiempo para SNR 3 |
|---|---|---|
| 50 µm × 10 µm | 5.4 mV, lineal y con signo | 0.12 ms (ruido 10 mV) / 110 ms (0.3 V) |
| 88 µm × 10 µm | 9.6 mV | 0.04 ms / 35 ms |

**Fisher: qué da V(t) en 4 ms** (gota de 0.36 mm, 40 A), cota de Cramér-Rao con ruido de 10 mV / 0.3 V por muestra:

| inyección en el mismo cable | largo del arco | H y stickout | radio de gota | T alambre | l=1 |
|---|---|---|---|---|---|
| a) solo corriente continua | 195 µm / 5.8 mm | ciegos | 2.3 / 68 µm | 34 / 1000 K | ciego |
| b) + sonda 3 A a 5 kHz | 0.44 / 13 µm | 0.67 / 20 mm | 2.1 / 63 µm | 21 / 625 K | ciego |
| c) + golpecito 10 A × 0.8 ms a f2 | 0.45 / 13.5 µm | 0.29 / 8.5 mm | **0.11 / 3.3 µm** | 4.8 / 143 K | ciego |
| d) sonda + golpecito | 0.33 / 9.9 µm | 0.23 / 6.8 mm | 0.105 / 3.2 µm | 4.7 / 142 K | ciego |

En a), el largo del arco sale mal porque V suma 10 V/mm de arco con 20 mV/mm de stickout, y el stickout no se conoce.

### 4.11 Tabla de canales (40 A, gota de 0.40 mm; sección M)

| canal | frecuencia | actuador · ganancia | sensor · ganancia | ¿controlable? | ¿observable? |
|---|---|---|---|---|---|
| l=0 volumen | rampa / continua | I: 0.62 mm³/s por A; soltar (híbrido) | V −20 mV/µm (continua) · oído 3.0 Hz/µm | sí (I) | sí; se separa de H solo con el oído |
| metal M | integrador | **solo vf**: 0.50 mm³/s por mm/s; I: nada | V (vía La) | **solo vf** | sí |
| alambre ls | τ 0.26 y 6.5 s | I: −1.24 mm/s por A · vf +1 · ⟨I²⟩ | V −10 mV/µm (igual que H) · R +0.5 mΩ/mm | sí | sí; ls contra H solo con R |
| T del alambre | τ 0.26 y 6.5 s | ⟨I²⟩ a ⟨I⟩ fijo · ⟨I⟩/vf | R: 13.7 µΩ/K (41 µV/K con 3 A) | sí, en segundos | sí, en segundos |
| l=2 (soltar) | f2 = 806 Hz, Q 30 | I a f2: 0.064 q/A | V: 40 mV por 0.01 q; \|Z2\| 255 mV/A | sí | sí |
| l=3 | 1.94·f2 = 1561 Hz | I a f3 (g3 [S]) y 2f2 (a 3.3 %) | V: 40 mV por 0.01 q | **solo si g3 ≠ 0** | sí |
| l=1 (apuntar) | ~0.5·f2 = 403 Hz [S] | **B**: 88 µm/mT; B0·I | V solo \|r\|² en 2f1; homodino con B | **no con I**; un eje por bobina | **no lineal**; sí con homodino [S] |
| charco (0,1) | 177 Hz [S], Q 5 [S] | I: 3.0 µm/A en resonancia; impactos | V: 10 mV/µm | sí | sí |
| altura H | constante | eje Z (no hay) | V (igual que ls); se separa con R | no (perturbación) | sí, con R |

## 5. Veredictos

| # | hipótesis | veredicto | por qué / qué lo decide |
|---|---|---|---|
| 1 | Un solo cable (I, con V, I) controla todo el proceso | **FALSA** | Rango 8/13: M solo lo mueve vf, y l=1 tiene simetría. Exacto, no depende de los parámetros. |
| 2 | La mezcla I² da acceso a canales que la parte lineal no alcanza | **FALSA en rango, PASA en sostener** | Los corchetes dan 0 sobre M y l=1. Pero ⟨I²⟩ es un segundo mando de continua (75.8°, rango estacionario 2 → 3): fija el largo a temperatura y flujo fijos. Lo decide medir el stickout con dos formas de onda de igual ⟨I⟩: se predicen 12.8 contra 10.0 mm. |
| 3 | l=1 (apuntar) se controla u observa con I y V | **FALSA** | Simetría de giro: ninguna I(t) elige la dirección, y V lo ve solo como \|r\|². Con 2 bobinas es controlable (13/13). |
| 3b | l=1 se lee por homodino con las bobinas como referencia, solo con V | **INCIERTO** | Depende de que la gota suba (x² + y²)/2a [S]. Lo decide mecer la gota con la bobina a f1 y buscar en V la línea en 2f1: 42 mV con 88 µm si es cierto; < 1 mV si el arco se pega de lado. |
| 4 | V sola separa H, stickout y tamaño de gota | **FALSA** (lineal) / **PASA** con golpecito + sonda (modelo) | λ = 0 doble y ls ≈ H. Con golpecito: gota a 0.11 µm (10 mV) o 3.3 µm (0.3 V); H y ls a 0.23–6.8 mm en 4 ms. |
| 5 | La temperatura del alambre libre es un canal útil | **INCIERTO / débil** | A 10 mm de stickout la punta llega a 83 °C, y el rango que se puede sostener es 84–130 °C. Se vuelve fuerte con 20–25 mm (170–440 °C). Es observable por R a 14 µΩ/K, en segundos. Lo decide el «fusible» del plan: el codo de Curie en R. |
| 6 | l=3 es controlable por I | **INCIERTO** | Solo si g3 ≠ 0, es decir, si el pellizco no es simétrico arriba-abajo. Lo decide la línea en 1.94·f2 en el experimento §7. |
| 6b | El armónico 2f2 de I² cae sobre l=3 para cualquier gota | **PASA** (aritmética de Rayleigh, gota libre) | 2f2 = 1.033·f3. La magnitud depende de g3. Para una gota colgada el cociente puede ser otro: se mide. |
| 7 | Un pulso cuadrado a f2 excita l=4 en resonancia | **PASA** | 3f2 = f4 exacto: q4 = 0.18 contra 0.019 con senoide (×10). |
| 8 | El campanazo bombea l=1 paramétricamente si f1 ≈ f2/2 | **INCIERTO** | Amplifica ×1.5–16 según ε, y la dirección la pone el ruido. Lo decide medir f1 (idea del canon: «la impresión es el osciloscopio»). |
| 9 | Operar a 60 A con gota libre usando la LRS-1200 | **FALSA** | Con 10 V/mm el arco máximo es 0.45 mm y la gota necesita 1.38 mm. |
| 10 | El charco es un canal controlable y observable desde el cable | **PASA en el modelo, INCIERTO en número** | Bulto de 39 mV/A sobre 25 mV/A cerca de 177 Hz, con Qp = 5 [S]. La literatura reporta ~100 Hz en penetración parcial. |

## 6. Reglas de diseño del lente 𝔄 que la física respalda

1. **El postulado de canal es el test de Hautus.**
   - Un canal no degenerado puede compartir el cable si: (a) tiene su propia frecuencia y (b) el actuador no le es ortogonal (gᵢ ≠ 0).
   - Un valor propio con multiplicidad geométrica k necesita **k actuadores y k sensores independientes**.
   - l=1 tiene k = 2, luego 2 bobinas. (gota, H) tiene k = 2, luego necesita una segunda «salida»: el oído.
   - **PASA**: es teoría de control estándar. El marco lo nombró antes.
2. **z = q + i·q'/ω: cada canal se lee en su marco que gira.**
   - Usar lock-in I/Q a la frecuencia del canal (rotar de vuelta, 𝔄⁻¹) y empujar a 90° de la respuesta.
   - El firmware lleva un demodulador por canal: f2 siguiendo a la gota, f3, f_p y la sonda.
   - **PASA**: es estándar.
3. **Mandar en coordenadas de fuerza, s = I², no en I.**
   - La base I0 linealiza el pellizco con ganancia 2I0, pero mete la línea I1²/2 en 2f2, que es casi f3.
   - La raíz (W2) deja una sola línea: q3 baja 71 % en estacionario y 32 % en el transitorio.
   - Cuesta: tarda 10.4 ciclos en vez de 7.3, porque s ≥ Imin² limita la amplitud.
   - **PASA**.
4. **Tonos puros, nunca pulsos cuadrados.**
   - Los armónicos son diafonía: el cuadrado pega exacto en l=4.
   - El esquema ω + 2ω del canon pone 3f2 = f4 exacto (216 A²).
   - **PASA**.
5. **Lo que el sensor ve en cuadrado se lee con una referencia (homodino).** Es |z + z_ref|² = … + 2Re(z·z̄_ref).
   - **INCIERTO** aquí, porque depende de cómo se mueve el arco con la gota.
6. **Un mando escalar no elige un punto en un círculo.**
   - Ninguna I(t) elige la dirección lateral; el signo de L_z es invariante.
   - **PASA**, exacto.
7. **Dos mandos de continua en un cable.**
   - ⟨I⟩, la primera aplicación, funde por el arco. ⟨I²⟩, la segunda, calienta por Joule y pellizca.
   - Factible: ⟨I⟩² ≤ ⟨I²⟩ ≤ (Imin + Imax)⟨I⟩ − Imin·Imax.
   - Las ondas que se usan para soltar se cobran a ⟨I²⟩ (sube el calor), pero casi no cuestan potencia: 0.025 Ω × 450 A² = 11 W.
   - **PASA**: la lectura «primera / segunda aplicación» es la imagen del marco; la física es Joule contra caída de electrodo.
8. **Para oír la campana hay que tocarla.**
   - La observabilidad depende de la entrada: el golpecito mejora ×20 la información sobre la gota.
   - **PASA** en el modelo.
9. **Apuntar con B, no con I.**
   - Si f1 ≈ f2/2, modular I a f1 suelta la gota (q2 = 0.44 con 30 A).
   - **PASA** si f1 = 0.5·f2; ese supuesto es [S].
10. **No dejar que los impactos de gota canten con el charco**, o hacerlo a propósito.
    - Hermans y den Ouden encontraron estabilidad máxima cuando la frecuencia de cortocircuito iguala la del charco.
    - **PASA** (literatura).

**Especulativo y no usado como argumento:** la lectura ontológica de i = 𝔄. Aquí 𝔄 solo sirvió de lente (rotación, cuadratura, multiplicidad); cada regla se sostiene con física estándar.

**Nota de paso:** `canales_gota.out` imprime «masa 2854.04 mg». En realidad son 2854 µg = 2.85 mg. El cálculo usa kg y está bien; solo la etiqueta está mal. No lo toqué.

## 7. Qué cambia en el banco, el circuito, el firmware o la lista de componentes

- **Lista de componentes:**
  - **No hace falta ningún sensor extra**: V e I a ≥250 kS/s con el ADC del Pico bastan para todos los canales salvo l=1.
  - **El motor del alimentador debe quedar bajo el Pico** (DRV8833, ya en el plan): es el único actuador del flujo de metal.
  - **Si se quiere apuntar: 2 bobinas, no 1.** Una sola apunta en un eje.
- **Banco:**
  - **Tender el retorno de tierra simétrico**, o medir su B. La pinza a 0.8 mT ya es un actuador de l=1 en x, sucio (rango 11/13 en A5). Si f1 ≈ f2/2 se acopla con l=2.
  - **No planear 60 A de gota libre** con la LRS-1200. La ventana es 40–45 A con arco de 1–1.5 mm.
- **Firmware:**
  - **(a) Lazo de largo de arco obligatorio.** En corriente constante con avance fijo, 1 A deriva el stickout 1.24 mm/s, con τ = 6.5 s. Cerrarlo de V hacia ⟨I²⟩ (rápido, a temperatura fija) o hacia vf (lento).
  - **(b) Consignas separadas** para ⟨I⟩ (temperatura de punta, con vf) y para ⟨I²⟩ (largo).
  - **(c) Generar los tonos como I = √s_ref** cuando importe limpiar l=3 y l=4.
  - **(d) Lock-ins:** f2 siguiendo a la gota (oído), 1.94·f2, la banda del charco y la sonda de 3 A a 5 kHz para el stickout.
  - **(e) Golpecito y escucha cada ~4 ms** mientras la gota crece.
  - **(f) Elegir la tasa de gotas** para que k·f_d no caiga cerca de f_p, salvo que se quiera sincronizar con el charco.
- **Circuito:** nada nuevo. La Pluma a 100 kHz sigue tonos hasta 1.3 kHz con −1.7° (canon). A 20 kHz alcanza para golpecitos chicos porque se mide la I real.

## 8. El experimento más barato que lo decide

**Qué se hace.** «Golpecito y escucha» a 40 A: el oído del canon, pero leído como mapa.
- Montaje: el banco mínimo con el arco estable a 40 A y el alimentador a ~3 m/min.
- Cada 4 ms, 10 A × 0.8 ms a la f2 que predice el modelo (o un chirp de 600–1300 Hz); después se escuchan 3 ms.
- El Pico guarda V e I a 250–500 kS/s durante ~1 s, unos 250 golpecitos.
- Por cada golpecito se ajusta una senoide amortiguada: f, Q, amplitud y Z = V/I.
- Las gotas se cuentan por los saltos de V. El tamaño al soltarse sale de a = (3·Aw·vf/(4π·f_gotas))^(1/3).

**Primer canal: l=2.** Es el de mayor ganancia, todo el canon descansa en él (Q = 30 sin medir), y el mismo registro decide otros tres canales.

**Números esperados si el mapa es cierto:**

| radio a | 0.30 mm | 0.36 mm | 0.40 mm | 0.46 mm |
|---|---|---|---|---|
| f2 | 1241 Hz | 944 Hz | 806 Hz | 654 Hz |
| anillo en V tras el golpecito | 183 mV | 171 mV | 181 mV | 159 mV |
| \|Z2\| con Q 30 | 206 mV/A | 246 | 273 | 314 |
| \|Z2\| con Q 10 | 64 mV/A | 77 | 85 | 98 |
| σ_f por golpecito (ruido 0.3 V / 10 mV) | 13 / 0.44 Hz | 13.5 / 0.45 | 12.6 / 0.42 | 14 / 0.47 |

- **Una línea que BAJA mientras crece la gota**, con **f2·a^1.5 = 204 Hz·mm^1.5 ± 20 %** a 40 A (208 Hz·mm^1.5 sin corriente). De lo medido sale σ = ρ(2π·f2·a^1.5)²/8, la tensión superficial con escoria.
  - Chequeo con literatura: gotas de ~1 mm de diámetro oscilan a ~500 Hz en GMAW pulsado (Monier et al.). Con a = 0.5 mm la fórmula da 589 Hz: es consistente.
- **Q ≥ 25** a partir de la caída del anillo, con un piso de 25 mV/A.
- **Una línea en 1.94·f2** si g3 ≠ 0; con g3 = 0.3 serían ~90 mV/A.
- **Nada por encima de 1 mV en ~f2/2** (l=1 ciego) con el retorno de tierra lejos. Un campo de 3 mT daría apenas 1 mV/A.
- **Un bulto fijo del charco** entre 100 y 300 Hz, de 1.5 veces el piso, que no se mueve con la gota.

**Qué lo hace falso y qué cambia:**
- Si no hay línea que siga a la gota, o Q < 10, el oído no existe: el canal l=2 no es observable desde el cable. La escoria del tubular podría amortiguarlo. Entonces el canon pierde su sensor y toca otro.
- Si f2·a^1.5 se aleja más de 20 %, hay que recalibrar σ (no es fatal).
- Si aparece una línea en ~f2/2, hay simetría rota (soplo de arco o la pinza): l=1 ya se mueve con I, y hay que medir el B del retorno.
- Si f3/f2 ≠ 1.94, la gota colgada no es la de Rayleigh: rehacer la tabla de coincidencias (§4.8).

**Costo:** cero piezas nuevas. Es el paso «campanazo» del plan, con el criterio Q ≥ 25 y ruido ≤ 0.3 V del canon, ahora con predicción por canal.

## 9. Fuentes

- Canon de La Forja: `scripts/canon/canales_gota.py` y `.out`, `canon_gota.out`, `canon_corriente.out`, `apuntar2.out`; `src/forja/brep/arcoFisica.ts` (V = 14 + 10 V/mm·L); `scripts/operador-revision-impresora-2026-10-31.py` (tablas de ρe y c del acero).
- Xiao, Y. H. & den Ouden, G. (1993). *Weld pool oscillation during GTA welding of mild steel*. Welding Journal 72(8):428s. https://www.osti.gov/biblio/6328378 (resumen: el charco se excita con pulsos y su frecuencia se lee en el voltaje del arco; dos modos en penetración parcial; cae al pasar a penetración total).
- *Weld pool oscillation during pulsed GTA welding* (mismo grupo): https://www.osti.gov/biblio/443008
- Hermans, M. J. M. & den Ouden, G. (1999). *Process behavior and stability in short circuit gas metal arc welding*. Welding Journal 78:137s. https://www.osti.gov/biblio/442977 (estabilidad máxima cuando la frecuencia de cortocircuito iguala la del charco).
- Chen et al. (2019), *Metals* 9(12):1326, frecuencias del charco de ~100 Hz en penetración parcial y 68–200 Hz en total: https://www.mdpi.com/2075-4701/9/12/1326. Lo vi en el resumen de la búsqueda, no en el texto.
- Lesnewich, A. (1958). *Control of melting rate and metal transfer in gas-shielded metal arc welding*. Welding Journal 37(8):343s. Citado vía Kim & Chung (KAIST): https://koasas.kaist.ac.kr/handle/10203/222046 y https://dspace.kaist.ac.kr/handle/10203/223913 (forma W = aI + bLI²; los coeficientes no se verificaron).
- Zhang, Y. M. & Li, P. J. (2001). *Modified active control of metal transfer and pulsed GMAW of titanium*. Welding Journal 80(2):54s. https://scholars.uky.edu/en/publications/modified-active-control-of-metal-transfer-and-pulsed-gmaw-of-tita/ (hacer oscilar la gota antes del pulso que la suelta).
- Monier et al. (2016), oscilación de gota en GMAW pulsado (~1 mm, ~500 Hz) para medir σ: https://doi.org/10.1007/s40194-016-0358-0
- Gota forzada por electrodo vibrante, resonancia que no depende de la corriente: https://www.programmaster.org/PM/PM.nsf/ApprovedAbstracts/A25BEFB4AFD20DC7852586D5002E5E51
- Campo magnético externo en GMAW: https://informaticsjournals.com/index.php/IWJ/article/view/39085. Campo transversal de 24 mT en láser-MIG: https://link.springer.com/10.1007/s00170-021-08089-w
- Sensado a través del arco (Cook): https://patentimages.storage.googleapis.com/b6/51/44/5a89bbf640cc16/US4544825.pdf
- **De memoria, sin verificar en la web:** Hautus (1969), test PBH; Hermann & Krener (1977), *IEEE TAC* 22:728, controlabilidad no lineal por corchetes de Lie; Lall, Marsden & Glavaški (2002), gramianos empíricos; Rife & Boorstyn (1974), cota de Cramér-Rao de frecuencia; Rayleigh (1879), modos de gota.
