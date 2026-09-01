#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# iangpu.sh — UN SOLO CAMINO para correr algo en la máquina de render.
#
# POR QUÉ EXISTE (2026-08-31): iangpu se alcanza por Tailscale, pero Tailscale
# se desloguea solo (`state: NeedsLogin`) y eso pide NAVEGADOR — o sea, bloquea
# el trabajo hasta que ian esté enfrente. La máquina NUNCA estuvo caída: WSL
# sigue corriendo y el sshd de WINDOWS (sebas@100.116.134.86) sí responde, así
# que se entra por ahí con `wsl -d Ubuntu -u ian`. Este script prueba el camino
# directo y si no, salta por Windows — solo. Cero decisiones a mano.
#
# Y de paso mata los tres gotchas ya pagados:
#   · `cd /home/ian/Orkesta/la-forja` SIEMPRE (un ssh pelón cae en $HOME).
#   · LD_LIBRARY_PATH=/usr/lib/wsl/lib (sin esto cupy dice "no CUDA-capable device"
#     aunque nvidia-smi vea la GPU perfecto).
#   · env de render GPU (DISPLAY/GALLIUM/MESA) para el Chrome headless con ANGLE.
#
#   scripts/iangpu.sh 'python3 scripts/foo.py'      → corre y devuelve la salida
#   scripts/iangpu.sh --push archivo1 archivo2      → copia fuentes a iangpu
#   scripts/iangpu.sh --pull remoto local           → trae un archivo de vuelta
# ══════════════════════════════════════════════════════════════════════════════
set -uo pipefail
TS_HOST=ian@100.65.173.85
WIN_HOST=sebas@100.116.134.86
REPO=/home/ian/Orkesta/la-forja
PRE="cd $REPO && export LD_LIBRARY_PATH=/usr/lib/wsl/lib:\${LD_LIBRARY_PATH:-} DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA"

via_tailscale() { timeout 12 ssh -o ConnectTimeout=8 -o BatchMode=yes "$TS_HOST" true 2>/dev/null; }

run_ts()  { ssh -o ConnectTimeout=10 "$TS_HOST" "$PRE && $1"; }
run_win() {
  # ⚠ el ssh de Windows NO cae en un shell POSIX: cae en cmd.exe. Cualquier comilla o
  # backslash que le mandes lo mastica cmd ANTES de que WSL lo vea ("\" no se reconoce
  # como un comando interno o externo). La única forma robusta es que cmd solo vea
  # base64 —letras y dígitos— y que bash decodifique del otro lado.
  local b64; b64=$(printf '%s' "$PRE && $1" | base64 -w0)
  ssh -o ConnectTimeout=15 "$WIN_HOST" "wsl -d Ubuntu -u ian -e bash -lc \"eval \$(echo $b64 | base64 -d)\"" 2>&1 | tr -d '\000'
}

case "${1:-}" in
  --push)
    shift
    if via_tailscale; then
      # -R (relativo) CONSERVA la ruta: sin él, `scripts/x.py` aterrizaba en la RAÍZ del
      # repo y el comando de allá fallaba con "No such file". La rama de Windows sí la
      # respetaba, así que el bug solo aparecía cuando Tailscale estaba arriba.
      rsync -azR --no-perms --no-owner --no-group "$@" "$TS_HOST:$REPO/" && echo "✓ push por tailscale (rutas conservadas)"
    else
      # ⚠ cmd.exe topa la línea de comando en ~8 KB, así que el archivo NO puede ir
      # como argumento (27 KB en base64 y falla mudo). Va por STDIN, que el ssh de
      # Windows sí reenvía intacto hasta el bash de WSL.
      for f in "$@"; do
        # una ruta ABSOLUTA se recreaba como árbol dentro del repo (…/la-forja/tmp/…);
        # fuera del repo se manda por basename a la raíz del repo.
        case "$f" in /*) rel="$(basename "$f")" ;; *) rel="${f#./}" ;; esac
        cmd64=$(printf '%s' "cd $REPO && mkdir -p \"\$(dirname '$rel')\" && base64 -d > '$rel'" | base64 -w0)
        base64 -w0 "$f" | ssh -o ConnectTimeout=25 "$WIN_HOST" "wsl -d Ubuntu -u ian -e bash -lc \"eval \$(echo $cmd64 | base64 -d)\"" >/dev/null 2>&1 \
          && echo "  ✓ $rel ($(stat -c%s "$f") bytes)" || { echo "  ✗ $rel"; exit 1; }
      done
      echo "✓ push por el host de Windows"
    fi
    ;;
  --pull)
    if via_tailscale; then
      scp -q "$TS_HOST:$REPO/$2" "$3" && echo "✓ pull por tailscale → $3"
    else
      mkdir -p "$(dirname "$3")"
      pull64=$(printf '%s' "base64 -w0 $REPO/$2" | base64 -w0)
      ssh -o ConnectTimeout=60 "$WIN_HOST" "wsl -d Ubuntu -u ian -e bash -lc \"eval \$(echo $pull64 | base64 -d)\"" 2>/dev/null | tr -d '\000\r' | base64 -d > "$3" \
        && echo "✓ pull por Windows → $3 ($(stat -c%s "$3") bytes)"
    fi
    ;;
  --donde)
    if via_tailscale; then echo "tailscale (directo)"; else echo "host de Windows (tailscale deslogueado)"; fi
    ;;
  *)
    if via_tailscale; then run_ts "$*"; else run_win "$*"; fi
    ;;
esac
