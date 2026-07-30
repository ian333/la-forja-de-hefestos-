#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
campo_lineas.py — MOTOR de LÍNEAS DE CAMPO honestas. Eléctrico hoy; magnético mañana
(solo cambia la función `campo(P) -> (N,3)`; el trazador y los gates son los mismos).

POR QUÉ EXISTE (Ian, 2026-07-27): "el campo sigue estando mal, vamos a la física".
La autopsia del .bin que estaba en producción midió TRES errores, y el peor es de física,
no de numérica:

  1. AMPUTACIÓN — `maxlen` cortaba toda línea en una esfera de 6.6 bohr desde el origen.
     Medido: el radio MÁXIMO de todo punto del archivo era 6.60 exacto, y el p95 era 5.61.
     Un campo que se acaba en una esfera no es un campo: es un peinado.
  2. SIEMBRA QUE VIOLA LA REGLA DEL LIBRO — el propio comentario del código decía "el número
     de líneas por carga es PROPORCIONAL a su magnitud" y luego sembraba 210 líneas por cada
     H y CERO en los O. El oxígeno es Z=+8: la carga más grande del sistema no emitía nada.
     Además se tiraba medio hemisferio de cada H — y tirar líneas rompe la proporcionalidad
     flujo↔densidad, que es LO ÚNICO que hace que un dibujo de líneas signifique algo.
  3. CURVATURA BORRADA — media móvil boxcar de k=9 sobre líneas de 40 puntos: promediaba el
     22% de la línea. La curvatura que veías era la del filtro, no la del campo.

LA FÍSICA QUE MANDA AQUÍ (nada de esto es opinión; todo se mide en los gates):

  ∇·E = 4π(Σ_A Z_A δ(r−R_A) − ρ_e(r))        [unidades atómicas, Gauss]

  · Las ÚNICAS fuentes son los núcleos (deltas +Z_A). El sumidero es la nube electrónica,
    que es CONTINUA: una línea no muere en un punto, se la va comiendo la nube.
  · Molécula neutra ⇒ flujo por el infinito = 0 ⇒ NINGUNA línea escapa. Todas cierran.
  · Un dibujo de líneas solo dice la verdad si TODAS cargan el MISMO flujo Φ₀. Entonces, y
    solo entonces, densidad de líneas ∝ |E|. Esa es la regla que se había roto.

  Y el hecho cuantitativo que decide el diseño: casi TODO el flujo nuclear (4π·30 en el
  trímero) se lo come la nube por dentro. Lo que sobrevive afuera es la cola multipolar, que
  es minúscula en comparación. Por eso NO se puede usar un solo Φ₀ para el core y para la
  región de valencia: sembrando en los núcleos con un Φ₀ que dé ~1000 líneas totales, solo
  ~20 saldrían de la molécula. La solución correcta (y la estándar en química) es sembrar
  sobre la SUPERFICIE MOLECULAR y calibrar Φ₀ ahí.

  Superficie molecular = isosuperficie ρ_e = 0.002 u.a. (Bader, Carroll, Cheeseman & Chang,
  JACS 109, 7968 (1987) — la definición aceptada del volumen molecular). No es inventada:
  es literatura, y el gate de Gauss la valida numéricamente.

QUÉ HACE ESTE MÓDULO
  CampoMEP        E = −∇V EXACTO por integrales analíticas (int1e_grids_ip), no diferencias
                  finitas. Medido: las dif. finitas con h=0.03 metían hasta 0.77% de error.
  trazar          Cash–Karp RK45 de PASO ADAPTATIVO con control de error. El paso se encoge
                  solo donde el campo gira rápido. Cero suavizado: la curvatura es la real.
  sembrar_por_flujo   Semillas sobre ρ=0.002 con densidad ∝ |E·n̂| dA ⇒ toda línea carga el
                  mismo flujo ⇒ densidad de líneas ∝ |E|. Correspondencia lagrangiana entre
                  frames: la línea j es SIEMPRE el mismo rayo (núcleo, dirección).
  gates           Gauss en esferas, exactitud del campo, y EL TUBO DE FLUJO (abajo).

