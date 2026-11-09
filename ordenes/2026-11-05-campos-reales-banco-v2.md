# ORDEN G: campos REALES con la gramática del rey + banco v2 (sin la SOMI)

ESTADO: hoy. ian presente.

> «quiero ver los campos reales, no una representación de ellos… el motor ya existe en la forja… SON VIEJOS, MEJÓRALOS Y OPTIMÍZALOS, pero primero velos visualmente… si no ves las referencias de reyes y animación de la forja no lo estás haciendo bien… quita la soldadora de truper, ya le saqué el alimentador… lo usaremos como boquilla… yo usaría unos M8 para fijarlo… hazme una base mínima para meter todo el circuito y no tener un desmadre de cablerío… todo debe ser liviano, funcionar liviano, verse ultrarrealista»

Plan hablado con ian antes de programar; respondió «dale recio».

BASE: d675896

OBJETIVO:
1. **Motor de campos v2** (`src/lib/physics/em.ts` mejorado y optimizado). Biot-Savart de segmento finito sobre arreglos tipados, sin apartar memoria por llamada. Traza líneas de B (hoy solo hay de E) con el |B| real en cada vértice. Corre en un worker. Mantiene la API vieja para `Fields.tsx`.
2. **Visualizador v2 con la gramática del rey** (`docs/CANON-VIDEO.md` §LAS LEYES DEL REY, `docs/QUE-EXCITA-EL-OJO.md`):
   - cientos de filamentos finos de B calculados de la geometría REAL del lazo de corriente;
   - color y brillo por |B| real; como B ∝ I, el campo se traza una vez y respira con I(t) en el shader;
   - flujo en el sentido de B;
   - mundo azul = campo B, mundo magenta = E y plasma, oro = el metal;
   - núcleo → halo → filamentos.

   El detalle de la punta usa las líneas de E reales (las cargas simuladas que ya existen) y una nube de plasma de partículas.
3. **Banco v2:** sin la soldadora. El alimentador (con su punta) se atornilla con 4 M8 a una base mínima que lleva dentro la fuente, La Pluma y barras de cobre cortas. La placa trae su contacto integrado y el único cable de fuera es el de la antorcha.

## YA-EXISTE (prueba de ausencia)

- **`src/lib/physics/em.ts`:**
  - `fieldE`, `potentialV`, `fieldBFromSegment` (forma cerrada, Griffiths 5.36), `fieldB`, `traceFieldLine` (solo de E) y `lorentzStep`;
  - aparta arreglos en cada llamada y no tiene pruebas;
  - lo usa `src/physics/modules/em/Fields.tsx`.
- **Visualizadores viejos** vistos con GPU en el sitio el 2026-11-05: «el latigazo» (flechas sueltas), el dipolo 2D, la gota resonante y el microscopio.
- **La técnica del rey** (`src/cinematic/CinematicMolecule.tsx`): `WaterFieldLines` (flujo `fract(u·3 − t·0.5)`, aditivo), las líneas que se apagan en sus extremos y los puntos que corren encima. Se copia la técnica, no el componente.
- **La escena del banco** (`src/forja/brep/ArcoVivo.tsx`, orden E): anillos dibujados por nivel. Se reemplazan por el campo calculado.

## TOCA

- src/lib/physics/em.ts
- src/forja/brep/ForgeBRepStudio.tsx

## CREA

- src/forja/brep/ArcoVivo.tsx
- src/forja/brep/arcoFisica.ts
- src/forja/brep/CampoReal.tsx
- src/lib/physics/campoB.worker.ts
- src/lib/physics/__tests__/em.test.ts

## BORRA

- (nada)

## PREEXISTENTE

- public/comando/
- public/precomputed/
- public/modelos/banco-arco/
- public/temis-deploy.json
- public/temis.json
- videos/
- scripts/guiones/
- scripts/canon/
- scripts/la-pluma/
- scripts/investigacion-arco/
- docs/investigacion-arco/
- models/step/banco-arco/
- docs/PLAN-MVP-LA-PLUMA.md
- scripts/forja-multicuerpo-diag.cjs
- scripts/precompute-banco-arco.cjs
- scripts/arco-fisica-prueba.cjs
- scripts/captions-pendientes.py
- scripts/estado-yt.py
- scripts/operador-revision-impresora-2026-10-31.out
- scripts/operador-revision-impresora-2026-10-31.py
- scripts/playlist-tutoriales.py
- scripts/precompute-caroteno-gemelos.py
- scripts/reemplazar-yt.py
- scripts/repaso-globos.sh
- scripts/reprogramar-yt.py
- scripts/yt-pendientes.sh

## EVIDENCIA (se declara ANTES de trabajar)

- **Pruebas del motor** (`vitest` en iangpu):
  - alambre infinito, B = µ0·I/2πr, error < 0.1 %;
  - espira circular en el centro, µ0·I/2R;
  - circulación de Ampère alrededor de un conductor ≈ µ0·I;
  - la ruta rápida y la vieja dan el mismo B, error < 1e-12;
  - medición de la aceleración, en evaluaciones/s antes y después.
