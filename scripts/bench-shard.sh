#!/bin/bash
# bench-shard.sh — mide el speedup del render 4K paralelizado (--nshards) vs secuencial.
# Carpetas scratch propias → NO toca el render de wpair en curso. Corre seq PRIMERO,
# luego paralelo (no compiten entre sí; ambos comparten GPU con lo que ya corra).
cd /home/ian/Orkesta/la-forja
URL='http://localhost:5178/cinematic-molecule.html?m=wpair'
HOOK=__cinematicAtom
BR=/home/ian/Orkesta/la-forja/dist-video/.bench
DUR=${DUR:-3}            # 3s @30fps = 90 frames
NSH=${NSH:-3}            # workers en paralelo
export DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
rm -rf ${BR}_seq ${BR}_par; mkdir -p ${BR}_seq ${BR}_par

echo "== SECUENCIAL (1 worker) =="
t0=$SECONDS
node scripts/render-clip.cjs --url "$URL" --hook $HOOK --out ${BR}_seq --fps 30 --w 2160 --h 3840 --batch 40 --dur $DUR > /home/ian/bench_seq.log 2>&1
SEQ=$((SECONDS-t0))

echo "== PARALELO ($NSH workers, stride) =="
t0=$SECONDS
for k in $(seq 0 $((NSH-1))); do
  node scripts/render-clip.cjs --url "$URL" --hook $HOOK --out ${BR}_par --fps 30 --w 2160 --h 3840 --batch 40 --dur $DUR --nshards $NSH --shard $k > /home/ian/bench_par_$k.log 2>&1 &
done
wait
PAR=$((SECONDS-t0))

NS=$(ls ${BR}_seq/*.png 2>/dev/null | wc -l)
NP=$(ls ${BR}_par/*.png 2>/dev/null | wc -l)
# ¿algún frame negro en el paralelo? (size < 150KB)
BLK=$(find ${BR}_par -name '*.png' -size -150k 2>/dev/null | wc -l)
SPD=$(awk "BEGIN{ if ($PAR>0) printf \"%.2f\", $SEQ/$PAR; else print \"NA\" }")
echo "BENCH_RESULT seq=${SEQ}s par=${PAR}s speedup=${SPD}x frames_seq=${NS} frames_par=${NP} negros_par=${BLK}"
