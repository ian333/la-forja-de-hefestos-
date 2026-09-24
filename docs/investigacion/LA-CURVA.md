# LA CURVA — dónde se va la gente, por qué, y cómo se fabrica un rey

Medido el 2026-09-23. **104 reels de Instagram** (427,812 vistas) + **51 curvas de retención de YouTube**
(100 puntos cada una) + **los 51 archivos exactos** que vio la gente, medidos cada 0.25 s (imagen y sonido)
y transcritos palabra por palabra con Whisper large-v3. Datos en `dist-video/retencion/`, sistema en
`scripts/retencion/`.

ian: «TENEMOS UNA VARIABLE QUE MAXIMIZAR… investigaremos una imagen, guion y sonido en ese punto en el
que abandonan… tenemos 2 reyes exponenciales, debemos aprender a hacer reyes».

---

## 1. La variable que se maximiza: los segundos vistos

De todo lo que Instagram mide, lo que mejor ordena las vistas es **cuántos segundos se queda la gente**:

| métrica (104 reels) | correlación de rango con las vistas |
|---|---|
| **segundos vistos** | **0.81** |
| guardados por mil | 0.74 |
| compartidos por mil | 0.65 |
| se van antes de 3 s | −0.60 |

La definición matemática: si S(t) es la fracción de gente que sigue viendo en el segundo t,

    E[T] = ∫₀ᴰ S(t) dt        (segundos esperados por persona, D = duración)

Esa es la variable acumulativa. YouTube la optimiza literalmente: su sistema de recomendación ordena los
videos con una regresión logística **pesada por tiempo de visionado** (Covington, Adams y Sargin, *Deep
Neural Networks for YouTube Recommendations*, 2016). No es una metáfora: la máquina que reparte las vistas
maximiza E[T].

Por bandas de segundos vistos (Instagram):

| segundos vistos | reels | mediana de vistas | máximo | P(≥10 mil) |
|---|---|---|---|---|
| < 12 | 54 | 302 | 3,223 | 0 % |
| 12–15 | 7 | 1,014 | 2,110 | 0 % |
| 15–18 | 14 | 2,396 | 11,251 | 7 % |
| 18–21 | 8 | 1,896 | 9,527 | 0 % |
| 21–25 | 5 | 3,493 | 6,519 | 0 % |
| 25–30 | 10 | 4,057 | 108,447 | 10 % |
| ≥ 30 | 6 | 6,508 | 134,159 | **50 %** |

**Ningún reel con menos de 15 segundos vistos ha pasado de 3,223 vistas.**

---

## 2. La forma de la curva: por qué se va la gente (la matemática)

### 2.1 Riesgo
La herramienta viene de la actuaría y la medicina (Kaplan–Meier 1958, Cox 1972). En vez de mirar S(t),
se mira el **riesgo**: la probabilidad de irse en el siguiente segundo si sigues aquí,

    h(t) = −d ln S(t) / dt        y al revés        S(t) = exp(−∫₀ᵗ h(u) du)

Esto importa porque **el riesgo es local**: dice qué pasó *en ese segundo*, mientras S(t) arrastra todo lo anterior.

### 2.2 Tres modelos, uno gana
Ajustados a las 51 curvas de YouTube (se quita el último 3 % por el loop):

| modelo | fórmula | error RMS (mediana) |
|---|---|---|
| exponencial (riesgo constante) | S = e^(−λt) | 0.063 |
| Weibull | S = exp(−(t/λ)^k) | 0.035 |
| **Lomax (mezcla gamma)** | **S = (1 + t/β)^(−α)** | **0.031** |

Weibull da **k = 0.76** (p10–p90: 0.54–1.34). k < 1 quiere decir que **el riesgo baja con el tiempo**:
el que ya se quedó, se queda.

### 2.3 Por qué gana Lomax (la derivación)
Supón que cada persona tiene su propia paciencia: se va a riesgo constante λ, pero λ cambia de persona a
persona siguiendo una distribución gamma con forma α y escala 1/β. La curva de la población es el promedio:

    S(t) = ∫ e^(−λt) · Gamma(λ; α, β) dλ = (1 + t/β)^(−α)
    h(t) = α / (β + t)

Es el modelo de "fragilidad" de Vaupel, Manton y Stallard (1979): **una población mezclada parece
volverse más fiel con el tiempo aunque nadie cambie**, porque los impacientes se van primero. Nuestros
valores: **α ≈ 0.86, β ≈ 19 s**. β es la escala de paciencia del público; α, qué tan parejo es.

