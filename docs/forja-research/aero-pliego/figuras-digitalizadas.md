# Figuras digitalizadas — pliego AERO

Digitalización de las figuras que estaban bloqueadas por ser **imágenes** (el texto extraído no
las contiene). Cada sección trae: transcripción literal, datos, rango, incertidumbre y
verificación cruzada contra los números que el propio libro imprime.

**Método.** No se leyó "a ojo" sobre la pantalla: las páginas se re-renderizaron del PDF a
300–400 dpi y las curvas se trazaron **pixel por pixel** con un script (binarizado + seguimiento
de trazo por continuidad), calibrando con las posiciones reales de las marcas de eje. Eso baja el
error de lectura de ~±2 % (ojo humano) a ~±0.3–1 % (trazado) en las figuras vectoriales de Bertin,
y a ~±1 % en las figuras escaneadas (mapa de bits) de Anderson. Donde el trazado no pudo separar
curvas, se dice y **no se inventan puntos**.

> ⚠️ **AVISO DE ARCHIVOS.** Los PNG que estaban en `figuras/` con nombre `and-00XX` / `and-10XX`
> son **páginas del PDF**, no páginas del libro. Anderson tiene un offset de **+23**
> (PDF 1029 = libro 1006). Por eso **la Fig. 1.58 y las Figs. 18.8/18.9 NO estaban en los PNG
> entregados**. Se re-renderizaron del PDF original:
> - Fig. 1.58 → libro pág. 83 → **PDF pág. 106**
> - Figs. 18.8 y 18.9 → libro pág. 1029 → **PDF pág. 1052**
> - Fig. 18.7 (bonus) → libro pág. 1028 → **PDF pág. 1051**
>
> Bertin sí coincide: `ber-282.png` = PDF 282 = libro 266 (offset +16), y las tres figuras pedidas
> sí estaban ahí.
>
> PDFs fuente: `/home/ian/Orkesta/la-forja/docs/forja-research/manuales/aero/anderson-fundamentals-aerodynamics-2017.pdf`
> y `.../bertin-aerodynamics-engineers-2022.pdf`.

---

## Resumen ejecutivo (lo que desbloquea)

| Figura | Estado | Verificación cruzada contra el libro |
|---|---|---|
| Bertin 5.20 | ✅ digitalizada + **forma cerrada identificada** | laminar = 1.328/√Re a ±1 %; turbulenta lisa = Prandtl-Schlichting a ±2.3 %; mesetas rugosas = Schlichting totalmente-rugoso a ±1–5 % |
| Bertin 5.21 | ✅ 9 curvas, t/c ≥ 0.04 | ejemplo 5.5 del libro: Λ=40°, t/c=0.04 → K=1.06; mi lectura **1.055** ✅ |
| Bertin 5.23 | ✅ curva completa, L/D 3.96–10.35 | ejemplo 5.5: motor L/D≈8 → K=1.15; mi lectura **1.1495** ✅ |
| Anderson 1.58 | ✅ **tabla literal** (exacta, no estimada) | es tabla impresa: transcripción exacta |
| Anderson 18.8 | ✅ 2 curvas, Me 1.2–20 | ejemplo 18.1b: Me=2.94 pared adiabática → 1.2; mi lectura **1.211** ✅ |
| Anderson 18.9 | ✅ 2 curvas, Me 5–20.4 (fusionadas Me<4.5) | Fig. 18.7 (perfil T, M=20, Tw/Te=1) da borde ≈35; mi lectura **36.0** ✅ |

---

# 1. Bertin, Fig. 5.20 — Efecto de la rugosidad superficial

**Ubicación:** `figuras/ber-282.png` (PDF 282 = libro pág. 266).

## a) Transcripción literal

> **Figure 5.20** Effect of surface roughness on skin-friction drag [roughness curves from
> Gollos (1953)].

- **Eje Y:** `C̄f` (Cf con barra = coeficiente de fricción TOTAL de placa plana, adimensional).
  Escala **logarítmica**. Etiquetas impresas: `0.010`, `0.006`, `0.004`, `0.003`, `0.002`, `0.001`.
- **Eje X:** `Re_L = ρUL/μ`. Escala **logarítmica**. Etiquetas: `10⁵`, `10⁶`, `10⁷`, `10⁸`, `10⁹`, `10¹⁰`.
- **Rótulos dentro del cuadro:** `Laminar`, `Smooth-turbulent`.
- **Leyenda derecha:** `Relative grain size` / `k/L`, con las líneas raya-punto etiquetadas
  `10⁻³`, `10⁻⁴`, `10⁻⁵`, `10⁻⁶`, `10⁻⁷` (de arriba hacia abajo).

## b) Datos digitalizados

### b.1 — Línea laminar

Es **exactamente la fórmula de Blasius** `C̄f = 1.328/√Re_L`. No hace falta tabla; la verificación
está en (e). Extensión dibujada: de Re=1×10⁵ (Cf=0.00420) hasta salir por el piso del cuadro en
Re≈1.76×10⁶ (Cf=0.001).

| Re_L | Cf leído | 1.328/√Re | dif |
|---|---|---|---|
| 1.00e5 | 0.00416 | 0.00420 | −0.9 % |
| 1.58e5 | 0.00334 | 0.00334 | +0.1 % |
| 2.51e5 | 0.00265 | 0.00265 | −0.0 % |
| 3.98e5 | 0.00210 | 0.00210 | −0.1 % |
| 6.31e5 | 0.00167 | 0.00167 | −0.2 % |
| 1.00e6 | 0.00132 | 0.00133 | −0.4 % |
| 1.58e6 | 0.00104 | 0.00105 | −1.0 % |
| 1.78e6 | 0.00100 | 0.00100 | +0.8 % |

### b.2 — Curva "Smooth-turbulent"

Es **la fórmula de Prandtl-Schlichting `C̄f = 0.455/(log₁₀Re_L)^2.58`** (sin el término de
transición `−1700/Re_L`, o sea la versión totalmente turbulenta). Concordancia dentro de ±2.3 %
sobre 5 décadas.

