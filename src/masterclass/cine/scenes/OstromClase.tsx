/**
 * OstromClase — masterclass cine del premio 2009 (Elinor Ostrom + Williamson):
 * la tragedia de los comunes NO es inevitable.
 *
 * SIMULACIÓN REAL corriendo: dS/dt = g·S·(1−S) − c·N·S. El pasto MUERE y RENACE
 * frente a tus ojos. 18 escenas, 515s (~8.5 min), voz Matilda.
 *
 * Arco:
 *   TRAGEDIA     01 pradera verde · 02 Hardin 1968 · 03 sim colapso · 04 desierto
 *   OSTROM       05 llega Ostrom · 06 sim con reglas (renace)
 *   PRINCIPIOS   07 ocho pilares · 08 monitoreo (botes) · 09 sanciones graduadas
 *   GOBERNANZA   10 Williamson · 11 tres estructuras
 *   RENACIMIENTO 12 pradera comparada · 13 comunes digitales · 14 ejidos México
 *   GLOBAL       15 clima · 16 críticas · 17 Nobel · 18 cierre
 */

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import { CineStage, CineCamera, CineModel, useCineTime } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

const COW = '/models/library/animals/cow.glb';
const TREE = '/models/library/nature/tree_oak.glb';
const FENCE = '/models/library/nature/fence.glb';
const FISH = '/models/library/animals/fish.glb';
const BEE = '/models/library/animals/bee.glb';
AtomModel.preload(COW);
AtomModel.preload(TREE);
AtomModel.preload(FENCE);
AtomModel.preload(FISH);
AtomModel.preload(BEE);

const T = [0.45, 18.13, 49.66, 71.03, 91.12, 120.64, 143.83, 174.55, 200.23, 230.95, 262.4, 288.08, 315.11, 345.36, 387.99, 422.0, 457.61, 488.17];
const END = 515;
const beatEnd = (i: number) => (i < 17 ? T[i + 1] : END);

const GOLD = '#FDB813';
const GREEN = '#2E8B57';
const BROWN = '#5A4327';
const BLUE = '#46C2FF';
const RED = '#FF4444';

const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const local = (t: number, start: number, end: number) => clamp((t - start) / (end - start), 0, 1);

function fadeGroup(g: THREE.Group | null, t: number, inAt: number, outAt: number) {
  if (!g) return false;
  const on = t >= inAt && t < outAt;
  g.visible = on;
  if (!on) return false;
  g.scale.setScalar(Math.min(1, 0.0001 + (t - inAt) / 0.15));
  return true;
}

function TimedGroup({ inAt, outAt, children }: { inAt: number; outAt: number; children: ReactNode }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  useFrame(() => fadeGroup(g.current, timeRef.current, inAt, outAt));
  return <group ref={g}>{children}</group>;
}

// ╔═══ SIMULACIÓN CENTRAL: el pasto y las vacas (ODE real) ═══════════════════╗
const COW_MAX = 9;
const G_RATE = 0.35;
const C_RATE = 0.05;

interface SimState { S: number; N: number; phase: 'pristine' | 'tragedy' | 'collapse' | 'govern' | 'recovered'; }

