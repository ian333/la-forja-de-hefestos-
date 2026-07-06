#!/usr/bin/env python3
"""
precompute-o2-abinitio.py — LA FORMACION DEL ENLACE O2, DESDE LA CUANTICA REAL.

Reemplaza la caricatura LCAO (molecular-orbitals.ts: orbitales Slater a ojo) por
densidad electronica AB INITIO: PySCF resuelve la Schrodinger electronica del O2
(UHF/cc-pVTZ, estado base TRIPLETE 3-Sigma-g-, spin=2) a cada separacion R.

En vez de la densidad TOTAL (que revienta a blanco porque los cores 1s la dominan
y entierran el enlace) guardamos la DENSIDAD DE DEFORMACION:

    Delta-rho(r;R) = rho(O2 a R) - rho(promolecula)

donde promolecula = superposicion de densidades atomicas esfericas. Delta-rho es
EL ENLACE DESNUDO: positivo donde la carga se ACUMULA al enlazar (sigma en el eje,
pi en lobulos), negativo donde se VACIA. Los cores se cancelan -> solo se ve el
enlace, y como Delta-rho es acotado NO hay blowout.

Ademas la DENSIDAD DE ESPIN rho_alpha - rho_beta = los 2 electrones desapareados
en los pi* -> es lo que hace al O2 PARAMAGNETICO (birradical). Se dibuja violeta.

Muestreo LAGRANGIANO advectado: para cada R colocamos M particulas por inversa de
CDF condicional con SEMILLAS FIJAS -> al bajar R cada particula se desplaza suave
(la carga FLUYE al enlace, no parpadea). 3 nubes: acumulacion, vaciado, espin.

Salida .bin (little-endian):
  int32   N_acc, N_dep, N_spin, K
  float32 R_min, R_max
  float32[K]   Rvals            (bohr, descendente Rmax->Rmin)
  float32[K]   accMass          (integral Delta-rho+ dV total por R)
  float32[K]   depMass
  float32[K]   spinMass
  float32[K]   bondMass         (Delta-rho+ SOLO en el cilindro inter-nuclear ->
                                  crece monotonico al formarse el enlace: BRILLO)
  uint8[N_acc*3]     accColor   (rgb por particula: oro sigma -> ambar pi)
  int16[K*N_acc*3]   accPos     (bohr = pos/POSQ)   eje de enlace = x
  int16[K*N_dep*3]   depPos
  int16[K*N_spin*3]  spinPos

Uso:  python3 scripts/precompute-o2-abinitio.py [quick]
      quick -> rejilla chica + pocos R (validacion local rapida)
"""
import sys
import os
import struct
import numpy as np

QUICK = len(sys.argv) > 1 and sys.argv[1] == 'quick'

# ---- configuracion ----
BASIS = 'cc-pvtz'
BOHR = 0.529177210903          # A por bohr
RE = 1.20752 / BOHR            # long. de enlace MEDIDA (2.282 bohr)

if QUICK:
    K = 6
    N_ACC, N_DEP, N_SPIN = 4000, 2500, 2000
    NX, NY, NZ = 64, 44, 44
else:
    K = 48
    N_ACC, N_DEP, N_SPIN = 24000, 13000, 9000
    NX, NY, NZ = 104, 76, 76

R_MIN, R_MAX = 1.90, 4.80      # bohr (overshoot ~2.0 -> lejos 4.8)
LX, LR = 5.2, 3.7              # medio-caja (bohr): x=eje de enlace, y,z=perp
POSQ = 5000                    # int16: bohr = pos/POSQ  (rango +-6.5 bohr)
SEED = 20260630

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'precomputed', 'o2-abinitio.bin')

Rvals = R_MAX + (R_MIN - R_MAX) * (np.arange(K) / (K - 1))   # lejos -> cerca

# semillas fijas u_i en [0,1]^3 -> mismas en todo R (adveccion coherente).
# clouds distintas usan bloques distintos del stream para no correlacionarse.
rng = np.random.default_rng(SEED)
U_acc = rng.random((N_ACC, 3), dtype=np.float64)
U_dep = rng.random((N_DEP, 3), dtype=np.float64)
U_spin = rng.random((N_SPIN, 3), dtype=np.float64)

