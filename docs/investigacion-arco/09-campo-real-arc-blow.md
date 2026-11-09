# 09 · El campo magnético REAL del banco en el arco: arc blow y apuntar

Investigación del arco, 2026-11-05. Arco de 2 mm, gota de 0.46 mm, 40–60 A más una onda de 30 A a 668 Hz, DCEN.
- **Script:** `scripts/investigacion-arco/09_campo_real_arc_blow.py`. Corre en 470 s en iangpu con carga 38 (unos 140 s con la máquina libre).
- **Salida cruda:** `09_campo_real_arc_blow.out`. Todos los números de este reporte salen de ahí.

## 1. La pregunta

¿Cuánto campo magnético pone el propio banco en el arco y en la gota según cómo se rutea la corriente? ¿Cuánto ladea eso al arco? ¿Dónde va el contacto de pieza? ¿Sirve ese campo, o unas bobinas chicas, para apuntar la gota (modo l=1) como pide el canon con 3 mT?

## 2. Respuesta corta

- **El banco pone 0.1–0.33 mT en el arco a 40 A** (2.8–8.2 µT por ampere). El número que manda es adimensional, **Π = B_ext / (µ0·I / 2πL)**:
  - con cables sueltos (A), Π = 0.05–0.08;
  - con la base compacta (B), Π = 0.04–0.08;
  - con retorno simétrico (C), Π = 0–0.044.
  Como el campo sale del mismo circuito, **Π no depende de la corriente**. Con el jet como cuerda (κ = 1.5), el ánodo, que es el calor, se corre **40–110 µm** y siempre **se aleja de la pinza**, como dicen Lincoln y TWI. La raíz se inclina 2–6°. Está por debajo del umbral donde el arco se vuelve inestable (Π* ≈ 0.1–0.3, calibrado con la literatura).
- **La fuente principal NO son los cables sueltos, es la placa.** La placa de 50 mm es una tira: si la corriente corre por un solo lado del arco, pone 0.24 mT, que es Π ≈ L/w. En 400 ruteos al azar, los cables aportan 0.03 mT (mediana) y la placa con la pinza 0.24–0.26 mT. Poner la pinza encima con el cable subiendo empeora todo (A4: Π = 0.080). Poner el contacto bajo la placa pero en un extremo NO arregla nada (B3: Π = 0.082).
- **La onda no ladea al arco.** La AC de 668 Hz se reparte en la placa casi igual que la DC: |b1|/|b0| = 0.95–1.00, con menos de 2° de giro. Π cambia ±5–15 % en el ciclo, así que el ladeo es un corrimiento FIJO por posición y se puede calibrar. Lo que sí pulsa es la fuerza en la gota (∝ I²): con 40 + 30 A tiene DC, 668 Hz y 1336 Hz en proporción ≈ 9 : 10 : 2 µN (A1). En cambio, un campo que no venga del circuito (magnetismo residual de la placa, campo terrestre) da Π ∝ 1/I, que es ×4 en el valle de 10 A: ese sí mece al arco a 668 Hz.
- **Ruteo recomendado:**
  - *Lado pieza:* un marco de cobre bajo el perímetro de la placa (C4), con las patas BAJANDO. Da Π de placa ≤ 0.041 en toda la placa (mediana 0.021). La alternativa es una escobilla justo bajo el arco con dos lomos simétricos (C2: Π = 0).
  - *Lado antorcha:* que llegue por el eje desde arriba, sin brazos laterales cerca. El alimentador «junto a la antorcha» con un brazo a 50 mm cuesta Π = 0.029.
  - *Placa de acero:* según el modelo de cargas magnéticas (INCIERTO), apantalla la parte externa 2–7 veces en B y C.
- **Apuntar la gota con campo: FALSA como canal de la gota.**
  - El mismo B que empuja la gota empuja la columna del arco, que es 2 mm de material mucho más blando. En la columna vale 0.83–0.88 veces lo que vale en la gota, así que no hay forma de separarlos.
  - **El arco se corre 333 µm/mT (cuasi-estático); la gota, 2.9 µm/mT (estático) u 88 µm/mT en resonancia**, y eso después de 29 ms de carga.
  - Los 3.19 mT de la «patada» del canon dan **Π = 0.8 a 40 A**: el arco se corre 0.6–1.6 mm y entra en la zona donde la literatura reporta inestabilidad.
  - Las bobinas para 3.19 mT necesitan 560–930 A·vuelta cada una y 15–43 W girando.
  - Lo que SÍ puede funcionar (INCIERTO) es **apuntar el ARCO** con 2–4 vueltas de la propia corriente de retorno a 18 mm (B ∝ I, así que Π es constante en toda la onda). Da Π = 0.1–0.2, un corrimiento de 130–270 µm, y gasta 0.4–0.9 W.

