#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""reels-1080.py — derivado 1080×1920 H.264 para Instagram/TikTok (doc IG: MP4, H264/HEVC, moov al frente
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
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-vf', 'scale=1080:1920:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow',
                '-crf', '20', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '60', '-maxrate', '12M', '-bufsize', '24M',
                '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out], check=True)
mb = os.path.getsize(out) / 1e6; print(f'✓ {out} · {mb:.0f} MB (IG exige ≤300)')
if '--subir' in sys.argv:
    rel = f'moleculas/reels/{vid}.mp4'
    for host, base in (('ian@100.110.244.20', '/mnt/hdd/biblioteca'), ('ian@100.97.118.117', '/mnt/hdd/forja-dist/biblioteca')):
        subprocess.run(['ssh', '-o', 'BatchMode=yes', host, f'mkdir -p {base}/moleculas/reels'], check=False)
        subprocess.run(['rsync', '-a', '--partial', out, f'{host}:{base}/{rel}'], check=True)
    url = f'https://university.gaiaprime.com.mx/biblioteca/{rel}'
    d.setdefault('publicar', {})['reel_url'] = url; json.dump(d, open(os.path.join(ROOT, 'videos', f'{vid}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    print(f'✓ URL pública (para IG por API): {url}')
