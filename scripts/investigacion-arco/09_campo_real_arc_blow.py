#!/usr/bin/env python3
"""
09 · El campo magnetico REAL del banco en el arco: arc blow y apuntar.

Que hace (todo en SI):
  1. Porta a numpy la formula de segmento finito de src/lib/physics/em.ts (fieldBFromSegment, Griffiths 5.36,
     mismo eps = 1e-6) y la valida contra formulas cerradas.
  2. Arma la red electrica completa: placa 100x50x3 mm como malla de segmentos (resistiva en DC; PEEC con
     inductancias parciales a 670 Hz), cables / barras / antorcha / alambre / arco como segmentos en serie.
     La corriente se reparte en la placa por Kirchhoff (DC) o por impedancia R + jwL (AC).
  3. Geometrias del banco: A (cables sueltos, banco v1), B (base compacta, barras paralelas, contacto bajo la
     placa), C (retorno coaxial / simetrico).  Para cada una: B transversal en la columna y en la gota, fuerza de
     Lorentz por mm, fuerza en la gota, numero Pi = B_ext / B_propio(L), deflexion del arco (modelo de chorro),
     y como cambia con la onda 40 A + 30 A a 670 Hz (la parte AC se reparte distinto en la placa).
  4. Monte Carlo de ruteos sueltos (A), mapas contra la posicion del arco (B, C).
  5. Placa ferromagnetica (mu_r 100 / 300, con y sin hoyo caliente bajo el arco): metodo de cargas magneticas
     en celdas, para saber cuanto cambia el campo de vacio.
  6. Apuntar: bobinas independientes contra bobinas en serie con el arco; B, NI, potencia; y lo que ese
     mismo campo le hace al ARCO (no solo a la gota).
  7. Tabla de B en rejilla alrededor del arco para la configuracion B1 (valida el visualizador de la app).

Corre:  python3 09_campo_real_arc_blow.py > 09_campo_real_arc_blow.out   (~2.5 min en iangpu libre; 8 min con carga 38)
"""
import math, time, sys
import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

T0 = time.time()
MU0 = 1.25663706212e-6          # el mismo de src/lib/physics/constants.ts
mm = 1e-3
RHO_CU = 1.72e-8                # ohm m
RHO_FE_FRIO = 1.5e-7            # acero dulce a 20 C (ohm m)
RHO_FE_CAL = 5.0e-7             # acero promedio caliente (~400-500 C)

# ---- canon (scripts/canon/*) ----
SIG, RHO_L = 1.5, 7000.0
A_GOTA = 0.46e-3                # radio de gota, f2 = 668 Hz
M_GOTA = RHO_L * 4 / 3 * math.pi * A_GOTA ** 3
L_ARCO = 2.0e-3                 # separacion / largo de arco del canon (gap 2 mm)
STICK = 10.0e-3                 # extension del alambre (stick-out), supuesto
F_ONDA = 668.0                  # la onda a f2 (~670 Hz)
I0, I1 = 40.0, 30.0             # base + onda
G = 9.81
F2 = math.sqrt(8 * SIG / (RHO_L * A_GOTA ** 3)) / (2 * math.pi)
F1 = 0.5 * F2                   # SUPUESTO del canon: mecerse l=1 a f2/2
Q1 = 30.0

def hdr(t):
    print()
    print("=" * 100)
    print(t)
    print("=" * 100)

# =====================================================================================================
# 1. PUERTO DE em.ts  (fieldBFromSegment, vectorizado; admite corrientes complejas)
# =====================================================================================================
def campo_B(P, R1, R2, I, eps=1e-6, chunk=4000):
    """B (T) en los puntos P (M,3) de los segmentos R1->R2 (N,3) con corriente I (N,) [A].
    Linea por linea la formula de em.ts: d con eps, sin(theta1), sin(theta2), direccion Lhat x perp_hat."""
    P = np.atleast_2d(np.asarray(P, float)); R1 = np.atleast_2d(R1); R2 = np.atleast_2d(R2)
    I = np.asarray(I)
    out = np.zeros((P.shape[0], 3), dtype=np.result_type(I.dtype, float))
    L = R2 - R1
    Llen = np.sqrt((L ** 2).sum(1))
    ok = Llen >= eps
    R1, L, Llen, I = R1[ok], L[ok], Llen[ok], I[ok]
    Lhat = L / Llen[:, None]
    for s in range(0, R1.shape[0], chunk):
        r1 = R1[s:s + chunk]; lh = Lhat[s:s + chunk]; ll = Llen[s:s + chunk]; ii = I[s:s + chunk]
        a = P[:, None, :] - r1[None, :, :]
        tF = (a * lh[None]).sum(-1)
        perp = a - tF[..., None] * lh[None]
        d = np.sqrt((perp ** 2).sum(-1) + eps * eps)
        s1 = (-tF) / np.sqrt(tF * tF + d * d + eps * eps)
        s2 = (ll[None] - tF) / np.sqrt((ll[None] - tF) ** 2 + d * d + eps * eps)
        Bmag = (MU0 / (4 * math.pi * d)) * (s2 - s1)
        ph = perp / d[..., None]
        dirv = np.cross(np.broadcast_to(lh[None], ph.shape), ph)
        out = out + np.einsum('mnk,mn,n->mk', dirv, Bmag, ii)
    return out

def segs_de_polilinea(pts, I):
    pts = np.asarray(pts, float)
    return pts[:-1], pts[1:], np.full(len(pts) - 1, I)

hdr("1. PUERTO DE em.ts A PYTHON: validacion contra formulas cerradas (I = 40 A)")
I = 40.0
# alambre largo
B = campo_B([[0, 0.01, 0]], np.array([[-10.0, 0, 0]]), np.array([[10.0, 0, 0]]), np.array([I]))
print(f"  alambre recto de 20 m a d = 10 mm      : {np.linalg.norm(B)*1e3:.6f} mT   (mu0 I/2pi d = {MU0*I/(2*math.pi*0.01)*1e3:.6f} mT)")
# extremo de alambre semi-infinito
B = campo_B([[0, 0.01, 0]], np.array([[-10.0, 0, 0]]), np.array([[0.0, 0, 0]]), np.array([I]))
print(f"  alambre que termina al pie, d = 10 mm  : {np.linalg.norm(B)*1e3:.6f} mT   (mu0 I/4pi d = {MU0*I/(4*math.pi*0.01)*1e3:.6f} mT)")
# espira cuadrada de lado s, centro
s_ = 0.1
sq = np.array([[-s_/2, -s_/2, 0], [s_/2, -s_/2, 0], [s_/2, s_/2, 0], [-s_/2, s_/2, 0], [-s_/2, -s_/2, 0]])
r1, r2, ii = segs_de_polilinea(sq, I)
B = campo_B([[0, 0, 0]], r1, r2, ii)
print(f"  espira cuadrada 100 mm, centro         : {B[0,2]*1e3:.6f} mT   (2 sqrt2 mu0 I/(pi s) = {2*math.sqrt(2)*MU0*I/(math.pi*s_)*1e3:.6f} mT)")
# espira circular (48 lados) en el eje
def espira(c, eje, R, n=48):
    c = np.asarray(c, float); eje = np.asarray(eje, float); eje = eje / np.linalg.norm(eje)
    u = np.cross(eje, [0, 0, 1.0]) if abs(eje[2]) < 0.9 else np.cross(eje, [1.0, 0, 0])
    u /= np.linalg.norm(u); v = np.cross(eje, u)
    th = np.linspace(0, 2 * math.pi, n + 1)
    return c + R * (np.cos(th)[:, None] * u + np.sin(th)[:, None] * v)
pts = espira([0, 0, 0], [0, 0, 1], 0.01, 360)
r1, r2, ii = segs_de_polilinea(pts, I)
B = campo_B([[0, 0, 0.005]], r1, r2, ii)
print(f"  espira R = 10 mm (360 lados), eje z=5mm : {B[0,2]*1e3:.6f} mT   (mu0 I R^2/2(R^2+z^2)^1.5 = {MU0*I*1e-4/(2*(1e-4+25e-6)**1.5)*1e3:.6f} mT)")
# punto sobre el eje del propio segmento: em.ts devuelve 0 (perp = 0 -> direccion 0)
B = campo_B([[0, 0, 0.001]], np.array([[0, 0, 0.0]]), np.array([[0, 0, 0.002]]), np.array([I]))
print(f"  punto SOBRE el eje del segmento (arco)  : {np.linalg.norm(B):.3e} T  (em.ts da 0: el campo propio del arco no empuja su eje)")

# =====================================================================================================
# 2. RED: placa como malla + conductores; solucion DC (Kirchhoff) y AC (PEEC: R + jw L_parcial)
# =====================================================================================================
class Red:
    def __init__(self):
        self.P = []; self.n1 = []; self.n2 = []; self.R = []; self.gmd = []; self.tipo = []; self.etq = []
    def nodo(self, p):
        self.P.append(np.asarray(p, float)); return len(self.P) - 1
    def rama(self, a, b, R, gmd, tipo, etq=""):
        self.n1.append(a); self.n2.append(b); self.R.append(R); self.gmd.append(gmd); self.tipo.append(tipo); self.etq.append(etq)
    def cable(self, n_ini, pts, n_fin=None, area=16e-6, tipo="cobre", etq=""):
        """polilinea desde el nodo n_ini por los puntos pts (m); si n_fin, cierra en ese nodo."""
        r = math.sqrt(area / math.pi); gmd = 0.7788 * r
        prev = n_ini
        for p in pts:
            n = self.nodo(p)
            ln = np.linalg.norm(self.P[n] - self.P[prev])
            self.rama(prev, n, max(RHO_CU * ln / area, 1e-7), gmd, tipo, etq)
            prev = n
        if n_fin is not None:
            ln = np.linalg.norm(self.P[n_fin] - self.P[prev])
            self.rama(prev, n_fin, max(RHO_CU * ln / area, 1e-7), gmd, tipo, etq)
            prev = n_fin
        return prev
    def arrays(self):
        P = np.array(self.P)
        return P, np.array(self.n1), np.array(self.n2), np.array(self.R), np.array(self.gmd), np.array(self.tipo)