## 3. Método

| Bloque | Modelo | Supuestos | Fuente |
|---|---|---|---|
| Campo | `fieldBFromSegment` de `src/lib/physics/em.ts` portado línea por línea a numpy (mismo eps = 1e-6, misma µ0) | — | Griffiths ec. 5.36; validado en §1 del `.out` contra alambre infinito, semi-infinito, espira cuadrada y circular (error < 1e-5) |
| Corriente en la placa | malla de 41×21 nodos (h = 2.5 mm), placa de 100×50×3 mm. En DC, Kirchhoff con R = ρ·h/(w·t). En AC, PEEC: Z = R + jωL_parcial, con la inductancia de Neumann entre filamentos paralelos y todos los cables, barras y antorcha en la misma red | ρ = 1.5e-7 Ω·m (frío) / 5e-7 (caliente) [MEM]; µr = 1 en la red; piel modelada como ks = 1 o 3 (R = X_int) | Convergencia: h = 5 / 2.5 / 1.25 mm da 0.236 / 0.208 / 0.205 mT (A1) |
| Placa ferromagnética | celdas de 2.5×2.5×3 mm con M uniforme. Cargas σ = M·n en las 6 caras, con fórmula cerrada de rectángulo cargado; M = χ(H_ext + H_M). Variante con un hoyo de χ = 0 a menos de 4 mm del arco (Curie) | µr = 100 o 300 [SUP]. NO se incluye el efecto del acero sobre el campo de las corrientes DENTRO de la placa (una sola capa) | Validación: campo uniforme → H_t en la cara = 0.41 / 0.20 (µr 100/300), contra el elipsoide 0.14–0.25 / 0.05–0.10 (§7) |
| Arco | jet como cuerda, lanzado recto desde la gota (cátodo en DCEN), con tensión T = κ·µ0·I²/4π (empuje de Maecker, κ = ln(R/rc) + ½ ≈ 1.2–2.1) y empujado por f = I·(ẑ×B(z)). Se integra B en 10 alturas de la columna. Para B uniforme, **y(L) = Π·L/κ** | κ = 1.5 nominal, rango 1–2.5. La literatura da κ ≈ 0.7–1.6 (Rolls-Royce), o sea que los corrimientos podrían ser hasta 2 veces más grandes | Maecker [MEM, Lancaster *Physics of Welding*]; Belous 2011; patente Rolls-Royce; tablas de umbral (§8) |
| Gota | F = I·2a·B (corriente que la cruza), l=1 con k1 = m·ω1² y f1 = f2/2 = 334 Hz, Q = 30 | f1 y Q SUPUESTOS por el canon, sin medir | `scripts/canon/canales_gota.py`, `apuntar2.py` |
| Geometrías | A1–A4 (cables sueltos, fuente a 0.4 m), B1–B3 (base con barras de 60 mm² y fuente en la base), C1–C4 (retornos coaxiales y simétricos), Monte Carlo de 400 ruteos sueltos | Coordenadas en el código, función `arma()` | — |

[MEM] = de memoria, no verificado en línea. [SUP] = supuesto mío.

## 4. Resultados (telemetría del `.out`)

### 4.1 Las configuraciones (arco al centro de la placa, DC, vacío, 40 A)

