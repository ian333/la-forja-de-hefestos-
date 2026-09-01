#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""rasgos-reels.py — MIDE LOS VIDEOS y los cruza contra su rendimiento.

ian (2026-09-01): "me gustaría ver si hay relación de colores con views y compartidos,
si el movimiento o el contraste de las imágenes tiene relación con los compartidos".

Hasta hoy el análisis miraba METADATOS (título, época, duración) y métricas. Nunca había
mirado los PÍXELES. Esto baja el archivo que Instagram REALMENTE publicó (media_url de la
Graph API, así que la unión es por id y no por parecido de título — probado: emparejar por
título solo casaba 26 de 78), le mide color/movimiento/contraste, lo borra, y correlaciona.

  /home/ian/pub-venv/bin/python scripts/rasgos-reels.py [--n N]
  → public/comando/rasgos-reels.json
"""
import os, sys, json, math, subprocess, statistics as st, tempfile
import requests
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.expanduser('~/.config/gaia-pub')
B = 'https://graph.instagram.com/v25.0'
MET = 'views,reach,likes,comments,saved,shares,total_interactions,ig_reels_video_view_total_time,ig_reels_avg_watch_time'
NPAR = 10          # pares de cuadros por video (el par da el MOVIMIENTO)


def cuadros(mp4, dur):
    """NPAR pares de cuadros consecutivos, repartidos por toda la línea de tiempo."""
    out = []
    d = tempfile.mkdtemp()
    for i in range(NPAR):
        t = dur * (i + 0.5) / NPAR
        p = os.path.join(d, f'f{i}_%02d.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-ss', f'{t:.2f}', '-i', mp4,
                        '-frames:v', '2', '-vf', 'scale=256:-1', p, '-y'],
                       capture_output=True)
        a = os.path.join(d, f'f{i}_01.png'); b = os.path.join(d, f'f{i}_02.png')
        if os.path.exists(a) and os.path.exists(b):
            out.append((np.asarray(Image.open(a).convert('RGB'), dtype=np.float32),
                        np.asarray(Image.open(b).convert('RGB'), dtype=np.float32)))
    return out, d


def rasgos(pares):
    """Color, contraste y movimiento. Todo sobre los píxeles CON SEÑAL (luma>12): el fondo
    negro de la serie es la mitad del cuadro y aguaría cualquier promedio."""
    sat, calido, frio, magenta, luma, rms, quema, mov, lleno, hues = ([] for _ in range(10))
    for A, Bf in pares:
        L = A @ np.array([0.2126, 0.7152, 0.0722], np.float32)
        m = L > 12
        lleno.append(float(m.mean()))
        if m.sum() < 200:
            continue
        px = A[m] / 255.0
        mx = px.max(axis=1); mn = px.min(axis=1)
        s = np.where(mx > 1e-6, (mx - mn) / np.maximum(mx, 1e-6), 0.0)
        sat.append(float(s.mean()))
        # matiz en grados
        r, g, b = px[:, 0], px[:, 1], px[:, 2]
        h = np.zeros_like(r); d = mx - mn; nz = d > 1e-6
        idx = (mx == r) & nz; h[idx] = ((g[idx] - b[idx]) / d[idx]) % 6
        idx = (mx == g) & nz; h[idx] = ((b[idx] - r[idx]) / d[idx]) + 2
        idx = (mx == b) & nz; h[idx] = ((r[idx] - g[idx]) / d[idx]) + 4
        h = h * 60.0
        pesa = s > 0.25                                   # solo píxeles con color de verdad
        if pesa.sum() > 100:
            hh = h[pesa]
            calido.append(float(((hh < 60) | (hh > 320)).mean()))
            frio.append(float(((hh > 170) & (hh < 260)).mean()))
            magenta.append(float(((hh >= 260) & (hh <= 320)).mean()))
            # VARIEDAD de color = entropía del histograma de matiz (12 cajas de 30°)
            hist, _ = np.histogram(hh, bins=12, range=(0, 360))
            p = hist / max(hist.sum(), 1); p = p[p > 0]
            hues.append(float(-(p * np.log(p)).sum() / math.log(12)))
        luma.append(float(L[m].mean()))
        rms.append(float(L[m].std()))
        quema.append(float((L > 240).mean()) * 100)
        mov.append(float(np.abs(A - Bf).mean()))          # cambio entre dos cuadros seguidos
    med = lambda v: round(float(st.mean(v)), 4) if v else None
    return dict(saturacion=med(sat), calido=med(calido), frio=med(frio), magenta=med(magenta),
                variedad_color=med(hues), luma=med(luma), contraste=med(rms),
                quemado=med(quema), movimiento=med(mov), lleno=med(lleno), n_cuadros=len(pares))


def pearson(a, b):
    n = len(a)
    if n < 6: return None
    ma, mb = st.mean(a), st.mean(b)
    va = sum((x - ma) ** 2 for x in a); vb = sum((x - mb) ** 2 for x in b)
    if va <= 0 or vb <= 0: return None
    return round(sum((a[i] - ma) * (b[i] - mb) for i in range(n)) / math.sqrt(va * vb), 3)


def main():
    lim = int(sys.argv[sys.argv.index('--n') + 1]) if '--n' in sys.argv else 999
    tk = json.load(open(os.path.join(CONF, 'instagram-token.json')))['access_token']
    medios, url = [], f'{B}/me/media'
    params = {'fields': 'id,media_type,caption,permalink,timestamp,media_url', 'limit': 100, 'access_token': tk}
    while url and len(medios) < 500:
        r = requests.get(url, params=params).json()
        if 'error' in r: print('✗', r['error'].get('message')); break
        medios += r.get('data', []); url = (r.get('paging') or {}).get('next'); params = None
    vids = [m for m in medios if m.get('media_type') == 'VIDEO' and m.get('media_url')][:lim]
    print(f"{len(vids)} reels con media_url", flush=True)

    filas = []
    for i, m in enumerate(vids, 1):
        r = requests.get(f'{B}/{m["id"]}/insights', params={'metric': MET, 'access_token': tk}).json()
        if 'data' not in r: continue
        d = {x['name']: (x.get('values') or [{}])[0].get('value') for x in r['data']}
        alc = d.get('reach') or 0
        if not d.get('views') or alc < 50: continue
        mp4 = os.path.join(tempfile.gettempdir(), f'_r{i}.mp4')
        try:
            with requests.get(m['media_url'], stream=True, timeout=120) as resp:
                with open(mp4, 'wb') as fh:
                    for ch in resp.iter_content(1 << 20): fh.write(ch)
            dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                        '-of', 'csv=p=0', mp4], capture_output=True, text=True).stdout.strip() or 0)
            if dur < 3: raise ValueError('sin duración')
            pares, tmpd = cuadros(mp4, dur)
            rr = rasgos(pares)
            subprocess.run(['rm', '-rf', tmpd], capture_output=True)
        except Exception as e:
            print(f"  {i:3d} ✗ {m['id']}: {e}", flush=True); continue
        finally:
            if os.path.exists(mp4): os.remove(mp4)
        fila = dict(id=m['id'], fecha=(m.get('timestamp') or '')[:10], url=m.get('permalink'),
                    titulo=(m.get('caption') or '')[:70], dur=round(dur, 1),
                    vistas=d.get('views'), alcance=alc,
                    guardados=d.get('saved') or 0, compartidos=d.get('shares') or 0,
                    g_por_mil=round(1000 * (d.get('saved') or 0) / alc, 2),
                    c_por_mil=round(1000 * (d.get('shares') or 0) / alc, 2), **rr)
        filas.append(fila)
        print(f"  {i:3d}/{len(vids)}  {fila['vistas']:>7} vistas · mov {rr['movimiento']} · "
              f"contraste {rr['contraste']} · cálido {rr['calido']} · variedad {rr['variedad_color']}", flush=True)

    RASGOS = ['saturacion', 'calido', 'frio', 'magenta', 'variedad_color', 'luma', 'contraste',
              'quemado', 'movimiento', 'lleno', 'dur']
    METR = {'log_vistas': lambda f: math.log(max(f['vistas'], 1)),
            'c_por_mil': lambda f: f['c_por_mil'], 'g_por_mil': lambda f: f['g_por_mil'],
            'compartidos': lambda f: f['compartidos']}
    corr = {}
    for mname, fn in METR.items():
        c = {}
        for rn in RASGOS:
            pares_ = [(f[rn], fn(f)) for f in filas if f.get(rn) is not None]
            if len(pares_) >= 6:
                c[rn] = pearson([p[0] for p in pares_], [p[1] for p in pares_])
        corr[mname] = c

    out = dict(generado=__import__('datetime').date.today().isoformat(), n=len(filas),
               nota=('Rasgos medidos sobre el archivo que Instagram publicó (media_url), no sobre el master: '
                     'es lo que la gente vio. Unión por id de medio. Color/contraste se miden solo en píxeles '
                     'con señal (luma>12) porque el fondo negro es la mitad del cuadro. movimiento = |Δ| medio '
                     'entre dos cuadros CONSECUTIVOS. variedad_color = entropía del histograma de matiz.'),
               correlaciones=corr, videos=filas)
    p = os.path.join(ROOT, 'public', 'comando', 'rasgos-reels.json')
    json.dump(out, open(p, 'w'), ensure_ascii=False, indent=1)
    print(f"\n✓ {p} · {len(filas)} videos")
    for mname, c in corr.items():
        print(f"\n— {mname} —")
        for rn, v in sorted(c.items(), key=lambda kv: -abs(kv[1] or 0)):
            print(f"   {rn:16s} r = {v:+.3f}" if v is not None else f"   {rn:16s}  —")


if __name__ == '__main__':
    main()
