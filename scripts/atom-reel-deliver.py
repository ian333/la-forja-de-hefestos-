#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-reel-deliver.py — reemplaza el video viejo de un átomo por el reel nuevo en
los destinos que consume el Centro de Comando (comando.html):

  · ATLAS  /mnt/hdd/forja-dist/biblioteca/atomos/atom-{ZZZ}-{Sym}.mp4  (lo que el
    botón ⬇ del centro de comando sirve; biblioteca está EXCLUIDA del rsync del
    deploy, así que se sube directo).
  · Downloads local (para subir a mano a TikTok/IG).

El nombre destino sale del catálogo (public/comando/catalogo.json: tema=símbolo).

  python3 scripts/atom-reel-deliver.py --z 79 --reel reel-079.mp4
"""
import argparse, json, os, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ATLAS = "ian@100.97.118.117"
ATLAS_BIB = "/mnt/hdd/forja-dist/biblioteca"
DL = "/mnt/c/Users/sebas/Downloads/reels-nuevos"
CAT = os.path.join(ROOT, "public", "comando", "catalogo.json")


def piece_for_z(z):
    cat = json.load(open(CAT))["pieces"]
    pid = f"atomo-{z:03d}"
    for p in cat:
        if p["id"] == pid:
            return p
    raise SystemExit(f"no hay pieza {pid} en el catálogo")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--z", type=int, required=True)
    ap.add_argument("--reel", required=True)
    ap.add_argument("--no-atlas", action="store_true")
    ap.add_argument("--no-downloads", action="store_true")
    a = ap.parse_args()

    if not os.path.exists(a.reel):
        sys.exit(f"reel no existe: {a.reel}")
    p = piece_for_z(a.z)
    rel = p["formatos"].get("video") or next(iter(p["formatos"].values()))
    # rel = "atomos/atom-079-Au.mp4"
    base = os.path.basename(rel)
    print(f"  {p['titulo']}  →  biblioteca/{rel}")

    if not a.no_downloads:
        os.makedirs(DL, exist_ok=True)
        subprocess.run(["cp", a.reel, os.path.join(DL, base)], check=False)
        print(f"  ✓ Downloads/reels-nuevos/{base}")

    if not a.no_atlas:
        dest = f"{ATLAS_BIB}/{rel}"
        # asegurar el dir remoto y subir
        r = subprocess.run(["ssh", "-o", "ConnectTimeout=12", ATLAS,
                            f"mkdir -p {os.path.dirname(dest)}"], capture_output=True, text=True)
        if r.returncode != 0:
            print(f"  ✗ ATLAS inalcanzable: {r.stderr.strip()[:80]}"); return
        r = subprocess.run(["scp", "-o", "ConnectTimeout=15", a.reel, f"{ATLAS}:{dest}"],
                          capture_output=True, text=True)
        if r.returncode == 0:
            print(f"  ✓ ATLAS biblioteca/{rel}  (el centro de comando ya sirve el nuevo)")
        else:
            print(f"  ✗ scp ATLAS falló: {r.stderr.strip()[:120]}")


if __name__ == "__main__":
    main()