| conf | qué es | B columna mT | B gota mT | Π | f columna µN/mm | F gota µN (peso 28) | ánodo corrido y(L) µm | partes: placa / pieza / antorcha (mT) |
|---|---|---|---|---|---|---|---|---|
| A1 | pinza en el extremo lejano, cable rodeando la placa por la mesa | 0.208 | 0.194 | 0.052 | 8.3 | 7.1 | 68 | 0.238 / 0.003 / 0.033 |
| A2 | pinza en el extremo cercano, los dos cables en el plano y = 0 | 0.276 | 0.265 | 0.069 | 11.0 | 9.7 | 91 | 0.238 / 0.006 / 0.033 |
| A3 | pinza al costado | 0.253 | 0.241 | 0.063 | 10.1 | 8.9 | 83 | 0.233 / 0.017 / 0.033 |
| **A4** | **pinza encima, cable SUBE 150 mm** (lo típico) | **0.319** | 0.309 | **0.080** | 12.8 | 11.4 | **105** | 0.238 / 0.114 / 0.033 |
| B1 | contacto bajo el centro, barra a 22 mm bajo la placa | 0.255 | 0.250 | 0.064 | 10.2 | 9.2 | 84 | 0 / 0.143 / 0.115 |
| B2 | ídem, la barra baja 80 mm antes de doblar | 0.168 | 0.170 | 0.042 | 6.7 | 6.2 | 56 | 0 / 0.053 / 0.115 |
| B3 | contacto bajo UN extremo | 0.328 | 0.320 | 0.082 | 13.1 | 11.8 | 108 | 0.238 / 0.025 / 0.115 |
| C1 | escobilla justo bajo el arco, yugo en C de un lomo | 0.175 | 0.177 | 0.044 | 7.0 | 6.5 | 58 | 0 / 0.032 / 0.143 |
| **C2** | escobilla bajo el arco y **dos lomos simétricos** | **0.000** | 0.000 | **0** | 0 | 0 | 0 | 0 / 0 / 0 |
| C3 | anillo de 8 contactos bajo la placa, alimentación por el eje desde arriba | 0.111 | 0.111 | 0.028 | 4.5 | 4.1 | 37 | 0 / 0.038 / 0.073 |
| C4 | marco perimetral bajo el borde, ídem arriba | 0.123 | 0.126 | 0.031 | 4.9 | 4.6 | 41 | 0.036 / 0.031 / 0.073 |

- **A 60 A** B crece ×1.5 y las fuerzas ×2.25, pero Π y y(L) no cambian.
- **En el pico de 70 A** la fuerza por mm crece ×3.06.
- **Dirección:** en las 5 configuraciones con pinza o contacto descentrado, la fuerza apunta en sentido contrario a la conexión (coseno de −0.99 a −1.00). Eso reproduce la regla de taller de que el arco sopla alejándose de la conexión de pieza.

**La rigidez del arco.** El jet aguanta con su empuje de Maecker, T = 1.5·µ0·I²/4π:

| I | T | velocidad implícita (ρ = 0.03 kg/m³, columna de 1 mm) |
|---|---|---|
| 10 A | 15 µN | 13 m/s |
| 40 A | 240 µN | 50 m/s |
| 60 A | 540 µN | 76 m/s |
| 70 A | 735 µN | 88 m/s |

Contra eso, la fuerza lateral sobre la columna de 2 mm en A1 es 8.3 µN/mm × 2 mm = 17 µN, o sea el 7 % de T. De ahí salen 3.9° en la raíz.

**Qué le pasa a la gota** (orden de magnitud, INCIERTO):
- La fuerza directa es de 4–12 µN.
- La «indirecta» (la raíz del arco se corre sobre la gota, (µ0·I²/4π)·θ) es de 6–17 µN.
- El arrastre del jet ladeado durante el vuelo la desvía 3–8 µm. Es una cota alta: usa v = 100 m/s.

**La gota cae casi donde apunta el alambre; el que se corre 40–110 µm es el CHARCO.** Para imprimir, el banco mueve el calor respecto al metal.

### 4.2 La regla de Ampère y la ley de la tira (§3 del `.out`)

| prueba (40 A, solo placa + cable de pieza) | B en la columna (mT) | Ampère (placa infinita) |
|---|---|---|
| placa de 400×400, contacto a 50 mm, cable que BAJA | 0.015 | 0 |
| placa de 400×400, contacto a 50 mm, cable que SUBE | 0.175 | 0.160 |
| placa de 100×100, s = 45 mm, BAJA | 0.060 | 0 |
| placa de 100×100, s = 45 mm, SUBE | 0.237 | 0.178 |

- **En una placa grande, un contacto por debajo con su cable bajando es invisible desde el arco (PASA).** Con una semiesfera de Ampère, el disco de corriente que entra a la placa más el cable que baja no encierran corriente arriba.
- **En una tira NO funciona.** Si toda la corriente corre de un solo lado del arco, arriba queda medio plano de corriente:

| ancho w | Π de la malla | cota πL/2w |
|---|---|---|
| 50 mm | 0.038 | 0.063 |
| 100 mm | 0.024 | 0.031 |
| 200 mm | 0.0125 | 0.016 |

**Ley práctica: Π_tira ≈ L/w.** Un arco de 2 mm sobre una placa de 50 mm ya tiene Π ≈ 0.04 por la placa sola, venga de donde venga el cable.

### 4.3 La onda: cómo se reparte la AC y qué hace al campo (PEEC, §4)

