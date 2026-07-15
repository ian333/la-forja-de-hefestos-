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

import { useEffect, useMemo, useRef, useState, useCallback, createContext, useContext, lazy, Suspense, type ReactNode } from 'react';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { estudioVientoSupersonico, type VientoSuperResultado } from '../sim/viento'; // Escuela AERO — Estudio Viento
import { OrbitControls, Environment, Grid, ContactShadows, GizmoHelper, GizmoViewcube, TransformControls } from '@react-three/drei';
import ShortcutOverlay from '../../components/ShortcutOverlay';
const MoldCycleSim = lazy(() => import('../sim/MoldCycleSim'));   // simulación del ciclo de inyección (chunk aparte)
const MoldThreePlateSim = lazy(() => import('../sim/MoldThreePlateSim'));  // 3 placas: construcción + doble apertura
const MoldMachinePanel = lazy(() => import('../mold/MoldMachinePanel'));   // LA MÁQUINA: cliente sube pieza → cotización
const MoldUnscrewSim = lazy(() => import('../sim/MoldUnscrewSim'));        // molde que desenrosca (núcleo rotativo)
const MoldSectionReveal = lazy(() => import('../sim/MoldSectionReveal'));  // EL CORTE: acero seccionándose (esténcil + env)
import SketchEditor from './SketchEditor';
import RadialMenu from './RadialMenu';
import * as OCC from './occt';                                   // namespace del kernel para armar el molde
import { buildMoldParts, packageToAssemblySpec, type MoldPart } from '../mold/mold-plano-set';
import { moldMachine } from '../mold/moldmachine';
import type { MoldAssemblySpec } from '../mold/mold-assembly';
import {
  initOCCT,
  _setActiveOCCT,
  extrudePolygon,
  extrudePolygonWithHoles,
  extrudeSpline,
  extrudeCircle,
  drillHole,
  filletEdges,
  chamferEdges,
  shellSolid,
  revolvePolygon,
  loftSections,
  sweepProfileAlong,
  transformShape,
  scaleShape,
  draftFaces,
  keepSolid,
  mirrorShape,
  fuse,
  makeCompound,
  makeBox,
  makeCylinder,
  cut,
  common,
  PLANE_XY,
  PLANE_YZ,
  PLANE_XZ,
  offsetPlane,
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
  type SweepProfile,
  type SketchPlane3D,
} from './occt';
import { makeThreadedRod, threadDims, threadDesignation } from './thread';
import { makeRack, rackArea } from './rack';
import { makeDinBolt, dinBoltInfo } from './din-bolt';
import { generateFacingToolpath, toGcode, toolpathStats, arcSweep } from '../cam/facing';
import type { ToolpathSegment } from '../cam/facing';
import { generateCircularPocketToolpath } from '../cam/pocket';
import { generateDrillingToolpath, detectHolesFromMesh } from '../cam/drill';
import { generateTappingGcode, threadName } from '../cam/tap';
import { generateBoreToolpath } from '../cam/bore';
import { generateAdaptive3DToolpath } from '../cam/adaptive3d';
import { profileFromMesh, detectAxis, turnFacing, turnProfileRough, turnProfileFinish, turnPartOff, toLatheGcode } from '../cam/turning';
import type { LatheMove } from '../cam/turning';
import { nestParts, laserGcode } from '../cam/laser';
import { slicePart, sliceMesh } from '../cam/slicer';
import { resolveParams, tryEval, type Param, type ResolvedParams } from './expr';
import { generateDrawing } from './drawing';
import { printabilityReport, overhangVertexColors, PRINT_PROFILES, type PrintProfile, type PrintabilityReport } from '../mech/dfm';
import { cycloidalDisc, pinPositions } from '../mech/cycloidal';
import { phyllotaxisField, phylloCountForSpacing, GOLDEN_ANGLE_DEG } from '../mech/supports';
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
  feaVertexDisplacements,
  jetColor,
  type FEAResult,
  type FaceBC,
  type FEASession,
} from './fea';
import { runTopOpt, densityToMesh, type TopOptResult, type TopOptParams } from './topopt';
import { mark } from '../telemetry-forja';
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

// ── COLOR POR PIEZA (orden del user: "jamás me ha gustado el color metálico;
// cada pieza debería tener su color"). El MATERIAL sigue mandando la masa
// (densidad); el color es APARIENCIA de la pieza, mate, como Fusion. ──
const PART_PALETTE = ['#4E8FE0', '#57B98A', '#E0784E', '#C86BD8', '#E0B34E', '#5BC8D6', '#D65B79', '#8A77E8'];

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
type SketchKind = 'rect' | 'circle' | 'lprofile' | 'revprofile' | 'gear' | 'custom' | 'gearbox' | 'rosca' | 'rack' | 'din';
interface RoscaParams { d: number; pitch: number; length: number }
const ROSCA_DEFAULTS: RoscaParams = { d: 14, pitch: 3, length: 18 }; // coarse visible (la fina revienta MakePipe)
interface RackParams { m: number; teeth: number; width: number }
const RACK_DEFAULTS: RackParams = { m: 3, teeth: 8, width: 20 };   // cremallera legible en pantalla
interface DinParams { size: 'M6' | 'M8' | 'M10'; length: number }
const DIN_DEFAULTS: DinParams = { size: 'M8', length: 16 };        // llave 13, cuerda visible (M12 largo degrada)
// CAJA cicloidal multi-disco: N discos de lóbulos fasados + eje hueco + base-anillo.
interface GearboxParams {
  lobes: number; discs: number; R: number; Rr: number; E: number;
  T: number; gap: number; shaftD: number; shaftBore: number;
  outPins: number;   // nº de pernos de SALIDA (extraen el giro lento + capturan los discos axialmente)
  outPinD: number;   // ⌀ de cada perno de salida (mm)
  testRig?: boolean; // banco de prueba: añade PALANCA (manivela) al eje + BASE de fijación a la hembra
  supports?: boolean; // árbol de soportes frangibles que SOSTIENE los discos al imprimir (default ON).
                      // SIN esto los discos flotan/se funden — el bug que arruinó el primer print.
}
const GEARBOX_DEFAULTS: GearboxParams = {
  // gap 0.8 (no 0.6): el gap del modelo − el crecimiento de pared (~0.24) = efectivo ~0.56,
  // SF ~1.9 sobre la fusión (0.30). Con 0.6 el efectivo caía a ~0.36 → SF ~1.2 → se fundía.
  // Ver factor-seguridad.ts. Calibrable: si afinas la sobre-extrusión, se puede apretar.
  lobes: 10, discs: 5, R: 40, Rr: 3, E: 1.5, T: 6, gap: 0.8, shaftD: 16, shaftBore: 8,
  outPins: 6, outPinD: 6, testRig: false,
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
  // Rosca MODELADA (kind 'rosca'): tornillo con cuerda helicoidal real (ISO 68-1).
  rosca?: RoscaParams;
  rack?: RackParams;
  din?: DinParams;
  // Perfil DIBUJADO en el editor de croquis (kind 'custom'): polígono cerrado en mm
  // resuelto por el solver de restricciones. Reemplaza las plantillas.
  customProfile?: Pt2[];
  // Lazos INTERIORES del croquis (cavidades): al extruir se restan del perfil
  // exterior en una sola operación (sólido con ventana), como el Tutorial 1 de Fusion.
  customHoles?: Pt2[][];
  // Si el perfil dibujado es UN CÍRCULO: el círculo EXACTO (el kernel hace un cilindro
  // gp_Circ real, no el polígono de respaldo — fix "el círculo tiene caras").
  customCircle?: { x: number; y: number; r: number };
  // Plano base del croquis (croquizar en XY / YZ / XZ, como Fusion) + offset opcional.
  plane?: 'xy' | 'yz' | 'xz';
  planeOffset?: number;
  // Plano ARBITRARIO derivado de una cara 3D clicada (croquis-sobre-cara, como Fusion).
  // Si está presente, MANDA sobre plane/planeOffset. En coords del kernel.
  plane3d?: SketchPlane3D;
  // El perfil custom es una CURVA suave (cicloidal, leva) → extruir por B-spline
  // (arista curva real) en vez de polígono facetado.
  smooth?: boolean;
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

type OpType = 'extrude' | 'hole' | 'fillet' | 'chamfer' | 'shell' | 'draft' | 'revolve' | 'loft' | 'sweep' | 'pattern' | 'pocket';

// Campos comunes a TODA op del árbol: nombre editable (rename) + supresión
// (suppress) temporal. Un op suprimido se conserva en el grafo pero buildShape
// lo SALTA (no entra al cálculo del sólido) — paridad con el Timeline de Fusion.
interface OpBase { id: string; name?: string; suppressed?: boolean; }
interface ExtrudeOp extends OpBase { type: 'extrude'; depth: number; symmetric: boolean; plane?: 'xy' | 'yz' | 'xz'; planeOffset?: number; plane3d?: SketchPlane3D; }
interface HoleOp extends OpBase { type: 'hole'; x: number; y: number; diameter: number; through: boolean; depth: number; }
interface FilletOp extends OpBase { type: 'fillet'; radius: number; edges: number[]; }
interface ChamferOp extends OpBase { type: 'chamfer'; dist: number; edges: number[]; }
interface ShellOp extends OpBase { type: 'shell'; thickness: number; faces: number[]; }
/** Ángulo de salida (cap 6 molde): inclina las paredes ⟂ al desmoldeo +Z, pivote en z=0. */
interface DraftOp extends OpBase { type: 'draft'; angleDeg: number; }
interface RevolveOp extends OpBase { type: 'revolve'; angle: number; axis: 'x' | 'y' | 'z' | 'edge'; }
// LOFT: piel entre el perfil base (z=0) y una copia ESCALADA (topScale) a una
// altura. Es el "Loft" de Fusion en su forma paramétrica (perfil→perfil): un
// topScale<1 da un cono/tronco (boss con salida), >1 una campana. Vía
// loftSections (BRepOffsetAPI_ThruSections), geometría exacta.
interface LoftOp extends OpBase { type: 'loft'; height: number; topScale: number; }
// SWEEP: barre el perfil base por una TRAYECTORIA paramétrica. line = recto
// (≡ extrude), arc = codo (radio + ángulo, esquina redondeada real), helix =
// resorte (radio + paso + vueltas). Vía sweepProfileAlong (BRepOffsetAPI_MakePipe
// con spine B-spline suave), geometría exacta.
interface SweepOp extends OpBase {
  type: 'sweep'; pathKind: 'line' | 'arc' | 'helix';
  height: number;   // line: longitud
  radius: number;   // arc/helix: radio
  angle: number;    // arc: ° de barrido
  turns: number;    // helix: vueltas
  pitch: number;    // helix: paso por vuelta (mm)
}
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
type Op = ExtrudeOp | HoleOp | FilletOp | ChamferOp | ShellOp | DraftOp | RevolveOp | LoftOp | SweepOp | PatternOp | PocketOp;

// ── ENSAMBLE: un COMPONENTE primitivo (bloque o cilindro) posicionado en 3D.
// Varios componentes + la pieza principal se combinan en un compound (sin soldar)
// → permite reconstruir una MÁQUINA pieza a pieza a medidas reales. ──
interface Component {
  id: string; name: string; kind: 'box' | 'cyl' | 'sketch' | 'sweeppath' | 'pieza';
  // ── ENSAMBLE GENÉRICO (la función #1 de LO-RECIO): una PIEZA de la biblioteca
  // insertada como componente. Guarda un SNAPSHOT del doc (sketch+ops+components)
  // — robusto aunque la biblioteca cambie después. Se posiciona con x/y/z/rz y se
  // combina como compound (bool 'none') o con booleanas. Sin anidar (una pieza
  // insertada no construye sus propias piezas insertadas — v1). ──
  pieceDoc?: { sketch: SketchFeature; ops: Op[]; components: Component[] };
  // SWEEP por path de croquis (c6t2): path abierto 2D en el plano del croquis; el
  // perfil es una ELIPSE (semiejes sweepRx en-plano ⊥path, sweepRy fuera-de-plano).
  path?: Pt2[]; sweepRx?: number; sweepRy?: number;
  // REVOLVE del componente (c6t3: el rim del volante = revolve-JOIN, no extrude):
  // si está presente, el perfil del croquis se REVOLUCIONA alrededor del eje global.
  revolve?: { axis: 'x' | 'y' | 'z'; angle: number };
  w: number; d: number; h: number;     // bloque (h también = altura del cilindro)
  r: number;                            // cilindro (radio)
  x: number; y: number; z: number;     // posición del CENTRO (mm)
  rz?: number;                          // giro alrededor de Z (grados) — poses planas
  // FEATURE de croquis (multi-feature: base + saliente/corte). Perfil dibujado que se
  // extruye en su plano y se compone con booleana sobre el cuerpo.
  profile?: Pt2[]; holes?: Pt2[][]; plane?: 'xy' | 'yz' | 'xz'; planeOffset?: number; depth?: number;
  circle?: { x: number; y: number; r: number }; // perfil circular EXACTO → cilindro real, no prisma
  plane3d?: SketchPlane3D;               // plano de cara clicada (croquis-sobre-cara); manda sobre plane/offset
  bool?: 'none' | 'union' | 'subtract' | 'subtractFrom' | 'common'; // cómo combina con el cuerpo:
  // none=junto(compound) · union=fuse · subtract=cuerpo−comp · subtractFrom=comp−cuerpo (CAVIDAD de molde: bloque−pieza)
  // common=INTERSECAR (cuerpo ∩ comp): recorta el cuerpo al volumen del componente — PARTE el molde
  // en placas core/cavity (molde ∩ bloque-superior = core plate; ∩ bloque-inferior = cavity plate)
  /** CONTRACCIÓN del molde (solo subtractFrom): la pieza se escala ×esto alrededor de su centroide antes de restarse. Libro cap 6: 1.05. */
  cavityScale?: number;
  /** Tras la booleana: conservar solo el sólido mayor/menor del compound (partir molde: cavity=mayor, macho=menor). */
  keep?: 'largest' | 'smallest';
  patternCount?: number;   // PATRÓN CIRCULAR del componente: N copias rotadas alrededor de Y (rayos de la rueda)
  patternSpan?: number;    // arco total del patrón en ° (360 = repartido parejo)
  patternAxis?: 'x' | 'y' | 'z';  // eje del patrón circular (default 'y'; el volante c6t3 gira en Z)
  mirror?: 'yz' | 'zx' | 'xy';  // MIRROR FEATURE: espeja el componente a través de ese plano (misma booleana). c4t3: feature en cara derecha → mirror YZ.
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
// Genera la TRAYECTORIA 3D (polilínea) del Sweep desde sus parámetros. El perfil
// vive en XY (z=0), así que el camino DEBE arrancar perpendicular a XY (tangente
// +Z) para que un barrido recto reproduzca el cilindro/prisma exacto.
//
// `profR` = radio envolvente del perfil (máx |p| desde el origen). Para la HÉLICE
// floramos paso y radio para que el "alambre" NO se auto-interseque (paso ≥ 2.2·r
// separa las vueltas; radio ≥ 1.25·r las aleja del eje) — así "Sweep→Hélice"
// produce un resorte VÁLIDO con cualquier perfil, en vez de fallar en silencio.
function buildSweepPath(op: SweepOp, profR = 0): Array<[number, number, number]> {
  if (op.pathKind === 'line') {
    return [[0, 0, 0], [0, 0, Math.max(0.5, op.height)]];
  }
  if (op.pathKind === 'arc') {
    // Arco en el plano X–Z: centro (R,0,0), arranca en el origen tangente +Z y
    // gira `angle`°. La esquina queda redondeada (codo real, sin auto-intersección).
    const R = Math.max(0.5, op.radius);
    const th = (Math.max(1, op.angle) * Math.PI) / 180;
    const n = 32;
    const pts: Array<[number, number, number]> = [];
    for (let i = 0; i <= n; i++) {
      const f = (th * i) / n;
      pts.push([R - R * Math.cos(f), 0, R * Math.sin(f)]);
    }
    return pts;
  }
  // helix (resorte): arranca en (R,0,0), sube `pitch` por vuelta, `turns` vueltas.
  const R = Math.max(0.5, op.radius, 1.25 * profR);
  const turns = Math.max(0.25, op.turns);
  const pitch = Math.max(0.5, op.pitch, 2.2 * profR);
  const tot = turns * 2 * Math.PI;
  const n = Math.max(24, Math.ceil(turns * 24));
  const pts: Array<[number, number, number]> = [];
  for (let i = 0; i <= n; i++) {
    const t = (tot * i) / n;
    pts.push([R * Math.cos(t), R * Math.sin(t), (pitch * t) / (2 * Math.PI)]);
  }
  return pts;
}

/** Radio envolvente de un perfil 2D (máx distancia al origen). */
function profileRadius(pts: Pt2[]): number {
  let r = 0;
  for (const p of pts) r = Math.max(r, Math.hypot(p.x, p.y));
  return r;
}

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
  // Op BASE (la que crea el PRIMER sólido): prioridad revolve > loft > sweep >
  // extrude. Gana el primer tipo-base presente; los demás base-makers se ignoran
  // (así el usuario agrega Revolve/Loft/Sweep sin borrar primero el extrude
  // inicial — el grafo nunca queda vacío). Los MODIFICADORES (hole/fillet/shell/
  // pattern/pocket) conservan su orden relativo.
  const BASE_TYPES: OpType[] = ['revolve', 'loft', 'sweep', 'extrude'];
  const baseType = BASE_TYPES.find((t) => active.some((o) => o.type === t));
  const ordered = baseType
    ? [...active.filter((o) => o.type === baseType),
       ...active.filter((o) => !(BASE_TYPES as string[]).includes(o.type))]
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
      if (sketch.kind === 'rosca') {
        // ── ROSCA MODELADA: tornillo con cuerda helicoidal REAL (ISO 68-1) ──
        // Si la rosca fina revienta el sweep (MakePipe), cae a barra lisa (nunca rompe la UI).
        const { d, pitch, length } = sketch.rosca ?? ROSCA_DEFAULTS;
        try { shape = makeThreadedRod(oc, d, pitch, length); }
        catch { shape = makeCylinder(oc, d / 2, length); }
        continue;
      }
      if (sketch.kind === 'din') {
        // ── TORNILLO DIN 933 del CATÁLOGO: no se dibuja, se INVOCA (cotas de norma).
        const dn = sketch.din ?? DIN_DEFAULTS;
        shape = makeDinBolt(oc, dn.size, dn.length);
        continue;
      }
      if (sketch.kind === 'rack') {
        // ── CREMALLERA (ISO 53): la involuta límite — flancos RECTOS a 20°.
        // Perfil trapezoide exacto extruido; vol == rackArea·width (kernel 0.0000%).
        const rk = sketch.rack ?? RACK_DEFAULTS;
        shape = makeRack(oc, { m: rk.m, teeth: rk.teeth, width: rk.width });
        continue;
      }
      // Simétrico: el plano de boceto se baja −depth/2 y se extruye depth, así
      // el sólido queda centrado en z=0 (no cambia volumen ni topología).
      // Plano del croquis (XY/YZ/XZ + offset); si es simétrico, se baja −depth/2 por su normal.
      // El extrude SNAPSHOTEA su plano al crearse (op.plane); si cambias el plano para
      // OTRO croquis, este sólido NO se mueve (cada croquis es independiente, como Fusion).
      const exPlane = (op as ExtrudeOp).plane ?? sketch.plane;
      // Offset del plano: si el op trae plano SNAPSHOTEADO, su offset también está
      // congelado (?? 0) — NUNCA cae al offset vivo del sketch, o teclear un offset
      // para el croquis de un CORTE posterior mueve la pieza base (bug del molde:
      // offset 47 del óvalo movió la tapa a y∈[−97,−47] y los 3 cortes quedaron en el aire).
      const exOffset = (op as ExtrudeOp).planeOffset ?? ((op as ExtrudeOp).plane ? 0 : sketch.planeOffset);
      const exP3d = (op as ExtrudeOp).plane3d;   // croquis-sobre-cara: SNAPSHOT del op (nunca fallback vivo a sketch.plane3d, o el base "hereda" la cara y se mueve)
      const basePlane = exPlane === 'yz' ? PLANE_YZ : exPlane === 'xz' ? PLANE_XZ : PLANE_XY;
      const sketchPlane = exP3d ? exP3d : (exOffset ? offsetPlane(basePlane, exOffset) : basePlane);
      const plane = op.symmetric ? offsetPlane(sketchPlane, -op.depth / 2) : sketchPlane;
      if (sketch.kind === 'circle') {
        shape = extrudeCircle(oc, { x: 0, y: 0 }, sketch.radius, op.depth, plane);
      } else if (sketch.kind === 'custom' && sketch.customCircle && !(sketch.customHoles && sketch.customHoles.length)) {
        // Círculo DIBUJADO a mano → cilindro exacto (gp_Circ), no prisma facetado.
        const cc = sketch.customCircle;
        shape = extrudeCircle(oc, { x: cc.x, y: cc.y }, cc.r, op.depth, plane);
      } else if (sketch.kind === 'custom' && sketch.smooth) {
        // Perfil suave (cicloidal/leva): arista curva REAL (B-spline), no facetada.
        shape = extrudeSpline(oc, profile(), op.depth, plane);
      } else if (sketch.kind === 'custom' && sketch.customHoles && sketch.customHoles.length) {
        // Perfil con cavidades (doble lazo): el interior se resta al extruir.
        shape = extrudePolygonWithHoles(oc, profile(), sketch.customHoles, op.depth, plane);
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
    } else if (op.type === 'loft') {
      if (shape) continue;
      // Loft entre el perfil base y una copia escalada a `height`. circle/gear/
      // custom usan su perfil poligonal; el resultado es un sólido cerrado exacto.
      const base = profile();
      const s = Math.max(0.02, op.topScale);
      const top = base.map((p) => ({ x: p.x * s, y: p.y * s }));
      shape = loftSections(oc, [
        { pts: base, plane: PLANE_XY },
        { pts: top, plane: { origin: [0, 0, op.height], uDir: [1, 0, 0], vDir: [0, 1, 0] } },
      ], { solid: true });
    } else if (op.type === 'sweep') {
      if (shape) continue;
      // Barre el perfil base por la trayectoria paramétrica. El círculo va como
      // perfil EXACTO (gp_Circ); el resto como polígono del sketch. El radio
      // envolvente del perfil dimensiona la hélice para que no se auto-interseque.
      const prof: SweepProfile = sketch.kind === 'circle'
        ? { kind: 'circle', center: { x: 0, y: 0 }, radius: sketch.radius }
        : { kind: 'polygon', pts: profile() };
      const profR = sketch.kind === 'circle' ? sketch.radius : profileRadius(profile());
      const path = buildSweepPath(op, profR);
      shape = sweepProfileAlong(oc, prof, path);
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
    } else if (op.type === 'draft' && shape) {
      // El DRAFT se aplica en rebuild() DESPUÉS de los componentes (la pieza
      // TERMINADA es la que se desmoldea, como el Draft Analysis del libro).
      // Aquí no-op a propósito.
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
// CROQUIS-SOBRE-CARA (la función que faltaba, como Fusion "sketch on a face"): dado el
// faceId clicado, saca el PLANO de esa cara de la malla (normal + centroide, en coords del
// kernel) para croquizar EXACTO sobre ella (no en un punto random). u,v ortonormales a n.
function planeFromMeshFace(mesh: TessellatedMesh, faceId: number): SketchPlane3D | null {
  const { positions, normals, indices, faceIds } = mesh;
  let nx = 0, ny = 0, nz = 0, cx = 0, cy = 0, cz = 0, cnt = 0;
  for (let t = 0; t < faceIds.length; t++) {
    if (faceIds[t] !== faceId) continue;
    for (let k = 0; k < 3; k++) {
      const vi = indices[t * 3 + k];
      nx += normals[vi * 3]; ny += normals[vi * 3 + 1]; nz += normals[vi * 3 + 2];
      cx += positions[vi * 3]; cy += positions[vi * 3 + 1]; cz += positions[vi * 3 + 2];
      cnt++;
    }
  }
  if (!cnt) return null;
  const nl = Math.hypot(nx, ny, nz);
  if (nl < 1e-9) return null;
  nx /= nl; ny /= nl; nz /= nl;
  // ORIGEN = centro del BBOX de la cara (el centroide de vértices se CORRE cuando la
  // cara ya tiene barrenos — bug c4t3: los ⌀10 mordían el borde). Recalculo bbox:
  let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (let t = 0; t < mesh.faceIds.length; t++) {
    if (mesh.faceIds[t] !== faceId) continue;
    for (let k = 0; k < 3; k++) {
      const vi = mesh.indices[t * 3 + k];
      const X = mesh.positions[vi * 3], Y = mesh.positions[vi * 3 + 1], Z = mesh.positions[vi * 3 + 2];
      if (X < mnx) mnx = X; if (X > mxx) mxx = X;
      if (Y < mny) mny = Y; if (Y > mxy) mxy = Y;
      if (Z < mnz) mnz = Z; if (Z > mxz) mxz = Z;
    }
  }
  cx = (mnx + mxx) / 2; cy = (mny + mxy) / 2; cz = (mnz + mxz) / 2;
  // vDir = "ARRIBA" consistente: proyección de +Z-mundo al plano (o +Y si la cara es
  // horizontal). Así el croquis-en-cara siempre tiene +y = arriba (bug c4t3: v al revés).
  const refZ = Math.abs(nz) < 0.9;
  let vx = (refZ ? 0 : 0) - (refZ ? nz * nx : ny * nx);
  let vy = (refZ ? 0 : 1) - (refZ ? nz * ny : ny * ny);
  let vz = (refZ ? 1 : 0) - (refZ ? nz * nz : ny * nz);
  const vl = Math.hypot(vx, vy, vz); vx /= vl; vy /= vl; vz /= vl;
  // uDir = v × n → u×v = n (normal saliente = dirección de extrusión del boss)
  const ux = vy * nz - vz * ny, uy = vz * nx - vx * nz, uz = vx * ny - vy * nx;
  return { origin: [cx, cy, cz], uDir: [ux, uy, uz], vDir: [vx, vy, vz] };
}

/**
 * Construye el SÓLIDO COMPLETO de un documento (pieza de biblioteca) para el
 * ensamble genérico: sketch+ops (buildShape) + componentes con sus booleanas
 * básicas (none/union/subtract) y patrón circular. Limitaciones v1 (documentadas
 * en LO-RECIO): sin piezas anidadas, sin booleanas de molde (subtractFrom/common),
 * sin mirror — una pieza típica (placa, buje, engrane, tuerca) no las usa.
 */
function buildDocSolid(oc: OC, sketch: SketchFeature, ops: Op[], components: Component[]): Shape {
  let main: Shape | null = null;
  try { main = buildShape(oc, sketch, ops.filter((o) => !o.suppressed), null); }
  catch (e) { if (!components.length) throw e; }
  const parts: Shape[] = [];
  let acc: Shape | null = main;
  for (const c of components) {
    if (c.kind === 'pieza') continue;                    // v1: sin anidar
    const mode = c.bool ?? 'none';
    if (mode === 'subtractFrom' || mode === 'common') continue;  // molde: fuera de v1
    const cs = buildComponent(oc, c);
    const pc = Math.max(1, Math.round(c.patternCount ?? 1));
    const insts: Shape[] = [cs];
    if (pc > 1) {
      const span = c.patternSpan ?? 360;
      const step = span >= 359.999 ? span / pc : span / (pc - 1);
      for (let k = 1; k < pc; k++) {
        insts.push(transformShape(oc, cs, { translate: [0, 0, 0], rotateAngle: (step * k * Math.PI) / 180, rotateAxis: { origin: [0, 0, 0], dir: c.patternAxis === 'x' ? [1, 0, 0] : c.patternAxis === 'z' ? [0, 0, 1] : [0, 1, 0] } }));
      }
    }
    for (const inst of insts) {
      if (mode === 'none' || acc === null) parts.push(inst);
      else if (mode === 'union') acc = fuse(oc, acc, inst);
      else if (mode === 'subtract') acc = cut(oc, acc, inst);
    }
  }
  // Drafts de la pieza (ángulo de salida) — al final, como en el pipeline principal.
  if (acc) for (const op of ops) { if (op.type === 'draft' && !op.suppressed) acc = draftFaces(oc, acc, (op as DraftOp).angleDeg); }
  const all = acc ? [acc, ...parts] : parts;
  if (!all.length) throw new Error(`La pieza insertada no construye ningún sólido.`);
  return all.length === 1 ? all[0] : makeCompound(oc, all);
}

function buildComponent(oc: OC, c: Component): Shape {
  const rz = ((c.rz ?? 0) * Math.PI) / 180;
  const zAxis = { origin: [0, 0, 0] as [number, number, number], dir: [0, 0, 1] as [number, number, number] };
  if (c.kind === 'pieza' && c.pieceDoc) {
    // PIEZA INSERTADA (ensamble): construye el doc snapshot completo y lo posiciona.
    let s = buildDocSolid(oc, c.pieceDoc.sketch, c.pieceDoc.ops, c.pieceDoc.components);
    if (c.x || c.y || c.z || (c.rz ?? 0)) {
      const t = transformShape(oc, s, { translate: [c.x, c.y, c.z], rotateAngle: rz, rotateAxis: zAxis });
      s.delete?.(); s = t;
    }
    return s;
  }
  if (c.kind === 'sketch' && c.profile && c.profile.length >= 3 && c.revolve) {
    // Componente REVOLUCIONADO (revolve-join/cut): perfil del croquis alrededor del eje
    // global, luego trasladado a su posición (ensamble bottom-up c7: piezas torneadas
    // separadas — cada una gira en el eje y se COLOCA con x/y/z).
    let s = revolvePolygon(oc, c.profile, c.revolve.angle, PLANE_XY, GLOBAL_AXES[c.revolve.axis]);
    if (c.x || c.y || c.z) {
      const t = transformShape(oc, s, { translate: [c.x, c.y, c.z] });
      s.delete?.(); s = t;
    }
    return s;
  }
  if (c.kind === 'sketch' && c.profile && c.profile.length >= 3) {
    // FEATURE de croquis: extruye el perfil en su plano (+offset) y lo posiciona.
    const base = c.plane === 'yz' ? PLANE_YZ : c.plane === 'xz' ? PLANE_XZ : PLANE_XY;
    // Croquis-sobre-cara: si hay plane3d, manda. Para CORTE (subtract) el prisma debe
    // entrar HACIA la pieza → se baja el plano −depth por su normal y se extruye +depth.
    const fp = c.plane3d ? c.plane3d : (c.planeOffset ? offsetPlane(base, c.planeOffset) : base);
    const pl = (c.plane3d && c.bool === 'subtract') ? offsetPlane(fp, -(c.depth ?? 12)) : fp;
    // Perfil = UN CÍRCULO exacto → CILINDRO real (gp_Circ), no prisma de N caras
    // (fix "el círculo tiene caras"). El polígono queda solo como respaldo.
    let s = (c.circle && !(c.holes && c.holes.length))
      ? extrudeCircle(oc, { x: c.circle.x, y: c.circle.y }, c.circle.r, c.depth ?? 12, pl)
      : (c.holes && c.holes.length)
        ? extrudePolygonWithHoles(oc, c.profile, c.holes, c.depth ?? 12, pl)
        : extrudePolygon(oc, c.profile, c.depth ?? 12, pl);
    if (c.x || c.y || c.z || (c.rz ?? 0)) {
      const t = transformShape(oc, s, { translate: [c.x, c.y, c.z], rotateAngle: rz, rotateAxis: zAxis });
      s.delete?.(); s = t;
    }
    return s;
  }
  if (c.kind === 'sweeppath' && c.path && c.path.length >= 2) {
    // SWEEP POR PATH DE CROQUIS: mapea el path 2D al 3D por el plano del croquis y
    // barre una elipse (polígono 24 pts) con el motor sweepProfileAlong (B-spline).
    const base = c.plane === 'yz' ? PLANE_YZ : c.plane === 'xz' ? PLANE_XZ : PLANE_XY;
    const pl = c.plane3d ? c.plane3d : (c.planeOffset ? offsetPlane(base, c.planeOffset) : base);
    const [ox, oy, oz] = pl.origin, [ux, uy, uz] = pl.uDir, [vx, vy, vz] = pl.vDir;
    const path3d: Array<[number, number, number]> = c.path.map((p) => [
      ox + p.x * ux + p.y * vx, oy + p.x * uy + p.y * vy, oz + p.x * uz + p.y * vz]);
    const rx = c.sweepRx ?? 5, ry = c.sweepRy ?? 20, N = 24;
    const ell: Pt2[] = Array.from({ length: N }, (_, k) => ({
      x: rx * Math.cos((2 * Math.PI * k) / N), y: ry * Math.sin((2 * Math.PI * k) / N) }));
    return sweepProfileAlong(oc, { kind: 'polygon', pts: ell }, path3d);
  }
  if (c.kind === 'cyl' && c.plane3d) {
    // AGUJERO-EN-CARA (Hole tool, pedido del user): cilindro con eje ⊥ a la cara clicada,
    // arranca 0.5mm AFUERA del punto de entrada (corte limpio) y entra h hacia la pieza.
    // Pasante = h grande (default 200); a medida = h exacta. Se usa con bool 'subtract'.
    // La POSICIÓN vive en c.x/y/z (se siembra con el clic y luego se EDITA exacta en el
    // panel, como el diálogo de Hole de Fusion — antes los sliders X/Y no hacían nada).
    const u = c.plane3d.uDir, v = c.plane3d.vDir;
    const n: [number, number, number] = [
      u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    return makeCylinder(oc, c.r, c.h + 0.5, {
      origin: [c.x + 0.5 * n[0], c.y + 0.5 * n[1], c.z + 0.5 * n[2]],
      dir: [-n[0], -n[1], -n[2]],
    });
  }
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

// Geometría compartida de la caja (un solo lugar de verdad).
function gearboxDims(p: GearboxParams) {
  const stepZ = p.T + p.gap;
  const totalH = p.discs * p.T + (p.discs - 1) * p.gap;
  return {
    stepZ, totalH,
    eccR: p.shaftD / 2 + p.E,            // radio de la leva excéntrica
    boreD: 2 * (p.shaftD / 2 + p.E + p.gap), // barreno del disco = ⌀leva + 2·holgura
    outR: p.R * 0.55,                    // círculo de pernos de salida
    outHoleD: p.outPinD + 2 * p.E + 2 * p.gap, // barreno de salida = perno + órbita + holgura
    baseH: p.T * 1.2,                    // placa base de la hembra
    flangeZ: totalH + 2 * p.gap,         // bajo cara de la brida de salida
    flangeH: p.T * 0.7,
  };
}

// CHAFLÁN-YOYO: la mordida del barril simétrico a 45° en la orilla del disco. Antes
// era 0.6mm (sólo equilibrio de fuerza); ahora es el CHAFLÁN de impresión que el
// usuario pidió ("las caras planas con ángulo"): el anillo exterior baja a 45° →
// SE AUTO-IMPRIME (reduce el campo de soportes al casquete central, que va con la
// flor de phi). Simétrico arriba/abajo ⇒ el empuje axial neto sigue siendo 0
// (trompo.ts) y el disco se ve como un yoyo. Acotado: ≤ T/2.5 (deja la orilla sana)
// y ≤ Rr/2 (el rodillo acinturado puede abrazarlo sin pellizcarse).
function crownMm(p: GearboxParams): number {
  return Math.min(p.T / 2.5, p.Rr / 2, 1.8);
}

// ── RETENEDOR de leva (mecánico, de plástico, print-in-place) ──────────────
// Plano r–z (x=radio, y=altura) y eje Z para revolver perfiles axisimétricos.
const RZ_PLANE = { origin: [0, 0, 0] as [number, number, number], uDir: [1, 0, 0] as [number, number, number], vDir: [0, 0, 1] as [number, number, number] };
const Z_AXIS: RevolveAxis = { origin: [0, 0, 0], dir: [0, 0, 1] };

// Holgura del retenedor: el COLLAR sobresale `lip` (> gap, si no, no retiene); el
// disco lo abraza en una garganta. Transiciones a 45° = AUTO-SOPORTADAS (sin viruta).
function retainerDims(p: GearboxParams) {
  const lip = Math.max(1.2, p.gap * 2);
  const band = Math.max(0.8, Math.min(p.T * 0.34, p.T - 2 * lip - 0.8));
  return { lip, band };
}
// Redondea vértices INTERIORES de una polilínea (filete tangente a ambos segmentos).
// El esfuerzo se vuelve CONTINUO en la esquina (no concentrador/cortante). Petición del
// usuario: los chaflanes de centrado deben ser CURVAS, no esquinas. Ver contacto-conforme.ts (Kt).
function filletPolyline(pts: Pt2[], idxs: number[], rf: number, nseg = 6): Pt2[] {
  const set = new Set(idxs);
  const out: Pt2[] = [];
  for (let i = 0; i < pts.length; i++) {
    if (!set.has(i) || i === 0 || i === pts.length - 1) { out.push(pts[i]); continue; }
    const V = pts[i], A = pts[i - 1], B = pts[i + 1];
    const L1 = Math.hypot(A.x - V.x, A.y - V.y), L2 = Math.hypot(B.x - V.x, B.y - V.y);
    if (L1 < 1e-6 || L2 < 1e-6) { out.push(V); continue; }
    // Bézier cuadrático con control en V: tangente a ambos segmentos (curva continua),
    // SIEMPRE dentro del triángulo T1·V·T2 → nunca loopea (a prueba de revolve).
    const t = Math.min(rf, L1 * 0.45, L2 * 0.45);
    const T1 = { x: V.x + (A.x - V.x) / L1 * t, y: V.y + (A.y - V.y) / L1 * t };
    const T2 = { x: V.x + (B.x - V.x) / L2 * t, y: V.y + (B.y - V.y) / L2 * t };
    out.push(T1);
    for (let k = 1; k < nseg; k++) { const s = k / nseg, m = (1 - s) * (1 - s), c = 2 * (1 - s) * s, e = s * s; out.push({ x: m * T1.x + c * V.x + e * T2.x, y: m * T1.y + c * V.y + e * T2.y }); }
    out.push(T2);
  }
  return out;
}
// Perfil (r,z) de un CARRETE: barrel rN, collar rW al medio, transiciones 45° con las 4
// esquinas REDONDEADAS (curvas) → el retenedor transmite la carga axial CONTINUO, no por
// una esquina aguda que se cizalla. El filete respeta el límite de impresión (45° en el lado
// inferior/voladizo; sólo se redondean las esquinas, no se mete voladizo nuevo).
function spoolProfile(rN: number, rW: number, zb: number, zt: number, mid: number, band: number, round = false): Pt2[] {
  const lip = rW - rN;   // 45° ⇒ Δz = Δr = lip
  const raw: Pt2[] = [
    { x: 0, y: zb }, { x: rN, y: zb },
    { x: rN, y: mid - band / 2 - lip }, { x: rW, y: mid - band / 2 },
    { x: rW, y: mid + band / 2 }, { x: rN, y: mid + band / 2 + lip },
    { x: rN, y: zt }, { x: 0, y: zt },
  ];
  // El filete sólo en la LEVA (el collar que transmite la carga axial). El barreno-cortador
  // (negativo) se queda recto: filetearlo hace que la booleana disco∩cortador explote.
  if (!round) return raw;
  const rf = Math.min(lip, band / 2) * 0.7;   // radio de filete (curva continua)
  return filletPolyline(raw, [2, 3, 4, 5], rf, 6);
}
// LEVA-carrete (sólida, eje en el origen, z 0..T): barrel eccR + collar eccR+lip,
// + CANALES DE ACEITE axiales en el barril.
function buildCamSpool(oc: OC, p: GearboxParams): Shape {
  const d0 = gearboxDims(p); const { lip, band } = retainerDims(p);
  // Collar con esquinas REDONDEADAS (curvas): el retenedor transmite la carga axial
  // CONTINUO, no por una esquina aguda que se cizalla (petición del usuario; Kt en
  // contacto-conforme.ts). El aceite se distribuye por la GARGANTA del retenedor
  // (reservorio circunferencial) + la holgura del journal; las flautas axiales chocaban
  // con el collar curvo (booleana explotaba) → se omiten, la curva manda.
  const cam = revolvePolygon(oc, spoolProfile(d0.eccR, d0.eccR + lip, 0, p.T, p.T / 2, band, true), 360, RZ_PLANE, Z_AXIS);
  return cam;
}
// CORTADOR del barreno-garganta del disco (negativo, eje en origen): el disco
// queda angosto (eccR+gap) arriba/abajo y ancho (eccR+lip+gap) en la garganta →
// el collar de la leva NO puede salir axialmente. Holgura radial = gap en todo.
function buildBoreCutter(oc: OC, p: GearboxParams): Shape {
  const d0 = gearboxDims(p); const { lip, band } = retainerDims(p);
  return revolvePolygon(oc, spoolProfile(d0.eccR + p.gap, d0.eccR + lip + p.gap, -1, p.T + 1, p.T / 2, band), 360, RZ_PLANE, Z_AXIS);
}

/**
 * UN disco cicloidal centrado, con BARRENO-GARGANTA de retención (carrete) + barrenos
 * de salida PRE-COMPENSADOS por +α/lóbulos. La garganta abraza el collar de la leva
 * → el disco no puede subir/bajar de su leva (el retenedor mecánico que faltaba).
 * Pre-compensación: el disco se RELOJEA −α/lóbulos al colocarlo (engrana sin colisión);
 * ese reloj giraría los barrenos de salida → se pre-giran +α/lóbulos para que los
 * pernos comunes entren con holgura SOLO de la órbita. Curva real (B-spline).
 */
// CROWN cónico SIMÉTRICO (diente BARRIL): rebaja el borde exterior del lóbulo arriba y
// abajo por igual → el contacto se concentra en la banda media y se afina en las caras.
// Por SIMETRÍA, las componentes de fuerza AXIAL de las dos mitades se CANCELAN (neto 0,
// como herringbone) → el torque sigue tang×R, sin complicar la transmisión (ver trompo.ts).
// Conos RECTOS (no curvas) = booleana robusta, como el cortador de barreno original.
function buildCrownCutter(oc: OC, p: GearboxParams, maxR: number): Shape {
  const crown = crownMm(p), ch = crown, ro = maxR + 2; // chaflán-yoyo 45°, simétrico
  const top = revolvePolygon(oc, [{ x: maxR - crown, y: p.T }, { x: ro, y: p.T }, { x: ro, y: p.T - ch }], 360, RZ_PLANE, Z_AXIS);
  const bot = revolvePolygon(oc, [{ x: maxR - crown, y: 0 }, { x: ro, y: 0 }, { x: ro, y: ch }], 360, RZ_PLANE, Z_AXIS);
  return makeCompound(oc, [top, bot]);
}
function buildCycDisc(oc: OC, p: GearboxParams, profile: Pt2[], outCenters: Pt2[], alphaRad: number): Shape {
  const d0 = gearboxDims(p);
  const comp = alphaRad / p.lobes;                 // pre-compensación del reloj
  const ca = Math.cos(comp), sa = Math.sin(comp);
  let d = extrudeSpline(oc, profile, p.T);
  // barreno-garganta (retenedor) en vez de barreno recto
  { const cutter = buildBoreCutter(oc, p); const t = cut(oc, d, cutter); d.delete?.(); cutter.delete?.(); d = t; }
  // CROWN simétrico (barril) en el borde exterior
  { const maxR = Math.max(...profile.map((pt) => Math.hypot(pt.x, pt.y))); const crown = buildCrownCutter(oc, p, maxR); const t = cut(oc, d, crown); d.delete?.(); crown.delete?.(); d = t; }
  for (const c of outCenters) {
    const x = c.x * ca - c.y * sa, y = c.x * sa + c.y * ca;
    d = drillHole(oc, d, { x, y, diameter: d0.outHoleD, zTop: p.T, depth: p.T, through: true });
  }
  return d;
}

// RODILLO ACINTURADO (revolve, eje en el origen z0..zTop): cilindro Rr con una CINTURA
// cóncava (radio Rr−crown) en el centro de CADA disco → "abraza" el barril del lóbulo
// (negativo suave de la hembra). El perfil (r,z) baja a la cintura y vuelve en cada disco;
// en los huecos entre discos se queda en Rr. Conos rectos = booleana robusta.
function buildScallopedRoller(oc: OC, p: GearboxParams, z0: number, zTop: number, d0: ReturnType<typeof gearboxDims>): Shape {
  const crown = crownMm(p);
  const prof: Pt2[] = [{ x: 0, y: z0 }, { x: p.Rr, y: z0 }];
  for (let i = 0; i < p.discs; i++) {
    const bot = i * d0.stepZ, mid = bot + p.T / 2, top = bot + p.T;
    prof.push({ x: p.Rr, y: bot }, { x: p.Rr - crown, y: mid }, { x: p.Rr, y: top });
  }
  prof.push({ x: p.Rr, y: zTop }, { x: 0, y: zTop });
  return revolvePolygon(oc, prof, 360, RZ_PLANE, Z_AXIS);
}

/**
 * HEMBRA = el VASO estructural (el "actuador" mismo): placa base cerrada + paredes
 * + N+1 RODILLOS ACINTURADOS integrados (la pista hembra que abraza el barril del
 * cicloidal). El eje entra por un barreno en la base. Es la pieza FIJA y estructural;
 * el reductor no es backdriveable, así que sostiene posición sola.
 */
function buildHembra(oc: OC, p: GearboxParams): Shape {
  const d0 = gearboxDims(p);
  const wall = 4;
  const Rout = p.R + p.Rr + wall;
  const zBot = -(d0.baseH + p.gap);
  const z0 = -p.gap;                 // fondo de la cavidad
  const zTop = d0.totalH + p.gap;    // tope de cavidad/rodillos
  let h = makeCylinder(oc, Rout, zTop - zBot, { origin: [0, 0, zBot], dir: [0, 0, 1] });
  // vaciar la cavidad (radio R) desde z0 → deja placa base + paredes
  { const cav = makeCylinder(oc, p.R, (zTop - z0) + 2, { origin: [0, 0, z0], dir: [0, 0, 1] }); const t = cut(oc, h, cav); h.delete?.(); cav.delete?.(); h = t; }
  // RODILLOS ACINTURADOS (híbrido barril↔socket): cada rodillo tiene una CINTURA cóncava
  // por disco (radio Rr−crown al centro de cada disco) que ABRAZA el barril del lóbulo
  // (gordo al medio) → contacto conformal de línea + centrado axial, con el gap de aceite.
  // Es el "negativo suave" de la hembra. Revolve (recto/cóncavo) = booleana robusta.
  for (const pp of pinPositions(p.R, p.lobes + 1)) {
    const rLocal = buildScallopedRoller(oc, p, z0, zTop, d0);
    const roller = transformShape(oc, rLocal, { translate: [pp.x, pp.y, 0] }); rLocal.delete?.();
    const t = fuse(oc, h, roller); h.delete?.(); roller.delete?.(); h = t;
  }
  // BASE de FIJACIÓN de prueba: pestaña ancha bajo la hembra con 4 barrenos para
  // atornillar/sujetar el mecanismo a una mesa y poder girar la palanca contra él.
  if (p.testRig) {
    const baseR = Rout + p.R * 0.4, bfH = d0.baseH * 0.7;
    const flange = makeCylinder(oc, baseR, bfH, { origin: [0, 0, zBot], dir: [0, 0, 1] });
    { const t = fuse(oc, h, flange); h.delete?.(); flange.delete?.(); h = t; }
    // corte EXPLÍCITO (no drillHole: la base está en z negativo y drillHole haría un
    // cilindro de altura negativa → inválido). Cilindro vertical pasante por la pestaña.
    const holeR = (Rout + baseR) / 2, holeRad = Math.max(1.5, p.shaftD * 0.15);
    for (const a of [45, 135, 225, 315]) {
      const ar = (a * Math.PI) / 180;
      const hc = makeCylinder(oc, holeRad, bfH + 2, { origin: [holeR * Math.cos(ar), holeR * Math.sin(ar), zBot - 1], dir: [0, 0, 1] });
      const t = cut(oc, h, hc); h.delete?.(); hc.delete?.(); h = t;
    }
  }
  // barreno de ENTRADA en la placa base (libra el eje con holgura)
  { const ib = makeCylinder(oc, p.shaftD / 2 + p.gap, d0.baseH + 2, { origin: [0, 0, zBot - 1], dir: [0, 0, 1] }); const t = cut(oc, h, ib); h.delete?.(); ib.delete?.(); h = t; }
  return h;
}

/** EJE + LEVAS excéntricas fundidas (entrada). Muñón abajo para el motor; hueco =
 *  socket del motor. Las levas (offset E, fase αᵢ) empujan los discos a orbitar. */
function buildRotor(oc: OC, p: GearboxParams): Shape {
  const d0 = gearboxDims(p);
  const phases = discPhases(p.discs);
  // eje a RAS de la base (sin muñón saliente): la base queda plana sobre la cama →
  // sin voladizo. El motor entra por el barreno de la base al socket hueco del eje.
  const shZ0 = -(d0.baseH + p.gap);
  let rotor = makeCylinder(oc, p.shaftD / 2, (d0.totalH + p.gap) - shZ0, { origin: [0, 0, shZ0], dir: [0, 0, 1] });
  for (let i = 0; i < p.discs; i++) {
    const a = (phases[i] * Math.PI) / 180;
    // leva-CARRETE (con collar retenedor) en su fase, desplazada a la posición de la leva
    const camLocal = buildCamSpool(oc, p);
    const cam = transformShape(oc, camLocal, { translate: [p.E * Math.cos(a), p.E * Math.sin(a), i * d0.stepZ] });
    camLocal.delete?.();
    const t = fuse(oc, rotor, cam); rotor.delete?.(); cam.delete?.(); rotor = t;
  }
  // PALANCA (manivela) de prueba para girar el eje a MANO — sube por el centro de la
  // brida de salida y termina en un mango vertical (lo agarras y le das vuelta).
  if (p.testRig) {
    const topZ = d0.totalH + p.gap;
    const stemTop = d0.flangeZ + d0.flangeH + 8 * (p.T / 6);
    const armRad = Math.max(2, p.shaftD / 4);
    const stem = makeCylinder(oc, p.shaftD / 2, stemTop - topZ, { origin: [0, 0, topZ], dir: [0, 0, 1] });
    { const t = fuse(oc, rotor, stem); rotor.delete?.(); stem.delete?.(); rotor = t; }
    const armR = p.R * 1.3;
    const arm = makeCylinder(oc, armRad, armR, { origin: [0, 0, stemTop + armRad], dir: [1, 0, 0] });
    { const t = fuse(oc, rotor, arm); rotor.delete?.(); arm.delete?.(); rotor = t; }
    const handle = makeCylinder(oc, armRad, p.R * 0.55, { origin: [armR, 0, stemTop + armRad], dir: [0, 0, 1] });
    { const t = fuse(oc, rotor, handle); rotor.delete?.(); handle.delete?.(); rotor = t; }
  }
  if (p.shaftBore > 0) {
    const bore = makeCylinder(oc, p.shaftBore / 2, (d0.totalH + 4 * p.T) - shZ0, { origin: [0, 0, shZ0 - 1], dir: [0, 0, 1] });
    const t = cut(oc, rotor, bore); rotor.delete?.(); bore.delete?.(); rotor = t;
  }
  return rotor;
}

/** SALIDA = la TAPA que gira: brida que cubre la boca del vaso (holgura a la pared)
 *  + M pernos que bajan por los barrenos de los discos → extraen el giro lento y,
 *  con la placa base, ATRAPAN los discos axialmente (encapsulado print-in-place). */
function buildOutput(oc: OC, p: GearboxParams, outCenters: Pt2[]): Shape {
  const d0 = gearboxDims(p);
  let output = makeCylinder(oc, p.R - p.gap, d0.flangeH, { origin: [0, 0, d0.flangeZ], dir: [0, 0, 1] });
  for (const c of outCenters) {
    const pin = makeCylinder(oc, p.outPinD / 2, d0.flangeZ, { origin: [c.x, c.y, d0.flangeZ], dir: [0, 0, -1] });
    const t = fuse(oc, output, pin); output.delete?.(); pin.delete?.(); output = t;
  }
  { const cb = makeCylinder(oc, p.shaftD / 2 + p.gap, d0.flangeH + 2, { origin: [0, 0, d0.flangeZ - 1], dir: [0, 0, 1] }); const t = cut(oc, output, cb); output.delete?.(); cb.delete?.(); output = t; }
  return output;
}

/**
 * CAJA cicloidal en UNA pieza, ENCAPSULADA print-in-place — sale lista de la
 * impresora, solo se conecta el motor. Compone: hembra-vaso (fija) + discos
 * RELOJEADOS −αᵢ/lóbulos (engranan sin colisión) sobre las levas del eje + brida
 * de salida (tapa que gira). Cada interfaz móvil tiene holgura `gap` = el canal de
 * grasa que la impresora puentea. Geometría exacta; supervivencia en gearbox.ts.
 */
function buildGearbox(oc: OC, p: GearboxParams): Shape {
  const d0 = gearboxDims(p);
  const disc = cycloidalDisc({ lobes: p.lobes, R: p.R, Rr: p.Rr + p.gap, E: p.E, segments: Math.max(90, p.lobes * 9) });
  const phases = discPhases(p.discs);
  const outCenters = pinPositions(d0.outR, Math.max(3, Math.round(p.outPins)));
  const parts: Shape[] = [];

  // DISCOS: relojeados −αᵢ/lóbulos (engranan con los MISMOS rodillos sin colisión).
  for (let i = 0; i < p.discs; i++) {
    const a = (phases[i] * Math.PI) / 180;
    const d = buildCycDisc(oc, p, disc.profile, outCenters, a);
    const placed = transformShape(oc, d, {
      translate: [p.E * Math.cos(a), p.E * Math.sin(a), i * d0.stepZ],
      rotateAngle: -a / p.lobes, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] },
    });
    d.delete?.();
    parts.push(placed);
  }
  parts.push(buildRotor(oc, p));
  parts.push(buildHembra(oc, p));
  parts.push(buildOutput(oc, p, outCenters));
  // SOPORTES FRANGIBLES: sostienen los discos cada ~9mm mientras imprime (cuellos
  // que el 1er giro cizalla). SIN esto los discos flotan/se funden — por eso falló
  // el primer print. Ahora ENTRAN a la pieza (y al STL). Default ON.
  if (p.supports !== false) parts.push(buildSupportTree(oc, p));
  return makeCompound(oc, parts);
}

/**
 * Las MISMAS piezas de la caja pero SEPARADAS y NOMBRADAS (en su pose ensamblada),
 * para listarlas en el árbol, darles color y OCULTARLAS una por una (como Fusion).
 * key estable: hembra · eje · disco-1..N · salida. El llamador las tesela y libera.
 */
function buildGearboxBodies(oc: OC, p: GearboxParams): { key: string; name: string; shape: Shape }[] {
  const d0 = gearboxDims(p);
  const disc = cycloidalDisc({ lobes: p.lobes, R: p.R, Rr: p.Rr + p.gap, E: p.E, segments: Math.max(90, p.lobes * 9) });
  const phases = discPhases(p.discs);
  const outCenters = pinPositions(d0.outR, Math.max(3, Math.round(p.outPins)));
  const out: { key: string; name: string; shape: Shape }[] = [];
  out.push({ key: 'hembra', name: 'Hembra (vaso)', shape: buildHembra(oc, p) });
  out.push({ key: 'eje', name: 'Eje + levas', shape: buildRotor(oc, p) });
  for (let i = 0; i < p.discs; i++) {
    const a = (phases[i] * Math.PI) / 180;
    const d = buildCycDisc(oc, p, disc.profile, outCenters, a);
    const placed = transformShape(oc, d, {
      translate: [p.E * Math.cos(a), p.E * Math.sin(a), i * d0.stepZ],
      rotateAngle: -a / p.lobes, rotateAxis: { origin: [0, 0, 0], dir: [0, 0, 1] },
    });
    d.delete?.();
    out.push({ key: `disco-${i + 1}`, name: `Disco ${i + 1}`, shape: placed });
  }
  out.push({ key: 'salida', name: 'Salida (brida)', shape: buildOutput(oc, p, outCenters) });
  if (p.supports !== false) out.push({ key: 'soportes', name: 'Soportes frangibles', shape: buildSupportTree(oc, p) });
  // El soporte ya NO es un árbol frangible aparte: es la JAULA de rodillos (estructural)
  // + el journal continuo del disco sobre la leva (con canales de aceite). Ver cojinete-continuo.ts.
  return out;
}

/**
 * ÁRBOL DE SOPORTES funcional (soporte + centrado, frangible) — el rediseño con
 * el usuario (figuras 9–12): la cara del disco ya no es plana sino un CHAFLÁN-YOYO
 * de 45° que auto-imprime la ORILLA; el casquete central que todavía vuela se llena
 * de una FLOR DE PHI (137.5°, filotaxis de Vogel) de árboles frangibles que NINGUNO
 * estorba al otro y esquivan el eje y los pernos de salida. Cada árbol = CUELLO
 * delgado abajo (el 1er giro lo cizalla) + CUERPO ancho arriba (no se pandea).
 * + 3 ESPINAS de grasa a 120° en la pared + 3 ESPIGAS de centrado por disco
 * (barreno↔leva). Cuerpo de DISPLAY (compound): nace con la pieza, se ve, y "muere"
 * en la 1ª vuelta. Math puro y testeado en supports.ts (phyllotaxisField).
 */
function buildSupportTree(oc: OC, p: GearboxParams): Shape {
  const d0 = gearboxDims(p);
  const phases = discPhases(p.discs);
  const parts: Shape[] = [];
  // pilar VERTICAL (centrado en x,y,z): caja w×w×h, sin rotación.
  const pillar = (w: number, h: number, x: number, y: number, z: number): Shape => {
    const raw = makeBox(oc, w, w, h);
    const t = transformShape(oc, raw, { translate: [x - w / 2, y - w / 2, z - h / 2] }); raw.delete?.();
    return t;
  };
  // FLOR DE PHI: el chaflán-yoyo a 45° (crownMm) auto-imprime el anillo exterior
  // [maxR−crown, maxR]; sólo el casquete [rMin, rMax] todavía vuela → se llena de
  // árboles repartidos por el ángulo áureo (ninguno se encima, prueba: minSpacing).
  // Esquivan el eje (rMin) y los pernos de salida (keepOut). Cada ~6.5mm (< puente PLA).
  const disc = cycloidalDisc({ lobes: p.lobes, R: p.R, Rr: p.Rr + p.gap, E: p.E, segments: Math.max(90, p.lobes * 9) });
  const crown = crownMm(p);
  const rMin = d0.eccR + p.gap + 2;             // libra la leva/barreno
  const rMax = Math.max(rMin + 1, disc.maxR - crown - 1); // el chaflán cubre lo de afuera
  const outCenters = pinPositions(d0.outR, Math.max(3, Math.round(p.outPins)));
  const keepOut = outCenters.map((c) => ({ x: c.x, y: c.y, r: d0.outHoleD / 2 + 1 }));
  const n = Math.min(120, phylloCountForSpacing(rMin, rMax, 6.5));
  const flower = phyllotaxisField({ n, rMin, rMax, keepOut });
  const wBody = 1.0, wNeck = 0.35, neckH = 0.2;   // cuello 0.35² = 0.12mm² c/u
  let neckArea = 0;
  for (let i = 0; i < p.discs; i++) {
    const zLow = i * d0.stepZ - p.gap;            // cara de abajo del hueco (disco/base inferior)
    const spin = (i * GOLDEN_ANGLE_DEG * Math.PI / 180) % (2 * Math.PI);  // gira la flor entre pisos (no se alinean en Z)
    const cs = Math.cos(spin), sn = Math.sin(spin);
    for (const pt of flower.points) {
      const x = pt.x * cs - pt.y * sn, y = pt.x * sn + pt.y * cs;
      parts.push(pillar(wNeck, neckH, x, y, zLow + neckH / 2));               // CUELLO (rompe)
      parts.push(pillar(wBody, p.gap - neckH, x, y, zLow + neckH + (p.gap - neckH) / 2)); // CUERPO (soporta)
      neckArea += wNeck * wNeck;
    }
  }
  void neckArea;  // Σ cuellos / nº huecos ≈ presupuesto; verificado en el análisis
  // 3 ESPINAS de grasa en la pared (0/120/240°), conectadas a la pared = ancladas.
  for (const a of [0, 120, 240]) {
    const ar = (a * Math.PI) / 180;
    parts.push(pillar(2.5, d0.totalH, (p.R - 1.5) * Math.cos(ar), (p.R - 1.5) * Math.sin(ar), d0.totalH / 2));
  }
  // ESPIGAS de centrado: 3 por disco, barreno↔leva (mantienen el centro al imprimir).
  for (let i = 0; i < p.discs; i++) {
    const a = (phases[i] * Math.PI) / 180;
    const ox = p.E * Math.cos(a), oy = p.E * Math.sin(a);
    const z = i * d0.stepZ + p.T / 2;
    for (let k = 0; k < 3; k++) {
      const th = a + (2 * Math.PI * k) / 3;
      parts.push(pillar(0.6, p.T * 0.6, ox + (d0.eccR + p.gap / 2) * Math.cos(th), oy + (d0.eccR + p.gap / 2) * Math.sin(th), z));
    }
  }
  return makeCompound(oc, parts);
}

// ── MOVIMIENTO: la misma caja, pero en PIEZAS SEPARADAS y centradas para animar
// la cinemática real. Eje gira θ → las levas (offset E) empujan los discos a
// ORBITAR → engranan los pernos → el disco gira lento −θ/lóbulos; los pernos de
// salida extraen ese giro lento. Se teselan UNA vez; useFrame solo mueve grupos. ──
interface PartGeo { positions: Float32Array; normals: Float32Array; indices: Uint32Array; }
interface GearboxMotionData {
  housing: PartGeo;   // hembra-vaso + rodillos (FIJO)
  rotor: PartGeo;     // eje + levas excéntricas (gira θ)
  output: PartGeo;    // brida + pernos de salida (gira −θ/lóbulos)
  discs: { geo: PartGeo; phase: number; z: number }[];  // cada disco: geo + fase αᵢ + altura
  lobes: number; E: number;
}

function tessGeo(oc: OC, shape: Shape): PartGeo {
  const m = tessellate(oc, shape, 0.08, 0.3);
  return { positions: m.positions, normals: m.normals, indices: m.indices };
}

// Mismas piezas que buildGearbox pero SEPARADAS y teseladas para animar. El disco
// se construye centrado y SIN relojear; la animación aplica reloj −(θ+αᵢ)/lóbulos
// + órbita por frame. Los pernos de salida ya van pre-compensados en buildCycDisc.
function buildGearboxMotionData(oc: OC, p: GearboxParams): GearboxMotionData {
  const d0 = gearboxDims(p);
  const disc = cycloidalDisc({ lobes: p.lobes, R: p.R, Rr: p.Rr + p.gap, E: p.E, segments: Math.max(90, p.lobes * 9) });
  const phasesDeg = discPhases(p.discs);
  const outCenters = pinPositions(d0.outR, Math.max(3, Math.round(p.outPins)));

  const discs = phasesDeg.map((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const d = buildCycDisc(oc, p, disc.profile, outCenters, a);
    const geo = tessGeo(oc, d); d.delete?.();
    return { geo, phase: a, z: i * d0.stepZ };
  });

  const rotor = buildRotor(oc, p); const rotorGeo = tessGeo(oc, rotor); rotor.delete?.();
  const hembra = buildHembra(oc, p); const housingGeo = tessGeo(oc, hembra); hembra.delete?.();
  const output = buildOutput(oc, p, outCenters); const outputGeo = tessGeo(oc, output); output.delete?.();

  return { housing: housingGeo, rotor: rotorGeo, output: outputGeo, discs, lobes: p.lobes, E: p.E };
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
// MOVIMIENTO de la caja cicloidal — cinemática REAL animada
// ──────────────────────────────────────────────────────────────────
/** Una pieza teselada con su color/acabado. opacity<1 → translúcida (ver adentro).
 *  clip = planos de sección (corta este cuerpo también). */
function PartMesh({ geo, color, metalness = 0.15, roughness = 0.55, opacity = 1, clip }: {
  geo: PartGeo; color: string; metalness?: number; roughness?: number; opacity?: number; clip?: THREE.Plane[] | null;
}) {
  const g = useMemo(() => {
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.BufferAttribute(geo.positions, 3));
    b.setAttribute('normal', new THREE.BufferAttribute(geo.normals, 3));
    b.setIndex(new THREE.BufferAttribute(geo.indices, 1));
    b.computeBoundingSphere();
    return b;
  }, [geo]);
  useEffect(() => () => g.dispose(), [g]);
  const transparent = opacity < 1;
  return (
    <mesh geometry={g} castShadow={!transparent} receiveShadow={!transparent} renderOrder={transparent ? 3 : 0}>
      <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} envMapIntensity={1.1}
        side={THREE.DoubleSide} transparent={transparent} opacity={opacity} depthWrite={!transparent}
        clippingPlanes={clip ?? undefined} />
    </mesh>
  );
}

// Colores por defecto de cada cuerpo de la caja (cada cosa distinta, como Fusion).
// discos en colores VÍVIDOS y DISTINTOS (para contarlos/separarlos de un vistazo —
// el crema sutil no se distinguía, lo marcó la revisión de usabilidad).
const GB_DISC_RAMP = ['#ef7d3a', '#16a085', '#e84393', '#8e5cd9', '#12a8c0', '#f1c40f', '#5b6cf0', '#e74c3c', '#2ecc71', '#d96fb0'];
function gbDefaultColor(key: string): string {
  if (key === 'hembra') return '#5a6576';
  if (key === 'eje') return '#caa15e';
  if (key === 'salida') return '#6fb6c9';
  if (key === 'soportes') return '#3ad97a';   // árbol de soportes = verde (orgánico)
  const m = /^disco-(\d+)$/.exec(key);
  if (m) return GB_DISC_RAMP[(parseInt(m[1], 10) - 1) % GB_DISC_RAMP.length];
  return '#cfd6df';
}
function gbBodyDefs(discs: number): { key: string; name: string }[] {
  const list = [{ key: 'hembra', name: 'Hembra (vaso)' }, { key: 'eje', name: 'Eje + levas' }];
  for (let i = 0; i < discs; i++) list.push({ key: `disco-${i + 1}`, name: `Disco ${i + 1}` });
  list.push({ key: 'salida', name: 'Salida (brida)' });
  return list;
}

/**
 * Anima el reductor cicloidal con su CINEMÁTICA exacta:
 *  · rotor (eje+levas): gira θ → las levas (offset E) orbitan radio E.
 *  · disco i: su centro orbita a (E·cos(αᵢ+θ), E·sin(αᵢ+θ)) [cabalga la leva] y gira
 *    −(θ+αᵢ)/lóbulos = giro de salida −θ/lóbulos MÁS su RELOJ fijo −αᵢ/lóbulos (sin
 *    ese reloj los lóbulos chocan con los rodillos — el bug que viste).
 *  · salida (brida+pernos): gira −θ/lóbulos (extrae el giro lento del disco).
 *  · hembra-vaso (fija): semitransparente para ver el mecanismo adentro.
 * El rotor y la salida ya están en z absoluto; los discos llevan su z en el grupo.
 */
function GearboxMotion({ data, playing, speed, colors, hidden, clip }: {
  data: GearboxMotionData; playing: boolean; speed: number;
  colors: Record<string, string>; hidden: Record<string, boolean>; clip?: THREE.Plane[] | null;
}) {
  const col = (k: string) => colors[k] ?? gbDefaultColor(k);
  const rotorRef = useRef<THREE.Group>(null);
  const outRef = useRef<THREE.Group>(null);
  const discRefs = useRef<(THREE.Group | null)[]>([]);
  const theta = useRef(0);
  useFrame((_, dt) => {
    if (playing) theta.current += Math.min(dt, 0.05) * speed;  // rad/s del EJE de entrada
    const th = theta.current;
    const lobes = Math.max(1, data.lobes);
    if (rotorRef.current) rotorRef.current.rotation.z = th;
    if (outRef.current) outRef.current.rotation.z = -th / lobes;
    for (let i = 0; i < data.discs.length; i++) {
      const grp = discRefs.current[i];
      if (!grp) continue;
      const { phase, z } = data.discs[i];
      grp.position.set(data.E * Math.cos(phase + th), data.E * Math.sin(phase + th), z);
      grp.rotation.z = -(th + phase) / lobes;   // giro lento + RELOJ fijo −αᵢ/lóbulos
    }
  });
  return (
    <group>
      <group ref={rotorRef}>
        {!hidden['eje'] && <PartMesh geo={data.rotor} color={col('eje')} metalness={0.85} roughness={0.28} clip={clip} />}
      </group>
      {data.discs.map((d, i) => (
        <group key={i} ref={(el) => { discRefs.current[i] = el; }}>
          {!hidden[`disco-${i + 1}`] && <PartMesh geo={d.geo} color={col(`disco-${i + 1}`)} metalness={0.05} roughness={0.62} clip={clip} />}
        </group>
      ))}
      <group ref={outRef}>
        {!hidden['salida'] && <PartMesh geo={data.output} color={col('salida')} metalness={0.25} roughness={0.5} opacity={hidden['hembra'] ? 1 : 0.55} clip={clip} />}
      </group>
      {/* hembra translúcida para ver el mecanismo; si la ocultas, desaparece */}
      {!hidden['hembra'] && <PartMesh geo={data.housing} color={col('hembra')} metalness={0.45} roughness={0.45} opacity={0.18} clip={clip} />}
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// SECCIÓN estilo Fusion — plano de corte con FLECHA ARRASTRABLE (no barras)
// ──────────────────────────────────────────────────────────────────
/**
 * Manipulador de sección: un plano translúcido + una FLECHA que arrastras con el
 * mouse para mover el corte a lo largo del eje (como Fusion). Vive DENTRO del grupo
 * del modelo (coords locales), pero el plano de recorte (clip) lo deriva en MUNDO
 * desde su matrixWorld — así corta donde debe aunque el grupo esté rotado. Mientras
 * arrastras, desactiva el OrbitControls. Sin estado por-frame: muta refs y solo
 * confirma el offset al soltar.
 */
// ── ESTUDIO VIENTO: post-procesador CFD sobre la pieza (no glifos: CAMPO real) ──
// Flujo supersónico sobre la cuña: streamlines que se DOBLAN y COMPRIMEN al cruzar
// la onda de choque (β real θ-β-M) + campo denso de partículas advectadas (schlieren:
// se agolpan donde el flujo frena tras el choque) + Cp pintado sobre las caras.
// Todo en coords locales de la cuña (s a lo largo de la cuerda desde el filo, n ⊥).

// paleta de presión (Cp): azul frío (baja p / expansión) → ámbar (alta p / compresión).
// `scale` NORMALIZA al rango de Cp que realmente hay en la escena — si se deja fijo,
// un Cp chico (la cuña da apenas 0.113) se queda a media escala y todo sale GRIS.
function cpColor(cp: number, out: THREE.Color, scale = 0.35) {
  const t = Math.max(-1, Math.min(1, cp / Math.max(0.02, scale)));
  if (t >= 0) out.setRGB(0.30 + 0.70 * t, 0.34 + 0.38 * t, 0.58 - 0.48 * t); // → ámbar cálido
  else out.setRGB(0.30 + 0.22 * t, 0.50 + 0.30 * t, 0.90 + 0.10 * t);        // → azul frío
  return out;
}

// ── CALIDAD ADAPTABLE: correr LIGERO en PCs viejas de LATAM, ULTRA en las nuevas ──
// La física es idéntica y baratísima (CPU); solo escala cuántas partículas dibujo
// y si las animo. Un solo draw-call en cualquier tier. Sin EffectComposer (el
// viewport del CAD lo prohíbe): el glow del modo Ultra se finge con sprite aditivo.
let _dotTex: THREE.Texture | null = null;
function dotSprite(): THREE.Texture {
  if (_dotTex) return _dotTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  _dotTex = new THREE.CanvasTexture(c); return _dotTex;
}
export interface VientoQ { particles: number; streamlines: number; animate: boolean; throttle: number; glow: boolean; tier: 0 | 1 | 2 }
const VIENTO_TIERS: Record<0 | 1 | 2, Omit<VientoQ, 'tier'>> = {
  0: { particles: 650,  streamlines: 32,  animate: false, throttle: 3, glow: false }, // PC vieja / software
  1: { particles: 2600, streamlines: 64,  animate: true,  throttle: 1, glow: false }, // laptop decente
  2: { particles: 6000, streamlines: 100, animate: true,  throttle: 1, glow: true },  // GPU discreta
};
// detecta el tier leyendo el renderer real de WebGL (+ núcleos). SwiftShader/llvmpipe/
// Intel viejo → 0; GPU discreta (NVIDIA/AMD/Apple/Adreno alto) → 2; resto → 1.
function detectVientoTier(gl: THREE.WebGLRenderer): 0 | 1 | 2 {
  try {
    const ctx = gl.getContext();
    const dbg = ctx.getExtension('WEBGL_debug_renderer_info');
    const r = (dbg ? String(ctx.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '').toLowerCase();
    if (!r || /swiftshader|llvmpipe|software|microsoft basic/.test(r)) return 0;
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4;
    if (/nvidia|geforce|rtx|radeon|\bamd\b|apple m\d|adreno 7|mali-g7/.test(r) && cores >= 8) return 2;
    if (/intel.*(hd|uhd) graphics (4|5|6)\d\d\b/.test(r) || cores <= 4) return 0; // integradas viejas
    return 1;
  } catch { return 1; }
}
function resolveVientoQ(gl: THREE.WebGLRenderer, calidad: 'auto' | 'ligero' | 'ultra'): VientoQ {
  const tier: 0 | 1 | 2 = calidad === 'ligero' ? 0 : calidad === 'ultra' ? 2 : detectVientoTier(gl);
  return { ...VIENTO_TIERS[tier], tier };
}

interface WedgeFrame {
  apex: THREE.Vector3; eChord: THREE.Vector3; eThick: THREE.Vector3; eDepth: THREE.Vector3;
  chord: number; halfT: number; halfD: number; tanD: number; tanB: number; cpFace: number;
}
function useWedgeFrame(bbox: { center: number[]; half: number[] }, r: VientoSuperResultado): WedgeFrame {
  return useMemo(() => {
    const spans = bbox.half.map((h) => h * 2);
    let ci = 0, ti = 0;
    for (let k = 1; k < 3; k++) { if (spans[k] > spans[ci]) ci = k; if (spans[k] < spans[ti]) ti = k; }
    if (ti === ci) ti = (ci + 1) % 3;
    const di = 3 - ci - ti;
    const e = (i: number) => { const v = new THREE.Vector3(); v.setComponent(i, 1); return v; };
    const C = new THREE.Vector3(bbox.center[0], bbox.center[1], bbox.center[2]);
    const eChord = e(ci);
    const delta = (r.deltaDeg * Math.PI) / 180, beta = (r.betaDeg * Math.PI) / 180;
    return {
      apex: C.clone().addScaledVector(eChord, -bbox.half[ci]),
      eChord, eThick: e(ti), eDepth: e(di),
      chord: spans[ci], halfT: bbox.half[ti], halfD: bbox.half[di],
      tanD: Math.tan(delta), tanB: Math.tan(beta),
      cpFace: (r.p2 - r.pInf) / r.q, // Cp de las caras (compresión)
    };
  }, [bbox, r]);
}

// posición mundo de un punto local (s desde el filo, n ⊥, z envergadura)
function wedgeToWorld(f: WedgeFrame, s: number, n: number, z: number, out: THREE.Vector3) {
  return out.copy(f.apex).addScaledVector(f.eChord, s).addScaledVector(f.eThick, n).addScaledVector(f.eDepth, z);
}
// altura n de una línea de corriente sembrada a n0 (constante ahí), tras cruzar el choque
function streamN(f: WedgeFrame, n0: number, s: number): number {
  if (Math.abs(n0) < 1e-6) return 0;
  const sgn = Math.sign(n0);
  const sShock = Math.abs(n0) / f.tanB;      // s donde la línea horizontal cruza el choque
  if (s <= sShock) return n0;
  return n0 + sgn * (s - sShock) * f.tanD;   // detrás del choque: paralela a la cara
}

// CAMPO DE PARTÍCULAS advectado (schlieren): se agolpan tras el choque (frenan).
// N y animación escalan por tier (q); el sembrado y la física son idénticos.
function VientoFlowField({ f, q }: { f: WedgeFrame; q: VientoQ }) {
  const N = q.particles;
  const ZPL = q.tier === 0 ? 3 : 5;
  const sMin = -f.chord * 0.7, sMax = f.chord * 1.55;
  const nSpread = f.halfT * 3.2 + f.chord * 0.16;
  const seeds = useMemo(() => {
    const a: { n0: number; z: number; ph: number; band: number }[] = [];
    for (let i = 0; i < N; i++) {
      const u = (i * 0.61803398875) % 1;               // secuencia áurea (uniforme, sin random)
      let n0 = (u - 0.5) * 2 * nSpread;
      if (Math.abs(n0) < f.halfT * 0.06) n0 += (n0 >= 0 ? 1 : -1) * f.halfT * 0.06; // evita el cuerpo
      const z = (((i % ZPL) / Math.max(1, ZPL - 1)) - 0.5) * 2 * f.halfD * 0.92;
      a.push({ n0, z, ph: (i * 0.7548776662) % 1, band: ((i * 13) % 7) / 7 });
    }
    return a;
  }, [N, ZPL, nSpread, f.halfT, f.halfD]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.boundingSphere = new THREE.Sphere(f.apex.clone(), f.chord * 3);
    return g;
  }, [N, f.apex, f.chord]);
  const mat = useMemo(() => new THREE.PointsMaterial({
    size: Math.max(f.chord * (q.glow ? 0.009 : 0.006), q.glow ? 9 : 6), sizeAttenuation: true,
    vertexColors: true, map: dotSprite(), transparent: true, opacity: q.glow ? 0.95 : 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [f.chord, q.glow]);

  const tRef = useRef(0); const frameRef = useRef(0);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const fill = (t: number) => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const cA = geo.getAttribute('color') as THREE.BufferAttribute;
    const span = sMax - sMin;
    const vAhead = f.chord * 0.42;
    for (let i = 0; i < N; i++) {
      const sd = seeds[i];
      const cycle = (t * vAhead / span + sd.ph) % 1;   // fase temporal → posición s
      const s = sMin + cycle * span;
      const n = streamN(f, sd.n0, s);
      const behind = s > Math.abs(sd.n0) / f.tanB && s > 0; // ¿tras el choque?
      wedgeToWorld(f, s, n, sd.z, tmp);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
      cpColor(behind ? f.cpFace : -0.04 * f.cpFace, col, f.cpFace);
      const bright = behind ? 1.35 + 0.5 * sd.band : 0.55 + 0.25 * sd.band;
      cA.setXYZ(i, col.r * bright, col.g * bright, col.b * bright);
    }
    pos.needsUpdate = true; cA.needsUpdate = true;
  };
  // modo Ligero (throttle>1 o !animate): pinta pocas veces; Ultra: cada frame.
  useMemo(() => fill(0), [seeds, f, q.glow]); // primer llenado (también cubre el modo estático)
  useFrame((_, dt) => {
    if (!q.animate) return;
    frameRef.current++;
    if (q.throttle > 1 && frameRef.current % q.throttle !== 0) return;
    tRef.current += Math.min(dt, 0.05) * q.throttle;
    fill(tRef.current);
  });
  return <points geometry={geo} material={mat} />;
}

// STREAMLINES: muchas líneas finas que se doblan y comprimen en el choque (NL por tier)
function VientoStreamlines({ f, q }: { f: WedgeFrame; q: VientoQ }) {
  const NL = q.streamlines;
  const geo = useMemo(() => {
    const nSpread = f.halfT * 3.0 + f.chord * 0.14;
    const sMin = -f.chord * 0.7, sMax = f.chord * 1.55;
    const SEG = q.tier === 0 ? 14 : 24;
    const pos: number[] = [], colr: number[] = [];
    // OJO: no llamar `q` a este Vector3 — ensombrece el prop `q` (calidad) y la
    // TDZ tumba el componente entero (bug cazado por la captura CPU 2026-07-14).
    const col = new THREE.Color(), pA = new THREE.Vector3(), pB = new THREE.Vector3();
    for (let li = 0; li < NL; li++) {
      const fr = (li + 0.5) / NL;
      let n0 = (fr - 0.5) * 2 * nSpread;
      if (Math.abs(n0) < f.halfT * 0.05) continue;
      const z = (((li % 5) / 4) - 0.5) * 2 * f.halfD * 0.9;
      for (let k = 0; k < SEG; k++) {
        const s0 = sMin + (k / SEG) * (sMax - sMin);
        const s1 = sMin + ((k + 1) / SEG) * (sMax - sMin);
        wedgeToWorld(f, s0, streamN(f, n0, s0), z, pA);
        wedgeToWorld(f, s1, streamN(f, n0, s1), z, pB);
        const behind = s0 > Math.abs(n0) / f.tanB && s0 > 0;
        cpColor(behind ? f.cpFace : -0.04 * f.cpFace, col, f.cpFace);
        const b = behind ? 1.3 : 0.55;
        pos.push(pA.x, pA.y, pA.z, pB.x, pB.y, pB.z);
        colr.push(col.r * b, col.g * b, col.b * b, col.r * b, col.g * b, col.b * b);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colr), 3));
    g.boundingSphere = new THREE.Sphere(f.apex.clone(), f.chord * 3);
    return g;
  }, [f, NL]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, opacity: q.glow ? 0.85 : 0.75,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), [q.glow]);
  return <lineSegments geometry={geo} material={mat} />;
}

function VientoOverlay({ bbox, r, showP, showTau, showShock, calidad, onTier }: {
  bbox: { center: number[]; half: number[] };
  r: VientoSuperResultado; showP: boolean; showTau: boolean; showShock: boolean;
  calidad: 'auto' | 'ligero' | 'ultra'; onTier?: (t: 0 | 1 | 2) => void;
}) {
  const f = useWedgeFrame(bbox, r);
  const gl = useThree((s) => s.gl);
  const q = useMemo(() => resolveVientoQ(gl, calidad), [gl, calidad]);
  useEffect(() => { onTier?.(q.tier); }, [q.tier, onTier]);


  // onda de choque: dos hojas desde el filo a ±β (schlieren). El plano debe
  // extenderse a lo largo del CHOQUE (dir) y de la ENVERGADURA (eDepth) — así se
  // ve de CANTO (línea nítida) desde el perfil. Base: X=dir, Y=eDepth, Z=normal.
  const shockLen = f.chord * 1.9;
  const shock = useMemo(() => [1, -1].map((s) => {
    const dir = f.eChord.clone().addScaledVector(f.eThick, s * f.tanB).normalize();
    const nrm = dir.clone().cross(f.eDepth).normalize();
    const m = new THREE.Matrix4().makeBasis(dir, f.eDepth, nrm);
    return { q: new THREE.Quaternion().setFromRotationMatrix(m), pos: f.apex.clone().addScaledVector(dir, shockLen / 2) };
  }), [f, shockLen]);

  return (
    <group>
      {/* siempre que el estudio corre: el CAMPO (flujo real, no glifos) — escala por tier */}
      <VientoStreamlines f={f} q={q} />
      <VientoFlowField f={f} q={q} />
      {/* El Cp NO se sobrepone con quads (z-fight/artefactos): se pinta en los
          VÉRTICES del sólido real vía el canal feaColors — igual que von Mises. */}
      {showShock && shock.map((sh, i) => (
        <mesh key={i} position={sh.pos} quaternion={sh.q}>
          <planeGeometry args={[shockLen, f.halfD * 2]} />
          <meshBasicMaterial color="#FFC48A" transparent opacity={0.5} side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function SectionGizmo({ bbox, axis, flip, offset, setOffset, clip }: {
  bbox: { center: number[]; half: number[] };
  axis: 'x' | 'y' | 'z'; flip: boolean; offset: number;
  setOffset: (o: number) => void; clip: THREE.Plane[];
}) {
  const grpRef = useRef<THREE.Group>(null);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const ai = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const sign = flip ? -1 : 1;
  const span = Math.max(bbox.half[0], bbox.half[1], bbox.half[2]) || 20;
  const dragging = useRef(false);
  const liveOffset = useRef(offset);

  // orienta la flecha/plano: +Z local → eje elegido (con signo del flip)
  const quat = useMemo(() => {
    const to = new THREE.Vector3(); to.setComponent(ai, sign);
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), to);
  }, [ai, sign]);

  const placeAt = (o: number) => {
    const g = grpRef.current; if (!g) return;
    g.position.set(bbox.center[0], bbox.center[1], bbox.center[2]);
    g.position.setComponent(ai, bbox.center[ai] + o * bbox.half[ai] * 1.02);
  };

  useFrame(() => {
    const g = grpRef.current; if (!g) return;
    if (!dragging.current) placeAt(offset);
    g.updateWorldMatrix(true, false);
    const nWorld = new THREE.Vector3().setComponent(ai, sign).transformDirection(g.matrixWorld).normalize();
    const pWorld = new THREE.Vector3().setFromMatrixPosition(g.matrixWorld);
    clip[0].setFromNormalAndCoplanarPoint(nWorld, pWorld);
  });

  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const g = grpRef.current; if (!g) return;
    dragging.current = true;
    if (controls) controls.enabled = false;
    g.updateWorldMatrix(true, false);
    const originW = new THREE.Vector3().setFromMatrixPosition(g.matrixWorld);
    const axisW = new THREE.Vector3().setComponent(ai, 1).transformDirection(g.matrixWorld).normalize();
    const camDir = camera.getWorldDirection(new THREE.Vector3());
    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, originW);
    const ray = new THREE.Raycaster();
    const rect = gl.domElement.getBoundingClientRect();
    const hitAt = (cx: number, cy: number) => {
      const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const h = new THREE.Vector3();
      return ray.ray.intersectPlane(dragPlane, h) ? h : null;
    };
    const h0 = hitAt(e.clientX, e.clientY);
    const d0 = h0 ? h0.clone().sub(originW).dot(axisW) : 0;
    const off0 = offset;
    const unit = (bbox.half[ai] * 1.02) || 1;
    const onMove = (ev: PointerEvent) => {
      const h = hitAt(ev.clientX, ev.clientY); if (!h) return;
      const d = h.clone().sub(originW).dot(axisW);
      const o = Math.max(-1.1, Math.min(1.1, off0 + (d - d0) / unit));
      liveOffset.current = o; placeAt(o);
    };
    const onUp = () => {
      dragging.current = false;
      if (controls) controls.enabled = true;
      setOffset(liveOffset.current);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const r = Math.max(0.5, span * 0.03);
  const reach = span * 1.18;
  return (
    <group ref={grpRef}>
      <group quaternion={quat}>
        {/* plano de corte translúcido (dónde corta) */}
        <mesh renderOrder={5}>
          <planeGeometry args={[span * 2.5, span * 2.5]} />
          <meshBasicMaterial color="#f2b66d" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
        </mesh>
        {/* FLECHA arrastrable (mango): shaft + cabeza, fuera de la pieza */}
        <group position={[0, 0, reach]} onPointerDown={startDrag} onPointerOver={() => (gl.domElement.style.cursor = 'grab')} onPointerOut={() => (gl.domElement.style.cursor = 'auto')}>
          <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={6}>
            <cylinderGeometry args={[r * 0.5, r * 0.5, span * 0.5, 16]} />
            <meshStandardMaterial color="#f2b66d" emissive="#7a4a16" metalness={0.3} roughness={0.4} toneMapped={false} />
          </mesh>
          <mesh position={[0, 0, span * 0.32]} rotation={[Math.PI / 2, 0, 0]} renderOrder={6}>
            <coneGeometry args={[r * 1.6, span * 0.28, 20]} />
            <meshStandardMaterial color="#ffce8a" emissive="#7a4a16" metalness={0.3} roughness={0.35} toneMapped={false} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// FEA VISUAL — la pieza se DEFORMA animada bajo la carga (la vista, no la
// ecuación). El desplazamiento real es micras (invisible), así que se AMPLIFICA
// a ~14% del tamaño de la pieza y se anima con un pulso suave 0→1→0 (la carga
// "respirando"). Coloreada por von Mises. Un fantasma en reposo (wireframe) deja
// LEER cuánto se movió. La carga puede venir en CUALQUIER dirección (runFEADir).
// ──────────────────────────────────────────────────────────────────
function FeaDeformMesh({ mesh, colors, disp, dispMax, clip }: {
  mesh: TessellatedMesh; colors: Float32Array; disp: Float32Array; dispMax: number;
  clip: THREE.Plane[] | null;
}) {
  const base = mesh.positions;
  // Auto-escala: la deformación máx se lleva a ~14% de la diagonal del bbox → SE VE.
  const scale = useMemo(() => {
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (let i = 0; i < base.length; i += 3) {
      mnx = Math.min(mnx, base[i]); mxx = Math.max(mxx, base[i]);
      mny = Math.min(mny, base[i + 1]); mxy = Math.max(mxy, base[i + 1]);
      mnz = Math.min(mnz, base[i + 2]); mxz = Math.max(mxz, base[i + 2]);
    }
    const diag = Math.hypot(mxx - mnx, mxy - mny, mxz - mnz) || 1;
    return dispMax > 1e-9 ? (0.14 * diag) / dispMax : 0;
  }, [base, dispMax]);
  // Posiciones VIVAS (copia mutable); la geometría deforma sobre ésta cada frame.
  const live = useMemo(() => new Float32Array(base), [base]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(live, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    g.computeVertexNormals();
    return g;
  }, [live, colors, mesh.indices]);
  const restGeom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(base, 3));
    g.setIndex(new THREE.BufferAttribute(mesh.indices, 1));
    return new THREE.EdgesGeometry(g, 30);
  }, [base, mesh.indices]);
  useEffect(() => () => { geom.dispose(); restGeom.dispose(); }, [geom, restGeom]);
  const tRef = useRef(0);
  useFrame((_, dt) => {
    tRef.current += dt;
    // pulso suave 0→1→0, periodo 2.6s (la carga "respira"): easeInOut por coseno.
    const a = 0.5 * (1 - Math.cos((2 * Math.PI * tRef.current) / 2.6));
    const k = scale * a;
    for (let i = 0; i < base.length; i++) live[i] = base[i] + disp[i] * k;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    posAttr.needsUpdate = true;
    geom.computeVertexNormals();
  });
  return (
    <group>
      {/* fantasma en reposo: aristas tenues → se ve de dónde partió */}
      <lineSegments geometry={restGeom}>
        <lineBasicMaterial color="#3a4658" transparent opacity={0.4} clippingPlanes={clip ?? undefined} />
      </lineSegments>
      {/* pieza deformada + coloreada por von Mises */}
      <mesh geometry={geom} castShadow>
        {/* Colores del esfuerzo REPRESENTATIVOS: toneMapped OFF → el turbo azul→rojo
            se muestra a su valor REAL (mapa de calor fiel), sin lavarlo el ACES ni
            el emissive blanco. Mate, para que el color mande, no el brillo. */}
        <meshStandardMaterial vertexColors metalness={0} roughness={0.62} side={THREE.DoubleSide}
          toneMapped={false} clippingPlanes={clip ?? undefined} />
      </mesh>
    </group>
  );
}

// ──────────────────────────────────────────────────────────────────
// Render del sólido teselado + picking de cara/arista (raycast)
// ──────────────────────────────────────────────────────────────────
function SolidMesh({
  mesh, faded, matKey, tint, faces, edgeGeoms, selFaces, selEdges, pickMode, onPickFace, onPickEdge,
  feaColors, overhangColors, clip,
}: {
  mesh: TessellatedMesh;
  faded: boolean;
  matKey: string;
  /** Color de LA PIEZA (apariencia mate). Si viene, gana sobre el look metálico del material. */
  tint?: string;
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
  const pbrBase = MATERIAL_PBR[matKey] ?? DEFAULT_PBR;
  // Con tinte: acabado MATE de color (metalness bajo) — el metálico espejo murió.
  const pbr = tint ? { ...pbrBase, color: tint, metalness: 0.12, roughness: 0.55, clearcoat: 0.18, clearcoatRoughness: 0.5 } : pbrBase;
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
      {/* CARA SELECCIONADA: tinte AZUL translúcido (convención CAD — Fusion/Onshape/
          SolidWorks tiñen de azul; la inundación amarilla opaca leía a MS Paint y
          escondía el sombreado de la cara). La geometría sigue VIVA debajo. */}
      {highlightGeo && (
        <mesh geometry={highlightGeo} renderOrder={2}>
          <meshStandardMaterial
            color={'#4C9FFF'}
            emissive={'#2F7FE0'}
            emissiveIntensity={0.55}
            metalness={0.2}
            roughness={0.5}
            transparent
            opacity={0.45}
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
          <meshBasicMaterial color={'#7FB8FF'} transparent opacity={0.85} toneMapped={false} depthTest={false} />
        </mesh>
      ))}

      {/* ARISTA(S) SELECCIONADA(S): tubo GRUESO de oro emisivo SIEMPRE encima del
          sólido (depthTest off) — visible aunque el bloom queme la cara. */}
      {edgeTubes.filter((t) => selEdges.includes(t.edgeId)).map(({ edgeId, geoSel }) => (
        <mesh key={`ets${edgeId}`} geometry={geoSel} renderOrder={5} onClick={handleEdgeClick(edgeId)}>
          <meshBasicMaterial color={'#4C9FFF'} toneMapped={false} depthTest={false} />
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

function SketchPlane({ plane }: { plane: SketchPlane3D }) {
  // Rejilla del PLANO DE BOCETO — orientada al plano ACTIVO del croquis (XY/YZ/XZ
  // + offset, o el plano de una cara), en coordenadas del kernel (vive dentro del
  // group rotado del modelo). El grid es cuadrado/simétrico → basta alinear la
  // normal; el twist u/v no se percibe.
  const q = useMemo(() => {
    const u = new THREE.Vector3(...plane.uDir), v = new THREE.Vector3(...plane.vDir);
    const n = new THREE.Vector3().crossVectors(u, v).normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  }, [plane]);
  return (
    <group position={plane.origin} quaternion={q}>
      <gridHelper
        args={[160, 32, new THREE.Color('#2a3744'), new THREE.Color('#1a232d')]}
        position={[0, -0.01, 0]}
      />
    </group>
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
/** Salta la cámara a una vista preset (iso/top/front/right/left/back/bottom) — como
 *  el ViewCube de Fusion. `view` = {name, nonce} para poder repetir la misma vista. */
type SketchCam = { pos: [number, number, number]; target: [number, number, number]; up: [number, number, number]; pxPerMm: number } | null;
function ViewController({ view, orbit, dist, target, sketchCam }: { view: { name: string; nonce: number } | null; orbit?: { az: number; el: number; r: number; nonce: number } | null; dist: number; target: [number, number, number]; sketchCam?: SketchCam }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as { target: THREE.Vector3; update: () => void; enabled: boolean } | null;
  // ── EL VIAJE (orden del user, como Fusion): la cámara NUNCA salta — VUELA a su
  // destino con easing (~0.9s). Das clic en una cara y se mueve TODO hasta que esa
  // cara queda plana frente a ti. Aterriza EXACTO (la calibración px/mm del boceto
  // depende del pose final). Durante el vuelo los controles se apagan. ──
  const sketchCamRef = useRef<SketchCam | undefined>(sketchCam);
  useEffect(() => { sketchCamRef.current = sketchCam; }, [sketchCam]);
  const tweenRef = useRef<null | { t0: number; dur: number; fp: THREE.Vector3; fu: THREE.Vector3; ft: THREE.Vector3; tp: THREE.Vector3; tu: THREE.Vector3; tt: THREE.Vector3 }>(null);
  const flyTo = (pos: [number, number, number], up: [number, number, number], tgt: [number, number, number], dur = 900) => {
    if (controls) controls.enabled = false;
    tweenRef.current = {
      t0: performance.now(), dur,
      fp: camera.position.clone(), fu: camera.up.clone(),
      ft: controls ? controls.target.clone() : new THREE.Vector3(),
      tp: new THREE.Vector3(...pos), tu: new THREE.Vector3(...up), tt: new THREE.Vector3(...tgt),
    };
  };
  useFrame(() => {
    const tw = tweenRef.current; if (!tw) return;
    const k = Math.min(1, (performance.now() - tw.t0) / tw.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;   // easeInOutQuad
    camera.position.lerpVectors(tw.fp, tw.tp, e);
    camera.up.copy(tw.fu.clone().lerp(tw.tu, e).normalize());
    const t = tw.ft.clone().lerp(tw.tt, e);
    if (controls) controls.target.copy(t);
    camera.lookAt(t);
    if (k >= 1) {
      tweenRef.current = null;
      // Controles de vuelta SOLO si no estamos en boceto (ahí la cámara está clavada).
      if (controls && !sketchCamRef.current) { controls.enabled = true; controls.update(); }
    }
  });
  // BOCETO EN ESCENA: al abrir, VIAJE hasta quedar perpendicular al plano; los
  // OrbitControls se quedan apagados mientras dura el boceto (calibración fija).
  useEffect(() => {
    if (!sketchCam) {
      // El regreso lo maneja el setView('iso') del Studio (vuela también).
      camera.up.set(0, 1, 0);
      if (controls && !tweenRef.current) { controls.enabled = true; controls.update(); }
      return;
    }
    flyTo(sketchCam.pos, sketchCam.up, sketchCam.target, 950);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketchCam, camera, controls]);
  // Las vistas con nombre y las órbitas también VIAJAN (nada salta ya).
  const place = (px: number, py: number, pz: number) => {
    const [tx, ty, tz] = target;
    flyTo([px + tx, py + ty, pz + tz], [0, 1, 0], [tx, ty, tz], 850);
  };
  // GUARDIA POR NONCE: `target` (viewTarget) es un array nuevo en CADA render →
  // sin guardia, estos efectos re-aplicaban la ÚLTIMA vista en cada render y
  // PISABAN la cámara del croquis (el bug de la vista oblicua al croquizar en
  // cara). Cada petición de vista/órbita se aplica UNA vez; el croquis manda.
  const lastViewNonce = useRef(-1);
  const lastOrbitNonce = useRef(-1);
  useEffect(() => {
    if (!view || sketchCam || view.nonce === lastViewNonce.current) return;
    lastViewNonce.current = view.nonce;
    const d = dist;
    const P: Record<string, [number, number, number]> = {
      iso: [d * 0.58, d * 0.5, d * 0.72], top: [0.001, d * 1.25, 0.001], bottom: [0.001, -d * 1.25, 0.001],
      front: [0, d * 0.15, d * 1.25], back: [0, d * 0.15, -d * 1.25],
      right: [d * 1.25, d * 0.15, 0], left: [-d * 1.25, d * 0.15, 0],
    };
    const p = P[view.name] ?? P.iso; place(p[0], p[1], p[2]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, dist, camera, controls, target, sketchCam]);
  // ÓRBITA arbitraria (az/el grados, r en unidades de mundo) — para barrer 30+ ángulos.
  useEffect(() => {
    if (!orbit || sketchCam || orbit.nonce === lastOrbitNonce.current) return;
    lastOrbitNonce.current = orbit.nonce;
    const az = (orbit.az * Math.PI) / 180, el = (orbit.el * Math.PI) / 180, r = orbit.r;
    place(r * Math.cos(el) * Math.sin(az), r * Math.sin(el), r * Math.cos(el) * Math.cos(az));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbit, camera, controls, target, sketchCam]);
  return null;
}

function CadViewport({
  cameraDistance, autoRotate, minDistance, maxDistance, enablePan = true, view, orbit, viewTarget, sketchCam, children,
}: {
  cameraDistance: number;
  autoRotate: boolean;
  minDistance?: number;
  maxDistance?: number;
  enablePan?: boolean;
  view?: { name: string; nonce: number } | null;
  orbit?: { az: number; el: number; r: number; nonce: number } | null;
  viewTarget?: [number, number, number];
  sketchCam?: SketchCam;
  children: ReactNode;
}) {
  return (
    <div
      className="relative w-full h-full"
      style={{
        // Degradado de estudio MUY sutil: un poco más claro al centro para dar
        // profundidad sin viñeta cinematográfica.
        // ESPACIO PROFUNDO (paleta nebulosa): azul de medianoche que respira hacia
        // el vacío — la profundidad hipnótica de sus renders, sin robar contraste.
        background: `radial-gradient(ellipse at 50% 38%, #16283F 0%, #0C1626 52%, #050A14 100%)`,
      }}
    >
      <Canvas
        // 'percentage' = PCFShadowMap (no el PCFSoftShadowMap deprecado por
        // three, que warneaba en CADA render y ensuciaba la telemetría 66×/sesión).
        shadows="percentage"
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
        <ViewController view={view ?? null} orbit={orbit ?? null} dist={cameraDistance} target={viewTarget ?? [0, 0, 0]} sketchCam={sketchCam} />

        {/* VIEWCUBE — orientación viva (como TODO CAD). Click en una cara salta a
            vista ortográfica; etiquetas en español. El Canvas es full-window y el
            panel de opciones (.fb-params, right:18 width:230 ≈248px) lo cubriría en
            top-right, así que lo INSETAMOS ~290px para que quede justo a su izquierda
            (como el ViewCube de Fusion, pegado al panel de propiedades). */}
        {/* El viewport ya empieza DEBAJO del ribbon (fb-viewport top:120) → el cubo
            solo esquiva el riel derecho (282px + su propio radio) y respira arriba. */}
        <GizmoHelper alignment="top-right" margin={[356, 70]}>
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

/** CAM EN EL VIVO (workspace MANUFACTURA): el toolpath deja de ser un dibujito 2D
 *  y vive SOBRE la pieza — cortes en ámbar, rápidos en agua tenue, arcos/hélices
 *  muestreados cada ~6°. Coordenadas = kernel (va DENTRO del group rotado). */
function CamToolpath3D({ segs }: { segs: ToolpathSegment[] }) {
  const { cutGeo, rapidGeo } = useMemo(() => {
    const cut: number[] = [], rapid: number[] = [];
    for (const s of segs) {
      const dest = s.kind === 'cut' ? cut : rapid;
      if (s.arc) {
        const r = Math.hypot(s.from[0] - s.arc.cx, s.from[1] - s.arc.cy);
        const a0 = Math.atan2(s.from[1] - s.arc.cy, s.from[0] - s.arc.cx);
        const sweep = arcSweep(s);
        const n = Math.max(2, Math.ceil(sweep / 0.1));
        for (let i = 0; i < n; i++) {
          for (const t of [i / n, (i + 1) / n]) {
            const a = s.arc.cw ? a0 - sweep * t : a0 + sweep * t;
            dest.push(s.arc.cx + r * Math.cos(a), s.arc.cy + r * Math.sin(a), s.from[2] + (s.to[2] - s.from[2]) * t);
          }
        }
      } else {
        dest.push(s.from[0], s.from[1], s.from[2], s.to[0], s.to[1], s.to[2]);
      }
    }
    const g = (arr: number[]) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      return geo;
    };
    return { cutGeo: g(cut), rapidGeo: g(rapid) };
  }, [segs]);
  return (
    <group renderOrder={6}>
      <lineSegments geometry={cutGeo}>
        <lineBasicMaterial color="#FFB224" transparent opacity={0.95} depthTest={false} toneMapped={false} />
      </lineSegments>
      <lineSegments geometry={rapidGeo}>
        <lineBasicMaterial color="#41C7D4" transparent opacity={0.35} depthTest={false} toneMapped={false} />
      </lineSegments>
    </group>
  );
}

/** STOCK del setup (cap 8 del libro): el bruto del que sale la pieza — bbox de la
 *  pieza + sobrematerial de careado arriba. Translúcido agua: se VE qué se remueve. */
function CamStock3D({ center, half, topAllow = 1.5 }: { center: [number, number, number]; half: [number, number, number]; topAllow?: number }) {
  const size: [number, number, number] = [half[0] * 2, half[1] * 2, half[2] * 2 + topAllow];
  const pos: [number, number, number] = [center[0], center[1], center[2] + topAllow / 2];
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)), [size[0], size[1], size[2]]);
  return (
    <group position={pos}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color="#41C7D4" transparent opacity={0.05} depthWrite={false} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color="#41C7D4" transparent opacity={0.5} />
      </lineSegments>
    </group>
  );
}

/** Piso de estudio: grid AGUA sutil + contact shadow suave para profundidad barata.
 *  Paleta nebulosa: las líneas llevan el azul-agua profundo del océano, no gris muerto. */
function CadGround({ size, drop = 0.6 }: { size: number; drop?: number }) {
  // Grid FINITO (no `infiniteGrid`): el infinito calcula las líneas por-fragmento y
  // hace aliasing/parpadeo en ángulos rasantes y VISTO A TRAVÉS de piezas translúcidas.
  // El finito fade en el borde y no shimmerea. Se baja `drop` mm para no z-fightear con
  // la base de la pieza (que se apoya en Y=0). Aplica a CUALQUIER pieza, no solo al molde.
  return (
    <group position={[0, -drop, 0]}>
      <Grid
        args={[size, size]}
        cellSize={size / 60}
        cellThickness={0.6}
        cellColor="#1b3347"
        sectionSize={size / 12}
        sectionThickness={1.0}
        sectionColor="#28536e"
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
        color="#020610"
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

// ── FORJA DS v2 · ICONOS ──────────────────────────────────────────
// Set vectorial propio (16×16, trazo 1.4, currentColor): glifos CAD LITERALES
// (la operación se dibuja a sí misma), cero emoji. La regla del rediseño:
// iconografía monocroma consistente = la mitad de verse profesional.
const ICONS: Record<string, JSX.Element> = {
  croquis: <><path d="M3.2 12.8 10.6 5.4l2 2-7.4 7.4-2.8.8z" /><path d="M11.6 4.4l1.2-1.2 2 2-1.2 1.2" /></>,
  encara: <><path d="M1.8 11.5 5.6 7h8.6l-3.8 4.5z" /><path d="M4.5 4.5 8 1.6l1.6 1.6" opacity=".55" /></>,
  agujerocara: <><path d="M1.8 11.5 5.6 7h8.6l-3.8 4.5z" /><ellipse cx="8.2" cy="9.2" rx="2" ry="1" /></>,
  extruir: <><rect x="3" y="11" width="10" height="2.6" /><path d="M8 10.6V3.4M5.6 5.6 8 3.2l2.4 2.4" /></>,
  barreno: <><circle cx="8" cy="8" r="5.4" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /></>,
  redondeo: <><path d="M2.8 13.2V8A5.2 5.2 0 0 1 8 2.8h5.2" /><path d="M2.8 2.8 6 6" opacity=".4" /></>,
  chaflan: <><path d="M2.8 13.2V7L7 2.8h6.2" /><path d="M2.8 2.8 7 7" opacity=".4" /></>,
  vaciado: <><path d="M2.8 3v10.2H13.2V3" /><path d="M5.6 3v6.6h7.6" opacity=".6" /></>,
  revolucion: <><path d="M8 1.8v12.4" /><path d="M8 4.6c3 0 5 1.5 5 3.4s-2 3.4-5 3.4" /><path d="M8 11.4c-1.6 0-3-.4-3.9-1.1" opacity=".5" /><path d="M9.6 12.6 8 11.4l1.8-1" /></>,
  transicion: <><ellipse cx="8" cy="3.4" rx="3.4" ry="1.5" /><ellipse cx="8" cy="12.4" rx="5.6" ry="2" /><path d="M4.6 4 2.4 11.2M11.4 4l2.2 7.2" opacity=".7" /></>,
  barrido: <><path d="M2.4 12.4C6 12.4 9.4 4 14 4" /><ellipse cx="2.6" cy="12.4" rx="1.6" ry="2" /></>,
  engrane: <><circle cx="8" cy="8" r="3.2" /><path d="M8 1.6v2.1M8 12.3v2.1M2.5 4.8l1.8 1M11.7 10.2l1.8 1M2.5 11.2l1.8-1M11.7 5.8l1.8-1" /></>,
  cajacic: <><rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1.4" /><circle cx="8" cy="8" r="3" /><circle cx="9.8" cy="8" r=".9" opacity=".6" /></>,
  cajera: <><rect x="2.6" y="2.6" width="10.8" height="10.8" /><rect x="6" y="6" width="4" height="4" strokeDasharray="1.6 1.4" /></>,
  patron: <><circle cx="5" cy="5" r="1.7" /><circle cx="11" cy="5" r="1.7" /><circle cx="5" cy="11" r="1.7" /><circle cx="11" cy="11" r="1.7" /></>,
  planotaller: <><rect x="2.4" y="2.4" width="11.2" height="11.2" /><rect x="4.6" y="4.6" width="3.2" height="3.2" opacity=".7" /><rect x="9.4" y="4.6" width="2.4" height="3.2" opacity=".7" /><rect x="4.6" y="9.6" width="3.2" height="2" opacity=".7" /></>,
  seccion: <><rect x="3" y="3" width="10" height="10" /><path d="M1.6 14.4 14.4 1.6" strokeDasharray="2 1.6" /></>,
  encuadrar: <><path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3" /><circle cx="8" cy="8" r="2.2" opacity=".6" /></>,
  componente: <><rect x="2.4" y="5.6" width="8" height="8" /><path d="M5.4 5.6V2.6h8v8h-3" opacity=".7" /></>,
  careado: <><path d="M2.6 3.4h10.8v3.2H2.6v3.2h10.8v3.2H2.6" /></>,
  cajera2d: <><circle cx="8" cy="8" r="5.6" /><circle cx="8" cy="8" r="2.6" opacity=".7" /></>,
  taladrado: <><path d="M5 2.4h6M8 2.4v7" /><path d="M8 13.6 5.8 9.4h4.4z" /></>,
  roscado: <><path d="M5.4 2.6v8l2.6 2.6 2.6-2.6v-8" /><path d="M5.4 5h5.2M5.4 7.4h5.2M5.4 9.8h5.2" opacity=".7" /></>,
  mandrinado: <><circle cx="8" cy="8" r="5.6" /><path d="M8 3.6A4.4 4.4 0 1 1 3.6 8" opacity=".8" /><circle cx="8" cy="8" r=".9" fill="currentColor" stroke="none" /></>,
  desbaste3d: <><path d="M2.4 13.4h3.2v-3h3.2v-3H12v-3h1.8" /><path d="M2.4 13.4V2.6" opacity=".35" /></>,
  params: <><path d="M5.2 13 8 3h2.4" /><path d="M4 6.4h5.6" /><path d="M10.4 9.4l3.2 4M13.6 9.4l-3.2 4" opacity=".8" /></>,
  laser: <><path d="M8 1.6v5" /><path d="M8 6.6 5.2 12h5.6z" opacity=".85" /><path d="M2.6 13.4h10.8" /><path d="M4.6 3.4 6.2 5M11.4 3.4 9.8 5" opacity=".5" /></>,
  impresion: <><rect x="2.6" y="2.6" width="10.8" height="10.8" rx="1" /><path d="M5 5.4h6M8 5.4v2.4" opacity=".8" /><path d="M6.4 7.8h3.2v1.6H6.4z" /><path d="M4 11.4h8" strokeDasharray="1.8 1.2" opacity=".7" /></>,
  torno: <><path d="M1.8 8.5h12.4" strokeDasharray="2.2 1.6" opacity=".6" /><path d="M3.2 8.5V4.8h3.2V3h4v2.6h2.4v2.9" /><path d="M13.4 11.6l-2-2M13.4 9.6v2h-2" opacity=".8" /></>,
  opciones: <><circle cx="8" cy="3.4" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1.1" fill="currentColor" stroke="none" /><circle cx="8" cy="12.6" r="1.1" fill="currentColor" stroke="none" /></>,
};
function Ic({ name }: { name: string }) {
  return (
    <svg className="fb-ic" width="15" height="15" viewBox="0 0 16 16" fill="none"
      stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name] ?? <circle cx="8" cy="8" r="5" />}
    </svg>
  );
}

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
  // DS v2: CAMPO NUMÉRICO real (un CAD se maneja tecleando cotas, no con sliders —
  // el slider además redondeaba al step y rechazó ⌀6.8). Scrub: arrastrar el label
  // horizontalmente ajusta el valor (gesto pro tipo Blender/Fusion), teclear manda.
  return (
    <label className="fb-dim fb-dim-num">
      <span
        className="fb-dim-label fb-scrub"
        onPointerDown={(e) => {
          const x0 = e.clientX, v0 = value;
          const move = (ev: PointerEvent) => {
            const dv = (ev.clientX - x0) * (step < 1 ? 0.1 : step);
            onChange(Math.min(max, Math.max(min, +(v0 + dv).toFixed(3))));
          };
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
          window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
        }}
        title="Arrastra para ajustar · teclea el valor exacto en el campo"
      >
        {label}
        {bindKey && bind && (
          <button className="fb-fx" data-testid={testid ? `${testid}-bind` : undefined}
            onClick={(e) => { e.preventDefault(); bind.setBinding(bindKey, String(value)); }}
            title="Ligar a una expresión de parámetros">ƒₓ</button>
        )}
      </span>
      <span className="fb-dim-field">
        <input
          type="number" min={min} max={max} step="any" value={+value.toFixed(3)}
          data-testid={testid}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
          }}
        />
        <em>{unit}</em>
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
  gear: { ...GEAR_DEFAULTS }, gearbox: { ...GEARBOX_DEFAULTS }, rosca: { ...ROSCA_DEFAULTS }, rack: { ...RACK_DEFAULTS }, din: { ...DIN_DEFAULTS },
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
    sketch: { ...DEFAULT_SKETCH, kind: 'custom', customProfile: profile, smooth: true, gear: { ...GEAR_DEFAULTS } },
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
  // El documento arranca LIMPIO (lienzo vacío) — el usuario abre y dibuja sus
  // planos; el extrude aparece al Terminar el dibujo (onSketchFinish). Antes
  // arrancaba con una caja default que confundía y afeaba el inicio.
  const [ops, setOps] = useState<Op[]>([]);
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
  // Por defecto COLAPSADOS los paneles secundarios (caras, análisis, FEA) — el
  // lienzo arranca limpio; el usuario expande lo que necesita. El árbol y el panel
  // de parámetros (el flujo principal) quedan abiertos.
  // Documento arranca COLAPSADO (el timeline de abajo es la historia primaria;
  // el panel queda para renombrar/suprimir). Más espacio para VER la pieza.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({ faces: true, analysis: true, sim: true, features: true });
  // ── VENTANAS FLOTANTES (pedido del user): cada panel arranca DOCKED en su riel
  // (zonas limpias por default) y se JALA de la cabecera para flotar donde quieras;
  // doble clic en la cabecera lo re-anida al riel. Posiciones persisten en localStorage.
  const [winPos, setWinPos] = useState<Record<string, { x: number; y: number }>>(() => {
    try { return JSON.parse(localStorage.getItem('forja-winpos') ?? '{}'); } catch { return {}; }
  });
  const winDrag = useCallback((id: string) => (e: React.PointerEvent) => {
    const t = e.target as HTMLElement;
    if (!t.closest('.fb-collapse-head') || t.closest('button')) return; // solo la cabecera arrastra
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dx = e.clientX - rect.left, dy = e.clientY - rect.top;
    const x0 = e.clientX, y0 = e.clientY;
    let dragging = false; // UMBRAL 4px: un clic limpio NO mueve la ventana → el colapso sigue funcionando
    const move = (ev: PointerEvent) => {
      if (!dragging && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 4) return;
      dragging = true;
      const x = Math.min(window.innerWidth - 90, Math.max(0, ev.clientX - dx));
      const y = Math.min(window.innerHeight - 44, Math.max(50, ev.clientY - dy));
      setWinPos((prev) => ({ ...prev, [id]: { x, y } }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
      setWinPos((prev) => { try { localStorage.setItem('forja-winpos', JSON.stringify(prev)); } catch { /* privado */ } return prev; });
    };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
  }, []);
  const winUndock = useCallback((id: string) => (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest('.fb-collapse-head')) return;
    setWinPos((prev) => {
      const next = { ...prev }; delete next[id];
      try { localStorage.setItem('forja-winpos', JSON.stringify(next)); } catch { /* privado */ }
      return next;
    });
  }, []);
  const winStyle = (id: string): React.CSSProperties | undefined =>
    winPos[id] ? { position: 'fixed', left: winPos[id].x, top: winPos[id].y, zIndex: 44, margin: 0 } : undefined;
  const toggleCollapse = useCallback((id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] })), []);
  const [optionsOpen, setOptionsOpen] = useState(false);
  // Workspace (DS v2): DISEÑO = modelado; MANUFACTURA = las ops CAM (como Fusion
  // separa Design/Manufacture — la barra de modelado ya no carga los ⛏).
  const [workspace, setWorkspace] = useState<'diseno' | 'manufactura' | 'simulacion'>('diseno');
  // Simulación del CICLO DE INYECCIÓN (molde vivo): overlay a pantalla completa.
  const [cycleSimOn, setCycleSimOn] = useState(false);
  const [tpSimOn, setTpSimOn] = useState(false);
  const [moldMachineOn, setMoldMachineOn] = useState(false);
  const [unscrewOn, setUnscrewOn] = useState(false);
  // SESIÓN VIVA compartida: el operador remoto (Claude) publica una pieza en
  // /mold-live.json; el Studio ARMA el molde con las PRIMITIVAS del kernel
  // (buildMoldAssembly) y lo pone en la escena 3D real → el cliente ve y GIRA el
  // molde de verdad, en vivo. Sin STEP: se construye dentro de La Forja.
  const liveMoldRev = useRef(-1);
  const [liveMoldSpec, setLiveMoldSpec] = useState<MoldAssemblySpec | null>(null);
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await fetch('/mold-live.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json();
        if (typeof j.rev !== 'number' || j.rev === liveMoldRev.current) return;
        liveMoldRev.current = j.rev;
        if (j.clear) { setLiveMoldSpec(null); return; }
        if (j.assemblySpec) { setLiveMoldSpec(j.assemblySpec); return; }   // ejemplo del libro directo
        if (j.spec) { try { setLiveMoldSpec(packageToAssemblySpec(moldMachine(j.spec))); } catch { setLiveMoldSpec(null); } }
      } catch { /* sin sesión viva */ }
    }, 1500);
    return () => clearInterval(id);
  }, []);
  // El MOLDE en vivo se arma como COMPONENTES (una placa = una pieza) para el
  // árbol: aislar / ocultar / opacidad, como Fusion/SolidWorks. Con primitivas.
  const [moldParts, setMoldParts] = useState<MoldPart[]>([]);
  const [moldHidden, setMoldHidden] = useState<Record<string, boolean>>({});
  const [moldOpacity, setMoldOpacity] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!oc || !liveMoldSpec) { setMoldParts([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {   // deja pintar antes del build síncrono (~3s)
      try { const parts = buildMoldParts(OCC, oc, liveMoldSpec, 'blocks'); if (!cancelled) { setMoldParts(parts); setMoldHidden({}); setMoldOpacity({}); } }
      catch { if (!cancelled) setMoldParts([]); }
    }, 60);
    return () => { cancelled = true; clearTimeout(t); };
  }, [oc, liveMoldSpec]);
  const toggleMoldPlate = useCallback((role: string) => setMoldHidden((h) => ({ ...h, [role]: !h[role] })), []);
  const showAllMold = useCallback(() => setMoldHidden({}), []);
  const isolateMoldPlate = useCallback((role: string) => {
    setMoldHidden((h) => {
      const already = !h[role] && moldParts.every((p) => p.role === role || h[p.role]);
      if (already) return {};
      const next: Record<string, boolean> = {};
      for (const p of moldParts) next[p.role] = p.role !== role;
      return next;
    });
  }, [moldParts]);
  const setMoldPlateOpacity = useCallback((role: string, v: number) => setMoldOpacity((o) => ({ ...o, [role]: v })), []);
  // (sectionOn ya se declara con la feature de SECCIÓN abajo — este duplicado del
  //  trabajo paralelo del molde rompía el build; es el mismo estado compartido.)
  // Menú "Más" de la toolbar: la cola larga de features que la TELEMETRÍA de los
  // 17 drives del libro marcó con CERO clicks (Transición/Barrido/Engrane/…) vive
  // aquí — la fila principal queda para el núcleo real (croquis→extruir→revolución).
  const [masOpen, setMasOpen] = useState(false);
  const masBtnRef = useRef<HTMLButtonElement>(null);   // para sacar el dropdown "Más" del overflow que lo recortaba
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
    mark('op', 0, { op: 'component', kind });   // ensamblaje (carro/robot): componente agregado
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
  // Operación del croquis al Terminar: 'new'=base · 'join'=saliente (une) · 'cut'=corte (resta).
  // Esto da el MULTI-FEATURE: base + boss/cut encadenados como componentes con booleana.
  const [sketchOp, setSketchOp] = useState<'new' | 'join' | 'cut'>('new');
  // Barrenos (círculos del croquis base) esperando a que exista el sólido: se
  // materializan al crear el extrude (ya SIN auto-extrude, el usuario decide cuándo).
  const pendingHolesRef = useRef<Op[]>([]);
  // MENÚ RADIAL (clic derecho en el viewport): las ops en un gesto, estilo videojuego.
  const [radial, setRadial] = useState<{ x: number; y: number } | null>(null);
  // COLOR DE LA PIEZA (paleta mate — el metálico murió por orden del user).
  const [partColor, setPartColor] = useState<string>(PART_PALETTE[0]);
  const cyclePartColor = useCallback(() => {
    setPartColor((c) => PART_PALETTE[(PART_PALETTE.indexOf(c) + 1) % PART_PALETTE.length]);
  }, []);
  // BOCETO — un solo botón y el MOUSE decide (como Fusion): al pedir boceto se
  // abre el selector (planos base) Y se arma el pick de cara a la vez; clic en
  // una cara de la pieza = boceto ahí; clic en un plano = boceto ahí.
  const [sketchChooser, setSketchChooser] = useState(false);
  // RIBBON COLAPSABLE: la pieza siempre a la vista; el estado sobrevive a la sesión.
  const [ribbonMin, setRibbonMin] = useState<boolean>(() => {
    try { return localStorage.getItem('fb-ribbon-min') === '1'; } catch { return false; }
  });
  const toggleRibbon = useCallback(() => {
    setRibbonMin((v) => { const nx = !v; try { localStorage.setItem('fb-ribbon-min', nx ? '1' : '0'); } catch { /* privado */ } return nx; });
  }, []);

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
  // Campo de DESPLAZAMIENTO por vértice (mm) → la pieza se DEFORMA animada en la
  // VISTA (el simulador visual: ves cómo se comporta, no esperas ecuaciones en la
  // nube). Cargable en cualquier dirección (los botones ↑↓←→⊙ llaman runFEADir).
  const [feaDisp, setFeaDisp] = useState<Float32Array | null>(null);
  const feaDispMaxRef = useRef(0);
  const [feaLoadDir, setFeaLoadDir] = useState<[number, number, number] | null>(null);
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
  // ── ESTUDIO VIENTO (aerodinámica supersónica sobre la pieza — Escuela AERO) ──
  // Hermano del FEA: el alumno construye la cuña y el estudio la analiza. El
  // semiángulo δ se MIDE de la pieza (bbox); presión, choque y arrastre salen de
  // la física real (src/forja/sim/viento.ts). Overlay: flechas p/τ + onda de choque.
  const [vientoOn, setVientoOn] = useState(false);
  const [vientoMach, setVientoMach] = useState(2.0);
  const [vientoAltM, setVientoAltM] = useState(0);      // altitud ISA [m]
  const [vientoNPan, setVientoNPan] = useState(6);      // paneles de integración por cara
  const [vientoShowP, setVientoShowP] = useState(true);
  const [vientoShowTau, setVientoShowTau] = useState(false);
  const [vientoShowShock, setVientoShowShock] = useState(false);
  // calidad adaptable (LATAM): auto detecta la GPU; ligero/ultra fuerzan el tier.
  const [vientoCalidad, setVientoCalidad] = useState<'auto' | 'ligero' | 'ultra'>('auto');
  const [vientoTier, setVientoTier] = useState<0 | 1 | 2>(1);
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
          // Componentes: por defecto se JUNTAN (compound), pero cada uno puede
          // combinarse por BOOLEANA con el cuerpo acumulado — la base de un MOLDE:
          //   union = fuse · subtract = cuerpo−comp · subtractFrom = comp−cuerpo (cavidad bloque−pieza).
          const parts: Shape[] = [];
          let acc: Shape | null = mainShape;
          // DRAFT (ángulo de salida): se aplica a la PIEZA terminada — después de
          // sus cortes pero ANTES del primer booleano de MOLDE (subtractFrom), o
          // el draft inclinaría las paredes del BLOQUE (+596k mm³ fantasma en el
          // molde del tut1). Si no hay molde, va al final.
          let drafted = false;
          const applyDrafts = () => {
            if (drafted) return;
            drafted = true;
            if (!acc) return;
            for (const op of builtOps) {
              if (op.type === 'draft') acc = draftFaces(oc, acc, (op as DraftOp).angleDeg);
            }
          };
          for (const c of components) {
            const cs = buildComponent(oc, c);
            const mode = c.bool ?? 'none';
            // PATRÓN CIRCULAR del componente: N instancias rotadas alrededor de Y (el eje
            // de la rueda). Cada instancia aplica la MISMA booleana → cortar 1 sector y
            // repetirlo ×6 = los 6 rayos, como el "circular pattern of a feature" de Fusion.
            const pc = Math.max(1, Math.round(c.patternCount ?? 1));
            const insts: Shape[] = [cs];
            if (pc > 1) {
              const span = c.patternSpan ?? 360;
              const step = span >= 359.999 ? span / pc : span / (pc - 1);
              for (let k = 1; k < pc; k++) {
                insts.push(transformShape(oc, cs, { translate: [0, 0, 0], rotateAngle: step * k * Math.PI / 180, rotateAxis: { origin: [0, 0, 0], dir: c.patternAxis === 'x' ? [1, 0, 0] : c.patternAxis === 'z' ? [0, 0, 1] : [0, 1, 0] } }));
              }
            }
            // MIRROR FEATURE: duplica cada instancia espejada por el plano elegido (misma booleana).
            if (c.mirror) { const cur = insts.slice(); for (const s of cur) insts.push(mirrorShape(oc, s, c.mirror)); }
            for (const inst of insts) {
              if (mode === 'none' || acc === null) parts.push(inst);
              else if (mode === 'union') acc = fuse(oc, acc, inst);
              else if (mode === 'subtract') acc = cut(oc, acc, inst);
              else if (mode === 'subtractFrom') {
                applyDrafts();  // la pieza entra al molde YA drafteada (desmoldeo)
                // CONTRACCIÓN del molde (parámetro Escala del Cavity de SolidWorks, cap 6):
                // la pieza se escala alrededor de su centroide ANTES de restarse — el molde
                // sale más grande y la pieza inyectada, al ENCOGER al enfriar (~5% en
                // termoplásticos), cae en la cota nominal.
                const cs = c.cavityScale ?? 1;
                if (Math.abs(cs - 1) > 1e-9) {
                  const com = massProperties(oc, acc, 1).centerOfMass as [number, number, number];
                  const tool = scaleShape(oc, acc, cs, com);
                  acc = cut(oc, inst, tool);
                } else {
                  acc = cut(oc, inst, acc);
                }
              }
              else if (mode === 'common') { applyDrafts(); acc = common(oc, acc, inst); }
              // Partir el molde (tras la booleana de ESTE componente): conservar solo
              // el sólido mayor (cavity plate) o menor (macho del core). Va después del
              // corte shut-off que separa los cuerpos (paso d del Tutorial 1).
              if (c.keep && mode !== 'none' && acc) acc = keepSolid(oc, acc, c.keep);
            }
          }
          // Sin molde en el doc: el draft va al final, sobre la pieza terminada.
          applyDrafts();
          const allParts = acc ? [acc, ...parts] : parts;
          if (allParts.length === 0) throw new Error('Documento vacío: agrega Extrude/Revolve o un Componente.');
          shape = allParts.length === 1 ? allParts[0] : makeCompound(oc, allParts);
        }

        // Deflection 0.25/0.5 (antes 0.08/0.3): 0.08mm ABSOLUTO sobre una pieza ⌀448
        // (volante c6t3) = ~100k tris y el rebuild bloquea el thread >30s. Con 0.25 la
        // pérdida visual es mínima y el rebuild va 4-10× más rápido en piezas grandes.
        // Deflexión ANGULAR fina (0.2 rad ≈ 11.5°): los cilindros se dibujan con ~32+
        // segmentos → siluetas REDONDAS (0.5 rad = octágonos, "el círculo tiene caras").
        // La lineal 0.25 se queda (piezas grandes no explotan en triángulos).
        const mesh = tessellate(oc, shape, 0.25, 0.2);
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
        // console.error VISIBLE para el arnés (meta.errors): sin esto, un component que
        // lanza (p.ej. revolve inválido) muere en silencio y el operador no se entera.
        console.error('REBUILD_ERR:', String((e as Error)?.message ?? e));
        setOpErr(String((e as Error)?.message ?? e));
        // Si el documento ya NO produce sólido (sin ops, sin STEP, sin componentes,
        // sin ensamble), limpia el resultado para que el viewport y la topología no
        // queden con la malla/volumen del sólido anterior. (Bug de desync: borrar el
        // último feature dejaba el sólido fantasma renderizado y el panel con datos viejos.)
        const noSolid = !importedStep && components.length === 0
          && !(assembly.enabled && sketch.kind === 'gear')
          && boundDoc.ops.length === 0;
        if (noSolid) { resultRef.current = null; setResult(null); }
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
    // IDs ÚNICOS tras cargar: opCounter vive en memoria y se reinicia con la
    // página — sin este bump, los componentes NUEVOS colisionan con los ids
    // cargados (React "same key" duplicado + updateComponent edita el
    // equivocado → el bug de los barrenos del tut1 que sumó +4.2M al "cortar").
    const bump = (id?: string) => { const m = /-(\d+)$/.exec(id ?? ''); if (m) opCounter = Math.max(opCounter, parseInt(m[1], 10)); };
    (d.ops ?? []).forEach((o) => bump(o.id));
    (d.components ?? []).forEach((c) => bump(c.id));
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
  // ── ENSAMBLE GENÉRICO: insertar una pieza guardada COMO COMPONENTE (snapshot).
  // La pieza llega al origen como compound ('none') y se posiciona con X/Y/Z/Giro
  // del panel — el primer ladrillo de los robots (mates vendrán encima de esto). ──
  const insertPieza = useCallback((name: string) => {
    const d = readLib()[name]; if (!d) return;
    const c: Component = {
      id: newId('comp'), name, kind: 'pieza',
      w: 0, d: 0, h: 0, r: 0, x: 0, y: 0, z: 0, bool: 'none',
      pieceDoc: { sketch: d.sketch as SketchFeature, ops: (d.ops ?? []) as Op[], components: (d.components ?? []) as Component[] },
    };
    setComponents((cur) => [...cur, c]);
    setActiveComp(c.id); setActiveOp(null);
    mark('op', 0, { op: 'insert-pieza' });
  }, []);
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
    // El extrude es la operación BASE del sketch y la app YA mantiene uno. Si el
    // usuario vuelve a pulsar "Extrude" (instinto de Fusion tras dibujar el perfil),
    // NO lo dupliques —eso fusionaba dos sólidos del MISMO perfil (el muddle de 66
    // caras)—; selecciona el extrude existente para editar su profundidad. (Mismo
    // guard `some(extrude)` que ya usan onCommit del croquis y los modos gear.)
    if (type === 'extrude') {
      const existingEx = ops.find((o) => o.type === 'extrude');
      if (existingEx) { setActiveOp(existingEx.id); setPickMode('none'); return; }
    }
    let op: Op;
    const ex = (ops.find((o) => o.type === 'extrude') as ExtrudeOp | undefined)?.depth ?? 12;
    switch (type) {
      // SNAPSHOT del plano/offset del croquis en el extrude (igual que hacía el
      // auto-extrude): sin esto, extruir un croquis en YZ/offset lo aplasta a XY.
      case 'extrude': op = { id: newId('extrude'), type, depth: 12, symmetric: false, plane: sketch.plane ?? 'xy', planeOffset: sketch.planeOffset ?? 0, plane3d: sketch.plane3d }; break;
      case 'hole': op = { id: newId('hole'), type, x: 0, y: 0, diameter: 8, through: true, depth: ex }; break;
      case 'fillet': op = { id: newId('fillet'), type, radius: 3, edges: [] }; break;
      case 'chamfer': op = { id: newId('chamfer'), type, dist: 2, edges: [] }; break;
      case 'shell': op = { id: newId('shell'), type, thickness: 2, faces: [] }; break;
      case 'draft': op = { id: newId('draft'), type, angleDeg: 3 }; break;
      case 'revolve': op = { id: newId('revolve'), type, angle: 360, axis: 'y' }; break;
      case 'loft': op = { id: newId('loft'), type, height: 20, topScale: 0.5 }; break;
      case 'sweep': op = { id: newId('sweep'), type, pathKind: 'arc', height: 20, radius: 20, angle: 90, turns: 3, pitch: 8 }; break;
      case 'pattern': op = { id: newId('pattern'), type, mode: 'linear', count: 3, dx: 30, dy: 0, angleSpan: 360, axis: 'z', plane: 'yz' }; break;
      case 'pocket': op = { id: newId('pocket'), type, profile: 'rect', x: 0, y: 0, w: 12, h: 8, diameter: 8, depth: ex, through: true }; break;
    }
    // CAPTURAR los barrenos pendientes ANTES del dispatch: el updater de setOps
    // corre DESPUÉS (batched) — limpiar el ref tras la llamada los perdía (bug de
    // la tuerca/biela sin barrenos: el updater leía un ref ya vacío).
    const pend = type === 'extrude' ? pendingHolesRef.current : [];
    if (type === 'extrude') pendingHolesRef.current = [];
    setOps((cur) => [...cur, op, ...pend]);
    if (type === 'extrude') {
      // plane3d es one-shot: lo consumió ESTE extrude (antes lo consumía el auto-extrude).
      setSketch((s) => (s.plane3d ? { ...s, plane3d: undefined } : s));
    }
    setActiveOp(op.id);
    // TELEMETRÍA de USO de features: qué operación agrega el usuario (extrude,
    // loft, sweep, …). Antes solo se medían FEA/generativo; ahora TODA op se
    // registra → sabemos qué se usa de verdad en producción. `forja.op` {op}.
    mark('op', 0, { op: type });
    if (type === 'fillet' || type === 'chamfer') setPickMode('edge');
    else if (type === 'shell') setPickMode('face');
    else setPickMode('none');
  }, [ops, sketch.plane, sketch.planeOffset, sketch.plane3d]);
  const removeOp = useCallback((id: string) => {
    setOps((cur) => {
      const next = cur.filter((o) => o.id !== id);
      // Si al borrar ya no queda un sólido BASE (extrude/revolve), las ops
      // dependientes (hole/fillet/chamfer/shell) quedan HUÉRFANAS → se purgan:
      // un barreno/redondeo no puede existir sin el cuerpo sobre el que opera.
      const isBase = (o: Op) => o.type === 'extrude' || o.type === 'revolve' || o.type === 'loft' || o.type === 'sweep';
      const hasBase = next.some(isBase);
      return hasBase ? next : next.filter(isBase);
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
    mark('op', 0, { op: 'hole', via: 'click' });
    placingHoleRef.current = op.id;
    setPlacingHole(true);
    setPickMode('face');
  }, [ops]);
  // Editor de croquis: al Terminar, el perfil dibujado (resuelto por el solver) pasa
  // a kind 'custom' y se garantiza un extrude que lo solidifica.
  const onSketchFinish = useCallback((result: { profile: Pt2[]; holes: { x: number; y: number; d: number }[]; polyHoles: Pt2[][]; path?: Pt2[]; circle?: { x: number; y: number; r: number } }) => {
    // MULTI-FEATURE: si la op del croquis es unir/cortar, se agrega como COMPONENTE de
    // croquis con booleana (saliente=union, corte=subtract) sobre el cuerpo base.
    if (sketchOp === 'join' || sketchOp === 'cut') {
      // PATH ABIERTO → SWEEP por path (c6t2): el croquis sin cerrar es la trayectoria.
      if (result.path && result.path.length >= 2 && result.profile.length < 3) {
        const sp: Component = {
          id: newId('comp'), name: 'Barrido', kind: 'sweeppath',
          w: 0, d: 0, h: 0, r: 0, x: 0, y: 0, z: 0,
          bool: sketchOp === 'cut' ? 'subtract' : 'union',
          path: result.path, sweepRx: 5, sweepRy: 20,
          plane: sketch.plane ?? 'xy', planeOffset: sketch.planeOffset, plane3d: sketch.plane3d,
        };
        setComponents((cur) => [...cur, sp]);
        setSketch((s) => ({ ...s, plane3d: undefined }));
        setSketchOp('new'); setActiveComp(sp.id); setActiveOp(null); setSketchOpen(false);
        return;
      }
      const c: Component = {
        id: newId('comp'), name: sketchOp === 'cut' ? 'Corte' : 'Saliente', kind: 'sketch',
        w: 0, d: 0, h: 0, r: 0, x: 0, y: 0, z: 0,
        bool: sketchOp === 'cut' ? 'subtract' : 'union',
        profile: result.profile, holes: result.polyHoles, circle: result.circle,
        // CORTE = PASANTE por default (Through-All de Fusion/SW): un corte que se
        // queda a 12mm es una trampa — bug de la ele: el círculo EXTRA heredaba 12
        // aunque al principal le pusieras 20. SALIENTE sí nace en 12.
        plane: sketch.plane ?? 'xy', planeOffset: sketch.planeOffset, plane3d: sketch.plane3d,
        depth: sketchOp === 'cut' ? 200 : 12,
      };
      // FIX (bug del yoke): los CÍRCULOS EXTRA del croquis join/cut se PERDÍAN (iban a
      // result.holes, que el Component ignora). Como en Fusion "seleccionar varios perfiles":
      // cada círculo extra → su PROPIO componente con la MISMA booleana/plano/profundidad
      // (con su círculo EXACTO → cilindro real; el polígono queda de respaldo).
      const extras: Component[] = result.holes.map((h) => {
        const r = h.d / 2, N = 40;
        const poly: Pt2[] = Array.from({ length: N }, (_, k) => ({
          x: h.x + r * Math.cos((2 * Math.PI * k) / N), y: h.y + r * Math.sin((2 * Math.PI * k) / N) }));
        return { ...c, id: newId('comp'), profile: poly, holes: [], circle: { x: h.x, y: h.y, r } };
      });
      setComponents((cur) => [...cur, c, ...extras]);
      // plane3d es ONE-SHOT: aplica al croquis que lo pidió (sketchOnPlane3d / croquis-en-cara)
      // y se limpia — si no, los croquis siguientes en XY/XZ heredan el plano inclinado
      // (plane3d MANDA sobre plane) y sus cortes se van a coordenadas fuera de la pieza.
      setSketch((s) => ({ ...s, plane3d: undefined }));
      setSketchOp('new'); setActiveComp(c.id); setActiveOp(null); setSketchOpen(false);
      return;
    }
    setSketch((s) => ({ ...s, kind: 'custom', customProfile: result.profile, customHoles: result.polyHoles, customCircle: result.circle, smooth: false }));
    // SIN AUTO-EXTRUDE (orden del user 2026-07-03): terminar el croquis GUARDA el
    // perfil (se ve el fantasma sobre el plano) y extruir es DECISIÓN del diseñador
    // (btn-extrude), como en todo CAD serio. Los círculos del croquis quedan
    // PENDIENTES y se materializan como barrenos cuando nazca el sólido base —
    // crearlos antes rompería el orden de ops (hole sin cuerpo).
    const circleHoles: Op[] = result.holes.map((h) => (
      { id: newId('hole'), type: 'hole', x: h.x, y: h.y, diameter: h.d, through: true, depth: 12 } as Op));
    setOps((cur) => {
      if (cur.some((o) => o.type === 'extrude')) return [...cur, ...circleHoles];
      pendingHolesRef.current = circleHoles;
      return cur;
    });
    setActiveOp(null);
    setSketchOpen(false);
  }, [sketchOp, sketch.plane, sketch.planeOffset, sketch.plane3d]);

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
    mark('op', 0, { op: 'gear' });
    setPickMode('none');
  }, []);
  // ── CAJA cicloidal multi-disco (btn-gearbox) ──
  const applyGearbox = useCallback(() => {
    setSketch((s) => ({ ...s, kind: 'gearbox' }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
    setMaterial('pla');   // la caja es de PLÁSTICO → masa con densidad de PLA, no aluminio
    setActiveOp('sketch'); setActiveComp(null); setPickMode('none');
    mark('op', 0, { op: 'gearbox' });
  }, []);
  const updateGearbox = useCallback((patch: Partial<GearboxParams>) => {
    setSketch((s) => ({ ...s, gearbox: { ...s.gearbox, ...patch } }));
  }, []);
  // ── ROSCA modelada (btn-rosca): tornillo con cuerda helicoidal real ──
  const applyRosca = useCallback(() => {
    setSketch((s) => ({ ...s, kind: 'rosca', rosca: s.rosca ?? { ...ROSCA_DEFAULTS } }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
    setActiveOp('sketch'); setActiveComp(null); setPickMode('none');
    mark('op', 0, { op: 'rosca' });
  }, []);
  const updateRosca = useCallback((patch: Partial<RoscaParams>) => {
    setSketch((s) => ({ ...s, rosca: { ...s.rosca, ...patch } }));
  }, []);

  // ── CREMALLERA (btn-rack): la involuta límite — U10-L6 ──
  const applyRack = useCallback(() => {
    setSketch((s) => ({ ...s, kind: 'rack', rack: s.rack ?? { ...RACK_DEFAULTS } }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
    setActiveOp('sketch'); setActiveComp(null); setPickMode('none');
    mark('op', 0, { op: 'rack' });
  }, []);
  const updateRack = useCallback((patch: Partial<RackParams>) => {
    setSketch((s) => ({ ...s, rack: { ...(s.rack ?? RACK_DEFAULTS), ...patch } }));
  }, []);

  // ── TORNILLO DIN 933 (btn-din): del catálogo de 942 SKUs — U6-L3 ──
  const applyDin = useCallback(() => {
    setSketch((s) => ({ ...s, kind: 'din', din: s.din ?? { ...DIN_DEFAULTS } }));
    setOps((cur) => (cur.some((o) => o.type === 'extrude')
      ? cur
      : [{ id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false }, ...cur]));
    setActiveOp('sketch'); setActiveComp(null); setPickMode('none');
    mark('op', 0, { op: 'din' });
  }, []);
  const updateDin = useCallback((patch: Partial<DinParams>) => {
    setSketch((s) => ({ ...s, din: { ...(s.din ?? DIN_DEFAULTS), ...patch } }));
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

        // Colorea la malla de RENDER (la teselada que se ve) por von Mises Y
        // muestrea el desplazamiento por vértice → la pieza se DEFORMA animada.
        const renderPos = resultRef.current?.mesh.positions;
        if (renderPos) {
          const { colors } = vonMisesVertexColors(res, renderPos);
          setFeaColors(colors);
          const { disp, maxMag } = feaVertexDisplacements(res, renderPos);
          setFeaDisp(disp); feaDispMaxRef.current = maxMag;
        }
        setFeaLoadDir(dirUnit);
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
    if (renderPos) {
      const { colors } = vonMisesVertexColors(res, renderPos); setFeaColors(colors);
      const { disp, maxMag } = feaVertexDisplacements(res, renderPos); setFeaDisp(disp); feaDispMaxRef.current = maxMag;
    }
    setFeaResult(res);
    setFeaLiveMs(ms);
    mark('fea_live', ms, { kind: sketch.kind, loadN: N });
  }, [runFeaAnalysis, sketch.kind]);

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
        // MAPA DE REGIONES (mecanismo): en un DISCO (rueda / disco cicloidal)
        // congelamos el BORDE (contacto/lóbulos) y el CUBO central (pared del
        // barreno/eje) como SÓLIDO; el generativo solo aligera el ALMA → sale un
        // disco con rayos orgánicos, con las superficies funcionales INTACTAS.
        // (Fusion no congela regiones para mecanismos print-in-place.)
        const Rout = sketch.kind === 'circle' ? Math.max(1, sketch.radius) : 0;
        const passive: TopOptParams['passive'] = Rout > 0
          ? (cx, cy) => {
            const r = Math.hypot(cx, cy);
            if (r > 0.80 * Rout) return 'solid';   // borde (rim / lóbulos)
            if (r < 0.40 * Rout) return 'solid';   // cubo (pared del barreno/eje)
            return 'design';                        // alma → aligerar
          }
          : undefined;
        const tGen = performance.now();
        const res = runTopOpt(oc, shape, bc, FEA_MATERIAL_KEY[material] ?? 'aluminio_6061',
          // ft:2 (densidad) + tamaño mínimo de miembro auto (sin "navajas") +
          // selfSupport: filtro de voladizo → la pieza se imprime SIN soportes
          // (auto-soporte a 45°, la precisión de la impresora a nuestro favor) +
          // passive: mapa de regiones (congela borde/cubo del disco).
          { volfrac: genVolfrac, penal: 3, ft: 2, maxLoops: 50, tolChange: 0.02, resolution: 12, selfSupport: true, maxOverhangDeg: 45, passive });
        mark('generative', performance.now() - tGen, { cells: res.nCells, loops: res.history.length, volfrac: genVolfrac, kind: sketch.kind, regions: !!passive });
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
    mark('export', 0, { fmt: 'stl', src: genResult ? 'generativo' : 'part' });
  }, [genResult, genThreshold, result]);
  // ── IMPRIMIBILIDAD (DFM): ¿cabe?, voladizos, holgura/compensación recomendadas ──
  const [printProfileKey, setPrintProfileKey] = useState<keyof typeof PRINT_PROFILES>('media');
  const [printMaterial, setPrintMaterial] = useState<PrintProfile['material']>('PLA');
  const [showOverhangs, setShowOverhangs] = useState(false);
  const [gbTorque, setGbTorque] = useState(50);   // par de salida objetivo (N·m) para el análisis de caja
  // ── MOVIMIENTO de la caja: piezas separadas + animación cinemática ──
  const [gbMotion, setGbMotion] = useState(false);
  const [gbSpeed, setGbSpeed] = useState(1.4);     // rad/s del eje de entrada
  // VISTAS de cámara (ViewCube): salta a iso/top/front/right/... (nonce permite repetir)
  const [viewReq, setViewReq] = useState<{ name: string; nonce: number } | null>(null);
  const setView = useCallback((name: string) => setViewReq((v) => ({ name, nonce: (v?.nonce ?? 0) + 1 })), []);
  // Al SALIR del croquis (Terminar o Cancelar) la cámara salta a ISO: dejas el
  // plano y VES tu pieza en 3D. También evita el roll arbitrario que dejaba la
  // vista cenital al restaurar up=(0,1,0) (lookAt con up casi paralelo).
  const wasSketchingRef = useRef(false);
  useEffect(() => {
    if (wasSketchingRef.current && !sketchOpen) setView('iso');
    wasSketchingRef.current = sketchOpen;
  }, [sketchOpen, setView]);
  const [orbitReq, setOrbitReq] = useState<{ az: number; el: number; r: number; nonce: number } | null>(null);
  const orbitTo = useCallback((az: number, el: number, r: number) => setOrbitReq((v) => ({ az, el, r, nonce: (v?.nonce ?? 0) + 1 })), []);
  const [gbParts, setGbParts] = useState<GearboxMotionData | null>(null);
  // Construye las piezas separadas (centradas) cuando se enciende el movimiento o
  // cambian los parámetros de la caja. Teselación una vez; la animación solo mueve grupos.
  const gbSig = sketch.kind === 'gearbox' ? JSON.stringify(sketch.gearbox) : '';
  useEffect(() => {
    if (!oc || !gbMotion || sketch.kind !== 'gearbox') { setGbParts(null); return; }
    let cancelled = false;
    try {
      const data = buildGearboxMotionData(oc, sketch.gearbox);
      if (!cancelled) setGbParts(data);
    } catch (e) {
      console.warn('[forja] movimiento caja:', e);
      if (!cancelled) setGbParts(null);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oc, gbMotion, sketch.kind, gbSig]);
  // ── CUERPOS de la caja: separados, con color, OCULTABLES (como Fusion) ──
  // Por defecto la HEMBRA arranca OCULTA → ves el mecanismo de colores adentro al
  // instante (la hembra translúcida "lechosa" lavaba los colores; mejor mostrarla
  // con un clic). 👁 "mostrar todos" la trae de vuelta.
  const [gbHidden, setGbHidden] = useState<Record<string, boolean>>({ hembra: true });
  // VISTA EXPLOSIONADA (U5-L3): cada cuerpo se desplaza por el eje del stack.
  const [gbExplode, setGbExplode] = useState(false);
  const [gbColors, setGbColors] = useState<Record<string, string>>({});
  const [gbBodyGeos, setGbBodyGeos] = useState<{ key: string; name: string; geo: PartGeo }[] | null>(null);
  useEffect(() => {
    if (!oc || sketch.kind !== 'gearbox') { setGbBodyGeos(null); return; }
    let cancelled = false;
    try {
      const bodies = buildGearboxBodies(oc, sketch.gearbox);
      const geos = bodies.map((b) => ({ key: b.key, name: b.name, geo: tessGeo(oc, b.shape) }));
      bodies.forEach((b) => b.shape.delete?.());
      if (!cancelled) setGbBodyGeos(geos);
    } catch (e) {
      console.warn('[forja] cuerpos caja:', e);
      if (!cancelled) setGbBodyGeos(null);
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oc, sketch.kind, gbSig]);
  const gbColor = useCallback((key: string) => gbColors[key] ?? gbDefaultColor(key), [gbColors]);
  const toggleGbBody = useCallback((key: string) => setGbHidden((h) => ({ ...h, [key]: !h[key] })), []);
  // cambiar color SIEMPRE hace visible el cuerpo (si no, el cambio no se ve — bug que vio el workflow)
  const setGbColor = useCallback((key: string, color: string) => {
    setGbColors((c) => ({ ...c, [key]: color }));
    setGbHidden((h) => (h[key] ? { ...h, [key]: false } : h));
  }, []);
  const showAllGbBodies = useCallback(() => setGbHidden({}), []);
  // AISLAR (como Fusion): muestra SOLO este cuerpo, oculta el resto. Re-aislar el
  // mismo (o "mostrar todos") restaura. Resuelve que la hembra opaca tape todo.
  const isolateGbBody = useCallback((key: string) => {
    setGbHidden((h) => {
      const bodies = gbBodyGeos ?? [];
      const isolated = !h[key] && bodies.every((b) => b.key === key || h[b.key]);
      if (isolated) return {};   // ya aislado → re-clic = mostrar todos
      const next: Record<string, boolean> = {};
      bodies.forEach((b) => { next[b.key] = b.key !== key; });
      return next;
    });
  }, [gbBodyGeos]);
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
    // fuente: la pieza del doc, o (si el doc está vacío) el MOLDE en vivo (unión de placas)
    const buffers: ArrayLike<number>[] = result ? [result.mesh.positions] : moldParts.map((p) => p.positions);
    if (!buffers.length) return null;
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
    for (const p of buffers) for (let i = 0; i < p.length; i += 3) {
      mnx = Math.min(mnx, p[i]); mxx = Math.max(mxx, p[i]);
      mny = Math.min(mny, p[i + 1]); mxy = Math.max(mxy, p[i + 1]);
      mnz = Math.min(mnz, p[i + 2]); mxz = Math.max(mxz, p[i + 2]);
    }
    if (!Number.isFinite(mnx)) return null;
    return { center: [(mnx + mxx) / 2, (mny + mxy) / 2, (mnz + mxz) / 2], half: [(mxx - mnx) / 2 || 1, (mxy - mny) / 2 || 1, (mxz - mnz) / 2 || 1] };
  }, [result, moldParts]);

  // ── ESTUDIO VIENTO: mide el semiángulo δ de la pieza y corre la física real ──
  // δ = atan( (menor span / 2) / (mayor span) ): para la cuña dibujada (cuerda ≫
  // espesor) esto da su semiángulo. La cuerda del ANÁLISIS es el mayor span en mm
  // → m. Todo emerge del kernel + viento.ts (choque θ-β-M, ISA, integral ec. 1.8).
  const vientoResult = useMemo<VientoSuperResultado | null>(() => {
    if (!vientoOn || !meshBBox) return null;
    const spans = meshBBox.half.map((h) => h * 2);
    const cuerdaMM = Math.max(...spans);
    const espesorMM = Math.min(...spans);
    const delta = Math.atan((espesorMM / 2) / cuerdaMM);
    if (!(delta > 0.001) || !(delta < Math.PI / 4)) return null;
    return estudioVientoSupersonico({
      delta, cuerdaM: cuerdaMM / 1000, mach: vientoMach, hM: vientoAltM, nPaneles: Math.max(2, Math.round(vientoNPan)),
    });
  }, [vientoOn, meshBBox, vientoMach, vientoAltM, vientoNPan]);

  // Cp POR VÉRTICE del sólido real → se pinta por el MISMO canal que von Mises
  // (nada de quads sobrepuestos: daban z-fight y franjas). Cada vértice se clasifica
  // en el marco de la cuña: cara inclinada = Cp de compresión; base/talón = p∞.
  // Es "la presión sobre TU pieza", exactamente como el FEA pinta el esfuerzo.
  const vientoColors = useMemo<Float32Array | null>(() => {
    if (!vientoOn || !vientoShowP || !vientoResult || !result || !meshBBox) return null;
    const pos = result.mesh.positions;
    const spans = meshBBox.half.map((h) => h * 2);
    let ci = 0, ti = 0;
    for (let k = 1; k < 3; k++) { if (spans[k] > spans[ci]) ci = k; if (spans[k] < spans[ti]) ti = k; }
    if (ti === ci) ti = (ci + 1) % 3;
    const chord = spans[ci];
    const tanD = Math.tan((vientoResult.deltaDeg * Math.PI) / 180);
    const apexC = meshBBox.center[ci] - meshBBox.half[ci];
    const cpFace = (vientoResult.p2 - vientoResult.pInf) / vientoResult.q; // compresión
    const cWarm = cpColor(cpFace, new THREE.Color(), cpFace);
    const cBase = cpColor(0, new THREE.Color(), cpFace);
    const out = new Float32Array(pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      const s = pos[i + ci] - apexC;                          // distancia desde el filo
      const n = Math.abs(pos[i + ti] - meshBBox.center[ti]);  // |espesor| desde el eje
      const onFace = s > chord * 0.02 && n > 0.65 * s * tanD; // sigue la pendiente
      const c = onFace ? cWarm : cBase;
      out[i] = c.r; out[i + 1] = c.g; out[i + 2] = c.b;
    }
    return out;
  }, [vientoOn, vientoShowP, vientoResult, result, meshBBox]);

  // Plano de recorte ESTABLE (objeto único): la flecha del SectionGizmo lo MUTA en
  // mundo cada frame (no recalculamos por estado → arrastre fluido sin re-render).
  // Plano de recorte SIEMPRE presente (constante +1e6 = lejísimos, no corta nada)
  // para que el material compile CON clipping desde el inicio (si pasa de 0→1 plano
  // three a veces no recompila y "no corta" — el bug que el workflow detectó). La
  // flecha lo MUTA al plano real cuando la sección está activa; al apagar, se aleja.
  const sectionClip = useMemo(() => [new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6)], []);
  // Computa el plano de corte EN MUNDO desde el estado (eje/offset/flip), no solo
  // desde la flecha — así el corte también funciona en MODO MOVIMIENTO (donde el
  // gizmo no se renderiza). Modelo→mundo: (x,y,z)→(x,z,−y) por la rotación −90°X.
  useEffect(() => {
    if (!sectionOn || !meshBBox) { sectionClip[0].set(new THREE.Vector3(0, 1, 0), 1e6); return; }
    const ai = sectionAxis === 'x' ? 0 : sectionAxis === 'y' ? 1 : 2;
    const sign = sectionFlip ? -1 : 1;
    const nM = [0, 0, 0]; nM[ai] = sign;
    const pM = [meshBBox.center[0], meshBBox.center[1], meshBBox.center[2]];
    pM[ai] = meshBBox.center[ai] + sectionOffset * meshBBox.half[ai] * 1.02;
    const nW = new THREE.Vector3(nM[0], nM[2], -nM[1]).normalize();
    const pW = new THREE.Vector3(pM[0], pM[2], -pM[1]);
    sectionClip[0].setFromNormalAndCoplanarPoint(nW, pW);
  }, [sectionOn, sectionAxis, sectionOffset, sectionFlip, meshBBox, sectionClip]);
  const sectionPlanes = sectionClip;   // siempre el array (lejos cuando off)
  // ── MOTOR DE PLANOS: del sólido actual → plano de taller 2D (SVG) ──
  const [planoSvg, setPlanoSvg] = useState<string | null>(null);
  // ── CAM · CAREADO (libro Cimo cap 9): stock = bbox del sólido; zigzag + G-code ──
  const [camSvg, setCamSvg] = useState<string | null>(null);
  const camGcodeRef = useRef('');
  const [camToolD, setCamToolD] = useState(40);      // ⌀ fresa (libro: R390 ⌀40)
  const [camStepover, setCamStepover] = useState(27); // ~2/3·⌀ (libro: 26.67)
  const [camDepth, setCamDepth] = useState(1.5);      // material a remover (libro: 1.5)
  const genCam = useCallback(() => {
    const m = resultRef.current?.mesh; if (!m) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, zT = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      const X = m.positions[i], Y = m.positions[i + 1], Z = m.positions[i + 2];
      if (X < x0) x0 = X; if (X > x1) x1 = X;
      if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      if (Z > zT) zT = Z;
    }
    const stock = { x0, y0, x1, y1, zTop: zT };
    const tool = { diameter: camToolD, rpm: 7850, feed: 7070, plunge: 800 };
    const segs = generateFacingToolpath(stock, tool, { stepover: camStepover, passExtension: 5, depth: camDepth, safeZ: 10 });
    camOpRef.current = 'careado';
    setCamTitle('Careado — trayectoria zigzag');
    setCamView3D(segs); setWorkspace('manufactura');
    setCamStats(`stock ${(x1 - x0).toFixed(1)}×${(y1 - y0).toFixed(1)}mm · fresa ⌀${camToolD} · paso ${camStepover} · corte ${st.cutLen.toFixed(0)}mm · ~${st.timeMin.toFixed(2)} min`);
    camGcodeRef.current = toGcode(segs, tool);
    const st = toolpathStats(segs, tool);
    // SVG en PLANTA: stock + zigzag (corte ámbar, rápidos cian punteado)
    const pad = camToolD + 12, W = (x1 - x0) + 2 * pad, H = (y1 - y0) + 2 * pad;
    const sx = (v: number) => (v - x0 + pad), sy = (v: number) => (y1 - v + pad);
    const lines = segs.map((s) =>
      `<line x1="${sx(s.from[0]).toFixed(1)}" y1="${sy(s.from[1]).toFixed(1)}" x2="${sx(s.to[0]).toFixed(1)}" y2="${sy(s.to[1]).toFixed(1)}" stroke="${s.kind === 'cut' ? '#FDB813' : '#38bdf8'}" stroke-width="${s.kind === 'cut' ? 1.6 : 0.9}" ${s.kind !== 'cut' ? 'stroke-dasharray="4 3"' : ''}/>`).join('');
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<rect x="${pad}" y="${pad}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}" fill="#eef2f7" stroke="#111" stroke-width="1.2"/>` +
      lines +
      `</svg>`);
  }, [camToolD, camStepover, camDepth]);
  const downloadCamGcode = useCallback(() => {
    const blob = new Blob([camGcodeRef.current], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `${camOpRef.current}-laforja.nc`; a.click();
    URL.revokeObjectURL(a.href);
  }, []);
  // ── CAM · RANURA CIRCULAR (libro Cimo cap 9, shoulder milling / 2D Adaptive):
  // como el libro: clic en la CARA del fondo de la ranura → anillos climb + G2.
  const camOpRef = useRef<'careado' | 'ranura' | 'taladrado' | 'roscado' | 'bore' | 'desbaste3d'>('careado');
  const [camTitle, setCamTitle] = useState('Careado — trayectoria zigzag');
  const [camStats, setCamStats] = useState('');  // stats en la BARRA del modal (dentro del SVG se desbordaban)
  const [camView3D, setCamView3D] = useState<ToolpathSegment[] | null>(null);  // toolpath EN el viewport (workspace MANUFACTURA)
  const [camLoad, setCamLoad] = useState(13.33);        // carga radial óptima (libro: ⌀/3)
  const camPocketFaceRef = useRef<number | null>(null); // última cara elegida (para Regenerar)
  const genCamPocket = useCallback((faceId: number) => {
    const m = resultRef.current?.mesh; if (!m) return;
    // bbox de la CARA clicada (fondo de la ranura) + tope Z del sólido
    let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity, fz = -Infinity, zT = -Infinity;
    let nzSum = 0;
    for (let t = 0; t < m.faceIds.length; t++) {
      const mine = m.faceIds[t] === faceId;
      for (let k = 0; k < 3; k++) {
        const vi = m.indices[t * 3 + k];
        const X = m.positions[vi * 3], Y = m.positions[vi * 3 + 1], Z = m.positions[vi * 3 + 2];
        if (Z > zT) zT = Z;
        if (!mine) continue;
        if (X < mnx) mnx = X; if (X > mxx) mxx = X;
        if (Y < mny) mny = Y; if (Y > mxy) mxy = Y;
        if (Z > fz) fz = Z;
        nzSum += m.normals[vi * 3 + 2];
      }
    }
    if (!isFinite(mnx)) return;
    if (Math.abs(nzSum) < 1) { setOpErr('CAM ranura: clic en una cara HORIZONTAL (el fondo de la ranura).'); return; }
    const R = Math.max(mxx - mnx, mxy - mny) / 2;
    const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
    const depth = zT - fz;
    if (depth < 1e-3) { setOpErr('CAM ranura: esa cara no es un fondo (profundidad 0).'); return; }
    const tool = { diameter: camToolD, rpm: 7878, feed: 7090, plunge: 800 }; // números del libro
    const segs = generateCircularPocketToolpath({ cx, cy, radius: R, zTop: zT, zBottom: fz }, tool, { optimalLoad: camLoad, safeZ: 10, helicalPitch: 2 });
    if (!segs.length) { setOpErr(`CAM ranura: la fresa ⌀${camToolD} no cabe en la ranura ⌀${(2 * R).toFixed(1)}.`); return; }
    camOpRef.current = 'ranura'; camPocketFaceRef.current = faceId;
    camGcodeRef.current = toGcode(segs, tool, 'RANURA CIRCULAR');
    const st = toolpathStats(segs, tool);
    // SVG en planta: ranura (pared negra) + anillos ámbar (arcos) + rápidos cian
    const pad = camToolD + 12, W = 2 * R + 2 * pad, H = 2 * R + 2 * pad;
    const sx = (v: number) => (v - cx + R + pad), sy = (v: number) => (cy + R - v + pad);
    const parts = segs.map((s) => {
      const col = s.kind === 'cut' ? '#FDB813' : '#38bdf8';
      const wdt = s.kind === 'cut' ? 1.6 : 0.9, dash = s.kind !== 'cut' ? 'stroke-dasharray="4 3"' : '';
      if (s.arc) {
        const r = Math.hypot(s.from[0] - s.arc.cx, s.from[1] - s.arc.cy);
        const large = arcSweep(s) > Math.PI ? 1 : 0;
        // modelo CW visto desde +Z + eje y volteado del SVG → sweep-flag 0
        return `<path d="M ${sx(s.from[0]).toFixed(1)} ${sy(s.from[1]).toFixed(1)} A ${r.toFixed(1)} ${r.toFixed(1)} 0 ${large} ${s.arc.cw ? 0 : 1} ${sx(s.to[0]).toFixed(1)} ${sy(s.to[1]).toFixed(1)}" fill="none" stroke="${col}" stroke-width="${wdt}" ${dash}/>`;
      }
      return `<line x1="${sx(s.from[0]).toFixed(1)}" y1="${sy(s.from[1]).toFixed(1)}" x2="${sx(s.to[0]).toFixed(1)}" y2="${sy(s.to[1]).toFixed(1)}" stroke="${col}" stroke-width="${wdt}" ${dash}/>`;
    }).join('');
    setCamTitle('Ranura circular (2D Adaptive) — anillos CLIMB · G2');
    setCamStats(`ranura ⌀${(2 * R).toFixed(1)}×${depth.toFixed(1)}mm · fresa ⌀${camToolD} · a_e ${camLoad} · S7878 F7090 · corte ${st.cutLen.toFixed(0)}mm · ~${st.timeMin.toFixed(2)} min`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<circle cx="${sx(cx).toFixed(1)}" cy="${sy(cy).toFixed(1)}" r="${R.toFixed(1)}" fill="#eef2f7" stroke="#111" stroke-width="1.2"/>` +
      parts +
      `</svg>`);
    setCamView3D(segs); setWorkspace('manufactura');
    mark('cam-ranura', 0, { d: 2 * R, depth });
  }, [camToolD, camLoad]);
  // ── CAM · TALADRADO (libro Cimo cap 9/5): clic en la PARED de un barreno →
  // "Select Same Diameter" en la malla → ciclo peck (G83 expandido) por barreno.
  const genCamDrill = useCallback((targetD: number) => {
    const m = resultRef.current?.mesh; if (!m) return;
    const holes = detectHolesFromMesh(m, targetD);
    if (!holes.length) { setOpErr(`CAM taladrado: no encontré barrenos ⌀≈${targetD.toFixed(1)} verticales.`); return; }
    // preset "Aluminum - Drilling": vc≈100 m/min → n=vc·1000/(π·⌀); f=0.15 mm/rev
    const rpm = Math.round(100000 / (Math.PI * targetD));
    const tool = { diameter: targetD, rpm, feed: Math.round(rpm * 0.15), plunge: Math.round(rpm * 0.15) };
    const segs = generateDrillingToolpath(holes, tool, { peckDepth: 3 * targetD, safeZ: 10, rPlane: 3, reentryGap: 0.5 });
    camOpRef.current = 'taladrado';
    camGcodeRef.current = toGcode(segs, tool, `TALADRADO ${holes.length}x D${targetD.toFixed(1)}`);
    const st = toolpathStats(segs, tool);
    // SVG en planta: stock + barrenos numerados en orden de ruta + traslados punteados
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      const X = m.positions[i] as number, Y = m.positions[i + 1] as number;
      if (X < x0) x0 = X; if (X > x1) x1 = X;
      if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    const pad = 20, W = (x1 - x0) + 2 * pad, H = (y1 - y0) + 2 * pad;
    const sx = (v: number) => (v - x0 + pad), sy = (v: number) => (y1 - v + pad);
    // el orden de ruta REAL vive en los segs (vecino-más-cercano): saco la secuencia XY única
    const route: Array<[number, number]> = [];
    for (const s of segs) {
      const k: [number, number] = [s.to[0], s.to[1]];
      if (!route.length || Math.hypot(k[0] - route[route.length - 1][0], k[1] - route[route.length - 1][1]) > 1e-6) route.push(k);
    }
    const holesSvg = route.map((q, i) =>
      `<circle cx="${sx(q[0]).toFixed(1)}" cy="${sy(q[1]).toFixed(1)}" r="${(targetD / 2).toFixed(2)}" fill="none" stroke="#FDB813" stroke-width="1.4"/>` +
      `<text x="${(sx(q[0]) + targetD / 2 + 1.5).toFixed(1)}" y="${(sy(q[1]) + 2).toFixed(1)}" font-size="6" font-family="monospace" fill="#111">${i + 1}</text>`).join('');
    const travel = route.map((q, i) => `${i ? 'L' : 'M'} ${sx(q[0]).toFixed(1)} ${sy(q[1]).toFixed(1)}`).join(' ');
    setCamTitle(`Taladrado ×${holes.length} — ciclo peck (G83 expandido)`);
    setCamStats(`${holes.length} barrenos ⌀${targetD.toFixed(1)} (pilotos M8) · S${rpm} · f 0.15 mm/rev · peck ${(3 * targetD).toFixed(1)} · ~${st.timeMin.toFixed(2)} min`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<rect x="${pad}" y="${pad}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}" fill="#eef2f7" stroke="#111" stroke-width="1.2"/>` +
      `<path d="${travel}" fill="none" stroke="#38bdf8" stroke-width="0.8" stroke-dasharray="4 3"/>` +
      holesSvg +
      `</svg>`);
    setCamView3D(segs); setWorkspace('manufactura');
    mark('cam-taladrado', 0, { n: holes.length, d: targetD });
  }, []);
  // ── CAM · ROSCADO (libro Cimo cap 9): drilling con Cycle Type=Tapping → G84 modal.
  // Rosca los primeros 20mm de los pilotos (M8×1.25 sobre ⌀6.8). Símbolo de plano:
  // doble círculo (rosca) como en los dibujos de taller.
  const genCamTap = useCallback((pilotD: number, pitch = 1.25) => {
    const m = resultRef.current?.mesh; if (!m) return;
    const holes = detectHolesFromMesh(m, pilotD);
    if (!holes.length) { setOpErr(`CAM roscado: no encontré pilotos ⌀≈${pilotD.toFixed(1)}.`); return; }
    const tap = { pilotD, pitch, rpm: 500 };
    const params = { threadLen: 20, rPlane: 3, safeZ: 10 };
    camOpRef.current = 'roscado';
    camGcodeRef.current = generateTappingGcode(holes, tap, params);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      const X = m.positions[i] as number, Y = m.positions[i + 1] as number;
      if (X < x0) x0 = X; if (X > x1) x1 = X;
      if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
    }
    const pad = 20, W = (x1 - x0) + 2 * pad, H = (y1 - y0) + 2 * pad;
    const sx = (v: number) => (v - x0 + pad), sy = (v: number) => (y1 - v + pad);
    const majorR = (pilotD + pitch) / 2;
    const holesSvg = holes.map((h) =>
      `<circle cx="${sx(h.x).toFixed(1)}" cy="${sy(h.y).toFixed(1)}" r="${(pilotD / 2).toFixed(2)}" fill="none" stroke="#111" stroke-width="0.9"/>` +
      `<circle cx="${sx(h.x).toFixed(1)}" cy="${sy(h.y).toFixed(1)}" r="${majorR.toFixed(2)}" fill="none" stroke="#FDB813" stroke-width="1.2" stroke-dasharray="5 2.2"/>`).join('');
    setCamTitle(`Roscado ${threadName(tap)} ×${holes.length} — ciclo G84 (rígido)`);
    setCamStats(`${holes.length} roscas ${threadName(tap)} · prof 20mm · S500 · F=paso×S=${Math.round(pitch * 500)} · G84 modal`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<rect x="${pad}" y="${pad}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}" fill="#eef2f7" stroke="#111" stroke-width="1.2"/>` +
      holesSvg +
      `</svg>`);
    setCamView3D(null);
    mark('cam-roscado', 0, { n: holes.length, thread: threadName(tap) });
  }, []);
  // ── CAM · BORE (libro Cimo cap 10): el hueco grande (⌀32, piloto M36) no se puede
  // taladrar — se FRESA en hélice pegada a la pared + vuelta completa a fondo plano.
  const genCamBore = useCallback((targetD: number) => {
    const m = resultRef.current?.mesh; if (!m) return;
    const holes = detectHolesFromMesh(m, targetD);
    if (!holes.length) { setOpErr(`CAM bore: no encontré un hueco ⌀≈${targetD.toFixed(1)} vertical.`); return; }
    const h = holes[0];
    const toolD = camToolD < targetD - 1 ? camToolD : 16; // la fresa DEBE caber en el hueco
    const rpm = Math.round(100000 / (Math.PI * toolD));
    const tool = { diameter: toolD, rpm, feed: Math.round(0.15 * 4 * rpm), plunge: 400 };
    const pitch = 2; // bajada por vuelta (mm/rev)
    const segs = generateBoreToolpath(
      { cx: h.x, cy: h.y, radius: targetD / 2, zTop: h.zTop, zBottom: h.zBottom },
      tool, { pitch, safeZ: 10 });
    if (!segs.length) { setOpErr(`CAM bore: la fresa ⌀${toolD} no cabe en ⌀${targetD.toFixed(1)}.`); return; }
    camOpRef.current = 'bore';
    camGcodeRef.current = toGcode(segs, tool, `BORE D${targetD.toFixed(1)} HELICOIDAL`);
    const st = toolpathStats(segs, tool);
    const depth = h.zTop - h.zBottom, vueltas = Math.ceil(depth / pitch);
    const R = targetD / 2, rH = R - toolD / 2;
    const pad = toolD + 12, W = 2 * R + 2 * pad, H2 = 2 * R + 2 * pad;
    const sx = (v: number) => (v - h.x + R + pad), sy = (v: number) => (h.y + R - v + pad);
    setCamTitle(`Bore ⌀${targetD.toFixed(1)} — hélice ${pitch}mm/rev · G2 helicoidal`);
    setCamStats(`bore ⌀${targetD.toFixed(1)}×${depth.toFixed(1)}mm · fresa ⌀${toolD} · hélice r${rH.toFixed(1)} ${vueltas} vueltas · S${rpm} · corte ${st.cutLen.toFixed(0)}mm`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H2.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<circle cx="${sx(h.x).toFixed(1)}" cy="${sy(h.y).toFixed(1)}" r="${R.toFixed(1)}" fill="#eef2f7" stroke="#111" stroke-width="1.2"/>` +
      `<circle cx="${sx(h.x).toFixed(1)}" cy="${sy(h.y).toFixed(1)}" r="${rH.toFixed(1)}" fill="none" stroke="#FDB813" stroke-width="1.6"/>` +
      `<line x1="${sx(h.x + rH).toFixed(1)}" y1="${sy(h.y).toFixed(1)}" x2="${sx(h.x + rH).toFixed(1)}" y2="${(sy(h.y) - 6).toFixed(1)}" stroke="#38bdf8" stroke-width="0.9" stroke-dasharray="3 2"/>` +
      `</svg>`);
    setCamView3D(segs); setWorkspace('manufactura');
    mark('cam-bore', 0, { d: targetD, depth });
  }, [camToolD]);
  // ── CAM · ADAPTIVE CLEARING 3D (libro Cimo cap 10): desbaste por niveles Z sobre
  // la superficie REAL (heightmap de la malla + dilatación por fresa → cero gouge).
  const genCamAdaptive3D = useCallback(() => {
    const m = resultRef.current?.mesh; if (!m) return;
    const toolD = 10; // desbaste 3D con fresa chica (el libro cambia de herramienta aquí)
    const rpm = Math.round(100000 / (Math.PI * toolD));
    const tool = { diameter: toolD, rpm, feed: Math.round(0.1 * 4 * rpm), plunge: 500 };
    const params = { stepdown: 5, stepover: 4, stockToLeave: 0.5, safeZ: 10, grid: 1.5 };
    const segs = generateAdaptive3DToolpath({ positions: m.positions, indices: m.indices }, tool, params);
    if (!segs.length) { setOpErr('CAM 3D: no hay material que desbastar (pieza plana al tope del stock).'); return; }
    camOpRef.current = 'desbaste3d';
    camGcodeRef.current = toGcode(segs, tool, 'ADAPTIVE 3D');
    const st = toolpathStats(segs, tool);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, zT = -Infinity, zB = Infinity;
    for (let i = 0; i < m.positions.length; i += 3) {
      const X = m.positions[i] as number, Y = m.positions[i + 1] as number, Z = m.positions[i + 2] as number;
      if (X < x0) x0 = X; if (X > x1) x1 = X;
      if (Y < y0) y0 = Y; if (Y > y1) y1 = Y;
      if (Z > zT) zT = Z; if (Z < zB) zB = Z;
    }
    const cuts = segs.filter(s => s.kind === 'cut');
    const levels = [...new Set(cuts.map(s => s.from[2]))].sort((a, b) => b - a);
    const pad = 20, W = (x1 - x0) + 2 * pad, H2 = (y1 - y0) + 2 * pad;
    const sx = (v: number) => (v - x0 + pad), sy = (v: number) => (y1 - v + pad);
    const lines = cuts.map((s) => {
      const li = levels.indexOf(s.from[2]);
      const op = (1 - 0.65 * (li / Math.max(1, levels.length - 1))).toFixed(2); // nivel más hondo = más tenue
      return `<line x1="${sx(s.from[0]).toFixed(1)}" y1="${sy(s.from[1]).toFixed(1)}" x2="${sx(s.to[0]).toFixed(1)}" y2="${sy(s.to[1]).toFixed(1)}" stroke="#FDB813" stroke-width="1.1" opacity="${op}"/>`;
    }).join('');
    setCamTitle(`Adaptive 3D — ${levels.length} niveles · sin gouge (heightmap)`);
    setCamStats(`${levels.length} niveles (a_p ${params.stepdown}) · fresa ⌀${toolD} · a_e ${params.stepover} · stock ${params.stockToLeave} · corte ${st.cutLen.toFixed(0)}mm · ~${st.timeMin.toFixed(1)} min`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H2.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<rect x="${pad}" y="${pad}" width="${(x1 - x0).toFixed(1)}" height="${(y1 - y0).toFixed(1)}" fill="#eef2f7" stroke="#111" stroke-width="1.2"/>` +
      lines +
      `</svg>`);
    setCamView3D(segs); setWorkspace('manufactura');
    mark('cam-adaptive3d', 0, { levels: levels.length });
  }, []);
  // ── CAM · TORNEADO (libro Cimo caps 2/4/5): careado CoroPlus + desbaste de perfil
  // (G71 expandido, cero gouge) + acabado siguiendo el contorno + tronzado. El perfil
  // r(z) se extrae de la MALLA (radio máx por rebanada) y el eje se DETECTA por esbeltez.
  const genCamTurning = useCallback(() => {
    const m = resultRef.current?.mesh; if (!m) return;
    const axis = detectAxis(m);
    const profile = profileFromMesh(m, axis, 100);
    const rMax = Math.max(...profile.map((q) => q.r));
    if (rMax < 0.5) { setOpErr('CAM torno: no encuentro un sólido de revolución.'); return; }
    const zF = profile[0].z, zB = profile[profile.length - 1].z;
    const stock = { radius: rMax + 1.5, zFront: zF, zBack: zB };
    const tool = { noseR: 0.8, feedRough: 0.491, feedFinish: 0.265, vcRough: 356, vcFinish: 415, maxRpm: 4000 };
    const zEnd = zB - Math.min(6, (zB - zF) * 0.12); // el tramo del chuck no se tornea
    const moves: LatheMove[] = [
      ...turnFacing(stock, tool, { roughPasses: 2, roughAp: 1.02, finishAp: 0.96, clear: 2 }),
      ...turnProfileRough(profile, stock, tool, { ap: 2, stockToLeave: 0.5, clear: 2, zStart: zF, zEnd }),
      ...turnProfileFinish(profile, stock, tool, { clear: 2, zStart: zF, zEnd }),
      ...turnPartOff(stock, tool, { z: zEnd, clear: 2 }),
    ];
    camOpRef.current = 'torneado';
    camGcodeRef.current = toLatheGcode(moves, tool, 'PIEZA DE REVOLUCION', tool.vcRough);
    // 3D: el plano del torno (x=radio) vive en el semiplano θ=0 alrededor del eje detectado
    const to3D = (x: number, z: number): [number, number, number] =>
      axis === 'x' ? [z, x, 0] : axis === 'y' ? [x, z, 0] : [x, 0, z];
    setCamView3D(moves.map((mv) => ({
      kind: mv.kind === 'cut' ? 'cut' as const : 'rapid' as const,
      from: to3D(mv.from[0], mv.from[1]), to: to3D(mv.to[0], mv.to[1]),
    })));
    setWorkspace('manufactura');
    // SVG: vista XZ del torno — perfil de la pieza + pasadas ámbar / rápidos agua
    const st = { cut: 0 };
    for (const mv of moves) if (mv.kind === 'cut') st.cut += Math.hypot(mv.to[0] - mv.from[0], mv.to[1] - mv.from[1]);
    const pad = 14, W = (zB - zF) + 2 * pad + 8, H = stock.radius + 2 * pad;
    const sx = (z: number) => (z - zF + pad), sy = (x: number) => (stock.radius - x + pad);
    const profPath = profile.map((q, i) => `${i ? 'L' : 'M'} ${sx(q.z).toFixed(1)} ${sy(q.r).toFixed(1)}`).join(' ');
    const mvs = moves.map((mv) =>
      `<line x1="${sx(mv.from[1]).toFixed(1)}" y1="${sy(mv.from[0]).toFixed(1)}" x2="${sx(mv.to[1]).toFixed(1)}" y2="${sy(mv.to[0]).toFixed(1)}" stroke="${mv.kind === 'cut' ? '#FDB813' : '#38bdf8'}" stroke-width="${mv.kind === 'cut' ? 1.1 : 0.7}" ${mv.kind !== 'cut' ? 'stroke-dasharray="3 2.4"' : ''}/>`).join('');
    setCamTitle(`Torneado — careado + desbaste + acabado + tronzado (eje ${axis.toUpperCase()})`);
    setCamStats(`barra ⌀${(2 * stock.radius).toFixed(1)}×${(zB - zF).toFixed(0)}mm · G96 vc356/415 · f 0.491/0.265 mm/rev · corte ${st.cut.toFixed(0)}mm`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<line x1="0" y1="${sy(0).toFixed(1)}" x2="${W}" y2="${sy(0).toFixed(1)}" stroke="#889" stroke-width="0.5" stroke-dasharray="6 3"/>` +
      `<rect x="${sx(zF).toFixed(1)}" y="${sy(stock.radius).toFixed(1)}" width="${(zB - zF).toFixed(1)}" height="${stock.radius.toFixed(1)}" fill="#dfe4ea" stroke="#99a"/>` +
      `<path d="${profPath}" fill="none" stroke="#111" stroke-width="1.4"/>` + mvs +
      `</svg>`);
    mark('cam-torneado', 0, { axis, d: 2 * rMax });
  }, []);
  // ── CAM · LÁSER (Cimo caps 11-13): la PRIMERA capa del slicer da los contornos
  // reales de la pieza plana (exterior + huecos) → nesting en hoja 1000×500 →
  // G-code con kerf 0.4, interiores primero, pierce con pausa.
  const genCamLaser = useCallback((count = 6) => {
    const m = resultRef.current?.mesh; if (!m) return;
    const zs = sliceMesh({ positions: m.positions, indices: m.indices }, 1)[0];
    if (!zs || !zs.loops.length) { setOpErr('CAM láser: no pude rebanar la pieza (¿es plana?).'); return; }
    const area = (lp: { x: number; y: number }[]) => {
      let a2 = 0;
      for (let i = 0; i < lp.length; i++) { const q = lp[i], r = lp[(i + 1) % lp.length]; a2 += q.x * r.y - r.x * q.y; }
      return Math.abs(a2 / 2);
    };
    const sorted = [...zs.loops].sort((l1, l2) => area(l2) - area(l1));
    const part = { outline: sorted[0], holes: sorted.slice(1) };
    const tool = { kerf: 0.4, feed: 3800, cutPower: 80, piercePower: 100, pierceMs: 300 };
    const sheet = { w: 1000, h: 500 };
    const places = nestParts(part, sheet, count, 8);
    camOpRef.current = 'laser';
    camGcodeRef.current = laserGcode(part, places, tool, `NESTING ${places.length}X`);
    setCamView3D(null); setWorkspace('manufactura');
    // SVG: la HOJA con el nesting + contornos
    const sc = 0.6, W = sheet.w * sc + 20, H = sheet.h * sc + 20;
    const loopPath = (lp: { x: number; y: number }[], dx: number, dy: number) =>
      lp.map((q, i) => `${i ? 'L' : 'M'} ${((q.x + dx) * sc + 10).toFixed(1)} ${((sheet.h - q.y - dy) * sc + 10).toFixed(1)}`).join(' ') + ' Z';
    const partsSvg = places.map((pl) =>
      `<path d="${loopPath(part.outline, pl.dx, pl.dy)}" fill="#cfd6df" stroke="#FDB813" stroke-width="1.1"/>` +
      (part.holes ?? []).map((hh) => `<path d="${loopPath(hh, pl.dx, pl.dy)}" fill="#E9ECF0" stroke="#FDB813" stroke-width="0.9"/>`).join('')).join('');
    setCamTitle(`Láser — nesting ${places.length}× en hoja 1000×500 (kerf 0.4)`);
    setCamStats(`fibra 4kW acero 3mm · feed 3800 mm/min · pierce 0.3s · interiores ANTES del exterior · ${places.length}/${count} piezas caben`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      `<rect x="10" y="10" width="${(sheet.w * sc).toFixed(0)}" height="${(sheet.h * sc).toFixed(0)}" fill="#dde3ea" stroke="#111" stroke-width="1.2"/>` +
      partsSvg + `</svg>`);
    mark('cam-laser', 0, { n: places.length });
  }, []);
  // ── CAM · IMPRESIÓN FDM (Cimo caps 14-17): slicer propio sobre la malla real →
  // perímetros + infill ±45° (30%, libro cap 17) + G-code Marlin PLA 210/60.
  const genCamPrint = useCallback(() => {
    const m = resultRef.current?.mesh; if (!m) return;
    const params = { layerH: 0.2, lineW: 0.4, infillPct: 30, nozzleTemp: 210, bedTemp: 60, feedPrint: 3600, feedFirst: 1200, filamentD: 1.75 };
    const { gcode, layers } = slicePart({ positions: m.positions, indices: m.indices }, params);
    if (!layers.length) { setOpErr('CAM impresión: no pude rebanar la pieza.'); return; }
    camOpRef.current = 'impresion';
    camGcodeRef.current = gcode;
    // 3D: contornos e infill de capas MUESTREADAS (cada ~6) sobre la pieza
    const segs: ToolpathSegment[] = [];
    const step = Math.max(1, Math.floor(layers.length / 9));
    for (let li = 0; li < layers.length; li += step) {
      const ly = layers[li];
      for (const lp of ly.loops)
        for (let i = 0; i < lp.length; i++) {
          const q = lp[i], r = lp[(i + 1) % lp.length];
          segs.push({ kind: 'cut', from: [q.x, q.y, ly.z], to: [r.x, r.y, ly.z] });
        }
      for (const [sA, sB] of ly.infill)
        segs.push({ kind: 'rapid', from: [sA.x, sA.y, ly.z], to: [sB.x, sB.y, ly.z] });
    }
    setCamView3D(segs); setWorkspace('manufactura');
    const eTotal = (gcode.match(/E total ([\d.]+)/) ?? ['', '?'])[1];
    // SVG: una capa media (contornos + infill)
    const mid = layers[Math.floor(layers.length / 2)];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const lp of mid.loops) for (const q of lp) {
      if (q.x < x0) x0 = q.x; if (q.x > x1) x1 = q.x;
      if (q.y < y0) y0 = q.y; if (q.y > y1) y1 = q.y;
    }
    const pad = 12, W = (x1 - x0) + 2 * pad, H = (y1 - y0) + 2 * pad;
    const sx = (v: number) => (v - x0 + pad), sy = (v: number) => (y1 - v + pad);
    const loopsSvg = mid.loops.map((lp) =>
      `<path d="${lp.map((q, i) => `${i ? 'L' : 'M'} ${sx(q.x).toFixed(1)} ${sy(q.y).toFixed(1)}`).join(' ')} Z" fill="none" stroke="#111" stroke-width="1.2"/>`).join('');
    const infillSvg = mid.infill.map(([sA, sB]) =>
      `<line x1="${sx(sA.x).toFixed(1)}" y1="${sy(sA.y).toFixed(1)}" x2="${sx(sB.x).toFixed(1)}" y2="${sy(sB.y).toFixed(1)}" stroke="#FDB813" stroke-width="0.7"/>`).join('');
    setCamTitle(`Impresión FDM — ${layers.length} capas · slicer propio`);
    setCamStats(`PLA 210/60 · capa 0.2 · infill 30% ±45° · 1ª capa lenta · filamento ${eTotal}mm · Marlin`);
    setCamSvg(
      `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="background:#E9ECF0;max-width:100%;max-height:70vh">` +
      infillSvg + loopsSvg + `</svg>`);
    mark('cam-impresion', 0, { layers: layers.length });
  }, []);
  // Proyección del plano (U4-L5): 3er ángulo (ANSI, default) o 1er (ISO europeo).
  // genPlano se usa como onClick directo → el 1er arg puede ser un MouseEvent: guard.
  const planoProjRef = useRef<'first' | 'third'>('third');
  const planoGdtRef = useRef(false);
  const planoDetRef = useRef(false);
  const genPlano = useCallback((proj?: unknown, gdt?: boolean, det?: boolean) => {
    if (!result) return;
    const p: 'first' | 'third' = proj === 'first' || proj === 'third' ? proj : 'third';
    planoProjRef.current = p;
    if (gdt !== undefined) planoGdtRef.current = gdt;
    if (det !== undefined) planoDetRef.current = det;
    const draw = generateDrawing(
      {
        positions: result.mesh.positions, indices: result.mesh.indices,
        edges: result.edgeGeoms.map((g) => ({ polyline: g.polyline, kind: g.kind })),
      },
      // tolNote/raNote: TODO plano serio lleva tolerancia general (ISO 2768-m) y
      // acabado general (ISO 1302). gdtDemo (U8-L6..L8): datums A/B + marcos Y14.5.
      { name: 'Pieza La Forja', material: MATERIALS[material].label, massG: result.mass.mass, units: 'mm', tolNote: '±0.1 · ISO 2768-m', raNote: 'Ra 3.2', projection: p, gdtDemo: planoGdtRef.current, detailView: planoDetRef.current },
    );
    setPlanoSvg(draw.svg);
    mark('plano', 0, { kind: sketch.kind });
  }, [result, material, sketch.kind]);
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
    setFeaDisp(null); setFeaLoadDir(null);
    feaSessionRef.current = null;
  }, []);

  // Si cambia la geometría del documento, el FEA previo deja de ser válido:
  // limpiamos overlay + resultado (las BC por índice de cara también caducan).
  useEffect(() => {
    setFeaColors(null);
    setFeaResult(null);
    setFeaDisp(null); setFeaLoadDir(null);
    setFeaFixedFace(null);
    setFeaLoadFace(null);
    setCamView3D(null);   // el toolpath 3D caduca con la geometría
    feaSessionRef.current = null; // la geometría cambió → la sesión cacheada caduca
    setGenResult(null);
  }, [opCount, sketch.kind]);

  // Selección (toggle) de cara/arista para la op activa. SIEMPRE fija el
  // selectedFaceId/selectedEdgeId (para el HUD + resalte), y además, si hay una
  // op que consume caras/aristas (Shell / Fillet / Chamfer), togglea su lista.
  const sketchFacePendingRef = useRef(false);   // croquis-sobre-cara: el próximo pick abre croquis en esa cara
  const holeFacePendingRef = useRef(false);     // AGUJERO-EN-CARA: el próximo pick taladra ahí
  const camPocketPendingRef = useRef(false);    // CAM ranura: el próximo pick es el FONDO de la ranura
  const camDrillPendingRef = useRef(false);     // CAM taladrado: el próximo pick es la PARED de un barreno
  const togglePickFace = useCallback((i: number, p?: THREE.Vector3) => {
    setSelectedFaceId(i);
    // CAM RANURA (libro Cimo cap 9): clic en el fondo de la ranura → toolpath de anillos
    if (camPocketPendingRef.current) {
      camPocketPendingRef.current = false;
      setPickMode('none');
      genCamPocket(i);
      return;
    }
    // CAM TALADRADO (libro cap 9/5): clic en la pared de UN barreno → mismo-⌀ descubre el resto
    if (camDrillPendingRef.current) {
      camDrillPendingRef.current = false;
      setPickMode('none');
      const m = resultRef.current?.mesh;
      if (m) {
        let mnx = Infinity, mny = Infinity, mxx = -Infinity, mxy = -Infinity;
        for (let t = 0; t < m.faceIds.length; t++) {
          if (m.faceIds[t] !== i) continue;
          for (let k = 0; k < 3; k++) {
            const vi = m.indices[t * 3 + k];
            const X = m.positions[vi * 3], Y = m.positions[vi * 3 + 1];
            if (X < mnx) mnx = X; if (X > mxx) mxx = X;
            if (Y < mny) mny = Y; if (Y > mxy) mxy = Y;
          }
        }
        const dia = Math.max(mxx - mnx, mxy - mny);
        if (isFinite(dia) && dia > 0.1) genCamDrill(dia);
        else setOpErr('CAM taladrado: clic en la PARED cilíndrica de un barreno.');
      }
      return;
    }
    // AGUJERO-EN-CARA (Hole tool): clic en la cara → Component cilindro subtract con eje
    // ⊥ a la cara en el PUNTO del clic. Panel: ⌀ (r) y profundidad (h; 200 = pasante).
    if (holeFacePendingRef.current && p) {
      holeFacePendingRef.current = false;
      setPickMode('none');
      const m = resultRef.current?.mesh;
      const pl = m ? planeFromMeshFace(m, i) : null;
      if (pl) {
        // punto del clic en coords kernel (el grupo va rotado −90° en X: kernel = (x, −z, y))
        const kp: [number, number, number] = [p.x, -p.z, p.y];
        const c: Component = {
          id: newId('comp'), name: 'Agujero', kind: 'cyl',
          w: 0, d: 0, h: 200, r: 6, x: kp[0], y: kp[1], z: kp[2],
          bool: 'subtract', plane3d: { origin: kp, uDir: pl.uDir, vDir: pl.vDir },
        };
        setComponents((cur) => [...cur, c]);
        setActiveComp(c.id);
      }
      return;
    }
    // CROQUIS-SOBRE-CARA: si se pidió "croquis en cara", deriva el plano de la cara
    // clicada (normal+centroide) y abre el editor de croquis SOBRE ella (no random).
    if (sketchFacePendingRef.current) {
      sketchFacePendingRef.current = false;
      setPickMode('none');
      const m = resultRef.current?.mesh;
      const pl = m ? planeFromMeshFace(m, i) : null;
      if (pl) { setSketch((s) => ({ ...s, plane3d: pl })); setSketchOpen(true); }
      return;
    }
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
  }, [ops, activeOp, updateOp, genCamPocket, genCamDrill]);
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

  // Arranca AGUJERO-EN-CARA: el próximo clic en una cara crea el barreno ⊥ ahí.
  const startHoleOnFace = useCallback(() => {
    holeFacePendingRef.current = true;
    setActiveOp(null);
    setPickMode('face');
  }, []);

  // Arranca CAM-RANURA: el próximo clic en una cara (fondo de la ranura) genera
  // el toolpath de anillos climb (libro Cimo cap 9: "click on the cylindrical face").
  const startCamPocket = useCallback(() => {
    camPocketPendingRef.current = true;
    setActiveOp(null);
    setPickMode('face');
  }, []);

  // Arranca CAM-TALADRADO: clic en la pared de un barreno → Select Same Diameter.
  const startCamDrill = useCallback(() => {
    camDrillPendingRef.current = true;
    setActiveOp(null);
    setPickMode('face');
  }, []);

  // Arranca BOCETO-SOBRE-CARA: activa el pick de cara; el próximo clic en una cara abre
  // el editor de boceto SOBRE ella (plane3d). Regla del libro: clic en la cara exacta.
  const startSketchOnFace = useCallback(() => {
    sketchFacePendingRef.current = true;
    setActiveOp(null);
    setPickMode('face');
  }, []);
  // ── BOCETO CON EL MOUSE (como Fusion): UN botón; al abrirse el selector se arma
  // TAMBIÉN el pick de cara — clic en cara = boceto en la cara; clic en tarjeta de
  // plano = boceto en ese plano. El botón "En cara" separado murió. ──
  const openSketchChooser = useCallback(() => {
    setSketchChooser(true);
    sketchFacePendingRef.current = true;
    setActiveOp(null);
    setPickMode('face');
  }, []);
  const cancelSketchChooser = useCallback(() => {
    setSketchChooser(false);
    sketchFacePendingRef.current = false;
    setPickMode('none');
  }, []);
  const pickChooserPlane = useCallback((pl: 'xy' | 'yz' | 'xz') => {
    setSketch((c) => ({ ...c, plane: pl, plane3d: undefined }));
    setSketchChooser(false);
    sketchFacePendingRef.current = false;
    setPickMode('none');
    setSketchOpen(true);
  }, []);
  // El selector se esfuma cuando el boceto abre (p.ej. clic en una cara) o con Esc.
  useEffect(() => { if (sketchOpen && sketchChooser) setSketchChooser(false); }, [sketchOpen, sketchChooser]);
  useEffect(() => {
    if (!sketchChooser) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelSketchChooser(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sketchChooser, cancelSketchChooser]);

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
      setSectionOffset: (o: number) => setSectionOffset(o),
      get sectionOn() { return sectionOn; },
      get sectionPlaneCount() { return sectionOn ? 1 : 0; },
      // Plano de corte EN MUNDO (lo muta la flecha cada frame) — QA verifica que mover
      // el corte cambia el plano (normal según eje, constante según posición).
      get sectionPlane() { const p = sectionClip[0]; return { normal: [+p.normal.x.toFixed(3), +p.normal.y.toFixed(3), +p.normal.z.toFixed(3)], constant: +p.constant.toFixed(3) }; },
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
      // CUERPOS de la caja (separados, color, ocultar) — driver de QA
      get gbBodies() { return gbBodyGeos ? gbBodyGeos.map((b) => ({ key: b.key, name: b.name, hidden: !!gbHidden[b.key], color: gbColor(b.key), verts: b.geo.positions.length / 3 })) : null; },
      get gbVisibleCount() { return gbBodyGeos ? gbBodyGeos.filter((b) => !gbHidden[b.key]).length : 0; },
      toggleGbBody: (key: string) => toggleGbBody(key),
      isolateGbBody: (key: string) => isolateGbBody(key),
      setGbColor: (key: string, color: string) => setGbColor(key, color),
      showAllGbBodies: () => showAllGbBodies(),
      // VISTAS de cámara (ViewCube) — driver de QA / explorar ángulos
      setView: (name: string) => setView(name),
      orbitTo: (az: number, el: number, r: number) => orbitTo(az, el, r),
      // MOVIMIENTO — driver + cinemática de QA
      setGbMotion: (v: boolean) => setGbMotion(v),
      get gbMotion() { return gbMotion; },
      get gbMotionInfo() {
        if (!gbParts) return { ready: false };
        const vc = (g: PartGeo) => g.positions.length / 3;
        return {
          ready: true, discCount: gbParts.discs.length, lobes: gbParts.lobes, E: gbParts.E,
          verts: { housing: vc(gbParts.housing), rotor: vc(gbParts.rotor), disc: vc(gbParts.discs[0]?.geo ?? gbParts.rotor), output: vc(gbParts.output) },
        };
      },
      // Pose CINEMÁTICA pura en θ (grados de entrada): salida = −θ/lóbulos; el centro
      // de cada disco orbita radio E a (αᵢ+θ) y el disco GIRA −(θ+αᵢ)/lóbulos (giro
      // de salida + RELOJ fijo −αᵢ/lóbulos). Playwright asierta el ratio + el reloj.
      gbPoseAt: (thetaDeg: number) => {
        const g = sketch.gearbox; const th = (thetaDeg * Math.PI) / 180;
        return {
          outputDeg: -thetaDeg / g.lobes,
          discs: discPhases(g.discs).map((d) => {
            const ph = (d * Math.PI) / 180;
            return {
              x: +(g.E * Math.cos(ph + th)).toFixed(4), y: +(g.E * Math.sin(ph + th)).toFixed(4),
              rotDeg: +(-(thetaDeg + d) / g.lobes).toFixed(4), clockDeg: +(-d / g.lobes).toFixed(4),
            };
          }),
        };
      },
      // CHEQUEO de COLISIÓN (puro, sin kernel): para cada disco, a su pose (reloj +
      // órbita), la holgura mínima lóbulo↔rodillo = min_k(dist(rodillo_k, perfil) − Rr).
      // ≥ ~0 = engrana sin penetrar. clocked=false reproduce el bug (penetra fuerte).
      gbMeshClearance: (thetaDeg: number, clocked = true) => {
        const g = sketch.gearbox;
        // perfil con la holgura de impresión (Rr+gap) y se compara contra el rodillo REAL (Rr)
        const prof = cycloidalDisc({ lobes: g.lobes, R: g.R, Rr: g.Rr + g.gap, E: g.E, segments: Math.max(90, g.lobes * 9) }).profile;
        const th = (thetaDeg * Math.PI) / 180;
        const rollers = pinPositions(g.R, g.lobes + 1);
        const d2seg = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
          const dx = bx - ax, dy = by - ay; const L2 = dx * dx + dy * dy || 1;
          let t = ((px - ax) * dx + (py - ay) * dy) / L2; t = Math.max(0, Math.min(1, t));
          const qx = ax + t * dx, qy = ay + t * dy; return Math.hypot(px - qx, py - qy);
        };
        let worst = Infinity;
        for (const dphi of discPhases(g.discs)) {
          const a = (dphi * Math.PI) / 180;
          const clock = clocked ? -(th + a) / g.lobes : -th / g.lobes;
          const cc = Math.cos(clock), ss = Math.sin(clock);
          const ox = g.E * Math.cos(a + th), oy = g.E * Math.sin(a + th);
          const pts = prof.map((p) => ({ x: p.x * cc - p.y * ss + ox, y: p.x * ss + p.y * cc + oy }));
          for (const r of rollers) {
            let md = Infinity;
            for (let j = 0; j < pts.length; j++) {
              const A = pts[j], B = pts[(j + 1) % pts.length];
              md = Math.min(md, d2seg(r.x, r.y, A.x, A.y, B.x, B.y));
            }
            worst = Math.min(worst, md - g.Rr);
          }
        }
        return { worstClearance: +worst.toFixed(4) };
      },
      // Geometría del MECANISMO (derivada, sin kernel): prueba que el eje conecta
      // con los discos vía leva excéntrica con holgura, y que los barrenos de salida
      // holgan el bamboleo. Playwright asierta: camOffset==E (es excéntrica),
      // discBoreR−camR==gap (ajuste deslizante), outHoleD−outPinD==2E+2gap (órbita).
      get gearboxGeom() {
        const g = sketch.gearbox;
        const camR = g.shaftD / 2 + g.E;
        const lip = Math.max(1.2, g.gap * 2);
        return {
          camRadius: +camR.toFixed(4), camOffset: g.E,
          discBoreRadius: +(camR + g.gap).toFixed(4), clearance: g.gap,
          outHoleD: +(g.outPinD + 2 * g.E + 2 * g.gap).toFixed(4), outPinD: g.outPinD,
          phases: discPhases(g.discs),
          // RETENEDOR de leva: collar (camR+lip) vs barreno angosto (camR+gap).
          // overlap = lip−gap > 0 ⇒ el disco NO puede salir axialmente de su leva.
          camCollarR: +(camR + lip).toFixed(4), discBoreNarrowR: +(camR + g.gap).toFixed(4),
          retainerOverlap: +(lip - g.gap).toFixed(4),
        };
      },
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
      startHoleOnFace,   // Hole tool: armar y luego CLIC REAL en la cara (como el humano)
      startCamPocket,    // CAM ranura: armar y luego CLIC REAL en el fondo de la ranura
      startCamDrill,     // CAM taladrado: armar y luego CLIC REAL en la pared de un barreno
      camDrillAuto: (d: number) => genCamDrill(d),  // arnés: Select Same Diameter directo
      camTapAuto: (d: number, pitch?: number) => genCamTap(d, pitch),  // roscado G84 sobre los pilotos ⌀d
      camBoreAuto: (d: number) => genCamBore(d),  // bore helicoidal del hueco grande ⌀d
      camAdaptive3D: () => genCamAdaptive3D(),    // desbaste 3D por niveles (toda la pieza)
      camTurnAuto: () => genCamTurning(),         // torno completo (careado+desbaste+acabado+tronzado)
      camLaserAuto: (n?: number) => genCamLaser(n),   // nesting + corte láser de la pieza plana
      camPrintAuto: () => genCamPrint(),              // slicer FDM completo
      setWorkspace: (w: 'diseno' | 'manufactura' | 'simulacion') => setWorkspace(w),  // pestaña de la toolbar
      // ── ESTUDIO VIENTO (Escuela AERO) — drivers + resultado para las lecciones ──
      setViento: (on: boolean) => setVientoOn(on),
      setVientoMach: (m: number) => setVientoMach(m),
      setVientoAlt: (h: number) => setVientoAltM(Math.max(0, Math.min(20000, h))),
      setVientoPaneles: (n: number) => setVientoNPan(Math.max(2, Math.round(n))),
      setVientoShow: (kind: 'p' | 'tau' | 'shock', on: boolean) => {
        if (kind === 'p') setVientoShowP(on);
        else if (kind === 'tau') setVientoShowTau(on);
        else if (kind === 'shock') setVientoShowShock(on);
      },
      setVientoCalidad: (c: 'auto' | 'ligero' | 'ultra') => setVientoCalidad(c),
      get vientoTier() { return vientoTier; },
      get viento() {
        return vientoResult ? {
          deltaDeg: vientoResult.deltaDeg, betaDeg: vientoResult.betaDeg,
          p2_Pa: vientoResult.p2, pInf_Pa: vientoResult.pInf, rho: vientoResult.rho,
          q_Pa: vientoResult.q, V: vientoResult.V, aSonido: vientoResult.aSonido,
          Dp: vientoResult.Dp, Df: vientoResult.Df, D: vientoResult.D, cd: vientoResult.cd,
          fraccionPresion: vientoResult.fraccionPresion, nPaneles: vientoResult.nPaneles,
          mach: vientoResult.mach, hM: vientoResult.hM,
          showP: vientoShowP, showTau: vientoShowTau, showShock: vientoShowShock,
          calidad: vientoCalidad, tier: vientoTier,
        } : null;
      },
      // Patrón circular del componente ACTIVO (equivale a mover los controles del panel):
      // count copias alrededor de axis. c6t3: rayos del volante ×3 alrededor de Z.
      setActiveCompPattern: (count: number, axis?: 'x' | 'y' | 'z') => {
        setComponents((cur) => cur.map((c) => (c.id === activeComp ? { ...c, patternCount: count, patternAxis: axis ?? c.patternAxis } : c)));
      },
      // Convierte el componente ACTIVO (croquis) en REVOLVE-join/cut alrededor del eje global.
      setActiveCompRevolve: (axis: 'x' | 'y' | 'z', angle: number) => {
        setComponents((cur) => cur.map((c) => (c.id === activeComp ? { ...c, revolve: { axis, angle } } : c)));
      },
      // ENSAMBLE GENÉRICO: insertar pieza guardada + listar biblioteca (arnés/lecciones).
      insertPieza,
      libraryNames: () => Object.keys(readLib()),
      // CROQUIS-SOBRE-CARA por API (fiable para el arnés: sin adivinar pixel de la cara).
      sketchOnFace: (faceId: number) => { sketchFacePendingRef.current = true; togglePickFace(faceId); },
      // Elige AUTOMÁTICAMENTE la cara superior (normal≈+Z, mayor centroide Z) y croquiza en ella.
      sketchOnTopFace: () => {
        const m = resultRef.current?.mesh; if (!m) return;
        const ids = Array.from(new Set(Array.from(m.faceIds as ArrayLike<number>)));
        let best = -1, bestZ = -Infinity;
        for (const id of ids) {
          const pl = planeFromMeshFace(m, id); if (!pl) continue;
          const nz = pl.uDir[0] * pl.vDir[1] - pl.uDir[1] * pl.vDir[0]; // (u×v).z = normal.z
          if (nz > 0.7 && pl.origin[2] > bestZ) { bestZ = pl.origin[2]; best = id; }
        }
        if (best >= 0) { sketchFacePendingRef.current = true; togglePickFace(best); }
      },
      // PLANO DE REFERENCIA ARBITRARIO (Plane-at-Angle de Fusion, cap 5): el caller da
      // origen (punto en la arista) + uDir/vDir del plano (calculados de arista+ángulo,
      // como teclear 135° en el PropertyManager). Setea plane3d y abre el croquis ahí.
      sketchOnPlane3d: (origin: [number, number, number], uDir: [number, number, number], vDir: [number, number, number]) => {
        setSketch((s) => ({ ...s, plane3d: { origin, uDir, vDir } }));
        setSketchOpen(true);
      },
      // Cara INFERIOR (normal≈−Z, menor centroide Z) — tutoriales que croquizan abajo (rueda, yoke).
      sketchOnBottomFace: () => {
        const m = resultRef.current?.mesh; if (!m) return;
        const ids = Array.from(new Set(Array.from(m.faceIds as ArrayLike<number>)));
        let best = -1, bestZ = Infinity;
        for (const id of ids) {
          const pl = planeFromMeshFace(m, id); if (!pl) continue;
          const nz = pl.uDir[0] * pl.vDir[1] - pl.uDir[1] * pl.vDir[0];
          if (nz < -0.7 && pl.origin[2] < bestZ) { bestZ = pl.origin[2]; best = id; }
        }
        if (best >= 0) { sketchFacePendingRef.current = true; togglePickFace(best); }
      },
      // GENERAL: croquis sobre la cara cuyo normal apunta a +/-X|Y|Z y su centroide es el
      // extremo en ese eje (right=x/max, front=y/min, top=z/max...). Cubre TODOS los tutoriales.
      sketchOnFaceDir: (ax: 'x' | 'y' | 'z', side: 'max' | 'min') => {
        const m = resultRef.current?.mesh; if (!m) return;
        const idx = ax === 'x' ? 0 : ax === 'y' ? 1 : 2;
        const want = side === 'min' ? -1 : 1;
        const ids = Array.from(new Set(Array.from(m.faceIds as ArrayLike<number>)));
        let best = -1, bestProj = -Infinity;
        for (const id of ids) {
          const pl = planeFromMeshFace(m, id); if (!pl) continue;
          const n = [pl.uDir[1] * pl.vDir[2] - pl.uDir[2] * pl.vDir[1], pl.uDir[2] * pl.vDir[0] - pl.uDir[0] * pl.vDir[2], pl.uDir[0] * pl.vDir[1] - pl.uDir[1] * pl.vDir[0]];
          if (n[idx] * want > 0.7) { const proj = pl.origin[idx] * want; if (proj > bestProj) { bestProj = proj; best = id; } }
        }
        if (best >= 0) { sketchFacePendingRef.current = true; togglePickFace(best); }
      },
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
  }, [oc, result, ops, opErr, addOp, updateOp, removeOp, renameOp, toggleSuppressOp, moveOp, rollTo, rollbackIdx, undo, redo, histVer, params, bindings, resolvedParams, addParam, updateParam, removeParam, setBinding, toggleCollapse, exportSTL, genPlano, planoSvg, printReport, printMaterial, showOverhangs, sectionOn, sectionPlanes, components, activeComp, addComponent, updateComponent, removeComponent, docName, serializeDoc, loadDoc, newDoc, saveToLibrary, loadFromLibrary, deleteFromLibrary, importedStep, importStepText, clearImportedStep, togglePickFace, togglePickEdge, selectedFaceId, selectedEdgeId, setSteps, addStep, updateStep, sketch.steps, setGear, updateGear, sketch.gear, sketch.gearbox, sketch.kind, applyGearbox, updateGearbox, gbTorque, printMaterial, assembly, addGear2, setTeeth2, applyGearMate, removeGear2, setDriveAngleDeg, setShafts, setHousing, verifyMeshing, meshSweep, material, runFeaAnalysis, feaLiveSetLoad, clearFeaOverlay, feaResult, feaBusy, feaErr, feaColors, feaFixedFace, feaLoadFace, feaLoadN, feaLiveMs, runGenerative, genResult, genBusy, genThreshold, genVoidPct, gbMotion, gbParts, gbBodyGeos, gbHidden, gbColors,
   vientoResult, vientoShowP, vientoShowTau, vientoShowShock, vientoCalidad, vientoTier, vientoColors]);

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
    // BBOX REAL de la malla (incluye TODOS los componentes: paredes, perno, rayos…)
    // → encuadra CUALQUIER pieza, no solo la del croquis base. Es el fix de "no se
    // veía la pieza completa": antes solo estimaba del sketch, ignorando componentes.
    const realSpan = meshBBox ? 2 * Math.max(meshBBox.half[0], meshBBox.half[1], meshBBox.half[2]) : 0;
    const span = Math.max(sketch.width, sketch.height, sketch.radius * 2, stepLen, stepR * 2,
      sketch.kind === 'gear' ? gearD : 0, asmSpan, realSpan, 30);
    return Math.max(60, span * (realSpan > 0 ? 2.2 : 2.6));
  }, [sketch, assembly, meshBBox]);

  // AUTO-ENCUADRAR: cuando el TAMAÑO de la pieza cambia notablemente (agregar una
  // pared/componente/perno grande), salta a una vista iso que la abarca COMPLETA.
  // Antes la cámara se quedaba pegada y la pieza no se veía entera.
  const lastFitSpan = useRef(0);
  useEffect(() => {
    if (!meshBBox) return;
    const span = 2 * Math.max(meshBBox.half[0], meshBBox.half[1], meshBBox.half[2]);
    if (Math.abs(span - lastFitSpan.current) > lastFitSpan.current * 0.2 + 8) {
      lastFitSpan.current = span; setView('iso');
    }
  }, [meshBBox, setView]);

  // El <canvas> lo crea R3F dentro del viewport; le ponemos data-testid para
  // que Playwright pueda clicar por COORDENADAS del viewport de forma estable.
  const viewportRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const cv = viewportRef.current?.querySelector('canvas');
    if (cv) cv.setAttribute('data-testid', 'viewport-canvas');
  }, [result]);

  const ok = result ? result.topo.euler === 2 : false;
  const mat = MATERIALS[material];

  // ── CROQUIS EN ESCENA (orden del user: el croquis NO es otra pantalla) ──
  // El plano ACTIVO del croquis, resuelto en coordenadas del kernel: plane3d manda
  // (croquis-en-cara); si no, el plano base XY/YZ/XZ con su offset.
  const sketchPlaneK = useMemo<SketchPlane3D>(() => {
    if (sketch.plane3d) return sketch.plane3d;
    const base = (sketch.plane ?? 'xy') === 'yz' ? PLANE_YZ : (sketch.plane ?? 'xy') === 'xz' ? PLANE_XZ : PLANE_XY;
    return (sketch.planeOffset ?? 0) !== 0 ? offsetPlane(base, sketch.planeOffset ?? 0) : base;
  }, [sketch.plane, sketch.planeOffset, sketch.plane3d]);
  // Cámara PERPENDICULAR al plano: con Z constante, la proyección en perspectiva del
  // plano es una SIMILITUD exacta ⇒ px/mm uniforme ⇒ el SVG del editor (escala fija)
  // cae SOBRE el plano 3D real. El nudge 0.002·d evita el gimbal de OrbitControls al
  // salir (error de escala ~2e-6: invisible).
  // ZOOM del croquis con la RUEDA: escala px/mm (y con ella la distancia de cámara)
  // JUNTAS, así el boceto se queda PEGADO al plano 3D. Reset a 1 al abrir un croquis.
  const [sketchZoom, setSketchZoom] = useState(1);
  useEffect(() => { if (sketchOpen) setSketchZoom(1); }, [sketchOpen]);
  const sketchCam = useMemo(() => {
    if (!sketchOpen) return null;
    const el = viewportRef.current;
    const W = el?.clientWidth ?? 1600, H = el?.clientHeight ?? 900;
    const S = ((Math.min(W, H) * 0.44) / 140) * sketchZoom;       // px/mm × zoom de rueda
    const d = H / (2 * S * Math.tan(((35 * Math.PI) / 180) / 2)); // fov vertical 35°
    const k2w = (p: [number, number, number]): [number, number, number] => [p[0], p[2], -p[1]];
    const { origin, uDir, vDir } = sketchPlaneK;
    const n: [number, number, number] = [
      uDir[1] * vDir[2] - uDir[2] * vDir[1],
      uDir[2] * vDir[0] - uDir[0] * vDir[2],
      uDir[0] * vDir[1] - uDir[1] * vDir[0],
    ];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    const o = k2w(origin);
    const nw = k2w([n[0] / nl, n[1] / nl, n[2] / nl]);
    const uw = k2w([uDir[0], uDir[1], uDir[2]]);
    const up = k2w([vDir[0], vDir[1], vDir[2]]);
    return {
      pos: [o[0] + nw[0] * d + uw[0] * d * 0.002, o[1] + nw[1] * d + uw[1] * d * 0.002, o[2] + nw[2] * d + uw[2] * d * 0.002] as [number, number, number],
      target: o as [number, number, number], up: up as [number, number, number], pxPerMm: S,
    };
    // ribbonMin cambia el ALTO del viewport → recalibrar cámara/escala si colapsan
    // la barra a mitad del croquis.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sketchOpen, sketchPlaneK, ribbonMin, sketchZoom]);

  return (
    <div className={`fb-root${hideChrome ? ' fb-chrome-off' : ''}${ribbonMin ? ' fb-ribbon-min' : ''}`}>
      <style>{CSS}</style>

      {/* ── VIEWPORT ── */}
      <div
        className="fb-viewport" data-testid="viewport" ref={viewportRef}
        onWheel={(e) => {
          // Durante el croquis la rueda ZOOMEA el boceto (dolly de cámara + px/mm).
          // Fuera del croquis la rueda es de OrbitControls (no la tocamos).
          if (!sketchOpen) return;
          setSketchZoom((z) => Math.min(6, Math.max(0.22, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))));
        }}
        onContextMenu={(e) => {
          // Clic derecho = menú radial de operaciones (no durante el croquis: ahí
          // el botón derecho es del editor). preventDefault mata el menú del browser.
          if (sketchOpen) return;
          e.preventDefault();
          setRadial({ x: e.clientX, y: e.clientY });
        }}
      >
        <CadViewport
          cameraDistance={cameraDist}
          autoRotate={false}
          minDistance={cameraDist * 0.2}
          maxDistance={cameraDist * 4}
          view={viewReq}
          orbit={orbitReq}
          viewTarget={meshBBox ? [meshBBox.center[0], meshBBox.center[2], -meshBBox.center[1]] : [0, 0, 0]}
          sketchCam={sketchCam}
        >
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {/* CAM vivo: stock + toolpath 3D solo en workspace MANUFACTURA */}
            {workspace === 'manufactura' && meshBBox && result && !building && (
              <CamStock3D center={meshBBox.center as [number, number, number]} half={meshBBox.half as [number, number, number]} />
            )}
            {workspace === 'manufactura' && camView3D && <CamToolpath3D segs={camView3D} />}
            {!(gbMotion && gbParts) && !moldParts.length && showSketch && <SketchPlane plane={sketchPlaneK} />}
            {/* El fantasma del perfil VIEJO se esconde mientras el croquis está
                abierto: el SVG en vivo ES la verdad ahí; dos versiones confunden. */}
            {!(gbMotion && gbParts) && !moldParts.length && showSketch && !sketchOpen && <ProfileGhost pts={profilePts} />}
            {moldParts.length ? (
              // MOLDE EN VIVO: cada PLACA es un componente separado (aislar/ocultar/
              // opacidad desde el árbol; la SECCIÓN los corta a todos).
              moldParts.map((pt) => (moldHidden[pt.role] ? null : (
                <PartMesh key={pt.role} geo={{ positions: pt.positions, normals: pt.normals, indices: pt.indices }}
                  color={pt.color} clip={sectionPlanes} opacity={moldOpacity[pt.role] ?? pt.opacity}
                  metalness={0.35} roughness={0.5} />
              )))
            ) : gbMotion && gbParts ? (
              <GearboxMotion data={gbParts} playing speed={gbSpeed} colors={gbColors} hidden={gbHidden} clip={sectionPlanes} />
            ) : sketch.kind === 'gearbox' && showOverhangs && result ? (
              // ANÁLISIS DE VOLADIZOS: la caja COMPLETA (compound) con mapa de calor
              // de voladizos (rojo = necesita soporte). La sección/altura la recorta.
              <SolidMesh mesh={result.mesh} faded={building} matKey={material} tint={partColor}
                faces={result.faces} edgeGeoms={result.edgeGeoms} selFaces={[]} selEdges={[]}
                pickMode="none" onPickFace={() => {}} onPickEdge={() => {}}
                feaColors={null} overhangColors={overhangColors} clip={sectionPlanes} />
            ) : sketch.kind === 'gearbox' && gbBodyGeos ? (
              // CAJA en CUERPOS separados, cada uno su color. La HEMBRA arranca
              // semi-transparente (ves los cuerpos de color adentro de un vistazo, no
              // una pieza maciza); ocúltala del todo o aísla uno para ver mejor. La
              // sección (flecha) los corta a todos.
              gbBodyGeos.map((b, gi) => (gbHidden[b.key] ? null : (
                <group key={b.key} position={[0, 0, gbExplode ? gi * 34 : 0]}>
                <PartMesh geo={b.geo} color={gbColor(b.key)} clip={sectionPlanes}
                  opacity={b.key === 'hembra' ? 0.28 : b.key === 'salida' ? 0.9 : 1}
                  metalness={b.key === 'eje' ? 0.85 : b.key === 'salida' ? 0.25 : b.key === 'hembra' ? 0.45 : 0.05}
                  roughness={b.key.startsWith('disco') ? 0.62 : 0.4} />
                </group>
              )))
            ) : genResult ? (
              genSmooth
                ? <GenerativeSurface result={genResult} threshold={genThreshold} />
                : <GenerativeVoxels result={genResult} threshold={genThreshold} />
            ) : result && feaDisp && feaColors && !showOverhangs ? (
              // FEA VISUAL: la pieza se deforma animada bajo la carga (multi-dirección).
              <FeaDeformMesh mesh={result.mesh} colors={feaColors} disp={feaDisp}
                dispMax={feaDispMaxRef.current} clip={sectionPlanes} />
            ) : result && (
              <SolidMesh
                mesh={result.mesh}
                faded={building}
                matKey={material}
                tint={partColor}
                faces={result.faces}
                edgeGeoms={result.edgeGeoms}
                selFaces={selFaces}
                selEdges={selEdges}
                pickMode={pickMode}
                onPickFace={togglePickFace}
                onPickEdge={togglePickEdge}
                feaColors={vientoColors ?? feaColors}
                overhangColors={showOverhangs ? overhangColors : null}
                clip={sectionPlanes}
              />
            )}
            {/* SECCIÓN: flecha arrastrable (Fusion-style) — mueve el corte con el mouse */}
            {sectionOn && meshBBox && !genResult && !(gbMotion && gbParts) && (
              <SectionGizmo bbox={meshBBox} axis={sectionAxis} flip={sectionFlip}
                offset={sectionOffset} setOffset={setSectionOffset} clip={sectionClip} />
            )}
            {/* ESTUDIO VIENTO: flechas p/τ + onda de choque SOBRE la pieza real */}
            {vientoOn && vientoResult && meshBBox && (
              <VientoOverlay bbox={meshBBox} r={vientoResult}
                showP={vientoShowP} showTau={vientoShowTau} showShock={vientoShowShock}
                calidad={vientoCalidad} onTier={setVientoTier} />
            )}
          </group>
        </CadViewport>

        {/* EDITOR DE CROQUIS 2D — dibujar perfil con restricciones (solver en vivo). */}
        {sketchOpen && (
          <SketchEditor onFinish={onSketchFinish} onCancel={() => setSketchOpen(false)} projScale={sketchCam?.pxPerMm} />
        )}

        {/* SELECTOR DE BOCETO — tarjeta flotante; el viewport queda VIVO para que el
            clic en una cara de la pieza decida (pick de cara armado en paralelo). */}
        {sketchChooser && !sketchOpen && (
          <div className="fb-chooser" data-testid="sketch-chooser">
            <div className="fb-chooser-head">
              <b>¿Dónde va el boceto?</b>
              <button className="fb-chooser-x" data-testid="chooser-cancel" onClick={cancelSketchChooser} title="Cancelar (Esc)">✕</button>
            </div>
            <div className="fb-chooser-planes">
              {(['xy', 'yz', 'xz'] as const).map((pl) => (
                <button key={pl} data-testid={`chooser-plane-${pl}`} onClick={() => pickChooserPlane(pl)}
                  title={`Bocetar en el plano ${pl.toUpperCase()}`}>
                  <span className="glyph">{pl === 'xy' ? '▭' : pl === 'yz' ? '▯' : '▱'}</span>
                  {pl.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="fb-chooser-hint">… o haz clic directo en una <b>cara</b> de la pieza</div>
          </div>
        )}

        {/* MENÚ RADIAL dorado (clic derecho): las operaciones del taller en un gesto */}
        {radial && (
          <RadialMenu
            x={radial.x} y={radial.y} onClose={() => setRadial(null)}
            items={[
              { id: 'sketch', label: 'Boceto', glyph: '✏', onPick: openSketchChooser },
              { id: 'extrude', label: 'Extruir', glyph: '⤒', onPick: () => addOp('extrude') },
              { id: 'revolve', label: 'Revolución', glyph: '⟳', onPick: () => addOp('revolve') },
              { id: 'hole', label: 'Barreno', glyph: '◎', onPick: startHole },
              { id: 'fillet', label: 'Redondeo', glyph: '◜', onPick: () => addOp('fillet') },
              { id: 'chamfer', label: 'Chaflán', glyph: '◹', onPick: () => addOp('chamfer') },
              { id: 'pattern', label: 'Patrón', glyph: '⠿', onPick: () => addOp('pattern') },
              { id: 'plano', label: 'Plano 2D', glyph: '▤', onPick: genPlano },
            ]}
          />
        )}

        {/* SIMULACIÓN DEL CICLO DE INYECCIÓN — overlay a pantalla completa */}
        {cycleSimOn && (
          <Suspense fallback={null}>
            <MoldCycleSim onClose={() => setCycleSimOn(false)} />
          </Suspense>
        )}
        {tpSimOn && (
          <Suspense fallback={null}>
            <MoldThreePlateSim onClose={() => setTpSimOn(false)} />
          </Suspense>
        )}
        {moldMachineOn && (
          <Suspense fallback={null}>
            <MoldMachinePanel onClose={() => setMoldMachineOn(false)} />
          </Suspense>
        )}
        {unscrewOn && (
          <Suspense fallback={null}>
            <MoldUnscrewSim onClose={() => setUnscrewOn(false)} />
          </Suspense>
        )}
        {sectionOn && (
          <Suspense fallback={null}>
            <MoldSectionReveal onClose={() => setSectionOn(false)} />
          </Suspense>
        )}

        {/* PALETA DE ATAJOS estilo Fusion "S" en el cursor (se abre con la tecla S). */}
        {shortcutPos && (
          <ShortcutOverlay
            tools={KEYMAP.map((m) => ({ label: m.label, icon: m.icon, shortcut: m.key.toUpperCase(), action: m.action }))}
            position={shortcutPos}
            onClose={() => setShortcutPos(null)}
          />
        )}

        {/* ATAJOS VISIBLES (orden del user): botón real, no susurro — clic o tecla S. */}
        <button
          data-testid="shortcut-hint"
          onClick={() => setShortcutPos({ x: 320, y: Math.max(180, window.innerHeight - 340) })}
          title="Paleta de atajos (o presiona S): C círculo · B rect · L línea · E extruir · F redondeo…"
          style={{
            position: 'absolute', left: 14, bottom: 88, zIndex: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(13,18,28,0.88)', border: `1px solid ${GOLD}66`, borderRadius: 9,
            padding: '7px 13px', fontSize: 12.5, color: '#e9eef5', fontFamily: "'JetBrains Mono', monospace",
            boxShadow: '0 4px 14px rgba(0,0,0,.4)',
          }}
        >
          <span style={{ color: GOLD, fontWeight: 700, border: `1px solid ${GOLD}88`, borderRadius: 4, padding: '0 6px' }}>S</span>
          <span>atajos del taller</span>
        </button>

        {pickMode !== 'none' && (
          <div className="fb-pick-hint" data-testid="pick-hint">
            {placingHole
              ? 'Clic en la cara superior para COLOCAR el barreno'
              : `Clic en ${pickMode === 'face' ? 'una CARA' : 'una ARISTA'} del sólido para seleccionarla`}
          </div>
        )}

        {/* HUD de SECCIÓN: eje del corte + invertir + pista de ARRASTRE (Fusion-style). */}
        {sectionOn && (
          <div className="fb-section-hud" data-testid="section-hud">
            <span className="lbl">✂ Corte</span>
            <div className="fb-seg">
              {(['x', 'y', 'z'] as const).map((ax) => (
                <button key={ax} data-testid={`sec-axis-${ax}`} className={sectionAxis === ax ? 'on' : ''}
                  onClick={() => setSectionAxis(ax)}>{ax.toUpperCase()}</button>
              ))}
              <button data-testid="sec-flip" className={sectionFlip ? 'on' : ''} onClick={() => setSectionFlip((v) => !v)} title="Invertir lado">⇄</button>
            </div>
            <span className="hint">arrastra la <b>flecha</b> 🠖 con el mouse</span>
            <button data-testid="btn-section-off" className="off" onClick={() => setSectionOn(false)}>✕</button>
          </div>
        )}

        {/* HUD de selección: el faceId/edgeId que el picking acaba de fijar.
            Playwright lee este nodo para verificar que el clic cambió la cara. */}
        <div className={`fb-hud-sel ${selectedFaceId == null ? 'empty' : ''}`} data-testid="hud-selected-face"
          style={sketch.kind === 'gearbox' && selectedFaceId == null ? { display: 'none' } : undefined}>
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
        <div className={`fb-hud-edge ${selectedEdgeId == null ? 'empty' : ''}`} data-testid="hud-selected-edge"
          style={sketch.kind === 'gearbox' && selectedEdgeId == null ? { display: 'none' } : undefined}>
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
            {/* HONESTIDAD DE LA VISTA (orden del user): la línea de reposo NO se
                mueve; lo que se ve deformarse está AMPLIFICADO para que se entienda.
                Se dice cuánto: real vs exagerada, para que nadie lo lea literal. */}
            {feaDisp && (() => {
              const diag = meshBBox ? 2 * Math.hypot(meshBBox.half[0], meshBBox.half[1], meshBBox.half[2]) : 0;
              const amp = feaDispMaxRef.current > 1e-9 ? (0.14 * diag) / feaDispMaxRef.current : 1;
              return (
                <div className="fb-fea-amp" data-testid="fea-amp">
                  deformación real <b>{feaResult.maxDisplacement.toFixed(3)} mm</b> · vista <b>×{amp < 10 ? amp.toFixed(1) : Math.round(amp)}</b> exagerada · contorno = reposo
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {!hideChrome && (
        <BindContext.Provider value={bindCtx}>
          {/* Encabezado */}
          {/* ── APP BAR ÚNICA (lo mejor de Fusion): marca + documento + workspaces +
                estado + undo + Opciones — UNA sola banda, no tres. ── */}
          <header className="fb-header">
            <div className="fb-mark">⚒</div>
            <div className="fb-titles">
              <h1 data-testid="doc-title">{docName} <span className="fb-doc-studio">· Part Studio</span>
                {importedStep && <span className="fb-imported-tag" data-testid="imported-tag">STEP importado</span>}</h1>
            </div>
            <div className="fb-ws-tabs" role="tablist">
              <button className={workspace === 'diseno' ? 'on' : ''} data-testid="tab-diseno" role="tab"
                onClick={() => setWorkspace('diseno')}>DISEÑO</button>
              <button className={workspace === 'manufactura' ? 'on' : ''} data-testid="tab-manufactura" role="tab"
                onClick={() => setWorkspace('manufactura')}>MANUFACTURA</button>
              {/* SIMULACIÓN es un ESTUDIO (orden del user), no una ventana perpetua. */}
              <button className={workspace === 'simulacion' ? 'on' : ''} data-testid="tab-simulacion" role="tab"
                onClick={() => setWorkspace('simulacion')}>SIMULACIÓN</button>
            </div>
            <span className="fb-tb-spring" />
            <div className={`fb-kernel ${oc ? 'on' : 'off'}`} data-testid="kernel-status" title={oc ? 'OCCT-WASM listo' : bootErr ? 'kernel falló' : 'cargando kernel…'}>
              <span className="dot" />
            </div>
            <div className="fb-undo">
              <button data-testid="btn-undo" onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)">↶</button>
              <button data-testid="btn-redo" onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Y)">↷</button>
              {/* RIBBON COLAPSABLE (orden del user): la pieza SIEMPRE a la vista. */}
              <button data-testid="btn-ribbon-toggle" onClick={toggleRibbon}
                title={ribbonMin ? 'Mostrar la barra de herramientas' : 'Colapsar la barra (la pieza siempre a la vista)'}>
                {ribbonMin ? '⌄' : '⌃'}</button>
              {/* COLOR DE LA PIEZA — clic cicla la paleta (adiós al metálico). */}
              <button data-testid="btn-part-color" onClick={cyclePartColor} title="Color de la pieza — clic para cambiar"
                style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #2a3546', background: partColor, cursor: 'pointer', padding: 0 }} />
            </div>
            <div className="fb-menu-wrap">
              <button className={`fb-menu-btn ${optionsOpen ? 'on' : ''}`} data-testid="btn-options"
                onClick={() => { setOptionsOpen((v) => { if (!v) refreshLib(); return !v; }); }} title="Opciones del documento"><Ic name="opciones" />Opciones</button>
              {optionsOpen && (
                <>
                  <div className="fb-menu-scrim" onClick={() => setOptionsOpen(false)} />
                  <div className="fb-menu" data-testid="options-menu" role="menu">
                    <div className="fb-menu-sec">Documento</div>
                    <input className="fb-doc-name" data-testid="input-doc-name" value={docName} spellCheck={false}
                      onChange={(e) => setDocName(e.target.value)} placeholder="Nombre de la pieza" />
                    <button data-testid="menu-new" role="menuitem"
                      onClick={() => { newDoc(); setOptionsOpen(false); }}>Nueva pieza</button>
                    {makeExamples().map((ex) => (
                      <button key={ex.name} data-testid="menu-example" role="menuitem"
                        onClick={() => { loadDoc(ex.doc()); setOptionsOpen(false); }}>{ex.name}</button>
                    ))}
                    <button data-testid="menu-save" role="menuitem"
                      onClick={() => { saveToLibrary(); refreshLib(); }}>Guardar <em>en biblioteca</em></button>
                    <label className="fb-menu-link" role="menuitem" style={{ cursor: 'pointer' }}>
                      Importar .json
                      <input type="file" accept=".json,application/json" data-testid="input-import" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { importDocFile(f); setOptionsOpen(false); } }} />
                    </label>
                    <label className="fb-menu-link" role="menuitem" style={{ cursor: 'pointer' }}>
                      Importar STEP <em>(step.parts, robots…)</em>
                      <input type="file" accept=".step,.stp,application/step,application/STEP" data-testid="input-import-step" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { importStepFile(f); setOptionsOpen(false); } }} />
                    </label>
                    {importedStep && (
                      <button data-testid="menu-clear-step" role="menuitem" className="danger"
                        onClick={() => { clearImportedStep(); setOptionsOpen(false); }}>✕ Quitar STEP importado</button>
                    )}
                    {libNames.length > 0 && (
                      <>
                        <div className="fb-menu-sec">Abrir <em>(biblioteca)</em></div>
                        <div className="fb-lib-list" data-testid="lib-list">
                          {libNames.map((n) => (
                            <div key={n} className="fb-lib-row">
                              <button className="fb-lib-open" data-testid={`lib-open-${n}`}
                                onClick={() => { loadFromLibrary(n); setOptionsOpen(false); }} title={`Abrir "${n}"`}>{n}</button>
                              <button className="fb-lib-open" data-testid={`lib-insert-${n}`} style={{ flex: '0 0 auto' }}
                                onClick={() => { insertPieza(n); setOptionsOpen(false); }}
                                title={`INSERTAR "${n}" en este documento (ensamble)`}>⤵</button>
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
                      {showSketch ? 'Ocultar boceto' : 'Mostrar boceto'}
                    </button>
                    <div className="fb-menu-sep" />
                    <div className="fb-menu-sec">Exportar</div>
                    <a data-testid="menu-export-step" role="menuitem"
                      className={`fb-menu-link ${result ? '' : 'disabled'}`}
                      href={result ? (stepBlobUrl.current ?? '#') : undefined} download="forja-part.step"
                      onClick={() => result && setOptionsOpen(false)} aria-disabled={!result}>
                      STEP <em>(B-Rep exacto)</em>
                    </a>
                    <button data-testid="menu-export-stl" role="menuitem"
                      disabled={!result && !genResult}
                      onClick={() => { exportSTL(); setOptionsOpen(false); }}>
                      STL <em>{genResult ? '(generativo)' : '(malla)'}</em>
                    </button>
                    <button data-testid="menu-export-json" role="menuitem"
                      onClick={() => { exportDocFile(); setOptionsOpen(false); }}>
                      .json <em>(pieza editable)</em>
                    </button>
                  </div>
                </>
              )}
            </div>
          </header>

          {/* ── RIBBON (lo mejor de SolidWorks CommandManager + Fusion): UNA banda de
                GRUPOS con botones grandes icono-arriba-label y el CAPTION del grupo
                debajo. Las ops de VISTA viven en la heads-up bar del viewport. ── */}
          <div className="fb-toolbar" data-testid="toolbar">
            <div className="fb-ribbon">
            {workspace === 'diseno' && <>
            <div className="fb-group">
              <div className="fb-group-row">
                {/* UN solo botón: el MOUSE decide dónde (plano base o cara de la pieza). */}
                <button className="fb-big primary" data-testid="btn-sketch" onClick={openSketchChooser} title="Boceto: elige un plano o haz clic en una cara de la pieza — el mouse decide"><Ic name="croquis" /><span>Boceto</span></button>
                <div className="fb-sketch-ctx">
                  <div className="fb-sketch-ctx-line">
                    <div className="fb-seg" title="Plano del croquis">
                    {(['xy', 'yz', 'xz'] as const).map((pl) => (
                      <button key={pl} data-testid={`set-plane-${pl}`} className={(sketch.plane ?? 'xy') === pl ? 'on' : ''}
                        onClick={() => setSketch((c) => ({ ...c, plane: pl, plane3d: undefined }))}
                        title={`Bocetar en el plano ${pl.toUpperCase()}`}>{pl.toUpperCase()}</button>
                    ))}
                    </div>
                    <input data-testid="input-plane-offset" className="fb-tb-num" type="number" value={sketch.planeOffset ?? 0}
                      onChange={(e) => setSketch((c) => ({ ...c, planeOffset: parseFloat(e.target.value) || 0 }))}
                      title="Offset del plano (mm)" />
                  </div>
                  <div className="fb-sketch-ctx-line">
                    <div className="fb-seg" title="Qué hace el croquis al terminar">
                    {(['new', 'join', 'cut'] as const).map((opn) => (
                      <button key={opn} data-testid={`sketch-op-${opn}`} className={sketchOp === opn ? 'on' : ''}
                        onClick={() => setSketchOp(opn)}
                        title={opn === 'new' ? 'El boceto crea una base nueva' : opn === 'join' ? 'SUMA material (saliente)' : 'RESTA material (corte)'}>
                        {opn === 'new' ? 'Base' : opn === 'join' ? 'Unir' : 'Cortar'}</button>
                    ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="fb-group-cap">BOCETO</div>
            </div>
            <span className="fb-tb-sep" />
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-extrude" onClick={() => addOp('extrude')} title="Extruir (saliente/base)"><Ic name="extruir" /><span>Extruir</span></button>
                <button className="fb-big" data-testid="btn-revolve" onClick={() => addOp('revolve')} title="Revolución del perfil alrededor de un eje"><Ic name="revolucion" /><span>Revolución</span></button>
                <button className="fb-big" data-testid="btn-hole-face" onClick={startHoleOnFace} title="Agujero en cara: clic en una cara y taladra ⊥ (⌀ y profundidad editables)"><Ic name="agujerocara" /><span>Agujero</span></button>
                <button className="fb-big" data-testid="btn-pattern" onClick={() => addOp('pattern')} title="Patrón: rectangular / circular / espejo"><Ic name="patron" /><span>Patrón</span></button>
                <div className="fb-menu-wrap">
              <button ref={masBtnRef} data-testid="btn-mas" className={masOpen ? 'on' : ''}
                onClick={() => setMasOpen((v) => !v)} title="Más features (transición, barrido, engranes, vaciado…)">Más ▾</button>
              {masOpen && (
                <>
                  <div className="fb-menu-scrim" onClick={() => setMasOpen(false)} />
                  <div className="fb-menu fb-menu-mas" role="menu"
                    style={(() => { const r = masBtnRef.current?.getBoundingClientRect(); return r ? { position: 'fixed' as const, top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right), left: 'auto' as const } : undefined; })()}>
                    <button data-testid="btn-loft" role="menuitem" onClick={() => { addOp('loft'); setMasOpen(false); }}><Ic name="transicion" />Transición (loft)</button>
                    <button data-testid="btn-sweep" role="menuitem" onClick={() => { addOp('sweep'); setMasOpen(false); }}><Ic name="barrido" />Barrido (sweep)</button>
                    <button data-testid="btn-hole" role="menuitem" onClick={() => { startHole(); setMasOpen(false); }}><Ic name="barreno" />Barreno</button>
                    <button data-testid="btn-shell" role="menuitem" onClick={() => { addOp('shell'); setMasOpen(false); }}><Ic name="vaciado" />Vaciado (shell)</button>
                    <button data-testid="btn-draft" role="menuitem" onClick={() => { addOp('draft'); setMasOpen(false); }}><Ic name="chaflan" />Ángulo de salida (draft)</button>
                    <button data-testid="btn-pocket" role="menuitem" onClick={() => { addOp('pocket'); setMasOpen(false); }}><Ic name="cajera" />Cajera</button>
                    <button data-testid="btn-gear" role="menuitem" onClick={() => { applyGear(); setMasOpen(false); }}><Ic name="engrane" />Engrane de involuta</button>
                    <button data-testid="btn-gearbox" role="menuitem" onClick={() => { applyGearbox(); setMasOpen(false); }}><Ic name="cajacic" />Caja cicloidal</button>
                    <button data-testid="btn-rosca" role="menuitem" onClick={() => { applyRosca(); setMasOpen(false); }}><Ic name="roscado" />Rosca (tornillo)</button>
                    <button data-testid="btn-rack" role="menuitem" onClick={() => { applyRack(); setMasOpen(false); }}><Ic name="engrane" />Cremallera (rack)</button>
                    <button data-testid="btn-din" role="menuitem" onClick={() => { applyDin(); setMasOpen(false); }}><Ic name="roscado" />Tornillo DIN 933</button>
                    <button data-testid="btn-params" role="menuitem" onClick={() => { setParamsOpen((v) => !v); setMasOpen(false); }}><Ic name="params" />Parámetros ƒₓ</button>
                    <button data-testid="btn-component" role="menuitem" onClick={() => { addComponent('box'); setMasOpen(false); }}><Ic name="componente" />Componente</button>
                  </div>
                </>
              )}
            </div>
              </div>
              <div className="fb-group-cap">CREAR</div>
            </div>
            <span className="fb-tb-sep" />
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-fillet" onClick={() => addOp('fillet')} title="Redondeo de aristas"><Ic name="redondeo" /><span>Redondeo</span></button>
                <button className="fb-big" data-testid="btn-chamfer" onClick={() => addOp('chamfer')} title="Chaflán de aristas"><Ic name="chaflan" /><span>Chaflán</span></button>
              </div>
              <div className="fb-group-cap">MODIFICAR</div>
            </div>
            <span className="fb-tb-sep" />
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-plano" onClick={genPlano} disabled={!result}
                  title="Plano de taller: 3 vistas ortográficas acotadas → SVG"><Ic name="planotaller" /><span>Plano</span></button>
              </div>
              <div className="fb-group-cap">DOCUMENTAR</div>
            </div>
            </>}
            {workspace === 'manufactura' && <>
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-cam-face" onClick={genCam} disabled={!result}
                  title="Careado (face milling): stock = bbox; zigzag + G-code (Cimo cap 9)"><Ic name="careado" /><span>Careado</span></button>
                <button className="fb-big" data-testid="btn-cam-pocket" onClick={startCamPocket} disabled={!result}
                  title="Cajera circular (2D Adaptive): clic en el FONDO de la ranura (Cimo cap 9)"><Ic name="cajera2d" /><span>Cajera 2D</span></button>
                <button className="fb-big" data-testid="btn-cam-drill" onClick={startCamDrill} disabled={!result}
                  title="Taladrado: clic en la pared de UN barreno → mismo-⌀ + ciclo peck (Cimo cap 9/5)"><Ic name="taladrado" /><span>Taladrado</span></button>
                <button className="fb-big" data-testid="btn-cam-tap" onClick={() => genCamTap(6.8)} disabled={!result}
                  title="Roscado M8×1.25 sobre pilotos ⌀6.8 → G84 modal (Cimo cap 9)"><Ic name="roscado" /><span>Roscado</span></button>
                <button className="fb-big" data-testid="btn-cam-bore" onClick={() => genCamBore(32)} disabled={!result}
                  title="Mandrinado (Bore): hélice pegada a la pared, G2 helicoidal (Cimo cap 10)"><Ic name="mandrinado" /><span>Mandrinado</span></button>
                <button className="fb-big" data-testid="btn-cam-adaptive" onClick={genCamAdaptive3D} disabled={!result}
                  title="Desbaste 3D: niveles Z sobre la superficie real, cero gouge (Cimo cap 10)"><Ic name="desbaste3d" /><span>Desbaste 3D</span></button>
              </div>
              <div className="fb-group-cap">FRESADO · CIMO CAP 9-10</div>
            </div>
            <span className="fb-tb-sep" />
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-cam-turn" onClick={genCamTurning} disabled={!result}
                  title="Torneado (Cimo caps 2/4/5): careado CoroPlus + desbaste de perfil sin gouge + acabado + tronzado — G96/G95, X en diámetro"><Ic name="torno" /><span>Torneado</span></button>
              </div>
              <div className="fb-group-cap">TORNO · CIMO CAP 4-5</div>
            </div>
            <span className="fb-tb-sep" />
            <div className="fb-group">
              <div className="fb-group-row">
                <button className="fb-big" data-testid="btn-cam-laser" onClick={() => genCamLaser(6)} disabled={!result}
                  title="Corte láser (Cimo caps 11-13): nesting en hoja 1000×500, kerf 0.4, interiores primero, pierce"><Ic name="laser" /><span>Láser</span></button>
                <button className="fb-big" data-testid="btn-cam-print" onClick={genCamPrint} disabled={!result}
                  title="Impresión FDM (Cimo caps 14-17): slicer propio — capas 0.2, infill 30% ±45°, Marlin PLA"><Ic name="impresion" /><span>Imprimir</span></button>
              </div>
              <div className="fb-group-cap">LÁSER+3D · CIMO 11-17</div>
            </div>
            </>}
            </div>
          </div>

          {/* ── HEADS-UP VIEW BAR (firma de SolidWorks): las ops de VISTA flotan sobre
                el viewport, no engordan el ribbon. ── */}
          <div className="fb-hud-view" data-testid="hud-view">
            <button data-testid="btn-fit" onClick={() => setView('iso')} disabled={!result} title="Encuadrar la pieza completa"><Ic name="encuadrar" /></button>
            <button onClick={() => setView('iso')} disabled={!result} title="Vista isométrica">ISO</button>
            <button onClick={() => setView('top')} disabled={!result} title="Vista superior">SUP</button>
            <button onClick={() => setView('front')} disabled={!result} title="Vista frontal">FRE</button>
            <button data-testid="btn-section-tool" className={sectionOn ? 'on' : ''} onClick={() => setSectionOn((v) => !v)} disabled={!result} title="Sección: corta la pieza para ver adentro"><Ic name="seccion" /></button>
          </div>

          {/* ── Panel izquierdo: GRAFO de features (clic = editar) ── */}
          <div className="fb-rail fb-rail-left" data-testid="rail-left">
          <aside className={`fb-features ${collapsed.features ? 'collapsed' : ''} ${winPos.features ? 'floating' : ''}`} data-testid="feature-tree" onPointerDown={winDrag('features')} onDoubleClick={winUndock('features')} style={winStyle('features')}>
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
                <strong>Boceto 1</strong>
                <em>{sketch.kind === 'rect' ? 'Rectángulo' : sketch.kind === 'circle' ? 'Círculo'
                  : sketch.kind === 'revprofile' ? `Perfil escalón ×${sketch.steps.length}`
                  : sketch.kind === 'gear' ? `Engrane Z${sketch.gear.teeth} m${sketch.gear.module}`
                  : sketch.kind === 'custom' ? (sketch.customCircle ? `Círculo ⌀${(2 * sketch.customCircle.r).toFixed(0)}` : `Boceto · ${sketch.customProfile?.length ?? 0} pts`)
                  : sketch.kind === 'lprofile' ? 'Perfil L' : 'Boceto'} · Plano XY</em>
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
            {/* ── CUERPOS de la CAJA: color + ocultar (como Fusion) ── */}
            {sketch.kind === 'gearbox' && gbBodyGeos && (
              <>
                <div className="fb-feat-subhead" data-testid="gb-bodies-head">
                  Cuerpos · caja <b data-testid="gb-visible-count">{gbBodyGeos.filter((b) => !gbHidden[b.key]).length}/{gbBodyGeos.length}</b> vis.
                  <button className="fb-feat-act" data-testid="gb-show-all" title="Mostrar todos los cuerpos"
                    onClick={showAllGbBodies} style={{ marginLeft: 'auto' }}>👁</button>
                </div>
                <div className="fb-bodies-list" data-testid="gb-bodies-list">
                <button data-testid="btn-explode" data-on={gbExplode ? '1' : '0'} onClick={() => setGbExplode((e) => !e)} title="Vista explosionada: separa los cuerpos por el eje (dibujo isométrico explosionado)" style={{ marginBottom: 6 }}>💥 {gbExplode ? 'Armar' : 'Explosionar'}</button>
                {gbBodyGeos.map((b) => {
                  const hidden = !!gbHidden[b.key];
                  return (
                    <div key={b.key} className="fb-feat-node comp" data-testid={`gb-body-${b.key}`}
                      style={hidden ? { opacity: 0.5 } : undefined}
                      onDoubleClick={() => isolateGbBody(b.key)}
                      title="Doble-clic = AISLAR (mostrar solo este)">
                      <input type="color" className="fb-color-dot" data-testid={`gb-color-${b.key}`}
                        value={gbColor(b.key)} onChange={(e) => setGbColor(b.key, e.target.value)}
                        title="Color del cuerpo" />
                      <div className="fb-feat-body">
                        <strong>{b.name}</strong>
                        <em>{hidden ? 'oculto' : 'visible'}</em>
                      </div>
                      <div className="fb-feat-actions">
                        <button className="fb-feat-act" data-testid={`gb-isolate-${b.key}`}
                          onClick={(e) => { e.stopPropagation(); isolateGbBody(b.key); }}
                          title="Aislar (mostrar solo este)">◎</button>
                        <button className="fb-feat-act" data-testid={`gb-hide-${b.key}`}
                          onClick={(e) => { e.stopPropagation(); toggleGbBody(b.key); }}
                          title={hidden ? 'Mostrar cuerpo' : 'Ocultar cuerpo'}>{hidden ? '🙈' : '👁'}</button>
                      </div>
                    </div>
                  );
                })}
                </div>
              </>
            )}
            {/* ── MOLDE EN VIVO: componentes (placas) — aislar / ocultar / opacidad, como Fusion ── */}
            {moldParts.length > 0 && (
              <>
                <div className="fb-feat-subhead" data-testid="mold-parts-head">
                  🏭 Molde · placas <b data-testid="mold-visible-count">{moldParts.filter((p) => !moldHidden[p.role]).length}/{moldParts.length}</b> vis.
                  <button className="fb-feat-act" data-testid="mold-show-all" title="Mostrar todas las placas" onClick={showAllMold} style={{ marginLeft: 'auto' }}>👁</button>
                </div>
                <div className="fb-bodies-list" data-testid="mold-parts-list">
                  {moldParts.map((pt) => {
                    const hidden = !!moldHidden[pt.role];
                    const op = moldOpacity[pt.role] ?? pt.opacity;
                    return (
                      <div key={pt.role} className="fb-feat-node comp" data-testid={`mold-part-${pt.role}`}
                        style={hidden ? { opacity: 0.5 } : undefined}
                        onDoubleClick={() => isolateMoldPlate(pt.role)} title="Doble-clic = AISLAR (solo esta placa)">
                        <span className="fb-color-dot" style={{ background: pt.color, borderRadius: '50%', width: 12, height: 12, display: 'inline-block', flex: '0 0 auto' }} />
                        <div className="fb-feat-body">
                          <strong>{pt.name}</strong>
                          <em>{pt.material} · {hidden ? 'oculta' : 'visible'}</em>
                          <input type="range" min={0.15} max={1} step={0.05} value={op} data-testid={`mold-opacity-${pt.role}`}
                            onChange={(e) => setMoldPlateOpacity(pt.role, Number(e.target.value))}
                            onClick={(e) => e.stopPropagation()} title={`Opacidad ${Math.round(op * 100)}%`} style={{ width: '100%', marginTop: 3 }} />
                        </div>
                        <div className="fb-feat-actions">
                          <button className="fb-feat-act" data-testid={`mold-isolate-${pt.role}`}
                            onClick={(e) => { e.stopPropagation(); isolateMoldPlate(pt.role); }} title="Aislar (solo esta)">◎</button>
                          <button className="fb-feat-act" data-testid={`mold-hide-${pt.role}`}
                            onClick={(e) => { e.stopPropagation(); toggleMoldPlate(pt.role); }} title={hidden ? 'Mostrar placa' : 'Ocultar placa'}>{hidden ? '🙈' : '👁'}</button>
                        </div>
                      </div>
                      {exp && (
                        <div className="fb-comp-tree" data-testid={`mold-comp-tree-${pt.role}`}>
                          <div className="fb-comp-row hdr">🔩 Cuerpos <b>({pt.bodies ?? 1})</b></div>
                          {pt.features && pt.features.length > 0 && <div className="fb-comp-row hdr">🕮 Historia</div>}
                          {(pt.features ?? []).map((f, i) => <div key={i} className="fb-comp-row feat">· {f}</div>)}
                          {pt.role === 'pieza' && liveDfm && (
                            <>
                              <div className="fb-comp-row hdr" data-testid="mold-dfm-pieza">⚖ Moldeabilidad (Kazmer §2.3) — <b style={{
                                color: liveDfm.moldable === 'si' ? '#7ee0a0' : liveDfm.moldable === 'con-mecanismos' ? '#f2b45c' : '#f27a6c',
                              }}>{liveDfm.moldable === 'si' ? 'MOLDEABLE (dos placas)' : liveDfm.moldable === 'con-mecanismos' ? 'CON MECANISMOS §11.3' : 'NO MOLDEABLE'}</b></div>
                              {liveDfm.verdicts.map((v, i) => (
                                <div key={i} className="fb-comp-row feat" title={`límite: ${v.limite}`}>
                                  {v.ok ? '✓' : '⚠'} {v.param}: <b style={{ color: v.ok ? '#7ee0a0' : '#f2b45c' }}>{v.valor}</b> <span style={{ opacity: 0.55 }}>[{v.ref}]</span>
                                </div>
                              ))}
                            </>
                          )}
                          {moldCompAnalysis?.[pt.role] && (
                            <>
                              <div className="fb-comp-row hdr" data-testid={`mold-comp-analysis-${pt.role}`}>📊 Análisis de esta placa</div>
                              {moldCompAnalysis[pt.role].map((v, i) => (
                                <div key={i} className="fb-comp-row feat" title={`límite: ${v.limite}`}>
                                  {v.ok ? '✓' : '⚠'} {v.param}: <b style={{ color: v.ok ? '#7ee0a0' : '#f2b45c' }}>{v.valor}</b> <span style={{ opacity: 0.55 }}>[{v.ref}]</span>
                                </div>
                              ))}
                            </>
                          )}
                        </div>
                      )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </aside>
          <aside className={`fb-facelist ${collapsed.faces ? 'collapsed' : ''} ${winPos.faces ? 'floating' : ''}`} data-testid="face-list" onPointerDown={winDrag('faces')} onDoubleClick={winUndock('faces')} style={winStyle('faces')}>
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
          {workspace === 'simulacion' && (
          <aside className={`fb-sim ${collapsed.sim ? 'collapsed' : ''} ${winPos.sim ? 'floating' : ''}`} data-testid="sim-panel" onPointerDown={winDrag('sim')} onDoubleClick={winUndock('sim')} style={winStyle('sim')}>
            <CollapseHead id="sim" title="Simulación · von Mises (FEA real)" collapsed={!!collapsed.sim}
              onToggle={() => toggleCollapse('sim')} />
            {/* ── CICLO DE INYECCIÓN: la simulación VIVA del molde (motor Kazmer) ── */}
            <div style={{ marginBottom: 12, paddingBottom: 10, borderBottom: `1px solid ${GOLD}22` }}>
              <p className="fb-hint-txt">
                Molde de 2 placas ciclando: llenado por frente real, campo térmico FDM
                en sección viva, F_apertura vs clamp (aviso de FUGA) y agua en canales.
              </p>
              <button className="fb-fea-run" data-testid="btn-cycle-sim" onClick={() => setCycleSimOn(true)}>
                ▶ Ciclo de inyección (molde vivo)
              </button>
              <button className="fb-fea-run" data-testid="btn-threeplate" onClick={() => setTpSimOn(true)} style={{ marginTop: 6 }}>
                ▶ Molde 3 placas (construcción + doble apertura)
              </button>
              <button className="fb-fea-run" data-testid="btn-unscrew" onClick={() => setUnscrewOn(true)} style={{ marginTop: 6 }}>
                ▶ Molde que DESENROSCA (núcleo rotativo · tapa/tubo con rosca)
              </button>
              <button className="fb-fea-run" data-testid="btn-section-reveal" onClick={() => setSectionOn(true)} style={{ marginTop: 6 }}>
                ▶ EL CORTE del molde (acero seccionándose · cavidad + agua + pines)
              </button>
              <button className="fb-fea-run" data-testid="btn-mold-machine" onClick={() => setMoldMachineOn(true)}
                style={{ marginTop: 6, background: GOLD, color: '#1a1206', fontWeight: 700 }}>
                🏭 LA MÁQUINA — cotizar molde de una pieza
              </button>
            </div>

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
            {/* EMPUJAR EN CUALQUIER DIRECCIÓN — la pieza se deforma según de dónde
                venga la fuerza. Aprender del OJO: probar todos los sentidos y VER
                cómo se comporta, sin esperar la nube. Cada botón re-resuelve al vuelo. */}
            {feaFixedFace != null && (
              <div className="fb-fea-dirs" data-testid="fea-dirs">
                <span className="fb-fea-dirs-lbl">Empuja hacia →</span>
                <div className="fb-fea-dir-grid">
                  {([
                    ['↑', [0, 0, 1], '+Z arriba'], ['↓', [0, 0, -1], '−Z abajo (peso)'],
                    ['→', [1, 0, 0], '+X'], ['←', [-1, 0, 0], '−X'],
                    ['⊗', [0, 1, 0], '+Y adentro'], ['⊙', [0, -1, 0], '−Y afuera'],
                  ] as [string, [number, number, number], string][]).map(([g, d, t]) => {
                    const on = feaLoadDir && Math.abs(feaLoadDir[0] - d[0]) < 0.4 && Math.abs(feaLoadDir[1] - d[1]) < 0.4 && Math.abs(feaLoadDir[2] - d[2]) < 0.4;
                    return (
                      <button key={t} data-testid={`fea-dir-${d[0]}-${d[1]}-${d[2]}`} title={`Cargar en ${t}`}
                        className={`fb-fea-dir ${on ? 'on' : ''}`} disabled={feaBusy || !oc}
                        onClick={() => runFeaAnalysis(d)}>{g}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {feaColors && (
              <button className="fb-sim-clear" data-testid="btn-fea-clear" onClick={clearFeaOverlay}>
                Quitar overlay (volver a metal)
              </button>
            )}
            {feaErr && <div className="fb-sim-err" data-testid="fea-error">{feaErr}</div>}

            {/* ── ESTUDIO VIENTO (Escuela AERO): la pieza en un túnel supersónico ── */}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${GOLD}22` }}>
              <p className="fb-hint-txt">
                Túnel supersónico sobre TU pieza: presión y cortante (las dos manos
                del aire) + onda de choque real. D′ = ∮(−p·n̂ + τ·t̂)·x̂ ds.
              </p>
              <button className="fb-fea-run" data-testid="btn-viento"
                onClick={() => setVientoOn((v) => !v)}
                style={vientoOn ? { background: GOLD, color: '#1a1206', fontWeight: 700 } : undefined}>
                {vientoOn ? '✈ Estudio VIENTO activo' : '✈ Estudio de VIENTO (aerodinámica)'}
              </button>
              {vientoOn && vientoResult && (
                <>
                  <Dim label="Mach" value={vientoMach} unit="" min={1.2} max={5} step={0.1}
                    testid="input-mach" onChange={(v) => setVientoMach(v)} />
                  <Dim label="Altitud" value={vientoAltM} unit="m" min={0} max={20000} step={500}
                    testid="input-altitud" onChange={(v) => setVientoAltM(v)} />
                  <Dim label="Paneles" value={vientoNPan} unit="" min={2} max={400} step={2}
                    testid="input-paneles-viento" onChange={(v) => setVientoNPan(Math.round(v))} />
                  <div className="fb-sim-bc" style={{ marginTop: 6 }}>
                    <div className="fb-sim-bc-row">
                      <button className="fb-pick-btn" data-testid="chk-viento-p"
                        onClick={() => setVientoShowP((v) => !v)}
                        style={vientoShowP ? { background: '#1E6FB033' } : undefined}>
                        {vientoShowP ? '◉' : '○'} Presión p (⊥)
                      </button>
                      <button className="fb-pick-btn" data-testid="chk-viento-tau"
                        onClick={() => setVientoShowTau((v) => !v)}
                        style={vientoShowTau ? { background: `${GOLD}33` } : undefined}>
                        {vientoShowTau ? '◉' : '○'} Cortante τ
                      </button>
                    </div>
                    <div className="fb-sim-bc-row">
                      <button className="fb-pick-btn" data-testid="chk-viento-shock"
                        onClick={() => setVientoShowShock((v) => !v)}
                        style={vientoShowShock ? { background: '#FF7A3C33' } : undefined}>
                        {vientoShowShock ? '◉' : '○'} Onda de choque (β={vientoResult.betaDeg.toFixed(1)}°)
                      </button>
                    </div>
                  </div>
                  <div className="fb-sim-bc" style={{ marginTop: 6 }}>
                    <div className="fb-sim-bc-row" style={{ gap: 4 }}>
                      <span className="rk" style={{ fontSize: 10, alignSelf: 'center' }}>Calidad</span>
                      {(['auto', 'ligero', 'ultra'] as const).map((c) => (
                        <button key={c} data-testid={`viento-calidad-${c}`} onClick={() => setVientoCalidad(c)}
                          className="fb-pick-btn" style={{ flex: 1, ...(vientoCalidad === c ? { background: `${GOLD}33`, color: GOLD } : {}) }}>
                          {c === 'auto' ? `Auto·${['Ligero', 'Medio', 'Ultra'][vientoTier]}` : c === 'ligero' ? 'Ligero' : 'Ultra'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="fb-row"><span className="rk">δ medido</span><span className="rv" data-testid="viento-delta">{vientoResult.deltaDeg.toFixed(1)}°</span></div>
                  <div className="fb-row"><span className="rk">p tras choque</span><span className="rv">{(vientoResult.p2 / 1e5).toFixed(3)}×10⁵ Pa</span></div>
                  <div className="fb-row"><span className="rk">q∞</span><span className="rv">{(vientoResult.q / 1e5).toFixed(3)}×10⁵ Pa</span></div>
                  <div className="fb-row hi"><span className="rk">D′ (arrastre)</span><span className="rv" data-testid="viento-drag">{(vientoResult.D / 1e4).toFixed(3)}×10⁴ N/m</span></div>
                  <div className="fb-row hi"><span className="rk">c_d</span><span className="rv" data-testid="viento-cd">{vientoResult.cd.toFixed(4)}</span></div>
                  <div className="fb-row"><span className="rk">presión / fricción</span><span className="rv">{(vientoResult.fraccionPresion * 100).toFixed(0)}% / {((1 - vientoResult.fraccionPresion) * 100).toFixed(0)}%</span></div>
                </>
              )}
              {vientoOn && !vientoResult && (
                <div className="fb-sim-err" data-testid="viento-error">Dibuja y extruye una cuña primero (el estudio mide su semiángulo).</div>
              )}
            </div>

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
          )}
          </div>
          <div className="fb-rail fb-rail-right" data-testid="rail-right">
          <aside className={`fb-params ${collapsed.params ? 'collapsed' : ''} ${winPos.params ? 'floating' : ''}`} data-testid="op-panel" onPointerDown={winDrag('params')} onDoubleClick={winUndock('params')} style={winStyle('params')}>
            <CollapseHead id="params" title="Parámetros" collapsed={!!collapsed.params}
              onToggle={() => toggleCollapse('params')} />

            {activeCompObj && (
              <>
                <div className="fb-panel-title">
                  {activeCompObj.kind === 'pieza'
                    ? <>Pieza insertada · <b style={{ color: GOLD }}>{activeCompObj.name}</b></>
                    : <>Componente · {activeCompObj.kind === 'cyl' ? 'Cilindro' : 'Bloque'}</>}
                </div>
                {activeCompObj.kind !== 'pieza' && <div className="fb-seg">
                  <button data-testid="comp-box" className={activeCompObj.kind === 'box' ? 'on' : ''}
                    onClick={() => updateComponent(activeCompObj.id, { kind: 'box' })}>Bloque</button>
                  <button data-testid="comp-cyl" className={activeCompObj.kind === 'cyl' ? 'on' : ''}
                    onClick={() => updateComponent(activeCompObj.id, { kind: 'cyl' })}>Cilindro</button>
                </div>}
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6, margin: '11px 0 5px' }}>Combinar con el cuerpo</div>
                <div className="fb-seg" data-testid="comp-bool">
                  <button data-testid="comp-bool-none" className={(activeCompObj.bool ?? 'none') === 'none' ? 'on' : ''} title="Junto: sin booleana (compound)"
                    onClick={() => updateComponent(activeCompObj.id, { bool: 'none' })}>Junto</button>
                  <button data-testid="comp-bool-union" className={activeCompObj.bool === 'union' ? 'on' : ''} title="Unir (fuse) al cuerpo"
                    onClick={() => updateComponent(activeCompObj.id, { bool: 'union' })}>Unir</button>
                  <button data-testid="comp-bool-subtract" className={activeCompObj.bool === 'subtract' ? 'on' : ''} title="Restar este componente del cuerpo"
                    onClick={() => updateComponent(activeCompObj.id, { bool: 'subtract' })}>Restar</button>
                  <button data-testid="comp-bool-cavity" className={activeCompObj.bool === 'subtractFrom' ? 'on' : ''} title="CAVIDAD de molde: este bloque MENOS la pieza"
                    onClick={() => updateComponent(activeCompObj.id, { bool: 'subtractFrom' })}>Cavidad</button>
                </div>
                {activeCompObj.bool === 'subtractFrom' && (
                  <Dim label="Contracción ×" value={activeCompObj.cavityScale ?? 1} unit="" min={1} max={1.2} step={0.01} testid="input-comp-cavity-scale"
                    onChange={(v) => updateComponent(activeCompObj.id, { cavityScale: v })} />
                )}
                {(activeCompObj.bool ?? 'none') !== 'none' && (
                  <>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6, margin: '9px 0 5px' }}>Conservar sólido (partir molde)</div>
                    <div className="fb-seg">
                      <button data-testid="comp-keep-all" className={!activeCompObj.keep ? 'on' : ''} title="Todo el resultado"
                        onClick={() => updateComponent(activeCompObj.id, { keep: undefined })}>Todo</button>
                      <button data-testid="comp-keep-largest" className={activeCompObj.keep === 'largest' ? 'on' : ''} title="Solo el sólido MAYOR (cavity plate)"
                        onClick={() => updateComponent(activeCompObj.id, { keep: 'largest' })}>Mayor</button>
                      <button data-testid="comp-keep-smallest" className={activeCompObj.keep === 'smallest' ? 'on' : ''} title="Solo el sólido MENOR (macho del core)"
                        onClick={() => updateComponent(activeCompObj.id, { keep: 'smallest' })}>Menor</button>
                    </div>
                  </>
                )}
                {activeCompObj.kind === 'box' && (
                  <>
                    <Dim label="Ancho (X)" value={activeCompObj.w} unit="mm" min={2} max={3000} step={1} testid="input-comp-w"
                      onChange={(v) => updateComponent(activeCompObj.id, { w: v })} />
                    <Dim label="Fondo (Y)" value={activeCompObj.d} unit="mm" min={2} max={3000} step={1} testid="input-comp-d"
                      onChange={(v) => updateComponent(activeCompObj.id, { d: v })} />
                    <Dim label="Alto (Z)" value={activeCompObj.h} unit="mm" min={2} max={3000} step={1} testid="input-comp-h"
                      onChange={(v) => updateComponent(activeCompObj.id, { h: v })} />
                  </>
                )}
                {activeCompObj.kind === 'cyl' && (
                  <>
                    <Dim label="Radio" value={activeCompObj.r} unit="mm" min={1} max={1000} step={0.1} testid="input-comp-r"
                      onChange={(v) => updateComponent(activeCompObj.id, { r: v })} />
                    <Dim label="Altura (Z)" value={activeCompObj.h} unit="mm" min={2} max={3000} step={1} testid="input-comp-h"
                      onChange={(v) => updateComponent(activeCompObj.id, { h: v })} />
                  </>
                )}
                {activeCompObj.kind === 'sketch' && (
                  <Dim label="Profundidad" value={activeCompObj.depth ?? 12} unit="mm" min={1} max={3000} step={1} testid="input-comp-depth"
                    onChange={(v) => updateComponent(activeCompObj.id, { depth: v })} />
                )}
                {activeCompObj.kind === 'sweeppath' && (
                  <>
                    <Dim label="Perfil ancho (en plano)" value={2 * (activeCompObj.sweepRx ?? 5)} unit="mm" min={1} max={200} step={1} testid="input-comp-swx"
                      onChange={(v) => updateComponent(activeCompObj.id, { sweepRx: v / 2 })} />
                    <Dim label="Perfil alto" value={2 * (activeCompObj.sweepRy ?? 20)} unit="mm" min={1} max={200} step={1} testid="input-comp-swy"
                      onChange={(v) => updateComponent(activeCompObj.id, { sweepRy: v / 2 })} />
                  </>
                )}
                <Dim label="Patrón circular ×" value={activeCompObj.patternCount ?? 1} unit="" min={1} max={64} step={1} testid="input-comp-patn"
                  onChange={(v) => updateComponent(activeCompObj.id, { patternCount: v })} />
                <div className="fb-sel-head">Espejar (mirror)</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[['none', '—'], ['yz', 'YZ'], ['zx', 'ZX'], ['xy', 'XY']].map(([m, lbl]) => (
                    <button key={m} data-testid={`comp-mirror-${m}`}
                      onClick={() => updateComponent(activeCompObj.id, { mirror: (m === 'none' ? undefined : m) as ('yz' | 'zx' | 'xy' | undefined) })}
                      style={{ flex: 1, padding: '5px 0', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                        background: (activeCompObj.mirror ?? 'none') === m ? '#FDB813' : 'rgba(255,255,255,0.05)',
                        color: (activeCompObj.mirror ?? 'none') === m ? '#1a1206' : '#9fb3c8', border: '1px solid #283443' }}>{lbl}</button>
                  ))}
                </div>
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
                ) : sketch.kind === 'rosca' ? ((() => {
                  const r = sketch.rosca ?? ROSCA_DEFAULTS; const dm = threadDims(r.d, r.pitch);
                  return (
                  <>
                    <p className="fb-hint-txt">
                      Cuerda helicoidal REAL (ISO 68-1): un perfil a 60° barrido por una hélice.
                      El callout <b>{threadDesignation(r.d, r.pitch)}</b> = Ø mayor × paso.
                      Menor <b>d₁ = {dm.d1.toFixed(2)}</b>, paso <b>d₂ = {dm.d2.toFixed(2)}</b> mm.
                    </p>
                    <Dim label="Ø mayor" value={r.d} unit="mm" min={6} max={40} step={1} testid="input-rosca-d"
                      onChange={(v) => updateRosca({ d: v })} />
                    <Dim label="Paso" value={r.pitch} unit="mm" min={1} max={6} step={0.25} testid="input-rosca-paso"
                      onChange={(v) => updateRosca({ pitch: v })} />
                    <Dim label="Largo roscado" value={r.length} unit="mm" min={6} max={80} step={2} testid="input-rosca-largo"
                      onChange={(v) => updateRosca({ length: v })} />
                  </>
                  );
                })()) : sketch.kind === 'din' ? ((() => {
                  const dn = sketch.din ?? DIN_DEFAULTS; const info = dinBoltInfo(dn.size, dn.length);
                  return (
                  <>
                    <p className="fb-hint-txt">
                      Del CATÁLOGO (942 SKUs, cotas de norma): <b>{info.desig}</b> — llave
                      <b> {info.s}</b>, cabeza {info.k} mm, paso {info.pitch}. Lo normalizado
                      no se dibuja: se invoca por designación.
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      {(['M6', 'M8', 'M10'] as const).map((sz) => (
                        <button key={sz} data-testid={`btn-din-${sz}`} onClick={() => updateDin({ size: sz })}
                          style={{ fontWeight: dn.size === sz ? 700 : 400 }}>{sz}</button>
                      ))}
                    </div>
                    <Dim label="Largo" value={dn.length} unit="mm" min={8} max={40} step={2} testid="input-din-largo"
                      onChange={(v) => updateDin({ length: v })} />
                  </>
                  );
                })()) : sketch.kind === 'rack' ? ((() => {
                  const rk = sketch.rack ?? RACK_DEFAULTS;
                  return (
                  <>
                    <p className="fb-hint-txt">
                      La involuta LÍMITE: radio→∞ ⇒ flancos RECTOS a 20° (ISO 53). Engrana con
                      cualquier piñón del mismo módulo. Avance = π·m·Z por vuelta del piñón.
                      Volumen exacto: <b>{(rackArea(rk.m, rk.teeth) * rk.width).toFixed(0)} mm³</b>.
                    </p>
                    <Dim label="Módulo" value={rk.m} unit="mm" min={1} max={8} step={0.5} testid="input-rack-m"
                      onChange={(v) => updateRack({ m: v })} />
                    <Dim label="Dientes" value={rk.teeth} unit="" min={3} max={30} step={1} testid="input-rack-z"
                      onChange={(v) => updateRack({ teeth: v })} />
                    <Dim label="Ancho de cara" value={rk.width} unit="mm" min={5} max={60} step={5} testid="input-rack-w"
                      onChange={(v) => updateRack({ width: v })} />
                  </>
                  );
                })()) : sketch.kind === 'gearbox' ? (
                  <>
                    <p className="fb-hint-txt">
                      Caja ENCAPSULADA en 1 pieza (sale lista, solo conectas el motor). La <b>hembra-vaso</b> (base + rodillos integrados) es el cuerpo fijo; los <b>discos</b> van relojeados −αᵢ/lóbulos (engranan sin colisión) sobre las <b>levas excéntricas</b>, retenidos por un <b>carrete</b> (collar+garganta a 45° auto-soportado) que NO deja al disco subir/bajar de su leva. La <b>brida</b> es la tapa que gira. Cada holgura = canal de grasa. No backdriveable → sostiene posición.
                    </p>
                    <Dim label="Discos" value={sketch.gearbox.discs} unit="" min={2} max={10} step={1} testid="input-gb-discs"
                      onChange={(v) => updateGearbox({ discs: Math.round(v) })} />
                    <Dim label="Lóbulos" value={sketch.gearbox.lobes} unit=":1" min={6} max={20} step={1} testid="input-gb-lobes"
                      onChange={(v) => updateGearbox({ lobes: Math.round(v) })} />
                    <Dim label="Eje ⌀" value={sketch.gearbox.shaftD} unit="mm" min={8} max={30} step={1} testid="input-gb-shaft"
                      onChange={(v) => updateGearbox({ shaftD: v })} />
                    <Dim label="Eje hueco ⌀" value={sketch.gearbox.shaftBore} unit="mm" min={0} max={20} step={1} testid="input-gb-bore"
                      onChange={(v) => updateGearbox({ shaftBore: v })} />
                    <Dim label="Pernos salida" value={sketch.gearbox.outPins} unit="" min={3} max={10} step={1} testid="input-gb-outpins"
                      onChange={(v) => updateGearbox({ outPins: Math.round(v) })} />
                    <div className="fb-divider" />
                    <div className="fb-panel-title" style={{ marginTop: 0 }}>¿Resiste? · {printMaterial}</div>
                    <Dim label="Par de salida" value={gbTorque} unit="N·m" min={5} max={300} step={5} testid="input-gb-torque"
                      onChange={(v) => setGbTorque(v)} />
                    {(() => {
                      const gbm = (printMaterial === 'TPU' ? 'Nylon' : printMaterial) as GbMaterial;
                      const a = analyzeGearbox(
                        { lobes: sketch.gearbox.lobes, discs: sketch.gearbox.discs, shaftD: sketch.gearbox.shaftD, shaftBore: sketch.gearbox.shaftBore, pinCircleR: sketch.gearbox.R, outPinR: sketch.gearbox.outPinD / 2, outPinCount: sketch.gearbox.outPins },
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
                    <div className="fb-divider" />
                    {/* ── MOVIMIENTO: ver girar el mecanismo (cinemática real) ── */}
                    <button data-testid="btn-gb-motion" className="fb-pick-btn"
                      style={gbMotion ? { background: `${GOLD}33`, borderColor: `${GOLD}aa` } : undefined}
                      onClick={() => setGbMotion((m) => !m)}
                      title="Animar el mecanismo: eje gira → discos orbitan → salida gira lento">
                      {gbMotion ? '⏸ Detener movimiento' : '▶ Ver el movimiento'}
                    </button>
                    {gbMotion && (
                      <>
                        <Dim label="Velocidad eje" value={gbSpeed} unit="rad/s" min={0.2} max={5} step={0.2} testid="input-gb-speed"
                          onChange={(v) => setGbSpeed(v)} />
                        <div className="fb-mass" data-testid="gb-motion-info">
                          <Row k="Entrada · salida" v={`θ · −θ/${sketch.gearbox.lobes}`} />
                          <Row k="Estado" v={gbParts ? `▶ girando (${sketch.gearbox.discs} discos)` : '⏳ construyendo…'} />
                        </div>
                      </>
                    )}
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
                <div className="fb-panel-title">Extruir · Saliente/Base</div>
                <Dim label="Altura" value={activeOpObj.depth} unit="mm" min={2} max={3000} step={1} testid="input-altura" bindKey={`${activeOpObj.id}:depth`}
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

            {activeOpObj?.type === 'draft' && (
              <>
                <div className="fb-panel-title">Draft · Ángulo de salida</div>
                <Dim label="Ángulo" value={activeOpObj.angleDeg} unit="°" min={0.5} max={15} step={0.5} testid="input-draft-angle"
                  onChange={(v) => updateOp(activeOpObj.id, { angleDeg: v } as Partial<Op>)} />
                <div style={{ fontSize: 11, opacity: 0.55, margin: '6px 0' }}>Paredes ⟂ al desmoldeo (+Z) se inclinan; pivote en z=0. Positivo = cierran hacia arriba.</div>
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

            {activeOpObj?.type === 'loft' && (
              <>
                <div className="fb-panel-title">Loft · Piel por secciones</div>
                <Dim label="Altura" value={activeOpObj.height} unit="mm" min={1} max={120} step={1} testid="input-altura-loft"
                  onChange={(v) => updateOp(activeOpObj.id, { height: v } as Partial<Op>)} />
                <Dim label="Escala superior" value={activeOpObj.topScale} unit="×" min={0.05} max={3} step={0.05} testid="input-escala-loft"
                  onChange={(v) => updateOp(activeOpObj.id, { topScale: v } as Partial<Op>)} />
                <p className="fb-hint-txt">
                  Interpola entre el perfil base y una copia escalada a esa altura. &lt;1 = tronco/cono (salida de molde), &gt;1 = campana.
                </p>
              </>
            )}

            {activeOpObj?.type === 'sweep' && (
              <>
                <div className="fb-panel-title">Sweep · Barrido por trayectoria</div>
                <div className="fb-sel-head">Trayectoria</div>
                <div className="fb-seg">
                  <button data-testid="sweep-line" className={activeOpObj.pathKind === 'line' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { pathKind: 'line' } as Partial<Op>)}>Recta</button>
                  <button data-testid="sweep-arc" className={activeOpObj.pathKind === 'arc' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { pathKind: 'arc' } as Partial<Op>)}>Codo</button>
                  <button data-testid="sweep-helix" className={activeOpObj.pathKind === 'helix' ? 'on' : ''}
                    onClick={() => updateOp(activeOpObj.id, { pathKind: 'helix' } as Partial<Op>)}>Hélice</button>
                </div>
                {activeOpObj.pathKind === 'line' && (
                  <Dim label="Longitud" value={activeOpObj.height} unit="mm" min={1} max={150} step={1} testid="input-largo-sweep"
                    onChange={(v) => updateOp(activeOpObj.id, { height: v } as Partial<Op>)} />
                )}
                {activeOpObj.pathKind === 'arc' && (
                  <>
                    <Dim label="Radio del codo" value={activeOpObj.radius} unit="mm" min={2} max={120} step={1} testid="input-radio-sweep"
                      onChange={(v) => updateOp(activeOpObj.id, { radius: v } as Partial<Op>)} />
                    <Dim label="Ángulo" value={activeOpObj.angle} unit="°" min={10} max={270} step={5} testid="input-angulo-sweep"
                      onChange={(v) => updateOp(activeOpObj.id, { angle: v } as Partial<Op>)} />
                  </>
                )}
                {activeOpObj.pathKind === 'helix' && (
                  <>
                    <Dim label="Radio" value={activeOpObj.radius} unit="mm" min={3} max={100} step={1} testid="input-radio-helix"
                      onChange={(v) => updateOp(activeOpObj.id, { radius: v } as Partial<Op>)} />
                    <Dim label="Paso por vuelta" value={activeOpObj.pitch} unit="mm" min={1} max={40} step={0.5} testid="input-paso-helix"
                      onChange={(v) => updateOp(activeOpObj.id, { pitch: v } as Partial<Op>)} />
                    <Dim label="Vueltas" value={activeOpObj.turns} unit="" min={0.5} max={12} step={0.5} testid="input-vueltas-helix"
                      onChange={(v) => updateOp(activeOpObj.id, { turns: v } as Partial<Op>)} />
                  </>
                )}
                <p className="fb-hint-txt">
                  Barre el perfil del croquis por la trayectoria. La esquina del codo se redondea (tubo real); la hélice hace resortes.
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
          <aside className={`fb-analysis ${collapsed.analysis ? 'collapsed' : ''} ${winPos.analysis ? 'floating' : ''}`} data-testid="analysis-panel" onPointerDown={winDrag('analysis')} onDoubleClick={winUndock('analysis')} style={winStyle('analysis')}>
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

                {/* ── SECCIÓN: ahora vive en la barra (✂ Sección) + flecha en el 3D ── */}
                <div className="fb-divider" />
                <div className="fb-print-head">
                  <span>✂ Sección</span>
                  <button className={`fb-sec-toggle ${sectionOn ? 'on' : ''}`} data-testid="btn-section"
                    onClick={() => setSectionOn((v) => !v)}>{sectionOn ? 'ON' : 'OFF'}</button>
                </div>
                <p className="fb-hint-txt" style={{ marginTop: 6 }}>
                  Enciéndela en la barra (✂ Sección) y <b>arrastra la flecha</b> con el mouse para mover el corte (X/Y/Z e invertir en el HUD de arriba). Sin barras.
                </p>
              </div>
            ) : (
              <div className="fb-mass"><Row k="Estado" v="construyendo…" /></div>
            )}
          </aside>
          </div>

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
          

          {/* ── Panel derecho: OPCIONES de la op activa ── */}
          

          {/* ── Panel de ANÁLISIS / PROPIEDADES (masa exacta GProp) ── */}
          

          {/* ── Panel de SIMULACIÓN (FEA von Mises REAL) ──
              El CAD pasa de "ver" a "ANALIZAR": resuelve K·u=f sobre una malla
              tet del sólido (reusa el motor de src/lib/formulas.ts) y colorea la
              pieza por von Mises. Cara FIJA = empotramiento; cara de CARGA +
              magnitud (N) a lo largo de su normal. Material = el del análisis de
              masa (E, ν, σ_y de MATERIAL_DATABASE). */}
          

          {/* ── TIMELINE ABAJO (orden del user, como Fusion): la historia de la
              pieza en chips horizontales; clic = activar y editar. El panel
              Documento (izq) queda para renombrar/suprimir/detalle. ── */}
          {(ops.length > 0 || components.length > 0) && (
            <div className="fb-timeline" data-testid="timeline">
              <span className="fb-tl-cap">HISTORIA</span>
              <button className={`fb-tl-chip ${activeOp === 'sketch' ? 'on' : ''}`} data-testid="tl-sketch"
                onClick={() => { setActiveOp('sketch'); setActiveComp(null); }} title="Boceto base — clic para editar">
                ✏ Boceto 1</button>
              {ops.map((o) => (
                <button key={o.id} className={`fb-tl-chip ${activeOp === o.id ? 'on' : ''} ${o.suppressed ? 'sup' : ''}`}
                  data-testid={`tl-${o.type}`}
                  onClick={() => { setActiveOp(o.id); setActiveComp(null); }}
                  title={`${opTitle(o.type)} — clic para editar`}>
                  {opIcon(o.type)} {o.name ?? opTitle(o.type)}</button>
              ))}
              {components.map((c) => (
                <button key={c.id} className={`fb-tl-chip comp ${activeComp === c.id ? 'on' : ''}`}
                  data-testid={`tl-comp-${c.kind}`}
                  onClick={() => { setActiveComp(c.id); setActiveOp(null); }}
                  title={`${c.name} — clic para editar`}>
                  ⧉ {c.name}</button>
              ))}
            </div>
          )}

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
      {camSvg && (
        <div className="fb-plano-overlay" data-testid="cam-overlay" onClick={() => setCamSvg(null)}>
          <div className="fb-plano-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fb-plano-bar">
              <span className="fb-cam-head"><b>CAM · {camTitle}</b>{camStats && <em data-testid="cam-stats">{camStats}</em>}</span>
              <div className="fb-plano-actions">
                <label style={{ fontSize: 11, marginRight: 6 }}>⌀<input data-testid="cam-tool-d" type="number" value={camToolD} onChange={(e) => setCamToolD(parseFloat(e.target.value) || 40)} style={{ width: 46, marginLeft: 3 }} /></label>
                {camOpRef.current === 'careado' && <label style={{ fontSize: 11, marginRight: 6 }}>paso<input data-testid="cam-stepover" type="number" value={camStepover} onChange={(e) => setCamStepover(parseFloat(e.target.value) || 27)} style={{ width: 46, marginLeft: 3 }} /></label>}
                {camOpRef.current === 'careado' && <label style={{ fontSize: 11, marginRight: 6 }}>prof<input data-testid="cam-depth" type="number" value={camDepth} onChange={(e) => setCamDepth(parseFloat(e.target.value) || 1.5)} style={{ width: 46, marginLeft: 3 }} /></label>}
                {camOpRef.current === 'ranura' && <label style={{ fontSize: 11, marginRight: 6 }}>a_e<input data-testid="cam-load" type="number" value={camLoad} onChange={(e) => setCamLoad(parseFloat(e.target.value) || 13.33)} style={{ width: 52, marginLeft: 3 }} /></label>}
                <button data-testid="btn-cam-regen" onClick={() => (camOpRef.current === 'ranura' && camPocketFaceRef.current != null ? genCamPocket(camPocketFaceRef.current) : genCam())}>↻ Regenerar</button>
                <button data-testid="btn-cam-download" onClick={downloadCamGcode}>⬇ G-code (.nc)</button>
                <button data-testid="btn-cam-close" onClick={() => setCamSvg(null)}>✕ Cerrar</button>
              </div>
            </div>
            <div className="fb-plano-svg" data-testid="cam-svg" dangerouslySetInnerHTML={{ __html: camSvg }} />
          </div>
        </div>
      )}
      {planoSvg && (
        <div className="fb-plano-overlay" data-testid="plano-overlay" onClick={() => setPlanoSvg(null)}>
          <div className="fb-plano-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fb-plano-bar">
              <span>📐 Plano de taller — 3 vistas · líneas ocultas · cotas</span>
              <div className="fb-plano-actions">
                <button data-testid="btn-plano-angulo" title="Alterna 3er ángulo (ANSI) ↔ 1er ángulo (ISO europeo)"
                  onClick={() => genPlano(planoProjRef.current === 'third' ? 'first' : 'third')}>⇄ 1er/3er áng</button>
                <button data-testid="btn-plano-gdt" title="GD&T (ASME Y14.5): datums A/B + planitud + perpendicularidad + posición Ⓜ en barrenos"
                  onClick={() => genPlano(planoProjRef.current, !planoGdtRef.current)}>⌖ GD&T</button>
                <button data-testid="btn-plano-detalle" title="Vista de DETALLE: amplía la zona del primer barreno (círculo A)"
                  onClick={() => genPlano(planoProjRef.current, undefined, !planoDetRef.current)}>🔍 Detalle</button>
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
  return { extrude: '⬓', hole: '◎', fillet: '◜', chamfer: '◹', shell: '▢', revolve: '⟳', loft: '◈', sweep: '↝', pattern: '⁘', pocket: '⊟' }[t];
}
function opTitle(t: OpType): string {
  return { extrude: 'Extrude', hole: 'Hole', fillet: 'Fillet', chamfer: 'Chamfer', shell: 'Shell', draft: 'Draft', revolve: 'Revolve', loft: 'Loft', sweep: 'Sweep', pattern: 'Patrón', pocket: 'Corte' }[t];
}
function opSubtitle(op: Op): string {
  switch (op.type) {
    case 'extrude': return `${op.depth.toFixed(0)} mm`;
    case 'hole': return `⌀${op.diameter.toFixed(1)} · ${op.through ? 'pasante' : `${op.depth.toFixed(0)}mm`}`;
    case 'fillet': return `R${op.radius.toFixed(1)} · ${op.edges.length || 'todas'} aristas`;
    case 'chamfer': return `${op.dist.toFixed(1)}mm · ${op.edges.length || 'todas'} aristas`;
    case 'shell': return `pared ${op.thickness.toFixed(1)} · ${op.faces.length} caras`;
    case 'draft': return `${op.angleDeg.toFixed(1)}° salida`;
    case 'revolve': return `${op.angle.toFixed(0)}°`;
    case 'loft': return `h${op.height.toFixed(0)} · ×${op.topScale.toFixed(2)}`;
    case 'sweep': return op.pathKind === 'line' ? `recta ${op.height.toFixed(0)}mm` : op.pathKind === 'arc' ? `codo R${op.radius.toFixed(0)} · ${op.angle.toFixed(0)}°` : `hélice R${op.radius.toFixed(0)} · ${op.turns.toFixed(1)}v`;
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

.fb-section-hud{position:absolute;top:74px;left:50%;transform:translateX(-50%);
  display:flex;align-items:center;gap:10px;z-index:7;background:rgba(13,18,28,0.86);
  border:1px solid ${GOLD}55;border-radius:10px;padding:6px 10px;
  box-shadow:0 6px 24px rgba(0,0,0,0.4);font-size:11px;color:#cdd6e2;}
.fb-section-hud .lbl{color:${GOLD};font-weight:700;}
.fb-section-hud .hint{color:#9fb3c8;}
.fb-section-hud .hint b{color:${GOLD};}
.fb-section-hud .off{border:1px solid ${GOLD}44;background:transparent;color:#9fb3c8;
  border-radius:6px;width:22px;height:22px;cursor:pointer;line-height:1;}
.fb-section-hud .off:hover{border-color:#e57373;color:#e57373;}

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

/* ── SHELL DOCKED: paneles sólidos grafito que ENMARCAN el viewport (ya no flotan
   encima encimándose). Cada panel se ancla a un borde; el 3D vive limpio al centro. ── */
.fb-header,.fb-features,.fb-params,.fb-invariants,.fb-toolbar,.fb-analysis{
  position:absolute;backdrop-filter:none;background:#12161d;
  border:0;border-radius:0;box-shadow:none;}

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

.fb-header{top:0;left:0;right:0;height:46px;display:flex;align-items:center;gap:14px;
  padding:0 16px;border-bottom:1px solid #222a35;background:#0f131a;z-index:20;}
.fb-mark{font-size:22px;color:${GOLD};filter:drop-shadow(0 0 8px ${GOLD}88);}
.fb-titles h1{font-size:14px;font-weight:600;letter-spacing:.2px;margin:0;}
.fb-titles p{font-size:11px;margin:2px 0 0;color:${STEEL};opacity:.8;}
.fb-kernel{display:flex;align-items:center;gap:7px;font-size:11px;padding:5px 11px;
  border-radius:20px;margin-left:8px;background:rgba(0,0,0,0.3);}
.fb-kernel .dot{width:7px;height:7px;border-radius:50%;}
.fb-kernel.on{color:#8ff0a4;}.fb-kernel.on .dot{background:#4ade80;box-shadow:0 0 8px #4ade80;}
.fb-kernel.off{color:#fbbf24;}.fb-kernel.off .dot{background:#fbbf24;box-shadow:0 0 8px #fbbf24;}

/* ── TOOLBAR "DRO": barra de instrumento maquinada (grafito sólido con profundidad,
   hairline de acento arriba, teclas táctiles, estado activo = tecla encendida) ── */
.fb-toolbar{top:46px;left:0;right:0;display:flex;align-items:center;flex-wrap:wrap;
  gap:5px;row-gap:7px;padding:8px 16px 9px;border-radius:0;backdrop-filter:none;
  background:linear-gradient(180deg,#1a212c,#11151c);
  border:0;border-bottom:1px solid #222a35;
  box-shadow:0 8px 22px rgba(0,0,0,.38);z-index:19;}
.fb-toolbar::before{content:'';position:absolute;left:0;right:0;top:0;height:2px;
  background:linear-gradient(90deg,transparent,#5bd1e6 18%,#7fe9fb 50%,#5bd1e6 82%,transparent);opacity:.9;
  box-shadow:0 0 12px rgba(91,209,230,.45);}
.fb-tb-label{font-size:9px;text-transform:uppercase;letter-spacing:2.4px;color:#9fb0bf;
  opacity:.85;margin:0 9px 0 3px;font-weight:700;}
.fb-toolbar button{position:relative;border:1px solid #3a4452;color:#dbe3ee;
  background:linear-gradient(180deg,#27303d,#1a212c);
  font-size:11.5px;padding:6px 10px;border-radius:8px;cursor:pointer;font-weight:600;letter-spacing:.2px;
  transition:transform .1s,border-color .12s,background .12s,color .12s,box-shadow .12s;
  box-shadow:0 1px 0 rgba(255,255,255,.06) inset,0 1px 3px rgba(0,0,0,.35);}
.fb-toolbar button:hover{transform:translateY(-1.5px);border-color:#5bd1e6;color:#eafaff;
  background:linear-gradient(180deg,#2c3744,#1d2733);
  box-shadow:0 6px 18px rgba(91,209,230,.28),0 0 0 1px rgba(91,209,230,.4),0 1px 0 rgba(255,255,255,.1) inset;}
.fb-toolbar button:active{transform:translateY(0);}
.fb-toolbar button.on{border-color:#8af0ff;color:#04222b;font-weight:700;
  background:linear-gradient(180deg,#8df0ff,#42c9e4);
  box-shadow:0 0 0 1px rgba(141,240,255,.7) inset,0 6px 22px rgba(91,209,230,.5);}
.fb-toolbar button:disabled{opacity:.34;cursor:not-allowed;transform:none;box-shadow:none;}
.fb-tb-sep{width:2px;height:26px;margin:0 9px;border-radius:2px;
  background:linear-gradient(180deg,transparent,#465263 20%,#465263 80%,transparent);}

.fb-features{top:106px;left:0;bottom:34px;width:238px;padding:12px;max-height:none;overflow:auto;
  border-right:1px solid #222a35;}
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
.fb-color-dot{width:16px;height:16px;min-width:16px;padding:0;border:1px solid rgba(255,255,255,0.25);
  border-radius:4px;cursor:pointer;background:transparent;-webkit-appearance:none;appearance:none;margin-right:7px;}
.fb-color-dot::-webkit-color-swatch{border:0;border-radius:3px;padding:0;}
.fb-color-dot::-webkit-color-swatch-wrapper{border:0;border-radius:3px;padding:0;}
.fb-bodies-list{max-height:230px;overflow-y:auto;overflow-x:hidden;margin:0 -2px;padding:0 2px;}
.fb-bodies-list::-webkit-scrollbar{width:7px;}
.fb-bodies-list::-webkit-scrollbar-thumb{background:${GOLD}44;border-radius:4px;}
.fb-bodies-list::-webkit-scrollbar-thumb:hover{background:${GOLD}77;}
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

.fb-params{right:0;top:106px;width:264px;padding:14px;max-height:56vh;overflow:auto;
  border-left:1px solid #222a35;border-bottom:1px solid #222a35;}
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
.fb-paramspanel{position:absolute;left:248px;top:113px;width:288px;padding:12px;z-index:30;
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

.fb-analysis{right:0;bottom:34px;width:264px;padding:15px;
  border-left:1px solid #222a35;border-top:1px solid #222a35;}
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

.fb-invariants{left:0;right:0;bottom:0;transform:none;max-width:none;height:34px;
  display:flex;gap:0;padding:0;overflow:hidden;border-top:1px solid #222a35;background:#0f131a;z-index:18;}
.fb-invariants{align-items:center;}
.fb-invariants .inv{flex:0 0 auto;padding:0 18px;height:34px;display:flex;flex-direction:row;
  align-items:center;gap:8px;border-right:1px solid #1c232d;}
.fb-invariants .chk{display:none;}
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
.fb-sim{position:absolute;left:252px;top:120px;width:240px;padding:14px;
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
.fb-fea-dirs{margin-top:9px;}
.fb-fea-dirs-lbl{font-size:10px;text-transform:uppercase;letter-spacing:1.4px;color:#7f93a8;font-weight:700;}
.fb-fea-dir-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:6px;}
.fb-fea-dir{border:1px solid #33404f;background:rgba(20,28,40,.9);color:#dbe3ee;font-size:16px;
  padding:7px 0;border-radius:8px;cursor:pointer;transition:.12s;line-height:1;}
.fb-fea-dir:hover{border-color:${GOLD};color:${GOLD};background:rgba(56,42,8,.4);}
.fb-fea-dir.on{border-color:${GOLD};color:#1a1206;background:${GOLD};font-weight:700;}
.fb-fea-dir:disabled{opacity:.4;cursor:not-allowed;}
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
.fb-fea-legend{position:absolute;left:50%;transform:translateX(-50%);bottom:84px;width:284px;z-index:7;pointer-events:none;
  background:rgba(13,18,28,0.82);border:1px solid ${GOLD}44;border-radius:12px;padding:9px 11px;
  backdrop-filter:blur(10px);box-shadow:0 4px 20px rgba(0,0,0,0.5);}
.fb-fea-amp{margin-top:7px;padding-top:7px;border-top:1px solid rgba(159,179,200,0.14);
  font-size:10.5px;color:#aeb9c7;text-align:center;line-height:1.4;}
.fb-fea-amp b{color:${GOLD};font-weight:700;}
.fb-fea-legend-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${STEEL};
  opacity:.85;margin-bottom:6px;}
.fb-fea-bar{height:13px;border-radius:4px;border:1px solid rgba(0,0,0,0.5);}
.fb-fea-ticks{display:flex;justify-content:space-between;margin-top:4px;
  font-family:'JetBrains Mono',monospace;font-size:10px;color:#e9eef5;}

/* ════════════════════════════════════════════════════════════════
   FORJA DS v2 — capa final del rediseño (gana el cascade).
   Doctrina: cromo grafito NEUTRO, iconos vectoriales monocromos,
   UN acento interactivo (azul acero), dorado SOLO para la marca.
   Nada de píldoras infladas ni emoji: plano, denso, de taller.
   ════════════════════════════════════════════════════════════════ */
/* PALETA NEBULOSA — colores de naturaleza que hipnotizan sin gritar:
   fondo = espacio profundo (azul de medianoche, no negro carbón);
   acento = AGUA/cielo (cian-teal); aurora verde = éxito; nebulosa violeta = especial;
   dorado = SOLO la marca. La profundidad la da el gradiente del viewport, no el cromo. */
:root{
  --ds-bg:#0A101C; --ds-panel:#0F1725; --ds-panel2:#16202F; --ds-raise:#1D2A3D;
  --ds-line:rgba(140,180,255,0.10); --ds-line2:rgba(140,180,255,0.20);
  --ds-text:#DCE7F5; --ds-dim:#8FA3BD; --ds-faint:#5E7089;
  --ds-accent:#41C7D4; --ds-accent-ink:#04252A; --ds-brand:#E8A33D;
  --ds-sky:#58A6FF; --ds-aurora:#5DDB8C; --ds-nebula:#8E7CFF;
}
.fb-root{background:var(--ds-bg);color:var(--ds-text);}
.fb-header,.fb-features,.fb-params,.fb-invariants,.fb-toolbar,.fb-analysis{
  background:var(--ds-panel);}
.fb-header{border-bottom:1px solid var(--ds-line);}
/* toolbar de DOS FILAS (contexto / herramientas) — sin wrap fantasma */
.fb-toolbar{border-bottom:1px solid var(--ds-line);display:flex;flex-direction:column;
  height:auto;padding:0;overflow:visible;}
.fb-tb-row{display:flex;align-items:center;flex-wrap:nowrap;gap:1px;padding:0 8px;
  height:37px;min-width:0;}
/* la fila de herramientas scrollea POR DENTRO si no cabe (jamás desplaza el layout:
   el scrollLeft fantasma del contenedor raíz corría TODA la UI y rompía los clics) */
.fb-tb-row-tools{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;}
.fb-tb-row-tools::-webkit-scrollbar{display:none;}
.fb-tb-row-ctx{border-bottom:1px solid var(--ds-line);overflow:visible;}
.fb-tb-spring{flex:1;}
.fb-mark{color:var(--ds-brand);}

/* pestañas de workspace */
.fb-ws-tabs{display:flex;gap:2px;align-self:stretch;align-items:stretch;}
.fb-ws-tabs button{border:0;background:transparent;color:var(--ds-dim);cursor:pointer;
  font-size:10.5px;font-weight:700;letter-spacing:1.1px;padding:0 12px;border-radius:0;
  border-bottom:2px solid transparent;transition:color .12s;}
.fb-ws-tabs button:hover{color:var(--ds-text);background:transparent;}
.fb-ws-tabs button.on{color:var(--ds-accent);border-bottom-color:var(--ds-accent);background:transparent;}

/* botones de la toolbar: planos, icono+texto, cero borde en reposo */
.fb-tb-row>button{display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;
  background:transparent;color:var(--ds-dim);font-size:11px;font-weight:500;
  padding:5px 7px;border-radius:6px;cursor:pointer;white-space:nowrap;line-height:1;
  transition:background .1s,color .1s;flex:0 0 auto;}
.fb-tb-row>button>.fb-ic{width:14px;height:14px;}
.fb-tb-row>button:hover{background:var(--ds-panel2);color:var(--ds-text);}
.fb-tb-row>button:active{background:var(--ds-raise);}
.fb-tb-row>button.on{background:var(--ds-panel2);color:var(--ds-accent);border-color:var(--ds-line2);}
.fb-tb-row>button:disabled{opacity:.32;cursor:default;background:transparent;color:var(--ds-dim);}
.fb-tb-row>button .fb-ic{flex:0 0 auto;opacity:.9;}
/* HUDs del viewport: bajo la toolbar de 2 filas (header 48 + 2×38 ≈ 126) */
.fb-pick-hint{top:136px;}
.fb-section-hud{top:136px;}
.fb-hud-sel{top:170px;}
.fb-hud-edge{top:204px;}
.fb-hud-asm{top:238px;}
/* chips de selección VACÍOS: invisibles (siguen en el DOM para el arnés) */
.fb-hud-sel.empty,.fb-hud-edge.empty{opacity:0;}
/* acento de selección en los chips: azul, no dorado */
.fb-hud-sel b{color:var(--ds-accent);}
.fb-hud-sel{border-color:rgba(76,159,255,0.35);}
/* ── APP BAR única + RIBBON CommandManager + heads-up view bar ── */
.fb-header{display:flex!important;align-items:center;gap:12px;padding:0 12px;height:44px;
  left:0;right:0;top:0;width:auto;}
.fb-titles h1{font-size:13px;margin:0;}
.fb-titles p{display:none;}
.fb-kernel{padding:0;background:transparent;border:0;}
.fb-header .fb-ws-tabs{align-self:stretch;}
.fb-ribbon{display:flex;align-items:stretch;gap:2px;padding:4px 10px 2px;
  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;min-width:0;}
.fb-ribbon::-webkit-scrollbar{display:none;}
.fb-group{display:flex;flex-direction:column;align-items:center;gap:1px;flex:0 0 auto;}
.fb-group-row{display:flex;align-items:stretch;gap:2px;}
.fb-group-cap{font-size:8.5px;letter-spacing:1.3px;color:var(--ds-faint);font-weight:700;
  padding:1px 0 2px;user-select:none;}
.fb-big{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  min-width:54px;padding:7px 8px 5px;border:1px solid transparent;border-radius:8px;
  background:transparent;color:var(--ds-dim);font-size:10px;font-weight:500;cursor:pointer;
  line-height:1;white-space:nowrap;}
.fb-big .fb-ic{width:17px;height:17px;opacity:.92;}
.fb-big:hover{background:var(--ds-panel2);color:var(--ds-text);}
.fb-big.on{background:var(--ds-panel2);color:var(--ds-accent);border-color:var(--ds-line2);}
.fb-big:disabled{opacity:.32;cursor:default;background:transparent;}
.fb-big.primary{background:var(--ds-accent);color:var(--ds-accent-ink);font-weight:700;}
.fb-big.primary:hover{background:#5CD6E2;color:var(--ds-accent-ink);}
.fb-sketch-ctx{display:flex;flex-direction:column;gap:3px;justify-content:center;padding:0 4px;}
.fb-sketch-ctx-line{display:flex;align-items:center;gap:3px;}
.fb-ribbon>.fb-tb-sep{height:42px;align-self:center;}
.fb-toolbar{top:44px;}
/* heads-up view bar (firma SolidWorks): vista flotando sobre el viewport */
.fb-hud-view{position:absolute;top:126px;left:50%;transform:translateX(-50%);
  display:flex;gap:2px;z-index:6;background:rgba(15,23,37,0.85);border:1px solid var(--ds-line);
  border-radius:8px;padding:3px;backdrop-filter:blur(8px);}
.fb-hud-view button{display:inline-flex;align-items:center;gap:4px;border:0;background:transparent;
  color:var(--ds-dim);font-size:10px;font-weight:700;padding:5px 8px;border-radius:5px;cursor:pointer;}
.fb-hud-view button:hover{background:var(--ds-panel2);color:var(--ds-text);}
.fb-hud-view button.on{color:var(--ds-accent);}
.fb-hud-view button:disabled{opacity:.3;cursor:default;}
.fb-hud-view .fb-ic{width:14px;height:14px;}
/* HUDs y rieles bajo el cromo nuevo (44 + ~74) */
.fb-pick-hint{top:160px;}
.fb-section-hud{top:160px;}
.fb-hud-sel{top:126px;left:28%;transform:none;}
.fb-hud-edge{top:126px;left:62%;transform:none;}
.fb-hud-asm{top:196px;}
.fb-rail{top:126px;}

/* ── ZONAS (rieles): columnas REALES; los paneles ya no flotan encimados ── */
.fb-rail{position:absolute;top:106px;bottom:38px;display:flex;flex-direction:column;
  gap:8px;z-index:4;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;padding:2px;}
.fb-rail-left{left:6px;width:244px;}
.fb-rail-right{right:6px;width:276px;}
.fb-rail>aside:not(.floating){position:static!important;inset:auto!important;width:auto!important;
  max-height:none!important;flex:0 0 auto;}
.fb-rail>aside{border:1px solid var(--ds-line)!important;border-radius:10px!important;
  background:rgba(15,23,37,0.92)!important;backdrop-filter:blur(6px);
  box-shadow:0 8px 28px rgba(2,8,18,0.45)!important;}
/* VENTANA FLOTANTE: jalada fuera del riel — ancho propio, sombra más honda */
.fb-rail>aside.floating{width:262px!important;max-height:64vh!important;overflow:auto;
  box-shadow:0 18px 60px rgba(2,8,18,0.7)!important;border-color:var(--ds-line2)!important;}
.fb-collapse-head{cursor:grab;}
.fb-collapse-head:active{cursor:grabbing;}
.fb-rail>aside.fb-features{flex:0 1 auto;min-height:120px;overflow:auto;}
.fb-rail>aside.fb-params{flex:0 1 auto;overflow:auto;}
/* ── EL VIEWPORT ES UNA REGIÓN REAL (no un fondo tapado): empieza DEBAJO del
   header+ribbon y termina sobre el footer. El cubo de vistas ya no queda
   aplastado por la barra y la pieza se encuadra en el espacio que SE VE. ── */
.fb-root:not(.fb-chrome-off) .fb-viewport{top:120px;bottom:34px;}
.fb-root.fb-chrome-off .fb-viewport{inset:0;}
/* RIBBON COLAPSADO: solo queda el header (46px) — máxima pieza en pantalla. */
.fb-root.fb-ribbon-min .fb-toolbar{display:none;}
.fb-root.fb-ribbon-min:not(.fb-chrome-off) .fb-viewport{top:46px;}
.fb-root.fb-ribbon-min .fb-rail{top:52px;}
.fb-root.fb-ribbon-min .fb-hud-view{top:52px;}
/* Ventanas flotantes NUNCA debajo de la barra. */
.fb-paramspanel{top:128px;}
/* ── TIMELINE abajo (Fusion-style): la historia en chips ── */
.fb-timeline{position:absolute;left:0;right:0;bottom:34px;height:42px;display:flex;gap:6px;align-items:center;
  padding:0 12px;z-index:8;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;
  background:linear-gradient(0deg,rgba(9,14,22,.94) 0%,rgba(9,14,22,.6) 70%,transparent 100%);}
.fb-tl-cap{font-size:9px;letter-spacing:2.2px;color:#5b6b7e;font-weight:700;flex:0 0 auto;}
.fb-tl-chip{flex:0 0 auto;display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:16px;
  border:1px solid #2a3546;background:rgba(16,23,34,.92);color:#cdd6e2;font:600 11.5px Inter,system-ui,sans-serif;
  cursor:pointer;transition:border-color .12s,background .12s,color .12s;}
.fb-tl-chip:hover{border-color:var(--ds-accent);color:#eafaff;}
.fb-tl-chip.on{border-color:#FDB813;color:#ffe9ad;background:rgba(56,42,8,.55);}
.fb-tl-chip.sup{opacity:.4;text-decoration:line-through;}
/* ── Selector de boceto (el MOUSE decide: plano o cara) ── */
.fb-chooser{position:absolute;top:14px;left:50%;transform:translateX(-50%);z-index:45;width:330px;
  background:rgba(10,15,23,.96);border:1px solid #33404f;border-radius:14px;box-shadow:0 14px 44px rgba(0,0,0,.6);
  padding:12px 14px;color:#e9eef5;font-family:Inter,system-ui,sans-serif;}
.fb-chooser-head{display:flex;align-items:center;justify-content:space-between;font-size:14px;margin-bottom:9px;}
.fb-chooser-x{background:none;border:none;color:#8fa3b8;cursor:pointer;font-size:14px;}
.fb-chooser-planes{display:flex;gap:8px;}
.fb-chooser-planes button{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;padding:9px 0 7px;
  border-radius:10px;border:1px solid #2a3546;background:rgba(20,28,40,.9);color:#dbe3ee;
  font:700 12px Inter,system-ui,sans-serif;cursor:pointer;transition:border-color .12s,color .12s;}
.fb-chooser-planes button:hover{border-color:#FDB813;color:#ffe9ad;}
.fb-chooser-planes .glyph{font-size:20px;line-height:1;}
.fb-chooser-hint{margin-top:9px;font-size:11.5px;color:#8fa3b8;text-align:center;}
.fb-rail>aside.fb-facelist{max-height:26vh!important;overflow:auto;}
.fb-rail>aside.fb-sim{overflow:auto;}
.fb-rail>aside.fb-analysis{overflow:auto;}
/* botón PRIMARIO (Croquis): acento agua — el punto de entrada del flujo real */
.fb-tb-row>button.primary{background:var(--ds-accent);color:var(--ds-accent-ink);font-weight:700;}
.fb-tb-row>button.primary:hover{background:#5CD6E2;color:var(--ds-accent-ink);}
/* menú Más: items con icono */
.fb-menu-mas button{display:flex;align-items:center;gap:9px;}
.fb-menu-mas .fb-ic{opacity:.8;}

/* cabecera del modal CAM: título + stats con wrap (ya no dentro del SVG) */
.fb-cam-head{display:flex;flex-direction:column;gap:2px;min-width:0;}
.fb-cam-head b{font-size:12px;color:var(--ds-text);font-weight:600;}
.fb-cam-head em{font-style:normal;font-size:10.5px;color:var(--ds-dim);
  font-family:'JetBrains Mono',monospace;white-space:normal;}
.fb-tb-sep{display:inline-block;width:1px;height:22px;background:var(--ds-line2);
  margin:0 7px;flex:0 0 auto;}
.fb-tb-label{display:none;}

/* segmented control (plano XY/YZ/XZ · Base/Unir/Cortar) */
.fb-seg{display:inline-flex;background:var(--ds-panel2);border:1px solid var(--ds-line);
  border-radius:6px;overflow:hidden;flex:0 0 auto;margin:0 3px;}
.fb-seg button{border:0;background:transparent;color:var(--ds-dim);font-size:10.5px;
  font-weight:600;padding:4px 8px;cursor:pointer;border-radius:0;}
.fb-seg button:hover{color:var(--ds-text);background:rgba(255,255,255,0.04);}
.fb-seg button.on{background:var(--ds-accent);color:var(--ds-accent-ink);}
.fb-tb-num{width:46px;background:var(--ds-panel2);border:1px solid var(--ds-line);
  color:var(--ds-text);font-size:11px;font-family:'JetBrains Mono',monospace;
  border-radius:6px;padding:3px 5px;margin:0 3px;}
.fb-tb-num:focus{outline:none;border-color:var(--ds-accent);}

/* menú Opciones */
.fb-menu-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid transparent;
  background:transparent;color:var(--ds-dim);font-size:11.5px;padding:5px 9px;
  border-radius:6px;cursor:pointer;}
.fb-menu-btn:hover{background:var(--ds-panel2);color:var(--ds-text);}
.fb-menu{background:var(--ds-panel2);border:1px solid var(--ds-line2);border-radius:8px;
  box-shadow:0 12px 40px rgba(0,0,0,0.55);}

/* panel derecho: campos numéricos (Dim v2) */
.fb-dim-num{display:flex;align-items:center;justify-content:space-between;gap:10px;}
.fb-dim-num .fb-dim-label{flex:1;}
.fb-scrub{cursor:ew-resize;user-select:none;}
.fb-dim-field{display:inline-flex;align-items:center;gap:4px;background:var(--ds-panel2);
  border:1px solid var(--ds-line);border-radius:6px;padding:2px 7px 2px 2px;}
.fb-dim-field:focus-within{border-color:var(--ds-accent);}
.fb-dim-field input{width:58px;border:0;background:transparent;color:var(--ds-text);
  font-family:'JetBrains Mono',monospace;font-size:12px;text-align:right;padding:3px 2px;
  -moz-appearance:textfield;appearance:textfield;}
.fb-dim-field input::-webkit-outer-spin-button,.fb-dim-field input::-webkit-inner-spin-button{
  -webkit-appearance:none;margin:0;}
.fb-dim-field input:focus{outline:none;}
.fb-dim-field em{font-style:normal;font-size:10px;color:var(--ds-faint);}

/* selección: el acento manda (adiós inundación dorada en cromo) */
.fb-facelist-items button.sel{background:var(--ds-accent);color:var(--ds-accent-ink);border-color:var(--ds-accent);}
.fb-count{color:var(--ds-accent);background:rgba(76,159,255,0.10);border-color:rgba(76,159,255,0.35);}

/* tarjetas del árbol de features: compactas y sobrias */
.fb-feat-node{border-radius:6px;}
.fb-menu-btn .fb-ic,.fb-seg .fb-ic{opacity:.85;}
`;
