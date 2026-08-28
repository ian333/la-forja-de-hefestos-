#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""reels-1080.py — derivado para Instagram: 4K NATIVO 2160x3840 al filo del PESO (≤300 MB), medido.
LEY ABSOLUTA (ian, 2026-08-26): NADA se sube que no sea 4K o de bitrate estúpidamente alto. Y el 4K
SÍ cabe por API: la tabla oficial dice "máx 1920 columnas" pero la sonda real lo aceptó (ver abajo).
El único tope real es el peso: 128 y 257 MB pasan, 588 no. El bitrate se CALCULA para caber en 290 MB.
Salida: dist-video/reels/<id>.mp4 · `--subir` lo hospeda en PRIME/ATLAS con URL versionada+verificada
(Instagram lo DESCARGA de ahí: upload_type=resumable NO existe en Instagram Login, medido).
  python3 scripts/reels-1080.py <id> [--subir]
"""
import os, sys, json, subprocess
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
vid = sys.argv[1]; d = json.load(open(os.path.join(ROOT, 'videos', f'{vid}.json'), encoding='utf-8'))
s = d['salida']; dirr = s.get('dir', 'dist-video/masters'); dirr = dirr if dirr.startswith('/') else os.path.join(ROOT, dirr)
src = os.path.join(dirr, s['h264']); out_d = os.path.join(ROOT, 'dist-video', 'reels'); os.makedirs(out_d, exist_ok=True)
out = os.path.join(out_d, f'{vid}.mp4')
# ── RECETA PARA INSTAGRAM: 4K NATIVO (MEDIDA con sondas reales el 2026-08-27, no leída) ─────
# ian: "si ya se tiene tope, pero ¿en verdad lo has intentado?" — no lo había intentado.
# `subir-instagram.py probar <archivo>` crea el contenedor y espera el veredicto SIN publicar:
#   A  2160x3840 @ 60.8 Mbps · 128 MB → FINISHED   ← el "máx 1920 columnas" de la tabla NO se aplica
#   B  1080x1920 @ 101.7 Mbps · 128 MB → ERROR      ← el bitrate sí tiene techo (entre 61 y 102)
#   C  2160x3840 @ 60.9 Mbps · 588 MB → ERROR      ← el PESO sí manda (≤300 MB)
#   D  2160x3840 @ 26.6 Mbps · 257 MB → FINISHED   ← ESTA receta
# Así que se entrega el 4K entero: 4× los píxeles del 1080 y el peso como único tope real.
# CALIDAD con techo (-crf + -maxrate): la toma difícil (líneas de 1 px convergiendo) se pega
# al máximo y las calmas gastan poco. Meta lo re-encodea a 1080p @ ~10 Mbps de todos modos
# (medido con ig-calidad-entregada.cjs): lo que compramos es la mejor materia prima posible.
# Presupuesto de peso: maxrate × dur ≤ ~290 MB → para 77 s, 29 Mbps. Se calcula, no se adivina.
dur_s = float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',src],
                             capture_output=True, text=True).stdout.strip() or 77)
maxrate_m = max(12, min(45, int(290 * 8 / dur_s)))   # Mbps que caben en 290 MB (con 128k de audio de sobra)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', src,
                '-vf', 'format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv',
                '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium',
                '-crf', '17', '-maxrate', f'{maxrate_m}M', '-bufsize', f'{maxrate_m}M',
                '-g', '60', '-keyint_min', '60', '-sc_threshold', '0', '-bf', '3',
                '-x264-params', 'open_gop=0:aq-mode=3:colorprim=bt709:transfer=bt709:colormatrix=bt709',
                '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-color_range', 'tv',
                '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2',
                '-movflags', '+faststart', out], check=True)
print(f'   4K nativo · {dur_s:.0f} s · maxrate {maxrate_m} Mbps (presupuesto 290 MB)')
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
    # Cloudflare responde 403 al User-Agent de urllib (Bot Fight Mode) — pasó el 2026-08-28 con
    # LA SILLA y tumbó el estreno en IG. Con UA de navegador pasa; curl también pasa.
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            remoto = int(r.headers.get('content-length', -1)); cache = r.headers.get('cf-cache-status', '?')
    except urllib.error.HTTPError as e:
        sys.exit(f'✗ la URL pública responde {e.code} ({e.reason}) — no se publica. URL: {url}')
    local = os.path.getsize(out)
    if remoto != local:
        sys.exit(f'✗ la URL sirve {remoto} B pero el archivo local tiene {local} B (cf-cache-status: {cache}) — NO se publica')
    print(f'✓ URL verificada ({remoto} B, cf-cache-status: {cache}): {url}')
    d.setdefault('publicar', {})['reel_url'] = url
    json.dump(d, open(os.path.join(ROOT, 'videos', f'{vid}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