| conf | placa | |b0| µT/A | |b1| µT/A (668 Hz) | ángulo | Π DC | Π min–max en el ciclo | F gota DC / 668 / 1336 Hz (µN) | L del lazo |
|---|---|---|---|---|---|---|---|---|
| A1 | fría, ks = 1 | 5.19 | 4.93 | −0.6° | 0.052 | 0.045–0.068 | 9.0 / 10.4 / 1.9 | 1.46 µH |
| A1 | fría, ks = 3 | 5.19 | 5.03 | −0.2° | 0.052 | 0.051–0.057 | 9.1 / 10.5 / 2.0 | 1.54 µH |
| A4 | fría, ks = 1 | 7.99 | 7.77 | 0° | 0.080 | 0.075–0.091 | 14.5 / 16.8 / 3.1 | 0.98 µH |
| B1 | fría, ks = 1 | 6.37 | 6.25 | −1.6° | 0.064 | 0.061–0.070 | 11.8 / 13.7 / 2.5 | 0.15 µH |
| B3 | fría, ks = 1 | 8.21 | 8.02 | 0° | 0.082 | 0.078–0.092 | 15.0 / 17.5 / 3.2 | 0.13 µH |
| C1 | fría, ks = 1 | 4.38 | 4.40 | −0.1° | 0.044 | 0.043–0.044 | 8.3 / 9.8 / 1.8 | 0.21 µH |
| C3 | fría, ks = 1 | 2.79 | 2.82 | −0.2° | 0.028 | 0.027–0.028 | 5.2 / 6.2 / 1.2 | 0.40 µH |

- **La placa de 50 mm se comporta como resistiva a 668 Hz.** La AC casi no busca otro camino: el campo escala con I(t) y el arco no se mece con la onda. Con la piel (ks = 3) o con la placa caliente, todavía menos.
- **La fuerza en la gota sí lleva la mezcla de I²** (canal de 668 Hz más 1336 Hz). Con el f1 = 334 Hz del canon, la componente de 668 Hz cae en 2·f1 y no resuena: mueve la gota 0.3–0.5 µm. Si f1 real estuviera cerca de 668 Hz (no está medido), el banco la mecería 7–11 µm con Q = 30. Es chico de cualquier modo.
- **Campos que no salen del circuito.** Con Π ∝ 1/I, el ánodo se corre:

| campo | 10 A | 40 A | 70 A |
|---|---|---|---|
| terrestre, horizontal ~27 µT [MEM] | 36 µm | 9 µm | 5 µm |
| residual de 0.3 mT [SUP] | **400 µm** | 100 µm | 57 µm |

  Estos SÍ mecen al arco a 668 Hz entre el pico y el valle.
- **Para el circuito:** el lazo suelto mete 1.0–1.5 µH y el compacto 0.13–0.4 µH, contra los 41 µH del choque. No cambia el di/dt, pero a 70 A guarda 2.4–3.6 mJ contra 0.3–1 mJ, y eso es lo que el crowbar o el TVS tienen que tragar cuando se rompe el arco.

### 4.4 Mapas: Π de la placa + conductor de pieza según dónde está el arco (§5, DC)

| conf | Π máx | Π mediana | dónde sube |
|---|---|---|---|
| A1 (pinza en x = +50) | 0.144 | 0.079 | junto a la pinza (x = +40: 0.144) y en los bordes largos (y = ±20: 0.094–0.124) |
| B1 (contacto bajo el centro) | 0.118 | 0.057 | en los bordes largos y lejos del contacto |
| B3 (contacto bajo un extremo) | 0.122 | 0.064 | en los bordes |
| C3 (anillo de 8) | 0.108 | 0.043 | 0.001–0.013 en el centro, sube en esquinas y bordes |
| **C4 (marco perimetral)** | **0.041** | **0.021** | casi plano en toda la placa |

La cabeza va aparte: es un vector constante que se mueve con el arco. En B (antorcha de 50 mm con brazo de 70 mm y bajante) vale Π = 0.029. En C3/C4 (alimentación por el eje hasta 150 mm) vale 0.018.

### 4.5 Monte Carlo: 400 ruteos sueltos al azar (§6)

| caso | Π mediana | p90 | máx | B columna a 40 A (mediana / p90) | y(L) (mediana / p90) | parte placa + pinza | parte cables |
|---|---|---|---|---|---|---|---|
| arco al centro | 0.062 | 0.068 | 0.078 | 0.25 / 0.27 mT | 80 / 90 µm | 0.237 mT | 0.028 mT |
| arco al azar | 0.070 | 0.099 | 0.142 | 0.28 / 0.40 mT | 91 / 129 µm | 0.262 mT | 0.030 mT |

Ningún ruteo pasó de Π = 0.15. Con la pinza a 0–30 mm del arco, Π mediana = 0.084 y p90 = 0.123.

### 4.6 La placa es de acero (§7; INCIERTO, modelo de una capa)

