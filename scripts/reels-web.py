#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
reels-web.py — DERIVADOS WEB de los reels, para el atrio de la portada.

Por qué existe (2026-08-10). La portada dice "Cinco pilares. Una clase de verdad." y el 96.5 %
del tráfico llega DENTRO del navegador de Instagram, en móvil, con una mediana de sesión de
0.9 s. Esa persona venía de ver una molécula naciendo y se topa con el pitch de una escuela:
la promesa y la entrega no se tocan, y por eso el c1 es 1.91 %.

Ian: "vienen de ver reels, démosles reels — pero serán el INTRO: ven tres, toman una de 2-3
opciones y llegan al producto. Es aprovechar la inercia que traen."

Los masters son 4K y pesan ~170 MB: imposible servirlos. Esto produce, por reel:
  · <id>.mp4   — 540×960, H.264, faststart (el índice AL FRENTE, para que empiece a
                 reproducir sin haber bajado todo), sin audio, ~10 s del GANCHO.
  · <id>.jpg   — el PRIMER CUADRO exacto del recorte. Va incrustado en el HTML en base64:
                 cero peticiones, pinta con el propio HTML. Y como es el mismo cuadro con el
                 que arranca el video, cuando el video entra no se ve ningún salto — la
                 imagen COBRA VIDA.

  python3 scripts/reels-web.py                 # todos los subidos a Instagram
  python3 scripts/reels-web.py mol-h2o-el-hexamero mol-grasa-butirico
  SEG=8 ALTO=960 python3 scripts/reels-web.py  # ajustar recorte/tamaño

Salida: public/atrio/<id>.mp4 + .jpg
"""
import os, sys, json, subprocess, shutil

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(RAIZ, 'public', 'atrio')
BIB = os.environ.get('BIB', '/mnt/hdd/biblioteca')          # en PRIME; en local, override
SEG = float(os.environ.get('SEG', '10'))                     # segundos del gancho
ALTO = int(os.environ.get('ALTO', '960'))                    # 960 = 540×960
CRF = os.environ.get('CRF', '32')

# El GANCHO no siempre está en el segundo 0: varias piezas abren con la molécula formada y
# el momento que para el pulgar viene después. `desde` se declara por pieza, medido a ojo.
DESDE = {
    'mol-grasa-butirico': 0.0,      # abre YA con la molécula hecha (el gancho es el cuadro 0)
    'mol-h2o-el-hexamero': 0.0,     # el campo ENCENDIÉNDOSE es el gancho (canon)
}


def ffmpeg(*a):
    return subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=False).returncode == 0


def uno(src, pid):
    os.makedirs(OUT, exist_ok=True)
    t0 = DESDE.get(pid, 0.0)
    mp4 = os.path.join(OUT, f'{pid}.mp4')
    jpg = os.path.join(OUT, f'{pid}.jpg')
    ok = ffmpeg('-ss', str(t0), '-t', str(SEG), '-i', src,
                '-vf', f'scale=-2:{ALTO}', '-c:v', 'libx264', '-preset', 'slow',
                '-crf', CRF, '-profile:v', 'main', '-pix_fmt', 'yuv420p', '-an',
                '-movflags', '+faststart', mp4)
    # el poster es el PRIMER cuadro del recorte, no del master: si no, el video "brinca" al entrar
    ok = ok and ffmpeg('-ss', str(t0), '-i', src, '-frames:v', '1',
                       '-vf', f'scale=-2:{ALTO}', '-q:v', '7', jpg)
    if not ok:
        print(f'   ✗ {pid}'); return None
    return dict(id=pid, mp4=os.path.getsize(mp4), jpg=os.path.getsize(jpg))


def main():
    pedidos = [a for a in sys.argv[1:] if not a.startswith('-')]
    if not pedidos:
        reg = json.load(open(os.path.join(RAIZ, 'public', 'comando', 'catalogo.json')))
        pedidos = [p['id'].replace(' ', '-') for p in reg['pieces'] if p.get('familia') == 'molecula']
    print(f'═══ DERIVADOS WEB · {len(pedidos)} reels · {ALTO}p · {SEG:.0f}s ═══\n')
    hechos = []
    for pid in pedidos:
        src = None
        for cand in (os.path.join(BIB, 'moleculas', f'{pid}.mp4'),
                     os.path.join(RAIZ, 'dist-video', f'{pid}.mp4')):
            if os.path.exists(cand):
                src = cand; break
        if not src:
            print(f'   — {pid}: sin master'); continue
        r = uno(src, pid)
        if r:
            hechos.append(r)
            print(f'   ✓ {pid:34s} {r["mp4"]/1024:6.0f} KB video · {r["jpg"]/1024:5.0f} KB poster')
    if hechos:
        tot = sum(h['mp4'] for h in hechos) / 1024 / 1024
        print(f'\n   {len(hechos)} reels · {tot:.1f} MB en total (los masters pesan ~170 MB c/u)')
        json.dump({'reels': [h['id'] for h in hechos]},
                  open(os.path.join(OUT, 'index.json'), 'w'), ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
