#!/usr/bin/env node
/**
 * PLACA → KiCad (orden 2026-11-05-lab-placa · ronda 2: 2026-11-06-lab-placa-r2). Escribe, desde src/forja/lab/placa.ts
 * (la única fuente de verdad):
 *   placa.net              netlist «export (version D)» para Pcbnew (Archivo → Importar → Netlist)
 *   placa-bom.csv          lista de materiales (+ mecánica + lo de fuera + barrenos + islas), con su alternativa en México
 *   placa-posiciones.csv   el acomodo (x, y de KiCad = −y del contrato, giro, cara) para colocar las huellas
 *   placa-revision.txt     lo que dice el revisor (errores y avisos), la cuenta, la térmica, el motor y la cadena SD
 *   armado.txt             el orden de soldadura (D3 del contrato): SMD abajo → arriba → islas de cal 8 al final
 *   forja_lab.pretty/      las huellas propias (WeAct, TMC2209 + DIAG, choque, shunt, TEN 40, R-78E, fusible, hilos)
 * Antes de escribir, vuelve a leer la netlist con leerKicadNetlist() y compara: si no es la misma, sale con error.
 *
 *   node --import tsx scripts/laboratorio/placa-kicad.cjs [carpeta_salida]
 *   (default: models/kicad/laboratorio/)
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'models', 'kicad', 'laboratorio'));

(async () => {
  const pl = await import(path.join(ROOT, 'src', 'forja', 'lab', 'placa.ts'));
  fs.mkdirSync(path.join(OUT, 'forja_lab.pretty'), { recursive: true });

  // 1. la netlist, y de regreso
  const net = pl.kicadNetlist();
  const leida = pl.leerKicadNetlist(net);
  const nodos = pl.nodosPorRed();
  const esperadas = pl.COMPONENTES.length + pl.ISLAS.length + pl.BARRENOS.length;
  if (leida.componentes.length !== esperadas) throw new Error(`netlist: ${leida.componentes.length} huellas leídas, se escribieron ${esperadas}`);
  if (leida.redes.length !== nodos.size) throw new Error(`netlist: ${leida.redes.length} redes leídas, hay ${nodos.size}`);
  for (const r of leida.redes) {
    const a = r.nodos.map((x) => `${x.ref}.${x.pin}`).sort().join(' ');
    const b = (nodos.get(r.nombre) || []).map((x) => `${x.ref}.${x.pin}`).sort().join(' ');
    if (a !== b) throw new Error(`netlist: la red ${r.nombre} no regresa igual`);
  }
  fs.writeFileSync(path.join(OUT, 'placa.net'), net);

  // 2. materiales y posiciones
  fs.writeFileSync(path.join(OUT, 'placa-bom.csv'), pl.bomCSV());
  fs.writeFileSync(path.join(OUT, 'placa-posiciones.csv'), pl.posicionesCSV());

  // 3. huellas propias
  const hp = pl.huellasPropias();
  for (const [nombre, h] of Object.entries(hp)) fs.writeFileSync(path.join(OUT, 'forja_lab.pretty', `${nombre}.kicad_mod`), pl.kicadMod(nombre, h));

  // 4. el armado (D3)
  fs.writeFileSync(path.join(OUT, 'armado.txt'), pl.armadoTexto());

  // 5. la revisión (texto plano, para el reporte)
  const h = pl.revisarPlaca();
  const k = pl.cuentaPlaca();
  const L = [];
  L.push(`LA PLACA DE LA PLUMA · revisión (${new Date().toISOString().slice(0, 10)})`);
  L.push(`piezas ${k.piezas} (SMD ${k.smd}, ${k.smdAbajo} abajo) · islas ${k.islas} · barrenos ${k.barrenos} · juntas ${k.juntas} · conectores ${k.conectores} · PCB ${k.pcbs} (en L) · fuera de la placa ${k.fueraDeLaPlaca}`);
  L.push(`banco v3: ${k.v3.modeladas} piezas dibujadas + ${k.v3.pasivosOcultos} pasivos que sus chips piden = ${k.v3.total} · ${k.v3.conectores} conectores/bornes · ${k.v3.pcbs} PCB`);
  L.push(`errores ${h.filter((x) => x.nivel === 'error').length} · avisos ${h.filter((x) => x.nivel === 'aviso').length}`);
  for (const x of h) L.push(`  ${x.nivel} ${x.regla} ${x.donde}: ${x.texto}`);
  L.push('térmica (peor caso):');
  for (const t of pl.termicaPlaca()) L.push(`  ${t.pieza}: ${t.P.toFixed(1)} W → ${t.T.toFixed(0)} °C (${t.estado})${t.nota ? ' · ' + t.nota : ''}`);
  L.push(`disipador: ${pl.LC_DISIPADOR} de ${pl.DISIPADOR.largo} mm en el chorro del difusor → θSA ${pl.THETA.hsVent.toFixed(3)} K/W (sin difusor ${pl.thetaDisipador(pl.largoEnChorro(false, { y0: -77.75, y1: 47 })).toFixed(3)})`);
  const m = pl.MOTOR, Im = pl.corrienteTMC2209(m.irun, m.vsense);
  L.push(`motor (K07, ${m.VM} V): vsense ${m.vsense} · IRUN ${m.irun} → ${Im.toFixed(3)} A rms · IHOLD ${m.ihold} → ${pl.corrienteTMC2209(m.ihold, m.vsense).toFixed(3)} A · máximo físico ${pl.corrienteTMC2209(31, m.vsense).toFixed(3)} A (tope ${pl.I_MOTOR_TOPE}) · VREF de respaldo ${m.vrefRespaldo} V`);
  const sd = pl.sdLlegaAGnd();
  L.push(`cadena SD: ${sd.camino.join(' · ')}`);
  for (const e of pl.CADENA_SD.filter((x) => !x.micro)) L.push(`  abre ${e.que} → SD ${pl.sdLlegaAGnd(pl.PLACA, e.id).llega ? 'SIGUE en GND (MAL)' : 'sube por R8: el arco se apaga sin el micro'}`);
  L.push('subidas de cable a los puertos:');
  for (const is of pl.ISLAS) { const s = pl.subidaAlPuerto(is); if (s) L.push(`  ${s.texto}`); }
  fs.writeFileSync(path.join(OUT, 'placa-revision.txt'), L.join('\n') + '\n');

  console.log(`placa.net: ${leida.componentes.length} huellas, ${leida.redes.length} redes (leída de regreso: igual)`);
  console.log(`placa-bom.csv: ${pl.listaMateriales().length} renglones · placa-posiciones.csv · armado.txt (${pl.armado().length} pasos) · ${Object.keys(hp).length} huellas en forja_lab.pretty/`);
  console.log(`revisor: ${h.filter((x) => x.nivel === 'error').length} errores, ${h.filter((x) => x.nivel === 'aviso').length} avisos → ${OUT}`);
  if (h.some((x) => x.nivel === 'error')) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