EL GATE QUE DECIDE SI EL CAMPO ES REAL — `tubo_de_flujo`:
  Tres líneas vecinas forman un tubo. Por Gauss, el flujo del tubo NO se conserva dentro de
  la molécula: decrece exactamente en la carga electrónica que el tubo se traga.
      dΦ/ds = 4π ρ_total A = −4π ρ_e A
  Si el trazador es correcto, Φ(s) + 4π∫ρ_e A ds' es CONSTANTE a lo largo del tubo. Eso no
  lo cumple un dibujo bonito: lo cumple un campo.
"""
import numpy as np

BOHR = 0.529177210903
RHO_SUP = 0.002          # u.a. — superficie molecular de Bader (JACS 1987)

# ¿HASTA DÓNDE SE DIBUJA UNA LÍNEA? Por MAGNITUD del campo, jamás por radio (el radio fue el
# bug de la versión vieja). Escalas físicas, para elegir con criterio y no con el gusto:
E_TERMICO = 0.00095      # kT a 300 K por bohr: debajo de esto el campo pierde ante el ruido térmico
E_PUENTE = 0.0080        # 5 kcal/mol por bohr = la energía de UN puente de hidrógeno.
                         # Es el corte que usa la serie del agua: se dibuja el campo capaz de
                         # hacer el trabajo del que habla el video, y nada más.


# ──────────────────────── EL CAMPO (cargas puntuales) ────────────────────────
class CampoPuntual:
    """E = Σ qᵢ(r−rᵢ)/|r−rᵢ|³. El caso con solución EXACTA: sirve de patrón para los gates y
    de escalera pedagógica (2, 3, 4, 5, 6 cargas) antes de creerle nada a una molécula."""

    def __init__(self, q, c):
        self.q = np.asarray(q, float); self.R = np.asarray(c, float); self.Z = self.q
        self.n_eval = 0

    def __call__(self, P):
        P = np.asarray(P, float).reshape(-1, 3); self.n_eval += len(P)
        d = P[:, None, :] - self.R[None]
        r = np.maximum(np.linalg.norm(d, axis=2), 1e-12)
        return (self.q[None, :, None] * d / (r ** 3)[:, :, None]).sum(axis=1)

    def psi(self, P):
        """Función de flujo de Stokes ψ = Σqᵢcosθᵢ. CONSTANTE sobre una línea — pero OJO,
        solo vale si las cargas están SOBRE UN EJE (el eje z). Para un anillo NO vale."""
        d = np.asarray(P, float).reshape(-1, 3)[:, None, :] - self.R[None]
        r = np.maximum(np.linalg.norm(d, axis=2), 1e-12)
        return (self.q[None, :] * d[:, :, 2] / r).sum(axis=1)


class CampoHidrogeno:
    """El átomo de hidrógeno 1s: un protón + SU nube. Cerrado y EXACTO, sin base ni SCF.

    Por simetría esférica, Gauss deja el campo en función de la carga ENCERRADA:
        ρ_e(r) = e^{-2r}/π                        (1s normalizada, u.a.)
        Q_e(r) = ∫₀^r ρ_e 4πr'² dr' = 1 − e^{-2r}(1 + 2r + 2r²)
        Q(r)   = 1 − Q_e(r) = e^{-2r}(1 + 2r + 2r²)      ← carga NETA dentro de r
        E(r)   = Q(r)/r² · r̂

    Los dos límites son la pieza entera: en r→0 queda E = 1/r², el protón DESNUDO; y como el
    átomo es NEUTRO, Q(r)→0 exponencialmente y el campo se apaga. La misma ley del hexágono
    cerrado, ahora en un átomo de verdad: afuera no queda nada que se escape.
    """

    def __init__(self):
        self.R = np.zeros((1, 3)); self.Z = np.array([1.0]); self.q = self.Z
        self.n_eval = 0

    def q_enc(self, r):
        return np.exp(-2 * r) * (1 + 2 * r + 2 * r * r)

    def __call__(self, P):
        P = np.asarray(P, float).reshape(-1, 3); self.n_eval += len(P)
        r = np.maximum(np.linalg.norm(P, axis=1), 1e-12)
        return (self.q_enc(r) / r ** 3)[:, None] * P


# ───────────────────────────────── EL CAMPO ─────────────────────────────────
class CampoMEP:
    """E(r) = −∇V, con V = Σ_A Z_A/|r−R_A| − ∫ρ_e(r')/|r−r'| d³r'  (u.a.).

    La parte electrónica se deriva ANALÍTICAMENTE con `int1e_grids_ip` (gradiente de las
    integrales de potencial respecto al punto de rejilla). El factor 2 es porque la derivada
    solo actúa sobre el bra y la matriz densidad es simétrica; verificado contra diferencias
    finitas ultra-finas (h=2e-4): error 3.4e-7, que es el error de LAS DIFERENCIAS, no del
    analítico. Ver gate `gate_campo_exacto`.
    """

    def __init__(self, mol, dm, chunk=1200):
        self.mol, self.dm, self.chunk = mol, dm, chunk
        self.R = mol.atom_coords()                       # bohr
        self.Z = mol.atom_charges().astype(float)
        self.n_eval = 0

    def __call__(self, P):
        P = np.ascontiguousarray(np.asarray(P, dtype=float).reshape(-1, 3))
        if len(P) == 0:
            return np.zeros((0, 3))
        self.n_eval += len(P)
        d = P[:, None, :] - self.R[None, :, :]
        r = np.maximum(np.linalg.norm(d, axis=2), 1e-10)
        E = (self.Z[None, :, None] * d / (r ** 3)[:, :, None]).sum(axis=1)   # −∇V_nuc
        for a in range(0, len(P), self.chunk):
            Q = np.ascontiguousarray(P[a:a + self.chunk])
            ip = self.mol.intor('int1e_grids_ip', grids=Q)
            E[a:a + self.chunk] += 2.0 * np.einsum('xgij,ij->xg', ip, self.dm).T   # +∇V_el
        return E

    def potencial(self, P, chunk=2000):
        P = np.ascontiguousarray(np.asarray(P, dtype=float).reshape(-1, 3))
        V = np.empty(len(P))
        for a in range(0, len(P), chunk):
            Q = np.ascontiguousarray(P[a:a + chunk])
            ints = self.mol.intor('int1e_grids', grids=Q)
            Vel = np.einsum('gij,ij->g', ints, self.dm)
            Vn = (self.Z[None, :] / np.maximum(np.linalg.norm(Q[:, None, :] - self.R[None], axis=2), 1e-10)).sum(axis=1)
            V[a:a + chunk] = Vn - Vel
        return V

    def rho(self, P, chunk=60000):
        P = np.ascontiguousarray(np.asarray(P, dtype=float).reshape(-1, 3))
        out = np.empty(len(P))
        for a in range(0, len(P), chunk):
            ao = self.mol.eval_gto('GTOval_sph', P[a:a + chunk])
            out[a:a + chunk] = np.einsum('gi,gi->g', ao @ self.dm, ao)
        return out

    def rho_grad(self, P, chunk=30000):
        """ρ_e y ∇ρ_e analíticos (para la normal exacta de la superficie molecular)."""
        P = np.ascontiguousarray(np.asarray(P, dtype=float).reshape(-1, 3))
        r = np.empty(len(P)); g = np.empty((len(P), 3))
        for a in range(0, len(P), chunk):
            ao = self.mol.eval_gto('GTOval_sph_deriv1', P[a:a + chunk])
            c = ao[0] @ self.dm
            r[a:a + chunk] = np.einsum('gi,gi->g', c, ao[0])
            g[a:a + chunk] = 2.0 * np.einsum('gi,xgi->gx', c, ao[1:4])
        return r, g


# ──────────────────────── TRAZADOR DE PASO ADAPTATIVO ────────────────────────
# Cash–Karp (Numerical Recipes §16.2): par encajado 5º/4º orden. La diferencia entre ambos
# ES el error local, y con él se ajusta el paso. Nada de paso fijo: junto a un núcleo el
# campo gira en ~0.3 bohr y un paso de 0.19 se come la esquina; lejos, 0.5 sobra.
_CK_B = [[], [1 / 5], [3 / 40, 9 / 40], [3 / 10, -9 / 10, 6 / 5],
         [-11 / 54, 5 / 2, -70 / 27, 35 / 27],
         [1631 / 55296, 175 / 512, 575 / 13824, 44275 / 110592, 253 / 4096]]
_CK_C5 = np.array([37 / 378, 0., 250 / 621, 125 / 594, 0., 512 / 1771])
_CK_C4 = np.array([2825 / 27648, 0., 18575 / 48384, 13525 / 55296, 277 / 14336, 1 / 4])

MOTIVO = {0: 'sigue viva (agotó pasos)', 1: 'campo débil (se la comió la nube)',
          2: 'entró a un núcleo', 3: 'salió de la caja', 4: 'largo máximo',
          5: 'agotó muestras'}


def trazar(campo, semillas, sentido=+1, tol=1e-8, h0=0.05, hmin=1.5e-3, hmax=0.55,
           s_max=34.0, e_min=2.5e-4, r_core=0.25, r_caja=17.0, nucleos=None,
           max_pasos=900, max_muestras=560, f_nuc=0.30, verbose=False):
    """Integra dr/ds = ±E/|E| con paso adaptativo. Devuelve (puntos, arco, n, motivo).

    NO amputa por radio desde el origen (ese era el bug): `r_caja` es una caja generosa y se
    reporta cuántas líneas la tocan. Los criterios de paro son FÍSICOS: campo débil (la nube
    se comió el tubo), o llegó a un núcleo (que es una fuente, no un sumidero).

    DOS COSAS QUE COSTARON UN GATE REPROBADO (G4, medido — no las quites):

    · `tol` es el error LOCAL de un paso, y el error de la línea es el ACUMULADO. Con
      tol=3e-4 el adaptativo daba una deriva de flujo de 2e-2, PEOR que el RK4 de paso fijo
      (9e-7): junto a una carga el campo es radial, la línea es RECTA, el estimador de error
      da ~0, el paso se dispara a hmax… y se come la curva de después. tol=1e-8 lo pone en
      ~1e-9 y aun así con MENOS evaluaciones que el paso fijo, porque donde la línea es recta
      sigue dando zancadas.
    · `f_nuc`: tope de paso h ≤ f_nuc·(distancia al núcleo más cercano). La escala del campo
      ES esa distancia; sin este tope el estimador se entera tarde.
    """
    S = np.ascontiguousarray(np.asarray(semillas, float).reshape(-1, 3))
    N = len(S)
    P = S.copy()
    h = np.full(N, h0); s = np.zeros(N); viva = np.ones(N, bool); motivo = np.zeros(N, int)
    SP = np.zeros((N, max_muestras, 3)); SS = np.zeros((N, max_muestras)); nm = np.zeros(N, int)
    SP[:, 0] = P; nm[:] = 1
    Rn = np.asarray(nucleos, float) if nucleos is not None else campo.R

    def u_hat(X):
        E = campo(X)
        n = np.linalg.norm(E, axis=1)
        u = np.where((n > e_min)[:, None], sentido * E / np.maximum(n, 1e-30)[:, None], 0.0)
        return u, n

    for paso in range(max_pasos):
        idx = np.flatnonzero(viva)
        if len(idx) == 0:
            break
        p = P[idx]; hh = h[idx][:, None]
        k = np.empty((6, len(idx), 3))
        k[0], n1 = u_hat(p)
        for st in range(1, 6):
            acc = np.zeros_like(p)
            for j, b in enumerate(_CK_B[st]):
                if b:
                    acc += b * k[j]
            k[st], _ = u_hat(p + hh * acc)
        y5 = p + hh * np.einsum('i,ijk->jk', _CK_C5, k)
        y4 = p + hh * np.einsum('i,ijk->jk', _CK_C4, k)
        err = np.linalg.norm(y5 - y4, axis=1)

        ok = (err <= tol) | (h[idx] <= hmin * 1.0001)
        # paso nuevo (control de Numerical Recipes) + TOPE FÍSICO: la escala del campo es la
        # distancia al núcleo más cercano, así que h nunca puede ser una fracción grande de ella
        fac = 0.9 * np.power(tol / np.maximum(err, 1e-18), 0.2)
        dmin = np.linalg.norm(p[:, None, :] - Rn[None], axis=2).min(axis=1)
        htop = np.minimum(hmax, np.maximum(f_nuc * dmin, hmin))
        h[idx] = np.clip(h[idx] * np.clip(fac, 0.2, 4.0), hmin, htop)

        ia = idx[ok]
        if len(ia):
            d = np.linalg.norm(y5[ok] - P[ia], axis=1)
            s[ia] += d
            P[ia] = y5[ok]
            j = nm[ia]
            SP[ia, np.minimum(j, max_muestras - 1)] = P[ia]
            SS[ia, np.minimum(j, max_muestras - 1)] = s[ia]
            nm[ia] = np.minimum(j + 1, max_muestras)

            # ── paro FÍSICO ──
            debil = n1[ok] <= e_min
            dnuc = np.linalg.norm(P[ia][:, None, :] - Rn[None], axis=2).min(axis=1)
            encore = dnuc < r_core
            fuera = np.linalg.norm(P[ia], axis=1) > r_caja
            largo = s[ia] > s_max
            sinmem = nm[ia] >= max_muestras
            stop = debil | encore | fuera | largo | sinmem
            if stop.any():
                sel = ia[stop]
                mot = np.where(debil[stop], 1, np.where(encore[stop], 2,
                      np.where(fuera[stop], 3, np.where(largo[stop], 4, 5))))
                motivo[sel] = mot
                viva[sel] = False
        if verbose and paso % 100 == 0:
            print(f"    paso {paso}: vivas {viva.sum()}/{N}  h medio {h[viva].mean() if viva.any() else 0:.3f}", flush=True)
    return SP, SS, nm, motivo


def remuestrear(SP, SS, nm, LP):
    """Puntos EQUIESPACIADOS EN ARCO (no en índice) → la línea se dibuja pareja."""
    N = len(nm)
    out = np.zeros((N, LP, 3))
    for i in range(N):
        n = max(int(nm[i]), 1)
        if n < 2 or SS[i, n - 1] <= 1e-9:
            out[i] = SP[i, 0]
            continue
        u = np.linspace(0.0, SS[i, n - 1], LP)
        for c in range(3):
            out[i, :, c] = np.interp(u, SS[i, :n], SP[i, :n, c])
    return out


def trazar_bidireccional(campo, semillas, LP=80, e_dibujo=None, **kw):
    """+E y −E desde la misma semilla, pegadas en UNA línea (de la carga + a la −).

    `e_dibujo`: si se da, la línea se recorta al TRAMO CONTINUO MÁS LARGO donde |E| ≥ e_dibujo.
    El corte es por MAGNITUD DE CAMPO, nunca por radio (el radio fue el bug de la versión
    vieja: una esfera de 6.6 bohr amputaba todo). Y se elige con una escala física declarada
    — ver E_PUENTE abajo.
    """
    Pf, Sf, nf, mf = trazar(campo, semillas, sentido=+1, **kw)
    Pb, Sb, nb, mb = trazar(campo, semillas, sentido=-1, **kw)
    N = len(semillas)
    total = np.zeros((N, LP, 3)); largo = np.zeros(N); viva = np.ones(N, bool)
    caminos = []
    for i in range(N):
        a = int(max(nb[i], 1)); b = int(max(nf[i], 1))
        caminos.append(np.vstack([Pb[i, :a][::-1], Pf[i, 1:b]]))
    if e_dibujo is not None:
        off = np.concatenate([[0], np.cumsum([len(c) for c in caminos])])
        nE = np.linalg.norm(campo(np.vstack(caminos)), axis=1)
        for i, cam in enumerate(caminos):
            ok = (nE[off[i]:off[i + 1]] >= e_dibujo).view(np.int8)
            d = np.diff(np.r_[0, ok, 0])
            ini = np.flatnonzero(d == 1); fin = np.flatnonzero(d == -1)
            if len(ini) == 0:
                viva[i] = False; continue
            j = int(np.argmax(fin - ini))
            if fin[j] - ini[j] < 3:
                viva[i] = False; continue
            caminos[i] = cam[ini[j]:fin[j]]
    for i, cam in enumerate(caminos):
        seg = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(cam, axis=0), axis=1))]
        largo[i] = seg[-1]
        if seg[-1] < 1e-9:
            total[i] = cam[0]; viva[i] = False
        else:
            u = np.linspace(0, seg[-1], LP)
            for c in range(3):
                total[i, :, c] = np.interp(u, seg, cam[:, c])
    # |E| EN CADA PUNTO DIBUJADO. Es lo que hace que la línea se APAGUE sola donde el campo
    # ya no importa, en vez de terminar cortada en el aire ("despeinada", Ian 2026-07-28).
    # Es la misma receta de la escalera de cargas puntuales, que sí se ve bien: nada se
    # recorta, el BRILLO lleva la intensidad.
    nE = np.linalg.norm(campo(total.reshape(-1, 3)), axis=1).reshape(len(total), LP)
    return total, largo, viva, nE, mf, mb


def intensidad_u8(nE, e_lo=1e-4, e_hi=0.30):
    """|E| → uint8 en escala LOGARÍTMICA (el campo abarca 4 décadas; lineal apagaría todo
    menos los núcleos). El shader multiplica el brillo por esto."""
    t = (np.log(np.maximum(nE, 1e-30)) - np.log(e_lo)) / (np.log(e_hi) - np.log(e_lo))
    return np.clip(np.round(np.clip(t, 0.0, 1.0) * 255), 0, 255).astype(np.uint8)


def superficie_en_rayos(campo, ia, id_, n_dir, rho_c=RHO_SUP, r_ini=0.40, r_fin=11.0, dr=0.14):
    """Los MISMOS rayos (núcleo, dirección) evaluados en OTRA geometría.

    Es lo que da la CORRESPONDENCIA LAGRANGIANA entre cuadros: la línea j es siempre el mismo
    rayo, así que al moverse las moléculas la línea se desliza suave en vez de brincar. La
    selección por flujo se hace UNA vez, en el cuadro de referencia (el anillo cerrado, que es
    el que cuenta la historia), y se reusa. Declarado: en los cuadros lejanos la ponderación
    por flujo ya no es exacta, y el error se reporta cuadro a cuadro.
    """
    D = _fibonacci(n_dir)
    Rn = campo.R
    rs = np.arange(r_ini, r_fin + 1e-9, dr)
    NR = len(rs)
    X = (Rn[ia][:, None, :] + rs[None, :, None] * D[id_][:, None, :]).reshape(-1, 3)
    rho = campo.rho(X).reshape(len(ia), NR)
    dentro = rho >= rho_c
    cruce = dentro[:, :-1] & ~dentro[:, 1:]
    hay = cruce.any(axis=1)
    ult = NR - 2 - np.argmax(cruce[:, ::-1], axis=1)
    lo = rs[np.clip(ult, 0, NR - 2)].astype(float); hi = lo + dr
    for _ in range(9):
        mid = 0.5 * (lo + hi)
        d_ = campo.rho(Rn[ia] + mid[:, None] * D[id_]) >= rho_c
        lo = np.where(d_, mid, lo); hi = np.where(d_, hi, mid)
    r = 0.5 * (lo + hi)
    return Rn[ia] + r[:, None] * D[id_], hay, r


# ─────────────────── SIEMBRA POR FLUJO SOBRE LA SUPERFICIE MOLECULAR ───────────────────
def _fibonacci(n):
    """Direcciones casi-uniformes en la esfera. FIJAS: son las mismas en todos los frames,
    y por eso la línea j es siempre el mismo rayo → cero parpadeo entre cuadros."""
    k = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * k / n)
    th = np.pi * (1 + 5 ** 0.5) * k
    return np.stack([np.cos(th) * np.sin(phi), np.sin(th) * np.sin(phi), np.cos(phi)], axis=1)


def superficie_molecular(campo, n_dir=1200, rho_c=RHO_SUP, r_ini=0.40, r_fin=11.0,
                         dr=0.14, k_part=8.0, cos_min=0.12):
    """La isosuperficie ρ_e = ρ_c, hallada por RAYOS desde cada núcleo (se toma el ÚLTIMO
    cruce = la envolvente EXTERNA). Devuelve para cada rayo:
        x   punto sobre la superficie      n   normal exacta −∇ρ/|∇ρ|
        dA  peso de área  r²ΔΩ/|n̂·d̂|      w   peso de partición (Σ_m w_m = 1)

    El peso de partición existe porque el mismo trozo de superficie lo ven varios núcleos:
    sin él se contaría el flujo dos o tres veces. w_m(x) ∝ |x−R_m|^−k normalizado es una
    partición de la unidad legítima (Σ=1) y suave — la idea es la de Becke (JCP 88, 2547).
    El gate de Gauss mide si la cuadratura quedó bien.
    """
    D = _fibonacci(n_dir)
    Rn = campo.R
    NA = len(Rn)
    rs = np.arange(r_ini, r_fin + 1e-9, dr)
    NR = len(rs)
    X = (Rn[:, None, None, :] + rs[None, None, :, None] * D[None, :, None, :]).reshape(-1, 3)
    rho = campo.rho(X).reshape(NA, n_dir, NR)
    dentro = rho >= rho_c
    # ÚLTIMO cruce dentro→fuera a lo largo del rayo
    cruce = dentro[:, :, :-1] & ~dentro[:, :, 1:]
    hay = cruce.any(axis=2)
    ult = NR - 2 - np.argmax(cruce[:, :, ::-1], axis=2)
    lo = np.where(hay, rs[np.clip(ult, 0, NR - 2)], np.nan)
    hi = lo + dr
    # bisección al valor exacto de ρ_c
    for _ in range(9):
        mid = 0.5 * (lo + hi)
        Xm = Rn[:, None, :] + mid[:, :, None] * D[None, :, :]
        rm = campo.rho(np.nan_to_num(Xm, nan=99.0).reshape(-1, 3)).reshape(NA, n_dir)
        dentro_m = rm >= rho_c
        lo = np.where(dentro_m, mid, lo); hi = np.where(dentro_m, hi, mid)
    r_sup = 0.5 * (lo + hi)
    val = hay & np.isfinite(r_sup)
    ia, id_ = np.nonzero(val)
    x = Rn[ia] + r_sup[ia, id_][:, None] * D[id_]
    dhat = D[id_]
    _, gr = campo.rho_grad(x)
    nrm = np.maximum(np.linalg.norm(gr, axis=1, keepdims=True), 1e-30)
    nhat = -gr / nrm                                   # ρ decrece hacia afuera ⇒ normal EXTERIOR
    dOm = 4 * np.pi / n_dir
    cosr = np.clip(np.abs((nhat * dhat).sum(axis=1)), cos_min, 1.0)
    dA = (r_sup[ia, id_] ** 2) * dOm / cosr
    d_all = np.maximum(np.linalg.norm(x[:, None, :] - Rn[None], axis=2), 1e-9)
    inv = d_all ** (-k_part)
    w = inv[np.arange(len(x)), ia] / inv.sum(axis=1)
    return dict(x=x, n=nhat, dA=dA, w=w, ray=(ia, id_), r=r_sup[ia, id_],
                clamp=float((np.abs((nhat * dhat).sum(axis=1)) < cos_min).mean()))


def sembrar_por_flujo(campo, sup, n_obj, offset=0.0, solo_salientes=True):
    """Elige n_obj rayos de modo que CADA línea cargue el MISMO flujo Φ₀. Muestreo sistemático
    sobre el flujo acumulado: determinista (sin RNG), reproducible cuadro a cuadro.

    `solo_salientes` (medido, no opinión): un tubo que SALE de Σ por un lado y vuelve a ENTRAR
    por otro cruza la superficie dos veces. Si se siembra en |E·n̂| (las dos cruzadas) y luego
    se traza bidireccional, ESE MISMO TUBO se dibuja DOS VECES. Medido sobre el trímero: la
    densidad de línea salía 1.86× la que manda la ley (≈2), y el flujo bruto 9.05 = 6.03
    saliente + 3.02 entrante, o sea que el flujo de tubos DISTINTOS es justo el saliente.
    Sembrando solo en las cruzadas salientes el factor baja a 1.28 y, con las mismas 1100
    líneas, se dibujan 1100 tubos distintos en vez de ~550 repetidos.
    (El 1.28 que queda son los tubos que salen de Σ más de una vez — entran por el hueco del
    anillo y vuelven a salir. Está medido y declarado, no escondido.)
    """
    E = campo(sup['x'])
    En = (E * sup['n']).sum(axis=1)
    phi = (np.maximum(En, 0) if solo_salientes else np.abs(En)) * sup['dA'] * sup['w']
    C = np.concatenate([[0.0], np.cumsum(phi)])
    T = C[-1]
    Phi0 = T / n_obj
    t = (np.arange(n_obj) + 0.5 + offset) * Phi0
    idx = np.clip(np.searchsorted(C, t, side='right') - 1, 0, len(phi) - 1)
    dup = len(idx) - len(np.unique(idx))
    return idx, Phi0, dict(flujo_bruto=T, En=En, phi=phi, duplicados=dup,
                           flujo_neto=float((En * sup['dA'] * sup['w']).sum()))


# ───────────────────────────────── GATES ─────────────────────────────────
def flujo_esfera(campo, centro, radio, n_dir=2000):
    """∮E·n̂ dA sobre una esfera, por cuadratura de Fibonacci. Por Gauss vale 4π·Q_enc."""
    D = _fibonacci(n_dir)
    X = np.asarray(centro, float)[None, :] + radio * D
    E = campo(X)
    return float((E * D).sum(axis=1).mean() * 4 * np.pi * radio ** 2)


def carga_encerrada(campo, centro, radio, n_rad=60, n_dir=770):
    """Z_enc − ∫ρ_e dentro de la esfera (cuadratura Gauss-Legendre radial × Fibonacci)."""
    xg, wg = np.polynomial.legendre.leggauss(n_rad)
    r = 0.5 * radio * (xg + 1); wr = 0.5 * radio * wg
    D = _fibonacci(n_dir)
    X = (np.asarray(centro, float)[None, None, :] + r[:, None, None] * D[None, :, :]).reshape(-1, 3)
    rho = campo.rho(X).reshape(n_rad, n_dir)
    Ne = float((rho.mean(axis=1) * 4 * np.pi * r ** 2 * wr).sum())
    dn = np.linalg.norm(campo.R - np.asarray(centro, float)[None, :], axis=1)
    Zin = float(campo.Z[dn < radio].sum())
    return Zin - Ne, Zin, Ne


def tubo_de_flujo(campo, semilla, eps=0.02, LP=None, **kw):
    """EL GATE QUE DECIDE. Un tubo de 3 líneas vecinas: por Gauss su flujo debe decrecer
    EXACTAMENTE en la carga electrónica que se traga.

        dΦ/ds = ∇·E · A = −4π ρ_e A       ⇒   Φ(s) + 4π∫₀ˢ ρ_e A ds'  =  const

    Devuelve s, Φ(s), la integral de carga, y el residuo relativo. Un dibujo bonito no
    cumple esto; un campo sí.
    """
    x0 = np.asarray(semilla, float)
    E0 = campo(x0[None])[0]
    e = E0 / np.linalg.norm(E0)
    a = np.cross(e, [0., 0., 1.])
    if np.linalg.norm(a) < 1e-6:
        a = np.cross(e, [0., 1., 0.])
    a /= np.linalg.norm(a); b = np.cross(e, a)
    S = np.array([x0, x0 + eps * a, x0 + eps * (0.5 * a + 0.8660254 * b)])
    SP, SS, nm, mot = trazar(campo, S, sentido=+1, **kw)
    if nm.min() < 6:
        return None
    # OJO (bug que costó un gate): las 3 líneas se integran con pasos ADAPTATIVOS distintos,
    # así que la muestra i de una NO está al mismo arco que la muestra i de otra. Hay que
    # remuestrear las tres sobre el MISMO arco antes de medir la sección del tubo.
    s_com = min(float(SS[j, int(nm[j]) - 1]) for j in range(3))
    s = SS[0, :int(nm[0])]
    s = s[s <= s_com]
    if len(s) < 6:
        return None
    p = np.zeros((3, len(s), 3))
    for j in range(3):
        nj = int(nm[j])
        for c in range(3):
            p[j, :, c] = np.interp(s, SS[j, :nj], SP[j, :nj, c])
    Ec = campo(p[0])
    nE = np.linalg.norm(Ec, axis=1)
    eh = Ec / np.maximum(nE, 1e-30)[:, None]
    u = p[1] - p[0]; v = p[2] - p[0]
    u = u - (u * eh).sum(axis=1)[:, None] * eh               # proyecta ⊥ al campo
    v = v - (v * eh).sum(axis=1)[:, None] * eh
    A = 0.5 * np.linalg.norm(np.cross(u, v), axis=1)
    Phi = nE * A
    rho = campo.rho(p[0])
    carga = np.concatenate([[0.0], np.cumsum(0.5 * (rho[1:] * A[1:] + rho[:-1] * A[:-1]) * np.diff(s))])
    inv = Phi + 4 * np.pi * carga
    res = float(np.abs(inv - inv[0]).max() / max(abs(inv[0]), 1e-30))
    return dict(s=s, Phi=Phi, A=A, carga=carga, invariante=inv, residuo=res,
                Phi0=float(Phi[0]), Phi_fin=float(Phi[-1]), q_tragada=float(carga[-1]),
                caida=float(1 - Phi[-1] / max(Phi[0], 1e-30)), motivo=int(mot[0]))
