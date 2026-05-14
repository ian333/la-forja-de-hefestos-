#!/usr/bin/env node
/**
 * Genera manifest.json desde un script sin necesitar la API de ElevenLabs.
 * Estima duración por longitud de texto (~14 caracteres/segundo en español
 * — promedio Matilda en pruebas anteriores) y la guarda como `durationSec`
 * para que el Player auto-avance aun sin MP3.
 *
 *   node manifest-from-script.cjs <script.json> <out_dir>
 */

const fs = require('fs');
const path = require('path');

const [scriptPath, outDir] = process.argv.slice(2);
if (!scriptPath || !outDir) {
  console.error('usage: node manifest-from-script.cjs <script.json> <out_dir>');
  process.exit(1);
}

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

const CHARS_PER_SEC = 14;   // español Matilda

const manifest = {
  id: script.id,
  title: script.title,
  voice: script.voice_name,
  scenes: script.scenes.map(s => ({
    id: s.id,
    scene: s.scene,
    audio: `${s.id}.mp3`,
    durationSec: Math.max(7, Math.ceil(s.text.length / CHARS_PER_SEC)),
    text: s.text,
    ...(s.board ? { board: s.board } : {}),
  })),
};

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${path.join(outDir, 'manifest.json')} (${manifest.scenes.length} scenes)`);
console.log(`Total estimated duration: ${manifest.scenes.reduce((s,x) => s + x.durationSec, 0)} sec`);
