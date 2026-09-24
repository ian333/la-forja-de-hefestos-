#!/usr/bin/env python3
"""2-archivos.py — el archivo EXACTO que vio la gente, por cada curva.

Primero YouTube (yt-dlp, 854p basta para medir). Si YouTube responde 403 (pasa: limita por IP),
se empata el título contra el reel de Instagram (analisis-ig.json) y se baja su media_url del CDN.
Luego se VERIFICA que la duración del archivo cuadre con la del video de la curva (±1.5 s):
si no cuadra, el archivo no es ese video y se borra (así cayó «a dónde se va la sal» ↔ «te da sed»).

  python3 scripts/retencion/2-archivos.py dist-video/retencion
"""
import json, os, re, sys, subprocess, datetime as dt, requests
D = sys.argv[1] if len(sys.argv) > 1 else 'dist-video/retencion'
V = os.path.join(D, 'vids'); os.makedirs(V, exist_ok=True)
cur = json.load(open(os.path.join(D, 'yt-curvas.json')))
ig = json.load(open('public/comando/analisis-ig.json'))['videos']
tk = json.load(open(os.path.expanduser('~/.config/gaia-pub/instagram-token.json')))['access_token']
pal = lambda s: set(re.findall(r'\w{4,}', s.lower()))
def dur(s):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', s); h, mi, se = [int(x or 0) for x in m.groups()]; return h*3600+mi*60+se
def dura(p):
    o = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True).stdout
    return float(o or 0)
for y, v in cur.items():
    if not v.get('curva'): continue
    p = os.path.join(V, y + '.mp4')
    if not os.path.exists(p):
        subprocess.run(['yt-dlp', '-q', '--no-warnings', '-f', 'bv*[height<=854][ext=mp4]+ba[ext=m4a]/b[height<=854]',
                        '--merge-output-format', 'mp4', '-o', p, f'https://youtu.be/{y}'])
    if not os.path.exists(p):
        f = dt.date.fromisoformat(v['publicado'][:10])
        b = max(ig, key=lambda x: len(pal(v['titulo']) & pal(x['titulo'])) / max(1, len(pal(v['titulo'])))
                - 0.02 * abs((dt.date.fromisoformat(x['fecha']) - f).days))
        u = requests.get(f"https://graph.instagram.com/v25.0/{b['id']}", params={'fields': 'media_url', 'access_token': tk}).json().get('media_url')
        if u: open(p, 'wb').write(requests.get(u).content)
    if os.path.exists(p) and abs(dura(p) - dur(v['dur'])) > 1.5:
        print('NO CUADRA la duración, se borra:', y, v['titulo'][:50]); os.remove(p)
print(sum(f.endswith('.mp4') for f in os.listdir(V)), 'archivos')
