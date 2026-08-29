# ATLAS DE INTERFACES — de dónde va a salir el Foco de La Forja

> **Para qué existe:** ian quiere elegir cómo se ve nuestra interfaz mirando las que ya
> funcionan. Cada ficha dice **qué hace**, **qué le robo** y **qué le dejo** — con la razón,
> no el gusto. Su favorita: **Horizon Zero Dawn**.
> La doctrina (los dos idiomas, el vocabulario, las direcciones con mi voto) vive en
> [`DOCTRINA-FOCO.md`](./DOCTRINA-FOCO.md). Ese **decide**; este **muestra**.

## ⚠ Léase primero: qué se pudo conseguir y qué no

Bajé **52 capturas de 12 juegos** del CDN oficial de Steam, con el nombre verificado contra la
API pública de la tienda. Al mirarlas una por una salió el problema: **los screenshots de tienda
son material de marketing y casi todos esconden el HUD**.

De 52, **solo 6 muestran interfaz de verdad**. Este atlas se parte en dos por eso:

- **§1 — LAS QUE SÍ TIENEN INTERFAZ.** Las miras y aprendes algo.
- **§2 — LAS QUE NO.** El juego importa, pero su interfaz **hay que verla en video**. Ahí la
  imagen sirve para el arte y la paleta, no para la UI, y así está rotulada.

Las bases de datos de UI (Game UI Database, Interface In Game) tienen justo lo que falta, pero
**responden 403** a la descarga automática: van enlazadas al final para abrirlas a mano.

---

# §1 · LAS QUE SÍ TIENEN INTERFAZ

## 1.1 · HARDSPACE: SHIPBREAKER — *el hallazgo de esta investigación* ⭐

![Hardspace Shipbreaker — el escáner con pestañas de lente y leyenda por sistema](referencias-hud/shipbreaker-4.jpg)

**Esta es la imagen más importante del atlas.** Un escáner sobre un objeto industrial —
literalmente nuestro caso — que resuelve tres cosas que tenemos abiertas:

1. **Pestañas de lente:** `STRUCTURAL · SYSTEMS · OBJECTS`. Un objeto, tres lecturas. Es lo que
   necesita nuestro Foco cuando tenga espesor, expulsores y partición: no tres botones sueltos,
   **tres lentes de lo mismo**.
2. **Leyenda donde el color ES la clave:** eléctrico verde, combustible rojo, refrigerante cian,
   radiación magenta, reactante morado. El color no adorna, se lee.
3. **El resto queda en alambre, no desaparece.** Sigues viendo la nave completa mientras miras
   un sistema. Nuestra pieza debería hacer exactamente eso bajo el Foco.

También trae **un reloj (0:30)**: el escaneo es temporal. Interesante, pero para un CAD lo dejo:
aquí nadie quiere que sus cotas se apaguen solas.

![Hardspace Shipbreaker — el HUD del casco](referencias-hud/shipbreaker-2.jpg)

**El HUD del casco.** Todo el instrumental —empuje, salud, traje, combustible, O₂, temperatura
del cortador— vive **abajo y en los bordes**; arriba, el nombre de la nave y su nivel de peligro.
**El centro queda libre para el trabajo.**

**Qué le robo:** las pestañas de lente · el objeto en alambre bajo la capa activa · **el centro
es de la pieza, los datos viven en el borde**.
**Qué le dejo:** el amarillo industrial (precioso, pero en nuestro sistema el cálido ya significa
"esto exige tu atención") y el temporizador.

---

## 1.2 · CYBERPUNK 2077 — *cómo se ordenan veinte campos sin saturar*

![Cyberpunk 2077 — panel de personalización](referencias-hud/cyberpunk-3.jpg)

**Qué se ve.** Un panel con ~10 campos que no se siente apretado: etiquetas chiquitas en
versalitas a la izquierda, controles alineados a una columna a la derecha, un solo rojo para lo
activo, fondo casi negro, y **muchísimo aire** entre renglones.

**Qué le robo:** la **disciplina tipográfica** — etiqueta pequeña y apagada, valor claro, todo a
una rejilla. Nuestro dictamen es puro texto y así es como se ordena.
**Qué le dejo:** el rojo como color de sistema (para nosotros el rojo es **violación**) y los
biseles decorativos.

