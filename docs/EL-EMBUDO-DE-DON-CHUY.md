# El embudo de Don Chuy — toda la experiencia, de la pantalla del teléfono a la lata

> ian, 2026-09-21: «prepara todo, pero necesitamos hacer el funnel primero; quiero que pienses
> en toda la experiencia del usuario». Este documento es esa experiencia, momento por momento,
> con lo que la persona ve, lo que siente, lo que hacemos nosotros y lo que medimos. Es el
> quinto de la serie (GANCHO → RETENCIÓN → ECONOMÍA-ATENCIÓN → QUÉ-HACER-CON-LA-ATENCIÓN → este).
> Lo que ya decidimos en agosto no se re-discute: DM y no link-in-bio; la página es la
> continuación del video; WhatsApp y no correo; puro valor, nunca venta.

## 0. La persona y su momento

Dueña o dueño de un negocio chico —puesto, tiendita, taquería, estética, taller— en México y
LATAM (por sesiones: 43 % Argentina, 15 % Chile, 15 % Colombia, 15 % México; en la web
mandan los hispanos en EEUU). Muchos ya cerraron uno. Están en el teléfono, dentro de
Instagram, entre las 9 y las 11 de la noche, con 3 segundos de paciencia. No buscan un ERP y
no saben qué es uno. Buscan entender **por qué se les fue el dinero**, y que nadie los regañe.

Lo que sienten al llegar es vergüenza, no ignorancia. Todo lo de abajo está diseñado para
que en ningún paso se sientan tontos ni vendidos.

## 1. El viaje

| | Qué ve | Qué siente | Qué hacemos | Qué medimos |
|---|---|---|---|---|
| **M0 · El feed** (0-40 s) | Don Chuy vendió todo y se fue sin un peso. Una cuenta, con naranjas y billetes que se ven. Cierra con una pregunta que parte la sala en dos. | «Esto me pasó a mí.» | El gancho en el cuadro 0, 30-45 s, sin intro. En pantalla y en el primer comentario: **«Comenta LIBRETA y te la mando»**. | retención a 3 s y 25 s · compartidos/mil · **comentarios/mil** · % de comentarios con la palabra |
| **M1 · El comentario** (s 40-60) | Escribe LIBRETA (o su postura en el debate). Abajo aparece la respuesta pública de @gaiaprime_mx: «Te la mandé por DM 🍊». | Le contestaron. Los demás ven que sí mandan algo. | Respuesta privada al comentario + respuesta pública corta, en < 5 min, con espera aleatoria de 25-45 s entre envíos para no parecer máquina. | DMs enviados / comentarios con palabra · minutos hasta el DM |
| **M2 · El DM** (min 1-5) | Un mensaje corto, en el tono de Don Chuy: «Aquí está la libreta de Don Chuy 🍊 Es gratis y es tuya: [link]. Si fías, ahí apuntas. Si tiras, ahí lo ves.» | No le pidieron nada. | El link lleva `?c=<capítulo>&s=<id corto>` para atar la telemetría de la página a este DM. Si escribe otra cosa, **no contesta la máquina**: queda en pendientes para una persona. | clics / DMs · pendientes para humano |
| **M3 · La página, segundo 0-4** | Se abre DENTRO de Instagram. El mismo puesto del video, la misma lata, y la cuenta del capítulo del que viene. Una pregunta grande: **«¿Y en tu negocio?»**, con sus números ya puestos. | «Es la misma historia… y ahora es la mía.» | La continuación del video (peak-end: el pico antes del segundo 4). Sin login, sin banners, sin R3F: SVG y React ligero, < 1 s. | tiempo a la primera interacción · % que cambia un número · segundos en página |
| **M4 · Sus números** (min 1-2) | Cambia «vendes al día», «te cuesta», «fías» y la lata cambia en vivo: «Te quedan $300. Sin fiar: $500». | El ajá con SU dinero. | Las 7 cuentas de la semana como fórmulas editables (una por capítulo). | `chuy.numero` |
| **M5 · La libreta** (min 2-3) | «Apunta tu primer fiado»: nombre, monto, 3 toques. «Te deben $X.» Botón Cobrado. Tabs Gastos y Merma. | Lo que Don Chuy no sacó, él ya lo tiene. | Se guarda en el teléfono (`localStorage`), sin cuenta. | % que anota ≥ 1 fiado · fiados por persona |
| **M6 · Que regrese** (día 1-7) | «¿Te la mando cada noche?» → abre WhatsApp con el texto ya escrito. Y el canal de difusión de IG «La libreta de Don Chuy» con el capítulo del día. | Alguien me la recuerda. | Hoy el WhatsApp lo atiende una persona; cuando la sesión de WhatsApp esté, el corte diario sale solo («Hoy cobraste $300, te deben $700»). | opt-in WhatsApp · retorno D1 / D7 |
| **M7 · El escalón** (día 7-30) | Cuando la libreta tiene 5+ nombres: «Hermes te dice quién te debe, cuánto y desde cuándo, y te avisa solo. Pruébalo gratis.» | Se me quedó chica la libreta. | Al trial que ya existe en gaiaprime.com.mx (crea negocio, 14 días). Lo que falta y vale oro: **importar la libreta** como clientes con saldo, para que no empiece de cero. | trials desde la libreta · trial → pago |
| **M8 · Pagar cuando gana** | Después del trial. | «Me cobran cuando cobro.» | **Decisión de ian:** hoy el muro dice $500/usuario/mes. Para Don Chuy la escalera pide el peldaño Emprender: gratis + 1 % del flujo (ya existe en Mercuria) o un plan chico. | MRR desde Don Chuy |

