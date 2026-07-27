#!/usr/bin/env python3
"""
silicio-corte-4k.py — LA VERSIÓN DEFINITIVA del corte 2D que sí gustó (v2).

Ian sobre SILICIO-CAMPOS-2D.mp4: "ESO SI SE MAMO". Y sobre esta versión pidió:
4K, más largo, y VOZ de cuenta cuentos narrando lo que se ve.

v2 — los 3 arreglos que salieron de VER el quick a ojo (frames s_f00060/170/290):
  1. ENCUADRE ABIERTO: el quick estaba 2× más cerrado que el video que gustó —
     una bola llenando el cuadro, cero ritmo. Ahora H=2.55·a (13.8 Å): se ven
     varias celdas = muchas mancuernas bailando, como el original.
  2. PERIODICIDAD REAL: el cristal dopado del cálculo ES periódico (supercelda
     FCC de cubo 2a). El volumen se calcula UNA vez sobre el cubo periódico
     [−a, a)³ y el corte lo muestrea con grid-wrap: encuadre ilimitado, física
     honesta (los donores se repiten cada 2a porque ASÍ es el modelo, 6.2%).
  3. NEGRO DE VERDAD: gamma |t|^1.45 antes de la LUT — el campo débil cae a
     negro (el quick tenía el fondo inundado de teal). El negro es el telón.

VOZ: lee dist-video/silicio-corte/timing.json (lo escribe silicio-corte-final.py
tras medir los wavs de Matilda). De ahí salen DUR y los cortes de acto — la
imagen obedece a la narración, no al revés (beats desde duraciones reales).

Etapas con CHECKPOINT: campos-<NV>.npz (iterar estética sin repetir química).
Frames a /mnt/e (NO al vhdx de C:, que crece y jamás devuelve — gotcha sparse).

Uso: python3 scripts/silicio-corte-4k.py [quick]
"""
import sys, os, json
import numpy as np

QUICK = 'quick' in sys.argv
A_SI = 5.431
BOHR = 0.529177210903
FPS = 24
W_PX, H_PX = (720, 1280) if QUICK else (2160, 3840)
NV = 96 if QUICK else 128            # lado del volumen (cubo periódico 2a)
OUT = os.path.join(os.path.dirname(__file__), '..', 'dist-video', 'silicio-corte')
FRAMES = '/mnt/e/forja-renders/silicio-corte-frames' if os.path.isdir('/mnt/e') else OUT
NPZ = os.path.join(OUT, f'campos-{NV}.npz')
TIMING = os.path.join(OUT, 'timing.json')
os.makedirs(OUT, exist_ok=True); os.makedirs(FRAMES, exist_ok=True)

# ── tiempos: de la narración si existe; si no, defaults de preview ──
if os.path.exists(TIMING):
    tj = json.load(open(TIMING))
    DUR = tj['dur']; T_DON = tj['don_at']; T_SPIN = tj['spin_at']; T_LOOP = tj['loop_at']
    print(f"timing.json: DUR={DUR:.1f}s · don@{T_DON:.1f} · spin@{T_SPIN:.1f} · loop@{T_LOOP:.1f}", flush=True)
else:
    DUR = 15 if QUICK else 44
    T_DON, T_SPIN, T_LOOP = 0.32*DUR, 0.64*DUR, 0.95*DUR
    print(f"sin timing.json → defaults DUR={DUR}s", flush=True)
NFR = int(round(FPS * DUR))

# ── encuadre: plano (110) que CONTIENE [111] (enlaces de perfil) ──
d1 = np.array([1.0, 1.0, 1.0]); d1 /= np.linalg.norm(d1)      # vertical de pantalla
d2 = np.array([1.0, -1.0, 0.0]); d2 /= np.linalg.norm(d2)     # horizontal
n_hat = np.cross(d1, d2); n_hat /= np.linalg.norm(n_hat)      # [11-2]: el viaje

H_A = A_SI * 2.55                    # ABIERTO: ~2.5 celdas de alto (fix #1)
W_A = H_A * 9 / 16
S_TRAVEL = A_SI * 0.55
L_PER = 2 * A_SI                     # período del cubo (supercelda FCC-2a)

