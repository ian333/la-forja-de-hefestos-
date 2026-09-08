#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""comentarios.py — TODOS los comentarios de TODOS los videos (Instagram + YouTube), con respuestas.

Por qué existe (ian, 2026-09-08): «REVISA LOS COMENTARIOS de todos los videos, haz un análisis de
todos los comentarios: la gente nos ama… no hay punto medio, o nos aman o nos tiran caca».
Hasta hoy `metricas-instagram.py` bajaba 100 comentarios por reel SOLO de los reels con manifiesto
(10 de ~80) y sin autor ni respuestas. Esto enumera el catálogo COMPLETO desde las dos APIs:

  Instagram : GET /me/media (paginado) → GET /{media}/comments?fields=…,replies{…} (paginado)
  YouTube   : channels.list(mine) → uploads playlist → playlistItems (paginado)
              → commentThreads.list(part=snippet,replies) (paginado)

Escribe `public/comando/comentarios.json` (EN EL REPO: se lee desde la laptop sin entrar a iangpu).
Une cada medio con su manifiesto (`publicar.subidas.ig.id` / `.yt.id`) cuando existe.

  /home/ian/pub-venv/bin/python scripts/comentarios.py            # todo
  /home/ian/pub-venv/bin/python scripts/comentarios.py ig|yt      # una plataforma
