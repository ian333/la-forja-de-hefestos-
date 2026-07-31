# Shigley cap. 8 y 9 leídos como ENTREVISTA DE REQUISITOS

Cliente: Budynas/Nisbett, *Shigley's Mechanical Engineering Design* (2024). Diseñó uniones
atornilladas y soldadas a mano toda su vida. El libro es su descripción del proceso.
Nosotros automatizamos SU proceso — no inventamos uno nuevo.

**Fuente y cobertura del texto extraído**
- `sh/p_460_520.txt` → impresas 435–495 (cap. 8 desde media §8-1 hasta el final de los problemas).
- `sh/p_520_580.txt` → impresas 497–536 (cap. 9 completo) + problemas.
- **FALTA**: `sh/p_400_460.txt` termina en la página impresa **401** (cap. 7, ejes). El arranque
  del cap. 8 — portada del capítulo, outline, y la primera parte de **§8-1 Thread Standards and
  Definitions** (impresas 433–434: definiciones de *pitch*, *lead*, diámetro mayor/menor/de paso,
  Figura 8-1) **NO aparece en el texto extraído**. Lo que sí tenemos de §8-1 arranca a media página
  436 (roscas múltiples, regla de la mano derecha, perfil M/MJ, Tablas 8-1/8-2/8-3).
- Todo lo que sigue está citado del texto. Donde no había dato, lo digo.

---

# 1. EL PROCESO A MANO, TEMA POR TEMA

## 1.1 §8-1 — Roscas (lo que sí está extraído)

- Rosca múltiple: `lead = n · p`. Doble = 2p, triple = 3p. Los productos estandarizados
  (tornillos, pernos, tuercas) son **de rosca sencilla**.
- Todas las roscas son derechas salvo nota en contra.
- Perfil M/MJ = ISO 68, 60° simétrico. **MJ tiene filete redondeado en la raíz y diámetro menor
  más grande** → "especially useful where high fatigue strength is required".
- UN vs UNR: UNR **exige radio de raíz** → menor Kt → mejor fatiga.
- **At (tensile-stress area)**: "un barra sin rosca con diámetro igual a la MEDIA del diámetro de
  paso y el diámetro menor tiene la misma resistencia a tensión que la barra roscada". Ese es el
  origen de At.
- Notas al pie de Tabla 8-1 (métrica): `dr = d − 1.226 869 p`, `dp = d − 0.649 519 p`.
- Notas al pie de Tabla 8-2 (Unified): `dr = d − 1.299 038 p`, `dp = d − 0.649 519 p`.
- Problema 8-2 (declarado por el autor como cierto): `At = (π/4)(d − 0.938 194 p)²`.
- Designación: métrica `M12 × 1.75`; Unified `5/8 in-18 UNRF` (diámetro mayor nominal, hilos por
  pulgada, serie).
- Roscas cuadrada y Acme (Fig. 8-3) para POTENCIA. Tabla 8-3 = pasos preferidos Acme en pulgadas.
  El autor avisa: "other pitches can be and often are used, since the need for a standard for such
  threads is not great". Acme modificada a *stub* = dientes más cortos → dr más grande → tornillo
  más fuerte. Cuadrada modificada a 10°–15° incluidos → conserva casi toda la eficiencia y es más
  fácil de cortar con herramienta de punta.

## 1.2 §8-2 — Tornillo de potencia: el procedimiento

**Geometría primero** (rosca cuadrada): profundidad = ancho = `p/2`; `dm = d − p/2`; `dr = d − p`;
`l = n·p`.

**Par para SUBIR la carga** (8-1):
```
TR = (F·dm/2) · [ (l + π f dm) / (π dm − f l) ]
```
**Par para BAJAR** (8-2):
```
TL = (F·dm/2) · [ (π f dm − l) / (π dm + f l) ]
```
**Autobloqueo**: `π f dm > l`, equivalentemente (8-3) **`f > tan λ`**. Si TL sale ≤ 0 el tornillo
se baja solo. Ojo con la trampa del ejemplo 8-1: TL del tornillo salió **−0.466 N·m** (NO
autobloqueante) pero al sumar el collarín (+10.24) el total es positivo → "la fricción del collarín
es la que está deteniendo la carga, no la rosca". Hay que reportar los dos por separado.

**Eficiencia** (8-4): con f = 0 → `T0 = F l / (2π)`; `e = T0/TR = F l /(2π TR)`.
En el ejemplo el autor usa TR **con collarín incluido** (e = 0.311) y lo llama "overall efficiency".

**Acme / rosca con ángulo 2α** (8-5) — solo se dividen los términos de fricción entre cos α:
```
TR = (F·dm/2) · [ (l + π f dm sec α) / (π dm − f l sec α) ]
```
"remember that it is an approximation because the effect of the lead angle has been neglected".

**Collarín de empuje** (8-6): `Tc = F fc dc / 2`. Para collarines grandes → método de embragues
de disco (§16-5).

**Esfuerzos en el CUERPO**:
- (8-7) `τ = 16 T / (π dr³)`
- (8-8) `σ = −F/A = −4F/(π dr²)` (sin pandeo). Columna corta → J.B. Johnson, Ec. (4-48):
  `(F/A)crit = Sy − (Sy·l/(2π k))² · 1/(C E)`.

**Esfuerzos en la ROSCA**:
- Aplastamiento (8-9): `σB = −F/(π dm nt p/2) = −2F/(π dm nt p)`
- Flexión en la raíz (8-10): con `Z = I/c = (π dr nt)(p/2)²/6`, `M = F p/4` →
  `σx = 6F/(π dr nt p)`
