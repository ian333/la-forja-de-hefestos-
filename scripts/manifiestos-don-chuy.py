#!/usr/bin/env python3
"""manifiestos-don-chuy.py — un manifiesto por capítulo de Don Chuy (motor de Sinué) y el calendario a 3 por día.

ian 2026-09-27: «necesitamos aumentar el ritmo de los experimentos» → «sí a las 3»: (1) las v1 salen de la cola,
(2) 3 reels al día (12:00, 15:30, 18:45 CDMX), (3) experimento cta_envio: la mitad de los capítulos 36-72, al azar,
cierra con «Mándaselo al que…» (B) en vez de «Sí o no, escríbelo aquí abajo» (A).

Calendario: cada día lleva UN B, UN A del sorteo y UNO de fuera del sorteo (v3 03-12 y 13-35), rotando el horario
para que ningún grupo caiga siempre a la misma hora. Días 1-18 agotan los B; el resto rellena.
Copy: sale del guion (nada inventado). primer_comentario: se conserva si ya existía; si no, las notas de precisión.
  python3 scripts/manifiestos-don-chuy.py [--desde 2026-09-28]
"""
import json, os, sys, glob, datetime as dt
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIA = '/home/ian/Orkesta/lia-video-engine/projects/economia'
DESDE = dt.date.fromisoformat(sys.argv[sys.argv.index('--desde') + 1]) if '--desde' in sys.argv else dt.date(2026, 9, 28)
SLOTS = ['12:00', '15:30', '18:45']
AUT = ('2026-09-27 yt,ig — dicho por ian en sesión: «necesitamos aumentar el ritmo de los experimentos» y, a las tres '
       'decisiones (v1 fuera, 3 al día, CTA de envío en la mitad al azar): "si a las 3 ya entendi toodoooo"')
HASH = ['#negocios', '#emprendedores', '#pymes', '#méxico', '#tiendita', '#finanzas', '#economía', '#donchuy', '#gaia', '#aprendeaverloinvisible']
VIEJOS = {'03': 'econ-merma', '04': 'econ-precio', '05': 'econ-yunus', '06': 'econ-anotar', '07': 'econ-lluvia',
          '08': 'econ-naranja', '09': 'econ-hora', '10': 'econ-enfrente', '11': 'econ-credito', '12': 'econ-fiado-b'}
VIEWS_HECHOS = set(VIEJOS.values())   # solo esos traen primer comentario escrito a mano
X = json.load(open(f'{LIA}/_salon/experimento-cta.json'))
temario = {e['slug']: e for e in json.load(open(f'{LIA}/_salon/temario.json'))}

def vo(g): return [g['hook']['texto_vo']] + [b['texto_vo'] for b in g['beats']] + [g['payoff']['texto_vo'], g['cta']['texto_vo']]

