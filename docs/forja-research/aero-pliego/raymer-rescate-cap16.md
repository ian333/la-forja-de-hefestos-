# Raymer, Cap. 16 — Estabilidad, Control y Cualidades de Vuelo
## Rescate de ecuaciones, figuras y tablas desde el PDF

**Fuente:** `docs/forja-research/manuales/aero/raymer-aircraft-design-2018.pdf`
(*Aircraft Design: A Conceptual Approach*, 6ª ed., D. Raymer, AIAA 2018).
**Renders:** `docs/forja-research/aero-pliego/figuras/ray-est-pdf-06XX.png` (300 dpi, lectura)
y `ray-est-hi-06XX.png` (400 dpi, trazado).

---

## ⚠️ OFFSET DE PÁGINA — verificado folio por folio

> El offset que se me pasó primero (`PDF = libro + 30`) **es incorrecto para este capítulo**.
> El offset real es **`PDF = libro + 32`**.
>
> Lo detecté antes de transcribir nada y **verifiqué el folio impreso en la esquina de cada
> página renderizada** antes de leerla. Todas las transcripciones de abajo salen de una página
> cuyo folio impreso coincide con el que se pide:
>
> | Objetivo | Libro | PDF | Folio impreso leído |
> |---|---|---|---|
> | Ec. 16.5 | 591 | 623 | `591` ✅ |
> | Ec. 16.9 ⭐ | 592 | 624 | `592` ✅ |
> | Fig. 16.4 | 593 | 625 | `593` ✅ |
> | Ec. 16.13 / Figs. 16.5a-c | 594 / 595 | 626 / 627 | `594` / `595` ✅ |
> | Ec. 16.14 / Figs. 16.6-16.7 | 596 / 597 | 628 / 629 | `596` / `597` ✅ |
> | Fig. 16.9 | 599 | 631 | `599` ✅ |
> | Ecs. 16.21a/b | 600 | 632 | `600` ✅ |
> | Ecs. 16.23/16.24, Fig. 16.11 | 601 | 633 | `601` ✅ |
> | Fig. 16.12 | 602 | 634 | `602` ✅ |
> | Fig. 16.13 | 603 | 635 | `603` ✅ |
> | Fig. 16.14 | 604 | 636 | `604` ✅ |
> | Ec. 16.31 | 606 | 638 | `606` ✅ |
> | Ecs. 16.37/16.39 | 614 | 646 | `614` ✅ |
> | Ec. 16.41 | 615 | 647 | `615` ✅ |
> | Ecs. 16.42/16.43 | 616 | 648 | `616` ✅ |
> | Fig. 16.21 | 617 | 649 | `617` ✅ |
> | Tabla 16.1 | 623 | 655 | `623` ✅ |
> | Ecs. 16.55/16.56 | 625 | 657 | `625` ✅ |
> | Fig. 16.26 | 626 | 658 | `626` ✅ |
> | Tabla 16.2 | 629 | 661 | `629` ✅ |
> | Ecs. 16.68/16.69, Fig. 16.32 | 635 | 667 | `635` ✅ |
>
> **Nada hay que rehacer.** No se transcribió ninguna página con el offset viejo.

---

## Método

1. Renderizado de páginas del PDF a **300 dpi** (lectura de ecuaciones/tablas) y **400 dpi**
   (trazado de curvas). Zooms puntuales a **600 dpi** para dígitos dudosos.
2. Las ecuaciones y tablas se transcriben **leyendo el render**, no el OCR. El OCR (`raymer.txt`)
   sólo se usó para localizar y para cruzar.
3. Las figuras **no se leyeron a ojo**: se trazaron **pixel por pixel** con script
   (máscara de tinta azul `B−R > 25` para las figuras redibujadas; máscara de gris + filtro de
   longitud de trazo para las figuras escaneadas), calibrando contra las **posiciones reales de
   las marcas de eje / líneas de retícula** detectadas por perfil de densidad, con ajuste por
   mínimos cuadrados. Trazado por **continuidad predictiva** (extrapolación lineal de la pendiente
   local + tolerancia fija) para separar familias de curvas.
4. Donde el trazador no puede separar curvas con certeza, **se dice y no se inventan puntos**.

---

# PARTE A — ECUACIONES (transcripción literal, ASCII)

Convenciones ASCII usadas: `d()/d()` = derivada parcial; `X_bar` = longitud dividida entre la
cuerda media `c` (o entre la envergadura `b` en las laterales); `*` = producto; `^` = potencia.

---

## Ec. 16.5 — Momento de cabeceo en coeficientes (libro p. 591) ⭐

```
Cm_cg = C_L * ( (X_cg - X_acw) / c )  +  Cm_w  +  Cm_wdf * delta_f  +  Cm_fus

        - (q_h*S_h)/(q*S_w) * C_Lh * ( (X_ach - X_cg) / c )
        - (T*z_t)/(q*S_w*c)
        + F_p*(X_cg - X_p)/(q*S_w*c)                                        (16.5)
```

Contexto impreso en la misma página (útil, sí estaba legible pero se transcribe por completitud):

```
M_cg = L*(X_cg - X_acw) + M_w + M_wdf*delta_f + M_fus
       - L_h*(X_ach - X_cg) - T*z_t + F_p*(X_cg - X_p)                      (16.4)

eta_h = q_h / q                                                             (16.6)
    ("va de ~0.85 a 0.95, con 0.90 como valor tipico")

Cm_cg = C_L*(X_cg_bar - X_acw_bar) + Cm_w + Cm_wdf*delta_f + Cm_fus
        - eta_h*(S_h/S_w)*C_Lh*(X_ach_bar - X_cg_bar)
        - (T/(q*S_w))*Z_t_bar + (F_p/(q*S_w))*(X_cg_bar - X_p_bar)          (16.7)
```

> Nota de render: en la Ec. (16.7) el PDF coloca mal el glifo del subíndice y se ve
> `S_h / _w S`. Es **`S_h/S_w`** (idéntico a 16.5 y 16.8). No es ambigüedad física.

---

## Ec. 16.9 — PUNTO NEUTRO `X_np` (libro p. 592) ⭐⭐ la ecuación clave del capítulo

```
                C_La*X_acw_bar - Cm_a_fus + eta_h*(S_h/S_w)*C_La_h*(d(alpha_h)/d(alpha))*X_ach_bar
                 + (F_p_alpha/(q*S_w))*(d(alpha_p)/d(alpha))*X_p_bar
X_np_bar  =  ------------------------------------------------------------------------------------
                C_La + eta_h*(S_h/S_w)*C_La_h*(d(alpha_h)/d(alpha))
                 + (F_p_alpha/(q*S_w))*(d(alpha_p)/d(alpha))
                                                                            (16.9)
```

Es decir: **numerador = suma de (pendiente de sustentación × brazo) de cada contribuyente**,
**denominador = suma de las mismas pendientes**. `X_np` es el centroide en X ponderado por
`dC_L/d(alpha)` de cada elemento. El término del fuselaje `Cm_a_fus` **entra con signo negativo
en el numerador y NO aparece en el denominador** (no genera sustentación, sólo momento).

Ecuaciones vecinas de la misma página (contexto obligatorio para usar 16.9):

```
Cm_alpha = C_La*(X_cg_bar - X_acw_bar) + Cm_a_fus
           - eta_h*(S_h/S_w)*C_La_h*(d(alpha_h)/d(alpha))*(X_ach_bar - X_cg_bar)
           + (F_p_alpha/(q*S_w))*(d(alpha_p)/d(alpha))*(X_cg_bar - X_p_bar)  (16.8)

Cm_alpha = -C_La_total*(X_np_bar - X_cg_bar)
         = -( C_La + eta_h*(S_h/S_w)*C_La_h*(d(alpha_h)/d(alpha)) )*(X_np_bar - X_cg_bar)
        ~= -C_La*(X_np_bar - X_cg_bar)                                       (16.10)

Static Margin (SM) = (X_np_bar - X_cg_bar) = -Cm_alpha / C_La                (16.11)
```

Valores de margen estático que imprime el libro (p. 593), útiles como *targets*:
transporte en c.g. trasero **+5 a +10 %**; Cessna 172 **≈ 19 %**; cazas antiguos **≈ +5 %**;
F-16/F-22/F-35 con RSS **0 a −15 %**. Corrección por potencia: jets restan **1–3 %** de SM;
hélice resta **≈2 %** por cada cuerda media que la hélice esté por delante del c.g.

---

## Ecs. 16.13 / 16.14 — C_L de ala y de cola (libro p. 594 y 596)

```
Ala:
C_L = C_La * ( alpha + i_w - alpha_0L )                                     (16.13)

Cola trasera:
C_Lh = C_La_h * ( alpha + i_h - epsilon - alpha_0L_h )                      (16.14)
```

`alpha_0L` es negativo para perfil con curvatura positiva y/o flap deflectado hacia abajo.
Cadena de flaps de la misma página (16.15–16.17), transcrita porque 16.14 no sirve sin ella:

```
delta_alpha_0L = - delta_C_L / C_La                                         (16.15)

delta_alpha_0L = ( -(1/C_La) * d(C_L)/d(delta_f) ) * delta_f                (16.16)

d(C_L)/d(delta_f) = 0.9 * K_f * ( d(c_l)/d(delta_f) )_perfil
                        * (S_flapped/S_ref) * cos(Lambda_HL)                (16.17)
```

- El factor **0.9** es el ajuste aproximado por pérdidas de punta de flap.
- `( d(c_l)/d(delta_f) )_perfil` sale de la **Fig. 16.6**; `K_f` de la **Fig. 16.7**.
- `delta_f` debe convertirse a **radianes** para usar (16.16). Deflexión típica de control ≈ 30°.
- El libro advierte: el producto de los dos primeros términos de (16.16) **debe ser < 1**;
  si no, el método sobrepredice la efectividad.

---

## Ecs. 16.21a / 16.21b — dε/dα a alto subsónico y supersónico (libro p. 600) ⭐

```
Subsonico (alto):
d(epsilon)/d(alpha) = ( d(epsilon)/d(alpha) |_{M=0} ) * ( C_La / C_La|_{M=0} )   (16.21a)

Supersonico:
d(epsilon)/d(alpha) = 1.62 * C_La / ( pi * A )                                   (16.21b)
```

- `( d(epsilon)/d(alpha) )|_{M=0}` se lee de la **Fig. 16.12**.
- Texto de la misma página: *"En transónico (alrededor de Mach 0.9) la derivada de downwash
  **aumenta un 30–40 %** y después baja a velocidades mayores."* — Ese 30–40 % es un dato
  suelto de texto, **no** está incluido en 16.21a; hay que aplicarlo aparte.
- El barrido lateral reduce el downwash promedio en la cola **≈5 %** (p. 600).
- El incremento de downwash por flaps sale de la **Fig. 16.13**.

---

## Ecs. 16.23 / 16.24 — derivada del ángulo de cola y alpha_h (libro p. 601)

