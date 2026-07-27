#!/bin/bash
# noche.sh — ORQUESTADOR NOCTURNO de iangpu (2026-07-16).
# Ian: "quiero que se quede trabajando toda la noche… vuélvete loco".
# Corre las estaciones EN SERIE (una a la vez: 16 núcleos por estación, sin
# pelearse la RAM). Cada estación es resumable y tolera fallos. Al final
# escribe el RESUMEN de la cosecha para la revisión matutina.
cd /home/ian/Orkesta/la-forja || exit 1
LOG=/tmp/noche.log
say() { echo "[$(date '+%H:%M:%S')] $*" >> $LOG; }

say "════ NOCHE INICIADA ════"

# 1. esperar a la granja de materiales (ya corre desde antes)
say "esperando farm-materiales…"
while pgrep -f farm-materiales.py > /dev/null; do sleep 60; done
say "farm-materiales terminó: $(grep -c '✓.*npz' /tmp/farm-materiales.log 2>/dev/null) checkpoints"

# 2. cadenas (apilar átomos: el nacimiento del metal)
say "── cadenas…"
python3 scripts/farm-cadenas.py >> /tmp/farm-cadenas.log 2>&1
say "cadenas: $(grep -c 'GAP' /tmp/farm-cadenas.log 2>/dev/null) resueltas"

# 3. dispositivos (MOSFET + diodo)
say "── dispositivos…"
python3 scripts/farm-dispositivos.py >> /tmp/farm-dispositivos.log 2>&1
say "dispositivos: $(grep -E 'LISTOS' /tmp/farm-dispositivos.log | head -1)"

# 4. capacitor (materia en campo E)
say "── capacitor…"
python3 scripts/farm-capacitor.py >> /tmp/farm-capacitor.log 2>&1

# 5. previews en video de TODO lo cosechado (GPU: NVENC)
say "── previews…"
python3 scripts/previews-materia.py >> /tmp/previews-materia.log 2>&1

# 6. experimento: gpu4pyscf en venv AISLADO (no toca el pyscf del sistema).
#    Si jala, las granjas futuras van en GPU. Si no, se anota y ya.
say "── experimento gpu4pyscf (venv aislado)…"
(
  set -e
  python3 -m venv /home/ian/gpu4pyscf-venv 2>/dev/null || true
  /home/ian/gpu4pyscf-venv/bin/pip -q install gpu4pyscf-cuda12x pyscf 2>&1 | tail -2
  /home/ian/gpu4pyscf-venv/bin/python - <<'EOF'
import time
import numpy as np
from pyscf.pbc import gto
cell = gto.Cell()
cell.a = np.eye(3)*5.431
cell.atom = [['Si',(0,0,0)],['Si',(1.35775,1.35775,1.35775)],
             ['Si',(2.7155,2.7155,0)],['Si',(4.07325,4.07325,1.35775)],
             ['Si',(2.7155,0,2.7155)],['Si',(4.07325,1.35775,4.07325)],
             ['Si',(0,2.7155,2.7155)],['Si',(1.35775,4.07325,4.07325)]]
cell.basis='gth-szv'; cell.pseudo='gth-pade'; cell.unit='A'; cell.verbose=0
cell.build()
try:
    from gpu4pyscf.pbc.dft import RKS as GRKS
    t0=time.time(); mf=GRKS(cell); mf.xc='pbe'; e=mf.kernel(); t1=time.time()
    print(f"GPU4PYSCF OK: E={e:.5f} Ha en {t1-t0:.1f}s")
except Exception as ex:
    print(f"GPU4PYSCF PBC no disponible: {type(ex).__name__}: {ex}")
EOF
) >> /tmp/gpu4pyscf-bench.log 2>&1
say "experimento gpu4pyscf: $(tail -1 /tmp/gpu4pyscf-bench.log)"

# 7. resumen de cosecha
R=/home/ian/Orkesta/la-forja/dist-video/materia-farm/RESUMEN-NOCHE.md
{
  echo "# Cosecha nocturna — $(date '+%Y-%m-%d %H:%M')"
  echo; echo "## Checkpoints (.npz)"
  ls -la dist-video/materia-farm/*.npz 2>/dev/null | awk '{printf "- %s (%.1f MB)\n", $9, $5/1048576}'
  echo; echo "## Hojas de contacto"; ls dist-video/materia-farm/*-contacto.png 2>/dev/null | sed 's/^/- /'
  echo; echo "## Previews en video"; ls dist-video/materia-farm/previews/*.mp4 2>/dev/null | sed 's/^/- /'
  echo; echo "## La curva de las cadenas (gap vs N)"
  cat dist-video/materia-farm/cadenas-gaps.json 2>/dev/null
  echo; echo "## gpu4pyscf"; tail -2 /tmp/gpu4pyscf-bench.log 2>/dev/null
} > $R
cp dist-video/materia-farm/previews/*.mp4 /mnt/c/Users/sebas/Downloads/ 2>/dev/null
say "════ NOCHE COMPLETA — resumen en $R (previews copiados a Downloads) ════"
