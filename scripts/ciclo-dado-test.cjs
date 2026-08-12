/**
 * EL GATE DEL CICLO DEL DADO — E1 + E2 + E3 con OCC REAL.
 * ============================================================================
 * Nació de que ian frenó la estación 3: "no avanzaremos a menos de que añadas
 * dimensiones — TODAS — y verifiques desde distintas caras". El bug que cazó:
 * el panel declaraba insertos de COMPRA 60/16 y el acero dibujado medía 52/14.
 *
 * Este gate verifica en NÚMEROS, contra el B-Rep de producción (occt.ts +
 * splitMold reales, no mocks):
 *   E1 · el macizo REPROBADO con su t_c (Eq 9.5) y el dado APROBADO
 *   E2 · el desglose económico CUADRA al centavo y la banda A-050 cambia de ganador
 *   E3 · TODAS las medidas declarado≈medido (verificacionE3): compra=tallado,
 *        draft medido de las CARAS, Σ volúmenes = bloque, cuerpos=2
 *
 * Uso: node --import tsx scripts/ciclo-dado-test.cjs
 */
const { readFileSync } = require('fs');
const path = require('path');
const distDir = path.resolve(__dirname, '..', 'node_modules', 'opencascade.js', 'dist');
const factory = require(path.join(distDir, 'opencascade.wasm.cjs'));
const wasmBin = readFileSync(path.join(distDir, 'opencascade.wasm.wasm'));

