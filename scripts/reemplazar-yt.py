#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""reemplazar-yt.py — un tutorial ya subido resultó MAL (la receta mentía) y hay master nuevo.

  /home/ian/pub-venv/bin/python scripts/reemplazar-yt.py tutorial-21-nota-de-credito [--si]

YouTube no permite cambiar el archivo de un video: se BORRA el viejo (videos.delete, 50 unidades)
y se deja el manifiesto sin `subidas.yt` para que yt-pendientes.sh (cron horario en ian-gpu)
lo vuelva a subir con su copy, captions, fecha y playlist como si fuera nuevo. El viejo queda
anotado en `publicar.reemplazos` (id, url, vistas al momento, por qué).

Sólo borra si el viejo sigue PRIVADO (programado) o tiene 0 vistas: un tutorial que ya vio gente
se reemplaza a mano y con Ian. Nació el 2026-09-10 con el 21: el `expect` demostró que "Crear Nota
de Crédito" se clickeaba con Devolver=0 y no creaba nada mientras la voz decía "listo".
"""
import os, sys, json, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, guardar_manifiesto, archivo_master
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

vid = next((a for a in sys.argv[1:] if not a.startswith('--')), None)
motivo = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--motivo=')), 'receta corregida (expect)')
if not vid: sys.exit(__doc__)
p = os.path.join(ROOT, 'videos', f'{vid}.json'); d = json.load(open(p, encoding='utf-8'))
yt_old = ((d.get('publicar') or {}).get('subidas') or {}).get('yt') or {}
if not yt_old.get('id'): sys.exit(f'{vid}: no está en YouTube, nada que reemplazar (súbelo normal)')
master = archivo_master(d)
if not master or not os.path.exists(master): sys.exit(f'{vid}: no hay master nuevo en {master}')
edad_h = (datetime.datetime.now().timestamp() - os.path.getmtime(master)) / 3600
if edad_h > 48: sys.exit(f'{vid}: el master tiene {edad_h:.0f} h — ¿seguro que es el re-render? (>48 h)')

yt = build('youtube', 'v3', credentials=credenciales())
r = yt.videos().list(part='status,statistics', id=yt_old['id']).execute().get('items') or []
if not r: print(f'  · {vid}: el video {yt_old["id"]} ya no existe en YouTube; limpio el manifiesto')
else:
    st, vistas = r[0]['status']['privacyStatus'], int(r[0]['statistics'].get('viewCount', 0))
    print(f'  {vid}: {yt_old["id"]} · {st} · {vistas} vistas · master nuevo de hace {edad_h:.1f} h')
    if st == 'public' and vistas > 0:
        sys.exit('  ✗ ya es público y con vistas: esto se decide con Ian, no solo')
    if '--si' not in sys.argv: sys.exit('  (simulación; agrega --si para borrar y re-subir)')
    try: yt.videos().delete(id=yt_old['id']).execute()
    except HttpError as e: sys.exit(f'  ✗ delete: {str(e)[:120]}')
    print(f'  ✓ borrado {yt_old["id"]}')
fresco = json.load(open(p, encoding='utf-8'))
fresco['publicar'].setdefault('reemplazos', []).append({**yt_old, 'borrado': datetime.datetime.now().isoformat(timespec='minutes'), 'motivo': motivo})
fresco['publicar']['subidas'].pop('yt', None)
guardar_manifiesto(p, fresco)
print(f'  ✓ manifiesto sin subidas.yt → yt-pendientes.sh lo sube en la próxima hora (programado {fresco["publicar"].get("programar","")[:16]})')
