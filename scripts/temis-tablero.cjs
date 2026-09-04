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
 * SUPERTICKET (2026-08-26): una orden con sección `## EJERCICIOS` es un superticket —
 * una matriz herramienta × lección donde cada línea `- <id> · <título> · <herramientas>
 * · <oráculo>` es un ejercicio (video con voz + oráculo del kernel + veredicto). El estado
 * de cada ejercicio NO se teclea: lo escribe la PRODUCCIÓN en
 * `public/evidencia/<slug>/resultados.json` ({<id>:{estado,checks,video,still,nota}}) y
 * aquí solo se LEE. Sin resultados = todo `pendiente`. La tarjeta trae `superticket:true`,
 * `ejercicios[]` y `progreso:{verdes,rojos,total}`. Sin CIERRE sigue siendo EN CURSO, pero NO
 * cuenta para la tapa (ver `enCursoTapa`).
 *
 * Uso:  node scripts/temis-tablero.cjs        → escribe public/temis.json
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
const DIR = path.join(REPO, 'ordenes');
const OUT = path.join(REPO, 'public', 'temis.json');
// IMPREVISTO (ian, 2026-08-31): «esos WIP están ahí porque salió algo más urgente… no sé
// cómo llamarlos, ¿imprevistos? De esos en teoría se deben añadir 1-3 máximo, para seguir
// llevando un orden. Y ponme límites». El tope ES el límite y aplica a los dos: con 3
// imprevistos abiertos no entra otro hasta cerrar uno. Sin esta casilla, lo urgente se
// disfrazaba de EN CURSO y reventaba la tapa de 1 — que fue exactamente lo que pasó.
const WIP = { proximo: 7, enCurso: 1, imprevisto: 3 };

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

