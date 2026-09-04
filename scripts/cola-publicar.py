#!/usr/bin/env python3
"""LA COLA — programar una pieza y que PRIME la publique en Instagram a la hora.

Por qué existe (orden 2026-09-04-el-cine-programado): YouTube se programa solo (`publishAt`,
ya en subir-youtube.py) pero Instagram NO tiene programación en la API: alguien tiene que estar
despierto al minuto. Ese alguien es PRIME (fuera de casa; iangpu se apaga, ATLAS se va con la
luz). Instagram DESCARGA el reel de una URL nuestra (reels-1080.py --subir ya lo hospeda en
PRIME+ATLAS y verifica el HEAD), así que a la hora solo hacen falta la URL y el token: cero
ffprobe, cero venv, biblioteca estándar. Los porteros pesados corren al ARMAR, en iangpu.

Un solo archivo, dos máquinas:

  laptop / iangpu
    armar <id>      valida (autorizado + programar + reel_url + YouTube ya programado), empuja
                    la entrada a PRIME:$COLA/cola.json, copia el token de IG FRESCO y este
                    mismo script (se despliega solo).
    cosechar [<id>] jala PRIME:$COLA/hecho/*.json y registra publicar.subidas.ig en el
                    manifiesto (pub_comun.registrar, que relee antes de escribir).
    estado          imprime la cola y lo hecho en PRIME.
    quitar <id>     saca la entrada de la cola (no toca lo publicado).

  PRIME (cron: */5 * * * * flock -n /tmp/forja-cola.lock python3 $COLA/cola-publicar.py tick)
    tick [--dry]    para cada entrada con programar <= ahora (y no más de VENTANA_H tarde) y sin
                    hecho/<id>.json: contenedor por URL → FINISHED → media_publish → permalink →
                    hecho/<id>.json. Errores transitorios reintentan (3); pasado el plazo se
                    marca `vencida` y lo decide un humano. Log: $COLA/cola.log.

Formato de `publicar.programar` en el manifiesto: ISO 8601 CON huso, p.ej.
`2026-09-06T18:45:00-06:00` (18:45 CDMX = 21:45 AR/CL). La hora canon sale de
public/comando/horarios.json.
"""
import os, sys, json, time, datetime as dt, subprocess, urllib.request, urllib.parse

PRIME = os.environ.get('PRIME_HOST', 'ian@100.110.244.20')
COLA = os.environ.get('COLA_DIR', '/home/ian/forja-cola')        # en PRIME (su HOME: /mnt/hdd no es escribible por ian)
V = 'v25.0'                                                     # misma versión que subir-instagram.py
VENTANA_H = 6                                                   # tarde hasta 6 h; después, vencida
REINTENTOS = 3
UA = 'Mozilla/5.0 (X11; Linux x86_64) Chrome/128'               # Cloudflare Bot Fight da 403 al UA de urllib
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def log(msg):
    print(f'{dt.datetime.now().isoformat(timespec="seconds")}  {msg}', flush=True)


def ahora():
    return dt.datetime.now(dt.timezone.utc)


def cuando(iso):
    t = dt.datetime.fromisoformat(iso)
    if t.tzinfo is None:
        sys.exit(f'✗ publicar.programar sin huso: {iso!r} (usa 2026-09-06T18:45:00-06:00)')
    return t


# ─────────────────────────────── PRIME: tick ───────────────────────────────

