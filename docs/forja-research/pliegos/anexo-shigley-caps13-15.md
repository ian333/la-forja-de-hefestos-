# Shigley caps. 13–15 leído como ENTREVISTA DE REQUISITOS

**Cliente:** Budynas/Nisbett, *Shigley's Mechanical Engineering Design* (2024). Diseña engranes
a mano desde siempre. Nos contrató para automatizar SU proceso, no para "implementar AGMA".

**Alcance:** cap. 13 (13-1…13-17), cap. 14 (14-1…14-19), cap. 15 (15-1…15-9). NO cap. 16.

**Regla dura de este documento:** todo lo que aparece aquí está en el texto extraído. Donde el
libro remite a una figura/tabla que el OCR no trae como números, lo digo explícitamente:
*"no aparece en el texto extraído"*.

---

## 0. Lo que el cliente NO nos dijo pero se ve en cómo trabaja

Antes de la lista de reglas, tres observaciones de analista:

1. **El cliente no "calcula" un engrane: lo DECIDE y luego lo audita.** Las secciones de diseño
   (§14-19, §15-5, §15-8) no son algoritmos: son *conjuntos de decisiones* partidos en
   **a priori** (lo que le dan / lo que él fija antes de tocar números) y **de diseño**
   (lo que tantea). El software tiene que respetar esa partición o va a sentirse ajeno.
2. **El orden de las decisiones de diseño está ordenado por costo de retrabajo.** §14-19 lo dice
   con todas sus letras: *"The design decisions have been placed in order of importance (impact on
   the amount of work to be redone in iterations)."* → **el paso diametral P es la variable raíz**;
   todo lo demás cuelga de él.
3. **El resultado no es UN diseño, es una FAMILIA.** §14-19: *"Additional designs with diametral
   pitches adjacent to the first satisfactory design will produce several among which to choose.
   A figure of merit is necessary in order to choose the best."* Y admite que la figura de mérito
   es el hueco: *"a figure of merit in gear design is complex in an academic environment because
   material and processing costs vary."* → **hueco de requisito: el costo. Hay que preguntárselo.**

---

# 1. EL PROCESO A MANO

## 1.1 §14-19 — *Design of a Gear Mesh* (rectos y helicoidales) — LA SECUENCIA

### 1.1.1 El conjunto de decisiones, tal como él lo parte

**Decisiones A PRIORI** (entradas; no se tantean):
- **Function**: load, speed, reliability, life, Ko
- **Unquantifiable risk**: design factors o safety factors
- **Tooth system**: ϕ, ψ, addendum, dedendum, root fillet radius
- **Gear ratio** mG, NP, NG
- **Quality number** Qv

**Decisiones DE DISEÑO** (lo que tantea, en este orden):
1. **Diametral pitch P**
2. **Face width F**
3. **Pinion material, core hardness, case hardness**
4. **Gear material, core hardness, case hardness**

Comentario textual del cliente: *"There are four design decision categories, eight different
decisions if you count them separately. This is a larger number than we often encounter."*
→ ES. "Son cuatro categorías de decisión de diseño, ocho decisiones distintas si las cuentas por
separado. Es un número más grande del que solemos encontrar."

### 1.1.2 El plan de 4 pasos (literal)

> 1. Choose a diametral pitch.
> 2. Examine implications on face width, pitch diameters, and material properties. If not
>    satisfactory, return to pitch decision for change.
> 3. Choose a pinion material and examine core and case hardness requirements. If not
>    satisfactory, return to pitch decision and iterate until no decisions are changed.
> 4. Choose a gear material and examine core and case hardness requirements. If not
>    satisfactory, return to pitch decision and iterate until no decisions are changed.

ES: 1) Escoge un paso diametral. 2) Examina las implicaciones en ancho de cara, diámetros de paso
y propiedades del material. Si no te satisface, **regresa a la decisión de paso** y cámbiala.
3) Escoge material del piñón y examina los requisitos de dureza de núcleo y de capa. Si no te
satisface, regresa al paso e itera **hasta que ninguna decisión cambie**. 4) Igual para el engrane.

**Nota de requisitos:** el criterio de paro NO es "converge un número"; es
*"iterate until no decisions are changed"* → **punto fijo sobre el vector de DECISIONES**, no sobre
los esfuerzos. Eso es un lazo de punto fijo discreto y hay que implementarlo así.

### 1.1.3 El detalle fino, en cuatro bloques (literal)

**First select a trial diametral pitch.**

**Pinion bending:**
- Select a median face width for this pitch, **F = 4π/P**
- Find the range of necessary ultimate strengths
- Choose a material and a core hardness
- Find face width to meet factor of safety in bending
- **If face width is not in the readily available range, select a new diametral pitch and iterate**
- Check factor of safety in bending

**Gear bending:**
- Find necessary companion core hardness
- Choose a material and core hardness
- Check factor of safety in bending

**Pinion wear:**
- Find necessary Sc and attendant case hardness
- Choose a case hardness
- Check factor of safety in wear

**Gear wear:**
- Find companion case hardness
- Choose a case hardness
- Check factor of safety in wear

→ **Cuatro chequeos, no dos.** (nb)P, (nb)G, (nc)P, (nc)G. El engrane se acepta con los cuatro.

### 1.1.4 Lo que hace el cliente cuando los cuatro no salen iguales (§14-19, cierre)

> "one might entertain the notion of setting all factors of safety equal. In steel gears, wear is
> usually controlling and (nc)P and (nc)G can be brought close to equality. The use of softer cores
> can bring down (nb)P and (nb)G, but there is value in keeping them higher. A tooth broken by
> bending fatigue not only can destroy the gearset, but can bend shafts, damage bearings, and
> produce inertial stresses up- and downstream in the power train, causing damage elsewhere if the
> gear box locks."

ES: "Uno podría pensar en igualar todos los factores de seguridad. En engranes de acero **el
desgaste suele ser el que manda** y (nc)P y (nc)G se pueden acercar a la igualdad. Usar núcleos más
blandos baja (nb)P y (nb)G, pero **tiene valor mantenerlos más altos**: un diente roto por fatiga de
flexión no nada más destruye el engranaje — puede doblar flechas, dañar rodamientos y producir
esfuerzos inerciales aguas arriba y aguas abajo del tren de potencia, causando daño en otro lado si
la caja se traba."

→ **REQUISITO ASIMÉTRICO**: no optimices igualando los cuatro FS. Flexión se deja con holgura a
propósito porque su modo de falla es catastrófico y propagante. Esto es criterio de ingeniero, no
de ecuación.

### 1.1.5 La secuencia REAL como se ejecuta (reconstruida del Ejemplo 14-8, 100 hp / 1120 rpm / 4:1)

Orden literal de ejecución del ejemplo:

1. **A priori**: función (100 hp, 1120 rev/min, R = 0.95, N = 10⁹ ciclos); tooth system ϕn = 20°;
   **conteo de dientes NP = 18, NG = 72 — justificado por "no interference, Sec. 13-7"**;
   Qv = 6; grade 1; **supone mB ≥ 1.2 → KB = 1** (y lo verifica hasta el final).
2. **Ko** de Table 14-9 (carga uniforme, motor uniforme) → Ko = 1.
3. **Política de factores**: *"We choose to set AGMA design factors to unity and handle the overall
   unquantifiable exigencies (including company policy regarding risk and consequences of failure)
   in the overall factors of safety."* → SF = SH = 1, metas nb = 2, nc = 1.4.
4. **Paso de prueba P = 4** → dP = 4.5 in, dG = 18 in. Saca YP, YG (Table 14-2) y JP, JG (Fig 14-6).
5. **Cinemática/carga**: V = πdPnP/12 = 1319 ft/min; Wt = 33000H/V = 2502 lbf.
6. **Kv** por Qv (B, A, eq 14-27) → 1.480.
7. **KR** por R (eq 14-38) → 0.885.
8. **YN, ZN** para piñón Y ENGRANE POR SEPARADO: (YN)P con N=10⁹, (YN)G con N=10⁹/mG.
9. **F de arranque**: *"From the recommendation for usual commercial availability, 3p ≤ F ≤ 5p.
   The midrange is F = 4p = 4π/P = 3.14 in. Try F = 3.0 in."*
10. **Ks** (eq 14-29, depende de F y de Y) → 1.137.
11. **Km**: Cmc, Cpm, Ce = 1; Cma = 0.175 (Fig 14-11, commercial enclosed); Cpf de F/(10dP) → Km = 1.242.
12. **Cp** = 2300 √psi (Table 14-8). **I** por eq 14-23 con mN = 1.
13. **Flexión del piñón** → σb = 21 788 psi → aplica la meta nb = 2 → σb,all requerido → despeja
    **St necesario = 41 114 psi**.
14. **Elige material y dureza**: Nitralloy 135M, rango Rockwell C32–36 (302–335 HB) de Table 14-5;
    *"Choosing a midrange hardness as attainable, use 320 Brinell"* → Fig 14-4 → St = 40 310 psi.
15. **← AQUÍ REGRESA.** *"This is a little low. We could increase the hardness to obtain higher
    strength. But another option is to go back and increase the face width, staying within the
    recommended range. Select F = 3.5 in."* → **recalcula Ks Y Km** (los dos dependen de F) y
    reevalúa σb → 19 100 psi → (nb)P = 2.24 ✔
16. **Flexión del engrane**: *"Use cast gear blank because of the 18-in pitch diameter. Use the same
    material, heat treatment, and nitriding. The only change is in J"* → (σb)G = (σb)P·JP/JG →
    (nb)G = 2.97. → *"This is more than needed. We have the option of reducing the strength of the
    gear material. **But we will proceed first to check the suitability of the current material
    choice for surface failure.**"*
17. **Desgaste del piñón**: σc = 118 000 psi; Sc = 170 000 (Table 14-6, Nitralloy 135M) → (nc)P = 1.47.
18. **Desgaste del engrane**: misma dureza → CH = 1 → (nc)G = 1.51.
19. **Veredicto + plan B**: *"The factors for wear, particularly for the pinion, are only marginally
    above the goal of 1.4. If it had been too low, we have several choices for adjustment, including
    increasing the surface hardness, choosing a different material, or increasing the tooth size and
    face width. Since the bending factors of safety are satisfactory, **increasing the surface
    hardness is potentially a good choice since it primarily helps the surface strength**."*
20. **Decisión explícita de NO usar nc,linear**, con justificación (ver §4.3 de este documento).
21. **Chequeo de rin, hasta el final**: ht = 2.25/P = 0.5625 in; tR ≥ 1.2(0.5625) = 0.675 in.
    *"In the design of the gear blank, be sure the rim thickness exceeds 0.675 in; **if it does not,
    review and modify this mesh design**."*

---

## 1.2 §15-5 — *Design of a Straight-Bevel Gear Mesh* — LA SECUENCIA

### 1.2.1 Conjunto de decisiones (literal)

**A priori:**
- Function: power, speed, mG, R
- Design factor: nd
- Tooth system
- Tooth count: NP, NG

**Design decisions:**
- Pitch and face width: **Pd, F**
- Quality number: **Qv**
- Gear material, core and case hardness
- Pinion material, core and case hardness

### 1.2.2 Los tres avisos que da antes de empezar (literal, §15-5)

> "In bevel gears **the quality number is linked to the wear strength**. **The J factor for the gear
> can be smaller than for the pinion.** **Bending strength is not linear with face width**, because
> added material is placed at the small end of the teeth. Consequently, face width is roughly
> prescribed as F = min(0.3A0, 10/Pd)"  (Eq. 15-24)

con A0 = dP/(2 sin γ) = dG/(2 sin Γ)  (Eq. 15-25)

ES: En cónicos, **el número de calidad está ligado a la resistencia al desgaste** (por eso Qv sube a
decisión de diseño y no queda a priori). **El factor J del engrane puede ser MENOR que el del
piñón** (¡al revés que en rectos!). **La resistencia a flexión no es lineal con el ancho de cara**,
porque el material que agregas se va al extremo chico del diente. Por eso el ancho de cara se
prescribe a bulto como el mínimo entre 0.3·A0 y 10/Pd.

### 1.2.3 La secuencia REAL (Ejemplo 15-2, 6.85 hp / 900 rpm / 3:1 / 300 °F / R = 0.995 / 10⁹)

Orden literal, con las decisiones NUMERADAS por el propio cliente:

