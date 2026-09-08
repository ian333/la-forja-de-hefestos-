#!/usr/bin/env python3
"""LA TELEMETRÍA DEL SITIO — el embudo completo, de un vistazo, todos los días.

Por qué existe (ian, 2026-09-08): «revisa telemetría, creo que es buena práctica hacerlo diario…
puedes revisar la telemetría también de la página?». Hasta ahora sólo mirábamos Instagram; el
sitio tenía 49,000 eventos sin leer.

Lee `events.jsonl` del contenedor `gaia_telemetry_forja` en ATLAS y escribe
`public/comando/telemetria-sitio.json` (EN EL REPO, para que se pueda ver sin entrar a la Pi).

Qué mide, en orden de embudo:
  1. LLEGADA   sesiones por día, de dónde vienen (organic/paid/directo) y con qué pantalla
  2. EL ATRIO  cuántos ven los reels, cuántos llegan a las puertas y cuál eligen
  3. QUEDARSE  segundos por sesión e interacciones (evento `salida`)
  4. LO ROTO   errores de WebGL (si el navegador no crea el contexto, NO VE NADA), 404s, vitals

  python3 scripts/telemetria-sitio.py            # baja de ATLAS y analiza
  python3 scripts/telemetria-sitio.py eventos.jsonl
"""
import os, sys, json, subprocess, collections, datetime as dt

ATLAS = 'ian@100.97.118.117'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'public', 'comando', 'telemetria-sitio.json')
DIAS = 30


def leer():
    if len(sys.argv) > 1:
        return open(sys.argv[1], encoding='utf-8', errors='replace').read().splitlines()
    r = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=25', ATLAS,
                        'docker exec gaia_telemetry_forja cat /data/events.jsonl'],
                       capture_output=True, text=True)
    if r.returncode: sys.exit(f'✗ ATLAS: {r.stderr.strip()[:200]}')
    return r.stdout.splitlines()


def pagina(u):
    u = (u or '').split('?')[0].replace('https://university.gaiaprime.com.mx', '')
    return u or '/'