### 2.4 Pero la curva real NO es Lomax: tiene un acantilado
Lomax obliga a que el riesgo baje desde el segundo 0. El riesgo medido **sube** (mediana de los 51 videos):

| segundo | riesgo /s | | segundo | riesgo /s |
|---|---|---|---|---|
| 0–1 | 0.6 % | | 8–9 | 4.0 % |
| 1–2 | 3.2 % | | 9–10 | 3.2 % |
| 2–3 | 2.1 % | | 10–11 | 2.9 % |
| 3–4 | 1.6 % | | 11–12 | 3.0 % |
| 4–5 | 3.4 % | | 12–20 | 1.2–1.9 % |
| **5–6** | **6.2 %** | | 20–30 | 0.7–1.3 % |
| 6–7 | 5.2 % | | 30–40 | 0.3–1.0 % |
| 7–8 | 4.4 % | | | |

(Ojo: la curva de YouTube empieza **después** del deslizamiento; los que se van en el cuadro 0 son el
"skip de 3 s" de Instagram, 37–62 %. Son dos filtros distintos: el gancho y el acantilado.)

**Entre el segundo 4 y el 12 se va ~32 % de los que ya habían aceptado el gancho.** Después del 12, el
riesgo baja a ~1 % por segundo: quien cruzó, se queda.

---

## 3. Qué hay en pantalla, en el oído y en el guion en ese segundo

### 3.1 El modelo
Tiempo discreto, paso de 0.5 s, 5,013 observaciones de 51 videos:

    h(v,t) = efecto_fijo(video) + posición(t) + Σ βₖ · xₖ(v, t−2 s … t)

- **efecto fijo por video**: quita lo que es "bueno o malo todo el video" y deja solo lo local.
- **posición**: seis tramos (0–3, 3–6, 6–9, 9–12, 12–20, 20–30, 30+ s).
- **rasgos** en la ventana de los 2 s anteriores (la gente reacciona tarde): movimiento, cortes, brillo,
  saturación, detalle, volumen (dB), flujo espectral (cambios bruscos de sonido), centroide espectral
  (qué tan brillante suena), palabras por segundo, silencio, números dichos, «tú» y preguntas.
- ponderado por cuánta gente había en ese segundo; intervalos por **bootstrap por video** (400 remuestreos).

### 3.2 Resultado (puntos de riesgo por segundo, por una desviación estándar del rasgo)

| rasgo | efecto | IC 90 % | |
|---|---|---|---|
| **tramo 3–6 s** (vs 0–3) | **+2.56** | | posición |
| **tramo 6–9 s** | **+3.45** | | posición |
| **tramo 9–12 s** | **+1.72** | | posición |
| tramo 12–20 s | +0.26 | | |
| **volumen más alto** | **−0.81** | [−1.32, −0.21] | *** |
| **sonido más brillante** | **−0.46** | [−0.77, −0.16] | *** |
| **cambio brusco de sonido** | **+0.43** | [+0.14, +0.64] | *** |
| **más movimiento** | **−0.13** | [−0.33, −0.02] | *** |
| **decir «tú»** | **−0.10** | [−0.19, −0.02] | *** |
| silencio | +0.30 | [−0.09, +0.82] | no concluyente |
| palabras por segundo | −0.13 | [−0.28, +0.04] | no concluyente (cambia de signo sin control) |
| números dichos | 0.00 | | nada |
| cortes, brillo, saturación, detalle, preguntas | ~0 | | nada |

R² dentro de video: 0.21. La posición sola explica 0.13. **El lugar pesa más que todo el contenido junto.**

Lectura:
1. **El segundo 3–12 es peligroso por sí mismo.** Es cuando el cerebro decide si esto vale la pena.
2. **El oído manda más que el ojo.** Cuando baja el volumen o el sonido se opaca, la gente se va. Cuando el
   sonido cambia de golpe (un corte de música, un ruido), también. Ni el color ni los cortes de imagen importan.
3. **«Tú» retiene.** Hablarle a la persona funciona; decir números, ni ayuda ni estorba.

### 3.3 Los acantilados, uno por uno (lo que decía la voz en los 2.5 s anteriores)

