/**
 * EL MÓDULO DEL ALAMBRE (orden 2026-11-05-lab-alambre · ronda 2: 2026-11-06-lab-alambre-r2): contra fórmulas y contra errores sembrados.
 * Cada error sembrado se mete en una COPIA del diseño y el juez lo tiene que cazar con la regla correcta.
 */
import { describe, it, expect } from 'vitest';
import {
  disenarAlambre, juzgarAlambre, piezasAlambre, listaAlambre, SUPUESTOS, REQ_ALAMBRE, PERFIL_K1,
  seccionAlambre, eulerPcr, corrienteFase, parDisponible, curvaPar, tempMotor, evaluarTopologia, gEntrada, thetaEn,
  juegoGuia, as5600, rielMacho, epsBroche, medidasImpresion, colchonCarrete, plumaDT, radiacionDT, inerciasRodillo, factorVistaMesa,
  aletaFD, muestrasAire, cumplimientoVoladizo, termicaLanza, campanaSumidero, vCampana, trayectoriaPluma, oclusoresMesa,
  radiosRuta, largoRuta, cajaPieza, chiCuerpo, perfilGota, distRutas,
  type DisenoAlambre, type Metal, type Supuestos,
} from '../alambre';
import { clearance } from '../../mech/dfm';
import { cabeEnLaCama, RIEL, REGLAS, puerto, bahia, traslape } from '../laboratorio-contrato';

const D = disenarAlambre();
const copia = (): DisenoAlambre => JSON.parse(JSON.stringify(D));
const errores = (d: DisenoAlambre) => juzgarAlambre(d).filter((h) => h.nivel === 'error').map((h) => h.regla);
const PI = Math.PI;

describe('Alambre · el diseño real', () => {
  it('no tiene errores (y dice sus números)', () => {
    const H = juzgarAlambre(D);
    for (const h of H) console.log(`   ${h.nivel} ${h.regla}: ${h.texto}`);
    const L = listaAlambre(D);
    console.log(`[alambre] impresas: ${L.impresas.map((p) => `${p.id} ${p.medidas.join('×')}`).join(' · ')}`);
    console.log(`[alambre] compradas (${L.compradas.length}): ${L.compradas.join(' · ')} · tornillos: ${L.tornillos}`);
    expect(H.filter((h) => h.nivel === 'error')).toEqual([]);
    expect(L.tornillos).toBe(0);
  });
});

describe('Alambre · pandeo (Euler) en el tramo sin guía', () => {
  it('sección del tubo y P_cr = π²EI/L²', () => {
    const s = seccionAlambre(0.8, 0.2);
    expect(s.I).toBeCloseTo((PI / 64) * (0.8 ** 4 - 0.4 ** 4), 10);
    expect(s.EI).toBeCloseTo(200e3 * s.I, 6);
    expect(D.pandeo.Pcr).toBeCloseTo((PI ** 2 * s.EI) / D.pandeo.Llibre ** 2, 6);
    console.log(`[pandeo] EI ${s.EI.toFixed(0)} N·mm² · ${D.pandeo.Llibre} mm sin guía → P_cr ${D.pandeo.Pcr.toFixed(0)} N contra ${D.fuerza.total.toFixed(2)} N (×${D.pandeo.margen.toFixed(0)}) · 100 mm darían ${eulerPcr(s.EI, 100).toFixed(1)} N`);
    expect(D.pandeo.margen).toBeGreaterThan(REQ_ALAMBRE.margenPandeo);
  });
  it('caza 100 mm sin guía entre el rodillo y la nariz', () => {
    const d = copia(); d.zNariz = d.zNip - 100;
    expect(errores(d)).toContain('A9');
  });
});

describe('Alambre · NEMA 17HS4401 a 12 V (fcem + L/R) contra la fuerza de empuje', () => {
  const m = SUPUESTOS.nema, Ipk = D.corriente.IrmsCMT * Math.SQRT2;
  it('la curva par-velocidad sale de I = (V − k_e·ω)/√(R² + (50ωL)²)', () => {
    expect(corrienteFase(0, Ipk)).toBeCloseTo(Ipk, 9);
    expect(parDisponible(0, Ipk)).toBeCloseTo(m.kDin * (m.Th / m.Inom) * Ipk, 9);
    const w = 40, I = (m.V - (m.Th / m.Inom) * w) / Math.hypot(m.R, 50 * w * m.L);
    expect(corrienteFase(w, 9)).toBeCloseTo(I, 9);
    expect(parDisponible(m.V / (m.Th / m.Inom) + 1, Ipk)).toBe(0);           // fcem = V → sin par
    console.log(`[nema] ${m.V} V, ${D.corriente.IrmsCMT} A rms: ${curvaPar(Ipk, m, m.V, 600, 13).map(([r, t]) => `${r} rpm ${t}`).join(' · ')}`);
  });
  it('margen de par a 6 m/min ≥ 2 con la corriente de alimentar', () => {
    const r = SUPUESTOS.rodillo.D / 2 / 1e3, w = (6 / 60) / r;
    const pedido = D.fuerza.total * r, disp = parDisponible(w, D.corriente.IrmsFeed * Math.SQRT2);
    console.log(`[par] F = ${D.fuerza.total.toFixed(2)} N (carrete ${D.fuerza.carreteMax.toFixed(2)} · boca+arco ${D.fuerza.entrada.toFixed(2)} [plástico ${D.fuerza.plastico.toFixed(2)}] · guía ${D.fuerza.guia.toFixed(2)}: PTFE ${D.fuerza.ptfe.F.toFixed(2)}, inox ${D.fuerza.inox.F.toFixed(2)}, punta ${D.fuerza.punta.F.toFixed(2)}) → ${(pedido * 1e3).toFixed(0)} mN·m contra ${(disp * 1e3).toFixed(0)} mN·m a ${(w * 60 / 2 / PI).toFixed(0)} rpm con ${D.corriente.IrmsFeed} A rms → ×${(disp / pedido).toFixed(2)}`);
    expect(disp / pedido).toBeCloseTo(D.feed.margen, 6);
    expect(disp / pedido).toBeGreaterThanOrEqual(REQ_ALAMBRE.margenPar);
  });
  it('caza una guía con fricción de cobre ×5 (margen < 2)', () => {
    const d = copia(); d.S.guia.muCobre = 1.5;
    expect(errores(d)).toContain('A6');
  });
});