PLACA_LX, PLACA_LY, PLACA_T = 100 * mm, 50 * mm, 3 * mm
ZC = -PLACA_T / 2      # plano medio de la placa (la cara de arriba es z = 0)

def placa(red, h=2.5 * mm, rho=RHO_FE_FRIO, Lx=PLACA_LX, Ly=PLACA_LY, t=PLACA_T):
    nx = int(round(Lx / h)) + 1; ny = int(round(Ly / h)) + 1
    xs = -Lx / 2 + h * np.arange(nx); ys = -Ly / 2 + h * np.arange(ny)
    idx = np.zeros((ny, nx), int)
    for j in range(ny):
        for i in range(nx):
            idx[j, i] = red.nodo([xs[i], ys[j], ZC])
    for j in range(ny):
        w = h / 2 if j in (0, ny - 1) else h
        for i in range(nx - 1):
            red.rama(idx[j, i], idx[j, i + 1], rho * h / (w * t), 0.2235 * (w + t), "placa")
    for i in range(nx):
        w = h / 2 if i in (0, nx - 1) else h
        for j in range(ny - 1):
            red.rama(idx[j, i], idx[j + 1, i], rho * h / (w * t), 0.2235 * (w + t), "placa")
    return dict(idx=idx, xs=xs, ys=ys, h=h)

def nodo_placa(pl, x, y):
    i = int(round((x - pl["xs"][0]) / pl["h"])); j = int(round((y - pl["ys"][0]) / pl["h"]))
    return pl["idx"][j, i]

def Fpar(s, d):
    return s * np.arcsinh(s / d) - np.sqrt(s * s + d * d)

def L_parcial(P, n1, n2, gmd):
    """matriz de inductancias parciales (Neumann, filamentos paralelos). Solo ramas alineadas a ejes."""
    nb = len(n1)
    Lm = np.zeros((nb, nb))
    D = P[n2] - P[n1]
    ax = np.argmax(np.abs(D), 1)
    lens = np.abs(D).max(1)
    resid = np.sqrt((D ** 2).sum(1) - lens ** 2)
    assert np.all(resid < 1e-9), "rama no alineada a un eje"
    for a in range(3):
        sel = np.where(ax == a)[0]
        if len(sel) == 0: continue
        o = [k for k in range(3) if k != a]
        u1 = P[n1[sel], a]; u2 = P[n2[sel], a]
        sgn = np.sign(u2 - u1)
        lo = np.minimum(u1, u2); hi = np.maximum(u1, u2)
        tr = P[n1[sel]][:, o]
        dd = np.sqrt(((tr[:, None, :] - tr[None, :, :]) ** 2).sum(-1))
        dd = np.maximum(dd, 1e-9)
        np.fill_diagonal(dd, gmd[sel])
        A1, A2 = lo[:, None], hi[:, None]; B1, B2 = lo[None, :], hi[None, :]
        M = (MU0 / (4 * math.pi)) * (Fpar(A2 - B1, dd) - Fpar(A2 - B2, dd) - Fpar(A1 - B1, dd) + Fpar(A1 - B2, dd))
        M *= sgn[:, None] * sgn[None, :]
        Lm[np.ix_(sel, sel)] = M
    return Lm

def resolver(red, n_mas, n_menos, f=0.0, ks=1.0, Lm=None):
    """corriente unitaria entrando por n_mas (terminal + de la fuente) y saliendo por n_menos.
    Devuelve corrientes de rama (por ampere de la fuente) y Z del lazo visto por la fuente."""
    P, n1, n2, R, gmd, tipo = red.arrays()
    nb, nn = len(n1), len(P)
    grado = np.bincount(np.r_[n1, n2], minlength=nn)
    keep = np.array([k for k in range(nn) if k != n_menos and grado[k] > 0])
    pos = -np.ones(nn, int); pos[keep] = np.arange(len(keep))
    s = np.zeros(nn); s[n_mas] = 1.0; s[n_menos] = -1.0
    rows = np.arange(nb)
    A = sp.csr_matrix((np.r_[np.ones(nb), -np.ones(nb)], (np.r_[rows, rows], np.r_[n1, n2])), shape=(nb, nn))
    if f == 0.0:
        Y = sp.diags(1.0 / R)
        Gm = (A.T @ Y @ A).tocsc()[keep][:, keep]
        phi = np.zeros(nn); phi[keep] = spla.spsolve(Gm, s[keep])
        i = (A @ phi) / R
        return i, phi[n_mas]
    w = 2 * math.pi * f
    if Lm is None: Lm = L_parcial(P, n1, n2, gmd)
    Rac = R.copy().astype(complex)
    esp = (tipo == "placa")
    if ks > 1.0:
        Rac[esp] = R[esp] * ks * (1 + 1j)     # impedancia de superficie (delta < t): R = X_int
    Z = np.diag(Rac) + 1j * w * Lm
    Zi = np.linalg.inv(Z)
    Ad = A.toarray()
    Gm = Ad.T @ Zi @ Ad
    phi = np.zeros(nn, complex)
    phi[keep] = np.linalg.solve(Gm[np.ix_(keep, keep)], s[keep])
    i = Zi @ (Ad @ phi)
    return i, phi[n_mas]

# ---- puntos de evaluacion: columna del arco (10 puntos) y centro de la gota
ZCOL = np.linspace(0.1, 1.9, 10) * mm
ZGOTA = L_ARCO + A_GOTA
def puntos_arco(xa, ya):
    return np.array([[xa, ya, z] for z in ZCOL] + [[xa, ya, ZGOTA]])

def cabeza_eje(red, n_pie, xa, ya):
    """pie del arco (plano medio -> cara), arco, gota, alambre: todo sobre el eje. Devuelve el nodo de la punta de contacto."""
    n = red.cable(n_pie, [[xa, ya, 0.0]], area=20e-6, tipo="eje")
    n = red.cable(n, [[xa, ya, L_ARCO]], area=1e-6, tipo="eje")
    n = red.cable(n, [[xa, ya, L_ARCO + 2 * A_GOTA]], area=0.66e-6, tipo="eje")
    n = red.cable(n, [[xa, ya, L_ARCO + 2 * A_GOTA + STICK]], area=0.5e-6, tipo="eje")
    return n

