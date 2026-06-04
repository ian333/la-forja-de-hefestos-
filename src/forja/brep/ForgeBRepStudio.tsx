/**
 * ⚒️ La Forja — Part Studio B-Rep INTERACTIVO (crear piezas POR CLIC)
 * ===================================================================
 * El diseñador NO programa: hace CLIC. Croquis → Extrude → Barreno → Fillet →
 * Chamfer → Shell → Revolve. Cada operación es un BOTÓN con su PANEL DE
 * OPCIONES en vivo, llama al kernel exacto (OpenCASCADE/WASM) y agrega un
 * FeatureNode al GRAFO del documento (editable, re-computable: history-replay).
 *
 * Filosofía (igual que el kernel): corrección primero. El primer "análisis"
 * real que ve el diseñador es masa / volumen / centro-de-masa / inercia
 * EXACTOS por GProp_GProps — no estimados, no malla: integración geométrica.
 *
 * Frontera de cómputo: CPU(OCCT)=geometría exacta + STEP + propiedades de masa.
 * GPU(R3F)=render + picking (raycast a la malla teselada para seleccionar
 * cara/arista de Hole/Fillet/Shell).
 *
 * Estética GAIA: viewport oscuro protagonista, paneles de vidrio, oro como
 * acento, invariantes visibles. data-testid en los controles clave para que
 * Playwright haga clic de forma estable (btn-extrude, input-altura, …).
 */

import { useEffect, useMemo, useRef, useState, useCallback, createContext, useContext, type ReactNode } from 'react';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import ShortcutOverlay from '../../components/ShortcutOverlay';
import SketchEditor from './SketchEditor';
import {
  initOCCT,
  _setActiveOCCT,
  extrudePolygon,
  extrudeCircle,
  drillHole,
  filletEdges,
  chamferEdges,
  shellSolid,
  revolvePolygon,
  transformShape,
  mirrorShape,
  fuse,
  makeCompound,
  makeBox,
  makeCylinder,
  cut,
  common,
  PLANE_XY,
  tessellate,
  topology,
  volume,
  surfaceArea,
  massProperties,
  enumerateFaces,
  enumerateEdges,
  enumerateEdgesGeom,
  exportSTEP,
  importSTEP,
  type OC,
  type Pt2,
  type Shape,
  type TessellatedMesh,
  type FaceRef,
  type EdgeRef,
  type EdgeGeom,
  type RevolveAxis,
  type MassProperties,
} from './occt';
import { resolveParams, tryEval, type Param, type ResolvedParams } from './expr';
import { generateDrawing } from './drawing';
import { printabilityReport, overhangVertexColors, PRINT_PROFILES, type PrintProfile, type PrintabilityReport } from '../mech/dfm';
import { cycloidalDisc, pinPositions } from '../mech/cycloidal';
import { discPhases, analyzeGearbox, type Material as GbMaterial } from '../mech/gearbox';
import {
  buildGearSketch,
  deriveGearGeometry,
  sketchSignedArea,
  sketchRotationalSymmetryError,
  GEAR_SKETCH_DEFAULTS,
  type GearSketchParams,
} from '../../lib/parts/involute-gear-sketch';
import {
  prepareFeaSession,
  solveLoadOnSession,
  vonMisesVertexColors,
  jetColor,
  type FEAResult,
  type FaceBC,
  type FEASession,
} from './fea';
import { runTopOpt, densityToMesh, type TopOptResult } from './topopt';
import { MATERIAL_DATABASE } from '../../lib/formulas';

// Ejes GLOBALES preestablecidos para el revolve (gp_Ax1 deterministas).
const GLOBAL_AXES: Record<'x' | 'y' | 'z', RevolveAxis> = {
  x: { origin: [0, 0, 0], dir: [1, 0, 0] },
  y: { origin: [0, 0, 0], dir: [0, 1, 0] },
  z: { origin: [0, 0, 0], dir: [0, 0, 1] },
};

// ──────────────────────────────────────────────────────────────────
// Paleta GAIA
// ──────────────────────────────────────────────────────────────────
const GOLD = '#FDB813';
const GOLD_DIM = '#c9a84c';
const STEEL = '#9fb3c8';
const INK = '#05060A';

// ──────────────────────────────────────────────────────────────────
// Paleta del VIEWPORT CAD (realista estilo KeyShot/Plasticity/Fusion).
// La pieza es METAL DE VERDAD: refleja un HDRI de estudio (metalness alto +
// roughness de maquinado satinado), no gris plano. Las aristas B-Rep oscuras
// crujientes ENCIMA mantienen la legibilidad de la topología.
// ──────────────────────────────────────────────────────────────────
const CAD_EDGE = '#0a0f16';    // arista B-Rep oscura, crujiente (casi negro)
const CAD_BG = '#10151c';      // fondo de estudio (oscuro, no negro puro)

// ──────────────────────────────────────────────────────────────────
// ACABADO PBR por material (lo que el render REFLEJA). El selector de
// material ya no solo cambia la densidad de masa: cambia cómo se VE la
// pieza — aluminio claro pulido, acero azulado satinado, latón dorado.
// color  = albedo del metal (tinte de reflexión).
// metal  = ~0.9-1.0 (es METAL: refleja el HDRI de estudio).
// rough  = acabado de maquinado satinado (0.18 espejo → 0.55 mate impreso).
// coat   = clearcoat sutil (anodizado/laca fina) para vida en las curvas.
// ──────────────────────────────────────────────────────────────────
interface PBRFinish { color: string; metalness: number; roughness: number; clearcoat: number; clearcoatRoughness: number; }
const MATERIAL_PBR: Record<string, PBRFinish> = {
  alu:   { color: '#d3d8de', metalness: 0.95, roughness: 0.18, clearcoat: 0.15, clearcoatRoughness: 0.30 }, // aluminio pulido claro (casi espejo)
  steel: { color: '#aeb8c6', metalness: 0.96, roughness: 0.30, clearcoat: 0.10, clearcoatRoughness: 0.25 }, // acero satinado azulado
  brass: { color: '#caa23a', metalness: 0.92, roughness: 0.36, clearcoat: 0.12, clearcoatRoughness: 0.30 }, // latón dorado pulido suave
  ti:    { color: '#9aa0a8', metalness: 0.88, roughness: 0.55, clearcoat: 0.08, clearcoatRoughness: 0.45 }, // titanio mate de verdad
  abs:   { color: '#c9ccd2', metalness: 0.05, roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.55 }, // plástico ABS (mate con laca)
  pla:   { color: '#d8d3c4', metalness: 0.04, roughness: 0.66, clearcoat: 0.30, clearcoatRoughness: 0.60 }, // plástico PLA
};
const DEFAULT_PBR: PBRFinish = MATERIAL_PBR.alu;

// ──────────────────────────────────────────────────────────────────
// Materiales (densidad en g/mm³) — para el análisis de masa exacto
// ──────────────────────────────────────────────────────────────────
const MATERIALS: Record<string, { label: string; density: number }> = {
  alu: { label: 'Aluminio 6061', density: 2.70e-3 },
  steel: { label: 'Acero 1045', density: 7.85e-3 },
  abs: { label: 'ABS (impresión)', density: 1.04e-3 },
  pla: { label: 'PLA (impresión)', density: 1.24e-3 },
  brass: { label: 'Latón', density: 8.50e-3 },
  ti: { label: 'Titanio Ti-6Al-4V', density: 4.43e-3 },
};

// ──────────────────────────────────────────────────────────────────
// Puente del selector de material de la UI → clave de MATERIAL_DATABASE
// (E, ν, σ_y REALES de src/lib/formulas.ts) que consume el FEA. El selector
// ya elige densidad para la masa; aquí mapeamos a las constantes elásticas.
// (No hay latón propio en la DB; el cobre C11000 es el aleado más cercano.)
// ──────────────────────────────────────────────────────────────────
const FEA_MATERIAL_KEY: Record<string, keyof typeof MATERIAL_DATABASE> = {
  alu: 'aluminio_6061',
  steel: 'acero_1045',
  brass: 'cobre_c11000',
  ti: 'titanio_ti6al4v',
  abs: 'abs',
  pla: 'pla',
};

// ──────────────────────────────────────────────────────────────────
// El documento = grafo de features (sketch base + operaciones ordenadas)
// ──────────────────────────────────────────────────────────────────
type SketchKind = 'rect' | 'circle' | 'lprofile' | 'revprofile' | 'gear' | 'custom' | 'gearbox';
// CAJA cicloidal multi-disco: N discos de lóbulos fasados + eje hueco + base-anillo.
interface GearboxParams {
  lobes: number; discs: number; R: number; Rr: number; E: number;
  T: number; gap: number; shaftD: number; shaftBore: number;
}
const GEARBOX_DEFAULTS: GearboxParams = {
  lobes: 10, discs: 5, R: 40, Rr: 3, E: 1.5, T: 6, gap: 0.6, shaftD: 16, shaftBore: 8,
};

/** Un escalón del perfil de revolución: radio exterior r y longitud axial L. */
interface RevStep { r: number; L: number; }

/**
 * Parámetros del croquis de ENGRANE de involuta (el 7º clásico). La matemática
 * vive en lib/parts/involute-gear-sketch.ts (deriveGearGeometry/buildGearSketch):
 *   rp = m·Z/2   ·   rb = rp·cos α   ·   inv(α) = tan α − α.
 * El perfil cerrado Point2D[] se extruye a sólido B-Rep y se le resta el barreno.
 */
interface GearParams {
  module: number;       // módulo m (mm por par de dientes de arco)
  teeth: number;        // número de dientes Z
  pressureDeg: number;  // ángulo de presión α en grados (default 20°)
  thickness: number;    // espesor axial del engrane (extrude)
  bore: number;         // diámetro del barreno central
}

interface SketchFeature {
  id: 'sketch';
  kind: SketchKind;
  width: number;   // rect / L
  height: number;  // rect / L
  radius: number;  // circle
  legW: number;    // L: ancho de pata
  // Perfil de revolución ESCALONADO (croquis poligonal a UN lado del eje Y).
  // Cada escalón i aporta un cilindro de vol = π·r_i²·L_i; el total es su suma.
  steps: RevStep[];
  // Engrane de involuta (7º clásico). El perfil sale de buildGearSketch().
  gear: GearParams;
  // Caja cicloidal multi-disco (kind 'gearbox'): N discos fasados + eje + base.
  gearbox: GearboxParams;
  // Perfil DIBUJADO en el editor de croquis (kind 'custom'): polígono cerrado en mm
  // resuelto por el solver de restricciones. Reemplaza las plantillas.
  customProfile?: Pt2[];
}

/** Defaults del engrane (m=2, Z=20, α=20°, espesor 10, barreno 8). */
const GEAR_DEFAULTS: GearParams = {
  module: 2, teeth: 20, pressureDeg: 20, thickness: 10, bore: 8,
};

/**
 * ESTADO DEL ENSAMBLE de DOS engranes engranados (la caja de velocidades).
 * El engrane 1 ES el sketch 'gear' del documento (su pieza base, centro en el
 * origen). El engrane 2 es una SEGUNDA instancia, que comparte m y α con el 1
 * pero tiene su propio nº de dientes Z₂ y su propio gp_Trsf (posición + faseo).
 *
 * La FÍSICA del engranado (validada con invariantes, no "se ve bien"):
 *   (1) Distancia entre centros  C = rp₁ + rp₂ = m·(Z₁+Z₂)/2   (engrane externo).
 *   (2) Faseo: para que un DIENTE del 2 entre en un VALLE del 1, el engrane 2 se
 *       rota medio paso angular respecto al alineamiento ingenuo. Con el centro
 *       del 2 sobre +X (γ = π visto desde el 2), el faseo es
 *         φ₂ = π − π/Z₂            (= gear-pair.ts phase2Base, drive=0)
 *       que pone un VALLE del engrane 2 apuntando a −X (hacia el engrane 1),
 *       intercalado con la PUNTA del engrane 1 que apunta a +X.
 *   (3) No-interferencia: Common(sólido₁, sólido₂) ≈ 0 (contacto línea/punto).
 */
interface AssemblyState {
  /** ¿Hay un segundo engrane en escena? (btn-add-gear2). */
  enabled: boolean;
  /** Dientes del engrane 2 (Z₂). Comparte m, α, espesor con el engrane 1. */
  teeth2: number;
  /** ¿Se aplicó el mate (posición + faseo calculados)? (btn-gear-mate). */
  mated: boolean;
  /**
   * ÁNGULO DE ENTRADA θ (rad) del DRIVER cinemático (slider input-angulo-entrada).
   * El engrane 1 (entrada) gira θ alrededor de su eje; el engrane 2 (salida) gira
   * −θ·(Z₁/Z₂) — la relación i = Z₂/Z₁ hace que la salida gire MÁS LENTO y en
   * SENTIDO OPUESTO (engrane externo). El faseo de embonado se mantiene durante
   * todo el giro: el diente sigue entrando en el valle (Common≈0 en el barrido).
   */
  driveAngle: number;
  /**
   * ¿Montar una FLECHA por engrane? (cilindro coaxial al barreno, ajuste con
   * holgura: r_flecha = bore/2 − holgura, así NO interfiere con su propio
   * engrane por construcción). Cada flecha sobresale del espesor por ambos
   * lados para apoyarse en los baleros de la carcasa.
   */
  shafts: boolean;
  /**
   * ¿Encerrar el par en una CARCASA? (caja + shell de pared delgada + 2 barrenos
   * de balero en los ejes de las dos flechas, separados exactamente la distancia
   * entre centros C). Es la pieza que mantiene C fijo en el mundo real.
   */
  housing: boolean;
}

const ASSEMBLY_DEFAULTS: AssemblyState = {
  enabled: false, teeth2: 40, mated: false, driveAngle: 0, shafts: false, housing: false,
};

/**
 * Geometría DERIVADA del mate de dos engranes externos (matemática pura, sin
 * kernel). El engrane 1 está en el origen; el 2 se coloca a C sobre +X.
 *   C    = m·(Z₁+Z₂)/2          (distancia entre centros)
 *   i    = Z₂/Z₁                (relación de transmisión)
 *   φ₂   = π − π/Z₂             (faseo a drive=0: valle del 2 ↔ punta del 1)
 */
function gearMateGeometry(g1: GearParams, teeth2: number) {
  const m = g1.module;
  const z1 = Math.round(g1.teeth);
  const z2 = Math.round(teeth2);
  const rp1 = (m * z1) / 2;
  const rp2 = (m * z2) / 2;
  const centerDistance = (m * (z1 + z2)) / 2; // = rp1 + rp2
  const ratio = z2 / z1;
  const phase2 = Math.PI - Math.PI / z2;
  return { m, z1, z2, rp1, rp2, centerDistance, ratio, phase2 };
}

/**
 * Traduce los GearParams de la UI a los GearSketchParams de la librería de
 * matemática (involute-gear-sketch.ts) y construye el perfil cerrado Point2D[].
 * Resolución MODERADA (no la default pesada): suficiente para un sólido B-Rep
 * exacto y para que extrudePolygon no cuelgue con cientos de vértices.
 */
function gearSketchParams(g: GearParams): GearSketchParams {
  return {
    ...GEAR_SKETCH_DEFAULTS,
    module: g.module,
    teethCount: Math.round(g.teeth),
    pressureAngle: (g.pressureDeg * Math.PI) / 180,
    // ~6 muestras por flanco + 3 por arco → ≈ 22 vértices/diente. Para Z=20
    // son ≈ 440 verts: B-Rep exacto lo aguanta (el límite ~400 era del SDF).
    profileResolution: 6,
    arcResolution: 3,
    filletRadius: 0,
  };
}

/** Perfil 2D cerrado del engrane (Point2D[] → Pt2[] para el kernel). */
function gearProfile(g: GearParams): Pt2[] {
  return buildGearSketch(gearSketchParams(g)).map((p) => ({ x: p.x, y: p.y }));
}

/**
 * Construye UN engrane sólido B-Rep (perfil de involuta → extrudePolygon →
 * resta del barreno central). Es la pieza atómica del Part Studio y de cada
 * INSTANCIA del ensamble. `phaseRad` rota el perfil del croquis antes de
 * extruir (faseo del mate); 0 = sin faseo. El barreno se talla coaxial al eje Z.
 */
function buildGearSolid(oc: OC, g: GearParams, phaseRad = 0): Shape {
  const thick = g.thickness;
  const gp = gearSketchParams(g);
  // Faseo: se hornea como `rotation` del croquis (rota todos los dientes
  // alrededor del centro del engrane), exactamente como spur-gear.ts.
  const verts = buildGearSketch({ ...gp, rotation: phaseRad }).map((p) => ({ x: p.x, y: p.y }));
  let gear = extrudePolygon(oc, verts, thick, PLANE_XY);
  if (g.bore > 0) {
    gear = drillHole(oc, gear, {
      x: 0, y: 0, diameter: g.bore, zTop: thick,
      depth: thick, through: true,
    });
  }
  return gear;
}

type OpType = 'extrude' | 'hole' | 'fillet' | 'chamfer' | 'shell' | 'revolve' | 'pattern' | 'pocket';

// Campos comunes a TODA op del árbol: nombre editable (rename) + supresión
// (suppress) temporal. Un op suprimido se conserva en el grafo pero buildShape
// lo SALTA (no entra al cálculo del sólido) — paridad con el Timeline de Fusion.
interface OpBase { id: string; name?: string; suppressed?: boolean; }
interface ExtrudeOp extends OpBase { type: 'extrude'; depth: number; symmetric: boolean; }
interface HoleOp extends OpBase { type: 'hole'; x: number; y: number; diameter: number; through: boolean; depth: number; }
interface FilletOp extends OpBase { type: 'fillet'; radius: number; edges: number[]; }
interface ChamferOp extends OpBase { type: 'chamfer'; dist: number; edges: number[]; }
interface ShellOp extends OpBase { type: 'shell'; thickness: number; faces: number[]; }
interface RevolveOp extends OpBase { type: 'revolve'; angle: number; axis: 'x' | 'y' | 'z' | 'edge'; }
// PATRÓN: replica el sólido construido hasta aquí. linear (rejilla dx·dy),
// circular (count instancias en angleSpan° alrededor de un eje global) o mirror
// (espejo respecto a un plano principal). Geometría exacta (transform + fuse).
interface PatternOp extends OpBase {
  type: 'pattern'; mode: 'linear' | 'circular' | 'mirror';
  count: number; dx: number; dy: number;            // linear
  angleSpan: number; axis: 'x' | 'y' | 'z';          // circular
  plane: 'yz' | 'zx' | 'xy';                          // mirror
}
// CORTE / BOLSILLO: extrude-cut de un perfil simple (rect o círculo) a (x,y) sobre
// la cara superior, bajando depth (o pasante). Resta del sólido (boolean cut).
interface PocketOp extends OpBase {
  type: 'pocket'; profile: 'rect' | 'circle';
  x: number; y: number; w: number; h: number; diameter: number;
  depth: number; through: boolean;
}
type Op = ExtrudeOp | HoleOp | FilletOp | ChamferOp | ShellOp | RevolveOp | PatternOp | PocketOp;

// ── ENSAMBLE: un COMPONENTE primitivo (bloque o cilindro) posicionado en 3D.
// Varios componentes + la pieza principal se combinan en un compound (sin soldar)
// → permite reconstruir una MÁQUINA pieza a pieza a medidas reales. ──
interface Component {
  id: string; name: string; kind: 'box' | 'cyl';
  w: number; d: number; h: number;     // bloque (h también = altura del cilindro)
  r: number;                            // cilindro (radio)
  x: number; y: number; z: number;     // posición del CENTRO (mm)
  rz?: number;                          // giro alrededor de Z (grados) — poses planas
}

interface BuildResult {
  mesh: TessellatedMesh;
  topo: { faces: number; edges: number; vertices: number; euler: number };
  volKernel: number;
  area: number;
  stepBytes: number;
  mass: MassProperties;
  faces: FaceRef[];
  edges: EdgeRef[];
  edgeGeoms: EdgeGeom[];
  /** Presente sólo en modo ENSAMBLE: datos del segundo engrane + el mate. */
  assembly?: AssemblyResult;
}

/**
 * Resultado del ENSAMBLE de dos engranes engranados. El compound (engrane1 ∪
 * engrane2 SIN soldar) se tesela como `mesh` del BuildResult; aquí guardamos lo
 * específico del mate: la distancia entre centros C medida del modelo, el faseo
 * aplicado, los volúmenes de cada parte y —el invariante CLAVE— el volumen de
 * interferencia Common(g1,g2), que debe ser ≈0 para probar que EMBONAN sin
 * solaparse (donde el intento previo con SDF fallaba).
 */
interface AssemblyResult {
  teeth1: number;
  teeth2: number;
  /** C teórico = m·(Z₁+Z₂)/2 (mm). */
  centerDistanceExpected: number;
  /** C medido = distancia entre los centros de masa de ambas instancias (mm). */
  centerDistanceMeasured: number;
  /** Faseo aplicado al engrane 2 (rad) y si el mate ya está aplicado. */
  phase2: number;
  mated: boolean;
  ratio: number;
  volGear1: number;
  volGear2: number;
  /** Volumen de la booleana Common(g1,g2): el invariante de NO-interferencia. */
  interferenceVolume: number;
  /** interferenceVolume / min(vol1,vol2): fracción adimensional de solape. */
  interferenceFraction: number;
  /** Ángulo de entrada θ (rad) con el que se construyó este estado. */
  driveAngle: number;
  /** Ángulo de salida θ₂ = −θ·(Z₁/Z₂) (rad) — la salida gira a la relación i. */
  outputAngle: number;
  /** Volumen de un solo diente (≈ volumen del engrane más chico / Z) — escala
   *  de referencia para la tolerancia de interferencia del barrido. */
  toothVolumeRef: number;
  /** Componentes presentes en el ensamble (en orden de montaje). */
  components: string[];
  /** ¿Hay flechas montadas? Volumen total de ambas (mm³). */
  shafts: boolean;
  volShafts: number;
  /** ¿Hay carcasa? Volumen de la caja vaciada con baleros (mm³). */
  housing: boolean;
  volHousing: number;
  /** Volumen del compound completo (Σ partes — no se solapan). */
  volCompound: number;
}

/**
 * Construye los DOS sólidos del engranado para un ángulo de entrada θ dado, ya
 * COLOCADOS en sus poses del ensamble (engrane 1 en el origen, engrane 2 a C
 * sobre +X). Esta es la primitiva cinemática compartida por el render vivo Y por
 * el barrido de verificación de embonado: garantiza que ambos midan exactamente
 * el mismo movimiento.
 *
 * Cinemática del engranado (engrane externo):
 *   · Engrane 1 (entrada): rota θ alrededor de su eje Z (origen).
 *   · Engrane 2 (salida):  rota φ₂ − θ·(Z₁/Z₂) alrededor de su eje Z (en X=C).
 *     El término φ₂ es el faseo de embonado; el término −θ·(Z₁/Z₂) es la relación
 *     de transmisión i = Z₂/Z₁ (salida más lenta, sentido opuesto). Mantener el
 *     faseo SUMADO a la rotación cinemática es lo que conserva el embonado
 *     (punta-en-valle) durante TODO el giro → Common≈0 en el barrido.
 *
 * El faseo y la rotación cinemática se HORNEAN en el `rotation` del croquis del
 * engrane 2 (geometría exacta, igual que el mate estático). Devuelve los dos
 * Shape; el llamador es dueño y debe .delete() ambos.
 */
function buildMeshedPair(
  oc: OC,
  g1Params: GearParams,
  teeth2: number,
  mated: boolean,
  driveAngle: number,
): { gear1: Shape; gear2: Shape; mate: ReturnType<typeof gearMateGeometry> } {
  const mate = gearMateGeometry(g1Params, teeth2);
  const g2Params: GearParams = { ...g1Params, teeth: mate.z2 };

  // Engrane 1 (entrada): rota θ alrededor de su propio eje (origen).
  const gear1 = buildGearSolid(oc, g1Params, driveAngle);

  // Engrane 2 (salida): faseo de embonado + rotación cinemática −θ·(Z₁/Z₂).
  // Sin mate (φ₂=0 y sin acoplar la cinemática) se ve punta-contra-punta.
  const phase2 = mated ? mate.phase2 : 0;
  const kin = mated ? -driveAngle * (mate.z1 / mate.z2) : 0;
  const gear2Local = buildGearSolid(oc, g2Params, phase2 + kin);
  // Coloca el engrane 2 a C sobre +X (su eje de giro sigue siendo Z, ahora en X=C).
  const gear2 = transformShape(oc, gear2Local, {
    translate: [mate.centerDistance, 0, 0],
    rotateAngle: 0, // el faseo+cinemática ya se hornearon en el croquis (rotation)
  });
  gear2Local.delete?.();
  return { gear1, gear2, mate };
}

// ──────────────────────────────────────────────────────────────────
// COMPONENTES MECÁNICOS del ensamble (flechas + carcasa), VÍA primitivas
// del kernel — la misma matemática que un diseñador haría con clics:
//   · FLECHA: cilindro coaxial al barreno, r = bore/2 − holgura → entra en el
//     barreno SIN interferir con su propio engrane (radio estrictamente menor).
//     Sobresale del espesor por ambos lados (overhang) para apoyarse en baleros.
//   · CARCASA: caja que envuelve el par + shell (pared delgada, tapa abierta) +
//     2 barrenos de balero EN LOS EJES de las flechas, separados exactamente C.
// Cada componente es un sólido independiente del compound (no se suelda): el
// invariante de embonado engrane↔engrane (Common≈0) queda intacto.
// ──────────────────────────────────────────────────────────────────

/** Holgura radial flecha↔barreno (mm): la flecha es algo más fina que el
 *  barreno para deslizar (ajuste con juego). Garantiza r_flecha < r_barreno. */
const SHAFT_CLEARANCE = 0.4;
/** Cuánto sobresale la flecha del espesor del engrane por cada cara (mm). */
const SHAFT_OVERHANG = 8;
/** Pared de la carcasa (mm) y holgura de la caja al perímetro de los engranes. */
const HOUSING_WALL = 3;
const HOUSING_GAP = 4;

/**
 * Construye las DOS flechas (entrada y salida), coaxiales a los barrenos de los
 * engranes, a la distancia entre centros C. Ejes paralelos a +Z (igual que los
 * engranes). Devuelve los Shape ya posicionados (el llamador es dueño).
 */
function buildShafts(
  oc: OC,
  g1: GearParams,
  thickness: number,
  centerDistance: number,
): Shape[] {
  const r = Math.max(1, g1.bore / 2 - SHAFT_CLEARANCE);
  const len = thickness + 2 * SHAFT_OVERHANG;
  const shaftIn = makeCylinder(oc, r, len, {
    origin: [0, 0, -SHAFT_OVERHANG], dir: [0, 0, 1],
  });
  const shaftOut = makeCylinder(oc, r, len, {
    origin: [centerDistance, 0, -SHAFT_OVERHANG], dir: [0, 0, 1],
  });
  return [shaftIn, shaftOut];
}

/**
 * Construye la CARCASA: caja vaciada (shell) que abraza el par engranado, con
 * 2 barrenos de balero en los ejes de las flechas (separados C). La caja se
 * dimensiona por el radio de cabeza del engrane mayor + holgura + pared.
 *   · ancho X  = C + 2·(ra2) + 2·gap + 2·wall   (cubre ambos engranes en X)
 *   · ancho Y  = 2·(ra_max) + 2·gap + 2·wall
 *   · alto  Z  = espesor + 2·gap + 2·wall
 * El balero es un barreno pasante de ⌀ = bore (la flecha lo atraviesa con juego).
 */
function buildHousing(
  oc: OC,
  g1: GearParams,
  teeth2: number,
  thickness: number,
  centerDistance: number,
): Shape {
  const m = g1.module;
  const z1 = Math.round(g1.teeth);
  const z2 = Math.round(teeth2);
  // Radio de cabeza (addendum) ra = m·(z/2 + 1).
  const ra1 = m * (z1 / 2 + 1);
  const ra2 = m * (z2 / 2 + 1);
  const raMax = Math.max(ra1, ra2);

  // Caja: cubre el engrane 1 (centrado en x=0, radio ra1) y el 2 (centrado en
  // x=C, radio ra2). Extremos en X: x_min = −ra1 − gap − wall, x_max = C + ra2 + gap + wall.
  const xMin = -ra1 - HOUSING_GAP - HOUSING_WALL;
  const xMax = centerDistance + ra2 + HOUSING_GAP + HOUSING_WALL;
  const dx = xMax - xMin;
  const dy = 2 * (raMax + HOUSING_GAP + HOUSING_WALL);
  const dz = thickness + 2 * (HOUSING_GAP + HOUSING_WALL);
  const zMin = -(HOUSING_GAP + HOUSING_WALL);

  // makeBox crea la caja con esquina en el origen → la trasladamos a su sitio.
  let box = makeBox(oc, dx, dy, dz);
  box = transformShape(oc, box, { translate: [xMin, -dy / 2, zMin], rotateAngle: 0 });

  // Vaciado: quitamos la cara SUPERIOR (la de mayor z) para que sea una carcasa
  // abierta por arriba (tapa removible) con pared HOUSING_WALL.
  const faces = enumerateFaces(oc, box);
  // La cara superior es la de centroide z máximo.
  let topIdx = 0; let topZ = -Infinity;
  for (const f of faces) {
    if (f.center && f.center[2] > topZ) { topZ = f.center[2]; topIdx = f.index; }
  }
  let housing: Shape;
  try {
    housing = shellSolid(oc, box, HOUSING_WALL, [topIdx]);
    box.delete?.();
  } catch {
    housing = box; // si el shell degenera, dejamos la caja sólida (sigue siendo carcasa)
  }

  // Baleros: barreno pasante de ⌀ = bore en los ejes de ambas flechas (la flecha
  // pasa con juego). zTop por encima de la caja; pasante para atravesar ambas paredes.
  const dBearing = g1.bore;
  housing = drillHole(oc, housing, {
    x: 0, y: 0, diameter: dBearing, zTop: zMin + dz, depth: dz, through: true, spanBelow: dz,
  });
  housing = drillHole(oc, housing, {
    x: centerDistance, y: 0, diameter: dBearing, zTop: zMin + dz, depth: dz, through: true, spanBelow: dz,
  });
  return housing;
}

// ──────────────────────────────────────────────────────────────────
// Perfil 2D paramétrico → puntos (CCW, centrado / a un lado del eje)
// ──────────────────────────────────────────────────────────────────
function rectProfile(w: number, h: number): Pt2[] {
  const hx = w / 2, hy = h / 2;
  return [{ x: -hx, y: -hy }, { x: hx, y: -hy }, { x: hx, y: hy }, { x: -hx, y: hy }];
}
function lProfile(w: number, h: number, leg: number): Pt2[] {
  // L con esquina inferior-izquierda en (−w/2, −h/2). Perfil CCW.
  const x0 = -w / 2, y0 = -h / 2;
  return [
    { x: x0, y: y0 },
    { x: x0 + w, y: y0 },
    { x: x0 + w, y: y0 + leg },
    { x: x0 + leg, y: y0 + leg },
    { x: x0 + leg, y: y0 + h },
    { x: x0, y: y0 + h },
  ];
}
function circleGhost(radius: number): Pt2[] {
  const pts: Pt2[] = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return pts;
}

/**
 * Perfil de REVOLUCIÓN ESCALONADO (croquis poligonal a UN lado del eje Y, x≥0).
 * Cada escalón i tiene radio exterior r_i y longitud axial L_i, apilados en +Y.
 * El polígono recorre: sube por la ESCALERA exterior (x=r_i, jogs entre niveles)
 * y vuelve a bajar por el EJE (x=0). Queda CCW, cerrado y todo a x≥0, así que su
 * revolución 360° alrededor de +Y (x=0) es un sólido axisimétrico válido.
 *
 * Invariante: Vol(revolve 360°) = Σ π·r_i²·L_i (suma de cilindros coaxiales).
 *   1 escalón  → CILINDRO (π·r²·L).
 *   2-3 escalones de radios distintos → FLECHA con hombros / asientos de balero.
 */
function revProfile(steps: RevStep[]): Pt2[] {
  const pts: Pt2[] = [];
  // Escalera exterior, de abajo hacia arriba.
  let y = 0;
  pts.push({ x: 0, y: 0 }); // base sobre el eje
  for (const s of steps) {
    pts.push({ x: s.r, y });        // jog horizontal hacia el radio del escalón
    y += s.L;
    pts.push({ x: s.r, y });        // sube la longitud del escalón
  }
  // Cierra por el eje: del tope exterior al tope del eje y de regreso al origen.
  pts.push({ x: 0, y }); // tope sobre el eje (de aquí baja recto a (0,0))
  return pts;
}

