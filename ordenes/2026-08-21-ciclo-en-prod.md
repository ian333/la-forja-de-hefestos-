# ORDEN: EL CICLO SE ANIMA EN PROD (sin script, sin consola)

BASE: 2d564e8

OBJETIVO: caza de ian — "en prod no hay manera de animar esto". Es CIERTO y el
código lo confirma: el `▶` (`mold-open-toggle`) solo ABRE y EXPULSA; el
LLENADO vive únicamente en `window.__forgeBrep.llenadoT(u)`, o sea que el
ciclo completo (llenar → abrir → expulsar) SOLO existe si un script lo maneja
desde afuera. El video que entregamos lo prueba… y prueba justo el problema:
la máquina trabajando es una capacidad del ARNÉS, no del producto.

Esta orden lo vuelve producto: un PLAY del ciclo COMPLETO en la UI, con la
MISMA línea de tiempo que el video (llenar 0–55 % · abrir 62–82 % ·
expulsar 84–100 %), reusando `tFill` + `moldOpenRef` — sin Canvas nuevo,
sin pantalla nueva, sin archivo nuevo.

## LO QUE SE CONSTRUYE
1. `fillAt(u)` en `useMoldStudio.ts`: el mapeo por CUANTIL (u = fracción de
   volumen → umbral del frente) que hoy vive DUPLICABLE dentro de
   `llenadoT` en el studio. UNA fuente de verdad: `llenadoT` pasa a
   delegarle, así el arnés de video y el botón animan EXACTAMENTE lo mismo.
2. `cicloPlaying` / `cicloProg` / `cicloActo` + `cicloPlayToggle` en
   `useMoldStudio.ts`: lazo rAF en tiempo real (12 s por ciclo, en bucle)
   que maneja `tFill` y `moldOpenRef.current.manual/manualE`. Al parar,
   SUELTA el control manual (`manual = null`) para no dejar el molde
   secuestrado.
3. Botón grande `btn-ciclo-play` + barra de progreso + rótulo del ACTO en el
   panel del ciclo (`MoldPanels.tsx`). Visible en cuanto hay campo de
   llenado (E5 en adelante).
4. **VERIFICACIÓN** (`PLAY=1` en `scripts/llenado-video.cjs`, sin archivo
   nuevo): abre la página, encadena hasta el ciclo, CLICKEA el botón y
   MIDE contra el reloj de pared —sin manejar nada— que:
   · el llenado avanza solo (0 → 100 %, monótono)
   · `animZ(cavidad)` llega a la carrera 100 mm
   · `animZ(pin)` llega a 48 mm y la pieza viaja con él
   · al PARAR, el molde queda LIBRE (manual soltado)
   · CONTROL NEGATIVO: sin click, nada se mueve (si se mueve solo, el juez
     estaría midiendo el ▶ viejo o un residuo del arnés)

## TOCA
- src/forja/brep/useMoldStudio.ts
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/MoldPanels.tsx
- scripts/llenado-video.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- docs/CANON-VIDEO.md
- docs/QUE-HACER-CON-LA-ATENCION.md
- docs/forja-research/datasheets-fuente-corriente/
- docs/la-fuente-esquematico.pdf
- docs/la-fuente-esquematico.tex
- meli-cortador-carburo.json
- public/2DN1.pdb
- scripts/precompute-hemoglobin.py
- scripts/precompute-heme-approach.py
- scripts/salud-canarios.cjs
- scripts/salud.sh
- scripts/traer.sh
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/comando-scan.cjs
- scripts/render-clip.cjs
- scripts/narracion-gen.py
- scripts/reels-web.py
- scripts/video.sh
- scripts/guiones/
- scripts/video-subs.py
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- scripts/assemble-narracion.py
- videos/
- src/cinematic/
- src/comando/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- `PLAY=1` VERDE con su control negativo · los 181 del ciclo del dado siguen
  verdes · orden-gate VERDE · DEPLOY a prod y comprobado EN VIVO (no en
  localhost): el botón existe en university.gaiaprime.com.mx y anima.

---

## CIERRE (lo que de verdad pasó)

**El hueco era real y el código lo confirmó**: el `▶` (`mold-open-toggle`) solo
abría y expulsaba; `llenadoT` existía únicamente en `window.__forgeBrep`. La
máquina trabajando era una capacidad del ARNÉS DE VIDEO, no del producto.

**Ahora es producto.** `btn-ciclo-play` en el panel del ciclo, con barra de
progreso y rótulo del acto. `PLAY=1` en el arnés lo juzga **7/7**, incluido el
control negativo (sin pulsar, la escena está quieta: nadie está animando por
detrás).

**LO QUE CAMBIÓ RESPECTO A LO DECLARADO** (y por qué): la orden decía "la MISMA
línea de tiempo que el video". La primera versión lo cumplía al pie de la
letra… y estaba mal: terminaba con la pieza expulsada y **saltaba** a
molde-cerrado-vacío en un frame. Eso no es un ciclo, es una rampa que se
rebobina — y este proyecto entero se para sobre que **el molde no es un
pipeline, son ciclos**. El producto ahora da la vuelta completa (14 s):
LLENANDO → EMPACANDO·ENFRIANDO → ABRIENDO → EXPULSANDO → PIEZA FUERA →
RETRAYENDO → CERRANDO. El video conserva sus tres actos porque un video
termina; el producto tiene que volver a disparar. El juez ganó el check
correspondiente ("retrae y CIERRA solo") y el de expulsión subió su umbral a
46 mm (con el muestreo viejo se perdía el pico: marcaba 44.6 de 48).

**Deuda de suerte pagada de paso**: `llenadoT` leía un `ciclo` rancio y
funcionaba porque `docName` (que sí está en las deps del efecto de
`window.__forgeBrep`) cambia en cada estación y rearmaba la API. Ahora `fillAt`
es estable (deps `[]`) y lee un ref espejo — y es **la única fuente** del mapeo
por cuantil: el botón y el arnés animan lo mismo, no dos copias que se despegan.

**EVIDENCIA CUMPLIDA:**
- `PLAY=1` **7/7** con control negativo · ciclo del dado **181/181** ·
  orden-gate VERDE.
- Deploy a prod OK (25/25 smoke) y **comprobado EN VIVO** en
  university.gaiaprime.com.mx (no en localhost): botón presente, abre solo
  (95.7 mm muestreados), llena solo 6.2 % → 100 %, cero errores de página.
