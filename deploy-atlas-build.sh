#!/usr/bin/env bash
# ============================================================================
# deploy-atlas-build.sh — La Forja: build REMOTO en ATLAS con caché de
# node_modules + telemetría detallada de cada etapa.
# ============================================================================
# Etapas (cada una con cronómetro):
#   [ 1/10] Connectivity   — ssh probe
#   [ 2/10] Cache check    — sha256(package-lock.json) vs ATLAS
#   [ 3/10] Atlas snapshot — RAM, disco, dist actual
#   [ 4/10] Clean cache    — sólo si hubo miss
#   [ 5/10] Rsync source   — progress2 en vivo
#   [ 6/10] Build          — npm ci + vite build (output crudo, sin filtrar)
#   [ 7/10] Save lockhash  — si reinstalamos deps
#   [ 8/10] Publish dist   — rsync atómico → /mnt/hdd/forja-dist
#   [ 9/10] Reconcile nginx — inyecta server block university → forja_atlas
#                            (idempotente; sobrevive deploys de Orkesta)
#   [10/10] Smoke tests    — todas las páginas + university routing
#
# IMPORTANTE: la etapa 9 es CRÍTICA. El gateway de Orkesta (gaia_gateway_atlas)
# tiene un único server_name `_;` que captura TODO el tráfico hacia el frontend
# de Orkesta. Sin la regla específica para university.gaiaprime.com.mx, este
# subdominio sirve la app equivocada. Cada deploy de Orkesta puede borrar la
# regla; cada deploy nuestro la repone. Idempotente.
#
# Uso:
#   ./deploy-atlas-build.sh              # normal (con caché)
#   ./deploy-atlas-build.sh --no-cache   # ignora caché, fuerza npm ci
#   ./deploy-atlas-build.sh --quiet      # menos verboso
# ============================================================================
set -euo pipefail

ATLAS_IP="100.97.118.117"
ATLAS_USER="ian"
REMOTE_BUILD="/mnt/hdd/forja-build"
REMOTE_DIST="/mnt/hdd/forja-dist"
REMOTE_LOCKHASH="${REMOTE_BUILD}/.lockhash"
URL="https://university.gaiaprime.com.mx"
NODE_IMG="node:20-slim"

NO_CACHE=false
QUIET=false
for arg in "$@"; do
  case "$arg" in
    --no-cache) NO_CACHE=true ;;
    --quiet)    QUIET=true ;;
    --help|-h)
      grep -E '^#( |$)' "$0" | sed 's/^# \{0,1\}//'
      exit 0 ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Color codes ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; MAGENTA='\033[0;35m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

# ── Cronómetros ─────────────────────────────────────────────────────────
T_START=$(date +%s)
declare -A STAGE_TIMES
stage_begin() { STAGE_BEGIN_TS=$(date +%s); STAGE_NAME="$1"; }
stage_end() {
  local now=$(date +%s)
  local dt=$((now - STAGE_BEGIN_TS))
  STAGE_TIMES[$STAGE_NAME]=$dt
  printf "${DIM}    ⏱  %d s${NC}\n" "$dt"
}
fmt_bytes() {
  local b=$1
  if   (( b < 1024 ));            then echo "${b} B"
  elif (( b < 1048576 ));         then printf "%.1f KB" "$(echo "$b/1024" | bc -l)"
  elif (( b < 1073741824 ));      then printf "%.1f MB" "$(echo "$b/1048576" | bc -l)"
  else                                 printf "%.2f GB" "$(echo "$b/1073741824" | bc -l)"; fi
}
hr() { printf "${BLUE}%s${NC}\n" "──────────────────────────────────────────────────────────"; }
banner() {
  hr
  printf "${BOLD}${CYAN}[%s]${NC} ${BOLD}%s${NC}\n" "$1" "$2"
  hr
}

