/**
 * forja-telemetry — servicio chiquito que captura TODO lo que pasa en el
 * navegador de los usuarios viendo La Forja.
 *
 *   POST /events     → cliente manda batch de eventos (JSON array)
 *   GET  /           → HTML dashboard: últimos N eventos
 *   GET  /raw        → JSONL crudo (descargable)
 *   GET  /clear      → borra el log (require token)
 *   GET  /tail       → SSE stream en vivo
 *
 * Storage: append-only JSONL en /mnt/hdd/forja-telemetry/events.jsonl
 *   (gira al pasar 100MB; mantiene .1 .2 .3 históricos)
 *
 * Sin deps externos — solo `http` y `fs` de Node.
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

const PORT       = parseInt(process.env.PORT || '8002', 10);
const STORE_DIR  = process.env.STORE_DIR || '/mnt/hdd/forja-telemetry';
const LOG_FILE   = path.join(STORE_DIR, 'events.jsonl');
const MAX_BYTES  = 100 * 1024 * 1024;  // 100 MB antes de rotar
const CLEAR_TOKEN = process.env.CLEAR_TOKEN || 'forja-2026';

fs.mkdirSync(STORE_DIR, { recursive: true });

// ── State ────────────────────────────────────────────────────────────
let sseClients = [];   // { id, res }
let nextId = 1;
let totalEvents = 0;

// Si el archivo ya existe, contamos las líneas
try {
  const data = fs.readFileSync(LOG_FILE, 'utf8');
  totalEvents = data.split('\n').filter(Boolean).length;
} catch (_) { /* doesn't exist yet */ }

// ── Helpers ──────────────────────────────────────────────────────────
function clientIP(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
    .toString().split(',')[0].trim();
}

function rotateIfNeeded() {
  try {
    const st = fs.statSync(LOG_FILE);
    if (st.size > MAX_BYTES) {
      for (let i = 3; i >= 1; i--) {
        const src = `${LOG_FILE}.${i}`;
        const dst = `${LOG_FILE}.${i+1}`;
        if (fs.existsSync(src)) fs.renameSync(src, dst);
      }
      fs.renameSync(LOG_FILE, `${LOG_FILE}.1`);
    }
  } catch (_) { /* no file yet */ }
}

function appendEvent(ev) {
  rotateIfNeeded();
  fs.appendFileSync(LOG_FILE, JSON.stringify(ev) + '\n');
  totalEvents++;
  // Notify SSE clients
  const payload = `data: ${JSON.stringify(ev)}\n\n`;
  sseClients.forEach(c => { try { c.res.write(payload); } catch (_) {} });
}

