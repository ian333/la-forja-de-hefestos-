# Pliego Raymer: del croquis al avion dimensionado, dentro del CAD

**Libro:** Raymer — Aircraft Design: A Conceptual Approach, 6e (AIAA 2018)  
**Fecha:** 2026-08-28 · 3/3 tramos leidos (caps 1–23; cap 24 solo como fuente de fixtures) · 130 ejercicios · 19 supertickets

## 0. El autor como cliente

Raymer es el cliente que NO quiere un CAD 'demasiado bueno' (§2.1.4) sino un LAZO barato que se corre 5–25 veces: requisitos -> croquis -> sizing (W0 punto fijo) -> layout -> analisis as-drawn (arrastre, pesos, estabilidad, desempeno) -> resizing -> carpet/MVO -> Dash-N. Exige que el CAD ENTREGUE las cantidades de referencia (S_ref/S_exp/S_wet, A_max por estacion, volumen interno, brazos c/4, CG e inercias) y que sus metodos a mano sean 'el detector de mentiras' del CFD/FEA. Cada correlacion declara su dominio y avisa al salirse; las decisiones humanas (CLmax asumido, fudge, E_wd, Q) se registran con autor; las restricciones son salida del dialogo, no entrada; el combustible es la variable de cierre, jamas W0 tecleado. El unico numero impreso de todo el libro es el DR-3/DR-1 del cap 24 (RDS): esa corrida es la vara de oro (25 filas de sizing, build-up en counts, GWS de 10,947.2 lb, despegue 723.6 ft, Ps con K no constante, MVO 15,242 lb). Prueba de aceptacion obligatoria: tubo+cono+ala a mano vs CAD (§7.11).

Frase que manda (competencia-mercado F.1): *somos el detector de mentiras del CFD, no su sustituto*.

## 1. Capitulos y cobertura en La Forja

| Cap | Titulo | Ejercicios | Cubierto | Nota |
|---|---|---|---|---|
| 1 | Design — A Separate Discipline | 0 | no | Teoria/posicionamiento; sin ejercicios. Valor de producto: 'detector de mentiras del CFD' (competencia-mercado F.1). |
| 2 | Overview of the Design Process | 1 | no | Ciclo Dash-One->Dash-N; 1 ejercicio (hoja de requisitos). |
| 3 | Sizing from a Conceptual Sketch | 7 | no | ASW Boxes 3.1–3.4 = 25 filas de iteracion impresas; nada en src (grep sizing/breguet src/aero -> 0). |
| 4 | Airfoil and Wing/Tail Geometry Selection | 3 | parcial | sketch-solver spline via loadDoc; sin generador NACA ni tablas de seleccion. |
| 5 | Thrust-to-Weight Ratio and Wing Loading | 9 | parcial | Solo atmosfera.ts (rho, q); ninguna restriccion T/W–W/S. |
| 6 | Initial Sizing | 5 | parcial | wing-metrics.ts mide MAC/Ybar; sin sizing refinado ni colas por volumen. |
| 7 | Configuration Layout and Loft | 13 | parcial | occt.ts volume/surfaceArea/loftSections/fillet/VolumeProperties; drawing.ts 3 vistas; sin conica, buttock-planes ni bench tubo+cono. |
| 8 | Special Considerations in Configuration Layout | 5 | parcial | shellSolid/common/fea.ts existen; sin curvatura, area ruling ni bisagras. |
| 9 | Crew Station, Passengers, and Payload | 3 | no | Nada (grep cabina/pasajero -> solo moldes). |
| 10 | Propulsion and Fuel System Integration | 8 | parcial | Solo volumen/centroide del solido para tanques; nada de motor/tomas. |
| 11 | Landing Gear and Subsystems | 7 | parcial | mech/fourbar.ts + mech/ensamble.ts reusables; sin llantas/oleo/jueces. |
| 12 | Aerodynamics | 12 | parcial | skin.ts (S_wet), wing-metrics.ts (S_exp), potencial/panel2d 2D; sin build-up, CL_alpha 3D ni K(CL); tablas digitalizadas solo en docs. |
| 13 | Propulsion | 4 | parcial | atmosfera.ts para Gagg-Ferrar; sin empuje instalado ni helice. |
| 14 | Structures and Loads | 6 | parcial | fea.ts von Mises; sin V-n, Schrenk ni pandeo lineal. |
| 15 | Weights | 5 | parcial | occt masa-inercia/centroide; sin las 59 ecuaciones ni GWS. |
| 16 | Stability, Control, and Handling Qualities | 8 | no | Figuras ya digitalizadas en aero-pliego/raymer-rescate-cap16.md; codigo cero. |
| 17 | Performance and Flight Mechanics | 9 | parcial | atmosfera.ts (ISA, q, mach); sin desempeno. |
| 18 | Cost Analysis | 4 | no | Nada; ecs 18.8/18.10–18.13 ilegibles en OCR. |
| 19 | Sizing and Trade Studies | 9 | parcial | occt volumen/bbox para el gate de densidad; sin sizing/carpet/MVO. |
| 20 | Electric Aircraft | 2 | no | Nada. |
| 21 | Vertical Flight — Jet and Prop | 3 | no | Nada. |
| 22 | Extremes of Flight | 3 | parcial | ISA + revolve/volumen para el dirigible; nada de cohetes. |
| 23 | Design of Unique Aircraft Concepts | 4 | parcial | fea.ts para el escalon estructural; loft+volumen para el 70%. |
| 24 | Design Examples (DR-1, DR-3) | 0 | no | NO leido como capitulo: es la FUENTE de todos los fixtures (RDS). DR-1 manuscrito ilegible en OCR. |

## 2. Catalogo completo de ejercicios

Id canonico `raymer-c<cap>-<nn>`; sin choques entre tramos (los huecos c16-07 y c17-04 se conservan tal cual los dejaron los lectores). `respuesta_impresa` SOLO si el libro la imprime (cita §/p.); vacio si no. `ya_existe` verificado por grep/ls (ver `donde` en el JSON).