def api(metodo, url, params=None, data=None):
    if params: url += ('&' if '?' in url else '?') + urllib.parse.urlencode(params)
    cuerpo = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=cuerpo, method=metodo, headers={'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return json.loads(e.read().decode())
        except Exception: return {'error': {'message': f'HTTP {e.code}'}}


def publicar_reel(tok, entrada):
    """El camino ganador de subir-instagram.py:118-154, copiado literal, sin requests."""
    base = f'https://graph.instagram.com/{V}/{tok["ig_id"]}'
    campos = {'media_type': 'REELS', 'caption': entrada['caption'], 'share_to_feed': 'true',
              'video_url': entrada['video_url'], 'access_token': tok['access_token']}
    r = api('POST', f'{base}/media', data=campos)
    if 'id' not in r: raise RuntimeError(f'contenedor: {r}')
    cid = r['id']; log(f'   ▶ contenedor {cid} — IG descarga {entrada["video_url"]}')
    for i in range(10):
        time.sleep(60)
        s = api('GET', f'https://graph.instagram.com/{V}/{cid}',
                {'fields': 'status_code,status', 'access_token': tok['access_token']})
        log(f'   {i+1} min: {s.get("status_code")} {s.get("status", "")}')
        if s.get('status_code') == 'FINISHED': break
        if s.get('status_code') in ('ERROR', 'EXPIRED'): raise RuntimeError(f'contenedor {s}')
    else:
        raise RuntimeError('10 min sin FINISHED')
    pub = api('POST', f'{base}/media_publish', data={'creation_id': cid, 'access_token': tok['access_token']})
    if 'id' not in pub: raise RuntimeError(f'publish: {pub}')
    m = api('GET', f'https://graph.instagram.com/{V}/{pub["id"]}', {'fields': 'permalink', 'access_token': tok['access_token']})
    return {'id': pub['id'], 'url': m.get('permalink', '')}


def tick(dry=False):
    os.makedirs(os.path.join(COLA, 'hecho'), exist_ok=True)
    pc = os.path.join(COLA, 'cola.json')
    cola = json.load(open(pc)) if os.path.exists(pc) else []
    if not cola: return
    tok_p = os.path.join(COLA, 'instagram-token.json')
    cambio = False
    for e in cola:
        ph = os.path.join(COLA, 'hecho', f'{e["id"]}.json')
        if os.path.exists(ph) or e.get('estado') == 'vencida': continue
        t = cuando(e['programar']); n = ahora()
        if n < t: continue
        tarde = (n - t).total_seconds() / 3600
        if tarde > VENTANA_H:
            e['estado'] = 'vencida'; cambio = True
            json.dump({'id': e['id'], 'estado': 'vencida', 'detalle': f'{tarde:.1f} h tarde: lo decide un humano (quitar + re-programar)',
                       'programar': e['programar']}, open(ph, 'w'), indent=1)
            log(f'✗ {e["id"]} VENCIDA ({tarde:.1f} h tarde)'); continue
        if dry:
            log(f'(dry) publicaría {e["id"]} programado a las {e["programar"]} ({tarde*60:.0f} min después) → {e["video_url"]}'); continue
        if not os.path.exists(tok_p):
            log(f'✗ falta {tok_p}: armar la vuelve a copiar'); return
        tok = json.load(open(tok_p))
        log(f'▶ {e["id"]} — programado {e["programar"]}, {tarde*60:.0f} min después')
        try:
            r = publicar_reel(tok, e)
            json.dump({'id': e['id'], 'estado': 'ok', 'ig': r, 'programar': e['programar'],
                       'publicado_en': ahora().isoformat(timespec='seconds')}, open(ph, 'w'), indent=1)
            log(f'✓ {e["id"]} publicado: {r["url"]}')
        except Exception as ex:
            e['intentos'] = e.get('intentos', 0) + 1; cambio = True
            log(f'⚠ {e["id"]} intento {e["intentos"]}: {ex}')
            if e['intentos'] >= REINTENTOS:
                json.dump({'id': e['id'], 'estado': 'error', 'detalle': str(ex)[:500], 'programar': e['programar']}, open(ph, 'w'), indent=1)
                log(f'✗ {e["id"]} agotó {REINTENTOS} intentos — lo decide un humano')
    if cambio: json.dump(cola, open(pc, 'w'), indent=1, ensure_ascii=False)


# ───────────────────────── laptop / iangpu: armar, cosechar, estado ─────────────────────────

def ssh(cmd, entrada=None):
    return subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=20', PRIME, cmd],
                          input=entrada, capture_output=True, text=True)


def cola_remota():
    r = ssh(f'cat {COLA}/cola.json 2>/dev/null')
    try: return json.loads(r.stdout or '[]')
    except Exception: return []


def escribir_cola(cola):
    r = ssh(f'mkdir -p {COLA}/hecho && cat > {COLA}/cola.json', json.dumps(cola, indent=1, ensure_ascii=False))
    if r.returncode: sys.exit(f'✗ no pude escribir la cola en PRIME: {r.stderr.strip()}')


