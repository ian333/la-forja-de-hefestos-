/**
 * GATE DE LA CELDA CORTADA EN PRODUCCIÓN — `thermal-steady.solveSteadyMoldField`.
 * ============================================================================
 * En el solver del molde la frontera crítica NO es Dirichlet: es la INTERFAZ
 * MATERIAL plástico↔acero. La media armónica g = A/(dx/2k₁ + dx/2k₂) supone que
 * la superficie de la pieza cae EXACTAMENTE en la cara del vóxel. La superficie
 * real cae donde cae, y su posición dentro de la celda CAMBIA con cada malla.
 *
 * LA VARA DE MEDIR ES ANALÍTICA, no el libro: dos capas en serie con la interfaz
 * en x_i tienen resistencia EXACTA R = d₁/k₁ + d₂/k₂ y perfil lineal por tramo
 * con el flujo continuo. Si el solver pone la interfaz en el sitio equivocado,
 * la R sale mal y el ΔT también — y se puede calcular cuánto, exactamente.
 *
 * EL EXPERIMENTO: se barre la posición de la interfaz por DENTRO de una celda.
 * El escalonado solo sabe decir "en la cara", así que su error crece hasta el
 * máximo a media celda; la celda cortada la ubica por level-set y acierta.
 *
 * Uso: node --import tsx scripts/verif-termico-cortado-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const TS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'thermal-steady.ts'));

  const kS = 32, kP = 0.19;

  /**
   * Barra 1D en x: plástico de 0 a xi, acero de xi a L. Se resuelve con el solver
   * REAL de producción (una fila de celdas, sin agua, con fuente en el plástico) y
   * se compara la CAÍDA DE TEMPERATURA plástico→acero contra la analítica.
   *
   * Se usa el balance de flujo: en régimen permanente todo el calor generado en el
   * plástico cruza la interfaz, así que ΔT a través de un tramo de espesor d y
   * conductividad k es q·d/k con q = Q̇/A. La comparación se hace sobre la
   * RESISTENCIA TOTAL medida entre el primer y el último centro de celda.
   */
  function barra(nx, xiFrac, cortada) {
    const L = 40;                     // mm
    const dxMm = L / nx;
    const ny = 1, nz = 1, N = nx;
    const xi = L * xiFrac;            // posición REAL de la interfaz (mm)
    const plastic = new Uint8Array(N);
    const cool = new Float32Array(N);
    const sdf = new Float32Array(N);
    for (let i = 0; i < nx; i++) {
      const xc = (i + 0.5) * dxMm;
      sdf[i] = xc - xi;                       // <0 = plástico (antes de la interfaz)
      if (sdf[i] < 0) plastic[i] = 1;
    }
    // el agua se pone en la ÚLTIMA celda para anclar el sistema (Robin) y que la
    // caída se lea de punta a punta
    cool[N - 1] = 1;
    const f = TS.solveSteadyMoldField({
      nx, ny, nz, dxMm, x0: 0, y0: 0, z0: 0,
      plastic, cool, tCoolantC: 20, qTotalW: 100,
      kSteel: kS, kPlastic: kP, hC: 1e9,        // h_c enorme = Dirichlet en el agua
      lineDiaM: (dxMm / 1000) / Math.PI,        // g_w = h_c·A2 exacto (área = dx²)
      maxIters: 20000, tolC: 1e-12,
      ...(cortada ? { sdfMm: sdf } : {}),
    });
    // RESISTENCIA POR UNIDAD DE ÁREA (K·m²/W) — la magnitud FÍSICA, independiente
    // de la malla. Normalizar es obligatorio: la sección de esta barra es dx², así
    // que al refinar se adelgaza y los mismos 100 W dan otro ΔT. Mi versión previa
    // comparaba R sin normalizar y daba 99.9 % de "error" con orden CERO — la firma
    // de estar comparando dos problemas físicos distintos, no de un solver malo.
    const A2 = (dxMm / 1000) ** 2;
    const RA = ((f.T[0] - 20) / 100) * A2;
    return { RA, cortadas: f.carasCortadas };
  }

  // ── LA REFERENCIA: el MISMO problema en malla muy fina (Richardson no hace
  //    falta en 1D: 1280 celdas cuesta nada). NO uso fórmula cerrada porque el
  //    solver reparte la fuente por CELDAS ENTERAS (parabólica en el plástico) y
  //    mi primera versión de este test la modeló como lineal: 48 % de error
  //    constante que NO bajaba con h — la firma de una referencia equivocada, no
  //    de un solver roto.
  const XI = 20.37 / 40;                       // fuera de cara Y fuera de centro
  const REF = barra(1280, XI, true).RA;
  const errRef = (r) => Math.abs(r - REF) / REF;

  console.log('\n══ convergencia contra malla fina (nx=1280) · interfaz en x = 20.37 mm ══');
  console.log('  nx     h[mm]   escalonado    cortada     cortada gana');
  const serE = [], serC = [];
  for (const nx of [20, 28, 40, 56, 80]) {
    const e = errRef(barra(nx, XI, false).RA), c = errRef(barra(nx, XI, true).RA);
    serE.push({ h: 40 / nx, e: Math.max(e, 1e-16) }); serC.push({ h: 40 / nx, e: Math.max(c, 1e-16) });
    console.log(`  ${String(nx).padStart(4)}  ${(40 / nx).toFixed(3)}  ${(100 * e).toFixed(4).padStart(9)} %  ${(100 * c).toFixed(4).padStart(9)} %  ${(e / Math.max(c, 1e-18)).toFixed(1)}×`);
  }
  const orden = (s) => {
    const n = s.length, sx = s.map((q) => Math.log(q.h)), sy = s.map((q) => Math.log(q.e));
    const mx = sx.reduce((a, b) => a + b) / n, my = sy.reduce((a, b) => a + b) / n;
    let num = 0, den = 0;
    for (let i = 0; i < n; i++) { num += (sx[i] - mx) * (sy[i] - my); den += (sx[i] - mx) ** 2; }
    return num / den;
  };
  const oE = orden(serE), oC = orden(serC);
  const ganaFina = serE[serE.length - 1].e / Math.max(serC[serC.length - 1].e, 1e-18);
  console.log(`\n  orden escalonado ${oE.toFixed(3)} · orden cortada ${oC.toFixed(3)}`);

  check('P1 la CORTADA es más exacta que el ESCALONADO en TODA la serie de mallas',
    serC.every((q, i) => q.e <= serE[i].e * 1.001),
    `escalonado ${serE.map((q) => (100 * q.e).toFixed(3) + '%').join(' → ')} · cortada ${serC.map((q) => (100 * q.e).toFixed(3) + '%').join(' → ')}`);

  check('P2 y en la malla más fina gana por al menos 2×',
    ganaFina > 2,
    `${ganaFina.toFixed(1)}× mejor en nx=80`);

  check('P3 la CORTADA converge más rápido (orden mayor)',
    oC > oE,
    `orden cortada ${oC.toFixed(3)} vs escalonado ${oE.toFixed(3)}`);

  // ── CONTROL: sin sdfMm el solver corre ESCALONADO ─────────────────────────
  {
    const a = barra(40, XI, false);
    check('P4 CONTROL: sin sdfMm no se activa la extensión (carasCortadas = 0)',
      a.cortadas === 0, `carasCortadas=${a.cortadas}`);
  }
  // ── CONTROL: interfaz JUSTO en la cara ⇒ cortada ≡ escalonado ─────────────
  {
    const e = barra(40, 0.5, false), c = barra(40, 0.5, true);
    const dif = Math.abs(e.RA - c.RA) / e.RA;
    check('P5 CONTROL: si la interfaz cae JUSTO en la cara, cortada ≡ escalonado bit a bit',
      dif < 1e-9,
      `${dif.toExponential(1)} rel — la extensión NO altera el caso alineado`);
  }

  // ── PIEZA REAL: el cable de punta a punta (mold-thermal-fdm → solver) ──────
  {
    const TH = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-thermal-fdm.ts'));
    const S = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'stl.ts'));
    const fs2 = require('fs');
    const stl = path.resolve(__dirname, '..', 'test-parts', 'rpi4-bottom.stl');
    if (fs2.existsSync(stl)) {
      const mesh = S.parseSTL(fs2.readFileSync(stl).buffer);
      const spec = {
        name: 'RPi4', code: 'MLD-RPI4', widthMm: 381,
        plates: { bottomClamp: 36, ejectorHousing: 66, support: 120, B: 76, A: 56, topClamp: 36 },
        cavity: { widthMm: 91.5, depthMm: 26.5, shape: 'rect', lenMm: 64, wallMm: 1.5, frameMm: 20, ribs: 0 },
        cooling: { diaMm: 6.35, plug: 'JP-251', insetMm: 70 },
        ejectors: { type: 'pin', diaMm: 3, count: 12 }, core: { widthMm: 91.5, material: 'AISI P20' },
        cavityMetal: 'AISI P20', baseSteel: '1.1730 (C45)', clampTons: 200, feed: 'cold', nCav: 1, plastic: 'ABS',
      };
      const sim = TH.createThermalSim(spec, { partMesh: mesh });
      const cell = sim.thGrid.cellMm, g = sim.thGrid;
      const plas = sim.plasticVoxels(), fr = sim.fracPlastico();
      let nVox = 0, vFrac = 0;
      for (let i = 0; i < plas.length; i++) { if (plas[i] === 1) nVox++; vFrac += fr[i]; }
      let vLosa = 0;
      for (let m = 0; m < g.thMm.length; m++) if (g.thMm[m] > 0) vLosa += g.thMm[m] * cell * cell;
      const errVox = Math.abs(nVox * cell ** 3 - vLosa) / vLosa;
      const errFr = Math.abs(vFrac * cell ** 3 - vLosa) / vLosa;
      console.log(`\n══ pieza REAL (carcasa RPi4, celda ${cell.toFixed(1)} mm, pared 1.5 mm) ══`);
      console.log(`  volumen de plástico — losa exacta ${(vLosa / 1000).toFixed(2)} cc · vóxeles ${(nVox * cell ** 3 / 1000).toFixed(2)} cc (+${(100 * errVox).toFixed(1)} %) · fracción ${(vFrac * cell ** 3 / 1000).toFixed(2)} cc (${(100 * errFr).toFixed(2)} %)`);
      check('R1 en pieza REAL los VÓXELES ENTEROS sobreestiman el plástico > 20 %',
        errVox > 0.20,
        `+${(100 * errVox).toFixed(1)} % — la pared (1.5 mm) es 4.7× más delgada que la celda, así que el vóxel entero no la representa`);
      check('R2 la FRACCIÓN EXACTA reproduce la losa a mejor de 1 %',
        errFr < 0.01,
        `${(100 * errFr).toFixed(3)} % · q_prima = Q/V va con ese error DIRECTO a la fuente`);
      const f = sim.computeSteady();
      check('R3 el cable llega al solver: el campo se resuelve con celdas CORTADAS',
        !!f && f.carasCortadas > 0,
        f ? `${f.carasCortadas} caras cortadas · acero ${f.steelMinC.toFixed(1)}-${f.steelMaxC.toFixed(1)} °C · residuoRel ${f.residualRel}` : 'sin campo');
    } else {
      console.log('\n  (sin rpi4-bottom.stl: se salta la pieza real)');
    }
  }

  console.log(`\n${fails === 0 ? '✅ TODO VERDE — la celda cortada entró a producción sin romper el caso alineado' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    ordenEscalonado: +oE.toFixed(3), ordenCortada: +oC.toFixed(3),
    ganaEnMallaFina: +ganaFina.toFixed(1),
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 900)); process.exit(1); });
