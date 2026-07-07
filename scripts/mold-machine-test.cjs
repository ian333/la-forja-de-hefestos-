// TEST de LA MÁQUINA DE MOLDES (orquestador): el cliente trae su pieza →
// molde completo + cotización + veredicto. Verifica que orquesta bien los
// ~15 módulos y que las decisiones económicas del libro se sostienen. Puro.
(async () => {
  const path = require('path');
  const mm = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const checks = {};

  // ── el LAPTOP BEZEL del libro (§3.3): pieza con costillas, 1M/año ──
  const bezel = mm.moldMachine({
    name: 'Laptop bezel', Lmm: 240, Wmm: 160, Hmm: 10, surfaceMm2: 45700, volumeMm3: 27500, wallMm: 1.5,
    annualVolume: 1_000_000, totalVolume: 1_000_000, plastic: 'ABS', finish: 'SPI B-3',
    dfm: { ribs: [{ label: 'costilla', baseMm: 1.0, heightMm: 6, spacingMm: 15 }] },
  });
  console.log(bezel.reporte.join('\n'));
  console.log('');

  // el paquete está COMPLETO
  checks.tiene_dfm = bezel.dfm && typeof bezel.dfm.score === 'number';
  checks.tiene_variantes = bezel.variantes.length === 15;       // 3 arch × 5 cav
  checks.tiene_cotizacion = bezel.cotizacion.totalUSD > 0;
  checks.tiene_costoPieza = bezel.costoPieza.partUSD > 0;
  checks.tiene_veredicto = typeof bezel.veredicto.viable === 'boolean' && bezel.veredicto.precioMoldeUSD > 0;
  checks.tiene_reporte = bezel.reporte.length > 15;

  // la MÁQUINA OPTIMIZA: elige el mínimo GLOBAL de las 15 variantes (no un supuesto)
  console.log('bezel elige:', bezel.recomendacion.arch, '×', bezel.recomendacion.nCav, '($' + Math.round(bezel.variantes[0].totalUSD).toLocaleString() + ' total)');
  const minTotal = Math.min(...bezel.variantes.map((v) => v.totalUSD));
  checks.optimiza = Math.abs(bezel.variantes[0].totalUSD - minTotal) < 1;
  // el bezel es DELGADO (pared 1.5): cold gana honestamente (poco material que ahorrar) —
  // el libro solo ASUME hot para demostrar el costeo, no lo optimiza
  checks.bezel_cold_delgado = bezel.recomendacion.arch.startsWith('cold');

  // el precio sugerido > costo del molde (margen aplicado)
  checks.precio_con_margen = bezel.veredicto.precioMoldeUSD > bezel.cotizacion.totalUSD;

  // §3.4: costo por pieza en el orden del libro (~$0.4-0.6 para el bezel)
  console.log('costo/pza bezel:', '$' + bezel.costoPieza.partUSD.toFixed(3));
  checks.costoPieza_orden = bezel.costoPieza.partUSD > 0.1 && bezel.costoPieza.partUSD < 2;
  // material/pza EXACTO del libro (Eq 3.21): 27.5cc ABS hot-long = $0.063
  const matBezel = bezel.variantes.find((v) => v.arch === 'hot-runner').part.materialPerPart;
  console.log('material/pza (Eq 3.21):', '$' + matBezel.toFixed(4), '(libro $0.063)');
  checks.material_exacto = near(matBezel, 0.063, 0.002);

  // ── pieza GRUESA de MUY alto volumen: el hot runner (menos desperdicio de
  //    colada + ciclo) debe ganar → la máquina lo elige y sube cavidades ──
  const cubetaGruesa = mm.moldMachine({
    name: 'Cubeta pared gruesa', Lmm: 120, Wmm: 120, Hmm: 90, surfaceMm2: 60000, volumeMm3: 180000, wallMm: 4,
    annualVolume: 5_000_000, totalVolume: 20_000_000, plastic: 'PP',
  });
  console.log('cubeta gruesa 20M elige:', cubetaGruesa.recomendacion.arch, '×', cubetaGruesa.recomendacion.nCav);
  const hotV = cubetaGruesa.variantes.find((v) => v.arch === 'hot-runner' && v.nCav === 16);
  const cold2V = cubetaGruesa.variantes.find((v) => v.arch === 'cold-2placas' && v.nCav === 16);
  // a este volumen y espesor el hot AL MISMO nº de cav tiene MENOR costo por pieza (menos desperdicio de colada)
  checks.hot_menor_marginal = hotV.partUSD < cold2V.partUSD;
  checks.tiene_15_variantes = cubetaGruesa.variantes.length === 15 && cubetaGruesa.variantes.some((v) => v.factible === false);

  // ── una pieza SIMPLE de BAJO volumen (tapa 10k/año) debe elegir COLD ──
  const tapaChica = mm.moldMachine({
    name: 'Tapita', Lmm: 62, Wmm: 62, Hmm: 10, surfaceMm2: 9000, volumeMm3: 4000, wallMm: 2,
    annualVolume: 10_000, totalVolume: 10_000, plastic: 'PP',
  });
  console.log('tapa 10k elige:', tapaChica.recomendacion.arch, '×', tapaChica.recomendacion.nCav);
  checks.bajo_vol_cold = tapaChica.recomendacion.arch.startsWith('cold');
  checks.bajo_vol_barato = tapaChica.cotizacion.totalUSD < bezel.cotizacion.totalUSD;

  // ── PUERTA DFM: pieza con esquina viva + sin draft → NO viable (banderas) ──
  const mala = mm.moldMachine({
    name: 'Caja mal diseñada', Lmm: 100, Wmm: 80, Hmm: 40, surfaceMm2: 30000, volumeMm3: 20000, wallMm: 3,
    annualVolume: 100_000, plastic: 'ABS',
    dfm: { corners: [{ label: 'esquina base', kind: 'interno' }], draftDeg: 0 },
  });
  console.log('caja mala: viable=', mala.veredicto.viable, '· banderas:', mala.veredicto.banderas.length);
  checks.dfm_gate = !mala.veredicto.viable && mala.dfm.errors >= 1 && mala.veredicto.banderas.some((b) => b.includes('DFM'));

  // ── el break-even entre la ganadora y la alternativa está presente y tiene sentido ──
  checks.breakEven = bezel.breakEven.length >= 2 && bezel.breakEven[1].length > 10;

  // ── entrega estimada razonable (semanas) ──
  checks.entrega = bezel.veredicto.entregaSemanas >= 4 && bezel.veredicto.entregaSemanas < 60;

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 400)); process.exit(1); });
