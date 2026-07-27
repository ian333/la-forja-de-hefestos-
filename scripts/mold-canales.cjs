/**
 * ANÁLISIS DE CANALES de cualquier pieza: MachineSpec JSON → molde auto → circuito
 * §9.2 con veredictos (H/D, paso, varianza Menges, fatiga, holguras NUMÉRICAS
 * agua↔barreno y línea-A↔impresión). El JSON sale de mold-from-stl.cjs.
 * Uso: node --import tsx scripts/mold-canales.cjs '<MachineSpec JSON>'
 */
(async () => {
  const MM = await import('/home/ian/Orkesta/la-forja/src/forja/mold/moldmachine.ts');
  const PS = await import('/home/ian/Orkesta/la-forja/src/forja/mold/mold-plano-set.ts');
  const DS = await import('/home/ian/Orkesta/la-forja/src/forja/mold/mold-drawing-set.ts');
  const MA = await import('/home/ian/Orkesta/la-forja/src/forja/mold/mold-analysis.ts');
  const spec = JSON.parse(process.argv[2]);
  const asm = PS.packageToAssemblySpec(MM.moldMachine(spec));
  console.log(`molde ${spec.name}: ${asm.widthMm} mm · ${asm.nCav} cav · placas A${asm.plates.A}/B${asm.plates.B}/sop${asm.plates.support} · agua ⌀${asm.cooling.diaMm}`);
  const D = DS.plateDepth(asm);
  const cc = DS.coolingCircuit(asm, D);
  console.log('canales:', cc.note);
  let worst = 1e9, wi = '';
  for (const role of ['A', 'B']) for (const h of DS.standardHoles(asm, role))
    for (const g of cc.segs.filter((g) => g.y0 === g.y1)) {
      if (h.x < Math.min(g.x0, g.x1) - h.dia / 2 || h.x > Math.max(g.x0, g.x1) + h.dia / 2) continue;
      const d = Math.abs(g.y0 - h.y) - cc.diaMm / 2 - h.dia / 2;
      if (d < worst) { worst = d; wi = `${h.type}@(${h.x},${h.y}) vs y=${g.y0}`; }
    }
  console.log(`holgura mínima agua↔barreno (XY): ${worst.toFixed(1)} mm (${wi})`);
  const a = MA.moldAnalysis(asm);
  for (const v of a.verdicts) console.log(` ${v.ok ? '✓' : '⚠'} ${v.param}: ${v.valor} — ${v.limite} [${v.ref}]`);
})().catch((e) => { console.error('FATAL', String(e?.stack || e).slice(0, 400)); process.exit(1); });
