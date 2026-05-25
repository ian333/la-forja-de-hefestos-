/**
 * QuasarSED — el cuásar como sistema de PARTÍCULAS (plasma + nubes + fotones).
 *
 * Cada componente físico es una nube de partículas con distribución espacial
 * REAL (en log-r world coords para que todas las escalas convivan en un mismo
 * frame: BH ~ 1 r_g, disco ~ 100 r_g, BLR ~ 10⁴, torus ~ 10⁵, jet ~ 10⁶-10⁷).
 *
 * El brillo de cada partícula se LEE del tensor precomputado
 *   j[componente, log_ν, log_r]
 * con cara-Mellin radial × cara-Mellin espectral (Operador 𝔄, ver MHD_FROM_OPERATOR.md).
 *
 * Cuando arrastras el slider de log ν, mantienes la MISMA materia en su sitio
 * pero la ves "con otros ojos" — solo el componente físicamente activo en esa
 * banda emite. En radio solo el jet brilla; en IR el torus; en óptico/UV el
 * disco; en X la corona; en γ el jet IC.
 *
 * Refs: docs/QUASAR-PHYSICS-REFERENCE.md, RIAN/papers/operador_ian/.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import { createSedAudio, type SedAudioConfig } from './quasar-sed-audio';

interface SEDData {
  N_NU: number;
  N_R: number;
  N_C: number;
  logNuMin: number;
  logNuMax: number;
  logRMin: number;
  logRMax: number;
  components: string[];
  tensor: Float32Array;
}

async function loadSED(): Promise<SEDData> {
  const res = await fetch('/precomputed/quasar-sed.bin');
  if (!res.ok) throw new Error(`failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  const N_NU = dv.getUint32(0, true);
  const N_R  = dv.getUint32(4, true);
  const N_C  = dv.getUint32(8, true);
  const logNuMin = dv.getFloat32(16, true);
  const logNuMax = dv.getFloat32(20, true);
  const logRMin  = dv.getFloat32(24, true);
  const logRMax  = dv.getFloat32(28, true);
  const components: string[] = [];
  let off = 32;
  for (let i = 0; i < N_C; i++) {
    const slice = new Uint8Array(buf, off, 16);
    const z = slice.indexOf(0);
    components.push(new TextDecoder().decode(slice.subarray(0, z < 0 ? 16 : z)).trim());
    off += 16;
  }
  const tensor = new Float32Array(buf.slice(off));
  return { N_NU, N_R, N_C, logNuMin, logNuMax, logRMin, logRMax, components, tensor };
}

function lookup(data: SEDData, c: number, logNu: number, logR: number): number {
  const fNu = (logNu - data.logNuMin) / (data.logNuMax - data.logNuMin);
  const fR  = (logR  - data.logRMin)  / (data.logRMax  - data.logRMin);
  if (fNu < 0 || fNu > 1 || fR < 0 || fR > 1) return 0;
  const iνf = fNu * (data.N_NU - 1);
  const irf = fR  * (data.N_R  - 1);
  const iν  = Math.floor(iνf), iν1 = Math.min(iν + 1, data.N_NU - 1);
  const ir  = Math.floor(irf), ir1 = Math.min(ir + 1, data.N_R  - 1);
  const tν = iνf - iν, tr = irf - ir;
  const base = c * data.N_NU * data.N_R;
  const a = data.tensor[base + iν  * data.N_R + ir];
  const b = data.tensor[base + iν1 * data.N_R + ir];
  const cc = data.tensor[base + iν  * data.N_R + ir1];
  const d = data.tensor[base + iν1 * data.N_R + ir1];
  return (1-tν)*(1-tr)*a + tν*(1-tr)*b + (1-tν)*tr*cc + tν*tr*d;
}

// ── Generación de partículas por componente ──────────────────────────
//
// world coords:  y = log10(r/r_g) · sign(z_physical)
//                x, z = R_log · {cos φ, sin φ}  con R_log = log10(R/r_g)
// El BH queda en (0,0,0), disco equatorial en plano XZ, jet sale a ±Y.
//
// Esto comprime las 9 décadas de escala física a un volumen visualizable
// sin distorsionar las relaciones topológicas (disco equatorial, jet axial,
// etc).

interface ParticleSet {
  positions: Float32Array;   // N × 3
  compId:    Float32Array;   // N (0..N_C-1)
  logR:      Float32Array;   // N (used for tensor lookup)
  baseSize:  Float32Array;   // N (different sizes per component)
}

function buildParticles(): ParticleSet {
  const all: { x:number; y:number; z:number; c:number; logR:number; size:number }[] = [];

  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const gauss = () => { let s = 0; for (let i=0;i<3;i++) s += Math.random()-0.5; return s/1.5; };

  // 1. DISK — particles in equatorial plane, log-r distributed
  //    r ∈ [r_ISCO ≈ 2.3 r_g, 100 r_g] → log_r ∈ [0.36, 2.0]
  //    DENSIDAD ALTA para que se vea como un disco continuo, no puntos:
  //    distribución sesgada hacia el interior (r^(-3/4) emissivity weighting)
  for (let i = 0; i < 45000; i++) {
    // Sample logR with bias toward ISCO (hot inner edge)
    const u = Math.random();
    const logR_phys = 0.36 + (2.0 - 0.36) * Math.pow(u, 1.3);    // skewed inner
    const R_world = logR_phys + 0.4;
    const phi = rand(0, Math.PI * 2);
    const thinness = 0.035 * R_world;           // ~3.5% R (geometrically thin)
    all.push({
      x: R_world * Math.cos(phi),
      y: gauss() * thinness,
      z: R_world * Math.sin(phi),
      c: 0, logR: logR_phys,
      size: 0.55 + Math.random() * 0.4,
    });
  }

  // 2. CORONA — small puffy cloud above/below disk inner
  for (let i = 0; i < 9000; i++) {
    const logR_phys = 1.0 + gauss() * 0.28;
    const r = logR_phys + 0.4;
    const cosTheta = rand(-0.95, 0.95);
    const sinTheta = Math.sqrt(1 - cosTheta*cosTheta);
    const phi = rand(0, Math.PI * 2);
    all.push({
      x: r * sinTheta * Math.cos(phi),
      y: r * cosTheta + (cosTheta > 0 ? 0.18 : -0.18),
      z: r * sinTheta * Math.sin(phi),
      c: 1, logR: logR_phys,
      size: 0.7 + Math.random() * 0.6,
    });
  }

  // 3. REFLECTION — superficie iluminada del disco (densa, suave)
  for (let i = 0; i < 9000; i++) {
    const u = Math.random();
    const logR_phys = 0.36 + (1.5 - 0.36) * Math.pow(u, 1.4);
    const R_world = logR_phys + 0.4;
    const phi = rand(0, Math.PI * 2);
    all.push({
      x: R_world * Math.cos(phi),
      y: (Math.random() < 0.5 ? 1 : -1) * (0.04 + 0.05 * R_world),
      z: R_world * Math.sin(phi),
      c: 2, logR: logR_phys,
      size: 0.5 + Math.random() * 0.3,
    });
  }

  // 4. TORUS — thick doughnut at r_sub ≈ 10⁴.⁵ r_g
  for (let i = 0; i < 28000; i++) {
    const logR_phys = 4.5 + gauss() * 0.6;
    const R_world = logR_phys + 0.4;
    const phi = rand(0, Math.PI * 2);
    const tubeAng = rand(0, Math.PI * 2);
    const tubeR  = (0.20 + 0.30 * Math.random()) * Math.min(2.8, R_world * 0.28);
    const tubeOffR = tubeR * Math.cos(tubeAng);
    const tubeY    = tubeR * Math.sin(tubeAng);
    all.push({
      x: (R_world + tubeOffR) * Math.cos(phi),
      y: tubeY,
      z: (R_world + tubeOffR) * Math.sin(phi),
      c: 3, logR: logR_phys,
      size: 0.9 + Math.random() * 0.7,
    });
  }

  // 5. BLR — isotropic shell, ahora con MÁS clouds densas en clusters
  const N_BLR_CLUMPS = 18;
  const PARTICLES_PER_CLUMP = 800;
  for (let cl = 0; cl < N_BLR_CLUMPS; cl++) {
    const clumpLogR = 4.2 + gauss() * 0.35;
    const cosTheta = rand(-1, 1);
    const sinTheta = Math.sqrt(1 - cosTheta*cosTheta);
    const phi = rand(0, Math.PI * 2);
    const cR = clumpLogR + 0.4;
    const cx = cR * sinTheta * Math.cos(phi);
    const cy = cR * cosTheta;
    const cz = cR * sinTheta * Math.sin(phi);
    const clumpSize = 0.18 + 0.20 * Math.random();
    for (let i = 0; i < PARTICLES_PER_CLUMP; i++) {
      all.push({
        x: cx + gauss() * clumpSize,
        y: cy + gauss() * clumpSize,
        z: cz + gauss() * clumpSize,
        c: 4, logR: clumpLogR,
        size: 0.7 + Math.random() * 0.5,
      });
    }
  }

  // 6. JET SYNCHROTRON — bipolar parabolic, mucha más densidad
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 22000; i++) {
      const z_logR = rand(1.7, 7.0);
      const z_world = (z_logR + 0.4) * side;
      const widthScale = 0.16 * Math.pow(Math.pow(10, z_logR) / 50, 1/1.6) /
                          Math.pow(10, z_logR);
      const widthW = (widthScale + 0.04) * (1 + 0.5 * Math.abs(z_world));
      const phi = rand(0, Math.PI * 2);
      const r = widthW * Math.sqrt(Math.random()) * 1.3;
      const knotZ = [2.0, 2.6, 3.3, 4.0, 4.8, 5.7];
      let knotBoost = 0;
      for (const kz of knotZ) {
        knotBoost += Math.exp(-Math.pow((z_logR - kz)/0.15, 2)) * 1.4;
      }
      all.push({
        x: r * Math.cos(phi),
        y: z_world,
        z: r * Math.sin(phi),
        c: 5, logR: z_logR,
        size: 0.6 + Math.random() * 0.35 + knotBoost * 0.4,
      });
    }
  }

  // 7. JET IC — más compacto cerca de la base
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 8500; i++) {
      const z_logR = rand(1.7, 4.5);
      const z_world = (z_logR + 0.4) * side;
      const widthScale = 0.10 * Math.pow(Math.pow(10, z_logR) / 50, 1/1.6) /
                          Math.pow(10, z_logR);
      const widthW = (widthScale + 0.03);
      const phi = rand(0, Math.PI * 2);
      const r = widthW * Math.sqrt(Math.random());
      all.push({
        x: r * Math.cos(phi),
        y: z_world,
        z: r * Math.sin(phi),
        c: 6, logR: z_logR,
        size: 0.55 + Math.random() * 0.25,
      });
    }
  }

  const N = all.length;
  const positions = new Float32Array(N * 3);
  const compId    = new Float32Array(N);
  const logR      = new Float32Array(N);
  const baseSize  = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    positions[i*3+0] = all[i].x;
    positions[i*3+1] = all[i].y;
    positions[i*3+2] = all[i].z;
    compId[i]    = all[i].c;
    logR[i]      = all[i].logR;
    baseSize[i]  = all[i].size;
  }
  return { positions, compId, logR, baseSize };
}

// ── Campo magnético — líneas de campo Blandford-Znajek ───────────────
//
// Geometría: misma parabólica McKinney-Narayan z ∝ R^1.6 que usan las
// streamlines del jet (BZ monopole field anchored al horizonte, força-libre
// hasta el inflexion en luz-cilindro).
//
// Lo que renderizamos:
//   • LineSegments: ~50 field lines, cada una ~70 puntos → ~3500 segments
//   • Particles streaming along the lines: ~3000 puntos animados que se
//     desplazan a lo largo de B en cada frame. Brillo modulado por la
//     emisividad de jet_sync en banda radio (component 5 en el tensor).
//
// Refs: Blandford-Znajek 1977, McKinney-Narayan 2007.

/**
 * Operador 𝔄 aplicado al campo magnético del BH:
 *
 * Cada partícula tiene coords separables (line_idx, t). Las "line paths" son
 * una LUT 2D — DataTexture float que el shader samplea por (t, line_idx/N)
 * para obtener (x,y,z). El runtime es UN texture-lookup por vertex.
 *
 * CPU work per frame: 1 uniform update (uTime). Eso es todo.
 * Particle count: limitado solo por GPU triangle/line throughput → 60k+
 *
 * Líneas con cierre físico: ancla foot point al DISCO (no al horizonte).
 * Las field lines BZ no salen del horizonte directamente — el monopole
 * field se establece en el disco, frame-drag del BH las tuerce hacia +z y
 * forma el jet. Anclar al disco hace la GENERACIÓN visible.
 */