# ---- rejilla (centros de voxel) ----
dx = (2 * LX) / NX
dy = (2 * LR) / NY
dz = (2 * LR) / NZ
xs = -LX + (np.arange(NX) + 0.5) * dx
ys = -LR + (np.arange(NY) + 0.5) * dy
zs = -LR + (np.arange(NZ) + 0.5) * dz
GX, GY, GZ = np.meshgrid(xs, ys, zs, indexing='ij')          # (NX,NY,NZ)
GRID = np.stack([GX.ravel(), GY.ravel(), GZ.ravel()], axis=1)  # (NV,3)
NV = GRID.shape[0]
dV = dx * dy * dz
GPERP = np.hypot(GY, GZ)                                       # dist al eje x (NX,NY,NZ)


def eval_rhos(mol, dms, pts, chunk=40000):
    """Evalua VARIAS densidades rho_d(r)=sum_ij ao_i D^d_ij ao_j compartiendo el
    calculo de los orbitales atomicos ao(r) (se computan UNA vez por bloque).
    dms: lista de matrices densidad. Devuelve lista de arrays (pts,)."""
    outs = [np.empty(pts.shape[0]) for _ in dms]
    for s in range(0, pts.shape[0], chunk):
        ao = mol.eval_gto('GTOval', pts[s:s + chunk])          # (nb, nao)
        for d, dm in enumerate(dms):
            tmp = ao @ dm                                      # (nb, nao)
            outs[d][s:s + chunk] = np.einsum('pi,pi->p', tmp, ao)
    return outs


def sample_field(field, U):
    """Muestrea M particulas ~ field(r)>=0 por inversa de CDF condicional
    (x -> y|x -> z|x,y). field: (NX,NY,NZ) no-negativo. U: (M,3) en [0,1].
    Devuelve posiciones (M,3) en bohr, continuas (adveccion sin saltos)."""
    M = U.shape[0]
    f = np.maximum(field, 0.0)
    # CDF marginal x: masa por slab
    slab = f.sum(axis=(1, 2))                                   # (NX,)
    Cx = np.concatenate([[0.0], np.cumsum(slab)])               # (NX+1,)
    tot = Cx[-1]
    if tot <= 0:
        return np.zeros((M, 3))
    # x
    tgt = U[:, 0] * tot
    ix = np.searchsorted(Cx, tgt, side='right') - 1
    ix = np.clip(ix, 0, NX - 1)
    fx = ix + (tgt - Cx[ix]) / np.maximum(Cx[ix + 1] - Cx[ix], 1e-30)
    x = -LX + fx * dx
    # y | x
    colmass = f.sum(axis=2)                                     # (NX,NY)
    Cy = np.concatenate([np.zeros((NX, 1)), np.cumsum(colmass, axis=1)], axis=1)  # (NX,NY+1)
    Cy_row = Cy[ix]                                             # (M,NY+1)
    tgty = U[:, 1] * Cy_row[:, -1]
    iy = (Cy_row[:, :-1] <= tgty[:, None]).sum(axis=1) - 1
    iy = np.clip(iy, 0, NY - 1)
    cy0 = Cy_row[np.arange(M), iy]
    cy1 = Cy_row[np.arange(M), iy + 1]
    fy = iy + (tgty - cy0) / np.maximum(cy1 - cy0, 1e-30)
    y = -LR + fy * dy
    # z | x,y
    Cz = np.concatenate([np.zeros((NX, NY, 1)), np.cumsum(f, axis=2)], axis=2)    # (NX,NY,NZ+1)
    Cz_row = Cz[ix, iy]                                         # (M,NZ+1)
    tgtz = U[:, 2] * Cz_row[:, -1]
    iz = (Cz_row[:, :-1] <= tgtz[:, None]).sum(axis=1) - 1
    iz = np.clip(iz, 0, NZ - 1)
    cz0 = Cz_row[np.arange(M), iz]
    cz1 = Cz_row[np.arange(M), iz + 1]
    fz = iz + (tgtz - cz0) / np.maximum(cz1 - cz0, 1e-30)
    z = -LR + fz * dz
    return np.stack([x, y, z], axis=1)


