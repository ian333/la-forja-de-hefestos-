# PROCESO — Serie de Enlaces (la máquina de cine físico)

> Runbook completo, destilado de la producción de O₂ (160+ likes, 276 guardados,
> +168 seguidores de un reel) y N₂ (18 versiones de iteración → master 4K publicado).
> Con esto, F₂/H₂/cadenas deben salir en HORAS. Última actualización: 2026-07-02.

---

## 0. La fórmula (por qué funciona)

**Contenido**: física REAL (PySCF, cero inventado) + gancho "nunca habías visto..." +
narración que NOMBRA lo que ves + un "wtf" real por molécula (O₂ = es un imán;
N₂ = el candado que alimenta al mundo) + identidad ("es el aire que respiras").

**Los datos que lo prueban** (O₂ en IG): ratio guardados/likes ~39% = contenido de
ENSEÑANZA (la gente lo atesora); 96.6% no-seguidores = el algoritmo lo empuja frío
y convierte; comentarios de asombro casi espiritual + escépticos ("¿no será IA?") =
oportunidad de fijar comentario explicando el método → autoridad GAIA.

**Estética**: cerebro rápido decide el scroll en <0.5s con CONTRASTE — sujeto
dominante contra negro puro, sostenido cada segundo. Cerebro lento se queda por el
lazo narrativo. Los guardados vienen de lo didáctico (prender/apagar enlaces).

---

## 1. Pipeline (un comando por paso, `<mol>` = o2|n2|f2|h2)

```
1. FÍSICA        python3 scripts/precompute-bond-abinitio.py <mol>        (~7 min local)
2. π-SPLIT       python3 scripts/precompute-pi-split.py <mol>             (~40 s, triples/dobles)
3. ÁTOMO         python3 scripts/precompute-atom-cloud.py <mol>           (~30 s)
4. GUION         scripts/guiones/<mol>.txt  (frases CORTAS, 1/línea, CON acentos)
5. VOZ           LINES/TAKES/TARGET ... narracion-gen.py <mol>            (iangpu, tts-venv)
6. AUDIO         python3 scripts/assemble-narracion.py <mol>              (→ segs.json)
7. RECALIBRAR    fases de cámara/dims/bondR a los beats de segs.json      (ver §4)
8. SUBS          karaoke-ass.py segs.json ... --w 2160 --h 3840 --phrase
9. MÚSICA        remap musica.json a segs nuevos → musica-viaje.py midi/master/mix
10. RENDER 1080  MOL=<mol> DPR=1 FPS=30 BATCH=60 FRAMES_DIR=/dev/shm/...  o2-clip.cjs
11. VERIFICAR    pantalla-verify.py + motion-verify.cjs + %quemado + OJO del user
12. (aprueba) 4K MOL=<mol> DPR=2 ... → mux HEVC10 40Mbps → Downloads ×2
13. PUBLICAR     PRIME biblioteca/moleculas/ + SPECIAL en comando-catalogo.cjs
                 + comando-scan + comando-catalogo + rsync 2 JSONs a ATLAS
```

Los `.bin` van a `public/precomputed/` y se sincronizan a iangpu ANTES de renderizar.

---

## 2. La física (todo real, etiquetado)

- **Δρ deformación** = ρ(molécula) − ρ(promolécula): el enlace desnudo. La ρ total
  es confeti (los cores entierran el enlace). UHF para tripletes (O₂), RHF singletes.
- **3ª nube**: espín (violeta, el imán) en O₂; en singletes con enlace múltiple el
  slot vacío lleva la **ρ de los MOs π** (clasificados por armónico azimutal |m|=1).
- **π split**: los DOS π de un triple son orbitales separados y perpendiculares —
  `precompute-pi-split.py` calcula a cuál pertenece cada partícula → 2 colores.
- **Capas K/L**: la nube del átomo aislado (ρ·r² inverse-CDF) muestra las capas
  reales — se colorean por radio (core dorado <0.35 bohr, valencia violeta).
- **Gate del artefacto**: RHF estirado acumula carga espuria al centro → el campo
  del enlace solo se REVELA con mr<1.7-1.8 (cuando el traslape es real).
- **bondMass** (densidad en el centro del enlace) = el brillo que crece al formarse.
- **zpv** ±2.5%: la molécula nunca está quieta (amplitud exagerada, fenómeno real).

## 3. Dirección de arte (las reglas ganadas a sangre)

1. **"El polvo es real, se queda — solo ayudar a visualizarlo"**: la estructura
   EMERGE del polvo (pesos en el shader), nunca se dibuja encima.
