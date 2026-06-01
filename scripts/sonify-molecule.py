#!/usr/bin/env python3
"""
sonify-molecule.py — la VOZ de una molécula = mezcla de las voces de sus átomos.

Cada elemento canta su espectro de emisión real (cuantizado a pentatónica mayor,
reusando atom-sonify.py). Una molécula suena como el acorde de los elementos que
la forman → distinta por molécula, consonante y tranquila. (El agua usa su propia
sonificación de modos vibracionales; esto es para las demás.)

Uso:  python3 sonify-molecule.py <key> <salida.wav> [duración_s]
"""
import sys, os, importlib.util
import numpy as np
from scipy.io import wavfile

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("atom_sonify", os.path.join(_here, "atom-sonify.py"))
A = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(A)

# Átomos de cada molécula (símbolo, Z). El orden no importa; se mezclan las voces
# de los elementos ÚNICOS (con un poco más de peso al átomo central / más pesado).
MOL_ATOMS = {
    'h2o':  [('O', 8), ('H', 1)],
    'hehp': [('He', 2), ('H', 1)],
    'h2':   [('H', 1)],
    'co':   [('C', 6), ('O', 8)],
    'li2':  [('Li', 3)],
    'n2':   [('N', 7)],
    'o2':   [('O', 8)],
    'co2':  [('C', 6), ('O', 8)],
    'nacl': [('Na', 11), ('Cl', 17)],
    'hcl':  [('Cl', 17), ('H', 1)],
    'hf':   [('F', 9), ('H', 1)],
    'c2h4': [('C', 6), ('H', 1)],
    'c2h2': [('C', 6), ('H', 1)],
    'c6h6': [('C', 6), ('H', 1)],
    'ch4':  [('C', 6), ('H', 1)],
    'nh3':  [('N', 7), ('H', 1)],
    # cadenas — voz del carbono con armónico de hidrógeno
    'butane':       [('C', 6), ('H', 1)],
    'pentane':      [('C', 6), ('H', 1)],
    'hexane':       [('C', 6), ('H', 1)],
    'heptane':      [('C', 6), ('H', 1)],
    'octane':       [('C', 6), ('H', 1)],
    'nonane':       [('C', 6), ('H', 1)],
    'decane':       [('C', 6), ('H', 1)],
    'dodecane':     [('C', 6), ('H', 1)],
    'hexadecane':   [('C', 6), ('H', 1)],
    'hexatriene':   [('C', 6), ('H', 1)],
    'octatetraene': [('C', 6), ('H', 1)],
    'decapentaene': [('C', 6), ('H', 1)],
    'dodecahexaene':[('C', 6), ('H', 1)],
    'caroteno':     [('C', 6), ('H', 1)],
    # ADN — voz de sus elementos (fosfato P, bases N/O/C)
    'brca1':    [('P', 15), ('N', 7), ('O', 8), ('C', 6)],
    'telomero': [('P', 15), ('N', 7), ('O', 8), ('C', 6)],
    'tata':     [('P', 15), ('N', 7), ('O', 8), ('C', 6)],
}


# Moléculas del catálogo: sus átomos vienen de catalog-audio.json (generado de
# catalog.json). Se fusionan con MOL_ATOMS (las del catálogo no pisan a las base).
import json
_cat_audio = os.path.join(_here, 'catalog-audio.json')
if os.path.exists(_cat_audio):
    try:
        with open(_cat_audio) as _f:
            for _k, _atoms in json.load(_f).items():
                MOL_ATOMS.setdefault(_k, [tuple(a) for a in _atoms])
    except Exception:
        pass


def main():
    key = (sys.argv[1] if len(sys.argv) > 1 else 'co').lower()
    out = sys.argv[2] if len(sys.argv) > 2 else '/tmp/mol.wav'
    dur = float(sys.argv[3]) if len(sys.argv) > 3 else 19.0
    atoms = MOL_ATOMS.get(key, [('C', 6)])

    mix = None
    seen = set()
    for i, (sym, Z) in enumerate(atoms):
        if sym in seen:
            continue
        seen.add(sym)
        v = A.synth(sym, dur, Z)
        if mix is None:
            mix = np.zeros_like(v)
        L = min(len(mix), len(v))
        w = 0.85 if i == 0 else 0.6          # el central/primero un poco más fuerte
        mix[:L] += v[:L] * w

    peak = float(np.max(np.abs(mix))) or 1.0
    mix = (mix / peak * 0.82).astype(np.float32)
    wavfile.write(out, A.SR, mix)
    print(f"wrote {out}  ({dur}s)  átomos={[s for s, _ in atoms]}")


if __name__ == '__main__':
    main()