- Cortante tangencial que pasa la torsión al cuerpo (8-11): `τxz = T/(As rr) = 4T/(π dr² nt p)`
- (8-12) elemento de esfuerzo 3-D en el radio exterior del cuerpo, junto a la raíz:
```
σx = 6F/(π dr nt p)      τxy = 0
σy = −4F/(π dr²)         |τyz| = 16T/(π dr³)
σz = 0                   |τxz| = 4T/(π dr² nt p)
```
  Se meten a von Mises (Ec. 5-14). Los cortantes van en **valor absoluto** ("their signs will depend
  on the direction of the torque and whether the screw is left-hand or right-hand").
- El cortante transversal en el centro de la raíz **no es crítico** por la relación largo/alto.

**LA CORRECCIÓN QUE NADIE PROGRAMA** (§8-2, final): las roscas engranadas NO comparten carga por
igual (el tornillo en compresión acorta su paso, la tuerca en tensión lo alarga). Datos
experimentales: 1ª rosca 0.38 de la carga, 2ª 0.25, 3ª 0.18, la 7ª está libre.
→ **"substituting 0.38F for F and setting nt to 1 will give the largest level of stresses",
asumiendo al menos 6 roscas engranadas.** En el ejemplo 8-1 lo aplica también al par: `0.38 T`.

Tablas de soporte: **8-4** presión de apoyo segura pb, **8-5** coef. de fricción de par roscado,
**8-6** coef. de fricción de collarín (arranque vs marcha). Ham & Ryan: f es independiente de la
carga axial, casi independiente de la velocidad, baja con lubricantes pesados, varía poco con la
combinación de materiales, y es mejor **acero sobre bronce**. Rango típico deslizante: **0.10–0.15**.

## 1.3 §8-3 — Sujetadores roscados (geometría que alimenta kb)

Longitud roscada, serie en pulgadas (8-13):
```
LT = 2d + 1/4 in   si L ≤ 6 in
LT = 2d + 1/2 in   si L > 6 in
```
Métrica (8-14), en mm:
```
LT = 2d + 6     si L ≤ 125  y  d ≤ 48
LT = 2d + 12    si 125 < L ≤ 200
LT = 2d + 25    si L > 200
```
Concentradores del perno: el filete bajo la cabeza, el *runout* de la rosca, y la raíz de rosca en
el plano de la tuerca.

## 1.4 §8-4 — Rigidez del perno kb

Dos resortes en serie (8-15/8-16):
```
kt = At·E / lt        kd = Ad·E / ld
```
(8-17) **`kb = Ad·At·E / (Ad·lt + At·ld)`**

Casos degenerados que el autor autoriza: sujetador **corto** (Fig. 8-14, todo roscado) → usa
`kb = At E / l`; sujetador **largo** → usa `kb = Ad E / l`.

**Tabla 8-7 es el ALGORITMO literal** (esto es la especificación de la función):
1. Dado d y p (o hilos/pulg).
2. Espesor de rondana `t` de Tabla A-32/A-33; espesor de tuerca `H` de Tabla A-31 (solo caso a).
3. **Agarre l**:
   - Caso (a), perno pasado con tuerca: `l` = todo el material apretado entre cara del perno y cara
     de la tuerca (¡incluidas las rondanas!).
   - Caso (b), tornillo de cabeza roscado en el miembro inferior:
     `l = h + t2/2` si `t2 < d`; `l = h + d/2` si `t2 ≥ d`.
4. **Longitud del sujetador** (redondear hacia arriba con Tabla A-17):
   Caso (a): `L > l + H`. Caso (b): `L > h + 1.5d`.
5. `LT` con (8-13)/(8-14).
6. `ld = L − LT`, `lt = l − ld`, `Ad = π d²/4`, `At` de Tabla 8-1/8-2.
7. `kb` con (8-17).

Nota al pie de la Tabla 8-7 (regla de negocio real): "Bolts and cap screws may not be available in
all the preferred lengths listed in Table A-17… **Check with your bolt supplier for availability**."

## 1.5 §8-5 — Rigidez de los miembros km (el cono de presión)

Miembros = resortes de compresión **en serie** (8-18): `1/km = 1/k1 + 1/k2 + … + 1/ki`.

De dónde sale: Ito midió con ultrasonido la distribución de presión en la interfaz → la presión se
mantiene alta hasta ~**1.5 radios de perno** y luego cae. Ito propone el cono de Rotscher con ángulo
variable; "This method is quite complicated, and so here we choose to use a simpler approach using
a **fixed cone angle**".

Ángulo del semi-ápice α: 45° se usó históricamente pero **Little reporta que sobreestima la rigidez**.
Osgood reporta **25° ≤ α ≤ 33°** para la mayoría de combinaciones cuando la carga está restringida al
anillo de la cara de la rondana (acero endurecido, fundición o aluminio).
**"In this book we shall use α = 30° except in cases in which the material is insufficient to allow
the frusta to exist."**

Rigidez de UN frusto (8-19) — **ecuación exacta**:
```
                  π E d tan α
k = ---------------------------------------------
    ln{ [(2t tanα + D − d)(D + d)] / [(2t tanα + D + d)(D − d)] }
```
Con α = 30° (8-20):
```
                  0.5774 π E d
k = ---------------------------------------------
    ln{ [(1.155t + D − d)(D + d)] / [(1.155t + D + d)(D − d)] }
```
donde `t` = espesor del frusto, `D` = diámetro **exterior** en la cara chica del frusto, `d` =
diámetro del perno (barreno).

**"Equation (8-20), or (8-19), must be solved separately for each frustum in the joint."**

Caso simétrico, TODO del mismo E, frustos espalda con espalda, `l = 2t`, `dw` = diám. cara de
rondana (8-21):
```
                    π E d tan α
km = ------------------------------------------------
     2 ln{ [(l tanα + dw − d)(dw + d)] / [(l tanα + dw + d)(dw − d)] }
```
Con `dw = 1.5d` (≈50 % más que el diámetro del sujetador en hex estándar) y α = 30° (8-22):
```
                 0.5774 π E d
km = -----------------------------------
     2 ln{ 5 · (0.5774 l + 0.5 d)/(0.5774 l + 2.5 d) }
```
"It is easy to program the numbered equations in this section, and **you should do so**. The time
spent in programming will save many hours of formula plugging." ← el cliente pidiendo el software.

**Wileman/Choudury/Green (FEA)** (8-23): `km/(E d) = A · exp(B d/l)`, constantes en **Tabla 8-8**.
Coincide EXACTO con α = 30° en `d/l = 0.4`.
> **"However, it is very important to note that the entire joint must be made up of the same
> material. For departure from these conditions, Equation (8-20) remains the basis."**

**Caso de placas de distinto material** (Ejemplo 8-2, procedimiento literal):
- Los frustos se extienden **hasta la mitad del agarre**: `l/2 = ½(0.5 + 0.75 + 0.095) = 0.6725 in`.
- La rondana de acero + la placa de acero, al tener el mismo E, se juntan en **un solo frusto** de
  0.595 in.
- El frusto superior **se pasa** al material de abajo: `0.6725 − 0.5 − 0.095 = 0.0775 in` de
  fundición pertenecen al cono que va hacia arriba → hay **3 frustos**, no 2.
- El diámetro `D` **crece cordón a cordón**: `D = 0.75 + 2(0.595) tan30° = 1.437 in` en la interfaz;
  ese 1.437 es el `D` de entrada del siguiente frusto (el de fundición hacia arriba).
- El diámetro en el punto medio del agarre: `0.75 + 2(0.6725) tan30° = 1.527 in`.
- Se resuelven k1 = 30.80, k2 = 285.5, k3 = 14.15 Mlbf/in → serie → **km = 9.378 Mlbf/in**.
- Compara: si todo fuera acero, (8-22) da 14.64 y Wileman (8-23) da 14.92 (< 2 % de diferencia).

En el Ejemplo 8-5 (tornillo de cabeza, Fig. 8-23) el modelo es explícito:
`D1 = dw + l tanα = 1.5d + 0.577 l`, `D2 = dw = 1.5d`; frusto superior `t = l/2`;
frusto medio `t = h − l/2` y `D = 0.9375 + 2(l − h) tan30°`; frusto inferior `t = l − h`.

## 1.6 §8-6 — Resistencia del perno

- **Proof load** = carga máxima sin deformación permanente. **Proof strength Sp** = proof load / At.
  Corresponde ~al límite de proporcionalidad y a 0.0001 in de set permanente.
- "the mean proof strength, the mean tensile strength, and the corresponding standard deviations
  are **not part of the specification codes**, so it is the **designer's responsibility** to obtain
  these values, perhaps by laboratory testing, if designing to a reliability specification".
- Grados SAE (Tabla 8-9) numerados por resistencia a tensión; decimales = variantes al mismo nivel.
  Espárragos disponibles en grados 1, 2, 4, 5, 8 y 8.1 (el 8.1 no está listado).
- ASTM (Tabla 8-10): **roscas más cortas** porque ASTM es estructural; las conexiones estructurales
  van a cortante y menos rosca = más área de vástago.
- Métricas: Tabla 8-11.
- **Si al perno le falta la marca del fabricante/grado, "assume the bolt strength is unregulated, or
  is relatively low and not intended for engineering applications."**
- Fatiga: falla en el filete bajo la cabeza, en el runout, y en la primera rosca engranada.
  Kf del hombro bajo cabeza = 2.1–2.3, protegido por rondana. Si el runout tiene semi-cono ≤15°, el
  esfuerzo mayor está en la primera rosca engranada. Reparto histórico de fallas:
  **15 % bajo la cabeza, 20 % en el runout, 65 % donde el diseñador puso atención.**
- **"The grade of the nut should be the grade of the bolt."**

## 1.7 §8-7 — Junta a tensión: la carga externa

Nomenclatura: `Fi` precarga, `Ptotal` carga externa total, `P = Ptotal/N` por perno, `Pb`, `Pm`,
`Fb`, `Fm`, `C`, `1 − C`, `N` pernos.

Deducción: `Δδb = Pb/kb = Δδm = Pm/km` → `Pm = (km/kb)Pb` →
```
Pb = kb P/(kb + km) = C·P            Pm = (1 − C)·P            C = kb/(kb + km)
```
(8-24) `Fb = Pb + Fi = C·P + Fi`      (válida mientras `Fm < 0`)
(8-25) `Fm = Pm − Fi = (1 − C)P − Fi` (válida mientras `Fm < 0`)

"these results are valid **only as long as some clamping load remains in the members**".

Tabla 8-12 (2 miembros de acero, perno 1/2 in-13 UNC, sin rondanas): agarre 2 in → C = 0.168;
3 in → 0.136; 4 in → 0.114. Moraleja del autor: **"In all cases, the members take over 80 percent
of the external load. Think how important this is when fatigue loading is present. Note also that
making the grip LONGER causes the members to take an even greater percentage."**

## 1.8 §8-8 — Par vs. tensión

Orden de preferencia del cliente:
1. **Medir la elongación** con micrómetro: `δ = Fi·l/(A E)`, apretar hasta alcanzar δ.
2. Si no se puede (barreno ciego), estimar el par: llave de torque / impacto neumático /
   **turn-of-the-nut**.
3. *Snug-tight* = "the tightness attained by a few impacts of an impact wrench, or the full effort
   of a person using an ordinary wrench". A partir de ahí todo giro adicional produce tensión útil.
   Para pernos estructurales hexagonales pesados: **mínimo 180° desde snug-tight** en condiciones
   óptimas.

Combinando (8-5) y (8-6), con `dc = (d + 1.5d)/2 = 1.25d` (la cara de la rondana de una tuerca hex
= 1.5 × el tamaño nominal):
```
(8-26)  K = (dm/(2d)) · [ (tan λ + f sec α) / (1 − f tan λ sec α) ] + 0.625 fc
(8-27)  T = K · Fi · d
```
`dm` = promedio de diámetro mayor y menor. **"K ≈ 0.20 for f = fc = 0.15 no matter what size bolts
are employed and no matter whether the threads are coarse or fine."**

Datos de Blake & Kurtz (1/2 in-20 UNF a 800 lbf·in ≈ M12×1.25 a 90 N·m):
- Sin lubricar (20 pruebas): media 34.3 kN, **σ̂ = 4.91 kN**.
- Lubricados (10 pruebas): media 34.18 kN, **σ̂ = 2.88 kN**.
- Ambos dan K = 0.208.
Tabla 8-15 (Bowman) da K por condición. "In this book we shall use these values and **use K = 0.2
when the bolt condition is not stated**."

## 1.9 §8-9 — Junta a tensión con precarga, carga estática

```
(8-28)  np = Sp·At / (C·P + Fi)      "yielding factor of safety" (contra rebasar Sp)
(8-29)  nL = (Sp·At − Fi) / (C·P)     factor de CARGA (solo castiga a P)
(8-30)  n0 = Fi / (P(1 − C))          factor contra SEPARACIÓN de junta
```
- np "is used similarly to a traditional yielding factor of safety, with the proof strength
  corresponding to the first measurable permanent set… **Since it is common to load a bolt close to
  the proof strength, this factor of safety is often not much greater than unity.**"
- nL: "a load factor, which is applied only to the load P as a guard against overloading".
- n0: sale de poner `Fm = 0` en (8-25). **"If separation does occur, then the entire external load
  will be imposed on the bolt."**

**Por qué la precarga alta es buena** (Fig. 8-20 + prosa): el material del perno no tiene punto de
fluencia definido y sube suave hasta la fractura → "**no matter how much preload is given the bolt,
it will retain its load-carrying capacity**. This is what keeps the bolt tight and determines the
joint strength. The pretension is the '**muscle**' of the joint… **If the full bolt strength is not
used in developing the pretension, then money is wasted and the joint is weaker.**"

Recomendaciones citadas: RB&W → 60 kpsi para SAE grado 5 en conexiones **no permanentes**, y A325
(≈ grado 5) en aplicaciones estructurales apretado **a la carga de prueba o más allá** (85 kpsi
hasta 1 in de diámetro). Bowman → 75 % de la carga de prueba.

**REGLA DE PRECARGA (8-31), para estático Y fatiga:**
```
Fi = 0.75 Fp   → conexiones NO permanentes, sujetadores REUSADOS
Fi = 0.90 Fp   → conexiones PERMANENTES
(8-32)  Fp = At · Sp        y para otros materiales:  Sp ≈ 0.85 Sy
```

## 1.10 §8-10 — Juntas con empaque

Presión en el empaque de área total Ag con N pernos, con factor de carga n:
```
(8-33)  p = [ Fi − n·P(1 − C) ] · N / Ag
```
Espaciamiento en el círculo de pernos:
```
(8-34)  3 ≤ π Db / (N d) ≤ 6
```
"In full-gasketed joints **uniformity of pressure on the gasket is important**. To maintain adequate
uniformity, adjacent bolts **should not be placed more than six nominal diameters apart** on the bolt
circle. To maintain wrench clearance, bolts **should be placed at least three diameters apart**."

Y desde §8-5: **"If one of the members is a soft gasket, its stiffness relative to the other members
is usually so small that for all practical purposes the others can be neglected and only the gasket
stiffness used."** ← el empaque blando SECUESTRA el cálculo de km.

## 1.11 §8-11 — Fatiga del perno (procedimiento completo)

Fuerzas: `Fb,min = C·Pmin + Fi`, `Fb,max = C·Pmax + Fi`.
```
(8-35)  σa = C(Pmax − Pmin) / (2 At)
(8-36)  σm = C(Pmax + Pmin) / (2 At) + Fi/At
        σi = Fi/At    (punto de arranque de la recta de carga)
```
La recta de carga arranca en σi con pendiente `σa/(σm − σi)`. Intersectando con Goodman:
```
(c)     Sa = Se·σa(Sut − σi) / [ Sut·σa + Se(σm − σi) ]
(8-37)  nf = Sa/σa
(8-38)  nf = Se(Sut − σi) / [ Sut·σa + Se(σm − σi) ]
```
"for any of the nonlinear failure curves the algebra is a bit more tedious… **An easier approach
would be to solve in stages numerically, first Sm, then Sa, and finally nf.**" ← receta de
implementación dada por el propio cliente.

**Caso especial de carga repetida** (Pmin = 0, Pmax = P) — el más común (recipiente a presión):
```
(8-39)  σa = C·P/(2 At)
(8-40)  σm = C·P/(2 At) + Fi/At
(8-41)  σm = σa + σi        → recta de carga de PENDIENTE UNITARIA
```
Criterios (8-42..8-44): Goodman `Sa/Se + Sm/Sut = 1`; Gerber `Sa/Se + (Sm/Sut)² = 1`;
ASME-elíptica `(Sa/Se)² + (Sm/Sp)² = 1`.
Factores cerrados:
```
(8-45) Goodman:  nf = Se(Sut − σi) / [ σa(Sut + Se) ]
(8-46) Gerber:   nf = (1/(2 σa Se)) · [ Sut·sqrt(Sut² + 4Se(Se + σi)) − Sut² − 2 σi Se ]
(8-47) ASME-el.: nf = Se/(σa(Sp² + Se²)) · ( Sp·sqrt(Sp² + Se² − σi²) − σi Se )
(8-48) Goodman con Fi:  nf  = 2 Se(Sut·At − Fi) / [ C·P(Sut + Se) ]
(8-49) sin precarga:    nf0 = 2 Se Sut At / [ P(Sut + Se) ]
(8-50) cota superior:   Fi ≤ (1 − C) Sut At     (para que nf/nf0 ≥ 1, Goodman)
(8-51) fluencia:        np = Sp/(σm + σa)   ← equivalente a (8-28)
```
"**Note that Equations (8-45) to (8-47) are only applicable for repeated loads.** If Kf is being
applied to the stresses, rather than to Se, **be sure to apply it to both σa and σm**. Otherwise,
the slope of the load line will not remain 1 to 1."

Resistencia a fatiga del perno: **Tabla 8-17 = Se YA CORREGIDA, con Kf INCLUIDO como reductor de
resistencia** para roscas **laminadas** (rolled). "Since Kf is included as an endurance strength
reducer in Table 8-17, **it should not be applied as a stress increaser** when using values from
this table. For **cut threads**, the methods of Chapter 6 are useful. **Anticipate that the endurance
strengths will be considerably lower.**" → Tabla 8-16 da Kf por grado y tipo de rosca.

Punto D del Ejemplo 8-5 (Langer / proof-strength line), resuelto a mano:
`Sm + Sa = Sp` junto con `Sm = σi + Sa` → `Sa = (Sp − σi)/2`, y `np = Sa/σa` (idéntico a 8-29).

El cliente COMPARA criterios y avisa del conflicto: en el Ejemplo 8-5, Goodman da nf = 2.44 y
np = 3.43 ("el peligro es fatiga"), pero Gerber da nf = 3.65 (> np) → "contradicts the conclusion
earlier… the **conservative nature of the Goodman criterion** explains the discrepancy".

## 1.12 §8-12 — Juntas atornilladas y remachadas a CORTANTE

7 modos de falla (Fig. 8-25): (b) flexión del remache/miembros, (c) cortante del remache, (d) falla
a tensión de los miembros, (e) aplastamiento (bearing), (f) desgarre por cortante de borde,
(g) desgarre a tensión.
```
(8-52)  σ = M/(I/c),  con M ≈ F·t/2   (flexión — "seldom used in design; its effect is compensated
                                       for by an increase in the factor of safety")
(8-53)  τ = F/A       (A = área de TODOS los remaches del grupo; se usa el diámetro NOMINAL del
                       remache, no el del barreno)
(8-54)  σ = F/A       (A = área NETA de la placa = área menos todos los barrenos)
(8-55)  σ = −F/A      (aplastamiento; A = t·d proyectada, t = espesor de la placa MÁS DELGADA)
```
Diferencia clave remache vs. perno: "In a **rivet** joint, the rivets all share the load… In a
**bolted** joint, shear is taken by **clamping friction, and bearing does not exist**. When bolt
preload is lost, one bolt begins to carry the shear and bearing until yielding slowly brings other
fasteners in to share… Finally, all participate, and **this is the basis of most bolted-joint
analysis if loss of bolt preload is complete.**"

**LA LISTA DE VERIFICACIONES DEL AUTOR ("The usual analysis involves"):**
- Aplastamiento en el perno (todos los pernos participan)
- Aplastamiento en los miembros (todos los barrenos participan)
- Cortante del perno (todos los pernos participan eventualmente)
- **Distinguir entre cortante en la ROSCA y en el VÁSTAGO**
- Desgarre de borde del miembro (participan los pernos de la orilla)
- Fluencia a tensión del miembro a través de los barrenos
- Verificar la capacidad del miembro

Fórmulas usadas en el Ejemplo 8-6 (nótese que **el cortante usa el criterio de energía de
distorsión, 0.577·Sy**):
- Aplastamiento pernos: `F = 2·t·d·Sy/nd`
- Aplastamiento miembros: `F = 2·t·d·(Sy)mem/nd`
- Cortante de perno, sin rosca en el plano: `F = 0.577·π·d²·(Sy/nd)` (×4 pernos → área 4πd²/4)
- Cortante con rosca en el plano: `F = 0.577·(4)·Ar·Sy/nd` (usa **Ar**, área del diámetro menor)
- Desgarre de borde: `τ = F/(4 a t) = 0.577(Sy)mem/nd`, `a` = distancia al borde (Fig. 8-27)
- Fluencia a tensión del miembro: `σ = F/([w − 2d]·t) = (Sy)mem/nd`

**Carga excéntrica** — pivote en el CENTROIDE del patrón:
```
(8-56)  x̄ = Σ Ai xi / Σ Ai        ȳ = Σ Ai yi / Σ Ai
```
Tres pasos:
1. **Cortante primario / carga directa**: `F' = V/n` (asume miembro absolutamente rígido; "the
   arrangement of the bolts or the shape and size of the members sometimes justifies the use of
   another assumption as to the division of the load").
2. **Cortante secundario / carga de momento** (8-57): `F''n = M1·rn / (rA² + rB² + rC² + …)`,
   perpendicular al radio. Si los pernos NO son del mismo diámetro, hay que sustituir F'' por el
   **esfuerzo** `τ'' = 4F''/(π d²)` en la ecuación de proporcionalidad.
3. Sumar F' y F'' **vectorialmente** por perno; solo importa el perno de máxima resultante.

Además del perno, en el Ejemplo 8-7 revisa: cortante máximo en el perno, **aplastamiento contra el
alma más delgada** (`Ab = t·d`, el canal de 10 mm, no la barra de 15), y la **flexión crítica de la
barra** en la sección que pasa por los barrenos, con `I = Ibar − 2(Ihole + d̄²A)` (teorema de ejes
paralelos restando los barrenos).

## 1.13 CAPÍTULO 9 — SOLDADURA

### §9-1 Símbolos de soldadura
Símbolo AWS (Fig. 9-1). Elementos: línea de referencia, flecha, símbolos básicos (Fig. 9-2:
bead, fillet, plug/slot, square, V, bevel, U, J), dimensiones y datos, símbolos suplementarios,
símbolo de acabado, cola, especificación/proceso. Campos posicionales: acabado / contorno /
abertura de raíz (o profundidad de llenado en plug y slot) / tamaño (o resistencia en soldadura de
resistencia) / **S** / **T** / **R** / longitud del cordón **L** / paso **P** (centro a centro) /
símbolo de soldar todo alrededor / símbolo de soldadura de campo / número de puntos **(N)**.
"**Arrow side**" = lado al que apunta la flecha; el opuesto es "other side".
Fig. 9-3: `5` = tamaño de pierna; `60–200` = cordones intermitentes de 60 mm escalonados a 200 mm
entre centros. Fig. 9-4: el círculo = soldar todo alrededor.
Para elementos de máquina la mayoría son **filetes**; los de tope se usan mucho en recipientes a
presión.

### §9-2 Soldaduras a tope y de filete
```
(9-1)  σ = F/(h·l)     tope, tensión o compresión — h es la GARGANTA, l la longitud
(9-2)  τ = F/(h·l)     tope, cortante
```
"Note that the value of h **does not include the reinforcement**." El refuerzo produce concentración
de esfuerzo en el punto A.

Filete transversal: se resuelve el cuerpo libre a un ángulo θ (Fig. 9-9), con
`t = h/(cos θ + sin θ)`, y
```
τ(θ) = (F/hl)(sinθ cosθ + sin²θ)
σ(θ) = (F/hl)(cos²θ + sinθ cosθ)
σ'(θ) = (F/hl)[(cos²θ + sinθcosθ)² + 3(sin²θ + sinθcosθ)²]^(1/2)
```
Resultados: **σ'max en θ = 62.5°, σ' = 2.16 F/(hl)** (con τ = 1.196 y σ = 0.623 F/(hl));
**τmax en θ = 67.5°, τmax = 1.207 F/(hl)** (con σ = 0.5 F/(hl)).

Pero fotoelasticidad (Norris) y Salakian muestran concentraciones en A y B que ninguna de esas
ecuaciones predice: "**we have no analytical approach that predicts the existing stresses**. The
geometry of the fillet is crude by machinery standards, and even if it were ideal, the macrogeometry
is too abrupt and complex for our methods."

**EL MODELO QUE SÍ SE USA — los tres postulados:**
- "**Consider the external loading to be carried by shear forces on the throat area of the weld. By
  ignoring the normal stress on the throat, the shearing stresses are inflated sufficiently to
  render the model conservative.**"
- "Use distortion energy for significant stresses."
- "Circumscribe typical cases by code."
```
(9-3)  τ = F/(0.707 h l) = 1.414 F/(h l)
```
"Note that this **inflates** the maximum estimated shear stress by a factor of
**1.414/1.207 = 1.17**." Y para filetes **paralelos** (Fig. 9-11) el máximo también está en la
garganta mínima y corresponde a (9-3).

**Bajo carga combinada, el orden de trabajo del cliente:**
1. Examinar cortantes primarios por fuerzas externas.
2. Examinar cortantes secundarios por momentos de torsión y flexión.
3. Estimar la(s) resistencia(s) del metal base.
4. Estimar la resistencia del metal de aporte depositado.
5. Estimar las cargas permisibles del metal base.
6. Estimar la carga permisible del metal de aporte.

### §9-3 Torsión — el cordón como LÍNEA
```
(9-4)  τ' = V/A          A = área de garganta de TODAS las soldaduras
(9-5)  τ'' = M·r/J       r desde el centroide del GRUPO al punto de interés
(9-6)  J = 0.707 · h · Ju
```
Deducción: `t1 = 0.707 h1`, `A = t1 d + t2 b`; `JG1 = t1d³/12 + d t1³/12`; los términos `t³` "are
small and **can be neglected**" → JG queda **lineal en el ancho del cordón** → poner t = 1 da el
**momento polar unitario Ju**, que no depende del tamaño del cordón. Hay que usar el **teorema de
ejes paralelos** cuando hay grupos: `J = (JG1 + A1 r1²) + (JG2 + A2 r2²)`.

"The reverse procedure is that in which the allowable shear stress is given and we wish to find the
weld size. **The usual procedure is to estimate a probable weld size and then to use iteration.**"

**TABLA 9-1 — Propiedades torsionales de filetes** (G = centroide del grupo; h = tamaño del cordón;
el plano del par de torsión está en el plano del papel; cordones de ancho unitario):

| # | Patrón | Área de garganta A | Centroide | Ju |
|---|--------|--------------------|-----------|-----|
| 1 | Un cordón vertical, largo d | `A = 0.707 h d` | `x̄ = 0`, `ȳ = d/2` | `Ju = d³/12` |
| 2 | Dos cordones verticales separados b | `A = 1.414 h d` | `x̄ = b/2`, `ȳ = d/2` | `Ju = d(3b² + d²)/6` |
| 3 | Cordón en L (b y d) | `A = 0.707 h (b + d)` | `x̄ = b²/[2(b+d)]`, `ȳ = d²/[2(b+d)]` | `Ju = [(b+d)⁴ − 6b²d²] / [12(b+d)]` |
| 4 | Canal / U (2 horizontales b + 1 vertical d) | `A = 0.707 h (2b + d)` | `x̄ = b²/(2b+d)`, `ȳ = d/2` | `Ju = (8b³ + 6bd² + d³)/12 − b⁴/(2b+d)` |
| 5 | Rectángulo cerrado (b × d) | `A = 1.414 h (b + d)` | `x̄ = b/2`, `ȳ = d/2` | `Ju = (b + d)³/6` |
| 6 | Círculo de radio r | `A = 1.414 π h r` | — | `Ju = 2π r³` |

### §9-4 Flexión
```
(a)  τ' = V/A
(b)  Iu = b d²/2     (para el caso de dos cordones horizontales separados d)
(c)  I  = 0.707 h Iu
(d)  τ'' = M c/I = M(d/2)/(0.707 h b d²/2) = 1.414 M/(b d h)
(e)  τ = (τ'² + τ''²)^(1/2)
```
"The model gives the coefficient of **1.414**, in contrast to the predictions of Section 9-2 of
1.197 from distortion energy, or 1.207 from maximum shear. **The conservatism of the model's 1.414
is not that it is simply larger… but the tests carried out to validate the model show that it is
large enough.**"

Y el detalle que un implementador borraría: "The second moment of area in Equation (d) is based on
the distance **d between the two welds**. If this moment is found by treating the two welds as
having rectangular footprints, the distance between the weld throat centroids is approximately
**(d + h)**. This would produce a slightly larger second moment of area, and result in a **smaller**
level of stress. This method of treating welds as a line **does not interfere with the conservatism
of the model**. It also makes Table 9-2 possible."

**TABLA 9-2 — Propiedades de flexión de filetes** (Iu se toma respecto a un eje HORIZONTAL que pasa
por G; el plano del par flexionante es normal al papel y paralelo al eje y; todos los cordones del
mismo tamaño):

| # | Patrón | A | Centroide | Iu |
|---|--------|---|-----------|-----|
| 1 | Un cordón vertical d | `A = 0.707 h d` | `x̄ = 0`, `ȳ = d/2` | `Iu = d³/12` |
| 2 | Dos cordones verticales (sep. b) | `A = 1.414 h d` | `x̄ = b/2`, `ȳ = d/2` | `Iu = d³/6` |
| 3 | Dos cordones horizontales b (sep. d) | `A = 1.414 h b` | `x̄ = b/2`, `ȳ = d/2` | `Iu = b d²/2` |
| 4 | 2 horizontales b + 1 vertical d | `A = 0.707 h (2b + d)` | `x̄ = b²/(2b+d)`, `ȳ = d/2` | `Iu = d²(6b + d)/12` |
| 5 | 1 horizontal b + 2 verticales d | `A = 0.707 h (b + 2d)` | `x̄ = b/2`, `ȳ = d²/(b+2d)` | `Iu = 2d³/3 − 2d²ȳ + (b + 2d)ȳ²` |
| 6 | Rectángulo cerrado | `A = 1.414 h (b + d)` | `x̄ = b/2`, `ȳ = d/2` | `Iu = d²(3b + d)/6` |
| 7 | 1 horizontal b + 2 verticales d (variante) | `A = 0.707 h (b + 2d)` | `x̄ = b/2`, `ȳ = d²/(b+2d)` | `Iu = 2d³/3 − 2d²ȳ + (b + 2d)ȳ²` |
| 8 | Rectángulo cerrado (variante) | `A = 1.414 h (b + d)` | `x̄ = b/2`, `ȳ = d/2` | `Iu = d²(3b + d)/6` |
| 9 | Círculo radio r | `A = 1.414 π h r` | — | `Iu = π r³` |

### §9-5 Resistencia de juntas soldadas
- "The matching of the electrode properties with those of the parent metal is usually **not so
  important as speed, operator appeal, and the appearance** of the completed joint."
- "**It is preferable… to select a steel that will result in a fast, economical weld even though
  this may require a sacrifice of other qualities such as machinability.** Under the proper
  conditions, all steels can be welded, but **best results will be obtained if steels having a UNS
  specification between G10140 and G10230 are chosen**" (Sut 60–70 kpsi en caliente).
- El código AISC basa los permisibles en **Sy** del material, no en Sut, y permite aceros ASTM con
  Sy de 33 a 50 kpsi. "Provided the loading is the same, the code permits **the same stress in the
  weld metal as in the parent metal**."
- Factores de seguridad implícitos: tensión `n = 1/0.60 = 1.67`; cortante
  `n = 0.577/0.40 = 1.44` (energía de distorsión).
- **"It is important to observe that the electrode material is often the strongest material
  present."** Al soldar 1010 con 1018 el metal de soldadura es una mezcla; y una barra estirada en
  frío **pierde sus propiedades de CD y recupera las de laminado en caliente en la vecindad de la
  soldadura**. "remembering that the weld metal is usually the strongest, **do check the stresses in
  the parent metals**."
- "codes tend to **conceal the actual margin of safety** involved."

**TABLA 9-3 — Propiedades mínimas del metal de soldadura**

| Electrodo AWS | Sut, kpsi (MPa) | Sy, kpsi (MPa) | % Elongación |
|---|---|---|---|
| E60xx | 62 (427) | 50 (345) | 17–25 |
| E70xx | 70 (482) | 57 (393) | 22 |
| E80xx | 80 (551) | 67 (462) | 19 |
| E90xx | 90 (620) | 77 (531) | 14–17 |
| E100xx | 100 (689) | 87 (600) | 13–16 |
| E120xx | 120 (827) | 107 (737) | 14 |

Codificación: `E` + 4 o 5 dígitos; los primeros 2–3 dígitos = Sut aproximada; el **último** dígito
incluye variables de técnica (tipo de corriente); el **penúltimo** indica la posición de soldadura
(plana, vertical, sobrecabeza).

**TABLA 9-4 — Esfuerzos permitidos por el código AISC para el metal de soldadura**

| Tipo de carga | Tipo de soldadura | Esfuerzo permisible | n |
|---|---|---|---|
| Tensión | Tope | `0.60 Sy` | 1.67 |
| Aplastamiento | Tope | `0.90 Sy` | 1.11 |
| Flexión | Tope | `0.60–0.66 Sy` | 1.52–1.67 |
| Compresión simple | Tope | `0.60 Sy` | 1.67 |
| **Cortante** | **Tope o filete** | **`0.30 Sut`** (del electrodo) | — |

Nota al pie **crítica**: "**Shear stress on base metal should not exceed 0.40 Sy of base metal.**"

**TABLA 9-5 — Factores de concentración de esfuerzo a fatiga Kfs** ("These factors should be used
for the **parent metal as well as** for the weld metal"):

| Tipo de soldadura | Kfs |
|---|---|
| Soldadura a tope reforzada | 1.2 |
| Pie (toe) de filete transversal | 1.5 |
| Extremo de filete paralelo | 2.7 |
| Junta T a tope con esquinas agudas | 2.0 |

**TABLA 9-6, Schedule A — Cargas estáticas permisibles**
Esfuerzo cortante permisible en la garganta, τ [ksi], por nivel de electrodo EXX:
60 → 18.0 | 70 → 21.0 | 80 → 24.0 | 90 → 27.0 | 100 → 30.0 | 110 → 33.0 | 120 → 36.0
Fuerza unitaria permisible en el filete, **f = 0.707 h τall** [kip/pulgada lineal]:
60 → 12.73h | 70 → 14.85h | 80 → 16.97h | 90 → 19.09h | 100 → 21.21h | 110 → 23.33h | 120 → 25.45h
Tabla desglosada por pierna h (in), kip/in — extracto (h = 1, 3/4, 1/2, 3/8, 5/16, 1/4, 1/8):

| h, in | E60 | E70 | E80 | E90 | E100 | E110 | E120 |
|---|---|---|---|---|---|---|---|
| 1 | 12.73 | 14.85 | 16.97 | 19.09 | 21.21 | 23.33 | 25.45 |
| 7/8 | 11.14 | 12.99 | 14.85 | 16.70 | 18.57 | 20.41 | 22.27 |
| 3/4 | 9.55 | 11.14 | 12.73 | 14.32 | 15.92 | 17.50 | 19.09 |
| 5/8 | 7.96 | 9.28 | 10.61 | 11.93 | 13.27 | 14.58 | 15.91 |
| 1/2 | 6.37 | 7.42 | 8.48 | 9.54 | 10.61 | 11.67 | 12.73 |
| 7/16 | 5.57 | 6.50 | 7.42 | 8.35 | 9.28 | 10.21 | 11.14 |
| 3/8 | 4.77 | 5.57 | 6.36 | 7.16 | 7.95 | 8.75 | 9.54 |
| 5/16 | 3.98 | 4.64 | 5.30 | 5.97 | 6.63 | 7.29 | 7.95 |
| 1/4 | 3.18 | 3.71 | 4.24 | 4.77 | 5.30 | 5.83 | 6.36 |
| 3/16 | 2.39 | 2.78 | 3.18 | 3.58 | 3.98 | 4.38 | 4.77 |
| 1/8 | 1.59 | 1.86 | 2.12 | 2.39 | 2.65 | 2.92 | 3.18 |
| 1/16 | 0.795 | 0.930 | 1.06 | 1.19 | 1.33 | 1.46 | 1.59 |

**TABLA 9-6, Schedule B — Tamaño MÍNIMO de filete h** (indexado por el espesor de la parte **más
gruesa** que se une):

| Espesor de la parte más gruesa, in | h mínimo, in |
|---|---|
| hasta 1/4 incl. | 1/8 |
| > 1/4 hasta 1/2 | 3/16 |
| > 1/2 hasta 3/4 | 1/4 |
| > 3/4 hasta 1 1/2 | 5/16 |
| > 1 1/2 hasta 2 1/4 | 3/8 |
| > 2 1/4 hasta 6 | 1/2 |
| > 6 | 5/8 |

Notas al pie: "**Not to exceed the thickness of the thinner part.**" — "Minimum size **for bridge
application does not go below 3/16 in**." — "For minimum fillet weld size, schedule **does not go
above 5/16 in fillet weld for every 3/4 in material**."

### §9-6 Carga estática — los dos métodos, en paralelo
El cliente resuelve TODO dos veces: **método convencional** (esfuerzo real vs. resistencia con
energía de distorsión) y **método del código** (carga unitaria permisible de Tabla 9-6 / esfuerzos
de Tabla 9-4), y verifica que sean consistentes.
- Ej. 9-2 (código): `F = f · l = 5.57 × 4 = 22.28 kip > 14 kip` OK; luego **cortante en el metal de
  la unión adyacente** `τall = 0.4 Sy`, `τ = F/(2hl)`; luego **tensión en el vástago**
  `σall = 0.6 Sy`, `σ = F/(t l)`.
- Ej. 9-3: **cordones asimétricos para matar la excentricidad** — sumar momentos alrededor de un
  extremo para repartir F1/F2 y hacer `l2/l1 = F2/F1`, de modo que "there is **no moment to be
  resisted by the welds**". Se calcula l1 por resistencia del METAL DE APORTE (`τall = 0.3 Sut_elec
  = 21 kpsi`) → 2.16 in, y por resistencia del METAL BASE (`τall = 0.4 Sy = 14.4 kpsi`) → 2.22 in.
  **"The base metal controls the weld lengths."** Y al final REDONDEA a medidas de taller:
  `l1 = 2 1/4 in, l2 = 3 1/4 in` con la nota "The small magnitude of the departure from
  l2/l1 = 1.4 is not serious. The joint is essentially moment-free."
- Ej. 9-4 (evaluación de adecuación, nd = 3.0): (a) metal de aporte convencional →
  `n = Ssy/τ = 0.577(50)/8.51 = 3.39` ✓; (b) **metal de la ménsula** → `σ = M/(bd²/6) = 12 kpsi`,
  `n = Sy/σ = 32/12 = 2.67` ✗ **la junta es inadecuada por el ATTACHMENT, no por la soldadura**;
  (c) por código, `τall = 18 kpsi` (E6010) y el código ya trae un factor `0.577(50)/18 = 1.6`
  incluido → `n = 1.6 × 18/8.51 = 3.38`, consistente con (a).

### §9-7 Fatiga en soldadura
"The conventional methods for fatigue are applicable. With only shear loading, we will adapt the
fluctuating-stress diagram and a fatigue failure criterion **for shear stresses and shear
strengths**, according to §6-13."
**"For the surface factor of Equation (6-18), an *as-forged* surface should ALWAYS be assumed for
weldments unless a superior finish is specified and obtained."**

Procedimiento visto en Ej. 9-5 y 9-6:
1. Resistencias: metal base de Tabla A-20; electrodo de Tabla 9-3.
2. `Kfs` de Tabla 9-5.
3. `ka = 12.7 (Sut)^−0.758` (Tabla 6-2, superficie forjada). Ej.: `ka = 12.7(58)^−0.758 = 0.58`.
4. `kb = 1` ("For a uniform shear stress on the throat").
5. `kc = 0.59` (torsión/cortante, Ec. 6-25); `kd = ke = 1`.
6. `Sse = ka kb kc kd ke (0.5 Sut)` → Ej.: `0.58 · 1 · 0.59 · 1 · 1 · 0.5(58) = 9.9 kpsi`.
7. `τ'a = Kfs Fa / A`, `τ'm = Kfs Fm / A`, con A = área de garganta de Tabla 9-2.
8. Sin componente media: `nf = Sse/τ'a`.
   Con media: estimar el **módulo de ruptura a cortante** `Ssu = 0.67 Sut` (Ec. 6-58) y usar Goodman
   adaptado a cortante: `nf = (τ'a/Sse + τ'm/Ssu)^−1`.

### §9-8 Soldadura de resistencia (punto y costura)
- Ventajas: velocidad, regulación precisa de tiempo y calor, uniformidad, propiedades mecánicas;
  fácil de automatizar; **no necesita metal de aporte ni fundentes**. Costura = puntos traslapados.
- Falla por cortante de la soldadura o por **desgarre del metal alrededor**.
- "**it is good practice to AVOID loading a resistance-welded joint in tension.** Thus, for the most
  part, design so that the spot or seam is loaded in **pure shear**." τ = carga / área del punto.
- La resistencia se especifica como **carga por punto basada en el espesor de la lámina MÁS DELGADA**,
  y "**such strengths are best obtained by experiment**" (no hay tabla en el texto).
- "**Somewhat larger factors of safety should be used** when parts are fastened by spot welding
  rather than by bolts or rivets, to account for the metallurgical changes."

### §9-9 Uniones adhesivas
Clasificación: por química (epóxicos, poliuretanos, poliimidas), por forma (pasta, líquido, película,
pellets, cinta), por tipo (hot melt, hot melt reactivo, termofijo, sensible a presión, de contacto),
o por capacidad de carga (**estructural / semiestructural / no estructural**). Anaeróbicos curan en
espacios estrechos sin oxígeno (fijar pernos o rodamientos).

**Tabla 9-7** — Desempeño mecánico por química (extracto; lap-shear MPa (psi) / pelado kN/m (lbf/in)):
sensible a presión 0.01–0.07 (2–10) / 0.18–0.88; hot melt formulado 0.35–4.8 (50–700) / 0.88–3.5;
cianoacrilato 6.9–13.8 (1000–2000) / 0.18–3.5; uretano 6.9–17.2 (1000–2500) / 1.8–8.8;
acrílico modificado con hule 13.8–24.1 (2000–3500) / 1.8–8.8; fenólico modificado 13.8–27.6 /
3.6–7; epóxico sin modificar 10.3–27.6 (1500–4000) / 0.35–1.8; **epóxico modificado con hule
20.7–41.4 (3000–6000) / 4.4–14 (25–80)** ← el más fuerte de la tabla.

**Volkersen / shear-lag** para junta de doble traslape simétrica (9-7):
```
τ(x) = [Pω / (4b sinh(ωl/2))] · cosh(ωx)
     + [Pω/(4b cosh(ωl/2))] · [(2 Eo to − Ei ti)/(2 Eo to + Ei ti)] · ...
     + [ (αi − αo) ΔT ω / ( [1/(Eo to) + 2/(Ei ti)] cosh(ωl/2) ) ] · sinh(ωx)

ω = sqrt( (G/h) · [ 1/(Eo to) + 2/(Ei ti) ] )
```
(La transcripción del OCR mezcla los dos primeros términos; el Ejemplo 9-7 los usa como
`τP(x) = Pω cosh(ωx)/(4b sinh(ωl/2))` cuando la junta está "balanceada", `Eo to = Ei ti/2`, y
`τth(x) = (αi−αo)ΔTω sinh(ωx) / ([1/(Eo to) + 2/(Ei ti)] cosh(ωl/2))`.)

Hallazgos del Ejemplo 9-7 que son requisitos:
- **El máximo del modelo shear-lag SIEMPRE está en los EXTREMOS del traslape.**
- Los esfuerzos residuales térmicos **ya están ahí antes de aplicar la carga** (en el ejemplo,
  ±2466 psi térmicos contra 1922 psi por carga).
- "The significance of the thermal stresses serves as a **caution against joining dissimilar
  adherends when large temperature changes are involved**."
- `τavg = P/(2bl) = 1000 psi` pero el pico es 1922 psi → **casi el doble del promedio**.
- Traslape SIMPLE: la excentricidad y la flexión del adherente pueden **duplicar** el cortante
  respecto al doble traslape; los esfuerzos de **pelado** suelen ser los que matan la junta; la
  flexión en el adherente al final del traslape puede ser **4×** el esfuerzo promedio.
  "For very long joints, Volkersen predicts only **50 %** of the Goland-Reissner shear stress."

---

# 2. REGLAS PRESCRIPTIVAS EN PROSA (el oro)

Cada una: § / cita corta en inglés / traducción.

### Tornillo de potencia
1. **§8-2** — "For large collars, the torque **should probably be computed** in a manner similar to
   that employed for disk clutches." → Para collarines grandes calcula el par como embrague de disco,
   no con `F fc dc/2`.
2. **§8-2** — "substituting 0.38F for F and setting nt to 1 will give the largest level of stresses…
   **assuming there are at least 6 threads engaged**." → Con al menos 6 roscas engranadas, mete
   0.38F y nt = 1; si hay menos de 6, esa regla ya no aplica.
3. **§8-2** — "Acme… **is often preferred** because it is easier to machine and permits the use of a
   **split nut**, which can be adjusted to take up for wear." → La Acme se prefiere por
   manufacturabilidad y tuerca partida ajustable, aunque sea menos eficiente.

### Sujetadores y ensamble
4. **§8-3** — "**The ideal bolt length is one in which only one or two threads project from the nut**
   after it is tightened." → El largo ideal deja una o dos roscas asomando de la tuerca.
5. **§8-3** — "Bolt holes may have burrs or sharp edges after drilling… Therefore, **washers must
   always be used under the bolt head**. They **should be of hardened steel** and loaded so that the
   **rounded edge of the stamped hole faces the washer face of the bolt**." → Siempre rondana
   endurecida bajo la cabeza, con el borde redondeado del barreno troquelado hacia la cara del perno.
6. **§8-3** — "the mechanic **should, if possible, hold the bolt head stationary and twist the nut**;
   in this way the bolt shank will not feel the thread-friction torque." → Detén la cabeza y gira la
   tuerca, para que el vástago no se lleve el par de fricción de la rosca.
7. **§8-3** — "**you should NEVER reuse nuts; in fact, it can be dangerous to do so**." → Nunca
   reutilices tuercas.
8. **§8-6** — "**The grade of the nut should be the grade of the bolt.**" → La tuerca va del mismo
   grado que el perno.
9. **§8-6** — "If such marks are missing, **assume the bolt strength is unregulated**, or is
   relatively low and not intended for engineering applications." → Perno sin marca = resistencia
   no regulada; no lo uses para ingeniería.

### Rigidez
10. **§8-5** — "In this book we shall use **α = 30°** except in cases in which the material is
    insufficient to allow the frusta to exist." → 30° salvo que el material no alcance para que el
    frusto exista.
11. **§8-5** — "Equation (8-20), or (8-19), **must be solved separately for each frustum** in the
    joint." → Una ecuación por frusto, siempre; luego serie.
12. **§8-5** — "**it is very important to note that the entire joint must be made up of the same
    material**" (para Wileman, 8-23). → La correlación de Wileman SOLO si toda la junta es del mismo
    material; si no, regresa a (8-20).
13. **§8-5** — "**If one of the members is a soft gasket**, its stiffness relative to the other
    members is usually so small that… only the gasket stiffness [is] used." → Empaque blando = km es
    el del empaque y ya.
14. **§8-5** — "It is easy to program the numbered equations in this section, and **you should do
    so**." → El propio cliente pide que esto se programe.

### Precarga y par
15. **§8-8** — "Having learned that **a high preload is very desirable** in important bolted
    connections, we must next consider means of ensuring that the preload is actually developed."
    → La precarga alta es deseable; el problema es GARANTIZARLA.
16. **§8-8** — "**Do not rely too much on wrench torque when the range of acceptable preload is
    narrow.** If high reliability is a requirement, then preload **should be determined by bolt
    elongation**." → Si la ventana de precarga es angosta o se pide alta confiabilidad, mide
    elongación, no par.
17. **§8-8** — "**use K = 0.2 when the bolt condition is not stated**." → K por defecto = 0.2.
18. **§8-9** — "**If the full bolt strength is not used in developing the pretension, then money is
    wasted and the joint is weaker.**" → Precargar bajo desperdicia perno Y debilita la junta.
19. **§8-9 (8-31)** — "**0.75 Fp for nonpermanent connections, reused fasteners; 0.90 Fp for
    permanent connections.**" → 75 % reusable, 90 % permanente. (Nosotros solo tenemos el 0.75.)
20. **§8-9** — "For other materials, an approximate value is **Sp = 0.85 Sy**." → Si el material no
    está en tabla, Sp ≈ 0.85 Sy.
21. **§8-11** — "**A rule of thumb is that preloads of 60 percent of proof load rarely loosen.**
    If more is better, how much more? Well, **not enough to create reused fasteners as a future
    threat.** Alternatively, fastener-locking schemes can be employed." → 60 % de proof rara vez se
    afloja; más es mejor pero sin dejar un sujetador reusado como amenaza futura.
22. **§8-11** — "**Bolts loosen, as they are friction devices**, and cyclic loading and vibration…
    allow the fasteners to lose tension with time." → El perno es un dispositivo de FRICCIÓN; se
    afloja con el tiempo.

### Empaques y patrón de pernos
23. **§8-10** — "adjacent bolts **should not be placed more than six nominal diameters apart** on the
    bolt circle" y "bolts **should be placed at least three diameters apart**" (claro de llave).
    → `3 ≤ πDb/(Nd) ≤ 6`.

### Fatiga del perno
24. **§8-11** — "Since Kf is included as an endurance strength reducer in Table 8-17, **it should not
    be applied as a stress increaser** when using values from this table." → No apliques Kf dos veces.
25. **§8-11** — "For **cut threads**, the methods of Chapter 6 are useful. **Anticipate that the
    endurance strengths will be considerably lower.**" → Rosca cortada = Se bastante más baja que la
    laminada.
26. **§8-11** — "If Kf is being applied to the stresses… **be sure to apply it to both σa and σm.
    Otherwise, the slope of the load line will not remain 1 to 1.**" → Kf a σa Y a σm, o la recta de
    carga se deforma.
27. **§8-11** — "If this cannot be achieved, and nf is unsatisfactory, use the **Gerber or
    ASME-elliptic** criterion to obtain a less conservative assessment. If the design is still not
    satisfactory, **additional bolts and/or a different size bolt may be called for**." → Escalera de
    remedios explícita.
28. **§8-11** — "**you should also check the possibility of yielding**, using the proof strength."
    → Después de fatiga, siempre revisa fluencia contra Sp.
29. **§8-11 (Ej. 8-5)** — "**These two factors should always be compared to determine where the
    greatest danger lies.**" → Compara nf contra np para saber por dónde va a fallar.

### Cortante
30. **§8-12** — "In structural practice this failure is avoided by **spacing the rivets at least
    1 1/2 diameters away from the edge**." → Distancia mínima al borde: 1.5 d (y en atornilladas se
    usa aún más "for satisfactory appearance").
31. **§8-12** — "it is standard practice in structural design to **use the nominal diameter of the
    rivet rather than the diameter of the hole**." → Cortante con d nominal, no del barreno.
32. **§8-12** — "unless definite steps are taken to ensure that the preload does not relax, **it is
    on the conservative side to design as if the full stress-concentration effect were present**."
    → Si no garantizas la precarga, diseña con Kt completo en el barreno.
33. **§8-12** — "The stress-concentration effects **are not considered in structural design**,
    because the loads are static and the materials ductile." → En estructural con carga estática y
    material dúctil, se ignora Kt (contexto que cambia la regla anterior).
34. **§8-12** — "the designer should, of course, **use the combination of rivet or bolt holes that
    gives the smallest area**." → Área neta = la peor combinación de barrenos, no la primera.
35. **§8-12 (Ej. 8-6/8-7)** — "**it would be poor design to allow the threads to extend into a shear
    plane**" y "Using bolts not extending into the joint, or **shoulder bolts, is preferred**."
    → La rosca no debe cruzar el plano de corte (49.7 vs 62.5 kip en el ejemplo).
36. **§8-12** — la flexión del remache (8-52) "is **seldom used in design**; instead **its effect is
    compensated for by an increase in the factor of safety**." → La flexión del remache se absorbe en
    el FS, no se calcula.

### Soldadura
37. **§9-1** — "If unusual joints are required because of insufficient clearance or because of the
    section shape, **the design may be a poor one and the designer should begin again** and endeavor
    to synthesize another solution." → Si la junta te obliga a hacer maromas, rediseña la pieza.
38. **§9-1** — "**When the parts to be welded are thick, a preheating will also be of benefit.**" y
    "in some cases a light heat treatment after welding has been found helpful in relieving [residual
    stresses]". → Precalienta en secciones gruesas; alivio térmico ligero después.
39. **§9-1** — "If the reliability of the component is to be quite high, **a testing program should
    be established**." → Alta confiabilidad ⇒ programa de pruebas, no solo cálculo.
40. **§9-1 (Fig. 9-6c)** — la soldadura de esquina "may also have a bead weld on inside for greater
    strength but **should not be used for heavy loads**." → La junta de esquina no es para carga
    pesada.
41. **§9-2** — "**Note that the value of h does not include the reinforcement.**" y "**If fatigue
    loads exist, it is good practice to grind or machine off the reinforcement.**" → La garganta
    excluye el refuerzo; con fatiga, esmerila el refuerzo.
42. **§9-2** — "**Consider the external loading to be carried by shear forces on the throat area of
    the weld. By ignoring the normal stress on the throat, the shearing stresses are inflated
    sufficiently to render the model conservative.**" → EL FILETE SE DIMENSIONA POR CORTANTE EN LA
    GARGANTA (0.707 h), aunque la carga sea de tensión. Es a propósito, factor 1.17.
43. **§9-3** — "The usual procedure is to **estimate a probable weld size and then to use
    iteration**." → El tamaño del cordón sale por iteración, no despejado.
44. **§9-3** — "Observe… t₁³ and t₂³… **These quantities are small and can be neglected.**" → Se
    desprecian los cubos del espesor; de ahí sale el cordón-como-línea.
45. **§9-3** — "**The transfer formula for Ju must be employed when the welds occur in groups**" y
    "The distance r **must be measured from G** and the moment M computed about G." → Ejes paralelos
    obligatorio; todo referido al centroide del GRUPO.
46. **§9-5** — "**It is preferable… to select a steel that will result in a fast, economical weld**
    even though this may require a sacrifice of other qualities such as machinability." y "best
    results… **UNS G10140 a G10230**." → El acero se elige por soldabilidad/economía, no por
    maquinabilidad.
47. **§9-5** — "remembering that the weld metal is usually the strongest, **do check the stresses in
    the parent metals**." → Revisa SIEMPRE el metal base; casi siempre él manda.
48. **§9-4 nota Tabla 9-4** — "**Shear stress on base metal should not exceed 0.40 Sy of base
    metal.**" → Tope duro del metal base a cortante.
49. **§9-5** — "for structures covered by these codes, **the actual stresses cannot exceed the
    permissible stresses; otherwise the designer is legally liable**. But in general, **codes tend to
    conceal the actual margin of safety**." → El código es obligación legal, pero esconde el margen
    real; por eso el cliente corre los dos métodos.
50. **§9-5 (Tabla 9-6 Sched. B)** — tamaño mínimo de filete por espesor, "**not to exceed the
    thickness of the thinner part**", "**for bridge application does not go below 3/16 in**", "does
    not go above 5/16 in fillet weld for every 3/4 in material". → Tres reglas de tope simultáneas.
51. **§9-7** — "**an as-forged surface should ALWAYS be assumed for weldments** unless a superior
    finish is specified and obtained." → ka de forjado siempre.
52. **§9-8** — "**it is good practice to avoid loading a resistance-welded joint in tension**…
    design so that the spot or seam is loaded in **pure shear**." → El punto de resistencia va a
    cortante puro.
53. **§9-8** — "**Somewhat larger factors of safety should be used** when parts are fastened by spot
    welding rather than by bolts or rivets." → FS más alto en soldadura de punto.
54. **§9-9** — "**Design to place bondline in shear, not peel.** Beware of peel stresses focused at
    bond terminations. When necessary, reduce peel stresses through **tapering the adherend ends,
    increasing bond area** where peel stresses occur, or **utilizing rivets at bond terminations**."
55. **§9-9** — "**Where possible, use adhesives with adequate ductility.**" → La fluencia del
    adhesivo reduce la concentración en los extremos y aumenta la tenacidad.
56. **§9-9** — "**Recognize environmental limitations** of adhesives and surface preparation
    methods" (agua, solventes, UV, agrietamiento por esfuerzo ambiental).
57. **§9-9** — "**Design in a way that permits or facilitates inspections of bonds.** A missing rivet
    or bolt is often easy to detect, but **debonds… are not readily apparent**."
58. **§9-9** — "**Allow for sufficient bond area so that the joint can tolerate some debonding before
    going critical.**" → Zonas de baja tensión deliberadas mejoran durabilidad y detectabilidad.
59. **§9-9** — "**Where possible, bond to multiple surfaces** to offer support to loads in any
    direction." → Pegar a varias caras adyacentes convierte carga arbitraria en cortante.
60. **§9-9** — "Adhesives can be used in conjunction with spot welding… **weld bonding**. The spot
    welds serve to **fixture the bond until it is cured**."

---

# 3. ITERACIONES (dónde el cliente REGRESA y qué la dispara)

| # | Regresa a… | Disparador |
|---|---|---|
| I1 | Recalcular `ld`, `lt`, y por tanto `kb` | El largo del perno L se **redondea hacia arriba** a la lista de existencias (Tabla A-17), y en el Ej. 8-4 pasa de 2.229 → 2.25 in. Cambiar L cambia LT, ld, lt y kb. |
| I2 | Repartir el agarre en más frustos | Al descubrir que el plano medio de la junta **cae dentro de otro material** (Ej. 8-2: 0.0775 in de fundición en el cono superior) → de 2 frustos a 3. |
| I3 | Volver a (8-20) desde Wileman (8-23) | En cuanto la junta deja de ser de UN solo material. |
| I4 | Redondear el **número de pernos** hacia arriba y **recalcular** nL, np, n0 | Ej. 8-4: N = 5.52 → 6, y el nL realizado sube de 2.00 a **2.18**; hay que reportar los factores REALIZADOS, no los pedidos. |
| I5 | Cambiar de criterio de fatiga | Goodman insatisfactorio → Gerber o ASME-elíptica ("**to obtain a less conservative assessment**", §8-11). |
| I6 | Bajar la precarga | Si `Fi > (1 − C) Sut At` la precarga deja de ayudar a la fatiga (8-50). |
| I7 | Más pernos o perno más grande | "If the design is still not satisfactory, **additional bolts and/or a different size bolt may be called for**" (§8-11). |
| I8 | Cambiar el perno a **shoulder bolt** / que la rosca no cruce el corte | Ej. 8-7: con perno estándar de 45 mm, LT = 38 mm deja solo 7 mm de vástago < 15 mm de placa → la rosca queda en el plano de corte → τ salta de 104 a 146 MPa. |
| I9 | Iterar el **tamaño del cordón h** | §9-3: "estimate a probable weld size and then use iteration" cuando el dato dado es τ permisible. |
| I10 | Recalcular `l1, l2` por metal BASE después de calcularlas por metal de APORTE | Ej. 9-3: 2.16 → 2.22 in; **manda el metal base**. Luego redondeo a taller (2 1/4 y 3 1/4). |
| I11 | Rediseñar la PIEZA, no la soldadura | Ej. 9-4: la soldadura pasa (3.39) pero la ménsula no (2.67 < 3.0). |
| I12 | Reformular la geometría de la junta | §9-1: si la junta es rara por falta de acceso, "the design may be a poor one and the designer should begin again". |
| I13 | Mover cordones para eliminar el momento | Ej. 9-3: cordones de longitud desigual para que la resultante pase por el centroide de carga. |

---

# 4. JUICIOS HUMANOS (lo que el software debe PREGUNTAR o defender, no decidir solo)

1. **Grado/clase del perno**: SAE 1..8.2, ASTM (A307/A325/A354/A449/A490), o métrico 4.6..12.9. El
   texto no da un algoritmo; da tablas y contexto (ASTM ≈ estructural con rosca corta; A325 ≈ grado 5).
2. **¿Junta permanente o reusable?** — define `Fi = 0.90 Fp` vs `0.75 Fp` (8-31). Es una decisión de
   MANTENIMIENTO, no de resistencia.
3. **Cuánta precarga** dentro de la ventana 60–90 % de proof: "the higher the preload the better…
   **not enough to create reused fasteners as a future threat**".
4. **Aceptar o no la separación**: elegir n0 objetivo. Si separa, todo P va al perno.
5. **Método de apriete**: elongación medida / llave de torque / impacto / turn-of-the-nut. Depende de
   si el barreno es ciego y de la confiabilidad exigida.
6. **Criterio de fatiga**: Goodman (conservador) vs Gerber vs ASME-elíptica. El Ej. 8-5 muestra que
   la elección **cambia la conclusión sobre el modo de falla dominante**.
7. **Rosca laminada o cortada** (Tabla 8-17 vs Cap. 6): decisión de manufactura con impacto directo
   en Se.
8. **Perno estándar vs shoulder bolt** en juntas a cortante (¿pagas el perno especial o aceptas Ar?).
9. **¿Junta de fricción o de aplastamiento?** El texto lo plantea así: "In a bolted joint, shear is
   taken by **clamping friction, and bearing does not exist**. When bolt preload is lost… all
   participate, and **this is the basis of most bolted-joint analysis if loss of bolt preload is
   complete**." → El diseñador decide si asume pérdida total de precarga (Ej. 8-6 lo hace
   explícitamente: "estimate the static load F that can be carried **if the bolts lose preload**").