2. **Sprites GRANDES y TENUES** (0.22/0.20/0.24, Bloom 1.15/thr 0.20/r 0.9) =
   densidad LUMINOSA continua. Sprites chicos + umbral alto = confeti duro (regresión
   que N₂ sufrió y O₂ ya había resuelto). NO tocar esta receta.
3. **Regiones de color** (la lección oculta de O₂): cada color es dueño de un lugar.
   N₂: rojo=polos (pares libres, ámbar rojo [1,0.36,0.10]), violeta=cinturón π
   [0.80,0.34,1.0], rosa=π² [1,0.34,0.62], oro/blanco=puente σ, azul=vaciado afuera.
   Colores MEZCLADOS espacialmente = caos bonito pero sin orden.
4. **El anillo π emergente**: uRing en el vertex shader pesa las partículas reales
   cercanas al corazón del toro (r≈1.05 bohr, medido de los datos).
5. **Estelas de flujo** = doble exposición (2 ghosts a R(t−0.1)/R(t−0.22), brillo
   ∝|dR/dt|): la advección real visible. Motion-blur del dato, no adorno.
6. **Raleo del core** (uCoreThin): donde el aditivo ya saturó, capas extra solo
   ensucian al compresor. Menos partículas pegadas al centro = master limpio.
7. **El blanco PULSA, no permanece**: bondR() coreografiado — la separación y la
   unión suceden VARIAS veces; cada unión destella, cada separación respira.
8. **9:16**: el enlace VERTICAL SIEMPRE (roll=π/2) — horizontal tapa el fill en 0.15.
   La molécula enlazada mide la MITAD que el par separado → acercar cámara post-fusión.
9. **Espacio continuo, CERO cortes**: curvas C0/C1 en todas las costuras de cámara.
10. **Frame 1 = el pico** (portada del feed): abrir con la molécula FORMADA ardiendo
    y separarla en cámara. Nada de fade-in tímido con dos puntitos.

## 4. Sincronía narración ↔ escena (el corazón del proceso)

- **Cada regen de voz cambia TODAS las duraciones** → recalibrar SIEMPRE:
  bondR keys (uniones en "se funden"/pre-explicador/"el agarre"), fases de cámara
  (clavado en "ven conmigo", núcleo en "el corazón", salida en "casi vacío"),
  transitDim, BOND_BEATS/toggles, O2_FILM_DURATION = total+4.5s, fades del mux,
  y REMAP de música (anclas inicio-de-línea vieja→nueva, interp lineal).
- **El explicador** σ/π¹/π² (prender/apagar + etiqueta grande de color) va clavado
  a "son tres a la vez" — 2.0s por enlace mínimo para que se identifiquen.
- La molécula debe estar FORMADA durante el explicador y el viaje al núcleo.

## 5. Voz (XTTS Matilda — los gotchas, todos ya pagados)

- `/home/ian/tts-venv/bin/python` en iangpu (torch no está en el python del sistema).
- **XTTS LEE la puntuación**: "..." = "punto punto"; puntos A MITAD de frase = "punto".
  narracion-gen limpia TODO lo enviado al TTS (…/:/". "→coma, punto final fuera).
- **Palabras ambiguas al final**: "que tomas" → dice "Tomás". Reescribir el guion
  ("que das"). El final de frase es zona de riesgo prosódico.
- **Énfasis mal puesto** ("enlacE"): acento GUÍA solo en el texto TTS ("enláce") —
  el guion/subs conservan la ortografía correcta.
- **Vocal alargada** = duración extra → `TAKES=4` y elegir la MÁS CORTA.
- **No mover un timing ya rendido**: `TARGET=<dur>` elige la toma más cercana a la
  duración vieja → solo se re-mezcla audio, la base de video se conserva.
- `LINES=4` regenera solo esa línea. El recorte de balbuceo es por duración esperada
  (0.38 s/palabra) — no corta pausas internas.

## 6. Verificación (antes de gastar 4K — y el OJO del user es el juez final)

- `pantalla-verify.py <video>`: fill (caja de píxeles VISIBLES; umbral calibrado a
  ojo: sujeto centrado 9:16 que domina da 0.14-0.25 OK; flag <0.12 sostenido) +
  frames flageados extraídos para VERLOS. Meta: sujeto dominante, no 100% lleno.
- `motion-verify.cjs --fps 30`: congelados/teletransportes (los "teleports" del
  clavado/warp son velocidad legítima — verificar con el ojo).
