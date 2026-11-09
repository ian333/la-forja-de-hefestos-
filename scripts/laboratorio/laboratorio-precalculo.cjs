#!/usr/bin/env node
/**
 * EL LABORATORIO · PRECÁLCULO (órdenes 2026-11-05-laboratorio-contrato y 2026-11-06-laboratorio-ronda2, integración)
 * ==================================================================================
 * Los tres generadores (cuerpo.ts del agente B, placa.ts de C, alambre.ts de A) son física pura: el ruteo A* de los
 * canales tarda minutos y no cabe en el navegador. Se corren UNA vez aquí y el estudio solo lee el resultado:
 *   public/modelos/laboratorio/laboratorio.json = { piezas, jueces, numeros, generado, ronda, cambios, decisiones }
 *     · piezas: PiezaLab[] de los tres (la misma forma que RefPart del estudio)
 *     · jueces: los hallazgos de juzgarCuerpo / revisarPlaca / juzgarAlambre (lo que el laboratorio dice de sí mismo)
 *     · numeros: los números que se muestran en el tablero del laboratorio
 *
 *   cd /home/ian/forja-diag && node --import tsx scripts/laboratorio/laboratorio-precalculo.cjs [salida.json]
 */
const { writeFileSync, mkdirSync } = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'salidas-lab', 'laboratorio.json'));

(async () => {
  const t = async (n, f) => { const t0 = Date.now(); const r = await f(); console.log(`${n.padEnd(16)} ${String(Date.now() - t0).padStart(7)} ms`); return r; };
  const cuerpo = await import(path.join(ROOT, 'src', 'forja', 'lab', 'cuerpo.ts'));
  const placa = await import(path.join(ROOT, 'src', 'forja', 'lab', 'placa.ts'));
  const alambre = await import(path.join(ROOT, 'src', 'forja', 'lab', 'alambre.ts'));
  const contrato = await import(path.join(ROOT, 'src', 'forja', 'lab', 'laboratorio-contrato.ts'));

  const dc = await t('disenarCuerpo', () => cuerpo.disenarCuerpo());
  const hc = await t('juzgarCuerpo', () => cuerpo.juzgarCuerpo(dc));
  const pc = await t('piezasCuerpo', () => cuerpo.piezasCuerpo(dc));
  const hp = await t('revisarPlaca', () => placa.revisarPlaca());
  const pp = await t('piezasPlaca', () => placa.piezasPlaca());
  const da = await t('disenarAlambre', () => alambre.disenarAlambre(alambre.REQ_ALAMBRE));
  const ha = await t('juzgarAlambre', () => alambre.juzgarAlambre(da));
  const pa = await t('piezasAlambre', () => alambre.piezasAlambre(da));

  const hojas = (ps) => ps.reduce((s, p) => s + (p.kind === 'grupo' ? hojas(p.hijos || []) : 1), 0);
  const cuenta = (h) => ({ errores: h.filter((x) => x.nivel === 'error').length, avisos: h.filter((x) => x.nivel !== 'error').length });
  const jueces = {
    cuerpo: { ...cuenta(hc), hallazgos: hc },
    placa: { ...cuenta(hp), hallazgos: hp },
    alambre: { ...cuenta(ha), hallazgos: ha },
  };
  const doc = {
    generado: new Date().toISOString(),
    ronda: contrato.CONTRATO_RONDA ?? 1,
    cambios: contrato.CAMBIOS_R2 ?? [],
    decisiones: (contrato.DECISIONES ?? []).map(({ id, tema, decision, porque }) => ({ id, tema, decision, porque })),
    piezas: [
      { id: 'lab-cuerpo', name: 'Cuerpo impreso · tejas + canales (agente B)', kind: 'grupo', x: 0, y: 0, z: 0, color: '#e8a33d', hijos: pc },
      { id: 'lab-placa', name: 'Placa soldada · La Pluma + RP2350B (agente C)', kind: 'grupo', x: 0, y: 0, z: 0, color: '#1d4d2c', hijos: pp },
      { id: 'lab-alambre', name: 'Módulo del alambre · NEMA directo + carrete (agente A)', kind: 'grupo', x: 0, y: 0, z: 0, color: '#23272e', hijos: pa },
    ],
    jueces,
    numeros: { hojas: { cuerpo: hojas(pc), placa: hojas(pp), alambre: hojas(pa) } },
  };
  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(doc));
  console.log(`→ ${OUT} · ${(JSON.stringify(doc).length / 1024).toFixed(0)} KB · hojas ${JSON.stringify(doc.numeros.hojas)}`);
  for (const [k, j] of Object.entries(jueces)) console.log(`  juez ${k}: ${j.errores} errores, ${j.avisos} avisos`);
})().catch((e) => { console.error('FALLO', e); process.exit(1); });
