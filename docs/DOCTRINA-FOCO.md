# DOCTRINA DEL FOCO — el lenguaje visual de La Forja

> Nace de la sesión del 2026-08-29, cuando ian probó el CAD con su propia pieza y dijo tres
> cosas: «me estorban esas ventanas», «el Foco debe verse futurista» y «lo primero que necesito
> de mi Foco son las medidas: es como si tuviera los planos pero encima».
> Investigación: Horizon Zero Dawn y Detroit: Become Human. **No copiamos el look — tomamos la
> regla de uno y el mecanismo del otro.**

---

## 0. LOS DOS IDIOMAS

Horizon separa su interfaz en dos lenguajes que **no se parecen en nada** a propósito: el Foco
(holograma proyectado dentro del mundo) y la tiza tribal (pegada a la cámara). El jugador sabe
sin pensar cuál es cuál. Nosotros copiamos esa separación:

| | **EL FOCO** | **EL BANCO** |
|---|---|---|
| qué es | lo que la máquina SABE de tu pieza | el mobiliario del CAD |
| dónde vive | **sobre la geometría** | en los costados, nunca encima de la pieza |
| cómo se ve | holograma frío, translúcido | sólido, callado |
| color | cian `#5fd4f5` = medido · ámbar `#ffc24b` = exige atención | oro `#c9a227` = lo que TÚ decides |
| cuándo aparece | cuando lo prendes (tecla **Q**) | cuando tiene algo que decir |

De **Detroit** viene la regla dura: *el HUD está limpio y la información aparece solo cuando
hace falta*. Por eso el Foco arranca apagado y **una ventana sin contenido no se renderiza**.

---

## 1. EL VOCABULARIO — cómo se llaman nuestras piezas

Nombrarlas no es cosmético: cuando ian dice «el hilo se encima» yo sé exactamente qué tocar.

### Del FOCO
| nombre | qué es | estado |
|---|---|---|
| **LA COTA** | línea de medida + su etiqueta, flotando sobre la pieza | ✅ vive (U3) |
| **EL HILO** | la guía que ata un texto al punto exacto de la pieza | ⏳ T3 |
| **LA CAPA** | un campo pintado sobre el sólido (espesor, expulsores, visibilidad) | ⏳ T2 |
| **EL BARRIDO** | el plano de escaneo que revela la información al prender el Foco | ⏳ propuesto |
| **LA MARCA** | un punto señalado en la pieza (compuerta, pin, defecto) | ⏳ T3 |
| **EL HOLOGRAMA** | la pieza enfriada: cian translúcido, doble cara | ✅ vive (U3) |

### Del BANCO
| nombre | qué es | estado |
|---|---|---|
| **EL DICTAMEN** | los hallazgos de tu pieza, del que más duele al que menos | ✅ vive (T1) |
| **LA MESA** | el lobby: tus proyectos y las plantillas | ✅ vive |
| **LA CORONA** | el menú radial dorado | ✅ existe |
| **LA HOJA** | la cotización imprimible | ✅ existe |
| **EL PARTE** | la línea de estado de abajo: qué es lo que estás viendo | ✅ vive |

---

## 2. EL CATÁLOGO — las direcciones que puede tomar el Foco

Para que ian elija. Cada una trae su referencia (abrible), qué le tomaría, y **mi voto**.

### A · HOLOGRAMA — *Horizon Zero Dawn, el Focus*
El cuerpo de la máquina se enfría a azul translúcido y lo vulnerable salta en amarillo; la
información se acuesta sobre el objeto.
🔗 [Game UI Database — Horizon Zero Dawn](https://www.gameuidatabase.com/gameData.php?id=256) ·
[UI Critique](https://medium.com/@a_kill_/horizon-zero-dawn-ui-critique-79663362429)
**Mi voto: ya es la base y ya está en producción.** Es la que mejor aguanta datos densos porque
el color significa algo en vez de decorar.

### B · EL BARRIDO — *Horizon (el escaneo) + Dead Space*
La información **no aparece: la revela un plano que barre la pieza**. Prendes el Foco y las
cotas nacen conforme el barrido las alcanza.
**Mi voto: LO QUIERO.** Es lo que hace que se sienta máquina y no menú, y es barato — una
animación de 400 ms sobre lo que ya existe. Es el cambio con mejor razón/precio de toda la lista.

### C · ANATOMÍA — *Horizon, la pantalla de análisis de máquina*
La pieza se despieza visualmente: cada zona se colorea por función y las etiquetas salen a un
costado con líneas largas, como una lámina de anatomía.
🔗 [Territory Studio — HZD](https://territorystudio.com/project/horizon-zero-dawn/)
**Mi voto: sí, pero es T2+T3 con estilo.** Es la más útil para moldes (la pared, los pines, la
partición son literalmente "zonas por función"). No es cosmética: es el trabajo pendiente.

### D · EL VISOR — *Detroit, Deus Ex, Cyberpunk*
Viñeta oscura en los bordes, corchetes en las esquinas, tipografía de instrumento, parpadeo de
refresco. Se siente casco.
🔗 [Interface In Game — Detroit](https://interfaceingame.com/games/detroit-become-human/)
**Mi voto: NEL, o muy dosificado.** Envejece rápido y en un CAD que ya tiene mucho texto los
corchetes y la viñeta se vuelven ruido. La viñeta sí la aceptaría — ayuda a que la pieza se
despegue del fondo.

### E · CALCO — *no es de juego: es un plano de verdad*
La pieza en línea sobre fondo cian, como un plano vivo que puedes girar.
**Mi voto: es la versión honesta de tu frase.** Tú dijiste «como si tuviera los planos pero
encima» — el holograma es *casi* eso; el calco **es** eso. Lo propondría como un segundo modo
del Foco: `Q` una vez = holograma, `Q` dos veces = calco.

### F · SOLARPUNK — *tu petición*
Vidrio, latón, madera, vegetación, luz cálida; la información como grabada en cristal.
**Mi voto: hermoso, pero NO para el Foco — sí para el Banco.** Razón dura: en nuestro sistema
lo **cálido significa "esto exige tu atención"**. Si todo el Foco es cálido, se pierde la señal.
Mi propuesta: **el Banco se vuelve solarpunk** (la Mesa, la Corona, la Hoja: latón, vidrio, luz
tibia) y **el Foco se queda frío**. Los dos idiomas se separan todavía más — que es exactamente
lo que Horizon hace bien — y ganas el solarpunk donde sí se puede disfrutar: en el mueble, no
en el instrumento.

---

## 3. LO QUE YA ESTÁ EN PRODUCCIÓN

- **EL FOCO** con LAS COTAS: envolvente medida de tu pieza, holograma cian, tecla **Q**.
- **PANTALLA LIMPIA**: una ventana sin contenido no existe. El visor pasó de ~60 % a ~85 %.
- **EL DICTAMEN** al costado: los hallazgos de tu pieza por severidad, con su § y sus números.

## 4. LO QUE FALTA (y en qué orden lo haría)

1. **EL BARRIDO** (B) — el revelado. Barato y es el que cambia la sensación.
2. **LA CAPA** (T2 / C) — la pared pintada sobre el sólido. Es el primer gate del libro.
3. **EL HILO** (T3) — cada § atado a su lugar en la pieza.
4. **EL CALCO** (E) — el segundo modo del Foco.
5. **EL BANCO SOLARPUNK** (F) — cuando el Foco esté completo.