---

## 1.3 · STELLARIS — *la advertencia, no el modelo*

![Stellaris — la interfaz que es pura tabla](referencias-hud/stellaris-1.jpg)

**Qué se ve.** Información densísima repartida en seis paneles simultáneos, cero diégesis, cada
dato con su ventana.

**Está aquí como advertencia.** Es exactamente en lo que se convierte un CAD cuando cada dato
pide su marco — y es lo que ian vio en La Forja y llamó basura. La regla que sale de aquí ya
está en producción: **una ventana sin nada que decir no existe**.

---

## 1.4 · SUBNAUTICA — *el instrumento en la mano*

![Subnautica — herramientas con su propia pantallita](referencias-hud/subnautica-2.jpg)

**Qué se ve.** Las herramientas que llevas en las manos traen **su propia pantallita encendida**,
con su color y su barra. No hay HUD flotante: el dato está en el objeto que lo produce.

**Qué le robo:** que el dato viva **en la cosa que lo mide**. Nuestra cota ya lo hace (vive sobre
la arista que mide) y esto lo confirma como principio, no como capricho.

---

# §2 · LAS QUE NO TIENEN CAPTURA DE INTERFAZ

De estos juegos la tienda **no publica una sola captura con el HUD encendido**. Las imágenes
sirven para leer su **arte y su paleta**; la interfaz hay que verla en movimiento (§3).

## 2.1 · HORIZON ZERO DAWN — *el Foco* ⭐ la favorita de ian

![Horizon Zero Dawn — arte, sin HUD](referencias-hud/horizon-2.jpg)
![Horizon Zero Dawn — arte, sin HUD](referencias-hud/horizon-4.jpg)

*(Arriba: arte del juego. **El Foco no está encendido en ninguna captura de la tienda** — para
verlo funcionando, el video de §3.)*

**Qué hace su interfaz.** Aloy lleva un aparato de realidad aumentada; al activarlo la máquina
se pinta de azul frío y sus componentes vulnerables saltan en amarillo, y al pasar sobre cada
pieza te dice qué es y por dónde se rompe. La otra interfaz del juego está dibujada como **tiza
y pintura rupestre**: lo holográfico es *lo que la máquina sabe del mundo*, la tiza es *lo que
el jugador necesita*. **No se parecen en nada a propósito** — por eso nunca dudas cuál es cuál.

**Qué le robo:** la separación de idiomas (**EL FOCO** sobre la pieza / **EL BANCO** al costado)
· el color con significado (frío = medido, cálido = atención) · la información **acostada sobre
el objeto**, no al lado. *Ya está en producción.*
**Qué le dejo:** el amarillo saturado en todo; con 30 cotas deja de ser señal.

## 2.2 · DEATH STRANDING — *el odradek*

![Death Stranding — arte, sin escáner desplegado](referencias-hud/deathstr-4.jpg)

**Qué hace su interfaz.** El escáner es un aparato **físico** en el hombro: se despliega, gira y
marca el terreno. La información aparece porque una máquina la está produciendo, y lo ves.

**Qué le robo:** **EL BARRIDO** — la información no aparece, **se revela**. Es mi apuesta más
barata: una animación de 400 ms sobre lo que ya tenemos.

## 2.3 · ARMORED CORE VI · TITANFALL 2 — *robots, por pedido de ian*

![Armored Core VI — arte, sin HUD](referencias-hud/armoredcore-2.jpg)
![Titanfall 2 — arte, sin HUD](referencias-hud/titanfall2-3.jpg)

**Qué hacen sus interfaces.** Armored Core: retícula fina, **mucho vacío**, tipografía técnica
diminuta, datos en las esquinas, el centro para el combate. Titanfall: al entrar al titán la
interfaz **cambia de idioma completo** — te habla desde adentro de la máquina.

**Qué les robo:** el **vacío como recurso** (lo contrario de los cuatro paneles vacíos que
teníamos) · y que entrar a un modo **cambie todo el lenguaje visual**, no solo encienda un panel.
Nuestro Foco debe sentirse así de distinto al Banco.
**Qué les dejo:** la tipografía diminuta — una cota tiene que leerse sin acercarse.

## 2.4 · DEUS EX · NIER: AUTOMATA · PREY · GHOSTRUNNER