# =====================================================================================================
# 3. GEOMETRIAS
# =====================================================================================================
def arma(conf, xa=0.0, ya=0.0, h=2.5 * mm, rho=RHO_FE_FRIO, con_cabeza=True):
    """Construye la red de la configuracion. Corriente DCEN: + -> pieza -> arco (sube) -> alambre -> antorcha -> -."""
    red = Red(); pl = placa(red, h=h, rho=rho)
    X = lambda *v: [c * mm for c in v]
    na = nodo_placa(pl, xa, ya)
    xA, yA = xa / mm, ya / mm
    if conf.startswith("A"):
        nmas = red.nodo(X(-400, 250, 100)); nmenos = red.nodo(X(-400, 270, 100))
        if conf == "A1":    # pinza en el extremo LEJANO (x=+50), cable rodeando la placa por y=-80
            red.cable(nmas, [X(-400, 250, 1), X(-400, -80, 1), X(80, -80, 1), X(80, 0, 1), X(50, 0, 1)], nodo_placa(pl, 50 * mm, 0), etq="pieza")
        elif conf == "A2":  # pinza en el extremo CERCANO (x=-50), cables juntos en el plano y=0
            red.cable(nmas, [X(-400, 250, 1), X(-400, 0, 1), X(-50, 0, 1)], nodo_placa(pl, -50 * mm, 0), etq="pieza")
        elif conf == "A3":  # pinza al costado (y=+25), cable por y=+60
            red.cable(nmas, [X(-400, 250, 1), X(-400, 60, 1), X(0, 60, 1), X(0, 25, 1)], nodo_placa(pl, 0, 25 * mm), etq="pieza")
        elif conf == "A4":  # pinza ENCIMA del extremo lejano (x=+50) y el cable SUBE 150 mm antes de irse (lo tipico)
            red.cable(nmas, [X(-400, 250, 150), X(-400, 0, 150), X(50, 0, 150)], nodo_placa(pl, 50 * mm, 0), etq="pieza")
        if con_cabeza:
            nt = cabeza_eje(red, na, xa, ya)
            red.cable(nt, [X(xA, yA, 120), X(-400, yA, 120), X(-400, 270, 120)], nmenos, etq="antorcha")
    elif conf.startswith("B"):
        nmas = red.nodo(X(-100, -8, -25)); nmenos = red.nodo(X(-100, 0, -25))
        barra = 60e-6
        if conf == "B1":    # contacto bajo el CENTRO de la placa, barra horizontal 22 mm bajo la placa
            red.cable(nmas, [X(0, -8, -25), X(0, 0, -25)], nodo_placa(pl, 0, 0), area=barra, etq="pieza")
        elif conf == "B2":  # contacto bajo el centro, la barra BAJA 55 mm antes de doblar
            red.cable(nmas, [X(-100, -8, -80), X(0, -8, -80), X(0, 0, -80)], nodo_placa(pl, 0, 0), area=barra, etq="pieza")
        elif conf == "B3":  # contacto bajo un EXTREMO de la placa (x=-45)
            red.cable(nmas, [X(-45, -8, -25), X(-45, 0, -25)], nodo_placa(pl, -45 * mm, 0), area=barra, etq="pieza")
        if con_cabeza:      # antorcha corta, alimentador junto a ella (brazo a 50 mm), bajante fuera de la placa en x=-70
            nt = cabeza_eje(red, na, xa, ya)
            red.cable(nt, [X(xA, yA, 50), X(-70, yA, 50), X(-70, yA, -25), X(-70, 0, -25)], nmenos, area=barra, etq="antorcha")
    elif conf.startswith("C"):
        barra = 60e-6
        if conf == "C1":    # seguidor coaxial en C: contacto (escobilla) JUSTO bajo el arco, un solo lomo a 70 mm
            nmas = red.nodo(X(xA - 70, yA - 4, -80)); nmenos = red.nodo(X(xA - 70, yA + 4, -80))
            red.cable(nmas, [X(xA, yA - 4, -80), X(xA, yA, -80)], na, area=barra, etq="pieza")
            if con_cabeza:
                nt = cabeza_eje(red, na, xa, ya)
                red.cable(nt, [X(xA, yA, 50), X(xA - 70, yA, 50), X(xA - 70, yA, -80)], nmenos, area=barra, etq="antorcha")
        elif conf == "C2":  # yugo en C DOBLE: brazo de la antorcha partido en dos lomos a +-70 mm (I/2 cada uno), fuente bajo el eje
            nmas = red.nodo(X(xA, yA, -90)); nmenos = red.nodo(X(xA, yA, -100))
            red.cable(nmas, [], na, area=barra, etq="pieza")             # escobilla bajo el arco, sube por el eje
            if con_cabeza:
                nt = cabeza_eje(red, na, xa, ya)
                ntop = red.cable(nt, [X(xA, yA, 50)], area=barra, etq="antorcha")
                for sx in (-1, 1):
                    red.cable(ntop, [X(xA + sx * 70, yA, 50), X(xA + sx * 70, yA, -100)], nmenos, area=barra / 2, etq="antorcha")
        elif conf == "C3":  # anillo de 8 contactos bajo la placa (fijo al centro), rayos a una barra central que baja
            nmas = red.nodo(X(-100, -8, -80)); nmenos = red.nodo(X(-100, 0, -80))
            nc = red.cable(nmas, [X(0, -8, -80), X(0, 0, -80)], area=barra, etq="pieza")
            nj = red.cable(nc, [X(0, 0, -25)], area=barra, etq="pieza")
            for k in range(8):
                th = 2 * math.pi * k / 8
                cx, cy = 20 * math.cos(th), 20 * math.sin(th)
                gx, gy = round(cx / 2.5) * 2.5, round(cy / 2.5) * 2.5
                # rayo en L (ejes): primero x, luego y, luego sube al contacto
                red.cable(nj, [X(gx, 0, -25), X(gx, gy, -25)], nodo_placa(pl, gx * mm, gy * mm), area=barra / 4, etq="pieza")
            if con_cabeza:  # alimentacion desde ARRIBA por el eje hasta 150 mm, luego sale
                nt = cabeza_eje(red, na, xa, ya)
                red.cable(nt, [X(xA, yA, 150), X(-100, yA, 150), X(-100, 0, 150)], nmenos, area=barra, etq="antorcha")
        elif conf == "C4":  # marco perimetral: todo el borde de la placa a un marco de cobre 10 mm abajo, sale por una esquina
            nmas = red.nodo(X(-100, -8, -80)); nmenos = red.nodo(X(-100, 0, -80))
            idx = pl["idx"]; ny, nx = idx.shape
            per = [(0, i) for i in range(nx)] + [(j, nx - 1) for j in range(1, ny)] + [(ny - 1, i) for i in range(nx - 2, -1, -1)] + [(j, 0) for j in range(ny - 2, 0, -1)]
            marco = []
            for (j, i) in per:
                p = red.P[idx[j, i]].copy(); p[2] = -11.5 * mm
                nm = red.nodo(p); marco.append(nm)
                red.rama(idx[j, i], nm, 2e-5, 1e-3, "cobre", "pieza")       # contacto + pata vertical
            for k in range(len(marco)):
                a_, b_ = marco[k], marco[(k + 1) % len(marco)]
                ln = np.linalg.norm(red.P[a_] - red.P[b_])
                red.rama(a_, b_, RHO_CU * ln / 60e-6, 0.2235 * 23e-3, "cobre", "pieza")
            esq = marco[0]   # esquina (-50,-25)
            red.cable(nmas, [X(-50, -8, -80), X(-50, -25, -80)], esq, area=barra, etq="pieza")
            if con_cabeza:
                nt = cabeza_eje(red, na, xa, ya)
                red.cable(nt, [X(xA, yA, 150), X(-100, yA, 150), X(-100, 0, 150)], nmenos, area=barra, etq="antorcha")
    return red, pl, nmas, nmenos

def B_en_arco(red, i, xa, ya, excluir_tipo=None, solo_tipo=None, solo_etq=None):
    P, n1, n2, R, gmd, tipo = red.arrays()
    sel = np.ones(len(n1), bool)
    if excluir_tipo: sel &= ~np.isin(tipo, excluir_tipo)
    if solo_tipo: sel &= np.isin(tipo, solo_tipo)
    if solo_etq is not None: sel &= np.isin(np.array(red.etq), solo_etq)
    return campo_B(puntos_arco(xa, ya), P[n1[sel]], P[n2[sel]], i[sel])

# ---- arco y gota: fuerzas y deflexion -------------------------------------------------------------
def pi_num(Bt_col, Iarc):
    """Pi = B_ext promedio en la columna / (mu0 I / 2 pi L)."""
    return np.linalg.norm(Bt_col.mean(0)) / (MU0 * Iarc / (2 * math.pi * L_ARCO))

def deflexion(Bcol_perA, kappa=1.5):
    """Chorro del arco como cuerda con tension T = kappa mu0 I^2/4pi, lanzado recto desde la gota (catodo, DCEN)
    y empujado por f = I (z x B).  y(L) = (1/T) int_0^L (L - s) f(s) ds,  s = distancia desde la gota.
    Con B = b*I (campo del propio banco) y(L) no depende de I.  Devuelve vector (x, y) en m."""
    s = L_ARCO - ZCOL
    order = np.argsort(s); s = s[order]; b = Bcol_perA[order]
    f = np.stack([-b[:, 1], b[:, 0]], 1)            # z x B  (por A de arco, por A de campo)
    ss = np.r_[0.0, s, L_ARCO]; ff = np.vstack([f[0], f, f[-1]])
    integ = np.trapezoid(((L_ARCO - ss)[:, None]) * ff, ss, axis=0)
    return integ * 4 * math.pi / (kappa * MU0)

def resumen_conf(nombre, red, i_dc, xa, ya, I=40.0):
    Bp = B_en_arco(red, i_dc, xa, ya).real          # por ampere
    Bcol, Bg = Bp[:-1, :2], Bp[-1, :2]
    Bt_col = np.linalg.norm(Bcol.mean(0)) * I
    Bt_g = np.linalg.norm(Bg) * I
    Pi = pi_num(Bcol * I, I)
    y = deflexion(Bcol, 1.5)
    fdir = np.array([-Bcol.mean(0)[1], Bcol.mean(0)[0]]); fdir /= (np.linalg.norm(fdir) + 1e-30)
    Fg = I * 2 * A_GOTA * Bt_g
    return dict(nombre=nombre, Bcol=Bt_col, Bg=Bt_g, Pi=Pi, y=y, fdir=fdir, Fg=Fg, fcol=I * Bt_col * 1e-3, bperA=Bcol.mean(0), bg_perA=Bg)

# =====================================================================================================
# 4. RESULTADOS POR CONFIGURACION (arco en el centro de la placa)
# =====================================================================================================
hdr("2. LAS CONFIGURACIONES (arco en el centro de la placa 100x50x3, malla 2.5 mm, DC, vacio mu_r = 1)")
print("  DCEN: + -> pieza -> placa -> arco (sube) -> gota -> alambre (stick-out 10 mm) -> antorcha -> -.")
print(f"  arco L = {L_ARCO*1e3:.1f} mm, gota a = {A_GOTA*1e3:.2f} mm (masa {M_GOTA*1e6:.3f} mg, peso {M_GOTA*G*1e6:.1f} uN), columna evaluada en 10 alturas 0.1-1.9 mm.")
print(f"  B_propio del arco a r = L: mu0 I/(2 pi L) = {MU0*40/(2*math.pi*L_ARCO)*1e3:.2f} mT a 40 A ; Pi = B_ext/B_propio(L) (adimensional, NO depende de I si B_ext viene del mismo circuito)")
print(f"  deflexion: chorro con T = kappa mu0 I^2/4pi, kappa = 1.5 (rango 1-2.5) -> y(L)/L ~ Pi/kappa para B uniforme")
print("  RIGIDEZ DEL CHORRO (empuje de Maecker ~ (mu0 I^2/4pi)(ln(R/rc) + 1/2), kappa = ln(R/rc)+1/2 = 1.2-2.1 para R/rc = 2-5):")
for Ia in (10, 40, 60, 70):
    T_ = 1.5 * MU0 * Ia ** 2 / (4 * math.pi)
    v_ = math.sqrt(T_ / (0.03 * math.pi * (1e-3) ** 2))
    print(f"    I = {Ia:3d} A: T = {T_*1e6:6.0f} uN  (velocidad implicita con rho 0.03 kg/m3 y columna de 1 mm de radio: {v_:4.0f} m/s)")
