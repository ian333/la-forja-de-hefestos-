#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""metricas-instagram.py — insights de cada Reel publicado por API (doc: GET /v25.0/{media}/insights?metric=...):
views, reach, likes, comments, shares, saved, total_interactions, ig_reels_avg_watch_time,
ig_reels_video_view_total_time, reels_skip_rate (= el acantilado de 3 s). Y de cuenta: followers_count.
Escribe public/comando/metricas.json (junto a las de YouTube). Comentarios → dist-video/comentarios/<id>.json
(el brief del siguiente video: la duda que se repite ≥3 veces).
  /home/ian/pub-venv/bin/python scripts/metricas-instagram.py [<id>]
"""
import os, sys, json, glob, datetime as dt, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, CONF
V = 'v25.0'; TOK = os.path.join(CONF, 'instagram-token.json')
MET = 'views,reach,likes,comments,shares,saved,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time,reels_skip_rate'

def main(ids):
    t = json.load(open(TOK)); tk = t['access_token']; hoy = dt.date.today().isoformat()
    out_p = os.path.join(ROOT, 'public', 'comando', 'metricas.json'); out = json.load(open(out_p)) if os.path.exists(out_p) else {}
    cuenta = requests.get(f'https://graph.instagram.com/{V}/me', params={'fields': 'followers_count,media_count,username', 'access_token': tk}).json()
    out['_cuenta_ig'] = {**cuenta, 'fecha': hoy}; print(f'@{cuenta.get("username")}: {cuenta.get("followers_count")} seguidores')
    os.makedirs(os.path.join(ROOT, 'dist-video', 'comentarios'), exist_ok=True)
    for mp in sorted(glob.glob(os.path.join(ROOT, 'videos', '*.json'))):
        d = json.load(open(mp, encoding='utf-8')); vid = d.get('id')
        if ids and vid not in ids: continue
        ig = ((d.get('publicar') or {}).get('subidas') or {}).get('ig')
        if not ig: continue
        r = requests.get(f'https://graph.instagram.com/{V}/{ig["id"]}/insights', params={'metric': MET, 'access_token': tk}).json()
        m = {x['name']: (x.get('values') or [{}])[0].get('value') for x in r.get('data', [])}
        com = requests.get(f'https://graph.instagram.com/{V}/{ig["id"]}/comments', params={'fields': 'text,like_count,timestamp', 'limit': 100, 'access_token': tk}).json().get('data', [])
        json.dump(com, open(os.path.join(ROOT, 'dist-video', 'comentarios', f'{vid}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        out.setdefault(vid, {})['ig'] = {'fecha': hoy, 'id': ig['id'], 'url': ig.get('url', ''), **m, 'n_comentarios': len(com)}
        print(f'{vid}: vistas {m.get("views")} · alcance {m.get("reach")} · guardados {m.get("saved")} · compartidos {m.get("shares")} · skip3s {m.get("reels_skip_rate")} · comentarios {len(com)}')
    json.dump(out, open(out_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(f'→ {out_p}')

if __name__ == '__main__': main(sys.argv[1:])