## 2. Por qué así (y no de otra forma)

- **DM, no link-in-bio.** Medido en 2026: 28 % de CTR por DM contra 1-3 % del link en bio. Y el comentario con palabra sube el reel para los demás.
- **La página es la continuación del video.** La gente que llega ya vio a Don Chuy; abrirle un catálogo o un dashboard rompe el hilo. Mismo dibujo, misma lata, sus números.
- **Valor antes de identidad.** La libreta funciona sin pedir nada. El correo ni se pide (18-22 % de apertura en LATAM); el re-contacto es WhatsApp y el canal de IG.
- **Nunca vender en el video ni en la página.** Hermes aparece como «la libreta en grande», una vez, al final, sin precio. Seis de siete videos son puro valor; el domingo es el puente («Anotar es ver»).
- **Una sola cuenta por capítulo, y la misma en la página.** Si el video dice 100 naranjas a $10, la página abre con 100 naranjas a $10.

## 3. Qué existe, qué se construye hoy, qué falta

| Pieza | Estado |
|---|---|
| Videos de la semana (00-06), 9:16 y 16:9, 4K | hechos; 00 salió hoy; 01-06 listos para programar |
| Permiso de DMs en la API | ian abrió el interruptor y renovó el token hoy; la API ya responde (falta ver conversaciones reales) |
| Respondedor de palabra clave (`scripts/dm-libreta.py` + `embudo-libreta.json`) | se escribe hoy; apagado (`activo: false`) hasta la prueba de punta a punta |
| La página `chuy.html` (puesto + cuenta editable + libreta + WhatsApp + escalón) | se construye hoy en forja-dev2; **no se despliega sin autorización** |
| Telemetría por capítulo y por DM (`c`, `s`) | va dentro de la página con `telemetry.ts` |
| Canal de difusión de IG «La libreta de Don Chuy» | lo crea ian en la app (5 minutos) |
| Corte diario por WhatsApp | espera a la sesión de WhatsApp; mientras, wa.me atendido a mano |
| Importar la libreta a Hermes | falta; es el puente de verdad al ERP |
| Precio para Don Chuy (Emprender: 1 % del flujo) | decisión de ian |

## 4. Orden de encendido (no se enciende todo junto)

1. **Prueba de punta a punta con ian:** manda «LIBRETA» por DM desde su cuenta → `dm-libreta.py estado` lo ve → `tick` le contesta (un envío, a él).
2. **Página en producción** (ATLAS), con su autorización. Verificar dentro de Instagram con el teléfono: abre en < 1 s, la libreta sobrevive a cerrar y volver.
3. **Respondedor encendido** en PRIME (`activo: true` + cron), primero solo con el capítulo 00.
4. **«Comenta LIBRETA»** entra al primer comentario y a la descripción de los capítulos 01-06 (sin re-render); la placa en pantalla se re-renderiza después (20 min por capítulo).
5. **Siete días de datos** antes de escalar a la temporada 2: retención, compartidos/mil, comentarios/mil, DMs, aperturas, fiados anotados, WhatsApp, trials.

## 5. Riesgos que ya vemos

- **Bloqueo por spam.** Contestar 200 comentarios en un minuto huele a bot. Espera aleatoria, tope por hora, y el script se detiene ante cualquier aviso de Meta.
- **La ventana de 24 h.** Solo podemos escribirle a quien nos escribió en las últimas 24 h. El embudo arranca siempre con su comentario o su DM.
- **El navegador de Instagram no es Safari.** Lo que se guarda en la libreta dentro de Instagram no aparece si luego abre el link en el navegador normal. Por eso el link del DM se queda en el chat (lo vuelve a abrir desde ahí) y por eso el WhatsApp diario importa más que el `localStorage`.
- **Comentarios con «LIBRETA» de gente que no quiere nada.** Se les manda igual: un mensaje, cero insistencia.
- **La voz.** XTTS no permite uso comercial; antes de la temporada 2 se decide la voz (Chatterbox, MIT, con una voz con permiso).

## 6. Lo que decide ian

1. El precio del peldaño Emprender para Don Chuy (1 % del flujo, plan chico, o el muro de $500 tal cual).
2. Autorizar el deploy de `chuy.html` a ATLAS cuando vea las capturas.
3. Crear el canal de difusión «La libreta de Don Chuy» en la app de IG.
4. Programar los 6 capítulos de la semana (18:45 diario) — un sí.
