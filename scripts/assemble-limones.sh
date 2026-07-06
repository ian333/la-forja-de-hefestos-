#!/bin/bash
# assemble-limones.sh — mezcla la narración (7 beats) sobre el video del mercado
# de limones. Cada mp3 entra en su beat (offsets del script JSON).
#   ./scripts/assemble-limones.sh <video_in> <audio_dir> <out>
set -e
VID="${1:-dist-video/.peek/clip-limones-full.mp4}"
AUD="${2:-dist-audio/cinematic-limones}"
OUT="${3:-dist-video/limones-preview.mp4}"

# offsets en ms — TIMELINE v2 (88s, ver CinematicLimones.tsx):
#   b1@1.5  b2@10.0  b3@22.0  b4@33.0  b5@44.0  b6@54.5  b7@68.0
ffmpeg -y -i "$VID" \
  -i "$AUD/b1-nebulosa.mp3" -i "$AUD/b2-luces.mp3" -i "$AUD/b3-ciego.mp3" \
  -i "$AUD/b4-oleada.mp3" -i "$AUD/b5-cascada.mp3" -i "$AUD/b6-muerte.mp3" \
  -i "$AUD/b7-coda.mp3" \
  -filter_complex "\
[1:a]adelay=1500|1500[a1];\
[2:a]adelay=10000|10000[a2];\
[3:a]adelay=22000|22000[a3];\
[4:a]adelay=33000|33000[a4];\
[5:a]adelay=44000|44000[a5];\
[6:a]adelay=54500|54500[a6];\
[7:a]adelay=68000|68000[a7];\
[a1][a2][a3][a4][a5][a6][a7]amix=inputs=7:normalize=0,apad[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac -b:a 192k -shortest "$OUT"
echo "✓ $OUT"
