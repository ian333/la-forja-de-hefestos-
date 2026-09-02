#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""color-hirshfeld.py — LOS ELECTRONES SE PINTAN POR ELEMENTO, y no a ojo.

ian (2026-09-01): "necesitamos añadirle variedad de colores, por decir el carbono pudo
tener sus electrones de otro color".

EL PROBLEMA HONESTO: en una molécula los electrones NO son de nadie — esa es justamente la
idea del enlace. Pintar "los del carbono" exige una regla de reparto, y hay una publicada:
la partición de HIRSHFELD (Theor. Chim. Acta 44, 129, 1977), llamada del "accionista".
A cada punto del espacio se le pregunta qué fracción de la densidad le tocaría a cada átomo
si la molécula fuera solo la suma de sus átomos LIBRES:

    w_A(r) = rho_A_libre(|r - R_A|) / SUMA_B rho_B_libre(|r - R_B|)

Eso es un DATO, no una decoración: sale de densidades atómicas calculadas, no de distancias
inventadas. (Lo que había antes era "morado si estás a menos de 1.4 bohr de un oxígeno" —
una heurística de distancia que ni sabe de elementos.)

Las densidades de átomo libre se calculan con pyscf y se promedian esféricamente muestreando
direcciones al azar, porque C y O en su estado base NO son esféricos y usar una sola
dirección metería un sesgo que se vería como manchas.

  python3 scripts/color-hirshfeld.py <bin-sin-extension> [--probar]
  Reescribe el bloque accColor DENTRO del .bin (el resto queda byte a byte igual).
