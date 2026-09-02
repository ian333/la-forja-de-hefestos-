#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ritmo-pieza.py — EL PORTERO DE REGISTRO: una pieza no sale sin declarar su TRATAMIENTO.

POR QUÉ EXISTE (ian, 2026-09-02): "¿cuáles son todas las métricas y gates?" — al auditarlos
salió que ninguno exige que la pieza ANOTE con qué la hicimos. Por eso llevamos 24
experimentos sin poder atribuir nada: cada pieza cambia molécula, guion, cámara, color y
ritmo a la vez (§EL RITMO). El portero que faltaba no es de calidad: es de REGISTRO.

LA REGLA, y es a propósito: **BLOQUEA por no declarar, AVISA por salirse del rango.**
No sabemos cuál es el valor correcto — sabemos que hay que anotarlo. Un portero que
impusiera el rango de afuera estaría inventando un óptimo que nadie ha medido AQUÍ.

MIDE SOLO (ian no teclea números):
  cortes_por_min   de CAMERA_SHOTS en CinematicMolecule.tsx
  silabas_por_seg  de segs.json si ya hay voz (REAL), si no del guion (estimado)

SE DECLARA A MANO (una línea cada uno, son juicios, no medidas):
  ritmo.brazo        "A" | "B"                      a qué brazo del experimento pertenece
  copy.marco         "revelacion" | "explicacion"   §LA NEUROLOGÍA DEL CHISME
  copy.activacion    "alta" | "baja"                asombro/enojo/ansiedad vs tristeza
  copy.valor_propio  una frase                      completa "te mando esto porque…"

  python3 scripts/ritmo-pieza.py <id> [--escribir]
