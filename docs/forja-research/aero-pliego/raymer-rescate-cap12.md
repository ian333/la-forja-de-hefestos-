# Rescate del Capítulo 12 de Raymer (Aerodinámica) — build-up de arrastre

Recuperación de las ecuaciones y figuras del **Cap. 12 "Aerodynamics"** de
*Raymer, Aircraft Design: A Conceptual Approach, 6ª ed. (AIAA, 2018)*, que el OCR dejó
inservibles. Todo lo de aquí se leyó **del PDF re-renderizado a 350 dpi**, no del texto extraído.

**Método.** Idéntico al de `figuras-digitalizadas.md` (Bertin/Anderson):
1. `pdftoppm -r 350 -png` de la página del PDF (**pág. PDF = pág. libro + 30**, verificado en 6 puntos).
2. Las **ecuaciones** se leyeron con los ojos sobre el render, carácter por carácter.
3. Las **curvas** NO se leyeron a ojo: se aislaron por color (el trazo es azul RGB ≈ 43,144,202),
   se calibraron los ejes con la posición real de las **marcas de eje** medidas en píxeles, y se
   trazaron **columna por columna** con seguimiento por continuidad (predicción cuadrática +
   restricción de monotonía por rama + puenteo de huecos donde una flecha de rótulo cruza la curva).
4. **Auditoría de cobertura obligatoria:** después de trazar, se pinta un mapa de los píxeles azules
   NO cubiertos por ninguna curva trazada. Si queda tinta sin explicar, el trazado está incompleto.
   Ese porcentaje se reporta figura por figura. Es la prueba de que no falta ni sobra una curva.

Archivos fuente de los renders: `figuras/ray-c12-p<PÁGINA-DEL-LIBRO>-<PÁGINA-DEL-PDF>.png`.

---

## Resumen ejecutivo

| Ítem | Estado | Verificación cruzada |
|---|---|---|
| Ec. 12.24 (build-up parásito subsónico) | ✅ literal | — |
| Ec. 12.27 (Cf turbulento) | 🔴 **NO ESTÁ IMPRESA EN EL LIBRO** — errata mayor. Recuperada por evidencia (ver §A.2) | Fig. 12.22 reproduce `0.455/(log10 R)^2.58` con error −0.6 %/+1.9 % |
| Ec. 12.31 (FF fuselaje/canopy, 6ª ed.) + nota al pie (ed. previas) | ✅ ambas literales | — |
| Ec. 12.42 (Sears-Haack), 12.46 (M_DD), 12.61/12.62 (flap), 12.4/12.5 (polares) | ✅ literales | — |
| Fig. 12.39 (succión S vs C_L) ⭐⭐ | ✅ 7 curvas completas, 8.5 % de tinta sin cubrir (solo las mesetas planas) | el libro dice "recta en S = 0.93"; mis 7 picos dan 0.914–0.937 ✅ |
| Fig. 12.29 / 12.30 / 12.31 (M_DD) | ✅ 5 / 6 / 2 curvas, **0.00 %** sin cubrir | B-727: el libro dice ΔM_DD = −0.04 de C_L 0.1→0.3; mi cadena da −0.035 ✅ |
| Fig. 12.36 (interferencia de biplano) | ✅ 7 curvas, **0.06 %** sin cubrir | el libro dice e ≈ 1.3 en gap/span = 0.15; mi lectura da **e = 1.281** ✅ |
| Fig. 12.24 / 12.25 / 12.26 (tanques, bombas, pilones) | ✅ 4 / 5 / 3 curvas (7.9 % / 2.2 % / 1.3 % sin cubrir) | — |
| Fig. 12.22 (Cf vs Re) — **bonus, no la pediste** | ✅ 2 curvas, **0.00 %** sin cubrir | es la que permite recuperar la 12.27 |
| Tabla 12.5 | ✅ + **errata detectada** en el valor en pies del compuesto moldeado | la razón ft→m no cierra |
| Tablas 12.6 / 12.7 / 12.8 | ✅ cabeceras recuperadas | 12.8 sí tenía cabecera |
| Fig. 12.7 a–f (6 cartas supersónicas) | ❌ **NO digitalizada** — ver "LO QUE NO PUDE LEER" | — |

---

# A. ECUACIONES (transcripción literal, ASCII)

Notación usada abajo: `^` potencia, `*` producto, `/` división, `sqrt()` raíz,
`Sigma()` sumatoria, `Lambda` barrido, `delta` deflexión.

## A.1 — Ec. (12.24) ⭐ build-up de arrastre parásito subsónico (libro p. 417)

```
                        Sigma( Cf_c * FF_c * Q_c * Swet_c )
(C_D0)_subsonico  =  ------------------------------------- + C_Dmisc + C_D_LyP
                                    S_ref
```

- El subíndice `c` indica que **ese valor es distinto para cada componente**.
- `Cf_c` = coeficiente de fricción de placa plana del componente.
- `FF_c` = factor de forma (arrastre de presión por separación viscosa).
- `Q_c`  = factor de **interferencia** (ojo: `Q` mayúscula NO es la presión dinámica `q`).
- `Swet_c` = área mojada del componente. `S_ref` = área de referencia del ala.
- `C_Dmisc` = arrastres misceláneos (flaps, tren no retraído, upsweep, área base).
- `C_D_LyP` = fugas y protuberancias (en el libro `C_D L&P`).

Versión supersónica, para contraste — **Ec. (12.41)**, libro p. 432 (ahí `FF = Q = 1.0`):

```
(C_D0)_supersonico = Sigma( Cf_c * Swet_c ) / S_ref + C_Dmisc + C_D_LyP + C_Dwave
```

## A.2 — Ec. (12.27) ⭐ Cf turbulento con corrección de Mach — 🔴 **FALTA EN EL LIBRO**

**Hallazgo duro, y hay que decirlo antes que nada.** En la 6ª edición, la pág. 420 dice
textualmente *"For turbulent flow the flat-plate skin-friction coefficient is determined by
Eq. (12.27), which includes a Mach number correction"*, luego imprime:

```
Laminar:                     Cf = 1.328 / sqrt(R)                      (12.26)

Turbulent:
```

…y **ahí se acaba la página. El cuerpo de la ecuación (12.27) NUNCA SE IMPRIME.**
Lo verifiqué de tres maneras independientes:

1. Render a 350 dpi de la p. 420 (PDF 450): debajo de "Turbulent:" hay **medio cuadro en blanco**.
2. `pdftotext -raw` de esa página: el último token es `Turbulent:`.
3. `pdfimages -list` de esa página: solo hay 1 imagen (el sello de fondo), ninguna figura.
   Y la p. 421 arranca con la Fig. 12.22, no con la ecuación.

El libro la referencia **cuatro veces** (pp. 420, 421 ×2, 432) y nunca la da. Es una errata de
composición de esta edición.

### Recuperación por evidencia (NO por memoria)

La pág. 420 dice que **la Fig. 12.22 se graficó con las Ecs. (12.26) y (12.27)**. Entonces
digitalicé la Fig. 12.22 (2 curvas, 0.00 % de tinta sin cubrir) y comparé:

- La curva **laminar** reproduce la Ec. (12.26) impresa, `1.328/sqrt(R)`, con error −3.2 %/+2.8 %
  (es una curva muy inclinada; ese es el error de digitalización, no del libro). Sirve de control.
- La curva **turbulenta** reproduce `0.455 / (log10 R)^2.58` con error **−0.6 % a +1.9 %**,
  y mejor que ±0.8 % arriba de Re = 3e5. Esa es la forma de Prandtl-Schlichting.

| Re | Cf turb. leído | 0.455/(log10 Re)^2.58 | dif |
|---|---|---|---|
| 1.50e5 | 0.00667 | 0.00654 | +1.9 % |
| 3.00e5 | 0.00568 | 0.00566 | +0.4 % |
| 5.00e5 | 0.00507 | 0.00511 | −0.6 % |
| 1.00e6 | 0.00450 | 0.00447 | +0.6 % |
| 1.40e6 | 0.00421 | 0.00420 | +0.3 % |
| 1.95e6 | 0.00398 | 0.00396 | +0.5 % |

**Lo que SÍ está probado con la evidencia del propio libro:**

```
Cf_turbulento (M -> 0) = 0.455 / (log10 R)^2.58
```

**Lo que NO puedo probar con esta edición:** el factor de corrección de Mach. La Fig. 12.22 está
trazada a Mach bajo (el propio texto dice que la corrección "is trivial at low speeds"), así que
la figura no contiene información sobre ese término. La forma que traen las ediciones previas del
mismo libro (y que hace que el texto "which includes a Mach number correction" tenga sentido) es:

```
Cf = 0.455 / [ (log10 R)^2.58 * (1 + 0.144*M^2)^0.65 ]        <-- ediciones previas
```

🔴 **Regla dura para quien implemente:** el numerador `0.455`, el exponente `2.58` y el `log10`
están **verificados contra la Fig. 12.22 de esta edición** (±1 %). El factor
`(1 + 0.144 M^2)^0.65` **NO está verificado contra esta edición** — hay que marcarlo en el código
como "de edición previa, sin verificar" hasta que alguien lo contraste con la 5ª ed. impresa.
Yo no lo inventé y no lo puedo confirmar.

**Ecuaciones vecinas que SÍ están impresas** (útiles porque 12.27 las consume):

```
Rcutoff subsónico:            R_cutoff = 38.21 * (l/k)^1.053                (12.28)
Rcutoff transónico/supersónico: R_cutoff = 44.62 * (l/k)^1.053 * M^1.16      (12.29)
```
donde `l` es la longitud característica y `k` la rugosidad de la Tabla 12.5. Si el R_cutoff
calculado es MENOR que el Reynolds real, se usa el R_cutoff en la (12.27).

## A.3 — Ec. (12.31) ⭐ Factor de forma de fuselaje y canopy (libro p. 422)

**6ª edición (la que está en el cuerpo de la página):**

```
FF = ( 0.9 + 5/f^1.5 + f/400 )                                              (12.31)
```

**Nota al pie de esa MISMA página (ediciones previas — es la que corre el diseño de ejemplo):**

> *"In prior editions of this book, the fuselage form factor was given as
> FF = 1 + 60/f^3 + f/400, a classic RAND estimation method used in the DATCOM[69] and other
> sources. This provides a good correlation for fineness ratios (f) above 6 as is typical for
> high-speed and military aircraft, but seems to overestimate drag for fineness ratios much below
> 5. Equations in other sources including [40] and [9] provide much lower values at the lower
> fineness ratios but appear theoretical in derivation. As a compromise, this author has developed
> the equation shown here. This has same equation format of the original but with revised terms
> bringing it closer to those other equations for lower fineness ratios. It gives conservative
> (larger) values to account for the additional separation pressure drag likely in real airplanes
> with a short, fat fuselage. At the higher fineness ratios all these equations exponentially
> approach 1.0 indicating that form factor drag becomes nearly negligible."*

