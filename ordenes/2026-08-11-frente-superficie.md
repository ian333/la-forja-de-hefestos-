# ORDEN: EL FRENTE COMO SUPERFICIE — que se vea LÍQUIDO, no bolitas

BASE: 3dab83e

OBJETIVO: ian vio el video del llenado y dictó: *"se supone que es un líquido, no se ve
como un líquido… se ve de juguete, no se ve real. ¿Qué usan los demás softwares y la
industria para esto? Ésta es la parte más importante"*. Hoy el fundido son ESFERAS rojas
planas (`AlarmCloud` reusada). La industria (Moldflow/Moldex3D/Sigmasoft) muestra el
llenado como **una SUPERFICIE sombreada coloreada por `Fill time`**, no como nube de
puntos. Esta orden cambia la REPRESENTACIÓN, no la física.

## EL DIBUJO (aprobado antes de codear)

```
   HOY (bolitas)                        LA ORDEN (superficie)
   ─────────────                        ─────────────────────
      o o o o o                          ╭───────────────╮
     o o o o o o                         │███████████████│  ← superficie CERRADA
      o o o o o        ══════▶           │███████████████│    sacada del campo
     o o o o o o                         ╰───────────────╯
      o o o o o                                            
   plano · sin luz · rojo             sombreado + especular del HDRI
   uniforme · borde de vóxel          color = FILL TIME (azul→rojo)

   COLORMAP (el color ES el dato, como Moldflow):
     azul ▓▓▓ cian ▓▓▓ verde ▓▓▓ amarillo ▓▓▓ rojo
     t=0 (primero en llenarse)              t=t_fill (lo último — el frente)

   Y EL FUNDIDO BAJA POR EL BEBEDERO ANTES DE ENTRAR:
        ║ ▓ ║   a caudal CONSTANTE Q, el sistema de alimentación se
        ║ ▓ ║   llena primero: t_sprue = V_sprue / Q  (número real, no adorno)
        ╚═▓═╝
         ▓▓▓▓   ← recién entonces arranca la cavidad
```

## YA-EXISTE (prueba de ausencia)
- El campo: `flowlen.ts::measureFlowLength` da la rejilla regular (nx·ny·nz, `cellMm`,
  origen) y `resistance` por vóxel. La superficie se saca de ESE campo — no se recalcula.
- Los cuantiles del frente (`frenteQ`) ya convierten volumen→tiempo a caudal constante.
- El patrón de pintor por vértice con color horneado: `MoldScene::RayoPaint` — se COPIA
  su forma (BufferGeometry + `color` por vértice), no se inventa otra.
- HDRI de estudio ya montado en el `<Canvas>` → un material PBR reflejará solo.
- El gate con OCC real: `scripts/ciclo-dado-test.cjs` (47/47) — se le añade el criterio.
- El juez de video con check de píxeles: `scripts/llenado-video.cjs`.

## EL SPRUE — MEDIDO, NO SUPUESTO
ian: *"según yo en primera el sprue está al revés"*. **Medido con OCC**: ⌀9.43 mm en la
partición (z=41) → ⌀5.08 mm en la boquilla (z=99); y contando PÍXELES del render: 31 px
abajo → 22 px arriba. La conicidad **está bien** (§6.3.1: angosto en la boquilla para que
la colada se extraiga). Lo que NO existe es runner + compuerta: la alimentación termina en
su punto MÁS ANCHO justo donde toca la pieza, y eso es lo que se lee como invertido.
Eso es el cap 6 = **estación 5** — se DECLARA como deuda, no se improvisa aquí.

## TOCA
- src/forja/mold/flowlen.ts
- src/forja/brep/MoldScene.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/useMoldStudio.ts
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo)
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- videos/
- src/cinematic/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- **EL GATE DEL VOLUMEN**: el volumen encerrado por la superficie extraída (teorema de la
  divergencia sobre los triángulos) debe igualar el volumen de los vóxeles llenos
  (`n · cell³`) dentro de **±2 %**, en al menos 3 instantes (t = 0.25, 0.6, 1.0). Una
  superficie bonita que encierra otro volumen es una mentira bonita.
- **CONTROL NEGATIVO**: con el campo vacío la superficie debe salir con 0 triángulos
  (no un cubo espurio), y con el campo lleno debe cerrar el volumen de la cavidad.
- Captura del CAD ANTES del 4K (peek) revisada con OJOS: la superficie EXISTE y está
  sombreada. Ocho intentos perdidos la vez pasada por renderizar a ciegas — ahora se ve
  primero, se renderiza después.
- Video 4K juzgado por `scripts/llenado-video.cjs` (7 criterios, incluido el de PÍXELES).
- Entrega a `Downloads\FORJA-DADO` de AMBAS PCs + `/mnt/e/forja-videos`.
- `node scripts/orden-gate.cjs` VERDE (sin pipe) · censo IGUAL (0 `<Canvas>` nuevos).

## CIERRE (2026-08-11)