| Re_L | Cf leído | 0.455/(log₁₀Re)^2.58 | dif |
|---|---|---|---|
| 1.000e5 | 0.00731 | 0.00716 | +2.1 % |
| 1.778e5 | 0.00646 | 0.00631 | +2.3 % |
| 3.162e5 | 0.00572 | 0.00560 | +2.2 % |
| 5.623e5 | 0.00509 | 0.00499 | +1.9 % |
| 1.000e6 | 0.00455 | 0.00447 | +1.8 % |
| 1.778e6 | 0.00408 | 0.00402 | +1.3 % |
| 3.162e6 | 0.00367 | 0.00364 | +0.9 % |
| 5.623e6 | 0.00332 | 0.00330 | +0.6 % |
| 1.000e7 | 0.00301 | 0.00300 | +0.3 % |
| 1.778e7 | 0.00274 | 0.00274 | −0.2 % |
| 3.162e7 | 0.00251 | 0.00251 | −0.3 % |
| 5.623e7 | 0.00229 | 0.00231 | −0.7 % |
| 1.000e8 | 0.00210 | 0.00213 | −1.1 % |
| 1.778e8 | 0.00194 | 0.00197 | −1.1 % |
| 3.162e8 | 0.00180 | 0.00182 | −1.3 % |
| 5.623e8 | 0.00167 | 0.00169 | −1.4 % |
| 1.000e9 | 0.00155 | 0.00157 | −1.5 % |
| 1.778e9 | 0.00144 | 0.00146 | −1.4 % |
| 3.162e9 | 0.00135 | 0.00137 | −1.2 % |
| 5.623e9 | 0.00126 | 0.00128 | −1.2 % |
| 1.000e10 | 0.00119 | 0.00120 | −0.5 % |

### b.3 — Mesetas de rugosidad (LO IMPORTANTE PARA EL SOFTWARE)

Cada línea raya-punto es un **valor constante de Cf** (régimen totalmente rugoso). Además,
la figura **arranca cada línea justo donde toca la curva lisa** — o sea, la figura ya codifica
el "Reynolds de corte".

| k/L | Cf meseta (leído) | Re donde arranca la línea (leído) | Schlichting (1.89+1.62·log₁₀(L/k))^−2.5 | dif |
|---|---|---|---|---|
| 1×10⁻³ | **0.00835** | < 1.0e5 (entra por el borde izquierdo) | 0.00845 | −1.2 % |
| 1×10⁻⁴ | **0.00486** | 6.8e5 | 0.00493 | −1.4 % |
| 1×10⁻⁵ | **0.00307** | 8.6e6 | 0.00317 | −3.2 % |
| 1×10⁻⁶ | **0.00213** | 9.0e7 | 0.00218 | −2.3 % |
| 1×10⁻⁷ | **0.00150** | 1.24e9 | 0.00157 | −4.5 % |

**Modelo recomendado para el software** (es lo que la figura dibuja, y es autoconsistente):

```
Cf_rugoso(Re, k/L) = max( 0.455/(log10 Re)^2.58 ,  (1.89 + 1.62*log10(L/k))^-2.5 )
```

Los Re de corte que predice esa expresión (5.1e4, 6.5e5, 8.7e6, 9.9e7, 1.5e9) coinciden con los
arranques medidos en la figura (—, 6.8e5, 8.6e6, 9.0e7, 1.24e9) dentro de ~20 %, que es el ancho
del trazo. **Autovalidado.**

## c) Rango

- **X:** Re_L de **1×10⁵ a 1×10¹⁰** (5 décadas). Fuera de eso, no hay respaldo gráfico.
- **Y:** C̄f de **0.001 a 0.010**.
- La **línea laminar** solo está dibujada hasta Re≈1.76×10⁶ (donde sale por abajo).
- La **meseta k/L=10⁻³** entra ya por el borde izquierdo: su cruce con la curva lisa (Re≈5×10⁴)
  queda **fuera** de la figura.

## d) Incertidumbre

- Figura **vectorial** a 400 dpi, trazos limpios, sin traslapes. Muy legible.
- Calibración X (log): marcas perfectamente uniformes (321.0 px/década). Error < 0.3 % en Re.
- Calibración Y: **±0.5 % en Cf** para lecturas puntuales, ±2 % de sesgo sistemático posible
  en la curva turbulenta (ver nota siguiente).
- 🔴 **DEFECTO DE LA FIGURA (importante).** Las marcas intermedias del eje Y de la reimpresión 2022
  **están mal colocadas**: los ticks de 0.006, 0.004, 0.003 y 0.002 están **equiespaciados
  (133 px)**, lo cual es imposible en un eje logarítmico. Si uno lee la figura usando esas marcas
  como referencia, **se equivoca hasta 5 %** cerca de 0.003–0.004.
  - Yo calibré con los extremos (0.010 arriba, 0.001 abajo) asumiendo década pura.
  - Esa elección quedó **probada** porque la línea laminar sale exactamente 1.328/√Re
    (error < 1 % en 12 puntos). Con la calibración por ticks intermedios, la laminar
    NO daría Blasius.
  - **Regla para el software:** no interpolar por los ticks 0.004/0.003. Usar la escala log entre
    0.010 y 0.001.
- 🟡 Segunda simplificación del redibujo: en el original de Gollos las curvas rugosas se
  *despegan suavemente* de la curva lisa; aquí son líneas rectas horizontales que arrancan de
  golpe. El codo es más abrupto que la física real (transición gradual).

## e) Verificación cruzada

1. **Laminar vs Blasius:** 12 puntos, error medio −0.2 %, máximo −1.0 %. ✅ **Validado.**
2. **Turbulenta lisa vs Bertin ec. (5.37)/(4.87):** el libro imprime en la pág. 265
   `C̄f = 0.455/(log₁₀Re_L)^2.58 − 1700/Re_L`. La curva dibujada corresponde al **primer término
   solo**, con +2 % en el extremo bajo y −1.5 % en el alto. ✅ **Validado como Prandtl-Schlichting
   totalmente turbulento.**
3. **Mesetas vs Schlichting totalmente rugoso:** 5 valores, error 1–5 %. ✅ **Validado.**

---

# 2. Bertin, Fig. 5.21 — Factor de forma del ala ⭐

**Ubicación:** `figuras/ber-283.png` (PDF 283 = libro pág. 267).

## a) Transcripción literal

> **Figure 5.21** Wing form factor as a function of wing thickness ratio and quarter-chord sweep
> angle [from Shevell (1989)].

- **Eje Y:** `Form factor, K` — lineal, de `1.0` a `1.50`, marcas cada 0.05.
- **Eje X:** `Thickness ratio, t/c` — lineal, de `0` a `0.20`, marcas cada 0.02.
- **Leyenda (esquina superior derecha):** `Λ_c/4`, y de arriba hacia abajo las 9 curvas:
  `0° − 10°`, `15°`, `20°`, `25°`, `30°`, `35°`, `40°`, `45°`, `50°`.

Se usa con la ec. (5.34): `C_D0 = K·C̄f·S_wet/S_ref`, y `S_wet ≈ 2.0(1+0.2 t/c)·S_expuesta` (5.38).

## b) Datos digitalizados

**Λ_c/4 en grados; K adimensional. Todas las curvas convergen a K = 1.0 en t/c = 0.**

