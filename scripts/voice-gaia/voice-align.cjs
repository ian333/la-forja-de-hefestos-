#!/usr/bin/env node
/**
 * voice-align.cjs — alinea las líneas de una masterclass a sus palabras y produce
 * timestamps GLOBALES (en el timeline de la clase concatenada) por palabra.
 *
 * Usa /v1/forced-alignment de ElevenLabs (mp3 + texto → tiempos por palabra; NO
 * gasta cuota TTS). Reproduce el mismo timeline que la narración concatenada:
 * LEAD 0.45 + cada línea + GAP 0.60. Así la palabra-ancla aparece EXACTO cuando
 * Matilda la dice. Determinista → cacheable en el render.
 *
 *   ELEVEN_KEY=sk_... node scripts/voice-gaia/voice-align.cjs <script.json> <audio_dir>
 *   → escribe <audio_dir>/words.json  { dur, words:[{w, t, end}] }
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const KEY = process.env.ELEVEN_KEY;
if (!KEY) { console.error('Missing ELEVEN_KEY'); process.exit(1); }
const [scriptPath, audioDir] = process.argv.slice(2);
if (!scriptPath || !audioDir) { console.error('uso: voice-align.cjs <script.json> <audio_dir>'); process.exit(1); }

const LEAD = 0.45, GAP = 0.60;
const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
const dur = f => parseFloat(execSync(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${f}"`).toString().trim());

function alignOne(mp3Path, text) {
  return new Promise((resolve, reject) => {
    const boundary = '----align' + Math.floor(performance.now() * 1000).toString(36);
    const mp3 = fs.readFileSync(mp3Path);
    const parts = [];
    const push = s => parts.push(Buffer.from(s, 'utf8'));
    push(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`);
    parts.push(mp3);
    push(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\n`);
    push(text);
    push(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat(parts);
    const req = https.request({
      hostname: 'api.elevenlabs.io', path: '/v1/forced-alignment', method: 'POST',
      headers: { 'xi-api-key': KEY, 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length },
    }, res => {
      const chunks = []; res.on('data', d => chunks.push(d));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 200)}`));
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      });
    });
    req.on('error', reject); req.write(body); req.end();
  });
}

(async () => {
  const globalWords = [];
  let t = LEAD;
  for (const scene of script.scenes) {
    const mp3 = path.join(audioDir, `${scene.id}.mp3`);
    if (!fs.existsSync(mp3)) { console.log(`[skip] ${scene.id} (sin mp3)`); continue; }
    const d = dur(mp3);
    process.stdout.write(`[align] ${scene.id} @${t.toFixed(1)}s ... `);
    try {
      const res = await alignOne(mp3, scene.text);
      const words = (res.words || []).filter(w => w.text.trim());
      for (const w of words) globalWords.push({ w: w.text.trim(), t: +(t + w.start).toFixed(2), end: +(t + w.end).toFixed(2) });
      console.log(`${words.length} palabras OK`);
    } catch (e) { console.log(`FAIL ${e.message}`); }
    t += d + GAP;
    await new Promise(r => setTimeout(r, 120));
  }
  const out = path.join(audioDir, 'words.json');
  fs.writeFileSync(out, JSON.stringify({ dur: +(t - GAP).toFixed(2), words: globalWords }));
  console.log(`\n✓ ${out} — ${globalWords.length} palabras, ${(t - GAP).toFixed(1)}s`);
})();