"""
import json, os, re, sys, unicodedata

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOC = re.compile(r'[aeiouáéíóúü]+')
# rangos de REFERENCIA EXTERNA — avisan, no reprueban (ver §EL RITMO del canon)
REF_CORTES = (20, 40)      # un cambio visual cada 1.5-3 s
REF_SILABAS = (6.0, 7.8)   # español natural 7.82 síl/s; abajo de 6 es media velocidad


def silabas(txt):
    t = unicodedata.normalize('NFC', txt.lower())
    return sum(max(1, len(VOC.findall(re.sub(r'[^a-záéíóúüñ]', '', w))))
               for w in t.split() if re.sub(r'[^a-záéíóúüñ]', '', w))


def cortes(molkey):
    s = open(os.path.join(ROOT, 'src', 'cinematic', 'CinematicMolecule.tsx')).read()
    m = re.search(r"\n  '?" + re.escape(molkey) + r"'?: \[\n", s)
    if not m: return None
    i = m.end(); j = s.find('\n  ],', i)
    d = [float(x) for x in re.findall(r'dur: ([\d.]+)', s[i:j])]
    if len(d) < 2: return None
    return {'tomas': len(d), 'dur_tomas': round(sum(d), 2),
            'cortes_por_min': round(60 * (len(d) - 1) / sum(d), 2)}


def habla(d):
    """REAL si ya hay segs.json (la voz que de verdad se grabó); estimado si no."""
    g = (d.get('guion') or {}).get('archivo')
    if not g or not os.path.exists(os.path.join(ROOT, g)):
        return None
    ls = [l.strip() for l in open(os.path.join(ROOT, g)) if l.strip()]
    sil = sum(silabas(l) for l in ls)
    a = d.get('audio') or {}
    segp = os.path.join(ROOT, a.get('dir', ''), a.get('segs', 'segs.json'))
    if os.path.exists(segp):
        try:
            js = json.load(open(segp))
            segs = js if isinstance(js, list) else js.get('segs', js.get('cues', []))
            hablado = sum(float(x.get('end', x.get('t1', 0))) - float(x.get('start', x.get('t0', 0))) for x in segs)
            fin = max(float(x.get('end', x.get('t1', 0))) for x in segs)
            return {'silabas': sil, 'fuente': 'segs.json (REAL)',
                    'silabas_por_seg_hablando': round(sil / hablado, 2) if hablado else None,
                    'silabas_por_seg_del_video': round(sil / fin, 2) if fin else None}
        except Exception:
            pass
    voz = sum(len(l.split()) for l in ls) * 0.455
    real = voz + len(ls) * 0.40
    return {'silabas': sil, 'fuente': 'estimado (aún sin TTS)',
            'silabas_por_seg_hablando': round(sil / voz, 2),
            'silabas_por_seg_del_video': round(sil / real, 2)}


def main():
    vid = sys.argv[1]
    escribir = '--escribir' in sys.argv
    p = os.path.join(ROOT, 'videos', f'{vid}.json')
    d = json.load(open(p, encoding='utf-8'))
    q = (d.get('escena') or {}).get('query', '')
    mk = (re.search(r'm=([A-Za-z0-9_-]+)', q) or [None, None])[1]

    print(f"── RITMO de {vid}  (escena m={mk}) ──")
    C, H = cortes(mk) if mk else None, habla(d)
    faltan, avisos = [], []

    if C:
        print(f"   cortes: {C['tomas']} tomas en {C['dur_tomas']}s  →  {C['cortes_por_min']} cortes/min"
              f"   (referencia {REF_CORTES[0]}-{REF_CORTES[1]})")
        if not (REF_CORTES[0] <= C['cortes_por_min'] <= REF_CORTES[1]):
            avisos.append(f"cortes/min {C['cortes_por_min']} fuera de {REF_CORTES} — es AVISO, no falla")
    else:
        # No toda pieza es una escena de CAMERA_SHOTS: las clases y el metraje existente no
        # tienen registro de tomas. No se les puede MEDIR el corte, así que se les EXIGE
        # declararlo — el objetivo es que quede anotado, no que lo calcule yo.
        dec = (d.get('ritmo') or {}).get('cortes_por_min')
        if dec:
            print(f"   cortes: {dec} cortes/min   [DECLARADO a mano: la pieza no usa CAMERA_SHOTS]")
            if not (REF_CORTES[0] <= float(dec) <= REF_CORTES[1]):
                avisos.append(f"cortes/min {dec} fuera de {REF_CORTES} — es AVISO, no falla")
        else:
            faltan.append(f"la escena '{mk}' no está en CAMERA_SHOTS → declara ritmo.cortes_por_min a mano")

    if H:
        print(f"   habla: {H['silabas']} sílabas · {H['silabas_por_seg_hablando']} síl/s hablando · "
              f"{H['silabas_por_seg_del_video']} síl/s sobre el video   [{H['fuente']}]"
              f"   (español natural 7.82)")
        v = H['silabas_por_seg_hablando']
        if v and not (REF_SILABAS[0] <= v <= REF_SILABAS[1]):
            avisos.append(f"{v} síl/s = {100*v/7.82:.0f} % del ritmo natural del español — AVISO")
    else:
        faltan.append('la pieza no declara guion.archivo, o no existe')

    # ── lo que SÍ se exige declarar (juicios, no medidas)
    r = d.setdefault('ritmo', {})
    c = (d.get('publicar') or {}).get('copy') or {}
    exigidos = [('ritmo.brazo', r.get('brazo'), '"A" (como hoy) o "B" (rápido)'),
                ('publicar.copy.marco', c.get('marco'), '"revelacion" o "explicacion" — §LA NEUROLOGÍA DEL CHISME'),
                ('publicar.copy.activacion', c.get('activacion'), '"alta" (asombro/enojo/ansiedad) o "baja" (tristeza) — la baja comparte MENOS'),
                ('publicar.copy.valor_propio', c.get('valor_propio'), 'una frase que complete "te mando esto porque…"')]
    for k, v, ayuda in exigidos:
        if not v: faltan.append(f'falta {k}  → {ayuda}')
        else: print(f"   {k.split('.')[-1]:14s} {str(v)[:64]}")
    if c.get('activacion') == 'baja':
        avisos.append('activacion="baja": Berger & Milkman midieron que la baja activación comparte MENOS. ¿Seguro?')

    if escribir and H:
        if C: r.update({'cortes_por_min': C['cortes_por_min'], 'tomas': C['tomas']})
        r.update({'silabas_por_seg': H['silabas_por_seg_hablando'],
                  'silabas_por_seg_del_video': H['silabas_por_seg_del_video'],
                  'fuente_habla': H['fuente'],
                  'nota': 'MEDIDO por scripts/ritmo-pieza.py, no tecleado. Referencias externas en §EL RITMO.'})
        json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
        print(f"   ✓ medidas escritas en {p}")

    for a in avisos: print(f"   ⚠ {a}")
    if faltan:
        print("   ✗ NO SALE: falta declarar el tratamiento —")
        for f in faltan: print(f"       {f}")
        print("   (sin esto la pieza es un dato perdido: no se puede atribuir nada. Ver §EL RITMO)")
        return 1
    print("   ✔ tratamiento declarado")
    return 0


if __name__ == '__main__':
    sys.exit(main())
