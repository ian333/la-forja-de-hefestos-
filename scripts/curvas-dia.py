#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""curvas-dia.py — LA CURVA DÍA A DÍA de cada video de YouTube, y EL CORTE.

ian (2026-09-01): "llega un punto en las curvas de visualizaciones que se ve claramente el
corte que hace instagram, o sea lo muestra y luego lo deja de mostrar; en youtube es aún
más claro". Esto lo MIDE en vez de mirarlo: baja views por (video, día) de todo el canal y
le saca a cada curva su pico, su vida útil y el día del corte.

DEFINICIONES (operativas, para que el número signifique algo):
  pico          día de más vistas
  corte         primer día DESPUÉS del pico en que las vistas caen por debajo del 20 % del
                pico y ya no vuelven a subir de ahí. Es "el algoritmo dejó de empujarlo".
  vida_util     días desde la publicación hasta juntar el 80 % de las vistas totales
  cola_pct      % de las vistas que llegaron DESPUÉS del corte (lo que da el catálogo,
                no el empujón)

  /home/ian/pub-venv/bin/python scripts/curvas-dia.py
  → public/comando/curvas-dia.json
"""
import os, sys, json, datetime as dt
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.expanduser('~/.config/gaia-pub')
TOKEN = os.path.join(CONF, 'youtube-token.json')
SCOPES = ['https://www.googleapis.com/auth/youtube.upload',
          'https://www.googleapis.com/auth/youtube.force-ssl',
          'https://www.googleapis.com/auth/yt-analytics.readonly']


def analiza(serie, publicado):
    """serie = [(fecha, vistas)] ordenada. Devuelve pico, corte, vida útil, cola.

    ⚠ Los días se cuentan DESDE LA PUBLICACIÓN, no desde el inicio de la consulta. La
    primera versión devolvía "pico al día 2374" — el índice dentro de una serie que
    arrancaba en 2020-01-01. Un número que no significa nada es peor que ninguno.
    """
    if publicado:
        serie = [x for x in serie if x[0] >= publicado]
    # recorta el silencio inicial: el día 0 es el primero con vistas
    while serie and serie[0][1] == 0:
        serie = serie[1:]
    if len(serie) < 3:
        return None
    d0 = dt.date.fromisoformat(serie[0][0])
    off = [(dt.date.fromisoformat(f) - d0).days for f, _ in serie]
    v = [x[1] for x in serie]
    tot = sum(v)
    if tot <= 0:
        return None
    ipico = max(range(len(v)), key=lambda i: v[i])
    umbral = 0.20 * v[ipico]
    icorte = None
    for i in range(ipico + 1, len(v)):
        if v[i] < umbral and all(x < umbral for x in v[i:]):
            icorte = i
            break
    acc = 0; ivida = len(v) - 1
    for i, x in enumerate(v):
        acc += x
        if acc >= 0.80 * tot:
            ivida = i; break
    cola = sum(v[icorte:]) / tot * 100 if icorte is not None else 0.0
    return dict(dias=off[-1] + 1, total=tot,
                pico_dia=off[ipico], pico_vistas=v[ipico], pico_fecha=serie[ipico][0],
                corte_dia=off[icorte] if icorte is not None else None,
                corte_fecha=serie[icorte][0] if icorte is not None else None,
                vida_util_dias=off[ivida] + 1, cola_pct=round(cola, 1),
                pct_en_pico=round(100 * v[ipico] / tot, 1),
                serie=[[f, n] for f, n in serie])


def main():
    creds = Credentials.from_authorized_user_file(TOKEN, SCOPES)
    an = build('youtubeAnalytics', 'v2', credentials=creds)
    yt = build('youtube', 'v3', credentials=creds)
    hoy = dt.date.today().isoformat()

    # 1) qué videos tiene el canal, por vistas
    top = an.reports().query(ids='channel==MINE', startDate='2020-01-01', endDate=hoy,
                             dimensions='video', metrics='views', sort='-views',
                             maxResults=200).execute()
    vids = [(r[0], r[1]) for r in (top.get('rows') or [])]
    print(f"{len(vids)} videos con vistas en el canal", flush=True)

    # 2) títulos
    titulos = {}
    for i in range(0, len(vids), 50):
        lote = [v for v, _ in vids[i:i+50]]
        for it in yt.videos().list(part='snippet,contentDetails', id=','.join(lote)).execute().get('items', []):
            titulos[it['id']] = {'titulo': it['snippet']['title'],
                                 'publicado': it['snippet']['publishedAt'][:10],
                                 'dur': it['contentDetails']['duration']}

    # 3) la curva de cada uno
    out = []
    for n, (v, vistas) in enumerate(vids, 1):
        r = an.reports().query(ids='channel==MINE', startDate='2020-01-01', endDate=hoy,
                               filters=f'video=={v}', dimensions='day', metrics='views',
                               sort='day').execute()
        serie = [(row[0], row[1]) for row in (r.get('rows') or [])]
        a = analiza(serie, (titulos.get(v) or {}).get('publicado'))
        if not a: continue
        meta = titulos.get(v, {})
        out.append(dict(id=v, url=f'https://youtu.be/{v}', **meta, **a))
        print(f"  {n:3d}/{len(vids)}  {vistas:>6} vistas · pico día {a['pico_dia']} "
              f"({a['pct_en_pico']}% del total) · corte día {a['corte_dia']} · "
              f"vida útil {a['vida_util_dias']}d · cola {a['cola_pct']}% · {meta.get('titulo','')[:38]}", flush=True)

    con = [x for x in out if x['corte_dia'] is not None]
    res = dict(
        generado=hoy, n=len(out), n_con_corte=len(con),
        nota=('corte = primer día tras el pico con vistas < 20 % del pico y que ya no vuelve a subir. '
              'vida_util = días para juntar el 80 % de las vistas. cola = % de vistas DESPUÉS del corte.'),
        mediana_pico_dia=sorted(x['pico_dia'] for x in out)[len(out)//2] if out else None,
        mediana_corte_dia=sorted(x['corte_dia'] for x in con)[len(con)//2] if con else None,
        mediana_vida_util=sorted(x['vida_util_dias'] for x in out)[len(out)//2] if out else None,
        mediana_cola_pct=sorted(x['cola_pct'] for x in con)[len(con)//2] if con else None,
        videos=out)
    p = os.path.join(ROOT, 'public', 'comando', 'curvas-dia.json')
    json.dump(res, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f"\n✓ {p} · {len(out)} curvas ({len(con)} con corte detectado)")
    print(f"  mediana: pico al día {res['mediana_pico_dia']} · corte al día {res['mediana_corte_dia']} · "
          f"vida útil {res['mediana_vida_util']} d · cola {res['mediana_cola_pct']} %")


if __name__ == '__main__':
    main()
