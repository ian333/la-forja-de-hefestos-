/**
 * EL SISTEMA DE LA PLUMA (orden 2026-11-05-la-pluma-circuito-cableado): contra fórmulas y contra errores sembrados.
 */
import { describe, it, expect } from 'vitest';
import {
  crearPlumaSim, pasoPluma, PLUMA, CABLES, CONECTORES, revisarCableado, listaDeCorte, tempEstable, TERMICO, largoCorte,
  PINES, revisarPines, slicePWM, RP2350B, type Cable, type Conector, type PinMCU,
} from '../plumaSistema';

/** corre el buck con el arco fijo (V_arc) y la referencia fija; devuelve promedios del último tramo */
function corre(Varc: number, Iref: number, ms: number, p = PLUMA) {
  const s = crearPlumaSim(p);
  const pasos = Math.round((ms * 1e-3) / s.dt);
  let n = 0, sI = 0, sI2 = 0, sVsw = 0, Imx = -1e9, Imn = 1e9, sD = 0, sG = 0;
  const N = Math.round(1 / (p.fpwm * s.dt)); let ppSum = 0, ppN = 0, pmx = -1e9, pmn = 1e9;
  const t0 = performance.now();
  for (let k = 0; k < pasos; k++) {
    pasoPluma(s, Varc, Iref, false);
    if (k > pasos * 0.7) {
      n++; sI += s.Iout; sI2 += s.Iout ** 2; sVsw += s.Vsw; Imx = Math.max(Imx, s.IL); Imn = Math.min(Imn, s.IL); sD += s.D; sG += s.gate ? 1 : 0;
      pmx = Math.max(pmx, s.IL); pmn = Math.min(pmn, s.IL);
      if (k % N === 0) { if (pmx > pmn) { ppSum += pmx - pmn; ppN++; } pmx = -1e9; pmn = 1e9; }
    }
  }
  const ms_cpu = performance.now() - t0;
  return { s, I: sI / n, Irms: Math.sqrt(sI2 / n), Vsw: sVsw / n, rizo: ppSum / Math.max(1, ppN), rizoTotal: Imx - Imn, D: sD / n, Dreal: sG / n, pasos, usPorPaso: (ms_cpu * 1000) / pasos };
}

