#!/usr/bin/env python3
"""
precompute-transistor.py — la GEOMETRÍA REAL del transistor de 2 nm → .bin

Mismo patrón que precompute-atom-cloud.py: la física se calcula en Python y el
render solo DIBUJA lo calculado. La escena no inventa ni una posición.

Qué sale (public/precomputed/transistor-2nm.bin):
  header  : int32 n_si · int32 n_dop · int32 n_gate · float32 (reservado)
  si      : float32[n_si*3]   posiciones de los átomos de Si (nm)
  rol     : uint8[n_si]       0=canal 1=source 2=drain
  dop     : float32[n_dop*3]  posiciones de los DOPANTES (subred, aleatorias=RDF)
  gate    : float32[n_gate*3] la compuerta que ENVUELVE (GAA)

float32 y no int16: con int16×0.01nm el enlace Si-Si medía 0.2311 nm en vez de
0.235169 (error 1.75%, sesgado a menos porque el mínimo sobre vecinos ruidosos
tiende a bajar). Invisible en pantalla, pero si el video afirma "esta es la red
REAL del silicio", la red no lleva error que yo pueda evitar. Cuesta 1.5 MB más.

Todo desde datos citados en transistor-real.py (IRDS 2022 + TSMC N2 + Si medido).

Uso: python3 scripts/precompute-transistor.py
"""
import os, struct
import numpy as np

# ── datos (ver transistor-real.py para fuentes) ──
A_SI = 0.5431          # nm — parámetro de red del Si (medido)
LG   = 14.0            # nm — longitud física de compuerta   [IRDS 2022]
WSH  = 15.0            # nm — ancho de nanosheet             [IRDS 2022]
TSH  = 6.0             # nm — espesor de nanosheet           [IRDS 2022]
TSP  = 10.0            # nm — separación lámina a lámina     [IRDS 2022]
NSH  = 3               # láminas apiladas
CPP  = 48.0            # nm — gate pitch                     [TSMC N2]
ND_SD = 1e20           # cm^-3 — dopaje source/drain         [DOP]
SEED = 20260715

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'transistor-2nm.bin')

# ── la RED: estructura diamante REAL del silicio ──
# FCC + base (¼,¼,¼) = 8 átomos por celda cúbica. Esto NO es un arreglo que yo
# elija: es la estructura cristalina medida del Si. Cada átomo tiene 4 vecinos
# a 109.47° (sp³) — el tetraedro EMERGE de aquí, no se dibuja.
FCC  = np.array([[0,0,0], [0,.5,.5], [.5,0,.5], [.5,.5,0]])
BASE = np.concatenate([FCC, FCC + 0.25])     # 8 átomos/celda

# el dispositivo completo: source + canal + drain a lo largo de x
L_SD  = (CPP - LG) / 2                        # nm de source (y de drain)
L_TOT = CPP                                   # el pitch completo
ncx = int(np.ceil(L_TOT / A_SI))
ncy = int(np.ceil(WSH  / A_SI))
ncz = int(np.ceil(TSH  / A_SI))

print(f"celdas: {ncx}×{ncy}×{ncz} = {ncx*ncy*ncz:,}  → {ncx*ncy*ncz*8:,} átomos/lámina")

# generar la red completa
ix, iy, iz = np.meshgrid(np.arange(ncx), np.arange(ncy), np.arange(ncz), indexing='ij')
cells = np.stack([ix.ravel(), iy.ravel(), iz.ravel()], axis=1).astype(np.float64)
pos = (cells[:, None, :] + BASE[None, :, :]).reshape(-1, 3) * A_SI   # nm

# recortar al volumen real del dispositivo
keep = (pos[:,0] <= L_TOT) & (pos[:,1] <= WSH) & (pos[:,2] <= TSH)
pos = pos[keep]
print(f"átomos de Si tras recorte: {len(pos):,}")

# ── ROL de cada átomo: source / canal / drain ──
# el canal está bajo la compuerta, centrado en el pitch
x0_ch, x1_ch = L_SD, L_SD + LG
rol = np.where(pos[:,0] < x0_ch, 1, np.where(pos[:,0] > x1_ch, 2, 0)).astype(np.uint8)
n_ch = int((rol == 0).sum()); n_so = int((rol == 1).sum()); n_dr = int((rol == 2).sum())
print(f"  canal : {n_ch:,} átomos  (x ∈ [{x0_ch:.1f}, {x1_ch:.1f}] nm)")
print(f"  source: {n_so:,}   drain: {n_dr:,}")

# ── LOS DOPANTES: cuántos y dónde ──
# el número NO lo elijo: sale de la concentración real × el volumen real.
n_si_per_nm3 = 8 / A_SI**3
v_source = L_SD * WSH * TSH
n_dop = int(round(ND_SD * 1e-21 * v_source))     # cm^-3 → nm^-3
print(f"dopantes en source: {n_dop} = {ND_SD:.0e} cm^-3 × {v_source:.0f} nm³")
print(f"  (1 dopante por cada {n_si_per_nm3/(ND_SD*1e-21):,.0f} átomos de Si)")