O sea, en ASCII:

```
FF = 1 + 60/f^3 + f/400                          <-- EDICIONES PREVIAS (RAND / DATCOM)
```

⚠️ **Las dos NO son intercambiables.** Con f = 4: la 6ª ed. da `0.9 + 5/8 + 0.01 = 1.535`;
la previa da `1 + 60/64 + 0.01 = 1.948`. Con f = 10: 6ª ed. `0.9 + 0.158 + 0.025 = 1.083`;
previa `1 + 0.06 + 0.025 = 1.085` (ahí sí convergen). **Un software que implemente solo la
12.31 nueva y luego intente reproducir un ejemplo de diseño de edición previa va a fallar
en fuselajes cortos y gordos.** Hay que exponer las dos y dejar elegir.

`f` es la razón de esbeltez, definida en la misma sección — **Ec. (12.33)**, p. 423:

```
f = l/d = l / sqrt( (4/pi) * A_max )                                        (12.33)
```

**Familia completa de factores de forma subsónicos** (todas leídas del render, pp. 422–424):

```
Ala, cola, montante, pilón:
FF = [ 1 + 0.6/(x/c)_m * (t/c) + 100*(t/c)^4 ] * [ 1.34 * M^0.18 * (cos Lambda_m)^0.28 ]   (12.30)

Fuselaje y canopy liso:      FF = ( 0.9 + 5/f^1.5 + f/400 )                 (12.31)
Góndola y almacén externo liso: FF = 1 + (0.35/f)                           (12.32)
Diverter de doble cuña:      FF = 1 + (d/l)                                 (12.34)
Diverter de una cuña:        FF = 1 + (2d/l)                                (12.35)
```
En la (12.30), `(x/c)_m` es la posición en cuerda del espesor máximo (≈0.3 en perfiles de baja
velocidad, ≈0.5 en perfiles de alta velocidad) y `Lambda_m` es el barrido de la línea de
espesor máximo. Válidas hasta el M_DD.

**Ajustes al FF que el software debe soportar** (p. 423), aplicados **solo al incremento por
encima de 1.0** (la nota al pie es explícita: si FF = 1.2 y subes 30 %, el resultado es
**1.26, no 1.56**):

| Caso | Ajuste sobre el incremento (FF − 1) |
|---|---|
| Cola con timón/elevador articulado | +10 % sobre la Ec. 12.30 |
| Fuselaje con cierre trasero fuerte delante de hélice empujadora | −50 % (y ×2 cuando el motor se apaga) |
| Fuselaje de lados cuadrados | +30 a 40 % |
| Casco de hidroavión | +50 % |
| Flotador | ×3 (tres veces el valor estimado) |
| Canopy de dos piezas con parabrisas fijo carenado (F-15) | +40 % |
| Canopy con parabrisas de lados planos (A-10, Me-109) | +300 % |
| Cuerpos optimizados con CFD moderno | −10 a 20 % ("wild guess" del autor) |

## A.4 — Ec. (12.42) radio del cuerpo de Sears-Haack (libro p. 432)

```
 r                          x        2  0.75
----  =  [ 1  -  ( -------------- )    ]                                    (12.42)
r_max                  ( l/2 )
```

En una línea:

```
r/r_max = [ 1 - ( x/(l/2) )^2 ]^0.75
```

donde (literal del libro): `r` = the cross-section radius, `l` = the longitudinal dimension.
El origen `x = 0` está en el centro del cuerpo (por eso `l/2`). Es el volumen ideal: da el
**mínimo arrastre de onda posible** para un cuerpo de sección circular cerrado de esa longitud y
volumen. Su arrastre analítico es la Ec. (12.44).

## A.5 — Ec. (12.46) ⭐ Mach de divergencia de arrastre del ala (libro p. 436)

```
M_DD = M_DD(L=0) * LF_DD  -  0.05 * C_L_design                              (12.46)
```

- `M_DD(L=0)` se lee de la **Fig. 12.29** (ala sin comba, sustentación nula) — tabla en §B.2.
- `LF_DD` se lee de la **Fig. 12.30** (ajuste por coeficiente de sustentación) — tabla en §B.3.
- El último término ajusta por el C_L de diseño del ala (comba y torcimiento). El libro dice que
  inicialmente se puede suponer `C_L_design = C_L de crucero`.
- Esto es **M_DD definición Boeing** (subida de arrastre de 20 counts). El libro aclara:
  M_DD(Boeing) ≈ M_crit + 0.08; M_DD(Douglas/USAF, donde dC_D0/dM = 0.10) ≈ M_DD(Boeing) + 0.06.
- 🔴 **Regla de perfil supercrítico:** si el ala usa perfil supercrítico, hay que **multiplicar el
  t/c real por 0.6 ANTES de entrar a las figuras** (p. 436). Fácil de olvidar y cambia mucho.
- Si el fuselaje es romo, el M_DD lo fija el morro: se calcula también con la **Fig. 12.31**
  (§B.4) y **se usa el menor de los dos**.

## A.6 — Ecs. (12.61) y (12.62) arrastre de flap (libro p. 452)

**Parásito** (referido al área del ALA, no a la del flap):

```
delta(C_D0)_flap = F_flap * (Cf/C) * (S_flapped/S_ref) * (delta_flap - 10)  (12.61)

donde:
  delta_flap = deflexión EN GRADOS
  F_flap     = 0.0144  para flaps planos (plain)
             = 0.0074  para flaps ranurados (slotted)
  Cf         = longitud de cuerda del flap (ver Fig. 12.18)
```
(`C` es la cuerda del ala; el término `Cf/C` es la razón de cuerda del flap.)
El libro apunta que la deflexión típica es 60–70 deg en aterrizaje y 20–40 deg en despegue, y
que la aviación ligera despega normalmente sin flaps. Nótese el `−10`: **por debajo de 10 grados
de deflexión la ecuación da arrastre negativo; el software debe recortar en cero.**

**Inducido:**

```
delta(C_Di) = k_f^2 * ( delta(C_L_flap) )^2 * cos( Lambda_c/4 )             (12.62)

donde:
  k_f = 0.14  para flaps de envergadura completa (full-span)
      = 0.28  para flaps de media envergadura (half-span)
```
Este incremento **se suma** al arrastre inducido de la sustentación total calculado con el factor
K del ala limpia.

⚠️ Contraintuitivo pero es lo impreso: `k_f` es **mayor** para el flap de media envergadura
(0.28) que para el de envergadura completa (0.14) — porque el de media envergadura distorsiona
más la distribución elíptica. Leído dos veces sobre el render; no es error de transcripción.

## A.7 — Ecs. (12.4) y (12.5) polares de arrastre (libro p. 396)

```
Sin comba (uncambered):      C_D = C_D0 + K * C_L^2                          (12.4)

Con comba (cambered):        C_D = C_Dmin + K * ( C_L - C_L_min_drag )^2     (12.5)
```

Contexto impreso en la misma página, que conviene no perder:

```
L = q*S*C_L      (12.1)      D = q*S*C_D      (12.2)      q = 0.5*rho*V^2   (12.3)
```

- `S_ref` es el **área trapezoidal completa extendida hasta la línea de centro del avión**.
- Un "count" de arrastre = 0.0001 (38 counts = C_D de 0.0038).
- En ala sin comba el arrastre mínimo ocurre a sustentación nula, y entonces `C_D0 = C_Dmin`.
- Para combas moderadas el desplazamiento es chico, `C_D0 ≈ C_Dmin`, y se puede usar la (12.4).
- El punto de L/D máximo es donde una recta desde el origen es tangente a la polar —
  **no es el punto de arrastre mínimo**.

---

# B. FIGURAS DIGITALIZADAS (tablas de puntos)

Todas las tablas están muestreadas de las curvas trazadas píxel a píxel. Un guion `—` significa
**fuera del rango dibujado en la figura**: ahí no hay dato y el software debe negarse a
interpolar o marcar EXTRAPOLADO.

## B.1 — Fig. 12.39 ⭐⭐ Factor de succión de borde de ataque S vs C_L

**Ubicación:** libro p. 449 = PDF 479 → `figuras/ray-c12-p449-0479.png`

### Transcripción literal
> **Fig. 12.39**  Typical design goal values for supersonic aircraft. Leading-edge suction vs C_L.

- **Eje Y:** `Leading-edge suction factor, S`, lineal, de **0 a 1.0**, marcas cada 0.1.
- **Eje X:** `Lift coefficient C_L`, lineal, de **0 a 1.0**, marcas cada 0.1.
- **Leyenda derecha:** `Design C_L`, y de arriba hacia abajo las 7 curvas:
  **0.8, 0.6, 0.5, 0.4, 0.3, 0.1, 0** (leídas ampliadas ×4; sin ambigüedad).
- Nota al pie de la página: *"In some sophisticated optimization methods the entire wing is
  optimized to directly maximize mission performance, rather than first finding a desired design
  lift coefficient."*

### Datos (S adimensional)

