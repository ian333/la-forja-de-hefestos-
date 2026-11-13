#!/usr/bin/env node
/**
 * PRODUCCIÓN-MODELOS-VERIFY — lo PUBLICADO es lo del repo (sin navegador; se corre después de cada despliegue).
 * ============================================================================
 * Nació del 2026-11-12: producción servía 16 mallas del laboratorio de una semana atrás. nginx marca todo `.bin` como
 * «inmutable 30 días» (regla hecha para archivos con hash en el nombre) y las de /modelos/ no llevan hash: Cloudflare y
 * el navegador se quedaban con la vieja. Las nueve suites pasaban porque corrían contra la copia de desarrollo.
 *
 * Qué hace: por cada archivo RASTREADO en `public/modelos/` compara, byte a byte (md5), lo de HEAD contra lo que sirve
 * producción POR LA DIRECCIÓN QUE USA EL ESTUDIO: las mallas `.bin` con el sello de `/temis-deploy.json` (`?v=<sello>`,
 * igual que `selloDeModelos` en ForgeBRepStudio.tsx) y lo demás tal cual. Además dice cuántas saldrían viejas SIN el
 * sello (lo que ve un bundle anterior al arreglo, o cualquier otro que pida la dirección pelona).
 *
 * Uso:  node scripts/produccion-modelos-verify.cjs            (BASE=https://university.gaiaprime.com.mx)
 * Salida: lista de diferencias + `PRODUCCION_MODELOS: PASA|FALLA (iguales/total)` · exit 0/1.
 */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const BASE = (process.env.BASE || 'https://university.gaiaprime.com.mx').replace(/\/$/, '');
const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
const git = (args) => execFileSync('git', args, { cwd: REPO, maxBuffer: 256 * 1024 * 1024 });
const bajar = async (url) => {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) return { status: r.status, md5: null, cf: r.headers.get('cf-cache-status'), edad: r.headers.get('age') };
  return { status: r.status, md5: md5(Buffer.from(await r.arrayBuffer())), cf: r.headers.get('cf-cache-status'), edad: r.headers.get('age') };
};

(async () => {
  const archivos = git(['ls-files', 'public/modelos']).toString().split('\n').filter(Boolean);
  const sucios = git(['status', '--porcelain', '--', 'public/modelos']).toString().trim();
  if (sucios) console.log('OJO: hay cambios sin commitear en public/modelos (se compara contra HEAD, que es lo que se despliega):\n' + sucios);
  const dep = await fetch(`${BASE}/temis-deploy.json`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const sello = dep ? `${dep.commit ?? ''}-${dep.fecha ?? ''}`.replace(/[^\w.-]+/g, '') : '';
  const head = git(['rev-parse', '--short', 'HEAD']).toString().trim();
  console.log(`producción: ${BASE} · desplegado ${dep ? `${dep.commit} (${dep.fecha} UTC)` : '¿? (sin temis-deploy.json)'} · HEAD ${head} · ${archivos.length} archivos`);
  if (dep && dep.commit !== head) console.log(`OJO: producción trae ${dep.commit} y HEAD es ${head}: lo que difiera puede ser simplemente lo que falta desplegar.`);

  let iguales = 0; const malas = []; const viejasSinSello = [];
  const cola = [...archivos];
  const uno = async (f) => {
    const url = `${BASE}/${f.replace(/^public\//, '')}`;
    const local = md5(git(['show', `HEAD:${f}`]));
    const esMalla = f.endsWith('.bin');
    const r = await bajar(esMalla && sello ? `${url}?v=${sello}` : url);
    if (r.md5 === local) iguales++; else malas.push({ f, status: r.status, cf: r.cf, edad: r.edad });
    if (esMalla) { const p = await bajar(url); if (p.md5 !== local) viejasSinSello.push({ f, edad: p.edad, cf: p.cf }); }
  };
  await Promise.all(Array.from({ length: 6 }, async () => { while (cola.length) await uno(cola.shift()); }));

  for (const m of malas.sort((a, b) => a.f.localeCompare(b.f))) console.log(`DISTINTO  ${m.f} · HTTP ${m.status} · cf ${m.cf ?? '—'} · edad ${m.edad ?? '—'} s`);
  if (viejasSinSello.length) {
    const dias = Math.max(...viejasSinSello.map((v) => +v.edad || 0)) / 86400;
    console.log(`sin el sello, ${viejasSinSello.length} mallas salen VIEJAS del caché (la más vieja lleva ${dias.toFixed(1)} días): ${viejasSinSello.map((v) => path.basename(v.f)).sort().join(', ')}`);
  } else console.log('sin el sello tampoco sale ninguna malla vieja.');
  const pasa = malas.length === 0 && !!sello;
  if (!sello) console.log('FALLA: producción no entrega /temis-deploy.json: el estudio pediría las mallas sin sello.');
  console.log(`\nPRODUCCION_MODELOS: ${pasa ? 'PASA' : 'FALLA'} (${iguales}/${archivos.length})`);
  process.exit(pasa ? 0 : 1);
})().catch((e) => { console.log('EXCEPCIÓN ' + String(e).slice(0, 300)); process.exit(1); });
