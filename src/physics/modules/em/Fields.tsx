/**
 * Electromagnetism — Coulomb + Biot-Savart + Lorentz.
 *
 *   Presets te muestran la realidad:
 *     - dipolo      → campo E con líneas que nacen + mueren
 *     - capacitor   → E casi uniforme entre dos placas
 *     - wire        → B circulando alrededor de una corriente
 *     - cyclotron   → una partícula cargada girando en un B axial
 *
 *   Sin tutoriales: todo el conocimiento sale del campo dibujado y
 *   las invariantes en vivo.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import {
  fieldE, fieldB, traceFieldLine, lorentzStep,
  type PointCharge, type CurrentSegment, type TestParticle, type Vec3,
} from '@/lib/physics/em';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';

interface EMScene {
  charges: PointCharge[];
  segments: CurrentSegment[];
  particle?: TestParticle;
  /** Uniform background B field (T). Used to model a large solenoid/dipole
   *  coil that would be impractical to draw as individual current segments. */
  bgB?: Vec3;
  extentM: number;
  name: string;
}

function presetDipole(): EMScene {
  return {
    name: 'Dipolo eléctrico',
    charges: [
      { id: '+', q:  1e-9, pos: [-0.1, 0, 0], color: '#E27B58' },
      { id: '−', q: -1e-9, pos: [ 0.1, 0, 0], color: '#4FC3F7' },
    ],
    segments: [],
    extentM: 0.5,
  };
}
function presetCapacitor(): EMScene {
  const charges: PointCharge[] = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const y = (i - (N-1)/2) * 0.03;
    charges.push({ id:`+${i}`, q: +1e-10, pos: [-0.1, y, 0], color: '#E27B58' });
    charges.push({ id:`-${i}`, q: -1e-10, pos: [ 0.1, y, 0], color: '#4FC3F7' });
  }
  return { name: 'Capacitor (placas)', charges, segments: [], extentM: 0.35 };
}
function presetWire(): EMScene {
  return {
    name: 'Corriente recta (B azimutal)',
    charges: [],
    segments: [{ id: 'w', I: 10, r1: [0, 0, -10], r2: [0, 0, 10], color: '#FDB813' }],
    extentM: 0.5,
  };
}
function presetCyclotron(): EMScene {
  // Uniform B along +z (as if produced by a large solenoid). Parameters chosen
  // so that the Larmor radius r = mv/(qB) lands in the 1 cm range — visible at
  // the module's display scale. See docstring at top of file for the formula.
  //
  //   B    = 0.01 T
  //   v    = 1.758e7 m/s  (~c/17, safely non-relativistic)
  //   r    = m·v / (e·B) = 9.109e-31 · 1.758e7 / (1.602e-19 · 0.01) = 0.01 m
  //   T    = 2π·m / (e·B)                                           ≈ 3.57 ns
  //
  // Start the particle on +x with tangent velocity so the orbit centers at origin.
  const B = 0.01;
  const v = 1.758e7;
  const r = 0.01;
  return {
    name: 'Ciclotrón — electrón en B uniforme',
    charges: [],
    segments: [],
    particle: { q: -1.602e-19, m: 9.109e-31, pos: [r, 0, 0], vel: [0, v, 0] },
    bgB: [0, 0, B],
    extentM: 0.03,
  };
}

const PRESETS = [
  { id: 'dipole',    name: 'Dipolo',             factory: presetDipole },
  { id: 'capacitor', name: 'Capacitor',          factory: presetCapacitor },
  { id: 'wire',      name: 'Corriente recta',    factory: presetWire },
  { id: 'cyclotron', name: 'Ciclotrón',          factory: presetCyclotron },
] as const;

function fmtSci(x: number, d = 3) { return isFinite(x) ? x.toExponential(d) : 'NaN'; }