"""
import os, sys, struct
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# PALETA POR ELEMENTO. Extiende la de la serie, no la reinventa (canon §extender reusa la
# paleta): el oxígeno conserva su ORO cálido, que es el color con el que el público ya lo
# reconoce en todos los videos de agua. El carbono estrena un verde-azulado y el hidrógeno
# un blanco lavanda. Se evita a propósito el rojo puro y el cian puro: esos dos ya están
# tomados por los campos positivo y negativo.
PALETA = {
    1:  (0.82, 0.86, 1.00),   # H  · blanco lavanda
    6:  (0.18, 0.86, 0.68),   # C  · verde-azulado
    7:  (0.55, 0.70, 1.00),   # N  · azul pálido
    8:  (1.00, 0.72, 0.30),   # O  · ORO (el de siempre)
    11: (0.95, 0.95, 0.80),   # Na
    17: (0.60, 1.00, 0.55),   # Cl
}
GRIS = (0.75, 0.75, 0.75)


def rho_atomo_libre(Z, rs, basis='cc-pvdz'):
    """Densidad radial del átomo LIBRE, promediada sobre direcciones."""
    from pyscf import gto, scf
    simbolo = {1: 'H', 6: 'C', 7: 'N', 8: 'O', 11: 'Na', 17: 'Cl'}[int(Z)]
    spin = {1: 1, 6: 2, 7: 3, 8: 2, 11: 1, 17: 1}[int(Z)]
    mol = gto.M(atom=f'{simbolo} 0 0 0', basis=basis, spin=spin, verbose=0)
    mf = scf.UHF(mol); mf.max_cycle = 200; mf.kernel()
    dm = mf.make_rdm1(); dm = dm[0] + dm[1]
    rng = np.random.default_rng(0)
    dirs = rng.normal(size=(64, 3)); dirs /= np.linalg.norm(dirs, axis=1, keepdims=True)
    out = np.empty(len(rs))
    for i, r in enumerate(rs):
        pts = dirs * r
        ao = mol.eval_gto('GTOval', pts)
        out[i] = float(np.einsum('pi,ij,pj->p', ao, dm, ao).mean())
    return np.maximum(out, 1e-30)


def main():
    nombre = sys.argv[1]
    probar = '--probar' in sys.argv
    ruta = os.path.join(ROOT, 'public', 'precomputed', f'{nombre}.bin')
    b = bytearray(open(ruta, 'rb').read())
    o = 0
    mg, NA, ND, NS, K, NN, NL, LP = struct.unpack_from('<4s7i', b, o); o += 32
    if mg != b'WAP2':
        raise SystemExit(f'✗ {nombre} no es WAP2')
    posq, rmin, rmax = struct.unpack_from('<3f', b, o); o += 12
    o += K * 4 + K * 4                       # Rvals + bondMass
    off_color = o; o += NA * 3
    Z = np.frombuffer(bytes(b[o:o + NN * 2]), '<i2').astype(int); o += NN * 2
    o += K * (NA + ND + NS) * 3 * 2          # acc/dep/spin
    nuc = np.frombuffer(bytes(b[o:o + K * NN * 3 * 2]), '<i2').reshape(K, NN, 3).astype(np.float64) / posq
    # las posiciones acc del cuadro de EQUILIBRIO (el mismo que usa el escritor para el color)
    off_acc = off_color + NA * 3 + NN * 2
    acc = np.frombuffer(bytes(b[off_acc:off_acc + K * NA * 3 * 2]), '<i2').reshape(K, NA, 3).astype(np.float64) / posq

    print(f"{nombre}: {NA} partículas · {NN} núcleos · Z = {sorted(set(Z.tolist()))} · posq {posq:.1f}")

    kEq = K - 1                              # el par PEGADO, como el escritor
    P = acc[kEq]; R = nuc[kEq]

    # ── densidades de átomo libre, tabuladas una vez por ELEMENTO
    rs = np.concatenate([np.linspace(0.01, 2, 60), np.linspace(2.05, 12, 80)])
    tabla = {}
    for z in sorted(set(Z.tolist())):
        tabla[z] = rho_atomo_libre(z, rs)
        print(f"  átomo libre Z={z}: rho(0.05)={tabla[z][0]:.3f}  rho(2.0)={tabla[z][59]:.5f}")

    # ── pesos de Hirshfeld en cada partícula
    W = np.zeros((len(P), NN))
    for a in range(NN):
        d = np.linalg.norm(P - R[a], axis=1)
        W[:, a] = np.interp(d, rs, tabla[int(Z[a])], left=tabla[int(Z[a])][0], right=1e-30)
    W /= np.maximum(W.sum(axis=1, keepdims=True), 1e-30)

    # ── color = mezcla ponderada de los colores de elemento
    col = np.zeros((len(P), 3))
    for a in range(NN):
        c = np.array(PALETA.get(int(Z[a]), GRIS))
        col += W[:, a:a + 1] * c[None, :]
    col = np.clip(col, 0, 1)

    # a qué elemento le toca cada partícula (para el reporte)
    dueno = Z[np.argmax(W, axis=1)]
    # PORTERO: el reparto que sale debe parecerse a los electrones que cada elemento APORTA.
    # No se le dijo por ningún lado — si Hirshfeld está bien aplicado, sale solo. (No cuadra
    # exacto porque las partículas se muestrean de rho^0.8, no de rho: eso comprime el pico
    # nuclear y le quita peso relativo a los átomos pesados.)
    print("  reparto de la nube (medido contra los electrones que aporta cada elemento):")
    Ztot = float(Z.sum())
    peor = 0.0
    for z in sorted(set(Z.tolist())):
        got = 100 * (dueno == z).mean()
        esp = 100 * Z[Z == z].sum() / Ztot
        peor = max(peor, abs(got - esp))
        print(f"    Z={z}: {got:5.1f} % de las partículas   ·  aporta {esp:5.1f} % de los electrones   (Δ {got-esp:+5.1f})")
    if peor > 12:
        raise SystemExit(f"✗ el reparto se aleja {peor:.1f} puntos de los electrones aportados — Hirshfeld mal aplicado")

    if probar:
        print("  (--probar: no se escribió nada)")
        return
    b[off_color:off_color + NA * 3] = np.clip(col * 255, 0, 255).astype(np.uint8).tobytes()
    open(ruta, 'wb').write(bytes(b))
    print(f"✓ accColor reescrito en {ruta} (el resto del .bin, intacto)")


if __name__ == '__main__':
    main()