// ──────────────────────────────────────────────────────────────────
// Replay del grafo de features a través del kernel → Shape final
// ──────────────────────────────────────────────────────────────────
function buildShape(
  oc: OC,
  sketch: SketchFeature,
  ops: Op[],
  // Eje de revolución elegido por clic en una arista RECTA (o null si la op usa
  // un preset global). Lo resuelve el componente desde el EdgeGeom seleccionado.
  edgeAxis: RevolveAxis | null,
): Shape {
  // 1) Sketch base → primer sólido (extrude implícito lo hace la op 'extrude').
  //    El sketch por sí solo no es sólido; el grafo SIEMPRE empieza por extrude
  //    o revolve. Aquí preparamos el perfil; la primera op lo solidifica.
  let shape: Shape | null = null;
  const profile = (): Pt2[] => {
    if (sketch.kind === 'rect') return rectProfile(sketch.width, sketch.height);
    if (sketch.kind === 'lprofile') return lProfile(sketch.width, sketch.height, sketch.legW);
    if (sketch.kind === 'revprofile') return revProfile(sketch.steps);
    if (sketch.kind === 'gear') return gearProfile(sketch.gear);
    if (sketch.kind === 'custom') return sketch.customProfile ?? [];
    return circleGhost(sketch.radius); // solo para revolve poligonal; circle usa extrudeCircle
  };

  // El sólido BASE lo crea la primera op solidificante. Si el documento contiene
  // un REVOLVE, éste tiene PRIORIDAD como base (y el extrude se ignora): así el
  // usuario puede agregar Revolve sin tener que borrar primero el extrude inicial
  // — el grafo nunca queda vacío y la UI no se cae. Reordenamos para que el/los
  // revolve se procesen antes que el/los extrude; el resto conserva su orden.
  // Las ops SUPRIMIDAS se omiten del cálculo (siguen en el árbol, tachadas).
  const active = ops.filter((o) => !o.suppressed);
  const hasRevolve = active.some((o) => o.type === 'revolve');
  const ordered = hasRevolve
    ? [...active.filter((o) => o.type === 'revolve'),
       ...active.filter((o) => o.type !== 'revolve' && o.type !== 'extrude')]
    : active;

  for (const op of ordered) {
    if (op.type === 'extrude') {
      if (shape) continue; // primer sólido ya creado; ignora extrudes posteriores
      if (sketch.kind === 'gear') {
        // ── ENGRANE de involuta (7º clásico) ──
        // 1) perfil de involuta (buildGearSketch) → extrudePolygon a sólido.
        // 2) resta el barreno central pasante (cilindro coaxial en el eje Z).
        // El espesor lo manda el PARÁMETRO del engrane (no el slider del extrude),
        // para que vol = area_perfil·espesor − π·(bore/2)²·espesor sea exacto.
        shape = buildGearSolid(oc, sketch.gear);
        continue;
      }
      if (sketch.kind === 'gearbox') {
        // ── CAJA cicloidal multi-disco (compound print-in-place) ──
        shape = buildGearbox(oc, sketch.gearbox);
        continue;
      }
      // Simétrico: el plano de boceto se baja −depth/2 y se extruye depth, así
      // el sólido queda centrado en z=0 (no cambia volumen ni topología).
      const plane = op.symmetric
        ? { origin: [0, 0, -op.depth / 2] as [number, number, number], uDir: [1, 0, 0] as [number, number, number], vDir: [0, 1, 0] as [number, number, number] }
        : undefined;
      if (sketch.kind === 'circle') {
        shape = extrudeCircle(oc, { x: 0, y: 0 }, sketch.radius, op.depth, plane);
      } else {
        shape = extrudePolygon(oc, profile(), op.depth, plane);
      }
    } else if (op.type === 'revolve') {
      if (shape) continue;
      // Eje de revolución: arista recta elegida por clic (op.axis==='edge') o un
      // preset GLOBAL X/Y/Z. El perfil es el medio-perfil a un lado del eje.
      const axis =
        op.axis === 'edge'
          ? (edgeAxis ?? GLOBAL_AXES.y)
          : GLOBAL_AXES[op.axis];
      shape = revolvePolygon(oc, profile(), op.angle, PLANE_XY, axis);
    } else if (op.type === 'hole' && shape) {
      // zTop = altura del sólido extruido (depende del extrude previo).
      const ex = ops.find((o) => o.type === 'extrude') as ExtrudeOp | undefined;
      const zTop = ex?.depth ?? 12;
      shape = drillHole(oc, shape, {
        x: op.x, y: op.y, diameter: op.diameter, zTop,
        depth: op.depth, through: op.through,
      });
    } else if (op.type === 'fillet' && shape) {
      shape = filletEdges(oc, shape, op.radius, op.edges);
    } else if (op.type === 'chamfer' && shape) {
      shape = chamferEdges(oc, shape, op.dist, op.edges);
    } else if (op.type === 'shell' && shape) {
      shape = shellSolid(oc, shape, op.thickness, op.faces);
    } else if (op.type === 'pattern' && shape) {
      shape = applyPattern(oc, shape, op);
    } else if (op.type === 'pocket' && shape) {
      const ex = ops.find((o) => o.type === 'extrude') as ExtrudeOp | undefined;
      shape = applyPocket(oc, shape, op, ex?.depth ?? 12);
    }
  }
  if (!shape) throw new Error('El documento no tiene sólido: agrega Extrude o Revolve.');
  return shape;
}

/**
 * Aplica los PARÁMETROS: para cada cota ligada (`bindings[opId:field]` o
 * `bindings[sketch:field]`), evalúa la expresión contra el scope y SOBREESCRIBE
 * ese campo numérico. Devuelve copias resueltas de ops + sketch (geometría se
 * construye con los valores calculados). Si una expresión falla, conserva el
 * valor manual previo. `count` se redondea a entero ≥1.
 */
function applyBindings(
  ops: Op[], sketch: SketchFeature, bindings: Record<string, string>, scope: Record<string, number>,
): { ops: Op[]; sketch: SketchFeature } {
  let rsketch = sketch;
  const sko: Record<string, number> = {};
  for (const f of ['width', 'height', 'radius', 'legW'] as const) {
    const e = bindings[`sketch:${f}`];
    if (e != null) { const v = tryEval(e, scope); if (v != null) sko[f] = v; }
  }
  if (Object.keys(sko).length) rsketch = { ...sketch, ...sko } as SketchFeature;
  let any = false;
  const rops = ops.map((op) => {
    let next: Record<string, unknown> | null = null;
    for (const k in bindings) {
      const ci = k.indexOf(':'); const oid = k.slice(0, ci); const field = k.slice(ci + 1);
      if (oid !== op.id) continue;
      const v = tryEval(bindings[k], scope);
      if (v == null) continue;
      next = next ?? { ...op };
      next[field] = field === 'count' ? Math.max(1, Math.round(v)) : v;
    }
    if (next) { any = true; return next as unknown as Op; }
    return op;
  });
  return { ops: any ? rops : ops, sketch: rsketch };
}

/**
 * CORTE / BOLSILLO: resta del sólido un prisma (rect) o cilindro (círculo)
 * posicionado en (x,y) sobre la cara superior (z=zTop), bajando `depth` (o
 * pasante: atraviesa todo el espesor). Geometría exacta (boolean cut).
 */
function applyPocket(oc: OC, shape: Shape, op: PocketOp, zTop: number): Shape {
  const margin = 1e-3;
  const span = op.through ? zTop + 2 * margin : op.depth;
  const top = zTop + margin;
  let tool: Shape;
  if (op.profile === 'circle') {
    tool = makeCylinder(oc, op.diameter / 2, span, { origin: [op.x, op.y, top], dir: [0, 0, -1] });
  } else {
    // makeBox nace en el origen (0,0,0)→(w,h,span); lo centramos en (x,y) y
    // ponemos su cara superior en `top` (baja span hacia −Z).
    const b = makeBox(oc, op.w, op.h, span);
    tool = transformShape(oc, b, { translate: [op.x - op.w / 2, op.y - op.h / 2, top - span] });
    b.delete?.();
  }
  const out = cut(oc, shape, tool);
  tool.delete?.();
  return out;
}

/**
 * ENSAMBLE: construye un COMPONENTE (bloque o cilindro) centrado en su (x,y,z).
 * Geometría exacta; cada componente conserva su identidad en el compound.
 */
function buildComponent(oc: OC, c: Component): Shape {
  const rz = ((c.rz ?? 0) * Math.PI) / 180;
  const zAxis = { origin: [0, 0, 0] as [number, number, number], dir: [0, 0, 1] as [number, number, number] };
  if (c.kind === 'cyl') {
    // cilindro centrado en z (origen base en −h/2, eje +Z) → gira en Z → a su posición
    const cyl = makeCylinder(oc, c.r, c.h, { origin: [0, 0, -c.h / 2], dir: [0, 0, 1] });
    const t = transformShape(oc, cyl, { translate: [c.x, c.y, c.z], rotateAngle: rz, rotateAxis: zAxis });
    cyl.delete?.();
    return t;
  }
  // bloque: nace en el origen → centrar en el origen → girar en Z → trasladar a (x,y,z)
  const raw = makeBox(oc, c.w, c.d, c.h);
  const centered = transformShape(oc, raw, { translate: [-c.w / 2, -c.d / 2, -c.h / 2] });
  raw.delete?.();
  const t = transformShape(oc, centered, { translate: [c.x, c.y, c.z], rotateAngle: rz, rotateAxis: zAxis });
  centered.delete?.();
  return t;
}

/**
 * CAJA DE VELOCIDADES cicloidal multi-disco, en UNA pieza (compound print-in-place).
 * N discos de lóbulos FASADOS a 360/N° (balancean el eje → torsión pura) apilados
 * con holgura `gap` (auto-puente), un EJE hueco central, y la BASE-anillo con sus
 * pernos (el "hembra" que recibe la carga). Geometría exacta. La física de
 * supervivencia la valida gearbox.ts (analyzeGearbox).
 */
function buildGearbox(oc: OC, p: GearboxParams): Shape {
  const disc = cycloidalDisc({ lobes: p.lobes, R: p.R, Rr: p.Rr, E: p.E, segments: 120 });
  const phases = discPhases(p.discs);
  const stepZ = p.T + p.gap;
  const totalH = p.discs * p.T + (p.discs - 1) * p.gap;
  const boreD = p.shaftD + 2 * p.E + 2 * p.gap;   // el barreno libra al eje centrado en cualquier fase
  const parts: Shape[] = [];
  // discos cicloidales fasados (cuerpos separados → giran / print-in-place)
  for (let i = 0; i < p.discs; i++) {
    let d = extrudePolygon(oc, disc.profile, p.T);
    d = drillHole(oc, d, { x: 0, y: 0, diameter: boreD, zTop: p.T, depth: p.T, through: true });
    const ph = (phases[i] * Math.PI) / 180;
    const placed = transformShape(oc, d, { translate: [p.E * Math.cos(ph), p.E * Math.sin(ph), i * stepZ] });
    d.delete?.();
    parts.push(placed);
  }
  // eje HUECO central (alto módulo polar → resiste torsión en plástico)
  let shaft = makeCylinder(oc, p.shaftD / 2, totalH + 2 * p.T, { origin: [0, 0, -p.T], dir: [0, 0, 1] });
  if (p.shaftBore > 0) {
    const bore = makeCylinder(oc, p.shaftBore / 2, totalH + 4 * p.T, { origin: [0, 0, -2 * p.T], dir: [0, 0, 1] });
    const hollow = cut(oc, shaft, bore); shaft.delete?.(); bore.delete?.(); shaft = hollow;
  }
  parts.push(shaft);
  // BASE-anillo (el "hembra"): placa masiva + pernos del anillo (carga → base)
  const baseH = p.T * 1.5;
  parts.push(makeCylinder(oc, p.R + p.Rr + 4, baseH, { origin: [0, 0, -baseH - p.gap], dir: [0, 0, 1] }));
  for (const pp of pinPositions(p.R, p.lobes + 1)) {
    parts.push(makeCylinder(oc, p.Rr, totalH, { origin: [pp.x, pp.y, 0], dir: [0, 0, 1] }));
  }
  return makeCompound(oc, parts);
}

/**
 * PATRÓN: replica `shape` y FUSIONA las instancias (geometría exacta, no malla).
 *  · linear  — count instancias en la rejilla i·(dx,dy,0).
 *  · circular — count instancias rotadas alrededor del eje global elegido por el
 *    origen; paso = 360/count si span≥360 (cierra el círculo sin solape), si no
 *    span/(count−1). El cuerpo debe estar DESCENTRADO del eje o se encimarían.
 *  · mirror  — original + espejo respecto a un plano principal (fuse).
 */
function applyPattern(oc: OC, shape: Shape, op: PatternOp): Shape {
  if (op.mode === 'mirror') {
    const m = mirrorShape(oc, shape, op.plane);
    const out = fuse(oc, shape, m);
    m.delete?.();
    return out;
  }
  const n = Math.max(2, Math.min(64, Math.round(op.count)));
  const axisDir: [number, number, number] = op.axis === 'x' ? [1, 0, 0] : op.axis === 'y' ? [0, 1, 0] : [0, 0, 1];
  let acc = shape;
  for (let i = 1; i < n; i++) {
    let inst: Shape;
    if (op.mode === 'linear') {
      inst = transformShape(oc, shape, { translate: [op.dx * i, op.dy * i, 0] });
    } else {
      const stepDeg = op.angleSpan >= 359.999 ? op.angleSpan / n : op.angleSpan / (n - 1);
      const ang = (stepDeg * i) * Math.PI / 180;
      inst = transformShape(oc, shape, { translate: [0, 0, 0], rotateAngle: ang, rotateAxis: { origin: [0, 0, 0], dir: axisDir } });
    }
    const fused = fuse(oc, acc, inst);
    if (acc !== shape) acc.delete?.();
    inst.delete?.();
    acc = fused;
  }
  return acc;
}

// ──────────────────────────────────────────────────────────────────
// ENSAMBLE de DOS engranes engranados (la caja de velocidades)
// ──────────────────────────────────────────────────────────────────
/**
 * Construye el ENSAMBLE multi-componente: engrane 1 (sketch.gear) en el origen
 * + engrane 2 (mismo m/α, Z₂ propio) colocado por el MATE a C = m·(Z₁+Z₂)/2
 * sobre +X y faseado φ₂ = π − π/Z₂ para que sus dientes EMBONEN en los valles
 * del 1. Devuelve:
 *   · `compound`  TopoDS_Compound (g1 ∪ g2 SIN soldar) — se tesela como la escena.
 *   · `assembly`  metadatos + invariantes del mate (C medido, faseo, interferencia).
 *
 * El INVARIANTE que prueba que embonan: Common(g1,g2) tiene volumen ≈0 (contacto
 * línea/punto, no solape). Aquí lo medimos con la booleana exacta del kernel.
 * Si el mate NO está aplicado, el engrane 2 se coloca igual a C pero SIN faseo
 * (φ₂=0): así se ve la diferencia (dientes punta-contra-punta, interferencia >0).
 */
function buildAssembly(
  oc: OC,
  g1Params: GearParams,
  asm: AssemblyState,
): { compound: Shape; assembly: AssemblyResult } {
  // Par engranado en la pose actual del DRIVER (ángulo de entrada θ).
  const { gear1, gear2, mate } = buildMeshedPair(
    oc, g1Params, asm.teeth2, asm.mated, asm.driveAngle,
  );
  const phase2 = asm.mated ? mate.phase2 : 0;

  // Volúmenes exactos de cada parte (independientes).
  const volGear1 = volume(oc, gear1);
  const volGear2 = volume(oc, gear2);

  // INVARIANTE de NO-INTERFERENCIA: Common(g1,g2). Si embonan, ≈0.
  let interferenceVolume = 0;
  try {
    const inter = common(oc, gear1, gear2);
    interferenceVolume = Math.abs(volume(oc, inter));
    inter.delete?.();
  } catch {
    interferenceVolume = NaN; // booleana degeneró (contacto exacto): se reporta
  }
  const minVol = Math.max(1e-9, Math.min(volGear1, volGear2));
  const interferenceFraction = Number.isFinite(interferenceVolume)
    ? interferenceVolume / minVol
    : NaN;

  // C MEDIDO = distancia entre los centros de masa reales de cada instancia.
  const c1 = massProperties(oc, gear1, 1).centerOfMass;
  const c2 = massProperties(oc, gear2, 1).centerOfMass;
  const centerDistanceMeasured = Math.hypot(c2[0] - c1[0], c2[1] - c1[1], c2[2] - c1[2]);

  // Volumen de UN diente (referencia de tolerancia para el barrido): el cuerpo
  // del engrane más chico repartido entre sus Z dientes. Es la escala física
  // contra la que «< 0.5% de un diente» tiene sentido.
  const toothVolumeRef = Math.min(volGear1, volGear2) / Math.max(1, mate.z1);

  // ── Componentes mecánicos opcionales (flechas + carcasa) ──
  // Se añaden como sólidos independientes del compound; el invariante de
  // embonado engrane↔engrane queda intacto (no se sueldan ni se intersecan
  // con los engranes por construcción: la flecha es más fina que el barreno).
  const extraShapes: Shape[] = [];
  const components: string[] = ['engrane-entrada (Z₁)', 'engrane-salida (Z₂)'];
  let volShafts = 0;
  if (asm.shafts) {
    const shafts = buildShafts(oc, g1Params, g1Params.thickness, mate.centerDistance);
    for (const s of shafts) { volShafts += Math.abs(volume(oc, s)); extraShapes.push(s); }
    components.push('flecha-entrada', 'flecha-salida');
  }
  let volHousing = 0;
  if (asm.housing) {
    const housing = buildHousing(oc, g1Params, mate.z2, g1Params.thickness, mate.centerDistance);
    volHousing = Math.abs(volume(oc, housing));
    extraShapes.push(housing);
    components.push('carcasa (caja + shell + 2 baleros)');
  }

  const compound = makeCompound(oc, [gear1, gear2, ...extraShapes]);
  const volCompound = volGear1 + volGear2 + volShafts + volHousing;

  const assembly: AssemblyResult = {
    teeth1: mate.z1,
    teeth2: mate.z2,
    centerDistanceExpected: mate.centerDistance,
    centerDistanceMeasured,
    phase2,
    mated: asm.mated,
    ratio: mate.ratio,
    volGear1,
    volGear2,
    interferenceVolume,
    interferenceFraction,
    driveAngle: asm.driveAngle,
    outputAngle: asm.mated ? -asm.driveAngle * (mate.z1 / mate.z2) : 0,
    toothVolumeRef,
    components,
    shafts: asm.shafts,
    volShafts,
    housing: asm.housing,
    volHousing,
    volCompound,
  };
  return { compound, assembly };
}

/**
 * BARRIDO de verificación de EMBONADO (el invariante CLAVE). Gira la entrada por
 * un PASO DE DIENTE completo (2π/Z₁) en `samples` ángulos y, en cada uno, mide el
 * volumen de la booleana Common(g1,g2) de los dos sólidos engranados en esa pose.
 * Si los engranes EMBONAN de verdad, el contacto es línea/punto en todo el giro y
 * max(vol_Common) ≈ 0 (muy por debajo del volumen de un diente). Si se solapan
 * (como fallaba el SDF), algún ángulo del barrido dispara la interferencia.
 *
 * Devuelve el máximo, el promedio, la muestra peor, la referencia de un diente y
 * la fracción max_interf/tooth — todo lo que la UI/Playwright necesita para
 * dictaminar honestamente si embonan.
 */
function sweepMeshingInterference(
  oc: OC,
  g1Params: GearParams,
  teeth2: number,
  samples = 10,
): {
  z1: number;
  samples: number;
  toothPitchRad: number;
  toothVolume: number;
  maxInterference: number;
  meanInterference: number;
  worstAngleRad: number;
  maxInterferenceFraction: number;
  perAngle: Array<{ angleRad: number; interference: number }>;
} {
  const mate = gearMateGeometry(g1Params, teeth2);
  const g2Params: GearParams = { ...g1Params, teeth: mate.z2 };
  const toothPitch = (2 * Math.PI) / mate.z1; // un paso de diente de la entrada

  // OPTIMIZACIÓN: construye los sólidos BASE de cada engrane UNA sola vez (la
  // generación del perfil de involuta + extrude es lo caro). Cada muestra del
  // barrido aplica una ROTACIÓN RÍGIDA (gp_Trsf, barata y EXACTA) alrededor del
  // eje Z propio de cada engrane — geométricamente idéntico a hornear la rotación
  // en el croquis, pero sin re-generar la involuta. El faseo φ₂ se hornea una vez
  // en la base del engrane 2.
  //   · gear1 base: en el origen, sin faseo.   Eje de giro Z en (0,0).
  //   · gear2 base: faseado φ₂ y trasladado a X=C.  Eje de giro Z en (C,0).
  const gear1Base = buildGearSolid(oc, g1Params, 0);
  const gear2Local = buildGearSolid(oc, g2Params, mate.phase2);
  const gear2Base = transformShape(oc, gear2Local, {
    translate: [mate.centerDistance, 0, 0], rotateAngle: 0,
  });
  gear2Local.delete?.();

  // Referencia de un diente: cuerpo del engrane de entrada / Z₁.
  const toothVolume = volume(oc, gear1Base) / Math.max(1, mate.z1);
  const axis1: RevolveAxis = { origin: [0, 0, 0], dir: [0, 0, 1] };
  const axis2: RevolveAxis = { origin: [mate.centerDistance, 0, 0], dir: [0, 0, 1] };

  const perAngle: Array<{ angleRad: number; interference: number }> = [];
  let maxInterference = 0;
  let sumInterference = 0;
  let worstAngleRad = 0;

  for (let k = 0; k < samples; k++) {
    const theta = (toothPitch * k) / samples; // [0, paso) — un periodo del engranado
    // Entrada: gira θ alrededor de su eje. Salida: −θ·(Z₁/Z₂) alrededor del suyo.
    const gear1 = transformShape(oc, gear1Base, {
      translate: [0, 0, 0], rotateAngle: theta, rotateAxis: axis1,
    });
    const gear2 = transformShape(oc, gear2Base, {
      translate: [0, 0, 0], rotateAngle: -theta * (mate.z1 / mate.z2), rotateAxis: axis2,
    });
    let interf = 0;
    try {
      const inter = common(oc, gear1, gear2);
      interf = Math.abs(volume(oc, inter));
      inter.delete?.();
    } catch {
      interf = NaN; // contacto exacto degeneró la booleana: se reporta tal cual
    }
    gear1.delete?.();
    gear2.delete?.();
    perAngle.push({ angleRad: theta, interference: interf });
    const finite = Number.isFinite(interf) ? interf : 0;
    sumInterference += finite;
    if (finite > maxInterference) { maxInterference = finite; worstAngleRad = theta; }
  }
  gear1Base.delete?.();
  gear2Base.delete?.();

  const maxInterferenceFraction = toothVolume > 0 ? maxInterference / toothVolume : NaN;
  return {
    z1: mate.z1,
    samples,
    toothPitchRad: toothPitch,
    toothVolume,
    maxInterference,
    meanInterference: sumInterference / Math.max(1, samples),
    worstAngleRad,
    maxInterferenceFraction,
    perAngle,
  };
}

