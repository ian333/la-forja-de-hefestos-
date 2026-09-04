#!/usr/bin/env bash
# salud.sh — EL DOCTOR DE IANGPU + LOS PORTEROS. Un comando que responde "¿puedo trabajar?"
# en vez de descubrir a media faena que vite murió, el disco E se desmontó o una escena
# ganadora lleva días rota (la clase qScale, 2026-08-17).
#
#   bash scripts/salud.sh              # rápida: doctor + canarios (~90s)
#   bash scripts/salud.sh --completa   # + typecheck scoped a cine con tolerancia CERO
#
# Sale 1 si algo BLOQUEANTE falla. Los montajes de Windows muertos se REPORTAN pero no
# bloquean (el pipeline ya no los tiene en el camino crítico).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
export DISPLAY=${DISPLAY:-:0} GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA
BASE_URL="${BASE_URL:-http://localhost:5178}"
FALLAS=0

echo "── DOCTOR ──"
# GPU real
if /usr/lib/wsl/lib/nvidia-smi --query-gpu=name --format=csv,noheader >/dev/null 2>&1; then
  echo "✓ GPU: $(/usr/lib/wsl/lib/nvidia-smi --query-gpu=name,memory.used,utilization.gpu --format=csv,noheader)"
else
  echo "✗ GPU: nvidia-smi no responde"; FALLAS=$((FALLAS+1))
fi
# VITE FRESCO SIEMPRE (2026-08-25): el watcher de vite dev NO invalida en iangpu (inotify
# agotado, ver memoria vite_persistence) → tras un rsync de src/ sirve el módulo VIEJO en
# silencio. El sudor v2 se rindió 7 min con la cámara y el título anteriores aunque el disco
# ya tenía el cambio. Relanzar cuesta ~200 ms; solo se respeta un render en curso.
if [ "$(ps -eo pid,comm,args --no-headers | awk '$2=="node" && /render-clip/' | wc -l)" -eq 0 ]; then
  for p in $(ps -eo pid,args --no-headers | awk '/node .*vite --port 5178/ && !/awk/ {print $1}'); do
    kill "$p" 2>/dev/null && echo "… vite relanzado (pid $p) para servir el source ACTUAL"
  done
  sleep 1
fi
# vite (se intenta REVIVIR antes de reprobar: el 80% de las veces solo está muerto por un reinicio)
if ! curl -s -o /dev/null --max-time 5 "$BASE_URL/cinematic-molecule.html"; then
  echo "… vite no responde: intentando levantarlo"
  nohup npx vite --port 5178 --host 0.0.0.0 > dist-video/vite.log 2>&1 &
  sleep 10
fi
if curl -s -o /dev/null -w "%{http_code}" --max-time 6 "$BASE_URL/cinematic-molecule.html" | grep -q 200; then
  echo "✓ vite: $BASE_URL"
else
  echo "✗ vite: no levanta (ver dist-video/vite.log)"; FALLAS=$((FALLAS+1))
fi
# disco (ext4: el camino crítico)
LIBRE=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
if [ "${LIBRE:-0}" -lt 60 ]; then
  echo "✗ disco: solo ${LIBRE}G libres (un lote 4K necesita ~30G de cuadros)"; FALLAS=$((FALLAS+1))
else
  echo "✓ disco: ${LIBRE}G libres"
fi
# C: DEL HOST (2026-09-04, tercera caída por lo mismo): el df de arriba MIENTE — mide el ext4
# virtual de 1007 G, no el disco físico donde vive el vhdx. Con C: en 15 MB este script decía
# "✓ todo listo" y el siguiente `vite build` mató la VM. Se mide por la puerta sshd de Windows
# (la llave de ian@WSL está en administrators_authorized_keys). Sin respuesta = aviso, no falla.
CHOST=$(ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=8 sebas@100.116.134.86 'fsutil volume diskfree C:' 2>/dev/null | tr -d '\000\r' | head -1 | grep -oE '\( *[0-9.]+ [KMGT]B\)' | tr -dc '0-9.KMGTB')
if [ -z "$CHOST" ]; then
  echo "⚠ C: del host: no se pudo medir (¿sshd de Windows caído?)"
else
  CGB=$(python3 -c "import re,sys;n,u=re.match(r'([0-9.]+)([KMGT])B',sys.argv[1]).groups();print(round(float(n)*{'K':1e-6,'M':1e-3,'G':1,'T':1e3}[u],1))" "$CHOST")
  if python3 -c "import sys;sys.exit(0 if float(sys.argv[1])<30 else 1)" "$CGB"; then
    echo "✗ C: del host: ${CGB} GB libres — el vhdx no puede crecer; limpiar ANTES de build/render (ver memoria c_lleno)"; FALLAS=$((FALLAS+1))
  else
    echo "✓ C: del host: ${CGB} GB libres"
  fi
fi
# montajes de Windows: INFORMATIVO (ya no bloquean — la entrega encola en ext4)
ls /mnt/c/Users/sebas/Downloads >/dev/null 2>&1 && echo "✓ C: montado" || echo "⚠ C: MUERTO (las entregas se encolan; revivir con wsl --shutdown desde Windows)"
ls /mnt/e/forja-videos       >/dev/null 2>&1 && echo "✓ E: montado" || echo "⚠ E: MUERTO (ídem)"
# procesos zombis de renders anteriores
Z=$(ps -eo args --no-headers | grep -cE '^node .*render-clip\.cjs' || true)
[ "$Z" -gt 0 ] && echo "⚠ $Z render-clip corriendo (¿lote activo o zombi?)" || echo "✓ cero renders colgados"

echo "── PORTEROS (canarios) ──"
if ! node scripts/salud-canarios.cjs; then FALLAS=$((FALLAS+1)); fi

if [ "${1:-}" = "--completa" ]; then
  echo "── TYPECHECK DEL CINE (tolerancia CERO) ──"
  # El repo entero arrastra errores de otros dominios (forja/molde) y por eso el #31 en una
  # escena GANADORA pasaba desapercibido — así vivió el qScale. Scoped: cine y química.
  ERRS=$(./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -cE '^src/(cinematic|lib/chem)/' || true)
  if [ "$ERRS" -gt 0 ]; then
    echo "✗ $ERRS errores de tsc en src/cinematic|src/lib/chem — un error aquí es una escena que puede NO CARGAR:"
    ./node_modules/.bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -E '^src/(cinematic|lib/chem)/' | head -12
    FALLAS=$((FALLAS+1))
  else
    echo "✓ tsc limpio en src/cinematic + src/lib/chem"
  fi
fi

echo "────────────────"
if [ "$FALLAS" -gt 0 ]; then echo "✗ SALUD: $FALLAS problema(s) BLOQUEANTES"; exit 1; fi
echo "✓ SALUD: todo listo para trabajar"