1. **A priori y sus consecuencias inmediatas**: mG = 3, 300 °F, *"neither gear straddle-mounted"* →
   **Kmb = 1.25**; R = 0.995 a 10⁹ rev del piñón →
   (CL)G = 3.4822(10⁹/3)^−0.0602 = 1.068, (CL)P = 1;
   (KL)G = 1.683(10⁹/3)^−0.0323 = 0.8929, (KL)P = 0.8618;
   KR = 0.50 − 0.25 log(1−0.995) = 1.075, CR = √KR = 1.037;
   KT = CT = (460+300)/710 = 1.070.
2. **Factor de diseño**: nd = 2 → **SF = 2, SH = √2 = 1.414**. ← *(la raíz: ver ⭐2)*
3. **Tooth system**: coronado (crowned), ϕn = 20° → Kx = 1 (eq 15-13), Cxc = 1.5 (eq 15-12).
4. **Ángulos de cono**: γ = tan⁻¹(NP/NG) = 18.43°, Γ = tan⁻¹(NG/NP) = 71.57°.
   I = 0.0825 (Fig 15-6), JP = 0.248, JG = 0.202 (Fig 15-7). *"Note that JP > JG."*
5. **Decision 1: paso diametral de prueba Pd = 8** → Ks = 0.4867 + 0.2132/8 = 0.5134;
   dP = 2.5 in, dG = 7.5 in; vt = 589.0 ft/min; Wt = 383.8 lbf;
   A0 = 3.954 in; **F = min(0.3·3.954, 10/8) = min(1.186, 1.25) = 1.186 in**.
6. **Decision 2: F = 1.25 in** (redondea hacia arriba desde 1.186) → Cs = 0.125(1.25)+0.4375 = 0.5937;
   Km = 1.25 + 0.0036(1.25)² = 1.256.
7. **Decision 3: Qv = 6** → B = 0.8255, A = 59.77, Kv = 1.325.
8. **Decision 4: material y tratamiento** — *"Carburize and case-harden grade ASTM 1320 to Core 21
   HRC (HB is 229 Brinell), Case 55-64 HRC (HB is 515 Brinell)"* → Table 15-4: sac = 200 000 psi;
   Table 15-6: sat = 30 000 psi.
9. **Flexión del ENGRANE primero** (no del piñón): (st)G = 10 390 psi; (swt)G = 11 640 psi →
   razón 1.12 → **(SF)G = 2(1.12) = 2.24**.
10. **Flexión del piñón**: (st)P = (st)G·JG/JP = 8463 psi; (swt)P = 11 240 → (SF)P = 2.66.
11. **Desgaste** (mismo sc para ambos): sc = 107 560 psi; (swc)G = 136 120 → razón 1.266 →
    **(SH)²G = 1.266²(2) = 3.21**; (swc)P = 127 450 → (SH)²P = 2.81.
12. **Veredicto**: *"The actual factors of safety are 2.24, 2.66, 3.21, and 2.81. Making a direct
    comparison of the factors, we note that **the primary threat is from gear bending**. We also note
    that the other three factors of safety are considerably higher than the target design factor.
    **If optimization is desired, our goal would be to make changes in the design decisions that
    drive the factors closer to 2.**"*

**Observación de requisitos:** en cónicos el cliente reporta los cuatro factores **ya elevados al
cuadrado en desgaste** para poderlos comparar de frente con los de flexión. Eso es un cambio de
convención respecto al cap. 14 y hay que modelarlo explícitamente.

---

## 1.3 §15-8 — *Designing a Worm-Gear Mesh* — LA SECUENCIA

### 1.3.1 Conjunto de decisiones (literal)

**A priori:**
- Function: power, speed, mG, **Ka**
- Design factor: **nd**
- Tooth system
- Materials and processes

**Design decisions:**
- Number of threads on the worm: **NW**
- Axial pitch of worm: **px**
- Pitch diameter of the worm: **dW**
- Face width of gear: **FG**
- **Lateral area of case: A**   ← el área de la caja es DECISIÓN DE DISEÑO, no consecuencia

### 1.3.2 Contexto que el cliente da antes de arrancar (literal, §15-8)

- *"Reliability information for worm gearing is not well developed at this time."* → **no hay factor
  de confiabilidad en sinfín.** Usar eq (15-28) con Cs, Cm, Cv, sinfín de acero aleado cementado y
  materiales no ferrosos usuales *"will result in lives in excess of 25 000 h."*
- Materiales del engrane sinfín (la base de experiencia son bronces):
  - Tin- y nickel-bronzes (**el colado en coquilla / chilled produce las superficies más duras**)
  - Lead-bronze (aplicaciones de alta velocidad)
  - Aluminum- y silicon-bronze (carga pesada, baja velocidad)
  - *"The factor Cs for bronze in the spectrum sand-cast, chilled-cast, and centrifugally cast
    increases in the same order."*
- *"Standardization of tooth systems is not as far along as it is in other types of gearing. For the
  designer this represents freedom of action, but acquisition of tooling for tooth-forming is more
  of a problem for in-house manufacturing. When using a subcontractor the designer must be aware of
  what the supplier is capable of providing with on-hand tooling."*
  → **REQUISITO: el catálogo de herramental disponible es una restricción de primera clase.**
- Pasos axiales usuales: **1/4, 5/16, 3/8, 1/2, 3/4, 1, 5/4, 6/4, 7/4, y 2** *"but others are possible"*.
- *"Teeth frequently are stubbed when lead angles are 30° or larger."*
- *"Worm-gear design is constrained by available tooling, space restrictions, shaft center-to-center
  distances, gear ratios needed, and the designer's experience."*
- Ángulos de presión normales a escoger (ANSI/AGMA 6022-C93): **14.5°, 17.5°, 20°, 22.5°, 25°,
  27.5°, 30°**. Número de hilos del sinfín: **1 a 10**.

### 1.3.3 El procedimiento aritmético que él enuncia (literal)

> "A design decision is the axial pitch of the worm. Since acceptable proportions are couched in
> terms of the center-to-center distance, **which is not yet known**, one chooses a trial axial
> pitch px. Having NW and a trial worm diameter d,
>   NG = mG·NW,  Pt = π/px,  D = NG/Pt
> Then (d)lo = C^0.875/3, (d)hi = C^0.875/1.6.
> Examine (d)lo ≤ d ≤ (d)hi, and **refine the selection of mean worm-pitch diameter to d1 if
> necessary. Recompute the center-to-center distance as C = (d1 + D)/2. There is even an opportunity
> to make C a round number.** Choose C and set d2 = 2C − D."

→ Es un **lazo implícito**: d depende de C y C depende de d. El cliente lo resuelve tanteando y
**aprovecha la libertad para dejar C en número redondo** (criterio de manufactura/ensamble, no de
resistencia).

### 1.3.4 La secuencia REAL (Ejemplo 15-4, 10 hp, 11:1, planeadora de aserradero, 1720 rpm, 70 °F)

1. **Function**: H0 = 10 hp, mG = 11, nW = 1720 rev/min, Ka = 1.25 (motor jaula de ardilla),
   uso 3–10 h diarias.
2. **Design factor: nd = 1.2.**
3. **Materials and processes**: sinfín de acero aleado cementado, engrane de bronce colado en arena.
4. **Worm threads**: doble, NW = 2 → NG = 11(2) = **22 dientes, aceptable para ϕn = 20° según
   Table 15-10** (mínimo 21).
5. **Decision 1: px = 1.5 in** → Pt = 2.0944, D = 10.504 in; a = 0.4775, b = 0.5525, ht = 1.030 in.
6. **Decision 2: d = 2.000 in** → C = 6.252 → (d)lo = 1.657, (d)hi = 3.107 → *"which is
   satisfactory. **Try d = 2.500 in.** Recompute C: C = 6.502. The range is now 1.715 ≤ d ≤ 3.216,
   which is still satisfactory. **Decision: d = 2.500 in.**"*
   → **Escoge el diámetro más grande dentro de la ventana**, no el que primero cumple.
7. L = pxNW = 3.000 in; λ = tan⁻¹[L/(πd)] = 20.905° → *"(from Table 15-9 lead angle OK)"*
   (máx. 25° para ϕn = 20°).
8. Velocidades: Vs = 1205.1 ft/min, VW = 1125.7, VG = 430.0 ft/min.
9. Factores: Cs = 1190 − 477 log 10.504 = 702.8 (sand-cast, C>3, Dm>2.5);
   Cm = 0.772; Cv = 13.31(1205.1)^−0.571 = 0.232; f = 0.0191.
10. Eficiencia: eW = 0.942 *(y anota: "(If the worm gear drives, eG = 0.939.)")*.
11. **Carga**: W^t_G = 33 000·nd·H0·Ka/(VG·e) = 1222 lbf → luego W^t_W = 495.4 lbf (eq 15-57).
    → **OJO: aquí nd multiplica la CARGA.**
12. HW = 16.9 hp, HG = 15.92 hp, Wf = −26.8 lbf, Hf = 0.979 hp.
13. **Ancho de cara requerido**: (Fe)req = W^t_G/(Cs·D^0.8·Cm·Cv) = 1.479 in.
14. **Decision 3**: *"The available range of (Fe)G is 1.479 ≤ (Fe)G ≤ 2d/3 or 1.479 ≤ (Fe)G ≤ 1.667
    in. Set (Fe)G = 1.5 in."* → W^t_all = 1239 lbf > 1222 lbf →
    *"There is a little excess capacity. The force analysis stands."*
15. **Decision 4: térmica.** ħCR = nW/6494 + 0.13 = 0.395; Hloss = 32 347 ft·lbf/min;
    Amin AGMA = 43.2C^1.7 = 1041.5 in²; **estimación cruda del área real de la caja con 6 in de
    holgura** → ≈1090 in² → *"Expect an area of 1100 in²."*
    ts = 70 + 32 350/(0.395·1100) = **144.5 °F** → *"Lubricant is safe with some margin for smaller
    area."*
16. **Chequeo de flexión, "for reference"**: σ = W^t_G/(pn·Fe·y) = 4652 psi, con y = 0.125 (ϕn = 20°).
    *"The risk is from wear, which is addressed by the AGMA method."*
    → **En sinfín la flexión es un chequeo secundario, informativo.**
17. (§15-9, Ejemplo 15-5) **Contraste con Buckingham**: (W^t_G)all = Kw·dG·Fe = 80(10.504)(1.5) =
    1260 lbf, *"which is larger than the 1239 lbf of the AGMA method. The method of Buckingham does
    not have refinements of the AGMA method."*

---

# 2. REGLAS PRESCRIPTIVAS EN PROSA (el oro)

> Formato: **§** — *"frase en inglés"* → traducción / implicación.

## 2.1 Selección de tipo de engrane

- **§13-1** — *"Helical gears can be used for the same applications as spur gears and, when so used,
  are not as noisy, because of the more gradual engagement of the teeth during meshing. The inclined
  tooth also develops thrust loads and bending couples, which are not present with spur gearing."*
  → Helicoidal = menos ruido, pero **paga con carga axial y pares de flexión** que el recto no tiene.
- **§13-1** — *"Worm gearsets are mostly used when the speed ratios of the two shafts are quite high,
  say, 3 or more."*
  → Sinfín cuando la razón es alta, digamos **3 o más**.
- **§13-10** — *"When the thrust loads become high or are objectionable for other reasons, it may be
  desirable to use double helical gears (herringbone)... They develop opposite thrust reactions and
  thus cancel out the thrust load."*
- **§13-10** — *"When two or more single helical gears are mounted on the same shaft, **the hand of
  the gears should be selected so as to produce the minimum thrust load**."*
- **§15-1** — *"[Straight bevel gears] are usually used for pitch-line velocities up to 1000 ft/min
  (5 m/s) when the noise level is not an important consideration. They are available in many stock
  sizes and are **less expensive to produce than other bevel gears, especially in small
  quantities**."*
- **§15-1** — *"[Spiral bevel gears] are recommended for higher speeds and where the noise level is
  an important consideration."*
- **§15-1** — *"[Zerol] For design purposes, use the same procedure as for straight bevel gears and
  then simply substitute a Zerol bevel gear."*

## 2.2 Geometría del diente / interferencia

