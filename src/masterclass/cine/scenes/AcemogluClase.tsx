/**
 * AcemogluClase — masterclass cine del premio 2024 (Acemoglu, Johnson, Robinson):
 * por qué unas naciones son ricas y otras pobres. La respuesta: las INSTITUCIONES.
 *
 * El Nobel MÁS RECIENTE (octubre 2024). Gancho México absoluto: Nogales, la ciudad
 * partida por la frontera — misma gente, mismo clima, dos destinos. 18 escenas, ~632s.
 *
 * Concepto visual central: instituciones EXTRACTIVAS (pirámide que chupa hacia la
 * cima) vs INCLUSIVAS (red distribuida donde todos los nodos brillan). Voz Matilda.
 *
 * Arco:
 *   GANCHO      01 Nogales (la barda) · 02 la pregunta + 3 autores
 *   TEORÍA      03 inclusivas · 04 extractivas
 *   PRUEBA      05 colonias · 06 instrumento mortalidad · 07 reversión de fortuna
 *   MÉXICO      08 encomienda→hacienda→porfiriato · 09 coyunturas críticas
 *   MECANISMO   10 destrucción creativa · 11 Botswana · 12 China · 13 Corea
 *   CIERRE      14 cómo cambiar · 15 crítica · 16 LATAM · 17 Nobel 2024 · 18 cierre
 */

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import { CineStage, CineCamera, CineModel, useCineTime } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

const B = '/models/library/buildings/';
const SKY1 = `${B}skyscraper_b.glb`;
const SKY2 = `${B}skyscraper_d.glb`;
const OFFICE = `${B}office.glb`;
const HOUSE1 = `${B}house.glb`;
const HOUSE2 = `${B}house_b.glb`;
const HOUSE3 = `${B}house_c.glb`;
const WALL = `${B}wall.glb`;
[SKY1, SKY2, OFFICE, HOUSE1, HOUSE2, HOUSE3, WALL].forEach(m => AtomModel.preload(m));

const T = [0.45, 34.36, 74.19, 104.91, 137.3, 176.25, 211.78, 247.54, 284.42, 315.61, 351.61, 386.17, 422.24, 457.92, 491.44, 527.2, 560.79, 596.08];
const END = 632;
const beatEnd = (i: number) => (i < 17 ? T[i + 1] : END);

const GOLD = '#FDB813';
const BLUE = '#46C2FF';
const GREEN = '#34D399';
const RED = '#FF4444';
const PURPLE = '#A78BFA';

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

// ╔═══ 01 — NOGALES: la barda en el desierto, dos destinos ═══════════════════╗
// Izquierda (Arizona, rico): rascacielos altos y brillantes. Derecha (Sonora,
// pobre): casas bajas apagadas. Mismo desierto, mismo cielo. El muro al centro.
function Nogales({ start, end, x = 0 }: { start: number; end: number; x?: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const richG = useRef<THREE.Group>(null);
  const poorG = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const reveal = smooth(local(t, start + 1, start + 5));
    if (richG.current) richG.current.scale.setScalar(0.001 + reveal);
    if (poorG.current) poorG.current.scale.setScalar(0.001 + reveal);
  });
  return (
    <group ref={g} position={[x, 0, 0]}>
      {/* el muro al centro */}
      <group position={[0, 0, 0]}>
        {[-3, -1.5, 0, 1.5, 3].map((z, i) => (
          <AtomModel key={i} src={WALL} position={[0, 0.5, z]} color="#8A7355" glow={0.7} fitTo={1.8} />
        ))}
      </group>
      {/* IZQUIERDA: Nogales Arizona — rico, alto, dorado */}
      <group ref={richG} position={[-7, 0, 0]}>
        <AtomModel src={SKY1} position={[0, 0, -2]} color={GOLD} glow={1.6} fitTo={6.5} />
        <AtomModel src={SKY2} position={[-2.5, 0, 1]} color="#FFE0A0" glow={1.5} fitTo={5.5} />
        <AtomModel src={OFFICE} position={[1.5, 0, 2.5]} color={GOLD} glow={1.4} fitTo={4} />
      </group>
      {/* DERECHA: Nogales Sonora — pobre, bajo, apagado */}
      <group ref={poorG} position={[7, 0, 0]}>
        <AtomModel src={HOUSE1} position={[0, 0, -2]} color="#6A6258" glow={0.5} fitTo={2.2} />
        <AtomModel src={HOUSE2} position={[2.2, 0, 0.5]} color="#5E574E" glow={0.45} fitTo={2.0} />
        <AtomModel src={HOUSE3} position={[-1.8, 0, 2]} color="#6A6258" glow={0.5} fitTo={2.1} />
        <AtomModel src={HOUSE1} position={[1, 0, 3]} color="#5E574E" glow={0.4} fitTo={1.9} />
      </group>
    </group>
  );
}

