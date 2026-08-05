/**
 * GATE DE LA SECCIÓN (L5) — la máquina de corte y la lámina del sprue.
 *
 * REGLA DE ESTE GATE: **no se verifica contra el libro**. Reproducir un número de
 * Kazmer solo probaría que copié su fórmula. Aquí se verifica contra GEOMETRÍA
 * ANALÍTICA — cantidades que existen sin mi código y que puedo escribir a mano:
 *
 *   A · FIXTURES. Volumen con signo por el teorema de la divergencia: si una malla
 *       de prueba tiene las normales al revés, TODO lo de abajo mide otra cosa.
 *   B · EL CORTE, contra números exactos:
 *       B1 caja por un plano → rectángulo de dimensiones conocidas (error 0)
 *       B2 cilindro por SU EJE con vértices sobre el plano → 2·r·h EXACTO
 *          (el caso degenerado: el plano pasa por vértices y aristas de la malla)
 *       B3 el mismo cilindro girado media faceta → 2·r·cos(π/n)·h EXACTO
 *          (ahora el plano corta ARISTAS: prueba la interpolación)
 *       B4 cilindro cortado FUERA del eje → 2·√(r²−d²)·h por convergencia en n
 *       B5 cono truncado por su eje → trapecio h·(r₀+r₁) EXACTO
 *       B6 esfera a distancia d del centro → π(r²−d²) por convergencia
 *       B7 vaso (sólido NO convexo, con hueco) por su eje → resta de rectángulos
 *       B8 PARTICIÓN: una caja partida en 5 cajas disjuntas da la MISMA área y el
 *          MISMO perímetro visible que la caja entera (las aristas internas mueren)
 *       B9 SIMETRÍA: cortar con normal +X y con −X da la misma área, espejada
 *       B10 INVARIANCIA: mover sólido y plano lo mismo no cambia la sección
 *       B11 malla SIN INDEXAR (estilo STL, vértices duplicados) → misma área
 *   C · EL MOLDE: cotas contra los valores analíticos de §4.2 (insertDims), placas
 *       mutuamente DISJUNTAS medidas por raster, y la contabilidad del stack.
 *   D · LA LÁMINA: lo no medido sale SIN CABLEAR y JAMÁS verde.
 *   E · REUSO L6/L7: mover sólidos y volver a cortar = poses de apertura.
 *
 * Si un check falla se DIAGNOSTICA la causa. Aflojar la tolerancia está prohibido.
 *
 * Uso: node --import tsx scripts/mold-seccion-test.cjs
 */
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const rel = (a, b) => (b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b));

/** volumen con signo (divergencia) — negativo o cero ⇒ normales al revés */
function volumen(m) {
  const P = m.positions, I = m.indices; let v6 = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v6 += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1])
      - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c])
      + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v6 / 6;
}
/** esfera UV con normales SALIENTES.
 *  OJO — así se cazó: con el orden (i,j)(i+1,j)(i+1,j+1) —el que arrastra el fixture
 *  de `mold-visibilidad-test.cjs`— las normales quedan HACIA ADENTRO (volumen con
 *  signo NEGATIVO) y la sección sale con área negativa: −1049.7 en vez de +1055.6.
 *  El área CON SIGNO delata las normales invertidas; por eso B6 se apoya en A4. */