function SimField({ simRef }: { simRef: React.MutableRefObject<SimState> }) {
  const timeRef = useCineTime();
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const green = useMemo(() => new THREE.Color(GREEN), []);
  const brown = useMemo(() => new THREE.Color(BROWN), []);
  const tmp = useMemo(() => new THREE.Color(), []);

  useFrame((_, dtRaw) => {
    const dt = Math.min(0.05, dtRaw);
    const t = timeRef.current;
    const s = simRef.current;

    if (t < T[2]) {
      // L01-L02: pradera intacta, pocas vacas
      s.S = 1; s.N = 2; s.phase = 'pristine';
    } else if (t < T[5]) {
      // L03-L04: TRAGEDIA — acceso abierto, vacas se multiplican, pasto muere
      s.phase = 'tragedy';
      if (s.S > 0.18) s.N += dt * 0.95;
      if (s.S < 0.07) s.N -= dt * 1.6;
      s.N = clamp(s.N, 0, COW_MAX);
      const dS = G_RATE * s.S * (1 - s.S) - C_RATE * s.N * s.S;
      s.S = clamp(s.S + dS * dt, 0, 1);
      if (s.S < 0.05) s.phase = 'collapse';
    } else if (t < T[11]) {
      // L06-L11: GOBERNANZA — el hato se limita, el pasto se recupera
      s.phase = 'govern';
      const nSust = (G_RATE * (1 - 0.6)) / C_RATE;
      s.N += (nSust - s.N) * dt * 0.7;
      s.N = clamp(s.N, 0, COW_MAX);
      const dS = G_RATE * s.S * (1 - s.S) - C_RATE * s.N * s.S;
      s.S = clamp(s.S + dS * dt, 0, 1);
      if (s.S > 0.55) s.phase = 'recovered';
    } else {
      // L12+: pradera estable, cooperación plena
      s.phase = 'recovered';
      const nSust = (G_RATE * (1 - 0.65)) / C_RATE;
      s.N += (nSust - s.N) * dt * 0.4;
      s.N = clamp(s.N, 0, COW_MAX);
      const dS = G_RATE * s.S * (1 - s.S) - C_RATE * s.N * s.S;
      s.S = clamp(s.S + dS * dt, 0, 1);
    }

    if (matRef.current) {
      tmp.copy(brown).lerp(green, s.S);
      matRef.current.color.copy(tmp);
      matRef.current.emissive.copy(tmp);
      matRef.current.emissiveIntensity = 0.10 + 0.35 * s.S;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
      <circleGeometry args={[16, 64]} />
      <meshStandardMaterial ref={matRef} color={GREEN} emissive={GREEN} emissiveIntensity={0.4} roughness={0.85} metalness={0.05} />
    </mesh>
  );
}

function SimCow({ i, simRef }: { i: number; simRef: React.MutableRefObject<SimState> }) {
  const groupRef = useRef<THREE.Group>(null);
  const scaleRef = useRef(0);
  const timeRef = useCineTime();
  const home = useMemo<[number, number]>(() => {
    const a = (i / COW_MAX) * Math.PI * 2 + i * 0.7;
    const r = 3.5 + (i % 4) * 2.4;
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, [i]);
  const phase = useMemo(() => i * 1.37, [i]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    const t = timeRef.current;
    const target = i < Math.round(simRef.current.N) ? 1 : 0;
    scaleRef.current += (target - scaleRef.current) * 0.06;
    const sc = scaleRef.current;
    g.visible = sc > 0.02;
    g.scale.setScalar(Math.max(0.001, sc));
    const drift = Math.cos(t * 0.18 + phase) * 1.3;
    const wob = Math.sin(t * 0.4 + phase) * 0.9;
    g.position.set(home[0] + drift, Math.abs(Math.sin(t * 1.6 + phase)) * 0.12, home[1] + wob);
    g.rotation.y = t * 0.12 + phase;
  });

  return (
    <group ref={groupRef}>
      <AtomModel src={COW} color="#EDE6CE" glow={1.0} mode="atom" fitTo={2.0} halo={false} />
    </group>
  );
}

function Commons({ simRef }: { simRef: React.MutableRefObject<SimState> }) {
  const cows = useMemo(() => Array.from({ length: COW_MAX }, (_, i) => i), []);
  return (
    <>
      <SimField simRef={simRef} />
      {cows.map(i => <SimCow key={i} i={i} simRef={simRef} />)}
      <CineModel src={TREE} position={[-13, 0, -6]} at={0} color="#3FA56A" fitTo={5} floatAmp={0} />
      <CineModel src={TREE} position={[13, 0, -7]} at={0} color="#3FA56A" fitTo={5.6} floatAmp={0} />
      <CineModel src={TREE} position={[10, 0, 8]} at={0} color="#3FA56A" fitTo={4.6} floatAmp={0} />
    </>
  );
}

// ╔═══ 02 — Hardin: el libro que dominó 70 años ═════════════════════════════╗
function HardinBook({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const m = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (m.current) { m.current.rotation.y += 0.008; m.current.position.y = 4.5 + Math.sin(t * 0.5) * 0.15; }
    const warn = 0.5 + 0.5 * Math.sin(t * 2.5);
    if (mat.current) mat.current.emissiveIntensity = 0.8 + warn * 1.2;
  });
  return (
    <group ref={g} position={[0, 4.5, 0]}>
      <mesh ref={m}>
        <boxGeometry args={[2.2, 3.0, 0.3]} />
        <meshStandardMaterial ref={mat} color="#2A1A0A" emissive={RED} emissiveIntensity={1.0} roughness={0.7} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ╔═══ 05 — Ostrom llega: cristal de idea (como Romer) ═══════════════════════╗
function OstromCrystal({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const gem = useRef<THREE.Mesh>(null);
  const gemMat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const igniteAt = start + 4;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (g.current) g.current.position.y = 5.5 + 0.08 * Math.sin(t * 0.8);
    if (gem.current) { gem.current.rotation.y += 0.015; gem.current.rotation.x = 0.2 + 0.05 * Math.sin(t * 0.6); }
    const dt = t - igniteAt;
    let flick: number;
    if (dt >= 0) flick = 1;
    else if (dt > -1.5) { const ph = dt + 1.5; flick = (Math.abs(ph - 0.5) < 0.06 || Math.abs(ph - 1.0) < 0.05) ? 0.7 : 0.04; }
    else flick = 0.04;
    const settle = dt >= 0 ? smooth(Math.min(1, dt / 0.6)) : 0;
    const lum = Math.max(flick, settle);
    if (gemMat.current) gemMat.current.emissiveIntensity = 0.12 + lum * 4.8;
    if (gem.current) gem.current.scale.setScalar(1 + lum * 0.15);
    if (light.current) light.current.intensity = lum * 6;
  });
  return (
    <group ref={g} position={[0, 5.5, 0]}>
      <mesh ref={gem} rotation={[0.2, 0, 0]}>
        <octahedronGeometry args={[1.3, 0]} />
        <meshStandardMaterial ref={gemMat} color="#0E2236" emissive={GREEN} emissiveIntensity={0.12} metalness={0.3} roughness={0.25} flatShading toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#7AFF9A" intensity={0} distance={35} decay={2} />
    </group>
  );
}

// ╔═══ 07 — Ocho pilares de Ostrom ═══════════════════════════════════════════╗
function EightPillars({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const pillars = useRef<THREE.Mesh[]>([]);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const span = end - start;
  const colors = ['#4FC3F7', '#34D399', GOLD, '#A78BFA', '#F472B6', '#FF7A1A', BLUE, '#9FE8B0'];
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 8; i++) {
      const m = pillars.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.08), start + 2.0 + i * (span * 0.08)));
      m.visible = p > 0.01;
      const h = 1.5 + p * 3.5;
      m.scale.set(1, Math.max(0.001, h), 1);
      m.position.y = h / 2;
      if (mats.current[i]) mats.current[i].emissiveIntensity = 0.3 + p * 1.6;
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const r = 7;
        return (
          <mesh key={i} ref={m => { if (m) pillars.current[i] = m; }} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} visible={false}>
            <cylinderGeometry args={[0.35, 0.45, 1, 6]} />
            <meshStandardMaterial ref={m => { if (m) mats.current[i] = m; }} color="#11151F" emissive={colors[i]} emissiveIntensity={0.3} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ╔═══ 08 — Monitoreo: botes pesqueros rotando en círculo (Alanya) ═══════════╗
function FishingBoats({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const boats = useRef<THREE.Group[]>([]);
  const N = 6;
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const active = Math.floor(((t - start) / (end - start)) * N) % N;
    for (let i = 0; i < N; i++) {
      const b = boats.current[i]; if (!b) continue;
      const a = (i / N) * Math.PI * 2 + t * 0.15;
      const r = 6;
      b.position.set(Math.cos(a) * r, 0.3, Math.sin(a) * r);
      b.rotation.y = a + Math.PI / 2;
      if (mats.current[i]) mats.current[i].emissiveIntensity = i === active ? 3.0 : 0.6;
    }
  });
  return (
    <group ref={g}>
      {Array.from({ length: N }).map((_, i) => (
        <group key={i} ref={b => { if (b) boats.current[i] = b; }}>
          <mesh>
            <boxGeometry args={[1.8, 0.4, 0.7]} />
            <meshStandardMaterial ref={m => { if (m) mats.current[i] = m; }} color="#1A1E28" emissive={BLUE} emissiveIntensity={0.6} toneMapped={false} />
          </mesh>
          <AtomModel src={FISH} color="#4FC3F7" glow={1.2} fitTo={0.8} />
        </group>
      ))}
    </group>
  );
}

