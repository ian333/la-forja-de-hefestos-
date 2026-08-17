#!/usr/bin/env bash
# traer.sh — corre EN LA LAPTOP: jala las entregas encoladas de iangpu al Downloads de
# Windows, con verificación de md5. Es la otra mitad del paso `entrega` de video.sh:
# iangpu SIEMPRE deja los entregables en ext4 (dist-video/entregas/, sobrevive reinicios
# y montajes drvfs muertos) y este script los trae cuando tú quieras.
#
#   bash scripts/traer.sh            # trae todo lo que falte
#   bash scripts/traer.sh atomo-cr   # solo lo que matchee ese patrón
set -uo pipefail
IANGPU=ian@100.65.173.85
ORIGEN=/home/ian/Orkesta/la-forja/dist-video/entregas
DESTINO="/mnt/c/Users/sebas/Downloads"
PATRON="${1:-}"

ls "$DESTINO" >/dev/null 2>&1 || { echo "✗ $DESTINO no está montado en ESTA máquina"; exit 1; }

LISTA=$(ssh -o ConnectTimeout=10 $IANGPU "ls $ORIGEN/*.mp4 2>/dev/null" | sed 's|.*/||')
[ -n "$LISTA" ] || { echo "no hay entregas encoladas"; exit 0; }

TRAIDOS=0
for NOM in $LISTA; do
  if [ -n "$PATRON" ] && ! echo "$NOM" | grep -qi "$PATRON"; then continue; fi
  MD5R=$(ssh $IANGPU "cat $ORIGEN/$NOM.md5 2>/dev/null" || true)
  if [ -f "$DESTINO/$NOM" ] && [ -n "$MD5R" ] && [ "$(md5sum "$DESTINO/$NOM" | cut -d' ' -f1)" = "$MD5R" ]; then
    echo "= $NOM ya está (md5 ok)"; continue
  fi
  echo "↓ $NOM"
  scp -q "$IANGPU:$ORIGEN/$NOM" "$DESTINO/$NOM"
  if [ -n "$MD5R" ]; then
    LOC=$(md5sum "$DESTINO/$NOM" | cut -d' ' -f1)
    [ "$LOC" = "$MD5R" ] && echo "  ✓ verificado ($MD5R)" || { echo "  ✗ MD5 NO COINCIDE — copia corrupta"; exit 1; }
  fi
  TRAIDOS=$((TRAIDOS+1))
done
echo "✓ $TRAIDOS traído(s) a $DESTINO"
