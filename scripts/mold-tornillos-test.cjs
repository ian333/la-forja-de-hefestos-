/**
 * GATE DE LA TORNILLERÍA EN EL ENSAMBLE — "¿como que los tornillos atornillan la placa A
 * y B? wuuuuuut. TODO LO REFERENTE A ESOS TORNILLOS AHÍ ESTÁN MAL CALCULADOS Y
 * DESCONECTADO" (user 2026-07-15, viéndolos flotar en la apertura).
 *
 * Tenía razón, y con números peor de lo que se veía. El tornillo del núcleo salía de
 * `bottomClamp + tB - 6` desde z=0 — una fórmula que asume a la placa B apoyada en la
 * sujeción inferior. En el stack REAL hay el hueco del expulsor y el soporte de por medio:
 *   · el tornillo terminaba 32 mm ANTES de la placa B  → no atornillaba nada
 *   · y cruzaba el hueco del expulsor                  → chocaba con la placa móvil
 *
 * LAS TRES LEYES QUE SE PRUEBAN AQUÍ (las tres las rompía el código):
 *   1. NINGÚN tornillo cruza la partición — A y B se separan CADA ciclo.
 *   2. TODO tornillo AGARRA la placa que dice sujetar (si no, es adorno).
 *   3. NINGÚN tornillo invade el hueco del expulsor (ahí viaja la placa expulsora).
 *
 * Uso: node --import tsx scripts/mold-tornillos-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const T = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'parts', 'tupper.ts'));
  const MM = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldmachine.ts'));
  const PS = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'mold-plano-set.ts'));

  const asm = PS.packageToAssemblySpec(MM.moldMachine(T.tupperMachineSpec()));
  const z = PS.plateStackZ(asm), p = asm.plates;
  const zPart = z.A;                                   // la partición = base de la placa A
  const ejeLo = p.bottomClamp, ejeHi = p.bottomClamp + p.ejectorHousing;   // hueco del expulsor

  console.log(`\nSTACK: B z[${z.B}..${z.B + p.B}] · A z[${z.A}..${z.A + p.A}] · partición z=${zPart}`);
  console.log(`       hueco del expulsor z[${ejeLo}..${ejeHi}] (ahí viaja la placa expulsora)\n`);

  // Las mallas REALES que se ven en pantalla. `buildFunctionalParts` arma la tornillería
  // con primitivas (cuerda ISO + cabeza por regla), sin tocar el kernel → K/oc van null:
  // este gate mide la GEOMETRÍA publicada, no la intención del código.
  let parts;
  try { parts = PS.buildFunctionalParts(null, null, asm); } catch (e) { console.error('BUILD_ERR', String(e && e.stack || e).slice(0, 300)); process.exit(1); }

  const tor = parts.filter((q) => /^tornillos/.test(q.role));
  console.log(`componentes de tornillería: ${tor.map((q) => `${q.role}(${q.bodies})`).join(' · ') || '(ninguno)'}`);

  check('la tornillería se parte en DOS componentes (uno por mitad)', tor.length === 2,
    `${tor.length}: ${tor.map((q) => q.role).join(', ')} — con UNO solo la animación no puede mover cada mitad con su placa`);
  check('existe el lado CAVIDAD y el lado NÚCLEO', tor.some((q) => q.role === 'tornillos-cav') && tor.some((q) => q.role === 'tornillos-core'),
    tor.map((q) => q.role).join(', '));

  // ── LAS TRES LEYES, MEDIDAS SOBRE LA MALLA (no sobre la intención) ────────
  const zSpan = (q) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < q.positions.length; i += 3) { const v = q.positions[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    return { lo, hi };
  };
  for (const q of tor) {
    const s = zSpan(q);
    const esCav = q.role === 'tornillos-cav';
    console.log(`\n${q.role}: z[${s.lo.toFixed(1)}..${s.hi.toFixed(1)}]`);
    // LEY 1 — nadie cruza la partición
    const cruza = esCav ? s.lo < zPart - 0.01 : s.hi > zPart + 0.01;
    check(`[${q.role}] NO cruza la partición (z=${zPart})`, !cruza,
      esCav ? `baja hasta ${s.lo.toFixed(1)} (≥ ${zPart})` : `sube hasta ${s.hi.toFixed(1)} (≤ ${zPart})`);
    // LEY 2 — agarra la placa que dice sujetar
    const plate = esCav ? { lo: z.A, hi: z.A + p.A, n: 'A' } : { lo: z.B, hi: z.B + p.B, n: 'B' };
    const agarra = s.hi > plate.lo + 1 && s.lo < plate.hi - 1;
    check(`[${q.role}] AGARRA de verdad la placa ${plate.n} (z[${plate.lo}..${plate.hi}])`, agarra,
      agarra ? `entra ${(Math.min(s.hi, plate.hi) - Math.max(s.lo, plate.lo)).toFixed(1)} mm en la placa` : 'NO la toca: es adorno');
    // LEY 3 — nadie invade el hueco del expulsor
    const invade = s.lo < ejeHi - 0.01 && s.hi > ejeLo + 0.01;
    check(`[${q.role}] NO invade el hueco del expulsor (z[${ejeLo}..${ejeHi}])`, !invade,
      invade ? 'CHOCA con la placa expulsora móvil' : 'libre');
  }

  console.log(fails ? `\n❌ ${fails} fallaron` : '\n✓ TORNILLERÍA: dos mitades independientes · nadie cruza la partición · todos AGARRAN su placa · el expulsor va libre');
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('TEST_FATAL', String(e && e.stack || e).slice(0, 400)); process.exit(1); });
