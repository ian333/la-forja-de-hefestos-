/**
 * BRAZO VIVO — evidencia de la orden 2026-11-05-brazo-robotico.
 *   1. sin fricción ni par la energía se conserva (< 0.5 % en 10 s);
 *   2. el par estático coincide con jointTorques de brazo.ts (y el motor lo sostiene);
 *   3. el motor en estado estable cumple ω = (V − I·R)/k_e;
 *   4. el control llega a la posición pedida (PID y par computado) y el ciclo de tomar y dejar lleva la carga de A a B;
 *   5. el gaussímetro da µ0·I/2πr junto a un conductor recto, y los marcos del brazo no tuercen el campo;
 *   6. con motores, fricción y carga el balance de energía cierra.
 */
import { describe, it, expect } from 'vitest';
import { jointTorques } from '../../mech/brazo';
import { mu0 } from '../../../lib/physics/constants';
import { fieldB, type CurrentSegment, type Vec3 } from '../../../lib/physics/em';
import {
  PARAMS_BRAZO, nuevoBrazo, correrBrazo, fijarModo, energiaMec, parEstatico, leerBrazo, derivarJunta, posesCuerpos,
  fuentesDelBrazo, fuenteDePolis, gaussimetro, nuevasPoses, aRaiz, cicloidal, piezasBancoBrazo, ikBrazo, puntaDe,
  type BrazoParams, type V3,
} from '../brazoVivo';

const conTray = (p: BrazoParams, t: Partial<BrazoParams['tray']>): BrazoParams => ({ ...p, tray: { ...p.tray, ...t } });

describe('brazo vivo — dinámica de cuerpo rígido', () => {
  it('sin fricción ni par (puentes abiertos), la energía se conserva < 0.5 % en 10 s', () => {
    const p: BrazoParams = {
      ...PARAMS_BRAZO, dt: 1e-3,   // 1 kHz
      juntas: PARAMS_BRAZO.juntas.map((j) => ({ ...j, b: 0, tc: 0 })),
    };
    const s = nuevoBrazo(p, [0, 0.3, -0.8], [0.8, 0, 0]);
    for (let j = 0; j < 3; j++) fijarModo(s, j, 'abierto');
    const e0 = energiaMec(s.Mo, s.q, s.qd), E0 = e0.K + e0.U;
    let Kmax = e0.K, deriva = 0;
    for (let k = 0; k < 1000; k++) {
      correrBrazo(s, p, 0.01);
      const e = energiaMec(s.Mo, s.q, s.qd);
      Kmax = Math.max(Kmax, e.K);
      deriva = Math.max(deriva, Math.abs(e.K + e.U - E0));
    }
    console.log(`[energía] 10 s a 1 kHz: K_max = ${Kmax.toFixed(4)} J, |ΔE|_max = ${deriva.toExponential(3)} J → ${((100 * deriva) / Kmax).toExponential(3)} % de K_max`);
    expect(s.t).toBeCloseTo(10, 6);
    expect(Kmax).toBeGreaterThan(1);              // de verdad se movió
    expect(deriva / Kmax).toBeLessThan(0.005);
  });

  it('el par estático coincide con jointTorques de brazo.ts (brazo horizontal extendido)', () => {
    const p: BrazoParams = { ...PARAMS_BRAZO, geo: { ...PARAMS_BRAZO.geo, soloTubos: true } };
    const g = p.geo, carga = g.masaPinza + p.carga;
    const jt = jointTorques({ links: [g.L1, g.L2, g.L3], payloadKg: carga });
    for (const yaw of [0, 1.0, -2.3]) {
      const G = parEstatico(p, [yaw, 0, 0], true);
      console.log(`[estático] yaw ${yaw}: G = [${G.map((x) => x.toFixed(4)).join(', ')}] N·m · brazo.ts = [${jt.jointTorque_Nm.join(', ')}]`);
      expect(Math.abs(G[0])).toBeLessThan(1e-9);               // la base gira en vertical: no carga peso
      expect(Math.abs(G[1] - jt.jointTorque_Nm[0])).toBeLessThan(0.006);   // brazo.ts redondea a 2 decimales
      expect(Math.abs(G[2] - jt.jointTorque_Nm[1])).toBeLessThan(0.006);
    }
    // el codo a 90° (antebrazo vertical): el codo no carga y el hombro solo carga lo de adentro del codo
    const Gv = parEstatico(p, [0, 0, Math.PI / 2], true);
    const mAnte = jt.masses_kg[1] + jt.masses_kg[2] + carga;
    expect(Math.abs(Gv[2])).toBeLessThan(1e-9);
    expect(Gv[1]).toBeCloseTo(9.81 * (jt.masses_kg[0] * 0.225 + mAnte * 0.45), 4);
  });

  it('el motor del hombro SOSTIENE lo que dice brazo.ts: n·k·i → G (estado estable con PID)', () => {
    const p: BrazoParams = conTray({ ...PARAMS_BRAZO, geo: { ...PARAMS_BRAZO.geo, soloTubos: true } }, { modo: 'sostener', qSostener: [0, 0, 0], Tmov: 1 });
    const s = nuevoBrazo(p, [0, 0, 0]);
    s.pegada = true;                                     // la carga ya en la pinza
    correrBrazo(s, p, 0.001);                            // detecta el cambio de masa y lo cuenta
    correrBrazo(s, p, 4);
    const L = leerBrazo(s, p);
    const jt = jointTorques({ links: [450, 400, 350], payloadKg: p.geo.masaPinza + p.carga });
    console.log(`[sostén] par del motor en la salida = [${L.tau.map((x) => x.toFixed(3)).join(', ')}] N·m · brazo.ts = ${jt.jointTorque_Nm.slice(0, 2).join(', ')} · I = [${L.I.map((x) => x.toFixed(3)).join(', ')}] A`);
    expect(Math.abs(L.tau[1] - jt.jointTorque_Nm[0]) / jt.jointTorque_Nm[0]).toBeLessThan(0.02);
    expect(Math.abs(L.tau[2] - jt.jointTorque_Nm[1]) / jt.jointTorque_Nm[1]).toBeLessThan(0.02);
  });
});

