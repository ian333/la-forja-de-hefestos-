#!/usr/bin/env node
/**
 * Quick sanity check: compute H2 PES with STO-3G RHF and compare to known values.
 * Run with tsx so TS files import cleanly.
 */
const { spawnSync } = require('child_process');
const out = spawnSync('npx', ['-y', 'tsx', '-e', `
  import { computePES, fitBond, rhfH2 } from './src/lib/qm/rhf-h2';
  const pes = computePES(0.6, 4.0, 80);
  const fit = fitBond(pes);
  const probe = rhfH2(fit.Req);
  console.log(JSON.stringify({
    Req_bohr: fit.Req,
    Req_angstrom: fit.Req * 0.529177210903,
    Emin_Ha: fit.Emin,
    De_Ha: fit.DeHartree,
    De_eV: fit.DeHartree * 27.2114,
    k_Hartree_bohr2: fit.kHartreeBohr2,
    k_N_per_m: fit.kNperM,
    k_kcal_mol_A2: fit.kKcalMolA2,
    nu_cm1: fit.nuTildeCm1,
    probe_energy: probe.energy,
    probe_iterations: probe.iterations,
    probe_converged: probe.converged,
    probe_overlap_S12: probe.overlap,
    probe_orbital_energies: probe.orbitalEnergies,
  }, null, 2));
`], { encoding: 'utf8', cwd: '/home/ian/Orkesta/la-forja' });
console.log(out.stdout || '');
if (out.stderr) console.error(out.stderr);
