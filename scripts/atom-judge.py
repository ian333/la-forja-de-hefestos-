#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
atom-judge.py — EL JUEZ del generador. Lee la curva de fuerza de gancho que
escribe detector-gancho.py (--peaks → peaks.json con campo "curve") y decide,
por las REGLAS que ya programamos (NEUROCIENCIA-DEL-GANCHO.md), qué viaje
"excita al ojo". No re-mide nada: solo aplica el fitness sobre la curva.

3 COMPUERTAS de la doctrina hipnótica (docs NEUROCIENCIA-DEL-GANCHO + RETENCION):
  1) pico@frame0 (estallido): el PICO va en el frame 0, no se LLEGA a él. Una
     rampa (frame0 << pico) REPRUEBA por más alto que sea el pico.
  2) cadencia de pattern-interrupt: ningún HUECO sin pico > 5s. V1 se habitúa a
     los 3-5s → un fly-through liso de 10s aburre y hace swipe.
  3) loop sin costura: el último cuadro se parece al primero (rewatch = señal #1
     de TikTok 2026). Un logo al final = loop ABIERTO = se pierde el rewatch.
Entre los que pasan ordena por: las 3 + densidad de picos + ritmo variable + peak-end.

  python3 scripts/atom-judge.py _gen/score_na/peaks.json
