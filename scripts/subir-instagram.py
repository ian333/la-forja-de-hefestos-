#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""subir-instagram.py — Instagram API with Instagram Login (cuenta professional Business/Creator; NO exige Página
de Facebook). Doc 2026-08-26: permisos instagram_business_basic + instagram_business_content_publish (+
instagram_business_manage_insights, instagram_business_manage_comments). Reel: POST graph.instagram.com/v25.0/{IG_ID}/media
(media_type=REELS + upload_type=resumable, caption ≤2200 chars/30 hashtags, share_to_feed) → los BYTES por POST a
rupload.facebook.com/ig-api-upload/<V>/<container> con headers Authorization: OAuth / offset / file_size (reanudable
desde video_status.uploading_phase.bytes_transferred) → sondear status_code (1/min, ≤5 min: FINISHED) →
POST /{IG_ID}/media_publish (creation_id). Límite 100 posts/24 h.
SPEC OFICIAL DEL REEL (medida en specs_reel() antes de subir): **máx 1920 COLUMNAS horizontales** ← el tope que
hace IMPOSIBLE el vertical 4K por API (2160 de ancho), ≤300 MB, ≤25 Mbps VBR, 23–60 fps, 3 s–15 min, H264/HEVC
4:2:0 closed GOP, moov al frente, audio AAC ≤128 kbps. `--via-url` conserva el camino viejo (IG descarga una URL
nuestra), que es el que publicó un Reel malo el 2026-08-27 porque el CDN servía una versión cacheada.
Token: Business Login → code → api.instagram.com/oauth/access_token (1 h) → graph.instagram.com/access_token
?grant_type=ig_exchange_token (60 días) → refresh_access_token?grant_type=ig_refresh_token (otros 60).

  /home/ian/pub-venv/bin/python scripts/subir-instagram.py login            # una vez: imprime la URL de autorización, pega el `code`
  /home/ian/pub-venv/bin/python scripts/subir-instagram.py <id> [--yo-autorizo]
  /home/ian/pub-venv/bin/python scripts/subir-instagram.py refresh          # cada <60 días (cron)
  requiere ~/.config/gaia-pub/instagram-app.json = {"app_id","app_secret","redirect_uri"}