print("  CALIBRACION con la literatura (Pi = B L 2pi/(mu0 I)):")
for lab, Bm, Ia, Lm_, nota in (("Belous 2011 (Paton), TIG Ti, 'B >= 8 mT' para llevar el anodo a la pared", 8.0, 400, 4.0, "deflexion grande ~ pared"),
                               ("Rolls-Royce EP0827801, TIG 120 A, 17 G -> 10 mm (L ~10 mm)", 1.7, 120, 10.0, "y = 10 mm"),
                               ("Rolls-Royce idem con L ~15 mm", 1.7, 120, 15.0, "y = 10 mm"),
                               ("tabla diverse-tech/Wikipedia: TIG inestable 10-20 G (~150 A, L 3 mm)", 1.0, 150, 3.0, "inicio"),
                               ("idem 20 G", 2.0, 150, 3.0, "inestable"),
                               ("idem: arc blow severo >= 40 G (MMA ~150 A, L 4 mm)", 4.0, 150, 4.0, "severo")):
    Pi_ = Bm * 1e-3 * Lm_ * 1e-3 * 2 * math.pi / (MU0 * Ia)
    extra = ""
    if nota.startswith("y ="):
        extra = f" -> kappa implicito = Pi L / y = {Pi_*Lm_/10.0:.2f}"
    print(f"    {lab:78s}: Pi = {Pi_:5.2f}  [{nota}]{extra}")
print("  -> umbral de inestabilidad Pi* ~ 0.1-0.3, severo ~0.4-0.5. En NUESTRO arco (40 A, 2 mm, B_propio(L) = 4 mT): inicio 0.4-1.2 mT, severo ~1.6-2 mT.")
print("     En el valle de la onda (10 A): B_propio(L) = 1 mT -> un campo que NO escala con I (iman, magnetismo residual) empieza a molestar en 0.1-0.3 mT.")
print("  CAMPOS QUE NO ESCALAN CON I (Pi ~ 1/I: el arco se MECE con la onda a 668 Hz):")
for lab, Bm in (("campo terrestre horizontal (~27 uT en el centro de Mexico, de memoria)", 0.027), ("magnetismo residual leve de una placa cortada (supuesto)", 0.3), ("residual fuerte (tubos: 3-5 mT tipico en obra)", 3.0)):
    s_ = "  ".join(f"{Ia:2d} A: Pi {Bm*1e-3/(MU0*Ia/(2*math.pi*L_ARCO)):5.3f} y {Bm*1e-3/(MU0*Ia/(2*math.pi*L_ARCO))*L_ARCO/1.5*1e6:5.0f} um" for Ia in (10, 40, 70))
    print(f"    {lab:72s} {Bm:5.3f} mT -> {s_}")
print()
CONFS = [("A1", "sueltos: pinza extremo lejano (x=+50), cable rodea"),
         ("A2", "sueltos: pinza extremo cercano (x=-50), plano comun"),
         ("A3", "sueltos: pinza al costado (y=+25)"),
         ("A4", "sueltos: pinza encima (x=+50), cable SUBE 150 mm"),
         ("B1", "base: contacto bajo el centro, barra a 22 mm"),
         ("B2", "base: contacto bajo el centro, barra baja 80 mm"),
         ("B3", "base: contacto bajo un extremo (x=-45)"),
         ("C1", "coaxial en C: escobilla bajo el arco, 1 lomo"),
         ("C2", "coaxial: escobilla bajo el arco, 2 lomos simetricos"),
         ("C3", "anillo de 8 contactos bajo la placa"),
         ("C4", "marco perimetral bajo el borde")]
res = {}
print(f"  {'conf':4s} {'descripcion':52s} | {'B_col':>6s} {'B_gota':>6s} | {'Pi':>5s} | {'f col':>6s} {'F gota':>6s} {'F/peso':>6s} | {'y(L) arco':>9s} {'dir. fuerza':>11s} | {'partes: placa / pieza / antorcha (mT)':>36s}")
print(f"  {'':4s} {'':52s} | {'mT':>6s} {'mT':>6s} | {'':>5s} | {'uN/mm':>6s} {'uN':>6s} {'':>6s} | {'um':>9s} {'(x,y)':>11s} |")
for c, desc in CONFS:
    red, pl, nmas, nmenos = arma(c)
    i_dc, Zdc = resolver(red, nmas, nmenos, 0.0)
    r = resumen_conf(c, red, i_dc, 0.0, 0.0)
    partes = []
    for t_, e_ in ((["placa"], None), (None, ["pieza"]), (None, ["antorcha"])):
        if t_:
            Bp = B_en_arco(red, i_dc, 0, 0, solo_tipo=t_).real
        else:
            Bp = B_en_arco(red, i_dc, 0, 0, excluir_tipo=["placa"], solo_etq=e_).real
        partes.append(np.linalg.norm(Bp[:-1, :2].mean(0)) * 40 * 1e3)
    res[c] = dict(r, red=red, pl=pl, nmas=nmas, nmenos=nmenos, i_dc=i_dc)
    print(f"  {c:4s} {desc:52s} | {r['Bcol']*1e3:6.3f} {r['Bg']*1e3:6.3f} | {r['Pi']:5.3f} | {r['fcol']*1e6:6.2f} {r['Fg']*1e6:6.2f} {r['Fg']/(M_GOTA*G):6.2f} | {np.linalg.norm(r['y'])*1e6:9.0f} ({r['fdir'][0]:+.2f},{r['fdir'][1]:+.2f}) | {partes[0]:9.3f} / {partes[1]:6.3f} / {partes[2]:6.3f}")
print("  (las partes son vectores; su suma vectorial da B_col. f col = I*B por mm de columna. A 60 A: B x1.5, fuerzas x2.25, Pi y y(L) iguales.)")
print()
print("  QUE LE PASA A LA GOTA cuando el arco se ladea (estimados de orden de magnitud, INCIERTOS):")
print("   - directo: F = I*2a*B (tabla).  - indirecto: la raiz del arco se corre sobre la gota -> fuerza propia ladeada ~ (mu0 I^2/4pi)*theta.")
print("   - en vuelo: el chorro ladeado arrastra la gota: F_arrastre = 1/2 Cd rho v^2 pi a^2 (Cd 1, rho 0.03 kg/m3, v 100 m/s) * pendiente media.")
print(f"  {'conf':4s} | {'theta raiz':>10s} | {'F directa':>9s} {'F indirecta':>11s} (uN, a 40 A) | {'deriva de la gota en vuelo':>27s} | {'corrimiento del ANODO (calor)':>29s}")
Fd_ax = 0.5 * 1.0 * 0.03 * 100.0 ** 2 * math.pi * A_GOTA ** 2
t_vuelo = 2.0e-3 / 0.7
for c, _ in CONFS:
    r = res[c]
    yv = np.linalg.norm(r["y"])
    th_tip = 2 * yv / L_ARCO          # para B uniforme: theta(L) = 2 y(L)/L
    Fi = MU0 * 40 ** 2 / (4 * math.pi) * th_tip
    lat = Fd_ax * (yv / L_ARCO)
    deriva = 0.5 * lat / M_GOTA * t_vuelo ** 2
    print(f"  {c:4s} | {math.degrees(th_tip):8.1f} deg | {r['Fg']*1e6:9.1f} {Fi*1e6:11.1f}              | {deriva*1e6:24.1f} um | {yv*1e6:26.0f} um")
print(f"   (arrastre axial supuesto {Fd_ax*1e6:.0f} uN = {Fd_ax/(M_GOTA*G):.1f} pesos; vuelo {t_vuelo*1e3:.1f} ms como en el canon)")
print("   -> el banco NO mueve casi la gota; mueve el ARCO (el calor). La gota cae donde apunta el alambre; el charco se corre y(L).")

# direccion respecto a la pinza (A1: pinza en +x -> esperado: el arco se va a -x, lejos de la pinza)
print()
print("  regla de taller (Lincoln/TWI: el arco 'sopla' alejandose de la conexion de pieza):")
for c, pinza in (("A1", (1, 0)), ("A2", (-1, 0)), ("A3", (0, 1)), ("A4", (1, 0)), ("B3", (-1, 0))):
    d = res[c]["fdir"]; cosang = d[0] * pinza[0] + d[1] * pinza[1]
    print(f"   {c}: fuerza hacia ({d[0]:+.2f},{d[1]:+.2f}); pinza/contacto hacia {pinza}; cos = {cosang:+.2f} -> {'SE ALEJA de la pinza' if cosang < -0.3 else ('hacia la pinza' if cosang > 0.3 else 'de lado')}")

# ---- convergencia de malla (DC) para A1 y B3
print()
print("  convergencia de malla (DC): B_col en mT a 40 A")
for c in ("A1", "B3"):
    vals = []
    for h in (5.0, 2.5, 1.25):
        red, pl, nmas, nmenos = arma(c, h=h * mm)
        i_dc, _ = resolver(red, nmas, nmenos, 0.0)
        vals.append(resumen_conf(c, red, i_dc, 0, 0)["Bcol"] * 1e3)
    print(f"   {c}: h = 5 / 2.5 / 1.25 mm -> {vals[0]:.4f} / {vals[1]:.4f} / {vals[2]:.4f} mT")

