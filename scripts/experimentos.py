#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""experimentos.py — el tablero del experimento en curso: A contra B, con intervalo, sin adornos.

ian 2026-09-27: «necesitamos aumentar el ritmo de los experimentos». Cada manifiesto declara su tratamiento en
publicar.experimento (variable, grupo). Este script junta lo que PRIME publicó (hecho/<id>.json → id de Instagram),
pide los insights, y compara los grupos SOLO entre videos con la misma edad mínima (24 h o 72 h), porque un video de
2 h no se compara con uno de 3 días. La diferencia lleva intervalo de bootstrap (1,000 remuestreos).

  python3 scripts/experimentos.py [--variable cta_envio] [--horas 24]
"""
import os, sys, json, glob, subprocess, datetime as dt, random, statistics as st
import requests
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.expanduser('~/.config/gaia-pub'); PRIME = 'ian@100.110.244.20'
VAR = sys.argv[sys.argv.index('--variable') + 1] if '--variable' in sys.argv else 'cta_envio'
HORAS = float(sys.argv[sys.argv.index('--horas') + 1] if '--horas' in sys.argv else 24)
MET = 'views,reach,likes,comments,shares,saved,ig_reels_avg_watch_time,reels_skip_rate'

def hechos():
    r = subprocess.run(['ssh', '-o', 'ConnectTimeout=8', PRIME, 'cd ~/forja-cola/hecho && python3 -c "import json,glob; [print(json.dumps(json.load(open(f)))) for f in glob.glob(\'econ-*.json\')]"'],
                       capture_output=True, text=True)
    out = {}
    for l in r.stdout.splitlines():
        if l.strip():
            try: d = json.loads(l); out[d['id']] = d
            except Exception: pass
    return out

def main():
    tk = json.load(open(os.path.join(CONF, 'instagram-token.json')))['access_token']
    H = hechos(); ahora = dt.datetime.now(dt.timezone.utc); filas = []
    for p in sorted(glob.glob(os.path.join(ROOT, 'videos', 'econ-*.json'))):
        d = json.load(open(p, encoding='utf-8')); pub = d.get('publicar') or {}; ex = pub.get('experimento') or {}
        if ex.get('variable') != VAR: continue
        h = H.get(d['id']); ig = (h or {}).get('ig') or {}
        if not ig.get('id') or not h.get('publicado_en'): continue
        edad = (ahora - dt.datetime.fromisoformat(h['publicado_en'])).total_seconds() / 3600
        r = requests.get(f'https://graph.instagram.com/v25.0/{ig["id"]}/insights', params={'metric': MET, 'access_token': tk}).json()
        m = {x['name']: (x.get('values') or [{}])[0].get('value') for x in r.get('data', [])}
        v = m.get('views') or 0
        filas.append({'id': d['id'], 'grupo': ex.get('grupo', '?')[:1], 'edad_h': round(edad, 1), 'hora': h.get('programar', '')[11:16],
                      'vistas': v, 'alcance': m.get('reach') or 0, 'comp_mil': 1000 * (m.get('shares') or 0) / max(1, v),
                      'guard_mil': 1000 * (m.get('saved') or 0) / max(1, v), 'com': m.get('comments') or 0,
                      'seg': round((m.get('ig_reels_avg_watch_time') or 0) / 1000, 1), 'skip': m.get('reels_skip_rate')})
    filas.sort(key=lambda f: -f['edad_h'])
    print(f'{"id":38s} g  edad  hora   vistas  comp/mil guard/mil com  seg   skip')
    for f in filas:
        print(f'{f["id"][:38]:38s} {f["grupo"]}  {f["edad_h"]:5.0f} {f["hora"]:5s} {f["vistas"]:7d}  {f["comp_mil"]:6.2f}  {f["guard_mil"]:6.2f} {f["com"]:4d} {f["seg"]:5.1f}  {f["skip"]}')
    mad = [f for f in filas if f['edad_h'] >= HORAS]
    A = [f for f in mad if f['grupo'] == 'A']; B = [f for f in mad if f['grupo'] == 'B']
    print(f'\n== {VAR}: videos con ≥{HORAS:.0f} h: A={len(A)} B={len(B)}')
    if len(A) < 3 or len(B) < 3: print('   todavía no hay suficientes en los dos grupos para comparar (mínimo 3 y 3)'); return
    rng = random.Random(0)
    for k, nombre in [('comp_mil', 'compartidos por mil'), ('guard_mil', 'guardados por mil'), ('vistas', 'vistas'), ('com', 'comentarios'), ('seg', 'segundos vistos')]:
        a = [f[k] for f in A]; b = [f[k] for f in B]; dif = st.mean(b) - st.mean(a)
        boots = sorted(st.mean(rng.choices(b, k=len(b))) - st.mean(rng.choices(a, k=len(a))) for _ in range(1000))
        lo, hi = boots[25], boots[975]; sig = ' ***' if lo > 0 or hi < 0 else ''
        print(f'   {nombre:22s} A={st.mean(a):8.2f}  B={st.mean(b):8.2f}  B−A={dif:+8.2f}  IC95 [{lo:+.2f}, {hi:+.2f}]{sig}')

if __name__ == '__main__':
    main()