describe('Alambre · topología: la decide la retracción tipo CMT', () => {
  it('directo gana: más Hz a ±1 mm, cero juego, menos piezas; µm por micropaso = π·30/3200', () => {
    const [dir, red] = D.topos;
    console.log(`[topología] directo: ×${dir.margen.toFixed(2)} · ${dir.umPorMicropaso.toFixed(1)} µm/µpaso · CMT ${dir.fCMT.toFixed(1)} Hz · juego 0 · error de posición ±${dir.errPos.toFixed(0)} µm`);
    console.log(`[topología] 5:1 impresa: ×${red.margen.toFixed(2)} · ${red.umPorMicropaso.toFixed(1)} µm/µpaso · CMT ${red.fCMT.toFixed(1)} Hz · juego ${(red.juego * 1e3).toFixed(0)} µm · +${red.piezasExtra} piezas · ${red.rpmVmax.toFixed(0)} rpm a 6 m/min`);
    expect(D.topologia).toBe('directo');
    expect(dir.fCMT).toBeGreaterThan(red.fCMT * 1.5);
    expect(dir.umPorMicropaso).toBeCloseTo(((PI * 30) / 3200) * 1e3, 6);
    expect(red.juego).toBeGreaterThan(0);
  });
  it('caza el paso completo (sin micropasos): 471 µm por paso', () => {
    const d = copia(); d.micro = 1;
    expect(errores(d)).toContain('A7');
  });
});

describe('Alambre · retracción tipo CMT ±1 mm: Hz, inercia reflejada, calor y el colchón del carrete', () => {
  it('a f_CMT el par alcanza con SF 1.5 (y un 5 % arriba ya no); el NEMA no pasa de 70 °C', () => {
    const Ipk = D.corriente.IrmsCMT * Math.SQRT2, ev = evaluarTopologia('directo', D.fuerza.total, Ipk);
    const { Jrod, Jloca } = inerciasRodillo();
    expect(ev.Jm).toBeCloseTo(SUPUESTOS.nema.J + Jrod + Jloca, 12);
    const a = ev.cmt(ev.fCMT), b = ev.cmt(ev.fCMT * 1.05);
    expect(a.disponible).toBeGreaterThanOrEqual(1.5 * a.pedido * 0.999);
    expect(b.disponible).toBeLessThan(1.5 * b.pedido);
    const v24 = evaluarTopologia('directo', D.fuerza.total, Ipk, { ...SUPUESTOS, nema: { ...SUPUESTOS.nema, V: 24 } });
    const rojo = evaluarTopologia('directo', D.fuerza.total, 1.4 * Math.SQRT2);
    const tm = tempMotor(D.corriente.IrmsCMT), tmRojo = tempMotor(1.4);
    console.log(`retracción tipo CMT: ${ev.fCMT.toFixed(1)} Hz (±1 mm, ${D.corriente.IrmsCMT} A rms, 12 V, J = ${(ev.Jm * 1e7).toFixed(0)} g·cm² [rotor 54 + rodillo ${(Jrod * 1e7).toFixed(0)} + loca ${(Jloca * 1e7).toFixed(0)}], pico ${a.rpmPico.toFixed(0)} rpm, ${(a.pedido * 1e3).toFixed(0)} de ${(a.disponible * 1e3).toFixed(0)} mN·m) · a 24 V: ${v24.fCMT.toFixed(1)} Hz · a 1.4 A: ${rojo.fCMT.toFixed(1)} Hz pero la carcasa a ${tmRojo.T.toFixed(0)} °C · NEMA a ${D.corriente.IrmsCMT} A: ${tm.P.toFixed(2)} W → ${tm.T.toFixed(1)} °C`);
    expect(Math.abs(v24.fCMT - ev.fCMT)).toBeLessThan(0.5);      // 12 V alcanza: manda la corriente, no el voltaje
    expect(tm.T).toBeLessThanOrEqual(70);
    expect(tmRojo.T).toBeGreaterThan(70);
  });
  it('el arco de PTFE aísla el carrete (f_n ≪ f_CMT); un tramo recto y tenso lo arrastraría', () => {
    const c = D.colchon, recto = colchonCarrete(0, 70, D.eleccion.fCMT);
    console.log(`[colchón] arco de PTFE R${D.Rarco}: k = ${c.k.toFixed(3)} N/mm, carrete ${c.meq.toFixed(2)} kg equivalentes → f_n ${c.fn.toFixed(2)} Hz, ${c.F.toFixed(3)} N al alambre · recto y tenso: f_n ${recto.fn.toFixed(0)} Hz → ${recto.F.toFixed(1)} N`);
    expect(c.fn * REQ_ALAMBRE.bucleIsla).toBeLessThan(D.eleccion.fCMT);
    expect(recto.F).toBeGreaterThan(20);
  });
  it('caza la entrada recta (sin arco): la retracción arrastra el carrete', () => {
    const d = copia(); d.geoGuia.thetaPTFE = 0;
    expect(errores(d)).toContain('A8');
  });
});

