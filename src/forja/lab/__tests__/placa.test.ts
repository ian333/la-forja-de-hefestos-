/**
 * LA PLACA SOLDADA (orden 2026-11-05-lab-placa · ronda 2: 2026-11-06-lab-placa-r2): contra fórmulas y contra errores sembrados.
 */
import { describe, it, expect } from 'vitest';
import {
  PLACA, COMPONENTES, ISLAS, BARRENOS, TRAMOS, REDES, PINES_PLACA, Z_TOP, PCB, PCB_RECTS, DT_IPC, CE_SPEC, RIZO_DISENO, BANCO_PLACA, BANCO_V3,
  VENTILADOR_PCB, PRESUPUESTO_12V, AIRE, THETA, PERDIDAS_PEOR, PERDIDAS_SIM, TERMOSTATO_C, DISIPADOR, LC_DISIPADOR, VENT_ANCHO, Q_OPER, Q_REF, TOL_TERMOSTATO, CUNA_B, JUEGO_CUNA, MOTOR, TMC2209, I_MOTOR_A, I_MOTOR_TOPE,
  CADENA_SD, CAUTIN, ALIVIO_PUENTE_MAX, LAZO_COMPUERTA_MAX, MECANICA, FUERA_DE_LA_PLACA,
  revisarPlaca, clonarPlaca, anchoIPC2221, dTIPC2221, dConductor, odCable, rizoBus, vidaElectrolitico, termicaPlaca,
  subidaAlPuerto, bocaUSB, cuentaPlaca, listaMateriales, bomCSV, posicionesCSV, kicadNetlist, leerKicadNetlist,
  huellasPropias, kicadMod, piezasPlaca, nodosPorRed, cajaComp, cajaEnBahia, lazoNh, picoD1, pinWeAct, patasTHT,
  thetaDisipador, largoEnChorro, caudalNecesario, juegoCunaNecesario, corrienteTMC2209, pTMC2209, elegirMotor, sdLlegaAGnd, armado, armadoTexto, comprasMX, sobrePCB,
  type Placa,
} from '../placa';
import { bahia, puerto, PUERTOS, CONEXIONES, REGLAS, DECISIONES as DEC_CONTRATO, enBahia, traslape } from '../laboratorio-contrato';
import { RP2350B, TERMICO } from '../../brep/plumaSistema';
import { CUNA_HS } from '../cuerpo';   // sólo lectura: el tope de silicato de la cuna de B

const errores = (pl: Placa, opt?: Parameters<typeof revisarPlaca>[1]) => revisarPlaca(pl, opt).filter((x) => x.nivel === 'error');
const reglas = (pl: Placa, opt?: Parameters<typeof revisarPlaca>[1]) => errores(pl, opt).map((x) => x.regla);
const con = (f: (pl: Placa) => void, opt?: Parameters<typeof revisarPlaca>[1]) => { const pl = clonarPlaca(); f(pl); return reglas(pl, opt); };
const C = (pl: Placa, ref: string) => pl.componentes.find((c) => c.ref === ref)!;
const J = (pl: Placa, ref: string) => pl.islas.find((i) => i.ref === ref)!;

describe('La placa · el revisor sobre el diseño real', () => {
  it('no tiene errores (los avisos se imprimen)', () => {
    const h = revisarPlaca();
    for (const x of h) console.log(`   ${x.nivel} ${x.regla} ${x.donde}: ${x.texto}`);
    const k = cuentaPlaca();
    console.log(`[placa] ${k.piezas} piezas (${k.smd} SMD, ${k.smdAbajo} abajo) · ${k.islas} islas · ${k.barrenos} barreno · ${k.juntas} juntas · ${k.conectores} conectores · v3: ${k.v3.modeladas} dibujadas + ${k.v3.pasivosOcultos} pasivos que sus chips piden = ${k.v3.total}, ${k.v3.conectores} conectores/bornes, ${k.v3.pcbs} PCB`);
    expect(h.filter((x) => x.nivel === 'error')).toEqual([]);
  });
  it('la cuenta: 50 piezas, cero conectores, una PCB; menos de la mitad que el v3 con sus pasivos', () => {
    const k = cuentaPlaca();
    expect(k.piezas).toBe(COMPONENTES.length);
    expect(k.piezas).toBe(50);
    expect(k.conectores).toBe(0);
    expect(k.pcbs).toBe(1);
    expect(k.piezas).toBeLessThan(k.v3.total / 2);
    expect(k.juntas).toBe(COMPONENTES.reduce((a, c) => a + c.pines.length, 0) + ISLAS.length);
    expect(k.islas).toBe(23);   // 19 de la ronda 1 + K13 (2) + K14 (2)
    const bom = listaMateriales();
    expect(bom.reduce((a, f) => a + f.cantidad, 0)).toBe(k.piezas);
    console.log(`[bom] ${bom.length} renglones · ${bom.map((f) => `${f.cantidad}× ${f.valor}`).join(' · ')}`);
  });
});