| video | segundo | exceso | lo que se decía |
|---|---|---|---|
| Cambiamos UN átomo del cristal | 5.5 | +15.6 %/s | «es el interior de un cristal de silicio, calculado átomo por átomo» |
| El cloro le roba el electrón | 6.0 | +9.2 %/s | «es un metal que regala electrones, y este, un ladrón que los quiere» |
| Ostrom (lo de todos) | 7.5 | +8.2 %/s | «¿meter una vaca más? El pasto se gasta entre todos» |
| El carbono rompe las reglas | 7.0 | +7.2 %/s | «carbono, el rebelde detrás de todo» |
| Tres gotas hacen un anillo | 6.5 | +3.6 %/s | «dos hidrógenos y un oxígeno» |
| Este átomo ROMPE la regla | 5.5 | +4.2 %/s | «¿Cómo? Veinticuatro electrones» |
| El primer enlace del universo | 7.0 | +2.7 %/s | «el primer elemento, casi todo lo…» |
| Átomos de 24 s (Al, Ti, Cu) | 21–22 | +14 a +30 %/s | *(silencio: la cola muda del final)* |

**El patrón: el acantilado cae justo cuando el guion deja el gancho y PRESENTA A LOS PERSONAJES.**
«Este es…», «es un metal que…», «dos hidrógenos y un oxígeno», y en Don Chuy: «Cada mañana el proveedor
le deja cien naranjas…». El gancho abre una pregunta; la presentación la pone en pausa. Loewenstein (1994)
lo llamó el **hueco de información**: la curiosidad dura mientras hay algo que quieres saber y *sientes*
que te lo van a dar. Una presentación se siente como clase, no como respuesta.

Y los átomos cortos terminan en **3 s de silencio**: ahí se va entre el 14 y el 30 % por segundo, lo que
mata el loop (en los Shorts, repetir es parte del E[T]).

### 3.4 Cuánto vale arreglarlo (contrafactual sobre las 51 curvas)

| cambio | segundos vistos (YT, mediana) | llegan al final |
|---|---|---|
| hoy | 27.4 s | 24 % |
| quitar la **mitad** del exceso 3–12 s | 30.5 s (**+3.4 s**) | 31 % |
| quitar **todo** el exceso 3–12 s | 36.0 s (**+7.3 s**) | 39 % |

En Instagram, el fiado tiene 17.9 s. Con +3 a +7 s se mueve a la banda de 21–25 s, y la libreta del final
la ve cerca del doble de gente.

---

## 4. Los reyes: por qué son exponenciales

### 4.1 La distribución
Vistas de los 104 reels: los 2 mejores = **56.7 %** de todo; los 8 mejores = 70.2 %. Estimador de Hill para
la cola de Pareto, P(V > v) ∝ v^(−a):

    a (top 10) = 0.97     a (top 20) = 1.19     a (top 30) = 1.22

**a ≈ 1 es la ley de Zipf.** Con a ≤ 1 el promedio no existe en la práctica: lo domina el más grande.
Esta forma la explicaron Yule (1925) y **Herbert Simon (1955, Nobel 1978)**: cuando el éxito atrae más
éxito en proporción a lo que ya se tiene, sale una ley de potencias. Salganik, Dodds y Watts (MusicLab,
*Science* 2006) lo probaron con 14 mil personas: **la calidad sube la probabilidad de ser un éxito, pero
la influencia social decide cuál de los buenos**. Los reyes son calidad × suerte, nunca solo suerte.

### 4.2 El mecanismo: un proceso de ramificación
La plataforma le muestra el video a un lote; si el lote lo ve y lo comparte, le muestra otro más grande.
Cada lote engendra en promedio **m** lotes nuevos (Galton–Watson 1874, Harris 1963; en redes, procesos de
Hawkes 1971; para YouTube, Crane y Sornette, *PNAS* 2008). Sumando la serie geométrica:

    V = V₀ (1 + m + m² + m³ + …) = V₀ / (1 − m)        para m < 1

    dV/dm = V₀ / (1 − m)²

**Cerca de m = 1, un cambio pequeño en m da un cambio enorme en vistas.** Esa es la "exponencialidad" de
los reyes: no son 50 veces mejores; están cerca del punto crítico (la misma matemática que la percolación
y las transiciones de fase, la física de sistemas complejos de Parisi, Nobel 2021).

Ajustado a los 104 reels, con m = sigmoide(b₀ + b_T·segundos + b_C·compartidos/mil + b_K·skip):

    V₀ = 81   b_T = +0.072   b_C = +0.094   b_K = −0.044        R² (log vistas) = 0.72

| reel | vistas | seg vistos | comp/mil | skip | m |
|---|---|---|---|---|---|
| El puente invisible | 134,159 | 34.2 | 26.9 | 42 | 0.998 |
| NACER un enlace (O₂) | 108,447 | 28.8 | 24.2 | 36 | 0.997 |
| Copo de nieve | 14,086 | 30.5 | 16.2 | 38 | 0.994 |
| Este átomo ROMPE la regla | 11,251 | 16.9 | 6.5 | 45 | 0.952 |
| 104.5° decide que estés vivo | 10,108 | 35.7 | 19.6 | 41 | 0.997 |

