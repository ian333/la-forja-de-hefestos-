#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""analisis-reels.py — el DATASET de la cuenta y sus relaciones, para verlas en Comando.

ian (2026-08-28): "me dejaste fuera y solo me diste un resumen cuando ya sacaste relaciones".
Tenía razón: el análisis vivía en un chat. Aquí se vuelve un artefacto de La Forja —
public/comando/analisis-ig.json— que el Centro de Comando pinta y ian ordena a su gusto.

Baja TODOS los medios de la cuenta con insights, calcula las TASAS (por 1000 de alcance, que
es lo único comparable entre un video de 92k y uno de 300) y las correlaciones con log10(vistas).

  /home/ian/pub-venv/bin/python scripts/analisis-reels.py
"""
import json, os, sys, math, time, statistics as st, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import ROOT, CONF

V = 'v25.0'; B = f'https://graph.instagram.com/{V}'
MET = ('views,reach,likes,comments,shares,saved,total_interactions,'
       'ig_reels_avg_watch_time,ig_reels_video_view_total_time,reels_skip_rate')

def corr(a, b):
    ma, mb = st.mean(a), st.mean(b); sa, sb = st.pstdev(a), st.pstdev(b)
    return 0.0 if sa * sb == 0 else sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (len(a) * sa * sb)

def ols(xs, y):
    """Mínimos cuadrados por ecuaciones normales (sin numpy). Devuelve (coefs, R²)."""
    n, k = len(y), len(xs)
    X = [[1.0] + [xs[j][i] for j in range(k)] for i in range(n)]
    M = [[sum(X[i][a] * X[i][b] for i in range(n)) for b in range(k + 1)] + [sum(X[i][a] * y[i] for i in range(n))] for a in range(k + 1)]
    for c in range(k + 1):
        p = max(range(c, k + 1), key=lambda r: abs(M[r][c])); M[c], M[p] = M[p], M[c]
        if abs(M[c][c]) < 1e-12: continue
        for r in range(k + 1):
            if r != c:
                f = M[r][c] / M[c][c]
                for q in range(c, k + 2): M[r][q] -= f * M[c][q]
    b = [M[i][k + 1] / M[i][i] if abs(M[i][i]) > 1e-12 else 0.0 for i in range(k + 1)]
    pred = [b[0] + sum(b[j + 1] * xs[j][i] for j in range(k)) for i in range(n)]
    my = st.mean(y); ss = sum((v - my) ** 2 for v in y); sr = sum((y[i] - pred[i]) ** 2 for i in range(n))
    return b, (1 - sr / ss if ss else 0.0)

def main():
    tk = json.load(open(os.path.join(CONF, 'instagram-token.json')))['access_token']
    cuenta = requests.get(f'{B}/me', params={'fields': 'followers_count,media_count,username', 'access_token': tk}).json()
    medios, url = [], f'{B}/me/media'
    params = {'fields': 'id,media_type,caption,permalink,timestamp', 'limit': 100, 'access_token': tk}
    while url and len(medios) < 500:
        r = requests.get(url, params=params).json()
        if 'error' in r: print('✗', r['error'].get('message')); break
        medios += r.get('data', []); url = (r.get('paging') or {}).get('next'); params = None

    filas = []
    for i, m in enumerate(medios):
        if m.get('media_type') != 'VIDEO': continue
        r = requests.get(f'{B}/{m["id"]}/insights', params={'metric': MET, 'access_token': tk}).json()
        if 'data' not in r: continue
        d = {x['name']: (x.get('values') or [{}])[0].get('value') for x in r['data']}
        alc = d.get('reach') or 0
        if not d.get('views') or alc < 50: continue
        cap = (m.get('caption') or '').replace('\n', ' ').strip()
        filas.append({
            'id': m['id'], 'fecha': m['timestamp'][:10], 'url': m['permalink'],
            'titulo': cap[:90] or '(sin caption)',
            'vistas': d['views'], 'alcance': alc,
            'skip3s': round(d.get('reels_skip_rate') or 0, 1),
            'seg_vistos': round((d.get('ig_reels_avg_watch_time') or 0) / 1000, 1),
            'guardados': d.get('saved') or 0, 'compartidos': d.get('shares') or 0,
            'g_por_mil': round(1000 * (d.get('saved') or 0) / alc, 1),
            'c_por_mil': round(1000 * (d.get('shares') or 0) / alc, 1),
            # SPENCE: la razón entre la señal CARA (compartir, pone tu nombre frente a un amigo)
            # y la BARATA (guardar, privado). Separa mejor que cualquiera de las dos por separado.
            'razon_cg': round((d.get('shares') or 0) / (d.get('saved') or 1), 2) if (d.get('saved') or 0) >= 10 else None,
            # SIMON: atención humana cosechada por esta pieza, en HORAS.
            'horas_atencion': round(d['views'] * ((d.get('ig_reels_avg_watch_time') or 0) / 1000) / 3600, 1),
        })
        if i % 10 == 0: time.sleep(0.3)

    lv = [math.log10(f['vistas']) for f in filas]
    series = {'skip3s': [f['skip3s'] for f in filas], 'seg_vistos': [f['seg_vistos'] for f in filas],
              'g_por_mil': [f['g_por_mil'] for f in filas], 'c_por_mil': [f['c_por_mil'] for f in filas]}
    rel = {k: round(corr(v, lv), 3) for k, v in series.items()}
    b1, r2_1 = ols([series['skip3s']], lv)
    b3, r2_3 = ols([series['skip3s'], series['g_por_mil'], series['c_por_mil']], lv)

    # ── LOS NOBEL APLICADOS (ian, 2026-08-28: "que Nash analice nuestros datos") ──────────
    # SIMON 1978: la atención es el recurso escaso. ¿Cuánta cosechó el canal y de dónde salió?
    por_at = sorted(filas, key=lambda f: -f['horas_atencion'])
    horas_tot = sum(f['horas_atencion'] for f in filas)
    simon = {'horas_totales': round(horas_tot, 1), 'dias': round(horas_tot / 24, 1),
             'top5_pct': round(100 * sum(f['horas_atencion'] for f in por_at[:5]) / horas_tot, 1) if horas_tot else 0,
             'top5': [{'titulo': f['titulo'][:60], 'horas': f['horas_atencion'],
                       'pct': round(100 * f['horas_atencion'] / horas_tot, 1)} for f in por_at[:5]]}
    # SPENCE 2001: la señal CARA informa más. Se contrasta con los coeficientes y con la razón.
    con_senal = [f for f in filas if f['razon_cg'] is not None]
    alta = [f for f in con_senal if f['razon_cg'] >= 0.5]; baja = [f for f in con_senal if f['razon_cg'] < 0.5]
    spence = {'n_con_senal': len(con_senal),
              'guardados_totales': sum(f['guardados'] for f in filas), 'compartidos_totales': sum(f['compartidos'] for f in filas),
              'compartir_informa_x': round(b3[3] / b3[2], 2) if b3[2] else None,
              'razon_alta': {'n': len(alta), 'vistas_mediana': int(st.median([f['vistas'] for f in alta])) if alta else 0},
              'razon_baja': {'n': len(baja), 'vistas_mediana': int(st.median([f['vistas'] for f in baja])) if baja else 0}}
    # NASH 1994: tasas marginales de sustitución del modelo — dónde rinde más el esfuerzo.
    bs, bg, bc = b3[1], b3[2], b3[3]
    nash = {'1_compartido_en_puntos_skip': round(bc / -bs, 2) if bs else None,
            '1_compartido_en_guardados': round(bc / bg, 2) if bg else None,
            '1_guardado_en_puntos_skip': round(bg / -bs, 2) if bs else None,
            'x_vistas_por_10_compartidos': round(10 ** (10 * bc), 2),
            'x_vistas_por_10_guardados': round(10 ** (10 * bg), 2),
            'x_vistas_por_bajar_10_skip': round(10 ** (10 * -bs), 2)}
    # CONTROL DE ÉPOCA: el canal creció, comparar meses distintos es trampa. Mediana por mes.
    meses = {}
    for f in filas:
        m = f['fecha'][:7]; meses.setdefault(m, []).append(f)
    epoca = [{'mes': m, 'n': len(v), 'alcance_mediano': int(st.median([x['alcance'] for x in v])),
              'c_por_mil_mediana': round(st.median([x['c_por_mil'] for x in v]), 1)} for m, v in sorted(meses.items())]

    tot = sum(f['vistas'] for f in filas)
    orden = sorted(filas, key=lambda f: -f['vistas'])
    top8 = sum(f['vistas'] for f in orden[:8])
    out = {
        'generado': time.strftime('%Y-%m-%d %H:%M'), 'cuenta': cuenta, 'n': len(filas),
        'vistas_totales': tot, 'top8_pct': round(100 * top8 / tot, 1) if tot else 0,
        'top2_pct': round(100 * sum(f['vistas'] for f in orden[:2]) / tot, 1) if tot else 0,
        'seguidores_por_mil_vistas': round(1000 * (cuenta.get('followers_count') or 0) / tot, 2) if tot else 0,
        'correlaciones_log_vistas': rel,
        'simon_1978': simon, 'spence_2001': spence, 'nash_1994': nash, 'epoca': epoca,
        'modelo_skip': {'b0': round(b1[0], 3), 'b_skip': round(b1[1], 4), 'r2': round(r2_1, 3)},
        'modelo_3': {'r2': round(r2_3, 3), 'b_skip': round(b3[1], 4), 'b_guardados': round(b3[2], 4), 'b_compartidos': round(b3[3], 4)},
        'nota': ('Tasas POR MIL de alcance: es lo único comparable entre un video de 92k y uno de 300. '
                 'CAVEAT: guardados y compartidos son en parte CONSECUENCIA de la distribución, no solo causa — '
                 'la correlación va en los dos sentidos. La API NO expone seguidores por video: '
                 'seguidores_por_mil_vistas es un promedio de toda la cuenta e incluye la campaña pagada.'),
        'videos': sorted(filas, key=lambda f: f['fecha'], reverse=True),
    }
    p = os.path.join(ROOT, 'public', 'comando', 'analisis-ig.json')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'n={len(filas)} · vistas {tot:,} · top8 {out["top8_pct"]}% · top2 {out["top2_pct"]}%')
    print(f'correlaciones con log10(vistas): {rel}')
    print(f'R² skip solo {r2_1:.3f} · R² skip+guardados+compartidos {r2_3:.3f}')
    print(f'SIMON: {simon["horas_totales"]:,.0f} h de atención · top5 = {simon["top5_pct"]}%')
    print(f'SPENCE: compartir informa {spence["compartir_informa_x"]}x · razón alta n={spence["razon_alta"]["n"]} '
          f'(mediana {spence["razon_alta"]["vistas_mediana"]:,}v) vs baja n={spence["razon_baja"]["n"]} ({spence["razon_baja"]["vistas_mediana"]:,}v)')
    print(f'NASH: 1 compartido/mil = {nash["1_compartido_en_puntos_skip"]} puntos de skip = {nash["1_compartido_en_guardados"]} guardados')
    print(f'→ {p}')

if __name__ == '__main__': main()