function esfera(r, nu, nv) {
  const P = [], I = [];
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * 2 * Math.PI;
      P.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th));
    }
  }
  const id = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    I.push(id(i, j), id(i + 1, j + 1), id(i + 1, j));
    I.push(id(i, j), id(i, j + 1), id(i + 1, j + 1));
  }
  return { positions: P, indices: I };
}
/** desindexa: cada triángulo con SUS tres vértices (lo que sale de un STL) */
function desindexar(m) {
  const P = [], I = [];
  for (let t = 0; t < m.indices.length; t++) {
    const k = m.indices[t] * 3;
    P.push(m.positions[k], m.positions[k + 1], m.positions[k + 2]);
    I.push(t);
  }
  return { positions: P, indices: I };
}
/** ¿el punto cae dentro de la pieza seccionada? (par-impar sobre todos sus lazos) */
function dentroPieza(p, x, y) {
  let c = false;
  for (const L of p.lazos) for (let i = 0, j = L.pts.length - 1; i < L.pts.length; j = i++) {
    const a = L.pts[i], b = L.pts[j];
    if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) c = !c;
  }
  return c;
}

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const S = await import(R('lamina-seccion.ts'));
  const uno = (malla, rol = 'placa') => [{ id: 's', nombre: 's', rol, malla }];
  const cortar = (malla, p0, n) => S.seccionarPorPlano(uno(malla), { p0, n }).piezas[0];

  // ══ A · FIXTURES: las mallas de prueba son sólidas y con normales SALIENTES ══
  const CAJA = S.mallaCaja(0, 0, 0, 40, 20, 10);
  check('A1 mallaCaja: volumen con signo = w·d·h (normales salientes)',
    rel(volumen(CAJA), 40 * 20 * 10) < 1e-12, `V=${volumen(CAJA)} vs 8000`);
  const NC = 64, RC = 10, HC = 30;
  const CIL = S.mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: HC, r: RC, n: NC });
  const volPrisma = (n, r, h) => (n / 2) * r * r * Math.sin((2 * Math.PI) / n) * h;
  check('A2 mallaCilindro: volumen = (n/2)·r²·sin(2π/n)·h (prisma inscrito, exacto)',
    rel(volumen(CIL), volPrisma(NC, RC, HC)) < 1e-12,
    `V=${volumen(CIL).toFixed(6)} vs ${volPrisma(NC, RC, HC).toFixed(6)}`);
  const VASO = S.mallaVaso({ cx: 0, cy: 0, z0: 0, z1: 60, rExt: 50, pared: 3, n: 64 });
  const volVaso = volPrisma(64, 50, 60) - volPrisma(64, 47, 57);
  check('A3 mallaVaso: volumen = prisma(ext) − prisma(int) (sólido hueco válido)',
    rel(volumen(VASO), volVaso) < 1e-12, `V=${volumen(VASO).toFixed(4)} vs ${volVaso.toFixed(4)}`);
  // A4 · el fixture de la esfera TAMBIÉN se verifica: si sus normales miran hacia
  // adentro, B6 mediría un área negativa y el error saldría del 200 % (pasó).
  const ESF = esfera(20, 48, 24), vEsf = volumen(ESF);
  check('A4 esfera: volumen POSITIVO ≈ 4/3·π·r³ (normales salientes — el fixture también se verifica)',
    vEsf > 0 && rel(vEsf, (4 / 3) * Math.PI * 8000) < 0.01,
    `V=${vEsf.toFixed(1)} vs ${((4 / 3) * Math.PI * 8000).toFixed(1)} (poliedro inscrito, un poco menor)`);

  // ══ B · EL CORTE contra geometría analítica ══
  // B1 · caja → rectángulo de dimensiones conocidas
  const b1 = cortar(CAJA, [5, 0, 0], [1, 0, 0]);
  const okB1 = b1.areaMm2 === 200 && b1.lazos.length === 1 && b1.abiertas === 0
    && b1.bbox.u0 === 0 && b1.bbox.u1 === 20 && b1.bbox.v0 === 0 && b1.bbox.v1 === 10;
  check('B1 caja por un plano = rectángulo 20×10 EXACTO (área y bbox, error 0)',
    okB1, `área=${b1.areaMm2} bbox=${b1.bbox.u0}..${b1.bbox.u1} × ${b1.bbox.v0}..${b1.bbox.v1} lazos=${b1.lazos.length}`);

  // B2 · cilindro por SU EJE con vértices EN el plano (caso degenerado)
  const b2 = cortar(CIL, [0, 0, 0], [1, 0, 0]);
  check('B2 cilindro cortado por SU EJE (vértices sobre el plano) = 2·r·h EXACTO',
    rel(b2.areaMm2, 2 * RC * HC) < 1e-12 && b2.lazos.length === 1 && b2.abiertas === 0,
    `área=${b2.areaMm2.toFixed(9)} vs ${(2 * RC * HC).toFixed(1)} · lazos=${b2.lazos.length} abiertas=${b2.abiertas}`);

  // B3 · el mismo cilindro girado MEDIA FACETA: ahora el plano corta ARISTAS y el
  //      valor exacto es la cuerda del polígono inscrito, 2·r·cos(π/n)
  const CILF = S.mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: HC, r: RC, n: NC, fase: Math.PI / NC });
  const b3 = cortar(CILF, [0, 0, 0], [1, 0, 0]);
  const teo3 = 2 * RC * Math.cos(Math.PI / NC) * HC;
  check('B3 cilindro girado ½ faceta = 2·r·cos(π/n)·h EXACTO (interpolación en la arista)',
    rel(b3.areaMm2, teo3) < 1e-12, `área=${b3.areaMm2.toFixed(9)} vs ${teo3.toFixed(9)}`);

  // B4 · fuera del eje: converge a 2·√(r²−d²)·h
  const dOff = 6, teo4 = 2 * Math.sqrt(RC * RC - dOff * dOff) * HC;
  const errs = [16, 64, 256].map((n) => {
    const c = cortar(S.mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: HC, r: RC, n }), [dOff, 0, 0], [1, 0, 0]);
    return Math.abs(c.areaMm2 - teo4) / teo4;
  });
  check('B4 cilindro cortado a d del eje → 2·√(r²−d²)·h por CONVERGENCIA en facetas',
    errs[0] > errs[1] && errs[1] > errs[2] && errs[2] < 2e-4,
    `err n=16 ${(errs[0] * 100).toFixed(3)}% → n=64 ${(errs[1] * 100).toFixed(4)}% → n=256 ${(errs[2] * 100).toFixed(5)}% (teórico ${teo4.toFixed(2)} mm²)`);

  // B5 · cono truncado por su eje = trapecio h·(r0+r1)
  const CONO = S.mallaCilindro({ eje: 'z', c1: 0, c2: 0, a0: 0, a1: 40, r: 12, r1: 4, n: 48 });
  const b5 = cortar(CONO, [0, 0, 0], [1, 0, 0]);
  check('B5 cono truncado por su eje = trapecio h·(r₀+r₁) EXACTO',
    rel(b5.areaMm2, 40 * (12 + 4)) < 1e-12, `área=${b5.areaMm2.toFixed(9)} vs ${40 * 16}`);

  // B6 · esfera a distancia d del centro → π(r²−d²)
  const rE = 20, dE = 8, teo6 = Math.PI * (rE * rE - dE * dE);
  const errE = [12, 48, 192].map((n) => {
    const c = cortar(esfera(rE, n, Math.max(6, n / 2)), [dE, 0, 0], [1, 0, 0]);
    return Math.abs(c.areaMm2 - teo6) / teo6;
  });
  check('B6 esfera cortada a d del centro → π(r²−d²) por CONVERGENCIA',
    errE[0] > errE[1] && errE[1] > errE[2] && errE[2] < 1e-3,
    `err ${(errE[0] * 100).toFixed(2)}% → ${(errE[1] * 100).toFixed(3)}% → ${(errE[2] * 100).toFixed(4)}% (teórico ${teo6.toFixed(2)} mm²)`);

  // B7 · sólido NO convexo con hueco: el vaso por su eje = resta de rectángulos
  const b7 = cortar(VASO, [0, 0, 0], [1, 0, 0]);
  const teo7 = 2 * 50 * 60 - 2 * 47 * 57;
  check('B7 vaso (no convexo) por su eje = 2·rExt·h − 2·rInt·h_int EXACTO, en UN lazo',
    rel(b7.areaMm2, teo7) < 1e-12 && b7.lazos.length === 1,
    `área=${b7.areaMm2.toFixed(9)} vs ${teo7} · lazos=${b7.lazos.length} (la ∩ es un solo contorno)`);

  // B8 · PARTICIÓN: la misma caja partida en 5 cajas disjuntas
  const trozos = S.unirMallas([
    S.mallaCaja(0, 0, 0, 40, 20, 4), S.mallaCaja(0, 0, 4, 10, 20, 10),
    S.mallaCaja(10, 0, 4, 20, 5, 10), S.mallaCaja(10, 5, 4, 20, 20, 10),
    S.mallaCaja(20, 0, 4, 40, 20, 10),
  ]);
  const b8 = cortar(trozos, [15, 0, 0], [1, 0, 0]);
  const per = (p) => p.bordes.reduce((a, b) => a + Math.hypot(b[2] - b[0], b[3] - b[1]), 0);
  check('B8 caja PARTIDA en 5 cajas disjuntas: Σ áreas = área de la caja entera',
    b8.areaMm2 === b1.areaMm2, `partida=${b8.areaMm2} vs entera=${b1.areaMm2}`);
  check('B8b y el BORDE VISIBLE es el de la caja entera (las aristas internas mueren)',
    Math.abs(per(b8) - per(b1)) < 1e-9 && Math.abs(per(b8) - 2 * (20 + 10)) < 1e-9,
    `perímetro partida=${per(b8).toFixed(6)} entera=${per(b1).toFixed(6)} analítico=${2 * (20 + 10)}`);

  // B9 · SIMETRÍA: la normal opuesta da la misma área, espejada
  const b9 = cortar(trozos, [15, 0, 0], [-1, 0, 0]);
  check('B9 SIMETRÍA: cortar con normal +X y con −X da la misma área (contorno espejado)',
    Math.abs(b9.areaMm2 - b8.areaMm2) < 1e-9 && Math.abs((-b9.bbox.u1) - b8.bbox.u0) < 1e-9,
    `+X ${b8.areaMm2} (u ${b8.bbox.u0}..${b8.bbox.u1}) · −X ${b9.areaMm2} (u ${b9.bbox.u0}..${b9.bbox.u1})`);

  // B10 · INVARIANCIA: mover sólido y plano lo mismo no cambia nada
  const b10 = S.seccionarPorPlano([{ id: 's', nombre: 's', rol: 'placa', malla: CAJA, mover: [7, 0, 0] }], { p0: [12, 0, 0], n: [1, 0, 0] }).piezas[0];
  check('B10 mover sólido y plano 7 mm da la MISMA sección (y `mover` es lo que usará L6)',
    b10.areaMm2 === b1.areaMm2 && b10.bbox.u1 === b1.bbox.u1,
    `área=${b10.areaMm2} bbox=${b10.bbox.u0}..${b10.bbox.u1}`);

  // B11 · malla sin indexar (STL): el soldado la cierra
  const b11 = cortar(desindexar(CIL), [0, 0, 0], [1, 0, 0]);
  check('B11 malla SIN INDEXAR (vértices duplicados, estilo STL): misma área tras soldar',
    rel(b11.areaMm2, 2 * RC * HC) < 1e-12 && b11.abiertas === 0,
    `área=${b11.areaMm2.toFixed(9)} vs ${2 * RC * HC} · abiertas=${b11.abiertas}`);

  // B12 · el plano que NO toca el sólido no inventa sección
  const b12 = cortar(CAJA, [999, 0, 0], [1, 0, 0]);
  check('B12 plano que no toca el sólido: sección VACÍA y distancia reportada',
    b12.vacio && b12.areaMm2 === 0 && Math.abs(b12.distanciaMm - 959) < 1e-9,
    `vacio=${b12.vacio} área=${b12.areaMm2} distancia=${b12.distanciaMm}`);

  // ══ C · EL MOLDE ══
  const { moldMachine } = await import(R('moldmachine.ts'));
  const { packageToAssemblySpec } = await import(R('mold-plano-set.ts'));
  const DS = await import(R('mold-drawing-set.ts'));
  const CASOS = [
    { id: 'vaso', spec: { name: 'vaso Kazmer', Lmm: 100, Wmm: 100, Hmm: 60, cavityShape: 'round', surfaceMm2: 30000, volumeMm3: 60000, wallMm: 3, plastic: 'ABS', annualVolume: 200000, totalVolume: 1000000, cavPref: 1 } },
    { id: 'bezel', spec: { name: 'bezel', Lmm: 168, Wmm: 120, Hmm: 13, surfaceMm2: 22000, volumeMm3: 40000, wallMm: 1.5, plastic: 'ABS', annualVolume: 500000, totalVolume: 2000000, cavPref: 1 } },
  ];
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });
  const resumen = {};
  for (const caso of CASOS) {
    const pkg = moldMachine(caso.spec);
    const asm = packageToAssemblySpec(pkg);
    const lam = S.laminaSeccionSprue({ spec: asm, expulsion: { fEjectN: pkg.diseno.expulsion.vector.fEjectN, aEffM2: pkg.diseno.expulsion.aEffM2 } });
    const { seccion: sec, meta, medidas: med } = lam;
    const idm = DS.insertDims(asm), D = DS.plateDepth(asm);
    const P = (id) => sec.piezas.find((p) => p.id === id);
    console.log(`\n  ── ${caso.id.toUpperCase()} · base ${asm.widthMm}×${D} · ⌀agua ${asm.cooling.diaMm} · ${sec.piezas.filter((p) => !p.vacio).length} componentes cortados ──`);

    // C1 · ninguna malla del molde deja cadenas abiertas
    const abiertas = sec.piezas.reduce((a, p) => a + p.abiertas, 0);
    check(`C1[${caso.id}] cero lazos ABIERTOS en los ${sec.piezas.length} sólidos del molde`,
      abiertas === 0, `abiertas=${abiertas} (una cadena abierta = malla rota o mal soldada)`);

    // C2 · el stack de la sección == el stack del spec (alto y ancho)
    const altoStack = DS.moldStackHeight(asm);
    check(`C2[${caso.id}] el alto de la sección = altura del stack y el ancho = fondo de placa`,
      Math.abs((sec.bbox.v1 - sec.bbox.v0) - altoStack) < 1e-9 && Math.abs((sec.bbox.u1 - sec.bbox.u0) - D) < 1e-9,
      `alto ${(sec.bbox.v1 - sec.bbox.v0).toFixed(3)} vs ${altoStack} · ancho ${(sec.bbox.u1 - sec.bbox.u0).toFixed(3)} vs ${D}`);

    // C3 · la placa A con su ASIENTO restado, contra el número analítico
    const tA = DS.plateDefs(asm).find((d) => d.role === 'A').thick;
    const teoA = D * tA - (idm.ify + 1) * idm.Hc;
    check(`C3[${caso.id}] área de la placa A = D·tA − asiento (la bolsa SÍ se resta)`,
      rel(P('p-A').areaMm2, teoA) < 1e-9, `${P('p-A').areaMm2.toFixed(4)} vs ${teoA.toFixed(4)} mm²`);

    // C4 · el moldeo: cáscara analítica
    const teoMol = idm.round
      ? idm.fx * idm.dep - (idm.fx - 2 * idm.wall) * (idm.dep - idm.wall)
      : idm.fy * idm.dep - (idm.fy - 2 * idm.wall) * (idm.dep - idm.wall);
    check(`C4[${caso.id}] área del MOLDEO = huella·prof − hueco (cáscara, analítico)`,
      rel(P('moldeo').areaMm2, teoMol) < 1e-9, `${P('moldeo').areaMm2.toFixed(4)} vs ${teoMol.toFixed(4)} mm²`);

    // C5 · las COTAS salen de la sección y coinciden con §4.2 (insertDims)
    const d = med.datos;
    check(`C5[${caso.id}] las cotas MEDIDAS en la sección = las de §4.2 (insertDims)`,
      Math.abs(d.cheekMm - idm.border) < 1e-9 && Math.abs(d.hCavidadMm - idm.dep) < 1e-9
      && Math.abs(d.hInsertoA - (idm.Hc - idm.dep)) < 1e-9 && Math.abs(d.hInsertoB - idm.Hk) < 1e-9,
      `cheek ${d.cheekMm}/${idm.border} · H_cav ${d.hCavidadMm}/${idm.dep} · H_insA ${d.hInsertoA}/${idm.Hc - idm.dep} · H_insB ${d.hInsertoB}/${idm.Hk}`);

    // C6 · PLACAS mutuamente disjuntas (raster): si dos placas se encimaran, la
    //      suma de áreas no sería el área de la unión — y "Σ piezas = ensamble"
    //      dejaría de valer.
    const placas = sec.piezas.filter((p) => p.rol === 'placa' && !p.vacio);
    const insertos = sec.piezas.filter((p) => p.rol === 'inserto' && !p.vacio);
    const N = 700, du = (sec.bbox.u1 - sec.bbox.u0) / N, dv = (sec.bbox.v1 - sec.bbox.v0) / N;
    let cUnion = 0, cSum = 0, cCruce = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = sec.bbox.u0 + (i + 0.5) * du, y = sec.bbox.v0 + (j + 0.5) * dv;
      let nP = 0; for (const p of placas) if (dentroPieza(p, x, y)) nP++;
      let nI = 0; for (const p of insertos) if (dentroPieza(p, x, y)) nI++;
      cSum += nP; if (nP > 0) cUnion++;
      if (nP > 0 && nI > 0) cCruce++;
    }
    const areaCel = du * dv;
    check(`C6[${caso.id}] las 8 placas NO se traslapan (Σ áreas = área de la unión, raster ${N}²)`,
      Math.abs(cSum - cUnion) * areaCel < 1, `traslape medido ${(Math.abs(cSum - cUnion) * areaCel).toFixed(3)} mm²`);
    check(`C6b[${caso.id}] ninguna placa invade a un inserto (el asiento está bien restado)`,
      cCruce * areaCel < 1, `intersección placa∩inserto ${(cCruce * areaCel).toFixed(3)} mm²`);

    // C7 · el par del libro sobre QUIÉN MANDA en la mejilla (§4.2.2)
    const manda = d.cheekManda;
    const esperado = idm.dep > 3 * asm.cooling.diaMm ? 'estructural' : 'enfriamiento';
    check(`C7[${caso.id}] la mejilla declara quién manda: ${manda}`,
      String(manda).startsWith(esperado),
      `H_cavity ${d.hCavidadMm} vs 3⌀ ${(3 * asm.cooling.diaMm).toFixed(2)} → ${esperado}`);

    // C8 · lo no medido NO cuenta
    const sinCablear = med.veredictos.filter((v) => v.estado === 'SIN CABLEAR');
    check(`C8[${caso.id}] hay veredictos SIN CABLEAR y NINGUNO cuenta como CUMPLE`,
      sinCablear.length > 0 && sinCablear.every((v) => v.estado !== 'CUMPLE')
      && med.veredictos.every((v) => v.estado !== 'CUMPLE' || (v.medido && v.medido.length > 3)),
      `${sinCablear.length} sin cablear: ${sinCablear.map((v) => v.id).join(', ')}`);

    // C9 · V12.18 se mide sobre lo DIBUJADO, no sobre la intención
    const v18 = med.veredictos.find((v) => v.id === 'V12.18');
    if (v18.estado !== 'SIN CABLEAR') {
      check(`C9[${caso.id}] V12.18 medido en el dibujo: ⌀cabeza = 1.5·d y alto = d`,
        Math.abs(d.tornCabezaDia / d.tornVastagoDia - 1.5) < 1e-9 && Math.abs(d.tornCabezaAlto / d.tornVastagoDia - 1) < 1e-9,
        `⌀ ${d.tornCabezaDia}/${d.tornVastagoDia} = ${(d.tornCabezaDia / d.tornVastagoDia).toFixed(6)} · alto ${d.tornCabezaAlto}`);
    } else {
      check(`C9[${caso.id}] V12.18 sin tornillo en el plano → SIN CABLEAR (no se finge)`, true, v18.porque.slice(0, 60));
    }

    // C10 · la sección corta la impresión y las líneas de agua (si no, no es L5)
    check(`C10[${caso.id}] el plano del sprue corta ${meta.nCavCortadas} impresión(es) y ${meta.lineasAgua.length} línea(s) de agua`,
      meta.nCavCortadas >= 1 && meta.lineasAgua.length >= 2,
      `impresiones=${meta.nCavCortadas} agua=${meta.lineasAgua.length} · H_min=${d.aguaHminMm} mm = ${d.aguaHenD}⌀`);

    // C11 · SIMETRÍA del molde: la normal opuesta da la misma área total
    const otro = S.solidosDeMolde(asm, {});
    const espejo = S.seccionarPorPlano(otro.solidos, { p0: otro.plano.p0, n: [-otro.plano.n[0], -otro.plano.n[1], -otro.plano.n[2]] });
    check(`C11[${caso.id}] cortar el molde con la normal OPUESTA da la misma área total`,
      rel(espejo.areaTotalMm2, sec.areaTotalMm2) < 1e-9,
      `${espejo.areaTotalMm2.toFixed(4)} vs ${sec.areaTotalMm2.toFixed(4)} mm²`);

    // C12 · REUSO L6: abrir el molde 40 mm mueve las piezas de la mitad móvil sin
    //       cambiar su sección (misma área, bbox desplazada EXACTAMENTE 40 mm)
    const MOV = ['p-bottom', 'p-riel', 'p-ejector', 'p-ejector-ret', 'p-support', 'p-B', 'i-core', 'pines'];
    const abierto = S.seccionarPorPlano(
      otro.solidos.map((s) => (MOV.includes(s.id) ? { ...s, mover: [0, 0, -40] } : s)), otro.plano);
    const okL6 = MOV.every((id) => {
      const a = sec.piezas.find((p) => p.id === id), b = abierto.piezas.find((p) => p.id === id);
      return a && b && rel(b.areaMm2, a.areaMm2) < 1e-9 && Math.abs((a.bbox.v0 - 40) - b.bbox.v0) < 1e-9;
    });
    check(`C12[${caso.id}] REUSO L6: abrir 40 mm mueve la mitad móvil y conserva su sección`,
      okL6 && rel(abierto.areaTotalMm2, sec.areaTotalMm2) < 1e-9,
      `${MOV.length} sólidos movidos · área total ${abierto.areaTotalMm2.toFixed(2)} vs ${sec.areaTotalMm2.toFixed(2)}`);

    // ── LA LÁMINA ──
    const svg = lam.svg;
    const nPatrones = (svg.match(/<pattern /g) || []).length;
    const noSolidos = sec.piezas.filter((p) => !p.vacio && !['moldeo', 'agua', 'colada'].includes(p.rol)).length;
    check(`C13[${caso.id}] achurado PROPIO por componente (Fig 1.6): ${nPatrones} patrones para ${noSolidos} componentes`,
      nPatrones === sec.piezas.length - sec.piezas.filter((p) => ['moldeo', 'agua', 'colada'].includes(p.rol)).length,
      `patrones=${nPatrones} · macizos (secciones delgadas)=${sec.piezas.filter((p) => ['moldeo', 'agua', 'colada'].includes(p.rol)).length}`);
    check(`C14[${caso.id}] la lámina DECLARA lo que no midió y sus extensiones`,
      /SIN CABLEAR/.test(svg) && /EXTENSIONES DECLARADAS/.test(svg) && meta.extensiones.length > 0,
      `${meta.extensiones.length} extensión(es) declarada(s)`);
    check(`C15[${caso.id}] el SVG cierra bien y trae las cotas dibujadas`,
      svg.startsWith('<svg') && svg.trim().endsWith('</svg>') && med.cotas.length >= 4,
      `${(svg.length / 1024).toFixed(0)} kB · ${med.cotas.length} cotas · ${med.veredictos.length} veredictos`);

    fs.writeFileSync(path.join(outDir, `L5-${caso.id}.svg`), svg);
    resumen[caso.id] = {
      area: +sec.areaTotalMm2.toFixed(1),
      cheek: d.cheekMm, hCav: d.hCavidadMm, hInsA: d.hInsertoA, hInsB: d.hInsertoB,
      aguaEnD: d.aguaHenD, manda: d.cheekManda,
      veredictos: Object.fromEntries(med.veredictos.map((v) => [v.id, v.estado])),
    };
    for (const v of med.veredictos) console.log(`     [${v.estado.padEnd(11)}] ${v.id.padEnd(18)} ${(v.medido ?? '').slice(0, 52)}`);
  }

  // ── D · la lámina con la MALLA REAL de una pieza (el camino del cliente) ──
  const pkgV = moldMachine(CASOS[0].spec);
  const asmV = packageToAssemblySpec(pkgV);
  const idmV = DS.insertDims(asmV);
  const mallaCliente = S.mallaVaso({ cx: 0, cy: 0, z0: 0, z1: idmV.dep, rExt: idmV.fx / 2, pared: idmV.wall, n: 96 });
  const lamMalla = S.laminaSeccionSprue({ spec: asmV, mallaPieza: mallaCliente });
  const molMalla = lamMalla.seccion.piezas.find((p) => p.id === 'moldeo');
  const teoMalla = idmV.fx * idmV.dep - (idmV.fx - 2 * idmV.wall) * (idmV.dep - idmV.wall);
  check('D1 la lámina acepta la MALLA REAL del cliente y la corta igual que la nominal',
    rel(molMalla.areaMm2, teoMalla) < 1e-9 && molMalla.abiertas === 0,
    `área del moldeo ${molMalla.areaMm2.toFixed(4)} vs ${teoMalla.toFixed(4)} mm² · abiertas ${molMalla.abiertas}`);
  fs.writeFileSync(path.join(outDir, 'L5-vaso-mallareal.svg'), lamMalla.svg);

  console.log(`\n  láminas en _laminas/L5-vaso.svg · _laminas/L5-bezel.svg · _laminas/L5-vaso-mallareal.svg`);
  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, ...resumen }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1200)); process.exit(1); });
