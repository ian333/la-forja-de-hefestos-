#!/usr/bin/env node
/**
 * GAIA video pipeline — orchestrator.
 *
 * 1. Asegura que un dev server local esté sirviendo el build (o lanza vite preview)
 * 2. Lanza capture.cjs para tomar frames PNG de bumpers + main
 * 3. Lanza encode.cjs para multiplexar video + audio + subtítulos
 *
 * Uso:
 *    node scripts/video-gaia/render.cjs <classId>
 *    node scripts/video-gaia/render.cjs --all
 *    node scripts/video-gaia/render.cjs <classId> --keep-tmp
 */

const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const http = require('http');
const {
  ROOT, listClasses, readManifest, tmpDirFor, outDirFor, nukeDir, ensureDir,
} = require('./lib.cjs');

const DEFAULT_PORT = 5174;  // dedicated port for video pipeline
const DEFAULT_BASE = `http://localhost:${DEFAULT_PORT}`;

function parseArgs() {
  const args = process.argv.slice(2);
  const out = {
    classIds: [],
    all: false,
    baseUrl: null,
    keepTmp: false,
    fps: 60,
    skipServer: false,
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--all') out.all = true;
    else if (a === '--base-url') out.baseUrl = args[++i];
    else if (a === '--keep-tmp') out.keepTmp = true;
    else if (a === '--fps') out.fps = parseInt(args[++i], 10);
    else if (a === '--skip-server') out.skipServer = true;
    else if (!a.startsWith('-')) out.classIds.push(a);
  }
  return out;
}

function pingUrl(url) {
  return new Promise(resolve => {
    const u = new URL(url);
    const req = http.get({ host: u.hostname, port: u.port, path: u.pathname, timeout: 1500 }, res => {
      resolve(res.statusCode >= 200 && res.statusCode < 500);
      res.resume();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function waitFor(url, timeoutMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await pingUrl(url)) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function ensureServer(baseUrl) {
  const probe = `${baseUrl}/escuela.html`;
  if (await pingUrl(probe)) {
    console.log(`● server live at ${baseUrl}`);
    return null;
  }
  console.log(`● starting vite preview at ${baseUrl}`);
  // Try preview first (needs prior build), else dev
  const distOk = fs.existsSync(path.join(ROOT, 'dist', 'index.html'));
  let cmd, args;
  if (distOk) {
    cmd = 'npx';
    args = ['vite', 'preview', '--host', '--port', String(new URL(baseUrl).port)];
  } else {
    console.log('  ↳ no dist/ — falling back to vite dev (slower)');
    cmd = 'npx';
    args = ['vite', '--host', '--port', String(new URL(baseUrl).port)];
  }
  const proc = spawn(cmd, args, { cwd: ROOT, stdio: 'pipe' });
  proc.stdout.on('data', d => {
    const s = d.toString();
    if (/error|fail/i.test(s)) process.stdout.write(`  server> ${s}`);
  });
  proc.stderr.on('data', d => process.stdout.write(`  server-err> ${d.toString()}`));

  const ok = await waitFor(probe, 60_000);
  if (!ok) {
    proc.kill();
    throw new Error('vite server did not come up in 60s');
  }
  console.log('  ↳ server ready');
  return proc;
}

function runScript(scriptPath, args) {
  const r = spawnSync('node', [scriptPath, ...args], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) throw new Error(`${path.basename(scriptPath)} failed: exit ${r.status}`);
}

async function renderOne(classId, baseUrl, { fps, keepTmp }) {
  const banner = `══════════════════════════════════════════════════════════════════`;
  console.log(`\n${banner}`);
  console.log(`  ${classId}`);
  console.log(`${banner}`);

  const tStart = Date.now();
  runScript(path.join(__dirname, 'capture.cjs'), [classId, '--base-url', baseUrl]);
  runScript(path.join(__dirname, 'encode.cjs'),  [classId, '--fps', String(fps)]);
  const tEnd = Date.now();
  const mins = ((tEnd - tStart) / 60000).toFixed(1);

  if (!keepTmp) {
    nukeDir(tmpDirFor(classId, ''));
  }
  const outFile = path.join(outDirFor(classId), 'video.mp4');
  const sizeMB = fs.statSync(outFile).size / 1024 / 1024;
  console.log(`\n✅ ${classId}  ·  ${sizeMB.toFixed(1)} MB  ·  ${mins} min wall\n`);
}

async function main() {
  const { classIds, all, baseUrl: baseUrlArg, keepTmp, fps, skipServer } = parseArgs();
  const baseUrl = baseUrlArg ?? DEFAULT_BASE;

  let targets = classIds;
  if (all) targets = listClasses();
  if (targets.length === 0) {
    console.error('usage: node render.cjs <classId> [<classId>...] | --all');
    console.error('  options: --base-url URL · --fps 60 · --keep-tmp · --skip-server');
    console.error(`\nKnown classes:\n  ${listClasses().join('\n  ')}`);
    process.exit(2);
  }

  // Validate manifests exist
  for (const id of targets) {
    try { readManifest(id); }
    catch (e) { console.error(`❌ ${id}: ${e.message}`); process.exit(1); }
  }

  // Ensure server
  let server = null;
  if (!skipServer) {
    server = await ensureServer(baseUrl);
  }

  try {
    for (const id of targets) {
      await renderOne(id, baseUrl, { fps, keepTmp });
    }
  } finally {
    if (server) {
      console.log('● stopping local server');
      server.kill();
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