| t/c | 0–10° | 15° | 20° | 25° | 30° | 35° | 40° | 45° | 50° |
|---|---|---|---|---|---|---|---|---|---|
| 0.040 | 1.075 | 1.072 | 1.068 | 1.065 | 1.061 | 1.059 | 1.055 | 1.049 | 1.043 |
| 0.045 | 1.085 | 1.081 | 1.077 | 1.074 | 1.070 | 1.067 | 1.063 | 1.056 | 1.049 |
| 0.050 | 1.095 | 1.091 | 1.087 | 1.083 | 1.078 | 1.075 | 1.070 | 1.063 | 1.055 |
| 0.055 | 1.106 | 1.101 | 1.097 | 1.093 | 1.087 | 1.083 | 1.078 | 1.070 | 1.061 |
| 0.060 | 1.116 | 1.111 | 1.107 | 1.102 | 1.096 | 1.092 | 1.086 | 1.077 | 1.067 |
| 0.065 | 1.127 | 1.122 | 1.117 | 1.111 | 1.105 | 1.100 | 1.094 | 1.084 | 1.074 |
| 0.070 | 1.138 | 1.132 | 1.127 | 1.121 | 1.115 | 1.109 | 1.102 | 1.092 | 1.080 |
| 0.075 | 1.149 | 1.143 | 1.137 | 1.131 | 1.124 | 1.118 | 1.110 | 1.099 | 1.087 |
| 0.080 | 1.161 | 1.154 | 1.148 | 1.141 | 1.134 | 1.127 | 1.119 | 1.107 | 1.094 |
| 0.085 | 1.172 | 1.165 | 1.159 | 1.152 | 1.144 | 1.136 | 1.127 | 1.115 | 1.101 |
| 0.090 | 1.184 | 1.176 | 1.170 | 1.162 | 1.154 | 1.145 | 1.136 | 1.123 | 1.109 |
| 0.095 | 1.196 | 1.188 | 1.181 | 1.173 | 1.164 | 1.155 | 1.145 | 1.131 | 1.116 |
| 0.100 | 1.208 | 1.200 | 1.192 | 1.184 | 1.175 | 1.165 | 1.154 | 1.139 | 1.124 |
| 0.105 | 1.221 | 1.212 | 1.204 | 1.195 | 1.186 | 1.175 | 1.163 | 1.148 | 1.133 |
| 0.110 | 1.234 | 1.224 | 1.216 | 1.207 | 1.197 | 1.186 | 1.172 | 1.157 | 1.141 |
| 0.115 | 1.247 | 1.237 | 1.229 | 1.219 | 1.209 | 1.196 | 1.182 | 1.166 | 1.150 |
| 0.120 | 1.260 | 1.250 | 1.241 | 1.231 | 1.220 | 1.207 | 1.192 | 1.176 | 1.160 |
| 0.125 | 1.274 | 1.263 | 1.254 | 1.243 | 1.232 | 1.218 | 1.202 | 1.186 | 1.169 |
| 0.130 | 1.288 | 1.277 | 1.268 | 1.256 | 1.245 | 1.230 | 1.213 | 1.196 | 1.179 |
| 0.135 | 1.303 | 1.290 | 1.281 | 1.269 | 1.258 | 1.242 | 1.224 | 1.207 | 1.189 |
| 0.140 | 1.318 | 1.305 | 1.295 | 1.283 | 1.271 | 1.254 | 1.236 | 1.218 | 1.200 |
| 0.145 | 1.333 | 1.320 | 1.310 | 1.297 | 1.285 | 1.267 | 1.249 | 1.230 | 1.212 |
| 0.150 | 1.349 | 1.335 | 1.325 | 1.312 | 1.299 | 1.280 | 1.262 | 1.243 | 1.224 |
| 0.155 | 1.366 | 1.351 | 1.341 | 1.327 | 1.314 | 1.294 | 1.277 | 1.256 | 1.236 |
| 0.160 | 1.383 | 1.368 | 1.357 | 1.343 | 1.329 | 1.309 | 1.291 | 1.270 | 1.249 |
| 0.165 | 1.401 | 1.385 | 1.374 | 1.360 | 1.345 | 1.325 | 1.307 | 1.284 | 1.263 |
| 0.170 | 1.419 | 1.403 | 1.392 | 1.378 | 1.361 | 1.341 | 1.323 | 1.299 | 1.277 |
| 0.175 | 1.439 | 1.422 | 1.412 | 1.396 | 1.379 | 1.359 | 1.339 | 1.315 | 1.292 |
| 0.180 | 1.459 | 1.441 | 1.431 | 1.416 | 1.396 | 1.377 | 1.355 | 1.332 | 1.307 |

**Zona 0 < t/c < 0.04:** las 9 curvas están **dentro del ancho del trazo** (el abanico nace del
origen). Ahí NO doy 9 valores separados — sería inventar. Solo hay dos anclas honestas:

| t/c | dato | confianza |
|---|---|---|
| 0.000 | K = 1.000 (las 9 curvas) | alta — el abanico nace del origen, y es lo físicamente correcto (placa plana sin espesor) |
| 0.020 | 40°: 1.031 · 45°: 1.024 · 50°: 1.021 (las curvas exteriores, las únicas separables) | media, ±0.010 |
| 0.030 | 45°: 1.037 · 50°: 1.032 | media, ±0.010 |

**Recomendación:** para t/c < 0.04 interpolar linealmente entre (0, 1.000) y el valor tabulado en
t/c = 0.04. Ese esquema reproduce el 40° a t/c=0.02 con error 0.004, dentro de la banda.

## c) Rango

- **Eje X impreso:** t/c de 0 a 0.20.
- 🔴 **Las curvas SOLO están dibujadas hasta t/c = 0.180.** El tramo 0.18–0.20 del eje está vacío.
  El software debe marcar t/c > 0.18 como **extrapolación sin respaldo**.
- **Eje Y impreso:** K de 1.0 a 1.50. La curva más alta (0–10°) llega a 1.459 en t/c = 0.18.
- **Barrido:** Λ_c/4 de 0° a 50°. **Fuera de 0–50° no hay curva** (relevante: el propio ejemplo 5.5
  del libro aplica esta figura a un *strake* del F-16, que tiene barrido muchísimo mayor a 50°).
- 🟡 **Ojo con la definición de barrido.** El pie de figura dice **Λ_c/4 (cuarto de cuerda)**, pero
  el texto del ejemplo 5.5 (pág. 272) dice *"for a **leading-edge** sweep of 40°"*. El libro mismo
  es inconsistente. Sugerencia: el software debe exponer explícitamente cuál barrido usa
  y documentar que la fuente es cuarto de cuerda.

## d) Incertidumbre

- Figura **vectorial** a 400 dpi. Ejes con marcas perfectamente uniformes (175.5 px por 0.05 en Y,
  140.4 px por 0.02 en X; residuos < 0.5 px). Calibración prácticamente exacta.
- Las 9 curvas quedan **separadas y trazables sin ambigüedad para t/c ≥ 0.0398**. El trazador las
  siguió columna a columna sin ninguna colisión en ese rango (996–1206 muestras por curva).
- **Banda de error: ±0.004 en K** para t/c ≥ 0.04 (dominada por el semiancho del trazo, ~7 px ≈ 0.002,
  más el redondeo de calibración).