interface BFieldData {
  N_LINES:    number;
  N_PTS:      number;
  // Texture data for line paths (N_PTS × N_LINES × RGBA float, padding A=0)
  pathsTexData: Float32Array;
  // Static field lines (faint background overlay)
  linePositions: Float32Array;
  lineColors:    Float32Array;
  // Foot points: ring of small spheres at the disk anchoring each line
  footPositions: Float32Array;
  // GPU-instanced particle attributes (head+tail vertices per particle)
  N_PART:   number;
  pLineIdx: Float32Array;   // N_PART · 2
  pPhase:   Float32Array;   // N_PART · 2
  pSpeed:   Float32Array;   // N_PART · 2
  pIsKnot:  Float32Array;   // N_PART · 2
  pIsTail:  Float32Array;   // N_PART · 2  (0 = head, 1 = tail)
}

function buildBField(): BFieldData {
  // Bipolar: N_LINES_BASE únicas en (R_foot, phi), renderizadas en AMBOS
  // hemisferios → footpoint = Y-junction (no más X-pattern feo de alternación).
  const N_LINES_BASE = 40;
  const N_LINES = N_LINES_BASE * 2;     // 80 visible = 40 up + 40 mirrored down
  const N_PTS   = 96;
  const linePaths   = new Float32Array(N_LINES * N_PTS * 3);
  const footPositions = new Float32Array(N_LINES_BASE * 3);  // foot único por par bipolar

  // Frame-dragging: spin retuerce el campo azimutalmente. Calibrado para
  // que el twist sea VISIBLE cerca del disco pero NO domine el look entero
  // (antes 0.55 + decay 5 → reloj de arena, demasiado uniforme).
  // Ahora: twist suave cerca de la base, líneas casi rectas en el campo lejano.
  const omega_drag_base = 0.18;          // rad/world_z (3× menos)
  const omega_decay = 2.0;                // decae más rápido (cuasi-asíntota libre)

  // Hash determinista por línea para jitter reproducible (no Math.random
  // porque queremos el mismo "look" en cada deploy)
  const jitter = (li: number, axis: number) => {
    const h = (li * 374761393 + axis * 668265263) >>> 0;
    return ((h * 1103515245 + 12345) >>> 0) / 0xFFFFFFFF - 0.5;     // ∈ [-0.5, 0.5]
  };

  // VOGEL SUNFLOWER (golden angle) para foot points: KAM-stable rotational
  // transform → física honrada de tokamak/MHD optimum confinement.
  //   θ_n = n · 2π / φ²   (φ = 1.618...)
  //   golden angle ≈ 137.508°
  // Radio crece sub-lineal como en sunflower: r_n = c·√n
  const PHI = (1 + Math.sqrt(5)) / 2;
  const GOLDEN_ANGLE = 2 * Math.PI / (PHI * PHI);      // ≈ 137.508°

  for (let li = 0; li < N_LINES; li++) {
    const base = li % N_LINES_BASE;
    const side = (li < N_LINES_BASE) ? 1 : -1;     // primera mitad sube, segunda baja
    // Vogel: phi_n = n · golden_angle (mod 2π implícito en cos/sin)
    const phi0 = base * GOLDEN_ANGLE;
    // Radio en distribución sunflower: r = R_min + (R_max-R_min) · √(n/N)
    // Esto da la disposición más densa-uniforme posible (KAM optimum)
    const u = base / N_LINES_BASE;
    const R_foot_logR = 0.5 + 1.28 * Math.sqrt(u) + jitter(base, 0) * 0.06;
    const R_foot_world = R_foot_logR + 0.3;

    // Jitter per-line para romper uniformidad (current sheets reales son caóticas)
    const line_twist_mult = 0.75 + jitter(base, 1) * 0.5;    // 0.50–1.00 × base
    const line_R_mult     = 0.85 + jitter(base, 2) * 0.3;    // 0.70–1.00 × base
    const line_phase_offset = jitter(base, 3) * 0.4;          // sutil shift en phi

    if (li < N_LINES_BASE) {
      footPositions[base * 3 + 0] = R_foot_world * Math.cos(phi0);
      footPositions[base * 3 + 1] = 0;
      footPositions[base * 3 + 2] = R_foot_world * Math.sin(phi0);
    }

    for (let i = 0; i < N_PTS; i++) {
      const t = i / (N_PTS - 1);
      const z_max_world = 7.0;
      const z_abs = 0.04 + (z_max_world - 0.04) * Math.pow(t, 1.0);
      const z_world = side * z_abs;

      const R_world = R_foot_world + 0.22 * line_R_mult * Math.pow(z_abs, 0.7);

      // Twist suavizado: solo notable cerca del disco, decae rápido al campo lejano
      const twist = omega_drag_base * line_twist_mult * z_abs * Math.exp(-z_abs / omega_decay);
      const phi = phi0 + line_phase_offset + side * twist;

      linePaths[(li * N_PTS + i) * 3 + 0] = R_world * Math.cos(phi);
      linePaths[(li * N_PTS + i) * 3 + 1] = z_world;
      linePaths[(li * N_PTS + i) * 3 + 2] = R_world * Math.sin(phi);
    }
  }

  // Texture data: pack into RGBA (alpha unused). Layout (N_PTS, N_LINES)
  const pathsTexData = new Float32Array(N_PTS * N_LINES * 4);
  for (let li = 0; li < N_LINES; li++) {
    for (let i = 0; i < N_PTS; i++) {
      // Row major: y = li (height), x = i (width)
      // index in tex = (li * N_PTS + i) * 4
      const tIdx = (li * N_PTS + i) * 4;
      const lIdx = (li * N_PTS + i) * 3;
      pathsTexData[tIdx + 0] = linePaths[lIdx + 0];
      pathsTexData[tIdx + 1] = linePaths[lIdx + 1];
      pathsTexData[tIdx + 2] = linePaths[lIdx + 2];
      pathsTexData[tIdx + 3] = 0;
    }
  }

  // Static lines for background reference (much fewer points)
  const N_SEG = N_LINES * (N_PTS - 1);
  const linePositions = new Float32Array(N_SEG * 2 * 3);
  const lineColors    = new Float32Array(N_SEG * 2 * 3);
  for (let li = 0; li < N_LINES; li++) {
    for (let i = 0; i < N_PTS - 1; i++) {
      const seg = li * (N_PTS - 1) + i;
      const off = seg * 6;
      const aIdx = (li * N_PTS + i) * 3;
      const bIdx = (li * N_PTS + (i+1)) * 3;
      linePositions[off+0] = linePaths[aIdx+0];
      linePositions[off+1] = linePaths[aIdx+1];
      linePositions[off+2] = linePaths[aIdx+2];
      linePositions[off+3] = linePaths[bIdx+0];
      linePositions[off+4] = linePaths[bIdx+1];
      linePositions[off+5] = linePaths[bIdx+2];
      const fade = Math.max(0.06, 1.0 - i / (N_PTS - 1) * 0.85);
      lineColors[off+0] = 0.40 * fade;
      lineColors[off+1] = 0.70 * fade;
      lineColors[off+2] = 1.00 * fade;
      lineColors[off+3] = 0.40 * fade;
      lineColors[off+4] = 0.70 * fade;
      lineColors[off+5] = 1.00 * fade;
    }
  }

  // GPU-instanced particles: 28,000 streaks (2 vertices each = 56k verts)
  // Densidad ajustada para no saturar additive blending — con tanto particle
  // el alpha per-particle debe ser bajo (~0.10–0.15).
  const N_PART = 28000;
  const pLineIdx = new Float32Array(N_PART * 2);
  const pPhase   = new Float32Array(N_PART * 2);
  const pSpeed   = new Float32Array(N_PART * 2);
  const pIsKnot  = new Float32Array(N_PART * 2);
  const pIsTail  = new Float32Array(N_PART * 2);
  for (let i = 0; i < N_PART; i++) {
    const li = Math.floor(Math.random() * N_LINES);
    const phase = Math.random();
    const speed = 0.45 + 0.5 * Math.random();        // 0.45–0.95 t/sec
    const isKnot = (Math.random() < 0.08) ? 1 : 0;   // 8% son knot particles
    // Two vertices (head, tail)
    pLineIdx[i*2+0] = li;            pLineIdx[i*2+1] = li;
    pPhase[i*2+0]   = phase;         pPhase[i*2+1]   = phase;
    pSpeed[i*2+0]   = speed;         pSpeed[i*2+1]   = speed;
    pIsKnot[i*2+0]  = isKnot;        pIsKnot[i*2+1]  = isKnot;
    pIsTail[i*2+0]  = 0;             pIsTail[i*2+1]  = 1;
  }

  return {
    N_LINES, N_PTS,
    pathsTexData,
    linePositions, lineColors,
    footPositions,
    N_PART, pLineIdx, pPhase, pSpeed, pIsKnot, pIsTail,
  };
}

