#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""dm-libreta.py — EL EMBUDO DE LA PALABRA: quien escribe LIBRETA recibe la libreta de Don Chuy.

Por qué existe (orden 2026-09-21-la-libreta-de-don-chuy; ian: «prepara todo, pero necesitamos
hacer el funnel primero, quiero que pienses en toda la experiencia del usuario»): el reel de
Don Chuy cierra con «escribe LIBRETA» y alguien tiene que estar del otro lado, al minuto. El DM
pesa más que un link-in-bio, así que el embudo entero es:

    comentario o DM con la palabra  →  DM con el enlace DE SU CAPÍTULO (chuy.html?c=&s=)
                                    →  y si vino de un comentario, respuesta pública corta
    DM sin la palabra               →  NO se contesta: se acumula para que lo cierre un humano

Un solo archivo, biblioteca estándar (urllib/json), dos máquinas — igual que cola-publicar.py:
la laptop/iangpu MIRAN (`estado`, `tick --seco`) y PRIME CONTESTA (`tick` por cron, sin venv).

  estado          lo que la API ve HOY: conversaciones, reels de la serie con su capítulo,
                  comentarios con la palabra sin atender, DMs con la palabra sin atender, y
                  DMs SIN la palabra (pendientes de humano). NO ESCRIBE NADA, ni local ni en Meta.
  tick [--seco]   manda la libreta a lo que falte. Con `activo: false` en la config o con --seco
                  imprime lo que HARÍA y no manda nada. Idempotente y reanudable.

LA PUERTA (una sola, por orden): graph.instagram.com/v25.0 con el token de Instagram Login de
@gaiaprime_mx (~/forja-cola/instagram-token.json en PRIME, ~/.config/gaia-pub/ en la laptop; se
busca en ese orden). El token NUNCA se imprime: todo lo que sale por pantalla pasa por sin_token().
Permisos que usa: instagram_business_basic (medios), instagram_business_manage_comments
(comentarios, respuestas públicas y la respuesta PRIVADA a un comentario) e
instagram_business_manage_messages (conversaciones y DM directo).

REGLAS DE META QUE EL SCRIPT RESPETA (no son opinión, son la doc):
  · Respuesta privada a un comentario: POST /{ig_id}/messages con
    {"recipient":{"comment_id":…},"message":{"text":…}}; UN solo mensaje por comentario y
    dentro de 7 DÍAS de publicado el comentario. https://developers.facebook.com/docs/instagram-platform/private-replies/
  · DM directo: POST /{ig_id}/messages con {"recipient":{"id":"<IGSID>"},…} y solo dentro de la
    VENTANA DE 24 H desde el último mensaje de esa persona.
  · Conversaciones: GET /{ig_id}/conversations?platform=instagram; las que están en la carpeta
    «Solicitudes» y llevan 30 días sin actividad NO se devuelven, y de cada conversación solo se
    pueden leer los últimos 20 mensajes.
    https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/conversations-api/
  · Se DETIENE ante bloqueo/spam (código 368 o «block»/«spam» en el mensaje) y ante límite de la
    API (4/17/32/613), como responder-comentarios.py: lo ya mandado queda registrado.