- **§13-5** — *"The pressure angle usually has values of 20° or 25°, although 14½° was once used."*
- **§13-6** — *"**Gears should not generally be designed having contact ratios less than about
  1.20**, because inaccuracies in mounting might reduce the contact ratio even more, increasing the
  possibility of impact between the teeth as well as an increase in the noise level."*
  → Relación de contacto mínima **1.20**, con el porqué: el montaje real la baja todavía más.
- **§14-1** — *"the contact ratio should be somewhat greater than unity, **say about 1.5, to achieve
  a quality gearset**."*
  → Ojo: **dos números distintos** en dos capítulos. 1.20 = mínimo absoluto; ~1.5 = "engranaje de
  calidad". Hay que implementar ambos como umbrales separados (warn vs fail).
- **§13-7** — *"Thus 13 teeth on pinion and gear are interference-free... **13 is the lowest
  practical number of teeth for a pinion to avoid interference**"* (20°, k=1, razón 1:1; el cálculo
  da 12.3 y se redondea a 13 *"for fully rotating gears"*).
- **§13-7** — *"For a 14½° pressure angle, NP = 23 teeth, so one can appreciate why few 14½°-tooth
  systems are used."*
- **§13-7** — *"...**it is generally recommended to limit the gear ratio for a pair of gears to no
  more than 10 to 1**. If fewer than 13 teeth are attempted for the minimum, the maximum number of
  teeth calculated from Equation (13-12) is less than the minimum, which is practically
  meaningless."*
  → Y por eso 17 es la última fila útil de Table 13-1.
- **§13-7 (tabla 13-1, 20°)** — el número mínimo de dientes del piñón depende de la RAZÓN:

  | NP mín | Max NG (calc) | Max NG entero | Max mG |
  |---|---|---|---|
  | 13 | 16.45 | 16 | 1.23 |
  | 14 | 26.12 | 26 | 1.86 |
  | 15 | 45.49 | 45 | 3 |
  | 16 | 101.07 | 101 | 6.31 |
  | 17 | 1309.86 | 1309 | 77 |

  Uso literal: *"use column four to find the gear ratio that just exceeds the desired gear ratio.
  From that row, in column one obtain the minimum number of teeth for the pinion."*
- **§13-7 (tabla 13-2, 25°)**: NP=9 → max NG 13 (mG 1.44); NP=10 → 32 (3.2); NP=11 → 249 (22.64).
- **§13-7** — *"The standard pressure angle of **20° is the accepted compromise for most designs**.
  The 25° pressure angle is used when the design warrants more emphasis on the small size."*
  Y el trade-off explícito: *"the practical advantage of increasing the pressure angle is smaller
  package size for the gear train. **The practical tradeoff is the need for larger bearings and
  larger shafts**."*
- **§13-7** — Piñón contra cremallera: NP = 2k/sin²ϕ; para 20° full-depth = 17.1 → **18 dientes**.
  Y: *"Since gear-shaping tools amount to contact with a rack, and the gear-hobbing process is
  similar, the minimum number of teeth to prevent interference **to prevent undercutting by the
  hobbing process** is equal to the value of NP when NG is infinite."*
  → **El proceso de fabricación cambia el mínimo de dientes.** 13 (par 1:1) vs 18 (fresado con hob).
- **§13-7** — *"if undercutting is at all pronounced, **the undercut tooth is considerably
  weakened**. Thus the effect of eliminating interference by a generation process is merely to
  substitute another problem for the original one."*
- **§13-9** — *"Standard straight-tooth bevel gears are cut by using a 20° pressure angle,
  **unequal addenda and dedenda**, and full-depth teeth. This increases the contact ratio, avoids
  undercut, and increases the strength of the pinion."*
  → Los cónicos NO usan addendum igual en ambos miembros.
- **§13-9** — *"It should be noted that the clearance is uniform"* (en cónicos).

## 2.3 Sistemas de dientes estándar (§13-12)

- Table 13-3 (rectos): **Full depth** ϕ = 20°, 22½°, 25° → a = 1/P (o m); b = 1.25/P **o** 1.35/P.
  **Stub** ϕ = 20° → a = 0.8/P; b = 1/P.
  El 14½° *"was once used for these but is now obsolete; the resulting gears had to be comparatively
  larger to avoid interference problems."*
- Table 13-4 — *"particularly useful in selecting the pitch or module of a gear. **Cutters are
  generally available for the sizes shown in this table**."*
  - **Diametral pitch grueso**: 2, 2¼, 2½, 3, 4, 6, 8, 10, 12, 16
  - **Diametral pitch fino**: 20, 24, 32, 40, 48, 64, 80, 96, 120, 150, 200
  - **Módulo preferido**: 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25, 32, 40, 50
  - **Módulo segunda opción**: 1.125, 1.375, 1.75, 2.25, 2.75, 3.5, 4.5, 5.5, 7, 9, 11, 14, 18, 22,
    28, 36, 45
  → **REQUISITO: P y m no son continuos. Se escogen de una lista de herramental.**
- Table 13-5 (cónicos rectos 20°): hk = 2.0/P; c = (0.188/P) + 0.002 in;
  aG = 0.54/P + 0.4602/(P·m90); m90 = mG si Γ=90°, si no m90 = mG√(cos γ/cos Γ);
  **F = 0.3A0 o F = 10/P, el que sea MENOR**;
  **mínimo de dientes (piñón/engrane): 16/16, 15/17, 14/20, 13/30.**
- Table 13-6 (helicoidales): proporciones basadas en el ángulo de presión NORMAL.
- **§13-12** — *"Though there will be exceptions, **the face width of helical gears should be at
  least 2 times the axial pitch** to obtain good helical-gear action."*
- **§13-12 / Table 13-7 (sinfín)** — *"Tooth forms for worm gearing have not been highly
  standardized... The pressure angles used depend upon the lead angles and **must be large enough to
  avoid undercutting of the worm-gear tooth on the side at which contact ends**... Table 13-7
  summarizes what may be regarded as **good practice** for pressure angle and tooth depth."*

  | Lead angle λ | ϕn | a | bG |
  |---|---|---|---|
  | 0–15° | 14½° | 0.3683px | 0.3683px |
  | 15–30° | 20° | 0.3683px | 0.3683px |
  | 30–35° | 25° | 0.2865px | 0.3314px |
  | 35–40° | 25° | 0.2546px | 0.2947px |
  | 40–45° | 30° | 0.2228px | 0.2578px |

- **§13-12** — *"The face width FG of the worm gear **should be made equal to the length of a tangent
  to the worm pitch circle between its points of intersection with the addendum circle**"* (Fig 13-21).
- **§13-11** — *"the worm may have any pitch diameter; **this diameter should, however, be the same
  as the pitch diameter of the hob used to cut the worm-gear teeth**. Generally, the pitch diameter
  of the worm should be selected so as to fall into the range **C^0.875/3.0 ≤ dW ≤ C^0.875/1.7**
  (Eq. 13-26)... These proportions appear to result in optimum horsepower capacity of the gearset."*
  ⚠ **Compárese con §15-6 Eq. (15-27): C^0.875/3 ≤ d ≤ C^0.875/1.6.** El límite superior NO coincide
  entre los dos capítulos. Ver ⭐4.

## 2.4 Ancho de cara

- **§13-2** — *"Face width F is the thickness of the tooth. In general, **gear manufacturers will
  provide a few options for face width in the range of three to five times the circular pitch**."*
- **§14-1** — *"**As a general rule, spur gears should have a face width F from three to five times
  the circular pitch p**."*
- **Fig 14-17 (road map)** — *"Face width; Typically, 3π/P < F < 5π/P"*.
- **§14-19** — *"Select a median face width for this pitch, **F = 4π/P**"*, y
  *"**If face width is not in the readily available range, select a new diametral pitch and
  iterate**."*
- **§15-2** — *"Because of this varying load across the face of the tooth, **it is desirable to have
  a fairly short face width**"* (cónicos).
- **§15-5 Eq. (15-24)** — cónicos: **F = min(0.3A0, 10/Pd)**.
- **§15-6** — sinfín: Fe = *"actual face width, but **not to exceed 0.67 dm**, the mean worm
  diameter"*; y Eq. (15-48): FG = 2dm/3 si px > 0.16 in.
- **§14-11** — el procedimiento de Km sólo aplica si **F/dP ≤ 2** y **F ≤ 40 in**.

## 2.5 Trenes de engranes (§13-13)

- *"**As a rough guideline, a train value of up to 10 to 1 can be obtained with one pair of gears.**
  Greater ratios can be obtained in less space and with fewer dynamic problems by compounding
  additional pairs of gears. **A two-stage compound gear train... can obtain a train value of up to
  100 to 1.**"*
- *"Since numbers of teeth on gears must be integers, **it is better to determine them first, and
  then obtain pitch diameters second**."*
- *"Determine the number of stages necessary to obtain the overall ratio, then divide the overall
  ratio into portions to be accomplished in each stage. **To minimize package size, keep the portions
  as evenly divided between the stages as possible.**"*
- *"In cases where the overall train value need only be approximated, each stage can be identical...
  assign the square root of the overall train value to each stage. **If an exact train value is
  needed, attempt to factor the overall train value into integer components for each stage.**"*
- *"Then **assign the smallest gear(s) to the minimum number of teeth allowed for the specific ratio
  of each stage**, in order to avoid interference (see Section 13-7). Finally... Round to the nearest
  integer and **check that the resulting overall ratio is within acceptable tolerance**."*
- Signo del train value: *"count the number of meshes. If the number is odd, then e is negative...
  **Do not count the mesh when a mesh involves an internal gear**."*
- **Reverted (entrada y salida alineadas)**: restricción exacta **N2 + N3 = N4 + N5** (mismo P en
  ambas etapas). *"This condition must be **exactly** satisfied."* Y en el Ejemplo 13-5, la
  heurística: *"Of the two smaller gears, N3 and N5, **the free choice should be used to minimize N3
  since a greater gear ratio is to be achieved in this stage**."*
  Si no salen enteros: *"This can be done by trial and error, letting N3 = 17, then 18, etc., until
  it works. Or, the problem can be **normalized** to quickly determine the minimum free choice."*
- Planetarios: *"Planetary gear trains are unusual mechanisms because **they have two degrees of
  freedom; that is, for constrained motion, a planetary train must have two inputs**."*
  e = (nL − nA)/(nF − nA)  (Eq. 13-32).

## 2.6 Fabricación y acabado (§13-8) — importa porque alimenta Qv, Cf y el finish fP

- *"Gears that carry large loads in comparison with their size are usually made of steel and are cut
  with either form cutters or generating cutters."*
- Fresado con cortador de forma: *"it has been found that **eight cutters may be used to cut with
  reasonable accuracy any gear in the range of 12 teeth to a rack**. A separate set of cutters is,
  of course, required for each pitch."*
- Cold rolling: *"**The mechanical properties of the metal are greatly improved by the rolling
  process**, and a high-quality generated profile is obtained at the same time."*
- Termoplásticos (nylon, policarbonato, acetal) por inyección: *"of low to moderate precision, low in
  cost for high production quantities, and **capable of light loads, and can run without
  lubrication**."*
- Acabado: *"Gears that run at high speeds and transmit large forces may be subjected to additional
  dynamic forces if there are errors in tooth profiles."* Shaving → *"within the limits of 250 μin"*.
  Burnishing → sólo antes del tratamiento térmico. Grinding y lapping → **después** del temple.

## 2.7 Reglas de resistencia / material

- **§14-4** — *"These values [St, Sc] are based on **10 million stress cycles, unidirectional
  loading, and 99 percent reliability** of material strength. These values are suitable for
  determining achievable strengths for design purposes, **but manufacturer data should be obtained
  for the specific gears to be purchased**."*
- **§14-4** — *"Since gear strengths are not identified with other strengths such as Sut, Se, or Sy
  as used elsewhere in this book, **their use should be restricted to gear problems**."*
