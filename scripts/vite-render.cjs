#!/usr/bin/env node
/**
 * vite-render.cjs — Dev server para RENDER en iangpu, SIN file-watcher (evita el
 * crash ENOSPC de inotify). Reiniciar tras cada scp de source.
 *   DISPLAY=:0 node scripts/vite-render.cjs   (puerto 5001)
 */
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { createServer } = require(path.join(ROOT, 'node_modules', 'vite'));
const PORT = parseInt(process.env.PORT || '5001', 10);
createServer({
  configFile: path.join(ROOT, 'vite.config.ts'),
  root: ROOT,
  // watch:null + hmr:false → SIN file-watcher y SIN page-reloads. El HMR mandaba
  // reloads a media grabación y tumbaba window.__cinematicAtom (render FATAL).
  server: { port: PORT, host: '0.0.0.0', watch: null, hmr: false },
}).then(s => s.listen()).then(() => console.log(`ready on :${PORT}`))
  .catch(e => { console.error('vite failed:', e.message); process.exit(1); });
