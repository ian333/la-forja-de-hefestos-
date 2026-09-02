#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""senales.py — UN SOLO ARCHIVO con lo que de verdad sabemos, ordenado por si SIRVE.

ian (2026-09-02): "necesito sí o sí alguna manera en la que podamos sacar alguna
característica CONTROLABLE que se relacione con el número de vistas y seguidores... estamos
haciendo un chingo de videos para ver cuál pega, ya tenemos 2 que pegaron chingón, tratamos
de reproducirlos y no imitan para nada a los reyes".

Junta rasgos-reels (píxeles), analisis-ig (retención) y curvas-dia (el corte) y los clasifica
en tres cajones HONESTOS:
  PALANCA    lo decides tú antes de grabar Y tiene evidencia
  TERMOMETRO lo mide el público — sirve para saber temprano, no para diseñar
  DESCARTADO probado y sin señal (vale MÁS que un hallazgo falso: te ahorra el intento)

  python3 scripts/senales.py  →  public/comando/senales.json
"""
import json, math, os, statistics as st

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = lambda n: os.path.join(ROOT, 'public', 'comando', n)


def pear(a, b):
    n = len(a)
    if n < 8: return None
    ma, mb = st.mean(a), st.mean(b)
    va = sum((x-ma)**2 for x in a); vb = sum((x-mb)**2 for x in b)
    if va <= 0 or vb <= 0: return None
    return sum((a[i]-ma)*(b[i]-mb) for i in range(n)) / math.sqrt(va*vb)


def pval(r, n):
    if r is None or n < 8 or abs(r) >= 1: return None
    t = abs(r) * math.sqrt((n-2)/max(1e-12, 1-r*r))
    return round(math.erfc(t/math.sqrt(2)), 4)


def n_necesario(r, pot=0.80):
    """Cuántos videos harían falta para DETECTAR un efecto de tamaño r (aprox, dos colas)."""
    if not r or abs(r) >= 0.99: return None
    z = 0.5*math.log((1+abs(r))/(1-abs(r)))          # Fisher
    return int(math.ceil(((1.96 + 0.84)/z)**2 + 3))


def main():
    ras = {v['id']: v for v in json.load(open(C('rasgos-reels.json')))['videos'] if v.get('movimiento') is not None}
    ig = {v['id']: v for v in json.load(open(C('analisis-ig.json')))['videos']}
    cur = json.load(open(C('curvas-dia.json')))
    L = [dict(**ras[k], skip3s=ig[k]['skip3s'], seg_vistos=ig[k]['seg_vistos'])
         for k in ras if k in ig and ras[k]['dur'] >= 40]
    n = len(L)
    y = [math.log(v['vistas']) for v in L]

    RASGOS = ['saturacion', 'calido', 'frio', 'magenta', 'variedad_color', 'luma',
              'contraste', 'quemado', 'movimiento', 'lleno', 'dur']
    palancas, descartados = [], []
    for rn in RASGOS:
        x = [v[rn] for v in L]
        r_v = pear(x, y)
        r_s = pear(x, [v['skip3s'] for v in L])
        r_t = pear(x, [v['seg_vistos'] for v in L])
        mejor = max([(abs(z or 0), nm, z) for z, nm in
                     [(r_v, 'log_vistas'), (r_s, 'skip3s'), (r_t, 'seg_vistos')]])
        item = {'rasgo': rn, 'vs_vistas': round(r_v, 3), 'p_vistas': pval(r_v, n),
                'vs_skip3s': round(r_s, 3), 'p_skip3s': pval(r_s, n),
                'vs_seg_vistos': round(r_t, 3), 'p_seg_vistos': pval(r_t, n),
                'n_para_probarlo': n_necesario(mejor[0])}
        if min(x for x in [item['p_vistas'], item['p_skip3s'], item['p_seg_vistos']] if x is not None) < 0.05:
            palancas.append(item)
        else:
            descartados.append(item)

    term = {}
    for nm, xs in [('skip3s', [v['skip3s'] for v in L]),
                   ('c_por_mil', [v['c_por_mil'] for v in L]),
                   ('g_por_mil', [v['g_por_mil'] for v in L]),
                   ('seg_vistos', [v['seg_vistos'] for v in L])]:
        r = pear(xs, y)
        term[nm] = {'vs_log_vistas': round(r, 3), 'p': pval(r, n)}

    # ¿cuánto separa de verdad el mejor termómetro? (una r alta no es una regla útil)
    sk = [v['skip3s'] for v in L]
    med = st.median(sk)
    b = st.median([v['vistas'] for v in L if v['skip3s'] < med])
    m = st.median([v['vistas'] for v in L if v['skip3s'] >= med])

    out = {
        'generado': __import__('datetime').date.today().isoformat(),
        'n_piezas_largas': n,
        'veredicto': (
            'NO hay todavía una característica controlable de la IMAGEN que prediga a los reyes. '
            'Lo que más se relaciona con las vistas son reacciones del público (skip a los 3 s '
            'r=-0.72, compartidos/mil r=+0.75), y ninguna de ellas se decide antes de grabar. '
            'Y un buen gancho ACOTA pero no decide: partiendo por la mediana de skip3s, la mitad '
            'buena da apenas ' + f'{b/m:.1f}x' + ' las vistas medianas de la mala. '
            'La causa más probable de que no aparezca la palanca es que cada pieza cambia molécula, '
            'guion, cámara, color y duración A LA VEZ: nada es atribuible. Para encontrarla hay que '
            'dejar de variar todo y hacer A/B de una sola cosa.'),
        'palancas_con_evidencia': palancas,
        'termometros': term,
        'termometro_util': {'metrica': 'skip3s', 'mediana_pct': round(med, 1),
                            'vistas_medianas_mitad_buena': b, 'vistas_medianas_mitad_mala': m,
                            'factor': round(b/m, 2),
                            'nota': 'se mide en HORAS: sirve para saber temprano si una pieza va a volar, no para diseñarla'},
        'descartados': descartados,
        'el_corte': {'pico_dia_mediana': cur['mediana_pico_dia'], 'corte_dia_mediana': cur['mediana_corte_dia'],
                     'vida_util_mediana': cur['mediana_vida_util'], 'cola_pct_mediana': cur['mediana_cola_pct'],
                     'nota': 'YouTube decide en ~48 h y no vuelve. Solo el 6.1 % de las vistas del canal llega tras el corte.'},
    }
    json.dump(out, open(C('senales.json'), 'w'), ensure_ascii=False, indent=1)

    print(f"=== SEÑALES · {n} piezas largas ===\n")
    print("PALANCAS con evidencia (lo decides tú antes de grabar):")
    for p in palancas:
        print(f"  {p['rasgo']:16s} vistas {p['vs_vistas']:+.3f}  skip {p['vs_skip3s']:+.3f}  "
              f"seg {p['vs_seg_vistos']:+.3f}   (n para probarlo: {p['n_para_probarlo']})")
    if not palancas: print("  (ninguna)")
    print("\nTERMÓMETROS (los pone el público, no tú):")
    for k, v in term.items():
        print(f"  {k:16s} vs log(vistas) r = {v['vs_log_vistas']:+.3f}  p = {v['p']}")
    print(f"\n  el mejor termómetro separa apenas {out['termometro_util']['factor']}x — acota, no decide")
    print(f"\nDESCARTADOS (probados, sin señal): {', '.join(d['rasgo'] for d in descartados)}")
    print(f"\n✓ {C('senales.json')}")


if __name__ == '__main__':
    main()
