# ESCUELA DE ROBÓTICA — Currícula maestra (Herath & St-Onge → La Forja)

**Fuente** (`docs/forja-research/manuales/robotica/`):
- **Herath & St-Onge (eds.)**, *Foundations of Robotics: A Multidisciplinary Approach with Python and ROS*
  (Springer 2022, open access, 18 caps, 549 pp) — la columna vertebral. Los capítulos técnicos que este curso
  explota: **cap 6** (matemáticas: marcos, rotaciones, cuaterniones, homogéneas, Jacobiano), **cap 7** (sensores,
  actuadores, motores), **cap 8** (robots móviles: ruedas/patas/PID/planeación), **cap 10** (brazos: DH, FK/IK,
  Jacobiano, singularidades, Euler-Lagrange/Newton-Euler), **cap 12** (CAD/CAM y prototipado), **cap 14**
  (seguridad: ISO 10218 / TS 15066), **caps 17-18** (proyectos: hexápodo + manipulador móvil 3-DoF).
- **El sustrato propio de La Forja** (ver inventario abajo): la biblioteca de mecanismos, el reductor cicloidal
  IMPRESO físicamente, el brazo de 3 eslabones, dinamica.ts, FEA/topopt, print-in-place.

**Misión (la visión del fundador, órdenes literales):**
1. **ESTANDARIZAR los movimientos y mecanismos** para reducir el tiempo de diseño. Como los tornillos DIN
   (942 SKUs que se INVOCAN por designación, no se dibujan), los mecanismos se invocan parametrizados:
   `MEC-GINEBRA N6 C40`, `MEC-CICLOIDAL 11:1 R28`, `MEC-PLANETARIO S12 P18 R48`. El corazón del curso es
   ese CATÁLOGO INVOCABLE.
2. **"Un avión es un robot gigante."** Los mecanismos son el sustrato compartido de TODA máquina: el alerón
   es un cuatro-barras, el tren de aterrizaje un slider-crank, el flap un tornillo de potencia. Este curso
   enseña el catálogo de movimientos (rot→rot, rot→lin, continuo→intermitente, continuo→oscilante) y CUÁNDO
   invocar cuál.
3. **Robótica aquí = DISEÑO y FÍSICA del robot** (cinemática, DH, dinámica, actuadores, reductores,
   mecanismos, estructuras con FEA). NO es un curso de ROS: los caps 4-5 (Python/ROS) y la percepción se
   marcan como **labs NOVA/Pico** (placa propia RP2350) o fuera de alcance v1.

## La regla de oro (heredada de mecánica y aero): UNA lección = UN archivo de datos → TRES salidas

Cada lección vive en `src/escuela/robotica/lecciones/<id>.json` (pasos: narración + gestos + checks) y de ahí
salen: (1) **CLASE EN VIDEO** — `clase-drive.cjs` maneja La Forja real mientras Matilda narra; master 4K HEVC
10-bit; (2) **TUTORIAL INTERACTIVO** — el alumno invoca el mecanismo y lo mide con SUS manos; (3) **RETO
CALIFICADO** — auto-calificación exacta por invariantes.

**El sello de mecánica era "el kernel no miente"; el de aero "la física no miente". El de robótica es
"EL MECANISMO NO MIENTE":** cada lección cierra midiendo el mecanismo ANIMADO (o la pieza del kernel) contra
la fórmula: DOF de Grübler contra el modelo articulado, relación de transmisión medida frame a frame, torque
estático contra `dinamica.ts`, alcance del workspace, masa EXACTA del kernel (volumen×densidad). Los fixtures
se transcriben LITERALES del libro (ejemplos caps 10/17/18) o de datasheets/normas reales — PROHIBIDO inventar
curvas o dimensiones (regla Kazmer).

## El sustrato existente (inventario — la currícula lo EXPLOTA)