| conf | Π vacío | µr 100 | µr 100 con hoyo | µr 300 | µr 300 con hoyo |
|---|---|---|---|---|---|
| A1 | 0.052 | 0.059 | 0.057 | 0.061 | 0.058 |
| A4 | 0.080 | 0.066 | 0.071 | 0.066 | 0.068 |
| B1 | 0.064 | 0.015 | 0.030 | 0.009 | 0.019 |
| B3 | 0.082 | 0.059 | 0.062 | 0.043 | 0.052 |
| C1 | 0.044 | 0.011 | 0.021 | 0.007 | 0.014 |
| C3 | 0.028 | 0.007 | 0.013 | 0.004 | 0.008 |

- **El acero apantalla de 2 a 7 veces** lo que viene de cables, barras y antorcha (B, C).
- **No toca la parte de la tira** (A), porque el modelo deja en vacío el campo de las corrientes dentro de la placa.
- **Cerca del extremo de la pinza lo AUMENTA:** A1 con el arco a 10 mm del extremo pasa de 0.136 a 0.248. Es la concentración de flujo en los extremos que la literatura señala como back blow.

### 4.7 Apuntar: el mismo campo sobre la gota y sobre el arco (§8)

| B | I | Π | ánodo corrido y(L), µm (κ 1 / 1.5 / 2.5) | gota estática µm | gota resonante µm | estabilidad |
|---|---|---|---|---|---|---|
| 1.12 mT (giro del canon) | 40 A | 0.28 | 560 / 373 / 224 | 3.3 | 98 | zona de inestabilidad |
| **3.19 mT (patada del canon)** | 40 A | **0.80** | **1595 / 1063 / 638** | 9.3 | 280 | INESTABLE |
| 3.19 mT | 70 A | 0.46 | 911 / 608 / 365 | 16.3 | 490 | INESTABLE |
| 3.19 mT | 10 A (valle) | 3.19 | > 2.5 mm | 2.3 | 70 | se apaga |
| 0.30 mT | 40 A | 0.07 | 150 / 100 / 60 | 0.9 | 26 | estable |
| 0.75 mT | 40 A | 0.19 | 375 / 250 / 150 | 2.2 | 66 | borde |

**Bobinas independientes.** Son dos pares en cuadratura, de 80 vueltas AWG21, 8×7 mm, centradas a z = 12 mm para librar la placa. No caben a la altura de la gota porque la placa está 2.5 mm abajo.

| par | B gota µT/(A·v) | B columna µT/(A·v) | columna/gota | factor de la placa (µr 300), gota / columna | para 3.19 mT en la gota: NI por bobina, I, P media girando |
|---|---|---|---|---|---|
| D = 18 mm, R = 7.5 mm | 5.69 | 4.73 | 0.83 | 0.60 / 0.44 | 560 A·v (vacío) → 7.0 A, 15.5 W · 932 A·v (placa) → 11.6 A, 43 W |
| D = 25 mm, R = 10 mm | 4.08 | 3.61 | 0.88 | 0.44 / 0.30 | 781 → 9.8 A, 40 W · 1779 → 22 A, 208 W |

**Bobinas en serie con el retorno.** El par a 18 mm deja 4.73 µT por A·v en vacío y 2.07 con la placa.

| Π | corrimiento del ánodo | vueltas por bobina (16 mm²) | R | P | L extra |
|---|---|---|---|---|---|
| 0.05 | 67 µm | 1.1 | 0.11 mΩ | 0.22 W | 0.02 µH |
| 0.10 | 133 µm | 2.1 | 0.21 mΩ | 0.44 W | 0.09 µH |
| 0.20 | 267 µm | 4.2 | 0.43 mΩ | 0.88 W | 0.34 µH |

### 4.8 Calibración de Π* y κ con la literatura (§2 del `.out`)

| caso | Π |
|---|---|
| Belous (Paton, TIG de Ti): «≥ 8 mT a 400 A con 4 mm de arco» para llevar el ánodo a la pared del surco | 0.40 |
| Rolls-Royce: TIG a 120 A, 17 G → 10 mm de desvío; con L = 10–15 mm (no lo dicen) | 0.71–1.06 → κ implícito 0.71–1.59 |
| tabla de umbrales: TIG «inestable» con 10–20 G a ~150 A y 3 mm | 0.10–0.20 |
| «severo» ≥ 40 G (MMA, 150 A, 4 mm) | 0.53 |

Belous también encuentra que el desvío es proporcional a B y a L e inversamente proporcional a I. Esa es exactamente la escala Π·L del modelo de cuerda.

