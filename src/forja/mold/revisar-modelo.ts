/**
 * REVISAR MODELO — la LLAMADA ÚNICA: malla o spec → expediente completo.
 * ============================================================================
 * El modo "REVISAR EN VOLUMEN" del pliego (N-29) es `[modelos].map(revisarModelo)`.
 * Antes de esta función, el cableo completo era un ritual manual de 7 pasos que
 * solo vivía en la cabeza (y en los scripts): dfm → spec → moldMachine → ensamble
 * → medirEnsamble → campo de flujo → enumerarVenteos → contratos. Cada consumidor
 * que lo re-cableara distinto reencarnaría EL bug de contabilidad que nos mordió
 * tres veces: el dato bien calculado que no llega al juez (§9.1.6 puertos, §9.2.7
 * regex, área proyectada tirada).
 *
 * Aquí vive UNA VEZ. La UI es piel sobre esta función, no dueña del orden.
 *
 * Honestidad por diseño: con spec numérico (sin malla) los criterios que piden
 * raster o campo de flujo quedan SIN-CABLEAR — que es la verdad, no un fallo.
 * PURO → node-testeable; sin reloj (la fecha la pone quien firma el expediente).
 */
import { dfmFromMesh, type DfmMeshReport } from './dfm-mesh';
import { solidFromMesh, defaultGate, type MeshLike } from './flowlen-mesh';
import { measureFlowLength, type FlowField } from './flowlen';
import { enumerarVenteos, type PlanVenteo } from './venting-locations';
import { gripEjectorLayout } from './eject-layout';
import { moldMachine, type MachineSpec, type MoldPackage } from './moldmachine';
import { contratos, medirEnsamble, type ContratoReporte, type EnsambleMedido } from './mold-contratos';
import { coordAudit, type CoordFinding } from './mold-coords';
import { packageToAssemblySpec } from './mold-plano-set';
import { decisionesDelPaquete, type Expediente } from './expediente';

/** volumen (mm³) y área (mm²) de una malla cerrada — teorema de divergencia. */
export function meshVolumeArea(mesh: MeshLike): { volumeMm3: number; areaMm2: number } {
  const P = mesh.positions, I = mesh.indices;
  let vol6 = 0, area2 = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    const ax = P[a], ay = P[a + 1], az = P[a + 2];
    const bx = P[b], by = P[b + 1], bz = P[b + 2];
    const cx = P[c], cy = P[c + 1], cz = P[c + 2];
    vol6 += ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx);
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    area2 += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
  }
  return { volumeMm3: Math.abs(vol6) / 6, areaMm2: area2 / 2 };
}

/**
 * Malla → campo de flujo (§5.5.5), con la celda acotada a ~250k vóxeles para que
 * el Dijkstra de flowlen no se arrastre. La resolución NO se esconde: si la celda
 * no resuelve la pared, `field.warnings` lo dice (flowlen ya lo verifica).
 */
export function flowFieldFromMesh(mesh: MeshLike, o?: {
  gateMm?: { x: number; y: number; z: number };
  wallMm?: number; expectVolumeMm3?: number; maxVoxels?: number;
}): FlowField {
  const q = solidFromMesh(mesh);
  const gate = o?.gateMm ?? defaultGate(q);
  const b = q.bbox;
  const bboxVol = Math.max(1, (b.x1 - b.x0) * (b.y1 - b.y0) * (b.z1 - b.z0));
  const cell = Math.max(0.8, Math.cbrt(bboxVol / (o?.maxVoxels ?? 250_000)));
  return measureFlowLength({
    x0: b.x0 - cell, y0: b.y0 - cell, z0: b.z0 - cell,
    x1: b.x1 + cell, y1: b.y1 + cell, z1: b.z1 + cell,
    cellMm: cell, gateMm: gate,
    inCavity: (x, y, z) => q.inside(x, y, z),
    wallMm: o?.wallMm, expectVolumeMm3: o?.expectVolumeMm3,
  });
}