| C_L | CLd=0 | CLd=0.1 | CLd=0.3 | CLd=0.4 | CLd=0.5 | CLd=0.6 | CLd=0.8 |
|---|---|---|---|---|---|---|---|
| 0.050 | 0.910 | 0.875 | — | — | — | — | — |
| 0.075 | 0.867 | 0.898 | — | — | — | — | — |
| 0.100 | 0.827 | 0.912 | 0.601 | 0.441 | 0.270 | 0.119 | 0.055 |
| 0.125 | 0.786 | 0.911 | 0.676 | 0.510 | 0.352 | 0.187 | 0.114 |
| 0.150 | 0.748 | 0.901 | 0.748 | 0.579 | 0.429 | 0.254 | 0.175 |
| 0.175 | 0.714 | 0.882 | 0.797 | 0.643 | 0.505 | 0.320 | 0.237 |
| 0.200 | 0.679 | 0.854 | 0.842 | 0.693 | 0.570 | 0.383 | 0.299 |
| 0.225 | 0.646 | 0.820 | 0.877 | 0.745 | 0.632 | 0.445 | 0.354 |
| 0.250 | 0.614 | 0.787 | 0.903 | 0.783 | 0.690 | 0.503 | 0.410 |
| 0.275 | 0.584 | 0.747 | 0.920 | 0.828 | 0.738 | 0.567 | 0.463 |
| 0.300 | 0.553 | 0.716 | 0.928 | 0.857 | 0.780 | 0.621 | 0.513 |
| 0.325 | 0.525 | 0.683 | 0.924 | 0.885 | 0.818 | 0.671 | 0.560 |
| 0.350 | 0.497 | 0.650 | 0.907 | 0.905 | 0.846 | 0.714 | 0.603 |
| 0.375 | 0.472 | 0.619 | 0.881 | 0.921 | 0.871 | 0.753 | 0.643 |
| 0.400 | 0.445 | 0.589 | 0.850 | 0.931 | 0.890 | 0.791 | 0.683 |
| 0.425 | 0.419 | 0.560 | 0.813 | 0.909 | 0.908 | 0.828 | 0.720 |
| 0.450 | 0.396 | 0.532 | 0.776 | 0.924 | 0.922 | 0.853 | 0.753 |
| 0.475 | 0.371 | 0.503 | 0.738 | 0.915 | 0.932 | 0.877 | 0.784 |
| 0.500 | 0.349 | 0.476 | 0.700 | 0.899 | 0.928 | 0.893 | 0.812 |
| 0.525 | 0.328 | 0.450 | 0.660 | 0.878 | 0.915 | 0.914 | 0.835 |
| 0.550 | 0.306 | 0.424 | 0.624 | 0.854 | 0.924 | 0.927 | 0.853 |
| 0.575 | 0.286 | 0.400 | 0.586 | 0.825 | 0.907 | 0.934 | 0.870 |
| 0.600 | 0.264 | 0.375 | 0.553 | 0.793 | 0.887 | 0.936 | 0.882 |
| 0.625 | 0.246 | 0.355 | 0.523 | 0.751 | 0.866 | 0.934 | 0.897 |
| 0.650 | 0.227 | 0.332 | 0.493 | 0.711 | 0.841 | 0.928 | 0.908 |
| 0.675 | 0.208 | 0.309 | 0.467 | 0.673 | 0.811 | 0.917 | 0.915 |
| 0.700 | 0.191 | 0.289 | 0.441 | 0.635 | 0.780 | 0.906 | 0.923 |
| 0.725 | 0.173 | 0.271 | 0.417 | 0.598 | 0.746 | 0.890 | 0.926 |
| 0.750 | 0.156 | 0.251 | 0.394 | 0.563 | 0.712 | 0.874 | 0.924 |
| 0.775 | 0.141 | 0.233 | 0.373 | 0.529 | 0.680 | 0.855 | 0.924 |
| 0.800 | 0.126 | 0.216 | 0.351 | 0.501 | 0.650 | 0.838 | 0.922 |
| 0.825 | 0.111 | 0.201 | 0.332 | 0.471 | 0.622 | 0.818 | 0.916 |
| 0.850 | 0.095 | 0.183 | 0.312 | 0.442 | 0.591 | 0.797 | 0.913 |
| 0.875 | 0.082 | 0.167 | 0.294 | 0.416 | 0.566 | 0.777 | 0.905 |
| 0.900 | 0.068 | 0.152 | 0.276 | 0.393 | 0.540 | 0.756 | 0.898 |
| 0.925 | 0.056 | 0.138 | 0.259 | 0.371 | 0.516 | 0.735 | 0.889 |
| 0.950 | 0.043 | 0.123 | 0.243 | 0.350 | 0.493 | 0.715 | 0.880 |
| 0.975 | 0.032 | 0.109 | 0.226 | 0.332 | 0.473 | 0.694 | 0.870 |
| 1.000 | 0.020 | 0.096 | 0.212 | 0.314 | 0.455 | 0.673 | — |
| 1.025 | 0.013 | 0.083 | — | 0.299 | 0.437 | 0.656 | — |
| 1.050 | — | — | — | — | 0.424 | — | — |


### Picos medidos (detección automática de "tapas" horizontales del trazo)

| Design C_L | C_L del pico | S del pico |
|---|---|---|
| 0 | 0.036 (borde izquierdo) | 0.928 |
| 0.1 | 0.114 | 0.914 |
| 0.3 | 0.296 | 0.928 |
| 0.4 | 0.409 | 0.935 |
| 0.5 | 0.500 | 0.937 |
| 0.6 | 0.587 | 0.937 |
| 0.8 | **0.717** | 0.927 |

🟡 **Ojo con la última fila:** la curva rotulada `Design C_L = 0.8` **NO tiene su máximo en
C_L = 0.8, lo tiene en C_L ≈ 0.72.** Las otras seis sí caen cerca de su rótulo (±0.015). No es
error mío: la detección de picos es automática y la tapa de esa curva es la más ancha del dibujo
(102 px). Es cómo está dibujada la carta.

### Rango real
- **X:** las curvas existen entre **C_L = 0.035 y C_L ≈ 1.03–1.05** (algunas se salen un pelo del
  eje impreso, que termina en 1.0). **Para C_L < 0.035 no hay ninguna curva**: la de Design C_L=0
  arranca ahí, en su propio máximo.
- Cada curva arranca a distinto C_L: la de Design 0 en 0.035, la de 0.1 en 0.038, y las de
  0.3/0.4/0.5/0.6/0.8 **todas en C_L ≈ 0.093–0.099** (con S = 0.591 / 0.441 / 0.269 / 0.111 / 0.054
  respectivamente). Debajo de C_L ≈ 0.09 solo existen dos curvas.
- **Y:** S de 0.013 a 0.937.

### Incertidumbre
- Figura **vectorial** limpia. Calibración de ejes exacta: marcas en X uniformes a 105.75 px por
  0.1 (residuo < 1 px, 11 marcas); en Y a 104.65 px por 0.1 (11 marcas).
- **Banda: ±0.006 en S** en las ramas descendentes y en las mesetas; **±0.010 en S** en las
  ramas ascendentes (ahí las curvas se cruzan y el trazador pasa por regiones fundidas).
- **±0.004 en C_L.**
- Auditoría de cobertura: **8.5 % de píxeles azules sin cubrir**, y ese remanente está
  exclusivamente en las **tapas horizontales de los picos** (donde mi ventana de cobertura,
  que escala con la pendiente, se queda corta) — no son curvas faltantes. Se verificó
  visualmente sobre el mapa de residuos.
- Los cruces son en X y bien angulados; los picos NO: varias cimas se tocan formando un "techo"
  a S ≈ 0.93. Ahí el trazado se ancló al pico detectado automáticamente, no a la continuidad.

### Verificación cruzada
1. ✅ **La buena.** El libro, p. 450: *"the left side of the suction curves of Fig. 12.39 should be
   replaced by a straight line at **S equals 0.93**"*. Mis siete picos medidos: 0.914, 0.927, 0.928,
   0.928, 0.935, 0.937, 0.937 → **media 0.929**. Coincide con el 0.93 impreso.
2. ✅ p. 449: *"For most wings, S equals approximately **0.9** when operating at the wing's own
   design lift coefficient"*. Mis picos: 0.91–0.94. Coincide.
3. 🟡 p. 449: *"A wing with an S of 0.9 at its design lift coefficient of 0.5 can have an S value
   **less than 0.3** at a lift coefficient of 1.0."* **Mi lectura de la curva Design C_L = 0.5 a
   C_L = 1.0 da S = 0.455, no < 0.3.** No lo considero fallo de digitalización: esa frase está
   ANTES de presentar la figura y describe lo que *puede* pasarle a un ala delgada y muy flechada
   real, mientras que la Fig. 12.39 son "typical **design goal** values". Son dos cosas distintas y
   el libro no las separa bien. **Que el software no use esa frase como si fuera la figura.**

### Uso (para no equivocar el método)
El libro recomienda este camino como **el bueno** para el arrastre inducido: se entra con el C_L
real y el C_L de diseño, se saca S, y con S se construye el factor K vs Mach (Fig. 12.38 → 12.40)
que alimenta la Ec. (12.4). Además, p. 450:
- Ala subsónica de borde de ataque redondo: **sustituir toda la rama izquierda por una recta en
  S = 0.93** (o más si el alargamiento es alto).
- Alargamientos altos: S sube a **0.95–0.97**. Esta figura no cubre ese caso.

## B.2 — Fig. 12.29  Mach de divergencia de arrastre del ala (sustentación nula)

**Ubicación:** libro p. 437 = PDF 467 (mitad superior) → `figuras/ray-c12-p437-0467.png`

### Transcripción literal
> **Fig. 12.29**  Wing drag-divergence Mach number.

- **Eje Y:** `M_DD (Boeing)`, lineal, **0.75 a 1.00**, marcas cada 0.05.
- **Eje X:** `Lambda_c/4` (barrido de cuarto de cuerda, grados), **10 a 70**, marcas cada 10.
- **Anotaciones dentro del cuadro:** `• C_L = C_L design = 0` y `• Conventional airfoil`.
- **5 curvas rotuladas por `t/c` en su extremo izquierdo:** 0.04, 0.06, 0.08, 0.10, 0.12.

### Datos (M_DD a sustentación nula)

