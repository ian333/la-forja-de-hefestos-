#!/usr/bin/env node
/**
 * render-queue.cjs — COLA DE RENDERS de La Forja (iangpu).
 *
 * El problema que resuelve: lanzar renders ad-hoc los encadena/choca (dos a la vez se
 * pelean el chrome/VRAM y cuelgan el box). Esta cola corre los trabajos UNO A LA VEZ.
 *
 * Lee render-queue.json: { jobs: [ {id, label, cmd, status} ] }
 *   status: pending | running | done | failed
 *   cmd: lo que se corre EN /home/ian/Orkesta/la-forja con el env GPU ya puesto
 *        (ej. "SLUG=coase ID=econ-1991-coase END=438 FMT=169 BATCH=100 AUDIO=auto node scripts/render-clase.cjs")
 *
 * Ciclo: re-lee el JSON (permite agregar trabajos EN CALIENTE) → toma el 1er pending →
 *   running → corre con env GPU → done/failed → pkill chrome → siguiente. Hasta vaciar.
 * Resumible: al arrancar, cualquier 'running' (interrumpido por reinicio del box) vuelve
 *   a 'pending'; render-clase retoma por frame. Lanzar detached con setsid.
 *
 *   setsid env -C /home/ian/Orkesta/la-forja node scripts/render-queue.cjs > /home/ian/render-queue.log 2>&1 &
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = '/home/ian/Orkesta/la-forja';
const QF = path.join(ROOT, 'render-queue.json');
const GPU_ENV = 'DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA';
const JOB_TIMEOUT = 3 * 3600 * 1000;   // backstop: 3h por job (el watchdog interno corta antes)

const stamp = () => new Date().toISOString().replace('T', ' ').slice(0, 19);
const log = (m) => console.log(`[${stamp()}] ${m}`);
const load = () => JSON.parse(fs.readFileSync(QF, 'utf8'));
const save = (q) => fs.writeFileSync(QF, JSON.stringify(q, null, 2));
const killChrome = () => { try { execSync('pkill -9 -x chrome', { stdio: 'ignore' }); } catch { /* sin match */ } };

// al arrancar: jobs 'running' interrumpidos (reinicio del box) → 'pending' para reanudar
(() => { const q = load(); let n = 0; for (const j of q.jobs) if (j.status === 'running') { j.status = 'pending'; n++; } if (n) { save(q); log(`reanudo ${n} job(s) interrumpido(s)`); } })();

log('cola arrancada');
while (true) {
  const q = load();                                   // re-lee → hot-add de trabajos
  const job = q.jobs.find(j => j.status === 'pending');
  if (!job) { log('cola vacía — fin'); break; }

  killChrome();                                       // pizarra limpia antes de cada job
  job.status = 'running'; job.startedAt = stamp(); delete job.error;
  { const q2 = load(); const jj = q2.jobs.find(j => j.id === job.id); Object.assign(jj, job); save(q2); }
  log(`▶ ${job.label} [${job.id}]`);

  try {
    execSync(`${GPU_ENV} ${job.cmd}`, { cwd: ROOT, stdio: 'inherit', timeout: JOB_TIMEOUT });
    const q2 = load(); const jj = q2.jobs.find(j => j.id === job.id);
    jj.status = 'done'; jj.finishedAt = stamp(); save(q2);
    log(`✓ ${job.label}`);
  } catch (e) {
    const q2 = load(); const jj = q2.jobs.find(j => j.id === job.id);
    jj.status = 'failed'; jj.finishedAt = stamp(); jj.error = String(e.message).slice(0, 200); save(q2);
    log(`✗ ${job.label}: ${String(e.message).slice(0, 150)}`);
  }
  killChrome();
}
log('runner terminado');