"""
import os, sys, json, glob, time, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, CONF
V = 'v25.0'
OUT = os.path.join(ROOT, 'public', 'comando', 'comentarios.json')
CAMPOS_COM = 'id,text,username,like_count,timestamp,replies{id,text,username,like_count,timestamp}'
CAMPOS_COM_MIN = 'id,text,like_count,timestamp'


def manifiestos():
    """ig media id → vid, yt video id → vid (para unir comentarios con la pieza)."""
    ig, yt = {}, {}
    for mp in glob.glob(os.path.join(ROOT, 'videos', '*.json')):
        try: d = json.load(open(mp, encoding='utf-8'))
        except Exception: continue
        s = (d.get('publicar') or {}).get('subidas') or {}
        for k, tabla in (('ig', ig), ('yt', yt), ('yt16x9', yt)):
            i = (s.get(k) or {}).get('id')
            if i: tabla[str(i)] = d.get('id')
    return ig, yt


# ── INSTAGRAM ────────────────────────────────────────────────────────────────
def ig_get(url, params, tk, reintentos=4):
    import requests
    for i in range(reintentos):
        r = requests.get(url, params={**params, 'access_token': tk}, timeout=60)
        try: j = r.json()
        except Exception: j = {'error': {'message': r.text[:200]}}
        if 'error' not in j: return j
        msg = str(j['error'].get('message', ''))
        code = j['error'].get('code')
        if code in (4, 17, 32, 613) or 'limit' in msg.lower():      # rate limit → esperar
            print(f'   … límite de la API ({msg[:60]}), espero 60 s'); time.sleep(60); continue
        return j
    return j


def ig_pagina(url, params, tk):
    """Sigue `paging.next` hasta agotar."""
    out = []; j = ig_get(url, params, tk)
    while True:
        if 'error' in j: print(f'   ✗ {url.split("/")[-1]}: {str(j["error"].get("message"))[:100]}'); break
        out += j.get('data', [])
        nxt = (j.get('paging') or {}).get('next')
        if not nxt: break
        import requests
        j = requests.get(nxt, timeout=60).json()
    return out


def instagram(mapa_ig):
    tk = json.load(open(os.path.join(CONF, 'instagram-token.json')))['access_token']
    base = f'https://graph.instagram.com/{V}'
    cuenta = ig_get(f'{base}/me', {'fields': 'id,username,followers_count,media_count'}, tk)
    print(f'IG @{cuenta.get("username")}: {cuenta.get("followers_count")} seguidores · {cuenta.get("media_count")} medios')
    medios = ig_pagina(f'{base}/me/media', {'fields': 'id,caption,media_type,media_product_type,permalink,timestamp,comments_count,like_count', 'limit': 100}, tk)
    print(f'   {len(medios)} medios enumerados')
    out = []; total = 0
    for m in medios:
        mid = m['id']; n = m.get('comments_count') or 0
        coms = []
        if n:
            coms = ig_pagina(f'{base}/{mid}/comments', {'fields': CAMPOS_COM, 'limit': 50}, tk)
            if not coms:   # el campo replies/username puede no estar permitido para el tipo de cuenta → mínimo
                coms = ig_pagina(f'{base}/{mid}/comments', {'fields': CAMPOS_COM_MIN, 'limit': 50}, tk)
        lista = []
        for c in coms:
            resp = ((c.get('replies') or {}).get('data')) or []
            lista.append({'id': c.get('id'), 'autor': c.get('username'), 'texto': c.get('text') or '', 'likes': c.get('like_count') or 0,
                          'fecha': c.get('timestamp'), 'respuestas': [{'id': r.get('id'), 'autor': r.get('username'), 'texto': r.get('text') or '',
                                                                       'likes': r.get('like_count') or 0, 'fecha': r.get('timestamp')} for r in resp]})
        n_tot = len(lista) + sum(len(c['respuestas']) for c in lista); total += n_tot
        out.append({'id': mid, 'manifiesto': mapa_ig.get(str(mid)), 'tipo': m.get('media_product_type') or m.get('media_type'), 'permalink': m.get('permalink'),
                    'fecha': m.get('timestamp'), 'caption': (m.get('caption') or '')[:300], 'likes': m.get('like_count'), 'comments_count': n,
                    'n_comentarios': n_tot, 'comentarios': lista})
        if n: print(f'   {(m.get("caption") or mid)[:48]!r:52} · {n_tot} comentarios (API dice {n})')
    print(f'   IG total: {total} comentarios+respuestas en {len(out)} medios')
    return {'cuenta': {k: cuenta.get(k) for k in ('username', 'followers_count', 'media_count')}, 'medios': out, 'total': total}


# ── YOUTUBE ──────────────────────────────────────────────────────────────────
def youtube(mapa_yt):
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.errors import HttpError
    SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/yt-analytics.readonly']
    creds = Credentials.from_authorized_user_file(os.path.join(CONF, 'youtube-token.json'), SCOPES)
    yt = build('youtube', 'v3', credentials=creds)
    ch = yt.channels().list(part='snippet,contentDetails,statistics', mine=True).execute()['items'][0]
    uploads = ch['contentDetails']['relatedPlaylists']['uploads']
    print(f'YT {ch["snippet"]["title"]}: {ch["statistics"].get("subscriberCount")} subs · {ch["statistics"].get("videoCount")} videos')
    vids = []; tok = None
    while True:
        r = yt.playlistItems().list(part='snippet,contentDetails', playlistId=uploads, maxResults=50, pageToken=tok).execute()
        for it in r.get('items', []):
            vids.append({'id': it['contentDetails']['videoId'], 'titulo': it['snippet'].get('title'), 'fecha': it['contentDetails'].get('videoPublishedAt') or it['snippet'].get('publishedAt')})
        tok = r.get('nextPageToken')
        if not tok: break
    # estadísticas (commentCount, viewCount) en lotes de 50
    stats = {}
    for i in range(0, len(vids), 50):
        r = yt.videos().list(part='statistics,status', id=','.join(v['id'] for v in vids[i:i + 50])).execute()
        for it in r.get('items', []): stats[it['id']] = {**it.get('statistics', {}), 'privacidad': (it.get('status') or {}).get('privacyStatus')}
    print(f'   {len(vids)} videos enumerados')
    out = []; total = 0
    for v in vids:
        st = stats.get(v['id'], {}); lista = []; tok = None
        if int(st.get('commentCount') or 0):
            while True:
                try:
                    r = yt.commentThreads().list(part='snippet,replies', videoId=v['id'], maxResults=100, textFormat='plainText', pageToken=tok).execute()
                except HttpError as e:
                    print(f'   ✗ {v["titulo"][:40]}: {str(e)[:100]}'); break
                for t in r.get('items', []):
                    s = t['snippet']['topLevelComment']['snippet']
                    resp = [{'id': rr['id'], 'autor': rr['snippet'].get('authorDisplayName'), 'texto': rr['snippet'].get('textDisplay') or '',
                             'likes': rr['snippet'].get('likeCount') or 0, 'fecha': rr['snippet'].get('publishedAt')} for rr in (t.get('replies') or {}).get('comments', [])]
                    lista.append({'id': t['id'], 'autor': s.get('authorDisplayName'), 'texto': s.get('textDisplay') or '', 'likes': s.get('likeCount') or 0,
                                  'fecha': s.get('publishedAt'), 'respuestas': resp})
                tok = r.get('nextPageToken')
                if not tok: break
        n_tot = len(lista) + sum(len(c['respuestas']) for c in lista); total += n_tot
        out.append({'id': v['id'], 'manifiesto': mapa_yt.get(v['id']), 'titulo': v['titulo'], 'fecha': v['fecha'], 'url': f'https://youtu.be/{v["id"]}',
                    'vistas': int(st.get('viewCount') or 0), 'likes': int(st.get('likeCount') or 0), 'privacidad': st.get('privacidad'),
                    'comments_count': int(st.get('commentCount') or 0), 'n_comentarios': n_tot, 'comentarios': lista})
        if n_tot: print(f'   {v["titulo"][:48]!r:52} · {n_tot} comentarios')
    print(f'   YT total: {total} comentarios+respuestas en {len(out)} videos')
    return {'canal': {'titulo': ch['snippet']['title'], 'subs': ch['statistics'].get('subscriberCount'), 'videos': ch['statistics'].get('videoCount')}, 'videos': out, 'total': total}


def main(args):
    cual = args[0] if args else 'todo'
    mapa_ig, mapa_yt = manifiestos()
    prev = json.load(open(OUT, encoding='utf-8')) if os.path.exists(OUT) else {}
    out = {'generado': dt.datetime.now().isoformat(timespec='minutes'), 'ig': prev.get('ig'), 'yt': prev.get('yt')}
    if cual in ('todo', 'ig'):
        try: out['ig'] = instagram(mapa_ig)
        except Exception as e: print(f'✗ instagram: {e}')
    if cual in ('todo', 'yt'):
        try: out['yt'] = youtube(mapa_yt)
        except Exception as e: print(f'✗ youtube: {e}')
    out['total'] = sum((out.get(k) or {}).get('total', 0) for k in ('ig', 'yt'))
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(OUT, 'a').write('\n')
    print(f'→ {OUT} · {out["total"]} comentarios en total')


if __name__ == '__main__': main(sys.argv[1:])
