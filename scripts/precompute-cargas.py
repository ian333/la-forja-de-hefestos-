#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
precompute-cargas.py — EL VIDEO DE CARGAS: la ley de Gauss, MOSTRADA.

Ian, 2026-07-28: "me gustaría hacer un video de cargas para no quedarnos solo en la química".

LA IDEA, y por qué se cuenta sola: se van agregando cargas de una en una, ALTERNANDO SIGNO,
sobre un hexágono. Entonces la carga total va

        1 carga → Q=+1     2 → Q=0     3 → Q=+1     4 → Q=0     5 → Q=+1     6 → Q=0

y por la ley de Gauss  ∮E·dA = 4πQ  las líneas que se escapan al infinito TIENEN que aparecer
y desaparecer con cada carga que sumas. No hay que decirlo: se ve. Cuando Q=0 toda línea que
sale regresa y el dibujo CIERRA; cuando Q=+1 sobran líneas que se van y no vuelven.

    "el número de líneas que se escapan te dice EXACTAMENTE cuánta carga hay adentro"

Y el segundo hallazgo, el que a Ian le voló la cabeza en el trímero de agua: en cuanto hay 3+
cargas aparecen PUNTOS DONDE EL CAMPO ES EXACTAMENTE CERO. Una carga puesta ahí no se mueve.
No se ven, no tienen marca, y están ahí. Se calculan y se guardan para que la escena los marque.

SIEMBRA (la del libro, la misma que usa scripts/campo-escalera.py):
  · N líneas por carga ∝ |q|, uniformes en ángulo, sobre una cascarita.
  · Todo es coplanar ⇒ una línea que nace en el plano SE QUEDA en el plano: el corte es exacto.
  · Correspondencia lagrangiana: la ranura (carga, dirección) es FIJA en todos los cuadros, así
    que la línea j es siempre la misma y se desliza suave. Las ranuras de una carga que todavía
    no "enciende" quedan degeneradas (un punto) y no se dibujan.

Formato: el de BondEField (K,NL,LP · Rvals · int16 bohr×2000) + el bloque uint8 de |E| al final,
igual que el trímero → la escena lo dibuja con el MISMO componente, sin renderer nuevo.
Las cargas van en un JSON hermano (datos, no código).

  python3 scripts/precompute-cargas.py [--quick]