- **%quemado**: extraer frames de los beats calientes y medir %píxeles>240. El
  choque puede destellar (~4%); una PARED blanca sostenida (>18%) es defecto.
- Los frames extraídos son para el ANÁLISIS DEL AGENTE — mirarlos de verdad.

## 7. Render y operación iangpu

- Salud ANTES del 4K: C: libre (el asesino histórico), RAM, /dev/shm limpio de
  frames viejos (¡envenenan el RESUME!), cero chromes zombis, vite:5010 vivo.
- `o2-clip.cjs`: BATCH=60, FRAMES a /dev/shm, AUTO-RECOVERY (reintenta frame con
  contexto fresco Y relanza Chrome entero si murió) + RESUME=1 para continuar.
- 4K DPR=2: ~0.26 s/frame (9 min los 2100 frames) con el box sano.
- ssh a iangpu SIEMPRE con rutas absolutas (cae en $HOME). pkill -f con tu propio
  patrón = suicidio (exit 255) — matar por PID o pkill -x. NO pkills amplios si el
  user está en VS Code remoto.
- Mux master: `hevc_nvenc -profile:v main10 -rc vbr -b:v 40M -maxrate 55M -pix_fmt
  p010le -tag:v hvc1` (CQ se topa con el techo de la fuente; forzar bitrate da el
  colchón anti-recompresión de plataformas). Fades: in 0.4s / out 1.3s (el LOOP).
- Entregar SIEMPRE a Downloads de LAS DOS PCs.

## 8. Publicación

- Master → PRIME `/mnt/hdd/biblioteca/moleculas/mol-<mol>-<tema>.mp4` (desde la
  laptop; iangpu no tiene llave a PRIME).
- Título/descripción → `SPECIAL` en `comando-catalogo.cjs` (fórmula O₂ de copy).
- `comando-scan.cjs` + `comando-catalogo.cjs` → deploy QUIRÚRGICO: rsync de los
  2 JSONs a ATLAS `/mnt/hdd/forja-dist/comando/` (sin build, sin riesgo).
- Responder comentarios escépticos con el método (PySCF/Schrödinger) — es marketing.

## 9. Música (workflow de agentes — ya compuesta, solo re-mapear)

- La pieza ganadora ("Casi vacío — arpegios de agua", 94 notas) vive en
  `dist-video/n2v2-narracion/musica.json`. Para cada mol/timing nuevo: remap por
  anclas de líneas + `musica-viaje.py midi/master/mix` (ducking por segs.json).
- Componer nueva pieza = Workflow de 3 compositores + 6 jueces + refine (~10 min).

## 10. El arco narrativo que quedó (plantilla para F₂/H₂)

FORMADA ardiendo (pico) → se SEPARA en cámara → individuos (capas K/L) → se buscan
→ UNIÓN #1 ("se funden", estelas de flujo) → rebote → UNIÓN #2 → explicador de
enlaces (prender/apagar σ/π¹/π², 2s c/u) → respiro → UNIÓN #3 snap ("el agarre")
→ CLAVADO al núcleo (túnel, "el brillo ES la carga") → núcleo íntimo (protones/
neutrones, zpv, lo más bello) → salida warp ("casi vacío") → regreso a color →
vertical + fade = LOOP con el frame 1.

---

## 11 · CÁPSULA REPRODUCIBLE (obligatoria desde 2026-07-06)

**Lección O₂ viral (33.5K vistas): se renderizó con el árbol sucio, sin commit — IRRECUPERABLE.**
Todo master aprobado lleva cápsula ANTES de publicarse:

```bash
bash scripts/video-capsula.sh <video-id> <mol> <narVer>       # ej: mol-f2-paradoja f2 f2v2
rsync -a dist-video/_capsulas/<id>-capsula.tar.gz ian@100.110.244.20:/mnt/hdd/biblioteca/moleculas/_code/
# + campo codigo: 'moleculas/_code/<id>-capsula.tar.gz' en el SPECIAL de comando-catalogo.cjs
# + regenerar catálogo y desplegar (botón ⚙ código aparece en el Comando)
```

Contiene: escena (src/cinematic + entry html) · pipeline completo (scripts) · simulación
PySCF (.bin) · guion · segs.json/ASS/música · audio-final.wav · MANIFIESTO.md con la
receta EXACTA de render y el estado de git al capturar. La voz no se regenera (XTTS no
es determinista): la cápsula carga los audios finales.

El O₂ viral original quedó archivado (video only, código perdido) en
PRIME:/mnt/hdd/biblioteca/moleculas/_archivo/O2-NARRADO-final.mp4 + NOTA.
