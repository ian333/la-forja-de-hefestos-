/**
 * GATE DE LA LLAMADA ÚNICA — revisarModelo(): malla o spec → expediente completo.
 *
 * Lo que este gate protege: que el cableo de 7 pasos (dfm → spec → moldMachine →
 * ensamble → medirEnsamble → campo de flujo → enumerarVenteos → contratos §13.10)
 * viva en UNA función. La prueba decisiva: los criterios que con el spec pelón
 * quedan SIN-CABLEAR se DESTRABAN solos al pasar por la llamada única — sin que
 * el consumidor conozca el orden. Y el lote (N-29 del pliego): [modelos].map →
 * tabla ordenada por severidad.
 *
 * Uso: node --import tsx scripts/mold-revisar-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

// caja cerrada L×W×H (12 triángulos, winding hacia afuera) — malla mínima real
function boxAt(x0, y0, z0, x1, y1, z1) {
  const P = [x0,y0,z0, x1,y0,z0, x1,y1,z0, x0,y1,z0, x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1];
  const I = [0,2,1, 0,3,2,  4,5,6, 4,6,7,  0,1,5, 0,5,4,  2,3,7, 2,7,6,  3,0,4, 3,4,7,  1,2,6, 1,6,5];
  return { P, I };
}
function boxMesh(L, W, H) {
  const b = boxAt(0, 0, 0, L, W, H);
  return { positions: new Float32Array(b.P), indices: new Uint32Array(b.I) };
}
// CONCHA: caja abierta con fondo + 4 paredes (5 cajas cerradas DISJUNTAS que se
// tocan sin traslaparse — la paridad del ray-cast funciona por caja). Es la pieza
// de la Fig 11.11 del libro: la fuerza de expulsión vive en las paredes.
function shellMesh(L, W, H, t) {
  const cajas = [
    boxAt(0, 0, 0, L, W, t),               // fondo
    boxAt(0, 0, t, t, W, H),               // pared x0
    boxAt(L - t, 0, t, L, W, H),           // pared x1
    boxAt(t, 0, t, L - t, t, H),           // pared y0
    boxAt(t, W - t, t, L - t, W, H),       // pared y1
  ];
  const P = [], I = [];
  for (const c of cajas) { const off = P.length / 3; P.push(...c.P); I.push(...c.I.map((i) => i + off)); }
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const RM = await import(R('revisar-modelo.ts'));
  const EX = await import(R('expediente.ts'));
  const K = await import(R('mold-contratos.ts'));
  const { moldMachine } = await import(R('moldmachine.ts'));

  // ── 0) meshVolumeArea: exacto contra la caja analítica ──────────────────
  const caja = boxMesh(60, 40, 4);
  const mv = RM.meshVolumeArea(caja);
  check('meshVolumeArea exacto en la caja (vol 9600, área 5600)',
    Math.abs(mv.volumeMm3 - 9600) < 1 && Math.abs(mv.areaMm2 - 5600) < 1,
    `vol ${mv.volumeMm3.toFixed(1)} · área ${mv.areaMm2.toFixed(1)}`);

  // ── 1) CAMINO MALLA: caja 60×40×4 → revisión completa ────────────────────
  const t0 = Date.now();
  const placa = RM.revisarModelo({ mesh: caja, nombre: 'placa 60×40×4', annualVolume: 200000, totalVolume: 1000000 });
  console.log(`\n[placa] score ${placa.fila.score} · ${Date.now() - t0} ms · notas: ${placa.notas.length}`);
  for (const n of placa.notas) console.log(`   · ${n}`);
  check('con malla: el raster llena projectedArea y topología en el spec',
    placa.spec.projectedAreaMm2 != null && placa.spec.warpageTopology != null,
    `área ${placa.spec.projectedAreaMm2} mm² · topología ${placa.spec.warpageTopology?.tipo}`);
  check('la caja maciza clasifica \x27placa\x27 y su área ≈ bbox (2400)',
    placa.spec.warpageTopology.tipo === 'placa' && Math.abs(placa.spec.projectedAreaMm2 - 2400) < 120,
    `${placa.spec.warpageTopology.tipo} · ${placa.spec.projectedAreaMm2} mm²`);
  check('la pared derivada del raster se DECLARA en notas',
    placa.notas.some((n) => /pared DERIVADA/.test(n)), placa.notas.find((n) => /pared/.test(n)) ?? '(sin nota)');
  check('el campo de flujo corrió y el plan de venteo existe',
    !!placa.campo && !!placa.planVenteo && placa.planVenteo.maquinar.length > 0,
    placa.campo ? `${placa.campo.nVoxeles.toLocaleString()} vóxeles · ${placa.planVenteo.nCandidatos} candidatos de venteo` : 'sin campo');
  // gate al centro ⇒ el aire acaba en las ESQUINAS: el venteo top debe caer cerca de una
  const v0 = placa.planVenteo.maquinar[0];
  const dEsq = Math.min(
    Math.hypot(v0.x - 0, v0.y - 0), Math.hypot(v0.x - 60, v0.y - 0),
    Math.hypot(v0.x - 0, v0.y - 40), Math.hypot(v0.x - 60, v0.y - 40));
  check('el venteo más urgente cae en una ESQUINA (gate central → aire a las esquinas)',
    dEsq < 12, `(${v0.x}, ${v0.y}) a ${dEsq.toFixed(1)} mm de la esquina más cercana`);

  // ── 2) LA PRUEBA DECISIVA: la llamada única DESTRABA lo SIN-CABLEAR ─────
  const vasoSpec = {
    name: 'vaso Kazmer', Lmm: 100, Wmm: 100, Hmm: 60, cavityShape: 'round',
    surfaceMm2: 30000, volumeMm3: 60000, wallMm: 3, plastic: 'ABS',
    annualVolume: 200000, totalVolume: 1000000,
  };
  const pelon = K.contratos(moldMachine(vasoSpec));           // sin cableo: el consumidor ingenuo
  const vaso = RM.revisarModelo({ spec: vasoSpec });          // la llamada única
  console.log(`\n[vaso] pelón: ${pelon.total.sinCablear} sin-cablear · llamada única: ${vaso.contratos.total.sinCablear}`);
  check('la llamada única deja MENOS sin-cablear que el consumidor ingenuo',
    vaso.contratos.total.sinCablear < pelon.total.sinCablear,
    `${pelon.total.sinCablear} → ${vaso.contratos.total.sinCablear}`);
  check('el ensamble se midió solo (agua + acero de pin + puertos del circuito)',
    typeof vaso.ens.holguraAguaMm === 'number' && typeof vaso.ens.holguraPinCavidadMm === 'number' && vaso.ens.aguaPuertosPorMitad === 2,
    `agua ${vaso.ens.holguraAguaMm} mm · acero pin ${vaso.ens.holguraPinCavidadMm} mm · ${vaso.ens.aguaPuertosPorMitad} puertos`);
  check('sin malla lo DECLARA (venteos/alabeo quedan sin-cablear con nota, no en silencio)',
    vaso.notas.some((n) => /sin malla/.test(n)), vaso.notas.find((n) => /sin malla/.test(n)) ?? '(sin nota)');

  // ── 3) EL EXPEDIENTE §13.10: decisiones reales, con los números del paquete ─
  const exp = vaso.expediente;
  const ids = exp.decisiones.map((d) => d.id);
  console.log(`\n[expediente vaso] ${exp.decisiones.length} decisiones (${exp.pendientes} pendientes) · tryout: ${exp.tryout.length} partidas`);
  for (const d of exp.decisiones) console.log(`   ${d.eleccion == null ? '○' : '●'} ${d.id} [${d.cita}]`);
  check('las decisiones del libro están: steel-safe §10.2.2 + responsable §10.1.7 + vetos §3.2.2 + arquitectura §3.2.2',
    ['steel-safe-contraccion', 'responsable-contraccion', 'vetos', 'arquitectura'].every((i) => ids.includes(i)),
    ids.join(', '));
  check('el conflicto ABIERTO del feed del vaso genera su decisión (lo arbitra el humano §1.2)',
    ids.includes('conflicto-feed'), ids.includes('conflicto-feed') ? 'presente con las 3 salidas' : 'AUSENTE');
  check('el gate que congela antes genera su decisión con los remedios EN ORDEN §7.3.5',
    ids.includes('gate-freeze'), ids.includes('gate-freeze') ? 'presente' : 'AUSENTE');
  check('las opciones de steel-safe traen los NÚMEROS del paquete (escala ×1.0xxxx), no categorías huecas',
    exp.decisiones.find((d) => d.id === 'steel-safe-contraccion').opciones.every((o) => /×1\.\d{4,}/.test(o)),
    exp.decisiones.find((d) => d.id === 'steel-safe-contraccion').opciones[0].slice(0, 70));
  check('el plan de TRYOUT existe (venteo 0.02 + colada solo-se-abre §6.5.5)',
    exp.tryout.length >= 2 && exp.tryout.some((t) => /0\.02/.test(t)) && exp.tryout.some((t) => /COLADA/.test(t)),
    exp.tryout.map((t) => t.slice(0, 40)).join(' | '));
  check('el expediente NO es cerrable con decisiones pendientes (§13.10 exige firmas)',
    exp.pendientes > 0 && exp.cerrable === false, `${exp.pendientes} pendientes`);

  // ── 4) REGISTRAR una firma: puro, válido, y rechaza opciones inventadas ──
  const ss = exp.decisiones.find((d) => d.id === 'steel-safe-contraccion');
  const exp2 = EX.registrarDecision(exp, 'steel-safe-contraccion', ss.opciones[1], 'ian', '2026-08-03');
  check('registrarDecision firma y baja el conteo de pendientes (sin mutar el original)',
    exp2.pendientes === exp.pendientes - 1 && exp.decisiones.find((d) => d.id === 'steel-safe-contraccion').eleccion == null,
    `${exp.pendientes} → ${exp2.pendientes} · responsable ${exp2.decisiones.find((d) => d.id === 'steel-safe-contraccion').responsable}`);
  let rechazo = false;
  try { EX.registrarDecision(exp, 'steel-safe-contraccion', 'la opción que yo quiera', 'ian', '2026-08-03'); }
  catch { rechazo = true; }
  check('una elección FUERA de las opciones se RECHAZA (el registro no acepta inventos)', rechazo, 'throw ✓');

  // ── 5) EL LOTE (N-29): tabla ordenada por severidad ──────────────────────
  const bezelSpec = {
    name: 'bezel', Lmm: 168, Wmm: 120, Hmm: 13, surfaceMm2: 22000, volumeMm3: 40000,
    wallMm: 1.5, plastic: 'ABS', annualVolume: 500000, totalVolume: 2000000,
  };
  const lote = RM.revisarLote([{ spec: vasoSpec }, { spec: bezelSpec }, { mesh: caja, nombre: 'placa 60×40×4' }]);
  console.log('\n══ LOTE (modo REVISAR EN VOLUMEN — N-29) ══');
  console.log('  modelo             score  ✗  🔌  ∅  CRIT  congelables  pendientes');
  for (const f of lote.filas)
    console.log(`  ${f.nombre.padEnd(18)} ${String(f.score).padStart(4)}  ${f.viola}  ${f.sinCablear}   ${f.sinModulo}   ${f.criticos}      ${f.congelables}/10        ${f.pendientes}`);
  check('el lote devuelve una fila por modelo con los campos de la tabla',
    lote.filas.length === 3 && lote.filas.every((f) => Number.isFinite(f.score) && Number.isFinite(f.criticos)),
    `${lote.filas.length} filas`);
  check('la tabla sale ORDENADA por severidad (críticos, luego violaciones, luego score asc)',
    lote.filas.every((f, i) => i === 0
      || lote.filas[i - 1].criticos > f.criticos
      || (lote.filas[i - 1].criticos === f.criticos && lote.filas[i - 1].viola > f.viola)
      || (lote.filas[i - 1].criticos === f.criticos && lote.filas[i - 1].viola === f.viola && lote.filas[i - 1].score <= f.score)),
    lote.filas.map((f) => `${f.nombre}(c${f.criticos}/v${f.viola}/s${f.score})`).join(' → '));

  // ── 5b) LAYOUT POR AGARRE §11.2.5 (la segunda mitad de la frase del libro) ──
  // La CONCHA (Fig 11.11): la fuerza vive en las paredes → los pines van JUNTO a
  // ellas, no en rejilla. La PLACA maciza no tiene paredes → rejilla VÁLIDA.
  const EL = await import(R('eject-layout.ts'));
  const concha = shellMesh(120, 80, 25, 4);
  const rc = RM.revisarModelo({ mesh: concha, nombre: 'concha 120×80×25', annualVolume: 200000, totalVolume: 1000000 });
  console.log(`\n[concha] score ${rc.fila.score} · layout ${rc.ens.ejectLayout} · criticos ${rc.fila.criticos}`);
  for (const n of rc.notas.filter((x) => /agarre/.test(x))) console.log('   ·', n);
  check('la concha coloca los pines POR AGARRE (§11.2.5 Fig 11.11)',
    rc.ens.ejectLayout === 'agarre', `ejectLayout = ${rc.ens.ejectLayout}`);
  const cLay = rc.contratos.subsistemas.flatMap((s) => s.criterios).find((c) => c.id === 'eject-layout');
  check('el contrato eject-layout pasa a CUMPLE con el layout por agarre',
    cLay.estado === 'CUMPLE' && /Fig 11\.11/.test(cLay.detalle), `${cLay.estado}`);
  check('la concha queda sin CRÍTICOS del ensamble (el acero §11.2.5 aguanta con pines junto a la pared)',
    rc.fila.criticos === 0, `${rc.fila.criticos} críticos`);
  // la GEOMETRÍA: cada pin del plan queda en la banda [keepOut, keepOut+6+celda]
  // de una pared (ni encima de ella, ni lejos en el centro — Fig 11.10 vs 11.11)
  {
    const grip = EL.gripEjectorLayout(concha, { nPins: 12, pinDiaMm: 6 });
    const keepOut = 6 + (6 + 0.13) / 2 + 1;
    const dPared = (p) => Math.min(p.x - 4, 116 - p.x, p.y - 4, 76 - p.y);  // a la cara interna de la pared
    const dists = grip.positions.map(dPared);
    check('todos los pines de agarre caen en la BANDA junto a la pared (ni encima, ni al centro)',
      grip.positions.length >= 4 && dists.every((d) => d >= keepOut - 4.5 && d <= keepOut + 8),
      `${grip.positions.length} pines · d(pared interna) = ${dists.map((d) => d.toFixed(1)).join(', ')} · keepOut ${keepOut.toFixed(1)}`);
  }
  check('la PLACA maciza declara agarre uniforme (la rejilla NO es antipatrón en pieza plana)',
    placa.ens.ejectLayout === 'plana-uniforme' || placa.ens.ejectLayout === 'rejilla',
    `ejectLayout = ${placa.ens.ejectLayout}`);
  const cLayP = placa.contratos.subsistemas.flatMap((s) => s.criterios).find((c) => c.id === 'eject-layout');
  check('…y su contrato eject-layout NO regaña en falso (plana-uniforme ⇒ CUMPLE)',
    placa.ens.ejectLayout !== 'plana-uniforme' || cLayP.estado === 'CUMPLE', `${placa.ens.ejectLayout} → ${cLayP.estado}`);

  // ── 6) DETERMINISMO: misma entrada ⇒ misma fila ──────────────────────────
  const vaso2 = RM.revisarModelo({ spec: vasoSpec });
  check('determinista (misma entrada ⇒ misma fila y mismo total de contratos)',
    JSON.stringify(vaso2.fila) === JSON.stringify(vaso.fila)
      && JSON.stringify(vaso2.contratos.total) === JSON.stringify(vaso.contratos.total),
    JSON.stringify(vaso.fila));

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    vaso: vaso.fila, placa: placa.fila,
    sinCablearPelon: pelon.total.sinCablear, sinCablearUnica: vaso.contratos.total.sinCablear,
    decisiones: exp.decisiones.length, pendientes: exp.pendientes,
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 900)); process.exit(1); });