10. **Electrodo**: E60xx..E120xx. Regla del cliente: la coincidencia con el metal base "is usually
    **not so important as speed, operator appeal, and appearance**"; y el electrodo suele ser el
    material más fuerte presente.
11. **Método convencional vs código** para soldadura: el código es obligatorio en estructuras
    cubiertas (responsabilidad legal), pero oculta el margen.
12. **Tamaño del filete h**: acotado por abajo por Schedule B (por espesor) y por arriba por el
    espesor de la parte más delgada.
13. **Adhesivo vs soldadura vs sujetador** — y la opción híbrida weld bonding.
14. **α del cono** si el material "no alcanza para que el frusto exista" (el libro no da la regla
    numérica de cuándo: es juicio).

---

# 5. CRITERIOS DE ACEPTACIÓN (checklist antes de dar la unión por buena)

### Junta a tensión con precarga
- [ ] `np = Sp At/(CP + Fi) ≥ 1` — fluencia/proof del perno (8-28). Esperar valores cercanos a 1.
- [ ] `nL = (Sp At − Fi)/(CP) ≥ nd` — factor de sobrecarga (8-29). Reportar el **realizado** tras
      redondear N.
- [ ] `n0 = Fi/(P(1 − C)) ≥ nd` — separación (8-30).
- [ ] `Fm < 0` (queda apriete) — condición de validez de (8-24)/(8-25).
- [ ] Fatiga: `nf` por Goodman (8-45/8-48) y comparar contra `np`; el menor manda el modo de falla.
- [ ] `Fi ≤ (1 − C) Sut At` para que la precarga siga ayudando a la fatiga (8-50).
- [ ] Precarga dentro de 60–90 % de proof.
- [ ] Empaque: presión `p` uniforme (8-33) y espaciamiento `3 ≤ πDb/(Nd) ≤ 6` (8-34).
- [ ] Rondana endurecida bajo la cabeza; runout ≤ 15°; grado de tuerca = grado de perno.