- **Banda de error: ±0.010 en K** en la zona 0.02–0.04 para las tres curvas exteriores.
- **NO LEGIBLE:** curvas de 0–10° a 35° para t/c < 0.038. Declarado, no inventado.

## e) Verificación cruzada

El libro, ejemplo 5.5 (pág. 272), imprime:

> *"From Fig. 5.21 for a leading-edge sweep of 40° and a thickness ratio of 0.04, **K = 1.06**"*

Mi lectura para 40° / t/c=0.04: **1.0553** → redondea a **1.06**. ✅ **Coincide.**

Otros valores de la Tabla 5.4 del libro (menos definitivos porque no dicen el barrido):

| componente F-16 | t/c | K del libro | mi tabla | comentario |
|---|---|---|---|---|
| Ala | 0.04 | 1.06 | 1.055 @40° | ✅ coincide |
| Cola horizontal | 0.04 | 1.06 | 1.055 @40° | ✅ coincide |
| Estabilizador vertical exterior | 0.06 | 1.08 | 1.086 @40° | ✅ coincide |
| Aletas dorsales | 0.03 | 1.04 | ~1.035 @45–50° | ✅ plausible |
| Strake | 0.06 | 1.04 | mínimo de mi tabla = 1.067 @50° | 🟡 **fuera de la figura** — el strake tiene barrido ≫50°, extrapolaron |
| Estabilizador vertical interior | 0.10 | 1.04 | mínimo de mi tabla = 1.124 @50° | 🔴 **INCONSISTENTE con la Fig. 5.21** para cualquier barrido ≤ 50°. No confiar en ese renglón de la Tabla 5.4 |

---

# 3. Bertin, Fig. 5.23 — Factor de forma del fuselaje ⭐

**Ubicación:** `figuras/ber-284.png` (PDF 284 = libro pág. 268).

## a) Transcripción literal

> **Figure 5.23** Body form factor as a function of fuselage fineness ratio [from Shevell (1989)].

- **Eje Y:** `Body form factor, K` — lineal, marcas etiquetadas `1.05`, `1.10`, `1.15`, `1.20`,
  `1.25`, `1.30`, `1.35`, `1.40`.
- **Eje X:** `Fineness ratio, L/D` — lineal, marcas `3`, `4`, `5`, `6`, `7`, `8`, `9`, `10`, `11`.
- **Anotación dentro del cuadro:** `M∞ = 0.50`. **Una sola curva.**

Definición de L/D en el libro: longitud del fuselaje / diámetro máximo (pág. 268). Nada que ver
con sustentación/arrastre. La geometría está en la Fig. 5.22 (`L = L_nose + L_body + L_tail`).

## b) Datos digitalizados

| L/D | K |
|---|---|
| 3.96 | 1.400 (la curva entra por el borde superior) |
| 4.0 | 1.396 |
| 4.2 | 1.367 |
| 4.4 | 1.344 |
| 4.6 | 1.323 |
| 4.8 | 1.305 |
| 5.0 | 1.289 |
| 5.2 | 1.275 |
| 5.4 | 1.261 |
| 5.6 | 1.249 |
| 5.8 | 1.238 |
| 6.0 | 1.228 |
| 6.2 | 1.218 |
| 6.4 | 1.209 |
| 6.6 | 1.201 |
| 6.8 | 1.193 |
| 7.0 | 1.185 |
| 7.2 | 1.177 |
| 7.4 | 1.170 |
| 7.6 | 1.163 |
| 7.8 | 1.156 |
| 8.0 | 1.150 |
| 8.2 | 1.143 |
| 8.4 | 1.137 |
| 8.6 | 1.131 |
| 8.8 | 1.125 |
| 9.0 | 1.119 |
| 9.2 | 1.113 |
| 9.4 | 1.107 |
| 9.6 | 1.102 |
| 9.8 | 1.096 |
| 10.0 | 1.091 |
| 10.2 | 1.086 |
| **10.35** | **1.083 ← FIN DE LA CURVA** |

**Ajuste sugerido** (potencia, R² alto sobre 4 ≤ L/D ≤ 10.35):

```
K(L/D) ≈ 1 + 3.847 * (L/D)^-1.603
```

Reproduce 1.218 @ L/D=6 (leído 1.228) y 1.091 @ L/D=10 (leído 1.091).

## c) Rango — 🔴 ESTE ES EL PUNTO CRÍTICO

- **Eje X impreso:** 3 a 11.
- **La curva SOLO existe entre L/D = 3.96 y L/D = 10.35.**
  - Por la izquierda **se sale por arriba** en L/D ≈ 3.96 (K = 1.40). Para L/D < 3.96 **no hay dato**.
  - Por la derecha **termina en L/D = 10.35, K = 1.083**. El tramo 10.35–11 del eje está vacío.
- **Eje Y impreso:** 1.05 en la marca más baja; el borde inferior del cuadro corresponde a
  K = 1.040.
- 🔴 **El propio libro extrapola.** Ejemplo 5.5, pág. 273: usa **L/D = 13.067** — es decir
  **2.7 unidades más allá del fin de la curva** — y el libro lo admite entre paréntesis.

**Regla dura para el software:** marcar `L/D < 3.96` y `L/D > 10.35` como **EXTRAPOLADO**. Si se
extrapola, decir con qué modelo:

| método de extrapolación a L/D = 13.067 | K |
|---|---|
| lineal desde los últimos 2 puntos (9.5 → 10.35) | 1.014 |
| **ajuste potencia `1 + 3.847·(L/D)^−1.603`** | **1.063** |
| **lo que imprime el libro** | **1.05** |

Lo que hizo Shevell/Bertin es un ojímetro de curva suave, y cae entre las dos. Recomiendo que el
software use el ajuste potencia (1.063) y **avise**, o replique el 1.05 del libro con bandera
"valor del libro, extrapolado".

## d) Incertidumbre

- Figura **vectorial** a 400 dpi, **una sola curva**, sin traslapes, sin ambigüedad. Es la lectura
  más limpia del lote.
- Calibración: marcas de Y uniformes a 204.6 px por 0.05 (residuo < 1 px); marcas de X uniformes a
  164.75 px por unidad.
- **Banda de error: ±0.003 en K** (semiancho del trazo ≈ 5 px ≈ 0.0012, más calibración).
  En L/D esa banda es ±0.05.
- Trazado monótono verificado (ningún salto hacia arriba) sobre 1053 columnas.

## e) Verificación cruzada

Tabla 5.5 del libro (pág. 273), componentes tipo cuerpo del F-16:

| componente | L/D implícito | K del libro | mi curva | comentario |
|---|---|---|---|---|
| Motor (medio cilindro), L=30 ft | ≈ 8.0 (D≈3.75 ft) | **1.15** | **1.1495** | ✅ **coincidencia excelente** |
| Canopy, L=11 ft | ≈ 5.55 | 1.25 | 1.252 @ L/D=5.55 | ✅ coincide |
| Fuselaje, L=49 ft | **13.067** | 1.05 | fuera de rango (fin en 10.35) | 🔴 extrapolado, ver (c) |
| Costado (medio cilindro), L=24 ft | — | 1.01 | K=1.01 no existe en la curva (mínimo 1.083) | 🔴 extrapolado muy lejos |

**El punto del motor (L/D≈8 → K=1.15 vs mi 1.1495) valida la digitalización.**

---

# 4. Anderson, Fig. 1.58 — Desglose de arrastre del Seversky XP-41 ⭐

**Ubicación:** libro pág. 83 = **PDF pág. 106** (NO estaba en los PNG entregados).

## a) Transcripción literal

> **Figure 1.58** The breakdown of various sources of drag on a late 1930s airplane, the Seversky
> XP-41 (derived from the Seversky P-35 shown in Figure 3.2). [*Source:* Experimental data from
> Coe, Paul J., "Review of Drag Cleanup Tests in Langley Full-Scale Tunnel (From 1935 to 1945)
> Applicable to Current General Aviation Airplanes," NASA TN-D-8206, 1976].

Encabezado del cuadro (arriba de los dibujitos): `Airplane condition`.
Columnas de la tabla: `Condition number` · `Description` · `C_D (C_L = 0.15)` · `ΔC_D` · `ΔC_D, %ᵃ`.
Nota al pie: `ᵃPercentages based on completely faired condition with long nose fairing.`

## b) Datos — **TABLA LITERAL, NO ESTIMADA** (esto es exacto)

| # | Description | C_D (C_L = 0.15) | ΔC_D | ΔC_D, % |
|---|---|---|---|---|
| 1 | Completely faired condition, long nose fairing | 0.0166 | — | — |
| 2 | Completely faired condition, blunt nose fairing | 0.0169 | — | — |
| 3 | Original cowling added, no airflow through cowling | 0.0186 | 0.0020 | 12.0 |
| 4 | Landing-gear seals and fairing removed | 0.0188 | 0.0002 | 1.2 |
| 5 | Oil cooler installed | 0.0205 | 0.0017 | 10.2 |
| 6 | Canopy fairing removed | 0.0203 | −0.0002 | −1.2 |
| 7 | Carbureter air scoop added | 0.0209 | 0.0006 | 3.6 |
| 8 | Sanded walkway added | 0.0216 | 0.0007 | 4.2 |
| 9 | Ejector chute added | 0.0219 | 0.0003 | 1.8 |
| 10 | Exhaust stacks added | 0.0225 | 0.0006 | 3.6 |
| 11 | Intercooler added | 0.0236 | 0.0011 | 6.6 |
| 12 | Cowling exit opened | 0.0247 | 0.0011 | 6.6 |
| 13 | Accessory exit opened | 0.0252 | 0.0005 | 3.0 |
| 14 | Cowling fairing and seals removed | 0.0261 | 0.0009 | 5.4 |
| 15 | Cockpit ventilator opened | 0.0262 | 0.0001 | 0.6 |
| 16 | Cowling venturi installed | 0.0264 | 0.0002 | 1.2 |
| 17 | Blast tubes added | 0.0267 | 0.0003 | 1.8 |
| 18 | Antenna installed | 0.0275 | 0.0008 | 4.8 |
| | **Total** | | **0.0109** | |

**Notas de consistencia (mías, verificadas a mano):**
- `C_D` de la condición 18 (avión operativo completo) = **0.0275**; el de la condición 1
  (limpio) = 0.0166. Incremento total = 0.0109 → **+65.7 %**, que es lo que dice el texto
  ("more than 65 percent").
- La suma de la columna ΔC_D del 3 al 18 da 0.0109 exacto. ✅ **La tabla cierra.**
- Los porcentajes son ΔC_D / 0.0166 (base = condición 1). Verificado: 0.0020/0.0166 = 12.05 % ✅.
- ⚠️ Hay un salto de contabilidad entre las condiciones 2 y 3: C_D pasa de 0.0169 a 0.0186
  (Δ = 0.0017), pero la tabla imprime ΔC_D = 0.0020 (= 0.0186 − 0.0166, o sea contra la
  condición **1**, no la 2). Es intencional (la nota al pie lo dice), pero **si el software suma
  incrementos hay que usar la columna ΔC_D, no restar C_D consecutivos.**
- ⚠️ La condición 6 tiene ΔC_D **negativo** (−0.0002): quitar el carenado de la cabina bajó el
  arrastre. Es dato real, no error de lectura.
- Condiciones `C_L = 0.15`, túnel de escala real NACA Langley (sección 30×60 ft), fines de los 1930s.

## c) Rango

No es una gráfica: es una tabla discreta de 18 configuraciones a un solo `C_L = 0.15`, un solo
número de Mach (bajo subsónico) y un solo avión. **No es interpolable en ninguna variable.**
Su uso correcto es como **catálogo de deltas típicos por componente** para un estimador conceptual,
normalizados contra `C_D` limpio = 0.0166.

## d) Incertidumbre

**CERO error de digitalización** en los números: es una tabla impresa, no una curva. La leí
directamente del render a 300 dpi y es perfectamente legible (dígitos nítidos, sin ambigüedad
entre 3/8, 5/6, etc.). Los checks aritméticos de arriba cierran, lo que confirma la transcripción.

Único punto de duda de OCR: la ortografía `Carbureter` (así, con "e") en el renglón 7 — es como
está impreso en el libro, no un error mío.

## e) Verificación cruzada

Texto de Anderson, pág. 82:
> *"its drag coefficient (measured at an angle of attack corresponding to a lift coefficient of
> C_L = 0.15) is **C_D = 0.0166**"* ✅
> *"the drag coefficient is increased by **more than 65 percent**"* ✅ (65.7 %)
> *"the value of C_D for the aircraft in full operational condition is **0.0275**"* ✅

Tres coincidencias exactas. **Transcripción validada.**

---

# 5. Anderson, Fig. 18.8 — Cf de fricción, capa límite laminar compresible

**Ubicación:** libro pág. 1029 = **PDF pág. 1052** (NO estaba en los PNG entregados).

## a) Transcripción literal

> **Figure 18.8** Friction drag coefficient for laminar, compressible flow over a flat plate,
> illustrating the effect of Mach number and wall temperature. Pr = 0.75.
> (*Calculations by E. R. van Driest, NACA Tech. Note 2597*).

- **Eje Y:** `C_f √Re_c` (adimensional). Marcas etiquetadas `1.4`, `1.0`, `0.6`; hay marcas menores
  sin etiqueta en 1.2 y 0.8. **El eje tiene un quiebre (zigzag) debajo de 0.6.**
