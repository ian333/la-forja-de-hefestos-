#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""analisis-rasgos.py — cruza los RASGOS medidos del video contra su rendimiento,
CONTROLANDO POR ÉPOCA.

POR QUÉ EL CONTROL (y por qué sin él el análisis miente): el canal mejoró con el tiempo —
guion, cámara, densidad. Cualquier rasgo que también haya cambiado con el tiempo va a
correlacionar con el rendimiento sin causar nada. Ejemplo del riesgo: si las piezas nuevas
son más magenta Y les va mejor, "magenta → vistas" sale fuerte y es basura.

El remedio: para cada rasgo y cada métrica se quita primero la TENDENCIA TEMPORAL (regresión
sobre la fecha) y se correlacionan los RESIDUOS. Si la relación sobrevive, no es la época.

  python3 scripts/analisis-rasgos.py
"""
import json, math, os, statistics as st, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def pearson(a, b):
    n = len(a)
    if n < 8: return None
    ma, mb = st.mean(a), st.mean(b)
    va = sum((x-ma)**2 for x in a); vb = sum((x-mb)**2 for x in b)
    if va <= 0 or vb <= 0: return None
    return sum((a[i]-ma)*(b[i]-mb) for i in range(n)) / math.sqrt(va*vb)


def residuos(y, t):
    """y sin su tendencia lineal en t."""
    mt, my = st.mean(t), st.mean(y)
    vt = sum((x-mt)**2 for x in t)
    if vt <= 0: return list(y)
    b = sum((t[i]-mt)*(y[i]-my) for i in range(len(y))) / vt
    a = my - b*mt
    return [y[i] - (a + b*t[i]) for i in range(len(y))]


def p_valor(r, n):
    """p aproximado (t de Student, dos colas) — para no cantar ruido como hallazgo."""
    if r is None or n < 8 or abs(r) >= 1: return None
    tt = abs(r) * math.sqrt((n-2) / max(1e-12, 1-r*r))
    # aproximación normal, suficiente para n>20
    z = tt
    p = math.erfc(z / math.sqrt(2))
    return round(p, 4)


def main():
    d = json.load(open(os.path.join(ROOT, 'public', 'comando', 'rasgos-reels.json')))
    V = [v for v in d['videos'] if v.get('movimiento') is not None]
    print(f"=== {len(V)} reels medidos ===\n")
    d0 = min(dt.date.fromisoformat(v['fecha']) for v in V)
    t = [(dt.date.fromisoformat(v['fecha']) - d0).days for v in V]

    RASGOS = ['saturacion', 'calido', 'frio', 'magenta', 'variedad_color',
              'luma', 'contraste', 'quemado', 'movimiento', 'lleno', 'dur']
    METR = {'log vistas': [math.log(max(v['vistas'], 1)) for v in V],
            'compartidos/mil': [v['c_por_mil'] for v in V],
            'guardados/mil': [v['g_por_mil'] for v in V]}

    print(f"{'':16s} {'r crudo':>9s} {'r sin época':>12s} {'p':>8s}")
    salida = {}
    for mn, y in METR.items():
        print(f"\n── {mn} ──")
        yr = residuos(y, t)
        fila = {}
        for rn in RASGOS:
            x = [v[rn] for v in V]
            if any(z is None for z in x): continue
            r0 = pearson(x, y)
            xr = residuos(x, t)
            r1 = pearson(xr, yr)
            p = p_valor(r1, len(V))
            marca = ''
            if r1 is not None and p is not None:
                if p < 0.01: marca = '  ◆◆ sólido'
                elif p < 0.05: marca = '  ◆ aguanta'
                elif abs(r0 or 0) > 0.3: marca = '  (era época)'
            fila[rn] = {'crudo': round(r0, 3) if r0 is not None else None,
                        'sin_epoca': round(r1, 3) if r1 is not None else None, 'p': p}
            print(f"{rn:16s} {r0:+9.3f} {r1:+12.3f} {p if p is not None else float('nan'):8.4f}{marca}")
        salida[mn] = fila

    # ¿los rasgos cambiaron con el tiempo? (el confusor, explícito)
    print("\n── ¿cada rasgo cambió con la ÉPOCA? (si sí, el crudo estaba contaminado) ──")
    epoca = {}
    for rn in RASGOS:
        x = [v[rn] for v in V]
        if any(z is None for z in x): continue
        r = pearson(x, [float(z) for z in t])
        epoca[rn] = round(r, 3) if r is not None else None
        print(f"{rn:16s} r con la fecha = {r:+.3f}")

    # ── CONTROL DE FORMATO. El canal vende DOS productos distintos: clips cortos de átomo
    # y piezas largas narradas. Si un rasgo solo separa esos dos grupos, no está midiendo
    # el rasgo: está midiendo cuál producto es. Se comprueba DENTRO de cada grupo.
    cortos = [v for v in V if v['dur'] < 40]; largos = [v for v in V if v['dur'] >= 40]
    sol = [v for v in V if v['fecha'] >= '2026-07-01']
    sc = [v for v in sol if v['dur'] < 40]; sl = [v for v in sol if v['dur'] >= 40]
    print("\n── CONTROL DE FORMATO ──")
    print(f"  <40 s : {len(cortos):2d} videos · vistas medianas {st.median([v['vistas'] for v in cortos]):7.0f}")
    print(f"  >=40s : {len(largos):2d} videos · vistas medianas {st.median([v['vistas'] for v in largos]):7.0f}")
    dentro = {}
    if len(largos) >= 12:
        y = [math.log(max(v['vistas'], 1)) for v in largos]
        yc = [v['c_por_mil'] for v in largos]
        for rn in RASGOS:
            x = [v[rn] for v in largos]
            if any(z is None for z in x): continue
            dentro[rn] = {'log_vistas': round(pearson(x, y) or 0, 3),
                          'c_por_mil': round(pearson(x, yc) or 0, 3)}
        print(f"  DENTRO de los largos (n={len(largos)}), lo que quedaba en pie:")
        for rn in ['dur', 'contraste', 'lleno', 'saturacion', 'movimiento']:
            if rn in dentro:
                print(f"    {rn:14s} vistas r={dentro[rn]['log_vistas']:+.3f} · compartidos r={dentro[rn]['c_por_mil']:+.3f}")
    formato = {
        'corte_s': 40, 'n_cortos': len(cortos), 'n_largos': len(largos),
        'vistas_medianas_cortos': st.median([v['vistas'] for v in cortos]) if cortos else None,
        'vistas_medianas_largos': st.median([v['vistas'] for v in largos]) if largos else None,
        'solapado_desde': '2026-07-01', 'n_sol_cortos': len(sc), 'n_sol_largos': len(sl),
        'sol_vistas_cortos': st.median([v['vistas'] for v in sc]) if sc else None,
        'sol_vistas_largos': st.median([v['vistas'] for v in sl]) if sl else None,
        'sol_cmil_cortos': st.median([v['c_por_mil'] for v in sc]) if sc else None,
        'sol_cmil_largos': st.median([v['c_por_mil'] for v in sl]) if sl else None,
        'dentro_de_largos': dentro,
    }
    p = os.path.join(ROOT, 'public', 'comando', 'analisis-rasgos.json')
    json.dump({'generado': dt.date.today().isoformat(), 'n': len(V),
               'nota': ('r crudo = correlación directa. r sin época = correlación de los RESIDUOS tras quitar '
                        'la tendencia temporal de AMBAS series; es la que vale, porque el canal mejoró con el '
                        'tiempo y eso contamina cualquier rasgo que también haya cambiado. p es aproximado.'),
               'pruebas': {'n_correlaciones': len(RASGOS) * len(METR),
                           'falsos_esperados_p05': round(len(RASGOS) * len(METR) * 0.05, 1),
                           'nota': 'con 33 pruebas, a p<0.05 se esperan ~1.6 hallazgos por puro azar; solo los p<0.01 pasan esa vara'},
               'correlaciones': salida, 'rasgo_vs_epoca': epoca, 'control_formato': formato},
              open(p, 'w'), ensure_ascii=False, indent=1)
    print(f"\n✓ {p}")


if __name__ == '__main__':
    main()
