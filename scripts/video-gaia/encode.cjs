#!/usr/bin/env node
/**
 * GAIA video pipeline — ffmpeg encode + mux.
 *
 * Lee dist-video/.tmp/<classId>/capture.json y los PNG sequences,
 * produce dist-video/<classId>/{video.mp4,subs.vtt,thumbnail.png,metadata.txt}.
 *
 * Uso:
 *    node scripts/video-gaia/encode.cjs <classId> [--fps 60]
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const {
  FPS, WIDTH, HEIGHT, OUTPUT_WIDTH, OUTPUT_HEIGHT, INTRO_SEC, OUTRO_SEC,
  OUTRO_VIDEO, OUTRO_VIDEO_SEC,
  AUDIO_ROOT, readManifest, tmpDirFor, outDirFor, ensureDir,
} = require('./lib.cjs');

function parseArgs() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0].startsWith('-')) {
    console.error('usage: node encode.cjs <classId> [--fps 60]');
    process.exit(2);
  }
  const out = { classId: args[0], fps: FPS };
  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--fps') out.fps = parseInt(args[++i], 10);
  }
  return out;
}

function run(cmd, args, opts = {}) {
  console.log(`  $ ${cmd} ${args.map(a => /\s/.test(a) ? `"${a}"` : a).join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed: exit ${r.status}`);
}

/* ─── encode one clip of PNGs → silent .mp4 ─────────────────────────────── */
function encodeClip({ pngDir, durationSec, frameCount, outFile, fps }) {
  if (frameCount === 0) throw new Error(`no frames in ${pngDir}`);
  // input framerate so the clip lasts exactly `durationSec`
  const inputFps = (frameCount / durationSec).toFixed(4);
  // preset=veryfast + threads=2 + crf=20 keeps RAM under 1GB en WSL constrained
  run('ffmpeg', [
    '-y',
    '-threads', '2',
    '-framerate', inputFps,
    '-i', path.join(pngDir, '%06d.png'),
    '-vf', `fps=${fps},scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:flags=bicubic,format=yuv420p`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-x264-params', 'rc-lookahead=10:threads=2',
    '-movflags', '+faststart',
    '-an',
    outFile,
  ]);
}

/* ─── concat list helper ──────────────────────────────────────────────────── */
function writeConcatList(files, outPath) {
  const body = files.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n';
  fs.writeFileSync(outPath, body);
}

/* ─── format vtt timestamp (HH:MM:SS.mmm) ─────────────────────────────────── */
function vttTs(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
}

/* ─── build .vtt from manifest + actual scene durations ───────────────────── */
function buildVtt(manifest, sceneDurs, outPath) {
  let t = INTRO_SEC;       // subs start AFTER intro
  let body = 'WEBVTT\n\n';
  manifest.scenes.forEach((sc, i) => {
    const dur = sceneDurs[i];
    const start = t;
    const end = t + dur;
    // VTT cues: each scene is one block. Split into lines so reading is comfortable.
    const text = sc.text.replace(/\s+/g, ' ').trim();
    body += `${i + 1}\n${vttTs(start)} --> ${vttTs(end)}\n${text}\n\n`;
    t = end;
  });
  fs.writeFileSync(outPath, body);
}

/* ─── build SRT mirror of vtt (some platforms prefer srt) ─────────────────── */
function srtTs(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ms = Math.floor((s % 1) * 1000);
  const ss = Math.floor(s);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}
function buildSrt(manifest, sceneDurs, outPath) {
  let t = INTRO_SEC;
  let body = '';
  manifest.scenes.forEach((sc, i) => {
    const dur = sceneDurs[i];
    const text = sc.text.replace(/\s+/g, ' ').trim();
    body += `${i + 1}\n${srtTs(t)} --> ${srtTs(t + dur)}\n${text}\n\n`;
    t += dur;
  });
  fs.writeFileSync(outPath, body);
}

