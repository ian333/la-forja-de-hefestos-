# Bertin & Cummings, *Aerodynamics for Engineers* 6ª ed. (2022) — caps. 1 a 5
## Lo aplicado: el vocabulario, la atmósfera, el flujo potencial, la capa límite y los parámetros del ala

**Fuente:** `docs/forja-research/manuales/aero/txt/bertin.txt`, líneas **514–16966** (leído completo,
sin muestreo). Offsets de capítulo: cap1=514, cap2=2255, cap3=5557, cap4=9939, cap5=13267.
**Fecha del análisis:** 2026-08-04.
**Ámbito:** capítulos 1 a 5. No invade el cap. 6 (teoría de perfil delgado y paneles de vórtices).

> Este documento sigue el `CONTRATO.md` del pliego AERO. Sus 7 reglas duras aplican a cada línea:
> **PROHIBIDO INVENTAR** (toda afirmación cita § y página); **cita literal** cuando la frase ES el
> requisito; **los ejemplos numéricos son fixtures de test**; **toda fórmula lleva su rango de
> validez y qué se rompe fuera**; **lo no observado se declara** (el texto viene de `pdftotext`:
> las figuras eran imagen); **cada método lleva marcado su costo de cómputo**; **cada bloque entrega
> escuela**. Español mexicano.

### Por qué este libro y no otro

El cliente nos entregó tres manuales. Raymer es **el proceso**, Anderson es **el motor**, y Bertin
es **lo aplicado**: donde Anderson deriva la ecuación, Bertin muestra qué hace un ingeniero con ella
un martes por la mañana, con datos de túnel de viento y de vuelo de aviones que existen. Ese
contraste es exactamente lo que el cliente pidió para entrenar ingenieros, y por eso este
entregable lleva una **sección 9 de contraste explícito con Anderson**: donde los dos manuales
difieren en un valor, un criterio o un rango, alguien de la empresa tendrá que tomar una decisión, y
más vale que la tome sabiendo que existe la diferencia.

---

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

### Cap. 1 — Why Study Aerodynamics? (pp. 1–32)


**Cap. 1 "Why Study Aerodynamics?" (pp. 1–32, líneas 514–2254).** No es un capítulo de relleno: es
el capítulo que define el **modelo de aire** con el que TODO lo demás se calcula, y la **nomenclatura
de partes del avión**. Contiene tres cosas que el cliente necesita literales:

1. **La técnica Energía-Maniobrabilidad (E-M) de John R. Boyd** (§1.1, pp. 2–8). Altura de energía
   `He` y potencia específica en exceso `Ps`. Es el puente entre aerodinámica y *performance*: el
   libro abre demostrando que la comparación ingenua (energía total) da un resultado ABSURDO
   (el B-52 "gana" 37.5 a 1 contra un F-5) y que hay que subir de nivel de abstracción dos veces
   (energía específica → derivada temporal de la energía específica) para llegar al número que
   importa. Esa es exactamente la lección de diseño conceptual que el cliente quiere enseñar.
2. **Propiedades del fluido y gas perfecto** (§1.2, pp. 8–17): ρ=p/RT, Sutherland para μ, a=√(γRT),
   viscosidad cinemática. Con sus constantes LITERALES en SI e inglés.
3. **La atmósfera estándar 1976** (§1.2.4–1.2.5, pp. 17–26): la ecuación hidrostática, las regiones
   gradiente e isotérmica, y **la Tabla 1.2A/1.2B completa** (0–30 km y 0–100 kft). Esta tabla es
   el fixture de regresión más barato y más usado de todo el motor: `src/aero/atmosfera.ts` debe
   reproducirla.
4. **Descripción del avión** (§1.3, pp. 26–27): el vocabulario de componentes (ala, flaps, spoilers,
   dispositivos de borde de ataque, dispositivos de punta, empenaje, estabilizadores, alerones,
   elevadores, timón, fuselaje, pilón, góndola). Es el árbol de componentes del CAD.

Por qué le importa al cliente: **el aire es un dato de entrada compartido por todo el software.**
Si `atmosfera.ts` se desvía de la Tabla 1.2, TODOS los estudios posteriores (arrastre, alcance,
Reynolds, Mach) mienten en la misma dirección y nadie lo nota. Es el cimiento.

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


El capítulo 2 es el **contrato matemático** de todo el resto del libro: aquí se derivan las tres leyes de conservación en forma diferencial *y* en forma integral, y se define qué significa que dos flujos sean "el mismo flujo". Para La Forja esto no es teoría de relleno: es el pliego del solver y del módulo de ensayos.

1. **§2.1 (pp. 34–36)** decide el marco de referencia: tierra-fijo (no estacionario) vs vehículo-fijo (estacionario). El libro elige vehículo-fijo por transformación galileana. Es una decisión de arquitectura del solver, no un detalle.
2. **§2.2 (pp. 36–40)** continuidad: diferencial (2.1)/(2.2), incompresible (2.3)/(2.4), integral (2.5). Incluye el **gate barato**: si un campo no conserva masa, no vale la pena analizarlo.
3. **§2.3 (pp. 40–46)** momento: derivada sustancial (2.7)–(2.9), tensor de esfuerzos isotrópico (2.10), ley constitutiva newtoniana con hipótesis de Stokes, Navier-Stokes (2.12a-c), forma integral (2.13). Aquí sale el conteo **5 incógnitas / 4 ecuaciones** que obliga a la ecuación de energía en flujo compresible.
4. **§2.4 (pp. 46–55)** las dos únicas maneras de resolver: EDO analítica (Poiseuille, Couette) o volumen de control integral (arrastre de placa plana). Trae 2 de los 3 fixtures numéricos más valiosos.
5. **§2.5 (pp. 55–63)** el corazón del capítulo para el cliente: **semejanza dinámica**. La adimensionalización que produce Mach (2.19) y Reynolds (2.20), la Fig. 2.13 (Re-M-altitud), Tablas 2.1 y 2.2 (regímenes), y el bloque de túnel de viento: qué se puede igualar y qué NO. Incluye el M6 de ONERA y el túnel 80×120 ft de NASA Ames con números duros.
6. **§2.6 (pp. 63–65)** capa límite como partición del dominio: viscoso pegado + no viscoso afuera, cuerpo efectivo = geometría + espesor de desplazamiento, y la aproximación ∂p/∂y ≈ 0 con su **fecha de caducidad** (Mach de borde ~20).
7. **§2.7–2.9 (pp. 65–76)** energía: primera ley, trabajo de flujo/viscoso/de eje, ecuación diferencial (2.32) con función de disipación, integral (2.33)/(2.37)/(2.38), y el resultado de que Bernoulli **es** la ecuación de energía bajo hipótesis fuertes.

Por qué le importa al cliente: es el capítulo que dice **cuándo un ensayo o una simulación es válida para el avión real** y cuándo no. Todo módulo de "escalar del modelo al avión" del CAD sale de aquí.

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
§        título                                                     pp.        qué aporta al producto
------------------------------------------------------------------------------------------------------------
—        Chapter Objectives                                         88         7 objetivos = temario de la escuela
3.1      Inviscid Flows                                             88–90      ecs. Euler (3.1a-c), (3.2); modelo de DOS REGIONES
3.2      Bernoulli's Equation                                       90–92      ecs. (3.3)–(3.11); LOS 5 SUPUESTOS; Ejemplo 3.1
3.3      Use of Bernoulli's Eq. to Determine Airspeed               93–95      Pitot-estática; IAS/CAS/EAS/TAS; TABLA 3.1
3.4      The Pressure Coefficient                                   96–98      ecs. (3.12), (3.13); TABLA 3.2; Ejemplo 3.2
3.5      Circulation                                                99–101     ecs. (3.14) Γ, (3.15) Green, (3.16) Stokes; caja "What Does Circulation Mean?"
3.6      Irrotational Flow                                          102        ecs. (3.17) rotacional, (3.18), (3.19) V=∇φ, (3.20)
3.7      Kelvin's Theorem                                           103–104    ecs. (3.21)–(3.25); §3.7.1 implicación
3.8      Incompressible, Irrotational Flow and the Vel. Potential   104–106    ec. (3.26) Laplace; §3.8.1 condición irrotacional; §3.8.2 Neumann/Dirichlet; caja "What Is Vorticity?" (ξ = 2ω)
3.9      Stream Function in a 2-D, Incompressible Flow              107–108    ecs. (3.27)–(3.30); Q = Δψ; "cualquier línea de corriente = pared sólida"
3.10     Relation Between Streamlines and Equipotential Lines       109–111    ecs. (3.31)–(3.33) ortogonalidad; Ejemplo 3.3
3.11     Superposition of Flows                                     112        linealidad; 2 condiciones de frontera; método INVERSO (Rankine 1871)
3.12     Elementary Flows                                           113–125    §3.12.1 uniforme (3.34,3.35a,3.35b); §3.12.2 fuente/sumidero (3.36,3.38a,3.38b) + Ejemplo 3.4;
                                                                               §3.12.3 doblete (3.39a,3.39b,3.39c); §3.12.4 vórtice potencial (3.40) + vórtice forzado;
                                                                               §3.12.5 TEOREMAS DE HELMHOLTZ (3 reglas); caja "A Real Vortex"; §3.12.6 TABLA 3.3;
                                                                               Ejemplo 3.5 (semicuerpo de Rankine), Ejemplo 3.6 (óvalo de Rankine)
3.13     Adding Elementary Flows … Flow Around a Cylinder           126–134    §3.13.1 (3.41a,3.41b,3.42); §3.13.2 (3.43),(3.44) + Figs 3.17/3.18/3.19 DATOS EXPERIMENTALES;
                                                                               §3.13.3 (3.45)–(3.52) sustentación/arrastre, PARADOJA DE D'ALEMBERT, Fig 3.21 Cd(Re)
3.14     Lift and Drag Coefficients as Dimensionless Parameters     134–139    ec. (3.53); Figs 3.22/3.23 (Talay 1975) con Cd LITERALES; Ejemplo 3.7 (quonset)
3.15     Flow Around a Cylinder with Circulation                    139–144    §3.15.1 (3.54),(3.55a),(3.55b),(3.56),(3.57); §3.15.2 KUTTA-JOUKOWSKI (3.58)–(3.61), Fig 3.25;
                                                                               §3.15.3 mapeo conforme / paneles / teoría de perfil delgado
3.16     Source Density Distribution on the Body Surface            144–148    MÉTODO DE PANELES: (3.62)–(3.70) + Ejemplo 3.8 (cilindro, 8 paneles) ← EL entregable implementable
3.17     Incompressible, Axisymmetric Flow                          149–152    (3.71)–(3.73); §3.17.1 esfera (3.74)–(3.80), Fig 3.31
3.18     Summary                                                    152        resumen del capítulo
—        Problems 3.1–3.52                                          152–164    banco de ejercicios (fuente de tests secundarios)
—        References                                                 165        Achenbach 1968, Hess & Smith 1966, Schlichting 1968, Talay 1975, Karamcheti 1980, Kellogg 1953,
                                                                               Hoerner 1958, Hoerner & Borst 1975, Campbell & Chambers 1994, Churchill & Brown 1984, US Std Atm 1976
```

EXAMPLE resueltos en el capítulo: **3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8** (ocho).
Tablas: **3.1** (q∞ y EAS vs TAS/altitud), **3.2** (Cp vs U y p), **3.3** (ψ y φ de los flujos elementales).
Figuras con datos: **3.17** (Cp cilindro, Schlichting), **3.19** (separación, Achenbach), **3.21** (Cd cilindro), **3.23** (Cd de 5 formas, Talay), **3.25c** (Cp con circulación), **3.31** (Cd esfera).

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


| § | Título | pp. | Qué entrega |
|---|---|---|---|
| — | Chapter Objectives | 166 | 8 objetivos; incluye "complete a control volume analysis" y "calculate the heat transfer … for a constant-property flow" |
| — | Introducción (modelo de dos regiones) | 166–167 | Partición viscoso/no-viscoso; iteración con δ* como "configuración efectiva" (Fig. 2.13) |
| 4.1 | Equations Governing the Boundary Layer for a Steady, Two-Dimensional, Incompressible Flow | 167–170 | Ecs. (4.1)–(4.6): continuidad, momento x/y, ∂p/∂y≈0, ∂p/∂x = −ρ_e u_e du_e/dx |
| 4.2 | Boundary Conditions | 170–171 | (4.7a) u(x,0)=0, (4.7b) v(x,0)=0, (4.8) u(x,y grande)=u_e |
| 4.3 | Incompressible, Laminar Boundary Layer | 171–188 | Transformación η, s; función de corriente transformada f; ecuación de Falkner-Skan (4.16); δ, δ*, θ, cf, Cf_tot, C_D |
| 4.3.1 | Numerical Solutions for the Falkner-Skan Problem | 174–188 | Tablas 4.1–4.3; β de separación = −0.1988; Ejemplos 4.1, 4.2, 4.3; Fig. 4.10 (Joukowski 4.6% vs 31%) |
| 4.4 | Boundary-Layer Transition | 189–192 | 6 parámetros que mueven transición; Re_x,tr = 500,000 (4.39); 7 regiones del proceso; by-pass |
| 4.5 | Incompressible, Turbulent Boundary Layer | 193–202 | Descomposición de Reynolds; esfuerzo de Reynolds; ley de la pared / log / defecto |
| 4.5.1 | Derivation of the Momentum Equation for Turbulent Boundary Layer | 195–197 | Ecs. (4.41)–(4.51) |
| 4.5.2 | Approaches to Turbulence Modeling | 197–199 | DNS/LES/RANS/DES; Re^{9/4}; citas literales Smith(1991), Neumann(1989), Salas(2006) |
| 4.5.3 | Turbulent Boundary Layer for a Flat Plate | 199–202 | u⁺=y⁺; ley log (4.57); ley de defecto (4.58); κ, A, B numéricos; Fig. 4.15 |
| 4.6 | Eddy Viscosity and Mixing Length Concepts | 202–205 | Boussinesq; Prandtl mixing length; modelo Cebeci-Smith de 2 capas (4.63)–(4.67); intermitencia de transición (4.68) |
| 4.7 | Integral Equations for a Flat-Plate Boundary Layer | 204–213 | Volumen de control (Fig. 4.17); Y−Y₀=δ*; C_d = 2θ/L |
| 4.7.1 | Application of the Integral Equations of Motion to a Turbulent, Flat-Plate Boundary Layer | 208–213 | Ley 1/7; Blasius turbulento; δ/δ*/θ turbulentos; cf y Cf_tot turbulentos; Prandtl-Schlichting / Karman-Schoenherr / Schultz-Grunow; corrección de transición (Tabla 4.5); Ejemplo 4.4 |
| 4.7.2 | Integral Solutions for a Turbulent Boundary Layer with a Pressure Gradient | 213–215 | Ec. integral de von Kármán (4.88); factor de forma H (4.89); método de Head (4.90)–(4.94); criterio de separación H |
| 4.8 | Thermal Boundary Layer for Constant-Property Flows | 215–221 | Ec. de energía (4.96); número de Prandtl (4.100); δ_T/δ |
| 4.8.1 | Reynolds Analogy | 216–218 | St (4.103); St = cf/2 (4.106); Ejemplo 4.5 |
| 4.8.2 | Thermal Boundary Layer for Pr ≠ 1 | 218–221 | Pohlhausen; q̇ (4.111); St laminar (4.112); Nu (4.113)–(4.114); analogía de Reynolds modificada (4.115); Ejemplos 4.6, 4.7 |
| 4.9 | Summary | 221 | Cierre |
| — | Problems 4.1–4.20 | 221–225 | 20 problemas (fuente secundaria de fixtures — enunciados sin respuesta) |
| — | References | 225 | 20 referencias |

**Lo que este capítulo NO cubre** (declarado por el propio libro): capa límite COMPRESIBLE → *"For a detailed
treatment of compressible boundary layers, you should consult Chapter 8, as well as Schlichting and Gersten (2000)
and Dorrance (1962)"* (§4.1, p.169). Perfiles laminares de ala → §6.6. Control de flujo laminar → §13.4.2.

---

### Cap. 5 — Characteristic Parameters for Airfoil and Wing Aerodynamics (pp. 226–293)


**Cap. 5 "Characteristic Parameters for Airfoil and Wing Aerodynamics" (pp. 226–293, líneas
13267–16966). ESTE ES EL CAPÍTULO DEL CONTRATO.** Es el diccionario con el que un ingeniero
de aeronaves habla, y —lo más importante para nosotros— **cada definición geométrica de aquí es
una COTA que el alumno va a dibujar en el croquis y una CANTIDAD que el kernel OCCT debe MEDIR
de la geometría real**, no pedirle al usuario que teclee.

- **§5.1 (pp. 227–231)** Fuerzas y momentos: ejes cuerpo (A, N) vs ejes viento (L, D); la rotación
  entre ellos; SLUF (L=W, T=D); trimado ΣM_cg=0 y el **trim drag (0.5%–5% del arrastre de crucero)**;
  los tres momentos (cabeceo M, alabeo ᏸ, guiñada ᏺ) con su convención de signo.
- **§5.2 (pp. 231–236)** Geometría del PERFIL: cuerda, línea de curvatura media, curvatura máxima,
  espesor máximo, radio de borde de ataque, ángulo de borde de salida. Nomenclatura NACA de 4
  dígitos y el sufijo de modificación. Efecto de cada parámetro. **Tabla de Clmax vs espesor
  (NACA 24xx) — dato experimental duro.**
- **§5.3 (pp. 236–243)** Geometría del ALA: S, b, c̄, AR, cr, ct, λ, Λ, **mac**, diedro, torsión
  geométrica (washout/washin), incidencia. **Tabla 5.1: 30 aviones reales con envergadura, AR,
  flecha, diedro, perfil y velocidad** — el corpus de validación del cliente. Ejemplos 5.1 y 5.2.
- **§5.4 (pp. 244–273)** Coeficientes: CL, Cl, CM, Cm, Cᏸ, Cᏺ, CD, Cd, y **la superficie de
  referencia**. Datos NACA 23012. Transición práctica. **Rugosidad: la definición literal de
  "standard roughness" de la NACA y los valores de grano de arena equivalente.** Y el plato fuerte:
  **el método de arrastre parásito de Shevell (componente por componente)** — un método completo,
  implementable en una hoja de cálculo, validado contra vuelo real del F-16.
- **§5.5 (pp. 273–288)** Ala finita: pendiente de sustentación 3D, polar de arrastre
  CD = CD0 + kCL² + ΔCDM, factor de Oswald, L/D, y **rangos de (L/D)max por clase de avión**.


---

## 1. REQUISITOS FUNCIONALES

Formato: `[dominio] [§ y página] requisito (APRENDER | CONSTRUIR | AMBOS)`.
Dominios: `geometria`, `aero2d`, `aero3d`, `compresible`, `viscoso`, `sizing`, `pesos`,
`estabilidad`, `performance`, `costos`, `optimizacion`, `escuela`.

### Cap. 1 — Why Study Aerodynamics? (pp. 1–32)


`[performance] [§1.1 p.3-7] Calcular altura de energía He = V²/2g + h y potencia específica en exceso Ps = (T-D)V/W para cualquier punto de vuelo (AMBOS)`
`[performance] [§1.1.2 p.7] Ps ES la derivada temporal de He: dHe/dt = (V/g)(dV/dt) + dh/dt. Una sola cantidad predice aceleración máxima Y régimen de ascenso máximo (AMBOS)`
`[escuela] [§1.1 p.4-5] El alumno debe VER que comparar energía TOTAL da un resultado absurdo (B-52 = 37.5× F-5) y que la energía ESPECÍFICA los iguala. La lección es elegir la magnitud adimensional correcta (APRENDER)`
`[viscoso] [§1.2.2 p.10] Marcar cuándo el continuo deja de valer: número de Knudsen = camino libre medio / dimensión característica; el modelo se rompe con Kn del orden de 0.1 (APRENDER)`
`[geometria] [§1.2.3 p.12] Exigir UNIDADES CONSISTENTES en todo el motor: SI (N, kg, m, s) o inglés (lbf, slug, ft, s). Convertir en la frontera de entrada, nunca a media fórmula (CONSTRUIR)`
`[compresible] [§1.2.3 p.12-13] Gas térmicamente perfecto ρ=p/RT con R=287.05 N·m/kg·K (SI) / 53.34 ft·lbf/lbm·°R / 1716.16 ft²/s²·°R. Temperatura SIEMPRE absoluta: K o °R, nunca °C ni °F (CONSTRUIR)`
`[viscoso] [§1.2.3 p.14] Viscosidad por Sutherland μ = C1·T^1.5/(T+C2). SI: C1=1.458e-6, C2=110.4. Inglés: C1=2.27e-8, C2=198.6 (CONSTRUIR)`
`[compresible] [§1.2.3 p.17] Velocidad del sonido a=√(γRT); para aire γ=1.4 → a=20.047√T (m/s, K) o a=49.02√T (ft/s, °R) (CONSTRUIR)`
`[sizing] [§1.2.4 p.21-22] Atmósfera analítica: región gradiente T=T0-Bz con T0=288.15 K y B=0.0065 K/m de 0 a 11,000 m; p=p0(1-Bz/T0)^(g/RB) con exponente g/RB=5.26 para aire; región isotérmica p2=p1·exp[g(z1-z2)/RT] (CONSTRUIR)`
`[sizing] [§1.2.5 p.18-20] Reproducir la Tabla 1.2A/1.2B (US Standard Atmosphere 1976) como tabla de regresión del módulo de atmósfera (CONSTRUIR)`
`[sizing] [§1.2.5 p.22] "a standard atmosphere is a valuable tool that provides engineers with a standard when conducting analyses and performance comparisons of different aircraft designs" — la atmósfera estándar existe para COMPARAR diseños, no para predecir el día de vuelo (APRENDER)`
`[geometria] [§1.3 p.26-27] Árbol de componentes del avión con su rol: superficies sustentadoras (ala, flaps, spoilers, dispositivos de borde de ataque, dispositivos de punta), superficies de control (alerones=alabeo, elevadores=cabeceo, timón=guiñada), y misceláneos (fuselaje, pilón, góndola) (CONSTRUIR)`
`[escuela] [§1.4 p.27] "Aerodynamics is all about estimating the pressures, shear stresses, heat, lift, drag, and moments created by various airplane components" — todo estudio del CAD debe devolver esas magnitudes, no gráficas bonitas (APRENDER)`

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


```
[aero2d]        [§2.1 p.34-36] El solver debe declarar su marco de referencia (tierra-fijo = no estacionario; vehículo-fijo = estacionario) y aplicar las condiciones de frontera correspondientes; ambos marcos deben dar las MISMAS fuerzas aerodinámicas (AMBOS)
[aero2d]        [§2.1 p.36] Convención de subíndice: ∞ (o 1) denota condiciones no perturbadas de corriente libre; en corriente libre no hay esfuerzos cortantes porque no hay movimiento relativo entre partículas (APRENDER)
[aero2d]        [§2.2 p.37] Implementar continuidad diferencial general, eq. (2.1)/(2.2), ∂ρ/∂t + ∇·(ρV) = 0 (CONSTRUIR)
[aero2d]        [§2.2 p.38] Implementar continuidad incompresible, eq. (2.3)/(2.4), ∇·V = 0, como CHEQUEO de admisibilidad física de cualquier campo de velocidad propuesto (CONSTRUIR)
[aero2d]        [§2.2 p.36] Gate de sanidad: "If mass is not conserved, then we are wasting our time analyzing the details of the flow, since it cannot occur physically" — el CAD debe correr este chequeo ANTES de cualquier post-proceso (CONSTRUIR)
[aero2d]        [§2.2 p.38] Condición de frontera de no penetración: componente normal de la velocidad = 0 en superficie sólida (CONSTRUIR)
[aero2d]        [§2.2 p.40] Implementar continuidad integral, eq. (2.5), ∂/∂t ∫ρ d(vol) + ∮ρV·n̂ dA = 0, con n̂ positivo hacia AFUERA del volumen (CONSTRUIR)
[aero2d]        [§2.2 p.40] Definir flujo volumétrico Q = ∮V·n̂ dA (se usa en cap. 3) (CONSTRUIR)
[aero2d]        [§2.3 p.41] Implementar la derivada sustancial eq. (2.7)–(2.9): d/dt = ∂/∂t + (V·∇); documentar que el libro usa d/dt donde otros autores usan D/Dt (AMBOS)
[aero2d]        [§2.3 p.41] Distinguir flujo estacionario de flujo sin aceleración: "even for a steady-state flow where ∂V/∂t is equal to zero, fluid particles can accelerate due to the unbalanced forces acting on them" (APRENDER)
[viscoso]       [§2.3 p.42] Nomenclatura del tensor de esfuerzos: primer subíndice = normal a la cara, segundo = dirección del esfuerzo; sistema derecho, normal saliente positiva (APRENDER)
[viscoso]       [§2.3 p.42] Eq. (2.10): por isotropía τxy=τyx, τyz=τzy, τzx=τxz — el tensor es simétrico; el solver solo almacena 6 componentes (CONSTRUIR)
[viscoso]       [§2.3 p.44] Ley constitutiva newtoniana con los 3 supuestos declarados (linealidad esfuerzo/rapidez de deformación, invariancia ante rotación o reflexión, reducción a presión hidrostática con gradientes nulos) (AMBOS)
[compresible]   [§2.3 p.44] Hipótesis de Stokes λ = -2/3 μ; el término de λ desaparece en flujo incompresible porque ∇·V = 0; el segundo coeficiente de viscosidad SOLO importa en problemas como la estructura interna de una onda de choque (AMBOS)
[viscoso]       [§2.3 p.44-45] Implementar Navier-Stokes eqs. (2.12a,b,c) con μ variable en el espacio (necesario en flujo compresible por variaciones fuertes de temperatura); unidades del término: fuerza por unidad de volumen (CONSTRUIR)
[viscoso]       [§2.3 p.44] La UI debe etiquetar cada término de (2.12a) como el libro: local acceleration, convection, body force, pressure force, stress force (ESCUELA/CONSTRUIR) (AMBOS)
[compresible]   [§2.3 p.45] Conteo de cierre: 5 variables primitivas (u,v,w,p,T) vs 4 ecuaciones (continuidad + 3 de momento) ⇒ el flujo general EXIGE la ecuación de energía; ρ y μ salen de estado y Sutherland, eqs. (1.10) y (1.12) (AMBOS)
[aero2d]        [§2.3 p.45] Degeneración a hidrostática: quitando aceleración y términos viscosos de (2.12) se recuperan las eqs. (1.16a-c) — usar como test de regresión del solver (CONSTRUIR)
[aero2d]        [§2.3 p.46] Implementar momento en forma integral, eq. (2.13): fuerzas de cuerpo + de superficie = ∂/∂t ∫ρV d(vol) + ∮V(ρV·n̂ dA) (CONSTRUIR)
[aero2d]        [§2.4 p.46] Definir "constant-property flow" = baja velocidad = incompresible; umbral: "A gas flow is considered incompressible if the Mach number is less than 0.3 to 0.5, depending upon the application" — el umbral es PARÁMETRO DEL USUARIO, no constante del código (AMBOS)
[aero2d]        [§2.4 p.46] En flujo de propiedades constantes hay 4 incógnitas y 4 ecuaciones: la energía NO se necesita para obtener velocidad y presión (APRENDER)
[viscoso]       [§2.4.1 p.46-49] Implementar flujo de Poiseuille: μ d²u/dy² = dp/dx = constante; perfil u = (1/2μ)(dp/dx)(y² - h²/4), parabólico, máximo al centro (CONSTRUIR)
[viscoso]       [§2.4.1 p.48-49] Condición de no deslizamiento: "the fluid particles at a solid surface move with the same speed as the surface" (CONSTRUIR)
[viscoso]       [§2.4.1 p.49] Distribución de esfuerzo cortante de Poiseuille τ = y·dp/dx; τ_inferior = +|h/2 · dp/dx|, τ_superior = -|h/2 · dp/dx|, y AMBOS producen arrastre hacia la derecha: el signo del muro superior es relativo al sistema local de esa pared (AMBOS)
[viscoso]       [§2.4.2 p.50] Implementar flujo de Couette: u/U = y/h + P(y/h)(1 - y/h) con P = -(h²/2μU)(dp/dx) (CONSTRUIR)
[viscoso]       [§2.4.2 p.50] Interpretación de P: P>0 gradiente favorable (flujo acelera); P<0 gradiente adverso (flujo REVERSADO, back flow); P=0 perfil lineal de corte puro (AMBOS)
[aero2d]        [§2.4.3 p.52] Método de volumen de control: en flujo completamente desarrollado el eflujo de momento en la estación 2 cancela el influjo en la 1 ⇒ ∮V(ρV·n̂dA)=0 y las fuerzas de superficie deben sumar cero (CONSTRUIR)
[aero2d]        [§2.4.3 p.53-55] Implementar el cálculo de arrastre por déficit de momento en la estela; definición del coeficiente Cd = d / (½ρ∞U∞²c) con área de referencia = cuerda por unidad de envergadura (CONSTRUIR)
[aero2d]        [§2.4.3 p.54] Para cerrar el balance de momento hay que usar PRIMERO continuidad integral para obtener el gasto Q2 que sale por la frontera superior del volumen de control (CONSTRUIR)
[viscoso]       [§2.2 p.39] Una línea horizontal a altura constante sobre una placa plana NO es línea de corriente dentro de la capa límite: hay velocidad vertical v_e ≠ 0 cruzándola (AMBOS)
[sizing]        [§2.5 p.55] Objetivos declarados de un programa de ensayos: (1) generar datos para modelos de flujo numéricos, (2) estudiar efecto de parámetros geométricos, (3) verificar predicciones numéricas, (4) medir directamente características de un vehículo completo (APRENDER)
[sizing]        [§2.5 p.55-56] Lista de Bushnell (2006) de fuentes de error de túnel: paredes y su corrección, distorsión aeroelástica por estructura/material distintos, escalamiento de Reynolds (crítico en transónico, vórtices longitudinales, flujo transicional), campo de perturbaciones de la corriente libre y su efecto en la transición, montaje (stings, struts, alambres), no estacionariedad gruesa de la corriente (buffet de ala), propulsión instalada o su ausencia, fidelidad geométrica ("critical differences in results for even 'minor' differences in the model") (AMBOS)
[aero2d]        [§2.5 p.57-58] Implementar la adimensionalización canónica: p*=p/p∞, ρ*=ρ/ρ∞, μ*=μ/μ∞, u*=u/U∞, x*=x/L, t*=tU∞/L (CONSTRUIR)
[compresible]   [§2.5 p.58] Primer parámetro de semejanza eq. (2.18) p∞/(ρ∞U∞²) que por gas perfecto se reduce a eq. (2.19) = 1/(γM∞²) (CONSTRUIR)
[viscoso]       [§2.5 p.59] Segundo parámetro (su inverso) eq. (2.20): Re∞,L = ρ∞U∞L/μ∞, "a measure of the ratio of inertia effects to viscous effects" (CONSTRUIR)
[sizing]        [§2.5 p.59] Criterio de semejanza dinámica: dos flujos geométricamente semejantes son dinámicamente semejantes si M1=M2 y Re1=Re2; derivado SOLO para flujos de propiedades constantes (AMBOS)
[sizing]        [§2.5 p.59-60] Módulo de correlación Re/M vs velocidad y altitud (Fig. 2.13), con L=1.0 m de referencia, altitudes hasta 30 km (9.84×10⁴ ft) y velocidades hasta 2500 km/h (1554 mi/h, 1350 nudos); 1 nudo ≡ 1 milla náutica por hora (CONSTRUIR)
[sizing]        [§2.5 p.60] La longitud característica L es elección del ingeniero (cuerda del ala, diámetro del misil); el reporte debe imprimir SIEMPRE contra qué L se calculó el Reynolds (CONSTRUIR)
[compresible]   [§2.5 p.61] Tabla 2.1 — regímenes de Mach para un perfil: incompresible subsónico 0<M<~0.3; compresible subsónico 0.3<M<~0.8; transónico 0.8<M<~1.6; supersónico 1.6<M<~5.0; hipersónico M>~5.0 (AMBOS)
[viscoso]       [§2.5 p.62] Tabla 2.2 — regímenes de Reynolds para un perfil: creep 0<ReL<~10²; laminar de bajo Re 10²<ReL<~10⁴; laminar 10⁴<ReL<~10⁵; transicional 10⁵<ReL<~10⁶; turbulento ReL>~10⁶ (AMBOS)
[sizing]        [§2.5 p.61] Regla de igualación por RÉGIMEN, no por valor exacto: si M=0.2 basta caer en el mismo régimen; si Re=5×10⁷ no hace falta igualarlo exacto mientras separación y fricción superficial queden bien representadas (AMBOS)
[sizing]        [§2.5 p.63] Restricción dura de producto: los túneles para aviones grandes "are capable of matching the Mach number, but cannot match the Reynolds number due to model size restrictions and tunnel operational conditions (pressure and temperature limitations)" (AMBOS)
[sizing]        [§2.5 p.63] Datos del túnel más grande: NASA Ames 80 ft × 120 ft, seis ventiladores de 40 ft de diámetro, motor de 18,000 hp cada uno, velocidad máxima ~100 nudos (APRENDER)
[sizing]        [§2.5 p.63] Alternativa McMasters (2007): modelo a ¼ de escala radiocontrolado a baja altitud, mismo Mach y mismo CL ⇒ Re ≈ 30×10⁶ contra 36×10⁶ del 767 real (>80%), mucho más barato que el túnel (AMBOS)
[viscoso]       [§2.6 p.63] Partición del dominio en flujo de alto Reynolds: capa límite viscosa pegada + flujo esencialmente no viscoso afuera (CONSTRUIR)
[geometria]     [§2.6 p.63] "Cuerpo efectivo no viscoso" = geometría real + espesor de desplazamiento; el CAD debe poder generar y exportar esa geometría desplazada (CONSTRUIR)
[aero2d]        [§2.6 p.63] Condición de frontera del solver no viscoso: velocidad paralela a la superficie, no necesariamente de magnitud cero (CONSTRUIR)
[viscoso]       [§2.6 p.65] Aproximación de capa delgada: |∂p/∂y| < |∂p/∂x| ⇒ ∂p/∂y ≈ 0, verificado experimentalmente para placa plana; la distribución de presión sobre el perfil es esencialmente la no viscosa (AMBOS)
[viscoso]       [§2.6 p.65] LÍMITE de esa aproximación: falla en capas límite TURBULENTAS a Mach muy alto; Bushnell et al. (1977) reporta presión de pared significativamente mayor que la del borde con Mach de borde ≈ 20 (AMBOS)
[viscoso]       [§2.6 p.65] Reynolds como indicador de cuánto del campo puede describirse con ecuaciones no viscosas: al separar (gradiente adverso + fuerzas viscosas, cuerpos romos o perfiles a alto ángulo de ataque) el campo es muy sensible a Re (AMBOS)
[compresible]   [§2.7 p.65-66] Regla de acoplamiento: con propiedades constantes continuidad+momento son independientes de la energía (se resuelve después); en flujo compresible las tres se resuelven SIMULTÁNEAMENTE (CONSTRUIR)
[compresible]   [§2.8 p.66] Primera ley en proceso cíclico eq. (2.21) ∮dq - ∮dw = 0; convención de signos: calor HACIA el sistema positivo, trabajo HECHO POR el sistema positivo (AMBOS)
[compresible]   [§2.8 p.66] Eq. (2.22) dq - dw = de; e es propiedad (diferencial exacta), q y w NO lo son (dependen del proceso) (APRENDER)
[compresible]   [§2.8 p.67] Eq. (2.23) dq - dw = d(ke) + d(pe) + d(ue); el libro solo considera energías cinética, potencial e interna — química y nuclear quedan fuera del alcance de aerodinámica (APRENDER)
[compresible]   [§2.8 p.67] Trabajo de presión reversible eq. (2.24a) dw = +p dv con v = 1/ρ (volumen específico); OJO: el símbolo v aquí NO es la componente y de velocidad (AMBOS)
[compresible]   [§2.9 p.69] Ley de Fourier de conducción: Q̇ = -k n̂A·∇T (CONSTRUIR)
[compresible]   [§2.9 p.70] Definición de entalpía específica eq. (2.30) h ≡ ue + p/ρ (CONSTRUIR)
[compresible]   [§2.9 p.71] Implementar la ecuación de energía diferencial 3D eq. (2.32a): ρ dh/dt - dp/dt = ∇·(k∇T) + Φ (CONSTRUIR)
[viscoso]       [§2.9 p.71] Implementar la función de disipación eq. (2.32b) Φ = rapidez con que las fuerzas viscosas hacen trabajo por unidad de volumen (CONSTRUIR)
[compresible]   [§2.9.1 p.71] Energía en forma integral eq. (2.33): Q̇ - Ẇ = ∂/∂t ∫ρe d(vol) + ∮eρV·n̂ dA (CONSTRUIR)
[compresible]   [§2.9.2 p.71-72] Descomposición e = ke + pe + ue con ke = V²/2 y pe = gz (CONSTRUIR)
[compresible]   [§2.9.3-2.9.5 p.72-73] Separar el trabajo total en trabajo de flujo (2.36a,b), trabajo viscoso (2.36c) Ẇv = -τ·V dA y trabajo de eje; turbina ⇒ Ẇs positivo, bomba ⇒ Ẇs negativo (CONSTRUIR)
[compresible]   [§2.9.6 p.74] Forma operativa eq. (2.37) con el trabajo de flujo ya absorbido en la integral de superficie (p/ρ dentro del paréntesis) (CONSTRUIR)
[compresible]   [§2.9.6 p.74] Caso estacionario, adiabático, sin trabajo de eje ni viscoso eq. (2.38): ∮ρ(V²/2 + gz + h)V·n̂ dA = 0 (CONSTRUIR)
[aero2d]        [§2.9.6 p.75] Bernoulli EMERGE de la ecuación de energía para flujo incompresible, estacionario y no disipativo: "a mechanical energy equation that simply equates the flow work with the sum of the changes in potential energy and in kinetic energy" (AMBOS)
[compresible]   [§2.10 p.76] Resumen del set completo: continuidad (2.2)/(2.5), momento (2.12)/(2.13), energía (2.32)/(2.33); incógnitas: presión, temperatura, velocidad, densidad, viscosidad, conductividad térmica, energía interna y entalpía (APRENDER)
[performance]   [Prob. 2.38-2.39 p.86-87] Temperatura total de una forma-1D adiabática: Ht = h∞ + ½U∞², h∞ = cpT∞, Ht = cpTt, con cp = 0.2404 Btu/lbm·R — criterio de "¿el calentamiento convectivo es problema?" (Cessna 172 a 130 mi/h/10,000 ft vs SR-71 a M=3/80,000 ft) (AMBOS)
[escuela]       [§2.5 p.61] Enseñar los regímenes ANTES de enseñar el solver: "These are concepts that experienced aerodynamicists need to understand, so start trying to absorb the material in these two tables" (APRENDER)
[escuela]       [Cap. 2 p.34] Todo modelo simplificado debe traer su verificación: "The validity of the simplifying approximations for a particular application should always be verified experimentally" (AMBOS)
```

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
[aero2d]        [§3.1 p.89]    El solver debe trabajar con un MODELO DE DOS REGIONES: "one region in which the viscous forces
                               are negligible, i.e., the inviscid region, and one region in which viscous forces cannot be
                               neglected, i.e., the viscous boundary layer near the surface". El resultado no viscoso es la
                               CONDICIÓN DE FRONTERA de la capa límite (cap. 4-5). (AMBOS)
[aero2d]        [§3.1 p.89]    Usar el término "inviscid FLOW", no "inviscid fluid": la viscosidad no es cero, el producto
                               μ·(du/dy) es despreciable en esa región. El UI no debe decir "fluido ideal". (APRENDER)
[aero2d]        [§3.1 p.90]    Implementar las ecuaciones de Euler (3.1a-c)/(3.2) como base declarada del solver; válidas también
                               para flujo compresible ("No assumption has been made about density up to now"). (APRENDER)
[aero2d]        [§3.2 p.90]    Gate de compresibilidad: "compressibility effects are negligible when the Mach number is less
                               than M ≈ 0.3". El estudio potencial debe BLOQUEARSE o advertir sobre M∞ > 0.3. (CONSTRUIR)
[aero2d]        [§3.2 p.90-91] Bernoulli exige LOS 5 SUPUESTOS (lista literal en la §FISICA). El estudio debe mostrar los 5 y
                               marcar cuál se viola en cada punto de sonda. (AMBOS)
[aero2d]        [§3.2 p.91]    Distinguir "válida en TODO el campo" (flujo irrotacional) de "válida SOLO a lo largo de una
                               línea de corriente" (flujo rotacional). Es la regla que decide si el sondeo de presión es legal. (AMBOS)
[aero2d]        [§3.2 p.91]    Con densidad constante NO se necesita la ecuación de la energía para resolver V y p. (APRENDER)
[aero2d]        [§3.2 p.91]    En problemas aerodinámicos se desprecia el cambio de energía potencial → ec. (3.10) p + ½ρU² = cte.
                               Para líquidos/tanques hay que conservar el término gz de (3.9). (CONSTRUIR)
[aero2d]        [§3.2 p.92]    Transformación galileana OBLIGATORIA: el flujo en ejes tierra es NO estacionario y Bernoulli NO
                               aplica; hay que pasar a ejes vehículo. El CAD debe declarar en qué marco está el estudio. (AMBOS)
[performance]   [§3.3 p.93]    Sonda Pitot-estática: U∞ = sqrt(2(pt − p∞)/ρ∞). Requiere la densidad de la altitud de vuelo. (CONSTRUIR)
[performance]   [§3.3 p.93]    "the pressure sensed at the static port may be significantly different from the free-stream static
                               pressure, depending on the orientation of the aircraft" → error de posición dependiente de α. (APRENDER)
[performance]   [§3.3 p.94-95] Cadena IAS → CAS → EAS → TAS con las 4 definiciones literales; TAS = EAS·sqrt(ρSL/ρ). (AMBOS)
[performance]   [§3.3 p.95]    Tabla 3.1 (q∞ y EAS vs TAS y altitud, US Std Atm 1976) como test de la calculadora de velocidades. (CONSTRUIR)
[aero2d]        [§3.4 p.96]    Cp ≡ (p − p∞)/q∞ = (p − p∞)/(½ρ∞U∞²) [ec. 3.12]. Toda salida de presión del estudio en Cp. (CONSTRUIR)
[aero2d]        [§3.4 p.96]    Cp = 1 − U²/U∞² [ec. 3.13] SOLO donde Bernoulli aplica. Cp,t = 1.0 en el punto de remanso,
                               "independent of the free-stream flow conditions or the configuration geometry" (incompresible). (AMBOS)
[aero2d]        [§3.4 p.96]    Tabla 3.2 como invariante de la leyenda de color: U<U∞ ⇒ p>p∞ ⇒ Cp>0; U=U∞ ⇒ Cp=0; U>U∞ ⇒ Cp<0. (CONSTRUIR)
[viscoso]       [§3.4 p.97-98] La presión estática es esencialmente constante a través de una capa límite delgada → la toma en la
                               pared da la presión del borde de la capa límite. Justifica leer Cp de pared. (APRENDER)
[aero2d]        [§3.5 p.99]    Circulación: −Γ = ∮_C V·ds [ec. 3.14], integración ANTIHORARIA (área siempre a la izquierda),
                               con SIGNO NEGATIVO por convención de superficies sustentadoras. (AMBOS)
[aero2d]        [§3.5 p.100]   Green (3.15) y Stokes (3.16); Stokes NO vale si el área contiene velocidad infinita (vórtice). (AMBOS)
[escuela]       [§3.5 p.101]   Caja de concepto: "circulation can only exist if the flow is turned"; el contorno es FICTICIO. (APRENDER)
[aero2d]        [§3.6 p.102]   Irrotacionalidad: ∇×V = 0 [ec. 3.17] ⇒ Γ = 0 y la integral de línea es independiente del camino
                               ⇒ existe φ con V = ∇φ [ec. 3.19]. "That is why an irrotational flow is also called a potential flow". (AMBOS)
[aero2d]        [§3.7 p.103]   Teorema de Kelvin: "For an inviscid, barotropic flow with conservative body forces, the circulation
                               around a closed fluid line remains constant with respect to time" [ecs. 3.21–3.25]. (APRENDER)
[aero2d]        [§3.7.1 p.104] Implicación: partiendo del reposo o de corriente uniforme y paralela, TODO el campo permanece
                               irrotacional salvo donde la viscosidad importa. Es la licencia para usar potencial. (AMBOS)
[aero2d]        [§3.8 p.104]   Ecuación gobernante: ∇²φ = 0 [ec. 3.26], "a linear, second-order partial differential equation of
                               the elliptic type". La linealidad HABILITA la superposición. (CONSTRUIR)
[aero2d]        [§3.8.1 p.105] El potencial de velocidad satisface IDÉNTICAMENTE la irrotacionalidad (por eso se definió así). (APRENDER)
[aero2d]        [§3.8.2 p.105] Condición de frontera NEUMANN: ∇φ·n̂ = 0 en pared sólida. "For applications in this book, the
                               Neumann formulation will be used". Dirichlet (φ prescrito) queda como alternativa declarada. (CONSTRUIR)
[escuela]       [§3.8 p.106]   Vorticidad ξ = ∇×V = 2ω (el DOBLE de la velocidad de rotación del elemento). NO confundir
                               rotación del elemento con curvatura de la trayectoria. (APRENDER)
[aero2d]        [§3.9 p.107]   Función de corriente: u = ∂ψ/∂y, v = −∂ψ/∂x [ec. 3.27a,b]; satisface continuidad idénticamente;
                               EXISTE también para flujo ROTACIONAL y para compresible estacionario. (AMBOS)
[aero2d]        [§3.9 p.108]   Q = Δψ: el caudal por unidad de profundidad entre dos puntos es la diferencia de ψ. Métrica de
                               verificación del visualizador de líneas de corriente. (CONSTRUIR)
[geometria]     [§3.9 p.108]   "Any streamline in an inviscid flow can be replaced by a solid boundary of the same shape without
                               affecting the remainder of the flow pattern" → el generador de cuerpos por método inverso. (CONSTRUIR)
[aero2d]        [§3.9 p.108]   Coordenadas cilíndricas: vr = (1/r)∂ψ/∂θ, vθ = −∂ψ/∂r [ec. 3.29]. (CONSTRUIR)
[aero2d]        [§3.10 p.109]  Ortogonalidad ψ ⟂ φ [ecs. 3.31–3.33], EXCEPTO en puntos de remanso donde ambas componentes se
                               anulan simultáneamente. El render de la malla debe excluir esos puntos. (AMBOS)
[aero2d]        [§3.11 p.112]  Dos condiciones de frontera del flujo potencial: (1) V → U∞ lejos del cuerpo; (2) componente normal
                               a la pared = 0 (la superficie ES una línea de corriente). (CONSTRUIR)
[aero2d]        [§3.11 p.112]  MÉTODO INVERSO (Rankine 1871): singularidades + corriente incidente ⇒ dibujar ψ ⇒ elegir la línea
                               que coincide con la forma buscada. Habilita "semicuerpo/óvalo de Rankine" en la escuela. (AMBOS)
[aero2d]        [§3.11 p.112]  ⚠ "pressures of the component flows cannot be superimposed … since they are nonlinear functions of
                               the velocity". SE SUMAN VELOCIDADES (o φ, o ψ), NUNCA presiones. Invariante duro del código. (CONSTRUIR)
[aero2d]        [§3.12.1 p.113] Flujo uniforme: φ = U∞r cosθ (3.34), φ = U∞x + C (3.35a), φ = U∞(x cosα + y sinα) (3.35b);
                               ψ = U∞y. (CONSTRUIR)
[aero2d]        [§3.12.2 p.114] Fuente: φ = (K/2π)·ln r (3.36); sumidero φ = −(K/2π)ln r (3.38a); ψ = Kθ/2π (3.38b);
                               vr = K/(2πr), vθ = 0. Dimensiones de K = (longitud)²/(tiempo). (CONSTRUIR)
[aero2d]        [§3.12.3 p.116] Doblete: definido por lim_{a→0}(K·a) = 2πB; φ = (B/r)cosθ (3.39a); ψ = −(B/r)sinθ (3.39b);
                               eje a ángulo α: φ = −(B/r)cosα·cosθ (3.39c). (CONSTRUIR)
[aero2d]        [§3.12.4 p.117] Vórtice potencial (circulación HORARIA): φ = −Γθ/2π (3.40), ψ = (Γ/2π)ln r, vr = 0,
                               vθ = −Γ/(2πr). Irrotacional salvo en r = 0, donde hay vorticidad y v → ∞. (CONSTRUIR)
[aero2d]        [§3.12.4 p.119] Γ alrededor de una curva que ENCIERRA el origen = Γ; alrededor de una que NO lo encierra = 0.
                               "circulation requires vorticity to exist". Test del integrador de circulación. (CONSTRUIR)
[aero2d]        [§3.12.4 p.120] Vórtice FORZADO (sólido rígido): vr = 0, vθ = rω ⇒ ∇×V = 2ω ≠ 0 ⇒ NO admite potencial. (APRENDER)
[aero3d]        [§3.12.5 p.120] Teoremas de vórtice de Helmholtz (1858), los TRES literales — base de la teoría de ala del cap. 7. (AMBOS)
[aero2d]        [§3.12.6 p.118] Tabla 3.3 = catálogo canónico de ψ y φ (uniforme, uniforme a α, fuente, doblete, vórtice,
                               esquina 90°, rotación de sólido rígido). Es la tabla que debe implementar `potencial.ts`. (CONSTRUIR)
[geometria]     [§3.12 p.123-126] Semicuerpo de Rankine (uniforme+fuente, Ej. 3.5) y óvalo de Rankine (uniforme+fuente+sumidero,
                               Ej. 3.6). "as long as the total source strength was equal and opposite to the total sink strength,
                               the body would close at the rear" → criterio de CIERRE de cuerpo. (AMBOS)
[aero2d]        [§3.13.1 p.127] Cilindro sin circulación: R = sqrt(B/U∞), B = R²U∞; vθ = −U∞ sinθ(1 + R²/r²) (3.41a),
                               vr = U∞cosθ(1 − R²/r²) (3.41b); en la superficie vθ = −2U∞ sinθ (3.42). (CONSTRUIR)
[aero2d]        [§3.13.2 p.129] Cp = 1 − 4sin²θ (3.44); p = p∞ + ½ρ∞U∞²(1 − 4sin²θ) (3.43). |U|max = 2U∞ en θ = 90° y 270°.
                               θ = 180° es el remanso de BARLOVENTO, θ = 0° el de SOTAVENTO. (CONSTRUIR)
[viscoso]       [§3.13.2 p.130] Datos de separación (Achenbach 1968, Fig 3.19): subcrítico Red < ~3×10⁵ ⇒ separación en θ ≈ 100°
                               (80° desde el remanso de barlovento); región crítica ⇒ burbuja + separación final en θ = 40°
                               (140° desde el remanso); Red > 1.5×10⁶ ⇒ supercrítico, separación en 60° < θ < 70°. (AMBOS)
[viscoso]       [§3.13.2 p.130] El Re crítico "is sensitive both to the turbulence level in the free stream and to the surface
                               roughness" → cualquier predicción de separación debe llevar esa advertencia. (APRENDER)
[aero2d]        [§3.13.3 p.131-133] l = 0 (3.46) y d = 0 (3.51) para el cilindro sin circulación: PARADOJA DE D'ALEMBERT (1752),
                               resuelta por Prandtl con la capa límite. Es un test de regresión, no un bug. (AMBOS)
[aero2d]        [§3.13.3 p.132] Cl = l/(q∞·2R) (3.49) y Cd = d/(q∞·2R) (3.52), ambos con la INTEGRAL DE Cp:
                               Cl = −½∫₀^{2π} Cp sinθ dθ (3.48); Cd = −½∫₀^{2π} Cp cosθ dθ (3.52). Área de referencia = 2R. (CONSTRUIR)
[viscoso]       [§3.13.3 p.133] Descomposición del arrastre: "pressure (or form) drag" vs "skin-friction drag". En el cilindro real
                               el skin friction es pequeño y el form drag domina; con capa límite turbulenta el form drag es
                               "markedly less". (AMBOS)
[viscoso]       [§3.13.3 p.134] Cd del cilindro liso ≈ 1.2 y esencialmente constante para Re < 300,000 (Schlichting 1968). (CONSTRUIR)
[viscoso]       [§3.13.3 p.134] Trip de transición deliberado: hoyuelos de pelota de golf / costuras de béisbol reducen el form drag
                               a costa de un ligero aumento del friccional. (APRENDER)
[aero2d]        [§3.14 p.135]  Coeficiente de fuerza CF = fuerza/(½ρ∞U∞²·S) (3.53); si el vano es infinito, el área de referencia
                               es POR UNIDAD DE VANO y el coeficiente se llama "section coefficient". (CONSTRUIR)
[sizing]        [§3.14 p.137]  Cd literales de la Fig 3.23 (Talay 1975): placa plana de canto 2.0; cilindro grande subcrítico 1.2;
                               cuerpo fuselado 0.12; cilindro pequeño (0.1d) subcrítico 1.2; cilindro grande supercrítico 0.6.
                               ⇒ el fuselado a igual ancho baja Cd ×10, y "the total drag of the small cylinder is equal to that
                               of the much thicker streamlined shape". (AMBOS)
[costos]        [§3.14 p.137]  Fuente de datos declarada para coeficientes reales: Hoerner (1958) *Fluid Dynamic Drag* y
                               Hoerner & Borst (1975) *Fluid Dynamic Lift*. (APRENDER)
[aero2d]        [§3.15.1 p.139-140] Cilindro CON circulación: φ = U∞r cosθ + (B/r)cosθ − Γθ/2π (3.54); vθ superficie =
                               −2U∞ sinθ − Γ/(2πR) (3.56); Cp = 1 − [4sin²θ + 2Γ sinθ/(πRU∞) + (Γ/2πRU∞)²] (3.57). Con Γ = 0
                               debe REDUCIRSE exactamente a (3.44) — test de regresión obligatorio. (CONSTRUIR)
[aero2d]        [§3.15.2 p.140] Con circulación el arrastre SIGUE siendo cero: "The prediction of zero drag may be generalized to
                               apply to any general, two-dimensional body in an irrotational, steady, incompressible flow". (AMBOS)
[aero2d]        [§3.15.2 p.141] TEOREMA DE KUTTA-JOUKOWSKI: l = ρ∞U∞Γ (3.58). "applies to the potential flow about closed cylinders
                               of arbitrary cross section" — vale para CUALQUIER sección cerrada, no solo el círculo. (CONSTRUIR)
[aero2d]        [§3.15.2 p.141] Puntos de remanso: θ = sin⁻¹(−Γ/(4πRU∞)) (3.59). Γ < 4πRU∞ ⇒ dos puntos simétricos; Γ = 4πRU∞ ⇒
                               uno solo en θ = 270°; Γ mayor ⇒ ninguno sobre el cuerpo. (CONSTRUIR)
[aero2d]        [§3.15.2 p.141] Cl,max = 4π para el cilindro con circulación (3.61) — "an important upper limit for airfoil
                               aerodynamics". (AMBOS)
[aero2d]        [§3.15.3 p.143] Tres vías para llevar el potencial a perfiles reales: mapeo conforme (Joukowski), MÉTODO DE PANELES
                               (§3.16), teoría de perfil delgado (cap. 6). (APRENDER)
[aero2d]        [§3.16 p.144-146] MÉTODO DE PANELES DE FUENTES: ecs. (3.62)–(3.70) — ver §ALGORITMO-PANELES. Referencia canónica:
                               Hess & Smith (1966). (CONSTRUIR)
[geometria]     [§3.16 p.144]  Sistema de coordenadas del capítulo de paneles: x en dirección de la CUERDA, y en dirección de la
                               ENVERGADURA, z normal. Todos los cálculos 2D son "per unit length along the y axis". Cuidado: choca
                               con el (x, y) de §3.9-3.15. (CONSTRUIR)
[aero2d]        [§3.16 p.145]  Puntos de control = PUNTOS MEDIOS de los paneles; densidad de fuente κ_j UNIFORME por panel. (CONSTRUIR)
[aero2d]        [§3.16 p.146]  Lift en paneles requiere "including vortex or doublet distributions and by introducing the Kutta
                               condition" — el cap. 3 NO lo hace: se difiere a los caps. 6 y 7. (APRENDER)
[aero2d]        [§3.16 p.148]  Invariante de cierre: Σκ_i = 0 (3.70) "as must be true … if we are to have a closed configuration".
                               Es el ASSERT numérico del solver de paneles. (CONSTRUIR)
[aero3d]        [§3.17 p.149]  Flujo axisimétrico: vθ ≡ 0, ∂/∂θ ≡ 0; continuidad (3.71); ψ de Stokes: vr = (1/r)∂ψ/∂z,
                               vz = −(1/r)∂ψ/∂r (3.72). ψ = cte define una SUPERFICIE de corriente. (CONSTRUIR)
[aero3d]        [§3.17.1 p.150-151] Esfera: φ = U∞r cosν + (B/4πr²)cosν (3.74) con B = 2πU∞R³; vr (3.76a), vν (3.76b);
                               U_superficie = −(3/2)U∞ sinν (3.77); Cp = 1 − (9/4)sin²ν (3.79). CONTRASTAR con el cilindro:
                               "although the configurations have the same cross section … the flows are significantly different". (AMBOS)
[aero3d]        [§3.17.1 p.152] CD de esfera = arrastre/(q∞·πd²/4) (3.80) — área de referencia FRONTAL, distinta del cilindro (2R). (CONSTRUIR)
[escuela]       [§3.18 p.152]  El resumen del capítulo es el guion del cierre de la lección: Euler → Kelvin → potencial →
                               superposición → Bernoulli → condición de borde de la capa límite. (APRENDER)
[optimizacion]  [§3.11+§3.16]  El campo potencial permite evaluación de MILES de variantes geométricas en tiempo interactivo
                               (matriz densa M×M) — habilita barridos paramétricos de forma en el navegador. (CONSTRUIR)
```

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


```
[viscoso]      [§4.1 p.168-169]  El solver de capa límite asume flujo estacionario, 2D, propiedad constante; ecuaciones (4.1) continuidad y (4.6) momento-x. (CONSTRUIR)
[viscoso]      [§4.1 p.169]      ∂p/∂y ≈ 0 dentro de la capa límite: la presión estática es función SOLO de x y viene del solver no-viscoso. El acoplamiento panel→capa límite pasa p(x) sin corrección transversal. (CONSTRUIR)
[viscoso]      [§4.1 p.169]      El gradiente de presión se evalúa como −∂p/∂x = ρ_e u_e du_e/dx, ec. (4.5). El input del módulo viscoso es u_e(x), no p(x). (CONSTRUIR)
[viscoso]      [§4.1 p.169]      La hipótesis ∂p/∂y≈0 NO vale en estelas ni detrás de cuerpos romos, y se rompe para capa límite turbulenta a Mach muy alto. El software debe rehusar aplicar el módulo ahí. (AMBOS)
[viscoso]      [intro p.167]     Acoplamiento iterativo viscoso/no-viscoso: recalcular el flujo no-viscoso sobre la "configuración efectiva" = superficie real + δ* de la iteración previa. (CONSTRUIR)
[viscoso]      [§4.2 p.170-171]  Condiciones de frontera: u(x,0)=0, v(x,0)=0 (pared sólida), u(x,y→grande)=u_e(x). Pared porosa (soplado/succión) se trata con v_w≠0. (CONSTRUIR)
[viscoso]      [§4.3 p.172]      Definición de η de Bertin: η = u_e·y/√(2νs), s = ∫u_e dx. Para placa plana η = y√(u_e/(2νx)). ¡Lleva el factor 2! (CONSTRUIR)
[viscoso]      [§4.3.1 p.174]    Ecuación de Falkner-Skan (4.16): f''' + f f'' + β[1 − (f')²] = 0, con β = (2s/u_e)(du_e/ds) constante ⇒ soluciones SIMILARES. (CONSTRUIR)
[viscoso]      [§4.3.1 p.175]    Tabla 4.1: f'(η) tabulada para β = −0.1988, −0.180, 0.000, 0.300, 1.000, 2.000. Es la LUT del perfil de velocidad. (CONSTRUIR)
[viscoso]      [§4.3.1 p.176]    Tabla 4.2: f''(0) = 0.000 / 0.1286 / 0.4696 / 0.7748 / 1.2326 / 1.6872 para esos mismos β. f''(0) NO depende del Reynolds ni de la velocidad libre. (CONSTRUIR)
[viscoso]      [§4.3.1 p.177]    β = −0.1988 es el criterio de SEPARACIÓN laminar (f''(0)=0). El CAD debe marcar en rojo cualquier estación con β ≤ −0.1988. (AMBOS)
[viscoso]      [§4.3.1 p.177-180] Correlaciones laminares placa plana: δ/x=5.0/√Re_x, δ*/x=1.72/√Re_x, θ/x=0.664/√Re_x, cf=0.664/√Re_x, v_e/u_e=0.84/√Re_x, Cf_tot=1.328/√Re_L. (CONSTRUIR)
[viscoso]      [§4.3.1 p.178]    δ se define arbitrariamente en u = 0.99·u_e, lo que da η_δ = 3.5. Es una CONVENCIÓN, debe ser un parámetro del software, no un literal. (AMBOS)
[aero3d]       [§4.3.1 p.180]    C_D = Cf_tot · (S_wet/S_ref), ec. (4.33). El CAD debe conocer S_wet por componente y un S_ref único de la aeronave. (CONSTRUIR)
[aero3d]       [§4.3.1 p.180-181] PROHIBIDO sumar coeficientes de fricción totales de distintos componentes: Cf_tot,total ≠ ΣCf_tot,i. Convertir SIEMPRE a C_D con S_ref común y luego sumar (4.34). Es un requisito de arquitectura del sumador de drag. (AMBOS)
[aero2d]       [§4.3.1 p.185-188] Cálculo de β desde una distribución de Cp de perfil: u_e/U_∞=(1−Cp)^0.5 y β=−[∫₀^x̄(1−Cp)^0.5 dx̄]·(dCp/dx̄)/(1−Cp)^1.5. Es el puente entre el solver de paneles y el de capa límite. (CONSTRUIR)
[aero2d]       [§4.3.1 p.188]    Para el NACA 65-006 a α=0°, β cae por debajo del criterio de separación para x/c ≥ 0.6 si el flujo fuera todo laminar; el experimento NO separa porque a Re de vuelo la capa es turbulenta. El software no debe reportar separación laminar donde ya hay transición. (AMBOS)
[aero2d]       [§4.3.1 p.188-189] Dato de diseño (Fig. 4.10, Cebeci & Smith 1974): perfil Joukowski simétrico a α=0°, M=0 — espesor máximo con flujo TOTALMENTE ADHERIDO = 4.6% laminar, 31% turbulento (33% incluyendo efecto de δ* sobre la distribución de presión), Re_c=10⁷. (AMBOS)
[viscoso]      [§4.4 p.189-190]  Seis parámetros que gobiernan la transición: gradiente de presión, rugosidad superficial, compresibilidad (Mach), temperatura de superficie, succión/soplado, turbulencia de la corriente libre. Ninguno debe estar hardcodeado. (AMBOS)
[viscoso]      [§4.4 p.191]      Regla de signo: gradiente adverso, rugosidad, soplado y turbulencia libre ADELANTAN la transición; gradiente favorable, Mach creciente, succión y enfriamiento de pared la RETRASAN. (APRENDER)
[viscoso]      [§4.4 p.191]      Criterio típico para placa plana incompresible: Re_x,tr = 500,000 (4.39); x_tr = Re_x,tr/(ρu_e/μ) (4.40). ES UNA DECISIÓN DEL INGENIERO, con valor por defecto explícito y editable. (AMBOS)
[viscoso]      [§4.4 p.191-192]  La transición ocurre en una LONGITUD FINITA (7 regiones: laminar estable → ondas T-S 2D → ondas 3D + hairpin → rotura de vórtices → fluctuación 3D → manchas turbulentas → turbulento pleno). El libro admite que se modela como punto único "for ease in making calculations". (APRENDER)
[viscoso]      [§4.4 p.192]      Mecanismos de by-pass: rugosidad o gradiente adverso finito pueden saltarse regiones del proceso. (APRENDER)
[viscoso]      [§4.5 p.193]      Compromiso central del diseño: la capa turbulenta sube el drag de fricción pero retrasa la separación; en cuerpo romo o esbelto a incidencia, la reducción de form drag DOMINA sobre el aumento de fricción. (APRENDER)
[viscoso]      [§4.5.1 p.197]    Esfuerzo total τ_xy = μ(∂u/∂y) − ρ(u'v'); −ρu'v' es el esfuerzo de Reynolds, dominante lejos de la pared. Para y < 0.02δ el flujo es básicamente laminar. (APRENDER)
[optimizacion] [§4.5.2 p.198]    El requisito de malla para DNS 3D escala como Re^{9/4}. DNS de avión completo a Re de vuelo no será viable hasta ~2080; LES hasta ~2045 (Spalart et al. 1997). La Forja NO hace DNS. (APRENDER)
[viscoso]      [§4.5.2 p.198-199] Jerarquía de cierre: cero ecuaciones (algebraicos), una ecuación (Spalart-Allmaras, "calibrado para perfil y ala"), dos ecuaciones (k-ε, k-ω). El usuario DEBE verificar que el modelo esté calibrado con datos del régimen que le interesa. (AMBOS)
[viscoso]      [§4.5.3 p.200]    Definiciones de pared: u⁺=u/u*, y⁺=yu*/ν, u*=√(τ_w/ρ). y⁺ tiene forma de número de Reynolds. (CONSTRUIR)
[viscoso]      [§4.5.3 p.200]    Subcapa laminar: u⁺ = y⁺ (4.54), válida hasta y⁺ ≈ 5 a 10. (CONSTRUIR)
[viscoso]      [§4.5.3 p.201-202] Ley logarítmica u⁺ = (1/κ)ln y⁺ + B, válida SOLO donde el esfuerzo laminar es despreciable: 70 < y⁺ < 400. Constantes: κ ≈ 0.40 ó 0.41, B ≈ 5.0 a 5.5. (CONSTRUIR)
[viscoso]      [§4.5.3 p.201-202] Ley del defecto de velocidad (u_e−u)/u* = −(1/κ)ln(y/δ) + A, con A ≈ 2.35; región exterior contiene 80–90% de δ (y⁺ > 200). (CONSTRUIR)
[viscoso]      [§4.5.3 p.202]    Requisito de malla CFD: debe haber puntos de malla en y⁺ ≤ 5 para resolver el gradiente de velocidad en la pared. (AMBOS)
[viscoso]      [§4.6 p.202-203]  Boussinesq: −ρu'v' = ρν_t(∂u/∂y) (4.59); τ = ρ(ν+ν_t)(∂u/∂y) (4.60). Truco de implementación: reutilizar el solver laminar cambiando ν → ν+ν_t. (CONSTRUIR)
[viscoso]      [§4.6 p.203]      Longitud de mezcla de Prandtl: −ρu'v' = ρl²|∂u/∂y|(∂u/∂y) (4.61); ν_t = l²|∂u/∂y| (4.62). (CONSTRUIR)
[viscoso]      [§4.6 p.203-204]  Modelo algebraico de dos capas (Cebeci-Smith): interior l_i = κy[1−exp(−y/A)] con amortiguamiento de van Driest A = 26ν/(N u*), N = (1−11.8p⁺)^0.5, p⁺ = (ν u_e/(u*)³)(du_e/dx); exterior ν_t,o = α u_e δ*. Frontera y_c donde (ν_t)_i = (ν_t)_o (continuidad de ν_t). (CONSTRUIR)
[viscoso]      [§4.6 p.204]      Zona de transición: multiplicar ν_t por el factor de intermitencia γ_tr (4.68a), que va de 0 (inicio de transición) a 1 (turbulento pleno). Es la forma canónica de NO tener un salto en x_tr. (CONSTRUIR)
[viscoso]      [§4.7 p.206-207]  Análisis de volumen de control: la línea de corriente exterior se desplaza exactamente Y − Y₀ = δ* (4.72). Interpretación física de δ* usable como demostración. (AMBOS)
[viscoso]      [§4.7 p.207]      C_d (un lado de placa de longitud L) = 2θ/L (4.75). Válido laminar Y turbulento. Es la relación drag↔momento. (CONSTRUIR)
[viscoso]      [§4.7 p.207]      Justificación del método integral: "requires only a 'reasonable' approximation for the velocity profile … especially useful in engineering applications, especially for conceptual aircraft design". Es el método que corresponde a La Forja. (APRENDER)
[viscoso]      [§4.7.1 p.208]    Ley de 1/7: u/u_e = (y/δ)^{1/7} (4.76), válida 5×10⁵ ≤ Re_x ≤ 1×10⁷. Su gradiente diverge en la pared ⇒ NO usarla para calcular τ_w. (AMBOS)
[viscoso]      [§4.7.1 p.208]    Correlación de Blasius turbulenta: cf = 0.0456(ν/(u_e δ))^{0.25} (4.77), mismo rango 5×10⁵ a 1×10⁷. Es el dato experimental que cierra el sistema. (CONSTRUIR)
[viscoso]      [§4.7.1 p.209]    Espesores turbulentos placa plana: δ/x=0.3747/Re_x^{0.2}, δ*/x=0.0468/Re_x^{0.2}, θ/x=0.0364/Re_x^{0.2}; δ*=δ/8, θ=7δ/72. (CONSTRUIR)
[viscoso]      [§4.7.1 p.209]    cf turbulento local = 0.0583/Re_x^{0.2} (4.80). (CONSTRUIR)
[viscoso]      [§4.7.1 p.209]    Cf_tot turbulento (fórmula de Prandtl) = 0.074/Re_L^{0.2} (4.81) — SOLO ±25% de precisión contra experimento. (AMBOS)
[viscoso]      [§4.7.1 p.209]    Prandtl-Schlichting Cf_tot = 0.455/(log₁₀Re_L)^{2.58} (4.82), ±3%. ES LA RECOMENDADA POR EL LIBRO como default. (CONSTRUIR)
[viscoso]      [§4.7.1 p.209]    Karman-Schoenherr 1/√Cf_tot = 4.13·log₁₀(Re_L·Cf_tot) (4.83), ±2%, pero IMPLÍCITA (requiere iterar). (CONSTRUIR)
[viscoso]      [§4.7.1 p.209]    Schultz-Grunow Cf_tot = 0.427/(log₁₀Re_L − 0.407)^{2.64} (4.84), ±7%. (CONSTRUIR)
[viscoso]      [§4.7.1 p.210]    Placa con transición, método exacto: C_D = (1/L)[∫₀^{x_tr} cf_lam dx + ∫_{x_tr}^{L} cf_turb dx] (4.85). (CONSTRUIR)
[viscoso]      [§4.7.1 p.210]    Placa con transición, método de coeficientes totales (Fig. 4.18): C_D = Cf_turb(L)·Lb/S_ref − Cf_turb(x_tr)·x_tr·b/S_ref + Cf_lam(x_tr)·x_tr·b/S_ref (4.86). Es el algoritmo del sumador de drag. (CONSTRUIR)
[viscoso]      [§4.7.1 p.210-211] Método aproximado de transición: Cf_tot = 0.455/(log₁₀Re_L)^{2.58} − A/Re_L (4.87) con A de la Tabla 4.5 según Re_x,tr. (CONSTRUIR)
[viscoso]      [§4.7.1 p.211]    Regla del pulgar: si la transición ocurre antes del 10% de la longitud, la corrección laminar puede ignorarse. (AMBOS)
[viscoso]      [§4.7.2 p.213-214] Ecuación integral de momento con gradiente de presión (von Kármán): dθ/dx + (2+H)(θ/u_e)(du_e/dx) = cf/2 (4.88). (CONSTRUIR)
[viscoso]      [§4.7.2 p.214]    Factor de forma H = δ*/θ (4.89). Ley 1/7 ⇒ H ≈ 1.3. (CONSTRUIR)
[viscoso]      [§4.7.2 p.214]    Criterio de separación turbulenta de Kroo (2007): H ≈ 2.2 es "fairly reliable". Alternativa: Stratford (1959). (AMBOS)
[viscoso]      [§4.7.2 p.215]    El propio libro admite que NO existe un H exacto de separación: el rango usual es 1.8 a 2.8. El software debe mostrar una BANDA, no un booleano. (AMBOS)
[viscoso]      [§4.7.2 p.214]    Método de entrainment de Head (1969) + correlaciones de Cebeci & Bradshaw (1979): d(u_e θ H₁)/dx = u_e F (4.90); H₁=(δ−δ*)/θ (4.91); F=0.0306(H₁−3.0)^{−0.6169} (4.92); G(H) por tramos (4.93). Cierra el sistema con cf de White (4.94). (CONSTRUIR)
[viscoso]      [§4.7.2 p.214]    Curvefit de White (2005): cf = 0.3·e^{−1.33H}/(log Re_θ)^{1.74+0.31H} (4.94), con Re_θ = ρu_eθ/μ (4.95). Es la tercera ecuación que cierra {θ, H, cf}. (CONSTRUIR)
[viscoso]      [§4.7.2 p.215]    Arranque del método integral turbulento: hay que ESPECIFICAR dos de los tres parámetros {θ, H, cf} en la estación inicial (típicamente la transición); el tercero sale de (4.94). Es una entrada del usuario. (AMBOS)
[viscoso]      [§4.8 p.215-216]  Capa límite térmica de propiedad constante: ec. (4.96); número de Prandtl Pr = μc_p/k (4.100). Si Pr=1 las capas térmica y de velocidad son IDÉNTICAS. (CONSTRUIR)
[viscoso]      [§4.8 p.216]      Para aire Pr ≈ 0.7 (0.738 calculado) ⇒ δ_T/δ ≈ 1/√Pr, es decir la capa térmica es MÁS GRUESA que la de velocidad. (APRENDER)
[viscoso]      [§4.8.1 p.216-217] Número de Stanton St ≡ C_h = q̇/(ρu_e c_p (T_e − T_w)) (4.103). (CONSTRUIR)
[viscoso]      [§4.8.1 p.217]    Analogía de Reynolds: St = cf/2 (4.106), válida SOLO si Pr = 1. (CONSTRUIR)
[viscoso]      [§4.8.2 p.218]    Conductividad térmica del aire: k = 4.76×10⁻⁶·T^1.5/(T+112) cal/cm·s·K (4.107), válida por debajo de la disociación del O₂ (~2000 K a presión atmosférica). (CONSTRUIR)
[viscoso]      [§4.8.2 p.218]    Pohlhausen: (∂θ/∂η)_{η=0} = 0.4696·Pr^{0.333}; q̇ = 0.332·k(T_e−T_w)Pr^{0.333}√(u_e/(νx)) (4.111). (CONSTRUIR)
[viscoso]      [§4.8.2 p.219]    St laminar = 0.332/(Pr^{0.667}·Re_x^{0.5}) (4.112); Nu_x = 0.332·Re_x^{0.5}·Pr^{0.333} (4.114). (CONSTRUIR)
[viscoso]      [§4.8.2 p.219]    Analogía de Reynolds MODIFICADA: St = cf/(2·Pr^{0.667}) (4.115). Es la que se usa con aire. (CONSTRUIR)
[viscoso]      [§4.8.2 p.219-220] Turbulento: St = 0.0292/(Re_x^{0.2}·Pr^{0.667}) (4.116); Nu_x = 0.0292·Re_x^{0.8}·Pr^{0.333} (4.117). (CONSTRUIR)
[escuela]      [§4.3.1 p.183-185] El perfil lineal u/u_e = y/δ es didácticamente útil pero da valores de ingeniería MALOS (δ* 45% alto, cf 40% bajo). Lección: un perfil "razonable" no basta para τ_w. (APRENDER)
[escuela]      [§4.7.1 p.212-213] A la misma estación x y mismas condiciones, la capa turbulenta es 3.8× más gruesa que la laminar Y ADEMÁS tiene más esfuerzo en la pared. Contra-intuición que hay que ver. (APRENDER)
[escuela]      [§4.5.2 p.199]    Cita literal de Neumann (1989) sobre modelos de turbulencia: "they are not governed by the physical principles of turbulence and they are not unique". Antídoto contra creerle al CFD. (APRENDER)
```

---

### Cap. 5 — Characteristic Parameters for Airfoil and Wing Aerodynamics (pp. 226–293)


**Fuerzas, momentos y convenciones**

`[estabilidad] [§5.1.1 p.228] Convertir entre ejes cuerpo y ejes viento con L = N·cos α - A·sin α y D = N·sin α + A·cos α. El software debe saber SIEMPRE en qué eje está una fuerza (CONSTRUIR)`
`[performance] [§5.1.1 p.228] SLUF (steady, level, unaccelerated flight): L = W y T = D. Es la condición de equilibrio base de todo estudio de crucero (AMBOS)`
`[estabilidad] [§5.1.1 p.229] Trimado: "The aircraft is said to be trimmed when the sum of the moments about the cg is zero" ΣM_cg = 0. El estudio debe reportar si el diseño puede trimarse (AMBOS)`
`[performance] [§5.1.1 p.229] Contabilizar trim drag: "Typically, the trim drag may vary from 0.5% to 5% of the total cruise drag for the airplane" — y NO incluye el arrastre de perfil de la cola, que ya está en el arrastre a sustentación nula (CONSTRUIR)`
`[estabilidad] [§5.1.1 p.229-230] Tres momentos con su signo: cabeceo M positivo = morro arriba; alabeo ᏸ positivo = punta derecha (estribor) baja; guiñada ᏺ positiva = morro a la derecha del piloto (CONSTRUIR)`
`[aero3d] [§5.1.2 p.230] Los parámetros que gobiernan fuerzas y momentos son: geometría de la configuración, ángulo de ataque, tamaño/escala, velocidad de corriente libre, densidad, Reynolds y Mach. Cualquier estudio debe pedir esos siete (APRENDER)`
`[aero3d] [§5.1.2 p.231] "In practice, flow phenomena such as boundary-layer separation, shock-wave/boundary-layer interactions, and compressibility effects limit the range of flow conditions over which the dimensionless force and moment coefficients remain constant" — adimensionalizar NO borra Re ni Mach; el software debe seguir mostrándolos (APRENDER)`

**Geometría del perfil — cotas que el kernel debe MEDIR**

`[geometria] [§5.2 p.231-232] Definir y MEDIR de la geometría real: borde de ataque (punto más adelantado), borde de salida (punto más atrasado), línea de cuerda (recta entre ambos), línea de curvatura media (punto medio entre extradós e intradós en cada estación de cuerda), curvatura máxima, espesor máximo, radio de borde de ataque (CONSTRUIR)`
`[geometria] [§5.2.3 p.233] Línea de curvatura media LITERAL: "The locus of the points midway between the upper surface and the lower surface, as measured perpendicular to the chord line" — OJO: medida PERPENDICULAR A LA CUERDA, no vertical. El kernel debe implementar esa medición exacta (CONSTRUIR)`
`[geometria] [§5.2.2 p.233] Radio de borde de ataque LITERAL: "the radius of a circle centered on a line tangent to the leading-edge camber connecting tangency points of the upper and the lower surfaces with the leading edge. The center of the leading-edge radius is located so that the cambered section projects slightly forward of the leading-edge point." (CONSTRUIR)`
`[geometria] [§5.2.2 p.233] Para aplicaciones subsónicas el borde de ataque es redondeado con radio del orden del 1% de la cuerda. Sirve de valor por defecto y de alerta cuando el croquis se sale (AMBOS)`
`[geometria] [§5.2.1 p.233] Generador NACA de 4 dígitos NACA XYZZ: X = ordenada máxima de la línea de curvatura media en % de cuerda; Y = distancia del borde de ataque a la curvatura máxima en DÉCIMAS de cuerda; ZZ = espesor máximo en % de cuerda. Ej.: NACA 0010 simétrico 10%; NACA 4412 = 12% de espesor con 4% de curvatura al 40% de la cuerda (CONSTRUIR)`
`[geometria] [§5.2.1 p.233] Sufijo de modificación NACA "-XY" (ej. NACA 0010-64): primer entero = magnitud relativa del radio de borde de ataque (normal = "6", borde afilado = "0"); segundo entero = posición del espesor máximo en décimas de cuerda. La posición NORMAL del espesor máximo es 0.3c (CONSTRUIR)`
`[geometria] [§5.2.2 p.234] Ángulo de ataque geométrico = ángulo entre la línea de cuerda y la dirección de la corriente libre no perturbada. Incidencia = inclinación de la cuerda del perfil respecto al eje del vehículo (CONSTRUIR)`
`[aero2d] [§5.2.2 p.234] "if the leading-edge radius is too small, the flow will have a tendency to separate near the leading edge, causing fairly abrupt stall characteristics" — el estudio debe ADVERTIR al alumno cuando dibuje un borde de ataque demasiado agudo (AMBOS)`
`[aero2d] [§5.2.3 p.234] Efecto de la curvatura: cambia el ángulo de sustentación nula α0l (los perfiles con curvatura positiva sustentan a α=0 y tienen α0l negativo) y eleva Clmax. Costo: Mach crítico más bajo y momentos torsores altos a alta velocidad (AMBOS)`
`[aero2d] [§5.2.4 p.234-235] Existe un espesor ÓPTIMO para maximizar Clmax; con los datos NACA 24xx el óptimo es aproximadamente 12%. No es "más grueso = más sustentación" (APRENDER)`
`[aero2d] [§5.2.4 p.235] Mover el espesor máximo hacia atrás reduce el gradiente de presión en la zona media, favorece la estabilidad de la capa límite y prolonga el flujo laminar. Costo: la capa laminar separa más fácil ante gradiente adverso (APRENDER)`
`[aero2d] [§5.2.5 p.235] El ángulo de borde de salida afecta la posición del centro aerodinámico. El c.a. de perfiles delgados en flujo subsónico está TEÓRICAMENTE en c/4 "but can vary depending on the geometry of the airfoil" — el software no debe hardcodear c/4 (AMBOS)`
`[aero2d] [§5.2.5 p.236] Gradiente favorable = dp/dx < 0 y dV/dx > 0; adverso = dp/dx > 0 y dV/dx < 0. La sustentación es proporcional a la integral de ΔV a lo largo de la cuerda: l ∝ ∫₀^c ΔV dx (APRENDER)`

**Geometría del ala — las cotas del planeador**

`[geometria] [§5.3 p.236] Superficie alar S = área en planta (proyectada). CONVENCIÓN CRÍTICA LITERAL: "Although a portion of the area may be covered by a fuselage or nacelles, the pressure carryover on these surfaces allows legitimate consideration of the entire planform area." El área de referencia INCLUYE la parte enterrada en el fuselaje (CONSTRUIR)`
`[geometria] [§5.3 p.237] Envergadura b = distancia en línea recta de punta a punta. Cuerda media c̄ tal que b·c̄ = S (CONSTRUIR)`
`[geometria] [§5.3 p.237] Alargamiento AR = b²/S en general; AR = b/c para ala rectangular. "Typical aspect ratios vary from 35 for a high-performance sailplane to 2 for a supersonic jet fighter" (CONSTRUIR)`
`[geometria] [§5.3 p.237] Cuerda de raíz cr = cuerda en la línea central del ala; cuerda de punta ct = cuerda en la punta (CONSTRUIR)`
`[geometria] [§5.3 p.237-238] Estrechamiento λ = ct/cr. Ala rectangular λ=1.0; delta de punta afilada λ=0.0. "The taper ratio affects the lift distribution and the structural weight of the wing" (CONSTRUIR)`
`[geometria] [§5.3 p.238] Flecha Λ: "usually measured as the angle between the line of 25% chord and a perpendicular to the root chord". También se usan flecha de borde de ataque y de borde de salida. El CAD debe poder reportar LAS TRES y decir cuál está usando (CONSTRUIR)`
`[geometria] [§5.3 p.238] Cuerda aerodinámica media mac = (1/S)∫_{-b/2}^{+b/2} [c(y)]² dy. Se usa JUNTO CON S para adimensionalizar el momento de cabeceo, y para estimar el Reynolds del ala en cálculos de fricción (CONSTRUIR)`
`[geometria] [§5.3 p.238] Diedro = ángulo entre un plano horizontal que contiene la cuerda de raíz y el plano medio entre extradós e intradós. Si el ala queda por DEBAJO del plano horizontal se llama anhedro. Afecta la estabilidad lateral (CONSTRUIR)`
`[geometria] [§5.3 p.238] Torsión geométrica: variación en envergadura del ángulo de incidencia de las secciones. Si la incidencia DISMINUYE hacia la punta el ala tiene "wash out"; si AUMENTA, "wash in". El washout controla la distribución de sustentación y por tanto las características de entrada en pérdida (CONSTRUIR)`
`[geometria] [§5.3 p.238] "The airfoil section distribution, the aspect ratio, the taper ratio, the twist, and the sweep of a planform are the principal factors that determine the aerodynamic characteristics of a wing" — ESOS CINCO son los parámetros del modelo paramétrico del ala en la Forja (CONSTRUIR)`
`[optimizacion] [§5.3 p.239] "the selection of wing aspect ratio represents an interplay between a large value for low drag-due-to-lift and a small value for reduced wing weight" [Stuart (1978), caso F-5] — el AR es un compromiso, no un óptimo aerodinámico (APRENDER)`
`[geometria] [§5.3 p.240-241] Tabla 5.1 (30 aviones reales) como base de datos de referencia del CAD: al dibujar un ala, mostrar dónde cae respecto a los aviones históricos de su clase (CONSTRUIR)`

**Coeficientes y superficie de referencia**

`[aero3d] [§5.4.1 p.246] CL = L/(q∞·S) [ec. 5.7]. Coeficiente de sustentación del AVIÓN, adimensionalizado con la superficie alar de referencia (CONSTRUIR)`
`[aero2d] [§5.4.1 p.246] Cl = l/(q∞·c) [ec. 5.8]. Coeficiente de sustentación de SECCIÓN: sustentación por unidad de envergadura entre presión dinámica por cuerda. Distinguir MAYÚSCULA (3D) de minúscula (2D) en toda la UI (CONSTRUIR)`
`[aero2d] [§5.4.1 p.246] Cl = Clα(α - α0l) [ec. 5.9] en la región lineal. Es una recta: pendiente Clα, intercepto en x igual a α0l (CONSTRUIR)`
`[aero2d] [§5.4.2 p.250-251] CM0 = M0/(q∞·S·c) [ec. 5.15] y Cm0 = m0/(q∞·c·c) [ec. 5.16]. **Para un ala general se usa la mac junto con S**, no la cuerda (CONSTRUIR)`
`[estabilidad] [§5.4.2 p.251] Centro aerodinámico = "that point about which the section moment coefficient is independent of the angle of attack ... that point along the chord where all changes in lift effectively take place". El estudio debe LOCALIZARLO, no suponerlo (AMBOS)`
`[estabilidad] [§5.4.2 p.252] "the center of pressure must move toward the aerodynamic center as the lift increases" — consecuencia directa de que M_ac = L × (distancia c.a.→c.p.) (APRENDER)`
`[estabilidad] [§5.4.2 p.252] La longitud característica para los momentos de alabeo y guiñada es la ENVERGADURA b, no la cuerda: Cᏸ = ᏸ/(q∞Sb) [5.17], Cᏺ = ᏺ/(q∞Sb) [5.18] (CONSTRUIR)`
`[viscoso] [§5.4.3 p.252] Arrastre formal D = ∮τ·ê∞ dS - ∮p·n̂·ê∞ dS [ec. 5.19]: primer término fricción, segundo presión (CONSTRUIR)`
`[viscoso] [§5.4.3 p.252-253] ADVERTENCIA DE MÉTODO: el "near-field method" (integrar presión) "can be a relatively inaccurate procedure for streamlined configurations at small angles of attack" porque el arrastre de presión es la DIFERENCIA entre integrales sobre superficies delanteras y traseras, cantidad de segundo orden. Un error de presión en el morro o en la cola pesa mucho más que uno en la mitad (APRENDER)`
`[viscoso] [§5.4.3 p.253] Cd = d/(q∞·c) [ec. 5.23] coeficiente de arrastre de sección (CONSTRUIR)`
`[viscoso] [§5.4.3 p.253-254] Correlaciones de fricción de placa plana: local laminar Cf=0.664/Rex^0.5 [5.24]; local turbulento Cf=0.0583/Rex^0.2 [5.25]; total laminar Cf=1.328/√ReL [5.27]; total turbulento (Prandtl) Cf=0.074/ReL^0.2 [5.28]; total turbulento (Prandtl-Schlichting, DECLARADO MÁS PRECISO) Cf=0.455/(log10 ReL)^2.58 [5.29] (CONSTRUIR)`
`[viscoso] [§5.4.3 p.253] Aviso de dominio: "the results for a flat plate only approximate those for an airfoil" — en la placa plana la velocidad al borde de la capa es CONSTANTE; en el perfil el flujo acelera desde el punto de remanso hasta un máximo y luego decelera (APRENDER)`

**Transición práctica y rugosidad**

`[viscoso] [§5.4.4 p.256] Criterio de ingeniería: para placa plana lisa y corriente sin turbulencia se suele SUPONER transición en Rex ≈ 500,000. PERO "the criterion that low-speed transition takes place at a Reynolds number of 500,000 was based on wind-tunnel tests with fairly high levels of free-stream turbulence" (2%–3% de fluctuación) (APRENDER)`
`[viscoso] [§5.4.4 p.256] Datos de túneles silenciosos: Schubauer-Skramstad (1948) midió Re_transición = 2,800,000 con turbulencia < 0.07%; el túnel Klebanoff de Arizona State midió 3,400,000 [Saric (1992)]; hay túneles en Japón, Rusia y Suecia por encima de 3,000,000 (APRENDER)`
`[viscoso] [§5.4.4 p.256] REQUISITO DURO DE PRODUCTO: "A quick examination of the impact of varying the transition location should be conducted to ensure that a particular result is not highly dependent on an incorrect assumption about transition." El estudio DEBE correr un barrido de sensibilidad de la posición de transición y mostrarlo (CONSTRUIR)`
`[viscoso] [§5.4.4 p.257] Qué mueve la transición: rugosidad la ADELANTA; enfriar la superficie la RETRASA (relación compleja en supersónico); gradiente favorable la RETRASA y adverso la ADELANTA; mayor Mach eleva el Reynolds de transición (AMBOS)`
`[aero2d] [§5.4.4 p.257] Para retrasar la transición mover atrás el espesor máximo: NACA 66-009 tiene el espesor máximo en 0.45c y la presión mínima en x=0.6c; NACA 0009 lo tiene en 0.3c con presión mínima cerca de x=0.1c. Resultado: "drag bucket" en el 66-009 (APRENDER)`
`[aero2d] [§5.4.4 p.258] Compensación: a ángulos de ataque ALTOS domina el arrastre de forma y el NACA 66-009 arrastra MÁS que el NACA 0009. Un perfil laminar no es mejor en todo el rango (APRENDER)`
`[viscoso] [§5.4.5 p.259-260] Por qué existe la rugosidad artificial: si se iguala Reynolds con modelo a escala 0.2 la velocidad de túnel sería 5× la de vuelo y el Mach ya no se parecería. Por eso se pega rugosidad controlada para FIJAR la transición donde ocurriría en vuelo (APRENDER)`
`[viscoso] [§5.4.5 p.260] Rugosidad estándar NACA, LITERAL: "The standard leading-edge roughness selected by the NACA for 24-in chord models consisted of 0.011-in carborundum grains applied to the surface of the model at the leading edge over a surface length of 0.08c measured from the leading edge on both surfaces. The grains were thinly spread to cover 5 to 10% of the area." (CONSTRUIR)`
`[viscoso] [§5.4.5 p.260] Efecto medido de la rugosidad estándar: el ángulo de sustentación nula y la PENDIENTE de sustentación quedan prácticamente inalterados; lo que se degrada es el Clmax (AMBOS)`
`[viscoso] [§5.4.5 p.260] "The minimum drag increased progressively with forward movement of the roughness strip" — cuanto más adelante la tira de rugosidad, más arrastre mínimo (APRENDER)`
`[viscoso] [§5.4.5 p.261] Contaminación real que mata el flujo laminar [van Dam y Holmes (1986)]: restos de insectos, cristales de hielo, humedad por llovizna o lluvia, daño superficial y modificaciones "inocentes" como una franja de pintura en envergadura (APRENDER)`
`[viscoso] [§5.4.6 p.266] Sublayer laminar contenida en y+ ≈ 10: si el grano de arena equivalente cabe dentro de la sublayer, la superficie es aerodinámicamente "lisa". Como la sublayer ADELGAZA al subir Reynolds, la misma rugosidad empeora al aumentar Re (APRENDER)`
`[viscoso] [§5.4.6 p.266] "as the relative grain size increases, the skin-friction coefficient can deviate from the smooth turbulent value by factors as high as 300%. Keeping aerodynamic surfaces as smooth as possible is essential to reducing skin-friction drag!" (APRENDER)`
`[viscoso] [§5.4.6 p.266] Rugosidad de grano de arena equivalente [Blake (1998)]: metal pulido k = 0.06e-3 in; pintura en aerosol de producción en serie k = 2e-3 in; metal galvanizado k = 6e-3 in (CONSTRUIR)`
`[viscoso] [§5.4.6 p.265] Corrección empírica por rugosidad: "Most subsonic aircraft have a 6% to 9% increase in drag due to surface roughness, rivets, etc." [Kroo (2003)]; aviones de material compuesto y flujo laminar cuidadosamente construidos pueden bajar a 2%–3% (CONSTRUIR)`

**Método de arrastre parásito (Shevell) — el algoritmo estrella del capítulo**

`[performance] [§5.4.6 p.263] Vocabulario de arrastre que la UI debe usar sin mezclar [McCormick (1979)]: inducido (o de vórtice), de fricción, de forma (o de presión), de interferencia, de trimado, de perfil (fricción + presión de una SECCIÓN), parásito (fricción + presión de un AVIÓN), de base, de onda (CONSTRUIR)`
`[performance] [§5.4.6 p.264] CD ≡ D/(q∞·Sref) [ec. 5.33] donde "Sref is usually the wing planform area for an airplane". UNA sola superficie de referencia para todo el avión (CONSTRUIR)`
`[performance] [§5.4.6 p.264] "drag count" = incremento de CD de 0.0001. La UI debe hablar en counts como los aerodinamicistas (CONSTRUIR)`
`[performance] [§5.4.6 p.264] Los 5 pasos del método: (1) estimar Cf de placa plana equivalente por componente, (2) corregir por rugosidad, (3) aplicar factor de forma K por supervelocidades y separación, (4) convertir a coeficiente referido a Sref, (5) sumar. LITERAL: "Every aerodynamics group at each aircraft manufacturer has different methods for estimating subsonic aircraft drag. The basic approaches, however, are probably quite similar" (CONSTRUIR)`
`[performance] [§5.4.6 p.264] CD0 = Σᵢ (Kᵢ·Cfᵢ·Swetᵢ)/Sref [ec. 5.34] (CONSTRUIR)`
`[performance] [§5.4.6 p.264] Lo que el método NO incluye y hay que sumar aparte: interferencia, excrecencias (remaches, tornillos, cables), instalación del motor, huelgos de superficies de control, upsweep del fuselaje, tren de aterrizaje (APRENDER)`
`[geometria] [§5.4.6 p.265] Método ALA: usar la mac como longitud de la placa plana equivalente. mac = (2/3)(cr + ct - cr·ct/(cr+ct)) = (2/3)·cr·(λ²+λ+1)/(λ+1) [ec. 5.35], válida SOLO para ala trapezoidal (CONSTRUIR)`
`[geometria] [§5.4.6 p.265] REGLA DURA: "if a portion of the 'theoretical' wing is submerged in the fuselage of the aircraft, then that portion of the wing should not be included in the calculation—the mean aerodynamic chord should be calculated using the root chord at the side of the fuselage!" El área de REFERENCIA sí incluye lo enterrado (§5.3); el área MOJADA y la mac de fricción NO (CONSTRUIR)`
`[viscoso] [§5.4.6 p.265] Cf del método = Prandtl-Schlichting con corrección de laminar: Cf = 0.455/(log10 ReL)^2.58 - 1700/ReL [ec. 5.37], suponiendo transición en Rex,tr = 500,000 (CONSTRUIR)`
`[geometria] [§5.4.6 p.267] Área mojada de superficies tipo ala: Swet ≈ 2.0·(1 + 0.2·t/c)·S_expuesta [ec. 5.38, de Kroo (2003)], donde S_expuesta es la parte del ala NO enterrada en el fuselaje. El factor 2 es extradós + intradós; el (1+0.2 t/c) es el alargamiento de arco por el espesor (CONSTRUIR)`
`[geometria] [§5.4.6 p.269] Área mojada de fuselaje: Swet ≈ Swet_morro + Swet_cuerpo + Swet_cola [5.39] con Swet_morro = 0.75πD·L_morro, Swet_cuerpo = πD·L_cuerpo, Swet_cola = 0.72πD·L_cola [5.40, de Kroo (2003)]. NO se duplica: el aire sólo pasa por fuera (CONSTRUIR)`
`[performance] [§5.4.6 p.268] Factor de forma del fuselaje = función de la relación de finura L/D (largo entre diámetro máximo), NO de la relación sustentación/arrastre. Cuanto más largo y esbelto, menor K y menor arrastre (CONSTRUIR)`
`[performance] [§5.4.6 p.266-267] Factor de forma del ala = función de t/c y de la flecha Λc/4 (Fig. 5.21). Alas más gruesas → K mayor; más flecha → K menor (CONSTRUIR)`
`[performance] [§5.4.6 p.270] Mapeo de componentes al método: estabilizadores vertical y horizontal → método ALA; pilones → método ALA; góndolas de motor → método FUSELAJE; antenas tipo pala → método ALA (CONSTRUIR)`

**Ala finita, polar y L/D**

`[aero3d] [§5.5 p.274] Físicamente: la diferencia de presión entre intradós y extradós de un ala finita genera flujo en envergadura → vórtices longitudinales → downwash → el perfil NO vuela al ángulo de ataque que parece, y aparece arrastre de vórtice (inducido) (APRENDER)`
`[aero3d] [§5.5.1 p.274] Pendiente de sustentación del ala 3D ideal sin flecha: CLα = a = Cla/(1 + Cla/(πAR)) = a0/(1 + a0/(πAR)) [ec. 5.41], en 1/rad. En grados: a = a0/(1 + 57.3·a0/(πAR)) con a0 en 1/deg (CONSTRUIR)`
`[aero3d] [§5.5.1 p.275] "the wing lift-curve slope approaches the airfoil lift-curve slope, CLα → Clα, as the aspect ratio increases, AR → ∞. In other words, a low-speed wing is most efficient with high aspect ratios. Typically, however, wings are limited in aspect ratio by structural constraints." (APRENDER)`
`[geometria] [§5.5.1 p.275] Rangos de AR observados en Tabla 5.1: monomotores de 4 plazas 6.3 < AR < 7.6; jets comerciales y transportes 6.9 < AR < 8.9; aviones supersónicos 1.7 < AR < 4.0. El CAD debe avisar cuando el ala dibujada sale de la banda de su clase (CONSTRUIR)`
`[performance] [§5.5.2 p.279] Polar general: CD = CD,min + k'·CL² + k''·(CL - CL,min)² [ec. 5.43], donde k' es el coeficiente del arrastre NO viscoso debido a sustentación (inducido/vórtice) y k'' el del arrastre VISCOSO debido a sustentación (CONSTRUIR)`
`[performance] [§5.5.2 p.280] Forma reducida CD = k1·CL² + k2·CL + CD0 [5.45] con k1=k'+k'', k2=-2k''·CL,min, CD0 = CD,min + k''·CL,min². Si CL,min es pequeño se desprecia k2 y CD0 ≅ CD,min → CD = CD0 + k·CL² [5.46] (CONSTRUIR)`
`[compresible] [§5.5.2 p.281] Polar completa CD = CD0 + k·CL² + ΔCDM [ec. 5.47] "valid for our assumptions of CL,min ≈ 0, k2 ≈ 0, and CD,min ≈ CD0. In the case where these assumptions are not true, you may need to return to equation (5.45)" (CONSTRUIR)`
`[performance] [§5.5.2 p.281] Reparto de arrastre en transportes subsónicos [Thomas (1985)]: la mayor contribución es la fricción turbulenta; sumada al inducido dan ~85% del total; el 15% restante es presión por separación en la cola, interferencia, onda cerca de sónico, rugosidad y fugas (APRENDER)`
`[performance] [§5.5.2 p.283] Reparto típico del CD0 de un avión completo (valor representativo CD0 ≈ 0.020): alas 50%, fuselaje y góndolas 40%, cola 10%. De ahí que "an optimum airplane configuration would have a minimum wing surface area and, therefore, highest practical wing loading (W/S)" (APRENDER)`
`[performance] [§5.5.2 p.283] Arrastre debido a sustentación k·CL² = CL²/(π·e·AR) [ec. 5.48] con e = factor de eficiencia del avión (Oswald). "Typical values of the airplane efficiency factor range from 0.6 to 0.95, and are lower than the span efficiency factor" (CONSTRUIR)`
`[performance] [§5.5.2 p.283] Límites de la polar cuadrática: cerca de CLmax hay que cambiar e para tomar en cuenta el aumento de arrastre de forma, y "The deviation of the actual airplane drag from the quadratic correlation, where e is a constant, is significant for airplanes with low aspect ratios and sweepback" (APRENDER)`
`[compresible] [§5.5.2 p.283] Aparece arrastre de onda cuando existen regiones supersónicas en el campo, "e.g., free-stream Mach numbers of approximately 0.7, or greater". Se retrasa o reduce con AR bajo, flecha, perfiles delgados y la regla del área (APRENDER)`
`[performance] [§5.5.3 p.283-284] En (L/D)max ocurren: alcance máximo de aviones de hélice, ángulo de ascenso máximo de aviones a reacción, relación de planeo máxima con motor apagado, y autonomía máxima de aviones a reacción (APRENDER)`
`[performance] [§5.5.3 p.284] Rangos de (L/D)max subsónico por clase: velero de alto rendimiento 25–40; transporte comercial 12–20; caza supersónico 4–12; vehículo hipersónico 1–4 (CONSTRUIR)`
`[performance] [§5.5.3 p.285] L/D = Peso/Arrastre total = CL/(CD0 + CDi) [ec. 5.49] en vuelo nivelado (CONSTRUIR)`
`[optimizacion] [§5.5.3 Prob.5.3 p.288] En (L/D)max: CL = √(CD0/k) y (L/D)max = 1/(2√(k·CD0)). Equivalente: el arrastre parásito IGUALA al inducido (CONSTRUIR)`


---

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

### Cap. 1 — Why Study Aerodynamics? (pp. 1–32)


**Energía y maniobrabilidad (§1.1, pp. 3–7)**
| Ec. | Fórmula | Rango de validez / supuestos | Qué se rompe fuera |
|---|---|---|---|
| 1.1 | E = ½mV² + mgh | g constante; V = velocidad verdadera; unidades consistentes | A altitud orbital g varía y el término mgh deja de ser lineal |
| 1.2 | m = W/g | W en unidades de fuerza | Confundir lbm con slug mete un factor 32.174 |
| 1.3 | He = E/W = V²/2g + h | Idem 1.1 | — |
| 1.4 | T − D = (W/g)·dV/dt | Vuelo a ALTITUD CONSTANTE; empuje alineado con la trayectoria | Si el empuje tiene ángulo o hay ascenso, falta el término de peso |
| 1.5/1.7 | Ps = (T−D)V/W = dHe/dt = (V/g)(dV/dt) + dh/dt | Ángulos pequeños; W constante en el instante | Con consumo de combustible fuerte W no es constante |

Supuesto declarado del libro: "for now we will only consider cases where the angles are small
(e.g., the component of the thrust parallel to the free-stream velocity vector is only slightly less
than the thrust itself)" (§5.1.1 p.228 y §1.1.1 p.6).

**Fluido como continuo (§1.2.2, p.10)**
- A nivel del mar hay ≈ 2.5×10²⁵ moléculas por m³ y el camino libre medio es 6.6×10⁻⁸ m.
- A 130 km hay sólo ≈ 1.6×10¹⁷ moléculas por m³ y el camino libre medio es 10.2 m.
- Criterio: número de Knudsen = camino libre medio / dimensión característica del cuerpo.
  "Although there is no definitive criterion, the continuum flow model starts to break down when
  the Knudsen number is roughly of the order of 0.1." Fuera de ahí hacen falta OTRAS ecuaciones,
  no un ajuste de las mismas.

**Gas perfecto (§1.2.3, pp. 12–13)**
- ρ = p/(RT) [ec. 1.10]. **Supuesto: gas térmicamente perfecto. Temperatura ABSOLUTA (K o °R).**
- R_aire = 287.05 N·m/kg·K = 53.34 ft·lbf/lbm·°R = 1716.16 ft²/s²·°R.
- ρ nivel del mar estándar = 1.2250 kg/m³ = 0.002377 slug/ft³.
- p nivel del mar estándar = 1.01325×10⁵ N/m² = 14.696 lbf/in² = 2116.22 lbf/ft²
  (= columna de mercurio de 760 mm con densidad 13.5951 g/cm³ y g estándar).
- **Rango de validez de la incompresibilidad**: "For vehicles that are flying at approximately
  100 m/s (330 ft/s), or less, the density of the air flowing past the vehicle is assumed constant."
  La justificación NO es que p y T sean constantes (no lo son) sino que "the pressure changes that
  occur from one point to another in the flow field are small relative to the absolute value of the
  pressure". Qué se rompe fuera: por encima de ~100 m/s la variación de densidad ya no es
  despreciable y el campo de velocidades acopla con el térmico.
- Límite superior del modelo (§1.4, p.27): "for the relatively high temperatures associated with
  hypersonic flight, it may be necessary to account for real-gas effects (e.g., dissociation)".

**Viscosidad (§1.2.3, pp. 14–17)**
- Esfuerzo cortante = μ × gradiente transversal de velocidad [ec. 1.11]. **Supuesto: fluido
  newtoniano.**
- Sutherland: μ = C1·T^1.5/(T + C2) [ec. 1.12].
  SI (T en K, μ en kg/s·m): C1 = 1.458×10⁻⁶, C2 = 110.4.
  Inglés (T en °R, μ en lbf·s/ft²): C1 = 2.27×10⁻⁸, C2 = 198.6.
- **Rango de validez explícito**: "The viscosity of air is independent of pressure for temperatures
  below 3000 K (5400°R). In this temperature range, we could use Sutherland's equation."
- **Qué se rompe fuera, dicho por el propio libro** [Chapman y Cowling (1960)]: "In general it is
  not adequate to represent the core of a molecule as a rigid sphere, or to take molecular
  attractions into account to a first order only... The chief value of Sutherland's formula seems to
  be as a simple interpolation formula over restricted ranges of temperature." La Tabla 1.1 muestra
  el error creciente contra Svehla (1962): a 200 K Sutherland da 1.329 vs 1.360 (−2.3%); a 5000 K da
  10.087 vs 11.838 (−14.8%).
- Viscosidad cinemática ν = μ/ρ [ec. 1.13], dimensiones (longitud)²/(tiempo).
- **Aviso metodológico del libro (p.15): "even the basic fluid properties may involve approximate
  models that have a limited range of applicability."**

**Velocidad del sonido (§1.2.3, p.17)**
- a = √(γRT); para aire en el rango donde se comporta como gas perfecto γ = 1.4:
  a = 20.047·√T [1.14a] (T en K → m/s); a = 49.02·√T [1.14b] (T en °R → ft/s).

**Fluido estático (§1.2.4, pp. 17–22)**
- ∇p = ρf⃗ = −ρg·k̂ [ec. 1.17]; en componentes ∂p/∂x = 0, ∂p/∂y = 0, ∂p/∂z = −ρg [1.16a–c].
- Dos principios: (1) no hay variación de presión en la horizontal, la presión es constante en un
  plano perpendicular a la gravedad; (2) la variación vertical es proporcional a gravedad, densidad
  y profundidad. Y "pressure at a point in a static fluid is independent of orientation".
- Región ISOTÉRMICA: p2 = p1·exp[g(z1 − z2)/(RT)] [ec. 1.20].
- Región GRADIENTE: T = T0 − B·z [1.21] con **T0 = 288.15 K y B = 0.0065 K/m válidos de 0 a
  11,000 m**; p = p0·(1 − Bz/T0)^(g/RB) [1.22] con exponente adimensional g/RB = 5.26 para aire.
- **Qué se rompe fuera del rango**: la ec. 1.22 con B=0.0065 K/m sólo vale hasta 11,000 m. Arriba de
  ahí hay que cambiar a la 1.20 (isotérmica, T=216.650 K) hasta 20,000 m y así sucesivamente. El
  libro advierte que T0 y B "vary from day to day" — los valores son un ESTÁNDAR, no una medición.

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


#### Continuidad
**Eq. (2.1) [§2.2 p.37]** — forma diferencial general, cartesiana:
`∂ρ/∂t + ∂(ρu)/∂x + ∂(ρv)/∂y + ∂(ρw)/∂z = 0`
- Supuestos: medio continuo; volumen de control fijo en el espacio; expansión de Taylor de primer orden válida ⇒ el volumen debe ser "larger than a microscopic scale and smaller than the scale of the airplane" (p.37).
- Rango: universal para medio continuo (compresible o no, viscoso o no, estacionario o no).
- Se rompe: fuera del continuo (flujos de muy baja densidad — el libro los lista como característica del régimen hipersónico, Tabla 2.1 p.61).

**Eq. (2.2) [p.38]** vectorial: `∂ρ/∂t + ∇·(ρV) = 0`.

**Eq. (2.3)/(2.4) [p.38]** incompresible: `∂u/∂x + ∂v/∂y + ∂w/∂z = 0`, o `∇·V = 0`.
- Supuesto declarado: "the pressure variations that occur in relatively low-speed flows are sufficiently small so that the density is essentially constant".
- Rango: M < 0.3 a 0.5 según aplicación (§2.4 p.46); Tabla 2.1 pone la frontera en ~0.3.
- Se rompe: arriba de eso la densidad varía y (2.3) deja de conservar masa; además desaparece la justificación de tirar el término de λ∇·V en los esfuerzos normales.

**Eq. (2.5) [p.40]** integral: `∂/∂t ∫_vol ρ d(vol) + ∮_A ρV·n̂ dA = 0`.
- Supuesto: volumen de control FIJO en el espacio (por eso la derivada temporal sale de la integral).
- Se rompe: con volumen de control móvil o deformable hay que reintroducir la derivada dentro (el libro no lo desarrolla).

#### Momento
**Eq. (2.6) [p.40]** F = m dV/dt, válida SOLO en sistema inercial ("neither accelerating nor rotating"). Se rompe en marco rotante (falta Coriolis/centrífuga; el libro no las incluye).

**Eqs. (2.7)–(2.9) [p.41]** derivada sustancial: `dV/dt = ∂V/∂t + (V·∇)V`. Estacionario ⇒ ∂V/∂t = 0, pero la aceleración convectiva sobrevive.

**Eq. (2.10) [p.42]** simetría del tensor por isotropía (referencia: Schlichting y Gersten, 2000). Se rompe en fluidos anisótropos (fuera de alcance del libro).

**Ley constitutiva newtoniana [p.44]** — los 3 supuestos son explícitos y son el rango de validez:
1. Esfuerzo lineal en la rapidez de deformación (τ = μ ∂u/∂y es el caso especial).
2. Invariancia ante rotación o reflexión de ejes.
3. Con todos los gradientes de velocidad nulos, el esfuerzo se reduce a la presión hidrostática p.
Más la **hipótesis de Stokes λ = -2/3 μ**. Notas del libro: el término de λ desaparece por completo en flujo incompresible; el segundo coeficiente "is of significance in a few specialized problems, such as the analysis of the structure of a shockwave, where extremely large changes in pressure and temperature take place over very short distances."
- Se rompe: fluidos no newtonianos; y dentro de un choque resuelto a escala de camino libre medio, donde λ deja de ser despreciable.

**Eqs. (2.12a,b,c) [pp. 44–45]** Navier-Stokes completas con μ = μ(x,y,z).
- Supuestos acumulados: continuo, newtoniano, Stokes, sistema inercial, fuerza de cuerpo = gravedad (se admiten otras, p.ej. electromagnéticas).
- Unidades: fuerza por unidad de volumen.
- Cierre: 5 incógnitas (u,v,w,p,T) y solo 4 ecuaciones ⇒ **sin ecuación de energía el sistema no cierra en flujo compresible** (p.45). ρ y μ vía ecuación de estado (1.10) y Sutherland (1.12).

**Eq. (2.15) [p.48]** Navier-Stokes con μ y ρ constantes: `ρ du/dt = ρfx - ∂p/∂x + μ∇²u`. Requiere ∇·V = 0 para eliminar el término de divergencia.

**Eq. (2.16) [p.57]** = (2.15) sin fuerza de cuerpo: "the body-force term is usually negligible in aerodynamic problems". Se rompe donde la flotabilidad importa (no tratado aquí).

**Eq. (2.13) [p.46]** momento integral: `F_body + F_surface = ∂/∂t ∫ρV d(vol) + ∮V(ρV·n̂ dA)`. Ecuación VECTORIAL: para arrastre se usa solo la componente x.

#### Soluciones exactas de propiedades constantes
**Poiseuille [§2.4.1 pp. 46–49]**
Ecuación gobernante: `μ d²u/dy² = dp/dx = constante`.
Perfil: `u = (1/2μ)(dp/dx)(y² - h²/4)` (parabólico, máximo en el centro).
Cortante: `τ = y (dp/dx)`; pared inferior (y=-h/2) `τ_l = +|h/2 · dp/dx|`; pared superior (y=+h/2) `τ_u = -|h/2 · dp/dx|`, expresado en el sistema local de esa pared, y físicamente apunta hacia la derecha ⇒ ambas paredes generan arrastre.
- Supuestos: estacionario, baja velocidad, μ y ρ constantes, canal 2D infinitamente largo de altura h, flujo completamente desarrollado (u = u(y) solamente), fuerzas de cuerpo despreciables (flujo horizontal), no deslizamiento en ambas paredes.
- Consistencia obligada: dp/dx < 0 para que el flujo vaya en +x.
- Se rompe: cerca de la entrada (no desarrollado), con h variable, en régimen turbulento, o si la gravedad no es despreciable (canal no horizontal).

**Couette [§2.4.2 p.50]**
`u/U = y/h + P (y/h)(1 - y/h)`, con `P = -(h²/2μU)(dp/dx)` (gradiente de presión adimensional).
Placa inferior fija (y=0, u=0), superior móvil (y=h, u=U). Misma EDO que Poiseuille, distintas condiciones de frontera.
- P > 0: gradiente favorable, flujo acelera. P < 0: gradiente adverso, aparece **flujo reversado**. P = 0: perfil lineal de corte puro.
- Fig. 2.10 barre P de -3 a +3.
- Se rompe: mismos límites que Poiseuille (desarrollo, turbulencia, propiedades variables).

**Cortante por volumen de control [§2.4.3 p.52]**: `τ = -(dp/dx)(h/2)` — mismo resultado que la EDO, obtenido sin integrar nada, usando que el perfil en 1 y 2 es idéntico.

#### Semejanza
**Eq. (2.18) [p.58]** primer grupo adimensional: `p∞ / (ρ∞ U∞²)`.
**Eq. (2.19) [p.58]** con gas perfecto (p∞ = ρ∞RT∞) y a∞ = √(γRT∞): `p∞/(ρ∞U∞²) = RT∞/U∞² = a∞²/(γU∞²) = 1/(γM∞²)`, con M∞ = U∞/a∞.
- Supuesto: gas PERFECTO. Se rompe con gas real / alta temperatura (efectos listados en el régimen hipersónico, Tabla 2.1).
**Eq. (2.20) [p.59]** `Re∞,L = ρ∞U∞L/μ∞`, razón de efectos inerciales a viscosos.
- **Rango de validez de la derivación completa: flujos de PROPIEDADES CONSTANTES.** Cita literal (p.56-57): *"For simplicity, we will limit ourselves to constant-property flows, but keep in mind that real flows in real wind tunnels may not be constant."*
- Criterio: dos configuraciones geométricamente semejantes son dinámicamente semejantes si M1 = M2 **y** Re1 = Re2, con las mismas condiciones de frontera adimensionales.
- Se rompe: si las propiedades varían (compresibilidad fuerte, calentamiento), si la geometría no es semejante (fidelidad geométrica — punto de Bushnell), o si intervienen efectos no contenidos en la ecuación de momento adimensionalizada (aeroelasticidad, turbulencia de la corriente libre, montaje, propulsión instalada).

#### Capa límite
**[§2.6 p.65]** De las componentes x e y de (2.12) en 2D incompresible, con v << u dentro de una capa delgada: `|∂p/∂y| < |∂p/∂x|` ⇒ `∂p/∂y ≈ 0`.
- Supuestos: capa límite delgada y adherida; verificado experimentalmente en placa plana.
- **Se rompe**: capas límite turbulentas a Mach de borde ≈ 20, donde la presión de pared es "significantly greater than the edge value" [Bushnell et al. (1977)]. También pierde sentido cuando hay separación (cuerpos romos, altos ángulos de ataque), donde el campo se vuelve muy sensible a Re.

#### Energía
**Eq. (2.21) [p.66]** `∮dq - ∮dw = 0` (proceso cíclico, experimentos de Joule).
**Eq. (2.22)/(2.23) [pp. 66-67]** `dq - dw = de = d(ke) + d(pe) + d(ue)`.
**Eq. (2.24a) [p.67]** `dw = +p dv`, v = 1/ρ.
- Supuesto: **proceso reversible** — desplazamientos diferenciales, "no dissipative factors such as friction and/or heat transfer". Se rompe con fricción o transferencia de calor finita.
**Eq. (2.30) [p.70]** `h ≡ ue + p/ρ`.
**Eq. (2.32a) [p.71]** `ρ dh/dt - dp/dt = ∇·(k∇T) + Φ`, con Φ dada por (2.32b).
- Supuestos (los que pide el Problema 2.36, p.86, y que el software debe declarar): fluido newtoniano con hipótesis de Stokes, conducción de Fourier, campo de fuerzas de cuerpo conservativo, energías limitadas a cinética + potencial + interna, sin fuentes químicas/nucleares/radiativas.
**Eq. (2.33) [p.71]** integral. **Eq. (2.37) [p.74]** con trabajo de flujo absorbido: `Q̇ - Ẇv - Ẇs = ∂/∂t∫ρ(V²/2+gz+ue)d(vol) + ∮ρ(V²/2+gz+ue+p/ρ)V·n̂ dA`.
**Eq. (2.38) [p.74]** estacionario + adiabático + sin trabajo de eje + sin trabajo viscoso: `∮ρ(V²/2 + gz + h)V·n̂ dA = 0`.
**Bernoulli [Ej. 2.7, p.75]**: `V₁²/2 + gz₁ + p₁/ρ = V₂²/2 + gz₂ + p₂/ρ`.
- Supuestos acumulados: estacionario, no viscoso, unidimensional, incompresible (ρ₁=ρ₂), sin transferencia de calor, sin trabajo de eje ni viscoso, **sin cambio perceptible de energía interna (ue₁ = ue₂)**.
- Se rompe: cualquier disipación (ue crece), compresibilidad, o trabajo de eje.
**Temperatura total [Prob. 2.38–2.39, pp. 86–87]** `Ht = h∞ + ½U∞²`, `h = cpT`, `Ht = cpTt` — 1D, estacionario, adiabático, gas perfecto con cp constante.
**Relación isentrópica [Prob. 2.40, p.87]** el libro pide derivar `p/pt = (1 + (γ-1)/2 · M²)^(exponente)`. **El exponente sale corrupto del pdftotext** (aparece como `- g(g - 1)`); se declara ilegible — no se transcribe un valor que no puedo leer. El enunciado exige: "Carefully note the assumptions made at each step of the derivation. Under what conditions is this valid?"

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
════════════════════════════════════════════════════════════════════════════════════
1. EULER (§3.1, pp. 89-90)
════════════════════════════════════════════════════════════════════════════════════
  (3.1a) ρ du/dt = ρ ∂u/∂t + ρ(V·∇)u = ρ f_x − ∂p/∂x
  (3.1b) ρ dv/dt = ρ ∂v/∂t + ρ(V·∇)v = ρ f_y − ∂p/∂y
  (3.1c) ρ dw/dt = ρ ∂w/∂t + ρ(V·∇)w = ρ f_z − ∂p/∂z
  (3.2)  dV/dt = ∂V/∂t + (V·∇)V = f − (1/ρ)∇p          [Euler, 1755]

  SUPUESTO ÚNICO: esfuerzos cortantes viscosos despreciables (μ·du/dy ≈ 0 en esa región).
  RANGO: vale para compresible E incompresible — "No assumption has been made about density up to now" (p. 89).
  SE ROMPE: dentro de la capa límite, en estelas, en flujo separado, cerca de superficies con gradiente de
  velocidad grande. El propio libro avisa: la comparación teoría-vs-datos del cilindro (Fig 3.17) es la prueba
  de qué tan mal se rompe.

════════════════════════════════════════════════════════════════════════════════════
2. BERNOULLI — SUPUESTOS Y RANGO (§3.2, pp. 90-92)  ← EL REQUISITO CENTRAL
════════════════════════════════════════════════════════════════════════════════════
  Camino de derivación (todo literal del libro):
    (3.3)  f = −∇F                            [fuerzas de cuerpo CONSERVATIVAS]
           ∂V/∂t = 0                          [ESTACIONARIO]
           identidad: (V·∇)V = ∇(U²/2) − V×(∇×V)
    (3.4)  ∇(U²/2) + ∇F + (1/ρ)∇p − V×(∇×V) = 0
    (3.5)  d(U²/2) + dF + dp/ρ − [V×(∇×V)]·ds = 0

  El término V×(∇×V) es un vector PERPENDICULAR a V, por lo tanto su producto punto con ds se anula:
    (1) "for any displacement ds if the flow is irrotational (i.e., where ∇×V = 0)", o
    (2) "for a displacement along a streamline if the flow is rotational".

  ►►► LOS CINCO SUPUESTOS, LITERALES (p. 90):
      "Therefore, for a flow that is:
        1. Inviscid,
        2. Incompressible,
        3. Steady,
        4. Irrotational (or, if the flow is rotational, we consider only displacements along a streamline),
           and for which
        5. The body forces are conservative,"
      …la primera integral de la ecuación de Euler es (3.6)–(3.7).

    (3.6)  ∫d(U²/2) + ∫dF + ∫dp/ρ = constante
    (3.7)  U²/2 + F + p/ρ = constante
    (3.8)  F = gz                              [potencial de gravedad, z positivo hacia arriba]
    (3.9)  U²/2 + gz + p/ρ = constante         ← BERNOULLI COMPLETA
    (3.10) p + ½ρU² = constante                ← con ΔEP despreciable (caso aerodinámico)
    (3.11) p∞ + ½ρ∞U∞² = p_t = p₃ + ½ρ∞U₃²

  RANGO DE VALIDEZ:
    · Incompresible ⇒ M ≲ 0.3 (p. 90, literal: "compressibility effects are negligible when the Mach number is
      less than M ≈ 0.3").
    · IRROTACIONAL ⇒ la constante es LA MISMA en todo el campo ("valid anywhere in the flow field", p. 91).
    · ROTACIONAL ⇒ la constante cambia de línea de corriente a línea de corriente ("only valid along a
      streamline", p. 91).
    · Marco de referencia: debe ser aquel en que el flujo es estacionario (transformación galileana, Fig 3.1).
    · Sin mecanismo de disipación: "Bernoulli's equation is valid only for flows where there is no mechanism for
      dissipation, such as viscosity. In thermodynamics, the flow process would be called reversible." (p. 91)
    · Consistencia: con aceleración nula en todo el campo, (3.9) reproduce la hidrostática (1.17).

  QUÉ SE ROMPE FUERA DEL RANGO:
    · M > 0.3: p_t ya NO es p∞ + q∞. Literal: "Remember, however, that this statement is not true if the flow
      is compressible." (p. 92)
    · Dentro de la capa límite (puntos 4 y 5 del Problema 3.5): la disipación viscosa invalida (3.10); NO se
      puede recuperar la velocidad local a partir de la presión medida.
    · A través de una estela o una zona separada: dos líneas de corriente NO comparten la constante.
    · A través de una onda de choque (irreversible) o de una hélice/ventilador (trabajo de eje).

════════════════════════════════════════════════════════════════════════════════════
3. VELOCIDAD DE VUELO (§3.3, pp. 93-95)
════════════════════════════════════════════════════════════════════════════════════
  U∞ = sqrt( 2(p_t − p∞)/ρ∞ )          [sin numerar, p. 93]
  TAS = EAS · sqrt(ρ_SL/ρ)             [sin numerar, p. 95]

  Definiciones LITERALES (p. 94-95):
   1. IAS "equal to the Pitot-static airspeed indicator reading as installed in the airplane without correction
      for airspeed indicator system errors but including the sea-level standard adiabatic compressible flow
      correction."
   2. CAS "the result of correcting IAS for errors of the instrument and errors due to position or location of
      the pitot-static installation."
   3. EAS "equal to the airspeed indicator reading corrected for position error, instrument error, and for
      adiabatic compressible flow for the particular altitude. … the flight speed in the standard day sea-level
      air mass that would produce the same free-stream dynamic pressure as flight at the true airspeed at the
      correct density altitude."
   4. TAS "results when the EAS is corrected for density altitude."

  TABLA 3.1 (p. 95) — "Dynamic Pressure and EAS as a Function of Altitude and TAS", atmósfera US Std 1976.
  COPIA LITERAL (⚠ una celda con OCR sospechoso, ver §NO-OBSERVADO):

    Altitud →      Sea level (ρ=1.0000ρ_SL)   10,000 m (ρ=0.3376ρ_SL)   20,000 m (ρ=0.0726ρ_SL)
    TAS(km/h)      q∞(N/m²)      EAS(km/h)    q∞(N/m²)     EAS(km/h)    q∞(N/m²)     EAS(km/h)
      200          1.89×10³        200        6.38×10²       116.2      1.37×10²        53.9
      400          7.56×10³        400        2.55×10³       232.4      5.49×10²       107.8
      600          1.70×10⁴        600        5.74×10³       348.6      1.23×10³       161.6
      800          3.02×10⁴        800        1.02×10⁴       464.8      2.20×10³       215.5
     1000          4.73×10⁴       1000        1.59×10³ (⚠)   581.0      3.43×10³       269.4

  Verificación numérica propia (½ρV²) reproduce TODAS las celdas al ±0.3% salvo la marcada ⚠ (ver NO-OBSERVADO).

════════════════════════════════════════════════════════════════════════════════════
4. COEFICIENTE DE PRESIÓN (§3.4, p. 96)
════════════════════════════════════════════════════════════════════════════════════
  (3.12) Cp = (p − p∞)/(½ρ∞U∞²) = (p − p∞)/q∞     [SIEMPRE válida, es una definición]
  (3.13) Cp = 1 − U²/U∞²                           [SOLO donde Bernoulli aplica]
  Cp,t = 1.0 en el punto de remanso, incompresible.

  TABLA 3.2 (p. 96) — LITERAL:
    Velocity     Static Pressure     Pressure Coefficient
    U < U∞          p > p∞                Cp > 0
    U = U∞          p = p∞                Cp = 0
    U > U∞          p < p∞                Cp < 0

  SE ROMPE: (3.13) no aplica dentro de la capa límite ni en zona separada; (3.12) sí (es definición).
  En compresible, Cp,t ≠ 1 (se corrige en el cap. de flujo compresible).

════════════════════════════════════════════════════════════════════════════════════
5. CIRCULACIÓN, VORTICIDAD, KELVIN, HELMHOLTZ (§§3.5-3.7, 3.12.5)
════════════════════════════════════════════════════════════════════════════════════
  (3.14) −Γ = ∮_C V·ds                          ⚠ SIGNO NEGATIVO por convención (p. 99)
         Sentido de integración ANTIHORARIO: "the area enclosed by the curve C is always on the left".
         "A negative sign is used in equation (3.14) for convenience in the subsequent application to
          lifting-surface aerodynamics."
  (3.15) −Γ = ∮(u dx + v dy) = ∬_A (−(∂v/∂x − ∂u/∂y)) dx dy      [Green, plano]
  (3.16) ∮ V·ds = ∬_A (∇×V)·n̂ dA                                [Stokes, 3D]
         RANGO: A debe ser simplemente conexa y V continuamente diferenciable.
         SE ROMPE: "equation (3.16) is not valid if the area A contains regions where the velocity is infinite"
         (p. 101) — exactamente el caso del vórtice potencial en r = 0.
  (3.17) ∇×V = 0 ⇒ irrotacional (y sin singularidades) ⇒ Γ = 0, integral independiente del camino.
  (3.18) V·ds = dφ (diferencial exacta)   (3.19) V = ∇φ   (3.20) ∇×∇φ ≡ 0
  ξ = ∇×V = ξ_x î + ξ_y ĵ + ξ_z k̂ ;  ξ = 2ω  (la vorticidad es el DOBLE de la velocidad angular del elemento)
  2D: ξ_z = ∂v/∂x − ∂u/∂y

  TEOREMA DE KELVIN (§3.7, p. 103), enunciado LITERAL:
    "For an inviscid, barotropic flow with conservative body forces, the circulation around a closed fluid line
     remains constant with respect to time."
    Barotrópico ≡ ρ = ρ(p) ("sometimes called a homogeneous flow").
    Ecs. (3.21)–(3.25); resultado: d/dt ∮ V·ds = 0.
    IMPLICACIÓN (§3.7.1, p. 104): "the entire flow remains irrotational in the absence of viscous forces and of
    discontinuities provided that the flow is barotropic and the body forces can be described by a potential
    function."
    SE ROMPE: viscosidad, discontinuidades (choques), flujo baroclínico (ρ ≠ ρ(p) — p.ej. gradientes de
    temperatura), fuerzas de cuerpo no conservativas.

  TEOREMAS DE HELMHOLTZ (§3.12.5, p. 120-121) — Hermann von Helmholtz, 1858. LITERALES:
    "For a barotropic (homogeneous) inviscid flow acted upon by conservative body forces, the following
     statements about vortex filaments are true:
      1. The circulation around a given vortex line (i.e., the strength of the vortex filament) is constant
         along its length.
      2. A vortex filament cannot end in a fluid. It must form a closed path, end at a boundary, or go to
         infinity.
      3. No fluid particle can have rotation if it did not originally rotate. Or, equivalently, in the absence of
         rotational external forces, a fluid that is initially irrotational remains irrotational."
    Ejemplos dados: anillo de humo (camino cerrado); vórtice ligado a un perfil 2D de pared a pared en túnel
    (termina en frontera); extremos aguas abajo de las herraduras de un ala 3D (van al infinito).
    "Only through the action of viscosity (or some other dissipative mechanism) will they decay or disappear."

════════════════════════════════════════════════════════════════════════════════════
6. ECUACIÓN GOBERNANTE Y FRONTERAS (§3.8, pp. 104-106)
════════════════════════════════════════════════════════════════════════════════════
  (2.4)  ∇·V = 0                        [incompresible]
  (3.19) V = ∇φ                         [irrotacional]
  (3.26) ∂²φ/∂x² + ∂²φ/∂y² = ∇²φ = 0    ← LAPLACE, "linear, second-order PDE of the elliptic type"
  (3.30) ∇²ψ = 0                        [solo si además el flujo es IRROTACIONAL]

  FRONTERAS (§3.8.2, p. 105):
    Neumann: se prescribe ∇φ·n̂ (componente normal de la velocidad).  ← LA QUE USA EL LIBRO
    Dirichlet: se prescribe φ.
    Pared sólida (tangencia): ∇φ·n̂ = 0.
    Literal: "For applications in this book, the Neumann formulation will be used since most practical cases
    involve prescribed normal velocity boundary conditions."
    RANGO: "Within certain constraints on geometric slope continuity, a bounded, simply connected velocity field
    is uniquely determined by the distribution on the flow boundaries either of ∇φ·n̂ or of φ."
    SE ROMPE: dominios NO simplemente conexos (cilindro con circulación = multiplemente conexo ⇒ la solución NO
    es única hasta que se fija Γ; ver §3.15: "The resulting irrotational flow about the cylinder is uniquely
    determined once the magnitude of the circulation around the body is specified", p. 140).

════════════════════════════════════════════════════════════════════════════════════
7. FUNCIÓN DE CORRIENTE (§3.9-3.10, pp. 107-111)
════════════════════════════════════════════════════════════════════════════════════
  (3.27a) u = ∂ψ/∂y     (3.27b) v = −∂ψ/∂x
  (3.28a) dψ = −v dx + u dy    (3.28b) u dy − v dx = 0 sobre una línea de corriente ⇒ dψ = 0
  (3.29)  vr = (1/r)∂ψ/∂θ,  vθ = −∂ψ/∂r          [cilíndricas]
  (3.31)  (dy/dx)_{φ=C} = −u/v        (3.32) (dy/dx)_{ψ=C} = v/u
  (3.33)  (dy/dx)_{φ=C} = −1/(dy/dx)_{ψ=C}       ⇒ ψ ⟂ φ
  Cauchy-Riemann: u = ∂φ/∂x = ∂ψ/∂y,  v = ∂φ/∂y = −∂ψ/∂x   (cartesianas)
                  vr = ∂φ/∂r = (1/r)∂ψ/∂θ,  vθ = (1/r)∂φ/∂θ = −∂ψ/∂r   (cilíndricas)
  Q = Δψ  (caudal volumétrico por unidad de profundidad entre dos líneas de corriente)

  EXISTENCIA:
   · ψ existe si y solo si se satisface CONTINUIDAD 2D (condición necesaria y suficiente). Existe para flujo
     ROTACIONAL y, si es estacionario, también para COMPRESIBLE. Solo necesita DOS coordenadas espaciales ⇒
     también existe para flujo axisimétrico.
   · φ existe si y solo si el flujo es IRROTACIONAL.
   · ∇²ψ = 0 SOLO si además es irrotacional.
   · Ortogonalidad ψ⟂φ falla EXACTAMENTE en los puntos de remanso ("This observation is not true, however, at
     stagnation points, where the components vanish simultaneously", p. 110).

════════════════════════════════════════════════════════════════════════════════════
8. FLUJOS ELEMENTALES — TABLA 3.3 LITERAL (§3.12, p. 118)
════════════════════════════════════════════════════════════════════════════════════
   Flow                              ψ                             φ
   ─────────────────────────────────────────────────────────────────────────────────
   Uniform flow in x direction       U∞ r sinθ ,  U∞ y             U∞ r cosθ ,  U∞ x
   Uniform flow at angle α           U∞(y cosα − x sinα)           U∞(x cosα + y sinα)
   Source                            Kθ/(2π)                       (K/2π) ln r
   Doublet                           −(B/r) sinθ                   (B/r) cosθ
   Vortex (clockwise circulation)    (Γ/2π) ln r                   −Γθ/(2π)
   90° corner flow                   A x y                         ½A(x² − y²)
   Solid-body rotation               ½ω r²                         "Does not exist since flow is rotational"

  Ecuaciones numeradas asociadas:
   (3.34)  φ = U∞ r cosθ + C                     uniforme, cilíndricas
   (3.35a) φ = U∞ x + C                          uniforme, cartesianas
   (3.35b) φ = U∞(x cosα + y sinα)               uniforme a α ⇒ u = U∞cosα, v = U∞sinα
   (3.36)  φ = (K/2π) ln r                       FUENTE de intensidad K en el origen
   (3.37)  V = ∇φ = ê_r ∂φ/∂r + (ê_θ/r) ∂φ/∂θ
           vr = K/(2πr) ,  vθ = 0                "varies inversely with the radial distance"
   (3.38a) φ = −(K/2π) ln r                      SUMIDERO
   (3.38b) ψ = Kθ/(2π)
           dim[K] = (longitud)²/(tiempo). K = caudal volumétrico por unidad de profundidad (ver Ej. 3.4).
           SINGULARIDAD: continuidad se satisface en todas partes MENOS en el centro.
   (3.39a) φ = (B/r) cosθ                        DOBLETE, eje x, efflux hacia −x
           DEFINICIÓN: lim_{a→0}(K·a) = 2πB, con K = intensidad de fuente/sumidero y a = separación.
   (3.39b) ψ = −(B/r) sinθ
   (3.39c) φ = −(B/r) cosα cosθ                  doblete con eje a ángulo α (⚠ ver SORPRESAS: forma sospechosa)
   (3.40)  φ = −Γθ/(2π)                          VÓRTICE POTENCIAL (circulación HORARIA)
           ψ = (Γ/2π) ln r ;  vr = 0 ;  vθ = −Γ/(2πr)
           dim[Γ] = (longitud)²/(tiempo). "A potential vortex is also known as a free vortex."
           ∇×V = 0 en todas partes MENOS en r = 0: "the flow field at the origin is rotational and vorticity
           exists there".
           Γ_C = Γ si C encierra el origen;  Γ_C = 0 si NO lo encierra (demostrado con las curvas de Fig 3.13).
           "circulation requires vorticity to exist".
   VÓRTICE FORZADO (rotación de sólido rígido): vr = 0, vθ = rω ⇒ ∇×V = 2ω k̂ ≠ 0 ⇒ NO admite φ.
   VÓRTICE REAL (caja de concepto, p. 121-122): núcleo FORZADO + exterior LIBRE. "An actual vortex contains a
   forced core, with a free outer section, which is the combination of the two vortex types." Ejemplo: tornado,
   velocidades cerca del núcleo "sometimes in excess of 500 km/hr".

  SUPERPOSICIÓN (§3.11, p. 112) — reglas duras:
   · φ y ψ se SUMAN (Laplace es lineal). Las VELOCIDADES se suman.
   · ⚠ "pressures of the component flows cannot be superimposed (or added together), since they are nonlinear
     functions of the velocity" — la presión es CUADRÁTICA en U [ec. (3.10)].
   · "For a constant-density potential flow, the velocity field can be determined using only the continuity
     equation and the condition of irrotationality. Thus, the equation of motion is not used, and the velocity
     may be determined independently of the pressure." ⇒ el pipeline es: geometría → velocidad → (Bernoulli) →
     presión. NUNCA al revés.

════════════════════════════════════════════════════════════════════════════════════
9. CILINDRO SIN CIRCULACIÓN (§3.13, pp. 126-134)
════════════════════════════════════════════════════════════════════════════════════
  Construcción: uniforme + doblete con el eje paralelo al flujo y el efflux OPUESTO a la corriente.
    vθ = −U∞ sinθ − (B/r²) sinθ ;  vr = U∞ cosθ − (B/r²) cosθ
    vr = 0 ⟺ r = sqrt(B/U∞) ≡ R  ⇒  B = R² U∞
  (3.41a) vθ = −U∞ sinθ (1 + R²/r²)
  (3.41b) vr =  U∞ cosθ (1 − R²/r²)
  (3.42)  vθ|_{r=R} = −2 U∞ sinθ                     [velocidad de superficie]
  (3.43)  p = p∞ + ½ρ∞U∞²(1 − 4 sin²θ)
  (3.44)  Cp = 1 − 4 sin²θ

  CONVENCIÓN ANGULAR (p. 129, literal): "for cylindrical coordinates, θ = 180° corresponds to the plane of
  symmetry for the windward surface or forebody (i.e., the surface facing the free stream)".
    θ = 180° → remanso de BARLOVENTO (Cp = 1)
    θ =  90° y 270° → |U| = 2U∞, Cp = −3 (mínimo)
    θ =   0° → remanso de SOTAVENTO (Cp = 1)
  El flujo VIOLA el no-deslizamiento en la pared, y es CONSISTENTE que lo haga porque el modelo es no viscoso.

  FUERZAS (§3.13.3):
  (3.45) l = −∫₀^{2π} p sinθ R dθ           (3.46) l = 0
  (3.47) ∫₀^{2π} p∞ sinθ R dθ = 0           (presión constante sobre superficie cerrada ⇒ fuerza nula)
  (3.48) l/(q∞·2R) = −½ ∫₀^{2π} Cp sinθ dθ
  (3.49) Cl = l/(q∞·2R)                      ← ÁREA DE REFERENCIA POR VANO = 2R (el DIÁMETRO)
  (3.50) d = −∫₀^{2π} p cosθ R dθ           (3.51) d = 0   ← PARADOJA DE D'ALEMBERT (1752)
  (3.52) Cd = d/(q∞·2R) = −½ ∫₀^{2π} Cp cosθ dθ
  (3.53) CF = fuerza/(½ρ∞U∞²·S)

  Los integrales que se anulan (dados literalmente, útiles como tests simbólicos):
    ∫₀^{2π} sinθ dθ = 0 ; ∫₀^{2π} sin³θ dθ = 0 ; ∫₀^{2π} cosθ dθ = 0 ;
    ∫₀^{2π} sin²θ cosθ dθ = 0 ; ∫₀^{2π} sinθ cosθ dθ = 0 ; ∫₀^{2π} sin²θ dθ = π

  PARADOJA DE D'ALEMBERT, texto literal (p. 133):
    "A drag of zero is an obvious contradiction to our experience … This unusual result is known as d'Alembert's
     paradox, since Jean le Rond d'Alembert first arrived at this result in 1752. In fact, this result created a
     rift between the more practical side of fluid dynamics (the experimentalists) and the more theoretical side
     (the theoreticians). This rift would not be repaired until Ludwig Prantdl [sic] developed the concept of the
     boundary layer in the early twentieth century, which helped to explain that viscous effects cause flow
     separation."
  Y la explicación física del arrastre real: la diferencia entre la presión alta cerca de θ=180° y las presiones
  relativamente bajas cerca de θ=0° (donde la estela separada da presión MUCHO menor que la teórica).
  Descomposición: "pressure (or form) drag" (integral de la componente en corriente de la presión) vs
  "skin-friction drag" (integral de la componente en corriente del esfuerzo cortante). En el cilindro real el
  skin friction es PEQUEÑO y domina el form drag.

  ═══ DATOS EXPERIMENTALES DEL CILINDRO (lo que pediste — todo lo que el texto DA en palabras) ═══

  · Fig 3.17 (p. 129) — Cp(θ) teórico vs. datos de Schlichting (1968):
      curva 1: "Theoretical solution, equation (3.44)"
      curva 2: "Subcritical Reynolds number (1.86 × 10⁵), data of Schlichting (1968)"
      curva 3: "Supercritical Reynolds number (6.7 × 10⁵), data of Schlichting (1968)"
      Ejes: Cp de +2 a −3; θ de 180° → 270° → 0° → 90° → 180°.
      Hechos textuales:
       - "The subcritical pressure-coefficient distribution is essentially unchanged over a wide range of
         Reynolds numbers below the critical Reynolds numbers." Igual para la supercrítica por encima del crítico.
       - Aguas arriba de la separación la capa límite es delgada y el Cp "is essentially independent of the
         character of the boundary layer for the cylinder."
       - "If the attached boundary layer is turbulent, separation is delayed and the pressure in the separated
         region is higher and closer to the inviscid level."
       - "the actual pressure in the separated wake region near the leeward plane of symmetry (in the vicinity of
         θ = 0 in Fig. 3.17) is much less than the theoretical value."
      ⚠ Los VALORES numéricos de las curvas son imagen: NO OBSERVADOS (ver §NO-OBSERVADO).

  · Fig 3.19 (p. 131) — Localización de la separación vs Red, datos de Achenbach (1968). Red = ρ∞U∞d/μ∞.
    Números LITERALES del texto (p. 130):
       Red ≲ 3×10⁵ (subcrítico): capa límite laminar en barlovento, separación en θ ≈ 100°
                                  "that is, 80° from the windward stagnation point".
       Región crítica:            burbuja de separación intermedia; separación final "not occurring until θ = 40°
                                  (i.e., 140° from the stagnation point)".
       Red > 1.5×10⁶:             desaparece la burbuja ⇒ estado supercrítico alcanzado.
       Supercrítico:              separación en 60° < θ < 70°.
       Advertencia literal: "the critical Reynolds number is sensitive both to the turbulence level in the free
       stream and to the surface roughness".
    Hecho no trivial (p. 130): la separación ocurre en la superficie de BARLOVENTO, donde la solución no viscosa
    (3.44) todavía predice gradiente FAVORABLE. "Therefore, the occurrence of separation alters the pressure
    distribution on the forebody (windward surface) of the cylinder."

  · Fig 3.21 (p. 134) — Cd del cilindro liso vs ReD, datos de Schlichting (1968). Ejes: ReD de 4×10³ a 10⁶;
    Cd con marcas 0.1, 0.5, 1.0, 2.0 (log).
    Valor LITERAL del texto: "For Reynolds numbers below 300,000 the drag coefficient is essentially constant
    (approximately 1.2), and independent of Reynolds number." Razón dada: en cuerpos romos domina el form drag y
    el Cp subcrítico es insensible a Re. "Above the critical Reynolds number (when the forebody boundary layer is
    turbulent), the drag coefficient is significantly lower."
    Aplicación: promover transición a propósito — "the dimples on a golf ball or the seams on a baseball".

  · Figs 3.22 y 3.23 (pp. 136-137) — Talay (1975), NASA SP-367. Cd LITERALES impresos en la Fig 3.23:
       (a) Flat plate broadside to the flow (height = d),          Re_d = 10⁵  →  Cd = 2.0
       (b) Large cylinder with subcritical flow (diameter = d),    Re_d = 10⁵  →  Cd = 1.2
       (c) Streamlined body (thickness = d),                       Re_d = 10⁵  →  Cd = 0.12
       (d) Small cylinder with subcritical flow (diameter = 0.1d), Re_d = 10⁴  →  Cd = 1.2
       (e) Large cylinder with supercritical flow (diameter = d),  Re_d = 10⁷  →  Cd = 0.6
    Lecturas literales: "Streamlining produces dramatic reductions in the pressure (or form) drag with only a
    slight increase in skin-friction drag at this Reynolds number." · "the total drag of the small cylinder is
    equal to that of the much thicker streamlined shape" · "You can readily imagine how much additional drag was
    produced by the wire bracing of a biplane during World War I." · en (e) el arrastre DIMENSIONAL es el mayor
    de todos aun con Cd = 0.6, porque q∞ subió dos órdenes.

════════════════════════════════════════════════════════════════════════════════════
10. CILINDRO CON CIRCULACIÓN — KUTTA-JOUKOWSKI (§3.15, pp. 139-142)
════════════════════════════════════════════════════════════════════════════════════
  (3.54)  φ = U∞ r cosθ + (B/r) cosθ − Γθ/(2π)
  (3.55a) vr = U∞ cosθ − (B cosθ)/r²
  (3.55b) vθ = −U∞ sinθ − (B/r²) sinθ − Γ/(2πr)
          vr = 0 ⟺ r = sqrt(B/U∞) ≡ R  (igual que sin circulación: el vórtice NO cambia el radio)
  (3.56)  vθ|_{r=R} = −2U∞ sinθ − Γ/(2πR)
  (3.57)  Cp = 1 − [ 4sin²θ + 2Γ sinθ/(πRU∞) + (Γ/(2πRU∞))² ]
          ► TEST DE REGRESIÓN: con Γ = 0, (3.57) ⇒ (3.44) exactamente.
          ► "Any differences in our results for the rotating cylinder will have to be due to the terms containing
            the vortex strength, which is again due to the linear nature of the solutions."
  ARRASTRE: d = −∫₀^{2π} p cosθ R dθ = 0 (los tres integrales resultantes se anulan).
          GENERALIZACIÓN LITERAL (p. 140): "The prediction of zero drag may be generalized to apply to any
          general, two-dimensional body in an irrotational, steady, incompressible flow."
  (3.58)  l = −∫₀^{2π} p sinθ R dθ = ρ∞ U∞ Γ         ← KUTTA-JOUKOWSKI
          Solo sobrevive el término −2Γsinθ/(πRU∞) de (3.57), vía ∫₀^{2π} sin²θ dθ = π.
          ALCANCE LITERAL (p. 141): "This result, which is known as the Kutta-Joukowski theorem, applies to the
          potential flow about closed cylinders of ARBITRARY CROSS SECTION."
          Argumento: lejos del cuerpo, el conjunto de fuentes/sumideros/vórtices interiores se ve como UN doblete
          con circulación igual a la suma de las intensidades de vórtice; para cuerpo CERRADO Σfuentes = Σsumideros.
          "in the limit, the forces acting are independent of the shape of the body".
  (3.59)  θ_stag = sin⁻¹( −Γ/(4πRU∞) )
          Γ < 4πRU∞  ⇒ dos puntos de remanso sobre la superficie, simétricos respecto al eje y.
          Γ = 4πU∞R  ⇒ UN solo punto de remanso, en θ = 270°.
          Γ > 4πU∞R  ⇒ ningún punto de remanso sobre el cuerpo ("unless the circulation is so strong that no
                        stagnation point exists on the body").
  (3.60)  l = ρ∞U∞Γ = 4π ρ∞U∞²R      [en Γ = 4πU∞R]
  (3.61)  Cl = (4π ρ∞U∞²R)/(½ρ∞U∞²·2R) = 4π
          "The value 4π represents the maximum lift coefficient that can be generated for a circulating flow
           around a cylinder … This result is an important 'upper limit' for airfoil aerodynamics."
  Fig 3.25 (p. 142): líneas de remanso para Γ = 2πU∞R (a) y Γ = 4πU∞R (b), y Cp(θ) para ambos (c). Eje Cp de +2 a
  −16 ⇒ el pico de succión con Γ = 4πU∞R llega a ~−15..−16 (calculable exacto con (3.57): en θ = 90°,
  Cp = 1 − (2 + 2)² = −15).

  APLICACIONES A PERFILES (§3.15.3, p. 142-144): mapeo conforme (transformación de Joukowski, Fig 3.26,
  referida a Karamcheti 1980), método de paneles (§3.16), teoría de perfil delgado (cap. 6). "Although the
  potential flow around a cylinder is not an accurate model, when transformed into a streamlined shape like an
  airfoil it actually works very well."

════════════════════════════════════════════════════════════════════════════════════
11. FLUJO AXISIMÉTRICO Y ESFERA (§3.17, pp. 149-152)
════════════════════════════════════════════════════════════════════════════════════
  Condiciones: vθ ≡ 0 y ∂/∂θ ≡ 0.
  (3.71) ∂(r vr)/∂r + ∂(r vz)/∂z = 0
  (3.72) vr = (1/r)∂ψ/∂z ,  vz = −(1/r)∂ψ/∂r      [ψ de Stokes; ψ = cte define una SUPERFICIE de corriente]
  (3.73) vr = ∂φ/∂r ,  v_ν = (1/r)∂φ/∂ν ,  v_θ = (1/(r sinν))∂φ/∂θ     [esféricas]
  Doblete axisimétrico: φ = +(B/4πr²) cosν  (fuente aguas arriba, eje paralelo al flujo)
  (3.74) φ = U∞ r cosν + (B/4πr²) cosν
         vr = 0 ⟺ r³ = B/(2πU∞) ≡ R³  ⇒  B = 2πU∞R³
  (3.75a) vr = U∞cosν − (B/2πr³)cosν      (3.75b) v_ν = −U∞sinν − (B/4πr³)sinν
  (3.76a) vr = U∞(1 − R³/r³) cosν         (3.76b) v_ν = −U∞(1 + R³/(2r³)) sinν
  (3.77)  U|_{r=R} = v_ν = −(3/2) U∞ sinν        ← el máximo es 1.5·U∞, NO 2·U∞
  (3.78)  p = p∞ + ½ρ∞U∞² − ½ρ∞U∞²(9/4 sin²ν)
  (3.79)  Cp = 1 − (9/4) sin²ν                    ← comparar con (3.44) Cp = 1 − 4 sin²θ
  (3.80)  CD = arrastre/(q∞ · πd²/4)              ← área de referencia FRONTAL (≠ 2R del cilindro)
  Fig 3.31 (p. 151): CD de esfera vs Red (Schlichting 1968), comparado con el cilindro liso. Texto: "The Reynolds
  number dependence of the drag coefficient for a smooth sphere is similar to that for a smooth cylinder. Again,
  a significant reduction in drag occurs as the critical Reynolds number is exceeded and the windward boundary
  layer becomes turbulent." ⚠ Ningún valor numérico de esta figura está en el texto.
  Advertencia LITERAL (p. 151): "although the configurations have the same cross section in the plane of the
  paper (a circle) and both are described in terms of two coordinates, the flows are significantly different."
```

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


**1. El modelo de dos regiones (p.166–167).** *"One common approach is to divide the flow field into two regions:
(1) a viscous boundary layer adjacent to the surface of the vehicle and (2) the essentially inviscid flow outside
the boundary layer."* Traducción: se parte el campo en capa límite viscosa + flujo no-viscoso exterior. El
procedimiento canónico es: (a) resolver el no-viscoso con la condición de tangencia; (b) calcular la capa límite
usando el no-viscoso como condición de borde exterior. Si la capa límite es gruesa hace falta iterar,
sustituyendo la geometría real por la **configuración efectiva** = superficie + δ*.

**2. Por qué las ecuaciones de capa límite (§4.1, p.168–169).** De comparar términos de las ecs. (4.2) y (4.3)
bajo u ≫ v se concluye ∂p/∂x ≫ ∂p/∂y, y por tanto (4.4) ∂p/∂y ≈ 0. *"The essential information supplied by the
y component of the momentum equation is that the static pressure variation in the y direction may be neglected
for most boundary layer flows. This is true whether the boundary layer is laminar, transitional, or turbulent."*
Rompimientos declarados: estelas / regiones separadas detrás de cuerpos romos, y capa turbulenta a Mach muy alto.

**3. Transporte de momento: microscópico vs macroscópico (p.169–170, Fig. 4.2).** Laminar = intercambio molecular.
Turbulento = transporte macroscópico de "lumps" de fluido, con un esfuerzo turbulento efectivo *"that is very
large"*. Consecuencia doble y no negociable: la capa turbulenta es **más gruesa** y a la vez tiene **más esfuerzo
en la pared**.

**4. Similaridad (§4.3, p.174).** Con β = (2s/u_e)(du_e/ds) constante, las derivadas en s se anulan y la EDP se
reduce a la EDO de Falkner-Skan. *"because the dimensionless velocity function f' is a function of η only, the
velocity profiles at one s station are the same as those at another; therefore, the solutions are called similar
solutions."* Nota clave: **el número de Reynolds no aparece** en las coordenadas transformadas; reaparece al
volver a (x,y).

**5. Separación (p.176–177).** El signo de β manda: β<0 ⇔ flujo no-viscoso desacelerando ⇔ gradiente adverso
(dp/dx>0). En β = −0.1988 *"not only is the streamwise velocity zero at the wall, but the velocity gradient ∂u/∂y
is also zero at the wall. If the adverse pressure gradient were any larger, the laminar boundary layer would
separate from the surface, and flow reversal would occur."*

**6. Transición (§4.4, p.189–192).** No es un punto: es un proceso de 7 etapas sobre una longitud finita
(*"the length of the transition zone may be as long as the laminar region"*, p.171). El libro es explícito en que
se modela como punto por conveniencia: *"aerodynamicists commonly assume transition takes place at a single
location for ease in making calculations and estimates."*

**7. Descomposición de Reynolds (§4.5.1, p.195–197).** u = ū + u'. La media temporal de un fluctuante es cero,
pero la de PRODUCTOS de fluctuantes no: v'=0, ∂(v')/∂x=0, pero **u'v' ≠ 0**. De ahí sale el esfuerzo de Reynolds
−ρu'v', que *"is the source of considerable difficulties … because its analytical form is not known a priori."*
Depende de propiedades del fluido, de las condiciones locales (velocidad, geometría, rugosidad, historia aguas
arriba) y de la distancia a la pared. Cerca de la pared v y v' → 0 y para **y < 0.02δ el flujo es básicamente
laminar**.

**8. Estructura de capas de la capa turbulenta (§4.5.3, Fig. 4.15, p.199–202).**
- Subcapa laminar/viscosa: u⁺ = y⁺, hasta y⁺ ≈ 5–10.
- Capa buffer.
- Región log: 70 < y⁺ < 400, u⁺ = (1/κ)ln y⁺ + B.
- Región exterior / ley de defecto: y⁺ > 200, contiene 80–90% de δ; componente de "estela".

**9. El problema de cierre (§4.5.2 y §4.6).** Al no haber más leyes físicas disponibles, se introducen
correlaciones empíricas — los *turbulence models*. Cita literal de Neumann (1989), p.199: *"Turbulence models
employed in computational schemes to specify the character of turbulent flows are just that … models, non-physical
ways of describing the character of the physical situation of turbulence. The models are the result of generalizing
and applying fundamental experimental observations; they are not governed by the physical principles of turbulence
and they are not unique."*

**10. El compromiso de diseño (§4.5, p.193).** *"since a turbulent boundary layer can negotiate an adverse pressure
gradient for a longer distance, boundary-layer separation may be delayed or even avoided altogether. Delaying (or
avoiding) the onset of separation reduces the pressure component of the drag (i.e., the form drag). For a blunt body
or for a slender body at angle of attack, the reduction in form drag usually dominates the increase in skin-friction
drag."*

**11. Térmica (§4.8).** Con Pr = μc_p/k = 1 las ecuaciones de energía y de momento adimensionalizadas son
IDÉNTICAS con condiciones de frontera idénticas ⇒ capas térmica y de velocidad coinciden ⇒ analogía de Reynolds
St = cf/2. Para aire Pr ≈ 0.7 y hay que usar la analogía modificada con Pr^{0.667}.

---

### Cap. 5 — Characteristic Parameters for Airfoil and Wing Aerodynamics (pp. 226–293)


**Descomposición de fuerzas (§5.1.1, p.228)**
- L = N·cos α − A·sin α ; D = N·sin α + A·cos α. Supuesto: fuerzas en el plano de simetría (plano
  de cabeceo). Fuera del plano aparece la fuerza lateral Y, positiva hacia el ala de estribor.
- SLUF: L = W, T = D. **Supuesto explícito: ángulos pequeños.** Se rompe en ascenso pronunciado o
  con empuje muy inclinado.

**Geometría (§5.3, pp. 237–238)**
| Cantidad | Definición | Notas de implementación |
|---|---|---|
| S | área en planta proyectada, **incluyendo la parte cubierta por fuselaje/góndolas** | el kernel debe proyectar el ala teórica completa |
| b | distancia recta punta a punta | medición sobre la geometría, no parámetro suelto |
| c̄ | b·c̄ = S | derivada, no independiente |
| AR | b²/S (general); b/c (rectangular) | rango observado 2–35 |
| λ | ct/cr | 1.0 rectangular, 0.0 delta puntiaguda |
| Λ | ángulo entre la línea del 25% de cuerda y la perpendicular a la cuerda de raíz | reportar también Λ_LE y Λ_TE |
| mac | (1/S)·∫_{−b/2}^{+b/2} [c(y)]² dy | para ala trapezoidal ec. 5.35 |
| diedro | ángulo entre plano horizontal por la cuerda de raíz y el plano medio del ala | negativo = anhedro |
| torsión | variación en envergadura de la incidencia | washout = disminuye hacia la punta |

- **mac trapezoidal**: mac = (2/3)·(cr + ct − cr·ct/(cr + ct)) = (2/3)·cr·(λ² + λ + 1)/(λ + 1)
  [ec. 5.35]. **Rango de validez: SÓLO ala trapezoidal (bordes rectos).** Fuera de ahí hay que
  integrar la ec. de §5.3 numéricamente sobre c(y) real — que es exactamente lo que hace el
  Ejemplo 5.2 con el Orbiter.
- **AR de un ala delta**: AR = 4/tan Λ_LE [ec. 5.1]. Rango de validez: delta pura (triángulo, punta
  afilada, borde de salida recto y perpendicular). Se rompe con cualquier estrechamiento no nulo.

**Coeficientes (§5.4)**
- CL = L/(q∞S) [5.7]; Cl = l/(q∞c) [5.8]; Cl = Clα(α − α0l) [5.9]; CM0 = M0/(q∞Sc) [5.15];
  Cm0 = m0/(q∞c·c) [5.16]; Cᏸ = ᏸ/(q∞Sb) [5.17]; Cᏺ = ᏺ/(q∞Sb) [5.18]; CD ≡ D/(q∞Sref) [5.33];
  Cd = d/(q∞c) [5.23].
- **Por qué el coeficiente es independiente de escala y condiciones (derivación §5.4.1, pp. 244–246):
  Fz/(q∞S) = ∬ Cp d(x/c) d(y/b) [ec. 5.6]. Supuesto CLAVE: "When the boundary layer is thin, the
  pressure distribution around the airfoil is essentially that of an inviscid flow... the pressure
  coefficient at a particular location on the surface given by the dimensionless coordinates
  (x/c, y/b) is independent of vehicle scale and of the flow conditions."**
  **Qué se rompe fuera**: cuando la capa límite deja de ser delgada (ángulos altos, separación,
  interacción onda de choque/capa límite) el Cp SÍ depende de Re y Mach, y el coeficiente deja de
  ser un invariante geométrico.
- **Asimetría entre coeficientes**: sustentación y momento salen esencialmente de la presión y son
  independientes de Reynolds mientras la capa sea delgada; el ARRASTRE depende de Reynolds tanto a
  ángulos bajos (por la posición de la transición) como a ángulos altos (por separación). El
  software debe reportar CL y CM sin Re pero JAMÁS CD sin Re. (§5.4.4, p.259)

**Fricción de placa plana (§5.4.3, pp. 253–254)**
| Ec. | Fórmula | Rango de validez | Qué se rompe fuera |
|---|---|---|---|
| 5.24 | cf_local,lam = 0.664/Rex^0.5 | capa laminar, incompresible, placa plana, gradiente de presión nulo | con gradiente adverso subestima; el perfil real acelera y decelera |
| 5.25 | cf_local,turb = 0.0583/Rex^0.2 | capa turbulenta, incompresible, placa plana | igual |
| 5.27 | Cf_total,lam = 1.328/√ReL | laminar en TODA la placa | si hay transición sobreestima el laminar |
| 5.28 | Cf_total,turb = 0.074/ReL^0.2 | turbulento desde el borde de ataque (formulación de Prandtl) | el libro la declara MENOS precisa que la 5.29 |
| 5.29 | Cf_total,turb = 0.455/(log10 ReL)^2.58 | Prandtl-Schlichting, "shown to be more accurate" | es la que usa el método de arrastre del §5.4.6 |
| 5.37 | Cf = 0.455/(log10 ReL)^2.58 − 1700/ReL | mezcla laminar+turbulento con **transición supuesta en Rex,tr = 500,000** | si la transición real no está en 5×10⁵ el término −1700/ReL es el equivocado; el libro EXIGE barrer la sensibilidad |
- Rex = ρ∞U∞x/μ∞ [5.26]; ReL = ρ∞U∞L/μ∞ [5.30]; para el ala L = mac [5.36].

**Ala finita (§5.5)**
- CLα = a0/(1 + a0/(πAR)) [ec. 5.41], en 1/rad. **Supuestos: ala IDEAL, SIN FLECHA, carga elíptica
  implícita (no lleva factor de eficiencia de envergadura).** En grados: a = a0/(1 + 57.3·a0/(πAR)).
  Qué se rompe fuera: alas con flecha, AR muy bajo, o distribución no elíptica.
- Polar: CD = CD,min + k'CL² + k''(CL − CL,min)² [5.43] → CD = CD0 + kCL² [5.46] → CD = CD0 + kCL² +
  ΔCDM [5.47]. **Supuestos declarados de la 5.46/5.47: CL,min ≈ 0, k2 ≈ 0, CD,min ≈ CD0.**
  "In the case where these assumptions are not true, you may need to return to equation (5.45)."
- k = 1/(π·e·AR) [de 5.48], e = factor de eficiencia del avión (Oswald), típico 0.6–0.95.
  **Qué se rompe fuera**: cerca de CLmax e deja de ser constante; y "The deviation of the actual
  airplane drag from the quadratic correlation, where e is a constant, is significant for airplanes
  with low aspect ratios and sweepback."
- Aparición del arrastre de onda: Mach de corriente libre ≈ 0.7 o mayor.
- L/D = W/D_total = CL/(CD0 + CDi) [5.49].
- (L/D)max: CL = √(CD0/k), (L/D)max = 1/(2√(k·CD0)) [Problema 5.3, demostrado y usado en el
  Ejemplo 5.7]. En ese punto arrastre parásito = arrastre inducido.

### 2.bis — Correlaciones de capa límite con su rango de validez (cap. 4)


Notación: `cf` = coef. de fricción LOCAL; `Cf_tot` = coef. de fricción TOTAL/promedio (`C̄f` en el libro).
Todas asumen: flujo estacionario, 2D, incompresible/propiedad constante, sin curvatura fuerte de líneas de
corriente, superficie LISA (el capítulo nunca cuantifica rugosidad).

| Correlación | Fórmula | Rango de validez | Qué se rompe fuera | Ec. del libro |
|---|---|---|---|---|
| Continuidad 2D incompresible | ∂u/∂x + ∂v/∂y = 0 | ρ = cte | Flujo compresible: hay que resolver energía simultáneamente (§4.1 p.169 remite al cap. 8) | (4.1) p.168 |
| Momento-x de capa límite | ρu ∂u/∂x + ρv ∂u/∂y = ρ_e u_e du_e/dx + μ ∂²u/∂y² | Capa delgada, u≫v, líneas de corriente poco curvadas | Cerca del punto de remanso u≫v falla; en estelas/separación ∂p/∂y≠0 | (4.6) p.169 |
| Presión desde el no-viscoso | −∂p/∂x = −dp_e/dx = ρ_e u_e du_e/dx | Capa delgada, ∂p/∂y≈0 | Turbulenta a Mach muy alto; estelas; cuerpos romos | (4.5) p.169 |
| Coordenada de similitud (Bertin) | η = u_e y/√(2νs), s = ∫u_e dx; placa plana η = y√(u_e/(2νx)) | Laminar incompresible | — (definición) | (4.9a,b),(4.10) p.172 |
| Falkner-Skan | f''' + f f'' + β[1−(f')²] = 0 | −0.1988 ≤ β ≤ +2.0 (soluciones generadas en ese rango) | β < −0.1988: no hay solución adherida (separación). β > 2.0: fuera del set tabulado | (4.16) p.174 |
| Esfuerzo laminar general | τ = μu_e²·f''(0)/√(2νs) | Laminar, similar | Requiere β ≈ cte localmente; con grandes variaciones de β la hipótesis de similitud cae (§4.3.1 p.187) | (4.19) p.176 |
| Esfuerzo laminar placa plana | τ = 0.332·√(ρμu_e³/x) | β=0, laminar, incompresible | x→0 diverge (borde de ataque singular) | (4.20) p.176 |
| **cf laminar** | cf = 0.664/√Re_x | Placa plana, laminar, incompresible, Re_x < Re_x,tr | Más allá de transición subestima el drag por factor ~5 | (4.21) p.177 |
| **δ laminar** | δ/x = 5.0/√Re_x  (η_δ=3.5, u=0.99u_e) | Placa plana, laminar, incompresible | δ ∝ √x: en el borde de ataque δ→0 (no físico); a gradiente no nulo cambia | (4.23) p.178 |
| v_e en el borde | v_e/u_e = 0.84/√Re_x | Placa plana, laminar | Es el flujo hacia arriba por desplazamiento; nulo solo si δ no crece | (4.25) p.178 |
| **δ* laminar** | δ*/x = 1.72/√Re_x  (≈ δ/3) | Placa plana, laminar, incompresible | Definición general (4.26) sí vale con gradiente; el 1.72 no | (4.27) p.179 |
| **θ laminar** | θ/x = 0.664/√Re_x  (≈ 0.13·δ) | Placa plana, laminar, incompresible | Idem | (4.29) p.180 |
| **Cf_tot laminar** | Cf_tot = 1.328/√Re_L = 2·cf(L) | Placa plana laminar en TODA su longitud | Si hay transición hay que usar (4.85)/(4.86)/(4.87) | (4.32) p.180 |
| C_D desde Cf_tot | C_D = Cf_tot·(S_wet/S_ref) | Siempre | Sumar Cf_tot de componentes distintos con S_wet distintos da resultado INCORRECTO | (4.33),(4.34) p.180-181 |
| C_D placa plana laminar 2 caras | C_D = 2.656/√Re_c (referido a c·b) | Placa infinitamente delgada, laminar, ambas caras | Placa con espesor: aparece drag de presión | (4.37) p.182 |
| Perfil cúbico aproximado | u/u_e = (3/2)(y/δ) − (1/2)(y/δ)³ | Laminar, aproximación integral | Es aproximación; el libro lo llama *"a more realistic approximation"* frente al lineal | (4.38) p.185 |
| **Criterio de transición** | Re_x,tr = 500,000; x_tr = Re_x,tr/(ρu_e/μ) | *"For incompressible flow past a flat plate, a typical transition criterion"* | Superficie rugosa / túnel turbulento / gradiente adverso ⇒ antes. Gradiente favorable / Mach alto / succión / pared fría ⇒ después | (4.39),(4.40) p.191 |
| Intermitencia de transición | γ_tr = 1 − exp[−G(x−x_tr)∫_{x_tr}^{x} dx/u_e]; G = 8.35×10⁻⁴(u_e³/ν²)Re_x,tr^{−1.34} | Zona de transición, incompresible | γ_tr=0 en x_tr, γ_tr=1 al final de la transición | (4.68a,b) p.204 |
| Boussinesq | −ρu'v' = ρν_t(∂u/∂y); τ = ρ(ν+ν_t)(∂u/∂y) | Turbulento, cierre algebraico | ν_t NO es propiedad del fluido: depende de rugosidad, gradiente, historia | (4.59),(4.60) p.202 |
| Longitud de mezcla | −ρu'v' = ρl²|∂u/∂y|(∂u/∂y); ν_t = l²|∂u/∂y| | Turbulento, equilibrio local | *"provide only rough approximations to the actual flow and often lack generality"* (p.203) | (4.61),(4.62) p.203 |
| Mezcla capa interior (van Driest) | l_i = κy[1−exp(−y/A)], κ=0.41; A = 26ν/(N u*); N=(1−11.8p⁺)^0.5; p⁺=(νu_e/(u*)³)(du_e/dx) | Capa interior turbulenta | p⁺ > 1/11.8 ⇒ N imaginario (gradiente adverso extremo) | (4.63),(4.64a,b,c) p.203 |
| ν_t capa exterior (Cebeci-Smith) | (ν_t)_o = α u_e δ*; α = 0.02604/(1+Π); Π = 0.55[1−exp(−0.243√z₁ − 0.298z₁)]; z₁ = Re_θ/425 − 1 | Capa exterior turbulenta | Re_θ < 425 ⇒ z₁ < 0 ⇒ √z₁ imaginario (capa turbulenta poco desarrollada) | (4.66),(4.67a,b,c) p.203-204 |
| **u⁺ subcapa laminar** | u⁺ = y⁺ | y⁺ ≲ 5 a 10 | Fuera de la subcapa el perfil ya no es lineal | (4.54) p.200 |
| **Ley logarítmica** | u⁺ = (1/κ)ln y⁺ + B; κ ≈ 0.40 ó 0.41; B ≈ 5.0 a 5.5 | 70 < y⁺ < 400 | *"valid only in regions where the laminar shear stress can be neglected in comparison with the turbulent stress"* | (4.57a,b) p.201-202 |
| **Ley del defecto** | (u_e−u)/u* = −(1/κ)ln(y/δ) + A; A ≈ 2.35 | Región exterior; y⁺ > 200; 80–90% de δ | No vale cerca de la pared (ahí manda la viscosidad) | (4.58) p.201-202 |
| C_d integral | C_d = 2θ/L (un lado) | Placa plana, laminar o turbulenta, incompresible | Requiere θ evaluado en x=L | (4.75) p.207 |
| **Ley de 1/7** | u/u_e = (y/δ)^{1/7} | **5×10⁵ ≤ Re_x ≤ 1×10⁷** | ∂u/∂y → ∞ en la pared: NO sirve para τ_w. Fuera del rango el exponente cambia | (4.76) p.208 |
| **cf turbulento (Blasius)** | cf = 0.0456(ν/(u_e δ))^{0.25} | **5×10⁵ ≤ Re_x ≤ 1×10⁷** | Dato experimental; extrapolación fuera de rango no soportada | (4.77) p.208 |
| **δ turbulento** | δ/x = 0.3747/Re_x^{0.2} | Turbulento desde el borde de ataque, 5×10⁵–1×10⁷ | Cerca de x_tr la hipótesis "turbulento desde x=0" es falsa (§Ej. 4.4) | (4.79) p.209 |
| **δ* turbulento** | δ*/x = 0.0468/Re_x^{0.2} = δ/8 | Idem, ley 1/7 | δ*=δ/(1+n) con 1/n=1/7 | (4.79) p.209 |
| **θ turbulento** | θ/x = 0.0364/Re_x^{0.2} = 7δ/72 | Idem, ley 1/7 | θ = nδ/[(1+n)(2+n)] | (4.79) p.209 |
| **cf turbulento local** | cf = 0.0583/Re_x^{0.2} | 5×10⁵ ≤ Re_x ≤ 1×10⁷ | — | (4.80) p.209 |
| Cf_tot turbulento (Prandtl) | Cf_tot = 0.074/Re_L^{0.2} | Turbulento en toda la placa | **Solo ±25% contra experimento** — el libro dice que se use (4.82) en su lugar | (4.81) p.209 |
| **Cf_tot Prandtl-Schlichting** | Cf_tot = 0.455/(log₁₀Re_L)^{2.58} | Placa lisa, turbulenta | **±3%** — *"the most accurate relation which is also straightforward to use"* | (4.82) p.209 |
| Cf_tot Karman-Schoenherr | 1/√Cf_tot = 4.13·log₁₀(Re_L·Cf_tot) | Placa lisa, turbulenta | **±2%**, pero implícita ⇒ requiere iteración | (4.83) p.209 |
| Cf_tot Schultz-Grunow | Cf_tot = 0.427/(log₁₀Re_L − 0.407)^{2.64} | Placa lisa, turbulenta | **±7%** | (4.84) p.209 |
| C_D con transición (integral) | C_D = (1/L)[∫₀^{x_tr}cf_lam dx + ∫_{x_tr}^{L}cf_turb dx] | Placa plana con transición en un punto | Requiere x_tr como entrada | (4.85) p.210 |
| C_D con transición (totales) | C_D = Cf_turb·Lb/S_ref − Cf_turb·x_tr b/S_ref + Cf_lam·x_tr b/S_ref | Idem | Sumar Cf_tot directamente SIN restar el tramo turbulento es un error | (4.86) p.210 |
| **Cf_tot con corrección de transición** | Cf_tot = 0.455/(log₁₀Re_L)^{2.58} − A/Re_L, A de Tabla 4.5 | Re_x,tr ∈ {3×10⁵, 5×10⁵, 1×10⁶, 3×10⁶} | Fuera de esos 4 valores hay que interpolar A. Si x_tr < 10% de L la corrección es ignorable | (4.87) p.210-211 |
| **Ec. integral de momento (von Kármán)** | dθ/dx + (2+H)(θ/u_e)(du_e/dx) = cf/2 | 2D, incompresible, con gradiente de presión | Tres incógnitas (θ,H,cf) en una ecuación: hay que cerrar | (4.88) p.213 |
| **Factor de forma** | H = δ*/θ | Definición | Ley 1/7 ⇒ H≈1.3; separación turbulenta ~2.2 (Kroo 2007); rango de separación 1.8–2.8 | (4.89) p.214 |
| Entrainment de Head | d(u_e θ H₁)/dx = u_e F; H₁ = (δ−δ*)/θ; H₁ = G(H) | Turbulento con gradiente | Correlación empírica de Cebeci & Bradshaw (1979) | (4.90),(4.91) p.214 |
| F(H₁) | F = 0.0306(H₁ − 3.0)^{−0.6169} | Turbulento | H₁ ≤ 3.0 ⇒ singularidad/negativo | (4.92) p.214 |
| G(H) por tramos | G = 0.8234(H−1.1)^{−1.287} + 3.3 si H ≤ 1.6; G = 1.5501(H−0.6778)^{−3.064} + 3.3 si H ≥ 1.6 | Turbulento | H ≤ 1.1 (primer tramo) o H ≤ 0.6778 (segundo) ⇒ base negativa a potencia fraccionaria = NaN | (4.93) p.214 |
| cf(H, Re_θ) — White (2005) | cf = 0.3·e^{−1.33H}/(log Re_θ)^{1.74+0.31H} | Turbulento con gradiente | Curvefit; Re_θ ≤ 10 ⇒ log Re_θ ≤ 1 y el exponente amplifica el error | (4.94) p.214 |
| Re_θ | Re_θ = ρu_eθ/μ | Definición | — | (4.95) p.214 |
| **Número de Prandtl** | Pr = μc_p/k | Definición | Pr=1 ⇒ capas térmica y de velocidad idénticas | (4.100) p.216 |
| Razón de espesores térmica/velocidad | δ_T/δ ≈ 1/√Pr | Aire, propiedad constante | Cita a Schlichting & Gersten (2000) | p.216 |
| Stanton | St ≡ C_h = q̇/(ρu_e c_p(T_e − T_w)) | Definición | — | (4.103) p.216 |
| **Analogía de Reynolds** | St = cf/2 | **SOLO Pr = 1** | Con aire (Pr≈0.738) sobreestima; usar (4.115) | (4.106) p.217 |
| Conductividad térmica del aire | k = 4.76×10⁻⁶·T^1.5/(T+112)  [cal/cm·s·K] | T por debajo de disociación de O₂ ≈ **2000 K a presión atmosférica** | Arriba de ~2000 K el aire disocia y la relación deja de valer | (4.107) p.217 |
| Gradiente térmico en la pared (Pohlhausen) | (∂θ/∂η)_{η=0} = 0.4696·Pr^{0.333} | Laminar, placa plana | Con la η de Bertin (con el factor 2) | p.218 |
| q̇ laminar | q̇ = 0.332·k(T_e−T_w)·Pr^{0.333}·√(u_e/(νx)) | Laminar, placa plana, propiedad constante | x→0 diverge | (4.111) p.218 |
| **St laminar** | St = 0.332/(Pr^{0.667}·Re_x^{0.5}) | Laminar, placa plana | — | (4.112) p.219 |
| Nusselt | Nu_x = h x/k, h = q̇/(T_e−T_w) | Definición | — | (4.113a,b) p.219 |
| **Nu laminar** | Nu_x = 0.332·Re_x^{0.5}·Pr^{0.333} | Laminar, placa plana | — | (4.114) p.219 |
| **Analogía de Reynolds modificada** | St = cf/(2·Pr^{0.667}) | Pr ≠ 1, propiedad constante | Es la que corresponde a aire | (4.115) p.219 |
| **St turbulento** | St = 0.0292/(Re_x^{0.2}·Pr^{0.667}) | Turbulento, placa plana (hereda el rango de cf 5×10⁵–1×10⁷) | — | (4.116) p.219 |
| **Nu turbulento** | Nu_x = 0.0292·Re_x^{0.8}·Pr^{0.333} | Idem | — | (4.117) p.220 |
| Relación Nu–St–Pr–Re | Nu_x = St·Pr·Re_x | Identidad | — | p.220 |
| Escalado de malla DNS | grid ∝ Re^{9/4} (DNS 3D) | — | Por eso DNS de avión completo no es viable | p.198 |

---

### 2.ter — El método de PANELES, paso a paso implementable (cap. 3)


Fuente: **§3.16 "Source Density Distribution on the Body Surface", pp. 144–148**, ecs. (3.62)–(3.70), verificado contra el **EXAMPLE 3.8**. Referencia canónica citada: **Hess & Smith (1966)**, *Calculations of potential flow about arbitrary bodies*, Progr. Aeronaut. Sci. 8:1–138. El tratamiento limitante de la singularidad j = i se atribuye a **Kellogg (1953)**.

```
════════════════════════════════════════════════════════════════════════════════════
PASO 0 — CONVENCIONES (§3.16 p. 144, LITERAL)
════════════════════════════════════════════════════════════════════════════════════
  "The coordinate system used in this section (i.e., x in the chordwise direction and y in the spanwise
   direction) will be used in subsequent chapters on wing and airfoil aerodynamics."
  ⇒ El plano del problema 2D es (x, z). x = cuerda, z = normal, y = envergadura.
  ⇒ "Since the flow is two dimensional, all calculations are for a unit length along the y axis, or span."
  α = ángulo de ataque de la corriente libre.
  δ_i = "the slope of the ith panel relative to the x axis" (Fig 3.27 marca δ_i NEGATIVO para un panel de la
        superficie superior aguas abajo del máximo espesor).
  n̂_i = normal EXTERIOR en el punto de control del panel i.

════════════════════════════════════════════════════════════════════════════════════
PASO 1 — DISCRETIZAR LA GEOMETRÍA
════════════════════════════════════════════════════════════════════════════════════
  "The configuration is represented by a finite number (M) of linear segments, or panels."
  Cada panel j lleva una distribución de FUENTE cuya intensidad κ_j "is uniform over the surface of the panel".
  κ_j se define LITERALMENTE como "the volume of fluid discharged per unit area of the panel".
  Puntos de control: "The control points are chosen to be the midpoints of the panels" (Fig 3.27).
  ⇒ M paneles ⇒ M incógnitas κ_j ⇒ M puntos de control ⇒ M ecuaciones. Sistema CUADRADO.

════════════════════════════════════════════════════════════════════════════════════
PASO 2 — POTENCIAL INDUCIDO (ecs. 3.62-3.65)
════════════════════════════════════════════════════════════════════════════════════
  (3.62)  φ(x,z) = ∫ (κ_j ds_j / 2π) ln r
  (3.63)  r = sqrt( (x − x_j)² + (z − z_j)² )
  (3.64)  φ(x_i, z_i) = U∞ x_i cosα + U∞ z_i sinα + Σ_{j=1..M} (κ_j/2π) ∫ ln r_ij ds_j
  (3.65)  r_ij = sqrt( (x_i − x_j)² + (z_i − z_j)² )
  Nota literal: "the source strength κ_j has been taken out of the integral, since it is constant over the jth
  panel. Each term in the summation represents the contribution of the jth panel (integrated over the length of
  the panel) to the potential at the control point of the ith panel."

════════════════════════════════════════════════════════════════════════════════════
PASO 3 — CONDICIÓN DE FRONTERA (ec. 3.66)
════════════════════════════════════════════════════════════════════════════════════
  (3.66)  ∂φ(x_i, z_i)/∂n_i = 0   en CADA punto de control
  Enunciado físico literal: "we require that the sum of the source-induced velocities and the free-stream
  velocity is zero in the direction normal to the surface of the panel at the surface of each of the M panels."
  ⚠ "Care is required in evaluating the spatial derivatives of equation (3.64), because the derivatives become
     singular when the contribution of the ith panel is evaluated" (r_ii = 0).

════════════════════════════════════════════════════════════════════════════════════
PASO 4 — LA ECUACIÓN DE ENSAMBLE (ec. 3.67)  ← EL CORAZÓN
════════════════════════════════════════════════════════════════════════════════════
  (3.67)   κ_i/2  +  Σ_{j=1, j≠i}^{M} (κ_j/2π) ∫ ∂(ln r_ij)/∂n_i  ds_j  =  −U∞ sin(α − δ_i)

  Interpretación literal de los dos términos de la izquierda (p. 146):
    · κ_i/2 = "the contribution of the source density of the ith panel to the outward normal velocity at the
      point (x_i, z_i), that is, the control point of the ith panel."   ← el TÉRMINO DE AUTOINDUCCIÓN, resultado
      del proceso límite de Kellogg (1953). NO se integra: vale exactamente κ_i/2.
    · el sumatorio = "the contribution of the remainder of the boundary surface to the outward normal velocity at
      the control point of the ith panel."
  El lado derecho es la componente normal de la corriente libre, con signo cambiado.

  FORMA MATRICIAL ÚTIL (multiplicando (3.67) por 2π — es la forma exacta que usa el libro en la ec. 3.69):

        π·κ_i  +  Σ_{j≠i} I_ij · κ_j  =  −2π U∞ sin(α − δ_i)          para i = 1..M

  con        I_ij = ∫_{panel j} ∂(ln r_ij)/∂n_i  ds_j
  y          A_ii = π   (diagonal),   A_ij = I_ij  (fuera de la diagonal),   b_i = −2π U∞ sin(α − δ_i)
  ⇒          A · κ = b        (matriz DENSA M×M, no simétrica, bien condicionada para paneles razonables)

════════════════════════════════════════════════════════════════════════════════════
PASO 5 — EL COEFICIENTE DE INFLUENCIA I_ij (ec. 3.68, del Ejemplo 3.8)
════════════════════════════════════════════════════════════════════════════════════
  (3.68)   ∂(ln r_ij)/∂n_i = (1/r_ij)(∂r_ij/∂n_i)
                           = [ (x_i − x_j)·(∂x_i/∂n_i) + (z_i − z_j)·(∂z_i/∂n_i) ] / [ (x_i − x_j)² + (z_i − z_j)² ]

  donde (∂x_i/∂n_i, ∂z_i/∂n_i) = (n_x, n_z) son las componentes del vector normal UNITARIO EXTERIOR del panel i.
  (En el Ejemplo 3.8, para el panel 3 horizontal en la parte superior: ∂x₃/∂n₃ = 0.00, ∂z₃/∂n₃ = 1.00.)

  Parametrización LITERAL del panel j (Ejemplo 3.8, panel 2):
      x_j(s) = x_j0 + s·cos δ_j          [libro: x₂ = −0.92388 + 0.70711 s₂]
      z_j(s) = z_j0 + s·sin δ_j          [libro: z₂ = +0.38268 + 0.70711 s₂]
      s ∈ [0, ℓ_j]                       [libro: ℓ₂ = 0.76537]

  El integrando queda en la forma cerrada:
      I_ij = ∫₀^{ℓ_j} (C₀ − C₁ s) ds / (a + b s + c s²)
  que el libro resuelve con TABLAS DE INTEGRALES, y que se descompone en:
      ∫ ds/(s² + Bs + C)      →   (2/sqrt(4C−B²)) · arctan( (2s + B)/sqrt(4C−B²) )
      ∫ s ds/(s² + Bs + C)    →   ½ ln(s² + Bs + C) − (B/2)·∫ ds/(s² + Bs + C)
  (El libro exhibe exactamente esas dos primitivas: ½ln(s₂² − 2.07195 s₂ + 1.14645) y
   arctan((2s₂ − 2.07195)/sqrt(0.29291)).)

  ►►► IMPLEMENTACIÓN RECOMENDADA EN LA FORJA: cuadratura de Gauss-Legendre de 8-16 puntos sobre s ∈ [0, ℓ_j].
      Reproduce I₃₂ = 0.3528 y las ocho κ_j del Ejemplo 3.8 con error < 1e-6 (verificado). La forma cerrada es
      preferible por velocidad si M > ~500.

════════════════════════════════════════════════════════════════════════════════════
PASO 6 — RESOLVER
════════════════════════════════════════════════════════════════════════════════════
  "Evaluating the terms of equation (3.67) for a particular ith control point yields a linear equation in terms
   of the unknown source strengths κ_j (for j = 1 to M, including j = i). Evaluating the equation for all values
   of i (i.e., for each of the M control points) yields a set of M simultaneous equations which can be solved for
   the source strengths."
  ⇒ LU con pivoteo parcial. O(M³).
  Ejemplo de una fila, LITERAL (ec. 3.69, i = 3, α = 0, δ₃ = 0):
      I₃₁κ₁ + I₃₂κ₂ + π κ₃ + I₃₄κ₄ + I₃₅κ₅ + I₃₆κ₆ + I₃₇κ₇ + I₃₈κ₈ = 0.00
      "The right-hand side is zero since α = 0 and δ₃ = 0."

════════════════════════════════════════════════════════════════════════════════════
PASO 7 — VERIFICAR (ec. 3.70) ← ASSERT OBLIGATORIO
════════════════════════════════════════════════════════════════════════════════════
  (3.70)  Σ κ_i = 0
  Literal: "as must be true since the sum of the strengths of the sources and sinks (negative sources) must be
  zero if we are to have a closed configuration."
  ⇒ En La Forja: si |Σ κ_i·ℓ_i| / (U∞ · perímetro) > 1e-6, el panelado o la geometría están ROTOS (cuerpo
    abierto, normales invertidas, paneles degenerados). Es la primera alarma del estudio.
  Segundo invariante gratis: por simetría geométrica + α = 0, las κ deben ser antisimétricas respecto al plano
  transversal (verificado en el Ejemplo 3.8: κ₁ = −κ₅, κ₂ = −κ₄ = κ₈ = −κ₆, κ₃ = κ₇ = 0).

════════════════════════════════════════════════════════════════════════════════════
PASO 8 — POSTPROCESO
════════════════════════════════════════════════════════════════════════════════════
  "Once the panel source strengths have been determined, the velocity can be determined at any point in the flow
   field using equations (3.64) and (3.65). With the velocity known, Bernoulli's equation can be used to
   calculate the pressure field."
  ⇒ V(x,z) = ∇φ con (3.64); luego Cp = 1 − |V|²/U∞²  [ec. 3.13].
  ⇒ Fuerzas: integrar Cp con (3.48)/(3.52) contra las normales de panel.

════════════════════════════════════════════════════════════════════════════════════
PASO 9 — SUSTENTACIÓN (LO QUE EL CAPÍTULO 3 *NO* HACE)  ⚠
════════════════════════════════════════════════════════════════════════════════════
  Texto LITERAL, última frase de §3.16 (p. 146):
    "Lift can be introduced by including vortex or doublet distributions and by introducing the Kutta condition,
     as we will discuss in Chapters 6 and 7."
  ⇒ EN EL CAPÍTULO 3 NO HAY MÉTODO DE PANELES DE VÓRTICE, NI CONDICIÓN DE KUTTA NUMÉRICA. Un panelado de puras
    fuentes SIEMPRE da l = 0 (es d'Alembert otra vez, ahora discreto). Cualquier requisito de "vortex panel" o
    "Kutta condition" para La Forja debe extraerse de los caps. 6/7, NO de aquí. NO INVENTARLO.
  ⇒ Lo ÚNICO que el cap. 3 da sobre Kutta-Joukowski es el teorema ANALÍTICO l = ρ∞U∞Γ (3.58) y su alcance
    ("closed cylinders of arbitrary cross section", p. 141) — suficiente para cerrar el lazo Γ→L una vez que otro
    capítulo determine Γ.
```

---


---

## 3. FIXTURES DE TEST

Todos los ejemplos numéricos resueltos de los capítulos 1 a 5, en el formato de la regla 3 del
contrato. **Este es el entregable más valioso del bloque:** son los tests de regresión del motor
aerodinámico de La Forja. Cada uno trae sus supuestos y su tolerancia; los que dependen de una
figura ilegible están marcados como tales y NO son tests duros.

### Cap. 1 — Why Study Aerodynamics? (pp. 1–32)


```
FIXTURE bertin-ej-1.1 [§1.1, p.3-4]  "The total energy"
entradas: B-52: W=450,000 lbf, V=250 kt (=422.5 ft/s), h=20,000 ft
          F-5:  W= 12,000 lbf, V=250 kt (=422.5 ft/s), h=20,000 ft
          g=32.174 ft/s²; conversión del libro: 1 kt = 1.69 ft/s
salida esperada: m_B52 = 13,986 slug ; E_B52 = 1.0248e10 ft·lbf
                 m_F5  =    373 slug ; E_F5  = 2.7329e8  ft·lbf
                 razón E_B52/E_F5 = 37.5
tolerancia: 0.1% (el libro da 5 cifras)
notas: fixture de la ecuación 1.1 y 1.2. Ojo: 1 kt = 1.69 ft/s es el valor QUE USA EL LIBRO
       (el exacto es 1.68781). Reproducir el número del libro exige usar 1.69.
```
```
FIXTURE bertin-ej-1.2 [§1.1, p.4-5]  "The energy height"
entradas: V=422.5 ft/s, h=20,000 ft, g=32.174 ft/s²
salida esperada: He = 22,774 ft (idéntica para el B-52 y para el F-5)
tolerancia: 1 ft
notas: ec. 1.3. Test de invariancia: He NO debe depender del peso.
```
```
FIXTURE bertin-ej-1.3 [§1.1.1, p.6-7]  "Specific excess power and acceleration"
entradas: F-5, W=12,000 lbf, V=422.5 ft/s, h=20,000 ft, T=3,550 lbf (con postcombustión),
          D=1,750 lbf
salida esperada: Ps = 63.38 ft/s ; dV/dt = 4.83 ft/s² ; régimen de ascenso máximo a V constante
                 = 63.38 ft/s = 3,802.8 ft/min
tolerancia: 0.5%
notas: ecs. 1.5 y 1.7. El mismo Ps da DOS respuestas distintas (aceleración o ascenso) según qué
       término de la ec. 1.7 se ponga a cero: es el corazón de la técnica E-M.
```
```
FIXTURE bertin-ej-1.4 [§1.2.3, p.13]  "Density in SI units"
entradas: p = 1.01325e5 N/m², T = 288.15 K, R = 287.05 N·m/kg·K
salida esperada: ρ = 1.2250 kg/m³
tolerancia: 0.05%
notas: ec. 1.10. Es el punto de nivel del mar de la Tabla 1.2A.
```
```
FIXTURE bertin-ej-1.5 [§1.2.3, p.13]  "Density in English units"
entradas: p = 2116.22 lbf/ft², T = 518.67 °R
salida esperada: ρ = 0.07649 lbm/ft³  (con R = 53.34 ft·lbf/lbm·°R)
                 ρ = 0.002377 lbf·s²/ft⁴ = 0.002377 slug/ft³  (con R = 1716.16 ft²/s²·°R)
tolerancia: 0.1%
notas: prueba del manejo de unidades. 1 slug = 32.174 lbm. Las DOS salidas deben salir del mismo
       estado termodinámico.
```
```
FIXTURE bertin-ej-1.6 [§1.2.3, p.14]  "Viscosity in SI units"
entradas: T = 288.15 K; C1 = 1.458e-6, C2 = 110.4
salida esperada: μ = 1.7894e-5 kg/s·m
tolerancia: 0.05%
notas: ec. 1.12. Coincide con la Tabla 1.2A a 0 km.
```
```
FIXTURE bertin-ej-1.7 [§1.2.3, p.14-15]  "Viscosity in English units"
entradas: T = 59.0 °F  (convertir: 59.0 + 459.67 = 518.67 °R); C1 = 2.27e-8, C2 = 198.6
salida esperada: μ = 3.7383e-7 lbf·s/ft²
tolerancia: 0.05%
notas: incluye la conversión °F -> °R. Coincide con la Tabla 1.2B a 0 kft.
```
```
FIXTURE bertin-ej-1.8 [§1.2.3, p.16-17]  "Kinematic viscosity in English units"
entradas: μ = 3.7383e-7 lbf·s/ft², ρ = 0.002377 lbf·s²/ft⁴ (equivalentemente 0.07649 lbm/ft³
          con gc = 32.174 ft·lbm/lbf·s²)
salida esperada: ν = 1.573e-4 ft²/s
tolerancia: 0.1%
notas: ec. 1.13. La segunda vía (con lbm y gc) debe dar EXACTAMENTE lo mismo: es el test de que
       el motor no perdió el factor gc.
```
```
FIXTURE bertin-ej-1.9 [§1.2.5, p.24]  "Standard atmosphere at 10 km"
entradas: z = 10,000 m; T0 = 288.15 K; B = 0.0065 K/m; p0 = 1.01325e5 N/m²; exponente g/RB = 5.26
salida esperada: T = 223.15 K   (la tabla da 223.252 K -> desviación del modelo analítico: 0.05%)
                 p = 2.641e4 N/m²  (la tabla da 2.650e4 N/m² -> desviación: 0.34%)
                 factor (1 - Bz/T0)^5.26 = 0.26063
tolerancia: 0.1% contra el valor CALCULADO; documentar la desviación contra la TABLA como
            diferencia de modelo, no como bug
notas: fixture de doble propósito: verifica ecs. 1.21/1.22 Y cuantifica cuánto se aparta el
       modelo analítico de la tabla oficial. El alumno debe VER esa diferencia.
```
```
FIXTURE bertin-ej-1.10 [§1.2.5, p.24-26]  "Standard atmosphere, English units, 0 a 65,000 ft"
entradas: 0 a 36,100 ft: T = 518.67 - 0.003565·z  (T0=518.67 °R, B=0.003565 °R/ft)
          36,100 a 65,000 ft: T = 389.97 °R constante
          p0 = 2116.22 lbf/ft²; R = 53.34 ft·lbf/lbm·°R; gc = 32.174 ft·lbm/lbf·s²
salida esperada: región gradiente: p = 2116.22·(1.0 - 6.873e-6·z)^5.26
                                   ρ/ρ0 = (1.0 - 6.873e-6·z)^4.26
                 en z = 36,100 ft:  p = 472.19 lbf/ft²
                 región isotérmica: g/RT = 4.8075e-5 /ft
                                    p/p0 = 0.2231·exp(1.7355 - 4.8075e-5·z)
                                    ρ/ρ0 = 0.2967·exp(1.7355 - 4.8075e-5·z)   (T = 0.7519·T0)
tolerancia: 0.5%
notas: **DISCREPANCIA INTERNA DEL LIBRO (no es error nuestro):** en la p.25 escribe
       "p36,100 = ... = 472.19 lbf/ft²" y dos renglones después "p = 472.9 exp[...]".
       472.19 es el valor consistente con la fórmula. Registrar 472.19 y marcar la errata.
```

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


```
FIXTURE bertin-ej-2.1 [§2.2, p.38]  "A basic flow where mass is conserved"
entradas:   campo 2D, estacionario, incompresible:  u = 2x   [unidades consistentes],  v = -2y
salida esperada:  ∂u/∂x = 2 ;  ∂v/∂y = -2 ;  ∂u/∂x + ∂v/∂y = 2 - 2 = 0  ⇒ VERDADERO (masa conservada)
tolerancia: exacto (simbólico); residual numérico |∇·V| < 1e-12
notas:      usa eq. (2.3) reducida a 2D. El libro anuncia que retoma este campo en el Cap. 3.
            Fixture de tipo booleano: sirve como test unitario del validador de continuidad del CAD.
```

```
FIXTURE bertin-ej-2.2 [§2.2, pp. 38-39]  "Incompressible boundary layer"
entradas:   flujo estacionario, incompresible, uniforme U∞ que llega a placa plana;
            perfil dentro de la capa límite  u = U∞ (y/δ)^(1/7),  con δ = δ(x);
            línea horizontal a distancia ε de la placa, con ε = δ en la estación aguas abajo.
salida esperada:  ∂v/∂y = -∂u/∂x = (U∞ y^(1/7) / 7 δ^(8/7)) dδ/dx
                  v = (U∞ / 8) (y^(8/7) / δ^(8/7)) dδ/dx + C ,  con C = 0 porque v=0 en y=0 (pared impermeable)
                  en y = ε:  v_e = (U∞/8) (ε/δ)^(8/7) dδ/dx
                  CONCLUSIÓN: v_e ≠ 0 ⇒ la línea horizontal NO es una línea de corriente
tolerancia: exacto (simbólico)
notas:      perfil de potencia 1/7 (turbulento) declarado por el libro, no derivado aquí (Cap. 4).
            Fig. 2.4 es imagen; el enunciado y el resultado están completos en el texto.
            Este fixture es el que evita el error #1 al montar volúmenes de control: creer que el borde
            de la capa límite es una línea de corriente.
```

```
FIXTURE bertin-ej-2.3 [§2.4.2, pp. 51-52]  "Couette flow analysis"
entradas:   aire de día estándar a nivel del mar; U = 2 m/s (placa superior), h = 0.1 m, P = 1
            (P = -(h²/2μU) dp/dx, gradiente de presión adimensional)
salida esperada (simbólico):
            perfil:      u/U = y/h + P (y/h)(1 - y/h)
            cortante:    τ = μ du/dy = μU/h + (2μU/h) P (1/2 - y/h)
            gasto:       Q/d = (Uh/2)(1 + P/3)
            velocidad media: V̄ = (Q/d)/h = (U/2)(1 + P/3)
            máximo:      y = (h/2)(1 + 1/P)
salida esperada (numérico, con U=2 m/s, h=0.1 m, P=1):
            Q/d  = 4/30 m²/s = 0.13333 m²/s
            V̄    = 4/3 m/s  = 1.3333 m/s  = (2/3)·U
            y_max = 0.1 m  (coincide con la placa superior y = h)
tolerancia: 0.1 % (los tres resultados son fracciones exactas: 4/30, 4/3, h)
notas:      "standard day sea-level air" solo fija μ y ρ; ninguno de los tres resultados pedidos
            depende de μ, así que el fixture es independiente de la tabla atmosférica.
            El libro invita a contrastar contra Fig. 2.10 ("look at Fig. 2.10 to see if these results
            make sense") — la figura no es legible en el txt, pero el número sí verifica.
            GOTCHA: con P=1 el máximo cae exactamente EN la pared móvil; para P<1 el máximo
            estaría fuera del canal (y>h) y el máximo real es el de la pared. El código debe
            saturar y_max a [0,h].
```

```
FIXTURE bertin-ej-2.4 [§2.4.3, pp. 53-55]  "Drag on a flat-plate airfoil"
entradas:   flujo estacionario, uniforme, de baja velocidad (V = U∞ î) sobre placa plana muy delgada
            de cuerda c; perfil medido en el borde de salida (arriba de la placa):
            u = U∞ (y/δ)^(1/7) ; abajo de la placa el perfil es imagen espejo.
            Presión uniforme p∞ sobre TODA la superficie de control; fuerzas de cuerpo despreciadas;
            densidad constante; δ = 0.01 c.
            Volumen de control: solo la mitad superior (simetría planar), de y=0 a y=δ, largo c.
salida esperada (intermedios, todos verificables por separado):
            eflujo de momento por la cara 3 (salida):  (7/9) ρ U∞² δ
            gasto que sale por la cara 2 (frontera superior):  Q2 = ∫₀^c v_e dx = (1/8) U∞ δ
            balance de momento:  -d/2 = -ρU∞²δ + ρU∞Q2 + (7/9)ρU∞²δ
            arrastre por unidad de envergadura:  d = (7/36) ρ U∞² δ
salida esperada (final):  Cd = d / (½ ρ∞ U∞² c) = 0.00389   [exacto: 7/1800 = 0.0038889]
tolerancia: 1 % (el libro redondea a 3 cifras significativas)
notas:      Exige aplicar PRIMERO continuidad integral (2.5) para obtener Q2, y luego momento (2.13).
            La cara 4 (pared sólida) no tiene flujo. En la cara 3 la componente v transporta masa
            pero no cruza el área î dy (el libro lo aclara explícitamente).
            Cd escala LINEALMENTE con δ/c: Cd = (7/18)(δ/c). Buen test paramétrico.
            Fig. 2.11 es imagen, pero la numeración de las 4 caras está descrita en el texto.
```

```
FIXTURE bertin-ej-2.5 [§2.5, p.60]  "Calculating the Mach number"
entradas:   V = 472 m/s a 14 km de altitud (día estándar);  segundo caso: misma V a 19 km
            dato de tabla: a(14 km) = 295.07 m/s  [Tabla 1.2A, Cap. 1 — fuera de mi rango]
salida esperada:  M = 472 / 295.07 = 1.5996 ≈ 1.6
                  a 19 km: MISMO M ≈ 1.6
tolerancia: 0.5 %
notas:      La razón del segundo resultado es física, no numérica: "the temperature is constant
            between approximately 11 km and 21 km since this portion of the atmosphere is an
            isothermal layer" (p.60). El módulo de atmósfera del CAD debe reproducir esa meseta
            de a(h) entre 11 y 21 km o este fixture falla.
```

```
FIXTURE bertin-ej-2.6 [§2.5, pp. 60-61]  "Calculating the Reynolds number"
entradas:   M∞ = 2.0 a 40,000 ft;  longitud característica L = 14 ft
            datos de Tabla 1.2 (Cap. 1, fuera de mi rango) citados literalmente en la solución:
              μ∞ = 0.79447 μSL = 2.9713e-7 lbf·s/ft²
              ρ∞ = 0.2471 ρSL  = 5.8711e-4 slug/ft³
              a∞ = 968.08 ft/s
            factores de conversión usados por el libro: 3600 s/h, 5280 ft/mi
salida esperada:  U∞ = M∞ a∞ = 1936.16 ft/s = 1320.11 mi/h
                  Re∞,L = ρ∞U∞L/μ∞ = 5.3560e7
tolerancia: 0.5 % (recálculo directo da 5.3562e7)
notas:      En el paso de Reynolds el libro escribe ρ∞ como 5.8711e-4 lbf·s²/ft⁴ (equivalente a
            slug/ft³, porque 1 slug = 1 lbf·s²/ft) — el motor de unidades del CAD debe aceptar
            ambas escrituras como la MISMA cantidad.
            Este fixture ata el módulo de atmósfera (razones 0.79447 y 0.2471 a 40,000 ft) con el
            de semejanza. Si el CAD usa otra tabla atmosférica, el fixture lo detecta.
```

```
FIXTURE bertin-ej-2.7 [§2.9.6, pp. 74-75]  "A flow where the energy equation is Bernoulli's equation"
entradas:   agua, flujo estacionario, no viscoso, unidimensional, en tubo curvo (Fig. 2.18)
            D1 = 5 cm (estación 1, arriba);  D2 = 2 cm (estación 2, descarga a la atmósfera)
            desnivel z1 - z2 = 30 cm = 0.3 m
            Q = 0.001π m³/s ;  ρ = 1000 kg/m³ ;  g = 9.8066 m/s²
            sin trabajo de eje, sin transferencia de calor, sin trabajo viscoso, sin cambio de ue
salida esperada:  V2 = Q/A2 = 0.001π / [π(0.02)²/4] = 10 m/s
                  V1 = (D2/D1)² V2 = 0.16 × 10 = 1.6 m/s
                  términos: V2²/2 = 50 m²/s² ; V1²/2 = 1.28 m²/s² ; g z1 = 2.94 m²/s²
                  p1 = patm + (50 - 1.28 - 2.94)(1000) = 4.58e4 N/m², GAGE (manométrica)
tolerancia: 1 % (exacto: 45,780 Pa gage; el libro redondea a 4.58e4)
notas:      Fixture doble: verifica (a) que la ecuación de energía integral (2.37) degenera en
            Bernoulli bajo las hipótesis listadas, y (b) el manejo de presión manométrica vs absoluta
            — el resultado es GAGE y el software NO debe reportarlo como absoluto.
            El libro usa g = 9.8066 m/s² (no 9.81): úsalo tal cual o el fixture se sale por ~0.01 %.
```

**Conteo: 7 EXAMPLE en el capítulo (2.1 a 2.7). No hay más.** Los "Problems" 2.1–2.40 (pp. 76–87) son ejercicios sin solución publicada: NO son fixtures, pero varios traen datos de aviones reales (ver ESCUELA y SORPRESAS).

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.1  [§3.2/§3.3, p. 93]  "Calculations made using Bernoulli's equation"
════════════════════════════════════════════════════════════════════════════════════
entradas:
  U_perfil = 75 m/s (velocidad del perfil respecto al aire, marco tierra)
  altitud  = 2 km, día estándar
  U₃_tierra = 25 m/s aguas abajo, en el marco fijo a tierra
  propiedades de Tabla 1.2 (cap. 1): p∞ = 79,501 N/m², ρ∞ = 1.0066 kg/m³
salida esperada:
  transformación galileana: superponer 75 m/s a la derecha ⇒ marco vehículo
  U∞ (punto 1) = 75 m/s ;  U₂ = 0 m/s (remanso) ;  U₃ = 100 m/s (= 75 + 25)
  p₁ = p∞      = 79,501 N/m²
  p₂ = p_t     = 79,501 + ½(1.0066)(75)²  = 82,332 N/m²
  p₃           = 82,332 − ½(1.0066)(100)² = 77,299 N/m²
tolerancia: 1 N/m² (0.002%) — el libro redondea a unidades. Recomputado: p_t = 82,332.06; p₃ = 77,299.06.
notas: usa Tabla 1.2 (atmósfera estándar del cap. 1) para p∞ y ρ∞ a 2 km. Depende de Fig 3.1 SOLO para el
  esquema; los tres valores de velocidad están en el texto. Punto (2) es remanso ⇒ p = p_t. Requiere el gate
  M < 0.3 (M ≈ 0.31 a 2 km con a≈332.5 m/s para U=100 m/s… el libro NO lo comenta; ver SORPRESAS).

════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.2  [§3.4, pp. 97-99]  "Flow in an open test-section wind tunnel"
════════════════════════════════════════════════════════════════════════════════════
entradas:
  barómetro del cuarto = 29.5 in Hg
  orificio 3 (remanso sobre el cilindro) = +2.0 in H₂O, MANOMÉTRICA (gage)
  Cp en el punto 4 = −1.2
  equivalencias declaradas: 760 mm Hg = 29.92 in Hg = 2116.22 lbf/ft²; 407.481 in H₂O/atm
    (con ρ_H₂O = 1.937 slug/ft³); ρ_SL = 0.002376 slug/ft³
  supuestos declarados: cambios de temperatura despreciables; Δp a través de la capa límite despreciable;
    chorro libre subsónico con líneas rectas ⇒ p_room = p∞ = p₂
salida esperada:
  p_room = 29.5 × (2116.22/29.92)                  = 2086.51 lbf/ft²
  p₁ (cámara de remanso) = p_t = p∞ + q∞           = 2086.51 + 10.387 = 2096.90 lbf/ft²   (ver notas)
  p₂ (plano de salida de la tobera)                = 2086.51 lbf/ft²
  ρ∞ = 0.002376 × (2086.51/2116.22)                = 0.00234 slug/ft³
  p₃ − p∞ = 2.0 × (2116.22/407.481)                = 10.387 lbf/ft², gage   ( = q∞ )
  U∞ = sqrt( 2(10.387)/0.00234 )                   = 94.22 ft/s
  p₄ = p∞ + Cp₄·q∞ = 2086.51 + (−1.2)(10.387)      = 2074.05 lbf/ft²
  U₄²/U∞² = 1 − Cp₄ = 2.2   ⇒   U₄ = 94.22·sqrt(2.2) = 139.75 ft/s
tolerancia: 0.5% (el libro redondea ρ∞ a 3 cifras: 0.00234 vs 0.002343 exacto ⇒ U∞ recomputado 94.16 ft/s con
  ρ sin redondear; usar la cadena redondeada del libro para reproducir 94.22).
notas: el valor de p₁ NO está impreso explícitamente en la solución del libro (la pregunta se plantea pero la
  solución impresa arranca en p_room); se deduce de que la cámara de remanso tiene velocidad "essentially zero"
  ⇒ p₁ = p_t = p∞ + q∞. MARCAR como derivado, no como cita.
  Depende de Fig 3.3 solo para el esquema (posición de los 4 orificios); los datos están en el texto.

════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.3  [§3.10, pp. 110-111]  "Equipotential lines and streamlines for a corner flow"
════════════════════════════════════════════════════════════════════════════════════
entradas:
  ψ = 2xy   (flujo en esquina de 90°, incompresible, irrotacional, 2D)
  puntos de evaluación: (x,y) = (1, 1) y (x,y) = (2, ½)  — ambos sobre la MISMA línea de corriente ψ = 2
salida esperada:
  (a) u = ∂ψ/∂y = 2x ;  v = −∂ψ/∂x = −2y
      en (1,1):   V = 2î − 2ĵ,   |V| = sqrt(8)  = 2.8284
      en (2,½):   V = 4î − 1ĵ,   |V| = sqrt(17) = 4.1231
  (b) ejes x = 0 y y = 0 son la "línea de corriente" ψ = 0 ⇒ pueden tomarse como paredes sólidas ⇒ el primer
      cuadrante es el flujo en una esquina de 90°. Patrones espejo en los otros cuadrantes.
      "the distance between the streamlines decreases as the magnitude of the velocity increases" (por Q = Δψ).
  (c) φ = x² − y² + C
  (d) equipotenciales ⟂ líneas de corriente en todo punto (Fig 3.8, con C = 0)
tolerancia: exacta (0%) — es analítica. Redondeo del libro: 4 decimales.
notas: mismo flujo del Ejemplo 2.1 (cap. 2). Consistente con Tabla 3.3 fila "90° corner flow": ψ = Axy con A = 2
  ⇒ φ = ½A(x²−y²) = x²−y². ⚠ El libro escribe "∫ u dy = ∫(−2y)dy" al integrar en y — debe ser v dy (typo, ver
  NO-OBSERVADO). Fig 3.8 rotula ψ = 1, 4, 8 y φ = 0, ±1, ±4.

════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.4  [§3.12.2, p. 116]  "Flow rate for a two-dimensional source"
════════════════════════════════════════════════════════════════════════════════════
entradas:
  fuente 2D de intensidad K en el origen; circunferencia de radio r arbitrario; densidad ρ
salida esperada:
  ṁ = ∮ ρ V·n̂ dA = ∫₀^{2π} ρ (K/(2πr)) r dθ = ρ K
  ⇒ caudal VOLUMÉTRICO por unidad de profundidad Q = K, INDEPENDIENTE DEL RADIO.
tolerancia: exacta (0%).
notas: ⚠ el OCR imprime el resultado como "= Kr" donde la 'r' es la letra griega ρ ⇒ ṁ = Kρ. Interpretación
  confirmada por dim[K] = L²/T (p. 115) y por la definición de κ_j en §3.16 ("volume of fluid discharged per
  unit area"). Este fixture es el TEST DE CONSERVACIÓN del elemento fuente en `potencial.ts`: integrar el flujo
  numéricamente sobre círculos de r = 0.5, 1, 5, 50 debe dar K en los cuatro casos.

════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.5  [§3.12.6, pp. 123-125]  "Flow field formed from uniform flow and a source"
                                                (SEMICUERPO DE RANKINE)
════════════════════════════════════════════════════════════════════════════════════
entradas:
  uniforme U∞ en +x  +  fuente de intensidad K en el origen
salida esperada:
  ψ = U∞ r sinθ + Kθ/(2π) = C
  vr = (1/r)∂ψ/∂θ = U∞ cosθ + K/(2πr)
  vθ = −∂ψ/∂r     = −U∞ sinθ
  punto de remanso: vθ = 0 ⇒ θ = 0 o π ; sustituyendo en vr = 0 ⇒
      (r, θ)_stag = ( K/(2πU∞) , π )   es decir   x_stag = −K/(2πU∞)
  la línea de corriente que pasa por el remanso puede tomarse como pared ⇒ SEMICUERPO DE RANKINE (cuerpo abierto)
tolerancia: exacta (0%) para las expresiones; el libro no da valores numéricos.
notas: razonamiento físico literal del libro: "to the left of the origin, the source has a velocity to its left
  of K/2πU_r [sic, K/2πr], and the uniform flow has a velocity to the right of U∞, and the two velocity
  components cancel each other at some point." El fluido que llega al remanso "must go up and down out of the
  stagnation point" por conservación de masa. El Problema 3.27 (p. 160) pide la tabla r/R, U/U∞ y Cp del
  semicuerpo en θ = 30°, 45°, 90°, 135°, 150°, 180° — banco de verificación EXTRA (respuestas NO dadas).

════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.6  [§3.12.6, pp. 124-126]  "Flow field formed from uniform flow, a source, and a sink"
                                                (ÓVALO DE RANKINE)
════════════════════════════════════════════════════════════════════════════════════
entradas:
  uniforme U∞ en +x  +  fuente de intensidad K en x = −a  +  sumidero de intensidad K en x = +a
salida esperada:
  ψ = U∞ r sinθ + Kθ₁/(2π) − Kθ₂/(2π) = U∞ r sinθ + (K/2π)(θ₁ − θ₂) = C
  con  θ₁ = tan⁻¹( y/(x + a) )   y   θ₂ = tan⁻¹( y/(x − a) )
  las líneas de remanso forman un ÓVALO DE RANKINE (cuerpo CERRADO).
  "The width and height of the oval is determined by the free-stream velocity and the strengths of the source
   and sink."
tolerancia: exacta (0%) para las expresiones; el libro no da valores numéricos.
notas: criterio de CIERRE, literal: "as long as the source and sink have equal but opposite strengths, an
  infinite number of body shapes can be found from this stream function. In addition, if more sources and sinks
  were placed along the x axis, non-oval shapes would be created, and as long as the total source strength was
  equal and opposite to the total sink strength, the body would close at the rear." ⇒ es el mismo invariante
  Σκ = 0 de la ec. (3.70) del método de paneles, en versión continua.

════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.7  [§3.14, pp. 137-139]  "Forces on a (semi-cylinder) quonset hut"   ← EL MEJOR FIXTURE 1-D
════════════════════════════════════════════════════════════════════════════════════
entradas:
  R = 5 m (semicilindro cerrado, sin fugas, sobre bloques de amarre)
  U∞ = 50 m/s
  día estándar a nivel del mar ⇒ ρ∞ = 1.225 kg/m³, p∞ = presión estándar SL
  supuestos declarados: efectos viscosos despreciados; el flujo sobre el techo es idéntico al del cilindro para
    0 ≤ θ ≤ π; se desprecia el espacio de aire bajo la choza; el aire bajo la choza está EN REPOSO y a presión
    de REMANSO p_t
salida esperada:
  U_θ = −2 U∞ sinθ                                                       [ec. 3.42]
  p_u = p∞ + ½ρ∞U∞² − 2ρ∞U∞² sin²θ                                        [ec. 3.43 reescrita]
  p_l = p_t = p∞ + ½ρ∞U∞²
  l = −∫₀^{π} p_u sinθ R dθ + p_t(2R)  =  (8/3) ρ∞ U∞² R
  Cl = l / (½ρ∞U∞²·(2R)) = 8/3 = 2.6667
  l = (8/3)(1.225 kg/m³)(50 m/s)²(5 m) = 40,833 N/m
  d = 0 por simetría ("which reflects the fact that we neglected the effects of viscosity")
tolerancia: 0.1% (recomputado exacto: 40,833.33 N/m; el libro imprime 40,833 N/m).
notas: la superficie inferior NO se integra con la ec. (3.45)/Fig 3.20 "since it is a 'flat plate' rather than a
  circular arc" — se trata como presión CONSTANTE p_t sobre ancho 2R. Cl es independiente de M y Re por ser
  incompresible+no viscoso. ⚠ El pie de la Fig 3.24 dice "quonset hut of Example 3.5" — es un ERROR del libro
  (es el Ejemplo 3.7). Problemas hermanos con la MISMA física y respuestas no dadas: 3.38 (U∞=175 km/h, R₀=6 m,
  puerta en θ₀), 3.41 (U∞=100 ft/s, R=15 ft), 3.39/3.40 (semicilindro con presión de base = p_corner),
  3.47/3.48 (hemisferio) — banco de verificación EXTRA.

════════════════════════════════════════════════════════════════════════════════════
FIXTURE bertin-ej-3.8  [§3.16, pp. 146-148]  "Application of the source density distribution"
                                              ← EL FIXTURE DE ORO DEL MÉTODO DE PANELES
════════════════════════════════════════════════════════════════════════════════════
entradas:
  cilindro de radio UNITARIO (R = 1), corriente uniforme U∞, α = 0
  M = 8 paneles rectos de igual longitud, "arranged such that panel 1 is perpendicular to the undisturbed stream"
  ⇒ vértices en θ = 202.5° − 45°k (k = 0..8), es decir en ±22.5°, ±67.5°, ±112.5°, ±157.5°
  geometría LITERAL dada por el libro para el par (i=3, j=2):
     punto de control del panel 3:  (x₃, z₃) = (0.00, 0.92388)
     normal del panel 3:            ∂x₃/∂n₃ = 0.00,  ∂z₃/∂n₃ = 1.00
     panel 2 parametrizado:         x₂ = −0.92388 + 0.70711 s₂ ,  z₂ = +0.38268 + 0.70711 s₂
     longitud del panel 2:          ℓ₂ = 0.76537
     vértices del panel 2:          (−0.92388, +0.38268) → (−0.38268, +0.92388)
salida esperada:
  (A) forma reducida del integrando (LITERAL):
      I₃₂ = 0.54120 ∫₀^{0.76537} ds₂/(1.14645 − 2.07195 s₂ + 1.00002 s₂²)
           − 0.70711 ∫₀^{0.76537} s₂ ds₂/(1.14645 − 2.07195 s₂ + 1.00002 s₂²)
  (B) I₃₂ = 0.3528                                             ← VERIFICADO NUMÉRICAMENTE: 0.3528 (cuadratura)
  (C) fila del sistema para i = 3 (ec. 3.69):
      I₃₁κ₁ + I₃₂κ₂ + π κ₃ + I₃₄κ₄ + I₃₅κ₅ + I₃₆κ₆ + I₃₇κ₇ + I₃₈κ₈ = 0.00
  (D) solución completa del sistema 8×8:
      κ₁ = 2πU∞ (+0.3765)
      κ₂ = 2πU∞ (+0.2662)
      κ₃ = 0.00
      κ₄ = 2πU∞ (−0.2662)
      κ₅ = 2πU∞ (−0.3765)
      κ₆ = 2πU∞ (−0.2662)
      κ₇ = 0.00
      κ₈ = 2πU∞ (+0.2662)
  (E) invariante: Σ κ_i = 0                                     [ec. 3.70]
tolerancia: 1e-4 en I₃₂ (el libro da 4 decimales); 1e-4 en los κ_j/(2πU∞) (4 decimales).
  VERIFICACIÓN INDEPENDIENTE HECHA EN ESTA EXTRACCIÓN: construyendo A_ii = π, A_ij = I_ij (cuadratura adaptativa),
  b_i = −2πU∞ sin(α − δ_i) con δ = (90°, 45°, 0°, −45°, −90°, −135°, 180°, 135°) y U∞ = 1, α = 0, se obtiene
  κ/(2πU∞) = [0.3765, 0.2662, 0.0000, −0.2662, −0.3765, −0.2662, 0.0000, 0.2662] y Σκ = 0 exactamente.
  ⇒ Los 8 valores del libro REPRODUCEN AL DÍGITO. Fixture apto como test de aceptación del solver de La Forja.
notas: κ₃ = κ₇ = 0 porque los paneles 3 y 7 (superior e inferior, horizontales) son TANGENTES a la corriente ⇒
  no necesitan aportar flujo normal. Patrón antisimétrico esperado por la simetría del problema. El libro evalúa
  I₃₂ con tablas de integrales; la primitiva impresa está parcialmente corrompida por OCR pero el RESULTADO
  numérico es correcto. Fig 3.28 (esquema de 8 paneles) y Fig 3.29 (detalle de la geometría) son imagen, pero
  TODAS las coordenadas necesarias están en el texto. El Problema 3.45 (p. 164) pide repetir para I₄₃ — banco de
  verificación EXTRA (respuesta no dada; nuestro solver da I₄₃ = I₃₂ = 0.3528 por simetría rotacional).
```

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


```
FIXTURE bertin-ej-4.1 [§4.3.1, pp.181-183]
titulo: Placa rectangular en túnel de viento — perfiles, δ*, cf y C_D laminares
entradas:
  cuerda c (dimensión en la corriente) = 0.2 m
  envergadura b (ancho)                = 1.8 m
  U∞ = u_e                             = 40 m/s
  ρ                                    = 1.2250 kg/m³
  μ                                    = 1.7894e-5 kg/(m·s)
  estaciones pedidas                   = x ∈ {0.0, 0.05, 0.10, 0.20} m
  hipótesis                            = flujo 2D (b/c = 9.0), capa límite laminar en TODA la longitud
salida esperada:
  Re_c = 5.477e5
  y(η) = sqrt(2νx/u_e)·η = 8.546e-4·sqrt(x)·η   [m]
  δ*(x) = 1.72x/sqrt(Re_x) = 1.0394e-3·sqrt(x)  [m]
  cf(x) = 0.664/sqrt(Re_x) = 4.013e-4/sqrt(x)   [-]
  D = 1.328·b·sqrt(c·ρ·μ·u_e³)                  [N, ambas caras]
  C_D = D/(q·c·b) = 2.656/sqrt(Re_c) = 3.589e-3
  ruta alterna: C_D = Cf_tot·(S_wet/S_ref) = (1.328/sqrt(Re_c))·(2cb/cb) = 2.656/sqrt(5.477e5) = 3.589e-3
  valores puntuales leídos en Fig. 4.6:
    x=0.05 m: δ = 6.7e-4 m,  δ* = 2.3e-4 m
    x=0.10 m: δ = 9.5e-4 m,  δ* = 3.3e-4 m
    x=0.20 m: δ = 13.5e-4 m, δ* = 4.6e-4 m
tolerancia: 1% en Re_c, δ*, cf, C_D. 3% en los δ y δ* leídos de la Fig. 4.6 (son valores redondeados a 2 cifras en la figura).
notas:
  - Justificación del libro para asumir laminar: "This Reynolds number is close enough to the transition criteria
    for a flat plate that we will assume that the boundary layer is laminar for its entire length."
  - Usa Tabla 4.3 para trazar los perfiles (η → f' → u/u_e).
  - El factor 2 en C_D (2.656 = 2×1.328) es porque hay fricción en las DOS caras.
  - Verificado numéricamente: 1.225·40·0.2/1.7894e-5 = 5.4785e5 ✓; 2.656/sqrt(5.477e5) = 3.5891e-3 ✓;
    sqrt(2·(1.7894e-5/1.225)·x/40) = 8.5460e-4·sqrt(x) ✓.
```

```
FIXTURE bertin-ej-4.2 [§4.3.1, pp.183-185]
titulo: Perfil LINEAL vs solución exacta — el precio de un perfil malo
entradas:
  perfil supuesto  u/u_e = y/δ,  con δ = 1.25e-2·sqrt(x)  [m]  (= el δ exacto, ec. 4.23)
  u_e = 2.337 m/s
  aire estándar a nivel del mar (Tabla 1.2): ρ = 1.2250 kg/m³, μ = 1.7894e-5 kg/(s·m)
salida esperada:
  Re_x = ρ u_e x/μ = 1.60e5·x
  ---------------------- aproximación lineal ----------------------
  δ*  = 0.625e-2·sqrt(x)          [m]        (= δ/2)
  v_e = 3.125e-3·u_e/sqrt(x)      [m/s]
  cf  = 1.00e-3/sqrt(x)           [-]
  δ por método integral con perfil lineal = 3.464x/sqrt(Re_x) = 0.866e-2·sqrt(x) [m]
  ---------------------- solución exacta --------------------------
  δ*  = 0.430e-2·sqrt(x)          [m]        (ec. 4.27)
  v_e = 2.10e-3·u_e/sqrt(x)       [m/s]      (ec. 4.25)
  cf  = 1.66e-3/sqrt(x)           [-]        (ec. 4.21)
tolerancia: 1%
notas:
  - Errores del perfil lineal: δ* +45%, v_e +49%, cf −40%. Conclusión del libro: "it clearly does not provide
    reasonable values for engineering parameters, such as δ* and cf."
  - Sutileza importante para el test: si en vez de imponer el δ exacto se calcula δ con el método integral y el
    perfil lineal, sale δ = 0.866e-2·sqrt(x) (31% menor), y ENTONCES δ* y cf quedan MÁS cerca de la solución
    exacta. Dos errores que se compensan.
  - Verificado numéricamente: 1.225·2.337/1.7894e-5 = 1.5999e5 ✓; 5.0/sqrt(1.6e5) = 1.25e-2 ✓;
    1.72/sqrt(1.6e5) = 4.300e-3 ✓; 0.84/sqrt(1.6e5) = 2.100e-3 ✓; 0.664/sqrt(1.6e5) = 1.660e-3 ✓;
    cf lineal = 2μ/(ρ u_e δ) = 2/(1.6e5·1.25e-2·sqrt(x)) = 1.00e-3/sqrt(x) ✓.
```

```
FIXTURE bertin-ej-4.3 [§4.3.1, pp.185-188]
titulo: Parámetro de gradiente de velocidad β para el NACA 65-006 desde su Cp
entradas:
  perfil NACA 65-006, α = 0°, incompresible
  distribución de presión = Tabla 4.4 (23 puntos, x/c de 0.000 a 1.000) — reproducida arriba LITERAL
salida esperada:
  u_e/U∞ = (1 − Cp)^0.5
  dx/ds  = 1/u_e
  β = − [ ∫₀^x̄ (1 − Cp)^0.5 dx̄ ] · (dCp/dx̄) / (1 − Cp)^1.5      con x̄ = x/c
  Comportamiento esperado de la curva β(x/c) (Fig. 4.9, rango del eje: +0.1 a −0.3):
    - β > 0 en la primera MITAD de la cuerda (gradiente favorable)
    - β cruza por cero cerca de x/c ≈ 0.45–0.50 (Cp mínimo = −0.166 en x/c = 0.450)
    - para x/c ≥ 0.6, β < −0.1988 (por debajo del criterio de separación laminar)
tolerancia: la forma cualitativa (signo de β y cruce por cero) debe reproducirse EXACTAMENTE; los valores
  numéricos de β no se pueden verificar contra la figura (es imagen) — usar tolerancia de 10% solo si más
  adelante se consigue la figura digitalizada.
notas:
  - EL SIGNO MENOS de la fórmula de β lo REPUSE por derivación (el OCR lo perdió). Derivación:
    β = (2s/u_e)(du_e/ds), s = ∫u_e dx, du_e/ds = (du_e/dx)/u_e, u_e = U∞(1−Cp)^0.5
    ⇒ du_e/dx = −0.5·U∞·(1−Cp)^{−0.5}·(dCp/dx)
    ⇒ β = 2·[U∞∫(1−Cp)^0.5 dx]·[−0.5·U∞(1−Cp)^{−0.5}(dCp/dx)] / [U∞²(1−Cp)]
        = −[∫(1−Cp)^0.5 dx̄]·(dCp/dx̄)/(1−Cp)^1.5
    Chequeo de signo: en la mitad delantera Cp decrece (dCp/dx̄<0) ⇒ β>0, que es lo que dice el texto
    ("a favorable pressure gradient acts over the first half of the airfoil (β > 0)"). ✓
  - CONCLUSIÓN DE INGENIERÍA DEL EJEMPLO (la parte que vale más que el número): si la capa fuera laminar en
    toda su longitud, el perfil separaría a α=0°. NO separa en el experimento porque a Re de vuelo la capa es
    turbulenta en buena parte del perfil. Texto literal: "if the boundary layer were laminar along its entire
    length, it would separate, even for this airfoil at zero degrees angle of attack … the experimental
    measurements of the pressure distribution indicate that the actual flow field corresponds closely to the
    inviscid flow field. Therefore, boundary-layer separation apparently does not occur at zero degrees angle
    of attack."
  - El libro también advierte que por las variaciones grandes de β conviene un criterio NO-similar:
    "Because of the large streamwise variations in β, the non-similar character of the boundary layer should be
    taken into account when establishing a separation criterion."
```

```
FIXTURE bertin-ej-4.4 [§4.7.1, pp.212-213]
titulo: Perfiles laminar y turbulento en el punto de transición
entradas:
  aire a presión atmosférica estándar a nivel del mar y 5 °C (278.15 K)
  p = 1.01325e5 N/m²
  R = 287.05 N·m/(kg·K)
  Sutherland: μ = 1.458e-6 · T^1.5/(T + 110.4)
  U∞ = 200 km/h
  criterio: Re_x,tr = 500,000
salida esperada:
  ρ    = 1.2691 kg/m³
  μ    = 1.7404e-5 kg/(s·m)
  U∞   = 55.556 m/s
  x_tr = 0.12344 m
  δ_lam  = 5.0x/sqrt(Re_x)      = 8.729e-4 m
  δ_turb = 0.3747x/(Re_x)^0.2   = 3.353e-3 m
  razón δ_turb/δ_lam = 3.8
  perfiles: Tabla 4.6 (12 filas, reproducida LITERAL arriba)
tolerancia: 1% en ρ, μ, U∞, x_tr, δ_lam, δ_turb. 1% en las velocidades de la Tabla 4.6.
notas:
  - El libro ADVIERTE que la comparación es artificial: "since we are at the transition location, it is not
    realistic to use the assumption that the boundary layer is turbulent all the way from the leading edge.
    (This assumption would be reasonable far downstream of the transition location so that x >> x_tr.)"
    El fixture verifica ARITMÉTICA, no física de transición.
  - El punto que hay que ver: u sube MUCHO más rápido con y cerca de la pared en la capa turbulenta ⇒ más
    esfuerzo en la pared A PESAR de ser mucho más gruesa.
  - Verificado numéricamente: ρ = 1.01325e5/(287.05·278.15) = 1.26907 ✓;
    μ = 1.458e-6·278.15^1.5/388.55 = 1.7404e-5 ✓; x_tr = 5e5·1.7404e-5/(1.2691·55.556) = 0.12343 ✓;
    δ_lam = 5·0.12344/sqrt(5e5) = 8.728e-4 ✓; (5e5)^0.2 = 13.797, δ_turb = 0.3747·0.12344/13.797 = 3.352e-3 ✓.
```

```
FIXTURE bertin-ej-4.5 [§4.8.1, p.217]
titulo: Conductividad térmica y número de Prandtl del aire a 15 °C
entradas:
  T = 15 °C = 288.15 K
  μ  = 1.7894e-5 kg/(s·m)      [del Ejemplo 1.3]
  c_p = 1004.7 J/(kg·K)
  k = 4.76e-6 · T^1.5/(T + 112)   [cal/(cm·s·K)]   ec. (4.107)
  conversión: 4.187 J/cal
salida esperada:
  k = 5.819e-5 cal/(cm·s·K)
  k = 2.436e-2 J/(m·s·K)
  Pr = μc_p/k = 0.738
tolerancia: 0.5%
notas:
  - GOTCHA DE UNIDADES: pasar de cal/(cm·s·K) a J/(m·s·K) requiere ×4.187 (J/cal) × 100 (cm/m) = ×418.7.
    El libro solo menciona "there are 4.187 J/cal"; si el software multiplica solo por 4.187 se equivoca
    por un factor de 100. Verificado: 5.819e-5 × 418.7 = 2.4364e-2 ✓.
  - Rango de validez de (4.107): "over the range of temperatures below those for which oxygen dissociates,
    which is approximately 2000 K at atmospheric pressure."
  - Cierre del libro: "the Prandtl number for air is essentially constant (approximately 0.7) over a wide
    range of flow conditions."
```

```
FIXTURE bertin-ej-4.6 [§4.8.2, pp.219-220]
titulo: St y Nu turbulentos por la analogía de Reynolds modificada (derivación, no numérico)
entradas:
  cf turbulento local = 0.0583/(Re_x)^0.2     ec. (4.80)
  analogía de Reynolds modificada: St = cf/(2·Pr^0.667)     ec. (4.115)
  identidad: Nu_x = St·Pr·Re_x
salida esperada:
  St   = 0.0292/[(Re_x)^0.2 · (Pr)^0.667]     ec. (4.116)
  Nu_x = 0.0292·(Re_x)^0.8·(Pr)^0.333         ec. (4.117)
tolerancia: exacto (0.0583/2 = 0.02915 ≈ 0.0292); el redondeo del libro justifica 0.2%
notas:
  - Es un fixture de ÁLGEBRA SIMBÓLICA: el test debe verificar que el módulo térmico deriva St y Nu turbulentos
    del cf turbulento, no que los tenga hardcodeados.
  - Chequeo de exponentes: Nu = St·Pr·Re_x = [0.0292/(Re^0.2·Pr^0.667)]·Pr·Re = 0.0292·Re^0.8·Pr^0.333 ✓.
```

```
FIXTURE bertin-ej-4.7 [§4.8.2, pp.220-221]
titulo: Tasa local de transferencia de calor de un radiador enrasado en el fuselaje
entradas:
  altitud     = 3 km  (Tabla 1.2):  p = 7.012e4 N/m²,  T∞ = 268.659 K,
                                    ρ = 0.9092 kg/m³, μ = 1.6938e-5 kg/(s·m)
  V∞ = u_e    = 468 km/h = 130 m/s
  x           = 3.0 m
  T_w         = 330 K
  c_p         = 1004.7 J/(kg·K)
  k(T) de la ec. (4.107); Re_x,tr supuesto = 500,000
  hipótesis   = relaciones de placa plana; capa TURBULENTA en toda la longitud
salida esperada:
  Re_x = 2.093e7
  x_tr = 0.072 m        ("an extremely short distance")
  k    = 5.506e-5 cal/(cm·s·K) = 2.306e-2 J/(m·s·K) = 2.306e-2 W/(m·K)
  Pr   = 0.738
  q̇   = 0.0292·(Re_x)^0.8·(Pr)^0.333·k·(T_e − T_w)/x
      = −8.944e3 W/m² = −8.944 kW/m²
      = −1.114 hp/ft²   (usando 1.341 hp/kW y 10.764 ft²/m²)
tolerancia: 1% en Re_x, k, Pr, q̇. 2% en x_tr (el libro redondea 0.0717 → 0.072).
notas:
  - El SIGNO importa: negativo = calor SALE de la superficie hacia el aire, que es lo que debe hacer un
    radiador. El software debe reportar el signo, no el valor absoluto.
  - Verificado numéricamente: Re_x = 0.9092·130·3/1.6938e-5 = 2.0934e7 ✓;
    x_tr = 5e5·1.6938e-5/(0.9092·130) = 0.07166 ✓;
    k(268.659) = 4.76e-6·268.659^1.5/380.659 = 5.507e-5 cal/(cm·s·K) → ×418.7 = 2.306e-2 W/(m·K) ✓;
    (2.093e7)^0.8 = 7.19e5; 0.738^0.333 = 0.9038;
    q̇ = 0.0292·7.19e5·0.9038·2.306e-2·(268.659−330)/3.0 = −8.95e3 W/m² ✓;
    8.944 kW/m² × 1.341 hp/kW ÷ 10.764 ft²/m² = 1.114 hp/ft² ✓.
  - Contexto de aviación real: "The radiator systems on many of the early racing aircraft were flush mounted
    on the external surface of the airplane."
```

#### Fixtures secundarios (Problems, enunciado sin respuesta publicada)
Sirven como casos de regresión una vez que el módulo esté validado con los 7 EXAMPLE. Datos de entrada literales:

| Problema | p. | Entradas | Qué pide |
|---|---|---|---|
| 4.1 | 221 | Placa "muy delgada", nivel del mar estándar, V=15 m/s, c=0.5 m, b=5 m, laminar | Re_L, δ, δ*, τ_w y cf en x=0.5 m, drag total (2 caras), gráfica u(y) |
| 4.2 | 221-222 | u_e = Ax (remanso en x=0) | Expresión de β; f''(0) de Fig. 4.4; relación de τ con la de placa plana |
| 4.3 | 222 | Cilindro: u_e = 2U∞ sin θ, x = Rθ | β en θ = 30°, 45°, 90° |
| 4.4 | 222 | Pared porosa, v(x,0)=v_w≠0 | Demostrar v_w/u_e = −f(0)/(2√(2Re_x))·… (similitud) |
| 4.5 | 222 | Succión v_w = −0.001·u_e, u_e=10 m/s, nivel del mar | f(0) y las otras dos condiciones de frontera |
| 4.6 | 222 | Transpiración, f(0) = −0.25, u_e = 50 ft/s, atmósfera estándar | v_w |
| 4.7 | 222 | Volumen de control RECTANGULAR (Fig. P4.7) | Comparar con el resultado del volumen de control con línea de corriente |
| 4.8 | 222-223 | Perfil cúbico u/u_e = 1.5(y/δ) − 0.5(y/δ)³ | (δ/x)√Re_x, (δ*/x)√Re_x, (v_e/u_e)√Re_x, cf√Re_x, C_d√Re_x — comparar contra 5.0/1.72/0.84/0.664/1.328 |
| 4.9 | 223 | Perfil lineal | (δ/x)√Re_x, (δ*/x)√Re_x, cf√Re_x |
| 4.10 | 223 | Ala = placa plana, nivel del mar, 170 mph, c=4 ft, b=28 ft | Drag total de fricción y C_D |
| 4.11 | 223 | p=1.01325e5 N/m², U=100 m/s, μ=1.7894e-5, ρ=1.2250, x=1.0 m, Re_x,tr=500,000 | x_tr, δ_turb por (4.79), p_t(y) de sonda Pitot, Cp(y), ¿rotacional? |
| 4.12 | 224 | Aire atmosférico a 100 °C, 100 km/h | Comparar perfil laminar (Tabla 4.3) vs 1/7 en la transición |
| 4.13 | 224 | Estela: u(z) = U∞ − (U∞/2)cos(πz/2w), w = 0.009c | C_d de sección |
| 4.14 | 224 | Datos del 4.1 | Cf_tot y drag por (4.86) y por (4.87); comentar la diferencia |
| 4.15 | 224 | Datos del 4.11 con U = 80 m/s | Drag por Prandtl-Schlichting full-turbulento vs (4.87); ¿qué tan buena fue la hipótesis? |
| 4.16 | 224 | — | DERIVAR la ec. (4.86) |
| 4.17 | 224 | T = 2000 K | k y Pr del aire perfecto a esa T (ojo: está EN el límite de validez de 4.107) |
| 4.18 | 224 | Pared adiabática (θ'=0 en η=0) | Distribución de temperatura |
| 4.19 | 225 | Ala = placa plana, nivel del mar, 170 mi/h, c=4 ft, b=28 ft, T_w = 50 °F | Calor total transferido al ala |
| 4.20 | 225 | Túnel: sección de prueba 1 m², 6 m de largo, nivel del mar, 70 m/s | Ángulo de divergencia de paredes para compensar δ* entre x=1.5 m y x=6 m |

El **problema 4.20** es especialmente valioso para La Forja: es el uso directo de δ* como corrección geométrica.

---

### Cap. 5 — Characteristic Parameters for Airfoil and Wing Aerodynamics (pp. 226–293)


```
FIXTURE bertin-ej-5.1 [§5.3, p.242]  "Aspect ratio of a delta wing"
entradas: ala delta pura definida por su flecha de borde de ataque Λ_LE
salida esperada: S = b²/(4·tan Λ_LE) ;  AR = b²/S = 4/tan Λ_LE   [ec. 5.1]
tolerancia: exacto (identidad algebraica)
notas: derivación, no números. Test simbólico: con Λ_LE=60° -> AR = 4/1.7321 = 2.309.
       Encaja con el Problema 5.1 (F-106: S=58.65 m², Λ_LE=60°).
```
```
FIXTURE bertin-ej-5.2 [§5.3, p.243-244]  "Wing-geometry parameters, Space Shuttle Orbiter"
entradas: ala trapezoidal de referencia (la forma real se REEMPLAZA por un trapecio):
          cr = 57.44 ft, ct = 11.48 ft, b = 78.056 ft
salida esperada: (a) S   = ((ct+cr)/2)·(b/2)·2 = 2690 ft²
                 (b) AR  = b²/S = 78.056²/2690 = 2.265
                 (c) λ   = ct/cr = 11.48/57.44 = 0.20
                 (d) mac = 39.57 ft
                     c(y) = 57.44 - 1.1776·y   (y en ft desde el plano de simetría, semienvergadura
                                                39.028 ft)
                     mac = (2/S)·∫₀^{39.028} (57.44 - 1.1776y)² dy
tolerancia: 0.5%
notas: FIXTURE MAESTRO DE GEOMETRÍA. Debe pasar por DOS caminos independientes:
       (1) integración numérica de c(y) sobre la geometría OCCT real, y
       (2) la fórmula cerrada de ala trapezoidal ec. 5.35, que da
           (2/3)·(57.44 + 11.48 - 57.44·11.48/68.92) = 39.568 ft.
       Si los dos caminos no coinciden a 0.1%, el medidor de mac del kernel está mal.
       Nota didáctica del libro: "the complex shape of the actual wing is replaced by a swept,
       trapezoidal wing" — el ala de REFERENCIA es una idealización declarada, con "wing glove"
       fuera de ella.
```
```
FIXTURE bertin-ej-5.3 [§5.4.1, p.249-250]  "Lift per unit span, NACA 23012"
entradas: perfil NACA 23012; c = 1.3 m; altitud de densidad 3 km -> ρ = 0.9093 kg/m³;
          U∞ = 360 km/h = 100 m/s; α = 4°
          coeficientes del perfil: Clα = 0.1041 /deg, α0l = -1.2°
salida esperada: Cl = 0.1041·(4.0 - (-1.2)) = 0.541
                 q∞ = ½·0.9093·100² = 4546.5 N/m²
                 l  = Cl·q∞·c = 0.541·4546.5·1.3 = 3197.6 N/m
tolerancia: 0.5%
notas: **DISCREPANCIA INTERNA DEL LIBRO:** en p.246 declara Clα = 0.104 /deg y aquí usa
       0.1041 /deg. Con 0.104 sale Cl = 0.5408 y l = 3195.5 N/m. Fijar 0.1041 en el fixture y
       documentar. El libro además valida contra el dato experimental: "At an angle of attack of
       4°, the experimental values of the section lift coefficient for an NACA 23012 airfoil
       section range from 0.50 to 0.57" — o sea la BANDA experimental, no un punto.
       Supuestos declarados: sustentación lineal con α e independiente de Reynolds a estas
       condiciones. GOTCHA didáctico: "The fact that we are given the density altitude as 3 km
       does not provide specific information either about the temperature or pressure."
```
```
FIXTURE bertin-ej-5.4 [§5.4.3, p.254-255]  "Local skin friction on a flat plate"
entradas: placa plana, x = 0.5 m del borde de ataque, U∞ = 60 m/s, altitud 6 km
          -> ρ = 0.6601 kg/m³, μ = 1.5949e-5 kg/s·m  (Tabla 1.2A)
salida esperada: Rex = 1.242e6
                 laminar:   cf = 0.664/Rex^0.5 = 5.959e-4 ; τ = cf·½ρU² = 0.708 N/m²
                 turbulento: cf = 0.0583/Rex^0.2 = 3.522e-3 ; τ = 4.185 N/m²
                 razón τ_turb/τ_lam ≈ 5.9 ("nearly six times larger")
tolerancia: 0.5%
notas: ecs. 5.24, 5.25, 5.26. Fixture que ATA el cap 1 (propiedades de la atmósfera) con el
       cap 5 (fricción). Si atmosfera.ts se desvía en ρ o μ, este fixture lo delata.
```
```
FIXTURE bertin-ej-5.5 [§5.4.6, p.270-273]  "Subsonic parasite drag coefficient of the F-16"
entradas: F-16 a 30,000 ft, M = 0.4 -> U∞ = 397.92 ft/s, ρ∞ = 0.000891 slug/ft³,
          μ∞ = 3.107e-7 lb·s/ft² ; Sref = 300 ft² (área alar teórica)
          geometrías: Tablas 5.2 y 5.3 (arriba, en DATOS-EXPERIMENTALES)
          método: ecs. 5.35, 5.36/5.30, 5.37, 5.38, 5.39/5.40, 5.34
          factores de forma K de las Figs. 5.21 y 5.23 (NO LEGIBLES en el txt; los valores
          usados por el libro se listan en las Tablas 5.4 y 5.5)
salida esperada, paso a paso del ALA:
          mac = (2/3)·(14 + 3.5 - 14·3.5/17.5) = 9.800 ft
          ReL = 0.000891·397.92·9.800/3.107e-7 = 11.18e6
          Cf  = 0.455/(log10 11.18e6)^2.58 - 1700/11.18e6 = 0.00280
          K   = 1.06  (Fig. 5.21, con Λ_LE = 40° y t/c = 0.04)
          CD0_ala = 1.06·0.00280·419.4/300 = 0.00415
salida esperada, paso a paso del FUSELAJE:
          L   = Lmorro + Lfuselaje + Lboattail = 6 + 39 + 4 = 49.0 ft
          ReL = 0.000891·397.92·49.0/3.107e-7 = 55.91e6
          Cf  = 0.00228
          finura L/D = 49.0/[0.5·(2.5+5.0)] = 13.067  -> K = 1.05 (Fig. 5.23, extrapolando)
          Swet = 656.5 ft²
          CD0_fus = 1.05·0.00228·656.5/300 = 0.00524
salida esperada, TOTAL:
          Swet total estimada = 1418 ft² ; Swet real del F-16 = 1495 ft² (5.4% menos)
          CD0(alas) = 0.00710 ; CD0(fuselajes) = 0.00590 ; CD0 liso = 0.01300
          corregido por el 5.4% de área mojada faltante -> CD0 = 0.01370
          +10% por excrecencias/base/interferencia -> CD0 = 0.0151
          +15%                                     -> CD0 = 0.0158
          VUELO REAL [Webb et al. (1977)]: CD0 subsónico del F-16 entre 0.0160 y 0.0190
          (tras corregir por efectos del motor y por los misiles presentes en el ensayo)
tolerancia: 2% en cada componente; el resultado final se juzga contra la BANDA de vuelo
notas: **ESTE ES EL FIXTURE MÁS VALIOSO DEL BLOQUE: es método de ingeniería validado contra
       datos de vuelo de un avión real.**
       **ERRATA DEL TXT:** la línea de la p.271 imprime "- 170/11.18e6"; la ecuación 5.37 dice
       1700 y sólo con 1700 sale 0.00280 (verificado: 0.002949 - 0.000152 = 0.002797). Usar 1700.
       Cita clave para el producto: "Since the total wetted area estimate from this analysis was
       5.4% lower than the actual wetted area of the F-16 (something which could be improved with
       a better representation of the aircraft surfaces, such as from a CAD geometry)" —
       **el libro literalmente pide un CAD que mida el área mojada. Ese es nuestro producto.**
       Y el veredicto: "These results should be considered quite good for a fairly straightforward
       method that can be used easily on a spreadsheet."
```
```
FIXTURE bertin-ej-5.6 [§5.5.1, p.277-279]  "F-16C in steady, level, unaccelerated flight"
entradas: F-16C, W = 23,750 lbf, S = 300 ft², altitud 30,000 ft
          -> ρ∞ = 0.0008907 slug/ft³, a∞ = 994.85 ft/s (Tabla 1.2B)
          curvas de sustentación de la Fig. 5.27 [General Dynamics Staff (1976)], CLmax = 1.57
salida esperada: Ustall = sqrt(2W/(ρ∞·CLmax·S)) = 336.5 ft/s = 199.2 kt, a α = 27.5°
                 Mstall = 336.5/994.85 = 0.338
                 tabla CL(M), α(M), U(M):
                   M∞    CL      α(°)   U(ft/s)   U(kt)
                   1.2   0.125    1.9   1193.82   706.8
                   0.9   0.222    2.4    895.37   530.1
                   0.8   0.281    3.5    795.88   471.2
                   0.6   0.499    6.2    596.91   353.4
                   0.338 1.57    27.5    336.50   199.2
                 conversión usada: U(kt) = M·a(ft/s)·0.59209
tolerancia: 0.5% en CL y U; los α salen de la Fig. 5.27 (NO LEGIBLE) y son de referencia
notas: ecs. 5.42a y 5.42b. El CL de cada fila lo puede calcular el software; el α NO (viene de
       una figura). Por eso este fixture se parte en dos: la parte CL/U es TEST DURO, la parte α
       es dato de referencia dependiente de figura.
       Lección: "Notice how rapidly the angle of attack increases toward the stall angle of attack
       ... The angle of attack varies much more slowly with velocity at transonic Mach numbers."
```
```
FIXTURE bertin-ej-5.7 [§5.5.3, p.284-287]  "Drag components of an F-16C in SLUF"
entradas: F-16C, W = 23,750 lbf, S = 300 ft², b = 30 ft, AR = 3, e = 0.9084
          altitud 20,000 ft -> ρ∞ = 0.001267 slug/ft³, a∞ = 1036.94 ft/s (Tabla 1.2B)
          CD0(M) y k(M) por interpolación LINEAL de la tabla de 5 puntos (0.10, 0.84, 1.05,
          1.50, 1.80)
          modelo: CD = CD0 + k·CL² [5.46]; CL de la ec. 5.42b; Dp = CD0·q∞·S; Di = k·CL²·q∞·S
salida esperada (tabla completa del libro, p.287):
 M     CD0     k       V(ft/s)  q(lb/ft²)  Dp(lb)     CL        CDi       Di(lb)    D(lb)      L/D
0.10  0.0208  0.1168   103.69     6.81       42.50   11.6222   15.7768   32239.99  32282.50  0.7357
0.20  0.0208  0.1168   207.39    27.25      170.02    2.9056    0.9861    8060.00   8230.02  2.8858
0.30  0.0208  0.1168   311.08    61.31      382.54    1.2914    0.1948    3582.22   3964.77  5.9903
0.40  0.0208  0.1168   414.78   108.99      680.08    0.7264    0.0616    2015.00   2695.08  8.8124
0.50  0.0208  0.1168   518.47   170.29     1062.62    0.4649    0.0252    1289.60   2352.22 10.0968
0.60  0.0208  0.1168   622.16   245.22     1530.17    0.3228    0.0122     895.56   2425.73  9.7909
0.70  0.0208  0.1168   725.86   333.77     2082.74    0.2372    0.0066     657.96   2740.70  8.6657
0.80  0.0208  0.1168   829.55   435.95     2720.31    0.1816    0.0039     503.75   3224.06  7.3665
0.90  0.0300  0.1312   933.25   551.75     4965.71    0.1435    0.0027     447.10   5412.81  4.3877
1.00  0.0447  0.1542  1036.94   681.17     9134.46    0.1162    0.0021     425.63   9560.09  2.4843
1.10  0.0522  0.1832  1140.63   824.21    12907.17    0.0961    0.0017     417.92  13325.09  1.7824
1.20  0.0511  0.2195  1244.33   980.88    15036.91    0.0807    0.0014     420.75  15457.66  1.5365
1.30  0.0501  0.2558  1348.02  1151.17    17302.13    0.0688    0.0012     417.80  17719.93  1.3403
1.40  0.0490  0.2922  1451.72  1335.09    19625.80    0.0593    0.0010     411.51  20037.30  1.1853
1.50  0.0479  0.3285  1555.41  1532.63    22023.85    0.0517    0.0009     403.00  22426.85  1.0590
1.60  0.0474  0.3594  1659.10  1743.79    24796.67    0.0454    0.0007     387.52  25184.19  0.9431
1.70  0.0470  0.3902  1762.80  1968.57    27756.89    0.0402    0.0006     372.68  28129.58  0.8443
1.80  0.0465  0.4211  1866.49  2206.98    30787.41    0.0359    0.0005     358.75  31146.16  0.7625
comprobaciones adicionales:
   k(M=0.10) = 1/(π·e·AR) = 1/(π·0.9084·3) = 0.1168   (cierre de la ec. 5.48)
   arrastre total MÍNIMO en M ≈ 0.52, donde Dp = Di y donde ocurre (L/D)max
tolerancia: 0.5% por celda
notas: **FIXTURE DE INTEGRACIÓN COMPLETA: atmósfera + polar + SLUF.**
       Ojo con la primera fila: a M=0.10 el CL requerido es 11.62, físicamente imposible. El libro
       la deja a propósito: es la evidencia numérica de que ese punto de vuelo NO EXISTE (está muy
       por debajo de la velocidad de pérdida). **El software debe MARCARLA como inalcanzable,
       no imprimirla como si nada.**
       Lección declarada: "Notice that when the total drag is a minimum (which occurs at a Mach
       number of approximately 0.52), the parasite drag is equal to the induced drag, which is
       also the velocity for (L/D)max."
```
```
FIXTURE bertin-prob-5.3 [§5.5 Problemas, p.288]  "(L/D)max analítico"
entradas: modelo CD = CD0 + k·CL² con CD0 y k CONSTANTES, flujo incompresible
salida esperada: CL en (L/D)max = sqrt(CD0/k)
                 (L/D)max = 1/(2·sqrt(k·CD0))
tolerancia: exacto (identidad algebraica)
notas: verificar contra el Ejemplo 5.7: con CD0=0.0208 y k=0.1168 ->
       CL = sqrt(0.0208/0.1168) = 0.4220 y (L/D)max = 1/(2·sqrt(0.1168·0.0208)) = 10.14.
       La tabla del Ejemplo 5.7 da L/D = 10.0968 en M=0.50 (la malla de Mach no cae exactamente
       en el óptimo M≈0.52). Coherente.
```


### 3.bis — TABLAS DE DATOS MEDIDOS (fixtures de validación contra la realidad)

Valores experimentales y de aviones reales copiados literales. Sirven para validar el software
contra la REALIDAD, no sólo contra la teoría.


**Tabla 1.1 — Coeficiente de viscosidad del aire: Svehla (1962) vs Sutherland ec. 1.12** [§1.2.3, p.16]
μ×10⁵ en kg/m·s. Primera columna Svehla (medido/Lennard-Jones), segunda Sutherland.
```
T(K)   Svehla  Sutherland | T(K)   Svehla  Sutherland
 200   1.360    1.329      | 2600   7.765    7.132
 400   2.272    2.285      | 2800   8.145    7.422
 600   2.992    3.016      | 3000   8.516    7.702
 800   3.614    3.624      | 3200   8.878    7.973
1000   4.171    4.152      | 3400   9.232    8.234
1200   4.695    4.625      | 3600   9.579    8.488
1400   5.197    5.057      | 3800   9.918    8.734
1600   5.670    5.456      | 4000  10.252    8.974
1800   6.121    5.828      | 4200  10.580    9.207
2000   6.553    6.179      | 4400  10.902    9.435
2200   6.970    6.512      | 4600  11.219    9.657
2400   7.373    6.829      | 4800  11.531    9.874
                           | 5000  11.838   10.087
```

**Tabla 1.2A — U.S. Standard Atmosphere 1976, unidades SI** [§1.2.5, p.18]
Altitud geométrica (km) | p (N/m²) | T (K) | ρ (kg/m³) | μ (kg/m·s) | a (m/s)
```
 0  1.0133E+05  288.150  1.2250E+00  1.7894E-05  340.29
 1  8.9875E+04  281.651  1.1117E+00  1.7579E-05  336.43
 2  7.9501E+04  275.154  1.0066E+00  1.7260E-05  332.53
 3  7.0121E+04  268.659  9.0926E-01  1.6938E-05  328.58
 4  6.1669E+04  262.166  8.1934E-01  1.6612E-05  324.59
 5  5.4048E+04  255.676  7.3643E-01  1.7885E-05  320.55   <-- ver NOTA
 6  4.7217E+04  249.187  6.6012E-01  1.5949E-05  316.45
 7  4.1105E+04  242.700  5.9002E-01  1.5612E-05  312.31
 8  3.5651E+04  236.215  5.2578E-01  1.5271E-05  308.11
 9  3.0800E+04  229.733  4.6707E-01  1.4926E-05  303.85
10  2.6500E+04  223.252  4.1351E-01  1.4577E-05  299.53
11  2.2700E+04  216.774  3.6481E-01  1.4223E-05  295.15
12  1.9399E+04  216.650  3.1193E-01  1.4216E-05  295.07
13  1.6579E+04  216.650  2.6660E-01  1.4216E-05  295.07
14  1.4170E+04  216.650  2.2786E-01  1.4216E-05  295.07
15  1.2111E+04  216.650  1.9475E-01  1.4216E-05  295.07
16  1.0352E+04  216.650  1.6647E-01  1.4216E-05  295.07
17  8.8497E+03  216.650  1.4230E-01  1.4216E-05  295.07
18  7.5652E+03  216.650  1.2165E-01  1.4216E-05  295.07
19  6.4675E+03  216.650  1.0400E-01  1.4216E-05  295.07
20  5.5293E+03  216.650  8.8911E-02  1.4216E-05  295.07
21  4.7289E+03  217.581  7.5715E-02  1.4267E-05  295.70
22  4.0474E+03  218.574  6.4510E-02  1.4322E-05  296.38
23  3.4668E+03  219.567  5.5006E-02  1.4376E-05  297.05
24  2.9717E+03  220.560  4.6938E-02  1.4430E-05  297.72
25  2.5491E+03  221.552  4.0084E-02  1.4484E-05  298.39
26  2.1883E+03  222.544  3.4257E-02  1.4538E-05  299.06
27  1.8799E+03  223.536  2.9298E-02  1.4592E-05  299.72
28  1.6161E+03  224.527  2.5076E-02  1.4646E-05  300.39
29  1.3904E+03  225.518  2.1478E-02  1.4699E-05  301.05
30  1.1970E+03  226.509  1.8411E-02  1.4753E-05  301.71
```
**NOTA DE INTEGRIDAD (hallazgo, no invención):** el valor de viscosidad a 5 km (1.7885E-05) ROMPE
la monotonía de la columna (4 km: 1.6612E-05; 6 km: 1.5949E-05) y no es reproducible con
Sutherland a T=255.676 K (que da ≈1.6282E-05). Es una errata de la tabla impresa. En la tabla
inglesa hay la misma anomalía a 8 kft (3.4764E-07, entre 3.6173E-07 y 3.5353E-07). **El test de
regresión de `atmosfera.ts` debe excluir esos dos puntos y documentar por qué**, o el motor se
"ajustará" a una errata.

**Tabla 1.2B — U.S. Standard Atmosphere 1976, unidades inglesas** [§1.2.5, pp. 19–20]
Altitud (kft) | p (lbf/ft²) | T (°R) | ρ (slug/ft³) | μ (slug/ft·s) | a (ft/s)
```
  0  2.1162E+03  518.67  2.3769E-03  3.7383E-07  1116.44
  2  1.9677E+03  511.54  2.2409E-03  3.6982E-07  1108.76
  4  1.8277E+03  504.41  2.1109E-03  3.6579E-07  1100.98
  6  1.6960E+03  497.28  1.9869E-03  3.6173E-07  1093.18
  8  1.5721E+03  490.15  1.8685E-03  3.4764E-07  1085.33   <-- ver NOTA
 10  1.4556E+03  483.02  1.7556E-03  3.5353E-07  1077.40
 12  1.3462E+03  475.90  1.6479E-03  3.4939E-07  1069.42
 14  1.2436E+03  468.78  1.5455E-03  3.4522E-07  1061.38
 16  1.1473E+03  461.66  1.4480E-03  3.4102E-07  1053.31
 18  1.0575E+03  454.53  1.3553E-03  3.3679E-07  1045.14
 20  9.7733E+02  447.42  1.2673E-03  3.3253E-07  1036.94
 22  8.9459E+02  440.30  1.1836E-03  3.2825E-07  1028.64
 24  8.2116E+02  433.18  1.1044E-03  3.2392E-07  1020.31
 26  7.5270E+02  426.07  1.0292E-03  3.1958E-07  1011.88
 28  6.8896E+02  418.95  9.5801E-04  3.1519E-07  1003.41
 30  6.2966E+02  411.84  8.9070E-04  3.1078E-07   994.85
 32  5.7457E+02  404.73  8.2704E-04  3.0633E-07   986.22
 34  5.2347E+02  397.62  7.6695E-04  3.0185E-07   977.53
 36  4.7611E+02  390.51  7.1029E-04  2.9734E-07   968.73
 38  4.3262E+02  389.97  6.4640E-04  2.9700E-07   968.08
 40  3.9311E+02  389.97  5.8728E-04  2.9700E-07   968.08
 42  3.5722E+02  389.97  5.3366E-04  2.9700E-07   968.08
 44  3.2477E+02  389.97  4.8494E-04  2.9700E-07   968.08
 46  2.9477E+02  389.97  4.4068E-04  2.9700E-07   968.08
 48  2.6806E+02  389.97  4.0046E-04  2.9700E-07   968.08
 50  2.4360E+02  389.97  3.6393E-04  2.9700E-07   968.08
 52  2.2138E+02  389.97  3.3072E-04  2.9700E-07   968.08
 54  2.0119E+02  389.97  3.0056E-04  2.9700E-07   968.08
 56  1.8288E+02  389.97  2.7315E-04  2.9700E-07   968.08
 58  1.6618E+02  389.97  2.4824E-04  2.9700E-07   968.08
 60  1.5103E+02  389.97  2.2561E-04  2.9700E-07   968.08
 62  1.3726E+02  389.97  2.0505E-04  2.9700E-07   968.08
 64  1.2475E+02  389.97  1.8637E-04  2.9700E-07   968.08
 66  1.1339E+02  390.07  1.6934E-04  2.9706E-07   968.21
 68  1.0307E+02  391.16  1.5351E-04  2.9775E-07   969.55
 70  9.3725E+01  392.25  1.3920E-04  2.9845E-07   970.90
 72  8.5250E+01  393.34  1.2626E-04  2.9914E-07   972.24
 74  7.7572E+01  394.43  1.1456E-04  2.9983E-07   973.59
 76  7.0587E+01  395.52  1.0397E-04  3.0052E-07   974.93
 78  6.4257E+01  396.60  9.4387E-05  3.0121E-07   976.28
 80  5.8511E+01  397.69  8.5711E-05  3.0190E-07   977.62
 82  5.3293E+01  398.78  7.7855E-05  3.0259E-07   978.94
 84  4.8552E+01  399.87  7.0739E-05  3.0328E-07   980.28
 86  4.4248E+01  400.96  6.4290E-05  3.0396E-07   981.63
 88  4.0335E+01  402.05  5.8446E-05  3.0465E-07   982.94
 90  3.6778E+01  403.14  5.3147E-05  3.0533E-07   984.28
 92  3.3542E+01  404.22  4.8344E-05  3.0602E-07   985.60
 94  3.0601E+01  405.31  4.3985E-05  3.0670E-07   986.94
 96  2.7924E+01  406.40  4.0029E-05  3.0738E-07   988.25
 98  2.5488E+01  407.49  3.6440E-05  3.0806E-07   989.57
100  2.3272E+01  408.57  3.3182E-05  3.0874E-07   990.91
```

**Clmax medido vs espesor, familia NACA 24xx** [§5.2.4, p.235, datos de Abbott y von Doenhoff (1949)]
```
NACA 2408  Clmax 1.50
NACA 2410  Clmax 1.65
NACA 2412  Clmax 1.70   <- óptimo (~12% de espesor)
NACA 2415  Clmax 1.63
NACA 2418  Clmax 1.48
NACA 2424  Clmax 1.30
```

**NACA 23012, valores medidos** [§5.4.1–5.4.2, pp. 246–251, Abbott y von Doenhoff (1949)]
- Condiciones del ensayo: túnel presurizable hasta 10 atm; Re de 3×10⁶ a 9×10⁶; Mach < 0.17;
  modelo que abarca de pared a pared para simular envergadura infinita.
- Clα = 0.104 por grado (experimental). Teórico 2π/rad = 0.1097/grado.
- α0l = −1.2° (curvatura máxima ≈ 2% de la cuerda).
- Región lineal: de aproximadamente −10° a +10°. Arriba de 10° el Cl deja de ser lineal Y aparece
  dependencia con Reynolds.
- Clmax = 1.79 a α = 18° (ángulo de entrada en pérdida).
- Posición del centro aerodinámico x/c: 0.241 a Re 3.0×10⁶; 0.241 a Re 6.0×10⁶; 0.247 a Re 8.8×10⁶.
- "One of the nice features of the NACA 23012 airfoil section is a relatively high Clmax with only a
  small Cmac." Usado en el Beechcraft Bonanza y en el Brewster Buffalo.

**Rugosidad de grano de arena equivalente** [§5.4.6, p.266, Blake (1998)]
```
metal pulido                          k = 0.06e-3 in
pintura en aerosol, producción serie  k = 2e-3    in
metal galvanizado                     k = 6e-3    in
```

**Incremento empírico de arrastre por rugosidad** [§5.4.6, p.265, Kroo (2003)]
```
mayoría de aviones subsónicos                     +6% a +9%
compuestos de flujo laminar cuidadosamente hechos +2% a +3%
```

**Vuelo real vs túnel, Boeing 727** [§5.4.3, p.255, Bowes (1974), sonda aerotransportada]
> "The measured minimum section profile drag at M = .73 was about 15 percent higher than predicted
> from wind-tunnel test data for a smooth airfoil... This quite sizeable difference between the
> measured and extrapolated values of Cd,min has been attributed to surface roughness and
> excrescences on the airplane wing, although the 15-percent increase in wing-section profile drag
> is larger than traditionally allotted in airplane drag estimates."

**Tabla 5.1 — Parámetros geométricos de ala de 30 aviones reales** [§5.3, pp. 240–241,
Jane's All the World's Aircraft 1966/1973/1984/2011]. Copiada literal.

*a. Monomotores de cuatro plazas* — Envergadura m(ft) | AR | Flecha | Diedro | Perfil | Velocidad km/h (mi/h)
```
Socata Rallye (Francia)   9.61 (31.52)  7.57  ninguna  7°     63A414(mod), 63A416, inc. 4°               173-245 (108-152)
Ambrosini NF 15 (Italia)  9.90 (32.5)   7.37  ninguna  6°     64-215, inc. 4°                            325 (202)
Beechcraft Bonanza V35B  10.20 (33.46)  6.30  ninguna  6°     23016.5 raíz, 23012 punta, inc. 4° raíz / 1° punta   298-322 (185-200)
Beechcraft Sierra         9.98 (32.75)  7.35  ninguna  6°30'  63₂A415, inc. 3° raíz / 1° punta           211-281 (131-162)
Cessna 172               10.92 (35.83)  7.32  ninguna  1°44'  NACA 2412, inc. 1°30' raíz / -1°30' punta  211 (131)
Piper Commanche          10.97 (36.0)   7.28  2°30' adelante  5°  64₂A215, inc. 2°                       298 (185)
Bellanca Model 25        10.67 (35.0)   6.70  ninguna  2°     NACA 63₂-215, inc. 2°                      458-499 (285-310)
Piper Warrior II         10.67 (35.0)   7.24  ninguna  7°     NACA 65₂-415, inc. 2° raíz / -1° punta     191-235 (119-146)
```
*b. Jets comerciales y transportes*
```
Caravelle 210 (Francia)  34.3 (112.5)  8.02  20° en c/4   3°   NACA 65₁212                                     790 (490)
BAC 111 (RU)            26.97 (88.5)   8.00  20° en c/4   2°   NACA sección con curvatura (mod.), t/c=0.125 raíz, 0.11 punta, inc. 2°30'   815 (507)
Tupolev 204 (Rusia)     41.84 (137.3)  9.10  28° en c/4   —    t/c = 0.14 (interior) a 0.09 (exterior), con torsión   850 (528)
Boeing 737              28.35 (93.0)   8.83  25° en c/4   6°   t/c = 0.129 (promedio)                          848 (527)
Boeing 747              59.64 (195.7)  6.95  37°30' en c/4  7° t/c = 0.134 (interior), 0.078 (medio), 0.080 (exterior), inc. 2°   958 (595)
Boeing 777              64.80 (212.6)  8.68  25° en c/4   —    —                                               Mach 0.77
Lockheed C-5A           67.88 (222.8)  7.75  25° en c/4   anhedro 5°30'  NACA 0011 (mod.) cerca del medio, inc. 3°30'   815 (507)
McDonnell Douglas (Boeing) C-17  50.29 (165)  7.2  25° en c/4  anhedro 3°30'  t/c = 0.153 (interior), 0.122 (exterior)   Mach 0.74-0.77
Airbus A310 (Internacional) 43.89 (144.0) 8.8  28° en c/4  11°8' (interior en borde de salida)  t/c = 0.152 raíz, 0.108 punta, inc. 5°3'   667-895 (414-556)
Airbus A380 (Internacional) 79.80 (261.8) 7.5  35° en c/4 (promedio)  5.5° (exterior)  —        945 (587)
```
*c. Aviones militares de alta velocidad*
```
SAAB-35 Draken (Suecia)   9.40 (30.8)   1.77  central: borde de ataque 80°, exterior: borde de ataque 57°  —  t/c = 0.05   Mach 1.4-2.0
Dassault Mirage III (Fr)  8.22 (27.0)   1.94  borde de ataque 60°34'  anhedro 1°  t/c = 0.045 a 0.035      Mach 2.2
Northrop F-5E             8.13 (26.67)  3.82  24° en c/4   ninguno  65A004.8 (mod.), t/c = 0.048           Mach 1.23
McDonnell-Douglas F-4    11.70 (38.4)   2.78  45°   panel exterior 12°   t/c = 0.051 (promedio)            > Mach 2.0
LTV F-8                  10.81 (35.7)   3.39  35°   anhedro 5°   sección delgada de flujo laminar          ~ Mach 2
LTV A-7                  11.80 (38.75)  4.0   35° en c/4  anhedro 5°   65A007, inc. -1°                    1123 (698)
Mitsubishi T2 (Japón)     7.88 (25.85)  2.93  35°47' en c/4  anhedro 9°  NACA serie 65 (mod.), t/c=0.0466  Mach 1.6
General Dynamics (Lockheed Martin) F-16  9.14 (30.0)  3.0  40° en bordes de ataque  —  NACA 64A-204        Mach 2.0+
Lockheed Martin F-22     13.56 (44.5)   2.4   42° en bordes de ataque  anhedro 3.25°  t/c = 0.0592 (int.) y 0.0429 (ext.); -3.1° en punta   Mach 2.0+
Eurofighter (Internac.)  11.09 (35.35)  2.5   53° en bordes de ataque  1°   NACA 66 (mod.)                 Mach 2.0
Sukhoi Su-27 (Rusia)     14.70 (48.2)   3.5   37° en c/4   0°   t/c = 0.05                                 Mach 2.35
```

**Tabla 5.2 — Áreas mojadas de superficies tipo ALA del F-16** [§5.4.6, p.270, Brandt et al. (2004)]
```
Superficie                    Envergadura(ft)  cr(ft)  ct(ft)  t/c    Swet(ft²)
Ala (1 y 2)                        12           14      3.5    0.04     419.4
Cola horizontal (3 y 4)             6            7.8    2      0.04     117.5
Strake (5 y 6)                      2            9.6    0      0.06      38.6
Deriva interior (7)                 1.4         12.5    6      0.10      26.3
Deriva exterior (8)                 7            8      3      0.06      77.3
Aletas dorsales (9 y 10)            1.5          5      3      0.03      23.9
```

**Tabla 5.3 — Áreas mojadas de superficies tipo FUSELAJE del F-16** [§5.4.6, p.271, Brandt et al. (2004)]
```
Superficie                       Largo(ft) Alto(ft) Ancho(ft) Swet(ft²)  Swet neto(ft²)
Fuselaje (cilindro 1)               39       2.5      5         551.3      551.3
Morro (cono 1)                       6       2.5      5          42.4       42.4
Boattail (cilindro 2)                4       6        6          62.8       62.8
Costado (semicilindros 1 y 2)       24       0.8      1          67.9       29.5
Cúpula (semicilindro 3)              5       2        2          15.7        5.7
Motor (semicilindro 4)              30       2.5      5         180         32.1
Frente de cúpula (semicono 1)        2       2        2           3.1        1.1
Cola de cúpula (semicono 2)          4       2        2           6.3        2.3
```

**Tabla 5.4 — Arrastre a sustentación nula, superficies tipo ALA del F-16** [§5.4.6, p.270]
```
Superficie                    mac(ft)  ReL(×10⁻⁶)   Cf       K      CD0
Ala (1 y 2)                    9.800     11.18     0.00280  1.06   0.00415
Cola horizontal (3 y 4)        5.472      6.568    0.00296  1.06   0.00123
Strake (5 y 6)                 6.400      7.303    0.00293  1.04   0.00039
Deriva interior (7)            9.631     10.99     0.00280  1.04   0.00026
Deriva exterior (8)            5.879      6.708    0.00295  1.08   0.00082
Aletas dorsales (9 y 10)       4.083      4.660    0.00304  1.04   0.00025
TOTAL                                                              0.00710
```

**Tabla 5.5 — Arrastre a sustentación nula, superficies tipo FUSELAJE del F-16** [§5.4.6, p.273]
```
Superficie                        Largo(ft)  ReL(×10⁻⁶)   Cf       K      CD0
Fuselaje + morro + boattail          49.0      55.91     0.00228  1.05   0.00524
Costado (semicilindros 1 y 2)        24.0      27.39     0.00251  1.01   0.00025
Cúpula (frente + centro + cola)      11.0      12.55     0.00276  1.25   0.00011
Motor (semicilindro 4)               30.0      34.23     0.00244  1.15   0.00030
TOTAL                                                                    0.00590
```

**Polar en vuelo del F-106A/B a M=0.9** [§5.5.2, p.280, Piszkin et al. (1961), Fig. 5.29]
```
CL,min ≈ 0.07   (donde ocurre el arrastre mínimo)
CD,min ≈ 0.012  ("only slightly lower than CD0")
```

**Coeficientes de la polar del F-16 por Mach** [§5.5.3 Ejemplo 5.7, p.284]
```
M∞     CD0      k
0.10  0.0208  0.1168
0.84  0.0208  0.1168
1.05  0.0527  0.1667
1.50  0.0479  0.3285
1.80  0.0465  0.4211
```
Otros parámetros: AR = 3.0; S = 300 ft²; e = 0.9084; b = 30 ft; W = 23,750 lb.
**Nota del libro: los CD0 tabulados por encima de M=0.84 YA INCLUYEN el arrastre de onda ΔCDM.**

**Coeficientes de la polar del MiG-29** [§5.5 Problema 5.15, p.291]
```
M∞     CD0      k          S = 409 ft²; b = 37.3 ft; e = 0.75; W = 31,000 lb
0.1000 0.0207  0.1279
0.8500 0.0207  0.1279
1.0700 0.0472  0.1773
1.5000 0.0425  0.3317
1.8000 0.0408  0.4240
```

**Coeficientes de la polar del Eurofighter 2000** [§5.5 Problema 5.16, p.292]
```
M∞     CD0      k          S = 50 m²; b = 10.5 m; e = 0.84; peso = 17,500 kg
0.1000 0.0131  0.1725
0.8600 0.0131  0.1725
1.1100 0.0321  0.2292
1.5000 0.0289  0.3515
1.8000 0.0277  0.4417
```
**Observación (dato, no invención): el e del Eurofighter (0.84) y el del MiG-29 (0.75) caen dentro
del rango 0.6–0.95 que da el libro; el del F-16 (0.9084) está en el extremo superior.**

**(L/D)max representativos en vuelo subsónico** [§5.5.3, p.284]
```
Velero de alto rendimiento   25-40
Transporte comercial         12-20
Caza supersónico              4-12
Vehículo hipersónico          1-4
```

**Restricciones NO aerodinámicas del ala del C-17** [§5.5.1 Concept Box, pp. 275–276, Van't Riet
(1989) y Pres Henne comunicación personal (2012)]
```
Envergadura     limitada a no superar la del C-141 (espacio de estacionamiento en plataforma)
AR resultante   7.2 (extremo bajo de la banda de transportes comerciales)
CLmax aterrizaje con flap soplado externo (EBF)  ≈ 4.0
CLmax con flaps SIN EBF                          ≈ 2.8 con 43° de deflexión de flap
Longitud de pista requerida                      < 3000 ft
Winglets        sólo por ARRIBA del ala (los camiones de servicio pasan por debajo)
Fabricación     piel del ala "drapeada": radio de curvatura en envergadura mínimo 5000 pulgadas
```
Cita clave: *"finding a wing that can attain all requirements necessarily means that the wing will
not be fully optimized for aerodynamics purposes."*

**Tabla 5.6 — Distribuciones de presión medidas, NACA 4412** [§5.5 Problemas 5.10–5.13, pp. 289–290,
Pinkerton (1936); modelo de 76.2 cm × 12.7 cm (30 in × 5 in), presión media 21 atmósferas estándar,
Reynolds medio 3,100,000]. Cp en el plano medio; x-estación en % de cuerda desde el borde de
ataque, z-ordenada en % de cuerda sobre la línea de cuerda. Las primeras 24 filas (z negativo) son
el INTRADÓS de vuelta desde el borde de salida; a partir de la fila `0 / 0.68` empieza el EXTRADÓS.
```
x(%c)   z(%c)    Cp(α=-4°)  Cp(α=+2°)  Cp(α=+16°)
                 αef=-4°    αef=1.2°   αef=13.5°
100.00   0        0.204      0.181      0.010
 97.92  -0.10     0.178      0.164      0.121
 94.86  -0.16     0.151      0.154      0.179
 89.90  -0.22     0.128      0.152      0.231
 84.94  -0.28     0.082      0.148      0.257
 74.92  -0.52     0.068      0.136      0.322
 64.94  -0.84     0.028      0.120      0.374
 54.48  -1.24    -0.024      0.100      0.414
 49.98  -1.44    -0.053      0.091      0.426
 44.90  -1.64    -0.075      0.088      0.459
 39.98  -1.86    -0.105      0.071      0.485
 34.90  -2.10    -0.146      0.066      0.516
 29.96  -2.30    -0.190      0.048      0.551
 24.90  -2.54    -0.266      0.025      0.589
 19.98  -2.76    -0.365     -0.011      0.627
 14.94  -2.90    -0.502     -0.053      0.713
  9.96  -2.86    -0.716     -0.111      0.818
  7.38  -2.72    -0.867     -0.131      0.896
  4.94  -2.46    -1.106     -0.150      0.980
  2.92  -2.06    -1.380     -0.098      0.993
  1.66  -1.60    -1.709      0.028      0.791
  0.92  -1.20    -1.812      0.254      0.264
  0.36  -0.70    -1.559      0.639     -1.379
  0      0       -0.296      0.989     -3.648
  0      0.68     0.681      0.854     -6.230
  0.44   1.56     0.994      0.336     -5.961
  0.94   2.16     0.939      0.055     -5.210
  1.70   2.78     0.782     -0.148     -4.478
  2.94   3.64     0.559     -0.336     -3.765
  4.90   4.68     0.333     -0.485     -3.190
  7.50   5.74     0.139     -0.568     -2.709
  9.96   6.56     0.017     -0.623     -2.440
 12.58   7.34    -0.091     -0.676     -2.240
 14.92   7.88    -0.152     -0.700     -2.149
 17.44   8.40    -0.210     -0.721     -1.952
 19.96   8.80    -0.262     -0.740     -1.841
 22.44   9.16    -0.322     -0.769     -1.758
 24.92   9.52    -0.322     -0.746     -1.640
 27.44   9.62    -0.355     -0.742     -1.535
 29.88   9.76    -0.364     -0.722     -1.438
 34.95   9.90    -0.381     -0.693     -1.269
 39.90   9.84    -0.370     -0.635     -1.099
 44.80   9.64    -0.371     -0.609     -0.961
 49.92   9.22    -0.329     -0.525     -0.786
 54.92   8.76    -0.303     -0.471     -0.649
 59.94   8.16    -0.298     -0.438     -0.551
 64.90   7.54    -0.264     -0.378     -0.414
 69.86   6.76    -0.225     -0.319     -0.316
 74.90   5.88    -0.183     -0.252     -0.212
 79.92   4.92    -0.144     -0.191     -0.147
 84.88   3.88    -0.091     -0.116     -0.082
 89.88   2.74    -0.019     -0.026     -0.043
 94.90   1.48    -0.069     -0.076     -0.016
 98.00   0.68     0.139     -0.143     -0.004
```
**Advertencia LITERAL del propio Pinkerton sobre este dato** (p.288–289): *"In order to have true
section characteristics (two-dimensional) for comparison with theoretical calculations, a
determination must be made of the effective angle of attack... The determination of the effective
angle of attack of the midspan section entails certain assumptions that are subject to considerable
uncertainty."* Por eso la tabla trae DOS ángulos: el físico α y el efectivo αef. **El software debe
comparar contra αef, no contra α.**


#### Tabla 4.1 (p.175) — LITERAL. Valores numéricos de f'(η) para las soluciones de similitud de Falkner-Skan
*"Numerical Values of the Dimensionless Streamwise Velocity f'(η) for the Falkner-Skan, Laminar, Similarity Flows"*

| η | β=−0.1988 | β=−0.180 | β=0.000 | β=0.300 | β=1.000 | β=2.000 |
|---|---|---|---|---|---|---|
| 0.0 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 | 0.0000 |
| 0.1 | 0.0010 | 0.0138 | 0.0470 | 0.0760 | 0.1183 | 0.1588 |
| 0.2 | 0.0040 | 0.0293 | 0.0939 | 0.1489 | 0.2266 | 0.2979 |
| 0.3 | 0.0089 | 0.0467 | 0.1408 | 0.2188 | 0.3252 | 0.4185 |
| 0.4 | 0.0159 | 0.0658 | 0.1876 | 0.2857 | 0.4145 | 0.5219 |
| 0.5 | 0.0248 | 0.0867 | 0.2342 | 0.3494 | 0.4946 | 0.6096 |
| 0.6 | 0.0358 | 0.1094 | 0.2806 | 0.4099 | 0.5663 | 0.6834 |
| 0.7 | 0.0487 | 0.1337 | 0.3265 | 0.4671 | 0.6299 | 0.7450 |
| 0.8 | 0.0636 | 0.1597 | 0.3720 | 0.5211 | 0.6859 | 0.7959 |
| 0.9 | 0.0804 | 0.1874 | 0.4167 | 0.5717 | 0.7351 | 0.8377 |
| 1.0 | 0.0991 | 0.2165 | 0.4606 | 0.6189 | 0.7779 | 0.8717 |
| 1.2 | 0.1423 | 0.2790 | 0.5452 | 0.7032 | 0.8467 | 0.9214 |
| 1.4 | 0.1927 | 0.3462 | 0.6244 | 0.7742 | 0.8968 | 0.9531 |
| 1.6 | 0.2498 | 0.4169 | 0.6967 | 0.8325 | 0.9323 | 0.9727 |
| 1.8 | 0.3127 | 0.4895 | 0.7611 | 0.8791 | 0.9568 | 0.9845 |
| 2.0 | 0.3802 | 0.5620 | 0.8167 | 0.9151 | 0.9732 | 0.9915 |
| 2.2 | 0.4510 | 0.6327 | 0.8633 | 0.9421 | 0.9839 | 0.9955 |
| 2.4 | 0.5231 | 0.6994 | 0.9011 | 0.9617 | 0.9906 | — |
| 2.6 | 0.5946 | 0.7605 | 0.9306 | 0.9755 | 0.9946 | — |
| 2.8 | 0.6635 | 0.8145 | 0.9529 | 0.9848 | — | — |
| 3.0 | 0.7277 | 0.8606 | 0.9691 | 0.9909 | — | — |
| 3.2 | 0.7858 | 0.8985 | 0.9804 | 0.9947 | — | — |
| 3.4 | 0.8363 | 0.9285 | 0.9880 | — | — | — |
| 3.6 | 0.8788 | 0.9514 | 0.9929 | — | — | — |
| 3.8 | 0.9131 | 0.9681 | 0.9959 | — | — | — |
| 4.0 | 0.9398 | 0.9798 | — | — | — | — |
| 4.2 | 0.9597 | 0.9876 | — | — | — | — |
| 4.4 | 0.9740 | 0.9927 | — | — | — | — |
| 4.6 | 0.9838 | 0.9959 | — | — | — | — |
| 4.8 | 0.9903 | — | — | — | — | — |
| 5.0 | 0.9944 | — | — | — | — | — |

#### Tabla 4.2 (p.176) — LITERAL. Función de esfuerzo transformada en la pared vs β
*"Theoretical Values of the Transformed Shear Function at the Wall for Laminar Boundary Layers as a Function of β"*

| β | −0.1988 | −0.180 | 0.000 | 0.300 | 1.000 | 2.000 |
|---|---|---|---|---|---|---|
| f''(0) | 0.000 | 0.1286 | **0.4696** | 0.7748 | 1.2326 | 1.6872 |

Nota del libro (p.176): *"f''(0) is a unique function of β for these incompressible, laminar boundary layers; the
value does not depend on the free-stream conditions, such as velocity or Reynolds number."*

#### Tabla 4.3 (p.177) — LITERAL. Solución de la capa límite laminar en placa plana (β = 0), i.e. Blasius

| η | f | f' | f'' |
|---|---|---|---|
| 0.0 | 0.0000 | 0.0000 | 0.4696 |
| 0.1 | 0.0023 | 0.0470 | 0.4696 |
| 0.2 | 0.0094 | 0.0939 | 0.4693 |
| 0.3 | 0.0211 | 0.1408 | 0.4686 |
| 0.4 | 0.0375 | 0.1876 | 0.4673 |
| 0.5 | 0.0586 | 0.2342 | 0.4650 |
| 0.6 | 0.0844 | 0.2806 | 0.4617 |
| 0.7 | 0.1147 | 0.3265 | 0.4572 |
| 0.8 | 0.1497 | 0.3720 | 0.4512 |
| 0.9 | 0.1891 | 0.4167 | 0.4436 |
| 1.0 | 0.2330 | 0.4606 | 0.4344 |
| 1.2 | 0.3336 | 0.5452 | 0.4106 |
| 1.4 | 0.4507 | 0.6244 | 0.3797 |
| 1.6 | 0.5829 | 0.6967 | 0.3425 |
| 1.8 | 0.7288 | 0.7610 | 0.3005 |
| 2.0 | 0.8868 | 0.8167 | 0.2557 |
| 2.2 | 1.0549 | 0.8633 | 0.2106 |
| 2.4 | 1.2315 | 0.9010 | 0.1676 |
| 2.6 | 1.4148 | 0.9306 | 0.1286 |
| 2.8 | 1.6032 | 0.9529 | 0.0951 |
| 3.0 | 1.7955 | 0.9691 | 0.0677 |
| 3.2 | 1.9905 | 0.9804 | 0.0464 |
| 3.4 | 2.1874 | 0.9880 | 0.0305 |
| **3.5** | **2.2863** | **0.9907** | **0.0244** |
| 4.0 | 2.7838 | 0.9978 | 0.0069 |
| 4.5 | 3.2832 | 0.9994 | 0.0015 |

Valores derivados que usa el libro: η_δ = 3.5, f_e = 2.2863, f'_e = 0.9907.
**OJO (erratum de tabla):** la fila η=1.8 da f'=0.7610 en la Tabla 4.3 pero 0.7611 en la Tabla 4.1 (β=0). Sin
consecuencia práctica, pero el test debe tolerar 1e-4.

#### Tabla 4.4 (p.186) — LITERAL. Distribución de presión del NACA 65-006
*Source: Abbott and von Doenhoff (1949).*

| x̄ = x/c | z̄ = z/c | Cp |
|---|---|---|
| 0.000 | 0.0000 | 1.000 |
| 0.005 | 0.0048 | −0.044 |
| 0.025 | 0.0096 | −0.081 |
| 0.050 | 0.0131 | −0.100 |
| 0.100 | 0.0182 | −0.120 |
| 0.150 | 0.0220 | −0.134 |
| 0.200 | 0.0248 | −0.143 |
| 0.250 | 0.0270 | −0.149 |
| 0.300 | 0.0285 | −0.155 |
| 0.350 | 0.0295 | −0.159 |
| 0.400 | 0.0300 | −0.163 |
| 0.450 | 0.0298 | −0.166 |
| 0.500 | 0.0290 | −0.165 |
| 0.550 | 0.0274 | −0.145 |
| 0.600 | 0.0252 | −0.124 |
| 0.650 | 0.0225 | −0.100 |
| 0.700 | 0.0194 | −0.073 |
| 0.750 | 0.0159 | −0.044 |
| 0.800 | 0.0123 | −0.013 |
| 0.850 | 0.0087 | +0.019 |
| 0.900 | 0.0051 | +0.056 |
| 0.950 | 0.0020 | +0.098 |
| 1.000 | 0.0000 | +0.142 |

Comentario de diseño del libro (p.187): *"Note that the maximum thickness is located relatively far aft in order
to maintain a favorable pressure gradient, which tends to delay transition."* (El máximo z̄=0.0300 está en x/c=0.40.)

#### Tabla 4.5 (p.211) — LITERAL. Relaciones empíricas para la corrección de transición
*"Empirical Relations for Transition Correction [Schlichting and Gersten (2000)]"* — la A de la ec. (4.87).

| Re_x,tr | A |
|---|---|
| 300,000 | 1050 |
| 500,000 | **1700** |
| 1,000,000 | 3300 |
| 3,000,000 | 8700 |

Texto acompañante (p.211): *"The value A = 1700 represents the laminar correction for a transition Reynolds
number of Re_x,tr = 500,000."* Y: *"A good rule of thumb is to assume that if transition takes place at less than
10% of the length of the plate, then the laminar correction usually can be ignored, since it is relatively small."*

#### Tabla 4.6 (p.213) — LITERAL. Perfiles de velocidad del Ejemplo 4.4
Aire a 5 °C, presión estándar a nivel del mar, U∞ = 200 km/h = 55.556 m/s, en x_tr = 0.12344 m.

| y (m) | u_lam (m/s) | u_turb (m/s) |
|---|---|---|
| 0.00000 | 0.00 | 0.00 |
| 0.00017 | 17.78 | 36.21 |
| 0.00034 | 33.33 | 39.98 |
| 0.00067 | 52.50 | 44.14 |
| 0.00101 | *Inviscid flow* | 46.78 |
| 0.00134 | — | 48.74 |
| 0.00168 | — | 50.32 |
| 0.00201 | — | 51.64 |
| 0.00235 | — | 52.79 |
| 0.00268 | — | 53.81 |
| 0.00302 | — | 54.71 |
| 0.00335 | — | 55.56 |

#### Constantes empíricas de la capa turbulenta (p.202) — LITERAL
Para flujo incompresible sobre placa plana:
```
κ ≈ 0.40 ó 0.41
A ≈ 2.35
B ≈ 5.0 a 5.5
```
Límites de capa (§4.5.3, p.200–202 y Fig. 4.15):
- Borde de la subcapa laminar: y⁺ ≈ **5 a 10**
- Región totalmente turbulenta (ley log): **70 < y⁺ < 400**
- Región exterior (ley de defecto): y⁺ > **200**, contiene **80 a 90%** de δ
- y < **0.02δ**: *"the flow … is basically laminar"*
- Malla CFD: *"the computational grid should, therefore, contain points at a y⁺ of 5 or less"*

#### Precisión declarada de las correlaciones de fricción total (p.209) — LITERAL
| Relación | Precisión declarada |
|---|---|
| Prandtl, 0.074/Re_L^0.2 | *"only ±25% accurate"* |
| Prandtl-Schlichting (4.82) | *"±3% accurate"* |
| Karman-Schoenherr (4.83) | *"±2% accurate"* (implícita, requiere iterar) |
| Schultz-Grunow (4.84) | *"±7% accurate"* |

#### Dato de diseño: espesor máximo adherido, perfiles Joukowski (Fig. 4.10, p.188) — LITERAL
*"Thickest symmetrical Joukowski airfoils capable of supporting fully attached laminar and turbulent flows. The
angle of attack is 0°, and the Mach number is 0. For turbulent flow, transition is assumed to occur at the velocity
peak. The turbulent case is calculated for Re_c = 10⁷. Results for laminar flow are independent of Reynolds number.
Maximum thickness for laminar flow is about 4.6%, for turbulent flow, 31%. If displacement-thickness effects on
pressure distribution were included, the turbulent airfoil would increase to about 33%. The change in the laminar
case would be negligible [from Cebeci and Smith (1974)]."*

| Régimen | Espesor máx. con flujo totalmente adherido |
|---|---|
| Laminar (independiente de Re) | ~**4.6%** |
| Turbulento (Re_c = 10⁷) | ~**31%** |
| Turbulento incl. efecto de δ* sobre Cp | ~**33%** |

#### Caso computado de referencia (Fig. 4.16, p.205) — LITERAL
Código **TNSBLM** (laminar, transicional, turbulento), flujo incompresible sobre placa plana:
```
u_e = 114.1 ft/s     T_e = 542 °R     p_e = 2101.5 psf     T_w = 540 °R
```
Estaciones marcadas en la figura (Fig. 4.16b):
| x (m) | Estado |
|---|---|
| 0.165 | *near onset of transition* (γ_tr ≈ 0) |
| 0.228 | γ_tr = 0.6 |
| 0.320 | *near the end of transition* (γ_tr ≈ 1) |
| 1.223 | *well into the fully turbulent flow* |

En Fig. 4.16a se comparan cf = 0.664/Re_x^0.5 (laminar), cf = 0.0583/Re_x^0.2 (turbulento) y la solución TNSBLM.
El eje de ν_t/μ (Fig. 4.16b) va de 0.001 a 100.

#### Factores de forma H (p.214–215) — LITERAL
| Situación | H = δ*/θ |
|---|---|
| Perfil turbulento ley 1/7 (adherido, sin gradiente) | ≈ 1.3 (= (δ/8)/(7δ/72)) |
| Predicción "fairly reliable" de separación, Kroo (2007) | ≈ **2.2** |
| Rango usual de H en la separación (admisión del libro) | **1.8 a 2.8** |

#### Otros valores experimentales/numéricos sueltos citados
| Dato | Valor | Fuente en el libro |
|---|---|---|
| Pr del aire | ≈ 0.7 (0.738 calculado a 15 °C) | §4.8 p.216, Ej. 4.5 p.217 |
| δ*/δ laminar placa plana | ≈ 1/3 (1.72/5.0 = 0.344) | p.179 |
| θ/δ laminar placa plana | ≈ 13% (0.664/5.0 = 0.133) | p.180 |
| Efecto de la turbulencia sobre la viscosidad aparente | *"as if the viscosity were increased by a factor of 10 or more"* | §4.5 p.193 |
| Esfuerzo de Reynolds longitudinal vs normal (experimental) | *"the streamwise Reynolds stress component to be two to three times larger than the normal component"* — Smith (1991) | p.199 |
| Espesor de la capa turbulenta vs laminar en x_tr | 3.8× | Ej. 4.4 p.212 |
| Malla DNS 3D | ∝ Re^{9/4} | p.198 |
| DNS de avión completo a Re de vuelo | ~año 2080 | Spalart et al. (1997), p.199 |
| LES de avión completo a Re de vuelo | ~año 2045 | Spalart et al. (1997), p.199 |
| Conversión usada en Ej. 4.7 | 1.341 hp/kW | p.221 |

#### Rugosidad — NO HAY TABLA EN ESTE CAPÍTULO
El capítulo 4 menciona la rugosidad **cinco veces** y siempre CUALITATIVAMENTE:
- p.168: *"depends on many parameters (e.g., surface roughness, surface temperature, pressure gradient, and Mach number)"*
- p.189: lista de parámetros de transición, ítem 2 *"Surface roughness"*
- p.191: *"adverse pressure gradients, surface roughness, blowing at the surface, and free-stream turbulence promote transition"*
- p.192: *"Transition-promoting phenomena, such as an adverse pressure gradient and finite surface roughness, may short circuit the transition process … we term the cause (e.g., roughness) a by-pass mechanism."*
- p.202 y p.189: ν_t depende de rugosidad; generadores de vórtice / rugosidad superficial como forma de forzar transición (Fig. 4.11, A-4).
**No hay valores de k ni de k_s admisible ni tabla de acabados.** No la inventes. (Ese material está en Raymer y en
Schlichting; hay que buscarlo ahí, no aquí.)

---

---

## 4. DECISIONES HUMANAS — dónde el libro dice que juzga el ingeniero y el software NO debe decidir

### Caps. 1 y 5


Sitios donde el libro dice explícitamente que **juzga el ingeniero** y el software debe PREGUNTAR o
MOSTRAR opciones, nunca decidir en silencio:

1. **La posición de la transición.** [§5.4.4, p.256] "The engineer who must develop a transition
   criterion for design purposes usually uses the Reynolds number" — pero el propio libro demuele
   el valor único: 500,000 en túneles ruidosos, 2,800,000–3,400,000 en túneles silenciosos. Y
   ORDENA: *"A quick examination of the impact of varying the transition location should be
   conducted to ensure that a particular result is not highly dependent on an incorrect assumption
   about transition."* **El software NO debe elegir Re_tr; debe pedirlo y correr el barrido.**
2. **La corrección por rugosidad.** [§5.4.6, p.265] "In general, there is no straightforward method
   for correcting for surface roughness, so an empirical correction is often used, based on the
   actual flight test data of aircraft." Ni siquiera hay método: hay historia de la empresa. La
   Forja debe dejar al ingeniero meter SU factor (con el 6%–9% como sugerencia declarada).
3. **El remanente empírico del arrastre.** [§5.4.6, p.270] "It is probably more expedient to use an
   empirical correction for the remainder of the drag, which is often done at aircraft manufacturers
   based on historical data from previous aircraft." El Ejemplo 5.5 muestra al autor probando +10%
   y +15% y comparándolos con la banda de vuelo. Esa es la decisión, y es del humano.
4. **El factor de eficiencia de Oswald e.** [§5.5.2, p.283] rango 0.6–0.95, y "At high lift
   coefficients (near CLmax), e should be changed to account for increased form drag." No hay
   fórmula: hay criterio.
5. **Qué método de arrastre usar.** [§5.4.6, p.264] "Every aerodynamics group at each aircraft
   manufacturer has different methods for estimating subsonic aircraft drag." El libro entrega EL
   de Shevell como uno más. La Forja debe permitir enchufar el método de la casa.
6. **Cuándo la polar cuadrática deja de servir.** [§5.5.2, p.281] "In the case where these
   assumptions are not true, you may need to return to equation (5.45)." Volver al modelo de 3
   términos es una decisión del ingeniero, no un autoswitch.
7. **La geometría de referencia idealizada.** [§5.3 Ejemplo 5.2] "the complex shape of the actual
   wing is replaced by a swept, trapezoidal wing". Dónde termina el ala de referencia y dónde
   empieza el "glove" es un trazo humano. El CAD debe dejar dibujar la línea y RECORDAR que se
   dibujó.
8. **Elegir el espesor del perfil.** [§5.2.3, p.234] "We always need to consider the trade-offs in
   selecting a design value for a particular parameter in aerodynamics." Curvatura y espesor altos
   suben Clmax y bajan el Mach crítico. El software muestra el intercambio; no elige.
9. **Las restricciones no aerodinámicas.** [§5.5.1 Concept Box C-17] envergadura de estacionamiento,
   camiones de servicio bajo el ala, radio de curvatura de manufactura de 5000 in. El CAD debe
   admitir restricciones ARBITRARIAS del cliente y mostrarlas como muros en el espacio de diseño.
10. **La atmósfera del día.** [§1.2.4, p.22] T0 y B "vary from day to day". La atmósfera estándar
    sirve para COMPARAR, no para predecir un vuelo concreto.

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


1. **Validar experimentalmente toda simplificación** [p.34]: *"The validity of the simplifying approximations for a particular application should always be verified experimentally."* El software puede correr el modelo simplificado; no puede declarar que es válido.
2. **Elegir el umbral de incompresibilidad** [§2.4 p.46]: *"A gas flow is considered incompressible if the Mach number is less than 0.3 to 0.5, depending upon the application."* El rango 0.3–0.5 es criterio del ingeniero. El CAD debe exponerlo como parámetro con default y registro de quién lo movió, nunca hardcodearlo.
3. **Elegir la longitud característica L** [§2.5 p.60]: cuerda del ala, diámetro del misil, u otra. Cambia el Reynolds y por tanto el régimen. El software no debe adivinar: debe exigir la elección y estamparla en el reporte.
4. **Decidir si igualar exacto o igualar régimen** [§2.5 p.61]: *"it may not be significant for the Mach number to exactly match, but rather for the Mach number to fall within the same speed regime"*, y para Reynolds *"it may not be necessary to exactly match that Reynolds number, since the flow characteristics of boundary layer separation and skin friction may be well matched as long as the Reynolds number is relatively close."* "Relatively close" no tiene número en el libro: es juicio.
5. **La pregunta central del ensayo** [§2.5 p.55]: *"The question every aerodynamicist has to ask about wind tunnel testing is 'Are the results obtained meaningful for the full-scale aircraft configuration of interest?'"* El software presenta la evidencia; el ingeniero responde.
6. **Ponderar la lista de Bushnell** [§2.5 pp. 55–56]: paredes, aeroelasticidad, escalamiento de Re, perturbaciones de la corriente libre, montaje, no estacionariedad, propulsión instalada, fidelidad geométrica. El libro no da pesos ni fórmula de corrección; explícitamente los llama "modeling issues". El CAD debe mostrar la lista como checklist obligatorio y no puntuarla automáticamente.
7. **Aceptar la fidelidad geométrica** [§2.5 p.56]: *"geometric fidelity since there can be critical differences in results for even 'minor' differences in the model."* Qué detalle del CAD se puede borrar para fabricar el modelo es decisión humana.
8. **Acoplar no viscoso ↔ capa límite** [§2.6 p.63]: *"The process of determining the interaction of the solutions provided by the inviscid-flow equations with those for the boundary-layer equations requires a thorough understanding of the problem"* [Brune et al. (1974)]. La iteración de acoplamiento no es automática.
9. **Elegir el volumen de control** [nota previa a Prob. 2.10, p.78]: *"The integral equations of motion can be applied to either a rectangular control volume or a control volume bounded by streamlines."* Dos volúmenes distintos, misma respuesta física, distinto trabajo algebraico; el software puede ofrecer ambos pero la elección es del analista.
10. **Elegir el marco de referencia** [§2.1 p.36]: ambos observadores obtienen las mismas fuerzas "provided that the two observers apply the appropriate boundary conditions". La elección es de conveniencia matemática, y la responsabilidad de las condiciones de frontera es humana.
11. **Cuándo el segundo coeficiente de viscosidad importa** [§2.3 p.44]: "a few specialized problems, such as the analysis of the structure of a shockwave". El solver no debe activarlo solo.
12. **Aprobar el uso de ensayo en vuelo a escala en vez de túnel** [§2.5 p.63, McMasters (2007)]: la comparación 30×10⁶ vs 36×10⁶ es dato; decidir que "80 % del Reynolds" es suficiente para el programa es decisión de ingeniería y de presupuesto.

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
1. ¿MARCO DE REFERENCIA? (§3.2, p. 92)
   Ejes tierra o ejes vehículo. Bernoulli SOLO aplica en el marco donde el flujo es estacionario. El humano
   declara el marco; el CAD lo muestra y refuerza. Consecuencia si se elige mal: el Ejemplo 3.1 daría el
   resultado equivocado (U₃ = 25 en vez de 100 m/s).

2. ¿DÓNDE PONGO LAS TOMAS ESTÁTICAS? (§3.3, p. 93)
   "the pressure sensed at the static port may be significantly different from the free-stream static pressure,
    depending on the orientation of the aircraft". Decisión de INSTALACIÓN, no de física. El CAD puede sondear
   Cp en la superficie y sugerir la ubicación donde Cp ≈ 0 en el rango de α de crucero. El Problema 3.33
   (sonda de guiñada cilíndrica) formaliza esta decisión: ¿dónde hay que perforar para leer p∞?

3. ¿QUÉ FORMA? (§3.14, Figs 3.22-3.23, pp. 136-137)
   Fuselar de Cd=1.2 a Cd=0.12 a igual ancho, o encoger el cilindro ×10 para el mismo arrastre total. Es un
   trade-off de arquitectura (volumen interno, rigidez, fabricación) que el solver NO puede tomar. El dato que
   el CAD debe poner sobre la mesa: la tabla de Cd de la Fig 3.23.

4. ¿PROVOCO TRANSICIÓN A PROPÓSITO? (§3.13.3, p. 134)
   "it may be desirable to induce boundary-layer transition by roughening the surface. Examples … are the
    dimples on a golf ball or the seams on a baseball." Baja el form drag y sube (poco) el friccional. Decisión
   de diseño con penalización conocida solo cualitativamente en este capítulo.

5. ¿CUÁNTOS PANELES? (§3.16)
   El libro NO da criterio de convergencia de malla — usa M = 8 solo como demostración. La decisión de M (y del
   agrupamiento hacia bordes de ataque/salida) es HUMANA, guiada por un estudio de convergencia que La Forja
   debe ofrecer, no por una regla del libro. NO INVENTAR un "M mínimo recomendado por Bertin": no existe.

6. ¿CUÁNTA CIRCULACIÓN? (§3.15, p. 140)
   "The resulting irrotational flow about the cylinder is uniquely determined once the magnitude of the
    circulation around the body is specified." En el cap. 3 Γ es un PARÁMETRO LIBRE que el humano fija (o que un
   mecanismo físico —cilindro rotatorio, Problema 3.44— impone). La condición de Kutta que lo determina para un
   perfil llega en el cap. 6. Hasta entonces: deslizador de Γ, no un número calculado.

7. ¿CREO EL RESULTADO NO VISCOSO CERCA DE LA SEPARACIÓN? (§3.13.2, p. 130)
   La separación ocurre en barlovento, DONDE la teoría no viscosa aún predice gradiente favorable. El humano
   decide hasta qué θ (o hasta qué x/c) confía en el Cp potencial. Regla derivada del libro: hasta ~80° del
   remanso si la capa es laminar, hasta ~110-120° si es turbulenta (Achenbach).

8. ¿QUÉ ÁREA DE REFERENCIA? (§3.13.3 vs §3.17.1)
   Cilindro: 2R por unidad de vano (ec. 3.49/3.52). Esfera: πd²/4 (ec. 3.80). Placa/cuerpo fuselado en Fig 3.23:
   "height = d"/"thickness = d". Un Cd sin su área de referencia es basura. El CAD debe pedirla y estamparla en
   el reporte.

9. ¿ES EL CUERPO CERRADO O ABIERTO? (§3.12.6, Ejemplos 3.5/3.6)
   Semicuerpo de Rankine (fuente sola) = cuerpo ABIERTO, no tiene arrastre definido por integral cerrada. Óvalo
   (fuente+sumidero balanceados) = CERRADO. El humano elige qué está modelando; el solver solo puede AVISAR con
   Σκ ≠ 0.

10. ¿ACEPTO d = 0? (§3.13.3 / §3.15.2)
    El resultado d = 0 no es un bug: es la física del modelo. La decisión humana es si ese modelo basta (diseño
    conceptual de crucero, distribución de presión, sustentación) o si hay que ir a capa límite / CFD viscoso.
    El libro lo enmarca en la §3.1: el resultado no viscoso es la ENTRADA de la capa límite.
```

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


Estas NO las puede tomar el software solo. Cada una debe ser un input explícito, con default y con el rango
del libro visible en la UI.

1. **Re_x,tr — el número de Reynolds de transición.** El libro da 500,000 como *"a typical transition criterion"*
   para placa plana incompresible (4.39, p.191), pero la Tabla 4.5 (p.211) ofrece 300,000 / 500,000 / 1,000,000 /
   3,000,000 como valores operativos con su corrección A. La elección DEPENDE de: acabado superficial, turbulencia
   del túnel o de la atmósfera, gradiente de presión local, Mach, temperatura de pared y succión. Ninguno de esos
   seis lo conoce el CAD. **Debe ser un slider con las 4 filas de la Tabla 4.5 como presets y un campo libre.**
2. **Dónde poner x_tr en una geometría real.** El libro admite que el proceso ocupa una longitud finita
   comparable a la región laminar y que se colapsa a un punto *"for ease in making calculations and estimates"*
   (p.192). Modelar con salto (x_tr) o con intermitencia γ_tr (4.68) es una decisión de fidelidad vs. costo.
3. **Cuál correlación de Cf_tot turbulento usar.** El libro recomienda Prandtl-Schlichting (±3%) como default y
   desaconseja la de Prandtl (±25%). Pero Karman-Schoenherr es ±2% al precio de iterar. **Decisión de precisión
   vs. costo, con las tres barras de error visibles.**
4. **Definición del borde de la capa límite.** u = 0.99·u_e es *"somewhat arbitrary … but it is fairly standard"*
   (p.178). El 0.99 debe ser parámetro. Cambiarlo cambia δ (y por tanto el δ* efectivo del acoplamiento).
5. **Criterio de separación turbulenta.** H ≈ 2.2 (Kroo 2007) vs. el rango honesto 1.8–2.8 que declara el libro
   (p.215). El software debe mostrar una BANDA de riesgo, no un booleano "separa/no separa".
6. **Criterio de separación laminar en flujo NO similar.** β = −0.1988 vale para similitud. El libro advierte
   (p.187) que con variaciones grandes de β *"the non-similar character of the boundary layer should be taken
   into account when establishing a separation criterion."*
7. **Condiciones iniciales del método integral turbulento (§4.7.2, p.215).** Hay que especificar DOS de
   {θ, H, cf} en la estación de arranque. El libro no dice cuáles ni con qué valores. Es entrada del ingeniero.
8. **Modelo de turbulencia (si algún día se hace CFD).** *"the user should take care to ensure that the selected
   turbulence model has been calibrated using measurements from relevant flow fields"* (p.199). Y el aviso de
   Neumann: los modelos *"are not unique"*.
9. **Si se ignora o no la corrección laminar.** Regla del pulgar del libro: x_tr < 10% de L ⇒ ignorable (p.211).
   Es un umbral, no una ley.
10. **Si la aeronave puede permitirse laminar.** Fig. 4.10: 4.6% de espesor máximo laminar vs 31% turbulento. Un
    perfil "laminar" real (65-006) todavía separaría a α=0° si fuera 100% laminar. La decisión de perseguir flujo
    laminar es de programa, no de solver.
11. **S_ref de la aeronave.** La ec. (4.33)/(4.34) exige un S_ref ÚNICO para todo el sumador de drag. Elegirlo
    (ala de referencia, área expuesta, etc.) es decisión del ingeniero y contamina todos los coeficientes.

---


---

## 5. COSTO DE CÓMPUTO

`[NAVEGADOR]` = milisegundos, interactivo · `[PRECÓMPUTO]` = se calcula una vez en la GPU y se sirve
como tabla o campo · `[GPU-VIVO]` = exige un solver corriendo en iangpu.

### Caps. 1 y 5


| Método | Ecuaciones | Costo | Por qué |
|---|---|---|---|
| Atmósfera estándar analítica (T, p, ρ, μ, a vs z) | 1.10, 1.12, 1.14, 1.20, 1.21, 1.22 | **[NAVEGADOR]** | Aritmética cerrada, microsegundos. Ya vive en `src/aero/atmosfera.ts`. Debe ser síncrona y pura |
| Tabla 1.2A/1.2B como tabla de consulta con interpolación | — | **[NAVEGADOR]** | ~65 filas. Sirve como referencia contra el modelo analítico |
| He, Ps, aceleración, régimen de ascenso | 1.3, 1.5, 1.7 | **[NAVEGADOR]** | Una división por punto de vuelo |
| Medición geométrica del perfil (cuerda, línea de curvatura media, curvatura máx., espesor máx., radio de borde de ataque) sobre B-Rep OCCT | §5.2 | **[NAVEGADOR]** | Es consulta geométrica local. OJO: la línea de curvatura media exige proyección perpendicular a la cuerda -> intersecciones curva-recta, no muestreo vertical |
| Medición del ala (S, b, AR, λ, Λ en c/4 y en borde de ataque, mac por integración de c(y), diedro, torsión) | §5.3 | **[NAVEGADOR]** | Integrales 1D sobre la envergadura. Cientos de estaciones bastan |
| mac por fórmula cerrada trapezoidal | 5.35 | **[NAVEGADOR]** | Aritmética. Sirve de verificación cruzada de la integración |
| Áreas mojadas por las aproximaciones de Kroo | 5.38, 5.39, 5.40 | **[NAVEGADOR]** | Aritmética |
| Área mojada EXACTA por integración de superficie OCCT | — [EXTENSIÓN DECLARADA] | **[NAVEGADOR]** | El libro sólo da las aproximaciones, pero el Ejemplo 5.5 PIDE explícitamente "a better representation of the aircraft surfaces, such as from a CAD geometry". Es nuestra ventaja competitiva y se marca como extensión |
| Cf de placa plana (local y total, laminar/turbulento/mixto) | 5.24, 5.25, 5.27, 5.28, 5.29, 5.37 | **[NAVEGADOR]** | Aritmética |
| Método completo de arrastre parásito de Shevell (todos los componentes) | 5.34 + Figs. 5.21/5.23 | **[NAVEGADOR]** | El propio libro dice que "can be used easily on a spreadsheet". Los factores de forma K se sirven como TABLA digitalizada de las figuras |
| Barrido de sensibilidad de la posición de transición | 5.37 con Re_tr variable | **[NAVEGADOR]** | ~20 evaluaciones del método completo. Sigue siendo interactivo, y es OBLIGATORIO por §5.4.4 |
| Polar CD = CD0 + kCL² + ΔCDM y sus derivados (L/D, Dp, Di) | 5.43–5.49 | **[NAVEGADOR]** | La tabla completa del Ejemplo 5.7 son 18 filas de aritmética |
| Pendiente de sustentación 3D ideal | 5.41 | **[NAVEGADOR]** | Una división |
| Tabla de factores de forma K digitalizada de las Figs. 5.21 y 5.23 | — | **[PRECÓMPUTO]** | Las figuras no son legibles en el txt: hay que digitalizarlas UNA VEZ del PDF/fuente y servirlas como tabla 2D (t/c × Λc/4) y 1D (finura L/D). Hasta entonces sólo tenemos los puntos que usa el Ejemplo 5.5 |
| Curvas de sustentación por Mach del F-16 (Fig. 5.27) y polares medidas | — | **[PRECÓMPUTO]** | Datos de figura, se sirven digitalizados |
| Integración de las distribuciones de Cp de la Tabla 5.6 para sacar Cl y Cm,c/4 | Problemas 5.12, 5.13 | **[NAVEGADOR]** | 55 puntos, regla del trapecio |
| Barrido de diseño (AR × λ × Λ × t/c) evaluando CD0 y L/D en toda la malla | — | **[PRECÓMPUTO]** | Miles de combinaciones × método completo. Se precomputa en la GPU y se sirve como campo navegable; ESO es "conceptual design" al estilo Raymer |

Nada de este bloque exige **[GPU-VIVO]**: cap 1 y cap 5 son cierre analítico y correlaciones. El
solver que sí lo pediría (paneles 3D, capa límite acoplada, CFD) vive en otros capítulos.

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


| método | costo | por qué |
|---|---|---|
| Chequeo de continuidad ∇·V = 0 sobre un campo dado, eq. (2.3) [Ej. 2.1] | [NAVEGADOR] | Derivadas simbólicas o diferencias finitas sobre una malla chica; microsegundos. Es el gate barato que el libro pide correr ANTES de analizar nada. |
| Perfil de Poiseuille y su cortante, §2.4.1 | [NAVEGADOR] | Solución cerrada: una parábola y una recta. Interactivo con slider de dp/dx. |
| Perfil de Couette u/U = y/h + P(y/h)(1-y/h), §2.4.2 | [NAVEGADOR] | Cerrada, un solo parámetro P. La familia completa de Fig. 2.10 (P = -3..3) se dibuja en un frame. |
| Q/d, V̄ e y_max de Couette [Ej. 2.3] | [NAVEGADOR] | Tres fórmulas algebraicas. |
| Mach por eq. (2.19) y Reynolds por eq. (2.20) desde (altitud, V, L) [Ej. 2.5, 2.6] | [NAVEGADOR] | Dos divisiones más una consulta a la tabla atmosférica en memoria. |
| Clasificador de régimen contra Tablas 2.1 y 2.2 | [NAVEGADOR] | Búsqueda en 5 intervalos. Debe correr en vivo mientras el usuario mueve altitud/velocidad. |
| Arrastre por déficit de momento en la estela [Ej. 2.4, Probs. 2.27–2.31] | [NAVEGADOR] | Dos integrales 1D sobre perfiles medidos/analíticos. Milisegundos incluso con 10⁴ puntos. |
| Bernoulli / energía integral 1D en un tubo [Ej. 2.7] | [NAVEGADOR] | Álgebra pura una vez conocidas las áreas. |
| Carta Re–M–altitud tipo Fig. 2.13 (isolíneas de Re y de M sobre el plano velocidad×altitud) | [PRECÓMPUTO] | Malla de ~300×300 evaluaciones de la atmósfera estándar; se calcula una vez y se sirve como campo/textura. No tiene sentido recalcularla por frame. |
| Buscador de condiciones de túnel que igualan Re y M simultáneamente (resolver p0, T0, escala) | [PRECÓMPUTO] | Barrido 3D del espacio de operación del túnel; el resultado es una tabla de factibilidad que se consulta en el navegador. |
| Solución de capa límite + espesor de desplazamiento y generación del "cuerpo efectivo" §2.6 | [PRECÓMPUTO] | Marcha aguas abajo por estación; segundos a decenas de segundos. Se cachea por geometría + (Re, M) y se sirve como offset de la superficie al kernel OCCT. |
| Iteración de acoplamiento no viscoso ↔ capa límite [Brune et al. (1974)] | [PRECÓMPUTO] | Varias pasadas del par (panel/Euler + BL). Resumible, cacheable por configuración. |
| Navier-Stokes completas 3D no estacionarias, eqs. (2.12a-c) con μ = μ(T) | [GPU-VIVO] | Es el sistema completo, 5 incógnitas acopladas; exige solver corriendo, no cabe en una tabla. |
| Ecuación de energía compresible eq. (2.32a) con función de disipación (2.32b), acoplada a continuidad y momento | [GPU-VIVO] | El libro es explícito: en flujo compresible las tres se resuelven SIMULTÁNEAMENTE (§2.7 p.66). |
| Poiseuille/Couette resueltos numéricamente por Navier-Stokes (como test de verificación del solver) | [GPU-VIVO] | Solo se justifica como validación: el resultado exacto ya se conoce, y sirve para medir el error del solver. |

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


| método | costo | por qué |
|---|---|---|
| Bernoulli (3.9)/(3.10), Cp (3.12)/(3.13), Pitot U∞, cadena IAS→CAS→EAS→TAS, Tabla 3.1 | **[NAVEGADOR]** (<1 ms) | Aritmética escalar. Cero estado. Se recalcula a cada frame de un deslizador. |
| Evaluación de un flujo elemental (Tabla 3.3) en un punto: φ, ψ, u, v | **[NAVEGADOR]** (<1 µs) | Forma cerrada: 1 log/1 atan2/1 división. |
| Superposición de N ≤ 100 singularidades sobre una malla de 256×256 (65 k puntos) | **[NAVEGADOR]** (~10–60 ms) | 6.5 M evaluaciones triviales. Vectorizable en un `Float32Array`. Interactivo con deslizadores. |
| Superposición sobre malla 4K (8.3 M puntos) para render de video | **[PRECÓMPUTO]** | 8.3 M × N evaluaciones por frame. Se precalcula el campo una vez a `.bin` y se sirve como textura. |
| Integración de líneas de corriente RK4 (100 semillas × 500 pasos) | **[NAVEGADOR]** (~5–20 ms) | 50 k evaluaciones del campo. Ya existe el patrón en `src/aero/potencial.ts` (`integrateStreamline`). |
| Cilindro con/sin circulación: (3.41)–(3.44), (3.56)–(3.61), remansos, Cl, Cd | **[NAVEGADOR]** (<1 ms) | Todo analítico. Los integrales de (3.48)/(3.52) se hacen con 720 muestras trapezoidales: microsegundos. |
| Esfera axisimétrica (3.74)–(3.80) | **[NAVEGADOR]** (<1 ms) | Analítico. |
| Circulación numérica ∮V·ds sobre un contorno de 360 puntos (verificación de Kelvin/Stokes) | **[NAVEGADOR]** (<1 ms) | Ya existe `circulationIntegral()`. |
| **Paneles de fuente (§3.16): ensamble de A (M×M) con cuadratura Gauss 8-pt** | **[NAVEGADOR]** para M ≤ ~400 (~10–80 ms) | M² × 8 evaluaciones. M=200 ⇒ 320 k evaluaciones. Interactivo. |
| **Paneles de fuente: solución LU de A·κ = b** | **[NAVEGADOR]** para M ≤ ~400 (M³/3 ≈ 2×10⁷ flops ⇒ ~30 ms) | Denso, no simétrico. Por encima de M ≈ 800 pasa a **[PRECÓMPUTO]** o WebGPU. |
| Paneles con M ≥ 2000 (configuración completa tipo Hess & Smith) | **[PRECÓMPUTO]** | M³/3 ≈ 2.7×10⁹ flops + M² memoria (32 MB). Fuera de presupuesto de frame; se resuelve una vez por geometría. |
| Barrido paramétrico de forma (p.ej. 500 variantes × M=200 paneles) | **[PRECÓMPUTO]** | 500 × 30 ms ≈ 15 s. Se corre en GPU/servidor y se sirve como superficie de respuesta. |
| Campo de velocidad del panelado sobre malla de visualización (M paneles × 65 k puntos) | **[NAVEGADOR]** si M ≤ 100; si no **[PRECÓMPUTO]** | M=100 ⇒ 6.5 M evaluaciones con log+atan2 ≈ 200 ms. Cachear como textura. |
| Curvas Cd(Re) y θ_separación(Re) de las Figs 3.19/3.21/3.31 | **[PRECÓMPUTO]** (tabla estática) | Son DATOS EXPERIMENTALES, no cálculo. Se sirven como tabla con SOLO los anclajes literales del texto. Ver NO-OBSERVADO: las curvas completas no son legibles. |
| Separación, estela, arrastre de forma REAL (lo que la §3.13.2 solo describe) | **[GPU-VIVO]** | Exige Navier-Stokes o al menos acoplamiento no viscoso↔capa límite (cap. 4-5). Fuera del alcance del cap. 3. |

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


| Método | Costo | Por qué |
|---|---|---|
| Correlaciones de placa plana laminares (4.21)(4.23)(4.27)(4.29)(4.32) | **[NAVEGADOR]** | Una raíz cuadrada por estación. Se recalculan a 60 fps mientras el usuario arrastra la cuerda del ala. |
| Correlaciones de placa plana turbulentas (4.79)(4.80)(4.81)(4.82)(4.84)(4.87) | **[NAVEGADOR]** | Potencias y logaritmos, cerradas. Triviales. |
| Karman-Schoenherr (4.83) | **[NAVEGADOR]** | Implícita pero converge en ~4 iteraciones de punto fijo / Newton. Microsegundos. |
| Sumador de drag por componentes: C_D = ΣCf_tot,i·S_wet,i/S_ref (4.33)(4.34) | **[NAVEGADOR]** | Suma sobre ~20 componentes; el costo real es sacar S_wet del B-Rep (que ya es una consulta OCCT existente). |
| Método de la placa plana con transición (4.85)(4.86)(4.87) | **[NAVEGADOR]** | Dos integrales cerradas / tres evaluaciones. |
| Tablas 4.1/4.2/4.3 como LUT (perfiles de similitud, f''(0) vs β) | **[NAVEGADOR]** | Son 6 columnas × ~30 filas. Interpolar es gratis. **Empaquetar como constantes del bundle, NO recalcular.** |
| Resolver Falkner-Skan (4.16) para un β arbitrario (shooting sobre f''(0)) | **[NAVEGADOR]** | EDO de 3er orden, RK4 con ~500 pasos en η ∈ [0,10], shooting de ~10 iteraciones. Milisegundos. Solo si se necesita un β fuera de los 6 tabulados. |
| Marcha del método integral de momento (4.88)+(4.90..4.95) sobre un perfil | **[NAVEGADOR]** | Sistema de 2 EDOs marchando en x con ~200 estaciones por superficie. Milisegundos por perfil. Es EL método que corresponde al diseño conceptual. |
| Barrido de β(x) de un perfil desde Cp (Ejemplo 4.3): integral acumulada + derivada numérica de Cp | **[NAVEGADOR]** | Una pasada sobre los puntos del panel. |
| Acoplamiento iterativo viscoso/no-viscoso (paneles ↔ δ*) | **[NAVEGADOR]** para 2D con ~200 paneles y 3–5 iteraciones; **[PRECÓMPUTO]** si se hace barrido de α × Re × Mach para llenar una polar | Cada iteración es un solve de paneles (O(N²) o O(N³) con LU). 200 paneles = instantáneo; una polar de 30 α × 8 Re ya conviene precomputarla en background. |
| Modelo algebraico de viscosidad turbulenta (4.63)–(4.69) resolviendo el perfil u(y) por diferencias finitas | **[PRECÓMPUTO]** | Marcha en x con ~100 puntos en y por estación, iterando ν_t hasta convergencia. Segundos por caso. Se cachea por (Re, β, x_tr). |
| Tablas de Cf_tot vs Re_L × Re_x,tr (la Fig. 4.19 propia de La Forja) | **[PRECÓMPUTO]** | Una vez, se sirve como LUT/imagen. Re_L de 10⁴ a 10¹⁰. |
| Visualización del perfil u⁺ vs y⁺ con las tres leyes superpuestas (Fig. 4.15) | **[GPU-VIVO]** | Es la vista pedagógica: 3 curvas + regiones sombreadas, ejes log. Shader o canvas; se anima con Re_θ como parámetro. |
| Campo de δ, δ*, θ pintado sobre la superficie 3D del avión (mapa de color en el B-Rep) | **[GPU-VIVO]** | Evaluación por-fragmento de una correlación cerrada usando la coordenada de superficie. Barato en GPU, caro en CPU si son 10⁵ triángulos. |
| Animación del proceso de transición (7 regiones, ondas T-S → manchas turbulentas, Fig. 4.12) | **[GPU-VIVO]** | Es cine/ilustración, no física: shader determinista en t. |
| DNS | **PROHIBIDO** | Malla ∝ Re^{9/4}; el propio libro dice que no será viable para avión completo hasta ~2080. |
| LES | **PROHIBIDO** | ~2045 según Spalart et al. (1997). |
| RANS con Spalart-Allmaras | Fuera de alcance del navegador; sería servicio externo | El capítulo lo describe pero La Forja es diseño conceptual: el método integral cubre el caso de uso. |

---


---

## 6. ESCUELA — lecciones de este bloque

Formato de cada lección: **construir → mover → ver → verificar contra el número del libro.**
La escuela vive DENTRO del CAD (`forja-brep.html`): el alumno DIBUJA la geometría con croquis y
cotas y la analiza con un estudio. No es un simulador de juguete aparte.

### Caps. 1 y 5


**L1 — "El B-52 le gana al F-5" (de §1.1)**
- CONSTRUIR: nada geométrico todavía; una ficha de dos aviones con W, V, h.
- MOVER: la altitud y la velocidad de cada uno.
- VER: el marcador de energía TOTAL diciendo "B-52 gana 37.5 a 1" y, al cambiar a energía
  ESPECÍFICA, el marcador cayendo a 1:1 exacto. Después, al meter T y D, Ps separándolos otra vez.
- VERIFICAR: E_B52 = 1.0248e10 ft·lbf, E_F5 = 2.7329e8 ft·lbf, He = 22,774 ft ambos,
  Ps_F5 = 63.38 ft/s, ROC = 3,802.8 ft/min. [Ejemplos 1.1, 1.2, 1.3]
- LECCIÓN: la magnitud que eliges DECIDE la respuesta. Es la lección de diseño conceptual entera.

**L2 — "El aire que vas a usar toda tu carrera" (de §1.2)**
- CONSTRUIR: nada; un panel de atmósfera dentro del CAD.
- MOVER: la altitud, de 0 a 30 km.
- VER: T, p, ρ, μ, a variando; la curva de temperatura QUEBRÁNDOSE en 11 km (fin de la región
  gradiente) y la de presión sin quebrarse; el error entre el modelo analítico y la tabla oficial
  dibujado como una banda.
- VERIFICAR: a 10 km, T = 223.15 K vs 223.252 K tabulada; p = 2.641e4 vs 2.650e4 N/m².
  [Ejemplo 1.9]
- LECCIÓN: un modelo se juzga contra el dato, y la diferencia se DECLARA, no se esconde.

**L3 — "Dibuja el perfil, deja que el CAD lo mida" (de §5.2)**
- CONSTRUIR: el alumno dibuja con croquis y cotas un perfil cerrado (o lo genera con la
  nomenclatura NACA de 4 dígitos).
- MOVER: la posición y magnitud de la curvatura máxima, el espesor máximo y su estación, el radio
  de borde de ataque.
- VER: el kernel OCCT MIDIENDO de vuelta cuerda, línea de curvatura media (¡perpendicular a la
  cuerda!), curvatura máx., espesor máx. y radio de borde de ataque, y la etiqueta NACA que le
  corresponde apareciendo sola.
- VERIFICAR: dibujar un NACA 4412 y comprobar que el CAD reporta 12% de espesor, 4% de curvatura al
  40% de la cuerda. Dibujar la familia 2408→2424 y comprobar que el óptimo de Clmax cae en 12%
  (1.70). [§5.2.1, §5.2.4 tabla p.235]
- LECCIÓN: las cotas NO se teclean, se MIDEN de la geometría. Es la doctrina de croquis del
  proyecto aplicada a aerodinámica.

**L4 — "El ala: cinco parámetros y una integral" (de §5.3)**
- CONSTRUIR: un ala trapezoidal por croquis (cr, ct, b, Λ) y luego el ala del Orbiter con su glove.
- MOVER: λ de 1.0 a 0.0 y Λ de 0° a 60°.
- VER: AR, S, mac y la posición en envergadura de la mac actualizándose en vivo; el ala trapezoidal
  y la real dando MAC distintas.
- VERIFICAR: Orbiter con cr=57.44, ct=11.48, b=78.056 ft → S=2690 ft², AR=2.265, λ=0.20,
  mac=39.57 ft por integración Y por la fórmula 5.35. Delta de Λ_LE=60° → AR=2.309 por la ec. 5.1.
  [Ejemplos 5.1, 5.2]
- LECCIÓN: la mac es una INTEGRAL de la geometría, no un promedio. Y hay una fórmula cerrada que
  sólo vale para trapecios: usarla fuera de ahí es el primer error del principiante.

**L5 — "¿Dónde empieza la turbulencia?" (de §5.4.4)**
- CONSTRUIR: una placa plana / un perfil.
- MOVER: el Reynolds de transición de 5×10⁵ a 3.4×10⁶ (los valores REALES medidos en túneles).
- VER: el arrastre de fricción saltando; la extensión laminar acortándose o alargándose sobre la
  cuerda.
- VERIFICAR: a Rex = 1.242e6, cf laminar = 5.959e-4 (τ=0.708 N/m²) vs cf turbulento = 3.522e-3
  (τ=4.185 N/m²), casi seis veces. [Ejemplo 5.4]
- LECCIÓN: la suposición de transición es la decisión con más apalancamiento del cálculo de
  arrastre, y el libro EXIGE barrerla. Un número que el alumno debe aprender a desconfiar.

**L6 — "Estima el arrastre del F-16 y compáralo con vuelo real" (de §5.4.6) — LA CLASE ESTRELLA**
- CONSTRUIR: el F-16 aproximado por sólidos simples dentro del CAD (cilindros, conos, superficies
  tipo ala), tal como la Fig. 5.25.
- MOVER: la altitud, el Mach, y la calidad del acabado superficial (metal pulido → pintura de serie
  → galvanizado).
- VER: el desglose de CD0 componente por componente (barras), el área mojada total contra la real,
  y la BANDA de vuelo del F-16 (0.0160–0.0190) dibujada como zona objetivo.
- VERIFICAR, en cadena: mac = 9.800 ft → ReL = 11.18e6 → Cf = 0.00280 → CD0_ala = 0.00415;
  fuselaje CD0 = 0.00524; total liso 0.01300; corregido por área 0.01370; con +10%/+15%
  0.0151/0.0158; vuelo real 0.0160–0.0190. [Ejemplo 5.5]
- LECCIÓN: un método simple bien aplicado llega a un 10–20% del vuelo real. Y el error residual
  tiene NOMBRE: excrecencias, interferencia, base. **Además, aquí el alumno descubre por qué existe
  este producto: el propio libro dice que su estimación mejoraría "with a better representation of
  the aircraft surfaces, such as from a CAD geometry".**

**L7 — "La polar y el punto donde todo se equilibra" (de §5.5)**
- CONSTRUIR: reusar el F-16 de L6; introducir W, S, AR, e.
- MOVER: el Mach, de 0.1 a 1.8.
- VER: las dos curvas (parásito subiendo con V², inducido bajando con 1/V²) CRUZÁNDOSE, la suma
  con su mínimo, y L/D con su máximo EN EL MISMO PUNTO. El primer renglón (M=0.10, CL=11.6)
  marcado en rojo como inalcanzable.
- VERIFICAR: k = 1/(π·0.9084·3) = 0.1168; mínimo de arrastre en M ≈ 0.52 con Dp = Di;
  CL(L/D)max = √(CD0/k) = 0.4220 y (L/D)max = 1/(2√(k·CD0)) = 10.14; la tabla del libro da
  L/D = 10.0968 en M=0.50. [Ejemplo 5.7 + Problema 5.3]
- LECCIÓN: "parásito = inducido" no es una coincidencia, es la condición de óptimo. Y una tabla que
  produce CL = 11.6 no es un error del programa: es un punto de vuelo que no existe.

**L8 — "Del Cp medido al coeficiente" (de §5.5, Tabla 5.6)**
- CONSTRUIR: el perfil NACA 4412 en el croquis.
- MOVER: nada; cargar los tres ángulos de ataque medidos por Pinkerton (1936).
- VER: las tres distribuciones de Cp dibujadas SOBRE la geometría real; el pico de succión creciendo
  hasta Cp = −6.230 a α=16°; el punto de remanso moviéndose.
- VERIFICAR: integrar la Tabla 5.6 (55 estaciones) para obtener Cl a α=−4° y α=+2°, sacar
  Clα = dCl/dα, y comprobar si el punto de α=16° cae sobre la recta (**no cae — y esa es la
  pregunta del libro: "If not, why not?"**). Integrar también Cm respecto a c/4 sustituyendo x por
  (x − 0.25c). [Problemas 5.10–5.13]
- LECCIÓN: el coeficiente sale de una integral de presiones REALES, y la linealidad se acaba justo
  donde empieza la separación. Además: usar el ángulo EFECTIVO, no el físico.

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


**L2.1 — "¿Este flujo puede existir?" (el gate de continuidad)**
Construye: en el CAD, un campo de velocidad 2D escrito a mano (u, v como expresiones). Mueve: los coeficientes del campo. Ve: el mapa de |∇·V| en color; si no es cero en todos lados, el CAD se niega a seguir. Verifica: con u = 2x, v = -2y el residual es exactamente 0 [Ej. 2.1, §2.2 p.38]. Prueba negativa obligatoria: cambia v a -3y y observa que el residual pasa a -1 y el gate FALLA.

**L2.2 — "El borde de la capa límite no es una línea de corriente"**
Construye: placa plana con perfil u = U∞(y/δ)^(1/7) y δ(x) creciente. Mueve: la pendiente dδ/dx. Ve: vectores de velocidad cruzando la línea horizontal y = ε, y la línea de corriente real separándose de ella. Verifica: v_e = (U∞/8)(ε/δ)^(8/7) dδ/dx ≠ 0 [Ej. 2.2, §2.2 p.39]. Consecuencia que el alumno debe enunciar: por eso un volumen de control rectangular tiene gasto Q2 saliendo por arriba.

**L2.3 — "El canal: Poiseuille"**
Construye: dos placas planas paralelas separadas h en el modelador. Mueve: dp/dx y h. Ve: el perfil parabólico deformarse y las flechas de cortante en las dos paredes. Verifica: τ = y·dp/dx, y que |τ_pared| = (h/2)|dp/dx| en ambas paredes, con ambas apuntando aguas abajo [§2.4.1 p.49]. Gancho: el alumno tiene que explicar por qué el signo de τ_u es negativo y la fuerza no lo es.

**L2.4 — "Couette y el flujo que se devuelve"**
Construye: el mismo canal, pero la placa superior se mueve a U. Mueve: el gradiente adimensional P de -3 a +3 (barrido de Fig. 2.10). Ve: el perfil pasar de lineal (P=0) a abultado (P>0) a **reversado** (P<0, back flow). Verifica, con U = 2 m/s, h = 0.1 m, P = 1: Q/d = 4/30 m²/s, V̄ = 4/3 m/s = (2/3)U, y_max = 0.1 m [Ej. 2.3, §2.4.2 pp. 51-52]. Pregunta de cierre: ¿a partir de qué P aparece el flujo reversado en la pared inferior?

**L2.5 — "Pesar el arrastre sin tocar el ala" (volumen de control)**
Construye: un volumen de control rectangular alrededor de una placa plana de cuerda c, con perfil de estela u = U∞(y/δ)^(1/7). Mueve: δ/c. Ve: el déficit de momento en la estela y el gasto que escapa por la cara superior. Verifica: Q2 = (1/8)U∞δ, d = (7/36)ρU∞²δ, y **Cd = 0.00389 para δ = 0.01c** [Ej. 2.4, §2.4.3 p.55]. Extensión: Cd = (7/18)(δ/c) es lineal — que el alumno lo prediga antes de mover el slider. Ejercicios hermanos con otros perfiles de estela: Probs. 2.27 a 2.31 (perfiles triangular y cosenoidal, volumen rectangular vs limitado por líneas de corriente).

**L2.6 — "Tu avión y su gemelo del túnel"**
Construye: una configuración en el CAD, define altitud y velocidad de crucero. Mueve: la escala del modelo y las condiciones del túnel. Ve: dos puntos sobre la carta Re–M (estilo Fig. 2.13) que casi nunca se pueden juntar. Verifica: M∞ = U∞/a∞ = 1.6 para 472 m/s a 14 km, y que a 19 km el Mach NO cambia (capa isotérmica 11–21 km) [Ej. 2.5, §2.5 p.60]; y Re = 5.3560×10⁷ para M=2, 40,000 ft, L=14 ft [Ej. 2.6, §2.5 p.61]. Cierre obligatorio: el alumno declara cuál de los dos parámetros sacrifica y por qué.

**L2.7 — "El caso 767 contra el caso Ames"**
Construye: nada nuevo; usa L2.6 con dos escenarios. Mueve: escala 1/4 y altitud baja. Ve: Re del modelo libre ≈ 30×10⁶ contra 36×10⁶ del 767 a M=0.95 y 12,000 m (MAC ≈ 6 m), >80 %. Y el túnel 80×120 ft de NASA Ames topado en ~100 nudos, con seis ventiladores de 40 ft y 18,000 hp cada uno. Verifica: contra los números literales de §2.5 p.63. Conclusión que el alumno escribe: por qué el túnel más grande del mundo no puede igualar el Mach de un jet de línea.

**L2.8 — "El régimen manda"**
Construye: un slider de M y otro de Re_L. Mueve: ambos. Ve: la etiqueta del régimen cambiar y con ella la lista de fenómenos esperados. Verifica: contra Tabla 2.1 (incompresible / compresible subsónico / transónico / supersónico / hipersónico con sus fronteras 0.3, 0.8, 1.6, 5.0) y Tabla 2.2 (creep / laminar bajo Re / laminar / transicional / turbulento con fronteras 10², 10⁴, 10⁵, 10⁶) [§2.5 pp. 61-62]. El alumno debe poder recitar qué fenómeno aparece en cada casilla.

**L2.9 — "El cuerpo efectivo"**
Construye: un perfil en el kernel OCCT. Mueve: el Reynolds. Ve: la superficie desplazada (geometría + espesor de desplazamiento) crecer y la distribución de presión no viscosa casi no moverse. Verifica: ∂p/∂y ≈ 0 comparando presión de pared contra presión de borde [§2.6 p.65]; y el alumno debe nombrar la condición donde eso falla: capa turbulenta con Mach de borde ≈ 20 [Bushnell et al. (1977)].

**L2.10 — "Bernoulli no es una ley, es un caso particular"**
Construye: el tubo curvo de la Fig. 2.18 (D1 = 5 cm, D2 = 2 cm, desnivel 30 cm). Mueve: el gasto. Ve: los tres términos (cinético, potencial, de flujo) como barras que se compensan. Verifica: con Q = 0.001π m³/s → V2 = 10 m/s, V1 = 1.6 m/s, p1 = 4.58×10⁴ N/m² **manométrica** [Ej. 2.7, §2.9.6 p.75]. Cierre: el alumno tacha una por una las hipótesis (estacionario, no viscoso, 1D, incompresible, ue constante, sin trabajo de eje ni viscoso, sin calor) y dice qué término reaparece al quitarla.

**L2.11 — "¿Se te va a calentar el morro?"**
Construye: dos casos de vuelo. Mueve: velocidad y altitud. Ve: Tt vs T∞ contra el borde de ataque. Verifica: Ht = h∞ + ½U∞² con cp = 0.2404 Btu/lbm·R, para un Cessna 172 a 130 mi/h y 10,000 ft, y para un SR-71 a Mach 3 y 80,000 ft [Probs. 2.38 y 2.39, pp. 86-87]. El libro no publica la respuesta: la lección la genera y la marca como resultado del alumno, no del libro.

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
════════════════════════════════════════════════════════════════════════════════════
L3.1 — "LOS CINCO CANDADOS DE BERNOULLI"                         [§3.2 pp. 90-92 · Ej. 3.1]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: nada de geometría. Un banco de sondas: el alumno coloca 5 puntos sobre el campo de un perfil ya
   dibujado (marco tierra ↔ marco vehículo con un interruptor).
 MUEVE: el interruptor de marco de referencia; U_perfil (0-100 m/s); altitud (0-11 km); un interruptor
   "punto dentro de la capa límite" por sonda.
 DEBE VER PASAR: con el marco TIERRA activo, el panel de los 5 candados marca "3. Steady" en ROJO y la sonda se
   niega a dar un número. Al conmutar a marco vehículo, se pone verde y aparecen p₁, p₂, p₃.
 SE VERIFICA CONTRA: FIXTURE bertin-ej-3.1 → p₁ = 79,501 N/m², p₂ = 82,332 N/m², p₃ = 77,299 N/m² (±1 N/m²).
 GATE EXTRA (Problema 3.5, p. 153): las sondas 4 y 5 (dentro de capa límite laminar y turbulenta) deben
   RECHAZAR el cálculo de velocidad; las 3 y 6 (justo fuera) deben aceptarlo.

════════════════════════════════════════════════════════════════════════════════════
L3.2 — "EL TÚNEL DE VIENTO DE SECCIÓN ABIERTA"                   [§3.4 pp. 97-99 · Ej. 3.2]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: croquis del túnel (tobera convergente + sección de prueba abierta) con cotas; 4 orificios como
   entidades acotadas sobre las paredes y sobre el modelo cilíndrico.
 MUEVE: el barómetro del cuarto (28-31 in Hg); la lectura del orificio 3 (in H₂O, gage); Cp del punto 4.
 DEBE VER PASAR: la cadena completa de unidades in Hg → lbf/ft² → slug/ft³ → ft/s, con CADA conversión visible
   (es la parte que reprueba a los alumnos, no la física). Y que q∞ ES exactamente la lectura manométrica de la
   sonda de remanso.
 SE VERIFICA CONTRA: FIXTURE bertin-ej-3.2 → p_room = 2086.51 lbf/ft², ρ∞ = 0.00234 slug/ft³, q∞ = 10.387
   lbf/ft², U∞ = 94.22 ft/s, p₄ = 2074.05 lbf/ft², U₄ = 139.75 ft/s (±0.5%).

════════════════════════════════════════════════════════════════════════════════════
L3.3 — "LA ESQUINA DE 90°: DIBUJA UNA PARED CON MATEMÁTICAS"     [§3.10 pp. 110-111 · Ej. 3.3]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: nada — este es el que ENSEÑA a leer ψ y φ. El alumno teclea A en ψ = A·x·y.
 MUEVE: A; y arrastra dos sondas sobre la MISMA línea de corriente ψ = 2.
 DEBE VER PASAR: (a) que ψ = 0 son los EJES y que por lo tanto puede declararlos pared sólida (el momento
   "ajá" del método inverso); (b) que donde las líneas se APRIETAN la velocidad SUBE (Q = Δψ constante);
   (c) que la malla φ/ψ es ortogonal EN TODAS PARTES salvo en el origen (punto de remanso).
 SE VERIFICA CONTRA: FIXTURE bertin-ej-3.3 → |V|(1,1) = 2.8284 y |V|(2, ½) = 4.1231 (exacto); φ = x² − y².

════════════════════════════════════════════════════════════════════════════════════
L3.4 — "EL CATÁLOGO: CUATRO LADRILLOS Y UNA SUMA"                [§3.11-3.12 pp. 112-126 · Tabla 3.3 · Ejs. 3.4/3.5/3.6]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: el alumno ARRASTRA singularidades al lienzo (uniforme, fuente, sumidero, doblete, vórtice) y La
   Forja convierte la línea de corriente de remanso en una CURVA DE CROQUIS acotable — es decir, el flujo
   GENERA la geometría (método inverso de Rankine 1871).
 MUEVE: K, B, Γ, U∞, posición de cada singularidad, α del flujo uniforme.
 DEBE VER PASAR:
   · uniforme + fuente ⇒ SEMICUERPO de Rankine, con el remanso saltando a x = −K/(2πU∞) al mover K.
   · uniforme + fuente(−a) + sumidero(+a) ⇒ ÓVALO de Rankine CERRADO; al desbalancear las intensidades el óvalo
     SE ABRE por atrás (es el mismo Σκ = 0 de la ec. 3.70, en versión visual).
   · el contador "Σ intensidades" en el HUD: verde en 0, rojo si no.
   · el alerta DURA: si el alumno intenta sumar las PRESIONES de dos flujos, La Forja lo bloquea con la cita
     literal de la p. 112.
 SE VERIFICA CONTRA: FIXTURE bertin-ej-3.5 (x_stag = −K/(2πU∞)), FIXTURE bertin-ej-3.6 (θ₁, θ₂ y cierre),
   FIXTURE bertin-ej-3.4 (el caudal a través de CUALQUIER círculo alrededor de una fuente = K, probado con
   r = 0.5, 1, 5, 50).

════════════════════════════════════════════════════════════════════════════════════
L3.5 — "EL CILINDRO Y LA MENTIRA DE D'ALEMBERT"                  [§3.13 pp. 126-134 · Figs 3.17/3.19/3.21]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: un círculo acotado (R) en el croquis; La Forja lo reconoce y arma uniforme + doblete con B = R²U∞.
 MUEVE: R, U∞, y el Re resultante (mostrado, no tecleado); un interruptor "capa límite laminar/turbulenta".
 DEBE VER PASAR:
   · la superficie ES una línea de corriente (vr = 0 en r = R) — el alumno lo comprueba con la sonda.
   · |U| = 2U∞ exactamente en θ = 90° y 270°, y Cp = −3 ahí.
   · al integrar Cp: Cl = 0 Y Cd = 0. El HUD debe decirlo con todas sus letras: "d = 0 — PARADOJA DE
     D'ALEMBERT (1752). No es un error del programa."
   · al superponer la curva experimental subcrítica: sotavento se DESPEGA brutalmente de la teoría; el marcador
     de separación aparece en θ ≈ 100° (laminar) y se corre a 60-70° (turbulento).
 SE VERIFICA CONTRA: Cp(180°) = 1.0 exacto; Cp(90°) = −3.0 exacto; ∮ ⇒ Cl = Cd = 0 a 1e-10;
   separación θ ≈ 100° / 60-70° [§3.13.2 p. 130, Achenbach 1968]; Cd_experimental ≈ 1.2 para Re < 3×10⁵
   [§3.13.3 p. 134, Schlichting 1968].

════════════════════════════════════════════════════════════════════════════════════
L3.6 — "LA CHOZA QUE SE VUELA"                                   [§3.14 pp. 137-139 · Ej. 3.7]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: semicilindro acotado sobre un plano de tierra (croquis: semicírculo + línea base), con R como cota.
 MUEVE: R (1-15 m), U∞ (0-70 m/s), y la POSICIÓN DE LA PUERTA θ₀ (Problema 3.38).
 DEBE VER PASAR: la flecha de sustentación NETA creciendo con U∞²; y —el momento didáctico— que al mover la
   puerta la fuerza neta puede ANULARSE (porque cambia la presión interna). Que el arrastre siga siendo 0 por
   simetría, y que el HUD lo atribuya a "despreciamos la viscosidad".
 SE VERIFICA CONTRA: FIXTURE bertin-ej-3.7 → Cl = 8/3 = 2.6667 exacto; l = 40,833 N/m con R = 5 m, U∞ = 50 m/s,
   ρ = 1.225 kg/m³ (±0.1%).

════════════════════════════════════════════════════════════════════════════════════
L3.7 — "CIRCULACIÓN: DE DÓNDE SALE LA SUSTENTACIÓN"              [§3.5/§3.15 pp. 99-101, 139-142 · Fig 3.25]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: el mismo círculo de L3.5, ahora con un vórtice en el centro.
 MUEVE: Γ, con marcas duras en 2πU∞R y 4πU∞R.
 DEBE VER PASAR:
   · los DOS puntos de remanso deslizándose hacia abajo por la superficie y FUNDIÉNDOSE en uno solo en θ = 270°
     justo cuando Γ = 4πU∞R;
   · la lectura de Cl subiendo linealmente con Γ y CLAVÁNDOSE en 4π = 12.566 en ese instante;
   · Cd = 0 SIEMPRE, por más Γ que meta;
   · el contorno de circulación dibujable por el alumno: si ENCIERRA el cilindro da Γ, si no, da 0.
 SE VERIFICA CONTRA: l = ρ∞U∞Γ [ec. 3.58] contra la integral numérica de −∮ p sinθ R dθ (deben coincidir a 1e-8);
   θ_stag = sin⁻¹(−Γ/(4πRU∞)) [ec. 3.59]; Cl,max = 4π [ec. 3.61]; Cp(90°) = −15 exacto cuando Γ = 4πU∞R.

════════════════════════════════════════════════════════════════════════════════════
L3.8 — "TU PRIMER SOLVER: EL MÉTODO DE PANELES"  ← LA LECCIÓN CUMBRE   [§3.16 pp. 144-148 · Ej. 3.8]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: el alumno DIBUJA un perfil cerrado con croquis y cotas (empezando por el círculo de radio 1 con 8
   paneles, para poder comparar con el libro), y La Forja lo discretiza en M paneles con puntos de control en
   los PUNTOS MEDIOS.
 MUEVE: M (8 → 200, con el círculo del libro como caso base); α; y un modo "microscopio" que muestra la fila i
   de la matriz A y el valor de cada I_ij.
 DEBE VER PASAR:
   · la matriz de influencia A dibujada como mapa de calor, con la DIAGONAL = π resaltada (el término κ_i/2 de
     autoinducción, el que Kellogg 1953 hizo posible);
   · el vector b = −2πU∞ sin(α − δ_i) apagándose a cero en los paneles tangentes al flujo;
   · κ₃ = κ₇ = 0 en la corrida de 8 paneles, y el patrón antisimétrico;
   · el semáforo Σκ_i = 0: verde. Si el alumno abre el contorno o invierte una normal, ROJO;
   · al subir M, el Cp del panelado CONVERGIENDO sobre la curva analítica Cp = 1 − 4sin²θ. Con M = 8 el error es
     visible; con M = 64 ya se traslapan.
   · y el mensaje honesto: "Con paneles de FUENTE solamente, Cl = 0 SIEMPRE. La sustentación necesita vórtices y
     la condición de Kutta — capítulos 6 y 7." (cita literal p. 146)
 SE VERIFICA CONTRA: FIXTURE bertin-ej-3.8 → I₃₂ = 0.3528 (±1e-4) y las OCHO κ_j/(2πU∞) = ±0.3765, ±0.2662, 0, 0
   (±1e-4). Convergencia: max|Cp_paneles − (1 − 4sin²θ)| debe caer monótonamente con M.
 PROBLEMA DE TAREA: 3.45 (p. 164) — calcular I₄₃ por el mismo procedimiento.

════════════════════════════════════════════════════════════════════════════════════
L3.9 — "2D NO ES 3D: EL CILINDRO CONTRA LA ESFERA"               [§3.17 pp. 149-152]
════════════════════════════════════════════════════════════════════════════════════
 CONSTRUYE: revoluciona el mismo semicírculo del croquis para obtener una esfera; La Forja arma el doblete
   axisimétrico con B = 2πU∞R³.
 MUEVE: un deslizador que va del cilindro (2D) a la esfera (axisimétrica), lado a lado.
 DEBE VER PASAR: el pico de velocidad cayendo de 2·U∞ a 1.5·U∞, y el Cp mínimo de −3 a −1.25. La MISMA sección
   circular en el papel, física DISTINTA. Y que el área de referencia cambia de 2R (por vano) a πd²/4.
 SE VERIFICA CONTRA: Cp = 1 − (9/4)sin²ν [ec. 3.79] vs Cp = 1 − 4sin²θ [ec. 3.44]; U_max = 1.5 U∞ [ec. 3.77].

════════════════════════════════════════════════════════════════════════════════════
RÚBRICA TRANSVERSAL (lo que el alumno DEBE poder decir al final del capítulo)
════════════════════════════════════════════════════════════════════════════════════
 1. Los cinco supuestos de Bernoulli, de memoria, y cuál se rompe en cada zona de un avión.
 2. Por qué la superposición funciona (Laplace es LINEAL) y por qué NO puede aplicarse a presiones.
 3. Qué es circulación físicamente ("el flujo se GIRA") y por qué exige vorticidad dentro del contorno.
 4. Los tres teoremas de Helmholtz, y por qué el vórtice de punta de ala no puede terminar en el aire.
 5. Por qué el modelo no viscoso da arrastre CERO y qué falta para arreglarlo (Prandtl, capa límite).
 6. Cómo se arma la matriz de influencia de un método de paneles, término por término.
 7. Qué es Kutta-Joukowski y para qué secciones vale (CUALQUIER sección cerrada).
```

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


#### Lección V-1 — "La capa que no ves engorda tu ala" (δ*)
- **Construye:** una placa plana paramétrica (c, b) en el CAD, con un campo de δ*(x) dibujado como una segunda
  superficie desplazada.
- **Mueve:** U∞ y la longitud de cuerda; ve el número de Reynolds al borde de fuga.
- **Debe VER pasar:** que δ ∝ √x (parábola desde el borde de ataque), y que δ* es aproximadamente **un tercio** de
  δ; que la línea de corriente exterior se desplaza EXACTAMENTE δ* (ec. 4.72).
- **Se verifica contra:** Ejemplo 4.1. Con c=0.2 m, b=1.8 m, U=40 m/s, aire a ρ=1.2250 y μ=1.7894e-5:
  Re_c = 5.477e5; δ*(0.20 m) = 4.6e-4 m; δ(0.20 m) = 13.5e-4 m; C_D = 3.589e-3.

#### Lección V-2 — "El perfil lineal miente" (por qué el método integral necesita un buen perfil)
- **Construye:** el mismo caso con TRES perfiles de velocidad supuestos: lineal, cúbico (4.38) y la Tabla 4.3.
- **Mueve:** el selector de perfil.
- **Debe VER pasar:** que δ* se infla 45% y cf se desploma 40% con el perfil lineal; y la sutileza de que si además
  se calcula δ con el mismo perfil malo, los dos errores se compensan parcialmente.
- **Se verifica contra:** Ejemplo 4.2 (δ* 0.625e-2√x vs 0.430e-2√x; cf 1.00e-3/√x vs 1.66e-3/√x; v_e 3.125e-3 vs
  2.10e-3) y Problemas 4.8 y 4.9 (que piden hacerlo con el cúbico y el lineal contra 5.0/1.72/0.84/0.664/1.328).

#### Lección V-3 — "β decide si el flujo se despega" (Falkner-Skan)
- **Construye:** una familia de perfiles de velocidad f'(η) con β como único control, leyendo la Tabla 4.1.
- **Mueve:** β de +2.0 a −0.1988.
- **Debe VER pasar:** que al llegar a β = −0.1988 la pendiente en la pared se hace CERO (el perfil se vuelve
  vertical en y=0) y f''(0) → 0; un paso más allá habría flujo invertido.
- **Se verifica contra:** Tabla 4.2 — f''(0) = 1.6872 / 1.2326 / 0.7748 / 0.4696 / 0.1286 / 0.000.

#### Lección V-4 — "Tu perfil separaría si fuera todo laminar" (β desde el Cp real)
- **Construye:** el NACA 65-006 en el sketcher del CAD; corre paneles; obtén Cp(x/c); calcula β(x/c).
- **Mueve:** la posición del espesor máximo (arrastrando el perfil) y observa cómo se mueve el cruce por cero de β.
- **Debe VER pasar:** β > 0 en la primera mitad; β < −0.1988 a partir de x/c ≈ 0.6; el mensaje del CAD:
  "separaría si fuera laminar — pero a Re de vuelo no lo es".
- **Se verifica contra:** Tabla 4.4 (los 23 Cp literales) y la conclusión textual del Ejemplo 4.3. Además contra
  Fig. 4.10: laminar totalmente adherido tope 4.6% de espesor; turbulento 31%.

#### Lección V-5 — "El número que tú eliges" (transición)
- **Construye:** el gráfico Cf_tot vs Re_L de la Fig. 4.19, generado por el propio alumno con (4.32), (4.82) y (4.87).
- **Mueve:** Re_x,tr entre 300,000 y 3,000,000 (los cuatro valores de la Tabla 4.5).
- **Debe VER pasar:** que la curva de transición se desliza; que a Re_L alto las tres curvas convergen; y la
  regla del pulgar: cuando x_tr < 10% de L, la corrección A/Re_L es despreciable.
- **Se verifica contra:** Tabla 4.5 (A = 1050/1700/3300/8700) y Problema 4.15 (comparar full-turbulento vs (4.87)
  para U=80 m/s, x=1.0 m, ρ=1.2250, μ=1.7894e-5).

#### Lección V-6 — "Más gruesa Y más pegajosa" (laminar vs turbulenta en el mismo punto)
- **Construye:** los dos perfiles superpuestos en x = x_tr.
- **Mueve:** U∞ (que mueve x_tr).
- **Debe VER pasar:** que la turbulenta es 3.8× más gruesa PERO tiene mucho más u cerca de la pared ⇒ más τ_w.
  Es la contra-intuición central del capítulo.
- **Se verifica contra:** Ejemplo 4.4 y Tabla 4.6 (a y=0.00017 m: u_lam = 17.78 m/s vs u_turb = 36.21 m/s).

#### Lección V-7 — "La pared en unidades de pared" (u⁺, y⁺)
- **Construye:** el gráfico u⁺ vs log y⁺ con las tres leyes: u⁺=y⁺, log-law, defecto.
- **Mueve:** κ (0.40↔0.41) y B (5.0↔5.5) dentro de los rangos que da el libro.
- **Debe VER pasar:** dónde se pegan las curvas (la subcapa muere en y⁺≈5–10; la log-law vive en 70<y⁺<400); y
  por qué una malla CFD necesita puntos en y⁺ ≤ 5.
- **Se verifica contra:** los valores literales de p.202 (κ ≈ 0.40 ó 0.41; A ≈ 2.35; B ≈ 5.0 a 5.5) y Fig. 4.15.

#### Lección V-8 — "H te avisa antes de que se despegue" (método integral con gradiente)
- **Construye:** la marcha de (4.88) con el cierre de Head sobre un perfil real; grafica H(x).
- **Mueve:** el ángulo de ataque.
- **Debe VER pasar:** H arrancando en ~1.3 (perfil 1/7) y trepando; la banda de peligro 1.8–2.8 pintada; el
  cruce por 2.2 marcado como "separación probable".
- **Se verifica contra:** los valores de p.214–215 (H≈1.3 para 1/7; Kroo 2.2; rango 1.8–2.8) y (4.92)/(4.93) —
  incluyendo las guardas de NaN (H₁ ≤ 3.0, H ≤ 1.1, H ≤ 0.6778).

#### Lección V-9 — "El radiador del avión de carreras" (térmica + analogía de Reynolds)
- **Construye:** un panel de superficie con T_w controlable sobre el fuselaje.
- **Mueve:** altitud, velocidad y T_w.
- **Debe VER pasar:** el signo de q̇ invertirse cuando T_w cruza T∞; y que con Pr=0.738 la analogía SIN modificar
  (St = cf/2) da un ~14% de error frente a la modificada.
- **Se verifica contra:** Ejemplo 4.7 (Re_x = 2.093e7, x_tr = 0.072 m, k = 2.306e-2 W/m·K, Pr = 0.738,
  q̇ = −8.944 kW/m² = −1.114 hp/ft²) y Ejemplo 4.5 (Pr = 0.738).

#### Lección V-10 — "No sumes coeficientes de fricción" (arquitectura del sumador de drag)
- **Construye:** un avión conceptual con 4–6 componentes; cada uno con su S_wet.
- **Mueve:** el S_ref elegido.
- **Debe VER pasar:** que sumar los Cf_tot da un número SIN SENTIDO, y que convertir a C_D con S_ref común y
  luego sumar da el número correcto; que cambiar S_ref reescala TODOS los C_D pero no el drag en Newtons.
- **Se verifica contra:** ecs. (4.33)/(4.34) y la advertencia literal *"this must never be done!"* (p.180).

#### Lección V-11 — "Las paredes del túnel se abren" (uso práctico de δ*)
- **Construye:** el túnel de 1 m² × 6 m del Problema 4.20.
- **Debe VER pasar:** el ángulo de divergencia necesario para mantener U∞ constante entre x=1.5 m y x=6 m.
- **Se verifica contra:** Problema 4.20 (p.225) — es el uso de δ* como corrección geométrica REAL, exactamente el
  mismo mecanismo que el acoplamiento viscoso/no-viscoso del CAD.

---


---

## 7. NO OBSERVADO — figuras y tablas que eran imagen y no pude leer

El texto viene de `pdftotext`. Lo que sigue **no lo leí y por tanto no lo afirmo**. Cuando de una
figura sobrevivieron rótulos o marcas de eje, lo digo; cuando un dato del texto rescata parte del
contenido, lo doy. Nada de esto se deduce ni se inventa.

### Caps. 1 y 5


El texto viene de `pdftotext`. Las siguientes figuras y datos eran imagen y **no puedo leerlos**;
lo que aparece del OCR son sólo etiquetas de ejes sueltas. **No los deduzco ni los invento.**

**Capítulo 1**
- Fig. 1.1 — F-15E en vuelo (fotografía, sin contenido técnico).
- Fig. 1.2a/b — B-52H y F-5E (fotografías).
- Fig. 1.3 — Términos usados en medición de presión (esquema; el concepto SÍ está en el texto).
- Fig. 1.4 — Elemento de fluido para la derivación de las ecs. 1.15–1.17 (esquema; la derivación
  completa SÍ está en el texto).
- Fig. 1.5 — Componentes principales de un avión comercial (las ETIQUETAS sí se leen: alerones,
  estabilizador vertical, timón, spoilers, flaps, elevadores, estabilizador horizontal,
  dispositivos de borde de ataque, fuselaje, góndola/pilón, ala, dispositivo de punta de ala).
- Concept Box "Atmospheric Layers" — gráfica de capas atmosféricas: se leen las etiquetas
  (troposfera, tropopausa, estratosfera, estratopausa, mesosfera, mesopausa, termosfera) y los ejes,
  **pero no los valores de la curva T(z) por encima de 30 km**.
- Fig. P1.1 — **Empuje disponible y requerido del T-38A a 20,000 ft** para pesos de 8,000 / 10,000 /
  12,000 lbf, con curvas "Mil" y "Max" y el "Buffet Limit". **NO LEGIBLE.** Los problemas 1.1 a 1.5
  dependen íntegramente de esta figura: no se pueden convertir en fixtures.
- Fig. P1.24 — manómetro en U (esquema).

**Capítulo 5**
- Fig. 5.1 — Ala del C-17 (fotografía).
- Fig. 5.2, 5.3, 5.4, 5.5 — Esquemas de fuerzas, centro de presión, balance de trimado y ejes de
  referencia. El contenido conceptual y las ecuaciones SÍ están en el texto.
- Fig. 5.6 — Nomenclatura de la geometría del perfil (las etiquetas sí se leen).
- Fig. 5.7 — Características geométricas del planform (rectangular, trapezoidal sin flecha, con
  flecha, delta). Etiquetas legibles; proporciones no.
- Fig. 5.8 — Ala sin flecha con torsión geométrica (washout). Etiquetas legibles.
- Fig. 5.9 — **Rangos históricos de carga alar vs relación potencia/peso** [Hall (1985)]. Se leen
  las ETIQUETAS de las nubes (cazas de la 1ª y 2ª Guerra, cazas a reacción subsónicos y
  supersónicos, transportes a reacción, turbohélices, aviación general, Wright flyer, Solar
  Challenger, Solar HAPPs, aviones de propulsión humana) y los ejes (0.001–10 hp/lbf,
  0.1–1000 lbf/ft²), **pero NO las posiciones ni los contornos**. Sí quedan dos datos numéricos
  del texto: B-17G 29,700 kg (65,500 lb) con 31.62 m (103.75 ft) de envergadura; F-15 30,845 kg
  (68,000 lb) con 13.05 m (42.81 ft). Y que los aviones de propulsión humana tienen carga alar
  menor a 1 lbf/ft².
- Concept Box "Airfoil Characteristics" — distribuciones de velocidad superficial del NACA 2412 a
  α=0° y α=6° [Eppler (1990)]. **Curvas NO legibles**; sólo los ejes (v/V de 0.5 a 1.5, x/c de 0 a 1).
- Fig. 5.10 — Croquis del Orbiter para el Ejemplo 5.2. Los tres números clave (b, ct, cr) SÍ
  aparecen en el texto.
- **Fig. 5.13 — Cl y Cm,c/4 del NACA 23012** [Abbott y von Doenhoff (1949)] a Re 3.0e6, 6.0e6,
  8.8e6 (liso) y 6.0e6 (rugosidad estándar). **CURVAS NO LEGIBLES.** Rescatados del texto: Clα =
  0.104/deg, α0l = −1.2°, Clmax = 1.79 a α = 18°, región lineal −10° a +10°, y la banda experimental
  de Cl a α=4° (0.50 a 0.57). El resto de la curva NO se puede reconstruir.
- **Fig. 5.14 — Cd y Cm,ac del NACA 23012.** **CURVAS NO LEGIBLES.** Rescatadas del encabezado las
  posiciones del centro aerodinámico: x/c = 0.241 (Re 3.0e6), 0.241 (Re 6.0e6), 0.247 (Re 8.8e6);
  y las marcas del eje Cd (0.000, 0.008, 0.016, 0.024) y Cm,ac (−0.2, −0.1, 0.0).
- Fig. 5.15 — Sonda aerotransportada de Boeing [Bowes (1974)] (esquema).
- Fig. 5.16 — Comparación NACA 0009 vs NACA 66-009 y sus distribuciones de Cp. **Curvas no
  legibles**; sí el texto: espesor máx. en 0.3c vs 0.45c, presión mínima en x≈0.1c vs x=0.6c.
- **Fig. 5.17 — Cd de sección de NACA 0009 y NACA 66-009 a Rec = 6×10⁶.** **NO LEGIBLE.** Sólo se
  leen las marcas del eje Cd (0.000 a 0.020) y Cl (−1.6 a 1.6). Es la figura que muestra el "drag
  bucket": no puedo dar sus valores.
- **Fig. 5.18 — Efecto de la rugosidad de borde de ataque sobre el Clmax del NACA 63(420)-422**
  para rugosidades de 0.002, 0.004 y 0.011 in vs Rec de 0 a 32×10⁶. **CURVAS NO LEGIBLES**; sólo
  las etiquetas de las series y los ejes (Clmax 0.0 a 2.0).
- Concept Box "Boundary-layer Transition Effects on Wind-Tunnel Testing" — termografías infrarrojas
  de un UCAV con borde de ataque limpio vs con tira de carborundo [Schütte y Cummings (2011)].
  **Imágenes, no legibles**; el texto explica el resultado.
- **Fig. 5.20 — Efecto de la rugosidad sobre el Cf** [curvas de rugosidad de Gollos (1953)]:
  familia de curvas para tamaño de grano relativo k/L = 10⁻³, 10⁻⁴, 10⁻⁵, 10⁻⁶, 10⁻⁷ contra ReL de
  10⁵ a 10¹⁰, con las envolventes "Laminar" y "Smooth-turbulent". **NO LEGIBLE.** Se leen los ejes
  (Cf de 0.001 a 0.010) y las etiquetas de k/L. **Sin esta figura no se puede implementar la
  corrección de rugosidad como función continua**; sólo queda la corrección global del 6–9%.
- **Fig. 5.21 — Factor de forma K del ALA vs t/c (0 a 0.20) y flecha Λc/4 (0°–10°, 15°, 20°, 25°,
  30°, 35°, 40°, 45°, 50°)** [Shevell (1989)], K de 1.0 a 1.50. **CURVAS NO LEGIBLES.** Se leen los
  ejes y las etiquetas de las nueve curvas. **Puntos rescatados del Ejemplo 5.5 (Tabla 5.4):
  K=1.06 (t/c=0.04, Λ_LE=40°), K=1.06, K=1.04, K=1.04, K=1.08, K=1.04.** Con eso no basta para
  reconstruir la superficie: **hay que digitalizar esta figura del PDF original. ES BLOQUEANTE
  para implementar el método de Shevell en general.**
- **Fig. 5.23 — Factor de forma K del CUERPO vs relación de finura L/D (3 a 11) a M∞ = 0.50**
  [Shevell (1989)], K de 1.05 a 1.40. **CURVA NO LEGIBLE.** Puntos rescatados del Ejemplo 5.5
  (Tabla 5.5): K=1.05 (L/D=13.067, con extrapolación declarada por el propio libro), K=1.01,
  K=1.25, K=1.15. **También bloqueante, y con un agravante: la figura sólo cubre L/D de 3 a 11 y
  el Ejemplo 5.5 EXTRAPOLA a 13.067.**
- Fig. 5.19, 5.22, 5.24 — Croquis de ala trapezoidal, fuselaje de secciones circulares y
  componentes del avión (esquemas; el contenido está en el texto).
- Fig. 5.25 — Geometría del F-16 aproximada por formas simples [Brandt et al. (2004)]. Las
  etiquetas de las piezas sí se leen y las Tablas 5.2/5.3 dan sus dimensiones.
- Fig. 5.26 — Comparación de pendientes de sustentación 2D vs 3D (esquema conceptual).
- **Fig. 5.27 — Coeficiente de sustentación TRIMADO del F-16C vs α para M = 0.2, 0.6, 0.8, 0.9,
  1.2, 1.6, 2.0** [General Dynamics Staff (1976)], con "Limit AOA at 1G", deflexiones de cola
  δHT = ±21°, misiles montados, c.g. en 0.35 mac, altitud 30,000 ft. **CURVAS NO LEGIBLES.**
  Rescatado del texto: CLmax = 1.57 a α = 27.5°, y los cinco pares (M, CL, α) de la tabla del
  Ejemplo 5.6. **Los α del Ejemplo 5.6 SALEN de esta figura: no son calculables.**
- Fig. 5.28 — Correlación α vs velocidad para el F-16C en SLUF (es la gráfica del Ejemplo 5.6; la
  tabla numérica SÍ está).
- **Fig. 5.29 — Polar de vuelo del F-106A/B a M = 0.9** [Piszkin et al. (1961)]. **NO LEGIBLE.**
  Rescatado del texto: CL,min ≈ 0.07 y CD,min ≈ 0.012; ejes CL de 0.0 a 0.4 y CD de 0.00 a 0.05.
- **Fig. 5.30 — Reparto de fuentes de arrastre de un transporte típico** [Thomas (1985)]. Es un
  diagrama de sectores. **Las PROPORCIONES no son legibles**; sólo las etiquetas (fricción,
  inducido, cola/afterbody, interferencia, onda, misceláneo, rugosidad) y el dato del texto:
  fricción + inducido ≈ 85%, el resto ≈ 15%.
- Fig. 5.31 — Polar sustentación/arrastre de un transporte grande [Bowes (1974)], con el desglose
  por columnas (CD0: fricción, presión, interferencia, rugosidad | kCL²: vórtice de carga no
  elíptica, vórtice de carga elíptica, fricción | ΔCDM: onda, separación por choque). Las etiquetas
  SÍ se leen; **la curva no**.
- Fig. 5.32 y 5.33 — Componentes de arrastre y L/D del F-16C a 20,000 ft (son las gráficas del
  Ejemplo 5.7; **la tabla numérica completa SÍ está**, así que no se pierde nada).
- Fig. P5.7 — Placa plana de 1.5 m a 35 m/s (los datos están en el enunciado).

**Datos que el libro remite a otro lado y por tanto NO tengo:** el Apéndice B (usado en el
Ejemplo 5.3 para ρ a 3 km de altitud de densidad; el valor 0.9093 kg/m³ SÍ aparece en el texto),
la Tabla 4.5 (correcciones de transición, citada en §5.4.4 — pertenece al bloque del cap. 4), la
ec. 4.87 (relación de fricción total, citada en §5.4.6) y la Fig. 4.15 (sublayer laminar).

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


El txt viene de `pdftotext`: TODAS las figuras son imágenes y sus trazos no existen en el archivo. Lo que sí sobrevivió son etiquetas sueltas de ejes, que anoto donde las hay. Por número:

- **Fig. 2.1** (p.35) — aire alrededor de un ala en marco tierra-fijo, tres instantes t0, t0+Δt, t0+2Δt. Solo etiquetas; trayectoria de la partícula NO legible.
- **Fig. 2.2** (p.36) — el mismo caso en marco vehículo-fijo. NO legible.
- **Fig. 2.3** (p.37) — balance de masa en el elemento 2D. Las expresiones de flujo por cara SÍ están en el cuerpo del texto, así que no se pierde física.
- **Fig. 2.4** (p.39) — capa límite incompresible, Ejemplo 2.2. Etiquetas visibles: U∞, "Inviscid flow", δ(x), u = U∞(y/δ)^(1/7). Trazo NO legible; no hace falta.
- **Fig. 2.5** (p.40) — nomenclatura del volumen de control (n̂ dA). NO legible.
- **Fig. 2.6** (p.42) y **Fig. 2.7** (p.43) — tensor de esfuerzos y balance de fuerzas 2D. Las componentes están en el texto.
- **Fig. 2.8** (p.46) — flujo paralelo entre placas, alturas ±h/2. NO legible el perfil.
- **Fig. 2.9** (p.50) — flujo completamente desarrollado, estaciones 1 y 2. NO legible.
- **Fig. 2.10** (p.51) — **PÉRDIDA REAL**: perfiles de Couette para P = -3,-2,-1,0,1,2,3. Sobreviven los ejes (y/h de 0 a 1.0 con marcas 0.2/0.4/0.6/0.8; u/U de -0.4 a 1.4) y la etiqueta "Back-flow" del lado negativo, pero **las curvas no son legibles**. Reconstruibles analíticamente con la fórmula del texto (por eso no bloquea), pero la comparación visual que el libro pide en el Ej. 2.3 hay que regenerarla. Crédito: Schlichting y Gersten (2000).
- **Fig. 2.11** (p.54) — volumen de control de la placa plana, caras 1 a 4. La descripción de las 4 caras SÍ está en el texto.
- **Foto ONERA M6 en el túnel S2MA** (p.56) — imagen, no legible. Los datos numéricos del ala sí están en el texto.
- **Fig. 2.12** (p.57) — dos configuraciones geométricamente semejantes de tamaños L1 y L2. NO legible (no hace falta, es un esquema).
- **Fig. 2.13** (p.59) — **PÉRDIDA CRÍTICA**: correlación Re–M vs velocidad y altitud para la Atmósfera Estándar de EE.UU. Sobreviven SOLO los rótulos de ejes y de curvas: altitud 0–30 km; velocidad 0–2500 km/h; marcas de M en 0.25, 0.50, 0.75, 1.00, 1.25, 1.50, 1.75, 2.00, 2.25; curvas de Re∞,L en 1×10⁶, 2×10⁶, 5×10⁶, 10×10⁶ y 20×10⁶, con L = 1.0 m. **La posición de las curvas NO es legible.** Se puede regenerar íntegra a partir de la Tabla 1.2 y las eqs. (2.19)/(2.20), y esa regeneración es un entregable del producto — pero NO se debe transcribir ningún valor leído "de la figura".
- **Foto F/A-18 en el túnel 80 ft × 120 ft de NASA Ames** (p.62) — imagen. Los números del túnel sí están en el texto.
- **Fig. 2.14** (p.64) — capa límite viscosa sobre un perfil, laminar vs turbulenta, cuerpo efectivo no viscoso. Sobreviven las viñetas comparativas (capa laminar: capa relativamente delgada, transferencia de masa limitada, gradiente de velocidad bajo cerca de la pared, fricción superficial baja; turbulenta: capa más gruesa, transporte de masa considerable, velocidades más altas cerca de la superficie, fricción superficial mayor). El TRAZO no es legible.
- **Fig. 2.15** (p.67) — trabajo incremental de la fuerza de presión. NO legible.
- **Fig. 2.16 (a) y (b)** (p.68) — trabajo de los esfuerzos y transferencia de calor en el elemento 2D. Las expresiones están en el texto.
- **Fig. 2.17** (p.73) — tubo de corriente para deducir (2.36). NO legible.
- **Fig. 2.18** (p.75) — tubo curvo del Ej. 2.7. Cotas SÍ legibles: 5 cm, 30 cm, 2 cm, "drains to the atmosphere".
- **Figs. P2.8 a P2.34** (pp. 77–86) — figuras de problemas. Los enunciados traen los datos numéricos en texto; los trazos NO son legibles.
- **Tabla 1.2 y Tabla 1.2A** — citadas por §2.5, Ej. 2.5 y Ej. 2.6, pero viven en el Capítulo 1 (**fuera de mi rango**). De ellas solo tengo los valores que el propio capítulo 2 transcribe: a(14 km) = 295.07 m/s; a(40,000 ft) = 968.08 ft/s; μ∞/μSL = 0.79447 y ρ∞/ρSL = 0.2471 a 40,000 ft. Que otro agente confirme el resto.
- **Eqs. (1.10), (1.12), (1.16a-c) y (3.3)** — referenciadas desde el capítulo 2 (estado, Sutherland, hidrostática, potencial de fuerza de cuerpo) pero definidas fuera de mi rango.
- **Tablas 2.1 y 2.2 SÍ son legibles completas** en el txt (pp. 61-62). No hay pérdida ahí.
- **Exponente de la relación isentrópica del Prob. 2.40** (p.87): sale corrupto (`- g(g - 1)`). Declarado ilegible; no lo invento.
- **Erratas/anomalías del texto fuente, declaradas, no corregidas:** (a) el recuadro de McMasters dice *"Using Fig. 2.12, we can estimate…"* cuando la carta Re–M es la **Fig. 2.13** — parece errata del libro o del OCR; (b) el Prob. 2.35 dice "In Problem 2.25" pero describe el ciclo pistón/cilindro del **Prob. 2.34**; (c) el Prob. 2.23 dice "The volume of the bottle is 0.1 mm" (unidad imposible para un volumen).

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
El txt viene de pdftotext: TODAS las figuras son imagen y NO se leyeron. Lista exhaustiva de lo que
NO se puede afirmar a partir de esta fuente. NO INVENTAR NINGUNO DE ESTOS DATOS.

FIGURAS DE LAS QUE DEPENDEN DATOS NUMÉRICOS:
 · Fig 3.17 (p. 129) — Cp(θ) del cilindro: curva teórica + datos de Schlichting (1968) a Re = 1.86×10⁵
   (subcrítico) y Re = 6.7×10⁵ (supercrítico). SOLO se leyeron los rótulos de leyenda y los ejes (Cp de +2 a
   −3; θ de 180° a 180° pasando por 270°, 0°, 90°). ⛔ NO se conocen los VALORES de Cp experimental en ningún
   θ. En particular NO se conoce el Cp de base (estela) ni el Cp mínimo experimental.
 · Fig 3.19 (p. 131) — θ_separación vs Red (Achenbach 1968). Ejes: θ de 30° (sotavento) a 120° (barlovento);
   Red de 10⁴ a 10⁷; bandas rotuladas "Subcritical / Critical / Supercritical Reynolds numbers".
   ✅ Los cuatro anclajes numéricos SÍ están en el TEXTO (100°, 40°, 60-70°, Re_crit ≈ 3×10⁵, 1.5×10⁶).
   ⛔ La CURVA completa (θ para un Red arbitrario) NO es recuperable.
 · Fig 3.21 (p. 134) — Cd del cilindro liso vs ReD (Schlichting 1968). Ejes: ReD de 4×10³ a 10⁶; Cd con marcas
   0.1, 0.5, 1.0, 2.0. ✅ El texto DA Cd ≈ 1.2 para Re < 3×10⁵. ⛔ El VALOR MÍNIMO de Cd tras la caída crítica
   NO está en el texto ni es legible. ⛔ La curva completa NO es recuperable.
 · Fig 3.23 (p. 137) — ✅ EXCEPCIÓN FELIZ: los cinco valores de Cd (2.0, 1.2, 0.12, 1.2, 0.6) SÍ salieron como
   texto en el OCR y están citados literalmente. ⛔ Los dibujos de las líneas de separación no.
 · Fig 3.22 (p. 136) — barras de "relative drag force" para las mismas 5 configuraciones. ⛔ NINGÚN valor
   numérico de las barras es legible. Solo se conocen las relaciones CUALITATIVAS del texto ("an order of
   magnitude less", "same total drag", "Larger").
 · Fig 3.25c (p. 142) — Cp(θ) con circulación para Γ = 2πU∞R y Γ = 4πU∞R. Eje Cp de +2 a −16. ⛔ Los valores
   de curva no son legibles, PERO son COMPUTABLES exactamente con la ec. (3.57) — usar la ecuación, no la
   figura.
 · Fig 3.31 (p. 151) — CD de la esfera vs Red (Schlichting 1968). Ejes: Red de 4×10³ a 10⁶; marcas 0.1, 0.5,
   1.0, 2.0. ⛔ NINGÚN valor numérico del CD de la esfera está en el texto del cap. 3. En particular, el valor
   subcrítico "≈ 0.5" que se cita comúnmente NO aparece: NO USARLO como si fuera de Bertin.
 · Fig 3.18 (p. 129) — fotos de túnel de agua alrededor de una ESFERA (Werlé/ONERA) en régimen subcrítico,
   transicional y supercrítico. Cualitativa. ⛔ Sin Re asociados en el texto.
 · Fig 3.26 (p. 143-144) — transformación conforme de círculo a perfil de Joukowski (de Karamcheti 1980).
   ⛔ LA FUNCIÓN DE TRANSFORMACIÓN NO ESTÁ EN EL TEXTO. Solo se ven rótulos (planos z y ζ, puntos z_L, z_T, ±C,
   ±2C, a, μ). Si La Forja quiere Joukowski, la fórmula debe salir de otra fuente y DECLARARSE como extensión.
 · Caja "A Real Vortex" (pp. 121-122) — gráfica de v_θ vs r con las curvas "Free vortex" y "Forced vortex",
   ejes 0-5. ⛔ El modelo de vórtice de Rankine (radio de núcleo, empalme) NO está dado por fórmula. Solo la
   descripción cualitativa: núcleo forzado + exterior libre. Solo dato numérico textual: tornado "sometimes in
   excess of 500 km/hr".
 · Fig 3.14 (p. 121) — foto del vórtice de suelo del YC-14 (US Air Force, Campbell & Chambers 1994).
   Cualitativa. Foto de vórtices de punta de ala de un Boeing 727 (NASA Dryden). Cualitativa.
 · Figs 3.1-3.16, 3.20, 3.24, 3.27-3.30 — esquemas. ✅ Todos los datos que necesitan los ejemplos están en el
   TEXTO (verificado uno por uno). Fig 3.8 sí trae rótulos legibles: ψ = 1, 4, 8 y φ = 0, ±1, ±4.
 · Figs P3.4, P3.5, P3.11-P3.15, P3.20, P3.21, P3.25, P3.26, P3.28, P3.29, P3.33, P3.34, P3.38, P3.39, P3.46,
   P3.49 — figuras de problemas. Datos suficientes en el enunciado salvo geometría fina.

TABLAS Y NÚMEROS SOSPECHOSOS DE OCR (NO usar sin re-verificar contra el PDF original):
 · TABLA 3.1, celda [TAS = 1000 km/h, altitud = 10,000 m], q∞ impreso como "1.59 × 10³".
   ⛔ INCONSISTENTE: ½ρV² con ρ = 0.3376ρ_SL y V = 277.8 m/s da 1.60 × 10⁴. El exponente perdió un dígito.
   El valor correcto es 1.59 × 10⁴. Todas las demás 14 celdas de la tabla verifican a ±0.3%.
 · EJEMPLO 3.4, resultado impreso "= Kr": la 'r' es ρ (rho) mal renderizada ⇒ ṁ = ρK. Confirmado por
   dim[K] = L²/T y por la definición de κ en §3.16.
 · §3.12.3 (p. 116), componentes de velocidad del doblete impresas como vr = −B cosθ/(2πr²) y
   vθ = −B sinθ/(2πr²). ⛔ INCONSISTENTES con la propia ec. (3.39a) φ = (B/r)cosθ (que da −B cosθ/r², SIN 2π) y
   con §3.13.1 (p. 126), que usa B/r² sin 2π. El factor 2π impreso es espurio. USAR LA FORMA DE §3.13.1.
 · Ec. (3.39c) φ = −(B/r) cosα cosθ para un doblete con eje a ángulo α. ⛔ Forma y signo sospechosos (lo
   esperable es (B/r)cos(θ−α)). Marcar como NO CONFIABLE; derivar de (3.39a) rotando ejes.
 · EJEMPLO 3.3(c): "∫(∂φ/∂y)dy = φ = ∫u dy = ∫(−2y)dy" — debe ser ∫v dy. Typo evidente; el RESULTADO
   φ = x² − y² + C es correcto.
 · EJEMPLO 3.8: la primitiva impresa muestra el coeficiente −0.70711 en AMBOS términos (½ln y arctan), lo que
   no puede ser exacto para la descomposición mostrada. El RESULTADO I₃₂ = 0.3528 SÍ es correcto (verificado
   por cuadratura independiente en esta extracción). Usar el resultado, no la primitiva impresa.
 · Ec. (3.50)→(3.51): la línea de sustitución imprime "d = −∫ p sin θ R dθ" cuando debe ser cos θ (el integrando
   con cos θ sí aparece explícito a la derecha). Typo de OCR/tipografía.
 · Ejemplo 3.7, Cl: el OCR imprime "8/2 ρU²R" en el numerador; el resultado 8/3 es correcto.
 · Ec. (3.14): el signo negativo NO es OCR — es la convención declarada del libro. No "corregirlo".

ERRATAS DE REFERENCIA CRUZADA EN EL LIBRO (no OCR, el propio libro):
 · Pie de la Fig 3.24 (p. 138): "quonset hut of Example 3.5" → es el Ejemplo 3.7.
 · p. 141: "one of the terms containing circulation in equation (3.5)" → es la ec. (3.57).
 · Problema 3.20 (p. 157): "the velocity field given in Problem 3.12" → es el Problema 3.19.
 · Problema 3.35 (p. 162): "Using the data of Fig. 3.30" → Fig 3.30 es el sistema de coordenadas
   axisimétrico; los datos de Cd(Re) del cilindro están en la Fig 3.21.
 · Problema 3.45 (p. 164): "Using the procedures illustrated in Example 3.6 … geometry is illustrated in
   Fig. 3.27" → es el Ejemplo 3.8 y la Fig 3.28.
 · Problema 3.47 (p. 164): "compare with that for a hemicylinder (i.e., Problem 3.47.)" → autorreferencia;
   debe ser el Problema 3.39. Además escribe "p_comer" por "p_corner".
 · p. 133: "Ludwig Prantdl" → Prandtl.

LO QUE EL CAPÍTULO SIMPLEMENTE NO TRAE (no lo busques aquí, no lo inventes):
 · Condición de Kutta NUMÉRICA / paneles de vórtice / cálculo de Γ para un perfil → caps. 6 y 7 (declarado).
 · Teoría de perfil delgado → cap. 6 (declarado).
 · Ecuaciones de la capa límite, transición, Cf → caps. 4 y 5 (declarado).
 · Efectos de compresibilidad sobre Cp (regla de Prandtl-Glauert) → capítulos posteriores.
 · Tablas de aeronaves reales (pesos, geometrías, coeficientes de aviones concretos): NO HAY NINGUNA en el
   capítulo 3. Las únicas menciones de aeronaves son cualitativas: YC-14 (Fig 3.14), Boeing 727 (foto de
   vórtices), X-37 (Problema 3.10, con datos de sondas inventados para el ejercicio). El único puntero a
   catálogos reales es bibliográfico: Hoerner (1958) y Hoerner & Borst (1975).
 · Criterio de convergencia de malla / número mínimo de paneles: NO EXISTE en el cap. 3.
 · Cualquier valor de Cd de esfera. Ver arriba.
```

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


**Figuras (todas son imágenes; solo sobrevive el pie de figura y a veces los rótulos de eje). NINGUNA curva de
estas fue leída — no inventar sus valores:**

| Fig. | p. | Qué sería y qué se rescató del texto |
|---|---|---|
| 4.1 | 168 | Sistema de coordenadas de la capa límite. Solo el pie. |
| 4.2 (a,b) | 170 | Modelos de transporte de momento laminar/turbulento. Rótulos: δ_lam, δ_turb, u(y), u_e, "microscopic"/"macroscopic scale". |
| 4.3 | 171 | f'(η) de Falkner-Skan para β = 0.1988(−), 0.180(−), 0.00, 0.30, 1.0, 2.0. **Sus datos SÍ están en la Tabla 4.1.** Eje y: η = u_e y/√(2νs), 0 a 6.0. |
| 4.4 | 176 | f''(0) vs β, β de −0.2 a 2.0, f''(0) de 0.0 a 2.0. **Sus datos SÍ están en la Tabla 4.2** (6 puntos). La curva entre puntos NO se observó. |
| 4.5 | 179 | Perfil laminar mostrando δ y δ* (áreas iguales). |
| 4.6 | 182 | Perfiles del Ejemplo 4.1. Rescatados del texto: en x=0.05/0.10/0.20 m, δ = 6.7e-4/9.5e-4/13.5e-4 m y δ* = 2.3e-4/3.3e-4/4.6e-4 m; u_e = 40 m/s. |
| 4.7 | 185 | Comparación perfil lineal vs Tabla 4.3, y/δ (o η/η_e) de 0 a 1. Sin datos adicionales. |
| 4.8 | 186 | Sección del NACA 65-006, escala z ×5. **Coordenadas SÍ en Tabla 4.4.** |
| 4.9 | 187 | β(x/c) del NACA 65-006. Ejes: x/c de 0.0 a 1.0, β de +0.1 a −0.3; línea horizontal "Criterion for separation". **Los valores puntuales de β NO se observaron** — deben recalcularse desde la Tabla 4.4. |
| 4.10 | 188 | u_e/U∞ de perfiles Joukowski laminar/turbulento. Ejes: 0, 1, 2. **Los números clave SÍ están en el pie** (4.6%, 31%, 33%, Re_c=10⁷). Las curvas de u_e no. |
| 4.11 | 189 | Fotografía de generadores de vórtice en un A-4 (colección de Ruth Bertin). |
| 4.12 | 191 | Croquis idealizado del proceso de transición. Rótulos: T-S waves, growth of spanwise vorticity, 3D vortex breakdown, generation of turbulent spots, fully turbulent flow, Re_crit. |
| 4.13 | 192 | Fotografía de visualización de la transición (A. S. W. Thomas, Lockheed). |
| 4.14 | 194 | Historia temporal de ū y u'. |
| 4.15 | 201 | **LA figura de la ley de la pared.** Ejes: u/u* de 0 a 20; y⁺ de 1 a 1000 (log). Rótulos rescatados: linear sublayer, buffer layer, viscous sublayer, inner layer, log-law region, defect-law region, outer layer, "wake" component, y ≈ 0.1δ. Las curvas mismas NO se observaron; sus ECUACIONES sí (4.54, 4.57, 4.58) con κ, A, B. |
| 4.16 (a,b) | 205 | Cálculo TNSBLM. (a) cf vs x(m) de 0.0 a 1.2, cf de 0.5e-3 a 1e-2 aprox.; se ven rotuladas las curvas 0.664/Re^0.5, 0.0583/Re^0.2 y TNSBLM, y la "transition zone" entre γ=0 y γ=1. (b) y/δ (0 a 1.0) vs μ_t/μ (0.001 a 100) en 4 estaciones. **Las condiciones del caso SÍ están** (u_e=114.1 ft/s, T_e=542°R, p_e=2101.5 psf, T_w=540°R) y las 4 estaciones x (0.165/0.228/0.320/1.223 m con γ_tr=0.6 en 0.228). Los valores de las curvas NO. |
| 4.17 | 206 | Volumen de control de placa plana (Y₀, Y, L). |
| 4.18 | 210 | Esquema del cálculo con coeficientes totales (la resta turbulenta). |
| 4.19 | 211 | **Cf_tot vs Re_L, placa lisa**, Re_L de 10⁴ a 10¹⁰. Rótulos de eje y (con OCR dudoso): 0.010(?), 0.008, 0.006, 0.004, 0.003, 0.002, 0.0015, 0.001. Se ven rotuladas las tres curvas: 1.328/√Re_L, 0.455/(log₁₀Re_L)^2.58 − 1700/Re_L, y 0.455/(log₁₀Re_L)^2.58. **Los puntos de la curva NO se observaron** — pero son reproducibles al 100% desde las ecuaciones. |
| 4.20 | 213 | Perfiles del Ejemplo 4.4, u de 0 a 60 m/s, y de 0 a 0.004 m. **Sus datos SÍ están en la Tabla 4.6.** |
| P4.7 | 222 | Croquis del volumen de control rectangular. |
| P4.11 | 223 | Croquis de la sonda Pitot en la capa límite. |
| P4.13 | 224 | Croquis de la estela del perfil simétrico. |
| — | 190 | Shadowgraph de transición en cono hipersónico (Rasheed et al. 2002, cortesía Hans Hornung, Caltech). Descripción textual: laminar a la izquierda, oscilaciones a pocos cm, inicio de turbulencia ~40 cm desde la izquierda, turbulento pleno a la derecha; superficie porosa abajo mantiene laminar en toda la longitud. **No hay escala ni números de Re en el texto.** |
| — | 194 | Fotografía de capa límite turbulenta sobre placa plana [Falco (1977)]. |

**Contenido que NO está en el capítulo 4 (no lo busques aquí, y NO lo inventes):**
- **Tabla de rugosidad admisible k o k_s por acabado superficial: NO EXISTE en este capítulo.** Solo tratamiento
  cualitativo (ver DATOS-EXPERIMENTALES). Buscar en Raymer y en Schlichting & Gersten (2000).
- **Capa límite compresible:** el libro remite explícitamente al **Capítulo 8** (§4.1, p.169). No hay
  transformación de Illingworth-Stewartson, no hay Van Driest II en el cap. 4.
- **Temperatura de referencia de Eckert (T*):** NO aparece en el cap. 4.
- **Temperatura de recuperación / factor de recuperación r (r=√Pr laminar, r=Pr^{1/3} turbulento):** NO aparecen
  en el cap. 4. La única relación Pr↔espesor que da es δ_T/δ ≈ 1/√Pr (p.216).
- **Método integral de Thwaites:** NO aparece. El único método integral laminar del capítulo es Falkner-Skan
  (diferencial-similar) y el enfoque integral se usa solo para turbulento (§4.7) y para los problemas 4.8/4.9.
- **Método de Pohlhausen (polinomio de 4º grado):** solo se cita a Pohlhausen por sus VALORES térmicos
  ((∂θ/∂η)₀ = 0.4696 Pr^0.333, p.218), no el método de perfil polinomial.
- **Correlaciones de e^N / factor de amplificación para transición:** NO aparecen. El libro solo da Re_x,tr.
- **Valores de Re de vuelo de aviones reales, valores medidos de Cf de aviones reales, o comparaciones
  teoría-experimento tabuladas:** NO HAY en el cap. 4. Los únicos datos experimentales cuantitativos son la
  Tabla 4.4 (Cp del 65-006, Abbott & von Doenhoff 1949), los pies de la Fig. 4.10 (Cebeci & Smith 1974), las
  bandas de precisión de las 4 correlaciones de Cf_tot, y las constantes κ/A/B. La comparación teoría-experimento
  del drag de un perfil real (Fig. 4.11 de Anderson) está en OTRO libro, no aquí.

---


---

## 8. LO QUE MÁS ME SORPRENDIÓ — lo que una máquina lineal se salta y aquí sí importa

### Caps. 1 y 5


1. **El capítulo de geometría contiene una decisión de contabilidad que se contradice a sí misma —
   a propósito.** El área de REFERENCIA S incluye la parte del ala enterrada en el fuselaje (§5.3,
   p.236: "the pressure carryover on these surfaces allows legitimate consideration of the entire
   planform area"). Pero la mac que se usa para el Reynolds de fricción **NO** debe incluirla
   (§5.4.6, p.265: "the mean aerodynamic chord should be calculated using the root chord at the
   side of the fuselage!"). Dos definiciones distintas del mismo ala, en el mismo capítulo, para
   dos propósitos distintos. Una máquina lineal usa una sola y produce un número que parece bien y
   está mal. **Es exactamente el bug de contabilidad que ya nos mordió en el pliego de moldes: el
   dato bien calculado que no llega al juez correcto.**
2. **La línea de curvatura media se mide PERPENDICULAR a la cuerda, no vertical.** (§5.2.3, p.234).
   Todo el mundo la implementa como promedio de zsup y zinf a la misma x. Con perfiles de curvatura
   fuerte eso está mal. Un detalle de una frase que cambia el código del kernel.
3. **El libro DEMUELE su propio número más famoso.** Re_transición = 500,000 es el valor que todos
   memorizan. Bertin lo da, y en el mismo párrafo explica que salió de túneles con 2–3% de
   turbulencia y que en túneles silenciosos se mide 2.8–3.4 millones — casi SIETE VECES más. Y
   convierte eso en un requisito de producto: hay que barrer la sensibilidad. Un resumen automático
   se queda con "500,000" y tira la parte que importa.
4. **El Ejemplo 5.7 imprime, a propósito, una fila físicamente imposible.** A M=0.10 el CL requerido
   es 11.62 (el máximo real del F-16 es 1.57). El libro no la marca ni la borra. Es el examen
   silencioso: si tu software imprime esa fila como resultado válido, tu software no sabe volar.
5. **El Ejemplo 5.5 es un anuncio de nuestro producto escrito por el cliente.** "something which
   could be improved with a better representation of the aircraft surfaces, such as from a CAD
   geometry". El error del método (5.4% de área mojada) viene de aproximar el F-16 con conos y
   cilindros. Un CAD que mide el área mojada real de un B-Rep elimina ese error de un golpe.
6. **El método de arrastre entero descansa en dos figuras que no puedo leer.** Las Figs. 5.21 y 5.23
   (factores de forma) son la única fuente de K. Sin digitalizarlas del PDF, sólo tenemos 10 puntos
   sueltos del Ejemplo 5.5. Y el propio libro **extrapola fuera del rango de la Fig. 5.23**
   (finura 13.067 cuando la figura llega a 11) y lo declara entre paréntesis. Eso es honestidad de
   ingeniero, y es la clase de anotación que un software debe propagar hasta el reporte final.
7. **La técnica E-M no es historia militar de relleno.** Es una lección de método: el libro
   construye deliberadamente dos comparaciones EQUIVOCADAS (energía total, energía específica)
   antes de llegar a la correcta (su derivada temporal). Enseña que la métrica se elige y que la
   métrica mal elegida da la respuesta contraria. Para un curso de diseño conceptual vale más que
   media docena de fórmulas.
8. **Los datos de vuelo real siempre son PEORES que la predicción, y por un margen conocido.**
   Boeing 727: +15% sobre el túnel [Bowes 1974], y el propio informe dice que ese 15% "is larger
   than traditionally allotted in airplane drag estimates". F-16: predicho 0.0151–0.0158, medido
   0.0160–0.0190. El sesgo es sistemático y tiene dirección. Un software honesto lo muestra como
   banda, no como punto.
9. **Una franja de pintura arruina un ala laminar.** [van Dam y Holmes (1986), §5.4.5]. Junto con
   insectos, hielo y llovizna. La rugosidad no es un parámetro académico: es operación diaria.
10. **El ala del C-17 no la diseñó la aerodinámica.** La envergadura la fijó el espacio de
    estacionamiento; los winglets van arriba porque abajo pasan los camiones; la curvatura la limitó
    el proceso de maquinado de la piel (radio mínimo 5000 in). Cita: "finding a wing that can attain
    all requirements necessarily means that the wing will not be fully optimized for aerodynamics
    purposes." **Un CAD de diseño conceptual debe modelar RESTRICCIONES ARBITRARIAS, no sólo
    física.** Ese es el hueco que Raymer señaló y que el C-17 ilustra con nombres propios.
11. **Hay erratas en el libro y las tablas oficiales no son sagradas.** La viscosidad a 5 km de la
    Tabla 1.2A rompe la monotonía y no la reproduce Sutherland. El "472.9" del Ejemplo 1.10 debería
    ser "472.19". El Clα del NACA 23012 es 0.104 en la p.246 y 0.1041 en la p.249. El "170" que
    debería ser "1700" en la p.271. Cargar un manual a ciegas también carga sus erratas: el motor
    necesita invariantes propios (monotonía, cierre dimensional) que las detecten.
12. **La advertencia de método más valiosa del capítulo está escondida en un párrafo de arrastre.**
    (§5.4.3, p.252): integrar presiones para sacar arrastre es "relatively inaccurate ... for
    streamlined configurations at small angles of attack" porque es la diferencia entre dos
    integrales grandes. Y peor: un error de presión en el morro o en la cola pesa muchísimo más que
    el mismo error en la mitad del cuerpo. **Eso significa que la métrica de calidad de una malla no
    puede ser uniforme sobre la superficie.**

### Cap. 2 — Fundamentals of Fluid Mechanics (pp. 33–87)


1. **El borde de la capa límite deja pasar masa.** Una máquina que arma volúmenes de control asume que una línea a altura constante sobre una placa es una línea de corriente. Es falso, y el Ejemplo 2.2 existe solo para demostrarlo. Si lo ignoras, el arrastre del Ejemplo 2.4 sale mal por un factor grande: el término ρU∞Q2 = (1/8)ρU∞²δ es el 12.5 % del flujo de referencia.
2. **Momento solo no basta: necesitas continuidad primero.** En el Ej. 2.4 el gasto Q2 que escapa por la cara superior es una incógnita que la ecuación de momento no puede despejar. El orden de las operaciones es parte del método, no un detalle.
3. **El signo del cortante en la pared superior es negativo y aun así arrastra.** §2.4.1 p.49 lo explica en tres renglones: el signo está en el sistema local de esa pared. Un pipeline automático que sume τ_l + τ_u reporta arrastre CERO en un canal de Poiseuille.
4. **Subir de 14 km a 19 km no cambia el Mach.** La capa isotérmica 11–21 km hace que a∞ sea constante. Un modelo lineal "más altura ⇒ más Mach" falla exactamente en el rango de crucero de los aviones de transporte.
5. **Estacionario no significa sin aceleración.** §2.3 p.41: la partícula acelera desde la región de estancamiento hacia la zona de baja presión aunque ∂V/∂t = 0. La aceleración convectiva (V·∇)V es la que hace la fuerza.
6. **Igualar Reynolds y Mach a la vez es, en la práctica, imposible para aviones grandes.** §2.5 p.63: los túneles "are capable of matching the Mach number, but cannot match the Reynolds number". No es un problema de dinero: es tamaño de modelo más límites de presión y temperatura del túnel.
7. **El túnel más grande del mundo tiene un techo de ~100 nudos.** NASA Ames 80×120 ft, seis ventiladores de 40 ft, 18,000 hp cada uno, y aun así ni se acerca al Mach de crucero. La escala bruta no resuelve la semejanza.
8. **Un modelo radiocontrolado a ¼ de escala puede ganarle al túnel.** McMasters (2007): Re ≈ 30×10⁶ contra 36×10⁶ del 767 real, "over 80% of the full-scale Reynolds number", a una fracción del costo. Es un resultado contraintuitivo que un optimizador de costos jamás propondría solo.
9. **La derivación de la semejanza es SOLO para propiedades constantes.** El libro lo dice y de inmediato advierte: "real flows in real wind tunnels may not be constant". La regla M1=M2 y Re1=Re2 se enseña como universal y no lo es.
10. **La lista de Bushnell no tiene fórmula.** Ocho familias de error de túnel, ninguna con corrección cerrada. La aeroelasticidad del modelo y el montaje (stings, struts, alambres) no aparecen en ninguna ecuación del capítulo, y aun así deciden si el dato sirve.
11. **∂p/∂y ≈ 0 tiene fecha de caducidad numérica: Mach de borde ≈ 20.** Está enterrado en un párrafo de §2.6 p.65 y es exactamente el supuesto que un código de capa límite hereda sin preguntar.
12. **El conteo 5 incógnitas / 4 ecuaciones.** Es la razón estructural por la que un solver incompresible no se "extiende" a compresible agregando una tabla de densidad: falta una ecuación entera.
13. **Bernoulli aparece como COROLARIO de la energía, no como ley.** Y solo después de matar siete hipótesis, incluida "no perceptible changes in the internal energy". Un alumno que aprende Bernoulli primero nunca ve cuáles son.
14. **`v` es volumen específico, no la componente y de la velocidad.** El libro grita la advertencia en §2.8 p.67. En código es una colisión de nombres real.
15. **La frontera transónico/supersónico de Bertin está en M = 1.6**, no en 1.2 (ver CONTRASTE). Un clasificador de régimen escrito "de memoria" va a discrepar con el libro entre M = 1.2 y M = 1.6.
16. **Tabla 2.2 dice que en régimen creep el arrastre es INVERSAMENTE proporcional a Re_L y en el laminar de bajo Re es PROPORCIONAL a Re_L.** Dos tendencias opuestas en dos décadas contiguas: cualquier ajuste de curva monótono sobre Re está mal.
17. **La longitud característica de la Fig. 2.13 es 1.0 m**, no la cuerda del avión. Leer la figura y reportar "el Reynolds del avión" sin escalar por L es un error de una línea con consecuencias de programa.
18. **Vorticidad, circulación, función de corriente y potencial de velocidad NO están en este capítulo.** El foco pedía buscarlos: el capítulo 2 no los define. Los objetivos del Capítulo 3 (p.87) los anuncian explícitamente ("Have a physical understanding of circulation and how it relates to aerodynamics", "Learn the assumptions required for potential flow"). Lo único que asoma aquí es el potencial de fuerza de cuerpo F con F = -∇f, referenciado a la eq. (3.3) desde §2.9 p.70. Que el agente del Cap. 3 lo cubra.
19. **Tampoco hay coeficiente de presión Cp aquí.** El único coeficiente definido en el capítulo es el de arrastre, y se define dentro del Ejemplo 2.4 (p.53): Cd = d/(½ρ∞U∞²c), con área de referencia = cuerda por unidad de envergadura. No hay número de Froude en este capítulo: los únicos parámetros de semejanza que emergen de la adimensionalización son Mach y Reynolds.

---

### Cap. 3 — Dynamics of an Incompressible, Inviscid Flow Field (pp. 88–165)


```
1. ⚠ EL SIGNO NEGATIVO DE LA CIRCULACIÓN ES DELIBERADO Y ESTÁ EN LA DEFINICIÓN.
   Ec. (3.14): −Γ = ∮ V·ds, integrando ANTIHORARIO. Literal: "A negative sign is used in equation (3.14) for
   convenience in the subsequent application to lifting-surface aerodynamics." Si La Forja implementa
   Γ = +∮V·ds obtendrá sustentación con el signo invertido en Kutta-Joukowski. ES UN BUG ESPERANDO.

2. ⚠ θ = 180° ES EL REMANSO DELANTERO, NO EL TRASERO.
   Toda la §3.13 y las Figs 3.17/3.19/3.25 usan θ = 180° = barlovento y θ = 0° = sotavento. La "separación en
   θ ≈ 100°" NO significa "100° desde el morro" sino "80° desde el morro". El libro lo aclara explícitamente
   ("that is, 80° from the windward stagnation point") justamente porque es confuso. Cualquier gráfica de La
   Forja debe rotular el eje con ambas convenciones.

3. ⚠ LA SEPARACIÓN LAMINAR OCURRE DONDE LA TEORÍA NO VISCOSA PREDICE GRADIENTE **FAVORABLE**.
   Literal (p. 130): "the occurrence of separation so alters the flow that separation actually occurs on the
   windward surface, where the inviscid solution … indicates that there still should be a favorable pressure
   gradient … Separation would not occur if the pressure were actually decreasing in the streamwise direction."
   Es decir: el modelo no viscoso no solo falla en predecir el arrastre, falla en predecir DÓNDE falla. Es un
   argumento circular roto que hay que enseñar explícitamente.

4. ⚠ EL Cd MÁS BAJO NO SIGNIFICA EL ARRASTRE MÁS BAJO.
   Fig 3.22/3.23 (e): cilindro grande supercrítico a Re = 10⁷ tiene Cd = 0.6 (menor que el 1.2 subcrítico) pero
   la fuerza dimensional es la MAYOR de las cinco configuraciones. Literal: "even though the dimensional force
   is increased, the nondimensionalized force coefficient is decreased." Trampa clásica en reportes de CAD.

5. ⚠ UN CILINDRO DE 1/10 DEL DIÁMETRO ARRASTRA LO MISMO QUE UN CUERPO FUSELADO 10× MÁS GRUESO.
   Literal (p. 135): "the total drag of the small cylinder is equal to that of the much thicker streamlined
   shape. You can readily imagine how much additional drag was produced by the wire bracing of a biplane during
   World War I." Es EL argumento de venta del fuselado, con un dato histórico anclado.

6. ⚠ EL TEOREMA DE KUTTA-JOUKOWSKI VALE PARA CUALQUIER SECCIÓN CERRADA, NO SOLO PARA EL CÍRCULO.
   Literal (p. 141): "applies to the potential flow about closed cylinders of arbitrary cross section." El
   argumento (fuentes+sumideros balanceados vistos de lejos = un doblete + la suma de vórtices) es la
   justificación de que l = ρU∞Γ se pueda usar sobre un perfil arbitrario. Mucha gente lo memoriza como "el
   resultado del cilindro". No lo es.

7. ⚠ EL ARRASTRE CERO SE GENERALIZA A TODO CUERPO 2D, TAMBIÉN CON CIRCULACIÓN.
   Literal (p. 140): "The prediction of zero drag may be generalized to apply to any general, two-dimensional
   body in an irrotational, steady, incompressible flow." Meter circulación NO produce arrastre inducido en 2D
   (eso llega en 3D, cap. 7).

8. ⚠ LA VELOCIDAD MÁXIMA SOBRE UNA ESFERA ES 1.5·U∞, NO 2·U∞.
   Ec. (3.77) vs (3.42). Y Cp_min = −1.25 vs −3. "although the configurations have the same cross section in
   the plane of the paper (a circle) … the flows are significantly different." Un CAD que reuse el kernel 2D
   para un fuselaje axisimétrico se equivocaría por un factor grande en la succión.

9. ⚠ LA FUNCIÓN DE CORRIENTE ES MÁS GENERAL QUE EL POTENCIAL.
   ψ existe para flujo ROTACIONAL y para compresible estacionario (p. 107); φ exige irrotacionalidad. Pero
   ∇²ψ = 0 SOLO si es irrotacional. La gente los trata como pareja simétrica: no lo son. Bertin lo usa para
   anunciar que ψ servirá en la CAPA LÍMITE laminar (cap. 4), donde φ ya no existe.

10. ⚠ LA ORTOGONALIDAD ψ⟂φ FALLA EN LOS PUNTOS DE REMANSO.
    p. 110, literal. Un renderizador de malla ortogonal reventará ahí (división entre cero en la ec. 3.33).

11. ⚠ EL TÉRMINO DIAGONAL DEL MÉTODO DE PANELES ES EXACTAMENTE κ_i/2 — NO SE INTEGRA.
    Ec. (3.67). Sale de un proceso límite riguroso (Kellogg 1953). Quien intente evaluar I_ii por cuadratura
    obtendrá infinito. Es la línea de código donde mueren las primeras implementaciones.

12. ⚠ EL LIBRO USA (x, z) EN EL MÉTODO DE PANELES Y (x, y) EN TODO LO ANTERIOR.
    §3.16 declara el cambio ("x in the chordwise direction and y in the spanwise direction") para alinearse con
    los caps. 6-7. Copiar ecuaciones de §3.13 a §3.16 sin renombrar la segunda coordenada = bug silencioso.

13. ⚠ EL EJEMPLO 3.1 ROZA EL LÍMITE DE INCOMPRESIBILIDAD Y EL LIBRO NO LO COMENTA.
    U₃ = 100 m/s a 2 km (a ≈ 332.5 m/s) ⇒ M ≈ 0.30 EXACTAMENTE en el borde del criterio M < 0.3 de la p. 90.
    Observación propia, no del libro: marcarlo en La Forja como caso límite pedagógico, no como error.

14. ⚠ LOS 4π DE Cl,max SON CON ÁREA DE REFERENCIA 2R.
    Ec. (3.61). Con otra área de referencia el número cambia. Cl = 4π ≈ 12.57 es ~10× el Cl,max de un perfil
    real, y por eso el libro lo llama "an important upper limit for airfoil aerodynamics".

15. ⚠ EL CAPÍTULO ENSEÑA EL MÉTODO INVERSO ANTES QUE EL DIRECTO — Y ESO ES UNA OPORTUNIDAD DE PRODUCTO.
    Rankine (1871): en vez de "dame la forma y te doy el flujo", es "dame las singularidades y quédate con la
    línea de corriente que te guste como pared". Para un CAD paramétrico esto es una HERRAMIENTA DE DISEÑO
    GENERATIVO regalada: mover K, B, Γ genera familias de cuerpos cerrados con su campo ya resuelto, gratis.
```

---

### Cap. 4 — Viscous Boundary Layers (pp. 166–225)


1. **La η de Bertin NO es la η clásica de Blasius: lleva un factor 2 dentro de la raíz.**
   Bertin: η = y·√(u_e/(2νx)) ⇒ f''(0) = **0.4696**, η_δ = 3.5.
   Clásica (Anderson, White, Schlichting): η = y·√(u_e/(νx)) ⇒ f''(0) = **0.332**, η_δ = 5.0.
   Relación exacta: 0.332·√2 = 0.4695. **Si el software mezcla la Tabla 4.3 de Bertin con una tabla de Blasius de
   otro libro, todos los perfiles salen mal por √2.** Este es el bug número uno esperable. δ, δ*, θ y cf finales
   coinciden en ambos libros; lo que difiere es la variable de similitud y el valor de f''(0).

2. **El OCR colapsa cf (local) y C̄f (total) al mismo símbolo "Cf".** En la ec. (4.21) el libro escribe el local;
   en (4.30)–(4.32) el total; en (4.80) el local; en (4.81)–(4.84) el total. **La ec. (4.31) del OCR contiene
   simultáneamente ambos** (`Cf = (1/L)∫Cf(x)dx = 2Cf(L) = 2θ/L`). Cualquier extracción automática del texto que
   no separe los dos símbolos producirá un factor 2 de error.

3. **Bertin da cf turbulento local = 0.0583/Re_x^0.2, no 0.0592.** El 0.0592 es el valor común de otros textos
   (incluido Anderson en otro contexto). Bertin lo deriva CONSISTENTEMENTE de su propio δ = 0.3747x/Re_x^0.2 y de
   Blasius (4.77). El 0.074 de Cf_tot sí coincide.

4. **El libro dispara contra su propia fórmula.** Después de derivar Cf_tot = 0.074/Re_L^0.2 con todo el aparato
   integral, dice: *"when compared with experimental data, equation (4.81) is found to be only ±25% accurate"* y
   recomienda usar Prandtl-Schlichting *"instead of the Prandtl theoretical relation"*. Honestidad poco común, y
   es un requisito duro para La Forja: **el default no debe ser 0.074/Re^0.2.**

5. **Un perfil "laminar" real separaría si fuera laminar.** El NACA 65-006 a α=0° tiene β < −0.1988 para x/c ≥ 0.6.
   Que no separe en el túnel es porque la capa YA es turbulenta. La lección de diseño se invierte respecto de la
   intuición: el perfil de flujo laminar depende de que la transición ocurra.

6. **4.6% vs 31%.** El dato más brutal del capítulo (Fig. 4.10): el espesor máximo de un Joukowski simétrico que
   puede mantener flujo totalmente adherido a α=0° es 4.6% si es laminar y **31%** si es turbulento — casi 7×.
   Y el laminar es INDEPENDIENTE del Reynolds.

7. **La ley de 1/7 tiene un gradiente infinito en la pared.** El libro lo señala explícitamente y por eso necesita
   un dato experimental SEPARADO (Blasius, 4.77) para el esfuerzo. Es un ejemplo perfecto de "correlación útil
   pero no derivable": no se puede sacar τ_w del perfil que se usó para el momento.

8. **Erratas del libro / del OCR detectadas (para no perseguir fantasmas):**
   - **Fig. 4.9, p.187:** el pie dice *"Distribution for NACA 65-**606** airfoil"*. Debe decir 65-**006** (el
     Ejemplo 4.3, la Tabla 4.4 y la Fig. 4.8 dicen 65-006). Erratum del libro.
   - **§4.8.2, p.218:** *"Using the transformed stream function f … equation (**4.85**) becomes: θ'' + (Pr)fθ' = 0"*.
     La ec. (4.85) es el C_D con transición; debería referirse a la ec. (4.97) (energía). Erratum del libro.
   - **Problema 4.17, p.224:** *"Using equation (**4.95**), calculate the thermal conductivity of air at 2000 K"*.
     La (4.95) es Re_θ; debería ser la **(4.107)**. Erratum del libro.
   - **Problema 4.7, p.222:** *"How does the resultant expression compare with equation (**4.70**)?"*. La (4.70)
     es la continuidad del volumen de control; el sentido pide la **(4.75)** (C_d = 2θ/L). Probable erratum.
   - **Tabla 4.3 vs Tabla 4.1 en η=1.8:** f' = 0.7610 vs 0.7611. Inconsistencia de redondeo.
   - **Fig. 4.19, eje y:** el OCR da "0.0010" seguido de 0.008, 0.006… La secuencia obliga a que el primer rótulo
     sea **0.010**. Artefacto de OCR.
   - **Ec. (4.57a), p.201:** el OCR escribe `u/u* = (1/κ)ln(yu*/d) + B`. Por (4.53b) y (4.57b) el denominador es
     **ν**, no d. Artefacto de OCR.
   - **Ec. (4.67a), p.203:** el OCR da `α = 0.02604/(1 + )` y una línea suelta `= 0.55[1 − exp(−0.243√z₁ − 0.298z₁)]`.
     El símbolo perdido es **Π** (parámetro de estela de Coles). Reconstrucción confirmada por el valor:
     0.0168 × 1.55 = 0.02604, que es exactamente la forma Cebeci-Smith α = 0.0168·1.55/(1+Π).
   - **Ec. (4.48), p.196:** el OCR escribe `μ ∂²u/∂y² + μ ∂²u/∂y²` (dos veces ∂y²); en (4.46) uno de ellos es
     ∂²u'/∂y². Artefacto de OCR.
   - **Ejemplo 4.3, p.187:** el signo menos de la fórmula de β se perdió; lo repuse por derivación (ver fixture).

9. **Gotcha de unidades enterrado en el Ejemplo 4.5:** la ec. (4.107) da k en **cal/(cm·s·K)**. Pasar a J/(m·s·K)
   requiere ×418.7, no ×4.187. El libro solo menciona "4.187 J/cal". Es un factor 100 esperando a morder.

10. **El libro define δ_T/δ ≈ 1/√Pr** (p.216, citando a Schlichting & Gersten 2000), no la forma más común
    δ_T/δ ≈ Pr^{−1/3}. Para aire: 1.164 vs 1.104. Diferencia del 5%; irrelevante en el resultado de q̇ (que no la
    usa) pero relevante si alguien la implementa como correlación de diseño.

11. **El capítulo pone fecha a la muerte del CFD directo:** DNS de avión completo a Re de vuelo ~**2080**, LES
    ~**2045** (Spalart et al. 1997). Es el mejor argumento del libro a favor de métodos integrales para diseño
    conceptual — o sea, a favor de La Forja.

12. **El propio libro admite que su criterio de separación turbulenta no existe:** *"Although it is not possible
    to define an exact value of H corresponding to the separation, the value of H for separation is usually in the
    range 1.8 to 2.8"* (p.215). Un rango de 1.8 a 2.8 es un factor de 1.55. Cualquier UI que muestre "H = 2.13 ⇒
    NO SEPARA" está mintiendo.

13. **Los generadores de vórtice son deliberadamente ineficientes.** Pie de la Fig. 4.11 (A-4): *"an effective, but
    not necessarily an aerodynamically efficient, way of delaying separation."*

---


---

## 9. CONTRASTE CON ANDERSON

El cliente nos dio dos manuales. **Donde difieren, alguien de la empresa va a tener que decidir**, y
lo peor que puede pasar es que decida sin saber que había una diferencia. Esta sección lista todas
las divergencias detectadas entre Bertin caps. 1–5 y Anderson, *Fundamentals of Aerodynamics* 6ª ed.

Reglas que seguí aquí: **cada afirmación sobre Anderson está verificada leyendo
`docs/forja-research/manuales/aero/txt/anderson.txt`, no de memoria**, y cito la línea o la sección.
Cuando un cálculo es mío y no del libro, lo digo. Cuando no encontré algo, digo "no lo encontré en
los pasajes examinados", no "Anderson no lo dice".

### 9.0 Resumen ejecutivo — las 6 decisiones que el cliente debe tomar

| # | Tema | Bertin dice | Anderson dice | Impacto | Recomendación |
|---|---|---|---|---|---|
| 1 | **Longitud de referencia del momento de cabeceo** | la **mac** (integral de c²) | "*the mean chord length*" (= S/b) | **14.8% de error en Cm** para el ala del Orbiter | **mac.** Es la convención de la industria y la que usan los datos de Jane's |
| 2 | **Cf turbulento total de placa plana** | Prandtl-Schlichting `0.455/(log₁₀Re)^2.58` (±3%), y **desacredita** `0.074/Re^0.2` (±25%) | `0.074/Re^{1/5}`, sin barra de error ni alternativa | Es la base de TODO el arrastre de fricción | **Bertin.** Y no por autoridad: su Ejemplo 5.5 lo valida contra vuelo real del F-16 |
| 3 | **Reynolds de transición** | 500,000 "típico", pero documenta 2.8–3.4 ×10⁶ en túneles silenciosos | ≈500,000 "regla del pulgar"; **412,000 medido**; sugiere **1,000,000** para perfiles | Rango combinado **412,000 a 3,400,000: factor 8** | **Parámetro editable con presets. NUNCA un literal.** Y barrido de sensibilidad obligatorio |
| 4 | **Factor de eficiencia de Oswald `e`** | 0.6 – 0.95 | 0.7 – 0.85, más la fórmula empírica de Raymer | Los tres criterios se contradicen entre sí | **Rango editable + fórmula como sugerencia.** Ver 9.4, es el caso más enredado |
| 5 | **Pendiente de sustentación 3D** | `a₀/(1 + a₀/(πAR))` — sin factor de eficiencia | `a₀/(1 + a₀/(π·e₁·AR))` — con eficiencia de envergadura | ~1.2% en CLα para AR=7, e₁=0.95 | **Anderson** (la de Bertin es el caso ideal elíptico; declararlo) |
| 6 | **Variable de similitud de Blasius η** | `η = y√(u_e/(2νx))`, `f''(0)=0.4696` | `η = y√(V∞/(νx))`, `f''(0)=0.332` | Factor **√2**: mezclar tablas rompe todos los perfiles | **Elegir una y marcar el parámetro con su convención** |

Fuera de esas seis, la física coincide. Las ecuaciones de conservación, Bernoulli, los flujos
elementales, Kutta-Joukowski, la paradoja de d'Alembert, el Cp del cilindro y de la esfera, el cf
laminar y el espesor laminar son **idénticos** en ambos libros.

---

### 9.1 Geometría del ala: no es que difieran, es que Anderson NO LA TIENE

Este es el hallazgo más importante de todo el bloque, y no es una contradicción sino un **hueco**.

Conteos verificados sobre `anderson.txt` (53,184 líneas):
- `"mean aerodynamic chord"` → **0 ocurrencias.**
- `"taper ratio"` + `"dihedral"` + `"washout"` → **11 ocurrencias combinadas** en todo el libro.

Bertin dedica el §5.3 completo (pp. 236–243) a definir S, b, c̄, AR, cr, ct, λ, Λ, **mac**, diedro,
torsión geométrica e incidencia, con una tabla de 30 aviones reales. **Ese es exactamente el
vocabulario con el que un ingeniero de aeronaves habla y las cotas que el alumno va a dibujar en el
CAD.** Anderson, que es el motor teórico, simplemente no lo cubre.

**Consecuencia para el pliego:** todos los requisitos `[geometria]` del modelo paramétrico de ala
(§1 de este documento) se citan de **Bertin §5.2–5.3**, y no existe una fuente alterna en Anderson.
Si el cliente quisiera contrastarlos, tendría que ir a Raymer.

### 9.2 La longitud de referencia del momento de cabeceo — DISCREPANCIA REAL Y CUANTIFICADA

**Anderson** (§1.5, líneas 1637–1641), literal:
> "In the above coefficients, the reference area S and reference length l are chosen to pertain to
> the given geometric body shape... For example, for an airplane wing, S is the planform area, and
> **l is the mean chord length**"

y añade (línea 1650):
> "The particular choice of reference area and length is not critical; however, when using force and
> moment coefficient data, **you must always know what reference quantities the particular data are
> based upon.**"

**Bertin** (§5.3, p.238), literal:
> "The **mean aerodynamic chord**, mac, is used together with S to nondimensionalize the pitch
> moment... The mean aerodynamic chord is defined by: mac = (1/S)∫_{−b/2}^{+b/2} [c(y)]² dy"

**No son la misma cantidad.** La cuerda media de Anderson es c̄ = S/b (Bertin la define así en la
misma página: "The average chord, c̄, is determined so that the product of the span and the average
chord is the wing area"). La mac es la integral del CUADRADO de la cuerda. Sólo coinciden en un ala
rectangular.

**Cuánto importa, con el fixture del propio Bertin (Ejemplo 5.2, ala de referencia del Orbiter):**
```
S = 2690 ft² ,  b = 78.056 ft
c̄   = S/b = 2690/78.056 = 34.46 ft     <- "mean chord length" de Anderson
mac = 39.57 ft                          <- Bertin, Ejemplo 5.2 (dato del libro)
mac/c̄ = 1.148   ->  14.8% de diferencia
```
*(la división c̄ = S/b es aritmética mía sobre datos del libro; el 39.57 ft es dato de Bertin.)*

Un Cm calculado con una convención y comparado contra datos tomados con la otra está **14.8%
equivocado** para esta ala, y más para alas con λ menor. Y el propio Anderson lo advierte: hay que
saber siempre sobre qué se adimensionalizó.

**Recomendación: mac.** Es lo que usa la industria, lo que usan los datos de Jane's de la Tabla 5.1
y lo que exige el método de arrastre del §5.4.6. **Y el software debe ESTAMPAR en cada resultado la
longitud de referencia que usó**, no dejarla implícita.

### 9.3 Fricción de placa plana — la diferencia de recomendación que sí cambia el número

| Cantidad | Bertin | Anderson | Veredicto |
|---|---|---|---|
| cf local laminar | `0.664/Re_x^0.5` (§5.4.3 ec. 5.24; cap. 4 ec. 4.21) | `0.664/√Re_x` (18.20) | **Idéntico** |
| Cf total laminar | `1.328/√Re_L` (5.27 / 4.32) | `1.328/√Re_c` (18.22) | **Idéntico** |
| δ laminar | `5.0x/√Re_x` (4.23) | `5.0x/√Re_x` | **Idéntico** |
| cf local turbulento | `0.0583/Re_x^0.2` (5.25 / 4.80) | **no lo encontré publicado** en los pasajes examinados | **Bertin cubre un hueco** |
| δ turbulento | `0.3747x/Re_x^0.2` (4.79) | `0.37x/Re_x^{1/5}` (4.87/19.1) | 1.3%, Anderson redondea |
| **Cf total turbulento** | presenta `0.074/Re_L^0.2` y **la desacredita (±25%)**; manda usar **Prandtl-Schlichting `0.455/(log₁₀Re_L)^2.58` (±3%)** | `0.074/Re_c^{1/5}` (4.88/19.2) como EL resultado, con un caveat sólo cualitativo | **DIFERENCIA DE RECOMENDACIÓN** |

**Por qué la resolvemos a favor de Bertin, y no por autoridad:** Bertin no se limita a recomendar
Prandtl-Schlichting, la **usa** en su método de arrastre de avión completo (ec. 5.37, con la
corrección de transición `−1700/Re_L`) y **valida el resultado contra datos de vuelo del F-16**
(Ejemplo 5.5: predicho 0.0151–0.0158, medido en vuelo 0.0160–0.0190). Es la única de las dos
recomendaciones que llega hasta un avión real y sobrevive.

**Nota de coherencia interna:** el `1700` de la ec. 5.37 corresponde exactamente a la entrada de
Re_x,tr = 500,000 de la Tabla 4.5 de Bertin (300k→1050, 500k→**1700**, 1M→3300, 3M→8700). El texto
del Ejemplo 5.5 en la p.271 imprime "170", que es errata: sólo con 1700 sale el `Cf = 0.00280` que
el propio libro tabula. *(Verificado: 0.455/(log₁₀ 1.118e7)^2.58 = 0.002949; menos 1700/1.118e7 =
0.000152; total 0.002797 ≈ 0.00280.)*

### 9.4 El Reynolds de transición — el desacuerdo más caro, y los dos libros lo saben

Ninguno de los dos afirma un valor único, así que **no es una contradicción: es una franja de
incertidumbre compartida.** Pero la franja es enorme y hay que verla completa:

| Fuente | Valor | Condición declarada |
|---|---|---|
| Anderson §15 | **412,000** | medido en túnel, caso concreto |
| Anderson §15 | ≈500,000 | "As a rule of thumb in practical applications" |
| Bertin §4 (ec. 4.39) / §5.4.4 | 500,000 | "a typical transition criterion" / placa lisa sin turbulencia |
| Bertin §5.4.4 | **500,000 viene de túneles con 2%–3% de turbulencia** | desmontaje del propio criterio |
| Anderson Ej. 4.10–4.11 | **1,000,000** | "more likely the actual value is closer to 1,000,000" para perfiles |
| Bertin §5.4.4 | **2,800,000** | Schubauer-Skramstad (1948), turbulencia < 0.07% |
| Bertin §5.4.4 | **3,400,000** | túnel Klebanoff, Arizona State [Saric (1992)] |
| Bertin Tabla 4.5 | 300k / 500k / 1M / 3M | presets con su constante de corrección A |

**Rango total: 412,000 a 3,400,000 — un factor de 8.** Anderson cuantifica el impacto: pasar de
500k a 1M le bajó el C_f un **16%**.

**Los dos libros coinciden en el requisito de producto**, y es el mismo que ya está en la §4 de este
documento: `Re_x,tr` **es un parámetro editable con presets, nunca un literal en el código**, y
Bertin lo convierte en orden explícita: *"A quick examination of the impact of varying the
transition location should be conducted to ensure that a particular result is not highly dependent
on an incorrect assumption about transition."*

### 9.5 El factor de eficiencia `e` — tres criterios que no cierran entre sí

Aquí no hay dos posiciones sino tres, y una de ellas se contradice a sí misma.

1. **Bertin** (§5.5.2, p.283): "Typical values of the airplane efficiency factor range from
   **0.6 to 0.95**, and are lower than the span efficiency factor."
2. **Anderson** (§6, líneas 23372–23375): "the Oswald efficiency factor for different airplanes
   typically varies between **0.7 and 0.85** whereas the span efficiency factor typically varies
   between **0.9 and at most 1.0**".
3. **Anderson cita a Raymer** (ec. 6.25, línea 23382), fórmula empírica basada en aviones reales:
   `e = 1.78(1 − 0.045·AR^0.68) − 0.64`, "for straight-wing aircraft", y advierte que no vale para
   AR muy grandes (del orden de 25 o más, veleros).

**Los conflictos concretos:**
- **El propio Ejemplo 5.7 de Bertin usa e = 0.9084 para el F-16.** Está dentro del rango de Bertin
  (0.6–0.95) y **fuera** del de Anderson (0.7–0.85). Un software que valide `e` contra el rango de
  Anderson **rechazaría el fixture oficial de Bertin.**
- La fórmula de Raymer, evaluada en AR = 3 (el del F-16), da **e ≈ 0.97** *(aritmética mía:
  3^0.68 = 2.111; 0.045·2.111 = 0.0950; 1.78·0.9050 = 1.611; 1.611 − 0.64 = 0.971)*, o sea
  **por encima del rango 0.7–0.85 que el propio Anderson enuncia tres párrafos antes**. Con el
  atenuante de que Raymer la restringe a alas SIN FLECHA y el F-16 tiene 40° de borde de ataque —
  es decir, la fórmula **no aplica** a este avión, y eso también hay que codificarlo.
- Los otros dos aviones que Bertin tabula caen dentro del rango de Anderson: Eurofighter e = 0.84,
  MiG-29 e = 0.75 (Problemas 5.15 y 5.16). Sólo el F-16 se sale.

**Recomendación:** `e` es un campo editable con (a) el rango amplio de Bertin como validación suave,
(b) el rango de Anderson como sugerencia, y (c) la fórmula de Raymer ofrecida **sólo cuando la
flecha es cero**, con el aviso de AR alto. Y en ningún caso el software debe elegirlo solo: los tres
libros están de acuerdo en que es criterio del ingeniero.

**No confundir con la eficiencia de envergadura.** Ambos libros son claros y CONCUERDAN en que son
dos números distintos y que el de Oswald es el menor. Bertin: "are lower than the span efficiency
factor we will discuss in Chapter 7". Anderson: "These are two different numbers."

### 9.6 La pendiente de sustentación del ala finita

**Bertin** (ec. 5.41, §5.5.1 p.274): `CLα = a₀/(1 + a₀/(πAR))`, presentada para "an **ideal**
three-dimensional unswept wing". **Sin factor de eficiencia.**

**Anderson** (línea 36666 y ss.): `a = a₀/(1 + a₀/(π·e₁·AR))`, con e₁ = factor de eficiencia de
envergadura.

Como e₁ ≤ 1, **la fórmula de Anderson siempre da una pendiente menor**. Cuánto, para un ala típica
de aviación general *(aritmética mía)*:
```
a₀ = 2π /rad, AR = 7
Bertin:              a = 2π/(1 + 2/7)        = 4.887 /rad
Anderson, e₁ = 0.95: a = 2π/(1 + 2/(0.95·7)) = 4.830 /rad
diferencia: 1.16%, siempre en el mismo sentido (Bertin sobreestima)
```
No es grande, pero es **sistemática**: si el motor usa la de Bertin, todos los CL de ala salen
ligeramente altos, siempre. **Recomendación: implementar la de Anderson con e₁ como parámetro, y
exponer e₁ = 1 como "el caso ideal elíptico de Bertin ec. 5.41".** Así las dos quedan disponibles y
el alumno VE la diferencia.

Dato de apoyo de Bertin que ambos comparten: la pendiente 2D teórica es 2π/rad = **0.1097 /grado**,
y el NACA 23012 medido da **0.104 /grado** (§5.4.1 p.246) — o sea **la teoría sobreestima el dato
experimental un 5.5%**. Ese es el orden del error que el alumno debe interiorizar antes de discutir
un 1.16%.

### 9.7 La polar de arrastre — Bertin es más rico, y declara sus supuestos

**Anderson** (ec. 6.24): `CD = CD,o + CL²/(πeAR)` — dos términos.

**Bertin** (§5.5.2) da la cadena completa y, sobre todo, **dice cuándo se rompe**:
```
CD = CD,min + k'CL² + k''(CL − CL,min)²        [5.43]  general, separa inviscido de viscoso
CD = k1CL² + k2CL + CD0                        [5.45]  expandida
CD = CD0 + kCL²                                [5.46]  suponiendo CL,min ≈ 0, k2 ≈ 0, CD,min ≈ CD0
CD = CD0 + kCL² + ΔCDM                         [5.47]  con compresibilidad
```
Y la advertencia literal: *"In the case where these assumptions are not true, you may need to return
to equation (5.45)"*, más el aviso de dónde falla: *"The deviation of the actual airplane drag from
the quadratic correlation, where e is a constant, is significant for airplanes with low aspect
ratios and sweepback."*

Además Bertin respalda la simplificación con dato de vuelo: el F-106A/B a M=0.9 tiene CL,min ≈ 0.07
y CD,min ≈ 0.012 "only slightly lower than CD0" (Fig. 5.29). **Sin contradicción: Bertin contiene a
Anderson como caso particular y le añade el dominio de validez.** Implementar la 5.43 y ofrecer la
5.46/6.24 como simplificación con sus supuestos visibles.

### 9.8 Regímenes de Mach y umbral de incompresibilidad *(del bloque cap. 2)*

- **Frontera transónico/supersónico.** Bertin, Tabla 2.1 (p.61): transónico `0.8 < M < ~1.6`,
  supersónico `1.6 < M < ~5.0`. La partición usual, que Anderson presenta en su capítulo
  introductorio, pone esa frontera cerca de **M ≈ 1.2**. **Entre M = 1.2 y M = 1.6 los dos libros
  etiquetan cosas distintas.** El clasificador de régimen del CAD debe declarar de qué libro toma la
  tabla.
- **Umbral de incompresibilidad.** Bertin (§2.4 p.46): *"less than 0.3 to 0.5, depending upon the
  application"* — un **rango con juicio del ingeniero** (aunque su propia Tabla 2.1 y su resumen
  §2.10 usan 0.3). Anderson maneja **M < 0.3** como criterio único. Mismo default, pero Bertin
  autoriza explícitamente subirlo hasta 0.5 y Anderson no. **El parámetro tiene rango, no valor.**
- **Notación de la derivada sustancial:** Bertin usa `d/dt` (y lo advierte en §2.3 p.41), Anderson
  usa `D/Dt`. Mismo operador, distinto símbolo. Cualquier comparación automática entre los dos
  corpus debe normalizar el símbolo o reportará desacuerdos falsos.
- **Sin contradicciones** en hipótesis de Stokes (λ = −2/3 μ), ley constitutiva newtoniana,
  Navier-Stokes, primera ley ni función de disipación.

### 9.9 Flujo potencial: convenciones que son bugs esperando *(del bloque cap. 3)*

La física coincide por completo — fuente, vórtice, `Cp = 1 − 4sin²θ`, `|U|max = 2U∞`,
`Cp = 1 − (9/4)sin²ν` para la esfera, Kutta-Joukowski `l = ρ∞U∞Γ`, `Cl,max = 4π` del cilindro con
circulación, la paradoja de d'Alembert, la convención `Γ ≡ −∮V·ds`, y `Cd ≈ 1.2` del cilindro liso
subcrítico. **Lo que difiere es la normalización, y ahí está el peligro.**

1. **Intensidad del doblete — factor 2π.** Bertin define `B` con `φ = (B/r)cosθ` y
   `R = √(B/U∞)`; Anderson define `κ` con `φ = (κ/2π)(cosθ/r)` y `R = √(κ/(2πV∞))`.
   Entonces **`B = κ/2π`**. Si `src/aero/potencial.ts` toma la intensidad de una fuente y el radio de
   la otra, **el cilindro sale con radio √(2π) ≈ 2.5 veces equivocado**. El parámetro debe llevar su
   convención pegada.
2. **Signo del doblete.** Bertin lo orienta de modo que su φ **suma** al flujo uniforme (ec. 3.54);
   Anderson usa el convenio opuesto y su φ **resta**. Mismo resultado físico, distinto signo del
   término.
3. **Ángulo de referencia en el cilindro.** Bertin insiste (p.129) en que **θ = 180° es barlovento**,
   y cita la separación de Achenbach en esa convención (θ ≈ 100°), traduciendo a "80° desde el
   remanso". Anderson reporta la separación medida desde el remanso delantero. Números equivalentes,
   ejes distintos.
4. **Cd supercrítico del cilindro.** El valor "≈ 0.3" que suele citarse como mínimo post-crítico
   **NO aparece en Bertin cap. 3**; lo que hay es Cd = 0.6 a Re_d = 10⁷ [Talay (1975), Fig. 3.23e].
   La Forja no debe usar un único "Cd supercrítico": debe usar la pareja (Re, Cd) con su fuente.
5. **Cd de la esfera.** Anderson y la literatura reportan ≈ 0.5 subcrítico. **Bertin cap. 3 no da
   ningún valor numérico para la esfera.** Si La Forja necesita ese número, la fuente **no puede
   citarse como Bertin cap. 3.**
6. **Cobertura: paneles.** Anderson desarrolla el método de paneles de **vórtice** y la condición de
   Kutta numérica en el mismo bloque. **Bertin lo pospone explícitamente a sus caps. 6–7** (p.146) y
   en el cap. 3 sólo da paneles de **fuente** (cuerpos no sustentadores). Cualquier requisito de
   "vortex panel + Kutta" del pliego **no puede atribuirse a Bertin cap. 3**.
7. **Ventaja de Bertin:** da los teoremas de Helmholtz y Kelvin completos ya en el cap. 3, antes del
   perfil, mientras que Anderson los introduce más tarde junto con la teoría de ala. Y da la cadena
   completa IAS/CAS/EAS/TAS (§3.3) que Anderson trata más brevemente.

### 9.10 Capa límite: la trampa del factor √2 *(del bloque cap. 4)*

**La diferencia más peligrosa de todo el pliego, porque es silenciosa:**

```
Bertin  : η = y·√(u_e/(2νx))    f''(0) = 0.4696    (Tablas 4.2/4.3, pp.176-177)
Anderson: η = y·√(V∞/(νx))      f''(0) = 0.332     (§18, p.1018)
                                 0.332·√2 = 0.4695
```
**No es una diferencia de física, es de normalización de la variable de similitud.** Ambos llegan al
mismo `cf = 0.664/√Re_x`. Pero **mezclar la Tabla 4.3 de Bertin con una tabla de Blasius de otro
libro rompe todos los perfiles de velocidad por un factor √2**, y el error no se manifiesta en el
coeficiente de fricción — que es lo que uno verifica primero. Es el bug número uno esperable en
`viscoso`.

**Recomendación: elegir una convención, escribirla en el nombre de la variable
(`eta_bertin` / `eta_anderson`) y verificar la tabla completa, no sólo cf.**

Otros puntos del cap. 4:
- **Efecto de Mach y pared fría sobre la transición:** los dos libros **concuerdan exactamente**
  (Mach alto, succión y enfriamiento de la superficie retrasan la transición).
- **Corrección de transición para el Cf total:** concuerdan en el método de resta. Bertin añade la
  corrección cerrada `A/Re_L` con la Tabla 4.5, que Anderson no tiene.
- **`δ_T/δ ≈ 1/√Pr`** (Bertin p.216, citando Schlichting & Gersten 2000). No lo encontré en los
  pasajes de Anderson examinados; la forma más común en la literatura general es `Pr^{−1/3}`.
  **Marcado como valor específico de Bertin**, no como consenso.
- **Capa límite compresible:** cobertura distinta, no contradicción. Bertin la saca del cap. 4 y la
  remite a su cap. 8; Anderson sí la trata en el mismo bloque (§18–19). **Para el pliego: la
  compresibilidad de la capa límite se cita de Anderson §18–19 o de Bertin cap. 8, nunca del cap. 4
  de Bertin.**
- **κ y B de la ley logarítmica** (κ ≈ 0.40–0.41, B ≈ 5.0–5.5) y **β de separación de Falkner-Skan**
  (−0.1988): sin contradicciones detectadas.

### 9.11 Constantes: diferencias que sólo importan para fijar tolerancias

| Constante | Bertin | Anderson | Diferencia |
|---|---|---|---|
| R del aire (SI) | 287.05 N·m/kg·K | 287 J/(kg·K) | 0.017% |
| R del aire (inglés) | 1716.16 ft²/s²·°R | 1716 ft·lb/(slug·°R) | 0.009% |

Bertin además usa `R = 53.34 ft·lbf/lbm·°R` en paralelo, que exige arrastrar `gc = 32.174
ft·lbm/lbf·s²` (Ejemplo 1.8). **Ninguna de las dos diferencias importa físicamente, pero las dos
importan para la tolerancia de los tests**: un fixture con tolerancia de 0.001% fallaría sólo por
elegir el otro libro. **Tolerancia mínima recomendada para cualquier fixture cruzado: 0.1%.**

### 9.12 Dónde Bertin aporta lo que Anderson no tiene (no es contradicción, es la razón de comprarlo)

- **Todo el vocabulario geométrico del ala** (§9.1): mac, taper, flecha, torsión, diedro,
  incidencia, y la Tabla 5.1 con 30 aviones reales.
- **El método de arrastre parásito de avión completo** de Shevell (§5.4.6), componente por
  componente, **validado contra datos de vuelo del F-16**.
- **Datos de vuelo real contra predicción**: Boeing 727 (+15% sobre túnel), F-16 (predicho
  0.0151–0.0158, medido 0.0160–0.0190), F-106A/B (polar completa en vuelo).
- **La ingeniería de la rugosidad**: la definición literal de la "standard roughness" de la NACA, los
  granos de arena equivalentes por acabado, y el 6–9% de penalización de arrastre.
- **Las restricciones no aerodinámicas del diseño real** (Concept Box del C-17): envergadura de
  estacionamiento, camiones bajo el ala, radio de curvatura de manufactura.
- **Los números duros de ensayo**: ONERA M6 (span 1.1963 m, MAC 0.64607 m, AR 3.8, taper 0.562,
  flecha de borde de ataque 30.0°, Re ≈ 12×10⁶), túnel Ames 80×120 ft topado en ~100 nudos, el caso
  767 a M=0.95/12 km con Re ≈ 36×10⁶ contra un modelo radiocontrolado a ¼ de escala.
- **cf turbulento local** `0.0583/Re_x^0.2`, que no encontré publicado en Anderson.
- **La cadena IAS/CAS/EAS/TAS** completa (§3.3) y la Tabla 3.1.

### 9.13 Inconsistencias INTERNAS de Bertin (consigo mismo, no con Anderson)

Las registro aquí porque quien implemente va a tropezar con ellas y va a creer que su código está
mal. **No están corregidas en el texto original; el veredicto de cada una está justificado.**

| Dónde | Qué dice | Qué es correcto | Cómo lo verifiqué |
|---|---|---|---|
| Tabla 1.2A, 5 km | μ = 1.7885E-05 | ≈ 1.6282E-05 | rompe la monotonía (4 km: 1.6612E-05; 6 km: 1.5949E-05) y no lo reproduce Sutherland a 255.676 K |
| Tabla 1.2B, 8 kft | μ = 3.4764E-07 | ≈ 3.5760E-07 | misma anomalía de monotonía |
| Ejemplo 1.10, p.25 | "472.19 lbf/ft²" y dos renglones después "472.9" | **472.19** | es el consistente con la fórmula |
| §5.4.1 p.246 vs Ej. 5.3 p.249 | Clα = 0.104 /deg vs 0.1041 /deg | usar **0.1041** para reproducir el fixture | con 0.104 sale l = 3195.5 N/m en vez de 3197.6 |
| Ejemplo 5.5, p.271 | "− 170/11.18e6" | **1700** (ec. 5.37 y Tabla 4.5) | sólo con 1700 sale el Cf = 0.00280 que el libro tabula |
| §3.12.3 p.116 | componentes de velocidad del doblete con un 2π de más | vale la forma de **§3.13.1** | contradice su propia ec. (3.39a) y su propio uso; la de §3.13.1 reproduce R = √(B/U∞) |
| Tabla 3.1 | una celda con `1.59×10³` | `1.59×10⁴` | verificado con ½ρV² |
| Fig. 4.9 | rotula "65-606" | 65-006 | el texto del §4.3 lo trata como el 65-006 |
| Ec. (4.67a) | Π perdido en el OCR | reconstruido | 0.0168 × 1.55 = 0.02604 exacto |
| Ej. 4.3 | signo de β perdido | repuesto por derivación | — |
| Varios (7 en cap. 3, 3 en cap. 4, 2 en cap. 2) | referencias cruzadas de ecuación o figura equivocadas | listadas en la §7 | — |

**Lección de producto:** cargar un manual a ciegas también carga sus erratas. El motor necesita
**invariantes propios** —monotonía de las tablas atmosféricas, cierre dimensional, reproducción de
los fixtures por dos caminos independientes— que las detecten antes de que se conviertan en un
número que nadie cuestiona.
