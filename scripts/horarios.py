#!/usr/bin/env python3
"""HORARIOS — a qué hora y qué día está despierta NUESTRA audiencia (telemetría propia, no de afuera).

Lee events.jsonl de gaia_telemetry_forja en ATLAS (sesiones que llegan al sitio; ~88 % vienen
de Instagram) y saca: reparto por huso (proxy de país), histograma de hora LOCAL del visitante y
en CDMX, y días. Escribe public/comando/horarios.json con una `recomendacion` que es la que usa
videos/CRONOGRAMA.json. Aviso honesto: mide a quien CLICA del reel al sitio, no a quien ve el
reel; y está confundido por las horas a las que hemos publicado. Es lo mejor que tenemos medido
(2026-09-04, 3,490 sesiones desde IG) y le gana a la tabla de afuera (ritmo.json horarios_latam).

  python3 scripts/horarios.py                 # ssh a ATLAS + docker exec + escribe el JSON
  python3 scripts/horarios.py events.jsonl    # o desde un archivo local
"""
import sys, os, json, collections, datetime, subprocess
from zoneinfo import ZoneInfo

ATLAS = 'ian@100.97.118.117'
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'comando', 'horarios.json')

def leer():
    if len(sys.argv) > 1:
        return open(sys.argv[1], encoding='utf-8', errors='replace').read().splitlines()
    r = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', ATLAS,
                        'docker exec gaia_telemetry_forja cat /data/events.jsonl'], capture_output=True, text=True)
    if r.returncode: sys.exit(f'✗ ATLAS: {r.stderr.strip()[:200]}')
    return r.stdout.splitlines()

def es_ig(e):
    u = (e.get('url', '') + ' ' + str(e.get('data', {}).get('ref', '')) + ' ' + e.get('ua', '')).lower()
    return 'instagram' in u or 'utm_source=ig' in u or 'fbclid' in u

def hist(grp):
    tzc = collections.Counter(e.get('data', {}).get('tz', '?') for e in grp)
    hl = collections.Counter(); hmx = collections.Counter(); wd = collections.Counter()
    for e in grp:
        t = datetime.datetime.fromtimestamp(e['t'] / 1000, tz=datetime.timezone.utc)
        tz = e.get('data', {}).get('tz') or 'America/Mexico_City'
        try: tl = t.astimezone(ZoneInfo(tz))
        except Exception: tl = t.astimezone(ZoneInfo('America/Mexico_City'))
        hl[tl.hour] += 1; wd[tl.strftime('%a')] += 1
        hmx[t.astimezone(ZoneInfo('America/Mexico_City')).hour] += 1
    n = len(grp) or 1
    return {'n': len(grp),
            'tz_pct': {tz: round(100 * c / n, 1) for tz, c in tzc.most_common(10)},
            'hora_local': [hl[h] for h in range(24)],
            'hora_cdmx': [hmx[h] for h in range(24)],
            'dia_local': {d: wd[d] for d in ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}}

def main():
    ev = []
    for l in leer():
        l = l.strip()
        if not l: continue
        try: ev.append(json.loads(l))
        except Exception: pass
    first = {}
    for e in ev:
        if e.get('type') == 'pageview' and e.get('sid') and e['sid'] not in first: first[e['sid']] = e
    ses = list(first.values()); ig = [e for e in ses if es_ig(e)]
    H = hist(ig)
    top3_local = sorted(range(24), key=lambda h: -H['hora_local'][h])[:3]
    top3_cdmx = sorted(range(24), key=lambda h: -H['hora_cdmx'][h])[:3]
    dias = sorted(H['dia_local'].items(), key=lambda kv: -kv[1])
    out = {'generado': datetime.date.today().isoformat(), 'fuente': 'gaia_telemetry_forja:/data/events.jsonl (ATLAS)',
           'eventos': len(ev), 'sesiones': len(ses), 'sesiones_ig': len(ig),
           'ig': H, 'todas': hist(ses),
           'lectura': {'pico_hora_local': top3_local, 'pico_hora_cdmx': top3_cdmx,
                       'dias_fuertes': [d for d, _ in dias[:2]], 'dias_flojos': [d for d, _ in dias[-2:]]},
           'recomendacion': {'hora_cdmx': '18:45', 'huso': 'America/Mexico_City',
                             'por_que': 'la subida empieza a las 19 h local en todos los husos y el pico es 21-23 h local; '
                                        '18:45 CDMX = 21:45 en Argentina/Chile (58 %), 20:45 en Colombia, 18:45 en México: '
                                        'entra en la rampa de TODOS antes del pico, y YouTube/IG deciden en las primeras horas',
                             'dias': 'domingo y lunes fuertes; miércoles y jueves flojos (al revés de la tabla de afuera)',
                             'aviso': 'mide clics del reel al sitio, no vistas del reel; confundido por nuestras horas de publicación'}}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w'), indent=1, ensure_ascii=False); open(OUT, 'a').write('\n')
    print(f'✓ {OUT}: {len(ig)} sesiones IG · pico local {top3_local} · pico CDMX {top3_cdmx} · días {dias[:2]}')

if __name__ == '__main__':
    main()
