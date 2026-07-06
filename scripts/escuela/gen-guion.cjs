/**
 * Escuela — genera el guion de voz (scripts/guiones/<id>.txt, una frase por
 * línea = un WAV por paso) DESDE la lección JSON. La lección es la única
 * fuente de verdad: el guion nunca se edita a mano.
 *
 *   node scripts/escuela/gen-guion.cjs src/escuela/mecanica/lecciones/mec-u1-l1.json
 *   → scripts/guiones/mec-u1-l1.txt   (luego: /home/ian/tts-venv/bin/python
 *     scripts/narracion-gen.py mec-u1-l1   en iangpu)
 */
const fs = require('fs');
const path = require('path');
const lecPath = process.argv[2];
if (!lecPath) { console.error('uso: gen-guion.cjs <leccion.json>'); process.exit(1); }
const lec = JSON.parse(fs.readFileSync(lecPath, 'utf8'));
const out = path.join(__dirname, '..', 'guiones', `${lec.id}.txt`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lec.pasos.map((p) => p.dice.trim()).join('\n') + '\n');
console.log(`${out}  (${lec.pasos.length} frases)`);
