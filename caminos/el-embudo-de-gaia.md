# CAMINO: EL EMBUDO DE GAIA

ACTOR: una dueña de puesto en Neza que vio un video de Don Chuy a las 9 de la noche, con el teléfono en la mano y tres segundos de paciencia
PROMESA: de ese video sale con UNA herramienta que usa esa misma noche (su libreta del fiado), la vuelve a abrir el viernes, y el día que se le queda chica ya sabe cómo se llama lo que sigue — sin que nadie le haya vendido nada
PIEZA: econ-fiado (el capítulo 00, publicado el 21-sep) + chuy.html?c=00
NOTA: el embudo NO depende de que Meta publique la app (medido 22-sep: se LEE por Facebook Login y se CONTESTA el DM por Instagram Login; ver reference_dm_comentarios_dos_puertas). Lo que sí depende: los DMs que la gente manda por su cuenta. La regla del canal no cambia: puro valor, la venta nunca entra al video. Métrica del camino: no son vistas, son LIBRETAS ABIERTAS DOS VECES.

## PASOS
- 1 · EL VIDEO (uno diario, 18:45 CDMX): una cuenta, un dibujo, un debate · 11 capítulos encolados 22-sep→2-oct, YouTube 9:16+16:9 con publishAt y cola de PRIME · ok · 2026-09-21-la-libreta-de-don-chuy
- 2 · LA PALABRA (comenta LIBRETA): el CTA parte la sala y deja rastro público · el copy de los capítulos lo pide; hoy sale sin la palabra hasta que el respondedor viva · parcial · 2026-09-21-la-libreta-de-don-chuy
- 3 · LEER LOS COMENTARIOS (Facebook Login, `instagram_manage_comments`): la lista de quién escribió la palabra · `dm-libreta.py estado` los lista; medido con 2 «LIBRETA» el 22-sep · ok · 2026-09-21-la-libreta-de-don-chuy
- 4 · CONTESTAR POR DM (Instagram Login, respuesta privada al comentario) + respuesta pública corta · 2 DMs entregados con message_id + 2 respuestas públicas (22-sep, app SIN publicar) · ok · 2026-09-21-la-libreta-de-don-chuy
- 5 · LA HERRAMIENTA (chuy.html): el mismo puesto, la cuenta con SUS números y la libreta que vive en su teléfono · construida y probada en forja-dev2; NO desplegada (el deploy lo corre ian) · bloqueado · 2026-09-21-la-libreta-de-don-chuy
- 6 · QUE VUELVA (WhatsApp + canal de difusión de IG): un corte al cierre del día, no una promoción · el botón de WhatsApp está en la página; el canal de difusión lo crea ian; el corte automático espera la API de WhatsApp (portafolio en verificación) · bloqueado · -
- 7 · GUARDARLA (la cuenta): la libreta sube a la nube y ahí nace la identidad — es el ÚNICO momento en que se pide algo, y a cambio de no perder lo anotado · falta: chuy.html guarda solo en el teléfono; university-api ya tiene magic-link y cuentas · bloqueado · -
- 8 · EL ESCALÓN (Hermes): cuando la libreta pasa de 5 nombres, ofrecer importarla al ERP con saldos, no empezar de cero · falta el importador; la prueba gratis del ERP ya existe · bloqueado · -
- 9 · PAGAR CUANDO GANA: el peldaño Emprender (1 % del flujo, ya existe en Mercuria) en vez del muro de $500/usuario · decisión de ian pendiente · bloqueado · -
- 10 · MEDIR EL EMBUDO ENTERO: una fila por capítulo con vistas → comentarios/mil → DMs → aperturas → libretas con ≥1 fiado → WhatsApp → trials · falta el tablero; hoy solo hay métricas de video · parcial · -

## RUNNER
- 1 · python3 scripts/cola-publicar.py estado
- 2 · python3 -c "import json;d=json.load(open('videos/econ-fiado.json'))['publicar'];import sys;sys.exit(0 if 'LIBRETA' in (d.get('primer_comentario','')+d['copy']['descripcion']).upper() else 1)"
- 3 · python3 scripts/dm-libreta.py estado
- 4 · python3 -c "import json,os,sys;p=os.path.expanduser('~/.config/gaia-pub/dm-libreta.hecho.json');sys.exit(0 if os.path.exists(p) else 1)"
- 5 · curl -sf -o /dev/null -w '%{http_code}' https://university.gaiaprime.com.mx/chuy.html
- 6 · python3 -c "import json;d=json.load(open('videos/econ-fiado.json'));import sys;sys.exit(0 if 'wa.me' in json.dumps(d) else 1)"
- 7 · curl -sf https://university.gaiaprime.com.mx/chuy.html | grep -q 'localStorage'
- 8 · grep -rq 'importar' src/chuy/ 2>/dev/null
- 9 · python3 -c "import json;d=json.load(open('public/comando/catalogo.json'));import sys;sys.exit(1)"
- 10 · ls public/comando/embudo.json