![Deus Ex Mankind Divided](referencias-hud/deusex-2.jpg)
![NieR Automata](referencias-hud/nier-2.jpg)
![Ghostrunner](referencias-hud/ghostrunner-2.jpg)

*(Arte y paleta. Ninguna trae interfaz.)*

- **Deus Ex:** negro con oro, la UI se siente implante. Confirma nuestro oro para lo humano.
- **NieR:** una sola tipografía, dos pesos, cero adornos. **Esa disciplina la adopto como regla.**
- **Prey:** la pantalla es un objeto físico dentro del casco (curvatura, reflejo) — con cuentagotas.
- **Ghostrunner:** cian y magenta sobre negro. **Prueba de que dos colores bastan** — el nuestro
  es cian + ámbar y no necesita un tercero.

---

# §3 · LA INTERFAZ EN MOVIMIENTO

Una foto no muestra **el barrido**, que es justo lo que quiero robar.

[![Horizon Zero Dawn — análisis del Focus scan](referencias-hud/video-horizon-focus.jpg)](https://www.youtube.com/watch?v=6PBDBRRfE_E)

**Horizon Zero Dawn — E3 2016, análisis del Focus scan** ·
<https://www.youtube.com/watch?v=6PBDBRRfE_E>
Fíjate en **cómo entra** la información: no aparece, barre. Y en que la máquina queda azul con
los puntos débiles en amarillo mientras dura el escaneo.

Búsquedas que no se rompen (los videos cambian de dirección, las búsquedas no):
- Shipbreaker, modo escáner: <https://www.youtube.com/results?search_query=hardspace+shipbreaker+scanner+mode>
- Death Stranding, el odradek: <https://www.youtube.com/results?search_query=death+stranding+odradek+scanner>
- Dead Space, HUD diegético: <https://www.youtube.com/results?search_query=dead+space+diegetic+hud+design>
- Armored Core VI, HUD: <https://www.youtube.com/results?search_query=armored+core+6+hud+gameplay>

Galerías que no dejan descargar pero valen la pena abrir:
- Game UI Database — 1,300 juegos, 55,000 pantallas, filtrable por color y layout: <https://www.gameuidatabase.com/>
- Interface In Game: <https://interfaceingame.com/>

---

# §4 · LA DECISIÓN — qué toma La Forja

En orden de cuánto cambia el producto:

| # | de dónde | qué |
|---|---|---|
| 1 | **Shipbreaker** | **Pestañas de lente** sobre la misma pieza (espesor · expulsores · partición), leyenda de color, y el resto en alambre |
| 2 | **Death Stranding / Horizon** | **EL BARRIDO**: la información se revela, no aparece |
| 3 | **Shipbreaker / Armored Core** | **El centro es de la pieza**; los datos viven en el borde |
| 4 | **Horizon** | Dos idiomas que no se parecen: Foco frío sobre la pieza, Banco sólido al costado |
| 5 | **Cyberpunk / NieR** | Una tipografía, dos pesos, todo a una rejilla; etiqueta apagada, valor claro |
| 6 | **Ghostrunner** | Dos colores bastan: cian = medido, ámbar = atención |
| — | **Stellaris** | La advertencia: un dato ≠ una ventana |

Lo que **no** tomamos: ángulos cortados (Deus Ex) y corchetes de visor (Detroit) — envejecen
rápido y le pelean legibilidad a una tabla de números; amarillo industrial (Shipbreaker) — el
cálido ya está reservado para lo que exige atención.

---

## Cómo se armó este atlas (para poder repetirlo)

`scripts/bajar-referencias-hud.py` pide a la API pública de Steam el nombre y los screenshots de
cada juego, los baja del CDN oficial, los reduce a 1280 px y deja `manifiesto.json` con la
atribución. **52 imágenes, 12 juegos, 8.5 MB.** Repetirlo con más juegos es agregar un renglón.

*Las imágenes son material de referencia de diseño, propiedad de sus estudios: Guerrilla Games,
Blackbird Interactive, Kojima Productions, CD Projekt Red, Eidos-Montréal, Respawn,
FromSoftware, PlatinumGames, Unknown Worlds, Arkane, One More Level y Paradox. Miniatura de
video: YouTube.*
