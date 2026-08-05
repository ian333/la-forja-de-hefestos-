/**
 * GATE DE VERIFICACIÓN DE SOLUCIÓN — GCI (Roache) + RECIPROCIDAD (Maxwell-Betti)
 * =============================================================================
 * ASME V&V 20-2009 separa verificación de CÓDIGO, verificación de SOLUCIÓN y validación.
 * Este gate cubre la de SOLUCIÓN: le pone BARRA DE ERROR a un resultado de simulación,
 * y comprueba que la barra NO MIENTE.
 *
 *  A · GCI CONTRA UN CASO FABRICADO — se construye f(h) = f_exacto + C·h^p con p CONOCIDO
 *      (p = 1, 2 y 2.5; r = 2, 1.5 y 1.3; y r21 != r32 para la forma implícita de Celik).
 *      Se exige DOS cosas: que el estimador recupere p, y que el GCI ACOTE DE VERDAD el
 *      error real |f1 − f_exacto|. Esa segunda es la que prueba que la barra no miente.
 *  B · CONTROLES NEGATIVOS DEL PROPIO GCI — oscilatoria, divergente, ruido de redondeo,
 *      serie que NO es potencia pura, serie con ruido. El estimador debe NEGARSE, no
 *      inventar una banda tranquila.
 *  C · MAXWELL-BETTI sobre el solver REAL de `lamina-vonmises.ts` (dos sistemas de carga
 *      distintos ⇒ residuo relativo ~ tolerancia del CG) + CONTROL NEGATIVO: un ensamble
 *      con UN término mal puesto, y Betti lo caza.
 *  D · GCI SOBRE EL SOLVER REAL — tres mallas de la sección del molde, σ_vm máx con su
 *      banda al 95 %; y LA SINGULARIDAD de esquina viva, que el estimador debe RECHAZAR.
 *  E · LA LÁMINA `_laminas/GCI-banda.svg`.
 *
 * FUENTES (verificadas en la web, no de memoria):
 *  · Roache, J. Fluids Eng. 116(3):405 (1994) — GCI y Fs = 1.25 para tres mallas.
 *  · Celik, Ghia, Roache & Freitas, J. Fluids Eng. 130:078001 (2008) — forma implícita
 *    del orden p con razón de refinamiento no uniforme.
 *  · NASA Glenn / WIND-US "Examining Spatial (Grid) Convergence" — chequeo asintótico
 *    GCI_23 / (r^p · GCI_12) ≈ 1.
 *
 * Uso: node --import tsx scripts/verif-gci-test.cjs
 */
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', p);
/** formatea un número que puede venir null (el módulo devuelve null cuando NO hay dato) */
const pf = (v, d = 3) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(d));