# ══ ETAPA A: química sobre el CUBO PERIÓDICO [−a, a)³ ═════════════════
if not os.path.exists(NPZ):
    print(f"[A] SCF + volúmenes {NV}³ sobre cubo periódico {L_PER:.2f} Å…", flush=True)
    from pyscf.pbc import gto as pgto, dft as pdft
    from pyscf.pbc.dft import numint as pnumint
    from pyscf import gto as mgto, dft as mdft

    NS = 2
    prim = np.array([[0.0, A_SI/2, A_SI/2], [A_SI/2, 0.0, A_SI/2], [A_SI/2, A_SI/2, 0.0]])
    def build(dopado):
        sc = pgto.Cell(); sc.a = prim * NS
        base = [np.zeros(3), np.array([A_SI/4]*3)]
        atoms = []
        for i in range(NS):
            for j in range(NS):
                for k in range(NS):
                    sh = i*prim[0]+j*prim[1]+k*prim[2]
                    for b in base: atoms.append(['Si', tuple(b+sh)])
        if dopado: atoms[0][0] = 'P'
        sc.atom = atoms; sc.basis='gth-szv'; sc.pseudo='gth-pade'
        sc.unit='A'; sc.spin = 1 if dopado else 0; sc.verbose=0
        sc.build(); return sc

    sc_pu, sc_dp = build(False), build(True)
    mf_pu = pdft.RKS(sc_pu); mf_pu.xc='pbe'; mf_pu.max_cycle=80; mf_pu.kernel()
    mf_dp = pdft.UKS(sc_dp); mf_dp.xc='pbe'; mf_dp.max_cycle=120; mf_dp.kernel()
    assert mf_pu.converged and mf_dp.converged, "SCF no convergió — abortar"
    print("  SCF ✓", flush=True)

    # malla del cubo periódico: [−a, a) SIN repetir el borde (grid-wrap exige eso)
    g = -A_SI + np.arange(NV) * (L_PER / NV)
    GX, GY, GZ = np.meshgrid(g, g, g, indexing='ij')
    pts = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)
    dm_pu, dm_dp = mf_pu.make_rdm1(), mf_dp.make_rdm1()
    rho = np.zeros(len(pts)); ra = np.zeros(len(pts)); rb = np.zeros(len(pts))
    CH = 24000
    # (ao @ dm) * ao por filas = BLAS multinúcleo. El einsum 'pi,ij,pj->p'
    # ingenuo NO pasa por BLAS: corre en UN hilo (Ian: "según yo son cálculos
    # paralelos" — sí, y esta línea era el tapón).
    for i0 in range(0, len(pts), CH):
        sl = slice(i0, min(i0+CH, len(pts))); pb = pts[sl]/BOHR
        ao_pu = pnumint.eval_ao(sc_pu, pb); ao_dp = pnumint.eval_ao(sc_dp, pb)
        rho[sl] = ((ao_pu @ dm_pu) * ao_pu).sum(axis=1)
        ra[sl]  = ((ao_dp @ dm_dp[0]) * ao_dp).sum(axis=1)
        rb[sl]  = ((ao_dp @ dm_dp[1]) * ao_dp).sum(axis=1)
        if i0 % (CH*10) == 0: print(f"    densidades {i0/len(pts)*100:.0f}%", flush=True)

    # promolécula por PERFIL RADIAL (fix de velocidad: eval_gto por sitio a 2.1M
    # puntos era ~2 h; el átomo aislado es esférico → ρ_at(r) UNA vez en tabla
    # 1D y por sitio solo distancias + interp. Práctica estándar de promolécula.)
    print("  promolécula (perfil radial)…", flush=True)
    at = mgto.M(atom=[['Si',(0,0,0)]], basis='gth-szv', pseudo='gth-pade', spin=2, verbose=0)
    mat = mdft.UKS(at); mat.xc='pbe'; mat.max_cycle=80; mat.kernel()
    dm_at = mat.make_rdm1(); dm_at_t = dm_at[0] + dm_at[1]
    rr = np.geomspace(0.02, 9.0, 500)                       # Å
    # promediar sobre direcciones (el átomo 3p² no es perfectamente esférico)
    dirs = np.array([[1,0,0],[0,1,0],[0,0,1],[1,1,1]/np.sqrt(3),[1,-1,0]/np.sqrt(2)])
    prof = np.zeros_like(rr)
    for dvec in dirs:
        pr = rr[:,None]*dvec[None,:]/BOHR
        aoa = mgto.eval_gto(at, 'GTOval', pr)
        prof += np.einsum('pi,ij,pj->p', aoa, dm_at_t, aoa)
    prof /= len(dirs)
    # sitios de la red (traslaciones de supercelda que alcanzan el cubo + colas)
    sites0 = np.array([a[1] for a in sc_pu._atom]) * BOHR
    Tvecs = [i*(NS*prim[0])+j*(NS*prim[1])+k*(NS*prim[2])
             for i in range(-2,3) for j in range(-2,3) for k in range(-2,3)]
    sitios = []
    for T in Tvecs:
        for s in sites0:
            c = s + T
            if np.all(np.abs(c) < A_SI + 7.5): sitios.append(c)
    sitios = np.array(sitios)
    print(f"  {len(sitios)} sitios", flush=True)
    rho_pro = np.zeros(len(pts))
    for c in sitios:
        d = np.linalg.norm(pts - c[None,:], axis=1)
        rho_pro += np.interp(d, rr, prof, right=0.0)
    F_BOND = (rho - rho_pro).reshape(NV,NV,NV).astype(np.float32)
    F_DON  = ((ra+rb) - rho).reshape(NV,NV,NV).astype(np.float32)
    F_SPIN = (ra - rb).reshape(NV,NV,NV).astype(np.float32)
    np.savez_compressed(NPZ, bond=F_BOND, don=F_DON, spin=F_SPIN, L=L_PER)
    print(f"  ✓ checkpoint {NPZ}", flush=True)
