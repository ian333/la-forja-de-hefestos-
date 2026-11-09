/**
 * forja-disenos — LAS VERSIONES de los diseños de La Forja (como Fusion: Ctrl+S = versión nueva, nada se sobrescribe).
 * Vive en rhea (disco de 5.5 TB en /mnt/hdd); ATLAS le pasa /api/disenos/ (deploy/nginx-forja.conf).
 *
 *   GET  /salud          → {ok}                                   (sin clave)
 *   GET  /               → [{slug, nombre, n, fecha}]              todos los diseños, el más reciente primero
 *   GET  /<slug>         → {slug, nombre, versiones:[{v, fecha, bytes, archivo}]}
 *   GET  /<slug>/<v>     → el documento (DocState) tal cual se guardó
 *   POST /<slug>         → guarda el cuerpo como versión nueva → {slug, v, fecha, bytes}
 *
 * Todo (menos /salud) pide la cabecera x-forja-clave = FORJA_CLAVE: el sitio es público y esto escribe en disco.
 * Disco: DATA/<slug>/v0001.json … + indice.json (escritura atómica: tmp + rename). Sin dependencias: http + fs.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = parseInt(process.env.PORT || '8091', 10);
const DATA = process.env.DATA || '/data';
const CLAVE = process.env.FORJA_CLAVE || '';
const MAX = 40 * 1024 * 1024;        // 40 MB por versión (un STEP importado viaja dentro del documento)
const CUOTA = 50 * 1024 ** 3;        // 50 GB en total: más que eso ya no es un diseño, es un abuso
const SLUG = /^[a-z0-9][a-z0-9-]{0,79}$/;

if (!CLAVE) { console.error('forja-disenos: falta FORJA_CLAVE'); process.exit(1); }
fs.mkdirSync(DATA, { recursive: true });

function claveOk(h) {
  const a = Buffer.from(String(h || '')), b = Buffer.from(CLAVE);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function enviar(res, code, cuerpo) {
  const body = Buffer.isBuffer(cuerpo) || typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, x-forja-clave',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
  });
  res.end(body);
}
const indicePath = (slug) => path.join(DATA, slug, 'indice.json');
function leerIndice(slug) {
  try { return JSON.parse(fs.readFileSync(indicePath(slug), 'utf8')); } catch { return null; }
}
function escribirAtomico(f, data) {
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, f);
}
let usado = null;   // bytes en disco: se mide una vez al primer guardado y luego se lleva la cuenta
function bytesUsados() {
  if (usado != null) return usado;
  usado = 0;
  for (const s of fs.readdirSync(DATA)) {
    const d = path.join(DATA, s);
    if (!fs.statSync(d).isDirectory()) continue;
    for (const f of fs.readdirSync(d)) usado += fs.statSync(path.join(d, f)).size;
  }
  return usado;
}

function listar() {
  const out = [];
  for (const s of fs.readdirSync(DATA)) {
    if (!SLUG.test(s)) continue;
    const idx = leerIndice(s);
    const ult = idx?.versiones?.[idx.versiones.length - 1];
    if (ult) out.push({ slug: s, nombre: idx.nombre, n: ult.v, fecha: ult.fecha });
  }
  return out.sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

function guardar(slug, buf, res) {
  let doc;
  try { doc = JSON.parse(buf.toString('utf8')); } catch { return enviar(res, 400, { error: 'no es JSON' }); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc) || typeof doc.name !== 'string') {
    return enviar(res, 400, { error: 'no es un documento de La Forja' });
  }
  if (bytesUsados() + buf.length > CUOTA) return enviar(res, 507, { error: 'cuota llena' });
  const dir = path.join(DATA, slug);
  fs.mkdirSync(dir, { recursive: true });
  const idx = leerIndice(slug) || { slug, nombre: doc.name, versiones: [] };
  const v = (idx.versiones.length ? idx.versiones[idx.versiones.length - 1].v : 0) + 1;
  const archivo = `v${String(v).padStart(4, '0')}.json`;
  const fecha = new Date().toISOString();
  escribirAtomico(path.join(dir, archivo), buf);
  idx.nombre = doc.name;
  idx.versiones.push({ v, fecha, bytes: buf.length, archivo });
  escribirAtomico(indicePath(slug), JSON.stringify(idx));
  usado += buf.length;
  console.log(`${fecha} ${slug} v${v} ${buf.length} B`);
  return enviar(res, 200, { slug, v, fecha, bytes: buf.length });
}

const srv = http.createServer((req, res) => {
  try {
    if (req.method === 'OPTIONS') return enviar(res, 204, '');
    const partes = new URL(req.url, 'http://x').pathname.split('/').filter(Boolean);
    if (partes[0] === 'salud') return enviar(res, 200, { ok: true });
    if (!claveOk(req.headers['x-forja-clave'])) return enviar(res, 401, { error: 'clave' });
    const [slug, ver, sobra] = partes;
    if (sobra !== undefined || (slug && !SLUG.test(slug))) return enviar(res, 400, { error: 'ruta' });

    if (req.method === 'GET') {
      if (!slug) return enviar(res, 200, listar());
      const idx = leerIndice(slug);
      if (!idx) return enviar(res, 404, { error: 'no hay versiones' });
      if (ver === undefined) return enviar(res, 200, idx);
      const e = idx.versiones.find((x) => x.v === parseInt(ver, 10));
      if (!e) return enviar(res, 404, { error: 'no existe esa versión' });
      return enviar(res, 200, fs.readFileSync(path.join(DATA, slug, e.archivo)));
    }

    if (req.method === 'POST' && slug && ver === undefined) {
      const trozos = [];
      let n = 0, roto = false;
      req.on('data', (c) => {
        if (roto) return;
        n += c.length;
        if (n > MAX) { roto = true; enviar(res, 413, { error: 'más de 40 MB' }); req.destroy(); return; }
        trozos.push(c);
      });
      req.on('end', () => {
        if (roto) return;
        try { guardar(slug, Buffer.concat(trozos), res); } catch (e) { console.error(e); enviar(res, 500, { error: String(e.message || e) }); }
      });
      req.on('error', () => {});
      return;
    }
    return enviar(res, 405, { error: 'método' });
  } catch (e) {
    console.error(e);
    return enviar(res, 500, { error: String(e.message || e) });
  }
});
srv.listen(PORT, () => console.log(`forja-disenos :${PORT} → ${DATA}`));
