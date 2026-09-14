#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""primer-comentario.py — publica `publicar.primer_comentario` del manifiesto como el primer comentario
de la pieza en YouTube y/o Instagram. Idempotente: si `publicar.subidas.<plataforma>.comentario` ya
existe, no repite.

Por qué (ian, 2026-09-14, capítulo 1 de LA ECONOMÍA DE TU NEGOCIO): «en los comentarios debes explicar
a gente no educada, con ejemplos simples, ideas que un niño y una abuela entienden». En Instagram lo
hace PRIME solo, justo después de publicar el reel (cola-publicar.py tick); este script es para
YouTube y para reintentar a mano cualquiera de los dos.

YouTube no deja comentar un video privado: si la pieza está programada con publishAt, el script
ESPERA hasta la hora (--esperar) o sale sin tocar nada.

  /home/ian/pub-venv/bin/python scripts/primer-comentario.py <id> yt|ig|todo [--esperar]
"""
import os, sys, json, time, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import manifiesto, registrar, CONF

V = 'v25.0'


def texto(d):
    t = ((d.get('publicar') or {}).get('primer_comentario') or '').strip()
    if not t: sys.exit('✗ el manifiesto no trae publicar.primer_comentario')
    return t


def youtube(p, d, esperar):
    y = ((d.get('publicar') or {}).get('subidas') or {}).get('yt') or {}
    if not y.get('id'): print('   (YouTube: la pieza no está subida)'); return
    if y.get('comentario'): print(f'   (YouTube: ya tiene primer comentario {y["comentario"]})'); return
    cuando = y.get('publishAt')
    if cuando:
        t = dt.datetime.fromisoformat(cuando.replace('Z', '+00:00'))
        falta = (t - dt.datetime.now(dt.timezone.utc)).total_seconds() + 120     # 2 min de colchón tras hacerse público
        if falta > 0:
            if not esperar: print(f'   (YouTube: programado a {cuando}; faltan {falta/60:.0f} min — usa --esperar)'); return
            print(f'   … YouTube se hace público a {cuando}: espero {falta/60:.0f} min'); time.sleep(falta)
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/yt-analytics.readonly']
    yt = build('youtube', 'v3', credentials=Credentials.from_authorized_user_file(os.path.join(CONF, 'youtube-token.json'), SCOPES))
    for intento in range(6):
        try:
            r = yt.commentThreads().insert(part='snippet', body={'snippet': {'videoId': y['id'], 'topLevelComment': {'snippet': {'textOriginal': texto(d)}}}}).execute()
            break
        except Exception as e:
            print(f'   ⚠ YouTube intento {intento + 1}: {str(e)[:160]}')
            if intento == 5: return
            time.sleep(300)
    d = json.load(open(p, encoding='utf-8'))            # relee: pudo cambiar mientras esperaba
    registrar(p, d, 'yt', {**d['publicar']['subidas']['yt'], 'comentario': r['id']})
    print(f'✓ YouTube: primer comentario {r["id"]} en https://youtu.be/{y["id"]}')


def instagram(p, d):
    import requests
    ig = ((d.get('publicar') or {}).get('subidas') or {}).get('ig') or {}
    if not ig.get('id'): print('   (Instagram: sin id en el manifiesto — corre cola-publicar.py cosechar primero)'); return
    if ig.get('comentario'): print(f'   (Instagram: ya tiene primer comentario {ig["comentario"]})'); return
    tk = json.load(open(os.path.join(CONF, 'instagram-token.json')))['access_token']
    r = requests.post(f'https://graph.instagram.com/{V}/{ig["id"]}/comments', data={'message': texto(d)[:2200], 'access_token': tk}, timeout=60).json()
    if 'id' not in r: print(f'   ✗ Instagram: {str(r)[:200]}'); return
    registrar(p, d, 'ig', {**ig, 'comentario': r['id']})
    print(f'✓ Instagram: primer comentario {r["id"]}')


def main(a):
    if len(a) < 2 or a[1] not in ('yt', 'ig', 'todo'): sys.exit(__doc__)
    p, d = manifiesto(a[0])
    texto(d)
    if a[1] in ('yt', 'todo'): youtube(p, d, '--esperar' in a)
    if a[1] in ('ig', 'todo'): instagram(p, json.load(open(p, encoding='utf-8')))


if __name__ == '__main__': main(sys.argv[1:])