// ──────────────────────────────────────────────────────────────────
// Render del sólido teselado + picking de cara/arista (raycast)
// ──────────────────────────────────────────────────────────────────
function SolidMesh({
  mesh, faded, matKey, faces, edgeGeoms, selFaces, selEdges, pickMode, onPickFace, onPickEdge,
  feaColors, overhangColors, clip,
}: {
  mesh: TessellatedMesh;
  faded: boolean;
  matKey: string;
  faces: FaceRef[];
  edgeGeoms: EdgeGeom[];
  selFaces: number[];
  selEdges: number[];
  pickMode: 'none' | 'face' | 'edge';
  onPickFace: (i: number, p?: THREE.Vector3) => void;
  onPickEdge: (i: number) => void;
  /** Colores por vértice del campo de von Mises (RGB 0..1, 3·N). null = sin overlay. */
  feaColors: Float32Array | null;
  /** Overlay de voladizos (imprimibilidad): tiene prioridad sobre el FEA. */
  overhangColors: Float32Array | null;
  /** Planos de corte (sección). undefined/null = sin corte. */
  clip: THREE.Plane[] | null;
}) {
  const pbr = MATERIAL_PBR[matKey] ?? DEFAULT_PBR;
  const overlayColors = overhangColors ?? feaColors;   // imprimibilidad > FEA
  const clipPlanes = clip ?? undefined;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeBoundingSphere();
    return g;
  }, [mesh]);

  // OVERLAY FEA: si hay colores de von Mises, los pegamos como atributo `color`
  // del geometry (vertexColors). Coincide 1:1 con los vértices de `positions`
  // (vonMisesVertexColors muestrea EXACTAMENTE en mesh.positions). Se actualiza
  // al recalcular el FEA; al apagar el overlay se remueve el atributo.
  useEffect(() => {
    if (overlayColors && overlayColors.length === mesh.positions.length) {
      geom.setAttribute('color', new THREE.BufferAttribute(overlayColors, 3));
    } else if (geom.getAttribute('color')) {
      geom.deleteAttribute('color');
    }
    geom.attributes.color && (geom.attributes.color.needsUpdate = true);
  }, [geom, overlayColors, mesh.positions.length]);
  const edgesGeo = useMemo(() => new THREE.EdgesGeometry(geom, 25), [geom]);
  useEffect(() => () => { geom.dispose(); edgesGeo.dispose(); }, [geom, edgesGeo]);

  // Radio del tubo PICKEABLE de arista, escalado al tamaño del modelo: ni tan
  // fino que el raycast falle, ni tan grueso que tape la geometría. La esfera de
  // contorno del sólido da la escala; ~1.3% del radio es cómodo para clicar.
  const tubeR = useMemo(() => {
    const r = geom.boundingSphere?.radius ?? 30;
    return Math.max(0.35, r * 0.013);
  }, [geom]);

  // Geometría PICKEABLE de cada arista (tubo a lo largo de su polilínea EXACTA
  // del kernel) en DOS radios: uno FINO (objetivo de raycast, casi invisible) y
  // uno GRUESO (resalte de la arista seleccionada, sobresale del sólido). El
  // raycast de three.js contra estos tubos devuelve la arista REAL bajo el
  // cursor (no la del punto-medio más cercano): igual de exacto que el picking
  // de cara por triángulo. Cada tubo lleva su edgeId.
  const edgeTubes = useMemo(() => {
    return edgeGeoms.map((eg) => {
      const pts = eg.polyline.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      // CatmullRom con tension 0 sobre ≥2 puntos = polilínea recta entre nodos
      // (no “redondea” las rectas); para curvas sigue la discretización fina.
      const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0);
      const segs = Math.max(1, pts.length - 1);
      const geoPick = new THREE.TubeGeometry(curve, segs, tubeR, 6, false);
      const geoSel = new THREE.TubeGeometry(curve, segs, tubeR * 2.4, 8, false);
      return { edgeId: eg.edgeId, geoPick, geoSel };
    });
  }, [edgeGeoms, tubeR]);
  useEffect(() => () => {
    for (const t of edgeTubes) { t.geoPick.dispose(); t.geoSel.dispose(); }
  }, [edgeTubes]);

  // Geometría de RESALTE: por cada cara seleccionada, extraemos sus grupos
  // (faceGroups del kernel) y construimos una sub-malla con los MISMOS
  // triángulos. Render con emissive de oro encima del sólido → la cara se
  // "enciende". (No usamos vertex colors para que el material brille con bloom.)
  const highlightGeo = useMemo(() => {
    if (!selFaces.length) return null;
    const sel = new Set(selFaces);
    const idx: number[] = [];
    for (const grp of mesh.faceGroups) {
      if (sel.has(grp.faceId)) {
        for (let k = grp.start; k < grp.start + grp.count; k++) {
          idx.push(mesh.indices[k]);
        }
      }
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    // Atributos PROPIOS (no compartidos con `geom`) sobre los mismos datos: así
    // disponer un geometry no libera el buffer GPU del otro.
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    return g;
  }, [mesh, selFaces]);
  useEffect(() => () => { highlightGeo?.dispose(); }, [highlightGeo]);

  // Picking de CARA REAL: el raycast de three.js entrega el ÍNDICE DEL TRIÁNGULO
  // (e.faceIndex). El kernel etiquetó cada triángulo con su cara OCCT
  // (mesh.faceIds), así que triángulo → faceId es directo y exacto: la cara que
  // devolvemos es la que está REALMENTE bajo el cursor.
  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const ti = e.faceIndex;
    if (ti != null && ti >= 0 && ti < mesh.faceIds.length) {
      onPickFace(mesh.faceIds[ti], e.point);
      return;
    }
    // Fallback (raro): si no hubo faceIndex, usa el centroide más cercano.
    const p = e.point;
    let best = -1, bd = Infinity;
    for (const f of faces) {
      const d = (f.center[0] - p.x) ** 2 + (f.center[1] - p.y) ** 2 + (f.center[2] - p.z) ** 2;
      if (d < bd) { bd = d; best = f.index; }
    }
    if (best >= 0) onPickFace(best);
  }, [pickMode, mesh, faces, onPickFace]);

  // Picking de ARISTA EXACTO: el clic golpea un TUBO concreto (raycast a su malla
  // triangulada). Cada tubo conoce su edgeId, así que devolvemos la arista REAL
  // bajo el cursor — no la del punto-medio más cercano (heurística vieja).
  const handleEdgeClick = useCallback((edgeId: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onPickEdge(edgeId);
  }, [onPickEdge]);

  // SELECCIÓN DIRECTA estilo Fusion: SIEMPRE activa (sin "modo"). Pasas el mouse y
  // la cara/arista bajo el cursor se pre-resalta; clic la selecciona. La ARISTA tiene
  // prioridad sobre la cara (su tubo de pick está al frente y hace stopPropagation).
  const [hoverFace, setHoverFace] = useState<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    const ti = e.faceIndex;
    if (ti != null && ti >= 0 && ti < mesh.faceIds.length) {
      const fid = mesh.faceIds[ti];
      setHoverFace((h) => (h === fid ? h : fid));
      setHoveredEdge(null);
    }
  }, [mesh]);
  const handleEdgeMove = useCallback((edgeId: number) => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHoveredEdge((h) => (h === edgeId ? h : edgeId));
    setHoverFace(null);
  }, []);
  const handlePointerOver = useCallback(() => {
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  }, []);
  const handlePointerOut = useCallback(() => {
    setHoverFace(null); setHoveredEdge(null);
    if (typeof document !== 'undefined') document.body.style.cursor = '';
  }, []);
  // Cara en hover (la arista manda: si hay arista en hover, no resaltamos cara).
  const hoverGeo = useMemo(() => {
    if (hoverFace == null || hoveredEdge != null || selFaces.includes(hoverFace)) return null;
    const idx: number[] = [];
    for (const grp of mesh.faceGroups) {
      if (grp.faceId === hoverFace) {
        for (let k = grp.start; k < grp.start + grp.count; k++) idx.push(mesh.indices[k]);
      }
    }
    if (!idx.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(mesh.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(mesh.normals, 3));
    g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1));
    return g;
  }, [mesh, hoverFace, hoveredEdge, selFaces]);
  useEffect(() => () => { hoverGeo?.dispose(); }, [hoverGeo]);

  return (
    <group>
      <mesh
        geometry={geom}
        castShadow
        receiveShadow
        onClick={handleClick}
        onPointerMove={handlePointerMove}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {overlayColors ? (
          /* OVERLAY (FEA von Mises / voladizos de imprimibilidad): vertexColors.
             meshBasicMaterial = SIN luz: el color del esfuerzo se ve EXACTO en
             cualquier ángulo y con la luz tenue del viewport CAD (un mapa de
             color FEM debe leerse fiel, no teñido por el HDRI ni por sombras).
             vertexColors multiplica `color`, así que color=blanco. Las aristas
             B-Rep oscuras encima siguen dando la forma. */
          <meshBasicMaterial
            vertexColors
            color="#ffffff"
            toneMapped={false}
            clippingPlanes={clipPlanes}
            side={THREE.DoubleSide}
          />
        ) : (
          /* METAL PBR REAL (KeyShot/Plasticity): metalness alto + roughness de
             maquinado satinado → la pieza REFLEJA el HDRI de estudio (envMap
             fuerte) y lee como aluminio/acero/latón torneado, NO yeso gris.
             clearcoat sutil da vida a las curvas (anodizado/laca fina). El color
             y el acabado salen de MATERIAL_PBR → el selector por fin se VE.
             Sin emissive: en un CAD la pieza no brilla, REFLEJA. */
          <meshPhysicalMaterial
            color={faded ? '#9aa3ad' : pbr.color}
            metalness={pbr.metalness}
            roughness={pbr.roughness}
            clearcoat={pbr.clearcoat}
            clearcoatRoughness={pbr.clearcoatRoughness}
            envMapIntensity={1.35}
            flatShading={false}
            clippingPlanes={clipPlanes}
            side={clipPlanes ? THREE.DoubleSide : THREE.FrontSide}
          />
        )}
      </mesh>

      {/* CARA EN HOVER (pre-selección): oro tenue cálido, sin emisión, debajo del
          resalte de selección. Comunica "esta es la que vas a clicar". */}
      {hoverGeo && (
        <mesh geometry={hoverGeo} renderOrder={2}>
          <meshBasicMaterial
            color={'#f3bf8e'}
            transparent
            opacity={0.3}
            depthWrite={false}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}

      {/* CARA RESALTADA: misma topología, material de oro emisivo encima. */}
      {highlightGeo && (
        <mesh geometry={highlightGeo} renderOrder={2}>
          <meshStandardMaterial
            color={'#ffd24a'}
            emissive={GOLD}
            emissiveIntensity={0.9}
            metalness={0.3}
            roughness={0.35}
            transparent
            opacity={0.92}
            polygonOffset
            polygonOffsetFactor={-2}
            polygonOffsetUnits={-2}
          />
        </mesh>
      )}

      {/* ARISTAS B-Rep CRUJIENTES (clave para leer la topología, como TODO CAD).
          Líneas oscuras finas dibujadas ENCIMA del sólido con polygonOffset para
          que no z-fighteen contra las caras. Esto, no el brillo, es lo que hace
          legible la pieza: cada cambio de cara se ve como una arista nítida. */}
      <lineSegments geometry={edgesGeo} renderOrder={1}>
        <lineBasicMaterial
          color={CAD_EDGE}
          transparent
          opacity={0.82}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </lineSegments>

      {/* ARISTAS PICKEABLES: tubo FINO por arista (objetivo de raycast, casi
          invisible). Solo aceptan clic en modo 'edge'; siguen siendo objetivo
          del raycast cuando el picking está activo. */}
      {edgeTubes.map(({ edgeId, geoPick }) => (
        <mesh
          key={`etp${edgeId}`}
          geometry={geoPick}
          renderOrder={3}
          onClick={handleEdgeClick(edgeId)}
          onPointerMove={handleEdgeMove(edgeId)}
          onPointerOut={handlePointerOut}
        >
          {/* invisible (opacity 0) pero SIEMPRE objetivo de raycast → hover/clic directo */}
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}

      {/* ARISTA en HOVER: tubo de oro tenue (pre-selección, distinto del seleccionado). */}
      {hoveredEdge != null && !selEdges.includes(hoveredEdge) && edgeTubes.filter((t) => t.edgeId === hoveredEdge).map(({ edgeId, geoSel }) => (
        <mesh key={`eth${edgeId}`} geometry={geoSel} renderOrder={4}>
          <meshBasicMaterial color={'#f3bf8e'} transparent opacity={0.85} toneMapped={false} depthTest={false} />
        </mesh>
      ))}

      {/* ARISTA(S) SELECCIONADA(S): tubo GRUESO de oro emisivo SIEMPRE encima del
          sólido (depthTest off) — visible aunque el bloom queme la cara. */}
      {edgeTubes.filter((t) => selEdges.includes(t.edgeId)).map(({ edgeId, geoSel }) => (
        <mesh key={`ets${edgeId}`} geometry={geoSel} renderOrder={5} onClick={handleEdgeClick(edgeId)}>
          <meshBasicMaterial color={GOLD} toneMapped={false} depthTest={false} />
        </mesh>
      ))}

      {/* (La esfera verde de centroide se quitó: el resalte de superficie dorado
          + el hover ya comunican la selección sin el "chícharo" verde encima.) */}
    </group>
  );
}

// Render del resultado GENERATIVO: cada voxel con densidad ≥ umbral se dibuja como
// una cajita (instancedMesh, una sola draw-call) coloreada por densidad (turbo).
// Muestra la ESTRUCTURA ÓPTIMA que el optimizador dejó tras vaciar material.
function GenerativeVoxels({ result, threshold }: { result: TopOptResult; threshold: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const s = result.mesh.voxel * 0.94;
  const cap = Math.max(1, result.cells.length);
  useEffect(() => {
    const im = ref.current; if (!im) return;
    const m = new THREE.Matrix4(); const col = new THREE.Color();
    let n = 0;
    for (let e = 0; e < result.cells.length; e++) {
      if (result.xPhys[e] < threshold) continue;
      const c = result.cells[e];
      m.makeScale(s, s, s); m.setPosition(c.cx, c.cy, c.cz); im.setMatrixAt(n, m);
      const [r, g, b] = jetColor((result.xPhys[e] - threshold) / (1 - threshold || 1));
      col.setRGB(r, g, b); im.setColorAt(n, col);
      n++;
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }, [result, threshold, s]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cap]} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial metalness={0.35} roughness={0.5} envMapIntensity={1.1} />
    </instancedMesh>
  );
}

// Superficie SUAVE del resultado generativo (orgánica, manufacturable — NO bloques).
// densityToMesh extrae la frontera del blob y la suaviza (Laplaciano). Esto es lo que
// hace que se vea como Fusion y se pueda vender / exportar a STL.
function GenerativeSurface({ result, threshold }: { result: TopOptResult; threshold: number }) {
  const geom = useMemo(() => {
    const { positions, indices } = densityToMesh(result, threshold, 6);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setIndex(new THREE.BufferAttribute(indices, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }, [result, threshold]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom} castShadow receiveShadow>
      <meshStandardMaterial color="#cfd6df" metalness={0.85} roughness={0.32} envMapIntensity={1.2} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ProfileGhost({ pts }: { pts: Pt2[] }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const arr: number[] = [];
    const n = pts.length;
    for (let i = 0; i <= n; i++) {
      const p = pts[i % n];
      arr.push(p.x, p.y, 0);
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  }, [pts]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <line>
      <bufferGeometry attach="geometry" {...geo} />
      <lineBasicMaterial color={GOLD} transparent opacity={0.9} />
    </line>
  );
}

function SketchPlane() {
  // Rejilla del PLANO DE BOCETO (XY local del sketch), sutil — referencia, no
  // protagonista. Vive en el group rotado del modelo; el piso de estudio de
  // referencia espacial lo pone CadViewport en coordenadas de mundo.
  return (
    <gridHelper
      args={[160, 32, new THREE.Color('#2a3744'), new THREE.Color('#1a232d')]}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0, -0.01]}
    />
  );
}

/**
 * CadViewport — viewport LIMPIO de CAD de precisión (Onshape/Plasticity/Fusion).
 * NO usa el Stage cinematográfico de los labs (ese se queda con su bloom/grade);
 * este es su propio <Canvas> diseñado para LEER geometría, no para wow:
 *   · SIN bloom / SIN postFX de cine — solo ACES para una exposición neutra.
 *   · Luz de estudio pareja (key + fill + rim suaves) + HDR neutro a baja
 *     intensidad → caras planas con tono uniforme, sin softbox quemado.
 *   · Piso/grid sutil + contact shadow suave para anclar la pieza en el espacio.
 *   · Cámara 3/4 por default.
 * El acento dorado GAIA queda solo en selección/HUD (fuera del Canvas).
 */
function CadViewport({
  cameraDistance, autoRotate, minDistance, maxDistance, enablePan = true, children,
}: {
  cameraDistance: number;
  autoRotate: boolean;
  minDistance?: number;
  maxDistance?: number;
  enablePan?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="relative w-full h-full"
      style={{
        // Degradado de estudio MUY sutil: un poco más claro al centro para dar
        // profundidad sin viñeta cinematográfica.
        background: `radial-gradient(ellipse at 50% 42%, #18202a 0%, ${CAD_BG} 70%, #0b0f14 100%)`,
      }}
    >
      <Canvas
        shadows
        camera={{
          // 3/4 clásico de CAD: ligeramente arriba y al frente-derecha. Encuadre
          // ajustado (la pieza llena el viewport) → aristas más crujientes.
          position: [cameraDistance * 0.58, cameraDistance * 0.5, cameraDistance * 0.72],
          fov: 35,
          near: 0.01,
          far: 20000,
        }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          // ACES para PBR de metal — SIN grade cinematográfico (sin Bloom/Vignette/
          // Grain/CA). Exposición algo más baja para que el highlight del metal
          // tenga ROLL-OFF (no clipee a blanco): el brillo conserva textura.
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.90;
          gl.localClippingEnabled = true;   // SECCIÓN: corte por plano (clip)
        }}
      >
        {/* HDRI de estudio que el METAL REFLEJA (es lo que lo hace ver real, como
            KeyShot/Plasticity). environmentIntensity ~1.0 → reflejos vivos en las
            caras; los directionales bajan para no doblar el highlight. Sin
            background (el fondo lo pone el div en degradado). */}
        <Environment files="/hdri/studio_small_03_1k.hdr" background={false} environmentIntensity={1.0} />

        {/* LUZ DE ESTUDIO SUAVE — el HDRI hace el grueso del modelado; estos solo
            dan dirección y la sombra de contacto al piso. Intensidades bajas para
            que el reflejo del entorno mande y el highlight no se queme. */}
        <ambientLight intensity={0.18} />
        <directionalLight
          position={[cameraDistance, cameraDistance * 1.4, cameraDistance * 0.8]}
          intensity={0.55}
          color="#ffffff"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-cameraDistance, cameraDistance * 0.3, -cameraDistance * 0.6]} intensity={0.22} color="#cfe0f0" />
        <directionalLight position={[0, -cameraDistance * 0.6, cameraDistance]} intensity={0.15} color="#ffffff" />

        <OrbitControls
          makeDefault
          enablePan={enablePan}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotate}
          autoRotateSpeed={0.45}
          minDistance={minDistance ?? cameraDistance * 0.15}
          maxDistance={maxDistance ?? cameraDistance * 6}
        />

        {/* VIEWCUBE — orientación viva (como TODO CAD). Click en una cara salta a
            vista ortográfica; etiquetas en español. El Canvas es full-window y el
            panel de opciones (.fb-params, right:18 width:230 ≈248px) lo cubriría en
            top-right, así que lo INSETAMOS ~290px para que quede justo a su izquierda
            (como el ViewCube de Fusion, pegado al panel de propiedades). */}
        <GizmoHelper alignment="top-right" margin={[300, 104]}>
          <GizmoViewcube
            color="#aab4c2"
            textColor="#10151c"
            strokeColor="#5a6675"
            hoverColor={GOLD}
            faces={['DER', 'IZQ', 'ARRIBA', 'ABAJO', 'FRENTE', 'ATRAS']}
          />
        </GizmoHelper>

        {children}

        {/* PISO de referencia espacial — grid infinito sutil + sombra de contacto
            suave bajo la pieza. Anclan la geometría en el espacio (como Onshape)
            sin competir con ella. En el suelo del modelo (y=0 de mundo, el group
            del modelo está rotado para que su base quede sobre este plano). */}
        <CadGround size={Math.max(60, cameraDistance * 1.2)} />
      </Canvas>
    </div>
  );
}

/** Piso de estudio: grid sutil + contact shadow suave para profundidad barata. */
function CadGround({ size }: { size: number }) {
  return (
    <group position={[0, -0.02, 0]}>
      <Grid
        args={[size, size]}
        cellSize={size / 60}
        cellThickness={0.6}
        cellColor="#28333f"
        sectionSize={size / 12}
        sectionThickness={1.0}
        sectionColor="#3a4a5a"
        fadeDistance={size * 1.1}
        fadeStrength={2.2}
        infiniteGrid
        followCamera={false}
      />
      <ContactShadows
        position={[0, 0.005, 0]}
        scale={size * 0.85}
        far={size * 0.55}
        blur={2.4}
        opacity={0.62}
        color="#04060a"
        resolution={1024}
      />
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// Cota numérica con slider (estilo Onshape) + testid
// ──────────────────────────────────────────────────────────────────
// ── PARÁMETROS: contexto para que cualquier cota (Dim) se LIGUE a una expresión
// (p.ej. `ancho/2`). Si una cota tiene `bindKey` y existe binding[bindKey], el
// slider se sustituye por la expresión + su valor calculado (read-only); la
// resolución real ocurre en applyBindings antes de buildShape. ──
interface BindCtxT {
  scope: Record<string, number>;
  bindings: Record<string, string>;
  setBinding: (key: string, expr: string | null) => void;
}
const BindContext = createContext<BindCtxT | null>(null);

function Dim({ label, value, unit, onChange, min, max, step, testid, bindKey }: {
  label: string; value: number; unit: string; onChange: (v: number) => void;
  min: number; max: number; step: number; testid?: string; bindKey?: string;
}) {
  const bind = useContext(BindContext);
  const expr = bindKey && bind ? bind.bindings[bindKey] : undefined;
  const bound = expr != null;
  if (bound && bind && bindKey) {
    const v = tryEval(expr, bind.scope);
    const ok = v != null;
    return (
      <label className={`fb-dim fb-dim-bound ${ok ? '' : 'err'}`}>
        <span className="fb-dim-label">{label} <span className="fb-fx on">ƒₓ</span></span>
        <input className="fb-expr" data-testid={testid ? `${testid}-expr` : undefined}
          value={expr} spellCheck={false}
          onChange={(e) => bind.setBinding(bindKey, e.target.value)}
          title="Expresión (usa nombres de parámetros). Vacía/× para desligar." />
        <span className="fb-dim-val">
          {ok ? `${v.toFixed(step < 1 ? 2 : 1)}` : '—'}<em>{unit}</em>
          <button className="fb-fx-x" data-testid={testid ? `${testid}-unbind` : undefined}
            onClick={(e) => { e.preventDefault(); bind.setBinding(bindKey, null); }} title="Desligar">×</button>
        </span>
      </label>
    );
  }
  return (
    <label className="fb-dim">
      <span className="fb-dim-label">
        {label}
        {bindKey && bind && (
          <button className="fb-fx" data-testid={testid ? `${testid}-bind` : undefined}
            onClick={(e) => { e.preventDefault(); bind.setBinding(bindKey, String(value)); }}
            title="Ligar a una expresión de parámetros">ƒₓ</button>
        )}
      </span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        data-testid={testid}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="fb-dim-val">
        {value.toFixed(step < 1 ? 1 : 0)}<em>{unit}</em>
      </span>
    </label>
  );
}

let opCounter = 0;
const newId = (t: string) => `${t}-${++opCounter}`;

// ── GUARDAR / CARGAR: el documento serializable (todo el grafo de diseño) ──
interface DocState {
  version: number; name: string;
  sketch: SketchFeature; ops: Op[]; material: keyof typeof MATERIALS;
  assembly: AssemblyState; params: Param[]; bindings: Record<string, string>; components: Component[];
  importedStep?: string | null;   // STEP importado (reemplaza la pieza principal)
}
const DEFAULT_SKETCH: SketchFeature = {
  id: 'sketch', kind: 'rect', width: 40, height: 24, radius: 14, legW: 10,
  steps: [{ r: 10, L: 20 }, { r: 15, L: 30 }, { r: 10, L: 20 }],
  gear: { ...GEAR_DEFAULTS }, gearbox: { ...GEARBOX_DEFAULTS },
};
function makeDefaultDoc(name = 'Pieza nueva'): DocState {
  return {
    version: 1, name,
    sketch: { ...DEFAULT_SKETCH, gear: { ...GEAR_DEFAULTS } },
    ops: [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }],
    material: 'alu', assembly: { ...ASSEMBLY_DEFAULTS }, params: [], bindings: {}, components: [],
  };
}

// ── EJEMPLOS cargables (proyectos demo) — el reductor cicloidal generado por la
// física: disco de lóbulos (perfil custom) + anillo de pernos + excéntrico. Para
// abrirlo en La Forja y analizarlo por sección (caras cortadas). ──
function cycloidalReducerDoc(): DocState {
  const lobes = 10, R = 40, Rr = 3, E = 1.5, T = 8;
  const disc = cycloidalDisc({ lobes, R, Rr, E, segments: 150 });
  const profile = disc.profile.map((p) => ({ x: p.x + E, y: p.y }));   // offset E → malla
  const base = makeDefaultDoc('Reductor cicloidal 10:1');
  const components: Component[] = pinPositions(R, lobes + 1).map((p, i) => ({
    id: newId('comp'), name: `Perno ${i + 1}`, kind: 'cyl', w: 0, d: 0, h: T, r: Rr, x: p.x, y: p.y, z: T / 2, rz: 0,
  }));
  components.push({ id: newId('comp'), name: 'Excéntrico', kind: 'cyl', w: 0, d: 0, h: 24, r: 5, x: 0, y: 0, z: 12, rz: 0 });
  return {
    ...base, name: 'Reductor cicloidal 10:1',
    sketch: { ...DEFAULT_SKETCH, kind: 'custom', customProfile: profile, gear: { ...GEAR_DEFAULTS } },
    ops: [
      { id: newId('extrude'), type: 'extrude', depth: T, symmetric: false },
      { id: newId('hole'), type: 'hole', x: 0, y: 0, diameter: 12, through: true, depth: T },
      ...[0, 1, 2, 3].map((k) => {
        const a = (2 * Math.PI * k) / 4;
        return { id: newId('hole'), type: 'hole' as const, x: 22 * Math.cos(a), y: 22 * Math.sin(a), diameter: 11, through: true, depth: T };
      }),
    ],
    components,
  };
}
function makeExamples(): Array<{ name: string; doc: () => DocState }> {
  return [{ name: '⚙ Reductor cicloidal 10:1', doc: cycloidalReducerDoc }];
}
// Biblioteca de piezas en localStorage (nombre → DocState). Persiste entre sesiones.
const LIB_KEY = 'forja:library:v1';
function readLib(): Record<string, DocState> {
  try { return JSON.parse(localStorage.getItem(LIB_KEY) || '{}'); } catch { return {}; }
}
function writeLib(lib: Record<string, DocState>) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch { /* cuota llena */ }
}

/**
 * Etiqueta semántica de una cara para la lista determinista (Playwright):
 * superior/inferior por la normal en Z (planos), lateral para el resto. Permite
 * que el test elija "la cara superior" sin depender de coordenadas del viewport.
 */
function faceLabel(f: FaceRef): string {
  if (f.kind === 'plane') {
    const nz = f.normal[2];
    if (nz > 0.7) return 'superior';
    if (nz < -0.7) return 'inferior';
    return 'lateral';
  }
  return f.kind === 'cylinder' ? 'cilíndrica' : f.kind;
}