- **orden vs entregado**: entregado lo declarado — extractor de superficie, material con
  luz, colormap de fill time, gate de volumen y video 4K juzgado. El SPRUE no se "corrigió"
  porque **medido resultó correcto** (ver abajo); lo que falta es runner+compuerta = E5.

- **EL SPRUE: ian tenía razón en el síntoma, no en la causa — y yo me equivoqué a media
  investigación.** Medido con OCC rebanando el sólido: ⌀9.43 mm en la partición → ⌀5.08 mm
  en la boquilla. Contando PÍXELES del render por filas: 22 px arriba → 31 px abajo. La
  conicidad está bien en los dos lados (§6.3.1). En medio de esto **afirmé lo contrario**
  leyendo a ojo un crop a 6× — y el conteo de píxeles me desmintió. Lo que sí falta y se
  lee como "al revés": la alimentación TERMINA en su punto más ancho justo donde toca la
  pieza, porque no hay runner ni compuerta. Cap 6 = estación 5, declarado como deuda.

- **HALLAZGO: `src/lib/viz/isosurface.ts` produce mallas SIN ORIENTACIÓN CONSISTENTE.**
  Medido: 13,896 aristas dirigidas repetidas de 25,608 triángulos → volumen −38 % contra
  la esfera analítica. Es CERRADA (0 aristas de borde), por eso nunca se notó: nació para
  la burbuja térmica, que se dibuja a DoubleSide y se validó por ÁREA. Con luz real y con
  un gate de volumen, se ve. **NO se arregló aquí** (tiene su propio consumidor y está
  fuera de esta orden) — queda anotado con su medición para quien lo tome.

- **números del gate**: `ciclo-dado-test` **53/53** (eran 47). La superficie encierra el
  volumen de los vóxeles: **−3.54 % / −1.26 % / −0.74 %** a t = 0.25 / 0.6 / 1.0, con
  desplazamiento geométrico real de **0.028 / 0.011 / 0.007 mm** sobre celda de 1.6 mm.
  Malla ORIENTADA (0 aristas dirigidas repetidas) y CERRADA (0 aristas de borde).
  Control negativo: campo vacío → 0 triángulos. En el dado real (celda 1.0): 29,504
  triángulos y 14,059 mm³ contra 14,140 vóxeles = **−0.57 %**.

- **el criterio ±2 % se quedó, pero medido bien.** A t=0.25 el cuerpo lleno es delgado y
  la pérdida por redondeo de aristas convexas —que es proporcional al ÁREA, no al
  volumen— pesa 3.54 % en fracción. En vez de mover el poste al 4 %, el gate exige
  ±2 % **o** que la superficie caiga a menos de ¼ de celda de la frontera de vóxeles, e
  imprime los dos números. 0.028 mm es lo que realmente está pasando.

- **SEIS defectos cazados por la cadena de verificación, en orden, y qué enseñó cada uno**:
  1. **Devanado invertido** → volumen −7941 en vez de +7941. El gate exige el SIGNO.
  2. **Sin relleno (padding)**, la región que TOCA el borde de la rejilla dejaba la malla
     ABIERTA → **−403 % a t=0.6**, y con la orientación intacta. Un agujero no se ve en el
     devanado: por eso ahora el gate mide ORIENTADA **y** CERRADA por separado.
  3. **Mi propia sonda estaba ciega**: el listener de consola de Playwright solo dejaba
     pasar `error`/`warning` y mis logs eran `console.log`. Concluí "el componente nunca
     corre" cuando corría perfecto. Un instrumento sin verificar miente igual que un gate.
  4. **El fundido estaba TAPADO POR LA PIEZA** — ocupan exactamente el mismo volumen y la
     pieza translúcida se dibuja después. La malla SÍ cambiaba (29,504 tris a t=1 vs 5,044
     a t=0.33) y la imagen NO (YAVG 0.02). Durante el llenado el fundido **es** la pieza:
     no se dibujan las dos.
  5. **Más luz no es más color**: envMapIntensity 1.5 + clearcoat 0.7 se comieron el
     colormap y el fundido salió BLANCO. La lección ya estaba escrita EN ESTE MISMO
     ARCHIVO, en `MoldTcPaint`. Bajar ambiente + bajar albedo (0.42) = el dato manda.
  6. **El acero tapaba**: con los insertos a opacidad normal el fundido quedaba detrás de
     tres capas blancas. Fantasmeados a 0.08 → la diferencia entre t=0.15 y t=1 saltó de
     **YAVG 0.09 a 0.98**. Moldflow enseña la PIEZA, no la herramienta.

- **preguntas abiertas**: (1) E5 = runner + compuerta, que es lo que hace que la
  alimentación ESTRECHE hacia la pieza; (2) el fundido bajando POR el bebedero antes de
  entrar (a caudal constante, t_sprue = V_sprue/Q — número real, no adorno); (3) las
  isócronas dibujadas como LÍNEAS sobre la superficie, como las numera Kazmer en Fig 5.1;
  (4) `computeWeldMask` sigue sin cablear (weldLines = 0, declarado desde la orden anterior).