```
Upwash:
d(alpha_u)/d(alpha) = 1 + d(epsilon_u)/d(alpha)                             (16.22)

Downwash:
d(alpha_h)/d(alpha) = 1 - d(epsilon)/d(alpha)                               (16.23)

alpha_h = (alpha + i_w) * ( 1 - d(epsilon)/d(alpha) ) + (i_h - i_w) + delta_alpha_0L
                                                                            (16.24)
```

> Aviso del propio libro: la Ec. (16.23) es el término que **muchos textos llaman `beta`**, y se
> confunde fácilmente con el ángulo de derrape. En el software conviene nombrarla
> `dalpha_h_dalpha`, nunca `beta`.

---

## Ec. 16.31 — eta_h con propwash (libro p. 606)

```
eta_h = eta_h|_{T=0} * ( 1 + T/(q*A_p) )                                    (16.31)
```

- `eta_h|_{T=0} ≈ 0.9`. `A_p` = área del disco de la hélice, `T` = empuje.
- Si la cola está **sólo parcialmente** en el propwash, *"el término de la derecha dentro del
  paréntesis debe reducirse proporcionalmente"* (es decir, escalar `T/(q*A_p)`, no todo `eta_h`).
- El mismo término sirve para estimar el aumento de presión dinámica **en el ala**, lo que afecta
  al momento por deflexión de flap.

Ecuación vecina (16.30), transcrita porque 16.31 pertenece al mismo bloque de potencia:

```
d(epsilon_p)/d(alpha) = K1 + K2*N_B*( d(C_N_blade)/d(alpha) )*( d(alpha_p)/d(alpha) )   (16.30)
```
(`K1`, `K2` de la Fig. 16.17; `N_B` = número de palas.)

Y el bloque de fuerza normal de admisión/hélice (p. 604):

```
F_p = m_dot*V*tan(alpha_p) ~= m_dot*V*alpha_p                               (16.26)
m_dot ~= rho*V*A_inlet                                                      (16.27)
F_p_alpha = m_dot*V                                                         (16.28)
```
> En unidades británicas `m_dot` va en **slugs/s** = lb/s ÷ 32.2.

Y el término de fuselaje (p. 603), que alimenta `Cm_a_fus` de las Ecs. 16.8/16.9:

```
Cm_alpha_fuselage = K_fus * W_f^2 * L_f / ( c * S_w )      [por grado]      (16.25)
```
- `W_f` = **anchura máxima** del fuselaje o góndola, `L_f` = su longitud. `K_fus` de la **Fig. 16.14**.
- ⚠️ **La Ec. (16.25) da resultado POR GRADO**, no por radián. Las Ecs. 16.8/16.9 están en
  radianes. **Hay que multiplicar por 57.3 antes de meterlo en 16.9.** El libro no lo dice;
  es una trampa de unidades para el software.

---

## Ec. 16.37 — Fuerza lateral del estabilizador vertical (libro p. 614) ⭐

```
F_v = q_v * S_v * C_F_beta_v * ( d(beta_v)/d(beta) ) * beta                 (16.37)
```

- `C_F_beta_v` es **el equivalente lateral de `C_L_alpha`** y se calcula igual (lo dice el libro).
- `d(beta_v)/d(beta)` es el factor de *sidewash*: el derrape local en la cola es MENOR que el
  de corriente libre, sobre todo por el fuselaje; el propwash también lo reduce.

Ecuaciones de fuerza/momento de las que 16.37 forma parte (misma página):

```
N = N_wing + N_w_da*delta_a + N_fus + F_v*(X_acv - X_cg)
    - T*Y_p - D*Y_p - F_p*(X_cg - X_p)                                      (16.35)

L = L_wing + L_w_da*delta_a - F_v*Z_v                                       (16.36)
```
(Escritas para **bimotor con un motor fuera**.)

---

## Ecs. 16.39 / 16.41 — derivadas del vertical (libro p. 614 y 615) ⭐

```
Guinada (yaw):
Cn = N/(q*S_w*b) = Cn_beta_w*beta + Cn_da*delta_a + Cn_beta_fus*beta + Cn_beta_v*beta
     - T*Y_p_bar/(q*S_w) - D*Y_p_bar/(q*S_w) - (F_p/(q*S_w))*(X_cg_bar - X_p_bar)
                                                                            (16.38)
donde

Cn_beta_v = C_F_beta_v * ( d(beta_v)/d(beta) ) * eta_v * (S_v/S_w) * (X_acv_bar - X_cg_bar)
                                                                            (16.39)

Alabeo (roll):
Cl = L/(q*S_w*b) = Cl_beta_w*beta + Cl_da*delta_a + Cl_beta_v*beta          (16.40)
donde

Cl_beta_v = - C_F_beta_v * ( d(beta_v)/d(beta) ) * eta_v * (S_v/S_w) * Z_v_bar
                                                                            (16.41)
```

- La **barra** en las laterales significa dividido entre la **envergadura `b`** (no entre `c`).
  El libro lo dice explícitamente en p. 614: *"(Y_bar) denota (Y/b)"*.
- ⚠️ **Ojo con el brazo de 16.39**: se escribe `(X_acv_bar − X_cg_bar)`, adimensionalizado con
  **b**, mientras que en longitudinal (16.9) el mismo tipo de brazo va con **c**. Mezclarlos es
  el error clásico.
- `Cl_beta_v` lleva **signo menos** explícito y usa `Z_v_bar` (altura del c.a. del vertical sobre
  el eje X), no el brazo longitudinal.

---

## Ecs. 16.42 / 16.43 — estabilidad lateral-direccional estática (libro p. 616) ⭐

```
Cn_beta = Cn_beta_w + Cn_beta_fus + Cn_beta_v
          - (F_p_beta/(q*S_w)) * ( d(beta_p)/d(beta) ) * (X_cg_bar - X_p_bar)   (16.42)

Cl_beta = Cl_beta_w + Cl_beta_v                                                 (16.43)
```

Regla de diseño impresa junto a ellas (p. 616):
> *"`Cl_beta` debe ser de **signo negativo**, con magnitud **≈ la mitad** del valor de `Cn_beta`
> a velocidades subsónicas, y **≈ igual** a él en transónico."*

Y la derivada de guiñada del ala (p. 617, Ec. 16.44), completa:

```
Cn_beta_w = C_L^2 * {  1/(4*pi*A)
                       - [ tan(Lambda) / ( pi*A*(A + 4*cos(Lambda)) ) ]
                         * [ cos(Lambda) - A/2 - A^2/(8*cos(Lambda))
                             + 6*(X_acw_bar - X_cg_bar)*sin(Lambda)/A ]  }      (16.44)
```

Definición de "diedro efectivo" impresa en p. 617 (necesaria para leer la Fig. 16.21):
> `Cl_beta` de un ala recta ≈ **0.0002 × (ángulo de diedro en grados)**, o sea
> **1 grado de diedro efectivo ≡ `Cl_beta` = 0.0002 /grado = 0.0115 /radián**.

---

## Ecs. 16.55 / 16.56 — Amortiguamientos C_mQ y C_nR (libro p. 625) ⭐

```
C_mQ = -2.2 * eta_h * (S_h/S_w) * C_La_h * ( (X_ach - X_cg)/c )^2           (16.55)

C_nR = -2.0 * eta_v * (S_v/S_w) * C_F_beta_v * ( (X_acv - X_cg)/c )^2  -  C_D_wing/4
                                                                            (16.56)
```

- Coeficientes numéricos **−2.2** y **−2.0** (verificados a 600 dpi).
- Los brazos van **al cuadrado** y **divididos entre `c`** en AMBAS. ⚠️ Nótese que 16.56 es
  lateral pero Raymer la adimensionaliza con **`c`**, no con `b` — lo escribe así, es
  intencional (todo el bloque de amortiguamiento usa `c`). Se transcribe literal.
- Raymer llama a la derivada `C_mQ` (subíndice `Q`, mayúscula), no `C_mq`.

Derivadas cruzadas impresas como texto en la misma página (no llevan número de ecuación):
> `Cl_R ≈ C_L/4` (momento de alabeo por velocidad de guiñada)
> `Cn_P ≈ −C_L/8` (momento de guiñada por velocidad de alabeo)

Bloque 1-GDL asociado (p. 626, Ecs. 16.57–16.59):

```
Cabeceo:  I_yy * Qdot = q*S_w*c*Cm_alpha*alpha + q*S_w*c*C_mQ*Q            (16.57)
Guinada:  I_zz * Rdot = q*S_w*b*Cn_beta*beta  + q*S_w*b*C_nR*R             (16.58)
Alabeo:   I_xx * Pdot = q*S_w*b*Cl           + q*S_w*b*Cl_P*P              (16.59)
```

Y las condiciones de vuelo (p. 628):

```
Pull-up:      Q = g*(n-1)/V                                                 (16.60)
Viraje nivelado:  n = 1/cos(phi)                                            (16.61)
                  Q = (g/V)*( n - 1/n )                                     (16.62)
Alabeo estacionario:
    I_xx*Pdot = 0 = q*S_w*b*Cl_da*delta_a + q*S_w*b*Cl_P*P                  (16.63)
    P = - ( Cl_da / Cl_P ) * delta_a                                        (16.64)
```
> ⚠️ **Errata tipográfica en 16.64:** el PDF imprime el subíndice de la deflexión como
> `delta_alpha` (`δ_α`) en el lado derecho, cuando por (16.63) y por el texto debe ser
> **`delta_a` (deflexión de alerón)**. Es un error de composición, no ambigüedad física.

Criterio NACA 715 impreso en p. 628: ángulo de hélice de ala `P*b/(2*V) ≥ **0.07**`
(**0.09** para cazas).

Y los momentos de inercia (p. 623, Ecs. 16.52–16.54), que alimentan 16.57–16.59:

```
I_xx = b^2 * M * Rx_bar^2 / 4      = b^2 * W * Rx_bar^2 / (4*g)             (16.52)
I_yy = L^2 * M * Ry_bar^2 / 4      = L^2 * W * Ry_bar^2 / (4*g)             (16.53)
I_zz = ((b+L)/2)^2 * M * Rz_bar^2 / 4 = ((b+L)/2)^2 * W * Rz_bar^2 / (4*g)  (16.54)
```
(`L` aquí = **longitud del avión**, no sustentación.)

---

## Ecs. 16.68 / 16.69 — Barrena: TDR y URVC (libro p. 635) ⭐

```
TDPF = (TDR) * (URVC)                                                       (16.67)

              S_F * L^2
TDR  =  -------------------                                                 (16.68)
           S_w * (b/2)^2

              S_R1*L1 + S_R2*L2
URVC =  ---------------------------                                         (16.69)
              S_w * (b/2)

           W/S
mu   =  ----------                                                          (16.70)
          rho*g*b
```

