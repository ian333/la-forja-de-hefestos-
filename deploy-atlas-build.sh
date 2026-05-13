#!/usr/bin/env bash
# ============================================================================
# deploy-atlas-build.sh — La Forja: build REMOTO en ATLAS (sin gastar RAM local)
# ============================================================================
# Sincroniza el código fuente a ATLAS:/tmp/forja-build/, hace build dentro de
# un contenedor node:20-slim (12 GiB libres allá), y publica dist/ en
# /mnt/hdd/forja-dist/ donde nginx ya sirve university.gaiaprime.com.mx.
#
# Uso:
#   ./deploy-atlas-build.sh        # sync + build remoto + publish + smoke
#   ./deploy-atlas-build.sh --keep # no borra /tmp/forja-build/ tras éxito
# ============================================================================
set -euo pipefail

ATLAS_IP="100.97.118.117"
ATLAS_USER="ian"
REMOTE_BUILD="/tmp/forja-build"
REMOTE_DIST="/mnt/hdd/forja-dist"
URL="https://university.gaiaprime.com.mx"
NODE_IMG="node:20-slim"

KEEP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --keep) KEEP_BUILD=true ;;
    --help|-h) echo "Uso: $0 [--keep]"; exit 0 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
echo -e "${BLUE}=== Deploy remoto (build en ATLAS) ===${NC}"

# 1. Connectivity
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes \
      "${ATLAS_USER}@${ATLAS_IP}" "echo ok" >/dev/null 2>&1; then
  echo -e "${RED}ATLAS inalcanzable (${ATLAS_IP})${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} ATLAS alcanzable"

# 2. Crear dir remoto de build limpio (preservamos node_modules si existe → cache npm)
ssh "${ATLAS_USER}@${ATLAS_IP}" "mkdir -p ${REMOTE_BUILD}"
echo -e "${GREEN}✓${NC} ${REMOTE_BUILD}/ listo en ATLAS"

# 3. Rsync fuente — excluye node_modules y dist (los regeneramos remotamente).
#    Sí incluye package-lock.json para que npm ci reproduzca.
echo -e "${YELLOW}Rsync fuente → ATLAS:${REMOTE_BUILD}/…${NC}"
rsync -az --delete \
  --exclude='node_modules/' \
  --exclude='dist/' \
  --exclude='.git/' \
  --exclude='.claude/' \
  --exclude='*.log' \
  --exclude='test-results/' \
  --exclude='fit-diagnostics/' \
  -e "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15" \
  ./ "${ATLAS_USER}@${ATLAS_IP}:${REMOTE_BUILD}/" \
  | tail -3
echo -e "${GREEN}✓${NC} fuente sincronizada"

# 4. Build dentro de contenedor node:20-slim
echo -e "${YELLOW}Build en ATLAS (node:20-slim, --memory=8g)…${NC}"
ssh "${ATLAS_USER}@${ATLAS_IP}" bash -s <<EOSSH
set -euo pipefail
cd ${REMOTE_BUILD}
docker run --rm \
  --memory=8g \
  --memory-swap=8g \
  -v "\$PWD":/work \
  -w /work \
  -u "\$(id -u):\$(id -g)" \
  -e HOME=/work \
  ${NODE_IMG} \
  sh -c "npm ci --no-audit --no-fund && npm run build" 2>&1 | tail -30
EOSSH
echo -e "${GREEN}✓${NC} build OK en ATLAS"

# 5. Mover dist → /mnt/hdd/forja-dist (atómico via rsync --delete)
echo -e "${YELLOW}Publicando dist → ${REMOTE_DIST}…${NC}"
ssh "${ATLAS_USER}@${ATLAS_IP}" "
  set -euo pipefail
  test -d ${REMOTE_BUILD}/dist || { echo 'no hay dist/'; exit 1; }
  rsync -a --delete ${REMOTE_BUILD}/dist/ ${REMOTE_DIST}/
  du -sh ${REMOTE_DIST}
"
echo -e "${GREEN}✓${NC} publicado"

# 6. Smoke test contra el dominio publico
echo -e "${YELLOW}Smoke test…${NC}"
ok=true
for path in "" "lab.html" "brain.html" "physics.html" "math.html" "occt-import-js.wasm"; do
  code=$(curl -sI -m 12 -o /dev/null -w '%{http_code}' "${URL}/${path}" 2>/dev/null || echo "ERR")
  printf "  %-30s %s\n" "/${path:-(root)}" "$code"
  [[ "$code" != "200" ]] && ok=false
done

# 7. Limpieza opcional
if ! $KEEP_BUILD; then
  ssh "${ATLAS_USER}@${ATLAS_IP}" "rm -rf ${REMOTE_BUILD}/dist" || true
fi

COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
echo ""
echo -e "${BLUE}============================================${NC}"
if $ok; then
  echo -e "  ${GREEN}DEPLOY OK${NC}"
else
  echo -e "  ${RED}DEPLOY CON FALLAS${NC}"
fi
echo -e "  Commit:  ${COMMIT}"
echo -e "  URL:     ${URL}"
echo -e "${BLUE}============================================${NC}"

$ok || exit 1