### Junta a cortante (§8-12, lista textual del autor)
- [ ] Aplastamiento en el perno (todos)
- [ ] Aplastamiento en los miembros (todos los barrenos)
- [ ] Cortante del perno (todos, eventualmente)
- [ ] Rosca vs vástago en el plano de corte
- [ ] Desgarre/cortante de borde (pernos de la orilla; ≥ 1.5 d al borde)
- [ ] Fluencia a tensión del miembro **en el área neta**
- [ ] Capacidad del miembro (flexión de la barra en la sección de barrenos)
- [ ] Excéntrica: centroide → primario + secundario vectorial → perno de máxima resultante

### Soldadura
- [ ] τ en la garganta ≤ permisible del **metal de aporte** (0.30 Sut_electrodo, Tabla 9-4; o
      Schedule A de Tabla 9-6).
- [ ] τ en el **metal base** adyacente ≤ **0.40 Sy** del base.
- [ ] σ en el vástago/attachment ≤ **0.60 Sy** (tensión).
- [ ] Flexión del attachment: `n = Sy/σ ≥ nd` (Ej. 9-4 falla aquí).
- [ ] Tamaño de filete ≥ Schedule B por espesor, y ≤ espesor de la parte más delgada.
- [ ] Fatiga: Kfs de Tabla 9-5 (aplicado a base Y aporte), ka de forjado, kb = 1, kc = 0.59.
- [ ] Refuerzo esmerilado si hay fatiga.
- [ ] Correr el cálculo por **los dos** métodos (convencional y código) y ver que concuerden.

