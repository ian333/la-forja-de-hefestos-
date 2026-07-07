// TEST Kazmer cap 11 — cup 1,800 N; bezel 4,700 N y pines (p.267-272).
(async () => {
  const path = require('path');
  const ej = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'ejection.ts'));
  const { ABS_EJECT } = ej;
  const ok = (a, b, eps) => Math.abs(a - b) <= eps;
  const checks = {};
  // cup (p.267): A=526mm², draft 1° → ≈1,800 N
  const fCup = ej.ejectionForce(ABS_EJECT, 1, 526e-6);
  console.log('F cup:', fCup.toFixed(0), 'N (libro ~1800)');
  checks.cup = ok(fCup, 1800, 60);
  // bezel (p.268): A_eff Eq 11.8 = 1.3e-3 m² → ≈4,700 N
  const aEff = ej.effectiveArea({ h: 0.0015, L: 0.24, W: 0.16, nWalls: 4, hWall: 0.01, nRibs: 7, tRib: 0.001, hRib: 0.01 });
  console.log('A_eff:', (aEff * 1e6).toFixed(0), 'mm² (libro 1300)');
  checks.aeff = ok(aEff, 1.33e-3, 0.005e-3);  // la suma exacta da 1.33e-3; el libro redondea a 1.3
  const fBez = ej.ejectionForce(ABS_EJECT, 1, aEff);
  console.log('F bezel:', fBez.toFixed(0), 'N (libro ~4700)');
  checks.bezel = ok(fBez, 4700, 150);
  // pines (p.270-271): 20 pines → compresión D≥0.8mm, cortante D≥2.23mm (gobierna)
  const pins = ej.ejectorPinSizing(ABS_EJECT, 4700, 20, 0.0015);
  console.log('pines: comp', pins.dMinCompressionMm.toFixed(2), '(0.8) | shear', pins.dMinShearMm.toFixed(2), '(2.23) | área', pins.pushAreaMm2.toFixed(1), 'mm² (10.4)');
  checks.dComp = ok(pins.dMinCompressionMm, 0.8, 0.05);
  checks.dShear = ok(pins.dMinShearMm, 2.23, 0.06);
  checks.area = ok(pins.pushAreaMm2, 10.4, 0.3);
  checks.governa = ok(pins.dMinMm, pins.dMinShearMm, 1e-9);

  // ── VECTOR de expulsión: se REDUCE al escalar del libro cuando el peso es despreciable ──
  // cup con masa ~15 g eyectado HACIA ARRIBA (la gravedad opone, pero es <0.2 N vs 1800)
  const vCup = ej.ejectionVector(ABS_EJECT, { aEffM2: 526e-6, draftDeg: 1, massKg: 0.015, ejectAxis: [0, 1, 0] });
  console.log('VECTOR cup: σ', (vCup.sigmaPa / 1e6).toFixed(2), 'MPa | F_normal', vCup.fNormalN.toFixed(0), '| F_stick', vCup.fStickN.toFixed(0), '| W', vCup.weightN.toFixed(2), '| F_eject', vCup.fEjectN.toFixed(0), 'N');
  checks.vecReduce = ok(vCup.fEjectN, 1800, 60);                 // ≈ escalar del libro
  checks.sigma = ok(vCup.sigmaPa, 7.05e6, 0.1e6);               // σ = E·CTE·ΔT (11.5)
  checks.fNormal = ok(vCup.fNormalN, 3706, 30);                 // σ·A_eff (11.6)
  checks.pesoArriba = vCup.weightAxialN > 0;                    // eyectar hacia arriba: el peso OPONE
  checks.gTierra = ok(vCup.gUsed, 9.81, 1e-9);                  // gravedad REAL Tierra (no Marte)

  // gravedad AYUDA cuando se eyecta hacia abajo (mismo eje que g)
  const vDown = ej.ejectionVector(ABS_EJECT, { aEffM2: 526e-6, draftDeg: 1, massKg: 0.015, ejectAxis: [0, -1, 0] });
  checks.pesoAyuda = vDown.fEjectN < vCup.fEjectN;              // hacia abajo cuesta MENOS
  checks.pesoDelta = ok(vCup.fEjectN - vDown.fEjectN, 2 * vCup.weightN, 0.01);  // diferencia = 2·W

  // Marte ≠ Tierra: el peso cambia con g (la broma del user hecha física)
  const vMarte = ej.ejectionVector(ABS_EJECT, { aEffM2: 526e-6, draftDeg: 1, massKg: 0.015, ejectAxis: [0, 1, 0], g: ej.GRAVITY.marte });
  checks.marteMenor = vMarte.weightN < vCup.weightN;           // en Marte pesa menos

  // ── CINEMÁTICA controlada: la máquina (2% del clamp ~400kN → 8kN máx) vence 1853 N a 50 mm/s ──
  const kin = ej.ejectionKinematics({ fMachineMaxN: 8000, fEjectN: vCup.fEjectN, ejectVelMs: 0.05, strokeM: 0.03 });
  console.log('CINEMÁTICA: libera', kin.libera, '| SF', kin.sf.toFixed(1), '| v', (kin.vMs * 1000).toFixed(0), 'mm/s | t', (kin.timeS * 1000).toFixed(0), 'ms');
  checks.libera = kin.libera === true;                        // sí sale del core (8000 ≥ 1853)
  checks.kinSF = ok(kin.sf, 8000 / vCup.fEjectN, 0.01);       // margen de fuerza correcto
  checks.kinTiempo = ok(kin.timeS, 0.03 / 0.05, 1e-9);        // t = carrera/velocidad = 0.6 s
  // margen insuficiente: si la máquina solo da 1500 N < 1853, NO libera
  const kinMal = ej.ejectionKinematics({ fMachineMaxN: 1500, fEjectN: vCup.fEjectN, ejectVelMs: 0.05, strokeM: 0.03 });
  checks.noLibera = kinMal.libera === false;

  // ── PANDEO de Euler del pin: uno esbelto (⌀2.23, libre 60mm) debe tener SF suficiente ──
  const buck = ej.pinBuckling({ diaMm: 2.23, freeLenMm: 60, fPerPinN: 4700 / 20 });
  console.log('PANDEO pin ⌀2.23 L60: F_crit', buck.fCritN.toFixed(0), 'N | SF', buck.sf.toFixed(1), '| ok', buck.ok);
  checks.buckPositivo = buck.fCritN > 0 && isFinite(buck.sf);
  // pin MUY esbelto (⌀1, libre 100mm) debe FALLAR el pandeo (SF<2) — el chequeo sirve
  const buckMal = ej.pinBuckling({ diaMm: 1.0, freeLenMm: 100, fPerPinN: 4700 / 20 });
  checks.buckDetecta = buckMal.ok === false;

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String(e).slice(0, 300)); process.exit(1); });