- **TDR** = *tail damping ratio*; **URVC** = *unshielded rudder volume coefficient*;
  **TDPF** = *tail-damping power factor*; **mu** = parámetro de densidad relativa del avión.
- `S_F` = área del fuselaje trasero + vertical **por debajo de la horizontal** (Fig. 16.31).
- `S_R1`, `S_R2` = las dos porciones del timón **no** apantalladas por la estela de la
  horizontal; `L1`, `L2` sus brazos respectivos (Fig. 16.31).
- ⚠️ **Nótese la asimetría de normalización:** TDR va con `(b/2)^2` y URVC con `(b/2)^1`.
  Es correcto (uno es "área×brazo²/área×semienvergadura²", el otro es un coeficiente de volumen).
- ⚠️ El OCR del texto escribe **"VRVC"** en la p. 635; el render dice claramente **URVC**
  (*unshielded*). Es error de OCR, no del libro.
- El método es **empírico y sólo para alas rectas** (lo dice el libro), ref. [124].

---

# PARTE B — FIGURAS DIGITALIZADAS

Nota general: **la incertidumbre que declaro es la banda dentro de la cual está el centro del
trazo**, no la de los datos originales de NACA/DATCOM que la figura reproduce.

---

## Fig. 16.9 — Centro de presión del incremento de flap (libro p. 599) ✅ FORMA CERRADA

**Transcripción:** *"Fig. 16.9 Center of pressure for lift increment due to flaps (after [69])."*
- Eje Y: `x_cp / c'`, marcas **0.25, 0.30, 0.35, 0.40, 0.45, 0.50** (lineal).
- Eje X: `Flap-chord ratio (c_f/c)`, marcas **0, 0.2, 0.4, 0.6, 0.8, 1.0** (lineal).
- Dos rectas rotuladas `Slotted flaps` (horizontal) y `Plain flaps` (descendente).

**Resultado — las dos "curvas" son RECTAS EXACTAS:**

```
Flap ranurado (slotted):  x_cp/c'  =  0.44          (constante)
Flap simple  (plain):     x_cp/c'  =  0.50 - 0.25*(c_f/c)
```

| c_f/c | Slotted (leído) | Plain (leído) | Plain (fórmula) | dif |
|---|---|---|---|---|
| 0.02 | 0.4398 | 0.4946 | 0.4950 | −0.0004 |
| 0.10 | 0.4398 | 0.4748 | 0.4750 | −0.0002 |
| 0.20 | 0.4398 | 0.4497 | 0.4500 | −0.0003 |
| 0.30 | 0.4396 | 0.4239 | 0.4250 | −0.0011 |
| 0.50 | 0.4396 | 0.3742 | 0.3750 | −0.0008 |
| 0.70 | 0.4398 | 0.3243 | 0.3250 | −0.0007 |
| 0.90 | 0.4398 | 0.2740 | 0.2750 | −0.0010 |
| 0.99 | 0.4396 | 0.2512 | 0.2525 | −0.0013 |

- **Rango real:** X de **0 a 1.0** (completo, ambas rectas cruzan todo el cuadro); Y de 0.25 a 0.50.
- **Incertidumbre:** ±0.002 en `x_cp/c'` (semiancho de trazo ≈5 px a 400 dpi). El valor slotted
  se leyó **0.4397 ± 0.0002 en 1230 columnas**; redondeo honesto: **0.44**.
- **Verificación cruzada:** las dos rectas ajustan a la forma cerrada con residuo máximo 0.0013
  (0.3 %). **Autovalidado.** Recomiendo que el software use la fórmula, no la tabla.
- `c'` es la **MAC con flap extendido** (lo dice el texto de p. 599), no la MAC limpia.
  Se usa con `Cm_wdf = −(dC_L/d(delta_f))*(X_cp_bar − X_cg_bar)` (Ec. 16.20).

---

## Fig. 16.14 — Factor de momento del fuselaje `K_fus` (libro p. 604) ✅

**Transcripción:** *"Fig. 16.14 Fuselage moment term."* Anotación dentro del cuadro: `NACA TR 711`.
- Eje Y: `K_fus`, marcas **0, 0.01, 0.02, 0.03, 0.04, 0.05** (lineal).
- Eje X: `Position of root quarter-chord as percent of fuselage length`, marcas **10 … 60**.
- **Una sola curva.**

| X_c/4 (% de L_f) | K_fus |
|---|---|
| 10 | 0.00488 |
| 15 | 0.00525 |
| 20 | 0.00624 |
| 25 | 0.00779 |
| 30 | 0.01003 |
| 35 | 0.01299 |
| 40 | 0.01720 |
| 45 | 0.02280 |
| 50 | 0.02941 |
| 55 | 0.03672 |
| 60 | 0.04507 |
| 63 | 0.05077 |

- **Rango real:** la curva existe **de 9.9 % a 63.9 %** (`K_fus` de 0.0049 a 0.0521). El eje
  impreso llega a 60 pero **la curva se sale por arriba en 63.9 %**. Fuera de 10–64 % **no hay dato**.
- **Incertidumbre:** calibración por 3 anclas de marca (y=0 en el eje X, 0.01 y 0.04),
  residuo máximo **2 px = ±0.0001 en K_fus**; eje X calibrado con 4 marcas
  (188.6 px por 10 %), error < 0.3 %. **Banda recomendada: ±0.0003 en K_fus, ±0.5 % en X.**
- **Verificación cruzada:** el libro **no imprime ningún valor leído de esta figura**. No hay
  cross-check directo. Lo único que valida es la calibración (residuo 2 px sobre 950 px de rango).
- ⚠️ Recordatorio de unidades: la Ec. 16.25 con este `K_fus` da **por grado**.

---

## Fig. 16.13 — Incremento de downwash por flaps (libro p. 603) ✅

**Transcripción:** *"Fig. 16.13 Downwash increment due to flaps."*
- Eje Y: `(Δε)·A·[b_f/(b/2)] / ΔC_L`, marcas **5, 10, 15, 20, 25, 30**.
- Eje X: `h_h/(b/2)`, marcas **−0.2, −0.1, 0, 0.1, 0.2, 0.3, 0.4, 0.5**.
- Nota dentro del cuadro: *"h_h is horizontal tail height above wing"*. Curvas `Slotted` y `Plain`.

| h_h/(b/2) | Slotted | Plain |
|---|---|---|
| −0.15 | — | 27.30 |
| −0.10 | — | 24.81 |
| −0.05 | — | 22.46 |
| 0.00 | 29.1 | 20.27 |
| 0.05 | 24.33 | 18.19 |
| 0.10 | 21.09 | 16.30 |
| 0.15 | 18.57 | 14.55 |
| 0.20 | 16.62 | 13.01 |
| 0.25 | 15.04 | 11.65 |
| 0.30 | 13.72 | 10.49 |
| 0.35 | 12.66 | 9.61 |
| 0.40 | 11.77 | 9.04 |
| 0.44 | — | 8.84 (fin) |
| 0.45 | 11.01 | — |
| 0.458 | 10.95 (fin) | — |

- **Rango real:** `Slotted` existe de **−0.028 a +0.458** (sale por arriba del cuadro en −0.028);
  `Plain` existe de **−0.185 a +0.442**. El eje impreso llega a 0.5 pero **ninguna curva llega ahí**.
- **Incertidumbre:** calibración X con 8 marcas (156.0 px por 0.1, residuo < 1 px);
  Y con 6 marcas (198.4 px por 5 unidades, residuo < 2 px). **Banda: ±0.15 unidades en Y,
  ±0.003 en X.** En `Slotted` cerca de h=0 la pendiente es enorme (≈ −100 unidades por unidad de h):
  ahí el error efectivo sube a ±0.5 unidad.
- **Verificación cruzada:** el libro no imprime ningún valor leído de esta figura. Sin cross-check.

---

## Fig. 16.4 — Valores típicos de `Cm_alpha` (libro p. 593) ✅

**Transcripción:** *"Fig. 16.4 Typical pitching-moment derivative values."*
- Eje Y: `Cm_alpha` **per radian**, marcas 0 a −1.6 cada 0.2.
- Eje X: `Mach number`, marcas 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0.
- Tres curvas rotuladas `Transport`, `Business and general aviation`, `Fighter-stable`.

### Curvas

| Mach | Transport | Business & GA | Fighter-stable |
|---|---|---|---|
| 0.0 | −1.005 | −0.647 | −0.129 |
| 0.1 | −1.011 | −0.655 | −0.134 |
| 0.2 | −1.025 | −0.675 | −0.140 |
| 0.3 | −1.040 | −0.694 | −0.145 |
| 0.4 | −1.060 | −0.717 | −0.154 |
| 0.5 | −1.086 | −0.743 | −0.160 |
| 0.6 | −1.112 | −0.770 | −0.170 |
| 0.7 | −1.139 | −0.799 | −0.188 |
| 0.8 | −1.171 | −0.829 | −0.204 |
| 0.9 | −1.202 | −0.863 | −0.219 |
| 1.0 | *fin ≈0.975* | *fin ≈0.973* | −0.223 |
| 1.2 | — | — | −0.215 |
| 1.4 | — | — | −0.194 |
| 1.6 | — | — | −0.170 |
| 1.8 | — | — | −0.140 |
| 2.0 | — | — | −0.119 |
| 2.2 | — | — | −0.104 |
| 2.4 | — | — | −0.095 |
| 2.6 | — | — | −0.082 |
| 2.8 | — | — | −0.079 |
| 2.9 | — | — | −0.074 (fin) |

### Aviones marcados (puntos, extraídos como blobs)

| Avión | Mach | Cm_alpha (/rad) |
|---|---|---|
| B-747 | 0.84 | −1.602 |
| B-727 | 0.84 | −1.489 |
| C-5 | 0.72 | −1.208 |
| B-707 | 0.82 | −1.131 |
| C-182 | 0.21 | −0.902 |
| Learjet | 0.62 | −0.714 |
| F-4 (subsónico) | 0.89 | −0.083 |
| F-4 (supersónico) | 1.90 | −0.055 |

- **Rango real:** `Transport` y `Business & GA` sólo están dibujadas de **M≈0 a M≈0.97**.
  `Fighter-stable` va de **0 a 2.98**. Nada existe fuera.
- **Incertidumbre:** calibración X con 7 marcas (427.6 px/Mach), Y con 7 marcas (533.5 px/unidad),
  residuos < 2 px. **Banda: ±0.005 en Cm_alpha, ±0.005 en Mach.** Los puntos de avión son
  círculos de 27 px; su centroide tiene ±0.003.
- **Verificación cruzada:** los puntos B-747 (−1.60) y B-727 (−1.49) caen **por encima** de la
  curva `Transport` (que en M=0.84 vale ≈−1.19). Es coherente con lo que dice el texto: las
  curvas son *"targets"* de diseño conceptual, no ajustes de los puntos.

---

## Fig. 16.11 — Estimación de upwash (sólo subsónico) (libro p. 601) ✅

