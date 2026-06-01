#!/usr/bin/env bash
# Runner para los tests de invariantes del kernel B-Rep EN iangpu.
# Resuelve su propio directorio para que tsx (en node_modules del repo) cargue.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"
echo "RUNNER_PWD=$DIR"
echo "===== occt-brep-test (existente) ====="
node --import tsx scripts/occt-brep-test.cjs 2>&1 | grep -E '"pass"|fatal' | head -3
echo "BREP_EXIT=${PIPESTATUS[0]}"
echo "===== occt-features-test (nuevas ops) ====="
node --import tsx scripts/occt-features-test.cjs
echo "FEATURES_EXIT=$?"