// ── SUPERTICKET: `## EJERCICIOS` + resultados.json ───────────────────────────
// Una línea = `- <id> · <título> · <herramientas> · <oráculo>`. Se parte por ' · ':
// id es lo primero, herramientas y oráculo lo ÚLTIMO — así un título con '·' adentro
// no rompe la fila. Estados válidos: verde | rojo | pendiente (cualquier otra cosa
// → pendiente: el tablero no inventa verdes).
const ESTADOS_EJ = new Set(['verde', 'rojo', 'pendiente']);
function resultadosDe(slug) {
  const p = path.join(EVID, slug, 'resultados.json');
  if (!fs.existsSync(p)) return {};
  try { const j = JSON.parse(fs.readFileSync(p, 'utf8')); return j && typeof j === 'object' ? j : {}; }
  catch (e) { console.log(`  ⚠ ${slug}/resultados.json ilegible (${e.message}) — se trata como sin resultados`); return {}; }
}
function ejerciciosDe(txt, slug) {
  const filas = bullets(seccion(txt, 'EJERCICIOS'));
  if (!filas.length) return null;
  const res = resultadosDe(slug);
  return filas.map((f) => {
    const p = f.split(' · ').map((x) => x.trim());
    const id = p[0] || '';
    const titulo = p.length >= 4 ? p.slice(1, -2).join(' · ') : (p[1] || '');
    const herramientas = p.length >= 4 ? p[p.length - 2] : (p[2] || '');
    const oraculo = p.length >= 4 ? p[p.length - 1] : (p[3] || '');
    const r = (res[id] && typeof res[id] === 'object') ? res[id] : {};
    const estado = ESTADOS_EJ.has(String(r.estado || '').toLowerCase()) ? String(r.estado).toLowerCase() : 'pendiente';
    return {
      id, titulo: plano(titulo), herramientas: plano(herramientas), oraculo: plano(oraculo),
      estado, checks: String(r.checks || ''), video: String(r.video || ''), still: String(r.still || ''), nota: plano(String(r.nota || '')),
    };
  });
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
  // `TIPO: imprevisto` = trabajo que NO estaba planeado y entró por urgencia. Mientras esté
  // abierto vive en su propia columna; al cerrar, cae en CERRADO como cualquier otra.
  const tipo = campo(txt, 'TIPO').toLowerCase();
  const estado = estadoDecl === 'proximo' ? 'proximo'
    : tieneCierre ? (probado ? 'probado' : 'cerrado')
    : tipo === 'imprevisto' ? 'imprevisto' : 'en-curso';
  const prioridad = +campo(txt, 'PRIORIDAD') || 999;
  const evidenciaSS = ssDe(slug);
  // fuera las tablas markdown (| a | b |) y sus rayas: aplanadas son ilegibles — la orden completa queda en el .md
  const cierreLimpio = cierre.filter((l) => !/^\s*-\s*orden vs/i.test(l) && !/^\s*\|/.test(l) && !/^\s*-{3,}\s*$/.test(l));
  // SUPERTICKET: `## EJERCICIOS` → ejercicios[] (estado lo pone resultados.json, no la orden)
  const ejercicios = ejerciciosDe(txt, slug);
  const superticket = !!ejercicios;
  // rojos también cuentan: un ejercicio producido y reprobado (por el kernel O por el juez con ojos)
  // es trabajo hecho que falló — la barra lo pinta rojo en vez de esconderlo como 'pendiente'.
  const progreso = superticket ? { verdes: ejercicios.filter((e) => e.estado === 'verde').length, rojos: ejercicios.filter((e) => e.estado === 'rojo').length, total: ejercicios.length } : null;
  return {
    file: rel, slug, titulo, fecha, estado, prioridad, tipo,
    superticket, ejercicios: ejercicios || [], progreso,
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
const imprevistos = tarjetas.filter((t) => t.estado === 'imprevisto');
const cerrado = tarjetas.filter((t) => t.estado === 'cerrado').sort((a, b) => (b.fecha + b.slug).localeCompare(a.fecha + a.slug));
const probadas = tarjetas.filter((t) => t.estado === 'probado').sort((a, b) => (b.fecha + b.slug).localeCompare(a.fecha + a.slug));

const violaciones = [];
if (proximo.length > WIP.proximo) violaciones.push(`PRÓXIMO tiene ${proximo.length} > ${WIP.proximo}: para meter uno, saca uno`);
// LA TAPA DE EN CURSO mide lo que ESPERA A IAN (una orden abierta a la vez para que
// algo cruce la meta), no lo que trabajan los agentes en paralelo. Un superticket es
// una parrilla de producción que corre sola en iangpu (video tras video, verde tras
// verde) — puede haber dos o tres vivos sin que nadie esté esperando a ian. Por eso
// los supertickets se LISTAN en EN CURSO (así se ve su n/N) pero NO cuentan para la
// tapa; si contaran, dos supertickets + la orden de otra sesión = tablero rojo por
// diseño, y una tapa que siempre está roja no mide nada.
const enCursoTapa = enCurso.filter((t) => !t.superticket);
if (enCursoTapa.length > WIP.enCurso) violaciones.push(`EN CURSO tiene ${enCursoTapa.length} > ${WIP.enCurso} (sin contar supertickets): una orden a la vez — cierra o degrada a PRÓXIMO`);
// El tope de IMPREVISTOS es el que impide que la puerta de atrás se vuelva otro cajón.
if (imprevistos.length > WIP.imprevisto) violaciones.push(`IMPREVISTOS tiene ${imprevistos.length} > ${WIP.imprevisto}: lo urgente también lleva orden — cierra uno antes de abrir otro`);
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

// ── CINE: 1 video por día (videos/CRONOGRAMA.json). `publicado` se DERIVA del catálogo de
// Comando (public/comando/catalogo.json): si la pieza está ahí, está en vivo. Nadie lo teclea.
// ══ EL CAMINO — el hilo de las Moiras (2026-09-02) ═══════════════════════════════════
// Temis tenía unidades de TRABAJO (orden, superticket, imprevisto) y ninguna unidad de USO.
// Un camino es una PROMESA hecha pasos: `caminos/<slug>.md` con ACTOR/PROMESA/PIEZA y
// `## PASOS` (- n · gesto · se ve · estado · ticket-slug). Se lee, no se calcula: el estado
// de cada paso hoy lo declara el archivo con lo que ya medimos; el runner que recorre
// producción y lo actualiza solo es el siguiente quick win. Estados: ok | falla | parcial |
// bloqueado (depende de un paso que falla).
const caminos = (() => {
  const dir = path.join(REPO, 'caminos');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const txt = fs.readFileSync(path.join(dir, f), 'utf8');
    const slug = f.replace(/\.md$/, '');
    const titulo = (txt.match(/^# CAMINO:\s*(.+)$/m) || [, slug])[1].trim();
    const pasos = bullets(seccion(txt, 'PASOS')).map((l) => {
      const [n, gesto, seVe, estado, ticket] = l.split(' · ').map((x) => x.trim());
      return { n: +n || 0, gesto: gesto || '', seVe: seVe || '', estado: (estado || 'parcial').toLowerCase(), ticket: ticket && ticket !== '-' ? ticket : '' };
    }).filter((p) => p.n > 0);
    const verdes = pasos.filter((p) => p.estado === 'ok').length;
    const rompe = pasos.find((p) => p.estado === 'falla');
    // MEDIDO POR LA MÁQUINA (orden 2026-09-04-el-runner-del-camino): `camino-runner.cjs` deja en
    // `## MEDIDO` una línea `- runner · <fecha> UTC · <url> · servido <commit> · <máquina> · …`.
    // Si existe, el tablero dice CUÁNDO y DÓNDE se midió; si no, los estados son declarados a mano.
    const lRunner = bullets(seccion(txt, 'MEDIDO')).find((l) => /^runner · /.test(l));
    const medido = lRunner ? (() => {
      const c = lRunner.split(' · ').map((x) => x.trim());
      return { fecha: (c[1] || '').replace(/ UTC$/, ''), url: c[2] || '', servido: (c[3] || '').replace(/^servido /, ''), maquina: c[4] || '' };
    })() : null;
    return {
      slug, titulo, actor: campo(txt, 'ACTOR'), promesa: campo(txt, 'PROMESA'), pieza: campo(txt, 'PIEZA'), nota: campo(txt, 'NOTA'),
      pasos, verdes, total: pasos.length, rompeEn: rompe ? rompe.n : 0, medido,
    };
  });
})();

const cine = (() => {
  try {
    const cr = JSON.parse(fs.readFileSync(path.join(REPO, 'videos', 'CRONOGRAMA.json'), 'utf8'));
    let cat = [];
    try { cat = JSON.parse(fs.readFileSync(path.join(REPO, 'public', 'comando', 'catalogo.json'), 'utf8')).pieces || []; } catch {}
    const ids = new Set(cat.map((p) => p.id));
    // DÓNDE VIVE CADA PIEZA (2026-08-28): el manifiesto ya trae `publicar.subidas` desde que
    // las subidas son por API — se registra solo al publicar. Aquí solo se LEE: cero doble
    // captura, igual que las órdenes. `falta` es la lista de lo que aún no existe, y es lo
    // que convierte la tira en un tablero de control en vez de un calendario bonito.
    const dias = (cr.dias || []).map((d) => {
      const mp = path.join(REPO, 'videos', `${d.id}.json`);
      let pieza = '', pub = {};
      try { pub = JSON.parse(fs.readFileSync(mp, 'utf8')).publicar || {}; pieza = pub.pieza || ''; } catch {}
      const sub = pub.subidas || {};
      const yt = sub.yt ? { url: sub.yt.url, privacidad: sub.yt.privacidad || '' } : null;
      const ig = sub.ig && sub.ig.url ? { url: sub.ig.url } : null;
      const ancho = sub.yt16x9 ? { url: sub.yt16x9.url } : null;
      // "sin registrar" ≠ "sin publicar": el sudor y el hielo se subieron A MANO antes de que
      // existiera la API, así que están en vivo pero el manifiesto no los tiene. Marcarlos como
      // "falta YouTube" sería mentir — y un tablero que miente no sirve para ordenar nada.
      // EN VIVO = está en el catálogo de Comando O el manifiesto ya trae una subida registrada.
      // Solo con el catálogo, LA SILLA salía 'sin publicar' mientras enseñaba sus chips de
      // YouTube e Instagram — el tablero se contradecía a sí mismo (cazado a ojo en la captura).
      const enVivo = !!(pieza && ids.has(pieza)) || !!(sub.yt || sub.ig);
      const falta = [];
      if (d.estado === 'hecho' || d.estado === 'hoy') {
        if (!yt && !ig) falta.push(enVivo ? 'sin registrar' : 'sin publicar');
        else {
          if (!yt) falta.push('YouTube');
          else if (yt.privacidad && yt.privacidad !== 'public') falta.push(`YouTube ${yt.privacidad}`);
          if (!ig) falta.push('Instagram');
        }
        if (!ancho) falta.push('16:9');
      }
      return { ...d, manifiesto: fs.existsSync(mp), publicado: enVivo,
               yt, ig, ancho, entregado: pub.entregado_ig?.rendition || '', falta };
    });
    const hoy = dias.filter((d) => d.estado === 'hoy');
    if (hoy.length > 1) violaciones.push(`CINE: hay ${hoy.length} videos marcados "hoy" — es UNO por día`);
    return { nota: cr.nota || '', dias };
  } catch { return null; }
})();

const json = {
  nombre: 'TEMIS', generado: new Date().toISOString().slice(0, 16).replace('T', ' '),
  wip: WIP, conteo: { proximo: proximo.length, enCurso: enCursoTapa.length, imprevisto: imprevistos.length, supertickets: enCurso.length - enCursoTapa.length, cerrado: cerrado.length, probado: probadas.length, porProbar: cerrado.filter((t) => t.revisable && !t.falla).length, sinDesplegar: [...cerrado, ...probadas].filter((t) => t.despliegue === 'sin-desplegar').length, despues: despues.length },
  deploy: DEPLOY ? { commit: DEPLOY.commit, fecha: DEPLOY.fecha } : null,
  violaciones, columnas: { proximo, imprevisto: imprevistos, enCurso, cerrado, probado: probadas }, despues,
  cine, caminos,
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(json, null, 1));

const _sd = [...cerrado, ...probadas].filter((t) => t.despliegue === 'sin-desplegar').length;
if (_sd > 0) console.log(`  ⬆ ${_sd} cerrada(s) SIN DESPLEGAR — coordina el deploy (nunca dos a la vez)`);
console.log(`TEMIS · próximo ${proximo.length}/${WIP.proximo} · imprevistos ${imprevistos.length}/${WIP.imprevisto} · en curso ${enCursoTapa.length}/${WIP.enCurso}${enCurso.length - enCursoTapa.length ? ` (+${enCurso.length - enCursoTapa.length} superticket)` : ''} · cerrado ${cerrado.length} (${revisables} con evidencia visual) · probado ${probadas.length} · después ${despues.length}`);
for (const t of proximo) console.log(`  ${String(t.prioridad).padStart(2)} · ${t.titulo}`);
for (const t of imprevistos) console.log(`  ⚡ IMPREVISTO · ${t.titulo}${t.superticket ? ` · superticket ${t.progreso.verdes}/${t.progreso.total} ejercicios` : ''}`);
for (const t of enCurso) console.log(`  ▶ EN CURSO · ${t.titulo}${t.superticket ? ` · superticket ${t.progreso.verdes}/${t.progreso.total} ejercicios${t.progreso.rojos ? ` · ${t.progreso.rojos} rojo` : ''}` : ''}`);
for (const c of caminos) console.log(`  ⚭ CAMINO · ${c.titulo} · ${c.verdes}/${c.total} ✓${c.rompeEn ? ` · se rompe en el paso ${c.rompeEn}` : ''}`);
for (const v of violaciones) console.log(`  ✘ ${v}`);
console.log(`→ ${path.relative(REPO, OUT)}`);
process.exit(violaciones.length ? 1 : 0);