// ── Component colors (visible in legend) ─────────────────────────────
const COMP_COLOR_HEX = [
  '#FFE08A',   // 0 disk    — UV/optical, warm gold
  '#A8E0FF',   // 1 corona  — soft X, ice blue
  '#FF7B5A',   // 2 reflect — hard X reflection, fiery orange
  '#FFB070',   // 3 torus   — mid-IR, warm amber
  '#FF6F9A',   // 4 BLR     — emission lines, pink
  '#6FB5FF',   // 5 jet sync — radio, blue
  '#C97FFF',   // 6 jet IC  — gamma, violet
];
const COMP_LABELS = ['disco', 'corona', 'reflection', 'torus polvo', 'BLR (líneas)', 'jet sincrotrón', 'jet IC γ'];

// ── Points mesh ──────────────────────────────────────────────────────
function ParticleQuasar({ data, logNu, particles }: { data: SEDData; logNu: number; particles: ParticleSet }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const brightnessRef = useRef<Float32Array | null>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  // Pre-build color palette uniform (vec3 array)
  const colorPalette = useMemo(() => {
    return COMP_COLOR_HEX.map(hex => {
      const c = new THREE.Color(hex);
      return new THREE.Vector3(c.r, c.g, c.b);
    });
  }, []);

  // Initialize brightness buffer
  useMemo(() => {
    brightnessRef.current = new Float32Array(particles.compId.length);
  }, [particles]);

  // Recompute brightness when logNu changes
  useEffect(() => {
    if (!brightnessRef.current || !geomRef.current) return;
    const N = particles.compId.length;
    for (let i = 0; i < N; i++) {
      const c = particles.compId[i] | 0;
      const lr = particles.logR[i];
      brightnessRef.current[i] = lookup(data, c, logNu, lr);
    }
    // Normalize to bring out per-frame contrast
    let maxB = 0;
    for (let i = 0; i < N; i++) if (brightnessRef.current[i] > maxB) maxB = brightnessRef.current[i];
    if (maxB > 0) {
      for (let i = 0; i < N; i++) brightnessRef.current[i] /= maxB;
    }
    const attr = geomRef.current.attributes.brightness as THREE.BufferAttribute;
    attr.needsUpdate = true;
  }, [data, logNu, particles]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = clock.elapsedTime;
    }
  });

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position"   args={[particles.positions, 3]} count={particles.compId.length} itemSize={3} array={particles.positions} />
        <bufferAttribute attach="attributes-compId"     args={[particles.compId,    1]} count={particles.compId.length} itemSize={1} array={particles.compId} />
        <bufferAttribute attach="attributes-baseSize"   args={[particles.baseSize,  1]} count={particles.compId.length} itemSize={1} array={particles.baseSize} />
        <bufferAttribute attach="attributes-brightness" args={[brightnessRef.current!, 1]} count={particles.compId.length} itemSize={1} array={brightnessRef.current!} />
      </bufferGeometry>
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={{
          uTime: { value: 0 },
          uPixelRatio: { value: window.devicePixelRatio },
          uColors: { value: colorPalette },
        }}
        vertexShader={`
          attribute float compId;
          attribute float baseSize;
          attribute float brightness;
          uniform float uTime;
          uniform float uPixelRatio;
          uniform vec3 uColors[7];
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            int cId = int(compId + 0.5);
            vec3 base = uColors[cId];
            float vis = pow(brightness, 0.45);
            vColor = base * (0.32 + 0.78 * vis);
            // ~165k partículas — alpha bajo individual + densidad alta = continuous look
            vAlpha = clamp(vis * 0.32 + 0.022, 0.022, 0.55);

            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            float dist = -mv.z;
            float sz = baseSize * (1.0 + 1.4 * vis) * 16.0 * uPixelRatio / dist;
            gl_PointSize = clamp(sz, 1.0, 22.0);
            gl_Position = projectionMatrix * mv;
          }
        `}
        fragmentShader={`
          varying vec3 vColor;
          varying float vAlpha;
          void main() {
            vec2 d = gl_PointCoord - vec2(0.5);
            float r2 = dot(d, d);
            if (r2 > 0.25) discard;
            // Falloff más suave (12 → 8) → bordes blandos, las partículas se fusionan
            float fall = exp(-r2 * 8.0);
            gl_FragColor = vec4(vColor * fall, vAlpha * fall);
          }
        `}
      />
    </points>
  );
}

