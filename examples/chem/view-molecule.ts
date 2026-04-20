/**
 * ══════════════════════════════════════════════════════════════════════
 *  view-molecule — "ojo CLI" para ver una molécula sin browser
 * ══════════════════════════════════════════════════════════════════════
 *
 * Corre el mismo motor de sampling que el viewport 3D y lo proyecta a
 * ASCII con colores ANSI. Sirve para:
 *   · Yo (el asistente IA) verificar si la simulación cambia al mover
 *     parámetros, sin necesidad de acceder al browser.
 *   · Tú inspeccionar rápidamente qué sale del motor.
 *   · Debug de sampling (¿se ve sparse? ¿concentrado? ¿colores por MO?).
 *
 * Uso:
 *   npm run lesson examples/chem/view-molecule.ts H₂ 1.4
 *   npm run lesson examples/chem/view-molecule.ts H₂ 5.5
 *   npm run lesson examples/chem/view-molecule.ts N₂
 *   npm run lesson examples/chem/view-molecule.ts HF
 *
 * Proyección: plano XY (Z es el eje perpendicular al papel).
 * Aspect ratio ajustado (char:line ~2:1) para que las formas no queden aplanadas.
 */

import {
  MOLECULE_CATALOG, moleculeByFormula, setBondLength,
  sampleMoleculeFast, bondOrder, totalElectrons,
} from '@/lib/chem/quantum/molecular-orbitals';

const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
function fg256(n: number): string { return `\x1b[38;5;${n}m`; }

// Colores ANSI aproximados a la paleta visual
const COLOR_BOND_POS   = fg256(39);   // cian (ψ > 0 bonding)
const COLOR_BOND_NEG   = fg256(215);  // naranja (ψ < 0 bonding)
const COLOR_ANTI_POS   = fg256(40);   // verde
const COLOR_ANTI_NEG   = fg256(196);  // rojo
const COLOR_NONB_POS   = fg256(141);  // violeta
const COLOR_NONB_NEG   = fg256(209);  // durazno
const COLOR_NUCLEUS    = fg256(220);  // dorado

// Caracteres por densidad (de bajo a alto)
const SHADES = ' .·:‥⁚⁛*✱✴✸●';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface GridCell {
  density: number;
  sign: number;
  moIdx: number;
  count: number;
}