**Transcripción:** *"Fig. 16.11 Upwash estimation (subsonic only). [69]"*
- Eje Y: `d(epsilon_u)/d(alpha)`, marcas 0, 0.4, 0.8, 1.2, 1.6, 2.0.
- Eje X: `Distance forward of root quarter-chord in root chords`, marcas
  **2.0, 1.6, 1.2, 0.8, 0.4, 0, −0.4, −0.8** (crece hacia la IZQUIERDA).
- Cuatro curvas rotuladas por `A` = **12, 9, 6, 4** (flechas: **12 = la curva más alta**).
- Línea vertical a trazos en **x = 0.25–0.26 root chords** = el **borde de ataque de la raíz**
  (las curvas terminan ahí).

| x (root chords adelante de c/4) | A=12 | A=9 | A=6 | A=4 |
|---|---|---|---|---|
| 2.00 | 0.147 | 0.123 | 0.088 | 0.048 |
| 1.80 | 0.156 | 0.126 | 0.089 | 0.052 |
| 1.60 | 0.172 | 0.138 | 0.102 | 0.065 |
| 1.40 | 0.201 | 0.157 | 0.122 | 0.082 |
| 1.20 | 0.242 | 0.196 | 0.156 | 0.103 |
| 1.00 | 0.303 | 0.262 | 0.201 | 0.138 |
| 0.90 | 0.349 | 0.308 | 0.237 | 0.163 |
| 0.80 | 0.397 | 0.353 | 0.281 | 0.204 |
| 0.70 | 0.471 | 0.417 | 0.339 | 0.257 |
| 0.60 | 0.570 | 0.497 | 0.422 | 0.322 |
| 0.50 | 0.708 | 0.624 | 0.530 | 0.418 |
| 0.45 | 0.802 | 0.711 | 0.606 | 0.487 |
| 0.40 | 0.921 | 0.811 | 0.703 | 0.575 |
| 0.35 | 1.056 | 0.947 | 0.825 | 0.697 |
| 0.30 | 1.217 | 1.109 | 0.990 | 0.875 |
| 0.28 | 1.310 | 1.185 | 1.076 | 0.983 |

- **Rango real:** X de **2.02 a 0.28** legible (blue x va hasta −0.735, pero eso es la curva casi
  nula **detrás** del borde de ataque, ver abajo). Y de 0.048 a 1.31.
- 🔴 **NO LEGIBLE: x < 0.28.** Entre 0.28 y la línea a trazos (0.25–0.26) las cuatro curvas se
  disparan y se confunden con la propia línea a trazos y entre sí. Visualmente terminan cerca de
  **1.4**, pero **no puedo separarlas ahí** y no doy valores.
- Detrás del borde de ataque (x de 0 a −0.735) hay una curva casi nula (`≈0.00–0.01`) con un
  circulito marcador en x=0: es la continuación del upwash aguas abajo, prácticamente cero.
- **Incertidumbre:** figura **vectorial**, calibración por 15 líneas de retícula en X
  (106.2 px por 0.2 root chords) y 11 en Y (106.1 px por 0.2). Residuos < 1 px.
  **Banda: ±0.005 en dε_u/dα, ±0.005 en x.**
- **Verificación cruzada — ✅ AUTOVALIDADA:** la línea a trazos cae en **x = 0.258** con mi
  calibración. Debe ser el borde de ataque de la raíz, que está exactamente a **0.25** cuerdas
  raíz por delante del cuarto de cuerda. Error 0.008 cuerdas = **3 %** — confirma la escala X.

---

## Fig. 16.12 — Estimación de downwash (M = 0) (libro p. 602) ✅ ⭐

**Transcripción:** *"Fig. 16.12 Downwash estimation (M = 0) (after [13])."*
Matriz de **3 filas × 3 columnas** de sub-gráficas:
- Filas (izquierda): `lambda = 1`, `lambda = 0.33`, `lambda = 0.20` (relación de estrechamiento).
- Columnas (arriba): `A = 6`, `A = 9`, `A = 12`.
- Eje Y de cada panel: `dε/dα`, marcas **0.1 a 0.7** cada 0.1.
- Eje X de cada panel: `r = L_t/(b/2)`, marcas **0.25, 0.50, 0.75, 1.0** (y **1.25** sólo en A=12).
- 3 curvas por panel: `m = Z_t/(b/2)` = **0, 0.1, 0.2** (de arriba hacia abajo).
- Croquis "Geometry" abajo: `L_t` desde el c/4 del ala hasta el c/4 de la cola, `Z_t` medido desde
  la **línea de sustentación nula** del ala.

### lambda = 1

| r = L_t/(b/2) | A=6, m=0 | m=0.1 | m=0.2 | A=9, m=0 | m=0.1 | m=0.2 | A=12, m=0 | m=0.1 | m=0.2 |
|---|---|---|---|---|---|---|---|---|---|
| 0.500 | 0.495 | 0.446 | 0.403 | — | — | — | — | — | — |
| 0.625 | 0.465 | 0.419 | 0.377 | 0.340 | 0.308 | 0.271 | 0.250 | 0.224 | 0.201 |
| 0.750 | 0.438 | 0.396 | 0.354 | 0.317 | 0.292 | 0.259 | 0.230 | 0.208 | 0.184 |
| 0.875 | 0.415 | 0.378 | 0.336 | 0.298 | 0.277 | 0.247 | 0.217 | 0.196 | 0.174 |
| 1.000 | 0.396 | 0.363 | 0.322 | 0.280 | 0.261 | 0.235 | 0.205 | 0.186 | 0.165 |
| 1.125 | — | — | — | — | — | — | 0.196 | 0.179 | 0.158 |
| 1.250 | — | — | — | — | — | — | 0.190 | 0.174 | 0.155 |

### lambda = 0.33

| r | A=6, m=0 | m=0.1 | m=0.2 | A=9, m=0 | m=0.1 | m=0.2 | A=12, m=0 | m=0.1 | m=0.2 |
|---|---|---|---|---|---|---|---|---|---|
| 0.500 | 0.697 | 0.587 | 0.514 | — | — | — | — | — | — |
| 0.625 | 0.648 | 0.546 | 0.478 | 0.494 | 0.422 | 0.356 | 0.412 | 0.345 | 0.286 |
| 0.750 | 0.606 | 0.513 | 0.447 | 0.466 | 0.397 | 0.333 | 0.394 | 0.331 | 0.269 |
| 0.875 | 0.569 | 0.482 | 0.422 | 0.441 | 0.377 | 0.316 | 0.377 | 0.315 | — |
| 1.000 | 0.541 | 0.456 | 0.399 | 0.418 | 0.356 | 0.299 | 0.359 | 0.300 | 0.245 |
| 1.125 | — | — | — | — | — | — | 0.342 | 0.285 | 0.236 |
| 1.250 | — | — | — | — | — | — | 0.324 | 0.269 | 0.226 |

### lambda = 0.20

| r | A=6, m=0 | m=0.1 | m=0.2 | A=9, m=0 | m=0.1 | m=0.2 | A=12, m=0 | m=0.1 | m=0.2 |
|---|---|---|---|---|---|---|---|---|---|
| 0.500 | 0.736 | 0.648 | 0.556 | — | — | — | — | — | — |
| 0.625 | 0.696 | 0.606 | 0.516 | 0.580 | 0.483 | 0.397 | 0.464 | 0.389 | 0.307 |
| 0.750 | 0.660 | 0.567 | 0.481 | 0.542 | 0.448 | 0.370 | 0.440 | 0.364 | 0.288 |
| 0.875 | 0.629 | 0.530 | 0.449 | 0.507 | 0.420 | 0.349 | 0.420 | 0.341 | 0.271 |
| 1.000 | 0.599 | 0.497 | 0.420 | 0.476 | 0.394 | 0.329 | 0.401 | 0.323 | 0.255 |
| 1.125 | — | — | — | — | — | — | 0.382 | 0.303 | 0.241 |
| 1.250 | — | — | — | — | — | — | 0.363 | 0.283 | 0.229 |

- **Rango real:** las curvas **no empiezan en r = 0.25**. Empiezan alrededor de **r ≈ 0.45–0.60**
  (varía por panel; en A=6 arrancan antes que en A=12). Los huecos de las tablas son reales:
  **ahí no hay curva dibujada**. Para A=6 y A=9 el eje se etiqueta hasta 1.0; para A=12 hasta 1.25.
- **Incertidumbre:** calibración X con 5 marcas por panel (90.75 px por 0.25) y Y con 6 marcas
  (71.2 px por 0.1). **Banda: ±0.006 en dε/dα, ±0.006 en r.** Las 3 curvas de cada panel están
  separadas sin traslape en todo el rango tabulado (ninguna colisión del trazador).
- **Verificación cruzada:** no hay número impreso que leer. **Cross-checks físicos que sí pasan:**
  1. `dε/dα` **baja monótonamente con A** en los 9 paneles (downwash ∝ 1/A). ✅
  2. `dε/dα` **baja monótonamente con m** (cola más alta = menos downwash). ✅
  3. `dε/dα` **baja monótonamente con r** (cola más lejos = menos downwash). ✅
  4. `dε/dα` **sube al bajar lambda** (ala más estrechada concentra sustentación adentro). ✅
  5. Orden de magnitud: el texto de p. 600 dice que el downwash en la cola es
     *"aproximadamente la mitad del ángulo de ataque del ala"*, o sea `dε/dα ≈ 0.5`.
     Mis valores para un transporte típico (A≈9, λ≈0.3, r≈0.8, m≈0.1) dan **0.38** — mismo
     orden, ligeramente menor. ✅ Coherente.

---

## Fig. 16.21 — Efecto diedro por alargamiento, estrechamiento y flecha (libro p. 617) ✅

**Transcripción:** *"Fig. 16.21 Dihedral effect of aspect ratio, taper ratio, and sweep. [16]"*
- Dos paneles: `Taper ratio = 0.5` (izq.) y `Taper ratio = 1.0` (der.).
- Eje X (**arriba**): `Aspect ratio`, marcas 0 a 8.
- Eje Y (izq., hacia abajo): `Cl_beta_wing / C_L (per radian)`, marcas 0 a −0.7 cada 0.1.
- Curvas rotuladas por `Λ_c/4 (deg)`: panel izq. **0, 10, 20, 30, 40, 45**;
  panel der. **0, 10, 20, 30, 40, 45, 50, 55, 60**.
- Uso: el valor de la figura es **por unidad de C_L**; el resultado final es
  `Cl_beta_wing = (valor de la figura) × C_L`.

### Taper ratio = 0.5

