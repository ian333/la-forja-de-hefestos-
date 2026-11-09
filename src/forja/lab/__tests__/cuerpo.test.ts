/**
 * EL CUERPO DEL LABORATORIO (orden 2026-11-05-lab-cuerpo · ronda 2: 2026-11-06-lab-cuerpo-r2): contra fórmulas y
 * contra errores sembrados. El diseño completo (A* + rutas a mano) se calcula UNA vez; cada error sembrado muta una copia.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import {
  disenarCuerpo, juzgarCuerpo, piezasCuerpo, estadoMesa, MESA_TERMICA, PETG, epsBroche, fuerzaBroche, BROCHES,
  radioDisponible, seccionCanal, seccionDe, seccionMixta, cajaImpresion, PERFIL_K1, estructura, seccionColumna, todasLasConexiones, extremos,
  largo, COLOR_FUNCION_LAB, PEDIDOS, kRejilla, aletaSilicato, rutear, dallaValle, EXTRACTOR, presionVent, zetaBordeRedondo, zetaEnsanche,
  rotarAbajo, cajaGirada, cajaDeOp, VENT_PCB, AIRE_C, OD_AWG, COBRE, HUMO, MESA_G, CUNA_HS, SILICATO, PARED, COMPARTEN, K05_AIRE, RONDA,
  type DisenoCuerpo, type Hallazgo,
} from '../cuerpo';
import { CONEXIONES, REGLAS, IMPRESORA, cabeEnLaCama, puerto, bahia, dentro, type V3 } from '../laboratorio-contrato';
import { clearance } from '../../mech/dfm';

let D: DisenoCuerpo;
let H: Hallazgo[];
const copia = (): DisenoCuerpo => JSON.parse(JSON.stringify(D));
const errores = (d: DisenoCuerpo) => juzgarCuerpo(d).filter((x) => x.nivel === 'error');
const reglas = (d: DisenoCuerpo) => errores(d).map((x) => `${x.regla}:${x.donde}`);
const canal = (d: DisenoCuerpo, id: string) => d.canales.find((c) => c.conexion.id === id)!;
const pos = (id: string): V3 => (id === 'LRS.T.AC' ? [-110, 80, -105] : id === 'LRS.T.DC' ? [-110, 150, -105] : puerto(id).pos);

beforeAll(() => {
  const t0 = performance.now();
  D = disenarCuerpo();
  H = juzgarCuerpo(D);
  console.log(`[cuerpo] diseño completo en ${(performance.now() - t0).toFixed(0)} ms (contrato ronda ${RONDA})`);
}, 180_000);

describe('El cuerpo · el diseño real contra el contrato v2', () => {
  it('cero errores: lo que no se puede es del contrato y trae su CAMBIO DE CONTRATO PEDIDO', () => {
    for (const x of H) console.log(`   ${x.nivel.padEnd(8)} ${x.regla.padEnd(4)} ${x.donde}: ${x.texto}`);
    expect(H.filter((x) => x.nivel === 'error')).toEqual([]);
    for (const x of H.filter((q) => q.nivel === 'contrato')) expect(x.texto).toMatch(/CAMBIO DE CONTRATO PEDIDO P\d+/);
    // cada pedido con reglas está respaldado por un hallazgo real (no es una excusa en blanco)
    for (const p of PEDIDOS.filter((q) => q.reglas.length)) expect(H.some((x) => x.nivel === 'contrato' && x.texto.includes(`PEDIDO ${p.id}`))).toBe(true);
    expect(RONDA).toBe(2);
  });
  it('no truena: cada conexión del contrato tiene su canal (aunque sea «sin ruta»), y un puerto inexistente es una ruta sin-ruta con su porqué', () => {
    expect(D.canales.map((c) => c.conexion.id).sort()).toEqual(CONEXIONES.map((c) => c.id).sort());
    const k13 = CONEXIONES.find((c) => c.id === 'K13')!;
    const r = rutear({ ...k13, a: 'NO.EXISTE' }, { rutas: [], enRuta: new Map() } as never);
    expect(r.modo).toBe('sin-ruta');
    expect(r.nota).toMatch(/NO\.EXISTE no está en el contrato/);
  });
});

describe('El cuerpo · la mesa (disipador controlado, modelo 1D)', () => {
  it('el balance cierra: d·P = Q_arriba + G·(T − T_in) + postes, y el escape es T_in + G·ΔT/ṁcp', () => {
    const m = D.mesa, e = m.peor, p = m.control[m.control.length - 1];
    const P = p.d * MESA_TERMICA.P;
    const suma = e.Qtop + e.G * (e.T - MESA_TERMICA.Tin) + e.Qpostes;
    console.log(`[mesa] aletas ${m.aletas.alto} mm a paso ${m.aletas.paso} · 300 °C con d = ${p.d.toFixed(2)}: ${P.toFixed(0)} W · ${(e.Q * 3600).toFixed(0)} m³/h a ${e.dP.toFixed(0)} Pa · escape ${e.Tex.toFixed(1)} °C · τ ${(m.tau / 60).toFixed(1)} min`);
    expect(Math.abs(suma - P)).toBeLessThan(0.5);
    expect(Math.abs(e.Tex - (MESA_TERMICA.Tin + (e.G * (e.T - MESA_TERMICA.Tin)) / e.mcp))).toBeLessThan(1e-6);
  });
  it('sostiene 150–300 °C con la potencia del arco, escape ≤ 65 °C', () => {
    for (const q of D.mesa.control) console.log(`[mesa] ${q.Tset} °C → ventilador ${(q.N * 100).toFixed(0)} % · arco ${(q.d * 100).toFixed(0)} % · escape ${q.Tex.toFixed(1)} °C · ${q.modo}`);
    expect(D.mesa.control.every((q) => q.ok)).toBe(true);
    const e = D.mesa.peor;
    expect(e.G / e.mcp).toBeLessThanOrEqual(35 / (300 - 30) + 1e-3);
    const fuerte = D.mesa.barrido.find((f) => f.al.alto === 8 && f.al.paso === 5)!;
    expect(fuerte.control[fuerte.control.length - 1].ok).toBe(false);
  });
  it('el PETG queda ≤ 70 °C en todo lo que la mesa, el arco y K05 calientan (incluida la campana)', () => {
    for (const q of D.mesa.petg) console.log(`[petg] ${q.T.toFixed(1).padStart(5)} °C · ${q.donde} (${q.nota})`);
    for (const q of D.mesa.vecinos) console.log(`[vecino] ${q.T.toFixed(0)} °C · ${q.donde} — ${q.nota}`);
    expect(D.mesa.petg.every((q) => q.T <= PETG.tUso)).toBe(true);
    expect(D.mesa.peor.T).toBeCloseTo(300, 0);
    expect(D.mesa.petg.some((q) => q.donde.startsWith('campana'))).toBe(true);
  });
  it('el silicato es una aleta corta: decae en 1/m = √(kA/hP)', () => {
    const a = aletaSilicato(300, 20, 12, 12, 12);
    const k = 0.065 + 6e-5 * 165, m = Math.sqrt((12 * 0.048) / (k * 1.44e-4));
    expect(a.decae).toBeCloseTo(1000 / m, 6);
    expect(a.T).toBeLessThan(40);
  });
  it('más ventilador enfría (G sube con el caudal)', () => {
    const al = D.mesa.aletas, a = estadoMesa(1, 0.6, al), b = estadoMesa(1, 1, al);
    expect(b.Q).toBeGreaterThan(a.Q);
    expect(b.T).toBeLessThan(a.T);
  });
  it('MESA.TERM: con el ventilador andando no abre (piso ≤ 70 − 5); con el ventilador muerto abre antes de que el centro pase la Tg', () => {
    const t = D.mesa.termostato;
    console.log(`[termostato] piso bajo él en el punto de 300 °C: ${t.Tnormal.toFixed(1)} °C (margen ${t.margenFalso.toFixed(1)} K) · sin ventilador abre con el bloque a ${t.TbAbre.toFixed(0)} °C y el piso del centro a ${t.TcentroAbre.toFixed(1)} °C (F ${t.Fterm.toFixed(3)} / ${t.Fcentro.toFixed(3)})`);
    expect(t.Tnormal).toBeLessThanOrEqual(MESA_G.termostato.abre - MESA_G.termostato.tol);
    expect(t.TcentroAbre).toBeLessThanOrEqual(80);
    expect(t.Fcentro).toBeGreaterThan(t.Fterm);   // el centro ve más bloque que la orilla
  });
});

describe('El cuerpo · los canales (de puerto a puerto, contrato v2)', () => {
  it('cada conexión tiene su canal continuo de puerto a puerto (K09 es puente; K14 va en el de K08)', () => {
    for (const c of D.canales) console.log(`[canal] ${c.conexion.id} ${c.conexion.funcion.padEnd(10)} ${c.ruta.modo.padEnd(8)} ${c.largo.toFixed(0).padStart(4)} mm · ${String(c.dobleces).padStart(2)} dobleces · R ${isFinite(c.Rdisp) ? c.Rdisp.toFixed(1) : '∞'} (pide ${c.ruta.seccion.Rmin.toFixed(1)}) · ${c.ruta.seccion.w}×${c.ruta.seccion.d} llenado ${(c.ruta.seccion.llenado * 100).toFixed(0)} % · ${c.tapas} tapas · ${c.peines.map((p) => p.tipo).join('/')}${c.ruta.nota ? ` · ${c.ruta.nota}` : ''}`);
    expect(D.canales.length).toBe(todasLasConexiones().length);
    for (const c of D.canales) {
      expect(c.ruta.modo).not.toBe('sin-ruta');
      const p = c.ruta.puntos, [a, b] = extremos(c.conexion).map(pos);
      expect(Math.hypot(p[0][0] - a[0], p[0][1] - a[1], p[0][2] - a[2])).toBeLessThan(0.5);
      expect(Math.hypot(p[p.length - 1][0] - b[0], p[p.length - 1][1] - b[1], p[p.length - 1][2] - b[2])).toBeLessThan(0.5);
      if (c.ruta.modo === 'astar') { const q = c.ruta.canalPts ?? p; for (let s = 0; s + 1 < q.length; s++) expect([0, 1, 2].filter((k) => Math.abs(q[s + 1][k] - q[s][k]) > 1e-6).length).toBe(1); }
    }
    expect(canal(D, 'K09').ruta.modo).toBe('directo');
    expect(CONEXIONES.find((c) => c.id === 'K09')!.puente).toBe(true);
  });
  it('llenado = Σ n·π·Ø²/4 ÷ (ancho·fondo) ≤ 0.4 en todos, con K08 + K14 juntos', () => {
    for (const c of D.canales) {
      const s = seccionDe(c.conexion);
      expect(c.ruta.seccion.llenado).toBeCloseTo(s.llenado, 9);
      expect(s.llenado).toBeLessThanOrEqual(REGLAS.llenadoMax);
    }
    const k08 = CONEXIONES.find((c) => c.id === 'K08')!, k14 = CONEXIONES.find((c) => c.id === 'K14')!, s = seccionMixta([k08, k14]);
    const A = 3 * Math.PI * OD_AWG[26].od ** 2 / 4 + 2 * Math.PI * OD_AWG[24].od ** 2 / 4;
    expect(s.areaCables).toBeCloseTo(A, 9);
    expect(s.llenado).toBeCloseTo(A / (s.w * s.d), 9);
    expect(s.Rmin).toBeCloseTo(6 * OD_AWG[24].od, 9);   // dobla el más grueso
    expect(seccionCanal(k08).areaCables).toBeLessThan(s.areaCables);
  });
  it('K14 viaja en el canal de K08: misma ruta, una sola impresión', () => {
    const k08 = canal(D, 'K08'), k14 = canal(D, 'K14');
    expect(COMPARTEN.K14).toBe('K08');
    expect(k14.ruta.compartido).toBe('K08');
    expect(k14.ruta.puntos).toEqual(k08.ruta.puntos);
    expect(D.piezas.some((p) => p.canal === 'K14')).toBe(false);
  });
  it('el radio disponible: codo de 90° = el tramo; una S corta con arcos < 90° = (L² + m²/4)/m', () => {
    expect(radioDisponible([[0, 0, 0], [30, 0, 0], [30, 30, 0]])).toBeCloseTo(30, 3);
    expect(radioDisponible([[0, 0, 0], [50, 0, 0], [50, 10, 0], [100, 10, 0]])).toBeCloseTo((50 * 50 + 25) / 10, 1);
    expect(radioDisponible([[0, 0, 0], [100, 0, 0], [100, 20, 0], [0, 20, 0]])).toBeCloseTo(10, 3);
  });
  it('dobleces ≥ 6·Ø en todos (K13 incluido, con MESA.TERM en su lugar nuevo)', () => {
    for (const c of D.canales) {
      if (c.ruta.modo === 'directo') continue;
      expect(c.Rdisp).toBeGreaterThanOrEqual(c.ruta.seccion.Rmin - 0.01);
    }
  });
  it('señal a ≥ 15 mm (borde a borde) de toda potencia', () => {
    expect(H.filter((x) => x.regla === 'C4')).toEqual([]);
    for (const id of ['K07', 'K08', 'K10']) expect(canal(D, id).ruta.modo).toBe('astar');
  });
  it('peine junto a cada puerto; abrazadera a ≤ 15 mm de la isla soldada en cal 8 y 10 (C.BUS, C.OUTP, C.OUTN); el puente K09 con su peine', () => {
    for (const [id, isla] of [['K04', 'C.BUS'], ['K05', 'C.OUTP'], ['K06', 'C.OUTN']] as const) {
      const c = canal(D, id), p = puerto(isla).pos;
      expect(c.peines.find((q) => Math.hypot(q.pos[0] - p[0], q.pos[1] - p[1], q.pos[2] - p[2]) <= 15)?.tipo).toBe('abrazadera');
    }
    const f = puerto('C.FAN').pos;
    expect(canal(D, 'K09').peines.some((q) => Math.hypot(q.pos[0] - f[0], q.pos[1] - f[1], q.pos[2] - f[2]) <= 25)).toBe(true);
  });
  it('REGLAS.lazoArco: K05 y K06 a ≤ 25 mm entre ejes de C al pie de la columna; el área usa la ruta REAL de K05', () => {
    const L = D.lazo!;
    console.log(`[lazo] ${L.areaCm2.toFixed(0)} cm² · K05–K06 a ≤ ${L.sepMax.toFixed(1)} mm de C al pie — ${L.nota}`);
    expect(L.sepMax).toBeLessThanOrEqual(REGLAS.lazoArco.sepMaxMm + 0.01);
    expect(L.areaCm2).toBeGreaterThan(0);
    const k05 = canal(D, 'K05').ruta;
    expect(k05.puntos.length).toBeGreaterThan((k05.canalPts ?? []).length);   // canal + aire, no una recta
    expect(k05.puntos[k05.puntos.length - 1]).toEqual(puerto('MARCO').pos);
  });
});

describe('El cuerpo · K05 al aire dentro de la campana (contrato R2)', () => {
  it('el cobre es una aleta: T(s) = Ta + (Tm − Ta)·e^(−s/λ), λ = √(k·A/(h·P)); llega ≤ 70 °C a su tubo', () => {
    const k = D.k05!, od = OD_AWG[8].od / 1000, A = OD_AWG[8].mm2 * 1e-6;
    const lambda = 1000 / Math.sqrt((k.h * Math.PI * od) / (COBRE.k * A));
    console.log(`[K05] ${k.nota} · silla ${k.silla ? `${(k.silla.x1 - k.silla.x0).toFixed(0)}×${(k.silla.y1 - k.silla.y0).toFixed(0)}` : 'no hace falta'}`);
    for (const q of k.holguras) console.log(`[K05] a ${q.T.toFixed(0)} °C, ${q.mm.toFixed(1)} mm de ${q.donde} (${q.material})`);
    expect(k.lambda).toBeCloseTo(lambda, 6);
    expect(k.Tcanal).toBeCloseTo(MESA_TERMICA.Tin + (D.mesa.marco.T - MESA_TERMICA.Tin) * Math.exp(-k.largo / k.lambda), 6);
    expect(k.Tcanal).toBeLessThanOrEqual(PETG.tUso);
    for (const q of k.holguras.filter((x) => x.material === 'PETG')) expect(q.mm).toBeGreaterThanOrEqual(2);
    // y su canal entrega en el puerto virtual del pie de la columna, dentro del paso del humo
    expect(k05Ultimo()).toEqual([K05_AIRE.pos[0], K05_AIRE.pos[1], HUMO.paso.z0]);
  });
});
const k05Ultimo = () => { const c = canal(D, 'K05').ruta.canalPts!; return c[c.length - 1]; };

describe('El cuerpo · la campana y el extractor (Dalla Valle, contrato R2)', () => {
  it('captura ≥ 0.5 m/s en el arco: V = Q/(0.75·(10X² + A)) con Q donde la curva del extractor cruza las pérdidas', () => {
    const h = D.aire.humo;
    console.log(`[humo] ${h.m3h.toFixed(0)} m³/h a ${h.dP.toFixed(0)} Pa (pide ${h.m3hNecesita.toFixed(0)}) · X ${(h.X * 1000).toFixed(0)} mm · boca ${(h.A_boca * 1e6).toFixed(0)} mm² · V en el arco ${h.vCaptura.toFixed(3)} m/s · ζ boca ${h.zBoca.toFixed(3)}`);
    for (const t of h.cadena) console.log(`[humo]   ${t.tramo.padEnd(34)} ${t.Pa.toFixed(1).padStart(5)} Pa · ${t.formula}`);
    console.log(`[humo] alterna (ronda 1, collar a z ≈ 300): ${h.alterna.m3h.toFixed(0)} m³/h → ${h.alterna.vCaptura.toFixed(3)} m/s`);
    expect(h.vCaptura).toBeCloseTo(dallaValle(h.Q, h.X, h.A_boca, 0.75), 9);
    expect(h.vCaptura).toBeCloseTo(h.Q / (0.75 * (10 * h.X ** 2 + h.A_boca)), 9);
    expect(h.vCaptura).toBeGreaterThanOrEqual(REGLAS.capturaHumoMin);
    expect(Math.abs(presionVent(EXTRACTOR, h.Q) - h.cadena.reduce((s, t) => s + t.Pa, 0))).toBeLessThan(0.5);
    expect(h.alterna.vCaptura).toBeLessThan(REGLAS.capturaHumoMin);   // por eso el collar va abajo
    expect(zetaBordeRedondo(0)).toBe(0.5);
    expect(zetaEnsanche(1, 2)).toBeCloseTo(0.25, 12);
  });
  it('material según su temperatura: donde el PETG pasaría de 70 °C va la embocadura de aluminio', () => {
    for (const c of D.campana) console.log(`[campana] ${c.material.padEnd(8)} ${c.donde}: arco ${c.qArco.toFixed(0)} + mesa ${c.qMesa.toFixed(0)} W/m² → ${c.TsiPETG.toFixed(0)} °C si fuera PETG; queda ${c.T.toFixed(0)} °C`);
    for (const c of D.campana) {
      expect(c.T).toBeLessThanOrEqual(PETG.tUso);
      expect(c.material).toBe(c.TsiPETG > PETG.tUso ? 'aluminio' : 'PETG');
    }
    expect(D.campana.some((c) => c.material === 'aluminio')).toBe(true);
  });
  it('la pluma y el zócalo del cuello de A (pregunta de A para K14): t = ¾·z^{4/3}/Qc^{1/3}; δ = V·t', () => {
    const p = D.aire.pluma, z = p.subida_mm / 1000, Qc = p.Qc_W / 1000;
    console.log(`[pluma] ${p.Qc_W.toFixed(0)} W convectivos · sube ${p.subida_mm} mm en ${p.t_ms.toFixed(1)} ms (u0 ${p.u0.toFixed(2)} m/s en el zócalo) · la campana la corre ${p.delta.toFixed(1)} mm · ancho ${p.b.toFixed(1)} mm → no pega en el zócalo: ${(p.fueraDelZocalo * 100).toFixed(2)} %`);
    expect(p.t_ms).toBeCloseTo((1000 * 0.75 * z ** (4 / 3)) / Qc ** (1 / 3), 9);
    expect(p.delta).toBeCloseTo(D.aire.extractor.vCaptura * p.t_ms, 9);
    expect(p.fueraDelZocalo).toBeGreaterThanOrEqual(0);
    expect(p.fueraDelZocalo).toBeLessThanOrEqual(1);
  });
});

describe('El cuerpo · la cuna del disipador de C y el difusor', () => {
  it('con el disipador a 90 °C el PETG de la cuna queda ≤ 70 (1D por el silicato, la pared y el aire de fuera)', () => {
    const c = D.cuna, t = CUNA_HS.tope;
    console.log(`[cuna] tope de silicato de ${c.espesor.toFixed(1)} mm (juego ${c.juego.toFixed(1)} mm; entra ${(-c.enMargenC).toFixed(1)} mm al margen de C) → pared ${c.Tpetg.toFixed(1)} °C · pared frente al disipador ${c.Tvista.toFixed(1)} °C · boca del difusor ${c.Tboca.toFixed(1)} °C`);
    const Rs = ((t.y1 - t.y0) / 1000) / SILICATO.k((CUNA_HS.Ths + 60) / 2), Rp = PARED / 1000 / PETG.k + 1 / 10;
    expect(c.Tpetg).toBeCloseTo(MESA_TERMICA.Tin + ((CUNA_HS.Ths - MESA_TERMICA.Tin) * Rp) / (Rs + Rp), 9);
    for (const T of [c.Tpetg, c.Tvista, c.Tboca]) expect(T).toBeLessThanOrEqual(PETG.tUso);
    expect(c.juego).toBeGreaterThan(0);
  });
  it('el difusor vive en su bahía y lleva el chorro a la altura completa del disipador', () => {
    const dif = D.piezas.find((p) => p.grupo === 'difusor')!, b = bahia('DIFUSOR').caja;
    for (const o of dif.ops.filter((q) => q.s > 0 && q.nota !== 'espiga de la pata')) {
      const c = cajaDeOp(o);
      expect(dentro([c.x0, c.y0, c.z0], b, 1e-6) && dentro([c.x1, c.y1, c.z1], b, 1e-6)).toBe(true);
    }
    console.log(`[difusor] cubre ${(D.aire.difusor.largo * 100).toFixed(0)} % del largo y ${(D.aire.difusor.alto * 100).toFixed(0)} % de la altura del disipador · aire de C ${(D.aire.pcb.Q * 3600).toFixed(0)} m³/h`);
    expect(D.aire.difusor.alto).toBeCloseTo(1, 6);
    expect(D.aire.difusor.invadeBahia).toBe(0);
  });
});

describe('El cuerpo · todo imprimible (REGLAS.todoImprimible)', () => {
  it('las piezas sueltas salen como piezas con su cama: tapas, 4 grapas, 8 remaches, la tapa de la columna, el difusor y la campana', () => {
    const n = (g: string) => D.piezas.filter((p) => p.grupo === g).length;
    console.log(`[piezas] ${D.piezas.length} piezas en ${D.camas.length} camas · tapas ${n('tapa')} · grapas ${n('grapa')} · remaches ${n('remache')}`);
    for (const cm of D.camas) console.log(`[cama] ${cm.id.padEnd(14)} ${String(cm.piezas.length).padStart(2)} piezas · ${cm.caja.map((x) => x.toFixed(0)).join('×')} mm`);
    expect(n('grapa')).toBe(BROCHES.find((b) => b.id === 'col-col')!.n);
    expect(n('remache')).toBe(BROCHES.find((b) => b.id === 'ducto-cub')!.n);
    for (const g of ['tapa-columna', 'difusor', 'campana']) expect(n(g)).toBe(1);
    for (const c of D.canales.filter((q) => q.ruta.modo === 'astar' && q.ranuras > 0)) expect(c.tapas).toBeGreaterThanOrEqual(1);
    for (const pz of D.piezas) expect(D.camas.filter((cm) => cm.piezas.includes(pz.id)).length).toBe(1);
    for (const cm of D.camas) expect(cabeEnLaCama(...cm.caja)).toBe(true);
    for (const pz of D.piezas) if (pz.broche) expect((1.5 * pz.broche.y * pz.broche.h) / pz.broche.L ** 2).toBeLessThanOrEqual(PETG.epsAdm);
  });
  it('se imprimen giradas con su cara «abajo» contra la cama: rotación propia (det +1), lo de abajo queda en z mínimo', () => {
    for (const ab of [[0, 0, -1], [0, 0, 1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] as V3[]) {
      expect(rotarAbajo(ab, ab).map((x) => x + 0)).toEqual([0, 0, -1]);
      const ex = rotarAbajo([1, 0, 0], ab), ey = rotarAbajo([0, 1, 0], ab), ez = rotarAbajo([0, 0, 1], ab);
      const det = ex[0] * (ey[1] * ez[2] - ey[2] * ez[1]) - ex[1] * (ey[0] * ez[2] - ey[2] * ez[0]) + ex[2] * (ey[0] * ez[1] - ey[1] * ez[0]);
      expect(det).toBeCloseTo(1, 12);
    }
    for (const pz of D.piezas) { const t = cajaGirada(pz).tam; expect(cabeEnLaCama(t[0], t[1], t[2])).toBe(true); }
  });
});

describe('El cuerpo · errores sembrados (el juez los caza)', () => {
  // los de la ronda 1
  it('canal faltante', () => { const d = copia(); d.canales = d.canales.filter((c) => c.conexion.id !== 'K07'); expect(reglas(d)).toContain('C1:K07'); });
  it('canal roto (un tramo en diagonal)', () => { const d = copia(); const p = canal(d, 'K08').ruta.puntos; p.splice(2, 1); expect(reglas(d)).toContain('C1:K08'); });
  it('canal lleno (el bus de 2 × cal 10 en 6 × 6.5)', () => { const d = copia(); const s = canal(d, 'K04').ruta.seccion; s.w = 6; s.llenado = s.areaCables / (s.w * s.d); expect(reglas(d)).toContain('C2:K04'); });
  it('doblez cerrado (un escalón de 5 mm que no es S)', () => {
    const d = copia(); const c = canal(d, 'K07');
    c.ruta.puntos = [[40, 48, -40], [40, 160, -40], [40, 160, -35], [45, 160, -35], [45, 160, 120], [45, 150, 120], [40, 150, 120]] as V3[];
    expect(reglas(d)).toContain('C3:K07');
  });
  it('potencia pegada a señal (K08 corre a 5 mm de K07)', () => {
    const d = copia(); const k7 = canal(d, 'K07').ruta.puntos;
    canal(d, 'K08').ruta.puntos = k7.map((q, i) => (i === 0 || i === k7.length - 1 ? q : [q[0] + 5, q[1], q[2]] as V3));
    expect(errores(d).some((x) => x.regla === 'C4' && x.donde === 'K08')).toBe(true);
  });
  it('canal por la zona caliente de la mesa', () => {
    const d = copia(); const c = canal(d, 'K03'); c.ruta.puntos = [c.ruta.puntos[0], [-130, 150, -10], [0, 150, -10], [0, 80, -10], [-110, 80, -10], c.ruta.puntos[c.ruta.puntos.length - 1]] as V3[];
    expect(errores(d).some((x) => x.regla === 'C6' && x.donde === 'K03')).toBe(true);
  });
  it('peine faltante y abrazadera lejos de la isla', () => {
    const d = copia(); canal(d, 'K07').peines = []; expect(reglas(d)).toContain('C7:K07');
    const d2 = copia(); const ab = canal(d2, 'K04').peines.find((p) => p.tipo === 'abrazadera' && p.pos[1] < 60)!;
    ab.pos = [ab.pos[0], ab.pos[1] + 20, ab.pos[2]];
    expect(reglas(d2)).toContain('C7:K04');
  });
  it('teja que no cabe en la K1', () => { const d = copia(); d.tejas[0].caja.x1 += 80; expect(errores(d).some((x) => x.regla === 'T1')).toBe(true); });
  it('broche que se pasa de deformación (ε = 1.5·y·h/L²)', () => { const d = copia(); d.broches[0].y = 2.5; expect(errores(d).some((x) => x.regla === 'T2' && x.donde === d.broches[0].id)).toBe(true); });
  it('cola de milano con holgura que no es la de dfm', () => { const d = copia(); d.uniones[0].holgura = 0.1; expect(errores(d).some((x) => x.regla === 'T3')).toBe(true); });
  it('PETG caliente y columna que no aguanta', () => {
    const d = copia(); d.mesa.petg[0].T = 85; expect(errores(d).some((x) => x.regla === 'H1')).toBe(true);
    const d2 = copia(); d2.estructura = estructura(150); expect(errores(d2).some((x) => x.regla === 'S1')).toBe(true);
  });
  // los nuevos de la ronda 2
  it('una conexión sin ruta es un ERROR con su porqué (no una excepción)', () => {
    const d = copia(); const c = canal(d, 'K13'); c.ruta = { ...c.ruta, modo: 'sin-ruta', puntos: [], nota: 'nadie la rutea' };
    const e = errores(d).find((x) => x.regla === 'C1' && x.donde === 'K13');
    expect(e?.texto).toMatch(/nadie la rutea/);
  });
  it('sale de su puerto para otro lado (C9)', () => {
    const d = copia(); const p = canal(d, 'K07').ruta.puntos; p.splice(1, 0, [40, 48, -30]);
    expect(reglas(d)).toContain('C9:K07');
  });
  it('K05 y K06 separados de más (C10) y lazo que no se puede medir', () => {
    const d = copia(); d.lazo!.sepMax = 40; expect(reglas(d)).toContain('C10:K05/K06');
    const d2 = copia(); d2.lazo = null; expect(reglas(d2)).toContain('C10:K05/K06');
  });
  it('la campana que no captura (A3)', () => { const d = copia(); d.aire.extractor.vCaptura = 0.3; expect(reglas(d)).toContain('A3:extractor'); });
  it('K05 que llega caliente a su tubo o roza PETG (H4)', () => {
    const d = copia(); d.k05!.Tcanal = 90; expect(reglas(d)).toContain('H4:K05');
    const d2 = copia(); d2.k05!.holguras.push({ donde: 'campana: techo', mm: 0.5, T: 150, material: 'PETG' }); expect(reglas(d2)).toContain('H4:K05');
  });
  it('termostato que abre sin falla, o que abre tarde (H6)', () => {
    const d = copia(); d.mesa.termostato.Tnormal = 68; expect(reglas(d)).toContain('H6:MESA.TERM');
    const d2 = copia(); d2.mesa.termostato.TcentroAbre = 95; expect(reglas(d2)).toContain('H6:MESA.TERM');
  });
  it('la cuna del disipador que calienta el PETG (H7)', () => { const d = copia(); d.cuna.Tpetg = 85; expect(reglas(d)).toContain('H7:cuna del disipador'); });
  it('una tapa, una grapa o una cama que faltan, y una cama que no cabe (I1, T1)', () => {
    const d = copia(); canal(d, 'K04').tapas = 0; expect(reglas(d)).toContain('I1:K04');
    const d2 = copia(); d2.piezas = d2.piezas.filter((p, i, a) => p.grupo !== 'grapa' || a.findIndex((q) => q.grupo === 'grapa') !== i); expect(reglas(d2)).toContain('I1:grapa');
    const d3 = copia(); d3.camas = d3.camas.filter((c) => c.id !== 'campana'); expect(reglas(d3)).toContain('I1:campana');
    const d4 = copia(); d4.camas[0].caja = [IMPRESORA.cama[0] + 10, 10, 10]; expect(errores(d4).some((x) => x.regla === 'T1' && x.donde === d4.camas[0].id)).toBe(true);
  });
});

describe('El cuerpo · tejas, uniones y broches', () => {
  it('cada teja cabe en la K1 (220×220×250 − 5) y dice cómo se imprime', () => {
    for (const t of D.tejas) {
      const [a, b, c] = cajaImpresion(t);
      console.log(`[teja] ${t.id.padEnd(9)} ${a.toFixed(0)}×${b.toFixed(0)}×${c.toFixed(0)} · ${t.impresion.nota} · ${D.ops[t.id].length} operaciones`);
      expect(cabeEnLaCama(a, b, c)).toBe(true);
    }
  });
  it('cero tornillos: todo es cola de milano, espiga o broche; la holgura sale de dfm.clearance', () => {
    expect(D.uniones.every((u) => ['cola-de-milano', 'espiga', 'broche'].includes(u.tipo))).toBe(true);
    expect(clearance(PERFIL_K1)).toBeCloseTo(0.42, 9);
    expect(D.uniones.filter((u) => u.tipo !== 'broche').every((u) => u.holgura === clearance(PERFIL_K1))).toBe(true);
  });
  it('cada broche: ε = 1.5·y·h/L² ≤ ε_adm del PETG (SUPUESTO 1.5 %), con su fuerza de retención', () => {
    for (const b of BROCHES) {
      const e = epsBroche(b), f = fuerzaBroche(b);
      console.log(`[broche] ${b.id.padEnd(9)} L ${b.L} h ${b.h} y ${b.y} → ε ${(e * 100).toFixed(2)} % · flexión ${f.P.toFixed(1)} N · ${b.donde}`);
      expect(e).toBeCloseTo((1.5 * b.y * b.h) / (b.L * b.L), 12);
      expect(e).toBeLessThanOrEqual(PETG.epsAdm);
    }
  });
});

describe('El cuerpo · estructura (SF ≥ 2, PETG entre capas)', () => {
  it('columna: σ = M·c/I en el pie cortado por el humo; pie, espiga, cubierta y postes', () => {
    const s = D.estructura, sc = seccionColumna();
    expect(s.sigma).toBeCloseTo((1.5 * 9.81 * 190 * 2 * sc.c) / sc.I, 9);
    console.log(`[estructura] columna σ ${s.sigma.toFixed(2)} MPa (SF ${s.SFcol.toFixed(0)}) · espiga SF ${s.SFesp.toFixed(0)} · pie SF ${s.SFpie.toFixed(0)} · cubierta SF ${s.SFcub.toFixed(0)} · postes SF ${s.SFposte.toFixed(1)} · la punta baja ${(s.flechaPunta * 1000).toFixed(0)} µm`);
    for (const k of ['SFcol', 'SFesp', 'SFpie', 'SFcub', 'SFposte'] as const) expect(s[k]).toBeGreaterThanOrEqual(2);
  });
});

describe('El cuerpo · aire', () => {
  it('ventilador de C contra sus rejillas y su difusor (K de Idelchik), escape de la LRS', () => {
    const a = D.aire;
    expect(kRejilla(0.5)).toBeCloseTo(4.0, 2);
    console.log(`[aire] C: ${(a.pcb.Q * 3600).toFixed(0)} m³/h a ${a.pcb.dP.toFixed(1)} Pa, el aire sube ${a.pcb.dT.toFixed(1)} K · LRS: ${(a.lrs.Q * 3600).toFixed(0)} m³/h (${(a.lrs.fraccionPmax * 100).toFixed(0)} % de su presión)`);
    expect(a.pcb.dT).toBeLessThan(10);
    expect(a.lrs.fraccionPmax).toBeLessThan(0.25);
  });
  it('el ventilador de la placa (R2, 0.25 A): su curva cruza las pérdidas en ≥ 32 m³/h (C pide 27.6) y el aire de C sube menos', () => {
    const a = D.aire;
    console.log(`[aire] ventilador de C: ${a.pcb.m3h.toFixed(1)} m³/h a ${a.pcb.dP.toFixed(1)} Pa (+${a.pcb.dT.toFixed(1)} K) · el de 0.15 A daba ${a.pcb.r1.m3h.toFixed(1)} m³/h a ${a.pcb.r1.dP.toFixed(1)} Pa (+${a.pcb.r1.dT.toFixed(1)} K)`);
    expect(Math.abs(presionVent(VENT_PCB, a.pcb.Q) - a.pcb.dP)).toBeLessThan(0.05);
    expect(a.pcb.m3h).toBeGreaterThanOrEqual(AIRE_C.meta_m3h);
    expect(a.pcb.m3h).toBeGreaterThan(a.pcb.r1.m3h);
    expect(a.pcb.dT).toBeLessThan(a.pcb.r1.dT);
    expect(VENT_PCB.I).toBeLessThanOrEqual(CONEXIONES.find((c) => c.id === 'K09')!.Irms + 1e-9);
  });
  it('el ventilador de C que no alcanza lo que pide C (A1)', () => { const d = copia(); d.aire.pcb.Q = 25 / 3600; expect(reglas(d)).toContain('A1:ventilador de C'); });
});

describe('El cuerpo · piezas para La Forja', () => {
  it('tejas y camas como malla, canales como tubo con el color de su función, lo comprado con primitivas', () => {
    const p = piezasCuerpo(D);
    for (const t of D.tejas) expect(p.find((q) => q.id === `cuerpo-${t.id}`)).toMatchObject({ kind: 'malla', url: `/modelos/laboratorio/cuerpo/${t.id}.bin` });
    for (const cm of D.camas) expect(p.find((q) => q.id === `cuerpo-${cm.id}`)).toMatchObject({ kind: 'malla', url: cm.url });
    for (const c of CONEXIONES) {
      const q = p.find((x) => x.id === `canal-${c.id}`)!;
      expect(q.kind).toBe('tubo');
      expect(q.color).toBe(COLOR_FUNCION_LAB[c.funcion]);
    }
    expect(p.find((q) => q.id === 'lrs')).toMatchObject({ kind: 'malla', url: '/modelos/banco-arco/lrs-1200.bin', rx: 90 });
    for (const id of ['embocadura', 'tope-disipador', 'termostato-mesa']) expect(p.some((q) => q.id === id)).toBe(true);
    console.log(`[piezas] ${p.length} piezas · cobre total ${(D.canales.reduce((s, c) => s + (c.ruta.modo === 'astar' || c.ruta.modo === 'ducto' ? largo(c.ruta.puntos) * c.conexion.hilos.length : 0), 0) / 1000).toFixed(2)} m de hilo`);
  });
});