function renderMolecule(formula: string, R: number | null): void {
  const molBase = moleculeByFormula(formula);
  if (!molBase) {
    console.error(`Molécula "${formula}" no encontrada. Disponibles: ${MOLECULE_CATALOG.map(m => m.formula).join(', ')}`);
    return;
  }
  const mol = R !== null ? setBondLength(molBase, R) : molBase;

  const COLS = 100;
  const ROWS = 30;
  const EXTENT_X = 7.5;
  const EXTENT_Y = 4.0;

  // Samplear con el mismo algoritmo que el viewport
  const N = 8000;
  const samples = sampleMoleculeFast(mol, N, 42);

  // Grilla acumulada
  const grid: GridCell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ density: 0, sign: 0, moIdx: -1, count: 0 })),
  );

  for (const s of samples) {
    const col = Math.floor(((s.x + EXTENT_X) / (2 * EXTENT_X)) * COLS);
    const row = Math.floor((1 - (s.y + EXTENT_Y) / (2 * EXTENT_Y)) * ROWS);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
    const cell = grid[row][col];
    cell.density += s.density;
    cell.sign += s.sign;
    cell.moIdx = s.dominantMOIndex;
    cell.count++;
  }

  // Normalización de densidad
  let maxD = 0;
  for (const row of grid) for (const c of row) if (c.density > maxD) maxD = c.density;
  if (maxD === 0) maxD = 1;

  // Posiciones de núcleos en el grid
  const nucleusAt = new Map<string, { element: string; Z: number }>();
  for (const atom of mol.atoms) {
    const col = Math.round(((atom.position[0] + EXTENT_X) / (2 * EXTENT_X)) * COLS);
    const row = Math.round((1 - (atom.position[1] + EXTENT_Y) / (2 * EXTENT_Y)) * ROWS);
    nucleusAt.set(`${row}:${col}`, { element: atom.element, Z: atom.Z });
    // También marcar las 8 celdas adyacentes con menor prioridad
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const key = `${row + dr}:${col + dc}`;
        if (!nucleusAt.has(key)) {
          nucleusAt.set(key, { element: '·', Z: atom.Z });
        }
      }
    }
  }

  // Header
  console.log('');
  console.log(BOLD + `  ${mol.formula}  —  ${mol.name}` + RESET);
  console.log(`  R = ${(mol.bondLength ?? 0).toFixed(2)} a₀  (${((mol.bondLength ?? 0) * 0.529).toFixed(2)} Å) · ${samples.length} muestras · orden ${bondOrder(mol).toFixed(1)} · ${totalElectrons(mol)} e⁻\n`);

  // Marco
  const border = '  ╔' + '═'.repeat(COLS) + '╗';
  console.log(border);

  for (let r = 0; r < ROWS; r++) {
    let line = '  ║';
    for (let c = 0; c < COLS; c++) {
      const nuc = nucleusAt.get(`${r}:${c}`);
      if (nuc && nuc.element !== '·') {
        line += COLOR_NUCLEUS + BOLD + '◉' + RESET;
        continue;
      }
      const cell = grid[r][c];
      if (cell.count === 0) {
        line += ' ';
        continue;
      }
      const intensity = clamp(cell.density / maxD, 0, 1);
      const charIdx = Math.min(SHADES.length - 1, Math.floor(intensity * SHADES.length));
      const ch = SHADES[charIdx];
      const avgSign = cell.sign / cell.count;
      const mo = mol.mos[cell.moIdx];
      let color = '';
      if (mo?.symmetry === 'bonding')      color = avgSign > 0 ? COLOR_BOND_POS : COLOR_BOND_NEG;
      else if (mo?.symmetry === 'antibonding') color = avgSign > 0 ? COLOR_ANTI_POS : COLOR_ANTI_NEG;
      else                                   color = avgSign > 0 ? COLOR_NONB_POS : COLOR_NONB_NEG;
      line += color + ch + RESET;
    }
    line += '║';
    console.log(line);
  }
  const borderEnd = '  ╚' + '═'.repeat(COLS) + '╝';
  console.log(borderEnd);

  // Leyenda
  console.log('');
  console.log('  ' + BOLD + 'Leyenda:' + RESET);
  console.log(`    ${COLOR_BOND_POS}●${RESET} bonding ψ>0    ${COLOR_BOND_NEG}●${RESET} bonding ψ<0`);
  console.log(`    ${COLOR_ANTI_POS}●${RESET} antibond ψ>0   ${COLOR_ANTI_NEG}●${RESET} antibond ψ<0`);
  console.log(`    ${COLOR_NONB_POS}●${RESET} lone pair ψ>0  ${COLOR_NONB_NEG}●${RESET} lone pair ψ<0`);
  console.log(`    ${COLOR_NUCLEUS}${BOLD}◉${RESET} núcleo`);
  console.log('');

  // Resumen MOs
  console.log('  ' + BOLD + 'Orbitales moleculares:' + RESET);
  for (let i = 0; i < mol.mos.length; i++) {
    const mo = mol.mos[i];
    const occupancy = '↑↓'.substring(0, mo.occupancy);
    const pad = '  '.substring(mo.occupancy);
    console.log(`    ${i.toString().padStart(2)}. ${mo.name.padEnd(10)} ${mo.symmetry.padEnd(12)} ${occupancy}${pad}  E=${mo.energy.toFixed(1)} eV`);
  }
  console.log('');
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

const formula = process.argv[2] ?? 'H₂';
const R = process.argv[3] ? parseFloat(process.argv[3]) : null;

if (formula === '--list' || formula === '-l') {
  console.log('\nMoléculas disponibles:');
  for (const m of MOLECULE_CATALOG) {
    console.log(`  ${m.formula.padEnd(8)} — ${m.name}  (R_eq = ${(m.bondLength ?? 0).toFixed(2)} a₀)`);
  }
  console.log('');
} else if (formula === '--compare') {
  // Uso: view-molecule.ts --compare H₂ 1.4 3.0 6.0
  const target = process.argv[3] ?? 'H₂';
  const distances = process.argv.slice(4).map(Number);
  if (distances.length === 0) {
    console.error('Uso: --compare <formula> <R1> <R2> ...');
    process.exit(1);
  }
  for (const R of distances) {
    renderMolecule(target, R);
  }
} else {
  renderMolecule(formula, R);
}
