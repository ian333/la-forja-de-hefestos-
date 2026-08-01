/**
 * GATE DE LAS UBICACIONES DE VENTEO — §8.2.2 (venteo en cada final de flujo, cada
 * convergencia de frentes y cada bolsa muerta).
 *
 * LA PRUEBA DECISIVA (#1): el venteo va donde el aire queda atrapado AL FINAL, y el
 * final NO es el punto más lejano. §5.5.5 (race tracking) desacopla distancia de
 * orden de llenado: una pared gruesa lejana se llena ANTES que una delgada cercana.
 * Se le da una pieza con dos brazos donde distancia y resistencia se CONTRADICEN:
 *
 *      brazo DELGADO (2 mm, 30 mm de largo)  ←── compuerta ──→  brazo GRUESO (4 mm, 40 mm)
 *          ↑ MÁS CERCA pero se llena AL FINAL              ↑ MÁS LEJOS pero se llena antes
 *
 * Si el enumerador manda el venteo al brazo grueso (el más lejano), está eligiendo
 * por distancia y el molde saldría quemado en la punta del brazo delgado. El venteo
 * DEBE caer en el brazo delgado.
 *
 * Uso: node --import tsx scripts/mold-venteo-ubicaciones-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const FL = await import(R('flowlen.ts'));
  const V = await import(R('venting-locations.ts'));

  // ── LA PIEZA QUE CONTRADICE DISTANCIA CON RESISTENCIA ────────────────────
  // brazo GRUESO: x ∈ [0, 40], 4 mm de espesor  → L máx 40 mm, resistencia baja
  // brazo DELGADO: x ∈ [-30, 0], 2 mm de espesor → L máx 30 mm, resistencia ALTA
  // Eq 5.22 (ΔP ∝ L/H^(1+n), n=0.348): grueso 40/4^1.348 = 6.2 · delgado 30/2^1.348 = 11.8
  // ⇒ el DELGADO resiste ~1.9× más pese a estar MÁS CERCA: se llena al final.
  const HG = 4, HD = 2, LG = 40, LD = 30, WY = 10;
  const campo = FL.measureFlowLength({
    x0: -LD - 2, y0: -WY - 2, z0: -1, x1: LG + 2, y1: WY + 2, z1: HG + 1,
    cellMm: 0.5,
    gateMm: { x: 0, y: 0, z: 1 },
    inCavity: (x, y, z) => {
      if (Math.abs(y) > WY || z < 0) return false;
      if (x >= 0 && x <= LG) return z <= HG;      // brazo GRUESO
      if (x < 0 && x >= -LD) return z <= HD;      // brazo DELGADO
      return false;
    },
  });
  console.log(`\nPIEZA DE DOS BRAZOS — grueso ${HG} mm × ${LG} mm · delgado ${HD} mm × ${LD} mm`);
  console.log(`  L máx ${campo.maxFlowLenMm} mm · resistencia máx ${campo.maxResistance.toFixed(2)} · vóxeles muertos ${campo.unreachable}`);
  if (campo.warnings.length) console.log(`  avisos: ${campo.warnings.join(' · ')}`);

  const plan = V.enumerarVenteos(campo, { nMaquinar: 4, clusterMm: 8 });
  console.log(`\n  ${plan.notas.join('\n  ')}`);
  console.log(`\n  venteos a MAQUINAR:`);
  for (const c of plan.maquinar) {
    console.log(`    ${c.tipo.padEnd(14)} (${c.x.toFixed(1).padStart(6)}, ${c.y.toFixed(1).padStart(5)}, ${c.z.toFixed(1)})  `
      + `L=${c.flowLenMm.toFixed(1).padStart(5)} mm · R=${c.resistencia.toFixed(2).padStart(6)} · `
      + `llega al ${(c.fracLlenado * 100).toFixed(0)}% del llenado · prioridad ${c.prioridad.toFixed(2)}`);
  }

  // ── 1) EL VENTEO VA AL BRAZO DELGADO (x < 0), NO AL LEJANO ──────────────
  const primero = plan.maquinar[0];
  check('hay al menos un venteo enumerado', !!primero, `${plan.nCandidatos} candidatos`);
  if (primero) {
    check('EL VENTEO VA AL BRAZO DELGADO (x<0), no al más lejano (x>0) — §5.5.5 race tracking',
      primero.x < 0,
      `x = ${primero.x.toFixed(1)} mm ⇒ ${primero.x < 0 ? 'brazo DELGADO ✓ (el que se llena al final)' : 'brazo GRUESO ✗ (eligió por distancia, no por resistencia)'}`);
    check('el venteo NO está en el punto más lejano (L máx del campo)',
      Math.abs(primero.flowLenMm - campo.maxFlowLenMm) > 5,
      `venteo en L=${primero.flowLenMm.toFixed(1)} mm vs L máx del campo ${campo.maxFlowLenMm.toFixed(1)} mm — distancia y orden de llenado NO coinciden`);
    check('el venteo cae cerca de la PUNTA del brazo delgado (x ≈ -30)',
      primero.x < -LD * 0.7,
      `x = ${primero.x.toFixed(1)} mm vs punta en -${LD}`);
    check('el primer venteo llega en la cola del llenado (>85 %)',
      primero.fracLlenado > 0.85,
      `${(primero.fracLlenado * 100).toFixed(1)} % del volumen ya lleno cuando el frente llega ahí`);
  }

  // ── 2) LAS DOS LISTAS: maquinados + RESERVADOS (§8.1) ───────────────────
  check('el plan entrega DOS listas (maquinar + reservados §8.1)',
    Array.isArray(plan.maquinar) && Array.isArray(plan.reservados),
    `${plan.maquinar.length} a maquinar, ${plan.reservados.length} reservados`);
  check('los maquinados salen ordenados por prioridad (el último en llenarse primero)',
    plan.maquinar.every((c, i) => i === 0 || plan.maquinar[i - 1].prioridad >= c.prioridad),
    plan.maquinar.map((c) => c.prioridad.toFixed(2)).join(' ≥ '));
  check('ningún reservado tiene más prioridad que el último maquinado',
    !plan.reservados.length || !plan.maquinar.length
      || plan.reservados[0].prioridad <= plan.maquinar[plan.maquinar.length - 1].prioridad,
    plan.reservados.length ? `reservado top ${plan.reservados[0].prioridad.toFixed(2)} ≤ maquinado último ${plan.maquinar[plan.maquinar.length - 1].prioridad.toFixed(2)}` : 'sin reservados');
  check('sin máscara de soldadura lo DECLARA (no aprueba en silencio §8.2.2)',
    plan.notas.some((n) => /soldadura/i.test(n)),
    plan.notas.find((n) => /soldadura/i.test(n)) ?? '(no lo dice)');

  // ── 3) EL AGRUPAMIENTO: una zona = un venteo, no 400 vóxeles ────────────
  check('agrupa por zona (no reporta un candidato por vóxel)',
    plan.nCandidatos < 60,
    `${plan.nCandidatos} candidatos de ${campo.volumeMm3.toFixed(0)} mm³ de pieza — sin agrupar serían cientos`);
  const dMin = (() => {
    let m = Infinity;
    for (let a = 0; a < plan.maquinar.length; a++) for (let b = a + 1; b < plan.maquinar.length; b++) {
      const p = plan.maquinar[a], q = plan.maquinar[b];
      if (p.tipo !== q.tipo) continue;
      m = Math.min(m, Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z));
    }
    return m;
  })();
  check('dos venteos del MISMO tipo nunca quedan más cerca que el radio de agrupamiento',
    !Number.isFinite(dMin) || dMin >= 8 - 1e-6,
    Number.isFinite(dMin) ? `separación mínima ${dMin.toFixed(2)} mm ≥ 8 mm` : 'no hay dos del mismo tipo');

  // ── 4) LA CONVERGENCIA DE FRENTES SE ENUMERA APARTE — §8.2.2 ────────────
  // Se le pasa una máscara de soldadura (la que produce computeWeldMask) y el
  // enumerador debe sacar candidatos tipo 'soldadura' SIN fundirlos con los de
  // final de flujo: el libro pide venteo en los DOS (son defectos distintos).
  const weld = new Uint8Array(campo.cavity.length);
  let nWeld = 0;
  for (let k = 0; k < campo.nz; k++) for (let j = 0; j < campo.ny; j++) for (let i = 0; i < campo.nx; i++) {
    const t = campo.idx(i, j, k);
    if (!campo.cavity[t] || !Number.isFinite(campo.resistance[t])) continue;
    const x = campo.x0 + (i + 0.5) * campo.cellMm;
    if (x > 18 && x < 22) { weld[t] = 1; nWeld++; }     // una franja de soldadura a media pieza
  }
  const planW = V.enumerarVenteos(campo, { weld, nMaquinar: 6, clusterMm: 8 });
  const sold = planW.maquinar.concat(planW.reservados).filter((c) => c.tipo === 'soldadura');
  console.log(`\n  con máscara de soldadura (${nWeld} vóxeles marcados): ${sold.length} candidato(s) tipo soldadura`);
  check('con máscara de soldadura aparecen candidatos de ese tipo (§8.2.2 knit-lines)',
    sold.length > 0, `${sold.length} candidatos 'soldadura'`);
  check('los candidatos de soldadura caen DENTRO de la franja marcada',
    sold.every((c) => c.x > 17 && c.x < 23),
    sold.map((c) => c.x.toFixed(1)).join(', ') || '—');
  check('la soldadura NO se fusiona con el final de flujo (son defectos distintos)',
    planW.maquinar.concat(planW.reservados).some((c) => c.tipo === 'fin-de-flujo') && sold.length > 0,
    `tipos presentes: ${[...new Set(planW.maquinar.concat(planW.reservados).map((c) => c.tipo))].join(', ')}`);

  // ── 5) DETERMINISMO: dos corridas iguales dan el mismo plan ─────────────
  const plan2 = V.enumerarVenteos(campo, { nMaquinar: 4, clusterMm: 8 });
  check('determinista (mismo campo ⇒ mismo plan)',
    JSON.stringify(plan2.maquinar) === JSON.stringify(plan.maquinar),
    `${plan.maquinar.length} venteos idénticos`);

  // ── 6) CAMPO VACÍO: lo dice, no revienta ni inventa ─────────────────────
  const vacio = V.enumerarVenteos({
    ...campo, cavity: new Uint8Array(campo.cavity.length),
  });
  check('campo sin hueco: devuelve vacío y lo DECLARA (no inventa venteos)',
    vacio.maquinar.length === 0 && vacio.notas.length > 0,
    vacio.notas[0] ?? '(sin nota)');

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    venteoX: plan.maquinar[0]?.x, lMaxCampo: campo.maxFlowLenMm,
    nCandidatos: plan.nCandidatos, maquinar: plan.maquinar.length, reservados: plan.reservados.length,
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 800)); process.exit(1); });
