/* Test de la MATEMÁTICA de soportes funcionales. node --import tsx scripts/supports-test.ts */
import {
  faceTiltDeg, needsSupport, maxSelfBridgeGap, selfBridged, bridgeSpan,
  breakForce, webAreaForForce, centeringSpokes, ribCount, greaseChannel,
  designFunctionalSupports,
} from '../src/forja/mech/supports';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 0.05) => Math.abs(a - b) < t;
const ck = (name: string, ok: boolean, extra = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${name} ${extra}`); } };

// 1) VOLADIZO: criterio del ángulo
ck('techo horizontal (nz=-1) → voladizo', needsSupport(-1) && near(faceTiltDeg(-1), 0));
ck('pared vertical (nz=0) → NO voladizo', !needsSupport(0) && near(faceTiltDeg(0), 90));
ck('cara a 45° abajo (nz=-0.707) → límite, NO necesita', !needsSupport(-Math.cos(Math.PI / 4)));
ck('cara a 30° de horizontal abajo → SÍ necesita', needsSupport(-Math.cos((30 * Math.PI) / 180)));
ck('cara hacia ARRIBA nunca necesita', !needsSupport(+1) && !needsSupport(+0.3));

// 2) AUTO-PUENTE: el stack se sostiene solo si hay pieza cerca debajo
ck('gMax PLA capa 0.2 ≈ 0.9mm', near(maxSelfBridgeGap('PLA', 0.2), 0.9, 0.01), `${maxSelfBridgeGap('PLA', 0.2)}`);
ck('gap 0.6 PLA → auto-puentea (no soporte entre discos)', selfBridged(0.6, 'PLA'));
ck('gap 1.5 PLA → NO auto-puentea (voladizo verdadero)', !selfBridged(1.5, 'PLA'));
ck('puente libre PLA = 8mm', bridgeSpan('PLA') === 8);

// 3) ALMA FRANGIBLE: F = τ·A
ck('PLA τ=28: alma 0.4×1 rompe a 11.2 N', near(breakForce('PLA', 0.4 * 1), 11.2, 0.01), `${breakForce('PLA', 0.4)}`);
ck('área para 100N en PLA ≈ 3.57mm²', near(webAreaForForce('PLA', 100), 3.571, 0.01));

// 4) CENTRADO frangible — caja default, 50 N·m
const cen = centeringSpokes({ outputTorqueNm: 50, ratio: 10, camRadius: 9.5, discMassG: 35, material: 'PLA' });
ck('centrado: ROMPE al primer giro (Fbreak < Fmotor)', cen.shearsOnFirstTurn, JSON.stringify(cen));
ck('centrado: AGUANTA la impresión (Fbreak ≫ peso)', cen.holdsDuringPrint);
ck('espiga ≥ 1 boquilla (0.4mm)', cen.spokeThickness >= 0.4);
ck('Fmotor >> Fprint (hay de sobra para romper)', cen.Fmotor > cen.Fprint * 50, `${cen.Fmotor} vs ${cen.Fprint}`);

// 5) NERVIOS + canal de grasa
ck('nervios en R=40 PLA (arco ≤ 8mm)', ribCount(40, 'PLA') >= Math.ceil((2 * Math.PI * 40) / 8));
// el excéntrico bombea fuerte (ΔP~0.6MPa) → la grasa fluye por un canal de 0.6mm
const gc = greaseChannel({ channelW: 0.6, channelL: 40, pumpPressurePa: 660000 });
ck('canal de grasa 0.6mm FLUYE bajo el bombeo del excéntrico', gc.flows && gc.wMin < 0.6, `wmin=${gc.wMin}`);

// 6) DISEÑO COMPLETO — válido
const d = designFunctionalSupports({ lobes: 10, discs: 5, R: 40, Rr: 3, E: 1.5, T: 6, gap: 0.6, shaftD: 16 }, 50, 'PLA');
ck('diseño de soportes VÁLIDO (centra+rompe+puentea)', d.valid, JSON.stringify(d.centering));
ck('inter-disco se AUTO-PUENTEA (no soporte ahí)', d.interDiscSelfBridged);

console.log(`SUPPORTS_TEST pass=${pass} fail=${fail}`);
console.log('diseño caja 5-disco PLA 50N·m:', JSON.stringify(designFunctionalSupports({ lobes: 10, discs: 5, R: 40, Rr: 3, E: 1.5, T: 6, gap: 0.6, shaftD: 16 }, 50, 'PLA'), null, 2));
process.exit(fail === 0 ? 0 : 1);
