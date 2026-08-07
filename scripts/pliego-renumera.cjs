#!/usr/bin/env node
/**
 * Renumera los 292 análisis del pliego Kazmer a UN espacio de IDs único, en ORDEN DE LIBRO.
 * Cada tomo se escribió por separado y dos de ellos reiniciaron en A-01 → colisión de IDs.
 *
 * El mapeo es afín por tomo porque se verificó que TODA referencia del cuerpo cae dentro del
 * rango que el propio tomo define (0 referencias cruzadas reales; las 5 fuera de rango son
 * notas que hablan de la colisión misma y se dejan intactas para reescribirlas a mano).
 */
const fs = require("fs");
const path = require("path");

const DIR = "/home/ian/Orkesta/la-forja/docs/forja-research/kazmer-pliego";

// [archivo, primer id local, último id local, primer id NUEVO]
const TOMOS = [
  ["analisis-caps1-3.md", 1, 59, 1],
  ["analisis-caps4-6.md", 1, 78, 60],
  ["analisis-caps7-9.md", 1, 71, 138],
  ["analisis-caps10-13.md", 60, 143, 209],
];

const pad = (n) => "A-" + String(n).padStart(3, "0");
const RE = /\bA-(\d{2,3})\b/g;

let errores = 0;
const fila = (msg, ok) => {
  if (!ok) errores++;
  console.log(`  ${ok ? "✔" : "✘"} ${msg}`);
};

// ── 1. Verificar el supuesto ANTES de escribir nada ────────────────────────────
console.log("── PRE: el mapeo afín solo es válido si cada tomo es contiguo y auto-contenido");
const original = {};
for (const [f, lo, hi] of TOMOS) {
  const txt = fs.readFileSync(path.join(DIR, f), "utf8");
  original[f] = txt;
  const heads = [...txt.matchAll(/^### A-(\d{2,3})\b/gm)].map((m) => +m[1]);
  const esperado = hi - lo + 1;
  const uniq = new Set(heads);
  fila(
    `${f}: ${heads.length} encabezados, ${uniq.size} distintos, rango ${Math.min(...heads)}..${Math.max(...heads)} (esperado ${lo}..${hi}, ${esperado})`,
    heads.length === esperado && uniq.size === esperado && Math.min(...heads) === lo && Math.max(...heads) === hi
  );
}
if (errores) {
  console.log("\nABORTA: el supuesto de contigüidad falla.");
  process.exit(1);
}

// ── 2. Reescribir ──────────────────────────────────────────────────────────────
console.log("\n── RENUMERANDO");
const mapa = {}; // f -> [{viejo, nuevo}]
const intactos = []; // referencias fuera de rango, se dejan tal cual
for (const [f, lo, hi, base] of TOMOS) {
  const txt = original[f];
  const antes = (txt.match(RE) || []).length;
  const vistos = new Map();
  const nuevo = txt.replace(RE, (tok, d) => {
    const n = +d;
    if (n < lo || n > hi) {
      intactos.push({ f, tok });
      return tok; // fuera de rango: NO tocar, se revisa a mano
    }
    const dest = base + (n - lo);
    vistos.set(n, dest);
    return pad(dest);
  });
  const despues = (nuevo.match(/\bA-\d{2,3}\b/g) || []).length;
  fila(
    `${f}: ${antes} tokens antes → ${despues} después · ${vistos.size} IDs mapeados · líneas ${txt.split("\n").length}=${nuevo.split("\n").length}`,
    antes === despues && txt.split("\n").length === nuevo.split("\n").length
  );
  mapa[f] = [...vistos.entries()].sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(path.join(DIR, f), nuevo);
}

// ── 3. POST: invariantes sobre el resultado ────────────────────────────────────
console.log("\n── POST: invariantes del espacio de IDs unificado");
const todos = [];
for (const [f] of TOMOS) {
  const txt = fs.readFileSync(path.join(DIR, f), "utf8");
  for (const m of txt.matchAll(/^### (A-\d{3})\b/gm)) todos.push(m[1]);
}
const set = new Set(todos);
fila(`292 análisis con encabezado: ${todos.length}`, todos.length === 292);
fila(`sin IDs duplicados: ${set.size} distintos`, set.size === 292);
const faltantes = [];
for (let i = 1; i <= 292; i++) if (!set.has(pad(i))) faltantes.push(pad(i));
fila(`cobertura exacta A-001..A-292, sin huecos${faltantes.length ? " — faltan " + faltantes.join(",") : ""}`, faltantes.length === 0);
// orden de libro: los IDs tienen que salir ascendentes al leer los 4 tomos en orden
let asc = true;
for (let i = 1; i < todos.length; i++) if (+todos[i].slice(2) <= +todos[i - 1].slice(2)) asc = false;
fila("los IDs ascienden monótonos al leer los tomos en orden de libro", asc);
fila(`referencias fuera de rango dejadas intactas (se reescriben a mano): ${intactos.length}`, intactos.length === 5);
for (const it of intactos) console.log(`      · ${it.f}: ${it.tok}`);

console.log(`\n${errores === 0 ? "✔ RENUMERACIÓN LIMPIA" : "✘ " + errores + " INVARIANTES ROTOS"}`);
fs.writeFileSync(
  "/tmp/claude-1000/-home-ian-Orkesta-la-forja/86616bb5-44f5-4a6d-903c-b7ac70b28c29/scratchpad/mapa-ids.json",
  JSON.stringify(mapa, null, 1)
);
process.exit(errores ? 1 : 0);