// ╔═══ 09 — Sanciones graduadas: escalera que sube de verde a rojo ═══════════╗
function GradedSanctions({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const steps = useRef<THREE.Mesh[]>([]);
  const stepMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const N = 5;
  const colors = ['#34D399', '#86EFAC', GOLD, '#FF7A1A', RED];
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < N; i++) {
      const m = steps.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1.0 + i * (span * 0.14), start + 2.5 + i * (span * 0.14)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p);
      if (stepMats.current[i]) stepMats.current[i].emissiveIntensity = 0.4 + p * 1.8;
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) steps.current[i] = m; }} position={[-3 + i * 1.5, 0.8 + i * 1.2, 0]} visible={false}>
          <boxGeometry args={[1.2, 0.8 + i * 0.4, 1.2]} />
          <meshStandardMaterial ref={m => { if (m) stepMats.current[i] = m; }} color="#11151F" emissive={colors[i]} emissiveIntensity={0.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 10/11 — Tres estructuras de gobernanza ════════════════════════════════╗
function ThreeGovernance({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const structs = useRef<THREE.Group[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const s = structs.current[i]; if (!s) continue;
      const p = smooth(local(t, start + 1.0 + i * (span * 0.2), start + 3.0 + i * (span * 0.2)));
      s.visible = p > 0.01;
      s.scale.setScalar(0.001 + p);
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* Empresa (Coase) = fábrica */}
      <group ref={s => { if (s) structs.current[0] = s; }} position={[-6, 0, 0]} visible={false}>
        <AtomModel src="/models/library/buildings/factory.glb" color={GOLD} glow={1.3} fitTo={4} />
      </group>
      {/* Jerarquía (Williamson) = pirámide */}
      <group ref={s => { if (s) structs.current[1] = s; }} position={[0, 0, 0]} visible={false}>
        <mesh position={[0, 2.5, 0]}>
          <coneGeometry args={[2.8, 5, 4]} />
          <meshStandardMaterial color="#11151F" emissive="#A78BFA" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>
      {/* Comunidad (Ostrom) = anillo de esferas */}
      <group ref={s => { if (s) structs.current[2] = s; }} position={[6, 0, 0]} visible={false}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 2, 1.5 + Math.sin(i * 1.3) * 0.5, Math.sin(a) * 2]}>
              <sphereGeometry args={[0.4, 12, 12]} />
              <meshStandardMaterial color="#11151F" emissive={GREEN} emissiveIntensity={1.8} toneMapped={false} />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

// ╔═══ 13 — Comunes digitales: tres esferas (Wikipedia/Linux/OSM) ════════════╗
function DigitalCommons({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const orbs = useRef<THREE.Mesh[]>([]);
  const orbMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const span = end - start;
  const items = [
    { x: -4.5, color: '#4FC3F7', r: 1.3 },  // Wikipedia
    { x: 0, color: GOLD, r: 1.1 },            // Linux
    { x: 4.5, color: '#34D399', r: 1.0 },     // OSM
  ];
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const m = orbs.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1.0 + i * (span * 0.15), start + 3.0 + i * (span * 0.15)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * items[i].r);
      m.rotation.y += 0.02;
      m.position.y = 3 + Math.sin(t * 0.7 + i * 2) * 0.2;
      if (orbMats.current[i]) orbMats.current[i].emissiveIntensity = 0.6 + p * 2.0 + Math.sin(t * 2 + i) * 0.3;
    }
  });
  return (
    <group ref={g}>
      {items.map((it, i) => (
        <mesh key={i} ref={m => { if (m) orbs.current[i] = m; }} position={[it.x, 3, 0]} visible={false}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial ref={m => { if (m) orbMats.current[i] = m; }} color="#0E2236" emissive={it.color} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 14 — Ejidos: cercas que brillan y se apagan ═══════════════════════════╗
function Ejidos({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const fences = useRef<THREE.Group[]>([]);
  const N = 6;
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const reform = smooth(local(t, start + span * 0.5, start + span * 0.7));
    for (let i = 0; i < N; i++) {
      const f = fences.current[i]; if (!f) continue;
      const appear = smooth(local(t, start + 0.5 + i * 0.8, start + 2.0 + i * 0.8));
      f.visible = appear > 0.01;
      f.scale.setScalar(0.001 + appear);
      // half the fences dim after the 1992 reform
      const alive = i < 3 ? 1.0 : (1.0 - reform * 0.8);
      f.children.forEach(ch => {
        if ((ch as THREE.Mesh).material && 'emissiveIntensity' in (ch as THREE.Mesh).material) {
          ((ch as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = alive * 1.6;
        }
      });
    }
  });
  return (
    <group ref={g}>
      {Array.from({ length: N }).map((_, i) => {
        const a = (i / N) * Math.PI * 2;
        const r = 6.5;
        return (
          <group key={i} ref={f => { if (f) fences.current[i] = f; }} position={[Math.cos(a) * r, 0, Math.sin(a) * r]} rotation={[0, a + Math.PI / 2, 0]} visible={false}>
            <AtomModel src={FENCE} color={i < 3 ? GREEN : GOLD} glow={1.6} fitTo={3.2} />
          </group>
        );
      })}
    </group>
  );
}

// ╔═══ 15 — Clima global: esfera Tierra + emisiones + policentrismo ══════════╗
function ClimateGlobe({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Mesh>(null);
  const globeMat = useRef<THREE.MeshStandardMaterial>(null);
  const smalls = useRef<THREE.Mesh[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (globe.current) globe.current.rotation.y += 0.005;
    const heat = smooth(local(t, start + 2, start + span * 0.45));
    if (globeMat.current) globeMat.current.emissiveIntensity = 0.5 + heat * 2.0;
    const poly = smooth(local(t, start + span * 0.5, start + span * 0.8));
    for (let i = 0; i < 5; i++) {
      const m = smalls.current[i]; if (!m) continue;
      m.visible = poly > 0.01;
      m.scale.setScalar(0.001 + poly * 0.6);
      m.rotation.y += 0.02;
    }
  });
  const smallPos: [number, number, number][] = [[-4, 1.5, -2], [4, 2, -1], [-3, 4.5, 1], [3, 4, 2], [0, 5.5, -1]];
  return (
    <group ref={g} position={[0, 2.5, 0]}>
      <mesh ref={globe}>
        <sphereGeometry args={[2.2, 32, 32]} />
        <meshStandardMaterial ref={globeMat} color="#0A1628" emissive="#FF4444" emissiveIntensity={0.5} toneMapped={false} />
      </mesh>
      {smallPos.map((pos, i) => (
        <mesh key={i} ref={m => { if (m) smalls.current[i] = m; }} position={pos} visible={false}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial color="#0A1628" emissive={GREEN} emissiveIntensity={2.0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 16 — Críticas: tres barreras que aparecen y se disuelven ══════════════╗
function CritiqueBarriers({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const walls = useRef<THREE.Mesh[]>([]);
  const wallMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const m = walls.current[i]; if (!m) continue;
      const appear = smooth(local(t, start + 1.0 + i * (span * 0.15), start + 3.0 + i * (span * 0.15)));
      const dissolve = smooth(local(t, start + span * 0.7, end));
      m.visible = appear > 0.01;
      m.scale.set(1, Math.max(0.001, appear * (1 - dissolve * 0.8)), 1);
      if (wallMats.current[i]) {
        wallMats.current[i].emissiveIntensity = appear * 1.4 * (1 - dissolve * 0.6);
        wallMats.current[i].opacity = 0.3 + appear * 0.6 * (1 - dissolve * 0.7);
      }
    }
  });
  return (
    <group ref={g} position={[0, 2, 0]}>
      {[[-3.5, RED], [0, '#FF7A1A'], [3.5, GOLD]].map(([x, c], i) => (
        <mesh key={i} ref={m => { if (m) walls.current[i] = m; }} position={[x as number, 0, 0]} visible={false}>
          <boxGeometry args={[2.0, 4.0, 0.3]} />
          <meshStandardMaterial ref={m => { if (m) wallMats.current[i] = m; }} color="#11151F" emissive={c as string} emissiveIntensity={0.4} transparent opacity={0.3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 17 — Nobel: medalla dorada descendiendo ═══════════════════════════════╗
function NobelMedal({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const medal = useRef<THREE.Mesh>(null);
  const medalMat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const descent = smooth(local(t, start + 0.5, start + 4));
    if (medal.current) {
      medal.current.position.y = lerpN(14, 6, descent);
      medal.current.rotation.y += 0.025;
      medal.current.rotation.z = 0.1 * Math.sin(t * 0.8);
    }
    if (medalMat.current) medalMat.current.emissiveIntensity = 1.2 + descent * 4.5;
    if (light.current) light.current.intensity = descent * 12;
  });
  return (
    <group ref={g}>
      <mesh ref={medal} position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.5, 1.5, 0.2, 32]} />
        <meshStandardMaterial ref={medalMat} color="#7A5A12" emissive={GOLD} emissiveIntensity={0.8} metalness={0.8} roughness={0.2} toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0, 6, 0]} color="#FFE0A0" intensity={0} distance={30} decay={2} />
    </group>
  );
}

// ╔═══ 18 — Cierre: split pradera muerta vs viva ════════════════════════════╗
function ClosingSplit({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const deadMat = useRef<THREE.MeshStandardMaterial>(null);
  const liveMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const shift = smooth(local(t, start + (end - start) * 0.5, end));
    if (deadMat.current) deadMat.current.emissiveIntensity = 0.3 * (1 - shift * 0.7);
    if (liveMat.current) liveMat.current.emissiveIntensity = 0.4 + shift * 1.0;
  });
  return (
    <group ref={g} position={[0, 0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8, 0, 0]}>
        <circleGeometry args={[7, 32, 0, Math.PI]} />
        <meshStandardMaterial ref={deadMat} color={BROWN} emissive={BROWN} emissiveIntensity={0.3} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8, 0, 0]}>
        <circleGeometry args={[7, 32, Math.PI, Math.PI]} />
        <meshStandardMaterial ref={liveMat} color={GREEN} emissive={GREEN} emissiveIntensity={0.4} roughness={0.8} />
      </mesh>
    </group>
  );
}

// ── Cámara: 18 cortes con deriva, ángulos variados ─────────────────────────
function buildCamKeys(): CineCamKey[] {
  const LOOK: [number, number, number] = [0, 1.5, 0];
  const shots: { p0: [number, number, number]; p1: [number, number, number]; look?: [number, number, number] }[] = [
    { p0: [0, 14, 32],     p1: [-5, 6, 18],    look: [0, 1, 0] },      // 01 pradera desde alto
    { p0: [10, 8, 22],     p1: [3, 5, 14],      look: [0, 3, 0] },      // 02 Hardin book
    { p0: [-8, 4, 16],     p1: [-3, 2.5, 10],   look: [0, 1.5, 0] },    // 03 tragedia sim
    { p0: [5, 2, 10],      p1: [1, 1.2, 6],     look: [0, 0.5, 0] },    // 04 colapso bajo
    { p0: [0, 12, 26],     p1: [0, 7, 16],      look: [0, 4, 0] },      // 05 Ostrom cristal
    { p0: [-10, 5, 18],    p1: [-4, 3, 12],     look: [0, 1, 0] },      // 06 gobernanza sim
    { p0: [12, 8, 20],     p1: [5, 5, 14],      look: [0, 2, 0] },      // 07 pilares
    { p0: [-6, 3, 14],     p1: [-2, 2, 9],      look: [0, 1, 0] },      // 08 botes
    { p0: [8, 5, 15],      p1: [3, 3.5, 10],    look: [0, 2.5, 0] },    // 09 sanciones
    { p0: [-12, 6, 20],    p1: [10, 6, 20],     look: [0, 2.5, 0] },    // 10 Williamson pan
    { p0: [8, 4, 14],      p1: [3, 3, 10],      look: [0, 2, 0] },      // 11 tres gobernanzas
    { p0: [0, 16, 28],     p1: [-4, 8, 18],     look: [0, 1, 0] },      // 12 pradera renacida
    { p0: [-5, 4, 12],     p1: [4, 3.5, 9],     look: [0, 3, 0] },      // 13 digitales
    { p0: [0, 10, 22],     p1: [0, 5, 14],      look: [0, 1, 0] },      // 14 ejidos
    { p0: [6, 6, 16],      p1: [2, 4, 10],      look: [0, 3, 0] },      // 15 clima
    { p0: [-7, 5, 14],     p1: [-3, 3.5, 10],   look: [0, 2.5, 0] },    // 16 críticas
    { p0: [0, 12, 20],     p1: [2, 8, 14],      look: [0, 6, 0] },      // 17 Nobel (mirar arriba, la medalla desciende)
    { p0: [-10, 10, 24],   p1: [0, 14, 30],     look: [0, 1, 0] },      // 18 cierre (se aleja)
  ];
  const keys: CineCamKey[] = [];
  for (let i = 0; i < 18; i++) {
    const t0 = T[i], t1 = beatEnd(i);
    const lk = shots[i].look ?? LOOK;
    keys.push({ t: t0, pos: shots[i].p0, look: lk, cut: true });
    keys.push({ t: Math.max(t0 + 0.1, t1 - 0.08), pos: shots[i].p1, look: lk });
  }
  return keys;
}

const SUBS = [
  'Mira este pasto. Seis pastores comparten un mismo terreno. Nadie es dueño del suelo: es común. ¿Qué va a pasar?',
  'Hardin, 1968: si el recurso es común y nadie controla el acceso, cada usuario tiene el incentivo de extraer al máximo. Esa idea dominó la política ambiental por décadas.',
  'Sin reglas, cada pastor mete a sus animales al máximo. El pasto no se regenera. El terreno se vuelve marrón. Todos pierden.',
  'Los pastores no son malos: cada uno tomó la decisión racional. Pero la suma de las decisiones racionales destruyó el recurso.',
  'Pero llegó Elinor Ostrom. Politóloga, no economista. Estudió comunidades reales. La tragedia no era inevitable.',
  'Los pastores cooperan. Limitan cuántos animales meten. El pasto se regenera. No es socialismo. No es privatización. Es gobernanza colectiva.',
  'Ostrom destiló ocho principios: límites claros, reglas locales, decisiones colectivas, monitoreo, sanciones graduadas, resolución de conflictos, reconocimiento externo, organización en capas.',
  'En Alanya, los pescadores rotaban los mejores spots. Si alguien se salía de turno, lo veían. La transparencia hace que cooperar sea racional.',
  'Las sanciones tienen que ser graduadas. Primera ofensa: conversación. Segunda: multa pequeña. Tercera: grande. Repetidos: exclusión.',
  'Williamson estudió lo mismo desde otro lado: ¿cuándo dejamos el mercado y nos volvemos jerarquía? Depende de los costos de transacción.',
  'Tres estructuras de gobernanza: empresa, jerarquía, comunidad. Tres respuestas distintas al mismo problema.',
  'Mira la diferencia: el verde se mantiene. Los animales no mueren. Solo requiere que la comunidad establezca reglas claras.',
  'Wikipedia, Linux, Open Street Map. Comunes digitales. Sin Estado, sin mercado, millones de personas mantienen vivos estos recursos.',
  'En México, el ejido es un común histórico. Reglas locales, asambleas, sanciones. La reforma de 1992 al Artículo 27 los transformó.',
  'El clima es el común más grande del mundo. Ostrom propuso policentrismo: muchas iniciativas a distintas escalas. No esperar al acuerdo perfecto.',
  'Las críticas son honestas: escalar es difícil, la cultura cambia, algunos comunes ya colapsan. Pero la tragedia no es inevitable.',
  'Primera mujer Nobel de economía. Estudió pesquerías y bosques. "El premio es para las comunidades que demostraron que la cooperación es posible."',
  'Hardin dijo: se destruye solo. Ostrom respondió: solo si dejas que se destruya. La diferencia es la institución. Y la institución la hace la gente.',
];

export default function OstromClase() {
  const simRef = useRef<SimState>({ S: 1, N: 2, phase: 'pristine' });
  const subtitles = SUBS.map((text, i) => ({ text, at: T[i], until: beatEnd(i) }));
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      audio="/audio/clase-ostrom/narration.mp3?v=1"
      duration={END}
      chapter="Ostrom · 2009 · la tragedia que no fue"
      fov={50}
      cameraPos={[0, 14, 32]}
      postfx={{ intensity: 1.2, threshold: 0.44, vignette: 0.82, aberration: 0.0005 }}
      subtitles={subtitles}
      title={{ text: 'La tragedia que no fue', at: T[0] + 0.3, until: beatEnd(0) }}
    >
      <CineCamera keys={buildCamKeys()} live={1} />

      <NebulaWorld
        scale={42}
        holeR={16}
        ghostWindow={[T[2], T[4]]}
        firstIgnite={T[5]}
        chain={[
          T[6], T[6] + 2, T[6] + 4,
          T[7], T[7] + 3,
          T[8], T[8] + 3,
          T[11], T[11] + 3, T[11] + 6,
          T[12], T[12] + 3,
          T[13] + 2, T[13] + 5,
          T[14] + 2, T[15] + 3,
          T[16] + 2, T[16] + 5,
        ]}
        dawnAt={T[16]}
        beatTimes={T}
        calmFrom={END - 5}
      />

      <Commons simRef={simRef} />

      <ambientLight intensity={0.2} color="#2A2640" />
      <directionalLight position={[5, 12, 4]} intensity={0.5} color="#FFE6C0" />

      {/* L02: Hardin — el libro rojo que predijo la tragedia */}
      <TimedGroup inAt={T[1]} outAt={T[2]}>
        <HardinBook start={T[1]} end={T[2]} />
      </TimedGroup>

      {/* L05: Ostrom — el cristal verde que enciende la esperanza */}
      <OstromCrystal start={T[4]} end={T[5] + 5} />

      {/* L07: Los ocho principios — pilares en círculo */}
      <TimedGroup inAt={T[6]} outAt={T[7]}>
        <EightPillars start={T[6]} end={T[7]} />
      </TimedGroup>

      {/* L08: Monitoreo — botes pesqueros de Alanya */}
      <TimedGroup inAt={T[7]} outAt={T[8]}>
        <FishingBoats start={T[7]} end={T[8]} />
      </TimedGroup>

      {/* L09: Sanciones graduadas — escalera verde→rojo */}
      <TimedGroup inAt={T[8]} outAt={T[9]}>
        <GradedSanctions start={T[8]} end={T[9]} />
      </TimedGroup>

      {/* L10-L11: Williamson + tres gobernanzas */}
      <TimedGroup inAt={T[9]} outAt={T[11]}>
        <ThreeGovernance start={T[9]} end={T[11]} />
      </TimedGroup>

      {/* L13: Comunes digitales */}
      <TimedGroup inAt={T[12]} outAt={T[13]}>
        <DigitalCommons start={T[12]} end={T[13]} />
      </TimedGroup>

      {/* L14: Ejidos mexicanos */}
      <TimedGroup inAt={T[13]} outAt={T[14]}>
        <Ejidos start={T[13]} end={T[14]} />
      </TimedGroup>

      {/* L15: Clima global */}
      <TimedGroup inAt={T[14]} outAt={T[15]}>
        <ClimateGlobe start={T[14]} end={T[15]} />
      </TimedGroup>

      {/* L16: Críticas */}
      <TimedGroup inAt={T[15]} outAt={T[16]}>
        <CritiqueBarriers start={T[15]} end={T[16]} />
      </TimedGroup>

      {/* L17: Nobel — medalla dorada */}
      <TimedGroup inAt={T[16]} outAt={T[17]}>
        <NobelMedal start={T[16]} end={T[17]} />
      </TimedGroup>

      {/* L18: Cierre — pradera viva gana */}
      <TimedGroup inAt={T[17]} outAt={END}>
        <ClosingSplit start={T[17]} end={END} />
      </TimedGroup>
    </CineStage>
  );
}