**Consecuencia para nuestro arco (40 A, 2 mm, B propio en L = 4 mT):**
- la inestabilidad empieza con 0.4–1.2 mT, y se vuelve severa con unos 1.6–2 mT;
- en el valle de 10 A, con 0.1–0.3 mT de campo ajeno al circuito.

## 5. Veredictos

| # | Hipótesis | Veredicto | Qué lo decide |
|---|---|---|---|
| H1 | El banco v1 (cables sueltos) tiene arc blow medible | **PASA (modelo):** 0.21–0.32 mT, Π 0.05–0.08, ánodo corrido 68–105 µm (κ 1.5; hasta 2 veces más con κ 0.7), siempre lejos de la pinza; Π < Π* | dos sondas Hall (§7, paso 1) y los puntos (paso 2) |
| H2 | Los cables sueltos son la causa principal | **FALSA:** la placa de 50 mm pone 0.24 mT y los cables 0.03 mT (mediana de 400 ruteos). Excepción: la pinza encima con el cable subiendo suma 0.11 mT | Hall con la pinza arriba contra abajo |
| H3 | Basta con poner el contacto bajo la placa | **FALSA en la tira, PASA en placa ancha o con simetría:** B3 da Π 0.082. Vale solo bajo el arco (C1/C2) o en el perímetro (C4: ≤ 0.041 en toda la placa) | mapa con Hall en 5 puntos |
| H4 | La onda cambia el campo, y con él el arco | **FALSA para el ángulo** (Π ±5–15 %, \|b1\|/\|b0\| 0.95–1.00); **PASA para la fuerza en la gota** (∝ I²: DC/668/1336). Los campos ajenos (residual) sí mecen al arco, ×4 en el valle | sonda Hall a 668 Hz con la onda corriendo |
| H5 | El acero de la placa cambia el cuadro | **INCIERTO:** apantalla 2–7 veces lo externo (B, C), no modelado para la tira, aumenta en los extremos (0.136 → 0.248) | Hall con placa de acero contra aluminio del mismo tamaño |
| H6 | Usar el campo del propio banco para apuntar la gota (l=1) | **FALSA:** 4–12 µN dan 0.3–0.5 µm de l=1 (7–11 µm si f1 ≈ 668 Hz). Mueve el arco, no la gota | — |
| H7 | Bobinas chicas de 3 mT apuntan la gota por l=1 (canon) | **FALSA como canal selectivo:** columna/gota = 0.83–0.88; con Π = 0.8 el ánodo se corre 0.6–1.6 mm y el arco cae en zona inestable; 560–930 A·v, 15–43 W | puntos con bobina a 40 y 70 A (§7, paso 2) |
| H8 | Apuntar el ARCO con B ∝ I (2–4 vueltas del retorno, MOSFETs) | **INCIERTO, prometedor:** Π 0.1–0.2, 130–270 µm, Π constante en la onda, 0.4–0.9 W, +0.1–0.3 µH | ídem; falta saber si la gota sigue al arco o al alambre |

**Lente del operador.**
- **Postulado de canal.** «B transversal × I» no es el canal de l=1: es el canal del ARCO. Hay dos osciladores con el mismo actuador:
  - la columna, sobreamortiguada y cuasi-estática hasta ~kHz, con ganancia de 333 µm/mT;
  - la gota l=1, resonante, con 2.9 µm/mT estático y 88 µm/mT en resonancia, después de 29 ms.

  Ni la frecuencia los separa: aun en resonancia el arco gana 4 a 1. Para un canal propio de la gota haría falta una fuerza que actúe sobre 0.9 mm y no sobre los 2 mm de abajo. Un campo hecho desde 10 mm o más de distancia no puede (§4.7: la razón columna/gota es 0.83–0.88).
- **La mezcla por I².** El campo del propio banco es ∝ I, así que la fuerza es ∝ I² (canales 0, ω y 2ω). Pero el ÁNGULO (Π) es invariante, porque el empuje del jet también es ∝ I². El arco blow del banco es un canal mudo (DC): determinista y calibrable. Rompen esa invariancia los campos que no salen del circuito, y por eso el residual y el terrestre son los que mecen.

## 6. Qué cambia en el banco, el circuito y el firmware

