#!/usr/bin/env python3
"""
bin-gate — EL PORTERO DEL .bin. Se corre ANTES de render, stills o guion.

POR QUÉ EXISTE (2026-08-30). Ian vio el primer still del ALCOHOL y dijo: "parece
que hay un límite en la simulación, se ve que llegó al límite de la caja que lo
contiene". Tenía razón en el síntoma. El culpable no era la caja: era el int16 del
formato WAP2. Con POSQ quemado en 5000 el techo queda en 32767/5000 = 6.5534 bohr
POR EJE y `np.clip` aplasta contra esa cara todo lo que pase — un cubo de caras
planas. Medido: agua-agua 0.64 % de coordenadas topadas (invisible, en la periferia
rala) y etanol-agua 9.32 % (una PARED que se ve a simple vista).

Lo caro no fue el bug: fue el CAMINO. Se descubrió después de correr el barrido
completo en GPU, después de renderizar stills a 4K y después de que ian los mirara.
Este portero lo caza en 2 segundos leyendo el .bin, sin GPU y sin navegador.

Y el mismo defecto YA se había cazado una vez, en el anillo abierto, y se arregló
del lado del LECTOR (parseWAP2 lee posq del encabezado) — pero nadie tocó el
escritor, así que siguió fabricando .bin cortados. Un arreglo sin portero se
deshace solo.

  python3 scripts/bin-gate.py water-ethanol [water-approach ...]
  exit 0 = pasa · exit 1 = NO se renderiza
"""
import sys, os, struct
import numpy as np

BOHR = 0.52917721067
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# ── GANADORES CONGELADOS. Estos .bin ya están EMBARCADOS en videos publicados, así que
# regenerarlos sería tocar a un ganador (canon §RENDERIZADOR CONGELADO). Su saturación
# está MEDIDA y anotada aquí en vez de escondida: es baja y cae en la periferia rala de
# la nube, donde no se ve. El portero avisa pero no reprueba. Un .bin NUEVO no entra aquí.
CONGELADOS = {
    'water-approach': 'el rey (EL PUENTE, el sudor, el hielo, la sal, la silla) — 0.6-1.3% '
                      'topado, en la periferia rala; publicado y verificado a ojo. NO regenerar.',
}


def leer(path):
    b = open(path, 'rb').read(); o = 0
    mg, NA, ND, NS, K, NN, NL, LP = struct.unpack_from('<4s7i', b, o); o += 32
    if mg != b'WAP2':
        raise SystemExit(f"✗ {path}: no es WAP2 (magic={mg!r})")
    posq, rmin, rmax = struct.unpack_from('<3f', b, o); o += 12
    Rv = np.frombuffer(b, '<f4', K, o).copy(); o += K * 4
    bm = np.frombuffer(b, '<f4', K, o).copy(); o += K * 4
    o += NA * 3 + NN * 2                       # accColor + Z
    def rd(n):
        nonlocal o
        a = np.frombuffer(b, '<i2', K * n * 3, o).reshape(K, n, 3); o += K * n * 3 * 2
        return a
    acc, dep, spn = rd(NA), rd(ND), rd(NS)
    nuc = np.frombuffer(b, '<i2', K * NN * 3, o).reshape(K, NN, 3)
    return dict(posq=posq, K=K, Rv=Rv, bm=bm, NN=NN,
                nubes={'acc': acc, 'dep': dep, 'spin': spn, 'nuc': nuc})


def revisar(nombre):
    path = os.path.join(ROOT, 'public', 'precomputed', f'{nombre}.bin')
    if not os.path.exists(path):
        print(f"✗ {nombre}: no existe {path}"); return False
    d = leer(path)
    congelado = nombre in CONGELADOS
    posq, K = d['posq'], d['K']
    techo = 32767.0 / posq
    fallos = []
    print(f"── {nombre}  ({os.path.getsize(path)/1e6:.1f} MB · {K} cuadros · posq={posq:.1f} → techo ±{techo:.2f} bohr / ±{techo*BOHR:.2f} Å)")

    # ── 1. LA PARED: ninguna coordenada puede tocar el techo del int16.
    for k, a in d['nubes'].items():
        sat = float((np.abs(a) >= 32767).mean()) * 100
        mx = float(np.abs(a).max()) / posq
        estado = "ok" if sat == 0.0 else "PARED PLANA"
        print(f"   {k:5s} |max| {mx:6.2f} bohr ({mx/techo*100:5.1f}% del techo) · topado {sat:6.3f}%   {estado}")
        if sat > 0.0:
            fallos.append(f"{k}: {sat:.3f}% de coordenadas aplastadas contra ±{techo:.2f} bohr = caras planas en pantalla")

    # ── 2. LA FÍSICA: el puente (∫Δρ>0) tiene que CRECER al acercarse. Si baja, o
    #    la geometría va al revés, o el barrido terminó en la zona repulsiva.
    bm = d['bm']
    caidas = int((np.diff(bm) < -1e-4).sum())
    print(f"   puente ∫Δρ>0: {bm[0]:.4f} → {bm[-1]:.4f}  ({caidas} caídas de {K-1} pasos)")
    if caidas > 0:
        fallos.append(f"∫Δρ>0 NO es monótono ({caidas} caídas): el puente se deshace al acercarse")

    # ── 3. CUADROS MUERTOS: una nube que colapsa a un punto o se va a NaN.
    for k, a in d['nubes'].items():
        if k == 'nuc':
            continue
        ext = (a.astype(np.float32) / posq).std(axis=(1, 2))
        if float(ext.min()) < 1e-3:
            fallos.append(f"{k}: cuadro(s) colapsados (std≈0) — nube muerta")

    # ── 4. AIRE: si la nube usa <40 % del techo, el posq está desperdiciando
    #    precisión; si usa >98 %, está a un pelo de cortar. Aviso, no falla.
    mxs = max(float(np.abs(a).max()) / posq for a in d['nubes'].values())
    uso = mxs / techo * 100
    # ⚠ NO se reprueba por "usar mucho el techo": posq_para() deja exactamente 2 % de aire,
    # así que un .bin bien escrito SIEMPRE marca ~98 %. La primera versión de este portero
    # reprobó al primer bin sano por eso — un gate peleándose con su propio escritor. El
    # invariante real es uno solo: 0 % de coordenadas topadas.
    if uso < 40:
        print(f"   (aviso: la nube usa solo {uso:.1f}% del techo; posq podría ser más fino)")

    if congelado and fallos:
        print(f"   ⚠ CONGELADO — {CONGELADOS[nombre]}")
        for f in fallos:
            print(f"   ⚠ (tolerado) {f}")
        print("   ✔ PASA (congelado)")
        return True
    for f in fallos:
        print(f"   ✗ {f}")
    print(f"   {'✔ PASA' if not fallos else '✗ NO PASA'}")
    return not fallos


if __name__ == '__main__':
    objetivos = sys.argv[1:] or ['water-approach']
    ok = all([revisar(n) for n in objetivos])
    print()
    print("✔ TODOS PASAN — se puede renderizar" if ok else "✗ HAY .bin QUE NO PASAN — NO renderizar")
    sys.exit(0 if ok else 1)
