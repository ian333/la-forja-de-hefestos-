#!/usr/bin/env node
/**
 * gen-catalog-meta.cjs — Vuelca scripts/catalog.json → src/cinematic/catalog-data.ts
 * (mapas que consume CinematicMolecule: META, SCALE, campo, conjugación) y un mapa
 * de átomos para la sonificación. Regenerar tras cambiar catalog.json.
 */
'use strict';
const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const cat = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts', 'catalog.json'), 'utf8'));

// tipo de campo: π (conjugadas) · σ (hidrocarburos puros) · none (resto: nube + pares libres)
function fieldKind(m) {
  if (m.conjugated) return 'pi';
  const onlyCH = m.atoms.every(a => a.Z === 6 || a.Z === 1);
  return onlyCH ? 'sigma' : 'none';
}
const FIELD_SUB = {
  pi: 'las caras π son ricas en electrones',
  sigma: 'la nube σ envuelve la molécula, fría y pareja',
};

const meta = {}, scale = {}, field = {}, fieldSub = {}, conj = [];
for (const m of cat) {
  meta[m.key] = { name: m.name, formula: m.formula, fact: m.fact };
  scale[m.key] = m.scale;
  const fk = fieldKind(m); field[m.key] = fk;
  if (fk !== 'none') fieldSub[m.key] = FIELD_SUB[fk];
  if (m.conjugated) conj.push(m.key);
}
const keys = cat.map(m => m.key);

const ts = `// AUTOGENERADO por scripts/gen-catalog-meta.cjs desde scripts/catalog.json — NO editar a mano.
export const CATALOG_KEYS = new Set<string>(${JSON.stringify(keys)});
export const CATALOG_CONJUGATED = new Set<string>(${JSON.stringify(conj)});
export const CATALOG_FIELD: Record<string, 'pi' | 'sigma' | 'none'> = ${JSON.stringify(field, null, 2)};
export const CATALOG_FIELD_SUB: Record<string, string> = ${JSON.stringify(fieldSub, null, 2)};
export const CATALOG_META: Record<string, { name: string; formula: string; fact: string }> = ${JSON.stringify(meta, null, 2)};
export const CATALOG_SCALE: Record<string, { what: string; measure: string; meaning: string }> = ${JSON.stringify(scale, null, 2)};
`;
fs.writeFileSync(path.join(ROOT, 'src', 'cinematic', 'catalog-data.ts'), ts);

// mapa de átomos para sonify (key → [[symbol,Z],...])
const audio = {};
for (const m of cat) audio[m.key] = (m.audioAtoms || []).map(a => [a.symbol, a.Z]);
fs.writeFileSync(path.join(ROOT, 'scripts', 'catalog-audio.json'), JSON.stringify(audio, null, 1));

console.log(`✓ catalog-data.ts (${keys.length} moléculas) · campos: ${Object.values(field).filter(f => f === 'pi').length}π ${Object.values(field).filter(f => f === 'sigma').length}σ ${Object.values(field).filter(f => f === 'none').length}none`);
console.log(`  keys: ${keys.join(', ')}`);