- **Eje X:** `M_e`. Marcas `0`, `4`, `8`, `12`, `16`, `20`.
- **Anotaciones:** línea horizontal a trazos rotulada `1.328`; curva superior `T_w/T_e = 1.0`;
  curva inferior `Adiabatic wall`.

Se usa con la ec. (18.44): `C_f = (1.328/√Re_c) · F(M_e, Pr, T_w/T_e)`.

## b) Datos digitalizados

| M_e | T_w/T_e = 1.0 | pared adiabática |
|---|---|---|
| 0 | 1.328 * | 1.328 * |
| 1.5 | 1.315 | 1.284 |
| 2.0 | 1.312 | 1.263 |
| 2.5 | 1.306 | 1.238 |
| 3.0 | 1.296 | 1.208 |
| 3.5 | 1.285 | 1.177 |
| 4.0 | 1.274 | 1.144 |
| 4.5 | 1.260 | 1.115 |
| 5.0 | 1.246 | 1.087 |
| 5.5 | 1.232 | 1.057 |
| 6.0 | 1.216 | 1.027 |
| 6.5 | 1.197 | 1.002 |
| 7.0 | 1.178 | 0.977 |
| 7.5 | 1.160 | 0.955 |
| 8.0 | 1.142 | 0.933 |
| 8.5 | 1.125 | 0.913 |
| 9.0 | 1.108 | 0.894 |
| 9.5 | 1.092 | 0.875 |
| 10.0 | 1.076 | 0.861 |
| 10.5 | 1.060 | 0.845 |
| 11.0 | 1.046 | 0.829 |
| 11.5 | 1.032 | 0.815 |
| 12.0 | 1.016 | 0.802 |
| 12.5 | 1.008 | 0.790 |
| 13.0 | 0.991 | 0.777 |
| 13.5 | 0.982 | 0.765 |
| 14.0 | 0.969 | 0.752 |
| 14.5 | 0.957 | 0.743 |
| 15.0 | 0.946 | 0.733 |
| 15.5 | 0.935 | 0.724 |
| 16.0 | 0.925 | 0.714 |
| 16.5 | 0.916 | 0.706 |
| 17.0 | 0.906 | 0.697 |
| 17.5 | 0.895 | 0.689 |
| 18.0 | 0.887 | 0.683 |
| 18.5 | 0.878 | 0.673 |
| 19.0 | 0.868 | 0.667 |
| 19.5 | 0.861 | 0.659 |
| **20.0** | **0.857** | **0.655** |

\* **M_e = 0 no es lectura**, es el anclaje impreso en la propia figura (la línea a trazos
rotulada `1.328`) y el límite incompresible de la ec. (18.22) `C_f = 1.328/√Re_c`. Ambas curvas
nacen ahí. Es dato del libro, no interpolación mía.

Como el software probablemente quiere la función `F` de la ec. (18.44): `F = tabla/1.328`.
Ej.: adiabática @ M_e=10 → F = 0.861/1.328 = **0.648**.

## c) Rango

- **X:** M_e de **0 a 20** (las curvas terminan exactamente en la marca de 20).
- **Y:** el rango dibujado va de 1.328 (arriba) a 0.655 (abajo). El eje tiene quiebre, así que la
  zona bajo 0.6 no existe.
- **Pr = 0.75 fijo.** Solo dos condiciones de pared: `T_w/T_e = 1.0` y adiabática. **No hay
  familia de curvas para otros T_w/T_e** — el software no puede interpolar en pared con esta figura.
- Nota del libro (pág. 1030): `c_f` local tiene "la misma variación con M_e y T_w/T_e que la
  mostrada en la Figura 18.8" — o sea la misma F sirve para el coeficiente local.

## d) Incertidumbre

- Figura **escaneada (mapa de bits)** dentro del PDF, no vectorial. Resolución efectiva ~300 dpi;
  el trazo mide 4–6 px de grueso. Es la limitante.
- Calibración Y: ajuste lineal sobre 5 marcas, **residuo máximo 0.007** en C_f√Re. La línea a
  trazos "1.328" cae en 1.320–1.323 con mi calibración: **sesgo de −0.006**.
- Calibración X: ajuste sobre 5 marcas, residuo máximo 0.05 en M_e. Pero el eje Y está dibujado
  ~5 px a la derecha del cero implícito → **incertidumbre de ±0.2 en M_e** cerca del origen.
- **Banda de error recomendada: ±0.015 en C_f√Re_c** (≈ ±1.2 %), y ±0.2 en M_e.
- 🔴 **NO LEGIBLE: M_e < 1.2.** Ahí las dos curvas y la línea a trazos de 1.328 están fundidas en
  un solo trazo. Los valores de la tabla arrancan en M_e = 1.5. Para 0 < M_e < 1.5 lo honesto es
  interpolar entre 1.328 (M_e=0) y el valor de M_e=1.5, sabiendo que la curva real es plana ahí.
- Las curvas están **bien separadas y sin traslape** de M_e = 1.5 a 20 (el trazador las siguió
  594 y 598 columnas sin una sola colisión).

## e) Verificación cruzada — ✅ VALIDADA

Anderson, Ejemplo 18.1(b), pág. 1031:

> *"Clearly, the flow is compressible... **From Figure 18.8, we have for M∞ = M_e = 2.94 and an
> adiabatic wall, C_f √Re_c = 1.2**"*

Mi lectura para M_e = 2.94, pared adiabática: **1.211**.

Diferencia: **+0.9 %**, dentro de mi banda declarada de ±1.2 %. El libro reporta con 2 cifras
(1.2), mi 1.211 redondea a 1.2. ✅ **Digitalización validada.**

Segundo check: el libro remata el ejemplo con `C_f = 1.2/√(1.36e8) = 1.03e−4` — coherente.

---

# 6. Anderson, Fig. 18.9 — Espesor de capa límite laminar compresible

**Ubicación:** libro pág. 1029 = **PDF pág. 1052**.

## a) Transcripción literal

> **Figure 18.9** Boundary-layer thickness for laminar, compressible flow over a flat plate,
> illustrating the effect of Mach number and wall temperature. Pr = 0.75.
> (*Calculations by E. R. van Driest, NACA Tech. Note 2597*).

- **Eje Y:** `(δ/x) √Re_x` (adimensional). Marcas etiquetadas `40`, `80`, `120`; marcas menores sin
  etiqueta en 20, 60, 100. **Sin quiebre de eje** — la línea del eje baja continua hasta el eje X,
  y el eje X corresponde al valor 0.
- **Eje X:** `M_e`. Marcas etiquetadas `0`, `4`, `8`, `12`, `16`, `20`, con marcas menores cada 2.
- **Anotaciones:** curva superior `Adiabatic wall`; curva inferior `T_w/T_e = 1`.

Se usa con la ec. (18.45): `δ = (5.0x/√Re_x) · G(M_e, Pr, T_w/T_e)`.

## b) Datos digitalizados