# ---- la regla de Ampere: contacto por DEBAJO con su cable bajando = placa invisible desde arriba
hdr("3. LA REGLA DE AMPERE (placa grande 400x400 mm, arco al centro, contacto a s = 50 mm)")
print("  Ampere con una semiesfera: si el cable de pieza se va hacia ABAJO, la placa + ese cable no ponen campo arriba;")
print("  si se va hacia ARRIBA (pinza encima y cable que sube), arriba aparece mu0 I/(2 pi s) como de un alambre vertical en la pinza.")
for Lp in (400, 100):
    for modo in ("abajo", "arriba"):
        red = Red(); pl = placa(red, h=5 * mm if Lp == 400 else 2.5 * mm, Lx=Lp * mm, Ly=Lp * mm)
        zf = (-1000 if modo == "abajo" else 1000) * mm
        nmas = red.nodo([0.05 if Lp == 400 else 0.045, 0, zf])           # cable de pieza vertical de 1 m
        nmenos = red.nodo([0, 0, 1.0])                                    # la antorcha sube 1 m por el eje
        red.cable(nmas, [], nodo_placa(pl, 0.05 if Lp == 400 else 0.045, 0.0), area=60e-6, etq="pieza")
        nt = cabeza_eje(red, nodo_placa(pl, 0, 0), 0, 0)
        red.cable(nt, [], nmenos, area=60e-6, etq="antorcha")
        # la fuente cierra a 1 m (su tramo no se dibuja: aporta < 0.004 mT)
        i_dc, _ = resolver(red, nmas, nmenos, 0.0)
        P, n1, n2, R, gmd, tipo = red.arrays()
        Bp = campo_B(puntos_arco(0, 0), P[n1], P[n2], i_dc * 40).real
        Bcol = Bp[:-1, :2].mean(0)
        s_ = 0.05 if Lp == 400 else 0.045
        print(f"   placa {Lp}x{Lp} mm, cable de pieza hacia {modo:6s} (s = {s_*1e3:.0f} mm): |B_t| columna = {np.linalg.norm(Bcol)*1e3:6.4f} mT   "
              f"(Ampere: {'0' if modo == 'abajo' else f'{MU0*40/(2*math.pi*s_)*1e3:.4f}'} mT en placa infinita)")
print("  -> PRUEBA de la regla: un contacto bajo la placa cuyo cable BAJA vertical no se ve desde el arco (placa infinita, mu_r = 1).")
print()
print("  PERO la placa del banco es una TIRA de 50 mm: si la corriente corre de UN solo lado del arco, la tira pone ~mu0 I/(4w) encima")
print("  (medio plano de corriente K = I/w) -> Pi_tira ~ pi L/(2w), sin importar por donde salga el cable. Comprobacion (placa 2w x w,")
print("  contacto BAJO un extremo con cable bajando 1 m, arco al centro; solo placa + cable de pieza):")
for w_ in (50, 100, 200):
    hh = 2.5 if w_ == 50 else 5.0
    red = Red(); pl = placa(red, h=hh * mm, Lx=2 * w_ * mm, Ly=w_ * mm)
    xc_ = -(w_ - 5) * mm
    nmas = red.nodo([xc_, 0, -1.0])
    red.cable(nmas, [], nodo_placa(pl, xc_, 0.0), area=60e-6)
    na = nodo_placa(pl, 0, 0)
    i_dc, _ = resolver(red, nmas, na, 0.0)
    P, n1, n2, R, gmd, tipo = red.arrays()
    Bp = campo_B(puntos_arco(0, 0), P[n1], P[n2], i_dc * 40).real
    print(f"    w = {w_:3d} mm: Pi = {pi_num(Bp[:-1,:2], 40):.4f}   (pi L/2w = {math.pi*L_ARCO/(2*w_*mm):.4f})")

# =====================================================================================================
# 5. LA ONDA: 40 A + 30 A a 668 Hz. La parte AC se reparte por impedancia (PEEC) y no por resistencia.
# =====================================================================================================
hdr(f"4. LA ONDA (I = {I0:.0f} + {I1:.0f} cos 2pi {F_ONDA:.0f} t): como se reparte la AC en la placa y que hace al campo")
print("  PEEC: Z = R + jw L_parcial (Neumann). Placa de acero mu_r = 1 en el modelo; ks = factor de piel (delta < t con mu_r 100-500 -> ks 2-4).")
print("  b0 = B por ampere en DC; b1 = B por ampere a 668 Hz (complejo). Pi(t) = |B(t)|/(mu0 I(t)/2piL).")
print(f"  {'conf':4s} {'rho':>5s} {'ks':>3s} | {'|b0| uT/A':>9s} {'|b1| uT/A':>9s} {'ang(b1,b0)':>10s} {'fase':>6s} | {'Pi DC':>6s} {'Pi min':>6s} {'Pi max':>6s} | {'F gota: DC  668Hz  1336Hz (uN)':>31s} | {'L lazo uH':>9s}")
ONDA = {}
for c in ("A1", "A2", "A4", "B1", "B3", "C1", "C3"):
    for rho, ks in ((RHO_FE_FRIO, 1.0), (RHO_FE_FRIO, 3.0), (RHO_FE_CAL, 1.0)):
        red, pl, nmas, nmenos = arma(c, rho=rho)
        P, n1, n2, R, gmd, tipo = red.arrays()
        Lm = L_parcial(P, n1, n2, gmd)
        i0, _ = resolver(red, nmas, nmenos, 0.0)
        i1, Z1 = resolver(red, nmas, nmenos, F_ONDA, ks=ks, Lm=Lm)
        b0 = B_en_arco(red, i0, 0, 0).real
        b1 = B_en_arco(red, i1, 0, 0)
        b0c, b1c = b0[:-1, :2].mean(0), b1[:-1, :2].mean(0)
        b0g, b1g = b0[-1, :2], b1[-1, :2]
        # tiempo
        tt = np.linspace(0, 1 / F_ONDA, 400, endpoint=False)
        It = I0 + I1 * np.cos(2 * math.pi * F_ONDA * tt)
        Bt = I0 * b0c[None, :] + I1 * np.real(b1c[None, :] * np.exp(1j * 2 * math.pi * F_ONDA * tt)[:, None])
        Pit = np.linalg.norm(Bt, axis=1) / (MU0 * It / (2 * math.pi * L_ARCO))
        Bgt = I0 * b0g[None, :] + I1 * np.real(b1g[None, :] * np.exp(1j * 2 * math.pi * F_ONDA * tt)[:, None])
        Fgt = It[:, None] * 2 * A_GOTA * np.stack([-Bgt[:, 1], Bgt[:, 0]], 1)
        # proyeccion sobre la direccion media y espectro
        dmean = Fgt.mean(0); dmean = dmean / (np.linalg.norm(dmean) + 1e-30)
        Fp = Fgt @ dmean
        spec = np.abs(np.fft.rfft(Fp)) / len(Fp); spec[1:] *= 2
        ang = math.degrees(math.atan2(b1c.real[1], b1c.real[0]) - math.atan2(b0c[1], b0c[0]))
        ang = (ang + 180) % 360 - 180
        fase = math.degrees(np.angle(np.vdot(b0c, b1c)))
        Lloop = Z1.imag / (2 * math.pi * F_ONDA)
        ONDA[(c, rho, ks)] = dict(b0=b0c, b1=b1c, Pit=Pit)
        print(f"  {c:4s} {'frio' if rho == RHO_FE_FRIO else 'cal':>5s} {ks:3.0f} | {np.linalg.norm(b0c)*1e6:9.3f} {np.linalg.norm(b1c)*1e6:9.3f} {ang:10.1f} {fase:6.1f} | {pi_num(b0c[None]*I0, I0):6.3f} {Pit.min():6.3f} {Pit.max():6.3f} | {spec[0]*1e6:9.2f} {spec[1]*1e6:6.2f} {spec[2]*1e6:7.2f}      | {Lloop*1e6:9.3f}")
print("  lectura: si |b1| = |b0| y angulo 0, el campo solo escala con I y Pi no cambia en el ciclo (el arco no se mece).")
print("  F gota: I^2 mezcla canales: con 40+30 A la fuerza lateral tiene DC, 668 Hz y 1336 Hz (2400:450 en A^2 si b1 = b0).")
print(f"  l=1 de la gota (SUPUESTO f1 = {F1:.0f} Hz, Q = {Q1:.0f}): la componente a 668 Hz cae a 2 f1 -> respuesta 1/|1-4| = 0.33 de la estatica;")
print(f"  si f1 real estuviera en 650-690 Hz (no medido), esa componente seria RESONANTE (x{Q1:.0f}): el banco mece la gota solo.")
for c in ("A1", "A4", "B3"):
    d = ONDA[(c, RHO_FE_FRIO, 1.0)]
    F668 = I1 * 2 * A_GOTA * np.linalg.norm(d["b0"]) * I0 * 2     # componente a w de I^2: 2*I0*I1*b
    k668 = M_GOTA * (2 * math.pi * F_ONDA) ** 2
    print(f"   {c}: fuerza en la gota a 668 Hz ~{F668*1e6:.1f} uN -> si f1 = 668 Hz y Q = 30: {F668/k668*Q1*1e6:.1f} um de meneo; con f1 = 334 Hz: {F668/(M_GOTA*(2*math.pi*F1)**2)/3*1e6:.2f} um")

# =====================================================================================================
# 6. MAPAS: B de la parte placa + pieza (DC) contra la posicion del arco
# =====================================================================================================
hdr("5. MAPAS (DC): Pi de la parte PLACA + CONDUCTOR DE PIEZA segun donde este el arco; la cabeza aparte")
print("  La cabeza (antorcha + brazo + bajante) se mueve con el arco y aporta un vector CONSTANTE (se mide y se resta una vez).")
print("  Abajo: Pi (adimensional, igual a 40 o 60 A) en una rejilla x = -40..40, y = -20..20 mm. Pi < 0.03 ~ despreciable; >0.15 problema.")
xs_m = np.arange(-40, 40.1, 10) * mm; ys_m = np.arange(-20, 20.1, 10) * mm
for c in ("A1", "B1", "B3", "C3", "C4"):
    print(f"  --- {c} ---   (filas y = {', '.join(f'{y/mm:+.0f}' for y in ys_m[::-1])} mm; columnas x = {', '.join(f'{x/mm:+.0f}' for x in xs_m)} mm)")
    grid = np.zeros((len(ys_m), len(xs_m)))
    for jy, yv in enumerate(ys_m):
        for ix, xv in enumerate(xs_m):
            red, pl, nmas, nmenos = arma(c, xa=xv, ya=yv, con_cabeza=False)
            na = nodo_placa(pl, xv, yv)
            # fuente: de + a la placa en el pie del arco (la corriente sale por el arco hacia arriba)
            i_dc, _ = resolver(red, nmas, na, 0.0)
            Bp = B_en_arco(red, i_dc, xv, yv).real
            grid[jy, ix] = pi_num(Bp[:-1, :2] * 40, 40)
    for jy in range(len(ys_m) - 1, -1, -1):
        print("     " + " ".join(f"{v:6.3f}" for v in grid[jy]))
    MAPA_MAX = grid.max()
    print(f"     max {grid.max():.3f}  mediana {np.median(grid):.3f}")
