#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""reprogramar-yt.py — alinea la fecha de publicación en YouTube con `publicar.programar` del manifiesto.

  /home/ian/pub-venv/bin/python scripts/reprogramar-yt.py [tutorial-01-… …]   (sin args: todos los videos/*.json)

Para cada video ya subido cuyo `subidas.yt.publishAt` difiera de `publicar.programar`, hace
videos.update(status: private + publishAt nuevo) y registra el cambio. Idempotente. Cuota: 50 por video.
Nació el 2026-09-07 cuando Ian pasó la serie de 2 a 5 videos por día.
"""
import os, sys, glob, json
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, guardar_manifiesto
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


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
yt = None; cambiados = 0
for p in files:
    try: d = json.load(open(p, encoding='utf-8'))
    except Exception: continue
    pub = d.get('publicar') or {}; ytinfo = (pub.get('subidas') or {}).get('yt') or {}
    quiere = pub.get('programar') or ''
    if not ytinfo.get('id'): continue

    # CASO B — el que YouTube ya publicó una vez no se puede volver a programar (`invalidPublishAt`,
    # visto con el 24 el 2026-09-08: subió PÚBLICO por su cuenta y al esconderlo perdió el derecho a
    # publishAt). Queda privado con `publicar_cuando` y lo suelta esta misma función cuando llegue
    # la hora — a lo más una corrida tarde, que para documentación no le hace daño a nadie.
    manual = ytinfo.get('publicar_cuando')
    if manual:
        if datetime.now(timezone.utc) < datetime.fromisoformat(manual): continue
        yt = yt or build('youtube', 'v3', credentials=credenciales())
        try:
            yt.videos().update(part='status', body={'id': ytinfo['id'], 'status': {
                'privacyStatus': 'public', 'selfDeclaredMadeForKids': False}}).execute()
        except HttpError as e:
            print(f'  ✗ {d.get("id")}: {str(e)[:120]}')
            if 'quota' in str(e): print('  (cuota agotada: vuelve a correr mañana)'); break
            continue
        fresco = json.load(open(p, encoding='utf-8'))
        fresco['publicar']['subidas']['yt'].update({'privacidad': 'public', 'publicar_cuando': None})
        guardar_manifiesto(p, fresco); cambiados += 1
        print(f'  ✓ {d.get("id")}: PUBLICADO (le tocaba {manual[:10]})'); continue

    if not quiere or ytinfo.get('publishAt') == quiere: continue
    yt = yt or build('youtube', 'v3', credentials=credenciales())
    try:
        yt.videos().update(part='status', body={'id': ytinfo['id'], 'status': {
            'privacyStatus': 'private', 'publishAt': quiere, 'selfDeclaredMadeForKids': False}}).execute()
    except HttpError as e:
        if 'invalidPublishAt' in str(e):
            # esconderlo hasta su día y soltarlo entonces (caso B de arriba)
            try:
                yt.videos().update(part='status', body={'id': ytinfo['id'], 'status': {
                    'privacyStatus': 'private', 'selfDeclaredMadeForKids': False}}).execute()
            except HttpError as e2:
                print(f'  ✗ {d.get("id")}: {str(e2)[:120]}'); continue
            fresco = json.load(open(p, encoding='utf-8'))
            fresco['publicar']['subidas']['yt'].update({'privacidad': 'private', 'publishAt': None, 'publicar_cuando': quiere})
            guardar_manifiesto(p, fresco); cambiados += 1
            print(f'  ✓ {d.get("id")}: ya se había publicado → privado, sale solo el {quiere[:10]}'); continue
        print(f'  ✗ {d.get("id")}: {str(e)[:120]}')
        if 'quota' in str(e): print('  (cuota agotada: vuelve a correr mañana)'); break
        continue
    fresco = json.load(open(p, encoding='utf-8'))
    fresco['publicar']['subidas']['yt']['publishAt'] = quiere
    guardar_manifiesto(p, fresco); cambiados += 1
    print(f'  ✓ {d.get("id")}: {ytinfo.get("publishAt","?")[:10]} → {quiere[:10]}')
print(f'reprogramados: {cambiados}')
