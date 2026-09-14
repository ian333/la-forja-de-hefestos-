#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""comentarios-ml.py — qué dice la gente, qué reel lo provoca, y un clasificador para los que vienen.

Por qué (ian, 2026-09-14): «analiza los comentarios y haz machine learning con estos datos; también me
gustaría que los contestes, pero eso después». Entra `public/comando/comentarios.json` (IG + YouTube,
comentarios.py) y `public/comando/comentarios-etiquetas.json` (cada comentario leído y etiquetado a mano).

Sale `public/comando/comentarios-analisis.json`:
  1. EL CENSO    cuántos de cada tipo (asombro, pregunta, explica, corrige, duda_real, esceptico,
                 espiritual, confusion, etiqueta, reto, otro) y los más votados de cada uno
  2. POR REEL    comentarios por cada mil vistas y su mezcla, cruzado con dataset.json
  3. LA COLA     preguntas, dudas, confusiones y correcciones SIN respuesta de la cuenta = qué contestar
  4. RESPONDER   likes de los hilos donde la cuenta contestó contra los que no (correlación, no causa)
  5. EL MODELO   TF-IDF (caracteres + palabras) + regresión logística, validación cruzada 5 pliegues,
                 contra la línea base de «siempre la clase más común». Se guarda para clasificar los nuevos.
  6. QUÉ MUEVE   correlación de rangos (Spearman) entre los rasgos de cada reel y sus comentarios por mil

Con ~300 comentarios y dos reels que tienen dos tercios, el modelo es un ORDENADOR de comentarios
nuevos, no un oráculo: las conclusiones salen de las etiquetas, y el script dice cuánto acierta.

  /home/ian/tts-venv/bin/python scripts/comentarios-ml.py      (iangpu: ese venv trae scikit-learn)
