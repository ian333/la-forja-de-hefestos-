/*
 * imprimibilidad.ts — HERRAMIENTA: ¿se imprime en 1 pieza SIN soportes del slicer?
 * Corre la matemática de supports.ts sobre el reductor GENERADO y da el veredicto
 * con números: auto-puente entre discos, espigas frangibles (rompen al 1er giro,
 * aguantan la impresión), canal de grasa. Responde "los discos planos ¿necesitan
 * soporte?" con física, no intuición.
 *   npx esbuild scripts/imprimibilidad.ts --bundle --platform=node --format=cjs --outfile=/tmp/imp.cjs && node /tmp/imp.cjs
 */
import { designFunctionalSupports, faceTiltDeg, needsSupport, maxSelfBridgeGap, type GearboxLite } from '../src/forja/mech/supports';

// El reductor que generó el GA
const CH: GearboxLite = { lobes: 16, discs: 5, R: 21.4, Rr: 1.44, E: 0.39, T: 8.6, gap: 0.69, shaftD: 14.8 };
const TORQUE = 8.5;
const MAT = 'PLA' as const;

const r = designFunctionalSupports(CH, TORQUE, MAT);
const gMax = maxSelfBridgeGap(MAT);

console.log('═══ ¿SE IMPRIME EN 1 PIEZA SIN SOPORTES? — reductor generado ═══\n');
console.log(`material ${MAT} · ${CH.discs} discos · gap ${CH.gap} mm\n`);

console.log('── 1) La INTUICIÓN: "los discos son planos → voladizo" ──');
console.log(`  cara INFERIOR de un disco: normal nz=-1 → inclinación ${faceTiltDeg(-1).toFixed(0)}° (horizontal)`);
console.log(`  regla naïve (β<45° y mira abajo): needsSupport = ${needsSupport(-1)}  ← por eso "se ve" que necesita`);

console.log('\n── 2) La MATEMÁTICA: el disco de ABAJO es el soporte (auto-puente) ──');
console.log(`  gap entre discos   = ${CH.gap} mm`);
console.log(`  puente máx (PLA)   = ${gMax} mm  (4.5 capas × 0.2)`);
console.log(`  ¿auto-puentea?     = ${r.interDiscSelfBridged ? 'SÍ ✓ — el FDM cruza el gap, el disco de abajo lo sostiene' : 'NO ✗ — gap muy grande'}`);
console.log(`  ⇒ los discos NO necesitan soporte del slicer; se imprimen uno sobre otro.`);

console.log('\n── 3) Lo que SÍ necesita ayuda: CENTRAR el disco en la leva ──');
const c = r.centering;
console.log(`  espigas frangibles = ${c.spokes} × ${c.spokeThickness}mm (alto ${c.spokeHeight}mm)`);
console.log(`  F motor (1er giro) = ${c.Fmotor} N · F rompe = ${c.Fbreak} N · F impresión (peso disco) = ${c.Fprint} N`);
console.log(`  rompe al 1er giro  = ${c.shearsOnFirstTurn ? 'SÍ ✓ (F_rompe < F_motor)' : 'NO ✗'}`);
console.log(`  aguanta imprimir   = ${c.holdsDuringPrint ? 'SÍ ✓ (F_rompe ≫ peso)' : 'NO ✗'}`);

console.log('\n── 4) El vacío de los soportes = canal de grasa ──');
console.log(`  nervios exteriores = ${r.ribsOuter} · canal ${CH.gap}mm ${r.greaseChannel.flows ? 'FLUYE ✓' : 'no fluye ✗'} (w_min ${r.greaseChannel.wMin}mm)`);
console.log(`  masa de 1 disco    = ${r.discMassG} g · radio leva = ${r.camRadius} mm`);

console.log(`\n═══ VEREDICTO: ${r.valid ? '✓ SE IMPRIME EN 1 PIEZA, SIN SOPORTES DEL SLICER' : '✗ NO cumple — revisar'} ═══`);
console.log('  (auto-puente entre discos + espigas frangibles de centrado que el 1er giro corta)');
console.log('\nIMPRIMIBILIDAD_JSON=' + JSON.stringify(r));
