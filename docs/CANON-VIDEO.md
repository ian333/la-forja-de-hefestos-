# CANON-VIDEO — el flujo canónico de un video de la serie (LÉEME ANTES DE TOCAR NADA)

> **Este documento es OBLIGATORIO y NO se salta.** Es la fusión de todo lo que aprendimos
> a sangre haciendo los videos que GANARON: **O₂, N₂, C₂, H₂O v1 y v2** (los más exitosos
> del canal — O₂ 33.5K vistas, 276 guardados, +168 seguidores de un reel). Su código está
> **guardado y respaldado** (cápsulas en PRIME `moleculas/_code/`). Antes existía
> `PROCESO-SERIE-ENLACES.md`; se fusionó AQUÍ. Este es el ÚNICO documento del proceso.
>
> El problema que este doc resuelve NO es falta de reglas — es que **las reglas existían y
> no se leían**. Por eso CLAUDE.md apunta aquí como paso #0 obligatorio, `camera-shots.ts`
> y `render-clip.cjs` te traen aquí con un comentario, y la Regla #0 de abajo es un GATE, no
> una sugerencia.

---

## 🥇 REGLA #0 — COPIA A LOS GANADORES (gate duro, PRIMERA acción, antes de 1 línea)

**El fallo #1 recurrente, el que más ha costado, es REINVENTAR lo que ya está hecho.** Cada
vez que un video "nuevo" (molécula nueva, molKey nuevo) me engaña, escribo cámara / subtítulos
/ estructura DESDE CERO en vez de abrir el último ganador y copiarlo. Resultado: rompo el look
de V1/V2, la cámara queda casi fija, las moléculas quietas y separadas, subtítulos con formato
inventado. **Ian, exhausto del MISMO error: "QUIERO QUE TE DEJES DE INVENTAR Y REINVENTAR LAS
REGLAS CUANDO YA ESTÁN HECHAS... es el mismo error SIEMPRE."**

**Los ganadores (su código ES la ley — está respaldado, ábrelo):**
- **O₂ "doble enlace"** — `mol-o2-doble-enlace-capsula.tar.gz`. LA REGLA. `O2Cloud` (la nube
  densa aditiva ~34k pts) = EL DORADO. La paleta oro→ámbar-rojo. El inicio (formada ardiendo).
- **N₂ "triple enlace"** — `mol-n2-triple-enlace-capsula.tar.gz`. 18 versiones → master. Sprites
  GRANDES y TENUES, regiones de color, el anillo π emergente.
- **C₂ "carbono"** — `mol-c2-carbono-capsula.tar.gz`. Los dos anillos π sin σ frontal. Paleta hielo/azul.
- **H₂O v1 y v2 "agua"** — `mol-h2o-agua-capsula.tar.gz`, `mol-h2o-agua-v2-capsula.tar.gz`. El
  triatómico, el ángulo, los pares libres. v2 = el copy y la cámara que más gustó.