describe('La Pluma · el circuito vivo (MNA)', () => {
  it('el PI lleva la salida a 40 A con un arco de 21 V, y ⟨V_sw⟩ = D_real·V_bus − V_D1·(1−D_real)', () => {
    const r = corre(21, 40, 3);
    const teo = r.Dreal * r.s.Vbus - 0.7 * (1 - r.Dreal);
    console.log(`[pluma] I=${r.I.toFixed(2)} A · D pedido ${r.D.toFixed(3)} / real ${r.Dreal.toFixed(3)} · ⟨Vsw⟩=${r.Vsw.toFixed(2)} V vs ${teo.toFixed(2)} V · rizo ${r.rizo.toFixed(2)} A pp · ${r.usPorPaso.toFixed(1)} µs/paso (${r.pasos} pasos)`);
    expect(Math.abs(r.I - 40)).toBeLessThan(1.5);
    expect(Math.abs(r.Vsw - teo)).toBeLessThan(0.8);
  });
  it('el rizo del choque se parece a V·D(1−D)/(L·f)', () => {
    const r = corre(21, 40, 3);
    const teo = (r.s.Vbus * r.D * (1 - r.D)) / (PLUMA.L * PLUMA.fpwm);
    console.log(`[pluma] rizo ${r.rizo.toFixed(2)} A pp vs fórmula ${teo.toFixed(2)} A pp`);
    expect(Math.abs(r.rizo - teo) / teo).toBeLessThan(0.25);
  });
  it('el rizo del bus se reparte por IMPEDANCIA (y el electrolítico se lleva casi todo: un límite real)', () => {
    const r = corre(21, 40, 3);
    const w = 2 * Math.PI * PLUMA.fpwm;
    const zB = Math.hypot(PLUMA.esrBus, 1 / (w * PLUMA.Cbus)), zF = Math.hypot(PLUMA.esrFilm, 1 / (w * PLUMA.Cfilm));
    const total = 40 * Math.sqrt(r.Dreal * (1 - r.Dreal));
    console.log(`[pluma] rizo del bus ${total.toFixed(1)} A rms: electrolítico ${r.s.IrmsBus.toFixed(2)} A (${(r.s.IrmsBus / 2).toFixed(1)} A por capacitor vs ~5 A nominal) · película ${r.s.IrmsFilm.toFixed(2)} A · |Z| ${(zB * 1e3).toFixed(1)} vs ${(zF * 1e3).toFixed(1)} mΩ`);
    // la fundamental sola diría electrolítico/película = |Zf|/|Zb|; los armónicos del triángulo se van a la película
    expect(r.s.IrmsBus).toBeGreaterThan(r.s.IrmsFilm);
    expect(r.s.IrmsBus / total).toBeGreaterThan(0.5);
    expect(r.s.IrmsBus / total).toBeLessThan(1.05);
  });
  it('los límites: a 31 V la LRS pasa de 1200 W; a 46 V (hueco de 4 mm) el buck de 48 V ni sostiene el arco', () => {
    const a = corre(21, 40, 3), b = corre(31, 40, 3), c = corre(46, 40, 3);
    console.log(`[pluma] LRS: 21 V → ${(a.s.lrsCarga * 100).toFixed(0)} % (${a.s.P.LRS.toFixed(0)} W) · 31 V → ${(b.s.lrsCarga * 100).toFixed(0)} % (${b.s.P.LRS.toFixed(0)} W) · 46 V → I = ${c.I.toFixed(1)} A con D = ${c.D.toFixed(2)} (tope ${PLUMA.Dmax})`);
    expect(a.s.lrsCarga).toBeLessThan(1.0);
    expect(a.s.lrsCarga).toBeGreaterThan(0.6);
    expect(b.s.lrsInst).toBeGreaterThan(1.05);
    expect(b.s.lrsLimitando).toBe(false);   // 1303 W = 27 A: todavía por debajo del tope de corriente
    expect(c.I).toBeLessThan(15);
  });
  it('un corto largo a 70 A: la LRS limita corriente (30 A), el bus se cae y NO se apaga en el instante', () => {
    const s = crearPlumaSim();
    const n = Math.round(4e-3 / s.dt); let limito = false, vMin = 99;
    for (let k = 0; k < n; k++) { pasoPluma(s, 30, 70, false); limito ||= s.lrsLimitando; vMin = Math.min(vMin, s.Vbus); }
    const iLrs = (s.st.v[1] - s.st.v[2]) / PLUMA.Rlrs;
    console.log(`[pluma] 70 A × 30 V (2.1 kW): LRS limitando ${limito} · I_LRS ${iLrs.toFixed(1)} A · bus mínimo ${vMin.toFixed(1)} V · I salida ${s.Iout.toFixed(1)} A · apagada ${s.lrsApagada}`);
    expect(limito).toBe(true);
    expect(iLrs).toBeLessThan(31);
    expect(s.lrsApagada).toBe(false);
  });
});

describe('La Pluma · el revisor del cableado', () => {
  it('el arnés real no tiene errores', () => {
    const h = revisarCableado();
    const err = h.filter((x) => x.nivel === 'error');
    console.log(`[cableado] ${CABLES.length} cables · ${err.length} errores · ${h.length - err.length} avisos`);
    for (const x of h) console.log(`   ${x.nivel} ${x.regla} ${x.donde}: ${x.texto}`);
    expect(err).toEqual([]);
  });
  const conCambio = (f: (c: Cable[], k: Conector[]) => void) => {
    const c: Cable[] = JSON.parse(JSON.stringify(CABLES)), k: Conector[] = JSON.parse(JSON.stringify(CONECTORES));
    f(c, k); return revisarCableado(k, c).filter((x) => x.nivel === 'error').map((x) => x.regla);
  };
  it('caza un calibre corto (bus de 48 V en 18 AWG)', () => {
    expect(conCambio((c) => { c.find((x) => x.id === 'C06')!.calibre = '18'; })).toContain('E3');
  });
  it('caza un pin suelto (falta el termostato)', () => {
    expect(conCambio((c) => { c.splice(c.findIndex((x) => x.id === 'C10'), 1); })).toContain('E1');
  });
  it('caza la polaridad al revés (salida + a la antorcha)', () => {
    expect(conCambio((c) => { const a = c.find((x) => x.id === 'C08')!, b = c.find((x) => x.id === 'C09')!; [a.a, b.a] = [b.a, a.a]; })).toEqual(expect.arrayContaining(['E6']));
  });
  it('caza dos fuentes en una red', () => {
    expect(conCambio((_, k) => { k.find((x) => x.id === 'PB')!.pines.find((p) => p.id === 'BUS+')!.fuente = true; })).toContain('E5');
  });
  it('caza la fase directa a la LRS sin pasar por el PARO', () => {
    expect(conCambio((c) => { const x = c.find((q) => q.id === 'C02')!; x.de = 'IEC.L'; x.red = 'AC-L'; })).toContain('E7');
  });
  it('la lista de corte trae largo, calibre y carga de cada cable', () => {
    const l = listaDeCorte();
    expect(l.length).toBe(CABLES.length);
    expect(l.every((r) => r.largo_mm > 50 && r.carga_pct <= 80)).toBe(true);
    console.log(`[cableado] cobre total ${(l.reduce((a, r) => a + r.largo_mm, 0) / 1000).toFixed(2)} m · el más largo ${Math.max(...CABLES.map(largoCorte))} mm`);
  });
});

