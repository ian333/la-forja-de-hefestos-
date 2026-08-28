#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""subir-youtube.py — sube el master a YouTube por la API oficial (Data API v3), con captions y programación.
Según la doc (2026-08-26): videos.insert cuesta 1 unidad del cupo de uploads (100/día); captions.insert 400
unidades (10,000/día); scopes youtube.upload + youtube.force-ssl; OAuth de app de ESCRITORIO con redirect
loopback http://127.0.0.1:PORT; refresh token dura mientras la app esté "In production" (en Testing caduca a
los 7 días). Resumable con reintentos (500/502/503/504).

  /home/ian/pub-venv/bin/python scripts/subir-youtube.py <id> [--publico|--privado|--no-listado] [--programar 2026-08-27T15:00:00-06:00] [--sin-captions] [--yo-autorizo]
  primera vez: imprime una URL → ian la abre en su navegador (Windows llega al 127.0.0.1 de WSL) → token en ~/.config/gaia-pub/youtube-token.json
  requiere ~/.config/gaia-pub/client_secret.json (OAuth client "Desktop app" del proyecto de Google Cloud).
"""
import os, sys, time, random, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import manifiesto, copy_de, gate_autorizado, gate_calidad, archivo_master, segs_a_srt, registrar, CONF
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
from googleapiclient.errors import HttpError

SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl',
          'https://www.googleapis.com/auth/yt-analytics.readonly']
SECRET = os.path.join(CONF, 'client_secret.json'); TOKEN = os.path.join(CONF, 'youtube-token.json')

def credenciales():
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES) if os.path.exists(TOKEN) else None
    if creds and creds.valid: return creds
    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        if not os.path.exists(SECRET): sys.exit(f'✗ falta {SECRET} (descárgalo del OAuth client "Desktop app" en Google Cloud Console)')
        flow = InstalledAppFlow.from_client_secrets_file(SECRET, SCOPES)
        # loopback en WSL: ian abre la URL en Windows; el navegador redirige a 127.0.0.1:8765 que WSL2 sí recibe
        creds = flow.run_local_server(host='127.0.0.1', port=8765, open_browser=False,
                                      authorization_prompt_message='\n▶ ABRE ESTA URL EN TU NAVEGADOR (una sola vez):\n{url}\n')
    open(TOKEN, 'w').write(creds.to_json()); return creds

def subir(vid, privacidad, programar, con_captions, forzar):
    p, d = manifiesto(vid); c = copy_de(d); gate_autorizado(d, 'yt', forzar)
    # ARCHIVO= sobreescribe qué se sube. Sirve para (a) el master HEVC 10-bit, que a YouTube
    # le conviene más que el h264 —YouTube re-encodea a VP9/AV1 y un origen de 10 bits reduce
    # el banding en degradados oscuros, que es TODO nuestro contenido—, y (b) las variantes de
    # formato (16:9) que viven con sufijo -WxH. CLAVE= elige bajo qué llave se registra en el
    # manifiesto, para que 9:16 y 16:9 no se pisen (`yt` y `yt16x9`).
    archivo = os.environ.get('ARCHIVO') or archivo_master(d, 'h264')
    if not os.path.isabs(archivo):
        archivo = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), archivo)
    if not os.path.exists(archivo): sys.exit(f'✗ no existe {archivo}')
    clave = os.environ.get('CLAVE', 'yt')
    print(f'   archivo: {os.path.basename(archivo)} · registra en publicar.subidas.{clave}')
    gate_calidad(archivo)   # LEY ABSOLUTA: solo 4K / bitrate altísimo
    yt = build('youtube', 'v3', credentials=credenciales())
    tags = [h.lstrip('#') for h in c.get('hashtags', [])][:30]
    status = {'privacyStatus': privacidad, 'selfDeclaredMadeForKids': False}
    if programar:
        status['privacyStatus'] = 'private'; status['publishAt'] = programar   # la doc: publishAt exige private
    body = {'snippet': {'title': c['titulo'][:100], 'description': c.get('descripcion', '')[:5000], 'tags': tags,
                        'categoryId': '28', 'defaultLanguage': 'es'},            # 28 = Science & Technology
            'status': status}
    media = MediaFileUpload(archivo, chunksize=8 * 1024 * 1024, resumable=True)
    req = yt.videos().insert(part='snippet,status', body=body, media_body=media, notifySubscribers=True)
    print(f'▶ subiendo {os.path.basename(archivo)} ({os.path.getsize(archivo)/1e6:.0f} MB) · {status}')
    resp, intento = None, 0
    while resp is None:
        try:
            st, resp = req.next_chunk()
            if st: print(f'   {int(st.progress()*100):3d} %', flush=True)
        except HttpError as e:
            if e.resp.status in (500, 502, 503, 504) and intento < 10:
                intento += 1; espera = random.random() * (2 ** intento); print(f'   reintento {intento} en {espera:.0f}s ({e.resp.status})'); time.sleep(espera)
            else: raise
    vid_id = resp['id']; url = f'https://youtu.be/{vid_id}'
    print(f'✓ subido: {url}')
    info = {'id': vid_id, 'url': url, 'privacidad': status['privacyStatus'], 'publishAt': programar or ''}
    if con_captions:
        srt = segs_a_srt(d)
        if srt:
            try:
                cap = yt.captions().insert(part='snippet', body={'snippet': {'videoId': vid_id, 'language': 'es', 'name': 'Español', 'isDraft': False}},
                                           media_body=MediaFileUpload(srt, mimetype='application/octet-stream')).execute()
                info['captions'] = cap['id']; print(f'✓ captions (es) subidos desde segs.json: {cap["id"]}')
            except HttpError as e: print(f'   ⚠ captions fallaron: {e}')
    registrar(p, d, clave, info)

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or a[0].startswith('-'): sys.exit(__doc__)
    priv = 'unlisted' if '--no-listado' in a else 'public' if '--publico' in a else 'private'
    prog = a[a.index('--programar') + 1] if '--programar' in a else None
    subir(a[0], priv, prog, '--sin-captions' not in a, '--yo-autorizo' in a)
