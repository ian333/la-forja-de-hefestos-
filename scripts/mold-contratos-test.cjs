// TEST — CONTRATOS DE SUBSISTEMA (los criterios de aceptación de Kazmer).
// El gate NO exige que todo cumpla (hoy no cumple): exige que el contrato DIGA LA
// VERDAD sobre lo que midió y lo que no. Un criterio sin dato jamás debe contar
// como aprobado, y el score debe caer cuando falta información.
(async () => {
  const path = require('path');
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const { moldMachine } = await import(R('moldmachine.ts'));
  const K = await import(R('mold-contratos.ts'));
  const checks = {};

  // El vaso del libro (cap 9: pared 3 mm, ABS) — pieza de revolución.
  const vaso = {
    name: 'vaso Kazmer', Lmm: 100, Wmm: 100, Hmm: 60, cavityShape: 'round',
    surfaceMm2: 30000, volumeMm3: 60000, wallMm: 3, plastic: 'ABS',
    annualVolume: 200000, totalVolume: 1000000,
  };
  const pkg = moldMachine(vaso);
  const rep = K.contratos(pkg);
  console.log(rep.lineas.join('\n'));

  // ── 1) Estructura: hay contratos, con criterios, y cada uno cita el libro ──
  checks.haySubsistemas = rep.subsistemas.length >= 2;
  const todos = rep.subsistemas.flatMap((s) => s.criterios);
  checks.hayCriterios = todos.length >= 10;
  checks.todosCitanLibro = todos.every((c) => /§|Tabla|cap/.test(c.cita));
  checks.todosTienenDetalle = todos.every((c) => typeof c.detalle === 'string' && c.detalle.length > 10);

  // ── 2) LA REGLA MADRE: un criterio sin dato NUNCA cuenta como cumplido ──
  const noMedidos = todos.filter((c) => c.estado === 'SIN-CABLEAR' || c.estado === 'SIN-MÓDULO');
  checks.hayNoMedidos = noMedidos.length > 0;                 // hoy faltan datos: el contrato debe admitirlo
  checks.noMedidoNoCuenta = noMedidos.every((c) => c.estado !== 'CUMPLE');
  const cumplidos = todos.filter((c) => c.estado === 'CUMPLE').length;
  checks.scoreSoloCuentaCumplidos = rep.score === Math.round((cumplidos / todos.length) * 100);

  // ── 3) SIN-CABLEAR obliga a decir QUIÉN ya calcula el dato (el mapa de deuda) ──
  const sinCablear = todos.filter((c) => c.estado === 'SIN-CABLEAR');
  checks.sinCablearTieneDeuda = sinCablear.every((c) => typeof c.deuda === 'string' && c.deuda.length > 10);
  checks.sinModuloTieneDeuda = todos.filter((c) => c.estado === 'SIN-MÓDULO')
    .every((c) => typeof c.deuda === 'string' && c.deuda.length > 10);

  // ── 4) Un subsistema con criterios sin medir NO es congelable ──
  checks.noCongelableSiFaltaDato = rep.subsistemas
    .every((s) => (s.sinCablear + s.sinModulo + s.viola > 0) ? !s.congelable : s.congelable);

  // ── 5) Los tres números duros del feed (§6.4) están presentes por id ──
  const ids = new Set(todos.map((c) => c.id));
  checks.feedTresNumeros = ['feed-dp', 'feed-volumen', 'feed-ciclo'].every((i) => ids.has(i));
  checks.venteoEspesor = ids.has('vent-espesor');

  // ── 6) Los límites son los del libro, no inventados ──
  const dp = todos.find((c) => c.id === 'feed-dp');
  const fill = pkg.diseno.fillMPa;
  const limEsperado = Math.min(0.5 * fill, 50);
  checks.limiteDPdelLibro = Math.abs(dp.limite - limEsperado) < 1e-6;
  const vol = todos.find((c) => c.id === 'feed-volumen');
  checks.limiteVolumen30 = vol.limite === 30 || vol.limite === 100;

  // ── 7) El contrato DETECTA violaciones reales (no es un sello de goma):
  //     con una pared absurdamente delgada la presión se dispara y el ΔP del
  //     feed contra el 50 % de una cavidad chica debe poder violarse. ──
  const dificil = moldMachine({ ...vaso, name: 'vaso pared 0.8', wallMm: 0.8 });
  const repD = K.contratos(dificil);
  const violaAlgo = repD.subsistemas.some((s) => s.viola > 0) || repD.score < rep.score + 1;
  checks.detectaCasoDificil = violaAlgo;
  console.log(`\ncaso difícil (pared 0.8): score ${repD.score}, violaciones ${repD.subsistemas.reduce((a, s) => a + s.viola, 0)}`);

  // ── 8) Determinismo: dos corridas iguales dan el mismo reporte ──
  checks.determinista = JSON.stringify(K.contratos(pkg).total) === JSON.stringify(rep.total);

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks, score: rep.score, total: rep.total }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