describe('La Pluma · los pines del RP2350B (contra el SDK)', () => {
  const con = (f: (p: PinMCU[]) => void) => { const p: PinMCU[] = JSON.parse(JSON.stringify(PINES)); f(p); return revisarPines(p).filter((x) => x.nivel === 'error').map((x) => x.regla); };
  it('el mapa real no tiene errores, y la compuerta tiene 1500 niveles en el slice 0', () => {
    const h = revisarPines();
    for (const x of h) console.log(`   ${x.nivel} ${x.regla} ${x.donde}: ${x.texto}`);
    const adc = PINES.filter((q) => q.tipo === 'adc').length, pwm = PINES.filter((q) => q.tipo === 'pwm');
    console.log(`[pines] ${PINES.length} GPIO · ${adc}/${RP2350B.adcCanales} ADC · PWM: ${pwm.map((q) => `GP${q.gpio}→slice ${slicePWM(q.gpio)!.slice}${slicePWM(q.gpio)!.canal} ${q.frec! / 1e3} kHz (${Math.floor(RP2350B.fsys / q.frec!)} niveles)`).join(' · ')}`);
    expect(h.filter((x) => x.nivel === 'error')).toEqual([]);
    expect(slicePWM(0)).toEqual({ slice: 0, canal: 'A' });
    expect(Math.floor(RP2350B.fsys / 100e3)).toBe(1500);
  });
  it('caza el motor en el slice de la compuerta (20 kHz contra 100 kHz)', () => {
    expect(con((p) => { p.find((q) => q.va.startsWith('DRV8874 EN'))!.gpio = 16; })).toContain('P4');
  });
  it('caza un ADC del Pico 2 (GP26) que en el RP2350B no es ADC', () => {
    expect(con((p) => { p.find((q) => q.va.startsWith('NTC 10 k del choque'))!.gpio = 26; })).toContain('P5');
  });
  it('caza un pin repetido, una UART mal puesta y un hilo del plano con dos señales', () => {
    expect(con((p) => { p.find((q) => q.va === 'zumbador')!.gpio = 0; })).toContain('P2');
    expect(con((p) => { p.find((q) => q.tipo === 'uart-tx')!.gpio = 15; })).toContain('P6');
    expect(con((p) => { p.find((q) => q.va.startsWith('V del bus'))!.por = 'J_PWR.7'; })).toContain('P7');
  });
});

describe('La Pluma · temperatura', () => {
  it('estado estable = Ta + P·Σθ (contra la fórmula)', () => {
    const r = corre(21, 40, 3);
    const T = tempEstable(r.s, true);
    const Ths = TERMICO.Ta + (r.s.P.Q1 + r.s.P.D1) * TERMICO.disipador.thetaSA_vent;
    console.log(`[térmico] Q1 ${r.s.P.Q1.toFixed(1)} W → ${T.Q1.toFixed(0)} °C · D1 ${r.s.P.D1.toFixed(1)} W → ${T.D1.toFixed(0)} °C · choque ${r.s.P.L.toFixed(1)} W → ${T.L.toFixed(0)} °C · disipador ${T.disipador.toFixed(0)} °C · película ${r.s.P.Cfilm.toFixed(2)} W · bus ${r.s.P.Cbus.toFixed(2)} W`);
    expect(Math.abs(T.disipador - Ths)).toBeLessThan(1e-9);
    expect(T.Q1).toBeGreaterThan(T.disipador);
  });
});
