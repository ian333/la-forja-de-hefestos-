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

const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.md') && f !== 'PLANTILLA.md' && f !== 'DESPUES-DE-V1.md').sort();
const tarjetas = archivos.map((f) => {
  const rel = `ordenes/${f}`;
  const txt = fs.readFileSync(path.join(DIR, f), 'utf8');
  const titulo = (txt.match(/^# ORDEN:\s*(.+)$/m) || [, f])[1].trim();
  const fecha = (f.match(/^(\d{4}-\d{2}-\d{2})/) || [, ''])[1];
  const estadoDecl = campo(txt, 'ESTADO').toLowerCase();
  const cierre = seccion(txt, 'CIERRE');
  const tieneCierre = cierre.some((l) => l.trim());
  const estado = estadoDecl === 'proximo' ? 'proximo' : tieneCierre ? 'cerrado' : 'en-curso';
  const prioridad = +campo(txt, 'PRIORIDAD') || 999;
  return {
    file: rel, slug: f.replace(/\.md$/, ''), titulo, fecha, estado, prioridad,
    objetivo: objetivo(txt),
    toca: bullets(seccion(txt, 'TOCA')).length,
    crea: bullets(seccion(txt, 'CREA')).length,
    evidencia: bullets(seccion(txt, 'EVIDENCIA')).length,
    cierre: tieneCierre ? unaLinea(cierre.filter((l) => !/^\s*-\s*orden vs/i.test(l)), 200) : '',
    commit: estado === 'cerrado' ? commitDe(rel) : '',
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

const violaciones = [];
if (proximo.length > WIP.proximo) violaciones.push(`PRÓXIMO tiene ${proximo.length} > ${WIP.proximo}: para meter uno, saca uno`);
if (enCurso.length > WIP.enCurso) violaciones.push(`EN CURSO tiene ${enCurso.length} > ${WIP.enCurso}: una orden a la vez — cierra o degrada a PRÓXIMO`);

const json = {
  nombre: 'TEMIS', generado: new Date().toISOString().slice(0, 16).replace('T', ' '),
  wip: WIP, conteo: { proximo: proximo.length, enCurso: enCurso.length, cerrado: cerrado.length, despues: despues.length },
  violaciones, columnas: { proximo, enCurso, cerrado }, despues,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(json, null, 1));

console.log(`TEMIS · próximo ${proximo.length}/${WIP.proximo} · en curso ${enCurso.length}/${WIP.enCurso} · cerrado ${cerrado.length} · después ${despues.length}`);
for (const t of proximo) console.log(`  ${String(t.prioridad).padStart(2)} · ${t.titulo}`);
for (const t of enCurso) console.log(`  ▶ EN CURSO · ${t.titulo}`);
for (const v of violaciones) console.log(`  ✘ ${v}`);
console.log(`→ ${path.relative(REPO, OUT)}`);
process.exit(violaciones.length ? 1 : 0);
