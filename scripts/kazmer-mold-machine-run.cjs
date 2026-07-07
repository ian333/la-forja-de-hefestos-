/**
 * LA MÁQUINA DE MOLDES — demo con piezas de CLIENTES reales.
 * El cliente sube su pieza (dimensiones) → La Forja escupe la cotización
 * completa con veredicto. Genera una hoja por pieza + un índice a Downloads.
 */
const { writeFileSync, mkdirSync } = require('fs');
const path = require('path');
(async () => {
  const mm = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const out = process.env.OUT || '/tmp/mold-machine';
  mkdirSync(out, { recursive: true });

  // ── catálogo de piezas de clientes (dimensiones reales) ──
  const piezas = [
    { name: 'Bezel de laptop (electrónica)', Lmm: 240, Wmm: 160, Hmm: 10, surfaceMm2: 45700, volumeMm3: 27500, wallMm: 1.5,
      annualVolume: 1_000_000, plastic: 'ABS', finish: 'SPI B-3', dfm: { ribs: [{ label: 'costilla', baseMm: 1.0, heightMm: 6, spacingMm: 15 }] } },
    { name: 'Tapa rosca envase (consumo)', Lmm: 40, Wmm: 40, Hmm: 15, surfaceMm2: 6500, volumeMm3: 2800, wallMm: 1.2,
      annualVolume: 8_000_000, plastic: 'PP', finish: 'SPI A-3' },
    { name: 'Cubeta industrial 4mm (envase)', Lmm: 300, Wmm: 300, Hmm: 250, surfaceMm2: 380000, volumeMm3: 900000, wallMm: 4,
      annualVolume: 2_000_000, plastic: 'PP', finish: 'texture' },
    { name: 'Carcasa conector auto (automotriz)', Lmm: 60, Wmm: 40, Hmm: 25, surfaceMm2: 14000, volumeMm3: 9000, wallMm: 2,
      annualVolume: 3_000_000, plastic: 'PA66', finish: 'SPI B-3', abrasive: true,
      undercuts: [{ aProjMm2: 200, strokeMm: 8 }] },
    { name: 'Lente óptico (médico)', Lmm: 50, Wmm: 50, Hmm: 8, surfaceMm2: 9000, volumeMm3: 12000, wallMm: 3,
      annualVolume: 200_000, plastic: 'PC', finish: 'SPI A-1', mirror: true },
    { name: 'Engrane técnico POM (mecánico)', Lmm: 45, Wmm: 45, Hmm: 20, surfaceMm2: 16000, volumeMm3: 22000, wallMm: 3,
      annualVolume: 500_000, plastic: 'POM', finish: 'SPI A-3',
      dfm: { corners: [{ label: 'raíz de diente', kind: 'interno' }], draftDeg: 0 } },
  ];

  const index = ['ÍNDICE — LA MÁQUINA DE MOLDES DE LA FORJA', '='.repeat(64),
    'El cliente sube su pieza → cotización de molde con veredicto de ingeniería.', ''];
  for (const p of piezas) {
    const pkg = mm.moldMachine({ ...p, totalVolume: p.annualVolume });
    const slug = p.name.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
    writeFileSync(`${out}/cotizacion-${slug}.txt`, pkg.reporte.join('\n') + '\n\n' +
      'BANDERAS: ' + (pkg.veredicto.banderas.length ? pkg.veredicto.banderas.join(' · ') : 'ninguna, molde viable ✓') + '\n' +
      'ACERO: ' + pkg.metal.porQue.join('\n  ') + '\n');
    const v = pkg.veredicto, r = pkg.recomendacion;
    index.push(`▸ ${p.name}`);
    index.push(`    ${r.arch} ×${r.nCav} · molde $${Math.round(pkg.cotizacion.totalUSD).toLocaleString()} → precio $${v.precioMoldeUSD.toLocaleString()} · $${v.costoPiezaUSD.toFixed(3)}/pza · ${v.entregaSemanas} sem · ${v.viable ? 'VIABLE ✓' : 'REVISAR ⚠'}`);
    console.log(`${p.name}: ${r.arch}×${r.nCav} · molde $${Math.round(pkg.cotizacion.totalUSD).toLocaleString()} · $${v.costoPiezaUSD.toFixed(3)}/pza · ${v.viable ? 'viable' : 'REVISAR'}`);
  }
  writeFileSync(`${out}/INDICE.txt`, index.join('\n') + '\n');
  console.log('MACHINE_DEMO_OK →', out);
  process.exit(0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
