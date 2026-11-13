#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""captions-pendientes.py — sube los subtítulos (segs.json → SRT) de videos que YA están en YouTube
pero se quedaron sin captions (2026-09-07: la cuota diaria se acabó a media tanda; el video subió y
`captions.insert` dio 403 quotaExceeded). Idempotente: salta los que ya traen `subidas.yt.captions`.

  /home/ian/pub-venv/bin/python scripts/captions-pendientes.py [tutorial-14-… …]   (sin args: todos los videos/*.json)
"""
import os, sys, glob, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, segs_a_srt, guardar_manifiesto
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError
from googleapiclient.discovery import build


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

ids = [a for a in sys.argv[1:] if not a.startswith('--')]
files = [os.path.join(ROOT, 'videos', f'{i}.json') for i in ids] or sorted(glob.glob(os.path.join(ROOT, 'videos', '*.json')))
yt = None; hechos = 0
for p in files:
    try: d = json.load(open(p, encoding='utf-8'))
    except Exception: continue
    ytinfo = ((d.get('publicar') or {}).get('subidas') or {}).get('yt') or {}
    if not ytinfo.get('id') or ytinfo.get('captions'): continue
    srt = segs_a_srt(d)
    if not srt: print(f'  {d.get("id")}: sin segs.json, nada que subir'); continue
    yt = yt or build('youtube', 'v3', credentials=credenciales())
    try:
        cap = yt.captions().insert(part='snippet', body={'snippet': {'videoId': ytinfo['id'], 'language': 'es', 'name': 'Español', 'isDraft': False}},
                                   media_body=MediaFileUpload(srt, mimetype='application/octet-stream')).execute()
    except HttpError as e:
        # 409 = ya hay pista en ese idioma (el manifiesto perdió el id, no YouTube la pista).
        # Sin esto el runner horario lo reintenta para siempre y quema 400 unidades cada vez.
        if e.resp.status == 409:
            fresco = json.load(open(p, encoding='utf-8'))
            fresco['publicar']['subidas']['yt']['captions'] = 'ya-existia'
            guardar_manifiesto(p, fresco)
            print(f'  · {d.get("id")}: ya tenía subtítulos en YouTube'); continue
        print(f'  ✗ {d.get("id")}: {str(e)[:120]}')
        if 'quota' in str(e): print('  (cuota agotada: vuelve a correr mañana)'); break
        continue
    fresco = json.load(open(p, encoding='utf-8'))      # relee (regla de pub_comun.registrar)
    fresco['publicar']['subidas']['yt']['captions'] = cap['id']
    guardar_manifiesto(p, fresco); hechos += 1
    print(f'  ✓ {d.get("id")}: captions {cap["id"]}')
print(f'captions subidos: {hechos}')
