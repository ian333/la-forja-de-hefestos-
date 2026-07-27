/**
 * AUDITOR DE MOLDES — el cazador de errores que el OJO no ve. Construye el molde y
 * corre una batería de checks GEOMÉTRICOS EXACTOS sobre los bounding boxes reales de
 * cada componente + las relaciones que exige un molde de inyección (Kazmer). Cada
 * hallazgo trae NÚMEROS y una "cámara sugerida" (qué aislar + qué vista) para VERLO.
 *
 * Filosofía (feedback user 2026-07-14, "aún no cazas los errores, hay muchos"):
 * NO confiar en el ojo sobre un ISO a baja resolución — MEDIR. Los checks están
 * sesgados a MARCAR (adversarial): mejor un falso positivo que un molde con un pin
 * que no llega o agua que se sale por la cara.
 */
import type { MoldPart } from './mold-plano-set';
import type { MoldAssemblySpec } from './mold-assembly';
import { plateStackZ } from './mold-plano-set';
import { plateDepth, plateDefs, coolingCircuit, standardHoles, cavityGrid, cavityFootprint } from './mold-drawing-set';
import { coordAudit } from './mold-coords';
import { moldBoltSizing } from './mold-drawing-set';
import { resolveThread, threadSurfaceMesh, threadRealnessMm, threadsMate, parseThread, threadDims } from './mold-threads';

export type Severity = 'CRÍTICO' | 'ADVERTENCIA' | 'INFO';
export interface Finding {
  sev: Severity;
  check: string;
  role: string;
  detail: string;
  /** cómo VERLO: componentes a aislar + vista + rayos X */
  camera?: { isolate: string[]; view: 'ISO' | 'SUP' | 'FRE' | 'DER'; xray?: boolean };
}

const SEV_RANK: Record<Severity, number> = { 'CRÍTICO': 0, 'ADVERTENCIA': 1, 'INFO': 2 };

function bbox(pos: Float32Array | number[]) {
  const mn = [1e18, 1e18, 1e18], mx = [-1e18, -1e18, -1e18];
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) {
    const v = pos[i + k]; if (v < mn[k]) mn[k] = v; if (v > mx[k]) mx[k] = v;
  }
  return { mn, mx, cx: (mn[0] + mx[0]) / 2, cy: (mn[1] + mx[1]) / 2 };
}

