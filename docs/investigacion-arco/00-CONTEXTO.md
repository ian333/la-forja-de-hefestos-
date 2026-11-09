# INVESTIGACIÓN DEL ARCO: contexto común para los 10 agentes (2026-11-05)

> ian, 2026-11-05: «QUIERO QUE LANCES AGENTES QUE REDUZCAN EL NÚMERO DE COMPONENTES, Y AUMENTEN EL CONTROL. ME GUSTARÍA HACER IMPRESIÓN 3D SEGURA, con el mismo material, sin gas, pero control absoluto de la soldadura. ¿Qué tal si incluso los gases salen ionizados y creamos nuestra propia atmósfera con campos? […] la idea del bombeo me gusta, siento que hay algo más ahí: crear resonancia de campos para concentrar el punto de energía en la punta; automatizar que detecte el contacto, la distancia y la temperatura. ¿Qué pasa si llevamos al extremo el control de ondas: no 1 sino 2, 3, 4, 5 o millones de ondas?» Y después: «lanzaría hasta 10 agentes en investigación, ver las posibilidades desde el Operador Ian».

Este archivo lo leen todos los agentes antes de empezar. Cada uno investiga UNA pregunta y entrega su reporte con números.

## 1. El hardware REAL (lo que ian tiene en la mesa)

- **Fuente:** Mean Well LRS-1200-48, 48 V, 25 A, 1200 W. La única de amperaje fuerte que tiene; no se cambia.
- **MOSFETs:** ya comprados, número de parte SIN confirmar. Los cálculos suponen IRFB4227 (200 V, 65 A, 22 mΩ).
- **Control:** Raspberry Pi Pico 2 (RP2350). ADC de 12 bits a ~500 kS/s, PIO, PWM.
- **Alimentador de alambre:** SACADO de una Truper SOMI-130X. Trae:
  - el motor DC (voltaje SIN medir; se supone 12–24 V);
  - el rodillo moleteado, el brazo de presión con balero, la perilla de tensión y la guía de entrada;
  - una base para fijarlo, que ian atornillará con M8;
  - según ian, «ya trae la punta»: la antorcha (con su punta de contacto) sale del mismo alimentador.

  El alimentador ES la boquilla del primer banco. La soldadora en sí ya no se usa.
- **Alambre:** Truper MICRO-1 (13750), E71T-GS de 0.8 mm, tubular con fundente, SIN gas, carrete de 1 kg (D100). Polaridad esperada DCEN, sin verificar. La caja dice «soporta corto circuito, globular, pulsada y axial».
- **Mesa:** loseta cerámica con una placa de acero de prueba de 100×50×3 mm.

## 2. El circuito «La Pluma» (diseñado y simulado, sin armar)

- **Etapa de potencia:** buck LADO ALTO desde 48 V.
  - Q1 IRFB4227 manejado por IR2110 (HO, bootstrap con 4.7 Ω + zener de 15 V).
  - D1 MBR40100CT como diodo libre.
  - Choque de 41 µH con núcleo de aire, cal 10 (diseño: ~40 vueltas en Ø60 × 112 mm).
  - Sensor Hall ACS758.
  - Lazo PI de corriente a 20 kHz; la meta es 100 kHz.
  - Tope de duty: 0.22 en contacto, 0.75 en arco.
  - OCV regulada, detección del cuello (R sube 8 mΩ sobre su mínimo) y Q3 como crowbar.
  - Snubber de 3.3 Ω / 10 nF, TVS, Rg_off de 33 Ω.
- **Simulaciones:** ngspice en `scripts/la-pluma/` (léase su `README.md`). El ngspice local corre con `/tmp/claude-1000/-home-ian-neuron-asm-RIAN/cfc903cc-a179-4f90-826c-2fc0f81542b2/scratchpad/ngspice.sh`.
- **Límite de pendiente:** di/dt ≈ (48 − V_arco)/L ≈ 34 V / 41 µH ≈ 0.8 A/µs. Un salto de 30 A toma ~37 µs.

## 3. Los números de la física (el canon, `scripts/canon/`)

- **Material:** σ = 1.5 N/m, ρ = 7000 kg/m³, µ = 6×10⁻³ Pa·s, r_alambre = 0.4 mm.
- **Pellizco:** µ0·I²/4π contra la tensión 2π·r_w·σ = 3.77 mN, lo que da **I_crit = 194 A**.
- **La gota como campana** (modo l=2 de Rayleigh): q'' + (ω/Q)q' + ω²q = ω²·empuje.
  - ω² = 8σ/(ρa³), y **f₂ = 668 Hz a a = 0.46 mm**.
  - Se suelta cuando q ≥ 1.
  - Se SUPUSO Q = 30; sin medir.
  - Modos superiores: ω_l² = l(l−1)(l+2)·σ/(ρa³), así que f₃/f₂ = 1.94 y f₄/f₂ = 3.0.
