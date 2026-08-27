#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""reels-1080.py — derivado 4K (2160×3840) H.264 ~22 Mbps para Instagram/TikTok.
LEY ABSOLUTA (ian, 2026-08-26): NADA se sube que no sea 4K o bitrate estúpidamente alto — el
primer Reel salió a 3.5 Mbps y se bajó por verse mal. 22 Mbps × 77 s ≈ 212 MB ≤ 300 MB del tope IG. (doc IG: MP4, H264/HEVC, moov al frente
(faststart), ≤300 MB, ≤25 Mbps, 9:16, 3 s–15 min). El master 4K (587 MB) NO cabe. Salida: dist-video/reels/<id>.mp4
y, para IG por API, el archivo debe estar en URL PÚBLICA → se sube a ATLAS /biblioteca/reels/ (Cloudflare lo cachea).
  python3 scripts/reels-1080.py <id> [--subir]
"""
import os, sys, json, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = sys.argv[1]; d = json.load(open(os.path.join(ROOT, 'videos', f'{vid}.json'), encoding='utf-8'))
s = d['salida']; dirr = s.get('dir', 'dist-video/masters'); dirr = dirr if dirr.startswith('/') else os.path.join(ROOT, dirr)
src = os.path.join(dirr, s['h264']); out_d = os.path.join(ROOT, 'dist-video', 'reels'); os.makedirs(out_d, exist_ok=True)
out = os.path.join(out_d, f'{vid}.mp4')
# NVENC (GPU): a 4K la CPU tarda 30+ min y el resultado a tope de bitrate es igual. AL FILO de
# la API de IG (topes documentados: 25 Mbps / 300 MB): ~24 Mbps → 77 s ≈ 235 MB.
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-c:v', 'h264_nvenc', '-preset', 'p5', '-rc', 'vbr',
                '-b:v', '23M', '-maxrate', '25M', '-bufsize', '50M', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '60',
                '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], check=True)
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
