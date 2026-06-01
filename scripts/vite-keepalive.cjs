#!/usr/bin/env node
/**
 * vite-keepalive.cjs — Mantiene vite-render VIVO para batches largos. Si vite
 * muere (crash, SIGHUP), lo revive en 2s. Lanzar DETACHED para que sobreviva a la
 * muerte de la sesión ssh:
 *   ssh iangpu 'setsid nohup node /abs/scripts/vite-keepalive.cjs >/tmp/vite-ka.log 2>&1 </dev/null &'
 * y verificar con curl en llamada aparte. Matar con: pkill -f vite-keepalive
 */
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const VITE = path.join(__dirname, 'vite-render.cjs');
let n = 0;
function start() {
  n++;
  console.log(`[keepalive] arrancando vite (intento ${n})`);
  const p = spawn('node', [VITE], { stdio: 'inherit', env: process.env });
  p.on('exit', (code) => {
    console.log(`[keepalive] vite salió (code ${code}); reinicio en 2s`);
    setTimeout(start, 2000);
  });
}
start();
