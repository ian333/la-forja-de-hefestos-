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
# 1) HEVC, no H.264. Mismo tramo, bits comparables, contra el master: x265 25.4 Mbps → SSIM
#    0.816 / PSNR 27.46 dB, contra NVENC-H264 28.0 Mbps → 0.751 / 26.00 dB. HEVC gana con
#    MENOS bitrate. La tabla oficial de Meta admite "HEVC o H264". Nunca lo estábamos usando.
# 2) ANCHO 1920, no 2160. La spec de Reels topa en 1920 COLUMNAS horizontales, así que el
#    vertical 4K (2160 de ancho) NO cabe por API — no es que degrademos, es el techo. 1920 de
#    ancho es el máximo legal y da 3.2x los píxeles de un 1080x1920.
# 3) Resolución alta gana aunque el espectador vea menos: al reducir, el promediado de píxeles
#    BORRA los artefactos de compresión. Medido: 4K@22.7 bajado a 1080 (SSIM 0.857) le gana a
#    un 1080@22 nativo (0.797). Por eso se entrega en el máximo que la plataforma acepta.
# 4) Audio 128 kbps: es el tope de la tabla; a 192 kbps arriesgábamos rechazo.
# 24 Mbps x 77 s ~ 231 MB, bajo los topes de 300 MB / 25 Mbps.
CPU = os.environ.get('CPU') == '1'   # CPU=1 → x265 (lo mejor, ~20 min); por omisión GPU
vcodec = (['-c:v', 'libx265', '-preset', 'slow', '-x265-params', 'aq-mode=3:rc-lookahead=40']
          if CPU else
          ['-c:v', 'hevc_nvenc', '-preset', 'p7', '-tune', 'hq', '-spatial-aq', '1',
           '-aq-strength', '8', '-temporal-aq', '1', '-rc-lookahead', '32', '-bf', '3'])
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src,
                '-vf', 'scale=1920:-2:flags=lanczos', '-r', '30',
                *vcodec, '-rc', 'vbr', '-b:v', '24M', '-maxrate', '25M', '-bufsize', '50M',
                '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-g', '60',
                '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], check=True)
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