| Lambda_c/4 (deg) | t/c=0.04 | t/c=0.06 | t/c=0.08 | t/c=0.10 | t/c=0.12 |
|---|---|---|---|---|---|
| 17 | 0.8458 | 0.8270 | 0.8104 | 0.7944 | 0.7785 |
| 18 | 0.8482 | 0.8293 | 0.8127 | 0.7972 | 0.7810 |
| 19 | 0.8505 | 0.8318 | 0.8152 | 0.7999 | 0.7838 |
| 20 | 0.8528 | 0.8343 | 0.8176 | 0.8028 | 0.7867 |
| 21 | 0.8551 | 0.8368 | 0.8201 | 0.8057 | 0.7895 |
| 22 | 0.8575 | 0.8392 | 0.8227 | 0.8085 | 0.7926 |
| 23 | 0.8598 | 0.8417 | 0.8250 | 0.8111 | 0.7956 |
| 24 | 0.8625 | 0.8442 | 0.8276 | 0.8138 | 0.7985 |
| 25 | 0.8647 | 0.8468 | 0.8302 | 0.8163 | 0.8014 |
| 26 | 0.8670 | 0.8494 | 0.8332 | 0.8193 | 0.8045 |
| 27 | 0.8695 | 0.8520 | 0.8358 | 0.8222 | 0.8075 |
| 28 | 0.8715 | 0.8547 | 0.8388 | 0.8248 | 0.8107 |
| 29 | 0.8739 | 0.8571 | 0.8415 | 0.8278 | 0.8135 |
| 30 | 0.8764 | 0.8603 | 0.8446 | 0.8306 | 0.8168 |
| 31 | 0.8789 | 0.8628 | 0.8477 | 0.8333 | 0.8198 |
| 32 | 0.8812 | 0.8652 | 0.8510 | 0.8366 | 0.8231 |
| 33 | 0.8835 | 0.8681 | 0.8534 | 0.8398 | 0.8262 |
| 34 | 0.8865 | 0.8711 | 0.8570 | 0.8432 | 0.8294 |
| 35 | 0.8895 | 0.8739 | 0.8600 | 0.8462 | 0.8326 |
| 36 | 0.8927 | 0.8770 | 0.8630 | 0.8504 | 0.8364 |
| 37 | 0.8957 | 0.8797 | 0.8660 | 0.8539 | 0.8399 |
| 38 | 0.8987 | 0.8829 | 0.8695 | 0.8576 | 0.8437 |
| 39 | 0.9016 | 0.8860 | 0.8729 | 0.8610 | 0.8476 |
| 40 | 0.9046 | 0.8892 | 0.8769 | 0.8648 | 0.8517 |
| 41 | 0.9079 | 0.8925 | 0.8804 | 0.8691 | 0.8561 |
| 42 | 0.9113 | 0.8965 | 0.8844 | 0.8728 | 0.8599 |
| 43 | 0.9148 | 0.8998 | 0.8878 | 0.8768 | 0.8638 |
| 44 | 0.9184 | 0.9040 | 0.8918 | 0.8806 | 0.8682 |
| 45 | 0.9217 | 0.9076 | 0.8961 | 0.8844 | 0.8721 |
| 46 | 0.9249 | 0.9117 | 0.9003 | 0.8887 | 0.8765 |
| 47 | 0.9289 | 0.9158 | 0.9042 | 0.8928 | 0.8804 |
| 48 | 0.9326 | 0.9197 | 0.9085 | 0.8970 | 0.8851 |
| 49 | 0.9356 | 0.9236 | 0.9130 | 0.9017 | 0.8899 |
| 50 | 0.9389 | 0.9279 | 0.9178 | 0.9065 | 0.8947 |
| 51 | 0.9427 | 0.9321 | 0.9225 | 0.9113 | 0.9002 |
| 52 | 0.9467 | 0.9360 | 0.9274 | 0.9164 | 0.9052 |
| 53 | 0.9499 | 0.9402 | 0.9319 | 0.9213 | 0.9107 |
| 54 | 0.9539 | 0.9443 | 0.9362 | 0.9260 | 0.9163 |
| 55 | 0.9573 | 0.9487 | 0.9411 | 0.9309 | 0.9219 |
| 56 | 0.9603 | 0.9529 | 0.9458 | 0.9359 | 0.9274 |
| 57 | 0.9640 | 0.9567 | 0.9502 | 0.9410 | 0.9329 |
| 58 | 0.9677 | 0.9603 | 0.9544 | 0.9454 | 0.9381 |
| 59 | 0.9701 | 0.9636 | 0.9579 | 0.9507 | 0.9430 |
| 60 | 0.9728 | 0.9665 | 0.9608 | 0.9550 | 0.9479 |
| 61 | 0.9760 | 0.9702 | 0.9650 | 0.9592 | 0.9520 |
| 62 | 0.9785 | 0.9731 | 0.9681 | 0.9629 | 0.9564 |
| 63 | 0.9817 | 0.9762 | 0.9714 | 0.9662 | 0.9605 |
| 64 | 0.9844 | 0.9790 | 0.9744 | 0.9698 | 0.9642 |
| 65 | 0.9869 | 0.9819 | 0.9781 | 0.9732 | — |


### Rango real
- **X impreso:** 10 a 70 grados. **Curvas dibujadas: de ~15.4 a 65.2 grados**, y cada curva arranca
  a distinto barrido (0.04 → 15.4°, 0.06 → 16.0°, 0.08 → 16.1°, 0.10 → 16.3°, 0.12 → 16.6°).
  Fuera de 17–65 grados **no hay respaldo gráfico**; el tramo 10–15 y 65–70 del eje está vacío.
- **Y:** M_DD de 0.778 a 0.987.
- **Solo perfil convencional y solo C_L = 0.** Para supercrítico: t/c × 0.6 antes de entrar.
- **NO hay curva para t/c < 0.04 ni t/c > 0.12.**

### Incertidumbre
- Calibración X: 7 marcas uniformes, 183.67 px por 10 grados. Calibración Y: 6 marcas uniformes,
  186.3 px por 0.05.
- **Banda: ±0.003 en M_DD, ±0.3 grados en el barrido.**
- Cobertura: **0.00 % de tinta azul sin cubrir**. Las 5 curvas son paralelas y no se cruzan.

## B.3 — Fig. 12.30  Ajuste de M_DD por sustentación

**Ubicación:** libro p. 437 = PDF 467 (mitad inferior).

### Transcripción literal
> **Fig. 12.30**  Lift adjustment for M_DD.

- **Eje Y:** `LF_DD`, lineal. Solo dos rótulos: **1.0** arriba y **0.9** en la línea horizontal
  inferior; en medio hay marcas menores.
- **Eje X:** `Lift coefficient C_L`, de **0 a 0.5**, marcas cada 0.1.
- **6 curvas rotuladas por `t/c`** en su extremo derecho: 0.04, 0.06, 0.08, 0.10, 0.12, 0.14.
  Todas nacen del mismo punto `(C_L = 0, LF_DD = 1.0)`.

### Datos (LF_DD adimensional)

| C_L | t/c=0.04 | t/c=0.06 | t/c=0.08 | t/c=0.10 | t/c=0.12 | t/c=0.14 |
|---|---|---|---|---|---|---|
| 0.150 | 0.9985 | 0.9963 | 0.9939 | 0.9879 | 0.9822 | 0.9743 |
| 0.175 | 0.9977 | 0.9947 | 0.9908 | 0.9844 | 0.9780 | 0.9687 |
| 0.200 | 0.9965 | 0.9929 | 0.9879 | 0.9803 | 0.9731 | 0.9628 |
| 0.225 | 0.9950 | 0.9909 | 0.9848 | 0.9766 | 0.9682 | 0.9567 |
| 0.250 | 0.9936 | 0.9889 | 0.9815 | 0.9728 | 0.9629 | 0.9504 |
| 0.275 | 0.9923 | 0.9865 | 0.9781 | 0.9686 | 0.9574 | 0.9440 |
| 0.300 | 0.9903 | 0.9842 | 0.9745 | 0.9646 | 0.9517 | 0.9376 |
| 0.325 | 0.9888 | 0.9810 | 0.9707 | 0.9599 | 0.9459 | 0.9307 |
| 0.350 | 0.9872 | 0.9785 | 0.9669 | 0.9553 | 0.9397 | 0.9232 |
| 0.375 | 0.9851 | 0.9757 | 0.9631 | 0.9501 | 0.9336 | 0.9158 |
| 0.400 | 0.9834 | 0.9730 | 0.9596 | 0.9452 | 0.9278 | 0.9082 |
| 0.425 | 0.9814 | 0.9700 | 0.9551 | 0.9399 | 0.9210 | 0.9006 |
| 0.450 | 0.9796 | 0.9668 | 0.9509 | 0.9347 | 0.9149 | 0.8931 |
| 0.475 | 0.9773 | 0.9636 | 0.9464 | 0.9294 | — | 0.8855 |


### Rango real y la advertencia importante
- **X:** 0 a 0.5. Las curvas llegan a C_L = 0.498 (la de t/c = 0.12 se sale por abajo del cuadro
  en C_L ≈ 0.46; la de 0.14 sale del cuadro y su rótulo queda **debajo** del eje).
- 🔴 **Para C_L < 0.12 las seis curvas están DENTRO DEL ANCHO DEL TRAZO** (separación medida:
  0.0 px hasta C_L = 0.108; 1.6 px en 0.118; recién superan un ancho de línea, ~11 px, en
  C_L ≈ 0.156). **Por eso la tabla empieza en C_L = 0.15.** Debajo de eso NO existen seis valores
  distintos en el papel; lo honesto es interpolar linealmente entre `(0, 1.000)` y el valor
  tabulado en C_L = 0.15. Cualquier tabla que dé 6 cifras distintas abajo de 0.12 está inventando.
- **NO hay curva para t/c < 0.04 ni > 0.14.**
- Nota de acoplamiento con la Fig. 12.29: la 12.29 **no tiene** curva de t/c = 0.14 pero la 12.30
  **sí**. Para t/c = 0.14 hay que extrapolar la 12.29.

### Incertidumbre
- Calibración X: 6 marcas uniformes, 209.2 px por 0.1 de C_L (residuo < 1 px).
- Calibración Y: anclada en dos puntos sólidos — el origen del abanico (`LF_DD = 1` en C_L = 0,
  que es físicamente obligatorio) y la línea horizontal rotulada `0.9`. Da 429.5 px por 0.1.
  🟡 Las marcas menores del eje Y **no son divisiones limpias**: hay **11 intervalos** entre 1.0 y
  0.9 (39.2 px cada uno), no 10. No usarlas para calibrar. Con la calibración de dos anclas la
  incertidumbre de escala es **±0.003 en LF_DD**.
- **Banda total: ±0.004 en LF_DD** (para C_L ≥ 0.15), **±0.003 en C_L**.
- Cobertura: **0.00 % de tinta azul sin cubrir**.

### Verificación cruzada (12.29 + 12.30 + Ec. 12.46) — la que sí valida la cadena
El libro, p. 436: *"the Boeing 727 has an M_DD of about **Mach 0.86** when the lift coefficient
is only 0.1, but when the lift coefficient is increased to 0.3, the M_DD reduces to about
**Mach 0.82**."* Es decir, **ΔM_DD = −0.04** entre C_L 0.1 y 0.3.

Corriendo mi cadena con la geometría real del 727 (`Lambda_c/4 = 32°`, `t/c ≈ 0.10`) y suponiendo
`C_L_design = C_L`:

| C_L | M_DD(L=0) de mi Fig. 12.29 | LF_DD de mi Fig. 12.30 | M_DD por Ec. 12.46 |
|---|---|---|---|
| 0.1 | 0.8366 | 0.9941 | **0.827** |
| 0.3 | 0.8366 | 0.9646 | **0.792** |

**ΔM_DD = −0.035** contra el **−0.04** que imprime el libro: ✅ el comportamiento de la cadena
queda validado. Los valores absolutos salen 0.03 abajo de los "about 0.86/0.82" del libro, lo
cual es esperable — el 727 no es un ala trapezoidal simple (tiene t/c de raíz a punta 0.13→0.09)
y el libro dice "about".

## B.4 — Fig. 12.31  Mach de divergencia de arrastre del CUERPO

**Ubicación:** libro p. 438 = PDF 468 → `figuras/ray-c12-p438-0468.png`

### Transcripción literal
> **Fig. 12.31**  Body drag-divergent Mach number.

- **Eje Y:** `M_DD`, lineal, **0.6 a 1.0**, rótulos cada 0.1 y marcas cada 0.05.
- **Eje X:** `( 2*Ln / d )`, lineal, **0 a 20**, marcas cada 2.
- **2 curvas anotadas con flecha:** `Supersonic design` (la de arriba) y `Subsonic design`.

Definiciones del texto (p. 437): `Ln` es la longitud **de la nariz al punto donde la sección
transversal del fuselaje se vuelve esencialmente constante**; `d` es el diámetro del cuerpo en
ese punto. Si el fuselaje no es circular, `d` es el **diámetro equivalente** obtenido del área de
la sección. Se calcula M_DD de ala y de fuselaje y **se usa el menor**.

### Datos (M_DD del cuerpo)

