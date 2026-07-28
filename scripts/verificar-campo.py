#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""verificar-campo.py — PORTERO DE LOS CAMPOS (eléctrico HOY, magnético mañana).

Por qué existe (Ian, 2026-07-27): "el campo del trímero está mal y ES OTRA VEZ UN RETROCESO,
porque el dilitio y el dímero YA lo tenían bien: no es continuo y no es denso como el dímero.
Hace falta verificación del campo en el pipeline, porque habrá otros con campo magnético".

Mide lo que define un campo BIEN DIBUJADO (las reglas ya ganadas con Li₂, ver
reference_serie_enlaces_pipeline): las líneas de fuerza son CONTINUAS (no se cortan en el
aire), SUAVES (sin picos ni zigzag), DENSAS (llenan el volumen) y VIVAS (no semillas muertas).

  python3 scripts/verificar-campo.py <campo.bin> [--ref <referencia.bin>] [--png <dir>]

Formato (BondEField, el de Li₂/dímero/trímero): int32 K,NL,LP · float32[K] Rvals ·
int16 líneas (bohr×2000) de forma [K][NL][LP][3].
"""
import sys, os, struct
import numpy as np

RUTA = sys.argv[1]
REF = sys.argv[sys.argv.index('--ref') + 1] if '--ref' in sys.argv else None
PNGDIR = sys.argv[sys.argv.index('--png') + 1] if '--png' in sys.argv else None

def leer(p):
    with open(p, 'rb') as fp:
        K, NL, LP = struct.unpack('<3i', fp.read(12))
        R = np.frombuffer(fp.read(K * 4), dtype='<f4')
        L = np.frombuffer(fp.read(K * NL * LP * 3 * 2), dtype='<i2').astype(np.float64) / 2000.0
    return K, NL, LP, R, L.reshape(K, NL, LP, 3)

def metricas(K, NL, LP, R, L, etiqueta, nuc=None):
    """Métricas con las FÓRMULAS de geometría diferencial y las reglas del libro de física.

    NADA de heurísticas inventadas. El "ángulo entre segmentos" que usaba antes es kappa*ds:
    mide curvatura MULTIPLICADA por el espaciado, así que penaliza las líneas LARGAS, no las
    rugosas. Por eso daba ~11% pasara lo que pasara (las del anillo miden 9 bohr contra 7.2
    del dímero, con los mismos 40 puntos).

      · CURVATURA (Frenet):   kappa = |r1 x r2| / |r1|^3     [bohr^-1, INDEPENDIENTE del muestreo]
      · TORSION:              tau = (r1 x r2).r3 / |r1 x r2|^2
      · REGLA 1 del libro:    la línea NACE en carga + (H) y MUERE en carga - (O);
                              en un sistema NEUTRO ninguna se escapa al infinito.
      · CONTINUIDAD:          paso constante (arco uniforme) => sin cortes.
      · DENSIDAD (regla 4):   proxy = ocupación del volumen.
    """
    P = L[K - 1]
    d = np.linalg.norm(np.diff(P, axis=1), axis=2)
    largo = d.sum(axis=1)
    vivas = largo >= 0.35
    muertas = (~vivas).mean() * 100
    paso_med = np.median(d[d > 1e-6]) if (d > 1e-6).any() else 0.0
    salto = (d > max(paso_med * 3.0, 1e-6)).mean() * 100

    Q = P[vivas]
    ds = np.maximum(np.linalg.norm(np.diff(Q, axis=1), axis=2).mean(axis=1, keepdims=True), 1e-9)
    r1 = np.gradient(Q, axis=1) / ds[:, :, None]
    r2 = np.gradient(r1, axis=1) / ds[:, :, None]
    cx = np.cross(r1, r2)
    kappa = np.linalg.norm(cx, axis=2) / np.maximum(np.linalg.norm(r1, axis=2) ** 3, 1e-12)
    k_med = float(np.median(kappa)); k_p95 = float(np.percentile(kappa, 95))
    r3 = np.gradient(r2, axis=1) / ds[:, :, None]
    tau = (cx * r3).sum(axis=2) / np.maximum(np.linalg.norm(cx, axis=2) ** 2, 1e-12)
    t_med = float(np.median(np.abs(tau)))

    # ── DETECTOR DE AMPUTACIÓN (el defecto que tuvo este proyecto y no se vio en meses) ──
    # Si un trazador corta las líneas contra una esfera de radio fijo, MUCHOS finales caen
    # exactamente al mismo radio. En el .bin viejo del trímero el radio MÁXIMO de todo punto
    # era 6.60 bohr clavado: era la pared `maxlen`. Esto lo caza sin saber nada del trazador.
    rfin = np.linalg.norm(Q[:, -1, :], axis=1)
    rmax_todo = float(np.linalg.norm(Q.reshape(-1, 3), axis=1).max())
    pared = float((np.abs(rfin - rmax_todo) < 0.01 * max(rmax_todo, 1e-9)).mean() * 100)

    # OJO — CAMBIÓ EL CRITERIO (2026-07-27): la siembra ya no es "una cáscara alrededor de cada
    # H", es la SUPERFICIE MOLECULAR ρ=0.002 con densidad ∝ flujo, y la línea se recorta donde
    # |E| baja del umbral del puente de H. Entonces una línea NO tiene por qué nacer pegada a
    # un H: nace donde el flujo la puso. Medir "% que nace en H" contra el esquema nuevo daba
    # una regresión FALSA. Lo que sí sigue significando algo es de qué lado MUERE (δ− = la
    # nube del O), y eso se conserva. La prueba dura de la siembra es G7 de campo-gate.py
    # (densidad de líneas = |E|/Φ₀), que necesita la molécula y por eso vive allá.
    nace = muere = float('nan')
    if nuc is not None and len(nuc) >= 3:
        Os = np.array([nuc[3 * k] for k in range(len(nuc) // 3)])
        Hs = np.array([nuc[i] for i in range(len(nuc)) if i % 3 != 0])
        ini = Q[:, 0, :]; fin = Q[:, -1, :]
        dHi = np.linalg.norm(ini[:, None, :] - Hs[None], axis=2).min(axis=1)
        dOi = np.linalg.norm(ini[:, None, :] - Os[None], axis=2).min(axis=1)
        dOf = np.linalg.norm(fin[:, None, :] - Os[None], axis=2).min(axis=1)
        dHf = np.linalg.norm(fin[:, None, :] - Hs[None], axis=2).min(axis=1)
        # la línea va del lado δ+ al lado δ−: empieza más cerca de un H y acaba más cerca de un O
        nace = (dHi < dOi).mean() * 100
        muere = (dOf < dHf).mean() * 100

    # DENSIDAD con celda de tamaño FIJO EN BOHR, no 24³ del bounding box.
    # La versión vieja normalizaba por la caja de cada campo, así que un campo que llega MÁS
    # LEJOS salía castigado: sus celdas eran más grandes. Medido el 2026-07-28 — el trímero
    # nuevo daba 14.6% contra 21.3% del dímero y el gate lo reprobaba, pero con celda fija de
    # 0.8 bohr cubre MÁS volumen que la referencia (1383 vs 1159 bohr³). Era artefacto de
    # escala, no calidad. Ahora se reporta el VOLUMEN CUBIERTO, que sí es comparable entre
    # moléculas distintas.
    LADO = 0.8
    pts = Q.reshape(-1, 3)
    celdas = len(set(map(tuple, np.floor(pts / LADO).astype(int))))
    ocup = celdas * LADO ** 3

    print("-- %s --" % etiqueta)
    print("  lineas %d x %d puntos - %d frames - largo mediano %.2f bohr" % (NL, LP, K, np.median(largo[vivas])))
    print("  CURVATURA kappa=|r1xr2|/|r1|^3   mediana %.3f  p95 %.3f  bohr-1   [indep. del muestreo]" % (k_med, k_p95))
    print("  TORSION |tau| mediana            %.3f bohr-1" % t_med)
    print("  nace del lado + (mas cerca de H): %5.1f %%" % nace)
    print("  muere del lado - (la nube del O): %5.1f %%   [libro: alto; la nube, no el nucleo]" % muere)
    print("  semillas muertas:                %5.1f %%   [bien: <10]" % muertas)
    print("  saltos (linea CORTADA):          %5.2f %%   [bien: <0.5]" % salto)
    print("  VOLUMEN cubierto (celda 0.8 bohr):%7.0f bohr3  [mas = mejor; comparable entre moleculas]" % ocup)
    print("  AMPUTACION - finales en la pared: %5.1f %%  de r=%.2f bohr   [bien: <2; >10 = hay muro]"
          % (pared, rmax_todo))
    return dict(kappa=k_med, k95=k_p95, tau=t_med, nace=nace, muere=muere,
                muertas=muertas, salto=salto, ocup=ocup, NL=NL, pared=pared, rmax=rmax_todo)

def proyecciones(P, out, etiqueta, nuc=None):
    """Proyecciones 2D XY / XZ / YZ CON AYUDAS VISUALES — el campo se juzga A OJO.
    Ayudas: núcleos marcados con su signo (O = δ−, H = δ+), el anillo dibujado, escala en
    bohr, y las líneas CON PICOS resaltadas en ROJO (para ver DÓNDE está el problema)."""
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        from matplotlib.lines import Line2D
    except ImportError:
        print("  (matplotlib no está: sin PNG)"); return
    os.makedirs(out, exist_ok=True)
    # clasificar cada línea: ¿tiene picos?
    v = np.diff(P, axis=1); n = np.linalg.norm(v, axis=2, keepdims=True); u = v / np.maximum(n, 1e-9)
    ang = np.degrees(np.arccos(np.clip((u[:, :-1] * u[:, 1:]).sum(axis=2), -1, 1)))
    largo = np.linalg.norm(np.diff(P, axis=1), axis=2).sum(axis=1)
    viva = largo >= 0.35
    conpico = (ang > 35).any(axis=1)
    planos = [(0, 1, 'XY  (plano del anillo)'), (0, 2, 'XZ  (de canto)'), (1, 2, 'YZ  (de canto)')]
    fig, axes = plt.subplots(1, 3, figsize=(19, 6.4), facecolor='#08080c')
    for ax, (a, b, nom) in zip(axes, planos):
        for i, ln in enumerate(P):
            if not viva[i]: continue
            mal = conpico[i]
            ax.plot(ln[:, a], ln[:, b], lw=1.0 if mal else 0.35,
                    color='#ff3b30' if mal else '#4a9eff', alpha=0.85 if mal else 0.45, zorder=3 if mal else 2)
        if nuc is not None:
            for j, q in enumerate(nuc):
                esO = j % 3 == 0
                ax.scatter([q[a]], [q[b]], s=210 if esO else 90, zorder=5,
                           c='#7fd4ff' if esO else '#ffb03a', edgecolors='white', linewidths=0.8)
                ax.annotate('O δ−' if esO else 'H δ+', (q[a], q[b]), color='white', fontsize=8,
                            xytext=(6, 5), textcoords='offset points', zorder=6)
            Os = [nuc[3 * k] for k in range(len(nuc) // 3)]
            if len(Os) >= 3:
                cyc = Os + [Os[0]]
                ax.plot([o[a] for o in cyc], [o[b] for o in cyc], '--', lw=0.9, color='#00e0a0', alpha=0.75, zorder=4)
                C = np.mean(Os, axis=0)
                ax.scatter([C[a]], [C[b]], marker='x', s=140, c='#00e0a0', zorder=6, linewidths=1.6)
                ax.annotate('centro (campo ≈ 0)', (C[a], C[b]), color='#00e0a0', fontsize=8,
                            xytext=(7, -12), textcoords='offset points', zorder=6)
        ax.set_facecolor('#08080c'); ax.set_title(f'{etiqueta}\n{nom}', color='white', fontsize=11)
        ax.set_aspect('equal'); ax.tick_params(colors='#777', labelsize=8)
        ax.grid(alpha=0.10, color='white'); ax.set_xlabel('bohr', color='#777', fontsize=8)
        for sp in ax.spines.values(): sp.set_color('#333')
    fig.legend(handles=[Line2D([], [], color='#4a9eff', lw=2, label='línea limpia'),
                        Line2D([], [], color='#ff3b30', lw=2, label='línea CON PICOS (>35°)'),
                        Line2D([], [], color='#00e0a0', ls='--', lw=2, label='anillo O–O–O')],
               loc='lower center', ncol=3, facecolor='#08080c', labelcolor='white', edgecolor='#333', fontsize=9)
    plt.tight_layout(rect=[0, 0.05, 1, 1])
    f = os.path.join(out, f'campo-{etiqueta}.png')
    plt.savefig(f, dpi=115, facecolor='#08080c'); plt.close()
    print(f"  → {f}   (rojo = líneas con picos)")

def _nucleos(binruta):
    """Lee los núcleos del .bin de nubes hermano (…-efield.bin → ….bin) para marcarlos."""
    cand = binruta.replace('-efield.bin', '.bin')
    if not os.path.exists(cand): return None
    try:
        with open(cand, 'rb') as fp:
            fp.read(4)
            Nacc, Ndep, Nspin, Kb, NNUC, NLb, LPb = struct.unpack('<7i', fp.read(28))
            POSQ = struct.unpack('<3f', fp.read(12))[0]
            fp.read(Kb * 4 * 2 + Nacc * 3 + NNUC * 2)
            fp.read((Kb * Nacc * 3 + Kb * Ndep * 3 + Kb * Nspin * 3) * 2)
            nz = np.frombuffer(fp.read(Kb * NNUC * 3 * 2), dtype='<i2').astype(float) / POSQ
        return nz.reshape(Kb, NNUC, 3)[Kb - 1]
    except Exception:
        return None


K, NL, LP, R, L = leer(RUTA)
m = metricas(K, NL, LP, R, L, os.path.basename(RUTA), _nucleos(RUTA))

if PNGDIR: proyecciones(L[K - 1], PNGDIR, os.path.basename(RUTA).replace('.bin', ''), _nucleos(RUTA))

if REF:
    print()
    Kr, NLr, LPr, Rr, Lr = leer(REF)
    mr = metricas(Kr, NLr, LPr, Rr, Lr, f"REFERENCIA {os.path.basename(REF)}", _nucleos(REF))
    if PNGDIR: proyecciones(Lr[Kr - 1], PNGDIR, os.path.basename(REF).replace('.bin', ''), _nucleos(REF))
    print("\n── VEREDICTO (contra la referencia que ya funcionó) ──")
    ok = True
    for k, nom, peor_es in (('kappa', 'curvatura kappa', 'mayor'), ('muertas', 'semillas muertas', 'mayor'),
                            ('salto', 'saltos', 'mayor'), ('pared', 'AMPUTACION', 'mayor'),
                            ('muere', 'muere en O (regla 1)', 'menor'), ('ocup', 'volumen cubierto', 'menor')):
        a, b = m[k], mr[k]
        mal = (a > b * 1.5 + 1) if peor_es == 'mayor' else (a < b * 0.7)
        ok &= not mal
        print(f"  {nom:20s} {a:6.2f}  vs  {b:6.2f} (ref)   {'✗ PEOR' if mal else '✓'}")
    print("\n" + ("✅ CAMPO OK — a la altura de la referencia" if ok else
                  "❌ CAMPO PEOR QUE LA REFERENCIA — no renderizar así"))
    sys.exit(0 if ok else 1)
