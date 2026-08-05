/**
 * GATE DE LA LÁMINA L6 — SECUENCIA DE APERTURA Y EXPULSIÓN.
 *
 * ⚠ NOMBRE: `scripts/mold-apertura-test.cjs` YA EXISTE y ya está cableado en
 * `forja-gate.cjs` (es el gate de la CARRERA de apertura y el daylight, §6.3.2 +
 * Tabla 6.1). Este es OTRO gate: el de la LÁMINA L6 (`src/forja/mold/lamina-apertura.ts`).
 *
 * REGLA DE ESTE GATE (la misma de `mold-seccion-test.cjs`): **no se verifica contra el
 * libro**. Reproducir un número de Kazmer solo probaría que copié su fórmula. Aquí se
 * verifica contra CINEMÁTICA Y GEOMETRÍA ANALÍTICA — cantidades que existen sin este
 * código y que se pueden escribir a mano:
 *
 *   A · FIXTURES nuevos (prisma y cono de eje libre) por volumen con signo y por
 *       secciones de valor EXACTO.
 *   B · EL MOTOR DE POLÍGONOS: intersección exacta y distancia mínima contra áreas
 *       analíticas (incluido el caso venenoso: dos cuerpos que COMPARTEN UNA ARISTA
 *       deben dar intersección 0 y distancia 0 — es el contacto del bloque de talón).
 *   C · LA CINEMÁTICA: t·n = 0, área conservada (cuerpo rígido), desplazamiento medido
 *       = comandado, monotonía, la ley d·tan φ de la corredera, la carrera en FORMA
 *       CERRADA (H_pieza + colada) y el ATAJO de traslación = el recorte completo de L5.
 *   D · INTERFERENCIA con CONTROL POSITIVO y NEGATIVO: un choque construido a propósito
 *       tiene que ser detectado, con su ÁREA y su recorrido de arranque en forma cerrada;
 *       y el mismo caso con holgura no puede dar falso positivo.
 *   E · EL TUNNEL GATE medido sobre lo DIBUJADO (45° / taper / 3⌀), no sobre la intención.
 *   F · CONTABILIDAD contra L5: lo que L6 talla se descuenta EXACTO del área de L5.
 *   G · LA LÁMINA: lo no medido sale SIN CABLEAR, y nada se sale del encuadre.
 *
 * Si un check falla se DIAGNOSTICA la causa. Aflojar la tolerancia está prohibido.
 *
 * Uso: node --import tsx scripts/mold-apertura-l6-test.cjs
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
const areaPoly = (pts) => {
  let A = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A += p[0] * q[1] - q[0] * p[1]; }
  return A / 2;
};
const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const S = await import(R('lamina-seccion.ts'));
  const A = await import(R('lamina-apertura.ts'));
  const { moldMachine } = await import(R('moldmachine.ts'));
  const { packageToAssemblySpec, plateStackZ } = await import(R('mold-plano-set.ts'));
  const DS = await import(R('mold-drawing-set.ts'));
  const TP = await import(R('threeplate.ts'));

  // ══ A · FIXTURES NUEVOS ═══════════════════════════════════════════════════
  const plano = { p0: [148, 0, 0], n: [1, 0, 0], arriba: [0, 0, 1] };
  const base = S.baseDelPlano(plano);
  const orig = [base.w[0] * 148, base.w[1] * 148, base.w[2] * 148];
  check('A0 la base del plano es ORTONORMAL y derecha (u×v = w) — de esto cuelga todo lo demás',
    Math.abs(base.u[1] - 1) < 1e-15 && Math.abs(base.v[2] - 1) < 1e-15 && Math.abs(base.w[0] - 1) < 1e-15,
    `u=[${base.u}] v=[${base.v}] w=[${base.w}]`);

  const trap = [[193, 160], [214.2, 160], [205.1, 185], [193, 185]];
  const aTrap = areaPoly(trap);
  const PR = A.mallaPrisma(trap, -26, 26, base, orig);
  check('A1 mallaPrisma: volumen con signo = área(polígono)·(w1−w0), normales SALIENTES',
    volumen(PR) > 0 && rel(volumen(PR), aTrap * 52) < 1e-12, `V=${volumen(PR).toFixed(6)} vs ${(aTrap * 52).toFixed(6)}`);
  const PRh = A.mallaPrisma(trap.slice().reverse(), -26, 26, base, orig);
  check('A2 mallaPrisma con el polígono en sentido HORARIO: se normaliza y da el MISMO sólido',
    rel(volumen(PRh), volumen(PR)) < 1e-12, `V(horario)=${volumen(PRh).toFixed(6)} vs V(CCW)=${volumen(PR).toFixed(6)}`);
  const secPR = S.seccionarPorPlano([{ id: 's', nombre: 's', rol: 'placa', malla: PR }], plano).piezas[0];
  check('A3 la sección del prisma por su plano = EL POLÍGONO (área exacta, un lazo, cero abiertas)',
    rel(secPR.areaMm2, aTrap) < 1e-12 && secPR.lazos.length === 1 && secPR.abiertas === 0,
    `área=${secPR.areaMm2.toFixed(9)} vs ${aTrap} · lazos=${secPR.lazos.length}`);

  const NC = 48, r0 = 3, r1 = 7, Lax = 40;
  const p0c = [148, 100, 100];
  const p1c = [148, 100 + Lax / Math.SQRT2, 100 + Lax / Math.SQRT2];
  const CN = A.mallaConoEje(p0c, p1c, r0, r1, NC);
  const volCono = (NC / 2) * Math.sin((2 * Math.PI) / NC) * Lax * (r0 * r0 + r0 * r1 + r1 * r1) / 3;
  check('A4 mallaConoEje (eje a 45°): volumen = (n/2)·sin(2π/n)·L·(r₀²+r₀r₁+r₁²)/3 (tronco poligonal, exacto)',
    volumen(CN) > 0 && rel(volumen(CN), volCono) < 1e-12, `V=${volumen(CN).toFixed(6)} vs ${volCono.toFixed(6)}`);
  const secCN = S.seccionarPorPlano([{ id: 'c', nombre: 'c', rol: 'colada', malla: CN }], plano).piezas[0];
  check('A5 cono INCLINADO cortado por un plano que CONTIENE su eje = trapecio L·(r₀+r₁) EXACTO',
    rel(secCN.areaMm2, Lax * (r0 + r1)) < 1e-12 && secCN.abiertas === 0,
    `área=${secCN.areaMm2.toFixed(9)} vs ${(Lax * (r0 + r1)).toFixed(6)}`);

  const cilA = S.mallaCilindro({ eje: 'x', c1: 0, c2: 20, a0: 0, a1: 50, r: 4, n: 24 });
  const cilB = S.mallaCilindro({ eje: 'x', c1: 0, c2: -20, a0: 0, a1: 50, r: 4, n: 24 });
  const par0 = A.partirMallaPorZ(S.unirMallas([cilA, cilB]), 0);
  check('A6 partirMallaPorZ: cero triángulos cruzan y cada mitad conserva su volumen',
    par0.cruzan === 0 && rel(volumen(par0.arriba), volumen(cilA)) < 1e-12 && rel(volumen(par0.abajo), volumen(cilB)) < 1e-12,
    `cruzan=${par0.cruzan} · arriba ${volumen(par0.arriba).toFixed(3)} vs ${volumen(cilA).toFixed(3)}`);

  // ══ B · EL MOTOR DE POLÍGONOS ═════════════════════════════════════════════
  const I2 = (a, b) => A.interseccionPoligonos(a, b);
  check('B1 dos rectángulos solapados: área de intersección = 4×6 EXACTA',
    rel(I2([rect(0, 0, 10, 10)], [rect(6, 4, 20, 20)]).areaMm2, 24) < 1e-12,
    `${I2([rect(0, 0, 10, 10)], [rect(6, 4, 20, 20)]).areaMm2.toFixed(12)} vs 24`);
  check('B2 rectángulo CONTENIDO: la intersección es el chico entero',
    rel(I2([rect(0, 0, 10, 10)], [rect(2, 2, 5, 6)]).areaMm2, 12) < 1e-12,
    `${I2([rect(0, 0, 10, 10)], [rect(2, 2, 5, 6)]).areaMm2} vs 12`);
  const disj = [rect(0, 0, 10, 10)], disj2 = [rect(13, 14, 20, 20)];
  check('B3 disjuntos: intersección 0 y distancia = √(3²+4²) = 5 EXACTA',
    I2(disj, disj2).areaMm2 === 0 && Math.abs(A.distanciaPoligonos(disj, disj2) - 5) < 1e-12,
    `área=${I2(disj, disj2).areaMm2} dist=${A.distanciaPoligonos(disj, disj2).toFixed(12)}`);
  const tri = [[0, 0], [12, 0], [0, 6]];
  const b4 = I2([tri], [rect(-5, 3, 30, 30)]);
  check('B4 rectángulo ∩ triángulo (aristas OBLICUAS): área = 6·3/2 = 9 EXACTA',
    rel(b4.areaMm2, 9) < 1e-12, `${b4.areaMm2.toFixed(12)} vs 9`);
  check('B5 dos cuerpos que COMPARTEN UNA ARISTA: intersección 0 y distancia 0 (contacto, no choque)',
    I2([rect(0, 0, 10, 10)], [rect(10, 0, 20, 10)]).areaMm2 === 0
    && A.distanciaPoligonos([rect(0, 0, 10, 10)], [rect(10, 0, 20, 10)]) === 0,
    'si esto diera >0, TODO contacto funcional (talón↔respaldo, pin↔ranura) sería un falso choque');
  const tn = Math.tan((20 * Math.PI) / 180);
  const slideBack = [[0, 0], [10, 0], [10 - 25 * tn, 25], [-25 * tn, 25]];
  const heelFace = [[10, 0], [30, 0], [30, 25], [10 - 25 * tn, 25]];
  check('B5b caras INCLINADAS coincidentes (respaldo a 20°, el caso real del talón): intersección 0 y distancia 0',
    I2([slideBack], [heelFace]).areaMm2 === 0 && A.distanciaPoligonos([slideBack], [heelFace]) === 0,
    `área=${I2([slideBack], [heelFace]).areaMm2}`);
  const anillo = [rect(0, 0, 10, 10), rect(3, 3, 7, 7)];
  check('B6 conjunto con HUECO (par-impar) ∩ banda: área = 5·10 − 2·4 = 42 EXACTA',
    rel(I2(anillo, [rect(-5, -5, 5, 15)]).areaMm2, 42) < 1e-12,
    `${I2(anillo, [rect(-5, -5, 5, 15)]).areaMm2.toFixed(12)} vs 42`);
  const s45 = [[0, Math.SQRT2 * 5], [Math.SQRT2 * 5, 0], [0, -Math.SQRT2 * 5], [-Math.SQRT2 * 5, 0]];
  const octo = 100 - 4 * 0.5 * Math.pow(10 - Math.SQRT2 * 5, 2);
  check('B7 cuadrado ∩ cuadrado GIRADO 45° = octógono: 100 − 4·½·(10−5√2)² EXACTO',
    rel(I2([rect(-5, -5, 5, 5)], [s45]).areaMm2, octo) < 1e-12,
    `${I2([rect(-5, -5, 5, 5)], [s45]).areaMm2.toFixed(9)} vs ${octo.toFixed(9)}`);
  check('B8 CONMUTATIVIDAD: A∩B = B∩A bit a bit',
    I2([tri], [rect(-5, 3, 30, 30)]).areaMm2 === I2([rect(-5, 3, 30, 30)], [tri]).areaMm2,
    `${I2([tri], [rect(-5, 3, 30, 30)]).areaMm2} = ${I2([rect(-5, 3, 30, 30)], [tri]).areaMm2}`);
  const sumTrap = b4.trapecios.reduce((a, q) => a + Math.abs(areaPoly(q)), 0);
  check('B9 los TRAPECIOS que la lámina pinta en rojo suman EXACTAMENTE el área reportada',
    rel(sumTrap, b4.areaMm2) < 1e-12, `Σtrapecios=${sumTrap.toFixed(12)} vs área=${b4.areaMm2.toFixed(12)}`);
  check('B10 distancia entre polígonos que se PENETRAN = 0',
    A.distanciaPoligonos([rect(0, 0, 10, 10)], [rect(5, 5, 20, 20)]) === 0, 'penetración ⇒ distancia 0');

  // ══ CASOS ═════════════════════════════════════════════════════════════════
  const specVaso = { name: 'vaso Kazmer', Lmm: 100, Wmm: 100, Hmm: 60, cavityShape: 'round', surfaceMm2: 30000, volumeMm3: 60000, wallMm: 3, plastic: 'ABS', annualVolume: 200000, totalVolume: 1000000, cavPref: 1 };
  const specCaja = { name: 'caja con ventana', Lmm: 120, Wmm: 90, Hmm: 45, surfaceMm2: 26000, volumeMm3: 52000, wallMm: 2.5, plastic: 'ABS', annualVolume: 300000, totalVolume: 1200000, cavPref: 1 };
  const asmDe = (sp) => {
    const pkg = moldMachine(sp);
    const asm = packageToAssemblySpec(pkg);
    const mq = pkg.diseno && pkg.diseno.maquina && pkg.diseno.maquina.seleccion;
    const maquina = mq && mq.machine ? { nombre: mq.machine.name, minDaylightMm: mq.machine.minDaylightMm, maxDaylightMm: mq.machine.maxDaylightMm } : null;
    return { asm, maquina };
  };
  const VASO = asmDe(specVaso), CAJA = asmDe(specCaja);
  const VENT = [{ lado: 1, anchoMm: 30, altoMm: 14, desdeMm: 8 }];
  const VENT_H = [{ lado: 1, anchoMm: 30, altoMm: 14, desdeMm: 8, hidraulico: true }];
  const CASOS = [
    { id: 'vaso', o: { spec: VASO.asm, maquina: VASO.maquina } },
    { id: 'caja-corredera', o: { spec: CAJA.asm, maquina: CAJA.maquina, ventanas: VENT } },
    { id: 'caja-nucleo-tunel', o: { spec: CAJA.asm, maquina: CAJA.maquina, ventanas: VENT_H, tunnel: true } },
  ];
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });
  const resumen = {};

  for (const caso of CASOS) {
    const lam = A.laminaApertura(caso.o);
    const { meta, piezas, poses, medidas } = lam;
    const spec = caso.o.spec;
    const idm = DS.insertDims(spec), z = plateStackZ(spec);
    const defs = DS.plateDefs(spec);
    const grosor = (rl) => (defs.find((d) => d.role === rl) || {}).thick || 0;
    const P = (id) => piezas.find((p) => p.id === id);
    const tag = caso.id;
    console.log(`\n  ── ${tag.toUpperCase()} · apertura ${meta.aperturaTotalMm} mm · expulsión ${meta.expulsionMm} mm · ${medidas.pares.length} pares vigilados ──`);

    // ── C · CINEMÁTICA ──
    let peorN = 0;
    for (const t of [0, 7.3, meta.aperturaTotalMm, meta.aperturaTotalMm + meta.expulsionMm]) {
      const { d, e } = A.estadoEn(meta, t);
      for (const [, v] of A.cinematica(meta, d, e))
        peorN = Math.max(peorN, Math.abs(v[0] * meta.plano.n[0] + v[1] * meta.plano.n[1] + v[2] * meta.plano.n[2]));
    }
    check(`C1[${tag}] todos los desplazamientos cumplen t·n = 0 (viven en el plano de corte)`,
      peorN < 1e-15, `|t·n| máximo = ${peorN} — si no, el atajo de traslación mediría otra figura`);

    let peorArea = 0, peorDesp = 0;
    for (const pose of poses) {
      const lote = A.piezasEn(meta, piezas, pose.aperturaMm, pose.expulsionMm);
      for (const pa of piezas) {
        if (!pa.bbox) continue;
        const pb = lote.find((q) => q.id === pa.id);
        const [du, dv] = A.despPlano(meta, pa.id, pose.aperturaMm, pose.expulsionMm);
        peorArea = Math.max(peorArea, Math.abs(pb.areaMm2 - pa.areaMm2));
        peorDesp = Math.max(peorDesp, Math.abs((pb.bbox.u0 - pa.bbox.u0) - du), Math.abs((pb.bbox.v0 - pa.bbox.v0) - dv));
      }
    }
    check(`C2[${tag}] el ÁREA de cada sólido se CONSERVA en las 4 poses (cuerpo rígido)`,
      peorArea < 1e-9, `error máximo de área = ${peorArea.toExponential(2)} mm²`);
    check(`C3[${tag}] el desplazamiento MEDIDO en la sección = el COMANDADO, exacto`,
      peorDesp < 1e-9, `error máximo = ${peorDesp.toExponential(2)} mm`);

    const { solidos } = A.solidosApertura(caso.o);
    let peorAtajo = 0;
    for (const pose of [poses[1], poses[3]]) {
      const mov = A.cinematica(meta, pose.aperturaMm, pose.expulsionMm);
      const recorte = S.seccionarPorPlano(solidos.map((s) => ({ ...s, mover: mov.get(s.id) || [0, 0, 0] })), meta.plano);
      const lote = A.piezasEn(meta, piezas, pose.aperturaMm, pose.expulsionMm);
      for (const q of recorte.piezas) {
        const p = lote.find((x) => x.id === q.id);
        if (!p || !p.bbox || !q.bbox) continue;
        peorAtajo = Math.max(peorAtajo, Math.abs(p.areaMm2 - q.areaMm2), Math.abs(p.bbox.u0 - q.bbox.u0), Math.abs(p.bbox.v1 - q.bbox.v1));
      }
    }
    check(`C4[${tag}] el ATAJO de traslación = el RECORTE COMPLETO de L5 (mover + seccionarPorPlano)`,
      peorAtajo < 1e-9, `diferencia máxima = ${peorAtajo.toExponential(2)} mm/mm²`);

    let mono = true, prev = -1, peorSep = 0;
    for (let i = 0; i <= 120; i++) {
      const t = (i / 120) * (meta.aperturaTotalMm + meta.expulsionMm);
      const { d, e } = A.estadoEn(meta, t);
      const [, dvB] = A.despPlano(meta, 'p-B', d, e);
      const sep = -dvB;
      if (sep < prev - 1e-12) mono = false;
      prev = sep;
      peorSep = Math.max(peorSep, Math.abs(sep - d));
    }
    check(`C5[${tag}] MONOTONÍA: la separación de las mitades crece sin retrocesos y vale la apertura comandada`,
      mono && peorSep < 1e-12, `error separación↔apertura = ${peorSep.toExponential(2)} mm`);

    const colada = P('colada'), moldeo = P('moldeo');
    const vTopColada = colada && colada.bbox ? colada.bbox.v1 : (moldeo && moldeo.bbox ? moldeo.bbox.v1 : meta.zPart);
    const cerrada = Math.max(moldeo.bbox.v1, vTopColada) - meta.zPart;
    check(`C6[${tag}] carrera GEOMÉTRICA = H_pieza sobre la partición + largo de la colada (forma cerrada)`,
      Math.abs(meta.aperturaGeomMm - cerrada) < 1e-9,
      `${meta.aperturaGeomMm} = ${(moldeo.bbox.v1 - meta.zPart).toFixed(1)} (pieza) + ${(vTopColada - moldeo.bbox.v1).toFixed(1)} (colada)`);
    check(`C6b[${tag}] la carrera dibujada = max(geométrica, §6.3.2 ${TP.OPEN_FACTOR}×H_pieza)`,
      Math.abs(meta.aperturaTotalMm - Math.max(meta.aperturaGeomMm, TP.moldOpeningStrokeMm(idm.dep))) < 1e-9,
      `${meta.aperturaTotalMm} = max(${meta.aperturaGeomMm}, ${TP.moldOpeningStrokeMm(idm.dep)})`);

    const fin = A.piezasEn(meta, piezas, meta.aperturaTotalMm, 0);
    const fijos = fin.filter((p) => meta.grupos.get(p.id) === 'fijo' && p.bbox);
    const vFijoMin = Math.min(...fijos.map((p) => p.bbox.v0));
    const molFin = fin.find((p) => p.id === 'moldeo');
    const colFin = fin.find((p) => p.id === 'colada');
    const vMovMax = Math.max(molFin.bbox.v1, colFin && colFin.bbox ? colFin.bbox.v1 : -Infinity);
    check(`C7[${tag}] en la pose ABIERTA el moldeo y la colada quedan BAJO todo el lado fijo`,
      vMovMax <= vFijoMin + 1e-9, `tope del material moldeado ${vMovMax.toFixed(2)} ≤ base del lado fijo ${vFijoMin.toFixed(2)} mm`);

    const exp = A.piezasEn(meta, piezas, meta.aperturaTotalMm, meta.expulsionMm);
    const molE = exp.find((p) => p.id === 'moldeo'), coreE = exp.find((p) => p.id === 'i-core');
    check(`C8[${tag}] con la carrera de expulsión la pieza libra el macho JUSTO (mínimo geométrico)`,
      Math.abs(molE.bbox.v0 - coreE.bbox.v1) < 1e-9,
      `boca ${molE.bbox.v0.toFixed(3)} vs punta del macho ${coreE.bbox.v1.toFixed(3)} · carrera ${meta.expulsionMm} = alto del macho ${(idm.dep - idm.wall).toFixed(1)}`);

    // ── F · CONTABILIDAD contra L5 ──
    const L5 = S.solidosDeMolde(spec, { eje: caso.o.eje });
    const secL5 = S.seccionarPorPlano(L5.solidos, L5.plano);
    const aL5 = (id) => { const q = secL5.piezas.find((p) => p.id === id); return q ? q.areaMm2 : 0; };
    const mec = meta.mecanismos[0];
    const HOL = 1;
    const areaAloj = (u0, u1) => Math.max(0, u1 - u0) * (mec ? mec.geo.vAlto + HOL : 0);
    if (!idm.round) {
      const uIns = idm.ify / 2, uFin = mec ? Math.max(mec.geo.uTalon1, mec.geo.uCuerpo1 + mec.carreraMm) + HOL : 0;
      const teoCav = aL5('i-cav') - idm.fy * idm.dep - (mec ? areaAloj(idm.fy / 2, Math.min(uFin, uIns)) : 0);
      check(`F1[${tag}] inserto de cavidad TALLADO = área de L5 − impresión − alojamiento (analítico)`,
        rel(P('i-cav').areaMm2, teoCav) < 1e-9, `${P('i-cav').areaMm2.toFixed(4)} vs ${teoCav.toFixed(4)} mm²`);
      const teoA = aL5('p-A') - (mec ? areaAloj(uIns + 0.5, uFin) : 0);
      check(`F2[${tag}] placa A TALLADA = área de L5 − alojamiento fuera del asiento (analítico)`,
        rel(P('p-A').areaMm2, teoA) < 1e-9, `${P('p-A').areaMm2.toFixed(4)} vs ${teoA.toFixed(4)} mm²`);
      const teoMol = aL5('moldeo') - (caso.o.ventanas || []).reduce((a, v) => a + idm.wall * v.altoMm, 0);
      check(`F3[${tag}] la pieza CON VENTANA = cáscara nominal − Σ(pared × alto de ventana)`,
        rel(P('moldeo').areaMm2, teoMol) < 1e-9, `${P('moldeo').areaMm2.toFixed(4)} vs ${teoMol.toFixed(4)} mm²`);
    } else {
      check(`F1[${tag}] impresión REDONDA: el inserto queda MACIZO como en L5 y el par se DECLARA excluido`,
        rel(P('i-cav').areaMm2, aL5('i-cav')) < 1e-12 && medidas.excluidos.some((e) => e.a === 'i-cav' && e.b === 'moldeo'),
        `${P('i-cav').areaMm2.toFixed(3)} vs L5 ${aL5('i-cav').toFixed(3)}`);
    }
    const aAgua = (P('agua-A') ? P('agua-A').areaMm2 : 0) + (P('agua-B') ? P('agua-B').areaMm2 : 0);
    check(`F4[${tag}] el circuito PARTIDO por mitad conserva el área del de L5 (nada se perdió al repartirlo)`,
      rel(aAgua, aL5('agua')) < 1e-9, `A+B = ${aAgua.toFixed(3)} vs L5 ${aL5('agua').toFixed(3)} mm²`);

    // ── D · LA LEY DEL MECANISMO Y LOS PARES ──
    if (mec && mec.tipo === 'corredera') {
      const tn20 = Math.tan((mec.anguloDeg * Math.PI) / 180);
      let peorLey = 0, quieta = true;
      for (let i = 0; i <= 200; i++) {
        const d = (i / 200) * meta.aperturaTotalMm;
        const s = mec.ley(d);
        peorLey = Math.max(peorLey, Math.abs(s - Math.min(d, mec.desengancheMm) * tn20));
        if (d > mec.desengancheMm && Math.abs(s - mec.carreraMm) > 1e-12) quieta = false;
      }
      check(`C9[${tag}] la corredera avanza EXACTAMENTE d·tan φ y se detiene al desenganchar (forma cerrada)`,
        peorLey < 1e-12 && quieta, `error máximo ${peorLey.toExponential(2)} mm · φ=${mec.anguloDeg}° · d*=S/tan φ=${mec.desengancheMm.toFixed(4)} mm`);
      check(`C10[${tag}] d*·tan φ = S del plan, y S/sen φ = L de contacto (Eq 11.26 = ${mec.plan.pinContactMm} mm)`,
        Math.abs(mec.desengancheMm * tn20 - mec.carreraMm) < 1e-12
        && Math.abs(mec.carreraMm / Math.sin((mec.anguloDeg * Math.PI) / 180) - mec.plan.pinContactMm) < 0.5,
        `d*·tanφ = ${(mec.desengancheMm * tn20).toFixed(9)} vs S = ${mec.carreraMm}`);
      const pPin = medidas.pares.find((p) => [p.a, p.b].includes(mec.id) && [p.a, p.b].includes(`${mec.id}-pin`));
      check(`D1[${tag}] CONTROL NEGATIVO: con la ley correcta el pin angular va en CONTACTO con su ranura, sin penetrar`,
        !!pPin && pPin.estado === 'CONTACTO' && pPin.penetracionMaxMm2 <= A.TOL_PENETRACION_MM2,
        pPin ? `penetración ${pPin.penetracionMaxMm2} mm² · holgura mínima ${pPin.holguraMinMm}` : 'par no vigilado (¡debería estarlo!)');
      const pTal = medidas.pares.find((p) => [p.a, p.b].includes(`${mec.id}-talon`) && [p.a, p.b].includes(mec.id));
      check(`D2[${tag}] CONTROL NEGATIVO: el bloque de talón mantiene CONTACTO (holgura 0) sin penetrar en todo el recorrido`,
        !!pTal && pTal.penetracionMaxMm2 <= A.TOL_PENETRACION_MM2 && pTal.holguraMinMm === 0,
        pTal ? `penetración ${pTal.penetracionMaxMm2} mm²` : 'par no vigilado');
      const pAloj = medidas.pares.find((p) => [p.a, p.b].includes(mec.id) && [p.a, p.b].includes('i-cav'));
      check(`D3[${tag}] CONTROL NEGATIVO: el alojamiento deja la holgura declarada (1 mm) — sin falso positivo`,
        !!pAloj && pAloj.estado === 'OK' && Math.abs(pAloj.holguraMinMm - HOL) < 1e-9,
        pAloj ? `holgura mínima ${pAloj.holguraMinMm} mm vs ${HOL} declarada` : 'par no vigilado');
    }

    // D4 · el hallazgo del recorrido, con ARRANQUE en forma cerrada
    const holgHousing = z.support - (z['ejector-ret'] + grosor('ejector-ret'));
    const pRet = medidas.pares.find((p) => [p.a, p.b].includes('p-ejector-ret') && [p.a, p.b].includes('p-support'));
    if (meta.expulsionMm > holgHousing) {
      check(`D4[${tag}] el barrido caza el choque retenedora ↔ placa de soporte, y su ARRANQUE es forma cerrada`,
        !!pRet && pRet.estado === 'INTERFIERE' && Math.abs(pRet.tArranqueMm - (meta.aperturaTotalMm + holgHousing)) < 1e-3,
        pRet ? `arranque ${pRet.tArranqueMm.toFixed(4)} vs analítico ${(meta.aperturaTotalMm + holgHousing).toFixed(4)} = apertura ${meta.aperturaTotalMm} + hueco ${holgHousing}` : 'NO detectado');
    } else {
      check(`D4[${tag}] la carrera de expulsión cabe en el housing: NO hay choque (control negativo)`,
        !pRet || pRet.estado !== 'INTERFIERE', `carrera ${meta.expulsionMm} ≤ hueco ${holgHousing} mm`);
    }
    const conArranque = medidas.pares.filter((p) => p.estado === 'INTERFIERE' && p.tArranqueMm > 0.01);
    check(`D5[${tag}] BISECCIÓN del arranque: sin penetración justo antes y con penetración justo después (±0.001 mm)`,
      conArranque.every((p) => {
        const ant = A.estadoEn(meta, p.tArranqueMm - 1e-3), des = A.estadoEn(meta, p.tArranqueMm + 1e-3);
        const pa = A.piezasEn(meta, piezas, ant.d, ant.e), pd = A.piezasEn(meta, piezas, des.d, des.e);
        const g = (l, id) => l.find((x) => x.id === id).lazos;
        return A.interseccionPoligonos(g(pa, p.a), g(pa, p.b)).areaMm2 <= A.TOL_PENETRACION_MM2
          && A.interseccionPoligonos(g(pd, p.a), g(pd, p.b)).areaMm2 > A.TOL_PENETRACION_MM2;
      }), `${conArranque.length} arranque(s) verificados`);

    // ── E · TUNNEL GATE medido sobre lo DIBUJADO ──
    const v77 = medidas.veredictos.find((v) => v.id === 'V7.7');
    if (meta.tunel) {
      const t = meta.tunel;
      check(`E1[${tag}] el ángulo del eje MEDIDO en el trapecio dibujado = 45° (§7.2.7)`,
        Math.abs(medidas.datos.tunelAnguloDeg - A.TUNEL_ANGULO_DEG) < 0.05, `${medidas.datos.tunelAnguloDeg}° vs ${A.TUNEL_ANGULO_DEG}°`);
      check(`E2[${tag}] el TAPER INCLUIDO medido (bisectriz vs. generatrices) = 20°`,
        Math.abs(medidas.datos.tunelTaperDeg - A.TUNEL_TAPER_MIN_DEG) < 0.05, `${medidas.datos.tunelTaperDeg}° vs ${A.TUNEL_TAPER_MIN_DEG}°`);
      check(`E3[${tag}] el gate queda a 3.00 diámetros de túnel de la partición (mínimo del libro)`,
        Math.abs(medidas.datos.tunelOffDias - A.TUNEL_OFF_PARTING_DIAS) < 1e-9, `${medidas.datos.tunelOffDias}⌀`);
      const Lg = Math.hypot(t.uR - t.uJ, t.vR - t.vJ);
      const rBig = t.diaMm / 2 + Lg * Math.tan((t.taperDeg * Math.PI) / 360);
      check(`E4[${tag}] el área de la sección del cono = L·(r₀+r₁) analítica (el corte pasa por su eje)`,
        rel(P('gate-tunel').areaMm2, Lg * (t.diaMm / 2 + rBig)) < 1e-9,
        `${P('gate-tunel').areaMm2.toFixed(6)} vs ${(Lg * (t.diaMm / 2 + rBig)).toFixed(6)} mm²`);
      check(`E5[${tag}] AUTO-DEGATING: la colada y la pieza SE SEPARAN al abrir y nunca se penetran`,
        medidas.datos.gateSeparaMm > 0 && v77.estado === 'CUMPLE',
        `separación en la pose parcial ${medidas.datos.gateSeparaMm} mm · V7.7 ${v77.estado}`);
    } else {
      check(`E1[${tag}] sin tunnel gate el veredicto V7.7 sale SIN CABLEAR (no se finge)`,
        v77.estado === 'SIN CABLEAR', v77.porque.slice(0, 74));
    }

    // ── G · LA LÁMINA ──
    const sinCablear = medidas.veredictos.filter((v) => v.estado === 'SIN CABLEAR');
    check(`G1[${tag}] lo NO medido sale SIN CABLEAR y ningún CUMPLE va sin número medido`,
      sinCablear.length > 0 && medidas.veredictos.every((v) => v.estado !== 'CUMPLE' || (v.medido && v.medido.length > 3)),
      `${sinCablear.length} sin cablear: ${sinCablear.map((v) => v.id).join(', ')}`);
    check(`G2[${tag}] el veredicto global NO es verde mientras haya SIN CABLEAR o VIOLA`,
      /VEREDICTO (ROJO|ÁMBAR)/.test(lam.svg), (lam.svg.match(/VEREDICTO [A-ZÁ]+/) || ['?'])[0]);
    check(`G3[${tag}] la lámina trae las 4 poses, el barrido, los pares EXCLUIDOS y las extensiones`,
      lam.svg.startsWith('<svg') && lam.svg.trim().endsWith('</svg>') && poses.length === 4
      && /1\. CERRADO/.test(lam.svg) && /4\. EXPULSORES ACTUADOS/.test(lam.svg)
      && /BARRIDO DEL RECORRIDO/.test(lam.svg) && /PARES EXCLUIDOS/.test(lam.svg) && /EXTENSIONES DECLARADAS/.test(lam.svg),
      `${(lam.svg.length / 1024).toFixed(0)} kB · ${medidas.excluidos.length} pares excluidos · ${meta.extensiones.length} extensiones`);
    const Wsvg = +lam.svg.match(/<svg[^>]*width="([\d.]+)"/)[1];
    const ANCHO_CAR = { lblXs: 5.72, lblSm: 6.32, lbl: 7.22, cot: 6.7, pose: 7.53, tit: 12.05, sub: 8.45, cita: 7.83 };
    let desborde = 0, peorTxt = '';
    for (const m of lam.svg.matchAll(/<text class="(\w+)"([^>]*)>([^<]*)<\/text>/g)) {
      if (/transform=/.test(m[2])) continue;
      const x = +(m[2].match(/ x="([\d.-]+)"/) || [0, 0])[1];
      const w = (ANCHO_CAR[m[1]] || 6) * m[3].length;
      const der = x + w - (/text-anchor="middle"/.test(m[2]) ? w / 2 : 0);
      if (der - Wsvg > desborde) { desborde = der - Wsvg; peorTxt = m[3].slice(0, 44); }
    }
    check(`G4[${tag}] ENCUADRE: ningún rótulo se sale de la hoja de ${Wsvg} px`,
      desborde <= 0, desborde > 0 ? `se sale ${desborde.toFixed(0)} px: "${peorTxt}"` : 'todos los rótulos caben');

    fs.writeFileSync(path.join(outDir, `L6-${tag}.svg`), lam.svg);
    resumen[tag] = {
      apertura: meta.aperturaTotalMm, aperturaGeom: meta.aperturaGeomMm, expulsion: meta.expulsionMm,
      pares: medidas.pares.length, chocan: medidas.pares.filter((p) => p.estado === 'INTERFIERE').length,
      excluidos: medidas.excluidos.length,
      veredictos: Object.fromEntries(medidas.veredictos.map((v) => [v.id, v.estado])),
    };
    for (const v of medidas.veredictos) console.log(`     [${v.estado.padEnd(11)}] ${v.id.padEnd(8)} ${(v.medido || '').slice(0, 78)}`);
  }

  // ══ D · CONTROLES CONSTRUIDOS A PROPÓSITO ═════════════════════════════════
  console.log('\n  ── CONTROLES DE INTERFERENCIA (positivos y negativos, construidos a propósito) ──');
  const baseCaja = { spec: CAJA.asm, maquina: CAJA.maquina, ventanas: VENT };
  const idmC = DS.insertDims(CAJA.asm);
  const dPin = CAJA.asm.ejectors.diaMm;
  const parDe = (lam, a, b) => lam.medidas.pares.find((p) => [p.a, p.b].includes(a) && [p.a, p.b].includes(b));

  const ok0 = A.laminaApertura({ ...baseCaja, errPinMm: 0 });
  const v8a = ok0.medidas.veredictos.find((v) => v.id === 'V11.8');
  const pI0 = parDe(ok0, 'pin-contorneado', 'i-cav');
  check('D6 CONTROL NEGATIVO · pin contorneado A RAS: hueco 0 mm, sin penetración ⇒ V11.8 CUMPLE',
    v8a.estado === 'CUMPLE' && ok0.medidas.datos.huecoPinMm === 0
    && (!pI0 || pI0.penetracionMaxMm2 <= A.TOL_PENETRACION_MM2),
    `hueco ${ok0.medidas.datos.huecoPinMm} mm ≤ venteo ${A.VENTEO_PARTICION_MM} mm (§8.2.3)`);

  const ERR = 0.05;
  const lrg = A.laminaApertura({ ...baseCaja, errPinMm: ERR });
  const pI = parDe(lrg, 'pin-contorneado', 'i-cav'), pM = parDe(lrg, 'pin-contorneado', 'moldeo');
  const teoI = ERR * (dPin - idmC.wall), teoM = ERR * idmC.wall;
  check('D7 CONTROL POSITIVO · pin LARGO +0.05 mm: el barrido lo caza contra el INSERTO DE CAVIDAD',
    !!pI && pI.estado === 'INTERFIERE' && rel(pI.penetracionMaxMm2, teoI) < 1e-6,
    pI ? `penetración ${pI.penetracionMaxMm2.toFixed(6)} vs analítica err·(⌀−pared) = ${teoI.toFixed(6)} mm²` : 'NO detectado (un control positivo DEBE detectarse)');
  // El par pin↔MOLDEO NO se vigila, y está BIEN que no: los dos van en el paquete
  // expulsor (movimiento relativo nulo), así que un pin largo no "choca" con la pieza —
  // le hunde la cara. Lo que el libro llama compresión es contra el ACERO. Se verifica
  // igual la forma cerrada del solape, midiéndolo directo en la pose cerrada.
  const cerrLrg = A.piezasEn(lrg.meta, lrg.piezas, 0, 0);
  const solMol = A.interseccionPoligonos(
    cerrLrg.find((p) => p.id === 'pin-contorneado').lazos,
    cerrLrg.find((p) => p.id === 'moldeo').lazos).areaMm2;
  check('D7b el solape con el MOLDEO vale err·pared (forma cerrada) y el par NO se vigila: van en el MISMO grupo cinemático',
    !pM && rel(solMol, teoM) < 1e-9
    && lrg.meta.grupos.get('pin-contorneado') === lrg.meta.grupos.get('moldeo'),
    `solape ${solMol.toFixed(6)} vs err·pared ${teoM.toFixed(6)} mm² · ambos en el grupo "${lrg.meta.grupos.get('moldeo')}" (sin movimiento relativo)`);
  check('D7c el choque del pin largo arranca en el molde CERRADO (t = 0), no a mitad del recorrido',
    !!pI && pI.tArranqueMm !== null && pI.tArranqueMm < 1e-6, pI ? `arranque en t = ${pI.tArranqueMm}` : '—');
  const v8b = lrg.medidas.veredictos.find((v) => v.id === 'V11.8');
  check('D7d V11.8 lo reporta como PIN LARGO (se comprime al cerrar), no como rebaba',
    v8b.estado === 'VIOLA' && /LARGO/.test(v8b.medido) && Math.abs(lrg.medidas.datos.huecoPinMm + ERR) < 1e-9,
    `${v8b.medido} · hueco medido ${lrg.medidas.datos.huecoPinMm} mm`);

  const crt = A.laminaApertura({ ...baseCaja, errPinMm: -ERR });
  const v8c = crt.medidas.veredictos.find((v) => v.id === 'V11.8');
  const pIc = parDe(crt, 'pin-contorneado', 'i-cav');
  check('D8 CONTROL POSITIVO · pin CORTO −0.05 mm: sin penetración, pero hueco 0.05 > 0.02 (venteo) ⇒ REBABA',
    v8c.estado === 'VIOLA' && Math.abs(crt.medidas.datos.huecoPinMm - ERR) < 1e-9
    && (!pIc || pIc.penetracionMaxMm2 <= A.TOL_PENETRACION_MM2) && /flash|rebaba/i.test(v8c.porque),
    `hueco ${crt.medidas.datos.huecoPinMm} mm > ${A.VENTEO_PARTICION_MM} mm · penetración ${pIc ? pIc.penetracionMaxMm2 : 0} mm²`);

  const HT = 0.3;   // hueco PERPENDICULAR a la cara del talón (así se mide una holgura)
  const tal = A.laminaApertura({ ...baseCaja, huecoTalonMm: HT });
  const v18 = tal.medidas.veredictos.find((v) => v.id === 'V11.18');
  check('D9 CONTROL POSITIVO · talón con 0.3 mm de hueco: V11.18 VIOLA y el hueco medido = el construido',
    v18.estado === 'VIOLA' && Math.abs(tal.medidas.datos.huecoTalonMm - HT) < 1e-9 && /CARGAR EL PIN/i.test(v18.porque),
    `hueco medido ${tal.medidas.datos.huecoTalonMm} mm vs ${HT} construido`);
  const v18ok = ok0.medidas.veredictos.find((v) => v.id === 'V11.18');
  check('D9b CONTROL NEGATIVO · talón a 0: V11.18 CUMPLE (contacto) y φ MEDIDO en el dibujo = 20°',
    v18ok.estado === 'CUMPLE' && ok0.medidas.datos.huecoTalonMm === 0
    && Math.abs(ok0.medidas.datos.anguloPinDeg - A.ANGULO_PIN_MAX_DEG) < 0.02,
    `φ ${ok0.medidas.datos.anguloPinDeg}° ≤ ${A.ANGULO_PIN_MAX_DEG}° · hueco ${ok0.medidas.datos.huecoTalonMm} mm`);

  // La ley del mecanismo se verifica SOLA con la geometría: si la corredera no avanza
  // exactamente d·tan φ, el pin angular deja de caber en su ranura. Los dos signos del
  // error dan dos síntomas distintos, los dos con forma cerrada:
  //   · se RETRASA (φ−2°) ⇒ pisa la cara MOTRIZ desde el primer milímetro;
  //   · se ADELANTA (φ+2°) ⇒ primero se come la holgura de la ranura y choca contra la
  //     cara de atrás en d* = holgura / (tan(φ+2°) − tan φ).
  const leyLenta = A.laminaApertura({ ...baseCaja, desvioLeyDeg: -2 });
  const mecL = leyLenta.meta.mecanismos[0];
  const pPinL = parDe(leyLenta, mecL.id, `${mecL.id}-pin`);
  const penEn = (lam, mid, t) => {
    const { d, e } = A.estadoEn(lam.meta, t);
    const l = A.piezasEn(lam.meta, lam.piezas, d, e);
    const f = (id) => l.find((x) => x.id === id).lazos;
    return A.interseccionPoligonos(f(mid), f(`${mid}-pin`)).areaMm2;
  };
  check('D10 CONTROL POSITIVO · corredera RETRASADA (φ−2°): el pin angular pisa la cara MOTRIZ de su ranura desde el arranque',
    !!pPinL && pPinL.estado === 'INTERFIERE' && pPinL.tArranqueMm < 0.2,
    pPinL ? `penetración máxima ${pPinL.penetracionMaxMm2.toFixed(3)} mm² · arranque ${pPinL.tArranqueMm.toFixed(4)} mm` : 'NO detectado');
  // La FORMA de la penetración por ley errónea es una parábola, y se puede razonar sin
  // el código: el error lateral crece con d (∝ d) y el tramo de pin que sigue dentro de
  // la ranura se acorta con d (∝ d*−d) ⇒ el área es ~d·(d*−d): cero al arrancar, máximo
  // a media carrera y CERO EXACTO en cuanto el pin sale (d ≥ d*), porque ahí ya no hay
  // par que pueda chocar. Eso último es la parte dura y es exacta.
  const muestra = [];
  for (let i = 0; i <= 20; i++) muestra.push(penEn(leyLenta, mecL.id, (i / 20) * mecL.desengancheMm));
  const iMax = muestra.indexOf(Math.max(...muestra));
  const traspaso = [1.05, 1.3, 2].map((k) => penEn(leyLenta, mecL.id, Math.min(k * mecL.desengancheMm, leyLenta.meta.aperturaTotalMm)));
  check('D10b la penetración por ley errónea es una PARÁBOLA del recorrido (0 al arrancar · máximo a media carrera · 0 en cuanto el pin SALE)',
    muestra[0] === 0 && iMax > 2 && iMax < 18 && muestra.slice(1, iMax).every((v, k) => v > muestra[k])
    && traspaso.every((v) => v === 0),
    `máximo ${muestra[iMax].toFixed(3)} mm² al ${(iMax * 5)} % del enganche · después de d*=${mecL.desengancheMm.toFixed(2)} mm: ${traspaso.map((v) => v.toFixed(3)).join('/')}`);
  const leyRapida = A.laminaApertura({ ...baseCaja, desvioLeyDeg: 2 });
  const pPinR = parDe(leyRapida, mecL.id, `${mecL.id}-pin`);
  const phi = mecL.anguloDeg * Math.PI / 180;
  const dArr = A.HOLGURA_RANURA_MM / (Math.tan(phi + 2 * Math.PI / 180) - Math.tan(phi));
  check('D10c CONTROL POSITIVO · corredera ADELANTADA (φ+2°): choca contra la cara de atrás tras comerse la holgura, en d = holgura/(tan(φ+2°)−tan φ)',
    !!pPinR && pPinR.estado === 'INTERFIERE' && Math.abs(pPinR.tArranqueMm - dArr) < 5e-3,
    pPinR ? `arranque medido ${pPinR.tArranqueMm.toFixed(4)} vs analítico ${dArr.toFixed(4)} mm (holgura ${A.HOLGURA_RANURA_MM} mm)` : 'NO detectado');
  const pPinOK = parDe(ok0, mecL.id, `${mecL.id}-pin`);
  check('D10d CONTROL NEGATIVO · con la ley exacta el MISMO par no da falso positivo',
    !!pPinOK && pPinOK.penetracionMaxMm2 <= A.TOL_PENETRACION_MM2 && pPinOK.estado === 'CONTACTO',
    `penetración ${pPinOK ? pPinOK.penetracionMaxMm2 : '—'} mm² (contacto motriz, no choque)`);

  const tunOK = A.laminaApertura({ spec: CAJA.asm, maquina: CAJA.maquina, ventanas: VENT_H, tunnel: true });
  const tunMal = A.laminaApertura({ spec: CAJA.asm, maquina: CAJA.maquina, ventanas: VENT_H, tunnel: true, tunelOffDias: 2 });
  const v77a = tunOK.medidas.veredictos.find((v) => v.id === 'V7.7');
  const v77b = tunMal.medidas.veredictos.find((v) => v.id === 'V7.7');
  check('D11 CONTROL POSITIVO/NEGATIVO · tunnel gate a 3⌀ CUMPLE y a 2⌀ VIOLA (mismo molde, un solo cambio)',
    v77a.estado === 'CUMPLE' && v77b.estado === 'VIOLA' && Math.abs(tunMal.medidas.datos.tunelOffDias - 2) < 1e-9,
    `3⌀ → ${v77a.estado} · 2⌀ → ${v77b.estado} (medido ${tunMal.medidas.datos.tunelOffDias}⌀)`);
  check('D11b y el ángulo de 45° NO se degrada al mover el gate (sigue medido sobre el dibujo)',
    Math.abs(tunMal.medidas.datos.tunelAnguloDeg - 45) < 0.05, `${tunMal.medidas.datos.tunelAnguloDeg}°`);

  // D12 · el barrido es COMPLETO: ningún par se cae en silencio
  const lamC = ok0;
  const vivos = lamC.piezas.filter((p) => p.lazos.length).map((p) => p.id);
  const exc = new Set(lamC.medidas.excluidos.map((e) => [e.a, e.b].sort().join('|')));
  const vig = new Set(lamC.medidas.pares.map((p) => [p.a, p.b].sort().join('|')));
  let huerfanos = 0, ejemplo = '';
  for (let i = 0; i < vivos.length; i++) for (let j = i + 1; j < vivos.length; j++) {
    const a = vivos[i], b = vivos[j];
    const ga = lamC.meta.grupos.get(a), gb = lamC.meta.grupos.get(b);
    const ma = lamC.meta.mecanismos.some((m) => m.id === a), mb = lamC.meta.mecanismos.some((m) => m.id === b);
    if (ga === gb && !ma && !mb) continue;
    const k = [a, b].sort().join('|');
    if (vig.has(k) || exc.has(k)) continue;
    let dmin = Infinity;
    for (let s = 0; s <= 40; s++) {
      const t = (s / 40) * (lamC.meta.aperturaTotalMm + lamC.meta.expulsionMm);
      const { d, e } = A.estadoEn(lamC.meta, t);
      const l = A.piezasEn(lamC.meta, lamC.piezas, d, e);
      const pa = l.find((x) => x.id === a), pb = l.find((x) => x.id === b);
      const dx = Math.max(pa.bbox.u0 - pb.bbox.u1, pb.bbox.u0 - pa.bbox.u1, 0);
      const dy = Math.max(pa.bbox.v0 - pb.bbox.v1, pb.bbox.v0 - pa.bbox.v1, 0);
      dmin = Math.min(dmin, Math.hypot(dx, dy));
    }
    if (dmin < 30) { huerfanos++; ejemplo = `${a}↔${b} (dmin ${dmin.toFixed(1)} mm)`; }
  }
  check('D12 el barrido es COMPLETO: ningún par con movimiento relativo y cercanía queda sin vigilar ni excluir',
    huerfanos === 0, huerfanos ? `${huerfanos} huérfanos, p.ej. ${ejemplo}` : `${vig.size} vigilados + ${exc.size} excluidos, cada uno con su razón escrita`);

  console.log('\n  láminas en _laminas/L6-vaso.svg · L6-caja-corredera.svg · L6-caja-nucleo-tunel.svg');
  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, ...resumen }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1500)); process.exit(1); });