export interface RevisionInput {
  /** camino A: el spec numérico ya armado */
  spec?: MachineSpec;
  /** camino B: la malla de la pieza (mm) + lo mínimo que el cliente declara */
  mesh?: MeshLike;
  nombre?: string;
  /** overrides del camino B (lo no dado se DERIVA de la malla o cae a default DECLARADO) */
  wallMm?: number; plastic?: string; annualVolume?: number; totalVolume?: number;
  cavityShape?: 'rect' | 'round';
  /** tope de vóxeles del campo de flujo (default 250k; la UI usa menos para no trabarse) */
  flowMaxVoxels?: number;
}

export interface FilaRevision {
  nombre: string; score: number;
  cumple: number; advierte: number; viola: number; sinCablear: number; sinModulo: number;
  congelables: number; criticos: number; pendientes: number;
}

export interface RevisionModelo {
  nombre: string;
  spec: MachineSpec;
  pkg: MoldPackage;
  ens: EnsambleMedido;
  contratos: ContratoReporte;
  expediente: Expediente;
  dfm?: DfmMeshReport;
  campo?: { nVoxeles: number; cellMm: number; maxFlowLenMm: number; unreachable: number; warnings: string[] };
  planVenteo?: PlanVenteo;
  criticos: CoordFinding[];
  /** la fila del modo REVISAR EN VOLUMEN (N-29): una por modelo, tabla directa */
  fila: FilaRevision;
  /** supuestos y derivaciones DECLARADOS (nada en silencio) */
  notas: string[];
}