# contribucion de la cabeza B (brazo a 50 mm y bajante en x=-70) con el arco en el centro
red, pl, nmas, nmenos = arma("B1")
i_dc, _ = resolver(red, nmas, nmenos, 0.0)
Bh = B_en_arco(red, i_dc, 0, 0, excluir_tipo=["placa"], solo_etq=["antorcha"]).real
print(f"  cabeza de B (antorcha 50 mm + brazo 70 mm + bajante): Pi = {pi_num(Bh[:-1,:2]*40, 40):.3f} constante (se mueve con el arco)")

# =====================================================================================================
# 7. MONTE CARLO: cables sueltos al azar (banco v1)
# =====================================================================================================
hdr("6. MONTE CARLO: 400 ruteos sueltos al azar (banco v1), arco en el centro y en posiciones al azar")
rng = np.random.default_rng(9)
red0, pl0, _, _ = arma("A1", con_cabeza=False)
idx = pl0["idx"]; ny, nx = idx.shape
per = [(0, i) for i in range(nx)] + [(j, nx - 1) for j in range(1, ny)] + [(ny - 1, i) for i in range(nx - 2, -1, -1)] + [(j, 0) for j in range(ny - 2, 0, -1)]
def placa_sola(xa, ya, j, i):
    red = Red(); pl = placa(red)
    na = nodo_placa(pl, xa, ya); nc = pl["idx"][j, i]
    i_dc, _ = resolver(red, nc, na, 0.0)
    P, n1, n2, R, gmd, tipo = red.arrays()
    return campo_B(puntos_arco(xa, ya), P[n1], P[n2], i_dc).real, red.P[nc]
def ruta_suelta(p_ini, p_fin, z_lo, z_hi, nwp):
    pts = [p_ini]
    for _ in range(nwp):
        r_ = rng.uniform(0.08, 0.5); th = rng.uniform(0, 2 * math.pi)
        pts.append(np.array([r_ * math.cos(th), r_ * math.sin(th), rng.uniform(z_lo, z_hi)]))
    pts.append(p_fin); return np.array(pts)
filas = []
for k in range(400):
    centro = k < 200
    if centro: xa = ya = 0.0
    else:
        xa = rng.integers(-16, 17) * 2.5 * mm; ya = rng.integers(-8, 9) * 2.5 * mm
    j, i = per[rng.integers(len(per))]
    Bpl, pc = placa_sola(xa, ya, j, i)
    rps = rng.uniform(0.3, 0.7); thp = rng.uniform(0, 2 * math.pi)
    Pp = np.array([rps * math.cos(thp), rps * math.sin(thp), rng.uniform(0.0, 0.15)])
    Pm = Pp + np.array([0, 0.02, 0])
    # cable de pieza: de la fuente a la mesa, waypoints sobre la mesa (z = 1 mm), llega a la pinza desde afuera
    nrm = np.array([np.sign(pc[0]) if abs(abs(pc[0]) - 0.05) < 1e-9 else 0.0, np.sign(pc[1]) if abs(abs(pc[1]) - 0.025) < 1e-9 else 0.0, 0])
    nrm /= np.linalg.norm(nrm)
    ext = pc + 0.04 * nrm; ext[2] = 1 * mm
    tope = pc.copy(); tope[2] = 1 * mm
    work = ruta_suelta(np.array([Pp[0], Pp[1], 1 * mm]), ext, 1 * mm, 1 * mm, rng.integers(0, 3))
    work = np.vstack([Pp, work, tope, pc])
    # que el cable no pase por encima de la placa: si un waypoint cae dentro, se empuja afuera
    for q in work[1:-2]:
        if abs(q[0]) < 0.06 and abs(q[1]) < 0.035: q[1] = math.copysign(0.035 + rng.uniform(0, 0.1), q[1] if q[1] != 0 else 1)
    Htor = rng.uniform(0.06, 0.25)
    tor = ruta_suelta(np.array([xa, ya, Htor]), Pm, 0.02, 0.3, rng.integers(0, 3))
    tor = np.vstack([[xa, ya, L_ARCO + 2 * A_GOTA + STICK], tor])
    r1, r2, ii = segs_de_polilinea(work, 1.0)
    r1b, r2b, iib = segs_de_polilinea(tor, 1.0)
    Bc = campo_B(puntos_arco(xa, ya), np.vstack([r1, r1b]), np.vstack([r2, r2b]), np.r_[ii, iib]).real
    Btot = Bpl + Bc
    Pi = pi_num(Btot[:-1, :2] * 40, 40)
    y = deflexion(Btot[:-1, :2], 1.5)
    dist = math.hypot(pc[0] - xa, pc[1] - ya)
    filas.append((centro, Pi, np.linalg.norm(y), np.linalg.norm(Btot[-1, :2]) * 40, dist, np.linalg.norm(Bpl[:-1, :2].mean(0)) * 40, np.linalg.norm(Bc[:-1, :2].mean(0)) * 40))
F_ = np.array([f[1:] for f in filas]); cen = np.array([f[0] for f in filas])
for lab, m_ in (("arco en el centro", cen), ("arco al azar en la placa", ~cen)):
    Pi_, y_, Bg_, d_, Bpl_, Bc_ = F_[m_].T
    print(f"  {lab:26s}: Pi mediana {np.median(Pi_):.3f}  p10 {np.percentile(Pi_,10):.3f}  p90 {np.percentile(Pi_,90):.3f}  max {Pi_.max():.3f} | "
          f"B_col a 40 A: mediana {np.median(Pi_)*4.0:.2f} mT, p90 {np.percentile(Pi_,90)*4.0:.2f} mT | y(L) mediana {np.median(y_)*1e6:.0f} um, p90 {np.percentile(y_,90)*1e6:.0f} um")
    print(f"  {'':26s}  parte placa+pinza mediana {np.median(Bpl_)*1e3:.3f} mT ; parte cables mediana {np.median(Bc_)*1e3:.3f} mT ; fraccion con Pi > 0.15: {np.mean(Pi_>0.15)*100:.0f} %")
# correlacion con distancia a la pinza
Pi_, y_, Bg_, d_, Bpl_, Bc_ = F_[~cen].T
for lo, hi in ((0, 0.03), (0.03, 0.06), (0.06, 0.12)):
    m_ = (d_ >= lo) & (d_ < hi)
    if m_.sum():
        print(f"   pinza a {lo*1e3:3.0f}-{hi*1e3:3.0f} mm del arco: n = {m_.sum():3d}, Pi mediana {np.median(Pi_[m_]):.3f}, p90 {np.percentile(Pi_[m_],90):.3f}")

# =====================================================================================================
# 8. PLACA FERROMAGNETICA: cargas magneticas en celdas (in-plane + normal), mu_r = 100 y 300
# =====================================================================================================
hdr("7. LA PLACA ES DE ACERO (ferromagnetica): cuanto cambia el campo de vacio en el arco")
print("  Metodo: placa en celdas 2.5x2.5x3 mm con magnetizacion uniforme M_j; cada celda = 6 caras con carga sigma = M.n (formula cerrada")
print("  de rectangulo cargado). M = chi (H_ext + H_M). H_ext = campo de vacio de los conductores (sin las corrientes dentro de la placa:")
print("  su campo propio promedia cero en el espesor). Lineal (1 mT << saturacion). Hoyo caliente: celdas a < 4 mm del arco con chi = 0 (Curie).")
def H_rect(Pt, c, nax, hu, hv, sigma):
    """H (A/m) de rectangulos cargados uniformemente. Pt (M,3); c (F,3) centros; nax (F,) eje normal; hu,hv (F,) semilados
    en los ejes (u,v) = los otros dos en orden; sigma (F,)."""
    Mn = Pt.shape[0]; Fn = c.shape[0]
    out = np.zeros((Mn, 3))
    for a in range(3):
        sel = np.where(nax == a)[0]
        if len(sel) == 0: continue
        u_, v_ = [k for k in range(3) if k != a]
        du = Pt[:, None, u_] - c[None, sel, u_]
        dv = Pt[:, None, v_] - c[None, sel, v_]
        dn = Pt[:, None, a] - c[None, sel, a]
        dn = np.where(np.abs(dn) < 1e-12, 1e-12, dn)
        Hn = np.zeros(du.shape); Hu = np.zeros(du.shape); Hv = np.zeros(du.shape)
        for si, xu in ((1, hu[sel]), (-1, -hu[sel])):
            x = xu[None, :] - du
            for sj, yv in ((1, hv[sel]), (-1, -hv[sel])):
                y = yv[None, :] - dv
                Rr = np.sqrt(x * x + y * y + dn * dn)
                sg = si * sj
                Hn += sg * np.arctan(x * y / (dn * Rr))
                Hu += sg * np.log(y + Rr)
                Hv += sg * np.log(x + Rr)
        k = sigma[sel][None, :] / (4 * math.pi)
        out[:, a] += (k * Hn).sum(1)
        out[:, u_] += (k * Hu).sum(1)
        out[:, v_] += (k * Hv).sum(1)
    return out