/* ─── youtube metadata.txt ────────────────────────────────────────────────── */
function buildMetadata(classId, manifest, sceneDurs, outPath) {
  const totalSec = INTRO_SEC + sceneDurs.reduce((a, b) => a + b, 0) + OUTRO_SEC;
  const titleTag = inferPlaylist(classId);
  let body = '';
  body += `# YouTube Studio metadata · ${classId}\n\n`;
  body += `Title:\n${manifest.title}\n\n`;
  body += `Playlist:\n${titleTag}\n\n`;
  body += `Tags:\nGAIA, masterclass, ciencia, ${titleTag.toLowerCase()}, educación, español, narrado\n\n`;
  body += `Description:\n`;
  body += `${manifest.title}\n\n`;
  body += `Una clase de la universidad GAIA. Voz: ${manifest.voice}.\n`;
  body += `Duración: ${formatHMS(totalSec)} · ${manifest.scenes.length} escenas · 4K.\n\n`;
  body += `Capítulos:\n`;
  body += `00:00 — Intro\n`;
  let t = INTRO_SEC;
  manifest.scenes.forEach(sc => {
    const label = sc.id.replace(/^\d+-/, '').replace(/-/g, ' · ');
    body += `${formatHMS(t)} — ${label}\n`;
    const i = manifest.scenes.indexOf(sc);
    t += sceneDurs[i];
  });
  body += `${formatHMS(t)} — Outro\n\n`;
  body += `https://university.gaiaprime.com.mx/masterclass.html?id=${classId}\n`;
  body += `\n— Subtitles: subs.vtt (CC) · subs.srt (alt)\n`;
  fs.writeFileSync(outPath, body);
}

