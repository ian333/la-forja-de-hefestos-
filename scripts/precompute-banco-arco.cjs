#!/usr/bin/env node
/**
 * PRECOMPUTE BANCO DEL ARCO — las PIEZAS DE REFERENCIA se teselan UNA vez, aquí, con el kernel.
 * =============================================================================================
 * Orden 2026-11-04-banco-arco-ensamble. Medido con scripts/forja-multicuerpo-diag.cjs: el STEP de la
 * LRS-1200 dentro del rebuild costaba ~33 s POR REBUILD (leer 6–9 s, malla 4 s, topología 4.5 s,
 * caras+aristas 6.5 s, exportar STEP 2.8 s…), y todo se repetía aunque la fuente no cambiara.
 * Una pieza de fabricante no se diseña aquí: se convierte a malla una vez, y el estudio la dibuja
 * sin tocar el kernel (RefPart kind 'malla' en ForgeBRepStudio.tsx).
 *
 * Formato FMSH (little-endian):
 *   Uint32[4] = ['FMSH' (0x48534D46), versión 1, nVértices, nÍndices]
 *   Float32[3·nV] posiciones (mm, marco del STEP) · Float32[3·nV] normales · Uint32[nI] índices
 *
 *   node --import tsx scripts/precompute-banco-arco.cjs [carpeta_salida] [raíz_forja]
 *   (default: public/modelos/banco-arco/ y la raíz de este repo)
 */
const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const path = require('path');

const ROOT = process.argv[3] || path.resolve(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'public', 'modelos', 'banco-arco');
const SRC = path.join(ROOT, 'models', 'step', 'banco-arco');

// [STEP de origen, malla de salida, deflexión lineal mm, angular rad] — la deflexión se elige por
// tamaño: la fuente es grande (0.4 mm basta a la vista), el TO-220 es chico (0.08 mm).
const PIEZAS = [
  ['LRS-1200-3D.stp', 'lrs-1200.bin', 0.4, 0.35],
  ['Heatsink_125x35x50mm_3xFixationM3.step', 'disipador-125.bin', 0.2, 0.3],
  ['TO-220-3_Vertical.step', 'to220.bin', 0.08, 0.3],
  ['CP_Radial_D35.0mm_P10.00mm_SnapIn.step', 'cap-35.bin', 0.15, 0.25],
  ['rpi_pico2.step', 'pico2.bin', 0.35, 1.0],
  ['C_Rect_L31.5mm_W13.0mm_P27.50mm_MKS4.step', 'pelicula-mks4.bin', 0.1, 0.3],
  ['Fuseholder_Cylinder-6.3x32mm_Schurter_0031-8002_Horizontal_Open.step', 'portafusible.bin', 0.1, 0.3],
];

const distDir = path.join(ROOT, 'node_modules', 'opencascade.js', 'dist');
const cjsGlue = path.join(distDir, 'opencascade.wasm.cjs');
if (!existsSync(cjsGlue)) {
  let s = readFileSync(path.join(distDir, 'opencascade.wasm.js'), 'utf8');
  s = s.replace(/export default opencascade;\s*$/, '') + '\nmodule.exports = opencascade;\n';
  writeFileSync(cjsGlue, s);
}
const factory = require(cjsGlue);

(async () => {
  const occt = await import(path.join(ROOT, 'src', 'forja', 'brep', 'occt.ts'));
  const oc = await factory({ wasmBinary: readFileSync(path.join(distDir, 'opencascade.wasm.wasm')), locateFile: (p) => path.join(distDir, p) });
  occt._setActiveOCCT(oc);
  mkdirSync(OUT, { recursive: true });
  for (const [src, out, lin, ang] of PIEZAS) {
    const t0 = Date.now();
    const sh = occt.importSTEP(oc, readFileSync(path.join(SRC, src)));
    const m = occt.tessellate(oc, sh, lin, ang);
    sh.delete?.();
    const nv = m.positions.length / 3, ni = m.indices.length;
    const buf = Buffer.alloc(16 + nv * 12 * 2 + ni * 4);
    buf.writeUInt32LE(0x48534d46, 0); buf.writeUInt32LE(1, 4); buf.writeUInt32LE(nv, 8); buf.writeUInt32LE(ni, 12);
    Buffer.from(m.positions.buffer, m.positions.byteOffset, m.positions.byteLength).copy(buf, 16);
    Buffer.from(m.normals.buffer, m.normals.byteOffset, m.normals.byteLength).copy(buf, 16 + nv * 12);
    Buffer.from(m.indices.buffer, m.indices.byteOffset, m.indices.byteLength).copy(buf, 16 + nv * 24);
    writeFileSync(path.join(OUT, out), buf);
    let mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < m.positions.length; i += 3) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], m.positions[i + k]); mx[k] = Math.max(mx[k], m.positions[i + k]); }
    console.log(`${out.padEnd(20)} ${String(ni / 3).padStart(7)} tris  ${(buf.length / 1e6).toFixed(2)} MB  caja ${mx.map((v, k) => (v - mn[k]).toFixed(1)).join(' × ')} mm  min(${mn.map((v) => v.toFixed(1)).join(', ')})  ${Date.now() - t0} ms`);
  }
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