class PlacaMag:
    def __init__(self, h=2.5 * mm, Lx=PLACA_LX, Ly=PLACA_LY, t=PLACA_T):
        nx, ny = int(round(Lx / h)), int(round(Ly / h))
        xc = -Lx / 2 + h * (np.arange(nx) + 0.5); yc = -Ly / 2 + h * (np.arange(ny) + 0.5)
        X_, Y_ = np.meshgrid(xc, yc)
        self.C = np.stack([X_.ravel(), Y_.ravel(), np.full(X_.size, ZC)], 1)
        self.h, self.t = h, t
        self.N = self.C.shape[0]
    def caras(self, Mv):
        """para magnetizacion Mv (N,3) -> lista de caras (centros, eje, hu, hv, sigma)."""
        h, t = self.h, self.t
        half = np.array([h / 2, h / 2, t / 2])
        cs, ax, hu, hv, sg = [], [], [], [], []
        for a in range(3):
            u_, v_ = [k for k in range(3) if k != a]
            for s in (1, -1):
                cc = self.C.copy(); cc[:, a] += s * half[a]
                cs.append(cc); ax.append(np.full(self.N, a)); hu.append(np.full(self.N, half[u_])); hv.append(np.full(self.N, half[v_]))
                sg.append(s * Mv[:, a])
        return np.vstack(cs), np.concatenate(ax), np.concatenate(hu), np.concatenate(hv), np.concatenate(sg)
    def matriz(self):
        """K (3N,3N): H en centros por unidad de M de cada celda y componente."""
        N = self.N
        K = np.zeros((3 * N, 3 * N))
        for comp in range(3):
            Mv = np.zeros((N, 3)); Mv[:, comp] = 1.0
            cs, ax, hu, hv, sg = self.caras(Mv)
            # caras de la celda j: indices j + N*(2*a + s_idx) ; solo las del eje comp tienen sigma != 0
            for jb in range(0, N, 100):
                js = np.arange(jb, min(jb + 100, N))
                fi = np.concatenate([js + N * (2 * comp + 0), js + N * (2 * comp + 1)])
                H = np.zeros((N, len(js), 3))
                for kk, j in enumerate(js):
                    f2 = np.array([j + N * (2 * comp), j + N * (2 * comp + 1)])
                    H[:, kk, :] = H_rect(self.C, cs[f2], ax[f2], hu[f2], hv[f2], sg[f2])
                for out_c in range(3):
                    K[out_c * N:(out_c + 1) * N, comp * N + js] = H[:, :, out_c]
        self.K = K
        return K
    def resolver(self, Hext, chi, hoyo=None):
        N = self.N
        chiv = np.full(N, chi, float)
        if hoyo is not None:
            xa, ya, r0 = hoyo
            chiv[np.hypot(self.C[:, 0] - xa, self.C[:, 1] - ya) < r0] = 0.0
        act = np.where(chiv > 0)[0]
        ia = np.concatenate([act, act + N, act + 2 * N])
        Kc = self.K[np.ix_(ia, ia)]
        A_ = np.diag(1.0 / np.tile(chiv[act], 3)) - Kc
        hv_ = np.concatenate([Hext[act, 0], Hext[act, 1], Hext[act, 2]])
        m = np.linalg.solve(A_, hv_)
        Mv = np.zeros((N, 3)); n_ = len(act)
        Mv[act, 0], Mv[act, 1], Mv[act, 2] = m[:n_], m[n_:2 * n_], m[2 * n_:]
        return Mv
    def H_de_M(self, Pt, Mv):
        cs, ax, hu, hv, sg = self.caras(Mv)
        nz = np.abs(sg) > 0
        Pt = np.asarray(Pt, float) + np.array([1.1e-7, 1.3e-7, 0.0])   # evita puntos sobre lineas de aristas (log 0)
        return H_rect(Pt, cs[nz], ax[nz], hu[nz], hv[nz], sg[nz])

pm = PlacaMag()
t_ = time.time(); pm.matriz()
print(f"  {pm.N} celdas, matriz {3*pm.N}x{3*pm.N} en {time.time()-t_:.1f} s")
# validacion: campo uniforme H0 en x sobre la placa: H en la cara de arriba al centro / H0
for chi in (99.0, 299.0):
    Mv = pm.resolver(np.tile([1.0, 0, 0], (pm.N, 1)), chi)
    Hs = np.array([1.0, 0, 0]) + pm.H_de_M(np.array([[0, 0, 0.5 * mm], [0, 0, 2.46 * mm]]), Mv)
    Hy = np.array([0, 1.0, 0]) + pm.H_de_M(np.array([[0, 0, 0.5 * mm]]), pm.resolver(np.tile([0, 1.0, 0], (pm.N, 1)), chi))
    print(f"  validacion mu_r={chi+1:.0f}: campo uniforme horizontal sobre la placa -> en el centro, 0.5 mm arriba: Hx/H0 = {Hs[0,0]:.3f} (a 2.46 mm: {Hs[1,0]:.3f}); "
          f"en y: Hy/H0 = {Hy[0,1]:.3f}   (elipsoide: 1/(1+N(mu-1)) con N~0.03-0.06 -> {1/(1+0.06*chi):.2f}-{1/(1+0.03*chi):.2f})")
def B_con_placa(red, i_dc, xa, ya, chi, hoyo=True):
    P, n1, n2, R, gmd, tipo = red.arrays()
    sel = tipo != "placa"
    Hext_c = campo_B(pm.C, P[n1[sel]], P[n2[sel]], i_dc[sel]).real / MU0
    Mv = pm.resolver(Hext_c, chi, (xa, ya, 4 * mm) if hoyo else None)
    pts = puntos_arco(xa, ya)
    Bvac = campo_B(pts, P[n1], P[n2], i_dc).real
    return Bvac + MU0 * pm.H_de_M(pts, Mv), Bvac
print()
print(f"  {'conf':4s} | {'Pi vacio':>8s} | {'Pi mu=100':>9s} {'mu=100 hoyo':>11s} | {'Pi mu=300':>9s} {'mu=300 hoyo':>11s} |  (arco en el centro, 40 A; Pi = B_col/4.0 mT)")
FERRO = {}
for c in ("A1", "A2", "A3", "A4", "B1", "B3", "C1", "C3"):
    red, i_dc = res[c]["red"], res[c]["i_dc"]
    row = []
    for chi in (99.0, 299.0):
        for hoyo in (False, True):
            Bt, Bv = B_con_placa(red, i_dc, 0, 0, chi, hoyo)
            row.append(pi_num(Bt[:-1, :2] * 40, 40))
    pv = pi_num(Bv[:-1, :2] * 40, 40)
    FERRO[c] = (pv, row)
    print(f"  {c:4s} | {pv:8.3f} | {row[0]:9.3f} {row[1]:11.3f} | {row[2]:9.3f} {row[3]:11.3f} |")
# A1 con el arco cerca del extremo (efecto de borde)
for xa in (-40 * mm, 40 * mm):
    red, pl, nmas, nmenos = arma("A1", xa=xa)
    i_dc, _ = resolver(red, nmas, nmenos, 0.0)
    Bt, Bv = B_con_placa(red, i_dc, xa, 0, 299.0, True)
    print(f"  A1 con el arco en x = {xa/mm:+.0f} mm (a {50-abs(xa/mm):.0f} mm del extremo): Pi vacio {pi_num(Bv[:-1,:2]*40,40):.3f} -> mu=300 con hoyo {pi_num(Bt[:-1,:2]*40,40):.3f}")

# =====================================================================================================
# 9. APUNTAR: lo que pide el canon, lo que le hace al arco, y con que bobinas
# =====================================================================================================
hdr("8. APUNTAR LA GOTA (l = 1) CON CAMPO: el canon pide 3.19 mT (patada) / 1.12 mT (giro) a 40 A")
k1 = M_GOTA * (2 * math.pi * F1) ** 2
print(f"  gota: fuerza por mT a 40 A = I*2a*B = {40*2*A_GOTA*1e-3*1e6:.1f} uN (peso {M_GOTA*G*1e6:.1f} uN). l=1: k1 = m w1^2 = {k1:.2f} N/m (f1 = {F1:.0f} Hz SUPUESTO)")
print(f"  desplazamiento de la gota por mT: estatico {40*2*A_GOTA*1e-3/k1*1e6:.2f} um/mT ; en resonancia (Q={Q1:.0f}, ya cargada ~{2*Q1/(2*math.pi*F1)*1e3:.0f} ms) {40*2*A_GOTA*1e-3/k1*Q1*1e6:.0f} um/mT")
print("  el MISMO campo empuja la columna del arco (2 mm, mucho mas blanda):")
print(f"  {'B (mT)':>7s} {'I (A)':>5s} | {'Pi':>5s} | {'arco y(L) um':>14s} (kappa 1 / 1.5 / 2.5) | {'gota estatica um':>16s} {'gota resonante um':>17s} | veredicto de estabilidad (Pi* 0.15-0.4)")
for Bm, Ia in ((1.12, 40), (3.19, 40), (3.19, 70), (3.19, 10), (0.3, 40), (0.75, 40)):
    Pi = Bm * 1e-3 / (MU0 * Ia / (2 * math.pi * L_ARCO))
    ys = [Pi * L_ARCO / k for k in (1.0, 1.5, 2.5)]
    gs = Ia * 2 * A_GOTA * Bm * 1e-3 / k1
    est = "estable" if Pi < 0.15 else ("zona de inestabilidad" if Pi < 0.4 else "INESTABLE / se apaga (literatura TIG/MMA)")
    print(f"  {Bm:7.2f} {Ia:5.0f} | {Pi:5.2f} | {ys[0]*1e6:5.0f} / {ys[1]*1e6:4.0f} / {ys[2]*1e6:4.0f}            | {gs*1e6:16.1f} {gs*Q1*1e6:17.0f} | {est}")