describe('Alambre · la guía recta: juego y rigidez', () => {
  it('Δ = L·c²·F/(4EI) en el PTFE 4×2, el inox desnudo no pandea y la columna de alambre responde a kHz', () => {
    const s = seccionAlambre(), c = (2 - 0.8) / 2, L = D.geoGuia.Lptfe, F = D.fuerza.total;
    const j = juegoGuia(F, c, L, s);
    expect(j.delta).toBeCloseTo((L * c * c * F) / (4 * s.EI), 9);
    const kAx = (200e3 * s.A) / (D.zNip - 14), k = 1 / (1 / kAx + 1 / j.k), m = (SUPUESTOS.alambre.rhoLineal * (D.zNip - 14)) / 1e3;
    const fAx = Math.sqrt((k * 1e3) / (m / 1e3)) / (2 * PI);
    const PcrInox = eulerPcr(s.EI, D.geoGuia.Linox);
    console.log(`[guía] PTFE ${L} mm, holgura ${c} → juego ${(j.delta * 1e3).toFixed(0)} µm con ${F.toFixed(2)} N · inox desnudo ${D.geoGuia.Linox} mm (holgura 1.6): P_cr ${PcrInox.toFixed(1)} N > ${F.toFixed(2)} N, no culebrea · rigidez ${k.toFixed(0)} N/mm · la columna de alambre a ${fAx.toFixed(0)} Hz (≫ ${D.eleccion.fCMT.toFixed(0)} Hz) · cuello de lado ${D.lateral.f.toFixed(0)} Hz`);
    expect(j.delta).toBeLessThanOrEqual(REQ_ALAMBRE.juegoMax);
    expect(PcrInox).toBeGreaterThan(F);
    expect(fAx).toBeGreaterThan(5 * D.eleccion.fCMT);
  });
});

