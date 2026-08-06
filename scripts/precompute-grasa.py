#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-grasa.py — UNA GRASA, CALCULADA: nubes de deformación + LÍNEAS DE CAMPO reales.

Por qué existe (2026-08-05). La pieza de la grasa se había hecho con `precompute-chain.ts`,
que NO calcula: arma la nube poniendo lóbulos σ a lo largo de cada enlace con longitudes de
libro. O sea, PINTA los enlaces. Ian: "nosotros no pintamos los enlaces, y además no veo el
cálculo del campo eléctrico". Las dos cosas son ciertas y las dos son de fondo.

Aquí no se pinta nada y no se inventa un motor:

  · DENSIDAD — RHF real. Δρ = ρ(molécula) − ρ(promolécula de átomos NEUTROS), que es el mismo
    método de `precompute-bond-abinitio.py` (O₂/N₂/C₂) y de `precompute-water-ring.py`. Las
    tres nubes de la serie salen de ahí, y el enlace EMERGE de la densidad:
        acc  = ρ^0.8        → oro/ámbar, el cuerpo
        spin = max(+Δρ, 0)  → magenta: donde la carga se ACUMULA = el enlace
        dep  = max(−Δρ, 0)  → azul: de dónde salió
  · CAMPO — `campo_lineas.py`, el motor de la casa: V = Σ Z/|r−R| − ∫ρ/|r−r'| con el gradiente
    analítico (`int1e_grids_ip`), siembra sobre la superficie molecular ρ=0.002 (Bader) y
    trazado bidireccional. NO se siembra en los núcleos y NO se corta por radio — los dos
    errores que ese archivo documenta haber pagado.
  · MUESTREO — `sample_field` lagrangiano con semillas fijas, el de la serie.

  python3 scripts/precompute-grasa.py butirico
  RAPIDO=1 python3 scripts/precompute-grasa.py butirico     # malla y líneas de prueba

