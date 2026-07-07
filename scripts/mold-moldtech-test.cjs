// TEST selector de tecnología de molde (Kazmer §13.9) — verifica que la lógica
// de decisión reproduce los CRITERIOS del libro (cap 13 descriptivo). Puro.
(async () => {
  const path = require('path');
  const mt = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'moldtech.ts'));
  const checks = {};

  // §13.9.1: undercut externo (bolos) → split cavity
  const a = mt.chooseMoldTechnology({ externalUndercut: true });
  console.log('undercut externo →', a.tech, a.seccion);
  checks.splitCavity = a.tech === 'split-cavity' && a.seccion === '§13.9.1';

  // §13.9.4: superficie 100% estética → reverse ejection (con cilindros hidráulicos)
  const b = mt.chooseMoldTechnology({ fullyAestheticSurface: true });
  console.log('estética total →', b.tech, b.seccion);
  checks.reverseEject = b.tech === 'reverse-ejection' && b.seccion === '§13.9.4';
  checks.reverseNota = b.notas.some((n) => n.includes('hidráulicos'));

  // §13.9.3: rosca interna → unscrewing (núcleo rotatorio)
  checks.unscrew = mt.chooseMoldTechnology({ internalThread: true }).tech === 'unscrewing';
  // §13.9.2: undercut interno colapsable → collapsible core
  checks.collapsible = mt.chooseMoldTechnology({ internalCollapsible: true }).tech === 'collapsible-core';
  // §11.3.6-7: undercut lateral simple → side action
  checks.sideAction = mt.chooseMoldTechnology({ sideUndercut: true }).tech === 'side-action';
  // sin undercuts → estándar
  checks.estandar = mt.chooseMoldTechnology({}).tech === 'estandar';

  // prioridad: la superficie estética total manda sobre el undercut externo
  const c = mt.chooseMoldTechnology({ fullyAestheticSurface: true, externalUndercut: true });
  checks.esteticaManda = c.tech === 'reverse-ejection';

  const pass = Object.values(checks).every(Boolean);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass, checks }));
  process.exit(pass ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 300)); process.exit(1); });