describe('Alambre · temperatura del PETG junto a la punta', () => {
  it('la aleta: G = kAm·tanh(mL) y θ(L) = θ0/cosh(mL)', () => {
    const b = { k: 16, Do: 6, Di: 4, L: 100, h: 25 };
    const A = (PI / 4) * (36 - 16) * 1e-6, P = PI * 6e-3, m = Math.sqrt((25 * P) / (16 * A));
    expect(gEntrada(b)).toBeCloseTo(16 * A * m * Math.tanh(m * 0.1), 12);
    expect(thetaEn(b, 300, 100)).toBeCloseTo(300 / Math.cosh(m * 0.1), 9);
  });
  it('la aleta por diferencias finitas (la que ve la pluma) da la analítica en aire quieto', () => {
    const b = { k: 16, Do: 6, Di: 4, L: 100, h: 25 }, A = (PI / 4) * (36 - 16) * 1e-6;
    const f = aletaFD(muestrasAire(100, 800), () => ({ kA: 16 * A, Pc: PI * 6e-3, h: 25, alfa: 0, chi: 0, qJ: 0 }), 35 + 300);
    expect(f.T[f.T.length - 1] - 35).toBeCloseTo(thetaEn(b, 300, 100), 1);
    expect(f.Q / (gEntrada(b) * 300)).toBeCloseTo(1, 3);
  });
  it('punta a 400 °C con la pluma DIRECTA (0 % de captura): el PETG del zócalo aislado, la silicona, el PTFE, el cable y las anclas bajo sus límites', () => {
    const t = D.term, z = D.zocalo, i = D.inserto;
    console.log(`[térmico] pluma directa: punta ${SUPUESTOS.termica.Tpunta} °C → ${t.Q.toFixed(1)} W por la punta · portapuntas ${t.Tporta.toFixed(0)} °C (Silfos ≤ ${SUPUESTOS.juntas.Silfos.Tmax}) · cuello ${D.cuelloMat.nombre} ${D.lanza.cuello.Lexpuesto} mm EN LA PLUMA llega a ${z.diseno.Tn.toFixed(1)} °C a la boca del inserto · inserto de ${i.nombre} Ø${2 * i.r} (z ${i.z0}…${i.z1}): el PETG que lo abraza a ${z.diseno.Tint.toFixed(1)} °C, donde sale el PTFE ${z.diseno.Tptfe.toFixed(1)} °C (bloque ${z.diseno.Tb.toFixed(1)}) · latón ${D.materiales[1].Tpetg.toFixed(0)}, cobre ${D.materiales[2].Tpetg.toFixed(0)} · PTFE desde z ${D.zPTFEbajo} a ${t.TptfeBajo.toFixed(0)} °C · cable: ${D.Ldesnudo} mm desnudo, silicona desde ${t.Tsilicona.toFixed(0)} °C, toca PETG a ${D.sContacto.toFixed(0)} mm con ${t.TcableContacto.toFixed(1)} °C · anclas ${t.Tanclas.map((x) => x.toFixed(0)).join('/')} °C · la punta baja ${(t.dilatacionCuello * 1e3).toFixed(0)} µm`);
    console.log(`[térmico] 80 % de captura (informativo): cuello ${z.informativo80.Tn.toFixed(1)} °C, PETG del inserto ${z.informativo80.Tint.toFixed(1)} °C`);
    expect(z.diseno.Tint).toBeLessThanOrEqual(REQ_ALAMBRE.tPetgMax - REQ_ALAMBRE.margenT);
    expect(z.diseno.Tptfe).toBeLessThanOrEqual(REQ_ALAMBRE.tPetgMax - REQ_ALAMBRE.margenT);
    expect(z.diseno.Tn).toBeLessThanOrEqual(i.Tmax);
    expect(t.TcableContacto).toBeLessThanOrEqual(REQ_ALAMBRE.tPetgMax);
    expect(t.Tsilicona).toBeLessThanOrEqual(SUPUESTOS.termica.TsiliconaMax);
    expect(t.Tporta).toBeLessThanOrEqual(SUPUESTOS.juntas.Silfos.Tmax);
    expect(t.TptfeBajo).toBeLessThanOrEqual(SUPUESTOS.termica.TptfeMax);
    for (const Ta of t.Tanclas) expect(Ta).toBeLessThanOrEqual(REQ_ALAMBRE.tPetgMax);
    expect(D.materiales[2].Tpetg).toBeGreaterThan(70);              // con cobre no se puede
    expect(z.diseno.Tn).toBeGreaterThan(80);                         // el cuello sí va caliente: por eso el PETG no lo toca
    expect(z.informativo80.Tint).toBeLessThan(z.diseno.Tint);        // la campana sólo ayuda
  });
  it('la regla del inserto: el PTFE no alcanza; el silicato sí, del radio más chico donde además cabe el KSD301', () => {
    for (const c of D.candidatosInserto) console.log(`[inserto] r ${c.r} ${c.aislante}: cuello ${c.Tn.toFixed(1)} → PETG ${c.Tint.toFixed(1)} °C · salida del PTFE ${c.Tptfe.toFixed(1)} · KSD301 ${c.K ?? '—'} · asiento ${c.asiento ? 'cabe' : 'no cabe'} → ${c.ok ? 'CUMPLE' : 'no'}`);
    expect(D.candidatosInserto.filter((c) => c.aislante === 'PTFE').every((c) => !c.ok)).toBe(true);
    expect(D.inserto.nombre).toMatch(/silicato/);
    expect(D.candidatosInserto.find((c) => c.ok)!.r).toBe(D.inserto.r);
  });
  it('caza el zócalo sin aislar (cuello en PETG) y un inserto de PTFE del mismo tamaño', () => {
    const a = copia(); a.inserto.r = 3.05;
    expect(errores(a)).toContain('A11');
    const b = copia(); b.inserto.k = 0.25;
    expect(errores(b)).toContain('A11');
  });
  it('el arco: la pluma (Heskestad) y la radiación ponen el PETG a ≥ 260 mm sobre el arco', () => {
    const T = (z: number) => 35 + 0.5 * plumaDT(z) + radiacionDT(z);
    console.log(`[arco] cara de PETG sobre el eje: z 150 → ${T(150).toFixed(0)} °C · 215 → ${T(215).toFixed(0)} · ${D.zP} → ${T(D.zP).toFixed(1)} °C`);
    expect(T(D.zP)).toBeLessThanOrEqual(70 - 3);
    expect(T(D.zP - 5)).toBeGreaterThan(70 - 3);
  });
  it('la mesa a 300 °C: factor de vista contra la fórmula del cuadrado y escudos de aluminio donde hacen falta', () => {
    const H = 260, A = SUPUESTOS.mesa.semi / H, a = A / Math.sqrt(1 + A * A);
    const Fteo = (4 / (2 * PI)) * 2 * a * Math.atan(a);
    const F = factorVistaMesa([0, 0, H], [0, 0, -1]);
    expect(Math.abs(F - Fteo) / Fteo).toBeLessThan(0.01);
    const s = D.carasSin, c = D.carasCon;
    console.log(`[mesa] F(cuadrado ±80 a 260 mm) = ${F.toFixed(4)} vs ${Fteo.toFixed(4)} · sin escudos el peor PETG llega a ${s.T.toFixed(0)} °C (${s.pieza}: ${s.nota}, F ${s.F.toFixed(2)}, +${s.dTmesa.toFixed(0)} K de la mesa) · con ${D.escudos.length} tiras de aluminio: ${c.T.toFixed(1)} °C (${c.pieza}: ${c.nota}) · carrete ${D.TcarreteSin.toFixed(0)} → ${D.Tcarrete.toFixed(0)} °C con su escudo en L`);
    expect(s.T).toBeGreaterThan(70);
    expect(c.T).toBeLessThanOrEqual(70 - REQ_ALAMBRE.margenT);       // el aviso A12 de la ronda 1 (67.1 °C) queda resuelto
    expect(D.Tcarrete).toBeLessThanOrEqual(SUPUESTOS.carrete.Tmax);
  });
  it('caza los escudos quitados (la mesa calienta el PETG y el carrete)', () => {
    const d = copia(); d.escudos = []; d.escudoCarrete = false;
    expect(errores(d).filter((r) => r === 'A12').length).toBeGreaterThanOrEqual(2);
  });
  it('caza un cuello de cobre (PETG > 70 °C)', () => {
    const d = copia(); d.lanza.cuello.k = SUPUESTOS.termica.kCobre;
    expect(errores(d)).toContain('A11');
  });
  it('caza la nariz bajada 80 mm hacia el arco', () => {
    const d = copia(); const p = d.impresas[1].prims.find((q) => q.nota?.startsWith('bloque'))!;
    if (p.f === 'prismaYZ') p.pts = p.pts.map(([y, z]) => [y, z - 80] as [number, number]);
    expect(errores(d)).toContain('A12');
  });
  it('caza el cable OUT− tocando PETG pegado a la punta', () => {
    const d = copia(); d.rutaK06 = [[7, 0, 43], [-40, 141, 60], [-40, 150, 60]];
    expect(errores(d)).toContain('A11');
  });
});

describe('Alambre · ningún camino metálico paralelo de corriente', () => {
  it('el alambre sólo se une por metal a OUT− a través del portapuntas de la punta', () => {
    expect(errores(D).filter((r) => r === 'A13')).toEqual([]);
  });
  it('caza el NEMA atornillado a un chasis a tierra', () => {
    const d = copia(); d.metales.push({ id: 'tornillo M3', caja: d.metales.find((m) => m.id === 'nema')!.caja, red: 'PE', toca: ['nema'] } as Metal);
    d.metales.find((m) => m.id === 'nema')!.toca.push('tornillo M3');
    expect(errores(d)).toContain('A13');
  });
  it('caza el AS5600 pegado al balero de la loca', () => {
    const d = copia(); const a = d.metales.find((m) => m.id === 'as5600')!; a.caja.y0 = -3.0; a.caja.y1 = -2.6;
    expect(errores(d)).toContain('A13');
  });
  it('caza OUT− soldado al rodillo en vez de a la punta', () => {
    const d = copia();
    d.metales.find((m) => m.id === 'portapuntas')!.toca = ['cuello'];
    d.metales.find((m) => m.id === 'rodillo')!.toca.push('cableK06');
    expect(errores(d)).toContain('A13');
  });
});