Salida: public/precomputed/grasa-<n>.bin (nubes, formato WAP2) + grasa-<n>-efield.bin (campo).
"""
import os, sys, struct, math
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
BOHR = 0.529177210903
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PRE = os.path.join(RAIZ, 'public', 'precomputed')
RAPIDO = bool(os.environ.get('RAPIDO'))

NOMBRE = (sys.argv[1] if len(sys.argv) > 1 else 'butirico').lower()
BASE = os.environ.get('BASE', 'sto-3g' if RAPIDO else '6-31g')
PASO = float(os.environ.get('PASO', '0.32' if RAPIDO else '0.16'))       # Å entre nodos
N_ACC, N_DEP, N_SPIN = (24000, 9000, 9000) if RAPIDO else (108000, 40000, 40000)
NL_CAMPO = int(os.environ.get('NL', '90' if RAPIDO else '420'))          # líneas de campo
LP_CAMPO = 96                                                            # puntos por línea
POSQ = 2000.0
# EL ESCANEO — de átomos SUELTOS a molécula. Coordenada: expansión uniforme s desde el
# centroide (s=S_MAX todos separados → s=1 la molécula real). El motor interpola por R(t), así
# que la formación se VE: la densidad de enlace nace, el campo se reacomoda y los electrones
# fluyen (semillas fijas ⇒ cada partícula es LA MISMA entre cuadros).
#
# ⚠ HONESTIDAD, declarada como la declara precompute-bond-abinitio.py de su propio límite:
#   · Es un ESCANEO, no un mecanismo de reacción. Nadie forma una grasa así.
#   · RHF con la molécula estirada está SESGADO (la restricción de capa cerrada no describe
#     bien los enlaces rotos). Por eso el barrido se corta en s=1.9, donde los enlaces ya se
#     leen separados pero el SCF todavía converge a algo con sentido.
K = int(os.environ.get('K', '8' if RAPIDO else '24'))
S_MAX = float(os.environ.get('SMAX', '1.9'))
# más cuadros cerca de s=1, que es donde ocurre el nacimiento del enlace
ESCALAS = 1.0 + (S_MAX - 1.0) * (np.linspace(1.0, 0.0, K) ** 1.7)
# el motor busca por Rvals DESCENDENTE: s va de S_MAX (lejos) a 1 (formada)
N_DIR_SUP = 1200
RHO_SIEMBRA = 0.0002
R_FIN_RAYO = 14.0

# ── LA MOLÉCULA ──────────────────────────────────────────────────────────────────────────
# Ácido butírico C₄H₈O₂: la grasa más corta que la MANTEQUILLA contiene de verdad (le da su
# nombre —butyrum— y su olor). Geometría inicial de libro; la OPTIMIZA el cálculo, así que las
# distancias finales las decide la física, no la tabla.
GRASAS = {
    'butirico': {'nC': 4, 'nombre': 'ácido butírico', 'formula': 'C4H8O2'},
    'hexanoico': {'nC': 6, 'nombre': 'ácido hexanoico', 'formula': 'C6H12O2'},
}


def geometria_inicial(nC):
    """Zig-zag tetraédrico + cabeza de ácido, en Å. Es solo el PUNTO DE PARTIDA."""
    dCC, dCH, dCO2, dCO, dOH = 1.54, 1.09, 1.21, 1.34, 0.97
    dl = math.radians(35.26)
    dx, dy = dCC * math.cos(dl), dCC * math.sin(dl)
    at = [('C', np.array([i * dx, (i % 2) * dy, 0.0])) for i in range(nC)]
    def tetra(p, vecinos):
        if len(vecinos) == 1:
            a = vecinos[0]
            t = np.array([0., 1., 0.]) if abs(a[1]) < 0.9 else np.array([1., 0., 0.])
            u = np.cross(a, t); u /= np.linalg.norm(u)
            v = np.cross(a, u); v /= np.linalg.norm(v)
            ct, st = math.cos(math.radians(109.47)), math.sin(math.radians(109.47))
            return [a * ct + (u * math.cos(f) + v * math.sin(f)) * st for f in
                    (0, 2 * math.pi / 3, 4 * math.pi / 3)]
        b = -(vecinos[0] + vecinos[1]); b /= np.linalg.norm(b)
        n = np.cross(vecinos[0], vecinos[1]); n /= np.linalg.norm(n)
        h = math.radians(54.75)
        return [b * math.cos(h) + n * math.sin(h), b * math.cos(h) - n * math.sin(h)]
    salida = list(at)
    for i in range(nC):
        if i == nC - 1:
            continue                                  # el de la punta lleva el ácido
        p = at[i][1]
        vec = []
        if i > 0: vec.append((at[i - 1][1] - p) / np.linalg.norm(at[i - 1][1] - p))
        if i < nC - 1: vec.append((at[i + 1][1] - p) / np.linalg.norm(at[i + 1][1] - p))
        for d in tetra(p, vec):
            salida.append(('H', p + d / np.linalg.norm(d) * dCH))
    # cabeza de ácido, en el plano de la cadena
    p = at[nC - 1][1]
    u = at[nC - 2][1] - p; u /= np.linalg.norm(u)
    v = np.cross(np.array([0., 0., 1.]), u); v /= np.linalg.norm(v)
    a = math.radians(118.5)
    pO2 = p + (u * math.cos(a) + v * math.sin(a)) * dCO2
    pO1 = p + (u * math.cos(-a) + v * math.sin(-a)) * dCO
    salida += [('O', pO2), ('O', pO1)]
    w = pO1 - p; w /= np.linalg.norm(w)
    wp = np.cross(np.array([0., 0., 1.]), w); wp /= np.linalg.norm(wp)
    ah = math.pi - math.radians(106)
    salida.append(('H', pO1 + (w * math.cos(ah) - wp * math.sin(ah)) * dOH))
    return salida


def optimiza(atomos):
    """La GEOMETRÍA la decide el cálculo (geomeTRIC sobre RHF), no la tabla de libro."""
    from pyscf import gto, scf
    from pyscf.geomopt.geometric_solver import optimize
    cache = os.path.join(PRE, f'geom-grasa-{NOMBRE}.npy')
    simb = [s for s, _ in atomos]
    if os.path.exists(cache):
        print('   geometría: del caché', flush=True)
        return simb, np.load(cache)
    mol = gto.M(atom=[[s, tuple(p)] for s, p in atomos], basis='sto-3g', unit='Angstrom', verbose=0)
    print(f'   optimizando {len(atomos)} átomos (sto-3g)…', flush=True)
    eq = optimize(scf.RHF(mol), maxsteps=60)
    xyz = eq.atom_coords() * BOHR
    np.save(cache, xyz)
    return simb, xyz


def sample_field(f, U, lo, paso):
    """Muestreador LAGRANGIANO de la casa (precompute-water-ring.py): inverso de la CDF por
    ejes con semillas fijas. No se escribe uno nuevo."""
    nx, ny, nz = f.shape
    M = U.shape[0]
    f = np.maximum(f, 0.0)
    Cx = np.concatenate([[0.0], np.cumsum(f.sum(axis=(1, 2)))])
    if Cx[-1] <= 0:
        return np.zeros((M, 3))
    t = U[:, 0] * Cx[-1]
    ix = np.clip(np.searchsorted(Cx, t, side='right') - 1, 0, nx - 1)
    x = lo[0] + (ix + (t - Cx[ix]) / np.maximum(Cx[ix + 1] - Cx[ix], 1e-30)) * paso
    cm = f.sum(axis=2)
    Cy = np.concatenate([np.zeros((nx, 1)), np.cumsum(cm, axis=1)], axis=1)[ix]
    ty = U[:, 1] * Cy[:, -1]
    iy = np.clip((Cy[:, :-1] <= ty[:, None]).sum(axis=1) - 1, 0, ny - 1)
    c0, c1 = Cy[np.arange(M), iy], Cy[np.arange(M), iy + 1]
    y = lo[1] + (iy + (ty - c0) / np.maximum(c1 - c0, 1e-30)) * paso
    zc = f[ix, iy]
    Cz = np.concatenate([np.zeros((M, 1)), np.cumsum(zc, axis=1)], axis=1)
    tz = U[:, 2] * Cz[:, -1]
    iz = np.clip((Cz[:, :-1] <= tz[:, None]).sum(axis=1) - 1, 0, nz - 1)
    d0, d1 = Cz[np.arange(M), iz], Cz[np.arange(M), iz + 1]
    z = lo[2] + (iz + (tz - d0) / np.maximum(d1 - d0, 1e-30)) * paso
    return np.stack([x, y, z], axis=1)


def main():
    if NOMBRE not in GRASAS:
        sys.exit(f'grasa desconocida: {NOMBRE}. Opciones: {list(GRASAS)}')
    cfg = GRASAS[NOMBRE]
    print(f'═══ {cfg["nombre"].upper()} ({cfg["formula"]}) — la grasa de la mantequilla ═══\n', flush=True)
    from pyscf import gto, scf
    from campo_lineas import (CampoMEP, superficie_molecular, superficie_en_rayos,
                              sembrar_por_flujo, trazar_bidireccional, intensidad_u8)

    simb, xyz = optimiza(geometria_inicial(cfg['nC']))
    xyz = xyz - xyz.mean(axis=0)
    Zs = np.array([{'H': 1, 'C': 6, 'O': 8}[s] for s in simb])

    # ── PROMOLÉCULA: la de la casa, en UNA línea ────────────────────────────────────────
    # `init_guess_by_atom` es la densidad de átomos NEUTROS ESFÉRICAMENTE PROMEDIADA, y es
    # exactamente lo que usa precompute-bond-abinitio.py (O₂/N₂/C₂). La había armado a mano
    # con UHF por átomo, y ahí estaba el error: el carbono y el oxígeno en ³P NO son esféricos,
    # así que cada uno metía la orientación arbitraria que eligió su SCF. Ese ruido no se
    # cancela ni con los átomos separados — medido: ∫Δρ>0 = 3.1 con la molécula ya deshecha,
    # cuando por definición debería tender a 0. Copiar al ganador, otra vez, era la respuesta.
    mol1 = gto.M(atom=[[simb[i], tuple(xyz[i])] for i in range(len(xyz))],
                 basis=BASE, unit='Angstrom', verbose=0)

    # ── MALLA FIJA para TODO el barrido (cubre la geometría más ABIERTA) ────────────────
    lo = xyz.min(axis=0) * S_MAX - 3.2
    hi = xyz.max(axis=0) * S_MAX + 3.2
    ns = [int(math.ceil((hi[k] - lo[k]) / PASO)) for k in range(3)]
    G = np.stack(np.meshgrid(*[lo[k] + np.arange(ns[k]) * PASO for k in range(3)],
                             indexing='ij'), axis=-1).reshape(-1, 3)
    print(f'   malla FIJA {ns[0]}×{ns[1]}×{ns[2]} = {len(G)} nodos (cubre s={S_MAX})', flush=True)
    dV = (PASO / BOHR) ** 3

    # semillas FIJAS: cada partícula es LA MISMA en todos los cuadros → la carga FLUYE
    r = np.random.default_rng(1337)
    U = {k: r.random((n, 3)) for k, n in (('acc', N_ACC), ('dep', N_DEP), ('spin', N_SPIN))}

    # ── RAYOS DEL CAMPO: se eligen UNA vez, en el cuadro FORMADO (s=1) ──────────────────
    print('\n   ── eligiendo rayos del campo en la molécula formada ──', flush=True)
    mf1 = scf.RHF(mol1); mf1.max_cycle = 200; mf1.kernel()
    c1 = CampoMEP(mol1, mf1.make_rdm1())
    sup1 = superficie_molecular(c1, n_dir=N_DIR_SUP, rho_c=RHO_SIEMBRA, r_fin=R_FIN_RAYO)
    idx, Phi0, _ = sembrar_por_flujo(c1, sup1, NL_CAMPO)
    ia_r, id_r = sup1['ray'][0][idx], sup1['ray'][1][idx]
    NL = len(idx)
    print(f'   {NL} líneas · Φ₀={Phi0:.4f} (se REUSAN en todos los cuadros → cero parpadeo)', flush=True)

    # PARES ENLAZADOS en la geometría de equilibrio (por distancia): son los sitios donde,
    # si el enlace nace, la carga se tiene que acumular.
    pares = []
    for i in range(len(xyz)):
        for j in range(i + 1, len(xyz)):
            dij = np.linalg.norm(xyz[i] - xyz[j])
            if dij < (1.75 if (Zs[i] > 1 and Zs[j] > 1) else 1.30):
                pares.append((i, j))
    print(f'   {len(pares)} enlaces detectados en la geometría de equilibrio', flush=True)
    ijk = np.stack(np.meshgrid(*[np.arange(n) for n in ns], indexing='ij'), -1).reshape(-1, 3)
    Gxyz = lo + ijk * PASO

    P = {k: np.zeros((K, len(U[k]), 3)) for k in U}
    nucK = np.zeros((K, len(xyz), 3))
    bond = np.zeros(K)
    Lk = np.zeros((K, NL, LP_CAMPO, 3), np.float32)
    Ik = np.zeros((K, NL, LP_CAMPO), np.uint8)

    print(f'\n   ── BARRIDO: {K} cuadros, s de {ESCALAS[0]:.2f} a {ESCALAS[-1]:.2f} ──', flush=True)
    print('   k    s     E(Ha)        ∫Δρ>0   líneas', flush=True)
    dm_prev = None
    for k, sc in enumerate(ESCALAS):
        g = xyz * sc
        m = gto.M(atom=[[simb[i], tuple(g[i])] for i in range(len(g))],
                  basis=BASE, unit='Angstrom', verbose=0)
        # UHF, no RHF: la capa cerrada restringida NO describe enlaces estirados (es la falla
        # clásica de disociación de RHF, la misma que precompute-bond-abinitio.py declara para
        # su límite a R grande). Medido aquí: con RHF el ∫Δρ>0 BAJABA al formarse —5.89 sueltos
        # contra 4.81 formada— o sea que el enlace se veía DESAPARECER, y en s=1.9 el SCF ni
        # convergía. Con UHF y ruptura de simetría el estirado se describe bien.
        mfk = scf.UHF(m); mfk.max_cycle = 300; mfk.level_shift = 0.1
        mfk.kernel(dm0=dm_prev if k else None)
        if not mfk.converged:
            mfk = mfk.newton().run()
        dmk = mfk.make_rdm1()
        dmk = dmk[0] + dmk[1] if np.ndim(dmk) == 3 else dmk
        dm_prev = mfk.make_rdm1()
        dm_pro_k = scf.hf.init_guess_by_atom(m)      # promolécula EN ESTA geometría
        rm = np.empty(len(G)); rp = np.empty(len(G))
        # la promolécula se evalúa en la MISMA geometría estirada (átomos libres en su sitio)
        for a0 in range(0, len(G), 40000):
            ao = m.eval_gto('GTOval', G[a0:a0 + 40000] / BOHR)
            rm[a0:a0 + 40000] = np.einsum('pi,pi->p', ao @ dmk, ao)
            rp[a0:a0 + 40000] = np.einsum('pi,pi->p', ao @ dm_pro_k, ao)
        rho = np.maximum(rm, 0).reshape(ns)
        drho = (rho.ravel() - np.maximum(rp, 0)).reshape(ns)
        # LA CARGA DEL ENLACE, no la del espacio entero. El ∫Δρ>0 global tiene un PISO que no
        # es enlace: `init_guess_by_atom` promedia el átomo a esférico y el C/O reales (³P) no
        # lo son, así que sobra ~2.3 e⁻ aunque los átomos estén sueltos. Medido: con el global,
        # el número BAJABA al formarse y el gate reprobaba una física que estaba bien. Aquí se
        # suma Δρ>0 sólo en bolas de 0.40 Å alrededor de los puntos medios de los enlaces —
        # que es donde la teoría dice que se acumula la carga al enlazar.
        dpos = np.maximum(drho, 0).ravel()
        mask = np.zeros(len(Gxyz), bool)
        for (i, j) in pares:
            mid = (g[i] + g[j]) / 2.0
            mask |= ((Gxyz - mid) ** 2).sum(1) < 0.40 ** 2
        bond[k] = float(dpos[mask].sum() * dV)
        P['acc'][k] = sample_field(np.power(rho, 0.8), U['acc'], lo, PASO)
        P['dep'][k] = sample_field(np.maximum(-drho, 0), U['dep'], lo, PASO)
        P['spin'][k] = sample_field(np.maximum(drho, 0), U['spin'], lo, PASO)
        nucK[k] = g
        ck = CampoMEP(m, dmk)
        S_, hay, _ = superficie_en_rayos(ck, ia_r, id_r, N_DIR_SUP, rho_c=RHO_SIEMBRA, r_fin=R_FIN_RAYO)
        L_, largo, viva, nE, _, _ = trazar_bidireccional(ck, S_, LP=LP_CAMPO)
        Lk[k] = L_; Ik[k] = intensidad_u8(nE)
        print(f'   {k:2d} {sc:5.2f}  {mfk.e_tot:11.4f}  {bond[k]:6.3f}  {int(viva.sum()):4d}/{NL}'
              f'{"" if mfk.converged else "   ⚠ SCF no convergió"}', flush=True)

    # ── ESCRITURA: los formatos de la casa, sin variantes ───────────────────────────────
    # Rvals = la escala s, DESCENDENTE (el motor busca el bracket asumiendo orden descendente,
    # igual que O₂ con su R). Así R(t) grande = átomos separados, R(t)→1 = molécula formada.
    q = lambda a: np.clip(np.round(np.asarray(a) * POSQ), -32767, 32767).astype('<i2')
    gold, amber, wgold = np.array([1., .70, .14]), np.array([1., .24, .03]), np.array([1., .82, .42])
    # el color de `acc` se fija en el cuadro FORMADO y viaja con la partícula (correspondencia
    # lagrangiana): así el punto que termina en un enlace ya venía siendo el mismo desde lejos.
    accf = P['acc'][-1] / BOHR
    pesf = (nucK[-1] / BOHR)[Zs > 1]
    d = np.empty(len(accf))
    for a0 in range(0, len(accf), 20000):
        d[a0:a0 + 20000] = np.sqrt(((accf[a0:a0 + 20000, None, :] - pesf[None]) ** 2).sum(2)).min(1)
    t = np.clip((d - 0.55) / 1.85, 0, 1)[:, None]
    col = gold * (1 - t) + amber * t
    col[d < 0.55] = wgold
    Rv = np.ascontiguousarray(ESCALAS, dtype='<f4')

    out = os.path.join(PRE, f'grasa-{NOMBRE}.bin')
    with open(out, 'wb') as f:
        f.write(struct.pack('<4s7i', b'WAP2', N_ACC, N_DEP, N_SPIN, K, len(xyz), 0, 0))
        f.write(struct.pack('<3f', POSQ, float(Rv[-1]), float(Rv[0])))
        f.write(Rv.tobytes())
        f.write(np.ascontiguousarray(bond, dtype='<f4').tobytes())
        f.write(np.clip(col * 255, 0, 255).astype(np.uint8).tobytes())
        f.write(Zs.astype('<i2').tobytes())
        for a0 in ('acc', 'dep', 'spin'):
            f.write(q(P[a0] / BOHR).tobytes())
        f.write(q(nucK / BOHR).tobytes())
    print(f'\n   OK  grasa-{NOMBRE}.bin  {os.path.getsize(out)/1024/1024:.2f} MB  '
          f'({K} cuadros · Δρ>0 de {bond[0]:.3f} (sueltos) a {bond[-1]:.3f} (formada))', flush=True)

    oute = os.path.join(PRE, f'grasa-{NOMBRE}-efield.bin')
    with open(oute, 'wb') as f:
        f.write(struct.pack('<3i', K, NL, LP_CAMPO))
        f.write(Rv.tobytes())
        f.write(np.clip(np.round(Lk * 2000), -32767, 32767).astype('<i2').tobytes())
        f.write(np.ascontiguousarray(Ik, dtype=np.uint8).tobytes())
    print(f'   OK  grasa-{NOMBRE}-efield.bin  {os.path.getsize(oute)/1024/1024:.2f} MB '
          f'({NL} líneas × {LP_CAMPO} × {K} cuadros)', flush=True)

    # GATE: el enlace tiene que NACER. Si la carga acumulada no crece al juntarse, no hay pieza.
    crece = bond[-1] / max(bond[0], 1e-9)
    print(f'\n   GATE formación: carga EN LOS ENLACES ×{crece:.2f} '
          f'({bond[0]:.3f} sueltos → {bond[-1]:.3f} formada) '
          f'{"✓ el enlace NACE" if crece > 1.6 else "✗ NO se ve nacer el enlace"}', flush=True)
    return 0 if crece > 1.6 else 1


if __name__ == '__main__':
    sys.exit(main())
