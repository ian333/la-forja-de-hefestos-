#!/usr/bin/env node
/** Genera INDICE-ANALISIS.md: los 292 análisis del pliego en un solo lugar, en orden de libro. */
const fs = require("fs");
const path = require("path");
const DIR = "/home/ian/Orkesta/la-forja/docs/forja-research/kazmer-pliego";

// [archivo, capítulos, offset aplicado en la renumeración, rango local original]
const TOMOS = [
  ["analisis-caps1-3.md", "1–3", 0, "A-01…A-59"],
  ["analisis-caps4-6.md", "4–6", 59, "A-01…A-78"],
  ["analisis-caps7-9.md", "7–9", 137, "A-01…A-71"],
  ["analisis-caps10-13.md", "10–13", 149, "A-60…A-143"],
];

// OJO: nada de `\b` después de una vocal acentuada — en JS `\b` es ASCII, así que "SÍ" tiene
// frontera ENTRE S e Í, no después. Ése fue el bug que dejó 172 análisis sin estado.
const ESTADOS = [
  [/^S[ÍI](?![a-záéíóúñ])/i, "SÍ", "🟩"],
  [/^PARCIAL/i, "PARCIAL", "🟨"],
  [/^FALTA/i, "FALTA", "🟥"],
  [/^DIVERGE/i, "DIVERGE", "⬛"],
  [/^CONTRADICE/i, "CONTRADICE", "⬛"],
  [/^NO\b/i, "FALTA", "🟥"],
  // A-106 dice "CASI FALTA": la constante existe pero está muerta (declarada, nunca usada).
  // En sustancia es FALTA — no hay cálculo. Se normaliza aquí en vez de inventar un 5º estado.
  [/^CASI FALTA/i, "FALTA", "🟥"],
];