describe('La placa · fórmulas', () => {
  it('IPC-2221: I = k·ΔT^0.44·A^0.725 de ida y de vuelta; 40 A / 2 oz / 20 K = 16 mm', () => {
    const w = anchoIPC2221(40, 20, 2);
    const A = (w / 0.0254) * 1.378 * 2;
    expect(Math.abs(0.048 * Math.pow(20, 0.44) * Math.pow(A, 0.725) - 40)).toBeLessThan(1e-9);
    expect(Math.abs(dTIPC2221(40, w, 2) - 20)).toBeLessThan(1e-9);
    expect(w).toBeGreaterThan(15.5); expect(w).toBeLessThan(16.5);
    expect(Math.abs(anchoIPC2221(10, 10, 1) - 7.19)).toBeLessThan(0.05);   // tabla: 10 A, 1 oz, 10 K → ~283 mil
    for (const t of TRAMOS) expect(t.ancho).toBeGreaterThanOrEqual(anchoIPC2221(t.Irms / t.capas, DT_IPC, t.oz));
    console.log(`[ipc] ${TRAMOS.map((t) => `${t.red} ${t.Irms} A: ${t.ancho} mm (pide ${anchoIPC2221(t.Irms / t.capas, DT_IPC, t.oz).toFixed(1)}, sube ${dTIPC2221(t.Irms / t.capas, t.ancho, t.oz).toFixed(1)} K)`).join(' · ')}`);
  });
  it('islas por calibre: el agujero le queda al conductor trenzado (AWG × 1.15) con 0.2–0.8 mm de juego', () => {
    expect(Math.abs(dConductor(10) / 1.15 - 2.588)).toBeLessThan(0.01);   // cal 10 sólido 2.588 mm
    expect(Math.abs(dConductor(8) / 1.15 - 3.264)).toBeLessThan(0.01);
    for (const is of ISLAS) {
      const d = dConductor(is.awg);
      expect(is.agujero - d).toBeGreaterThanOrEqual(0.2);
      expect(is.agujero - d).toBeLessThanOrEqual(0.8);
    }
  });
  it('el lazo de conmutación: ~27 nH → D1 a ~124 V con picos de 70 A (pide 200 V, no 150)', () => {
    const L = lazoNh(55, 15);
    const v = picoD1(L);
    console.log(`[lazo] ${L.toFixed(1)} nH → D1 ${v.toFixed(0)} V (×1.25 = ${(v * 1.25).toFixed(0)} V)`);
    expect(Math.abs(picoD1(15, false) - 63)).toBeLessThan(1e-9);
    expect(Math.abs(picoD1(30, false) - 98.9)).toBeLessThan(1e-9);
    expect(v * 1.25).toBeLessThan(200);
    expect(v * 1.25).toBeGreaterThan(150);
  });
  it('la temperatura de cada pieza = aire + P·θ (y el disipador queda bajo el termostato)', () => {
    const T = termicaPlaca(PERDIDAS_PEOR, true);
    const hs = T.find((x) => x.pieza === 'disipador')!, q1 = T.find((x) => x.pieza.startsWith('Q1'))!;
    expect(Math.abs(hs.T - (AIRE.Ta + (PERDIDAS_PEOR.Q1 + PERDIDAS_PEOR.D1) * THETA.hsVent))).toBeLessThan(1e-9);
    expect(Math.abs(q1.T - (hs.T + PERDIDAS_PEOR.Q1 * THETA.Q1))).toBeLessThan(1e-9);
    expect(hs.T).toBeLessThan(TERMOSTATO_C);
    expect(T.every((x) => x.estado === 'ok')).toBe(true);
    const Ts = termicaPlaca(PERDIDAS_SIM, true);
    console.log(`[térmico] peor caso: ${T.map((x) => `${x.pieza} ${x.T.toFixed(0)} °C`).join(' · ')}`);
    console.log(`[térmico] con las pérdidas de plumaSistema: disipador ${Ts[0].T.toFixed(0)} °C · Q1 ${Ts[1].T.toFixed(0)} °C`);
  });
  it('vida del electrolítico: Arrhenius ×2 cada 10 K con el núcleo a Ta + I²·ESR·θ', () => {
    const v = vidaElectrolitico(4.82, 35);
    expect(Math.abs(v.Tnucleo - (35 + 4.82 * 4.82 * CE_SPEC.esr * CE_SPEC.theta))).toBeLessThan(1e-9);
    expect(Math.abs(v.horas - CE_SPEC.L0 * Math.pow(2, (CE_SPEC.Tr - v.Tnucleo) / 10))).toBeLessThan(1e-6);
    expect(v.horas).toBeGreaterThan(50000);
  });
});