# ── Datos del repo local ────────────────────────────────────────────────
COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
LOCAL_SRC_SIZE=$(du -sh --exclude=node_modules --exclude=dist --exclude=.git --exclude=.npm . 2>/dev/null | awk '{print $1}')
LOCAL_FILE_COUNT=$(find . -type f \
  -not -path './node_modules/*' -not -path './dist/*' -not -path './.git/*' \
  -not -path './.npm/*' -not -path './.claude/*' -not -path './test-results/*' \
  -not -path './fit-diagnostics/*' 2>/dev/null | wc -l | tr -d ' ')

echo ""
printf "${BOLD}${MAGENTA}╔══════════════════════════════════════════════════════════╗${NC}\n"
printf "${BOLD}${MAGENTA}║         La Forja · Deploy remoto a ATLAS                 ║${NC}\n"
printf "${BOLD}${MAGENTA}╚══════════════════════════════════════════════════════════╝${NC}\n"
printf "  ${DIM}commit:${NC}   %s  ${DIM}(rama %s)${NC}\n" "$COMMIT" "$BRANCH"
printf "  ${DIM}cambios sin commit:${NC} %s\n" "$DIRTY"
printf "  ${DIM}fuente local:${NC} %s (%s archivos)\n" "$LOCAL_SRC_SIZE" "$LOCAL_FILE_COUNT"
printf "  ${DIM}target:${NC}     ${ATLAS_USER}@${ATLAS_IP}:${REMOTE_BUILD}\n"
printf "  ${DIM}dist dest:${NC}  ${REMOTE_DIST}\n"
printf "  ${DIM}URL:${NC}        ${URL}\n"
echo ""

# ── [1/10] Conectividad ─────────────────────────────────────────────────
banner "1/10" "Verificando conectividad con ATLAS…"
stage_begin "connectivity"
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes \
      "${ATLAS_USER}@${ATLAS_IP}" "echo ok" >/dev/null 2>&1; then
  echo -e "${RED}✗ ATLAS inalcanzable (${ATLAS_IP})${NC}"
  exit 1
fi
# Probe latencia
LATENCY=$(ssh "${ATLAS_USER}@${ATLAS_IP}" "uptime -p 2>/dev/null || uptime")
echo -e "${GREEN}✓${NC} ATLAS alcanzable · uptime: ${LATENCY}"
stage_end

# ── [2/10] Comprobar caché ──────────────────────────────────────────────
banner "2/10" "Comprobando caché de node_modules…"
stage_begin "cache_check"
LOCAL_LOCKHASH=$(sha256sum package-lock.json | awk '{print $1}')
printf "  ${DIM}package-lock.json sha256:${NC} %s…\n" "${LOCAL_LOCKHASH:0:24}"