def build():
    from pyscf import gto, scf
    accPos = np.zeros((K, N_ACC, 3), dtype=np.float64)
    depPos = np.zeros((K, N_DEP, 3), dtype=np.float64)
    spinPos = np.zeros((K, N_SPIN, 3), dtype=np.float64)
    accMass = np.zeros(K)
    depMass = np.zeros(K)
    spinMass = np.zeros(K)
    bondMass = np.zeros(K)

    print(f"=== O2 ab initio  {BASIS}  K={K}  rejilla {NX}x{NY}x{NZ}={NV} vox ===")
    print("R(bohr)  R(A)     E(Ha)        <S^2>   accMass  depMass  spinMass  bondMass")
    for k in range(K):
        R = float(Rvals[k])
        # eje de enlace = x
        mol = gto.M(atom=[['O', (-R / 2, 0, 0)], ['O', (R / 2, 0, 0)]],
                    basis=BASIS, spin=2, unit='Bohr', verbose=0)
        mf = scf.UHF(mol)
        mf.level_shift = 0.1
        mf.max_cycle = 200
        mf.kernel()
        if not mf.converged:                       # segundo intento robusto
            mf = scf.newton(scf.UHF(mol))
            mf.kernel()
        dm = mf.make_rdm1()                         # (2,nao,nao)
        dm_tot = dm[0] + dm[1]
        dm_spin = dm[0] - dm[1]
        dm_pro = scf.hf.init_guess_by_atom(mol)     # promolecula esferica (total)

        rho_mol, rho_pro, rho_s = (a.reshape(NX, NY, NZ) for a in
                                   eval_rhos(mol, [dm_tot, dm_pro, dm_spin], GRID))
        d_rho = rho_mol - rho_pro                   # DEFORMACION = el enlace

        accMass[k] = np.maximum(d_rho, 0).sum() * dV
        depMass[k] = np.maximum(-d_rho, 0).sum() * dV
        spinMass[k] = np.abs(rho_s).sum() * dV
        # BRILLO del enlace = densidad electronica REAL en el CENTRO del enlace (origen).
        # Crece MONOTONICO ~0.03->0.55 al acercarse los atomos (dato ab initio, no proxy):
        # es literalmente cuanta carga hay en medio del enlace -> enciende el enlace en el
        # render. (La Delta-rho+ integrada se contamina con nucleos/colas; rho_centro no.)
        bondMass[k] = float(eval_rhos(mol, [dm_tot], np.array([[0.0, 0.0, 0.0]]))[0][0])

        accPos[k] = sample_field(np.maximum(d_rho, 0), U_acc)
        depPos[k] = sample_field(np.maximum(-d_rho, 0), U_dep)
        spinPos[k] = sample_field(np.abs(rho_s), U_spin)

        ss = mf.spin_square()[0]
        print(f"{R:6.3f}  {R*BOHR:5.3f}  {mf.e_tot:12.5f}  {ss:5.2f}  "
              f"{accMass[k]:7.4f}  {depMass[k]:7.4f}  {spinMass[k]:7.4f}  {bondMass[k]:7.4f}")

    # color por particula: distingue las 3 REGIONES del enlace (mismo Delta-rho REAL,
    # coloreado por donde cae cada particula) -> el ENLACE RESALTA de los pares libres.
    # se decide en el equilibrio (k mas cercano a Re).
    kEq = int(np.argmin(np.abs(Rvals - RE)))
    xeq = accPos[kEq, :, 0]                                     # a lo largo del eje
    perp = np.hypot(accPos[kEq, :, 1], accPos[kEq, :, 2])       # dist al eje
    Rhalf = Rvals[kEq] / 2                                      # nucleos en +-Rhalf (eje x)
    t = np.clip(perp / 1.3, 0, 1)                              # 0=eje, 1=lobulo pi
    gold = np.array([1.00, 0.84, 0.36]); amber = np.array([1.00, 0.52, 0.15])
    whitegold = np.array([1.00, 0.96, 0.74])
    col = gold[None, :] * (1 - t[:, None]) + amber[None, :] * t[:, None]
    sigma = (np.abs(xeq) < Rhalf * 0.92) & (perp < 0.75)       # PUENTE sigma = el enlace
    col[sigma] = whitegold                                     # -> blanco-oro brillante
    lone = np.abs(xeq) > Rhalf * 1.08                          # PARES LIBRES (tras los nucleos)
    col[lone] = amber[None, :] * 0.62                          # -> atenuados (no compiten)
    accColor = np.clip(col * 255, 0, 255).astype(np.uint8)

    return accPos, depPos, spinPos, accMass, depMass, spinMass, bondMass, accColor