describe('Alambre · el riel con la holgura de dfm.ts y los broches', () => {
  it('holgura = clearance(K1, PETG) y el macho entra', () => {
    const g = clearance(PERFIL_K1), m = rielMacho(g);
    expect(D.riel.g).toBe(g);
    expect(g).toBeCloseTo(0.75 * 0.4 + 0.12, 9);
    expect(m.bocaMacho).toBeCloseTo(RIEL.anchoBoca - 2 * g / Math.cos(m.alfa), 9);
    const eB = epsBroche(D.broche.y, D.broche.h, D.broche.L), eP = epsBroche(D.pestillo.y, D.pestillo.h, D.pestillo.L);
    console.log(`[riel] holgura ${g} mm (normal al flanco) → macho boca ${m.bocaMacho.toFixed(2)} / fondo ${m.fondoMacho.toFixed(2)} / prof ${m.profMacho.toFixed(2)}, juego lateral ${m.juegoX.toFixed(2)} · broche ε = ${(eB * 100).toFixed(2)} % · pestillo del NEMA ε = ${(eP * 100).toFixed(2)} % (admisible ${SUPUESTOS.petg.epsAdm * 100} %)`);
    expect(eB).toBeLessThanOrEqual(SUPUESTOS.petg.epsAdm);
    expect(eP).toBeLessThanOrEqual(SUPUESTOS.petg.epsAdm);
  });
  it('caza una holgura de 0.1 mm (se suelda) y un broche corto que truena', () => {
    const d = copia(); d.riel.g = 0.1;
    expect(errores(d)).toContain('A4');
    const e = copia(); e.broche.L = 6;
    expect(errores(e)).toContain('A5');
  });
});

describe('Alambre · la cama de la K1 y los voladizos', () => {
  it('cada pieza impresa cabe en su orientación de impresión', () => {
    for (const p of D.impresas) { const m = medidasImpresion(p); expect(cabeEnLaCama(m[0], m[1], m[2])).toBe(true); }
  });
  it('caza una espina de 300 mm de alto', () => {
    const d = copia(); const c = d.impresas[0].prims[0]; if (c.f === 'caja') c.b[2] = c.a[2] + 300;
    expect(errores(d)).toContain('A2');
  });
  it('caza un barreno horizontal sin gota y un fondo a 30°', () => {
    const d = copia(); const i = d.impresas[1].prims.findIndex((q) => q.nota === 'cueva del rodillo'); const q = d.impresas[1].prims[i];
    if (q.f === 'gota') d.impresas[1].prims[i] = { f: 'cil', op: '-', c: q.c, eje: q.eje, r: q.r, h: q.h, nota: q.nota };
    expect(errores(d)).toContain('A3');
    const e = copia(); const b = e.impresas[1].prims.find((q2) => q2.nota?.startsWith('bloque'))!;
    if (b.f === 'prismaYZ') b.pts[2] = [b.pts[1][0] + 52, b.pts[1][1] - 30];
    expect(errores(e)).toContain('A3');
  });
});

describe('Alambre · la loca (625-ZZ) y el AS5600', () => {
  it('agarra sin aplastar; resorte de acero porque la flexión impresa relaja junto al NEMA', () => {
    const l = D.loca;
    console.log(`[loca] N = ${l.N} N (agarre ≥ ${l.Nmin.toFixed(1)}, aplasta ${l.Naplasta.toFixed(0)} → máx ${l.Nmax.toFixed(1)}) · resorte ${l.resorte.k} N/mm × ${l.precarga.toFixed(1)} mm · flexión impresa a ${l.Nmax.toFixed(1)} N: a 40 °C queda ${l.decision.NfinFlex40.toFixed(1)} N, a ${l.decision.Tbloque.toFixed(0)} °C ${l.decision.NfinFlex.toFixed(1)} N → ${l.decision.eleccion}`);
    expect(l.N).toBeGreaterThanOrEqual(l.Nmin);
    expect(l.N).toBeLessThanOrEqual(l.Nmax);
    expect(l.decision.eleccion).toBe('resorte de acero');
  });
  it('resolución π·D/4096 y entrehierro', () => {
    const a = as5600(16, 2);
    expect(a.umPorCuenta).toBeCloseTo(((PI * 16) / 4096) * 1e3, 9);
    console.log(`[AS5600] Ø16 → ${a.umPorCuenta.toFixed(1)} µm/cuenta · leído por un ADC de ${SUPUESTOS.as5600.enobADC} bits efectivos: ${a.umEfectivoADC.toFixed(0)} µm · ${a.revPorSeg.toFixed(2)} rev/s a 6 m/min · entrehierro ${a.gap} mm`);
    expect(a.gapOk).toBe(true);
  });
  it('D5: la tapa del imán se pega a la cara del aro exterior del 625-ZZ, no pasa de su Ø16 y el perno no asoma', () => {
    const tp = D.loca.tapa, perno = D.impresas.find((p) => p.id === 'carro-loca')!.prims.find((q) => q.nota?.startsWith('perno'))!;
    console.log(`[625-ZZ] tapa r ${tp.r} (aro exterior hasta r ${SUPUESTOS.loca.D / 2}; el rodillo a 0.8 mm) · pega en r ${tp.rHueco}…${tp.r} · hueco de ${tp.hueco} mm libra la tapa de lámina, el aro interior y el perno · imán a ${D.loca.gapIman} mm del AS5600`);
    expect(tp.r).toBeLessThan(SUPUESTOS.loca.D / 2);
    expect(tp.rHueco).toBeLessThan(SUPUESTOS.loca.aroInt);
    expect(perno.f === 'cil' && perno.c[1]).toBeGreaterThan(-SUPUESTOS.loca.ancho / 2);
  });
  it('caza una loca que aplasta (80 N), un imán a 5 mm y una tapa con labio sobre el aro (choca con el rodillo)', () => {
    const d = copia(); d.loca.N = 80;
    expect(errores(d)).toContain('A14');
    const e = copia(); e.loca.gapIman = 5;
    expect(errores(e)).toContain('A15');
    const f = copia(); f.loca.tapa.r = 8.6;
    expect(errores(f)).toContain('A15');
  });
});