| Módulo | Qué tiene | Estado |
|---|---|---|
| `src/lib/parts/gear-pair.ts` + `involute-gear-sketch.ts` + `spur-gear.ts` | par de involutas real, `contactRatio()`, `expectedGear2Angle()`, joints animables | ✅ |
| `src/lib/parts/planetary.ts` | Willis completo, 6 reducciones, `planetaryWillisResidual()` | ✅ |
| `src/lib/parts/slider-crank.ts` | x(θ) exacta, carrera, ángulo de presión, excentricidad | ✅ |
| `src/lib/parts/geneva.ts` | cruz de Malta: sin(π/N)=a/C, dwell 1/2+1/N, cinemática de engagement | ✅ |
| `src/lib/parts/escapement.ts` + `clock.ts` | escape Graham + péndulo (serie de amplitud) + RELOJ completo (invariante 1/1440) | ✅ |
| `src/lib/parts/gear-mechanics.ts` | Lewis (σ del diente), `analyzeGearLoad`, aligerado óptimo | ✅ |
| `src/forja/mech/cycloidal.ts` | perfil cicloidal REAL (equidistante de hipocicloide), N:1 — **impreso físicamente 11:1** (hito 2026-06-05; GA evolutivo; falla real del eje → journal cada lado) | ✅ |
| `src/forja/mech/brazo.ts` | brazo 3 eslabones: `jointTorques`, `sizeJoint`, `sizeArm`, `capacitySweep` — hombro R28+3discos, gimbal 2-DOF diseñado | ✅ |
| `src/forja/mech/armgen.ts` | `grublerMobility`, FK planar, `workspace` (rMax/rMin), `grashof`, receta imprimible de eslabón | ✅ |
| `src/forja/mech/dinamica.ts` (14 tests) | `vehicleDynamics` (tracción/pendiente/torque de rueda) + `armStatics` (τ por junta) | ✅ |
| `src/forja/mech/printinplace.ts` (20 tests) | ventana de holgura FDM (GAP), balero anidado, `journalBearing`, `tubeStack` | ✅ |
| `src/forja/brep/fea.ts` + `topopt.ts` + `topopt-am.ts` | FEA von Mises verificada vs cantilever; SIMP top88; auto-soporte 45° | ✅ |
| `src/forja/brep/thread.ts` + `src/lib/parts/fasteners/` | rosca ISO 68-1 real + 942 SKUs DIN invocables (btn-din) | ✅ |
| Cinemática 3D (DH), IK, Jacobiano, singularidades | — NO existe nada (grep confirmado) | ❌ |
| Catálogo de mecanismos UI (el invocador), motor-specs, trayectorias, four-bar/leva/cardán | — NO existen | ❌ |

## Las 10 unidades (57 lecciones)