---

# 6. TABLAS Y CATÁLOGO DURO (qué existe y qué lo indexa)

| Tabla | Contenido | Indexada por |
|---|---|---|
| 8-1 | Roscas métricas: d, p, At, Ar (paso grueso y fino) | diámetro mayor nominal d (1.6…110 mm) |
| 8-2 | Roscas Unified UNC/UNF: d, N, At, Ar | designación de tamaño (0…1 1/2 in) |
| 8-3 | Pasos preferidos Acme | d (1/4…3 in) |
| 8-4 | Presión de apoyo segura pb en la rosca | par de materiales tornillo/tuerca **+ velocidad** |
| 8-5 | Coef. de fricción f de par roscado | material del tornillo (seco / con aceite / bronce) × material de tuerca |
| 8-6 | Coef. de fricción de collarín | combinación de materiales × **arranque vs marcha** |
| 8-7 | **Procedimiento** para kb (algoritmo, no datos) | configuración (a) perno+tuerca / (b) tornillo roscado en el miembro |
| 8-8 | Constantes A, B de Wileman + E y ν | material del miembro |
| 8-9 | SAE: Sp, Sut, Sy, material, marca de cabeza | grado **× rango de diámetro** |
| 8-10 | ASTM: Sp, Sut, Sy | designación **× rango de diámetro** |
| 8-11 | Clases métricas: Sp, Sut, Sy | clase **× rango M** |
| 8-12 | Ejemplo de kb, km, C | longitud de agarre (2, 3, 4 in) |
| 8-13/8-14 | Dispersión estadística de Fi | lubricado / no lubricado |
| 8-15 | Factor de par K | condición superficial del perno |
| 8-16 | Kf de fatiga | grado SAE/métrico × (laminada / cortada / filete) |
| 8-17 | **Se totalmente corregida** (Kf incluido) | grado o clase × rango de tamaño |
| 9-1 | A, centroide, **Ju** | patrón geométrico del cordón (6 casos) |
| 9-2 | A, centroide, **Iu** | patrón geométrico del cordón (9 casos) |
| 9-3 | Electrodos: Sut, Sy, % elong. | número AWS E60xx…E120xx |
| 9-4 | Esfuerzos permisibles AISC | tipo de carga × tipo de soldadura |
| 9-5 | **Kfs de fatiga en soldadura** | tipo de junta soldada |
| 9-6-A | τ permisible y f = 0.707hτ (kip/in) | nivel del electrodo × tamaño de pierna h |
| 9-6-B | **Tamaño mínimo de filete** | espesor de la parte más gruesa |
| 9-7 | Adhesivos: lap-shear y pelado | química/tipo de adhesivo |
| A-17 | Longitudes preferidas de sujetador | — (lista de existencias) |
| A-29/A-30/A-31/A-32/A-33 | Dimensiones de perno hex, cap screw, tuercas, rondanas | tamaño nominal |

