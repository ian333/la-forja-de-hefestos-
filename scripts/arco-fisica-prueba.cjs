#!/usr/bin/env node
/**
 * ARCO FÍSICA · PRUEBA (orden 2026-11-04-banco-arco-vivo) — corre src/forja/brep/arcoFisica.ts SIN navegador
 * y lo compara con el canon (scripts/canon/canon_gota.py). Telemetría cruda, no solo veredictos.
 *
 *   node --import tsx scripts/arco-fisica-prueba.cjs
 */
const path = require('path');
(async () => {
  const F = await import(path.join(__dirname, '..', 'src', 'forja', 'brep', 'arcoFisica.ts'));
  const ok = (c, m) => console.log(`${c ? 'PASA' : 'FALLA'}  ${m}`);
  let fallas = 0; const chk = (c, m) => { ok(c, m); if (!c) fallas++; };

  console.log('── 1 · constantes del canon');
  const f046 = F.f2Hz(0.46e-3), icrit = Math.sqrt((4 * Math.PI * F.F_TENSION) / F.MU0);
  console.log(`   f2(0.46 mm) = ${f046.toFixed(1)} Hz · I_crit de pellizco = tensión: ${icrit.toFixed(1)} A · F_tensión = ${(F.F_TENSION * 1e3).toFixed(2)} mN`);
  chk(Math.abs(f046 - 668) < 2, 'f2 = 668 Hz a 0.46 mm (canon)');
  chk(Math.abs(icrit - 194) < 1, 'I_crit = 194 A');
  console.log(`   B en la superficie del alambre a 40/70/100 A: ${[40, 70, 100].map((I) => (F.bRecto(I, F.RW) * 1e3).toFixed(1)).join(' / ')} mT`);

  console.log('\n── 2 · campanazo: 40 A + 30 A a f2, Q = 30, gota pedida 0.46 mm, alambre 3 m/min');
  {
    const s = F.nuevoArco(), p = { ...F.PARAMS_ARCO };
    const t0 = Date.now();
    const ciclos = [];
    let g0 = 0;
    for (let k = 0; k < 400; k++) {   // 0.4 s en tramos de 1 ms
      F.correrArco(s, p, 1e-3);
      if (s.gotas > g0) { ciclos.push(s.ciclosUltima); g0 = s.gotas; }
    }
    const tam = s.tamanos.slice(5);
    const m = tam.reduce((a, b) => a + b, 0) / tam.length, sd = Math.sqrt(tam.reduce((a, b) => a + (b - m) ** 2, 0) / tam.length);
    console.log(`   ${s.gotas} gotas en 0.4 s (${(s.gotas / 0.4).toFixed(0)}/s) · cortos ${s.cortos} · radio ${m.toFixed(3)} ± ${sd.toFixed(3)} mm · ciclos de onda por gota: ${ciclos.slice(5, 25).join(' ')}`);
    console.log(`   arco: L = ${s.L.toFixed(2)} mm, V = ${s.V.toFixed(1)} V · cordón ${F.altoCordon(p).toFixed(2)} mm de alto · ${(Date.now() - t0)} ms de cómputo para 0.4 s simulados`);
    chk(s.cortos === 0, 'campanazo: ninguna gota en corto');
    chk(Math.abs(m - 0.46) / 0.46 < 0.06 && sd / m < 0.03, 'campanazo: gotas de ~0.46 mm con dispersión < 3 %');
    chk(Math.max(...ciclos.slice(5)) <= 12, 'campanazo: se sueltan en ≤ 12 ciclos');
    // telemetría cruda de una gota: q y I cada 0.5 ms
    const s2 = F.nuevoArco(); const filas = [];
    for (let k = 0; k < 60; k++) { F.correrArco(s2, p, 0.5e-3); filas.push(`${(s2.t * 1e3).toFixed(1)}ms a=${(s2.a * 1e3).toFixed(3)} q=${s2.q.toFixed(2)} I=${s2.I.toFixed(0)} V=${s2.V.toFixed(1)} gotas=${s2.gotas}`); }
    console.log('   traza (cada 0.5 ms):\n     ' + filas.slice(0, 60).filter((_, i) => i % 3 === 0).join('\n     '));
  }

  console.log('\n── 3 · arco CC a 60 A, sin onda (lo que hace una soldadora común)');
  {
    const s = F.nuevoArco(), p = { ...F.PARAMS_ARCO, modo: 'cc', I0: 60 };
    F.correrArco(s, p, 3.0);
    const tam = s.tamanos;
    const m = tam.reduce((a, b) => a + b, 0) / Math.max(1, tam.length);
    console.log(`   ${s.gotas} gotas en 3 s · cortos ${s.cortos} · radio medio ${m.toFixed(2)} mm (${(m / 0.46).toFixed(1)}× la del campanazo)`);
    chk(m > 1.0, 'CC: gotas grandes (globular / corto), > 1 mm de radio');
  }

  console.log('\n── 4 · campo E del hueco (cargas simuladas + imágenes)');
  {
    const e = { zw: 4 + 0.92, a: 0.46, sz: 1, V: 40 };
    const c = F.resolverCampoE(e);
    const L = e.zw - 2 * e.a;
    const Epunta = F.magE(c, 0, e.zw - 2 * e.a - 0.02);
    const Eplaca = F.magE(c, 0, 0.001);
    console.log(`   ${c.z.length} cargas · error de potencial entre puntos de colocación ${(c.errMax * 100).toFixed(2)} %`);
    console.log(`   |E| en la punta de la gota ${Epunta.toFixed(1)} V/mm · en la placa bajo ella ${Eplaca.toFixed(1)} V/mm · V/L = ${(e.V / L).toFixed(1)} V/mm`);
    const lin = F.lineasE(c);
    const llegan = lin.filter((l) => l[l.length - 1][1] <= 1e-6).length;
    console.log(`   ${lin.length} líneas de E: ${llegan} llegan a la placa · puntos por línea ${lin.map((l) => l.length).join(' ')}`);
    const seg = F.equipotenciales(c, [1, 2, 3, 4, 5].map((k) => (-e.V * k) / 6));
    console.log(`   equipotenciales: ${seg.length / 4} segmentos`);
    chk(c.errMax < 0.05, 'E: el electrodo queda a −V con error < 5 %');
    console.log(`   referencias: hueco plano V/L = ${(e.V / L).toFixed(1)} V/mm · esfera aislada V/a = ${(e.V / e.a).toFixed(1)} V/mm`);
    chk(Epunta > e.V / L && Epunta < 1.2 * e.V / e.a, 'E: en la punta |E| queda entre el hueco plano (V/L) y la esfera aislada (V/a)');
    chk(llegan >= 6, 'E: las líneas que nacen abajo de la gota mueren en la placa');
  }
  console.log(fallas ? `\nRESULTADO: ${fallas} FALLA(S)` : '\nRESULTADO: todo PASA');
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
