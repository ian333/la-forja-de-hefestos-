#!/usr/bin/env node
/**
 * LAS PIEZAS ROTAS A PROPÓSITO (orden 2026-10-24-d-el-qa-real, punto 3)
 * ============================================================================
 * Fabrica los fixtures de `test-parts/rotos/` DERIVADOS de piezas sanas del repo, cada uno con su ORÁCULO escrito (qué DEBE
 * hacer La Forja al soltarlo) y con su defecto MEDIDO por la matrícula (`matricula.ts`, la misma que la orden C cablea al soltar):
 *   00-sana-box.stl          la 1594C Box tal cual (CONTROL: la puerta NO debe rechazarla — sin él, una puerta que dice «no» a
 *                            todo STL cumpliría los cuatro oráculos de abajo)
 *   01-abierta.stl           la misma con UN triángulo borrado (el de mayor área): malla abierta (red team #4)
 *   02-normales-invertidas.stl  todas las caras con el devanado al revés: volumen con signo NEGATIVO (red team #3; hoy
 *                            `meshVolumeArea` usa |vol6| y pasa muda)
 *   03-pulgadas.stl          la misma ÷ 25.4: 4.19 × 2.6 × 1.31 «mm» (red team #2: «molde para un grano de arroz»)
 *   04-dos-cuerpos.stl       caja + tapa (1594C Lid) en UN archivo, lado a lado (red team #5; `stl.ts` fija `solidos: 1`)
 *   05-tapa-snaps.stp        la 1594C Lid TAL CUAL: contrasalidas (snaps), hoy «con-mecanismos» y aun así molde de 2 placas
 *                            con precio (red team (h)1; juez C §1.8)
 * La malla sale del MISMO cargador que usa la app al soltar un STEP (`mallaDesdeArchivo`, tesela 0.1/0.5) corriendo en node;
 * un STL es un archivo: la app lo lee con `parseSTL` tal cual, así que aquí no importa que node tesele distinto que el
 * navegador (juez C, D4) — el fixture ES el archivo. Al terminar se RE-LEE cada STL con `parseSTL` y se le corre la matrícula:
 * si un fixture no trae el defecto que dice traer (o la sana trae uno), el script sale con 1 y no deja oráculos falsos.
 *
 * uso (iangpu; arranca OCCT en node, ~30 s):  cd /home/ian/Orkesta/la-forja && node --import tsx scripts/qa-fabrica-rotos.cjs [--out test-parts/rotos]
 *   (desde una copia forja-devN: `--out /home/ian/el-plan-devN/rotos` — su test-parts es el del repo principal)
 * Es DETERMINISTA: correrlo dos veces deja los mismos bytes (el banco cita el sha256 de cada fixture).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
// OJO en iangpu: en las copias forja-devN `test-parts` es un symlink al repo PRINCIPAL — ahí no se escribe: usa --out a tu carpeta
const OUT = path.resolve(REPO, argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'test-parts/rotos');
const BOX = path.join(REPO, 'test-parts/inyeccion-reales/1594C Box.stp');
const LID = path.join(REPO, 'test-parts/inyeccion-reales/1594C Lid.stp');

/** STL binario: 80 bytes de encabezado + n + (normal, 3 vértices, attr) por triángulo; la normal es la de la cara (b−a)×(c−a) */
function escribeSTL(archivo, P, I, encabezado) {
  const n = I.length / 3; const buf = Buffer.alloc(84 + 50 * n);
  buf.write(encabezado.slice(0, 79).padEnd(80, ' '), 0, 'ascii'); buf.writeUInt32LE(n, 80);
  for (let t = 0; t < n; t++) {
    const o = 84 + 50 * t; const v = [3 * I[3 * t], 3 * I[3 * t + 1], 3 * I[3 * t + 2]];
    const ux = P[v[1]] - P[v[0]], uy = P[v[1] + 1] - P[v[0] + 1], uz = P[v[1] + 2] - P[v[0] + 2];
    const wx = P[v[2]] - P[v[0]], wy = P[v[2] + 1] - P[v[0] + 1], wz = P[v[2] + 2] - P[v[0] + 2];
    let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    buf.writeFloatLE(nx, o); buf.writeFloatLE(ny, o + 4); buf.writeFloatLE(nz, o + 8);
    for (let k = 0; k < 3; k++) for (let c = 0; c < 3; c++) buf.writeFloatLE(P[v[k] + c], o + 12 + 12 * k + 4 * c);
    buf.writeUInt16LE(0, o + 48);
  }
  fs.writeFileSync(archivo, buf);
  return buf.length;
}
const areaTri = (P, I, t) => {
  const a = 3 * I[3 * t], b = 3 * I[3 * t + 1], c = 3 * I[3 * t + 2];
  const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
  return Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 2;
};
const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const r = (v, d = 2) => (Number.isFinite(v) ? +v.toFixed(d) : v);