export default function EMFields() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<typeof PRESETS[number]['id']>('dipole');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const sceneRef = useRef<EMScene>(preset.factory());
  const [, force] = useState(0);
  const [running, setRunning] = useState(true);
  const [showFieldE, setShowE] = useState(true);
  const [showFieldB, setShowB] = useState(false);
  const [showLines, setLines]  = useState(true);
  const [probeValue, setProbeValue] = useState<{ E: number; B: number; V: number }>({ E: 0, B: 0, V: 0 });

  useEffect(() => {
    const s = preset.factory();
    sceneRef.current = s;
    setShowE(s.charges.length > 0);
    setShowB(s.segments.length > 0 || !!s.bgB);
    force(x => x + 1);
  }, [presetId]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => {
      const s = sceneRef.current;
      if (s.particle) {
        // Sim steps per frame are tuned so one cyclotron period takes ~5-10
        // frames of wall time — enough to see orbit closure in <1s, not so
        // many that the integrator drifts from accumulated error.
        const N = 400;
        const dt = 1e-12;
        const bg = s.bgB ?? [0, 0, 0];
        for (let i = 0; i < N; i++) lorentzStep(s.particle, s.charges, s.segments, dt, bg);
      }
      force(x => x + 1);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, presetId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <EMViewport
          sceneRef={sceneRef}
          showFieldE={showFieldE}
          showFieldB={showFieldB}
          showLines={showLines}
          onProbe={setProbeValue}
        />
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1]">
          <div><span className="text-[#64748B]">escena&nbsp;&nbsp;</span>= {preset.name}</div>
          <div><span className="text-[#64748B]">extensión</span>= ±{sceneRef.current.extentM.toFixed(3)} m</div>
        </div>
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <button
            onClick={() => setRunning(r => !r)}
            className={`w-9 h-9 rounded-md border text-[14px] transition flex items-center justify-center ${running ? 'border-[#4FC3F7]/60 text-[#4FC3F7] bg-[#4FC3F7]/10' : 'border-[#1E293B] text-[#94A3B8]'}`}
          >{running ? '❚❚' : '▶'}</button>
          <button
            onClick={() => { sceneRef.current = preset.factory(); force(x=>x+1); }}
            className="w-9 h-9 rounded-md border border-[#1E293B] text-[#94A3B8] hover:text-white text-[14px] flex items-center justify-center"
          >↺</button>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Escena">
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                data-testid={`preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  presetId === p.id
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Las flechas <span className="text-[#E27B58]">naranjas</span> son la fuerza eléctrica E. Te dicen hacia dónde empujaría una carga de prueba.</p>
              <p>Las flechas <span className="text-[#4FC3F7]">cyan</span> son el campo magnético B. Las corrientes las generan.</p>
              <p>Mueve el mouse encima del plano — el probe te muestra los números reales en ese punto.</p>
            </div>
          </Section>
        ) : (
          <Section title="Campo en el cursor (probe)">
            <Row label="|E|"  value={`${fmtSci(probeValue.E)} V/m`} />
            <Row label="|B|"  value={`${fmtSci(probeValue.B)} T`} />
            <Row label="V"    value={`${fmtSci(probeValue.V)} V`} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Mueve el mouse sobre el plano z=0. Valores calculados con Coulomb y Biot-Savart exactos.
            </div>
          </Section>
        )}

        <Section title="Visualización">
          <Toggle value={showFieldE} onChange={setShowE}  label="Vectores E (naranja)" />
          <Toggle value={showFieldB} onChange={setShowB}  label="Vectores B (cyan)" />
          <Toggle value={showLines}  onChange={setLines}  label="Líneas de campo E" />
        </Section>

        {sceneRef.current.particle && (() => {
          const part = sceneRef.current.particle;
          const bg = sceneRef.current.bgB;
          const vMag = Math.hypot(...part.vel);
          const Bmag = bg ? Math.hypot(...bg) : 0;
          const rLarmor = Bmag > 0 ? part.m * vMag / (Math.abs(part.q) * Bmag) : NaN;
          const tCyc    = Bmag > 0 ? 2 * Math.PI * part.m / (Math.abs(part.q) * Bmag) : NaN;
          return (
            <Section title="Partícula de prueba">
              <Row label="q"      value={`${fmtSci(part.q)} C`} />
              <Row label="m"      value={`${fmtSci(part.m)} kg`} />
              <Row label="|v|"    value={`${fmtSci(vMag)} m/s`} />
              <Row label="|r|"    value={`${fmtSci(Math.hypot(...part.pos))} m`} />
              {Bmag > 0 && (
                <>
                  <Row label="|B|"       value={`${fmtSci(Bmag)} T`} />
                  <Row label="r_Larmor"  value={`${fmtSci(rLarmor)} m`} />
                  <Row label="T_ciclotrón" value={`${fmtSci(tCyc)} s`} />
                </>
              )}
              <div className="mt-2 text-[10px] text-[#64748B]">
                Fuerza de Lorentz F=q(E+v×B). RK4 con dt=1 ps. En B uniforme r=mv/(qB), T=2πm/(qB).
              </div>
            </Section>
          );
        })()}

        <Section title="Fuentes">
          {sceneRef.current.charges.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-[11px] font-mono py-0.5">
              <span className="w-2 h-2 rounded-full" style={{ background: c.color ?? '#fff' }} />
              <span className="text-[#94A3B8]">carga</span>
              <span className="text-white">{fmtSci(c.q, 2)} C</span>
            </div>
          ))}
          {sceneRef.current.segments.map(s => (
            <div key={s.id} className="flex items-center gap-2 text-[11px] font-mono py-0.5">
              <span className="w-2 h-2 rounded-full" style={{ background: s.color ?? '#fff' }} />
              <span className="text-[#94A3B8]">I</span>
              <span className="text-white">{fmtSci(s.I, 2)} A</span>
            </div>
          ))}
          {sceneRef.current.bgB && (
            <div className="flex items-center gap-2 text-[11px] font-mono py-0.5">
              <span className="w-2 h-2 rounded-full bg-[#4FC3F7]" />
              <span className="text-[#94A3B8]">B uniforme</span>
              <span className="text-white">{fmtSci(Math.hypot(...sceneRef.current.bgB), 2)} T ẑ</span>
            </div>
          )}
        </Section>
      </aside>
    </div>
  );
}

function EMViewport({
  sceneRef, showFieldE, showFieldB, showLines, onProbe,
}: {
  sceneRef: React.MutableRefObject<EMScene>;
  showFieldE: boolean;
  showFieldB: boolean;
  showLines: boolean;
  onProbe: (v: { E: number; B: number; V: number }) => void;
}) {
  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [0, 0.8, 1.2], fov: 50, near: 0.001, far: 100 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[2, 3, 2]} intensity={0.6} />
        <directionalLight position={[-3, -2, -4]} intensity={0.25} color="#4FC3F7" />
        <OrbitControls enablePan enableZoom enableRotate enableDamping dampingFactor={0.08} />
        <EMContents sceneRef={sceneRef} showFieldE={showFieldE} showFieldB={showFieldB} showLines={showLines} onProbe={onProbe} />
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.8} luminanceThreshold={0.2} luminanceSmoothing={0.4} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function EMContents({ sceneRef, showFieldE, showFieldB, showLines, onProbe }: {
  sceneRef: React.MutableRefObject<EMScene>;
  showFieldE: boolean; showFieldB: boolean; showLines: boolean;
  onProbe: (v: { E: number; B: number; V: number }) => void;
}) {
  const { scene, raycaster, camera, pointer } = useThree();

  const extent = sceneRef.current.extentM;
  const dispScale = 1 / extent;

  const particleTex = useMemo(() => getParticleTexture(), []);
  const sourceGroup = useRef<THREE.Group>(null);
  useEffect(() => {
    const g = sourceGroup.current!;
    while (g.children.length) { const ch = g.children[0]; g.remove(ch); }
    for (const c of sceneRef.current.charges) {
      const col = c.color ?? (c.q > 0 ? '#E27B58' : '#4FC3F7');
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: new THREE.Color(col), emissiveIntensity: 1.5, roughness: 0.35, metalness: 0.2 });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.028, 24, 24), mat);
      m.position.set(c.pos[0]*dispScale, c.pos[1]*dispScale, c.pos[2]*dispScale);
      g.add(m);
      // Sprite halo for bloom pickup
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: particleTex, color: new THREE.Color(col), transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.set(0.18, 0.18, 0.18);
      halo.position.copy(m.position);
      g.add(halo);
    }
    for (const s of sceneRef.current.segments) {
      const p1 = new THREE.Vector3(s.r1[0]*dispScale, s.r1[1]*dispScale, s.r1[2]*dispScale);
      const p2 = new THREE.Vector3(s.r2[0]*dispScale, s.r2[1]*dispScale, s.r2[2]*dispScale);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const fullLen = dir.length();
      // The EM physics treats these as long current sources (effectively infinite
      // for Biot-Savart), but rendering them to their real length (tens of scene
      // units) would flood the viewport with bloom. Clip the VISUAL length to a
      // couple of scene units — the physics is untouched.
      const visLen = Math.min(fullLen, 2.6);
      const col = s.color ?? '#FDB813';
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, visLen, 16),
        new THREE.MeshStandardMaterial({
          color: col,
          emissive: new THREE.Color(col),
          emissiveIntensity: 0.6,
          roughness: 0.45,
          metalness: 0.25,
        }),
      );
      cyl.position.copy(mid);
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      g.add(cyl);
      // Faint axial indicator past the clipped ends so it's clear the current continues.
      const fadeMat = new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.28, depthWrite: false });
      const half = visLen / 2;
      const u = dir.clone().normalize();
      const fadeGeom = new THREE.BufferGeometry().setFromPoints([
        mid.clone().add(u.clone().multiplyScalar(-half - 0.6)),
        mid.clone().add(u.clone().multiplyScalar(-half)),
        mid.clone().add(u.clone().multiplyScalar(half)),
        mid.clone().add(u.clone().multiplyScalar(half + 0.6)),
      ]);
      g.add(new THREE.LineSegments(fadeGeom, fadeMat));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneRef.current.charges.length, sceneRef.current.segments.length, dispScale, particleTex]);

  const fieldGroup = useRef<THREE.Group>(null);
  useEffect(() => {
    const g = fieldGroup.current!;
    while (g.children.length) g.remove(g.children[0]);
    if (!showFieldE && !showFieldB) return;
    const N = 7;
    const step = 2 * extent / (N - 1);
    let maxE = 0, maxB = 0;
    const samples: { r: Vec3; E: Vec3; B: Vec3 }[] = [];
    const bg = sceneRef.current.bgB ?? [0, 0, 0];
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const r: Vec3 = [-extent + i*step, -extent + j*step, 0];
      const E = fieldE(r, sceneRef.current.charges);
      const Bseg = fieldB(r, sceneRef.current.segments);
      const B: Vec3 = [Bseg[0] + bg[0], Bseg[1] + bg[1], Bseg[2] + bg[2]];
      maxE = Math.max(maxE, Math.hypot(...E));
      maxB = Math.max(maxB, Math.hypot(...B));
      samples.push({ r, E, B });
    }
    if (maxE === 0) maxE = 1;
    if (maxB === 0) maxB = 1;
    for (const sam of samples) {
      if (showFieldE) addArrow(g, sam.r, sam.E, maxE, '#E27B58', dispScale, 0.12);
      if (showFieldB) addArrow(g, sam.r, sam.B, maxB, '#4FC3F7', dispScale, 0.12);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showFieldE, showFieldB, sceneRef.current.charges.length, sceneRef.current.segments.length, extent, dispScale]);

  const linesGroup = useRef<THREE.Group>(null);
  useEffect(() => {
    const g = linesGroup.current!;
    while (g.children.length) g.remove(g.children[0]);
    if (!showLines || sceneRef.current.charges.length === 0) return;
    const mat = new THREE.LineBasicMaterial({ color: '#94A3B8', transparent: true, opacity: 0.55 });
    for (const c of sceneRef.current.charges) {
      if (c.q < 0) continue;
      const nSeeds = 12;
      const r0 = 0.015;
      for (let k = 0; k < nSeeds; k++) {
        const theta = 2 * Math.PI * k / nSeeds;
        const seed: Vec3 = [c.pos[0] + r0*Math.cos(theta), c.pos[1] + r0*Math.sin(theta), 0];
        const pts = traceFieldLine(seed, sceneRef.current.charges, { stepLen: extent * 0.02, maxSteps: 300, stopRadius: 0.012 });
        const geom = new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(p[0]*dispScale, p[1]*dispScale, p[2]*dispScale)));
        g.add(new THREE.Line(geom, mat));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLines, sceneRef.current.charges.length, extent, dispScale]);

  const particleMesh = useRef<THREE.Mesh>(null);
  const particleHalo = useRef<THREE.Sprite | null>(null);
  const trailRef = useRef<{ pts: THREE.Points; geom: THREE.BufferGeometry; cursor: number; count: number; cap: number } | null>(null);
  useEffect(() => {
    if (!sceneRef.current.particle) {
      if (particleMesh.current) particleMesh.current.visible = false;
      if (particleHalo.current) particleHalo.current.visible = false;
      if (trailRef.current) trailRef.current.pts.visible = false;
      return;
    }
    if (particleMesh.current) particleMesh.current.visible = true;
    if (!particleHalo.current) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: particleTex,
        color: new THREE.Color('#FFEB3B'),
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      halo.scale.set(0.14, 0.14, 0.14);
      scene.add(halo);
      particleHalo.current = halo;
    } else {
      particleHalo.current.visible = true;
    }
    const cap = 2000;
    if (!trailRef.current) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      geom.setDrawRange(0, 0);
      const mat = new THREE.PointsMaterial({
        color: new THREE.Color('#FFEB3B'),
        map: particleTex,
        alphaMap: particleTex,
        size: 0.04,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pts = new THREE.Points(geom, mat);
      scene.add(pts);
      trailRef.current = { pts, geom, cursor: 0, count: 0, cap };
    } else {
      trailRef.current.cursor = 0;
      trailRef.current.count = 0;
      trailRef.current.geom.setDrawRange(0, 0);
      trailRef.current.pts.visible = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneRef.current.particle, particleTex]);

  const planeRef = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), []);
  useFrame(() => {
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(planeRef, hit)) {
      const r: Vec3 = [hit.x / dispScale, hit.y / dispScale, 0];
      const E = fieldE(r, sceneRef.current.charges);
      const Bseg = fieldB(r, sceneRef.current.segments);
      const bg = sceneRef.current.bgB ?? [0, 0, 0];
      const B: Vec3 = [Bseg[0] + bg[0], Bseg[1] + bg[1], Bseg[2] + bg[2]];
      let V = 0;
      for (const c of sceneRef.current.charges) {
        const dx = r[0] - c.pos[0], dy = r[1] - c.pos[1], dz = r[2] - c.pos[2];
        const rr = Math.sqrt(dx*dx+dy*dy+dz*dz + 1e-6*1e-6);
        V += 8.9875e9 * c.q / rr;
      }
      onProbe({ E: Math.hypot(...E), B: Math.hypot(...B), V });
    }

    const p = sceneRef.current.particle;
    if (p && particleMesh.current) {
      const px = p.pos[0]*dispScale, py = p.pos[1]*dispScale, pz = p.pos[2]*dispScale;
      particleMesh.current.position.set(px, py, pz);
      if (particleHalo.current) particleHalo.current.position.set(px, py, pz);
      const t = trailRef.current;
      if (t) {
        const arr = (t.geom.attributes.position as THREE.BufferAttribute).array as Float32Array;
        const i = t.cursor;
        arr[i*3+0] = px; arr[i*3+1] = py; arr[i*3+2] = pz;
        t.cursor = (i + 1) % t.cap;
        t.count = Math.min(t.count + 1, t.cap);
        (t.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        t.geom.setDrawRange(0, t.count);
      }
    }
  });

  return (
    <>
      <gridHelper args={[4, 20, '#1E293B', '#1E293B']} position={[0, 0, 0]} rotation={[Math.PI/2, 0, 0]} />
      <group ref={sourceGroup} />
      <group ref={fieldGroup} />
      <group ref={linesGroup} />
      {sceneRef.current.particle && (
        <mesh ref={particleMesh}>
          <sphereGeometry args={[0.02, 20, 20]} />
          <meshStandardMaterial color="#FFEB3B" emissive="#FFEB3B" emissiveIntensity={1.8} roughness={0.35} metalness={0.15} />
        </mesh>
      )}
    </>
  );
}

function addArrow(g: THREE.Group, origin: Vec3, v: Vec3, vmax: number, color: string, dispScale: number, sizeUnits: number) {
  const mag = Math.hypot(...v);
  if (mag < 1e-14) return;
  const len = sizeUnits * Math.min(1, Math.pow(mag / vmax, 0.45));
  const dir = new THREE.Vector3(v[0], v[1], v[2]).normalize();
  const arr = new THREE.ArrowHelper(
    dir,
    new THREE.Vector3(origin[0]*dispScale, origin[1]*dispScale, origin[2]*dispScale),
    len, color, len * 0.35, len * 0.25,
  );
  g.add(arr);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-[12px] text-[#CBD5E1]">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-[#4FC3F7]" />
      {label}
    </label>
  );
}