### U1 · El robot desarmado: eslabones, juntas y grados de libertad (Herath caps 1, 10, 17.2) — 5 lecciones
| id | Lección | Fuente | Comprobación ("el mecanismo no miente") | Estado Forja |
|---|---|---|---|---|
| r1-l1 | ¿Qué es un robot? Del autómata de Herón al cobot de Kinova: inteligencia + cuerpo. Y la tesis del curso: UN AVIÓN ES UN ROBOT GIGANTE — toda máquina es eslabones + juntas + actuadores | cap 1; §10 intro | Desarmar el reductor en el Studio (btn-explode) y contar eslabones y juntas → M de Grübler del ensamble | ✅ explode + `grublerMobility` |
| r1-l2 | Las juntas: los 6 pares inferiores (revoluta, prismática, helicoidal, cilíndrica, esférica, plana) — cuántos DOF quita cada una | §10 (arquitecturas); §17.2 | El joint graph del kernel declara los DOF de cada junta; la suma cuadra con Grübler | ⚠️ revoluta ✅ (`joints.ts`); prismática/esférica en joint graph ❌ |
| r1-l3 | El número que da miedo: M = 3(n−1) − 2·j1 − j2 (Grübler-Kutzbach). M=1 se mueve, M=0 es estructura, M≥2 baila. Qué se rompe: sobre-restringir = se traba con tolerancias reales | §10; §17.2 | `grublerMobility()` vs el mecanismo animado: 4 barras M=1, 5 barras M=2, el reductor M=1 | ✅ `armgen.grublerMobility` |
| r1-l4 | Serial vs paralelo vs cadena cerrada + Grashof: s+l ≤ p+q — cuándo la manivela SÍ da la vuelta completa | §10 | `grashof()` clasifica (crank-rocker/double-rocker); la animación lo confirma o se atora | ⚠️ `grashof()` ✅; animación four-bar ❌ (U3) |
| r1-l5 | EL CATÁLOGO DE MOVIMIENTOS: la tabla rot→rot / rot→lin / continuo→intermitente / continuo→oscilante — el mapa para INVOCAR el mecanismo correcto. "No lo dibujes: invócalo" (como DIN 933) | Forja (visión) + §12 | Cada celda del catálogo: el mecanismo invocado cumple su ley cinemática medida en la animación | ⚠️ builders ✅; invocador UI ❌ (feature #1) |

### U2 · La biblioteca invocable I: los seis que YA viven en La Forja (sustrato propio; §10/§12 como marco) — 6 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r2-l1 | Par de engranes: ω1·z1 = −ω2·z2, la involuta real, y el contact ratio ≥ 1.2 (si baja de 1, el diente SUELTA al siguiente antes de agarrar: martilleo) | Forja; §12 | Ángulo medido del engrane 2 = `expectedGear2Angle()`; `contactRatio()` ≥ 1.2 | ✅ `gear-pair.ts` |
| r2-l2 | Tren planetario: Willis (ω_ring−ω_c)/(ω_sun−ω_c) = −S/R — SEIS reducciones distintas del mismo fierro según qué miembro fijas | Forja | `planetaryWillisResidual()` = 0 en cada frame de la animación; R = S+2P | ✅ `planetary.ts` |
| r2-l3 | Biela-manivela: x(θ) = r·cosθ + √(L²−(e−r·sinθ)²); carrera = 2r; el ángulo de presión que atora | Forja | Carrera medida en la animación = 2r exacto (e=0); |β|max = asin((r+|e|)/L) | ✅ `slider-crank.ts` |
| r2-l4 | Cruz de Malta (Ginebra): continuo → INTERMITENTE. sin(π/N) = a/C; fracción de reposo = 1/2 + 1/N — el mecanismo del proyector de cine y del indexado CNC | Forja | Dwell medido sobre una vuelta = 1/2+1/N; avance por engagement = 2π/N exacto | ✅ `geneva.ts` |
| r2-l5 | El escape de Graham: el mecanismo que hace tic-tac. ω_esc = 4π/(N·T); T = 2π√(L/g)·[1 + A²/16 + …] — continuo → oscilante y de regreso | Forja | Dos tics por periodo medidos; periodo vs péndulo al 0.1%; la serie de amplitud aparece al abrir A | ✅ `escapement.ts` |
| r2-l6 | EL RELOJ completo: tren compuesto — el invariante 1/1440. Péndulo de 2 s → segundero, minutero, horario | Forja | ω_hour/ω_escape = 1/1440 medido; `formatClockTime` da la hora que lees en las manecillas | ✅ `clock.ts` |

### U3 · La biblioteca invocable II: los movimientos que FALTAN en el catálogo (Forja + §10/§12) — 6 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r3-l1 | Cuatro barras: síntesis de Grashof — diseña el crank-rocker que traza TU curva de acoplador (la suspensión, el limpiaparabrisas, el alerón) | Forja; §10 | Tipo Grashof predicho vs animación; curva de acoplador trazada = la calculada punto a punto | ❌ `four-bar.ts` (builder + coupler curve; `grashof()` ya existe) |
| r3-l2 | Levas: el movimiento que TÚ dibujas. Perfil desde la ley (armónica/cicloidal); por qué la aceleración discontinua MARTILLA (jerk infinito) | Forja | El seguidor animado reproduce s(θ) al 0.1%; jerk finito en ley cicloidal, infinito en la parabólica | ❌ `cam.ts` |
| r3-l3 | Tornillo de potencia: rot → lin con ventaja mecánica brutal. Avance = entradas·paso; autobloqueo si μ > tan(λ) — por qué el gato del coche NO se baja solo | Forja | Avance por vuelta medido = paso exacto; condición de autobloqueo vs μ del material | ⚠️ `thread.ts` (rosca ISO real) ✅; math de power screw ❌ |
| r3-l4 | Piñón-cremallera: v = ω·m·z/2 — la dirección de tu coche y el eje Z de la impresora | Forja (pendiente desde bethune u10-l6) | v_cremallera/ω_piñón = m·z/2 exacto en la animación | ❌ `rack-pinion` |
| r3-l5 | Junta cardán: rotar entre ejes que se cruzan — y la MENTIRA de la velocidad constante: ω2/ω1 fluctúa con cos β; por qué van en PARES (doble cardán la cancela) | Forja | Fluctuación de velocidad medida vs fórmula exacta; el doble cardán en fase la cancela a cero | ❌ `ujoint.ts` |
| r3-l6 | El gimbal de 2 ejes: apuntar a toda la esfera con dos revolutas perpendiculares — y la primera cita con el gimbal lock | Forja (gimbal 2-DOF del brazo, diseñado) | Cobertura angular medida por Monte Carlo; el lock aparece EXACTO al alinear los ejes | ⚠️ diseño ✅; lección + medición ❌ |

### U4 · El espacio en números: marcos, rotaciones, cuaterniones (Herath cap 6) — 5 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r4-l1 | Marcos de referencia: dónde está cada pieza (frame mundo / frame pieza) — lo que el kernel hace en silencio en cada ensamble | §6.3 | Transformar un punto del frame pieza al mundo vs la posición medida por el kernel | ⚠️ transforms del kernel ✅; lección = exponerlos |
| r4-l2 | Matrices de rotación: R·Rᵀ = I, det(R) = +1 — por qué una rotación no estira NADA | §6.4.1 | R·Rᵀ = I al epsilon numérico; componer dos rotaciones da otra rotación (se verifica) | ⚠️ lab numérico chico |
| r4-l3 | Ángulos de Euler y el GIMBAL LOCK: la falla geométrica real que tu gimbal (r3-l6) sufre en el fierro | §6.4.1-6.4.3 | En pitch = 90° dos ejes colapsan: el rank del mapeo de velocidades cae de 3 a 2 (medido) | ❌ lab chico |
| r4-l4 | Cuaterniones: 4 números, cero lock. q = (cos θ/2, u·sin θ/2); rotar = q·p·q⁻¹ — por qué TODO motor de juego y todo dron los usa | §6.4.3 | Rotación por cuaternión = por matriz al epsilon; slerp da velocidad angular constante (medida) | ❌ lab chico (R3F ya usa quats por dentro) |
| r4-l5 | La homogénea 4×4: rotar + trasladar en UNA multiplicación — el idioma de la cinemática y del kernel OCCT | §6.4.4 | T1·T2 aplicada a la pieza = componer a mano; T·T⁻¹ = I | ⚠️ kernel ✅; lección los expone |

### U5 · Cinemática del brazo: del ángulo del motor a la punta (Herath cap 10; §17.3-17.4, §18.4) — 8 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r5-l1 | FK planar 2R a mano: x = l1·cosθ1 + l2·cos(θ1+θ2), y = … — tu primera cinemática directa | §10 (FK); §17.3 | FK calculada vs posición de la punta medida en el ensamble del kernel | ✅ `armgen.forwardKinematics` |
| r5-l2 | La convención DH: CUATRO números por eslabón (a, α, d, θ) desmitifican CUALQUIER brazo del planeta | §10 (DH) | Tabla DH del 3-DoF del libro → FK reproduce el ejemplo LITERAL (fixture del cap 10) | ❌ `dh.ts` |
| r5-l3 | FK 3D del brazo Forja (base-yaw + hombro + codo): la cadena T = A1·A2·A3 | §10; §18.4 | Punta calculada vs el ensamble real del brazo de 3 eslabones (hombro R28) en el kernel | ❌ `dh.ts` (mismo módulo) |
| r5-l4 | El WORKSPACE: todo lo que tu brazo alcanza — rMax = Σl, rMin, la esfera hueca; Monte Carlo del espacio alcanzable (el plot que vende el robot) | §10; §17.3 | rMax medido = Σ links exacto; el volumen Monte Carlo converge; puntos fuera son inalcanzables por IK | ⚠️ `workspace()` 2D ✅; nube 3D + plot ❌ |
| r5-l5 | IK analítica del 2R: cosθ2 = (x²+y²−l1²−l2²)/(2·l1·l2) — codo arriba/codo abajo, y cuándo NO hay solución | §10 (IK); §18.2 | FK(IK(p)) = p al micrómetro; las dos ramas dan la misma punta | ❌ `ik.ts` |
| r5-l6 | IK numérica: Newton-Gauss — q_{k+1} = q_k − J⁻¹·f(q_k); por qué converge y cuándo EXPLOTA (cerca de singularidad) | §10 (IK numérica) | Converge < 10 iteraciones a |error| < 1e-6; diverge documentadamente en la singularidad | ❌ `ik.ts` (mismo módulo) |
| r5-l7 | El Jacobiano de velocidades: t = J(q)·q̇ — el mapa de lo que hacen los motores a lo que hace la punta | §10 (Jacobiano); §17.4 | J por diferencias finitas de FK = J analítico al 1e-6 | ❌ `jacobian.ts` |
| r5-l8 | Singularidades: donde det(J) = 0 el brazo PIERDE un DOF (brazo estirado, muñeca alineada) — por qué el robot industrial se sacude ahí; el pantógrafo y las singularidades tipo I/II | §10 (singularidades, paralelos) | det(J) → 0 medido al estirar el brazo; la velocidad articular pedida → ∞ (graficada) | ❌ (usa `jacobian.ts`) |

### U6 · Dinámica: por qué el TORQUE del hombro manda (Herath §10 dinámica; `dinamica.ts`) — 5 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r6-l1 | Estática del brazo horizontal: τ_j = g·Σ(m_i·d_i) + g·m_carga·alcance — el PEOR caso, el número que dimensiona todo el robot | §10 (dinámica); Forja | `armStatics()` vs masa EXACTA de cada eslabón medida por el kernel (volumen×densidad) | ✅ `dinamica.armStatics` (14 tests) |
| r6-l2 | El brazo se come a sí mismo: masa propia vs carga útil — por qué el payload es ~1/10 del peso del brazo; `beamMass` del tubo de PLA | Forja (`brazo.ts`) | τ_hombro con/sin masa propia; relación payload/masa del brazo real de 3 eslabones | ✅ `brazo.jointTorques` |
| r6-l3 | Euler-Lagrange del 2R: L = T − V; d/dt(∂L/∂q̇) − ∂L/∂q = τ — la derivación DENSA paso a paso (ejemplo literal del libro, ecs. 64-67) | §10 (Euler-Lagrange) | τ(t) de Lagrange vs integración numérica del movimiento; en q̇ = 0 colapsa EXACTO a `armStatics` | ❌ `lagrange2r.ts` |
| r6-l4 | Newton-Euler y las reacciones: qué fuerza siente CADA junta — el número que dimensiona el balero | §10 (Newton-Euler) | Reacciones estáticas vs suma de pesos distales exacta; cruza con `journalBearing` (r7-l6) | ⚠️ estático ✅; recursivo = teoría |
| r6-l5 | El robot móvil como cuerpo: peso → carga por rueda → tracción μN → pendiente máxima tanθ ≤ μ·(motrices/ruedas) | Forja (`dinamica.ts`); §8.3 | Pendiente máxima predicha vs sim; torque de rueda τ = F·r | ✅ `vehicleDynamics` |

### U7 · Actuadores y reducción: el músculo y su palanca (Herath §7.5; cicloidal + print físico) — 7 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r7-l1 | Motores: DC escobillas, BLDC, stepper, servo — la curva torque-velocidad τ = τ_stall·(1 − ω/ω_free); la potencia máxima vive a MITAD de la curva | §7.5.1 | P(ω) = τ·ω máxima en ω_free/2 (exacto de la recta); punto de operación = cruce con la carga | ❌ `motor-specs.ts` (datasheets literales) |
| r7-l2 | Por qué SIEMPRE hay reductor: el motor da rpm baratas, el robot pide N·m. τ_out = i·η·τ_in; la inercia reflejada cae con i² — el secreto del control suave | §7.5.1; Forja | Con el datasheet del servo hobby y τ_hombro (r6-l1): i requerido sale solo (≈ 11:1 del print real) | ⚠️ math ✅ disperso; módulo ❌ |
| r7-l3 | EL REDUCTOR CICLOIDAL: disco de N lóbulos + N+1 pernos + excéntrico = N:1 en UNA etapa impresa. El perfil real (equidistante de la hipocicloide) — este reductor EXISTE, lo imprimimos | Forja (`cycloidal.ts` + hito físico) | `countLobes(profile)` = N; ratio medido en animación = N:1; E < R/(2·pins) válido | ✅ + print físico 11:1 + GA evolutivo |
| r7-l4 | Dimensionar la junta: capacidad vs torque requerido — `sizeJoint`/`capacitySweep`; por qué el hombro real salió R28 + 3 discos | Forja (`brazo.ts`) | `sizeArm()` del brazo 3 eslabones reproduce hombro R28+3discos; SF ≥ 2 | ✅ |
| r7-l5 | Holgura y backlash: la ventana g_weld < g < g_play del print-in-place — el 0.300 mm del 11:1 real; por qué el backlash mata la precisión (y el cicloidal casi no tiene) | Forja (`printinplace.ts`); §12 | `clearance(0.30,'PLA')` = ok; fuera de ventana falla como predicho (suelda o baila) | ✅ (20 tests) |
| r7-l6 | Baleros: journal p = W/(2·r·L) ≤ p_adm; T_fric = μ·W·r; el balero anidado impreso — y la FALLA REAL del primer print: el eje no se autocentra → journal CADA lado | Forja (`printinplace.ts` + experiencia) | `journalBearing()` del hombro cargado: presión bajo p_adm; T_fric medible en el sim | ✅ |
| r7-l7 | El diente bajo carga: Lewis σ = F/(m·b·Y) — cuánto torque aguanta tu engrane impreso antes de TRONAR el diente | Forja (`gear-mechanics.ts`) | `analyzeGearLoad()` vs σ_PLA = 50 MPa; el diente truena donde Lewis dice | ✅ |

### U8 · Estructura: el esqueleto que no vibra (Herath §12; `brep/fea.ts`, topopt) — 5 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r8-l1 | El eslabón es una viga: σ = M·c/I; δ = P·L³/(3·E·I) — el VOLADIZO AL CUBO: duplicar el largo = 8× la flecha | §12; Forja | FEA vs analítico del cantilever (el test canónico ya verificado) | ✅ `fea.ts` |
| r8-l2 | FEA del eslabón REAL: von Mises sobre la malla tet del B-Rep, cargas del face-picking — DÓNDE se rompe TU pieza | Forja | σ_max vs σ_adm con SF; el hotspot cae donde M es máximo (raíz del voladizo) | ✅ `fea.ts` |
| r8-l3 | Topopt: dale el envolvente + cargas y La Forja QUITA material (SIMP top88) — el eslabón esqueleto que Autodesk cobra carísimo | Forja | Compliance baja monotónica; fracción de volumen exacta a la pedida | ✅ `topopt.ts` |
| r8-l4 | Topopt IMPRIMIBLE: auto-soporte 45°, regiones congeladas (los barrenos de junta NO se tocan) | Forja; §12 (AM) | Voladizos ≤ 45° medidos en el resultado; barrenos intactos | ✅ `topopt-am.ts` |
| r8-l5 | Por qué el robot VIBRA: rigidez, masa y la primera frecuencia f1 — si le pides al control más velocidad que f1, el brazo baila. Rayleigh sobre la malla FEA | Forja | f1 estimada (Rayleigh) vs analítico del cantilever: f1 = (3.516/2π)·√(EI/(ρ·A·L⁴)) | ❌ `modal.ts` (Rayleigh sobre FEA existente) |

### U9 · El robot que se mueve: ruedas, patas y trayectorias (Herath caps 8, 9, 17) — 6 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r9-l1 | Tracción diferencial: v = r(ωR+ωL)/2; ω = r(ωR−ωL)/b — el uniciclo; por qué NO puede moverse lateral (no-holonómico) | §8.3.1 | Radio de giro predicho vs trayectoria integrada; ωL = ωR → línea recta exacta | ❌ `diffdrive.ts` |
| r9-l2 | Ackermann y omni: el coche no gira sobre su eje, la omni sí — la geometría del centro instantáneo de rotación (ICR) | §8.3.1 | ICR común a las 4 ruedas (Ackermann) medido; la omni alcanza cualquier (v, ω) | ⚠️ mismo módulo |
| r9-l3 | El hexápodo: estabilidad ESTÁTICA — el CG dentro del polígono de soporte; el tripod gait 3+3; la pata es un brazo 3-DoF | §8.3.2; cap 17 | Margen de estabilidad ≥ 0 en cada frame del gait; FK de pata vs ejemplo literal del cap 17 | ❌ `gait.ts` (reusa `dh.ts`) |
| r9-l4 | Trayectorias con física: perfil trapezoidal y S-curve — v y a acotadas; por qué el JERK sacude la estructura (conecta con f1 de r8-l5) | §8; Forja | v ≤ vmax y a ≤ amax exactos; tiempo mínimo del perfil = analítico | ❌ `trayectorias.ts` |
| r9-l5 | Control PID: P te acerca, I mata el error residual (el peso del brazo), D amortigua — sintonizar sin llorar (Ziegler-Nichols de arranque) | §8.4.1 | Overshoot y settling time medidos vs predicción de 2º orden; sin I queda error estático = el peso | ❌ `pid.ts` (sim 1-DoF con dinámica del brazo) |
| r9-l6 | Odometría y por qué el robot SE PIERDE: integrar encoders acumula error sin cota; el error angular domina — el porqué de SLAM (v2) | §9.3 | Error de odometría crece con la distancia en la sim; drift angular > drift lineal | ⚠️ teoría + sim chica; encoders reales = **lab NOVA/Pico** |

### U10 · Capstone: DISEÑA tu robot (Herath caps 10, 12, 14, 17, 18) — 4 lecciones
| id | Lección | Fuente | Comprobación | Estado Forja |
|---|---|---|---|---|
| r10-l1 | Seguridad: ISO 10218 + ISO/TS 15066 — los límites de fuerza y presión del cobot. Qué se rompe: EL HUMANO. (Tabla de límites biomecánicos, literal de la norma) | cap 14 | Fuerza en la punta del brazo Forja (τ/alcance) vs límite de la tabla TS 15066 por región del cuerpo | ⚠️ teoría + tabla (datos literales) |
| r10-l2 | El brazo completo por INVOCACIÓN: specs (payload, alcance) → `sizeArm` → cicloidales dimensionados → eslabones topopt → tornillos DIN → BOM con masa exacta | Forja (todo el sustrato) | Masa total exacta del kernel; τ_hombro ≤ capacidad de junta; Grübler M = 3; BOM completa | ⚠️ piezas ✅; invocador UI ❌ |
| r10-l3 | El hexápodo Forja: 6 patas 3-DoF, 18 servos — geometría desde el cap 17, piezas del kernel, gait de r9-l3 | cap 17; §12.13 | FK de pata vs libro (literal); estabilidad del gait; masa por pata vs torque del servo elegido | ❌ (usa `dh.ts` + `gait.ts` + `motor-specs.ts`) |
| r10-l4 | EXAMEN ROBOTISTA: misión dada (payload, alcance, precisión) → entregas el robot: mecanismos invocados, torques, FEA, BOM. Auto-calificado por invariantes | caps 17-18 (proyectos) | Pipeline completo: ¿cumple payload con SF ≥ 2? ¿el workspace cubre el objetivo? ¿masa en presupuesto? | ❌ integra todo (patrón del examen Forjador) |

## Orden de producción (por valor y por sustrato existente)

1. **U2 entera** — los SEIS mecanismos ya existen con cinemática real y joints; solo falta el invocador UI
   (feature #1) y los JSON de lección. Valida el pipeline de clases de robótica con sustrato máximo.
2. **U7 + U6** — el DIFERENCIADOR que nadie tiene: el reductor cicloidal impreso FÍSICAMENTE (con su falla
   real del eje), `dinamica.ts`/`brazo.ts` testeados. "Este número no es de un libro: es de MI mesa."
3. **U1** — Grübler ya existe; da el marco del catálogo y el gancho "un avión es un robot gigante".
4. **U8** — FEA/topopt ya verificados; solo `modal.ts` (chico) es nuevo.
5. **`dh.ts` + `ik.ts` + `jacobian.ts` → U4 + U5** — el corazón NUEVO del curso; los ejemplos de los caps
   10/17/18 son los fixtures literales. Desbloquea también r9-l3 y r10-l3.
6. **U3** — expande el catálogo (four-bar, leva, cardán…); el patrón params→geometry→kinematics→build→scene
   ya está probado seis veces.
7. **U9** — móviles; los encoders/IMU reales van como labs NOVA/Pico (RP2350).
8. **U10** — el capstone al final (necesita el invocador + dh/ik + gait).

## Features por construir (ordenadas por lecciones que desbloquean)

| # | Feature | Qué es | Lecciones que desbloquea | Esfuerzo |
|---|---|---|---|---|
| 1 | **Catálogo de Mecanismos UI (el INVOCADOR)** | Botón "Mecanismo" estilo btn-din: designación paramétrica (`MEC-GINEBRA N6 C40`, `MEC-CICLOIDAL 11:1 R28`) → ensamble en el Studio con joints animables + designación en la BOM. Los 7 builders + cicloidal YA existen: es CABLEARLOS | ~9 directas (r1-l5, U2 entera, r10-l2) + transversal a todo el curso | Medio (UI + gramática de designaciones; cero math nueva) |
| 2 | **`dh.ts` + `ik.ts` + `jacobian.ts`** | FK 3D por tabla DH (cadena de homogéneas), IK analítica 2R + Newton-Gauss, Jacobiano analítico/numérico + det(J). Puro, testeable; fixtures = ejemplos literales de caps 10/17/18 | ~10 (U5 casi entera, r9-l3, r10-l3, r4-l5 upgrade) | Medio (math chica y bien especificada por el libro) |
| 3 | **Mecanismos faltantes**: `four-bar.ts`, `cam.ts`, `power-screw.ts`, `rack-pinion`, `ujoint.ts` | Mismo patrón probado 6 veces: params → geometry → kinematics → build → scene + invariante | ~6 (U3 entera) + enriquece el catálogo invocable | Medio (5 módulos chicos) |
| 4 | **`motor-specs.ts` + `trayectorias.ts`** | Curva τ-ω paramétrica + catálogo de motores reales (datasheets hobby/NEMA transcritos literales); perfiles trapezoidal/S-curve | ~5 (r7-l1/l2, r9-l4/l5, r10-l3) | Chico |
| 5 | **Workspace 3D + singularidades viz** | Nube Monte Carlo del alcance (R3F points) + heatmap de det(J) — el reel jugoso: "TODO lo que tu brazo alcanza" | ~3 (r5-l4, r5-l8) + cine/reels | Chico |
| 6 | **`lagrange2r.ts`** | Dinámica 2R del ejemplo literal del libro (ecs. 64-67); check: en q̇=0 colapsa a `armStatics` | ~2 (r6-l3/l4) | Chico |
| 7 | **`modal.ts`** (Rayleigh sobre FEA) | Primera frecuencia f1 del eslabón desde la malla FEA existente vs analítico del cantilever | ~2 (r8-l5, cierra r9-l4) | Chico |
| 8 | **`diffdrive.ts` + `gait.ts` + `pid.ts`** | Cinemática del uniciclo/Ackermann, tripod gait con margen de estabilidad, PID 1-DoF con la dinámica real del brazo | ~5 (U9) | Chico-medio |
| 9 | **Joint graph extendido** (prismática/esférica) | Los 6 pares inferiores declarables en el kernel para que Grübler se mida sobre CUALQUIER ensamble | ~2 (r1-l2, mejora r1-l3) | Chico |

**Fuera de alcance v1 (se marca, no se finge):** ROS (caps 4-5) y percepción/visión (§7.3, §7.6) → **labs
NOVA/Pico** (la placa RP2350 propia es el firmware del robot real, no v1 de la escuela); SLAM/Kalman/EKF
(cap 9 grueso) → v2; enjambres (cap 11), robots sociales/user studies (cap 13), ML (cap 15) y ética
(cap 16, salvo la nota de r10-l1) → fuera de alcance; manipuladores paralelos completos (delta/Stewart) →
v2 (el pantógrafo se enseña en r5-l8 como caso de singularidades).

## Reglas de autoría de las clases (heredan del proyecto)

- Español mexicano (tú/tienes). Narración con aire (~0.6 s). Fórmulas en ASCII en consola/subtítulos.
- Gancho en los primeros 5 s: el número que da miedo o el fierro real ("este reductor lo imprimí y aquí
  está la falla"; "tu brazo pierde un grado de libertad y no te avisa").
- Estilo "desmitificar" (como el CNC): número que da miedo → fórmula real → qué se rompe si lo ignoras.
- Historia como gancho, no relleno: el cap 1 del libro trae lista la genealogía (Ctesibios, Herón,
  el telar, Capek, el Golem) — cada mecanismo del catálogo tiene 2000 años de historia.
- Toda curva en pantalla es CALCULADA en vivo o transcrita literal (libro/datasheet/norma) — regla Kazmer.
- Verificación SIEMPRE: cada lección cierra con "el mecanismo no miente" — el número del alumno contra el
  mecanismo animado, el kernel o el dato publicado, con la fuente en pantalla.
- Master 4K (3840×2160 horizontal para clases) HEVC 10-bit NVENC. 1080 solo preview.