- **El arco:** V = 14 V + 10 V/mm · largo (medido por ian). Voltaje mínimo de arco en Fe ≈ 13 V; voltaje de fusión de Holm 0.54 V.
- **Resultados del modelo** (en TS: `src/forja/brep/arcoFisica.ts`; prueba: `node --import tsx scripts/arco-fisica-prueba.cjs`):
  - Campanazo (40 A base + 30 A a f₂, Q = 30, alambre a 3 m/min): 75 gotas/s de 0.4526 mm, se suelta en 6 ciclos, 0 cortos. El disparo se ADELANTA porque la gota crece mientras suena; sin eso sale de 0.53 mm.
  - Arco CC a 60 A: gotas de 1.63 mm, globulares, todas en corto.
- **Canales de la gota desde el operador** (`scripts/canon/canales_gota.py`, `apuntar2.py`):
  - **Los modos son canales:** l=0 volumen (DC), l=1 apuntar (B transversal × I a ω1), l=2 soltar (corriente a ω2).
  - **FALSADO:** bombeo paramétrico a 2ω, sin retroalimentación. Solo funciona con β = 2, con una lengua de ±1 %, y tarda 20–34 ciclos contra 5–7 del forzado directo. Además, ω + 2ω funciona peor que un solo tono.
  - **HALLAZGO:** la corriente base afloja la gota (f baja ~2 % con β = 1 a 40 A).
  - **Apuntar:** una patada de 3 ciclos con 3 mT da ~80–90 µm de error a 0.5 mm. NO se modeló el arc blow.
- **Revisión del operador del 31 de octubre** (`scripts/operador-revision-impresora-2026-10-31.py` + `.out`):
  - ley de Lagrange I ∝ √v_f;
  - balance volt-segundo como sensor, con ~1 mΩ de ruido por periodo;
  - la pieza limita la velocidad.

## 4. El marco «Operador Ian» (leer antes de proponer)

- Memorias del proyecto, que se pueden leer:
  - `/home/ian/.claude/projects/-home-ian-neuron-asm-RIAN/memory/project_operador_ian.md`
  - `/home/ian/.claude/projects/-home-ian-neuron-asm-RIAN/memory/project_impresora_metal_operador.md`
  - `/home/ian/.claude/projects/-home-ian-neuron-asm-RIAN/memory/project_channel_postulate.md`
  - `/home/ian/.claude/projects/-home-ian-neuron-asm-RIAN/memory/project_i_equals_operator_arrow_of_time.md`
- **Lo esencial:**
  - 𝔄 = rotar π/2 (i). El estado de un oscilador es z = q + i·q'/ω, que gira.
  - Empujar en cuadratura (en fase con la velocidad) es lo que bombea energía.
  - **POSTULADO DE CANAL:** cada modo necesita un canal selectivo propio, o se diluye.
  - El actuador I² MEZCLA canales: una corriente con tonos a y b da fuerza en 0, 2a, 2b y a ± b.
  - Tres estados ontológicos y «acuerdo o silencio»: solo vale lo que la evidencia sostiene.
- **Úsalo como LENTE para encontrar posibilidades**, no como sustituto de la física. Cada afirmación tiene que poder comprobarse con física estándar y números. Si el marco sugiere algo que la física no sostiene, se dice.

## 5. Reglas para todos los agentes

1. **Solo CREAS tus archivos asignados.** Son tres: `docs/investigacion-arco/NN-<slug>.md`, más el opcional `scripts/investigacion-arco/NN_<slug>.py` y su salida `.out`. NO modificas ningún otro archivo. NO usas git. NO corres vite, tsc ni npm en la laptop (la RAM está limitada).
2. **Python:** numpy 2.2 y scipy 1.15 corren en la laptop. Lo pesado va a iangpu: `ssh ian@100.65.173.85`, 16 núcleos, numpy 2.4, scipy 1.17. Tu script tiene que reproducir TODOS los números de tu reporte, y su salida va en el `.out`.
3. **Web:** puedes buscar literatura. Cita cada fuente con su URL. Si un dato es de memoria y no lo verificaste, dilo.
4. **Telemetría cruda:** tablas con los números reales, no solo conclusiones. Separa lo PROBADO (con cálculo o fuente) de lo ESPECULATIVO.
5. **Cada hipótesis cierra con veredicto PASA / FALSA / INCIERTO**, más qué medición la decidiría.
6. **Español claro y directo.** ian construye; no le hables como a un comité.

## 6. Estructura del reporte (`docs/investigacion-arco/NN-<slug>.md`)

1. La pregunta, en una línea.
2. La respuesta corta: 3–6 viñetas con los números que importan.
3. El método: modelos, supuestos y fuentes.
4. Resultados con telemetría (tablas).
5. Veredictos por hipótesis.
6. Qué cambia en el banco, el circuito, el firmware o la lista de componentes. Concreto: «quita X», «agrega Y», «el firmware hace Z».
7. **El experimento más barato que lo decide**, con números predichos (qué se espera ver si es cierto y qué si es falso).
8. Fuentes.
