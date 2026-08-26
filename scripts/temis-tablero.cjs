/**
 * TEMIS — el tablero de órdenes de La Forja (nuestro "Jira", sin el impuesto).
 * ============================================================================
 * Temis: la diosa del orden, la que convoca la asamblea; madre de las Moiras
 * (hilan, miden, CORTAN) y de las Horas. Le pone orden al caos.
 *
 * ian (2026-08-21): "tenemos mucho construido pero nada terminado… si yo soy
 * parte del problema necesitamos ese Jira". Ley de Little: con 30 hilos al 80 %
 * nada cruza la meta. Medido en el repo: 46 órdenes cerradas, 46 con CIERRE — donde hay
 * función forzante, TODO se termina.
 *
 * NADIE TECLEA UN TICKET: la orden ES el ticket. Este script LEE `ordenes/*.md`
 * (que ya traen OBJETIVO/TOCA/CREA/EVIDENCIA/CIERRE + juez mecánico + commit) y
 * emite `public/temis.json` para el lobby. Cero doble captura.
 *
 * LA TAPA (lo que Jira nunca hace): PRÓXIMO ≤ 7 · EN CURSO ≤ 1. Si se viola,
 * el tablero lo PINTA en rojo y este script sale 1 — se niega.
 *
 * Estados (de la orden, no de un formulario):
 *   `ESTADO: proximo` + `PRIORIDAD: n`  → PRÓXIMO (ordenado por n)
 *   sin ESTADO y sin `## CIERRE`         → EN CURSO
 *   con `## CIERRE`                      → CERRADO (commit = último que la tocó)
 *   `ordenes/DESPUES-DE-V1.md`           → DESPUÉS (bullets, agrupados por ##)
 *
 * Uso:  node scripts/temis-tablero.cjs        → escribe public/temis.json
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const DIR = path.join(REPO, 'ordenes');
const OUT = path.join(REPO, 'public', 'temis.json');
const WIP = { proximo: 7, enCurso: 1 };

const lines = (t) => t.split(/\r?\n/);
/** cuerpo de una sección `## NOMBRE…` hasta el siguiente `## ` */
function seccion(txt, nombre) {
  const L = lines(txt); const out = [];
  let dentro = false;
  for (const l of L) {
    if (/^## /.test(l)) { if (dentro) break; dentro = new RegExp(`^## ${nombre}\\b`, 'i').test(l); continue; }
    if (dentro) out.push(l);
  }
  return out;
}
const bullets = (ls) => ls.filter((l) => /^- /.test(l)).map((l) => l.replace(/^- /, '').trim()).filter((b) => b && !/^\(nada\)/.test(b));
// texto plano para la tarjeta: fuera el markdown crudo (**negritas**, `código`) —
// los ojos lo cazaron en la primera captura del tablero
const plano = (s) => s.replace(/\*\*/g, '').replace(/`/g, '');
const unaLinea = (ls, max) => { const s = plano(ls.map((l) => l.trim()).filter(Boolean).join(' ').replace(/\s+/g, ' ')); return s.length > max ? s.slice(0, max - 1) + '…' : s; };
function campo(txt, k) { const m = txt.match(new RegExp(`^${k}:\\s*(.+)$`, 'mi')); return m ? m[1].trim() : ''; }
/** OBJETIVO: hasta la primera línea en blanco */
function objetivo(txt) {
  const L = lines(txt); const i = L.findIndex((l) => /^OBJETIVO:/i.test(l));
  if (i < 0) return '';
  const out = [L[i].replace(/^OBJETIVO:\s*/i, '')];
  for (let j = i + 1; j < L.length && L[j].trim() && !/^## /.test(L[j]); j++) out.push(L[j]);
  return unaLinea(out, 240);
}
function commitDe(rel) {
  try { return execSync(`git log -1 --format=%h -- "${rel}"`, { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); }
  catch { return ''; }
}
// LA PANTALLA DE EVIDENCIA (ian: "para que me pidas que revise uno, SÍ O SÍ
// deben estar los ss de que funciona"). Los screenshots viven en
// public/evidencia/<slug>/*.jpg — el generador los DESCUBRE, nadie los registra.
const EVID = path.join(REPO, 'public', 'evidencia');
function ssDe(slug) {
  const d = path.join(EVID, slug);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().map((f) => `evidencia/${slug}/${f}`);
}

// ── ESTADO DE DESPLIEGUE (coordinar deploys — deploy_gotchas: nunca dos a la vez) ──
// El deploy estampa public/temis-deploy.json = {commitFull} = lo que está EN VIVO.
// Cada tarjeta cerrada se deriva sola: su commit es ancestro del desplegado → 'en-vivo';
// más nueva y tocó el sitio → 'sin-desplegar'; no tocó el sitio (video/física/docs) → 'n-a'.
const DEPLOY = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'temis-deploy.json'), 'utf8')); }
  catch { return null; }
})();
const SITE = /^(src\/|public\/|index\.html|[^/]*\.html|vite\.config|.*\.css)/;
function tocaSitio(commit) {
  if (!commit) return false;
  const f = (() => { try { return execSync(`git show --name-only --format= ${commit}`, { cwd: REPO, stdio: ['ignore','pipe','ignore'] }).toString(); } catch { return ''; } })();
  return f.split('\n').some((l) => l && SITE.test(l.trim()));
}
function despliegueDe(commit, decl) {
  const d = (decl || '').toLowerCase().replace(/\s.*$/, '');
  if (['en-vivo','sin-desplegar','n-a','pendiente'].includes(d)) return d === 'pendiente' ? 'sin-desplegar' : d;  // override de la orden
  if (!commit) return '';
  if (!tocaSitio(commit)) return 'n-a';
  if (!DEPLOY || !DEPLOY.commitFull) return 'sin-desplegar';    // nunca se ha desplegado
  const anc = (() => { try { execSync(`git merge-base --is-ancestor ${commit} ${DEPLOY.commitFull}`, { cwd: REPO, stdio: 'ignore' }); return true; } catch { return false; } })();
  return anc ? 'en-vivo' : 'sin-desplegar';
}

const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'PLANTILLA.md' && f !== 'DESPUES-DE-V1.md').sort();
const tarjetas = archivos.map((f) => {
  const rel = `ordenes/${f}`;
  const slug = f.replace(/\.md$/, '');
  const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
  const titulo = (txt.match(/^# ORDEN:\s*(.+)$/m) || [, f])[1].trim();
  const fecha = (f.match(/^(\d{4}-\d{2}-\d{2})/) || [, ''])[1];
  const estadoDecl = campo(txt, 'ESTADO').toLowerCase();
  const cierre = seccion(txt, 'CIERRE');
  const tieneCierre = cierre.some((l) => l.trim());
  // PROBADO (ian): `PROBADO: <fecha> · <nota>` = ian lo probó y lo acepta → 4ª columna.
  // `FALLA: <nota>` = lo probó y NO pasó → sigue en CERRADO con insignia roja y la nota.
  const probado = campo(txt, 'PROBADO');
  const falla = campo(txt, 'FALLA');
  const estado = estadoDecl === 'proximo' ? 'proximo' : tieneCierre ? (probado ? 'probado' : 'cerrado') : 'en-curso';
  const prioridad = +campo(txt, 'PRIORIDAD') || 999;
  const evidenciaSS = ssDe(slug);
  // fuera las tablas markdown (| a | b |) y sus rayas: aplanadas son ilegibles — la orden completa queda en el .md
  const cierreLimpio = cierre.filter((l) => !/^\s*-\s*orden vs/i.test(l) && !/^\s*\|/.test(l) && !/^\s*-{3,}\s*$/.test(l));
  return {
    file: rel, slug, titulo, fecha, estado, prioridad,
    objetivo: objetivo(txt),
    toca: bullets(seccion(txt, 'TOCA')).length,
    crea: bullets(seccion(txt, 'CREA')).length,
    evidencia: bullets(seccion(txt, 'EVIDENCIA')).length,
    evidenciaDeclarada: bullets(seccion(txt, 'EVIDENCIA')).map(plano),
    cierre: tieneCierre ? unaLinea(cierreLimpio, 200) : '',
    cierreCompleto: tieneCierre ? unaLinea(cierreLimpio, 1600) : '',
    evidenciaSS,
    // revisable = cerrada CON screenshots. Sin ss no se le pide a ian que revise.
    revisable: (estado === 'cerrado' || estado === 'probado') && evidenciaSS.length > 0,
    probado: plano(probado), falla: plano(falla),
    commit: (estado === 'cerrado' || estado === 'probado') ? commitDe(rel) : '',
    despliegue: (estado === 'cerrado' || estado === 'probado') ? despliegueDe(commitDe(rel), campo(txt, 'DESPLIEGUE')) : '',
  };
});

// DESPUÉS-DE-V1: bullets agrupados por ##
const despues = [];
{
  const p = path.join(DIR, 'DESPUES-DE-V1.md');
  if (fs.existsSync(p)) {
    let grupo = '';
    for (const l of lines(fs.readFileSync(p, 'utf8'))) {
      if (/^## /.test(l)) grupo = l.replace(/^## /, '').trim();
      else if (/^- /.test(l)) despues.push({ grupo, texto: l.replace(/^- /, '').trim() });
      else if (/^\s{2,}\S/.test(l) && despues.length) despues[despues.length - 1].texto += ' ' + l.trim();
    }
  }
}

const proximo = tarjetas.filter((t) => t.estado === 'proximo').sort((a, b) => a.prioridad - b.prioridad);
const enCurso = tarjetas.filter((t) => t.estado === 'en-curso');
const cerrado = tarjetas.filter((t) => t.estado === 'cerrado').sort((a, b) => (b.fecha + b.slug).localeCompare(a.fecha + a.slug));
const probadas = tarjetas.filter((t) => t.estado === 'probado').sort((a, b) => (b.fecha + b.slug).localeCompare(a.fecha + a.slug));

const violaciones = [];
if (proximo.length > WIP.proximo) violaciones.push(`PRÓXIMO tiene ${proximo.length} > ${WIP.proximo}: para meter uno, saca uno`);
if (enCurso.length > WIP.enCurso) violaciones.push(`EN CURSO tiene ${enCurso.length} > ${WIP.enCurso}: una orden a la vez — cierra o degrada a PRÓXIMO`);
// SÍ O SÍ: una orden que se está CERRANDO en este working tree (su archivo está
// modificado o nuevo en git) sin carpeta de screenshots = se niega. Las cerradas
// de antes de Temis solo se marcan "sin evidencia visual" (no se reescribe la historia).
let tocadas = [];
try {
  tocadas = execSync('git status --porcelain -- ordenes/', { cwd: REPO, stdio: ['ignore', 'pipe', 'ignore'] })
    .toString().split('\n').map((l) => l.slice(3).trim()).filter(Boolean);
} catch { /* sin git: no se puede saber qué se cierra ahora */ }
for (const t of cerrado) {
  if (t.evidenciaSS.length === 0 && tocadas.includes(t.file))
    violaciones.push(`CERRADA SIN EVIDENCIA VISUAL: ${t.slug} — pon los ss en public/evidencia/${t.slug}/ antes de pedir revisión`);
}
const revisables = cerrado.filter((t) => t.revisable).length;

const json = {
  nombre: 'TEMIS', generado: new Date().toISOString().slice(0, 16).replace('T', ' '),
  wip: WIP, conteo: { proximo: proximo.length, enCurso: enCurso.length, cerrado: cerrado.length, probado: probadas.length, porProbar: cerrado.filter((t) => t.revisable && !t.falla).length, sinDesplegar: [...cerrado, ...probadas].filter((t) => t.despliegue === 'sin-desplegar').length, despues: despues.length },
  deploy: DEPLOY ? { commit: DEPLOY.commit, fecha: DEPLOY.fecha } : null,
  violaciones, columnas: { proximo, enCurso, cerrado, probado: probadas }, despues,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(json, null, 1));

const _sd = [...cerrado, ...probadas].filter((t) => t.despliegue === 'sin-desplegar').length;
if (_sd > 0) console.log(`  ⬆ ${_sd} cerrada(s) SIN DESPLEGAR — coordina el deploy (nunca dos a la vez)`);
console.log(`TEMIS · próximo ${proximo.length}/${WIP.proximo} · en curso ${enCurso.length}/${WIP.enCurso} · cerrado ${cerrado.length} (${revisables} con evidencia visual) · probado ${probadas.length} · después ${despues.length}`);
for (const t of proximo) console.log(`  ${String(t.prioridad).padStart(2)} · ${t.titulo}`);
for (const t of enCurso) console.log(`  ▶ EN CURSO · ${t.titulo}`);
for (const v of violaciones) console.log(`  ✘ ${v}`);
console.log(`→ ${path.relative(REPO, OUT)}`);
process.exit(violaciones.length ? 1 : 0);
