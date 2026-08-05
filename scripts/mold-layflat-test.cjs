/**
 * GATE DEL LAY-FLAT — L15: arcos y phantom gates (§5.5.4 · §5.5.5).
 * ============================================================================
 * El libro NO da una tabla que checar: da un MÉTODO (cortar esquinas, abatir paredes,
 * arcos desde el gate y desde los phantom) y TRES cifras sobre su contenedor. Así que
 * esto no se "verifica contra el libro": se verifica contra GEOMETRÍA ANALÍTICA, y
 * después se CRUZA con las cifras del libro para ver si coinciden.
 *
 *  A1  CONSERVACIÓN DE ÁREA. Desdoblar es girar cada pared sobre su bisagra: una
 *      ISOMETRÍA. Σ área desdoblada = área base + perímetro·H, EXACTO.
 *  A2  DIMENSIONES EXACTAS. Una caja L×W×H da paredes de L×H y W×H, al micrón.
 *  A3  ISOMETRÍA PUNTO A PUNTO. Dos puntos de la MISMA cara conservan su distancia 3D
 *      al caer al plano. Si esto falla, todo lo que se mida encima es ficción.
 *  A4  L_centerline ANALÍTICA = H + Lb + H (bajar, cruzar el fondo, subir).
 *  A5  L_side_walls ANALÍTICA = W/2 + Lb (labio hasta la esquina + labio de la larga).
 *  A6  CRUCE CON EL LIBRO: A4 y A5 deben dar las cifras de Fig 5.18 (280 y 210 mm).
 *      No se hardcodean: se comparan.
 *  A7  LA EQUIVALENCIA DEL LIBRO. §5.5.4 da DOS formas de decir race-tracking
 *      ("perímetro < línea central" y "60 mm de fondo > la mitad de los 100 de ancho").
 *      Para una caja son la MISMA desigualdad: W + Lb < 2H + Lb ⟺ H > W/2. Se barre H
 *      con bisección y el cruce debe caer en H = W/2 EXACTO, e independiente de Lb.
 *  A8  ÚLTIMO PUNTO EN LLENARSE (uniforme), forma CERRADA: sobre la pared opuesta, el
 *      máximo de min(220+z, √(260²+(60−z)²)) cae en z = 285/7 con L = 1825/7 mm, y está
 *      en el INTERIOR de la pared ⇒ TRAMPA DE GAS (Fig 5.17, "difficult to vent").
 *  A9  EL PAR DEL LIBRO. Con las paredes laterales a 1.5 mm (§5.5.5) el race-tracking
 *      desaparece, el fundido llega al FINAL de las paredes laterales ANTES que al lado
 *      opuesto (la frase literal de V5.5) y el cierre se mueve AL LABIO (venteable).
 *      Números cerrados: perímetro equivalente 50 + 160·(2/1.5) + 50 = 313.33 mm-eq.
 * A10  RESISTENCIA ≠ DISTANCIA (la prueba decisiva de V5.5). Brazo DELGADO cerca vs
 *      GRUESO lejos: la DISTANCIA dice que el último es el lejano; la RESISTENCIA dice
 *      que es el delgado cercano. Con forma cerrada en los DOS modelos del libro.
 * A11  EL CAMPO ES DE DISTANCIA. |∇L_eq| = (h_nom/h)^p en toda cara, salvo en la cresta
 *      (que es justo la línea de soldadura). Invariante que no depende de mi código.
 * A12  CRUCE CON EL MOTOR 3D (`flowlen.ts` + `solidFromMesh`): sobre el cascarón REAL
 *      de 2 mm, la L a la esquina lejana debe dar 210 mm a TRES resoluciones distintas.
 * A13  DIAGNÓSTICO del desacuerdo restante (no se afloja ninguna tolerancia: se
 *      EXPLICA). La L máxima del motor 3D sale inflada porque su espesor local lee de
 *      más en las uniones a 90° y ΔP∝1/H^(1+n) premia el rodeo. Se comprueba la
 *      desigualdad que lo predice.
 * A14  LA LÁMINA. Lo no medido dice SIN CABLEAR — jamás verde por omisión.
 *
 * Uso: node --import tsx scripts/mold-layflat-test.cjs
 */
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);

/** cascarón de contenedor: caja exterior menos caja interior (abierta arriba).
 *  La SUPERFICIE MEDIA de la pared es exactamente la caja del lay-flat. */