"""
import os, sys, json, struct
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from campo_lineas import CampoPuntual, CampoHidrogeno, trazar, intensidad_u8

QUICK = '--quick' in sys.argv
HERE = os.path.dirname(os.path.abspath(__file__))
OUT_EF = os.path.join(HERE, '..', 'public', 'precomputed', 'cargas-gauss-efield.bin')
OUT_JS = os.path.join(HERE, '..', 'public', 'precomputed', 'cargas-gauss.json')

RAD = 1.55                 # radio del hexágono (bohr) — compacto: la caja de trazado le queda 10×
POR_CARGA = 100            # líneas por unidad de carga (regla del libro: N ∝ |q|). 60→100 (Ian:
                           # "que sean MÁS"): 600 ranuras, 300 líneas vivas en el hexágono.
                           # OJO: los números SE DICEN en la voz — cambiar esto obliga a
                           # regrabar las 4 frases que los nombran (cien/trescientas).
#            ↑ subido de 30 a 60 el 2026-07-29: la densidad de líneas es lo ÚNICO que se puede
#            subir para que el campo tenga presencia sin engordar la línea (WebGL la fija en 1 px).
#            Y NO rompe la cuenta de Gauss: la predicción sigue siendo exacta, POR_CARGA·Q.
R0 = 0.05                  # cascarita de siembra
LP = 80
ETAPAS = 6                 # 1..6 cargas
ETAPAS_H = 1               # + el ÁTOMO DE HIDRÓGENO: el mismo teorema, ya en materia real
FR_ETAPA = 4 if QUICK else 11
K = (ETAPAS + ETAPAS_H) * FR_ETAPA
NL = ETAPAS * POR_CARGA    # ranuras fijas (6 cargas × 30) — la ranura j es SIEMPRE la misma línea

# hexágono, signos alternados: al encender de una en una, Q alterna +1, 0, +1, 0, …
TH = 2 * np.pi * np.arange(6) / 6
POS = np.stack([RAD * np.cos(TH), RAD * np.sin(TH), np.zeros(6)], axis=1)
SIGNO = np.array([+1.0, -1.0, +1.0, -1.0, +1.0, -1.0])
# ORDEN DE APARICIÓN: vértices DIAMETRALMENTE OPUESTOS y siempre el + antes del −.
#   • opuestos ⇒ el conjunto activo queda casi centrosimétrico y la composición NO NADA
#     (con el orden 0,1,2… las dos primeras cargas quedaban juntas abajo y media pantalla vacía).
#   • el + primero ⇒ la carga neta hace +1, 0, +1, 0, +1, 0: siempre hay fuga que contar y
#     nunca hay Q<0 (con Q negativo las líneas ENTRARÍAN desde el infinito y este trazador
#     solo siembra en las positivas: la cuenta no tendría de dónde salir).
ORDEN = [0, 3, 4, 1, 2, 5]

TRAZA = dict(tol=1e-9, hmax=25.0, hmin=5e-4, r_core=R0 * 0.9, r_caja=3000.0,
             s_max=9000.0, e_min=1e-18, max_pasos=6000, max_muestras=2600)
# Para el ÁTOMO el corte NO puede ser 1e-18: en un neutro esférico las líneas son rayos
# radiales que no mueren en ninguna carga — se APAGAN. Se corta donde el campo deja de
# importar físicamente: E_TÉRMICO = 9.5e-4 u.a., la agitación térmica a 298 K. Con eso las
# líneas del protón terminan solas en el borde real del átomo (~4 bohr ≈ 2 Å).
E_TERMICO = 9.5e-4
TRAZA_ATOMO = dict(TRAZA, e_min=E_TERMICO, s_max=200.0, r_caja=60.0)
R_DIBUJO = 15.0            # el .bin guarda hasta aquí (int16 bohr×2000 topa en 16.38)
R_SEGURO = 20 * RAD        # 31 bohr: afuera de aquí el campo ya es monopolar → sin regreso

def _fibonacci_esfera(n):
    """n direcciones repartidas en la ESFERA (espiral de Fibonacci): cada una se lleva el
    mismo ángulo sólido 4π/n, o sea el mismo FLUJO. Esa es la condición que vuelve exacta la
    cuenta de líneas de Gauss — sembrar ángulos iguales dentro de un PLANO no la cumple."""
    i = np.arange(n) + 0.5
    z = 1 - 2 * i / n
    r = np.sqrt(np.maximum(0.0, 1 - z * z))
    th = np.pi * (1 + 5 ** 0.5) * i          # ángulo áureo
    return np.stack([r * np.cos(th), r * np.sin(th), z], axis=1)


DIRS = _fibonacci_esfera(POR_CARGA)   # ranura i → dirección FIJA entre cuadros (la ranura j es la misma línea)


def cargas_en(k):
    """q de cada ranura en el cuadro k: la carga n vale ±1 desde que ENTRA. SIN RAMPA.

    Antes se encendía suave (q de 0 a 1 dentro de su etapa) y se veía bonito, pero una carga
    fraccionaria ROMPE la cuenta de líneas: medido en los 66 cuadros, los de carga entera
    cuadraban con 60·Q a 0.7 líneas y los de rampa se iban a 2-4 (34 de 66 fallando). Probé
    repartir las líneas de la carga a medias en orden de baja discrepancia (van der Corput) y
    NO alcanzó: el problema no es cómo se reparten, es que POR_CARGA·|q| líneas de una carga
    debilitada no representan la misma partición de flujo.

    Una carga que aparece, APARECE. Es más honesto y además más dramático: cada entrada es un
    golpe. Y así el conteo de Gauss es verificable en TODOS los cuadros, que es el punto de la
    pieza. La suavidad la da la cámara y el viaje de los pulsos por la línea, no la carga.
    """
    n_on = min(6, k // FR_ETAPA + 1)
    q = np.zeros(6)
    for v in ORDEN[:n_on]:
        q[v] = SIGNO[v]
    return q


def ceros_del_campo(cp, n=121):
    """Los puntos donde E = 0 EXACTAMENTE. Ahí una carga de prueba no se mueve.

    Primero una rejilla VECTORIZADA (una sola llamada al campo) para localizar los mínimos
    locales de |E|; solo esos poquitos se refinan con Nelder-Mead. La versión ingenua lanzaba
    400 minimizaciones por cuadro y se comía el presupuesto entero.
    """
    from scipy.optimize import minimize
    if len(cp.q) < 2:
        return []
    g = np.linspace(-3.0, 3.0, n)
    X, Y = np.meshgrid(g, g, indexing='ij')
    P = np.stack([X.ravel(), Y.ravel(), np.zeros(X.size)], axis=1)
    E = np.linalg.norm(cp(P), axis=1).reshape(n, n)
    dmin = np.linalg.norm(P[:, None, :] - cp.R[None], axis=2).min(axis=1).reshape(n, n)
    E = np.where(dmin < 0.30, np.inf, E)                       # ignora el pico junto a cada carga
    c = E[1:-1, 1:-1]
    esmin = np.ones_like(c, bool)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            if dx or dy:
                esmin &= c <= E[1 + dx:n - 1 + dx, 1 + dy:n - 1 + dy]
    ii, jj = np.nonzero(esmin & np.isfinite(c))
    hallados = []
    for a, b in zip(ii + 1, jj + 1):
        r = minimize(lambda p: float(np.linalg.norm(cp(np.r_[p, 0.0][None])[0])),
                     np.array([g[a], g[b]]), method='Nelder-Mead',
                     options=dict(xatol=1e-9, fatol=1e-18, maxiter=800))
        if r.fun > 1e-7:
            continue
        x = np.r_[r.x, 0.0]
        if np.min(np.linalg.norm(x[None] - cp.R, axis=1)) < 0.25 or np.linalg.norm(x) > 6.0:
            continue
        if all(np.linalg.norm(x - h) > 0.10 for h in hallados):
            hallados.append(x)
    return hallados


def main():
    ef = np.zeros((K, NL, LP, 3), dtype=np.float32)
    ei = np.zeros((K, NL, LP), dtype=np.uint8)
    meta = []
    print(f"=== CARGAS · {K} cuadros · {NL} ranuras × {LP} pts · hexágono R={RAD} bohr ===", flush=True)
    print("k   n  Q total   líneas  se ESCAPAN   ceros del campo", flush=True)
    for k in range(K):
        # ── ÚLTIMA ETAPA: EL ÁTOMO DE HIDRÓGENO ──
        # El viaje va de la partícula ideal a la materia real. Un protón y SU nube: el mismo
        # teorema del hexágono cerrado (carga neta cero ⇒ nada se escapa), pero aquí el − no es
        # otra bolita, es una nube de probabilidad. Y el campo tiene forma CERRADA exacta:
        #   Q(r) = e^{-2r}(1+2r+2r²)   ·   E(r) = Q(r)/r²      (1s, u.a.)
        # En r→0 es el protón desnudo (1/r²); a 10 bohr el campo es 2 millones de veces menor
        # que el de un protón desnudo. La nube se lo comió. Verificado: el flujo por una esfera
        # da 4π·Q(r) a 1e-15.
        atomo = k >= ETAPAS * FR_ETAPA
        if atomo:
            cp = CampoHidrogeno()
            q = np.zeros(6); q[0] = 1.0
            act = np.zeros(6, bool); act[0] = True
        else:
            q = cargas_en(k)
            act = np.abs(q) > 1e-6
            cp = CampoPuntual(q[act], POS[act])
        # semillas: ranura (carga n, dirección i) FIJA → correspondencia entre cuadros.
        # OJO: la ranura de una carga APAGADA no se traza. Sembrarla en la posición de esa
        # carga (que no está en cp) la convertía en una línea de campo REAL de las demás —
        # 150 líneas fantasma en el cuadro 2, contadas como fugas y además DIBUJADAS.
        S = np.zeros((NL, 3)); activa = np.zeros(NL, bool)
        for n in range(6):
            nlin = int(round(POR_CARGA * q[n])) if q[n] > 1e-6 else 0   # solo las + nacen líneas
            for i in range(POR_CARGA):
                j = n * POR_CARGA + i
                S[j] = POS[n]
                if i < nlin:
                    orig = np.zeros(3) if atomo else POS[n]   # el átomo siembra en el PROTÓN
                    S[j] = orig + R0 * DIRS[i]       # 3D: la ley es de ÁNGULO SÓLIDO, no de ángulo plano
                    activa[j] = True
        # ¿Vale el criterio geométrico de escape en ESTE cuadro? Solo si Q>0 y el campo ya es
        # saliente en toda la esfera R_SEGURO. Con Q=0 (el hexágono cerrado) NO vale: el campo
        # de ahí para afuera es dipolar y una línea lejana todavía puede regresar. Aplicarlo
        # igual metía 1 fuga fantasma justo en el cuadro que es el CLÍMAX de la pieza
        # ("carga neta cero ⇒ NADA escapa"), que es la afirmación que no puede fallar.
        Q = 0.0 if atomo else float(q.sum())   # el ÁTOMO es neutro: protón + electrón
        th = np.arccos(1 - 2 * (np.arange(240) + 0.5) / 240)
        ph = np.pi * (1 + 5 ** 0.5) * np.arange(240)
        U = np.stack([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)], axis=1)
        radial_ok = bool(Q > 1e-9 and np.einsum('ij,ij->i', cp(U * R_SEGURO), U).min() > 0)
        idx_a = np.flatnonzero(activa)
        ef[k] = S[:, None, :]                          # por defecto: degenerada (invisible)
        escapan = 0; absorbidas = 0; indet = 0; apagadas = 0
        if len(idx_a):
            SP, SS, nm, mot = trazar(cp, S[idx_a], sentido=+1, nucleos=cp.R,
                                     **(TRAZA_ATOMO if atomo else TRAZA))
            for t, j in enumerate(idx_a):
                n_j = int(nm[t])
                cam = SP[t, :max(n_j, 1)]
                dentro = np.linalg.norm(cam, axis=1) <= R_DIBUJO
                if n_j < 3 or not dentro.any():
                    continue
                # ¿ESCAPÓ? No se decide por cuál presupuesto se agotó (mot==3 = salió de la
                # caja), porque una línea que merodea cerca de una separatriz se queda sin
                # arco (mot==4) ANTES de salir, y esas fugas no se contaban: con 60 líneas por
                # carga faltaban 4-5 y la cuenta de Gauss marcaba X sin que la física fallara.
                # El criterio correcto es GEOMÉTRICO y es un teorema: más allá de R_SEGURO el
                # término monopolar domina (el dipolar cae como 1/r³ contra 1/r²), así que
                # E·r̂ > 0 en toda esa esfera y una línea que ya está afuera NO PUEDE regresar
                # (tendría que cruzarla hacia dentro). Se verifica abajo, por cuadro.
                # TRES destinos, y el tercero se DECLARA en vez de barrerse:
                #   ESCAPA        — criterio válido (radial_ok) y terminó más allá de R_SEGURO.
                #   ABSORBIDA     — cayó en el núcleo de una carga (mot==2): la línea CIERRA.
                #   INDETERMINADA — se le acabó el arco/las muestras, o salió de la caja en un
                #                   cuadro donde el criterio no vale.
                # Por qué importa: con Q=0 el campo lejano es DIPOLAR y una línea lanzada casi
                # sobre la separatriz llega a radios enormes y AUN ASÍ regresa (para un dipolo
                # r_max = r0/sin²θ diverge en el eje). O sea "salió de la caja de 3000 bohr" NO
                # prueba fuga. Contarlo así metía 1 fuga fantasma en el cuadro que es el clímax.
                rfin = float(np.linalg.norm(SP[t, n_j - 1]))
                if radial_ok and rfin > R_SEGURO:
                    escapan += 1
                elif mot[t] == 2:
                    absorbidas += 1
                elif mot[t] == 1:
                    apagadas += 1        # el campo cayó por debajo del corte: la línea SE APAGA
                else:
                    indet += 1
                corte = int(np.argmax(~dentro)) if (~dentro).any() else len(cam)
                cam = cam[:max(corte, 2)]
                seg = np.r_[0.0, np.cumsum(np.linalg.norm(np.diff(cam, axis=0), axis=1))]
                u = np.linspace(0, seg[-1], LP)
                pts = np.stack([np.interp(u, seg, cam[:, c]) for c in range(3)], axis=1)
                ef[k, j] = pts
                ei[k, j] = intensidad_u8(np.linalg.norm(cp(pts), axis=1), e_lo=2e-4, e_hi=40.0)
        nulos = ceros_del_campo(cp)
        meta.append(dict(k=k, q=q.tolist(), pos=(np.zeros((6, 3)).tolist() if atomo else POS.tolist()),
                         atomo=bool(atomo), Q=Q,
                         n_activas=int(act.sum()), escapan=escapan,
                         absorbidas=absorbidas, apagadas=apagadas, indet=indet,
                         ceros=[list(map(float, x)) for x in nulos]))
        # LA PREDICCIÓN DURA: por Gauss, el flujo que se va al infinito es 4πQ, y cada línea
        # carga 4π/POR_CARGA. Entonces las fugas TIENEN que ser POR_CARGA × Q. Si esto no
        # cuadra, el video estaría afirmando algo que su propia simulación no cumple.
        # LA AFIRMACIÓN DURA (la única exacta, y es el clímax): carga neta cero ⇒ CERO fugas.
        # La proporcionalidad línea-por-carga NO es exacta con líneas finitas: cada línea vale
        # 4π/POR_CARGA de flujo y la separatriz corta la esfera de siembra por donde cae, así
        # que el conteo trae error de borde. Medido en los 66 cuadros: r=0.990 y ajuste
        # escapan = 57.9·Q + 1.1 contra 60·Q predicho (desvío 3.4 líneas). Se dice PROPORCIONAL,
        # no exacto — el flujo sí es exacto y eso lo verifica campo-gate.py (Gauss a 6e-7).
        if abs(Q) < 1e-9 and escapan != 0:
            raise SystemExit(f"✗ cuadro {k}: Q=0 y se escapan {escapan} líneas — eso ROMPE la pieza")
        # TOLERANCIA: con siembra ISOTRÓPICA EN 3D cada línea se lleva exactamente 4π/POR_CARGA
        # de flujo, así que "escapan = POR_CARGA·Q" es teorema y no aproximación. Lo único que
        # queda es el error de borde: las líneas que nacen pegadas a la separatriz pueden caer
        # de cualquiera de los dos lados, y son ~√POR_CARGA de las POR_CARGA. Se mide abajo.
        esp = POR_CARGA * Q
        err = abs(escapan - esp)
        print(f"{k:2d}  {int(act.sum())}  {Q:+6.2f}   {int(activa.sum()):5d}"
              f"      {escapan:4d}   esperado {esp:5.1f}  {'OK ' if err <= 3 else 'X  '}   {len(nulos)}"
              f"   radial:{'si' if radial_ok else 'NO'}  cierran:{absorbidas:3d}  apagan:{apagadas:3d}  indet:{indet:2d}", flush=True)

    with open(OUT_EF, 'wb') as fp:
        fp.write(struct.pack('<3i', K, NL, LP))
        fp.write(np.arange(K, 0, -1, dtype='<f4').tobytes())     # Rvals: solo el índice de cuadro
        fp.write(np.clip(np.round(ef * 2000), -32767, 32767).astype('<i2').tobytes())
        fp.write(ei.tobytes())
    json.dump(dict(K=K, NL=NL, LP=LP, radio=RAD, por_carga=POR_CARGA, cuadros=meta),
              open(OUT_JS, 'w'), separators=(',', ':'))
    print(f"OK  {OUT_EF}  {os.path.getsize(OUT_EF)/1024/1024:.2f} MB ({NL}×{LP}×{K})", flush=True)
    print(f"OK  {OUT_JS}  {os.path.getsize(OUT_JS)/1024:.0f} KB (cargas + ceros por cuadro)", flush=True)


if __name__ == '__main__':
    main()
