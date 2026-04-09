#!/usr/bin/env python3
"""
⚒️ La Forja — Sketch Image Exporter
=====================================
Reads viz-data JSON files and renders each profile/slice as a PNG image.
Color palette: Oro Divino (void black + divine gold).

Output: public/viz-data/sketches/<model_slug>/<slice_label>_<profile_idx>.png

Usage:
    python scripts/export-sketch-images.py                    # all models
    python scripts/export-sketch-images.py nist_ctc_01        # single model (partial match)
"""

import json
import math
import os
import sys
from pathlib import Path

# ── Try matplotlib ──
try:
    import matplotlib
    matplotlib.use('Agg')  # headless
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    from matplotlib.patches import Arc as MplArc, FancyBboxPatch
    from matplotlib.collections import LineCollection
except ImportError:
    print("ERROR: matplotlib required. Install with: pip install matplotlib")
    sys.exit(1)

# ── Paths ──
ROOT = Path(__file__).resolve().parent.parent
VIZ_DIR = ROOT / "public" / "viz-data"
OUT_DIR = VIZ_DIR / "sketches"

# ── Oro Divino palette ──
BG_COLOR = "#0d0f14"
GOLD = "#c9a84c"
GOLD_DIM = "#8a7535"
BLUE = "#508ce0"
LIGHT = "#f0ece4"
GRID_COLOR = "#1a1c24"
HOLE_COLOR = "#e05050"
FEATURE_COLORS = {
    "hole": "#e05050",
    "rect_pocket": "#508ce0",
    "pocket": "#508ce0",
    "boss": "#50c878",
    "slot": "#c77dff",
    "fillet_rect": GOLD,
    "circle": GOLD,
    "freeform": "#aaaaaa",
    "pattern_circular": "#ff8c00",
    "pattern_linear": "#ff8c00",
    "keyhole": "#ff6b9d",
}


def get_color(profile_type: str, is_hole: bool) -> str:
    if is_hole:
        return HOLE_COLOR
    return FEATURE_COLORS.get(profile_type, GOLD)


def draw_entity(ax, ent, color, lw=1.5):
    """Draw a single sketch entity (line, arc, circle) on the axes."""
    t = ent.get("type", "")

    if t == "line":
        sx, sy = ent["start"]
        ex, ey = ent["end"]
        ax.plot([sx, ex], [sy, ey], color=color, linewidth=lw, solid_capstyle="round")

    elif t == "circle":
        cx, cy = ent["center"]
        r = ent["radius"]
        circle = plt.Circle((cx, cy), r, fill=False, edgecolor=color, linewidth=lw)
        ax.add_patch(circle)

    elif t == "arc":
        cx, cy = ent["center"]
        r = ent["radius"]
        sa = math.degrees(ent.get("startAngle", 0))
        ea = math.degrees(ent.get("endAngle", 2 * math.pi))
        # matplotlib Arc wants angles CCW from +X
        if ea < sa:
            ea += 360
        arc = MplArc((cx, cy), 2 * r, 2 * r, angle=0,
                      theta1=sa, theta2=ea,
                      edgecolor=color, linewidth=lw, fill=False)
        ax.add_patch(arc)


def draw_grid(ax, bbox, step=None):
    """Subtle background grid."""
    minx, miny, maxx, maxy = bbox
    span = max(maxx - minx, maxy - miny)
    if span <= 0:
        return

    # Auto grid step
    if step is None:
        step = 10 ** math.floor(math.log10(span / 5))
        if span / step > 20:
            step *= 5
        elif span / step < 4:
            step /= 2

    xs = minx - (minx % step) - step
    while xs <= maxx + step:
        ax.axvline(xs, color=GRID_COLOR, linewidth=0.3, zorder=0)
        xs += step

    ys = miny - (miny % step) - step
    while ys <= maxy + step:
        ax.axhline(ys, color=GRID_COLOR, linewidth=0.3, zorder=0)
        ys += step