"""
import argparse, json, statistics, sys

# Ventanas (segundos) que codifican la doctrina
FRAME0_S = 0.30     # "el estallido" — primeros ~0.3s = el frame 0 perceptual
GATE_A, GATE_B = 1.5, 5.0   # el acantilado + gate algorítmico de 3s
END_S = 1.0         # peak-end (Kahneman)

# Umbrales de las 3 compuertas
PEAK_T_MAX = 0.40   # (1) el pico debe caer antes de este t (s)
FRONT_MIN = 0.55    # (1) frame0 debe ser ≥55% del pico (si no, es RAMPA)
GAP_MAX_S = 5.0     # (2) hueco máx sin pico — V1 se habitúa a los 3-5s
LOOP_MIN = 0.50     # (3) NCC frame0~frameN para "loop sin costura" (rewatch)


def win_mean(curve, fps, t0, t1):
    a, b = max(0, int(t0 * fps)), min(len(curve), int(t1 * fps))
    seg = curve[a:b] if b > a else curve[a:a + 1]
    return sum(seg) / len(seg) if seg else 0.0


def win_min(curve, fps, t0, t1):
    a, b = max(0, int(t0 * fps)), min(len(curve), int(t1 * fps))
    seg = curve[a:b] if b > a else [0.0]
    return min(seg) if seg else 0.0


def _spike_gaps(spikes, dur):
    """Huecos (s) entre picos consecutivos, incluyendo 0->1er pico y último->fin.
    El hueco MÁS LARGO = la peor zona de habituación (V1 se apaga a los 3-5s)."""
    ts = sorted(s["t"] for s in spikes) if spikes else []
    if not ts:
        return [dur], []          # cero picos = un solo hueco del tamaño del video
    bounds = [0.0] + ts + [dur]
    gaps = [bounds[i + 1] - bounds[i] for i in range(len(bounds) - 1)]
    intervals = [ts[i + 1] - ts[i] for i in range(len(ts) - 1)]
    return gaps, intervals


def judge_one(rec):
    curve = rec.get("curve") or []
    fps = rec.get("fps", 12)
    dur = rec.get("duration_s") or (len(curve) / fps if fps else 0.0)
    if not curve:
        return {"name": rec["name"], "verdict": "SIN_CURVA", "score": -99}
    peak_z = max(curve)
    peak_t = curve.index(peak_z) / fps
    frame0_z = win_mean(curve, fps, 0.0, FRAME0_S)
    front_ratio = max(0.0, frame0_z) / peak_z if peak_z > 1e-6 else 0.0
    end_z = win_mean(curve, fps, dur - END_S, dur)

    # (2) cadencia de pattern-interrupt — de TODOS los picos que halló el detector
    spikes = rec.get("spikes") or []
    gaps, intervals = _spike_gaps(spikes, dur)
    max_gap = max(gaps) if gaps else dur
    n_spikes = len(spikes)
    if len(intervals) >= 2:                       # ritmo variable (anti-metrónomo)
        m = sum(intervals) / len(intervals)
        rhythm_var = (statistics.pstdev(intervals) / m) if m > 1e-6 else 0.0
    else:
        rhythm_var = 0.0
    loop_ncc = float(rec.get("loop_ncc", 0.0))    # (3) 1.0 = costura invisible

    # --- las 3 COMPUERTAS de la doctrina ---
    g_frame0 = (peak_t <= PEAK_T_MAX) and (front_ratio >= FRONT_MIN)   # estallido
    g_cadence = (max_gap <= GAP_MAX_S)                                 # pattern-interrupt
    g_loop = (loop_ncc >= LOOP_MIN)                                    # rewatch
    passes = g_frame0 and g_cadence and g_loop
    verdict = ("PASA" if passes else
               "RAMPA" if not g_frame0 else
               "HUECO" if not g_cadence else
               "LOOP-ABIERTO")

    score = (front_ratio * 2.5                # estallido EN frame 0
             + peak_z * 0.4                   # pico fuerte
             + min(n_spikes, 8) * 0.4         # densidad de cortes/picos (cadencia)
             - max(0.0, max_gap - 3.0) * 0.8  # castiga hueco > zona de habituación
             + loop_ncc * 2.0                 # loop sin costura (señal #1 TikTok)
             + max(0.0, end_z) * 0.5          # peak-end (Kahneman)
             + min(rhythm_var, 1.0) * 0.4)    # ritmo variable
    if not g_frame0:
        score -= 5.0
    if not g_cadence:
        score -= 2.5
    if not g_loop:
        score -= 2.0
    return {
        "name": rec["name"], "verdict": verdict, "score": round(score, 2),
        "peak_t": round(peak_t, 2), "peak_z": round(peak_z, 1),
        "frame0_z": round(frame0_z, 1), "front_ratio": round(front_ratio, 2),
        "max_gap": round(max_gap, 1), "n_spikes": n_spikes,
        "loop_ncc": round(loop_ncc, 2), "rhythm_var": round(rhythm_var, 2),
        "end_z": round(end_z, 1),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("peaks_json")
    a = ap.parse_args()
    data = json.load(open(a.peaks_json))
    if isinstance(data, dict):
        data = [data]
    judged = sorted((judge_one(r) for r in data), key=lambda j: -j["score"])
    print(f"\n{'veredicto':13} {'score':>6} {'pico_t':>6} {'frac0':>5} "
          f"{'huecoMx':>7} {'picos':>5} {'loop':>5} {'fin_z':>5}  nombre")
    print("-" * 100)
    for j in judged:
        if j["verdict"] == "SIN_CURVA":
            print(f"{j['verdict']:13} (re-corre detector --peaks para tener curva)  {j['name']}")
            continue
        flag = {"PASA": "✓", "RAMPA": "✗ rampa", "HUECO": "✗ hueco>5s",
                "LOOP-ABIERTO": "✗ loop abierto"}.get(j["verdict"], "")
        print(f"{j['verdict']:13} {j['score']:6.2f} {j['peak_t']:6.2f} {j['front_ratio']:5.2f} "
              f"{j['max_gap']:7.1f} {j['n_spikes']:5d} {j['loop_ncc']:5.2f} "
              f"{j['end_z']:5.1f}  {j['name']}  {flag}")
    best = next((j for j in judged if j["verdict"] == "PASA"), None)
    print(f"\n  GANADOR: {best['name'] if best else '(ninguno pasa pico@frame0 — todos son rampa)'}")
    return judged


if __name__ == "__main__":
    main()