- **§14-4** — *"**When two-way (reversed) loading occurs, as with idler gears, AGMA recommends using
  70 percent of St values.** This is equivalent to 1/0.70 = 1.43 as a value of kf... The
  recommendation falls between the value of kf = 1.33 for a Goodman failure locus and kf = 1.66 for
  a Gerber failure locus."*
  (**§15-3** repite lo mismo para cónicos: *"AGMA recommends use of 70 percent of allowable strength
  in cases where tooth load is completely reversed, as in idler gears and reversing mechanisms."*)
- **Tablas 14-4 y 14-7 (hierros y bronces), nota 3** — *"**The lower values should be used for
  general design purposes.** The upper values may be used when: High quality material is used.
  Section size and design allow maximum response to heat treatment. Proper quality control is
  effected by adequate inspection. **Operating experience justifies their use**."*
  → Un rango con cuatro condiciones cualitativas para poder subir. Puro juicio.
- **Table 14-3, nota 7 / Table 15-6, nota ‡** — *"**The overload capacity of nitrided gears is low.**
  Since the shape of the effective S-N curve is flat, **the sensitivity to shock should be
  investigated before proceeding with the design**."*
- **Table 14-3, nota 3** — *"The steel selected must be compatible with the heat treatment process
  selected and hardness required."*
- **Table 14-6, nota 4** — *"These materials must be annealed or normalized as a minimum."*
- **§14-18 / Eq. (14-44)** — *"Normally, mG > 1 and JG > JP, so Equation (14-44) shows that **the
  gear can be less strong (lower Brinell hardness) than the pinion for the same safety factor**."*
- **§15-3** — *"Most bevel-gear sets are made from carburized case-hardened steel, and the factors
  incorporated in 2003-B97 largely address these high-performance gears. **For through-hardened
  gears, 2003-B97 is silent on KL and CL, and Figures 15-8 and 15-9 should prudently be considered
  as approximate.**"*
- **§15-7** — *"To reduce cooling load, **use multiple-thread worms**. Also **keep the worm pitch
  diameter as small as possible**."*
- **§15-7** — *"**Multiple-thread worms can remove the self-locking feature** of many worm-gear
  drives."* Y el criterio: *"To ensure that the worm gear will drive the worm, **fstat < cos ϕn tan
  λ**"* (Eq. 15-56).
- **§15-7** — *"Worm gearsets have such poor efficiencies that **we work with, and speak of, output
  power**."*
- **§15-7 / Table 15-9** — ángulo de avance máximo por ángulo de presión normal:
  14.5° → 16°; 20° → 25°; 25° → 35°; 30° → 45°.
- **§14-15** — *"Heat exchangers may be used to ensure that operating temperatures are considerably
  below this value [250 °F], **as is desirable for the lubricant**."*
- **§14-11** — *"**The ideal is to locate the gear "midspan" between two bearings at the zero slope
  place when the load is applied.** However, this is not always possible."*
- **§13-14** — *"Since meshed gears are reasonably efficient, with **losses of less than 2 percent**,
  the power is generally treated as constant through the mesh."*
  (contrasta con sinfín: eficiencias de 25 % a 89 % según λ, Table 13-8.)

## 2.8 Advertencias del cliente sobre sus propios métodos

- **§14-1 (Ej. 14-1)** — *"It is important to emphasize that this is a rough estimate, and that
  **this approach must not be used for important applications**."*  (método de Lewis)
- **§14-1 (Ej. 14-2)** — *"it should be emphasized that these results should be accepted only as
  **preliminary estimates** to alert you to the nature of bending in gear teeth."*
- **§14-1** — *"**Dynamic factor Kv has been redefined as the reciprocal of that used in previous
  AGMA standards. It is now greater than 1.0.** In earlier AGMA standards it was less than 1.0.
  Care must be taken in referring to work done prior to this change in the standards."*
- **§14-5** — *"It is important to note that **the form factor Y in Equation (14-20) is not the Lewis
  factor at all**."*
- **§14-5** — *"Certain precautions must be taken in using Equation (14-25). The tooth profiles are
  not conjugate below the base circle, and consequently, **if either one or the other of the first
  two terms in brackets is larger than the third term, then it should be replaced by the third
  term**. In addition, **the effective outside radius is sometimes less than r + a**, owing to
  removal of burrs or rounding of the tips of the teeth. When this is the case, always use the
  effective outside radius."*
- **§14-5** — *"Low-contact-ratio (LCR) helical gears having a small helix angle or a thin face
  width, or both, have face-contact ratios less than unity (mF ≤ 1), and **will not be considered
  here**."*  → el método sólo cubre mF = 0 (rectos) y mF > 1 (helicoidales convencionales); la
  aproximación de mN (Eq. 14-21) exige **mF > 2.0**.
- **§14-10** — *"**There is no rationale to use Equation (14-29) for contact stress.**"*
- **§15-9** — *"For material combinations not addressed by AGMA, Buckingham's method allows
  quantitative treatment."*

---

# 3. ITERACIONES: dónde regresa y QUÉ la dispara

| # | Regresa a… | Disparador (literal / condición) | § |
|---|---|---|---|
| 1 | **Paso diametral P** | Las implicaciones en ancho de cara, diámetros y propiedades del material "no son satisfactorias" | §14-19 paso 2 |
| 2 | **Paso diametral P** | El **ancho de cara requerido cae fuera del rango disponible** (3p–5p / "readily available range") | §14-19 (pinion bending) |
| 3 | **Paso diametral P** | La **dureza de núcleo/capa requerida para el piñón** no es alcanzable con el material elegido | §14-19 paso 3 |
| 4 | **Paso diametral P** | Igual, para el **engrane** | §14-19 paso 4 |
| 5 | **F (dentro del rango) o dureza** | St necesario > St alcanzable con la dureza escogida. Ej. 14-8: *"This is a little low. We could increase the hardness... But another option is to go back and increase the face width, **staying within the recommended range**."* → **F: 3.0 → 3.5 in**, y **recalcula Ks y Km** | Ej. 14-8 |
| 6 | **Dureza superficial (case)** | (nc) queda debajo de la meta. *"increasing the surface hardness, choosing a different material, or increasing the tooth size and face width. **Since the bending factors of safety are satisfactory, increasing the surface hardness is potentially a good choice since it primarily helps the surface strength**."* | Ej. 14-8 |
| 7 | **Bajar el material del engrane** | (nb)G sale muy alto ("more than needed") — **PERO lo pospone**: *"we will proceed first to check the suitability of the current material choice for surface failure"* | Ej. 14-8 |
| 8 | **TODA la malla** | **Rin demasiado delgado**: si tR < mB·ht con mB = 1.2 → *"review and modify this mesh design"* (la suposición KB = 1 se cae) | Ej. 14-8, §14-16 |
| 9 | **Pitch, F, Qv, material (cónicos)** | Los cuatro FS quedan muy arriba de la meta: *"If optimization is desired, our goal would be to make changes in the design decisions that **drive the factors closer to 2**"* | Ej. 15-2 |
| 10 | **d del sinfín** | d fuera de la ventana C^0.875/3 … C^0.875/1.6, o simplemente **para acercarse al extremo alto** y hacer C redondo: *"Try d = 2.500 in. Recompute C"* | §15-8, Ej. 15-4 |
| 11 | **px / NW del sinfín** | NG = mG·NW debajo del mínimo de Table 15-10 para el ϕn elegido | §15-8 |
| 12 | **Área de la caja / ventilador** | ts (temperatura del cárter) inaceptable → subir A, poner ventilador (ħCR pasa de nW/6494 a nW/3939), serpentín de agua o enfriador externo | §15-7, §15-8 |
| 13 | **Fe del engrane sinfín** | (Fe)req > 0.67·dm → no cabe; hay que cambiar d, px o material (Cs) | §15-8, Ej. 15-4 |
| 14 | **Qv** | Kv inválido si V ≥ (Vt)max = [A + (Qv−3)]² → hay que subir la calidad | §14-7 Eq. 14-28, §15-3 Eq. 15-8 (verificado explícito en Ej. 15-1) |
| 15 | **NP (conteo de dientes)** | Interferencia: el mínimo depende de mG (Tablas 13-1/13-2) y del proceso (hob → 18) | §13-7 |
| 16 | **NP de una etapa del tren** | El redondeo a entero saca la razón global de tolerancia: *"If a closer tolerance is desired, then **increase the pinion size to the next integer and try again**"* | Ej. 13-3 |
| 17 | **N3 (libre) del tren reverted** | Los demás dientes no salen enteros con la restricción N2+N3 = N4+N5 → trial and error o normalizar | Ej. 13-5 |

---

# 4. JUICIOS HUMANOS (decisiones sin número que las decida)

## 4.1 Política de factores de seguridad — la decisión bifurcada de §14-18

> "There is an overlap in the use of the AGMA safety factors SF and SH with these factors of safety
> nb and nc. **If SF and SH are used as design factors to incorporate the desired margin of safety
> into the design, then nb and nc could be expected to be near unity. Alternatively, if SF and SH
> are set to unity, then nb and nc should be sufficiently greater than unity** to account for the
> desired margin of safety."

→ **REQUISITO: es una elección de POLÍTICA del despacho, no del problema.** En el Ej. 14-8 el
cliente elige la segunda: *"We choose to set AGMA design factors to unity and handle the overall
unquantifiable exigencies (including company policy regarding risk and consequences of failure) in
the overall factors of safety."* En el Ej. 15-2 (cónicos) elige la primera: SF = 2, SH = √2.

## 4.2 Qué VALOR de factor de seguridad — §14-17

> "The safety factors are to account for **unquantifiable aspects of the application, such as
> economic risk, variations in manufacturing, or safety risks. The greater the uncertainties or
> consequences of such considerations, the higher the safety factor should be. Appropriate values
> for these safety factors are **largely determined based on experience within the industry**, and
> sometimes are influenced by industry standards or codes."

Y en el Ej. 14-8 el número llega de fuera, con una razón cualitativa por modo de falla:
> "The industry standard for this design is a factor of safety of **2 guarding against complete
> failure (e.g., tooth fracture from bending fatigue)** and **1.4 guarding against a decline of
> performance (e.g., pitting of tooth surfaces)**."

→ **Dos metas distintas, y la distinción es "falla total" vs "degradación de desempeño".**

## 4.3 SF vs SH: por qué NO se comparan igual (§14-17, §14-18, §14-2, §15-3)

**El origen físico** (§14-2, Ej. 14-3, literal):
> "Contact stress is not linear with respect to the transmitted load... **the ratio of loads is the
> ratio of stresses squared**... Awkwardness comes when one compares the factor of safety in bending
> fatigue with the factor of safety in surface fatigue for a particular gear. Suppose the factor of
> safety of this gear in bending fatigue is 1.20 and the factor of safety in surface fatigue is 1.34
> as above. The threat, since 1.34 is greater than 1.20, is in bending fatigue **since both numbers
> are based on load ratios**. If the factor of safety in surface fatigue is based on SC/σC = √1.34 =
> 1.16, then 1.20 is greater than 1.16, but the threat is not from surface fatigue. **The surface
> fatigue factor of safety can be defined either way. One way has the burden of requiring a squared
> number before numbers that instinctively seem comparable can be compared.**"

**La formalización** (§14-18):
> "In Equation (14-41), **the bending stress is linear with the transmitted load Wt. But in Equation
> (14-42), the contact stress is not linear with Wt.** To render nc linear with Wt, it can be defined
> as **nc,linear = (σc,all/σc)^i where i is 2 for linear or helical contact and 3 for spherical
> contact (crowned teeth)**. Accordingly, **to identify whether bending fatigue or contact fatigue is
> closer to failure due to an increase of Wt, it is reasonable to compare nb with nc,linear**."

Y el matiz: *"the actual factors of safety for the failure modes are given by nb and nc. These are
perfectly suitable for use in the traditional sense of comparing stress to allowable stress...
**But if it is desired to compare these two factors to one another with the assumption that they are
primarily guarding against overload of Wt, it may be desirable to compare nb to nc,linear.**"*

**Y el juicio en el Ej. 14-8 de NO usarla:**
> "**We have chosen not to use the version of the factor of safety for contact stress that is linear
> with respect to the load**, that is nc,linear. This choice is in recognition that **the goals for
> the factors of safety were stated relevant to the uncertainties within the entirety of the design
> rather than with respect to the load**. In fact, the load itself was deemed to be rather
> predictable. Also, the factors of safety were stated with respect to the severity of the
> consequences of failure, and specific goals for each mode of failure were readily interpreted."

**En CÓNICOS la convención cambia** (§15-3):
> "The factors of safety SH and SF as defined in 2003-B97 are **adjustments to strength, not load**,
> and consequently **cannot be used as is** to assess (by comparison) whether the threat is from wear
> fatigue or bending fatigue. Since Wt is the same for the pinion and gear, **the comparison of √SH
> to SF allows direct comparison**."

→ **REQUISITO: el sistema debe llevar DOS números por modo (el "de esfuerzo" y el "de carga") y
saber cuál mostrar según lo que el usuario esté preguntando.** Y el exponente depende de la
geometría del contacto (2 lineal/helicoidal, 3 esférico/coronado).

## 4.4 Elección de material y dureza

- Ej. 14-8: *"**Gearing space is meager. Use Nitralloy 135M, grade 1 material to keep the gear size
  small.** The gears are heat-treated first then nitrided."* → el material lo dicta el ESPACIO.
- Ej. 14-8: *"From Table 14-5 the hardness range of Nitralloy 135M is Rockwell C32-36 (302-335
  Brinell). **Choosing a midrange hardness as attainable, use 320 Brinell.**"* → dureza = punto medio
  del rango del proceso, "as attainable".