export function revisarModelo(input: RevisionInput): RevisionModelo {
  const notas: string[] = [];
  let dfm: DfmMeshReport | undefined;
  let spec: MachineSpec;

  // ── 1) EL SPEC: dado, o derivado de la malla con supuestos declarados ──
  if (input.spec) {
    spec = { ...input.spec };
    if (input.mesh && spec.projectedAreaMm2 == null) notas.push('spec dado + malla: el raster de la malla completa projectedArea/warpageTopology');
  } else if (input.mesh) {
    const { volumeMm3, areaMm2 } = meshVolumeArea(input.mesh);
    const q = solidFromMesh(input.mesh);
    const L = q.bbox.x1 - q.bbox.x0, W = q.bbox.y1 - q.bbox.y0, H = q.bbox.z1 - q.bbox.z0;
    spec = {
      name: input.nombre ?? 'modelo',
      Lmm: +L.toFixed(1), Wmm: +W.toFixed(1), Hmm: +H.toFixed(1),
      surfaceMm2: Math.round(areaMm2), volumeMm3: Math.round(volumeMm3),
      wallMm: input.wallMm ?? 0,                      // se completa abajo con el raster
      plastic: input.plastic ?? 'ABS',
      annualVolume: input.annualVolume ?? 500_000,
      totalVolume: input.totalVolume,
      cavityShape: input.cavityShape,
    };
    if (input.plastic == null) notas.push('plástico ASUMIDO: ABS (no declarado)');
    if (input.annualVolume == null) notas.push('producción anual ASUMIDA: 500,000 pzas (no declarada)');
  } else {
    throw new Error('revisarModelo: se necesita spec o mesh');
  }

  // ── 2) EL RASTER (si hay malla): área real, topología de alabeo, pared medida ──
  if (input.mesh) {
    dfm = dfmFromMesh(input.mesh, { wallMm: spec.wallMm || undefined });
    if (spec.projectedAreaMm2 == null) spec.projectedAreaMm2 = dfm.projectedAreaMm2;
    if (spec.warpageTopology == null) spec.warpageTopology = dfm.warpageTopology;
    if (!spec.wallMm) {
      spec.wallMm = dfm.wall.p50Mm || 2;
      notas.push(`pared DERIVADA del raster: mediana ${dfm.wall.p50Mm} mm (p95 ${dfm.wall.p95Mm})`);
    }
    if (dfm.orient.flipRecommended) {
      notas.push(`⚠ el raster recomienda VOLTEAR la pieza (relieve núcleo ${dfm.orient.coreReliefAsIsMm} vs ${dfm.orient.coreReliefFlippedMm} mm/col §11) — esta revisión corre con la orientación DADA`);
    }
  }

  // ── 3) LA MÁQUINA: el diseño físico completo ──
  const pkg = moldMachine(spec);

  // ── 4) EL ENSAMBLE MEDIDO: agua, acero del expulsor, puertos del circuito ──
  // Con malla, los pines se colocan POR AGARRE antes de medir (§11.2.5 Fig 11.11):
  // el auditor juzga las posiciones REALES, no la rejilla que se va a descartar.
  let ens: EnsambleMedido = {};
  let criticos: CoordFinding[] = [];
  try {
    const asm = packageToAssemblySpec(pkg);
    if (asm.ejectors.type !== 'stripper') {
      if (input.mesh) {
        const grip = gripEjectorLayout(input.mesh, { nPins: asm.ejectors.count, pinDiaMm: asm.ejectors.diaMm, wallMm: spec.wallMm });
        if (grip.centered.length >= Math.min(4, asm.ejectors.count)) {
          asm.ejectors.positions = grip.centered;
          asm.ejectors.count = grip.centered.length;
          ens.ejectLayout = 'agarre';
        } else {
          ens.ejectLayout = grip.nParedes === 0 ? 'plana-uniforme' : 'rejilla';
        }
        notas.push(...grip.notas.map((n) => `agarre §11.2.5: ${n}`));
      } else {
        ens.ejectLayout = 'rejilla';
      }
    }
    const med = medirEnsamble(asm);
    ens = { ...med, ejectLayout: ens.ejectLayout };
    criticos = coordAudit(asm).findings.filter((f) => f.sev === 'CRÍTICO');
  } catch (e) {
    notas.push(`ensamble NO medible: ${String(e).slice(0, 120)} — los criterios geométricos quedan SIN-CABLEAR`);
  }

  // ── 5) EL CAMPO DE FLUJO (si hay malla): las ubicaciones de venteo §8.2.2 ──
  let campo: RevisionModelo['campo'];
  let planVenteo: PlanVenteo | undefined;
  if (input.mesh) {
    try {
      const field = flowFieldFromMesh(input.mesh, { wallMm: spec.wallMm, expectVolumeMm3: spec.volumeMm3, maxVoxels: input.flowMaxVoxels });
      campo = {
        nVoxeles: field.nx * field.ny * field.nz, cellMm: field.cellMm,
        maxFlowLenMm: field.maxFlowLenMm, unreachable: field.unreachable, warnings: field.warnings,
      };
      planVenteo = enumerarVenteos(field, { nMaquinar: 8 });
      ens.planVenteo = planVenteo;
      if (field.warnings.length) notas.push(`campo de flujo con avisos de resolución: ${field.warnings.join(' · ')}`);
    } catch (e) {
      notas.push(`campo de flujo NO calculable: ${String(e).slice(0, 120)} — vent-ubicaciones queda SIN-CABLEAR`);
    }
  } else {
    notas.push('sin malla: área proyectada = bbox, alabeo/venteos SIN-CABLEAR (la verdad, no un fallo)');
  }

  // ── 6) LOS CONTRATOS: el juez con TODO lo medible cableado ──
  const rep = contratos(pkg, ens);

  // ── 7) EL EXPEDIENTE §13.10: decisiones pendientes + plan de tryout ──
  const expediente = decisionesDelPaquete(pkg, rep, ens);

  const fila: FilaRevision = {
    nombre: spec.name, score: rep.score,
    cumple: rep.total.cumple, advierte: rep.total.advierte, viola: rep.total.viola,
    sinCablear: rep.total.sinCablear, sinModulo: rep.total.sinModulo,
    congelables: rep.subsistemas.filter((s) => s.congelable).length,
    criticos: criticos.length,
    pendientes: expediente.pendientes,
  };

  return { nombre: spec.name, spec, pkg, ens, contratos: rep, expediente, dfm, campo, planVenteo, criticos, fila, notas };
}

/** El modo REVISAR EN VOLUMEN (N-29) en una línea: tabla ordenada por severidad. */
export function revisarLote(inputs: RevisionInput[]): { filas: FilaRevision[]; revisiones: RevisionModelo[] } {
  const revisiones = inputs.map(revisarModelo);
  const filas = revisiones.map((r) => r.fila)
    .sort((a, b) => b.criticos - a.criticos || b.viola - a.viola || a.score - b.score);
  return { filas, revisiones };
}
