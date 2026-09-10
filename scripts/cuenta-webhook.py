#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""cuenta-webhook.py — registra en Stripe el webhook de la API de cobro en su URL FIJA (idempotente).

Por qué (2026-09-10): con la puerta fija (/api/cuenta/) el webhook de Stripe tiene por fin una URL
que no cambia. Stripe solo enseña la firma (whsec_…) al CREAR el endpoint, así que este script la
guarda en university-api/.env (local, 600) y de ahí `cuenta-puerta-fija.sh` la copia a ATLAS.
Nunca imprime la firma ni la llave.

Usa la llave del modo que diga STRIPE_MODE en el .env (test hoy; production al cambiar): el endpoint
de prueba y el de vivo son DOS registros distintos en Stripe, cada uno con su firma.

  python3 scripts/cuenta-webhook.py            # registra si falta, guarda la firma
  python3 scripts/cuenta-webhook.py --renovar  # borra el nuestro y lo crea de nuevo (firma nueva)
"""
import os, re, sys, json, base64, urllib.request, urllib.parse

ENV = '/home/ian/Orkesta/university-api/.env'
URL = 'https://university.gaiaprime.com.mx/api/cuenta/webhooks/stripe'
EVENTS = ['checkout.session.completed', 'invoice.paid', 'invoice.payment_failed',
          'customer.subscription.updated', 'customer.subscription.deleted']   # los 5 de DEPLOY.md §4


def main():
    env = open(ENV, encoding='utf-8').read()
    get = lambda k: (re.search(rf'^{k}=(.*)$', env, re.M) or [None, ''])[1].strip().strip('"')
    modo = get('STRIPE_MODE') or 'test'
    key = (get('STRIPE_LIVE_SECRET_KEY') if modo == 'production' else get('STRIPE_TEST_SECRET_KEY')) or get('STRIPE_SECRET_KEY')
    if not key: sys.exit(f'✗ sin llave de Stripe para STRIPE_MODE={modo} en {ENV}')
    print(f'modo {modo} · llave {key[:8]}… · URL {URL}')
    auth = 'Basic ' + base64.b64encode((key + ':').encode()).decode()

    def api(path, data=None, metodo=None):
        req = urllib.request.Request('https://api.stripe.com/v1/' + path,
                                     data=urllib.parse.urlencode(data, doseq=True).encode() if data else None,
                                     headers={'Authorization': auth}, method=metodo)
        return json.load(urllib.request.urlopen(req, timeout=60))

    eps = api('webhook_endpoints?limit=50')['data']
    print(f'endpoints existentes ({modo}):')
    for e in eps: print(f'   {e["status"]:9} {e["url"]}  ({len(e["enabled_events"])} eventos)')
    mios = [e for e in eps if e['url'] == URL]
    if mios and '--renovar' in sys.argv:
        for e in mios: api(f'webhook_endpoints/{e["id"]}', metodo='DELETE'); print(f'   borrado {e["id"]}')
        mios = []
    if mios:
        print('✓ el nuestro ya existe; la firma no se puede releer (usa --renovar si la perdiste)'); return
    e = api('webhook_endpoints', {'url': URL, 'enabled_events[]': EVENTS,
                                  'description': f'GAIA University cuenta ({modo}) — puerta fija 2026-09-10'})
    sec = e['secret']
    if re.search(r'^STRIPE_WEBHOOK_SECRET=', env, re.M):
        env = re.sub(r'^STRIPE_WEBHOOK_SECRET=.*$', 'STRIPE_WEBHOOK_SECRET=' + sec, env, flags=re.M)
    else:
        env = env.rstrip('\n') + '\nSTRIPE_WEBHOOK_SECRET=' + sec + '\n'
    open(ENV, 'w', encoding='utf-8').write(env); os.chmod(ENV, 0o600)
    print(f'✓ creado {e["id"]} ({len(e["enabled_events"])} eventos) · firma guardada en {ENV}')
    print('  sigue: bash scripts/cuenta-puerta-fija.sh  (paso 5 la copia a ATLAS y recrea la API)')


if __name__ == '__main__': main()
