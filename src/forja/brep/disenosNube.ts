/**
 * LAS VERSIONES EN RHEA — como Fusion: Ctrl+S guarda una versión NUEVA del documento (nada se sobrescribe) y el
 * dropdown junto al nombre abre cualquiera. El servidor es disenos-service/server.cjs (contenedor forja_disenos en
 * rhea, disco /mnt/hdd/forja-disenos); ATLAS le pasa /api/disenos/ (deploy/nginx-forja.conf).
 * El diseño se identifica por su NOMBRE (slug): renombrar = diseño nuevo.
 * La clave (cabecera x-forja-clave) se pide UNA vez por navegador y vive en localStorage.
 */
const BASE = '/api/disenos';
const CLAVE_KEY = 'forja:clave-disenos';

export interface VersionNube { v: number; fecha: string; bytes: number }
export interface DisenoNube { slug: string; nombre: string; n: number; fecha: string }

/** «LABORATORIO v2 · generado» → «laboratorio-v2-generado» (lo mismo que acepta el servidor). */
export function slugDe(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 80).replace(/-+$/, '') || 'sin-nombre';
}

function leerClave(): string | null {
  try { return localStorage.getItem(CLAVE_KEY); } catch { return null; }
}
function clave(preguntar: boolean): string | null {
  let k = leerClave();
  if (!k && preguntar) {
    k = window.prompt('Clave de La Forja para guardar en rhea (se pide una sola vez en este navegador):')?.trim() || null;
    if (k) { try { localStorage.setItem(CLAVE_KEY, k); } catch { /* navegación privada: se pedirá otra vez */ } }
  }
  return k;
}
export const hayClave = () => !!leerClave();

/** fetch con la clave; 404 se devuelve (el diseño aún no tiene versiones), lo demás que no sea 2xx es error. */
async function pedir(ruta: string, init: RequestInit = {}, preguntar = true): Promise<Response> {
  const k = clave(preguntar);
  if (!k) throw new Error('sin clave');
  const r = await fetch(BASE + ruta, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), 'x-forja-clave': k } });
  if (r.status === 401) { try { localStorage.removeItem(CLAVE_KEY); } catch { /* */ } throw new Error('clave equivocada'); }
  if (!r.ok && r.status !== 404) {
    let msg = `rhea respondió ${r.status}`;
    try { const j = await r.json(); if (j?.error) msg += `: ${j.error}`; } catch { /* no era JSON (502 de nginx: rhea apagada) */ }
    throw new Error(msg);
  }
  return r;
}

export async function guardarVersion(doc: { name: string }): Promise<{ slug: string; v: number; fecha: string; bytes: number }> {
  const r = await pedir('/' + slugDe(doc.name), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(doc),
  });
  if (r.status === 404) throw new Error('rhea respondió 404');
  return r.json();
}

/** Las versiones del diseño con ese nombre ([] si no tiene). Sin clave guardada no pregunta: devuelve []. */
export async function versionesDe(nombre: string): Promise<VersionNube[]> {
  if (!hayClave()) return [];
  const r = await pedir('/' + slugDe(nombre), {}, false);
  if (r.status === 404) return [];
  const j = await r.json();
  return Array.isArray(j?.versiones) ? j.versiones : [];
}

export async function abrirVersion<T>(nombre: string, v: number): Promise<T> {
  const r = await pedir(`/${slugDe(nombre)}/${v}`);
  if (r.status === 404) throw new Error(`no existe la v${v}`);
  return r.json();
}

/** Todos los diseños guardados en rhea (para el lobby). Sin clave: []. */
export async function listarDisenos(): Promise<DisenoNube[]> {
  if (!hayClave()) return [];
  const r = await pedir('/', {}, false);
  if (r.status === 404) return [];
  const j = await r.json();
  return Array.isArray(j) ? j : [];
}

/** «2026-11-09T21:10:11Z» → «9 nov 15:10» (hora local). */
export function fechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const mes = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()];
  return `${d.getDate()} ${mes} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