### 4.3 La zona de los reyes
Mediana de vistas por segundos vistos × compartidos por mil (celdas: reels | mediana):

| | comp < 5 | 5–10 | 10–20 | **≥ 20** |
|---|---|---|---|---|
| seg < 15 | 47 · 326 | 12 · 363 | 1 · 1,236 | 1 · 895 |
| 15–22 | 13 · 1,951 | 4 · 2,552 | 6 · 3,299 | 0 |
| 22–28 | 1 · 3,488 | 6 · 3,691 | 3 · 5,192 | 1 · 2,829 |
| **≥ 28** | 3 · 403 | 1 · 2,094 | 3 · 10,108 | **2 · 121,303** |

**Un rey necesita las dos cosas a la vez: ≥ 28 s vistos Y ≥ 20 compartidos por mil.** Quedarse sin compartir
da un video bueno; compartir sin quedarse da un video que se apaga. Las dos juntas llevan m arriba de 0.99.

Qué hace que se comparta lo dejó dicho Kahneman (Nobel 2002) con la **regla del pico y el final**: la
memoria de una experiencia es el promedio de su momento más intenso y su último momento. Los dos reyes
tienen un **evento visto por primera vez** (el enlace que nace, el puente que se forma) y lo ponen al final.

---

## 5. Las reglas que salen de los números

1. **Cero presentaciones entre el segundo 3 y el 12.** Nada de «este es…», «es un metal que…», «cada mañana
   el proveedor…». Los personajes se presentan **haciendo algo que ya es el conflicto**. La cuenta de Don Chuy
   va en pantalla, no en la voz.
2. **El sonido nunca se cae.** Volumen parejo, sin huecos, sin cortes bruscos de música. Nada de cola muda:
   el final cierra en la imagen y el loop empieza sin silencio.
3. **Háblale a la persona.** «Tú», «te», «tienes», desde el segundo 1.
4. **El pico al final.** El evento nunca visto llega en el último tercio y el video acaba ahí (pico y final
   son el mismo momento), para que se comparta.
5. **Para un rey no basta retener**: tiene que haber algo que la gente quiera mandarle a alguien.

## 6. Don Chuy bajo esta lupa

El fiado presenta la cuenta del segundo 5 al 18 («Cada mañana el proveedor le deja cien naranjas…»):
es justo el acantilado. La gente se fue a los 17.9 s en promedio, un segundo antes del «pero hoy fió la
mitad». La lata (publicada hoy) **abre** con la cuenta y dio 58 % de skip y 11.6 s: el peor arranque de la serie.
La curva de YouTube del fiado sale en 2 a 3 días y va a confirmar (o desmentir) esto.

## 7. El sistema (cada video es un experimento)

    python3 scripts/retencion/1-curvas-yt.py dist-video/retencion/yt-curvas.json   # en iangpu (token de YT)
    python3 scripts/retencion/2-archivos.py dist-video/retencion                    # YT, o IG si YT da 403
    python3 scripts/retencion/3-rasgos.py   dist-video/retencion/vids dist-video/retencion/rasgos.json
    python    scripts/retencion/4-palabras.py <audios> dist-video/retencion/palabras.json  # iangpu, GPU
    python3 scripts/retencion/5-modelo.py   dist-video/retencion                    # modelo + acantilados

Cada video nuevo entra al modelo 3 días después de publicarse. El ciclo:
**curva → sus 3 acantilados con lo que se veía y decía → una regla o una corrección → el siguiente guion.**

## 8. Lo que estos números NO dicen (honestidad)

- **51 curvas no son un experimento.** Son correlaciones con controles (efecto fijo por video + posición).
  La causa se prueba con **un cambio a la vez** (Banerjee, Duflo y Kremer, Nobel 2019): el fiado b, con el
  mismo audio reordenado, contra el fiado original.
- Las curvas de YouTube empiezan después del deslizamiento; Instagram no da curva, solo el skip de 3 s y el
  promedio de segundos.
- Los datos de YouTube vienen de videos de **ciencia**. Que la regla de las presentaciones valga para
  economía lo sugiere la lata, pero lo decide la curva del fiado.
- Los segundos vistos también son parte **consecuencia**: cuando un video se reparte a gente que no te sigue,
  la retención tiende a bajar, no a subir. Que los reyes retengan más *a pesar* de llegar a desconocidos
  hace la relación más creíble, no menos.
