#!/usr/bin/env bash
# ============================================================================
# deploy.sh — La Forja → ATLAS (university.gaiaprime.com.mx)
# ============================================================================
# Build estático + rsync a /mnt/hdd/forja-dist en ATLAS. nginx sirve directo
# desde disco, no hace falta restart de container.
#
# Uso:
#   ./deploy.sh              # build + sync + smoke test
#   ./deploy.sh --skip-build # solo sync (si ya tienes dist/ fresco)
#   ./deploy.sh --restart    # tambien recrea gaia_forja_atlas (raro)
# ============================================================================
set -euo pipefail

ATLAS_IP="100.97.118.117"
ATLAS_USER="ian"
REMOTE_DIST="/mnt/hdd/forja-dist"
URL="https://university.gaiaprime.com.mx"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

SKIP_BUILD=false
RESTART_CONTAINER=false
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --restart)    RESTART_CONTAINER=true ;;
    --help|-h)
      echo "Uso: $0 [--skip-build] [--restart]"
      exit 0 ;;
  esac
done

echo -e "${BLUE}=== Deploy La Forja → ATLAS ===${NC}"

# 1. Connectivity
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes \
      "${ATLAS_USER}@${ATLAS_IP}" "echo ok" >/dev/null 2>&1; then
  echo -e "${RED}ATLAS inalcanzable (${ATLAS_IP}). Aborto.${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} ATLAS alcanzable"

# 2. Build
if [ "$SKIP_BUILD" = false ]; then
  if [ ! -d node_modules ]; then
    echo -e "${YELLOW}node_modules ausente — corriendo npm ci${NC}"
    npm ci --no-audit --no-fund
  fi
  echo -e "${YELLOW}Build (vite)…${NC}"
  npm run build 2>&1 | tail -8
  echo -e "${GREEN}✓${NC} build OK ($(du -sh dist | cut -f1))"
else
  [ -d dist ] || { echo -e "${RED}dist/ no existe y pasaste --skip-build${NC}"; exit 1; }
  echo -e "${YELLOW}skip-build — usando dist/ existente ($(du -sh dist | cut -f1))${NC}"
fi

# 3. Rsync (--delete para no acumular basura entre builds)
echo -e "${YELLOW}Rsync → ${ATLAS_USER}@${ATLAS_IP}:${REMOTE_DIST}/…${NC}"
rsync -az --delete --info=stats1 \
  -e "ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15" \
  dist/ "${ATLAS_USER}@${ATLAS_IP}:${REMOTE_DIST}/" \
  | grep -E 'transferred|deleted|speedup' || true
echo -e "${GREEN}✓${NC} dist sincronizado"

# 4. Optional container recreate (rara vez necesario — nginx lee fs directo)
if [ "$RESTART_CONTAINER" = true ]; then
  echo -e "${YELLOW}Reiniciando gaia_forja_atlas…${NC}"
  ssh "${ATLAS_USER}@${ATLAS_IP}" "docker restart gaia_forja_atlas" >/dev/null
  sleep 3
fi

# 5. Smoke test contra el dominio publico
echo -e "${YELLOW}Smoke test…${NC}"
ok=true
for path in "" "lab.html" "brain.html" "physics.html" "math.html" "occt-import-js.wasm"; do
  code=$(curl -sI -m 12 -o /dev/null -w '%{http_code}' "${URL}/${path}" 2>/dev/null || echo "ERR")
  printf "  %-30s %s\n" "/${path:-(root)}" "$code"
  [[ "$code" != "200" ]] && ok=false
done

COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
echo ""
echo -e "${BLUE}============================================${NC}"
if $ok; then
  echo -e "  ${GREEN}DEPLOY OK${NC}"
else
  echo -e "  ${RED}DEPLOY CON FALLAS${NC} — revisa codes arriba"
fi
echo -e "  Commit:  ${COMMIT}"
echo -e "  URL:     ${URL}"
echo -e "  Diff:    git status --short | wc -l = $(git status --short | wc -l) archivos sin commit"
echo -e "${BLUE}============================================${NC}"

$ok || exit 1
