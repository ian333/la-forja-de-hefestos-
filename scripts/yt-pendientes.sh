#!/bin/bash
# yt-pendientes.sh — deja YouTube al día con los manifiestos, corra cuando corra.
#
#   bash scripts/yt-pendientes.sh            # los 4 pasos, en orden
#   bash scripts/yt-pendientes.sh --serie    # sólo los tutoriales (subir-lote de la serie)
#
# POR QUÉ existe (2026-09-08): dejamos crons a las 02:30/02:50/03:10/03:20 para aprovechar el
# reinicio de cuota de YouTube (01:00 CST) y NINGUNO corrió — la WSL de iangpu estaba apagada;
# `cron` arrancó a las 08:13 con la máquina. Una hora fija en una máquina que duerme no es una
# hora: es una lotería. Esto corre CADA HORA y no hace daño si no hay nada pendiente (los cuatro
# scripts son idempotentes; sin pendientes gasta ~4 unidades de cuota en puras lecturas).
#
# Los cuatro pasos, todos idempotentes:
#   1. subir-lote.sh        — sube los que tienen master y aún no están en YouTube
#   2. captions-pendientes  — sube los subtítulos que faltaron (la cuota se agota antes que las subidas)
#   3. reprogramar-yt       — alinea publishAt con `publicar.programar` del manifiesto
#   4. playlist-tutoriales  — mete todo en la playlist del canal
set -u
cd "$(dirname "$0")/.."
PY=/home/ian/pub-venv/bin/python
# str(): 26-28 tenían `n` numérico y el join tronaba en silencio → el fallback fijo era el que corría (2026-09-10)
SERIE=$(python3 -c "import json;print(' '.join(str(e['n']).zfill(2) for e in json.load(open('/home/ian/Orkesta/scripts/videotutoriales/serie.json'))))" 2>/dev/null || echo "05 07 10 11 12 13 14 15 19 20 21 22 23 24 25 26 27 28 29")

echo "════ $(date '+%F %H:%M') yt-pendientes"
bash scripts/subir-lote.sh $SERIE
$PY scripts/captions-pendientes.py
$PY scripts/reprogramar-yt.py
$PY scripts/playlist-tutoriales.py
echo "════ fin $(date '+%H:%M')"