| 2*Ln/d | disenio supersonico | disenio subsonico |
|---|---|---|
| 1.0 | 0.6815 | 0.6250 |
| 1.5 | 0.7266 | 0.6702 |
| 2.0 | 0.7656 | 0.7075 |
| 2.5 | 0.7981 | 0.7381 |
| 3.0 | 0.8252 | 0.7651 |
| 3.5 | 0.8476 | 0.7891 |
| 4.0 | 0.8671 | 0.8108 |
| 4.5 | 0.8834 | 0.8296 |
| 5.0 | 0.8955 | 0.8457 |
| 5.5 | 0.9062 | 0.8594 |
| 6.0 | 0.9153 | 0.8701 |
| 6.5 | 0.9223 | 0.8808 |
| 7.0 | 0.9284 | 0.8892 |
| 7.5 | 0.9335 | 0.8973 |
| 8.0 | 0.9376 | 0.9053 |
| 8.5 | 0.9413 | 0.9117 |
| 9.0 | 0.9449 | 0.9188 |
| 9.5 | 0.9490 | 0.9247 |
| 10.0 | 0.9527 | 0.9295 |
| 10.5 | 0.9574 | 0.9344 |
| 11.0 | 0.9632 | 0.9402 |
| 11.5 | 0.9702 | 0.9464 |
| 12.0 | 0.9774 | 0.9535 |
| 12.5 | 0.9859 | 0.9600 |
| 13.0 | 0.9947 | 0.9678 |
| 13.5 | — | 0.9753 |
| 14.0 | — | 0.9839 |
| 14.5 | — | 0.9920 |
| 15.0 | — | 1.0009 |


### Rango real
- **X impreso:** 0 a 20. **Curvas dibujadas:** supersónica de `2Ln/d` = 0.81 a **13.4**;
  subsónica de 0.84 a **15.1**. **El tramo 13.4–20 (supersónica) y 15.1–20 (subsónica) del eje
  está VACÍO.** Las dos curvas salen por el techo del cuadro al llegar a M_DD ≈ 1.0.
- **Y:** de 0.61 (subsónica en 2Ln/d ≈ 0.84) hasta 1.00.
- Regla de tope físico evidente en la figura: **M_DD del cuerpo satura en 1.0**; el software debe
  recortar ahí y marcar `2Ln/d` fuera de rango como extrapolación.

### Incertidumbre
- Calibración X: 11 marcas uniformes, 115.5 px por 2 unidades. Calibración Y: 7 marcas uniformes,
  232.5 px por 0.1.
- **Banda: ±0.004 en M_DD, ±0.06 en 2Ln/d.**
- Cobertura: **0.00 % sin cubrir.** Dos curvas separadas, sin cruces. Es la lectura más limpia
  del bloque junto con la 12.22.
- Sin verificación cruzada: el libro no imprime ningún número leído de esta figura.

## B.5 — Fig. 12.36  Factor de interferencia de biplano (Prandtl)

**Ubicación:** libro p. 445 = PDF 475 → `figuras/ray-c12-p445-0475.png`

### Transcripción literal
> **Fig. 12.36**  Prandtl's biplane interference factor.[19]

- **Eje Y:** `Interference factor (sigma)`, lineal, **0 a 1.0**, marcas cada 0.10.
- **Eje X:** `( Gap / Average span )`, lineal, **0 a 0.40** rotulado (el cuadro llega a ~0.45),
  marcas cada 0.05, rótulos cada 0.10.
- **Leyenda con flechas:** `mu = b_shorter / b_longer`, con 7 curvas etiquetadas
  **1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4** (de arriba hacia abajo).

Uso, del texto de la misma página: para un biplano de alas de igual geometría y sustentación la
Ec. (12.50) se reduce a `e = 2/(1 + sigma)`; los valores típicos de gap/envergadura promedio son
≈0.15. **El libro advierte que el método sale optimista y recomienda multiplicar el resultado por
0.8 antes de meterlo en la Ec. (12.47).**

### Datos (sigma adimensional)

| gap/span | mu=1.0 | mu=0.9 | mu=0.8 | mu=0.7 | mu=0.6 | mu=0.5 | mu=0.4 |
|---|---|---|---|---|---|---|---|
| 0.010 | 0.938 | 0.866 | 0.774 | 0.679 | 0.588 | 0.493 | 0.391 |
| 0.020 | 0.892 | 0.831 | 0.748 | 0.657 | 0.574 | 0.480 | 0.383 |
| 0.030 | 0.849 | 0.794 | 0.722 | 0.637 | 0.558 | 0.470 | 0.373 |
| 0.040 | 0.812 | 0.767 | 0.700 | 0.618 | 0.544 | 0.458 | 0.365 |
| 0.050 | 0.778 | 0.738 | 0.676 | 0.597 | 0.530 | 0.446 | 0.357 |
| 0.060 | 0.750 | 0.713 | 0.656 | 0.582 | 0.516 | 0.435 | 0.348 |
| 0.070 | 0.722 | 0.689 | 0.637 | 0.566 | 0.502 | 0.426 | 0.340 |
| 0.080 | 0.697 | 0.665 | 0.617 | 0.550 | 0.490 | 0.415 | 0.332 |
| 0.090 | 0.673 | 0.646 | 0.599 | 0.535 | 0.476 | 0.404 | 0.325 |
| 0.100 | 0.652 | 0.626 | 0.581 | 0.519 | 0.464 | 0.394 | 0.317 |
| 0.110 | 0.633 | 0.606 | 0.564 | 0.507 | 0.452 | 0.386 | 0.309 |
| 0.120 | 0.614 | 0.587 | 0.548 | 0.492 | 0.441 | 0.376 | 0.302 |
| 0.130 | 0.595 | 0.570 | 0.532 | 0.478 | 0.430 | 0.365 | 0.295 |
| 0.140 | 0.579 | 0.555 | 0.517 | 0.467 | 0.419 | 0.357 | 0.287 |
| 0.150 | 0.561 | 0.538 | 0.503 | 0.454 | 0.407 | 0.348 | 0.282 |
| 0.160 | 0.546 | 0.523 | 0.488 | 0.442 | 0.396 | 0.339 | 0.276 |
| 0.170 | 0.530 | 0.507 | 0.475 | 0.431 | 0.386 | 0.331 | 0.268 |
| 0.180 | 0.515 | 0.493 | 0.461 | 0.420 | 0.376 | 0.323 | 0.261 |
| 0.190 | 0.501 | 0.478 | 0.449 | 0.408 | 0.366 | 0.315 | 0.254 |
| 0.200 | 0.486 | 0.465 | 0.437 | 0.398 | 0.356 | 0.304 | 0.250 |
| 0.210 | 0.474 | 0.454 | 0.425 | 0.388 | 0.348 | 0.299 | 0.243 |
| 0.220 | 0.461 | 0.450 | 0.412 | 0.379 | 0.337 | 0.291 | 0.237 |
| 0.230 | 0.450 | 0.430 | 0.403 | 0.368 | 0.329 | 0.282 | 0.231 |
| 0.240 | 0.439 | 0.419 | 0.392 | 0.359 | 0.321 | 0.276 | 0.225 |
| 0.250 | 0.426 | 0.406 | 0.380 | 0.350 | 0.311 | 0.269 | 0.220 |
| 0.260 | 0.415 | 0.394 | 0.368 | 0.340 | 0.303 | 0.262 | 0.214 |
| 0.270 | 0.403 | 0.385 | 0.359 | 0.332 | 0.294 | 0.255 | 0.209 |
| 0.280 | 0.393 | 0.374 | 0.352 | 0.322 | 0.288 | 0.249 | 0.203 |
| 0.290 | 0.384 | 0.366 | 0.340 | 0.315 | 0.280 | 0.242 | 0.198 |
| 0.300 | 0.373 | 0.355 | 0.331 | 0.307 | 0.272 | 0.237 | 0.193 |
| 0.310 | 0.364 | 0.345 | 0.322 | 0.299 | 0.265 | 0.230 | 0.188 |
| 0.320 | 0.354 | 0.336 | 0.312 | 0.290 | 0.258 | 0.225 | 0.184 |
| 0.330 | 0.345 | 0.328 | 0.306 | 0.284 | 0.251 | 0.219 | 0.179 |
| 0.340 | 0.337 | 0.319 | 0.296 | 0.275 | 0.244 | 0.212 | 0.175 |
| 0.350 | 0.328 | 0.311 | 0.290 | 0.269 | 0.238 | 0.207 | 0.170 |
| 0.360 | 0.320 | 0.302 | 0.282 | 0.261 | 0.231 | 0.203 | 0.165 |
| 0.370 | 0.313 | 0.295 | 0.274 | 0.253 | 0.226 | 0.197 | 0.162 |
| 0.380 | 0.304 | 0.287 | 0.267 | 0.247 | 0.220 | 0.192 | 0.157 |
| 0.390 | 0.297 | 0.280 | 0.261 | 0.241 | 0.214 | 0.186 | 0.154 |
| 0.400 | 0.290 | 0.273 | 0.254 | 0.234 | 0.209 | 0.183 | 0.150 |
| 0.410 | 0.283 | 0.266 | 0.247 | 0.228 | 0.205 | 0.178 | 0.147 |
| 0.420 | 0.276 | 0.258 | 0.241 | 0.221 | 0.200 | 0.174 | 0.143 |
| 0.430 | 0.270 | 0.253 | 0.235 | 0.216 | 0.194 | 0.170 | 0.139 |
| 0.440 | 0.264 | 0.248 | 0.230 | 0.211 | 0.191 | 0.166 | 0.137 |
| 0.450 | 0.258 | 0.242 | 0.224 | 0.207 | — | — | — |


### Rango real
- **X:** las curvas van de gap/span ≈ **0.001 a 0.451**. En gap = 0, sigma = 1.0 por definición
  física (mi lectura en el primer píxel de la curva mu=1.0 da **0.994** — buen control de calibración).
- Las curvas de **mu = 0.6, 0.5 y 0.4 terminan en 0.449** y las de 1.0/0.9/0.8/0.7 en 0.451.
- **Y:** sigma de 0.137 a 0.994.
- **No hay curva para mu < 0.4.**

### Incertidumbre
- Calibración X: 10 marcas uniformes, 222.2 px por 0.10. Calibración Y: 6 marcas uniformes
  detectadas (las de arriba las tapan las curvas), 112.6 px por 0.10; el eje X es sigma = 0.
- **Banda: ±0.004 en sigma, ±0.002 en gap/span.**
- Cobertura: **0.06 % sin cubrir** — prácticamente perfecta.
- 🟡 Las **flechas de los rótulos mu son del mismo azul que las curvas** y las cruzan; el trazador
  tuvo que puentear esos huecos (hasta 35 px). Ya está resuelto, pero es la razón por la que un
  trazador ingenuo se rompe en esta figura.

### Verificación cruzada — ✅ VALIDADA
El libro, p. 445: *"Typical values for the vertical gap divided by the average span are about
**0.15** ... This gives an **e of about 1.3**, greater than one!"*