rng = np.random.default_rng(SEED)
# los dopantes SUSTITUYEN átomos de Si de la red (sustitucionales, así es real)
# posiciones ALEATORIAS: eso ES random dopant fluctuation, el fenómeno mismo.
src_idx = np.where(rol == 1)[0]
dop_idx = rng.choice(src_idx, size=min(n_dop, len(src_idx)), replace=False)
dop = pos[dop_idx]
# el drain igual (simétrico)
drn_idx = np.where(rol == 2)[0]
dop2_idx = rng.choice(drn_idx, size=min(n_dop, len(drn_idx)), replace=False)
dop = np.concatenate([dop, pos[dop2_idx]])
print(f"dopantes totales (source+drain): {len(dop)}")
print(f"dopantes en el CANAL: 0  ← intrínseco a propósito [DOP]")

# ── LA COMPUERTA: envuelve el canal por los 4 lados (GAA = gate all around) ──
# no es decoración: es la definición del dispositivo. Malla sobre la superficie
# del prisma del canal, a 1 nm (el óxido HfO2 va entre medias).
GAP = 1.0    # nm de dieléctrico entre canal y metal
gx = np.arange(x0_ch, x1_ch, 0.4)
gper = []
for x in gx:
    # anillo alrededor de la sección (y,z) del canal
    for t in np.arange(0, 1, 0.02):
        p = t * 2 * (WSH + TSH + 4*GAP)
        w, h = WSH + 2*GAP, TSH + 2*GAP
        per = 2*(w+h)
        s = (t*per) % per
        if   s < w:        y, z = s, -GAP
        elif s < w+h:      y, z = w, s-w
        elif s < 2*w+h:    y, z = w-(s-w-h), h
        else:              y, z = 0, h-(s-2*w-h)
        gper.append([x, y-GAP, z-GAP])
gate = np.array(gper)
print(f"compuerta GAA: {len(gate):,} puntos envolviendo el canal")

# ── escribir ──
os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, 'wb') as f:
    f.write(struct.pack('<iiif', len(pos), len(dop), len(gate), 1.0))
    f.write(pos.astype(np.float32).tobytes())
    f.write(rol.astype(np.uint8).tobytes())
    f.write(dop.astype(np.float32).tobytes())
    f.write(gate.astype(np.float32).tobytes())

# ── VERIFICACIÓN: la red debe reproducir el enlace y el ángulo MEDIDOS ──
# Sin esto, "es la red real" es una afirmación sin respaldo. El v1 se rechazó
# justo por eso. El ángulo NO está escrito en ningún lado: debe EMERGER.
from scipy.spatial import cKDTree
tree = cKDTree(pos)
d, _ = tree.query(pos[:30000], k=2)
bond_real = A_SI * np.sqrt(3) / 4
err_b = abs(np.median(d[:,1]) - bond_real) / bond_real * 100
c = pos.mean(axis=0)
inner = np.where(np.all(np.abs(pos - c) < 1.0, axis=1))[0][:400]
_, i4 = tree.query(pos[inner], k=5)
angs = []
for row_i, p in zip(i4, pos[inner]):
    nb = pos[row_i[1:5]] - p
    n = np.linalg.norm(nb, axis=1, keepdims=True)
    if n.min() < 1e-9: continue
    nb = nb / n
    for a in range(4):
        for b in range(a+1, 4):
            angs.append(np.degrees(np.arccos(np.clip(nb[a] @ nb[b], -1, 1))))
ang_ideal = np.degrees(np.arccos(-1/3))
err_a = abs(np.mean(angs) - ang_ideal)
print(f"\n── verificación de la red (no del archivo) ──")
print(f"  enlace Si-Si : {np.median(d[:,1]):.6f} nm  vs {bond_real:.6f} medido  → {err_b:.4f}%")
print(f"  ángulo sp³   : {np.mean(angs):.4f}°  vs {ang_ideal:.4f}° ideal  → {err_a:.6f}°")
assert err_b < 0.1, f"la red NO reproduce el enlace Si-Si ({err_b:.2f}%)"
assert err_a < 0.01, f"el ángulo sp³ NO emerge ({err_a:.4f}°)"
print(f"  ✓ el tetraedro sp³ EMERGE de la estructura — la red es la real")

sz = os.path.getsize(OUT)
print(f"\n✓ {OUT}")
print(f"  {sz/1e6:.2f} MB · {len(pos):,} Si · {len(dop)} dopantes · {len(gate):,} gate")
print(f"  dimensiones reales: {L_TOT:.0f}×{WSH:.0f}×{TSH:.0f} nm (gate pitch × ancho × espesor)")
