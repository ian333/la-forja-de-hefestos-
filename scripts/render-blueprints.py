#!/usr/bin/env python3
"""Render viz-data JSON blueprints to SVG images (zero dependencies)."""
import json, math, os, sys, html

OUT_DIR = 'public/viz-data/svg'
DATA_DIR = 'public/viz-data'

# Colors (Oro Divino theme)
BG = '#08090d'
GOLD = '#c9a84c'
DIM_GOLD = '#786432'
WHITE = '#dcdcdc'
HOLE_COLOR = '#508ce0'
GRID = '#1e1e23'

W, H = 1200, 900
MARGIN = 40


def render_model(slug, data):
    """Render a single model's blueprint to SVG string."""
    profiles = data.get('profiles', [])
    if not profiles:
        return None
    
    parts = []
    parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    parts.append(f'<rect width="{W}" height="{H}" fill="{BG}"/>')
    
    # Title
    fname = html.escape(data.get('fileName', slug))
    bb = data.get('boundingBox', {})
    diag = data.get('diagonal', 0)
    rev = data.get('revolution', False)
    
    title = f"{fname}  {'[REVOLUTION]' if rev else ''}"
    parts.append(f'<text x="{MARGIN}" y="30" fill="{GOLD}" font-family="monospace" font-size="16" font-weight="bold">{title}</text>')
    
    if bb:
        bw = bb['max'][0]-bb['min'][0]
        bh = bb['max'][1]-bb['min'][1]
        bd = bb['max'][2]-bb['min'][2]
        sub = f"BBox: {bw:.1f} x {bh:.1f} x {bd:.1f} mm   Diag: {diag:.1f}mm"
        parts.append(f'<text x="{MARGIN}" y="50" fill="{DIM_GOLD}" font-family="monospace" font-size="11">{sub}</text>')
    
    # Group profiles by plane
    planes = {}
    for p in profiles:
        pl = p.get('planeLabel', '?')
        if pl not in planes:
            planes[pl] = []
        planes[pl].append(p)
    
    plane_names = list(planes.keys())[:3]
    n_views = len(plane_names)
    if n_views == 0:
        return None
    
    view_w = (W - MARGIN * 2) // n_views
    view_h = H - MARGIN * 2 - 80
    
    for vi, pname in enumerate(plane_names):
        profs = planes[pname]
        vx = MARGIN + vi * view_w
        vy = MARGIN + 30
        
        # View border
        parts.append(f'<rect x="{vx}" y="{vy}" width="{view_w-8}" height="{view_h}" fill="none" stroke="{GRID}" stroke-width="1"/>')
        parts.append(f'<text x="{vx+8}" y="{vy+16}" fill="{WHITE}" font-family="monospace" font-size="11">Plane {html.escape(pname)} ({len(profs)} profiles)</text>')
        
        # Compute bounding box of all entities
        all_pts = []
        for p in profs:
            for e in p.get('entities', []):
                if e['type'] in ['circle', 'arc']:
                    cx, cy = e['center']
                    r = e['radius']
                    all_pts.extend([(cx-r, cy-r), (cx+r, cy+r)])
                elif e['type'] == 'line':
                    all_pts.append(tuple(e['start']))
                    all_pts.append(tuple(e['end']))
        
        if not all_pts:
            parts.append(f'<text x="{vx+20}" y="{vy+40}" fill="{DIM_GOLD}" font-family="monospace" font-size="10">No entities</text>')
            continue
        
        xs = [p[0] for p in all_pts]
        ys = [p[1] for p in all_pts]
        min_x, max_x = min(xs), max(xs)
        min_y, max_y = min(ys), max(ys)
        
        data_w = max_x - min_x or 1
        data_h = max_y - min_y or 1
        
        pad = 25
        avail_w = view_w - pad * 2 - 8
        avail_h = view_h - pad * 2 - 25
        
        scale = min(avail_w / data_w, avail_h / data_h)
        
        ox = vx + pad + (avail_w - data_w * scale) / 2
        oy = vy + pad + 20 + (avail_h - data_h * scale) / 2
        
        def tx(x): return ox + (x - min_x) * scale
        def ty(y): return oy + (max_y - y) * scale
        
        # Clip group
        clip_id = f"clip-{vi}-{slug.replace('.','_')}"
        parts.append(f'<defs><clipPath id="{clip_id}"><rect x="{vx+1}" y="{vy+1}" width="{view_w-10}" height="{view_h-2}"/></clipPath></defs>')
        parts.append(f'<g clip-path="url(#{clip_id})">')
        
        # Grid
        grid_step = 10
        gx = math.floor(min_x / grid_step) * grid_step
        while gx <= max_x + grid_step:
            sx = tx(gx)
            parts.append(f'<line x1="{sx:.1f}" y1="{vy}" x2="{sx:.1f}" y2="{vy+view_h}" stroke="{GRID}" stroke-width="0.5"/>')
            gx += grid_step
        gy = math.floor(min_y / grid_step) * grid_step
        while gy <= max_y + grid_step:
            sy = ty(gy)
            parts.append(f'<line x1="{vx}" y1="{sy:.1f}" x2="{vx+view_w}" y2="{sy:.1f}" stroke="{GRID}" stroke-width="0.5"/>')
            gy += grid_step
        
        # Draw entities
        for p in profs:
            is_hole = p.get('isHole', False)
            color = HOLE_COLOR if is_hole else GOLD
            
            for e in p.get('entities', []):
                if e['type'] == 'line':
                    x1, y1 = tx(e['start'][0]), ty(e['start'][1])
                    x2, y2 = tx(e['end'][0]), ty(e['end'][1])
                    parts.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{color}" stroke-width="1.5"/>')
                    
                elif e['type'] == 'circle':
                    cx, cy = tx(e['center'][0]), ty(e['center'][1])
                    r = e['radius'] * scale
                    parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{color}" stroke-width="1.5"/>')
                    d_txt = f"ø{e['radius']*2:.2f}"
                    parts.append(f'<text x="{cx+r+4:.1f}" y="{cy+4:.1f}" fill="{color}" font-family="monospace" font-size="8">{d_txt}</text>')
                    
                elif e['type'] == 'arc':
                    cx, cy = tx(e['center'][0]), ty(e['center'][1])
                    r = e['radius'] * scale
                    # Simplified: draw full circle for arcs (we don't have reliable start/end angles in all data)
                    parts.append(f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="none" stroke="{color}" stroke-width="1" stroke-dasharray="3,2"/>')
        
        parts.append('</g>')
        
        # Dimension text
        dim_y = vy + view_h - 8
        parts.append(f'<text x="{vx+8}" y="{dim_y}" fill="{DIM_GOLD}" font-family="monospace" font-size="9">Range: {data_w:.1f} x {data_h:.1f} mm</text>')
    
    # Features list at bottom
    features = data.get('features', [])
    fy = H - 20
    feat_str = f"Features ({len(features)}): " + " | ".join(html.escape(f.get('label','?')) for f in features[:8])
    parts.append(f'<text x="{MARGIN}" y="{fy}" fill="{GOLD}" font-family="monospace" font-size="9">{feat_str}</text>')
    
    parts.append('</svg>')
    return '\n'.join(parts)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    
    index = json.load(open(os.path.join(DATA_DIR, 'index.json')))
    
    rendered = 0
    for m in index:
        slug = m['slug']
        fpath = os.path.join(DATA_DIR, f'{slug}.json')
        if not os.path.exists(fpath):
            continue
        
        data = json.load(open(fpath))
        svg = render_model(slug, data)
        if svg is None:
            print(f'  SKIP {slug} (no profiles)')
            continue
        
        out_path = os.path.join(OUT_DIR, f'{slug}.svg')
        with open(out_path, 'w') as f:
            f.write(svg)
        rendered += 1
        print(f'  OK   {slug}.svg')
    
    print(f'\nRendered {rendered} blueprints to {OUT_DIR}/')


if __name__ == '__main__':
    main()