def render_profile(profile, idx, model_slug, out_dir, features=None):
    """Render a single profile to a PNG file."""
    entities = profile.get("entities", [])
    if not entities:
        return None

    ptype = profile.get("type", "unknown")
    is_hole = profile.get("isHole", False)
    plane_label = profile.get("planeLabel", "?")
    bbox = profile.get("bbox", {})
    color = get_color(ptype, is_hole)

    # Compute bounds from entities if bbox missing
    minx = bbox.get("minX", 0)
    miny = bbox.get("minY", 0)
    maxx = bbox.get("maxX", 0)
    maxy = bbox.get("maxY", 0)

    if minx == maxx or miny == maxy:
        # Fallback: compute from entity coords
        all_x, all_y = [], []
        for e in entities:
            if "start" in e:
                all_x.append(e["start"][0]); all_y.append(e["start"][1])
            if "end" in e:
                all_x.append(e["end"][0]); all_y.append(e["end"][1])
            if "center" in e:
                r = e.get("radius", 0)
                all_x.extend([e["center"][0] - r, e["center"][0] + r])
                all_y.extend([e["center"][1] - r, e["center"][1] + r])
        if all_x:
            minx, maxx = min(all_x), max(all_x)
            miny, maxy = min(all_y), max(all_y)

    # Padding
    dx = maxx - minx or 1
    dy = maxy - miny or 1
    pad = max(dx, dy) * 0.15
    minx -= pad; maxx += pad
    miny -= pad; maxy += pad

    # Figure
    aspect = (maxx - minx) / (maxy - miny) if (maxy - miny) > 0 else 1
    fig_h = 6
    fig_w = max(4, min(12, fig_h * aspect))
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_xlim(minx, maxx)
    ax.set_ylim(miny, maxy)
    ax.set_aspect("equal")

    # Grid
    draw_grid(ax, (minx, miny, maxx, maxy))

    # Entities
    for ent in entities:
        draw_entity(ax, ent, color, lw=1.8)

    # Title
    hole_tag = " [HOLE]" if is_hole else ""
    title = f"{model_slug}  •  {plane_label}  •  #{idx}  {ptype}{hole_tag}"
    ax.set_title(title, color=LIGHT, fontsize=10, fontweight="bold", pad=10)

    # Dimensions annotation
    w = bbox.get("maxX", maxx) - bbox.get("minX", minx)
    h = bbox.get("maxY", maxy) - bbox.get("minY", miny)
    area = profile.get("area", 0)
    dim_text = f"{w:.1f} × {h:.1f}"
    if area > 0:
        dim_text += f"  A={area:.0f}"
    ax.text(0.98, 0.02, dim_text, transform=ax.transAxes,
            color=GOLD_DIM, fontsize=7, ha="right", va="bottom",
            fontfamily="monospace")

    # Entity count
    n_lines = sum(1 for e in entities if e.get("type") == "line")
    n_arcs = sum(1 for e in entities if e.get("type") in ("arc", "circle"))
    ent_text = f"{n_lines}L {n_arcs}A  ({len(entities)} total)"
    ax.text(0.02, 0.02, ent_text, transform=ax.transAxes,
            color=GOLD_DIM, fontsize=7, ha="left", va="bottom",
            fontfamily="monospace")

    # Feature match annotation (if available)
    if features:
        centroid = profile.get("centroid", {})
        cx, cy = centroid.get("x"), centroid.get("y")
        if cx is not None and cy is not None:
            # Find matching feature by centroid proximity
            best = None
            best_dist = float("inf")
            for f in features:
                fc = f.get("centroid", {})
                if "x" in fc and "y" in fc:
                    d = math.hypot(fc["x"] - cx, fc["y"] - cy)
                    if d < best_dist:
                        best_dist = d
                        best = f
                # Check children in patterns
                for child in f.get("children", []):
                    fc = child.get("centroid", {})
                    if "x" in fc and "y" in fc:
                        d = math.hypot(fc["x"] - cx, fc["y"] - cy)
                        if d < best_dist:
                            best_dist = d
                            best = child

            if best and best_dist < max(dx, dy) * 0.3:
                label = best.get("label", best.get("type", ""))
                ax.text(0.5, 0.97, label, transform=ax.transAxes,
                        color=GOLD, fontsize=8, ha="center", va="top",
                        fontfamily="monospace",
                        bbox=dict(boxstyle="round,pad=0.3",
                                  facecolor="#1a1c24", edgecolor=GOLD_DIM,
                                  alpha=0.9))

    # Clean axes
    ax.tick_params(colors=GOLD_DIM, labelsize=6)
    for spine in ax.spines.values():
        spine.set_color(GOLD_DIM)
        spine.set_linewidth(0.5)

    # Save
    safe_label = plane_label.replace("/", "-").replace(" ", "_")
    fname = f"{safe_label}_{idx:03d}_{ptype}.png"
    out_path = out_dir / fname
    fig.savefig(out_path, dpi=150, bbox_inches="tight",
                facecolor=BG_COLOR, edgecolor="none")
    plt.close(fig)
    return out_path