- Ej. 14-8: *"**Use cast gear blank because of the 18-in pitch diameter.** Use the same material,
  heat treatment, and nitriding."* → el TAMAÑO decide el método de fabricación del disco.
- Ej. 15-2 (cónicos): *"Carburize and case-harden grade ASTM 1320 to Core 21 HRC (HB is 229
  Brinell), Case 55-64 HRC (HB is 515 Brinell)."* → **dos durezas, núcleo y capa, y ambas entran en
  ecuaciones distintas.**
- §15-3 da la lista de aceros templados a fondo con su HRC a 90 % de martensita — 1045 (50), 1060
  (54), 1335 (46), 2340 (49), 3140 (49), 4047 (52), 4130 (44), 4140 (49), 4340 (49), 5145 (51),
  E52100 (60), 6150 (53), 8640 (50), 9840 (49) — y los núcleos aproximados de los cementados:
  1015 (22), 1025 (37), 1118 (33), 1320 (35), 2317 (30), 4320 (35), 4620 (35), 4820 (35), 6120 (35),
  8620 (35), E9310 (30). Más la conversión HRC→HB (300 kg, bola 10 mm) tabulada de HRC 42→388 hasta
  HRC 10→187.
- §15-8: *"the designer's experience"* aparece **literalmente como una restricción de diseño**.

## 4.5 Cuándo un análisis basta

- §14-1: el método de Lewis sirve *"for estimating the capacity of gear drives **when life and
  reliability are not important considerations**"* y para *"obtaining a preliminary estimate of gear
  sizes"*. Pero *"must not be used for important applications"*.
- §15-8 (sinfín): la flexión se calcula *"for reference"* — *"**The risk is from wear**, which is
  addressed by the AGMA method."*
- §14-19: *"In steel gears, **wear is usually controlling**."*
- §15-9: Buckingham como método alterno **para combinaciones de material que AGMA no cubre**.
- §14-9 y §14-10: cuando el estándar no tiene datos (Cf, Ks), la instrucción es
  *"AGMA specifies a value of Cf greater than unity"* / *"AGMA recommends a size factor greater than
  unity"* — o sea: **1 por defecto, y >1 sólo si TÚ sabes que hay un efecto perjudicial.**

## 4.6 Zonas sombreadas de las curvas de vida (§14-13, Figs. 14-14/14-15) — juicio puro

- **YN**: *"NOTE: The choice of YN in the shaded area is influenced by: **Pitchline velocity. Gear
  material cleanliness. Residual stress. Material ductility and fracture toughness.**"*
- **ZN**: *"NOTE: The choice of ZN in the shaded zone is influenced by: **Lubrication regime. Failure
  criteria. Smoothness of operation required. Pitchline velocity. Gear material cleanliness. Material
  ductility and fracture toughness. Residual stress.**"*
- **KL (cónicos, Fig 15-9)**: *"NOTE: The choice of KL (YNT) is influenced by: Pitch-line velocity.
  Gear material cleanliness. Residual stress. Material ductility and fracture toughness."* — y la
  rama tiene dos versiones etiquetadas **"critical"** (1.683 N^−0.0323) y **"general"**
  (1.3558 N^−0.0178) que el diseñador escoge.

→ **REQUISITO: hay parámetros donde el sistema NO debe devolver un número, debe presentar la banda y
pedir criterio (o registrar el criterio que se usó).**

---

# 5. CRITERIOS DE ACEPTACIÓN (lo que revisa antes de dar por bueno)

## 5.1 Rectos y helicoidales (cap. 14)