describe('brazo vivo — motor DC, reductor y control', () => {
  it('la relación sale de cycloidal.ts (config B de brazo.ts = pernos) × la planetaria', () => {
    const d = derivarJunta(PARAMS_BRAZO.juntas[1]);
    const c = cicloidal(PARAMS_BRAZO.juntas[1].cic);
    expect(c.pernos).toBe(17);
    expect(c.rel).toBe(17);                     // discos fijos, gira la hembra: N_pernos/(N_pernos − N_lóbulos)
    expect(d.n).toBe(85);
    expect(c.capacidad).toBeGreaterThan(30);    // cycloidalCapacity de brazo.ts, 5 discos × 8.6 mm, R 21.4
  });

  it('estado estable: ω_motor = (V − I·R)/k_e', () => {
    const p = conTray(PARAMS_BRAZO, { modo: 'sostener', qSostener: [0, 0.9, -1.6], Tmov: 0.6 });
    const s = nuevoBrazo(p, [0, 0.9, -1.6]);
    fijarModo(s, 0, 'voltaje', 0.15);           // la base a 15 % de 24 V; hombro y codo sostienen con PID
    correrBrazo(s, p, 4);
    const Mo = s.Mo, j = 0;
    const wM = Mo.n[j] * s.qd[j], V = s.V[j], I = s.i[j];
    const pred = (V - I * Mo.R[j]) / Mo.k[j];
    console.log(`[motor] V = ${V.toFixed(3)} V, I = ${I.toFixed(4)} A, ω_motor = ${wM.toFixed(3)} rad/s, (V − I·R)/k_e = ${pred.toFixed(3)} rad/s (${(wM * 60 / (2 * Math.PI)).toFixed(0)} rpm, salida ${(s.qd[j]).toFixed(3)} rad/s)`);
    expect(wM).toBeGreaterThan(50);
    expect(Math.abs(wM - pred) / wM).toBeLessThan(1e-3);
    // y el par del motor iguala a la fricción (viscosa + Coulomb + pérdida del reductor) — el lazo mecánico↔eléctrico cerró
    const tm = Mo.n[j] * Mo.k[j] * I, w = s.qd[j];
    const fr = Mo.b[j] * w + Mo.tc[j] * Math.tanh(w / Mo.wS) + (1 - Mo.eta[j]) * Math.abs(tm) * Math.tanh(w / Mo.wS);
    expect(Math.abs(tm - fr) / fr).toBeLessThan(0.02);
  });

  for (const modo of ['pid', 'par'] as const) {
    it(`el control (${modo}) llega a la posición pedida con gravedad, fricción y 0.5 kg`, () => {
      const objetivo: V3 = [0.6, 0.4, -0.9];
      const p: BrazoParams = { ...conTray(PARAMS_BRAZO, { modo: 'sostener', qSostener: objetivo, Tmov: 1.2 }), ctrl: { ...PARAMS_BRAZO.ctrl, modo } };
      const s = nuevoBrazo(p);
      s.pegada = true; correrBrazo(s, p, 0.001);
      correrBrazo(s, p, 6);
      const err = [0, 1, 2].map((j) => Math.abs(s.q[j] - objetivo[j]) * 180 / Math.PI);
      console.log(`[${modo}] error final = [${err.map((e) => e.toFixed(4)).join(', ')}]°, I = [${Array.from(s.i).map((x) => x.toFixed(3)).join(', ')}] A`);
      for (const e of err) expect(e).toBeLessThan(0.1);
    });
  }

  it('tomar y dejar: la carga va de A a B siguiendo la trayectoria; el balance de energía cierra', () => {
    const p = PARAMS_BRAZO;
    const s = nuevoBrazo(p);
    let errMax = 0, Imax = [0, 0, 0];
    for (let k = 0; k < 800; k++) {
      correrBrazo(s, p, 0.01);
      for (let j = 0; j < 3; j++) { errMax = Math.max(errMax, Math.abs(s.qref[j] - s.q[j])); Imax[j] = Math.max(Imax[j], Math.abs(s.i[j])); }
    }
    const L = leerBrazo(s, p);
    const dB = Math.hypot(s.obj[0] - p.tray.B[0], s.obj[1] - p.tray.B[1]);
    console.log(`[tomar] 8 s: eventos = ${s.eventos.join(' | ')} · carga a ${dB.toFixed(2)} mm de B · error máx ${(errMax * 180 / Math.PI).toFixed(3)}° · |I| máx = [${Imax.map((x) => x.toFixed(2)).join(', ')}] A`);
    console.log(`[balance] E_sum = ${L.Esup.toFixed(3)} J, Joule = ${L.Ejoule.toFixed(3)} J, fricción = ${L.Efric.toFixed(3)} J, carga = ${L.Ecarga.toFixed(3)} J, K+U+½Li² − E0 = ${(L.K + L.U + L.Emag - s.E0).toFixed(4)} J → residuo ${L.residuo.toExponential(2)} J (${(100 * L.residuoRel).toExponential(2)} %)`);
    expect(s.eventos.some((e) => e.includes('toma ('))).toBe(true);
    expect(s.pegada).toBe(false);
    expect(dB).toBeLessThan(5);
    expect(errMax * 180 / Math.PI).toBeLessThan(2);
    expect(L.residuoRel).toBeLessThan(0.005);
  });

  it('la cinemática inversa y la directa se deshacen', () => {
    const P: V3 = [640, -380, 120];
    const q = ikBrazo(PARAMS_BRAZO, P)!;
    const T = puntaDe(PARAMS_BRAZO, q);
    expect(Math.hypot(T[0] - P[0], T[1] - P[1], T[2] - P[2])).toBeLessThan(1e-9);
  });
});

