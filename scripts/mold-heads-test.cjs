/**
 * GATE de CABEZAS + CHAFLANES — "debe haber reglas estandarizadas" (user).
 * Verifica las REGLAS, no valores memorizados:
 *   1. DIN 912: k = d EXACTO en TODAS las medidas (M3→M24) — la regla de ISO 4762
 *   2. DIN 7991: cono 90° ⇒ k = (dk−d)/2 (la altura sale del ángulo)
 *   3. ISO 4753: punta achaflanada a 45° hasta ≈ Ø menor d1 (profundidad 0.541·P)
 *   4. DIN 933: chaflán 30° trunca el hexágono → r < s/√3 (arcos, no esquina viva)
 *   5. la geometría respeta la regla (malla medida, no declarada)
 *   6. honestidad: lo derivado de proporción va marcado nominal
 * Uso: node --import tsx scripts/mold-heads-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const bbox = (m) => { const P = m.positions; let r = 0, z0 = 1e9, z1 = -1e9; for (let i = 0; i < P.length; i += 3) { r = Math.max(r, Math.hypot(P[i], P[i + 1])); z0 = Math.min(z0, P[i + 2]); z1 = Math.max(z1, P[i + 2]); } return { r, z0, z1 }; };

(async () => {
  const H = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-heads.ts'));
  const T = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-threads.ts'));
  const D = await import(path.resolve(__dirname, '..', 'src', 'lib', 'parts', 'fasteners', 'din.ts'));

  // ── 1. REGLA DIN 912: k = d exacto en TODA la tabla ────────────────────────
  let kEqD = true, off = [];
  for (const s of D.SIZES) { const hd = H.resolveHead('DIN912', D.THREAD[s].d); if (Math.abs(hd.k - D.THREAD[s].d) > 1e-9) { kEqD = false; off.push(`${s}:k=${hd.k}≠d=${D.THREAD[s].d}`); } }
  check('DIN 912 · REGLA k = d en M3..M24', kEqD, kEqD ? `${D.SIZES.length}/${D.SIZES.length} medidas` : off.join(' '));

  // ── 2. REGLA DIN 7991: cono 90° ⇒ k = (dk−d)/2 ─────────────────────────────
  let coneOK = true;
  for (const s of ['M4', 'M5', 'M6', 'M8', 'M10', 'M12']) { const d = D.THREAD[s].d, hd = H.resolveHead('DIN7991', d); if (Math.abs(hd.k - (hd.dk - d) / 2) > 1e-6 || hd.angleDeg !== 90) coneOK = false; }
  const c10 = H.resolveHead('DIN7991', 10);
  check('DIN 7991 · REGLA cono 90° ⇒ k=(dk−d)/2', coneOK, `M10: dk=${c10.dk} k=${c10.k} (=(20−10)/2) ∠${c10.angleDeg}°`);

  // ── 3. REGLA ISO 4753: chaflán 45° hasta Ø menor, profundidad 0.541·P ──────
  const tc = H.tipChamfer(10, 1.5);
  const d1 = 10 - 1.0825 * 1.5;
  check('ISO 4753 · chaflán a Ø menor d1', Math.abs(tc.toDia - d1) < 0.01, `${tc.toDia} vs d1=${d1.toFixed(3)}`);
  check('ISO 4753 · profundidad = 0.541·P', Math.abs(tc.radialMm - 0.5413 * 1.5) < 0.01, `${tc.radialMm} mm (0.541×1.5)`);
  check('ISO 4753 · 45° cónica en Ø≥3', tc.angleDeg === 45, tc.kind);
  const tiny = H.tipChamfer(2, 0.4);
  check('ISO 4753 · punta REDONDEADA en Ø<3', tiny.kind === 'redondeada', `M2 → ${tiny.kind}`);

  // ── 4. el chaflán EXISTE en la malla (medido, no declarado) ────────────────
  const spec = T.resolveThread(10);
  const withCh = T.threadSurfaceMesh(spec, 12, { chamfer: 'start', lod: 8 });
  const noCh = T.threadSurfaceMesh(spec, 12, { chamfer: 'none', lod: 8 });
  // radio máximo en la primera 0.3mm desde la punta: con chaflán debe ser ~d1/2
  const nearTip = (m) => { const P = m.positions; let r = 0; for (let i = 0; i < P.length; i += 3) if (P[i + 2] < 0.30) r = Math.max(r, Math.hypot(P[i], P[i + 1])); return r; };
  const rCh = nearTip(withCh), rNo = nearTip(noCh);
  console.log(`punta: con chaflán r=${rCh.toFixed(3)} · sin chaflán r=${rNo.toFixed(3)} · d1/2=${(d1 / 2).toFixed(3)}`);
  check('el CHAFLÁN recorta la punta (malla medida)', rCh < rNo - 0.15, `${rCh.toFixed(3)} < ${rNo.toFixed(3)}`);
  check('la punta chaflanada NO pasa del cono 45°', rCh <= d1 / 2 + 0.35, `${rCh.toFixed(3)} ≤ ${(d1 / 2 + 0.35).toFixed(3)}`);

  // ── 5. REGLA DIN 933: chaflán 30° trunca el hexágono (arcos, no esquina viva)
  const hx = H.resolveHead('DIN933', 10);
  const corner = hx.sw / Math.sqrt(3);                       // esquina teórica sin chaflán
  // OJO: la ESQUINA cae en φ=0 y el centro de CARA en φ=30° (así orienta hexRadius)
  const flat = H.headRadius(hx, Math.PI / 6, hx.k / 2);
  const rTop = H.headRadius(hx, 0, hx.k);                    // esquina, en la cara superior
  const rMid = H.headRadius(hx, 0, hx.k / 2);                // esquina, a media altura
  console.log(`DIN 933 M10: s=${hx.sw} esquina=${corner.toFixed(2)} · r(esquina,arriba)=${rTop.toFixed(2)} · r(esquina,medio)=${rMid.toFixed(2)} · r(cara)=${flat.toFixed(2)}`);
  check('DIN 933 · la cara plana está a s/2', Math.abs(flat - hx.sw / 2) < 0.02, `${flat.toFixed(2)} = ${hx.sw}/2`);
  check('DIN 933 · chaflán 30° trunca la esquina arriba', rTop < corner - 0.15, `${rTop.toFixed(2)} < ${corner.toFixed(2)}`);
  check('DIN 933 · abajo conserva el hexágono lleno', Math.abs(rMid - corner) < 0.35, `${rMid.toFixed(2)} ≈ ${corner.toFixed(2)}`);

  // ── 6. mallas sanas + honestidad dimensional ──────────────────────────────
  for (const std of ['DIN912', 'DIN933', 'DIN7991', 'ISO7380', 'DIN7984']) {
    const hd = H.resolveHead(std, 10), m = H.headMesh(hd, 0), bb = bbox(m);
    const tris = m.indices.length / 3;
    const okR = bb.r <= hd.dk / 2 + 0.02, okZ = Math.abs(bb.z1 - hd.k) < 0.02;
    console.log(`  ${hd.desig.padEnd(14)} dk=${String(hd.dk).padStart(5)} k=${String(hd.k).padStart(5)} ${String(tris).padStart(5)}△ ${hd.source}${hd.nominal ? ' (nominal)' : ''}`);
    if (!okR || !okZ) { check(`${hd.desig} malla respeta dk/k`, false, `r=${bb.r.toFixed(2)} z1=${bb.z1.toFixed(2)}`); }
  }
  check('las 5 cabezas mallan dentro de su dk/k', true, 'radio ≤ dk/2 y alto = k');
  const cs = H.resolveHead('DIN7991', 10), sd = H.seatSpec(cs);
  check('avellanado pide asiento CÓNICO 90°', sd.kind === 'avellanado' && sd.angleDeg === 90, `${sd.kind} ⌀${sd.dia}×${sd.depth}`);
  // botón: la cúpula NO puede rematar en punta — necesita cara plana para el Allen
  const bt = H.resolveHead('ISO7380', 10);
  const rCima = H.headRadius(bt, 0, bt.k), rSock = bt.sw / Math.sqrt(3);
  console.log(`ISO 7380 M10: r(cima)=${rCima.toFixed(2)} · esquina Allen=${rSock.toFixed(2)} · dk/2=${bt.dk / 2}`);
  check('botón: cúpula TRUNCADA (no punta)', rCima > rSock, `${rCima.toFixed(2)} > ${rSock.toFixed(2)} (cabe la llave)`);
  check('botón: la cima no rebasa dk', rCima < bt.dk / 2, `${rCima.toFixed(2)} < ${bt.dk / 2}`);
  check('botón: la base arranca en dk', Math.abs(H.headRadius(bt, 0, 0) - bt.dk / 2) < 0.02, `${H.headRadius(bt, 0, 0).toFixed(2)} = ${bt.dk / 2}`);
  check('DIN 912 pide CAJA (no cono)', H.seatSpec(H.resolveHead('DIN912', 10)).kind === 'caja', 'caja');
  check('tabla verificada NO va marcada nominal', !H.resolveHead('DIN912', 10).nominal && H.resolveHead('DIN912', 10).source === 'tabla', 'DIN912 = tabla');
  check('proporción de regla SÍ va marcada nominal', H.resolveHead('ISO7380', 10).nominal, 'ISO7380 = regla/nominal');

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ CABEZAS POR REGLA: ISO 4762 k=d · ISO 10642 cono 90° · ISO 4753 chaflán 45° · ISO 4017 chaflán 30°');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 500)); process.exit(1); });