// ── Magnetic field component (GPU-driven, 60k partículas) ─────────────
function MagneticField({ data, logNu, bField, visible }: {
  data: SEDData;
  logNu: number;
  bField: BFieldData;
  visible: boolean;
}) {
  const matStreakRef = useRef<THREE.ShaderMaterial>(null);
  const matLineRef = useRef<THREE.LineBasicMaterial>(null);
  const matFootRef = useRef<THREE.ShaderMaterial>(null);

  // Build DataTexture for line paths (RGBA float)
  const pathsTexture = useMemo(() => {
    const tex = new THREE.DataTexture(
      bField.pathsTexData,
      bField.N_PTS,
      bField.N_LINES,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [bField]);

  // Synchrotron boost
  const synchroIntensity = useMemo(() => {
    let max = 0;
    for (let ir = 0; ir < data.N_R; ir++) {
      const logR = data.logRMin + ir * (data.logRMax - data.logRMin) / (data.N_R - 1);
      const v = lookup(data, 5, logNu, logR);
      if (v > max) max = v;
    }
    return Math.min(1, max * 4);
  }, [data, logNu]);

  useEffect(() => {
    if (matLineRef.current) matLineRef.current.opacity = 0.12 + 0.45 * synchroIntensity;
  }, [synchroIntensity]);

  // Per-frame uniform updates only (zero CPU per-particle work)
  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.elapsedTime;
    if (matStreakRef.current) {
      matStreakRef.current.uniforms.uTime.value = t;
      matStreakRef.current.uniforms.uSyncBoost.value = synchroIntensity;
    }
    if (matFootRef.current) {
      matFootRef.current.uniforms.uTime.value = t;
      matFootRef.current.uniforms.uSyncBoost.value = synchroIntensity;
    }
  });

  if (!visible) return null;

  return (
    <group>
      {/* Static field lines (faint background, shows the geometry) */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bField.linePositions, 3]}
                           count={bField.linePositions.length / 3} itemSize={3} array={bField.linePositions} />
          <bufferAttribute attach="attributes-color"    args={[bField.lineColors, 3]}
                           count={bField.lineColors.length / 3} itemSize={3} array={bField.lineColors} />
        </bufferGeometry>
        <lineBasicMaterial
          ref={matLineRef}
          vertexColors
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* Foot points: bright pulsing dots at the disk anchor of each line */}
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bField.footPositions, 3]}
                           count={bField.footPositions.length / 3} itemSize={3} array={bField.footPositions} />
        </bufferGeometry>
        <shaderMaterial
          ref={matFootRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime:       { value: 0 },
            uSyncBoost:  { value: 0 },
            uPixelRatio: { value: window.devicePixelRatio },
          }}
          vertexShader={`
            uniform float uTime;
            uniform float uSyncBoost;
            uniform float uPixelRatio;
            varying float vAlpha;
            void main() {
              // Pulsing: cada foot point pulsa con period ~1.2s, fase basada en posición
              float phase = position.x * 7.0 + position.z * 3.3;
              float pulse = 0.5 + 0.5 * sin(uTime * 4.5 + phase);
              vAlpha = (0.4 + 0.6 * pulse) * (0.5 + 0.8 * uSyncBoost);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              float dist = -mv.z;
              gl_PointSize = clamp(16.0 * uPixelRatio * (1.0 + pulse) / dist, 2.0, 24.0);
              gl_Position = projectionMatrix * mv;
            }
          `}
          fragmentShader={`
            varying float vAlpha;
            void main() {
              vec2 d = gl_PointCoord - vec2(0.5);
              float r2 = dot(d, d);
              if (r2 > 0.25) discard;
              float fall = exp(-r2 * 16.0);
              // Cyan-white: foot is the line generation point
              vec3 col = vec3(0.8, 0.95, 1.0);
              gl_FragColor = vec4(col * fall, vAlpha * fall);
            }
          `}
        />
      </points>

      {/* Plasma streaks: 60k particles, GPU-driven via DataTexture lookup */}
      <lineSegments>
        <bufferGeometry>
          {/* dummy position attribute required by Three.js; pos computed in shader */}
          <bufferAttribute attach="attributes-position" args={[new Float32Array(bField.N_PART * 2 * 3), 3]}
                           count={bField.N_PART * 2} itemSize={3} array={new Float32Array(bField.N_PART * 2 * 3)} />
          <bufferAttribute attach="attributes-lineIdx" args={[bField.pLineIdx, 1]}
                           count={bField.N_PART * 2} itemSize={1} array={bField.pLineIdx} />
          <bufferAttribute attach="attributes-phase"   args={[bField.pPhase, 1]}
                           count={bField.N_PART * 2} itemSize={1} array={bField.pPhase} />
          <bufferAttribute attach="attributes-pSpeed"  args={[bField.pSpeed, 1]}
                           count={bField.N_PART * 2} itemSize={1} array={bField.pSpeed} />
          <bufferAttribute attach="attributes-isKnot"  args={[bField.pIsKnot, 1]}
                           count={bField.N_PART * 2} itemSize={1} array={bField.pIsKnot} />
          <bufferAttribute attach="attributes-isTail"  args={[bField.pIsTail, 1]}
                           count={bField.N_PART * 2} itemSize={1} array={bField.pIsTail} />
        </bufferGeometry>
        <shaderMaterial
          ref={matStreakRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={{
            uTime:       { value: 0 },
            uSyncBoost:  { value: 0 },
            uPaths:      { value: pathsTexture },
            uN_LINES:    { value: bField.N_LINES },
          }}
          vertexShader={`
            attribute float lineIdx;
            attribute float phase;
            attribute float pSpeed;
            attribute float isKnot;
            attribute float isTail;
            uniform float uTime;
            uniform float uSyncBoost;
            uniform sampler2D uPaths;
            uniform float uN_LINES;
            varying vec3 vColor;
            varying float vAlpha;

            const float STREAK_DT = 0.20;        // streak length in t-space
            const float BURST_PERIOD = 1.6;      // sec entre knot bursts
            const float BURST_WINDOW = 0.35;     // fraction with active knots

            void main() {
              // tail está 'detrás' del head en la línea
              float dt_back = isTail * STREAK_DT;
              float t = mod(uTime * pSpeed + phase - dt_back, 1.0);

              // Knot burst: durante BURST_WINDOW del ciclo, los knots se respawnean
              // cerca de la base con velocidad alta. Modelamos como: si isKnot y
              // estamos en burst window, comprimimos t para que esté cerca de 0.
              float burstT = mod(uTime / BURST_PERIOD, 1.0);
              float inBurst = step(burstT, BURST_WINDOW);
              float knotActive = isKnot * inBurst;
              // Re-map t for active knots: hace que t avance mucho rápido desde 0
              float t_knot = burstT / BURST_WINDOW * 0.7;      // recorre 70% de la línea
              t = mix(t, mod(t_knot * pSpeed * 2.0 + phase * 0.1 - dt_back, 1.0), knotActive);

              // Sample line path texture
              vec2 uv = vec2(t, (lineIdx + 0.5) / uN_LINES);
              vec3 pos = texture2D(uPaths, uv).xyz;

              // Color: bright head, dim tail. Knots = white-hot when active.
              vec3 base = vec3(0.55, 0.85, 1.0);
              vec3 hot  = vec3(1.00, 1.00, 0.95);
              vec3 col  = mix(base, hot, knotActive * 0.85);

              float headBright = mix(1.0, 0.15, isTail);   // tail visible trail
              float syncLift   = 0.18 + 0.55 * uSyncBoost;
              float knotLift   = 1.0 + knotActive * 2.2;
              vColor = col * headBright * syncLift * knotLift;
              vAlpha = 0.10 + 0.18 * uSyncBoost + knotActive * 0.35;

              gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vColor;
            varying float vAlpha;
            void main() { gl_FragColor = vec4(vColor, vAlpha); }
          `}
        />
      </lineSegments>
    </group>
  );
}

