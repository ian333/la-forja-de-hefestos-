#!/usr/bin/env node
/**
 * Forced alignment de los 118 audios de la tabla periódica → subtitles.json
 *
 * Usa el endpoint /v1/forced-alignment de ElevenLabs: toma el MP3 ya generado
 * + su texto y devuelve timestamps por palabra. NO consume cuota de TTS.
 *
 * Produce subtitles.json: { [Z]: { dur, cues: [{ t, text }] } }
 * donde cada cue es una ORACIÓN con su tiempo de inicio (para subtítulos
 * estilo karaoke por frase, legibles en pantalla).
 *
 *   ELEVEN_KEY=sk_... node scripts/voice-gaia/align-tabla.cjs
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.ELEVEN_KEY;
if (!KEY) { console.error('Missing ELEVEN_KEY env'); process.exit(1); }

const AUDIO_DIR = path.join(__dirname, '../../dist-audio/tabla-periodica');
const manifest = JSON.parse(fs.readFileSync(path.join(AUDIO_DIR, 'manifest.json'), 'utf8'));

function alignOne(mp3Path, text) {
  return new Promise((resolve, reject) => {
    const boundary = '----align' + Math.floor(performance.now() * 1000).toString(36);
    const mp3 = fs.readFileSync(mp3Path);
    const parts = [];
    const push = (s) => parts.push(Buffer.from(s, 'utf8'));
    push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`);
    parts.push(mp3);
    push(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n`);
    push(text);
    push(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat(parts);
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: '/v1/forced-alignment',
      method: 'POST',
      headers: {
        'xi-api-key': KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
      },
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`));
          return;
        }
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Parte el texto en oraciones (corte tras . ! ? :) y asigna a cada oración
// el timestamp de inicio de su primera palabra-con-contenido.
function buildCues(text, words) {
  // índice de carácter → start time, recorriendo las words alineadas
  const wordStarts = []; // { ci, t } para el inicio de cada palabra no vacía
  let ci = 0;
  for (const w of words) {
    const wt = w.text;
    const isSpace = wt.trim() === '';
    if (!isSpace) wordStarts.push({ ci, t: w.start });
    ci += wt.length;
  }
  // segmentar el texto original en oraciones
  const cues = [];
  const re = /[^.!?:]+[.!?:]+(?:\s|$)|[^.!?:]+$/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const seg = m[0];
    const segStart = m.index;
    const trimmed = seg.trim();
    if (!trimmed) continue;
    // primera palabra con contenido en o tras segStart
    const firstContentOffset = seg.length - seg.trimStart().length;
    const targetCi = segStart + firstContentOffset;
    let t = 0;
    for (const ws of wordStarts) { if (ws.ci >= targetCi) { t = ws.t; break; } t = ws.t; }
    // si es el primer segmento, arrancar en 0 para no cortar el inicio
    cues.push({ t: cues.length === 0 ? 0 : +t.toFixed(2), text: trimmed });
  }
  return cues;
}

(async () => {
  const outPath0 = path.join(AUDIO_DIR, 'subtitles.json');
  const out = fs.existsSync(outPath0) ? JSON.parse(fs.readFileSync(outPath0, 'utf8')) : {};
  let done = 0, failed = 0, skipped = 0;
  for (const scene of manifest.scenes) {
    const Z = scene.Z;
    if (out[Z] && out[Z].cues && out[Z].cues.length) { skipped++; continue; }
    const mp3Path = path.join(AUDIO_DIR, scene.audio);
    process.stdout.write(`[align] Z=${String(Z).padStart(3)} ${scene.scene.padEnd(3)} ... `);
    try {
      const res = await alignOne(mp3Path, scene.text);
      const words = res.words || [];
      const dur = words.length ? +words[words.length - 1].end.toFixed(2) : 0;
      const cues = buildCues(scene.text, words);
      out[Z] = { dur, cues };
      fs.writeFileSync(outPath0, JSON.stringify(out)); // guardado incremental
      console.log(`${cues.length} frases, ${dur}s OK`);
      done++;
      await new Promise(r => setTimeout(r, 150));
    } catch (e) {
      console.log(`FAIL: ${e.message}`);
      failed++;
    }
  }
  fs.writeFileSync(outPath0, JSON.stringify(out));
  console.log(`\n──────────────────────────────────────`);
  console.log(`alineados ahora: ${done} · ya estaban: ${skipped} · fallidos: ${failed}`);
  console.log(`total en archivo: ${Object.keys(out).length}/118`);
  console.log(`out: ${outPath0} (${(fs.statSync(outPath0).size / 1024).toFixed(1)} KB)`);
})();
