#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""estado-yt.py — qué hay en YouTube de la serie de tutoriales, según los manifiestos + la API.

  /home/ian/pub-venv/bin/python scripts/estado-yt.py

Imprime públicos (con vistas), privados/programados (con su publishAt) y el tamaño de la playlist.
Costo: 2 unidades (videos.list + playlists.list). Vivía en /tmp y la WSL lo borró al reiniciar (2026-09-11).
"""
import os, sys, json, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT
from googleapiclient.discovery import build


def credenciales():
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request
    CONF = os.path.expanduser('~/.config/gaia-pub'); TOKEN = os.path.join(CONF, 'youtube-token.json')
    SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl',
              'https://www.googleapis.com/auth/yt-analytics.readonly']
    c = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    if c.expired and c.refresh_token: c.refresh(Request()); open(TOKEN, 'w').write(c.to_json())
    return c

yt = build('youtube', 'v3', credentials=credenciales())
man = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'videos', 'tutorial-*.json'))):
    d = json.load(open(f)); v = ((d.get('publicar') or {}).get('subidas') or {}).get('yt') or {}
    if v.get('id'): man[v['id']] = (d['id'][9:11], v.get('publishAt') or v.get('publicar_cuando') or '')
r = yt.videos().list(part='status,statistics', id=','.join(man)).execute()
items = {i['id']: i for i in r['items']}
pub = sorted((man[i][0], int(items[i]['statistics'].get('viewCount', 0))) for i in items if items[i]['status']['privacyStatus'] == 'public')
priv = sorted((man[i][0], (items[i]['status'].get('publishAt') or man[i][1])[:16]) for i in items if items[i]['status']['privacyStatus'] != 'public')
falt = sorted(man[i][0] for i in man if i not in items)
print(f'públicos: {len(pub)} · vistas: {sum(v for _, v in pub)} → ' + ' '.join(f'{n}({v})' for n, v in pub))
print(f'privados/programados: {len(priv)} → ' + ' '.join(f'{n}@{p}' for n, p in priv))
if falt: print('en manifiesto pero NO en YouTube:', ' '.join(falt))
pl = json.load(open(os.path.join(ROOT, 'videos', '_playlist-tutoriales.json')))
p = yt.playlists().list(part='contentDetails', id=pl['id']).execute()['items'][0]
print(f"playlist: {p['contentDetails']['itemCount']} videos · {pl['url']}")