describe('La placa · el difusor (P8): termicaPlaca con el chorro sobre el disipador', () => {
  it('θSA = 1/(f·√v/θ_vent + (1−f)/θ_aire), v = (Q/Qref)·80/Lc; Lc sale del contrato y Q del modelo de B', () => {
    const dif = bahia('DIFUSOR').caja;
    expect(VENT_ANCHO).toBe(80);
    expect(Math.abs(Q_REF * 3600 - 37)).toBeLessThan(1e-9);    // contrato, bahía DIFUSOR: ~37 m³/h (donde se toma el 0.7 K/W)
    expect(Math.abs(Q_OPER * 3600 - 35.1)).toBeLessThan(1e-9); // el modelo de B (rejillas + placa + difusor + cuna) con el ventilador de 0.25 A
    expect(LC_DISIPADOR).toBeCloseTo(Math.min(DISIPADOR.y1, dif.y1) - Math.max(DISIPADOR.y0, dif.y0), 9);
    const f = LC_DISIPADOR / DISIPADOR.largo, v = (Q_OPER / Q_REF) * (VENT_ANCHO / LC_DISIPADOR);
    const esperado = 1 / ((f * Math.sqrt(v)) / TERMICO.disipador.thetaSA_vent + (1 - f) / TERMICO.disipador.thetaSA_aire);
    expect(Math.abs(thetaDisipador(LC_DISIPADOR) - esperado)).toBeLessThan(1e-12);
    expect(THETA.hsVent).toBeCloseTo(esperado, 12);
    // los límites: todo el largo a la velocidad del ventilador → θ_vent; nada en el chorro → θ_aire
    expect(thetaDisipador(80, Q_OPER, Q_OPER)).toBeGreaterThan(TERMICO.disipador.thetaSA_vent);
    expect(thetaDisipador(0)).toBeCloseTo(TERMICO.disipador.thetaSA_aire, 12);
    // sin difusor (el chorro de 80 de la ronda 1 cubría 78 de 125) el disipador está peor
    const sinDif = thetaDisipador(largoEnChorro(false, { y0: -77.75, y1: 47 }));
    console.log(`[difusor] ${LC_DISIPADOR} de ${DISIPADOR.largo} mm en el chorro: θSA ${THETA.hsVent.toFixed(3)} K/W · sin difusor (ronda 1, 78 mm) ${sinDif.toFixed(3)} K/W · disipador ${(AIRE.Ta + (PERDIDAS_PEOR.Q1 + PERDIDAS_PEOR.D1) * THETA.hsVent).toFixed(1)} °C contra ${(AIRE.Ta + (PERDIDAS_PEOR.Q1 + PERDIDAS_PEOR.D1) * sinDif).toFixed(1)}`);
    expect(THETA.hsVent).toBeLessThan(sinDif);
    expect(LC_DISIPADOR).toBeGreaterThan(100);
    // el aire: ρ·cp·Q del caudal de operación
    expect(AIRE.WporK).toBeCloseTo(1.2 * 1005 * Q_OPER, 12);
  });
  it('con 35.1 m³/h (ventilador de 0.25 A) y 39 W el disipador queda fuera de la banda del KSD301: T5 calla; con 26 (el de antes) avisa', () => {
    const T = termicaPlaca(PERDIDAS_PEOR, true), hs = T.find((x) => x.pieza === 'disipador')!;
    expect(hs.T).toBeLessThan(TERMOSTATO_C - TOL_TERMOSTATO);
    const Qn = caudalNecesario(TERMOSTATO_C - TOL_TERMOSTATO, hs.P);
    expect(Math.abs(AIRE.Ta + hs.P * thetaDisipador(LC_DISIPADOR, Qn) - (TERMOSTATO_C - TOL_TERMOSTATO))).toBeLessThan(1e-6);
    expect(Q_OPER).toBeGreaterThan(Qn);
    expect(revisarPlaca().some((x) => x.regla === 'T5')).toBe(false);
    // el ventilador de 0.15 A (26.1 m³/h): el disipador entra a la banda de tolerancia y T5 avisa (falla segura: aviso, no error)
    const T26 = termicaPlaca(PERDIDAS_PEOR, true, 26.1 / 3600), hs26 = T26.find((x) => x.pieza === 'disipador')!;
    const t5 = revisarPlaca(PLACA, { caudal: 26.1 / 3600 }).find((x) => x.regla === 'T5')!;
    expect(t5.nivel).toBe('aviso');
    expect(hs26.T).toBeGreaterThan(TERMOSTATO_C - TOL_TERMOSTATO);
    console.log(`[aire] ${(Q_OPER * 3600).toFixed(1)} m³/h: disipador ${hs.T.toFixed(1)} °C (margen ${(TERMOSTATO_C - hs.T).toFixed(1)} K) · Q1 ${T[1].T.toFixed(1)} · D1 ${T[2].T.toFixed(1)} · choque ${T[3].T.toFixed(1)} · pide ≥ ${(Qn * 3600).toFixed(1)} m³/h · con 26.1: disipador ${hs26.T.toFixed(1)} °C → ${t5.texto}`);
    // con las pérdidas de plumaSistema (14 W) tampoco
    expect(revisarPlaca(PLACA, { perdidas: PERDIDAS_SIM }).some((x) => x.regla === 'T5')).toBe(false);
  });
  it('el ventilador de 0.25 A cabe en K09 y en el riel de 12 V (E8); un ventilador de 0.3 A no cabe', () => {
    const k09 = CONEXIONES.find((k) => k.id === 'K09')!, k12 = CONEXIONES.find((k) => k.id === 'K12')!;
    expect(VENTILADOR_PCB.I).toBeLessThanOrEqual(k09.Irms);
    expect(PRESUPUESTO_12V.compuerta + VENTILADOR_PCB.I + PRESUPUESTO_12V.motor + PRESUPUESTO_12V.r78 + k12.Irms).toBeLessThanOrEqual(PRESUPUESTO_12V.ps1);
    expect(revisarPlaca().some((x) => x.regla === 'E8')).toBe(false);
    const I0 = VENTILADOR_PCB.I;
    try { (VENTILADOR_PCB as { I: number }).I = 0.3; expect(reglas(PLACA)).toContain('E8'); } finally { (VENTILADOR_PCB as { I: number }).I = I0; }
    expect(comprasMX().find((f) => f.refs[0] === 'VENT1')!.alternativas.length).toBeGreaterThan(0);
  });
  it('el juego contra el tope de silicato de B: dilatación + tolerancias; 0.3 mm (el disipador en y −99) no alcanza', () => {
    expect(CUNA_HS.tope.y1).toBeCloseTo(CUNA_B.topeY, 9);     // el número de B
    expect(CUNA_HS.Ths).toBe(CUNA_B.Tdiseno);
    const juego = DISIPADOR.y0 - CUNA_B.topeY, nec = juegoCunaNecesario();
    console.log(`[cuna] juego ${juego.toFixed(2)} mm, pide ${nec.toFixed(2)} (dilatación ${(nec - 0.6).toFixed(2)} + tolerancias 0.6) · en y −99 quedaba ${(-99 - CUNA_B.topeY).toFixed(2)} y pedía ${juegoCunaNecesario(-99).toFixed(2)}`);
    expect(juego).toBeCloseTo(JUEGO_CUNA, 9);
    expect(juego).toBeGreaterThanOrEqual(nec);
    expect(-99 - CUNA_B.topeY).toBeLessThan(juegoCunaNecesario(-99));
    expect(revisarPlaca().some((x) => x.regla === 'G7')).toBe(false);
  });
  it('el disipador cabe en la bahía SIN entrar a lo cedido y a 1 mm de la boca del difusor', () => {
    const hs = MECANICA[0].caja!, cede = bahia('PLACA_PCB').cede![0];
    expect(cajaEnBahia(hs)).toBe(true);
    expect(traslape(hs, cede)).toBe(0);
    expect(hs.x0 - cede.x1).toBeCloseTo(1, 9);
  });
});