"""
import os, sys, json, time, urllib.parse, requests
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pub_comun import manifiesto, copy_de, gate_autorizado, gate_calidad, registrar, CONF
V = 'v25.0'; APP = os.path.join(CONF, 'instagram-app.json'); TOK = os.path.join(CONF, 'instagram-token.json')
SCOPES = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights,instagram_business_manage_comments'

def app(): return json.load(open(APP))
def token():
    if not os.path.exists(TOK): sys.exit('✗ sin token: corre `subir-instagram.py login`')
    return json.load(open(TOK))

def login():
    a = app()
    url = 'https://www.instagram.com/oauth/authorize?' + urllib.parse.urlencode({'client_id': a['app_id'], 'redirect_uri': a['redirect_uri'], 'scope': SCOPES, 'response_type': 'code'})
    print('\n▶ ABRE ESTA URL EN TU NAVEGADOR con la cuenta de Instagram de GAIA, acepta, y pega aquí el `code` de la URL de regreso:\n' + url + '\n')
    code = input('code: ').strip().split('#')[0]
    r = requests.post('https://api.instagram.com/oauth/access_token', data={'client_id': a['app_id'], 'client_secret': a['app_secret'], 'grant_type': 'authorization_code', 'redirect_uri': a['redirect_uri'], 'code': code}).json()
    if 'access_token' not in r: sys.exit(f'✗ {r}')
    l = requests.get(f'https://graph.instagram.com/access_token', params={'grant_type': 'ig_exchange_token', 'client_secret': a['app_secret'], 'access_token': r['access_token']}).json()
    if 'access_token' not in l: sys.exit(f'✗ largo: {l}')
    me = requests.get(f'https://graph.instagram.com/{V}/me', params={'fields': 'user_id,username', 'access_token': l['access_token']}).json()
    json.dump({'access_token': l['access_token'], 'expires_in': l.get('expires_in'), 'ig_id': me.get('user_id') or r.get('user_id'), 'username': me.get('username'), 'obtenido': time.strftime('%F %H:%M')}, open(TOK, 'w'), indent=1)
    print(f'✓ token de 60 días para @{me.get("username")} (ig_id {me.get("user_id")}) → {TOK}')

def refresh():
    t = token(); r = requests.get('https://graph.instagram.com/refresh_access_token', params={'grant_type': 'ig_refresh_token', 'access_token': t['access_token']}).json()
    if 'access_token' not in r: sys.exit(f'✗ {r}')
    t.update({'access_token': r['access_token'], 'expires_in': r.get('expires_in'), 'obtenido': time.strftime('%F %H:%M')}); json.dump(t, open(TOK, 'w'), indent=1); print('✓ token renovado 60 días')

# ── Reel Specifications (tabla oficial, developers.facebook.com/docs/instagram-platform/
#    instagram-graph-api/reference/ig-user/media/#reels-specs — leída 2026-08-27) ──────────
#    El tope que nos truena NO es el peso: es el ANCHO. Máximo 1920 COLUMNAS horizontales,
#    así que un vertical 4K (2160 de ancho) lo excede por diseño → error 2207026.
SPEC = dict(ancho_max=1920, mb_max=300, vbr_max=25_000_000, fps=(23, 60),
            dur=(3, 900), audio_kbps_max=128, codecs=('h264', 'hevc'))

def specs_reel(archivo):
    """Mide con ffprobe y FALLA ruidoso contra la tabla oficial. Barato: evita quemar una
    subida (y un borrado a mano, que la API de IG no soporta: error 100/33)."""
    import subprocess
    r = subprocess.run(['ffprobe','-v','error','-show_streams','-show_format','-of','json',archivo],
                       capture_output=True, text=True)
    j = json.loads(r.stdout or '{}')
    v = next((x for x in j.get('streams', []) if x.get('codec_type') == 'video'), {})
    a = next((x for x in j.get('streams', []) if x.get('codec_type') == 'audio'), {})
    fm = j.get('format', {})
    num, den = (v.get('r_frame_rate') or '0/1').split('/')
    fps = float(num) / float(den or 1)
    mb = os.path.getsize(archivo) / 1e6
    dur = float(fm.get('duration') or 0)
    vbr = int(v.get('bit_rate') or fm.get('bit_rate') or 0)
    abr = int(a.get('bit_rate') or 0)
    with open(archivo, 'rb') as f: cabeza = f.read(4096)
    faststart = b'moov' in cabeza and cabeza.find(b'moov') < (cabeza.find(b'mdat') if b'mdat' in cabeza else 1 << 30)
    fallas = []
    if v.get('codec_name') not in SPEC['codecs']: fallas.append(f"códec {v.get('codec_name')} (se admite {'/'.join(SPEC['codecs'])})")
    if v.get('pix_fmt') != 'yuv420p':            fallas.append(f"pix_fmt {v.get('pix_fmt')} (la tabla pide croma 4:2:0)")
    if int(v.get('width') or 0) > SPEC['ancho_max']: fallas.append(f"ancho {v.get('width')} > {SPEC['ancho_max']} columnas ← ESTE es el tope que mata el 4K vertical")
    if not (SPEC['fps'][0] <= fps <= SPEC['fps'][1]): fallas.append(f'{fps:.2f} fps fuera de {SPEC["fps"]}')
    if not (SPEC['dur'][0] <= dur <= SPEC['dur'][1]): fallas.append(f'{dur:.1f} s fuera de {SPEC["dur"]}')
    if mb > SPEC['mb_max']:                      fallas.append(f'{mb:.0f} MB > {SPEC["mb_max"]}')
    if vbr > SPEC['vbr_max']:                    fallas.append(f'{vbr/1e6:.1f} Mbps > {SPEC["vbr_max"]/1e6:.0f}')
    if abr > SPEC['audio_kbps_max'] * 1000 * 1.05: fallas.append(f'audio {abr/1000:.0f} kbps > {SPEC["audio_kbps_max"]}')
    if not faststart:                            fallas.append('moov NO está al frente (falta -movflags +faststart)')
    print(f'   spec: {v.get("width")}x{v.get("height")} {v.get("codec_name")} {fps:.0f}fps '
          f'{vbr/1e6:.1f}Mbps · {mb:.0f}MB · {dur:.1f}s · audio {abr/1000:.0f}kbps · faststart={faststart}')
    if fallas: sys.exit('✗ SPEC DE REEL (tabla oficial de Meta):\n   - ' + '\n   - '.join(fallas))

def subir_bytes(uri, tok, archivo):
    """rupload: manda los BYTES directo (no una URL que IG deba descargar). Elimina de raíz el
    caché del CDN, el túnel lento y el hosting. Si se corta, reanuda desde bytes_transferred."""
    size = os.path.getsize(archivo)
    off = 0
    for intento in range(4):
        with open(archivo, 'rb') as f:
            f.seek(off); cuerpo = f.read()
        print(f'   ▶ rupload {off/1e6:.0f}→{size/1e6:.0f} MB (intento {intento+1})')
        try:
            r = requests.post(uri, headers={'Authorization': f'OAuth {tok}', 'offset': str(off),
                                            'file_size': str(size)}, data=cuerpo, timeout=1800)
            j = r.json() if r.content else {}
            if r.status_code == 200 and j.get('success') is not False: return j
            print(f'   ⚠ rupload {r.status_code}: {str(j)[:200]}')
        except requests.RequestException as e:
            print(f'   ⚠ corte de red: {e}')
        off = bytes_recibidos(uri, tok) or off
    sys.exit('✗ rupload no completó tras 4 intentos')

def bytes_recibidos(uri, tok):
    cid = uri.rstrip('/').split('/')[-1]
    s = requests.get(f'https://graph.instagram.com/{V}/{cid}',
                     params={'fields': 'status_code,video_status', 'access_token': tok}).json()
    return (((s.get('video_status') or {}).get('uploading_phase') or {}).get('bytes_transferred'))

def publicar(vid, forzar, via_url=False):
    p, d = manifiesto(vid); c = copy_de(d); gate_autorizado(d, 'ig', forzar); t = token()
    local = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist-video', 'reels', f'{vid}.mp4')
    if not os.path.exists(local): sys.exit(f'✗ no existe {local}: corre `python3 scripts/reels-1080.py {vid}`')
    gate_calidad(local, 'ig')   # LEY: el techo de la plataforma, medido
    specs_reel(local)           # tabla oficial de Meta, medida antes de gastar la subida
    caption = (c['titulo'] + '\n\n' + c.get('descripcion', '') + '\n\n' + ' '.join(c.get('hashtags', [])[:30]))[:2200]
    base = f'https://graph.instagram.com/{V}/{t["ig_id"]}'
    campos = {'media_type': 'REELS', 'caption': caption, 'share_to_feed': 'true', 'access_token': t['access_token']}
    if via_url:
        # Camino viejo: IG DESCARGA una URL nuestra. Frágil (el CDN puede servir una versión
        # cacheada distinta a la del disco — así se publicó el Reel malo de LA SAL el 2026-08-27).
        url = (d.get('publicar') or {}).get('reel_url')
        if not url: sys.exit('✗ falta publicar.reel_url')
        campos['video_url'] = url
    else:
        campos['upload_type'] = 'resumable'
    r = requests.post(f'{base}/media', data=campos).json()
    if 'id' not in r: sys.exit(f'✗ contenedor: {r}')
    cid = r['id']
    if via_url:
        print(f'▶ contenedor {cid} — IG descarga {campos["video_url"]}')
    else:
        uri = r.get('uri') or f'https://rupload.facebook.com/ig-api-upload/{V}/{cid}'
        print(f'▶ contenedor {cid} — subiendo los BYTES ({os.path.getsize(local)/1e6:.0f} MB) a rupload')
        subir_bytes(uri, t['access_token'], local)
    for i in range(10):
        time.sleep(60); s = requests.get(f'https://graph.instagram.com/{V}/{cid}', params={'fields': 'status_code,status,video_status', 'access_token': t['access_token']}).json()
        print(f'   {i+1} min: {s.get("status_code")} {s.get("status","")}')
        if s.get('status_code') == 'FINISHED': break
        if s.get('status_code') in ('ERROR', 'EXPIRED'): sys.exit(f'✗ {s}')
    pub = requests.post(f'{base}/media_publish', data={'creation_id': cid, 'access_token': t['access_token']}).json()
    if 'id' not in pub: sys.exit(f'✗ publish: {pub}')
    m = requests.get(f'https://graph.instagram.com/{V}/{pub["id"]}', params={'fields': 'permalink', 'access_token': t['access_token']}).json()
    registrar(p, d, 'ig', {'id': pub['id'], 'url': m.get('permalink', '')}); print(f'✓ Reel publicado: {m.get("permalink")}')

if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    {'login': login, 'refresh': refresh}.get(a[0], lambda: publicar(a[0], '--yo-autorizo' in a, '--via-url' in a))()
