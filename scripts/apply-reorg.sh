#!/usr/bin/env bash
# apply-reorg.sh <biblioteca_root> <plan.tsv>
# Mueve cada archivo a su carpeta limpia según el plan (mkdir -p + mv). CERO borrado.
# Idempotente: si el viejo no existe pero el nuevo sí, lo salta (ya movido).
set -u
ROOT="$1"; PLAN="$2"
moved=0; skip=0; miss=0
while IFS=$'\t' read -r old new; do
  [ -z "$old" ] && continue
  o="$ROOT/$old"; n="$ROOT/$new"
  if [ -f "$o" ]; then
    mkdir -p "$(dirname "$n")"
    mv -n "$o" "$n" && moved=$((moved+1))
  elif [ -f "$n" ]; then
    skip=$((skip+1))   # ya movido antes
  else
    miss=$((miss+1))
  fi
done < "$PLAN"
# limpiar dirs vacíos de la estructura vieja
find "$ROOT/dist-video" -type d -empty -delete 2>/dev/null
echo "movidos=$moved ya-estaban=$skip faltantes=$miss"
