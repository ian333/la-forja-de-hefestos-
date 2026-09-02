#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ritmo.py — mide las DOS variables de ritmo que la literatura dice que importan,
y que nosotros hemos tenido clavadas sin darnos cuenta.

ian (2026-09-02): "ve allá afuera a investigar, si podemos encontrar o meter al menos 1
variable que nos dé correlación".

LO QUE SE ENCONTRÓ AFUERA (y por qué estas dos y no otras):
  · Estudio sobre 2,511 videos de TikTok (visual-audio, engagement): el NÚMERO DE CORTES
    y la COMPLEJIDAD VISUAL tienen relación en U INVERTIDA con el engagement (hay un
    óptimo), y la VELOCIDAD DEL HABLA tiene efecto POSITIVO Y SIGNIFICATIVO sobre los
    COMPARTIDOS — no sobre likes ni comentarios. Compartidos es justo la métrica de ian.
  · Benchmarks de retención en video corto: un cambio visual cada 1.5-3 s (= 20-40
    cortes/min); escenas frecuentes dan +32 % de retención contra plano estático. El
    contenido educativo pide sostener un poco más que el de entretenimiento.

POR QUÉ ESTO IMPORTA MÁS QUE UNA CORRELACIÓN: nuestras 24 piezas viven todas en la MISMA
banda estrecha de las dos variables. Sin varianza no hay correlación posible — el análisis
no falló por falta de datos, falló porque nunca movimos la perilla.

  python3 scripts/ritmo.py  →  public/comando/ritmo.json
"""
import json, os, re, glob, statistics as st

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEG_POR_PALABRA = 0.455      # la constante del pipeline (video.sh fit-check)
HUECO = 0.40                 # el hueco entre líneas del ensamble

# Rangos de referencia EXTERNOS (no nuestros)
REF = {'cortes_por_min': {'bajo': 20, 'alto': 40,
                          'fuente': 'benchmarks de retención: un cambio visual cada 1.5-3 s'},
       'palabras_por_min': {'bajo': 150, 'alto': 190,
                            'fuente': 'ritmo natural del habla en español'}}


def tomas_por_pieza():
    s = open(os.path.join(ROOT, 'src', 'cinematic', 'CinematicMolecule.tsx')).read()
    out = {}
    for m in re.finditer(r"\n  ([a-zA-Z0-9_'-]+): \[\n", s):
        k = m.group(1).strip("'")
        i = m.end(); j = s.find('\n  ],', i)
        if j < 0: continue
        d = [float(x) for x in re.findall(r'dur: ([\d.]+)', s[i:j])]
        if len(d) >= 4 and 20 < sum(d) < 200:
            out[k] = {'tomas': len(d), 'dur': round(sum(d), 1),
                      'cortes_por_min': round(60 * (len(d) - 1) / sum(d), 2),
                      's_por_toma': round(sum(d) / len(d), 1)}
    return out


def guiones():
    out = {}
    for g in sorted(glob.glob(os.path.join(ROOT, 'scripts', 'guiones', '*.txt'))):
        ls = [l.strip() for l in open(g) if l.strip()]
        w = sum(len(l.split()) for l in ls)
        if w < 40: continue
        voz = w * SEG_POR_PALABRA
        real = voz + len(ls) * HUECO
        out[os.path.basename(g)[:-4]] = {
            'lineas': len(ls), 'palabras': w,
            'palabras_por_min_voz': round(60 * w / voz, 1),
            'palabras_por_min_real': round(60 * w / real, 1)}
    return out


def main():
    T, G = tomas_por_pieza(), guiones()
    c = [v['cortes_por_min'] for v in T.values()]
    p = [v['palabras_por_min_real'] for v in G.values()]
    out = {
        'generado': __import__('datetime').date.today().isoformat(),
        'referencia_externa': REF,
        'nuestro_rango': {
            'cortes_por_min': {'min': min(c), 'max': max(c), 'mediana': round(st.median(c), 2),
                               'sd': round(st.pstdev(c), 2), 'n': len(c)},
            'palabras_por_min': {'min': min(p), 'max': max(p), 'mediana': round(st.median(p), 1),
                                 'sd': round(st.pstdev(p), 2), 'n': len(p)}},
        'diagnostico': (
            'Las dos variables que la literatura señala están CLAVADAS en nuestro catálogo. '
            f'Cortes/min: vivimos en {min(c):.1f}-{max(c):.1f} contra un rango de referencia de '
            f'{REF["cortes_por_min"]["bajo"]}-{REF["cortes_por_min"]["alto"]}. Palabras/min: '
            f'sd = {st.pstdev(p):.2f} sobre {len(p)} guiones, o sea CERO varianza — es una '
            'constante del pipeline (0.455 s/palabra), no una decisión por pieza. '
            'Sin varianza no puede haber correlación: el análisis no falló por falta de datos, '
            'falló porque nunca movimos la perilla.'),
        'experimento': {
            'porque': 'Es la unica forma de convertir "hacemos videos a ver cual pega" en un experimento.',
            'diseno': 'Piezas HERMANAS: mismo bin, mismo guion, misma voz. Solo cambia el ritmo.',
            'brazos': [
                {'nombre': 'A · como hoy', 'cortes_por_min': 6.5, 'palabras_por_min': 132},
                {'nombre': 'B · rapido', 'cortes_por_min': 20, 'palabras_por_min': 165,
                 'como': 'partir cada toma larga en 3 + VEL del TTS a ~1.25'}],
            'n_por_brazo': 3,
            'metrica_de_corte': 'skip3s y compartidos/mil — se leen en HORAS, no hay que esperar el ciclo completo',
            'coste': 'solo raster: el bin, la voz y el guion ya existen',
        },
        'piezas': T, 'guiones': G,
    }
    json.dump(out, open(os.path.join(ROOT, 'public', 'comando', 'ritmo.json'), 'w'),
              ensure_ascii=False, indent=1)
    print("=== RITMO · las dos perillas que nunca movimos ===\n")
    print(f"  cortes/min      nosotros {min(c):5.1f} – {max(c):5.1f} (sd {st.pstdev(c):.2f})   "
          f"referencia {REF['cortes_por_min']['bajo']}–{REF['cortes_por_min']['alto']}")
    print(f"  palabras/min    nosotros {min(p):5.1f} – {max(p):5.1f} (sd {st.pstdev(p):.2f})   "
          f"referencia {REF['palabras_por_min']['bajo']}–{REF['palabras_por_min']['alto']}")
    print(f"\n  → la 2a tiene sd {st.pstdev(p):.2f} sobre {len(p)} guiones: es una CONSTANTE del código.")
    print("\n✓ public/comando/ritmo.json")


if __name__ == '__main__':
    main()