function formatHMS(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function inferPlaylist(classId) {
  if (classId.startsWith('econ-')) return 'Nobel de Economía';
  if (classId.startsWith('phys-')) return 'Nobel de Física';
  if (classId === 'blackhole') return 'Física · Agujeros Negros';
  if (classId.startsWith('calc')) return 'Matemáticas · Cálculo';
  if (classId.startsWith('linalg')) return 'Matemáticas · Álgebra Lineal';
  return 'GAIA · Masterclass';
}

/* ─── main ────────────────────────────────────────────────────────────────── */
async function main() {
  const { classId, fps } = parseArgs();
  const tmp = tmpDirFor(classId, '');
  const reportPath = path.join(tmp, 'capture.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`missing capture report: ${reportPath} — run capture.cjs first`);
  }
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const manifest = readManifest(classId);

  const out = outDirFor(classId);
  ensureDir(out);

  console.log(`\n┌─ encode · ${classId}`);
  console.log(`├─ ${manifest.title}`);
  console.log(`└─ fps target: ${fps}\n`);

  /* 1 — encode intro / main / outro silent video clips */
  const introMp4 = path.join(tmp, 'intro.mp4');
  const mainMp4  = path.join(tmp, 'main.mp4');
  const outroMp4 = path.join(tmp, 'outro.mp4');

  // count PNGs on disk rather than trusting capture.json (more robust if capture
  // crashed before writing the frames array)
  const countPngs = dir => fs.readdirSync(dir).filter(f => f.endsWith('.png')).length;

  if (report.clips.intro) {
    if (fs.existsSync(introMp4) && fs.statSync(introMp4).size > 1000) {
      console.log('● intro video (cached)');
    } else {
      console.log('● intro video');
      encodeClip({
        pngDir: tmpDirFor(classId, '00-intro'),
        durationSec: report.clips.intro.durationSec,
        frameCount: countPngs(tmpDirFor(classId, '00-intro')),
        outFile: introMp4,
        fps,
      });
    }
  }
  if (report.clips.main) {
    if (fs.existsSync(mainMp4) && fs.statSync(mainMp4).size > 1000) {
      console.log('● main video (cached)');
    } else {
      console.log('● main video');
      encodeClip({
        pngDir: tmpDirFor(classId, '01-main'),
        durationSec: report.clips.main.durationSec,
        frameCount: countPngs(tmpDirFor(classId, '01-main')),
        outFile: mainMp4,
        fps,
      });
    }
  }
  // Outro: re-encode the pre-rendered GAIA brand MP4 to match main format
  // (3840×2160, fps target, yuv420p, libx264).
  if (fs.existsSync(outroMp4) && fs.statSync(outroMp4).size > 1000) {
    console.log('● outro video (cached)');
  } else {
    console.log('● outro video (re-encode GAIA v6 brand MP4)');
    if (!fs.existsSync(OUTRO_VIDEO)) {
      throw new Error(`OUTRO_VIDEO not found: ${OUTRO_VIDEO}`);
    }
    run('ffmpeg', ['-y',
      '-threads', '2',
      '-i', OUTRO_VIDEO,
      '-vf', `fps=${fps},scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:flags=bicubic,format=yuv420p`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20',
      '-x264-params', 'rc-lookahead=10:threads=2',
      '-movflags', '+faststart', '-an',
      outroMp4,
    ]);
  }

  /* 2 — concat video clips */
  console.log('● concat video');
  const vList = path.join(tmp, 'video-concat.txt');
  writeConcatList([introMp4, mainMp4, outroMp4], vList);
  const videoOnlyMp4 = path.join(tmp, 'video-only.mp4');
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', vList, '-c', 'copy', videoOnlyMp4]);

  /* 3 — build master audio
   *
   * Las MP3 de ElevenLabs son mono @ 44.1kHz, el silencio que generamos antes
   * era stereo → concat demuxer fallaba. Solución: convertir TODO a WAV PCM
   * stereo 48kHz (formato canónico), concat los WAVs, después AAC al final.
   */
  console.log('● build audio master');
  const sceneDurs = report.clips.main
    ? report.scenes.map(s => s.durationSec)
    : manifest.scenes.map(s => s.durationSec ?? 12);

  const wavDir = path.join(tmp, 'audio-wavs');
  ensureDir(wavDir);
  const normalize = (inputArgs, outFile) => run('ffmpeg', ['-y', ...inputArgs,
    '-ac', '2', '-ar', '48000', '-c:a', 'pcm_s16le', outFile]);

  const introWav = path.join(wavDir, '00-intro-silence.wav');
  normalize(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(INTRO_SEC)], introWav);

  const sceneWavs = [];
  manifest.scenes.forEach((s, i) => {
    const mp3 = path.join(AUDIO_ROOT, classId, s.audio);
    if (!fs.existsSync(mp3)) {
      console.warn(`  ⚠ missing ${s.audio} — emitting ${sceneDurs[i]}s of silence`);
      const w = path.join(wavDir, `${String(i + 1).padStart(2, '0')}-missing.wav`);
      normalize(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(sceneDurs[i])], w);
      sceneWavs.push(w);
    } else {
      const w = path.join(wavDir, `${String(i + 1).padStart(2, '0')}-${s.id}.wav`);
      normalize(['-i', mp3], w);
      sceneWavs.push(w);
    }
  });

  const outroWav = path.join(wavDir, '99-outro-silence.wav');
  normalize(['-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-t', String(OUTRO_VIDEO_SEC)], outroWav);

  const audioList = path.join(tmp, 'audio-concat.txt');
  writeConcatList([introWav, ...sceneWavs, outroWav], audioList);

  const audioMp4 = path.join(tmp, 'audio.m4a');
  run('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', audioList,
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', audioMp4]);

  /* 4 — build vtt + srt subtitles */
  console.log('● subtitles');
  const vttPath = path.join(out, 'subs.vtt');
  const srtPath = path.join(out, 'subs.srt');
  buildVtt(manifest, sceneDurs, vttPath);
  buildSrt(manifest, sceneDurs, srtPath);

  /* 5 — mux final video + audio (burn-in subs already in frames via Player) */
  console.log('● mux final mp4');
  const finalMp4 = path.join(out, 'video.mp4');
  run('ffmpeg', ['-y',
    '-i', videoOnlyMp4,
    '-i', audioMp4,
    '-c:v', 'copy',
    '-c:a', 'copy',
    '-shortest',
    '-movflags', '+faststart',
    finalMp4]);

  /* 6 — thumbnail (frame at ~30% of main video) */
  console.log('● thumbnail');
  const mainFrames = countPngs(tmpDirFor(classId, '01-main'));
  if (mainFrames > 0) {
    const thumbIdx = Math.floor(mainFrames * 0.3);
    const thumbPng = path.join(tmpDirFor(classId, '01-main'), `${String(thumbIdx).padStart(6, '0')}.png`);
    if (fs.existsSync(thumbPng)) {
      const thumbOut = path.join(out, 'thumbnail.png');
      run('ffmpeg', ['-y', '-i', thumbPng, '-vf', `scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:flags=lanczos`, thumbOut]);
    }
  }

  /* 7 — metadata.txt */
  console.log('● metadata.txt');
  buildMetadata(classId, manifest, sceneDurs, path.join(out, 'metadata.txt'));

  /* 8 — summary */
  const stats = fs.statSync(finalMp4);
  const totalSec = INTRO_SEC + sceneDurs.reduce((a, b) => a + b, 0) + OUTRO_SEC;
  console.log(`\n✓ encoded · ${out}/`);
  console.log(`  video.mp4       ${(stats.size / 1024 / 1024).toFixed(1)} MB  ·  ${formatHMS(totalSec)}`);
  console.log(`  subs.vtt        ${fs.statSync(vttPath).size} B`);
  console.log(`  subs.srt        ${fs.statSync(srtPath).size} B`);
  if (fs.existsSync(path.join(out, 'thumbnail.png')))
    console.log(`  thumbnail.png   ${(fs.statSync(path.join(out, 'thumbnail.png')).size / 1024).toFixed(1)} KB`);
  console.log(`  metadata.txt    ${fs.statSync(path.join(out, 'metadata.txt')).size} B`);
}

main().catch(e => { console.error(e); process.exit(1); });