- **Costo:** líneas trazadas, tiempo en el worker, triángulos/vértices y FPS medidos con GPU en iangpu.
- **Capturas con GPU real** (copia aislada y luego producción):
  - el banco v2 completo;
  - el campo B del lazo;
  - el detalle con E, plasma y gota.

  `scripts/detector-gancho.py` corre sobre los cuadros con números, contra el portero de `docs/QUE-EXCITA-EL-OJO.md` §6.
- `tsc --noEmit` sin errores nuevos.
- `node scripts/orden-gate.cjs --orden ordenes/2026-11-05-campos-reales-banco-v2.md` en VERDE.
- Censo sin lienzos nuevos.
- Despliegue y `curl --compressed` del bundle publicado.

## CIERRE (se llena al terminar)

- **orden vs entregado:**
  - **Hecho:**
    - el motor v2 en `em.ts`, con la API vieja intacta (`Fields.tsx` ahora usa el núcleo rápido sin cambios);
    - el trazado de líneas de B con su |B| real, en un worker;
    - `CampoReal.tsx`, el visualizador con la técnica del rey;
    - el banco y el DETALLE A con campos calculados (los anillos dibujados a mano se fueron);
    - el banco v2 sin la SOMI.
  - **Además**, cazados al ver las capturas:
    1. **La cámara del CAD** tenía near fijo de 0.01 mm. A 1.9 m el buffer de profundidad solo separaba ~21 mm, así que piezas de abajo se colaban a rayas. `PlanoCercanoDinamico` pone near = d/2000 y beneficia a todo el CAD.
    2. **El filamento impreso** ahora es mate.
    3. **Caras coplanares** de la loseta y del ribete separadas.
  - **NO hecho:** reemplazar los visualizadores viejos del laboratorio de física. Espera la decisión de ian.
- **números:**
  - **Pruebas del motor:** 7/7 pasan (`vitest` en iangpu):
    - alambre infinito < 1e-3;
    - mm contra m < 1e-9;
    - espira < 1e-4;
    - Ampère < 1e-3;
    - la API vieja igual a la nueva < 1e-12;
    - la línea alrededor del cable se cierra con error < 0.5 %.
  - **Velocidad:** viejo 66 k puntos/s → nuevo 218 k, ×3.3 (26.2 M segmento·punto/s).
  - **Banco v2:**
    - 105 piezas, 278 503 triángulos;
    - 339 líneas de B (47 cerradas), 205 166 vértices, 2.3–3.8 s en el worker;
    - 60 fps con iangpu libre; 35–46 fps con los agentes corriendo ahí.
  - **Portero del DETALLE A, 4 de 8:** luz 20.7 % ✗ · quemado 2.4 % ✓ · saturación 0.33 ✗ · lowfreq 0.88 ✗ · azul 15.4 % ✓ · magenta 21.2 % ✓ · oro 5.6 % ✗ · movimiento 0.015 ✓.
  - **Portero del visor completo:** pasan la luz y el azul (42 %). La saturación y la baja frecuencia reprueban: es una escena de CAD, no un cuadro de reel.
- **evidencia:**
  - **Capturas con GPU real:** iangpu `/home/ian/forja-diag/vivo-cap/` (copia aislada) y `vivo-prod/` (producción).
  - **Medición del portero:** `scratchpad/portero_cuadros.py`, con la misma `lowfreq_dom` que `detector-gancho.py`.
  - **Tipos:** `tsc` da 58 errores, todos anteriores; ninguno nuevo.
  - **Juez:** `orden-gate` en VERDE (128 cambios; canvas 8→8).
  - **Despliegue:** DEPLOY OK (25/25).
  - **Bundle publicado:** `/assets/forja-brep-CHju5bcG.js` trae «BANCO DEL ARCO v2», «campo B CALCULADO» y «Soporte del alimentador»; `campoB.worker-CResbPLL.js` responde 200 con 2.7 kB.
  - **Consola de producción** sin errores.
- **preguntas abiertas:**
  - **Del alimentador falta medir:** la foto, la placa, los barrenos M8 y el voltaje del motor. Hoy está aproximado de las fotos de la SOMI.
  - **La LRS-1200 solo acepta 180–305 V de alterna** (agente 10): se necesita un contacto de 220 V.
  - **Correcciones al canon que piden los agentes 02 y 04:**
    - 40 A funden ~1.8 m/min, no 3: ~24 gotas/s y no 75;
    - la pendiente E (10 V/mm de ian contra 1.1 V/mm de la literatura) se decide con «la quema».
  - **Los visualizadores viejos** del laboratorio de física siguen pendientes.
  - **El portero de saturación y baja frecuencia** en el detalle: falta más oro (gota y cordón) y más textura fina.