def write_bin(accPos, depPos, spinPos, accMass, depMass, spinMass, bondMass, accColor):
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as fp:
        fp.write(struct.pack('<4i', N_ACC, N_DEP, N_SPIN, K))
        fp.write(struct.pack('<2f', R_MIN, R_MAX))
        fp.write(Rvals.astype('<f4').tobytes())
        fp.write(accMass.astype('<f4').tobytes())
        fp.write(depMass.astype('<f4').tobytes())
        fp.write(spinMass.astype('<f4').tobytes())
        fp.write(bondMass.astype('<f4').tobytes())
        fp.write(accColor.astype(np.uint8).tobytes())
        q = lambda a: np.clip(np.round(a * POSQ), -32767, 32767).astype('<i2')
        fp.write(q(accPos).tobytes())
        fp.write(q(depPos).tobytes())
        fp.write(q(spinPos).tobytes())
    sz = os.path.getsize(OUT) / 1024 / 1024
    print(f"OK  {OUT}  {sz:.1f} MB")
    # copiar a dist/ si existe
    dist = OUT.replace('public/precomputed', 'dist/precomputed')
    try:
        os.makedirs(os.path.dirname(dist), exist_ok=True)
        import shutil; shutil.copyfile(OUT, dist)
    except Exception:
        pass


def validate_figure(accPos, depPos, spinPos):
    """proyeccion xy de la nube en el equilibrio -> confirma que trazan el enlace."""
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    kEq = int(np.argmin(np.abs(Rvals - RE)))
    fig, ax = plt.subplots(figsize=(7, 5), facecolor='black'); ax.set_facecolor('black')
    ax.scatter(depPos[kEq, :, 0], depPos[kEq, :, 1], s=1, c='#3aa0d0', alpha=0.30, label='vaciado')
    ax.scatter(accPos[kEq, :, 0], accPos[kEq, :, 1], s=1, c='#ffc24a', alpha=0.55, label='acumulacion (enlace)')
    ax.scatter(spinPos[kEq, :, 0], spinPos[kEq, :, 1], s=1, c='#c060ff', alpha=0.45, label='espin (pi* iman)')
    ax.plot([-RE / 2, RE / 2], [0, 0], 'o', color='#00ff88', ms=7)
    ax.set_aspect('equal'); ax.set_xlim(-4, 4); ax.set_ylim(-3, 3)
    ax.set_title(f'O2 en equilibrio (R={Rvals[kEq]*BOHR:.2f} A) — particulas ~ Delta-rho', color='white')
    lg = ax.legend(loc='upper right', framealpha=0.2, labelcolor='white', fontsize=8)
    for txt, col in zip(ax.get_xticklabels() + ax.get_yticklabels(), []): pass
    ax.tick_params(colors='white')
    p = os.path.join(os.path.dirname(__file__), '..', '_o2_proof', 'abinitio-particles.png')
    os.makedirs(os.path.dirname(p), exist_ok=True)
    plt.savefig(p, dpi=120, facecolor='black', bbox_inches='tight')
    print(f"figura: {p}")


if __name__ == '__main__':
    data = build()
    write_bin(*data)
    validate_figure(data[0], data[1], data[2])