describe('Alambre · ronda 2: K06 a A.POT en z 210', () => {
  it('sale del portapuntas, sube fuera de la pluma, entra derecho al puerto; R ≥ 6·OD; toca PETG en el pasamuros del empuje', () => {
    const ap = puerto('A.POT'), fin = D.rutaK06[D.rutaK06.length - 1];
    const rmin = Math.min(...radiosRuta(D.rutaK06)), pz = D.impresas.find((p) => p.prims.some((q) => q.nota?.includes('pasamuros A.POT')))!;
    console.log(`[K06] ${largoRuta(D.rutaK06).toFixed(0)} mm del portapuntas al puerto (${ap.pos.join(', ')}) · radio mínimo ${rmin.toFixed(1)} mm (≥ ${REGLAS.dobladoMinK}·${SUPUESTOS.termica.cableOD} = ${(REGLAS.dobladoMinK * SUPUESTOS.termica.cableOD).toFixed(0)}) · ${D.Ldesnudo} mm desnudo · toca PETG a ${D.sContacto.toFixed(0)} mm, en el pasamuros de ${pz.id} · la ronda 1 bajaba al puerto de z 60: tocaba a 274 mm`);
    expect(fin).toEqual(ap.pos);
    expect(rmin).toBeGreaterThanOrEqual(REGLAS.dobladoMinK * SUPUESTOS.termica.cableOD - 0.5);
    expect(pz.id).toBe('espina-empuje');
    expect(D.sContacto).toBeGreaterThan(largoRuta(D.rutaK06) - 12);
  });
  it('el circunradio de un arco muestreado es su radio; una esquina viva da ~k/√2', () => {
    const arco = Array.from({ length: 46 }, (_, i) => { const a = (PI / 2) * (i / 45); return [39 * Math.cos(a), 39 * Math.sin(a), 0] as [number, number, number]; });
    expect(Math.min(...radiosRuta(arco))).toBeCloseTo(39, 0);
    expect(Math.min(...radiosRuta([[0, 0, 0], [50, 0, 0], [50, 50, 0]]))).toBeLessThan(6);
  });
  it('caza la ruta de la ronda 1 (esquinas vivas, al puerto viejo) y el pasamuros olvidado en el pie', () => {
    const d = copia(); d.rutaK06 = [[7, 0, 43], [7, 0, 145], [-40, 141, 60], [-40, 150, 60]];
    expect(errores(d)).toEqual(expect.arrayContaining(['A17', 'A18']));
    const e = copia(); const h = e.impresas[1].prims.findIndex((q) => q.nota?.includes('pasamuros A.POT'));
    e.impresas[0].prims.push(e.impresas[1].prims.splice(h, 1)[0]);
    expect(errores(e)).toContain('A17');
  });
});

describe('Alambre · ronda 2: el cuello de lado contra la retracción (f_n ≥ 2·f_CMT)', () => {
  it('la viga sobre Winkler: con lecho infinito es el voladizo L³/3EI; con PETG, la raíz manda', () => {
    const EI = 193e3 * (PI / 64) * (6 ** 4 - 4 ** 4), L = 207;
    expect(cumplimientoVoladizo(EI, L, 40, 1e9) / (L ** 3 / (3 * EI))).toBeCloseTo(1, 2);
    const EI10 = 193e3 * (PI / 64) * (10 ** 4 - 6 ** 4);
    const raiz = cumplimientoVoladizo(EI10, L, 16, SUPUESTOS.petg.E) / (L ** 3 / (3 * EI10));
    console.log(`[raíz] tubo 10×6 con 16 mm de zócalo en PETG: ${raiz.toFixed(2)}× más blando que empotrado → la raíz, no el tubo, manda`);
    expect(raiz).toBeGreaterThan(2);
  });
  it('la física elige: otro tubo y otro largo no llegan; el apoyo intermedio sí', () => {
    const c = D.cuello, lat = D.lateral;
    for (const k of c.caminos) console.log(`[cuello] ${k.camino}: ${k.ok ? 'CUMPLE' : 'no'} · ${k.texto}`);
    console.log(`[cuello] objetivo ${REQ_ALAMBRE.fnCuelloK}·${D.eleccion.fCMT.toFixed(1)} = ${c.fObj.toFixed(1)} Hz · elegido: ${c.camino} → ${lat.f.toFixed(1)} Hz (la ronda 1: 57.7 Hz sin raíz ni cable)`);
    expect(c.caminos.find((k) => k.camino === 'otro tubo')!.ok).toBe(false);
    expect(c.caminos.find((k) => k.camino === 'otro largo')!.ok).toBe(false);
    expect(c.camino).toBe('apoyo intermedio');
    expect(lat.f).toBeGreaterThanOrEqual(REQ_ALAMBRE.fnCuelloK * D.eleccion.fCMT);
    expect(D.tirantes).not.toBeNull();
  });
  it('caza el cuello sin apoyo intermedio (el de la ronda 1) y un tirante que no llega a su ancla', () => {
    const d = copia(); d.tirantes = null;
    expect(errores(d)).toContain('A16');
    const e = copia(); e.tirantes!.anclas[0] = [-26, -40, 300];
    expect(errores(e)).toContain('A1');
  });
});