function cascaron(o) {
  const P = [], I = [];
  const quad = (a, b, c, d) => { const n = P.length / 3; P.push(...a, ...b, ...c, ...d); I.push(n, n + 1, n + 2, n, n + 2, n + 3); };
  const { W, L, H, t } = o;
  const [ox0, oy0, oz0, ox1, oy1] = [-t / 2, -t / 2, -t / 2, W + t / 2, L + t / 2];
  const [ix0, iy0, iz0, ix1, iy1] = [t / 2, t / 2, t / 2, W - t / 2, L - t / 2];
  quad([ox0, oy0, oz0], [ox1, oy0, oz0], [ox1, oy1, oz0], [ox0, oy1, oz0]);          // fondo exterior
  quad([ox0, oy0, oz0], [ox0, oy1, oz0], [ox0, oy1, H], [ox0, oy0, H]);              // 4 paredes exteriores
  quad([ox1, oy0, oz0], [ox1, oy0, H], [ox1, oy1, H], [ox1, oy1, oz0]);
  quad([ox0, oy0, oz0], [ox0, oy0, H], [ox1, oy0, H], [ox1, oy0, oz0]);
  quad([ox0, oy1, oz0], [ox1, oy1, oz0], [ox1, oy1, H], [ox0, oy1, H]);
  quad([ox0, oy0, H], [ox0, oy1, H], [ix0, iy1, H], [ix0, iy0, H]);                  // labio (anillo)
  quad([ix1, iy0, H], [ix1, iy1, H], [ox1, oy1, H], [ox1, oy0, H]);
  quad([ix0, iy0, H], [ix1, iy0, H], [ox1, oy0, H], [ox0, oy0, H]);
  quad([ix0, iy1, H], [ox0, oy1, H], [ox1, oy1, H], [ix1, iy1, H]);
  quad([ix0, iy0, iz0], [ix0, iy0, H], [ix0, iy1, H], [ix0, iy1, iz0]);              // 4 paredes interiores
  quad([ix1, iy0, iz0], [ix1, iy1, iz0], [ix1, iy1, H], [ix1, iy0, H]);
  quad([ix0, iy0, iz0], [ix1, iy0, iz0], [ix1, iy0, H], [ix0, iy0, H]);
  quad([ix0, iy1, iz0], [ix0, iy1, H], [ix1, iy1, H], [ix1, iy1, iz0]);
  quad([ix0, iy0, iz0], [ix0, iy1, iz0], [ix1, iy1, iz0], [ix1, iy0, iz0]);          // piso interior
  return { positions: Float32Array.from(P), indices: Uint32Array.from(I) };
}

