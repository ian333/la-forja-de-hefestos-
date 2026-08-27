#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""metricas-youtube.py — YouTube Analytics API: métricas por video + CURVA DE RETENCIÓN (la vara del canon).
Doc: dimensión elapsedVideoTimeRatio con métricas audienceWatchRatio,relativeRetentionPerformance y filtro
video==ID; básicas: views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, likes,
comments, shares, subscribersGained. Escribe public/comando/metricas.json (por pieza) para Comando.

  /home/ian/pub-venv/bin/python scripts/metricas-youtube.py            # todas las piezas con publicar.subidas.yt
  /home/ian/pub-venv/bin/python scripts/metricas-youtube.py <id>       # una
"""
import os, sys, json, glob, datetime as dt
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, CONF
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
TOKEN = os.path.join(CONF, 'youtube-token.json')
SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl', 'https://www.googleapis.com/auth/yt-analytics.readonly']

def main(ids):
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    an = build('youtubeAnalytics', 'v2', credentials=creds); yt = build('youtube', 'v3', credentials=creds)
    out_p = os.path.join(ROOT, 'public', 'comando', 'metricas.json')
    out = json.load(open(out_p)) if os.path.exists(out_p) else {}
    hoy = dt.date.today().isoformat()
    for mp in sorted(glob.glob(os.path.join(ROOT, 'videos', '*.json'))):
        d = json.load(open(mp, encoding='utf-8')); vid = d.get('id')
        if ids and vid not in ids: continue
        y = ((d.get('publicar') or {}).get('subidas') or {}).get('yt')
        if not y: continue
        v = y['id']
        pub = yt.videos().list(part='statistics,snippet', id=v).execute().get('items', [])
        st = pub[0]['statistics'] if pub else {}
        base = an.reports().query(ids='channel==MINE', startDate='2020-01-01', endDate=hoy, filters=f'video=={v}',
                                  metrics='views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained').execute()
        row = (base.get('rows') or [[0]*8])[0]; cols = [c['name'] for c in base['columnHeaders']]
        ret = an.reports().query(ids='channel==MINE', startDate='2020-01-01', endDate=hoy, filters=f'video=={v}',
                                 dimensions='elapsedVideoTimeRatio', metrics='audienceWatchRatio,relativeRetentionPerformance').execute()
        curva = [[r[0], r[1]] for r in (ret.get('rows') or [])]
        out.setdefault(vid, {})['yt'] = {'fecha': hoy, 'id': v, 'url': y['url'], 'publico': st, **dict(zip(cols, row)), 'retencion': curva}
        r5 = next((c[1] for c in curva if c[0] >= 0.05), None)
        print(f'{vid}: vistas {row[0]} · min {row[1]:.0f} · dur media {row[2]:.0f}s ({row[3]:.0f} %) · likes {row[4]} · subs +{row[7]} · retención@5% {r5}')
    json.dump(out, open(out_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); print(f'→ {out_p}')

if __name__ == '__main__': main(sys.argv[1:])