function readBody(req, maxBytes = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > maxBytes) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function tailLines(file, n) {
  if (!fs.existsSync(file)) return [];
  const data = fs.readFileSync(file, 'utf8');
  const lines = data.split('\n').filter(Boolean);
  return lines.slice(-n);
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

// ── Dashboard HTML ──────────────────────────────────────────────────
function dashboard(filter) {
  const lines = tailLines(LOG_FILE, 500);
  const events = lines.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);

  const filtered = filter
    ? events.filter(e => JSON.stringify(e).toLowerCase().includes(filter.toLowerCase()))
    : events;

  const recent = filtered.slice(-200).reverse();

  const rows = recent.map(e => {
    const t = new Date(e.t).toISOString().replace('T', ' ').slice(0, 19);
    const type = e.type || '?';
    const ip = e.ip || '-';
    const url = (e.url || '').replace(/^https?:\/\/[^/]+/, '');
    const sid = (e.sid || '').slice(0, 8);
    const detail = JSON.stringify(e.data || {}, null, 0).slice(0, 400);
    const color = type === 'error' ? '#f87171'
      : type === 'rejection' ? '#fb923c'
      : type === 'console_error' ? '#fbbf24'
      : type === 'http_error' ? '#f472b6'
      : type === 'click' ? '#a78bfa'
      : type === 'scene_change' ? '#22d3ee'
      : type === 'pageview' ? '#34d399'
      : '#94a3b8';
    return `<tr>
      <td style="color:#64748b">${t}</td>
      <td style="color:${color};font-weight:600">${type}</td>
      <td style="color:#64748b">${ip}</td>
      <td style="color:#94a3b8">${sid}</td>
      <td style="color:#cbd5e1">${url}</td>
      <td style="color:#e2e8f0;font-family:monospace;font-size:11px">${escapeHtml(detail)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>forja-telemetry · ${totalEvents} eventos</title>
<style>
  body { background: #0a0e1a; color: #e2e8f0; font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 20px; }
  h1 { font-size: 14px; color: #94a3b8; margin: 0 0 12px; }
  .bar { display: flex; gap: 12px; margin-bottom: 16px; font-size: 12px; }
  input { background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 4px; width: 300px; font-family: monospace; }
  button { background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 6px 12px; border-radius: 4px; cursor: pointer; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  td { padding: 4px 8px; border-bottom: 1px solid #1e293b; vertical-align: top; }
  td:last-child { word-break: break-all; max-width: 600px; }
  .stat { color: #94a3b8; }
  .stat strong { color: #e2e8f0; }
</style>
</head>
<body>
<h1>forja-telemetry · <span class="stat"><strong>${totalEvents}</strong> total · mostrando <strong>${recent.length}</strong> filtrados</span></h1>
<form class="bar" method="get">
  <input type="text" name="q" placeholder="filtrar (texto en evento)..." value="${escapeHtml(filter || '')}" autofocus />
  <button type="submit">filtrar</button>
  <a href="/" style="color:#94a3b8;text-decoration:none;padding:6px 12px;border:1px solid #334155;border-radius:4px">limpiar</a>
  <a href="/raw" style="color:#94a3b8;text-decoration:none;padding:6px 12px;border:1px solid #334155;border-radius:4px">crudo JSONL</a>
  <span class="stat" style="margin-left:auto;align-self:center">auto-refresh 5s</span>
</form>
<table>
  <thead><tr style="color:#64748b;font-size:11px;text-align:left;border-bottom:1px solid #334155">
    <th style="padding:4px 8px">tiempo</th><th style="padding:4px 8px">tipo</th><th style="padding:4px 8px">ip</th><th style="padding:4px 8px">sid</th><th style="padding:4px 8px">url</th><th style="padding:4px 8px">data</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
<script>
  setTimeout(() => location.reload(), 5000);
</script>
</body>
</html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[<>&"]/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' }[c]));
}

// ── Server ──────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const route = parsed.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }

  try {
    if (route === '/events' && req.method === 'POST') {
      const body = await readBody(req);
      let payload;
      try { payload = JSON.parse(body); } catch { return send(res, 400, 'bad json'); }
      const events = Array.isArray(payload) ? payload : [payload];
      const ip = clientIP(req);
      const recvT = Date.now();
      for (const e of events) {
        if (!e || typeof e !== 'object') continue;
        const ev = {
          id: nextId++,
          t: e.t || recvT,
          rt: recvT,
          ip,
          ua: req.headers['user-agent'] || '',
          type: String(e.type || 'unknown').slice(0, 32),
          sid: String(e.sid || '').slice(0, 64),
          url: String(e.url || '').slice(0, 1024),
          data: e.data || {},
        };
        appendEvent(ev);
      }
      return send(res, 200, JSON.stringify({ ok: true, n: events.length }), 'application/json');
    }

    if (route === '/' && req.method === 'GET') {
      return send(res, 200, dashboard(parsed.query.q || ''), 'text/html; charset=utf-8');
    }

    if (route === '/raw' && req.method === 'GET') {
      if (!fs.existsSync(LOG_FILE)) return send(res, 200, '');
      const data = fs.readFileSync(LOG_FILE, 'utf8');
      return send(res, 200, data, 'application/x-ndjson');
    }

    if (route === '/tail' && req.method === 'GET') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      const id = nextId++;
      sseClients.push({ id, res });
      const heartbeat = setInterval(() => { try { res.write(': hb\n\n'); } catch (_) {} }, 15000);
      req.on('close', () => {
        clearInterval(heartbeat);
        sseClients = sseClients.filter(c => c.id !== id);
      });
      res.write(`: connected · total=${totalEvents}\n\n`);
      return;
    }

    if (route === '/clear' && req.method === 'GET') {
      if (parsed.query.token !== CLEAR_TOKEN) return send(res, 403, 'bad token');
      try { fs.unlinkSync(LOG_FILE); } catch (_) {}
      totalEvents = 0;
      return send(res, 200, 'cleared');
    }

    if (route === '/health' && req.method === 'GET') {
      return send(res, 200, JSON.stringify({ ok: true, total: totalEvents, sse_clients: sseClients.length }), 'application/json');
    }

    send(res, 404, 'not found');
  } catch (err) {
    console.error('handler error', err);
    send(res, 500, 'server error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`forja-telemetry listening on :${PORT} · store=${STORE_DIR} · loaded ${totalEvents} prior events`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT',  () => server.close(() => process.exit(0)));