def render_slice_raw(slice_data, idx, model_slug, out_dir):
    """Render a raw slice (contour points only, no fitted profiles) as a PNG."""
    contours = slice_data.get("contours", [])
    if not contours:
        return None

    label = slice_data.get("label", f"slice_{idx}")

    all_x, all_y = [], []
    for c in contours:
        pts = c.get("points", [])
        for p in pts:
            all_x.append(p[0])
            all_y.append(p[1])

    if not all_x:
        return None

    minx, maxx = min(all_x), max(all_x)
    miny, maxy = min(all_y), max(all_y)
    dx = maxx - minx or 1
    dy = maxy - miny or 1
    pad = max(dx, dy) * 0.15
    minx -= pad; maxx += pad
    miny -= pad; maxy += pad

    aspect = (maxx - minx) / (maxy - miny) if (maxy - miny) > 0 else 1
    fig_h = 6
    fig_w = max(4, min(12, fig_h * aspect))
    fig, ax = plt.subplots(figsize=(fig_w, fig_h), facecolor=BG_COLOR)
    ax.set_facecolor(BG_COLOR)
    ax.set_xlim(minx, maxx)
    ax.set_ylim(miny, maxy)
    ax.set_aspect("equal")
    draw_grid(ax, (minx, miny, maxx, maxy))

    for ci, c in enumerate(contours):
        pts = c.get("points", [])
        if len(pts) < 2:
            continue
        xs = [p[0] for p in pts] + [pts[0][0]]
        ys = [p[1] for p in pts] + [pts[0][1]]
        color = GOLD if ci == 0 else BLUE
        ax.plot(xs, ys, color=color, linewidth=1.2, alpha=0.8)

    ax.set_title(f"{model_slug}  •  {label}  •  raw contours",
                 color=LIGHT, fontsize=10, fontweight="bold", pad=10)
    ax.text(0.98, 0.02, f"{len(contours)} contours",
            transform=ax.transAxes, color=GOLD_DIM, fontsize=7,
            ha="right", va="bottom", fontfamily="monospace")

    ax.tick_params(colors=GOLD_DIM, labelsize=6)
    for spine in ax.spines.values():
        spine.set_color(GOLD_DIM)
        spine.set_linewidth(0.5)

    safe_label = label.replace("/", "-").replace(" ", "_")
    fname = f"raw_{safe_label}_{idx:03d}.png"
    out_path = out_dir / fname
    fig.savefig(out_path, dpi=150, bbox_inches="tight",
                facecolor=BG_COLOR, edgecolor="none")
    plt.close(fig)
    return out_path


def process_model(json_path: Path, filter_slug: str = None):
    """Process a single model JSON file."""
    slug = json_path.stem
    if filter_slug and filter_slug not in slug:
        return 0

    with open(json_path) as f:
        data = json.load(f)

    profiles = data.get("profiles", [])
    slices = data.get("slices", [])
    features = data.get("features", [])

    if not profiles and not slices:
        return 0

    model_dir = OUT_DIR / slug
    model_dir.mkdir(parents=True, exist_ok=True)

    count = 0

    # Render fitted profiles (high-quality: lines + arcs)
    for i, profile in enumerate(profiles):
        result = render_profile(profile, i, slug, model_dir, features)
        if result:
            count += 1

    # Also render raw slices (polygon contours) into a subfolder
    if slices:
        raw_dir = model_dir / "raw"
        raw_dir.mkdir(exist_ok=True)
        for i, sl in enumerate(slices):
            result = render_slice_raw(sl, i, slug, raw_dir)
            if result:
                count += 1

    return count


def main():
    filter_slug = sys.argv[1] if len(sys.argv) > 1 else None

    json_files = sorted(VIZ_DIR.glob("*.json"))
    json_files = [f for f in json_files if f.name != "index.json"]

    if not json_files:
        print(f"No viz-data JSON files found in {VIZ_DIR}")
        sys.exit(1)

    print(f"⚒️  La Forja — Sketch Image Exporter")
    print(f"   {len(json_files)} models found")
    if filter_slug:
        print(f"   Filter: *{filter_slug}*")
    print()

    total = 0
    for jf in json_files:
        n = process_model(jf, filter_slug)
        if n > 0:
            print(f"  ✓ {jf.stem}: {n} images")
            total += n

    print(f"\n   Total: {total} images → {OUT_DIR}/")


if __name__ == "__main__":
    main()
