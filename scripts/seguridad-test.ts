/* Verifica los factores de seguridad (fusión + estructural). node --import tsx scripts/seguridad-test.ts */
import {
  effectiveGap, fusionSF, requiredModelGap, fusionVerdict, allowableStress, structuralSF, structVerdict, evaluateSafety, PRINT,
} from '../src/forja/mech/factor-seguridad';

let pass = 0, fail = 0;
const near = (a: number, b: number, t = 1e-2) => Math.abs(a - b) < t;
const ck = (n: string, ok: boolean, x = '') => { if (ok) pass++; else { fail++; console.log(`✗ ${n} ${x}`); } };

// (1) El gap del modelo NO es el real: crece la pared.
ck('gap efectivo = modelo − 2·crecimiento', near(effectiveGap(0.55), 0.55 - 2 * PRINT.overExtrudePerSide));
ck('gap 0.55 → efectivo ≈ 0.31 mm', near(effectiveGap(0.55), 0.31, 1e-3));

// (2) SF de fusión: 0.55 ≈ 1.0 (cero margen → se funde con variación). Esto explica al usuario.
ck('gap 0.55 → SF_fusión ≈ 1.03 (cero margen, se funde)', near(fusionSF(0.55), 0.31 / 0.30, 1e-2), `${fusionSF(0.55)}`);
ck('SF<1.5 = NO seguro', !fusionVerdict(0.55, 1.5).safe);

// (3) Gap requerido para SF=1.5: ≈ 0.69 mm (modelo).
ck('gap modelo para SF 1.5 ≈ 0.69 mm', near(requiredModelGap(1.5), 1.5 * 0.30 + 2 * 0.12, 1e-3), `${requiredModelGap(1.5)}`);
ck('gap 0.69 → efectivo ≈ 0.45 → SF 1.5 ✓', fusionVerdict(0.69, 1.5).safe && near(fusionVerdict(0.69).sf, 1.5, 0.05));
ck('gap 0.8 → SF ~1.87 (holgado)', fusionSF(0.8) > 1.8);

// (4) Estructural: admisible = resistencia/SF; SF_real = resistencia/aplicado.
ck('admisible cortante SF=2 = 28/2 = 14 MPa', near(allowableStress(28, 2), 14));
ck('barril 9 MPa vs PLA tensil 50 → SF ~5.5 (sobrado)', near(structuralSF(9, 50), 50 / 9, 0.05));
ck('contacto a 30 MPa tensil → SF 1.67 < 2 = NO seguro', !structVerdict(30, 'tensile', 2).safe);
ck('contacto a 9 MPa tensil → SF seguro', structVerdict(9, 'tensile', 2).safe);

// (5) Evaluar la caja: gaps actuales (0.55) + esfuerzos.
const evAct = evaluateSafety({
  gaps: [{ name: 'disco↔hembra', modelGap: 0.55 }, { name: 'journal', modelGap: 0.6 }, { name: 'inter-disco', modelGap: 0.6 }],
  stresses: [{ name: 'contacto barril', mpa: 9, mode: 'tensile' }, { name: 'cuello frangible', mpa: 6, mode: 'shear' }],
});
ck('caja ACTUAL: fusión NO segura (gaps al límite)', !evAct.allSafe && !evAct.worstFusion.safe);
ck('caja ACTUAL: recomienda gap ≈ 0.69', near(evAct.recommendedGap, 0.69, 1e-2));
const evFix = evaluateSafety({
  gaps: [{ name: 'disco↔hembra', modelGap: 0.75 }, { name: 'journal', modelGap: 0.75 }, { name: 'inter-disco', modelGap: 0.75 }],
  stresses: [{ name: 'contacto barril', mpa: 9, mode: 'tensile' }],
});
ck('caja con gap 0.75: TODO seguro', evFix.allSafe && evFix.worstFusion.safe);

console.log(`\nSEGURIDAD_TEST pass=${pass} fail=${fail}`);
console.log('caja ACTUAL (0.55):', JSON.stringify(evAct, null, 1));
process.exit(fail === 0 ? 0 : 1);