describe('Alambre · ronda 2: la campana de B', () => {
  it('Dalla Valle con pestaña: 0.5 m/s en el arco; su caudal; lo que escapa también lo agarra la boca', () => {
    const cs = campanaSumidero(), v = vCampana([0, 0, 2], cs), sin = trayectoriaPluma({ ...SUPUESTOS, campana: { eta: 0 } } as Supuestos);
    console.log(`[campana] boca en y ${cs.boca[1]}, ${cs.X0 * 1e3} mm del arco → Q ${cs.m3h.toFixed(0)} m³/h para ${cs.V0} m/s · lo que escapa (${((1 - SUPUESTOS.campana.eta) * 100).toFixed(0)} %, ${(D.campana.Qe * 1e3).toFixed(1)} W): ${D.campana.capturada ? `entra a la boca a z ${D.campana.zCaptura.toFixed(1)}` : 'sube'} · la pluma entera con la campana prendida: ${sin.capturada ? `entra a z ${sin.zCaptura.toFixed(1)}` : 'escapa'} · mezclada en la campana: +${((QcW()) / (1.2 * 1005 * cs.Q)).toFixed(1)} K`);
    expect(Math.hypot(...v)).toBeCloseTo(REGLAS.capturaHumoMin, 6);
  });
  it('nada de A baja de z 24 sobre su huella; el juez lo caza', () => {
    const camp = bahia('CAMPANA').caja;
    for (const pz of D.impresas) expect(traslape(cajaPieza(pz), camp)).toBe(0);
    expect(errores(D).filter((r) => r === 'A19')).toEqual([]);
    const d = copia(); const c = d.impresas[0].prims[0]; if (c.f === 'caja') c.a[2] = 10;
    expect(errores(d)).toContain('A19');
  });
  it('su tiro sólo ayuda: tapa la mesa a la espina del pie y le baja la pluma al zócalo; el diseño aguanta con 0 %', () => {
    const p: [number, number, number] = [-49.5, 142.5, 40], Fcon = factorVistaMesa(p, [0, 0, -1], 80, 48, oclusoresMesa()), Fsin = factorVistaMesa(p, [0, 0, -1]);
    const barrido = [0, 0.2, 0.4, 0.6, 0.8].map((eta) => {
      const S2 = JSON.parse(JSON.stringify(D.S)) as Supuestos; S2.campana.eta = eta;
      return [eta, D.zocalo.diseno.Tint, termicaLanza(D.lanza, S2, 'conCampana').TpetgCuello] as [number, number, number];
    });
    console.log(`[campana] la espina del pie ve la mesa con F ${Fsin.toFixed(3)} sin campana y ${Fcon.toFixed(3)} con ella (no se cuenta) · el cuello en la boca del inserto según lo que captura: ${barrido.map(([e, , Tn]) => `${(e * 100).toFixed(0)} % → ${Tn.toFixed(1)} °C`).join(' · ')} · diseño con 0 %: PETG del inserto ${D.zocalo.diseno.Tint.toFixed(1)} °C`);
    expect(Fcon).toBeLessThan(Fsin);
    for (let i = 1; i < barrido.length; i++) expect(barrido[i][2]).toBeLessThanOrEqual(barrido[i - 1][2] + 1e-9);
    expect(SUPUESTOS.campana.eta).toBe(0);
  });
  it('sin campana (pluma vertical) tampoco hay errores: el diseño ya es para la pluma directa', () => {
    expect(juzgarAlambre(D).filter((h) => h.regla === 'A11' && h.nivel !== 'info')).toEqual([]);
    expect(D.zocalo.sinCampana.Tint).toBeLessThanOrEqual(REQ_ALAMBRE.tPetgMax - REQ_ALAMBRE.margenT);
  });
});