// ╔═══ 02 — La pregunta + tres autores (cristales) ══════════════════════════╗
function ThreeAuthors({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const gems = useRef<THREE.Mesh[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const m = gems.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1 + i * (span * 0.12), start + 3 + i * (span * 0.12)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p);
      m.rotation.y += 0.02;
      m.position.y = 3 + Math.sin(t * 0.7 + i * 2) * 0.2;
    }
  });
  return (
    <group ref={g}>
      {[-3.5, 0, 3.5].map((x, i) => (
        <mesh key={i} ref={m => { if (m) gems.current[i] = m; }} position={[x, 3, 0]} visible={false}>
          <octahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#0E2236" emissive={[GOLD, BLUE, GREEN][i]} emissiveIntensity={2.4} flatShading toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 03 — Instituciones INCLUSIVAS: red distribuida, todos los nodos brillan ╗
function InclusiveNet({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.Mesh[]>([]);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const N = 9;
  const positions = useMemo(() => {
    const arr: [number, number, number][] = [[0, 3, 0]]; // centro = Estado
    for (let i = 0; i < N - 1; i++) {
      const a = (i / (N - 1)) * Math.PI * 2;
      arr.push([Math.cos(a) * 4, 3 + Math.sin(i * 1.3) * 1.2, Math.sin(a) * 4]);
    }
    return arr;
  }, []);
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let i = 1; i < N; i++) {
      pos.push(...positions[0], ...positions[i]);
      const nxt = i % (N - 1) + 1;
      pos.push(...positions[i], ...positions[nxt]);
    }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }, [positions]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    for (let i = 0; i < N; i++) {
      const m = nodes.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.06), start + 2.5 + i * (span * 0.06)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * (i === 0 ? 0.7 : 0.5));
      m.rotation.y += 0.03;
    }
    if (lineMat.current) lineMat.current.opacity = smooth(local(t, start + 2, start + span * 0.5)) * 0.4;
  });
  return (
    <group ref={g}>
      <lineSegments geometry={lineGeo}><lineBasicMaterial ref={lineMat} color={GREEN} transparent opacity={0} toneMapped={false} /></lineSegments>
      {positions.map((p, i) => (
        <mesh key={i} ref={m => { if (m) nodes.current[i] = m; }} position={p} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#0E2236" emissive={i === 0 ? GOLD : GREEN} emissiveIntensity={2.0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 04 — Instituciones EXTRACTIVAS: pirámide, riqueza fluye a la cima ══════╗
function ExtractivePyramid({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const apex = useRef<THREE.Mesh>(null);
  const apexMat = useRef<THREE.MeshStandardMaterial>(null);
  const flows = useRef<THREE.Mesh[]>([]);
  const baseMat = useRef<THREE.MeshStandardMaterial[]>([]);
  const FLOW = 10;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    // la élite (cima) se enriquece, la base se vacía
    const drain = smooth(local(t, start + 2, start + span * 0.7));
    if (apexMat.current) apexMat.current.emissiveIntensity = 1.5 + drain * 4;
    if (apex.current) apex.current.rotation.y += 0.01;
    baseMat.current.forEach(m => { if (m) m.emissiveIntensity = lerpN(1.6, 0.2, drain); });
    // partículas que suben de la base a la cima (extracción)
    for (let i = 0; i < FLOW; i++) {
      const m = flows.current[i]; if (!m) continue;
      const ph = ((t - start) * 0.4 + i / FLOW) % 1;
      const a = (i / FLOW) * Math.PI * 2;
      const r = lerpN(3.5, 0.1, ph);
      m.position.set(Math.cos(a) * r, lerpN(0.5, 5.5, ph), Math.sin(a) * r);
      m.scale.setScalar(0.2 * (1 - ph * 0.5));
      m.visible = t > start + 2;
    }
  });
  return (
    <group ref={g}>
      {/* pirámide escalonada (la jerarquía) */}
      {[0, 1, 2].map((lvl) => (
        <mesh key={lvl} position={[0, 0.6 + lvl * 1.4, 0]}>
          <cylinderGeometry args={[3.2 - lvl * 1.0, 3.8 - lvl * 1.0, 1.2, 4]} />
          <meshStandardMaterial ref={m => { if (m) baseMat.current[lvl] = m; }} color="#11151F" emissive="#5A6B8A" emissiveIntensity={1.6} flatShading toneMapped={false} />
        </mesh>
      ))}
      {/* la cima dorada = la élite */}
      <mesh ref={apex} position={[0, 5.3, 0]}>
        <coneGeometry args={[1.0, 1.6, 4]} />
        <meshStandardMaterial ref={apexMat} color="#11151F" emissive={GOLD} emissiveIntensity={1.5} flatShading toneMapped={false} />
      </mesh>
      {/* partículas de extracción */}
      {Array.from({ length: FLOW }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) flows.current[i] = m; }} visible={false}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 05 — Colonización: globo con puntos que se encienden distinto ═════════╗
function ColonialGlobe({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const globe = useRef<THREE.Mesh>(null);
  const dots = useRef<THREE.Mesh[]>([]);
  const N = 14;
  const config = useMemo(() => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    const tilt = (Math.sin(i * 2.3) * 0.7);
    const R = 2.6;
    const inclusive = i % 3 === 0; // unos pocos inclusivos
    return { pos: [Math.cos(a) * R * Math.cos(tilt), R * Math.sin(tilt), Math.sin(a) * R * Math.cos(tilt)] as [number, number, number], inclusive };
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (globe.current) globe.current.rotation.y += 0.004;
    const span = end - start;
    for (let i = 0; i < N; i++) {
      const m = dots.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1.5 + i * (span * 0.04), start + 3 + i * (span * 0.04)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 0.4);
    }
  });
  return (
    <group ref={g} position={[0, 3, 0]}>
      <mesh ref={globe}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial color="#0A1628" emissive="#16314F" emissiveIntensity={0.4} roughness={0.7} toneMapped={false} />
      </mesh>
      <group ref={el => { if (el && globe.current) { /* dots ride globe via parent */ } }}>
        {config.map((c, i) => (
          <mesh key={i} ref={m => { if (m) dots.current[i] = m; }} position={c.pos} visible={false}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshStandardMaterial color="#0E2236" emissive={c.inclusive ? GREEN : RED} emissiveIntensity={2.5} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ╔═══ 06 — Instrumento: mortalidad alta → PIB bajo (correlación) ════════════╗
function MortalityScatter({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const dots = useRef<THREE.Mesh[]>([]);
  const N = 18;
  const pts = useMemo(() => Array.from({ length: N }, (_, i) => {
    // correlación negativa: x = mortalidad, y = PIB inverso
    const x = -5 + (i / (N - 1)) * 10;
    const y = -x * 0.7 + (Math.sin(i * 3.1) * 0.9);
    return [x, y + 3.5, 0] as [number, number, number];
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    for (let i = 0; i < N; i++) {
      const m = dots.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1 + i * (span * 0.03), start + 2.5 + i * (span * 0.03)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 0.32);
      // color por cuadrante: alta mortalidad (x>0) = rojo, baja = verde
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.set(pts[i][0] > 0 ? RED : GREEN);
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* ejes */}
      <mesh position={[0, 3.5, -0.2]}><boxGeometry args={[11, 0.04, 0.04]} /><meshStandardMaterial color="#5A6B8A" emissive="#5A6B8A" emissiveIntensity={0.6} toneMapped={false} /></mesh>
      <mesh position={[-5.5, 6, -0.2]}><boxGeometry args={[0.04, 6, 0.04]} /><meshStandardMaterial color="#5A6B8A" emissive="#5A6B8A" emissiveIntensity={0.6} toneMapped={false} /></mesh>
      {pts.map((p, i) => (
        <mesh key={i} ref={m => { if (m) dots.current[i] = m; }} position={p} visible={false}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshStandardMaterial color="#0E2236" emissive={GREEN} emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 07 — Reversión de la fortuna: ciudades ricas que se apagan ════════════╗
function ReversalFortune({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const oldCities = useRef<THREE.MeshStandardMaterial[]>([]);
  const newCities = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const flip = smooth(local(t, start + span * 0.3, start + span * 0.75));
    // las antiguas (aztecas/incas/mogoles) se apagan
    oldCities.current.forEach(m => { if (m) m.emissiveIntensity = lerpN(2.6, 0.2, flip); });
    // las nuevas (europa/norteamérica) se encienden
    newCities.current.forEach(m => { if (m) m.emissiveIntensity = lerpN(0.2, 2.6, flip); });
  });
  return (
    <group ref={g} position={[0, 1, 0]}>
      {/* fila superior: civilizaciones antiguas ricas → se apagan */}
      {[-4, 0, 4].map((x, i) => (
        <mesh key={`old${i}`} position={[x, 4, 0]}>
          <boxGeometry args={[1.6, 2.4, 1.6]} />
          <meshStandardMaterial ref={m => { if (m) oldCities.current[i] = m; }} color="#1A1408" emissive={GOLD} emissiveIntensity={2.6} toneMapped={false} />
        </mesh>
      ))}
      {/* fila inferior: nuevas potencias → se encienden */}
      {[-4, 0, 4].map((x, i) => (
        <mesh key={`new${i}`} position={[x, 1, 0]}>
          <boxGeometry args={[1.6, 2.4, 1.6]} />
          <meshStandardMaterial ref={m => { if (m) newCities.current[i] = m; }} color="#08121A" emissive={BLUE} emissiveIntensity={0.2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 08 — México: encomienda→hacienda→porfiriato (misma pirámide, 3 épocas) ╗
function MexicanChain({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const groups = useRef<THREE.Group[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const grp = groups.current[i]; if (!grp) continue;
      const p = smooth(local(t, start + 1 + i * (span * 0.22), start + 3 + i * (span * 0.22)));
      grp.visible = p > 0.01;
      grp.scale.setScalar(0.001 + p);
      grp.children.forEach(ch => { ch.rotation.y += 0.008; });
    }
  });
  // misma estructura (pirámide extractiva), distinta época = mismo color de cima dorada
  const miniPyramid = (label: string) => (
    <>
      {[0, 1].map(lvl => (
        <mesh key={lvl} position={[0, 0.4 + lvl * 0.9, 0]}>
          <cylinderGeometry args={[1.4 - lvl * 0.6, 1.7 - lvl * 0.6, 0.8, 4]} />
          <meshStandardMaterial color="#11151F" emissive="#5A6B8A" emissiveIntensity={1.0} flatShading toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, 2.3, 0]}>
        <coneGeometry args={[0.6, 0.9, 4]} />
        <meshStandardMaterial color="#11151F" emissive={GOLD} emissiveIntensity={2.2} flatShading toneMapped={false} />
      </mesh>
    </>
  );
  return (
    <group ref={g} position={[0, 0.5, 0]}>
      <group ref={el => { if (el) groups.current[0] = el; }} position={[-5, 0, 0]} visible={false}>{miniPyramid('encomienda')}</group>
      <group ref={el => { if (el) groups.current[1] = el; }} position={[0, 0, 0]} visible={false}>{miniPyramid('hacienda')}</group>
      <group ref={el => { if (el) groups.current[2] = el; }} position={[5, 0, 0]} visible={false}>{miniPyramid('porfiriato')}</group>
    </group>
  );
}

// ╔═══ 09 — Coyuntura crítica: una bifurcación, dos caminos ══════════════════╗
function CriticalJuncture({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const pathA = useRef<THREE.Mesh>(null);
  const pathB = useRef<THREE.Mesh>(null);
  const aMat = useRef<THREE.MeshStandardMaterial>(null);
  const bMat = useRef<THREE.MeshStandardMaterial>(null);
  const node = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const split = smooth(local(t, start + 2, start + span * 0.6));
    if (pathA.current) { pathA.current.scale.y = Math.max(0.001, split); pathA.current.position.y = 3 + split * 2; }
    if (pathB.current) { pathB.current.scale.y = Math.max(0.001, split); pathB.current.position.y = 3 + split * 2; }
    // el camino inclusivo (verde) brilla más, el extractivo (rojo) se apaga
    const choose = smooth(local(t, start + span * 0.55, end));
    if (aMat.current) aMat.current.emissiveIntensity = lerpN(1.5, 3.2, choose);
    if (bMat.current) bMat.current.emissiveIntensity = lerpN(1.5, 0.4, choose);
    if (node.current) node.current.rotation.y += 0.03;
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* el nodo de decisión */}
      <mesh ref={node} position={[0, 2.5, 0]}>
        <icosahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial color="#0E2236" emissive={GOLD} emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
      {/* camino A: inclusivo (verde, izquierda) */}
      <mesh ref={pathA} position={[-2.5, 3, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.4, 4, 0.4]} />
        <meshStandardMaterial ref={aMat} color="#0E2236" emissive={GREEN} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {/* camino B: extractivo (rojo, derecha) */}
      <mesh ref={pathB} position={[2.5, 3, 0]} rotation={[0, 0, -0.5]}>
        <boxGeometry args={[0.4, 4, 0.4]} />
        <meshStandardMaterial ref={bMat} color="#0E2236" emissive={RED} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ╔═══ 10 — Destrucción creativa: lo viejo se rompe, lo nuevo brilla ═════════╗
function CreativeDestruction({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const oldMat = useRef<THREE.MeshStandardMaterial>(null);
  const oldMesh = useRef<THREE.Mesh>(null);
  const newMesh = useRef<THREE.Mesh>(null);
  const newMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const destroy = smooth(local(t, start + span * 0.35, start + span * 0.75));
    // lo viejo cae y se apaga
    if (oldMesh.current) { oldMesh.current.scale.setScalar(Math.max(0.001, 1 - destroy)); oldMesh.current.rotation.z += 0.04; oldMesh.current.position.y = 3 - destroy * 2; }
    if (oldMat.current) oldMat.current.emissiveIntensity = lerpN(2.0, 0.1, destroy);
    // lo nuevo emerge y brilla
    if (newMesh.current) { newMesh.current.visible = destroy > 0.01; newMesh.current.scale.setScalar(0.001 + destroy); newMesh.current.rotation.y += 0.04; }
    if (newMat.current) newMat.current.emissiveIntensity = 0.3 + destroy * 3;
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <mesh ref={oldMesh} position={[-2, 3, 0]}>
        <boxGeometry args={[1.8, 1.8, 1.8]} />
        <meshStandardMaterial ref={oldMat} color="#1A1408" emissive="#8A6A30" emissiveIntensity={2.0} flatShading toneMapped={false} />
      </mesh>
      <mesh ref={newMesh} position={[2, 3, 0]} visible={false}>
        <octahedronGeometry args={[1.3, 0]} />
        <meshStandardMaterial ref={newMat} color="#0E2236" emissive={BLUE} emissiveIntensity={0.3} flatShading toneMapped={false} />
      </mesh>
    </group>
  );
}

// ╔═══ 11 — Botswana: una luz que crece donde otras se apagan ════════════════╗
function Botswana({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const star = useRef<THREE.Mesh>(null);
  const starMat = useRef<THREE.MeshStandardMaterial>(null);
  const others = useRef<THREE.MeshStandardMaterial[]>([]);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const grow = smooth(local(t, start + 2, start + span * 0.7));
    if (star.current) { star.current.scale.setScalar(0.4 + grow * 1.2); star.current.rotation.y += 0.02; }
    if (starMat.current) starMat.current.emissiveIntensity = 1 + grow * 4;
    if (light.current) light.current.intensity = grow * 8;
    others.current.forEach((m, i) => { if (m) m.emissiveIntensity = lerpN(1.2, 0.25, grow) + Math.sin(t + i) * 0.05; });
  });
  return (
    <group ref={g} position={[0, 3, 0]}>
      {/* Botswana = el diamante que brilla */}
      <mesh ref={star} position={[0, 0, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial ref={starMat} color="#0E2236" emissive={GREEN} emissiveIntensity={1} flatShading toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#7AFF9A" intensity={0} distance={25} decay={2} />
      {/* los otros países africanos que no despegaron */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.cos(a) * 4, Math.sin(i * 1.7) * 1.5, Math.sin(a) * 4]}>
            <sphereGeometry args={[0.4, 12, 12]} />
            <meshStandardMaterial ref={m => { if (m) others.current[i] = m; }} color="#1A1010" emissive={RED} emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ╔═══ 12 — China: crecimiento que sube y se topa con techo ══════════════════╗
function ChinaCeiling({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const bar = useRef<THREE.Mesh>(null);
  const ceiling = useRef<THREE.Mesh>(null);
  const ceilMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    // crece rápido (catch-up) y se aplana al topar el techo
    const dt = Math.max(0, t - start - 1);
    const h = 6 * (1 - Math.exp(-0.5 * dt));
    if (bar.current) { bar.current.scale.y = Math.max(0.001, h); bar.current.position.y = h / 2; }
    // el techo destella cuando lo toca
    const hit = smooth(local(t, start + span * 0.55, start + span * 0.7));
    if (ceiling.current) ceiling.current.visible = hit > 0.01;
    if (ceilMat.current) ceilMat.current.emissiveIntensity = hit * (2 + Math.sin(t * 6) * 1);
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <mesh ref={bar} position={[0, 0, 0]}>
        <boxGeometry args={[2, 1, 2]} />
        <meshStandardMaterial color="#7A1212" emissive={RED} emissiveIntensity={1.8} toneMapped={false} />
      </mesh>
      <mesh ref={ceiling} position={[0, 6.3, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial ref={ceilMat} color={GOLD} emissive={GOLD} emissiveIntensity={0} transparent opacity={0.4} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ╔═══ 13 — Corea: paralelo 38, norte oscuro vs sur brillante ════════════════╗
function TwoKoreas({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const southG = useRef<THREE.Group>(null);
  const northMat = useRef<THREE.MeshStandardMaterial[]>([]);
  const southMat = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const diverge = smooth(local(t, start + 2, start + span * 0.7));
    // el sur se enciende (rascacielos), el norte queda apagado
    southMat.current.forEach((m, i) => { if (m) m.emissiveIntensity = lerpN(0.3, 2.4, diverge) + Math.sin(t * 2 + i) * 0.1; });
    northMat.current.forEach(m => { if (m) m.emissiveIntensity = lerpN(0.3, 0.15, diverge); });
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* la línea divisoria (paralelo 38) */}
      <mesh position={[0, 2, 0]}><boxGeometry args={[0.15, 4, 8]} /><meshStandardMaterial color={RED} emissive={RED} emissiveIntensity={1.5} toneMapped={false} /></mesh>
      {/* NORTE (izquierda) — apagado */}
      <group position={[-5, 0, 0]}>
        {[[-1, -2], [1, 0], [-1.5, 2]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.8, z]}>
            <boxGeometry args={[1, 1.6, 1]} />
            <meshStandardMaterial ref={m => { if (m) northMat.current[i] = m; }} color="#0A0A0A" emissive="#3A4150" emissiveIntensity={0.3} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* SUR (derecha) — rascacielos brillantes */}
      <group ref={southG} position={[5, 0, 0]}>
        {[[-1, -2, 3.5], [1, 0.5, 4.5], [-0.5, 2, 3], [1.8, -1, 2.8]].map(([x, z, h], i) => (
          <mesh key={i} position={[x, h / 2, z]}>
            <boxGeometry args={[0.9, h, 0.9]} />
            <meshStandardMaterial ref={m => { if (m) southMat.current[i] = m; }} color="#0E2236" emissive={BLUE} emissiveIntensity={0.3} toneMapped={false} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ╔═══ 14 — Cómo cambiar: una ventana/puerta que se abre ═════════════════════╗
function WindowOpens({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const doorL = useRef<THREE.Mesh>(null);
  const doorR = useRef<THREE.Mesh>(null);
  const lightMat = useRef<THREE.MeshStandardMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const open = smooth(local(t, start + 2, start + span * 0.7));
    if (doorL.current) doorL.current.position.x = lerpN(-0.9, -3, open);
    if (doorR.current) doorR.current.position.x = lerpN(0.9, 3, open);
    if (lightMat.current) lightMat.current.emissiveIntensity = open * 3.5;
    if (light.current) light.current.intensity = open * 7;
  });
  return (
    <group ref={g} position={[0, 3, 0]}>
      {/* luz detrás de la puerta */}
      <mesh position={[0, 0, -0.5]}><planeGeometry args={[3, 4]} /><meshStandardMaterial ref={lightMat} color={GOLD} emissive={GOLD} emissiveIntensity={0} toneMapped={false} /></mesh>
      <pointLight ref={light} position={[0, 0, 1]} color="#FFE0A0" intensity={0} distance={20} decay={2} />
      {/* dos hojas de puerta */}
      <mesh ref={doorL} position={[-0.9, 0, 0]}><boxGeometry args={[1.8, 4, 0.2]} /><meshStandardMaterial color="#11151F" emissive={BLUE} emissiveIntensity={0.6} toneMapped={false} /></mesh>
      <mesh ref={doorR} position={[0.9, 0, 0]}><boxGeometry args={[1.8, 4, 0.2]} /><meshStandardMaterial color="#11151F" emissive={BLUE} emissiveIntensity={0.6} toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 15 — Críticas: muros que aparecen y se disuelven ═════════════════════╗
function CritiqueWalls({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const walls = useRef<THREE.Mesh[]>([]);
  const wallMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 2; i++) {
      const m = walls.current[i]; if (!m) continue;
      const appear = smooth(local(t, start + 1.5 + i * (span * 0.2), start + 3.5 + i * (span * 0.2)));
      const dissolve = smooth(local(t, start + span * 0.7, end));
      m.visible = appear > 0.01;
      m.scale.set(1, Math.max(0.001, appear * (1 - dissolve * 0.85)), 1);
      if (wallMats.current[i]) {
        wallMats.current[i].emissiveIntensity = appear * 1.4 * (1 - dissolve * 0.7);
        wallMats.current[i].opacity = 0.3 + appear * 0.5 * (1 - dissolve * 0.8);
      }
    }
  });
  return (
    <group ref={g} position={[0, 3, 0]}>
      {[[-2.5, RED], [2.5, '#FF7A1A']].map(([x, c], i) => (
        <mesh key={i} ref={m => { if (m) walls.current[i] = m; }} position={[x as number, 0, 0]} visible={false}>
          <boxGeometry args={[2.2, 4, 0.3]} />
          <meshStandardMaterial ref={m => { if (m) wallMats.current[i] = m; }} color="#11151F" emissive={c as string} emissiveIntensity={0.4} transparent opacity={0.3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 16 — LATAM: mapa de luces, una que despega ═══════════════════════════╗
function LatamLights({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const dots = useRef<THREE.Mesh[]>([]);
  const dotMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const N = 8;
  const pts = useMemo(() => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    return [Math.cos(a) * 3.5, 3 + Math.sin(i * 1.9) * 1.5, Math.sin(a) * 2] as [number, number, number];
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const hope = smooth(local(t, start + span * 0.4, start + span * 0.85));
    for (let i = 0; i < N; i++) {
      const m = dots.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1 + i * (span * 0.05), start + 2.5 + i * (span * 0.05)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 0.4);
      // una (México) se va encendiendo a verde, las demás siguen rojas tenues
      if (dotMats.current[i]) {
        if (i === 2) { dotMats.current[i].emissive.set(GREEN); dotMats.current[i].emissiveIntensity = 1 + hope * 3; }
        else dotMats.current[i].emissiveIntensity = 1.0;
      }
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {pts.map((p, i) => (
        <mesh key={i} ref={m => { if (m) dots.current[i] = m; }} position={p} visible={false}>
          <sphereGeometry args={[1, 14, 14]} />
          <meshStandardMaterial ref={m => { if (m) dotMats.current[i] = m; }} color="#1A1010" emissive={i === 2 ? GREEN : '#C04030'} emissiveIntensity={1} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 17 — Nobel 2024: tres medallas descendiendo ══════════════════════════╗
function NobelTriple({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const medals = useRef<THREE.Mesh[]>([]);
  const medalMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const light = useRef<THREE.PointLight>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const m = medals.current[i]; if (!m) continue;
      const descent = smooth(local(t, start + 0.5 + i * 1.2, start + 4 + i * 1.2));
      m.position.y = lerpN(14, 4.5, descent);
      m.rotation.y += 0.025;
      if (medalMats.current[i]) medalMats.current[i].emissiveIntensity = 1 + descent * 4;
    }
    if (light.current) light.current.intensity = smooth(local(t, start + 1, start + 6)) * 12;
  });
  return (
    <group ref={g}>
      {[-3, 0, 3].map((x, i) => (
        <mesh key={i} ref={m => { if (m) medals.current[i] = m; }} position={[x, 14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[1.2, 1.2, 0.18, 32]} />
          <meshStandardMaterial ref={m => { if (m) medalMats.current[i] = m; }} color="#7A5A12" emissive={GOLD} emissiveIntensity={1} metalness={0.8} roughness={0.2} toneMapped={false} />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 7, 3]} color="#FFE0A0" intensity={0} distance={35} decay={2} />
    </group>
  );
}

// ╔═══ 18 — Cierre: cadena de ideas Solow→Acemoglu→Lucas→Romer ══════════════╗
function IdeaChain({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.Mesh[]>([]);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const labels = ['Solow', 'Acemoglu', 'Lucas', 'Romer'];
  const colors = ['#5AA0D0', GOLD, PURPLE, GREEN];
  const xs = [-6, -2, 2, 6];
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let i = 0; i < 3; i++) pos.push(xs[i], 3, 0, xs[i + 1], 3, 0);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }, []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    for (let i = 0; i < 4; i++) {
      const m = nodes.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1 + i * (span * 0.12), start + 3 + i * (span * 0.12)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 0.8);
      m.rotation.y += 0.03;
      // Acemoglu (i=1) pulsa más fuerte
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (i === 1 ? 2.8 : 1.8) + Math.sin(t * 1.5 + i) * 0.3;
    }
    if (lineMat.current) lineMat.current.opacity = smooth(local(t, start + 3, start + span * 0.6)) * 0.5;
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <lineSegments geometry={lineGeo}><lineBasicMaterial ref={lineMat} color={GOLD} transparent opacity={0} toneMapped={false} /></lineSegments>
      {xs.map((x, i) => (
        <mesh key={i} ref={m => { if (m) nodes.current[i] = m; }} position={[x, 3, 0]} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#0E2236" emissive={colors[i]} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Cámara: 18 cortes con deriva ───────────────────────────────────────────
function buildCamKeys(): CineCamKey[] {
  const LOOK: [number, number, number] = [0, 3, 0];
  const shots: { p0: [number, number, number]; p1: [number, number, number]; look?: [number, number, number] }[] = [
    { p0: [-14, 6, 20],  p1: [10, 5, 16],   look: [0, 2.5, 0] },   // 01 Nogales pan L→R
    { p0: [8, 5, 14],    p1: [2, 3.5, 9],    look: [0, 3, 0] },     // 02 tres autores
    { p0: [-9, 5, 14],   p1: [-3, 4, 10],    look: [0, 3.5, 0] },   // 03 inclusivas (red)
    { p0: [7, 4, 13],    p1: [2, 3, 9],      look: [0, 3, 0] },     // 04 extractivas (pirámide)
    { p0: [0, 7, 13],    p1: [4, 5, 10],     look: [0, 3, 0] },     // 05 globo colonial
    { p0: [-8, 6, 14],   p1: [-2, 4.5, 10],  look: [0, 4, 0] },     // 06 scatter
    { p0: [6, 5, 13],    p1: [-3, 4, 10],    look: [0, 3, 0] },     // 07 reversión
    { p0: [-10, 5, 15],  p1: [9, 5, 15],     look: [0, 2.5, 0] },   // 08 cadena México pan
    { p0: [5, 5, 12],    p1: [1, 3.5, 8],    look: [0, 3, 0] },     // 09 coyuntura
    { p0: [-6, 4, 12],   p1: [4, 4, 10],     look: [0, 3, 0] },     // 10 destrucción creativa
    { p0: [4, 5, 12],    p1: [1, 4, 8],      look: [0, 3, 0] },     // 11 Botswana
    { p0: [-6, 5, 13],   p1: [-2, 3.5, 9],   look: [0, 3, 0] },     // 12 China techo
    { p0: [-11, 5, 16],  p1: [9, 5, 14],     look: [0, 2.5, 0] },   // 13 Corea pan
    { p0: [5, 4, 11],    p1: [1, 3.5, 8],    look: [0, 3, 0] },     // 14 ventana
    { p0: [-6, 4, 12],   p1: [-2, 3.5, 9],   look: [0, 3, 0] },     // 15 críticas
    { p0: [6, 5, 12],    p1: [-2, 4, 9],     look: [0, 3, 0] },     // 16 LATAM
    { p0: [0, 8, 16],    p1: [2, 6, 11],     look: [0, 5, 0] },     // 17 Nobel triple
    { p0: [-10, 5, 16],  p1: [0, 6, 14],     look: [0, 3, 0] },     // 18 cadena ideas
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
  'Una barda en el desierto de Sonora. De un lado, Nogales Arizona. Del otro, Nogales Sonora. Misma gente. Pero del lado americano el ingreso es tres veces mayor. ¿Por qué? Las instituciones.',
  'La pregunta más grande de la economía: ¿por qué unos países son ricos y otros pobres? En 2001, tres investigadores —Acemoglu, Johnson y Robinson— cambiaron la conversación.',
  'Instituciones inclusivas: el poder NO está concentrado. Hay contrapesos, Estado de derecho. Y centralización suficiente para hacer cumplir las leyes. Esa combinación distingue a los países prósperos.',
  'Instituciones extractivas: el poder se concentra en una élite. Las reglas transfieren riqueza de la mayoría a la minoría. Sin incentivos para innovar. Un círculo vicioso que dura siglos.',
  'Los europeos no colonizaron igual. Donde podían instalarse, fundaron instituciones inclusivas. Donde no, crearon estados extractivos para sacar oro y esclavos. Y se fueron. Las instituciones se quedaron.',
  'El truco genial: la mortalidad de los colonizadores como variable instrumental. La mortalidad de hace trescientos años predice el PIB de hoy. La relación es espectacular.',
  'La reversión de la fortuna: en 1500 los más ricos eran aztecas, incas y mogoles. Hoy México, Perú e India son de ingreso medio-bajo. Los colonizadores fueron a los lugares ricos. El mundo se invirtió.',
  'En México la encomienda fue la institución extractiva por excelencia. Luego la hacienda, luego el porfiriato. Diferentes nombres, misma estructura. Las instituciones extractivas mexicanas tienen 500 años.',
  'Las coyunturas críticas cambian las instituciones. La Revolución Gloriosa de 1688: el parlamento le quitó poder al rey. Un momento crítico, y doscientos años de divergencia.',
  'Las instituciones inclusivas permiten la destrucción creativa. El iPhone destruyó a Nokia. Pero las élites extractivas la odian: ellos son los que serían destruidos. Por eso bloquean la innovación.',
  'Botswana: la excepción. Era de los más pobres en 1966, pero tenía instituciones tribales con participación. Invirtió los diamantes en educación. Hoy es el PIB per cápita más alto de África subsahariana.',
  'China creció al 10% con instituciones extractivas. ¿Refuta la teoría? No: creció por catch-up tecnológico. Pero sin destrucción creativa, el crecimiento tiene techo.',
  'Corea: el experimento más limpio. Misma cultura, mismo idioma. En 1945 el paralelo 38 partió el país. Hoy el Sur tiene 20 veces el PIB del Norte. Las instituciones, no la gente.',
  '¿Cómo se cambian? Acemoglu no es optimista fácil. Las instituciones son persistentes. Pero las coyunturas abren ventanas. El cambio requiere coaliciones amplias que limiten a las élites.',
  'La crítica: la teoría explica todo, ¿no es circular? Él responde con el instrumento de la mortalidad y los experimentos naturales: las dos Coreas, las dos Nogales, las dos Alemanias.',
  'Para Latinoamérica el mensaje es brutal y esperanzador: las instituciones extractivas no se deshacen con un presidente nuevo. Pero SÍ se pueden cambiar. Corea lo hizo en 40 años.',
  'Octubre 2024. Acemoglu, Johnson y Robinson reciben el Nobel. El más reciente. Todo empezó con una pregunta: ¿por qué Nogales Arizona no se parece a Nogales Sonora?',
  'Solow dijo que la tecnología importa. Acemoglu dice por qué unos pueden innovar y otros no: las instituciones. Si tus reglas protegen al de arriba, nadie innova. Las ideas se acumulan solo si las reglas lo permiten.',
];

export default function AcemogluClase() {
  const subtitles = SUBS.map((text, i) => ({ text, at: T[i], until: beatEnd(i) }));
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      audio="/audio/clase-acemoglu/narration.mp3?v=1"
      duration={END}
      chapter="Acemoglu · 2024 · por qué fracasan las naciones"
      fov={50}
      cameraPos={[-14, 6, 20]}
      postfx={{ intensity: 1.2, threshold: 0.44, vignette: 0.82, aberration: 0.0005 }}
      subtitles={subtitles}
      title={{ text: 'Por qué unos países son ricos', at: T[0] + 0.3, until: beatEnd(0) }}
    >
      <CineCamera keys={buildCamKeys()} live={1} />

      <NebulaWorld
        url="/limones-nebula-lite.bin"
        scale={44}
        holeR={17}
        ghostWindow={[T[3], T[4]]}
        firstIgnite={T[8]}
        chain={[
          T[9], T[9] + 3,
          T[10], T[10] + 3,
          T[12], T[12] + 3, T[12] + 6,
          T[13] + 2, T[15] + 2,
          T[16], T[16] + 3, T[16] + 6,
          T[17], T[17] + 3,
        ]}
        dawnAt={T[16]}
        beatTimes={T}
        calmFrom={END - 5}
      />

      <ambientLight intensity={0.2} color="#2A2640" />
      <directionalLight position={[5, 12, 4]} intensity={0.5} color="#FFE6C0" />

      {/* 01 — Nogales: el gancho */}
      <TimedGroup inAt={T[0]} outAt={T[1]}><Nogales start={T[0]} end={T[1]} /></TimedGroup>
      {/* 02 — Tres autores */}
      <TimedGroup inAt={T[1]} outAt={T[2]}><ThreeAuthors start={T[1]} end={T[2]} /></TimedGroup>
      {/* 03 — Inclusivas */}
      <TimedGroup inAt={T[2]} outAt={T[3]}><InclusiveNet start={T[2]} end={T[3]} /></TimedGroup>
      {/* 04 — Extractivas */}
      <TimedGroup inAt={T[3]} outAt={T[4]}><ExtractivePyramid start={T[3]} end={T[4]} /></TimedGroup>
      {/* 05 — Colonias */}
      <TimedGroup inAt={T[4]} outAt={T[5]}><ColonialGlobe start={T[4]} end={T[5]} /></TimedGroup>
      {/* 06 — Instrumento mortalidad */}
      <TimedGroup inAt={T[5]} outAt={T[6]}><MortalityScatter start={T[5]} end={T[6]} /></TimedGroup>
      {/* 07 — Reversión de la fortuna */}
      <TimedGroup inAt={T[6]} outAt={T[7]}><ReversalFortune start={T[6]} end={T[7]} /></TimedGroup>
      {/* 08 — México: cadena extractiva */}
      <TimedGroup inAt={T[7]} outAt={T[8]}><MexicanChain start={T[7]} end={T[8]} /></TimedGroup>
      {/* 09 — Coyuntura crítica */}
      <TimedGroup inAt={T[8]} outAt={T[9]}><CriticalJuncture start={T[8]} end={T[9]} /></TimedGroup>
      {/* 10 — Destrucción creativa */}
      <TimedGroup inAt={T[9]} outAt={T[10]}><CreativeDestruction start={T[9]} end={T[10]} /></TimedGroup>
      {/* 11 — Botswana */}
      <TimedGroup inAt={T[10]} outAt={T[11]}><Botswana start={T[10]} end={T[11]} /></TimedGroup>
      {/* 12 — China techo */}
      <TimedGroup inAt={T[11]} outAt={T[12]}><ChinaCeiling start={T[11]} end={T[12]} /></TimedGroup>
      {/* 13 — Corea */}
      <TimedGroup inAt={T[12]} outAt={T[13]}><TwoKoreas start={T[12]} end={T[13]} /></TimedGroup>
      {/* 14 — Cómo cambiar */}
      <TimedGroup inAt={T[13]} outAt={T[14]}><WindowOpens start={T[13]} end={T[14]} /></TimedGroup>
      {/* 15 — Críticas */}
      <TimedGroup inAt={T[14]} outAt={T[15]}><CritiqueWalls start={T[14]} end={T[15]} /></TimedGroup>
      {/* 16 — LATAM */}
      <TimedGroup inAt={T[15]} outAt={T[16]}><LatamLights start={T[15]} end={T[16]} /></TimedGroup>
      {/* 17 — Nobel 2024 */}
      <TimedGroup inAt={T[16]} outAt={T[17]}><NobelTriple start={T[16]} end={T[17]} /></TimedGroup>
      {/* 18 — Cierre: cadena de ideas */}
      <TimedGroup inAt={T[17]} outAt={END}><IdeaChain start={T[17]} end={END} /></TimedGroup>
    </CineStage>
  );
}