Mi lectura en gap/span = 0.15, mu = 1.0 (alas iguales): **sigma = 0.5610**
→ `e = 2/(1 + 0.5610) = ` **1.281**. Contra el "about 1.3" impreso: **−1.5 %**. ✅

## B.6 — Fig. 12.22  Coeficiente de fricción de placa plana (bonus)

**Ubicación:** libro p. 421 = PDF 451. La incluyo porque es la evidencia que recupera la Ec. 12.27.

- **Eje Y:** `Cf`, **lineal**, de 0.0000 a 0.0070, marcas cada 0.0010.
- **Eje X:** `Reynolds number`, **lineal**, de 0 a 2×10^6, retícula cada 2.5×10^5.
- Dos curvas rotuladas dentro del cuadro: `Turbulent` y `Laminar`.

### Datos

| Re | Cf turbulento | Cf laminar |
|---|---|---|
| 1.50e5 | 0.00667 | 0.00352 |
| 2.00e5 | 0.00624 | 0.00305 |
| 3.00e5 | 0.00568 | 0.00241 |
| 4.00e5 | 0.00533 | 0.00205 |
| 5.00e5 | 0.00507 | 0.00182 |
| 6.00e5 | 0.00492 | 0.00167 |
| 8.00e5 | 0.00468 | 0.00144 |
| 1.00e6 | 0.00450 | 0.00129 |
| 1.20e6 | 0.00436 | 0.00119 |
| 1.40e6 | 0.00421 | 0.00109 |
| 1.60e6 | 0.00412 | 0.00103 |
| 1.80e6 | 0.00403 | 0.00099 |
| 1.95e6 | 0.00398 | 0.00096 |

### Rango e incertidumbre
- **Curvas dibujadas:** turbulenta de Re = 1.03e5 a 2.00e6; laminar de 9.5e4 a 2.00e6.
- 🔴 **El eje es LINEAL, no logarítmico** — y solo llega a Re = 2×10^6. Un ala real de transporte
  va a Re = 10^7–10^8. **Esta figura NO sirve para leer Cf de un avión grande**; para eso hay que
  usar la ecuación. La figura es solo ilustrativa del orden de magnitud.
- Calibración: 9 líneas de retícula vertical uniformes (167.7 px por 2.5e5) y 14 horizontales
  (123.29 px por 0.001). **Banda: ±0.00005 en Cf.**
- Cobertura: **0.00 % sin cubrir.**

## B.7 — Fig. 12.24  Arrastre de tanques externos

**Ubicación:** libro p. 426 = PDF 456 → `figuras/ray-c12-p426-0456.png`

> **Fig. 12.24**  External stores (fuel tanks) drag.

- **Eje Y:** `D/q` con **dos escalas**: `ft^2` (0 a 2.5, marcas cada 0.5) y `m^2` (0.05 a 0.20).
- **Eje X:** `Mach number`, **0.4 a 1.0**, marcas cada 0.05, rótulos cada 0.1.
- **4 curvas rotuladas a la derecha (de arriba abajo):** `300-gallon tank on wing`,
  `300-gallon tank on fuselage`, `150-gallon tank on wing`, `150-gallon tank on fuselage`.

### Mesetas subsónicas — el número que más se usa (lectura exacta, es una recta)

| Almacén | D/q, ft^2 | D/q, m^2 (= ×0.0929) |
|---|---|---|
| Tanque 300 gal en ala | **0.487** | 0.0452 |
| Tanque 300 gal en fuselaje | **0.405** | 0.0376 |
| Tanque 150 gal en ala | **0.331** | 0.0307 |
| Tanque 150 gal en fuselaje | **0.301** | 0.0280 |

La meseta es plana de M = 0.40 hasta **M ≈ 0.82**; ahí arranca la subida transónica.

### Datos completos (D/q en ft^2)

| Mach | 300 gal ala | 300 gal fuselaje | 150 gal ala | 150 gal fuselaje |
|---|---|---|---|---|
| 0.42 | 0.488 | 0.407 | 0.333 | 0.301 |
| 0.44 | 0.488 | 0.406 | 0.331 | 0.301 |
| 0.46 | 0.487 | 0.406 | 0.331 | 0.301 |
| 0.48 | 0.487 | 0.406 | 0.331 | 0.301 |
| 0.50 | 0.486 | 0.406 | 0.331 | 0.301 |
| 0.52 | 0.487 | 0.406 | 0.331 | 0.301 |
| 0.54 | 0.487 | 0.405 | 0.331 | 0.301 |
| 0.56 | 0.487 | 0.406 | 0.330 | 0.301 |
| 0.58 | 0.487 | 0.405 | 0.331 | 0.301 |
| 0.60 | 0.487 | 0.405 | 0.331 | 0.301 |
| 0.62 | 0.487 | 0.405 | 0.331 | 0.301 |
| 0.64 | 0.485 | 0.405 | 0.331 | 0.301 |
| 0.66 | 0.487 | 0.405 | 0.330 | 0.301 |
| 0.68 | 0.487 | 0.405 | 0.330 | 0.301 |
| 0.70 | 0.485 | 0.405 | 0.331 | 0.301 |
| 0.72 | 0.486 | 0.405 | 0.331 | 0.301 |
| 0.74 | 0.487 | 0.405 | 0.331 | 0.301 |
| 0.76 | 0.487 | 0.404 | 0.331 | 0.301 |
| 0.78 | 0.486 | 0.404 | 0.330 | 0.301 |
| 0.80 | 0.486 | 0.404 | 0.330 | 0.301 |
| 0.82 | 0.503 | 0.418 | 0.339 | 0.307 |
| 0.84 | 0.567 | 0.474 | 0.392 | 0.342 |
| 0.86 | 0.669 | 0.574 | 0.474 | 0.423 |
| 0.88 | 0.862 | 0.747 | 0.644 | 0.618 |
| 0.90 | 1.175 | 1.000 | 0.856 | 0.856 |
| 0.92 | 1.587 | 1.333 | 1.169 | 1.169 |
| 0.94 | 2.028 | 1.681 | 1.444 | 1.444 |
| 0.96 | 2.312 | 1.943 | 1.630 | 1.630 |
| 0.98 | 2.516 | 2.093 | 1.749 | 1.749 |
| 1.00 | — | 2.179 | 1.819 | 1.819 |
| 1.02 | — | — | — | — |


### Rango e incertidumbre
- **X:** curvas dibujadas de M = 0.408 a 0.997–1.015 (se salen un poco del eje impreso, que
  termina en 1.0). **Nada por debajo de M = 0.4 ni por arriba de M ≈ 1.0.**
- **Y:** de 0.301 a 2.62 ft^2 (las curvas salen por el techo del cuadro).
- Calibración X: 13 marcas uniformes, 167.8 px por 0.1 de Mach. Calibración Y: 5 rótulos
  uniformes, 432 px por 1.0 ft^2, cero en la línea del eje.
- **Banda: ±0.005 ft^2 en la meseta; ±0.05 ft^2 en la rama transónica** (la rama es casi vertical:
  un píxel de error en x se vuelve mucho error en y).
- Cobertura: **7.9 % de tinta sin cubrir.**
- 🔴 **Límite honesto:** las curvas de **150 gal en ala y 150 gal en fuselaje se funden en un solo
  trazo a partir de M ≈ 0.88** y ya no se pueden separar. Arriba de ese Mach los dos renglones de
  mi tabla son el mismo trazo. Toda la tinta que quedó sin cubrir está en esa zona.

## B.8 — Fig. 12.25  Arrastre de bombas y misiles

**Ubicación:** libro p. 427 = PDF 457 (mitad superior).

> **Fig. 12.25**  Bomb and missile drag.

- **Eje Y:** `D/q`, escalas `ft^2` (0 a 2.5) y `m^2` (0.05 a 0.20).
- **Eje X:** `Mach number`, **0.4 a 1.2**, marcas cada 0.05.
- **5 curvas rotuladas:** `6-500 lb bomb cluster (not including rack drag)`,
  `6-250 lb bomb cluster (not including rack drag)`, `2000 lb bomb on fuselage`,
  `2000 lb bomb on wing`, `Aim-9 missile and pylon`.

### Mesetas subsónicas

| Almacén | D/q, ft^2 |
|---|---|
| Racimo 6×500 lb (sin el rack) | **1.09–1.12** (sube muy suave con Mach) |
| Racimo 6×250 lb (sin el rack) | **0.64–0.67** |
| Bomba 2000 lb en fuselaje | **0.15–0.16** |
| Bomba 2000 lb en ala | **0.15–0.16** (idéntica a la de fuselaje hasta M ≈ 0.82) |
| Misil AIM-9 + pilón | **0.116–0.124** |

### Datos completos (D/q en ft^2)

| Mach | 6x500 lb | 6x250 lb | 2000 lb fus. | 2000 lb ala | AIM-9+pilon |
|---|---|---|---|---|---|
| 0.42 | 1.085 | 0.638 | 0.151 | 0.151 | 0.115 |
| 0.44 | 1.086 | 0.639 | 0.152 | 0.152 | 0.115 |
| 0.46 | 1.092 | 0.641 | 0.152 | 0.152 | 0.116 |
| 0.48 | 1.096 | 0.642 | 0.155 | 0.155 | 0.116 |
| 0.50 | 1.102 | 0.647 | 0.155 | 0.155 | 0.116 |
| 0.52 | 1.103 | 0.647 | 0.155 | 0.155 | 0.116 |
| 0.54 | 1.109 | 0.654 | 0.155 | 0.155 | 0.116 |
| 0.56 | 1.114 | 0.659 | 0.157 | 0.157 | 0.116 |
| 0.58 | 1.117 | 0.664 | 0.157 | 0.157 | 0.118 |
| 0.60 | 1.122 | 0.668 | 0.157 | 0.157 | 0.118 |
| 0.62 | 1.131 | 0.678 | 0.159 | 0.159 | 0.119 |
| 0.64 | 1.143 | 0.687 | 0.162 | 0.162 | 0.118 |
| 0.66 | 1.154 | 0.693 | 0.162 | 0.162 | 0.118 |
| 0.68 | 1.172 | 0.701 | 0.162 | 0.162 | 0.118 |
| 0.70 | 1.194 | 0.713 | 0.164 | 0.164 | 0.118 |
| 0.72 | 1.224 | 0.726 | 0.164 | 0.164 | 0.121 |
| 0.74 | 1.260 | 0.745 | 0.165 | 0.165 | 0.122 |
| 0.76 | 1.305 | 0.772 | 0.167 | 0.167 | 0.121 |
| 0.78 | 1.364 | 0.803 | 0.170 | 0.170 | 0.124 |
| 0.80 | 1.444 | 0.852 | 0.170 | 0.170 | 0.124 |
| 0.82 | 1.550 | 0.919 | 0.178 | 0.178 | 0.122 |
| 0.84 | 1.702 | 1.011 | 0.205 | 0.205 | 0.122 |
| 0.86 | 1.878 | 1.135 | 0.277 | 0.234 | 0.124 |
| 0.88 | 2.093 | 1.273 | 0.394 | 0.306 | 0.124 |
| 0.90 | 2.345 | 1.496 | 0.553 | 0.398 | 0.124 |
| 0.92 | 2.541 | 1.661 | 0.720 | 0.526 | 0.124 |
| 0.94 | — | 1.978 | 0.866 | 0.678 | 0.126 |
| 0.96 | — | 2.337 | — | 0.834 | 0.135 |
| 0.98 | — | — | — | — | 0.146 |
| 1.00 | — | — | — | — | 0.164 |
| 1.02 | — | — | — | — | 0.190 |
| 1.04 | — | — | — | — | 0.211 |
| 1.06 | — | — | — | — | 0.234 |
| 1.08 | — | — | — | — | 0.247 |
| 1.10 | — | — | — | — | 0.259 |
| 1.12 | — | — | — | — | 0.269 |
| 1.14 | — | — | — | — | 0.272 |


