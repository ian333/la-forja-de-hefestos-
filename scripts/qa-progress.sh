#!/usr/bin/env bash
# qa-progress.sh — QA del motor de progreso EN iangpu (el cd vive AQUÍ, no en el ssh).
set -e
cd /home/ian/Orkesta/la-forja

echo "══ 1/2 · vitest: motor de progreso ══"
npx vitest run src/lib/__tests__/progress.test.ts 2>&1 | tail -14

echo ""
echo "══ 2/2 · E2E: química→mate→perfil real (GPU) ══"
DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
  node scripts/perfil-e2e.cjs