| M_e | fusionadas (una sola línea) | T_w/T_e = 1 | pared adiabática |
|---|---|---|---|
| 0 | 7.8 ⚠ | — | — |
| 0.5 | 8.1 ⚠ | — | — |
| 1.0 | 8.1 ⚠ | — | — |
| 1.5 | 8.2 ⚠ | — | — |
| 2.0 | 8.2 ⚠ | — | — |
| 2.5 | 8.7 ⚠ | — | — |
| 3.0 | 9.3 ⚠ | — | — |
| 3.5 | 9.5 ⚠ | — | — |
| 4.0 | 9.6 ⚠ | — | — |
| 4.5 | 10.7 ⚠ | — | — |
| 5.0 | — | 10.1 | 12.4 |
| 5.5 | — | 10.4 | 13.5 |
| 6.0 | — | 10.7 | 14.4 |
| 6.5 | — | 11.3 | 16.0 |
| 7.0 | — | 11.6 | 17.5 |
| 7.5 | — | 12.4 | 19.4 |
| 8.0 | — | 13.0 | 21.4 |
| 8.5 | — | 13.8 | 23.4 |
| 9.0 | — | 14.4 | 25.2 |
| 9.5 | — | 15.0 | 27.4 |
| 10.0 | — | 15.8 | 29.5 |
| 10.5 | — | 16.6 | 32.3 |
| 11.0 | — | 17.5 | 34.8 |
| 11.5 | — | 18.4 | 37.5 |
| 12.0 | — | 19.2 | 40.1 |
| 12.5 | — | 20.3 | 42.8 |
| 13.0 | — | 21.2 | 45.4 |
| 13.5 | — | 22.2 | 48.2 |
| 14.0 | — | 23.1 | 50.9 |
| 14.5 | — | 23.7 | 53.6 |
| 15.0 | — | 24.9 | 57.0 |
| 15.5 | — | 25.8 | 60.2 |
| 16.0 | — | 26.9 | 63.6 |
| 16.5 | — | 28.0 | 67.2 |
| 17.0 | — | 28.9 | 70.9 |
| 17.5 | — | 30.3 | 74.8 |
| 18.0 | — | 31.2 | 78.7 |
| 18.5 | — | 32.6 | 83.9 |
| 19.0 | — | 33.5 | 87.6 |
| 19.5 | — | 34.8 | 92.4 |
| 20.0 | — | 36.0 | 96.6 |
| **20.4** | — | **36.8** | **100.2** ← fin de las curvas |

⚠️ **Los valores marcados de M_e ≤ 4.5 son de la ZONA FUNDIDA**: las dos curvas están dibujadas
una sobre otra y no se pueden separar. Además ahí hay un problema de escala — ver (d)/(e).

## c) Rango

- **X:** M_e de **0 a ~20.4** (las curvas se pasan un poquito de la marca de 20).
- **Y:** de ~8 (M_e=0) hasta 100.2 (adiabática @ M_e=20.4). El eje impreso llega a 120 pero
  ninguna curva pasa de 100.
- Las curvas **se separan visualmente a partir de M_e ≈ 4.4**. Antes de eso: una sola línea.
- **Pr = 0.75 fijo**, solo dos condiciones de pared. Igual que la 18.8: no se puede interpolar
  en T_w/T_e.

## d) Incertidumbre

- Figura **escaneada**, trazo de 4–5 px. Peor que la 18.8 porque el rango de Y es más grande.
- Calibración: usé **interpolación por tramos** entre las 7 marcas (120/100/80/60/40/20 y el eje X
  como 0) porque el escaneo tiene distorsión no uniforme (espaciados de 59 a 67 px entre marcas
  que deberían ser iguales). Al releer las propias marcas con esa calibración se recuperan
  120.0 / 100.2 / 80.0 / 60.0 / 40.0 / 20.0 ✅.
- **Banda de error recomendada: ±1.5 unidades absolutas** para valores por debajo de 40, y
  **±3 % relativo** por arriba de 40.
- **Banda en M_e: ±0.15.**
- 🔴 **NO LEGIBLE, y lo digo claro: M_e < 4.4.** Las dos curvas están fundidas en un trazo de 7–8 px
  de grueso (dos líneas de 4 px superpuestas). Los valores 7.8–10.7 de la primera columna son la
  línea fundida, no una curva individual.
- 🔴 **INCONSISTENCIA EN EL ORIGEN.** Mi lectura en M_e≈0 da **≈ 8**, pero la ec. (18.23) del propio
  libro dice `δ = 5.0x/√Re_x`, o sea que la figura DEBERÍA arrancar en **5.0**. Investigado:
  - No es la calibración: leer las marcas de vuelta da exactamente 120/100/80/60/40/20.
  - No hay quiebre de eje: la columna del eje Y tiene tinta continua de la fila 1163 a la 1595.
  - Es que **las dos curvas están dibujadas ~10 px arriba de donde deberían**, cerca del origen —
    ancho de trazo + imprecisión del grabado del original de 1952.
  - **Recomendación dura para el software: NO usar los valores absolutos de M_e < 5.** Usar
    `G(M_e) = lectura(M_e) / 5.0` a partir de M_e = 5, y `G ≈ 1` para M_e → 0
    (que es lo que la ec. 18.45 exige por construcción).

## e) Verificación cruzada

El libro **no imprime ningún valor leído de la Fig. 18.9** — no hay ejemplo numérico que la use.
No hay cross-check directo. Pero encontré dos **cross-checks indirectos**:

1. **Contra la Fig. 18.7** (misma página anterior, libro pág. 1028, misma fuente van Driest,
   placa fría con `T_w/T_e = 1`). Digitalicé el borde de su perfil de temperatura para M∞ = 20:
   la curva regresa a `T/T_e = 1` en `(y/x)√Re_x ≈ 35`.
   Mi Fig. 18.9 para `T_w/T_e = 1` @ M_e=20 da **36.0**. Diferencia **+3 %**.
   ✅ **La calibración de la Fig. 18.9 (cero en el eje X) queda confirmada.** (Nota: δ térmico y
   δ de velocidad no son idénticos con Pr=0.75, así que no se debe esperar coincidencia exacta.)
2. **Consistencia con la Fig. 18.8.** El libro dice que pared caliente (adiabática) engrosa la capa
   y baja Cf. Mis dos digitalizaciones lo cumplen: en 18.9 adiabática > T_w/T_e=1 siempre,
   y en 18.8 adiabática < T_w/T_e=1 siempre. ✅

---

## LO QUE NO PUDE LEER

Declarado explícitamente para que nadie lo rellene con inventos:

1. **Fig. 5.21 — las curvas de 0–10° a 35° para t/c < 0.038.** Las 9 curvas nacen del origen y
   están dentro del ancho del trazo. Solo las 3 exteriores (40°, 45°, 50°) se separan antes de
   0.04, y con banda ampliada ±0.010. **No hay 9 valores separados abajo de t/c = 0.038.**