export function auditMold(parts: MoldPart[], spec: MoldAssemblySpec): Finding[] {
  const F: Finding[] = [];
  const z = plateStackZ(spec);
  const D = plateDepth(spec), W = spec.widthMm;
  const defs = plateDefs(spec);
  const thick = (r: string) => defs.find((d) => d.role === r)?.thick ?? 20;
  const zPart = z.A;
  const zTop = z.clamp + thick('clamp');
  const by = (r: string) => parts.filter((p) => p.role === r || p.role.startsWith(r + '-'));
  const TOL = 1.0;   // holgura de tolerancia (mm) — bordes coplanares no cuentan

  // ── 1) CONTENCIÓN LATERAL: nada funcional debe asomarse fuera de la placa
  //     [0..W]×[0..D]. Excepciones: orejas de clamp/bottom, platinas de máquina,
  //     el actuador del mecanismo (cilindro/perno fuera), el anillo (⌀ propio). ──
  const LATERAL_EXEMPT = new Set(['clamp', 'bottom', 'platina-fija', 'platina-movil']);
  for (const p of parts) {
    if (LATERAL_EXEMPT.has(p.role) || p.role.endsWith('-fijo') || p.role.startsWith('mecanismo')) continue;
    const b = bbox(p.positions);
    const outX = Math.max(0 - b.mn[0], b.mx[0] - W);
    const outY = Math.max(0 - b.mn[1], b.mx[1] - D);
    if (outX > TOL || outY > TOL) {
      F.push({
        sev: 'CRÍTICO', check: 'contención-lateral', role: p.role,
        detail: `se asoma ${Math.max(outX, outY).toFixed(1)} mm fuera de la placa ${W}×${D} (x[${b.mn[0].toFixed(0)}..${b.mx[0].toFixed(0)}] y[${b.mn[1].toFixed(0)}..${b.mx[1].toFixed(0)}])`,
        camera: { isolate: [p.role], view: 'SUP', xray: false },
      });
    }
  }

  // ── 2) CONTENCIÓN VERTICAL: nada se asoma por arriba del clamp ni por abajo del
  //     bottom (excepto anillo centrador que sobresale por diseño, y platinas). ──
  const VERT_EXEMPT = new Set(['anillo', 'platina-fija', 'platina-movil']);
  for (const p of parts) {
    if (VERT_EXEMPT.has(p.role)) continue;
    const b = bbox(p.positions);
    const outTop = b.mx[2] - zTop, outBot = 0 - b.mn[2];
    if (outTop > TOL || outBot > TOL) {
      F.push({
        sev: 'CRÍTICO', check: 'contención-vertical', role: p.role,
        detail: `se asoma ${Math.max(outTop, outBot).toFixed(1)} mm ${outTop > outBot ? 'por ARRIBA del clamp' : 'por ABAJO del bottom'} (z[${b.mn[2].toFixed(0)}..${b.mx[2].toFixed(0)}], molde [0..${zTop}])`,
        camera: { isolate: [p.role, 'clamp', 'bottom'], view: 'FRE', xray: true },
      });
    }
  }

  // ── 3) AGUA EN SU PLACA: agua-a dentro de A y sobre la impresión; agua-b dentro
  //     de B y bajo la partición. Fuera = perfora una cara o entra a la cavidad. ──
  const tA = thick('A'), tB = thick('B');
  for (const [role, lo, hi, plate] of [
    ['agua-a', zPart, z.A + tA, 'A'], ['agua-b', z.B, zPart, 'B'],
  ] as const) {
    for (const p of by(role)) {
      const b = bbox(p.positions);
      if (b.mn[2] < lo - TOL || b.mx[2] > hi + TOL) {
        F.push({
          sev: 'CRÍTICO', check: 'agua-fuera-de-placa', role,
          detail: `z[${b.mn[2].toFixed(0)}..${b.mx[2].toFixed(0)}] sale de la placa ${plate} [${lo.toFixed(0)}..${hi.toFixed(0)}]`,
          camera: { isolate: [role, plate], view: 'FRE', xray: true },
        });
      }
    }
  }

  // ── 4) ALCANCE DE PINES: los expulsores deben llegar a la PARTICIÓN (empujan la
  //     pieza) y arrancar del housing. Un pin corto no expulsa. ──
  for (const p of by('pines')) {
    const b = bbox(p.positions);
    if (b.mx[2] < zPart - TOL) {
      F.push({
        sev: 'CRÍTICO', check: 'pin-no-alcanza', role: 'pines',
        detail: `los pines llegan a z=${b.mx[2].toFixed(0)} pero la partición está en ${zPart} (faltan ${(zPart - b.mx[2]).toFixed(0)} mm)`,
        camera: { isolate: ['pines', 'pieza'], view: 'FRE', xray: true },
      });
    }
  }

  // ── 5) PIEZA EN LA PARTICIÓN + CENTRADA: la pieza cruza zPart y cada copia está
  //     centrada en su cavidad (offset > 3 mm = desalineada). ──
  {
    const pz = by('pieza')[0];
    if (pz) {
      const b = bbox(pz.positions);
      if (b.mn[2] > zPart + TOL || b.mx[2] < zPart - TOL) {
        F.push({ sev: 'CRÍTICO', check: 'pieza-fuera-particion', role: 'pieza',
          detail: `la pieza z[${b.mn[2].toFixed(0)}..${b.mx[2].toFixed(0)}] no cruza la partición ${zPart}`,
          camera: { isolate: ['pieza', 'inserto-core'], view: 'FRE', xray: true } });
      }
      const cells = cavityGrid(spec, D);
      const near = cells.reduce((a, c) => (Math.hypot(c.cx - b.cx, c.cy - b.cy) < Math.hypot(a.cx - b.cx, a.cy - b.cy) ? c : a), cells[0]);
      const off = Math.hypot(near.cx - b.cx, near.cy - b.cy);
      if (off > 3 && (spec.nCav ?? 1) === 1) {
        F.push({ sev: 'ADVERTENCIA', check: 'pieza-descentrada', role: 'pieza',
          detail: `centro de la pieza (${b.cx.toFixed(0)},${b.cy.toFixed(0)}) a ${off.toFixed(0)} mm del centro de cavidad (${near.cx},${near.cy})`,
          camera: { isolate: ['pieza', 'inserto-cav'], view: 'SUP' } });
      }
    }
  }

  // ── 6) INSERTO EN SU ASIENTO: el bloque tallado debe caber en el asiento ifx×ify
  //     que buildPlateSolid corta (con juego). Más grande = interpenetra la placa. ──
  {
    const cav = by('inserto-cav')[0];
    if (cav) {
      const b = bbox(cav.positions);
      const w = b.mx[0] - b.mn[0], d = b.mx[1] - b.mn[1];
      if (w > W - 4 || d > D - 4) {
        F.push({ sev: 'ADVERTENCIA', check: 'inserto-casi-toda-la-placa', role: 'inserto-cav',
          detail: `el inserto mide ${w.toFixed(0)}×${d.toFixed(0)} en una placa de ${W}×${D} — casi no queda acero de placa (borde excesivo)`,
          camera: { isolate: ['inserto-cav', 'A'], view: 'SUP', xray: true } });
      }
    }
  }

  // ── 7) HOLGURAS ANALÍTICAS (exactas, de los datos paramétricos) — agua vs cada
  //     barreno; el ojo NUNCA ve un tubo pasar a 1 mm de un pin dentro del acero. ──
  {
    const cc = coolingCircuit(spec, D);
    const lines = cc.segs.filter((g) => g.y0 === g.y1);
    let worst = 1e9, wi = '';
    for (const role of ['A', 'B'] as const) for (const h of standardHoles(spec, role)) {
      for (const g of lines) {
        if (h.x < Math.min(g.x0, g.x1) - h.dia / 2 || h.x > Math.max(g.x0, g.x1) + h.dia / 2) continue;
        const d = Math.abs(g.y0 - h.y) - cc.diaMm / 2 - h.dia / 2;
        if (d < worst) { worst = d; wi = `${h.type}@(${h.x},${h.y}) vs canal y=${g.y0}`; }
      }
    }
    if (worst < 2.5) {
      F.push({ sev: 'CRÍTICO', check: 'agua-choca-barreno', role: 'agua-b',
        detail: `holgura ${worst.toFixed(1)} mm (${wi}) — el canal casi perfora un barreno`,
        camera: { isolate: ['agua-a', 'agua-b', 'pines'], view: 'SUP', xray: true } });
    } else if (worst < 5) {
      F.push({ sev: 'ADVERTENCIA', check: 'agua-cerca-barreno', role: 'agua-b',
        detail: `holgura ${worst.toFixed(1)} mm (${wi}) — apretado`, camera: { isolate: ['agua-a', 'agua-b', 'pines'], view: 'SUP', xray: true } });
    }
  }

  // ── 8) COBERTURA MULTI-CAVIDAD: con nCav>1, pines y agua deben cubrir TODAS las
  //     cavidades, no solo la #1. Se mide el spread vs el spread de las cavidades. ──
  if ((spec.nCav ?? 1) > 1) {
    const cells = cavityGrid(spec, D);
    const cellSpreadX = Math.max(...cells.map((c) => c.cx)) - Math.min(...cells.map((c) => c.cx));
    for (const role of ['pines', 'agua-a'] as const) {
      const p = by(role)[0]; if (!p) continue;
      const b = bbox(p.positions);
      if (cellSpreadX > 20 && (b.mx[0] - b.mn[0]) < cellSpreadX * 0.6) {
        F.push({ sev: 'CRÍTICO', check: 'multicav-incompleto', role,
          detail: `${role} cubre ${(b.mx[0] - b.mn[0]).toFixed(0)} mm en X pero las cavidades se extienden ${cellSpreadX.toFixed(0)} mm — no cubre todas`,
          camera: { isolate: [role], view: 'SUP', xray: true } });
      }
    }
  }

  // ── 8b) POSTES GUÍA CRUZAN LA PARTICIÓN: alinean A con B, así que deben abarcar
  //     ambos lados. Si no cruzan zPart, no alinean las mitades (Fig 1.5). ──
  {
    const g = by('guias')[0];
    if (g) {
      const b = bbox(g.positions);
      if (b.mn[2] > zPart - 5 || b.mx[2] < zPart + 5) {
        F.push({ sev: 'CRÍTICO', check: 'guias-no-cruzan-particion', role: 'guias',
          detail: `postes z[${b.mn[2].toFixed(0)}..${b.mx[2].toFixed(0)}] no abarcan bien la partición ${zPart} — no alinean A/B`,
          camera: { isolate: ['guias', 'bujes'], view: 'FRE', xray: true } });
      }
    }
  }

  // ── 8c) INSERTOS FLANQUEAN LA PARTICIÓN: cavidad en A (sobre zPart), núcleo en B
  //     (bajo zPart, con boss que sube a la pieza). Si se cruzan mal, interpenetran. ──
  {
    const cav = by('inserto-cav')[0], core = by('inserto-core')[0];
    if (cav) { const b = bbox(cav.positions);
      if (b.mn[2] < zPart - 3) F.push({ sev: 'CRÍTICO', check: 'inserto-cav-cruza-particion', role: 'inserto-cav',
        detail: `el inserto de CAVIDAD baja a z=${b.mn[2].toFixed(0)} (partición ${zPart}) — invade el lado B`,
        camera: { isolate: ['inserto-cav', 'inserto-core'], view: 'FRE', xray: true } }); }
    if (core) { const b = bbox(core.positions);
      if (b.mx[2] > zPart + (spec.cavity.depthMm ?? 10) + 3) F.push({ sev: 'ADVERTENCIA', check: 'inserto-core-sube-mucho', role: 'inserto-core',
        detail: `el núcleo sube a z=${b.mx[2].toFixed(0)}, más de la profundidad de pieza sobre ${zPart}`,
        camera: { isolate: ['inserto-core', 'pieza'], view: 'FRE', xray: true } }); }
  }

  // ── 9) COLADA CONECTA: el bebedero/colada debe ir de la partición al tope (recibe
  //     la boquilla). Si no llega a zPart, no alimenta; si no llega al tope, no acopla. ──
  {
    const col = by('colada')[0];
    if (col) {
      const b = bbox(col.positions);
      if (b.mn[2] > zPart + 2) F.push({ sev: 'CRÍTICO', check: 'colada-no-alimenta', role: 'colada',
        detail: `la colada arranca en z=${b.mn[2].toFixed(0)}, no llega a la partición ${zPart}`,
        camera: { isolate: ['colada', 'pieza'], view: 'FRE', xray: true } });
    }
  }

  // ── 9b) LA CUERDA (crítico): sin rosca REAL no se unen las placas, y la del
  //     tornillo debe ACOPLAR con la del barreno roscado (mismo Ø/paso/sentido).
  //     Un molde con tornillos LISOS (sin hilo) es INARMABLE — CRÍTICO. ──
  {
    const tor = by('tornillos');
    const hasScrewHoles = feats => feats;   // los barrenos de tornillo existen siempre
    if (!tor.length) {
      F.push({ sev: 'CRÍTICO', check: 'sin-tornillos', role: 'tornillos',
        detail: 'no hay tornillos ensamblados — las placas no se pueden unir (molde inarmable)' });
    } else {
      const t = tor[0];
      const trisPerBolt = (t.indices.length / 3) / Math.max(1, t.bodies ?? 1);
      const bolt = moldBoltSizing(spec);
      const spc = resolveThread(bolt.dMm);
      const { h } = threadDims(spc.major, spc.pitch);
      const realVar = threadRealnessMm(threadSurfaceMesh(spc, 30));   // guarda regresión del módulo
      if (trisPerBolt < 200 || realVar < h * 0.5) {
        F.push({ sev: 'CRÍTICO', check: 'cuerda-no-real', role: 'tornillos',
          detail: `la cuerda no es REAL (${trisPerBolt | 0} △/tornillo · variación ${realVar} mm vs h ${h.toFixed(2)}) — barra lisa no une las placas`,
          camera: { isolate: ['tornillos'], view: 'FRE' } });
      }
      // ACOPLAMIENTO tornillo ↔ barreno roscado de la placa (el "¿puedo unir?")
      const holeDesig = (standardHoles(spec, 'A').find((hh) => /tornillo/.test(hh.type))?.type.match(/M\d+(?:×[\d.]+)?/) || [])[0];
      const holeSpec = holeDesig ? parseThread(holeDesig) : null;
      if (holeSpec && !threadsMate(spc, holeSpec)) {
        F.push({ sev: 'CRÍTICO', check: 'rosca-no-acopla', role: 'tornillos',
          detail: `la rosca del tornillo (${spc.desig}) NO acopla con el barreno (${holeSpec.desig}) — no se unen las mitades` });
      }
    }
  }

  // ── 10) ANÁLISIS POR COORDENADAS (barrenos vistos desde su XYZ): tornillos que
  //     cruzan la partición, KO colineal con la colada, reparto de carga §12.4. ──
  try {
    for (const cf of coordAudit(spec).findings) {
      F.push({ sev: cf.sev, check: cf.check, role: 'barrenos', detail: cf.detail,
        camera: { isolate: ['clamp', 'A', 'B', 'support', 'bottom'], view: 'FRE', xray: true } });
    }
  } catch { /* coords opcional */ }

  F.sort((a, b) => SEV_RANK[a.sev] - SEV_RANK[b.sev]);
  return F;
}
