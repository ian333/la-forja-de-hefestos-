#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""subir-instagram.py — Instagram API with Instagram Login (cuenta professional Business/Creator; NO exige Página
de Facebook). Doc 2026-08-26: permisos instagram_business_basic + instagram_business_content_publish (+
instagram_business_manage_insights, instagram_business_manage_comments). Reel: POST graph.instagram.com/v25.0/{IG_ID}/media
(media_type=REELS, video_url PÚBLICA, caption ≤2200 chars/30 hashtags, share_to_feed) → sondear status_code
(1/min, ≤5 min: FINISHED) → POST /{IG_ID}/media_publish (creation_id). Límite 100 posts/24 h. Video ≤300 MB,
≤25 Mbps, 3 s–15 min, MP4 H264 moov al frente (scripts/reels-1080.py).
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

def publicar(vid, forzar):
    p, d = manifiesto(vid); c = copy_de(d); gate_autorizado(d, 'ig', forzar); t = token()
    url = (d.get('publicar') or {}).get('reel_url')
    _local = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist-video', 'reels', f'{vid}.mp4')
    if os.path.exists(_local): gate_calidad(_local)   # LEY: se mide el archivo que IG va a bajar
    if not url: sys.exit('✗ falta publicar.reel_url: corre `python3 scripts/reels-1080.py <id> --subir` (IG baja el video de una URL pública)')
    caption = (c['titulo'] + '\n\n' + c.get('descripcion', '') + '\n\n' + ' '.join(c.get('hashtags', [])[:30]))[:2200]
    base = f'https://graph.instagram.com/{V}/{t["ig_id"]}'
    r = requests.post(f'{base}/media', data={'media_type': 'REELS', 'video_url': url, 'caption': caption, 'share_to_feed': 'true', 'access_token': t['access_token']}).json()
    if 'id' not in r: sys.exit(f'✗ contenedor: {r}')
    cid = r['id']; print(f'▶ contenedor {cid} — IG descarga {url}')
    for i in range(10):
        time.sleep(60); s = requests.get(f'https://graph.instagram.com/{V}/{cid}', params={'fields': 'status_code,status', 'access_token': t['access_token']}).json()
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
    {'login': login, 'refresh': refresh}.get(a[0], lambda: publicar(a[0], '--yo-autorizo' in a))()