**Banco**
1. **Quita la pinza encima con el cable subiendo** (A4 es el peor caso). Si la pinza se queda, el cable sale a ras de mesa (A1–A3) o hacia abajo.
2. **Agrega un marco de cobre perimetral bajo la placa (C4).** Es una solera de 20×3 mm bajo los 4 bordes, con contacto en todo el perímetro (tornillos o resortes cada 10 mm). Las patas bajan y el cable sale por debajo de la base, recto hacia abajo ≥ 50–80 mm antes de doblar (B2 contra B1: la barra pasa de 0.143 a 0.053 mT). Es la opción fija con mejor mapa: Π ≤ 0.041 en toda la placa.
3. **Antorcha:** que la corriente llegue por el EJE, vertical ≥ 100–150 mm antes de cualquier tramo horizontal. Si el alimentador va atornillado al lado con un brazo a 50 mm, cuesta Π = 0.029. Mejor partir el brazo en dos simétricos (C2 da 0) o subir el alimentador.
4. **Placa más ancha o arco más corto:** Π_tira ≈ L/w. Pasar de 50 a 100 mm de ancho la reduce a la mitad, y cada mm de arco de menos cuenta doble en y(L) ∝ L².
5. **Mide el magnetismo residual de la placa** antes de imprimir. Si pasa de 0.1 mT, desmagnetiza (una bobina con AC que se va apagando) o cambia de placa: en el valle de 10 A, 0.3 mT ya corren 400 µm.

**Circuito**
- El lazo compacto baja de 1.0–1.5 µH a 0.13–0.4 µH, y la energía que absorbe el crowbar al romperse el arco a 70 A baja de 2.4–3.6 mJ a 0.3–1 mJ.
- **Para H8 (opcional):** 2–4 vueltas de cable de 16 mm² en 4 bobinitas a 18 mm del arco, en serie con el retorno, más 4 MOSFETs (pueden ser IRFB4227) que eligen ±x, ±y o el puente directo. Son 0.4–0.9 W y +0.1–0.3 µH contra los 41 µH del choque.

**Firmware**
- **Mapa de corrimiento por posición:** como Π no depende de I, el ladeo del ánodo es un vector fijo por (x, y). Se calibra una vez y el planificador corre la trayectoria −y(L).
- Si hay bobinas independientes, se manejan con B ∝ I(t), en lazo abierto desde el Hall del ACS758, para que Π quede constante en la onda.
- **Se prohíbe B transversal constante mayor a 0.1·(I/10 A) mT.**
- **El canon `apuntar2.py` hay que rehacerlo:** su actuador debe mover el ARCO (y(L) = Π·L/κ, cuasi-estático), no solo la gota.

**Lista de componentes**
- 2 sondas Hall lineales (DRV5055A1, 100 mV/mT, o SS49E), de unos 2 USD.
- Solera de cobre de 20×3 mm, ~0.4 m.
- Opcional: 4 bobinitas y 4 MOSFETs.

## 7. El experimento más barato que lo decide

**Paso 1 (sin arco, 15 min): medir B por ampere con dos sondas Hall.**

*Montaje.*
- Dos DRV5055 a 1 mm sobre la placa, a ±5 mm del alambre, con la cara sensible midiendo B_y (y otras dos en ±y para B_x).
- El alambre tocando la placa como en «contacto»: La Pluma con el tope de 0.22, o una batería con resistencia, a 20–40 A DC.

*Truco.* El campo propio del alambre es igual y opuesto en las dos sondas: 1.6 mT a 5 mm y 40 A. **El promedio de las dos es el campo externo.** La tabla de rejilla del `.out` (§9) lo muestra: en B1, B_y = +1368 y −1870 µT en x = ±5 mm, cuyo promedio es −251 µT.

*Predicción en vacío (µT por ampere):*

| conf | predicción |
|---|---|
| A1 | 5.2 |
| A2 | 6.9 |
| A4 | 8.0 |
| B1 | 6.4 |
| B3 | 8.2 |
| C4 | 3.1 o menos |

*Dirección.* La fuerza (ẑ × B) se aleja de la pinza.

*Cómo se lee.*
- **Si es cierto:** A y B3 medidos dentro de ±30 % del vacío, porque la tira no se apantalla. B1 sobre placa de acero sale 2–4 veces abajo de 6.4 µT/A.
- **Si el modelo falla:** A sale 2 veces o más fuera, y entonces el acero o la geometría real mandan.

**Paso 2 (con arco, el que decide H7 y H8 y mide κ): puntos con la bobina de prueba.**

*Montaje.*
- Antorcha quieta, configuración C4.
- El par de bobinas a 18 mm con una corriente CONSTANTE que dé 0.5 mT en la columna (medido con el Hall antes de soldar; unos 1.3 A con 80 vueltas en vacío, ~3 A con placa de acero).
- 10 puntos con +B y 10 con −B, a 40 A DC; luego lo mismo a 70 A.
- Se mide la separación entre los centroides de +B y −B (microscopio de celular o regla, ±20 µm promediando).

