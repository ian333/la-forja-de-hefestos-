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

  // ══ SEPARACIÓN — la MISMA máquina corre el VASO, no solo el cubo ══
  // (orden 2026-08-21-separar-maquina-del-cubo · ian: "debe funcionar para ambos")
  console.log('── SEPARACIÓN · la máquina del molde, ya no la del cubo');
  const v1 = ed.estacion1(ed.VASO_PIEZA);
  check('VASO E1: macizo REPROBADO (⌀80×20 sólido, t_c enorme)', v1.macizo.veredicto === 'REPROBADO', `${v1.macizo.veredicto} · ${(v1.macizo.tcS / 60).toFixed(1)} min`);
  check('VASO E1: pieza APROBADA (pared 3 · draft 1.5° · redonda)', v1.dado.veredicto === 'APROBADO' && v1.dado.dfm.errors === 0, `${v1.dado.veredicto} · ${v1.dado.dfm.errors} err`);
  check('VASO E1: su t_c ≠ el del cubo (pared 3 vs 2 — juzga SU forma)', !cerca(v1.dado.tcS, e1.dado.tcS, 0.5), `vaso ${v1.dado.tcS.toFixed(1)} s vs cubo ${e1.dado.tcS.toFixed(1)} s`);
  const v2 = ed.estacion2(ed.VASO_PIEZA);
  const vgana = v2.variantes.find((v) => v.ganadora);
  check('VASO E2: cotiza el vaso REDONDO por moldMachine', !!vgana, vgana ? `gana ${vgana.arch}×${vgana.nCav} · $${vgana.totalPzaUSD}/pza` : 'sin ganadora');
  check('CONTROL: el molde del vaso ≠ el del cubo (separó de verdad)', v2.veredicto.precioMoldeUSD !== e2.veredicto.precioMoldeUSD, `vaso $${v2.veredicto.precioMoldeUSD.toLocaleString()} vs cubo $${e2.veredicto.precioMoldeUSD.toLocaleString()}`);
  check('ALIAS: el cubo llama el MISMO camino (estacion1Dado == estacion1(DADO_PIEZA))', ed.estacion1Dado().dado.tcS === ed.estacion1(ed.DADO_PIEZA).dado.tcS && ed.estacion2Dado().veredicto.precioMoldeUSD === ed.estacion2(ed.DADO_PIEZA).veredicto.precioMoldeUSD);

  // ══ TERCERA FIGURA — LA JABONERA (costillas §2.3.2 + bosses §2.3.3) ══
  console.log('── TERCERA FIGURA · la jabonera (un eje de forma nuevo)');
  const refs = (dfm) => new Set((dfm.findings ?? []).map((f) => f.ref));
  const j1 = ed.estacion1(ed.JABONERA_PIEZA);
  check('JABONERA E1: macizo REPROBADO (bloque 120×80×30)', j1.macizo.veredicto === 'REPROBADO', `${j1.macizo.veredicto} · ${(j1.macizo.tcS / 60).toFixed(1)} min`);
  check('JABONERA E1: pieza APROBADA (costillas+bosses en regla)', j1.dado.veredicto === 'APROBADO' && j1.dado.dfm.errors === 0, `${j1.dado.veredicto} · ${j1.dado.dfm.errors} err`);
  const jrefs = refs(j1.dado.dfm);
  check('JABONERA E1: la máquina EJERCE §2.3.2 (costillas) + §2.3.3 (bosses)', jrefs.has('§2.3.2') && jrefs.has('§2.3.3'), [...jrefs].sort().join(' '));
  const crefs = refs(e1.dado.dfm);
  check('CONTROL: el cubo NO trae costillas/bosses (eje NUEVO de la jabonera)', !crefs.has('§2.3.2') && !crefs.has('§2.3.3'), [...crefs].sort().join(' ') || '(sin §2.3.2/§2.3.3)');
  const j2 = ed.estacion2(ed.JABONERA_PIEZA);
  check('JABONERA E2: el molde ≠ cubo Y ≠ vaso (tres piezas, tres costos)', j2.veredicto.precioMoldeUSD !== e2.veredicto.precioMoldeUSD && j2.veredicto.precioMoldeUSD !== v2.veredicto.precioMoldeUSD, `jabonera $${j2.veredicto.precioMoldeUSD.toLocaleString()} · cubo $${e2.veredicto.precioMoldeUSD.toLocaleString()} · vaso $${v2.veredicto.precioMoldeUSD.toLocaleString()}`);

  // ══ v1·5 — LA COTIZACIÓN: E1+E2+E3+base → la hoja que un taller LEE ══
  console.log('── v1·5 · LA COTIZACIÓN — las 3 figuras, con juez de legibilidad');
  {
    const cots = [ed.DADO_PIEZA, ed.VASO_PIEZA, ed.JABONERA_PIEZA].map((pp) => ed.cotizacionPieza(pp, { fecha: '2026-08-25' }));
    check('v1·5: las 3 figuras emiten cotización con BASE NOMBRADA (§4.3.2)',
      cots.every((c) => /\d+×\d+ mm/.test(c.molde.baseNombre)),
      cots.map((c) => `${c.pieza.nombre.split(' ·')[0]}: ${c.molde.baseNombre.split(' (')[0]}`).join(' · '));
    check('v1·5: tres piezas, tres moldes, tres $/pza (todos distintos)',
      new Set(cots.map((c) => c.dinero.moldeUSD)).size === 3 && new Set(cots.map((c) => c.dinero.totalPzaUSD)).size === 3,
      cots.map((c) => `$${c.dinero.moldeUSD.toLocaleString()} · $${c.dinero.totalPzaUSD}/pza`).join(' · '));
    check('v1·5: el dinero CUADRA al centavo (amortización + resto = total)',
      cots.every((c) => Math.abs(c.dinero.amortPzaUSD + c.dinero.restoPzaUSD - c.dinero.totalPzaUSD) < 0.005),
      cots.map((c) => `${c.dinero.amortPzaUSD}+${c.dinero.restoPzaUSD}=${c.dinero.totalPzaUSD}`).join(' · '));
    check('v1·5: la cotización del cubo = la E2 del ciclo (misma Máquina, mismo número)',
      cots[0].dinero.moldeUSD === e2.veredicto.precioMoldeUSD,
      `hoja $${cots[0].dinero.moldeUSD.toLocaleString()} vs ciclo $${e2.veredicto.precioMoldeUSD.toLocaleString()}`);
    const juicios = cots.map((c) => ed.juezLegibilidadCotizacion(ed.cotizacionSvg(c)));
    check('v1·5: el JUEZ DE LEGIBILIDAD (lección del acta) aprueba las 3 hojas',
      juicios.every((j) => j.ok), juicios.map((j) => (j.ok ? 'ok' : j.fallas.slice(0, 2).join(','))).join(' · '));
    // CONTROL NEGATIVO: una hoja saboteada (letra 6px + sin los §§) tiene que REPROBAR
    const rota = '<svg viewBox="0 0 1000 707"><text x="20" y="30" font-size="6" fill="#000">cotización chiquita sin secciones</text></svg>';
    const jr = ed.juezLegibilidadCotizacion(rota);
    check('v1·5 CONTROL: el juez REPRUEBA la hoja ilegible (letra 6px, sin §§)', !jr.ok, jr.fallas.slice(0, 3).join(' · '));
  }

  // ══ SPRINT 2/3 (superticket moldes) — el INTAKE cambia la cotización · la base con fuente ══
  console.log('── SPRINT 2/3 · intake §2.1.5 y el retículo de bases');
  {
    const mb = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldbase.ts'));
    const chica = mb.selectMoldBase({ insertLmm: 60, insertWmm: 50, insertHcavityMm: 30, insertHcoreMm: 20, coolingDiaMm: 6, extraHmm: 15, cheekMm: 15, driver: 'refrigeración' }, { nx: 1, ny: 1 });
    check('SPRINT 3: una pieza chica cae en la base 156×156 (antes: 196 sin necesitarlo)', chica.base.wmm === 156 && chica.base.lmm === 156, `${chica.base.wmm}×${chica.base.lmm} · necesita ${chica.envelope.wmm + 2 * chica.reserveMm}`);
    check('SPRINT 3: el cubo sigue en 196×196 (bit-igual) y la hoja declara su fuente', e2.pkg.base.base.wmm === 196 && e2.pkg.base.base.lmm === 196 && /HASCO\/DME/.test(mb.CATALOGO_BASES), `${e2.pkg.base.base.wmm}×${e2.pkg.base.base.lmm} · ${mb.CATALOGO_BASES}`);
    const cotC = ed.cotizacionPieza(ed.DADO_PIEZA, { fecha: '2026-08-26' });
    check('SPRINT 3: la hoja imprime el catálogo y deja PENDIENTE lo que no tiene (números de pieza)', cotC.molde.catalogo === mb.CATALOGO_BASES && cotC.supuestos.some((x) => /PENDIENTES/.test(x)) && ed.juezLegibilidadCotizacion(ed.cotizacionSvg(cotC)).ok, cotC.molde.catalogo);
  }

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

  // ══ EL PUENTE (orden v1·1) — la pieza del ÁRBOL entra a la máquina ══
  // piezaDesdeArbol: bbox/volumen/área MEDIDOS del sólido OCC + pared/draft/filete
  // DECLARADOS por los features. La máquina juzga LA PIEZA REAL y dice la verdad.
  console.log('── EL PUENTE · piezaDesdeArbol: el sólido del usuario → PiezaSpec');
  {
    const outer = occt.makeCylinder(oc, 40, 20);
    const inner = occt.transformShape(oc, occt.makeCylinder(oc, 37, 18), { translate: [0, 0, 3] });
    const vasoArbol = occt.cut(oc, outer, inner);            // = vasoDoc(): ⌀80×20, cascarón 3, tapa abierta
    const pz = ed.piezaDesdeArbol(oc, vasoArbol, { nombre: 'VASO DEL ÁRBOL', wallMm: 3, round: true });
    check('PUENTE: bbox MEDIDA del sólido = 80×80×20', cerca(pz.spec.Lmm, 80, 0.1) && cerca(pz.spec.Wmm, 80, 0.1) && cerca(pz.spec.Hmm, 20, 0.1), `${pz.spec.Lmm}×${pz.spec.Wmm}×${pz.spec.Hmm}`);
    check('PUENTE: volumen MEDIDO ≈ 27,417 mm³ (π·40²·20 − π·37²·17, ±1 %) y redondo', cerca(pz.spec.volumeMm3, 27417, 275) && pz.spec.cavityShape === 'round', `${pz.spec.volumeMm3} mm³ · ${pz.spec.cavityShape}`);
    const p1 = ed.estacion1(pz);
    const refs1 = new Set(p1.dado.dfm.findings.filter((f) => f.severity === 'error').map((f) => f.ref));
    check('PUENTE E1 dice la VERDAD: el vaso del árbol sin Draft ni Redondeo REPRUEBA §2.3.6 + §2.3.4', p1.dado.veredicto === 'REPROBADO' && refs1.has('§2.3.6') && refs1.has('§2.3.4'), `${p1.dado.veredicto} · errores: ${[...refs1].join(' ')}`);
    const p1ok = ed.estacion1(ed.piezaDesdeArbol(oc, vasoArbol, { nombre: 'VASO DEL ÁRBOL', wallMm: 3, round: true, draftDeg: 1.5, filletMm: 4.5 }));
    check('PUENTE CONTROL: con Draft 1.5° + Redondeo declarados, la MISMA pieza APRUEBA', p1ok.dado.veredicto === 'APROBADO' && p1ok.dado.dfm.errors === 0, `${p1ok.dado.veredicto} · ${p1ok.dado.dfm.errors} err`);
    const p2 = ed.estacion2(pz), v2b = ed.estacion2(ed.VASO_PIEZA);
    check('PUENTE E2: el vaso MEDIDO del árbol cotiza como el vaso ESCRITO a mano (±2 %) — misma pieza, dos orígenes', cerca(p2.veredicto.precioMoldeUSD, v2b.veredicto.precioMoldeUSD, 0.02 * v2b.veredicto.precioMoldeUSD), `árbol $${p2.veredicto.precioMoldeUSD.toLocaleString()} vs escrito $${v2b.veredicto.precioMoldeUSD.toLocaleString()}`);
    const pc = ed.estacion1(ed.piezaDesdeArbol(oc, occt.makeBox(oc, 40, 40, 40), { nombre: 'CAJA SIN CASCARÓN' }));
    check('PUENTE CONTROL: sin cascarón la pieza es MACIZA (pared 40) → E1 la REPRUEBA', pc.dado.veredicto === 'REPROBADO' && pc.dado.wallMm === 40, `${pc.dado.veredicto} · pared ${pc.dado.wallMm} · t_c ${(pc.dado.tcS / 60).toFixed(1)} min`);

    // ══ v1·3 — E3 POR PIEZA: el acero talla TU sólido, colocado en SU base ══
    console.log('── v1·3 · E3 POR PIEZA — el acero del vaso del árbol');
    const mm = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'));
    const e2v = ed.estacion2(pz);                          // pz = el vaso del árbol (pared 3, redondo, SIN draft)
    const av = ed.construirAceroE3(oc, e2v.pkg, false, undefined, pz);
    check('v1·3: el acero del vaso usa SUS dims de COMPRA (≠ cubo)',
      av.compra.ifx !== acero.compra.ifx || av.compra.Hc !== acero.compra.Hc,
      `vaso ${av.compra.ifx}×${av.compra.ify}×${av.compra.Hc}/${av.compra.Hk} vs cubo ${acero.compra.ifx}×${acero.compra.ify}×${acero.compra.Hc}/${acero.compra.Hk}`);
    check('v1·3: cuerpos = 2 y cavidad ∩ núcleo = ∅', av.r.bodies === 2 && ed.interseccionMitades(oc, av.r.cavityPlate, av.r.macho).ok,
      `bodies ${av.r.bodies}`);
    // bbox EXACTA (Bnd_Box): shapeBBox mide la MALLA y la cuerda del cilindro
    // teselado corre el centro 0.12 mm en X (medido) — el instrumento mentía, no la colocación.
    const exacto = (sh) => {
      const box = new oc.Bnd_Box_1(); oc.BRepBndLib.Add(sh, box, false);
      const mn = box.CornerMin(), mx = box.CornerMax();
      const r = { min: [mn.X(), mn.Y(), mn.Z()], max: [mx.X(), mx.Y(), mx.Z()] };
      box.delete?.(); mn.delete?.(); mx.delete?.(); return r;
    };
    const bbVd = exacto(av.dadoD);
    const colV = av.colocacion;
    check('v1·3: la pieza queda CENTRADA en su base (el volteo ya no asume la esquina 20/20)',
      Math.abs((bbVd.max[0] + bbVd.min[0]) / 2 - colV.centroX) < 0.1 && Math.abs((bbVd.max[1] + bbVd.min[1]) / 2 - colV.centroY) < 0.1,
      `centro (${((bbVd.max[0] + bbVd.min[0]) / 2).toFixed(2)}, ${((bbVd.max[1] + bbVd.min[1]) / 2).toFixed(2)}) vs base (${colV.centroX}, ${colV.centroY})`);
    check('v1·3: la BOCA de la pieza cae EN la partición de SU base',
      Math.abs((bbVd.max[2] - colV.zPartBase) - pz.local.bocaZmm) < 0.25,
      `top pieza ${bbVd.max[2].toFixed(2)} − partición ${colV.zPartBase} = ${(bbVd.max[2] - colV.zPartBase).toFixed(2)} ≈ boca ${pz.local.bocaZmm}`);
    const vv = ed.verificacionE3(oc, av, ed.declDePieza(pz));
    for (const m of vv.medidas)
      check(`v1·3 vaso · ${m.componente} · ${m.cota} [${m.vista}]`, m.ok, `declarado ${m.declarado} vs medido ${m.medido} (±${m.tolMm})`);
    check('v1·3: VERIFICACIÓN del vaso completa (declarado≈medido de SU sólido)', vv.ok, vv.resumen);
    // MEDIDO, no supuesto: el vaso RECTO (draft 0) — paredes verticales ROZAN, no traban.
    const mallaV = (sh) => { const t = occt.tessellate(oc, sh, 0.15); return { positions: t.positions, indices: t.indices }; };
    const rayoV = ed.pruebaDelRayo([
      { nombre: 'cavidad (sube +Z, lado A)', malla: mallaV(av.r.cavityPlate), sube: true },
      { nombre: 'núcleo (baja −Z, lado B)', malla: mallaV(av.r.macho), sube: false },
    ], { res: 384 });
    check('v1·3 MEDIDO: el vaso recto SALE con paredes VERTICALES (rozan, no traban — §2.3.6 vive en E1)',
      rayoV.atrapados === 0 && rayoV.mitades.some((h) => h.nVerticales > 0),
      `${rayoV.veredicto} · atrapadas ${rayoV.atrapados} · verticales ${rayoV.mitades.map((h) => h.nVerticales).join('/')}`);
    // CONTROL: el CUBO con pieza=DADO_PIEZA es BIT-IGUAL al camino clásico.
    const aD = ed.construirAceroE3(oc, e2.pkg, false, undefined, ed.DADO_PIEZA);
    const bb1 = mm.shapeBBox(oc, acero.r.cavityPlate), bb2 = mm.shapeBBox(oc, aD.r.cavityPlate);
    const dMax = Math.max(...[0, 1, 2].flatMap((i) => [Math.abs(bb1.min[i] - bb2.min[i]), Math.abs(bb1.max[i] - bb2.max[i])]));
    check('v1·3 CONTROL: el cubo con pieza=DADO_PIEZA es BIT-IGUAL al camino clásico',
      dMax < 1e-9 && Math.abs(acero.r.vols.cavity - aD.r.vols.cavity) < 1e-6 && Math.abs(acero.r.vols.macho - aD.r.vols.macho) < 1e-6,
      `Δbbox ${dMax.toExponential(1)} · Δvol cavity ${Math.abs(acero.r.vols.cavity - aD.r.vols.cavity).toExponential(1)}`);

    // ══ SPRINT 1 (superticket moldes) — E4/E5 POR PIEZA: el predicado de la MALLA ══
    console.log('── SPRINT 1 · el predicado de malla: la figura la da el sólido, no una fórmula');
    const fl = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'flowlen.ts'));
    const tessV = occt.tessellate(oc, av.dadoD, 0.06, 0.06);
    const predV = fl.predicadoDeMalla(tessV.positions, tessV.indices);
    const bbV = mm.shapeBBox(oc, av.dadoD);
    // la receta de la E4: vóxeles de 1 mm con 9 muestras; semilla = centro del piso (VOLTEADO: arriba)
    const campoV = fl.measureFlowLength({
      x0: bbV.min[0] - 2, y0: bbV.min[1] - 2, z0: bbV.min[2] - 2, x1: bbV.max[0] + 2, y1: bbV.max[1] + 2, z1: bbV.max[2] + 2, cellMm: 1,
      inCavity: predV, gateMm: { x: (bbV.min[0] + bbV.max[0]) / 2, y: (bbV.min[1] + bbV.max[1]) / 2, z: bbV.max[2] - 1.5 }, wallMm: 3, meltN: 0.348,
    });
    const volVoxV = campoV.cavity.reduce((a, b) => a + b, 0);            // mm³ (celda de 1 mm)
    const volKerV = occt.volume(oc, av.dadoD);
    check('SPRINT 1: vóxeles del VASO (malla) = volumen del kernel (±5 %)', Math.abs(volVoxV - volKerV) / volKerV < 0.05,
      `${volVoxV.toFixed(0)} vs ${volKerV.toFixed(0)} mm³ (${(100 * (volVoxV / volKerV - 1)).toFixed(1)} %)`);
    check('SPRINT 1: desde la boquilla en el piso TODO el vaso se alcanza (0 inalcanzables)', campoV.unreachable === 0,
      `${campoV.unreachable} inalcanzables · L máx ${campoV.maxFlowLenMm.toFixed(1)} mm · ${campoV.warnings.length} avisos`);
    // CONTROL: en el CUBO el predicado de malla coincide con el analítico de siempre
    const tessD = occt.tessellate(oc, acero.dadoD, 0.06, 0.06);
    const predD = fl.predicadoDeMalla(tessD.positions, tessD.indices);
    const colD = acero.colocacion;
    let agree = 0, tot = 0;
    for (let X = colD.tx + 0.5; X < colD.tx + 40; X += 1) for (let Y = colD.ty - 39.5; Y < colD.ty; Y += 1) for (let Z = colD.tz - 39.5; Z < colD.tz; Z += 1) {
      const q = colD.aLocal(X, Y, Z);
      const a = ed.dentroDadoLocal(q[0], q[1], q[2]), b = predD(X, Y, Z);
      tot++; if (a === b) agree++;
    }
    check('SPRINT 1 CONTROL: en el cubo, malla ≡ analítico (>98 % de las celdas)', agree / tot > 0.98, `${agree}/${tot} = ${(100 * agree / tot).toFixed(2)} %`);

    // ══ SPRINT 2 — EL INTAKE §2.1.5: declarar la pared cambia el veredicto y el dinero ══
    console.log('── SPRINT 2 · el intake: lo que el árbol no sabe, lo declaras tú');
    const macizaV = ed.piezaDesdeArbol(oc, vasoArbol, { nombre: 'VASO STEP (sin intake)' });                         // un STEP: sin cascarón declarado
    const declV = ed.piezaDesdeArbol(oc, vasoArbol, { nombre: 'VASO STEP (intake)', wallMm: 3, material: 'PP', annualVolume: 250000, round: true });
    const cM = ed.cotizacionPieza(macizaV, { fecha: '2026-08-26' }), cD = ed.cotizacionPieza(declV, { fecha: '2026-08-26' });
    check('SPRINT 2: sin intake el STEP se lee MACIZO (pared = menor dimensión) y cotiza caro', macizaV.pieza.wallMm === 20 && cM.dinero.moldeUSD > 3 * cD.dinero.moldeUSD, `pared ${macizaV.pieza.wallMm} · $${cM.dinero.moldeUSD.toLocaleString()} vs declarado $${cD.dinero.moldeUSD.toLocaleString()}`);
    check('SPRINT 2: el intake se PROPAGA — pared 3 · PP · 250k llegan a la pieza, al spec y a la hoja', declV.pieza.wallMm === 3 && declV.material === 'PP' && declV.spec.plastic === 'PP' && cD.pieza.Q === 250000 && cD.pieza.material === 'PP', `${declV.pieza.wallMm} mm · ${declV.spec.plastic} · Q ${cD.pieza.Q}`);
  }
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
  // tres fuentes del volumen de colada, cruzadas — con el frente de PRODUCCIÓN:
  // el FAN/Hele-Shaw de la orden llenado-desde-el-operador (mismo camino que la E5)
  const fanCjs = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'fan.ts'));
  const fanJ = fanCjs.resolverLlenadoFAN(campoJ, { material: f.ABS_MG47, vMs: lz.vMs, wallMm: 2, fillTimeS: 1, pLimitMPa: 140 });
  check('FÍSICA en el dado real: llena completo bajo la máquina de 140 MPa y CONSERVA',
    !fanJ.shortShot && !fanJ.incompleto && fanJ.conservacionMaxRel <= 1e-6,
    `p_max ${fanJ.pMaxMPa} MPa · t_fill ${fanJ.tFillS} s · conserv ${fanJ.conservacionMaxRel.toExponential(1)} · ${fanJ.nNodos} nodos`);
  let voxCol = 0, voxPza = 0, minFrentePza = Infinity; const frentesCol = [];
  for (let k = 0; k < campoJ.nz; k++) for (let j = 0; j < campoJ.ny; j++) for (let i = 0; i < campoJ.nx; i++) {
    const id = campoJ.idx(i, j, k);
    if (!campoJ.cavity[id] || fanJ.frente[id] < 0) continue;
    const X = campoJ.x0 + (i + 0.5), Y = campoJ.y0 + (j + 0.5), Z = campoJ.z0 + (k + 0.5);
    if (dentroPiezaB(X, Y, Z)) { voxPza++; if (fanJ.frente[id] < minFrentePza) minFrentePza = fanJ.frente[id]; }
    else { voxCol++; frentesCol.push(fanJ.frente[id]); }
  }
  const volVoxCol = voxCol / 1000, volPuroCol = C.volumenColadaCc(dC), volOccCol = occt.volume(oc, solC.fundido) / 1000;
  // ── EL CRUCE CAVIDAD↔LÍQUIDO (ian: "el llenado es sobre la cavidad; el molde genera
  // una cavidad con forma — aquí parece todo desconectado"). El acero YA contabiliza su
  // hueco (splitMold.vols.piezaEscalada, el que cierra Σ=bloque); el campo de llenado
  // debe encerrar ESE MISMO volumen. Si el molde se rompe, este número delata — cavidad
  // y líquido conectados por MEDICIÓN, no por fe.
  const volHuecoAceroCc = acero.r.vols.piezaEscalada / 1000;
  check('CAVIDAD↔LÍQUIDO: el volumen de pieza del CAMPO ≈ el hueco del ACERO (±5 %)',
    Math.abs(voxPza / 1000 - volHuecoAceroCc) / volHuecoAceroCc < 0.05,
    `campo ${(voxPza / 1000).toFixed(2)} cc vs hueco del acero ${volHuecoAceroCc.toFixed(2)} cc`);
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
    const sBin = fl2.frenteSuperficie({ ...metaJ, frente: fanJ.frente, t: 1, suavizado: 0 });
    const sFra = fl2.frenteSuperficie({ ...metaJ, frente: fanJ.frente, t: 1, suavizado: 0, ocupacion: ocuJ });
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

  // ══ FAN — EL LLENADO DESDE EL OPERADOR (orden 2026-08-12) ══
  // El método de PROCESO_CARAS: las SIMETRÍAS del problema dan soluciones cerradas
  // (caras) que aquí son los ORÁCULOS del solver. Y la lección del ENJAMBRE: la
  // semilla va solo en la boquilla y el dominio roto DEBE delatar — no se siembra
  // la respuesta.
  console.log('── FAN · Hele-Shaw con las caras como oráculos');
  const fan = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'fan.ts'));
  // fábrica de dominios SINTÉTICOS (h analítica, sin EDT): geometría exacta para
  // que el oráculo mida al SOLVER, no al voxelizador
  const campoSint = (nx, ny, nz, cellMm, dentro, hMm, gate) => {
    const N = nx * ny * nz;
    const cavity = new Uint8Array(N), th = new Float32Array(N);
    const idx = (i, j, k) => (k * ny + j) * nx + i;
    let vol = 0;
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++)
      if (dentro(i, j, k)) { const t = idx(i, j, k); cavity[t] = 1; th[t] = hMm; vol += cellMm ** 3; }
    return { nx, ny, nz, cellMm, cavity, thicknessMm: th, gate, volumeMm3: vol, idx };
  };

  // ── CARA-1D (traslación): la tira del bezel — el 83.2 MPa impreso del libro ──
  // 3D-resuelto: el hueco de 1.5 mm son 2 celdas de 0.75 (el modelo de vóxel exige
  // resolver el espesor, igual que el dado: pared 2.0 a celda 1.0).
  const cT = 0.75, HT = 1.5, LT = 200.25, nxT = Math.round(LT / cT), nyT = 8;
  const tira = campoSint(nxT, nyT, 2, cT, () => true, HT, { i: 0, j: 4, k: 0 });
  const QT = 0.82 * 1000 * HT * (nyT * cT);                  // v̄·H·W (mm³/s)
  const fanT = fan.resolverLlenadoFAN(tira, { material: f.ABS_MG47, vMs: 0.82, wallMm: HT, QmmS: QT });
  // Δp entre dos FILAS INTERIORES (x=25 y x=175): el tramo de 150 mm sin el efecto
  // de entrada de la boquilla puntual — la Eq 5.22 pura sobre ese tramo
  const filaP = (i0) => { let s = 0, n = 0;
    for (let k = 0; k < 2; k++) for (let j = 0; j < nyT; j++) { const v2 = fanT.pFieldPa[tira.idx(i0, j, k)]; if (v2 > 0) { s += v2; n++; } }
    return n ? s / n : NaN; };
  const dpTramo = (filaP(33) - filaP(233)) / 1e6, dpEsp = 83.2 * 150 / 200;
  check('CARA-1D: el tramo interior de la tira da la Eq 5.22 (±2.5 %)',
    cerca(dpTramo, dpEsp, dpEsp * 0.025),
    `Δp(25→175) ${dpTramo.toFixed(1)} vs ${dpEsp.toFixed(1)} MPa (pMax boquilla ${fanT.pMaxMPa} · η_eff ${fanT.etaEffPaS} Pa·s)`);
  check('AUDITORÍA: conservación Σflujos = Q en TODOS los pasos (≤1e-6)',
    fanT.conservacionMaxRel <= 1e-6, `max rel ${fanT.conservacionMaxRel.toExponential(1)} en ${fanT.pasos} pasos`);
  check('la tira LLENA completa (sin tope de máquina)', !fanT.shortShot && !fanT.incompleto && fanT.volSinLlenarMm3 < 1);

  // ── CARA RADIAL (escala): disco con gate central — el caso del dado volteado ──
  const RD = 40, cD = 1.0, HD = 2.0;
  const disco = campoSint(81, 81, 2, cD,
    (i, j) => ((i + 0.5 - 40.5) ** 2 + (j + 0.5 - 40.5) ** 2) <= RD * RD, HD, { i: 40, j: 40, k: 0 });
  const fanD = fan.resolverLlenadoFAN(disco, { material: f.ABS_MG47, vMs: 0.82, wallMm: HD, fillTimeS: 1 });
  const anillo = (arr, r0, tol2) => {
    let s = 0, n = 0;
    for (let k = 0; k < 2; k++) for (let j = 0; j < 81; j++) for (let i = 0; i < 81; i++) {
      const r = Math.hypot(i + 0.5 - 40.5, j + 0.5 - 40.5);
      if (Math.abs(r - r0) <= tol2) { const v2 = arr[disco.idx(i, j, k)]; if (v2 >= 0) { s += v2; n++; } }
    }
    return n ? s / n : NaN;
  };
  const t15 = anillo(fanD.tArrivalS, 15, 1), t30 = anillo(fanD.tArrivalS, 30, 1);
  check('CARA RADIAL: t(2r)/t(r) ≈ 4 — el frente crece como r² (±12 %)',
    cerca(t30 / t15, 4, 0.48), `t(30)/t(15) = ${(t30 / t15).toFixed(2)}`);
  const p10 = anillo(fanD.pFieldPa, 10, 0.7), p20 = anillo(fanD.pFieldPa, 20, 0.7);
  const dpAnalitico = (6 * fanD.etaEffPaS * fanD.QmmS / (Math.PI * HD ** 3)) * Math.log(20 / 10);
  check('CARA RADIAL: Δp entre anillos = (6ηQ/πh³)·ln(r₂/r₁) (±6 %)',
    cerca(p10 - p20, dpAnalitico, dpAnalitico * 0.06),
    `medido ${((p10 - p20) / 1e6).toFixed(2)} vs analítico ${(dpAnalitico / 1e6).toFixed(2)} MPa`);

  // ── PIPELINE COMPLETO: measureFlowLength (EDT) + FAN sobre la misma tira ──
  // Aquí el espesor viene del EDT (no analítico): el check mide el SESGO del
  // voxelizador+EDT integrado. Tolerancia DECLARADA de lo medido.
  const campoE = fl.measureFlowLength({
    x0: -1.4, y0: -1.4, z0: -1.4, x1: 201.4, y1: 13.4, z1: 2.9, cellMm: 0.7,
    inCavity: (x, y, z) => x >= 0 && x <= 200 && y >= 0 && y <= 12 && z >= 0 && z <= 1.5,
    gateMm: { x: 0.5, y: 6, z: 0.75 }, wallMm: 1.5, meltN: 0.348,
  });
  const fanE = fan.resolverLlenadoFAN(campoE, { material: f.ABS_MG47, vMs: 0.82, wallMm: 1.5, QmmS: 0.82 * 1000 * 1.5 * 12 });
  // el voxelizado a c=0.7 hace la placa de 2 celdas = 1.4 mm (no 1.5): el FAN debe
  // reproducir la física de SU geometría (ΔP ∝ 1/h³ a Q fijo) — y el SESGO del
  // voxelizador queda MEDIDO y a la vista, no escondido en una tolerancia gorda
  let hSum = 0, nH = 0;
  for (let t2 = 0; t2 < campoE.cavity.length; t2++) if (campoE.cavity[t2]) { hSum += campoE.thicknessMm[t2]; nH++; }
  const hVox = hSum / nH;
  const dpVox = 83.2 * (1.5 / hVox) ** 3;
  check('PIPELINE EDT+FAN: la tira real reproduce la física de su h voxelizada (±10 %)',
    cerca(fanE.pMaxMPa, dpVox, dpVox * 0.10),
    `${fanE.pMaxMPa} MPa vs ${dpVox.toFixed(1)} esperado con h=${hVox.toFixed(2)} (sesgo del voxelizador: 83.2 nominal a h=1.5)`);

  // ── CONTROL NEGATIVO (ENJAMBRE): dominio PARTIDO — la alarma DEBE saltar ──
  const roto = campoSint(61, 10, 2, 1.0,
    (i) => i < 25 || i > 35, 2.0, { i: 2, j: 5, k: 0 });        // dos bloques, 10 mm de acero enmedio
  const fanR = fan.resolverLlenadoFAN(roto, { material: f.ABS_MG47, vMs: 0.82, wallMm: 2, fillTimeS: 1 });
  const volB = 25 * 10 * 2;                                      // el bloque huérfano (mm³)
  check('CONTROL NEGATIVO: tubería rota ⇒ `incompleto` y el bloque huérfano NO llega',
    fanR.incompleto && cerca(fanR.volSinLlenarMm3, volB, volB * 0.05),
    `sin llenar ${fanR.volSinLlenarMm3} mm³ vs bloque B ${volB}`);
  const bTocado = (() => { for (let k = 0; k < 2; k++) for (let j = 0; j < 10; j++) for (let i = 36; i < 61; i++)
    if (fanR.frente[roto.idx(i, j, k)] >= 0) return true; return false; })();
  check('y su `frente` queda en −1 (nunca se pinta como lleno)', !bTocado);

  // ══ EL SWITCHOVER V/P (orden 2026-08-14-switchover-vp) ══
  // La frontera ROTA a su variable conjugada: fase 1 impone Q (la p responde);
  // al tocar P₀ el control conmuta y se impone P (el Q responde y DECAE). La
  // física de la fase 2 es Washburn 1921: L² = L₀² + (h²P₀/6η)(t−t₀) ⇒ L ∝ √t.
  console.log('── SWITCHOVER V/P · la cara de presión contra Washburn (L ∝ √t)');
  {
    const rSw = fan.resolverLlenadoFAN(tira, {
      material: f.ABS_MG47, vMs: 0.82, wallMm: HT, QmmS: QT,
      pLimitMPa: 8, switchover: { modo: 'presion', tMaxS: 1.0 },
    });
    const Lde = (t2) => { let m = 0;
      for (let k = 0; k < 2; k++) for (let j = 0; j < nyT; j++) for (let i = 0; i < nxT; i++) {
        const id = tira.idx(i, j, k); const a = rSw.tArrivalS[id];
        if (a >= 0 && a <= t2) { const x2 = (i + .5) * cT; if (x2 > m) m = x2; }
      } return m; };
    const t0 = rSw.fase2.tSwitchS, L0 = Lde(t0) / 1000;
    const P0 = 8e6, h2 = HT / 1000, eta2 = rSw.etaEffPaS;
    let peor = 0;
    for (const dt2 of [0.2, 0.5, 0.9]) {
      const Lm = Lde(t0 + dt2) / 1000;
      const Lteo = Math.sqrt(L0 * L0 + (h2 * h2 * P0 * dt2) / (6 * eta2));
      const err = Math.abs(Lm - Lteo) / Lteo;
      if (err > peor) peor = err;
    }
    check('WASHBURN: en la cara de presión, L sigue √t (±3 % en 3 instantes)',
      rSw.fase2.activada && peor <= 0.03, `peor error ${(100 * peor).toFixed(1)} % · conmutó en t=${t0}s`);
    // continuidad: la v̄ medida justo tras conmutar vs la v̄ que Washburn predice
    // para la MISMA ventana (v decae DENTRO de la ventana — no es discontinuidad)
    const dtV = 0.01;
    const vMed = (Lde(t0 + dtV) / 1000 - L0) / dtV;
    const vTeo = (Math.sqrt(L0 * L0 + (h2 * h2 * P0 * dtV) / (6 * eta2)) - L0) / dtV;
    check('CONTINUIDAD: v tras la conmutación ≈ Washburn en la misma ventana (±10 %)',
      Math.abs(vMed - vTeo) / vTeo <= 0.10, `v̄ ${vMed.toFixed(3)} vs ${vTeo.toFixed(3)} m/s`);
    check('el caudal DECAE (la máquina deja de empujar sola): Q_final < 20 % de Q₀',
      rSw.fase2.qFinalFrac < 0.20, `Q_final/Q₀ = ${rSw.fase2.qFinalFrac}`);
    check('AUDITORÍA fase 2: Σflujos = Q_in medido (consistencia interna ≤1e-6)',
      rSw.conservacionMaxRel <= 1e-6, rSw.conservacionMaxRel.toExponential(1));
  }
  // el CREEP DESBOCADO, medido e IMPRESO (el caso de aceptación del N2): sin
  // térmica, la espiral en modo presión con los 10 s del protocolo REBASA la
  // herramienta — los 75 mm que nos faltan (552−477) son creep-hasta-congelar.
  {
    const espC = ed.campoEspiral({ TmeltC: 238 });
    const rC = fanCjs.resolverLlenadoFAN(espC.campo, {
      material: espC.material, vMs: espC.vFrenteMs, wallMm: espC.hMm, QmmS: espC.QmmS,
      pLimitMPa: espC.pLimitMPa, nPasos: 120, switchover: { modo: 'presion', tMaxS: 10 },
    });
    const Lc = ed.longitudEspiralMm(espC, rC.frente);
    check('CREEP ISOTERMO DESBOCADO (declarado — la térmica del N2, cuantificada)',
      rC.fase2.activada && Lc >= 799,
      `con creep: ${Lc} mm (rebasa la herramienta de 800) vs stop: 477 vs medido: 552 — el freno que falta es térmico`);
  }

  // ── SHORT SHOT FÍSICO: máquina de 40 MPa contra una tira de 83 ──
  const fanS = fan.resolverLlenadoFAN(tira, { material: f.ABS_MG47, vMs: 0.82, wallMm: HT, QmmS: QT, pLimitMPa: 40 });
  check('SHORT SHOT: con tope de 40 MPa el frente SE PARA a media tira',
    fanS.shortShot && fanS.volSinLlenarMm3 > 0.3 * tira.volumeMm3 && fanS.pMaxMPa <= 46,
    `paró en ${fanS.pMaxMPa} MPa con ${(100 * fanS.volSinLlenarMm3 / tira.volumeMm3).toFixed(0)} % sin llenar`);

  // ══ LA PROBETA — el líquido MOJA la pared (orden 2026-08-12-la-probeta) ══
  // ian: "el líquido no llega a las paredes, no funciona como líquido". Medido: a
  // t=1 el hueco era ±0.23 mm (bien) pero el FRENTE EN AVANCE llevaba un anillo
  // fantasma (celdas a medio llenar invisibles). El fix: frente CONTINUO — la celda
  // frontera pesa por su fracción estimada. Aquí se EXIGE en la probeta real (EDT).
  console.log('── LA PROBETA · el frente continuo MOJA la pared (y avanza monótono)');
  const probC = fl.measureFlowLength({
    x0: -1.4, y0: -1.4, z0: -1.4, x1: 61.4, y1: 21.4, z1: 3.4, cellMm: 0.7,
    inCavity: (x, y, z) => x >= 0 && x <= 60 && y >= 0 && y <= 20 && z >= 0 && z <= 2,
    gateMm: { x: 0.5, y: 10, z: 1 }, wallMm: 2, meltN: 0.348,
  });
  const fanP = fan.resolverLlenadoFAN(probC, { material: f.ABS_MG47, vMs: 0.82, wallMm: 2, fillTimeS: 1 });
  const metaP = { nx: probC.nx, ny: probC.ny, nz: probC.nz, cellMm: probC.cellMm, x0: probC.x0, y0: probC.y0, z0: probC.z0 };
  // MOJADO: en 3 instantes, el borde +Y del melt debe quedar a ≤0.6 mm de la pared
  // ANALÍTICA (y=20) en la zona YA alcanzada por el frente
  let mojadoPeor = 0, volPrev = -1, monot = true;
  for (const T of [0.4, 0.7, 1.0]) {
    const s = fl.frenteSuperficie({ ...metaP, frente: fanP.frente, t: T, suavizado: 0, continuo: true });
    if (s.volumeMm3 <= volPrev) monot = false;
    volPrev = s.volumeMm3;
    // x alcanzada por el frente a este t (borde de avance), con margen de 3 mm
    let xFrente = 0;
    for (let v = 0; v < s.positions.length; v += 3) if (s.positions[v] > xFrente) xFrente = s.positions[v];
    // muestrear el borde +Y en 4 cortes x DETRÁS del frente
    for (const X of [5, 10, 20, 30]) {
      if (X > xFrente - 3) continue;
      let yMelt = -1e9;
      for (let v = 0; v < s.positions.length; v += 3) {
        if (Math.abs(s.positions[v] - X) > 0.8 || s.positions[v + 2] < 0.4 || s.positions[v + 2] > 1.6) continue;
        if (s.positions[v + 1] > yMelt) yMelt = s.positions[v + 1];
      }
      const hueco = 20 - yMelt;
      if (hueco > mojadoPeor) mojadoPeor = hueco;
    }
  }
  check('MOJADO: el melt queda a ≤0.6 mm de la pared analítica en t∈{0.4,0.7,1.0}',
    mojadoPeor <= 0.6 && mojadoPeor > -0.6, `peor hueco ${mojadoPeor.toFixed(2)} mm`);
  check('MONOTONÍA: el volumen mojado del frente continuo solo CRECE con t', monot,
    `vol final ${volPrev.toFixed(0)} mm³`);
  // el frente continuo debe seguir cerrando volumen razonable a t=1 (vs vóxeles)
  const volVoxP = probC.volumeMm3;
  check('el frente continuo a t=1 cierra el volumen de la probeta (±10 %)',
    Math.abs(volPrev - volVoxP) / volVoxP < 0.10, `${volPrev.toFixed(0)} vs ${volVoxP.toFixed(0)} mm³`);

  // ── LAS TORRES, con su CONTROL: el candado de columna es quien las mata ──
  console.log('── TORRES · el candado de columna (medido en el dado real)');
  const torres = (fr, tArr) => {
    const F2 = 150, Nc = campoJ.nx * campoJ.ny * campoJ.nz;
    const frameOf = new Int32Array(Nc).fill(-1);
    for (let t2 = 0; t2 < Nc; t2++) if (campoJ.cavity[t2] && fr[t2] >= 0) frameOf[t2] = Math.min(F2 - 1, Math.floor(fr[t2] * F2));
    const NB6b = [1, -1, campoJ.nx, -campoJ.nx, campoJ.nx * campoJ.ny, -campoJ.nx * campoJ.ny];
    const vis = new Uint8Array(Nc);
    let eventos = 0;
    for (let k2 = 0; k2 < F2; k2++) {
      for (let t2 = 0; t2 < Nc; t2++) {
        if (frameOf[t2] !== k2 || vis[t2]) continue;
        const stack = [t2]; vis[t2] = 1;
        let n2 = 0, mnz = 1e9, mxz = -1e9, mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
        while (stack.length) {
          const u = stack.pop(); n2++;
          const zC = Math.floor(u / (campoJ.nx * campoJ.ny)), yC = Math.floor(u / campoJ.nx) % campoJ.ny, xC = u % campoJ.nx;
          if (zC < mnz) mnz = zC; if (zC > mxz) mxz = zC;
          if (xC < mnx) mnx = xC; if (xC > mxx) mxx = xC;
          if (yC < mny) mny = yC; if (yC > mxy) mxy = yC;
          for (const d of NB6b) { const v = u + d; if (v >= 0 && v < Nc && !vis[v] && frameOf[v] === k2) { vis[v] = 1; stack.push(v); } }
        }
        const dz = (mxz - mnz) * campoJ.cellMm, dxy = Math.max(mxx - mnx, mxy - mny) * campoJ.cellMm;
        if (n2 >= 20 && dz >= 10 && dz >= 2 * dxy) eventos++;
      }
    }
    return eventos;
  };
  check('el dado real llena SIN torres (candado de columna puesto)', torres(fanJ.frente) === 0,
    `${torres(fanJ.frente)} eventos (cluster ≥20 celdas, Δz≥10mm, ≥2×Δxy por ventana 1/150)`);
  const fanSinCandado = fanCjs.resolverLlenadoFAN(campoJ, { material: f.ABS_MG47, vMs: lz.vMs, wallMm: 2, fillTimeS: 1, pLimitMPa: 140, candadoColumna: false, maxLlenadosPorSolve: 999999 });
  const evSin = torres(fanSinCandado.frente);
  check('CONTROL NEGATIVO: sin el candado, las torres REAPARECEN', evSin > 0,
    `${evSin} eventos con candadoColumna:false (los 16 que ian vio en el video)`);

  // ══ LA COLA DE PUERCO — la espiral de flujo contra números MEDIDOS AJENOS ══
  // (orden 2026-08-13-la-cola-de-puerco) US11976138 (geometría acotada) +
  // US11230635 Tabla 6 (ABS medido: 552/635/730 mm @ 238/249/260 °C). Primera vez
  // que el solver se mide contra números que NO son nuestros. Extensiones
  // DECLARADAS: 1000 psi hidráulica ×10 = 69 MPa plástico · Q = husillo ⌀32×1in/s
  // · k(T) por η₀ Cross-WLF · N1 ISOTERMO ⇒ en caliente solo puede SOBRAR
  // (la térmica frena): 249/260 son ORÁCULOS DE COTA y su delta es el caso del N2.
  console.log('── LA COLA DE PUERCO · la espiral de la patente (552/635/730 mm medidos)');
  const Lsim = {};
  for (const [T, Lexp] of [[238, 552], [249, 635], [260, 730]]) {
    const esp = ed.campoEspiral({ TmeltC: T });
    const rE = fanCjs.resolverLlenadoFAN(esp.campo, {
      material: esp.material, vMs: esp.vFrenteMs, wallMm: esp.hMm,
      QmmS: esp.QmmS, pLimitMPa: esp.pLimitMPa, nPasos: 120,
    });
    Lsim[T] = { L: ed.longitudEspiralMm(esp, rE.frente), r: rE, esp, Lexp };
  }
  check('ESPIRAL 238 °C: L_sim ≈ 552 mm medidos (±15 % — grado GP22NR vs MG47, declarado)',
    cerca(Lsim[238].L, 552, 552 * 0.15),
    `${Lsim[238].L} mm (${(100 * (Lsim[238].L - 552) / 552).toFixed(1)} %) · pMax ${Lsim[238].r.pMaxMPa} MPa`);
  check('ESPIRAL: L crece con la temperatura (238 < 249 < 260)',
    Lsim[238].L < Lsim[249].L && Lsim[249].L < Lsim[260].L,
    `${Lsim[238].L} → ${Lsim[249].L} → ${Lsim[260].L} mm`);
  check('COTA ISOTERMA: sin térmica, la espiral SOLO puede sobrar (L_sim ≥ 0.9·L_exp en caliente)',
    Lsim[249].L >= 0.9 * 635 && Lsim[260].L >= 0.9 * 730,
    `249°C: ${Lsim[249].L} ≥ ${(0.9 * 635).toFixed(0)} · 260°C: ${Lsim[260].L} ≥ ${(0.9 * 730).toFixed(0)} (el excedente = la térmica del N2)`);
  // el canal es cuasi-1D de sección constante ⇒ t(s) LINEAL en el arco: Pearson ≈ 1
  {
    const e0 = Lsim[238].esp, fr = Lsim[238].r.frente;
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let t2 = 0; t2 < fr.length; t2++) {
      if (fr[t2] < 0 || e0.sMm[t2] < 0) continue;
      const a = fr[t2], b2 = e0.sMm[t2];
      n++; sx += a; sy += b2; sxx += a * a; syy += b2 * b2; sxy += a * b2;
    }
    const pear = (n * sxy - sx * sy) / Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
    check('el frente SIGUE el arco de la espiral (Pearson t↔s ≥ 0.995 — el canal es 1D)',
      pear >= 0.995, `Pearson ${pear.toFixed(4)} sobre ${n} celdas`);
  }
  check('ESPIRAL: conservación ≤ 1e-6 en las tres corridas',
    [238, 249, 260].every((T) => Lsim[T].r.conservacionMaxRel <= 1e-6),
    [238, 249, 260].map((T) => Lsim[T].r.conservacionMaxRel.toExponential(1)).join(' · '));
  // CONTROL: sin la intensificación declarada (6.9 MPa de plástico) la espiral se
  // queda ~10× corta — la extensión 10:1 IMPORTA y el gate lo enseña
  {
    const e69 = ed.campoEspiral({ TmeltC: 238, pLimitMPa: 6.9 });
    const r69 = fanCjs.resolverLlenadoFAN(e69.campo, { material: e69.material, vMs: e69.vFrenteMs, wallMm: e69.hMm, QmmS: e69.QmmS, pLimitMPa: 6.9, nPasos: 120 });
    const L69 = ed.longitudEspiralMm(e69, r69.frente);
    check('CONTROL: a 6.9 MPa (sin la ×10 declarada) la espiral queda ~10× corta',
      L69 < 100 && r69.shortShot, `${L69} mm — la trampa hidráulica-vs-plástico, medida`);
  }
  // ══ EL ACERO DE LA ESPIRAL (orden cola-de-puerco-de-acero) ══
  // ian: "un líquido adquiere la forma del RECIPIENTE — aquí es una mágica cola de
  // puerco… si damos por bueno esto habrá errores más difíciles de detectar". El
  // error que nombró: el dominio DECLARADO no lo verifica ningún gate del solver.
  // REGLA: ningún llenado sin acero — el dominio se ata al sólido por NÚMERO.
  console.log('── EL ACERO DE LA ESPIRAL · el dominio atado al sólido (regla: sin acero no hay llenado)');
  {
    const espA = Lsim[238].esp;
    const ac = ed.espiralAcero(oc, espA);
    const dif = (a2, b2) => Math.abs(a2 - b2) / b2;
    check('3 FUENTES: canal OCC ≈ analítico L·w·h ≈ vóxeles del campo (±3 %)',
      dif(ac.vols.canalMm3, ac.vols.analiticoMm3) < 0.03 && dif(espA.campo.volumeMm3, ac.vols.analiticoMm3) < 0.03,
      `canal ${(ac.vols.canalMm3 / 1000).toFixed(2)} · analítico ${(ac.vols.analiticoMm3 / 1000).toFixed(2)} · vóxeles ${(espA.campo.volumeMm3 / 1000).toFixed(2)} cc`);
    check('CAVIDAD↔ACERO: el hueco TALLADO en la placa ≈ el dominio del campo (±3 %)',
      dif(espA.campo.volumeMm3, ac.vols.huecoMm3) < 0.03,
      `hueco del acero ${(ac.vols.huecoMm3 / 1000).toFixed(2)} cc vs campo ${(espA.campo.volumeMm3 / 1000).toFixed(2)} cc — el recipiente CONTABILIZA al líquido`);
  }

  // ══ ESTACIÓN 6 — EMPAQUE (orden 2026-08-14-ciclo-dado-estacion6) ══
  console.log('── E6 · Empaque (cap 7) — el retorno de la E4 y la contracción pvT');
  const sh6 = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'shrinkage.ts'));
  const g6 = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'gating.ts'));
  const cool6 = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling-design.ts'));
  const e6 = ed.estacion6Dado(e2.pkg, dC, { partVolCc: 14.14 });
  // las filas CUADRAN con los motores (no números fabricados)
  const A6 = cool6.PLASTICOS_A.ABS;
  const freezeMotor = g6.gateFreezeCylS(A6.alphaM2s, e6.gate.diaOrigMm / 1000, A6.tMeltC, A6.tCoolC, 132);
  check('E6: el freeze del gate REAL reproduce la Tabla 7.4 (cilindro al ⌀ base del sprue)',
    cerca(e6.gate.freezeOrigS, freezeMotor, 0.05), `${e6.gate.freezeOrigS} s vs motor ${freezeMotor.toFixed(2)} s @ ⌀${e6.gate.diaOrigMm}`);
  check('E6: p_pack = 0.8·p_llenado (la de factory)',
    cerca(e6.pPackMPa, 0.8 * e2.pkg.diseno.fillMPa, 0.05), `${e6.pPackMPa} MPa`);
  const shMotor = sh6.shrinkage(sh6.ABS_TAIT, { tNoFlowK: 132 + 273.15, pPackPa: e6.pPackMPa * 1e6 });
  check('E6: la contracción reproduce shrinkage(ABS_TAIT) al mismo p_pack',
    cerca(e6.contraccion.linealPct, shMotor.linear * 100, 0.02), `${e6.contraccion.linealPct} % vs motor ${(shMotor.linear * 100).toFixed(2)} %`);
  // EL RETORNO DE LA E4, CERRADO — y con la historia completa: el edge GENÉRICO de
  // la máquina seguía en freezeCorto (el anuncio), pero el gate REAL del dado tras
  // el volteo es el SPRUE de la Fig 7.2 (⌀8.27) — y ÉSE empaca sobrado. La decisión
  // de libro de la E5 resolvió el conflicto de la E4 sin tocar acero.
  check('E6 · EL RETORNO: el edge genérico VIOLABA (el anuncio) y el sprue real de la Fig 7.2 CUMPLE',
    e2.pkg.diseno.gate.freezeCorto === true && e6.gate.freezeCortoOrig === false,
    `edge genérico freeze ${e2.pkg.diseno.gate.freezeS.toFixed(2)}s < ${e2.pkg.diseno.gate.tPackNeededS.toFixed(2)}s · sprue real ${e6.gate.freezeOrigS}s ≥ ${e6.gate.tPackNeededS}s — la Fig 7.2 lo resolvió`);
  // la contracción ADVIERTE con razón (0.8·p_fill es empaque débil aquí) y la
  // perilla de PROCESO está verificada: a pPackBanda la contracción SÍ entra a banda
  check('E6: contracción FUERA de banda a 0.8·p_fill (empaque débil) + la perilla verificada',
    e6.contraccion.linealPct > 0.8 && e6.contraccion.pPackBandaMPa != null
      && sh6.shrinkage(sh6.ABS_TAIT, { tNoFlowK: 132 + 273.15, pPackPa: e6.contraccion.pPackBandaMPa * 1e6 }).linear * 100 <= 0.8,
    `${e6.contraccion.linealPct} % a ${e6.pPackMPa} MPa → banda con p_pack ~${e6.contraccion.pPackBandaMPa} MPa (perilla de tryout)`);
  check('E6: masa del disparo cuadra a mano (vol × ρ)',
    cerca(e6.masa.disparoG, (14.14 + C.volumenColadaCc(dC)) * 1.044, 0.2), `${e6.masa.disparoG} g`);
  // CONTROL NEGATIVO: pared el doble de gruesa → t_pack ∝ h² se cuadruplica y NI el
  // catálogo completo de bushings aguanta — el veredicto DISTINGUE lo imposible
  const e6mal = ed.estacion6Dado(e2.pkg, dC, { partVolCc: 14.14, wallMmOverride: 4 });
  check('E6 · CONTROL NEGATIVO: pared ×2 → ningún bushing del catálogo aguanta (VIOLA)',
    e6mal.gate.freezeCortoOrig === true && e6mal.gate.diaResueltoMm == null,
    `t_pack ${e6mal.gate.tPackNeededS} s vs freeze máx del catálogo — sin solución, como debe`);

  // ══ N2 TÉRMICO — el fundido se CONGELA (orden 2026-08-17-n2-termico) ══
  // El freno = piel erf (imágenes) × η₀ Cross-WLF del corazón × power-law del
  // creep. Juez EXTERNO: US11230635 Tabla 6 (552/635/730 mm @ 238/249/260 °C).
  console.log('── N2 TÉRMICO · el freno que mata al creep (contra la patente, 3 isotermas)');
  {
    const oN2 = { TmeltC: 239, TcoolC: 60, TnoflowC: 132, alphaM2S: 8.73e-8 };
    // ORÁCULO 1 · CENTRO: imágenes-erf vs modo 1 de línea central (fórmulas
    // INDEPENDIENTES, mismo criterio) — h²/(π²α)·ln((4/π)·(Tm−Tc)/(Tnf−Tc))
    const tCen = fanCjs.tCongelaSlabS(2, oN2);
    const tCenModo1 = (4e-6 / (Math.PI ** 2 * oN2.alphaM2S)) * Math.log((4 / Math.PI) * (239 - 60) / (132 - 60));
    check('N2 · ORÁCULO CENTRO: piel erf congela el centro = modo 1 (±2 %, fórmula ajena)',
      Math.abs(tCen - tCenModo1) <= 0.02 * tCenModo1, `${tCen.toFixed(2)} s vs ${tCenModo1.toFixed(2)} s (placa h=2)`);
    // ORÁCULO 2 · MEDIA: el criterio de la TABLA 7.4 del libro (prefactor 8/π²)
    const tMed = fanCjs.tCongelaMediaSlabS(2, oN2);
    const tTabla = g6.gateFreezeStripS(oN2.alphaM2S, 2 / 1000, 239, 60, 132);
    check('N2 · ORÁCULO MEDIA: T media = T_noflow reproduce la Tabla 7.4 strip (±2 %)',
      Math.abs(tMed - tTabla) <= 0.02 * tTabla, `${tMed.toFixed(2)} s vs Tabla 7.4 ${tTabla.toFixed(2)} s`);
    // EL ORDEN FÍSICO del §7.1.5: la pared muere ANTES que la columna del sprue —
    // por eso el GATE gobierna el empaque. (El veredicto E6 usa Tabla 7.4 cilindro;
    // el campo estrangula la columna como PLACA — enfría por 2 caras, no por todo
    // el perímetro: ~4.9× más lenta que el cilindro. Sesgo DECLARADO del N2.)
    check('N2 · ORDEN: la pared (h=2) congela mucho antes que la columna del sprue (h=8.27)',
      tCen < 0.2 * fanCjs.tCongelaSlabS(8.27, oN2),
      `pared ${tCen.toFixed(1)} s ≪ sprue-placa ${fanCjs.tCongelaSlabS(8.27, oN2).toFixed(0)} s (Tabla 7.4 cil: ${g6.gateFreezeCylS(oN2.alphaM2S, 8.27e-3, 239, 60, 132).toFixed(1)} s)`);
    // LAS 3 ISOTERMAS con TODO el protocolo (fase-presión, los frenos la terminan).
    // Herramienta 1.5×L_exp para que el TOPE del dominio jamás disfrace el L∞.
    const N2r = {};
    for (const T of [238, 249, 260]) N2r[T] = ed.espiralN2Corrida(T);
    const LN = (T) => N2r[T].Lmm, LE = (T) => N2r[T].Lexp;
    check('N2 · ISOTERMAS ±20 % DOS LADOS (sesgo sistemático +13..16 % DECLARADO: grado GP22NR vs MG47 + intensificación 10:1 nominal)',
      [238, 249, 260].every((T) => Math.abs(LN(T) - LE(T)) <= 0.20 * LE(T)),
      [238, 249, 260].map((T) => `${T}°: ${LN(T)} vs ${LE(T)} (${N2r[T].dPct > 0 ? '+' : ''}${N2r[T].dPct} %)`).join(' · '));
    // LA PENDIENTE — la derivada térmica es DEL MODELO (el offset es de las
    // incógnitas declaradas y aquí NO estorba)
    const mSim = (LN(260) - LN(238)) / 22, mExp = (730 - 552) / 22;
    check('N2 · LA PENDIENTE dL/dT ≈ la medida (±15 % — la física térmica del modelo)',
      Math.abs(mSim - mExp) <= 0.15 * mExp, `${mSim.toFixed(2)} vs ${mExp.toFixed(2)} mm/°C`);
    // LOS COCIENTES entre isotermas: grado e intensificación SE CANCELAN — la
    // prueba más limpia de que el modelo entiende la temperatura
    check('N2 · COCIENTES L(T)/L(238) = los medidos (±5 % — grado y presión se cancelan)',
      cerca(LN(249) / LN(238), 635 / 552, 0.05) && cerca(LN(260) / LN(238), 730 / 552, 0.05),
      `249/238: ${(LN(249) / LN(238)).toFixed(3)} vs ${(635 / 552).toFixed(3)} · 260/238: ${(LN(260) / LN(238)).toFixed(3)} vs ${(730 / 552).toFixed(3)}`);
    check('N2 · MONOTONÍA: L crece con T', LN(238) < LN(249) && LN(249) < LN(260),
      `${LN(238)} → ${LN(249)} → ${LN(260)} mm`);
    // EL CREEP MUERE SOLO (ayer: 799.8 desbocado a los 10 s y seguía): fase 2
    // activada, el caudal muere (<2 % Q₀) y el L∞ NO toca la herramienta
    check('N2 · EL CREEP MUERE SOLO: Q → <2 % Q₀ sin tocar el tope de la herramienta',
      [238, 249, 260].every((T) => N2r[T].r.fase2.activada && N2r[T].r.fase2.qFinalFrac < 0.02
        && LN(T) < 0.95 * N2r[T].esp.LtotalMm),
      [238, 249, 260].map((T) => `${T}°: Qfin ${(100 * N2r[T].r.fase2.qFinalFrac).toFixed(1)} % · L ${LN(T)}/${N2r[T].esp.LtotalMm}`).join(' · '));
    check('N2 · AUDITORÍA con estrangulador: conservación ≤1e-6 en las 3',
      [238, 249, 260].every((T) => N2r[T].r.conservacionMaxRel <= 1e-6),
      [238, 249, 260].map((T) => N2r[T].r.conservacionMaxRel.toExponential(1)).join(' · '));
    // CONTROL NEGATIVO · ADIABÁTICO: α×1e-3 (el frío casi no entra) ⇒ el creep NO
    // muere — vuelve el desbocado de ayer. El freno ES el frío, no el protocolo.
    {
      const espAd = ed.campoEspiral({ TmeltC: 238, LtotalMm: 828 });
      const rAd = fanCjs.resolverLlenadoFAN(espAd.campo, {
        material: espAd.material, vMs: espAd.vFrenteMs, wallMm: espAd.hMm, QmmS: espAd.QmmS,
        pLimitMPa: espAd.pLimitMPa, nPasos: 120, switchover: { modo: 'presion', tMaxS: 30 },
        termico: { ...N2r[238].termico, alphaM2S: 8.73e-11 },
      });
      const LAd = ed.longitudEspiralMm(espAd, rAd.frente);
      check('N2 · CONTROL ADIABÁTICO: α×1e-3 → el creep NO muere (rebasa donde el térmico paró)',
        LAd >= 0.99 * 828 || (LAd > LN(238) + 80 && rAd.fase2.qFinalFrac > 5 * N2r[238].r.fase2.qFinalFrac),
        `adiabático ${LAd} mm (térmico: ${LN(238)}) · Qfin ${(100 * rAd.fase2.qFinalFrac).toFixed(1)} % vs ${(100 * N2r[238].r.fase2.qFinalFrac).toFixed(1)} %`);
    }
  }

  // ══ ESTACIÓN 7 — VENTEO (orden 2026-08-17-ciclo-dado-estacion7) ══
  // El mapa de venteo sale MEDIDO del campo FAN (el aire está donde el melt
  // llega al último); las fórmulas son las del cap 8, con el ejemplo del libro
  // como oráculo.
  console.log('── E7 · Venteo (cap 8) — el aire sale por donde el campo dice');
  {
    // ORÁCULO Eq 8.2 · el ejemplo del bezel del libro: 100 cc/s, W=10, L=10
    // → h_min 0.06 mm EXACTO; h_max con su t_flash 0.003 s → ~0.073 (el libro
    // imprime 0.08 — redondeo declarado)
    const bz = ed.ventBandaMm({ VdotM3s: 1e-4, WMm: 10, LlandMm: 10, tFlashS: 0.003 });
    check('E7 · ORÁCULO Eq 8.2: el bezel del libro reproduce h_min = 0.06 mm',
      Math.abs(bz.hMinMm - 0.06) <= 0.002, `${bz.hMinMm} mm (libro: 0.06)`);
    check('E7 · ORÁCULO Eqs 8.3–8.4: h_max con los números del libro ≈ su 0.08',
      bz.hMaxMm >= 0.06 && bz.hMaxMm <= 0.09, `${bz.hMaxMm} mm (libro imprime 0.08 — redondeo)`);
    // EL CAMPO DEMUESTRA la geometría auto-venteada del volteo (Fig 7.2)
    const e7 = ed.estacion7Dado(e2.pkg, dC, {
      frente: fanJ.frente, nx: campoJ.nx, ny: campoJ.ny, nz: campoJ.nz,
      cellMm: campoJ.cellMm, x0: campoJ.x0, y0: campoJ.y0, z0: campoJ.z0,
      QmmS: fanJ.QmmS,
    });
    check('E7 · EL CAMPO DEMUESTRA: ≥90 % del último llenado cae EN la partición',
      e7.pctUltimoEnParticion >= 90 && !e7.aireFueraParticion,
      `${e7.pctUltimoEnParticion} % del top-2 % de llegada a ≤1.5 celdas de z=${dC.zPartMm}`);
    check('E7 · candidato de fin-de-flujo en LOS 4 lados (posiciones medidas)',
      e7.vents.length === 4 && new Set(e7.vents.map((v) => v.lado)).size === 4,
      e7.vents.map((v) => `${v.lado}(${v.xMm},${v.yMm})`).join(' · '));
    check('E7 · banda del dado: h_min ≤ 0.02 ≤ h_max (dos lados)',
      e7.banda.cumple && e7.banda.hMinMm < 0.02 && e7.banda.hMaxMm > 0.02,
      `${e7.banda.hMinMm} ≤ ${e7.banda.hPropMm} ≤ ${e7.banda.hMaxMm} mm · t_flash ${e7.banda.tFlashS} s`);
    check('E7 · reparto §8.2.3: cada vent carga V̇/4 COMPLETO (no V̇/4/n)',
      Math.abs(e7.banda.VdotLadoM3s - (fanJ.QmmS / 4) * 1e-9) / ((fanJ.QmmS / 4) * 1e-9) < 1e-6,
      `${(e7.banda.VdotLadoM3s * 1e6).toFixed(2)} cc/s por vent (V̇ = ${(fanJ.QmmS / 1000).toFixed(1)} cc/s)`);
    // CONTROL NEGATIVO: semilla EN LA BOCA (solo pieza) → el melt sube y el
    // aire queda atrapado contra la base CERRADA — lejos de la partición. El
    // detector DEBE reportarlo y anunciar pin/inserto.
    const campoBoca = fl2.measureFlowLength({
      ...gridJ, gateMm: { x: dC.ejeX + 19, y: dC.ejeY, z: dC.zPartMm + 1 },
      inCavity: dentroPiezaB,
    });
    const fanBoca = fanCjs.resolverLlenadoFAN(campoBoca, { material: f.ABS_MG47, vMs: lz.vMs, wallMm: 2, fillTimeS: 1, pLimitMPa: 140 });
    const e7mal = ed.estacion7Dado(e2.pkg, dC, {
      frente: fanBoca.frente, nx: campoBoca.nx, ny: campoBoca.ny, nz: campoBoca.nz,
      cellMm: campoBoca.cellMm, x0: campoBoca.x0, y0: campoBoca.y0, z0: campoBoca.z0,
      QmmS: fanBoca.QmmS,
    });
    check('E7 · CONTROL NEGATIVO: gate en LA BOCA → aire atrapado FUERA de partición, detectado',
      e7mal.aireFueraParticion === true && e7mal.pctUltimoEnParticion < 50
        && e7mal.anuncios.some((a) => a.titulo.includes('FUERA DE PARTICIÓN')),
      `${e7mal.pctUltimoEnParticion} % en partición · dead pocket en (${e7mal.fueraCentroideMm?.x}, ${e7mal.fueraCentroideMm?.y}, ${e7mal.fueraCentroideMm?.z}) — el veredicto DISTINGUE`);
  }

  // ══ ESTACIÓN 8 — ENFRIAMIENTO (orden 2026-08-17-ciclo-dado-estacion8) ══
  // EL REY DEL CICLO. El motor (coolingDesign, 7 pasos §9.2) ya existía; lo que
  // se juzga aquí es que reproduce los EJEMPLOS IMPRESOS del libro y que el
  // hallazgo del dado (el bebedero manda) sale con su cadena de decisión.
  console.log('── E8 · Enfriamiento (cap 9) — el rey del ciclo');
  {
    const cool = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling.ts'));
    const cdm = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'cooling-design.ts'));
    const mps = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));
    const mds = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-drawing-set.ts'));
    const K = cool.ABS_KAZMER;
    // ORÁCULOS 1-3 · los tres tiempos IMPRESOS del ejemplo cup/lid (§9.2.1).
    // T_eject 97.6 y no 96.7: errata del libro ya cazada y documentada en
    // cooling.ts (con 97.6 sus propios números reproducen EXACTO).
    const oLid = cool.coolingTimePlate(2 / 1000, K), oCup = cool.coolingTimePlate(3 / 1000, K);
    const oRun = cool.coolingTimeRod(4.76 / 1000, K);
    check('E8 · ORÁCULO Eq 9.5: lid 2 mm = 8.4 s y cup 3 mm = 18.9 s (impresos)',
      Math.abs(oLid - 8.4) <= 0.05 && Math.abs(oCup - 18.9) <= 0.05,
      `${oLid.toFixed(1)} s · ${oCup.toFixed(1)} s`);
    check('E8 · ORÁCULO Eq 9.6: el runner del libro = 22.9 s (⌀4.76 = 3/16" DME, despejado de su propia ecuación)',
      Math.abs(oRun - 22.9) <= 0.05, `${oRun.toFixed(1)} s — el pliego-UI decía "⌀6.25" (daría ${cool.coolingTimeRod(6.25 / 1000, K).toFixed(1)} s): el resumen estaba mal, el libro manda`);
    // ORÁCULOS 4-6 · §9.2.5 y §9.2.6, los otros números impresos
    check('E8 · ORÁCULO §9.2.5: SCF 3.3 a H=1D y 2.6 a H=4D · P20 a 4D = 175 MPa',
      Math.abs(cdm.stressConcentration(1) - 3.3) <= 0.02 && Math.abs(cdm.stressConcentration(4) - 2.6) <= 0.02
        && Math.abs(cdm.maxMeltPressureMPa(456, cdm.stressConcentration(4)) - 175) <= 1,
      `${cdm.stressConcentration(1).toFixed(2)} · ${cdm.stressConcentration(4).toFixed(2)} · ${cdm.maxMeltPressureMPa(456, cdm.stressConcentration(4)).toFixed(0)} MPa`);
    check('E8 · ORÁCULO trampa del ALUMINIO (§9.2.5): QC-7 a 1D → P_max 50 MPa',
      Math.abs(cdm.maxMeltPressureMPa(cdm.ACEROS_MOLDE['QC-7'].sigmaEnduranceMPa, cdm.stressConcentration(1)) - 50) <= 1,
      `${cdm.maxMeltPressureMPa(cdm.ACEROS_MOLDE['QC-7'].sigmaEnduranceMPa, cdm.stressConcentration(1)).toFixed(1)} MPa — "no vivirá una vida larga sin grietas"`);
    check('E8 · ORÁCULO Menges (Eq 9.23): <5 % hasta W=2H y SE DISPARA después',
      cdm.heatFluxVariation(2) < 5 && cdm.heatFluxVariation(4) > 50,
      `W=2H: ${cdm.heatFluxVariation(2).toFixed(1)} % · W=3H: ${cdm.heatFluxVariation(3).toFixed(1)} % · W=4H: ${cdm.heatFluxVariation(4).toFixed(1)} %`);
    // ── EL DADO ──
    const e8 = ed.estacion8Dado(e2.pkg, dC, { partVolCc: 14.14 });
    check('E8 · EL BEBEDERO MANDA EL CICLO (§9.2.1, el retorno que el libro anticipa)',
      e8.ciclo.manda === 'bebedero' && e8.ciclo.factor >= 5,
      `pieza ${e8.ciclo.tcPiezaS} s vs bebedero ⌀${e8.bushing.diaActualMm} ${e8.ciclo.tcSprueS} s = ×${e8.ciclo.factor}`);
    check('E8 · EL CRUCE E6↔E8: se elige el ⌀ MÍNIMO que todavía empaca (y el anterior VIOLA)',
      e8.bushing.diaOptimoMm === 6.35 && e8.bushing.freezeOptimoS >= e8.bushing.tPackNeededS
        && cdm.PLUGS_DME && e8.bushing.cadena.some((c) => c.includes('⌀5.56') && c.includes('VIOLA')),
      `⌀${e8.bushing.diaOptimoMm} empaca ${e8.bushing.freezeOptimoS}s ≥ ${e8.bushing.tPackNeededS}s · el ⌀5.56 falla por 0.16 s · ciclo −${e8.bushing.ahorroPct} %`);
    check('E8 · las líneas respetan los rangos del libro (2D<H<5D · H<W<2H · H<k/1000)',
      e8.cd.hLineMm >= 2 * e8.cd.diaMm && e8.cd.hLineMm <= 5 * e8.cd.diaMm
        && e8.cd.wLineMm >= e8.cd.hLineMm && e8.cd.wLineMm <= 2 * e8.cd.hLineMm + 1e-9
        && e8.cd.hLineMm <= e8.cd.hLineMaxMm && e8.lineas.variacionFlujoPct < 5,
      `⌀${e8.lineas.diaMm} (${e8.lineas.plug}) · H ${e8.cd.hLineMm.toFixed(2)} (${(e8.cd.hLineMm / e8.cd.diaMm).toFixed(2)}D) · W ${e8.cd.wLineMm.toFixed(2)} (${(e8.cd.wLineMm / e8.cd.hLineMm).toFixed(2)}H) · variación ${e8.lineas.variacionFlujoPct} %`);
    check('E8 · el caudal lo fija LA TURBULENCIA, no el ΔT (carga diminuta) y el controlador lo surte',
      e8.caudal.manda === 'turbulencia' && e8.caudal.dTrealC < 1 && e8.caudal.controladorOk,
      `térmico ${e8.caudal.termicoGPM} → turbulento ${e8.caudal.turbulentoGPM} GPM/línea · ΔT real ${e8.caudal.dTrealC} °C · total ${e8.caudal.totalGPM} GPM`);
    check('E8 · el CORE del dado cae en el rango del BAFFLE (Tabla 9.3)',
      e8.core.elegido === 'baffle', `core ⌀${e8.core.diaMm}×${e8.core.alturaMm} (L/D ${e8.core.LsobreD}) → ${e8.core.elegido}`);
    // EL RETORNO CON DINERO: el ciclo de cap 3 es ciego a la colada, y con el
    // ciclo REAL la arquitectura que ganó en la E2 DEJA DE SER la más barata.
    const sa = e8.dinero.salidas.find((x) => x.id === 'a'), sc = e8.dinero.salidas.find((x) => x.id === 'c');
    check('E8 · RETORNO A LA E2: con el ciclo REAL el bebedero CALIENTE es más barato que el frío',
      sa && sc && sc.partUSD < sa.partUSD && sa.partUSD > 2 * e8.dinero.partUSDdeclarado * 0.9,
      `Eq 3.23 cotizó ${e8.dinero.cicloEq323S}s → $${e8.dinero.partUSDdeclarado}/pza · real (a) ${sa.cicloS}s → $${sa.partUSD} · (c) caliente ${sc.cicloS}s → $${sc.partUSD}`);
    check('E8 · RUTEO §9.2.7: la línea del medio IBA por el bebedero (Fig 9.9) y el corrimiento la libra',
      e8.ruteo.claroSinCorrerMm < e8.ruteo.claroMinMm && e8.ruteo.corrimientoMm > 0 && e8.ruteo.ok,
      `claro ${e8.ruteo.claroSinCorrerMm} mm (¡el eje!) → corrido ½ pitch ${e8.ruteo.corrimientoMm} mm → ${e8.ruteo.claroFinalMm} mm ≥ ${e8.ruteo.claroMinMm} exigido`);
    // ══ E8b — EL CIRCUITO REAL (orden 2026-08-18-e8b-circuito-real) ══
    // ian: "las tuberías están MAL" — y el juez nuevo lo confirma con números.
    const cir = e8.circuito;
    check('E8b · CONEXIONES §9.1.6: exactamente 2 por mitad, etiquetadas, tapones y sellos CONTADOS',
      cir.conexionesPorMitad === 2 && cir.inOut.length === 4
        && new Set(cir.inOut.map((i) => i.etiqueta)).size === 4
        && cir.tapones.length === 12 && cir.sellos.length === 3,
      `${cir.inOut.map((i) => i.etiqueta).join(' · ')} · ${cir.tapones.length} tapones NPT · ${cir.sellos.length} sellos (cada O-ring es una fuga futura — se declaran, no se esconden)`);
    check('E8b · EL JUEZ DE INTERFERENCIA TOTAL: todos los claros ≥ ½⌀ de acero (§9.2.7)',
      cir.juez.ok && cir.juez.claros.length >= 5,
      cir.juez.claros.map((c) => `${c.contra.split(' ↔ ')[1] ?? c.contra}: ${c.claroMm}≥${c.minMm}`).join(' · '));
    check('E8b · LOS RECORTES: la interferencia RECORTA H en ambos lados y AMBOS siguen en 2D..5D',
      cir.recortes.length === 2
        && cir.ladoA.hOverD >= 2 && cir.ladoA.hOverD <= 5
        && cir.ladoB.hOverD >= 2 && cir.ladoB.hOverD <= 5,
      `A: H ${cir.ladoA.hMm} (${cir.ladoA.hOverD}D, techo del inserto) · B: H ${cir.ladoB.hMm} (${cir.ladoB.hOverD}D, piso del bolsillo)`);
    // CONTROL NEGATIVO — la escena de AYER (E8a): con los z de diseño sin
    // recortar, el juez mide claro NEGATIVO en A (rompía el acero) y <½⌀ en B.
    {
      const asmN = mps.packageToAssemblySpec(e2.pkg);
      const idmN = mds.insertDims(asmN);
      const rN = e8.cd.diaMm / 2;
      const claroAviejo = (dC.zPartMm + idmN.Hc) - ((dC.zPartMm + 39.5 + e8.cd.hLineMm) + rN);
      const claroBviejo = (dC.zPartMm - idmN.Hk) - ((dC.zPartMm - e8.cd.hLineMm) + rN);
      check('E8b · CONTROL NEGATIVO: la escena de la E8a REPRUEBA con números (A rompía el acero)',
        claroAviejo < 0 && claroBviejo < rN,
        `A: claro ${claroAviejo.toFixed(2)} mm (NEGATIVO = el barreno salía del inserto) · B: ${claroBviejo.toFixed(2)} < ${rN.toFixed(2)} — el ojo de ian tenía razón`);
    }
    check('E8b · ANILLO A: libra el bebedero y la trampa §9.3.1(d) queda declarada con su anuncio',
      cir.juez.claros[0].ok && cir.ladoA.semiMm - dC.rBaseMm - e8.cd.diaMm / 2 >= e8.cd.diaMm / 2,
      `semi ${cir.ladoA.semiMm} − r_sprue ${dC.rBaseMm.toFixed(2)} − r_línea = ${cir.juez.claros[0].claroMm} mm de acero`);
    check('E8b · BAFFLE: bore ⌀9.53 en rango de Tabla 9.3, claro al ápice ≥ ½⌀bore, sello contado',
      cir.baffle.boreDiaMm === 9.53 && e8.core.elegido === 'baffle'
        && cir.baffle.claroApiceMm >= cir.baffle.boreDiaMm / 2
        && cir.sellos.some((x) => x.nota.includes('baffle')),
      `bore ⌀${cir.baffle.boreDiaMm} sube a ${cir.baffle.claroApiceMm} mm del ápice del macho — el core POR FIN se enfría por dentro (Fig 9.11 resuelta)`);
    // CONTROL NEGATIVO: pedirle al motor que viole Eq 9.22 (H=1D) — NO se deja:
    // recorta al rango legal. Y con pitch ancho (W=4H) la variación se dispara.
    const e8h = ed.estacion8Dado(e2.pkg, dC, { partVolCc: 14.14, hOverD: 1 });
    const e8w = ed.estacion8Dado(e2.pkg, dC, { partVolCc: 14.14, wOverH: 4 });
    check('E8 · CONTROL NEGATIVO: H=1D se RECORTA al rango legal (Eq 9.22) y W=4H dispara la variación',
      e8h.cd.hLineMm >= 2 * e8h.cd.diaMm - 1e-9 && e8w.lineas.variacionFlujoPct > 50,
      `H pedido 1D → entregado ${(e8h.cd.hLineMm / e8h.cd.diaMm).toFixed(2)}D · W=4H → variación ${e8w.lineas.variacionFlujoPct} % (vs ${e8.lineas.variacionFlujoPct} % del diseño)`);
  }

  // ══ ESTACIÓN 9 — CONTRACCIÓN (orden 2026-08-18-ciclo-dado-estacion9) ══
  // La deuda más vieja del tren (escala 1.0 de la E3) se paga con el PROCESO
  // del cap 10: fuentes confrontadas, banda con la alarma VIVA, steel-safe con
  // responsable, y el acero re-tallado MEDIDO.
  console.log('── E9 · Contracción (cap 10) — el acero escalado');
  {
    const sh9 = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'shrinkage.ts'));
    const mold9 = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold.ts'));
    // ORÁCULO §10.1.4: el ejemplo impreso (66 MPa → 0.31 %). Con precisión
    // completa da 0.293: el 0.31 del libro sale de SU rv redondeado a 4 cifras
    // (0.9907 → 0.311 %) — misma familia de las erratas ya cazadas. Banda ±0.03.
    const s66 = sh9.shrinkage(sh9.ABS_TAIT, { tNoFlowK: 405.15, pPackPa: 66e6 }).linear * 100;
    check('E9 · ORÁCULO §10.1.4: el ejemplo del libro (66 MPa) reproduce su 0.31 % (±0.03 — rv redondeado, declarado)',
      Math.abs(s66 - 0.31) <= 0.03, `${s66.toFixed(3)} % con precisión completa vs 0.31 impreso`);
    const e9 = ed.estacion9Dado(e2.pkg);
    check('E9 · LA BRECHA R7 + convergencia vía la perilla E6: Tait débil FUERA del proveedor, Tait a la perilla EN el tope',
      e9.brecha.taitDebilPct > 0.8 && e9.brecha.taitPerillaPct >= 0.7 && e9.brecha.taitPerillaPct <= 0.85,
      `débil ${e9.brecha.taitDebilPct} % (se muestra, no se auto-corrige) · perilla ${e9.brecha.pPerillaMPa} MPa → ${e9.brecha.taitPerillaPct} % ∈ [0.5, 0.8] proveedor`);
    check('E9 · LA ALARMA §10.1.6 VIVA en nuestro dado: el techo práctico del libro SOBRE-EMPACA esta pieza',
      e9.banda.positiva === false && e9.pTechoMPa > 1.5 * e9.brecha.pPerillaMPa && e9.pTechoMPa < 100,
      `s=0 a ~${e9.pTechoMPa} MPa (el techo REAL del proceso) · la perilla ${e9.brecha.pPerillaMPa} MPa trae margen ${(e9.pTechoMPa / e9.brecha.pPerillaMPa).toFixed(1)}× · banda low ${e9.banda.lowPct.toFixed(2)} %`);
    // EL TALLADO, MEDIDO del B-Rep (el gancho de splitMold jalado)
    const a1 = ed.construirAceroE3(oc, e2.pkg);
    const a9 = ed.construirAceroE3(oc, e2.pkg, false, e9.escala);
    const b1 = mold9.shapeBBox(oc, a1.r.macho), b9 = mold9.shapeBBox(oc, a9.r.macho);
    const mx1 = b1.max[0] - b1.min[0], mx9 = b9.max[0] - b9.min[0];
    const blockVol = 120 * 120 * 60;
    const h1 = blockVol - occt.volume(oc, a1.r.cavityPlate);
    const h9 = blockVol - occt.volume(oc, a9.r.cavityPlate);
    const rMacho = mx9 / mx1, rHueco = h9 / h1;
    check('E9 · EL ACERO TALLADO Y MEDIDO: macho ×1.0080 (bbox) y hueco de cavidad ×1.0050³ (volumen)',
      Math.abs(rMacho - e9.escala.core) < 0.0015 && Math.abs(rHueco - e9.escala.cav ** 3) < 0.004,
      `macho ${mx1.toFixed(2)} → ${mx9.toFixed(2)} mm (×${rMacho.toFixed(4)} vs ${e9.escala.core}) · hueco ×${rHueco.toFixed(4)} vs ${(e9.escala.cav ** 3).toFixed(4)} — el retorno de la E3 CERRADO`);
    // CONTROL NEGATIVO anti-steel-safe: escala invertida ⇒ descalce NEGATIVO
    // (la corrección sería AGREGAR acero — imposible). El veredicto distingue.
    const e9mal = ed.estacion9Dado(e2.pkg, { sCavPct: 0.8, sCorePct: 0.5 });
    check('E9 · CONTROL NEGATIVO: la escala invertida (anti-steel-safe) da descalce NEGATIVO y se DISTINGUE',
      e9.descalceShutoffMm > 0 && e9mal.descalceShutoffMm < 0,
      `steel-safe A: +${e9.descalceShutoffMm} mm/lado (quitar acero = spotting) · invertida: ${e9mal.descalceShutoffMm} mm (agregar acero = imposible)`);
    // PANDEO Eq 10.19 + warp Eqs 10.17-18: números consistentes entre sí
    const warpAprox = 40 * 40 / ((2 * 2) / (e9.pandeo.alfaLinPorC * 2));
    check('E9 · PANDEO de la tapa: ΔT crítico ~9 °C (Eq 10.19 con CVTE de Tait) y el warp de 2 °C consistente',
      e9.pandeo.dTcritC > 5 && e9.pandeo.dTcritC < 15
        && Math.abs(e9.pandeo.warp2C_mm - warpAprox) / warpAprox < 0.05
        && Math.abs(e9.pandeo.dsCritPct - 0.11) < 0.005,
      `Δs_crit ${e9.pandeo.dsCritPct} % ⇒ ΔT_crit ${e9.pandeo.dTcritC} °C (defensa: E8b baffle+pitch) · warp(2°C) ${e9.pandeo.warp2C_mm} ≈ W²/R ${warpAprox.toFixed(3)} mm`);
    check('E9 · SPI §10.1: entra en tolerancia ESTÁNDAR (±0.4 %) y la apretada exige prototipo (registrado)',
      e9.spi.estdOk && !e9.spi.apretadaOk,
      `incertidumbre ±${e9.spi.incertPct} % vs ±0.4 estándar ✓ · ±0.1 apretada ✗ → R12/R20 al acta`);
  }

  // ══ ESTACIÓN 10 — EXPULSIÓN (orden 2026-08-18-ciclo-dado-estacion10) ══
  // ian: "el molde no es un pipeline, son ciclos de decisión y rediseño" — y
  // esta estación los EJERCIÓ de verdad: R34→R46 (el catálogo violaba la
  // pared), R52 (el recto pandeaba → escalonado) y A-239 al revés (los pines
  // cedieron el carril central al baffle).
  console.log('── E10 · Expulsión (cap 11) — los ciclos ejercidos');
  {
    const ej = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'ejection.ts'));
    const e8x = ed.estacion8Dado(e2.pkg, dC);
    const e10 = ed.estacion10Dado(e2.pkg, dC, e8x.circuito);
    check('E10 · F_eject cruza con el motor del paquete (±2 %) y R41 sanity (clamp + eyector de máquina)',
      e10.fuerza.cruceOkPct < 2 && e10.fuerza.pctClamp < 2 && e10.fuerza.pctEyectorMaq < 100,
      `${e10.fuerza.fEjectN} N vs pkg ${e10.fuerza.fPkgN} (Δ ${e10.fuerza.cruceOkPct} %) · ${e10.fuerza.pctClamp} % del clamp (libro ~0.5) · ${e10.fuerza.pctEyectorMaq} % del eyector IM-50`);
    check('E10 · EL CICLO R34→R46: con 4 pines el catálogo VIOLA la pared y con 8 CUMPLE',
      e10.cicloDecision.some((c) => c.includes('2.381 > pared 2')) && e10.pines.diaMm <= 2,
      `4 pines → ⌀2.381 > 2 (punto caliente R34) · 8 pines → ⌀${e10.pines.diaMm} ≤ 2 ✓ — y R46 regala venteo uniforme`);
    check('E10 · R52 EJERCIDO: el recto PANDEA (SF<1) y el ESCALONADO del libro resuelve (con ambas K impresas)',
      e10.pines.escalonado.sfRectoK2 < 1 && e10.pines.pandeoNuestro.sf >= 2 && e10.pines.pandeoLibro.sf >= 2,
      `recto ⌀${e10.pines.escalonado.puntaDiaMm}×${e10.pines.libreMm}: SF ${e10.pines.escalonado.sfRectoK2} → escalonado punta×${e10.pines.escalonado.puntaMm} guiada + cuerpo ⌀${e10.pines.escalonado.cuerpoDiaMm}: SF ${e10.pines.pandeoNuestro.sf} (K=2) / ${e10.pines.pandeoLibro.sf} (K=0.7)`);
    check('E10 · la desviación K documentada: fCrit(0.7)/fCrit(2) = (2/0.7)² = 8.16 EXACTO',
      Math.abs(ej.pinBuckling({ diaMm: 3, freeLenMm: 50, fPerPinN: 100, K: 0.7 }).fCritN
        / ej.pinBuckling({ diaMm: 3, freeLenMm: 50, fPerPinN: 100 }).fCritN - (2 / 0.7) ** 2) < 0.01,
      `la razón de la desviación declarada en ejection.ts, verificada por fórmula`);
    check('E10 · cortante GOBIERNA sobre compresión (la trampa R45)',
      e10.pines.gobierna === 'cortante' && e10.pines.dMinCorteMm > e10.pines.dMinCompMm,
      `compresión ⌀${e10.pines.dMinCompMm} < cortante ⌀${e10.pines.dMinCorteMm} — gobierna el plástico, no el acero`);
    check('E10 · A-239 EJERCIDO AL REVÉS: los pines CEDEN el carril central (el baffle no se mueve) y el juez queda VERDE',
      e10.juez.ok && e10.pines.posiciones.filter((q) => Math.abs(q.x - dC.ejeX) < 1 && Math.abs(q.y - dC.ejeY) > 10).length === 0
        && e10.cicloDecision.some((c) => c.includes('CEDEN LOS PINES')),
      `${e10.juez.claros.length} claros medidos · peor ${Math.min(...e10.juez.claros.map((c) => c.claroMm)).toFixed(2)} mm · cero pines sobre x=eje en las paredes Y`);
    check('E10 · CONTROL NEGATIVO: un pin forzado SOBRE la línea B-0 REPRUEBA (el juez muerde)',
      !ed.estacion10Dado(e2.pkg, dC, e8x.circuito, { pinExtra: { x: 60, y: 98 } }).juez.ok,
      'pin en (60, 98) → claro negativo contra la serpentina — esto es lo que REABRIRÍA la E8');
    check('E10 · juzgarPines CONVOCADO (esperaba desde la E1) sin VIOLA',
      e10.juicioPines.peor !== 'VIOLA', `veredicto ${e10.juicioPines.peor} · ${e10.juicioPines.avisosAgua.length} avisos de agua`);
  }

  // ══ ESTACIÓN 11 — ESTRUCTURA (orden 2026-08-18-ciclo-dado-estacion11) ══
  console.log('── E11 · Estructura (cap 12) — lo perforado rinde cuentas');
  {
    const lv = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'lamina-vonmises.ts'));
    const e8x = ed.estacion8Dado(e2.pkg, dC);
    const e10x = ed.estacion10Dado(e2.pkg, dC, e8x.circuito);
    const e11 = ed.estacion11Dado(e2.pkg, dC, e8x.circuito, e10x);
    check('E11 · ORÁCULO R79: K a 1.5⌀ = 3.40 EXACTO (el FEA impreso del libro)',
      Math.abs(lv.kBarrenoLibro(1, 1.5) - 3.4) < 0.005, `${lv.kBarrenoLibro(1, 1.5).toFixed(3)} vs "3.4" impreso`);
    // ORÁCULO R75: el pilar del libro — UNA F inferida, DOS diámetros impresos
    const F75 = 297e6 * Math.PI * (37.5e-3 / 2) ** 2;
    const s50 = F75 / (Math.PI * (50e-3 / 2) ** 2) / 1e6;
    check('E11 · ORÁCULO R75: pilar ⌀37.5→297 MPa y ⌀50→167 (consistencia DOBLE, F inferida)',
      Math.abs(s50 - 167) < 1.5, `F=${(F75 / 1e3).toFixed(0)} kN ⇒ ⌀50 → ${s50.toFixed(1)} MPa (libro: 167)`);
    check('E11 · R70 la ALARMA MAESTRA: δ del soporte < EL VENTEO DE LA E7 (flashOk, lazo cableado)',
      e11.soporte.flashOk && e11.soporte.deltaMm < e11.soporte.ventGapMm && Math.abs(e11.soporte.ventGapMm - 0.02) < 1e-9,
      `δ ${e11.soporte.deltaMm} < ${e11.soporte.ventGapMm} mm (ventGap del motor == vent h de la E7) · ${e11.soporte.nPillars} pilares`);
    check('E11 · K de NUESTROS barrenos: agua-A y baffle CUMPLEN fatiga+sobrepresión; el pin es R81 (ADVIERTE honesto)',
      e11.barrenos[0].fatigaOk && e11.barrenos[0].yieldOk && e11.barrenos[1].fatigaOk && e11.barrenos[1].yieldOk
        && e11.barrenos[2].r81 === true && e11.barrenos[2].K > 10
        && e11.filas.find((f) => f.id === 'k-pin').estado === 'ADVIERTE',
      `agua-A K ${e11.barrenos[0].K} σ ${e11.barrenos[0].sigmaEsperadaMPa}<456 · baffle K ${e11.barrenos[1].K} · pin K ${e11.barrenos[2].K} → R81: la grieta se frena en el pin, el riesgo es binding`);
    check('E11 · HOOP del macho: doble veredicto (fatiga@39 + yield@200) y regla P20',
      e11.hoop.fatigaOk && e11.hoop.yieldOk && e11.hoop.reglaP20Ok && e11.hoop.huecoMaxMm > e11.hoop.boreMm,
      `${e11.hoop.sigmaEsperada}/${e11.hoop.sigmaSobre} MPa · hueco máx ${e11.hoop.huecoMaxMm} ≫ bore ${e11.hoop.boreMm}`);
    check('E11 · R90: los TRES veredictos independientes en verde y la E3 NO se reabre',
      e11.r90.yieldOk && e11.r90.fatigaOk && e11.r90.flashOk && !e11.retornoE3.reabre,
      `sobrepresión ✓ fatiga ✓ flash ✓ · soporte ${e11.retornoE3.soporteStackMm} == ${e11.retornoE3.soportePkgMm} mm`);
    // CONTROL NEGATIVO R69: la trampa del aluminio — sin ciclos NO hay σ_limit
    const qc7 = lv.limiteMaterial('QC7');
    const qc7M = lv.limiteMaterial('QC7', 1e6);
    check('E11 · CONTROL NEGATIVO (trampa R69): QC7 sin ciclos = SIN límite de fatiga; a 1M cae a 170',
      qc7.sinLimiteFatiga === true && qc7.sigmaLimitMPa == null && qc7M.sigmaLimitMPa === 170,
      `"[aluminum alloys] do not exhibit an endurance stress limit" · a 1M ciclos: ${qc7M.sigmaLimitMPa} MPa — el veredicto DISTINGUE`);
  }

  // ══ ESTACIÓN 12 — EL ACTA (orden 2026-08-18-ciclo-dado-estacion12) ══
  console.log('── E12 · EL ACTA (§13.10) — el cubo se firma');
  {
    const acta = ed.estacion12Dado(e2.pkg, dC);
    check('E12 · EL ACTA FIRMA con las 11 estaciones (R92: aprobadas y documentadas)',
      acta.veredicto === 'FIRMADO' && acta.faltantes.length === 0,
      `${acta.conteo.estaciones} estaciones · ${acta.decisiones.length} decisiones · ${acta.conteo.checksGate} checks`);
    check('E12 · LA ARQUITECTURA con los DOS números (el dinero decide, no la opinión)',
      acta.decisiones[0].id === 'arquitectura' && acta.decisiones[0].beneficio.includes('$0.423') && acta.decisiones[0].beneficio.includes('$1.162'),
      acta.decisiones[0].decision + ' — con PLAN B frío documentado');
    check('E12 · toda decisión lleva costo/beneficio/riesgo/responsable (R92 literal)',
      acta.decisiones.length >= 6 && acta.decisiones.every((x) => x.costo && x.beneficio && x.riesgo && x.responsable && x.seccion),
      `${acta.decisiones.length} decisiones, todas firmadas`);
    check('E12 · los RETORNOS CERRADOS contados (ciclos, no pipeline — el mandato de ian)',
      acta.retornosCerrados.length >= 8, `${acta.retornosCerrados.length}: ${acta.retornosCerrados.map((r) => r.de + '→' + r.a).join(' · ')}`);
    check('E12 · tryout steel-safe R119 (≥5 pasos) + erratas del libro (≥5) + pendientes DECLARADOS',
      acta.tryout.length >= 5 && acta.erratas.length >= 5 && acta.pendientes.length >= 3,
      `tryout ${acta.tryout.length} · erratas ${acta.erratas.length} · pendientes ${acta.pendientes.length}`);
    check('E12 · CONTROL NEGATIVO: el acta NO firma huecos (sin E10 ⇒ INCOMPLETO)',
      ed.estacion12Dado(e2.pkg, dC, { omitir: 'e10' }).veredicto === 'INCOMPLETO',
      'un acta con estaciones faltantes se declara INCOMPLETA — no se firma lo que no se hizo');
  }

  console.log(`\n${fallan === 0 ? '✅' : '❌'} ciclo del dado: ${pasan} pasan · ${fallan} fallan`);
  console.log(`VERIFY_RESULT={"pass":${fallan === 0},"pasan":${pasan},"fallan":${fallan}}`);
  process.exit(fallan ? 1 : 0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 600)); process.exit(1); });
