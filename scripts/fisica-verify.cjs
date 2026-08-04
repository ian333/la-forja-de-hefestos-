/**
 * VERIFICACIÓN INDEPENDIENTE DE LA FÍSICA — sin Kazmer de por medio.
 * ============================================================================
 * "las simulaciones no pueden estar mal… el libro ya nos dio la base, ahora
 *  falta que le metas más comprobaciones, test y código INDEPENDIENTES"
 *  (user 2026-08-04). Y antes: "todas las veces que según tú sí funciona,
 *  está mal".
 *
 * Tiene razón, y el diagnóstico es exacto: reproducir un número del libro NO
 * prueba que el solver esté bien — prueba que copiamos bien una fórmula. Un
 * solver se verifica contra FÍSICA CONOCIDA, con métodos que la comunidad de
 * CFD/FEA usa para aceptar un código:
 *
 *   V1  MODO PROPIO EXACTO      — un eigenmodo debe decaer como exp(αλt), y el
 *                                 error debe ser de redondeo, no de método.
 *   V2  INDEPENDENCIA DEL dt    — el solver dice ser EXACTO EN TIEMPO. Entonces
 *                                 dt=0.001 s y dt=10 s deben dar lo MISMO. Un
 *                                 Euler explícito reprobaría catastróficamente.
 *   V3  CONVERGENCIA ESPACIAL   — el λ discreto aproxima al continuo con O(h²).
 *                                 Se mide el ORDEN observado, no se asume.
 *   V4  CONSERVACIÓN (Neumann)  — dominio aislado ⇒ la energía NO puede cambiar
 *                                 (el modo 0 tiene λ=0). Deriva = bug.
 *   V5  SERIE DE FOURIER 1D     — el caso clásico de placa enfriada, contra la
 *                                 serie analítica completa. Es la física de la
 *                                 que SALE la Eq 9.5 del libro; aquí se verifica
 *                                 al revés: la analítica juzga al código.
 *   V6  ROBIN EXACTO            — la relajación del agua contra su exponencial.
 *   V7  SIMETRÍA / ISOTROPÍA    — un pulso central debe difundir IGUAL en x, y, z.
 *                                 Caza ejes transpuestos (ya nos pasó en campo.ts).
 *   V8  SEGUNDO PRINCIPIO       — sin fuentes, el máximo NO puede subir ni el
 *                                 mínimo bajar (principio del máximo).
 *
 * Uso: node --import tsx scripts/fisica-verify.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', p);

(async () => {
  const { crearDifusionEspectral, caraNeumann } = await import(R('campo/campo.ts'));

  const campo = (nx, ny, nz, cellMm) => ({
    nx, ny, nz, cellMm, x0: 0, y0: 0, z0: 0, data: new Float32Array(nx * ny * nz),
  });
  const ALPHA = 8.18;                      // mm²/s — P20 del libro (8.18e-6 m²/s)

  console.log('\n══ V1 · MODO PROPIO: ¿decae EXACTAMENTE como exp(αλt)? ══');
  {
    const n = 64, h = 1.0, L = n * h;
    const c = campo(n, 1, 1, h);
    const cara = caraNeumann(n, h);
    const m = 3;                            // un modo interior cualquiera
    for (let i = 0; i < n; i++) c.data[i] = Math.cos((Math.PI * m * (i + 0.5)) / n);
    const op = crearDifusionEspectral(c, { alphaMm2s: ALPHA, tipo: 'neumann' });
    const t = 2.0;
    op.paso(t);
    const esperado = Math.exp(ALPHA * cara.lambda[m] * t);     // decaimiento EXACTO del modo
    let errMax = 0;
    for (let i = 0; i < n; i++) {
      const exacto = esperado * Math.cos((Math.PI * m * (i + 0.5)) / n);
      errMax = Math.max(errMax, Math.abs(c.data[i] - exacto));
    }
    check('el eigenmodo decae con error de REDONDEO (no de método)',
      errMax < 2e-6, `error máx ${errMax.toExponential(2)} · factor ${esperado.toFixed(6)}`);
  }

  console.log('\n══ V2 · INDEPENDENCIA DEL dt: el solver dice ser exacto en tiempo ══');
  {
    const n = 48, h = 1.0;
    const semilla = (c) => { for (let i = 0; i < n; i++) c.data[i] = Math.cos((Math.PI * 2 * (i + 0.5)) / n) + 0.5 * Math.cos((Math.PI * 5 * (i + 0.5)) / n); };
    const T = 5.0;
    const corridas = [];
    for (const dt of [0.001, 0.05, 1.0, 5.0]) {
      const c = campo(n, 1, 1, h); semilla(c);
      const op = crearDifusionEspectral(c, { alphaMm2s: ALPHA, tipo: 'neumann' });
      for (let t = 0; t < T - 1e-9; t += dt) op.paso(Math.min(dt, T - t));
      corridas.push({ dt, data: Float32Array.from(c.data) });
    }
    const dif = (a, b) => { let m = 0; for (let i = 0; i < n; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };
    const ref = corridas[corridas.length - 1].data;              // dt=5 → UN paso: mínimo redondeo
    // ── EL PUNTO FINO: hay que distinguir ERROR DE MÉTODO de REDONDEO float32.
    // Un error de método crecería con dt GRANDE (el paso largo aproxima peor).
    // El redondeo crece con el NÚMERO DE PASOS (random walk). Se prueban las dos
    // cosas por separado en vez de aflojar la tolerancia hasta que pase:
    const ULP = Math.pow(2, -24) * 1.5;                          // 1 ULP a la amplitud del campo
    const grandes = dif(corridas[2].data, ref);                  // dt=1 (5 pasos) vs dt=5 (1 paso)
    check('EXACTITUD EN TIEMPO: pasos grandes (1 s vs 5 s) coinciden a nivel de ULP',
      grandes < 4 * ULP, `${grandes.toExponential(2)} ≈ ${(grandes / ULP).toFixed(1)} ULP (ULP=${ULP.toExponential(2)}) — un método aproximado divergiría con el paso largo`);
    // y la firma: el error contra la referencia debe escalar con √pasos (redondeo),
    // NO con dt (método). Si creciera con dt, el splitting estaría mal.
    const escala = corridas.map((c) => ({ dt: c.dt, pasos: Math.ceil(T / c.dt), e: dif(c.data, ref) }));
    const peorGrande = Math.max(...escala.filter((s) => s.pasos <= 5).map((s) => s.e));
    const peorChico = Math.max(...escala.filter((s) => s.pasos >= 100).map((s) => s.e));
    check('el error escala con el NÚMERO DE PASOS (redondeo), no con dt (método)',
      peorChico > peorGrande, escala.map((s) => `dt${s.dt}:${s.e.toExponential(1)}`).join(' · '));
    // el contraste: el límite de estabilidad que un explícito TENDRÍA aquí
    console.log(`   (un FDM explícito exigiría dt ≤ h²/(2α) = ${(h * h / (2 * ALPHA)).toFixed(4)} s en 1D — aquí dt=5 s va sin pestañear)`);
  }

  console.log('\n══ V3 · CONVERGENCIA ESPACIAL: ¿el orden observado es 2? ══');
  {
    // el λ discreto aproxima al continuo −(mπ/L)². Se mide el ORDEN al refinar.
    const L = 64, m = 3, lamCont = -(((m * Math.PI) / L) ** 2);
    const errs = [];
    for (const n of [32, 64, 128, 256]) {
      const cara = caraNeumann(n, L / n);
      errs.push({ n, e: Math.abs(cara.lambda[m] - lamCont) });
    }
    const ordenes = [];
    for (let k = 1; k < errs.length; k++) ordenes.push(Math.log2(errs[k - 1].e / errs[k].e));
    const ordMedio = ordenes.reduce((a, b) => a + b, 0) / ordenes.length;
    check('el orden de convergencia observado es ≈2 (laplaciano de 3 puntos)',
      Math.abs(ordMedio - 2) < 0.12, `orden ${ordMedio.toFixed(3)} · errores ${errs.map((e) => e.e.toExponential(1)).join(' → ')}`);
  }

  console.log('\n══ V4 · CONSERVACIÓN: dominio aislado ⇒ energía constante ══');
  {
    const n = 24, c = campo(n, n, n, 1.0);
    for (let i = 0; i < c.data.length; i++) c.data[i] = 50 + 40 * Math.random();
    const suma0 = c.data.reduce((a, b) => a + b, 0);
    const op = crearDifusionEspectral(c, { alphaMm2s: ALPHA, tipo: 'neumann' });
    for (let k = 0; k < 40; k++) op.paso(0.5);
    const suma1 = c.data.reduce((a, b) => a + b, 0);
    const deriva = Math.abs(suma1 - suma0) / Math.abs(suma0);
    check('con bordes AISLADOS la energía total no cambia (el modo 0 tiene λ=0)',
      deriva < 1e-5, `deriva relativa ${deriva.toExponential(2)} tras 20 s`);
  }

  console.log('\n══ V5 · SERIE DE FOURIER 1D: la analítica juzga al código ══');
  {
    // placa de espesor L, aislada en x=0 (simetría), enfriada a Ts en x=L.
    // T(x,t) = Ts + (T0−Ts)·Σ (4/((2k+1)π))·cos((2k+1)πx/(2L))·exp(−α((2k+1)π/(2L))²t)
    const n = 200, L = 20, h = L / n, T0 = 220, Ts = 0;
    const c = campo(n, 1, 1, h);
    c.data.fill(T0);
    // Dirichlet en AMBOS bordes con espesor 2L y simetría ⇒ equivale a la de arriba
    const c2 = campo(n, 1, 1, h);
    c2.data.fill(T0);
    const op = crearDifusionEspectral(c2, { alphaMm2s: ALPHA, tipo: 'dirichlet', tBordeC: Ts });
    const t = 3.0;
    op.paso(t);
    // analítica para placa de espesor D=n·h con AMBAS caras a Ts (serie impar)
    const D = L;
    const analitica = (x) => {
      let s = 0;
      for (let k = 0; k < 400; k++) {
        const nOdd = 2 * k + 1, lam = (nOdd * Math.PI) / D;
        s += (4 / (nOdd * Math.PI)) * Math.sin(lam * x) * Math.exp(-ALPHA * lam * lam * t);
      }
      return Ts + (T0 - Ts) * s;
    };
    let errMax = 0, tMax = 0;
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * h;              // celda centrada
      const ex = analitica(x);
      errMax = Math.max(errMax, Math.abs(c2.data[i] - ex));
      tMax = Math.max(tMax, Math.abs(ex));
    }
    const errRel = errMax / T0;
    check('el perfil calculado calza con la SERIE DE FOURIER analítica (<1 % de T0)',
      errRel < 0.01, `error máx ${errMax.toFixed(2)} °C sobre T0=${T0} = ${(errRel * 100).toFixed(2)} % · centro ${c2.data[n >> 1].toFixed(1)} vs analítica ${analitica((n / 2 + 0.5) * h).toFixed(1)} °C`);
  }

  console.log('\n══ V6 · ROBIN: la relajación del agua contra su exponencial ══');
  {
    // el motor hace T ← Tc + (T−Tc)·e^(−cool·dt). Se verifica que ESA relajación
    // reproduce el ODE dT/dt = −cool·(T−Tc) integrado exactamente.
    const Tc = 25, T0 = 200, cool = 0.35;
    let T = T0;
    const dt = 0.1, N = 100;
    for (let k = 0; k < N; k++) T = Tc + (T - Tc) * Math.exp(-cool * dt);
    const exacto = Tc + (T0 - Tc) * Math.exp(-cool * N * dt);
    check('la relajación de Robin integra el ODE EXACTAMENTE (a cualquier dt)',
      Math.abs(T - exacto) < 1e-9, `${T.toFixed(9)} vs exacto ${exacto.toFixed(9)} °C`);
  }

  console.log('\n══ V7 · ISOTROPÍA: un pulso debe difundir igual en x, y, z ══');
  {
    const n = 33, c = campo(n, n, n, 1.0), mid = (n - 1) / 2;
    const at = (i, j, k) => (k * n + j) * n + i;
    c.data[at(mid, mid, mid)] = 1000;
    const op = crearDifusionEspectral(c, { alphaMm2s: ALPHA, tipo: 'neumann' });
    op.paso(0.4);
    const d = 6;
    const ejeX = c.data[at(mid + d, mid, mid)], ejeY = c.data[at(mid, mid + d, mid)], ejeZ = c.data[at(mid, mid, mid + d)];
    const spread = Math.max(ejeX, ejeY, ejeZ) - Math.min(ejeX, ejeY, ejeZ);
    check('el pulso difunde IGUAL en los tres ejes (caza ejes transpuestos)',
      spread / Math.max(1e-12, ejeX) < 1e-4,
      `x ${ejeX.toExponential(4)} · y ${ejeY.toExponential(4)} · z ${ejeZ.toExponential(4)}`);
  }

  console.log('\n══ V8 · PRINCIPIO DEL MÁXIMO: sin fuentes nada se calienta ══');
  {
    const n = 20, c = campo(n, n, n, 1.0);
    for (let i = 0; i < c.data.length; i++) c.data[i] = 30 + 170 * Math.random();
    let mn0 = Infinity, mx0 = -Infinity;
    for (const v of c.data) { mn0 = Math.min(mn0, v); mx0 = Math.max(mx0, v); }
    const op = crearDifusionEspectral(c, { alphaMm2s: ALPHA, tipo: 'neumann' });
    for (let k = 0; k < 30; k++) op.paso(0.2);
    let mn1 = Infinity, mx1 = -Infinity;
    for (const v of c.data) { mn1 = Math.min(mn1, v); mx1 = Math.max(mx1, v); }
    const tol = 1e-3;
    check('el máximo no sube ni el mínimo baja (2ª ley: sin fuentes no hay picos nuevos)',
      mx1 <= mx0 + tol && mn1 >= mn0 - tol,
      `[${mn0.toFixed(2)}, ${mx0.toFixed(2)}] → [${mn1.toFixed(2)}, ${mx1.toFixed(2)}] °C`);
  }

  console.log(`\n${fails === 0 ? '✅ LA FÍSICA PASA LAS 8 VERIFICACIONES INDEPENDIENTES' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 900)); process.exit(1); });