POR QUÉ `conversations` VIENE VACÍO (medido 2026-09-21, todo de lectura)
  Antes el endpoint contestaba «The account owner has disabled access to Instagram Direct
  Messaging» (el interruptor de la app: Configuración → Mensajes → Herramientas conectadas →
  Permitir acceso a los mensajes). Ese error YA NO SALE —el interruptor está prendido y el token
  se volvió a emitir después—, pero la respuesta es `{"data": []}` con 8,348 seguidores:

      GET /{ig_id}/conversations?platform=instagram            → HTTP 200 · 0 filas · sin cursores
      …&folder=inbox | page_done | pending | other | requests   → HTTP 200 · 0 filas
      …&fields=id,updated_time,participants,messages{…}         → HTTP 200 · 0 filas
      GET /me/conversations?platform=instagram                  → HTTP 200 · 0 filas
      GET /me/messages                                          → #100 «nonexisting field» (no existe)

  El hermano de al lado dice de qué se trata: los COMENTARIOS por esta misma puerta contestan
  HTTP 200 con 0 filas pero CON CURSORES de paginación en los 20 reels que tienen comentarios
  (el reel de Don Chuy anuncia comments_count=2 y devuelve data: []), y el campo anidado
  `?fields=comments{…}` se cae en silencio (solo vuelve `id,comments_count`). Esa firma
  —Meta ve las filas, manda los cursores y las filtra— es la CAUSA (1) que ya diagnosticó
  `comentarios.py diagnostico`: la app de Meta está en MODO DESARROLLO y «any data generated
  while an app is in Development mode … can only be seen by role users»
  (https://developers.facebook.com/docs/development/build-and-test/app-modes). Quien comenta o
  manda DM no tiene rol en la app → su fila no existe para la API. Prueba independiente: los 505
  comentarios de `public/comando/comentarios.json` salieron por la OTRA puerta (Facebook Login,
  `comentarios.py fb`), no por esta.
  Así que hay dos cosas distintas y conviene no confundirlas:
    (a) el permiso y el interruptor de DMs están BIEN (si faltaran, saldría #10/#200, no 0 filas);
    (b) mientras la app siga en Desarrollo, ni los comentarios ni los DMs de la gente se ven, y
        el embudo no puede dispararse solo. Cura sin App Review (es data de nuestra propia
        cuenta): panel de Meta → Configuración básica (icono + categoría + política de
        privacidad) → switch a ACTIVO. La detección en vivo documentada por Meta son los
        WEBHOOKS (`comments`, `messages`), que también dependen del modo de la app.
  Pendiente de comprobar: ian iba a mandarse un DM con «LIBRETA» desde su cuenta personal. Al
  cierre de este trabajo `conversations` seguía devolviendo 0 filas. Si al probar aparece SOLO el
  DM de una cuenta con rol en la app, queda probado que el filtro es por rol (y basta el switch);
  si no aparece ni ese, el siguiente sospechoso es el modo de la app + revisar que el token se
  haya emitido DESPUÉS de prender el interruptor.

LA CONFIG (scripts/embudo-libreta.json, sin secretos, se puede leer en voz alta)
  activo              false = ni una llamada de escritura, pase lo que pase. Lo prende ian.
  palabra             la palabra del embudo; se compara sin mayúsculas y sin acentos.
  link                plantilla con {c} (capítulo) y {s} (id corto del destinatario).
  respuesta_publica   lo que se contesta EN PÚBLICO bajo el comentario (solo si el DM salió).
  dm                  el mensaje, con {link}.
  dm_desconocido      RESERVADO y hoy sin usar: la orden dice que los DMs sin la palabra NO se
                      contestan (se acumulan para un humano). Si algún día lleva texto, hay que
                      enmendar la orden ANTES de que el script lo mande.
  capitulos           id de medio → capítulo (lo seguro, cuando el reel ya existe).
  titulos             trozo del título → capítulo (sirve antes de que el reel exista).
  capitulo_default    para un reel de la serie que no es capítulo de Don Chuy.
  detectar_por_caption  el texto que marca a los reels de la serie.
  espera_s            [min, max] segundos de espera aleatoria entre envíos.

ARCHIVOS (junto al token: ~/forja-cola/ en PRIME, ~/.config/gaia-pub/ en la laptop)
  embudo-libreta.json          la config (sin secretos; se busca primero junto a este script)
  dm-libreta.hecho.json        ids ya atendidos → idempotencia (nunca se manda dos veces)
  dm-libreta.pendientes.json   DMs sin la palabra, para que ian los cierre a mano
  dm-libreta.log               el log del cron

EL CAPÍTULO DEL QUE VIENE LA PERSONA (la `c` del enlace) se resuelve en este orden:
  1) `capitulos` de la config: id de medio → capítulo (lo más seguro);
  2) `titulos` de la config: un trozo del título → capítulo (sirve ANTES de que el reel exista);
  3) los manifiestos del repo (videos/econ-*.json) cuando el script corre dentro de La Forja:
     publicar.subidas.ig.id → capítulo, y publicar.copy.titulo → capítulo;
  4) `capitulo_default`.
La `s` del enlace es un id corto (8 caracteres, sha256 del igsid o del id del comentario) para
atar la telemetría de chuy.html con el DM que la originó, sin exponer quién es la persona.