### Rango e incertidumbre
- **X:** todas arrancan en M = 0.403. Terminan: 6×500 en 0.939; 6×250 en 0.968; 2000 lb fuselaje
  en 0.959; 2000 lb ala en 0.964; **AIM-9 en 1.140** (la única que cruza el sónico).
- **Y:** de 0.109 a 2.84 ft^2.
- Calibración X: 18 marcas uniformes, 134.25 px por 0.1 de Mach. Calibración Y: 6 rótulos
  uniformes, 348 px por 1.0 ft^2.
- **Banda: ±0.005 ft^2 en las mesetas; ±0.04 ft^2 en las ramas transónicas.**
- Cobertura: **2.2 % sin cubrir.**
- 🟡 Las dos curvas de 2000 lb (fuselaje y ala) **son la misma línea hasta M ≈ 0.82**; se separan
  después, quedando la de fuselaje arriba. Debajo de 0.82 no hay dos valores distintos.
- ⚠️ Los racimos de bombas **NO incluyen el arrastre del rack** — hay que sumarle la curva
  `Multiple bomb cluster rack` de la Fig. 12.26. Está en el rótulo de la propia figura.

## B.9 — Fig. 12.26  Arrastre de pilones y racks

**Ubicación:** libro p. 427 = PDF 457 (mitad inferior).

> **Fig. 12.26**  Pylon and bomb rack drag.

- **Eje Y:** `D/q`, escalas `ft^2` (0 a 1.5) y `m^2` (0.05, 0.10).
- **Eje X:** `Mach number`, **0.5 a 1.1**, marcas cada 0.05.
- **3 curvas:** `Multiple bomb cluster rack`, `Fuselage stores pylon`, `Wing stores pylon`.

### Datos (D/q en ft^2)

| Mach | rack multiple | pilon fuselaje | pilon ala |
|---|---|---|---|
| 0.52 | 0.369 | 0.100 | 0.100 |
| 0.54 | 0.371 | 0.100 | 0.100 |
| 0.56 | 0.370 | 0.104 | 0.104 |
| 0.58 | 0.376 | 0.116 | 0.116 |
| 0.60 | 0.382 | 0.111 | 0.111 |
| 0.62 | 0.388 | 0.111 | 0.111 |
| 0.64 | 0.398 | 0.099 | 0.099 |
| 0.66 | 0.416 | 0.106 | 0.106 |
| 0.68 | 0.421 | 0.095 | 0.095 |
| 0.70 | 0.438 | 0.103 | 0.103 |
| 0.72 | 0.448 | 0.106 | 0.106 |
| 0.74 | 0.482 | 0.106 | 0.106 |
| 0.76 | 0.507 | 0.113 | 0.113 |
| 0.78 | 0.533 | 0.108 | 0.108 |
| 0.80 | 0.561 | 0.111 | 0.111 |
| 0.82 | 0.580 | 0.117 | 0.117 |
| 0.84 | 0.633 | 0.137 | 0.137 |
| 0.86 | 0.680 | 0.152 | 0.152 |
| 0.88 | 0.753 | 0.156 | 0.156 |
| 0.90 | 0.824 | 0.184 | 0.184 |
| 0.92 | 0.909 | 0.182 | 0.182 |
| 0.94 | 1.007 | 0.212 | 0.212 |
| 0.96 | 1.115 | 0.240 | 0.189 |
| 0.98 | 1.243 | 0.272 | 0.199 |
| 1.00 | 1.374 | 0.283 | — |
| 1.02 | — | — | — |


### Rango e incertidumbre
- **X:** las tres arrancan en M = 0.502. El rack y el pilón de fuselaje llegan a M ≈ 1.008;
  el **pilón de ala termina en M = 0.982**.
- **Y:** de 0.104 a 1.41 ft^2.
- Calibración X: 13 marcas uniformes, 163.75 px por 0.1 de Mach. Calibración Y: 4 rótulos
  uniformes, 423 px por 1.0 ft^2.
- **Banda: ±0.005 ft^2, ±0.004 en Mach.**
- Cobertura: **1.3 % sin cubrir.**
- 🔴 **La curva `Wing stores pylon` está impresa en un azul MUCHO más claro** que las otras dos
  (RGB ≈ 199,222,236 contra 43,144,202). Un extractor de figuras con umbral normal **la pierde
  por completo**. Hubo que bajar el umbral de color para verla. Además, **coincide con la de
  `Fuselage stores pylon` hasta M ≈ 0.92**; solo se separan en el último tramo, quedando la de
  fuselaje arriba. Debajo de 0.92 no hay dos valores distintos.

---

# C. TABLAS — CABECERAS RECUPERADAS Y ERRATA

## C.1 — Tabla 12.5 (libro p. 421) "Skin Roughness Value k" — 🔴 ERRATA

Cabeceras (las tres, legibles): **`Surface`** | **`k, ft`** | **`k, m`**

| Surface | k, ft | k, m | 0.3048 × (k,ft) | ¿cierra? |
|---|---|---|---|---|
| Camouflage paint on aluminum | 3.33 × 10⁻⁵ | 1.015 × 10⁻⁵ | 1.015 | ✅ |
| Smooth paint | 2.08 × 10⁻⁵ | 0.634 × 10⁻⁵ | 0.634 | ✅ |
| Production sheet metal | 1.33 × 10⁻⁵ | 0.405 × 10⁻⁵ | 0.405 | ✅ |
| Polished sheet metal | 0.50 × 10⁻⁵ | 0.152 × 10⁻⁵ | 0.152 | ✅ |
| **Smooth molded composite** | **0.7 × 10⁻⁵** | **0.052 × 10⁻⁵** | **0.213** | 🔴 **NO** |

**Cuál es el correcto: el METRICO.** Argumentos, en orden de peso:

1. **Aritmética.** `0.052 / 0.3048 = 0.1706` → el valor en pies debería ser **0.17 × 10⁻⁵**.
   Al revés no funciona: `0.7 × 0.3048 = 0.213`, que no es 0.052 por ningún redondeo.
   El renglón es un **"0.17" al que se le cayó el 1** al componer. Amplifiqué la celda ×4 para
   descartar que fuera problema de OCR: en el papel dice `0.7 × 10⁻⁵`, sin duda.
2. **Física / consistencia interna del libro.** El compuesto moldeado liso tiene que ser la
   superficie MÁS lisa de la lista. Con `0.17` lo es (0.17 < 0.50 del metal pulido). Con `0.7`
   quedaría **más rugoso que el metal pulido**, lo que contradice a la Tabla 12.4 de la p. 419,
   que le da a los compuestos moldeados lisos el mejor flujo laminar de toda la tabla
   (50 % en alas, 70 % en planeadores, contra 35 % del metal liso).
3. Coincide con la 5ª edición del mismo libro, donde ese renglón es `0.17 × 10⁻⁵ ft`.

```
USAR:   k(smooth molded composite) = 0.17e-5 ft = 0.052e-5 m
NO USAR: 0.7e-5 ft   <-- errata de la 6a edicion
```

**Impacto:** `k` entra a la (12.28)/(12.29) como `(l/k)^1.053`. Un factor 4.1 de error en `k` da
un factor ≈4.5 de error en el R_cutoff, y por tanto un Cf sobrestimado en toda la superficie de
compuesto. **Es una errata que sí muerde.**

## C.2 — Tabla 12.6 (libro pp. 428–429) "Miscellaneous and Landing-Gear Component Drags"

**Cabeceras recuperadas:**
- Columna 1: **la celda está literalmente EN BLANCO en el libro** (celda azul vacía). No es que
  el OCR la haya perdido: no existe. Por el contenido, es `Componente`.
- Columna 2: **`C_D_pi  =  [ (D/q) / Frontal Area ]`**

El subíndice `pi` no es casual: el propio texto de la p. 428 lo define —
*"Drag coefficients that are referenced to the component's frontal area are sometimes called
C_D_pi."* O sea: **estos coeficientes NO están referidos al área del ala, sino al área frontal
del componente.** Para usarlos: `D/q = C_D_pi × área frontal`, y luego `C_D = (D/q)/S_ref`.