def main():
    ev = []
    for l in leer():
        l = l.strip()
        if not l.startswith('{'): continue
        try: ev.append(json.loads(l))
        except Exception: pass
    for e in ev:
        e['dia'] = dt.datetime.fromtimestamp(e['t'] / 1000, dt.timezone.utc).date().isoformat()
    hoy = dt.date.today()
    desde = (hoy - dt.timedelta(days=DIAS)).isoformat()
    rec = [e for e in ev if e['dia'] >= desde]

    # ── 1. LLEGADA ────────────────────────────────────────────────────────────
    ses = {}
    for e in ev:
        s = e.get('sid')
        if not s: continue
        d = ses.setdefault(s, {'dia': e['dia'], 'ev': 0, 'paginas': set(), 'fuente': None,
                               'vw': None, 'seg': 0, 'inter': 0, 'webgl_roto': False})
        d['ev'] += 1
        d['paginas'].add(pagina(e.get('url')))
        if e['dia'] < d['dia']: d['dia'] = e['dia']
        if e.get('type') == 'pageview' and d['vw'] is None:
            d['vw'] = (e.get('data') or {}).get('vw')
        if e.get('type') == 'origen' and not d['fuente']:
            d['fuente'] = (e.get('data') or {}).get('fuente')
        if e.get('type') == 'salida':
            da = e.get('data') or {}
            d['seg'] = max(d['seg'], da.get('s') or 0); d['inter'] = max(d['inter'], da.get('inter') or 0)
        if e.get('type') in ('console_error', 'webgl2_blocked'):
            a = str((e.get('data') or {}).get('args', ''))
            if 'WebGL' in a or e.get('type') == 'webgl2_blocked': d['webgl_roto'] = True
    por_dia = collections.Counter(v['dia'] for v in ses.values())
    fuentes = collections.Counter(v['fuente'] or 'sin-marcar' for v in ses.values())
    recientes = {s: v for s, v in ses.items() if v['dia'] >= desde}
    movil = sum(1 for v in recientes.values() if (v['vw'] or 0) and v['vw'] < 500)

    # ── 2. EL ATRIO ───────────────────────────────────────────────────────────
    vieron = {e['sid'] for e in ev if e.get('type') == 'atrio.reel'}
    puertas = {e['sid'] for e in ev if e.get('type') == 'atrio.puertas'}
    eligio = {e['sid'] for e in ev if e.get('type') == 'atrio.puerta'}
    reels = collections.Counter((e.get('data') or {}).get('id') for e in ev if e.get('type') == 'atrio.reel')
    motivos = collections.Counter((e.get('data') or {}).get('motivo') for e in ev if e.get('type') == 'atrio.puertas')
    cual = collections.Counter((e.get('data') or {}).get('p') for e in ev if e.get('type') == 'atrio.puerta')
    segs_puertas = sorted((e.get('data') or {}).get('seg') or 0 for e in ev if e.get('type') == 'atrio.puertas')

    # ── 3. QUEDARSE ───────────────────────────────────────────────────────────
    con_salida = [v for v in ses.values() if v['seg']]
    segs = sorted(v['seg'] for v in con_salida)
    med = lambda a: a[len(a) // 2] if a else 0
    rebote = sum(1 for v in con_salida if v['seg'] < 10) / max(len(con_salida), 1)
    paginas = collections.Counter(pagina(e.get('url')) for e in ev if e.get('type') == 'pageview')

    # ── 4. LO ROTO ────────────────────────────────────────────────────────────
    ses_webgl = sum(1 for v in ses.values() if v['webgl_roto'])
    errores = collections.Counter(str((e.get('data') or {}).get('args', ['?'])[0])[:90]
                                  for e in ev if e.get('type') == 'console_error')
    err404 = collections.Counter((e.get('data') or {}).get('url') for e in ev if e.get('type') == 'http_error')
    lcp = sorted(v for v in ((e.get('data') or {}).get('lcp') for e in ev if e.get('type') == 'vitals') if v)

    out = {
        'generado': dt.datetime.now().isoformat(timespec='minutes'),
        'ventana_dias': DIAS, 'eventos_totales': len(ev), 'sesiones_totales': len(ses),
        'llegada': {
            'sesiones_ultimos_dias': dict(sorted(por_dia.items())[-14:]),
            'fuentes': dict(fuentes.most_common()),
            'movil_pct': round(100 * movil / max(len(recientes), 1), 1),
            'sesiones_ventana': len(recientes),
        },
        'atrio': {
            'sesiones_que_vieron_reels': len(vieron),
            'llegaron_a_puertas': len(puertas), 'eligieron_puerta': len(eligio),
            'pct_puertas': round(100 * len(puertas) / max(len(vieron), 1), 1),
            'pct_eligieron': round(100 * len(eligio) / max(len(puertas), 1), 1),
            'motivo_puertas': dict(motivos.most_common()),
            'puerta_elegida': dict(cual.most_common()),
            'segundos_hasta_puertas_mediana': med(segs_puertas),
            'reels_mas_vistos': dict(reels.most_common(8)),
        },
        'quedarse': {
            'sesiones_con_salida': len(con_salida),
            'segundos_mediana': med(segs), 'segundos_p90': segs[int(len(segs) * 0.9)] if segs else 0,
            'rebote_menos_10s_pct': round(100 * rebote, 1),
            'interacciones_mediana': med(sorted(v['inter'] for v in con_salida)),
            'paginas_mas_vistas': dict(paginas.most_common(10)),
        },
        'roto': {
            'sesiones_con_webgl_roto': ses_webgl,
            'pct_sesiones_sin_3d': round(100 * ses_webgl / max(len(ses), 1), 1),
            'errores_top': dict(errores.most_common(6)),
            'http_404_top': dict(err404.most_common(5)),
            'lcp_mediana_ms': med(lcp),
        },
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(out, open(OUT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False); open(OUT, 'a').write('\n')

    print(f"── LLEGADA · {len(ses)} sesiones en total, {len(recientes)} en {DIAS} días · móvil {out['llegada']['movil_pct']} %")
    print('   por día:', ' '.join(f"{d[5:]}:{n}" for d, n in sorted(por_dia.items())[-10:]))
    print('   fuentes:', dict(fuentes.most_common(5)))
    a = out['atrio']
    print(f"── ATRIO · {a['sesiones_que_vieron_reels']} ven reels → {a['llegaron_a_puertas']} llegan a las puertas "
          f"({a['pct_puertas']} %) → {a['eligieron_puerta']} eligen ({a['pct_eligieron']} %)")
    print('   motivo:', a['motivo_puertas'], '· puerta:', a['puerta_elegida'])
    q = out['quedarse']
    print(f"── QUEDARSE · mediana {q['segundos_mediana']} s (p90 {q['segundos_p90']} s) · rebote <10 s {q['rebote_menos_10s_pct']} % "
          f"· interacciones medianas {q['interacciones_mediana']}")
    print('   páginas:', dict(list(q['paginas_mas_vistas'].items())[:6]))
    r = out['roto']
    print(f"── ROTO · {r['sesiones_con_webgl_roto']} sesiones SIN 3D ({r['pct_sesiones_sin_3d']} % de todas) · LCP mediana {r['lcp_mediana_ms']} ms")
    for k, v in list(r['errores_top'].items())[:4]: print(f"   {v:5d}× {k}")
    print(f'✓ {OUT}')


if __name__ == '__main__':
    main()
