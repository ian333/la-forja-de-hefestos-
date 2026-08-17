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
2. GUION           scripts/guiones/<mol>.txt — frases CORTAS, 1/línea, español MX, CON acentos.
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

## 👁️ LEGIBILIDAD: si se puede contar mal, el encuadre falló

**Narración correcta + visual ambiguo = el público cree lo que VE.** En "El puente" la voz dice
"dos moléculas" desde la línea 1 y aun así 4+ comentaristas "corrigieron" que eran "dos átomos":
cada molécula se lee como UNA bolita porque el O es un glow dominante y los 2 núcleos de H son
puntitos que en el celular se pierden. Regla: **en los primeros ~10 s, hacer legible la ESTRUCTURA
una vez** (señalar/etiquetar las partes que definen al objeto), aunque la narración ya lo diga.
Verificarlo en el paso de agentes preguntando "¿cuántos objetos ves y qué son?".
Detalle de guion (MX): revisar doble sentido ANTES del TTS ("míralos correrse" se leyó como albur).

## 🔒 REGLAS DURAS (no negociables)

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

1. **Master a PRIME**: `/mnt/hdd/biblioteca/moleculas/mol-<mol>-<tema>.mp4` (desde la laptop; iangpu
   no tiene llave a PRIME).
2. **Añadir el `SPECIAL`** en `scripts/comando-catalogo.cjs` — un objeto por `piece.id` con:
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
