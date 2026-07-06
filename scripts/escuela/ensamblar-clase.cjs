/**
 * ESCUELA — ensambla la clase final: webm grabado + WAVs de narración → MP4 4K.
 * Cada WAV se clava en el timestamp REAL de su paso (meta.json de clase-drive).
 * Master 4K 3840×2160 HEVC 10-bit NVENC (MANDATO 4K; correr en iangpu).
 *
 *   node scripts/escuela/ensamblar-clase.cjs <outDirDeClaseDrive> <narracionDir> <final.mp4>
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = process.argv[2];
const NARR = process.argv[3];
const FINAL = process.argv[4] || path.join(DIR, 'clase-4k.mp4');
const meta = JSON.parse(fs.readFileSync(`${DIR}/meta.json`, 'utf8'));
if (!meta.video) { console.error('meta.json sin video'); process.exit(1); }

// Corte: la carga de página (antes de la tarjeta de título) es tiempo muerto.
const cutMs = Math.max(0, (meta.leadMs || 0) - 300);
const wavs = [], delays = [];
meta.pasos.forEach((p, i) => {
  const wav = path.join(NARR, `${meta.id}_l${String(i + 1).padStart(2, '0')}.wav`);
  if (fs.existsSync(wav)) { wavs.push(wav); delays.push(Math.max(0, p.marker - cutMs)); }
  else console.warn(`  (sin wav para ${p.id})`);
});
if (!wavs.length) { console.error('cero WAVs — genera la narración primero'); process.exit(1); }

const inputs = ['-i', `"${meta.video}"`, ...wavs.map((w) => `-i "${w}"`)].join(' ');
const aChains = wavs.map((w, k) => `[${k + 1}:a]adelay=${delays[k]}|${delays[k]}[a${k}]`).join(';');
const amix = wavs.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${wavs.length}:normalize=0:duration=longest,aresample=48000,alimiter=limit=0.95[aout]`;
const vf = `[0:v]trim=start=${(cutMs / 1000).toFixed(3)},setpts=PTS-STARTPTS,fps=30,scale=3840:2160:flags=lanczos,format=yuv420p10le,fade=t=in:d=0.5[vout]`;

const cmd = `ffmpeg -y -v error ${inputs} -filter_complex "${vf};${aChains};${amix}" ` +
  `-map "[vout]" -map "[aout]" -c:v hevc_nvenc -preset p5 -rc vbr -cq 19 -profile:v main10 ` +
  `-c:a aac -b:a 192k -movflags +faststart "${FINAL}"`;
console.log('ensamblando →', FINAL);
execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
const dur = execSync(`ffprobe -v error -show_entries format=duration -of default=nk=1:nw=1 "${FINAL}"`).toString().trim();
console.log(`LISTO ${FINAL}  (${parseFloat(dur).toFixed(1)}s)`);