// las frases que un rechazo DEBE decir (regex, sin mayúsculas): amplias a propósito — la orden C elige sus palabras de taller;
// si las cambia, se AMPLÍA aquí con su razón, nunca se afloja para que pase un fixture
const DICE = {
  abierta: 'abiert|no cierra|no est[aá] cerrad|grieta|agujero|aristas? (abiertas?|sueltas?|de frontera|libres?)|no[- ]manifold',
  devanado: 'devanado|normales|al rev[eé]s|invertid|volumen negativo|hacia adentro|de adentro hacia afuera',
  pulgadas: 'pulgada',
  cuerpos: '\\b(2|dos)\\s+(cuerpos|s[oó]lidos|piezas|componentes|cascarones)\\b|cu[aá]l (moldeo|reviso|mido)',
  contrasalida: 'contrasalida|no salen? del molde en l[ií]nea recta|undercut',
};

(async () => {
  // OCCT en node — la receta de /home/ian/verif-piezas/verif-pieza.cjs (wasm del mismo node_modules que sirve la app)
  const distDir = path.join(REPO, 'node_modules', 'opencascade.js', 'dist');
  const occtFactory = require(path.join(distDir, 'opencascade.wasm.cjs'));
  const oc = await occtFactory({ wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  const K = await import(path.join(REPO, 'src/forja/brep/occt.ts'));
  K._setActiveOCCT(oc);
  const STL = await import(path.join(REPO, 'src/forja/mold/stl.ts'));
  const M = await import(path.join(REPO, 'src/forja/verificacion/matricula.ts'));
  const lee = async (f) => { const b = fs.readFileSync(f); return STL.mallaDesdeArchivo(path.basename(f), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); };
  fs.mkdirSync(OUT, { recursive: true });

  const box = await lee(BOX), lid = await lee(LID);
  const Pb = Array.from(box.mesh.positions), Ib = Array.from(box.mesh.indices);
  const Pl = Array.from(lid.mesh.positions), Il = Array.from(lid.mesh.indices);
  console.log(`1594C Box: ${Ib.length / 3} triángulos · ${box.notas.join(' · ')}`);
  console.log(`1594C Lid: ${Il.length / 3} triángulos · ${lid.notas.join(' · ')}`);
  const bbox = (P) => { const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], P[i + k]); mx[k] = Math.max(mx[k], P[i + k]); } return { mn, mx }; };
  const BB = bbox(Pb), BL = bbox(Pl);
  const deriva = `test-parts/inyeccion-reales/1594C Box.stp → mallaDesdeArchivo (src/forja/mold/stl.ts, tesela 0.1/0.5) en node`;
  const fixtures = [];

  // 00 · la sana (control)
  fixtures.push({ id: '00-sana-box', archivo: '00-sana-box.stl', P: Pb, I: Ib, deriva,
    defecto: 'ninguno: la 1594C Box tal cual, como STL',
    esperado: 'pasa', debe: 'La puerta la deja pasar: NO dice abierta, devanado, pulgadas ni varios cuerpos (puede avisar que con un STL solo revisa la pieza y que el molde pide el STEP: eso es información, no rechazo).',
    noDice: [DICE.abierta, DICE.devanado, DICE.pulgadas, DICE.cuerpos].join('|'),
    exige: (m) => m.cerrada && m.componentes === 1 && m.volumenConSigno > 0 && m.diagonal > 100,
    cita: 'par de control (juez C D4; qa-automation (h)2: ningún gate sin su caso sano)' });

  // 01 · abierta: se borra el triángulo de MAYOR área (el agujero más grande que cabe en uno)
  { let tMax = 0, aMax = -1; for (let t = 0; t < Ib.length / 3; t++) { const a = areaTri(Pb, Ib, t); if (a > aMax) { aMax = a; tMax = t; } }
    const I = Ib.slice(0, 3 * tMax).concat(Ib.slice(3 * tMax + 3));
    fixtures.push({ id: '01-abierta', archivo: '01-abierta.stl', P: Pb, I, deriva: `${deriva} · se borró el triángulo #${tMax} (${r(aMax)} mm², el de mayor área)`,
      defecto: `malla ABIERTA: un agujero de un triángulo (${r(aMax)} mm²) — el ray-cast por paridad de \`inside()\` miente y la pared p50 sale basura`,
      esperado: 'rechaza', debe: 'Al soltarla, la puerta dice que la malla está ABIERTA (no cierra: aristas sueltas) y pide repararla o el STEP; no mide pared ni enfriamiento sobre ella como si fuera sólida.',
      dice: DICE.abierta, exige: (m) => !m.cerrada && m.bordesFrontera === 3, cita: 'orden C §1 (cierre: aristas abiertas); red team (f)#4; matricula.ts bordesFrontera' }); }

  // 02 · normales invertidas: (a,b,c) → (a,c,b) en todas las caras
  { const I = []; for (let t = 0; t < Ib.length; t += 3) I.push(Ib[t], Ib[t + 2], Ib[t + 1]);
    fixtures.push({ id: '02-normales-invertidas', archivo: '02-normales-invertidas.stl', P: Pb, I, deriva: `${deriva} · cada cara (a,b,c) → (a,c,b)`,
      defecto: 'todas las normales hacia ADENTRO: el volumen con signo sale negativo; `meshVolumeArea` (revisar-modelo.ts:46) usa |vol6| y la deja pasar muda',
      esperado: 'rechaza', debe: 'La puerta dice que la malla viene al revés (normales/devanado invertido, volumen negativo) y la rechaza o la voltea DICIÉNDOLO; no la mide en silencio.',
      dice: DICE.devanado, exige: (m) => m.cerrada && m.volumenConSigno < 0, cita: 'orden C §1 (devanado); red team (f)#3; matricula.ts volumenConSigno' }); }

  // 03 · pulgadas: ÷ 25.4
  { const P = Pb.map((v) => v / 25.4);
    fixtures.push({ id: '03-pulgadas', archivo: '03-pulgadas.stl', P, I: Ib, deriva: `${deriva} · cada coordenada ÷ 25.4 (la caja exportada en pulgadas)`,
      defecto: `la caja de ${r(BB.mx[0] - BB.mn[0], 1)} × ${r(BB.mx[1] - BB.mn[1], 1)} × ${r(BB.mx[2] - BB.mn[2], 1)} mm llega como ${r((BB.mx[0] - BB.mn[0]) / 25.4)} × ${r((BB.mx[1] - BB.mn[1]) / 25.4)} × ${r((BB.mx[2] - BB.mn[2]) / 25.4)} «mm»`,
      esperado: 'pregunta', debe: 'La puerta pregunta «¿está en pulgadas?» (×25.4) antes de medir; no arma un dictamen para un grano de arroz. OJO (medido al fabricarla): su diagonal es 5.10 mm — la regla «diagonal < 5 mm» (orden C §3, red team (e)) NO la caza: esta caja ES el ejemplo del red team y queda 0.1 mm arriba del umbral.',
      dice: DICE.pulgadas,
      // el defecto es la ESCALA, no un umbral de nadie: la diagonal debe ser la de la sana ÷ 25.4 (±0.1 %)
      exige: (m) => m.cerrada && Math.abs(m.diagonal * 25.4 / Math.hypot(BB.mx[0] - BB.mn[0], BB.mx[1] - BB.mn[1], BB.mx[2] - BB.mn[2]) - 1) < 1e-3,
      cita: 'orden C §3 (unidades); red team (f)#2' }); }

  // 04 · dos cuerpos: caja + tapa lado a lado (la tapa se corre en +X a 20 mm de la caja)
  { const dx = BB.mx[0] - BL.mn[0] + 20; const P = Pb.concat(Pl.map((v, i) => (i % 3 === 0 ? v + dx : v))); const nb = Pb.length / 3;
    const I = Ib.concat(Il.map((k) => k + nb));
    fixtures.push({ id: '04-dos-cuerpos', archivo: '04-dos-cuerpos.stl', P, I,
      deriva: `${deriva} + test-parts/inyeccion-reales/1594C Lid.stp (misma ruta) corrida ${r(dx)} mm en +X`,
      defecto: 'DOS cuerpos (caja + tapa) en un STL: `stl.ts` fija `solidos: 1` y se miden como una sola pieza',
      esperado: 'pregunta', debe: 'La puerta dice que el archivo trae 2 cuerpos y pregunta cuál se revisa/moldea (con su volumen y su caja); no mide el conjunto como una pieza.',
      dice: DICE.cuerpos, exige: (m) => m.cerrada && m.componentes === 2, cita: 'orden C §2 (cuerpos); red team (f)#5' }); }

  // ── escribir + re-leer con el parser DE LA APP + matrícula ──
  let fallos = 0; const indice = [];
  for (const f of fixtures) {
    const dest = path.join(OUT, f.archivo);
    const bytes = escribeSTL(dest, f.P, f.I, `La Forja QA fixture ${f.id} (orden D 2026-10-24)`);
    const b = fs.readFileSync(dest); const mesh = STL.parseSTL(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const m = M.matriculaDeMalla(mesh);
    const medido = { triangulos: m.triangulos, cerrada: m.cerrada, bordesFrontera: m.bordesFrontera, bordesNoManifold: m.bordesNoManifold, devanadoCoherente: m.devanadoCoherente,
      componentes: m.componentes, chi: m.chi, genero: m.generoValido ? m.genero : null, volumenConSigno: r(m.volumenConSigno), areaTotal: r(m.areaTotal),
      diagonal: r(m.diagonal), bbox: [r(m.bbox.x1 - m.bbox.x0), r(m.bbox.y1 - m.bbox.y0), r(m.bbox.z1 - m.bbox.z0)] };
    const ok = f.exige(m);
    if (!ok) fallos++;
    console.log(`${ok ? '✓' : '❌'} ${f.archivo.padEnd(28)} ${String(bytes).padStart(8)} B · cerrada ${m.cerrada} · frontera ${m.bordesFrontera} · componentes ${m.componentes} · vol ${r(m.volumenConSigno, 1)} · diag ${r(m.diagonal)}`);
    const o = { id: f.id, archivo: f.archivo, sha256: sha256(dest), bytes, deriva: f.deriva, defecto: f.defecto, medido, esperado: f.esperado, debe: f.debe,
      ...(f.dice ? { dice: f.dice } : {}), ...(f.noDice ? { noDice: f.noDice } : {}), cita: f.cita, fabricado: 'scripts/qa-fabrica-rotos.cjs' };
    fs.writeFileSync(path.join(OUT, `${f.id}.oraculo.json`), JSON.stringify(o, null, 1) + '\n');
    indice.push(f.id);
  }
  // 05 · la tapa con snaps TAL CUAL (un STEP: el molde sí se intenta)
  { const dest = path.join(OUT, '05-tapa-snaps.stp'); fs.copyFileSync(LID, dest);
    const o = { id: '05-tapa-snaps', archivo: '05-tapa-snaps.stp', sha256: sha256(dest), bytes: fs.statSync(dest).size,
      deriva: 'copia byte a byte de test-parts/inyeccion-reales/1594C Lid.stp',
      defecto: 'contrasalidas: los snaps de la tapa no salen en línea recta; el DFM ya la marca «con-mecanismos» (intake.json) y aun así se arma molde de 2 placas viable con precio (US$31,464 en el arnés)',
      medido: { moldeableDFM: 'con-mecanismos (test-parts/inyeccion-reales/intake.json, 1594C Lid#0)', triangulos: lid.mesh.indices.length / 3 },
      esperado: 'sin-molde', debe: 'La puerta dice que la pieza tiene contrasalidas (zonas que no salen en línea recta, Kazmer §2.3.7) y BLOQUEA el molde y el precio: al pedir MOLDE no se arma acero; el expediente no trae cotización.',
      dice: DICE.contrasalida, sinMolde: true, sinPrecio: true,
      cita: 'orden C §4 (contrasalidas bloquean 6–9); red team (h)1; juez C §1.8 (checkUndercut con 0 llamadas)', fabricado: 'scripts/qa-fabrica-rotos.cjs' };
    fs.writeFileSync(path.join(OUT, '05-tapa-snaps.oraculo.json'), JSON.stringify(o, null, 1) + '\n');
    console.log(`✓ 05-tapa-snaps.stp ${o.bytes} B (copia)`); indice.push(o.id); }
  console.log(`\nFABRICA_ROTOS: ${fallos ? 'ROJO' : 'VERDE'} · ${indice.length} fixtures en ${path.relative(REPO, OUT)}${fallos ? ` · ${fallos} sin el defecto que dicen traer` : ''}`);
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
