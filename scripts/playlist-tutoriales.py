#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""playlist-tutoriales.py — todos los tutoriales subidos, en UNA playlist del canal (idempotente).

  /home/ian/pub-venv/bin/python scripts/playlist-tutoriales.py [--titulo "…"]

Busca la playlist por título (la crea pública si no existe), agrega los videos de
videos/tutorial-*.json que tengan `publicar.subidas.yt.id` y aún no estén, en orden de serie,
y deja el id/url en videos/_playlist-tutoriales.json y en cada manifiesto (`subidas.yt.playlist`).
Cuota: playlists.list 1 · playlists.insert 50 · playlistItems.list 1 · playlistItems.insert 50 por video.
"""
import os, sys, glob, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, guardar_manifiesto
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

TITULO = sys.argv[sys.argv.index('--titulo') + 1] if '--titulo' in sys.argv else 'Tutoriales HERMES · GAIA Prime (ERP para PyMEs)'
DESCR = ('Aprende HERMES, el ERP de GAIA Prime, un proceso a la vez: notas de venta, facturación CFDI 4.0, '
         'inventario, cobranza, compras y reportes. Cada video es un flujo real, de principio a fin. '
         'https://gaiaprime.com.mx')


def credenciales():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    CONF = os.path.expanduser('~/.config/gaia-pub'); TOKEN = os.path.join(CONF, 'youtube-token.json')
    SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl',
              'https://www.googleapis.com/auth/yt-analytics.readonly']
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request()); open(TOKEN, 'w').write(creds.to_json())
    return creds


yt = build('youtube', 'v3', credentials=credenciales())


def _cuota(e):
    # 403 quotaExceeded: no es error del script; se reintenta al día siguiente (cron)
    if 'quota' in str(e):
        print('✗ cuota diaria de YouTube agotada — vuelve a correr después de la 01:00 CST'); sys.exit(1)
    raise e


estado_p = os.path.join(ROOT, 'videos', '_playlist-tutoriales.json')
estado = json.load(open(estado_p)) if os.path.exists(estado_p) else {}

# 1) la playlist (por id guardado, si no por título, si no se crea)
recien_creada = False
pl_id = estado.get('id')
if not pl_id:
    tok = None
    while True:
        try: r = yt.playlists().list(part='snippet', mine=True, maxResults=50, pageToken=tok).execute()
        except HttpError as e: _cuota(e)
        for it in r.get('items', []):
            if it['snippet']['title'].strip().lower() == TITULO.strip().lower():
                pl_id = it['id']; break
        tok = r.get('nextPageToken')
        if pl_id or not tok: break
if not pl_id:
    try:
        r = yt.playlists().insert(part='snippet,status', body={
            'snippet': {'title': TITULO, 'description': DESCR, 'defaultLanguage': 'es'},
            'status': {'privacyStatus': 'public'}}).execute()
    except HttpError as e: _cuota(e)
    pl_id = r['id']; recien_creada = True; print(f'✓ playlist creada: {TITULO}')
url = f'https://www.youtube.com/playlist?list={pl_id}'
estado.update({'id': pl_id, 'url': url, 'titulo': TITULO}); json.dump(estado, open(estado_p, 'w'), ensure_ascii=False, indent=2)
print(f'playlist: {url}')

# 2) qué ya está dentro
# Una playlist RECIÉN creada tarda unos segundos en poder listarse: playlistItems.list devuelve
# 404 "playlist cannot be found" (visto 2026-09-08, tumbó la primera corrida). Es propagación,
# no un error nuestro: si acabamos de crearla, está vacía por definición.
dentro = {}; tok = None   # videoId → {item, pos}
while True:
    try: r = yt.playlistItems().list(part='snippet,contentDetails', playlistId=pl_id, maxResults=50, pageToken=tok).execute()
    except HttpError as e:
        if e.resp.status == 404 and recien_creada:
            print('  (playlist recién creada, aún no lista para listar: la trato como vacía)'); break
        _cuota(e)
    for it in r.get('items', []): dentro[it['contentDetails']['videoId']] = {'item': it['id'], 'pos': it['snippet']['position']}
    tok = r.get('nextPageToken')
    if not tok: break

# 3) agregar los que faltan, en orden de serie
agregados = 0
for p in sorted(glob.glob(os.path.join(ROOT, 'videos', 'tutorial-*.json'))):
    d = json.load(open(p, encoding='utf-8'))
    vid = ((d.get('publicar') or {}).get('subidas') or {}).get('yt', {}).get('id')
    if not vid: continue
    if vid in dentro:
        marca = False
    else:
        try:
            yt.playlistItems().insert(part='snippet', body={'snippet': {
                'playlistId': pl_id, 'resourceId': {'kind': 'youtube#video', 'videoId': vid}}}).execute()
            dentro[vid] = {'item': None, 'pos': len(dentro)}; agregados += 1; marca = True; print(f'  + {d["id"]}')
        except HttpError as e:
            print(f'  ✗ {d["id"]}: {str(e)[:120]}')
            if 'quota' in str(e): print('  (cuota agotada: vuelve a correr mañana)'); break
            continue
    if (d['publicar']['subidas']['yt'].get('playlist') or '') != url:
        fresco = json.load(open(p, encoding='utf-8')); fresco['publicar']['subidas']['yt']['playlist'] = url
        guardar_manifiesto(p, fresco)
print(f'en playlist: {len(dentro)} · agregados ahora: {agregados}')

# 4) fantasmas: un video borrado (reemplazar-yt.py) deja "Deleted video" en la playlist PÚBLICA.
#    Fuera todo lo que no sea un id de los manifiestos (50 unidades cada uno).
conocidos = {}
for p in sorted(glob.glob(os.path.join(ROOT, 'videos', 'tutorial-*.json'))):
    d = json.load(open(p, encoding='utf-8'))
    vid = ((d.get('publicar') or {}).get('subidas') or {}).get('yt', {}).get('id')
    if vid: conocidos[vid] = d['id'][9:11]
borrados = 0
for vid, info in list(dentro.items()):
    if vid in conocidos or not info.get('item'): continue
    try: yt.playlistItems().delete(id=info['item']).execute(); del dentro[vid]; borrados += 1
    except HttpError as e:
        print(f'  ✗ fantasma {vid}: {str(e)[:100]}')
        if 'quota' in str(e): break
if borrados: print(f'fantasmas borrados: {borrados}')

# 5) orden = orden de la serie (los reemplazos se agregan al final). Se mueve UN item fuera de
#    lugar por vuelta (50 unidades) hasta MAX_MOVES; el cron horario converge en pocas horas.
MAX_MOVES = int(os.environ.get('PLAYLIST_MAX_MOVES', '8')); movidos = 0
# Se lista UNA vez y los movimientos se simulan en local: re-listar justo después de un update
# devuelve posiciones viejas (consistencia eventual) y el mismo item se movía dos veces (2026-09-11).
items, tok = [], None
try:
    while True:
        r = yt.playlistItems().list(part='snippet', playlistId=pl_id, maxResults=50, pageToken=tok).execute()
        items += r.get('items', []); tok = r.get('nextPageToken')
        if not tok: break
except HttpError as e: _cuota(e)
items.sort(key=lambda i: i['snippet']['position'])
actual = [it['snippet']['resourceId']['videoId'] for it in items]
deseado = sorted((v for v in actual if v in conocidos), key=lambda v: conocidos[v])
while movidos < MAX_MOVES and actual != deseado:
    k = next(i for i, (x, y) in enumerate(zip(actual, deseado)) if x != y)
    vid = deseado[k]; it = next(i for i in items if i['snippet']['resourceId']['videoId'] == vid)
    try:
        yt.playlistItems().update(part='snippet', body={'id': it['id'], 'snippet': {
            'playlistId': pl_id, 'resourceId': it['snippet']['resourceId'], 'position': k}}).execute()
    except HttpError as e:
        print(f'  ✗ mover {conocidos[vid]}: {str(e)[:100]}'); break
    actual.insert(k, actual.pop(actual.index(vid))); movidos += 1; print(f'  ↕ {conocidos[vid]} → posición {k + 1}')
if movidos: print(f'reordenados: {movidos}' + (' (quedan más; el cron sigue)' if movidos >= MAX_MOVES else ''))