def manifiesto(slug):
    g = json.load(open(f'{LIA}/negocio/{slug}/guion.json'))
    n = slug[:2]; vid = VIEJOS.get(n, f'econ-{slug}')
    p = os.path.join(ROOT, 'videos', f'{vid}.json'); viejo = json.load(open(p)) if os.path.exists(p) else {}
    pub_v = viejo.get('publicar') or {}
    hook = g['hook']['texto_vo'].rstrip('.'); resto = hook.split('? ', 1)[1] if '? ' in hook else hook
    titulo = f'{hook} · La economía de tu negocio'
    if len(titulo) > 100: titulo = f'{hook} · Don Chuy'
    partes = vo(g)
    desc = f'{partes[0]} 🍊\n\n' + ' '.join(partes[1:-2]) + f'\n\n{partes[-2]}\n\n💬 {partes[-1]}'
    grupo = 'B' if slug in X['B'] else ('A' if slug in X['A'] else 'A (fuera del sorteo)')
    if n == '12': exp = {'variable': 'orden', 'contra': 'econ-fiado', 'grupo': 'B', 'nota': 'mismo dibujo y cifras; cambia el orden (cuenta en pantalla, sin presentación 3-12 s)'}
    else: exp = {'variable': 'cta_envio', 'grupo': grupo, 'sorteo': 'projects/economia/_salon/experimento-cta.json (semilla cta-envio-2026-09-27)'}
    notas = [x for x in (g.get('notas_precision') or []) if not x.startswith('Don Chuy es un personaje')]
    primer = (pub_v.get('primer_comentario') if vid in VIEWS_HECHOS else None) or ('Te lo explico fácil 👇\n\n' + '\n\n'.join(notas[:2]) + f'\n\n{partes[-1]}')
    d = {
        'id': vid, 'titulo': f'{g.get("tema") or resto} — Don Chuy, La economía de tu negocio ({slug})',
        'nota': f'Motor de Sinué (lia-video-engine, rama gaia/formatos-y-economia): projects/economia/negocio/{slug}. '
                f'Canon: docs/CANON-RETENCION.md. Voz Matilda XTTS, ElPuesto, 9:16. Generado por scripts/manifiestos-don-chuy.py.',
        'formato': {'w': 2160, 'h': 3840, 'fps': 30, 'dur': None, 'nota_dur': 'la del master (out/short.mp4 del motor)'},
        'audio': {'dir': f'dist-video/{vid}-narracion', 'segs': 'segs.json', 'voz': 'XTTS Matilda por el motor (./lia tts); segs.json desde words.json'},
        'salida': {'dir': 'dist-video/masters', 'master': f'{vid}-4k.mp4', 'h264': f'{vid}-4k.mp4',
                   'nota': 'Re-encodado de out/short.mp4 del motor a H.264 CBR 24 Mbps (ley de subida ≥15 Mbps).'},
        'publicar': {
            'biblioteca': f'economia/reels/{vid}.mp4', 'pieza': 'clase-reel', 'nueva': True,
            'copy': {'titulo': titulo, 'descripcion': desc, 'hashtags': HASH, 'marco': 'revelacion', 'activacion': 'alta',
                     'valor_propio': g.get('una_idea', '')},
            'autorizado': AUT, 'primer_comentario': primer, 'experimento': exp,
            'una_idea': g.get('una_idea', ''), 'fuente': temario.get(slug, {}).get('fuente', ''),
        },
    }
    if pub_v.get('subidas'):
        d['publicar']['subidas_v1'] = pub_v['subidas']
        d['publicar']['nota_v1'] = '2026-09-27: la v1 quedó privada y sin fecha en YouTube; este manifiesto publica la v3.'
    for k in ('reel_url', 'nota_v2', 'nota_espera', 'programar_en_espera'):
        pass  # se descartan: el master es otro y el reel se vuelve a hospedar
    return vid, d

# ---- calendario ----
orden = sorted(glob.glob(f'{LIA}/negocio/[0-9][0-9]-*/guion.json'))
slugs = [os.path.basename(os.path.dirname(p)) for p in orden if not os.path.basename(os.path.dirname(p)).startswith(('00', '01', '02'))]
B = [s for s in slugs if s in X['B']]; RA = [s for s in slugs if s in X['A']]
early = [s for s in slugs if s not in X['B'] and s not in X['A']]
early = ['12-el-fiado-b'] + [s for s in early if s != '12-el-fiado-b']       # el fiado B abre, a la hora de su A
plan = []  # (slug, fecha, slot)
dia = 0
while B or RA or early:
    if B and RA and early:
        trio = [(B.pop(0), (dia) % 3), (RA.pop(0), (dia + 1) % 3), (early.pop(0), (dia + 2) % 3)]
        if dia == 0: trio = [(B and trio[0][0] or trio[0][0], 0), (trio[1][0], 1), (trio[2][0], 2)]  # día 1: fiado-b a las 18:45
    else:
        resto = [s for s in (B, RA, early) if s]; trio = []
        for k in range(3):
            for lst in (early, RA, B):
                if lst: trio.append((lst.pop(0), k)); break
    for s, k in trio: plan.append((s, DESDE + dt.timedelta(days=dia), SLOTS[k]))
    dia += 1
os.makedirs(os.path.join(ROOT, 'videos'), exist_ok=True); cal = []
for s, f, h in plan:
    vid, d = manifiesto(s); d['publicar']['programar'] = f'{f.isoformat()}T{h}:00-06:00'
    d['publicar']['nota_programar'] = '3 al día (ian 2026-09-27); el grupo rota de horario cada día.'
    json.dump(d, open(os.path.join(ROOT, 'videos', f'{vid}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    cal.append({'id': vid, 'slug': s, 'cuando': d['publicar']['programar'], 'grupo': d['publicar']['experimento']['grupo']})
json.dump(cal, open(os.path.join(ROOT, 'videos', '_calendario-don-chuy.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(cal)} manifiestos · del {cal[0]["cuando"][:10]} al {cal[-1]["cuando"][:10]}')
for c in cal[:9]: print(f'  {c["cuando"][:16]}  {c["grupo"]:2s}  {c["id"]}')