else:
    print(f"[A] checkpoint: {NPZ}", flush=True)

dat = np.load(NPZ)
F = {'bond': dat['bond'], 'don': dat['don'], 'spin': dat['spin']}
NVr = F['bond'].shape[0]
print(f"  campos {NVr}³ · bond {F['bond'].min():+.4f}..{F['bond'].max():+.4f} · don máx {F['don'].max():+.4f} · spin máx {F['spin'].max():+.4f}", flush=True)

# ══ ETAPA B: frames 4K nativos ═════════════════════════════════════════
from scipy.ndimage import map_coordinates
from PIL import Image

def build_lut(stops):
    xs = np.array([s[0] for s in stops]); cs = np.array([s[1] for s in stops], dtype=np.float64)
    t = np.linspace(0, 1, 512)
    return np.stack([np.interp(t, xs, cs[:, k]) for k in range(3)], axis=1)
hx = lambda h: [int(h[i:i+2], 16)/255 for i in (0, 2, 4)]
LUT_CARGA = build_lut([(0.0, hx('7ce8ff')), (0.22, hx('1c6a8c')), (0.5, hx('000000')),
                       (0.68, hx('c8791a')), (0.88, hx('ffb03a')), (1.0, hx('fff4d0'))])
LUT_SPIN = build_lut([(0.0, hx('b48cff')), (0.28, hx('3a2a70')), (0.5, hx('000000')),
                      (0.70, hx('ff8a1e')), (1.0, hx('fff0c0'))])

VMAX = {k: float(np.percentile(np.abs(F[k]), 99.5)) for k in F}
GAMMA = 1.45                                     # fix #3: lo débil cae a NEGRO
print(f"  vmax { {k: round(v,5) for k,v in VMAX.items()} } · gamma {GAMMA}", flush=True)

u = np.linspace(-W_A/2, W_A/2, W_PX)
v = np.linspace(H_A/2, -H_A/2, H_PX)
UU, VV = np.meshgrid(u, v, indexing='xy')
# vignette suave (doctrina: 0.68) — foco al centro, esquinas caen
rn2 = (UU/(W_A/2))**2 + (VV/(H_A/2))**2
VIG = (1.0 - 0.30 * np.clip(rn2, 0, 1))[..., None]