(async () => {
  const LF = await import(R('layflat.ts'));
  const K = LF.LIBRO_CONTENEDOR;
  const W = K.anchoMm, Lb = K.largoMm, H = K.profMm;   // 100 · 160 · 60 (Fig 5.15, LITERAL)

  // ══ A1 · CONSERVACIÓN DE ÁREA EN EL DESDOBLADO ═════════════════════════════
  const lfU = LF.desdoblar(LF.contenedorKazmer());
  const areaTeo = W * Lb + 2 * (W + Lb) * H;
  const errArea = Math.abs(lfU.areaDesdobladaMm2 - areaTeo) / areaTeo * 100;
  check('A1 el desdoblado CONSERVA el área (isometría): Σ desdoblada = W·L + perímetro·H',
    errArea < 1e-9,
    `Σ=${lfU.areaDesdobladaMm2.toFixed(4)} vs analítico ${areaTeo} mm² → error ${errArea.toExponential(2)} % (límite 1 %)`);

  // ══ A2 · DIMENSIONES EXACTAS DE CADA PARED DESDOBLADA ══════════════════════
  const lado = (p, i, j) => Math.hypot(p[i][0] - p[j][0], p[i][1] - p[j][1]);
  let peorDim = 0, detDim = '';
  for (const c of lfU.caras.filter((x) => x.tipo === 'pared')) {
    const esperadoL = c.arista % 2 === 0 ? W : Lb;
    const e1 = Math.abs(lado(c.poly, 0, 1) - esperadoL), e2 = Math.abs(lado(c.poly, 1, 2) - H);
    if (Math.max(e1, e2) > peorDim) { peorDim = Math.max(e1, e2); detDim = `${c.id}: ${lado(c.poly, 0, 1).toFixed(6)}×${lado(c.poly, 1, 2).toFixed(6)} (esperado ${esperadoL}×${H})`; }
  }
  check('A2 cada pared desdoblada mide EXACTAMENTE lo que dice la caja (100×60 y 160×60)',
    peorDim < 1e-9, `peor desviación ${peorDim.toExponential(2)} mm · ${detDim}`);

  // ══ A3 · ISOMETRÍA PUNTO A PUNTO (3D → plano) ══════════════════════════════
  // dos puntos de la MISMA pared: su distancia 3D no puede cambiar al abatir
  let peorIso = 0;
  for (let k = 0; k < 4; k++) {
    const A = lfU.base[k], B = lfU.base[(k + 1) % 4], Lk = Math.hypot(B[0] - A[0], B[1] - A[1]);
    for (let n = 0; n < 40; n++) {
      const s1 = (n * 7 % 100) / 100 * Lk, z1 = (n * 13 % 100) / 100 * H;
      const s2 = (n * 31 % 100) / 100 * Lk, z2 = (n * 17 % 100) / 100 * H;
      const p3 = (s, z) => [A[0] + (B[0] - A[0]) * s / Lk, A[1] + (B[1] - A[1]) * s / Lk, z];
      const q1 = p3(s1, z1), q2 = p3(s2, z2);
      const d3 = Math.hypot(q1[0] - q2[0], q1[1] - q2[1], q1[2] - q2[2]);
      const u1 = lfU.aPlano(q1, 1e-6), u2 = lfU.aPlano(q2, 1e-6);
      if (!u1 || !u2) { peorIso = Infinity; break; }
      const d2 = Math.hypot(u1.uv[0] - u2.uv[0], u1.uv[1] - u2.uv[1]);
      peorIso = Math.max(peorIso, Math.abs(d3 - d2));
    }
  }
  check('A3 el abatido conserva las distancias DENTRO de cada cara (160 pares de puntos)',
    peorIso < 1e-9, `peor |d3D − d2D| = ${peorIso.toExponential(2)} mm`);

  // ══ A4-A6 · LAS DOS COTAS DE Fig 5.18 ══════════════════════════════════════
  const gate = LF.compuertaContenedor(lfU, 0);
  const sU = LF.solverLayFlat(lfU, gate);
  const cotasU = LF.medirCotas(sU, LF.cotasContenedor(lfU, gate));
  const cCen = cotasU.find((c) => c.nombre === 'L_centerline');
  const cLat = cotasU.find((c) => c.nombre === 'L_side_walls');
  const cenTeo = H + Lb + H, latTeo = W / 2 + Lb;
  check('A4 L_centerline = H + L + H ANALÍTICO (bajar la pared, cruzar el fondo, subir la opuesta)',
    cCen.hay && Math.abs(cCen.LgeoMm - cenTeo) < 1e-9,
    `medida ${cCen.LgeoMm.toFixed(6)} vs analítica ${cenTeo} mm → Δ ${Math.abs(cCen.LgeoMm - cenTeo).toExponential(2)}`);
  check('A5 L_side_walls = W/2 + L ANALÍTICO (labio hasta la esquina + labio de la pared larga)',
    cLat.hay && Math.abs(cLat.LgeoMm - latTeo) < 1e-9,
    `medida ${cLat.LgeoMm.toFixed(6)} vs analítica ${latTeo} mm → Δ ${Math.abs(cLat.LgeoMm - latTeo).toExponential(2)}`);
  check('A6 CRUCE CON EL LIBRO: las dos coinciden con Fig 5.18 (280 y 210 mm acotadas)',
    cCen.errVsLibroPct < 1e-6 && cLat.errVsLibroPct < 1e-6,
    `centerline ${cCen.LgeoMm} vs ${K.LcenterlineMm} · side walls ${cLat.LgeoMm} vs ${K.LsideWallsMm} mm (err ${cCen.errVsLibroPct.toExponential(1)} / ${cLat.errVsLibroPct.toExponential(1)} %)`);

  // ══ A7 · LAS DOS FORMAS DE DECIR RACE-TRACKING SON LA MISMA ════════════════
  const verU = LF.veredictoRace(sU, cCen.destino, cCen.caraDestino);
  check('A7a el contenedor del libro TIENE race-tracking por las dos vías, y coinciden',
    verU.race && verU.cotaGeom && verU.coherente,
    `perímetro ${verU.LperimetroMm} < centerline ${verU.LcenterlineMm} mm-eq · H ${verU.profMm} > W/2 ${verU.anchoMm / 2} mm`);
  check('A7b el perímetro al MISMO destino = W + L ANALÍTICO (50+160+50), sin depender de H',
    Math.abs(verU.LperimetroMm - (W + Lb)) < 1e-9,
    `medido ${verU.LperimetroMm.toFixed(6)} vs ${W + Lb} mm`);
  // bisección del cruce en H, para dos largos distintos (debe ser independiente de L)
  const cruceEnH = (largo) => {
    const hay = (h) => {
      const p = LF.contenedorKazmer(); p.base = [[0, 0], [W, 0], [W, largo], [0, largo]]; p.alturaMm = h;
      const l = LF.desdoblar(p), g = LF.compuertaContenedor(l, 0), s = LF.solverLayFlat(l, g);
      const c = LF.cotasContenedor(l, g);
      return LF.veredictoRace(s, c[0].destino, c[0].caraDestino).race;
    };
    let lo = 10, hi = 90;
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (hay(m)) hi = m; else lo = m; }
    return (lo + hi) / 2;
  };
  const h160 = cruceEnH(160), h240 = cruceEnH(240);
  check('A7c el cruce race/no-race cae EXACTO en H = W/2 = 50 mm — la razón literal del libro',
    Math.abs(h160 - W / 2) < 0.01 && Math.abs(h240 - W / 2) < 0.01,
    `bisección: L=160 → H*=${h160.toFixed(4)} · L=240 → H*=${h240.toFixed(4)} mm (analítico ${W / 2}, independiente de L)`);

  // ══ A8 · EL ÚLTIMO PUNTO EN LLENARSE (uniforme) ════════════════════════════
  // forma cerrada: sobre la pared opuesta y en x = W/2, el campo es
  //   min( (H + L + z) ,  √((W/2+L+W/2)² + (H−z)²) )  y su máximo está donde se igualan
  const zTeo = 285 / 7, LTeo = 1825 / 7;
  const campoU = LF.campoLayFlat(sU);
  const zMed = H - campoU.maxDistBordeMm;
  const errL = Math.abs(campoU.maxLeqMm - LTeo) / LTeo * 100;
  check('A8a el último punto en llenarse cae donde dice la forma CERRADA (z = 285/7 mm)',
    Math.abs(zMed - zTeo) < 1.2 * campoU.du && errL < 0.2,
    `z = ${zMed.toFixed(3)} vs ${zTeo.toFixed(3)} mm (rejilla ${campoU.du.toFixed(2)}) · L_eq ${campoU.maxLeqMm.toFixed(3)} vs ${LTeo.toFixed(3)} → ${errL.toFixed(3)} %`);
  check('A8b cierra en el INTERIOR de la pared opuesta al gate ⇒ TRAMPA DE GAS (Fig 5.17)',
    campoU.cierre === 'interior' && lfU.caras[campoU.maxCara].id === 'pared-2' && campoU.maxDistBordeMm > 5,
    `${lfU.caras[campoU.maxCara].id}, ${campoU.maxDistBordeMm.toFixed(1)} mm bajo el labio → "difficult to vent… the trapped air will likely combust"`);
  check('A8c hay LÍNEA DE SOLDADURA detectada (la cresta del campo donde chocan los frentes)',
    campoU.nSoldadura > 0, `${campoU.nSoldadura} celdas de cresta`);
  // §5.5.4 LITERAL: "the flow will emanate from the gate producing a CIRCULAR melt
  // front… an ARC may be drawn from the gate". Dentro de la pared de la compuerta el
  // arco tiene que ser un CÍRCULO EXACTO centrado en el gate — esto verifica el trazo
  // (marching squares), no solo el campo.
  const rArco = 40;
  const segsA = LF.arcos(campoU, rArco);
  const gUV = gate.uv;
  let peorArco = 0, nArco = 0;
  for (const [a, b] of segsA) for (const p of [a, b]) {
    // solo dentro de la pared de la compuerta y lejos de sus orillas (sin recortes)
    if (p[1] < -H + 3 || p[1] > -3 || p[0] < 3 || p[0] > W - 3) continue;
    peorArco = Math.max(peorArco, Math.abs(Math.hypot(p[0] - gUV[0], p[1] - gUV[1]) - rArco)); nArco++;
  }
  check('A8d el arco dibujado ES un círculo exacto centrado en el gate ("a circular melt front", §5.5.4)',
    nArco > 40 && peorArco < campoU.du / 2,
    `${nArco} puntos del arco de r=${rArco} mm · peor desviación del radio ${peorArco.toFixed(4)} mm (media celda = ${(campoU.du / 2).toFixed(3)})`);

  // ══ A9 · EL PAR DEL LIBRO: Fig 5.19 con las paredes laterales a 1.5 mm ═════
  const lfC = LF.desdoblar(LF.contenedorKazmer({ lateralMm: K.paredLateralMm, nombre: 'Fig 5.19 · flow leaders' }));
  const gC = LF.compuertaContenedor(lfC, 0);
  const sC = LF.solverLayFlat(lfC, gC);
  const cotasC = LF.medirCotas(sC, LF.cotasContenedor(lfC, gC));
  const verC = LF.veredictoRace(sC, cotasC[0].destino, cotasC[0].caraDestino);
  const perTeo = W / 2 + Lb * (K.paredNomMm / K.paredLateralMm) + W / 2;
  check('A9a con paredes laterales de 1.5 mm el perímetro equivalente = 50+160·(2/1.5)+50 ANALÍTICO',
    Math.abs(verC.LperimetroMm - perTeo) < 1e-9,
    `medido ${verC.LperimetroMm.toFixed(4)} vs ${perTeo.toFixed(4)} mm-eq`);
  check('A9b el race-tracking DESAPARECE (perímetro 313.3 > centerline 280 mm-eq)',
    !verC.race, `perímetro ${verC.LperimetroMm.toFixed(1)} vs centerline ${verC.LcenterlineMm.toFixed(1)} mm-eq`);
  const finLat = cotasC.find((c) => c.nombre === 'L_side_walls').LeqMm;
  check('A9c LITERAL V5.5: "the melt does reach the end of the side walls BEFORE the melt reaches side of the cavity opposite the gate"',
    finLat < verC.LcenterlineMm,
    `fin de la pared lateral ${finLat.toFixed(1)} mm-eq < lado opuesto ${verC.LcenterlineMm.toFixed(1)} mm-eq`);
  const campoC = LF.campoLayFlat(sC);
  check('A9d el cierre se MUEVE AL LABIO ⇒ venteable en la partición (§8.2.2), ya no es trampa',
    campoC.cierre === 'borde',
    `último punto a ${campoC.maxDistBordeMm.toFixed(2)} mm del labio (antes ${campoU.maxDistBordeMm.toFixed(1)} mm) · L_eq ${campoC.maxLeqMm.toFixed(1)} mm-eq`);
  const rem = LF.remedioFlowLeader(K.paredNomMm, cLat.LgeoMm, cCen.LgeoMm);
  check('A9e el remedio de §5.5.5 sale SOLO de las dos cotas: 2 mm × 210/280 = 1.5 mm (cifra LITERAL)',
    Math.abs(rem.hLibroMm - K.paredLateralMm) < 1e-9 && Math.abs(rem.vFrac - K.vLateralFrac) < 1e-9,
    `h_lat ${rem.hLibroMm} mm [libro ${K.paredLateralMm}] · v_lat ${(rem.vFrac * 100).toFixed(0)} % [libro ${K.vLateralFrac * 100} %] · con Eq 5.22 sería ${rem.hEq522Mm} mm (EXTENSIÓN)`);

  // ══ A10 · RESISTENCIA ≠ DISTANCIA — la prueba decisiva de V5.5 ═════════════
  // Caja 200×100×60, gate en el FONDO a 60 mm de la pared izquierda.
  //   brazo CERCA (pared x=0, 0.8 mm): 60 de fondo + 60 de pared = 120 mm de distancia
  //   brazo LEJOS (pared x=200, 4.0 mm): 140 + 60 = 200 mm de distancia
  const piezaR = {
    nombre: 'brazo delgado CERCA vs grueso LEJOS', base: [[0, 0], [200, 0], [200, 100], [0, 100]],
    alturaMm: 60, espesorNomMm: 2, espesorFondoMm: 2, espesorParedMm: [2, 4.0, 2, 0.8],
  };
  const lfR = LF.desdoblar(piezaR);
  const gR = { nombre: 'gate en el fondo', cara: 0, uv: [60, 50], origen: 'fixture del gate' };
  const filaR = [];
  let okR = true;
  for (const modelo of ['libro-lineal', 'eq5.22']) {
    const sR = LF.solverLayFlat(lfR, gR, { modelo });
    const p = LF.expModelo(modelo);
    const cerca = sR.en([-60, 50], 4), lejos = sR.en([260, 50], 2);
    const aC = 60 + 60 * Math.pow(2 / 0.8, p), aL = 140 + 60 * Math.pow(2 / 4.0, p);
    const eC = Math.abs(cerca.LeqMm - aC), eL = Math.abs(lejos.LeqMm - aL);
    const distDice = cerca.LgeoMm > lejos.LgeoMm ? 'CERCA' : 'LEJOS';
    const resDice = cerca.LeqMm > lejos.LeqMm ? 'CERCA' : 'LEJOS';
    okR = okR && eC < 1e-9 && eL < 1e-9 && distDice === 'LEJOS' && resDice === 'CERCA';
    filaR.push(`[${modelo}] delgado-cerca L=${cerca.LgeoMm.toFixed(0)}mm R=${cerca.LeqMm.toFixed(2)} (cerrada ${aC.toFixed(2)}) | grueso-lejos L=${lejos.LgeoMm.toFixed(0)}mm R=${lejos.LeqMm.toFixed(2)} (cerrada ${aL.toFixed(2)})`);
  }
  check('A10 V5.5 DECISIVO: la DISTANCIA dice que el último es el brazo lejano; la RESISTENCIA dice que es el DELGADO CERCANO (y las dos formas cerradas cuadran)',
    okR, filaR.join('  ·  '));

  // ══ A11 · EL CAMPO ES UN CAMPO DE DISTANCIA: |∇L_eq| = (h_nom/h)^p ═════════
  // (fuera de la cresta, que es exactamente la línea de soldadura)
  const gradErr = (campo, lf, s) => {
    const err = [];
    for (let j = 2; j < campo.nv - 2; j++) for (let i = 2; i < campo.nu - 2; i++) {
      const t = j * campo.nu + i;
      if (campo.cara[t] < 0 || campo.soldadura[t]) continue;
      const E = campo.Leq[t + 1], Wv = campo.Leq[t - 1], N = campo.Leq[t + campo.nu], S = campo.Leq[t - campo.nu];
      if (![E, Wv, N, S].every(Number.isFinite)) continue;
      const g = Math.hypot((E - Wv) / (2 * campo.du), (N - S) / (2 * campo.du));
      const esp = Math.pow(lf.pieza.espesorNomMm / lf.caras[campo.cara[t]].espesorMm, s.p);
      err.push(Math.abs(g - esp) / esp);
    }
    err.sort((a, b) => a - b);
    return { mediana: err[Math.floor(err.length / 2)], p95: err[Math.floor(err.length * 0.95)], n: err.length };
  };
  const gU = gradErr(campoU, lfU, sU), gC2 = gradErr(campoC, lfC, sC);
  check('A11 |∇L_eq| = (h_nom/h)^p fuera de la cresta — el campo ES de distancia (uniforme y con flow leaders)',
    gU.mediana < 0.02 && gC2.mediana < 0.02,
    `uniforme: mediana ${(gU.mediana * 100).toFixed(3)} % (p95 ${(gU.p95 * 100).toFixed(2)} %, n=${gU.n}) · corregido: mediana ${(gC2.mediana * 100).toFixed(3)} % (p95 ${(gC2.p95 * 100).toFixed(2)} %)`);

  // ══ A12 · CRUCE CON EL MOTOR 3D (flowlen.ts sobre el cascarón real) ════════
  const FM = await import(R('flowlen-mesh.ts'));
  const FL3 = await import(R('flowlen.ts'));
  const t = K.paredNomMm;
  const malla = cascaron({ W, L: Lb, H, t });
  const q = FM.solidFromMesh(malla);
  const volTeo = (W + t) * (Lb + t) * (H + t / 2) - (W - t) * (Lb - t) * (H - t / 2);
  const idxDe = (f, c, x, y, z) => f.idx(
    Math.round((x - f.x0) / c - 0.5), Math.round((y - f.y0) / c - 0.5), Math.round((z - f.z0) / c - 0.5));
  const corridas = [];
  for (const cell of [1.4, 1.2, 1.0]) {
    const f = FL3.measureFlowLength({
      x0: -t / 2 - cell, y0: -t / 2 - cell, z0: -t / 2 - cell, x1: W + t / 2 + cell, y1: Lb + t / 2 + cell, z1: H + cell,
      cellMm: cell, inCavity: (x, y, z) => q.inside(x, y, z),
      gateMm: { x: W / 2, y: 0, z: H }, wallMm: t, meltN: LF.N_ABS_MG47, expectVolumeMm3: volTeo,
    });
    // la esquina lejana de la pared lateral, la que Fig 5.18 acota en 210 mm
    const iEsq = idxDe(f, cell, W, Lb, H - cell);
    corridas.push({
      cell, L210: f.flowLenMm[iEsq], Lmax: f.maxFlowLenMm,
      volCc: f.volumeMm3 / 1000, hPlano: f.thicknessMm[idxDe(f, cell, W / 2, Lb, H / 2)],
      hEsquina: f.thicknessMm[idxDe(f, cell, W - t / 4, Lb / 2, 0)],
    });
  }
  const peor210 = Math.max(...corridas.map((c) => Math.abs(c.L210 - latTeo) / latTeo * 100));
  check('A12 el MOTOR 3D de vóxeles reproduce los 210 mm de Fig 5.18 a TRES resoluciones (dos motores independientes + el libro)',
    peor210 < 1,
    corridas.map((c) => `celda ${c.cell}: ${c.L210.toFixed(1)} mm (${((c.L210 - latTeo) / latTeo * 100).toFixed(2)} %)`).join(' · ')
    + ` — lay-flat ${latTeo} mm, libro ${K.LsideWallsMm} mm`);

  // ══ A13 · DIAGNÓSTICO del desacuerdo en L_max (NO se afloja: se EXPLICA) ═══
  // El motor 3D pesa por RESISTENCIA con el ESPESOR LOCAL (esfera inscrita). En la unión
  // a 90° de dos paredes de 2 mm ese espesor lee de MÁS, y como ΔP ∝ 1/H^(1+n), rodear
  // por la esquina sale más barato que ir derecho: la L acumulada se infla. El lay-flat,
  // que corre sobre la superficie media, no tiene ese premio.
  const cRef = corridas.find((c) => c.cell === 1.0);
  const razonRodeo = cRef.Lmax / campoU.maxLgeoMm;
  const premio = Math.pow(cRef.hEsquina / cRef.hPlano, 1 + LF.N_ABS_MG47);
  check('A13a el espesor local del motor 3D lee de MÁS en la unión a 90° (por eso el camino se desvía)',
    cRef.hEsquina > cRef.hPlano * 1.05,
    `esquina ${cRef.hEsquina.toFixed(2)} mm vs pared plana ${cRef.hPlano.toFixed(2)} mm — el mayor círculo inscrito en una L de dos patas de 2 mm mide 2·2√2/(1+√2) = ${(2 * 2 * Math.SQRT2 / (1 + Math.SQRT2)).toFixed(3)} mm, así que > 2 mm es esperable; el motor lee todavía más`);
  check('A13b el rodeo QUEDA EXPLICADO por Eq 5.22: alargarse ×L es rentable si ×L < (h_esq/h_plana)^(1+n)',
    razonRodeo < premio && razonRodeo > 1,
    `el motor se alarga ×${razonRodeo.toFixed(3)} (L_max ${cRef.Lmax.toFixed(0)} vs lay-flat ${campoU.maxLgeoMm.toFixed(0)} mm) y el premio de la esquina es ×${premio.toFixed(3)} ⇒ el rodeo SÍ es más barato para el motor: es el modelo de espesor, no el lay-flat`);
  const c14 = corridas.find((c) => c.cell === 1.4);
  check('A13c la prueba de que la causa es el CONTRASTE de espesor: con celda 1.4 el espesor sale plano y la L_max del motor cae sobre la del lay-flat',
    Math.abs(c14.hEsquina - c14.hPlano) < 1e-6 && Math.abs(c14.Lmax - campoU.maxLgeoMm) / campoU.maxLgeoMm < 0.02,
    `celda 1.4: h esquina = h plana = ${c14.hPlano.toFixed(2)} mm ⇒ L_max ${c14.Lmax.toFixed(2)} vs lay-flat ${campoU.maxLgeoMm.toFixed(2)} mm (${(Math.abs(c14.Lmax - campoU.maxLgeoMm) / campoU.maxLgeoMm * 100).toFixed(2)} %)`);

  // ══ A14 · LA LÁMINA ════════════════════════════════════════════════════════
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });
  const nota = `el L_max del motor sale ${cRef.Lmax.toFixed(0)} mm: su camino rodea por la unión a 90°, donde el espesor local lee ${cRef.hEsquina.toFixed(2)} mm en una pared de ${cRef.hPlano.toFixed(2)} mm y ΔP∝1/H^(1+n) premia el rodeo. Artefacto del espesor local, NO del lay-flat.`;
  const lamSin = LF.laminaLayFlat(sU, { campo: campoU, cotas: cotasU });
  const lamCon = LF.laminaLayFlat(sU, {
    campo: campoU, cotas: cotasU,
    motor3d: { celdaMm: cRef.cell, LsideWallsMm: cRef.L210, LmaxMm: cRef.Lmax, volumenCc: cRef.volCc, nota },
  });
  const lamC = LF.laminaLayFlat(sC, { campo: campoC, cotas: cotasC, nombre: 'contenedor Fig 5.19 · paredes laterales 1.5 mm (BUENO)' });
  fs.writeFileSync(path.join(outDir, 'L15-uniforme.svg'), lamCon.svg);
  fs.writeFileSync(path.join(outDir, 'L15-flowleaders.svg'), lamC.svg);
  check('A14a sin motor 3D la lámina dice SIN CABLEAR (lo no medido NUNCA cuenta como cumplido)',
    lamSin.svg.includes('SIN CABLEAR') && !lamCon.svg.includes('SIN CABLEAR — no se corrió'),
    `sin motor: ${(lamSin.svg.match(/SIN CABLEAR/g) || []).length} avisos · con motor: ${(lamCon.svg.match(/SIN CABLEAR/g) || []).length}`);
  check('A14b la lámina trae las cifras del libro y el veredicto que se puede leer a ojo',
    ['280', '210', 'TRAMPA DE GAS', 'phantom', 'RACE-TRACKING', '1.50 mm'].every((x) => lamCon.svg.includes(x)),
    `L15-uniforme.svg ${(lamCon.svg.length / 1024).toFixed(0)} kB · L15-flowleaders.svg ${(lamC.svg.length / 1024).toFixed(0)} kB`);
  check('A14c la lámina del par CORREGIDO dice venteable, no trampa (es el BUENO de Fig 5.19)',
    lamC.svg.includes('VENTEABLE') && !lamC.svg.includes('TRAMPA DE GAS'),
    `cierre '${campoC.cierre}' a ${campoC.maxDistBordeMm.toFixed(2)} mm del labio`);
  // la cota H > W/2 es geometría PURA: con espesor variable deja de aplicar. Cantarla
  // como contradicción sería un falso rojo — y un falso rojo también es mentir.
  check('A14d con espesor variable la lámina dice que la cota H>W/2 NO APLICA, no que "se contradice"',
    verU.uniforme && !verC.uniforme && lamCon.svg.includes('COINCIDEN') && lamC.svg.includes('NO APLICA') && !lamC.svg.includes('SE CONTRADICEN'),
    `uniforme: coherente=${verU.coherente} · corregido: uniforme=${verC.uniforme}, race=${verC.race}, cotaGeom=${verC.cotaGeom} (la geometría sigue diciendo race; la física ya no)`);

  // ── control: base NO convexa ⇒ el lay-flat AVISA en vez de mentir ──────────
  const lfNC = LF.desdoblar({
    nombre: 'base en L (no convexa)', base: [[0, 0], [100, 0], [100, 60], [50, 60], [50, 120], [0, 120]],
    alturaMm: 40, espesorNomMm: 2,
  });
  check('control: una base NO convexa se DETECTA y se avisa (las paredes desdobladas se solapan)',
    !lfNC.convexa && lfNC.avisos.length > 0, lfNC.avisos[0] || 'sin aviso');

  const fan = LF.phantomGates(sU);
  console.log(`\n  lay-flat ${lfU.areaDesdobladaMm2.toFixed(0)} mm² en ${lfU.caras.length} caras · ${lfU.m} cortes de esquina a ${(lfU.gap[0] * 180 / Math.PI).toFixed(0)}° · `
    + `${fan.length} phantom gates (${fan.filter((g) => g.nEsquinas === 1).length} de 1 esquina, ${fan.filter((g) => g.nEsquinas === 2).length} de 2)`);
  console.log(`  láminas en _laminas/L15-uniforme.svg (Fig 5.17, MALO) y _laminas/L15-flowleaders.svg (Fig 5.19, BUENO)`);

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    errAreaPct: +errArea.toExponential(3), peorDimMm: +peorDim.toExponential(3), peorIsoMm: +peorIso.toExponential(3),
    LcenterlineMm: +cCen.LgeoMm.toFixed(4), LsideWallsMm: +cLat.LgeoMm.toFixed(4),
    libroCenterline: K.LcenterlineMm, libroSideWalls: K.LsideWallsMm,
    raceUniforme: verU.race, raceCorregido: verC.race, cruceHMm: +h160.toFixed(4),
    ultimoZmm: +zMed.toFixed(3), ultimoZteoMm: +zTeo.toFixed(3), ultimoLeqMm: +campoU.maxLeqMm.toFixed(3),
    ultimoLeqTeoMm: +LTeo.toFixed(3), cierreUniforme: campoU.cierre, cierreCorregido: campoC.cierre,
    hFlowLeaderMm: rem.hLibroMm, motor3dL210: corridas.map((c) => +c.L210.toFixed(2)), motor3dErr210Pct: +peor210.toFixed(3),
    motor3dLmaxInflado: +cRef.Lmax.toFixed(1), layflatLmax: +campoU.maxLgeoMm.toFixed(1),
    gradMedianaPct: +(gU.mediana * 100).toFixed(4),
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1200)); process.exit(1); });