describe('Alambre · ronda 2: K14, el KSD301 en el zócalo', () => {
  it('existe, su tapa toca el inserto (el PETG más caliente) y es respaldo: no corta trabajando con 0 % y corta antes de Tg − 5', () => {
    const K = D.termostato, a = juzgarAlambre(D).find((h) => h.regla === 'A22')!, tol = SUPUESTOS.termostato.tol;
    console.log(`[K14] ${K.clase} NC ${K.T} °C ±${tol}: la tapa toca el inserto en y ${K.yCara}, z ${K.zK} · lee ${K.R.toFixed(1)} °C trabajando con la pluma directa (${K.Rinfo.toFixed(1)} con 80 %) · no corta antes de ${K.noCortaHasta} °C (margen ${REQ_ALAMBRE.margenT} K) y corta a ≤ ${K.cortaA} °C < ${REQ_ALAMBRE.tPetgFalla} · uno de 65 °C podría cortar trabajando`);
    expect(a.nivel).toBe('info');
    expect(K.T).toBe(70);
    expect(K.T! - tol).toBeGreaterThanOrEqual(K.R + REQ_ALAMBRE.margenT);
    expect(K.T! + tol).toBeLessThanOrEqual(REQ_ALAMBRE.tPetgFalla);
    expect(K.yCara).toBe(D.inserto.r);
  });
  it('K14 va con K08 por la canaleta de señal: ≥ 15 mm de K06 y de K07, y sin pasar del 40 % de llenado', () => {
    const d06 = distRutas(D.rutaSenal, D.rutaK06) - 3.25 - 2.5, d07 = distRutas(D.rutaSenal, D.rutaK07, [[40, 146, 120]], 25) - 5;
    console.log(`[K14] señal a ${d06.toFixed(1)} mm de K06 y a ${d07.toFixed(1)} mm de K07 (lejos del pasamuros) · ${D.canales.map((c) => `${c.id} ${c.seccion.toFixed(1)} mm²`).join(' · ')}`);
    expect(d06).toBeGreaterThanOrEqual(REGLAS.separacionPotenciaSenalMm);
    expect(d07).toBeGreaterThanOrEqual(REGLAS.separacionPotenciaSenalMm);
    expect(errores(D).filter((r) => r === 'A17' || r === 'A22')).toEqual([]);
  });
  it('caza uno de 65 °C y uno de 75 °C, la tapa lejos del inserto, el asiento quitado, K14 junto a K06 y una canaleta que no cabe', () => {
    const a = copia(); a.termostato.T = 65;
    expect(errores(a)).toContain('A22');
    const a2 = copia(); a2.termostato.T = 75;
    expect(errores(a2)).toContain('A22');
    const b = copia(); const g = b.impresas[1].prims.find((q) => q.nota?.startsWith('asiento del KSD301'))!; if (g.f === 'gota') g.c[1] += 3;
    expect(errores(b)).toContain('A22');
    const c = copia(); c.impresas[1].prims = c.impresas[1].prims.filter((q) => !q.nota?.startsWith('asiento del KSD301'));
    expect(errores(c)).toContain('A22');
    const e = copia(); e.rutaK14 = [[-20, 0, 270], [-40, 120, 210], [-30, -12.65, 317]];
    expect(errores(e)).toContain('A17');
    const f = copia(); f.canales[0].seccion = 10;
    expect(errores(f)).toContain('A17');
  });
  it('la gota de los barrenos es un polígono simple: área = ¾πr² + r² (la de la ronda 1 se cruzaba)', () => {
    const pts = perfilGota(2, 400); let A = 0;
    for (let i = 0; i < pts.length; i++) { const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length]; A += x0 * y1 - x1 * y0; }
    expect(Math.abs(A / 2)).toBeCloseTo(0.75 * PI * 4 + 4, 2);
    expect(Math.min(...pts.map((p) => p[1]))).toBeCloseTo(-2, 6);
  });
});

describe('Alambre · ronda 2: D4, las juntas calientes', () => {
  it('OUT− al portapuntas con Silfos y fundente (latón); el inox con plata sin fósforo', () => {
    const j = D.juntas;
    for (const x of j) console.log(`[juntas] ${x.a}–${x.b}: ${x.tipo}${x.fundente ? ' + fundente' : ''} (${x.nota ?? ''})`);
    expect(j.find((x) => x.a === 'cableK06' && x.b === 'portapuntas')!.tipo).toBe('Silfos');
    expect(j.find((x) => x.a === 'cuello')!.tipo).not.toBe('Silfos');
    expect(errores(D).filter((r) => r === 'A21')).toEqual([]);
  });
  it('caza Silfos en el cuello de inox y una junta de latón sin fundente', () => {
    const d = copia(); d.juntas.find((x) => x.a === 'cuello')!.tipo = 'Silfos';
    expect(errores(d)).toContain('A21');
    const e = copia(); e.juntas.find((x) => x.a === 'cableK06')!.fundente = false;
    expect(errores(e)).toContain('A21');
  });
});

describe('Alambre · ronda 2: REGLAS.todoImprimible', () => {
  it('cada escudo tiene sus ranuras en su pieza impresa (y el del carrete, de dónde colgarse)', () => {
    for (const es of D.escudos) {
      const n = D.impresas.find((p) => p.id === es.pieza)!.prims.filter((q) => q.op === '-' && q.nota === `ranura escudo «${es.nota}»`).length;
      expect(n).toBeGreaterThanOrEqual(2);
    }
    if (D.escudoCarrete) expect(D.impresas[0].prims.some((q) => q.nota === 'ranura escudo del carrete')).toBe(true);
    console.log(`[imprimible] ${D.escudos.length} escudos con ${D.impresas.flatMap((p) => p.prims).filter((q) => q.nota?.startsWith('ranura escudo')).length} ranuras impresas · χ del inox en la pluma ${chiCuerpo(SUPUESTOS.enPluma.epsInox).toFixed(2)}`);
  });
  it('caza un escudo sin ranuras (sería un número, no una pieza)', () => {
    const d = copia(); const es = d.escudos[0], pz = d.impresas.find((p) => p.id === es.pieza)!;
    pz.prims = pz.prims.filter((q) => q.nota !== `ranura escudo «${es.nota}»`);
    expect(errores(d)).toContain('A20');
  });
});

describe('Alambre · las piezas para La Forja', () => {
  it('las impresas son mallas FMSH; las compradas, primitivas; ids únicos', () => {
    const P = piezasAlambre(D);
    const ids = new Set(P.map((p) => p.id));
    expect(ids.size).toBe(P.length);
    const mallas = P.filter((p) => p.kind === 'malla');
    expect(mallas.length).toBe(D.impresas.length);
    for (const m of mallas) expect(m.url).toMatch(/^\/modelos\/laboratorio\/alambre\/[a-z-]+\.bin$/);
    expect(P.find((p) => p.id === 'alambre-portapuntas')!.mat).toBe('laton');
    expect(P.filter((p) => p.id.startsWith('alambre-tirante')).length).toBe(2);
    expect(P.some((p) => p.id === 'alambre-ksd301')).toBe(true);
    console.log(`[forja] ${P.length} piezas: ${mallas.length} mallas + ${P.length - mallas.length} primitivas`);
  });
});

function QcW() { return SUPUESTOS.arco.fConv * SUPUESTOS.arco.I * SUPUESTOS.arco.V; }
