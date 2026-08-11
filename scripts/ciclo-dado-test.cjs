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

  console.log(`\n${fallan === 0 ? '✅' : '❌'} ciclo del dado: ${pasan} pasan · ${fallan} fallan`);
  console.log(`VERIFY_RESULT={"pass":${fallan === 0},"pasan":${pasan},"fallan":${fallan}}`);
  process.exit(fallan ? 1 : 0);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 600)); process.exit(1); });