// ── Central BH — small black sphere with photon ring outline ────────
function CentralBH() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[0.12, 24, 18]} />
        <meshBasicMaterial color="#000" />
      </mesh>
    </group>
  );
}

// ── SED Graph overlay ─────────────────────────────────────────────────
function SEDGraph({ data, logNu, setLogNu }: { data: SEDData; logNu: number; setLogNu: (v: number) => void }) {
  const curves = useMemo(() => {
    const colors = COMP_COLOR_HEX;
    const out: { name: string; color: string; points: { x: number; y: number }[]; max: number }[] = [];
    for (let c = 0; c < data.N_C; c++) {
      const vals: number[] = [];
      let maxV = 0;
      for (let iν = 0; iν < data.N_NU; iν++) {
        let sum = 0;
        for (let ir = 0; ir < data.N_R; ir++) {
          sum += data.tensor[c * data.N_NU * data.N_R + iν * data.N_R + ir];
        }
        vals.push(sum);
        if (sum > maxV) maxV = sum;
      }
      const points = vals.map((v, i) => ({
        x: data.logNuMin + i * (data.logNuMax - data.logNuMin) / (data.N_NU - 1),
        y: v / Math.max(1e-30, maxV),
      }));
      out.push({ name: data.components[c], color: colors[c], points, max: maxV });
    }
    return out;
  }, [data]);

  // Dominant component at current ν
  const dominant = useMemo(() => {
    let bestC = -1, bestV = -Infinity;
    for (let c = 0; c < data.N_C; c++) {
      let v = 0;
      for (let ir = 0; ir < data.N_R; ir++) {
        const logR = data.logRMin + ir * (data.logRMax - data.logRMin) / (data.N_R - 1);
        v += lookup(data, c, logNu, logR);
      }
      if (v > bestV) { bestV = v; bestC = c; }
    }
    return bestC;
  }, [data, logNu]);

  const w = 580, h = 130, padX = 40, padY = 14;
  const x = (lν: number) => padX + ((lν - data.logNuMin) / (data.logNuMax - data.logNuMin)) * (w - padX - 14);
  const y = (v: number) => h - padY - v * (h - padY - 18);

  const bandLabels = [
    { lν: 9,  label: 'radio' },
    { lν: 12, label: 'sub-mm' },
    { lν: 14, label: 'IR' },
    { lν: 15, label: 'óptico' },
    { lν: 16, label: 'UV' },
    { lν: 17, label: 'soft X' },
    { lν: 19, label: 'hard X' },
    { lν: 22, label: 'γ' },
  ];

  const nu_now = Math.pow(10, logNu);
  const E_keV = 6.626e-27 * nu_now / 1.602e-12 / 1000;
  const wavelength_m = 2.998e8 / nu_now;
  let wavestr = '';
  if (E_keV > 0.5)                    wavestr = `${E_keV.toFixed(2)} keV`;
  else if (wavelength_m > 1e-3)       wavestr = `λ ${(wavelength_m*1000).toFixed(1)} mm`;
  else if (wavelength_m > 1e-6)       wavestr = `λ ${(wavelength_m*1e6).toFixed(2)} μm`;
  else if (wavelength_m > 1e-9)       wavestr = `λ ${(wavelength_m*1e9).toFixed(0)} nm`;
  else                                wavestr = `λ ${(wavelength_m*1e10).toExponential(1)} Å`;

  // Band descriptors — qué pasa físicamente en cada banda + qué se observa
  const bandInfo = (lν: number): { name: string; what: string } => {
    if (lν < 10)        return { name: 'Radio',    what: 'sincrotrón del jet (VLBA, ALMA observan aquí)' };
    if (lν < 13)        return { name: 'Sub-mm',   what: 'polvo frío del torus + sincrotrón self-absorbed' };
    if (lν < 14.5)      return { name: 'Infrarrojo',what: 'polvo caliente del torus (sublimación 1500 K)' };
    if (lν < 15.7)      return { name: 'Óptico',   what: 'disco S-S Big Blue Bump + líneas BLR (Hα, Hβ)' };
    if (lν < 16.5)      return { name: 'UV',       what: 'pico del disco (~10⁵ K) + Lyα BLR' };
    if (lν < 17.5)      return { name: 'Soft X',   what: 'corona warm + reflection ionizado' };
    if (lν < 20)        return { name: 'Hard X',   what: 'corona Compton + Fe-Kα + Compton hump 30 keV' };
    return                     { name: 'Gamma',    what: 'jet IC (SSC + EC) — Fermi-LAT, HESS observan aquí' };
  };
  const cur = bandInfo(logNu);

  // Gradient de color real del espectro EM (mapeo educacional, no físico)
  // bajo el slider para que sea OBVIO qué estás moviendo
  const spectrumGradient =
    'linear-gradient(to right, ' +
    '#5D2A7A 0%, '       +     // radio violeta-oscuro
    '#7B3FB3 8%, '       +     // sub-mm
    '#B53E6F 22%, '      +     // far-IR
    '#FF6F4A 39%, '      +     // mid-IR / near-IR
    '#FFB845 47%, '      +     // óptico amarillo
    '#FFE680 51%, '      +     // óptico
    '#A8E5FF 60%, '      +     // UV
    '#5B9DFF 70%, '      +     // soft X
    '#4870D9 82%, '      +     // hard X
    '#7A3FE0 95%, '      +     // gamma
    '#FFFFFF 100%)';            // gamma alto

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/85 border border-[#334155] rounded-lg p-4 font-mono backdrop-blur-sm shadow-2xl" style={{ width: w + 24 }}>
      {/* Header: qué se está viendo + por qué */}
      <div className="flex items-baseline justify-between mb-2.5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#64748B]">arrastra el slider · barre el espectro</div>
          <div className="text-[16px] font-semibold mt-0.5">
            <span style={{ color: COMP_COLOR_HEX[dominant] }}>{cur.name}</span>
            <span className="text-[#475569] text-[11px] ml-2">· {wavestr} · {nu_now.toExponential(1)} Hz</span>
          </div>
          <div className="text-[11px] text-[#94A3B8] mt-0.5">{cur.what}</div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase tracking-wider text-[#64748B]">dominante</div>
          <div className="text-[13px] font-semibold" style={{ color: COMP_COLOR_HEX[dominant] }}>
            {COMP_LABELS[dominant]}
          </div>
        </div>
      </div>

      {/* SED curve graph */}
      <svg width={w} height={h} style={{ display: 'block' }}>
        {bandLabels.map(b => (
          <g key={b.lν}>
            <line x1={x(b.lν)} y1={padY} x2={x(b.lν)} y2={h - padY} stroke="#1e293b" strokeWidth={1} />
            <text x={x(b.lν)} y={h - 2} fontSize={9} fill="#64748b" textAnchor="middle">{b.label}</text>
          </g>
        ))}
        {curves.map((c, i) => (
          <polyline
            key={c.name}
            fill="none"
            stroke={c.color}
            strokeWidth={i === dominant ? 2 : 1.2}
            strokeOpacity={i === dominant ? 1 : 0.5}
            points={c.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')}
          />
        ))}
        <line x1={x(logNu)} y1={padY} x2={x(logNu)} y2={h - padY} stroke="#FFE5A0" strokeWidth={1.8} />
      </svg>

      {/* Spectrum bar (gradient) + slider directly above */}
      <div className="relative mt-2" style={{ height: 28 }}>
        <div
          className="absolute inset-x-0 top-3 h-3 rounded-full pointer-events-none"
          style={{ background: spectrumGradient, opacity: 0.85 }}
        />
        <input
          type="range"
          min={data.logNuMin}
          max={data.logNuMax}
          step={0.01}
          value={logNu}
          onChange={(e) => setLogNu(parseFloat(e.target.value))}
          className="absolute inset-x-0 top-0 w-full h-7 appearance-none bg-transparent accent-[#FFE5A0] cursor-pointer"
          style={{ WebkitAppearance: 'none' }}
        />
      </div>
    </div>
  );
}

// ── Legend ────────────────────────────────────────────────────────────
function Legend({
  showB, setShowB, audioOn, setAudioOn, onGWChirp,
}: {
  showB: boolean; setShowB: (b: boolean) => void;
  audioOn: boolean; setAudioOn: (b: boolean) => void;
  onGWChirp: () => void;
}) {
  return (
    <div className="absolute top-6 right-6 bg-black/65 border border-[#334155] rounded p-2 font-mono text-[10px] backdrop-blur-sm">
      <div className="text-[#94A3B8] mb-1.5 text-[9px] uppercase tracking-wider">componentes</div>
      {COMP_COLOR_HEX.map((col, i) => (
        <div key={i} className="flex items-center gap-2 leading-tight">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: col, boxShadow: `0 0 8px ${col}` }} />
          <span style={{ color: col }}>{COMP_LABELS[i]}</span>
        </div>
      ))}
      <div className="mt-2 pt-2 border-t border-[#334155]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showB}
            onChange={(e) => setShowB(e.target.checked)}
            className="accent-[#8FCEFF]"
          />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#8FCEFF', boxShadow: '0 0 8px #8FCEFF' }} />
          <span style={{ color: '#8FCEFF' }}>campo B (Blandford-Znajek)</span>
        </label>
        <div className="text-[#475569] text-[9px] mt-1 leading-tight max-w-[180px]">
          líneas de campo + plasma streaming. brilla en banda radio (sincrotrón).
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-[#334155]">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={audioOn}
            onChange={(e) => setAudioOn(e.target.checked)}
            className="accent-[#FFD46B]"
          />
          <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#FFD46B', boxShadow: '0 0 8px #FFD46B' }} />
          <span style={{ color: '#FFD46B' }}>audio · sonificación SED</span>
        </label>
        <div className="text-[#475569] text-[9px] mt-1 leading-tight max-w-[180px]">
          cada componente físico es un timbre. volumen = emisión a la ν actual.
          knot bursts cada 1.6s = kick drum sub-bass.
        </div>
        <button
          onClick={onGWChirp}
          disabled={!audioOn}
          className="mt-2 w-full px-2 py-1 border border-[#9F7FFF] text-[#9F7FFF] hover:bg-[#9F7FFF]/15 disabled:opacity-30 disabled:cursor-not-allowed rounded text-[10px]"
          title="GW150914-like binary BH merger chirp: 30 Hz → 250 Hz inspiral + 220 Hz ringdown"
        >
          ⚡ GW chirp (binary BH merger)
        </button>
      </div>
    </div>
  );
}

// ── Scene ────────────────────────────────────────────────────────────
function Scene({ data, logNu, particles, bField, showB }: {
  data: SEDData; logNu: number; particles: ParticleSet; bField: BFieldData; showB: boolean;
}) {
  return (
    <>
      <CentralBH />
      <MagneticField data={data} logNu={logNu} bField={bField} visible={showB} />
      <ParticleQuasar data={data} logNu={logNu} particles={particles} />
    </>
  );
}

const gl = makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });

function QuasarSED() {
  const [data, setData] = useState<SEDData | null>(null);
  const [logNu, setLogNu] = useState(15.2);
  const [showB, setShowB] = useState(true);
  const [audioOn, setAudioOn] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const audioRef = useRef<SedAudioConfig | null>(null);
  const knotTimerRef = useRef<number | null>(null);

  useEffect(() => {
    loadSED().then(setData).catch(e => setErr(String(e)));
  }, []);

  // Toggle audio. Init/destroy synchronous en el click handler para que
  // el browser cuente como user gesture (Web Audio policy).
  const toggleAudio = (on: boolean) => {
    if (on && !audioRef.current) {
      try {
        audioRef.current = createSedAudio();
        // Re-call resume defensively (some browsers requieren múltiple)
        if (audioRef.current.ctx.state === 'suspended') {
          audioRef.current.ctx.resume().catch(() => { /* ignore */ });
        }
        const tick = () => {
          if (audioRef.current) audioRef.current.triggerKnotBurst();
        };
        knotTimerRef.current = window.setInterval(tick, 1600);
      } catch (e) { console.error('audio init fail', e); }
    } else if (!on && audioRef.current) {
      if (knotTimerRef.current) { clearInterval(knotTimerRef.current); knotTimerRef.current = null; }
      audioRef.current.destroy();
      audioRef.current = null;
    }
    setAudioOn(on);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (knotTimerRef.current) clearInterval(knotTimerRef.current);
      audioRef.current?.destroy();
      audioRef.current = null;
    };
  }, []);

  // Update audio channel intensities + spectrum scanner pitch when logNu or data changes
  useEffect(() => {
    if (!audioRef.current || !data) return;
    for (let c = 0; c < data.N_C; c++) {
      let max = 0;
      for (let ir = 0; ir < data.N_R; ir++) {
        const logR = data.logRMin + ir * (data.logRMax - data.logRMin) / (data.N_R - 1);
        const v = lookup(data, c, logNu, logR);
        if (v > max) max = v;
      }
      audioRef.current.setIntensity(c, Math.min(1, max * 5));
    }
    audioRef.current.setLogNu(logNu);
  }, [data, logNu]);

  // Generate particles ONCE (heavy: ~38k)
  const particles = useMemo(() => buildParticles(), []);
  const bField    = useMemo(() => buildBField(), []);

  if (err)  return <div className="text-red-400 p-6 font-mono">SED load failed: {err}</div>;
  if (!data) return <div className="text-[#94A3B8] p-6 font-mono">loading SED tensor…</div>;

  return (
    <div className="w-full h-full relative" style={{ background: '#05060A' }}>
      <Canvas
        camera={{ position: [6, 3, 9], fov: 50, near: 0.001, far: 200 }}
        gl={gl}
        dpr={[0.55, 1]}
      >
        <Scene data={data} logNu={logNu} particles={particles} bField={bField} showB={showB} />
        <OrbitControls
          enablePan={false}
          enableZoom
          autoRotate
          autoRotateSpeed={0.14}
          minDistance={2}
          maxDistance={30}
        />
        <EffectComposer>
          <Bloom intensity={1.1} luminanceThreshold={0.25} luminanceSmoothing={0.7} radius={0.85} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] max-w-md space-y-1 pointer-events-none">
        <div className="text-[#FFE5A0] font-semibold">Quasar SED · Operador 𝔄</div>
        <div>M_BH = 10⁹ M☉ · Ṁ = 0.1·Ṁ_Edd · a* = 0.9</div>
        <div className="text-[10px] text-[#475569] mt-2 leading-snug max-w-sm">
          ~38k partículas. La posición (en log r world) es FIJA — disco
          equatorial, corona arriba/abajo, BLR shell, torus polvo,
          jet bipolar parabólico (z ∝ R^1.6). El brillo lee tensor
          j[componente, log ν, log r] vía cara-Mellin doble. Arrastra el
          slider para ver el cuásar en cada banda.
        </div>
      </div>

      <Legend
        showB={showB} setShowB={setShowB}
        audioOn={audioOn} setAudioOn={toggleAudio}
        onGWChirp={() => audioRef.current?.triggerGWChirp()}
      />
      <SEDGraph data={data} logNu={logNu} setLogNu={setLogNu} />
    </div>
  );
}

export default memo(QuasarSED);