1. **(nb)P ≥ meta** y **(nb)G ≥ meta** — flexión, piñón y engrane.
2. **(nc)P ≥ meta** y **(nc)G ≥ meta** — picadura, piñón y engrane.
3. **Comparación nb vs nc,linear** para identificar cuál modo es la amenaza real (Ej. 14-5:
   *"Thus, pinion failure is driven by surface fatigue... **for the entire mesh, we see that the
   overall minimum factor of safety is with the surface fatigue of the gear**."*).
4. **Ancho de cara en 3p ≤ F ≤ 5p** y dentro de lo comercialmente disponible.
5. **Verificar la suposición de rin**: tR ≥ mB·ht con mB ≥ 1.2, si no → rediseñar la malla.
6. **Kv válido**: V < (Vt)max = [A + (Qv−3)]² para el Qv escogido.
7. **Sin interferencia**: NP ≥ mínimo por Tablas 13-1/13-2 según mG (o 18 si se genera con hob).
8. **Relación de contacto** ≥ 1.20 (§13-6); ~1.5 para "quality gearset" (§14-1).
9. **Validez del procedimiento de Km**: F/dP ≤ 2, montaje entre rodamientos, F ≤ 40 in, contacto en
   todo el ancho del miembro más angosto.
10. **Coherencia de resistencias piñón/engrane** vía Eqs. (14-44) y (14-45): el engrane puede ser más
    blando y aun así igualar el FS.
11. **KB = 1** sólo si mB ≥ 1.2.
12. **T < 250 °F** para poder usar KT = 1.

## 5.2 Cónicos rectos (cap. 15)

1. Los **cuatro** FS: (SF)G, (SF)P, (SH)²G, (SH)²P — reportados de forma comparable.
2. **√SH vs SF** para identificar la amenaza.
3. **F = min(0.3A0, 10/Pd)** respetado (y en el ejemplo lo redondea a un valor fabricable ligeramente
   arriba: 1.186 → 1.25).
4. **Kv válido**: vt < vt,max (verificado explícitamente en el Ej. 15-1: *"vt < vt max, that is,
   785.4 < 4769 ft/min, therefore Kv is valid"*).
5. **Mínimo de dientes de Table 13-5** (16/16, 15/17, 14/20, 13/30).
6. **Potencia nominal = min(bending, wear)** (Ej. 15-1: *"The mesh rated power is
   H = min(7.0, 2.58) = 2.6 hp"*).
7. Si es temple a fondo, **marcar KL y CL como aproximados** (§15-3).

## 5.3 Sinfín (cap. 15)

1. **W^t_all ≥ W^t_G** (Eq. 15-28 vs Eq. 15-58, con nd y Ka ya metidos en la carga).
2. **(Fe)G ≤ 0.67·dm** y ≥ (Fe)req.
3. **d dentro de C^0.875/3 ≤ d ≤ C^0.875/1.6** (recalculado cada vez que cambia C).
4. **λ ≤ λmax** de Table 15-9 para el ϕn elegido.
5. **NG ≥ mínimo de Table 15-10** para el ϕn elegido.
6. **Temperatura del cárter ts aceptable** — el criterio se enuncia cualitativo:
   *"Lubricant is safe with some margin for smaller area."*
7. **Área lateral ≥ Amin = 43.20 C^1.7** (o justificar el área real estimada).
8. **Autobloqueo**: verificar fstat < cos ϕn tan λ si SE QUIERE que el engrane mueva al sinfín; y si
   se quiere que NO, ir a la cláusula 9 de 6034-B92 (*no aparece en el texto extraído*).
9. **Flexión (Buckingham/Lewis, Eq. 15-53) como chequeo secundario.**
10. **Contraste opcional con Buckingham wear load** (Eq. 15-64).

---

# 6. CATÁLOGO DURO DE FACTORES AGMA

## 6.1 Las cuatro ecuaciones madre (cap. 14)

- **Flexión (Eq. 14-15)** — US: σb = Wt·Ko·Kv·Ks·(P/F)·(Km·KB/J)
  SI: σb = Wt·Ko·Kv·Ks·(1/(b·mt))·(KH·KB/YJ)
- **Contacto (Eq. 14-16)** — US: σc = Cp·[Wt·Ko·Kv·Ks·(Km/(dP·F))·(Cf/I)]^(1/2)
  SI: σH = ZE·[Wt·Ko·Kv·Ks·(KH/(dw1·b))·(ZR/ZI)]^(1/2)
- **Flexión admisible (Eq. 14-17)** — σb,all = (St/SF)·(YN/(KT·KR))
- **Contacto admisible (Eq. 14-18)** — σc,all = (Sc/SH)·(ZN·CH/(KT·KR))
- **FS** — nb = σb,all/σb (Eq. 14-41); nc = σc,all/σc (Eq. 14-42);
  nc,linear = (σc,all/σc)^i, i = 2 (lineal/helicoidal) o 3 (esférico/coronado) (Eq. 14-43)

## 6.2 Tabla maestra de factores — cap. 14

| Factor | Qué lo indexa (entradas) | Rango / valores | De dónde sale |
|---|---|---|---|
| **Ko** (KA) — sobrecarga | Naturaleza de la **fuente de potencia** (uniform / light shock / medium shock) × **máquina impulsada** (uniform / moderate shock / heavy shock) | 1.00 / 1.25 / 1.75 · 1.25 / 1.50 / 2.00 · 1.50 / 1.75 / 2.25 | **Table 14-9** ("Suggested Values"). §14-8. *"These factors are established after considerable field experience in a particular application."* |
| **Kv** — dinámico | **Qv** (número de calidad) y **V** (velocidad de línea de paso) | Kv = ((A+√V)/A)^B, con B = 0.25(12−Qv)^(2/3), A = 50+56(1−B). Qv **3–7 = comercial**, **8–12 = precisión**. Fig 14-9 muestra Qv 5..11, Kv ≈ 1.0–1.8 | Eqs. (14-27a,b), Fig 14-9. Límite: (Vt)max = [A+(Qv−3)]² ft/min, o /200 en m/s (Eq. 14-28). §14-7. Nota: 2001-D04 sustituyó Qv por **Av (6 a 12, menor = más preciso)**; Qv se mantuvo como alterno y da Kv comparables |
| **Ks** — tamaño | Tooth size, diámetro de la pieza, razón tamaño-diente/diámetro, **face width**, área del patrón de esfuerzo, razón profundidad-de-capa/tamaño-de-diente, templabilidad y tratamiento | **AGMA sugiere Ks = 1** (placeholder). Alternativa: **Ks = 1/kb = 1.192·(F·√Y/P)^0.0535** | Eq. (14-29), derivada de Eqs. (6-19), (6-24) y de la geometría de Lewis (Y de **Table 14-2**). §14-10. ⚠ *"There is no rationale to use Equation (14-29) for contact stress."* |
| **Km (KH)** — distribución de carga | Corona/no corona, **F**, **dP**, tipo de montaje (straddle, S1/S), tipo de caja (open/commercial/precision/extra-precision), ajuste en ensamble o lapeado | Km = 1 + Cmc(Cpf·Cpm + Cma·Ce) (Eq. 14-30) | §14-11. Válido si **F/dP ≤ 2**, entre rodamientos, **F ≤ 40 in**, contacto en todo el ancho |
| ↳ Cmc | Corona | **1** sin corona / **0.8** con corona | Eq. (14-31) |
| ↳ Cpf | F, dP | F ≤ 1 in: F/(10dP) − 0.025; 1 < F ≤ 17: F/(10dP) − 0.0375 + 0.0125F; 17 < F ≤ 40: F/(10dP) − 0.1109 + 0.0207F − 0.000228F². **Piso: si F/(10dP) < 0.05, usa 0.05** | Eq. (14-32) |
| ↳ Cpm | Posición del piñón entre apoyos (S1/S) | **1** si straddle con S1/S < 0.175; **1.1** si straddle con S1/S ≥ 0.175 | Eq. (14-33), Fig 14-10 |
| ↳ Cma | Tipo de caja, F | Cma = A + BF + CF². **Open**: 0.247, 0.0167, −0.765e−4. **Commercial enclosed**: 0.127, 0.0158, −0.930e−4. **Precision enclosed**: 0.0675, 0.0128, −0.926e−4. **Extraprecision**: 0.00360, 0.0102, −0.822e−4 | Eq. (14-34), **Table 14-10**, Fig 14-11 |
| ↳ Ce | Ajuste en ensamble / lapeado | **0.8** si se ajusta en ensamble o se mejora la compatibilidad por lapeado (o ambos); **1** en todos los demás casos | Eq. (14-35) |
| **Cf (ZR)** — condición superficial | Acabado (cutting, shaving, lapping, grinding, shotpeening), **esfuerzo residual**, efectos plásticos (endurecimiento por trabajo) | *"Standard surface conditions for gear teeth have not yet been established. When a detrimental surface finish effect is known to exist, AGMA specifies a value of Cf greater than unity."* → **1 por defecto** | §14-9. **No hay tabla.** |
| **CH (ZW)** — razón de dureza | **Sólo para el ENGRANE** (para el piñón CH = 1). Indexado por HBP/HBG y **mG**; o, si el piñón es endurecido superficialmente, por **fP (rugosidad Ra del piñón, μin)** y **HBG** | Through-hardened: **CH = 1 + A′(mG − 1)**, A′ = 8.98e−3(HBP/HBG) − 8.29e−3, válido **1.2 ≤ HBP/HBG ≤ 1.7**; si <1.2 → A′ = 0; si >1.7 → A′ = 0.00698. Piñón endurecido ≥ **48 HRC** con engrane templado a fondo (**180–400 HB**): **CH = 1 + B′(450 − HBG)**, B′ = 0.00075·exp(−0.0112·fP). Fig 14-13: **si fP > 64 μin, usa CH = 1.0**. Rango típico de la gráfica: 1.00–1.14 | Eqs. (14-36), (14-37); Figs. 14-12, 14-13. §14-12 |
| **YN** — ciclos, flexión | **Número de ciclos N** (¡distinto para piñón y engrane!) y material/dureza | Ramas de Fig 14-14: **9.4518 N^−0.148** (400 HB), **6.1514 N^−0.1192** (case carb.), **4.9404 N^−0.1045** (250 HB), **3.517 N^−0.0817** (nitrided), **2.3194 N^−0.0538** (160 HB) para N < 10⁷; **1.3558 N^−0.0178** y **1.6831 N^−0.0323** para N > 10⁷. YN = 1 en 10⁷ | Fig 14-14, §14-13 |
| **ZN** — ciclos, contacto | Número de ciclos N | **2.466 N^−0.056** (N < 10⁷); **1.4488 N^−0.023** (N > 10⁷); **nitrided: 1.249 N^−0.0138**. ZN = 1 en 10⁷ | Fig 14-15, §14-13 |
| **KR (YZ)** — confiabilidad | **R** (confiabilidad de la RESISTENCIA del material, no del sistema) | Table 14-11: 0.9999→1.50; 0.999→1.25; **0.99→1.00**; 0.90→0.85; 0.50→0.70. Interpolación: **KR = 0.658 − 0.0759 ln(1−R)** para 0.5 < R < 0.99; **KR = 0.50 − 0.109 ln(1−R)** para 0.99 ≤ R ≤ 0.9999 | Table 14-11, Eq. (14-38), §14-14. *"The functional relationship... is highly nonlinear. When interpolation is required, **linear interpolation is too crude**."* |
| **KT (Yθ)** — temperatura | Temperatura del aceite o del disco | **1.0** hasta **250 °F (120 °C)**; arriba de eso *"the factor should be greater than unity"* — **no da fórmula en el texto extraído** | §14-15 |
| **KB** — espesor de rin | **mB = tR/ht** (backup ratio) | **KB = 1.6 ln(2.242/mB)** si mB < 1.2; **KB = 1** si mB ≥ 1.2. Fig 14-16 llega hasta ≈2.4 en mB ≈ 0.5 | Eqs. (14-39), (14-40), Fig 14-16, §14-16 |
| **Cp (ZE)** — coeficiente elástico | E y ν de piñón y engrane | Eq. (14-13): Cp = {π[(1−νP²)/EP + (1−νG²)/EG]}^(−1/2). **Table 14-8** (ν = 0.30): acero/acero **2300 √psi (191 √MPa)**; acero/hierro maleable 2180; acero/hierro nodular 2160; acero/hierro fundido 2100; acero/bronce al aluminio 1950; acero/bronce al estaño 1900; hasta bronce/bronce 1650 | Eq. (14-13), Table 14-8, §14-6 |
| **J (YJ)** — geometría, flexión | **N del engrane en cuestión**, **N del engrane conjugado**, ϕ, ψ, si la carga se aplica en la punta o en el HPSTC | **J = Y/(Kf·mN)** (Eq. 14-20). Fig 14-6 (rectos 20° full-depth): ≈0.20–0.60. Fig 14-7 (helicoidales J′) + Fig 14-8 (multiplicador si el conjugado no tiene 75 dientes, 0.85–1.05) | Eq. (14-20), Figs 14-6/14-7/14-8, §14-5. **Y NO es el factor de Lewis**; sale de AGMA 908-B89 |
| ↳ mN — reparto de carga | mp, mF, modificaciones de perfil, deflexión | **mN = 1.0 para rectos**; helicoidales con **mF > 2.0**: mN = pN/(0.95 Z) | Eq. (14-21) |
| ↳ Kf | (dentro de J) *"stress-correction factor by AGMA... based on a formula deduced from a photoelastic investigation of stress concentration in gear teeth over 50 years ago"*. Alternativa explícita: **Eq. (14-9)** de Mitchiner-Mabie: Kf = H + (t/r)^L (t/l)^M con H = 0.34 − 0.4583662ϕ, L = 0.316 − 0.4583662ϕ, M = 0.290 + 0.4583662ϕ, r = (b − rf)²/[(d/2) + b − rf] | | §14-1, §14-5 |
| **I (ZI)** — geometría, contacto | ϕt, mG, mN, externo/interno | **I = cos ϕt · sin ϕt/(2 mN) · mG/(mG + 1)** externos; **… · mG/(mG − 1)** internos | Eq. (14-23), §14-5. Con Z de Eq. (14-25) y pN = pn cos ϕn (Eq. 14-24) |
| **St** — resistencia a flexión | **HB** (dureza), **grado** (1/2/3), tratamiento térmico | Ver §6.3 abajo | Figs 14-2/14-3/14-4, Tables 14-3/14-4, §14-4 |
| **Sc** — resistencia a contacto | **HB**, grado, tratamiento | Ver §6.3 abajo | Fig 14-5, Tables 14-6/14-7, §14-4 |
| **Y** — factor de forma de Lewis | Número de dientes (20° full-depth, P unitario) | Table 14-2: 12→0.245, 13→0.261, 14→0.277, 15→0.290, 16→0.296, 17→0.303, 18→0.309, 19→0.314, 20→0.322, 21→0.328, 22→0.331, 24→0.337, 26→0.346, 28→0.353, 30→0.359, 34→0.371, 38→0.384, 43→0.397, 50→0.409, 60→0.422, 75→0.435, 100→0.447, 150→0.460, 300→0.472, 400→0.480, rack→0.485 | Table 14-2, Eq. (14-3): Y = 2xP/3 |

## 6.3 St y Sc: las ecuaciones de ajuste de curva (VERIFICADAS contra el texto)

### Flexión St — acero templado a fondo (Fig 14-2)
- **Grado 1: St = 77.3·HB + 12 800 psi**  → SI: St = 0.533·HB + 88.3 MPa
- **Grado 2: St = 102·HB + 16 400 psi**   → SI: St = 0.703·HB + 113 MPa
- Rango de la gráfica: HB 150–450; St ≈ 20–50 kpsi. *"Metallurgical and quality control procedure
  required"* para el grado 2.

### Flexión St — acero nitrurado templado a fondo, p.ej. AISI 4140 / 4340 (Fig 14-3), **con dureza de NÚCLEO**
- **Grado 1: St = 82.3·HB + 12 150 psi**  → SI: St = 0.568·HB + 83.8 MPa
- **Grado 2: St = 108.6·HB + 15 890 psi** → SI: St = 0.749·HB + 110 MPa
- Abscisa: **Core hardness HB, 250–350**.

### Flexión St — aceros de nitruración (Fig 14-4), **dureza de NÚCLEO 250–350 HB**
- **Nitralloy, grado 1: St = 86.2·HB + 12 730 psi**    → SI: 0.594·HB + 87.76 MPa
- **Nitralloy, grado 2: St = 113.8·HB + 16 650 psi**   → SI: 0.784·HB + 114.81 MPa
- **2.5 % cromo, grado 1: St = 105.2·HB + 9 280 psi**  → SI: 0.7255·HB + 63.89 MPa
- **2.5 % cromo, grado 2: St = 105.2·HB + 22 280 psi** → SI: 0.7255·HB + 153.63 MPa
- **2.5 % cromo, grado 3: St = 105.2·HB + 29 280 psi** → SI: 0.7255·HB + 201.91 MPa

### Contacto Sc — acero templado a fondo (Fig 14-5)
- **Grado 1: Sc = 322·HB + 29 100 psi**  → SI: Sc = 2.22·HB + 200 MPa
- **Grado 2: Sc = 349·HB + 34 300 psi**  → SI: Sc = 2.41·HB + 237 MPa
- ⚠ **Discrepancia del propio libro**: el Ejemplo 14-7 despeja con **29 200** en vez de 29 100
  (*"(HB)G = (117 100 − 29 200)/322 = 273 Brinell"*). El resultado redondeado es el mismo (273), pero
  la constante impresa en el ejemplo NO coincide con la de la figura.

### Table 14-3 — St de aceros por tratamiento (10⁷ ciclos, R = 0.99), psi
| Tratamiento | Dureza superficial mín. | Grado 1 | Grado 2 | Grado 3 |
|---|---|---|---|---|
| Through-hardened | Fig 14-2 | Fig 14-2 | Fig 14-2 | — |
| Flame/induction, patrón **tipo A** | 2001-D04 Table 8 | 45 000 | 55 000 | — |
| Flame/induction, patrón **tipo B** | 2001-D04 Table 8 | 22 000 | 22 000 | — |
| Carburized and hardened | 2001-D04 Table 9 | 55 000 | 65 000 **o 70 000** | 75 000 |
| Nitrided (aceros templados a fondo) | 83.5 HR15N | Fig 14-3 | Fig 14-3 | — |
| Nitralloy 135M / N / 2.5 % Cr nitrurados | 87.5 HR15N | Fig 14-4 | Fig 14-4 | Fig 14-4 |

*(nota 6: "If bainite and microcracks are limited to grade 3 levels, 70 000 psi may be used.")*

### Table 14-4 — St de hierros y bronces, psi
Gris ASTM A48 clase 20 (as cast, —): 5000 · clase 30 (174 HB): 8500 · clase 40 (201 HB): 13 000.
Nodular ASTM A536 60-40-18 (140 HB): 22 000–33 000 · 80-55-06 (179 HB): 22 000–33 000 ·
100-70-03 (229 HB): 27 000–40 000 · 120-90-02 (269 HB): 31 000–44 000.
Bronce sand cast (Sut mín 40 000 psi): 5700 · ASTM B-148 aleación 954 tratado (Sut mín 90 000): 23 600.

### Table 14-6 — Sc de aceros, psi
Through-hardened: Fig 14-5. Flame/induction 50 HRC: 170 000 / 190 000; 54 HRC: 175 000 / 195 000.
Carburized: 180 000 / 225 000 / 275 000. Nitrided (through-hardened) 83.5 HR15N: 150 000 / 163 000 /
175 000; 84.5 HR15N: 155 000 / 168 000 / 180 000. 2.5 % Cr nitrurado 87.5 HR15N: 155 000 / 172 000 /
189 000. Nitralloy 135M 90.0 HR15N: 170 000 / 183 000 / 195 000. Nitralloy N 90.0 HR15N: 172 000 /
188 000 / 205 000. 2.5 % Cr 90.0 HR15N: 176 000 / 196 000 / 216 000.

### Table 14-7 — Sc de hierros y bronces, psi
Gris clase 20: 50 000–60 000 · clase 30 (174 HB): 65 000–75 000 · clase 40 (201 HB): 75 000–85 000.
Nodular 60-40-18 (140 HB): 77 000–92 000 · 80-55-06 (179 HB): 77 000–92 000 · 100-70-03 (229 HB):
92 000–112 000 · 120-90-02 (269 HB): 103 000–126 000. Bronce sand cast: 30 000 · B-148 954: 65 000.

### Relación piñón↔engrane
- **(St)G = (St)P · mG^β · (JP/JG)**  (Eq. 14-44), con β el exponente de la rama de YN usada
  (Ej. 14-6: β = −0.110).
- **(Sc)G = (Sc)P · mG^β**  (Eq. 14-45), con β de la rama de ZN (Ej. 14-7: β = −0.056). CH se
  desprecia *"Since CH is so close to unity"*.
- *"Equations (14-44) and (14-45) apply as well to helical gears."*
- **Table 14-5** (nitruración): Nitralloy 135 y 135M — 1150 °F antes, 975 °F nitrurando, capa 62–65
  HRC, núcleo 30–35 / 32–36; Nitralloy N — 1000/975, capa 62–65, núcleo 40–44; AISI 4340 — 1100/975,
  capa 48–53, núcleo 27–35; AISI 4140 — 1100/975, capa 49–54, núcleo 27–35; 31 Cr Mo V 9 —
  1100/975, capa 58–62, núcleo 27–33.

## 6.4 Factores de CÓNICOS (§15-2, §15-3)

**Ecuaciones madre:**
- Contacto: sc = Cp·[Wt/(F·dP·I) · Ko·Kv·Km·Cs·Cxc]^(1/2)  (Eq. 15-1)
- Contacto admisible: swc = sac·CL·CH/(SH·KT·CR)  (Eq. 15-2)
- Flexión: st = (Wt/F)·Pd·Ko·Kv·(Ks·Km/(Kx·J))  (Eq. 15-3)
- Flexión admisible: swt = sat·KL/(SF·KT·KR)  (Eq. 15-4)

| Factor | Indexado por | Valores | Fuente |
|---|---|---|---|
| **Ko (KA)** | Prime mover × carga (4×4, no 3×3 como en rectos) | Uniform: 1.00/1.25/1.50/**1.75 o más**; Light shock: 1.10/1.35/1.60/1.85+; Medium shock: 1.25/1.50/1.75/2.00+; Heavy shock: 1.50/1.75/2.00/2.25+. **Para transmisiones MULTIPLICADORAS de velocidad, súmale 0.01(N/n)²** | Table 15-2 |
| **Kv** | Qv, **vt en el diámetro de paso EXTERIOR** | Mismas Eqs. que rectos: Kv = ((A+√vt)/A)^B, B = 0.25(12−Qv)^(2/3), A = 50+56(1−B). vt = πdP·nP/12 (US); vet = 5.236e−5·d1·n1 (SI). vt,max = [A+(Qv−3)]² | Eqs. (15-5)–(15-8), Fig 15-5 |
| **Cs (Zx)** — tamaño, picadura | **F** | 0.5 si F < 0.5 in; **0.125F + 0.4375** si 0.5 ≤ F ≤ 4.5 in; 1 si F > 4.5 in. SI: 0.5 si b<12.7 mm; **0.004 92b + 0.4375** si 12.7 ≤ b ≤ 114.3; 1 si b > 114.3 mm | Eq. (15-9) |
| **Ks (Yx)** — tamaño, flexión | **Pd** | **0.4867 + 0.2132/Pd** si 0.5 ≤ Pd ≤ 16 teeth/in; 0.5 si Pd > 16. SI: 0.5 si met < 1.6 mm; **0.4867 + 0.008 339·met** si 1.6 ≤ met ≤ 50 mm | Eq. (15-10) |
| **Km (KHβ)** | **Tipo de montaje** y **F** | Km = Kmb + 0.0036F² (US) / KHβ = Kmb + 5.6e−6·b² (SI). **Kmb = 1.00** ambos entre apoyos (straddle); **1.10** uno straddle; **1.25** ninguno | Eq. (15-11) |
| **Cxc (Zxc)** — coronado | Si el diente está coronado a lo largo | **1.5** correctamente coronado; **2.0 o mayor** sin coronar. *"The teeth of most bevel gears are crowned in the lengthwise direction during manufacture to accommodate the deflection of the mountings."* | Eq. (15-12) |
| **Kx (Yβ)** — curvatura longitudinal | Tipo de cónico | **Kx = 1 para cónicos rectos** | Eq. (15-13) |
| **I (ZI)** | NP y NG (20° normal, eje a 90°) | Gráfica: NP 10–50, NG 50–100, **I ≈ 0.05–0.11** | Fig 15-6 |
| **J (YJ)** | N del engrane y N del conjugado (20° normal, 90°) | Gráfica: **J ≈ 0.16–0.40** | Fig 15-7 |
| **CL (ZNT)** | NL | **2** para 10³ ≤ NL < 10⁴; **3.4822 NL^−0.0602** para 10⁴ ≤ NL ≤ 10¹⁰ | Eq. (15-14), Fig 15-8 |
| **KL (YNT)** | NL, y **criticidad** | **2.7** para 10² ≤ NL < 10³; **6.1514 NL^−0.1192** para 10³ ≤ NL < 3(10⁶); **1.683 NL^−0.0323** para 3e6 ≤ NL ≤ 1e10 (**"critical"**); **1.3558 NL^−0.0178** para 3e6 ≤ NL ≤ 1e10 (**"general"**) | Eq. (15-15), Fig 15-9 |
| **CH (ZW)** | HBP/HBG y **N/n**; o fP y HBG | **CH = 1 + B1(N/n − 1)**, B1 = 0.008 98(HBP/HBG) − 0.008 29, válido 1.2 ≤ HBP/HBG ≤ 1.7. Piñón endurecido superficialmente (≥48 HRC) con engrane 180 ≤ HB ≤ 400: **CH = 1 + B2(450 − HBG)**, **B2 = 0.000 75·exp(−0.0122·fP)** [SI: B2 = 0.00075 exp(−0.52 Ra1)]. Pares cementados de dureza aproximadamente igual → **CH = 1**. Fig 15-11: 1.00–1.20 | Eqs. (15-16), (15-17), Figs 15-10/15-11 |
| **KT (Kθ)** | Temperatura | **1** para 32 °F ≤ t ≤ 250 °F; **(460+t)/710** para t > 250 °F. SI: 1 para 0–120 °C; **(273+θ)/393** arriba | Eq. (15-18) |
| **CR (ZZ), KR (YZ)** | R | Table 15-3: <1 falla en 10 000 → CR 1.22, KR 1.50; en 1000 → 1.12, 1.25; en 100 → 1.00, 1.00; en 10 → 0.92, **0.85** (*"At this value plastic flow might occur rather than pitting"*); en 2 → 0.84, **0.70** (extrapolado). **CR = √KR**. Ajustes: **KR = 0.50 − 0.25 log(1−R)** para 0.99 ≤ R ≤ 0.999 (Eq. 15-19); **KR = 0.70 − 0.15 log(1−R)** para 0.90 ≤ R < 0.99 (Eq. 15-20). Nota †: *"Tooth breakage is sometimes considered a greater hazard than pitting. In such cases a greater value of KR is selected for bending."* | Table 15-3, Eqs. (15-19)/(15-20) |
| **Cp (ZE)** | E, ν de ambos | **2290 √psi para acero** (190 √(N/mm²)) — ⚠ **NO 2300 como en el cap. 14** | Eq. (15-21) |
| **sac** | HB, grado | Templado a fondo: **grado 1 = 341·HB + 23 620 psi** (2.35HB + 162.89 MPa); **grado 2 = 363.6·HB + 29 560 psi** (2.51HB + 203.86 MPa). Table 15-4: flame/induction 50 HRC → 175 000/190 000; carburized → 200 000/225 000/250 000; AISI 4140 nitrurado 84.5 HR15N → 145 000 (sólo grado 2); Nitralloy 135M 90.0 HR15N → 160 000 (grado 2). Hierros (Table 15-5): gris clase 30 (175 HB) 50 000; clase 40 (200 HB) 65 000; nodular 80-55-06 (180 HB) 94 000; 120-90-02 (300 HB) 135 000 | Fig 15-12, Eq. (15-22), Tables 15-4/15-5 |
| **sat** | HB, grado | Templado a fondo: **grado 1 = 44·HB + 2100 psi** (0.30HB + 14.48 MPa); **grado 2 = 48·HB + 5980 psi** (0.33HB + 41.24 MPa). Table 15-6: flame/induction 50 HRC **raíz sin endurecer** 15 000/13 500, **raíz endurecida** 22 500; carburized 30 000/35 000/40 000; AISI 4140 nitrurado 22 000; Nitralloy 135M 24 000. Hierros (Table 15-7): gris clase 30 4500; clase 40 6500; nodular 80-55-06 10 000; 120-90-02 13 500 | Fig 15-13, Eq. (15-23), Tables 15-6/15-7 |

**Comparabilidad**: SF y SH son ajustes a la **resistencia**, no a la carga; por eso el criterio es
comparar **√SH contra SF** (§15-3), y en la hoja de ruta (Fig 15-14) el FS de desgaste comparable a
carga es **nw = (σc,all/σc)²**.

## 6.5 Factores de SINFÍN (§15-6, §15-7, §15-9)

**Ecuación madre AGMA (Eq. 15-28):**  **(W^t)all = Cs · Dm^0.8 · Fe · Cm · Cv**
donde Dm = diámetro medio del engrane (in) y **Fe = ancho de cara efectivo del engrane, el real pero
sin pasar de 0.67·dm** (dm = diámetro medio del sinfín).

| Factor | Indexado por | Valores | Fuente |
|---|---|---|---|
| **Cs** — materiales | **C** (distancia entre centros) y **Dm**, y el **método de colado del bronce** | **Cs = 720 + 10.37·C³ para C ≤ 3 in**. Para C > 3: **arena** → 1000 si Dm ≤ 2.5 in, **1190 − 477 log Dm** si Dm > 2.5; **coquilla (chilled)** → 1000 si Dm ≤ 8 in, **1412 − 456 log Dm** si Dm > 8; **centrifugado** → 1000 si Dm ≤ 25 in, **1251 − 180 log Dm** si Dm > 25 | Eqs. (15-32)–(15-35) |
| **Cm** — corrección por razón | **mG** | **0.02·√(−mG² + 40mG − 76) + 0.46** para 3 < mG ≤ 20; **0.0107·√(−mG² + 56mG + 5145)** para 20 < mG ≤ 76; **1.1483 − 0.006 58·mG** para mG > 76 | Eq. (15-36) |
| **Cv** — velocidad | **Vs** (velocidad de deslizamiento) | **0.659·exp(−0.0011·Vs)** para Vs < 700 ft/min; **13.31·Vs^−0.571** para 700 ≤ Vs < 3000; **65.52·Vs^−0.774** para Vs > 3000 | Eq. (15-37) |
| **f** — coeficiente de fricción | **Vs** | **0.15** en Vs = 0; **0.124·exp(−0.074·Vs^0.645)** para 0 < Vs ≤ 10 ft/min; **0.103·exp(−0.110·Vs^0.450) + 0.012** para Vs > 10 ft/min | Eq. (15-38). Comparar con Fig 13-38 (curva A = más fricción, hierro/hierro; curva B = materiales de alta calidad, sinfín de acero cementado con engrane de bronce fosforado) |
| **ħCR** — transferencia de calor | **nW** y si hay ventilador | **nW/6494 + 0.13** sin ventilador; **nW/3939 + 0.13** con ventilador en la flecha del sinfín. Unidades ft·lbf/(min·in²·°F) | Eq. (15-50) |
| **Amin** | **C** | **Amin = 43.20·C^1.7** in² | Eq. (15-52) |
| **y** — forma de Lewis (Buckingham) | **ϕn** | 14.5° → 0.100; 20° → 0.125; 25° → 0.150; 30° → 0.175 | §15-6, tras Eq. (15-53) |
| **Kw** — factor de desgaste de **Buckingham** | **Par de materiales** × **ϕn** | Table 15-11 (14½°/20°/25°/30°): acero templado+bronce en coquilla 90/125/150/180; acero templado+bronce 60/**80**/100/120; acero 250 BHN+bronce 36/50/60/72; fundición de alta prueba+bronce 80/115/140/165; hierro gris+aluminio 10/12/15/18; fundición alta prueba+hierro gris 90/125/150/180; +acero colado 22/31/37/45; +fundición alta prueba 135/185/225/270; acero 250 BHN+fenólico laminado 47/64/80/95; hierro gris+fenólico 70/96/120/140. **Nota: *"Over 500 BHN surface"* para "hardened steel"; *"For steel worms, multiply given values by 0.6"* en la fila de hierro gris/aluminio** | Table 15-11, Eq. (15-64) |
| **Table 15-10** — dientes mínimos del engrane | **ϕn** | 14.5°→40; 17.5°→27; 20°→21; 22.5°→17; 25°→14; 27.5°→12; 30°→10 | §15-8 |
| **Table 15-9** — λ máximo | **ϕn** | 14.5°→16°; 20°→25°; 25°→35°; 30°→45° | §15-7 |
| **Table 15-8** — proporciones | **ϕn y NW** | ϕn 14.5° (NW ≤ 2) y 20° (NW ≤ 2): a = 0.3183px, b = 0.3683px, ht = 0.6866px. ϕn 25° (NW > 2): a = 0.286px, b = 0.349px, ht = 0.635px | §15-6 |

**Geometría (Eqs. 15-39…15-48):** a = px/π = 0.3183px; b = 1.157px/π = 0.3683px;
ht = 2.157px/π = 0.6866px si px ≥ 0.16 in, y = 2.200px/π + 0.002 = 0.7003px + 0.002 si px < 0.16 in;
do = d + 2a; dr = d − 2b; Dt = D + 2a; Dr = D − 2b; c = b − a;
**(FW)max = 2√(2Da)**; **FG = 2dm/3** si px > 0.16 in, y = 1.125√[(do+2c)² − (do−4a)²] si px ≤ 0.16 in.

**Cinemática/potencia (Eqs. 15-54…15-63):**
eW = (cos ϕn − f tan λ)/(cos ϕn + f cot λ); eG = (cos ϕn − f cot λ)/(cos ϕn + f tan λ);
autobloqueo: **fstat < cos ϕn tan λ** para que el engrane pueda mover al sinfín;
W^t_W = W^t_G·(cos ϕn sin λ + f cos λ)/(cos ϕn cos λ − f sin λ);
**W^t_G = 33 000·nd·H0·Ka/(VG·e)** ← **aquí nd multiplica la CARGA**;
Vs = πd·nW/(12 cos λ); Hf = |Wf|·Vs/33 000;
Hloss = 33 000(1 − e)·Hin; ts = ta + Hloss/(ħCR·A).

**Eficiencia (Table 13-8, f = 0.05):** λ = 1° → 25.2 %; 2.5° → 45.7 %; 5° → 62.6 %; 7.5° → 71.3 %;
10° → 76.6 %; 15° → 82.7 %; 20° → 85.6 %; 30° → 88.7 %.
→ **El ángulo de avance es la palanca #1 de la eficiencia del sinfín.**

---

# 7. LAS DIEZ ⭐ — lo que una máquina lineal se saltaría

### ⭐1 — F no es una variable independiente: está en TRES lugares a la vez
Cambiar el ancho de cara no sólo divide el esfuerzo: **F entra en Ks (Eq. 14-29), en Cpf → Km
(Eqs. 14-32/14-30) y en el denominador del esfuerzo**. El Ejemplo 14-8 lo hace explícito: al pasar de
F = 3.0 a F = 3.5 in, recalcula **Ks (1.137 → 1.147) y Km (1.242 → 1.259)** antes de reevaluar σb.
Un implementador que "sólo divide entre F" da resultados mal. Y encima el rango 3p–5p **no es
física: es disponibilidad comercial** (§13-2, §14-1).

### ⭐2 — nb y nc NO son comparables, y la corrección cambia entre capítulos
- Cap. 14: **nc,linear = nc^i**, con **i = 2** (contacto lineal o helicoidal) e **i = 3** (contacto
  esférico, dientes coronados) — Eq. (14-43).
- Cap. 15: como SF y SH son ajustes a la **resistencia**, la comparación directa es **√SH contra SF**
  (§15-3); y la hoja de ruta Fig 15-14 define **nw = (σc,all/σc)²**.
- El origen (§14-2, Ej. 14-3): *"the ratio of loads is the ratio of stresses squared"*.
Un traductor de ecuaciones reportaría `min(nb, nc)` y **diría mal cuál modo es la amenaza**.

### ⭐3 — Cp para acero: 2300 √psi en el cap. 14, 2290 √psi en el cap. 15
Misma constante elástica, dos estándares AGMA distintos (2001-D04 vs 2003-B97), dos números. Igual
pasa con el exponente de B′/B2 en CH: **−0.0112 (rectos, Eq. 14-37)** vs **−0.0122 (cónicos, Eq.
15-17)**. No es errata: es que los estándares no se hablan. El sistema debe **versionar el factor por
estándar**, no tener "un" Cp global.

### ⭐4 — La ventana del diámetro del sinfín cambia entre §13-11 y §15-6
§13-11 Eq. (13-26): **C^0.875/3.0 ≤ dW ≤ C^0.875/1.7**.
§15-6 Eq. (15-27): **C^0.875/3 ≤ d ≤ C^0.875/1.6**.
El Ejemplo 15-4 usa la de 1.6. Un implementador que codifique la primera que leyó va a rechazar
diseños válidos (o al revés).

### ⭐5 — YN y ZN se evalúan en CICLOS DISTINTOS para piñón y engrane
(YN)P con N; **(YN)G con N/mG**. Ej. 14-8: (YN)P = 1.3558(10⁹)^−0.0178 = 0.938, pero
**(YN)G = 1.3558(10⁹/4)^−0.0178 = 0.961**. Y lo mismo en cónicos (Ej. 15-2: (CL)G con 10⁹/3).
Además **YN puede ser > 1** (vidas menores a 10⁷) y en la zona sombreada **el valor es un juicio**,
no un cálculo (velocidad de línea de paso, limpieza del material, esfuerzo residual, ductilidad y
tenacidad a la fractura). §14-13.

### ⭐6 — Ks es por-engrane, y en contacto entra bajo raíz
Ks depende de **Y**, que depende del número de dientes → **Ks del piñón ≠ Ks del engrane**. Y como el
esfuerzo de contacto va con la raíz de todo lo de adentro del corchete, el Ej. 14-5 lo propaga así:
**(σc)G = [(Ks)G/(Ks)P]^(1/2) · (σc)P**. Además §14-10 dice literalmente *"There is no rationale to
use Equation (14-29) for contact stress"* — **y sin embargo los ejemplos 14-4/14-5/14-8 sí meten Ks
en σc**. Es una contradicción real del texto; el sistema debe hacerla explícita y dejar la política
al usuario, no elegirla en silencio.

### ⭐7 — El chequeo del RIN va al final y puede tirar todo el diseño
Todo el Ej. 14-8 corre con **KB = 1 SUPUESTO** (*"Assume mB ≥ 1.2 in Eq. (14-40), KB = 1"*), y hasta
el último párrafo verifica tR ≥ 1.2·(2.25/P) = 0.675 in con la advertencia *"if it does not, review
and modify this mesh design"*. Es decir: **hay una precondición asumida al inicio que sólo se puede
verificar cuando ya existe el diseño del disco.** Un pipeline lineal jamás vuelve a ese punto.

### ⭐8 — En rectos JG > JP, pero en cónicos JP > JG: la amenaza de flexión CAMBIA DE MIEMBRO
Ej. 14-8 (rectos): JP = 0.32, JG = 0.415 → **el piñón es el crítico en flexión**, y Eq. (14-44)
formaliza que *"the gear can be less strong (lower Brinell hardness) than the pinion for the same
safety factor"*.
Ej. 15-2 (cónicos): JP = 0.248, JG = 0.202 y el libro lo subraya: *"**Note that JP > JG**"* → el
veredicto es *"the primary threat is from **gear** bending"*.
Un implementador que hereda la intuición de rectos endurece el miembro equivocado.

### ⭐9 — El número de dientes mínimo NO es una constante: depende de la razón Y del proceso
- Par 1:1, 20°: **13** (el cálculo da 12.3, pero *"for fully rotating gears, 13 teeth represents the
  least number"*).
- Para mG = 4: **16** (Eq. 13-11). Para cremallera o **generado con hob/shaper: 18** (Eq. 13-13).
- Y el mínimo aplicable se lee **entrando por la razón**, no por el número de dientes
  (Table 13-1, columna 4).
- El límite práctico mG ≤ 10 por par es lo que hace que 17 sea la última fila útil.
- En cónicos hay otra tabla: **16/16, 15/17, 14/20, 13/30** (Table 13-5).
- En sinfín, otra más: **Table 15-10, indexada por ϕn** (40 dientes a 14.5°, 10 a 30°).
Cuatro tablas de "mínimo de dientes" que no se parecen entre sí.

### ⭐10 — El factor de diseño entra por lados OPUESTOS según el tipo de engrane
- **Rectos/helicoidales**: SF y SH **dividen la resistencia** (Eqs. 14-17/14-18), y hay una decisión
  de política sobre si el margen vive en SF/SH o en nb/nc (§14-18).
- **Cónicos**: SF = nd, **SH = √nd** (Ej. 15-2: nd = 2 → SF = 2, SH = 1.414).
- **Sinfín**: **nd MULTIPLICA LA CARGA** — W^t_G = 33 000·nd·H0·Ka/(VG·e), Eq. (15-58); y encima
  convive con **Ka**, un factor de aplicación aparte.
Tres convenciones distintas en tres capítulos consecutivos. Si el sistema tiene un solo campo
"factor de seguridad", va a estar mal en dos de cada tres casos.

### Menciones honoríficas (⭐ que no cupieron)
- **Kv hay que VALIDARLO**: si V ≥ (Vt)max = [A + (Qv−3)]², el Kv calculado no aplica. El Ej. 15-1 lo
  verifica a mano; el Ej. 14-8 no.
- **Carga invertida (idlers) = 70 % de la resistencia** — §14-4 y §15-3. Es una regla a nivel de
  TREN (¿es rueda loca?), no de par de engranes, y ninguna ecuación la contiene.
- **CH aplica sólo al engrane, nunca al piñón** (§14-12), y **si fP > 64 μin, CH = 1** (Fig 14-13).
- **En cónicos el área/caja y en sinfín el ÁREA LATERAL DE LA CAJA son decisiones de diseño** con un
  gate térmico (ts) que puede obligar a ventilador, serpentín de agua o enfriador externo (§15-7).
- **Erratas del propio texto que un implementador copiaría**: Ej. 15-1 imprime *"Ko = 100"* (es 1.00)
  y *"H = min(12.9, 10.9)"* cuando arriba calculó 13.2; Ej. 14-7 usa 29 200 donde la Fig 14-5 dice
  29 100. **El cliente no es un oráculo: hay que validar sus números contra sus propias figuras.**

---

# 8. Huecos de requisitos que hay que preguntarle al cliente

1. **Figura de mérito / costo.** §14-19 lo declara faltante: *"a figure of merit in gear design is
   complex... because material and processing costs vary. The possibility of using a process depends
   on the manufacturing facility if gears are made in house."*
2. **KT arriba de 250 °F.** §14-15 dice *"the factor should be greater than unity"* pero **no da
   fórmula** (los cónicos sí: (460+t)/710).
3. **Cf (ZR).** *"Standard surface conditions for gear teeth have not yet been established."* No hay
   tabla ni ecuación. Sólo "usa >1 si sabes que hay un efecto perjudicial".
4. **Confiabilidad en sinfín.** *"Reliability information for worm gearing is not well developed at
   this time."*
5. **fstat para autobloqueo**: *"values of fstat can be found in ANSI/AGMA 6034-B92"* → **no aparece
   en el texto extraído**.
6. **Tablas 8, 9, 10 de 2001-D04** (factores metalúrgicos por grado para flame/induction y
   carburizado) → **no aparecen en el texto extraído**; el libro sólo las cita.
7. **J e I fuera de 20° full-depth**: *"For other gears, consult the AGMA standard."* (§14-5)
8. **Helicoidales LCR (mF ≤ 1)**: explícitamente fuera de alcance (§14-5).
9. **Valores numéricos de las Figs. 14-6/14-7/14-8 (J, J′, multiplicador), 15-6 (I) y 15-7 (J)**:
   son gráficas; **no aparecen tabulados en el texto extraído** — sólo los rangos y los puntos que
   usan los ejemplos.