*Predicción si manda el canal del arco (Π ∝ 1/I):*

| I | Π | separación 2y |
|---|---|---|
| 40 A | 0.125 | 333 µm (κ 1.5; 200–710 µm para κ 2.5–0.7) |
| 70 A | 0.071 | 190 µm |

**La razón 40 A / 70 A da 1.75.** La raíz del arco se ve inclinada ±9.5° en foto con filtro.

*Si mandara la gota (l=1, ∝ I·B):* la separación sería de 5 µm o menos (estático 2.9 µm/mT) y la razón 0.57.

*Si no se ve nada (menos de 30 µm a 40 A):* el arco es al menos 10 veces más rígido que el jet de Maecker. Entonces el arc blow del banco es despreciable (H1 FALSA) y apuntar con campo muere (H8 FALSA).

## 8. Fuentes

- Lincoln Electric, *Prevent Arc Blow*: back blow al soldar hacia la conexión, forward blow al alejarse; mover la conexión es «moderadamente efectivo». https://prodcd.lincolnelectric.com/en/Welding-and-Cutting-Resource-Center/Welding-How-Tos/Prevent-Arc-Blow (la página dio 403 al bajarla; el contenido se leyó en el resumen de búsqueda).
- TWI, *How do you prevent arc blow?*: más de 50 G puede dar arc blow; DC; varias conexiones de tierra; arco corto; AC. https://twi-global.com/technical-knowledge/faqs/faq-how-do-you-prevent-arc-blow
- Wikipedia, *Arc blow*: empieza con unos 10 G, es severo con 40 G o más, y es más común en DC (sin citas en línea). https://en.wikipedia.org/wiki/Arc_blow
- Diverse Technologies, *Arc blow background*: tabla TIG/MMA/SAW de 0–10 / 10–20 / 20–40 / más de 40 G; «higher current produces a stiffer arc». https://diverse-technologies.net/arc-blow-background/
- V.Yu. Belous, «Conditions for formation of defect-free welds in narrow-gap magnetically controlled arc welding of low titanium alloys», *The Paton Welding Journal* 3/2011, pp. 16–18: desvío ∝ B_x·L / I; ≥ 8 mT a 400 A con 4 mm. https://patonpublishinghouse.com/tpwj/pdf/2011/pdfarticles/03/5.pdf
- Rolls-Royce, EP 0 827 801 A1, *Welding torch*: TIG a 120 A, desvíos de hasta 10 mm con 17 G. https://data.epo.org/publication-server/rest/v1.2/patents/EP0827801NWA1/document.html
- *Indian Welding Journal* (1977): en inoxidable el desvío es casi lineal con el campo hasta ~20 G y luego el arco se vuelve inestable (solo se vio el resumen). https://informaticsjournals.com/index.php/IWJ/article/download/38803/25408/77170
- Lincoln Global, patente US 2013/0228558 *Work current switching to eliminate arc blow* (conmutar tierras). https://patents.justia.com/patent/20130228558
- *Fabricating & Metalworking*, «Preventing arc blow in robotic tandem MIG»: enrollar el cable de pieza para compensar. https://fandmmag.com/2010/12/preventing-arc-blow-in-robotic-tandem-mig-welding-applications
- SciELO, *Soldagem & Inspeção*, «Two heat source models to simulate welding processes with magnetic deflection»: TIG a 100 A con 6 mm, 25° de inclinación (campo no reportado); cita a Kang y Na (*Welding Journal* 81, 2002, no leído). https://www.scielo.br/j/si/a/8shzRMJXr3Fb4bPLnCcp6vj/?lang=en
- Griffiths, *Introduction to Electrodynamics*, 4.ª ed., ec. 5.36 (referencia de `em.ts`).
- [MEM] Empuje de Maecker (µ0·I²/4π)(ln(R/rc) + ½) y Lancaster, *The Physics of Welding*; resistividad del acero dulce (1.5e-7 Ω·m a 20 °C); µr inicial del acero dulce, 100–300; campo terrestre en el centro de México (~41 µT total, ~27 µT horizontal). Ninguno verificado en línea.
- Cruce con el reporte 03 de esta misma investigación: allí se supuso 0.8 mT para una «pinza mal puesta» (20–35°). El campo del banco calculado aquí es 0.1–0.33 mT, con 2–6° en la raíz. Su conclusión de que 3 mT tuercen el arco 50–70° coincide en orden con la de aquí: Π = 0.75–0.8 da ~40–60° en la raíz con κ = 2.5–1.5, ya fuera del rango lineal del modelo.
