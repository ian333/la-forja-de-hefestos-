#!/usr/bin/env python3
"""Deep entity analysis: find waste and minimal representation."""
import json, os, math
from collections import defaultdict

index = json.load(open('public/viz-data/index.json'))

grand = {'line': 0, 'arc': 0, 'circle': 0}
unique_radii = set()
models_detail = []

for m in index:
    fpath = f'public/viz-data/{m["slug"]}.json'
    if not os.path.exists(fpath): continue
    d = json.load(open(fpath))

    lines = arcs = circles = 0
    radii = set()
    short_lines = 0
    colinear_candidates = 0

    for p in d.get('profiles', []):
        prev_angle = None
        for e in p.get('entities', []):
            if e['type'] == 'line':
                lines += 1
                dx = e['end'][0] - e['start'][0]
                dy = e['end'][1] - e['start'][1]
                length = math.sqrt(dx*dx + dy*dy)
                angle = round(math.degrees(math.atan2(dy, dx)) % 180, 0)
                if length < 0.5:
                    short_lines += 1
                if prev_angle is not None and abs(angle - prev_angle) < 3:
                    colinear_candidates += 1
                prev_angle = angle
            elif e['type'] == 'arc':
                arcs += 1
                r = round(e['radius'], 2)
                radii.add(r)
                unique_radii.add(r)
                prev_angle = None
            elif e['type'] == 'circle':
                circles += 1
                r = round(e['radius'], 2)
                radii.add(r)
                unique_radii.add(r)
                prev_angle = None

    total = lines + arcs + circles
    if total == 0: continue

    grand['line'] += lines
    grand['arc'] += arcs
    grand['circle'] += circles

    models_detail.append({
        'slug': m['slug'][:35],
        'lines': lines, 'arcs': arcs, 'circles': circles,
        'total': total,
        'unique_radii': len(radii),
        'short_lines': short_lines,
        'colinear': colinear_candidates,
    })

print('=== ENTITY INVENTORY (all 37 models) ===')
print(f'  Lines:   {grand["line"]:5d}  ({grand["line"]/sum(grand.values())*100:.0f}%)')
print(f'  Arcs:    {grand["arc"]:5d}  ({grand["arc"]/sum(grand.values())*100:.0f}%)')
print(f'  Circles: {grand["circle"]:5d}  ({grand["circle"]/sum(grand.values())*100:.0f}%)')
print(f'  TOTAL:   {sum(grand.values()):5d}')
print(f'  Unique radii across ALL models: {len(unique_radii)}')
print()

total_short = sum(m['short_lines'] for m in models_detail)
total_colinear = sum(m['colinear'] for m in models_detail)
print('=== WASTE ANALYSIS ===')
print(f'  Short lines (<0.5mm):     {total_short:5d}  ({total_short/grand["line"]*100:.0f}% of lines)')
print(f'  Colinear consecutive:     {total_colinear:5d}  ({total_colinear/grand["line"]*100:.0f}% of lines)')
print(f'  => Reducible lines:       ~{total_short + total_colinear}')
print()

print('=== PER-MODEL BREAKDOWN ===')
print(f'{"model":37s} {"lin":>5} {"arc":>5} {"cir":>5} {"TOT":>5} {"uR":>3} {"short":>5} {"colin":>5} {"waste%":>6}')
print('-'*80)
for m in sorted(models_detail, key=lambda x: -x['total']):
    waste = m['short_lines'] + m['colinear']
    wpct = waste / m['total'] * 100 if m['total'] > 0 else 0
    print(f'{m["slug"]:37s} {m["lines"]:5d} {m["arcs"]:5d} {m["circles"]:5d} {m["total"]:5d} {m["unique_radii"]:3d} {m["short_lines"]:5d} {m["colinear"]:5d} {wpct:5.0f}%')

# Ideal minimal representation
print()
print('=== IDEAL MINIMAL REPRESENTATION ===')
for m_data in sorted(models_detail, key=lambda x: -x['total'])[:10]:
    slug = m_data['slug']
    fpath_match = [mm for mm in index if mm['slug'][:35] == slug]
    if not fpath_match: continue
    fpath = f'public/viz-data/{fpath_match[0]["slug"]}.json'
    if not os.path.exists(fpath): continue
    d = json.load(open(fpath))

    # Count truly unique profiles (by type + rounded dimensions)
    profile_sigs = set()
    for p in d.get('profiles', []):
        sig_parts = [p['type']]
        if p.get('radius'): sig_parts.append(f'r{round(p["radius"],1)}')
        if p.get('rectWidth'): sig_parts.append(f'w{round(p["rectWidth"],1)}')
        if p.get('rectHeight'): sig_parts.append(f'h{round(p["rectHeight"],1)}')
        if p.get('cornerRadius'): sig_parts.append(f'cr{round(p["cornerRadius"],1)}')
        profile_sigs.add('_'.join(sig_parts))

    n_profiles = len(d.get('profiles', []))
    n_unique = len(profile_sigs)
    print(f'  {slug:35s}: {n_profiles:3d} profiles -> {n_unique:3d} unique shapes  (redundancy: {n_profiles/max(n_unique,1):.1f}x)')

print()
print('=== UNIQUE RADII (sorted, first 30) ===')
for i, r in enumerate(sorted(unique_radii)):
    if i >= 30:
        print(f'  ... and {len(unique_radii)-30} more')
        break
    print(f'  R = {r:.2f}mm')