describe('La placa · el rizo del bus (el MNA de La Pluma, con ESL)', () => {
  it('3 × Ø30 llevan ~4.8 A c/u (≤ 0.85 del nominal); los 2 del v3 llevan ~6.7 A (pasa el nominal: el límite era real)', () => {
    const t0 = performance.now();
    const a = rizoBus(BANCO_PLACA), b = rizoBus(BANCO_V3);
    const ea = a.ramas.find((r) => r.id === 'Cbus')!, eb = b.ramas.find((r) => r.id === 'Cbus')!, fa = a.ramas.find((r) => r.id === 'Cfilm')!;
    console.log(`[rizo] placa: ${ea.porPieza.toFixed(2)} A por electrolítico, ${fa.porPieza.toFixed(2)} A por película (I = ${a.I.toFixed(1)} A) · v3: ${eb.porPieza.toFixed(2)} A · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
    expect(Math.abs(a.I - 40)).toBeLessThan(1.5);
    expect(Math.abs(ea.porPieza - RIZO_DISENO.I40.porCap) / RIZO_DISENO.I40.porCap).toBeLessThan(0.1);
    expect(Math.abs(eb.porPieza - RIZO_DISENO.v3.porCap) / RIZO_DISENO.v3.porCap).toBeLessThan(0.1);
    expect(ea.porPieza).toBeLessThan(0.85 * CE_SPEC.Irip);
    expect(eb.porPieza).toBeGreaterThan(CE_SPEC.Irip);
  });
});

describe('La placa · geometría y puertos', () => {
  it('la PCB (en L) y todo lo de adentro caben en la bahía PLACA_PCB con enBahia: nada en lo cedido al difusor', () => {
    const bay = bahia('PLACA_PCB');
    const b = bay.caja;
    expect(PCB.x0 >= b.x0 && PCB.x1 <= b.x1 && PCB.y0 >= b.y0 && PCB.y1 <= b.y1).toBe(true);
    for (const r of PCB_RECTS) expect(cajaEnBahia({ ...r, z0: Z_TOP - 1.6, z1: Z_TOP })).toBe(true);
    for (const c of COMPONENTES) {
      const k = cajaComp(c);
      expect(cajaEnBahia(k), c.ref).toBe(true);
      expect(enBahia([k.x0, k.y0, k.z0], bay, 1e-6) && enBahia([k.x1, k.y1, k.z1], bay, 1e-6), c.ref).toBe(true);
      expect(k.z1, c.ref).toBeLessThanOrEqual(-26 + 1e-9);   // P7: nada de C arriba de z −26
    }
    for (const is of ISLAS) expect(sobrePCB(is.x, is.y, is.pad / 2), is.ref).toBe(true);
  });
  it('cada isla cae en su puerto (tolerancia declarada) con el radio de doblez de REGLAS; el USB-C del WeAct en C.USB', () => {
    for (const is of ISLAS) {
      const s = subidaAlPuerto(is);
      if (!s) { expect(is.reserva).toBe(true); continue; }
      expect(s.ok).toBe(true);
      expect(s.R).toBeCloseTo(REGLAS.dobladoMinK * odCable(is.awg), 9);
      // la ruta termina EN la cara del puerto, a la altura del puerto
      const fin = s.puntos[s.puntos.length - 1], pt = puerto(is.puerto!);
      expect(Math.abs(fin[2] - pt.pos[2])).toBeLessThan(1e-9);
      for (const q of s.puntos) expect(enBahia(q, bahia('PLACA_PCB'), 1e-6), is.ref).toBe(true);
    }
    const u = bocaUSB(), pu = puerto('C.USB');
    expect(Math.hypot(u[0] - pu.pos[0], u[1] - pu.pos[1], u[2] - pu.pos[2])).toBeLessThan(1.5);
    expect(Math.abs(Z_TOP - (pu.pos[2] - 5.7))).toBeLessThan(1e-9);
    // todos los hilos del contrato que tocan la placa tienen isla
    for (const k of CONEXIONES) for (const pu2 of [k.de, k.a].filter((x) => x.startsWith('C.')))
      for (const hilo of k.hilos) expect(ISLAS.some((is) => is.puerto === pu2 && is.hilo === hilo)).toBe(true);
    expect(PUERTOS.filter((x) => x.modulo === 'PLACA_PCB').every((x) => x.id === 'C.USB' || ISLAS.some((is) => is.puerto === x.id))).toBe(true);
    // ya no hay reservas: las 23 islas tienen puerto
    expect(ISLAS.every((is) => is.puerto)).toBe(true);
  });
  it('el lazo del arco: K05 y K06 salen a ≤ REGLAS.lazoArco.sepMaxMm', () => {
    const a = ISLAS.find((x) => x.conexion === 'K05')!, b = ISLAS.find((x) => x.conexion === 'K06')!;
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(REGLAS.lazoArco.sepMaxMm);
  });
  it('el WeAct: 60 pines en dos tiras 2×15 a ±16.51/±19.05 (su dibujo) y los ADC en GP40–46', () => {
    const p40 = pinWeAct('GP40')!, p5v = pinWeAct('5V')!;
    expect(p40.ly).toBeCloseTo(19.05, 9); expect(p5v.ly).toBeCloseTo(-16.51, 9);
    const adc = PINES_PLACA.filter((q) => q.tipo === 'adc');
    expect(adc.length).toBeGreaterThanOrEqual(6);
    expect(adc.length).toBeLessThanOrEqual(RP2350B.adcCanales);
    expect(adc.every((q) => q.gpio >= 40 && q.gpio <= 47)).toBe(true);
  });
  it('las patas THT salen de la huella girada: el WeAct coincide con pinWeAct y el TEN 40 con su cuerpo', () => {
    const pt = patasTHT();
    for (const n of ['1', '30', '60']) {
      const a = pt.find((x) => x.ref === 'U1' && x.n === n)!, w = pinWeAct(n)!;
      expect(a.x).toBeCloseTo(w.x, 9); expect(a.y).toBeCloseTo(w.y, 9);
    }
    const ps1 = COMPONENTES.find((c) => c.ref === 'PS1')!, k = cajaComp(ps1);
    for (const x of pt.filter((q) => q.ref === 'PS1')) expect(x.x >= k.x0 && x.x <= k.x1 && x.y >= k.y0 && x.y <= k.y1).toBe(true);
  });
});

describe('La placa · D2: el IR2110S y su bootstrap abajo, bajo Q1', () => {
  it('U2, Rg, Rgs, Cbs, D3 en la cara de abajo y el IR2110S a ≤ 10 mm de la pata G', () => {
    for (const r of ['U2', 'R5', 'R6', 'R7', 'D3', 'C2', 'C3', 'C4', 'R8']) expect(COMPONENTES.find((c) => c.ref === r)!.pos.lado).toBe('abajo');
    const u2 = cajaComp(COMPONENTES.find((c) => c.ref === 'U2')!), q1 = COMPONENTES.find((c) => c.ref === 'Q1')!;
    const d = Math.hypot(q1.pos.x - Math.max(u2.x0, Math.min(q1.pos.x, u2.x1)), q1.pos.y - Math.max(u2.y0, Math.min(q1.pos.y, u2.y1)));
    console.log(`[compuerta] el IR2110S a ${d.toFixed(1)} mm de la pata G de Q1 (abajo)`);
    expect(d).toBeLessThanOrEqual(LAZO_COMPUERTA_MAX);
    expect(DEC_CONTRATO.find((x) => x.id === 'D2')!.decision).toContain('IR2110S');
  });
});

describe('La placa · K13: la cadena SD con los dos termostatos', () => {
  it('SD → PARO → termostato de la mesa → termostato del disipador → Q2 → GND; abrir cualquiera apaga sin el micro', () => {
    const r = sdLlegaAGnd();
    console.log(`[cadena SD] ${r.camino.join(' · ')}`);
    expect(r.llega).toBe(true);
    expect(r.camino.map((x) => x.split('—')[1].split('→')[0])).toEqual(CADENA_SD.map((x) => x.id));
    for (const es of CADENA_SD.filter((x) => !x.micro)) expect(sdLlegaAGnd(PLACA, es.id).llega, es.id).toBe(false);
    // las dos islas de K13 están en C.MESA y en la cadena
    const k13 = ISLAS.filter((x) => x.conexion === 'K13');
    expect(k13.map((x) => x.puerto)).toEqual(['C.MESA', 'C.MESA']);
    expect(k13.map((x) => x.red).sort()).toEqual(['PARO_R', 'TM_R']);
    expect(FUERA_DE_LA_PLACA.find((f) => f.ref === 'TS2')!.valor).toMatch(/^KSD9700 70 °C NC/);   // plano (contrato P9)
    expect(CADENA_SD.find((x) => x.id === 'K13')!.que).toContain('KSD9700');
    expect(CADENA_SD.find((x) => x.id === 'K14')!.que).toContain(FUERA_DE_LA_PLACA.find((f) => f.ref === 'TS3')!.valor);
  });
  it('caza un puente sobre el termostato de la mesa, y el termostato de la mesa en paralelo con el del disipador', () => {
    expect(con((pl) => { pl.componentes.push({ ...C(pl, 'R9'), ref: 'R99', valor: '0 Ω', pines: [{ n: '1', nombre: '1', red: 'PARO_R', tipo: 'pasivo' }, { n: '2', nombre: '2', red: 'TM_R', tipo: 'pasivo' }], pos: { x: 0, y: 40, giro: 90, lado: 'arriba' } }); })).toContain('E4');
    expect(con((pl) => { J(pl, 'J20').red = 'TM_R'; J(pl, 'J21').red = 'TS_R'; })).toContain('E4');
    expect(con((pl) => { pl.islas = pl.islas.filter((x) => x.conexion !== 'K13'); })).toEqual(expect.arrayContaining(['E4', 'P2']));
  });
});

describe('La placa · K14: el termostato del cuello (pedido de A) en la misma cadena', () => {
  it('J22/J23 en C.SEN junto a K08 (señal), del lado lejos de K07; TM_R → TC_R entre la mesa y el disipador', () => {
    const k14 = ISLAS.filter((x) => x.conexion === 'K14'), k08 = ISLAS.filter((x) => x.conexion === 'K08'), k07 = ISLAS.filter((x) => x.conexion === 'K07');
    expect(k14.map((x) => x.puerto)).toEqual(['C.SEN', 'C.SEN']);
    expect(k14.map((x) => x.red).sort()).toEqual(['TC_R', 'TM_R']);
    expect(k14.every((x) => x.awg === 24)).toBe(true);
    // con la señal: el borde de K08 más lejano de K07, y del motor lo más lejos del grupo
    const dK07 = (is: typeof ISLAS[number]) => Math.min(...k07.map((m) => Math.abs(m.x - is.x)));
    expect(Math.min(...k14.map(dK07))).toBeGreaterThan(Math.max(...k08.map(dK07)));
    expect(Math.min(...k14.map((a) => Math.min(...k08.map((b) => Math.abs(a.x - b.x)))))).toBeLessThan(3);
    const ids = CADENA_SD.map((x) => x.id);
    expect(ids.indexOf('K13')).toBeLessThan(ids.indexOf('K14'));
    expect(ids.indexOf('K14')).toBeLessThan(ids.indexOf('TS1'));
    expect(sdLlegaAGnd(PLACA, 'K14').llega).toBe(false);
    console.log(`[K14] J22/J23 en x ${k14.map((x) => x.x.toFixed(2)).join(' / ')} (C.SEN x 40, tol 12) · si abre el cuello, SD sube por R8`);
  });
  it('caza el cuello puenteado, el cuello sin islas y el cuello en paralelo con el disipador', () => {
    expect(con((pl) => { pl.componentes.push({ ...C(pl, 'R9'), ref: 'R98', valor: '0 Ω', pines: [{ n: '1', nombre: '1', red: 'TM_R', tipo: 'pasivo' }, { n: '2', nombre: '2', red: 'TC_R', tipo: 'pasivo' }], pos: { x: 0, y: 40, giro: 90, lado: 'arriba' } }); })).toContain('E4');
    expect(con((pl) => { pl.islas = pl.islas.filter((x) => x.conexion !== 'K14'); })).toEqual(expect.arrayContaining(['E4', 'P2']));
    expect(con((pl) => { J(pl, 'J22').red = 'TC_R'; J(pl, 'J23').red = 'TS_R'; })).toContain('E4');
  });
});

describe('La placa · K09: puente directo con su barreno de alivio', () => {
  it('J12/J13 aceptan los hilos de fábrica (cal 24 y 26) y el cincho por H1 queda a ≤ 8 mm', () => {
    const k09 = CONEXIONES.find((k) => k.id === 'K09')!;
    expect(k09.puente).toBe(true);
    for (const is of ISLAS.filter((x) => x.conexion === 'K09')) {
      for (const awg of [24, 26]) { const j = is.agujero - dConductor(awg); expect(j).toBeGreaterThanOrEqual(0.2); expect(j).toBeLessThanOrEqual(0.8); }
      const h = BARRENOS.find((b) => b.para === 'K09')!;
      expect(Math.hypot(h.x - is.x, h.y - is.y)).toBeLessThanOrEqual(ALIVIO_PUENTE_MAX);
      expect(is.alivio).toContain('cincho');
    }
  });
  it('caza el puente sin barreno y con el barreno lejos', () => {
    expect(con((pl) => { pl.barrenos = []; })).toContain('P3');
    expect(con((pl) => { pl.barrenos[0].x = -60; pl.barrenos[0].y = 40; })).toContain('P3');
  });
});

describe('La placa · K07 a 12 V: la corriente del TMC2209', () => {
  it('I_rms = (CS+1)/32 · V_fs/(Rs+0.02)/√2: IRUN 27 con vsense 1 da 0.857 A (A corre 0.85); el máximo posible queda bajo el tope', () => {
    expect(CONEXIONES.find((k) => k.id === 'K07')!.nota).toContain(String(I_MOTOR_A));
    expect(I_MOTOR_TOPE).toBe(1.4);
    expect(corrienteTMC2209(31, 0)).toBeCloseTo(0.325 / 0.13 / Math.SQRT2, 12);
    expect(corrienteTMC2209(15, 1)).toBeCloseTo((16 / 32) * (0.18 / 0.13) / Math.SQRT2, 12);
    expect(MOTOR).toEqual(elegirMotor(0.85));
    const I = corrienteTMC2209(MOTOR.irun, MOTOR.vsense);
    console.log(`[motor] vsense ${MOTOR.vsense} · IRUN ${MOTOR.irun} → ${I.toFixed(3)} A rms · IHOLD ${MOTOR.ihold} → ${corrienteTMC2209(MOTOR.ihold, MOTOR.vsense).toFixed(3)} A · máximo con IRUN 31: ${corrienteTMC2209(31, MOTOR.vsense).toFixed(3)} A · VREF de respaldo ${MOTOR.vrefRespaldo} V · chip ${pTMC2209(I).toFixed(2)} W (al tope ${pTMC2209(I_MOTOR_TOPE).toFixed(2)} W)`);
    expect(Math.abs(I - I_MOTOR_A) / I_MOTOR_A).toBeLessThan(0.05);
    expect(corrienteTMC2209(31, MOTOR.vsense)).toBeLessThan(I_MOTOR_TOPE);
    expect(corrienteTMC2209(31, 0, TMC2209.rsense, MOTOR.vrefRespaldo)).toBeCloseTo(I_MOTOR_A, 2);
    expect(MOTOR.VM).toBe(12);
    // la térmica usa la potencia del chip AL TOPE en el peor caso
    expect(PERDIDAS_PEOR.U4).toBeCloseTo(pTMC2209(I_MOTOR_TOPE), 12);
  });
  it('caza la escala grande (vsense 0: un IRUN mal escrito pasa el tope) y una corriente que no es la de A', () => {
    expect(con((pl) => { pl.motor.vsense = 0; })).toContain('M2');
    expect(con((pl) => { pl.motor.irun = 31; pl.motor.vsense = 0; })).toContain('M2');
    expect(con((pl) => { pl.motor.irun = 15; })).toContain('M2');
  });
});

describe('La placa · D3: el armado como datos', () => {
  it('SMD abajo → arriba → potencia al final con cautín ≥ 80 W, punta 5 mm y la placa a ~100 °C', () => {
    const P = armado();
    console.log(armadoTexto());
    const paso = (ref: string) => P.find((s) => s.refs.includes(ref))!.n;
    const abajo = COMPONENTES.filter((c) => c.pos.lado === 'abajo').map((c) => paso(c.ref));
    const arriba = COMPONENTES.filter((c) => c.pos.lado === 'arriba').map((c) => paso(c.ref));
    expect(Math.max(...abajo)).toBeLessThan(Math.min(...arriba));
    const ultimo = P[P.length - 1];
    for (const is of ISLAS.filter((x) => x.awg <= 8)) expect(paso(is.ref)).toBe(ultimo.n);
    expect(ultimo.cautin!.W).toBeGreaterThanOrEqual(80);
    expect(ultimo.cautin!.puntaMm).toBeGreaterThanOrEqual(5);
    expect(ultimo.cautin!.precalentarC).toBe(100);
    expect(paso('D2')).toBeLessThan(paso('L1'));   // D2 vive bajo el choque
    for (const c of COMPONENTES.filter((x) => x.grupo === 'potencia' && x.montaje === 'THT')) expect(P.find((s) => s.refs.includes(c.ref))!.cautin!.W, c.ref).toBeGreaterThanOrEqual(80);
    expect(DEC_CONTRATO.find((x) => x.id === 'D3')!.decision).toContain('80 W');
    expect(CAUTIN.grueso.W).toBe(80);
  });
  it('caza el choque soldado antes de lo que queda debajo, una isla de cal 8 a media placa y un cautín chico', () => {
    const mover = (f: (P: ReturnType<typeof armado>) => void) => { const P = JSON.parse(JSON.stringify(armado())) as ReturnType<typeof armado>; f(P); return reglas(PLACA, { armado: P }); };
    expect(mover((P) => { const sL = P.find((s) => s.refs.includes('L1'))!, sD = P.find((s) => s.refs.includes('D2'))!; sL.refs = sL.refs.filter((r) => r !== 'L1'); sD.refs.push('L1'); sD.refs = sD.refs.filter((r) => r !== 'D2'); sL.refs.push('D2'); })).toContain('A1');
    expect(mover((P) => { const u = P[P.length - 1]; u.refs = u.refs.filter((r) => r !== 'J3'); P[3].refs.push('J3'); })).toContain('A1');
    expect(mover((P) => { P[P.length - 1].cautin = { W: 60, puntaMm: 2, tempC: 350 }; })).toContain('A1');
    expect(mover((P) => { P[1].refs = P[1].refs.filter((r) => r !== 'U2'); P[P.length - 2].refs.push('U2'); })).toContain('A1');
    expect(mover((P) => { const s = P.find((x) => x.refs.includes('Q1'))!; s.cautin = { ...CAUTIN.fino }; })).toContain('A1');   // Q1 en 2 oz con 40 W
  });
});

describe('La placa · compras en México', () => {
  it('cada pieza comprada lleva una alternativa; lo que no se verificó en la web va como SUPUESTO', () => {
    const cm = comprasMX();
    expect(cm.length).toBe(listaMateriales().length + MECANICA.length + FUERA_DE_LA_PLACA.length);
    for (const f of cm) {
      expect(f.alternativas.length, f.refs.join(' ')).toBeGreaterThan(0);
      expect(f.verificado || /SUPUESTO/.test(f.supuesto ?? ''), f.refs.join(' ')).toBe(true);
    }
    const tiendas = new Set(cm.flatMap((f) => f.alternativas.map((a) => a.tienda)));
    console.log(`[méxico] ${cm.length} renglones · tiendas: ${[...tiendas].join(', ')} · verificados en la web: ${cm.filter((f) => f.verificado).length}`);
    expect(bomCSV().split('\n')[0]).toContain('México');
  });
  it('caza una pieza sin alternativa y una alternativa sin verificar que no dice SUPUESTO', () => {
    const cm = comprasMX();
    expect(reglas(PLACA, { compras: cm.map((f, i) => (i === 0 ? { ...f, alternativas: [] } : f)) })).toContain('C1');
    expect(reglas(PLACA, { compras: cm.map((f, i) => (i === 0 ? { ...f, supuesto: undefined } : f)) })).toContain('C1');
  });
});

describe('La placa · errores sembrados', () => {
  it('caza una red con dos fuentes (el R-78E también empuja +12 V)', () => {
    expect(con((pl) => { C(pl, 'PS2').pines.find((q) => q.nombre === 'Vout')!.red = '+12V'; })).toContain('E1');
  });
  it('caza una entrada flotando (MS1 del TMC2209 suelto)', () => {
    expect(con((pl) => { C(pl, 'U4').pines.find((q) => q.nombre === 'MS1')!.red = 'MS1_SUELTO'; })).toContain('E2');
  });
  it('caza un integrado sin desacoplo, y uno con el desacoplo lejos', () => {
    expect(con((pl) => { pl.componentes = pl.componentes.filter((c) => c.ref !== 'C1'); })).toContain('E3');
    expect(con((pl) => { C(pl, 'C3').pos = { x: 0, y: 30, giro: 0, lado: 'abajo' }; })).toContain('E3');
  });
  it('caza la falla segura rota: SD sin pull-up (el IR2110 la jala abajo = ENCENDIDO) y un atajo en la cadena PARO', () => {
    expect(con((pl) => { pl.componentes = pl.componentes.filter((c) => c.ref !== 'R8'); })).toContain('E4');
    expect(con((pl) => { C(pl, 'R9').pines[0].red = 'PARO_R'; })).toContain('E4');
    expect(con((pl) => { pl.componentes = pl.componentes.filter((c) => c.ref !== 'R15'); })).toContain('E4');
  });
  it('caza la alterna en la placa', () => {
    expect(con((pl) => {
      pl.redes.push({ nombre: 'AC-L', vmin: -325, vmax: 325, funcion: 'ac' });
      pl.islas.push({ ...pl.islas[0], ref: 'J99', red: 'AC-L', hilo: 'L', puerto: null, conexion: null, x: 0, y: 40 });
    })).toContain('E5');
  });
  it('caza una pista angosta (SW de 5 mm para 40 A)', () => {
    expect(con((pl) => { pl.tramos.find((t) => t.red === 'SW')!.ancho = 5; })).toContain('P1');
  });
  it('caza una isla fuera de su puerto, una isla sin radio de doblez y una subida que choca', () => {
    expect(con((pl) => { J(pl, 'J4').x = -35; })).toContain('G3');
    expect(con((pl) => { J(pl, 'J4').y = 30; })).toContain('G3');   // a 18 mm de la cara, R = 34.8
    expect(con((pl) => { const j = J(pl, 'J3'); j.x = -51; j.y = -28; })).toEqual(expect.arrayContaining(['G3']));
    // Cout encima de la columna por donde sube el OUT+ (cal 8) a su puerto (la misma falla de la ronda 1, anclada a J3)
    expect(con((pl) => { const j = J(pl, 'J3'), c = C(pl, 'C16'); c.pos.x = j.x - c.cuerpo.dx; c.pos.y = j.y; })).toEqual(expect.arrayContaining(['G2', 'G4']));
  });
  it('caza un cable que en su CURVA pasa por una pieza alta (la ruta entera, no sólo la isla)', () => {
    // un electrolítico de 52 mm justo detrás de J3: la isla está libre pero el arco de R 34.8 lo atraviesa
    expect(con((pl) => { const c = C(pl, 'C12'); c.pos.x = J(pl, 'J3').x - 5; c.pos.y = 30; })).toContain('G4');
  });
  it('caza un agujero chico para el cal 8 y una junta de cal 8 sin alivio de tensión', () => {
    expect(con((pl) => { J(pl, 'J3').agujero = 3.2; })).toContain('P2');
    expect(con((pl) => { delete J(pl, 'J4').alivio; })).toContain('P3');
  });
  it('caza piezas encimadas y fuera de la bahía', () => {
    expect(con((pl) => { C(pl, 'U4').pos = { ...C(pl, 'PS1').pos }; })).toContain('G2');   // (ronda 1: U4 sobre el TEN 40)
    expect(con((pl) => { C(pl, 'L1').cuerpo.dz = 40; })).toContain('G1');
  });
  it('caza una pieza, una isla o el disipador dentro de lo cedido al difusor (enBahia)', () => {
    expect(con((pl) => { C(pl, 'R3').pos = { x: -105, y: -50, giro: 90, lado: 'arriba' }; })).toContain('G1');
    expect(con((pl) => { const j = J(pl, 'J12'); j.x = -105; j.y = 0; })).toEqual(expect.arrayContaining(['G5']));
    expect(cajaEnBahia({ ...MECANICA[0].caja!, x0: MECANICA[0].caja!.x0 - 22, x1: MECANICA[0].caja!.x1 - 22 })).toBe(false);   // el disipador de la ronda 1
  });
  it('caza K05 y K06 separados (el lazo del arco se abre)', () => {
    expect(con((pl) => { J(pl, 'J4').x = J(pl, 'J3').x + 30; })).toEqual(expect.arrayContaining(['G6']));
  });
  it('caza el IR2110S arriba o lejos de Q1 (D2)', () => {
    expect(con((pl) => { C(pl, 'U2').pos.lado = 'arriba'; })).toContain('L2');
    expect(con((pl) => { C(pl, 'U2').pos.x += 40; })).toContain('L2');
  });
  it('caza una pieza SMD de abajo encima de una pata THT', () => {
    const pata = patasTHT().find((x) => x.ref === 'C14' && x.n === '1')!;
    expect(con((pl) => { C(pl, 'R7').pos.x = pata.x; C(pl, 'R7').pos.y = pata.y; })).toContain('G2');
  });
  it('caza el horno: sin ventilador el disipador y el choque se queman (el termostato es la última línea)', () => {
    expect(con(() => {}, { ventilador: false })).toContain('T1');
  });
  it('caza el límite del bus: con los 2 electrolíticos del v3 el rizo pasa el nominal', () => {
    expect(con((pl) => { pl.componentes = pl.componentes.filter((c) => c.ref !== 'C12'); })).toContain('T2');
  });
  it('caza un D1 de 150 V (el pico del lazo con picos de 70 A pide 200 V) y un capacitor de 25 V en el bus', () => {
    expect(con((pl) => { C(pl, 'D1').vmax = 150; })).toContain('L1');
    expect(con((pl) => { C(pl, 'C13').vmax = 25; })).toContain('E7');
  });
  it('caza un ADC en un pin que no es ADC del RP2350B (contra el SDK)', () => {
    expect(con((pl) => { pl.pines.find((q) => q.gpio === 43)!.gpio = 26; })).toContain('M1');
  });
});

describe('La placa · KiCad', () => {
  it('la netlist «export (version D)» se genera y se lee de regreso igual', () => {
    const txt = kicadNetlist();
    const n = leerKicadNetlist(txt);
    expect(n.version).toBe('D');
    expect(n.componentes.length).toBe(COMPONENTES.length + ISLAS.length + BARRENOS.length);
    for (const c of COMPONENTES) {
      const k = n.componentes.find((x) => x.ref === c.ref)!;
      expect(k.valor).toBe(c.valor); expect(k.huella).toBe(c.huella);
    }
    const nodos = nodosPorRed();
    expect(n.redes.length).toBe(nodos.size);
    for (const r of n.redes) {
      const orig = nodos.get(r.nombre)!;
      expect(r.nodos.map((x) => `${x.ref}.${x.pin}`).sort()).toEqual(orig.map((x) => `${x.ref}.${x.pin}`).sort());
    }
    expect(n.redes.every((r) => REDES.some((x) => x.nombre === r.nombre))).toBe(true);
    console.log(`[kicad] ${n.componentes.length} huellas · ${n.redes.length} redes · ${txt.length} bytes`);
  });
  it('las huellas propias tienen tantos pads como pines su componente', () => {
    const hp = huellasPropias();
    for (const c of COMPONENTES.filter((x) => x.huella.startsWith('forja_lab:'))) {
      const nombre = c.huella.split(':')[1];
      expect(hp[nombre], nombre).toBeDefined();
      expect(hp[nombre].pads.length).toBe(c.pines.length);
      expect(kicadMod(nombre, hp[nombre])).toContain(`(footprint "${nombre}"`);
    }
  });
  it('la lista de materiales y las posiciones salen en CSV', () => {
    expect(bomCSV().split('\n')[0]).toContain('huella KiCad');
    expect(posicionesCSV().split('\n').length).toBe(COMPONENTES.length + ISLAS.length + BARRENOS.length + 2);
  });
});

describe('La placa · para verla en La Forja', () => {
  it('piezasPlaca: la PCB es «pcb», reúsa las mallas del banco y cada isla del contrato trae su cable', () => {
    const pz = piezasPlaca();
    expect(pz.find((x) => x.id === 'pcb')!.mat).toBe('pcb');
    expect(pz.find((x) => x.id === 'pcb')!.perfil!.length).toBe(6);   // la L
    const urls = new Set(pz.filter((x) => x.url).map((x) => x.url));
    for (const u of ['to220.bin', 'pelicula-mks4.bin', 'disipador-125.bin']) expect(urls.has(`/modelos/banco-arco/${u}`)).toBe(true);
    expect(pz.filter((x) => x.id.startsWith('cable-')).length).toBe(ISLAS.filter((i) => i.puerto).length);
    expect(new Set(pz.map((x) => x.id)).size).toBe(pz.length);
  });
});