CACHE_INFO=$(ssh "${ATLAS_USER}@${ATLAS_IP}" "
  mkdir -p ${REMOTE_BUILD}
  if [ -f ${REMOTE_LOCKHASH} ] && [ -d ${REMOTE_BUILD}/node_modules ]; then
    HASH=\$(cat ${REMOTE_LOCKHASH})
    SIZE=\$(du -sh ${REMOTE_BUILD}/node_modules 2>/dev/null | awk '{print \$1}')
    COUNT=\$(find ${REMOTE_BUILD}/node_modules -maxdepth 2 -type d 2>/dev/null | wc -l)
    AGE=\$(stat -c %Y ${REMOTE_LOCKHASH})
    echo \"\$HASH|\$SIZE|\$COUNT|\$AGE\"
  else
    echo \"MISS||0|0\"
  fi
")
REMOTE_HASH=$(echo "$CACHE_INFO" | cut -d'|' -f1)
REMOTE_NM_SIZE=$(echo "$CACHE_INFO" | cut -d'|' -f2)
REMOTE_NM_COUNT=$(echo "$CACHE_INFO" | cut -d'|' -f3)
REMOTE_HASH_AGE=$(echo "$CACHE_INFO" | cut -d'|' -f4)

REUSE_DEPS=false
if [ "$NO_CACHE" = true ]; then
  echo -e "${YELLOW}  → caché IGNORADA (--no-cache)${NC}"
elif [ "$REMOTE_HASH" = "$LOCAL_LOCKHASH" ]; then
  REUSE_DEPS=true
  AGE_HUMAN=$(( ($(date +%s) - REMOTE_HASH_AGE) / 60 ))
  printf "${GREEN}  → caché HIT${NC} · ${REMOTE_NM_SIZE} · ${REMOTE_NM_COUNT} dirs · hace %d min\n" "$AGE_HUMAN"
  echo -e "${GREEN}  → vamos a saltarnos npm ci (ahorro ~3 min)${NC}"
elif [ "$REMOTE_HASH" = "MISS" ]; then
  echo -e "${YELLOW}  → caché VACÍA (primera corrida o limpieza previa)${NC}"
else
  echo -e "${YELLOW}  → caché STALE${NC} · package-lock.json cambió"
  printf "    ${DIM}remoto:${NC} %s…\n" "${REMOTE_HASH:0:24}"
  printf "    ${DIM}local:${NC}  %s…\n" "${LOCAL_LOCKHASH:0:24}"
fi
stage_end

# ── [3/10] Snapshot de ATLAS ────────────────────────────────────────────
banner "3/10" "Snapshot de ATLAS (RAM, disco, dist actual)…"
stage_begin "atlas_snapshot"
ssh "${ATLAS_USER}@${ATLAS_IP}" "
  echo '  ${BOLD}RAM:${NC}'
  free -h | awk 'NR==1 || NR==2 {printf \"    %s\\n\", \$0}'
  echo '  ${BOLD}Disco /mnt/hdd:${NC}'
  df -h /mnt/hdd | awk 'NR==2 {printf \"    used %s / %s (%s) · libre %s\\n\", \$3, \$2, \$5, \$4}'
  echo '  ${BOLD}dist actual:${NC}'
  if [ -d ${REMOTE_DIST} ]; then
    SIZE=\$(du -sh ${REMOTE_DIST} 2>/dev/null | awk '{print \$1}')
    FILES=\$(find ${REMOTE_DIST} -type f 2>/dev/null | wc -l)
    MTIME=\$(stat -c '%y' ${REMOTE_DIST} 2>/dev/null | cut -d. -f1)
    printf '    %s · %s archivos · última actualización %s\\n' \"\$SIZE\" \"\$FILES\" \"\$MTIME\"
  else
    echo '    (vacío)'
  fi
  echo '  ${BOLD}docker:${NC}'
  CONTAINERS=\$(docker ps -q 2>/dev/null | wc -l)
  printf '    %s containers corriendo\\n' \"\$CONTAINERS\"
"
stage_end

# ── [4/10] Limpieza condicional ─────────────────────────────────────────
banner "4/10" "Limpieza de cache (sólo si miss)…"
stage_begin "clean"
if [ "$REUSE_DEPS" != true ]; then
  ssh "${ATLAS_USER}@${ATLAS_IP}" "
    set -e
    if [ -d ${REMOTE_BUILD}/node_modules ]; then
      du -sh ${REMOTE_BUILD}/node_modules 2>/dev/null | awk '{printf \"  borrando node_modules (%s)…\\n\", \$1}'
    fi
    rm -rf ${REMOTE_BUILD}/node_modules ${REMOTE_BUILD}/.npm ${REMOTE_BUILD}/.lockhash
    mkdir -p ${REMOTE_BUILD}
  "
  echo -e "${GREEN}✓${NC} node_modules, .npm, .lockhash borrados"
else
  echo -e "${DIM}  saltando (cache hit — mantenemos node_modules y .npm intactos)${NC}"
fi
stage_end

# ── [5/10] Rsync con progreso (en DOS pasos) ────────────────────────────
#   5a) Código + audios + assets chicos:    -z (gzip), delta, --delete
#   5b) Assets PESADOS (viz-data, hdri, wasm): sin compresión + --size-only
#       — JSON ya gigante, MP3/WASM binarios: comprimir es contraproducente.
#       — --size-only salta archivos cuyo tamaño no cambió (instant).
# ───────────────────────────────────────────────────────────────────────
banner "5/10" "Sincronizando fuente con ATLAS (2 pasos)…"
stage_begin "rsync"

# Cipher rápido para la conexión SSH (aes128-gcm tiene HW acceleration)
SSH_FAST="ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 -c aes128-gcm@openssh.com -o Compression=no"

if $QUIET; then RSYNC_OUT_FLAGS="--info=stats1"
else            RSYNC_OUT_FLAGS="--info=progress2 --human-readable"
fi

# ── 5a. Código (rápido — pocos MB de texto) ──────────────────────────
echo -e "${BOLD}  5a. Código + audios ligeros${NC}"
RSYNC_FLAGS_CODE="-az --delete \
  --exclude=node_modules/ \
  --exclude=dist/ \
  --exclude=dist-video/ \
  --exclude=_shots-phases/ \
  --exclude=.git/ \
  --exclude=.claude/ \
  --exclude=.npm/ \
  --exclude=.lockhash \
  --exclude=*.log \
  --exclude=test-results/ \
  --exclude=fit-diagnostics/ \
  --exclude=public/viz-data/ \
  --exclude=public/hdri/ \
  --exclude=public/occt-import-js.wasm"

# shellcheck disable=SC2086
rsync $RSYNC_FLAGS_CODE $RSYNC_OUT_FLAGS \
  -e "$SSH_FAST" \
  ./ "${ATLAS_USER}@${ATLAS_IP}:${REMOTE_BUILD}/"
echo -e "${GREEN}  ✓${NC} código sincronizado"
echo ""

# ── 5b. Assets pesados (--size-only, sin compresión) ────────────────
echo -e "${BOLD}  5b. Assets pesados (size-only check)${NC}"
LARGE_LOCAL_SIZE=$(du -sh public/viz-data public/hdri public/occt-import-js.wasm 2>/dev/null | tail -1 | awk '{print $1}')
echo -e "  ${DIM}target: public/viz-data/, public/hdri/, *.wasm (~270 MB total)${NC}"

# Asegurar que el dir base existe en ATLAS
ssh "${ATLAS_USER}@${ATLAS_IP}" "mkdir -p ${REMOTE_BUILD}/public/viz-data ${REMOTE_BUILD}/public/hdri"

# viz-data — los JSON CAD pesan ~267 MB. --size-only: si tamaño no cambió, skip.
# shellcheck disable=SC2086
rsync -a --size-only $RSYNC_OUT_FLAGS \
  -e "$SSH_FAST" \
  public/viz-data/ "${ATLAS_USER}@${ATLAS_IP}:${REMOTE_BUILD}/public/viz-data/"

# hdri (1.7 MB) y wasm (7.6 MB) — chicos pero también binarios
# shellcheck disable=SC2086
rsync -a --size-only \
  -e "$SSH_FAST" \
  public/hdri/ "${ATLAS_USER}@${ATLAS_IP}:${REMOTE_BUILD}/public/hdri/"

# shellcheck disable=SC2086
rsync -a --size-only \
  -e "$SSH_FAST" \
  public/occt-import-js.wasm "${ATLAS_USER}@${ATLAS_IP}:${REMOTE_BUILD}/public/"

echo -e "${GREEN}  ✓${NC} assets verificados"
echo -e "${GREEN}✓${NC} fuente sincronizada (2 pasos)"
stage_end

# ── [6/10] Build ────────────────────────────────────────────────────────
if $REUSE_DEPS; then
  BUILD_CMD="npm run build"
  BANNER_BUILD="reusa node_modules · sólo vite build"
else
  BUILD_CMD="npm ci --no-audit --no-fund --force --loglevel=info && npm run build"
  BANNER_BUILD="npm ci + vite build (cold)"
fi
banner "6/10" "Build en ATLAS · ${BANNER_BUILD}"
stage_begin "build"
echo -e "${DIM}  contenedor: ${NODE_IMG} · --memory=8g · output sin filtrar${NC}"
echo ""

# El output del docker run pasa entero — sin tail. Si algo se rompe, ves
# exactamente dónde. Con el || echo... capturamos el exit code real.
ssh -t "${ATLAS_USER}@${ATLAS_IP}" bash <<EOSSH || BUILD_FAILED=true
set -euo pipefail
cd ${REMOTE_BUILD}
START=\$(date +%s)
docker run --rm \
  --memory=8g \
  --memory-swap=8g \
  -v "\$PWD":/work \
  -w /work \
  -u "\$(id -u):\$(id -g)" \
  -e HOME=/work \
  -e NPM_CONFIG_PROGRESS=true \
  -e CI=false \
  ${NODE_IMG} \
  sh -c "${BUILD_CMD}"
END=\$(date +%s)
echo ""
echo "  build interno: \$((END - START)) s"
echo "  dist size:     \$(du -sh dist 2>/dev/null | awk '{print \$1}')"
echo "  dist files:    \$(find dist -type f 2>/dev/null | wc -l)"
EOSSH

if [ "${BUILD_FAILED:-false}" = "true" ]; then
  echo -e "${RED}✗ Build falló en ATLAS — revisa el output arriba${NC}"
  exit 1
fi
echo -e "${GREEN}✓${NC} build OK"
stage_end

# ── [7/10] Guardar hash de éxito ────────────────────────────────────────
banner "7/10" "Persistencia de caché…"
stage_begin "save_hash"
if ! $REUSE_DEPS; then
  ssh "${ATLAS_USER}@${ATLAS_IP}" "echo '${LOCAL_LOCKHASH}' > ${REMOTE_LOCKHASH}"
  echo -e "${GREEN}✓${NC} lockhash guardado (próximo deploy reutilizará deps)"
else
  echo -e "${DIM}  cache se preserva tal cual (no se tocó)${NC}"
fi
stage_end

# ── [8/10] Publicar dist ────────────────────────────────────────────────
banner "8/10" "Publicando dist → ${REMOTE_DIST}…"
stage_begin "publish"
ssh "${ATLAS_USER}@${ATLAS_IP}" "
  set -euo pipefail
  test -d ${REMOTE_BUILD}/dist || { echo 'ERROR: no hay dist/'; exit 1; }
  OLD_SIZE=\$(du -sb ${REMOTE_DIST} 2>/dev/null | awk '{print \$1}')
  OLD_SIZE=\${OLD_SIZE:-0}
  rsync -a --delete --info=stats1 ${REMOTE_BUILD}/dist/ ${REMOTE_DIST}/
  NEW_SIZE=\$(du -sb ${REMOTE_DIST} 2>/dev/null | awk '{print \$1}')
  NEW_HUMAN=\$(du -sh ${REMOTE_DIST} 2>/dev/null | awk '{print \$1}')
  DELTA=\$((NEW_SIZE - OLD_SIZE))
  SIGN=\$( [ \$DELTA -ge 0 ] && echo + || echo - )
  ABS=\${DELTA#-}
  ABS_HUMAN=\$(numfmt --to=iec --suffix=B \${ABS} 2>/dev/null || echo \"\${ABS} B\")
  echo \"  dist: \${NEW_HUMAN} (\${SIGN}\${ABS_HUMAN} vs anterior)\"
  rm -rf ${REMOTE_BUILD}/dist
"
echo -e "${GREEN}✓${NC} publicado"
stage_end

# ── [9/10] Reconciliar regla nginx para university ────────────────────
# El gateway de Orkesta tiene solo `server_name _;` (catch-all → Orkesta).
# Sin esta regla extra, university.gaiaprime.com.mx sirve Mercuria Cortex.
# Inyectamos el server block como archivo separado (99-university.conf)
# para que NINGÚN deploy de Orkesta lo sobreescriba: el gateway de Orkesta
# regenera default.conf y 00-site.conf, pero deja intactos los 99-*.conf
# que estén en /etc/nginx/conf.d/. Idempotente: si ya existe con el mismo
# contenido, no se reload nada.
banner "9/10" "Reconciliando regla nginx · university → forja_atlas…"
stage_begin "reconcile_nginx"

# Escribir la config esperada en un tmpfile local (más simple que
# escapar variables a través de doble SSH heredoc).
EXPECTED_CONF_FILE=$(mktemp /tmp/forja-99-university.XXXXXX.conf)
trap "rm -f $EXPECTED_CONF_FILE" EXIT
cat > "$EXPECTED_CONF_FILE" <<'NGINX_CONF'
# Generado por la-forja/deploy-atlas-build.sh — NO EDITAR a mano.
# Si lo borras, el próximo deploy de La Forja lo vuelve a poner.
# Si Orkesta lo sobrescribe, abre issue: cluster/nginx/* no debe tocar
# archivos 99-*.conf en /etc/nginx/conf.d/.
server {
    listen 80;
    server_name university.gaiaprime.com.mx;

    # Asset caching para los MP3 grandes y los JS de la app
    location ~* \.(mp3|js|css|woff2?|wasm)$ {
        proxy_pass http://gaia_forja_atlas:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
    }

    location / {
        proxy_pass http://gaia_forja_atlas:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SPA fallback (si el browser pega a /economia.html?id=X y nginx
        # devuelve 404, intenta /index.html).
        proxy_intercept_errors on;
        error_page 404 = @forja_spa_fallback;
    }

    location @forja_spa_fallback {
        # nginx no permite URI part en proxy_pass dentro de named locations;
        # reescribimos primero el path interno y luego proxy_pass sin URI.
        rewrite ^.*$ /index.html break;
        proxy_pass http://gaia_forja_atlas:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX_CONF

# Hash local del contenido esperado
EXPECTED_HASH=$(sha256sum "$EXPECTED_CONF_FILE" | awk '{print $1}')

# Verificar hash remoto del archivo actual en el container del gateway
CURRENT_HASH=$(ssh "${ATLAS_USER}@${ATLAS_IP}" \
  "docker exec gaia_gateway_atlas sh -c 'test -f /etc/nginx/conf.d/99-university.conf && sha256sum /etc/nginx/conf.d/99-university.conf | awk \"{print \\\$1}\" || echo MISSING'" \
  2>/dev/null)

if [ "$EXPECTED_HASH" = "$CURRENT_HASH" ]; then
  echo "  → regla ya presente y correcta (sha256:${EXPECTED_HASH:0:12})"
  echo "  → no se reload nginx"
else
  if [ "$CURRENT_HASH" = "MISSING" ]; then
    echo "  → 99-university.conf AUSENTE — inyectando…"
    echo "  → causa probable: deploy reciente de Orkesta resetó /etc/nginx/conf.d/"
  else
    echo "  → 99-university.conf existe pero CAMBIÓ — reaplicando…"
    printf "    actual:    sha256:%s\n" "${CURRENT_HASH:0:12}"
    printf "    esperado:  sha256:%s\n" "${EXPECTED_HASH:0:12}"
  fi

  # Pipe del archivo al container del gateway via docker exec stdin.
  # Esto NO requiere root en el host: docker socket maneja la escritura
  # dentro del container.
  ssh "${ATLAS_USER}@${ATLAS_IP}" \
    "docker exec -i gaia_gateway_atlas sh -c 'cat > /etc/nginx/conf.d/99-university.conf'" \
    < "$EXPECTED_CONF_FILE"

  # Validar config ANTES de reload — si nginx -t falla, NO recargamos
  if ! ssh "${ATLAS_USER}@${ATLAS_IP}" \
        "docker exec gaia_gateway_atlas nginx -t" 2>&1 | tail -3; then
    echo -e "${RED}  ERROR: nginx -t falló, no se reload${NC}"
    exit 1
  fi

  # Reload — preserva conexiones existentes
  ssh "${ATLAS_USER}@${ATLAS_IP}" \
    "docker exec gaia_gateway_atlas nginx -s reload"
  echo "  → nginx -s reload OK"
fi

rm -f "$EXPECTED_CONF_FILE"
trap - EXIT
echo -e "${GREEN}✓${NC} regla university reconciliada"
stage_end

# ── [10/10] Smoke tests ──────────────────────────────────────────────────
banner "10/10" "Smoke tests…"
stage_begin "smoke"
ok=true
TESTS_PASS=0
TESTS_FAIL=0
SMOKE_PATHS=(
  ""
  "escuela.html"
  "lab.html"
  "brain.html"
  "physics.html"
  "math.html"
  "economia.html"
  "econ-lab.html"
  "physics-nobel.html"
  "math-prizes.html"
  "masterclass.html"
  "occt-import-js.wasm"
  "audio/masterclass/blackhole/manifest.json"
  "audio/masterclass/blackhole/01-pregunta.mp3"
  "audio/masterclass/phys-einstein-pe/manifest.json"
  "audio/masterclass/phys-einstein-pe/01-pregunta.mp3"
)
for path in "${SMOKE_PATHS[@]}"; do
  code=$(curl -sI -m 12 -o /dev/null -w '%{http_code}|%{size_download}|%{time_total}' "${URL}/${path}" 2>/dev/null || echo "ERR|0|0")
  http_code=$(echo "$code" | cut -d'|' -f1)
  time_total=$(echo "$code" | cut -d'|' -f3)
  if [ "$http_code" = "200" ]; then
    printf "  ${GREEN}✓${NC} %-50s ${DIM}%s · %.2fs${NC}\n" "/${path:-(root)}" "$http_code" "$time_total"
    TESTS_PASS=$((TESTS_PASS + 1))
  else
    printf "  ${RED}✗${NC} %-50s ${RED}%s${NC}\n" "/${path:-(root)}" "$http_code"
    TESTS_FAIL=$((TESTS_FAIL + 1))
    ok=false
  fi
done
echo ""
printf "  ${BOLD}%d passed${NC} · ${RED}%d failed${NC}\n" "$TESTS_PASS" "$TESTS_FAIL"
stage_end

# ── Resumen final ──────────────────────────────────────────────────────
T_END=$(date +%s)
TOTAL=$((T_END - T_START))

echo ""
hr
if $ok; then
  printf "${GREEN}${BOLD}  ✓ DEPLOY OK${NC}\n"
else
  printf "${RED}${BOLD}  ✗ DEPLOY CON FALLAS${NC}\n"
fi
hr
printf "  ${DIM}commit:${NC}    %s (${BRANCH})\n" "$COMMIT"
printf "  ${DIM}URL:${NC}       ${URL}\n"
printf "  ${DIM}caché:${NC}     %s\n" "$($REUSE_DEPS && echo "${GREEN}HIT${NC} (npm ci se omitió)" || echo "${YELLOW}MISS${NC} (npm ci corrió)")"
echo ""
printf "  ${BOLD}Tiempos por etapa:${NC}\n"
for stage in connectivity cache_check atlas_snapshot clean rsync build save_hash publish reconcile_nginx smoke; do
  t=${STAGE_TIMES[$stage]:-0}
  bar=""
  if (( TOTAL > 0 )); then
    width=$(( t * 30 / TOTAL ))
    for ((i=0; i<width; i++)); do bar+="█"; done
  fi
  printf "    ${DIM}%-20s${NC} %3d s  %s\n" "$stage" "$t" "$bar"
done
echo ""
printf "  ${BOLD}Total: %d s ($(( TOTAL / 60 )) min %d s)${NC}\n" "$TOTAL" "$(( TOTAL % 60 ))"
hr

$ok || exit 1
