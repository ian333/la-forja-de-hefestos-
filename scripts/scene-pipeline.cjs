#!/usr/bin/env node
/**
 * scene-pipeline.cjs — orquesta el ciclo completo de una escena.
 *
 * Pasos (cada uno con cronómetro):
 *   [ 1/5 ] Validar JSON contra schema básico
 *   [ 2/5 ] Audit contra MASTERCLASS_RULES.md (regla de negocio)
 *   [ 3/5 ] Generar audio MP3 con ElevenLabs (skip si ya existe)
 *   [ 4/5 ] Medir duración del audio con ffprobe
 *   [ 5/5 ] Reporte final
 *
 * Uso:
 *   node scripts/scene-pipeline.cjs <script.json> [out_dir]
 *
 *   out_dir default: public/audio/<script.id>/
 *
 * Flags:
 *   --skip-audio    no regenera el audio
 *   --skip-audit    no corre el auditor
 *   --quiet         menos verbose
 *
 * Exit code: 0 si pasa, 1 si falla algún paso obligatorio.
 *
 * Requiere ELEVEN_KEY en env. Para el screenshot test (cuando se agregue):
 * el dev server debe estar corriendo en :5183.
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const GRAY = '\x1b[90m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

// ─── Parse args ──────────────────────────────────────────────
const args = process.argv.slice(2);
let scriptPath = null;
let outDir = null;
let skipAudio = false;
let skipAudit = false;
let quiet = false;

for (const arg of args) {
  if (arg === '--skip-audio') skipAudio = true;
  else if (arg === '--skip-audit') skipAudit = true;
  else if (arg === '--quiet') quiet = true;
  else if (!scriptPath) scriptPath = arg;
  else if (!outDir) outDir = arg;
}

if (!scriptPath) {
  console.log('Uso: node scripts/scene-pipeline.cjs <script.json> [out_dir] [--skip-audio] [--skip-audit] [--quiet]');
  process.exit(2);
}

if (!fs.existsSync(scriptPath)) {
  console.error(RED + 'No existe: ' + scriptPath + RESET);
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────
const stageTimers = [];
function stage(num, total, name) {
  const line = '─'.repeat(58);
  console.log('\n' + CYAN + line + RESET);
  console.log(BOLD + CYAN + '[' + num + '/' + total + ']' + RESET + ' ' + BOLD + name + RESET);
  console.log(CYAN + line + RESET);
  return { name, start: Date.now() };
}
function endStage(timer) {
  const elapsed = Math.round((Date.now() - timer.start) / 100) / 10;
  stageTimers.push({ name: timer.name, elapsed });
  console.log(GRAY + '    ⏱  ' + elapsed + 's' + RESET);
}

function ok(msg) { console.log('  ' + GREEN + '✓' + RESET + ' ' + msg); }
function warn(msg) { console.log('  ' + YELLOW + '⚠' + RESET + ' ' + msg); }
function fail(msg) { console.log('  ' + RED + '✗' + RESET + ' ' + msg); }
function info(msg) { if (!quiet) console.log('  ' + GRAY + '·' + RESET + ' ' + msg); }

// ─── Load script ─────────────────────────────────────────────
let script;
try {
  script = JSON.parse(fs.readFileSync(scriptPath, 'utf8'));
} catch (e) {
  console.error(RED + 'JSON inválido: ' + e.message + RESET);
  process.exit(1);
}

const scriptId = script.id || path.basename(scriptPath, '.json');
const resolvedOutDir = outDir || path.join('public', 'audio', scriptId);

console.log('\n' + BOLD + 'scene-pipeline' + RESET);
console.log(GRAY + '  script: ' + scriptPath + RESET);
console.log(GRAY + '  out:    ' + resolvedOutDir + RESET);
console.log(GRAY + '  title:  ' + (script.title || '(sin título)') + RESET);

const totalStages = 5;
const failures = [];

// ─── [1/5] Validate schema ──────────────────────────────────
{
  const t = stage(1, totalStages, 'Validar JSON');
  let allScenes = [];
  if (script.scenes) allScenes = script.scenes;
  else if (script.chapters) allScenes = script.chapters.flatMap(ch => ch.scenes || []);

  if (allScenes.length === 0) {
    fail('No hay escenas (ni scenes[] ni chapters[].scenes[])');
    failures.push('schema');
  } else {
    ok(allScenes.length + ' escena(s) encontradas');
  }

  if (!script.voice_id) { warn('Falta voice_id'); }
  else if (script.voice_id !== 'XrExE9yKIg1WjnnlVkGX') { warn('voice_id no canónico (esperado Matilda)'); }
  else { ok('voice_id Matilda canónico'); }

  if (!script.model_id) { warn('Falta model_id'); }
  else if (script.model_id === 'eleven_v3') { ok('modelo eleven_v3 (flagship feb-2026)'); }
  else { info('modelo: ' + script.model_id + ' (flagship es eleven_v3)'); }

  endStage(t);
}

// ─── [2/5] Audit contra reglas ──────────────────────────────
if (!skipAudit) {
  const t = stage(2, totalStages, 'Audit contra MASTERCLASS_RULES');
  const auditorPath = path.join(__dirname, 'audit-scene.cjs');
  const result = spawnSync('node', [auditorPath, scriptPath], { stdio: 'inherit' });
  if (result.status !== 0) {
    failures.push('audit');
  }
  endStage(t);
} else {
  info('[skip] audit (--skip-audit)');
}

// ─── [3/5] Generar audio ────────────────────────────────────
if (!skipAudio) {
  const t = stage(3, totalStages, 'Generar audio con ElevenLabs');

  if (!process.env.ELEVEN_KEY) {
    // Try to load from Orkesta .env
    const orkestaEnv = '/home/ian/Orkesta/Orkesta/.env';
    if (fs.existsSync(orkestaEnv)) {
      const envContent = fs.readFileSync(orkestaEnv, 'utf8');
      const match = envContent.match(/^ELEVEN_LABS=(.+)$/m);
      if (match) {
        process.env.ELEVEN_KEY = match[1].trim();
        info('ELEVEN_KEY cargado desde ' + orkestaEnv);
      }
    }
  }

  if (!process.env.ELEVEN_KEY) {
    fail('ELEVEN_KEY no está seteado. Export o agrega a Orkesta/.env');
    failures.push('audio');
  } else {
    fs.mkdirSync(resolvedOutDir, { recursive: true });
    const generatorPath = path.join(__dirname, 'voice-gaia', 'generate.cjs');
    const result = spawnSync('node', [generatorPath, scriptPath, resolvedOutDir], {
      stdio: 'inherit',
      env: process.env,
    });
    if (result.status !== 0) {
      fail('generate.cjs falló');
      failures.push('audio');
    } else {
      ok('audio generado en ' + resolvedOutDir);
    }
  }
  endStage(t);
} else {
  info('[skip] audio (--skip-audio)');
}

// ─── [4/5] Medir duración ───────────────────────────────────
{
  const t = stage(4, totalStages, 'Medir duración del audio');
  if (!fs.existsSync(resolvedOutDir)) {
    warn('out_dir no existe — saltando medición');
  } else {
    const mp3s = fs.readdirSync(resolvedOutDir).filter(f => f.endsWith('.mp3')).sort();
    if (mp3s.length === 0) {
      warn('No hay MP3s en ' + resolvedOutDir);
    } else {
      let totalSec = 0;
      const tracks = [];
      for (const mp3 of mp3s) {
        const full = path.join(resolvedOutDir, mp3);
        try {
          const out = execSync('ffprobe -v error -show_entries format=duration -of csv=p=0 ' + full, { encoding: 'utf8' });
          const dur = parseFloat(out.trim());
          totalSec += dur;
          tracks.push({ file: mp3, duration_sec: parseFloat(dur.toFixed(3)) });
          info(mp3 + ' — ' + dur.toFixed(2) + 's');
        } catch (e) {
          warn(mp3 + ' — no se pudo medir (ffprobe disponible?)');
        }
      }
      // ── Auto-write meta.json (las escenas pueden leer esto en runtime,
      //     eliminando la necesidad de hardcodear AUDIO_DURATION en cada
      //     componente TSX)
      if (tracks.length > 0) {
        const metaPath = path.join(resolvedOutDir, 'meta.json');
        const meta = {
          generated_at: new Date().toISOString(),
          script: path.basename(scriptPath),
          script_id: script.id || null,
          total_duration_sec: parseFloat(totalSec.toFixed(3)),
          model_id: script.model_id || null,
          voice_id: script.voice_id || null,
          tracks,
        };
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
        ok('meta.json escrito en ' + metaPath);
      }
      if (totalSec > 0) {
        const min = Math.floor(totalSec / 60);
        const sec = Math.round(totalSec - min * 60);
        ok('total: ' + min + 'min ' + sec + 's (' + totalSec.toFixed(1) + 's)');

        if (script.total_duration_target_sec) {
          const target = script.total_duration_target_sec;
          const drift = Math.abs(totalSec - target) / target;
          if (drift > 0.20) {
            warn('drift vs target: ' + (drift * 100).toFixed(0) + '% (target ' + target + 's, real ' + totalSec.toFixed(0) + 's)');
          } else {
            ok('drift vs target: ' + (drift * 100).toFixed(0) + '% (dentro de ±20%)');
          }
        }
      }
    }
  }
  endStage(t);
}

// ─── [5/5] Reporte final ────────────────────────────────────
{
  const t = stage(5, totalStages, 'Reporte');
  console.log('\n  ' + BOLD + 'Tiempos por etapa:' + RESET);
  for (const s of stageTimers) {
    const bar = '█'.repeat(Math.min(40, Math.round(s.elapsed / 2)));
    console.log('    ' + GRAY + s.name.padEnd(40) + ' ' + s.elapsed + 's ' + bar + RESET);
  }
  const total = stageTimers.reduce((a, b) => a + b.elapsed, 0);
  console.log('\n  ' + BOLD + 'Total: ' + total.toFixed(1) + 's' + RESET);

  if (failures.length > 0) {
    console.log('\n' + RED + BOLD + '  ✗ FAIL — ' + failures.length + ' etapa(s) con fallos: ' + failures.join(', ') + RESET);
    process.exit(1);
  } else {
    console.log('\n' + GREEN + BOLD + '  ✓ OK' + RESET);
  }
}