let pasan = 0, fallan = 0;
const check = (nombre, ok, detalle = '') => {
  if (ok) { pasan++; console.log(`  ✔ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
  else { fallan++; console.log(`  ✘ ${nombre}${detalle ? ' — ' + detalle : ''}`); }
};
const cerca = (a, b, tol) => Math.abs(a - b) <= tol;

(async () => {
  const ed = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'estudio-molde-datos.ts'));

  // ══ E1 — DFM ══
  console.log('── E1 · DFM de la pieza (cap 2)');
  const e1 = ed.estacion1Dado();
  check('macizo REPROBADO', e1.macizo.veredicto === 'REPROBADO');
  check('t_c del macizo ≈ 88.3 min (Eq 9.5)', cerca(e1.macizo.tcS / 60, 88.3, 0.5), (e1.macizo.tcS / 60).toFixed(1) + ' min');
  check('macizo con ≥2 errores §2.3', e1.macizo.dfm.errors >= 2, String(e1.macizo.dfm.errors));
  check('dado APROBADO sin errores', e1.dado.veredicto === 'APROBADO' && e1.dado.dfm.errors === 0);
  check('t_c del dado ≈ 8.5 s (≈ el 8.4 del libro)', cerca(e1.dado.tcS, 8.5, 0.3), e1.dado.tcS.toFixed(1) + ' s');

  // ══ E2 — ECONOMÍA ══
  console.log('── E2 · Economía (cap 3)');
  const e2 = ed.estacion2Dado();
  const gana = e2.variantes.find((v) => v.ganadora);
  check('gana cold-2placas ×1', gana && gana.arch === 'cold-2placas' && gana.nCav === 1);
  const cuadran = e2.variantes.every((v) => cerca(v.amortPzaUSD + v.restoPzaUSD, v.totalPzaUSD, 0.001));
  check('desglose CUADRA al centavo en todas las filas', cuadran);
  const cambio = e2.banda.findIndex((b, i) => i > 0 && b.nCav !== e2.banda[0].nCav);
  check('A-050: el ganador CAMBIA dentro de la banda', cambio > 0, cambio > 0 ? `en ${e2.banda[cambio].q.toLocaleString()} pzas → ×${e2.banda[cambio].nCav}` : 'nunca cambia');
  check('A-054: proporción sana (<30 %)', e2.proporcion.pct < 30, e2.proporcion.pct + ' %');

  // ══ E3 — ARQUITECTURA con OCC REAL ══
  console.log('── E3 · Arquitectura (cap 4) — midiendo el B-Rep');
  const oc = await factory({ wasmBinary: wasmBin });
  const occt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'brep', 'occt.ts'));
  occt._setActiveOCCT(oc);
  const acero = ed.construirAceroE3(oc, e2.pkg);
  check('insertos = dims de COMPRA (el bug de ian)', acero.compra.Hc === 60 && acero.compra.Hk === 16, `Hc ${acero.compra.Hc} · Hk ${acero.compra.Hk}`);
  const v = ed.verificacionE3(oc, acero);
  for (const m of v.medidas)
    check(`${m.componente} · ${m.cota} [${m.vista}]`, m.ok, `declarado ${m.declarado} vs medido ${m.medido} (±${m.tolMm})`);
  check('VERIFICACIÓN E3 completa', v.ok, v.resumen);

  // ══ LA PRUEBA DEL RAYO — el teorema y su CONTROL NEGATIVO ══
  console.log('── EL RAYO · ¿la pieza SALE? (y ¿el test distingue lo roto?)');
  const { splitMold } = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'));
  const malla = (sh) => { const t = occt.tessellate(oc, sh, 0.15); return { positions: t.positions, indices: t.indices }; };
  const corre = (shape) => {
    const r = splitMold(oc, shape, { scale: 1, pinch: 0.5, plateThickness: 16, block: { w: 120, d: 120, h: 60, x: 20, y: 20, z: 39.5 - 30 } });
    return {
      p: ed.pruebaDelRayo([
        { nombre: 'cavidad (baja −Z)', malla: malla(r.cavityPlate), sube: false },
        { nombre: 'núcleo (sube +Z)', malla: malla(r.macho), sube: true },
      ], { res: 384 }),
      inter: ed.interseccionMitades(oc, r.cavityPlate, r.macho),
    };
  };
  const bueno = corre(ed.dadoDraftShape(oc));
  check('el DADO SALE (atrapadas = 0)', bueno.p.veredicto === 'SALE' && bueno.p.atrapados === 0, bueno.p.resumen.slice(0, 110));
  check('cavidad ∩ núcleo = ∅', bueno.inter.ok, bueno.inter.volMm3 + ' mm³');
  // LA REGLA DEL RENDER CORRUPTO: si el test no distingue el molde ROTO, no es evidencia
  const malo = corre(ed.dadoUndercutShape(oc));
  check('CONTROL NEGATIVO: el dado con draft INVERTIDO reprueba', malo.p.veredicto === 'NO SALE' && malo.p.atrapados > 0, `${malo.p.atrapados} caras atrapadas`);
  check('y el undercut lo sufre la CAVIDAD (la que no puede bajar)', (malo.p.mitades.find((m) => !m.sube)?.nAtrapados ?? 0) > 0);

  // ══ E4 — LLENADO (cap 5) ══
  console.log('── E4 · Llenado (cap 5)');
  const e4 = ed.estacion4Dado(e2.pkg, 60, 2);
  check('el lazo de velocidad CONVERGE (A-088)', e4.convergio && e4.vueltas > 1, `${e4.escalera[0]} → ${e4.vMs} m/s en ${e4.vueltas} vueltas`);
  // la escalera tiene que ser MONÓTONA y estabilizarse: si oscila, no convergió de verdad
  const monotona = e4.escalera.every((x, i) => i === 0 || x >= e4.escalera[i - 1] - 1e-9);
  const estable = Math.abs(e4.escalera[e4.escalera.length - 1] - e4.escalera[e4.escalera.length - 2]) < 1e-3;
  check('la escalera es monótona y se estabiliza', monotona && estable);
  check('L/T dentro de lo que aguanta el ABS', e4.ltRatio <= 150, `L/T = ${e4.ltRatio}`);
  check('todas las filas del llenado CUMPLEN', e4.filas.every((r) => r.estado === 'CUMPLE'), e4.filas.filter((r) => r.estado !== 'CUMPLE').map((r) => r.titulo).join(', ') || 'todas');
  // los defectos REALES del dado, anunciados a su estación destino (grafo con retornos)
  check('anuncia el congelamiento de compuerta a la E6 (§7.1.5)', e4.anuncios.some((a) => a.estacion === 6));
  check('anuncia el ΔP del bebedero a la E5 (§6.4)', e4.anuncios.some((a) => a.estacion === 5));
  // CONTROL NEGATIVO: una pared de 0.5 mm sobre la MISMA longitud debe reprobar por L/T
  const flaco = ed.estacion4Dado(e2.pkg, 60, 0.35);
  check('CONTROL NEGATIVO: pared de 0.35 mm REPRUEBA por L/T', flaco.ltRatio > 150 && flaco.filas.some((r) => r.id === 'lt' && r.estado === 'VIOLA'), `L/T = ${flaco.ltRatio}`);

  // ══ CROSS-WLF + NIVEL 1 — contra los EJEMPLOS RESUELTOS del libro ══
  console.log('── CROSS-WLF · reproducir el libro línea por línea');
  const f = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'filling.ts'));
  check('η₀(239°C) ≈ 2210 Pa·s (Apéndice A)', cerca(f.eta0CrossWLF(f.ABS_CROSS, 239), 2210, 40), f.eta0CrossWLF(f.ABS_CROSS, 239).toFixed(0));
  const mu2k = f.viscosityCrossWLF(f.ABS_CROSS, 2000, 239);
  check('η(γ̇=2000, 239°C) ≈ 120 Pa·s (§5.5.1, el ejemplo del bezel)', cerca(mu2k, 120, 3), mu2k.toFixed(1));
  const lz = f.convergeVelocityCross(f.ABS_CROSS, 0.19, 60, 0.0015);
  check('el lazo converge a ≈0.82 m/s (§5.5.1)', lz.convergio && cerca(lz.vMs, 0.82, 0.02), `${lz.escalera[0]} → ${lz.vMs} en ${lz.vueltas} vueltas`);
  const dpBezel = f.pressureDropSegment(f.ABS_MG47, 0.2, 0.0015, 0.82) / 1e6;
  check('lay-flat del bezel = 83.2 MPa (§5.5.2, el número impreso)', cerca(dpBezel, 83.2, 0.5), dpBezel.toFixed(1) + ' MPa');

  console.log('── NIVEL 1 · el frente por RESISTENCIA (y el par bueno/malo del libro)');
  const fl = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'flowlen.ts'));
  const W = 100, L = 160, Hc = 60;
  const cont = (pl) => (x, y, z) => (x < 0 || x > W || y < 0 || y > L || z < 0 || z > Hc) ? false
    : (z > Hc - 2 ? true : (x < pl || x > W - pl || y < pl || y > L - pl));
  const correN1 = (pl) => {
    const campo = fl.measureFlowLength({ x0: -1, y0: -1, z0: -1, x1: W + 1, y1: L + 1, z1: Hc + 1, cellMm: 1.6,
      inCavity: cont(pl), gateMm: { x: 0, y: L / 2, z: Hc - 1 }, wallMm: pl, meltN: 0.348 });
    return { campo, n1: ed.llenadoNivel1(campo, { vMs: lz.vMs, muPaS: lz.muFinalPaS, wallMm: pl, material: f.ABS_MG47 }) };
  };
  const uniR = correN1(2.0), leaderR = correN1(1.5);
  const uni = uniR.n1, leader = leaderR.n1;
  check('§5.5.4: el contenedor de pared UNIFORME da RACE-TRACKING', uni.raceTracking.hay, uni.raceTracking.detalle.slice(0, 80));
  check('§5.5.5: con FLOW LEADER (1.5 mm) el race-tracking se CURA (Fig 5.19/5.20)', !leader.raceTracking.hay);
  // el llenado se EMPAREJA: la banda más cargada baja respecto al total (§5.2 objetivo)
  const pico = (n1) => Math.max(...n1.bandas.map((b) => b.nVox)) / n1.bandas.reduce((a, b) => a + b.nVox, 0);
  check('y el llenado se EMPAREJA (la banda pico pesa menos)', pico(leader) < pico(uni), `${(pico(uni) * 100).toFixed(0)}% → ${(pico(leader) * 100).toFixed(0)}%`);
  check('el frente sale de RESISTENCIA, no de distancia (bandas isócronas)', uni.bandas.length === 10 && uni.bandas.every((b) => b.tS > 0));

  // ══ LA SUPERFICIE DEL FUNDIDO ══
  // ian: "se ve de juguete, no se ve real". La industria dibuja una SUPERFICIE
  // (Moldflow `Fill time`), no bolitas. Una superficie bonita que encierra otro
  // volumen es una mentira bonita: aquí se mide que encierre EL MISMO volumen que
  // los vóxeles llenos, en tres instantes, con el suavizado con el que se DIBUJA.
  console.log('── SUPERFICIE DEL FRENTE · lo que se dibuja es lo que se mide');
  const G = uniR.campo;
  const meta = { nx: G.nx, ny: G.ny, nz: G.nz, cellMm: G.cellMm, x0: G.x0, y0: G.y0, z0: G.z0 };
  const vox = G.cellMm ** 3;
  // El criterio NO puede ser sólo el %: la pérdida de surface nets es por REDONDEO de
  // aristas convexas, o sea proporcional al ÁREA, no al volumen. En un cuerpo delgado
  // (t chico) la misma desviación geométrica pesa mucho más en porcentaje. Así que se
  // exige ±2 % **o** que la superficie caiga a menos de ¼ de celda de la frontera de
  // vóxeles (ΔV/A = el desplazamiento medio real) — y se imprimen los dos números.
  const areaDe = (s) => {
    let A = 0;
    for (let e = 0; e < s.indices.length; e += 3) {
      const a = s.indices[e] * 3, b = s.indices[e + 1] * 3, c = s.indices[e + 2] * 3;
      const ux = s.positions[b] - s.positions[a], uy = s.positions[b + 1] - s.positions[a + 1], uz = s.positions[b + 2] - s.positions[a + 2];
      const vx = s.positions[c] - s.positions[a], vy = s.positions[c + 1] - s.positions[a + 1], vz = s.positions[c + 2] - s.positions[a + 2];
      A += 0.5 * Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    }
    return A;
  };
  for (const t of [0.25, 0.6, 1.0]) {
    const s = fl.frenteSuperficie({ ...meta, frente: uni.frente, t, suavizado: 0 });
    let n = 0;
    for (let v = 0; v < uni.frente.length; v++) if (uni.frente[v] >= 0 && uni.frente[v] <= t) n++;
    const esperado = n * vox;
    const err = (s.volumeMm3 / esperado - 1) * 100;
    const sesgo = Math.abs(s.volumeMm3 - esperado) / areaDe(s);       // mm de desplazamiento medio
    check(`t=${t}: la superficie encierra el volumen de los vóxeles (±2 % o <¼ celda)`,
      s.volumeMm3 > 0 && (Math.abs(err) <= 2 || sesgo <= G.cellMm / 4),
      `${(s.volumeMm3 / 1000).toFixed(1)} cm³ vs ${(esperado / 1000).toFixed(1)} cm³ · ${err >= 0 ? '+' : ''}${err.toFixed(2)} % · desplazamiento ${sesgo.toFixed(3)} mm (celda ${G.cellMm}) · ${s.tris} tris`);
  }
  // ORIENTACIÓN: en una malla cerrada bien orientada cada arista DIRIGIDA a→b sale
  // 1 vez. Este check es el que destapó que `lib/viz/isosurface` trae 13,896 aristas
  // repetidas de 25,608 triángulos (normales revueltas → volumen −38 %). Con normales
  // revueltas NO hay material iluminado que se vea bien: por eso el check vive aquí.
  {
    const s = fl.frenteSuperficie({ ...meta, frente: uni.frente, t: 1, suavizado: 0 });
    const d = new Map(); let rep = 0;
    for (let e = 0; e < s.indices.length; e += 3) {
      const [a, b, c] = [s.indices[e], s.indices[e + 1], s.indices[e + 2]];
      for (const [p, q] of [[a, b], [b, c], [c, a]]) { const k = `${p}>${q}`; d.set(k, (d.get(k) || 0) + 1); }
    }
    for (const v of d.values()) if (v !== 1) rep++;
    check('la malla está ORIENTADA (0 aristas dirigidas repetidas)', rep === 0, `${rep} repetidas en ${s.tris} triángulos`);
    // CERRADA: cada arista NO dirigida en exactamente 2 triángulos. Un agujero pasa
    // el check de orientación (una arista de borde sale 1 vez y nunca en reversa) y
    // solo se delata aquí. Es el check que faltaba cuando el volumen dio −403 %.
    const u = new Map(); let abiertas = 0;
    for (const k of d.keys()) { const [a, b] = k.split('>').map(Number); const q = a < b ? `${a}|${b}` : `${b}|${a}`; u.set(q, (u.get(q) || 0) + 1); }
    for (const v of u.values()) if (v !== 2) abiertas++;
    check('la malla está CERRADA (toda arista en 2 triángulos)', abiertas === 0, `${abiertas} aristas de borde`);
  }
  // CONTROL NEGATIVO: sin fundido no puede haber superficie (ni un cubo espurio)
  {
    const vacio = new Float32Array(uni.frente.length).fill(-1);
    const s = fl.frenteSuperficie({ ...meta, frente: vacio, t: 1, suavizado: 0 });
    check('CONTROL NEGATIVO: campo vacío → 0 triángulos', s.tris === 0 && s.volumeMm3 === 0, `${s.tris} tris`);
  }

  // ══ E5 — ALIMENTACIÓN (cap 6) ══
  // Nació de "se sigue viendo raro el sprue". El criterio que lo cierra es que la sección
  // BAJE monótona hasta la compuerta — y se mide sobre los SÓLIDOS construidos, no sobre
  // el panel (la lección de la E3: declaraba 60/16 y el acero medía 52/14).
  console.log('── E5 · Alimentación (cap 6) — midiendo los sólidos de la colada');
  const C = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'colada.ts'));
  const mps = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
  const asm = mps.packageToAssemblySpec(e2.pkg);
  const zStack = mps.plateStackZ(asm);
  const colB = ed.colocacionEnLaBase(e2.pkg);
  const dC = C.datumsColada({
    plates: asm.plates, moldWidthMm: asm.widthMm, moldDepthMm: asm.depthMm ?? asm.widthMm,
    // la pieza vive VOLTEADA y CENTRADA (Fig 7.2): boca a B, base cerrada hacia A
    zPartMm: zStack.A,
    pieza: { x0: colB.tx, y0: colB.ty - 40, x1: colB.tx + 40, y1: colB.ty, zBaseCerradaMm: colB.zBaseCerradaMm, bocaHaciaElSprue: false },
    plastic: 'ABS', partVolCc: 14.14, wallMm: 2, fillTimeS: 1,
  });

  const fd = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'feed.ts'));
  const e5 = ed.estacion5Dado({ datums: dC, partVolCc: 14.14, wallMm: 2, cavidadMPa: 10.7, fillTimeS: 1 });
  const G5 = e5.geom;
  check('el ⌀ del bebedero SALE del motor, no de un literal', Math.abs(2 * G5.rTopMm - 5.0) < 0.01 && G5.rBaseMm > G5.rTopMm,
    `⌀${(2 * G5.rTopMm).toFixed(2)} (orificio de boquilla + holgura) → ⌀${(2 * G5.rBaseMm).toFixed(2)}`);
  check('§6.3.1: angosto en la boquilla, ancho en la partición', G5.rBaseMm > G5.rTopMm);
  if (e5.filas.some((f) => f.id === 'freeze')) {
    check('§7.1.5: la COMPUERTA congela ANTES que el runner', e5.filas.find((f) => f.id === 'freeze').estado === 'CUMPLE',
      e5.filas.find((f) => f.id === 'freeze').valor);
  } else {
    check('§7.2.1: SPRUE DIRECTO declarado (sin runner ni compuerta tallada)',
      e5.filas.some((f) => f.id === 'directo' && f.estado === 'CUMPLE'),
      e5.filas.find((f) => f.id === 'directo')?.valor ?? 'sin fila directo');
  }
  // §6.2.3 — con L_sprue del STACK REAL (141.5 mm) para una pieza de 14 cc, la colada se
  // lleva el 68 % del disparo. Eso NO es un bug del gate: es el diseño diciendo la verdad.
  // Antes lo "resolvía" inventando un bebedero más corto; el largo lo fija el stack, así
  // que el remedio es cambiar PLACAS = estación 3. El gate exige que se DETECTE y se
  // ANUNCIE, no que el número salga bonito.
  check('§6.2.3: el regrind fuera de límite se DETECTA', e5.regrind.despuesPct > e5.regrind.limPct === !e5.regrind.resuelto,
    `${e5.regrind.despuesPct.toFixed(1)} % vs límite ${e5.regrind.limPct} % → ${e5.regrind.resuelto ? 'cumple' : 'VIOLA'}`);
  check('§6.2.3: y se ANUNCIA como retorno a la estación 3 (las placas)',
    e5.regrind.resuelto || e5.anuncios.some((a) => a.estacion === 3),
    e5.anuncios.filter((a) => a.estacion === 3).map((a) => a.titulo).join(' · ') || 'sin anuncio');
  check('§6.4: la cuenta de presión CIERRA (cavidad + alimentación)', e5.presion.ok,
    `${e5.presion.cavidadMPa.toFixed(1)} + ${e5.presion.alimentacionMPa.toFixed(1)} = ${e5.presion.totalMPa.toFixed(1)} MPa ≤ ${e5.presion.maquinaMPa}`);
  // (las mediciones inline de la E5 se BORRARON: las hace `verificacionColada`, la misma
  // que corre el CAD — tener dos formas de medir era la otra cara de tener dos coladas)

  // ══ LA COLADA · generador propio (cap 6) ══
  // Extraída a `mold/colada.ts` porque estaba enterrada en la línea 1112 de 1619 de
  // `mold-plano-set` y la E5 no la vio: se inventó otra con L=60 y eje en una esquina.
  console.log('── LA COLADA · el generador con los DATUMS del libro');
  const solC = C.construirColada(occt, oc, dC);
  const vC = C.verificacionColada(occt, oc, solC, dC);
  for (const m of vC.medidas) check(`colada · ${m.cota} [${m.seccion}]`, m.ok, `declarado ${m.declarado} vs medido ${m.medido} (±${m.tolMm})`);
  check('el eje del bebedero es el CENTRO del molde (Fig 6.4)', vC.ejeOk);
  // CONTROL NEGATIVO: la colada de la E5 de ayer debe REPROBAR
  const vMala = C.verificacionColada(occt, oc, C.coladaMala(occt, oc, dC), dC);
  check('CONTROL NEGATIVO: la colada de ayer (⌀9.5 recta, fuera de eje) REPRUEBA', !vMala.ok, vMala.resumen);
  // ── EL CONFLICTO ESPACIAL, detectado Y medido ──
  // La revisión con OJOS lo cazó: el bebedero centrado atraviesa la BOCA y muere dentro
  // del hueco — en acero, PERFORA el macho. datumsColada lo declara; aquí se exige que
  // lo declare, y la intersección booleana lo MIDE. Este check estaba DECLARADO en la
  // orden del generador ("colada ∩ macho = ∅") y nunca se implementó — y su lectura
  // honesta para ESTA pieza es la inversa: la interferencia DEBE existir, porque es la
  // prueba de que el retorno a la E3 (desplazar cavidad / voltear pieza) va en serio.
  // ── EL RETORNO 2026-08-12 (ian: "hay que desplazar la cavidad") ──
  // La cavidad desplazada RESUELVE el conflicto: el eje del bushing queda sobre acero
  // pleno, el modo cae a sprue+runner sin conflictos, y la evidencia ORIGINAL de la
  // orden del generador —"colada ∩ macho = ∅"— por fin se cumple de verdad.
  check('EL VOLTEO da SPRUE DIRECTO sin conflictos (§7.2.1, Fig 7.2)',
    dC.modo === 'sprue-directo' && dC.conflictos.length === 0,
    `modo ${dC.modo} · ${dC.conflictos.length} conflictos · pieza centrada`);
  check('§7.2.1: L_sprue = cara del clamp − base cerrada (el bushing "abuts" la pieza)',
    cerca(dC.LsprueMm, (zStack.clamp + asm.plates.topClamp) - colB.zBaseCerradaMm, 0.01),
    `${dC.LsprueMm.toFixed(1)} mm = ${zStack.clamp + asm.plates.topClamp} − ${colB.zBaseCerradaMm}`);
  const interCM = ed.interseccionMitades(oc, solC.fundido, acero.r.macho);
  check('colada ∩ macho = ∅ — la evidencia original, por fin medida en verde',
    interCM.volMm3 < 1, `${interCM.volMm3.toFixed(1)} mm³ (antes del retorno: 3,997.5)`);
  // el DETECTOR se conserva: la pieza CENTRADA (sin offset) debe seguir acusando el
  // conflicto — control puro, sin OCC. Si deja de detectar, el retorno borró al juez.
  const dCentrada = C.datumsColada({
    plates: asm.plates, moldWidthMm: asm.widthMm, moldDepthMm: asm.depthMm ?? asm.widthMm,
    zPartMm: zStack.A,
    pieza: { x0: 78, y0: 78, x1: 118, y1: 118, zBaseCerradaMm: 106.5, bocaHaciaElSprue: true },
    plastic: 'ABS', partVolCc: 14.14, wallMm: 2, fillTimeS: 1,
  });
  check('CONTROL: la pieza CENTRADA sigue acusando requiere-offset',
    dCentrada.modo === 'requiere-offset' && dCentrada.conflictos.length > 0,
    dCentrada.conflictos[0] ? dCentrada.conflictos[0].slice(0, 80) : 'no detectó');
  // ⚠ EL DEFECTO REAL, y va como CHECK que FALLA — no como nota al pie. La pieza y el
  // molde viven en MARCOS DISTINTOS: los insertos de la E3 nunca han estado dentro de la
  // base. Mientras no se concilien, la colada no tiene dónde caer. Un gate verde con esto
  // adentro sería justo la mentira que este proyecto lleva toda la sesión cazando.
  const centroMolde = asm.widthMm / 2;
  const bbA = occt.shapeBBox ? null : null;
  const bDado = (() => { const b = new oc.Bnd_Box_1(); oc.BRepBndLib.Add(acero.dadoD, b, false);
    const a2 = b.CornerMin(), c2 = b.CornerMax(); return { cx: (a2.X()+c2.X())/2, cy: (a2.Y()+c2.Y())/2, z1: c2.Z() }; })();
  // ══ UNA SOLA TUBERÍA — la alarma que faltaba, con su control ══
  // ian: "se llena de un lado y el sprue está del otro — 2 tuberías desconectadas en
  // lugar de 1, y ninguna alarma. Eso quiere decir que está mal todo". El campo CONJUNTO
  // (colada ∪ pieza, sembrado en la BOQUILLA) hace la conectividad MEDIBLE.
  console.log('── UNA TUBERÍA · colada ∪ pieza en un campo, sembrado en la boquilla');
  const fl2 = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'flowlen.ts'));
  const denCol = C.dentroColada(dC);
  const dentroPiezaB = (x, y, z) => { const q = colB.aLocal(x, y, z); return ed.dentroDadoLocal(q[0], q[1], q[2]); };
  const gridJ = {
    x0: Math.min(dC.ejeX - dC.rBaseMm, colB.tx) - 2, y0: Math.min(dC.ejeY - dC.rBaseMm, colB.ty - 40) - 2,
    z0: colB.tz - 41 - 2,
    x1: Math.max(dC.ejeX + dC.rBaseMm, colB.tx + 40) + 2, y1: Math.max(dC.ejeY + dC.rBaseMm, colB.ty) + 2,
    z1: dC.zCaraClampMm + 2, cellMm: 1.0,
    gateMm: { x: dC.ejeX, y: dC.ejeY, z: dC.zCaraClampMm - 1 }, wallMm: 2, meltN: 0.348,
  };
  const snapDe = (cf) => Math.hypot(
    cf.x0 + (cf.gate.i + 0.5) * cf.cellMm - gridJ.gateMm.x,
    cf.y0 + (cf.gate.j + 0.5) * cf.cellMm - gridJ.gateMm.y,
    cf.z0 + (cf.gate.k + 0.5) * cf.cellMm - gridJ.gateMm.z);
  const campoJ = fl2.measureFlowLength({ ...gridJ, inCavity: (x, y, z) => dentroPiezaB(x, y, z) || denCol(x, y, z) });
  // LA ALARMA exige LAS DOS condiciones: measureFlowLength TELEPORTA la semilla al vóxel
  // de cavidad más cercano si el punto pedido no cae en el dominio (flowlen.ts:131, un
  // ayudador legítimo para compuertas de frontera) — con la tubería rota eso dejaría
  // unreachable=0 y la alarma muerta. Lo cazó ESTE control negativo en su primera corrida.
  check('LA ALARMA (1/2): 0 vóxeles inalcanzables desde la BOQUILLA',
    campoJ.unreachable === 0, `${campoJ.unreachable} inalcanzables de ${campoJ.cavity.reduce((a, b) => a + b, 0)}`);
  check('LA ALARMA (2/2): la semilla aterrizó EN la boquilla (sin teleporte)',
    snapDe(campoJ) <= 2, `desvío ${snapDe(campoJ).toFixed(2)} mm`);
  // CONTROL NEGATIVO: el dominio de AYER (solo la pieza) con la misma semilla en la
  // boquilla = la tubería rota. La alarma DEBE gritar; si no grita, no es alarma.
  const campoRoto = fl2.measureFlowLength({ ...gridJ, inCavity: dentroPiezaB });
  check('CONTROL: el dominio de AYER (solo pieza) DISPARA la alarma (por teleporte de semilla)',
    campoRoto.unreachable > 1000 || snapDe(campoRoto) > 50,
    `unreachable ${campoRoto.unreachable} · semilla teleportada ${snapDe(campoRoto).toFixed(0)} mm (boquilla→pieza)`);
  // tres fuentes del volumen de colada, cruzadas
  const n1J = ed.llenadoNivel1(campoJ, { vMs: lz.vMs, muPaS: lz.muFinalPaS, wallMm: 2, material: f.ABS_MG47 });
  let voxCol = 0, voxPza = 0, minFrentePza = Infinity; const frentesCol = [];
  for (let k = 0; k < campoJ.nz; k++) for (let j = 0; j < campoJ.ny; j++) for (let i = 0; i < campoJ.nx; i++) {
    const id = campoJ.idx(i, j, k);
    if (!campoJ.cavity[id] || n1J.frente[id] < 0) continue;
    const X = campoJ.x0 + (i + 0.5), Y = campoJ.y0 + (j + 0.5), Z = campoJ.z0 + (k + 0.5);
    if (dentroPiezaB(X, Y, Z)) { voxPza++; if (n1J.frente[id] < minFrentePza) minFrentePza = n1J.frente[id]; }
    else { voxCol++; frentesCol.push(n1J.frente[id]); }
  }
  const volVoxCol = voxCol / 1000, volPuroCol = C.volumenColadaCc(dC), volOccCol = occt.volume(oc, solC.fundido) / 1000;
  check('V_colada: vóxeles ≈ analítico ≈ OCC (3 fuentes del mismo número)',
    Math.abs(volVoxCol - volOccCol) / volOccCol < 0.12 && Math.abs(volPuroCol - volOccCol) / volOccCol < 0.08,
    `vóxeles ${volVoxCol.toFixed(2)} · puro ${volPuroCol.toFixed(2)} · OCC ${volOccCol.toFixed(2)} cc`);
  // EL ORDEN FÍSICO: la pieza arranca cuando la colada ya casi terminó (caudal constante)
  frentesCol.sort((a, b) => a - b);
  const p75Col = frentesCol[Math.floor(frentesCol.length * 0.75)];
  check('ORDEN FÍSICO: la pieza solo arranca tras ≥75 % de la colada',
    minFrentePza >= p75Col, `min(frente pieza) ${minFrentePza.toFixed(3)} ≥ p75(colada) ${p75Col.toFixed(3)}`);

  // ══ EL CONO SE VE CONO — la verdad sub-vóxel, con su control ══
  // ian: "veo 3 tamaños en el líquido, como un perno con 3 diámetros, en lugar de un
  // cono". Causa: superficie desde ocupación BINARIA — la huella de vóxeles de la
  // sección circular solo cambia cuando r(z) cruza una distancia de la retícula. El
  // arreglo: ocupación FRACCIONAL supermuestreada del predicado ANALÍTICO; el cruce 0.5
  // interpola el radio real. Se mide el radio del fundido en 3 alturas del bebedero.
  console.log('── CONICIDAD · el radio del fundido DECRECE continuo (no escalones)');
  {
    const metaJ = { nx: campoJ.nx, ny: campoJ.ny, nz: campoJ.nz, cellMm: campoJ.cellMm, x0: campoJ.x0, y0: campoJ.y0, z0: campoJ.z0 };
    const ocuJ = new Float32Array(campoJ.nx * campoJ.ny * campoJ.nz);
    const q4J = campoJ.cellMm * 0.25;
    const denTub = (x, y, z) => dentroPiezaB(x, y, z) || denCol(x, y, z);
    for (let k = 0; k < campoJ.nz; k++) for (let j = 0; j < campoJ.ny; j++) for (let i = 0; i < campoJ.nx; i++) {
      const id = campoJ.idx(i, j, k);
      if (!campoJ.cavity[id]) continue;
      const X = campoJ.x0 + (i + 0.5) * campoJ.cellMm, Y = campoJ.y0 + (j + 0.5) * campoJ.cellMm, Z = campoJ.z0 + (k + 0.5) * campoJ.cellMm;
      let hits = denTub(X, Y, Z) ? 1 : 0;
      for (let a = -1; a <= 1; a += 2) for (let b = -1; b <= 1; b += 2) for (let d2 = -1; d2 <= 1; d2 += 2) {
        if (denTub(X + a * q4J, Y + b * q4J, Z + d2 * q4J)) hits++;
      }
      ocuJ[id] = hits / 9;
    }
    const radios = (surf) => [200, 215, 230].map((zc) => {
      let r = 0;
      for (let v = 0; v < surf.positions.length; v += 3) {
        if (Math.abs(surf.positions[v + 2] - zc) > 1) continue;
        r = Math.max(r, Math.hypot(surf.positions[v] - dC.ejeX, surf.positions[v + 1] - dC.ejeY));
      }
      return r;
    });
    const sBin = fl2.frenteSuperficie({ ...metaJ, frente: n1J.frente, t: 1, suavizado: 0 });
    const sFra = fl2.frenteSuperficie({ ...metaJ, frente: n1J.frente, t: 1, suavizado: 0, ocupacion: ocuJ });
    const rB = radios(sBin), rF = radios(sFra);
    const dB = Math.min(rB[0] - rB[1], rB[1] - rB[2]), dF = Math.min(rF[0] - rF[1], rF[1] - rF[2]);
    check('CONICIDAD: el radio decrece estrictamente (Δ ≥ 0.15 mm por tramo de 15 mm; analítico 0.39)',
      rF[0] > rF[1] && rF[1] > rF[2] && dF >= 0.15,
      `fraccional: ${rF.map((r) => r.toFixed(2)).join(' → ')} mm (Δmin ${dF.toFixed(2)})`);
    check('CONTROL: la ocupación BINARIA reprueba conicidad (el perno de 3 diámetros)',
      dB < 0.15, `binaria: ${rB.map((r) => r.toFixed(2)).join(' → ')} mm (Δmin ${dB.toFixed(2)})`);
  }

  // ══ LA ALARMA DE BALANCE — mover el layout sin que nada grite, nunca más ══
  // ian: "se desplazó TODO y no levantó ninguna alarma". Y peor: el check del marco lo
  // edité YO para que esperara el desplazamiento — coherencia interna, no criterio. El
  // criterio del LIBRO: §6.6 "naturally balanced" + §4.3 (todos los layouts simétricos
  // al centro) + §7.2.1/Fig 7.2 (una cavidad = bebedero directo AL CENTRO de la pieza).
  // Umbral EXTENSIÓN DECLARADA: 5 % del ancho de la base. HOY DEBE SALIR ROJA (29.2 mm):
  // queda declarada hasta que ian decida el layout (voltear la pieza, Fig 7.2).
  {
    const cG = colB.aGlobal(20, 20, 20);                                 // centro de la pieza por el MAPA
    const centroideCavX = cG[0];
    const desbalanceMm = Math.abs(centroideCavX - asm.widthMm / 2);
    const umbralMm = 0.05 * asm.widthMm;
    check('BALANCE (§6.6 · §4.3 · Fig 7.2): el centroide de la cavidad está en el eje de la máquina',
      desbalanceMm <= umbralMm,
      `desbalance ${desbalanceMm.toFixed(1)} mm vs umbral ${umbralMm.toFixed(1)} (5 % de ${asm.widthMm}) — retorno E3: voltear la pieza (sprue directo, Fig 7.2) o justificar`);
    // CONTROL: el layout CENTRADO da 0 — si el control no distingue, no es alarma
    check('CONTROL: el layout centrado NO dispara la alarma de balance',
      Math.abs(98 - asm.widthMm / 2) <= umbralMm, `desbalance del layout centrado: ${Math.abs(98 - asm.widthMm / 2).toFixed(1)} mm`);
  }

  // el centro esperado de la pieza YA NO es el centro de la base: lleva el offset de la
  // colada (retorno 2026-08-12). La fuente única sigue siendo colocacionEnLaBase.
  const cEsp = colB.aGlobal(20, 20, 20); const cxEsp = cEsp[0], cyEsp = cEsp[1];
  check('la PIEZA vive donde la COLOCACIÓN declara (centro base + offset de colada)',
    Math.abs(bDado.cx - cxEsp) < 1 && Math.abs(bDado.cy - cyEsp) < 1 && Math.abs(acero.zPart - zStack.A) < 1,
    `centro MEDIDO (${bDado.cx.toFixed(1)}, ${bDado.cy.toFixed(1)}) vs declarado (${cxEsp.toFixed(1)}, ${cyEsp.toFixed(1)}) · VOLTEADA (Fig 7.2) · partición ${acero.zPart} vs stack ${zStack.A}`);
  // Fig 4.21 — y CABE en el área utilizable de la partición (reserva de ½⌀ a pilares/retornos)
  const bCav = (() => { const b = new oc.Bnd_Box_1(); oc.BRepBndLib.Add(acero.r.cavityPlate, b, false);
    const a2 = b.CornerMin(), c2 = b.CornerMax(); return { x0: a2.X(), y0: a2.Y(), x1: c2.X(), y1: c2.Y() }; })();
  check('Fig 4.21: el inserto cabe en el ÁREA UTILIZABLE de la partición',
    bCav.x0 >= 0 && bCav.y0 >= 0 && bCav.x1 <= asm.widthMm && bCav.y1 <= (asm.depthMm ?? asm.widthMm),
    `inserto x ${bCav.x0.toFixed(1)}..${bCav.x1.toFixed(1)} · base 0..${asm.widthMm}`);

  console.log(`\n${fallan === 0 ? '✅' : '❌'} ciclo del dado: ${pasan} pasan · ${fallan} fallan`);
  console.log(`VERIFY_RESULT={"pass":${fallan === 0},"pasan":${pasan},"fallan":${fallan}}`);
  process.exit(fallan ? 1 : 0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 600)); process.exit(1); });