- **(H₂O)₆ "El hexágono"** — `mol-h2o-el-hexamero-capsula.tar.gz`. **REVENTÓ EN INSTAGRAM
  (2026-08-05).** Es el ganador más reciente y el más completo, así que es el primero que hay
  que abrir. Lo que hizo distinto, y es copiable:
  - **El gancho es una TRANSICIÓN, no una toma.** Lo que impacta es el campo ENCENDIÉNDOSE
    (`campo` 0.25 → 1.20 con la rampa de 0.6 s de `win()`), no la cámara. Medido: el frío
    pasa de 0.53 % a 24 % del cuadro en un segundo. Mover la cámara de un beat bueno al
    frente NO reproduce nada si el encendido ya ocurrió.
  - **La premisa se vuelve PRUEBA al final.** El bloque de contar ("cuenta las puntas de un
    copo: seis; cuenta los lados de esto: seis") abría el corte v1 y CIERRA el v2. Ahí gana.
  - **`ringOne` con `rCore`** = el único close-up de verdad de la serie. Sin declarar el radio
    del sujeto, la ley de encuadre mide el anillo COMPLETO y clava la cámara a 99 bohr.
  - **La afirmación aguanta a un químico** (`honestidad_del_copo` en su manifiesto): se dice
    que el agua REPITE la forma de seis al congelarse, nunca que esto SEA hielo.

**Qué hacer, SIEMPRE, antes de escribir código:**
1. **ABRE el CÓDIGO real** del último ganador (no la memoria — el CÓDIGO): su cámara
   (`MolCameraRig` + `playShots` + `camera-shots.ts`), sus subtítulos (hoy centralizados en
   `scripts/video-subs.py`), su estructura de beats, sus colores.
   - Escena/render: `src/cinematic/CinematicMolecule.tsx` (O2Cloud, Nucleus, BondEField, molCamera).
   - Cámara: `src/cinematic/camera-shots.ts` (la gramática de tomas).
   - Si necesitas el estado EXACTO con el que se entregó, desempaca su cápsula de PRIME.
2. **COPIA eso tal cual.** NO escribas renderer de puntos nuevo (reusa `O2Cloud`/`Nucleus`
   SIEMPRE). NO escribas cámara nueva (extiende `camera-shots.ts` con tomas nuevas, no un
   `WaterPairCamera` fijo desde cero). Si necesitas algo nuevo, **PARTE de lo que ya existe y
   cambia lo mínimo, declarándolo.**
3. **Extender reusa la paleta**: una pieza hermana usa el MISMO oro+morado del ganador; no
   inventes color nuevo salvo que el RELATO lo pida (y entonces se declara — ver §"color por molécula").
4. Si dudas "¿así lo hace la serie?", **ve a verlo en el código ANTES**, no después de que Ian lo cache.

**Paso a paso, 1 cambio a la vez** (la regla de oro que por fin funcionó con las 2 aguas): ver
V1/O₂ → hacer UN cambio → mostrar → siguiente. NUNCA rewrites. (Un rewrite pasó de 0/10 a
"verguísima"; el paso-a-paso llegó a "me llenas de orgullo".) Que las 2 aguas fueran difíciles
tiene sentido — es la PRIMERA vez que pasamos a 2 moléculas; pero la ley sigue: copia al ganador.

**Actualización de ganadores (Ian, 2026-08-17: "toda la serie de H₂O fue un boom — esos son
ganadores; el canon se basa en ESTOS"):** la lista completa es **O₂ · N₂ · C₂ · H₂O v1/v2 ·
el puente (v3) · el anillo (v4) · el cuarteto (v5) · el hexágono (v6)** — y para ÁTOMOS, el
canon es **el cromo de ORBITALES** (atomo-cr: abre EN el orbital, barrido (n,l,m) con cámara
de perfil, cuento con sello GAIA Prime). Todos con cápsula en PRIME. La verificación de
regresión del 2026-08-17 confirmó que su código vive INTACTO (ver
`reference_verificacion_regresion_ganadores` en memoria: escalera stills→cápsula→era-test).

---

## 🤖 LA MÁQUINA (2026-08-17) — el pipeline se defiende solo · RENDERIZADOR CONGELADO

La semana del 11-17 de agosto dejó ~15 errores operativos **con todo documentado**. La
lección de Ian: "la documentación no previene errores — hay que automatizar". La máquina:

```
bash scripts/video.sh <id> todo
  = salud → voz → campo → subs → render → ensamble → verificar → capsula → entrega
    (publicar aparte, con confirmación humana)
```

- **salud** (`scripts/salud.sh [--completa]`): doctor (GPU/vite-que-se-revive/disco/montajes)
  + **porteros de canarios** (`salud-canarios.cjs`: o2, wpair, whex6, atomo24 — ready, cero
  excepciones, cuadro con luz, GPU REAL exigida) + tsc scoped al cine con tolerancia CERO.
  Nació del qScale: una escena GANADORA muerta días porque nadie la cargaba.
- **voz**: fit-check (0.455 s/palabra vs formato.dur − 1.5) ANTES de gastar TTS → caché por
  línea (firma texto+VEL+TAKES+target+refs+PREPRO_V) → whisper como GATE. `VOZ=0` la salta.
- **render**: captura **cdp-jpeg** (el 97 % del cuadro era el PNG; 4.6× medido con gate de
  calidad: dif 1.34 < piso de encode 2.8) · shards 4 · guardas de duración/huella · gate de
  negros POR PÍXELES · `--dur` del manifiesto verificado contra la escena (gemelas).
- **entrega**: ext4 SIEMPRE (`dist-video/entregas/` + md5) → E:/Downloads si viven → ENCOLA
  si no. `scripts/traer.sh` (laptop) jala la cola con verificación. **E: está FUERA del
  camino crítico** — un drvfs muerto ya no rompe nada.
- **publicar**: el destino se RESUELVE contra la biblioteca de PRIME (pieza basura de nombre
  inventado = imposible) + scan/catálogo/deploy/verificación EN VIVO en el mismo paso.

**LA LEY DE LOS GATES:** ningún gate entra sin control positivo **Y negativo**. Esta semana
CUATRO gates reprobaban cosas correctas (negro=media, "veintinueve", orbitales por ejes,
elisiones) y uno nuevo dejó pasar un corte al 99.9 % por una fórmula corta — todos se
cazaron con controles. Un gate que reprueba lo correcto se ignora; uno que no truena con
el mal caso es fe.

**LAS LEYES DE OPERACIÓN** (las 5 apariciones del mismo error en UN día):
- El env de GPU y el `cd` **viajan DENTRO de la herramienta**, nunca en la memoria del
  operador. Todo script empieza con su `cd` absoluto; salud-canarios carga su propio env.
- ssh siempre con rutas ABSOLUTAS. Análisis en archivo `.py`/`.cjs`, NUNCA heredoc inline.
- Parcheos de código con `assert` de que el ancla prendió (un slice-replace silencioso se
  tragó dos funciones).

**EL CUENTO** (Ian: "microcápsulas que cuentan un cuento y recuerdan GAIA Prime"): guion =
personaje/conflicto/final en ~55 palabras; metáfora de la serie: cada electrón tiene su
**cuarto** (redondo/moño/pétalos); cierre IDÉNTICO en todas: **"GAIA Prime. Aprende a ver
lo invisible."** (el TTS lo pronuncia "Gaia Práim" — respelado en narracion-gen; en pantalla
siempre "GAIA Prime"). La física dura vive en la DESCRIPCIÓN de Comando, no en la voz.

**EL FREEZE:** el renderizador (escenas, shaders, coreografía) está **CONGELADO**. Solo los
pipelines de esta sección lo tocan. Para descongelar: correr la verificación de regresión
(escalera de la memoria) antes y después.

---

## 📦 REGLA #0.5 — UN VIDEO ES UN MANIFIESTO, NO ARCHIVOS NUEVOS

**Un video nuevo NO crea scripts ni constantes. Es DATOS.** (Ian, 2026-07-27: *"hay un reguero, se
modifican los archivos principales cada vez que hay un nuevo render y eso no me gusta"* — tenía razón:
wpair había generado 5 scripts propios + 4 constantes sueltas en la escena.)

```
videos/<id>.json      ← EL VIDEO: escena, formato, render, audio, salidas, cápsula, publicación
scripts/video.sh <id> [subs|render|ensamble|capsula|publicar|todo]   ← EL ÚNICO pipeline
```

- **Video nuevo** = copiar `videos/<otro>.json` → `videos/<nuevo>.json` y cambiar valores. Nada más.
- **Variante de cámara** (otro ángulo del mismo contenido) = **otra entrada en el registro
  `CAMERA_SHOTS`** de `CinematicMolecule.tsx` + `?cam=<x>` + su manifiesto. NO un componente nuevo,
  NO constantes `<MOL>_SHOTS`. Ejemplo vivo: `wpair` y `wpair-b`.
- **Las tomas SIEMPRE al registro** `CAMERA_SHOTS: Record<string, ShotEntry[]>` — ahí viven nacl, co,
  no, h2o, wpair, wpair-b, y `playShots` las ejecuta genérico. Ese patrón YA EXISTÍA; saltárselo fue
  el error.
- **Subtítulos: `scripts/video-subs.py`** = única fuente de verdad del estilo de la serie (calcado de
  `_o2_proof/narracion/o2-phrase-4k.ass`). NUNCA un generador por video. Avisa si una línea puede
  desbordar a 4K.
- **Prohibido**: `<mol>-full-pipeline.sh`, `<mol>-assemble.sh`, `<mol>-capsula.sh`, `<mol>-ass*.py`,
  `render-<mol>.sh`. Si sientes que necesitas uno, el manifiesto no está cubriendo algo → **extiende
  `video.sh`/el manifiesto**, no crees un archivo.
- Legacy sin migrar (de videos ya entregados): `o2-clip.cjs`, `render-li2.sh`, `render-li2-16x9.sh`.
  Migrarlos a manifiesto la próxima vez que se toquen.

**Cómo se verificó la generalización** (2026-07-24/27): `video-subs.py` regeneró el ASS de "El puente"
**byte-idéntico** al del video publicado, y la escena refactorizada (tomas movidas al registro) renderizó
frames idénticos en composición. Estandarizar NO cambió ni un pixel del entregable.

## 🎬 EL FLUJO CANÓNICO (un video de principio a fin)

`<mol>` = o2 | n2 | c2 | h2o | wpair | ... — la molécula/pieza. Todo determinista (`renderAt(t)` PURO).

> Pasos 7-13 = **`bash scripts/video.sh <id> todo`** (subs→render paralelo→ensamble→cápsula).
> Los pasos 1-6 (física, guion, voz, timings, música) siguen siendo por-pieza porque son creativos.

```
0. COPIA GANADOR   Regla #0. Abre O₂/N₂/C₂/H₂O, lee cámara+subs+beats+colores. NO reinventes.
0b. MANIFIESTO     Regla #0.5: videos/<id>.json (copiado de otro). CERO scripts nuevos.
1. FÍSICA REAL     python3 scripts/precompute-*.py <mol>      → .bin a public/precomputed/ (cero inventado)
                     ├ diatómico:  precompute-bond-abinitio.py + precompute-pi-split.py + precompute-atom-cloud.py
                     ├ triatómico: precompute-triatomic.py
                     └ 2 moléculas: precompute-water-approach.py (dímero, Δρ, campo MEP)
                   GATE de física: observable vs experimento (μ, Re, ⟨S²⟩, E_enlace) ANTES de seguir.
2. GUION + COPY    scripts/guiones/<mol>.txt — frases CORTAS, 1/línea, español MX, CON acentos.
                   ⚡ EN EL MISMO PASO se escribe el COPY de publicación (título + descripción +
                   hashtags = el SPECIAL de comando-catalogo.cjs y `publicar.copy` del manifiesto).
                   Ian, 2026-08-25: "el título y la descripción deberían estar PRIMERO, sin esperar
                   el video" — el copy no depende de un solo pixel; esperar al render para
                   escribirlo dejó a Ian sin nada que pegar en Comando mientras subía 620 MB.
3. VOZ (Matilda)   narracion-gen.py <mol>  (iangpu, /home/ian/tts-venv/bin/python) → wavs
4. AUDIO+TIMINGS   assemble-narracion.py <mol> → segs.json (duraciones REALES de cada línea)
5. BEATS↔VOZ       recalibrar cámara/gates/bondR a los segundos de segs.json (§sincronía). SIEMPRE.
6. MÚSICA          musica-eterea.py compose+master (lidio) — o remap de la pieza ganadora + ducking
7. SUBTÍTULOS      video.sh <id> subs   → video-subs.py = ÚNICA fuente del estilo de la serie
8. SYNC → iangpu   rsync src/cinematic/ + scripts/ + videos/ + public/precomputed/*.bin (SIN --delete)
9. RENDER 4K       video.sh <id> render → render-clip.cjs sharded (2160×3840 vert / 3840×2160 horiz)
                   🚀 PARALELO: shards del manifiesto (NSHARDS=5 probado: 3.7× más rápido)
10. 👁️ QA AGENTES  extraer ~50 frames de TODA la línea de tiempo → agentes los VEN y CALIFICAN →
                   sintetizar → ARREGLAR dead-spots → re-render (§paso de agentes). GATE de ojo.
11. ENSAMBLE       video.sh <id> ensamble: voz+música (loudnorm) + quema ASS + NVENC 10-bit
                   HEVC master (yuv420p10le) + h264 entrega → /mnt/e/forja-videos (iangpu) + Downloads
12. VERIFICAR ENTREGA  ver frames del VIDEO FINAL (no de la sonda) por toda la timeline (§verificación)
13. CÁPSULA        video.sh <id> capsula → tar.gz a PRIME (obligatorio, §cápsula)
14. PUBLICAR       SPECIAL en comando-catalogo.cjs + codigo:capsula + comando-catalogo.cjs +
                   rsync 2 JSONs a ATLAS (§publicación / comando)
```

---

## 👁️ EL PASO DE AGENTES (QA de ojo — lo que Ian pidió y le gustó)

Ian: *"me gustó que pusieras a agentes a revisar y calificar."* Antes de dar por bueno un render,
**los OJOS son el juez** — y ni el gate numérico ni mi propia sonda bastan (mienten, ver §verificación).
El proceso:

1. **Extraer ~50 frames de INICIO A FIN** del render (o del video final): repartidos por toda la
   línea de tiempo, no solo los beats calientes. `ffmpeg -i <video> -vf fps=... ` o tomar de la
   carpeta de frames del render.
2. **Lanzar ~5 agentes `general-purpose` en paralelo**, cada uno con un LOTE de frames, con la
   instrucción de ABRIRLOS con Read (los VEN de verdad) y calificar: **composición, belleza,
   textura, color, MONSTRUOSIDAD, y sobre todo DEAD-SPOTS** (molécula en la esquina, cuadro vacío,
   frame negro, campo solo feo, blanco reventado). Que devuelvan por frame: nota /10 + qué está mal.
3. **Sintetizar**: juntar los veredictos, ubicar los tramos malos por segundo.
4. **ARREGLAR el dead-spot** (típicamente una toma de `camera-shots.ts` o un gate de brillo), **1
   cambio a la vez**, y **re-renderizar** solo para verificar. Repetir hasta que no queden tramos malos.
5. Herramientas afines: `critic-gate.cjs` (gate automático: falla si detecta morado/confeti/frame-negro)
   y `critic-eye.cjs` (captura + manifiesto Markdown que un agente Opus abre con Read y juzga).

Dead-spots reales cazados así en "El puente" (2 aguas): whipParallax dejaba las moléculas en las
esquinas → se cambió a `twoShot`+`orbitOne`; `throughBridge` daba FRAME NEGRO al cruzar el hueco →
`crashIn`; campo-solo salía alambre vacío → se subió `cloudGate`; núcleos blancos reventados → se
bajó el brillo. **Sin el paso de agentes, esos tramos se entregan.** Complementa la "ruta CPU"
(commits del estudio Viento): verificar un fenómeno con un camino INDEPENDIENTE caza bugs reales.

---

## 📊 LA VARA (números reales de los ganadores, IG)

Con qué comparar una pieza nueva. **O₂** (33.5K vistas, +168 seguidores) y **El puente** (H₂O···H₂O,
medido a 3 días: **18,420 vistas · 12,628 alcanzados · +338 seguidores = 2.7% del alcance** · 1.5K
likes 11.9% · **431 guardados 3.4%** · 310 compartidos · 108 reposts · omisiones 40.9%). IG marcó
TODAS las interacciones "Más alto" y las omisiones "Más bajo".

- **Guardados/likes ≈ 29-39% = la firma de ENSEÑANZA** (la gente lo atesora). Es LA métrica de esta serie.
- **Retención**: 37s de 77s (48%). La curva cae a ~55% en los primeros **~5 s** (el acantilado de IG)
  y luego baja MUY suave → el cuerpo retiene; **lo que se gana o se pierde son los primeros 5 segundos.**
- **63.7% del alcance viene de la pestaña Reels** = empuje en frío del algoritmo (no de seguidores).
- **No publicar dos cortes del MISMO contenido seguidos**: mientras una pieza sigue subiendo, una
  variante (otro ángulo, mismo guion) canibaliza su empuje. La variante sirve como material para un
  video NUEVO (p.ej. el video-respuesta a los comentarios), no como post independiente.
- **Los comentarios son el brief del siguiente video**: la duda que se repite (≥3 veces) ya tiene
  demanda probada y el algoritmo ya validó el tema.

## 👑 LAS LEYES DEL REY (medidas en EL PUENTE, 2026-08-25 — la base de TODO lo que sigue)

**EL PUENTE es el rey** (~120k vistas, +3.5k seguidores con campaña encima; el dato limpio
a 3 días: 2.7 % de conversión, el DOBLE que O₂). Ian, 2026-08-25: *"el rey será la base de
todo lo que hagamos"*. Se desarmó cuadro a cuadro (2 fps: ocupación, luminancia, movimiento,
color dominante) cruzado con las 20 líneas, las 9 tomas y las capas. Esto es lo que dice, y
en tres puntos **contradice a los docs de neurociencia** — gana el rey, no el doc.