| A | Λ=0° | 10° | 20° | 30° | 40° | 45° |
|---|---|---|---|---|---|---|
| 1.5 | −0.311 | −0.357 | −0.393 | −0.437 | — | −0.503 |
| 2.0 | −0.210 | −0.259 | −0.296 | −0.346 | −0.408 | −0.439 |
| 2.5 | −0.150 | −0.195 | −0.234 | −0.286 | −0.349 | −0.390 |
| 3.0 | −0.109 | −0.154 | −0.193 | −0.247 | −0.310 | −0.354 |
| 3.5 | −0.083 | −0.127 | −0.163 | −0.219 | −0.281 | −0.327 |
| 4.0 | −0.068 | −0.106 | −0.145 | −0.198 | −0.259 | −0.305 |
| 5.0 | −0.048 | −0.087 | −0.125 | −0.175 | −0.237 | −0.278 |
| 6.0 | −0.038 | −0.077 | −0.113 | −0.166 | −0.226 | −0.263 |
| 7.0 | −0.033 | −0.068 | −0.107 | −0.161 | −0.219 | −0.258 |

### Taper ratio = 1.0

| A | Λ=0° | 10° | 20° | 30° | 40° | 45° | 50° | 55° | 60° |
|---|---|---|---|---|---|---|---|---|---|
| 1.5 | — | −0.391 | — | −0.482 | −0.594 | — | −0.657 | — | −0.696 |
| 2.0 | −0.268 | −0.314 | −0.358 | −0.405 | −0.476 | −0.509 | −0.561 | −0.613 | −0.690 |
| 2.5 | −0.191 | −0.233 | −0.278 | −0.325 | −0.397 | −0.442 | −0.493 | −0.552 | −0.656 |
| 3.0 | −0.136 | −0.176 | −0.222 | −0.273 | −0.346 | −0.391 | −0.445 | −0.509 | −0.633 |
| 3.5 | −0.099 | −0.137 | −0.183 | −0.236 | −0.309 | −0.354 | −0.411 | −0.478 | −0.617 |
| 4.0 | −0.074 | −0.112 | −0.161 | −0.214 | −0.282 | −0.329 | −0.386 | −0.457 | −0.606 |
| 5.0 | −0.051 | −0.089 | −0.134 | −0.187 | −0.255 | −0.306 | −0.363 | −0.439 | −0.594 |
| 6.0 | −0.036 | −0.075 | −0.120 | −0.176 | −0.244 | −0.296 | −0.349 | −0.430 | −0.587 |
| 7.0 | −0.029 | −0.072 | −0.119 | −0.175 | −0.241 | −0.293 | −0.347 | −0.427 | −0.587 |

- **Rango real:** el eje X está impreso de 0 a 8, pero **las curvas sólo existen de A≈1.4 a A≈7.3**.
  Para A < 1.4 se van por debajo de −0.7 (fuera del cuadro) y para A > 7.3 **no hay trazo**.
  Marcar A>7.3 y A<1.4 como **extrapolación sin respaldo**.
- La fila A=1.5 tiene huecos porque ahí las curvas se juntan; los valores que sí doy son de
  columnas donde el trazador contó exactamente 6 (izq.) o 9 (der.) trazos separados.
- **Incertidumbre:** calibración X con 9 marcas (89.0 px por unidad de A, panel izq.);
  Y con 6 etiquetas (90.0 px por 0.1). **Banda: ±0.004 en Cl_beta/C_L, ±0.06 en A.**
  El panel derecho tiene su cero en A con ±0.1 de incertidumbre (sus marcas no son perfectamente
  regulares en el redibujo).
- **Verificación cruzada — parcial:** para Λ=0° el diedro efectivo debe ser **cero** si el ala no
  tiene diedro geométrico. Mi lectura da −0.029 a −0.27 (no cero) — **correcto**, porque esta
  figura es el efecto de **posición vertical / alargamiento**, no sólo de flecha; el texto (p. 617)
  dice que a esto se le SUMAN el diedro geométrico (16.45) y la posición vertical del ala (16.46),
  vía Ec. 16.47. No hay ningún número impreso que cruzar.
- **Regla del libro:** *"Todos los términos deben ser negativos excepto el de posición vertical
  del ala, que será positivo (desestabilizante)"* — o sea el ala baja.

---

## Fig. 16.26 — Amortiguamiento de alabeo (libro p. 626) ✅

**Transcripción:** *"Fig. 16.26 Roll damping parameter."* Anotación: `NACA 1098`.
Texto de p. 625: *"basado en datos de NACA 1098 (alargamientos bajos) y NACA 868 (altos).
**El factor de flecha se MULTIPLICA por la derivada sin flecha.**"*
- Eje Y (izq.): `Cl_p`, etiquetas −0.1 … −0.6 (marcas menores cada 0.05).
- Eje X: `Aspect ratio`, marcas 2, 4, 6, 8, 10, 12, 14, 16.
- 4 curvas continuas: `Unswept values` para `lambda` = **0, 0.25, 0.50, 1.00**.
- Eje secundario (a la derecha del centro): `Sweep factor`, marcas **0.6, 0.7, 0.8, 0.9, 1.0**,
  con 4 líneas a trazos rotuladas **0°, 30°, 45°, 60°**.

### Valores sin flecha `Cl_p`

| A | λ=1.00 | λ=0.50 | λ=0.25 | λ=0 |
|---|---|---|---|---|
| 2.5 | — | — | −0.198 | — |
| 3.0 | — | — | −0.228 | — |
| 3.5 | −0.307 | — | −0.256 | — |
| 4.0 | −0.340 | −0.305 | −0.277 | −0.253 |
| 4.5 | −0.370 | −0.333 | −0.301 | — |
| 5.0 | −0.398 | −0.356 | −0.320 | −0.273 |
| 5.5 | −0.423 | −0.380 | −0.339 | −0.288 |
| 6.0 | −0.446 | −0.400 | −0.355 | −0.302 |
| 6.5 | −0.467 | −0.420 | −0.369 | −0.314 |
| 7.0 | −0.485 | −0.437 | −0.383 | −0.326 |
| 7.5 | −0.501 | −0.453 | −0.395 | −0.336 |
| 8.0 | −0.516 | −0.469 | −0.406 | −0.346 |
| 8.5 | −0.529 | −0.482 | −0.416 | −0.356 |
| 9.0 | −0.542 | −0.495 | −0.425 | −0.365 |
| 9.5 | −0.554 | −0.505 | −0.435 | −0.374 |
| 10.0 | −0.566 | −0.515 | −0.443 | −0.380 (fin) |
| 10.5 | −0.576 | −0.524 | −0.451 | — |
| 11.0 | −0.587 | −0.533 | −0.457 | — |
| 12.0 | −0.605 | −0.548 | −0.471 | — |
| 13.0 | −0.623 | −0.563 | −0.482 | — |
| 14.0 | −0.639 | −0.575 | −0.492 | — |
| 15.0 | −0.655 | −0.587 | −0.500 | — |
| 16.0 | −0.668 | −0.595 | −0.508 | — |

### Factor de flecha (eje derecho, líneas a trazos)

| A | Λ=0° | Λ=30° | Λ=45° |
|---|---|---|---|
| 4.5 | 1.00 | 0.897 | 0.756 |
| 5.0 | 1.00 | 0.879 | 0.738 |
| 5.5 | 1.00 | 0.871 | 0.716 |
| 6.0 | 1.00 | 0.863 | 0.695 |
| 6.5 | 1.00 | 0.852 | 0.674 |
| 7.0 | 1.00 | 0.841 | 0.653 |
| 7.5 | 1.00 | 0.829 | 0.630 |
| 8.0 | 1.00 | 0.813 | 0.606 |
| 8.5 | 1.00 | 0.792 | ~0.60 (fin) |
| 10.0 | 1.00 | 0.798 | — |

`Λ=60°`: sólo pude leerlo con confianza en **A = 10 → factor 0.513**. En A < 10 la línea a trazos
de 60° cruza y se confunde con las curvas continuas; **no doy más puntos**.

- **Rango real:** eje X de 2 a 16. Las curvas continuas existen de **A≈2.2 a A≈16.2**, salvo
  `λ=0` que **termina en A≈10.2** (ahí está su etiqueta). El eje `Sweep factor` va de 0.6 a 1.0.
- **Incertidumbre:** calibración X con 8 marcas (93.14 px por unidad de A); Y con 6 etiquetas
  (187 px por 0.1 de Cl_p) y confirmada por 7 marcas menores de 0.05 (93.2 px).
  **Banda: ±0.006 en Cl_p, ±0.05 en A, ±0.02 en el factor de flecha.**
  Para A < 3.5 las curvas λ=1.00 y λ=0.50 se funden: **no doy valores separados ahí**.
- **Verificación cruzada — ✅ AUTOVALIDADA:** la línea a trazos rotulada **0°** debe dar factor de
  flecha **exactamente 1.0** (ala sin flecha = sin corrección). Mi lectura, en 8 columnas
  independientes entre A=6.5 y A=10, da **0.995–0.998**. Error 0.3 %. **Eso valida a la vez
  la escala secundaria y su cero.**

---

## Fig. 16.5 a/b/c — Centro aerodinámico del ala (libro p. 595) ⚠️ PARCIAL

**Transcripción:** *"Fig. 16.5 Wing aerodynamic center. [69]"*
Tres cartas apiladas, cada una con **cuatro paneles plegados** dentro de un mismo cuadro:

| Carta | λ | Eje Y `X_a.c./C_r` |
|---|---|---|
| a) | `λ = 0` | 0 a **1.2** |
| b) | `λ = 0.05` | 0 a **1.4** |
| c) | `λ = 0.5` | 0 a **1.6** |

Eje X plegado, de izquierda a derecha (rótulos impresos `0 · 1 · 0 · 1 · 0`):

| Panel | Variable | Recorrido | Régimen |
|---|---|---|---|
| 1 | `tan Λ_LE / β` | 0 → 1 | `Subsonic` |
| 2 | `β / tan Λ_LE` | 1 → 0 | `Subsonic` |
| 3 | `β / tan Λ_LE` | 0 → 1 | `Supersonic` |
| 4 | `tan Λ_LE / β` | 1 → 0 | `Supersonic` |

Curvas rotuladas por **`A · tan Λ_LE` = 1, 2, 3, 4, 5, 6** (etiquetas a la izquierda del panel 1
y a la derecha del panel 4). Además hay dos líneas de referencia rotuladas **`Unswept T.E.`**
(a trazos) y **`Sonic T.E.`**.

`β = sqrt(|1 − M²|)`. Nota del libro: *"malos resultados en transónico"*; el mismo método sirve
para el c.a. de la cola. Complemento de la misma página (Ec. 16.12, sí legible):

```
x_ac = x_c/4 + Delta_x_ac * sqrt(S_wing)                                    (16.12)
  Delta_x_ac = 0.26*(M - 0.4)^2.5          (0.4 < M < 1.1)
  Delta_x_ac = 0.112 - 0.004*M             (M > 1.1)
```

### Lo que SÍ pude digitizar: **panel 1 (subsónico, `tan Λ_LE/β` de 0 a 1)** de las 3 cartas

**a) λ = 0** — `X_a.c./C_r`:

| tanΛ_LE/β | A·tanΛ=6 | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|---|
| 0.0 | 0.678 | 0.582 | 0.501 | 0.419 | 0.331 | 0.248 |
| 0.1 | 0.686 | 0.595 | 0.506 | 0.422 | 0.333 | 0.246 |
| 0.2 | 0.697 | 0.601 | 0.515 | 0.427 | 0.333 | 0.245 |
| 0.3 | 0.706 | 0.614 | 0.520 | 0.431 | 0.333 | 0.243 |
| 0.4 | 0.718 | 0.624 | 0.524 | 0.436 | 0.333 | 0.241 |
| 0.5 | 0.730 | 0.636 | 0.532 | 0.438 | 0.333 | 0.239 |
| 0.6 | 0.738 | 0.644 | 0.535 | 0.441 | 0.333 | 0.236 |
| 0.7 | 0.749 | 0.653 | 0.540 | 0.444 | 0.333 | 0.233 |
| 0.8 | 0.761 | 0.662 | 0.554 | 0.447 | 0.333 | 0.230 |
| 0.9 | 0.767 | 0.669 | 0.555 | 0.449 | 0.333 | 0.227 |
| 1.0 | 0.775 | 0.678 | (0.557) | 0.452 | 0.333 | 0.223 |

**b) λ = 0.05** — `X_a.c./C_r` (la columna `TE` es la línea de referencia *Unswept T.E.*, **no**
una curva de `A·tanΛ`):

| tanΛ_LE/β | 6 | 5 | 4 | 3 | *Unswept T.E.* | 2 | 1 |
|---|---|---|---|---|---|---|---|
| 0.3 | 0.950 | 0.813 | 0.688 | 0.557 | 0.489 | 0.421 | 0.291 |
| 0.4 | 0.956 | 0.820 | 0.694 | 0.561 | 0.478 | 0.422 | 0.286 |
| 0.5 | 0.961 | 0.825 | 0.701 | 0.564 | 0.480 | 0.424 | 0.285 |
| 0.6 | 0.964 | 0.829 | 0.703 | 0.569 | 0.483 | 0.424 | 0.281 |
| 0.7 | 0.971 | 0.835 | 0.706 | 0.572 | 0.483 | 0.426 | 0.278 |
| 0.8 | 0.975 | 0.838 | 0.709 | 0.577 | 0.487 | 0.427 | 0.275 |
| 0.9 | 0.980 | 0.846 | 0.717 | 0.578 | 0.487 | 0.426 | 0.273 |
| 1.0 | 0.984 | 0.851 | 0.719 | 0.582 | — | — | — |
| 0.1 | 0.937 | 0.804 | 0.678 | 0.548 | — | 0.418 | 0.298 |
| 0.0 | — | — | 0.674 | 0.545 | — | 0.417 | 0.299 |

**c) λ = 0.5** — `X_a.c./C_r`:

| tanΛ_LE/β | 6 | 5 | 4 | 3 | 2 | *Unswept T.E.* | 1 |
|---|---|---|---|---|---|---|---|
| 0.3 | 1.202 | 1.043 | 0.886 | 0.702 | 0.525 | 0.407 | 0.347 |
| 0.4 | 1.203 | 1.045 | 0.885 | 0.702 | 0.523 | 0.402 | 0.342 |
| 0.5 | 1.210 | 1.048 | 0.887 | 0.702 | 0.523 | 0.401 | 0.339 |
| 0.6 | 1.213 | 1.050 | 0.887 | 0.705 | 0.523 | 0.399 | 0.335 |
| 0.7 | 1.216 | 1.054 | 0.894 | 0.703 | 0.523 | 0.398 | 0.332 |
| 0.8 | 1.217 | 1.055 | 0.896 | 0.704 | 0.522 | 0.397 | 0.327 |
| 0.9 | 1.224 | 1.058 | 0.895 | 0.705 | 0.521 | 0.394 | 0.323 |
| 1.0 | 1.226 | 1.060 | 0.896 | 0.705 | 0.521 | 0.374 | — |

**Cómo identifiqué qué trazo es qué curva** (esto importa, porque hay 7 trazos y sólo 6 curvas
en las cartas b y c): recorté el borde izquierdo del panel 1 a 5× y **leí los dígitos impresos
1–6** que rotulan cada curva; cada dígito está justo por encima de su curva. El trazo sobrante
resultó ser la línea *Unswept T.E.*, y su posición coincide con la del rótulo `Unswept T.E.`
en cada carta. En la carta (a) el trazador encontró exactamente **6** trazos, coincidentes con
los 6 dígitos.
**Cross-check estructural adicional:** en las tres cartas la curva `2` es prácticamente
horizontal y la curva `1` desciende — el mismo patrón, lo que confirma la asignación.

- **Incertidumbre:** figura **escaneada (mapa de bits)**, no vectorial. Trazos de 4–6 px a 400 dpi.
  Calibración Y por 13/15/17 líneas de retícula (47.1 / 47.0 / 47.0 px por 0.1), residuo < 1 px;
  calibración X por los 4 bordes de panel detectados como columnas de tinta continua
  (234.0 / 234.6 / 234.4 px por panel). **Banda: ±0.010 en `X_a.c./C_r`, ±0.02 en el eje plegado.**
- **Verificación cruzada:** el libro **no imprime ningún valor leído de esta figura**. Sin
  cross-check numérico directo. Lo que sí valida: las 6 curvas quedan ordenadas y monótonas en
  todo el panel 1 de la carta (a) (ninguna colisión del trazador en 234 columnas).

### 🔴 Lo que NO pude leer de la Fig. 16.5 — ver "LO QUE NO PUDE LEER"

---

## Fig. 16.6 — Incremento teórico de sustentación de flap simple (libro p. 597) ⚠️ PARCIAL

**Transcripción:** *"Fig. 16.6 Theoretical lift increment for plain flaps. [69]"*
- Eje Y: `( ∂C_l / ∂δ_f )` **(per rad)**; retícula cada 0.5, etiquetas 2, 3, 4, 5, 6.
- Eje X: `c_f/c`, de 0 a 0.5, retícula cada 0.05, etiquetas 0, 0.1, 0.2, 0.3, 0.4, 0.5.
- 5 curvas rotuladas `t/c` = **0.15, 0.12, 0.08, 0.04, 0.00** (arriba → abajo, a la derecha).
- Croquis del perfil con `c`, `c_f`, `δ` a la derecha, dentro del cuadro.

### 🔴 DEFECTO DE REPRODUCCIÓN DETECTADO EN ESTA EDICIÓN

Contando trazos columna a columna con máscara de núcleo (`B−R>50` y gris<165):

| c_f/c | nº de trazos separados |
|---|---|
| 0.075 – 0.11 | 1 |
| 0.12 – 0.155 | 2–3 |
| 0.17 – 0.295 | **4** |
| **0.30 – 0.475** | **8** ← salto brusco |
| 0.49 – 0.50 | **5** |

En `c_f/c = 0.30` **nacen de golpe cuatro trazos nuevos** con extremo romo, exactamente
intercalados entre los existentes (lo verifiqué con un zoom 7× centrado en la costura: se ven
los arranques abruptos). Sólo 5 trazos llegan al borde derecho, y **ésos sí** coinciden en altura
con las 5 etiquetas `t/c`. Es decir: **la figura impresa tiene 8 trazos donde debería tener 5.**
Es un defecto de la reproducción (fantasmas/doble golpe), no una familia de curvas extra.

**Por eso NO asigno las curvas intermedias `t/c` = 0.04, 0.08, 0.12 en 0.30 ≤ c_f/c ≤ 0.48.**
Lo que sí entrego:

### Valores en el borde derecho (c_f/c = 0.497) — alta confianza (asignados por etiqueta)

| t/c | ∂C_l/∂δ_f (per rad) |
|---|---|
| 0.15 | 5.948 |
| 0.12 | 5.771 |
| 0.08 | 5.552 |
| 0.04 | 5.341 |
| 0.00 | 5.130 |

Ajuste (residuo máx. 0.02): `∂C_l/∂δ_f ≈ 5.130 + 5.45·(t/c)` en `c_f/c = 0.5`.
**La dependencia con t/c es lineal a 0.4 %** — eso justifica interpolar linealmente en `t/c`
entre las dos envolventes de abajo.

### Envolvente (curva superior `t/c = 0.15` y curva inferior `t/c = 0.00`)

| c_f/c | t/c = 0.15 (superior) | t/c = 0.00 (inferior) |
|---|---|---|
| 0.075 | 2.198 | *(fundidas)* |
| 0.100 | 2.549 | *(fundidas)* |
| 0.125 | 2.912 | 2.793 |
| 0.150 | 3.213 | 3.064 |
| 0.175 | 3.494 | 3.263 |
| 0.200 | 3.740 | 3.466 |
| 0.225 | 3.974 | 3.653 |
| 0.250 | 4.205 | 3.832 |
| 0.275 | 4.404 | 3.999 |
| 0.300 | 4.605 | 4.153 |
| 0.325 | 4.794 | 4.304 |
| 0.350 | 4.978 | 4.444 |
| 0.375 | 5.155 | 4.580 |
| 0.400 | 5.326 | 4.707 |
| 0.425 | 5.493 | 4.834 |
| 0.450 | 5.654 | 4.946 |
| 0.497 | 5.948 | 5.130 |

- **Rango real:** las curvas arrancan en `c_f/c ≈ 0.055` (valor ≈1.8, entra por el piso del cuadro)
  y llegan a **0.50**. Debajo de `c_f/c = 0.12` **las 5 curvas están dentro del ancho del trazo**.
- **Incertidumbre:** calibración por retícula (201.1 px por unidad en Y; 1998 px por unidad en X),
  residuos < 1 px. **Banda: ±0.02 en ∂C_l/∂δ_f dentro de la envolvente; ±0.05 en la zona 0.3–0.48
  por el defecto de reproducción.**
- **Recomendación para el software:** usar la envolvente + interpolación lineal en `t/c`.
  Reproduce el punto `t/c=0.04 @ c_f/c=0.5` con error 0.03 (0.6 %).

---

## Fig. 16.7 — Corrección empírica del flap simple `K_f` (libro p. 597) ✅

**Transcripción:** *"Fig. 16.7 Empirical correction for plain flap lift increment. [69]"*
- Eje Y: `K_f`, de 0 a 1.0, retícula cada 0.1.
- Eje X: `Flap deflection, δ_f (deg)`, de 0 a 80, retícula cada 10.
- 7 curvas rotuladas `c_f/c` = **0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 0.50** (arriba → abajo).