### Valores duros transcritos

**Tabla 8-9 SAE (kpsi)** — grado / rango / Sp / Sut / Sy / material:
- 1 · 1/4–1 1/2 · 33 · 60 · 36 · bajo o medio carbono
- 2 · 1/4–3/4 · 55 · 74 · 57 | 2 · 7/8–1 1/2 · 33 · 60 · 36 · bajo o medio carbono
- 4 · 1/4–1 1/2 · 65 · 115 · 100 · medio carbono estirado en frío
- 5 · 1/4–1 · 85 · 120 · 92 | 5 · 1 1/8–1 1/2 · 74 · 105 · 81 · medio carbono Q&T
- 5.2 · 1/4–1 · 85 · 120 · 92 · martensita bajo carbono Q&T
- 7 · 1/4–1 1/2 · 105 · 133 · 115 · aleado medio carbono Q&T
- 8 · 1/4–1 1/2 · 120 · 150 · 130 · aleado medio carbono Q&T
- 8.2 · 1/4–1 · 120 · 150 · 130 · martensita bajo carbono Q&T
*"Minimum strengths are strengths exceeded by 99 percent of fasteners."*

**Tabla 8-10 ASTM (kpsi)** — A307 1/4–1 1/2 · 33/60/36 · bajo carbono ·
A325 tipos 1/2/3 1/2–1 · 85/120/92 y 1 1/8–1 1/2 · 74/105/81 ·
A354-BC 1/4–2 1/2 · 105/125/109 y 2 3/4–4 · 95/115/99 ·
A354-BD 1/4–4 · 120/150/130 ·
A449 1/4–1 · 85/120/92, 1 1/8–1 1/2 · 74/105/81, 1 3/4–3 · 55/90/58 ·
A490 tipos 1/3 1/2–1 1/2 · 120/150/130.

