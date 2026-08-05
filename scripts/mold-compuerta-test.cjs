/**
 * GATE DE LA LÁMINA L7 — el detalle en sección de la compuerta.
 *
 * REGLA: **no se verifica contra el libro**. Reproducir un número de Kazmer solo
 * probaría que copié su tabla. Aquí se verifica contra GEOMETRÍA ANALÍTICA —
 * cantidades que existen sin este código y que se pueden escribir a mano:
 *
 *   A · FIXTURES. Volumen con signo (divergencia) de las tres mallas nuevas:
 *       prisma de perfil, tronco de eje inclinado y sólido de revolución. Si las
 *       normales se voltean, TODAS las áreas de sección de abajo miden otra cosa.
 *   B · EL PERFIL DEL CANAL, contra forma cerrada:
 *       B1 círculo de n lados: A=(n/2)r²sin(2π/n), P=2nr·sin(π/n), Q=(π/n)cot(π/n)
 *       B2 hexágono regular: Dh = √3·a y Q = π/(2√3) EXACTOS
 *       B3 medio redondo de n cuerdas: A=(n/2)r²sin(π/n), P=2r+2nr·sin(π/2n)
 *       B4 trapecio: A=H(W−H·tanθ), P=2W−2H·tanθ+2H/cosθ EXACTOS
 *       B5 ISOPERIMÉTRICO: Q ≤ 1 siempre, y solo el círculo lo alcanza
 *       B6 el ORDEN por Q reproduce SOLO el ranking de §6.5.1 — el libro no se cita
 *       B7 barrido de proporciones: hasta dónde aguanta ese orden (se REPORTA)
 *       B8 Q es invariante de escala; Dh escala lineal
 *   C · EL CORTE del detalle: área de sección contra su valor exacto
 *       (tronco inclinado = L·(r₀+r₁) · prisma = área del perfil · revolución = 2×)
 *   D · MEDIDO vs. COMANDADO: los ángulos se miden SOBRE EL LAZO y tienen que
 *       reproducir lo comandado a ~1e-12, en un barrido de ángulos
 *   E · EL SIGNO del reverse taper contra el signo del bebedero (no la magnitud)
 *   F · INVARIANCIA: cambiar el zoom no mueve ninguna cota
 *   G · Escalón del valve gate · Dh anular = D − d · intrusión del sucker
 *   H · LA LÁMINA: SIN CABLEAR jamás verde · NO APLICA declarado · cobertura 11/11
 *
 * Si un check falla se DIAGNOSTICA la causa. Aflojar la tolerancia está prohibido.
 *
 * Uso: node --import tsx scripts/mold-compuerta-test.cjs
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
const shoelace = (pts) => {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a / 2);
};

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const S = await import(R('lamina-seccion.ts'));
  const C = await import(R('lamina-compuerta.ts'));
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });
  const resumen = {};
  const cortar = (malla, rol = 'colada') =>
    S.seccionarPorPlano([{ id: 's', nombre: 's', rol, malla }], { p0: [0, 0, 0], n: [0, -1, 0], arriba: [0, 0, 1] }).piezas[0];

  // ══ A · FIXTURES: las mallas nuevas son sólidas y con normales SALIENTES ══
  const PERF = C.perfilRunner('trapezoidal', 6);
  const PRIS = C.mallaPrismaPerfil(PERF.pts, -10, 10);
  check('A1 mallaPrismaPerfil: volumen = área(perfil)·largo (normales salientes)',
    rel(volumen(PRIS), PERF.areaMm2 * 20) < 1e-12 && volumen(PRIS) > 0,
    `V=${volumen(PRIS).toFixed(9)} vs ${(PERF.areaMm2 * 20).toFixed(9)}`);

  const NT = 64, r0 = 1.2, r1 = 3.4, P0 = [0, 0, 0], P1 = [5, 0, 5];
  const TRO = C.mallaTronco(P0, P1, r0, r1, NT);
  const Ltro = Math.hypot(5, 5);
  const volTronco = (n, a, b, L) => (n / 6) * Math.sin((2 * Math.PI) / n) * L * (a * a + a * b + b * b);
  check('A2 mallaTronco (eje INCLINADO 45°): volumen = (n/6)·sin(2π/n)·L·(r₀²+r₀r₁+r₁²) EXACTO',
    rel(volumen(TRO), volTronco(NT, r0, r1, Ltro)) < 1e-12,
    `V=${volumen(TRO).toFixed(9)} vs ${volTronco(NT, r0, r1, Ltro).toFixed(9)}`);

  // revolución: converge al teorema de Pappus 2π·r̄·A
  const perfRev = [[2, 0], [5, 0], [5, 3], [2, 3]];
  const errPap = [12, 48, 192].map((n) => {
    const V = volumen(C.mallaRevolucion(perfRev, 0, 0, n));
    const pap = 2 * Math.PI * 3.5 * 9;
    return { n, V, e: Math.abs(V - pap) / pap };
  });
  check('A3 mallaRevolucion: volumen → Pappus 2π·r̄·A por CONVERGENCIA (y siempre > 0)',
    errPap.every((x) => x.V > 0) && errPap[0].e > errPap[1].e && errPap[1].e > errPap[2].e && errPap[2].e < 1e-3,
    `err ${(errPap[0].e * 100).toFixed(2)}% → ${(errPap[1].e * 100).toFixed(3)}% → ${(errPap[2].e * 100).toFixed(4)}% (Pappus ${(2 * Math.PI * 3.5 * 9).toFixed(3)})`);

  // ══ B · EL PERFIL DEL CANAL contra FORMA CERRADA ══
  const D = 6, r = D / 2;
  for (const n of [16, 64, 256]) {
    const p = C.perfilRunner('redondo', D, { n });
    const A = (n / 2) * r * r * Math.sin((2 * Math.PI) / n);
    const Pe = 2 * n * r * Math.sin(Math.PI / n);
    const Q = (Math.PI / n) / Math.tan(Math.PI / n);
    if (n === 64) check(`B1 círculo de ${n} lados: A=(n/2)r²sin(2π/n) · P=2nr·sin(π/n) · Q=(π/n)·cot(π/n) EXACTOS`,
      rel(p.areaMm2, A) < 1e-12 && rel(p.perimMm, Pe) < 1e-12 && rel(p.qIso, Q) < 1e-12,
      `A ${p.areaMm2.toFixed(9)}/${A.toFixed(9)} · P ${p.perimMm.toFixed(9)}/${Pe.toFixed(9)} · Q ${p.qIso.toFixed(12)}/${Q.toFixed(12)}`);
  }
  const HEX = C.perfilRunner('hexagonal', D);
  check('B2 hexágono regular: Dh = √3·a y Q = π/(2√3) EXACTOS (fixture: no es del libro)',
    rel(HEX.dhMm, Math.sqrt(3) * r) < 1e-12 && rel(HEX.qIso, Math.PI / (2 * Math.sqrt(3))) < 1e-12,
    `Dh ${HEX.dhMm.toFixed(9)} vs ${(Math.sqrt(3) * r).toFixed(9)} · Q ${HEX.qIso.toFixed(12)} vs ${(Math.PI / (2 * Math.sqrt(3))).toFixed(12)}`);

  const MR = C.perfilRunner('medio-redondo', D, { n: 512 });
  {
    const n = 512;
    const A = (n / 2) * r * r * Math.sin(Math.PI / n);
    const Pe = 2 * r + 2 * n * r * Math.sin(Math.PI / (2 * n));
    const efAnalitica = ((4 * (Math.PI * D * D / 8)) / (D + Math.PI * D / 2)) / D * 100;
    check('B3 medio redondo: A=(n/2)r²sin(π/n) y P=2r+2nr·sin(π/2n) EXACTOS, y Dh/⌀ converge al valor cerrado',
      rel(MR.areaMm2, A) < 1e-12 && rel(MR.perimMm, Pe) < 1e-12 && Math.abs(MR.efDhPct - efAnalitica) < 0.01,
      `A ${MR.areaMm2.toFixed(9)}/${A.toFixed(9)} · P ${MR.perimMm.toFixed(9)}/${Pe.toFixed(9)} · Dh/⌀ ${MR.efDhPct.toFixed(3)} % vs π/(2+π)·... = ${efAnalitica.toFixed(3)} % [Tabla 6.3 imprime 61.2]`);
  }
  {
    const th = (5 * Math.PI) / 180, t = Math.tan(th), W = D, Hh = D;
    const TR = C.perfilRunner('trapezoidal', D);
    const A = Hh * (W - Hh * t), Pe = 2 * W - 2 * Hh * t + 2 * Hh / Math.cos(th);
    check('B4 trapecio: A=H(W−H·tanθ) y P=2W−2H·tanθ+2H/cosθ EXACTOS',
      rel(TR.areaMm2, A) < 1e-12 && rel(TR.perimMm, Pe) < 1e-12,
      `A ${TR.areaMm2.toFixed(9)}/${A.toFixed(9)} · P ${TR.perimMm.toFixed(9)}/${Pe.toFixed(9)}`);
  }
  // B5 · DESIGUALDAD ISOPERIMÉTRICA: Q ≤ 1 y solo el círculo la alcanza
  const todos = ['redondo', 'trapezoide-fondo-redondo', 'trapezoidal', 'medio-redondo', 'hexagonal']
    .map((id) => C.perfilRunner(id, D, { n: 4096 }));
  check('B5 isoperimétrico: Q = 4πA/P² ≤ 1 en los 5 perfiles, y SOLO el círculo llega a 1',
    todos.every((p) => p.qIso <= 1 + 1e-12) && Math.abs(todos[0].qIso - 1) < 1e-6
    && todos.slice(1).every((p) => p.qIso < 0.999),
    todos.map((p) => `${p.id.slice(0, 9)} ${p.qIso.toFixed(5)}`).join(' · '));

  // B6 · el ORDEN sale de la geometría, no de la Tabla 6.3
  const rank = C.rankingPorQ(D);
  const ordenLibro = C.ORDEN_LIBRO;
  check('B6 el orden por Q REPRODUCE el ranking de §6.5.1 sin citarlo (redondo > fondo redondo > trapecio > medio redondo)',
    rank.every((p, i) => p.id === ordenLibro[i]),
    rank.map((p, i) => `${i + 1}º ${p.id} Q=${p.qIso.toFixed(4)} [Tabla 6.3 ${p.efLibroPct}%]`).join(' · '));

  // B7 · ¿hasta dónde aguanta ese orden? Se BARRE y se REPORTA el rango, no se asume
  const okHW = (hw) => C.rankingPorQ(D, { profRel: hw, n: 512 }).every((p, i) => p.id === ordenLibro[i]);
  const malos = [];
  for (let hw = 0.70; hw <= 1.201; hw += 0.05) if (!okHW(+hw.toFixed(2))) malos.push(+hw.toFixed(2));
  let bajo = null, alto = null;
  for (let hw = 0.70; hw >= 0.20; hw -= 0.02) if (!okHW(+hw.toFixed(2))) { bajo = +hw.toFixed(2); break; }
  for (let hw = 1.20; hw <= 2.60; hw += 0.02) if (!okHW(+hw.toFixed(2))) { alto = +hw.toFixed(2); break; }
  check('B7 el orden del libro AGUANTA todo H/W ∈ [0.70, 1.20] (y se reporta dónde deja de valer)',
    malos.length === 0,
    `11/11 proporciones OK · se rompe por debajo de H/W ${bajo != null ? bajo.toFixed(2) : '<0.20'} (trapecio somero peor que el medio redondo) y por arriba de ${alto != null ? alto.toFixed(2) : '>2.60'} (canal profundo y angosto): geometría, no libro`);

  // B8 · Q invariante de escala; Dh lineal
  const p1 = C.perfilRunner('trapezoide-fondo-redondo', 4, { n: 256 });
  const p2 = C.perfilRunner('trapezoide-fondo-redondo', 8, { n: 256 });
  check('B8 Q es INVARIANTE de escala y Dh escala lineal (duplicar el ⌀ duplica Dh)',
    rel(p1.qIso, p2.qIso) < 1e-12 && rel(2 * p1.dhMm, p2.dhMm) < 1e-12,
    `Q ${p1.qIso.toFixed(12)} = ${p2.qIso.toFixed(12)} · Dh ${p1.dhMm.toFixed(6)}→${p2.dhMm.toFixed(6)}`);

  // ══ C · EL CORTE del detalle contra el valor exacto ══
  const secT = cortar(TRO);
  check('C1 tronco de eje INCLINADO cortado por su eje = trapecio L·(r₀+r₁) EXACTO, en UN lazo',
    rel(secT.areaMm2, Ltro * (r0 + r1)) < 1e-12 && secT.lazos.length === 1 && secT.abiertas === 0,
    `área ${secT.areaMm2.toFixed(9)} vs ${(Ltro * (r0 + r1)).toFixed(9)} · lazos ${secT.lazos.length}`);
  const secP = cortar(PRIS);
  check('C2 prisma del perfil cortado por y=0 = el PERFIL mismo (área exacta, cero interpolación)',
    rel(secP.areaMm2, PERF.areaMm2) < 1e-12 && secP.abiertas === 0,
    `área ${secP.areaMm2.toFixed(9)} vs ${PERF.areaMm2.toFixed(9)}`);
  const secR = cortar(C.mallaRevolucion(perfRev, 0, 0, 64));
  check('C3 sólido de revolución cortado por su eje = DOS copias del perfil (área = 2·shoelace)',
    rel(secR.areaMm2, 2 * shoelace(perfRev)) < 1e-12 && secR.lazos.length === 2,
    `área ${secR.areaMm2.toFixed(9)} vs ${(2 * shoelace(perfRev)).toFixed(9)} · lazos ${secR.lazos.length}`);

  // ══ los doce tipos: se arman, se cortan y no dejan cadenas abiertas ══
  const TIPOS = ['sprue', 'pin-point', 'edge', 'tab', 'fan', 'flash', 'diaphragm', 'tunnel', 'banana', 'valve', 'thermal-pin', 'thermal-sprue'];
  const BASE = { paredMm: 2.4, runnerDiaMm: 5, material: 'ABS', VdotM3s: 6e-5 };
  const EXTRA = {
    'sprue': { vestigioMm: 0.9, gateWellMm: 1.2 },
    'fan': { fanAnchoMm: 26, piezaAnchoMm: 27 },
    'valve': { escalonMm: 0 },
  };
  const lams = {};
  let abiertasTot = 0, volMalos = 0;
  for (const tipo of TIPOS) {
    const opts = { tipo, ...BASE, ...(EXTRA[tipo] || {}) };
    const mod = C.modeloCompuerta(opts);
    for (const s of mod.solidos) if (volumen(s.malla) <= 0) volMalos++;
    const lam = C.laminaCompuerta(opts);
    lams[tipo] = lam;
    abiertasTot += lam.seccion.piezas.reduce((a, p) => a + p.abiertas, 0);
    fs.writeFileSync(path.join(outDir, `L7-${tipo}.svg`), lam.svg);
  }
  check('C4 los 12 tipos de compuerta: TODOS los sólidos con volumen > 0 (normales salientes)',
    volMalos === 0, `${volMalos} sólidos con volumen ≤ 0`);
  check('C5 los 12 tipos: CERO cadenas abiertas al cortar (mallas cerradas y bien soldadas)',
    abiertasTot === 0, `abiertas = ${abiertasTot}`);

  // ══ D · MEDIDO vs COMANDADO — el ángulo sale del LAZO, no del input ══
  {
    const l = lams['tunnel'], d = l.medidas.datos, cmd = l.meta.comandado;
    check('D1 tunnel: los tres números de §7.2.7 MEDIDOS sobre el lazo reproducen lo comandado',
      Math.abs(d.tunelEjeDeg - cmd.ejeDeg) < 1e-12 && Math.abs(d.tunelConoIncluidoDeg - cmd.conoDeg) < 1e-12
      && Math.abs(d.tunelOffsetEnDia - cmd.offsetDia) < 1e-12,
      `eje ${d.tunelEjeDeg.toFixed(12)}/${cmd.ejeDeg} · cono ${d.tunelConoIncluidoDeg.toFixed(12)}/${cmd.conoDeg} · offset ${d.tunelOffsetEnDia.toFixed(12)}⌀/${cmd.offsetDia}⌀`);
    let peorA = 0, peorC = 0, peorO = 0;
    for (const eje of [30, 37.5, 45, 52.5, 60]) for (const cono of [12, 20, 28, 40]) for (const kk of [1.5, 3, 4.25]) {
      const lm = C.laminaCompuerta({ tipo: 'tunnel', ...BASE, tunelEjeDeg: eje, tunelConoDeg: cono, tunelOffsetDia: kk });
      const dd = lm.medidas.datos;
      peorA = Math.max(peorA, Math.abs(dd.tunelEjeDeg - eje));
      peorC = Math.max(peorC, Math.abs(dd.tunelConoIncluidoDeg - cono));
      peorO = Math.max(peorO, Math.abs(dd.tunelOffsetEnDia - kk));
    }
    check('D2 barrido 5×4×3 de ángulos y offsets comandados: lo MEDIDO en el dibujo los reproduce a ~1e-12',
      peorA < 1e-12 && peorC < 1e-12 && peorO < 1e-12,
      `error máx: eje ${peorA.toExponential(2)}° · cono ${peorC.toExponential(2)}° · offset ${peorO.toExponential(2)}⌀`);
    const malo = C.laminaCompuerta({ tipo: 'tunnel', ...BASE, tunelConoDeg: 14, tunelOffsetDia: 2 });
    const v7 = malo.medidas.veredictos.find((v) => v.id === 'V7.7');
    check('D3 el veredicto SIGUE a la cota: cono 14° (<20) y offset 2⌀ (<3) ⇒ V7.7 VIOLA',
      v7.estado === 'VIOLA' && malo.medidas.verde === false,
      `${v7.estado} · ${v7.medido}`);
    const bien = lams['tunnel'].medidas.veredictos.find((v) => v.id === 'V7.7');
    check('D4 y con 45°/20°/3⌀ el mismo veredicto pasa a CUMPLE (la regla no está clavada)',
      bien.estado === 'CUMPLE', `${bien.estado} · ${bien.medido}`);
  }

  // ══ E · EL SIGNO del reverse taper (§7.2.2) contra el del bebedero (§6.3.1) ══
  {
    const sp = lams['sprue'].medidas.datos.pendienteRadialPorMm;
    const pp = lams['pin-point'].medidas.datos.pendienteRadialPorMm;
    const dir = C.laminaCompuerta({ tipo: 'pin-point', ...BASE, reverseTaper: false });
    const pd = dir.medidas.datos.pendienteRadialPorMm;
    check('E1 el BEBEDERO (cono normal §6.3.1) tiene pendiente NEGATIVA alejándose de la pieza: se extrae hacia ella',
      sp < 0, `dr/ds = ${sp.toFixed(6)} mm/mm`);
    check('E2 el pin-point con reverse taper da el signo OPUESTO al del bebedero (test de SIGNO, no de magnitud)',
      Math.sign(pp) === -Math.sign(sp) && pp > 0,
      `bebedero ${sp.toFixed(6)} · pin-point ${pp.toFixed(6)} → signos ${Math.sign(sp)} vs ${Math.sign(pp)}`);
    check('E3 el pin-point SIN reverse taper repite el signo del bebedero y V7.3 lo reprueba',
      Math.sign(pd) === Math.sign(sp) && dir.medidas.veredictos.find((v) => v.id === 'V7.3').estado === 'VIOLA',
      `pendiente ${pd.toFixed(6)} · V7.3 ${dir.medidas.veredictos.find((v) => v.id === 'V7.3').estado}`);
    const v73 = lams['pin-point'].medidas.veredictos.find((v) => v.id === 'V7.3');
    check('E4 el pin-point correcto sale CUMPLE con su razón L/⌀ medida',
      v73.estado === 'CUMPLE' && lams['pin-point'].medidas.datos.gateLargoDiaRazon > 0,
      `${v73.estado} · ${v73.medido}`);
  }

  // ══ F · INVARIANCIA DEL ZOOM: encuadrar distinto no cambia ninguna cota ══
  {
    const a = C.laminaCompuerta({ tipo: 'tunnel', ...BASE });
    const b = C.laminaCompuerta({ tipo: 'tunnel', ...BASE, zoom: 2.5 });
    const ka = Object.keys(a.medidas.datos);
    const iguales = ka.every((kk) => String(a.medidas.datos[kk]) === String(b.medidas.datos[kk]));
    const textosIguales = a.medidas.cotas.map((c) => c.texto).join('|') === b.medidas.cotas.map((c) => c.texto).join('|');
    check('F1 escalar el zoom ×2.5 NO cambia ni un dato ni un texto de cota (y el dibujo sí cambia)',
      iguales && textosIguales && a.svg !== b.svg,
      `${ka.length} datos idénticos · ${a.medidas.cotas.length} cotas idénticas · SVG distinto ${a.svg.length} vs ${b.svg.length} B`);
  }

  // ══ G · VALVE GATE, ANULAR Y SUCKER ══
  {
    const cerr = lams['valve'], d = cerr.medidas.datos;
    check('G1 valve gate CERRADO al ras: escalón medido = 0 exacto y V7.10 CUMPLE',
      Math.abs(d.escalonMedidoMm) < 1e-12 && cerr.medidas.veredictos.find((v) => v.id === 'V7.10').estado === 'CUMPLE',
      `escalón ${d.escalonMedidoMm} mm`);
    const desal = C.laminaCompuerta({ tipo: 'valve', ...BASE, escalonMm: 0.35 });
    const v10 = desal.medidas.veredictos.find((v) => v.id === 'V7.10');
    check('G2 con el vástago 0.35 mm retrasado el escalón se MIDE en el dibujo y V7.10 lo reprueba',
      Math.abs(desal.medidas.datos.escalonMedidoMm - 0.35) < 1e-12 && v10.estado === 'VIOLA',
      `escalón ${desal.medidas.datos.escalonMedidoMm} · ${v10.estado}`);
    // Dh de una corona = D − d en forma cerrada; y OJO con la contabilidad: el
    // corte axial da (D−d)·largo, NO el área de flujo π/4·(D²−d²). Dos números.
    check('G3 sección ANULAR (§6.5.1 Fig 6.21): Dh medido = D − d EXACTO, la sección axial = (D−d)·largo y el área de flujo = π/4·(D²−d²)',
      Math.abs(d.anularDhMm - (d.anularDbMm - d.anularDvMm)) < 1e-12
      && rel(d.anularAreaSeccionAxialMm2, (d.anularDbMm - d.anularDvMm) * d.anularLargoMm) < 1e-12
      && Math.abs(d.anularAreaFlujoMm2 - (Math.PI / 4) * (d.anularDbMm ** 2 - d.anularDvMm ** 2)) <= 5e-7,   // los datos se publican redondeados a 1e-6 mm²
      `Dh ${d.anularDhMm} = ${d.anularDbMm} − ${d.anularDvMm} · axial ${d.anularAreaSeccionAxialMm2} = ${((d.anularDbMm - d.anularDvMm) * d.anularLargoMm).toFixed(6)} · flujo ${d.anularAreaFlujoMm2}`);
    const su = lams['edge'].medidas.datos;
    check('G4 sucker pin alineado: intrusión = 0 EXACTA, alto = ½·⌀ y taper = 5° MEDIDOS en el dibujo (§6.5.2)',
      Math.abs(su.intrusionMm) < 1e-12 && Math.abs(su.suckerAltoMedidoMm - BASE.runnerDiaMm / 2) < 1e-12
      && Math.abs(su.suckerTaperMedidoDeg - 5) < 1e-9,
      `intrusión ${su.intrusionMm} · alto ${su.suckerAltoMedidoMm} (½⌀=${BASE.runnerDiaMm / 2}) · taper ${su.suckerTaperMedidoDeg}°`);
    const intr = C.laminaCompuerta({ tipo: 'edge', ...BASE, suckerIntrusionMm: 0.4 });
    const v65 = intr.medidas.veredictos.find((v) => v.id === 'V6.5');
    check('G5 sucker que SOBRESALE 0.4 mm: la intrusión se mide y V6.5 la reprueba ("disruption of the flow front")',
      Math.abs(intr.medidas.datos.intrusionMm - 0.4) < 1e-12 && v65.estado === 'VIOLA',
      `intrusión ${intr.medidas.datos.intrusionMm} · ${v65.estado}`);
  }

  // ══ H · LA LÁMINA: honestidad de estados y cobertura ══
  {
    const sinVest = C.laminaCompuerta({ tipo: 'sprue', ...BASE });
    const v72 = sinVest.medidas.veredictos.find((v) => v.id === 'V7.2');
    check('H1 lo NO medido no cuenta: sin altura de vestigio declarada, V7.2 sale SIN CABLEAR y tumba el veredicto',
      v72.estado === 'SIN CABLEAR' && sinVest.medidas.verde === false && /SIN CABLEAR/.test(sinVest.svg),
      `${v72.estado} · verde=${sinVest.medidas.verde}`);
    const conVest = lams['sprue'];
    const v72b = conVest.medidas.veredictos.find((v) => v.id === 'V7.2');
    check('H2 con el vestigio declarado (0.9 mm) y gate well de 1.2, el vestigio queda BAJO el apoyo → CUMPLE',
      v72b.estado === 'CUMPLE' && conVest.medidas.datos.vestigioSobreApoyoMm < 0,
      `Δ sobre el apoyo ${conVest.medidas.datos.vestigioSobreApoyoMm} mm · ${v72b.medido}`);
    const malSprue = C.laminaCompuerta({ tipo: 'sprue', ...BASE, vestigioMm: 1.4, gateWellMm: 0 });
    check('H3 el mismo vestigio SIN rebaje sobresale del plano de apoyo → V7.2 VIOLA (la pieza se mece)',
      malSprue.medidas.veredictos.find((v) => v.id === 'V7.2').estado === 'VIOLA'
      && malSprue.medidas.datos.vestigioSobreApoyoMm > 0,
      `Δ ${malSprue.medidas.datos.vestigioSobreApoyoMm} mm`);
    // ninguna lámina declara CUMPLE sin haber medido algo
    const todasM = Object.values(lams).flatMap((l) => l.medidas.veredictos);
    check('H4 ningún CUMPLE sin medición detrás, y ningún SIN CABLEAR colado como verde',
      todasM.every((v) => v.estado !== 'CUMPLE' || (v.medido && v.medido.length > 3))
      && Object.values(lams).every((l) => !(l.medidas.verde && l.medidas.datos.nSinCablear > 0)),
      `${todasM.filter((v) => v.estado === 'CUMPLE').length} CUMPLE · ${todasM.filter((v) => v.estado === 'SIN CABLEAR').length} SIN CABLEAR · ${todasM.filter((v) => v.estado === 'NO APLICA').length} NO APLICA`);
    // V7.8: el par del libro (túnel sobre cara vista vs. banana por debajo)
    const vt = lams['tunnel'].medidas.veredictos.find((v) => v.id === 'V7.8');
    const vb = lams['banana'].medidas.veredictos.find((v) => v.id === 'V7.8');
    check('H5 V7.8 reproduce el par: el túnel muere sobre superficie VISIBLE, el banana entra por la oculta',
      vt.estado === 'ADVIERTE' && vb.estado === 'CUMPLE'
      && lams['banana'].medidas.datos.distASuperficieVisibleMm > 0,
      `túnel dist=${lams['tunnel'].medidas.datos.distASuperficieVisibleMm} (${vt.estado}) · banana dist=${lams['banana'].medidas.datos.distASuperficieVisibleMm} (${vb.estado})`);
    // V7.9: el contraste orificios vs bore, con la misma V̇
    const dp = lams['thermal-pin'].medidas.datos, ds = lams['thermal-sprue'].medidas.datos;
    check('H6 V7.9: los orificios del pin-point térmico cizallan MÁS que el bore abierto con la misma V̇',
      dp.pasoShearS > ds.pasoShearS && dp.pasoAreaMm2 < ds.pasoAreaMm2,
      `pin ${dp.pasoNumero}×⌀${dp.pasoDiaMedidoMm} A=${dp.pasoAreaMm2} γ̇=${dp.pasoShearS} · sprue ⌀${ds.pasoDiaMedidoMm} A=${ds.pasoAreaMm2} γ̇=${ds.pasoShearS}`);
    // cobertura: entre las 12 láminas se juzgan las ONCE verificaciones
    const cob = C.coberturaL7(Object.values(lams).map((l) => l.medidas));
    const sinJuzgar = Object.entries(cob).filter(([, e]) => e === 'NO APLICA').map(([k]) => k);
    check('H7 el juego de láminas L7 JUZGA las once verificaciones del roster (ninguna queda en NO APLICA)',
      sinJuzgar.length === 0 && Object.keys(cob).length === 11,
      Object.entries(cob).map(([k, v]) => `${k}:${v}`).join(' '));
    check('H8 cada SVG cierra bien, trae cotas dibujadas y declara sus extensiones',
      Object.values(lams).every((l) => l.svg.startsWith('<svg') && l.svg.trim().endsWith('</svg>')
        && /EXTENSIONES DECLARADAS/.test(l.svg) && /NO APLICA/.test(l.svg) && l.medidas.cotas.length >= 1),
      Object.entries(lams).map(([t, l]) => `${t} ${(l.svg.length / 1024).toFixed(0)}kB/${l.medidas.cotas.length}c`).join(' · '));
  }

  // ══ I · EL CAMINO DEL CLIENTE: la lámina alimentada por un spec de la Máquina ══
  {
    const { moldMachine } = await import(R('moldmachine.ts'));
    const { packageToAssemblySpec } = await import(R('mold-plano-set.ts'));
    const F = await import(R('feed.ts'));
    const asm = packageToAssemblySpec(moldMachine({
      name: 'vaso Kazmer', Lmm: 100, Wmm: 100, Hmm: 60, cavityShape: 'round', surfaceMm2: 30000,
      volumeMm3: 60000, wallMm: 3, plastic: 'ABS', annualVolume: 200000, totalVolume: 1000000, cavPref: 1,
    }));
    const lamSpec = C.laminaCompuerta({ tipo: 'sprue', spec: asm, vestigioMm: 0.8, rimMm: 1.2 });
    const fd = F.sprueDesignFromCavity(asm.plastic, asm.cavity, 60);
    const esperado = F.steelSafeDiaMm(2 * fd.rBaseMm);
    check('I1 con un spec de la Máquina: el ⌀ del canal sale del ⌀ del bebedero (§6.3.1) redondeado steel-safe HACIA ABAJO (§6.5.5)',
      lamSpec.meta.runnerDiaMm === esperado && esperado <= 2 * fd.rBaseMm
      && F.STANDARD_RUNNER_DIAMM.includes(esperado),
      `⌀ bebedero ${(2 * fd.rBaseMm).toFixed(2)} → catálogo ⌀${esperado} (nunca hacia arriba) · V̇ ${(lamSpec.meta.VdotM3s * 1e6).toFixed(1)} cc/s · pared ${lamSpec.meta.paredMm} mm`);
    check('I2 y la lámina del spec mide el vestigio contra el RIM de Fig 7.2 (no contra el rebaje)',
      lamSpec.medidas.datos.planoApoyoMm === 1.2 && lamSpec.medidas.datos.vestigioSobreApoyoMm < 0
      && lamSpec.medidas.veredictos.find((v) => v.id === 'V7.2').estado === 'CUMPLE',
      `apoyo z=${lamSpec.medidas.datos.planoApoyoMm} (rim) · Δ ${lamSpec.medidas.datos.vestigioSobreApoyoMm} mm`);
    fs.writeFileSync(path.join(outDir, 'L7-spec-vaso.svg'), lamSpec.svg);
  }

  for (const [t, l] of Object.entries(lams)) {
    resumen[t] = {
      verde: l.medidas.verde,
      cumple: l.medidas.datos.nCumple, viola: l.medidas.datos.nViola, sinCablear: l.medidas.datos.nSinCablear,
    };
    console.log(`   ${t.padEnd(14)} ${l.medidas.verde ? 'VERDE      ' : 'no-verde   '} ${l.medidas.veredictos.filter((v) => v.estado !== 'NO APLICA').map((v) => `${v.id}:${v.estado}`).join(' ')}`);
  }
  console.log(`\n  láminas en _laminas/L7-<tipo>.svg (${TIPOS.length})`);
  // ── G-cotas · LAS COTAS APUNTAN AL EXTREMO QUE NOMBRAN (coordenadas del DIBUJO) ──
  // El modelo puede estar perfecto y el dibujo mentir: con los offsets cruzados, la
  // etiqueta "cavidad" caía del lado del canal y "breakpoint" dentro de la pieza, y
  // ningún check sobre el MODELO lo veía. Este invariante es sobre el SVG.
  {
    const svgPP = fs.readFileSync(path.join(outDir, 'L7-pin-point.svg'), 'utf8');
    const yDe = (frag) => {
      const re = new RegExp('<text[^>]*\\sy="([-0-9.]+)"[^>]*>[^<]*' + frag + '[^<]*</text>');
      const m = svgPP.match(re); return m ? parseFloat(m[1]) : NaN;
    };
    const yCav = yDe('cavidad'), yBp = yDe('breakpoint');
    const yPieza = yDe('PIEZA'), yCanal = yDe('CANAL');
    // en SVG la y crece hacia ABAJO. La pieza va abajo y el canal arriba:
    const orientOK = Number.isFinite(yPieza) && Number.isFinite(yCanal) && yPieza > yCanal;
    check('G-cotas orientación: la PIEZA se dibuja debajo del CANAL',
      orientOK, `y(PIEZA)=${yPieza} > y(CANAL)=${yCanal}`);
    // por tanto la cota de la CAVIDAD (pegada a la pieza) va MÁS ABAJO que la del breakpoint
    check('G-cotas la etiqueta "cavidad" cae del lado de la PIEZA y "breakpoint" del lado del CANAL',
      Number.isFinite(yCav) && Number.isFinite(yBp) && yCav > yBp,
      `y(cavidad)=${yCav} debe ser > y(breakpoint)=${yBp} — si se cruzan, la lámina dice que el reverse taper va al revés`);
  }

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, ...resumen }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1500)); process.exit(1); });