| δ_f (deg) | 0.10 | 0.15 | 0.20 | 0.25 | 0.30 | 0.40 | 0.50 |
|---|---|---|---|---|---|---|---|
| 24 | 0.815 | 0.793 | 0.766 | 0.729 | 0.690 | 0.648 | 0.613 |
| 26 | 0.775 | 0.757 | 0.731 | 0.695 | 0.658 | 0.622 | 0.587 |
| 28 | 0.741 | 0.725 | 0.700 | 0.666 | 0.633 | 0.598 | 0.565 |
| 30 | 0.708 | (0.674)* | 0.667 | 0.644 | 0.611 | 0.581 | 0.551 |
| 32 | 0.697 | 0.681 | 0.656 | 0.626 | 0.596 | 0.566 | 0.535 |
| 34 | 0.682 | 0.661 | 0.638 | 0.609 | 0.580 | 0.551 | 0.520 |
| 36 | 0.668 | 0.647 | 0.624 | 0.594 | 0.567 | 0.538 | 0.509 |
| 38 | 0.656 | 0.633 | 0.611 | 0.581 | 0.555 | 0.527 | 0.499 |
| 40 | 0.645 | 0.621 | 0.598 | 0.571 | 0.544 | 0.516 | 0.490 |
| 42 | 0.634 | 0.609 | 0.587 | 0.557 | 0.534 | 0.506 | 0.481 |
| 44 | 0.624 | 0.598 | 0.577 | 0.548 | 0.524 | 0.496 | 0.473 |
| 46 | 0.617 | 0.590 | 0.567 | 0.538 | 0.515 | 0.491 | 0.466 |
| 48 | 0.607 | 0.581 | 0.557 | 0.528 | 0.506 | 0.480 | 0.460 |
| 50 | 0.599 | 0.572 | 0.548 | 0.519 | 0.498 | 0.472 | 0.452 |
| 52 | 0.592 | 0.563 | 0.539 | 0.512 | 0.491 | 0.467 | 0.447 |
| 54 | 0.585 | 0.556 | 0.530 | 0.503 | 0.484 | 0.461 | 0.441 |
| 56 | 0.578 | 0.548 | 0.522 | 0.496 | 0.478 | 0.455 | 0.436 |
| 58 | 0.571 | 0.541 | 0.514 | 0.491 | 0.470 | 0.448 | 0.430 |
| 60 | 0.566 | 0.535 | 0.505 | 0.484 | 0.463 | 0.443 | 0.424 |

\* El valor 0.674 de `c_f/c=0.15 @ δ_f=30` sale de una columna donde dos trazos casi se tocan;
la interpolación entre 28 y 32 daría 0.703. **Usar 0.70, no 0.674.**

### Zona de transición (δ_f ≤ 22): sólo envolvente

| δ_f (deg) | trazo superior | trazo inferior |
|---|---|---|
| 10.1 | 0.992 | *(las 7 fundidas)* |
| 11 | 0.995 | *(fundidas)* |
| 12 | 0.989 | *(fundidas)* |
| 13 | 0.995 | 0.970 |
| 14 | 0.989 | 0.949 |
| 15 | 0.982 | 0.893 |
| 17 | 0.954 | 0.853 |
| 18 | 0.948 | 0.803 |
| 22 | 0.855 | 0.649 |

- 🔴 **RANGO REAL — DATO CRÍTICO:** el cuadro está impreso de **0 a 80 grados**, pero
  **las curvas SÓLO existen de δ_f ≈ 10.1° a δ_f ≈ 60.6°**. Verificado: **no hay un solo pixel de
  tinta de curva** fuera de ese intervalo (columnas 765–1312 de 656–1534). El software debe marcar
  `δ_f < 10` y `δ_f > 60` como **extrapolación sin respaldo**. Como el texto de p. 596 dice que
  la deflexión típica de control es **30°**, esto no estorba en la práctica, pero un flap de
  aterrizaje a 40–60° sí queda en el borde.
- Para `δ_f < 10` la única lectura honesta es `K_f = 1.0` (todas las curvas nacen del techo).
- **Incertidumbre:** calibración X con 8 líneas de retícula (10.83 px/grado) y Y con 10
  (110.85 px por 0.1). **Banda: ±0.005 en K_f para δ_f ≥ 24; ±0.02 en 13 ≤ δ_f < 24; ±1° en δ_f**
  (las etiquetas 0/20/40/60/80 están centradas ~1° a la derecha de las líneas de retícula
  correspondientes — usé la retícula, que es más fiable).
- 🔴 **NO LEGIBLE: 10 ≤ δ_f < 24 curva por curva.** En esa rodilla las 7 curvas se cruzan y
  se funden; sólo doy la envolvente.
- **Verificación cruzada:** ninguna posible (el libro no imprime valores de esta figura).
  Sí pasa un check de consistencia: `K_f` es monótona decreciente con δ_f y con `c_f/c`
  en las 19 filas × 7 columnas, sin una sola inversión.

---

# PARTE C — TABLAS

## Tabla 16.1 (libro p. 623) — CABECERA RECUPERADA ✅

**Título impreso:** `Table 16.1   Nondimensional Radii of Gyration*`
**Cabecera impresa:** `Aircraft Class` | `R̄x` | `R̄y` | `R̄z`
(los tres con **barra superior**; verificado a 600 dpi, ver `figuras/ray-est-tab16.1-zoom-0655.png`)
**Nota al pie impresa:** `*Typical values (see [18] for examples).`
Se usa con las Ecs. **16.52–16.54**.

| Aircraft Class | R̄x | R̄y | R̄z |
|---|---|---|---|
| Single-engine prop | 0.25 | 0.38 | 0.39 |
| Twin-engine prop | 0.34 | 0.29 | 0.44 |
| Business jet twin | 0.30 | 0.30 | 0.43 |
| Twin turboprop transport | 0.22 | 0.34 | 0.38 |
| Jet transport—Fuselage-mounted engines | 0.24 | 0.36 | 0.44 |
| &nbsp;&nbsp;&nbsp;&nbsp;2 wing-mounted engines | 0.25 | 0.38 | 0.46 |
| &nbsp;&nbsp;&nbsp;&nbsp;4 wing-mounted engines | 0.31 | 0.33 | 0.45 |
| **Military jet trainer** | **0.22** | **0.14** | **0.25** |
| Jet fighter | 0.23 | 0.38 | 0.52 |
| Jet heavy bomber | 0.34 | 0.31 | 0.47 |
| Flying wing (B-49 type) | 0.32 | 0.32 | 0.51 |
| Flying boat | 0.25 | 0.32 | 0.41 |

> **Ojo de estructura:** los renglones *"2 wing-mounted engines"* y *"4 wing-mounted engines"*
> están **indentados**: pertenecen al grupo `Jet transport`, no son clases sueltas.
> El renglón padre es `Jet transport—Fuselage-mounted engines`. En el OCR esa jerarquía se pierde.

### ⚠️ EL RENGLÓN DEL ENTRENADOR MILITAR — VEREDICTO

**Es ERRATA / ANOMALÍA DEL LIBRO, no error de OCR.** Lo verifiqué con un recorte a **600 dpi**
(`figuras/ray-est-tab16.1-trainer-0655.png`): los dígitos `0.22  0.14  0.25` son **perfectamente
nítidos y sin ambigüedad** (el `1` de `0.14` y el `2` de `0.25` no admiten otra lectura).

**Pero el dato SÍ es un valor atípico**, y hay que decirlo:

1. `R̄y = 0.14` es **2.1 a 2.7 veces menor** que el de cualquier otra clase (el resto va de
   0.29 a 0.38). `R̄z = 0.25` es **el más bajo de toda la tabla** (el resto: 0.38 a 0.52).
2. Vía las Ecs. 16.53/16.54, eso produce un `I_yy` **≈6–7 veces menor** y un `I_zz`
   **≈3 veces menor** que los de cualquier clase comparable de tamaño similar. Físicamente
   implausible para un avión real.
3. 🧮 **Sin embargo, el renglón es internamente COHERENTE.** Para una distribución de masa
   aproximadamente plana vale el teorema de ejes perpendiculares, que con estas definiciones
   (y `b ≈ L`, típico) exige `R̄z² ≈ R̄x² + R̄y²`. Comprobado sobre toda la tabla:

   | Clase | √(R̄x²+R̄y²) | R̄z impreso | error |
   |---|---|---|---|
   | Single-engine prop | 0.455 | 0.39 | −14 % |
   | Twin-engine prop | 0.447 | 0.44 | −1.6 % |
   | Business jet twin | 0.424 | 0.43 | +1.3 % |
   | Twin turboprop | 0.405 | 0.38 | −6.2 % |
   | Jet transp. fus-mounted | 0.433 | 0.44 | +1.6 % |
   | 2 wing-mounted | 0.455 | 0.46 | +1.1 % |
   | 4 wing-mounted | 0.453 | 0.45 | −0.7 % |
   | **Military jet trainer** | **0.261** | **0.25** | **−4.3 %** |
   | Jet fighter | 0.444 | 0.52 | +17 % |
   | Jet heavy bomber | 0.460 | 0.47 | +2.2 % |
   | Flying wing | 0.453 | 0.51 | +13 % |
   | Flying boat | 0.406 | 0.41 | +1.0 % |

   El entrenador da **−4.3 %**, *mejor* que el promedio de la tabla y muchísimo mejor que el caza
   (+17 %) o el ala volante (+13 %). **Si fuera una errata de un solo dígito** (p. ej. 0.14→0.34)
   la coherencia **empeoraría** (0.34 daría √=0.405 vs 0.25 impreso, error −38 %).

**Conclusión operativa:** el renglón está **impreso así en Raymer** y es **auto-consistente**;
la anomalía está en la fuente [18], no en la composición ni en el OCR. **Recomiendo que el
software lo cargue tal cual pero lo marque con una bandera `OUTLIER`**, y que NUNCA se sustituya
en silencio por un valor "más razonable". Si un test falla con esta clase, la causa es el dato de
origen, no el código.

---

## Tabla 16.2 (libro p. 629) — VERIFICADA ✅

**Título impreso:** `Table 16.2   MIL-F-8785 B Roll Requirements`
**Cabecera impresa:** `Class` | `Aircraft Type` | `Required Roll`

> ✅ **Respuesta a la duda planteada:** las clases **NO se dedujeron del orden del texto** —
> la tabla tiene una **columna `Class` impresa explícitamente**, con los valores
> `I`, `II`, `III`, `IV A`, `IV B`, `IV C`. La deducción previa fue **correcta**.

| Class | Aircraft Type | Required Roll |
|---|---|---|
| I | Light utility, observation, primary trainer | 60 deg in 1.3 s |
| II | Medium bomber, cargo, transport, ASW, recce. | 45 deg in 1.4 s |
| III | Heavy bomber, cargo, transport | 30 deg in 1.5 s |
| IV A | Fighter-attack, interceptor | 90 deg in 1.3 s |
| IV B | Air-to-air dogfighter | **90 deg in 1.0 s** *y* **360 deg in 2.8 s** |
| IV C | Fighter with air-to-ground stores | 90 deg in 1.7 s |

- ⚠️ **La clase IV B tiene DOS requisitos simultáneos**, agrupados con una llave `{` en el libro.
  El OCR los aplana en un solo renglón; en el software deben ser **dos condiciones AND**, no una.