| Componente | C_D_pi |
|---|---|
| Flat plate perpendicular to flow | 1.28 |
| Sphere alone—high R# | 0.10 |
| Sphere alone—low R# | 0.3–0.5 |
| Hollow sphere, open end forward | 1.40 |
| Hollow sphere, open end to rear | 0.40 |
| Bullet shape, blunt back | 0.30 |
| Exposed water-cooled radiator | 1.00 |
| Cowled water-cooled radiator | 0.3–0.5 |
| Air scoops | 1.2–2.0 |
| Control horn | 0.3–0.8 |
| Speed brake—fuselage mounted | 1.00 |
| Speed brake—wing mounted | 1.60 |
| Windshield smoothly faired into fuselage | 0.07 |
| Windshield—sharp edged, poorly faired | 0.15 |
| Open cockpit (ref. windscreen A-frontal) | 0.50 |
| Parachute or drogue chute | 1.40 |
| Regular wheel and tire | 0.25 |
| Second wheel and tire in tandem | 0.15 |
| Streamlined wheel and tire | 0.18 |
| Wheel and tire with fairing | 0.13 |
| Streamlined strut (1/6 < t/c < 1/3) | 0.05 |
| Round strut or wire (R# > 3 × 10⁵) | 0.30 |
| Round strut or wire (R# < 3 × 10⁵) | 1.17 |
| Flat spring gear leg | 1.40 |
| Fork, bogey, irregular fitting | 1.0–1.4 |

Reglas de uso que van con esta tabla (p. 430, fáciles de perder):
- Para interferencia mutua entre piezas del tren, **multiplicar la suma por 1.2**.
- Tren retráctil con puertas abiertas mientras el tren está abajo: **+7 %** al total del tren.
- El arrastre del tren baja al subir el C_L (menos velocidad bajo el ala); despreciable en
  análisis inicial.
- Montantes: t/c óptimo ≈ **0.19 en tensión**, **0.23 en compresión**.

## C.3 — Tabla 12.7 (libro p. 430) "Component Miscellaneous Drags"

**Cabeceras recuperadas:**
- Columna 1: **celda EN BLANCO en el libro** (por contenido: `Componente`).
- Columna 2: **`D/q, ft²`**   ·   Columna 3: **`D/q, m²`**

Estos son **valores absolutos de área de arrastre**, no coeficientes: el texto de la p. 430 lo
dice — *"These are actual values rather than ratioed to frontal areas because they are actual
components."*

| Componente | D/q, ft² | D/q, m² | check ×0.0929 |
|---|---|---|---|
| Arresting hook—USN | 0.15 | 0.014 | 0.0139 ✅ |
| Arresting hook—USAF | 0.10 | 0.009 | 0.0093 ✅ |
| Machine gun ports | 0.02 | 0.002 | 0.0019 ✅ |
| Cannon port | 0.20 | 0.019 | 0.0186 ✅ |
| Exposed pilot—prone | 1.20 | 0.111 | 0.1115 ✅ |
| Exposed pilot—seated | 6.00 | 0.557 | 0.5574 ✅ |
| Exposed pilot—spread eagle | 9.00 | 0.836 | 0.8361 ✅ |

Las 7 filas cierran la conversión ft²→m² dentro del redondeo. **Aquí no hay errata.**

## C.4 — Tabla 12.8 (libro p. 431) "Leakage and Protuberance Drag"

**La cabecera SÍ está impresa y es legible** (a diferencia de la 12.6 y la 12.7):
**`Aircraft Type`** | **`Drag, %`**

| Aircraft Type | Drag, % |
|---|---|
| Propeller aircraft | 5–10 |
| Jet transports or bombers | 2–5 |
| Non-stealth fighters | 10–15 |
| Stealth fighters | 3–5 |

El porcentaje es **sobre el arrastre parásito total** (es el término `C_D_L&P` de la Ec. 12.24).
Añadidos del texto de la p. 431: **ala de flecha variable = +3 % adicional** por los huecos y
escalones del pivote; con cuidado extremo de fabricación se puede llevar a casi cero, pero solo
los aviones de carreras lo hacen.

---

# D. ERRATAS Y TRAMPAS DEL CAPÍTULO (resumen para el implementador)

| # | Dónde | Qué pasa | Qué hacer |
|---|---|---|---|
| 1 | p. 420, Ec. (12.27) | 🔴 **La ecuación no está impresa.** Se referencia 4 veces y nunca se da el cuerpo. | Usar `0.455/(log10 R)^2.58` (verificado ±1 % contra la Fig. 12.22) y marcar el factor de Mach como no verificado. Ver §A.2. |
| 2 | p. 421, Tabla 12.5 | 🔴 `k` del compuesto moldeado en pies (`0.7e-5`) no guarda la razón 0.3048 con el métrico (`0.052e-5`). | Usar **0.17e-5 ft**. Ver §C.1. |
| 3 | p. 422, Ec. (12.31) + nota al pie | Dos ecuaciones de FF de fuselaje distintas en la misma página; difieren 27 % en f = 4. | Implementar **las dos**, con bandera de edición. Ver §A.3. |
| 4 | p. 436 | Perfil supercrítico: hay que multiplicar t/c por 0.6 **antes** de entrar a las Figs. 12.29/12.30. | Que el software lo haga solo y lo diga. |
| 5 | Fig. 12.29 vs 12.30 | La 12.30 tiene curva de t/c = 0.14; la 12.29 **no** (llega a 0.12). | Marcar t/c = 0.14 como extrapolado en la 12.29. |
| 6 | Fig. 12.30 | Las marcas menores del eje Y dan **11 divisiones** entre 1.0 y 0.9, no 10. | No calibrar con ellas. |
| 7 | Fig. 12.39 | La curva rotulada `Design C_L = 0.8` tiene su máximo en **C_L ≈ 0.72**, no en 0.8. | Es así en el dibujo; no "corregirlo". |
| 8 | p. 449 vs Fig. 12.39 | El texto ("S < 0.3 con C_L = 1.0 para un ala de diseño 0.5") **no corresponde a la figura** (que da 0.455). | El texto es genérico, no una lectura de la carta. No mezclarlos. |
| 9 | Ec. (12.61) | Con `delta_flap < 10 deg` la ecuación da **arrastre negativo**. | Recortar en cero. |
| 10 | Ec. (12.62) | `k_f` es **mayor** para medio flap (0.28) que para flap completo (0.14). | Es lo impreso; no "arreglarlo". |
| 11 | Fig. 12.26 | La curva `Wing stores pylon` está impresa en un azul clarísimo. | Cualquier re-extracción automática la va a perder. |
| 12 | Fig. 12.22 | Eje **lineal** y solo hasta Re = 2×10⁶. | No usarla para leer Cf de aviones grandes; usar la ecuación. |
| 13 | Tablas 12.6 y 12.7 | La cabecera de la primera columna **está en blanco en el papel**. | No es pérdida del OCR; no hay nada que recuperar ahí. |

---

# E. LO QUE NO PUDE LEER

Declarado explícitamente para que nadie lo rellene con inventos.

1. **Ec. (12.27), el factor de corrección de Mach.** No está impreso en la 6ª edición
   (§A.2) y la Fig. 12.22 no lo contiene porque está trazada a Mach bajo. El `(1 + 0.144 M²)^0.65`
   que anoté viene de ediciones previas del libro y **no lo pude verificar contra ninguna
   evidencia de esta edición**. Lo que SÍ está verificado es `0.455/(log10 R)^2.58` (±1 %).

2. **Fig. 12.7 a–f (seis cartas de pendiente de fuerza normal supersónica) — NO DIGITALIZADAS.**
   Fue mi decisión de prioridad, y explico por qué para que alguien pueda retomarlo:
   - Están en libro pp. 401–403 = **PDF 431, 432, 433** (paneles a/b/c en la p. 402, d/e/f en la
     403), ya renderizadas en `figuras/ray-c12-p402-0432.png` y `ray-c12-p403-0433.png`.
   - Cada panel es una **carta de doble abscisa**: la mitad izquierda va `beta/tan(Lambda_LE)` de
     0 a 1.0, y la mitad derecha va `tan(Lambda_LE)/beta` de 1.0 de vuelta a 0, con **ejes Y
     distintos en cada mitad** (`tan(Lambda_LE)*(C_N_alpha)_theory` a la izquierda,
     `beta*(C_N_alpha)_theory` a la derecha, ambos 0 a 7 por radián).
   - Cada panel trae **8 curvas de `A*tan(Lambda_LE)`** (0.25, 0.5, 1, 2, 3, 4, 5, 6) **más dos
     fronteras a trazos** rotuladas `Unswept T.E.` y `Sonic T.E.`, y todas se cruzan repetidamente
     cerca del centro. Son 6 paneles × 10 trazos = **60 curvas con cruces densos**: mucho más
     trabajo que todo el resto de este bloque junto, y con alto riesgo de salto de curva.
     ⚠️ El **panel (d) tiene una curva extra rotulada `2.5`** — el juego de curvas NO es idéntico
     en los seis paneles; hay que leer los rótulos panel por panel.
   - Los seis paneles son razón de estrechamiento `lambda` = **0 (a), 1/5 (b), 1/4 (c)** en la
     p. 402, y **1/3 (d), 1/2 (e), 1 (f)** en la p. 403 (esto sí lo verifiqué en los renders).
     El texto (p. 401) dice que si el taper real no está, **hay que interpolar entre cartas**.
   - Cómo se usan (p. 401, literal): se calcula `beta = sqrt(M^2 - 1)`; si
     `beta/tan(Lambda_LE) <= 1.0` se usa la mitad IZQUIERDA y el valor leído se divide entre
     `tan(Lambda_LE)`; si es > 1.0 se invierte el cociente, se usa la mitad DERECHA y el valor
     leído se divide entre `beta`. La curva se elige con `A*tan(Lambda_LE)`. Las cartas dan la
     pendiente de FUERZA NORMAL `C_N_alpha`, que a ángulos bajos se toma igual a `C_L_alpha`.
   - **Si se retoma, prioridad: el panel del taper más cercano al ala del cliente, y dentro de él,
     solo la mitad izquierda** (que es la que se usa cuando `beta/tan(Lambda_LE) < 1`, el caso de
     borde de ataque subsónico, que es el que más pesa en diseño).

3. **Fig. 12.39, ramas ascendentes.** Están trazadas, pero con banda ampliada (**±0.010 en S**
   contra ±0.006 de las ramas descendentes) porque atraviesan zonas donde dos curvas se funden en
   un solo trazo. El 8.5 % de tinta sin cubrir está en las mesetas horizontales de los picos.

4. **Fig. 12.30, C_L < 0.12.** Las seis curvas están dentro del ancho del trazo (separación medida
   de 0.0 px). **No existen seis valores distintos ahí.** Por eso mi tabla arranca en C_L = 0.15.

5. **Fig. 12.24, las dos curvas de 150 galones arriba de M ≈ 0.88.** Se funden en un trazo. Los
   dos renglones de mi tabla son la misma línea a partir de ahí.

6. **Fig. 12.25, las dos curvas de bomba de 2000 lb debajo de M ≈ 0.82.** Son la misma línea.

7. **Fig. 12.26, los dos pilones (fuselaje y ala) debajo de M ≈ 0.92.** Son la misma línea, y
   además una de ellas está en un azul casi invisible.

8. **Rangos vacíos que el software NO debe extrapolar en silencio:**
   - Fig. 12.29: barrido fuera de **17–65 grados**; t/c fuera de **0.04–0.12**.
   - Fig. 12.30: t/c fuera de **0.04–0.14**.
   - Fig. 12.31: `2Ln/d` arriba de **13.4** (supersónico) o **15.1** (subsónico); el eje llega a 20
     pero no hay curva.
   - Fig. 12.36: `mu` fuera de **0.4–1.0**; gap/span arriba de **0.45**.
   - Fig. 12.39: C_L abajo de **0.035**; y abajo de **0.093** solo existen dos de las siete curvas.
   - Figs. 12.24/12.25/12.26: Mach fuera de **0.40–1.0**, **0.40–1.14** y **0.50–1.01**
     respectivamente.

9. **No hay ejemplo numérico resuelto de build-up de arrastre en el capítulo 12.** Busqué en las
   pp. 439–441 ("Complete Parasite-Drag Buildup"): solo hay la Fig. 12.33 (esquema conceptual) y
   la Fig. 12.34 (curvas de aviones reales), sin tabla de componentes con Cf / FF / Q / S_wet.
   **Eso significa que no existe en este capítulo un caso de regresión listo para el software**,
   a diferencia de las Tablas 5.2–5.5 del F-16 en Bertin. El ejemplo de diseño del libro está en
   el Cap. 24 y es **manuscrito escaneado**, no tabla legible.
