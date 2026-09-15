#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""responder-comentarios.py — publica las respuestas de `public/comando/respuestas-comentarios.json`.

Por qué (ian, 2026-09-14): «contesta todos los positivos, no con algo tan largo… hay que ser buenos
maestros; no somos nadie para criticar las creencias religiosas de otras personas, pero podemos ser
cálidos». Las respuestas las escribe una persona (o Claude leyendo cada comentario) en el JSON; este
script solo las publica, despacio y con registro.

  · Instagram: POST graph.instagram.com/{V}/{comentario}/replies con el token de Instagram de largo
    plazo (instagram_business_manage_comments; sonda 2026-09-14: mensaje vacío → #100, o sea permiso OK).
  · YouTube:   comments.insert(parentId=hilo) con el token de YouTube (youtube.force-ssl).
  · Despacio: 45-90 s entre respuestas de Instagram y 15-30 s en YouTube, para no parecer spam.
  · Reanudable: cada respuesta publicada queda en el JSON (`respondido`); lo ya contestado se salta.
  · Se DETIENE si Instagram avisa bloqueo o spam (código 368 o «block»/«spam» en el mensaje).
  · Sin token de Instagram en esta máquina (la laptop), usa el token de USUARIO de Facebook de 60 días
    (graph.facebook.com, permiso instagram_manage_comments; sonda 2026-09-15: vacío → #100).
  · Antes de cada respuesta de Instagram PREGUNTA si la cuenta ya contestó ese comentario: si sí, la
    marca «ya-estaba» y no publica. Así dos máquinas con copias distintas del JSON nunca contestan doble.

  python3 scripts/responder-comentarios.py [--seco] [--limite N] [--solo ig|yt] [--tanda AAAA-MM-DD] [--fb]
"""
import os, sys, json, time, random, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, CONF

V = 'v25.0'
ARCH = os.path.join(ROOT, 'public', 'comando', 'respuestas-comentarios.json')
arg = lambda k, dflt: sys.argv[sys.argv.index(k) + 1] if k in sys.argv else dflt
SECO = '--seco' in sys.argv
LIMITE = int(arg('--limite', '100000'))
SOLO = arg('--solo', '')
TANDA = arg('--tanda', '')
CUENTA = 'gaiaprime_mx'


def guardar(doc):
    tmp = ARCH + '.tmp'
    json.dump(doc, open(tmp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    os.replace(tmp, ARCH)


def log(m): print(f'{dt.datetime.now().strftime("%H:%M:%S")}  {m}', flush=True)


def main():
    doc = json.load(open(ARCH, encoding='utf-8'))
    pend = [e for e in doc['respuestas'] if e.get('respuesta') and not e.get('respondido') and (not SOLO or e['plataforma'] == SOLO) and (not TANDA or e.get('tanda') == TANDA)]
    pend.sort(key=lambda e: (0 if e['plataforma'] == 'yt' else 1, -e['likes']))     # YouTube primero; en IG, lo más votado primero
    pend = pend[:LIMITE]
    log(f'{len(pend)} respuestas pendientes ({sum(e["plataforma"] == "ig" for e in pend)} Instagram · {sum(e["plataforma"] == "yt" for e in pend)} YouTube){" · EN SECO" if SECO else ""}')
    if SECO:
        for e in pend[:10]: log(f'   [{e["plataforma"]}] @{e["autor"]}: {e["comentario"][:50]!r} → {e["respuesta"][:60]!r}')
        return
    import requests
    ig_local = os.path.join(CONF, 'instagram-token.json')
    if '--fb' in sys.argv or not os.path.exists(ig_local):
        host, tk = 'graph.facebook.com', json.load(open(os.path.join(CONF, 'facebook-user-token.json')))['access_token']
    else:
        host, tk = 'graph.instagram.com', json.load(open(ig_local))['access_token']
    if any(e['plataforma'] == 'ig' for e in pend): log(f'Instagram por {host}')
    yt = None
    hechas = 0
    for i, e in enumerate(pend):
        try:
            if e['plataforma'] == 'ig':
                ya = requests.get(f'https://{host}/{V}/{e["comentario_id"]}/replies', params={'fields': 'username', 'access_token': tk}, timeout=60).json()
                if any(x.get('username') == CUENTA for x in ya.get('data', [])):
                    e['respondido'] = {'id': 'ya-estaba', 'fecha': dt.datetime.now().isoformat(timespec='seconds')}; guardar(doc)
                    log(f'= @{e["autor"]}: la cuenta ya lo había contestado; no publico'); continue
                for intento in range(3):
                    r = requests.post(f'https://{host}/{V}/{e["comentario_id"]}/replies',
                                      data={'message': e['respuesta'], 'access_token': tk}, timeout=60).json()
                    err = r.get('error') or {}
                    msg = str(err.get('message', '')).lower()
                    if 'id' in r: break
                    if err.get('code') == 368 or 'block' in msg or 'spam' in msg:
                        log(f'✗ Instagram avisó bloqueo/spam: {err} — ME DETENGO (lo ya publicado queda registrado)'); guardar(doc); return
                    if err.get('code') in (4, 17, 32, 613) or 'limit' in msg:
                        log(f'   … límite de la API ({err.get("message")}); espero 15 min'); time.sleep(900); continue
                    break
                if 'id' not in r:
                    e['error'] = str(r)[:300]; log(f'⚠ @{e["autor"]}: {str(r)[:160]}'); guardar(doc); continue
                rid = r['id']
            else:
                if yt is None:
                    from google.oauth2.credentials import Credentials
                    from googleapiclient.discovery import build
                    SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/yt-analytics.readonly']
                    yt = build('youtube', 'v3', credentials=Credentials.from_authorized_user_file(os.path.join(CONF, 'youtube-token.json'), SCOPES))
                rid = yt.comments().insert(part='snippet', body={'snippet': {'parentId': e['comentario_id'], 'textOriginal': e['respuesta']}}).execute()['id']
            e['respondido'] = {'id': rid, 'fecha': dt.datetime.now().isoformat(timespec='seconds')}; e.pop('error', None)
            hechas += 1; guardar(doc)
            log(f'✓ {hechas}/{len(pend)} [{e["plataforma"]}] @{e["autor"]}: {e["respuesta"][:70]}')
        except Exception as ex:
            e['error'] = str(ex)[:300]; guardar(doc); log(f'⚠ @{e["autor"]}: {str(ex)[:160]}')
        if i + 1 < len(pend):
            time.sleep(random.uniform(45, 90) if e['plataforma'] == 'ig' else random.uniform(15, 30))
    log(f'✓ listo: {hechas} respuestas publicadas')


if __name__ == '__main__': main()