1. **Dos MUNDOS que se ALTERNAN, no se mezclan.** AZUL (campo, las DOS, plano abierto,
   fill 50-85 %, frío 90-99 %) ↔ MAGENTA (nube, UNA sola, close-up, fill 22-37 %, magenta
   73-80 %). AZUL = 56 % del video, MAGENTA = 26 %, ORO = 10 %. Cada brinco de mundo es un
   corte seco con cambio de color COMPLETO — resetea la habituación mejor que un corte dentro
   del mismo look. ⚠ `atencion-verify` mide "firma cálido+frío SIMULTÁNEA" (la del O₂ viral,
   98 %) y al rey le da 2-7 % → lo REPRUEBA (55.0 y 58.8 < 60). Son dos gramáticas ganadoras
   distintas; el verificador solo conoce una. Ley de los gates: un gate que reprueba al rey
   no decide nada.
2. **El hueco lo abre la VOZ y lo cierra un CORTE.** l2 a los 4.2 s ("Pero mira lo que
   traen dentro") → corte a los 7.0 s al mundo MAGENTA, una molécula de cerca. La respuesta
   llega como IMAGEN 3 s después, no como frase.
3. **El color es una PALABRA.** Los únicos 8 s con cálido ≥10 % son t=20-28: "El corazón
   dorado es el oxígeno". Antes y después, cálido = 0 %. El oro no es paleta: es el sustantivo
   de ESA línea (capa `acc` 19.8-28.6).
4. **El clímax es una RAMPA de ~7 s montada sobre la línea MÁS LARGA.** fill 51 → 85 % entre
   t=49 y 56 (pushToBridge = looming) bajo l15 (15 palabras; promedio 7.5). Pico 85 % en
   **t=60 = 78 %** del video, sobre "Míralos correrse".
5. **Después del clímax el video se VACÍA para probar la frase.** t=62-68: `campo` apagado,
   fill 33 %, solo nube — mientras la voz dice "No es una línea. Es la nube reacomodándose".
   Apagar una capa ES la demostración. Luego pullOut, vuelve al AZUL y termina en **80 % de
   fill sobre "y tú"**: el último segundo es el 2º pico del video (peak-end, literal).
6. **Los primeros 7 s NO cortan.** Una toma, las dos moléculas, campo encendido, fill 54-56 %,
   movimiento 17/s, voz a los 0.4 s — y retuvo 55 % a los 5 s. Los docs piden pattern-interrupt
   cada 3-5 s; el rey dice: **la estructura necesita 7 s para leerse.** El gancho es
   legibilidad + movimiento + voz temprana, no un corte.

**Reparto medido por acto:** presentación 9 % · explicación (electrones/oxígeno/campo) **58 %**
· evento (se acercan + puente) 22 % · payoff 11 %. El rey es una CLASE disfrazada de
espectáculo: por eso los guardados (3.4 %) y por eso la curva es plana después de los 5 s.
**Guion:** 20 líneas · 149 palabras · 7.5 pal/línea (5-15) · 2.3 pal/s · huecos 0.55 s · la
voz ocupa el 85 % del tiempo · una idea por línea · verbos emocionales (codicioso, jala,
se agarra) · "y tú" es la última palabra.

**LA PLANTILLA (esto es lo que se copia — no el agua):**
```
0.0-0.4   silencio; frame 0 = los DOS protagonistas, mundo AZUL, fill ≥54 %, moviéndose
0.4-9 %   l1-2: qué es (COTIDIANO, en las manos del público) + el HUECO
9 %       CORTE → mundo MAGENTA: UNO solo, de cerca (responde el hueco con imagen)
9-26 %    l3-6: qué es la nube (una idea por línea, 5-9 palabras)
26-36 %   la palabra-color ("dorado") — el único cálido del video
36-53 %   ángulo bajo + spin ardiendo: el conflicto (verbos: codicioso, jala)
53-67 %   mundo AZUL, nube al 58 %: "estas líneas no son adorno, son el campo calculado"
67-78 %   RAMPA de fill 50→85 % en ~7 s (looming) bajo la línea MÁS LARGA → clímax al 78 %
78-88 %   apagar una capa para PROBAR la frase ("no es una línea")
88-100 %  pullOut, vuelve al AZUL al 80 %, "y tú" + sello "GAIA Prime. Aprende a ver lo invisible."
requisitos: DOS protagonistas distintos · cotidiano · un campo que JALA · el puente es NUBE ·
            ~13 bohr (régimen nativo del motor) · 20 líneas / ~150 palabras / 77 s
```
Lo que NO cumple la plantilla y por eso convirtió menos: N objetos iguales (gauss, hexágono —
no hay drama entre seis iguales), nombre de ley como gancho, cierre técnico.

**Decisiones (Ian, 2026-08-25):** (a) el sello **GAIA Prime va al final de toda pieza
nueva** — el rey no lo tenía, se agrega DESPUÉS del "y tú", nunca en su lugar. (b) **Loop**
("que empiece como termina", rewatch = señal #1 de IG): PREGUNTA ABIERTA — el rey ya cierra
en el mismo mundo (AZUL→AZUL) y da `loop` 0.886 en atencion-verify; empatar la pose final con
la inicial es un cambio de 1 parámetro en `pullOut` y se mide contra ese 0.886. No se toca
sin A/B. (c) Los **quick wins** salen del rey: mismo bin, mismos átomos, otra cámara del
registro (`?cam=`), otro guion con otro payoff cotidiano — cero simulación, cero escena
nueva. El primero: EL SUDOR (camB + "por qué el sudor te enfría").

## 🔛 LA MECÁNICA DEL O₂: PRENDER/APAGAR ES LA DEMOSTRACIÓN (canonizada 2026-08-27)

Ian, pidiendo el viaje entre los átomos: *"revisa el del O₂: ahí lo que hacíamos es que
apagábamos las nubes y las prendíamos. Me gustaría eso mismo acá."* Es la mecánica que
hizo viral al O₂ y que el rey repite en su ley #5 — y hasta hoy vivía repartida en dos
lugares sin nombre. Este es el nombre.

**LA LEY: cada afirmación del guion sobre una capa se PRUEBA prendiéndola o apagándola
SOLA, en la ventana exacta de la voz.** No se dice "son tres enlaces": se prende σ, luego
π¹, luego π² (`piSplit` en O₂/N₂/C₂: la nube π se DIVIDE en sus dos MOs reales y cada una
tiene su `pi1Mul`/`pi2Mul`). No se dice "no es una línea, es la nube": se APAGA el campo
(rey, t=62-68, `campo` a 15 %) y queda solo la nube. La ausencia demuestra lo que la
presencia solo afirma.

**Cómo se ejecuta (ya existe, no se reinventa):** la coreografía es DATO en `capas.ts` —
un `CapasSpec` por pieza (`WPAIR_CAPAS`, `WTET_CAPAS`…), cada capa un objeto con `base` +
`mods[{wins, a, label}]`. Las ventanas salen de `segs.json` (los ARRANQUES reales de la voz,
`recalibrar-beats.py`), nunca a mano. Cada `mod` lleva `label` con la frase que prueba.

**Las tres figuras que ya ganaron:**
1. **Encender por partes** (O₂/N₂): "son tres a la vez" → σ, π¹, π² entran una por una.
   Cada entrada cae en su palabra.
2. **Apagar para probar** (rey, ley #5): "no es una línea" → campo fuera, la nube sola.
3. **Apagar TODO y volver a prender** (la silla, 2026-08-27): "quita las nubes: no hay
   nada, ni palito ni resorte" → `nubes` y `campo` a cero, quedan los núcleos pelones →
   "préndelas: ahí está el puente" → vuelven. Es la #2 llevada al límite: la nada como
   argumento.

**⚠ SI APAGAS TODO, DECLARA LA VENTANA.** El portero de cuadros negros de `render-clip` juzga
por TAMAÑO DE ARCHIVO, así que un cuadro legítimamente negro lo reprueba y lo reintenta con
navegador nuevo. Medido en LA SILLA el 2026-08-29: **hasta 12 reintentos por cuadro** entre
t=21.7 y 22.5, >1000 arranques de navegador desperdiciados por render, y el ritmo cayendo de
0.04 a **1.18 s/cuadro**. El portero peleaba contra la dirección de arte. Cura: el manifiesto
declara `render.ventanasNegras: "20.2-24.8"` y `video.sh` se lo pasa a `render-clip --negras`.
A/B en el mismo shard: 28 reintentos → 0.

**Reglas ganadas a sangre:** apagar a 0 absoluto deja "alambre azul" o vacío muerto — el
rey baja a 58 %/15 %, no a 0, salvo cuando la NADA es el argumento (figura 3) y dura ≤3 s.
El corte de capa cae en el ARRANQUE de la línea, no en su final (2.5 s tarde = el
verificador lo cazó en el cuarteto). Y una capa apagada mientras la voz habla de OTRA
cosa es ruido, no demostración.

## 📈 LAS TRES COLUMNAS (medidas sobre 77 reels, 2026-08-28 — reemplazan a la intuición)

Dataset completo de @gaiaprime_mx vía Graph API (`scripts/analisis-reels.py` → artefacto
`public/comando/analisis-ig.json`, pintado en Comando → Telemetría, ordenable). n=77,
271,172 vistas. **Esto no son opiniones sobre qué funciona: es lo que el canal hizo.**

**LA DISTRIBUCIÓN ES UNA LOTERÍA CON BOLETOS SESGADOS.** top 2 videos = **57.4 %** de TODAS
las vistas; top 8 = **75.5 %**. La mediana es 384 vistas. Corolario duro para la estrategia:
no se llega a una meta de seguidores con cadencia — **se llega con un outlier más**. Cincuenta
videos medianos ≈ 20 mil vistas ≈ 440 seguidores. Un outlier ≈ 92 mil vistas él solo.

**LAS TRES COLUMNAS que predicen (correlación con log10 vistas):**
```
seg_vistos (tiempo medio)  +0.797     ← la más fuerte
guardados / 1000 alcance   +0.768
compartidos / 1000 alcance +0.767
skip3s                     −0.610
R² skip SOLO           0.372     ← el gancho explica solo un tercio
R² skip+guard+compart  0.770     ← y COMPARTIR pesa 2.0× lo que guardar
```
**Los DOS outliers son los únicos videos del dataset con las tres columnas altas a la vez**
(skip <42 · seg_vistos >30 · compartidos >20 por mil). Tener una sola no alcanza, y hay
prueba de las dos direcciones: el copo de nieve tiene MEJOR skip que el rey (36.6 vs 41.9) y
hizo 11.8k contra 63k porque compartió la mitad; "el ácido en tu estómago" comparte 21.6 (casi
como el rey) con skip de 42.8 y se quedó en 2,711 porque nadie lo vio completo.

**EL METRAJE NO DECIDE NADA.** Mismo bin del rey, cuatro guiones y cuatro cámaras:
```
El puente invisible  63,325 vistas · 35.4 s vistos
Por qué el sudor      4,425 vistas · 27.0 s
A dónde se va la sal  2,623 vistas · 22.7 s
La silla vacía          478 vistas ·  9.2 s
```
**132× con el mismo bin.** Copiar al rey NO es copiar su bin: es copiar que la gente aguante
35 segundos. Un bin nuevo no compra nada por sí solo (ver Regla #0: copiar al ganador es
copiar lo que lo hizo ganar, no su materia prima).

**QUÉ SE COMPARTE (c/1000 de alcance, medido):** lo que habla del CUERPO o la vida diaria del
espectador y le entrega **una frase que puede repetirle a alguien**.
```
30.6  El puente invisible que mantiene junta cada gota de AGUA
21.6  Tienes un ÁCIDO que disuelve metal — ahorita, en TU estómago
20.0  Por qué el SUDOR te enfría (y por qué tiritas al bañarte)
19.8  Un ángulo de 104.5° decide que ESTÉS VIVO
 0.0  Esto es la GASOLINA, molécula real
 0.0  Un átomo de ORO de verdad  (×2 intentos)
 0.0  Un pedazo REAL de tu gen BRCA1
```
Gasolina, oro y un gen son *interesantes*; nadie los reenvía. La regla: **el sujeto es el
espectador, no la molécula.** Un dato no se comparte; una frase que puedes decir en la cena, sí.

**CONVERSIÓN:** ~22 seguidores por cada 1000 vistas (promedio de cuenta; la API NO expone
seguidores por video, e incluye la campaña pagada — es techo, no ley).

**CAVEAT que va siempre pegado a estos números:** guardados y compartidos son en parte
CONSECUENCIA de la distribución, no solo causa — la flecha va en los dos sentidos. Y n=77 con
2 outliers: cualquier modelo está dominado por esos dos puntos. Sirven para DECIDIR, no para
predecir. Ver [[feedback_gates_no_miden_verdad]].

## ⏱️ EL RITMO — las dos perillas que nunca movimos (2026-09-02, con datos de AFUERA)

ian, harto de que las copias no reproduzcan a los reyes: *"estamos haciendo un chingo de
videos bien vergas para ver cuál pega, ya tenemos 2 que pegaron chingón, tratamos de
reproducirlos y no imitan para nada a los reyes"*. Y después: *"ve allá afuera a investigar"*.

**El diagnóstico que salió no fue una correlación: fue que NO PUEDE HABERLA.** Las 24 piezas
largas viven todas en la MISMA banda estrecha de las dos variables que la literatura señala.
Sin varianza no hay correlación posible — el análisis no falló por falta de datos, falló
porque llevamos 24 experimentos con el mismo tratamiento.

### 1. HABLAMOS A LA MITAD DE VELOCIDAD (lo más grave, y es de idioma)

El español se habla a **7.82 sílabas/segundo** (Université de Lyon, 2011) — de los idiomas
más rápidos medidos, **26 % más sílabas por segundo que el inglés** (6.19). Nuestro público
es hispanohablante.

```
nuestra narración      3.79 síl/s   (4.04 sin los huecos de 0.40 s)   ← 111 guiones medidos
español natural        7.82 síl/s
inglés natural         6.19 síl/s
                       → vamos al 49 % del ritmo natural del español
```

Somos más lentos que el inglés natural, narrando en español. Y no es una decisión por pieza:
`0.455 s/palabra` está QUEMADO en el fit-check de `video.sh` — sd de 4.4 pal/min sobre 111
guiones, o sea una constante, no una variable. (Aviso honesto: el contador usa grupos
vocálicos y subestima los hiatos; el ritmo real anda en 4.2-4.5 síl/s, o sea ~55 %.)

**Por qué importa para los COMPARTIDOS**, que es la métrica que ian persigue: en 2,511 videos
de TikTok, la velocidad del habla tuvo **efecto positivo y significativo sobre los compartidos
— y solo sobre esos**, no sobre likes ni comentarios.

### 2. CORTAMOS 3-6 VECES MENOS DE LO RECOMENDADO

```
nuestro catálogo    5.2 – 10.4 cortes/min   (sd 1.08)
referencia          20 – 40 cortes/min      (un cambio visual cada 1.5-3 s)
```

El número de cortes tiene relación en **U INVERTIDA** con el engagement — hay un óptimo, no es
"más es mejor". Y las escenas frecuentes dan **+32 % de retención** contra plano estático. El
contenido educativo pide sostener algo más que un baile, así que nuestro óptimo estará por
debajo de 40; pero no en 6.

### 3. LA SEÑAL DE INSTAGRAM ES *SENDS PER REACH* — y nuestro dato ya lo decía

Afuera: la señal más importante de Instagram en 2026 es cuántas veces mandan tu reel por DM,
normalizado por alcance. En casa, medido: `c_por_mil` es lo que más correlaciona con las
vistas (**r = +0.748**, n=24 largas), y los DOS reyes son los únicos que se salen del rango de
sus diez seguidores (**25.2 y 29.6 contra una mediana de ~8**). Las dos fuentes apuntan al
mismo lugar. **Optimizar para que alguien te lo MANDE a un amigo es optimizar para el
algoritmo.**

### 4. LO QUE SE DESCARTÓ CON DATOS (vale tanto como un hallazgo)

Medidos los PÍXELES de los 78 reels que Instagram publicó (`scripts/rasgos-reels.py`,
unión por id de medio) y cruzados controlando por ÉPOCA y por FORMATO:

**saturación · cálido · frío · magenta · luma · contraste · quemado · movimiento · duración**
— ninguna predice nada. La correlación cruda saturación↔vistas (+0.476) **era la ÉPOCA**: la
saturación subió con el tiempo (r=+0.56 con la fecha) y el canal mejoró con el tiempo; al
quitar la tendencia se cae a +0.075 (p=0.51).

Quedan dos candidatas VIVAS y ninguna probada: `variedad_color` (+0.433 con vistas, aguanta
quitar a los reyes con +0.317) y `lleno` (**−0.409 con segundos vistos**, p=0.036 — y va
CONTRA lo que se ha estado optimizando con `?zoom=`). Hacen falta 40 y 45 piezas comparables;
hay 24.

⚠ **Disciplina de pruebas:** 11 rasgos × 3 métricas = 33 correlaciones. A p<0.05 se esperan
~1.6 hallazgos por puro azar. Solo cuentan los p<0.01.

### 5. EL EXPERIMENTO (declarado en `public/comando/ritmo.json`)

Piezas **HERMANAS**: mismo bin, mismo guion, misma voz. Cambia SOLO el ritmo.

```
A · como hoy    6.5 cortes/min · 132 pal/min (3.8 síl/s)
B · rápido       20 cortes/min · 165 pal/min (≈6 síl/s)
                 partir cada toma larga en 3 · VEL del TTS ≈ 1.25
3 por brazo · se corta con skip3s y compartidos/mil (se leen en HORAS)
cuesta solo RASTER: el bin, la voz y el guion ya existen
```

### 6. CUÁNDO PUBLICAR (LATAM)

América Latina y el Caribe pican a las **14-16 h**; las horas muertas son 8-10 h. Para Reels
en general la ventana fuerte es **18-23 h**, y **miércoles y jueves** son los días. Los
públicos brasileños se estiran más tarde que los mexicanos. ⚠ Ojo con nuestro caso: la
campaña pagada del rey trajo público **es_US, no es_MX** (ver `project_funnel_ig_pagado`), así
que el huso que manda puede no ser el de México.

**Fuentes:** el estudio de 2,511 videos de TikTok (visual-audio, engagement) · Université de
Lyon 2011 sobre velocidad del habla por idioma · benchmarks de retención en video corto 2026 ·
datos de horarios de publicación 2026 (9.6M posts).

---

## 🧠 LA NEUROLOGÍA DEL CHISME — quién decide compartir, el cerebro rápido o el lento (2026-09-02)

ian: *"investiguemos el chisme neurológicamente, debe haber una relación cerebro lento /
cerebro rápido, ¿cuál afectará más la decisión?"*. La respuesta está medida, y con fMRI.

### GANA EL RÁPIDO. Sin discusión.

> *"La decisión de compartir opera de forma relativamente automática. La gente hace juicios
> rápidos sobre si algo es compartible… el impulso surge de una evaluación intuitiva, no de
> una reflexión prolongada."* — Falk et al., neurociencia del compartir (UPenn)

Es **Sistema 1** (Kahneman): automático, asociativo, emocional. El Sistema 2 solo *interviene*
si se toma la molestia, y casi nunca se la toma porque cuesta energía.

**Consecuencia dura para nosotros: nuestros videos están construidos para el Sistema 2.** Son
explicaciones, con la conclusión al final. El aparato que decide mandarlo por DM no lee
argumentos: reconoce patrones y siente.

### DE QUÉ ESTÁ HECHA LA DECISIÓN (el modelo de VIRALIDAD POR VALOR)

El cerebro integra dos cosas en una sola señal de valor (vmPFC + estriado ventral), y esa
señal predice el compartido **poblacional** mejor que lo que la gente DICE que compartiría:

```
valor PROPIO    ¿qué dice esto de mí si lo mando?
valor SOCIAL    ¿a quién se lo mando, y qué me gano con esa persona?
```

Se comparte por lo que dice de UNO, no por lo bueno que sea el contenido. Un video puede ser
impecable y no dar nada que decir de quien lo manda.

### LA EMOCIÓN QUE MÁS COMPARTE ES EL ASOMBRO — y es nuestro terreno

Berger & Milkman (todos los artículos del NYT en 3 meses): el contenido que provoca emociones
de **ALTA ACTIVACIÓN** se comparte más — **asombro** (la positiva más fuerte), enojo, ansiedad.
Las de **BAJA activación**, como la tristeza, se comparten MENOS. Y se sostiene incluso
controlando por qué tan sorprendente, interesante o útil es el contenido.

**Esto es lo mejor que nos ha pasado en toda la investigación:** el asombro es nativo de lo que
hacemos. No hay que fabricarlo, hay que no estorbarlo. Y da una regla negativa clara: **nada de
tono melancólico, contemplativo o "qué bonito"** — eso es baja activación y apaga el compartido.

### HIPÓTESIS (no hallazgo): REVELACIÓN le gana a EXPLICACIÓN

Clasificando la primera frase de los 24 captions largos por su marco:

```
REVELACIÓN    n=4   7,942 vistas medianas · 12.73 comp/mil · skip 43.8
EXPLICACIÓN   n=4   4,996                 ·  8.67          · skip 48.5
otro          n=16  3,442                 ·  7.88          · skip 45.6
```

*"Nunca habías visto NACER un enlace"* (el rey, 94k) contra *"Por qué el hielo flota"* (2.7k).
Encaja con el Sistema 1: "nunca habías visto" es valor PROPIO y alta activación; "por qué X"
es una promesa de razonamiento, o sea una invitación al Sistema 2.

⚠ **n=4 por grupo y la clasificación la hice YO después de ver los resultados.** Es hipótesis
para diseñar el experimento, NO evidencia. Anotado aquí para que nadie lo cite como hallazgo.

### QUÉ SE HACE CON ESTO (traducción a decisiones)

1. **El gancho vende asombro, no tema.** "Nunca habías visto" / "Mira esto" antes que "Por qué".
2. **Dale al espectador algo que DECIR.** Si no puede completar *"te mando esto porque…"* en
   una frase, no hay valor propio y no lo manda.
3. **Nada de baja activación.** Cero tono melancólico o contemplativo.
4. **El asombro va temprano y va otra vez al final** — el rey ya lo hace (§LAS LEYES DEL REY,
   peak-end), y ahora sabemos por qué funciona.
5. Y la que ya sabíamos por dato propio: la señal de Instagram es *sends per reach*
   (§EL RITMO), que es exactamente el output de esta maquinaria.

**Fuentes:** Falk et al., *The neuroscience of information sharing* y *A neural model of
valuation and information virality* (PNAS) · Baek, Scholz, O'Donnell & Falk, *The Value of
Sharing Information* · Berger & Milkman, *What Makes Online Content Viral?* (JMR 2012) ·
Kahneman, dual-process.

---

## 🚦 EL CAMINO CANON — TODOS los porteros, y cuáles de verdad bloquean (auditado 2026-09-02)

ian: *"¿cuáles son todas las métricas y gates? Se supone que si no se cumplen no sale el
video, ¿no? Quiero ver cómo va el camino canon con todas estas métricas que estás añadiendo."*

Auditado **leyendo el código**, no la memoria. Y la distinción importa, porque no todo lo que
llamamos "gate" reprueba: hay cosas que solo imprimen.

### BLOQUEAN DE VERDAD (salen con código ≠ 0 y la etapa aborta)

| # | portero | qué mide | dónde |
|---|---|---|---|
| 1 | `salud.sh` | disco, chromes zombis, vite vivo, GPU real (no SwiftShader) | `video.sh salud` |
| 2 | `posq_para()` | ni UNA coordenada puede topar el int16 al escribir el .bin | `precompute-water-approach.py` |
| 3 | `bin-gate.py` | saturación del .bin, ∫Δρ>0 monótono, cuadros muertos | antes de render |
| 4 | `color-hirshfeld.py` | el reparto por elemento no se aleja >12 pts de los electrones aportados | al recolorear |
| 5 | **fit-check** | el guion CABE en `formato.dur` — antes de gastar TTS | `video.sh voz` |
| 6 | **`voz-check.py`** | whisper transcribe y la voz DICE el guion | `video.sh voz` |
| 7 | `critic-gate.cjs` | morado, confeti, frame-negro | antes del 4K |
| 8 | `pantalla-verify.py` | ventanas de void muerto | pre-vuelo |
| 9 | render completo | ≥ NFRAMES−2 cuadros | `video.sh render` |
| 10 | cuadros negros | cero negros no declarados (ver `render.ventanasNegras`) | `video.sh ensamble` |
| 11 | cápsula completa | bins + guion + scripts + escenaSrc presentes | `video.sh capsula` |
| 12 | **`publicar.autorizado`** | sin la frase de ian, NO sube. El más importante de todos | ambos subidores |
| 13 | `gate_calidad` | ≥2160p y ≥15 Mbps (LEY ABSOLUTA) | `subir-youtube.py` |
| 14 | `specs_reel` | 13 comprobaciones de formato IG | `subir-instagram.py` |
| 15 | peso IG | ≤300 MB (el tope REAL medido, no el de la doc) | `reels-1080.py` |

### NO BLOQUEAN — solo reportan (y está bien que así sea)

- **`atencion-verify.py`** — el "verificador de atención" **NO TIENE UN SOLO `sys.exit`**.
  Imprime score, gancho, valles y sparkline, y siempre sale 0. El `|| return 1` de `video.sh`
  solo atrapa que el script se caiga. ⚠ **Y hay que dejarlo así**: le da 55-58 al REY, o sea
  que como portero reprobaría al mejor video del canal. Ley del canon: *un gate que reprueba
  al rey no decide nada*. Lo que faltaba era **decirlo en voz alta**, no arreglarlo.
- **`still-alarma.py`** — mide llenado, quemado y morado y pinta la hoja; solo truena si no
  hay PNGs. Sus banderas son para el OJO, no para el pipeline.
- **`motion-verify.cjs`** — sale ≠0 solo por errores de uso.
- **Todo el análisis nuevo** (`senales`, `ritmo`, `rasgos-reels`, `curvas-dia`,
  `analisis-rasgos`) es ESTRATEGIA, no portería. No bloquea nada y no debe: son para decidir
  QUÉ hacer, no para aprobar lo hecho.

### LO QUE FALTA, y es el hueco que explica todo lo demás

Ningún portero exige que la pieza **DECLARE SU TRATAMIENTO**. Por eso llevamos 24 experimentos
sin poder atribuir nada (§EL RITMO). El portero que sí hace falta no es de calidad: es de
**registro**.

**IMPLEMENTADO el 2026-09-02** como `scripts/ritmo-pieza.py`, conectado a `video.sh ritmo` y
metido en `todo` **antes del render** (para no enterarte después de gastar 45 min).

```
MIDE SOLO (nadie teclea números):
    ritmo.cortes_por_min      de CAMERA_SHOTS · si la pieza no usa el registro (clases,
                              metraje existente) se EXIGE declararlo a mano
    ritmo.silabas_por_seg     de segs.json si ya hay voz (REAL); del guion si aún no (estimado)

SE DECLARA A MANO (juicios, una línea cada uno):
    ritmo.brazo               "A" (como hoy) | "B" (rápido)
    copy.marco                "revelacion" | "explicacion"      §LA NEUROLOGÍA DEL CHISME
    copy.activacion           "alta" | "baja"                   la baja comparte MENOS
    copy.valor_propio         completa "te mando esto porque…"  el valor PROPIO del modelo
```

**LA REGLA, y es a propósito: BLOQUEA por no declarar, AVISA por salirse del rango.** No
sabemos cuál es el valor correcto — sabemos que hay que anotarlo. Un portero que impusiera el
rango de afuera estaría inventando un óptimo que nadie ha medido AQUÍ, y ya sabemos cómo
termina eso (§un gate que reprueba al rey no decide nada).

`copy.valor_propio` no es burocracia: es la prueba del modelo de viralidad por valor. Si no
puedes completar *"te mando esto porque…"* en una frase, el espectador tampoco va a poder — y
sin valor propio no hay DM.

Línea base ya rellenada: **las 7 piezas con manifiesto son brazo A**. Ahí está, escrito, el
porqué de que no haya varianza.

---

## 👁️ LEGIBILIDAD: si se puede contar mal, el encuadre falló

**Narración correcta + visual ambiguo = el público cree lo que VE.** En "El puente" la voz dice
"dos moléculas" desde la línea 1 y aun así 4+ comentaristas "corrigieron" que eran "dos átomos":
cada molécula se lee como UNA bolita porque el O es un glow dominante y los 2 núcleos de H son
puntitos que en el celular se pierden. Regla: **en los primeros ~10 s, hacer legible la ESTRUCTURA
una vez** (señalar/etiquetar las partes que definen al objeto), aunque la narración ya lo diga.
Verificarlo en el paso de agentes preguntando "¿cuántos objetos ves y qué son?".
Detalle de guion (MX): revisar doble sentido ANTES del TTS ("míralos correrse" se leyó como albur).

## 🔒 REGLAS DURAS (no negociables)

0. **LEY ABSOLUTA DE SUBIDA (ian, 2026-08-26): NO SE SUBE NADA A NINGUNA PLATAFORMA que no sea
   4K o de bitrate estúpidamente alto (≥2160p Y ≥15 Mbps, medidos con ffprobe — el gate vive en
   `scripts/pub_comun.gate_calidad` y NO tiene override).** Origen: el primer Reel por API salió
   a 3.5 Mbps "para que pasara por el túnel" y se veía horrible; ian lo bajó a mano en minutos.
   La lección: la restricción de infraestructura NUNCA degrada el entregable — se arregla la
   infraestructura (R2/CDN), no la calidad. "Nada puede salir con calidad buena: todo debe ser
   excelencia."

   **0.1 — MIDE LO QUE LA URL ENTREGA, NO LO QUE TIENES EN DISCO (2026-08-27).** Instagram no
   recibe tu archivo: *descarga* `publicar.reel_url`. Cloudflare cachea los `.mp4` 24 h, así que
   un re-render deja la URL sirviendo el archivo VIEJO (`cf-cache-status: HIT`) y el Reel sale con
   el malo. Pasó con LA SAL: en disco había 4K/22.7 Mbps y la URL entregaba los 35 MB de la víspera;
   `gate_calidad` midió el disco, dio PASA, y se publicó basura. Cura (ya en `scripts/reels-1080.py`):
   la URL lleva `?v=<sha256[:10]>` del archivo, y **antes de publicar se hace HEAD y se compara
   `content-length` contra el tamaño local — si no coinciden, `sys.exit`**. Regla general: un gate
   que mide el artefacto local no prueba nada sobre el artefacto que el tercero consume.

1. **FÍSICA REAL, cero inventado.** PySCF/Schrödinger, fórmulas reales (Kepler, Shakura-Sunyaev,
   Δρ ab initio, MEP…). Datos reales (NASA/USGS/PDB). Lo evocativo se ETIQUETA. El wow EMERGE de
   la corrección. La credibilidad es el pilar (un químico valida en público). **La forma EMERGE de
   la física** (MD/Δρ real), nunca se pre-setea el final (pre-setear = trampa).
2. **4K SIEMPRE.** Vertical (reels) 2160×3840, horizontal 3840×2160. 10-bit (`yuv420p10le`) + NVENC.
   1080 solo como preview, jamás entregable. 60 fps donde aplique (cine 24; acción 60 — confirmar por pieza).
3. **Español mexicano.** tú/tienes/eleva. NUNCA voseo (vos/tenés/elevás). En copy, voz y comentarios.
4. **Color = SATURACIÓN, no brillo.** Más color se logra BAJANDO brillo y subiendo saturación, no
   sumando luz. La paleta del ganador manda (oro+morado de V2, no cian nuevo).
5. **La CÁMARA VIAJA.** Fly-through / órbita / clavado — viajes deliberados, PUROS en t
   (`playShots` + `camera-shots.ts`). NUNCA casi fija. Hay MOVIMIENTO/interacción durante TODO el
   video — nunca objetos quietos y separados 2/3 del tiempo. Cortes secos motivados (C0), no crossfades.
6. **Subtítulos = formato de la SERIE.** Calca el ASS del ganador (Outfit Thin SemiBold, caja, fade,
   blur, MarginV del formato). NO karaoke por palabra nuevo. ≤~40 caracteres/línea, **confirmado en
   still 4K real** (a 1080 no se ve el desborde).
7. **El enlace ES LA NUBE (Δρ), NO una línea.** Una línea engaña. El enlace se muestra como la
   redistribución real de carga.
8. **1 objeto principal, fondo negro real**, PANTALLA COMPLETA (cero letterbox 2.39:1 en el
   entregable, cero void muerto), escala por referencia + parallax. Ver `docs/FILOSOFIA-CINE.md` +
   `docs/DOCTRINA-COLOR.md` antes de tocar cine/color.

---

## 🔬 LA FÍSICA (todo real, etiquetado)

- **Δρ deformación** = ρ(molécula) − ρ(promolécula): el enlace desnudo. La ρ total es confeti (los
  cores entierran el enlace). UHF para tripletes (O₂), RHF singletes.
- **3ª nube**: espín (violeta, el imán) en O₂; en enlace múltiple singlete, la ρ de los MOs π
  (clasificados por armónico azimutal |m|=1). En H₂O = PARES LIBRES (1b1 + 3a1, las "orejas").
- **π split** (`precompute-pi-split.py`): los DOS π de un triple son orbitales separados y
  perpendiculares → 2 colores.
- **Capas K/L**: la nube del átomo aislado (ρ·r² inverse-CDF) muestra las capas reales.
- **Gate del artefacto**: RHF estirado acumula carga espuria al centro → el campo del enlace solo se
  REVELA con mr<1.7-1.8 (traslape real).
- **bondMass** (densidad en el centro del enlace) = el brillo que crece al formarse. **zpv ±2.5%**:
  la molécula nunca está quieta.
- **Campo eléctrico (2 moléculas)**: MEP real V=Σ Z/|r−R| − ∫ρ/|r−r'| (int1e_grids), E=−∇V →
  formato BondEField, líneas CONTINUAS (paran en campo débil + `_smooth`), concentran en núcleos.
- **GATE de física por pieza** (el observable manda ANTES del full): μ, Re, ⟨S²⟩, E_enlace vs
  experimento. Si μ no es de fiar (dipolo diminuto: CO invierte el signo; HCl sobreestima), **verifica
  la GEOMETRÍA (Re) en su lugar** y cuenta la paradoja como parte de la historia.

## 🎨 DIRECCIÓN DE ARTE (reglas ganadas a sangre)

1. **"El polvo es real, se queda — solo ayudar a visualizarlo"**: la estructura EMERGE del polvo
   (pesos en el shader), nunca se dibuja encima.
2. **Sprites GRANDES y TENUES** (Bloom threshold bajo, los picos REVIENTAN) = densidad LUMINOSA
   continua. Sprites chicos + umbral alto = confeti duro (regresión de N₂ que O₂ ya había resuelto).
3. **Regiones de color**: cada color es dueño de un LUGAR (polos/cinturón π/puente σ/vaciado). Colores
   mezclados espacialmente = caos bonito sin orden.
4. **Estelas de flujo** = doble exposición (ghosts a R(t−Δ), brillo ∝ |dR/dt|): advección real, no adorno.
5. **Raleo del core** (uCoreThin): menos partículas pegadas al centro donde el aditivo ya saturó = master limpio.
6. **El blanco PULSA, no permanece**: uniones coreografiadas — separan y unen VARIAS veces; cada
   unión destella, cada separación respira.
7. **9:16**: el enlace VERTICAL SIEMPRE (roll=π/2). La molécula enlazada mide la MITAD que el par
   separado → acercar cámara post-fusión.
8. **Frame 1 = el pico** (portada del feed): abrir con la molécula FORMADA ardiendo. Nada de fade-in
   tímido con dos puntitos.
9. **Color por molécula** (identidad, no reciclar la paleta ciegamente): N₂ violeta, C₂ hielo/azul,
   CO brasa/carmesí, NO cian-aqua. El color sale del RELATO. Pero una pieza HERMANA reusa la del padre.

## 🕰️ SINCRONÍA NARRACIÓN ↔ ESCENA (el corazón)

- **Cada regen de voz cambia TODAS las duraciones** → recalibrar SIEMPRE: keys de bondR, fases de
  cámara, transitDim, gates de beats, DURATION = total+colchón, fades del mux, y REMAP de música.
- **La escena manda, el guion se REORDENA**: si la voz no coincide con el evento visual, se mueve la
  LÍNEA (y se regenera el TTS — es barato, ~2 min), NO el evento (el Director determinista está probado).
- El dim del contenido y la cámara **se diseñan JUNTOS por pieza** cuando el clímax no es el núcleo
  (ej. H₂O: el payoff es la molécula entera, no el buceo al O).

## ✍️ GUION FLUIDO + VOZ POR BEATS (Ian, 2026-08-26 — el oído mandó)

Ian, escuchando la voz continua: *"suena raro, se traba al hablar; el problema son las comas y
los espacios — 'echa sal al agua'… y me quedo esperando hasta que dice 'desaparece'. Tiene que
ser continuo: 'si echas un poco de sal al agua, esta desaparece'."* Dos reglas nuevas:

1. **El guion se escribe en PROSA FLUIDA, no en fragmentos telegráficos.** Cada beat es una
   oración con conectores ("si…, entonces…", "y", "hasta que"); las líneas del archivo siguen
   siendo los cortes de SUBTÍTULO, pero el TTS no debe ver un punto en cada una. Las pausas
   dramáticas las pone la ESCENA (capas/cámara), no la puntuación. Los ganadores viejos
   (fragmentos cortos, XTTS línea por línea) no se reescriben; lo nuevo sí.
2. **La unidad de síntesis es el BEAT, no la frase ni el guion entero.** Medido (LA SAL): frase
   por frase = 20 finales de oración en 77 s = "lista", no cuento; el guion entero de una vez NO
   aguanta (Fish omite el final y pide 11 GB; Cosy se detiene a los 43 s). Por beats (2-4
   líneas) la prosodia es continua, y los tiempos por línea se RECUPERAN con alineación forzada
   (faster-whisper `word_timestamps` → `segs.json`, error 0.2 s medio / 0.7 máx). Además se
   recortan silencios internos > 0.35 s (el motor obedece la puntuación; el recorte quita las trabas).

**Motores (tarjetas de HF, 2026-08-26):** XTTS-v2 = Coqui Public Model License (**NO comercial**
— la voz de los ganadores vive en zona gris); Fish `openaudio-s1-mini` = **CC-BY-NC-SA** (NO
comercial; Fish Audio vende licencia); **CosyVoice3 = Apache-2.0**. Con lo medible gana Cosy
(20/21, RTF≈1); de oído Ian prefirió Fish (semilla 43 — Fish FALLA POR SEMILLA: la 42 se comía
"En ti."). El portero de whisper sigue siendo obligatorio con cualquiera. Reporte completo:
`dist-video/_tts-shootout/continuo/REPORTE.md` (iangpu).

## 🎙️ VOZ (XTTS Matilda — gotchas ya pagados)

- `/home/ian/tts-venv/bin/python` en iangpu (torch no está en el python del sistema). One-shot, NO server.
- **XTTS LEE la puntuación**: "..." = "punto punto"; puntos a mitad de frase = "punto". Limpiar lo
  enviado al TTS (…/:/". "→coma).
- **Palabra ambigua al final** = zona de riesgo prosódico ("que tomas"→"Tomás"): reescribir.
- **Énfasis mal puesto**: acento GUÍA solo en el texto TTS ("enláce"); el guion/subs conservan la
  ortografía correcta.
- **`TAKES=4` SIEMPRE** (el default es 1 = CERO selección → sale la toma que caiga, arrastrada
  incluida; pasó en "La ley de Gauss" 2026-07-30 y Ian lo oyó: "se escucha raro, se siente lenta").
  El script se queda con la **MEDIANA**, NO con la más corta: la más corta elige siempre la versión
  atropellada y sonó "raras" en el anillo (nota en `narracion-gen.py`, 2026-07-28). `TARGET=<dur>`
  para no mover un timing ya rendido. `LINEAS=n` (NO `LINES` en zsh: es variable especial)
  regenera solo esa línea.

## ✅ VERIFICACIÓN (el OJO es el juez final)

- **Solo el MASTER/VIDEO FINAL dice la verdad.** Las sondas `renderAt` a 1080 brillan ~2× más que el
  4K real (px de sprite relativos) — "verifiqué en sonda" y el master salió negro, dos veces. Checa en
  frames del VIDEO FINAL, por TODA la timeline, no solo beats calientes.
- **El paso de agentes (§arriba) es el gate de ojo.** Además: `pantalla-verify.py` (fill: sujeto
  dominante 9:16 da 0.14-0.25 OK, flag <0.12 sostenido), `motion-verify.cjs` (congelados/teleports),
  **%quemado** (>240 en beats calientes; destello ~4% OK, pared blanca >18% = defecto),
  `critic-gate.cjs` (morado/confeti/frame-negro).
- **Ver el VIDEO antes de entregar** — VERIFY numérico NO basta; frames por toda la línea de tiempo.
- El **morado** tiene 2 causas (medir cuál): el shader, o **el GRADE** — prueba decisiva: frame del
  cache base (sin grade) vs graded; si base=negro y graded=morado, lo mete el grade, NO la escena.

## 🖥️ RENDER Y OPERACIÓN iangpu (los gotchas que cuelgan)

Receta 4K canónica y defectos conocidos: **ver CLAUDE.md** (§PIPELINE DE RENDER 4K, §DEFECTOS).
Lo específico de la serie:

- **🚀 EL 4K SE PARALELIZA — NO es "un render a la vez" (esa es una REGRESIÓN recurrente).**
  `renderAt(t)` es PURO → cada frame es independiente → embarazosamente paralelo. Para acelerar UN
  video: lanza M `render-clip.cjs` con `--nshards M --shard 0..M-1` sobre la MISMA `--out`; cada
  worker rinde su franja por stride (`i%M==shard`), índices DISJUNTOS → cero colisión de escritura →
  el video sale ~M× más rápido (2-4 workers rinden bien en la 4070 Ti de 12 GB).
- **La regla real NO es serializar — es NUNCA `pkill chrome` GLOBAL.** Ese pkill (en loops de batch
  viejos) mataba el Chrome de los renders HERMANOS → context-lost → "colisión". Cazado con telemetría
  el 2026-07-15 (no era GPU/TDR/VRAM: 987 MiB de 12282 usados). Fix, ya en el código: **matar SOLO el
  chrome PROPIO por PID** (`render-clase.cjs` LAUNCH_TRACKED/ourChromes+`process.kill`; `render-clip.cjs`
  usa playwright `browser.close()`, sin pkill). Si vuelves a poner `pkill -9 -x chrome` en un render,
  reintroduces EL bug — no lo hagas. (`render-queue.cjs` aún hace pkill global: sirve para encolar
  videos DISTINTOS uno por uno, NO para acelerar uno solo — para eso usa shards.)
- **Colisión REAL que sí pasa** (no es paralelismo, es descuido): varios render-clip SIN shard, todos
  haciendo `0..N` sobre la misma carpeta (el MISMO frame a la vez), a menudo huérfanos que un loop de
  reintento del pipeline respawnea. Eso sí se pelea. Con `--shard` los índices son disjuntos y no pasa.
- **ssh cae en $HOME** → SIEMPRE rutas absolutas o script con `cd` interno. Un `bash scripts/x.sh`
  pelón falla con "No such file or directory".
- **`pkill -f <patrón>` = SUICIDIO** si tu propio comando ssh contiene ese patrón (mata su sesión,
  exit 255, sin salida). **Mata por PID EXPLÍCITO** (`kill -9 <pid>`), o `pkill -x` (ojo: nombres
  >15 chars fallan con `-x`, usa `-f` para listar pero KILL por PID). Para matar un render:
  primero el **shell del pipeline** (tiene loop de reintento que RESPAWNEA render-clip), LUEGO los
  render-clip por PID, LUEGO chrome.
- **Crash "Execution context was destroyed"**: vite DEV (HMR) recarga la página a mitad del render →
  mata render-clip. Fix YA en `render-clip.cjs` (el motor se modificó): **freshCtx con reintentos +
  try/catch por-frame (contexto fresco) + RESUME (salta frames ya hechos, `size > BLACK`)**.
  `video.sh <id> render` reintenta la pasada completa (resumible) hasta completar.
- **HMR también produce frames STALE** (viejos) en lotes contra vite dev. Mitigación: contexto FRESCO
  por lote + **no rsync-ear source a iangpu mientras renderiza** (tu propio sync dispara el HMR). Lo
  ideal es render contra BUILD+preview estático (sin HMR); si el build falla, dev con fresh-ctx +
  verificar el VIDEO FINAL (no la sonda).
- **GOTCHA 4K de puntos**: a 2160×3840 los `gl_PointSize` quedan RELATIVAMENTE la mitad que a 1080 →
  nubes O2Cloud ralas/tenues aunque el preview 1080 se veía denso. Fix: **×1.85 el `size`** de los
  O2Cloud para 4K. Verificar densidad con stills a 4K REAL.
- Salud ANTES del 4K: C: libre (el asesino histórico), /dev/shm/frames viejos limpios (envenenan el
  RESUME), cero chromes zombis, vite vivo, `WEBGL_debug_renderer_info` = D3D12 NVIDIA (no SwiftShader).
- Entregar SIEMPRE a **/mnt/e/forja-videos** (iangpu; C al 94%) + Downloads de la laptop.

## 📦 CÁPSULA REPRODUCIBLE (obligatoria antes de publicar)

**Lección O₂ viral: se renderizó con el árbol sucio, sin commit — código IRRECUPERABLE.** Todo master
aprobado lleva cápsula ANTES de publicarse:

```bash
bash scripts/video.sh <id> capsula      # lee videos/<id>.json; audita archivos vacíos
bash scripts/video.sh <id> publicar     # empuja video + cápsula a PRIME y ATLAS
```
(El viejo `video-capsula.sh <video-id> <mol> <narVer>` sigue existiendo para las piezas
diatómicas legacy que aún no tienen manifiesto; para todo lo nuevo, `video.sh`.)

Contiene: escena (src/cinematic + entry html) · pipeline (scripts) · simulación (.bin) · guion ·
segs.json/ASS/música · audio-final.wav · MANIFIESTO.md (receta EXACTA de render + estado de git). La
voz NO se regenera (XTTS no es determinista): la cápsula carga los audios finales. **AUDITAR** tamaños
>0 de cada archivo clave (una cápsula se congeló con narración VACÍA).

## 🎵 MÚSICA

Pieza ganadora ("Casi vacío — arpegios de agua") en `dist-video/*/musica.json`. Por pieza nueva:
`musica-eterea.py` compose+master (lidio) o remap por anclas de líneas + ducking por segs.json.
Componer nueva = Workflow de compositores + jueces + refine.

## 📤 PUBLICACIÓN (el Comando — real, no inventado)

El Centro de Comando cura los videos crudos (`produccion.json`) en piezas publicables
(`catalogo.json`) vía `scripts/comando-catalogo.cjs`. Para publicar una pieza NARRADA de la serie:

1. **Master a PRIME**: `/mnt/hdd/biblioteca/moleculas/mol-<mol>-<tema>.mp4`. **Desde iangpu** (verificado
   2026-08-25: iangpu SÍ tiene llave a PRIME y a ATLAS, incluso por LAN 192.168.100.4 — la nota vieja
   "iangpu no tiene llave" era falsa y costó un intento de subir 620 MB por la laptop). PRIME va por
   Tailscale: 587 MB tardan >10 min → lanzar DETACHED con log, nunca en un ssh en foreground.
2. **El copy YA está en el manifiesto** (`publicar.copy` = título + descripción + hashtags, escrito en el
   paso 2 con el guion). `comando-catalogo.cjs` lo lee de `videos/*.json` por `publicar.pieza` — el
   `SPECIAL` del script queda solo para piezas viejas sin manifiesto. Cero edición de código por pieza.
   El copy sigue la fórmula de O₂ — un objeto con:
   `codigo` (ruta de la cápsula), `titulo`, `descripcion` (la FÓRMULA de copy de O₂: gancho "nunca
   habías…" + qué VES + wtf real + "Nada está inventado" + identidad "es el aire que respiras"),
   `hashtags[]`. Los `piece.id` salen de `produccion.json` (ej. `mol-h2o agua v2`).
3. **Regenerar el catálogo**: `node scripts/comando-catalogo.cjs` → reescribe `public/comando/catalogo.json`.
4. **Deploy QUIRÚRGICO**: rsync de los 2 JSONs (`catalogo.json` + `produccion.json`) a ATLAS
   `/mnt/hdd/forja-dist/comando/` (sin build, sin riesgo). El registro de subidas (qué plataforma,
   ediciones de copy) vive en el server (`registro.json`), la página lo fusiona por id.
5. Responder comentarios escépticos con el MÉTODO (PySCF/Schrödinger) — es marketing, fija autoridad GAIA.

---

## 📚 LECCIONES ACUMULADAS POR MOLÉCULA (el motor entra como DATOS, no reescribir maquinaria)

Confirmado desde CO en adelante: una molécula nueva entra como **una entrada en `MOLS` +
`BOND_ABINITIO` + `BOND_BEATS` + un guion**, sin tocar la maquinaria. ~2 h/pieza; el cuello real son
las iteraciones de guion y encuadre, no el cómputo.

- **Heteronucleares/iónicos (NaCl "robo", HF "tirano", HCl "ácido")**: `els:(A,B)`. Modo IÓNICO
  (`ionic:true`, solo si NO hay puente): glow por accMass, reveal desde 5.4×Re, sprites ×1.55,
  `spinMul=0`. La **trilogía del jalón** ordena 3 piezas por el número: NaCl q≈+0.98 → HF +0.35 →
  HCl +0.17. **Punto morado** = capa cerrada SIN π declarado (nube de espín vacía colapsando) →
  añadir a lista `spinMul=0`.
- **Polar covalente fuerte (CO "abrazo asesino")**: RHF invierte el signo de μ → gate por Re
  (1.105 vs 1.128 Å) y se cuenta la paradoja. Paleta brasa/carmesí propia.
- **16:9 horizontal + capa abierta (NO "mensajero")**: el motor NO era neutral al formato — `MolCameraRig`
  resta el π/2 en `!vertical && frame.o2`; `Letterbox` gana prop `pct` (4.5%, no 12.8%); ASS 16:9
  propio (Outfit 64, MarginV 130). Radical → gate con ⟨S²⟩ (0.795 vs 0.750). Falta el 2º bin
  `mol-<x>.bin` (LCAO) → la página no llega a `ready` y "falla por timeout" sin decir por qué;
  **ante timeout de `ready`, capturar `console`/`pageerror` ANTES de tocar nada.**
- **Triatómico (H₂O "agua")**: introduce el ÁNGULO. `precompute-triatomic.py`, geometría MEDIDA
  (O-H 0.9578 Å, HOH 104.478°), 3ª nube = pares libres. El engine: O2Cloud dibuja posiciones del bin
  DIRECTAS (geometría bent sola), núcleos a la geometría medida (`TRIATOMIC`/`isTri()`), saltar
  AtomCloud, thirdRing=0, spinMul=1. El clímax es la MOLÉCULA, no el núcleo → cámara y transitDim propios.
- **2 moléculas (H₂O "El puente" — wpair)**: PRIMERA vez con 2 moléculas (por eso costó). `precompute-water-approach.py`
  (dímero RHF a K=30 separaciones, Δρ real, muestreo Lagrangiano semilla fija → correspondencia entre
  frames, formato WAP2 + campo MEP). **REUSA O2Cloud/Nucleus de V1** indexado por R(t). Tomas nuevas
  en `camera-shots.ts` (twoShot/orbitOne/craneOverPair/pushToBridge/crashIn), NO cámara fija. Cámara,
  color (paleta O₂), subtítulos = de la serie. El paso de agentes cazó los dead-spots.

---

## 🚦 CHECKLIST PRE-VUELO (antes de gastar 45 min en un 4K)

- [ ] **Regla #0**: ¿abrí el CÓDIGO del último ganador y lo COPIÉ? ¿O estoy reinventando?
- [ ] Física con GATE de observable pasado (μ/Re/⟨S²⟩/E vs experimento). Cero inventado.
- [ ] `.bin` sincronizados a iangpu. Source sincronizado (SIN --delete) ANTES del build/render.
- [ ] Beats recalibrados a los segundos REALES de segs.json (tras la última regen de voz).
- [ ] Subtítulos = formato de la serie, ≤40 chars, confirmado en still 4K real.
- [ ] Cámara VIAJA (playShots), color = saturación (paleta del ganador), enlace = nube.
- [ ] iangpu sano: renders con `--shard` (paralelos, disjuntos) o huérfanos SIN shard barridos; C:
      libre, GPU real (D3D12 NVIDIA), vite vivo. NUNCA `pkill chrome` global (mata los hermanos).
- [ ] Tras render: **paso de agentes** (~50 frames, ~5 agentes VEN y califican) → arreglar dead-spots → re-render.
- [ ] Verificar el VIDEO FINAL (no la sonda) por TODA la timeline.
- [ ] 4K 10-bit HEVC + h264 a /mnt/e/forja-videos + Downloads. Cápsula hecha y AUDITADA.
- [ ] Publicado: SPECIAL + cápsula + comando-catalogo.cjs + rsync 2 JSONs a ATLAS.