def corte(field, s, zoom):
    P = (UU[..., None]*zoom)*d2[None,None,:] + (VV[..., None]*zoom)*d1[None,None,:] + s*n_hat[None,None,:]
    idx = (P + A_SI) / L_PER * NVr               # grid-wrap: periodicidad REAL
    return map_coordinates(field, [idx[...,0].ravel(), idx[...,1].ravel(), idx[...,2].ravel()],
                           order=1, mode='grid-wrap').reshape(H_PX, W_PX)

def smoothstep(a, b, x):
    t = np.clip((x - a) / max(b - a, 1e-9), 0, 1); return t*t*(3 - 2*t)

# actos en SEGUNDOS (de la narración) → pesos por frame
XF = 1.4   # s de crossfade de campo
def pesos(t):
    w_don  = smoothstep(T_DON, T_DON+XF, t) * (1 - smoothstep(T_SPIN, T_SPIN+XF, t))
    w_spin = smoothstep(T_SPIN, T_SPIN+XF, t) * (1 - smoothstep(T_LOOP, T_LOOP+XF, t))
    w_bond = 1.0 - w_don - w_spin
    return {'bond': w_bond, 'don': w_don, 'spin': w_spin}

# frames en PARALELO: cada frame es una función pura de i (Ian: "son cálculos
# paralelos" — estos también). 10 workers por fork comparten los campos sin
# copiarlos; el ruido va sembrado POR FRAME para que el orden no importe.
from multiprocessing import Pool

def render_frame(i):
    t = i / FPS; tau = i / NFR
    ws = pesos(t)
    # ── EL VIAJE OBEDECE A LA VOZ (fix del feedback "del 31 al 38 está oscuro"):
    # la nube del donor vive a ~1.5 Å del fósforo; con amplitud fija de 3 Å el
    # corte se le iba LEJOS justo cuando Matilda lo presentaba → negro. Ahora la
    # amplitud se ENCOGE en los actos del donor/espín: el corte se queda
    # rebanando al dopante (el anillo respira en cámara) y vuelve a barrer
    # grande al regresar al cristal. Los pesos ya son 0 en t=0 y t=DUR → loop ✓
    w_don, w_spin = ws['don'], ws['spin']
    amp = S_TRAVEL * (1.0 - 0.82 * w_don - 0.71 * w_spin)   # 3→0.54 Å con el donor
    s = amp * np.sin(2*np.pi * 2 * tau)                     # 2 ciclos → loop
    breathe = 1.0 - 0.09 * (1 - np.cos(2*np.pi * tau)) / 2  # 1 ciclo → loop
    # zoom-in íntimo cuando el protagonista es el dopante (la carga se VE)
    zoom = breathe * (1.0 - 0.26 * (w_don + w_spin))
    img = np.zeros((H_PX, W_PX)); w_spin_c = ws['spin']
    for name, w in ws.items():
        if w < 1e-3: continue
        img += w * corte(F[name], s, zoom) / VMAX[name]
    tt = np.clip(img, -1, 1)
    tt = np.sign(tt) * np.abs(tt)**GAMMA                  # fix #3
    idxl = np.clip(((tt*0.5 + 0.5) * 511), 0, 511).astype(np.int32)
    rgb = LUT_CARGA[idxl] * (1 - w_spin_c) + LUT_SPIN[idxl] * w_spin_c
    rgb *= VIG
    rng = np.random.default_rng(31 + i)                   # determinista por frame
    noise = rng.standard_normal((H_PX, W_PX, 1)) * (1.2/255)
    out = np.clip((rgb + noise) * 255, 0, 255).astype(np.uint8)
    Image.fromarray(out, 'RGB').save(f'{FRAMES}/f{i:05d}.png', compress_level=1)
    return i

NWORK = 10
print(f"[B] {NFR} frames {W_PX}×{H_PX} → {FRAMES} ({NWORK} workers)", flush=True)
with Pool(NWORK) as pool:
    for n, _ in enumerate(pool.imap_unordered(render_frame, range(NFR), chunksize=6)):
        if n % 150 == 0: print(f"    {n}/{NFR}", flush=True)

print(f"✓ frames en {FRAMES}", flush=True)
print("LISTO_FRAMES", flush=True)
