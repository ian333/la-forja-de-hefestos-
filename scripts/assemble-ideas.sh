#!/bin/bash
# assemble-ideas.sh — "Cómo crecer sin dinero" (Romer): mezcla las 8 líneas
# CURADAS de la clase ya grabada (public/audio/clase-romer/) sobre el render.
# Timeline (CinematicIdeas.tsx): r05@2.0 r09@12.5 r10@22.5 r12@33 r13@43.5
#                                 r14@51.5 r17@61.5 r25@71
set -e
VID="${1:-dist-video/.peek/clip-ideas-full.mp4}"
AUD="${2:-public/audio/clase-romer}"
OUT="${3:-dist-video/ideas-preview.mp4}"

ffmpeg -y -i "$VID" \
  -i "$AUD/romer-05.mp3" -i "$AUD/romer-09.mp3" -i "$AUD/romer-10.mp3" \
  -i "$AUD/romer-12.mp3" -i "$AUD/romer-13.mp3" -i "$AUD/romer-14.mp3" \
  -i "$AUD/romer-17.mp3" -i "$AUD/romer-25.mp3" \
  -filter_complex "\
[1:a]adelay=2000|2000[a1];\
[2:a]adelay=12500|12500[a2];\
[3:a]adelay=22500|22500[a3];\
[4:a]adelay=33000|33000[a4];\
[5:a]adelay=43500|43500[a5];\
[6:a]adelay=51500|51500[a6];\
[7:a]adelay=61500|61500[a7];\
[8:a]adelay=71000|71000[a8];\
[a1][a2][a3][a4][a5][a6][a7][a8]amix=inputs=8:normalize=0,apad[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "$OUT"
echo "✓ $OUT"
