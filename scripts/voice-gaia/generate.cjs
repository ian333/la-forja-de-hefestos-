#!/usr/bin/env node
/**
 * Genera audio MP3 para cada escena de un script Masterclass usando ElevenLabs.
 * Omite escenas que ya tienen su archivo en disco (re-runs baratos).
 *
 *   ELEVEN_KEY=sk_... node scripts/voice-gaia/generate.cjs <script.json> <out_dir>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.ELEVEN_KEY;
if (!KEY) { console.error('Missing ELEVEN_KEY env'); process.exit(1); }

const [scriptPath, outDir] = process.argv.slice(2);
if (!scriptPath || !outDir) {
  console.error('usage: ELEVEN_KEY=... node generate.cjs <script.json> <out_dir>');
  process.exit(1);
}

const script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
fs.mkdirSync(outDir, { recursive: true });

function postTTS(text, voiceId, modelId, voiceSettings) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: voiceSettings,
    });
    const req = https.request({
      hostname: 'api.elevenlabs.io',
      path: `/v1/text-to-speech/${voiceId}`,
      method: 'POST',
      headers: {
        'xi-api-key': KEY,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${Buffer.concat(chunks).toString('utf8').slice(0, 300)}`));
          return;
        }
        resolve(Buffer.concat(chunks));
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  let totalChars = 0;
  let generated = 0;
  let skipped = 0;
  const manifest = {
    id: script.id,
    title: script.title,
    voice: script.voice_name,
    scenes: [],
  };

  for (const scene of script.scenes) {
    const fileName = `${scene.id}.mp3`;
    const filePath = path.join(outDir, fileName);
    manifest.scenes.push({
      id: scene.id,
      scene: scene.scene,
      audio: fileName,
      text: scene.text,
      ...(scene.board ? { board: scene.board } : {}),
    });

    if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
      skipped++;
      console.log(`[skip] ${scene.id} (already ${fs.statSync(filePath).size} bytes)`);
      continue;
    }

    process.stdout.write(`[gen ] ${scene.id} (${scene.text.length} chars)... `);
    try {
      const mp3 = await postTTS(
        scene.text,
        script.voice_id,
        script.model_id,
        script.voice_settings,
      );
      fs.writeFileSync(filePath, mp3);
      console.log(`${mp3.length} bytes OK`);
      generated++;
      totalChars += scene.text.length;
      // small spacing
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`FAIL: ${e.message}`);
      process.exit(2);
    }
  }

  // Write manifest
  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  );

  console.log('\n──────────────────────────────────────');
  console.log(`script:    ${script.title}`);
  console.log(`generated: ${generated} scenes (${totalChars} chars)`);
  console.log(`skipped:   ${skipped} (already on disk)`);
  console.log(`out:       ${outDir}`);
})();