**Tabla 8-11 Métrica (MPa)** — clase / rango / Sp / Sut / Sy / material:
- 4.6 · M5–M36 · 225 · 400 · 240 · bajo o medio carbono
- 4.8 · M1.6–M16 · 310 · 420 · 340 · bajo o medio carbono
- 5.8 · M5–M24 · 380 · 520 · 420 · bajo o medio carbono
- 8.8 · M16–M36 · 600 · 830 · 660 · medio carbono Q&T
- 9.8 · M1.6–M16 · 650 · 900 · 720 · medio carbono Q&T
- 10.9 · M5–M36 · 830 · 1040 · 940 · martensita bajo carbono Q&T
- 12.9 · M1.6–M36 · 970 · 1220 · 1100 · aleado Q&T

**Tabla 8-8 Wileman** — material / ν / E (GPa, Mpsi) / A / B:
acero 0.291 / 207 / 30.0 / **0.787 15** / **0.628 73** · aluminio 0.334 / 71 / 10.3 / 0.796 70 /
0.638 16 · cobre 0.326 / 119 / 17.3 / 0.795 68 / 0.635 53 · fundición gris 0.211 / 100 / 14.5 /
0.778 71 / 0.616 16 · **expresión general 0.789 52 / 0.629 14**.

**Tabla 8-15 K** — no plateado, acabado negro **0.30** · zincado **0.20** · lubricado **0.18** ·
cadmiado **0.16** · Bowman Anti-Seize **0.12** · tuercas Bowman-Grip **0.09**.

