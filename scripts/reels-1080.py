#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""reels-1080.py — derivado para Instagram: HEVC 1920x3414 @ 24 Mbps (el TECHO de la API, medido).
LEY ABSOLUTA (ian, 2026-08-26): NADA se sube que no sea 4K o de bitrate estúpidamente alto — el primer
Reel salió a 3.5 Mbps y se bajó por verse mal. Para Instagram el 4K es IMPOSIBLE por API: la tabla
oficial de Reels topa en 1920 COLUMNAS horizontales y nuestro vertical 4K tiene 2160 de ancho. Así que
aquí la ley aplica por su otra mitad: el máximo que la plataforma documenta, ni un peldaño menos
(≤300 MB, ≤25 Mbps VBR, 23-60 fps, 3 s-15 min, H264/HEVC 4:2:0 closed GOP, moov al frente, audio AAC
≤128 kbps). El master 4K de 60.9 Mbps se queda para YouTube, que sí sirve 4K real.
Salida: dist-video/reels/<id>.mp4 — con `subir-instagram.py` los BYTES van por rupload (resumable), sin
URL pública de por medio. `--subir` sigue hospedando en PRIME/ATLAS (con URL versionada + verificación)
por si se usa `--via-url`.
  python3 scripts/reels-1080.py <id> [--subir]      # CPU=1 → x265 en vez de NVENC (mejor, ~20 min)
"""
import os, sys, json, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = sys.argv[1]; d = json.load(open(os.path.join(ROOT, 'videos', f'{vid}.json'), encoding='utf-8'))
s = d['salida']; dirr = s.get('dir', 'dist-video/masters'); dirr = dirr if dirr.startswith('/') else os.path.join(ROOT, dirr)
src = os.path.join(dirr, s['h264']); out_d = os.path.join(ROOT, 'dist-video', 'reels'); os.makedirs(out_d, exist_ok=True)
out = os.path.join(out_d, f'{vid}.mp4')
# ── RECETA PARA INSTAGRAM (medida el 2026-08-27, no supuesta) ────────────────────────────
# 1) 1080x1920, NO 4K. Dos razones independientes:
#    a) La tabla oficial de Reels topa en 1920 COLUMNAS horizontales; el vertical 4K tiene 2160
#       de ancho y Instagram lo RECHAZA (error 352, "format that we don't support").
#    b) Simulando el re-encode de IG y midiendo la cadena COMPLETA, subir 1080 gana sobre subir
#       4K: VMAF 41.2 vs 39.4 y CAMBI (banding) 6.77 vs 7.05 a 6 Mbps. Meta entrega 1080p30 como
#       techo (su propia doc de ingeniería), así que dándole 1080 exacto no resamplea.
# 2) H.264 HIGH profile, no Main: el master sale en Main porque video.sh no pasa -profile:v, y
#    se pierde el transform 8x8 (+1.5 VMAF gratis, medido).
# 3) BT.709 explícito con setparams. Sin setparams, color_trc y color_primaries salen `unknown`
#    aunque pases las banderas (comprobado). El master hoy sale etiquetado bt470bg = BT.601 de PAL.
# 4) closed GOP: la spec lo exige y NVENC no lo hace por omisión → open_gop=0 + sc_threshold=0.
# 5) aq-mode=3 = cuantización adaptativa con sesgo a escenas OSCURAS, documentada contra banding.
# 6) Audio 128 kbps: es el tope de la tabla; a 192 arriesgábamos rechazo.
# 20 Mbps x 77 s ~ 200 MB, con margen bajo los topes de 300 MB / 25 Mbps.
# NOTA: esto re-encodea el H.264 del master (una generación de pérdida). Lo ideal es encodear
# desde los PNG en video.sh; pendiente de decidir con ian.
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src,
                '-vf', ('scale=1080:1920:flags=lanczos,format=yuv420p,'
                        'setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv'),
                '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'slow',
                '-b:v', '20M', '-maxrate', '22M', '-bufsize', '24M',
                '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-bf', '3',
                '-x264-params', 'open_gop=0:aq-mode=3:colorprim=bt709:transfer=bt709:colormatrix=bt709',
                '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
                '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
                '-movflags', '+faststart', out], check=True)
mb = os.path.getsize(out) / 1e6; print(f'✓ {out} · {mb:.0f} MB (tope IG 300)')
assert mb <= 295, f'✗ {mb:.0f} MB > 295: recorta maxrate, el tope de la API es 300 MB'
if '--subir' in sys.argv:
    # La URL lleva VERSIÓN (hash del archivo): Cloudflare cachea los .mp4 1 día, así que sin
    # esto un re-render sirve el archivo VIEJO durante 24 h — le pasó a LA SAL (35 MB viejos
    # contra 221 MB nuevos) y estuvo a punto de publicarse el malo a Instagram.
    import hashlib, urllib.request
    h = hashlib.sha256(open(out, 'rb').read()).hexdigest()[:10]
    rel = f'moleculas/reels/{vid}.mp4'
    for host, base in (('ian@100.110.244.20', '/mnt/hdd/biblioteca'), ('ian@100.97.118.117', '/mnt/hdd/forja-dist/biblioteca')):
        subprocess.run(['ssh', '-o', 'BatchMode=yes', host, f'mkdir -p {base}/moleculas/reels'], check=False)
        subprocess.run(['rsync', '-a', '--partial', out, f'{host}:{base}/{rel}'], check=True)
    url = f'https://university.gaiaprime.com.mx/biblioteca/{rel}?v={h}'
    # VERIFICAR que la URL pública sirve ESTE archivo, no uno cacheado: si no coincide el tamaño,
    # Instagram bajaría el equivocado. Falla ruidoso antes de publicar.
    req = urllib.request.Request(url, method='HEAD')
    with urllib.request.urlopen(req, timeout=60) as r:
        remoto = int(r.headers.get('content-length', -1)); cache = r.headers.get('cf-cache-status', '?')
    local = os.path.getsize(out)
    if remoto != local:
        sys.exit(f'✗ la URL sirve {remoto} B pero el archivo local tiene {local} B (cf-cache-status: {cache}) — NO se publica')
    print(f'✓ URL verificada ({remoto} B, cf-cache-status: {cache}): {url}')
    d.setdefault('publicar', {})['reel_url'] = url
    json.dump(d, open(os.path.join(ROOT, 'videos', f'{vid}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
