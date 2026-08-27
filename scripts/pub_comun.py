#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""pub_comun.py — lo compartido por subir-*.py y metricas-*.py (SUBIDA AUTOMATIZADA, orden 2026-08-26).
El manifiesto (videos/<id>.json) es la fuente: copy, archivo, y el GATE `publicar.autorizado`.
Secretos y tokens viven FUERA del repo: ~/.config/gaia-pub/ (nunca en git)."""
import json, os, re, sys, datetime as dt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.expanduser('~/.config/gaia-pub'); os.makedirs(CONF, exist_ok=True)

def manifiesto(vid):
    p = os.path.join(ROOT, 'videos', f'{vid}.json')
    if not os.path.exists(p): sys.exit(f'✗ no existe {p}')
    return p, json.load(open(p, encoding='utf-8'))

def guardar_manifiesto(p, d):
    json.dump(d, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

def copy_de(d):
    c = (d.get('publicar') or {}).get('copy') or {}
    if not c.get('titulo'): sys.exit('✗ el manifiesto no trae publicar.copy.titulo (el copy se escribe en el paso del GUION)')
    return c

def gate_autorizado(d, plataforma, forzar=False):
    """NADA se publica sin `publicar.autorizado` = "<fecha> <plataformas>" (lo escribe ian, o lo dice y se anota).
    --yo-autorizo solo sirve para pruebas en PRIVADO."""
    a = (d.get('publicar') or {}).get('autorizado', '')
    if forzar: return True
    if not a or plataforma not in a.lower():
        sys.exit(f'✗ SIN AUTORIZAR para {plataforma}: en videos/<id>.json pon publicar.autorizado = "{dt.date.today()} {plataforma}" (ian) — o usa --yo-autorizo SOLO para una prueba privada')
    return True

def archivo_master(d, cual='h264'):
    s = d.get('salida') or {}; dirr = s.get('dir', 'dist-video/masters')
    if not dirr.startswith('/'): dirr = os.path.join(ROOT, dirr)
    f = os.path.join(dirr, s.get(cual) or s.get('h264'))
    if not os.path.exists(f): sys.exit(f'✗ no existe el master {f}')
    return f

def segs_a_srt(d):
    """segs.json → SRT (los subtítulos de la serie como captions REALES)."""
    a = d.get('audio') or {}; dirr = a.get('dir', '')
    p = os.path.join(ROOT, dirr, a.get('segs', 'segs.json'))
    if not os.path.exists(p): return None
    segs = json.load(open(p, encoding='utf-8'))
    def t(x): h = int(x // 3600); m = int(x % 3600 // 60); s = x % 60; return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
    out = []
    for i, sg in enumerate(segs, 1):
        out.append(f'{i}\n{t(sg["start"])} --> {t(sg["end"])}\n{sg["text"].strip()}\n')
    srt = os.path.join(ROOT, dirr, 'captions.srt'); open(srt, 'w', encoding='utf-8').write('\n'.join(out)); return srt

def registrar(p, d, plataforma, info):
    """Escribe el resultado en el manifiesto (publicar.subidas.<plataforma>) = la evidencia."""
    d.setdefault('publicar', {}).setdefault('subidas', {})[plataforma] = {**info, 'fecha': dt.datetime.now().isoformat(timespec='minutes')}
    guardar_manifiesto(p, d)
    print(f'✓ registrado en el manifiesto: publicar.subidas.{plataforma} = {json.dumps(info, ensure_ascii=False)}')
