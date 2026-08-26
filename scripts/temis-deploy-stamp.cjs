#!/usr/bin/env node
/*
 * temis-deploy-stamp.cjs — estampa QUÉ commit se acaba de desplegar, para que TEMIS
 * sepa qué tarjetas ya están EN VIVO y cuáles siguen SIN DESPLEGAR. Nace de la regla
 * dura de deploy_gotchas: nunca dos deploys encimados → el tablero tiene que decir si
 * hay trabajo cerrado sin subir ANTES de que alguien lance otro deploy.
 *
 * Lo llama deploy-atlas-build.sh justo antes de sincronizar el árbol (así el public/
 * que sube ya trae el stamp de ESTE deploy y un temis.json coherente). También sirve a
 * mano: node scripts/temis-deploy-stamp.cjs
 */
const fs = require('fs'), path = require('path'), { execSync } = require('child_process');
const REPO = path.resolve(__dirname, '..');
const g = (c) => { try { return execSync(c, { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
const commit = process.argv[2] || g('git rev-parse --short HEAD') || '?';
const commitFull = g('git rev-parse HEAD') || '';
const dirty = g('git status --porcelain').split('\n').filter(Boolean).length;
// fecha sin Date.now del bundler (aquí es un script de node normal, se permite):
const fecha = new Date().toISOString().slice(0, 16).replace('T', ' ');
const out = path.join(REPO, 'public', 'temis-deploy.json');
fs.writeFileSync(out, JSON.stringify({ commit, commitFull, fecha, dirty, host: g('hostname') }, null, 1));
console.log(`TEMIS deploy stamp · ${commit}${dirty ? ` (+${dirty} sin commit)` : ''} · ${fecha}`);
// regenerar el tablero para que refleje el nuevo stamp
try { execSync('node scripts/temis-tablero.cjs', { cwd: REPO, stdio: 'inherit' }); } catch {}