describe('brazo vivo — campo magnético y gaussímetro', () => {
  it('junto a un conductor recto da µ0·I/2πr (contra la fórmula)', () => {
    const f = fuenteDePolis(0, 0, 'recto 2 m', [[[-1000, 0, 0], [1000, 0, 0]]]);
    const P = nuevasPoses();
    for (const r of [2, 5, 20]) {
      const L = gaussimetro([f], P, [3, 0, 0], [0, r, 0]);
      const teo = (mu0 * 3) / (2 * Math.PI * r * 1e-3);
      console.log(`[gauss] r = ${r} mm: |B| = ${(L.mod * 1e3).toFixed(6)} mT, µ0·I/2πr = ${(teo * 1e3).toFixed(6)} mT`);
      expect(Math.abs(L.mod - teo) / teo).toBeLessThan(1e-3);
      expect(L.B[2] / L.mod).toBeCloseTo(1, 9);          // x̂ × ŷ = ẑ
    }
  });

  it('sobre el brazo en una pose cualquiera, el gaussímetro = Biot-Savart directo en el marco del mundo', () => {
    const p = PARAMS_BRAZO, { fuentes } = fuentesDelBrazo(p);
    const q: V3 = [0.7, 0.5, -1.1], I = [2.1, -3.4, 1.7];
    const poses = posesCuerpos(p, q);
    const segs: CurrentSegment[] = [];
    for (const f of fuentes) for (const pl of f.polis) for (let i = 1; i < pl.length; i++) {
      const a = aRaiz(poses[f.cuerpo], pl[i - 1]), b = aRaiz(poses[f.cuerpo], pl[i]);
      segs.push({ id: '', I: I[f.motor], r1: a.map((v) => v * 1e-3) as Vec3, r2: b.map((v) => v * 1e-3) as Vec3 });
    }
    // puntos: junto al cable del codo sobre el brazo, junto al motor del hombro y en el aire
    const cableCodo = fuentes.find((f) => f.tipo === 'cable' && f.motor === 2 && f.cuerpo === 2)!.polis[0][40];
    const pts: V3[] = [aRaiz(poses[2], [cableCodo[0], cableCodo[1] + 6, cableCodo[2]]), aRaiz(poses[1], [0, 160, 80 + 30]), [300, 200, 400]];
    for (const P of pts) {
      const L = gaussimetro(fuentes, poses, I, P);
      const B = fieldB(P.map((v) => v * 1e-3) as Vec3, segs, 1e-12);
      const d = Math.hypot(L.B[0] - B[0], L.B[1] - B[1], L.B[2] - B[2]) / Math.hypot(...B);
      console.log(`[marcos] P = (${P.map((v) => v.toFixed(0)).join(', ')}) mm: |B| = ${(L.mod * 1e6).toFixed(3)} µT, diferencia relativa ${d.toExponential(2)}`);
      expect(d).toBeLessThan(1e-6);
    }
  });

  it('las piezas estáticas tienen la forma de RefPart (ids únicos, grupos con hijos)', () => {
    const pz = piezasBancoBrazo();
    const ids: string[] = [];
    const recorre = (l: typeof pz) => l.forEach((r) => { ids.push(r.id); if (r.kind === 'grupo') { expect(r.hijos!.length).toBeGreaterThan(0); recorre(r.hijos!); } });
    recorre(pz);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