(async () => {
  const G = await import(R('verificacion/gci.ts'));
  const V = await import(R('mold/lamina-vonmises.ts'));
  const OUT = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(OUT, { recursive: true });
  const res = {};

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ A · GCI CONTRA UN CASO FABRICADO (p conocido) ══');
  // ══════════════════════════════════════════════════════════════════════════
  // f(h) = f_exacto + C·h^p. El estimador NO sabe ni f_exacto ni p ni C.
  const serie = (fe, C, p, hs) => hs.map((h) => fe + C * Math.pow(h, p));
  {
    const casos = [
      { fe: 100, C: 4.5, p: 1.0, r: 2.0, h1: 0.25, et: 'p=1  r=2 (entera)' },
      { fe: 100, C: 4.5, p: 2.0, r: 2.0, h1: 0.25, et: 'p=2  r=2 (entera)' },
      { fe: 100, C: 4.5, p: 2.5, r: 2.0, h1: 0.25, et: 'p=2.5 r=2 (entera)' },
      { fe: 100, C: 4.5, p: 1.0, r: 1.5, h1: 0.40, et: 'p=1  r=1.5 (NO entera)' },
      { fe: 100, C: 4.5, p: 2.0, r: 1.5, h1: 0.40, et: 'p=2  r=1.5 (NO entera)' },
      { fe: 100, C: 4.5, p: 2.5, r: 1.5, h1: 0.40, et: 'p=2.5 r=1.5 (NO entera)' },
      { fe: 100, C: 4.5, p: 2.0, r: 1.3, h1: 0.50, et: 'p=2  r=1.3 (NO entera)' },
      { fe: -37.5, C: -9.0, p: 2.0, r: 1.5, h1: 0.40, et: 'p=2  r=1.5 · f y C NEGATIVOS' },
    ];
    let peorP = 0, peorCobertura = Infinity, peorIdentidad = 0, noAsint = 0, peorRazon = 0;
    for (const c of casos) {
      const hs = [c.h1, c.h1 * c.r, c.h1 * c.r * c.r];
      const [f1, f2, f3] = serie(c.fe, c.C, c.p, hs);
      const g = G.gciDeMallas([f1, f2, f3], hs, { pTeorico: c.p });
      const errReal = Math.abs(f1 - c.fe) / Math.abs(f1);      // el error VERDADERO, relativo a f1
      const banda = g.gciFino;
      const cobertura = banda / errReal;                        // >1 ⇒ el GCI ACOTA el error real
      peorP = Math.max(peorP, Math.abs(g.p - c.p));
      peorCobertura = Math.min(peorCobertura, cobertura);
      peorRazon = Math.max(peorRazon, Math.abs(g.asintotico - 1));
      // IDENTIDAD EXACTA: para una potencia pura, GCI32/(r21^p·GCI21) = |f1|/|f2|
      peorIdentidad = Math.max(peorIdentidad, Math.abs(g.asintotico - Math.abs(f1) / Math.abs(f2)));
      if (!g.enRangoAsintotico) noAsint++;
      const dentro = c.fe >= g.banda95[0] && c.fe <= g.banda95[1];
      console.log(`    ${c.et.padEnd(30)} p_est ${g.p.toFixed(6)} (exacto ${c.p})  GCI ${(100 * banda).toFixed(3)} %  err REAL ${(100 * errReal).toFixed(3)} %  cobertura ${cobertura.toFixed(3)}×  asint ${g.asintotico.toFixed(5)} (|f1/f2| = ${(Math.abs(f1) / Math.abs(f2)).toFixed(5)})  f_exacto dentro de la banda: ${dentro ? 'SÍ' : 'NO'}`);
      if (!dentro) fails++;
    }
    check('A1 el estimador RECUPERA el orden p de la serie fabricada (p = 1, 2, 2.5; r = 2, 1.5, 1.3)',
      peorP < 1e-9, `peor |p_est − p| = ${peorP.toExponential(2)} sobre ${casos.length} casos`);
    check('A2 el GCI ACOTA DE VERDAD el error real |f1 − f_exacto| (cobertura >= 1)',
      peorCobertura >= 1, `peor cobertura = ${peorCobertura.toFixed(4)}× — debe ser >= 1 y ~Fs = 1.25 (la banda es Fs × el error real)`);
    check('A2b y la cobertura es EXACTAMENTE el factor de seguridad (no un margen inventado)',
      Math.abs(peorCobertura - 1.25) < 0.02, `cobertura mínima ${peorCobertura.toFixed(4)}× vs Fs = ${G.FS_TRES_MALLAS}`);
    // El chequeo asintótico NO da 1 exacto: da |f1|/|f2|, o sea que se aleja de 1 tanto
    // como el error relativo aparente. Eso NO es un defecto del código, es lo que la
    // fórmula de Roache/NASA calcula — y hay que decirlo, porque significa que el
    // chequeo asintótico es MUCHO más débil de lo que su nombre sugiere.
    check('A3 el chequeo asintótico es EXACTAMENTE |f1|/|f2| en una potencia pura (identidad verificada, no supuesta)',
      peorIdentidad < 1e-12,
      `peor |asintótico − |f1/f2|| = ${peorIdentidad.toExponential(2)} · peor |asintótico − 1| = ${(100 * peorRazon).toFixed(3)} % (= el error relativo aparente, NO cero)`);
    check('A3b y con el umbral DECLARADO los 8 casos fabricados caen EN rango asintótico',
      noAsint === 0, `${noAsint} casos fuera de rango con tolerancia ${G.TOL_ASINTOTICO_VERDE} (deben ser 0)`);
    res.fabricadoPeorP = +peorP.toExponential(2);
    res.fabricadoCobertura = +peorCobertura.toFixed(4);
    res.fabricadoIdentidadAsint = +peorIdentidad.toExponential(2);
  }
  {
    // ── razón de refinamiento NO UNIFORME: r21 != r32 ⇒ la forma IMPLÍCITA de Celik
    let peor = 0;
    const tabla = [];
    for (const [h1, h2, h3, p] of [[1, 1.5, 2.4, 2.0], [1, 1.5, 2.4, 1.0], [1, 1.3, 2.1, 2.5], [0.5, 0.9, 1.35, 1.8]]) {
      const [f1, f2, f3] = serie(250, 3.3, p, [h1, h2, h3]);
      const g = G.gciDeMallas([f1, f2, f3], [h1, h2, h3]);
      peor = Math.max(peor, Math.abs(g.p - p));
      tabla.push(`r21=${(h2 / h1).toFixed(3)} r32=${(h3 / h2).toFixed(3)} p=${p} ⇒ ${g.p.toFixed(8)} (${g.pMetodo})`);
      const errReal = Math.abs(f1 - 250) / Math.abs(f1);
      if (!(g.gciFino / errReal >= 1)) fails++;
    }
    check('A4 razón de refinamiento NO UNIFORME (r21 != r32): la ecuación implícita de Celik recupera p',
      peor < 1e-8, tabla.join(' · '));
    res.celikPeorP = +peor.toExponential(2);
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ B · CONTROLES NEGATIVOS DEL GCI (debe NEGARSE, no inventar banda) ══');
  // ══════════════════════════════════════════════════════════════════════════
  {
    // B1 OSCILATORIA: (f3−f2)/(f2−f1) < 0
    const g = G.gci(100.02, 99.95, 100.11, 2);
    check('B1 convergencia OSCILATORIA (e32/e21 < 0) se DECLARA y NO se emite banda',
      g.regimen === 'oscilatoria' && g.banda95 === null && g.gciFino === null && !g.enRangoAsintotico,
      `razón ${g.razon.toFixed(4)} · régimen "${g.regimen}" · banda95 = ${g.banda95} · rango observado [${g.rangoObservado[0]}, ${g.rangoObservado[1]}]`);

    // B2 DIVERGENTE: las diferencias CRECEN al refinar (|e32| < |e21|) ⇒ p <= 0
    const d = G.gci(700, 640, 610, 2);
    check('B2 serie DIVERGENTE (p <= 0) se DECLARA y NO se emite banda',
      d.regimen === 'divergente' && d.p <= 0 && d.banda95 === null,
      `p = ${d.p.toFixed(4)} · régimen "${d.regimen}" · el GCI clásico daría r^p − 1 = ${(Math.pow(2, d.p) - 1).toFixed(4)} < 0 (un "intervalo" negativo)`);

    // B3 CONVERGIDA: diferencias en el ruido de redondeo ⇒ p es 0/0
    const fe = 1234.5678;
    const cv = G.gci(fe, fe + 1e-12, fe + 3e-12, 2);
    check('B3 diferencias EN EL RUIDO DE REDONDEO: p no identificable, se reporta la cota y NO se llama GCI',
      cv.regimen === 'convergida' && cv.p === null && cv.gciFino === null && cv.cotaRuido > 0,
      `régimen "${cv.regimen}" · cota por ruido ${(100 * cv.cotaRuido).toExponential(2)} % (Fs × ruido, NO es un GCI)`);
    const cv0 = G.gci(fe, fe, fe, 2);
    check('B3b serie IDÉNTICA (diferencias exactamente 0) tampoco produce un p inventado',
      cv0.regimen === 'convergida' && cv0.p === null,
      `régimen "${cv0.regimen}" · e21 = ${cv0.e21} · e32 = ${cv0.e32}`);

    // B4 SERIE QUE NO ES POTENCIA PURA — orden MIXTO a·h + b·h³.
    //    Aquí se DECLARA el punto ciego del método: con TRES mallas el ajuste
    //    f = fe + C·h^p tiene 3 datos y 3 incógnitas ⇒ SIEMPRE cierra exacto, y el
    //    chequeo asintótico (que sólo vale |f1|/|f2|) sale VERDE igual. El detector real
    //    es una CUARTA malla.
    const mix = (h) => 500 + 2 * h + 8 * Math.pow(h, 3);
    const hs = [0.3, 0.62, 1.35];
    const gm = G.gciDeMallas([mix(hs[0]), mix(hs[1]), mix(hs[2])], hs);
    check('B4 PUNTO CIEGO DECLARADO: con 3 mallas una serie de ORDEN MIXTO (500+2h+8h³) pasa el chequeo asintótico',
      gm.regimen === 'monotona' && gm.enRangoAsintotico && Math.abs(gm.p - 1) > 0.4 && Math.abs(gm.p - 3) > 0.2,
      `p aparente ${gm.p.toFixed(4)} — NI 1 NI 3, es un promedio sin significado · asintótico ${gm.asintotico.toFixed(4)} · semáforo ${gm.semaforo}. El chequeo asintótico NO detecta orden mixto porque sólo mide |f1|/|f2|`);

    // La transición entre los dos términos está en 2h = 8h³ ⇒ h = 0.5. Las cuatro
    // mallas la CRUZAN (0.06 … 1.62), así que el triplete fino ve el término lineal y
    // el grueso ve el cúbico: ahí es donde la cuarta malla muerde.
    const hs4 = [0.06, 0.18, 0.54, 1.62];
    const co = G.consistenciaOrden(hs4.map(mix), hs4);
    const coPuro = G.consistenciaOrden(hs4.map((h) => 100 + 4.5 * h * h), hs4);
    check('B4b LA CUARTA MALLA sí lo caza: los dos tripletes dan p distintos (y con potencia pura, el mismo)',
      !co.consistente && coPuro.consistente,
      `orden mixto ⇒ p = ${co.ps.map((x) => x.toFixed(3)).join(' vs ')} (dispersión ${(100 * co.dispersionP).toFixed(1)} %) · potencia pura h² ⇒ p = ${coPuro.ps.map((x) => x.toFixed(6)).join(' vs ')} (dispersión ${(100 * coPuro.dispersionP).toExponential(1)} %)`);
    // …y el LÍMITE de ese detector, medido: si las cuatro mallas caen todas del mismo
    // lado de la transición, ni la cuarta malla la ve. Se declara, no se presume.
    const hsLejos = [0.3, 0.62, 1.35, 2.9];   // todas por ARRIBA de h = 0.5 ⇒ manda el h³
    const coLejos = G.consistenciaOrden(hsLejos.map(mix), hsLejos);
    check('B4c LÍMITE DECLARADO del detector: si las 4 mallas NO cruzan la transición, ni así se ve el orden mixto',
      coLejos.consistente,
      `mallas 0.3…2.9 (todas donde manda el h³) ⇒ p = ${coLejos.ps.map((x) => x.toFixed(3)).join(' vs ')}, dispersión ${(100 * coLejos.dispersionP).toFixed(1)} % <= ${(100 * coLejos.tolP).toFixed(0)} % ⇒ se declara CONSISTENTE aunque la serie NO sea una potencia única. El estudio de convergencia sólo ve lo que su rango de h abarca`);

    // B5 SERIE CON RUIDO encima de la potencia — ~0.4 % determinista sobre p=2
    const puro = serie(100, 4.5, 2, [0.25, 0.5, 1.0]);
    const ruidosa = [puro[0] * 1.004, puro[1] * 0.997, puro[2] * 1.002];
    const gr = G.gciDeMallas(ruidosa, [0.25, 0.5, 1.0]);
    check('B5 con RUIDO de ~0.4 % el orden observado se DESTROZA aunque el chequeo asintótico siga verde',
      Math.abs(gr.p - 2) > 1,
      `p ${gr.p.toFixed(4)} contra 2 exacto sin ruido · asintótico ${gr.asintotico.toFixed(4)} · semáforo ${gr.semaforo} ⇒ el p observado es el que hay que mirar contra el TEÓRICO, no el semáforo solo`);
    const co5 = G.consistenciaOrden(
      [1.004, 0.997, 1.002, 0.9965].map((k, i) => k * (100 + 4.5 * Math.pow([0.25, 0.5, 1.0, 2.0][i], 2))),
      [0.25, 0.5, 1.0, 2.0]);
    check('B5b y con RUIDO la cuarta malla también lo caza (los tripletes no coinciden)',
      !co5.consistente,
      `p = ${co5.ps.map((x) => (x == null ? '—' : x.toFixed(3))).join(' vs ')} · ${co5.nota.slice(0, 90)}…`);

    // B6 el módulo NO acepta r <= 1 (el error #1: meter las mallas al revés)
    let tiro = false;
    try { G.gci(1, 2, 3, 0.5); } catch (e) { tiro = /razón de refinamiento debe ser > 1/.test(String(e.message)); }
    let tiro2 = false;
    try { G.gciDeMallas([1, 2, 3], [4, 2, 1]); } catch (e) { tiro2 = /h1 < h2 < h3/.test(String(e.message)); }
    check('B6 meter las mallas AL REVÉS es un error duro, no un resultado silencioso', tiro && tiro2,
      'gci() rechaza r <= 1 y gciDeMallas() exige h1 < h2 < h3 (fino → grueso)');
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ C · MAXWELL-BETTI SOBRE EL SOLVER REAL ══');
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * Vector de cargas nodales CONSISTENTE para presiones sobre bordes libres.
   * Reproduce EXACTAMENTE lo que hace `resolverElasticidad2D`: para tracción constante
   * sobre un borde de 2 nodos, la cuadratura de 2 puntos de Gauss da t·L/2 en cada nodo
   * (Σ N_a sobre los dos puntos = 1). Si esto no coincidiera con el solver, Betti lo
   * cazaría — o sea que también es un check de consistencia de las cargas.
   */
  const fDePresiones = (m, presiones) => {
    const f = new Float64Array(2 * m.nNodos);
    for (const p of presiones) {
      const ax = m.xy[2 * p.a], ay = m.xy[2 * p.a + 1], bx = m.xy[2 * p.b], by = m.xy[2 * p.b + 1];
      const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy);
      const nx = dy / L, ny = -dx / L;              // normal EXTERIOR (quad antihorario)
      const tx = -p.pMPa * nx, ty = -p.pMPa * ny;   // la presión empuja HACIA ADENTRO
      f[2 * p.a] += (tx * L) / 2; f[2 * p.a + 1] += (ty * L) / 2;
      f[2 * p.b] += (tx * L) / 2; f[2 * p.b + 1] += (ty * L) / 2;
    }
    return f;
  };
  let bettiReal = null, bettiFino = null;
  {
    // malla de la sección REAL (burda a propósito: Betti no necesita refinar nada)
    const mod = V.seccionBezelLibro({ hMallaMm: 12, divBarreno: 8 });
    const campo = V.campoVonMises(mod);
    const m = campo.malla;
    const P = mod.placas;
    const Htot = P.bottomClamp + P.ejectorHousing + P.support + P.B + P.A + P.topClamp;

    // MISMAS condiciones de frontera para los dos sistemas (lo que `resolver` hace)
    const fijos = [];
    let aAb = -1, dAb = Infinity, aAr = -1, dAr = Infinity;
    for (let i = 0; i < m.nNodos; i++) {
      const x = m.xy[2 * i], y = m.xy[2 * i + 1], d = Math.abs(x - mod.anchoMm / 2);
      if (y < 1e-6) { fijos.push({ nodo: i, uy: true }); if (d < dAb) { dAb = d; aAb = i; } }
      if (y > Htot - 1e-6) { fijos.push({ nodo: i, uy: true }); if (d < dAr) { dAr = d; aAr = i; } }
    }
    fijos.push({ nodo: aAb, ux: true }, { nodo: aAr, ux: true });

    const libres = V.bordesLibres(m);
    const cav = campo.vacios.find((v) => v.nombre === 'cavidad');
    const enCav = (b) => b.mx >= cav.x0 - 1e-6 && b.mx <= cav.x1 + 1e-6 && b.my >= cav.y0 - 1e-6 && b.my <= cav.y1 + 1e-6;
    // SISTEMA A: la presión de fundido en la cavidad (la carga física de la Fig 12.2)
    const presA = libres.filter(enCav).map((b) => ({ a: b.a, b: b.b, pMPa: 150 }));
    // SISTEMA B: presión en las paredes de TODAS las líneas de agua — otra carga, otro
    // punto de aplicación, otro lado del molde. Nada que ver con A.
    const redondos = mod.barrenos.filter((b) => b.ejePerpendicular);
    const enBarreno = (b) => redondos.some((z) => Math.abs(Math.hypot(b.mx - z.x, b.my - z.y) - z.diaMm / 2) < z.diaMm * 0.12);
    const presB = libres.filter((b) => !enCav(b) && enBarreno(b)).map((b) => ({ a: b.a, b: b.b, pMPa: 64 }));

    const fA = fDePresiones(m, presA), fB = fDePresiones(m, presB);
    const corre = (presiones, tol) => V.resolverElasticidad2D(m, {
      estado: 'deformacion-plana', fijos, presiones, tol, maxIter: 200000,
    });
    const sA = corre(presA, 1e-13), sB = corre(presB, 1e-13);
    bettiReal = G.bettiResiduo(
      { f: fA, u: sA.u, nombre: 'A(presión de fundido)' },
      { f: fB, u: sB.u, nombre: 'B(presión en líneas de agua)' },
      { tol: 1e-9 });
    console.log(`    malla: ${m.nQuads} quads · ${m.nNodos} nodos · ${presA.length} bordes cargados en A · ${presB.length} en B`);
    console.log(`    residuo CG: A ${sA.residuo.toExponential(2)} (${sA.iters} it) · B ${sB.residuo.toExponential(2)} (${sB.iters} it)`);
    check('C1 MAXWELL-BETTI en el solver REAL: W_AB = W_BA con dos sistemas de carga distintos',
      bettiReal.pasa,
      `W_AB = ${bettiReal.wAB.toPrecision(12)} · W_BA = ${bettiReal.wBA.toPrecision(12)} ⇒ residuo ${bettiReal.residuo.toExponential(3)} (tol ${bettiReal.tol.toExponential(0)})`);

    // ── el residuo que queda ES la tolerancia del CG, no asimetría: se DEMUESTRA
    const sA8 = corre(presA, 1e-6), sB8 = corre(presB, 1e-6);
    const b8 = G.bettiResiduo({ f: fA, u: sA8.u }, { f: fB, u: sB8.u }, { tol: 1 });
    check('C1b y ese residuo BAJA con la tolerancia del CG ⇒ es error de iteración, NO asimetría de K',
      b8.residuo > bettiReal.residuo * 20,
      `CG a 1e-6 ⇒ residuo Betti ${b8.residuo.toExponential(3)} · CG a 1e-13 ⇒ ${bettiReal.residuo.toExponential(3)} (${(b8.residuo / bettiReal.residuo).toExponential(1)}× mejor)`);

    // ── y se cumple en una malla DISTINTA (Betti no depende de la malla)
    const modF = V.seccionBezelLibro({ hMallaMm: 7, divBarreno: 12 });
    const cF = V.campoVonMises(modF);
    const mF = cF.malla;
    const fijosF = [];
    let a1 = -1, d1 = Infinity, a2 = -1, d2 = Infinity;
    for (let i = 0; i < mF.nNodos; i++) {
      const x = mF.xy[2 * i], y = mF.xy[2 * i + 1], d = Math.abs(x - modF.anchoMm / 2);
      if (y < 1e-6) { fijosF.push({ nodo: i, uy: true }); if (d < d1) { d1 = d; a1 = i; } }
      if (y > Htot - 1e-6) { fijosF.push({ nodo: i, uy: true }); if (d < d2) { d2 = d; a2 = i; } }
    }
    fijosF.push({ nodo: a1, ux: true }, { nodo: a2, ux: true });
    const librF = V.bordesLibres(mF);
    const cavF = cF.vacios.find((v) => v.nombre === 'cavidad');
    const enCavF = (b) => b.mx >= cavF.x0 - 1e-6 && b.mx <= cavF.x1 + 1e-6 && b.my >= cavF.y0 - 1e-6 && b.my <= cavF.y1 + 1e-6;
    const pAF = librF.filter(enCavF).map((b) => ({ a: b.a, b: b.b, pMPa: 150 }));
    const pBF = librF.filter((b) => !enCavF(b) && redondos.some((z) => Math.abs(Math.hypot(b.mx - z.x, b.my - z.y) - z.diaMm / 2) < z.diaMm * 0.12))
      .map((b) => ({ a: b.a, b: b.b, pMPa: 64 }));
    const sAF = V.resolverElasticidad2D(mF, { estado: 'deformacion-plana', fijos: fijosF, presiones: pAF, tol: 1e-13, maxIter: 200000 });
    const sBF = V.resolverElasticidad2D(mF, { estado: 'deformacion-plana', fijos: fijosF, presiones: pBF, tol: 1e-13, maxIter: 200000 });
    bettiFino = G.bettiResiduo({ f: fDePresiones(mF, pAF), u: sAF.u }, { f: fDePresiones(mF, pBF), u: sBF.u }, { tol: 1e-9 });
    check('C1c Betti se cumple IGUAL en otra malla (no necesita refinamiento: es álgebra, no convergencia)',
      bettiFino.pasa,
      `malla de ${mF.nQuads} quads ⇒ residuo ${bettiFino.residuo.toExponential(3)} (la de ${m.nQuads} quads dio ${bettiReal.residuo.toExponential(3)})`);
  }

  // ── CONTROL NEGATIVO: un ensamble con UN término mal puesto ────────────────
  /**
   * MODELO DE CONTROL (juguete, NO el solver del molde): Q4 en esfuerzo plano, matriz
   * DENSA y solución directa por LU. Existe sólo para poder ROMPER el ensamble a
   * propósito — cosa que no se puede hacer sin tocar `lamina-vonmises.ts`. Con
   * `romper = 0` reproduce un ensamble correcto (K simétrica); con `romper != 0` se
   * escala UN término k_ij de UN elemento sin tocar su transpuesto k_ji.
   */
  const controlQ4 = (romper) => {
    const nx = 3, ny = 2, W2 = 30, H2 = 20, E = 205000, nu = 0.3;
    const nnod = (nx + 1) * (ny + 1), n = 2 * nnod;
    const xy = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) xy.push((W2 * i) / nx, (H2 * j) / ny);
    const quads = [];
    const id = (i, j) => j * (nx + 1) + i;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) quads.push(id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1));
    const k = E / (1 - nu * nu);
    const D = [[k, k * nu, 0], [k * nu, k, 0], [0, 0, (k * (1 - nu)) / 2]];
    const g = 1 / Math.sqrt(3), GP = [[-g, -g], [g, -g], [g, g], [-g, g]];
    const K = Array.from({ length: n }, () => new Float64Array(n));
    for (let e = 0; e < quads.length / 4; e++) {
      const ke = new Float64Array(64);
      for (const [xi, eta] of GP) {
        const dNxi = [-(1 - eta) / 4, (1 - eta) / 4, (1 + eta) / 4, -(1 + eta) / 4];
        const dNet = [-(1 - xi) / 4, -(1 + xi) / 4, (1 + xi) / 4, (1 - xi) / 4];
        let j11 = 0, j12 = 0, j21 = 0, j22 = 0;
        for (let a = 0; a < 4; a++) {
          const nd = quads[4 * e + a];
          j11 += dNxi[a] * xy[2 * nd]; j12 += dNxi[a] * xy[2 * nd + 1];
          j21 += dNet[a] * xy[2 * nd]; j22 += dNet[a] * xy[2 * nd + 1];
        }
        const det = j11 * j22 - j12 * j21;
        const dx = [], dy = [];
        for (let a = 0; a < 4; a++) {
          dx.push((j22 * dNxi[a] - j12 * dNet[a]) / det);
          dy.push((-j21 * dNxi[a] + j11 * dNet[a]) / det);
        }
        const B = [new Float64Array(8), new Float64Array(8), new Float64Array(8)];
        for (let a = 0; a < 4; a++) { B[0][2 * a] = dx[a]; B[1][2 * a + 1] = dy[a]; B[2][2 * a] = dy[a]; B[2][2 * a + 1] = dx[a]; }
        for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
          let s = 0;
          for (let r = 0; r < 3; r++) {
            const DB = D[r][0] * B[0][b] + D[r][1] * B[1][b] + D[r][2] * B[2][b];
            s += B[r][a] * DB;
          }
          ke[8 * a + b] += s * det;
        }
      }
      const dof = [];
      for (let a = 0; a < 4; a++) { const nd = quads[4 * e + a]; dof.push(2 * nd, 2 * nd + 1); }
      for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
        // EL BUG INYECTADO: en el elemento 0 el término (2,5) entra escalado y su
        // transpuesto (5,2) entra limpio ⇒ K deja de ser simétrica.
        const mal = romper !== 0 && e === 0 && a === 2 && b === 5 ? 1 + romper : 1;
        K[dof[a]][dof[b]] += ke[8 * a + b] * mal;
      }
    }
    // Dirichlet: empotrado en x = 0 (fila y columna a identidad — preserva la simetría)
    const fijo = new Uint8Array(n);
    for (let i = 0; i < nnod; i++) if (xy[2 * i] < 1e-9) { fijo[2 * i] = 1; fijo[2 * i + 1] = 1; }
    for (let i = 0; i < n; i++) {
      if (!fijo[i]) continue;
      for (let j = 0; j < n; j++) { K[i][j] = 0; K[j][i] = 0; }
      K[i][i] = 1;
    }
    // dos sistemas de carga distintos
    const fA = new Float64Array(n), fB = new Float64Array(n);
    for (let i = 0; i < nnod; i++) {
      if (xy[2 * i] > W2 - 1e-9) fA[2 * i + 1] = -900;                 // corte en la punta
      if (xy[2 * i + 1] > H2 - 1e-9 && xy[2 * i] > 1e-9) fB[2 * i] = 450;  // arrastre en el lomo
    }
    // LU densa con pivoteo parcial
    const lu = (M, b) => {
      const A = M.map((r) => Float64Array.from(r)), x = Float64Array.from(b), piv = [];
      for (let c = 0; c < n; c++) {
        let p = c;
        for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
        [A[c], A[p]] = [A[p], A[c]];
        const t = x[c]; x[c] = x[p]; x[p] = t;
        piv.push(p);
        for (let r = c + 1; r < n; r++) {
          const fct = A[r][c] / A[c][c];
          if (fct === 0) continue;
          for (let q = c; q < n; q++) A[r][q] -= fct * A[c][q];
          x[r] -= fct * x[c];
        }
      }
      for (let r = n - 1; r >= 0; r--) {
        let s = x[r];
        for (let q = r + 1; q < n; q++) s -= A[r][q] * x[q];
        x[r] = s / A[r][r];
      }
      return x;
    };
    const uA = lu(K, fA), uB = lu(K, fB);
    return { K, n, betti: G.bettiResiduo({ f: fA, u: uA, nombre: 'A' }, { f: fB, u: uB, nombre: 'B' }, { tol: 1e-12 }), sim: G.residuoSimetria(K, n) };
  };
  let ctrlBueno = null, ctrlMalo = null;
  {
    ctrlBueno = controlQ4(0);
    check('C2 el MODELO DE CONTROL con ensamble CORRECTO cumple Betti al nivel del redondeo',
      ctrlBueno.betti.pasa && ctrlBueno.sim < 1e-15,
      `residuo Betti ${ctrlBueno.betti.residuo.toExponential(3)} · residuo de simetría de K ${ctrlBueno.sim.toExponential(2)} (${ctrlBueno.n} GDL, LU densa)`);

    const deltas = [1e-2, 1e-3, 1e-4, 1e-6];
    const fila = [];
    let todosCazados = true;
    for (const d of deltas) {
      const c = controlQ4(d);
      fila.push(`δ=${d.toExponential(0)} ⇒ Betti ${c.betti.residuo.toExponential(2)}`);
      if (c.betti.pasa) todosCazados = false;
      if (d === 1e-3) ctrlMalo = c;
    }
    check('C3 CONTROL NEGATIVO: se escala UN término k(2,5) del elemento 0 sin su transpuesto ⇒ Betti LO CAZA',
      todosCazados,
      fila.join(' · ') + ` (tol ${ctrlBueno.betti.tol.toExponential(0)})`);
    check('C3b y el residuo de Betti SIGUE al tamaño del error de ensamble (no es un umbral binario de suerte)',
      ctrlMalo.betti.residuo > ctrlBueno.betti.residuo * 1e6,
      `sano ${ctrlBueno.betti.residuo.toExponential(3)} → roto con δ=1e-3 ${ctrlMalo.betti.residuo.toExponential(3)} · residuo de simetría de K ${ctrlMalo.sim.toExponential(2)}`);
    res.bettiControlSano = +ctrlBueno.betti.residuo.toExponential(2);
    res.bettiControlRoto = +ctrlMalo.betti.residuo.toExponential(2);
  }
  res.bettiReal = +bettiReal.residuo.toExponential(2);

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ D · GCI SOBRE EL SOLVER REAL (lamina-vonmises.ts) ══');
  // ══════════════════════════════════════════════════════════════════════════
  let panelSigma = null, panelSing = null, gSigma = null, gSing = null, gSoloH = null;
  {
    // TRES mallas SISTEMÁTICAS: se refina hMm Y divBarreno con la MISMA razón 1.5 —
    // si sólo se refina hMm, la malla del BARRENO (donde vive el máximo) no cambia y el
    // estudio de convergencia no mide nada. Se demuestra abajo (D3).
    const mallas = [[4.667, 18], [7, 12], [10.5, 8]];   // fino → grueso
    const filas = [];
    for (const [h, db] of mallas) {
      const t0 = Date.now();
      const c = V.campoVonMises(V.seccionBezelLibro({ hMallaMm: h, divBarreno: db }));
      let area = 0;
      for (let e = 0; e < c.malla.nQuads; e++) area += c.sol.areaElem[e];
      const hRep = G.hRepresentativo(area, c.malla.nQuads, 2);   // Celik 2008 ec. 1
      filas.push({
        h, db, hRep, n: c.malla.nQuads,
        sigma: c.sigmaMaxMPa, en: c.sigmaMaxEn, esq: c.sigmaEsquinaMPa, ms: Date.now() - t0,
      });
      console.log(`    h=${String(h).padStart(6)} divBarreno=${String(db).padStart(2)} · ${String(c.malla.nQuads).padStart(5)} quads · h_rep = ${hRep.toFixed(4)} mm · σ_max ${c.sigmaMaxMPa.toFixed(3)} MPa en (${c.sigmaMaxEn[0].toFixed(1)}, ${c.sigmaMaxEn[1].toFixed(1)}) · pico de esquina ${c.sigmaEsquinaMPa.toFixed(1)} MPa · ${Date.now() - t0} ms`);
    }
    const hs = [filas[0].hRep, filas[1].hRep, filas[2].hRep];
    gSigma = G.gciDeMallas([filas[0].sigma, filas[1].sigma, filas[2].sigma], hs);
    console.log(`\n    ${gSigma.nota}\n`);
    check('D1 σ_vm máx converge MONÓTONO y el estimador entrega orden y banda al 95 %',
      gSigma.regimen === 'monotona' && gSigma.p > 0 && gSigma.banda95 != null,
      `p = ${gSigma.p.toFixed(3)} (Kirsch en este mismo solver dio orden 2.46 en malla limpia) · GCI_fino ${(100 * gSigma.gciFino).toFixed(2)} % · σ_max = ${gSigma.f1.toFixed(1)} ± ${(gSigma.gciFino * gSigma.f1).toFixed(1)} MPa · Richardson h→0 = ${gSigma.fExtrapolado.toFixed(1)} MPa`);
    check('D1b SE DECLARA el rango asintótico (no se afirma sin medirlo)',
      typeof gSigma.enRangoAsintotico === 'boolean' && gSigma.asintotico != null,
      `razón asintótica ${gSigma.asintotico.toFixed(4)} · umbral DECLARADO ${G.TOL_ASINTOTICO_VERDE} ⇒ ${gSigma.enRangoAsintotico ? 'EN RANGO' : 'FUERA DE RANGO: la banda es INDICATIVA'} · semáforo ${gSigma.semaforo}`);

    // ── LA SINGULARIDAD: el pico en las esquinas vivas del bolsillo NO converge
    gSing = G.gciDeMallas([filas[0].esq, filas[1].esq, filas[2].esq], hs);
    check('D2 LA SINGULARIDAD de esquina viva: el estimador la CAZA y NIEGA la barra de error',
      gSing.regimen !== 'monotona' && gSing.banda95 === null,
      `${filas[2].esq.toFixed(1)} → ${filas[1].esq.toFixed(1)} → ${filas[0].esq.toFixed(1)} MPa al refinar · p = ${gSing.p == null ? '—' : gSing.p.toFixed(4)} · régimen "${gSing.regimen}" · banda95 = ${gSing.banda95}`);
    check('D2b y es DIVERGENCIA declarada (p <= 0), no un p sospechoso con banda tranquila',
      gSing.regimen === 'divergente' && gSing.p != null && gSing.p <= 0 && gSing.gciFino === null,
      `p = ${pf(gSing.p, 4)} <= 0 ⇒ r^p − 1 < 0: el GCI clásico daría un "intervalo" negativo. Rango observado [${gSing.rangoObservado[0].toFixed(1)}, ${gSing.rangoObservado[1].toFixed(1)}] MPa — eso es un HECHO, no una barra de error`);

    // ── D3 EL DIAGNÓSTICO: refinar SÓLO hMm no refina donde vive σ_max
    const soloH = [];
    for (const h of [5, 8, 12.8]) {   // r = 1.6, divBarreno FIJO en 12
      const c = V.campoVonMises(V.seccionBezelLibro({ hMallaMm: h }));
      let area = 0;
      for (let e = 0; e < c.malla.nQuads; e++) area += c.sol.areaElem[e];
      soloH.push({ h, hRep: G.hRepresentativo(area, c.malla.nQuads, 2), n: c.malla.nQuads, sigma: c.sigmaMaxMPa });
    }
    gSoloH = G.gciDeMallas(soloH.map((z) => z.sigma), soloH.map((z) => z.hRep));
    const banda = gSoloH.gciFino == null ? null : 100 * gSoloH.gciFino;
    console.log(`    refinando SÓLO hMm (divBarreno fijo = 12): σ_max ${soloH[2].sigma.toFixed(2)} → ${soloH[1].sigma.toFixed(2)} → ${soloH[0].sigma.toFixed(2)} MPa ⇒ régimen "${gSoloH.regimen}", banda ${banda == null ? 'NO HAY' : banda.toFixed(2) + ' %'}`);
    check('D3 refinar SÓLO hMm da una convergencia FALSA: la banda real es ~4× mayor cuando también se refina el barreno',
      banda == null || banda * 3 < 100 * gSigma.gciFino,
      `sólo hMm ⇒ ${banda == null ? 'sin banda' : banda.toFixed(2) + ' %'} · refinamiento SISTEMÁTICO (hMm y divBarreno a la vez) ⇒ ${(100 * gSigma.gciFino).toFixed(2)} %. σ_max cae en (${filas[0].en[0].toFixed(1)}, ${filas[0].en[1].toFixed(1)}) = el borde de una línea de agua, y esa malla la manda divBarreno, NO hMm`);

    panelSigma = {
      titulo: 'σ_vm máx de la sección (fuera de los discos singulares)', unidad: 'MPa',
      series: [
        { etiqueta: `h=${mallas[0][0]} div=${mallas[0][1]}`, h: filas[0].hRep, n: filas[0].n, f: filas[0].sigma },
        { etiqueta: `h=${mallas[1][0]} div=${mallas[1][1]}`, h: filas[1].hRep, n: filas[1].n, f: filas[1].sigma },
        { etiqueta: `h=${mallas[2][0]} div=${mallas[2][1]}`, h: filas[2].hRep, n: filas[2].n, f: filas[2].sigma },
      ],
      res: gSigma,
    };
    panelSing = {
      titulo: 'CONTROL · pico en la ESQUINA VIVA (singularidad)', unidad: 'MPa',
      series: [
        { etiqueta: 'fina', h: filas[0].hRep, n: filas[0].n, f: filas[0].esq },
        { etiqueta: 'media', h: filas[1].hRep, n: filas[1].n, f: filas[1].esq },
        { etiqueta: 'gruesa', h: filas[2].hRep, n: filas[2].n, f: filas[2].esq },
      ],
      res: gSing,
    };
    res.sigmaMaxFino = +gSigma.f1.toFixed(2);
    res.sigmaMaxP = +gSigma.p.toFixed(3);
    res.sigmaMaxGCIPct = +(100 * gSigma.gciFino).toFixed(2);
    res.sigmaMaxAsint = +gSigma.asintotico.toFixed(4);
    res.sigmaMaxEnRango = gSigma.enRangoAsintotico;
    res.singularidadP = +gSing.p.toFixed(4);
    res.singularidadRegimen = gSing.regimen;
  }

  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n══ E · LA LÁMINA ══');
  // ══════════════════════════════════════════════════════════════════════════
  {
    const lam = G.laminaGCI({
      titulo: 'GCI — LA BARRA DE ERROR DE LA MALLA · σ_vm máx del molde del bezel',
      cita: 'Roache J.Fluids Eng 116:405 (1994) · Celik et al. JFE 130:078001 (2008) · ASME V&V 20-2009 · Fs = 1.25 (3 mallas)',
      subtitulo: 'Verificación de SOLUCIÓN (no de código, no validación): tres mallas del MISMO problema en '
        + 'lamina-vonmises.ts, refinadas de forma SISTEMÁTICA (hMm y divBarreno con la misma razón). El número '
        + 'grande es lo que se entrega; la barra vertical es cuánto de él es MALLA y no física.',
      principal: panelSigma,
      singularidad: panelSing,
      betti: {
        residuo: bettiReal.residuo, tol: bettiReal.tol, wAB: bettiReal.wAB, wBA: bettiReal.wBA,
        controlResiduo: ctrlMalo.betti.residuo,
        controlDelta: 'un termino k(2,5) del elemento 0 escalado +0.1 % sin su transpuesto ⇒ K deja de ser simetrica: '
          + `Betti salta de ${ctrlBueno.betti.residuo.toExponential(1)} a ${ctrlMalo.betti.residuo.toExponential(1)}`,
      },
      declarado: [
        `El umbral ${G.TOL_ASINTOTICO_VERDE} del semáforo es convención DECLARADA de este repo: la fuente sólo dice "≈ 1".`,
        'El GCI mide SÓLO discretización. NO cubre el modelo (2D deformación plana, sin contacto en la partición, sin cierre, sin térmico) ni la validación contra experimento.',
        `Esquina viva: p = ${pf(gSing.p, 3)} <= 0, régimen "${gSing.regimen}". Se reporta rango observado, nunca banda.`,
        'PUNTO CIEGO medido (B4): el chequeo asintótico vale EXACTAMENTE |f1|/|f2|; con 3 mallas el ajuste de potencia siempre cierra y un orden MIXTO pasa en verde. Detector real: una CUARTA malla.',
        `Refinar sólo hMm con divBarreno fijo da convergencia FALSA (${gSoloH.gciFino == null ? 'sin banda' : (100 * gSoloH.gciFino).toFixed(2) + ' %'} vs ${(100 * gSigma.gciFino).toFixed(2)} %): σ_max vive en el borde de una línea de agua.`,
        'Betti verifica simetría de K, ensamble y cargas — NO que la malla alcance. Son complementarios.',
      ],
    });
    fs.writeFileSync(path.join(OUT, 'GCI-banda.svg'), lam.svg);
    check('E1 la lámina imprime el orden OBSERVADO, la banda al 95 % y el semáforo asintótico',
      /orden OBSERVADO p =/.test(lam.svg) && /95 %/.test(lam.svg) && /ASINT/.test(lam.svg),
      `_laminas/GCI-banda.svg (${(lam.svg.length / 1024).toFixed(0)} kB)`);
    check('E2 la lámina DECLARA lo que el GCI no cubre y el caso sin banda',
      /LO DECLARADO/.test(lam.svg) && /SIN LÍMITE/.test(lam.svg) && /no hay barra de error/.test(lam.svg),
      'el panel de la singularidad dibuja la fuga y dice que no hay barra de error');
    check('E3 la lámina imprime la FUENTE de Fs = 1.25 y las fórmulas (nada de números sueltos)',
      /Roache/.test(lam.svg) && /Celik/.test(lam.svg) && /Fs = 1.25/.test(lam.svg),
      'encabezado con las dos referencias y el bloque "LA MATEMÁTICA"');
    console.log(`\n  lámina en _laminas/GCI-banda.svg`);
  }

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, ...res }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1500)); process.exit(1); });
