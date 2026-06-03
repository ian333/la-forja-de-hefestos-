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

import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';
import { Canvas, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Environment, Grid, ContactShadows, GizmoHelper, GizmoViewcube } from '@react-three/drei';
import ShortcutOverlay from '../../components/ShortcutOverlay';
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
import {
  buildGearSketch,
  deriveGearGeometry,
  sketchSignedArea,
  sketchRotationalSymmetryError,
  GEAR_SKETCH_DEFAULTS,
  type GearSketchParams,
} from '../../lib/parts/involute-gear-sketch';
import {
  runFEA,
  vonMisesVertexColors,
  jetColor,
  type FEAResult,
  type FaceBC,
} from './fea';
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
type SketchKind = 'rect' | 'circle' | 'lprofile' | 'revprofile' | 'gear';

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

type OpType = 'extrude' | 'hole' | 'fillet' | 'chamfer' | 'shell' | 'revolve';

interface ExtrudeOp { id: string; type: 'extrude'; depth: number; symmetric: boolean; }
interface HoleOp { id: string; type: 'hole'; x: number; y: number; diameter: number; through: boolean; depth: number; }
interface FilletOp { id: string; type: 'fillet'; radius: number; edges: number[]; }
interface ChamferOp { id: string; type: 'chamfer'; dist: number; edges: number[]; }
interface ShellOp { id: string; type: 'shell'; thickness: number; faces: number[]; }
interface RevolveOp { id: string; type: 'revolve'; angle: number; axis: 'x' | 'y' | 'z' | 'edge'; }
type Op = ExtrudeOp | HoleOp | FilletOp | ChamferOp | ShellOp | RevolveOp;

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
    return circleGhost(sketch.radius); // solo para revolve poligonal; circle usa extrudeCircle
  };

  // El sólido BASE lo crea la primera op solidificante. Si el documento contiene
  // un REVOLVE, éste tiene PRIORIDAD como base (y el extrude se ignora): así el
  // usuario puede agregar Revolve sin tener que borrar primero el extrude inicial
  // — el grafo nunca queda vacío y la UI no se cae. Reordenamos para que el/los
  // revolve se procesen antes que el/los extrude; el resto conserva su orden.
  const hasRevolve = ops.some((o) => o.type === 'revolve');
  const ordered = hasRevolve
    ? [...ops.filter((o) => o.type === 'revolve'),
       ...ops.filter((o) => o.type !== 'revolve' && o.type !== 'extrude')]
    : ops;

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
    }
  }
  if (!shape) throw new Error('El documento no tiene sólido: agrega Extrude o Revolve.');
  return shape;
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
  feaColors,
}: {
  mesh: TessellatedMesh;
  faded: boolean;
  matKey: string;
  faces: FaceRef[];
  edgeGeoms: EdgeGeom[];
  selFaces: number[];
  selEdges: number[];
  pickMode: 'none' | 'face' | 'edge';
  onPickFace: (i: number) => void;
  onPickEdge: (i: number) => void;
  /** Colores por vértice del campo de von Mises (RGB 0..1, 3·N). null = sin overlay. */
  feaColors: Float32Array | null;
}) {
  const pbr = MATERIAL_PBR[matKey] ?? DEFAULT_PBR;
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
    if (feaColors && feaColors.length === mesh.positions.length) {
      geom.setAttribute('color', new THREE.BufferAttribute(feaColors, 3));
    } else if (geom.getAttribute('color')) {
      geom.deleteAttribute('color');
    }
    geom.attributes.color && (geom.attributes.color.needsUpdate = true);
  }, [geom, feaColors, mesh.positions.length]);
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
    if (pickMode !== 'face') return;
    e.stopPropagation();
    const ti = e.faceIndex;
    if (ti != null && ti >= 0 && ti < mesh.faceIds.length) {
      onPickFace(mesh.faceIds[ti]);
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
    if (pickMode !== 'edge') return;
    e.stopPropagation();
    onPickEdge(edgeId);
  }, [pickMode, onPickEdge]);

  // HOVER de cara: en modo 'face', la cara bajo el cursor se pre-resalta en oro
  // tenue cálido (lo que VAS a clicar) y el cursor pasa a pointer — el feedback
  // de pre-selección que todo CAD tiene. Distinto del oro saturado de la cara ya
  // seleccionada. Se apaga fuera del modo face o al salir del sólido.
  const [hoverFace, setHoverFace] = useState<number | null>(null);
  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (pickMode !== 'face') return;
    const ti = e.faceIndex;
    if (ti != null && ti >= 0 && ti < mesh.faceIds.length) {
      const fid = mesh.faceIds[ti];
      setHoverFace((h) => (h === fid ? h : fid));
    }
  }, [pickMode, mesh]);
  const handlePointerOver = useCallback(() => {
    if (pickMode === 'face' && typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  }, [pickMode]);
  const handlePointerOut = useCallback(() => {
    setHoverFace(null);
    if (typeof document !== 'undefined') document.body.style.cursor = '';
  }, []);
  // Sub-malla de la cara en hover (misma técnica que highlightGeo, una sola cara).
  const hoverGeo = useMemo(() => {
    if (pickMode !== 'face' || hoverFace == null || selFaces.includes(hoverFace)) return null;
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
  }, [mesh, hoverFace, pickMode, selFaces]);
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
        {feaColors ? (
          /* OVERLAY FEA: la pieza se pinta por von Mises (vertexColors azul→rojo).
             meshBasicMaterial = SIN luz: el color del esfuerzo se ve EXACTO en
             cualquier ángulo y con la luz tenue del viewport CAD (un mapa de
             color FEM debe leerse fiel, no teñido por el HDRI ni por sombras).
             vertexColors multiplica `color`, así que color=blanco. Las aristas
             B-Rep oscuras encima siguen dando la forma. */
          <meshBasicMaterial
            vertexColors
            color="#ffffff"
            toneMapped={false}
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
          visible={pickMode === 'edge'}
        >
          <meshBasicMaterial color={STEEL} transparent opacity={0.3} />
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
function Dim({ label, value, unit, onChange, min, max, step, testid }: {
  label: string; value: number; unit: string; onChange: (v: number) => void;
  min: number; max: number; step: number; testid?: string;
}) {
  return (
    <label className="fb-dim">
      <span className="fb-dim-label">{label}</span>
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
  });
  // El grafo arranca con un extrude (el "primer momento": sketch→sólido).
  const [ops, setOps] = useState<Op[]>([
    { id: newId('extrude'), type: 'extrude', depth: 12, symmetric: false },
  ]);
  const [activeOp, setActiveOp] = useState<string | null>(ops[0].id);
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
  // Picking de cara/arista pero dirigido al panel FEA (no a la op activa).
  const feaPickTargetRef = useRef<'fija' | 'carga' | null>(null);
  feaPickTargetRef.current = feaPickTarget;
  // Última CARA elegida por clic (índice estable OCCT) — se resalta SIEMPRE y se
  // muestra en el HUD, independiente de que haya una op de Shell activa.
  const [selectedFaceId, setSelectedFaceId] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const stepBlobUrl = useRef<string | null>(null);
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
          shape = buildShape(oc, sketch, ops, edgeAxisRef.current);
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
  }, [oc, sketch, ops, material, assembly]);

  useEffect(() => { if (oc) rebuild(); }, [oc, rebuild]);

  // Al cambiar la ESTRUCTURA del documento (nº de ops) la topología cambia y los
  // índices de cara/arista dejan de ser válidos: limpia la selección puntual.
  const opCount = ops.length;
  useEffect(() => { setSelectedFaceId(null); setSelectedEdgeId(null); }, [opCount]);

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
    }
    setOps((cur) => [...cur, op]);
    setActiveOp(op.id);
    if (type === 'fillet' || type === 'chamfer') setPickMode('edge');
    else if (type === 'shell') setPickMode('face');
    else setPickMode('none');
  }, [ops]);
  const removeOp = useCallback((id: string) => {
    setOps((cur) => cur.filter((o) => o.id !== id));
    setActiveOp(null);
    setPickMode('none');
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
    requestAnimationFrame(() => {
      let shape: Shape | null = null;
      try {
        // Reconstruye el MISMO sólido del documento (rebuild ya borró su Shape).
        const isAssembly = assembly.enabled && sketch.kind === 'gear';
        shape = isAssembly
          ? buildAssembly(oc, sketch.gear, assembly).compound
          : buildShape(oc, sketch, ops, edgeAxisRef.current);

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
        const F = feaLoadN;
        const totalForce: [number, number, number] = [
          (dir[0] / dlen) * F, (dir[1] / dlen) * F, (dir[2] / dlen) * F,
        ];

        const bc: FaceBC = {
          fixedFaces: [feaFixedFace],
          loadFaces: feaLoadFace != null ? [feaLoadFace] : [],
          totalForce,
        };
        const res = runFEA(oc, shape, bc, {
          material: FEA_MATERIAL_KEY[material] ?? 'aluminio_6061',
          resolution: 18,
        });

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
  }, [oc, feaFixedFace, feaLoadFace, feaLoadN, material, assembly, sketch, ops]);

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
  }, []);

  // Si cambia la geometría del documento, el FEA previo deja de ser válido:
  // limpiamos overlay + resultado (las BC por índice de cara también caducan).
  useEffect(() => {
    setFeaColors(null);
    setFeaResult(null);
    setFeaFixedFace(null);
    setFeaLoadFace(null);
  }, [opCount, sketch.kind]);

  // Selección (toggle) de cara/arista para la op activa. SIEMPRE fija el
  // selectedFaceId/selectedEdgeId (para el HUD + resalte), y además, si hay una
  // op que consume caras/aristas (Shell / Fillet / Chamfer), togglea su lista.
  const togglePickFace = useCallback((i: number) => {
    setSelectedFaceId(i);
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
    { key: 'b', icon: '⊙', label: 'Barreno', action: () => addOp('hole') },
    { key: 'f', icon: '◜', label: 'Fillet', action: () => addOp('fillet') },
    { key: 'x', icon: '◣', label: 'Chaflán', action: () => addOp('chamfer') },
    { key: 'w', icon: '▢', label: 'Vaciado', action: () => addOp('shell') },
    { key: 'v', icon: '⟳', label: 'Revolución', action: () => addOp('revolve') },
    { key: 'g', icon: '⚙', label: 'Engrane', action: () => applyGear() },
    { key: 'p', icon: '◧', label: 'Pick cara', action: () => enableFacePick() },
    { key: 'k', icon: '╱', label: 'Pick arista', action: () => enableEdgePick() },
  ], [setSketch, addOp, applyGear, enableFacePick, enableEdgePick]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') { setShortcutPos(null); setPickMode('none'); return; }
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
      setSketch,
      // Lista de ops con id+tipo+depth — para que QA (Playwright) ubique la op de
      // extrude por su id real y la edite (updateOp) sin depender del clamp del
      // slider de la UI. Solo lectura; no cambia la lógica del documento.
      get opsList() { return ops.map((o) => ({ id: o.id, type: o.type, depth: (o as { depth?: number }).depth })); },
      // Perfil escalonado de revolución (croquis poligonal) — driver de QA.
      setSteps,
      addStep,
      updateStep,
      get steps() { return sketch.steps; },
      // ── ENGRANE de involuta (7º clásico) — driver + invariantes de QA ──
      setGear,
      updateGear,
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
  }, [oc, result, ops, opErr, addOp, updateOp, togglePickFace, togglePickEdge, selectedFaceId, selectedEdgeId, setSteps, addStep, updateStep, sketch.steps, setGear, updateGear, sketch.gear, sketch.kind, assembly, addGear2, setTeeth2, applyGearMate, removeGear2, setDriveAngleDeg, setShafts, setHousing, verifyMeshing, meshSweep, material, runFeaAnalysis, clearFeaOverlay, feaResult, feaBusy, feaErr, feaColors, feaFixedFace, feaLoadFace, feaLoadN]);

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
          autoRotate={pickMode === 'none'}
          minDistance={cameraDist * 0.2}
          maxDistance={cameraDist * 4}
        >
          <group rotation={[-Math.PI / 2, 0, 0]}>
            {showSketch && <SketchPlane />}
            {showSketch && <ProfileGhost pts={profilePts} />}
            {result && (
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
              />
            )}
          </group>
        </CadViewport>

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
            Clic en {pickMode === 'face' ? 'una CARA' : 'una ARISTA'} del sólido para seleccionarla
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
        <>
          {/* Encabezado */}
          <header className="fb-header">
            <div className="fb-mark">⚒</div>
            <div className="fb-titles">
              <h1>La Forja · Part Studio</h1>
              <p>Crea por clic · kernel B-Rep exacto (OpenCASCADE)</p>
            </div>
            <div className={`fb-kernel ${oc ? 'on' : 'off'}`} data-testid="kernel-status">
              <span className="dot" />
              {oc ? 'OCCT-WASM listo' : bootErr ? 'kernel falló' : 'cargando kernel…'}
            </div>
          </header>

          {/* ── TOOLBAR de operaciones (botones) ── */}
          <div className="fb-toolbar" data-testid="toolbar">
            <span className="fb-tb-label">Operaciones</span>
            <button data-testid="btn-extrude" onClick={() => addOp('extrude')} title="Extrude (boss/base)">⬓ Extrude</button>
            <button data-testid="btn-hole" onClick={() => addOp('hole')} title="Barreno / corte cilíndrico">◎ Hole</button>
            <button data-testid="btn-fillet" onClick={() => addOp('fillet')} title="Redondeo de aristas">◜ Fillet</button>
            <button data-testid="btn-chamfer" onClick={() => addOp('chamfer')} title="Bisel de aristas">◹ Chamfer</button>
            <button data-testid="btn-shell" onClick={() => addOp('shell')} title="Vaciado / pared delgada">▢ Shell</button>
            <button data-testid="btn-revolve" onClick={() => addOp('revolve')} title="Revolución del perfil">⟳ Revolve</button>
            <button data-testid="btn-gear" onClick={applyGear} title="Engrane de involuta (m, Z, α, espesor, barreno)">⚙ Engrane</button>
          </div>

          {/* ── Panel izquierdo: GRAFO de features (clic = editar) ── */}
          <aside className="fb-features" data-testid="feature-tree">
            <div className="fb-feat-head">Documento</div>
            <div
              className={`fb-feat-node ${activeOp === 'sketch' ? 'active' : ''}`}
              data-testid="feat-sketch"
              onClick={() => { setActiveOp('sketch'); setPickMode('none'); }}
            >
              <span className="ico">▣</span>
              <div>
                <strong>Sketch 1</strong>
                <em>{sketch.kind === 'rect' ? 'Rectángulo' : sketch.kind === 'circle' ? 'Círculo' : sketch.kind === 'revprofile' ? `Perfil escalón ×${sketch.steps.length}` : sketch.kind === 'gear' ? `Engrane Z${sketch.gear.teeth} m${sketch.gear.module}` : 'Perfil L'} · Plano XY</em>
              </div>
            </div>
            {ops.map((op, i) => (
              <div key={op.id}>
                <div className="fb-feat-arrow">↓</div>
                <div
                  className={`fb-feat-node accent ${activeOp === op.id ? 'active' : ''}`}
                  data-testid={`feat-${op.type}`}
                  onClick={() => {
                    setActiveOp(op.id);
                    if (op.type === 'fillet' || op.type === 'chamfer') setPickMode('edge');
                    else if (op.type === 'shell') setPickMode('face');
                    else setPickMode('none');
                  }}
                >
                  <span className="ico">{opIcon(op.type)}</span>
                  <div>
                    <strong>{opTitle(op.type)} {i + 1}</strong>
                    <em>{opSubtitle(op)}</em>
                  </div>
                </div>
              </div>
            ))}
          </aside>

          {/* ── Lista SIEMPRE disponible de caras (selección determinista) ──
              Independiente de la op activa: clic en una entrada fija
              selectedFaceId (y, si hay Shell activo, togglea su cara abierta).
              Playwright elige la cara superior/inferior/lateral por testid sin
              depender de coordenadas del viewport. */}
          <aside className="fb-facelist" data-testid="face-list">
            <div className="fb-feat-head">
              Caras del sólido <b>{result?.faces.length ?? 0}</b>
            </div>
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
          <aside className="fb-params" data-testid="op-panel">
            {activeOp === 'sketch' && (
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
                  <Dim label="Radio" value={sketch.radius} unit="mm" min={3} max={50} step={1} testid="input-radio"
                    onChange={(v) => setSketch((s) => ({ ...s, radius: v }))} />
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
                    <Dim label="Ancho" value={sketch.width} unit="mm" min={6} max={100} step={1} testid="input-ancho"
                      onChange={(v) => setSketch((s) => ({ ...s, width: v }))} />
                    <Dim label="Alto" value={sketch.height} unit="mm" min={6} max={100} step={1} testid="input-alto"
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
                <Dim label="Altura" value={activeOpObj.depth} unit="mm" min={2} max={80} step={1} testid="input-altura"
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
                <Dim label="Diámetro" value={activeOpObj.diameter} unit="mm" min={1} max={40} step={0.5} testid="input-diametro"
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

            {activeOpObj && (
              <button className="fb-del-btn" data-testid="btn-del-op" onClick={() => removeOp(activeOpObj.id)}>
                ✕ Eliminar feature
              </button>
            )}

            <div className="fb-divider" />
            <div className="fb-actions">
              <button data-testid="btn-toggle-sketch" onClick={() => setShowSketch((v) => !v)}>
                {showSketch ? 'Ocultar boceto' : 'Mostrar boceto'}
              </button>
              <a className="fb-export" data-testid="btn-export-step"
                href={stepBlobUrl.current ?? '#'} download="forja-part.step"
                aria-disabled={!result}>Exportar STEP</a>
            </div>
          </aside>

          {/* ── Panel de ANÁLISIS / PROPIEDADES (masa exacta GProp) ── */}
          <aside className="fb-analysis" data-testid="analysis-panel">
            <div className="fb-panel-title">Análisis · Propiedades de masa</div>
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
              testid="input-carga" onChange={(v) => setFeaLoadN(v)} />

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
        </>
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
  return { extrude: '⬓', hole: '◎', fillet: '◜', chamfer: '◹', shell: '▢', revolve: '⟳' }[t];
}
function opTitle(t: OpType): string {
  return { extrude: 'Extrude', hole: 'Hole', fillet: 'Fillet', chamfer: 'Chamfer', shell: 'Shell', revolve: 'Revolve' }[t];
}
function opSubtitle(op: Op): string {
  switch (op.type) {
    case 'extrude': return `${op.depth.toFixed(0)} mm`;
    case 'hole': return `⌀${op.diameter.toFixed(1)} · ${op.through ? 'pasante' : `${op.depth.toFixed(0)}mm`}`;
    case 'fillet': return `R${op.radius.toFixed(1)} · ${op.edges.length || 'todas'} aristas`;
    case 'chamfer': return `${op.dist.toFixed(1)}mm · ${op.edges.length || 'todas'} aristas`;
    case 'shell': return `pared ${op.thickness.toFixed(1)} · ${op.faces.length} caras`;
    case 'revolve': return `${op.angle.toFixed(0)}°`;
  }
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