**Tabla 8-16 Kf** — SAE 0–2 / métrico 3.6–5.8: laminada 2.2, cortada 2.8, filete 2.1.
SAE 4–8 / métrico 6.6–10.9: laminada 3.0, cortada 3.8, filete 2.3.

**Tabla 8-17 Se corregida (roscas laminadas)** — SAE 5 (1/4–1 in) 18.6 kpsi; SAE 5 (1 1/8–1 1/2)
16.3; SAE 7 (1/4–1 1/2) 20.6; SAE 8 (1/4–1 1/2) 23.2; ISO 8.8 (M16–M36) 129 MPa; ISO 9.8
(M1.6–M16) 140; ISO 10.9 (M5–M36) 162; ISO 12.9 (M1.6–M36) 190.

**Tabla 8-4 pb segura (psi)** — acero/bronce 2500–3500 (baja velocidad); acero/bronce 1600–2500
(≤10 fpm); acero/fundición 1800–2500 (≤8 fpm); acero/bronce 800–1400 y acero/fundición 600–1000
(20–40 fpm); acero/bronce 150–240 (≥50 fpm).

**Tabla 8-5 f** — acero seco: 0.15–0.25 (tuerca acero), 0.15–0.23 (bronce), 0.15–0.19 (latón),
0.15–0.25 (fundición). Acero con aceite de máquina: 0.11–0.17 / 0.10–0.16 / 0.10–0.15 / 0.11–0.17.
Bronce: 0.08–0.12 / 0.04–0.06 / — / 0.06–0.09.

**Tabla 8-6 fc (marcha / arranque)** — acero suave sobre fundición 0.12/0.17; acero duro sobre
fundición 0.09/0.15; acero suave sobre bronce 0.08/0.10; acero duro sobre bronce 0.06/0.08.

(Tablas 9-1..9-7 ya transcritas arriba en §1.13.)

---

# 7. LAS DIEZ ⭐ (lo que una máquina lineal se salta)

⭐1 — **km NO es una fórmula; es un ENSAMBLE de frustos en serie.** Hay que particionar el agarre
por material Y por el plano medio de la junta, y el diámetro exterior `D` de cada frusto es el que
DEJÓ el frusto anterior (`D = 0.75 + 2(0.595)tan30° = 1.437`), no `1.5d` siempre. En el Ej. 8-2 la
placa de fundición se parte en dos frustos porque el plano medio cae 0.0775 in adentro de ella. Un
implementador lineal programa (8-22) y ya, y se equivoca 36 % (9.378 vs 14.64 Mlbf/in).

⭐2 — **Wileman (8-23) es una TRAMPA si la junta es mixta.** Es la ecuación más fácil de programar y
el libro la pone justo después de la difícil — con la advertencia "the entire joint must be made up
of the same material". Sin ese guard, el software da un número plausible y falso.

⭐3 — **El largo del perno se REDONDEA a existencias y eso re-dispara kb.** `L = 2.229 → 2 1/4 in`
cambia LT, ld, lt. Y la nota al pie de la Tabla 8-7 dice literalmente "check with your bolt
supplier for availability": el catálogo real, no la serie preferida, es la restricción.

⭐4 — **Las roscas no comparten la carga: 0.38 / 0.25 / 0.18 / … / 0 en la 7ª.** La receta del
cliente es meter `0.38F` y `nt = 1` (con ≥6 roscas engranadas). Un implementador reparte F/nt y
subestima el esfuerzo de la primera rosca por un factor ~2.3.

⭐5 — **Sp NO es Sy, y el código especifica Sp, no Sy.** "proof-strength values are specified in
design codes for bolts; **yield strengths are not**". Fallback documentado: `Sp ≈ 0.85 Sy`. Además
el diagrama esfuerzo-deformación del perno no tiene punto de fluencia definido — por eso la
precarga alta NO "gasta" el perno.

⭐6 — **Kf ya viene dentro de Se en la Tabla 8-17** (roscas laminadas). Aplicarlo otra vez como
elevador de esfuerzo es doble castigo. Y si decides aplicarlo a esfuerzos, va a σa **y** a σm, o la
recta de carga pierde su pendiente 1:1 y todas las fórmulas cerradas (8-45..8-47) dejan de valer.

⭐7 — **El perno se dimensiona en el plano de la cara de la tuerca SOLO SI** hay rondana protegiendo
el filete bajo la cabeza **y** el runout tiene semi-cono ≤ 15°. Si no, el punto crítico se mueve.
El dato que lo prueba: 15 % de las fallas bajo la cabeza, 20 % en el runout, **65 % donde el
diseñador puso atención**. "It does little good to concentrate on the plane of the nut washer face
if it is not the weakest location."

⭐8 — **El 0.707h y el "todo es cortante" son conservadurismo DELIBERADO, calibrado.** El análisis
riguroso da τmax = 1.207 F/(hl); el modelo usa 1.414 F/(hl) — 17 % inflado a propósito, porque
"we have no analytical approach that predicts the existing stresses" y las pruebas validaron ESE
número. Igual en flexión: 1.414 vs 1.197/1.207. **Un implementador que "corrija" el modelo hacia el
análisis exacto rompe la calibración experimental.**

⭐9 — **El cordón como línea usa la distancia `d` ENTRE cordones, no `(d + h)`.** El libro reconoce
que (d+h) sería más exacto y da un I mayor… **y lo rechaza**, porque daría menos esfuerzo y
perdería conservadurismo. Es una decisión de ingeniería disfrazada de simplificación geométrica.

⭐10 — **En soldadura casi siempre manda el METAL BASE, no el cordón.** Tres ejemplos consecutivos
lo demuestran: Ej. 9-3 (l1 sube de 2.16 a 2.22 por el base), Ej. 9-4 (la soldadura pasa con 3.39 y
la ménsula falla con 2.67), y la nota al pie de la Tabla 9-4 (τ_base ≤ 0.40 Sy). Bonus: soldar una
barra estirada en frío **le borra las propiedades de CD y la deja en HR** cerca del cordón — la
resistencia del miembro CAMBIA por el hecho de soldarlo.

*(Casi ⭐: en junta a cortante, si la rosca cruza el plano de corte se usa Ar en vez de Ad — 49.7 vs
62.5 kip en el Ej. 8-6, y en el Ej. 8-7 el perno estándar de 45 mm deja solo 7 mm de vástago para
una placa de 15 mm; el software debe DETECTARLO desde LT, no preguntarlo.)*

---

# 8. LO QUE NOS FALTA (contra lo que ya tenemos)

**Ya tenemos**: Fp = At·Sp; longitud de engrane de rosca (FED-STD-H28); Fi = 0.75·At·Sp;
T = 0.2·Fi·d; catálogo DIN de sujetadores; roscas ISO 68-1 procedurales.

**Falta, en orden de dependencia:**

1. **kb** (8-17) y todo el algoritmo de la **Tabla 8-7**: agarre l (2 casos), redondeo de L a
   existencias, LT (8-13/8-14), ld, lt, Ad, At. Sin esto no hay nada más.
2. **km por frustos**: (8-19)/(8-20) por frusto + serie (8-18), con **partición automática del
   agarre por material y por plano medio**, y propagación del diámetro D frusto a frusto. Más
   (8-21)/(8-22) para el caso simétrico y **Wileman (8-23) + Tabla 8-8 con el guard de
   material único**.
3. **C = kb/(kb+km)** y el reparto `Pb = C·P`, `Pm = (1−C)P` (8-24/8-25) con la condición `Fm < 0`.
4. **np (8-28), nL (8-29), n0 (8-30)** — el factor de **separación de junta** no existe hoy.
5. **Fi = 0.90 Fp para juntas PERMANENTES** (solo tenemos el 0.75) y el fallback `Sp = 0.85 Sy`.
6. **K real (8-26)** con λ, α, f, fc + **Tabla 8-15**; hoy tenemos K=0.2 hardcodeado (que el libro
   sí autoriza como default, pero como *default*, no como única opción). Falta también
   `δ = Fi l/(AE)` (control por elongación) y turn-of-the-nut.
7. **Tablas 8-9 / 8-10 / 8-11** (SAE, ASTM, métrica) con Sp/Sut/Sy **indexadas por grado × rango de
   diámetro** — el catálogo DIN que tenemos es dimensional, no de resistencia.
8. **Juntas con empaque**: presión (8-33) y regla de espaciamiento `3 ≤ πDb/(Nd) ≤ 6` (8-34), más el
   caso "empaque blando secuestra km".
9. **Fatiga del perno completa**: σa/σm (8-35..8-41), Goodman/Gerber/ASME-elíptica (8-42..8-47),
   nf con precarga (8-48), cota `Fi ≤ (1−C)Sut At` (8-50), np (8-51), **Tablas 8-16 y 8-17**.
10. **Junta a cortante (§8-12) entera**: los 7 modos de falla (8-52..8-55), la lista de 7
    verificaciones, rosca-vs-vástago en el plano de corte, área neta, distancia al borde 1.5d;
    **patrón excéntrico**: centroide (8-56), cortante primario V/n, secundario (8-57), suma
    vectorial, y la flexión del miembro con `I = Ibar − 2(Ihole + d̄²A)`.
11. **Tornillo de potencia (§8-2) completo**: TR/TL (8-1/8-2/8-5), autobloqueo (8-3), eficiencia
    (8-4), collarín (8-6), esfuerzos de cuerpo y rosca (8-7..8-12) con la corrección 0.38F/nt=1, y
    **Tablas 8-4/8-5/8-6**.
12. **TODO el capítulo 9**: no tenemos nada de soldadura.
    - Símbolos AWS (§9-1) — generación y lectura del símbolo en el plano.
    - Garganta 0.707h, (9-1)(9-2)(9-3).
    - **Cordón como línea**: `J = 0.707 h Ju`, `I = 0.707 h Iu`, τ' = V/A, τ'' = Mr/J, suma
      vectorial — con **Tablas 9-1 (6 patrones) y 9-2 (9 patrones)** como catálogo indexado por
      geometría del cordón, incluyendo centroides y teorema de ejes paralelos para grupos.
    - **Tablas 9-3 (electrodos), 9-4 (AISC), 9-5 (Kfs), 9-6 A y B (cargas permisibles y tamaño
      mínimo de filete por espesor), 9-7 (adhesivos)**.
    - **Doble evaluación** convencional + código, y el check obligatorio del **metal base**
      (τ ≤ 0.40 Sy, σ ≤ 0.60 Sy) además del cordón.
    - Fatiga de soldadura: ka forjado, kb=1, kc=0.59, Kfs, Ssu = 0.67 Sut, Goodman en cortante.
    - Soldadura de resistencia: forzar cortante puro y FS mayor.
    - Adhesivos: Volkersen (9-7) con término térmico, y las 7 guías de diseño de junta.
13. **Transversal**: motor de ITERACIÓN (los 13 puntos de la sección 3) — hoy calculamos en línea
    recta; el proceso del cliente es un lazo con redondeos a existencias y cambios de criterio.
14. **Transversal**: reportar factores **realizados** después de redondear N y h, no los pedidos.