const filas = [];
for (const [f, caps, off, rangoLocal] of TOMOS) {
  const lines = fs.readFileSync(path.join(DIR, f), "utf8").split("\n");
  let fase = "";
  let cur = null;
  const cerrar = () => { if (cur) filas.push(cur); cur = null; };
  for (const L of lines) {
    let m;
    if ((m = L.match(/^# (?!# )(.+)$/))) { fase = m[1].trim(); continue; }
    if ((m = L.match(/^### (A-\d{3})\s*[·—–-]\s*(.+?)\s*$/))) {
      cerrar();
      cur = { id: m[1], titulo: m[2], fase, f, caps, viejo: "A-" + String(+m[1].slice(2) - off).padStart(2, "0"), rangoLocal, estado: "?", icono: "⬜" };
      continue;
    }
    // caps4-6 escribe `- **¿TENEMOS?** — **PARCIAL.**`; los otros tomos omiten el guion largo.
    if (cur && cur.estado === "?" && (m = L.match(/\*\*¿TENEMOS\?\*\*\s*[—–-]?\s*\*\*(.+)$/))) {
      const t = m[1].replace(/^\*+/, "").trim();
      for (const [re, nombre, ico] of ESTADOS) if (re.test(t)) { cur.estado = nombre; cur.icono = ico; break; }
    }
  }
  cerrar();
}

// ── invariantes ────────────────────────────────────────────────────────────────
let err = 0;
const chk = (m, ok) => { if (!ok) err++; console.log(`  ${ok ? "✔" : "✘"} ${m}`); };
chk(`292 filas parseadas: ${filas.length}`, filas.length === 292);
chk(`IDs A-001..A-292 contiguos y en orden`, filas.every((r, i) => r.id === "A-" + String(i + 1).padStart(3, "0")));
const sinEstado = filas.filter((r) => r.estado === "?");
chk(`todas con estado reconocido${sinEstado.length ? " — sin estado: " + sinEstado.map((r) => r.id).join(",") : ""}`, sinEstado.length === 0);
const sinTitulo = filas.filter((r) => !r.titulo || r.titulo.length < 4);
chk(`todas con título`, sinTitulo.length === 0);
const sinFase = filas.filter((r) => !r.fase);
chk(`todas dentro de una fase/capítulo`, sinFase.length === 0);
if (err) { console.log("\nABORTA"); process.exit(1); }

// ── conteos ────────────────────────────────────────────────────────────────────
const cuenta = (rs) => {
  const c = { "SÍ": 0, PARCIAL: 0, FALTA: 0, DIVERGE: 0, CONTRADICE: 0 };
  rs.forEach((r) => c[r.estado]++);
  return c;
};
const tot = cuenta(filas);
const pct = (n) => ((100 * n) / filas.length).toFixed(1);

// ── escribir ───────────────────────────────────────────────────────────────────
const L = [];
L.push("# ÍNDICE MAESTRO DE ANÁLISIS — Kazmer, *Injection Mold Design Engineering*");
L.push("## Los 292 análisis que el libro corre en la cabeza de Kazmer, en un solo espacio de IDs");
L.push("");
L.push("> Este archivo se **genera**. No lo edites a mano: edita los cuatro tomos y vuelve a correr");
L.push("> `scripts/pliego-indice.cjs`. Los cuatro tomos se escribieron por separado y dos de ellos");
L.push("> reiniciaron en `A-01`; el 2026-08-07 se renumeró todo a un espacio único **`A-001 … A-292`**,");
L.push("> en **orden de libro** (caps. 1-3 → 4-6 → 7-9 → 10-13). La columna *era* conserva el ID viejo.");
L.push("");
L.push("## Marcador");
L.push("");
L.push("| estado | qué significa | análisis | % |");
L.push("|---|---|---:|---:|");
L.push(`| 🟩 **SÍ** | implementado y localizable en \`src/forja/mold/\` | ${tot["SÍ"]} | ${pct(tot["SÍ"])} |`);
L.push(`| 🟨 **PARCIAL** | existe el cálculo pero le falta salida, criterio o alcance | ${tot.PARCIAL} | ${pct(tot.PARCIAL)} |`);
L.push(`| 🟥 **FALTA** | el libro lo corre y nosotros no | ${tot.FALTA} | ${pct(tot.FALTA)} |`);
L.push(`| ⬛ **DIVERGE** | lo implementamos **distinto** de lo que dice el libro (desviación declarada) | ${tot.DIVERGE + tot.CONTRADICE} | ${pct(tot.DIVERGE + tot.CONTRADICE)} |`);
L.push(`| | **total** | **${filas.length}** | |`);
L.push("");
L.push("### Por tomo");
L.push("");
L.push("| tomo | caps. | IDs | era | 🟩 | 🟨 | 🟥 | ⬛ |");
L.push("|---|---|---|---|---:|---:|---:|---:|");
for (const [f, caps, , rangoLocal] of TOMOS) {
  const rs = filas.filter((r) => r.f === f);
  const c = cuenta(rs);
  L.push(`| [\`${f}\`](./${f}) | ${caps} | ${rs[0].id}…${rs[rs.length - 1].id} | ${rangoLocal} | ${c["SÍ"]} | ${c.PARCIAL} | ${c.FALTA} | ${c.DIVERGE + c.CONTRADICE} |`);
}
L.push("");
L.push("---");
L.push("");
L.push("## Los 292");
L.push("");
let faseActual = null;
let tomoActual = null;
for (const r of filas) {
  if (r.f !== tomoActual) {
    tomoActual = r.f;
    faseActual = null;
    L.push("");
    L.push(`## Tomo caps. ${r.caps} — [\`${r.f}\`](./${r.f})`);
  }
  if (r.fase !== faseActual) {
    faseActual = r.fase;
    L.push("");
    L.push(`### ${r.fase}`);
    L.push("");
    L.push("| ID | análisis | estado | era |");
    L.push("|---|---|---|---|");
  }
  L.push(`| **${r.id}** | ${r.titulo.replace(/\|/g, "\\|")} | ${r.icono} ${r.estado} | ${r.viejo} |`);
}
L.push("");
L.push("---");
L.push("");
L.push("## Cómo se lee esto");
L.push("");
L.push("Un análisis es una cosa que Kazmer **calcula y con la que decide algo**, no un párrafo del libro.");
L.push("Cada ficha en los tomos trae siempre los mismos ocho campos: **CUÁNDO · ENTRADAS · EL CÁLCULO ·");
L.push("SALIDA · DECIDE · CRITERIO · INVALIDA · ¿TENEMOS?**. Las `←A-nnn` en ENTRADAS son las aristas del");
L.push("grafo: quién alimenta a quién. Los IDs de este índice son los mismos que citan los tomos y el");
L.push("código (p. ej. `ejection.ts` cita **A-234**, `feed-layouts.ts` cita **A-136**).");
L.push("");
L.push(`**Lo que este índice dice de nosotros hoy:** ${tot["SÍ"]} de ${filas.length} análisis (${pct(tot["SÍ"])} %) existen en el código.`);
L.push(`Faltan **${tot.FALTA}** completos y hay **${tot.PARCIAL}** a medias. La suma 🟥+🟨 = **${tot.FALTA + tot.PARCIAL}** es el`);
L.push("trabajo pendiente medido contra el libro, no contra una opinión.");
L.push("");

fs.writeFileSync(path.join(DIR, "INDICE-ANALISIS.md"), L.join("\n"));
console.log(`\n✔ INDICE-ANALISIS.md — ${filas.length} análisis · SÍ ${tot["SÍ"]} · PARCIAL ${tot.PARCIAL} · FALTA ${tot.FALTA} · DIVERGE ${tot.DIVERGE + tot.CONTRADICE}`);