ENCENDERLO (lo hace ian, no este script)
  1) `activo: true` en scripts/embudo-libreta.json y confirmar el texto del DM.
  2) armarlo en PRIME (como `cola-publicar.py armar`, a mano y a propósito):
       scp scripts/dm-libreta.py scripts/embudo-libreta.json ian@100.110.244.20:~/forja-cola/
       ssh ian@100.110.244.20 'chmod 600 ~/forja-cola/dm-libreta.py'
     (el token de Instagram ya vive ahí y PRIME lo renueva solo: cola-publicar.py refresh)
  3) el cron de PRIME (NO se instala desde aquí):
       */5 * * * * flock -n /tmp/dm-libreta.lock python3 ~/forja-cola/dm-libreta.py tick >> ~/forja-cola/dm-libreta.log 2>&1
"""
# ─────────────────────────────────────────────────────────────────────────────
# HALLAZGO 2026-09-22 (medido, no leído): EL EMBUDO YA PUEDE CORRER SIN PUBLICAR LA APP.
#
# La app de Meta sigue en modo Desarrollo, así que `graph.instagram.com/{ig}/comments`
# devuelve 0 filas con cursores (Meta esconde lo que genera quien no tiene rol). PERO:
#   · LEER los comentarios SÍ funciona por la puerta de Facebook Login
#     (`graph.facebook.com/{media}/comments` con el token de usuario de FB, que trae
#     instagram_manage_comments) — ahí aparecieron los dos «LIBRETA».
#   · MANDAR la respuesta privada SÍ funciona con el token de Instagram Login
#     (`graph.instagram.com/{ig}/messages` con recipient={comment_id}) — probado en vivo:
#     dos DMs entregados con message_id, con la app todavía «Sin publicar».
#   · La respuesta PÚBLICA al comentario va por Facebook (`{comment_id}/replies`).
# O sea: se lee por una puerta y se contesta por la otra. Lo que sigue bloqueado hasta
# publicar la app son los DMs que la gente manda por su cuenta (conversations = 0 filas).
# ─────────────────────────────────────────────────────────────────────────────

import os, sys, json, time, random, hashlib, unicodedata, datetime as dt
import urllib.request, urllib.parse, urllib.error

V = 'v25.0'
UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128'          # el UA de urllib se come 403 de vez en cuando
AQUI = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(AQUI)                                # La Forja, cuando corre desde scripts/
CASAS = [os.path.expanduser('~/forja-cola'),                # PRIME primero
         os.path.expanduser('~/.config/gaia-pub')]          # laptop / iangpu después
VENTANA_DM_H = 24                                           # ventana de mensajería de Meta
VENTANA_COMENTARIO_D = 7                                    # tope de la respuesta privada
REENVIO_H = 24                                              # no le mandamos la libreta dos veces al día
CODIGOS_LIMITE = (4, 17, 32, 613)
# manifiesto → capítulo (la serie de Don Chuy; el orden lo puso ian en la orden del 09-21)
ESTUDIO = {'econ-fiado': '00', 'econ-descuento': '01', 'econ-lata': '02', 'econ-merma': '03',
           'econ-precio': '04', 'econ-yunus': '05', 'econ-anotar': '06'}

SECO = '--seco' in sys.argv


# ───────────────────────────────── plomería ─────────────────────────────────

def casa():
    """La carpeta con el token: PRIME primero, laptop después (como CONF en cola-publicar.py)."""
    for d in CASAS:
        if os.path.exists(os.path.join(d, 'instagram-token.json')): return d
    for d in CASAS:
        if os.path.isdir(d): return d
    sys.exit('✗ no encuentro ni ~/forja-cola ni ~/.config/gaia-pub: ¿dónde vive el token?')


CASA = casa()
TOKEN = json.load(open(os.path.join(CASA, 'instagram-token.json')))
IG = str(TOKEN['ig_id'])


def sin_token(texto):
    """EL TOKEN NO SE IMPRIME NUNCA — ni en el log, ni en un error, ni de rebote en una URL."""
    t = str(texto); tk = TOKEN.get('access_token') or ''
    return t.replace(tk, '«token»') if tk else t


def log(m):
    print(f'{dt.datetime.now().strftime("%H:%M:%S")}  {sin_token(m)}', flush=True)


def pedir(metodo, ruta, params=None, cuerpo=None, forma=None):
    """Una llamada a graph.instagram.com. `cuerpo` va como JSON (los mensajes llevan objetos
    anidados); `forma` va urlencoded (las respuestas públicas, como responder-comentarios.py)."""
    p = dict(params or {}); p['access_token'] = TOKEN['access_token']
    url = f'https://graph.instagram.com/{V}/{ruta}?' + urllib.parse.urlencode(p)
    cab = {'User-Agent': UA}; datos = None
    if cuerpo is not None:
        datos = json.dumps(cuerpo).encode(); cab['Content-Type'] = 'application/json'
    elif forma is not None:
        datos = urllib.parse.urlencode(forma).encode()
    req = urllib.request.Request(url, data=datos, method=metodo, headers=cab)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except Exception: return {'error': {'message': f'HTTP {e.code}'}}
    except Exception as e:
        return {'error': {'message': sin_token(e)[:200]}}


def es_bloqueo(err):
    m = str(err.get('message', '')).lower()
    return err.get('code') == 368 or 'block' in m or 'spam' in m


def es_limite(err):
    return err.get('code') in CODIGOS_LIMITE or 'limit' in str(err.get('message', '')).lower()


def normalizar(s):
    """minúsculas y sin acentos: «Libreta», «LIBRETÁ» y «libreta,» son la misma palabra."""
    s = unicodedata.normalize('NFD', str(s or ''))
    return ''.join(c for c in s if not unicodedata.combining(c)).lower()


def tiene_palabra(texto, palabra):
    return normalizar(palabra) in normalizar(texto)


def sid(semilla):
    return hashlib.sha256(str(semilla).encode()).hexdigest()[:8]


def cuando(iso):
    """Las fechas de Meta vienen como 2026-09-21T23:12:34+0000; las nuestras (hecho.json) sin huso
    → se les pone el de esta máquina, porque restar una fecha con huso y otra sin él truena."""
    if not iso: return None
    t = None
    try: t = dt.datetime.strptime(iso, '%Y-%m-%dT%H:%M:%S%z')
    except ValueError:
        try: t = dt.datetime.fromisoformat(str(iso).replace('Z', '+00:00'))
        except ValueError: return None
    return t if t.tzinfo else t.astimezone()


def horas(iso):
    t = cuando(iso)
    if t is None: return None
    return (dt.datetime.now(dt.timezone.utc) - t).total_seconds() / 3600


def cfg():
    for d in (AQUI, CASA):
        p = os.path.join(d, 'embudo-libreta.json')
        if os.path.exists(p): return json.load(open(p, encoding='utf-8'))
    sys.exit(f'✗ falta embudo-libreta.json (ni en {AQUI} ni en {CASA})')


def estado_archivo(nombre):
    return os.path.join(CASA, nombre)


def leer_json(p, dflt):
    try: return json.load(open(p, encoding='utf-8'))
    except Exception: return dflt


def guardar_json(p, doc):
    tmp = p + '.tmp'
    json.dump(doc, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    os.replace(tmp, p); os.chmod(p, 0o600)


# ───────────────────────────── quién soy yo ─────────────────────────────

def yo():
    r = pedir('GET', 'me', {'fields': 'id,user_id,username,followers_count,media_count'})
    if 'error' in r: sys.exit(f'✗ el token no sirve: {sin_token(r["error"])}')
    return r


def es_mio(quien, mi):
    if not isinstance(quien, dict): return False
    if quien.get('username') and quien['username'] == mi.get('username'): return True
    return str(quien.get('id') or '') in {str(mi.get('id')), str(mi.get('user_id')), IG}


# ──────────────────────── medios y capítulos de la serie ────────────────────────

def medios(limite=30):
    r = pedir('GET', f'{IG}/media',
              {'fields': 'id,caption,permalink,timestamp,comments_count', 'limit': limite})
    if 'error' in r: log(f'⚠ /media: {sin_token(r["error"])}'); return []
    return r.get('data') or []


def tabla_capitulos(c):
    """id de medio → capítulo, y trozo de título → capítulo (ver el docstring, 4 fuentes)."""
    por_id = {str(k): str(v) for k, v in (c.get('capitulos') or {}).items()}
    por_titulo = {normalizar(k): str(v) for k, v in (c.get('titulos') or {}).items()}
    dirv = os.path.join(REPO, 'videos')
    if os.path.isdir(dirv):                      # dentro de La Forja: los manifiestos mandan
        for vid, cap in ESTUDIO.items():
            p = os.path.join(dirv, f'{vid}.json')
            if not os.path.exists(p): continue
            d = leer_json(p, {}); pub = d.get('publicar') or {}
            mid = ((pub.get('subidas') or {}).get('ig') or {}).get('id')
            if mid: por_id.setdefault(str(mid), cap)
            tit = (pub.get('copy') or {}).get('titulo')
            if tit: por_titulo.setdefault(normalizar(tit), cap)
    return por_id, por_titulo


def capitulo_de(m, c, por_id, por_titulo):
    """(capítulo, de dónde salió). El «de dónde» importa: un reel de la serie que NO es de la
    saga de Don Chuy cae en el capítulo por omisión, y eso se tiene que VER en `estado`."""
    mid = str(m.get('id')); cap = por_id.get(mid)
    if cap: return cap, 'id'
    cap_texto = normalizar(m.get('caption') or '')
    for frag, v in por_titulo.items():
        if frag and frag in cap_texto: return v, 'titulo'
    return str(c.get('capitulo_default') or '00'), 'default'


def reels_de_la_serie(c, ms):
    """Los reels del embudo: los que traen `detectar_por_caption` en el caption o ya están
    mapeados a mano en `capitulos`."""
    por_id, por_titulo = tabla_capitulos(c)
    marca = normalizar(c.get('detectar_por_caption') or '')
    out = []
    for m in ms:
        suyo = str(m.get('id')) in por_id or (marca and marca in normalizar(m.get('caption') or ''))
        if not suyo: continue
        cap, fuente = capitulo_de(m, c, por_id, por_titulo)
        out.append({**m, 'capitulo': cap, 'fuente': fuente})
    return out


def enlace(c, cap, semilla):
    return str(c.get('link') or '').replace('{c}', cap).replace('{s}', sid(semilla))


def texto_dm(c, cap, semilla):
    return str(c.get('dm') or '').replace('{link}', enlace(c, cap, semilla))


# ───────────────────────────── comentarios ─────────────────────────────

def comentarios_de(mid):
    """Devuelve (filas, filtrado). `filtrado` = Meta manda cursores y 0 filas → modo Desarrollo."""
    r = pedir('GET', f'{mid}/comments',
              {'fields': 'id,text,username,timestamp,replies{id,text,username}', 'limit': 50})
    if 'error' in r:
        log(f'⚠ comentarios de {mid}: {sin_token(r["error"])}'); return [], False
    filas = r.get('data') or []
    cursores = bool((r.get('paging') or {}).get('cursors'))
    return filas, (not filas and cursores)


def ya_contestado(com, mi):
    return any(es_mio(x, mi) for x in ((com.get('replies') or {}).get('data') or []))


# ───────────────────────────── conversaciones (DMs) ─────────────────────────────

def conversaciones(limite=25):
    r = pedir('GET', f'{IG}/conversations',
              {'platform': 'instagram', 'fields': 'id,updated_time,participants', 'limit': limite})
    if 'error' in r:
        log(f'⚠ /conversations: {sin_token(r["error"])}'); return [], r.get('error')
    return (r.get('data') or []), None


def mensajes_de(conv, n=10):
    """Los últimos mensajes de una conversación. Meta solo deja leer los últimos 20; si el campo
    anidado no trae los detalles, se pregunta mensaje por mensaje (así lo documenta)."""
    r = pedir('GET', conv, {'fields': f'messages.limit({n}){{id,created_time,from,to,message}}'})
    filas = ((r.get('messages') or {}).get('data')) or []
    if not filas:
        r = pedir('GET', conv, {'fields': 'messages'})
        filas = ((r.get('messages') or {}).get('data')) or []
    out = []
    for m in filas[:n]:
        if 'from' not in m or 'message' not in m:
            d = pedir('GET', str(m.get('id')), {'fields': 'id,created_time,from,to,message'})
            if 'error' not in d: m = {**m, **d}
        out.append(m)
    out.sort(key=lambda x: str(x.get('created_time') or ''), reverse=True)
    return out


# ───────────────────────────── el censo (lo que hay que hacer) ─────────────────────────────

def revisar(c, hecho):
    """Lee TODO y devuelve el plan. No escribe nada (ni local ni en Meta): `estado` y `tick`
    parten de aquí para que lo que se ve en seco sea exactamente lo que se manda."""
    mi = yo()
    palabra = c.get('palabra') or 'LIBRETA'
    plan = {'mi': mi, 'reels': [], 'comentarios': [], 'dm': [], 'pendientes': [],
            'conversaciones': [], 'filtrado': False, 'error_conv': None}

    # (b) los reels de la serie, con su capítulo
    plan['reels'] = reels_de_la_serie(c, medios())

    # (c) comentarios con la palabra sin atender
    hechos_c = (hecho.get('comentarios') or {})
    for m in plan['reels']:
        if not (m.get('comments_count') or 0): continue
        filas, filtrado = comentarios_de(m['id'])
        plan['filtrado'] = plan['filtrado'] or filtrado
        for com in filas:
            if es_mio({'username': com.get('username')}, mi): continue      # nuestro primer comentario
            if not tiene_palabra(com.get('text'), palabra): continue
            if com['id'] in hechos_c: continue
            if ya_contestado(com, mi): continue
            h = horas(com.get('timestamp'))
            plan['comentarios'].append({
                'id': com['id'], 'usuario': com.get('username'), 'texto': (com.get('text') or '')[:120],
                'cuando': com.get('timestamp'), 'horas': h, 'reel': m['id'], 'capitulo': m['capitulo'],
                'vencido': (h is not None and h > VENTANA_COMENTARIO_D * 24)})

    # (a)(d)(e) conversaciones: con la palabra → libreta; sin la palabra → humano
    convs, err = conversaciones()
    plan['error_conv'] = err
    hechos_d = (hecho.get('dm') or {}); personas = (hecho.get('personas') or {})
    for cv in convs:
        msgs = mensajes_de(cv['id'])
        part = [p for p in ((cv.get('participants') or {}).get('data') or []) if not es_mio(p, mi)]
        otro = part[0] if part else {}
        suyos = [m for m in msgs if not es_mio(m.get('from') or {}, mi)]
        ultimo = suyos[0] if suyos else None
        quien = (otro.get('username') or (ultimo or {}).get('from', {}).get('username') or '?')
        igsid = str((ultimo or {}).get('from', {}).get('id') or otro.get('id') or '')
        plan['conversaciones'].append({
            'id': cv['id'], 'usuario': quien, 'cuando': (ultimo or {}).get('created_time') or cv.get('updated_time'),
            'texto': ((ultimo or {}).get('message') or '')[:60]})
        if not ultimo: continue
        h = horas(ultimo.get('created_time'))
        con_palabra = [m for m in suyos if tiene_palabra(m.get('message'), palabra)]
        if con_palabra:
            m0 = con_palabra[0]
            if m0['id'] in hechos_d: continue
            reciente = personas.get(igsid)
            if reciente and (horas(reciente) or 999) < REENVIO_H: continue     # ya se le mandó hoy
            plan['dm'].append({'mensaje': m0['id'], 'conversacion': cv['id'], 'igsid': igsid,
                               'usuario': quien, 'texto': (m0.get('message') or '')[:120],
                               'cuando': m0.get('created_time'), 'horas': horas(m0.get('created_time')),
                               'fuera_de_ventana': (horas(m0.get('created_time')) or 0) > VENTANA_DM_H})
        else:
            plan['pendientes'].append({'igsid': igsid, 'usuario': quien, 'cuando': ultimo.get('created_time'),
                                       'horas': h, 'texto': (ultimo.get('message') or '')[:200],
                                       'mensaje': ultimo.get('id'), 'conversacion': cv['id']})
    # el capítulo de un DM: no se sabe de qué reel viene, así que va el default de la config
    cap_dm = str(c.get('capitulo_default') or '00')
    for d in plan['dm']: d['capitulo'] = cap_dm
    return plan


# ───────────────────────────────── estado ─────────────────────────────────

def mostrar_estado():
    c = cfg(); hecho = leer_json(estado_archivo('dm-libreta.hecho.json'), {})
    plan = revisar(c, hecho); mi = plan['mi']
    print(f'@{mi.get("username")} · {mi.get("followers_count")} seguidores · {mi.get("media_count")} medios '
          f'· palabra «{c.get("palabra")}» · activo={c.get("activo")} · datos en {CASA}')

    print(f'\n(a) conversaciones que ve la API: {len(plan["conversaciones"])}')
    if plan['error_conv']: print(f'    ✗ {sin_token(plan["error_conv"])}')
    for cv in plan['conversaciones'][:5]:
        print(f'    @{cv["usuario"]:22s} {str(cv["cuando"])[:16]}  {cv["texto"]!r}')
    if not plan['conversaciones'] and not plan['error_conv']:
        print('    (0 filas y sin error: mira «POR QUÉ conversations VIENE VACÍO» en el docstring —')
        print('     la app de Meta en modo Desarrollo esconde lo que genera quien no tiene rol)')

    print(f'\n(b) reels de la serie detectados: {len(plan["reels"])}')
    for m in plan['reels']:
        marca = {'id': '', 'titulo': ' (por título)', 'default': ' (POR OMISIÓN: no es capítulo de Don Chuy)'}[m['fuente']]
        print(f'    c={m["capitulo"]}  {m["id"]}  {str(m.get("timestamp"))[:10]}  '
              f'{(m.get("comments_count") or 0)} comentarios  {(m.get("caption") or "").splitlines()[0][:52]!r}{marca}')

    print(f'\n(c) comentarios con la palabra sin atender: {len(plan["comentarios"])}')
    for x in plan['comentarios']:
        print(f'    @{x["usuario"]:22s} c={x["capitulo"]}  {str(x["cuando"])[:16]}  {x["texto"]!r}'
              f'{"  ⚠ más de 7 días: ya no se puede responder en privado" if x["vencido"] else ""}')
    if plan['filtrado']:
        print('    ⚠ Meta manda CURSORES y 0 filas en reels que anuncian comentarios: modo Desarrollo')
        print('      (`python3 scripts/comentarios.py diagnostico` lo confirma; los 505 comentarios de')
        print('       public/comando/comentarios.json salieron por la puerta de Facebook Login)')

    print(f'\n(d) DMs con la palabra sin atender: {len(plan["dm"])}')
    for x in plan['dm']:
        print(f'    @{x["usuario"]:22s} {str(x["cuando"])[:16]}  {x["texto"]!r}'
              f'{"  ⚠ fuera de la ventana de 24 h" if x["fuera_de_ventana"] else ""}')

    print(f'\n(e) DMs SIN la palabra (los cierra un humano): {len(plan["pendientes"])}')
    for x in plan['pendientes'][:20]:
        print(f'    @{x["usuario"]:22s} {str(x["cuando"])[:16]}  {x["texto"][:70]!r}')
    p = estado_archivo('dm-libreta.pendientes.json')
    if os.path.exists(p):
        print(f'    (los guardados por el último tick: {p})')
    print(f'\natendidos hasta hoy: {len(hecho.get("comentarios") or {})} comentarios · '
          f'{len(hecho.get("dm") or {})} DMs')


# ────────────────────────────────── tick ──────────────────────────────────

def mandar_dm(destinatario, texto):
    """POST /{ig_id}/messages — la MISMA llamada para la respuesta privada a un comentario
    (`{"comment_id": …}`) y para el DM directo (`{"id": "<IGSID>"}`)."""
    return pedir('POST', f'{IG}/messages', cuerpo={'recipient': destinatario, 'message': {'text': texto}})


def responder_publico(comentario, texto):
    return pedir('POST', f'{comentario}/replies', forma={'message': texto})


def tick():
    c = cfg()
    ph = estado_archivo('dm-libreta.hecho.json')
    hecho = leer_json(ph, {})
    hecho.setdefault('comentarios', {}); hecho.setdefault('dm', {}); hecho.setdefault('personas', {})
    plan = revisar(c, hecho)
    seco = SECO or not c.get('activo')
    por_que = 'EN SECO' if SECO else ('activo: false' if not c.get('activo') else '')
    log(f'{len(plan["comentarios"])} comentarios · {len(plan["dm"])} DMs con la palabra · '
        f'{len(plan["pendientes"])} DMs para humano{f" · {por_que}: NO MANDO NADA" if seco else ""}')

    tareas = []
    for x in plan['comentarios']:
        if x['vencido']:
            log(f'= @{x["usuario"]}: el comentario tiene {x["horas"]/24:.1f} días (>{VENTANA_COMENTARIO_D}); '
                f'Meta ya no deja la respuesta privada — lo dejo para un humano'); continue
        tareas.append(('comentario', x))
    for x in plan['dm']:
        if x['fuera_de_ventana']:
            log(f'= @{x["usuario"]}: su último mensaje tiene {x["horas"]:.1f} h (>{VENTANA_DM_H}); '
                f'fuera de la ventana de mensajería — no se contesta'); continue
        if not x['igsid']:
            log(f'= @{x["usuario"]}: sin IGSID en el mensaje, no sé a quién mandarle'); continue
        tareas.append(('dm', x))

    if seco:
        for tipo, x in tareas:
            cap = x['capitulo']; semilla = x['id'] if tipo == 'comentario' else x['igsid']
            log(f'(seco) {tipo} @{x["usuario"]} c={cap} → DM: {texto_dm(c, cap, semilla)!r}')
            if tipo == 'comentario':
                log(f'(seco)   + respuesta pública en {x["id"]}: {c.get("respuesta_publica")!r}')
        if plan['pendientes']:
            log(f'(seco) anotaría {len(plan["pendientes"])} DMs sin la palabra en '
                f'{estado_archivo("dm-libreta.pendientes.json")}')
        if not tareas: log('(seco) nada que mandar')
        return

    guardar_json(estado_archivo('dm-libreta.pendientes.json'),
                 {'generado': dt.datetime.now().isoformat(timespec='seconds'), 'pendientes': plan['pendientes']})
    hechas = 0
    for i, (tipo, x) in enumerate(tareas):
        cap = x['capitulo']
        semilla = x['id'] if tipo == 'comentario' else x['igsid']
        destino = {'comment_id': x['id']} if tipo == 'comentario' else {'id': x['igsid']}
        r = mandar_dm(destino, texto_dm(c, cap, semilla))
        err = r.get('error') or {}
        if err:
            if es_bloqueo(err):
                log(f'✗ Instagram avisó bloqueo/spam: {sin_token(err)} — ME DETENGO'); guardar_json(ph, hecho); return
            if es_limite(err):
                log(f'✗ límite de la API: {sin_token(err)} — ME DETENGO (el siguiente tick reintenta)'); guardar_json(ph, hecho); return
            log(f'⚠ @{x["usuario"]} ({tipo}): {sin_token(err)[:200]}')
            continue
        reg = {'cuando': dt.datetime.now().isoformat(timespec='seconds'), 'usuario': x['usuario'],
               'capitulo': cap, 's': sid(semilla), 'mensaje': r.get('message_id') or r.get('id')}
        if tipo == 'comentario':
            reg['reel'] = x['reel']
            # la respuesta pública PROMETE el DM, así que solo se publica si el DM salió
            pub = responder_publico(x['id'], c.get('respuesta_publica') or '')
            if 'id' in pub: reg['publica'] = pub['id']
            else:
                reg['publica_error'] = sin_token(pub.get('error'))[:200]
                log(f'⚠ la respuesta pública en {x["id"]} no salió: {sin_token(pub.get("error"))[:160]}')
                if es_bloqueo(pub.get('error') or {}):
                    hecho['comentarios'][x['id']] = reg; guardar_json(ph, hecho)
                    log('✗ bloqueo/spam en la respuesta pública — ME DETENGO'); return
            hecho['comentarios'][x['id']] = reg
        else:
            reg['igsid'] = x['igsid']; reg['conversacion'] = x['conversacion']
            hecho['dm'][x['mensaje']] = reg
        if x.get('igsid'): hecho['personas'][x['igsid']] = reg['cuando']
        hechas += 1; guardar_json(ph, hecho)
        log(f'✓ {hechas}/{len(tareas)} {tipo} @{x["usuario"]} c={cap} s={reg["s"]}')
        if i + 1 < len(tareas):
            a, b = (c.get('espera_s') or [25, 45])[:2]
            time.sleep(random.uniform(float(a), float(b)))
    log(f'✓ listo: {hechas} libretas mandadas')


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    cmd = args[0] if args else ''
    if cmd == 'estado': mostrar_estado()
    elif cmd == 'tick': tick()
    else: sys.exit(__doc__)