def head(url):
    req = urllib.request.Request(url, method='HEAD', headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.status, int(r.headers.get('content-length', -1)), r.headers.get('cf-cache-status', '?')


def armar(vid):
    sys.path.insert(0, os.path.join(ROOT, 'scripts'))
    from pub_comun import manifiesto, copy_de, CONF
    p, d = manifiesto(vid); pub = d.get('publicar') or {}; c = copy_de(d)
    aut = pub.get('autorizado', '')
    if not aut or 'ig' not in aut.lower(): sys.exit(f'✗ SIN AUTORIZAR para ig: publicar.autorizado={aut!r}')
    if not pub.get('programar'): sys.exit('✗ falta publicar.programar (ISO con huso)')
    t = cuando(pub['programar'])
    if t <= ahora(): sys.exit(f'✗ publicar.programar ya pasó: {pub["programar"]}')
    url = pub.get('reel_url')
    if not url: sys.exit('✗ falta publicar.reel_url: corre `python3 scripts/reels-1080.py <id> --subir` primero')
    local = os.path.join(ROOT, 'dist-video', 'reels', f'{vid}.mp4')
    st, remoto, cache = head(url)
    if st != 200: sys.exit(f'✗ la URL del reel responde {st}')
    if os.path.exists(local) and remoto != os.path.getsize(local):
        sys.exit(f'✗ la URL sirve {remoto} B y el reel local pesa {os.path.getsize(local)} B (cf-cache-status {cache}) — NO se arma')
    yt = (pub.get('subidas') or {}).get('yt') or {}
    if not yt.get('publishAt'): print('   ⚠ YouTube 9:16 aún no está programado (publicar.subidas.yt.publishAt vacío)')
    elif yt['publishAt'][:16] != pub['programar'][:16]: print(f'   ⚠ YouTube programado a {yt["publishAt"]} y el manifiesto dice {pub["programar"]}')
    caption = (c['titulo'] + '\n\n' + c.get('descripcion', '') + '\n\n' + ' '.join(c.get('hashtags', [])[:30]))[:2200]
    entrada = {'id': vid, 'programar': pub['programar'], 'video_url': url, 'caption': caption,
               'armado': ahora().isoformat(timespec='seconds'), 'autorizado': aut[:120]}
    # token fresco + el script mismo → PRIME (se despliega solo; el cron solo necesita existir)
    tok = os.path.join(CONF, 'instagram-token.json')
    if not os.path.exists(tok): sys.exit(f'✗ falta {tok} (armar corre en iangpu, donde vive el token)')
    for src, dst in ((tok, f'{COLA}/instagram-token.json'), (os.path.abspath(__file__), f'{COLA}/cola-publicar.py')):
        r = ssh(f'mkdir -p {COLA}/hecho && cat > {dst} && chmod 600 {dst}', open(src).read())
        if r.returncode: sys.exit(f'✗ no pude copiar {os.path.basename(src)} a PRIME: {r.stderr.strip()}')
    cola = [e for e in cola_remota() if e['id'] != vid] + [entrada]
    escribir_cola(cola)
    ssh(f'rm -f {COLA}/hecho/{vid}.json')   # re-armar = borrón y cuenta nueva para ESTA pieza
    print(f'✓ armada en PRIME: {vid} → Instagram a las {pub["programar"]} ({remoto/1e6:.0f} MB, cf {cache})')
    print(f'   cron en PRIME: */5 * * * * flock -n /tmp/forja-cola.lock python3 {COLA}/cola-publicar.py tick >> {COLA}/cola.log 2>&1')


def cosechar(vid=None):
    sys.path.insert(0, os.path.join(ROOT, 'scripts'))
    from pub_comun import manifiesto, registrar
    r = ssh(f'for f in {COLA}/hecho/*.json; do [ -f "$f" ] && cat "$f" && echo; done 2>/dev/null')
    hechos = []
    for linea in r.stdout.splitlines():
        linea = linea.strip()
        if linea.startswith('{'):
            try: hechos.append(json.loads(linea))
            except Exception: pass
    if not hechos:
        # los JSON van con indent → varias líneas; segundo intento: uno por archivo
        r = ssh(f'ls {COLA}/hecho/*.json 2>/dev/null')
        for f in r.stdout.split():
            try: hechos.append(json.loads(ssh(f'cat {f}').stdout))
            except Exception: pass
    n = 0
    for h in hechos:
        if vid and h['id'] != vid: continue
        if h.get('estado') != 'ok':
            print(f'✗ {h["id"]}: {h.get("estado")} — {h.get("detalle", "")}'); continue
        p, d = manifiesto(h['id'])
        ya = ((d.get('publicar') or {}).get('subidas') or {}).get('ig') or {}
        if ya.get('id') == h['ig']['id']: continue
        registrar(p, d, 'ig', h['ig']); n += 1
        marcar_hecho(h['id'])
    print(f'✓ cosechados {n}')


def marcar_hecho(vid):
    p = os.path.join(ROOT, 'videos', 'CRONOGRAMA.json')
    try: cr = json.load(open(p))
    except Exception: return
    for dia in cr.get('dias', []):
        if dia.get('id') == vid and dia.get('estado') != 'hecho':
            dia['estado'] = 'hecho'
            json.dump(cr, open(p, 'w'), indent=2, ensure_ascii=False); open(p, 'a').write('\n')
            print(f'   cronograma: {vid} → hecho')


def estado():
    cola = cola_remota()
    print(f'cola en PRIME ({PRIME}:{COLA}): {len(cola)} entradas')
    for e in cola:
        print(f'  {e["id"]:34s} {e["programar"]}  {e.get("estado", "")} {("intentos " + str(e["intentos"])) if e.get("intentos") else ""}')
    r = ssh(f'ls {COLA}/hecho 2>/dev/null; tail -5 {COLA}/cola.log 2>/dev/null')
    print('hecho/ + log:'); print('  ' + r.stdout.strip().replace('\n', '\n  '))


def quitar(vid):
    escribir_cola([e for e in cola_remota() if e['id'] != vid]); print(f'✓ {vid} fuera de la cola')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    cmd = a[0]
    if cmd == 'tick': tick('--dry' in a)
    elif cmd == 'armar': armar(a[1])
    elif cmd == 'cosechar': cosechar(a[1] if len(a) > 1 else None)
    elif cmd == 'estado': estado()
    elif cmd == 'quitar': quitar(a[1])
    else: sys.exit(__doc__)