/** Gradiente CSS de la barra de escala FEA: muestrea el MISMO jet del overlay. */
function feaLegendGradient(): string {
  const stops: string[] = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const [r, g, b] = jetColor(i / N);
    const c = `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
    stops.push(`${c} ${((i / N) * 100).toFixed(0)}%`);
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

// ──────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────
export default function ForgeBRepStudio() {
  const [oc, setOc] = useState<OC | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [opErr, setOpErr] = useState<string | null>(null);

  const [sketch, setSketch] = useState<SketchFeature>({
    id: 'sketch', kind: 'rect', width: 40, height: 24, radius: 14, legW: 10,
    // Perfil de revolución por defecto: 3 escalones (flecha con hombros).
    steps: [{ r: 10, L: 20 }, { r: 15, L: 30 }, { r: 10, L: 20 }],
    // Engrane de involuta por defecto (m=2, Z=20, α=20°, espesor 10, barreno 8).
    gear: { ...GEAR_DEFAULTS },
    gearbox: { ...GEARBOX_DEFAULTS },
  });
  // El grafo arranca con un extrude (el "primer momento": sketch→sólido).
  const [ops, setOps] = useState<Op[]>([
    { id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false },
  ]);
  // Inicializador LAZY: `ops[0].id` se evaluaría en CADA render con la forma
  // eager y reventaría al vaciar el documento (ops=[] → ops[0] undefined). Con
  // `() => …` solo corre al montar, y el `?.` cubre un arranque sin ops.
  const [activeOp, setActiveOp] = useState<string | null>(() => ops[0]?.id ?? null);
  const [material, setMaterial] = useState<keyof typeof MATERIALS>('alu');
  // ENSAMBLE de dos engranes engranados (la caja de velocidades). Vacío hasta
  // que el diseñador agrega el 2º engrane (btn-add-gear2) y aplica el mate.
  const [assembly, setAssembly] = useState<AssemblyState>({ ...ASSEMBLY_DEFAULTS });
  // Resultado del BARRIDO de verificación de embonado (btn-verificar-embonado):
  // max(Common) sobre un paso de diente. null hasta que se corre la verificación.
  type SweepResult = ReturnType<typeof sweepMeshingInterference>;
  const [meshSweep, setMeshSweep] = useState<SweepResult | null>(null);
  const [meshSweepBusy, setMeshSweepBusy] = useState(false);

  const [result, setResult] = useState<BuildResult | null>(null);
  const [building, setBuilding] = useState(false);
  const [showSketch, setShowSketch] = useState(true);
  const [hideChrome, setHideChrome] = useState(false);
  const [pickMode, setPickMode] = useState<'none' | 'face' | 'edge'>('none');
  // ── UI: paneles colapsables + menú de opciones + renombrar nodo in-place ──
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggleCollapse = useCallback((id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] })), []);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  // ── P1: rollback (construir hasta op N) + menú contextual (clic derecho) ──
  // rollbackIdx = nº de ops a construir (null = punta/todas). Permite editar a la
  // mitad de la historia viendo el sólido en ese punto (paridad Timeline marker).
  const [rollbackIdx, setRollbackIdx] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; opId: string } | null>(null);
  // ── PARÁMETROS con ecuaciones (Change Parameters de Fusion) ──
  const [params, setParams] = useState<Param[]>([]);
  const [bindings, setBindings] = useState<Record<string, string>>({});
  const [paramsOpen, setParamsOpen] = useState(false);
  // ── ENSAMBLE: componentes posicionados (bloques/cilindros) ──
  const [components, setComponents] = useState<Component[]>([]);
  const [activeComp, setActiveComp] = useState<string | null>(null);
  const addComponent = useCallback((kind: 'box' | 'cyl') => {
    const c: Component = { id: newId('comp'), name: kind === 'box' ? 'Bloque' : 'Cilindro', kind, w: 60, d: 60, h: 60, r: 25, x: 0, y: 0, z: 0, rz: 0 };
    setComponents((cur) => [...cur, c]);
    setActiveComp(c.id); setActiveOp(null);
  }, []);
  const updateComponent = useCallback((id: string, patch: Partial<Component>) => {
    setComponents((cur) => cur.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);
  const removeComponent = useCallback((id: string) => {
    setComponents((cur) => cur.filter((c) => c.id !== id)); setActiveComp(null);
  }, []);
  // ── IMPORTAR STEP: si está, REEMPLAZA la pieza principal (sketch/ops) por el
  // sólido importado (step.parts u otra fuente open). El texto STEP se guarda en
  // el DocState → se persiste en la biblioteca como cualquier pieza. ──
  const [importedStep, setImportedStep] = useState<string | null>(null);
  // ── GUARDAR / CARGAR (biblioteca de piezas) ──
  const [docName, setDocName] = useState('Pieza 1');
  const [libNames, setLibNames] = useState<string[]>([]);
  const refreshLib = useCallback(() => setLibNames(Object.keys(readLib()).sort()), []);
  const resolvedParams = useMemo<ResolvedParams>(() => resolveParams(params), [params]);
  const setBinding = useCallback((key: string, expr: string | null) => {
    setBindings((b) => {
      if (expr == null) { const n = { ...b }; delete n[key]; return n; }
      return { ...b, [key]: expr };
    });
  }, []);
  const bindCtx = useMemo<BindCtxT>(() => ({ scope: resolvedParams.scope, bindings, setBinding }), [resolvedParams, bindings, setBinding]);
  // Mutadores de la tabla de parámetros.
  const addParam = useCallback(() => {
    setParams((p) => {
      let n = p.length + 1; let name = `p${n}`;
      const used = new Set(p.map((x) => x.name));
      while (used.has(name)) { n++; name = `p${n}`; }
      return [...p, { id: newId('param'), name, expr: '10' }];
    });
  }, []);
  const updateParam = useCallback((id: string, patch: Partial<Param>) => {
    setParams((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  }, []);
  const removeParam = useCallback((id: string) => setParams((p) => p.filter((x) => x.id !== id)), []);
  // Documento RESUELTO: ops + sketch con las cotas ligadas ya evaluadas. Es lo
  // que se construye (rebuild/FEA/generativo usan esto, no las cotas crudas).
  const boundDoc = useMemo(
    () => applyBindings(ops, sketch, bindings, resolvedParams.scope),
    [ops, sketch, bindings, resolvedParams],
  );
  // Click-to-place del barreno: tras pulsar B / el botón Hole, el SIGUIENTE clic en
  // una cara fija el centro (x,y) del barreno en ese punto (no en sliders). El ref
  // lo lee el callback de picking sin closure viejo; el estado alimenta el hint.
  const placingHoleRef = useRef<string | null>(null);
  const [placingHole, setPlacingHole] = useState(false);
  // Editor de croquis 2D (dibujar perfil con restricciones, kind 'custom').
  const [sketchOpen, setSketchOpen] = useState(false);

  // ── SIMULACIÓN FEA (von Mises real sobre el sólido) ──
  // Caras de borde elegidas por face-picking: la FIJA (empotramiento u=0) y la
  // de CARGA (fuerza repartida). El destino del próximo clic de cara lo decide
  // feaPickTarget ('fija' | 'carga'); null = el picking va a la selección normal.
  const [feaFixedFace, setFeaFixedFace] = useState<number | null>(null);
  const [feaLoadFace, setFeaLoadFace] = useState<number | null>(null);
  const [feaPickTarget, setFeaPickTarget] = useState<'fija' | 'carga' | null>(null);
  const [feaLoadN, setFeaLoadN] = useState(500); // magnitud de carga [N]
  const [feaResult, setFeaResult] = useState<FEAResult | null>(null);
  const [feaColors, setFeaColors] = useState<Float32Array | null>(null);
  const [feaBusy, setFeaBusy] = useState(false);
  const [feaErr, setFeaErr] = useState<string | null>(null);
  // ── FEA INCREMENTAL ("análisis mientras diseñas") ──
  // La sesión cachea la parte cara (malla + K + B); cambiar SOLO la carga reusa la
  // sesión y re-resuelve con warm-start (rápido). feaDirRef = dirección unitaria de
  // la carga; feaSigRef = firma de geometría/material para invalidar la sesión.
  const feaSessionRef = useRef<FEASession | null>(null);
  const feaDirRef = useRef<[number, number, number]>([0, 0, -1]);
  const feaSigRef = useRef<string>('');
  const [feaLiveMs, setFeaLiveMs] = useState<number | null>(null);
  // ── DISEÑO GENERATIVO (optimización topológica) ──
  const [genResult, setGenResult] = useState<TopOptResult | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [genVolfrac, setGenVolfrac] = useState(0.4);   // fracción de material objetivo
  const [genThreshold, setGenThreshold] = useState(0.4); // umbral de densidad visible
  const [genSmooth, setGenSmooth] = useState(true);      // superficie suave (orgánica) vs voxeles crudos
  // Picking de cara/arista pero dirigido al panel FEA (no a la op activa).
  const feaPickTargetRef = useRef<'fija' | 'carga' | null>(null);
  feaPickTargetRef.current = feaPickTarget;
  // Última CARA elegida por clic (índice estable OCCT) — se resalta SIEMPRE y se
  // muestra en el HUD, independiente de que haya una op de Shell activa.
  const [selectedFaceId, setSelectedFaceId] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const stepBlobUrl = useRef<string | null>(null);
  const stepTextRef = useRef<string | null>(null);   // STEP del sólido actual (driver QA)
  // Eje de revolución resuelto desde la arista RECTA clicada (su EdgeGeom.axis).
  // Un ref para que `rebuild` lo lea SIN re-crear el callback en cada clic.
  const edgeAxisRef = useRef<RevolveAxis | null>(null);
  // Último resultado en un ref: los callbacks de picking leen las EdgeGeom
  // actuales sin depender de `result` (evita re-crear handlers en cada rebuild).
  const resultRef = useRef<BuildResult | null>(null);

  // Perfil vivo (ghost del sketch base).
  const profilePts = useMemo<Pt2[]>(() => {
    if (sketch.kind === 'rect') return rectProfile(sketch.width, sketch.height);
    if (sketch.kind === 'lprofile') return lProfile(sketch.width, sketch.height, sketch.legW);
    if (sketch.kind === 'revprofile') return revProfile(sketch.steps);
    if (sketch.kind === 'gear') return gearProfile(sketch.gear);
    if (sketch.kind === 'custom') return sketch.customProfile ?? [];
    return circleGhost(sketch.radius);
  }, [sketch]);

  // ── Boot del kernel ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const instance = await initOCCT();
        if (!alive) return;
        _setActiveOCCT(instance);
        setOc(instance);
      } catch (e) {
        if (!alive) return;
        setBootErr(String((e as Error)?.message ?? e));
      }
    })();
    return () => { alive = false; };
  }, []);

  // ── Replay del grafo → malla + invariantes + análisis de masa ──
  const rebuild = useCallback(() => {
    if (!oc) return;
    setBuilding(true);
    setOpErr(null);
    requestAnimationFrame(() => {
      try {
        // ── MODO ENSAMBLE: dos engranes engranados (sketch=gear + 2º agregado) ──
        const isAssembly = assembly.enabled && sketch.kind === 'gear';
        let shape: Shape;
        let assemblyResult: AssemblyResult | undefined;
        if (isAssembly) {
          const built = buildAssembly(oc, sketch.gear, assembly);
          shape = built.compound;
          assemblyResult = built.assembly;
        } else {
          // PARÁMETROS: construye con las cotas ligadas ya resueltas (boundDoc).
          // ROLLBACK: construye solo las primeras `rollbackIdx` ops (null = todas).
          const builtOps = rollbackIdx == null ? boundDoc.ops : boundDoc.ops.slice(0, Math.max(1, rollbackIdx));
          // ENSAMBLE: pieza principal (si construye) + componentes → compound.
          // Si hay un STEP importado, ÉSE es la pieza principal (ignora sketch/ops).
          let mainShape: Shape | null = null;
          try {
            mainShape = importedStep
              ? importSTEP(oc, importedStep)
              : buildShape(oc, boundDoc.sketch, builtOps, edgeAxisRef.current);
          } catch (e) { if (components.length === 0) throw e; } // sin componentes, propaga
          const parts: Shape[] = [];
          if (mainShape) parts.push(mainShape);
          for (const c of components) parts.push(buildComponent(oc, c));
          if (parts.length === 0) throw new Error('Documento vacío: agrega Extrude/Revolve o un Componente.');
          shape = parts.length === 1 ? parts[0] : makeCompound(oc, parts);
        }

        const mesh = tessellate(oc, shape, 0.08, 0.3);
        const topo = topology(oc, shape);
        const volKernel = volume(oc, shape);
        const area = surfaceArea(oc, shape);
        const mass = massProperties(oc, shape, MATERIALS[material].density);
        const faces = enumerateFaces(oc, shape);
        const edges = enumerateEdges(oc, shape);
        const edgeGeoms = enumerateEdgesGeom(oc, shape);
        const step = exportSTEP(oc, shape, 'forja-part.step');
        stepTextRef.current = step;

        if (stepBlobUrl.current) URL.revokeObjectURL(stepBlobUrl.current);
        stepBlobUrl.current = URL.createObjectURL(
          new Blob([step], { type: 'application/step' }),
        );

        const built: BuildResult = { mesh, topo, volKernel, area, stepBytes: step.length, mass, faces, edges, edgeGeoms, assembly: assemblyResult };
        resultRef.current = built;
        setResult(built);
        shape.delete?.();
      } catch (e) {
        setOpErr(String((e as Error)?.message ?? e));
      } finally {
        setBuilding(false);
      }
    });
  }, [oc, boundDoc, sketch.gear, sketch.kind, material, assembly, rollbackIdx, components, importedStep]);

  useEffect(() => { if (oc) rebuild(); }, [oc, rebuild]);

  // ── UNDO / REDO ──────────────────────────────────────────────────────
  // Historial del documento {sketch,ops,material,assembly}. Las mutaciones
  // reemplazan refs inmutables, así que un snapshot es captura superficial de
  // las 4 refs. Un efecto observa los cambios y empuja el estado ANTERIOR a
  // `past`; undo/redo restauran un snapshot marcando applyingRef para no
  // re-capturar el propio salto.
  type DocSnap = { sketch: SketchFeature; ops: Op[]; material: keyof typeof MATERIALS; assembly: AssemblyState; params: Param[]; bindings: Record<string, string>; components: Component[] };
  const histRef = useRef<{ past: DocSnap[]; future: DocSnap[]; last: DocSnap | null }>({ past: [], future: [], last: null });
  const applyingRef = useRef(false);
  const [histVer, setHistVer] = useState(0);
  useEffect(() => {
    const snap: DocSnap = { sketch, ops, material, assembly, params, bindings, components };
    const h = histRef.current;
    if (applyingRef.current) { applyingRef.current = false; h.last = snap; return; }
    if (h.last === null) { h.last = snap; return; } // montaje inicial: no es un cambio
    h.past.push(h.last);
    if (h.past.length > 120) h.past.shift();
    h.future = [];
    h.last = snap;
    setHistVer((v) => v + 1);
  }, [sketch, ops, material, assembly, params, bindings, components]);
  const applySnap = useCallback((s: DocSnap) => {
    applyingRef.current = true;
    setSketch(s.sketch); setOps(s.ops); setMaterial(s.material); setAssembly(s.assembly);
    setParams(s.params); setBindings(s.bindings); setComponents(s.components);
    setActiveOp((a) => (a && s.ops.some((o) => o.id === a)) ? a : (s.ops[0]?.id ?? null));
    setHistVer((v) => v + 1);
  }, []);
  const undo = useCallback(() => {
    const h = histRef.current;
    if (!h.past.length || h.last == null) return;
    const prev = h.past.pop()!;
    h.future.push(h.last);
    applySnap(prev);
  }, [applySnap]);
  const redo = useCallback(() => {
    const h = histRef.current;
    if (!h.future.length || h.last == null) return;
    const nxt = h.future.pop()!;
    h.past.push(h.last);
    applySnap(nxt);
  }, [applySnap]);
  const canUndo = useMemo(() => { void histVer; return histRef.current.past.length > 0; }, [histVer]);
  const canRedo = useMemo(() => { void histVer; return histRef.current.future.length > 0; }, [histVer]);
  // Ctrl+Z = undo · Ctrl+Y / Ctrl+Shift+Z = redo (ignora si se escribe en un input).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((e.ctrlKey || e.metaKey) && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ── GUARDAR / CARGAR: serializa TODO el documento y lo restaura ──
  const serializeDoc = useCallback((): DocState => ({
    version: 1, name: docName, sketch, ops, material, assembly, params, bindings, components, importedStep,
  }), [docName, sketch, ops, material, assembly, params, bindings, components, importedStep]);
  const loadDoc = useCallback((d: Partial<DocState>) => {
    // Restaura el estado y REINICIA el historial (no se deshace hacia otra pieza).
    histRef.current = { past: [], future: [], last: null };
    applyingRef.current = true;
    setSketch(d.sketch ?? { ...DEFAULT_SKETCH, gear: { ...GEAR_DEFAULTS } });
    const nops = d.ops && d.ops.length ? d.ops : makeDefaultDoc().ops;
    setOps(nops);
    setMaterial(d.material ?? 'alu');
    setAssembly(d.assembly ?? { ...ASSEMBLY_DEFAULTS });
    setParams(d.params ?? []); setBindings(d.bindings ?? {}); setComponents(d.components ?? []);
    setImportedStep(d.importedStep ?? null);
    setActiveOp(nops[0]?.id ?? null); setActiveComp(null); setRollbackIdx(null);
    if (d.name) setDocName(d.name);
    setHistVer((v) => v + 1);
  }, []);
  const newDoc = useCallback(() => { loadDoc(makeDefaultDoc('Pieza nueva')); }, [loadDoc]);
  const saveToLibrary = useCallback(() => {
    const lib = readLib(); lib[docName.trim() || 'Sin nombre'] = serializeDoc(); writeLib(lib); refreshLib();
  }, [docName, serializeDoc, refreshLib]);
  const loadFromLibrary = useCallback((name: string) => {
    const d = readLib()[name]; if (d) loadDoc(d);
  }, [loadDoc]);
  const deleteFromLibrary = useCallback((name: string) => {
    const lib = readLib(); delete lib[name]; writeLib(lib); refreshLib();
  }, [refreshLib]);
  const exportDocFile = useCallback(() => {
    const safe = (docName.trim() || 'pieza').replace(/[^\w.-]+/g, '_');
    triggerDownload(new Blob([JSON.stringify(serializeDoc(), null, 2)], { type: 'application/json' }), `${safe}.forja.json`);
  }, [docName, serializeDoc]);
  const importDocFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => { try { loadDoc(JSON.parse(String(reader.result)) as DocState); } catch { /* json inválido */ } };
    reader.readAsText(file);
  }, [loadDoc]);
  // ── IMPORTAR STEP (step.parts u otra fuente open) → pieza principal ──
  const importStepText = useCallback((text: string, name?: string) => {
    setImportedStep(text);
    if (name) setDocName(name.replace(/\.(stp|step)$/i, ''));
  }, []);
  const importStepFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => importStepText(String(reader.result), file.name);
    reader.readAsText(file);
  }, [importStepText]);
  const clearImportedStep = useCallback(() => setImportedStep(null), []);

  // Al cambiar la ESTRUCTURA del documento (nº de ops) la topología cambia y los
  // índices de cara/arista dejan de ser válidos: limpia la selección puntual.
  const opCount = ops.length;
  useEffect(() => { setSelectedFaceId(null); setSelectedEdgeId(null); }, [opCount]);
  // Si el marcador de rollback cubre todas (o más) las ops, vuelve a la punta.
  useEffect(() => { setRollbackIdx((r) => (r != null && r >= opCount ? null : r)); }, [opCount]);

  // Tecla H: chrome on/off.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'h' || e.key === 'H') setHideChrome((v) => !v);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Mutadores del PERFIL ESCALONADO de revolución (croquis poligonal) ──
  const updateStep = useCallback((i: number, patch: Partial<RevStep>) => {
    setSketch((s) => ({ ...s, steps: s.steps.map((st, k) => (k === i ? { ...st, ...patch } : st)) }));
  }, []);
  const addStep = useCallback(() => {
    setSketch((s) => ({ ...s, steps: [...s.steps, { r: 10, L: 20 }] }));
  }, []);
  const removeStep = useCallback((i: number) => {
    setSketch((s) => (s.steps.length <= 1 ? s : { ...s, steps: s.steps.filter((_, k) => k !== i) }));
  }, []);
  // Aplica un perfil escalonado completo de una vez (atajo determinista para QA:
  // cilindro = 1 escalón; flecha = 3 escalones). Sigue siendo estado de UI.
  const setSteps = useCallback((steps: RevStep[]) => {
    setSketch((s) => ({ ...s, kind: 'revprofile', steps }));
  }, []);

  // ── Mutadores del croquis de ENGRANE (7º clásico) ──
  const updateGear = useCallback((patch: Partial<GearParams>) => {
    setSketch((s) => ({ ...s, gear: { ...s.gear, ...patch } }));
  }, []);
  // Aplica un engrane completo de una vez (atajo determinista para QA). Pasa el
  // croquis a 'gear' y, si el grafo no tiene un extrude que lo solidifique, lo
  // garantiza (un único extrude = el feature 'Engrane': perfil→sólido→barreno).
  const setGear = useCallback((patch: Partial<GearParams>) => {
    setSketch((s) => ({ ...s, kind: 'gear', gear: { ...s.gear, ...patch } }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
  }, []);

  // ── Mutadores del grafo ──
  const updateOp = useCallback((id: string, patch: Partial<Op>) => {
    setOps((cur) => cur.map((o) => (o.id === id ? ({ ...o, ...patch } as Op) : o)));
  }, []);
  const addOp = useCallback((type: OpType) => {
    let op: Op;
    const ex = (ops.find((o) => o.type === 'extrude') as ExtrudeOp | undefined)?.depth ?? 12;
    switch (type) {
      case 'extrude': op = { id: newId('extrude'), type, depth: 12, symmetric: false }; break;
      case 'hole': op = { id: newId('hole'), type, x: 0, y: 0, diameter: 8, through: true, depth: ex }; break;
      case 'fillet': op = { id: newId('fillet'), type, radius: 3, edges: [] }; break;
      case 'chamfer': op = { id: newId('chamfer'), type, dist: 2, edges: [] }; break;
      case 'shell': op = { id: newId('shell'), type, thickness: 2, faces: [] }; break;
      case 'revolve': op = { id: newId('revolve'), type, angle: 360, axis: 'y' }; break;
      case 'pattern': op = { id: newId('pattern'), type, mode: 'linear', count: 3, dx: 30, dy: 0, angleSpan: 360, axis: 'z', plane: 'yz' }; break;
      case 'pocket': op = { id: newId('pocket'), type, profile: 'rect', x: 0, y: 0, w: 12, h: 8, diameter: 8, depth: ex, through: true }; break;
    }
    setOps((cur) => [...cur, op]);
    setActiveOp(op.id);
    if (type === 'fillet' || type === 'chamfer') setPickMode('edge');
    else if (type === 'shell') setPickMode('face');
    else setPickMode('none');
  }, [ops]);
  const removeOp = useCallback((id: string) => {
    setOps((cur) => {
      const next = cur.filter((o) => o.id !== id);
      // Si al borrar ya no queda un sólido BASE (extrude/revolve), las ops
      // dependientes (hole/fillet/chamfer/shell) quedan HUÉRFANAS → se purgan:
      // un barreno/redondeo no puede existir sin el cuerpo sobre el que opera.
      const hasBase = next.some((o) => o.type === 'extrude' || o.type === 'revolve');
      return hasBase ? next : next.filter((o) => o.type === 'extrude' || o.type === 'revolve');
    });
    setActiveOp(null);
    setPickMode('none');
  }, []);
  // RENOMBRAR un nodo del árbol (doble-clic) — nombre vacío vuelve al autotítulo.
  const renameOp = useCallback((id: string, name: string) => {
    setOps((cur) => cur.map((o) => (o.id === id ? { ...o, name: name.trim() || undefined } : o)));
  }, []);
  // SUPRIMIR / reactivar un nodo (ojo) — lo salta buildShape sin borrarlo.
  const toggleSuppressOp = useCallback((id: string) => {
    setOps((cur) => cur.map((o) => (o.id === id ? { ...o, suppressed: !o.suppressed } : o)));
  }, []);
  // REORDENAR (↑/↓): intercambia ops adyacentes → cambia el orden de CÁLCULO
  // (p.ej. fillet antes/después de un hole da resultados distintos). El sólido
  // base (extrude/revolve) buildShape lo procesa primero de todos modos.
  const moveOp = useCallback((id: string, dir: -1 | 1) => {
    setOps((cur) => {
      const i = cur.findIndex((o) => o.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = cur.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);
  // ROLLBACK: construir el sólido solo hasta la op `n` (1..ops.length). null=punta.
  const rollTo = useCallback((n: number | null) => {
    setRollbackIdx((prev) => {
      if (n === null) return null;
      return prev === n ? null : n; // re-clic en el mismo punto = restaurar punta
    });
  }, []);
  // Barreno POR CLIC (como un humano): crea el hole y entra a modo colocación →
  // el siguiente clic en una cara fija su centro. Reemplaza teclear x,y en sliders.
  const startHole = useCallback(() => {
    const ex = (ops.find((o) => o.type === 'extrude') as ExtrudeOp | undefined)?.depth ?? 12;
    const op: HoleOp = { id: newId('hole'), type: 'hole', x: 0, y: 0, diameter: 8, through: true, depth: ex };
    setOps((cur) => [...cur, op]);
    setActiveOp(op.id);
    placingHoleRef.current = op.id;
    setPlacingHole(true);
    setPickMode('face');
  }, [ops]);
  // Editor de croquis: al Terminar, el perfil dibujado (resuelto por el solver) pasa
  // a kind 'custom' y se garantiza un extrude que lo solidifica.
  const onSketchFinish = useCallback((result: { profile: Pt2[]; holes: { x: number; y: number; d: number }[] }) => {
    setSketch((s) => ({ ...s, kind: 'custom', customProfile: result.profile }));
    setOps((cur) => {
      const next: Op[] = cur.some((o) => o.type === 'extrude')
        ? [...cur]
        : [...cur, { id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }];
      // Cada círculo del croquis → un barreno pasante en su centro (mismo plano local).
      for (const h of result.holes) {
        next.push({ id: newId('hole'), type: 'hole', x: h.x, y: h.y, diameter: h.d, through: true, depth: 12 });
      }
      return next;
    });
    setActiveOp(null);
    setSketchOpen(false);
  }, []);

  // ── Feature ENGRANE (botón btn-gear): pasa el croquis a 'gear', garantiza el
  // extrude que lo solidifica (perfil de involuta → sólido → resta del barreno)
  // y enfoca el panel del croquis para editar m/Z/α/espesor/barreno. El
  // FeatureNode resultante en el grafo es el Sketch 'Engrane' + su Extrude. ──
  const applyGear = useCallback(() => {
    setSketch((s) => ({ ...s, kind: 'gear' }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
    setActiveOp('sketch');
    setPickMode('none');
  }, []);
  // ── CAJA cicloidal multi-disco (btn-gearbox) ──
  const applyGearbox = useCallback(() => {
    setSketch((s) => ({ ...s, kind: 'gearbox' }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
    setActiveOp('sketch'); setActiveComp(null); setPickMode('none');
  }, []);
  const updateGearbox = useCallback((patch: Partial<GearboxParams>) => {
    setSketch((s) => ({ ...s, gearbox: { ...s.gearbox, ...patch } }));
  }, []);

  // ── ENSAMBLE: agregar el 2º engrane (btn-add-gear2). Garantiza que el sketch
  // base sea un engrane (si no lo es, lo convierte) y enciende la 2ª instancia.
  // El engrane 2 hereda m/α/espesor del 1; solo cambia Z₂. Aún SIN mate (φ₂=0):
  // se ve a C pero punta-contra-punta hasta que se aplique btn-gear-mate. ──
  const addGear2 = useCallback(() => {
    setSketch((s) => ({ ...s, kind: 'gear' }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
    setAssembly((a) => ({ ...a, enabled: true }));
    setActiveOp('sketch');
    setPickMode('none');
  }, []);
  const setTeeth2 = useCallback((z: number) => {
    // Cambiar Z₂ rompe el faseo previo: hay que re-aplicar el mate.
    setAssembly((a) => ({ ...a, teeth2: Math.round(z), mated: false }));
  }, []);
  // Aplica el MATE de engrane: posiciona el engrane 2 a C = m(Z₁+Z₂)/2 y lo
  // FASEA φ₂ = π − π/Z₂ para que los dientes embonen. (La geometría la hace
  // buildAssembly; aquí solo marcamos `mated` y el rebuild la recalcula.)
  const applyGearMate = useCallback(() => {
    setAssembly((a) => ({ ...a, enabled: true, mated: true }));
  }, []);
  const removeGear2 = useCallback(() => {
    setAssembly((a) => ({ ...a, enabled: false, mated: false }));
    setMeshSweep(null);
  }, []);

  // ── DRIVER CINEMÁTICO: ángulo de entrada θ (rad). Gira la entrada θ y la
  // salida −θ·(Z₁/Z₂) (lo resuelve buildAssembly). El slider expone θ en GRADOS;
  // aquí lo guardamos en radianes. Cambiar θ NO invalida el faseo: el embonado se
  // mantiene en todo el giro (la cinemática suma a φ₂). ──
  const setDriveAngleDeg = useCallback((deg: number) => {
    setAssembly((a) => ({ ...a, driveAngle: (deg * Math.PI) / 180 }));
  }, []);

  // ── MONTAJE DE COMPONENTES (flechas / carcasa). Mismo efecto que los checkboxes
  // de UI; expuesto en el API para que el QA pueda montarlos de forma determinista. ──
  const setShafts = useCallback((on: boolean) => {
    setAssembly((a) => ({ ...a, shafts: on }));
  }, []);
  const setHousing = useCallback((on: boolean) => {
    setAssembly((a) => ({ ...a, housing: on }));
  }, []);

  // ── VERIFICACIÓN RIGUROSA DE EMBONADO (el invariante CLAVE). Corre el barrido
  // de Common(g1,g2) sobre un paso de diente y guarda max_interferencia. El botón
  // btn-verificar-embonado dispara esto; Playwright lee max-interferencia del DOM.
  const verifyMeshing = useCallback(() => {
    if (!oc || sketch.kind !== 'gear' || !assembly.enabled) return;
    setMeshSweepBusy(true);
    // requestAnimationFrame: deja pintar el "calculando…" antes del barrido pesado.
    requestAnimationFrame(() => {
      try {
        const sweep = sweepMeshingInterference(oc, sketch.gear, assembly.teeth2, 10);
        setMeshSweep(sweep);
      } catch (e) {
        setOpErr(String((e as Error)?.message ?? e));
      } finally {
        setMeshSweepBusy(false);
      }
    });
  }, [oc, sketch.kind, sketch.gear, assembly.enabled, assembly.teeth2]);

  // ── CORRER EL FEA (botón btn-fea): reconstruye el sólido, monta las BC del
  // face-pick (cara fija = empotramiento u=0; cara de carga = fuerza repartida a
  // lo largo de su normal, magnitud input-carga en N), corre malla→solve→von
  // Mises (runFEA, que REUSA el motor de src/lib/formulas.ts) y colorea la malla
  // de render por el campo nodal (vonMisesVertexColors). El material elástico
  // (E, ν, σ_y) sale de MATERIAL_DATABASE vía FEA_MATERIAL_KEY. ──
  const runFeaAnalysis = useCallback((loadDirOverride?: [number, number, number]) => {
    if (!oc || feaFixedFace == null) {
      setFeaErr(feaFixedFace == null ? 'Elige una cara FIJA (btn-pick-fija).' : 'Kernel no listo.');
      return;
    }
    setFeaBusy(true);
    setFeaErr(null);
    setGenResult(null); // el FEA pinta sobre el sólido → quita el render generativo
    requestAnimationFrame(() => {
      let shape: Shape | null = null;
      try {
        // Reconstruye el MISMO sólido del documento (rebuild ya borró su Shape).
        const isAssembly = assembly.enabled && sketch.kind === 'gear';
        shape = isAssembly
          ? buildAssembly(oc, sketch.gear, assembly).compound
          : buildShape(oc, boundDoc.sketch, boundDoc.ops, edgeAxisRef.current);

        // Dirección de la carga = normal OCCT de la cara de carga (si es plana);
        // si no hay cara de carga o su normal es degenerada, empuja en −Z (peso).
        const faces = enumerateFaces(oc, shape);
        let dir: [number, number, number] = [0, 0, -1];
        if (Array.isArray(loadDirOverride) && Math.hypot(...loadDirOverride) > 1e-6) {
          // Dirección de carga EXPLÍCITA (p.ej. carga TRANSVERSAL al eje de la
          // viga sobre la cara libre = caso cantilever canónico). Tiene prioridad
          // sobre la normal de la cara. Misma física: la fuerza total se reparte
          // a los nodos de la cara de carga en runFEA.
          dir = loadDirOverride;
        } else if (feaLoadFace != null) {
          const lf = faces.find((f) => f.index === feaLoadFace);
          if (lf && Math.hypot(lf.normal[0], lf.normal[1], lf.normal[2]) > 1e-6) {
            dir = [lf.normal[0], lf.normal[1], lf.normal[2]];
          }
        }
        const dlen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
        const dirUnit: [number, number, number] = [dir[0] / dlen, dir[1] / dlen, dir[2] / dlen];
        const F = feaLoadN;

        const bc: FaceBC = {
          fixedFaces: [feaFixedFace],
          loadFaces: feaLoadFace != null ? [feaLoadFace] : [],
        };
        // Prepara la SESIÓN (caro: malla + K + B, se cachea) y resuelve la carga
        // (barato). Cambiar luego solo la magnitud reusa la sesión (feaLiveSetLoad).
        const matKey = FEA_MATERIAL_KEY[material] ?? 'aluminio_6061';
        const session = prepareFeaSession(oc, shape, bc, { material: matKey, resolution: 18 });
        feaSessionRef.current = session;
        feaDirRef.current = dirUnit;
        feaSigRef.current = `${sketch.kind}|${opCount}|${matKey}|${feaFixedFace}|${feaLoadFace}`;
        const res = solveLoadOnSession(session, { totalForce: [dirUnit[0] * F, dirUnit[1] * F, dirUnit[2] * F] });

        // Colorea la malla de RENDER (la teselada que se ve) por von Mises.
        const renderPos = resultRef.current?.mesh.positions;
        if (renderPos) {
          const { colors } = vonMisesVertexColors(res, renderPos);
          setFeaColors(colors);
        }
        setFeaResult(res);
      } catch (e) {
        setFeaErr(String((e as Error)?.message ?? e));
        setFeaResult(null);
        setFeaColors(null);
      } finally {
        shape?.delete?.();
        setFeaBusy(false);
      }
    });
  }, [oc, feaFixedFace, feaLoadFace, feaLoadN, material, assembly, sketch, ops, boundDoc, opCount]);

  // ── FEA EN VIVO: cambia SOLO la magnitud de la carga reusando la sesión cacheada
  // + warm-start del CG. Es el "análisis mientras diseñas": mover el slider repinta
  // el von Mises en milisegundos sin re-mallar ni re-ensamblar. Si no hay sesión
  // (aún no corriste el FEA una vez), cae al análisis completo. ──
  const feaLiveSetLoad = useCallback((N: number) => {
    setFeaLoadN(N);
    const session = feaSessionRef.current;
    if (!session) { runFeaAnalysis(); return; }
    const d = feaDirRef.current;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    const res = solveLoadOnSession(session, { totalForce: [d[0] * N, d[1] * N, d[2] * N] });
    const ms = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    const renderPos = resultRef.current?.mesh.positions;
    if (renderPos) { const { colors } = vonMisesVertexColors(res, renderPos); setFeaColors(colors); }
    setFeaResult(res);
    setFeaLiveMs(ms);
  }, [runFeaAnalysis]);

  // ── DISEÑO GENERATIVO: misma cara fija + cara de carga del FEA; corre la
  // optimización topológica (topopt.ts) y muestra la estructura óptima vaciada. ──
  const runGenerative = useCallback((loadDirOverride?: [number, number, number]) => {
    if (!oc || feaFixedFace == null) { setGenErr('Elige una cara FIJA (btn-pick-fija) y una de carga.'); return; }
    setGenBusy(true); setGenErr(null);
    requestAnimationFrame(() => {
      let shape: Shape | null = null;
      try {
        const isAssembly = assembly.enabled && sketch.kind === 'gear';
        shape = isAssembly ? buildAssembly(oc, sketch.gear, assembly).compound : buildShape(oc, boundDoc.sketch, boundDoc.ops, edgeAxisRef.current);
        const faces = enumerateFaces(oc, shape);
        let dir: [number, number, number] = [0, 0, -1];
        if (Array.isArray(loadDirOverride) && Math.hypot(...loadDirOverride) > 1e-6) dir = loadDirOverride;
        else if (feaLoadFace != null) {
          const lf = faces.find((f) => f.index === feaLoadFace);
          if (lf && Math.hypot(lf.normal[0], lf.normal[1], lf.normal[2]) > 1e-6) dir = [lf.normal[0], lf.normal[1], lf.normal[2]];
        }
        const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1; const F = feaLoadN;
        const bc: FaceBC = { fixedFaces: [feaFixedFace], loadFaces: feaLoadFace != null ? [feaLoadFace] : [], totalForce: [dir[0] / dl * F, dir[1] / dl * F, dir[2] / dl * F] };
        const res = runTopOpt(oc, shape, bc, FEA_MATERIAL_KEY[material] ?? 'aluminio_6061',
          { volfrac: genVolfrac, penal: 3, rmin: 1.5, ft: 1, maxLoops: 40, tolChange: 0.02, resolution: 12 });
        setFeaColors(null); setFeaResult(null);   // generativo manda el render
        setGenResult(res);
      } catch (e) { setGenErr(String((e as Error)?.message ?? e)); setGenResult(null); }
      finally { shape?.delete?.(); setGenBusy(false); }
    });
  }, [oc, feaFixedFace, feaLoadFace, feaLoadN, material, assembly, sketch, ops, boundDoc, genVolfrac]);
  const clearGenerative = useCallback(() => setGenResult(null), []);
  // EXPORTAR STL (manufacturable): si hay resultado generativo, exporta la
  // SUPERFICIE vaciada (densityToMesh, misma que se ve); si no, el sólido B-Rep
  // teselado. Va al menú ⋮ Opciones, junto al STEP.
  const exportSTL = useCallback(() => {
    if (genResult) {
      const { positions, indices } = densityToMesh(genResult, genThreshold, 6);
      triggerDownload(meshToStlBlob(positions, indices), 'forja-generativo.stl');
    } else if (result) {
      triggerDownload(meshToStlBlob(result.mesh.positions, result.mesh.indices), 'forja-part.stl');
    }
  }, [genResult, genThreshold, result]);
  // ── IMPRIMIBILIDAD (DFM): ¿cabe?, voladizos, holgura/compensación recomendadas ──
  const [printProfileKey, setPrintProfileKey] = useState<keyof typeof PRINT_PROFILES>('media');
  const [printMaterial, setPrintMaterial] = useState<PrintProfile['material']>('PLA');
  const [showOverhangs, setShowOverhangs] = useState(false);
  const [gbTorque, setGbTorque] = useState(50);   // par de salida objetivo (N·m) para el análisis de caja
  const printProfile = useMemo<PrintProfile>(
    () => ({ ...PRINT_PROFILES[printProfileKey], material: printMaterial }),
    [printProfileKey, printMaterial],
  );
  const printReport = useMemo<PrintabilityReport | null>(
    () => (result ? printabilityReport(result.mesh, printProfile) : null),
    [result, printProfile],
  );
  const overhangColors = useMemo<Float32Array | null>(
    () => (result && showOverhangs ? overhangVertexColors(result.mesh, printProfile) : null),
    [result, showOverhangs, printProfile],
  );
  // ── SECCIÓN: corte por plano para ver las caras internas (clip) ──
  const [sectionOn, setSectionOn] = useState(false);
  const [sectionAxis, setSectionAxis] = useState<'x' | 'y' | 'z'>('y');
  const [sectionOffset, setSectionOffset] = useState(0);   // −1..1 sobre el bbox
  const [sectionFlip, setSectionFlip] = useState(false);
  const meshBBox = useMemo(() => {
    if (!result) return null;
    const p = result.mesh.positions;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0; i < p.length; i += 3) {
      mnx = Math.min(mnx, p[i]); mxx = Math.max(mxx, p[i]);
      mny = Math.min(mny, p[i + 1]); mxy = Math.max(mxy, p[i + 1]);
      mnz = Math.min(mnz, p[i + 2]); mxz = Math.max(mxz, p[i + 2]);
    }
    return { center: [(mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2], half: [(mxx - mnx) / 2 || 1, (mxy - mny) / 2 || 1, (mxz - mnz) / 2 || 1] };
  }, [result]);
  const sectionPlanes = useMemo<THREE.Plane[] | null>(() => {
    if (!sectionOn || !meshBBox) return null;
    const ai = sectionAxis === 'x' ? 0 : sectionAxis === 'y' ? 1 : 2;
    const sign = sectionFlip ? -1 : 1;
    const n = new THREE.Vector3(0, 0, 0); n.setComponent(ai, sign);
    const px = meshBBox.center[ai] + sectionOffset * meshBBox.half[ai] * 1.02;
    const point = new THREE.Vector3(meshBBox.center[0], meshBBox.center[1], meshBBox.center[2]); point.setComponent(ai, px);
    return [new THREE.Plane(n, -n.dot(point))];
  }, [sectionOn, sectionAxis, sectionOffset, sectionFlip, meshBBox]);
  // ── MOTOR DE PLANOS: del sólido actual → plano de taller 2D (SVG) ──
  const [planoSvg, setPlanoSvg] = useState<string | null>(null);
  const genPlano = useCallback(() => {
    if (!result) return;
    const draw = generateDrawing(
      {
        positions: result.mesh.positions, indices: result.mesh.indices,
        edges: result.edgeGeoms.map((g) => ({ polyline: g.polyline, kind: g.kind })),
      },
      { name: 'Pieza La Forja', material: MATERIALS[material].label, massG: result.mass.mass, units: 'mm' },
    );
    setPlanoSvg(draw.svg);
  }, [result, material]);
  const downloadPlano = useCallback(() => {
    if (planoSvg) triggerDownload(new Blob([planoSvg], { type: 'image/svg+xml' }), 'forja-plano.svg');
  }, [planoSvg]);
  const genVoidPct = useMemo(() => {
    if (!genResult) return 0;
    let v = 0; for (let e = 0; e < genResult.xPhys.length; e++) if (genResult.xPhys[e] < 0.1) v++;
    return 100 * v / Math.max(1, genResult.xPhys.length);
  }, [genResult]);

  // Inicia el picking de cara dirigido al panel FEA (fija o carga).
  const startFeaPick = useCallback((target: 'fija' | 'carga') => {
    setActiveOp(null);
    setFeaPickTarget(target);
    setPickMode('face');
  }, []);

  // Apaga el overlay FEA (vuelve al render metálico normal) sin perder las BC.
  const clearFeaOverlay = useCallback(() => {
    setFeaColors(null);
    setFeaResult(null);
    feaSessionRef.current = null;
  }, []);

  // Si cambia la geometría del documento, el FEA previo deja de ser válido:
  // limpiamos overlay + resultado (las BC por índice de cara también caducan).
  useEffect(() => {
    setFeaColors(null);
    setFeaResult(null);
    setFeaFixedFace(null);
    setFeaLoadFace(null);
    feaSessionRef.current = null; // la geometría cambió → la sesión cacheada caduca
    setGenResult(null);
  }, [opCount, sketch.kind]);

  // Selección (toggle) de cara/arista para la op activa. SIEMPRE fija el
  // selectedFaceId/selectedEdgeId (para el HUD + resalte), y además, si hay una
  // op que consume caras/aristas (Shell / Fillet / Chamfer), togglea su lista.
  const togglePickFace = useCallback((i: number, p?: THREE.Vector3) => {
    setSelectedFaceId(i);
    // COLOCACIÓN DE BARRENO por clic: el punto del mundo se mapea a (x,y) local.
    // El grupo del modelo está rotado -90° en X → mundo (X,Y,Z) = local (x, z, -y),
    // así que local x = mundo.x, local y = -mundo.z (el barreno se taladra en Z).
    const placing = placingHoleRef.current;
    if (placing && p) {
      updateOp(placing, { x: +p.x.toFixed(3), y: +(-p.z).toFixed(3) } as Partial<Op>);
      placingHoleRef.current = null;
      setPlacingHole(false);
      setPickMode('none');
      return;
    }
    // Si el picking está dirigido al panel FEA, el clic asigna la cara FIJA o la
    // de CARGA (y NO toca la selección de la op activa). Un solo clic basta.
    const feaTarget = feaPickTargetRef.current;
    if (feaTarget === 'fija') { setFeaFixedFace(i); setFeaPickTarget(null); setPickMode('none'); return; }
    if (feaTarget === 'carga') { setFeaLoadFace(i); setFeaPickTarget(null); setPickMode('none'); return; }
    const op = ops.find((o) => o.id === activeOp);
    if (!op || op.type !== 'shell') return;
    const cur = (op as ShellOp).faces;
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
    updateOp(op.id, { faces: next } as Partial<Op>);
  }, [ops, activeOp, updateOp]);
  const togglePickEdge = useCallback((i: number) => {
    setSelectedEdgeId(i);
    // Si la arista clicada es RECTA, su eje (gp_Ax1) queda disponible para el
    // revolve por-arista. Lo guardamos en el ref que `rebuild` consulta.
    const eg = resultRef.current?.edgeGeoms.find((g) => g.edgeId === i);
    if (eg?.axis) edgeAxisRef.current = eg.axis;
    const op = ops.find((o) => o.id === activeOp);
    if (!op || (op.type !== 'fillet' && op.type !== 'chamfer')) return;
    const cur = (op as FilletOp | ChamferOp).edges;
    const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
    updateOp(op.id, { edges: next } as Partial<Op>);
  }, [ops, activeOp, updateOp]);

  // Activa el picking de ARISTA en modo inspección (sin op que consuma aristas),
  // para elegir el EJE del revolve clicando una arista recta del sólido actual.
  const enableEdgePick = useCallback(() => {
    setPickMode((m) => (m === 'edge' ? 'none' : 'edge'));
  }, []);

  // El picking se puede activar SIN una op (modo "inspección"): permite elegir
  // cara/arista para ver el ID en el HUD antes de crear el feature.
  const enableFacePick = useCallback(() => {
    setActiveOp(null);
    setPickMode((m) => (m === 'face' ? 'none' : 'face'));
  }, []);

  // ── ATAJOS DE TECLADO (keymap bilingüe) + paleta estilo Fusion "S" ──
  // "Clickear es difícil" → cada herramienta tiene una tecla mnemónica EN/ES que
  // reusa el MISMO handler que su botón (cero lógica nueva, no infla código).
  // "S" abre/cierra la cajita de atajos en el cursor. Se ignora la tecla si el
  // foco está en un input/textarea (no robarla mientras editas una cota).
  const mouseRef = useRef({ x: 420, y: 180 });
  const [shortcutPos, setShortcutPos] = useState<{ x: number; y: number } | null>(null);
  const KEYMAP = useMemo(() => [
    { key: 'r', icon: '▭', label: 'Rectángulo', action: () => setSketch((s) => ({ ...s, kind: 'rect' })) },
    { key: 'c', icon: '◯', label: 'Círculo', action: () => setSketch((s) => ({ ...s, kind: 'circle' })) },
    { key: 'l', icon: '∟', label: 'Perfil L', action: () => setSketch((s) => ({ ...s, kind: 'lprofile' })) },
    { key: 'e', icon: '⬆', label: 'Extruir', action: () => addOp('extrude') },
    { key: 'b', icon: '⊙', label: 'Barreno', action: () => startHole() },
    { key: 'f', icon: '◜', label: 'Fillet', action: () => addOp('fillet') },
    { key: 'x', icon: '◣', label: 'Chaflán', action: () => addOp('chamfer') },
    { key: 'w', icon: '▢', label: 'Vaciado', action: () => addOp('shell') },
    { key: 'v', icon: '⟳', label: 'Revolución', action: () => addOp('revolve') },
    { key: 'g', icon: '⚙', label: 'Engrane', action: () => applyGear() },
    { key: 'p', icon: '◧', label: 'Pick cara', action: () => enableFacePick() },
    { key: 'k', icon: '╱', label: 'Pick arista', action: () => enableEdgePick() },
  ], [setSketch, addOp, startHole, applyGear, enableFacePick, enableEdgePick]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setShortcutPos(null); setPickMode('none'); placingHoleRef.current = null; setPlacingHole(false); return; }
      const k = e.key.toLowerCase();
      if (k === 's') { e.preventDefault(); setShortcutPos((p) => (p ? null : { ...mouseRef.current })); return; }
      const item = KEYMAP.find((m) => m.key === k);
      if (item) { e.preventDefault(); item.action(); setShortcutPos(null); }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('keydown', onKey); };
  }, [KEYMAP]);

  // Caras/aristas resaltadas = selección de la op activa ∪ la cara/arista que
  // se acaba de elegir por clic (selectedFaceId/Id). Así el resalte aparece
  // incluso en modo inspección (sin op de Shell/Fillet activa).
  const activeOpObj = ops.find((o) => o.id === activeOp) ?? null;
  const activeCompObj = components.find((c) => c.id === activeComp) ?? null;
  const selFaces = useMemo(() => {
    const s = new Set<number>(activeOpObj?.type === 'shell' ? activeOpObj.faces : []);
    if (selectedFaceId != null) s.add(selectedFaceId);
    return [...s];
  }, [activeOpObj, selectedFaceId]);
  const selEdges = useMemo(() => {
    const s = new Set<number>(
      activeOpObj && (activeOpObj.type === 'fillet' || activeOpObj.type === 'chamfer') ? activeOpObj.edges : [],
    );
    if (selectedEdgeId != null) s.add(selectedEdgeId);
    return [...s];
  }, [activeOpObj, selectedEdgeId]);

  // ── QA hook headless (Playwright) ──
  useEffect(() => {
    const api = {
      get ready() { return !!oc && !!result; },
      get invariants() {
        return result ? {
          ops: ops.map((o) => o.type),
          faces: result.topo.faces,
          edges: result.topo.edges,
          vertices: result.topo.vertices,
          euler: result.topo.euler,
          vol_kernel: result.volKernel,
          area: result.area,
          mass_g: result.mass.mass,
          com: result.mass.centerOfMass,
          principal: result.mass.principal,
          step_bytes: result.stepBytes,
          tris: result.mesh.triangleCount,
          n_faces: result.faces.length,
          n_edges: result.edges.length,
        } : null;
      },
      get error() { return opErr; },
      get selectedFaceId() { return selectedFaceId; },
      get selectedEdgeId() { return selectedEdgeId; },
      addOp,
      updateOp,
      removeOp,
      renameOp,
      toggleSuppressOp,
      // P1: reordenar, rollback, undo/redo — drivers de QA
      moveOp,
      rollTo,
      get rollbackIdx() { return rollbackIdx; },
      undo,
      redo,
      get canUndo() { return histRef.current.past.length > 0; },
      get canRedo() { return histRef.current.future.length > 0; },
      // PARÁMETROS — drivers de QA
      setParamsOpen: (v: boolean) => setParamsOpen(v),
      addParam, updateParam, removeParam, setBinding,
      get params() { return params; },
      get paramScope() { return resolvedParams.scope; },
      get paramErrors() { return resolvedParams.errors; },
      get bindings() { return bindings; },
      // colapsar/expandir un panel por id (features|params|faces|analysis) — driver de QA
      toggleCollapse,
      get collapsed() { return collapsed; },
      // menú de opciones + export STL (driver de QA del menú ⋮)
      setOptionsOpen: (v: boolean) => setOptionsOpen(v),
      get optionsOpen() { return optionsOpen; },
      exportSTL,
      // MOTOR DE PLANOS — driver de QA
      genPlano,
      get planoSvg() { return planoSvg; },
      // IMPRIMIBILIDAD (DFM) — driver de QA
      get printReport() { return printReport; },
      setPrintMaterial: (m: PrintProfile['material']) => setPrintMaterial(m),
      setShowOverhangs: (v: boolean) => setShowOverhangs(v),
      get showOverhangs() { return showOverhangs; },
      // SECCIÓN + EJEMPLOS — driver de QA
      setSection: (on: boolean, axis?: 'x' | 'y' | 'z', offset?: number) => { setSectionOn(on); if (axis) setSectionAxis(axis); if (offset != null) setSectionOffset(offset); },
      get sectionOn() { return sectionOn; },
      get sectionPlaneCount() { return sectionPlanes ? sectionPlanes.length : 0; },
      loadExample: (i: number) => { const e = makeExamples()[i]; if (e) loadDoc(e.doc()); },
      // ENSAMBLE — driver de QA
      addComponent, updateComponent, removeComponent,
      setActiveComp: (id: string | null) => setActiveComp(id),
      get components() { return components; },
      // GUARDAR/CARGAR — driver de QA
      get docName() { return docName; },
      setDocName: (n: string) => setDocName(n),
      serializeDoc, loadDoc, newDoc, saveToLibrary, loadFromLibrary, deleteFromLibrary,
      get libNames() { return Object.keys(readLib()).sort(); },
      // IMPORTAR STEP — driver de QA
      importStepText, clearImportedStep,
      get importedStep() { return importedStep != null; },
      get stepText() { return stepTextRef.current; },
      setSketch,
      // Lista de ops con id+tipo+depth — para que QA (Playwright) ubique la op de
      // extrude por su id real y la edite (updateOp) sin depender del clamp del
      // slider de la UI. Solo lectura; no cambia la lógica del documento.
      get opsList() { return ops.map((o) => ({ id: o.id, type: o.type, name: o.name, suppressed: !!o.suppressed, depth: (o as { depth?: number }).depth, x: (o as { x?: number }).x, y: (o as { y?: number }).y })); },
      // Perfil escalonado de revolución (croquis poligonal) — driver de QA.
      setSteps,
      addStep,
      updateStep,
      get steps() { return sketch.steps; },
      // ── ENGRANE de involuta (7º clásico) — driver + invariantes de QA ──
      setGear,
      updateGear,
      // CAJA cicloidal — driver de QA
      applyGearbox, updateGearbox,
      setGbTorque: (t: number) => setGbTorque(t),
      get gearbox() { return sketch.gearbox; },
      get gear() { return sketch.gear; },
      // Geometría DERIVADA del engrane (matemática pura, sin tocar el kernel):
      // rp, rb, área del perfil cerrado, error de simetría rotacional Z-fold y el
      // VOLUMEN ESPERADO = A·espesor − π·(bore/2)²·espesor. Playwright compara
      // esto contra el volumen exacto del panel Análisis (an-volumen).
      get gearInfo() {
        const g = sketch.gear;
        const gp = gearSketchParams(g);
        const geo = deriveGearGeometry(gp);
        const verts = buildGearSketch(gp);
        const area = Math.abs(sketchSignedArea(verts));
        const symErr = sketchRotationalSymmetryError(verts, Math.round(g.teeth));
        const boreArea = Math.PI * (g.bore / 2) ** 2;
        const volExpected = (area - boreArea) * g.thickness;
        return {
          m: g.module, Z: Math.round(g.teeth), alphaDeg: g.pressureDeg,
          thickness: g.thickness, bore: g.bore,
          rp: geo.pitchRadius, rb: geo.baseRadius,
          pitchDiameter: geo.pitchRadius * 2,
          addendumRadius: geo.addendumRadius, dedendumRadius: geo.dedendumRadius,
          profileVertices: verts.length, profileArea: area,
          symmetryError: symErr, volExpected,
        };
      },
      // ── ENSAMBLE de DOS engranes engranados — driver + invariantes de QA ──
      addGear2, setTeeth2, applyGearMate, removeGear2,
      // DRIVER cinemático: fija el ángulo de entrada θ (grados) y corre el
      // barrido de verificación de embonado (lo mismo que los controles de UI).
      setDriveAngleDeg, verifyMeshing,
      // Montaje de componentes mecánicos del ensamble (flechas + carcasa).
      setShafts, setHousing,
      get driveAngleDeg() { return (assembly.driveAngle * 180) / Math.PI; },
      // Barrido de Common(g1,g2) sobre un paso de diente — invocable directo por
      // Playwright (síncrono, devuelve el reporte) además de por el botón de UI.
      runMeshingSweep: (samples = 10) =>
        (oc && sketch.kind === 'gear' && assembly.enabled)
          ? sweepMeshingInterference(oc, sketch.gear, assembly.teeth2, samples)
          : null,
      // Último barrido corrido por la UI (btn-verificar-embonado), o null.
      get meshSweep() { return meshSweep; },
      get assemblyState() { return assembly; },
      // Geometría DERIVADA del mate (matemática pura): C teórico, relación i,
      // faseo φ₂. Playwright la compara contra C_medido del modelo real.
      get mateInfo() {
        if (sketch.kind !== 'gear') return null;
        const mate = gearMateGeometry(sketch.gear, assembly.teeth2);
        return {
          enabled: assembly.enabled, mated: assembly.mated,
          m: mate.m, z1: mate.z1, z2: mate.z2,
          rp1: mate.rp1, rp2: mate.rp2,
          C_expected: mate.centerDistance, ratio: mate.ratio,
          phase2: mate.phase2,
        };
      },
      // Resultado del mate MEDIDO del modelo B-Rep real (C entre centros de masa,
      // volúmenes de cada parte, e interferencia Common(g1,g2) — el invariante de
      // que EMBONAN sin solaparse).
      get assemblyInfo() {
        const a = result?.assembly;
        return a ? {
          teeth1: a.teeth1, teeth2: a.teeth2,
          C_expected: a.centerDistanceExpected,
          C_measured: a.centerDistanceMeasured,
          phase2: a.phase2, mated: a.mated, ratio: a.ratio,
          vol_gear1: a.volGear1, vol_gear2: a.volGear2,
          interference_volume: a.interferenceVolume,
          interference_fraction: a.interferenceFraction,
          // ── DRIVER cinemático ──
          drive_angle: a.driveAngle,        // θ entrada (rad)
          output_angle: a.outputAngle,      // θ₂ salida (rad) = −θ·(Z₁/Z₂)
          // RELACIÓN MEDIDA i = θ_entrada / θ_salida (debe = Z₂/Z₁). Solo válida
          // si la entrada se movió (θ≠0); en θ=0 ambos son 0 y i es la teórica.
          ratio_measured: Math.abs(a.outputAngle) > 1e-9
            ? Math.abs(a.driveAngle / a.outputAngle)
            : a.ratio,
          tooth_volume_ref: a.toothVolumeRef,
          // ── Componentes mecánicos montados (flechas + carcasa) ──
          components: a.components,
          n_components: a.components.length,
          shafts: a.shafts,
          vol_shafts: a.volShafts,
          housing: a.housing,
          vol_housing: a.volHousing,
          vol_compound: a.volCompound,
        } : null;
      },
      setMaterial,
      // ── SIMULACIÓN FEA (von Mises) — driver + resultado para QA ──
      // Fija las BC por índice de cara y corre el análisis (lo mismo que la UI).
      setFeaFixedFace: (i: number) => { setFeaFixedFace(i); },
      setFeaLoadFace: (i: number) => { setFeaLoadFace(i); },
      setFeaLoad: (n: number) => { setFeaLoadN(n); },
      runFEA: runFeaAnalysis,
      // Corre el FEA con dirección de carga EXPLÍCITA (transversal al eje) — caso
      // cantilever canónico (carga perpendicular sobre la cara libre). Mismo
      // solver/estado/DOM que el botón Analizar.
      runFEADir: (dir: [number, number, number]) => runFeaAnalysis(dir),
      // FEA EN VIVO: re-resuelve SOLO cambiando la carga, reusando la sesión cacheada
      // (warm-start). Para QA: devuelve nada, pero deja feaLiveMs y feaResult listos.
      feaLiveSetLoad: (n: number) => { feaLiveSetLoad(n); },
      get feaSessionReady() { return !!feaSessionRef.current; },
      get feaLiveMs() { return feaLiveMs; },
      // ── DISEÑO GENERATIVO (driver QA) ──
      setGenVolfrac: (v: number) => setGenVolfrac(Math.max(0.1, Math.min(0.8, v))),
      runGenerative: (dir?: [number, number, number]) => runGenerative(dir),
      get genBusy() { return genBusy; },
      get genResult() {
        if (!genResult) return null;
        let kept = 0, vd = 0;
        for (let e = 0; e < genResult.xPhys.length; e++) { if (genResult.xPhys[e] >= genThreshold) kept++; if (genResult.xPhys[e] < 0.1) vd++; }
        return { nCells: genResult.nCells, compliance: genResult.compliance, kept, voidPct: 100 * vd / Math.max(1, genResult.xPhys.length), loops: genResult.history.length };
      },
      clearFeaOverlay,
      get feaReady() { return !!feaResult; },
      get feaBusy() { return feaBusy; },
      get feaError() { return feaErr; },
      get feaResult() {
        return feaResult ? {
          maxVonMises_Pa: feaResult.maxVonMises,
          maxVonMises_MPa: feaResult.maxVonMises / 1e6,
          minSafetyFactor: feaResult.minSafetyFactor,
          maxDisplacement_mm: feaResult.maxDisplacement,
          n_nodes: feaResult.mesh.nNodes,
          n_tets: feaResult.mesh.nTets,
          iterations: feaResult.solver.iterations,
          residual: feaResult.solver.residual,
          converged: feaResult.solver.converged,
          fixedFace: feaFixedFace,
          loadFace: feaLoadFace,
          loadN: feaLoadN,
          material: FEA_MATERIAL_KEY[material] ?? 'aluminio_6061',
          hasOverlay: !!feaColors,
        } : null;
      },
      setPickMode,
      pickFace: togglePickFace,
      pickEdge: togglePickEdge,
      listFaces: () => result?.faces ?? [],
      listEdges: () => result?.edges ?? [],
      // Geometría pickeable de aristas (polilínea + eje si es recta).
      listEdgeGeoms: () => result?.edgeGeoms ?? [],
      // Eje de revolución resuelto desde la arista recta clicada (gp_Ax1).
      get selectedEdgeAxis() { return edgeAxisRef.current; },
      // Diagnóstico del teselado etiquetado: nº de grupos por cara + faceIds.
      get tessTags() {
        return result ? {
          n_groups: result.mesh.faceGroups.length,
          n_face_ids: result.mesh.faceIds.length,
          distinct_face_ids: new Set(Array.from(result.mesh.faceIds)).size,
        } : null;
      },
    };
    (window as unknown as { __forgeBrep?: typeof api }).__forgeBrep = api;
    return () => { delete (window as unknown as { __forgeBrep?: unknown }).__forgeBrep; };
    // NOTA: collapsed/optionsOpen NO van en deps a propósito — re-crear el hook en
    // cada toggle de panel/menú lo borraría a media interacción (los getters de QA
    // de esos dos leen el DOM, no el hook). Los callbacks son refs estables.
  }, [oc, result, ops, opErr, addOp, updateOp, removeOp, renameOp, toggleSuppressOp, moveOp, rollTo, rollbackIdx, undo, redo, histVer, params, bindings, resolvedParams, addParam, updateParam, removeParam, setBinding, toggleCollapse, exportSTL, genPlano, planoSvg, printReport, printMaterial, showOverhangs, sectionOn, sectionPlanes, components, activeComp, addComponent, updateComponent, removeComponent, docName, serializeDoc, loadDoc, newDoc, saveToLibrary, loadFromLibrary, deleteFromLibrary, importedStep, importStepText, clearImportedStep, togglePickFace, togglePickEdge, selectedFaceId, selectedEdgeId, setSteps, addStep, updateStep, sketch.steps, setGear, updateGear, sketch.gear, sketch.gearbox, sketch.kind, applyGearbox, updateGearbox, gbTorque, printMaterial, assembly, addGear2, setTeeth2, applyGearMate, removeGear2, setDriveAngleDeg, setShafts, setHousing, verifyMeshing, meshSweep, material, runFeaAnalysis, feaLiveSetLoad, clearFeaOverlay, feaResult, feaBusy, feaErr, feaColors, feaFixedFace, feaLoadFace, feaLoadN, feaLiveMs, runGenerative, genResult, genBusy, genThreshold, genVoidPct]);

  const cameraDist = useMemo(() => {
    const stepLen = sketch.steps.reduce((a, s) => a + s.L, 0);
    const stepR = Math.max(0, ...sketch.steps.map((s) => s.r));
    // Engrane: diámetro de cabeza ≈ (rp + m)·2 = m·(Z + 2).
    const gearD = sketch.gear.module * (Math.round(sketch.gear.teeth) + 2) * 2;
    // ENSAMBLE: el tramo abarca C + radio de cabeza de cada engrane sobre +X.
    let asmSpan = 0;
    if (sketch.kind === 'gear' && assembly.enabled) {
      const mate = gearMateGeometry(sketch.gear, assembly.teeth2);
      const ra1 = mate.rp1 + sketch.gear.module;
      const ra2 = mate.rp2 + sketch.gear.module;
      asmSpan = mate.centerDistance + ra1 + ra2;
    }
    const span = Math.max(sketch.width, sketch.height, sketch.radius * 2, stepLen, stepR * 2,
      sketch.kind === 'gear' ? gearD : 0, asmSpan, 30);
    return Math.max(60, span * 2.6);
  }, [sketch, assembly]);

  // El <canvas> lo crea R3F dentro del viewport; le ponemos data-testid para
  // que Playwright pueda clicar por COORDENADAS del viewport de forma estable.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const cv = viewportRef.current?.querySelector('canvas');
    if (cv) cv.setAttribute('data-testid', 'viewport-canvas');
  }, [result]);

  const ok = result ? result.topo.euler === 2 : false;
  const mat = MATERIALS[material];

  return (
    <div className="fb-root">
      <style>{CSS}</style>

      {/* ── VIEWPORT ── */}
      <div className="fb-viewport" data-testid="viewport" ref={viewportRef}>
        <CadViewport
          cameraDistance={cameraDist}
          autoRotate={false}
          minDistance={cameraDist * 0.2}
          maxDistance={cameraDist * 4}
        >
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {showSketch && <SketchPlane />}
            {showSketch && <ProfileGhost pts={profilePts} />}
            {genResult ? (
              genSmooth
                ? <GenerativeSurface result={genResult} threshold={genThreshold} />
                : <GenerativeVoxels result={genResult} threshold={genThreshold} />
            ) : result && (
              <SolidMesh
                mesh={result.mesh}
                faded={building}
                matKey={material}
                faces={result.faces}
                edgeGeoms={result.edgeGeoms}
                selFaces={selFaces}
                selEdges={selEdges}
                pickMode={pickMode}
                onPickFace={togglePickFace}
                onPickEdge={togglePickEdge}
                feaColors={feaColors}
                overhangColors={showOverhangs ? overhangColors : null}
                clip={sectionPlanes}
              />
            )}
          </group>
        </CadViewport>

        {/* EDITOR DE CROQUIS 2D — dibujar perfil con restricciones (solver en vivo). */}
        {sketchOpen && (
          <SketchEditor onFinish={onSketchFinish} onCancel={() => setSketchOpen(false)} />
        )}

        {/* PALETA DE ATAJOS estilo Fusion "S" en el cursor (se abre con la tecla S). */}
        {shortcutPos && (
          <ShortcutOverlay
            tools={KEYMAP.map((m) => ({ label: m.label, icon: m.icon, shortcut: m.key.toUpperCase(), action: m.action }))}
            position={shortcutPos}
            onClose={() => setShortcutPos(null)}
          />
        )}

        {/* HINT descubrible: la tecla S abre la paleta de atajos. */}
        <div
          data-testid="shortcut-hint"
          style={{
            position: 'absolute', left: 240, bottom: 20, zIndex: 6, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', gap: 7,
            background: 'rgba(13,18,28,0.7)', border: `1px solid ${GOLD}33`, borderRadius: 8,
            padding: '5px 11px', fontSize: 11, color: '#cdd6e2', fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <span style={{ color: GOLD, fontWeight: 700 }}>S</span>
          <span>atajos · teclas C B L E F…</span>
        </div>

        {pickMode !== 'none' && (
          <div className="fb-pick-hint" data-testid="pick-hint">
            {placingHole
              ? 'Clic en la cara superior para COLOCAR el barreno'
              : `Clic en ${pickMode === 'face' ? 'una CARA' : 'una ARISTA'} del sólido para seleccionarla`}
          </div>
        )}

        {/* HUD de selección: el faceId/edgeId que el picking acaba de fijar.
            Playwright lee este nodo para verificar que el clic cambió la cara. */}
        <div className="fb-hud-sel" data-testid="hud-selected-face">
          {selectedFaceId != null ? (
            <>
              <span className="lbl">Cara</span>
              <b>#{selectedFaceId}</b>
              {(() => {
                const f = result?.faces.find((x) => x.index === selectedFaceId);
                return f ? <span className="meta">{f.kind} · {f.area.toFixed(0)}mm²</span> : null;
              })()}
            </>
          ) : (
            <span className="lbl">Ninguna cara seleccionada</span>
          )}
        </div>

        {/* HUD de ARISTA SIEMPRE presente (incluso vacío): Playwright lee este
            nodo antes/después del clic para confirmar el cambio de edgeId. */}
        <div className="fb-hud-edge" data-testid="hud-selected-edge">
          {selectedEdgeId != null ? (
            (() => {
              const eg = result?.edgeGeoms.find((g) => g.edgeId === selectedEdgeId);
              return (
                <>
                  <span className="lbl">Arista</span>
                  <b>#{selectedEdgeId}</b>
                  {eg && <span className="meta">{eg.kind} · {eg.length.toFixed(1)}mm</span>}
                  {eg?.axis && <span className="meta axis">eje ✓</span>}
                </>
              );
            })()
          ) : (
            <span className="lbl">Ninguna arista seleccionada</span>
          )}
        </div>

        {/* HUD del ENSAMBLE: C entre centros + estado del mate + interferencia.
            Siempre visible cuando hay 2º engrane → aparece en el screenshot. */}
        {result?.assembly && (
          <div className="fb-hud-asm" data-testid="hud-assembly">
            <span className="lbl">Caja de velocidades</span>
            <span className="seg">Z₁ <b data-testid="hud-z1">{result.assembly.teeth1}</b></span>
            <span className="seg">Z₂ <b data-testid="hud-z2">{result.assembly.teeth2}</b></span>
            <span className="seg">C <b data-testid="hud-C">{result.assembly.centerDistanceMeasured.toFixed(2)}</b> mm</span>
            <span className="seg">i <b>{result.assembly.ratio.toFixed(2)}</b></span>
            <span className="seg">θ <b data-testid="hud-drive">{((result.assembly.driveAngle * 180) / Math.PI).toFixed(0)}</b>°
              → <b data-testid="hud-output">{((result.assembly.outputAngle * 180) / Math.PI).toFixed(0)}</b>°</span>
            <span className={`seg mesh ${result.assembly.mated && result.assembly.interferenceFraction < 1e-3 ? 'ok' : 'warn'}`}>
              {result.assembly.mated ? 'faseado ✓' : 'sin fasear'} ·
              interf. <b data-testid="hud-interf">{result.assembly.interferenceVolume.toFixed(2)}</b> mm³
            </span>
            {meshSweep && (
              <span className={`seg mesh ${meshSweep.maxInterferenceFraction < 5e-3 ? 'ok' : 'warn'}`}>
                barrido max <b data-testid="hud-max-interf">{meshSweep.maxInterference.toFixed(3)}</b> mm³
                {meshSweep.maxInterferenceFraction < 5e-3 ? ' · EMBONAN ✓' : ' · INTERFIEREN ✕'}
              </span>
            )}
          </div>
        )}

        {/* BARRA DE ESCALA del overlay FEA (von Mises, MPa). Aparece sobre el
            viewport cuando hay análisis: gradiente azul→rojo con los topes 0 y
            σ_max, para que el screenshot LEA cuánto vale cada color. */}
        {feaResult && feaColors && (
          <div className="fb-fea-legend" data-testid="fea-legend">
            <div className="fb-fea-legend-title">von Mises (MPa)</div>
            <div className="fb-fea-bar" style={{ background: feaLegendGradient() }} />
            <div className="fb-fea-ticks">
              <span>0</span>
              <span>{((feaResult.maxVonMises / 1e6) / 2).toFixed(0)}</span>
              <span data-testid="fea-legend-max">{(feaResult.maxVonMises / 1e6).toFixed(0)}</span>
            </div>
          </div>
        )}
      </div>

      {!hideChrome && (
        <BindContext.Provider value={bindCtx}>
          {/* Encabezado */}
          <header className="fb-header">
            <div className="fb-mark">⚒</div>
            <div className="fb-titles">
              <h1 data-testid="doc-title">{docName} <span className="fb-doc-studio">· Part Studio</span>
                {importedStep && <span className="fb-imported-tag" data-testid="imported-tag">STEP importado</span>}</h1>
              <p>La Forja · kernel B-Rep exacto (OpenCASCADE)</p>
            </div>
            <div className={`fb-kernel ${oc ? 'on' : 'off'}`} data-testid="kernel-status">
              <span className="dot" />
              {oc ? 'OCCT-WASM listo' : bootErr ? 'kernel falló' : 'cargando kernel…'}
            </div>
            {/* ── Undo / Redo (Ctrl+Z · Ctrl+Y) ── */}
            <div className="fb-undo">
              <button data-testid="btn-undo" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">↶</button>
              <button data-testid="btn-redo" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)">↷</button>
            </div>
          </header>

          {/* ── TOOLBAR de operaciones (botones) ── */}
          <div className="fb-toolbar" data-testid="toolbar">
            <span className="fb-tb-label">Operaciones</span>
            <button data-testid="btn-sketch" onClick={() => setSketchOpen(true)} title="Croquis: dibuja el perfil con restricciones (azul→negro)">✎ Croquis</button>
            <button data-testid="btn-extrude" onClick={() => addOp('extrude')} title="Extrude (boss/base)">⬓ Extrude</button>
            <button data-testid="btn-hole" onClick={() => startHole()} title="Barreno / corte cilíndrico — clic en la cara para colocarlo">◎ Hole</button>
            <button data-testid="btn-fillet" onClick={() => addOp('fillet')} title="Redondeo de aristas">◜ Fillet</button>
            <button data-testid="btn-chamfer" onClick={() => addOp('chamfer')} title="Bisel de aristas">◹ Chamfer</button>
            <button data-testid="btn-shell" onClick={() => addOp('shell')} title="Vaciado / pared delgada">▢ Shell</button>
            <button data-testid="btn-revolve" onClick={() => addOp('revolve')} title="Revolución del perfil">⟳ Revolve</button>
            <button data-testid="btn-gear" onClick={applyGear} title="Engrane de involuta (m, Z, α, espesor, barreno)">⚙ Engrane</button>
            <button data-testid="btn-gearbox" onClick={applyGearbox} title="Caja cicloidal multi-disco (reductor durable de plástico, 1 pieza)">⊞ Caja</button>
            <button data-testid="btn-pocket" onClick={() => addOp('pocket')} title="Corte / bolsillo: resta un perfil rect o círculo (ranuras, cajeras)">⊟ Corte</button>
            <button data-testid="btn-pattern" onClick={() => addOp('pattern')} title="Patrón: rectangular / circular / espejo del sólido">⁘ Patrón</button>
            <span className="fb-tb-sep" />
            <button data-testid="btn-params" className={paramsOpen ? 'on' : ''}
              onClick={() => setParamsOpen((v) => !v)} title="Parámetros con ecuaciones (Change Parameters)">ƒₓ Parámetros</button>
            <button data-testid="btn-plano" onClick={genPlano} disabled={!result}
              title="Plano de taller: 3 vistas ortográficas acotadas (líneas ocultas) → SVG">📐 Plano</button>
            <span className="fb-tb-sep" />
            <button data-testid="btn-component" onClick={() => addComponent('box')}
              title="Ensamble: agrega un componente (bloque/cilindro) posicionado en 3D">🧩 Componente</button>
            {/* ── Menú ⋮ Opciones (documento): exportar + visibilidad, ya no sueltos ── */}
            <span className="fb-tb-sep" />
            <div className="fb-menu-wrap">
              <button className={`fb-menu-btn ${optionsOpen ? 'on' : ''}`} data-testid="btn-options"
                onClick={() => { setOptionsOpen((v) => { if (!v) refreshLib(); return !v; }); }} title="Opciones del documento">⋮ Opciones</button>
              {optionsOpen && (
                <>
                  <div className="fb-menu-scrim" onClick={() => setOptionsOpen(false)} />
                  <div className="fb-menu" data-testid="options-menu" role="menu">
                    <div className="fb-menu-sec">Documento</div>
                    <input className="fb-doc-name" data-testid="input-doc-name" value={docName} spellCheck={false}
                      onChange={(e) => setDocName(e.target.value)} placeholder="Nombre de la pieza" />
                    <button data-testid="menu-new" role="menuitem"
                      onClick={() => { newDoc(); setOptionsOpen(false); }}>📄  Nueva pieza</button>
                    {makeExamples().map((ex) => (
                      <button key={ex.name} data-testid="menu-example" role="menuitem"
                        onClick={() => { loadDoc(ex.doc()); setOptionsOpen(false); }}>{ex.name}</button>
                    ))}
                    <button data-testid="menu-save" role="menuitem"
                      onClick={() => { saveToLibrary(); refreshLib(); }}>💾  Guardar <em>en biblioteca</em></button>
                    <label className="fb-menu-link" role="menuitem" style={{ cursor: 'pointer' }}>
                      ⬆  Importar .json
                      <input type="file" accept=".json,application/json" data-testid="input-import" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { importDocFile(f); setOptionsOpen(false); } }} />
                    </label>
                    <label className="fb-menu-link" role="menuitem" style={{ cursor: 'pointer' }}>
                      🧩  Importar STEP <em>(step.parts, robots…)</em>
                      <input type="file" accept=".step,.stp,application/step,application/STEP" data-testid="input-import-step" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { importStepFile(f); setOptionsOpen(false); } }} />
                    </label>
                    {importedStep && (
                      <button data-testid="menu-clear-step" role="menuitem" className="danger"
                        onClick={() => { clearImportedStep(); setOptionsOpen(false); }}>✕  Quitar STEP importado</button>
                    )}
                    {libNames.length > 0 && (
                      <>
                        <div className="fb-menu-sec">Abrir <em>(biblioteca)</em></div>
                        <div className="fb-lib-list" data-testid="lib-list">
                          {libNames.map((n) => (
                            <div key={n} className="fb-lib-row">
                              <button className="fb-lib-open" data-testid={`lib-open-${n}`}
                                onClick={() => { loadFromLibrary(n); setOptionsOpen(false); }} title={`Abrir "${n}"`}>📂 {n}</button>
                              <button className="fb-lib-del" data-testid={`lib-del-${n}`}
                                onClick={() => deleteFromLibrary(n)} title="Borrar de la biblioteca">✕</button>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                    <div className="fb-menu-sep" />
                    <div className="fb-menu-sec">Vista</div>
                    <button data-testid="menu-toggle-sketch" role="menuitem"
                      onClick={() => { setShowSketch((v) => !v); setOptionsOpen(false); }}>
                      {showSketch ? '🙈  Ocultar boceto' : '👁  Mostrar boceto'}
                    </button>
                    <div className="fb-menu-sep" />
                    <div className="fb-menu-sec">Exportar</div>
                    <a data-testid="menu-export-step" role="menuitem"
                      className={`fb-menu-link ${result ? '' : 'disabled'}`}
                      href={result ? (stepBlobUrl.current ?? '#') : undefined} download="forja-part.step"
                      onClick={() => result && setOptionsOpen(false)} aria-disabled={!result}>
                      ⬇  STEP <em>(B-Rep exacto)</em>
                    </a>
                    <button data-testid="menu-export-stl" role="menuitem"
                      disabled={!result && !genResult}
                      onClick={() => { exportSTL(); setOptionsOpen(false); }}>
                      ⬇  STL <em>{genResult ? '(generativo)' : '(malla)'}</em>
                    </button>
                    <button data-testid="menu-export-json" role="menuitem"
                      onClick={() => { exportDocFile(); setOptionsOpen(false); }}>
                      ⬇  .json <em>(pieza editable)</em>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Panel izquierdo: GRAFO de features (clic = editar) ── */}
          <aside className={`fb-features ${collapsed.features ? 'collapsed' : ''}`} data-testid="feature-tree">
            <CollapseHead id="features" title="Documento" collapsed={!!collapsed.features}
              onToggle={() => toggleCollapse('features')}
              right={<span className="fb-count">{ops.length + 1}</span>} />
            <div
              className={`fb-feat-node ${activeOp === 'sketch' ? 'active' : ''}`}
              data-testid="feat-sketch"
              onClick={() => { setActiveOp('sketch'); setActiveComp(null); setPickMode('none'); }}
            >
              <span className="ico">▣</span>
              <div className="fb-feat-body">
                <strong>Sketch 1</strong>
                <em>{sketch.kind === 'rect' ? 'Rectángulo' : sketch.kind === 'circle' ? 'Círculo' : sketch.kind === 'revprofile' ? `Perfil escalón ×${sketch.steps.length}` : sketch.kind === 'gear' ? `Engrane Z${sketch.gear.teeth} m${sketch.gear.module}` : 'Perfil L'} · Plano XY</em>
              </div>
            </div>
            {ops.map((op, i) => {
              const rolled = rollbackIdx != null && i >= rollbackIdx; // tras el marcador
              return (
              <div key={op.id}>
                <div className="fb-feat-arrow">↓</div>
                <div
                  className={`fb-feat-node accent ${activeOp === op.id ? 'active' : ''} ${op.suppressed ? 'suppressed' : ''} ${rolled ? 'rolled' : ''}`}
                  data-testid={`feat-${op.type}`}
                  onClick={() => {
                    setActiveOp(op.id); setActiveComp(null);
                    if (op.type === 'fillet' || op.type === 'chamfer') setPickMode('edge');
                    else if (op.type === 'shell') setPickMode('face');
                    else setPickMode('none');
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setActiveOp(op.id); setCtxMenu({ x: e.clientX, y: e.clientY, opId: op.id }); }}
                >
                  <span className="ico">{opIcon(op.type)}</span>
                  <div className="fb-feat-body">
                    {editingOpId === op.id ? (
                      <input className="fb-feat-rename" data-testid={`feat-rename-${op.type}`}
                        autoFocus value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => { renameOp(op.id, editingName); setEditingOpId(null); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') { renameOp(op.id, editingName); setEditingOpId(null); }
                          if (e.key === 'Escape') setEditingOpId(null);
                        }} />
                    ) : (
                      <strong onDoubleClick={(e) => { e.stopPropagation(); setEditingOpId(op.id); setEditingName(op.name ?? `${opTitle(op.type)} ${i + 1}`); }}
                        title="Doble-clic para renombrar · clic derecho para más">
                        {op.name ?? `${opTitle(op.type)} ${i + 1}`}
                      </strong>
                    )}
                    <em>{op.suppressed ? 'suprimido' : rolled ? 'rolled back' : opSubtitle(op)}</em>
                  </div>
                  {/* acciones por-nodo: reordenar (↑↓) + suprimir (ojo) + borrar (✕) */}
                  <div className="fb-feat-actions">
                    <button className="fb-feat-act" data-testid={`feat-up-${op.type}`} disabled={i === 0}
                      onClick={(e) => { e.stopPropagation(); moveOp(op.id, -1); }}
                      title="Subir (calcular antes)">↑</button>
                    <button className="fb-feat-act" data-testid={`feat-down-${op.type}`} disabled={i === ops.length - 1}
                      onClick={(e) => { e.stopPropagation(); moveOp(op.id, 1); }}
                      title="Bajar (calcular después)">↓</button>
                    <button className="fb-feat-act" data-testid={`feat-suppress-${op.type}`}
                      onClick={(e) => { e.stopPropagation(); toggleSuppressOp(op.id); }}
                      title={op.suppressed ? 'Reactivar feature' : 'Suprimir feature (no se calcula)'}>
                      {op.suppressed ? '◌' : '👁'}
                    </button>
                    <button className="fb-feat-act del" data-testid={`feat-delete-${op.type}`}
                      onClick={(e) => { e.stopPropagation(); removeOp(op.id); }}
                      title="Eliminar feature (purga dependientes)">✕</button>
                  </div>
                </div>
                {/* marcador de ROLLBACK: el sólido se construye hasta aquí */}
                {rollbackIdx === i + 1 && (
                  <div className="fb-rollback-bar" data-testid="rollback-bar"
                    onClick={() => rollTo(null)} title="Clic para volver a la punta">
                    ⟲ rollback · clic = punta
                  </div>
                )}
              </div>
              );
            })}
            {/* ── COMPONENTES del ensamble ── */}
            {components.length > 0 && (
              <>
                <div className="fb-feat-subhead" data-testid="components-head">Componentes · ensamble <b>{components.length}</b></div>
                {components.map((c) => (
                  <div key={c.id}
                    className={`fb-feat-node comp ${activeComp === c.id ? 'active' : ''}`}
                    data-testid={`comp-${c.kind}`}
                    onClick={() => { setActiveComp(c.id); setActiveOp(null); setPickMode('none'); }}>
                    <span className="ico">{c.kind === 'cyl' ? '🛢' : '🧩'}</span>
                    <div className="fb-feat-body">
                      <strong>{c.name}</strong>
                      <em>{c.kind === 'cyl' ? `⌀${(c.r * 2).toFixed(0)}×${c.h.toFixed(0)}` : `${c.w.toFixed(0)}×${c.d.toFixed(0)}×${c.h.toFixed(0)}`} · @({c.x.toFixed(0)},{c.y.toFixed(0)},{c.z.toFixed(0)})</em>
                    </div>
                    <div className="fb-feat-actions">
                      <button className="fb-feat-act del" data-testid={`comp-delete-${c.kind}`}
                        onClick={(e) => { e.stopPropagation(); removeComponent(c.id); }} title="Eliminar componente">✕</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </aside>

          {/* ── Menú CONTEXTUAL (clic derecho en un nodo del árbol) ── */}
          {ctxMenu && (() => {
            const op = ops.find((o) => o.id === ctxMenu.opId);
            if (!op) return null;
            const idx = ops.findIndex((o) => o.id === ctxMenu.opId);
            return (
              <>
                <div className="fb-ctx-scrim" onClick={() => setCtxMenu(null)}
                  onContextMenu={(e) => { e.preventDefault(); setCtxMenu(null); }} />
                <div className="fb-ctx" data-testid="ctx-menu" role="menu"
                  style={{ left: Math.min(ctxMenu.x, window.innerWidth - 200), top: Math.min(ctxMenu.y, window.innerHeight - 280) }}>
                  <div className="fb-ctx-head">{op.name ?? `${opTitle(op.type)} ${idx + 1}`}</div>
                  <button data-testid="ctx-edit" onClick={() => { setActiveOp(op.id); setCtxMenu(null); }}>✎ Editar</button>
                  <button data-testid="ctx-rename" onClick={() => { setEditingOpId(op.id); setEditingName(op.name ?? `${opTitle(op.type)} ${idx + 1}`); setCtxMenu(null); }}>✏ Renombrar</button>
                  <div className="fb-menu-sep" />
                  <button data-testid="ctx-up" disabled={idx === 0} onClick={() => { moveOp(op.id, -1); setCtxMenu(null); }}>↑ Subir</button>
                  <button data-testid="ctx-down" disabled={idx === ops.length - 1} onClick={() => { moveOp(op.id, 1); setCtxMenu(null); }}>↓ Bajar</button>
                  <button data-testid="ctx-suppress" onClick={() => { toggleSuppressOp(op.id); setCtxMenu(null); }}>{op.suppressed ? '◌ Reactivar' : '👁 Suprimir'}</button>
                  <button data-testid="ctx-rollback" onClick={() => { rollTo(idx + 1); setCtxMenu(null); }}>⟲ Rollback aquí</button>
                  <div className="fb-menu-sep" />
                  <button className="danger" data-testid="ctx-delete" onClick={() => { removeOp(op.id); setCtxMenu(null); }}>✕ Eliminar</button>
                </div>
              </>
            );
          })()}

          {/* ── PARÁMETROS con ecuaciones (Change Parameters de Fusion) ── */}
          {paramsOpen && (
            <aside className="fb-paramspanel" data-testid="params-panel">
              <CollapseHead id="paramstbl" title="Parámetros · ecuaciones" collapsed={false}
                onToggle={() => setParamsOpen(false)} right={<span className="fb-count">{params.length}</span>} />
              <div className="fb-ptable">
                <div className="fb-prow head"><span>Nombre</span><span>Expresión</span><span>=</span><span /></div>
                {params.length === 0 && <div className="fb-phint">Sin parámetros. Crea <b>ancho=40</b>, <b>alto=ancho/2</b>… y liga cotas con <b>ƒₓ</b>.</div>}
                {params.map((p, i) => {
                  const err = resolvedParams.errors[p.id];
                  const val = resolvedParams.values[p.id];
                  return (
                    <div className={`fb-prow ${err ? 'err' : ''}`} key={p.id}>
                      <input className="fb-pname" data-testid={`param-name-${i}`} value={p.name} spellCheck={false}
                        onChange={(e) => updateParam(p.id, { name: e.target.value })} />
                      <input className="fb-pexpr" data-testid={`param-expr-${i}`} value={p.expr} spellCheck={false}
                        onChange={(e) => updateParam(p.id, { expr: e.target.value })} />
                      <span className="fb-pval" data-testid={`param-val-${i}`} title={err ?? ''}>
                        {err ? '⚠' : (val != null ? val.toFixed(2) : '—')}
                      </span>
                      <button className="fb-prow-x" data-testid={`param-del-${i}`}
                        onClick={() => removeParam(p.id)} title="Borrar parámetro">×</button>
                    </div>
                  );
                })}
              </div>
              <button className="fb-pick-btn" data-testid="btn-add-param" onClick={addParam}>+ Parámetro</button>
              <p className="fb-hint-txt">Las cotas con <b>ƒₓ</b> leen estos nombres. Cambias uno y el sólido se recalcula. Funciones: sqrt, sin, cos, min, max… consts: pi, e.</p>
            </aside>
          )}

          {/* ── Lista SIEMPRE disponible de caras (selección determinista) ──
              Independiente de la op activa: clic en una entrada fija
              selectedFaceId (y, si hay Shell activo, togglea su cara abierta).
              Playwright elige la cara superior/inferior/lateral por testid sin
              depender de coordenadas del viewport. */}
          <aside className={`fb-facelist ${collapsed.faces ? 'collapsed' : ''}`} data-testid="face-list">
            <CollapseHead id="faces" title="Caras del sólido" collapsed={!!collapsed.faces}
              onToggle={() => toggleCollapse('faces')}
              right={<span className="fb-count">{result?.faces.length ?? 0}</span>} />
            <button className="fb-pick-btn" data-testid="btn-pick-face-global"
              onClick={enableFacePick}>
              {pickMode === 'face' ? '◉ Picking de cara activo' : '○ Activar picking en viewport'}
            </button>
            <div className="fb-facelist-items">
              {(result?.faces ?? []).map((f) => (
                <button key={f.index}
                  data-testid={`face-item-${f.index}`}
                  className={selFaces.includes(f.index) ? 'sel' : ''}
                  onClick={() => togglePickFace(f.index)}
                  title={`Cara ${f.index} · ${f.kind}`}>
                  <span className="fi-idx">#{f.index}</span>
                  <span className="fi-lbl">{faceLabel(f)}</span>
                  <span className="fi-meta">{f.kind} · {f.area.toFixed(0)}mm²</span>
                </button>
              ))}
            </div>
          </aside>

          {/* ── Panel derecho: OPCIONES de la op activa ── */}
          <aside className={`fb-params ${collapsed.params ? 'collapsed' : ''}`} data-testid="op-panel">
            <CollapseHead id="params" title="Parámetros" collapsed={!!collapsed.params}
              onToggle={() => toggleCollapse('params')} />

            {activeCompObj && (
              <>
                <div className="fb-panel-title">Componente · {activeCompObj.kind === 'cyl' ? 'Cilindro' : 'Bloque'}</div>
                <div className="fb-seg">
                  <button data-testid="comp-box" className={activeCompObj.kind === 'box' ? 'on' : ''}
                    onClick={() => updateComponent(activeCompObj.id, { kind: 'box' })}>Bloque</button>
                  <button data-testid="comp-cyl" className={activeCompObj.kind === 'cyl' ? 'on' : ''}
                    onClick={() => updateComponent(activeCompObj.id, { kind: 'cyl' })}>Cilindro</button>
                </div>
                {activeCompObj.kind === 'box' ? (
                  <>
                    <Dim label="Ancho (X)" value={activeCompObj.w} unit="mm" min={2} max={3000} step={1} testid="input-comp-w"
                      onChange={(v) => updateComponent(activeCompObj.id, { w: v })} />
                    <Dim label="Fondo (Y)" value={activeCompObj.d} unit="mm" min={2} max={3000} step={1} testid="input-comp-d"
                      onChange={(v) => updateComponent(activeCompObj.id, { d: v })} />
                    <Dim label="Alto (Z)" value={activeCompObj.h} unit="mm" min={2} max={3000} step={1} testid="input-comp-h"
                      onChange={(v) => updateComponent(activeCompObj.id, { h: v })} />
                  </>
                ) : (
                  <>
                    <Dim label="Radio" value={activeCompObj.r} unit="mm" min={1} max={1000} step={1} testid="input-comp-r"
                      onChange={(v) => updateComponent(activeCompObj.id, { r: v })} />
                    <Dim label="Altura (Z)" value={activeCompObj.h} unit="mm" min={2} max={3000} step={1} testid="input-comp-h"
                      onChange={(v) => updateComponent(activeCompObj.id, { h: v })} />
                  </>
                )}
                <div className="fb-divider" />
                <div className="fb-sel-head">Posición del centro (mm)</div>
                <Dim label="X" value={activeCompObj.x} unit="mm" min={-1500} max={1500} step={1} testid="input-comp-x"
                  onChange={(v) => updateComponent(activeCompObj.id, { x: v })} />
                <Dim label="Y" value={activeCompObj.y} unit="mm" min={-1500} max={1500} step={1} testid="input-comp-y"
                  onChange={(v) => updateComponent(activeCompObj.id, { y: v })} />
                <Dim label="Z" value={activeCompObj.z} unit="mm" min={-1500} max={1500} step={1} testid="input-comp-z"
                  onChange={(v) => updateComponent(activeCompObj.id, { z: v })} />
                <Dim label="Giro Z" value={activeCompObj.rz ?? 0} unit="°" min={-180} max={180} step={1} testid="input-comp-rz"
                  onChange={(v) => updateComponent(activeCompObj.id, { rz: v })} />
                <button className="fb-del-btn" data-testid="btn-del-comp" onClick={() => removeComponent(activeCompObj.id)}>
                  ✕ Eliminar componente
                </button>
              </>
            )}

            {!activeCompObj && activeOp === 'sketch' && (
              <>
                <div className="fb-panel-title">Sketch · Perfil</div>
                <div className="fb-seg">
                  <button data-testid="seg-rect" className={sketch.kind === 'rect' ? 'on' : ''}
                    onClick={() => setSketch((s) => ({ ...s, kind: 'rect' }))}>Rect</button>
                  <button data-testid="seg-circle" className={sketch.kind === 'circle' ? 'on' : ''}
                    onClick={() => setSketch((s) => ({ ...s, kind: 'circle' }))}>Círculo</button>
                  <button data-testid="seg-lprofile" className={sketch.kind === 'lprofile' ? 'on' : ''}
                    onClick={() => setSketch((s) => ({ ...s, kind: 'lprofile' }))}>L</button>
                  <button data-testid="seg-revprofile" className={sketch.kind === 'revprofile' ? 'on' : ''}
                    onClick={() => setSketch((s) => ({ ...s, kind: 'revprofile' }))}>Escalón</button>
                  <button data-testid="seg-gear" className={sketch.kind === 'gear' ? 'on' : ''}
                    onClick={applyGear}>Engrane</button>
                </div>
                {sketch.kind === 'circle' ? (
                  <Dim label="Radio" value={sketch.radius} unit="mm" min={3} max={50} step={1} testid="input-radio" bindKey="sketch:radius"
                    onChange={(v) => setSketch((s) => ({ ...s, radius: v }))} />
                ) : sketch.kind === 'gearbox' ? (
                  <>
                    <p className="fb-hint-txt">
                      Caja cicloidal en 1 pieza: N discos fasados a 360/N° (balancean el eje → torsión pura) + eje hueco + base-anillo. Print-in-place.
                    </p>
                    <Dim label="Discos" value={sketch.gearbox.discs} unit="" min={2} max={10} step={1} testid="input-gb-discs"
                      onChange={(v) => updateGearbox({ discs: Math.round(v) })} />
                    <Dim label="Lóbulos" value={sketch.gearbox.lobes} unit=":1" min={6} max={20} step={1} testid="input-gb-lobes"
                      onChange={(v) => updateGearbox({ lobes: Math.round(v) })} />
                    <Dim label="Eje ⌀" value={sketch.gearbox.shaftD} unit="mm" min={8} max={30} step={1} testid="input-gb-shaft"
                      onChange={(v) => updateGearbox({ shaftD: v })} />
                    <Dim label="Eje hueco ⌀" value={sketch.gearbox.shaftBore} unit="mm" min={0} max={20} step={1} testid="input-gb-bore"
                      onChange={(v) => updateGearbox({ shaftBore: v })} />
                    <div className="fb-divider" />
                    <div className="fb-panel-title" style={{ marginTop: 0 }}>¿Resiste? · {printMaterial}</div>
                    <Dim label="Par de salida" value={gbTorque} unit="N·m" min={5} max={300} step={5} testid="input-gb-torque"
                      onChange={(v) => setGbTorque(v)} />
                    {(() => {
                      const gbm = (printMaterial === 'TPU' ? 'Nylon' : printMaterial) as GbMaterial;
                      const a = analyzeGearbox(
                        { lobes: sketch.gearbox.lobes, discs: sketch.gearbox.discs, shaftD: sketch.gearbox.shaftD, shaftBore: sketch.gearbox.shaftBore, pinCircleR: sketch.gearbox.R, outPinR: sketch.gearbox.Rr, outPinCount: 6 },
                        { outputTorqueNm: gbTorque, material: gbm },
                      );
                      return (
                        <div className="fb-mass">
                          <div className={`fb-print-fits ${a.survives ? 'ok' : 'bad'}`} data-testid="gb-survives">
                            {a.survives ? '✓ SOBREVIVE' : '✕ SE ROMPE — + discos / Nylon / eje más grueso'}
                          </div>
                          <Row k="Reducción" v={`${a.ratio}:1`} testid="gb-ratio" />
                          <Row k="Balance del eje" v={a.balanced ? 'balanceado ✓' : 'DESBALANCEADO ✕'} hi={!a.balanced} testid="gb-balance" />
                          <Row k="Esfuerzo eje" v={`${a.shaftStressMPa} / ${a.allowableShearMPa} MPa`} testid="gb-shaft" />
                          <Row k={`Esfuerzo perno ×${sketch.gearbox.discs}`} v={`${a.pinStressMPa} / ${a.allowableShearMPa} MPa`} testid="gb-pin" />
                        </div>
                      );
                    })()}
                  </>
                ) : sketch.kind === 'gear' ? (
                  <>
                    {/* ── ENGRANE de INVOLUTA (7º clásico) ──────────────────────
                        Perfil de involuta real (rb = rp·cos α, inv α = tan α − α)
                        desde lib/parts/involute-gear-sketch.ts → extrudePolygon →
                        resta del barreno. rp = m·Z/2 (diámetro primitivo = m·Z). */}
                    <p className="fb-hint-txt">
                      Involuta real: rp = m·Z/2, rb = rp·cos α, inv α = tan α − α.
                      Perfil → extrude → barreno central. Vol = A·esp − π(bore/2)²·esp.
                    </p>
                    <Dim label="Módulo m" value={sketch.gear.module} unit="mm" min={0.5} max={6} step={0.5}
                      testid="input-modulo" onChange={(v) => updateGear({ module: v })} />
                    <Dim label="Dientes Z" value={sketch.gear.teeth} unit="" min={8} max={60} step={1}
                      testid="input-dientes" onChange={(v) => updateGear({ teeth: Math.round(v) })} />
                    <Dim label="Áng. presión α" value={sketch.gear.pressureDeg} unit="°" min={14} max={30} step={1}
                      testid="input-presion" onChange={(v) => updateGear({ pressureDeg: v })} />
                    <Dim label="Espesor" value={sketch.gear.thickness} unit="mm" min={2} max={40} step={1}
                      testid="input-espesor-engrane" onChange={(v) => updateGear({ thickness: v })} />
                    <Dim label="Barreno ⌀" value={sketch.gear.bore} unit="mm" min={0} max={40} step={0.5}
                      testid="input-bore" onChange={(v) => updateGear({ bore: v })} />
                    {(() => {
                      const gp = gearSketchParams(sketch.gear);
                      const geo = deriveGearGeometry(gp);
                      return (
                        <div className="fb-sel-head">
                          rp <b data-testid="gear-rp">{geo.pitchRadius.toFixed(2)}</b> mm ·
                          ⌀prim <b data-testid="gear-dp">{(geo.pitchRadius * 2).toFixed(1)}</b> ·
                          rb <b>{geo.baseRadius.toFixed(2)}</b> mm
                        </div>
                      );
                    })()}

                    {/* ── ENSAMBLE: CAJA DE VELOCIDADES (dos engranes que embonan) ──
                        El engrane 1 es ESTE sketch (centro en el origen). El 2 es una
                        2ª instancia con su propio Z₂; el MATE lo coloca a
                        C = m·(Z₁+Z₂)/2 sobre +X y lo fasea π−π/Z₂ para que embonen.
                        El invariante de que EMBONAN: interferencia Common(g1,g2)≈0. */}
                    <div className="fb-divider" />
                    <div className="fb-panel-title" style={{ marginTop: 0 }}>Ensamble · Caja de velocidades</div>
                    {!assembly.enabled ? (
                      <button className="fb-pick-btn" data-testid="btn-add-gear2" onClick={addGear2}>
                        + Agregar 2º engrane
                      </button>
                    ) : (
                      <>
                        <Dim label="Dientes Z₂" value={assembly.teeth2} unit="" min={8} max={80} step={1}
                          testid="input-dientes2" onChange={(v) => setTeeth2(v)} />
                        {(() => {
                          const mate = gearMateGeometry(sketch.gear, assembly.teeth2);
                          const asm = result?.assembly;
                          return (
                            <>
                              <div className="fb-sel-head">
                                C = m·(Z₁+Z₂)/2 = <b data-testid="mate-C">{mate.centerDistance.toFixed(2)}</b> mm
                                {asm && <span> · medido <b data-testid="mate-C-measured">{asm.centerDistanceMeasured.toFixed(2)}</b></span>}
                              </div>
                              <div className="fb-sel-head">
                                Relación i = Z₂/Z₁ = <b data-testid="mate-ratio">{mate.ratio.toFixed(3)}</b> ·
                                faseo φ₂ = <b data-testid="mate-phase">{(mate.phase2 * 180 / Math.PI).toFixed(1)}</b>°
                              </div>
                              <div className="fb-sel-head">
                                Faseado <b data-testid="mate-faseado">{assembly.mated ? 'aplicado ✓' : 'pendiente'}</b>
                                {asm && (
                                  <span> · interferencia <b data-testid="mate-interference">{asm.interferenceVolume.toFixed(3)}</b> mm³
                                    {' '}({(asm.interferenceFraction * 100).toFixed(3)}%)</span>
                                )}
                              </div>
                            </>
                          );
                        })()}
                        <button className="fb-pick-btn" data-testid="btn-gear-mate" onClick={applyGearMate}>
                          {assembly.mated ? '↻ Re-aplicar mate de engrane' : '⚙ Aplicar mate de engrane'}
                        </button>

                        {/* DRIVER CINEMÁTICO: ángulo de entrada θ. La entrada gira
                            θ y la salida −θ·(Z₁/Z₂) automáticamente (relación i). */}
                        {assembly.mated && (() => {
                          const mate = gearMateGeometry(sketch.gear, assembly.teeth2);
                          const asm = result?.assembly;
                          const inDeg = (assembly.driveAngle * 180) / Math.PI;
                          const outDeg = asm ? (asm.outputAngle * 180) / Math.PI : 0;
                          const iMeasured = asm && Math.abs(asm.outputAngle) > 1e-9
                            ? Math.abs(asm.driveAngle / asm.outputAngle)
                            : mate.ratio;
                          return (
                            <>
                              <div className="fb-divider" />
                              <div className="fb-panel-title" style={{ marginTop: 0 }}>Driver · ángulo de entrada</div>
                              <Dim label="θ entrada" value={inDeg} unit="°" min={-180} max={180} step={1}
                                testid="input-angulo-entrada" onChange={(v) => setDriveAngleDeg(v)} />
                              <div className="fb-sel-head">
                                θ salida = −θ·(Z₁/Z₂) = <b data-testid="disp-angulo-salida">{outDeg.toFixed(1)}</b>°
                              </div>
                              <div className="fb-sel-head">
                                Relación i = ω₁/ω₂ = <b data-testid="disp-relacion">{iMeasured.toFixed(3)}</b>
                                {' '}(= Z₂/Z₁ = {mate.ratio.toFixed(3)})
                              </div>
                            </>
                          );
                        })()}

                        {/* VERIFICACIÓN RIGUROSA DE EMBONADO: barrido de Common(g1,g2)
                            sobre un paso de diente → max_interferencia ≈ 0 ⇒ embonan. */}
                        {assembly.mated && (
                          <>
                            <div className="fb-divider" />
                            <button className="fb-pick-btn" data-testid="btn-verificar-embonado"
                              onClick={verifyMeshing} disabled={meshSweepBusy}>
                              {meshSweepBusy ? '⏳ Barriendo rotación…' : '🔍 Verificar embonado (barrido)'}
                            </button>
                            {meshSweep && (() => {
                              const embonan = Number.isFinite(meshSweep.maxInterferenceFraction)
                                && meshSweep.maxInterferenceFraction < 5e-3; // < 0.5% de un diente
                              return (
                                <div className={`fb-sel-head ${embonan ? 'ok' : 'warn'}`}>
                                  max interferencia = <b data-testid="disp-max-interferencia">{meshSweep.maxInterference.toFixed(4)}</b> mm³
                                  {' '}({(meshSweep.maxInterferenceFraction * 100).toFixed(3)}% de un diente,
                                  {' '}{meshSweep.samples} ángulos) ·{' '}
                                  <b data-testid="disp-embonan">{embonan ? 'EMBONAN ✓' : 'INTERFIEREN ✕'}</b>
                                </div>
                              );
                            })()}
                          </>
                        )}

                        {/* MONTAJE DE COMPONENTES: flechas (una por engrane, coaxial
                            al barreno, con holgura) + carcasa (caja vaciada con 2
                            baleros a la distancia C). Se añaden al compound del
                            ensamble sin tocar el embonado engrane↔engrane. */}
                        {assembly.mated && (
                          <>
                            <div className="fb-divider" />
                            <div className="fb-panel-title" style={{ marginTop: 0 }}>Ensamble · Componentes</div>
                            <label className="fb-check">
                              <input type="checkbox" data-testid="chk-shafts"
                                checked={assembly.shafts}
                                onChange={(e) => setAssembly((a) => ({ ...a, shafts: e.target.checked }))} />
                              <span>Montar 2 flechas (⌀{(Math.max(1, sketch.gear.bore - 2 * 0.4)).toFixed(1)} mm, coaxiales a los barrenos)</span>
                            </label>
                            <label className="fb-check">
                              <input type="checkbox" data-testid="chk-housing"
                                checked={assembly.housing}
                                onChange={(e) => setAssembly((a) => ({ ...a, housing: e.target.checked }))} />
                              <span>Montar carcasa (caja + shell + 2 baleros a C)</span>
                            </label>
                            {(() => {
                              const asm = result?.assembly;
                              if (!asm) return null;
                              return (
                                <div className="fb-sel-head" data-testid="asm-componentes">
                                  Componentes: <b data-testid="asm-n-componentes">{asm.components.length}</b>
                                  {' '}({asm.components.join(' · ')})
                                  {asm.shafts && <span> · flechas <b data-testid="asm-vol-flechas">{asm.volShafts.toFixed(0)}</b> mm³</span>}
                                  {asm.housing && <span> · carcasa <b data-testid="asm-vol-carcasa">{asm.volHousing.toFixed(0)}</b> mm³</span>}
                                  {' '}· compound <b data-testid="asm-vol-compound">{asm.volCompound.toFixed(0)}</b> mm³
                                </div>
                              );
                            })()}
                          </>
                        )}

                        <button className="fb-del-btn" data-testid="btn-remove-gear2" onClick={removeGear2}>
                          ✕ Quitar 2º engrane
                        </button>
                      </>
                    )}
                  </>
                ) : sketch.kind === 'revprofile' ? (
                  <>
                    {/* CROQUIS POLIGONAL ESCALONADO para revolución: cada escalón es
                        un par (radio r, longitud L) a UN lado del eje Y. El sólido
                        revolvido tiene vol = Σ π·r_i²·L_i. */}
                    <p className="fb-hint-txt">
                      Perfil a un lado del eje Y. Revolve 360° → cilindro (1 escalón)
                      o flecha con hombros (varios). Vol = Σ π·r²·L.
                    </p>
                    <div className="fb-seg">
                      <button data-testid="preset-cilindro"
                        onClick={() => setSteps([{ r: 14, L: 40 }])}>Cilindro</button>
                      <button data-testid="preset-flecha"
                        onClick={() => setSteps([{ r: 10, L: 20 }, { r: 15, L: 30 }, { r: 10, L: 20 }])}>Flecha 3</button>
                    </div>
                    <div className="fb-steps" data-testid="rev-steps">
                      {sketch.steps.map((st, i) => (
                        <div className="fb-step-row" data-testid={`step-row-${i}`} key={i}>
                          <span className="fb-step-idx">#{i}</span>
                          <Dim label={`r${i}`} value={st.r} unit="mm" min={2} max={50} step={1}
                            testid={`step-r-${i}`} onChange={(v) => updateStep(i, { r: v })} />
                          <Dim label={`L${i}`} value={st.L} unit="mm" min={2} max={80} step={1}
                            testid={`step-l-${i}`} onChange={(v) => updateStep(i, { L: v })} />
                          <button className="fb-step-del" data-testid={`step-del-${i}`}
                            onClick={() => removeStep(i)} title="Quitar escalón">✕</button>
                        </div>
                      ))}
                    </div>
                    <button className="fb-pick-btn" data-testid="btn-add-step" onClick={addStep}>
                      + Agregar escalón
                    </button>
                    <div className="fb-sel-head">
                      Vol esperado <b data-testid="vol-esperado-steps">
                        {(sketch.steps.reduce((a, s) => a + Math.PI * s.r * s.r * s.L, 0)).toFixed(1)}
                      </b> mm³
                    </div>
                  </>
                ) : (
                  <>
                    <Dim label="Ancho" value={sketch.width} unit="mm" min={6} max={100} step={1} testid="input-ancho" bindKey="sketch:width"
                      onChange={(v) => setSketch((s) => ({ ...s, width: v }))} />
                    <Dim label="Alto" value={sketch.height} unit="mm" min={6} max={100} step={1} testid="input-alto" bindKey="sketch:height"
                      onChange={(v) => setSketch((s) => ({ ...s, height: v }))} />
                    {sketch.kind === 'lprofile' && (
                      <Dim label="Ancho de pata" value={sketch.legW} unit="mm" min={3} max={40} step={1} testid="input-pata"
                        onChange={(v) => setSketch((s) => ({ ...s, legW: v }))} />
                    )}
                  </>
                )}
              </>
            )}

            {activeOpObj?.type === 'extrude' && (
              <>
                <div className="fb-panel-title">Extrude · Boss/Base</div>
                <Dim label="Altura" value={activeOpObj.depth} unit="mm" min={2} max={80} step={1} testid="input-altura" bindKey={`${activeOpObj.id}:depth`}
                  onChange={(v) => updateOp(activeOpObj.id, { depth: v } as Partial<Op>)} />
                <label className="fb-check">
                  <input type="checkbox" data-testid="chk-simetrico" checked={activeOpObj.symmetric}
                    onChange={(e) => updateOp(activeOpObj.id, { symmetric: e.target.checked } as Partial<Op>)} />
                  Simétrico al plano
                </label>
              </>
            )}

            {activeOpObj?.type === 'hole' && (
              <>
                <div className="fb-panel-title">Hole · Barreno</div>
                <Dim label="Diámetro" value={activeOpObj.diameter} unit="mm" min={1} max={40} step={0.5} testid="input-diametro" bindKey={`${activeOpObj.id}:diameter`}
                  onChange={(v) => updateOp(activeOpObj.id, { diameter: v } as Partial<Op>)} />
                <Dim label="Posición X" value={activeOpObj.x} unit="mm" min={-50} max={50} step={1} testid="input-pos-x"
                  onChange={(v) => updateOp(activeOpObj.id, { x: v } as Partial<Op>)} />
                <Dim label="Posición Y" value={activeOpObj.y} unit="mm" min={-50} max={50} step={1} testid="input-pos-y"
                  onChange={(v) => updateOp(activeOpObj.id, { y: v } as Partial<Op>)} />
                <label className="fb-check">
                  <input type="checkbox" data-testid="chk-pasante" checked={activeOpObj.through}
                    onChange={(e) => updateOp(activeOpObj.id, { through: e.target.checked } as Partial<Op>)} />
                  Pasante (through all)
                </label>
                {!activeOpObj.through && (
                  <Dim label="Profundidad" value={activeOpObj.depth} unit="mm" min={1} max={80} step={1} testid="input-prof-barreno"
                    onChange={(v) => updateOp(activeOpObj.id, { depth: v } as Partial<Op>)} />
                )}
              </>
            )}

            {(activeOpObj?.type === 'fillet' || activeOpObj?.type === 'chamfer') && (
              <>
                <div className="fb-panel-title">{activeOpObj.type === 'fillet' ? 'Fillet · Redondeo' : 'Chamfer · Bisel'}</div>
                <Dim
                  label={activeOpObj.type === 'fillet' ? 'Radio' : 'Distancia'}
                  value={activeOpObj.type === 'fillet' ? activeOpObj.radius : activeOpObj.dist}
                  unit="mm" min={0.5} max={12} step={0.5}
                  testid={activeOpObj.type === 'fillet' ? 'input-radio-fillet' : 'input-dist-chamfer'}
                  onChange={(v) => updateOp(activeOpObj.id,
                    (activeOpObj.type === 'fillet' ? { radius: v } : { dist: v }) as Partial<Op>)}
                />
                <div className="fb-sel-head">
                  Aristas <b data-testid="count-edges-sel">{(activeOpObj.edges).length}</b> seleccionadas
                  {(activeOpObj.edges).length === 0 && <em> (vacío = todas)</em>}
                </div>
                <button className="fb-pick-btn" data-testid="btn-pick-edge"
                  onClick={() => setPickMode((m) => (m === 'edge' ? 'none' : 'edge'))}>
                  {pickMode === 'edge' ? '◉ Picking activo' : '○ Seleccionar en viewport'}
                </button>
                <div className="fb-sel-list" data-testid="edge-list">
                  {(result?.edges ?? []).map((ed) => (
                    <button key={ed.index}
                      data-testid={`edge-item-${ed.index}`}
                      className={activeOpObj.edges.includes(ed.index) ? 'sel' : ''}
                      onClick={() => togglePickEdge(ed.index)}>
                      Arista {ed.index} · {ed.kind} · {ed.length.toFixed(1)}mm
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeOpObj?.type === 'shell' && (
              <>
                <div className="fb-panel-title">Shell · Vaciado</div>
                <Dim label="Espesor de pared" value={activeOpObj.thickness} unit="mm" min={0.5} max={10} step={0.5} testid="input-espesor"
                  onChange={(v) => updateOp(activeOpObj.id, { thickness: v } as Partial<Op>)} />
                <div className="fb-sel-head">
                  Caras abiertas <b data-testid="count-faces-sel">{activeOpObj.faces.length}</b>
                </div>
                <button className="fb-pick-btn" data-testid="btn-pick-face"
                  onClick={() => setPickMode((m) => (m === 'face' ? 'none' : 'face'))}>
                  {pickMode === 'face' ? '◉ Picking activo' : '○ Seleccionar cara en viewport'}
                </button>
                <div className="fb-sel-list" data-testid="face-list">
                  {(result?.faces ?? []).map((f) => (
                    <button key={f.index}
                      data-testid={`face-${f.index}`}
                      className={activeOpObj.faces.includes(f.index) ? 'sel' : ''}
                      onClick={() => togglePickFace(f.index)}>
                      Cara {f.index} · {f.kind} · {f.area.toFixed(0)}mm²
                    </button>
                  ))}
                </div>
              </>
            )}

            {activeOpObj?.type === 'revolve' && (
              <>
                <div className="fb-panel-title">Revolve · Revolución</div>
                <Dim label="Ángulo" value={activeOpObj.angle} unit="°" min={10} max={360} step={5} testid="input-angulo"
                  onChange={(v) => updateOp(activeOpObj.id, { angle: v } as Partial<Op>)} />

                {/* EJE de revolución (gp_Ax1): presets GLOBALES X/Y/Z o la arista
                    RECTA elegida por clic. El perfil debe quedar a UN lado del eje. */}
                <div className="fb-sel-head">Eje de revolución</div>
                <div className="fb-seg">
                  <button data-testid="axis-x" className={activeOpObj.axis === 'x' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { axis: 'x' } as Partial<Op>)}>X</button>
                  <button data-testid="axis-y" className={activeOpObj.axis === 'y' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { axis: 'y' } as Partial<Op>)}>Y</button>
                  <button data-testid="axis-z" className={activeOpObj.axis === 'z' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { axis: 'z' } as Partial<Op>)}>Z</button>
                  <button data-testid="axis-edge" className={activeOpObj.axis === 'edge' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { axis: 'edge' } as Partial<Op>)}>Arista</button>
                </div>
                {activeOpObj.axis === 'edge' && (
                  <>
                    <button className="fb-pick-btn" data-testid="btn-pick-edge"
                      onClick={enableEdgePick}>
                      {pickMode === 'edge' ? '◉ Picking de arista activo' : '○ Clic en arista (viewport)'}
                    </button>
                    <div className="fb-sel-head">
                      Eje = arista <b>{selectedEdgeId != null ? `#${selectedEdgeId}` : '—'}</b>
                      {selectedEdgeId != null &&
                        !result?.edgeGeoms.find((g) => g.edgeId === selectedEdgeId)?.axis &&
                        <em> (no es recta)</em>}
                    </div>
                    <div className="fb-sel-list" data-testid="edge-list">
                      {(result?.edgeGeoms ?? []).filter((g) => g.kind === 'line').map((g) => (
                        <button key={g.edgeId}
                          data-testid={`edge-item-${g.edgeId}`}
                          className={selectedEdgeId === g.edgeId ? 'sel' : ''}
                          onClick={() => togglePickEdge(g.edgeId)}>
                          Arista {g.edgeId} · recta · {g.length.toFixed(1)}mm
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <p className="fb-hint-txt">
                  Eje global X/Y/Z o una arista recta del sólido actual. El perfil gira a UN lado del eje.
                </p>
              </>
            )}

            {activeOpObj?.type === 'pocket' && (
              <>
                <div className="fb-panel-title">Corte · Bolsillo</div>
                <div className="fb-seg">
                  <button data-testid="pocket-rect" className={activeOpObj.profile === 'rect' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { profile: 'rect' } as Partial<Op>)}>Rect</button>
                  <button data-testid="pocket-circle" className={activeOpObj.profile === 'circle' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { profile: 'circle' } as Partial<Op>)}>Círculo</button>
                </div>
                <Dim label="Posición X" value={activeOpObj.x} unit="mm" min={-50} max={50} step={1} testid="input-pocket-x"
                  onChange={(v) => updateOp(activeOpObj.id, { x: v } as Partial<Op>)} />
                <Dim label="Posición Y" value={activeOpObj.y} unit="mm" min={-50} max={50} step={1} testid="input-pocket-y"
                  onChange={(v) => updateOp(activeOpObj.id, { y: v } as Partial<Op>)} />
                {activeOpObj.profile === 'circle' ? (
                  <Dim label="Diámetro" value={activeOpObj.diameter} unit="mm" min={1} max={60} step={0.5} testid="input-pocket-dia"
                    onChange={(v) => updateOp(activeOpObj.id, { diameter: v } as Partial<Op>)} />
                ) : (
                  <>
                    <Dim label="Ancho" value={activeOpObj.w} unit="mm" min={1} max={80} step={1} testid="input-pocket-w" bindKey={`${activeOpObj.id}:w`}
                      onChange={(v) => updateOp(activeOpObj.id, { w: v } as Partial<Op>)} />
                    <Dim label="Alto" value={activeOpObj.h} unit="mm" min={1} max={80} step={1} testid="input-pocket-h" bindKey={`${activeOpObj.id}:h`}
                      onChange={(v) => updateOp(activeOpObj.id, { h: v } as Partial<Op>)} />
                  </>
                )}
                <label className="fb-check">
                  <input type="checkbox" data-testid="chk-pocket-through" checked={activeOpObj.through}
                    onChange={(e) => updateOp(activeOpObj.id, { through: e.target.checked } as Partial<Op>)} />
                  <span>Pasante (atraviesa todo)</span>
                </label>
                {!activeOpObj.through && (
                  <Dim label="Profundidad" value={activeOpObj.depth} unit="mm" min={1} max={80} step={1} testid="input-pocket-depth"
                    onChange={(v) => updateOp(activeOpObj.id, { depth: v } as Partial<Op>)} />
                )}
                <p className="fb-hint-txt">Resta el perfil del sólido (cut exacto). Ranuras, cajeras, chaveteros.</p>
              </>
            )}

            {activeOpObj?.type === 'pattern' && (
              <>
                <div className="fb-panel-title">Patrón · Arreglo</div>
                <div className="fb-seg">
                  <button data-testid="pat-linear" className={activeOpObj.mode === 'linear' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { mode: 'linear' } as Partial<Op>)}>Lineal</button>
                  <button data-testid="pat-circular" className={activeOpObj.mode === 'circular' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { mode: 'circular' } as Partial<Op>)}>Circular</button>
                  <button data-testid="pat-mirror" className={activeOpObj.mode === 'mirror' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { mode: 'mirror' } as Partial<Op>)}>Espejo</button>
                </div>

                {activeOpObj.mode === 'linear' && (
                  <>
                    <Dim label="Instancias" value={activeOpObj.count} unit="" min={2} max={32} step={1} testid="input-pat-count"
                      onChange={(v) => updateOp(activeOpObj.id, { count: Math.round(v) } as Partial<Op>)} />
                    <Dim label="Paso X" value={activeOpObj.dx} unit="mm" min={-100} max={100} step={1} testid="input-pat-dx"
                      onChange={(v) => updateOp(activeOpObj.id, { dx: v } as Partial<Op>)} />
                    <Dim label="Paso Y" value={activeOpObj.dy} unit="mm" min={-100} max={100} step={1} testid="input-pat-dy"
                      onChange={(v) => updateOp(activeOpObj.id, { dy: v } as Partial<Op>)} />
                    <p className="fb-hint-txt">Rejilla i·(ΔX,ΔY). Vol = N × vol_base (instancias disjuntas).</p>
                  </>
                )}
                {activeOpObj.mode === 'circular' && (
                  <>
                    <Dim label="Instancias" value={activeOpObj.count} unit="" min={2} max={48} step={1} testid="input-pat-count"
                      onChange={(v) => updateOp(activeOpObj.id, { count: Math.round(v) } as Partial<Op>)} />
                    <Dim label="Ángulo total" value={activeOpObj.angleSpan} unit="°" min={30} max={360} step={5} testid="input-pat-span"
                      onChange={(v) => updateOp(activeOpObj.id, { angleSpan: v } as Partial<Op>)} />
                    <div className="fb-sel-head">Eje de giro (global, por el origen)</div>
                    <div className="fb-seg">
                      <button data-testid="pat-axis-x" className={activeOpObj.axis === 'x' ? 'on' : ''}
                        onClick={() => updateOp(activeOpObj.id, { axis: 'x' } as Partial<Op>)}>X</button>
                      <button data-testid="pat-axis-y" className={activeOpObj.axis === 'y' ? 'on' : ''}
                        onClick={() => updateOp(activeOpObj.id, { axis: 'y' } as Partial<Op>)}>Y</button>
                      <button data-testid="pat-axis-z" className={activeOpObj.axis === 'z' ? 'on' : ''}
                        onClick={() => updateOp(activeOpObj.id, { axis: 'z' } as Partial<Op>)}>Z</button>
                    </div>
                    <p className="fb-hint-txt">Bolt-circle alrededor del eje. El cuerpo debe estar DESCENTRADO del eje.</p>
                  </>
                )}
                {activeOpObj.mode === 'mirror' && (
                  <>
                    <div className="fb-sel-head">Plano de espejo (por el origen)</div>
                    <div className="fb-seg">
                      <button data-testid="pat-plane-yz" className={activeOpObj.plane === 'yz' ? 'on' : ''}
                        onClick={() => updateOp(activeOpObj.id, { plane: 'yz' } as Partial<Op>)}>YZ (en X)</button>
                      <button data-testid="pat-plane-zx" className={activeOpObj.plane === 'zx' ? 'on' : ''}
                        onClick={() => updateOp(activeOpObj.id, { plane: 'zx' } as Partial<Op>)}>ZX (en Y)</button>
                      <button data-testid="pat-plane-xy" className={activeOpObj.plane === 'xy' ? 'on' : ''}
                        onClick={() => updateOp(activeOpObj.id, { plane: 'xy' } as Partial<Op>)}>XY (en Z)</button>
                    </div>
                    <p className="fb-hint-txt">Refleja el sólido y lo fusiona. Para simetría: cuerpo a un lado del plano.</p>
                  </>
                )}
              </>
            )}

            {activeOpObj && (
              <button className="fb-del-btn" data-testid="btn-del-op" onClick={() => removeOp(activeOpObj.id)}>
                ✕ Eliminar feature
              </button>
            )}
            {/* Exportar STEP/STL y Mostrar/Ocultar boceto se movieron al menú ⋮ Opciones (header). */}
          </aside>

          {/* ── Panel de ANÁLISIS / PROPIEDADES (masa exacta GProp) ── */}
          <aside className={`fb-analysis ${collapsed.analysis ? 'collapsed' : ''}`} data-testid="analysis-panel">
            <CollapseHead id="analysis" title="Análisis · Propiedades" collapsed={!!collapsed.analysis}
              onToggle={() => toggleCollapse('analysis')} />
            <label className="fb-mat">
              <span>Material</span>
              <span className="fb-mat-pick">
                <i className="fb-mat-swatch" style={{ background: (MATERIAL_PBR[material] ?? DEFAULT_PBR).color }} />
                <select data-testid="select-material" value={material}
                  onChange={(e) => setMaterial(e.target.value as keyof typeof MATERIALS)}>
                  {Object.entries(MATERIALS).map(([k, m]) => (
                    <option key={k} value={k}>{m.label}</option>
                  ))}
                </select>
              </span>
            </label>
            {result ? (
              <div className="fb-mass">
                <Row k="Volumen" v={`${result.volKernel.toFixed(2)} mm³`} testid="an-volumen" />
                <Row k="Área" v={`${result.area.toFixed(1)} mm²`} testid="an-area" />
                <Row k="Densidad" v={`${(mat.density * 1000).toFixed(2)} g/cm³`} />
                <Row k="Masa" v={`${result.mass.mass.toFixed(3)} g`} hi testid="an-masa" />
                <Row k="Centro de masa"
                  v={`(${result.mass.centerOfMass.map((c) => c.toFixed(1)).join(', ')}) mm`}
                  testid="an-com" />
                <Row k="Inercia principal"
                  v={result.mass.principal.map((p) => p.toExponential(2)).join(' · ')}
                  testid="an-inercia" />

                {/* ── IMPRIMIBILIDAD (DFM) — el portero antes de imprimir ── */}
                <div className="fb-divider" />
                <div className="fb-print-head">
                  <span>🖨 Imprimibilidad</span>
                  <select data-testid="select-print-mat" value={printMaterial}
                    onChange={(e) => setPrintMaterial(e.target.value as PrintProfile['material'])}>
                    {['PLA', 'PETG', 'ABS', 'TPU', 'Nylon'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                  <select data-testid="select-print-bed" value={printProfileKey}
                    onChange={(e) => setPrintProfileKey(e.target.value as keyof typeof PRINT_PROFILES)}>
                    <option value="ender3">220³</option>
                    <option value="media">256³</option>
                    <option value="grande">350×350×400</option>
                  </select>
                </div>
                {printReport && (
                  <div className="fb-mass">
                    <div className={`fb-print-fits ${printReport.fits ? 'ok' : 'bad'}`} data-testid="print-fits">
                      {printReport.fits ? '✓ Cabe en la impresora' : '✕ NO cabe — reorienta o parte'}
                      <em> {printReport.bbox.w}×{printReport.bbox.d}×{printReport.bbox.h} mm</em>
                    </div>
                    <Row k="Voladizos (soporte)"
                      v={printReport.triSupport === 0 ? 'ninguno ✓' : `${printReport.overhangPct}% · ~${printReport.supportVolEstMm3.toFixed(0)} mm³`}
                      hi={printReport.triSupport > 0} testid="print-overhang" />
                    <Row k="Holgura print-in-place" v={`${printReport.clearance} mm`} testid="print-clear" />
                    <Row k="Compensar barrenos" v={`+${printReport.holeComp} mm`} testid="print-holecomp" />
                    <button className={`fb-overhang-btn ${showOverhangs ? 'on' : ''}`} data-testid="btn-overhangs"
                      onClick={() => setShowOverhangs((v) => !v)}>
                      {showOverhangs ? '◼ Ocultar voladizos' : '◻ Ver voladizos (mapa)'}
                    </button>
                  </div>
                )}

                {/* ── SECCIÓN: corte por plano (ver caras internas) ── */}
                <div className="fb-divider" />
                <div className="fb-print-head">
                  <span>✂ Sección</span>
                  <button className={`fb-sec-toggle ${sectionOn ? 'on' : ''}`} data-testid="btn-section"
                    onClick={() => setSectionOn((v) => !v)}>{sectionOn ? 'ON' : 'OFF'}</button>
                </div>
                {sectionOn && (
                  <div className="fb-mass">
                    <div className="fb-seg">
                      {(['x', 'y', 'z'] as const).map((ax) => (
                        <button key={ax} data-testid={`sec-axis-${ax}`} className={sectionAxis === ax ? 'on' : ''}
                          onClick={() => setSectionAxis(ax)}>{ax.toUpperCase()}</button>
                      ))}
                      <button data-testid="sec-flip" className={sectionFlip ? 'on' : ''} onClick={() => setSectionFlip((v) => !v)}>⇄</button>
                    </div>
                    <Dim label="Posición del corte" value={sectionOffset} unit="" min={-1} max={1} step={0.02} testid="input-sec-offset"
                      onChange={(v) => setSectionOffset(v)} />
                  </div>
                )}
              </div>
            ) : (
              <div className="fb-mass"><Row k="Estado" v="construyendo…" /></div>
            )}
          </aside>

          {/* ── Panel de SIMULACIÓN (FEA von Mises REAL) ──
              El CAD pasa de "ver" a "ANALIZAR": resuelve K·u=f sobre una malla
              tet del sólido (reusa el motor de src/lib/formulas.ts) y colorea la
              pieza por von Mises. Cara FIJA = empotramiento; cara de CARGA +
              magnitud (N) a lo largo de su normal. Material = el del análisis de
              masa (E, ν, σ_y de MATERIAL_DATABASE). */}
          <aside className="fb-sim" data-testid="sim-panel">
            <div className="fb-panel-title">Simulación · von Mises (FEA real)</div>
            <p className="fb-hint-txt">
              Resuelve K·u = f en malla tet del sólido (no es heatmap: es FEM).
              σ_vM, factor de seguridad σ_y/σ_max y deflexión máx.
            </p>

            <div className="fb-sim-bc">
              <div className="fb-sim-bc-row">
                <button className="fb-pick-btn" data-testid="btn-pick-fija"
                  onClick={() => startFeaPick('fija')}
                  style={feaPickTarget === 'fija' ? { background: `${GOLD}33` } : undefined}>
                  {feaPickTarget === 'fija' ? '◉ Clic en cara FIJA…' : '○ Cara FIJA (empotrar)'}
                </button>
                <span className="fb-sim-tag" data-testid="fea-fija-id">
                  {feaFixedFace != null ? `#${feaFixedFace}` : '—'}
                </span>
              </div>
              <div className="fb-sim-bc-row">
                <button className="fb-pick-btn" data-testid="btn-pick-carga"
                  onClick={() => startFeaPick('carga')}
                  style={feaPickTarget === 'carga' ? { background: `${GOLD}33` } : undefined}>
                  {feaPickTarget === 'carga' ? '◉ Clic en cara de CARGA…' : '○ Cara de CARGA'}
                </button>
                <span className="fb-sim-tag" data-testid="fea-carga-id">
                  {feaLoadFace != null ? `#${feaLoadFace}` : '—'}
                </span>
              </div>
            </div>

            <Dim label="Carga" value={feaLoadN} unit="N" min={10} max={50000} step={10}
              testid="input-carga"
              onChange={(v) => { if (feaSessionRef.current) feaLiveSetLoad(v); else setFeaLoadN(v); }} />

            <button className="fb-fea-run" data-testid="btn-fea"
              onClick={() => runFeaAnalysis()} disabled={feaBusy || !oc || feaFixedFace == null}>
              {feaBusy ? '⏳ Resolviendo K·u = f…' : '▶ Analizar (von Mises)'}
            </button>
            {feaColors && (
              <button className="fb-sim-clear" data-testid="btn-fea-clear" onClick={clearFeaOverlay}>
                Quitar overlay (volver a metal)
              </button>
            )}
            {feaErr && <div className="fb-sim-err" data-testid="fea-error">{feaErr}</div>}

            {/* ── DISEÑO GENERATIVO: misma cara fija + carga; vacía hasta la forma óptima ── */}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${GOLD}22` }}>
              <Dim label="Material objetivo" value={Math.round(genVolfrac * 100)} unit="%" min={10} max={80} step={5}
                testid="input-volfrac" onChange={(v) => setGenVolfrac(Math.max(0.1, Math.min(0.8, v / 100)))} />
              <button className="fb-fea-run" data-testid="btn-generativo"
                onClick={() => runGenerative()} disabled={genBusy || !oc || feaFixedFace == null}
                style={{ background: GOLD, color: '#1a1206', fontWeight: 700 }}>
                {genBusy ? '⚡ Optimizando topología…' : '⚡ Diseño generativo'}
              </button>
              {genResult && (
                <>
                  <Dim label="Umbral visible" value={Math.round(genThreshold * 100)} unit="%" min={5} max={90} step={5}
                    testid="input-umbral" onChange={(v) => setGenThreshold(Math.max(0.05, Math.min(0.9, v / 100)))} />
                  <div className="fb-row hi">
                    <span className="rk">Material quitado</span>
                    <span className="rv" data-testid="gen-void">{Math.round(genVoidPct)}%</span>
                  </div>
                  <button className="fb-sim-clear" data-testid="btn-gen-smooth" onClick={() => setGenSmooth((s) => !s)}>
                    {genSmooth ? '◼ Ver voxeles (crudo)' : '⬭ Ver superficie suave'}
                  </button>
                  <button className="fb-sim-clear" data-testid="btn-gen-clear" onClick={clearGenerative}>
                    Volver al sólido
                  </button>
                </>
              )}
              {genErr && <div className="fb-sim-err" data-testid="gen-error">{genErr}</div>}
            </div>

            {feaResult ? (
              <div className="fb-sim-out">
                <div className="fb-row hi">
                  <span className="rk">Máx von Mises</span>
                  <span className="rv" data-testid="fea-max-vm">{(feaResult.maxVonMises / 1e6).toFixed(2)} MPa</span>
                </div>
                <div className={`fb-row ${feaResult.minSafetyFactor < 1 ? 'fs-bad' : 'fs-ok'}`}>
                  <span className="rk">Factor de seguridad</span>
                  <span className="rv" data-testid="fea-fs">
                    {Number.isFinite(feaResult.minSafetyFactor) ? feaResult.minSafetyFactor.toFixed(2) : '∞'}
                  </span>
                </div>
                <div className="fb-row">
                  <span className="rk">Deflexión máx</span>
                  <span className="rv" data-testid="fea-deflexion">{feaResult.maxDisplacement.toFixed(4)} mm</span>
                </div>
                <div className="fb-row">
                  <span className="rk">Malla / solver</span>
                  <span className="rv" data-testid="fea-mesh">
                    {feaResult.mesh.nNodes}n · {feaResult.mesh.nTets}t · {feaResult.solver.iterations}it
                    {feaResult.solver.converged ? ' ✓' : ' ✕'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="fb-sim-out">
                <div className="fb-row"><span className="rk">Estado</span><span className="rv">{feaBusy ? 'calculando…' : 'elige cara fija + Analizar'}</span></div>
              </div>
            )}
          </aside>

          {/* ── Invariantes (la corrección visible) ── */}
          <footer className={`fb-invariants ${ok ? 'ok' : 'pending'}`} data-testid="invariants">
            {result ? (
              <>
                <div className="inv">
                  <span className="k">Topología</span>
                  <span className="v">V {result.topo.vertices} − E {result.topo.edges} + F {result.topo.faces} = <b>{result.topo.euler}</b></span>
                  <span className="chk">{result.topo.euler === 2 ? '✓ sólido simple' : 'sólido compuesto'}</span>
                </div>
                <div className="inv">
                  <span className="k">Volumen (GProp)</span>
                  <span className="v mono">{result.volKernel.toFixed(3)} mm³</span>
                  <span className="chk">exacto por integración geométrica</span>
                </div>
                <div className="inv">
                  <span className="k">Malla / STEP</span>
                  <span className="v mono">{result.mesh.triangleCount} △ · {(result.stepBytes / 1024).toFixed(1)} KB</span>
                  <span className="chk">{building ? 'recomputando…' : 'CPU(OCCT) → GPU(R3F)'}</span>
                </div>
              </>
            ) : (
              <div className="inv">
                <span className="k">Estado</span>
                <span className="v">{opErr ? `Error: ${opErr}` : bootErr ? `Kernel: ${bootErr}` : 'Construyendo…'}</span>
              </div>
            )}
            {opErr && result && (
              <div className="inv err"><span className="k">Última op</span><span className="v">{opErr}</span></div>
            )}
          </footer>
        </BindContext.Provider>
      )}

      {/* ── MOTOR DE PLANOS: overlay con el dibujo 2D generado ── */}
      {planoSvg && (
        <div className="fb-plano-overlay" data-testid="plano-overlay" onClick={() => setPlanoSvg(null)}>
          <div className="fb-plano-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fb-plano-bar">
              <span>📐 Plano de taller — 3 vistas · líneas ocultas · cotas</span>
              <div className="fb-plano-actions">
                <button data-testid="btn-plano-download" onClick={downloadPlano}>⬇ Descargar SVG</button>
                <button data-testid="btn-plano-close" onClick={() => setPlanoSvg(null)}>✕ Cerrar</button>
              </div>
            </div>
            <div className="fb-plano-svg" data-testid="plano-svg" dangerouslySetInnerHTML={{ __html: planoSvg }} />
          </div>
        </div>
      )}

      <button className="fb-hide" data-testid="btn-hide-chrome" onClick={() => setHideChrome((v) => !v)}>
        {hideChrome ? '◳' : '◲'}
      </button>
    </div>
  );
}

function Row({ k, v, hi, testid }: { k: string; v: string; hi?: boolean; testid?: string }) {
  return (
    <div className={`fb-row ${hi ? 'hi' : ''}`}>
      <span className="rk">{k}</span>
      <span className="rv" data-testid={testid}>{v}</span>
    </div>
  );
}

function opIcon(t: OpType): string {
  return { extrude: '⬓', hole: '◎', fillet: '◜', chamfer: '◹', shell: '▢', revolve: '⟳', pattern: '⁘', pocket: '⊟' }[t];
}
function opTitle(t: OpType): string {
  return { extrude: 'Extrude', hole: 'Hole', fillet: 'Fillet', chamfer: 'Chamfer', shell: 'Shell', revolve: 'Revolve', pattern: 'Patrón', pocket: 'Corte' }[t];
}
function opSubtitle(op: Op): string {
  switch (op.type) {
    case 'extrude': return `${op.depth.toFixed(0)} mm`;
    case 'hole': return `⌀${op.diameter.toFixed(1)} · ${op.through ? 'pasante' : `${op.depth.toFixed(0)}mm`}`;
    case 'fillet': return `R${op.radius.toFixed(1)} · ${op.edges.length || 'todas'} aristas`;
    case 'chamfer': return `${op.dist.toFixed(1)}mm · ${op.edges.length || 'todas'} aristas`;
    case 'shell': return `pared ${op.thickness.toFixed(1)} · ${op.faces.length} caras`;
    case 'revolve': return `${op.angle.toFixed(0)}°`;
    case 'pattern': return op.mode === 'linear' ? `lineal ×${op.count}` : op.mode === 'circular' ? `circular ×${op.count} · ${op.angleSpan.toFixed(0)}°` : `espejo ${op.plane.toUpperCase()}`;
    case 'pocket': return op.profile === 'circle' ? `⌀${op.diameter.toFixed(1)} · ${op.through ? 'pasante' : `${op.depth.toFixed(0)}mm`}` : `${op.w.toFixed(0)}×${op.h.toFixed(0)} · ${op.through ? 'pasante' : `${op.depth.toFixed(0)}mm`}`;
  }
}

// Cabecera de panel COLAPSABLE (▾ abierto / ▸ cerrado). El padre lleva la clase
// .collapsed que oculta todo menos esta cabecera (CSS), aliviando el encimado de
// paneles absolutos en pantallas chicas — lo #1 que pidió el fundador.
function CollapseHead({ id, title, collapsed, onToggle, right }: {
  id: string; title: string; collapsed: boolean; onToggle: () => void; right?: ReactNode;
}) {
  return (
    <div className="fb-collapse-head" onClick={onToggle}>
      <button className="fb-collapse-btn" data-testid={`collapse-${id}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        title={collapsed ? 'Expandir' : 'Colapsar'} aria-expanded={!collapsed}>
        {collapsed ? '▸' : '▾'}
      </button>
      <span className="fb-collapse-title">{title}</span>
      {right && <span className="fb-collapse-right">{right}</span>}
    </div>
  );
}