- Texto adyacente (p. 628–629): *"Estos requisitos suponen que el avión está en vuelo nivelado al
  iniciar el alabeo, así que debería contabilizarse la aceleración rotacional. Sin embargo, los
  aviones generalmente alcanzan la velocidad máxima de alabeo rápido; la velocidad
  cuasi-estacionaria puede usarse para estimar inicialmente el tiempo de alabeo."*
  → Es decir: usar `P` de la Ec. **16.64** y `t = phi / P`, con el aviso de que es optimista.

---

# ERRATAS DEL LIBRO DETECTADAS

| # | Dónde | Qué dice | Qué debe decir | Cómo lo detecté |
|---|---|---|---|---|
| 1 | **Fig. 16.16**, eje X (libro p. 606) | marca `1.52` | **`1.5`** | Aritmética del eje: las marcas están equiespaciadas en −0.5, 0, 0.5, 1.0, **1.52**, 2.0, 2.5. Un eje lineal no puede tener 1.52 entre 1.0 y 2.0 con el mismo paso. **Verificado a 600 dpi** (`figuras/ray-est-f1616-ticks-0638.png`): el glifo `2` sobra. |
| 2 | **Ec. 16.64** (libro p. 628) | `P = −(Cl_da/Cl_P)·δ_α` | `... · δ_a` (**deflexión de alerón**) | La Ec. 16.63 de la que se despeja usa `δ_a`; `δ_α` (deflexión "de ángulo de ataque") no existe. Error de composición del subíndice. |
| 3 | **Ec. 16.7** (libro p. 591) | glifo del subíndice desplazado: se ve `S_h/_w S` | `S_h/S_w` | Comparación con 16.5 y 16.8, que sí lo componen bien. |
| 4 | **Tabla 16.1**, renglón *Military jet trainer* | `0.22 / 0.14 / 0.25` | *(impreso así; anomalía de la fuente, no errata tipográfica)* | Ver el análisis de ejes perpendiculares arriba. **No corregir.** |
| 5 | **Fig. 16.6** (libro p. 597) | 8 trazos en `0.30 ≤ c_f/c ≤ 0.48` | 5 curvas | Conteo de trazos columna a columna + zoom 7× en la costura: 4 trazos con extremo romo **nacen** exactamente en `c_f/c = 0.30`. Defecto de reproducción de esta edición. |
| 6 | **Fig. 16.7** (libro p. 597) | eje impreso 0–80° | curvas sólo en **10.1°–60.6°** | Barrido de tinta: cero pixeles de curva fuera de ese intervalo. No es errata sino **rango engañoso**: el marco invita a extrapolar. |
| 7 | **p. 635**, texto | `VRVC` | **`URVC`** (*unshielded rudder volume coefficient*) | Error del **OCR**, no del libro: el render dice claramente `URVC`. Lo anoto para que nadie propague la "V". |

---

# TRAMPAS DE UNIDADES (para el software)

1. **Ec. 16.25 da resultado POR GRADO**, las Ecs. 16.8/16.9/16.10 están **por radián**.
   Factor **57.3** obligatorio al meter `Cm_a_fus` en 16.9.
2. **Ec. 16.16 exige `delta_f` en RADIANES** (el libro lo dice); las Figs. 16.6/16.7 se leen
   en **grados** (Fig. 16.7) y adimensional (Fig. 16.6).
3. **Longitudinal usa `c`, lateral usa `b`** para las barras — salvo en las Ecs. 16.55/16.56,
   donde Raymer usa **`c` también para la lateral `C_nR`**. Transcrito literal; es su convención.
4. **`L` significa dos cosas distintas**: sustentación en 16.4/16.5/16.36, y **longitud del avión**
   en 16.53/16.54/16.68. El propio libro lo advierte una sola vez, en p. 596.
5. **Fig. 16.21 devuelve `Cl_beta/C_L`**, no `Cl_beta`. Hay que multiplicar por `C_L`.
6. **Fig. 16.26 devuelve `Cl_p` sin flecha**; el factor de flecha se **multiplica** (no se suma).

---

# LO QUE NO PUDE LEER

Declarado explícitamente para que nadie lo rellene con inventos.

### Figuras que dejé SIN HACER (completas)

1. **Fig. 16.32 — Criterio de recuperación de barrena (libro p. 635).** ❌ **NO DIGITALIZADA.**
   Alcancé a transcribir su estructura pero no a trazarla. Para quien la retome:
   - Render: `figuras/ray-est-hi-0667.png` (400 dpi).
   - Eje Y: `TDPF (×10⁻⁴)`, marcas **0, 4, 8, 14, 16, 20, 24, 28** (⚠️ **el eje está roto/no
     uniforme entre 8 y 16** — hay marcas etiquetadas 14 y 16 muy juntas; hay que calibrar
     por tramos, no linealmente).
   - Eje X: `Spin recovery criterion  [(I_X − I_Y)/(b²·W/g)]  (×10⁻⁴)`, marcas
     **−240, −200, −160, −120, −80, −40, 0, 40, 80, 120, 160**.
     Rótulos de extremo: `Body heavy` (izq.) y `Wing heavy` (der.).
   - Leyenda: línea continua = `Rudder alone recovery`; línea a trazos = `Rudder and elevator`.
   - Familias rotuladas por `mu`: continuas **`μ ≥ 35`, 30, 25, 20, 15, 12, 10, 5**;
     a trazos **`μ ≥ 15`, 10, 5**. Fuente: `NACA TN1045`.
   - Es de las más difíciles del capítulo: ~11 curvas continuas + 3 a trazos que se cruzan.

2. **Figs. 16.5 a/b/c — paneles 2, 3 y 4 (subsónico cerca de M=1, y TODO el supersónico).**
   ❌ **NO DIGITALIZADOS.** Sólo entregué el **panel 1** (subsónico, `tanΛ_LE/β` de 0 a 1).
   Razones concretas, no pereza:
   - Cerca del punto sónico (frontera panel 2 / panel 3) las 6 curvas **convergen y se cruzan**
     con las líneas `Sonic T.E.` y `Unswept T.E.`; el trazador salta de una a otra.
   - En los paneles supersónicos aparecen **7 y hasta 9 trazos** por columna (6 curvas + 2 líneas
     de referencia + texto `Subsonic`/`Supersonic` dentro del cuadro), y las etiquetas 1–6 del
     borde derecho **no permiten desambiguar hacia adentro** porque las curvas tienen máximos
     locales justo ahí.
   - Al ser figura **escaneada** (no vectorial), no hay diferencia de color entre curva y
     referencia que permita separarlas.
   - Anclas que sí quedan verificadas para quien la retome: bordes de panel de la carta (a) en
     x = 524.5 / 758.5 / 991.5 / 1226.5 / 1459.5 px; carta (b) 532.5 / 768 / 1002.5 / 1238 / 1471;
     carta (c) 507.5 / 742.5 / 977.5 / 1212 / 1445 (todo a 400 dpi, `ray-est-hi-0627.png`).
     Escalas Y: (a) 0 en y=961, 471.25 px/unidad; (b) 0 en y=1891.5, 469.6; (c) 0 en y=2912.5, 470.3.

### Zonas de figuras que sí hice, pero con hueco declarado

3. **Fig. 16.6 — curvas `t/c` = 0.04, 0.08, 0.12 en `0.30 ≤ c_f/c ≤ 0.48`.** Hay 8 trazos donde
   debería haber 5 (defecto de reproducción, ver arriba). **No los asigno.** Sólo doy la envolvente
   y los 5 valores del borde derecho.
4. **Fig. 16.6 — `c_f/c < 0.12`.** Las 5 curvas caben dentro del ancho de un trazo.
5. **Fig. 16.7 — curva por curva en `10° ≤ δ_f < 24°`.** Ahí se cruzan en la rodilla.
   Sólo doy envolvente.
6. **Fig. 16.7 — `δ_f < 10°` y `δ_f > 60.6°`.** No hay curva dibujada (el marco llega a 80°).
7. **Fig. 16.11 — `x < 0.28` cuerdas raíz.** Las 4 curvas se disparan hacia la línea a trazos del
   borde de ataque y no se separan. Visualmente terminan cerca de 1.4, pero **no doy el valor
   por curva**.
8. **Fig. 16.12 — `r < 0.5` (A=6) y `r < 0.625` (A=9 y A=12).** Ahí las curvas simplemente
   **no están dibujadas**; los huecos de la tabla son del original.
9. **Fig. 16.21 — `A > 7.3` y `A < 1.4`.** No hay trazo, aunque el eje llegue a 8.
   Tampoco hay estrechamientos distintos de 0.5 y 1.0 (el libro dice que hay que interpolar
   o extrapolar, y lo advierte).
10. **Fig. 16.26 — `λ=1.00` y `λ=0.50` para `A < 3.5`** (se funden); **`λ=0` para `A > 10.2`**
    (la curva termina ahí); **línea a trazos de `Λ=60°` para `A < 10`** (cruza las continuas).
11. **Fig. 16.5 (a) panel 1 — el valor de la curva `4` en `tanΛ_LE/β = 1.0`** viene de una
    columna con salto del trazador; lo marqué entre paréntesis `(0.557)`.
12. **Fig. 16.5 (b) y (c) panel 1 — `tanΛ_LE/β < 0.3`.** El trazador salta entre la curva y la
    línea `Unswept T.E.`. Los pocos valores que doy ahí (filas 0.0 y 0.1 de la carta b) son los
    que sobrevivieron al filtro; **las celdas vacías son huecos reales, no olvidos**.

### Cross-checks que NO pude hacer

13. **El capítulo 16 no contiene ni un solo ejemplo numérico que lea un valor de sus propias
    figuras.** Busqué en `raymer.txt` todas las apariciones de *"From Fig. 16.x"* / *"from Fig.
    16.x"*: las 5 que existen sólo dicen de dónde sacar el dato, nunca cuál sale. Por eso, para
    las Figs. 16.4, 16.6, 16.7, 16.12, 16.13, 16.14, 16.21 **no hay verificación cruzada contra
    números impresos del libro** — sólo tengo autovalidaciones internas (forma cerrada, coherencia
    monótona, y el ancla de la Fig. 16.9). Lo declaro para que nadie suponga más respaldo del que
    hay.
14. Las únicas verificaciones cruzadas **duras** que sí conseguí son tres, y son las que dan
    confianza a la calibración de todo el lote:
    - **Fig. 16.9:** ambas rectas ajustan a `0.44` y `0.50 − 0.25·(c_f/c)` con residuo ≤ 0.3 %.
    - **Fig. 16.11:** la línea a trazos cae en `x = 0.258`, y debe ser el borde de ataque de la
      raíz = **0.25** cuerdas por delante del c/4. Error 3 %.
    - **Fig. 16.26:** la línea `Λ=0°` da factor de flecha `0.995–0.998` donde debe ser
      exactamente **1.00**. Error 0.3 %.