| id | cap | titulo | herramientas | oraculo | respuesta impresa | ya_existe | esf | val |
|---|---|---|---|---|---|---|---|---|
| raymer-c2-01 | 2 | Hoja de requisitos del Dash-One | planeacion, dimensionado-aeronave | Esquema validado: campos obligatorios presentes, unidades consistentes (ft-lb-s o m-kg-s), limites FAR aplicados (61 kt) y cada cambio de requisito re-dispara el sizing (invariante de trazabilidad) | — | no | S | 3 |
| raymer-c3-01 | 3 | Sizing del ASW: W0 por punto fijo | dimensionado-aeronave, mision-por-segmentos | W0 convergido = 56,702 lb +-0.1% y We/W0 = 0.4322, W_fuel = 21,393 lb; cada fila de la tabla de Box 3.1 reproducida +-1 lb; el metodo grafico (Fig 3.11) da el mismo W0 | W0 = 56,702 lb {25,720 kg} (Box 3.1, p. 46); tabla de iteracion 50,000->57,863; 60,000->56,198; 56,000->56,814; 56,500->56,733; 56,700->56,702. Comparacion: Lockheed S-3A real 52,539 lb | no | M | 5 |
| raymer-c3-02 | 3 | L/D del croquis por aspect ratio mojado | dimensionado-aeronave, area-mojada-kernel, wing-metrics | A_wet = 1.27 +-0.01; L/D_max = 16 +-0.5 (Fig 3.5 digitalizada); crucero 13.9 +-0.1. Extension: con el solido real, Swet/Sref medida por surfaceArea/S_ref debe caer en 2.2–6.2 (Fig 3.6) | A_wet = 1.27 (7/5.5); L/D_max ~ 16 (Fig 3.5); L/D crucero = 13.9 (p. 45) | parcial | S | 4 |
| raymer-c3-03 | 3 | Trade de alcance del ASW (1000 y 2000 nmi) | dimensionado-aeronave, trade-study | W0(1000) = 42,372 +-5 lb; W0(2000) = 80,217 +-5 lb; W0(R) monotona creciente y convexa | 1000 nmi: W0 = 42,372 lb; 2000 nmi: W0 = 80,217 lb (Box 3.2, p. 48) | no | S | 4 |
| raymer-c3-04 | 3 | Trade de payload del ASW (5,000 y 15,000 lb) | dimensionado-aeronave, trade-study | 33,318 +-5 lb y 78,866 +-5 lb; growth factor dW0/dW_payload ~ 4.55 lb/lb | Payload 5,000 lb: W0 = 33,318 lb; payload 15,000 lb: W0 = 78,866 lb (Box 3.3, p. 49) | no | S | 4 |
| raymer-c3-05 | 3 | Trade de materiales compuestos: el efecto palanca | dimensionado-aeronave, trade-study | 51,585 +-5 lb; (56,702-51,585)/56,702 = 9.0% +-0.2; growth factor dW0/dWe > 1 | W0 = 51,585 lb {23,399 kg} vs 56,702 lb: 9% de ahorro en despegue por 5% en vacio (Box 3.4, p. 50–51) | no | S | 5 |
| raymer-c3-06 | 3 | Gate C<0: la ecuacion estadistica de peso vacio | dimensionado-aeronave | Para todas las clases con numerador 10,800 lb y Wf/W0 = 0.3773 el iterador converge en <= 10 vueltas con omega = 0.75; con C = +0.07 el modulo lanza error de dominio; We/W0 convergido en [0.30, 0.70] | Coeficientes de la Tabla 3.1 (p. 31); 'force the software to use a negative number C term' | no | S | 4 |
| raymer-c3-07 | 3 | Editor de perfil de mision con fracciones historicas | dimensionado-aeronave, mision-por-segmentos | Con la mision del ASW reproduce W7/W0 = 0.6441 +-0.0001; cada fraccion en (0,1]; mezcla de unidades dispara error; refuel parte la mision en dos | Tabla 3.2: 0.970 / 0.985 / 0.995 (p. 37) | no | M | 4 |
| raymer-c4-01 | 4 | Perfil por coordenadas y escalado de espesor con comba fija | croquis, perfil-2D, spline | Linea de comba antes/despues identica (< 1e-6 c); t/c max = objetivo +-0.1%; origen en el LE; el croquis no colapsa puntos (gotcha snap 10 px, CRUCE §4.6) | — | parcial | M | 3 |
| raymer-c4-02 | 4 | Seleccion de aspect ratio y flecha por clase | dimensionado-aeronave | Reproduce la tabla; M_max = 2.0 dogfighter A = 3.52 +-0.01; LE >= arcsin(1/M) supersonico; aviso si (A, flecha) cruza la frontera de pitch-up (curva digitalizada) | Tabla 4.1 (p. 78): homebuilt 6.0, GA mono 7.6, GA bi 7.8, agricola 7.5, twin turboprop 9.2, flying boat 8.0 | no | S | 2 |
| raymer-c4-03 | 4 | Colas y diedro 'que se vean bien' con area correcta | croquis, extruir, ensamble, cotas | Geometria dentro de rangos; interseccion del cono de estela a 45 grados desde el TE de la horizontal con el plano del timon => fraccion no tapada >= 0.33 (medible en el kernel) | Tabla 4.3 y Tabla 4.2 (pp. 100, 91) | no | M | 3 |
| raymer-c5-01 | 5 | T/W y P/W estadisticos por clase | dimensionado-aeronave | Transporte M_max 0.85 -> T/W = 0.252 +-0.002; aviso fuera del rango normal de velocidades de la clase | Tablas 5.3 y 5.4 (pp. 119–120); 'divide Watt/g by 9.807 before using' | no | S | 3 |
| raymer-c5-02 | 5 | Thrust matching: de crucero a despegue | dimensionado-aeronave | (T/W)_TO >= (T/W)_cru para todo T_cru/T_TO < 1; con L/D 13.9 y 0.22 => (T/W)_TO = 0.313 +-0.002 | — | no | S | 3 |
| raymer-c5-03 | 5 | W/S por velocidad de perdida y C_Lmax | dimensionado-aeronave | V_stall 61 kt, C_Lmax 1.6, rho 0.00238 => W/S = 20.2 psf +-0.1 (banda GA 17–26); Ec 5.7 con flecha 0 devuelve 0.9*c_lmax exacto | Tabla 5.5 (p. 124); rho = 0.00238 y 0.00189; V_stall <= 61 kt | no | S | 4 |
| raymer-c5-04 | 5 | W/S por distancia de despegue (TOP) | dimensionado-aeronave | W/S proporcional a TOP*(T/W); C_Lto = C_Lmax/1.21 exacto; la curva TOP(s_TO) digitalizada de la Fig 5.4 y validada en 2 puntos contra el DR-3 (c17-06) | — | no | M | 3 |
| raymer-c5-05 | 5 | W/S por distancia de aterrizaje | dimensionado-aeronave | S_landing 2500 ft, GA, C_Lmax 2.0 => W/S_land = 47.5 psf +-0.1; jet a 0.85 W0 => W/S_TO = 55.9 psf; regla 0.3*V^2 concuerda +-10% en 60–130 kt | Ec 5.11 con constantes 80 {5} y S_a 1000/600/450 ft (p. 133) | no | S | 3 |
| raymer-c5-06 | 5 | W/S optimo de crucero y loiter | dimensionado-aeronave | W/S_jet_cruise = W/S_prop_cruise/sqrt3 exacto; en Ec 5.13 C_Di = C_D0; con A 10, e 0.8, C_D0 0.02, q 100 psf => 70.9 psf +-0.1 | Ec 5.15: W/S = q*sqrt(pi A e C_D0) (p. 136) | no | S | 3 |
| raymer-c5-07 | 5 | W/S por viraje instantaneo y sostenido | dimensionado-aeronave | Con n = 1 la Ec 5.22 coincide con la 5.13; la Ec 5.26 detecta imposibilidad (raiz negativa) y el modulo la reporta como 'requisito inalcanzable', no como NaN | — | no | M | 3 |
| raymer-c5-08 | 5 | W/S por ascenso, techo y la condicion T/W >= G + 2 sqrt(C_D0/(pi A e)) | dimensionado-aeronave | T/W 0.30, G 0.05, C_D0 0.03, A 8, e 0.8: minimo 0.127 cumple; W/S real y positivo; bajando T/W a 0.12 reporta violacion de 5.31 (no NaN) | Ec 5.31: T/W >= G + 2 sqrt(C_D0/(pi A e)) (p. 141) | no | S | 3 |
| raymer-c5-09 | 5 | Diagrama de restricciones T/W–W/S con dueno por tramo y recheck | dimensionado-aeronave, diagrama-restricciones, trade-study | Todas las curvas en condiciones de despegue (cambiar peso de combate 0.85->1.0 mueve solo viraje); el punto elegido satisface toda restriccion no vetada; tras recheck /delta(T/W)/ < 1%; un W/S 40% por debajo del resto dispara alerta §5.3.1 | — | no | L | 5 |
| raymer-c6-01 | 6 | Sizing refinado: marcha por la mision con relajacion 3/4 | dimensionado-aeronave, mision-por-segmentos | 0.956 +-0.001; con la mision del ASW converge en <= 6 vueltas con omega 0.75 vs >= 10 con 0.5; W_f = 1.06*W_fm exacto; un segmento 'drop 2,000 lb' reduce el peso corriente sin tocar W_f | Aceleracion Mach 0.8->2.0 = 0.937/0.9805 = 0.956 (§6.3.9); 'three-fourths of the way' (§6.3.7) | no | M | 5 |
| raymer-c6-02 | 6 | Motor de tamano fijo: los dos modos del solver | dimensionado-aeronave | Modo B: 2 motores de 9,275 lb y T/W 0.327 => W0 = 56,700 lb exacto; R* cumple /W0_calc(R*) - W0/ < 0.1%; A y B coinciden solo con motor de goma equivalente | Ec 6.25: W0 = N*T_por_motor/(T/W) (p. 155) | no | M | 4 |
| raymer-c6-03 | 6 | Geometria inicial: S, T y longitud de fuselaje | dimensionado-aeronave, croquis | Cargo/bomber W0 = 56,702 lb => L = 54.8 ft +-0.1; metrica 0.104*25,720^0.5 = 16.7 m (coincide +-1%) | Tabla 6.3 (p. 157) | no | S | 4 |
| raymer-c6-04 | 6 | Colas por coeficiente de volumen con brazo medido en el CAD | dimensionado-aeronave, ensamble, cotas, wing-metrics | S_HT y S_VT con L medido por el kernel entre puntos c/4 de las MAC +-0.5%; V-tail con S_VT/S_HT = 1 => diedro 45.0 | Tabla 6.4 y % de brazo (p. 160) | parcial | M | 4 |
| raymer-c6-05 | 6 | Particion de superficies de mando con largueros rectos | croquis, extruir, split, cotas, parametrico | Linea de bisagra recta (colinealidad < 1e-6*b); Cf/C constante +-0.5%; el aleron no toca la punta; flap+aleron cubren fuselaje..90% b/2 sin traslape ni hueco | Tabla 6.5 (p. 162) | no | M | 4 |
| raymer-c7-01 | 7 | Conica con parametro de forma p (circulo p = 0.4142) | croquis, conica, cotas | Con p = 0.4142 y tangentes a 90 la curva se aparta de un circulo < 1e-4*/AB/; p = 0.5 parabola; tangente en A y B coincide con AC y BC (G1 exacto) | Circulo: p = 0.4142 y /AC/ = /BC/ (Ec 7.4, p. 182); parabola p = 0.5 | no | M | 4 |
| raymer-c7-02 | 7 | Loft de fuselaje por 5–10 estaciones y verificacion por buttock-planes | loft, seccion, croquis, plano2D | Para N >= 5 buttock-planes la curva de interseccion no tiene inflexiones espurias; p(x) monotona por tramos; una estacion redundante no cambia el solido > 0.1% de volumen | — | parcial | L | 4 |
| raymer-c7-03 | 7 | Flat-wrap: superficie desarrollable vs ruled surface | loft, superficie, analisis-curvatura | Curvatura gaussiana /K/ < 1e-6/mm2 en el tramo flat-wrap; el loft ruled entre dos secciones rotadas da /K/ > 0 (contraejemplo); area desarrollada = area 3D +-0.1% | — | parcial | L | 3 |
| raymer-c7-04 | 7 | Ala de referencia trapezoidal desde S, A, lambda | croquis, extruir, wing-metrics, cotas | macTrapezoidal = cbar analitica a 1e-12; metricasAla del solido devuelve S +-0.01%, MAC +-0.1%, Ybar +-0.1%; eliptica 0.849/0.529 +-0.001 | Ec 7.5–7.9 (p. 191–192); eliptica: MAC 84.9% de C_root, Ybar 52.9% de b/2 (p. 192) | parcial | S | 5 |
| raymer-c7-05 | 7 | Colocar el ala respecto al CG por % de MAC | ensamble, masa-inercia, wing-metrics | (x_CG - x_LE_MAC)/MAC = 0.30 +-0.005 con x_CG del kernel; mover el ala 1 m mueve el % en -1/MAC exactamente | 25% MAC ala volante neutro; ~30% estable; ~40% inestable; 15–20% canard (§7.8, p. 194) | parcial | M | 4 |
| raymer-c7-06 | 7 | Fillet ala-fuselaje de radio variable | fillet, superficie, ensamble | Radio en el LE = 0.10*C_root +-2% y monotono creciente; G1 (< 0.5 grados); area mojada sube < 3% | — | parcial | M | 3 |
| raymer-c7-07 | 7 | Area mojada de ala/cola: formula vs kernel | surfaceArea, wing-metrics, booleanas | /S_wet_kernel/S_exp - 2.0394/ < 0.03; con t/c -> 0 el cociente -> 2.000; S_exp = proyeccion/cos(5) +-0.1% | Ec 7.11: S_wet = 2.003*S_exposed; Ec 7.12: S_wet = S_exposed*[1.977 + 0.52(t/c)] (p. 204) | parcial | S | 4 |
| raymer-c7-08 | 7 | Area mojada y volumen del fuselaje: formula rapida vs integracion por estaciones | seccion, surfaceArea, volume, integracion | Cuerpo circular esbelto: S_wet_kernel = pi*A_proy +-1% y la formula 3.4 se aparta ~8%; int perimetro = surfaceArea +-0.5% e int A = volume +-0.5% con >= 40 estaciones; con el ala unida la resta reduce S_wet en 2*(area raiz) | Ec 7.13 y Ec 7.14 (pp. 205–207) | parcial | M | 4 |
| raymer-c7-09 | 7 | EL TEST DE ACEPTACION del CAD: tubo + cono + ala simple a mano | croquis, extruir, revolve, booleanas, surfaceArea, volume | S_wet a mano (valor cerrado) vs CAD < 0.5% y volumen < 0.1%; sumar el ala sin restar la raiz da +8% y el test lo cacha; la cara de entrada de la toma NO se cuenta | — | parcial | S | 5 |
| raymer-c7-10 | 7 | Volume distribution plot desde el solido | seccion, volume, grafica, booleanas | int A(x)dx (N = 100) = volume +-0.3%; A(x) >= 0 y continua; refinar N 50->100 cambia < 0.1% | — | no | M | 4 |
| raymer-c7-11 | 7 | El ala parametrica que regenera sus partes derivadas | parametrico, arbol-de-features, croquis, extruir, booleanas, volume | Cambiar A de 8 a 10 con S fija: b = sqrt(10 S) +-1e-9, largueros al 25%/65% local +-0.1%, volumen de tanque regenerado cierra vs W_f del sizing; regeneracion < 2 s | — | desconocido | L | 5 |
| raymer-c7-12 | 7 | Volumen de tanque de geometria arbitraria = un boton | booleanas, volume, masa-inercia | Volumen = kernel volume(ala ∩ caja - duct); W_fuel = V*0.85*rho; cierre contra c3-01 (21,393 lb => 502 ft3 brutos); CG del combustible dentro de +-5% MAC del CG | Fracciones utilizables 85/92/77/83% y densidades (§10.4) | parcial | M | 4 |
| raymer-c7-13 | 7 | El Dash-One: tres vistas con la tabla de parametros | plano2D, cotas, ensamble | generateDrawing produce ALZADO/PLANTA/LATERAL sin aristas fantasma; tabla con los 8 grupos de §7.2 y cada numero coincide con el modelo (+-0.1%); reproducible en capsula | — | parcial | M | 4 |
| raymer-c8-01 | 8 | Continuidad longitudinal: sin quiebres de pendiente ni de curvatura | loft, analisis-curvatura, seccion | Salto de tangente < 0.5 y de curvatura relativo < 10% sobre >= 5 buttock-planes; un quiebre deliberado tiene R >= D_fus; angulo de cierre trasero <= 12 | — | no | M | 3 |
| raymer-c8-02 | 8 | Area ruling: suavizar la distribucion de volumen conservando el volumen | seccion, loft, edicion-parametrica, volume, grafica | RMS de A''(x) baja >= 30%; volumen +-0.5%; A(x) suavizada mas cerca de Sears-Haack | — | no | L | 4 |
| raymer-c8-03 | 8 | Esqueleto estructural: largueros, caja de ala, carrythrough y cutouts | croquis, extruir, ensamble, FEA-estatico | Largueros rectos con % constante +-0.5%; ningun cutout intersecta la caja; FEA: cutout en la caja => sigma_vM max >= 1.5x la version limpia | Largueros 20–30% / 60–75% de cuerda (§8.3.2, p. 227) | parcial | M | 3 |
| raymer-c8-04 | 8 | Claro estructural desde la mold line | shell, ensamble, interferencia | shellSolid(OML, -claro) produce la envolvente; common != vacio reporta invasor con volumen; el tren arriba cabe | 4 in airliner; 2 in caza; <= 1 in GA; +1 in heat shield; 0 tanque integral (§8.3.3) | parcial | M | 3 |
| raymer-c8-05 | 8 | Flutter y mass balance de superficies de mando | masa-inercia, ensamble, cotas | x_CG(superficie + contrapeso) <= x_bisagra; I_xy respecto a la bisagra = 0 +-1% de I_xx; x_bisagra/cbar <= 0.20; contrapeso minimo | — | parcial | M | 3 |
| raymer-c9-01 | 9 | Cabina de mando: maniqui 95% y angulo de vision sobre la nariz | croquis, extruir, ensamble, cotas, medir-angulo, dimensionado-aeronave | Angulos medidos por el kernel desde el punto de ojo: overnose dentro de banda y >= Ec 9.1; rasante >= 30; esfera de 10 in sin interferencia con el canopy | — | no | M | 3 |
| raymer-c9-02 | 9 | Cabina de pasajeros generada por Tabla 9.1 | croquis, patron, extruir, ensamble, cotas, dimensionado-aeronave | Cotas del solido en la banda de la Tabla 9.1; asientos/pasillo <= 3; bodega medida >= 8.6 ft3*N_pax; longitud = filas*pitch + puertas | — | no | M | 3 |
| raymer-c9-03 | 9 | Claros de armamento en la peor postura del tren | ensamble, cinematica, interferencia, medir-distancia | Distancia minima del kernel entre cada arma y suelo/helice/otras armas en la postura combinada >= el claro; cono de 10 sin interseccion | — | no | M | 2 |
| raymer-c10-01 | 10 | Motor 'rubber': escalar un motor real al empuje requerido | dimensionado-aeronave, revolve, ensamble, cotas | W/W_act = SF^1.1, D/D_act = SF^0.5, L/L_act = SF^0.4 exactos; bandera si SF fuera de 0.7–1.3 | — | no | S | 3 |
| raymer-c10-02 | 10 | Motor estadistico turbofan / postcombustion (Ecs 10.4–10.15) | dimensionado-aeronave, revolve | Consistencia fps<->mks fila a fila (0.67 1/hr <-> 19 mg/Ns; 2.1 <-> 60) +-2%; rechazo fuera del rango BPR/M | — | no | S | 3 |
| raymer-c10-03 | 10 | Area de captura de toma subsonica por A/A* (Ecs 10.16–10.17) | dimensionado-aeronave, croquis, revolve, sweep, cotas | (A/A*)(0.6) = 1.188 y (0.4) = 1.590 +-0.5%; razon 0.75 +-1%; el conducto generado tiene ese cociente medido por el kernel | A_throat/A_engine = 1.188/1.59 = 0.75; razon de diametros ~ 0.88 (§10.3.4, p.301) | no | S | 4 |
| raymer-c10-04 | 10 | Area de captura supersonica del DR-3 y A_max neta | dimensionado-aeronave, croquis, seccion, medir-area | 20.9 - 3.83 = 17.07 exacto; A_c/m_dot dentro del eje de la Fig 10.17; capture-area ratio <= 1 (Ec 10.20) | DR-3: A_capture = 3.83 ft2 {0.36 m2}; A_max neta = 20.9 - 3.83 = 17.07 ft2 (§24.3, p.921-922) | no | M | 4 |
| raymer-c10-05 | 10 | Diverter de capa limite del DR-3: espesor y factor de forma | croquis, extruir, medir-area, dimensionado-aeronave | 1 + 2.830/4.200 = 1.6738 -> 1.674 exacto; espesor/L_fus en [0.01, 0.03]; rampa medida <= 30 | DR-3: BL DIVRTR FF = 1.674, Cf 33.384e-5, S_wet 2.8 ft2, Cdo 0.6 counts a M0.4/30,000 ft (§24.3, p.925) | no | M | 4 |
| raymer-c10-06 | 10 | Diametro de helice: velocidad de punta vs estadistica | dimensionado-aeronave, revolve, ensamble, medir-distancia | D_usado = min(D_tip, D_stat); V_tip helicoidal a V_max < limite; claro medido con strut de nariz comprimido >= 7 in | — | no | S | 3 |
| raymer-c10-07 | 10 | Motor de piston/turbohelice estadistico o escalado + entrada de refrigeracion | dimensionado-aeronave, extruir, ensamble | Consistencia fps<->mks +-3%; A_exit/A_inlet = 0.8 medido del solido; rango de potencia dentro de la columna | — | no | S | 2 |
| raymer-c10-08 | 10 | Volumen de tanques medido del solido y fuel-volume plot con CG | croquis, loft, seccion, medir-volumen, centroide, dimensionado-aeronave | 4422.8/703.3 = 6.29 lb/gal (JP-4 6.32, -0.5%); volumen kernel x utilizable >= W_f/rho; CG = centroide del volume plot +-1% L_fus; 389 + 314.3 = 703.3 | DR-3: V_t = 703.3 gal, 3 tanques; combustible usable 4422.8 lb {2006 kg} con CG a X = 22.25 ft (§24.3, p.933-934) | parcial | M | 4 |
| raymer-c11-01 | 11 | Llantas estadisticas (Tabla 11.1) y cargas estaticas/dinamicas del DR-3 | dimensionado-aeronave, ensamble, cotas, revolve | Dim = A W_w^B +-1%; cargas cierran sum = W; con el CG vacio del DR-3 (23.8) sobre el tren la fraccion de nariz cae a 0 -> ROJO tipback | — | no | M | 4 |
| raymer-c11-02 | 11 | Geometria del triciclo (y castor) medida en el ensamble 3D | ensamble, cinematica, medir-angulo, cotas, dimensionado-aeronave | Cada angulo medido por el kernel con el CG del modulo de pesos (adelante y atras) cae en su banda; toda la envolvente de CG pasa | — | no | M | 5 |
| raymer-c11-03 | 11 | Presion de llanta, huella, pista y energia de frenado | dimensionado-aeronave, cotas | P <= tope de la Tabla 11.3 de la superficie; KE con W_landing >= 0.8 W0; W_w = P A_p | — | no | S | 3 |
| raymer-c11-04 | 11 | Carrera del amortiguador y dimensiones del oleo (Ecs 11.8–11.13) | dimensionado-aeronave, revolve, ensamble, cotas | S no depende de W; S(in) ~ V_vert(ft/s) +-25%; D_ext = 1.3 sqrt(4 L/(pi 1800)) exacto; solido de longitud 2.5 S | — | no | S | 4 |
| raymer-c11-05 | 11 | Pata de ballesta: deflexion analitica vs FEA del kernel | croquis, extruir, cotas, FEA-estatico, dimensionado-aeronave | Deflexion FEA vs Euler-Bernoulli +-5%; componente vertical = S; sigma_max FEA = M(t/2)/I +-5% | — | parcial | M | 4 |
| raymer-c11-06 | 11 | Retraccion del tren como 4 barras y el pozo que cabe | cinematica, multicuerpo, ensamble, interferencia, croquis, medir-distancia | Cero interferencias a lo largo del recorrido con rueda +3%/+4%; claro >= 0.03 w + 1 in; pivote sobre la mediatriz +-0.1 mm | — | parcial | L | 5 |
| raymer-c11-07 | 11 | Avionica por fraccion de peso vacio (Tabla 11.6) y su bahia | dimensionado-aeronave, extruir, ensamble, medir-volumen | 2.117*727^0.933 = 987.3 ~ 989.8 (+-0.3%); inversion devuelve 727 +-1 lb; bahia 22–33 ft3; 990/10,947 = 9.0% > 0.08 => FUERA DE BANDA | DR-3: avionica instalada 990 lb; no instalada W_uav = 727 lb (§24.3 p.931); salida Avionics 989.8 lb (p.934) | no | S | 3 |
| raymer-c12-01 | 12 | S_ref, S_exp y S_wet del DR-3 medidas del solido | croquis, extruir, loft, ensamble, medir-area, cotas | S_wet/S_exp = 2.008 y 2.009 +-1%; S_ref medido = 294 +-0.1%; S_exp/S_ref = 0.73; f_fus = 8.218 y f_canopy = 6.95 medidas | DR-3: S_ref 294.000 ft2, S_exp 215.000, S_wet ala 431.8, cola 92.0/184.8, fuselaje 588.0, canopy 39.0 (§24.3 p.923-925) | parcial | S | 5 |
| raymer-c12-02 | 12 | Pendiente de sustentacion CL_alpha(M) del DR-3 (Ecs 12.6–12.9, 12.14) | dimensionado-aeronave, croquis, medir-angulo, perfil-2D | 1.07(1+5.5/32.08)^2 = 1.47 +-1%; 1/cos 38 = 1.2691; 1/(pi 3.5) = 0.0909; CL_alpha(M0.2) = 3.6717 +-0.5% (RDS NO aplico el 0.98: reproducir y bandera); maximo en M1.10 | DR-3 CL_alpha (1/rad): M0.2 3.6717; 0.4 3.7821; 0.6 3.9951; 0.8 4.3809; 1.0 5.1222; 1.10 5.3923 (pico); 1.2 5.2005; 1.6 3.3519; 2.0 2.4413; M sonico LE = 1.2691; K_100% = 0.0909 (§24.3 p.926) | no | M | 5 |
| raymer-c12-03 | 12 | CLmax del DR-3 con flaps (Ecs 12.15, 12.21; Tablas 12.1, 12.2) | croquis, cotas, perfil-2D, dimensionado-aeronave, medir-area | dCLmax = 0.82 +-2% con S_flapped medida; 1.64 exacto; el 1.8 final es decision humana registrada con autor | DR-3: dCLmax total ~ 0.82; c_lmax 0.82 + 0.82 = 1.64; CLmax a M0.2 = 1.7942; CLmax aterrizaje ASUMIDO 1.8 (§24.3 p.922, p.926) | no | M | 4 |
| raymer-c12-04 | 12 | Build-up de arrastre parasito subsonico del DR-3 (M0.4, 30,000 ft) | dimensionado-aeronave, medir-area, croquis, ensamble | FF_fus = 1.129 y FF_canopy = 1.196 exactos (prueba la ecuacion de ediciones previas, NO la 12.31); componentes +-1 count, total +-2; Re fuselaje 51.6e6 +-1%; las filas Misc NO se usan como gate | DR-3 M0.4/30 kft (counts): WING R 11.715e6, Cf 28.859e-5, FF 1.190, S_wet 431.8, Cdo 53.5; HORZ TAIL 25.8; FUSELAGE FF 1.129, 55.1; CNPY FF 1.196, 4.6; BL DIVRTR 0.6; Misc 4.327 y 7.211; TOTAL Cdo 151.131 (§24.3 p.925) | no | M | 5 |
| raymer-c12-05 | 12 | Build-up supersonico del DR-3 con arrastre de onda (M1.6, 40,000 ft) | dimensionado-aeronave, seccion, medir-area | Todos los FF = 1.000; Sears-Haack (9pi/2)(17.07/45.2)^2 = 2.0166 ft2 = 68.6 counts, xE_wd 2 = 137 a M1.2, a M1.6 ~122 (+-5%); Cdw > mitad del total; total +-2 counts | DR-3 M1.6/40 kft (counts): WING 31.9 (FF 1.000); HORZ TAIL 15.2; FUSELAGE 35.2; CNPY 2.8; BL DIVRTR 0.2; Misc 10.636 y 7.211; Wave drag Cdw 122.0; TOTAL Cdo 225.126 (§24.3 p.925) | no | M | 5 |
| raymer-c12-06 | 12 | Mach de divergencia de arrastre del ala (Ec 12.46 + Figs 12.29/12.30) — B-727 | dimensionado-aeronave, medir-angulo, perfil-2D | dM_DD(0.1->0.3) = -0.04 +-0.01; absolutos +-0.03; M_DD cuerpo saturado en 1.0; fuera de rango bandera, no numero | Boeing 727: M_DD ~ 0.86 a C_L = 0.1 y ~ 0.82 a C_L = 0.3 (§12.5.10, p.436) | no | S | 4 |
| raymer-c12-07 | 12 | Drag rise en 7 pasos (Fig 12.32) y Drag Map del DR-3 | dimensionado-aeronave | Curva pasa por las dos anclas +-2 counts; un solo maximo transonico; CD(M1.0) = 1/2 CD(M1.05); empalme ETIQUETADO como interpolacion | DR-3 aceleracion 35,000 ft (p.951): CD0 0.0173, 0.0199, 0.0239, 0.0256 (max), 0.0255, 0.0250, 0.0246, 0.0242, 0.0238, 0.0234 | no | M | 4 |
| raymer-c12-08 | 12 | K por succion de borde de ataque (Ecs 12.56–12.58, Fig 12.39) — DR-3 | dimensionado-aeronave | K(n) tiene MINIMO en n=3 (CL 0.41 ~ diseno 0.40) — firma del metodo; K_100 = 0.0909; S(1.4) = 0 => K = 1/CL_alpha; K(0.45, M0.4) = 0.1013 | DR-3 viraje M0.9/30 kft (p.951): n=1 K 0.1411 CL 0.14; n=2 0.1138/0.27; n=3 0.1022/0.41; n=4 0.1103/0.55; n=5 0.1340/0.69; n=6 0.1553/0.82; n=7 0.1699/0.96; CD0 = 0.0161 | no | M | 5 |
| raymer-c12-09 | 12 | Arrastre de flaps, tren y miscelaneos: CD0 de despegue y aterrizaje del DR-3 | dimensionado-aeronave, croquis, medir-area, ensamble | CD0_aterrizaje - CD0_limpio ~ 0.097 +-15%; dCD0_flap = 0 para delta < 10; L/D = CL/(CD0 + K CL^2) reproduce 3.07 y 2.53 +-1% | DR-3: despegue CL 1.49, CD0 0.0289, K 0.2609, L/D 3.07; aterrizaje CL 1.62, CD0 0.1124, K 0.2724, L/D 2.53 (§24.3 p.950) | no | M | 3 |
| raymer-c12-10 | 12 | Cuerpo de Sears-Haack generado y distribucion de area del avion | croquis, revolve, seccion, medir-area, medir-volumen, dimensionado-aeronave | Volumen kernel vs integral analitica +-0.5%; A_max medida = entrada; (D/q)_SH = 2.0166 ft2 +-0.5%; bajar A_max 10% baja la onda ~19% | — | parcial | S | 4 |
| raymer-c12-11 | 12 | Polar parabolica y L/D: verificacion contra el solver de mision del DR-3 | dimensionado-aeronave | 10.244 (0.2%); 12.054 (0.001%); 4.363 (0.06%); tangente en CL = sqrt(CD0/K) | DR-3 (§24.3 p.944): L/D = 10.2636 (ascenso), 12.0539 (crucero), 4.3604 (aceleracion); alcance especifico 0.3842 nmi/lb | no | S | 4 |
| raymer-c12-12 | 12 | Eficiencia de envergadura de biplano (Ec 12.50 + Fig 12.36) | dimensionado-aeronave, croquis, medir-distancia | e = 2/(1 + 0.561) = 1.281 vs 'about 1.3' (-1.5%); fuera de mu 0.4–1.0 bandera | gap/envergadura ~ 0.15 -> 'an e of about 1.3, greater than one!' (§12.6.1, p.445) | no | S | 2 |
| raymer-c13-01 | 13 | Empuje instalado del DR-3: perdidas de toma, sangrado y tobera | dimensionado-aeronave | 1.35(0.970 - 0.940) = 0.0405 exacto; 1.20(0.897 - 0.830) = 0.0804 ~ 0.0807; 0.015 x 16.9 = 0.2535; signo negativo = gana empuje (no recortar a 0) | DR-3 (§24.3 p.938) inlet loss: M0.4 0.0405; 0.6 0.0068; 0.8 0; 1.0 0; 1.2 -0.0083; 1.4 -0.0143; 1.6 -0.0145; 1.8 0.0051; 2.0 0.0807; 2.2 0.1836; 2.4 0.2912; Nozzle D/q 0.2535 ft2 | no | S | 5 |
| raymer-c13-02 | 13 | SFC a potencia parcial (Ec 13.9) en el crucero del DR-3 | dimensionado-aeronave | 0.083/0.167 = 0.497; C sube 32% (0.9948/0.7518) reproducido +-5%; (V/C)(L/D)/W = 0.3839 vs 0.3842 | DR-3 crucero: ajuste de potencia = 49.7%, C = 0.9948 1/hr, L/D 12.0539, alcance especifico 0.3842 nmi/lb (§24.3 p.944) | no | S | 3 |
| raymer-c13-03 | 13 | Helice por coeficientes: J, Cp, Ct, eta_p y empuje estatico | dimensionado-aeronave, revolve, patron | T V = eta_p 550 bhp; T(V->0) finito; M_tip dispara correccion solo si > 0.89; Cs no depende de D | — | no | M | 3 |
| raymer-c13-04 | 13 | Potencia de piston con altitud (Gagg-Ferrar, Ec 13.10) | dimensionado-aeronave | P/P_SL(20,000 ft) = 0.471 < 0.5 (con la ISA del repo +-0.5%) | 'at an altitude of 20,000 ft a piston engine has less than half of its sea-level power' (§13.5, p.480) | parcial | S | 2 |
| raymer-c14-01 | 14 | Diagrama V-n de maniobra y rafaga -> Nz ultimo del DR-3 | dimensionado-aeronave, croquis | Nz = 1.5 x 7.33 = 11.0 exacto y la UI rotula 'ultimo = 1.5 x limite'; n_rafaga GA 2–3 g; el V-n usa Ve; avion mas ligero => dn mayor | DR-3: factor de carga limite 7.33 => N_z (ULTIMO) = 11.000 (§24.3 p.931-933); rafaga 'roughly a 3-g positive load factor' para U_de = 30 ft/s (§14.3.2 p.499) | no | M | 5 |
| raymer-c14-02 | 14 | Schrenk sobre el ala dibujada -> cortante/momento -> larguero verificado con FEA | croquis, extruir, patron, FEA-estatico, plano2D, cotas, dimensionado-aeronave | int carga dy = n W +-0.1%; momento en raiz analitico vs FEA +-5%; sigma_max FEA vs Mz/I +-5%; bandera si flecha con vortice | — | parcial | L | 5 |
| raymer-c14-03 | 14 | Pandeo de columna, crippling y placa (Ecs 14.30–14.34) vs pandeo lineal del kernel | croquis, extruir, pandeo, FEA-estatico, cotas | Carga critica del solver vs Euler +-3% en tubo articulado; P_c no depende de sigma_ult ni de A; F_crippling = 0.3 E t/R | esbeltez critica ~ 77 para 2024 Al, 51 para 7075 Al, 91.5 para acero 4130 y 59–76 aleado; bloque si < ~12 (§14.9.2, p.537) | no | M | 4 |
| raymer-c14-04 | 14 | Torsion de eje, tubo y caja cerrada (Ecs 14.45–14.50, Tabla 14.7) | croquis, extruir, FEA-estatico, cotas | tau_max y phi FEA vs formula +-5% en eje circular; caja cerrada +-5%; rectangulo b/t = 1 +-5% | Tabla 14.7: b/t = 1.00 -> 0.208, 0.141; 2.00 -> 0.246, 0.229; 4 -> 0.282, 0.281; inf -> 0.333 (§14.9.6, p.551) | parcial | M | 3 |
| raymer-c14-05 | 14 | Cargas de tren, motor y mandos como casos de carga del FEA | FEA-estatico, ensamble, dimensionado-aeronave | Cada caso registrado con origen (§) y factor 1.5; equilibrio; drop = 3.6 sqrt(W/S) +-1% | — | parcial | S | 2 |
| raymer-c14-06 | 14 | Barra 1-D del FEM: {P} = [K]{u} | FEA-estatico | Desplazamiento = PL/(EA) +-1e-6; refinamiento converge monotono | — | parcial | S | 1 |
| raymer-c15-01 | 15 | Group Weight Statement del DR-3 con las 24 ecuaciones de caza (15.1–15.24) | dimensionado-aeronave, medir-area, ensamble, centroide | Sumas exactas 4526.2 + 2354.3 + 3066.7 + 1000 = 10,947.2; + 5532.8 = 16,480.0; engine mounts 39.07; air induction 290.2 (clamp); avionics 987.3; OJO fuselaje (15.4) y nose gear (15.6) no cierran con el OCR -> confirmar impreso | DR-3 (§24.3 p.934, lb): Wing 1459.4; Horiz tail 280.4; Fuselage 1574.0; Main gear 631.5; Nose gear 171.1; Engine mounts 39.1; Air induction 291.1; STRUCTURES 4526.2; PROPULSION 2354.3; Avionics 989.8; EQUIPMENT 3066.7; MISC 1000.0; EMPTY 10,947.2; Fuel 4422.8; TOGW 16,480.0; CG vacio 23.8 / sin combustible 23.4 / bruto 23.1 ft | no | L | 5 |
| raymer-c15-02 | 15 | Sistema de admision (Ec 15.10) con el clamp L_s/L_d >= 0.25 — DR-3 | dimensionado-aeronave, medir-distancia | 290.2 lb vs 291.1 (0.3%); sin clamp 323 lb (11% arriba) | DR-3: Air induction = 291.1 lb {132.0 kg} (§24.3 p.934) | no | S | 4 |
| raymer-c15-03 | 15 | Metodo rapido por area (Tabla 15.2) como auditor del detallado | dimensionado-aeronave, medir-area | Cada grupo usa el AREA correcta; razon detallado/rapido en 0.5–2.0 o bandera; CG aproximados alimentan primera envolvente | — | no | S | 3 |
| raymer-c15-04 | 15 | Envolvente de CG a lo largo de la mision y la errata de la Tabla 15.1 | dimensionado-aeronave, centroide, ensamble | Recorrido 0.7 ft = 6.8% MAC < 8%; sum momentos = 380,972 != 362,744 (diferencia = 18,228 = payload) => CG consistente 23.11 ft: el software caza la errata | DR-3 CG: vacio 23.8, cargado-sin-combustible 23.4, bruto 23.1 ft (§24.3 p.934); Tabla 15.1: TOGW 16,480 lb, Loc 22.0 ft, Moment 362,744 ft-lb (§15.1.3 p.564) | parcial | M | 5 |
| raymer-c15-05 | 15 | Fudge factors (Tabla 15.4) y calibracion contra un avion conocido (T-38/F-5B) | dimensionado-aeronave | 1042/1067 = 0.9766; 0.977 x 0.85 = 0.830; fudge registrado con autor/motivo, nunca default | Ala T-38/F-5B: calculada 1067 lb, real 1042 lb => 0.977; x 0.85 => fudge 0.83 (§15.4, p.579-580) | no | S | 3 |
| raymer-c16-01 | 16 | Punto neutro, Cm_alpha y margen estatico del avion de las preguntas del cap 12 | dimensionado-aeronave, estabilidad-estatica, croquis, cotas, plano2D | X_np entre X_ac ala (~12 ft+) y cola (34 ft); SM(a) - SM(b) = 3/cbar = 0.545 exacto; Cm_alpha = -C_La SM a 1e-6; en banda 'Business & GA' de Fig 16.4 (-0.65 a -1.0 /rad); trampa 57.3 en 16.25 | — | no | M | 5 |
| raymer-c16-02 | 16 | Trim plot y deflexion de elevador a 200 kt | dimensionado-aeronave, estabilidad-estatica, perfil-2D | Cm_cg(C_L_trim) = 0 a 1e-4; /delta_e/ a 16 ft < a 13 ft; producto de los dos primeros terminos de 16.16 < 1; delta_e dentro de 10–60 o 'extrapolacion sin respaldo' | — | no | M | 4 |
| raymer-c16-03 | 16 | Elevador en pull-up de 3 g a 200 kt | dimensionado-aeronave, estabilidad-estatica, dinamica | delta_e(pull-up) mas nariz-arriba que trim; cierra con 16.57 en estacionario a 1e-6; C_mQ escala con el cuadrado del brazo | — | no | M | 3 |
| raymer-c16-04 | 16 | Criterio de recuperacion de barrena TDR·URVC medido sobre el 3-vistas | croquis, plano2D, cotas, dimensionado-aeronave | Areas MEDIDAS por el kernel sobre la proyeccion lateral; normalizacion correcta; veredicto pendiente hasta digitalizar la Fig 16.32; solo alas rectas | — | no | M | 2 |
| raymer-c16-05 | 16 | Velocidad de alabeo estacionaria contra MIL-F-8785B | dimensionado-aeronave, estabilidad-estatica, dinamica, croquis | Fig 16.26 +-0.006; IV B son DOS condiciones AND; errata 16.64 subindice delta_a; aviso 'cuasi-estacionario = optimista' | — | no | S | 3 |
| raymer-c16-06 | 16 | Momentos de inercia: el kernel contra los radios de giro de Tabla 16.1 | ensamble, masa-inercia, dimensionado-aeronave | I kernel vs estadistico +-30% por eje; R_z^2 ~ R_x^2 + R_y^2 (-14% a +17%); el entrenador militar se carga con bandera OUTLIER | Table 16.1: Single-engine prop 0.25 0.38 0.39; Jet fighter 0.23 0.38 0.52; Jet transport 2 wing-mounted engines 0.25 0.38 0.46 (p.623) | parcial | M | 4 |
| raymer-c16-08 | 16 | de/da del avion del cap 12 desde la Fig 16.12 | dimensionado-aeronave, estabilidad-estatica | Tabla +-0.006; de/da baja con A, m, r, sube al bajar lambda; ~mitad del alfa (p.600); fuera de r < 0.5–0.625 bandera | — | no | S | 3 |
| raymer-c16-09 | 16 | Estabilidad lateral-direccional estatica: Cn_beta y Cl_beta del layout | dimensionado-aeronave, estabilidad-estatica, croquis, cotas | Cl_beta negativo, /Cl_beta/ ~ 0.5 Cn_beta (+-25%); brazos laterales /b, longitudinales /cbar; solo A 1.4–7.3 tiene trazo | — | no | M | 4 |
| raymer-c17-01 | 17 | Mejor velocidad de crucero del avion de helice a 10,000 ft | dimensionado-aeronave, desempeno, atmosfera-ISA | Helice: V = sqrt(2(W/S)/rho)(K/CD0)^0.25 ~ 193 ft/s ~ 114 kt (no impreso); benchmarks impresos: jet best-range = 3^0.25 = +31.6% sobre V_md, L/D 86.6% del maximo (p.645) | — | parcial | S | 4 |
| raymer-c17-02 | 17 | Alcance de crucero a 150 kt con 500 lb de combustible | dimensionado-aeronave, desempeno, planeacion | Ec 17.28; gate S-02 del cap 19: W_f/W_i ~ 0.74 < 0.9 => partir el crucero en tramos; R(150 kt) < R(V_bestrange) | — | no | S | 4 |
| raymer-c17-03 | 17 | Regimen de ascenso a 100 kt (SL y 10,000 ft) y mejor velocidad de ascenso | dimensionado-aeronave, desempeno, atmosfera-ISA | V_v(10 kft) < V_v(SL); mejor ascenso helice en C_L = sqrt(3 CD0/K); techo donde V_v_max = 0; tiempo por 17.50 con signo corregido | — | no | S | 3 |
| raymer-c17-05 | 17 | Motor apagado a 10,000 ft: cuanto planeas y cuanto te sostienes | dimensionado-aeronave, desempeno, atmosfera-ISA | Distancia = h (L/D)_max ~ 123,000 ft ~ 20 nmi; tiempo = int dh/V_sink con rho(h); V_min_sink = 0.76 V_bestglide | — | parcial | S | 3 |
| raymer-c17-06 | 17 | Despegue y aterrizaje del DR-3: los seis segmentos con numero | dimensionado-aeronave, desempeno | Valores +-0.1 ft; 723.6 y 990.4 coinciden con la variante 13 del carpet p.956 ('Takeoff' = rodaje, NO distancia total) | TAKEOFF: ground roll 538.2 ft; rotate 185.4; TOTAL GROUND ROLL 723.6; transition 761.6; TOTAL TAKEOFF 1485.2; FAR 25 1707.9. LANDING: approach 773.5; flare 2733.1; free roll 194.2; braking 796.1; TOTAL GROUND ROLL 990.4; TOTAL LANDING 4497.0; FAR 25 7495.0 (p.950) | no | M | 5 |
| raymer-c17-07 | 17 | Ps, viraje y ascenso del DR-3 a Mach 0.9 / 30,000 ft con K NO constante | dimensionado-aeronave, desempeno | +-0.1 en Ps; K con minimo interior en n=3 es la firma: K constante FALLA; T/W y W/S del punto de vuelo | n=1: Ps +458.34 ft/s, ROC 27,500 fpm; n=2: +419.78, 3.57 deg/s; n=3: +362.72, 5.83; n=4: +258.88, 7.98; n=5: +64.17, 10.10; turn radius 3426 ft (p.951) | no | M | 5 |
| raymer-c17-08 | 17 | Envolvente de viraje y corner speed de un caza tipico | dimensionado-aeronave, desempeno | Rama estructural exacta (< 2% en 8 puntos); corner 340 kt dentro de 300–350; maximo sostenido en Ps=0 con K(C_L) | For a typical fighter, corner speed is about 300–350 kt (p.653) | no | S | 4 |
| raymer-c17-09 | 17 | Altura de energia y trayectoria de minimo tiempo/combustible de ascenso | dimensionado-aeronave, desempeno, atmosfera-ISA, planeacion | h_e(M0.9, 30 kft) = 42,447 +-10 ft; 16 curvas de Fig 17.13 +-0.03 Mach; 'Ps = 0 at n = 5 at M0.9 30,000 ft' se cumple; trayectoria = Ps maximo por h_e | An F-16 or a Boeing 747 would have an energy height of 42,447 ft if flying at Mach 0.9 at 30,000 ft (p.664) | parcial | M | 4 |
| raymer-c17-10 | 17 | Envolvente de operacion: q-limit, presion de ducto, techos y Ps=0 | dimensionado-aeronave, desempeno, atmosfera-ISA | q=const CALCULADA cruza Fig 17.11 a +-0.015 Mach; P_T0 isentropica; apices Ps=0 +-0.3 kft | Typical fighter q limit 1800–2200 psf; service ceiling 100 fpm propeller and 500 fpm jet (FAR); ejection limit 50,000 ft (p.670) | parcial | M | 3 |
| raymer-c18-01 | 18 | Costo de desarrollo y adquisicion del DR-3 en aluminio y en compuestos | costo, dimensionado-aeronave, planeacion | Sin ejemplo resuelto: validar con 500^0.163 = 2.75 ~ 3 (p.695); banda $2,000–5,000/lb de We; compuestos 1.1–1.8x en horas; salida {lo, nominal, hi} 'RDT&E+flyaway, USD 2012' | — | no | M | 4 |
| raymer-c18-02 | 18 | La curva de aprendizaje como exponente de Q | costo, planeacion | x = 1 + log2(LC) a 3 decimales; 500^0.163 = 2.75 en [2.5, 3.5]; LC = 2^(0.641-1) = 78% en [70, 90]% | Fig 18.2 curves x = .926, .848, .678, .485, .263 (p.694); 'about three times the engineering effort' para 500 aviones (p.695) | no | S | 3 |
| raymer-c18-03 | 18 | El comparador de costos que no miente por un factor de 2 | costo | +63% y +129% +-3 puntos; comparacion entre agrupaciones -> rechazo con la cita | F-15 'only 60% more' then-year but 'actually cost 130% more' constant 1978 (p.688); 'Comparing the flyaway cost of one aircraft to the program or life-cycle cost of another is meaningless' | no | S | 2 |
| raymer-c18-04 | 18 | Economia de aerolinea: DOC por asiento-milla, break-even y NPV | costo, planeacion | #200 exacto; NPV $100 exacto; MMH/FH 6.4 -> 12 (+-10%); DOC en 6–8 c/seat-mile como cordura | DC-9 MMH/FH about 6.4; C-9 half the hours about 12 (p.702); DOC 6–8 cents per seat-mile (p.705); $400M / $2M => break-even #200 (p.706); $110 at 10% => NPV $100 (p.707) | no | S | 3 |
| raymer-c19-01 | 19 | La matriz 3x3 del caza pequeno: de nueve aviones al optimo | dimensionado-aeronave, optimizacion, planeacion | Diagnostico: 5 viola solo s_TO; 3 unico factible; 4,7,8,9 infactibles; optimo en cruce, no en celda; gate CP-1; matriz y carpet = 'same results!' | 'the as-drawn baseline (number 5) exceeds the requirements except for takeoff distance'; 'Number 3 exceeds all requirements but is very heavy'; optimo 'where two constraint lines cross' (p.719–723) | no | M | 5 |
| raymer-c19-02 | 19 | Relajar la pista: carpet plots con despegue de 600 y 700 ft | dimensionado-aeronave, optimizacion | W0_opt(700) <= W0_opt(600) <= W0_opt(500); con 700 ft el baseline 5 es factible => W0_opt(700) <= 43,700; cada optimo con las dos restricciones activas | — | no | M | 4 |
| raymer-c19-03 | 19 | La ecuacion de peso vacio del DR-1: calcular tu propio exponente c | dimensionado-aeronave, pesos-cap15, ensamble, masa-inercia | c derivado en -0.05..-0.15; con c = -0.1 reproduce la tabla +-0.1 lb; motor FIJO no escala | AC-SIZE con c = -0.1: 1200.0 119.6 883.0 1222.6 -> ... -> 1289.2 128.5 941.9 1290.4 (p.876) | no | M | 4 |
| raymer-c19-04 | 19 | El lazo que se muerde la cola: 15 iteraciones del DR-1 (rubber) y 3 (motor fijo) | dimensionado-aeronave, planeacion | 18 filas +-0.1 lb; relajacion 0.8 verificada en 3 corridas; gates: fraccion > 1.0 error, < 0.9 partir, /dW0/ > 30% redraw | Rubber: 1200.0 119.6 883.0 1222.6 / 1218.1 121.4 895.0 1236.3 / ... / 1289.2 128.5 941.9 1290.4 (15 filas). Fijo: 1200.0 95.4 883.0 1198.4 / 1198.7 95.3 882.2 1197.5 / 1197.7 95.2 881.5 1196.7 (p.876–877) | no | S | 5 |
| raymer-c19-05 | 19 | El carpet plot 5x5 del DR-3 y el requisito que vale 19% del avion | dimensionado-aeronave, optimizacion, parametrico, planeacion | 25x3 sizing y 25x7 desempeno exactos; optimo 19,300 +-1%; relajado 15,600 +-1% con T/W 0.9; gate CP-5: el optimo pesa MAS que el baseline y se explica; erratum {4218 kg} | Optimo (cruce Landing x Accel 30 s): W0 = 19,300 lb, T/W 1.1, W/S 59 — '17% greater than the as-drawn'; relajando a 50 s: W0 = 15,600 lb, T/W 0.9, W/S 54 — 'a 19% reduction' (p.955); tabla de 25 variantes p.956 (#1: 44.843, 0.7840, 15470, 10308, 4051.4; #25: 67.265, 1.1760, 20573, 13335, 6127.4) | no | L | 5 |
| raymer-c19-06 | 19 | Optimizacion multivariable restringida del DR-3: Kuhn–Tucker como test | dimensionado-aeronave, optimizacion, parametrico | W0 = 15,242 +-1% Y ninguna violada Y exactamente TRES activas (1.7, 0.1, 49.4); peso correcto con activas equivocadas REPRUEBA; deteccion de optimo no acotado | W0 17,060.2 -> 15,242.2 lb; We 11,257.5 -> 9,925.5; Wf 4,692.7 -> 4,206.7; restricciones (req/base/best): Takeoff 1000/723.6/720.0; Landing 1000/990.4/960.4; Ps@n=5 0/64.2/1.7; Ps@n=5 0/156.6/62.0; Ps@n=1 0/684.6/515.7; Ps@n=1 0/71.5/0.1; Accel 50/42.2/49.4 (p.955–957) | no | L | 5 |
| raymer-c19-07 | 19 | El fuselaje que no encoge: photo-scale y cuadrado-cubo | dimensionado-aeronave, masa-inercia | 0.01206 -> 120 counts +-1; 0.5^1.5 = 0.354 medido por el kernel al escalar un solido; -0.06 NO cableado | '100 counts will increase to 120 counts'; volume factor (1/2)^(3/2) = 0.354; empty-weight exponent 'from -0.06 to -0.31' (p.716–717) | parcial | S | 3 |
| raymer-c19-08 | 19 | El gate anti-fraude: densidad interna W0/V_interno medida por el kernel | ensamble, masa-inercia, dimensionado-aeronave, optimizacion | V_interno del kernel por variante; rho_var/rho_base fuera de 1+-0.05 -> 'no creible'; el gate corre sin humano | 'If there were sufficient room in the baseline to fit two more missiles internally, then the baseline was poorly designed. If the baseline was already tight, then the revised layout must be a fake!' (p.725) | parcial | M | 4 |
| raymer-c19-09 | 19 | La mision del DR-3 en 14 tramos: fracciones, peso soltado y el gate 0.9–1.0 | dimensionado-aeronave, planeacion | Columna Wi/W0 +-0.0001 con el drop RESTADO: Wf/W0 = 0.2751 != (1-0.7171) 1.06 = 0.2999 (bug clasico); tramo 1.0000 pasa; gate 30% pasa | Wi/W0 acumulado 0.9584 ... 0.7171; FUEL 4693.0 lb; EMPTY 11258.2; LOAD 1110.0; GROSS 17061.2 lb; as-drawn 16,480 -> 17,062 (+3.5%) (p.943, 948) | no | M | 5 |
| raymer-c20-01 | 20 | Sizing electrico: BMF se SUMA y el logaritmo desaparece | dimensionado-aeronave, planeacion | BMF_total = sum; ninguna ecuacion con ln; BMF independiente de W0 => converge en menos iteraciones; ratio alcance ~1/20; OCR 'EMF' por 'BMF' | 'gasoline has 20 times better effective energy density than the best batteries' (p.740); 'the sum (not product) of the various mission segment Battery Mass Fractions' (p.759) | no | M | 4 |
| raymer-c20-02 | 20 | Alcance, loiter y ascenso electricos del avion de helice del cap 17 | dimensionado-aeronave, desempeno | mks obligatorio (V en m/s falla por 3.6); R independiente de V; electrico/gasolina ~ 1/20 | — | no | S | 3 |
| raymer-c21-01 | 21 | Sikorsky S-58: potencia en crucero a 128 kt y 5,000 ft | dimensionado-aeronave, desempeno, atmosfera-ISA | Salida como BANDA; P_crucero < potencia por Tabla 21.1 (1,700–2,400 hp); A = 4/pi; el erratum NO se propaga | — | parcial | M | 3 |
| raymer-c21-02 | 21 | S-58: potencia de hover y velocidad de descenso en autorrotacion | dimensionado-aeronave, desempeno | P_hover como banda por M; ascenso vertical = hover + W V_c/2; V_desc = 2 Vi; dentro de W/P 4–8 lb/hp | 'net thrust is typically 83% or less of the theoretical ideal'; 'M = 0.6 to 0.8'; +5% at D/2, +18% at 0.2 D (p.797) | no | S | 3 |
| raymer-c21-03 | 21 | El ASW del cap 3 convertido a VTOL con motores de sustentacion | dimensionado-aeronave, planeacion, croquis | W0_VTOL > W0_CTOL con factor de crecimiento; la Swet extra se MIDE en el kernel al agregar los bultos; gate del 30% | 'the Harrier has an empty-weight fraction We/W0 of only 0.48, whereas a statistical approach... about 0.55' (p.788) | no | M | 3 |
| raymer-c22-01 | 22 | Un cohete para ponerte a ti en orbita: Delta-V y la fraccion de segmento de Tsiolkovsky | dimensionado-aeronave, planeacion, revolve | V_s(200 km) = 25,548 fps; ecuacion del cohete como fraccionDeSegmento inyectada; Delta-V se SUMA; Isp fuera de tabla bandera; divergencia reportada | 'roughly 6,000 fps to the Delta-V required to reach Earth orbit'; rotational assist '1,542 fps adjusted for latitude'; Earth orbit to Mars 'roughly 38,000 fps' (p.812–813) | no | M | 3 |
| raymer-c22-02 | 22 | Planetas y transferencias de Hohmann como tablas del motor | planeacion | sqrt(2 g0 R0) = 11,180 vs 11,179 (+-0.1%); Luna 2,343 vs 2380 (+-2%); resto NO se teclea sin verificar el PDF | Table 22.3 Hohmann: Mars 11,582 mps, 260 days; Table 22.2 Earth escape 11,179 m/s, g 9.806 (p.813–814) | no | S | 2 |
| raymer-c22-03 | 22 | Un globo de helio que te cargue a ti (y el casco de dirigible que lo envuelve) | revolve, masa-inercia, dimensionado-aeronave, atmosfera-ISA | %F = 0.74 +-0.01 y casco 1.35x +-0.02 con la ISA del repo; volumen del casco medido = V_gas/%F; sin Breguet | 'reaching 10,000 ft without venting requires a sea-level percent fullness of about 0.74. Thus, the hull volume must be 1.35 times...' (p.829) | parcial | S | 3 |
| raymer-c23-01 | 23 | Joined wing en el ASW: -28% de peso alar y +4% de arrastre, conviene? | dimensionado-aeronave, optimizacion, planeacion | Corrida A/B del lazo con We_ala x0.72 y CD0 x1.04; signo y magnitud de dW0 con banda; cada variante con su carpet o 'no creible' | — | no | M | 3 |
| raymer-c23-02 | 23 | Los factores de ajuste de peso de configuraciones raras como ENTRADAS del motor de pesos | dimensionado-aeronave, pesos-cap15 | 0.768/0.774 como parametros nombrados; area mojada y CLmax trimado MEDIDOS por variante | 'the 0.768 wing weight adjustment typical for delta wings... probably with a weight adjustment of 0.774' (p.834–839) | no | S | 2 |
| raymer-c23-03 | 23 | Dos medias alas tienen 70% del volumen: que lo demuestre el kernel | loft, masa-inercia, croquis, cotas | V_media/V_completa = 0.354 +-1% medido por occt; error vs 0.5^1.5 = test del loft | 'a half-size wing only has 35% of the volume, so two of them have only 70%' (p.854) | parcial | S | 4 |
| raymer-c23-04 | 23 | Estirar la envergadura de un avion existente: el escalon de costo | parametrico, FEA-estatico, costo, dimensionado-aeronave | Curva costo(b) con discontinuidad donde sigma_raiz > admisible (FEA); calibracion registrada (GOB-9); optimizador reporta 'funcion no suave' | 'There is a cost step function... There are no top-level, rule-of-thumb estimations. You need to do the real calculations.' (p.864) | parcial | L | 3 |

## 3. Features de la suite (consolidadas)

### [P0] Lazo de sizing W0 (caps 3, 6, 19, 20, 22): punto fijo con fracciones por segmento inyectables
- **Que hace:** W0 = (Wcrew+Wpayload)/(1 - Wf/W0 - We/W0) con We/W0 = A W0^C Kvs (gate C<0) o We escalado (19.13); fracciones historicas/Breguet/endurance/Tsiolkovsky/BMF sumado; drop de carga RESTADO; refuel; +6%; relajacion 0.75/0.8; gates 0.9–1.0 y 30%; motor fijo (W0 o R como variable); trades y growth factor
- **Estado en La Forja:** no — ls src/aero -> atmosfera, cuna-anderson, panel2d, potencial, skin, wing-metrics; sin sizing.ts (planeado pliego-aero.md §8.3 F0, CURRICULUM-AERO a10-l1)
- **Capitulos:** [3, 6, 19, 20, 21, 22, 23]
- **Ejercicios:** raymer-c3-01, raymer-c3-03, raymer-c3-04, raymer-c3-05, raymer-c3-06, raymer-c3-07, raymer-c6-01, raymer-c6-02, raymer-c19-03, raymer-c19-04, raymer-c19-09, raymer-c20-01, raymer-c22-01, raymer-c23-01

### [P0] Diagrama de restricciones T/W–W/S (cap 5) con dueno por tramo, veto y recheck
- **Que hace:** Perdida, TOP, aterrizaje, crucero, loiter, viraje inst/sost, ascenso, techo, ratiadas a despegue; minimo con quien manda; imposibilidades 5.26/5.31 como violacion, no NaN
- **Estado en La Forja:** no — src/aero/atmosfera.ts:102 atmosferaISA, :124 presionDinamica; el resto no existe
- **Capitulos:** [5]
- **Ejercicios:** raymer-c5-01, raymer-c5-02, raymer-c5-03, raymer-c5-04, raymer-c5-05, raymer-c5-06, raymer-c5-07, raymer-c5-08, raymer-c5-09

### [P0] Medicion aero del solido: S_ref/S_exp/S_wet, A(x)/perimetro(x) por estacion, volumen interno, tanques con CG
- **Que hace:** Del B-Rep: trapecio hasta la linea central, expuesta, mojada por componente con resta de raices enterradas y huecos de toma; corte en N estaciones (volume distribution plot, Sears-Haack, area ruling); tanque = booleana x utilizable x rho con centroide; bench tubo+cono+ala en forja-gate
- **Estado en La Forja:** parcial — src/forja/brep/occt.ts:1415 volume, :1425 surfaceArea, :508 cut, :517 common, :633 VolumeProperties; src/aero/skin.ts:85 pielDeMalla; src/aero/wing-metrics.ts:89 metricasAla; corte por plano solo en src/forja/mold/mold.ts:182; bench ausente en scripts/forja-gate.cjs
- **Capitulos:** [3, 7, 8, 10, 12, 19, 23]
- **Ejercicios:** raymer-c3-02, raymer-c7-07, raymer-c7-08, raymer-c7-09, raymer-c7-10, raymer-c7-12, raymer-c8-02, raymer-c10-08, raymer-c12-01, raymer-c12-10, raymer-c19-08, raymer-c23-03

### [P0] Generador parametrico del Dash-One (caps 4, 6, 7): ala S,A,lambda -> solido, fuselaje L/fineness, colas por volumen con brazo medido, superficies de mando, ala por %MAC, 3 vistas con tabla
- **Que hace:** Del sizing salen los solidos; cambiar A/lambda/flecha/S regenera planta, largueros, flaps, alerones, tanques (arbol de features); colas a volumen constante; drawing con tabla de parametros §7.2
- **Estado en La Forja:** parcial — src/aero/wing-metrics.ts:178 macTrapezoidal (mide, no genera); occt.ts:321 extrudePolygon, :1080 loftSections; drawing.ts:168 generateDrawing; arbol parametrico de ala no verificado (memoria v1·1 arbolRef/piezaDesdeArbol es de molde)
- **Capitulos:** [4, 6, 7, 19]
- **Ejercicios:** raymer-c4-02, raymer-c4-03, raymer-c6-03, raymer-c6-04, raymer-c6-05, raymer-c7-04, raymer-c7-05, raymer-c7-11, raymer-c7-13, raymer-c19-05

### [P1] Loft de fuselaje con conicas (p), flat-wrap, buttock-planes, continuidad G1/G2, fillet variable, perfil NACA con comba fija
- **Que hace:** Primitiva conica A-B-C-p en el croquis; loft por 5–10 estaciones con lineas de control; curvatura gaussiana por cara (flat-wrap != ruled); cortes verticales automaticos; generador de perfil por coordenadas con escalado de espesor
- **Estado en La Forja:** parcial — occt.ts:1080 loftSections, :884 filletEdges (radio constante); sketch-solver.ts sin conica (grep -> 0); sin analisis de curvatura
- **Capitulos:** [4, 7, 8]
- **Ejercicios:** raymer-c4-01, raymer-c7-01, raymer-c7-02, raymer-c7-03, raymer-c7-06, raymer-c8-01

### [P0] Aerodinamica as-drawn (cap 12): build-up parasito, onda, drag rise, drag map, CL_alpha(M), CLmax con flaps, K(CL) por succion
- **Que hace:** Cf/FF/Q/misc/L&P por componente con ambas FF de fuselaje; Sears-Haack + 12.45; M_DD por tablas; CL_alpha con F y guardarrail; CLmax con S_flapped medida; K = S K_100 + (1-S) K_0; polar con tangente
- **Estado en La Forja:** no — grep 0.455|formFactor src/ -> nada; src/aero/potencial.ts y panel2d.ts son 2D; tablas digitalizadas solo en docs/forja-research/aero-pliego/raymer-rescate-cap12.md
- **Capitulos:** [10, 12]
- **Ejercicios:** raymer-c10-05, raymer-c12-02, raymer-c12-03, raymer-c12-04, raymer-c12-05, raymer-c12-06, raymer-c12-07, raymer-c12-08, raymer-c12-09, raymer-c12-11, raymer-c12-12

### [P1] Propulsion instalada y tomas (caps 10, 13): rubber engine, motor estadistico, A/A*, captura, diverter, C_ram, potencia parcial, helice, Gagg-Ferrar
- **Que hace:** Escalado 10.1–10.3 con aviso > 30%; modelos 10.4–10.15; A_capture por 10.16–10.20 restada de A_max; perdidas 13.5–13.9 con contabilidad explicita; helice por coeficientes
- **Estado en La Forja:** no — src/aero/atmosfera.ts (ISA, mach) es lo unico reutilizable
- **Capitulos:** [10, 13]
- **Ejercicios:** raymer-c10-01, raymer-c10-02, raymer-c10-03, raymer-c10-04, raymer-c10-06, raymer-c10-07, raymer-c13-01, raymer-c13-02, raymer-c13-03, raymer-c13-04

### [P0] Tren de aterrizaje (cap 11): llantas, cargas, angulos medidos, stroke/oleo, ballesta vs FEA, retraccion 4 barras con pozo; claros de armamento
- **Que hace:** Tabla 11.1 + 11.1–11.7; tipback/overturn/tail-strike medidos del ensamble contra la envolvente de CG; 11.12 y oleo; 11.14–11.19 vs FEA; 4 barras con pivote en mediatriz y juez de claros
- **Estado en La Forja:** parcial — src/forja/mech/fourbar.ts, src/forja/mech/ensamble.ts, src/forja/brep/fea.ts; nada especifico de tren
- **Capitulos:** [9, 11]
- **Ejercicios:** raymer-c9-03, raymer-c11-01, raymer-c11-02, raymer-c11-03, raymer-c11-04, raymer-c11-05, raymer-c11-06

### [P1] Cargas y estructura (cap 14): V-n + rafaga -> Nz, Schrenk, casos de carga, pandeo lineal, torsion, esqueleto largueros/caja
- **Que hace:** V-n elegido/calculado en Ve; Nz = 1.5 n_lim rotulado; Schrenk sobre la planta -> cortante/momento -> larguero vs FEA; Euler/crippling/placa/torsion como ballpark; solver de pandeo lineal
- **Estado en La Forja:** parcial — src/forja/brep/fea.ts:591 runFEA von Mises; sin V-n, Schrenk ni pandeo lineal (grep pandeo -> solo mold/warpage.ts)
- **Capitulos:** [8, 14]
- **Ejercicios:** raymer-c8-03, raymer-c14-01, raymer-c14-02, raymer-c14-03, raymer-c14-04, raymer-c14-05, raymer-c14-06

### [P0] Pesos y CG (caps 11, 15, 16): 59 ecuaciones, metodo por area, fudge, GWS, envolvente de CG por mision, inercias vs Tabla 16.1
- **Que hace:** Tres juegos con dominio y clamps; Nz ULTIMO; L_m/L_n en pulgadas; Tabla 15.2 auditor; Tabla 15.4 calibrada; combustible como cierre; CG por grupo con brazos del layout; deteccion de errata Tabla 15.1; I_xx/yy/zz del kernel vs radios de giro
- **Estado en La Forja:** parcial — occt.ts:633 BRepGProp.VolumeProperties (masa/CG/inercia del solido); grep emptyWeight|groupWeight src/ -> nada
- **Capitulos:** [11, 15, 16, 23]
- **Ejercicios:** raymer-c11-07, raymer-c15-01, raymer-c15-02, raymer-c15-03, raymer-c15-04, raymer-c15-05, raymer-c16-06, raymer-c23-02

### [P1] Estabilidad y control estatico del layout (cap 16)
- **Que hace:** X_np/SM/Cm_alpha desde areas y brazos MEDIDOS; downwash Fig 16.12; K_fus x57.3; trim plot; pull-up con C_mQ; Cn_beta/Cl_beta con regla -1/2; alabeo MIL-F-8785B; TDR/URVC
- **Estado en La Forja:** no — grep -ri 'neutral|margen est|Cn_beta|trim' src/aero -> nada; figuras en docs/forja-research/aero-pliego/raymer-rescate-cap16.md
- **Capitulos:** [16]
- **Ejercicios:** raymer-c16-01, raymer-c16-02, raymer-c16-03, raymer-c16-04, raymer-c16-05, raymer-c16-08, raymer-c16-09

### [P0] Motor de desempeno (cap 17) sobre tabla T(h,M) instalada
- **Que hace:** Vuelo nivelado, Breguet jet/helice, ascenso por tramos (signo 17.49 corregido), viraje con K(CL) iterativo y corner speed, planeo, Ps/h_e y trayectorias, envolvente q-limit/P_T0/techos, despegue/aterrizaje por segmentos con las seis distancias
- **Estado en La Forja:** parcial — src/aero/atmosfera.ts (atmosferaISA, presionDinamica, mach) SI; todo lo demas NO
- **Capitulos:** [17]
- **Ejercicios:** raymer-c17-01, raymer-c17-02, raymer-c17-03, raymer-c17-05, raymer-c17-06, raymer-c17-07, raymer-c17-08, raymer-c17-09, raymer-c17-10

### [P0] Sizing matrix / carpet plot / MVO con restricciones activas y gate de densidad interna
- **Que hace:** Malla 3x3..5x5 de variantes DISTINTAS dimensionadas; crossplots, iso-W0, lineas de restriccion; optimo en el cruce; pattern search factible con reduccion de paso; Kuhn–Tucker; photo-scale; rho = W0/V_interno medido por el kernel (+-5%)
- **Estado en La Forja:** parcial — grep -ri 'carpet|sizing matrix|optimiz' src/aero -> nada; occt.ts volumen/bbox SI para el gate; topopt.ts es otro problema
- **Capitulos:** [19, 23]
- **Ejercicios:** raymer-c19-01, raymer-c19-02, raymer-c19-05, raymer-c19-06, raymer-c19-07, raymer-c19-08, raymer-c23-04

### [P1] Costos (cap 18): DAPCA IV, curva de aprendizaje, dolares constantes, O&M/DOC/NPV con BANDA
- **Que hace:** 18.1–18.9 puras con fudge parametrizados, Q = min(total, 5 anos), {lo, nominal, hi} etiquetado por agrupacion y ano-base; x = 1 + log2(LC); break-even, NPV/IRR; costo escalonado en derivativos
- **Estado en La Forja:** no — grep -ri 'dapca|learning|NPV' src -> nada aeronautico
- **Capitulos:** [18, 23]
- **Ejercicios:** raymer-c18-01, raymer-c18-02, raymer-c18-03, raymer-c18-04, raymer-c23-04

### [P2] Cabina, pasaje y requisitos (caps 2, 9): hoja de requisitos, maniqui 95%, cabina por Tabla 9.1, claro estructural, mass balance
- **Que hace:** Esquema de requisitos que re-dispara el sizing; punto de ojo y angulos medidos; generador de cabina; OML - claro e interferencia; CG delante de la bisagra
- **Estado en La Forja:** parcial — occt.ts:965 shellSolid, :517 common, :633 VolumeProperties; sin maniqui ni requisitos (grep FAR ?23 -> nada)
- **Capitulos:** [2, 8, 9]
- **Ejercicios:** raymer-c2-01, raymer-c9-01, raymer-c9-02, raymer-c8-04, raymer-c8-05

### [P2] Vuelo vertical, electrico, cohetes y LTA (caps 20–22): la misma arquitectura de lazo con otra ecuacion de segmento
- **Que hace:** Helicoptero por teoria de momento (hover, autorrotacion, vuelo adelante A=4/pi); VTOL por balance; BMF sumado; Delta-V/Tsiolkovsky; dirigible por volumen con %F e ISA
- **Estado en La Forja:** parcial — src/aero/atmosfera.ts y occt revolve+volumen reutilizables; nada mas
- **Capitulos:** [20, 21, 22]
- **Ejercicios:** raymer-c20-01, raymer-c20-02, raymer-c21-01, raymer-c21-02, raymer-c21-03, raymer-c22-01, raymer-c22-02, raymer-c22-03

### [P1] aero-contratos + biblioteca de figuras digitalizadas con rango y bandera EXTRAPOLADO + registro de decisiones humanas
- **Que hace:** Patron mold-contratos.ts para aero (CRUCE §9): dominio por solver, referencias estampadas, W/S absurdo, C<0; Figs 3.5/3.6/5.4/12.x/16.x/17.x como LUT con banda; campos con autor/motivo para CLmax asumido, Q, E_wd, fudge, n limite; libro mayor empuje/arrastre
- **Estado en La Forja:** no — src/forja/mold/mold-contratos.ts existe como patron; src/aero sin contratos; docs/forja-research/aero-pliego/figuras/ solo caps 12–17; tablas en raymer-rescate-cap12/15-17/16.md
- **Capitulos:** [3, 5, 12, 13, 15, 16, 17]
- **Ejercicios:** raymer-c3-02, raymer-c5-04, raymer-c12-06, raymer-c12-08, raymer-c16-08, raymer-c17-08, raymer-c15-05, raymer-c13-01

### [P1] Escuela: lecciones a10-* del bloque Raymer (sizing a mano -> restricciones -> tubo+cono -> carpet -> MVO -> densidad)
- **Que hace:** public/escuela/lecciones/a10-lN.json + scripts/escuela/clase-drive.cjs producen el video 4K con oraculos por paso; optimizador BLOQUEADO hasta L4 (mandato §24.1)
- **Estado en La Forja:** parcial — public/escuela/lecciones/a1-l1.json y a1-l4.json existen (Anderson); a10-* no; plan en docs/forja-research/aero/CURRICULUM-AERO.md U10
- **Capitulos:** [3, 5, 7, 17, 19]
- **Ejercicios:** raymer-c3-01, raymer-c5-09, raymer-c7-09, raymer-c19-04, raymer-c19-01, raymer-c19-08

## 4. Supertickets propuestos (formato Temis, listos para pegar en una orden)

Sprint 1 = lo mas cercano a lo que ya funciona y mas valor. Lo ya hecho de aero (a1-l1, a1-l4 Anderson) se respeta y NO se duplica.

### `raymer-area-mojada-kernel` · sprint 1 · esfuerzo M · valor 5
**S2 · Lo que el CAD debe ENTREGAR: S_wet/S_ref/volumen con reglas de resta y el bench tubo+cono+ala**

**Objetivo:** El kernel mide S_ref (hasta la linea central), S_exp, S_wet por componente restando raices enterradas y huecos de toma, corta en N estaciones (A(x), perimetro(x)) y pasa el test de aceptacion §7.11 en forja-gate; el DR-3 (294/215/431.8/588) sale MEDIDO.

**Capitulos:** [3, 7, 8, 12] · **Depende de:** (nada)

**Ya existe:**
- src/forja/brep/occt.ts:volume (:1415), surfaceArea (:1425), cut (:508), common (:517)
- src/aero/skin.ts:pielDeMalla (area mojada por triangulo, cierre ∮n dS = 0)
- src/aero/wing-metrics.ts:metricasAla, macTrapezoidal
- src/forja/mold/mold.ts:splitMoldByPlane (corte por plano, solo molde)

```
## EJERCICIOS
- raymer-c7-09 · EL TEST DE ACEPTACION del CAD: tubo + cono + ala simple a mano · croquis, extruir, revolve, booleanas, surfaceArea, volume · S_wet a mano (valor cerrado) vs CAD < 0.5% y volumen < 0.1%; sumar el ala sin restar la raiz da +8% y el test lo cacha; la cara de entrada de la toma NO se cuenta
- raymer-c7-07 · Area mojada de ala/cola: formula vs kernel · surfaceArea, wing-metrics, booleanas · |S_wet_kernel/S_exp - 2.0394| < 0.03; con t/c -> 0 el cociente -> 2.000; S_exp = proyeccion/cos(5) +-0.1%
- raymer-c7-08 · Area mojada y volumen del fuselaje: formula rapida vs integracion por estaciones · seccion, surfaceArea, volume, integracion · Cuerpo circular esbelto: S_wet_kernel = pi*A_proy +-1% y la formula 3.4 se aparta ~8%; int perimetro = surfaceArea +-0.5% e int A = volume +-0.5% con >= 40 estaciones; con el ala unida la resta reduce S_wet en 2*(area raiz)
- raymer-c7-10 · Volume distribution plot desde el solido · seccion, volume, grafica, booleanas · int A(x)dx (N = 100) = volume +-0.3%; A(x) >= 0 y continua; refinar N 50->100 cambia < 0.1%
- raymer-c12-01 · S_ref, S_exp y S_wet del DR-3 medidas del solido · croquis, extruir, loft, ensamble, medir-area, cotas · S_wet/S_exp = 2.008 y 2.009 +-1%; S_ref medido = 294 +-0.1%; S_exp/S_ref = 0.73; f_fus = 8.218 y f_canopy = 6.95 medidas
- raymer-c3-02 · L/D del croquis por aspect ratio mojado · dimensionado-aeronave, area-mojada-kernel, wing-metrics · A_wet = 1.27 +-0.01; L/D_max = 16 +-0.5 (Fig 3.5 digitalizada); crucero 13.9 +-0.1. Extension: con el solido real, Swet/Sref medida por surfaceArea/S_ref debe caer en 2.2–6.2 (Fig 3.6)
- raymer-c12-10 · Cuerpo de Sears-Haack generado y distribucion de area del avion · croquis, revolve, seccion, medir-area, medir-volumen, dimensionado-aeronave · Volumen kernel vs integral analitica +-0.5%; A_max medida = entrada; (D/q)_SH = 2.0166 ft2 +-0.5%; bajar A_max 10% baja la onda ~19%
- raymer-c8-02 · Area ruling: suavizar la distribucion de volumen conservando el volumen · seccion, loft, edicion-parametrica, volume, grafica · RMS de A''(x) baja >= 30%; volumen +-0.5%; A(x) suavizada mas cerca de Sears-Haack
```

### `raymer-sizing-asw` · sprint 1 · esfuerzo M · valor 5
**S1 · El ASW del cap 3: W0 por punto fijo y sus trades (la vara de oro con 25 filas impresas)**

**Objetivo:** Nace src/aero/sizing.ts: lazo W0 con Tabla 3.1 (gate C<0), perfil de mision por segmentos, Breguet/endurance, relajacion 0.75, motor fijo; reproduce Boxes 3.1–3.4 fila a fila y la leccion se ve en pantalla con la grafica W0_calc vs W0_guess.

**Capitulos:** [3, 6] · **Depende de:** (nada)

**Ya existe:**
- src/aero/atmosfera.ts:atmosferaISA (a = 994.8 ft/s a 30 kft)
- scripts/forja-gate.cjs:vitest-aero (ya corre src/aero)

```
## EJERCICIOS
- raymer-c3-01 · Sizing del ASW: W0 por punto fijo · dimensionado-aeronave, mision-por-segmentos · W0 convergido = 56,702 lb +-0.1% y We/W0 = 0.4322, W_fuel = 21,393 lb; cada fila de la tabla de Box 3.1 reproducida +-1 lb; el metodo grafico (Fig 3.11) da el mismo W0
- raymer-c3-07 · Editor de perfil de mision con fracciones historicas · dimensionado-aeronave, mision-por-segmentos · Con la mision del ASW reproduce W7/W0 = 0.6441 +-0.0001; cada fraccion en (0,1]; mezcla de unidades dispara error; refuel parte la mision en dos
- raymer-c3-06 · Gate C<0: la ecuacion estadistica de peso vacio · dimensionado-aeronave · Para todas las clases con numerador 10,800 lb y Wf/W0 = 0.3773 el iterador converge en <= 10 vueltas con omega = 0.75; con C = +0.07 el modulo lanza error de dominio; We/W0 convergido en [0.30, 0.70]
- raymer-c3-03 · Trade de alcance del ASW (1000 y 2000 nmi) · dimensionado-aeronave, trade-study · W0(1000) = 42,372 +-5 lb; W0(2000) = 80,217 +-5 lb; W0(R) monotona creciente y convexa
- raymer-c3-04 · Trade de payload del ASW (5,000 y 15,000 lb) · dimensionado-aeronave, trade-study · 33,318 +-5 lb y 78,866 +-5 lb; growth factor dW0/dW_payload ~ 4.55 lb/lb
- raymer-c3-05 · Trade de materiales compuestos: el efecto palanca · dimensionado-aeronave, trade-study · 51,585 +-5 lb; (56,702-51,585)/56,702 = 9.0% +-0.2; growth factor dW0/dWe > 1
- raymer-c6-01 · Sizing refinado: marcha por la mision con relajacion 3/4 · dimensionado-aeronave, mision-por-segmentos · 0.956 +-0.001; con la mision del ASW converge en <= 6 vueltas con omega 0.75 vs >= 10 con 0.5; W_f = 1.06*W_fm exacto; un segmento 'drop 2,000 lb' reduce el peso corriente sin tocar W_f
- raymer-c6-02 · Motor de tamano fijo: los dos modos del solver · dimensionado-aeronave · Modo B: 2 motores de 9,275 lb y T/W 0.327 => W0 = 56,700 lb exacto; R* cumple |W0_calc(R*) - W0| < 0.1%; A y B coinciden solo con motor de goma equivalente
```

### `raymer-esqueleto-dash-one` · sprint 2 · esfuerzo L · valor 5
**S4 · Del W0 al Dash-One: ala S,A,lambda -> solido, fuselaje, colas por volumen con brazo MEDIDO, mandos y 3 vistas con tabla**

**Objetivo:** Generador parametrico que convierte el sizing en solidos B-Rep: ala trapezoidal cuyas metricas medidas coinciden con 7.5–7.9 a 1e-12, fuselaje Tabla 6.3, colas Tabla 6.4 con L_HT medido c/4->c/4, alerones/flaps con bisagra recta, ala colocada al 30% MAC, plano de 3 vistas con la tabla §7.2.

**Capitulos:** [4, 6, 7] · **Depende de:** raymer-sizing-asw, raymer-area-mojada-kernel

**Ya existe:**
- src/aero/wing-metrics.ts:macTrapezoidal (:178), metricasAla (:89)
- src/forja/brep/occt.ts:extrudePolygon (:321), loftSections (:1080), VolumeProperties (:633)
- src/forja/brep/drawing.ts:generateDrawing (:168)

```
## EJERCICIOS
- raymer-c7-04 · Ala de referencia trapezoidal desde S, A, lambda · croquis, extruir, wing-metrics, cotas · macTrapezoidal = cbar analitica a 1e-12; metricasAla del solido devuelve S +-0.01%, MAC +-0.1%, Ybar +-0.1%; eliptica 0.849/0.529 +-0.001
- raymer-c6-03 · Geometria inicial: S, T y longitud de fuselaje · dimensionado-aeronave, croquis · Cargo/bomber W0 = 56,702 lb => L = 54.8 ft +-0.1; metrica 0.104*25,720^0.5 = 16.7 m (coincide +-1%)
- raymer-c6-04 · Colas por coeficiente de volumen con brazo medido en el CAD · dimensionado-aeronave, ensamble, cotas, wing-metrics · S_HT y S_VT con L medido por el kernel entre puntos c/4 de las MAC +-0.5%; V-tail con S_VT/S_HT = 1 => diedro 45.0
- raymer-c6-05 · Particion de superficies de mando con largueros rectos · croquis, extruir, split, cotas, parametrico · Linea de bisagra recta (colinealidad < 1e-6*b); Cf/C constante +-0.5%; el aleron no toca la punta; flap+aleron cubren fuselaje..90% b/2 sin traslape ni hueco
- raymer-c7-05 · Colocar el ala respecto al CG por % de MAC · ensamble, masa-inercia, wing-metrics · (x_CG - x_LE_MAC)/MAC = 0.30 +-0.005 con x_CG del kernel; mover el ala 1 m mueve el % en -1/MAC exactamente
- raymer-c4-02 · Seleccion de aspect ratio y flecha por clase · dimensionado-aeronave · Reproduce la tabla; M_max = 2.0 dogfighter A = 3.52 +-0.01; LE >= arcsin(1/M) supersonico; aviso si (A, flecha) cruza la frontera de pitch-up (curva digitalizada)
- raymer-c4-03 · Colas y diedro 'que se vean bien' con area correcta · croquis, extruir, ensamble, cotas · Geometria dentro de rangos; interseccion del cono de estela a 45 grados desde el TE de la horizontal con el plano del timon => fraccion no tapada >= 0.33 (medible en el kernel)
- raymer-c7-13 · El Dash-One: tres vistas con la tabla de parametros · plano2D, cotas, ensamble · generateDrawing produce ALZADO/PLANTA/LATERAL sin aristas fantasma; tabla con los 8 grupos de §7.2 y cada numero coincide con el modelo (+-0.1%); reproducible en capsula
```

### `raymer-restricciones-tw-ws` · sprint 2 · esfuerzo L · valor 5
**S3 · El diagrama de restricciones T/W–W/S con dueno por tramo, veto humano y recheck**

**Objetivo:** Cada restriccion (perdida, TOP, aterrizaje, crucero, loiter, viraje, ascenso/techo) se evalua en SU condicion de vuelo, se ratia a despegue y se dibuja con quien manda; imposibilidades 5.26/5.31 como violacion, nunca NaN; lazo 3 de recheck.

**Capitulos:** [5] · **Depende de:** raymer-sizing-asw

**Ya existe:**
- src/aero/atmosfera.ts:atmosferaISA, presionDinamica

```
## EJERCICIOS
- raymer-c5-03 · W/S por velocidad de perdida y C_Lmax · dimensionado-aeronave · V_stall 61 kt, C_Lmax 1.6, rho 0.00238 => W/S = 20.2 psf +-0.1 (banda GA 17–26); Ec 5.7 con flecha 0 devuelve 0.9*c_lmax exacto
- raymer-c5-05 · W/S por distancia de aterrizaje · dimensionado-aeronave · S_landing 2500 ft, GA, C_Lmax 2.0 => W/S_land = 47.5 psf +-0.1; jet a 0.85 W0 => W/S_TO = 55.9 psf; regla 0.3*V^2 concuerda +-10% en 60–130 kt
- raymer-c5-06 · W/S optimo de crucero y loiter · dimensionado-aeronave · W/S_jet_cruise = W/S_prop_cruise/sqrt3 exacto; en Ec 5.13 C_Di = C_D0; con A 10, e 0.8, C_D0 0.02, q 100 psf => 70.9 psf +-0.1
- raymer-c5-08 · W/S por ascenso, techo y la condicion T/W >= G + 2 sqrt(C_D0/(pi A e)) · dimensionado-aeronave · T/W 0.30, G 0.05, C_D0 0.03, A 8, e 0.8: minimo 0.127 cumple; W/S real y positivo; bajando T/W a 0.12 reporta violacion de 5.31 (no NaN)
- raymer-c5-07 · W/S por viraje instantaneo y sostenido · dimensionado-aeronave · Con n = 1 la Ec 5.22 coincide con la 5.13; la Ec 5.26 detecta imposibilidad (raiz negativa) y el modulo la reporta como 'requisito inalcanzable', no como NaN
- raymer-c5-02 · Thrust matching: de crucero a despegue · dimensionado-aeronave · (T/W)_TO >= (T/W)_cru para todo T_cru/T_TO < 1; con L/D 13.9 y 0.22 => (T/W)_TO = 0.313 +-0.002
- raymer-c5-04 · W/S por distancia de despegue (TOP) · dimensionado-aeronave · W/S proporcional a TOP*(T/W); C_Lto = C_Lmax/1.21 exacto; la curva TOP(s_TO) digitalizada de la Fig 5.4 y validada en 2 puntos contra el DR-3 (c17-06)
- raymer-c5-09 · Diagrama de restricciones T/W–W/S con dueno por tramo y recheck · dimensionado-aeronave, diagrama-restricciones, trade-study · Todas las curvas en condiciones de despegue (cambiar peso de combate 0.85->1.0 mueve solo viraje); el punto elegido satisface toda restriccion no vetada; tras recheck |delta(T/W)| < 1%; un W/S 40% por debajo del resto dispara alerta §5.3.1
```

### `raymer-arrastre-dr3` · sprint 3 · esfuerzo M · valor 5
**S6 · Build-up de arrastre as-drawn del DR-3: 151.131 counts subsonico, 225.126 supersonico, M_DD y drag map**

**Objetivo:** Cf/FF/Q/misc/L&P por componente sobre las areas MEDIDAS de S2, ambas FF de fuselaje (la 6a y la previa que corre RDS), Sears-Haack + 12.45, M_DD por tablas digitalizadas con bandera, drag rise en 7 pasos; cada fila del DR3.DAA a +-1 count.

**Capitulos:** [10, 12] · **Depende de:** raymer-area-mojada-kernel

**Ya existe:**
- src/aero/atmosfera.ts (Re, M a 30/40 kft)
- docs/forja-research/aero-pliego/raymer-rescate-cap12.md (Figs 12.22–12.39 en tablas)

```
## EJERCICIOS
- raymer-c12-04 · Build-up de arrastre parasito subsonico del DR-3 (M0.4, 30,000 ft) · dimensionado-aeronave, medir-area, croquis, ensamble · FF_fus = 1.129 y FF_canopy = 1.196 exactos (prueba la ecuacion de ediciones previas, NO la 12.31); componentes +-1 count, total +-2; Re fuselaje 51.6e6 +-1%; las filas Misc NO se usan como gate
- raymer-c10-05 · Diverter de capa limite del DR-3: espesor y factor de forma · croquis, extruir, medir-area, dimensionado-aeronave · 1 + 2.830/4.200 = 1.6738 -> 1.674 exacto; espesor/L_fus en [0.01, 0.03]; rampa medida <= 30
- raymer-c12-05 · Build-up supersonico del DR-3 con arrastre de onda (M1.6, 40,000 ft) · dimensionado-aeronave, seccion, medir-area · Todos los FF = 1.000; Sears-Haack (9pi/2)(17.07/45.2)^2 = 2.0166 ft2 = 68.6 counts, xE_wd 2 = 137 a M1.2, a M1.6 ~122 (+-5%); Cdw > mitad del total; total +-2 counts
- raymer-c12-06 · Mach de divergencia de arrastre del ala (Ec 12.46 + Figs 12.29/12.30) — B-727 · dimensionado-aeronave, medir-angulo, perfil-2D · dM_DD(0.1->0.3) = -0.04 +-0.01; absolutos +-0.03; M_DD cuerpo saturado en 1.0; fuera de rango bandera, no numero
- raymer-c12-07 · Drag rise en 7 pasos (Fig 12.32) y Drag Map del DR-3 · dimensionado-aeronave · Curva pasa por las dos anclas +-2 counts; un solo maximo transonico; CD(M1.0) = 1/2 CD(M1.05); empalme ETIQUETADO como interpolacion
- raymer-c12-09 · Arrastre de flaps, tren y miscelaneos: CD0 de despegue y aterrizaje del DR-3 · dimensionado-aeronave, croquis, medir-area, ensamble · CD0_aterrizaje - CD0_limpio ~ 0.097 +-15%; dCD0_flap = 0 para delta < 10; L/D = CL/(CD0 + K CL^2) reproduce 3.07 y 2.53 +-1%
```

### `raymer-carpet-mvo-dr3` · sprint 3 · esfuerzo XL · valor 5
**S5 · Sizing por segmento, carpet 5x5 y MVO del DR-3: 25 variantes, 3 restricciones activas y el gate de densidad**

**Objetivo:** El lazo de sizing.ts reproduce AC-SIZE (18 filas del DR-1) y la traza de 14 tramos del DR-3 (drop restado), genera la matriz 3x3 y el carpet 5x5 con lineas de restriccion, lee el optimo en el cruce, corre el pattern search de 6 variables con Kuhn–Tucker y rechaza variantes cuya densidad interna medida por el kernel cambia.

**Capitulos:** [19] · **Depende de:** raymer-sizing-asw, raymer-esqueleto-dash-one, raymer-desempeno-dr3

**Ya existe:**
- src/forja/brep/occt.ts:volume, VolumeProperties (V_interno para el gate)

```
## EJERCICIOS
- raymer-c19-04 · El lazo que se muerde la cola: 15 iteraciones del DR-1 (rubber) y 3 (motor fijo) · dimensionado-aeronave, planeacion · 18 filas +-0.1 lb; relajacion 0.8 verificada en 3 corridas; gates: fraccion > 1.0 error, < 0.9 partir, |dW0| > 30% redraw
- raymer-c19-09 · La mision del DR-3 en 14 tramos: fracciones, peso soltado y el gate 0.9–1.0 · dimensionado-aeronave, planeacion · Columna Wi/W0 +-0.0001 con el drop RESTADO: Wf/W0 = 0.2751 != (1-0.7171) 1.06 = 0.2999 (bug clasico); tramo 1.0000 pasa; gate 30% pasa
- raymer-c19-03 · La ecuacion de peso vacio del DR-1: calcular tu propio exponente c · dimensionado-aeronave, pesos-cap15, ensamble, masa-inercia · c derivado en -0.05..-0.15; con c = -0.1 reproduce la tabla +-0.1 lb; motor FIJO no escala
- raymer-c19-01 · La matriz 3x3 del caza pequeno: de nueve aviones al optimo · dimensionado-aeronave, optimizacion, planeacion · Diagnostico: 5 viola solo s_TO; 3 unico factible; 4,7,8,9 infactibles; optimo en cruce, no en celda; gate CP-1; matriz y carpet = 'same results!'
- raymer-c19-02 · Relajar la pista: carpet plots con despegue de 600 y 700 ft · dimensionado-aeronave, optimizacion · W0_opt(700) <= W0_opt(600) <= W0_opt(500); con 700 ft el baseline 5 es factible => W0_opt(700) <= 43,700; cada optimo con las dos restricciones activas
- raymer-c19-05 · El carpet plot 5x5 del DR-3 y el requisito que vale 19% del avion · dimensionado-aeronave, optimizacion, parametrico, planeacion · 25x3 sizing y 25x7 desempeno exactos; optimo 19,300 +-1%; relajado 15,600 +-1% con T/W 0.9; gate CP-5: el optimo pesa MAS que el baseline y se explica; erratum {4218 kg}
- raymer-c19-06 · Optimizacion multivariable restringida del DR-3: Kuhn–Tucker como test · dimensionado-aeronave, optimizacion, parametrico · W0 = 15,242 +-1% Y ninguna violada Y exactamente TRES activas (1.7, 0.1, 49.4); peso correcto con activas equivocadas REPRUEBA; deteccion de optimo no acotado
- raymer-c19-08 · El gate anti-fraude: densidad interna W0/V_interno medida por el kernel · ensamble, masa-inercia, dimensionado-aeronave, optimizacion · V_interno del kernel por variante; rho_var/rho_base fuera de 1+-0.05 -> 'no creible'; el gate corre sin humano
```

### `raymer-desempeno-dr3` · sprint 3 · esfuerzo L · valor 5
**S8 · Desempeno del DR-3: despegue 723.6 ft, Ps con K no constante, corner speed, h_e = 42,447 ft y la envolvente**

**Objetivo:** Motor de desempeno sobre tabla T(h,M): despegue/aterrizaje por segmentos con las seis distancias, Ps/viraje n=1..5 (+-0.1), Breguet helice y mejor velocidad de crucero, ascenso, altura de energia y trayectorias, envolvente q-limit/P_T0/techos.

**Capitulos:** [17] · **Depende de:** raymer-arrastre-dr3, raymer-sustentacion-dr3

**Ya existe:**
- src/aero/atmosfera.ts:atmosferaISA, presionDinamica, mach

```
## EJERCICIOS
- raymer-c17-06 · Despegue y aterrizaje del DR-3: los seis segmentos con numero · dimensionado-aeronave, desempeno · Valores +-0.1 ft; 723.6 y 990.4 coinciden con la variante 13 del carpet p.956 ('Takeoff' = rodaje, NO distancia total)
- raymer-c17-07 · Ps, viraje y ascenso del DR-3 a Mach 0.9 / 30,000 ft con K NO constante · dimensionado-aeronave, desempeno · +-0.1 en Ps; K con minimo interior en n=3 es la firma: K constante FALLA; T/W y W/S del punto de vuelo
- raymer-c17-01 · Mejor velocidad de crucero del avion de helice a 10,000 ft · dimensionado-aeronave, desempeno, atmosfera-ISA · Helice: V = sqrt(2(W/S)/rho)(K/CD0)^0.25 ~ 193 ft/s ~ 114 kt (no impreso); benchmarks impresos: jet best-range = 3^0.25 = +31.6% sobre V_md, L/D 86.6% del maximo (p.645)
- raymer-c17-02 · Alcance de crucero a 150 kt con 500 lb de combustible · dimensionado-aeronave, desempeno, planeacion · Ec 17.28; gate S-02 del cap 19: W_f/W_i ~ 0.74 < 0.9 => partir el crucero en tramos; R(150 kt) < R(V_bestrange)
- raymer-c17-03 · Regimen de ascenso a 100 kt (SL y 10,000 ft) y mejor velocidad de ascenso · dimensionado-aeronave, desempeno, atmosfera-ISA · V_v(10 kft) < V_v(SL); mejor ascenso helice en C_L = sqrt(3 CD0/K); techo donde V_v_max = 0; tiempo por 17.50 con signo corregido
- raymer-c17-08 · Envolvente de viraje y corner speed de un caza tipico · dimensionado-aeronave, desempeno · Rama estructural exacta (< 2% en 8 puntos); corner 340 kt dentro de 300–350; maximo sostenido en Ps=0 con K(C_L)
- raymer-c17-09 · Altura de energia y trayectoria de minimo tiempo/combustible de ascenso · dimensionado-aeronave, desempeno, atmosfera-ISA, planeacion · h_e(M0.9, 30 kft) = 42,447 +-10 ft; 16 curvas de Fig 17.13 +-0.03 Mach; 'Ps = 0 at n = 5 at M0.9 30,000 ft' se cumple; trayectoria = Ps maximo por h_e
- raymer-c17-10 · Envolvente de operacion: q-limit, presion de ducto, techos y Ps=0 · dimensionado-aeronave, desempeno, atmosfera-ISA · q=const CALCULADA cruza Fig 17.11 a +-0.015 Mach; P_T0 isentropica; apices Ps=0 +-0.3 kft
```

### `raymer-pesos-cg-dr3` · sprint 3 · esfuerzo L · valor 5
**S9 · Group Weight Statement del DR-3 (10,947.2 lb), envolvente de CG y la errata de la Tabla 15.1**

**Objetivo:** Las 24 ecuaciones de caza con dominio, clamps (L_s/L_d >= 0.25) y Nz ULTIMO rotulado; Tabla 15.2 como auditor; fudge calibrado T-38; CG por grupo con brazos del layout y envolvente por mision (<= 8% MAC); inercias del kernel vs Tabla 16.1; el software caza 362,744 != 380,972.

**Capitulos:** [11, 15, 16] · **Depende de:** raymer-esqueleto-dash-one, raymer-area-mojada-kernel

**Ya existe:**
- src/forja/brep/occt.ts:VolumeProperties (:633) masa/CG/inercia del solido

```
## EJERCICIOS
- raymer-c15-01 · Group Weight Statement del DR-3 con las 24 ecuaciones de caza (15.1–15.24) · dimensionado-aeronave, medir-area, ensamble, centroide · Sumas exactas 4526.2 + 2354.3 + 3066.7 + 1000 = 10,947.2; + 5532.8 = 16,480.0; engine mounts 39.07; air induction 290.2 (clamp); avionics 987.3; OJO fuselaje (15.4) y nose gear (15.6) no cierran con el OCR -> confirmar impreso
- raymer-c15-02 · Sistema de admision (Ec 15.10) con el clamp L_s/L_d >= 0.25 — DR-3 · dimensionado-aeronave, medir-distancia · 290.2 lb vs 291.1 (0.3%); sin clamp 323 lb (11% arriba)
- raymer-c15-03 · Metodo rapido por area (Tabla 15.2) como auditor del detallado · dimensionado-aeronave, medir-area · Cada grupo usa el AREA correcta; razon detallado/rapido en 0.5–2.0 o bandera; CG aproximados alimentan primera envolvente
- raymer-c15-04 · Envolvente de CG a lo largo de la mision y la errata de la Tabla 15.1 · dimensionado-aeronave, centroide, ensamble · Recorrido 0.7 ft = 6.8% MAC < 8%; sum momentos = 380,972 != 362,744 (diferencia = 18,228 = payload) => CG consistente 23.11 ft: el software caza la errata
- raymer-c15-05 · Fudge factors (Tabla 15.4) y calibracion contra un avion conocido (T-38/F-5B) · dimensionado-aeronave · 1042/1067 = 0.9766; 0.977 x 0.85 = 0.830; fudge registrado con autor/motivo, nunca default
- raymer-c11-07 · Avionica por fraccion de peso vacio (Tabla 11.6) y su bahia · dimensionado-aeronave, extruir, ensamble, medir-volumen · 2.117*727^0.933 = 987.3 ~ 989.8 (+-0.3%); inversion devuelve 727 +-1 lb; bahia 22–33 ft3; 990/10,947 = 9.0% > 0.08 => FUERA DE BANDA
- raymer-c16-06 · Momentos de inercia: el kernel contra los radios de giro de Tabla 16.1 · ensamble, masa-inercia, dimensionado-aeronave · I kernel vs estadistico +-30% por eje; R_z^2 ~ R_x^2 + R_y^2 (-14% a +17%); el entrenador militar se carga con bandera OUTLIER
```

### `raymer-sustentacion-dr3` · sprint 3 · esfuerzo M · valor 5
**S7 · Sustentacion 3D del DR-3: CL_alpha(M), CLmax con S_flapped medida, K(CL) con minimo interior y la polar**

**Objetivo:** Ecs 12.6–12.14 con F del fuselaje medido (d/b) y guardarrail; CLmax con Tablas 12.1/12.2 y S_flapped del croquis; K = S K_100 + (1-S) K_0 con Fig 12.39 (la firma: minimo en n=3); polar parabolica con tangente desde el origen; decisiones humanas (1.8) registradas.

**Capitulos:** [12] · **Depende de:** raymer-area-mojada-kernel, raymer-esqueleto-dash-one

**Ya existe:**
- src/aero/wing-metrics.ts:metricasAla (A, lambda, flecha medidos)
- src/aero/potencial.ts (2D, no reutilizable para ala finita)

```
## EJERCICIOS
- raymer-c12-02 · Pendiente de sustentacion CL_alpha(M) del DR-3 (Ecs 12.6–12.9, 12.14) · dimensionado-aeronave, croquis, medir-angulo, perfil-2D · 1.07(1+5.5/32.08)^2 = 1.47 +-1%; 1/cos 38 = 1.2691; 1/(pi 3.5) = 0.0909; CL_alpha(M0.2) = 3.6717 +-0.5% (RDS NO aplico el 0.98: reproducir y bandera); maximo en M1.10
- raymer-c12-03 · CLmax del DR-3 con flaps (Ecs 12.15, 12.21; Tablas 12.1, 12.2) · croquis, cotas, perfil-2D, dimensionado-aeronave, medir-area · dCLmax = 0.82 +-2% con S_flapped medida; 1.64 exacto; el 1.8 final es decision humana registrada con autor
- raymer-c12-08 · K por succion de borde de ataque (Ecs 12.56–12.58, Fig 12.39) — DR-3 · dimensionado-aeronave · K(n) tiene MINIMO en n=3 (CL 0.41 ~ diseno 0.40) — firma del metodo; K_100 = 0.0909; S(1.4) = 0 => K = 1/CL_alpha; K(0.45, M0.4) = 0.1013
- raymer-c12-11 · Polar parabolica y L/D: verificacion contra el solver de mision del DR-3 · dimensionado-aeronave · 10.244 (0.2%); 12.054 (0.001%); 4.363 (0.06%); tangente en CL = sqrt(CD0/K)
- raymer-c12-12 · Eficiencia de envergadura de biplano (Ec 12.50 + Fig 12.36) · dimensionado-aeronave, croquis, medir-distancia · e = 2/(1 + 0.561) = 1.281 vs 'about 1.3' (-1.5%); fuera de mu 0.4–1.0 bandera
```

### `raymer-ala-parametrica-tanques` · sprint 4 · esfuerzo L · valor 4
**S15 · El ala que regenera sus partes: largueros, flaps, tanques con volumen y CG, y el 70% del cuadrado-cubo**

**Objetivo:** Arbol de features donde la planta es la raiz: cambiar A regenera largueros al 25%/65%, alerones, carrythrough y el tanque (booleana x 85% x rho) que cierra contra el W_f del sizing; fuel-volume plot con centroide (DR-3 X = 22.25 ft); media ala = 35.4% del volumen medido.

**Capitulos:** [7, 8, 10, 23] · **Depende de:** raymer-esqueleto-dash-one, raymer-sizing-asw

**Ya existe:**
- src/forja/brep/occt.ts:cut, common, volume, VolumeProperties, loftSections
- memoria v1·1: arbolRef + piezaDesdeArbol (arbol->molde; NO verificado para alas)

```
## EJERCICIOS
- raymer-c7-11 · El ala parametrica que regenera sus partes derivadas · parametrico, arbol-de-features, croquis, extruir, booleanas, volume · Cambiar A de 8 a 10 con S fija: b = sqrt(10 S) +-1e-9, largueros al 25%/65% local +-0.1%, volumen de tanque regenerado cierra vs W_f del sizing; regeneracion < 2 s
- raymer-c7-12 · Volumen de tanque de geometria arbitraria = un boton · booleanas, volume, masa-inercia · Volumen = kernel volume(ala ∩ caja - duct); W_fuel = V*0.85*rho; cierre contra c3-01 (21,393 lb => 502 ft3 brutos); CG del combustible dentro de +-5% MAC del CG
- raymer-c10-08 · Volumen de tanques medido del solido y fuel-volume plot con CG · croquis, loft, seccion, medir-volumen, centroide, dimensionado-aeronave · 4422.8/703.3 = 6.29 lb/gal (JP-4 6.32, -0.5%); volumen kernel x utilizable >= W_f/rho; CG = centroide del volume plot +-1% L_fus; 389 + 314.3 = 703.3
- raymer-c8-03 · Esqueleto estructural: largueros, caja de ala, carrythrough y cutouts · croquis, extruir, ensamble, FEA-estatico · Largueros rectos con % constante +-0.5%; ningun cutout intersecta la caja; FEA: cutout en la caja => sigma_vM max >= 1.5x la version limpia
- raymer-c23-03 · Dos medias alas tienen 70% del volumen: que lo demuestre el kernel · loft, masa-inercia, croquis, cotas · V_media/V_completa = 0.354 +-1% medido por occt; error vs 0.5^1.5 = test del loft
```

### `raymer-cargas-estructura` · sprint 4 · esfuerzo L · valor 4
**S11 · V-n -> Nz = 11 -> Schrenk sobre la planta -> larguero vs FEA; pandeo y torsion como ballpark**

**Objetivo:** V-n de maniobra + rafaga en Ve con Nz = 1.5 n_lim rotulado; Schrenk sobre el ala dibujada -> cortante/momento -> larguero verificado con el FEA del kernel; casos de carga de tren/motor; Euler/crippling/placa y torsion (Tabla 14.7) contra el solver; esqueleto largueros/caja con cutout cazado.

**Capitulos:** [8, 14] · **Depende de:** raymer-sustentacion-dr3, raymer-esqueleto-dash-one

**Ya existe:**
- src/forja/brep/fea.ts:runFEA (:591), prepareFeaSession (:842) von Mises
- src/forja/mold/warpage.ts (pandeo de placa, molde; no lineal generico)

```
## EJERCICIOS
- raymer-c14-01 · Diagrama V-n de maniobra y rafaga -> Nz ultimo del DR-3 · dimensionado-aeronave, croquis · Nz = 1.5 x 7.33 = 11.0 exacto y la UI rotula 'ultimo = 1.5 x limite'; n_rafaga GA 2–3 g; el V-n usa Ve; avion mas ligero => dn mayor
- raymer-c14-02 · Schrenk sobre el ala dibujada -> cortante/momento -> larguero verificado con FEA · croquis, extruir, patron, FEA-estatico, plano2D, cotas, dimensionado-aeronave · int carga dy = n W +-0.1%; momento en raiz analitico vs FEA +-5%; sigma_max FEA vs Mz/I +-5%; bandera si flecha con vortice
- raymer-c14-03 · Pandeo de columna, crippling y placa (Ecs 14.30–14.34) vs pandeo lineal del kernel · croquis, extruir, pandeo, FEA-estatico, cotas · Carga critica del solver vs Euler +-3% en tubo articulado; P_c no depende de sigma_ult ni de A; F_crippling = 0.3 E t/R
- raymer-c14-04 · Torsion de eje, tubo y caja cerrada (Ecs 14.45–14.50, Tabla 14.7) · croquis, extruir, FEA-estatico, cotas · tau_max y phi FEA vs formula +-5% en eje circular; caja cerrada +-5%; rectangulo b/t = 1 +-5%
- raymer-c14-05 · Cargas de tren, motor y mandos como casos de carga del FEA · FEA-estatico, ensamble, dimensionado-aeronave · Cada caso registrado con origen (§) y factor 1.5; equilibrio; drop = 3.6 sqrt(W/S) +-1%
- raymer-c8-03 · Esqueleto estructural: largueros, caja de ala, carrythrough y cutouts · croquis, extruir, ensamble, FEA-estatico · Largueros rectos con % constante +-0.5%; ningun cutout intersecta la caja; FEA: cutout en la caja => sigma_vM max >= 1.5x la version limpia
- raymer-c14-06 · Barra 1-D del FEM: {P} = [K]{u} · FEA-estatico · Desplazamiento = PL/(EA) +-1e-6; refinamiento converge monotono
```

### `raymer-loft-fuselaje` · sprint 4 · esfuerzo L · valor 4
**S13 · Loft conico con p = 0.4142, flat-wrap vs ruled, buttock-planes y continuidad G2**

**Objetivo:** Primitiva conica A-B-C-p en el sketcher; loft por 5–10 estaciones verificado con cortes verticales; curvatura gaussiana por cara (el X-31 de $400k); continuidad de pendiente/curvatura; fillet ala-fuselaje de radio variable; perfil NACA con comba fija.

**Capitulos:** [4, 7, 8] · **Depende de:** raymer-area-mojada-kernel

**Ya existe:**
- src/forja/brep/occt.ts:loftSections (:1080), filletEdges (:884)
- src/forja/brep/sketch-solver.ts (spline via loadDoc smooth; sin conica)

```
## EJERCICIOS
- raymer-c7-01 · Conica con parametro de forma p (circulo p = 0.4142) · croquis, conica, cotas · Con p = 0.4142 y tangentes a 90 la curva se aparta de un circulo < 1e-4*|AB|; p = 0.5 parabola; tangente en A y B coincide con AC y BC (G1 exacto)
- raymer-c7-02 · Loft de fuselaje por 5–10 estaciones y verificacion por buttock-planes · loft, seccion, croquis, plano2D · Para N >= 5 buttock-planes la curva de interseccion no tiene inflexiones espurias; p(x) monotona por tramos; una estacion redundante no cambia el solido > 0.1% de volumen
- raymer-c7-03 · Flat-wrap: superficie desarrollable vs ruled surface · loft, superficie, analisis-curvatura · Curvatura gaussiana |K| < 1e-6/mm2 en el tramo flat-wrap; el loft ruled entre dos secciones rotadas da |K| > 0 (contraejemplo); area desarrollada = area 3D +-0.1%
- raymer-c8-01 · Continuidad longitudinal: sin quiebres de pendiente ni de curvatura · loft, analisis-curvatura, seccion · Salto de tangente < 0.5 y de curvatura relativo < 10% sobre >= 5 buttock-planes; un quiebre deliberado tiene R >= D_fus; angulo de cierre trasero <= 12
- raymer-c7-06 · Fillet ala-fuselaje de radio variable · fillet, superficie, ensamble · Radio en el LE = 0.10*C_root +-2% y monotono creciente; G1 (< 0.5 grados); area mojada sube < 3%
- raymer-c4-01 · Perfil por coordenadas y escalado de espesor con comba fija · croquis, perfil-2D, spline · Linea de comba antes/despues identica (< 1e-6 c); t/c max = objetivo +-0.1%; origen en el LE; el croquis no colapsa puntos (gotcha snap 10 px, CRUCE §4.6)
```

### `raymer-propulsion-tomas` · sprint 4 · esfuerzo M · valor 4
**S12 · Motor rubber, area de captura, diverter FF 1.674 y empuje instalado del DR-3 (inlet loss 0.0405 exacto)**

**Objetivo:** Motor escalable con aviso > 30%; A/A* isentropico y captura del DR-3 (17.07 ft2 neta); diverter con FF 1 + d/l; perdidas de toma/tobera con C_ram(M) que reproduce las 11 filas del DR3.DPR; SFC a potencia parcial; helice por punta; Gagg-Ferrar con la ISA del repo.

**Capitulos:** [10, 13] · **Depende de:** raymer-area-mojada-kernel

**Ya existe:**
- src/aero/atmosfera.ts:mach, atmosferaISA

```
## EJERCICIOS
- raymer-c10-01 · Motor 'rubber': escalar un motor real al empuje requerido · dimensionado-aeronave, revolve, ensamble, cotas · W/W_act = SF^1.1, D/D_act = SF^0.5, L/L_act = SF^0.4 exactos; bandera si SF fuera de 0.7–1.3
- raymer-c10-03 · Area de captura de toma subsonica por A/A* (Ecs 10.16–10.17) · dimensionado-aeronave, croquis, revolve, sweep, cotas · (A/A*)(0.6) = 1.188 y (0.4) = 1.590 +-0.5%; razon 0.75 +-1%; el conducto generado tiene ese cociente medido por el kernel
- raymer-c10-04 · Area de captura supersonica del DR-3 y A_max neta · dimensionado-aeronave, croquis, seccion, medir-area · 20.9 - 3.83 = 17.07 exacto; A_c/m_dot dentro del eje de la Fig 10.17; capture-area ratio <= 1 (Ec 10.20)
- raymer-c10-05 · Diverter de capa limite del DR-3: espesor y factor de forma · croquis, extruir, medir-area, dimensionado-aeronave · 1 + 2.830/4.200 = 1.6738 -> 1.674 exacto; espesor/L_fus en [0.01, 0.03]; rampa medida <= 30
- raymer-c13-01 · Empuje instalado del DR-3: perdidas de toma, sangrado y tobera · dimensionado-aeronave · 1.35(0.970 - 0.940) = 0.0405 exacto; 1.20(0.897 - 0.830) = 0.0804 ~ 0.0807; 0.015 x 16.9 = 0.2535; signo negativo = gana empuje (no recortar a 0)
- raymer-c13-02 · SFC a potencia parcial (Ec 13.9) en el crucero del DR-3 · dimensionado-aeronave · 0.083/0.167 = 0.497; C sube 32% (0.9948/0.7518) reproducido +-5%; (V/C)(L/D)/W = 0.3839 vs 0.3842
- raymer-c10-06 · Diametro de helice: velocidad de punta vs estadistica · dimensionado-aeronave, revolve, ensamble, medir-distancia · D_usado = min(D_tip, D_stat); V_tip helicoidal a V_max < limite; claro medido con strut de nariz comprimido >= 7 in
- raymer-c13-04 · Potencia de piston con altitud (Gagg-Ferrar, Ec 13.10) · dimensionado-aeronave · P/P_SL(20,000 ft) = 0.471 < 0.5 (con la ISA del repo +-0.5%)
```

### `raymer-tren-aterrizaje` · sprint 4 · esfuerzo L · valor 4
**S10 · El tren que arruina el layout: llantas, angulos medidos en 3D, oleo, ballesta vs FEA y retraccion de 4 barras que cabe**

**Objetivo:** Tabla 11.1 y cargas 11.1–11.4 con el CG del DR-3 (tipback en ROJO con CG vacio 23.8 ft); tipback/overturn/tail-strike medidos del ensamble; stroke sin peso y oleo 1800 psi; ballesta 11.14–11.19 vs FEA; 4 barras con pivote en mediatriz y juez de claros del pozo; claros de armamento en peor postura.

**Capitulos:** [9, 11] · **Depende de:** raymer-esqueleto-dash-one, raymer-pesos-cg-dr3

**Ya existe:**
- src/forja/mech/fourbar.ts (4 barras)
- src/forja/mech/ensamble.ts (ensamble generico)
- src/forja/brep/fea.ts:runFEA (:591)
- src/forja/mold/mold-audit.ts (interferencia, solo molde)

```
## EJERCICIOS
- raymer-c11-01 · Llantas estadisticas (Tabla 11.1) y cargas estaticas/dinamicas del DR-3 · dimensionado-aeronave, ensamble, cotas, revolve · Dim = A W_w^B +-1%; cargas cierran sum = W; con el CG vacio del DR-3 (23.8) sobre el tren la fraccion de nariz cae a 0 -> ROJO tipback
- raymer-c11-02 · Geometria del triciclo (y castor) medida en el ensamble 3D · ensamble, cinematica, medir-angulo, cotas, dimensionado-aeronave · Cada angulo medido por el kernel con el CG del modulo de pesos (adelante y atras) cae en su banda; toda la envolvente de CG pasa
- raymer-c11-03 · Presion de llanta, huella, pista y energia de frenado · dimensionado-aeronave, cotas · P <= tope de la Tabla 11.3 de la superficie; KE con W_landing >= 0.8 W0; W_w = P A_p
- raymer-c11-04 · Carrera del amortiguador y dimensiones del oleo (Ecs 11.8–11.13) · dimensionado-aeronave, revolve, ensamble, cotas · S no depende de W; S(in) ~ V_vert(ft/s) +-25%; D_ext = 1.3 sqrt(4 L/(pi 1800)) exacto; solido de longitud 2.5 S
- raymer-c11-05 · Pata de ballesta: deflexion analitica vs FEA del kernel · croquis, extruir, cotas, FEA-estatico, dimensionado-aeronave · Deflexion FEA vs Euler-Bernoulli +-5%; componente vertical = S; sigma_max FEA = M(t/2)/I +-5%
- raymer-c11-06 · Retraccion del tren como 4 barras y el pozo que cabe · cinematica, multicuerpo, ensamble, interferencia, croquis, medir-distancia · Cero interferencias a lo largo del recorrido con rueda +3%/+4%; claro >= 0.03 w + 1 in; pivote sobre la mediatriz +-0.1 mm
- raymer-c9-03 · Claros de armamento en la peor postura del tren · ensamble, cinematica, interferencia, medir-distancia · Distancia minima del kernel entre cada arma y suelo/helice/otras armas en la postura combinada >= el claro; cono de 10 sin interseccion
```

### `raymer-costos-dapca` · sprint 5 · esfuerzo M · valor 3
**S16 · Costo como medida de merito: DAPCA IV con banda, curva de aprendizaje, dolares constantes y NPV**

**Objetivo:** 18.1–18.9 con fudge parametrizados y salida {lo, nominal, hi} etiquetada; x = 1 + log2(LC) contra los rotulos de la Fig 18.2; F-15/F-16 +63%/+129%; break-even #200 y NPV $100 exactos; photo-scale 120 counts; costo escalonado al estirar envergadura.

**Capitulos:** [18, 19, 23] · **Depende de:** raymer-pesos-cg-dr3, raymer-carpet-mvo-dr3

**Ya existe:**
- src/forja/brep/fea.ts (escalon estructural)

```
## EJERCICIOS
- raymer-c18-01 · Costo de desarrollo y adquisicion del DR-3 en aluminio y en compuestos · costo, dimensionado-aeronave, planeacion · Sin ejemplo resuelto: validar con 500^0.163 = 2.75 ~ 3 (p.695); banda $2,000–5,000/lb de We; compuestos 1.1–1.8x en horas; salida {lo, nominal, hi} 'RDT&E+flyaway, USD 2012'
- raymer-c18-02 · La curva de aprendizaje como exponente de Q · costo, planeacion · x = 1 + log2(LC) a 3 decimales; 500^0.163 = 2.75 en [2.5, 3.5]; LC = 2^(0.641-1) = 78% en [70, 90]%
- raymer-c18-03 · El comparador de costos que no miente por un factor de 2 · costo · +63% y +129% +-3 puntos; comparacion entre agrupaciones -> rechazo con la cita
- raymer-c18-04 · Economia de aerolinea: DOC por asiento-milla, break-even y NPV · costo, planeacion · #200 exacto; NPV $100 exacto; MMH/FH 6.4 -> 12 (+-10%); DOC en 6–8 c/seat-mile como cordura
- raymer-c19-07 · El fuselaje que no encoge: photo-scale y cuadrado-cubo · dimensionado-aeronave, masa-inercia · 0.01206 -> 120 counts +-1; 0.5^1.5 = 0.354 medido por el kernel al escalar un solido; -0.06 NO cableado
- raymer-c23-04 · Estirar la envergadura de un avion existente: el escalon de costo · parametrico, FEA-estatico, costo, dimensionado-aeronave · Curva costo(b) con discontinuidad donde sigma_raiz > admisible (FEA); calibracion registrada (GOB-9); optimizador reporta 'funcion no suave'
```

### `raymer-estabilidad-layout` · sprint 5 · esfuerzo L · valor 4
**S14 · Punto neutro, trim, pull-up, lateral y alabeo desde el layout as-drawn**

**Objetivo:** X_np/SM/Cm_alpha con areas y brazos MEDIDOS (SM(13 ft) - SM(16 ft) = 0.545 exacto); downwash Fig 16.12; K_fus x57.3; trim plot y delta_e en pull-up de 3 g; Cn_beta/Cl_beta con regla -1/2; alabeo MIL-F-8785B; TDR/URVC medidos sobre el 3-vistas.

**Capitulos:** [16] · **Depende de:** raymer-esqueleto-dash-one, raymer-sustentacion-dr3, raymer-pesos-cg-dr3

**Ya existe:**
- src/aero/wing-metrics.ts:macTrapezoidal (cbar)
- docs/forja-research/aero-pliego/raymer-rescate-cap16.md (Figs 16.4–16.26 en tablas)

```
## EJERCICIOS
- raymer-c16-01 · Punto neutro, Cm_alpha y margen estatico del avion de las preguntas del cap 12 · dimensionado-aeronave, estabilidad-estatica, croquis, cotas, plano2D · X_np entre X_ac ala (~12 ft+) y cola (34 ft); SM(a) - SM(b) = 3/cbar = 0.545 exacto; Cm_alpha = -C_La SM a 1e-6; en banda 'Business & GA' de Fig 16.4 (-0.65 a -1.0 /rad); trampa 57.3 en 16.25
- raymer-c16-08 · de/da del avion del cap 12 desde la Fig 16.12 · dimensionado-aeronave, estabilidad-estatica · Tabla +-0.006; de/da baja con A, m, r, sube al bajar lambda; ~mitad del alfa (p.600); fuera de r < 0.5–0.625 bandera
- raymer-c16-02 · Trim plot y deflexion de elevador a 200 kt · dimensionado-aeronave, estabilidad-estatica, perfil-2D · Cm_cg(C_L_trim) = 0 a 1e-4; |delta_e| a 16 ft < a 13 ft; producto de los dos primeros terminos de 16.16 < 1; delta_e dentro de 10–60 o 'extrapolacion sin respaldo'
- raymer-c16-03 · Elevador en pull-up de 3 g a 200 kt · dimensionado-aeronave, estabilidad-estatica, dinamica · delta_e(pull-up) mas nariz-arriba que trim; cierra con 16.57 en estacionario a 1e-6; C_mQ escala con el cuadrado del brazo
- raymer-c16-09 · Estabilidad lateral-direccional estatica: Cn_beta y Cl_beta del layout · dimensionado-aeronave, estabilidad-estatica, croquis, cotas · Cl_beta negativo, |Cl_beta| ~ 0.5 Cn_beta (+-25%); brazos laterales /b, longitudinales /cbar; solo A 1.4–7.3 tiene trazo
- raymer-c16-05 · Velocidad de alabeo estacionaria contra MIL-F-8785B · dimensionado-aeronave, estabilidad-estatica, dinamica, croquis · Fig 16.26 +-0.006; IV B son DOS condiciones AND; errata 16.64 subindice delta_a; aviso 'cuasi-estacionario = optimista'
- raymer-c16-04 · Criterio de recuperacion de barrena TDR·URVC medido sobre el 3-vistas · croquis, plano2D, cotas, dimensionado-aeronave · Areas MEDIDAS por el kernel sobre la proyeccion lateral; normalizacion correcta; veredicto pendiente hasta digitalizar la Fig 16.32; solo alas rectas
```

### `raymer-requisitos-cabina` · sprint 5 · esfuerzo M · valor 3
**S17 · Hoja de requisitos, maniqui 95%, cabina por Tabla 9.1, claro estructural y mass balance**

**Objetivo:** Esquema de requisitos con FAR 23/25 que re-dispara el sizing; punto de ojo y overnose/rasante medidos; cabina generada por clase; OML - claro con interferencia por invasor; CG de superficies moviles delante de la bisagra.

**Capitulos:** [2, 8, 9] · **Depende de:** raymer-esqueleto-dash-one

**Ya existe:**
- src/forja/brep/occt.ts:shellSolid (:965), common (:517), VolumeProperties (:633)
- src/forja/mold/mold-contratos.ts (patron para aero-contratos)

```
## EJERCICIOS
- raymer-c2-01 · Hoja de requisitos del Dash-One · planeacion, dimensionado-aeronave · Esquema validado: campos obligatorios presentes, unidades consistentes (ft-lb-s o m-kg-s), limites FAR aplicados (61 kt) y cada cambio de requisito re-dispara el sizing (invariante de trazabilidad)
- raymer-c9-01 · Cabina de mando: maniqui 95% y angulo de vision sobre la nariz · croquis, extruir, ensamble, cotas, medir-angulo, dimensionado-aeronave · Angulos medidos por el kernel desde el punto de ojo: overnose dentro de banda y >= Ec 9.1; rasante >= 30; esfera de 10 in sin interferencia con el canopy
- raymer-c9-02 · Cabina de pasajeros generada por Tabla 9.1 · croquis, patron, extruir, ensamble, cotas, dimensionado-aeronave · Cotas del solido en la banda de la Tabla 9.1; asientos/pasillo <= 3; bodega medida >= 8.6 ft3*N_pax; longitud = filas*pitch + puertas
- raymer-c8-04 · Claro estructural desde la mold line · shell, ensamble, interferencia · shellSolid(OML, -claro) produce la envolvente; common != vacio reporta invasor con volumen; el tren arriba cabe
- raymer-c8-05 · Flutter y mass balance de superficies de mando · masa-inercia, ensamble, cotas · x_CG(superficie + contrapeso) <= x_bisagra; I_xy respecto a la bisagra = 0 +-1% de I_xx; x_bisagra/cbar <= 0.20; contrapeso minimo
```

### `raymer-electrico-vertical-extremos` · sprint 6 · esfuerzo M · valor 3
**S18 · La misma arquitectura de lazo con otra ecuacion de segmento: BMF, hover, Delta-V y el globo de helio**

**Objetivo:** fraccionDeSegmento inyectable: BMF sumado (sin ln), teoria de momento del S-58 con bandas, ASW a VTOL con Swet medida, cohete para tu peso con Tsiolkovsky, globo con %F = 0.74 y casco de revolucion medido; joined wing A/B.

**Capitulos:** [20, 21, 22, 23] · **Depende de:** raymer-sizing-asw, raymer-desempeno-dr3

**Ya existe:**
- src/aero/atmosfera.ts:atmosferaISA (%F, rho a 5,000 ft)
- src/forja/brep/occt.ts:revolve, volume

```
## EJERCICIOS
- raymer-c20-01 · Sizing electrico: BMF se SUMA y el logaritmo desaparece · dimensionado-aeronave, planeacion · BMF_total = sum; ninguna ecuacion con ln; BMF independiente de W0 => converge en menos iteraciones; ratio alcance ~1/20; OCR 'EMF' por 'BMF'
- raymer-c20-02 · Alcance, loiter y ascenso electricos del avion de helice del cap 17 · dimensionado-aeronave, desempeno · mks obligatorio (V en m/s falla por 3.6); R independiente de V; electrico/gasolina ~ 1/20
- raymer-c21-01 · Sikorsky S-58: potencia en crucero a 128 kt y 5,000 ft · dimensionado-aeronave, desempeno, atmosfera-ISA · Salida como BANDA; P_crucero < potencia por Tabla 21.1 (1,700–2,400 hp); A = 4/pi; el erratum NO se propaga
- raymer-c21-02 · S-58: potencia de hover y velocidad de descenso en autorrotacion · dimensionado-aeronave, desempeno · P_hover como banda por M; ascenso vertical = hover + W V_c/2; V_desc = 2 Vi; dentro de W/P 4–8 lb/hp
- raymer-c21-03 · El ASW del cap 3 convertido a VTOL con motores de sustentacion · dimensionado-aeronave, planeacion, croquis · W0_VTOL > W0_CTOL con factor de crecimiento; la Swet extra se MIDE en el kernel al agregar los bultos; gate del 30%
- raymer-c22-01 · Un cohete para ponerte a ti en orbita: Delta-V y la fraccion de segmento de Tsiolkovsky · dimensionado-aeronave, planeacion, revolve · V_s(200 km) = 25,548 fps; ecuacion del cohete como fraccionDeSegmento inyectada; Delta-V se SUMA; Isp fuera de tabla bandera; divergencia reportada
- raymer-c22-03 · Un globo de helio que te cargue a ti (y el casco de dirigible que lo envuelve) · revolve, masa-inercia, dimensionado-aeronave, atmosfera-ISA · %F = 0.74 +-0.01 y casco 1.35x +-0.02 con la ISA del repo; volumen del casco medido = V_gas/%F; sin Breguet
- raymer-c23-01 · Joined wing en el ASW: -28% de peso alar y +4% de arrastre, conviene? · dimensionado-aeronave, optimizacion, planeacion · Corrida A/B del lazo con We_ala x0.72 y CD0 x1.04; signo y magnitud de dW0 con banda; cada variante con su carpet o 'no creible'
```

### `raymer-escuela-a10` · sprint 6 · esfuerzo L · valor 4
**S19 · Escuela a10-*: sizing a mano -> restricciones -> tubo+cono -> lazo del DR-1 -> matriz -> densidad -> V-n (videos 4K con voz)**

**Objetivo:** Lecciones a10-l1..l8 en forja-brep.html con clase-drive.cjs: cada una reproduce un fixture impreso en pantalla con oraculo por paso; optimizador bloqueado hasta la leccion del carpet (mandato §24.1); rubrica 'redibujar el as-optimized'.

**Capitulos:** [3, 5, 7, 14, 17, 19] · **Depende de:** raymer-sizing-asw, raymer-area-mojada-kernel, raymer-restricciones-tw-ws, raymer-carpet-mvo-dr3, raymer-cargas-estructura

**Ya existe:**
- public/escuela/lecciones/a1-l1.json, a1-l4.json (Anderson: presion/cortante, ISA) — HECHAS, no se duplican
- scripts/escuela/clase-drive.cjs + parrilla.sh (runner de video)
- docs/forja-research/aero/CURRICULUM-AERO.md U10 (plan, sin lecciones)

```
## EJERCICIOS
- raymer-c3-01 · Sizing del ASW: W0 por punto fijo · dimensionado-aeronave, mision-por-segmentos · W0 convergido = 56,702 lb +-0.1% y We/W0 = 0.4322, W_fuel = 21,393 lb; cada fila de la tabla de Box 3.1 reproducida +-1 lb; el metodo grafico (Fig 3.11) da el mismo W0
- raymer-c5-09 · Diagrama de restricciones T/W–W/S con dueno por tramo y recheck · dimensionado-aeronave, diagrama-restricciones, trade-study · Todas las curvas en condiciones de despegue (cambiar peso de combate 0.85->1.0 mueve solo viraje); el punto elegido satisface toda restriccion no vetada; tras recheck |delta(T/W)| < 1%; un W/S 40% por debajo del resto dispara alerta §5.3.1
- raymer-c7-09 · EL TEST DE ACEPTACION del CAD: tubo + cono + ala simple a mano · croquis, extruir, revolve, booleanas, surfaceArea, volume · S_wet a mano (valor cerrado) vs CAD < 0.5% y volumen < 0.1%; sumar el ala sin restar la raiz da +8% y el test lo cacha; la cara de entrada de la toma NO se cuenta
- raymer-c19-04 · El lazo que se muerde la cola: 15 iteraciones del DR-1 (rubber) y 3 (motor fijo) · dimensionado-aeronave, planeacion · 18 filas +-0.1 lb; relajacion 0.8 verificada en 3 corridas; gates: fraccion > 1.0 error, < 0.9 partir, |dW0| > 30% redraw
- raymer-c19-01 · La matriz 3x3 del caza pequeno: de nueve aviones al optimo · dimensionado-aeronave, optimizacion, planeacion · Diagnostico: 5 viola solo s_TO; 3 unico factible; 4,7,8,9 infactibles; optimo en cruce, no en celda; gate CP-1; matriz y carpet = 'same results!'
- raymer-c17-05 · Motor apagado a 10,000 ft: cuanto planeas y cuanto te sostienes · dimensionado-aeronave, desempeno, atmosfera-ISA · Distancia = h (L/D)_max ~ 123,000 ft ~ 20 nmi; tiempo = int dh/V_sink con rho(h); V_min_sink = 0.76 V_bestglide
- raymer-c14-01 · Diagrama V-n de maniobra y rafaga -> Nz ultimo del DR-3 · dimensionado-aeronave, croquis · Nz = 1.5 x 7.33 = 11.0 exacto y la UI rotula 'ultimo = 1.5 x limite'; n_rafaga GA 2–3 g; el V-n usa Ve; avion mas ligero => dn mayor
- raymer-c19-08 · El gate anti-fraude: densidad interna W0/V_interno medida por el kernel · ensamble, masa-inercia, dimensionado-aeronave, optimizacion · V_interno del kernel por variante; rho_var/rho_base fuera de 1+-0.05 -> 'no creible'; el gate corre sin humano
```

Ejercicios sin superticket (valor <= 2, se toman al final): raymer-c5-01, raymer-c10-02, raymer-c10-07, raymer-c13-03, raymer-c22-02, raymer-c23-02

## 5. Brechas vs Fusion / competencia

| Prioridad | Brecha | Que dice el libro | Que hace la competencia |
|---|---|---|---|
| P0 | Sizing conceptual acoplado a la geometria (W0, T/W–W/S, carpet, MVO) dentro del CAD | 'Sizing is the most important calculation in aircraft design' (§3); 'you never build the Dash-One' (§2.3); 'Sizing is the heart of aircraft optimization' (§19); el CAD debe regenerar al cambiar A (§7.11.8). | Fusion/SolidWorks: nada. RDS-Professional (del autor), AAA (DARcorp), PIANO y OpenVSP+Aviary/OpenMDAO lo hacen FUERA del CAD, en escritorio; nadie en navegador ligado al B-Rep. Es el hueco que competencia-mercado.md F marca como nuestro. |
| P0 | Medicion de S_ref/S_exp/S_wet y distribucion de area A(x) desde el solido, con reglas de resta | §7.9–7.11: 'tube-plus-cone... compared with the answer from the CAD system'; §12.3 S_ref hasta la linea central; §8.2.2 volume distribution plot. | OpenVSP CompGeom/Wave Drag hace exactamente esto gratis (NASA). Fusion/SolidWorks dan area/volumen de un cuerpo pero no distinguen las tres areas ni restan uniones. La Forja tiene volume/surfaceArea/skin.ts pero no el corte por estaciones ni el bench. |
| P0 | Build-up de arrastre parasito por componente (Cf, FF, Q, onda) y polar con K(CL) | Cap 12: Ec 12.24 por componente sobre S_wet medida; 12.45 onda con A_max neta; 12.56–12.58 K por succion; 'as-drawn' vs estadistico. | OpenVSP 'Parasite Drag' (Cf/FF/Q por componente desde la geometria) y VSPAERO (VLM); XFLR5 (muerto 2026-06) hacia LLT/VLM; RDS es la referencia. Fusion/SolidWorks no lo tienen. |
| P0 | Pesos estadisticos (59 ecuaciones) + CG por grupo + envolvente de CG por mision | Cap 15: Nz ULTIMO, clamps, fudge calibrado, GWS MIL-STD-1374, combustible como cierre; Fig 15.1 envolvente. | RDS y AAA implementan las mismas ecuaciones; OpenVSP Mass Properties es geometrico; Fusion/SolidWorks dan masa del ensamble con materiales pero no correlaciones ni envolvente de mision. |
| P0 | Desempeno completo (despegue por segmentos, Ps, envolvente) sobre tabla T(h,M) | Cap 17: 'These simple equations are the basis of the most detailed sizing and performance programs'; seis definiciones de distancia de despegue. | RDS/AAA/PIANO tienen desempeno completo; ningun CAD lo integra con el layout; Ansys no. |
| P1 | Pandeo lineal (Euler/placas) y modal en el kernel FEA | §14.9.2–14.9.3: columna, crippling, placa como 'ballpark' que vigila al FEM. | Fusion Simulation y SolidWorks Simulation tienen pandeo lineal y modal nativos; La Forja solo von Mises estatico (fea.ts) y warpage de molde. |
| P1 | Primitiva conica (rho/p) en el sketcher, loft con guias, analisis de curvatura/zebra, superficie desarrollable | §7.3–7.5: conica con p; flat-wrap != ruled (X-31 $400k); buttock-plane cuts; §8.2.1 continuidad G2. | Fusion y SolidWorks tienen conic en sketch (rho), loft con guias, curvature comb y zebra; SolidWorks 'ruled surface'. Ninguno ofrece el criterio de Raymer como test automatico. sketch-solver.ts: grep conic -> 0. |
| P1 | Cinematica de tren de aterrizaje con interferencia de pozo y jueces de tipback/overturn | Cap 11: 'Landing gear will ruin your layout more than anything else'; 4 barras con pivote en mediatriz; claros 3–5% + 1–2 in. | Fusion/SolidWorks: joints + interference detection del mecanismo (sin dimensionar llanta/stroke ni juzgar angulos); RDS/AAA por tablas. La Forja tiene fourbar.ts y ensamble.ts pero sin pozo/llanta/jueces. |
| P1 | Derivadas de estabilidad desde el layout (X_np, SM, Cn_beta, Cl_p) | Cap 16: X_np del layout as-drawn; coeficiente de volumen de cola es PISO; regla Cl_beta ~ -Cn_beta/2. | XFLR5/AVL calculan derivadas por VLM; RDS usa DATCOM como Raymer. Ninguno lee areas/brazos del solido del CAD. |
| P2 | Maniqui ergonomico posable y generador de cabina de pasajeros | §9.1–9.2: piloto 95%, angulo sobre la nariz Ec 9.1, Tabla 9.1. | CATIA Human Builder, SolidWorks (via plugins), OpenVSP 'Human' component basico; La Forja: nada. |
| P1 | Costos de programa (DAPCA, learning curve, LCC/NPV) como medida de merito del optimizador | §18: 'Cost is the final measure of merit'; §19.7 costo como measure of merit; nunca comparar agrupaciones distintas. | RDS incluye DAPCA; aPriori/Fusion Manufacturing cotizan piezas, no programas de avion. |
| P1 | Contratos por solver (dominio, banderas EXTRAPOLADO, decisiones humanas con autor) — requisito de comportamiento | §1.4 'good enough to check the results of sophisticated computerized methods'; §13.3.1 contabilidad; §15.4 fudge con registro; CRUCE §9 puntos 1–6. | Nadie lo hace explicito; RDS embebe curvas sin declarar rango. Es el diferenciador declarado y ya existe el patron en src/forja/mold/mold-contratos.ts. |

## 6. Tramos faltantes, gotchas y notas

- **Cap 24 (DR-1/DR-3)** no se leyo como capitulo pero es la FUENTE de todo fixture numerico (RDS): AC-SIZE 15+3 filas, traza de 14 tramos, DR3.DAA (151.131 / 225.126 counts), DR3.DPR (inlet loss), GWS 10,947.2 lb, despegue 723.6 ft, Ps n=1..5, carpet 25 variantes, MVO 15,242 lb. El DR-1 es manuscrito escaneado ilegible en el OCR.
- **Raymer no trae problemas resueltos** (§1.4 lo declara); las preguntas de p.999–1008 NO estan renumeradas para la 6a ed. ('Chapter 20' = vuelo vertical, 'Chapter 21' = extremos, 'Chapter 22' = unicos). Por eso el 40% de las respuestas impresas son la corrida del DR-3 y el resto son rangos/reglas.
- **OCR:** cuerpos de ecuacion perdidos en 5.5, 5.8–5.10, 5.13–5.26, 6.2–6.21, 7.10, 7.13–7.14, 12.27 (NO impresa en la 6a), 13.9, 14.6, 15.4/15.6 (no cierran con el DR-3: 1748 vs 1574; 180 vs 171.1), 18.8, 18.10–18.13. Toda implementacion se coteja contra el PDF renderizado ANTES de volverse test (regla del corpus). Erratas impresas: Tabla 15.1 momento total omite payload (22.0 vs 23.11 ft); '{4218 kg}' junto a 19,300 lb; S-58 '{847 kg}'; Tabla 12.5 compuesto 0.7e-5 -> 0.17e-5; Ec 16.64 subindice; Ec 17.49 signo.
- **Figuras a digitalizar (pixel a pixel, metodo aero-pliego/figuras-digitalizadas.md):** 3.1, 3.5, 3.6, 4.21, 5.4, 5.5, 7.10, 7.24, 9.1/9.2, 10.17, 10.19, 12.7, 12.9–12.17, 13.11–13.13, 14.29/14.30/14.39, 15.3, 16.32, 17.14–17.16. Ya digitalizadas: 12.22/12.24–12.26/12.29–12.31/12.36/12.39, 16.4–16.26, 17.6/17.9/17.11/17.13, 18.2, 19.1 (tipografiada).
- **Unidades:** libro en fps con {mks} entre llaves; Tabla 5.5 kg/m2 x9.807; Tabla 5.4 W/g /9.807; L_m/L_n del cap 15 en PULGADAS; Nz es ULTIMO; ecs 20.x en mks (3.6); Ec 16.25 por grado (x57.3).
- **Discrepancias del DR-3 que NO son gate:** filas Misc D/q del build-up, angulo de ascenso 44.97, radio 3426 ft, V_TD 1.2 vs 1.15, requisito M0.9->1.4 en 30 s que el DR-3 NO cumple (42.2 s): un test al que le salga 'todo cumple' esta mal.
- **Estado del repo (verificado 2026-08-27/28 por ls/grep):** src/aero = atmosfera, cuna-anderson, panel2d, potencial, skin, wing-metrics (+ tests); src/forja/sim/viento.ts = cuna de Anderson; NO existe sizing/T/W/arrastre/pesos/tren/V-n/estabilidad/desempeno/costos; escuela aero = a1-l1, a1-l4 solamente; scripts/forja-gate.cjs sin bench tubo+cono.
- **Decision de arquitectura que sale del libro:** un solo `src/aero/sizing.ts` con `fraccionDeSegmento` inyectable (historica / Breguet / endurance / Tsiolkovsky / BMF) sirve a los caps 3, 6, 19, 20, 21, 22 y 23 — no hacer cinco lazos.