// STL BINARIO desde una malla triangular (posiciones + índices). 80B header +
// uint32 nTri + por triángulo (normal 3f + 3 vértices 3f + uint16 attr = 50B).
// La normal se recomputa por triángulo (cross) — un slicer no usa la del archivo
// pero un STL válido la lleva. Sirve para exportar el sólido y el generativo.
function meshToStlBlob(positions: Float32Array, indices: Uint32Array): Blob {
  const nTri = indices.length / 3;
  const buf = new ArrayBuffer(84 + nTri * 50);
  const dv = new DataView(buf);
  dv.setUint32(80, nTri, true);
  let o = 84;
  for (let t = 0; t < nTri; t++) {
    const a = indices[t * 3] * 3, b = indices[t * 3 + 1] * 3, c = indices[t * 3 + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true);
    dv.setFloat32(o + 12, ax, true); dv.setFloat32(o + 16, ay, true); dv.setFloat32(o + 20, az, true);
    dv.setFloat32(o + 24, bx, true); dv.setFloat32(o + 28, by, true); dv.setFloat32(o + 32, bz, true);
    dv.setFloat32(o + 36, cx, true); dv.setFloat32(o + 40, cy, true); dv.setFloat32(o + 44, cz, true);
    dv.setUint16(o + 48, 0, true);
    o += 50;
  }
  return new Blob([buf], { type: 'model/stl' });
}
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ──────────────────────────────────────────────────────────────────
// Estilos (vidrio sobre viewport — feel Plasticity/Onshape, acento oro GAIA)
// ──────────────────────────────────────────────────────────────────
const CSS = `
.fb-root{position:fixed;inset:0;overflow:hidden;background:${INK};
  font-family:'Inter',system-ui,sans-serif;color:#e9eef5;}
.fb-viewport{position:absolute;inset:0;}
.fb-pick-hint{position:absolute;top:74px;left:50%;transform:translateX(-50%);
  background:${GOLD};color:#1a1206;font-size:12px;font-weight:600;padding:7px 16px;
  border-radius:20px;box-shadow:0 4px 20px ${GOLD}66;z-index:6;pointer-events:none;}

.fb-hud-sel{position:absolute;top:112px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:8px;z-index:6;pointer-events:none;
  background:rgba(13,18,28,0.78);border:1px solid ${GOLD}44;border-radius:20px;
  padding:6px 14px;backdrop-filter:blur(10px);font-size:12px;color:#e9eef5;}
.fb-hud-sel .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${STEEL};opacity:.7;}
.fb-hud-sel b{color:${GOLD};font-family:'JetBrains Mono',monospace;font-size:14px;}
.fb-hud-sel .meta{font-size:11px;color:${STEEL};font-family:'JetBrains Mono',monospace;}
.fb-hud-sel .meta.edge{color:#8ff0a4;}

.fb-hud-edge{position:absolute;top:148px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:8px;z-index:6;pointer-events:none;
  background:rgba(13,18,28,0.78);border:1px solid #8ff0a455;border-radius:20px;
  padding:6px 14px;backdrop-filter:blur(10px);font-size:12px;color:#e9eef5;}
.fb-hud-edge .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${STEEL};opacity:.7;}
.fb-hud-edge b{color:#8ff0a4;font-family:'JetBrains Mono',monospace;font-size:14px;}
.fb-hud-edge .meta{font-size:11px;color:${STEEL};font-family:'JetBrains Mono',monospace;}
.fb-hud-edge .meta.axis{color:${GOLD};font-weight:600;}

.fb-hud-asm{position:absolute;top:184px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:12px;z-index:6;pointer-events:none;
  background:rgba(13,18,28,0.82);border:1px solid ${GOLD}55;border-radius:20px;
  padding:7px 16px;backdrop-filter:blur(10px);font-size:12px;color:#e9eef5;
  box-shadow:0 4px 24px rgba(0,0,0,0.5);}
.fb-hud-asm .lbl{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${GOLD};opacity:.9;font-weight:600;}
.fb-hud-asm .seg{font-size:11px;color:${STEEL};font-family:'JetBrains Mono',monospace;}
.fb-hud-asm .seg b{color:#e9eef5;font-weight:600;}
.fb-hud-asm .seg.mesh.ok{color:#8ff0a4;}.fb-hud-asm .seg.mesh.ok b{color:#8ff0a4;}
.fb-hud-asm .seg.mesh.warn{color:#fbbf24;}.fb-hud-asm .seg.mesh.warn b{color:#fbbf24;}

.fb-facelist{position:absolute;left:18px;bottom:18px;width:210px;padding:12px;max-height:34vh;
  overflow:auto;display:flex;flex-direction:column;gap:8px;}
.fb-facelist .fb-feat-head{display:flex;justify-content:space-between;}
.fb-facelist .fb-feat-head b{color:${GOLD};}
.fb-facelist-items{display:flex;flex-direction:column;gap:3px;overflow:auto;}
.fb-facelist-items button{display:flex;align-items:baseline;gap:8px;text-align:left;
  border:1px solid rgba(159,179,200,0.1);background:rgba(255,255,255,0.02);color:${STEEL};
  font-size:10px;padding:5px 8px;border-radius:6px;cursor:pointer;font-family:'JetBrains Mono',monospace;}
.fb-facelist-items button:hover{border-color:${GOLD}55;}
.fb-facelist-items button.sel{background:${GOLD};color:#1a1206;border-color:${GOLD};font-weight:600;}
.fb-facelist-items .fi-idx{font-weight:700;min-width:26px;}
.fb-facelist-items .fi-lbl{flex:1;}
.fb-facelist-items .fi-meta{opacity:.7;font-size:9px;}

.fb-header,.fb-features,.fb-params,.fb-invariants,.fb-toolbar,.fb-analysis{
  position:absolute;backdrop-filter:blur(18px) saturate(1.25);
  background:linear-gradient(180deg,rgba(20,27,38,0.72),rgba(11,15,22,0.74));
  border:1px solid rgba(159,179,200,0.14);
  border-radius:15px;box-shadow:0 10px 44px rgba(0,0,0,0.55),0 1px 0 rgba(255,255,255,0.04) inset;}

/* ── Paneles COLAPSABLES: cabecera con ▾/▸; .collapsed oculta todo menos la
   cabecera y reduce el panel a una barra (alivia el encimado en pantallas chicas). */
.fb-collapse-head{display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;
  margin:-2px 0 10px;padding-bottom:8px;border-bottom:1px solid rgba(159,179,200,0.1);}
.fb-collapse-btn{border:0;background:transparent;color:${GOLD};font-size:11px;cursor:pointer;
  padding:0;width:14px;line-height:1;}
.fb-collapse-title{flex:1;font-size:10px;text-transform:uppercase;letter-spacing:1.4px;
  color:${STEEL};opacity:.72;font-weight:600;}
.fb-collapse-right{display:flex;align-items:center;}
.fb-count{font-size:10px;font-family:'JetBrains Mono',monospace;color:${GOLD};
  background:${GOLD}14;border:1px solid ${GOLD}33;border-radius:10px;padding:1px 7px;}
.collapsed{max-height:none!important;padding-top:11px!important;padding-bottom:11px!important;overflow:hidden;}
.collapsed .fb-collapse-head{margin-bottom:0;padding-bottom:0;border-bottom:0;}
.collapsed>*:not(.fb-collapse-head){display:none!important;}

/* ── Menú ⋮ Opciones (header): export + visibilidad ── */
.fb-menu-wrap{position:relative;margin-left:auto;}
.fb-menu-btn{border:1px solid rgba(159,179,200,0.18);background:rgba(255,255,255,0.04);
  color:#e9eef5;font-size:12px;padding:6px 11px;border-radius:9px;cursor:pointer;font-weight:600;
  transition:.13s;}
.fb-menu-btn:hover,.fb-menu-btn.on{border-color:${GOLD}77;background:${GOLD}18;color:${GOLD};}
.fb-menu-scrim{position:fixed;inset:0;z-index:40;}
.fb-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:41;min-width:208px;padding:7px;
  background:linear-gradient(180deg,rgba(24,31,43,0.97),rgba(13,17,25,0.98));
  border:1px solid rgba(159,179,200,0.18);border-radius:12px;
  box-shadow:0 16px 50px rgba(0,0,0,0.6);display:flex;flex-direction:column;gap:2px;}
.fb-menu-sec{font-size:9px;text-transform:uppercase;letter-spacing:1.3px;color:${STEEL};
  opacity:.55;padding:5px 9px 2px;}
.fb-menu-sep{height:1px;background:rgba(159,179,200,0.12);margin:4px 2px;}
.fb-menu button,.fb-menu .fb-menu-link{display:flex;align-items:center;gap:4px;text-align:left;
  border:0;background:transparent;color:#e9eef5;font-size:12px;padding:8px 9px;border-radius:8px;
  cursor:pointer;text-decoration:none;font-weight:500;transition:.1s;width:100%;}
.fb-menu button:hover,.fb-menu .fb-menu-link:hover{background:${GOLD}1a;color:${GOLD};}
.fb-menu em{font-style:normal;opacity:.55;font-size:10px;margin-left:auto;}
.fb-menu button:disabled,.fb-menu .fb-menu-link.disabled{opacity:.38;pointer-events:none;}
.fb-doc-name{width:100%;background:rgba(0,0,0,0.4);border:1px solid rgba(159,179,200,0.18);
  border-radius:7px;color:#eef3f9;font-size:12px;font-weight:600;padding:7px 9px;outline:none;margin:2px 0 4px;}
.fb-doc-name:focus{border-color:${GOLD}88;}
.fb-lib-list{display:flex;flex-direction:column;gap:2px;max-height:160px;overflow:auto;}
.fb-lib-row{display:flex;align-items:center;gap:2px;}
.fb-lib-open{flex:1;text-align:left;border:0;background:transparent;color:#e9eef5;font-size:11px;
  padding:6px 9px;border-radius:7px;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fb-lib-open:hover{background:${GOLD}1a;color:${GOLD};}
.fb-lib-del{border:0;background:transparent;color:${STEEL};cursor:pointer;font-size:12px;padding:4px 6px;border-radius:6px;}
.fb-lib-del:hover{background:rgba(248,113,113,0.18);color:#fca5a5;}
.fb-doc-studio{font-weight:400;opacity:.55;}
/* ── Imprimibilidad (DFM) ── */
.fb-print-head{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:600;color:${GOLD};
  text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;}
.fb-print-head span{flex:1;}
.fb-print-head select{background:rgba(0,0,0,0.4);border:1px solid rgba(159,179,200,0.18);border-radius:6px;
  color:#eef3f9;font-size:10px;padding:3px 4px;outline:none;cursor:pointer;}
.fb-print-fits{font-size:11px;font-weight:600;padding:6px 8px;border-radius:7px;margin-bottom:6px;}
.fb-print-fits.ok{color:#8ff0a4;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.25);}
.fb-print-fits.bad{color:#fca5a5;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.3);}
.fb-print-fits em{font-style:normal;opacity:.6;font-weight:400;font-size:10px;}
.fb-overhang-btn{width:100%;margin-top:8px;border:1px solid ${GOLD}44;background:${GOLD}10;color:${GOLD};
  font-size:11px;padding:7px;border-radius:8px;cursor:pointer;font-weight:600;}
.fb-overhang-btn:hover,.fb-overhang-btn.on{background:${GOLD}22;}
.fb-sec-toggle{border:1px solid rgba(159,179,200,0.2);background:rgba(255,255,255,0.05);color:${STEEL};
  font-size:10px;font-weight:700;padding:3px 9px;border-radius:6px;cursor:pointer;}
.fb-sec-toggle.on{background:${GOLD};color:#1a1206;border-color:${GOLD};}
.fb-menu button.danger:hover{background:rgba(248,113,113,0.16);color:#fca5a5;}
.fb-imported-tag{font-size:9px;font-weight:700;color:#1a1206;background:${GOLD};
  border-radius:5px;padding:2px 6px;margin-left:8px;letter-spacing:.4px;}

.fb-header{top:18px;left:18px;display:flex;align-items:center;gap:14px;padding:11px 16px;}
.fb-mark{font-size:22px;color:${GOLD};filter:drop-shadow(0 0 8px ${GOLD}88);}
.fb-titles h1{font-size:14px;font-weight:600;letter-spacing:.2px;margin:0;}
.fb-titles p{font-size:11px;margin:2px 0 0;color:${STEEL};opacity:.8;}
.fb-kernel{display:flex;align-items:center;gap:7px;font-size:11px;padding:5px 11px;
  border-radius:20px;margin-left:8px;background:rgba(0,0,0,0.3);}
.fb-kernel .dot{width:7px;height:7px;border-radius:50%;}
.fb-kernel.on{color:#8ff0a4;}.fb-kernel.on .dot{background:#4ade80;box-shadow:0 0 8px #4ade80;}
.fb-kernel.off{color:#fbbf24;}.fb-kernel.off .dot{background:#fbbf24;box-shadow:0 0 8px #fbbf24;}

.fb-toolbar{top:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;
  gap:6px;padding:8px 12px;}
.fb-tb-label{font-size:10px;text-transform:uppercase;letter-spacing:1.2px;color:${STEEL};
  opacity:.55;margin-right:4px;}
.fb-toolbar button{border:1px solid rgba(159,179,200,0.16);background:rgba(255,255,255,0.04);
  color:#e9eef5;font-size:12px;padding:7px 11px;border-radius:8px;cursor:pointer;font-weight:500;
  transition:.13s;}
.fb-toolbar button:hover{border-color:${GOLD}77;background:${GOLD}18;color:${GOLD};}
.fb-tb-sep{width:1px;height:22px;background:rgba(159,179,200,0.2);margin:0 3px;}

.fb-features{top:78px;left:18px;width:210px;padding:12px;max-height:38vh;overflow:auto;}
.fb-feat-head{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:${STEEL};
  opacity:.6;margin-bottom:10px;}
.fb-feat-node{display:flex;gap:10px;align-items:center;padding:9px 10px;border-radius:9px;
  background:rgba(255,255,255,0.03);border:1px solid rgba(159,179,200,0.08);cursor:pointer;
  transition:.12s;}
.fb-feat-node:hover{border-color:${GOLD}44;}
.fb-feat-node.active{border-color:${GOLD};background:${GOLD}1a;box-shadow:0 0 0 1px ${GOLD}55 inset;}
.fb-feat-node.accent .ico{color:${GOLD};}
.fb-feat-node .ico{font-size:16px;color:${GOLD_DIM};}
.fb-feat-node strong{display:block;font-size:12px;font-weight:600;color:#eef3f9;}
.fb-feat-node em{display:block;font-size:10px;color:${STEEL};opacity:.9;font-style:normal;margin-top:1px;}
.fb-feat-arrow{text-align:center;font-size:11px;color:${STEEL};opacity:.4;margin:3px 0;}
.fb-feat-body{flex:1;min-width:0;}
.fb-feat-body strong{cursor:text;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fb-feat-rename{width:100%;background:rgba(0,0,0,0.4);border:1px solid ${GOLD}66;border-radius:5px;
  color:#eef3f9;font-size:12px;font-weight:600;padding:2px 5px;outline:none;font-family:inherit;}
/* acciones por-nodo: aparecen al hover (o si está suprimido/activo) */
.fb-feat-actions{display:flex;gap:2px;opacity:0;transition:.12s;flex:none;}
.fb-feat-node:hover .fb-feat-actions,.fb-feat-node.active .fb-feat-actions,
.fb-feat-node.suppressed .fb-feat-actions{opacity:1;}
.fb-feat-act{border:0;background:rgba(255,255,255,0.05);color:${STEEL};font-size:11px;
  width:20px;height:20px;border-radius:5px;cursor:pointer;line-height:1;padding:0;transition:.1s;}
.fb-feat-act:hover{background:${GOLD}22;color:${GOLD};}
.fb-feat-act.del:hover{background:rgba(248,113,113,0.2);color:#fca5a5;}
.fb-feat-act:disabled{opacity:.25;pointer-events:none;}
.fb-feat-node.suppressed{opacity:.5;}
.fb-feat-node.suppressed strong{text-decoration:line-through;}
.fb-feat-subhead{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:${STEEL};
  opacity:.55;margin:12px 0 7px;padding-top:9px;border-top:1px solid rgba(159,179,200,0.1);}
.fb-feat-subhead b{color:${GOLD};opacity:.9;}
.fb-feat-node.comp .ico{filter:saturate(.7);}
/* nodos por DEBAJO del marcador de rollback: en gris, fuera del cálculo */
.fb-feat-node.rolled{opacity:.4;filter:grayscale(.6);}
.fb-feat-node.rolled .ico{color:${STEEL};}
.fb-rollback-bar{display:flex;align-items:center;gap:6px;justify-content:center;margin:4px 0;
  font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:${GOLD};cursor:pointer;
  border:1px dashed ${GOLD}66;border-radius:6px;padding:4px 6px;background:${GOLD}10;}
.fb-rollback-bar:hover{background:${GOLD}1e;}

/* ── Undo / Redo en el header ── */
.fb-undo{display:flex;gap:3px;margin-left:6px;}
.fb-undo button{border:1px solid rgba(159,179,200,0.18);background:rgba(255,255,255,0.04);
  color:#e9eef5;font-size:15px;width:30px;height:28px;border-radius:8px;cursor:pointer;
  line-height:1;transition:.12s;}
.fb-undo button:hover:not(:disabled){border-color:${GOLD}77;background:${GOLD}18;color:${GOLD};}
.fb-undo button:disabled{opacity:.3;cursor:default;}

/* ── Menú contextual (clic derecho) — flotante en el cursor ── */
.fb-ctx-scrim{position:fixed;inset:0;z-index:60;}
.fb-ctx{position:fixed;z-index:61;min-width:184px;padding:6px;
  background:linear-gradient(180deg,rgba(24,31,43,0.98),rgba(13,17,25,0.99));
  border:1px solid rgba(159,179,200,0.2);border-radius:11px;
  box-shadow:0 16px 50px rgba(0,0,0,0.62);display:flex;flex-direction:column;gap:1px;}
.fb-ctx-head{font-size:10px;font-weight:600;color:${GOLD};padding:4px 9px 6px;
  border-bottom:1px solid rgba(159,179,200,0.12);margin-bottom:3px;
  text-transform:uppercase;letter-spacing:.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.fb-ctx button{display:flex;align-items:center;gap:7px;text-align:left;border:0;background:transparent;
  color:#e9eef5;font-size:12px;padding:7px 9px;border-radius:7px;cursor:pointer;font-weight:500;width:100%;}
.fb-ctx button:hover:not(:disabled){background:${GOLD}1a;color:${GOLD};}
.fb-ctx button:disabled{opacity:.3;pointer-events:none;}
.fb-ctx button.danger:hover{background:rgba(248,113,113,0.16);color:#fca5a5;}

.fb-params{right:18px;top:18px;width:230px;padding:14px;max-height:64vh;overflow:auto;}
.fb-panel-title{font-size:11px;font-weight:600;color:${GOLD};margin-bottom:12px;
  text-transform:uppercase;letter-spacing:.6px;}
.fb-seg{display:flex;gap:4px;background:rgba(0,0,0,0.3);padding:3px;border-radius:9px;margin-bottom:14px;}
.fb-seg button{flex:1;border:0;background:transparent;color:${STEEL};font-size:11px;padding:6px;
  border-radius:6px;cursor:pointer;font-weight:500;}
.fb-seg button.on{background:${GOLD};color:#1a1206;font-weight:600;}

.fb-dim{display:block;margin-bottom:13px;}
.fb-dim-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:1px;
  color:${STEEL};opacity:.7;margin-bottom:5px;}
.fb-dim input[type=range]{width:100%;accent-color:${GOLD};height:4px;cursor:pointer;}
.fb-dim-val{display:block;text-align:right;font-size:13px;font-weight:600;
  font-family:'JetBrains Mono',monospace;color:${GOLD};margin-top:3px;}
.fb-dim-val em{font-size:10px;color:${STEEL};font-style:normal;margin-left:3px;}
.fb-divider{height:1px;background:rgba(159,179,200,0.12);margin:12px 0;}

/* ── ƒₓ: ligar una cota a una expresión de parámetros ── */
.fb-fx{border:0;background:transparent;color:${STEEL};opacity:.5;font-size:11px;cursor:pointer;
  margin-left:6px;font-style:italic;padding:0 2px;transition:.1s;}
.fb-fx:hover{opacity:1;color:${GOLD};}
.fb-fx.on{opacity:1;color:${GOLD};font-weight:700;}
.fb-dim-bound .fb-expr{width:100%;background:rgba(0,0,0,0.4);border:1px solid ${GOLD}66;border-radius:6px;
  color:${GOLD};font-size:12px;font-family:'JetBrains Mono',monospace;padding:5px 7px;outline:none;}
.fb-dim-bound.err .fb-expr{border-color:#f87171aa;color:#fca5a5;}
.fb-fx-x{border:0;background:transparent;color:${STEEL};cursor:pointer;font-size:13px;margin-left:6px;padding:0;}
.fb-fx-x:hover{color:#fca5a5;}

/* ── Panel de PARÁMETROS (flotante junto al árbol) ── */
.fb-paramspanel{position:absolute;left:238px;top:78px;width:288px;padding:12px;z-index:30;
  backdrop-filter:blur(18px) saturate(1.25);
  background:linear-gradient(180deg,rgba(20,27,38,0.82),rgba(11,15,22,0.84));
  border:1px solid rgba(159,179,200,0.16);border-radius:15px;
  box-shadow:0 14px 50px rgba(0,0,0,0.6);max-height:60vh;overflow:auto;}
.fb-ptable{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}
.fb-prow{display:grid;grid-template-columns:1fr 1.3fr auto auto;gap:5px;align-items:center;}
.fb-prow.head{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:${STEEL};opacity:.55;
  padding:0 2px;}
.fb-prow input{background:rgba(0,0,0,0.34);border:1px solid rgba(159,179,200,0.14);border-radius:6px;
  color:#eef3f9;font-size:11px;padding:5px 6px;outline:none;font-family:'JetBrains Mono',monospace;min-width:0;}
.fb-prow input:focus{border-color:${GOLD}88;}
.fb-prow.err .fb-pexpr{border-color:#f87171aa;}
.fb-pname{color:${GOLD}!important;font-weight:600;}
.fb-pval{font-size:11px;font-family:'JetBrains Mono',monospace;color:#8ff0a4;min-width:34px;text-align:right;}
.fb-prow.err .fb-pval{color:#fbbf24;}
.fb-prow-x{border:0;background:transparent;color:${STEEL};cursor:pointer;font-size:14px;padding:0 2px;}
.fb-prow-x:hover{color:#fca5a5;}
.fb-phint{font-size:10px;color:${STEEL};opacity:.7;line-height:1.5;padding:4px 2px;}

/* ── Overlay del MOTOR DE PLANOS ── */
.fb-plano-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;
  background:rgba(6,9,14,0.82);backdrop-filter:blur(6px);}
.fb-plano-sheet{width:min(92vw,1180px);max-height:92vh;display:flex;flex-direction:column;
  background:#0f141c;border:1px solid rgba(159,179,200,0.2);border-radius:14px;overflow:hidden;
  box-shadow:0 24px 80px rgba(0,0,0,0.7);}
.fb-plano-bar{display:flex;align-items:center;justify-content:space-between;padding:11px 16px;
  background:linear-gradient(180deg,rgba(20,27,38,0.9),rgba(11,15,22,0.9));
  border-bottom:1px solid rgba(159,179,200,0.14);font-size:13px;color:#e9eef5;font-weight:600;}
.fb-plano-actions{display:flex;gap:8px;}
.fb-plano-actions button{border:1px solid rgba(159,179,200,0.2);background:rgba(255,255,255,0.05);
  color:#e9eef5;font-size:12px;padding:7px 13px;border-radius:8px;cursor:pointer;font-weight:600;transition:.12s;}
.fb-plano-actions button:hover{border-color:${GOLD}77;background:${GOLD}18;color:${GOLD};}
.fb-plano-svg{flex:1;overflow:auto;padding:18px;background:#3a3f47;display:flex;align-items:flex-start;justify-content:center;}
.fb-plano-svg svg{width:100%;height:auto;max-width:1100px;box-shadow:0 8px 30px rgba(0,0,0,0.5);}

.fb-check{display:flex;align-items:center;gap:8px;font-size:11px;color:${STEEL};margin-bottom:12px;cursor:pointer;}
.fb-check input{accent-color:${GOLD};}
.fb-hint-txt{font-size:10px;color:${STEEL};opacity:.7;line-height:1.4;margin:4px 0 0;}

.fb-steps{display:flex;flex-direction:column;gap:6px;margin:8px 0;max-height:240px;overflow:auto;}
.fb-step-row{display:grid;grid-template-columns:auto 1fr 1fr auto;align-items:end;gap:6px;
  padding:6px;border:1px solid rgba(159,179,200,0.12);border-radius:8px;background:rgba(255,255,255,0.02);}
.fb-step-row .fb-dim{margin-bottom:0;}
.fb-step-idx{font-size:10px;color:${GOLD};font-family:'JetBrains Mono',monospace;padding-bottom:6px;}
.fb-step-del{border:0;background:transparent;color:${STEEL};cursor:pointer;font-size:12px;padding:0 2px 6px;}
.fb-step-del:hover{color:#ff6b6b;}

.fb-sel-head{font-size:11px;color:${STEEL};margin:6px 0 8px;}
.fb-sel-head b{color:${GOLD};}.fb-sel-head em{font-style:normal;opacity:.6;font-size:10px;}
.fb-pick-btn{width:100%;border:1px solid ${GOLD}44;background:${GOLD}10;color:${GOLD};
  font-size:11px;padding:8px;border-radius:8px;cursor:pointer;margin-bottom:8px;font-weight:600;}
.fb-pick-btn:hover{background:${GOLD}22;}
.fb-sel-list{display:flex;flex-direction:column;gap:3px;max-height:160px;overflow:auto;}
.fb-sel-list button{text-align:left;border:1px solid rgba(159,179,200,0.1);
  background:rgba(255,255,255,0.02);color:${STEEL};font-size:10px;padding:5px 8px;
  border-radius:6px;cursor:pointer;font-family:'JetBrains Mono',monospace;}
.fb-sel-list button:hover{border-color:${GOLD}55;}
.fb-sel-list button.sel{background:${GOLD};color:#1a1206;border-color:${GOLD};font-weight:600;}

.fb-del-btn{width:100%;border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.08);
  color:#fca5a5;font-size:11px;padding:7px;border-radius:8px;cursor:pointer;margin-top:12px;}
.fb-del-btn:hover{background:rgba(248,113,113,0.16);}

.fb-actions{display:flex;flex-direction:column;gap:8px;}
.fb-actions button,.fb-export{border:1px solid rgba(159,179,200,0.18);background:rgba(255,255,255,0.04);
  color:#e9eef5;font-size:11px;padding:8px;border-radius:8px;cursor:pointer;text-align:center;
  text-decoration:none;font-weight:500;transition:.15s;}
.fb-actions button:hover,.fb-export:hover{border-color:${GOLD}66;background:${GOLD}14;}
.fb-export[aria-disabled=true]{opacity:.4;pointer-events:none;}

.fb-analysis{right:18px;bottom:18px;width:236px;padding:15px;}
.fb-mat{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:13px;font-size:11px;color:${STEEL};}
.fb-mat>span:first-child{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.85;}
.fb-mat-pick{display:flex;align-items:center;gap:7px;flex:1;background:rgba(0,0,0,0.42);
  border:1px solid rgba(159,179,200,0.2);border-radius:8px;padding:0 8px 0 9px;}
.fb-mat-swatch{width:13px;height:13px;border-radius:50%;flex:none;
  box-shadow:0 0 0 1px rgba(0,0,0,0.5),0 1px 4px rgba(0,0,0,0.6),0 0 7px rgba(255,255,255,0.12) inset;}
.fb-mat select{flex:1;background:transparent;color:#eef3f9;border:0;outline:none;
  padding:7px 2px;font-size:11px;font-weight:500;cursor:pointer;}
.fb-mass{display:flex;flex-direction:column;gap:2px;}
.fb-row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;padding:6px 0;
  border-bottom:1px solid rgba(159,179,200,0.09);}
.fb-row:last-child{border-bottom:0;}
.fb-row .rk{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:${STEEL};opacity:.82;}
.fb-row .rv{font-size:12.5px;font-family:'JetBrains Mono',monospace;text-align:right;color:#eef3f9;}
.fb-row.hi{padding:8px 0;}
.fb-row.hi .rk{opacity:.95;color:#cdd8e4;}
.fb-row.hi .rv{color:${GOLD};font-weight:700;font-size:16px;letter-spacing:-.2px;}

.fb-invariants{left:50%;transform:translateX(-50%);bottom:18px;max-width:640px;
  display:flex;gap:0;padding:0;overflow:hidden;}
.fb-invariants .inv{flex:1;padding:11px 16px;display:flex;flex-direction:column;gap:3px;
  border-right:1px solid rgba(159,179,200,0.1);}
.fb-invariants .inv:last-child{border-right:0;}
.fb-invariants .inv.err{background:rgba(248,113,113,0.1);}
.fb-invariants .k{font-size:9px;text-transform:uppercase;letter-spacing:1.2px;color:${STEEL};opacity:.78;}
.fb-invariants .v{font-size:13px;font-weight:600;color:#eef3f9;}
.fb-invariants .v.mono{font-family:'JetBrains Mono',monospace;font-size:12px;}
.fb-invariants .v b{color:${GOLD};}
.fb-invariants .chk{font-size:10px;color:${STEEL};opacity:.92;}
.fb-invariants.ok{border-color:${GOLD}44;}

.fb-hide{position:absolute;bottom:18px;right:260px;width:34px;height:34px;border-radius:9px;
  border:1px solid rgba(159,179,200,0.15);background:rgba(13,18,28,0.7);color:${STEEL};
  font-size:15px;cursor:pointer;backdrop-filter:blur(10px);z-index:5;}
.fb-hide:hover{color:${GOLD};border-color:${GOLD}55;}

/* ── Panel de SIMULACIÓN FEA (von Mises) ── */
.fb-sim{position:absolute;left:236px;top:78px;width:240px;padding:14px;
  backdrop-filter:blur(18px) saturate(1.25);
  background:linear-gradient(180deg,rgba(20,27,38,0.72),rgba(11,15,22,0.74));
  border:1px solid rgba(159,179,200,0.14);border-radius:15px;
  box-shadow:0 10px 44px rgba(0,0,0,0.55),0 1px 0 rgba(255,255,255,0.04) inset;
  max-height:62vh;overflow:auto;}
.fb-sim-bc{display:flex;flex-direction:column;gap:6px;margin:6px 0 8px;}
.fb-sim-bc-row{display:flex;align-items:center;gap:8px;}
.fb-sim-bc-row .fb-pick-btn{margin-bottom:0;flex:1;}
.fb-sim-tag{font-family:'JetBrains Mono',monospace;font-size:12px;color:${GOLD};min-width:30px;text-align:right;}
.fb-fea-run{width:100%;border:1px solid ${GOLD};background:${GOLD};color:#1a1206;font-weight:700;
  font-size:12px;padding:9px;border-radius:9px;cursor:pointer;margin-top:8px;transition:.13s;}
.fb-fea-run:hover{filter:brightness(1.06);}
.fb-fea-run:disabled{opacity:.45;cursor:not-allowed;filter:grayscale(.4);}
.fb-sim-clear{width:100%;border:1px solid rgba(159,179,200,0.2);background:rgba(255,255,255,0.04);
  color:${STEEL};font-size:10px;padding:6px;border-radius:8px;cursor:pointer;margin-top:6px;}
.fb-sim-clear:hover{border-color:${GOLD}55;color:${GOLD};}
.fb-sim-err{font-size:10px;color:#fca5a5;background:rgba(248,113,113,0.1);border-radius:7px;
  padding:6px 8px;margin-top:8px;line-height:1.35;}
.fb-sim-out{display:flex;flex-direction:column;gap:2px;margin-top:10px;
  border-top:1px solid rgba(159,179,200,0.12);padding-top:8px;}
.fb-sim-out .fb-row.fs-bad .rv{color:#ff7373;}
.fb-sim-out .fb-row.fs-ok .rv{color:#8ff0a4;}

/* ── Barra de escala (leyenda) del overlay FEA ── */
.fb-fea-legend{position:absolute;left:50%;transform:translateX(-50%);bottom:84px;width:260px;z-index:7;pointer-events:none;
  background:rgba(13,18,28,0.82);border:1px solid ${GOLD}44;border-radius:12px;padding:9px 11px;
  backdrop-filter:blur(10px);box-shadow:0 4px 20px rgba(0,0,0,0.5);}
.fb-fea-legend-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${STEEL};
  opacity:.85;margin-bottom:6px;}
.fb-fea-bar{height:13px;border-radius:4px;border:1px solid rgba(0,0,0,0.5);}
.fb-fea-ticks{display:flex;justify-content:space-between;margin-top:4px;
  font-family:'JetBrains Mono',monospace;font-size:10px;color:#e9eef5;}
`;
