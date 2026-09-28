#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""growth-tablero.py — los 5 números de growth (AARRR), medidos, una vez por semana.

ian 2026-09-28: «tu sesión será la encargada de growth». Growth es un circuito con un paso roto a la vez;
este tablero dice CUÁL. Cinco filas, un número cada una, y de dónde sale. Nada de 40 métricas.

  Adquisición   vistas de reels (Instagram, PRIME hecho/*.json + insights) y correos con destinatario (JA-VAZ)
  Activación    personas que ESCRIBIERON un número en la libreta (chuy.numero) + clientes que abrieron el portal
  Retención     personas que abrieron la libreta ≥2 días distintos; negocios activos en 7 días (métrica norte)
  Referencia    cuentas mandadas por WhatsApp (chuy.whatsapp) + compartidos por mil en Instagram
  Ingreso       $ MRR (hoy: 0, verificable)

Fuentes: telemetría del sitio (ATLAS, contenedor gaia_telemetry_forja /data/events.jsonl), base gaia_core en
ATLAS (campania_correos, client_portal_tokens), PRIME ~/forja-cola/hecho + Graph API.
  python3 scripts/growth-tablero.py [--dias 7]
"""
import os, sys, json, subprocess, collections, datetime as dt, requests
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONF = os.path.expanduser('~/.config/gaia-pub'); ATLAS = 'ian@100.97.118.117'; PRIME = 'ian@100.110.244.20'
DIAS = int(sys.argv[sys.argv.index('--dias') + 1]) if '--dias' in sys.argv else 7
HOY = dt.date.today(); DESDE = HOY - dt.timedelta(days=DIAS)

def ssh(host, cmd, timeout=60):
    r = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=15', host, cmd], capture_output=True, text=True, timeout=timeout)
    return r.stdout

def dia(e):
    t = e.get('t') or 0
    try: return dt.datetime.fromtimestamp(t / 1000 if t > 1e12 else t).date()
    except Exception: return None

def libreta():
    out = ssh(ATLAS, 'docker exec gaia_telemetry_forja sh -c "grep -a chuy /data/events.jsonl"')
    ev = []
    for l in out.splitlines():
        try: ev.append(json.loads(l))
        except Exception: pass
    ev = [e for e in ev if str(e.get('type', '')).startswith('chuy.')]
    per = lambda e: (e.get('data') or {}).get('s') or e.get('sid')
    en = lambda tipo: [e for e in ev if e.get('type') == tipo and (dia(e) or DESDE) >= DESDE]
    abren = collections.defaultdict(set)
    for e in [x for x in ev if x.get('type') == 'chuy.abre']: abren[per(e)].add(dia(e))
    return {
        'abrieron_total': len(abren), 'abrieron_semana': len({per(e) for e in en('chuy.abre')}),
        'escribieron_semana': len({per(e) for e in en('chuy.numero')}), 'escribieron_total': len({per(e) for e in ev if e.get('type') == 'chuy.numero'}),
        'volvieron_otro_dia': sum(1 for v in abren.values() if len(v) > 1),
        'activos_7d': len({per(e) for e in ev if (dia(e) or DESDE) >= HOY - dt.timedelta(days=7) and e.get('type') in ('chuy.numero', 'chuy.fiado', 'chuy.cobrado')}),
        'whatsapp_semana': len(en('chuy.whatsapp')), 'hermes_semana': len(en('chuy.hermes')),
        'ultimo_dia': max((dia(e) for e in ev if dia(e)), default=None),
    }

def javaz():
    q = ("select coalesce(estado,'?'), count(*) from campania_correos group by 1; "
         "select 'tokens', count(*) from client_portal_tokens; "
         "select 'abiertos', count(*) from client_portal_tokens where coalesce(aperturas,0) > 0; "
         "select 'pedidos', coalesce(sum(pedidos_repetidos),0) from client_portal_tokens;")
    out = ssh(ATLAS, f'docker exec -i gaia_pg_atlas psql -U admin -d gaia_core -At -F"|" -c "{q}"')
    d = {}
    for l in out.splitlines():
        if '|' in l: k, v = l.split('|', 1); d[k] = int(float(v)) if v.replace('.', '').isdigit() else v
    return d

def instagram():
    out = ssh(PRIME, 'cd ~/forja-cola/hecho && python3 -c "import json,glob; [print(json.dumps(json.load(open(f)))) for f in glob.glob(\'*.json\')]"')
    hechos = []
    for l in out.splitlines():
        try: hechos.append(json.loads(l))
        except Exception: pass
    tk = json.load(open(os.path.join(CONF, 'instagram-token.json')))['access_token']
    vistas = comp = 0; n = 0
    for h in hechos:
        pub = (h.get('publicado_en') or '')[:10]; ig = h.get('ig') or {}
        if not ig.get('id') or not pub or dt.date.fromisoformat(pub) < DESDE: continue
        r = requests.get(f'https://graph.instagram.com/v25.0/{ig["id"]}/insights', params={'metric': 'views,shares', 'access_token': tk}, timeout=30).json()
        m = {x['name']: (x.get('values') or [{}])[0].get('value') or 0 for x in r.get('data', [])}
        vistas += m.get('views', 0); comp += m.get('shares', 0); n += 1
    seg = requests.get('https://graph.instagram.com/v25.0/me', params={'fields': 'followers_count', 'access_token': tk}, timeout=30).json().get('followers_count')
    return {'reels_semana': n, 'vistas_semana': vistas, 'comp_por_mil': round(1000 * comp / vistas, 2) if vistas else 0, 'seguidores': seg}

def main():
    L = libreta(); J = javaz(); I = instagram()
    enviados = sum(v for k, v in J.items() if k in ('enviado', 'sent', 'entregado')) if isinstance(J, dict) else 0
    filas = [
        ('ADQUISICIÓN', f'{I["vistas_semana"]:,} vistas en {I["reels_semana"]} reels · {I["seguidores"]:,} seguidores · correos JA-VAZ enviados: {enviados}'),
        ('ACTIVACIÓN', f'{L["escribieron_semana"]} escribieron un número en la libreta (total histórico {L["escribieron_total"]}) · portal JA-VAZ: {J.get("tokens", 0)} accesos emitidos, {J.get("abiertos", 0)} abiertos'),
        ('RETENCIÓN', f'{L["activos_7d"]} negocios activos en 7 días (MÉTRICA NORTE) · {L["volvieron_otro_dia"]} volvieron otro día · abrieron alguna vez: {L["abrieron_total"]} (último: {L["ultimo_dia"]})'),
        ('REFERENCIA', f'{L["whatsapp_semana"]} cuentas mandadas por WhatsApp · {I["comp_por_mil"]} compartidos por mil en Instagram · pedidos repetidos por el portal: {J.get("pedidos", 0)}'),
        ('INGRESO', '$0 MRR'),
    ]
    print(f'GROWTH · semana {DESDE} → {HOY}')
    for k, v in filas: print(f'  {k:12s} {v}')
    roto = 'ACTIVACIÓN' if L['escribieron_semana'] == 0 and J.get('abiertos', 0) == 0 else ('RETENCIÓN' if L['activos_7d'] < 30 else 'REFERENCIA')
    print(f'  → el paso roto esta semana: {roto}')
    os.makedirs(os.path.join(ROOT, 'public', 'comando'), exist_ok=True)
    json.dump({'fecha': HOY.isoformat(), 'dias': DIAS, 'libreta': L, 'javaz': J, 'instagram': I, 'roto': roto},
              open(os.path.join(ROOT, 'public', 'comando', 'growth.json'), 'w'), ensure_ascii=False, indent=1, default=str)

if __name__ == '__main__':
    main()
