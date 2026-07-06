#!/usr/bin/env python3
"""
pulsar-engine.py — EL MOTOR del púlsar (lo que lo hace "un púlsar" dentro de la nebulosa):
  · NÚCLEO: la estrella de neutrones (punto incandescente).
  · TORO ECUATORIAL: el viento de partículas relativistas chocando en el plano del ecuador
    (los anillos brillantes del Cangrejo en Chandra).
  · JETS BIPOLARES: chorros a lo largo del eje de espín (a ~0.7c en el Cangrejo).
Eje inclinado (como el Cangrejo). Emisión X = azul-blanco (sincrotrón). Coords en el MISMO
espacio que la nebulosa (turbulent-nebula-sim) para que alineen al escalar igual.
Salida: x,y,z,bright float32.  Uso: python3 scripts/pulsar-engine.py [out]
"""
import sys, numpy as np
OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/pulsar-code/pulsar-engine"
rng = np.random.default_rng(3)

TILT = np.radians(26.0)                       # inclinación del eje espín/jet
axis = np.array([np.sin(TILT), np.cos(TILT), 0.0]); axis /= np.linalg.norm(axis)
# base ortonormal (e1,e2 ⟂ axis) para el plano ecuatorial del toro
tmp = np.array([0.0, 0.0, 1.0])
e1 = np.cross(axis, tmp); e1 /= np.linalg.norm(e1)
e2 = np.cross(axis, e1)

parts = []

# ── NÚCLEO (la NS): blob denso brillante ──
nC = 40_000
pc = rng.normal(0, 0.025, (nC, 3))
bc = np.full(nC, 1.0)
parts.append((pc, bc))

# ── TORO ECUATORIAL: anillo en el plano ⟂ axis ──
nT = 160_000
th = rng.uniform(0, 2*np.pi, nT)
Rtor = 0.17 + 0.025*rng.standard_normal(nT)   # radio del anillo
ring = (np.cos(th)[:,None]*e1 + np.sin(th)[:,None]*e2) * Rtor[:,None]
ring += axis * (0.02*rng.standard_normal(nT))[:,None]   # grosor a lo largo del eje
ring += rng.normal(0, 0.012, (nT, 3))         # difusión
bt = 0.55 + 0.45*np.abs(rng.standard_normal(nT))        # brillo variable (grumos)
parts.append((ring, np.clip(bt,0,1)))

# ── JETS BIPOLARES: columnas a lo largo de ±axis con caída exponencial ──
nJ = 220_000
sgn = np.where(rng.uniform(size=nJ) < 0.5, 1.0, -1.0)
along = sgn * (rng.exponential(0.22, nJ))     # caída exponencial a lo largo del eje
along = np.clip(along, -0.85, 0.85)
rad = np.abs(rng.normal(0, 0.018, nJ)) * (1.0 + 2.0*np.abs(along))  # se ensancha al alejarse
aj = rng.uniform(0, 2*np.pi, nJ)
jet = axis*along[:,None] + (np.cos(aj)[:,None]*e1 + np.sin(aj)[:,None]*e2)*rad[:,None]
bj = np.exp(-np.abs(along)/0.4) * (0.5 + 0.5*rng.uniform(size=nJ))
parts.append((jet, np.clip(bj,0,1)))

pos = np.concatenate([p for p, _ in parts], 0).astype(np.float32)
bri = np.concatenate([b for _, b in parts], 0).astype(np.float32)
arr = np.concatenate([pos, bri[:,None]], 1)

import os
os.makedirs(os.path.dirname(OUT) or ".", exist_ok=True)
arr.astype(np.float32).tofile(OUT + ".bin")
print(f"[engine] {len(pos)} part (núcleo+toro+jets, eje {np.degrees(TILT):.0f}°) → {OUT}.bin ({arr.nbytes//1024//1024} MB)")
