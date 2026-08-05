/**
 * GATE DE L19 — MAPA DE VON MISES EN SECCIÓN (Kazmer cap. 12 · V12.1 V12.2 V12.3 V12.12)
 * =====================================================================================
 * El libro NO se usa como vara: reproducir un número publicado sólo prueba que se copió
 * bien una fórmula. Este solver se verifica contra ELASTICIDAD ANALÍTICA, con los mismos
 * invariantes con los que la comunidad de FEA acepta un código:
 *
 *  A · MALLA          — todo quad con área POSITIVA (orientación), frontera cerrada, y
 *                       `partirMalla` realmente separa las dos mitades (0 nodos comunes).
 *  B1 TRACCIÓN UNIAXIAL (esfuerzo plano) ⇒ σ_vm = σ aplicada, EXACTO.
 *  B2 CORTANTE PURO                      ⇒ σ_vm = √3·τ, EXACTO.
 *  B3 HIDROSTÁTICA — dos caras:
 *       (a) la FÓRMULA: vonMises(−p,−p,−p) = 0 exacto (caza casi cualquier error de σ_vm).
 *       (b) el SOLVER en deformación plana: presión p en todo el contorno ⇒ σxx=σyy=−p y
 *           σzz = ν(σxx+σyy) = −2νp, así que σ_vm = p(1−2ν) EXACTO. (En 2D no se puede
 *           imponer un estado hidrostático 3D: el confinamiento fuera del plano lo impide;
 *           por eso el cero se verifica en la fórmula y el estado en el solver.)
 *  B4 PATCH TEST en malla DISTORSIONADA — campo de desplazamiento LINEAL prescrito en la
 *     frontera ⇒ esfuerzo CONSTANTE exacto adentro. Es el test que valida el mapeo
 *     isoparamétrico y el ensamble sobre elementos torcidos.
 *  B5 KIRSCH — placa infinita con agujero a tracción ⇒ Kt = 3.0 EXACTO, y σθθ(θ=0) = −σ.
 *     Se modela un cuarto de anillo con la TRACCIÓN ANALÍTICA en r=R: así no hay error de
 *     "placa finita" y lo único que se mide es el error del método. ES EL CHECK QUE DECIDE
 *     SI V12.12 VALE ALGO.
 *  B6 CONVERGENCIA de B5 al refinar (orden observado, no supuesto).
 *  B7 VIGA EN FLEXIÓN PURA ⇒ σ = M·c/I (I de `structural.rectInertia`, el motor que ya existe).
 *  C1 EQUILIBRIO GLOBAL del modelo de sección: ∫σyy dx en CUALQUIER corte = −p·w_cavidad.
 *  C2 V12.2 — la asimetría del libro EMERGE (no se programa): el lado móvil flexiona ≫ el fijo.
 *  C3 CONVERGENCIA de las métricas del veredicto al refinar la malla de la sección.
 *  C4 la SINGULARIDAD de esquina viva NO converge (crece) ⇒ está bien apartada del veredicto.
 *  C5 V12.12 — hay concentración medida en cada barreno y es estable con la malla.
 *  C6 lo NO medido NO se aprueba: los barrenos con eje paralelo al corte salen SIN CABLEAR.
 *  D  NÚMEROS DEL LIBRO Y SUS ERRATAS (456 vs 450 del P20 · 545 vs 420 del QC7 · el aluminio
 *     sin límite de fatiga · K = 3.1+0.75(⌀/H)^2.29 reproduce el 3.4 publicado).
 *  E  LA LÁMINA — escala FIJA (no auto-escalada), y sin σ_limit no aprueba nada.
 *
 * Uso: node --import tsx scripts/mold-vonmises-test.cjs
 */
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', p);
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

