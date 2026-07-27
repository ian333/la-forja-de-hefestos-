/**
 * GATE DEL CAMPO — el sustrato único de simulación + el operador 𝔄 de difusión.
 * ============================================================================
 * "ESTANDARICEMOS EL SISTEMA DE SIMULACIÓN… trabajarlo numéricamente será mejor, ahí
 *  está el operador" (user 2026-07-16). Este gate prueba las TRES capas:
 *
 *  1. LA REJILLA (grad/div/lap/sample) contra campos analíticos — no contra sí misma.
 *  2. LA CARA-𝔦 (DST-I Dirichlet): los modos son eigenfunciones EXACTAS del laplaciano
 *     DISCRETO (precisión de máquina, no "aproximadamente"), la matriz es autoinversa,
 *     y el paso espectral es EXACTO para CUALQUIER dt — mientras el explícito EXPLOTA
 *     pasado su límite de estabilidad. Eso mata el dtMax "de kínder" con evidencia.
 *  3. EL LIBRO: la placa de Kazmer Eq 9.5 — el MISMO ancla de termico-cross (8.4 s con
 *     h=2 mm de ABS) — reproducida por el campo espectral, y la ley t ∝ h² EXACTA.
 *     Tres caminos a la misma física: analítica (Eq 9.5), FDM viejo, y ahora el operador.
 *
 * Uso: node --import tsx scripts/campo-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const C = await import(path.resolve(__dirname, '..', 'src', 'forja', 'campo', 'campo.ts'));

  // ── 1) LA CARA ES AUTOINVERSA (Φ·Φ = I) ──────────────────────────────────
  {
    const n = 17, cara = C.caraDirichlet(n, 1);
    let worst = 0;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      let s = 0;
      for (let t = 0; t < n; t++) s += cara.modos[a * n + t] * cara.modos[b * n + t];
      worst = Math.max(worst, Math.abs(s - (a === b ? 1 : 0)));
    }
    check('la cara DST-I es ORTONORMAL y autoinversa (Φ·Φ = I)', worst < 1e-5, `error máx ${worst.toExponential(1)}`);
  }

  // ── 2) EIGENFUNCIÓN EXACTA: lap(φ_m) = λ_m·φ_m del laplaciano DISCRETO ───
  {
    const n = 33, h = 0.7, cara = C.caraDirichlet(n, h);
    const m = 4;
    const c = C.crearCampo3({ nx: n, ny: 1, nz: 1, cellMm: h });
    for (let i = 0; i < n; i++) c.data[i] = cara.modos[m * n + i];
    const lap = C.laplaciano(c, { borde: 'dirichlet0' });
    let worst = 0;
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(lap.data[i] - cara.lambda[m] * c.data[i]));
    const escala = Math.abs(cara.lambda[m]);
    check('el modo discreto es EIGENFUNCIÓN EXACTA del laplaciano discreto', worst / escala < 1e-5,
      `err relativo ${(worst / escala).toExponential(1)} — máquina, no "aproximado": por eso la evolución modal es EXACTA`);
  }

  // ── 3) EL MATADOR DEL dtMax ───────────────────────────────────────────────
  // 1D, α=1 mm²/s, h=1 mm ⇒ límite explícito dt ≤ h²/(2α) = 0.5 s. Tomamos dt = 3 s (6×).
  {
    const n = 33, h = 1, alpha = 1, dt = 3, m = 2;
    const cara = C.caraDirichlet(n, h);
    const exacto = Math.exp(alpha * cara.lambda[m] * dt);

    const esp = C.crearCampo3({ nx: n, ny: 1, nz: 1, cellMm: h });
    for (let i = 0; i < n; i++) esp.data[i] = cara.modos[m * n + i];
    C.crearDifusionEspectral(esp, { alphaMm2s: alpha }).paso(dt);
    let errEsp = 0;
    for (let i = 0; i < n; i++) errEsp = Math.max(errEsp, Math.abs(esp.data[i] - exacto * cara.modos[m * n + i]));

    const exp2 = C.crearCampo3({ nx: n, ny: 1, nz: 1, cellMm: h });
    for (let i = 0; i < n; i++) exp2.data[i] = cara.modos[m * n + i];
    for (let s = 0; s < 10; s++) C.pasoDifusionExplicito(exp2, { alphaMm2s: alpha, dtS: dt });
    let magExp = 0;
    for (let i = 0; i < n; i++) magExp = Math.max(magExp, Math.abs(exp2.data[i]));

    console.log(`\n  dt = ${dt} s (6× el límite de estabilidad del explícito):`);
    console.log(`    espectral: err ${errEsp.toExponential(1)} vs la solución modal exacta`);
    console.log(`    explícito: |T|máx = ${magExp.toExponential(1)} tras 10 pasos (debía DECAER)`);
    check('el paso ESPECTRAL es exacto con dt 6× el límite (adiós dtMax y sub-pasos)', errEsp < 1e-4, `err ${errEsp.toExponential(1)}`);
    // el criterio HONESTO: la física manda DECAER (a exacto·amplitud ≈ 0.18); si el
    // explícito CRECE, es inestable. Con el arranque en un modo suave la explosión brota
    // del REDONDEO float32 (los modos tiesos crecen ×11 por paso): a 10 pasos ya va en
    // ~65 — 350× lo físico. Pedir "1e3" era pedirle a la bomba que terminara de estallar.
    const fisico = Math.abs(exacto) * 0.25;
    check('el paso EXPLÍCITO con ese mismo dt CRECE cuando la física manda DECAER (inestable)',
      !Number.isFinite(magExp) || magExp > 40 * fisico,
      `|T|máx ${Number.isFinite(magExp) ? magExp.toFixed(1) : 'NaN'} vs ${fisico.toFixed(3)} físico — por eso los FDM iban a sub-pasitos`);
  }

  // ── 4) 3D NO-CÚBICO: producto tensor de LUTs + ida-y-vuelta ──────────────
  // nx≠ny≠nz A PROPÓSITO: la 1ª versión de aplicarEje tenía el eje z TRANSPUESTO y con
  // rejilla cúbica ese bug es INVISIBLE (la transposición permuta líneas válidas).
  {
    const nx = 9, ny = 7, nz = 5, h = 1, alpha = 0.8, dt = 0.9;
    const cx = C.caraDirichlet(nx, h), cy = C.caraDirichlet(ny, h), cz = C.caraDirichlet(nz, h);
    const mx = 1, my = 2, mz = 0;
    const c = C.crearCampo3({ nx, ny, nz, cellMm: h });
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
      c.data[C.idx3(c, i, j, k)] = cx.modos[mx * nx + i] * cy.modos[my * ny + j] * cz.modos[mz * nz + k];
    const factor = Math.exp(alpha * (cx.lambda[mx] + cy.lambda[my] + cz.lambda[mz]) * dt);
    C.crearDifusionEspectral(c, { alphaMm2s: alpha }).paso(dt);
    let worst = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const esperado = factor * cx.modos[mx * nx + i] * cy.modos[my * ny + j] * cz.modos[mz * nz + k];
      worst = Math.max(worst, Math.abs(c.data[C.idx3(c, i, j, k)] - esperado));
    }
    check('3D no-cúbico: el modo producto decae exp(α(λx+λy+λz)dt) EXACTO', worst < 1e-4,
      `err ${worst.toExponential(1)} en 9×7×5 — ex[mx]·ey[my]·ez[mz]: el producto tensor de LUTs 1D del framework`);

    // ida-y-vuelta pura (dt=0 ⇒ LUT=1 ⇒ transformar + destransformar = identidad)
    const r = C.crearCampo3({ nx, ny, nz, cellMm: h });
    for (let t = 0; t < r.data.length; t++) r.data[t] = Math.sin(t * 12.9898) * 43758.5453 % 1;
    const antes = Float32Array.from(r.data);
    C.crearDifusionEspectral(r, { alphaMm2s: alpha }).paso(0);
    let dmax = 0;
    for (let t = 0; t < r.data.length; t++) dmax = Math.max(dmax, Math.abs(r.data[t] - antes[t]));
    check('ida-y-vuelta = identidad en rejilla NO cúbica (caza el eje transpuesto)', dmax < 1e-4, `desvío máx ${dmax.toExponential(1)}`);
  }

  // ── 5) div(grad f) ≈ ∇²f analítico (los operadores vectoriales cuadran) ──
  {
    const n = 64, L = 32, h = L / n, k1 = (2 * Math.PI) / L, k2 = (4 * Math.PI) / L;
    const c = C.crearCampo3({ nx: n, ny: n, nz: 1, cellMm: h });
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++)
      c.data[C.idx3(c, i, j, 0)] = Math.sin(k1 * (i + 0.5) * h) * Math.cos(k2 * (j + 0.5) * h);
    const dg = C.divergencia(C.gradiente(c));
    let worst = 0, escala = (k1 * k1 + k2 * k2);
    for (let j = 4; j < n - 4; j++) for (let i = 4; i < n - 4; i++) {
      const t = C.idx3(c, i, j, 0);
      worst = Math.max(worst, Math.abs(dg.data[t] - (-(k1 * k1 + k2 * k2) * c.data[t])));
    }
    check('div(grad f) = −(k1²+k2²)·f analítico (interior, O(h²))', worst / escala < 0.03,
      `err rel ${(worst / escala).toExponential(1)} — la rejilla vectorial cuadra con el cálculo`);
  }

  // ── 6) EL ANCLA DEL LIBRO: Eq 9.5, la placa de ABS ────────────────────────
  // Kazmer §9.1: t_c = h²/(π²α)·ln(4/π·(Tm−Tc)/(Te−Tc)). ABS del libro (α=8.69e-8 m²/s,
  // 239→97.6 °C con agua a 60): h=2 mm ⇒ 8.40 s — EL MISMO ancla de termico-cross.
  // Aquí lo reproduce EL CAMPO: pared Dirichlet a 60, arranque uniforme a 239, y medimos
  // cuándo el CENTRO cruza 97.6. Tercer camino a la misma física.
  {
    const alpha = 8.69e-8 * 1e6;                          // m²/s → mm²/s
    const Tm = 239, Tc = 60, Te = 97.6;
    const simSlab = (hMm) => {
      const n = 127, cell = hMm / (n + 1);                // paredes = los fantasmas
      const c = C.crearCampo3({ nx: n, ny: 1, nz: 1, cellMm: cell, fill: Tm });
      const op = C.crearDifusionEspectral(c, { alphaMm2s: alpha, tBordeC: Tc });
      const centro = (n - 1) / 2, dt = 0.02;
      let t = 0, prevT = Tm;
      for (let s = 0; s < 4000; s++) {
        op.paso(dt); t += dt;
        const Tcen = c.data[centro];
        if (Tcen <= Te) {
          // cruce interpolado linealmente dentro del último paso
          return t - dt * (Te - Tcen) / (prevT - Tcen);
        }
        prevT = Tcen;
      }
      return Infinity;
    };
    const t2 = simSlab(2), t4 = simSlab(4);
    const teo = (h) => (h / 1000) ** 2 / (Math.PI * Math.PI * 8.69e-8) * Math.log((4 / Math.PI) * (Tm - Tc) / (Te - Tc));
    console.log(`\n  placa h=2 mm: campo ${t2.toFixed(2)} s · Eq 9.5 ${teo(2).toFixed(2)} s · libro 8.4 s`);
    console.log(`  placa h=4 mm: campo ${t4.toFixed(2)} s · Eq 9.5 ${teo(4).toFixed(2)} s`);
    check('EL CAMPO reproduce la placa del libro (Eq 9.5: 8.4 s)', Math.abs(t2 - 8.40) < 0.2,
      `${t2.toFixed(2)} s — el MISMO ancla que termico-cross: tercer camino a la misma física`);
    check('la ley t ∝ h² sale EXACTA (la prueba fuerte: no depende de α ni de las T)',
      Math.abs(t4 / t2 - 4.0) < 0.05, `t(4)/t(2) = ${(t4 / t2).toFixed(3)} (teoría: 4.000)`);
  }

  // ── 7) TAMAÑO REAL: ¿aguanta la rejilla de un molde? ──────────────────────
  {
    const n = 48;
    const c = C.crearCampo3({ nx: n, ny: n, nz: n, cellMm: 1, fill: 100 });
    const op = C.crearDifusionEspectral(c, { alphaMm2s: 0.08, tBordeC: 20 });
    const t0 = Date.now();
    op.paso(5);                                            // 5 s de física en UN paso
    const ms = Date.now() - t0;
    console.log(`\n  48³ = ${n ** 3} vóxeles · un paso espectral (5 s de física): ${ms} ms`);
    check('un paso espectral 48³ corre en tiempo interactivo (< 900 ms)', ms < 900,
      `${ms} ms — y es EXACTO: el FDM viejo necesitaba ~${Math.ceil(5 / (1 / (6 * 0.08))).toLocaleString()} sub-pasos para esos 5 s`);
  }


  // ── 8) LA CARA NEUMANN (la rotación que pidió el molde del CAD) ───────────
  // bordes AISLADOS: fantasmas de COPIA. Eigen exacta + vuelta por ADJUNTA (la DCT-II
  // no es autoinversa) + la física: λ₀=0 ⇒ un bloque aislado CONSERVA su calor.
  {
    const n = 33, h = 0.8, cara = C.caraNeumann(n, h), m = 5;
    const c = C.crearCampo3({ nx: n, ny: 1, nz: 1, cellMm: h });
    for (let i = 0; i < n; i++) c.data[i] = cara.modos[m * n + i];
    const lap = C.laplaciano(c, { borde: 'copia' });
    let worst = 0;
    for (let i = 0; i < n; i++) worst = Math.max(worst, Math.abs(lap.data[i] - cara.lambda[m] * c.data[i]));
    check('NEUMANN: el modo coseno es eigen EXACTA del laplaciano con borde de copia',
      worst / Math.abs(cara.lambda[m]) < 1e-5, `err rel ${(worst / Math.abs(cara.lambda[m])).toExponential(1)}`);

    // ida-y-vuelta con adjunta, rejilla NO cúbica (el mismo cazador del eje transpuesto)
    const r = C.crearCampo3({ nx: 9, ny: 7, nz: 5, cellMm: 1 });
    for (let t = 0; t < r.data.length; t++) r.data[t] = Math.sin(t * 7.13) * 0.9;
    const antes = Float32Array.from(r.data);
    C.crearDifusionEspectral(r, { alphaMm2s: 1, tipo: 'neumann' }).paso(0);
    let dmax = 0;
    for (let t = 0; t < r.data.length; t++) dmax = Math.max(dmax, Math.abs(r.data[t] - antes[t]));
    check('NEUMANN: ida-y-vuelta (adjunta) = identidad en 9×7×5', dmax < 1e-4, `desvío ${dmax.toExponential(1)}`);

    // λ₀ = 0: campo UNIFORME a 150 °C, paso enorme → sigue a 150 (aislado no pierde)
    const u = C.crearCampo3({ nx: 17, ny: 13, nz: 9, cellMm: 1, fill: 150 });
    C.crearDifusionEspectral(u, { alphaMm2s: 5, tipo: 'neumann' }).paso(50);
    let umin = 1e9, umax = -1e9;
    for (let t = 0; t < u.data.length; t++) { umin = Math.min(umin, u.data[t]); umax = Math.max(umax, u.data[t]); }
    check('NEUMANN: el bloque AISLADO conserva su calor (λ₀=0 — la física, no un default)',
      Math.abs(umin - 150) < 1e-3 && Math.abs(umax - 150) < 1e-3, `campo uniforme 150 °C tras 50 s: [${umin.toFixed(3)}, ${umax.toFixed(3)}]`);
  }

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ CAMPO: rejilla única verificada contra ANALÍTICA · la cara-𝔦 es eigen EXACTA y el paso espectral no tiene dtMax (el explícito explota, el operador no) · y reproduce la placa del libro (8.4 s) con t∝h² exacta');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
