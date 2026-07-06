#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-generator.py — EL GENERADOR. De un átomo saca N viajes aleatorios, renderiza
cada uno BARATO (atom-preview.cjs, baja-res, GPU local), los CALIFICA con el
verificador (detector-gancho --peaks) y los JUZGA por las reglas (atom-judge:
pico@frame0 duro + valle + peak-end). Imprime el GANADOR (genoma) para que ESE
—y solo ese— se renderice 4K en iangpu.

La física (núcleo/nube/E/B) NO se aleatoriza ni se juzga: es fiel siempre. Solo
varía el VIAJE (cámara/journey/paleta), vía URL → SIN rebuild por candidato.

  # arranca el server estático (sin build):  cd dist && python3 -m http.server 8000
  python3 scripts/atom-generator.py --z 11 --n 12 --out _gen/Na

Requiere que la escena lea ?journey= y ?palette= (1 build en iangpu). Hasta ese
build, todos los candidatos salen iguales (el arnés corre, pero sin variedad real).
"""
import argparse, json, os, subprocess, sys
import importlib.util

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# importar el juez como módulo
_spec = importlib.util.spec_from_file_location("aj", os.path.join(ROOT, "scripts", "atom-judge.py"))
aj = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(aj)

PALETTES = ["solar", "frio", "mono-elemento", "ambar", "espectral"]  # ids que la escena mapeará


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--z", type=int, required=True)
    ap.add_argument("--n", type=int, default=12)        # candidatos
    ap.add_argument("--out", default="_gen/run")
    ap.add_argument("--base", default="http://localhost:8000")
    ap.add_argument("--w", type=int, default=270); ap.add_argument("--h", type=int, default=480)
    ap.add_argument("--fps", type=int, default=12)
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)

    # 1) GENOMAS: seed determinista por candidato + paleta rotada (anti-habituación)
    genomes = [{"seed": 1000 + i * 7, "palette": PALETTES[i % len(PALETTES)]} for i in range(a.n)]

    # 2) PREVIEW barato de cada genoma (GPU local)
    cands = []
    for i, g in enumerate(genomes):
        out_mp4 = os.path.join(a.out, f"cand-{i:02d}.mp4")
        env = dict(os.environ, BASE_URL=a.base, Z=str(a.z), W=str(a.w), H=str(a.h),
                   FPS=str(a.fps), OUT=out_mp4, JOURNEY=str(g["seed"]), PALETTE=g["palette"])
        r = subprocess.run(["node", os.path.join(ROOT, "scripts", "atom-preview.cjs")],
                           env=env, capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(out_mp4):
            print(f"  ✗ cand {i}: preview falló  {r.stderr.strip()[-120:]}"); continue
        g["mp4"] = out_mp4; cands.append(g)
        print(f"  ✓ cand {i:02d}  seed={g['seed']} paleta={g['palette']}")
    if not cands:
        sys.exit("ningún candidato renderizó")

    # 3) CALIFICAR todos con el verificador (curvas en peaks.json)
    subprocess.run(["python3", os.path.join(ROOT, "scripts", "detector-gancho.py"),
                    "--peaks", "--videos", *[c["mp4"] for c in cands],
                    "--out", os.path.join(a.out, "score")], capture_output=True, text=True)
    peaks = json.load(open(os.path.join(a.out, "score", "peaks.json")))
    by_name = {os.path.basename(c["mp4"]): c for c in cands}

    # 4) JUZGAR (pico@frame0 duro + valle + peak-end) y ordenar
    judged = []
    for rec in peaks:
        v = aj.judge_one(rec)
        g = by_name.get(rec["name"], {})
        v["seed"] = g.get("seed"); v["palette"] = g.get("palette"); v["mp4"] = g.get("mp4")
        judged.append(v)
    judged.sort(key=lambda j: -j["score"])

    print(f"\n  {'veredicto':9} {'score':>6} {'pico_t':>6} {'frac0':>5}  seed  paleta")
    for j in judged:
        print(f"  {j['verdict']:9} {j.get('score',0):6.2f} {j.get('peak_t',0):6.2f} "
              f"{j.get('front_ratio',0):5.2f}  {j.get('seed')}  {j.get('palette')}")

    winners = [j for j in judged if j["verdict"] == "PASA"]
    win = winners[0] if winners else None
    json.dump({"z": a.z, "winner": win, "ranking": judged},
              open(os.path.join(a.out, "winner.json"), "w"), ensure_ascii=False, indent=1)
    if win:
        print(f"\n  🏆 GANADOR z={a.z}: seed={win['seed']} paleta={win['palette']} "
              f"(score {win['score']}) → renderizar 4K en iangpu")
    else:
        print(f"\n  ⚠ ningún viaje pasó pico@frame0 — subir N o ajustar el genoma del cold-open")


if __name__ == "__main__":
    main()
