#!/usr/bin/env python3
"""Test bench: audit all 37 extracted models for quality."""
import json, math, os

index = json.load(open('public/viz-data/index.json'))

grades = {'A': 0, 'B': 0, 'C': 0, 'F': 0}

for i, m in enumerate(index):
    slug = m['slug']
    diag = m.get('diagonal') or 0
    rev = 'REV' if m.get('revolution') else 'PRI'
    feat = m.get('featureCount', 0)
    raw = m.get('rawEntities', 0)

    fpath = f'public/viz-data/{slug}.json'
    if not os.path.exists(fpath):
        grades['F'] += 1
        continue

    d = json.load(open(fpath))
    slices = d.get('slices', [])
    features = d.get('features', [])

    issues = []
    total_contours = sum(len(s.get('contours', [])) for s in slices)

    min_pts = 999999
    for s in slices:
        for c in s.get('contours', []):
            n = len(c.get('points', []))
            if n < min_pts:
                min_pts = n
    if min_pts < 10 and total_contours > 0:
        issues.append(f'min_pts={min_pts}')

    total_ents = sum(len(c.get('entities', [])) for s in slices for c in s.get('contours', []))
    if total_ents == 0 and total_contours > 0:
        issues.append('NO_ENT')

    if feat == 0:
        issues.append('NO_FEAT')

    low_conf = sum(1 for f in features if f.get('confidence', 0) < 0.5)
    if low_conf > 0:
        issues.append(f'lconf={low_conf}')

    if not issues:
        grade = 'A'
    elif issues == ['NO_ENT']:
        grade = 'B'
    elif len(issues) <= 2:
        grade = 'C'
    else:
        grade = 'F'

    grades[grade] += 1
    iss = ', '.join(issues) if issues else 'OK'
    print(f'{i:2d} {slug:42s} {diag:8.1f} {rev} f={feat:2d} r={raw:4d} {grade} {iss}')

print(f'\nA={grades["A"]}  B={grades["B"]}  C={grades["C"]}  F={grades["F"]}  total={sum(grades.values())}')
print(f'\nA = todo funcional')
print(f'B = puntos OK, falta exportar entities (facil de arreglar)')
print(f'C = problemas menores (contornos chicos O baja confianza)')
print(f'F = problemas serios (multiples fallos)')