print(f"  -> el arco se mueve {L_ARCO/1.5*2*math.pi*L_ARCO/(MU0*40)*1e-3*1e6:.0f} um/mT (kappa 1.5, 40 A, cuasi-estatico hasta ~kHz) contra {40*2*A_GOTA*1e-3/k1*Q1*1e6:.0f} um/mT de la gota en resonancia.")

# ---- bobinas
print()
print("  BOBINAS (dos pares en cuadratura, eje horizontal). No caben a la altura de la gota: la placa esta 2.5 mm abajo;")
print("  el centro de cada bobina va a z = radio exterior + 1 mm (la bobina libra la placa por 1 mm). 80 vueltas AWG21, 8 mm de largo, 7 mm de fondo.")
def par_bobinas(D, Rm, n_fil=(3, 3), largo=8 * mm, prof=7 * mm, zc=ZGOTA, eje=0):
    """devuelve segmentos (r1, r2, peso) para 1 A-vuelta total por bobina, par en +-D sobre el eje 'eje'."""
    R1s, R2s, W = [], [], []
    nr, na_ = n_fil
    for sgn in (1, -1):
        for ir in range(nr):
            rr = Rm - prof / 2 + prof * (ir + 0.5) / nr
            for ia in range(na_):
                off = D - largo / 2 + largo * (ia + 0.5) / na_
                c = np.zeros(3); c[eje] = sgn * off; c[2] = zc
                ax = np.zeros(3); ax[eje] = 1.0
                pts = espira(c, ax, rr, 64)
                r1, r2, ii = segs_de_polilinea(pts, 1.0 / (nr * na_))
                R1s.append(r1); R2s.append(r2); W.append(ii)
    return np.vstack(R1s), np.vstack(R2s), np.concatenate(W)
for D, Rm in ((18 * mm, 7.5 * mm), (25 * mm, 10 * mm)):
    zc_b = Rm + 3.5 * mm + 1 * mm
    r1, r2, w = par_bobinas(D, Rm, zc=zc_b)
    print(f"   [centro de bobinas a z = {zc_b/mm:.1f} mm]")
    Bd = campo_B(puntos_arco(0, 0), r1, r2, w)      # T por A-vuelta por bobina
    bg = Bd[-1, 0]; bc = Bd[:-1, 0].mean()
    # con placa de acero
    Hc = campo_B(pm.C, r1, r2, w) / MU0
    Mv = pm.resolver(Hc, 299.0, (0, 0, 4 * mm))
    Bf = Bd + MU0 * pm.H_de_M(puntos_arco(0, 0), Mv)
    bgf, bcf = Bf[-1, 0], Bf[:-1, 0].mean()
    N_v = 80; Aw = 0.41e-6
    Rcoil = N_v * 2 * math.pi * Rm * RHO_CU / Aw
    Lcoil = 31.6 * Rm ** 2 * N_v ** 2 / (6 * Rm + 9 * 8e-3 + 10 * 7e-3) * 1e-6
    print(f"   par a D = {D/mm:.0f} mm, radio medio {Rm/mm:.1f} mm: B gota {bg*1e6:.2f} uT/(A-v), columna {bc*1e6:.2f} uT/(A-v)  (columna/gota = {bc/bg:.2f}: NO se puede mover la gota sin mover el arco)")
    print(f"      con placa mu_r=300: gota {bgf*1e6:.2f}, columna {bcf*1e6:.2f} uT/(A-v)  (factor placa {bgf/bg:.2f} / {bcf/bc:.2f})")
    for Bm in (3.19, 1.12, 0.3):
        for lab, bb in (("vacio", bg), ("placa", bgf)):
            NI = Bm * 1e-3 / bb
            Ic = NI / N_v
            P4 = 2 * Ic ** 2 * Rcoil      # giro: 2 pares, cos^2 + sin^2 -> 2 bobinas-equivalentes a I pico
            V = Ic * math.hypot(Rcoil, 2 * math.pi * F1 * Lcoil)
            print(f"      B = {Bm:4.2f} mT ({lab}): NI = {NI:6.0f} A-v por bobina -> {N_v} vueltas AWG21: I = {Ic:5.2f} A, R = {Rcoil:.3f} ohm, L = {Lcoil*1e6:.0f} uH, V(334 Hz) = {V:5.1f} V, P media (giro) = {P4:6.1f} W")
# serie con la corriente del arco
print()
print("  BOBINAS EN SERIE con la corriente del arco (la propia corriente del banco hace el campo; B ~ I -> Pi constante en la onda):")
r1, r2, w = par_bobinas(18 * mm, 7.5 * mm, zc=12 * mm)
b1v = campo_B(puntos_arco(0, 0), r1, r2, w)[:-1, 0].mean()        # por A-v, par completo (ambas bobinas)
Hc = campo_B(pm.C, r1, r2, w) / MU0
b1f = (campo_B(puntos_arco(0, 0), r1, r2, w) + MU0 * pm.H_de_M(puntos_arco(0, 0), pm.resolver(Hc, 299.0, (0, 0, 4 * mm))))[:-1, 0].mean()
print(f"   par a D = 18 mm, z = 12 mm: columna {b1v*1e6:.2f} uT/(A-v) en vacio, {b1f*1e6:.2f} con placa mu_r=300 (se usa el de vacio; la placa cambia el factor)")
for Pi_obj in (0.05, 0.10, 0.20):
    Bneed_perA = Pi_obj * MU0 / (2 * math.pi * L_ARCO)            # T/A
    Nv = Bneed_perA / b1v
    lcu = Nv * 2 * math.pi * 7.5e-3 * 2
    Rs = RHO_CU * lcu / 16e-6
    Ls = 2 * 31.6 * (7.5e-3) ** 2 * Nv ** 2 / (6 * 7.5e-3 + 9 * 8e-3 + 10 * 7e-3) * 1e-6
    Irms = math.sqrt(I0 ** 2 + I1 ** 2 / 2)
    print(f"   Pi = {Pi_obj:.2f} (arco +{Pi_obj*L_ARCO/1.5*1e6:.0f} um): {Nv:4.1f} vueltas por bobina del par (cobre 16 mm2) -> R = {Rs*1e3:.2f} mOhm, P = {Irms**2*Rs:.2f} W, L extra ~{Ls*1e6:.2f} uH (vs 41 uH del choque)")
print("   la direccion se elige con MOSFETs que mandan la corriente de retorno por la bobina +x, -x, +y, -y o por el puente directo.")

# =====================================================================================================
# 10. TABLA DE REJILLA PARA EL VISUALIZADOR (config B1, solo segmentos: reproducible con fieldB de em.ts)
# =====================================================================================================
hdr("9. REJILLA DE VALIDACION PARA EL VISUALIZADOR: configuracion B1, 40 A, eps = 1e-6 (igual a em.ts)")
red, pl, nmas, nmenos = arma("B1")
i_dc, _ = resolver(red, nmas, nmenos, 0.0)
P, n1, n2, R, gmd, tipo = red.arrays()
plate_I = np.abs(i_dc[tipo == "placa"]).max()
print(f"  con el arco sobre el contacto, la placa no lleva corriente horizontal (max rama de placa: {plate_I*40:.2e} A): el circuito B1 son SOLO estos segmentos.")
segs = []
for k in range(len(n1)):
    if tipo[k] == "placa": continue
    if np.linalg.norm(P[n2[k]] - P[n1[k]]) < 1e-9: continue
    segs.append((P[n1[k]], P[n2[k]], i_dc[k] * 40))
# fusiona colineales consecutivos para una lista corta
lista = []
for r1_, r2_, I_ in segs:
    if lista:
        a1, a2, aI = lista[-1]
        d1 = (a2 - a1) / np.linalg.norm(a2 - a1); d2 = (r2_ - r1_) / np.linalg.norm(r2_ - r1_)
        if np.allclose(a2, r1_) and np.allclose(d1, d2) and abs(aI - I_) < 1e-9:
            lista[-1] = (a1, r2_, aI); continue
    lista.append((r1_, r2_, I_))
# cierre de la fuente (de - a + dentro de la base)
lista.append((P[nmenos], P[nmas], 40.0))
print("  SEGMENTOS (CurrentSegment de em.ts; metros; I en A de r1 a r2):")
for k, (a1, a2, aI) in enumerate(lista):
    print(f"   {{ id: 'b1_{k:02d}', I: {aI:7.3f}, r1: [{a1[0]:+.5f}, {a1[1]:+.5f}, {a1[2]:+.5f}], r2: [{a2[0]:+.5f}, {a2[1]:+.5f}, {a2[2]:+.5f}] }},")
R1v = np.array([l[0] for l in lista]); R2v = np.array([l[1] for l in lista]); Iv = np.array([l[2] for l in lista])
print()
print(f"  {'x mm':>6s} {'y mm':>6s} {'z mm':>6s} | {'Bx uT':>10s} {'By uT':>10s} {'Bz uT':>10s} {'|B| uT':>10s}")
gx = [-10, -5, 0, 5, 10]; gy = [-5, 0, 5]; gz = [1.0, 2.46, 5, 10, 20]
pts = np.array([[x * mm, y * mm, z * mm] for z in gz for y in gy for x in gx])
Bg = campo_B(pts, R1v, R2v, Iv)
for p, b in zip(pts, Bg):
    print(f"  {p[0]/mm:6.1f} {p[1]/mm:6.1f} {p[2]/mm:6.2f} | {b[0]*1e6:10.3f} {b[1]*1e6:10.3f} {b[2]*1e6:10.3f} {np.linalg.norm(b)*1e6:10.3f}")
print("  (el arco esta en x=y=0 de z=0 a 2 mm: a 5 mm de el su propio campo es mu0 I/2pi r = 1600 uT; en x=y=0 em.ts da su aporte = 0)")

print()
print(f"tiempo total {time.time()-T0:.1f} s")
