/**
 * Shared utilities for the GAIA video pipeline.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// FIX 2026-05-21: GPU disponible en WSL2 vía D3D12 (--use-angle=gl en Chrome).
// Captura nativa 4K @ 60fps. Para vertical mobile (9:16): WIDTH=2160 HEIGHT=3840.
// Para horizontal cinema (16:9): WIDTH=3840 HEIGHT=2160.
// Default: vertical mobile (Nobel series target Instagram/TikTok).
const FPS = parseInt(process.env.VIDEO_FPS || '60', 10);
const WIDTH = parseInt(process.env.VIDEO_WIDTH || '2160', 10);
const HEIGHT = parseInt(process.env.VIDEO_HEIGHT || '3840', 10);
const OUTPUT_WIDTH = WIDTH;
const OUTPUT_HEIGHT = HEIGHT;

// Pre-rendered GAIA brand outro (1080p · 30fps · 7s · video-only).
// Reemplaza el bumper HTML — entra como clip final, se escala a 4K en ffmpeg.
const OUTRO_VIDEO = '/home/ian/Orkesta/Orkesta/marketing/gaia-reveal/output/gaia-v6_16x9_1080p.mp4';
const OUTRO_VIDEO_SEC = 7;
const INTRO_SEC = 3;
const OUTRO_SEC = 7;  // Duration of the pre-rendered GAIA outro video

const ROOT = path.resolve(__dirname, '..', '..');
const AUDIO_ROOT = path.join(ROOT, 'public', 'audio', 'masterclass');
const TMP_ROOT = path.join(ROOT, 'dist-video', '.tmp');
const OUT_ROOT = path.join(ROOT, 'dist-video');

function mustExist(p, hint) {
  if (!fs.existsSync(p)) {
    throw new Error(`missing ${hint ?? 'file'}: ${p}`);
  }
}

function readManifest(classId) {
  const mp = path.join(AUDIO_ROOT, classId, 'manifest.json');
  mustExist(mp, `manifest for ${classId}`);
  return JSON.parse(fs.readFileSync(mp, 'utf8'));
}

function listClasses() {
  return fs.readdirSync(AUDIO_ROOT)
    .filter(d => {
      const p = path.join(AUDIO_ROOT, d, 'manifest.json');
      return fs.existsSync(p);
    })
    .sort();
}

function probeAudioDuration(mp3Path) {
  if (!fs.existsSync(mp3Path)) return null;
  const out = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${mp3Path}"`,
    { encoding: 'utf8' }
  ).trim();
  const v = parseFloat(out);
  return Number.isFinite(v) ? v : null;
}

/**
 * Reads each scene's MP3 duration from disk.
 * Returns array of {id, audio, durationSec, mp3Path}.
 * Falls back to manifest.durationSec when MP3 missing.
 */
function sceneDurations(classId, manifest) {
  const dir = path.join(AUDIO_ROOT, classId);
  return manifest.scenes.map(s => {
    const mp3 = path.join(dir, s.audio);
    const dur = probeAudioDuration(mp3) ?? s.durationSec ?? 12;
    return { id: s.id, scene: s.scene, audio: s.audio, text: s.text, durationSec: dur, mp3Path: mp3 };
  });
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function nukeDir(p) {
  if (!fs.existsSync(p)) return;
  fs.rmSync(p, { recursive: true, force: true });
}

function tmpDirFor(classId, clip) {
  return path.join(TMP_ROOT, classId, clip);
}

function outDirFor(classId) {
  return path.join(OUT_ROOT, classId);
}

function pad(n, w = 6) { return String(n).padStart(w, '0'); }

module.exports = {
  FPS, WIDTH, HEIGHT, OUTPUT_WIDTH, OUTPUT_HEIGHT, INTRO_SEC, OUTRO_SEC,
  OUTRO_VIDEO, OUTRO_VIDEO_SEC,
  ROOT, AUDIO_ROOT, TMP_ROOT, OUT_ROOT,
  readManifest, listClasses, probeAudioDuration, sceneDurations,
  ensureDir, nukeDir, tmpDirFor, outDirFor, pad, mustExist,
};