2. **Fig. 5.21 — t/c > 0.18.** No hay curva dibujada, aunque el eje llegue a 0.20.
3. **Fig. 5.21 — barridos > 50° o < 0°.** No existen en la figura.
4. **Fig. 5.23 — L/D < 3.96 y L/D > 10.35.** La curva no está dibujada ahí. El valor K=1.05 que el
   libro usa para L/D=13.067 **es extrapolación del libro, no lectura de la figura**.
5. **Fig. 18.8 — M_e < 1.2.** Curvas fundidas con la línea de referencia 1.328.
6. **Fig. 18.9 — M_e < 4.4.** Las dos curvas están fundidas en un solo trazo; y además esa zona
   tiene el problema de origen (lee ~8 donde debería leer 5.0). **Zona inutilizable.**
7. **Figs. 18.8 y 18.9 — cualquier T_w/T_e que no sea 1.0 o adiabático.** Solo hay dos curvas.
   Interpolar en temperatura de pared no tiene respaldo en estas figuras.
8. **Fig. 5.20 — el cruce de la meseta k/L = 10⁻³ con la curva lisa** (Re ≈ 5×10⁴) cae fuera del
   eje. También: la figura redibujada NO muestra la transición gradual del original de Gollos, solo
   el codo abrupto.
9. **Fig. 5.20 — las marcas de 0.004 y 0.003 del eje Y están mal colocadas** en la reimpresión 2022.
   No usarlas para calibrar (ver sección 1d).

---

## OTRAS FIGURAS VALIOSAS VISTAS AL PASO

Para una ronda futura. No digitalizadas.

### Bertin (Aerodynamics for Engineers, 6ª ed.)

| Ref | Página (libro/PDF) | Qué contiene |
|---|---|---|
| **Ec. (5.35)–(5.40)** | 265–269 / 281–285 | Cadena completa del método Shevell: `mac` de ala trapezoidal, `Re_L` con mac, Prandtl-Schlichting con corrección laminar (5.37), `S_wet` de ala (5.38) y `S_wet` de fuselaje por conos+cilindro (5.39/5.40: `0.75πDL_nose`, `πDL_body`, `0.72πDL_tail`). **Es el algoritmo completo, ya en texto plano — no hace falta digitalizar nada.** |
| **Fig. 5.19** | 265 / 281 | Geometría de ala trapezoidal (c_r, c_t, Λ, b/2, mac). Esquema, no datos. |
| **Fig. 5.22** | 268 / 284 | Geometría de fuselaje de sección circular (L_nose, L_body, L_tail, D, L). Define el L/D de la Fig. 5.23. Esquema. |
| **Fig. 5.24** | 269 / 285 | Foto anotada con los componentes que arrastran (alas/estabilizadores, fuselaje, pilón, góndola). Solo ilustrativa. |
| **TABLA 5.2** | 270 / 286 | **F-16 superficies tipo ala: span, c_r, c_t, t/c, S_wet** para 6 grupos (ala, cola horizontal, strake, verticales, aletas dorsales). Caso de prueba listo para el software. |
| **TABLA 5.3** | 271 / 287 | **F-16 superficies tipo cuerpo** (fuselaje, nariz, boattail, costados, canopy en 3 piezas, motor) con longitud/alto/ancho, S_wet y S_wet neta. **Ya está completa en el texto plano** (`bertin.txt` línea ~15770), no hace falta digitalizar. Aquí sale el D del fuselaje: `D = 0.5·(alto + ancho) = 0.5·(2.5+5.0) = 3.75 ft`, y de ahí el L/D = 49/3.75 = 13.067 que fuerza la extrapolación de la Fig. 5.23. S_wet total simplificada = 1418 ft² vs 1495 ft² real (−5.4 %). |
| **TABLA 5.4** | 272 / 288 | **F-16 wing-like zero-lift drag**: mac, Re_L, Cf, K, C_D0 por superficie. Total 0.00710. **Es EL caso de regresión del método.** (Ojo con el renglón del vertical interior, ver §2e.) |
| **TABLA 5.5** | 273 / 289 | **F-16 fuselage-like zero-lift drag**. Total 0.00590. Suma final C_D0 = 0.01300 → 0.01370 corregido → 0.0151–0.0158 con excrecencias. Dato de vuelo real: 0.0160–0.0190. |
| **Fig. 5.25** | ~271 / 287 | Descomposición geométrica del F-16 en superficies numeradas 1–10. Necesaria para entender las Tablas 5.2/5.3. |

### Anderson (Fundamentals of Aerodynamics, 6ª ed.)

| Ref | Página (libro/PDF) | Qué contiene |
|---|---|---|
| **Fig. 18.7** | 1028 / 1051 | **Perfiles de temperatura en capa límite laminar compresible sobre placa fría**, `(y/x)√Re_x` vs `T/T_e`, curvas para M∞ = 0, 4, 8, 12, 16, 20. Van Driest NACA TN 2579. Excelente para validar un solver de capa límite compresible. Ya la usé para cross-check de la 18.9. |
| **Fig. 1.59** | 84 / 107 | Tres vistas del Northrop T-38 (USAF). Geometría de referencia. |
| **Fig. 1.60** | 84 / 107 | **C_D de sustentación nula del T-38 vs Mach**, de subsónico bajo a supersónico. Muestra el plateau a 0.015 hasta M≈0.86 y la subida por divergencia. **Es la curva de arrastre de onda que un CAD conceptual necesita.** |
| **Fig. 1.61** | 85 / 108 | `c_l` vs α para NACA 63-210, Re = 3×10⁶, sin flap. Curva de sustentación con desplome en α≈14°. |
| **Fig. 1.57** | 82 / 105 | `c_d` vs α (arrastre de sección) del NACA 63-210, complemento de la 1.61. Valores típicos 0.004–0.006. |
| **Fig. 1.56** | 82 / 105 | *"Variation of laminar and turbulent skin friction coefficient for a flat plate as a function of Reynolds number"* — **la versión de Anderson de la Fig. 5.20 de Bertin**. Útil como segunda fuente para validar la correlación de fricción. |
| **Fig. 3.2** | — | Foto del Seversky P-35, la referencia física de la Fig. 1.58. |

### Ya en texto plano (no hace falta digitalizar)

- Anderson ec. (18.22) `C_f = 1.328/√Re_c`, (18.23) `δ = 5.0x/√Re_x`, (18.44) y (18.45) con las
  funciones F y G que definen las Figs. 18.8/18.9.
- Anderson §18.4 "The reference temperature method" (pág. 1032+/1055+): método aproximado de
  ingeniería para fricción y transferencia de calor compresible — **es lo que un software debería
  implementar en vez de tabular las Figs. 18.8/18.9**, porque cubre cualquier T_w/T_e.
- Bertin ec. (5.33) `C_D ≡ D/(q∞ S_ref)` y la definición de "drag count" (1 count = 0.0001).
