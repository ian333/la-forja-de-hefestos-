#!/usr/bin/env python3
"""LA HISTORIA — congela las métricas de hoy para poder comparar A EDAD PAREJA.

Por qué existe (2026-09-07): `metricas.json` se SOBREESCRIBE cada corrida, así que solo hay una
foto: el número de hoy. Y comparar el compartir de una pieza de 1 día contra una de 10 está
sesgado — las vistas tempranas vienen del público caliente (seguidores) y comparten más; las
tardías vienen de frío. El veredicto A/B del brazo B se pudo dar igual porque las dos piezas del
REY se miden juntas, pero «revelación vs explicación» NO: quedó confundido con la edad.

Esto agrega una fila por (pieza, fecha) a `public/comando/historia.json` y NUNCA borra. Con dos
semanas de filas, `dataset-cine.py` puede pedir «c/mil al día 2» de cada pieza y comparar peras
con peras. Corre en iangpu después de metricas-instagram.py (mismo cron), o a mano.

  python3 scripts/historia-metricas.py            # agrega la foto de hoy
  python3 scripts/historia-metricas.py --ver      # imprime la serie por pieza
"""
import os, sys, json, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MET = os.path.join(ROOT, 'public', 'comando', 'metricas.json')
HIST = os.path.join(ROOT, 'public', 'comando', 'historia.json')
CAMPOS = ('views', 'reach', 'likes', 'comments', 'shares', 'saved', 'total_interactions',
          'reels_skip_rate', 'ig_reels_avg_watch_time')


def edad_de(vid, hoy):
    """Días desde que salió. `publicar.programar` es la hora REAL de publicación (la cola la
    respeta al minuto); `subidas.ig.fecha` es cuándo se REGISTRÓ, que puede ser días después."""
    try:
        pub = json.load(open(os.path.join(ROOT, 'videos', f'{vid}.json'), encoding='utf-8')).get('publicar', {})
    except Exception:
        return None, ''
    f = (pub.get('programar') or (pub.get('subidas', {}).get('ig', {}) or {}).get('fecha') or '')[:10]
    if not f: return None, ''
    try: return (hoy - dt.date(*map(int, f.split('-')))).days, f
    except Exception: return None, f


def main():
    hoy = dt.date.today()
    hist = json.load(open(HIST, encoding='utf-8')) if os.path.exists(HIST) else {'nota': __doc__.split('\n')[0], 'filas': []}
    if '--ver' in sys.argv:
        por = {}
        for f in hist['filas']: por.setdefault(f['id'], []).append(f)
        for vid, fs in sorted(por.items()):
            fs.sort(key=lambda x: x['fecha'])
            s = ' · '.join(f"d{x['edad']}: {x['views']}v {1000*x['shares']/max(x['views'],1):.1f}c/mil" for x in fs)
            print(f'{vid[:28]:28} {s}')
        return
    m = json.load(open(MET, encoding='utf-8'))
    ya = {(f['id'], f['fecha']) for f in hist['filas']}
    n = 0
    for vid, v in m.items():
        if vid.startswith('_'): continue
        ig = v.get('ig') or {}
        if not ig.get('views'): continue
        clave = (vid, hoy.isoformat())
        edad, sale = edad_de(vid, hoy)
        fila = {'id': vid, 'fecha': hoy.isoformat(), 'sale': sale, 'edad': edad,
                **{k: ig.get(k) for k in CAMPOS}}
        if clave in ya:                                   # re-correr el mismo día ACTUALIZA, no duplica
            hist['filas'] = [f for f in hist['filas'] if (f['id'], f['fecha']) != clave]
        else:
            n += 1
        hist['filas'].append(fila)
    c = m.get('_cuenta_ig') or {}
    if c.get('followers_count'):
        hist.setdefault('cuenta', [])
        hist['cuenta'] = [x for x in hist['cuenta'] if x['fecha'] != hoy.isoformat()]
        hist['cuenta'].append({'fecha': hoy.isoformat(), 'seguidores': c['followers_count'], 'reels': c.get('media_count')})
        hist['cuenta'].sort(key=lambda x: x['fecha'])
    hist['filas'].sort(key=lambda f: (f['id'], f['fecha']))
    hist['generado'] = hoy.isoformat()
    json.dump(hist, open(HIST, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); open(HIST, 'a').write('\n')
    print(f'✓ {HIST}: +{n} filas nuevas · {len(hist["filas"])} en total · {len(hist.get("cuenta", []))} fotos de la cuenta')


if __name__ == '__main__':
    main()