(async () => {
  const V = await import(R('mold/lamina-vonmises.ts'));
  const ST = await import(R('mold/structural.ts'));
  const FM = await import(path.resolve(__dirname, '..', 'src', 'lib', 'formulas.ts'));
  const OUT = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(OUT, { recursive: true });
  const res = {};

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ A · LA MALLA ES VÁLIDA ══');
  // ══════════════════════════════════════════════════════════════════════════
  const c8 = V.campoVonMises(V.seccionBezelLibro({ hMallaMm: 8 }));
  const c5 = V.campoVonMises(V.seccionBezelLibro({ hMallaMm: 5 }));
  {
    const cruda = { malla: c8.malla };     // ya viene de mallaSeccion + partirMalla
    let neg = 0, minA = Infinity;
    for (let e = 0; e < cruda.malla.nQuads; e++) {
      const a = V.areaQuadFirmada(cruda.malla, e);
      if (a <= 0) neg++;
      minA = Math.min(minA, a);
    }
    check('A1 todo quad con área POSITIVA (orientación antihoraria)', neg === 0,
      `${cruda.malla.nQuads} quads · área mínima ${minA.toExponential(2)} mm²`);

    // la frontera libre debe formar ciclos: cada nodo de frontera, una entrada y una salida
    const bl = V.bordesLibres(cruda.malla);
    const ent = new Map(), sal = new Map();
    for (const b of bl) { sal.set(b.a, (sal.get(b.a) ?? 0) + 1); ent.set(b.b, (ent.get(b.b) ?? 0) + 1); }
    let malCerrada = 0;
    for (const k of new Set([...ent.keys(), ...sal.keys()])) if ((ent.get(k) ?? 0) !== (sal.get(k) ?? 0)) malCerrada++;
    check('A2 la frontera libre CIERRA (malla conforme, sin grietas)', malCerrada === 0,
      `${bl.length} bordes libres · ${malCerrada} nodos descuadrados`);

    // partirMalla: ningún nodo compartido entre arriba y abajo del plano de partición
    const yc = c8.yParticion;
    const part = cruda.malla;
    const arriba = new Set(), abajo = new Set();
    for (let e = 0; e < part.nQuads; e++) {
      let ym = 0;
      for (let k = 0; k < 4; k++) ym += part.xy[2 * part.quads[4 * e + k] + 1];
      const s = ym / 4 >= yc ? arriba : abajo;
      for (let k = 0; k < 4; k++) s.add(part.quads[4 * e + k]);
    }
    let comunes = 0;
    for (const n of abajo) if (arriba.has(n)) comunes++;
    check('A3 partirMalla SEPARA de verdad las dos mitades', comunes === 0,
      `${comunes} nodos compartidos entre lado fijo y móvil (deben ser 0)`);
    res.quadsSeccion = cruda.malla.nQuads;
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ B · ELASTICIDAD ANALÍTICA (la vara de medir) ══');
  // ══════════════════════════════════════════════════════════════════════════
  const L = 100, Hh = 60;
  // ── B1 tracción uniaxial
  {
    const S = 137.5;
    const m = V.mallaRect(0, 0, L, Hh, 7, 5);
    const bl = V.bordesLibres(m);
    const fijos = [];
    for (let i = 0; i < m.nNodos; i++) {
      const x = m.xy[2 * i], y = m.xy[2 * i + 1];
      if (Math.abs(x) < 1e-9) fijos.push({ nodo: i, ux: true });
      if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) fijos.push({ nodo: i, uy: true });
    }
    const tr = bl.filter((b) => Math.abs(b.mx - L) < 1e-9).map((b) => ({ a: b.a, b: b.b, t: () => [S, 0] }));
    const s = V.resolverElasticidad2D(m, { estado: 'esfuerzo-plano', fijos, tracciones: tr, tol: 1e-13 });
    let eVM = 0, eXX = 0;
    for (let i = 0; i < m.nNodos; i++) { eVM = Math.max(eVM, Math.abs(s.vm[i] - S)); eXX = Math.max(eXX, Math.abs(s.sxx[i] - S)); }
    check('B1 tracción uniaxial ⇒ σ_vm = σ EXACTO', eVM / S < 1e-8,
      `máx |σ_vm − ${S}| = ${eVM.toExponential(2)} MPa (rel ${(eVM / S).toExponential(2)}) · máx |σxx − σ| = ${eXX.toExponential(2)}`);
    res.errUniaxial = eVM / S;
  }
  // ── B2 cortante puro
  {
    const T = 88;
    const m = V.mallaRect(0, 0, L, Hh, 7, 5);
    const bl = V.bordesLibres(m);
    const fijos = [];
    for (let i = 0; i < m.nNodos; i++) {
      const x = m.xy[2 * i], y = m.xy[2 * i + 1];
      if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) fijos.push({ nodo: i, ux: true, uy: true });
      if (Math.abs(x - L) < 1e-9 && Math.abs(y) < 1e-9) fijos.push({ nodo: i, uy: true });
    }
    const tr = bl.map((b) => ({ a: b.a, b: b.b, t: () => [T * b.ny, T * b.nx] }));
    const s = V.resolverElasticidad2D(m, { estado: 'esfuerzo-plano', fijos, tracciones: tr, tol: 1e-13 });
    const exacto = Math.sqrt(3) * T;
    let e = 0;
    for (let i = 0; i < m.nNodos; i++) e = Math.max(e, Math.abs(s.vm[i] - exacto));
    check('B2 cortante puro ⇒ σ_vm = √3·τ EXACTO', e / exacto < 1e-8,
      `máx |σ_vm − ${exacto.toFixed(4)}| = ${e.toExponential(2)} MPa (rel ${(e / exacto).toExponential(2)})`);
    res.errCortante = e / exacto;
  }
  // ── B3 hidrostática
  {
    const p = 90, nu = V.NU_ACERO;
    const cero = FM.vonMisesStress([-p, -p, -p, 0, 0, 0]);
    check('B3a la FÓRMULA: von Mises de una hidrostática pura (−p,−p,−p) = 0', cero === 0,
      `σ_vm = ${cero} (exactamente cero, no "casi")`);
    const m = V.mallaRect(0, 0, L, Hh, 7, 5);
    const bl = V.bordesLibres(m);
    const fijos = [];
    for (let i = 0; i < m.nNodos; i++) {
      const x = m.xy[2 * i], y = m.xy[2 * i + 1];
      if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) fijos.push({ nodo: i, ux: true, uy: true });
      if (Math.abs(x - L) < 1e-9 && Math.abs(y) < 1e-9) fijos.push({ nodo: i, uy: true });
    }
    const s = V.resolverElasticidad2D(m, {
      estado: 'deformacion-plana', fijos, presiones: bl.map((b) => ({ a: b.a, b: b.b, pMPa: p })), tol: 1e-13,
    });
    const vmEx = p * (1 - 2 * nu);
    let eS = 0, eZ = 0, eV = 0;
    for (let i = 0; i < m.nNodos; i++) {
      eS = Math.max(eS, Math.abs(s.sxx[i] + p), Math.abs(s.syy[i] + p));
      eZ = Math.max(eZ, Math.abs(s.szz[i] + 2 * nu * p));
      eV = Math.max(eV, Math.abs(s.vm[i] - vmEx));
    }
    check('B3b el SOLVER: presión p en todo el contorno (def. plana) ⇒ σxx=σyy=−p, σzz=−2νp, σ_vm=p(1−2ν)',
      eS / p < 1e-8 && eZ / p < 1e-8 && eV / p < 1e-8,
      `err σxx ${eS.toExponential(2)} · σzz ${eZ.toExponential(2)} · σ_vm ${eV.toExponential(2)} MPa (σ_vm exacto ${vmEx})`);
    res.errHidro = eV / p;
  }
  // ── B4 patch test en malla distorsionada
  {
    const n = 4, W2 = 40, H2 = 30;
    const xy = [], quads = [];
    const rnd = (i, j) => 0.5 * Math.sin(12.9898 * i + 78.233 * j) % 1;   // determinista
    const id = (i, j) => j * (n + 1) + i;
    for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
      const borde = i === 0 || j === 0 || i === n || j === n;
      const dx = borde ? 0 : rnd(i, j) * (W2 / n) * 0.35;
      const dy = borde ? 0 : rnd(j, i) * (H2 / n) * 0.35;
      xy.push((W2 * i) / n + dx, (H2 * j) / n + dy);
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) quads.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
    const m = { xy: Float64Array.from(xy), quads: Uint32Array.from(quads), nNodos: (n + 1) ** 2, nQuads: n * n };
    // campo lineal: exx=1e-4, eyy=-6e-5, gxy=8e-5
    const exx = 1e-4, eyy = -6e-5, gxy = 8e-5;
    const ux = (x, y) => exx * x + gxy * y, uy = (x, y) => eyy * y;
    const fijos = [];
    for (let i = 0; i < m.nNodos; i++) {
      const x = m.xy[2 * i], y = m.xy[2 * i + 1];
      if (x > 1e-9 && x < W2 - 1e-9 && y > 1e-9 && y < H2 - 1e-9) continue;
      fijos.push({ nodo: i, ux: true, uy: true, uxVal: ux(x, y), uyVal: uy(x, y) });
    }
    const s = V.resolverElasticidad2D(m, { estado: 'esfuerzo-plano', fijos, tol: 1e-14 });
    const E = V.E_ACERO_MPA, nu = V.NU_ACERO, kk = E / (1 - nu * nu);
    const sxxEx = kk * (exx + nu * eyy), syyEx = kk * (eyy + nu * exx), sxyEx = ((kk * (1 - nu)) / 2) * gxy;
    let e = 0;
    for (let i = 0; i < m.nNodos; i++) {
      e = Math.max(e, Math.abs(s.sxx[i] - sxxEx), Math.abs(s.syy[i] - syyEx), Math.abs(s.sxy[i] - sxyEx));
    }
    check('B4 PATCH TEST en malla distorsionada ⇒ esfuerzo CONSTANTE exacto', e / Math.abs(sxxEx) < 1e-8,
      `máx error ${e.toExponential(2)} MPa sobre σxx=${sxxEx.toFixed(2)} σyy=${syyEx.toFixed(2)} σxy=${sxyEx.toFixed(2)}`);
    res.errPatch = e / Math.abs(sxxEx);
  }
  // ── B5/B6 KIRSCH
  console.log('\n── B5/B6 · KIRSCH: placa infinita con agujero ⇒ Kt = 3.0 EXACTO ──');
  {
    const S = 100, a = 5, Rout = 50;
    const errs = [];
    for (const [nr, nt] of [[20, 32], [40, 64], [80, 128]]) {
      const m = V.mallaAnularCuarto(a, Rout, nr, nt);
      const bl = V.bordesLibres(m);
      const fijos = [];
      for (let i = 0; i < m.nNodos; i++) {
        if (Math.abs(m.xy[2 * i + 1]) < 1e-9) fijos.push({ nodo: i, uy: true });
        if (Math.abs(m.xy[2 * i]) < 1e-9) fijos.push({ nodo: i, ux: true });
      }
      const rr = (i) => Math.hypot(m.xy[2 * i], m.xy[2 * i + 1]);
      const tr = bl.filter((b) => rr(b.a) > Rout * 0.999 && rr(b.b) > Rout * 0.999)
        .map((b) => ({ a: b.a, b: b.b, t: (x, y) => V.kirschTraccion(S, a, x, y) }));
      const s = V.resolverElasticidad2D(m, { estado: 'esfuerzo-plano', fijos, tracciones: tr, tol: 1e-13, maxIter: 80000 });
      let n90 = -1, n0 = -1, d9 = Infinity, d0 = Infinity;
      for (let i = 0; i < m.nNodos; i++) {
        const x = m.xy[2 * i], y = m.xy[2 * i + 1];
        const a9 = Math.hypot(x, y - a), a0 = Math.hypot(x - a, y);
        if (a9 < d9) { d9 = a9; n90 = i; }
        if (a0 < d0) { d0 = a0; n0 = i; }
      }
      // en θ=90° e_θ = (−1,0) ⇒ σθθ = σxx · en θ=0 e_θ = (0,1) ⇒ σθθ = σyy
      const kt = s.sxx[n90] / S, ktBorde0 = s.syy[n0] / S;
      const err = Math.abs(kt - 3) / 3;
      errs.push({ nr, nt, nodos: m.nNodos, kt, err, ktBorde0 });
      console.log(`    nr=${String(nr).padStart(3)} nt=${String(nt).padStart(3)} (${String(m.nNodos).padStart(5)} nodos): Kt = ${kt.toFixed(5)}  err ${(100 * err).toFixed(3)} %   σθθ(θ=0)/σ = ${ktBorde0.toFixed(4)} (exacto −1)`);
    }
    const fino = errs[errs.length - 1];
    check('B5 KIRSCH: Kt(θ=90°) = 3.0 en la malla fina', fino.err < 0.005,
      `Kt = ${fino.kt.toFixed(5)} vs 3.0 exacto ⇒ error ${(100 * fino.err).toFixed(3)} % (tolerancia 0.5 %)`);
    check('B5b KIRSCH: σθθ(θ=0°) = −σ (el otro punto exacto de la solución)',
      Math.abs(fino.ktBorde0 + 1) < 0.02,
      `${fino.ktBorde0.toFixed(4)} vs −1 exacto ⇒ error ${(100 * Math.abs(fino.ktBorde0 + 1)).toFixed(2)} %`);
    const orden = Math.log(errs[0].err / errs[2].err) / Math.log(4);
    check('B6 CONVERGENCIA: el error de Kt BAJA monótono al refinar (orden observado > 1)',
      errs[0].err > errs[1].err && errs[1].err > errs[2].err && orden > 1,
      `${(100 * errs[0].err).toFixed(3)} % → ${(100 * errs[1].err).toFixed(3)} % → ${(100 * errs[2].err).toFixed(3)} % · orden ≈ ${orden.toFixed(2)}`);
    res.kirschKt = +fino.kt.toFixed(5);
    res.kirschErrPct = +(100 * fino.err).toFixed(4);
    res.kirschOrden = +orden.toFixed(2);
  }
  // ── B7 viga en flexión pura
  {
    const Lb = 200, hb = 40, cb = hb / 2, Mb = 2.0e6;
    const I = ST.rectInertia(1, hb);                 // el motor que YA existe (Ec. 12.11)
    const sigEx = (Mb * cb) / I;
    const m = V.mallaRect(0, -cb, Lb, cb, 80, 16);
    const bl = V.bordesLibres(m);
    const tr = [];
    for (const b of bl) {
      if (Math.abs(b.mx - Lb) < 1e-9) tr.push({ a: b.a, b: b.b, t: (x, y) => [(Mb * y) / I, 0] });
      if (Math.abs(b.mx) < 1e-9) tr.push({ a: b.a, b: b.b, t: (x, y) => [(-Mb * y) / I, 0] });
    }
    const fijos = [];
    for (let i = 0; i < m.nNodos; i++) {
      const x = m.xy[2 * i], y = m.xy[2 * i + 1];
      if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) fijos.push({ nodo: i, ux: true, uy: true });
      if (Math.abs(x - Lb) < 1e-9 && Math.abs(y) < 1e-9) fijos.push({ nodo: i, uy: true });
    }
    const s = V.resolverElasticidad2D(m, { estado: 'esfuerzo-plano', fijos, tracciones: tr, tol: 1e-13, maxIter: 80000 });
    let bi = -1, bd = Infinity;
    for (let i = 0; i < m.nNodos; i++) {
      const d = Math.hypot(m.xy[2 * i] - Lb / 2, m.xy[2 * i + 1] - cb);
      if (d < bd) { bd = d; bi = i; }
    }
    const err = rel(s.sxx[bi], sigEx);
    check('B7 viga en flexión pura ⇒ σ = M·c/I (I de structural.rectInertia)', err < 0.005,
      `σ_fibra = ${s.sxx[bi].toFixed(2)} vs M·c/I = ${sigEx.toFixed(2)} MPa ⇒ error ${(100 * err).toFixed(3)} % (I = ${I.toExponential(3)} mm⁴)`);
    res.errVigaPct = +(100 * err).toFixed(3);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ C · EL MODELO DE LA SECCIÓN DEL MOLDE ══');
  // ══════════════════════════════════════════════════════════════════════════
  {
    const mod = c8.modelo, P = mod.placas;
    const yBC = P.bottomClamp, yEH = yBC + P.ejectorHousing, ySup = yEH + P.support;
    const yPart = ySup + P.B, Htot = yPart + P.A + P.topClamp;
    const Fesperada = -mod.pFundidoMPa * mod.cavidadAnchoMm;         // N/mm, compresión
    const cortes = [[8, 'platina móvil'], [ySup - P.support / 2, 'placa de soporte'],
      [yPart - P.B / 2, 'placa B (núcleo)'], [yPart + P.A / 2, 'placa A (cavidad)'], [Htot - 8, 'platina fija']];
    let peor = 0, peorFino = 0;
    for (const [y, et] of cortes) {
      const Rc = V.resultanteYY(c8.malla, c8.sol, y);
      const e = rel(Rc, Fesperada);
      peor = Math.max(peor, e);
      peorFino = Math.max(peorFino, rel(V.resultanteYY(c5.malla, c5.sol, y), Fesperada));
      console.log(`    corte en ${et.padEnd(18)} y=${String(Math.round(y)).padStart(3)}: ∫σyy dx = ${Rc.toFixed(0)} N/mm (esperado ${Fesperada.toFixed(0)}) err ${(100 * e).toFixed(2)} %`);
    }
    check('C1 EQUILIBRIO GLOBAL: ∫σyy dx = −p·w_cavidad en TODO corte horizontal', peor < 0.01,
      `peor error ${(100 * peor).toFixed(2)} % sobre ${Fesperada.toFixed(0)} N/mm — si esto falla, la carga o los apoyos están mal`);
    // el residuo restante es SUAVIZADO del campo recuperado, no desequilibrio: converge.
    check('C1b y ese residuo CONVERGE al refinar (es discretización, no un apoyo mal puesto)',
      peorFino < peor * 0.7,
      `peor error ${(100 * peor).toFixed(2)} % con h=8 mm → ${(100 * peorFino).toFixed(2)} % con h=5 mm`);
    res.equilibrioErrPct = +(100 * peor).toFixed(3);
    res.equilibrioErrPctFino = +(100 * peorFino).toFixed(3);
  }
  {
    const f = c8.lados.fijo, mv = c8.lados['móvil'];
    console.log(`    FIJO : compresión σyy ${f.fibras.compresionYYMPa.toFixed(1)} MPa · flexión ±${Math.abs(f.fibras.flexionMPa).toFixed(1)} MPa · σ1 max ${f.sigma1MaxMPa.toFixed(1)}`);
    console.log(`    MÓVIL: compresión σyy ${mv.fibras.compresionYYMPa.toFixed(1)} MPa · flexión ±${Math.abs(mv.fibras.flexionMPa).toFixed(1)} MPa · σ1 max ${mv.sigma1MaxMPa.toFixed(1)}`);
    check('C2 V12.2 la ASIMETRÍA del libro EMERGE: el lado móvil flexiona ≫ el fijo',
      c8.asimetriaFlexion > 3,
      `flexión móvil/fijo = ${c8.asimetriaFlexion.toFixed(2)}× — "very little out of plane bending" del lado fijo vs "significant plate bending" del móvil`);
    check('C2b el lado fijo baja la carga a COMPRESIÓN (σyy negativo y flexión chica)',
      f.fibras.compresionYYMPa < 0 && Math.abs(f.fibras.flexionMPa) < Math.abs(f.fibras.compresionYYMPa),
      `σyy ${f.fibras.compresionYYMPa.toFixed(1)} MPa vs flexión ±${Math.abs(f.fibras.flexionMPa).toFixed(1)} MPa`);
    check('C2c el lado móvil cambia de SIGNO entre sus dos fibras (flexión pura de placa)',
      mv.fibras.sxxInfMPa * mv.fibras.sxxSupMPa < 0,
      `fibra inferior ${mv.fibras.sxxInfMPa.toFixed(1)} MPa / superior ${mv.fibras.sxxSupMPa.toFixed(1)} MPa`);
    res.asimetriaFlexion = +c8.asimetriaFlexion.toFixed(2);
  }
  {
    const e1 = rel(c5.sigmaMaxMPa, c8.sigmaMaxMPa);
    const e2 = rel(Math.abs(c5.lados['móvil'].fibras.flexionMPa), Math.abs(c8.lados['móvil'].fibras.flexionMPa));
    check('C3 CONVERGENCIA de malla: σ_max y la flexión no cambian al refinar h 8 → 5 mm',
      e1 < 0.02 && e2 < 0.02,
      `σ_max ${c8.sigmaMaxMPa.toFixed(1)} → ${c5.sigmaMaxMPa.toFixed(1)} MPa (${(100 * e1).toFixed(2)} %) · flexión ${Math.abs(c8.lados['móvil'].fibras.flexionMPa).toFixed(1)} → ${Math.abs(c5.lados['móvil'].fibras.flexionMPa).toFixed(1)} MPa (${(100 * e2).toFixed(2)} %)`);
    check('C4 la SINGULARIDAD de esquina viva NO converge (crece al refinar) ⇒ bien apartada',
      c5.sigmaEsquinaMPa > c8.sigmaEsquinaMPa * 1.02,
      `pico en esquina ${c8.sigmaEsquinaMPa.toFixed(0)} → ${c5.sigmaEsquinaMPa.toFixed(0)} MPa · apartado en discos de ${c8.rSingularidadMm} mm (${c8.areaExcluidaMm2.toFixed(0)} mm² fuera del veredicto)`);
    res.sigmaMaxMPa = +c8.sigmaMaxMPa.toFixed(1);
    res.sigmaEsquinaMPa = +c8.sigmaEsquinaMPa.toFixed(1);
    res.convSigmaMaxPct = +(100 * e1).toFixed(2);
  }
  {
    let peorK = 0, minK = Infinity;
    for (const b of c8.barrenos) {
      const g = c5.barrenos.find((z) => Math.abs(z.x - b.x) < 1e-6 && Math.abs(z.y - b.y) < 1e-6);
      peorK = Math.max(peorK, rel(g.kFEM, b.kFEM));
      minK = Math.min(minK, b.kFEM);
      console.log(`    ${b.etiqueta.padEnd(18)} H/⌀ ${b.HenDiametros.toFixed(2)}  K medido ${b.kFEM.toFixed(2)} (h=5 ⇒ ${g.kFEM.toFixed(2)})  K §12.2.6 ${b.kLibro.toFixed(2)}  σmax ${b.sigmaMaxMPa.toFixed(0)} MPa`);
    }
    check('C5 V12.12 hay concentración MEDIDA en todos los barrenos (K > 2) y es estable con la malla',
      minK > 2 && peorK < 0.03,
      `K mínimo ${minK.toFixed(2)} · peor variación h 8→5 mm: ${(100 * peorK).toFixed(2)} %`);
    check('C5b σ_max del molde cae SOBRE un barreno (la concentración manda, no la placa lisa)',
      c8.barrenos.some((b) => Math.abs(b.sigmaMaxMPa - c8.sigmaMaxMPa) < 1e-6),
      `σ_max ${c8.sigmaMaxMPa.toFixed(1)} MPa en (${c8.sigmaMaxEn[0].toFixed(0)}, ${c8.sigmaMaxEn[1].toFixed(0)})`);
    const noPerp = c8.modelo.barrenos.filter((b) => !b.ejePerpendicular);
    const medidosNoPerp = c8.barrenos.filter((b) => noPerp.some((z) => z.x === b.x && z.y === b.y));
    check('C6 lo NO medido NO se aprueba: los barrenos con eje paralelo al corte van a SIN CABLEAR',
      noPerp.length > 0 && medidosNoPerp.length === 0
      && c8.sinCablear.some((s) => s.includes('eje CONTENIDO en el corte')),
      `${noPerp.length} barreno(s) (expulsores) declarados SIN CABLEAR y 0 colados en la tabla de K`);
    res.kMin = +minK.toFixed(2);
    res.kVarPct = +(100 * peorK).toFixed(2);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ D · LOS NÚMEROS DEL LIBRO Y SUS ERRATAS ══');
  // ══════════════════════════════════════════════════════════════════════════
  {
    const p20 = V.limiteMaterial('P20');
    check('D1 σ_limit del P20 = 456 MPa (Fig 12.5 + §9.2.5), NO los "approximately 450" del texto',
      p20.sigmaLimitMPa === 456 && /450/.test(p20.errata ?? ''),
      `${p20.sigmaLimitMPa} MPa · ${p20.cita}`);
    const qc7 = V.limiteMaterial('QC7');
    check('D2 el ALUMINIO no tiene límite de fatiga: sin nº de ciclos NO hay σ_limit (y se dice)',
      qc7.sigmaLimitMPa === null && qc7.sinLimiteFatiga === true,
      `σ_limit = ${qc7.sigmaLimitMPa} · "do not exhibit an endurance stress limit"`);
    check('D2b la ERRATA del QC7 queda DECLARADA (Fig 12.3 "Yield = 420" vs §12.1.1 "545")',
      /420/.test(qc7.errata ?? '') && /545/.test(qc7.errata ?? ''),
      (qc7.errata ?? '').slice(0, 96) + '…');
    const q1 = V.limiteMaterial('QC7', 500), q2 = V.limiteMaterial('QC7', 10000), q3 = V.limiteMaterial('QC7', 1e6);
    check('D3 QC7 por ciclos = 545 / 370 / 170 MPa (Fig 12.5, literal)',
      q1.sigmaLimitMPa === 545 && q2.sigmaLimitMPa === 370 && q3.sigmaLimitMPa === 170,
      `<1e3 ⇒ ${q1.sigmaLimitMPa} · ~1e4 ⇒ ${q2.sigmaLimitMPa} · 1e6 ⇒ ${q3.sigmaLimitMPa}`);
    const k34 = V.kBarrenoLibro(10, 15);
    check('D4 K = 3.1 + 0.75·(⌀/H)^2.29 reproduce el "3.4" publicado a 1.5 diámetros (§12.2.6)',
      Math.abs(k34 - 3.4) < 0.01,
      `⌀/H = 1/1.5 ⇒ K = ${k34.toFixed(4)} (el libro: "a stress concentration factor of 3.4")`);
    check('D5 la presión de la Fig 12.2 es 150 MPa, literal', V.P_FUNDIDO_FIG122_MPA === 150,
      `${V.P_FUNDIDO_FIG122_MPA} MPa`);
    res.kLibro15D = +k34.toFixed(4);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ E · LA LÁMINA ══');
  // ══════════════════════════════════════════════════════════════════════════
  {
    const lamA = V.laminaVonMises(c8);
    fs.writeFileSync(path.join(OUT, 'L19-vonmises.svg'), lamA.svg);
    // escala FIJA: la misma presión partida a la mitad NO puede mover los límites de banda
    const cBaja = V.campoVonMises(V.seccionBezelLibro({ pFundidoMPa: 60, hMallaMm: 9 }));
    const lamB = V.laminaVonMises(cBaja);
    fs.writeFileSync(path.join(OUT, 'L19-vonmises-p60.svg'), lamB.svg);
    const ticks = (svg) => (svg.match(/ESCALA FIJA[^<]*/) ?? [''])[0];
    const bandas = (svg) => [...svg.matchAll(/y="(?:\d+)"[^>]*>(\d{2,4})<\/text>/g)].map((z) => z[1]).join(',');
    check('E1 ESCALA FIJA: bajar la presión de 150 a 60 MPa NO cambia la escala de color',
      ticks(lamA.svg) === ticks(lamB.svg) && ticks(lamA.svg).includes('σ_limit'),
      `"${ticks(lamA.svg)}" — anclada a σ_limit, no a los percentiles de los datos`);
    check('E1b y el mapa SÍ cambia (si no, no estaría pintando el campo)',
      cBaja.sigmaMaxMPa < c8.sigmaMaxMPa * 0.6,
      `σ_max ${c8.sigmaMaxMPa.toFixed(0)} MPa a 150 MPa vs ${cBaja.sigmaMaxMPa.toFixed(0)} MPa a 60 MPa`);
    check('E2 la lámina DECLARA su modelo (2D, deformación plana, aproximado)',
      /DEFORMACIÓN PLANA/.test(lamA.svg) && /APROXIMADO/.test(lamA.svg),
      'el encabezado dice qué es y qué no es');
    check('E3 la lámina imprime LO QUE NO MIDE (no lo pinta verde)',
      /NO MIDE/.test(lamA.svg) && /SINGULARIDAD/.test(lamA.svg) && /L20/.test(lamA.svg),
      `${c8.sinCablear.length} renglones de SIN CABLEAR`);
    check('E4 la lámina imprime la ERRATA del σ_limit con sus dos números',
      /456/.test(lamA.svg) && /450/.test(lamA.svg),
      'texto "approximately 450 MPa" vs Fig 12.5 "456" — se dice cuál se usa y por qué');
    // caso SIN σ_limit: aluminio sin ciclos ⇒ no puede aprobar nada
    const modAl = { ...V.seccionBezelLibro({ hMallaMm: 10 }), material: 'QC7', ciclos: undefined };
    const cAl = V.campoVonMises(modAl);
    const lamAl = V.laminaVonMises(cAl);
    fs.writeFileSync(path.join(OUT, 'L19-vonmises-QC7-sin-ciclos.svg'), lamAl.svg);
    check('E5 SIN σ_limit (aluminio sin ciclos) la lámina NO aprueba: sin escala y sin veredicto',
      cAl.pctSobreLimite === null && /SIN VEREDICTO/.test(lamAl.svg) && /SIN ESCALA/.test(lamAl.svg)
      && !/Ec. 12.1 se cumple/.test(lamAl.svg),
      'campo en gris + "SIN VEREDICTO" — lo no medido nunca cuenta como cumplido');
    console.log(`\n  láminas en _laminas/L19-vonmises.svg · -p60.svg · -QC7-sin-ciclos.svg`);
    console.log(`  sección: ${c8.malla.nQuads} quads · ${c8.msSolver} ms (2 solves: con y sin barrenos)`);
  }

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, ...res }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1200)); process.exit(1); });
