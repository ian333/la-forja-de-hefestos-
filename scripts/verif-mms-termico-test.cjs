/**
 * GATE · MMS — MÉTODO DE SOLUCIONES MANUFACTURADAS sobre el solver térmico.
 * ============================================================================
 * Hasta hoy solo podíamos verificar el térmico contra geometría trivial (cubo,
 * cilindro, esfera) porque no existe solución analítica para una carcasa real.
 * Eso deja los bugs escondidos justo donde importan. MMS le da la vuelta: te
 * inventas T*(x,y,z), sustituyes en el operador para obtener S = −∇·(k∇T*), y
 * resuelves L(T)=S. La respuesta exacta es T* POR CONSTRUCCIÓN, en CUALQUIER
 * geometría (Roache, ASME J. Fluids Eng. 124(1):4-10, 2002; Roy et al.,
 * Int. J. Numer. Meth. Fluids 44:599-620, 2004).
 *
 * LO QUE PRUEBA CORRECTITUD ES EL ORDEN OBSERVADO, no el número en una malla.
 * Un signo cambiado, un índice corrido o una CF en el nodo de adentro degradan p
 * aunque el número se vea razonable. Por eso los CONTROLES NEGATIVOS (M13): un
 * arnés que nunca reprueba es un sello.
 *
 *   M1  LA FUENTE ES CORRECTA   — el álgebra de S contra derivadas numéricas 4º orden
 *   M2  PARIDAD                 — la réplica del operador ≡ `solveSteadyMoldField` REAL
 *   M3  PATCH TEST              — lineal y lineal-por-capas reproducidas a REDONDEO
 *   M4  ORDEN 3D · Dirichlet    — 5 mallas, cubo, trig-exp
 *   M5  ORDEN 3D · Robin/mixta  — las CF son donde más se pierde el orden
 *   M6  ORDEN · k(x) VARIABLE   — el operador de conductividad no uniforme
 *   M7  k DISCONTINUO           — acero↔plástico + flujo normal en la interfaz
 *   M8  CONSERVACIÓN DISCRETA   — balance global de potencia (identidad de VF)
 *   M9  RECIPROCIDAD (Green)    — fuente en A medida en B = fuente en B medida en A
 *   M10 MMS SOBRE `resolverAxi` — código REAL, sin réplica (axisimétrico r,z)
 *   M11 MMS SOBRE GEOMETRÍA REAL— pieza del banco test-parts/inyeccion-reales
 *   M12 FRONTERA ESCALONADA     — el hallazgo: dato de la superficie REAL en la cara
 *   M13 CONTROLES NEGATIVOS     — 4 bugs a propósito; todos DEBEN degradar el orden
 *
 * Uso: node --import tsx scripts/verif-mms-termico-test.cjs
 * Salida extra: _laminas/MMS-convergencia.svg (log-log con la pendiente medida)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const R = (p) => path.resolve(ROOT, 'src', 'forja', p);
const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');

let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const fx = (x, d = 3) => Number(x).toExponential(d);

// mallas del barrido: razón ~1.4, 5 niveles. PARES a propósito: la interfaz de
// k discontinuo (x=L/2) tiene que caer SOBRE una cara en todos los niveles.
const NS = [10, 14, 20, 28, 40];
const L_CUBO = 0.10;                 // 100 mm de lado (m)
const K_P20 = 32;                    // W/m·°C — P20 del Apéndice B (el del libro)
const K_ABS = 0.19;                  // W/m·°C — ABS fundido (Apéndice A)

const series = [];   // para la lámina

(async () => {
  const M = await import(R('verificacion/mms.ts'));
  const TS = await import(R('mold/thermal-steady.ts'));
  const AX = await import(R('mold/lamina-nucleo-enfriamiento.ts'));

  const trig = M.msTrigExp({ a: 11, b: 7.5, c: 4.2, k0: K_P20 });
  const poli4 = M.msPolinomica({ k0: K_P20 });
  const lineal = M.msPolinomica({ k0: K_P20, coefs: M.POLI_LINEAL, id: 'lineal' });
  const kSuave = M.msKSuave({ k0: K_P20, beta: 0.55, omega: 9, a: 11, b: 7.5, c: 4.2 });
  const capas = M.msKCapas({ x0: 0, xi: L_CUBO / 2, k1: K_P20, k2: K_ABS, y0: 0, Ly: L_CUBO, z0: 0, Lz: L_CUBO, A: 1200, B: 60, gamma: 0.45 });
  const capasLin = M.msKCapas({ x0: 0, xi: L_CUBO / 2, k1: K_P20, k2: K_ABS, y0: 0, Ly: L_CUBO, z0: 0, Lz: L_CUBO, A: 1200, B: 60, gamma: 0 });

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M1 · LA FUENTE MANUFACTURADA: ¿el álgebra de S = −∇·(k∇T*) está bien? ══');
  console.log('   (el bug #1 del MMS es equivocarse en la fuente. Se contrasta la forma CERRADA');
  console.log('    contra la divergencia numérica de 4º orden — que NO se usa para armar nada.)');
  {
    let peor = 0, peorId = '';
    for (const s of [trig, poli4, lineal, kSuave, capas]) {
      let w = 0;
      for (let t = 0; t < 400; t++) {
        const x = 0.008 + 0.084 * ((t * 0.6180339887) % 1);
        const y = 0.008 + 0.084 * ((t * 0.7548776662) % 1);
        const z = 0.008 + 0.084 * ((t * 0.4142135624) % 1);
        if (Math.abs(x - L_CUBO / 2) < 0.012) continue;   // la capa: no se cruza la interfaz
        const an = s.fuente(x, y, z);
        const nu = M.divergenciaNumerica(s, x, y, z, 2e-4);
        w = Math.max(w, Math.abs(an - nu) / Math.max(1, Math.abs(an)));
      }
      if (w > peor) { peor = w; peorId = s.id; }
      console.log(`   · ${s.id.padEnd(9)} err rel ${fx(w, 2)}  ·  ${s.descripcion}`);
    }
    check('las 5 fuentes analíticas coinciden con la divergencia numérica de 4º orden',
      peor < 1e-7, `peor ${fx(peor, 2)} (${peorId}) — truncamiento de la derivada numérica, no del álgebra`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M2 · PARIDAD: la réplica del operador ES `solveSteadyMoldField` ══');
  console.log('   El solver real NO acepta fuente arbitraria ni CF por celda ⇒ no puede expresar');
  console.log('   un problema MMS. Se verifica la RÉPLICA, así que hay que probar que es el MISMO');
  console.log('   operador: se resuelve un problema que ambos SÍ expresan y se mide el residuo');
  console.log('   ALGEBRAICO de la solución real dentro del sistema de la réplica.');
  let paridadRel = NaN, sepDesal = NaN;
  {
    const nx = 22, ny = 16, nz = 12, dxMm = 6, hC = 1000, dia = 0.00953, Tc = 60, Q = 1400;
    const N = nx * ny * nz, idx = (i, j, k) => (k * ny + j) * nx + i;
    const plastic = new Uint8Array(N), cool = new Float32Array(N);
    for (let k = 4; k < 8; k++) for (let j = 4; j < 11; j++) for (let i = 5; i < 16; i++) plastic[idx(i, j, k)] = 1;
    for (let i = 2; i < nx - 2; i++) { cool[idx(i, 3, 2)] = 1; cool[idx(i, 12, 2)] = 1; cool[idx(i, 7, 10)] = 1; }
    const real = TS.solveSteadyMoldField({
      nx, ny, nz, dxMm, x0: 0, y0: 0, z0: 0, plastic, cool, tCoolantC: Tc, qTotalW: Q,
      kSteel: K_P20, kPlastic: K_ABS, hC, lineDiaM: dia, maxIters: 200000, tolC: 1e-9,
    });
    const dx = dxMm / 1000;
    let nPlast = 0; for (let n = 0; n < N; n++) if (plastic[n]) nPlast++;
    const qVol = Q / (Math.max(1, nPlast) * dx ** 3);
    const kArr = new Float64Array(N), s = new Float64Array(N), sg = new Float64Array(N), st = new Float64Array(N);
    const gW = hC * Math.PI * dia * dx;                       // thermal-steady L86, literal
    for (let n = 0; n < N; n++) {
      kArr[n] = plastic[n] ? K_ABS : K_P20;
      s[n] = plastic[n] ? qVol : 0;
      if (cool[n] > 0) { sg[n] = gW; st[n] = Tc; }
    }
    const malla = { nx, ny, nz, h: dx, x0: 0, y0: 0, z0: 0 };
    const armar = (mut) => M.ensamblarFV({ malla, k: kArr, s, sumideroG: mut === 'sin-pi' ? sg.map((v) => v / Math.PI) : sg, sumideroT: st, frontera: () => ({ tipo: 'neumann', qSaliente: 0 }), bug: mut === 'media-aritmetica' ? 'k-cara-duena' : 'ninguno' });
    const sis = armar('ninguno');
    const resid = (sistema, x) => {
      const y = new Float64Array(N); sistema.aplicarA(x, y);
      let rr = 0, bb = 0;
      for (let n = 0; n < N; n++) { const d = sistema.b[n] - y[n]; rr += d * d; bb += sistema.b[n] * sistema.b[n]; }
      return { rel: Math.sqrt(rr / bb), abs: Math.sqrt(rr), nb: Math.sqrt(bb) };
    };
    const rReal = resid(sis, Float64Array.from(real.T));
    paridadRel = rReal.rel;
    const rep = M.resolverCG(sis, { tolRel: 1e-14 });
    let dmax = 0, mn = 1e18, mx = -1e18, tmax = 0;
    for (let n = 0; n < N; n++) { dmax = Math.max(dmax, Math.abs(rep.T[n] - real.T[n])); mn = Math.min(mn, rep.T[n]); mx = Math.max(mx, rep.T[n]); tmax = Math.max(tmax, Math.abs(rep.T[n])); }
    console.log(`   real: ${real.iters} iters · rango ${real.minC}…${real.maxC} °C   réplica: ${rep.iters} iters · ‖r‖/‖b‖ ${fx(rep.residRel, 1)}`);
    // EL PODER DISCRIMINANTE, MEDIDO: dos réplicas DESALINEADAS a propósito (media
    // aritmética en la cara, y el área mojada sin el π). Si el umbral no separa la
    // réplica buena de ésas por órdenes de magnitud, el check no prueba nada.
    const desal = [
      ['k de la celda dueña en la cara (sin media armónica)', resid(armar('media-aritmetica'), Float64Array.from(real.T)).rel],
      ['área mojada del agua sin el π', resid(armar('sin-pi'), Float64Array.from(real.T)).rel],
    ];
    sepDesal = Math.min(...desal.map((d) => d[1]));
    console.log(`   réplicas DESALINEADAS a propósito: ${desal.map((d) => `${d[0]} → ${fx(d[1], 2)}`).join(' · ')}`);
    check('la solución del solver REAL satisface el sistema de la réplica, y NO el de una réplica desalineada',
      paridadRel < 1e-3 && sepDesal > 100 * paridadRel,
      `‖A_rep·T_real − b_rep‖/‖b_rep‖ = ${fx(paridadRel, 2)} vs ${fx(sepDesal, 2)} de la desalineada más parecida = separación ×${(sepDesal / paridadRel).toFixed(0)}`);
    check('las dos soluciones coinciden dentro del error de redondeo float32',
      dmax / (mx - mn) < 1e-5, `Δmáx ${fx(dmax, 2)} °C sobre rango ${(mx - mn).toFixed(1)} °C = ${fx(dmax / (mx - mn), 2)} rel ≈ ${(dmax / tmax / Math.pow(2, -24)).toFixed(0)} ULP de float32`);
    // HALLAZGO COLATERAL, medido: el residuo que REPORTA el solver real está sesgado.
    // Se le pidió tolC=1e-9 y devuelve residualC=0, pero su residuo VERDADERO (medido
    // en float64 sobre el mismo sistema) es 1e-3 W. Es la deriva clásica entre el
    // residuo RECURSIVO del CG y el verdadero cuando se acumula en float32.
    console.log(`   ⚠ residuo del solver REAL: reportado ${real.residualC} · VERDADERO ${fx(rReal.abs, 2)} W (‖r‖/‖b‖ = ${fx(paridadRel, 2)}, ‖b‖ = ${rReal.nb.toFixed(1)} W)`);
    console.log('     El CG de thermal-steady acumula el residuo RECURSIVAMENTE en float32: se le');
    console.log('     pidió tolC=1e-9 y "cumplió", pero su residuo verdadero se estanca ~5e-5 rel.');
    console.log('     Impacto físico: ~0.01 °C — irrelevante. Impacto en el REPORTE: `residualC` se');
    console.log('     usa como bandera de calidad en mold-thermal-fdm.pasos() y está optimista.');
    console.log('     DECLARADO. Fix (no aplicado, no se tocan archivos existentes): recalcular r =');
    console.log('     b − A·x cada ~50 iters, o acumular los productos punto en Float64.');
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M3 · PATCH TEST: lo que el esquema DEBE reproducir EXACTAMENTE ══');
  console.log('   Un VF de 2º orden con media armónica reproduce sin error una solución lineal');
  console.log('   (y una lineal-POR-CAPAS con flujo continuo). Si no, el ensamble está torcido.');
  {
    const r1 = M.barridoMMS({ sol: lineal, ns: [8, 16], L: L_CUBO, frontera: 'dirichlet' });
    const r2 = M.barridoMMS({ sol: lineal, ns: [8, 16], L: L_CUBO, frontera: 'robin', hConv: 1500 });
    const r3 = M.barridoMMS({ sol: lineal, ns: [8, 16], L: L_CUBO, frontera: 'neumann-y-dirichlet' });
    const r4 = M.barridoMMS({ sol: capasLin, ns: [8, 16], L: L_CUBO, frontera: 'dirichlet' });
    const peor = Math.max(...[r1, r2, r3, r4].flatMap((r) => r.puntos.map((p) => p.l2Rel)));
    console.log(`   Dirichlet ${fx(r1.puntos[1].l2Rel, 1)} · Robin ${fx(r2.puntos[1].l2Rel, 1)} · Neumann+Dirichlet ${fx(r3.puntos[1].l2Rel, 1)} · capas 32|0.19 ${fx(r4.puntos[1].l2Rel, 1)} (relativos al rango de T*)`);
    check('lineal y lineal-por-capas EXACTAS a nivel de redondeo con las 3 clausuras de frontera',
      peor < 1e-11, `peor error relativo ${fx(peor, 2)} ≈ ${(peor / 2.2e-16).toFixed(0)}·eps(float64) — la media ARMÓNICA es exacta en la interfaz 32↔0.19`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M4 · ORDEN OBSERVADO EN 3D · cubo 100 mm · Dirichlet de T* ══');
  console.log('   ORDEN TEÓRICO = 2. Leído del código, no supuesto: `thermal-steady.ts` es un');
  console.log('   volumen finito centrado en celda con balance de 7 puntos (L97-109) y media');
  console.log('   armónica de cara (L79) ⇒ O(h²) para T suave; la clausura Dirichlet de media');
  console.log('   celda tiene truncamiento local O(h) pero contribución global O(h²).');
  let pCubo = NaN;
  {
    const r = M.barridoMMS({ sol: trig, ns: NS, L: L_CUBO, frontera: 'dirichlet' });
    pCubo = r.ajuste.p;
    for (const p of r.puntos) console.log(`   n=${String(p.n).padStart(2)}  h=${(p.h * 1000).toFixed(3)} mm  L2=${fx(p.l2, 3)} °C  L∞=${fx(p.linf, 2)}  ‖r‖/‖b‖=${fx(p.residRel, 1)}  (${p.iters} iters)`);
    console.log(`   órdenes por pareja: ${r.ajuste.porPareja.map((x) => x.toFixed(3)).join(' → ')}`);
    check('orden observado = 2 con R² > 0.99 (5 mallas)',
      Math.abs(r.ajuste.p - 2) < 0.10 && r.ajuste.R2 > 0.99,
      `p = ${r.ajuste.p.toFixed(4)} · R² = ${r.ajuste.R2.toFixed(6)} · el error algebraico del CG (${fx(Math.max(...r.puntos.map((p) => p.residRel)), 1)}) está 10 órdenes por debajo del de discretización`);
    series.push({ nombre: 'cubo 100 mm · Dirichlet · trig-exp', color: '#59d98c', puntos: r.puntos.map((p) => ({ h: p.h, e: p.l2 })), ajuste: r.ajuste });
    const rp = M.barridoMMS({ sol: poli4, ns: NS, L: L_CUBO, frontera: 'dirichlet' });
    check('orden 2 también con T* POLINÓMICA de grado 4 (otra familia de funciones)',
      Math.abs(rp.ajuste.p - 2) < 0.10 && rp.ajuste.R2 > 0.99,
      `p = ${rp.ajuste.p.toFixed(4)} · R² = ${rp.ajuste.R2.toFixed(6)} — el laplaciano de 7 puntos es EXACTO hasta grado 3, el truncamiento lo dejan los términos de grado 4`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M5 · LAS CONDICIONES DE FRONTERA: Robin y Neumann, del propio T* ══');
  console.log('   Robin: T∞ = T*(cara) + (k·∇T*·n̂)/h_c  ⇒  T* satisface la CF por construcción.');
  {
    const rr = M.barridoMMS({ sol: trig, ns: NS, L: L_CUBO, frontera: 'robin', hConv: 1500 });
    const rm = M.barridoMMS({ sol: trig, ns: NS, L: L_CUBO, frontera: 'neumann-y-dirichlet' });
    check('orden 2 con Robin (h_c = 1500 W/m²·°C) en las 6 caras',
      Math.abs(rr.ajuste.p - 2) < 0.10 && rr.ajuste.R2 > 0.99,
      `p = ${rr.ajuste.p.toFixed(4)} · R² = ${rr.ajuste.R2.toFixed(6)}`);
    check('orden 2 con Neumann exacto en ±x y Dirichlet en el resto (frontera MIXTA)',
      Math.abs(rm.ajuste.p - 2) < 0.10 && rm.ajuste.R2 > 0.99,
      `p = ${rm.ajuste.p.toFixed(4)} · R² = ${rm.ajuste.R2.toFixed(6)}`);
    series.push({ nombre: 'cubo · Robin h_c=1500 en las 6 caras', color: '#4fb0ff', puntos: rr.puntos.map((p) => ({ h: p.h, e: p.l2 })), ajuste: rr.ajuste });
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M6 · CONDUCTIVIDAD VARIABLE SUAVE: k(x) = 32·(1 + 0.55·sin(9x + 0.4)) ══');
  {
    const r = M.barridoMMS({ sol: kSuave, ns: NS, L: L_CUBO, frontera: 'dirichlet' });
    check('orden 2 con k(x) variable (el término ∇k·∇T entra en la fuente y en la cara)',
      Math.abs(r.ajuste.p - 2) < 0.10 && r.ajuste.R2 > 0.99,
      `p = ${r.ajuste.p.toFixed(4)} · R² = ${r.ajuste.R2.toFixed(6)} · k va de ${(K_P20 * 0.45).toFixed(1)} a ${(K_P20 * 1.55).toFixed(1)} W/m·°C`);
    series.push({ nombre: 'cubo · k(x) variable suave', color: '#c9a227', puntos: r.puntos.map((p) => ({ h: p.h, e: p.l2 })), ajuste: r.ajuste });
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M7 · k DISCONTINUO acero↔plástico (32 ↔ 0.19, salto ×168) ══');
  console.log('   T* se construye con el potencial de flujo G(x)=∫dξ/k para que T* Y el FLUJO');
  console.log('   NORMAL k·∂T/∂x sean CONTINUOS en la interfaz (el flujo tangencial SÍ salta, y debe).');
  {
    const r = M.barridoMMS({ sol: capas, ns: NS, L: L_CUBO, frontera: 'dirichlet' });
    check('orden 2 a través de la interfaz acero↔plástico',
      Math.abs(r.ajuste.p - 2) < 0.10 && r.ajuste.R2 > 0.99,
      `p = ${r.ajuste.p.toFixed(4)} · R² = ${r.ajuste.R2.toFixed(6)} · L2 ${fx(r.puntos[0].l2, 2)} → ${fx(r.puntos[r.puntos.length - 1].l2, 2)} °C`);
    series.push({ nombre: 'cubo · k DISCONTINUO acero <-> plastico (32 vs 0.19)', color: '#ff8a3d', puntos: r.puntos.map((p) => ({ h: p.h, e: p.l2 })), ajuste: r.ajuste });

    // FLUJO NORMAL EN LA INTERFAZ: el discreto (una sola conductancia compartida por
    // las dos celdas ⇒ continuo por construcción, es lo que hace conservativo al VF)
    // contra el ANALÍTICO A·g(y,z). Con el bug de "k de la celda dueña" esto revienta.
    const mediFlujo = (bug) => {
      const puntos = [];
      for (const n of [10, 20, 40]) {
        const malla = M.mallaCubo(n, L_CUBO);
        const prob = M.problemaMMS({ malla, sol: capas, frontera: 'dirichlet', bug });
        const sol = M.resolverFV(prob, { tolRel: 1e-13 });
        const iI = n / 2 - 1;                 // celda a la izquierda de la interfaz x=L/2
        const h = malla.h, A2 = h * h;
        const g = A2 / (h / (2 * K_P20) + h / (2 * K_ABS));
        const gBug = (K_P20 / h) * A2;
        let s2 = 0, s2a = 0, cnt = 0;
        for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) {
          const a = (k * n + j) * n + iI, b = a + 1;
          const disc = (bug === 'k-cara-duena' ? gBug : g) * (sol.T[a] - sol.T[b]);   // W en +x
          const c = M.centroCelda(malla, iI, j, k);
          const anal = capas.flujoNormal(L_CUBO / 2, c[1], c[2], [1, 0, 0]) * A2;
          s2 += (disc - anal) ** 2; s2a += anal * anal; cnt++;
        }
        puntos.push({ h, e: Math.sqrt(s2 / cnt), rel: Math.sqrt(s2 / s2a) });
      }
      return puntos;
    };
    const fOk = mediFlujo('ninguno');
    const fBug = mediFlujo('k-cara-duena');
    // OJO CON LA NORMA: el error del POTENCIA-POR-CARA baja como h⁴ y eso no es orden 4,
    // es que la cara encoge como h². El orden del ESQUEMA está en el error RELATIVO
    // (flujo por unidad de área), que es lo que se ajusta aquí.
    const aF = M.ordenObservado(fOk.map((q) => ({ h: q.h, e: q.rel })));
    console.log(`   flujo en la interfaz (err relativo): bien ${fOk.map((q) => fx(q.rel, 1)).join(' → ')} · con k de la celda dueña ${fBug.map((q) => fx(q.rel, 1)).join(' → ')}`);
    check('el flujo normal discreto en la interfaz converge al analítico con orden ≈2',
      Math.abs(aF.p - 2) < 0.15 && fOk[2].rel < 1e-3,
      `p = ${aF.p.toFixed(3)} (sobre el error RELATIVO; el de potencia-por-cara baja como h⁴ solo porque la cara encoge h²) · err rel en la malla fina ${fx(fOk[2].rel, 2)} — la conductancia de cara es UNA sola compartida por las dos celdas ⇒ continuidad EXACTA (VF conservativo)`);
    check('el control con "k de la celda dueña" REVIENTA el flujo de la interfaz (el check tiene dientes)',
      fBug[2].rel > 30 * fOk[2].rel, `err rel ${fx(fBug[2].rel, 2)} vs ${fx(fOk[2].rel, 2)} = ×${(fBug[2].rel / fOk[2].rel).toFixed(0)}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M8 · CONSERVACIÓN DISCRETA: lo que entra por la fuente sale por la frontera ══');
  {
    let peor = 0, detalle = '';
    for (const [nm, sol, fr] of [['trig-exp Dirichlet', trig, 'dirichlet'], ['trig-exp Robin', trig, 'robin'], ['k capas', capas, 'dirichlet'], ['k suave mixta', kSuave, 'neumann-y-dirichlet']]) {
      const malla = M.mallaCubo(20, L_CUBO);
      const prob = M.problemaMMS({ malla, sol, frontera: fr, hConv: 1500 });
      const s = M.resolverFV(prob, { tolRel: 1e-14 });
      const bal = M.balanceGlobal(s, prob.s);
      if (Math.abs(bal.residuoRel) > peor) { peor = Math.abs(bal.residuoRel); detalle = `${nm}: entra ${bal.entraW.toFixed(3)} W · sale ${bal.saleW.toFixed(3)} W`; }
    }
    check('el balance global de potencia cierra a nivel de redondeo en los 4 casos',
      peor < 1e-10, `peor residuo relativo ${fx(peor, 2)} · ${detalle} — en VF esto es una IDENTIDAD algebraica: si no cierra, hay caras contadas dos veces o diagonal incompleta`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M9 · RECIPROCIDAD (simetría de la función de Green) ══');
  console.log('   Fuente puntual en A medida en B = fuente en B medida en A. Es EXACTA: no');
  console.log('   necesita solución analítica ni refinamiento, y caza matrices asimétricas y');
  console.log('   CF mal aplicadas. Se corre sobre el SOLVER REAL (no la réplica).');
  let recipReal = NaN;
  {
    const nx = 22, ny = 16, nz = 12, dxMm = 6, dia = 0.00953;
    const N = nx * ny * nz, idx = (i, j, k) => (k * ny + j) * nx + i;
    const cool = new Float32Array(N);
    for (let i = 2; i < nx - 2; i++) { cool[idx(i, 3, 2)] = 1; cool[idx(i, 12, 2)] = 1; cool[idx(i, 7, 10)] = 1; }
    // k UNIFORME (kPlastic = kSteel): en el solver real la celda de plástico es a la vez
    // la fuente Y el k, así que solo igualándolos se puede mover la fuente sin mover el operador.
    const solveEn = (n) => {
      const p = new Uint8Array(N); p[n] = 1;
      return TS.solveSteadyMoldField({
        nx, ny, nz, dxMm, x0: 0, y0: 0, z0: 0, plastic: p, cool, tCoolantC: 0, qTotalW: 1,
        kSteel: K_P20, kPlastic: K_P20, hC: 1000, lineDiaM: dia, maxIters: 200000, tolC: 1e-12,
      });
    };
    const A = idx(5, 5, 5), B = idx(17, 11, 8);
    const TA = solveEn(A), TB = solveEn(B);
    const gAB = TA.T[B], gBA = TB.T[A];
    recipReal = Math.abs(gAB - gBA) / Math.max(Math.abs(gAB), 1e-30);
    const ulp = Math.abs(gAB) * Math.pow(2, -24);
    check('SOLVER REAL: G(A→B) = G(B→A) al nivel del redondeo float32',
      recipReal < 1e-5,
      `${gAB.toExponential(9)} vs ${gBA.toExponential(9)} °C/W · brecha rel ${fx(recipReal, 2)} = ${(Math.abs(gAB - gBA) / ulp).toFixed(1)} ULP de float32 (el solver real guarda T en Float32Array)`);

    // y la versión EXACTA en float64, con k VARIABLE (acero + un blob de plástico):
    // aquí sí se puede separar la fuente del campo de conductividad.
    const kArr = new Float64Array(N).fill(K_P20);
    for (let k = 4; k < 8; k++) for (let j = 4; j < 11; j++) for (let i = 5; i < 16; i++) kArr[idx(i, j, k)] = K_ABS;
    const sg = new Float64Array(N), st = new Float64Array(N);
    const gW = 1000 * Math.PI * dia * (dxMm / 1000);
    for (let n = 0; n < N; n++) if (cool[n] > 0) { sg[n] = gW; st[n] = 0; }
    const malla = { nx, ny, nz, h: dxMm / 1000, x0: 0, y0: 0, z0: 0 };
    const V = malla.h ** 3;
    const green = (n) => {
      const s = new Float64Array(N); s[n] = 1 / V;      // 1 W en esa celda
      const sis = M.ensamblarFV({ malla, k: kArr, s, sumideroG: sg, sumideroT: st, frontera: () => ({ tipo: 'neumann', qSaliente: 0 }) });
      return M.resolverCG(sis, { tolRel: 1e-14 }).T;
    };
    const gA = green(A), gB = green(B);
    const rel2 = Math.abs(gA[B] - gB[A]) / Math.abs(gA[B]);
    check('RÉPLICA float64 con k VARIABLE (acero+plástico): reciprocidad EXACTA',
      rel2 < 1e-9, `${gA[B].toExponential(12)} vs ${gB[A].toExponential(12)} · brecha rel ${fx(rel2, 2)}`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M10 · MMS SOBRE `resolverAxi` — CÓDIGO REAL, sin réplica (axisimétrico) ══');
  console.log('   `lamina-nucleo-enfriamiento.resolverAxi` SÍ acepta fuente y Neumann por celda,');
  console.log('   así que el MMS se le aplica DIRECTO. Su esquema: resistencia de cascarón');
  console.log('   cilíndrico log(r) en radial + media armónica en z ⇒ ORDEN TEÓRICO 2.');
  console.log('   T* = A·r²·cos(b·z) + C·ln(r) + D   ⇒   S = −k·A·cos(bz)·(4 − b²r²)');
  let pAxi = NaN;
  {
    const k0 = K_P20, A = 9.0e5, b = 70, C = 140, D = 180;
    const T = (r, z) => A * r * r * Math.cos(b * z) + C * Math.log(r) + D;
    const Tr = (r, z) => 2 * A * r * Math.cos(b * z) + C / r;
    const Tz = (r, z) => -A * b * r * r * Math.sin(b * z);
    const S = (r, z) => -k0 * A * Math.cos(b * z) * (4 - b * b * r * r);
    const r0 = 0.004, r1 = 0.020, z0 = 0, z1 = 0.030;
    const pts = [];
    let peorIncomp = 0;
    for (const nr of [12, 16, 22, 30, 40]) {
      const nz = Math.round(nr * (z1 - z0) / (r1 - r0));
      const m = AX.mallaAxi({ nr, nz, r0, r1, z0, z1 });
      const N = nr * nz, dosPi = 2 * Math.PI;
      const kA = new Float64Array(N).fill(k0), qIn = new Float64Array(N);
      const rg = new Float64Array(N), rt = new Float64Array(N);
      for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
        const n = j * nr + i, rc = m.rc[i], zc = m.zc[j];
        qIn[n] = S(rc, zc) * m.vol[i];                                   // fuente
        if (i === 0) qIn[n] += -k0 * Tr(m.rf[0], zc) * dosPi * m.rf[0] * m.dz;
        if (i === nr - 1) qIn[n] += k0 * Tr(m.rf[nr], zc) * dosPi * m.rf[nr] * m.dz;
        if (j === 0) qIn[n] += -k0 * Tz(rc, z0) * m.areaZ[i];
        if (j === nz - 1) qIn[n] += k0 * Tz(rc, z1) * m.areaZ[i];
      }
      const s = AX.resolverAxi({ m, k: kA, qIn, robinG: rg, robinT: rt }, { maxIters: 200000, tol: 1e-15 });
      // Neumann PURO ⇒ la solución vive salvo constante: se compara con la media quitada
      // (es lo que hace `quitarMedia` del propio solver).
      let sE = 0, sN = 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) { sE += T(m.rc[i], m.zc[j]); sN += s.T[j * nr + i]; }
      const muE = sE / N, muN = sN / N;
      let s2 = 0, linf = 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nr; i++) {
        const e = Math.abs((s.T[j * nr + i] - muN) - (T(m.rc[i], m.zc[j]) - muE));
        s2 += e * e; if (e > linf) linf = e;
      }
      // compatibilidad del problema Neumann puro: Σq debe ser ~0 (teorema de la divergencia)
      let sq = 0, aq = 0; for (let n = 0; n < N; n++) { sq += qIn[n]; aq += Math.abs(qIn[n]); }
      peorIncomp = Math.max(peorIncomp, Math.abs(sq) / aq);
      pts.push({ h: m.dr, e: Math.sqrt(s2 / N) });
      console.log(`   nr=${String(nr).padStart(2)} nz=${String(nz).padStart(2)}  dr=${(m.dr * 1000).toFixed(3)} mm  L2=${fx(Math.sqrt(s2 / N), 3)} °C  L∞=${fx(linf, 2)}  resid=${fx(s.resid, 1)}  incompat=${fx(Math.abs(sq) / aq, 1)}`);
    }
    const a = M.ordenObservado(pts);
    pAxi = a.p;
    check('el solver axisimétrico REAL converge con orden 2 (MMS directo, sin réplica)',
      Math.abs(a.p - 2) < 0.10 && a.R2 > 0.99,
      `p = ${a.p.toFixed(4)} · R² = ${a.R2.toFixed(6)} · pares ${a.porPareja.map((x) => x.toFixed(3)).join(' → ')}`);
    check('el forzamiento Neumann puro es COMPATIBLE (Σq/Σ|q| → 0 como O(h²))',
      peorIncomp < 2e-3, `peor incompatibilidad ${fx(peorIncomp, 2)} — el residuo lo proyecta fuera el quitarMedia() del propio solver`);
    series.push({ nombre: 'axisimétrico (r,z) · resolverAxi REAL', color: '#b98cff', puntos: pts, ajuste: a });
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M11 · MMS SOBRE GEOMETRÍA REAL — el punto de todo el ejercicio ══');
  console.log('   Pieza del banco `test-parts/inyeccion-reales/` (Hammond 1554B, caja ABS');
  console.log('   inyectada de verdad): STEP → sólido → teselado → vóxel. El DOMINIO es el');
  console.log('   ACERO que rodea la impresión (la caja menos la pieza), que es el dominio');
  console.log('   térmico real del molde. T* resuelve la EDP en TODA la caja, así que sigue');
  console.log('   siendo la solución exacta sobre el dominio escalonado sea cual sea la malla.');
  let pReal = NaN, pStair = NaN, eStair = NaN, eCons = NaN, piezaNom = '';
  {
    const DIR = path.join(ROOT, 'test-parts', 'inyeccion-reales');
    const oc = await require(path.join(distDir, 'opencascade.wasm.cjs'))({
      wasmBinary: fs.readFileSync(path.join(distDir, 'opencascade.wasm.wasm')),
      locateFile: (p) => path.join(distDir, p),
    });
    const K = await import(R('brep/occt.ts'));
    const FM = await import(R('mold/flowlen-mesh.ts'));
    const archivo = '1554B.stp';
    const shape = K.importSTEP(oc, fs.readFileSync(path.join(DIR, archivo)));
    const solids = K.uniqueSubShapes(oc, shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID);
    let mayor = null, vol = 0;
    for (const s of solids) { const v = K.volume(oc, s); if (v > vol) { vol = v; mayor = s; } }
    const mesh = K.tessellate(oc, mayor, 0.3, 0.3);
    const q = FM.solidFromMesh(mesh, { bucketsPerSide: 64 });
    piezaNom = `${archivo}#0`;
    const bb = q.bbox, mg = 8;
    const X0 = (bb.x0 - mg) / 1000, Y0 = (bb.y0 - mg) / 1000, Z0 = (bb.z0 - mg) / 1000;
    const LX = (bb.x1 - bb.x0 + 2 * mg) / 1000, LY = (bb.y1 - bb.y0 + 2 * mg) / 1000, LZ = (bb.z1 - bb.z0 + 2 * mg) / 1000;
    console.log(`   ${piezaNom}: ${(bb.x1 - bb.x0).toFixed(1)}×${(bb.y1 - bb.y0).toFixed(1)}×${(bb.z1 - bb.z0).toFixed(1)} mm · ${(vol / 1000).toFixed(1)} cc · ${q.nTris} triángulos`);
    console.log(`   caja de acero ${(LX * 1000).toFixed(1)}×${(LY * 1000).toFixed(1)}×${(LZ * 1000).toFixed(1)} mm (impresión + 8 mm de margen)`);
    const sol = M.msTrigExp({ a: 19, b: 13, c: 7, k0: K_P20, amp: 60, t0: 90 });
    const dentro = (x, y, z) => q.inside(x * 1000, y * 1000, z * 1000);
    const corrida = (n0, superficieReal) => {
      const h = LX / n0;
      const malla = { nx: n0, ny: Math.round(LY / h), nz: Math.round(LZ / h), h, x0: X0, y0: Y0, z0: Z0 };
      const N = malla.nx * malla.ny * malla.nz;
      const activa = new Uint8Array(N);
      let nAct = 0;
      for (let k = 0; k < malla.nz; k++) for (let j = 0; j < malla.ny; j++) for (let i = 0; i < malla.nx; i++) {
        const c = M.centroCelda(malla, i, j, k);
        if (!dentro(c[0], c[1], c[2])) { activa[(k * malla.ny + j) * malla.nx + i] = 1; nAct++; }
      }
      // dato de la SUPERFICIE REAL: bisección sobre inside() a lo largo de la normal de
      // la cara (el centro de la celda de acero está fuera, el del vecino está dentro ⇒
      // el cruce cae en [−h/2, +h/2]). Es lo que hace un código de producción cuando
      // mapea una CF física a caras de vóxel.
      const datoEn = superficieReal ? ((c) => {
        if (!c.interna) return [c.x, c.y, c.z];
        let a = -h / 2, b2 = h / 2;
        for (let it = 0; it < 24; it++) {
          const m2 = (a + b2) / 2;
          if (dentro(c.x + m2 * c.n[0], c.y + m2 * c.n[1], c.z + m2 * c.n[2])) b2 = m2; else a = m2;
        }
        const t = (a + b2) / 2;
        return [c.x + t * c.n[0], c.y + t * c.n[1], c.z + t * c.n[2]];
      }) : undefined;
      const prob = M.problemaMMS({ malla, sol, activa, frontera: 'dirichlet', datoEn });
      const s = M.resolverFV(prob, { tolRel: 1e-13, maxIters: 80000 });
      const e = M.normasError(malla, activa, s.T, sol.T);
      return { n: n0, h, l2: e.l2, linf: e.linf, act: nAct, tot: N, iters: s.iters, residRel: s.residRel };
    };
    const ptsA = [], ptsB = [];
    for (const n of [22, 29, 38, 50, 64]) {
      const a = corrida(n, false);
      ptsA.push({ h: a.h, e: a.l2 });
      console.log(`   ESCALONADA  h=${(a.h * 1000).toFixed(3)} mm · ${a.act}/${a.tot} celdas de acero · L2=${fx(a.l2, 3)} °C · L∞=${fx(a.linf, 2)} · ‖r‖/‖b‖=${fx(a.residRel, 1)}`);
    }
    const aA = M.ordenObservado(ptsA);
    pReal = aA.p; eCons = ptsA[ptsA.length - 1].e;
    check('MMS EN GEOMETRÍA REAL: orden 2 sobre la frontera escalonada de la pieza',
      Math.abs(aA.p - 2) < 0.12 && aA.R2 > 0.99,
      `p = ${aA.p.toFixed(4)} · R² = ${aA.R2.toFixed(5)} · pares ${aA.porPareja.map((x) => x.toFixed(3)).join(' → ')} — el escalón NO degrada mientras el dato de frontera se lea EN la cara del vóxel`);
    series.push({ nombre: `geometría REAL ${piezaNom} · escalonada`, color: '#ff5c8a', puntos: ptsA, ajuste: aA });

    console.log('\n══ M12 · EL HALLAZGO: dato de la SUPERFICIE REAL aplicado en la cara escalonada ══');
    console.log('   Es lo que hace el código de producción: `mold-thermal-fdm` deposita el calor de');
    console.log('   la superficie moldeante en las celdas kTop/kBot del vóxel, y captura las líneas');
    console.log('   de agua por celdas cercanas. La superficie REAL no está ahí: está hasta h/2 de');
    console.log('   distancia. Ese desplazamiento es O(h) y se lo COME el orden.');
    for (const n of [22, 29, 38, 50, 64]) {
      const b = corrida(n, true);
      ptsB.push({ h: b.h, e: b.l2 });
      console.log(`   SUPERF-REAL h=${(b.h * 1000).toFixed(3)} mm · L2=${fx(b.l2, 3)} °C · L∞=${fx(b.linf, 2)}`);
    }
    const aB = M.ordenObservado(ptsB);
    pStair = aB.p; eStair = ptsB[ptsB.length - 1].e;
    check('HALLAZGO DECLARADO: el orden SE CAE si el dato de frontera viene de la superficie real',
      aB.p < 1.3 && eStair > 10 * eCons,
      `p = ${aB.p.toFixed(3)} (vs ${aA.p.toFixed(3)} consistente) · R² = ${aB.R2.toFixed(3)} · el error se ESTANCA en ${fx(eStair, 2)} °C = ×${(eStair / eCons).toFixed(0)} el consistente`);
    console.log('   DIAGNÓSTICO: no es un bug del ensamble (M11 da 2 sobre la MISMA geometría). Es');
    console.log('   el error GEOMÉTRICO del escalonado: la CF se aplica desplazada hasta h/2, y el');
    console.log('   error ni siquiera baja monótono (R² bajo) porque el patrón de escalones cambia');
    console.log('   con cada malla. FIX conocido: celda cortada / frontera embebida (interpolar el');
    console.log('   dato a la distancia real) o refinar la piel. PENDIENTE — no está implementado.');
    series.push({ nombre: 'geometría REAL · dato de la superficie real (HALLAZGO)', color: '#ff5c5c', puntos: ptsB, ajuste: aB, punteada: true });
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ M13 · CONTROLES NEGATIVOS: los bugs a propósito DEBEN degradar el orden ══');
  console.log('   Un arnés que nunca reprueba es un sello. Cada bug es uno de los que el brief');
  console.log('   nombra: signo del operador, k en la cara equivocada, CF en el nodo de adentro,');
  console.log('   índice corrido en la fuente.');
  const bugs = [];
  {
    const base = M.barridoMMS({ sol: kSuave, ns: NS, L: L_CUBO, frontera: 'dirichlet' });
    const pBase = base.ajuste.p, eBase = base.puntos[base.puntos.length - 1].l2;
    const casos = [
      ['signo-operador', 'signo invertido del término de divergencia', 0.4],
      ['k-cara-duena', 'k de la celda DUEÑA en vez de la media armónica', 1.7],
      ['cf-nodo-interior', 'la CF aplicada en el NODO DE ADENTRO (distancia h, no h/2)', 1.3],
      ['fuente-indice-corrido', 'la fuente de la celda i evaluada en la celda i+1', 1.3],
    ];
    for (const [bug, desc, techo] of casos) {
      const r = M.barridoMMS({ sol: kSuave, ns: NS, L: L_CUBO, frontera: 'dirichlet', bug });
      const e = r.puntos[r.puntos.length - 1].l2;
      bugs.push({ bug, p: r.ajuste.p, factor: e / eBase });
      check(`CONTROL "${bug}" degrada el orden (${desc})`,
        r.ajuste.p < techo && e > 2 * eBase,
        `p = ${r.ajuste.p.toFixed(3)} (sano ${pBase.toFixed(3)}) · error en la malla fina ×${(e / eBase).toFixed(1)}`);
      if (bug === 'cf-nodo-interior') {
        series.push({ nombre: 'CONTROL NEGATIVO · CF en el nodo de adentro', color: '#8fa3bd', puntos: r.puntos.map((p) => ({ h: p.h, e: p.l2 })), ajuste: r.ajuste, punteada: true });
      }
    }
    // el control tiene que estar APUNTANDO a lo correcto: "k de la celda dueña" NO puede
    // hacer nada si k es uniforme (es la misma conductancia). Si degradara ahí, el control
    // estaría midiendo otra cosa.
    const kCte = M.barridoMMS({ sol: trig, ns: NS, L: L_CUBO, frontera: 'dirichlet', bug: 'k-cara-duena' });
    const kCteOk = M.barridoMMS({ sol: trig, ns: NS, L: L_CUBO, frontera: 'dirichlet' });
    check('el control "k-cara-duena" NO tiene efecto con k uniforme (apunta a lo que dice apuntar)',
      Math.abs(kCte.ajuste.p - kCteOk.ajuste.p) < 1e-6,
      `p = ${kCte.ajuste.p.toFixed(6)} = sano ${kCteOk.ajuste.p.toFixed(6)} — con k constante la media armónica ES k/h`);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ LÁMINA ══');
  {
    const svg = M.laminaConvergencia(series, {
      titulo: 'MMS · orden observado del solver térmico de la Forja',
      sub: '-div(k grad T) = S  ·  VF centrado en celda, media armonica, CG  ·  orden TEORICO 2 (thermal-steady.ts L79/L97-109)',
      W: 1080, H: 880, ordenRef: 2,
    });
    const dir = path.join(ROOT, '_laminas');
    fs.mkdirSync(dir, { recursive: true });
    const out = path.join(dir, 'MMS-convergencia.svg');
    fs.writeFileSync(out, svg);
    console.log(` · ${path.relative(ROOT, out)} (${series.length} series, ${(svg.length / 1024).toFixed(1)} kB)`);
  }

  console.log(`\n${fails === 0 ? '✅ TODO VERDE — el solver térmico pasa el MÉTODO DE SOLUCIONES MANUFACTURADAS' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    ordenTeorico: 2,
    pCubo: +pCubo.toFixed(4),
    pGeometriaReal: +pReal.toFixed(4),
    pAxiSolverReal: +pAxi.toFixed(4),
    pFronteraEscalonadaSuperficieReal: +pStair.toFixed(4),
    pieza: piezaNom,
    paridadResidRel: +paridadRel.toExponential(3),
    paridadDesalineadaMinima: +sepDesal.toExponential(3),
    reciprocidadRelReal: +recipReal.toExponential(3),
    controlesNegativos: bugs.map((b) => ({ bug: b.bug, p: +b.p.toFixed(3), errorX: +b.factor.toFixed(1) })),
    pendiente: 'frontera escalonada: sin celda cortada / frontera embebida, el dato de una superficie NO alineada al vóxel degrada el orden a ~1',
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1200)); process.exit(1); });