"""
import os, re, json, math, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
C = lambda *p: os.path.join(ROOT, 'public', 'comando', *p)
OUT = C('comentarios-analisis.json')
MODELO = os.path.join(ROOT, 'dist-video', '_ml', 'comentarios-clasificador.joblib')
GAIA = {'gaiaprime_mx', '@GaiaPrime-y7q'}
DUDOSAS = ('pregunta', 'duda_real', 'confusion', 'corrige')


def aplanar(d):
    filas = []
    for plat, lista, clave_url in (('ig', (d.get('ig') or {}).get('medios', []), 'permalink'), ('yt', (d.get('yt') or {}).get('videos', []), 'url')):
        for m in lista:
            titulo = (m.get('caption') or m.get('titulo') or '').split('\n')[0][:70]
            for c in m.get('comentarios', []):
                gaia_resp = any((r.get('autor') or '') in GAIA for r in c.get('respuestas', []))
                base = {'plataforma': plat, 'medio': m['id'], 'url': m.get(clave_url), 'reel': titulo, 'hilo': c.get('id')}
                filas.append({**base, 'id': c.get('id'), 'autor': c.get('autor') or '', 'texto': (c.get('texto') or '').strip(),
                              'likes': c.get('likes') or 0, 'nivel': 0, 'contesto_gaia': gaia_resp, 'n_resp': len(c.get('respuestas', []))})
                for r in c.get('respuestas', []):
                    filas.append({**base, 'id': r.get('id'), 'autor': r.get('autor') or '', 'texto': (r.get('texto') or '').strip(),
                                  'likes': r.get('likes') or 0, 'nivel': 1, 'contesto_gaia': gaia_resp, 'n_resp': 0})
    return filas


def etiquetar(f, tabla):
    a, t = f['autor'], f['texto']
    if a in GAIA: return 'gaia', 'regla'
    candidatos = [(len(pre), lab) for au, pre, lab in tabla if au == a and t.startswith(pre)]
    if candidatos: return max(candidatos)[1], 'mano'
    if not t: return 'otro', 'regla'
    if not re.search(r'[A-Za-zÀ-ÿ0-9]', t): return 'asombro', 'regla'          # solo emojis
    if re.fullmatch(r'(@[\w.]+\s*)+', t): return 'etiqueta', 'regla'           # solo arrobas = comparte
    return 'otro', 'SIN_ETIQUETA'


def spearman(x, y):
    """ρ de Spearman con empates promediados + p aproximada por t de Student (n ≥ 10)."""
    def rangos(v):
        orden = sorted(range(len(v)), key=lambda i: v[i]); r = [0.0] * len(v); i = 0
        while i < len(v):
            j = i
            while j + 1 < len(v) and v[orden[j + 1]] == v[orden[i]]: j += 1
            for k in range(i, j + 1): r[orden[k]] = (i + j) / 2 + 1
            i = j + 1
        return r
    rx, ry = rangos(x), rangos(y); n = len(x)
    mx, my = sum(rx) / n, sum(ry) / n
    num = sum((a - mx) * (b - my) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - mx) ** 2 for a in rx) * sum((b - my) ** 2 for b in ry))
    rho = num / den if den else 0.0
    if n < 10 or abs(rho) >= 1: return rho, None
    t = rho * math.sqrt((n - 2) / (1 - rho * rho))
    p = math.erfc(abs(t) / math.sqrt(2))                                       # normal: suficiente para n ≳ 30
    return rho, p


def main():
    d = json.load(open(C('comentarios.json'), encoding='utf-8'))
    tabla = json.load(open(C('comentarios-etiquetas.json'), encoding='utf-8'))['etiquetas']
    filas = aplanar(d)
    for f in filas: f['tipo'], f['fuente_etiqueta'] = etiquetar(f, tabla)
    gente = [f for f in filas if f['tipo'] != 'gaia']
    sin = [f for f in gente if f['fuente_etiqueta'] == 'SIN_ETIQUETA']

    # ── 1. EL CENSO ────────────────────────────────────────────────────────────
    cuenta = collections.Counter(f['tipo'] for f in gente)
    censo = {k: {'n': n, 'pct': round(100 * n / len(gente), 1)} for k, n in cuenta.most_common()}
    top = {k: [{'likes': f['likes'], 'autor': f['autor'], 'texto': f['texto'][:160], 'reel': f['reel'], 'plataforma': f['plataforma']}
               for f in sorted((g for g in gente if g['tipo'] == k), key=lambda g: -g['likes'])[:4]] for k in cuenta}

    # ── 2. POR REEL (cruce con dataset.json por id de Instagram o URL) ────────
    ds = json.load(open(C('dataset.json'), encoding='utf-8'))
    ds_filas = ds.get('filas') or ds.get('rows') or []
    por_id = {str(r.get('ig_id')): r for r in ds_filas if r.get('ig_id')}
    por_url = {(r.get('ig_url') or '').rstrip('/'): r for r in ds_filas if r.get('ig_url')}
    reels = collections.OrderedDict()
    for m in (d.get('ig') or {}).get('medios', []):
        r = por_id.get(str(m['id'])) or por_url.get((m.get('permalink') or '').rstrip('/'))
        mios = [f for f in gente if f['plataforma'] == 'ig' and f['medio'] == m['id']]
        vistas = (r or {}).get('ig_vistas')
        reels[m['id']] = {'reel': (m.get('caption') or '').split('\n')[0][:70], 'fecha': (m.get('fecha') or '')[:10], 'vistas': vistas,
                          'comentarios_gente': len(mios), 'por_mil': round(1000 * len(mios) / vistas, 2) if vistas else None,
                          'mezcla': dict(collections.Counter(f['tipo'] for f in mios).most_common()), 'rasgos': r}
    con_vistas = [v for v in reels.values() if v['vistas']]

    # ── 3. LA COLA DE RESPUESTAS ───────────────────────────────────────────────
    cola = [{'plataforma': f['plataforma'], 'id': f['id'], 'autor': f['autor'], 'tipo': f['tipo'], 'likes': f['likes'],
             'texto': f['texto'], 'reel': f['reel'], 'url': f['url']}
            for f in gente if f['nivel'] == 0 and f['tipo'] in DUDOSAS and not f['contesto_gaia']]
    cola.sort(key=lambda x: (-x['likes'], x['tipo']))

    # ── 4. ¿RESPONDER DA LIKES? (correlación: la cuenta contestaba lo que ya era popular) ─────────
    tops = [f for f in gente if f['nivel'] == 0]
    hilo_likes = collections.defaultdict(int)
    for f in filas: hilo_likes[(f['medio'], f['hilo'])] += f['likes']
    con_r = [hilo_likes[(f['medio'], f['hilo'])] for f in tops if f['contesto_gaia']]
    sin_r = [hilo_likes[(f['medio'], f['hilo'])] for f in tops if not f['contesto_gaia']]
    respuestas_gaia = [f for f in filas if f['tipo'] == 'gaia']
    responder = {'hilos_con_respuesta': len(con_r), 'hilos_sin_respuesta': len(sin_r),
                 'likes_por_hilo_con_respuesta': round(sum(con_r) / max(len(con_r), 1), 2),
                 'likes_por_hilo_sin_respuesta': round(sum(sin_r) / max(len(sin_r), 1), 2),
                 'likes_promedio_de_las_respuestas_de_gaia': round(sum(f['likes'] for f in respuestas_gaia) / max(len(respuestas_gaia), 1), 2),
                 'respuestas_de_gaia': len(respuestas_gaia),
                 'nota': 'correlación, no causa: la cuenta suele contestar los comentarios que ya estaban votados'}

    # ── 5. EL MODELO ───────────────────────────────────────────────────────────
    modelo = {'disponible': False}
    try:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import make_pipeline, make_union
        from sklearn.model_selection import StratifiedKFold, cross_val_predict
        from sklearn.metrics import accuracy_score, f1_score, classification_report
        muestras = [f for f in gente if re.search(r'[A-Za-zÀ-ÿ]', f['texto']) and f['fuente_etiqueta'] == 'mano']
        clases = collections.Counter(f['tipo'] for f in muestras)
        y = [f['tipo'] if clases[f['tipo']] >= 6 else 'otro' for f in muestras]
        X = [f['texto'].lower() for f in muestras]
        tuberia = make_pipeline(
            make_union(TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5), sublinear_tf=True, min_df=1),
                       TfidfVectorizer(analyzer='word', ngram_range=(1, 2), sublinear_tf=True, min_df=1)),
            LogisticRegression(max_iter=4000, class_weight='balanced', C=4.0))
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=7)
        pred = cross_val_predict(tuberia, X, y, cv=cv)
        mayoritaria = collections.Counter(y).most_common(1)[0]
        rep = classification_report(y, pred, output_dict=True, zero_division=0)
        modelo = {'disponible': True, 'n': len(y), 'clases': dict(collections.Counter(y).most_common()),
                  'exactitud_cv': round(accuracy_score(y, pred), 3), 'f1_macro_cv': round(f1_score(y, pred, average='macro'), 3),
                  'linea_base_clase_comun': {'clase': mayoritaria[0], 'exactitud': round(mayoritaria[1] / len(y), 3)},
                  'f1_por_clase': {k: round(v['f1-score'], 2) for k, v in rep.items() if k in set(y)},
                  'confusiones_frecuentes': collections.Counter(f'{a}→{b}' for a, b in zip(y, pred) if a != b).most_common(6),
                  'receta': 'TF-IDF caracteres 2-5 + palabras 1-2 → regresión logística balanceada, C=4; validación cruzada estratificada 5 pliegues'}
        tuberia.fit(X, y)
        import joblib
        os.makedirs(os.path.dirname(MODELO), exist_ok=True); joblib.dump(tuberia, MODELO); modelo['guardado'] = MODELO
    except ImportError as e:
        modelo['error'] = f'sin scikit-learn en este python ({e}); corre con /home/ian/tts-venv/bin/python en iangpu'

    # ── 6. QUÉ MUEVE LOS COMENTARIOS (entre reels) ─────────────────────────────
    rasgos = ['ig_vistas', 'ig_c_por_mil', 'ig_g_por_mil', 'ig_skip3s', 'ig_seg_vistos', 'dur_s', 'movimiento', 'lleno', 'saturacion', 'contraste']
    mueve = []
    for r in rasgos:
        pares = [(v['rasgos'][r], v['por_mil']) for v in con_vistas if v['rasgos'] and v['rasgos'].get(r) is not None and v['por_mil'] is not None]
        if len(pares) >= 15:
            rho, p = spearman([a for a, _ in pares], [b for _, b in pares])
            mueve.append({'rasgo': r, 'n': len(pares), 'rho': round(rho, 2), 'p_aprox': round(p, 3) if p is not None else None})
    mueve.sort(key=lambda z: -abs(z['rho']))

    out = {'generado': __import__('datetime').datetime.now().isoformat(timespec='minutes'),
           'total': {'comentarios': len(filas), 'de_la_gente': len(gente), 'de_gaia': len(respuestas_gaia),
                     'etiquetados_a_mano': sum(1 for f in gente if f['fuente_etiqueta'] == 'mano'), 'sin_etiqueta': len(sin)},
           'censo': censo, 'mas_votados': top,
           'por_reel': sorted(({k: v[k] for k in ('reel', 'fecha', 'vistas', 'comentarios_gente', 'por_mil', 'mezcla')} for v in reels.values() if v['comentarios_gente']),
                              key=lambda z: -z['comentarios_gente']),
           'cola_de_respuestas': cola, 'responder': responder, 'modelo': modelo, 'que_mueve_los_comentarios': mueve,
           'sin_etiqueta_para_revisar': [{'autor': f['autor'], 'texto': f['texto'][:120]} for f in sin]}
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); open(OUT, 'a').write('\n')

    print(f"── {len(gente)} comentarios de la gente · {len(respuestas_gaia)} respuestas de GAIA · sin etiqueta: {len(sin)}")
    for k, v in censo.items(): print(f"   {k:11} {v['n']:4d}  {v['pct']:5.1f} %")
    print(f"── cola de respuestas: {len(cola)} ({dict(collections.Counter(c['tipo'] for c in cola))})")
    print(f"── responder: {responder}")
    if modelo.get('disponible'):
        print(f"── modelo: exactitud CV {modelo['exactitud_cv']} · F1 macro {modelo['f1_macro_cv']} · línea base {modelo['linea_base_clase_comun']}")
        print(f"   F1 por clase: {modelo['f1_por_clase']}")
        print(f"   confusiones: {modelo['confusiones_frecuentes']}")
    else: print('── modelo:', modelo.get('error'))
    print('── qué mueve los comentarios por mil (Spearman):')
    for z in mueve[:6]: print(f"   {z['rasgo']:14} ρ={z['rho']:+.2f}  p≈{z['p_aprox']}  n={z['n']}")
    for s in sin[:12]: print('   SIN ETIQUETA:', s['autor'], '|', s['texto'][:80])
    print(f'✓ {OUT}')


if __name__ == '__main__': main()
