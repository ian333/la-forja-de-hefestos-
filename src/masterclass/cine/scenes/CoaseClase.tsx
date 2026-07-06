/**
 * CoaseClase — masterclass cine del premio 1991 (Ronald Coase): por qué existen
 * las empresas. La decisión make-or-buy, los costos de transacción.
 *
 * "Si el mercado es tan eficiente, ¿por qué trabajas en una empresa con jefe?"
 * 18 escenas, ~438s (7.3 min). Voz Matilda. Animaciones GRANDES que LLENAN el
 * cuadro (cero void muerto — la doctrina del scope: ocupar todo el espacio).
 *
 * Concepto central: la EMPRESA como una BURBUJA que crece absorbiendo
 * actividades del mercado hasta su tamaño óptimo (coordinar = transactar).
 *
 * Arco:
 *   PARADOJA    01 Apple vs freelancers · 02 jerarquía no es mercado
 *   COASE       03 visita fábricas · 04 el paper de 11 páginas
 *   TEORÍA      05 costos de transacción · 06 make-or-buy · 07 tamaño óptimo
 *   HISTORIA    08 Ford integra todo · 09 Toyota lo opuesto · 10 Apple híbrido · 11 internet encoge
 *   TEOREMA     12 costos cero · 13 río contaminado · 14 importa la propiedad · 15 críticas
 *   CIERRE      16 Williamson hold-up · 17 legado · 18 cierre
 */

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import { CineStage, CineCamera, useCineTime } from '@/masterclass/cine';
import NebulaWorld from '@/masterclass/cine/NebulaWorld';
import { AnchorWord } from '@/masterclass/cine/dynamics';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

// 9:16 (vertical) recorta los layouts horizontales: en portrait, las escenas
// ANCHAS se escalan (pscale) para que entren completas. Lo vertical/centrado va a 1.
const PORTRAIT = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;

const B = '/models/library/buildings/';
const SKY1 = `${B}skyscraper_b.glb`;
const SKY2 = `${B}skyscraper_d.glb`;
const OFFICE = `${B}office.glb`;
const FACTORY = `${B}factory.glb`;
const TOWER = `${B}tower.glb`;
[SKY1, SKY2, OFFICE, FACTORY, TOWER].forEach(m => AtomModel.preload(m));

const T = [0.45, 23.41, 40.05, 59.88, 80.98, 104.49, 126.98, 150.33, 174.42, 197.69, 222.56, 249.6, 271.98, 300.06, 325.19, 350.79, 376.16, 405.05];
const END = 438;
const beatEnd = (i: number) => (i < 17 ? T[i + 1] : END);

const GOLD = '#FDB813';
const BLUE = '#46C2FF';
const GREEN = '#34D399';
const RED = '#FF4444';
const PURPLE = '#A78BFA';
const CYAN = '#22D3EE';

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

function TimedGroup({ inAt, outAt, pscale = 1, children }: { inAt: number; outAt: number; pscale?: number; children: ReactNode }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  useFrame(() => {
    const on = fadeGroup(g.current, timeRef.current, inAt, outAt);
    if (on && inner.current) inner.current.scale.setScalar(PORTRAIT ? pscale : 1);
  });
  return <group ref={g}><group ref={inner}>{children}</group></group>;
}

// ╔═══ 01 — Apple vs freelancers: 1 torre gigante rodeada de 40 nodos sueltos ═╗
// LLENA el cuadro: la empresa al centro (alta), enjambre de freelancers en TODO
// el volumen alrededor. El contraste = la pregunta.
function AppleVsFreelancers({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const tower = useRef<THREE.Group>(null);
  const dots = useRef<THREE.Mesh[]>([]);
  const N = 44;
  const targets = useMemo(() => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 * 3 + i * 0.7;
    const r = 5.5 + (i % 5) * 1.3;
    const y = 1 + ((i * 1.7) % 8);
    return [Math.cos(a) * r, y, Math.sin(a) * r] as [number, number, number];
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const reveal = smooth(local(t, start + 1, start + 4));
    if (tower.current) tower.current.scale.setScalar(0.001 + reveal);
    for (let i = 0; i < N; i++) {
      const m = dots.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 2 + (i / N) * 4, start + 4 + (i / N) * 4));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 0.32);
      m.position.y = targets[i][1] + Math.sin(t * 1.2 + i) * 0.25;
      m.rotation.y += 0.04;
    }
  });
  return (
    <group ref={g}>
      {/* la empresa: torre dorada alta y grande al centro */}
      <group ref={tower} position={[0, 0, 0]}>
        <AtomModel src={SKY1} position={[0, 0, 0]} color={GOLD} glow={1.7} fitTo={9} />
      </group>
      {/* los 44 freelancers dispersos por TODO el volumen */}
      {targets.map((p, i) => (
        <mesh key={i} ref={m => { if (m) dots.current[i] = m; }} position={p} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#0E2236" emissive={BLUE} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 02 — Jerarquía (pirámide de mando) vs mercado (red) — los dos, grandes ═╗
function HierarchyVsMarket({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const pyr = useRef<THREE.Group>(null);
  const arrows = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (pyr.current) pyr.current.rotation.y += 0.004;
    // flechas de mando que bajan del jefe (arriba) a los empleados
    for (let i = 0; i < 6; i++) {
      const m = arrows.current[i]; if (!m) continue;
      const ph = ((t - start) * 0.5 + i / 6) % 1;
      m.position.y = lerpN(7, 2, ph);
      m.visible = t > start + 1.5;
      m.scale.setScalar(0.3 * (1 - ph * 0.4));
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* la pirámide grande — jerarquía */}
      <group ref={pyr}>
        {[0, 1, 2, 3].map(lvl => (
          <mesh key={lvl} position={[0, 0.8 + lvl * 1.6, 0]}>
            <cylinderGeometry args={[4.2 - lvl * 1.0, 4.8 - lvl * 1.0, 1.5, 4]} />
            <meshStandardMaterial color="#11151F" emissive={lvl === 3 ? GOLD : '#5A6B8A'} emissiveIntensity={lvl === 3 ? 2.6 : 1.2} flatShading toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* flechas de mando hacia abajo */}
      {Array.from({ length: 6 }).map((_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return (
          <mesh key={i} ref={m => { if (m) arrows.current[i] = m; }} position={[Math.cos(a) * 2.5, 5, Math.sin(a) * 2.5]} rotation={[Math.PI, 0, 0]} visible={false}>
            <coneGeometry args={[1, 2, 4]} />
            <meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={2.5} toneMapped={false} />
          </mesh>
        );
      })}
    </group>
  );
}

// ╔═══ 03 — Coase visita fábricas: tres fábricas grandes ═════════════════════╗
function CoaseVisits({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const facts = useRef<THREE.Group[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const f = facts.current[i]; if (!f) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.18), start + 2.5 + i * (span * 0.18)));
      f.visible = p > 0.01;
      f.scale.setScalar(0.001 + p);
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <group ref={f => { if (f) facts.current[0] = f; }} position={[-7, 0, -1]} visible={false}><AtomModel src={FACTORY} color={CYAN} glow={0.85} fitTo={6} /></group>
      <group ref={f => { if (f) facts.current[1] = f; }} position={[0, 0, 1]} visible={false}><AtomModel src={FACTORY} color={GOLD} glow={0.95} fitTo={7.5} /></group>
      <group ref={f => { if (f) facts.current[2] = f; }} position={[7, 0, -1]} visible={false}><AtomModel src={FACTORY} color="#5AA0D0" glow={0.85} fitTo={6} /></group>
    </group>
  );
}

// ╔═══ 04 — El paper: un gran libro/documento que brilla ═════════════════════╗
function ThePaper({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const book = useRef<THREE.Mesh>(null);
  const bookMat = useRef<THREE.MeshStandardMaterial>(null);
  const pages = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (book.current) { book.current.rotation.y += 0.006; book.current.position.y = 4 + Math.sin(t * 0.5) * 0.2; }
    const glow = 0.5 + 0.5 * Math.sin(t * 1.5);
    if (bookMat.current) bookMat.current.emissiveIntensity = 1.5 + glow * 1.5;
    // 11 páginas que orbitan
    for (let i = 0; i < 11; i++) {
      const m = pages.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1 + i * 0.25, start + 2.5 + i * 0.25));
      m.visible = p > 0.01;
      const a = (i / 11) * Math.PI * 2 + t * 0.3;
      m.position.set(Math.cos(a) * 4 * p, 4 + Math.sin(i * 1.3) * 2, Math.sin(a) * 4 * p);
      m.rotation.y = a;
      m.scale.setScalar(0.001 + p);
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* el libro grande al centro */}
      <mesh ref={book} position={[0, 4, 0]}>
        <boxGeometry args={[3, 4, 0.5]} />
        <meshStandardMaterial ref={bookMat} color="#1A1408" emissive={GOLD} emissiveIntensity={1.5} roughness={0.6} toneMapped={false} />
      </mesh>
      {/* 11 páginas orbitando */}
      {Array.from({ length: 11 }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) pages.current[i] = m; }} visible={false}>
          <planeGeometry args={[1.2, 1.6]} />
          <meshStandardMaterial color="#E8E0C8" emissive="#FFF4D8" emissiveIntensity={1.2} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 05 — Costos de transacción: 6 engranajes GRANDES girando con chispa ════╗
function TransactionCosts({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const gears = useRef<THREE.Mesh[]>([]);
  const gearMats = useRef<THREE.MeshStandardMaterial[]>([]);
  const span = end - start;
  const layout: [number, number, number][] = [
    [-6, 5.5, 0], [0, 6.5, -1], [6, 5.5, 0],
    [-5, 1.5, 1], [0, 1.0, 0], [5, 1.5, 1],
  ];
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 6; i++) {
      const m = gears.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.1), start + 2.2 + i * (span * 0.1)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 1.6);
      m.rotation.z += (i % 2 ? 0.03 : -0.03);
      if (gearMats.current[i]) gearMats.current[i].emissiveIntensity = 1.2 + Math.abs(Math.sin(t * 2 + i)) * 1.5;
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {layout.map((pos, i) => (
        <mesh key={i} ref={m => { if (m) gears.current[i] = m; }} position={pos} rotation={[Math.PI / 2, 0, 0]} visible={false}>
          <torusGeometry args={[1.1, 0.4, 8, 14]} />
          <meshStandardMaterial ref={m => { if (m) gearMats.current[i] = m; }} color="#2A1810" emissive={[RED, '#FF7A1A', GOLD, RED, '#FF7A1A', GOLD][i]} emissiveIntensity={1.2} metalness={0.4} roughness={0.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 06 — Make-or-buy: una gran balanza adentro vs afuera ══════════════════╗
function MakeOrBuy({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const p = local(t, start + 0.5, end);
    const ang = Math.cos(p * Math.PI * 3) * (1 - smooth(p)) * 0.32;
    if (beam.current) beam.current.rotation.z = ang;
  });
  return (
    <group ref={g} position={[0, 1.5, 0]}>
      {/* poste central grande */}
      <mesh position={[0, 0, 0]}><coneGeometry args={[0.9, 3, 4]} /><meshStandardMaterial color="#2A2E38" emissive="#15171D" emissiveIntensity={0.4} /></mesh>
      <group ref={beam} position={[0, 2.5, 0]}>
        <mesh><boxGeometry args={[9, 0.35, 0.6]} /><meshStandardMaterial color="#3A3E48" emissive="#23262E" emissiveIntensity={0.5} toneMapped={false} /></mesh>
        {/* izq: ADENTRO (coordinar) = engranaje azul grande */}
        <mesh position={[-3.8, -1.2, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.4, 0.5, 8, 16]} /><meshStandardMaterial color="#0E2236" emissive={BLUE} emissiveIntensity={2} toneMapped={false} /></mesh>
        {/* der: AFUERA (transactar) = monedas/mercado oro grande */}
        <mesh position={[3.8, -1.2, 0]}><icosahedronGeometry args={[1.5, 0]} /><meshStandardMaterial color="#0E2236" emissive={GOLD} emissiveIntensity={2} toneMapped={false} /></mesh>
      </group>
    </group>
  );
}

// ╔═══ 07 — Tamaño óptimo: la EMPRESA-burbuja que crece absorbiendo nodos ════╗
function OptimalSize({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const bubble = useRef<THREE.Mesh>(null);
  const bubbleMat = useRef<THREE.MeshStandardMaterial>(null);
  const core = useRef<THREE.Mesh>(null);
  const nodes = useRef<THREE.Mesh[]>([]);
  const N = 24;
  const span = end - start;
  const homes = useMemo(() => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 * 2 + i;
    const r = 6 + (i % 3) * 1.5;
    return [Math.cos(a) * r, 1 + ((i * 2.1) % 7), Math.sin(a) * r] as [number, number, number];
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    // la burbuja crece (la empresa internaliza) hasta el tamaño óptimo y FRENA
    const grow = smooth(local(t, start + 1, start + span * 0.7));
    const R = lerpN(1, 4.2, grow);
    if (bubble.current) bubble.current.scale.setScalar(R);
    if (bubbleMat.current) bubbleMat.current.opacity = 0.10 + grow * 0.10;
    if (core.current) core.current.rotation.y += 0.02;
    // los nodos cercanos son absorbidos (se apagan), los lejanos quedan afuera
    for (let i = 0; i < N; i++) {
      const m = nodes.current[i]; if (!m) continue;
      m.visible = true;
      const dist = Math.hypot(homes[i][0], homes[i][2]);
      const absorbed = dist < R * 1.5 && grow > 0.3;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissive.set(absorbed ? GOLD : BLUE);
      mat.emissiveIntensity = absorbed ? 1 : 2.2;
      m.position.y = homes[i][1] + Math.sin(t + i) * 0.2;
      m.rotation.y += 0.03;
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* la burbuja translúcida = el límite de la empresa */}
      <mesh ref={bubble} position={[0, 3.5, 0]}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial ref={bubbleMat} color={GOLD} transparent opacity={0.1} emissive={GOLD} emissiveIntensity={0.4} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* núcleo = el jefe/coordinación */}
      <mesh ref={core} position={[0, 3.5, 0]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#0E2236" emissive={GOLD} emissiveIntensity={2.6} flatShading toneMapped={false} /></mesh>
      {homes.map((p, i) => (
        <mesh key={i} ref={m => { if (m) nodes.current[i] = m; }} position={p}>
          <icosahedronGeometry args={[0.45, 0]} />
          <meshStandardMaterial color="#0E2236" emissive={BLUE} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 08 — Ford: integración vertical — torre alta que apila TODO ═══════════╗
function FordVertical({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const layers = useRef<THREE.Mesh[]>([]);
  const span = end - start;
  const labels = ['#6A4A2A', '#8A5A2A', GOLD, '#C08040', '#FF9A40', GOLD]; // mina→...→distribución
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 6; i++) {
      const m = layers.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.11), start + 2 + i * (span * 0.11)));
      m.visible = p > 0.01;
      m.scale.set(0.001 + p, 1, 0.001 + p);
      m.rotation.y += 0.006;
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* torre vertical de 6 capas — llena el cuadro de abajo a arriba */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) layers.current[i] = m; }} position={[0, 1 + i * 1.5, 0]} visible={false}>
          <boxGeometry args={[4 - i * 0.3, 1.3, 4 - i * 0.3]} />
          <meshStandardMaterial color="#1A140A" emissive={labels[i]} emissiveIntensity={1.8} flatShading toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 09 — Toyota: red de proveedores externos (JIT) alrededor de un núcleo ═╗
function ToyotaNetwork({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const suppliers = useRef<THREE.Mesh[]>([]);
  const flows = useRef<THREE.Mesh[]>([]);
  const N = 12;
  const homes = useMemo(() => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2;
    const r = 6;
    return [Math.cos(a) * r, 3.5 + Math.sin(i * 1.7) * 2.5, Math.sin(a) * r] as [number, number, number];
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    for (let i = 0; i < N; i++) {
      const m = suppliers.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.05), start + 2.2 + i * (span * 0.05)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 0.6);
      m.rotation.y += 0.03;
    }
    // piezas que fluyen justo-a-tiempo hacia el centro
    for (let i = 0; i < N; i++) {
      const m = flows.current[i]; if (!m) continue;
      const ph = ((t - start) * 0.3 + i / N) % 1;
      m.position.set(lerpN(homes[i][0], 0, ph), lerpN(homes[i][1], 3.5, ph), lerpN(homes[i][2], 0, ph));
      m.visible = t > start + 2;
      m.scale.setScalar(0.18 * (1 - ph * 0.3));
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* núcleo Toyota */}
      <mesh position={[0, 3.5, 0]}><octahedronGeometry args={[1.4, 0]} /><meshStandardMaterial color="#0E2236" emissive={RED} emissiveIntensity={2.4} flatShading toneMapped={false} /></mesh>
      {homes.map((p, i) => (
        <mesh key={i} ref={m => { if (m) suppliers.current[i] = m; }} position={p} visible={false}>
          <boxGeometry args={[1.3, 1.3, 1.3]} />
          <meshStandardMaterial color="#0E2236" emissive={CYAN} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) flows.current[i] = m; }} visible={false}>
          <sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 10 — Apple híbrido: mitad ADENTRO (diseño) | mitad AFUERA (producción) ═╗
function AppleHybrid({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const inside = useRef<THREE.Group>(null);
  const outside = useRef<THREE.Group>(null);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const a = smooth(local(t, start + 1, start + span * 0.4));
    const b = smooth(local(t, start + span * 0.4, start + span * 0.75));
    if (inside.current) { inside.current.scale.setScalar(0.001 + a); inside.current.rotation.y += 0.01; }
    if (outside.current) { outside.current.scale.setScalar(0.001 + b); outside.current.rotation.y -= 0.008; }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* ADENTRO: diseño (Cupertino) — núcleo brillante con anillo cerrado */}
      <group ref={inside} position={[-5, 3.5, 0]}>
        <mesh><icosahedronGeometry args={[2, 1]} /><meshStandardMaterial color="#0E2236" emissive={GOLD} emissiveIntensity={2.4} toneMapped={false} /></mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2.6, 0.12, 8, 40]} /><meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={2} toneMapped={false} /></mesh>
      </group>
      {/* AFUERA: producción (Foxconn) — red de nodos repetibles */}
      <group ref={outside} position={[5, 3.5, 0]}>
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return <mesh key={i} position={[Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0]}><boxGeometry args={[0.9, 0.9, 0.9]} /><meshStandardMaterial color="#0E2236" emissive={CYAN} emissiveIntensity={1.8} toneMapped={false} /></mesh>;
        })}
      </group>
    </group>
  );
}

// ╔═══ 11 — Internet: la empresa grande ENCOGE, los nodos se liberan ═════════╗
function InternetShrinks({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const corp = useRef<THREE.Mesh>(null);
  const corpMat = useRef<THREE.MeshStandardMaterial>(null);
  const freed = useRef<THREE.Mesh[]>([]);
  const N = 30;
  const span = end - start;
  const dirs = useMemo(() => Array.from({ length: N }, (_, i) => {
    const a = (i / N) * Math.PI * 2 * 2 + i;
    const el = Math.sin(i * 1.9);
    return [Math.cos(a), el, Math.sin(a)] as [number, number, number];
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const shrink = smooth(local(t, start + 1.5, start + span * 0.75));
    if (corp.current) corp.current.scale.setScalar(lerpN(4, 1.2, shrink));
    if (corpMat.current) corpMat.current.emissiveIntensity = lerpN(2.4, 1, shrink);
    // los nodos liberados salen disparados y brillan
    for (let i = 0; i < N; i++) {
      const m = freed.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 2 + (i / N) * 3, start + 5 + (i / N) * 3));
      m.visible = p > 0.01;
      const r = lerpN(1, 8, p);
      m.position.set(dirs[i][0] * r, 3.5 + dirs[i][1] * 4, dirs[i][2] * r);
      m.scale.setScalar(0.001 + p * 0.4);
      m.rotation.y += 0.05;
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <mesh ref={corp} position={[0, 3.5, 0]}><boxGeometry args={[1.6, 1.6, 1.6]} /><meshStandardMaterial ref={corpMat} color="#1A1408" emissive={GOLD} emissiveIntensity={2.4} flatShading toneMapped={false} /></mesh>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) freed.current[i] = m; }} visible={false}>
          <icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#0E2236" emissive={GREEN} emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 12 — Teorema de Coase: dos partes que negocian, flujo entre ellas ═════╗
function CoaseTheorem({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const flows = useRef<THREE.Mesh[]>([]);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (left.current) left.current.rotation.y += 0.02;
    if (right.current) right.current.rotation.y -= 0.02;
    for (let i = 0; i < 8; i++) {
      const m = flows.current[i]; if (!m) continue;
      const dir = i % 2 === 0 ? 1 : -1;
      const ph = ((t - start) * 0.4 + i / 8) % 1;
      m.position.x = lerpN(-4.5 * dir, 4.5 * dir, ph);
      m.position.y = 3.5 + Math.sin(ph * Math.PI) * 1.5;
      m.visible = t > start + 1.5;
      m.scale.setScalar(0.25);
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <mesh ref={left} position={[-4.5, 3.5, 0]}><dodecahedronGeometry args={[2, 0]} /><meshStandardMaterial color="#0E2236" emissive={BLUE} emissiveIntensity={2.2} flatShading toneMapped={false} /></mesh>
      <mesh ref={right} position={[4.5, 3.5, 0]}><dodecahedronGeometry args={[2, 0]} /><meshStandardMaterial color="#0E2236" emissive={GOLD} emissiveIntensity={2.2} flatShading toneMapped={false} /></mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) flows.current[i] = m; }} visible={false}>
          <sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color={GREEN} emissive={GREEN} emissiveIntensity={2.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 13 — Externalidad: fábrica + río + pescador ══════════════════════════╗
function RiverExternality({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const factory = useRef<THREE.Group>(null);
  const riverMat = useRef<THREE.MeshStandardMaterial>(null);
  const fish = useRef<THREE.Mesh[]>([]);
  const drips = useRef<THREE.Mesh[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (factory.current) factory.current.scale.setScalar(0.001 + smooth(local(t, start + 0.8, start + 2.5)));
    // el río se ensucia (azul→café) mientras la fábrica contamina
    const pollute = smooth(local(t, start + 2, start + span * 0.6));
    if (riverMat.current) {
      riverMat.current.color.lerpColors(new THREE.Color(BLUE), new THREE.Color('#5A4327'), pollute);
      riverMat.current.emissive.copy(riverMat.current.color);
      riverMat.current.emissiveIntensity = 1.4 - pollute * 0.6;
    }
    // peces que se apagan
    for (let i = 0; i < 6; i++) {
      const m = fish.current[i]; if (!m) continue;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = lerpN(2.4, 0.2, pollute);
      m.position.x = -8 + ((t * 0.6 + i * 2.7) % 16);
    }
    // chorros de contaminación que CAEN de la fábrica al río (llenan el alto)
    for (let i = 0; i < 8; i++) {
      const m = drips.current[i]; if (!m) continue;
      const ph = ((t - start) * 0.5 + i / 8) % 1;
      m.position.set(-5 + Math.sin(i) * 1.5, lerpN(7.5, 2.6, ph), -1 + Math.cos(i));
      m.visible = t > start + 2 && pollute > 0.05;
      m.scale.setScalar(0.3 * (1 - ph * 0.3));
    }
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      {/* fábrica grande y ALTA arriba-izquierda */}
      <group ref={factory} position={[-5, 1.5, -2]} visible={false}><AtomModel src={FACTORY} color="#8A6A30" glow={1.5} fitTo={8} /></group>
      {/* el río (plano largo) a media altura, cruzando TODO el ancho */}
      <mesh rotation={[-Math.PI / 2.4, 0, 0]} position={[0, 2.4, 1]}>
        <planeGeometry args={[22, 5]} />
        <meshStandardMaterial ref={riverMat} color={BLUE} emissive={BLUE} emissiveIntensity={1.4} transparent opacity={0.85} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      {/* peces grandes sobre el río */}
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) fish.current[i] = m; }} position={[-8 + i * 3, 2.8, 1]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[0.5, 1.6, 6]} />
          <meshStandardMaterial color="#0E2236" emissive={CYAN} emissiveIntensity={2.4} toneMapped={false} />
        </mesh>
      ))}
      {/* chorros de contaminación cayendo */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) drips.current[i] = m; }} visible={false}>
          <sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#7A5A2A" emissive="#5A4327" emissiveIntensity={2} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 14 — Importa la propiedad: un derecho (llave dorada) que se asigna ════╗
function PropertyRights({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const right = useRef<THREE.Mesh>(null);
  const rightMat = useRef<THREE.MeshStandardMaterial>(null);
  const partyL = useRef<THREE.MeshStandardMaterial>(null);
  const partyR = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    // el derecho viaja de un lado al otro y se asienta a la izquierda
    const move = smooth(local(t, start + 1.5, start + span * 0.6));
    if (right.current) { right.current.position.x = lerpN(0, -4.5, move); right.current.rotation.y += 0.04; }
    if (rightMat.current) rightMat.current.emissiveIntensity = 2 + Math.sin(t * 2) * 0.5;
    if (partyL.current) partyL.current.emissiveIntensity = lerpN(1, 2.6, move);
    if (partyR.current) partyR.current.emissiveIntensity = lerpN(1, 0.5, move);
  });
  return (
    <group ref={g} position={[0, 3.5, 0]}>
      {/* dos partes grandes */}
      <mesh position={[-4.5, 0, 0]}><boxGeometry args={[2.5, 2.5, 2.5]} /><meshStandardMaterial ref={partyL} color="#0E2236" emissive={BLUE} emissiveIntensity={1} flatShading toneMapped={false} /></mesh>
      <mesh position={[4.5, 0, 0]}><boxGeometry args={[2.5, 2.5, 2.5]} /><meshStandardMaterial ref={partyR} color="#0E2236" emissive={RED} emissiveIntensity={1} flatShading toneMapped={false} /></mesh>
      {/* el derecho de propiedad (octaedro dorado) */}
      <mesh ref={right} position={[0, 0, 0]}><octahedronGeometry args={[1.3, 0]} /><meshStandardMaterial ref={rightMat} color="#1A1408" emissive={GOLD} emissiveIntensity={2} flatShading toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 15 — Críticas: dos fuerzas opuestas que chocan contra el centro ═══════╗
function Critiques({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const leftF = useRef<THREE.Mesh>(null);
  const rightF = useRef<THREE.Mesh>(null);
  const center = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const push = 0.5 + 0.5 * Math.sin(t * 1.5);
    if (leftF.current) leftF.current.position.x = -6 + push * 1.5;
    if (rightF.current) rightF.current.position.x = 6 - push * 1.5;
    if (center.current) { center.current.rotation.y += 0.02; center.current.scale.setScalar(1 + push * 0.1); }
  });
  return (
    <group ref={g} position={[0, 3.5, 0]}>
      {/* izquierda (roja) */}
      <mesh ref={leftF} position={[-6, 0, 0]}><coneGeometry args={[1.6, 3.5, 4]} /><meshStandardMaterial color="#0E2236" emissive={RED} emissiveIntensity={2.2} flatShading toneMapped={false} /></mesh>
      {/* derecha (azul) */}
      <mesh ref={rightF} position={[6, 0, 0]}><coneGeometry args={[1.6, 3.5, 4]} /><meshStandardMaterial color="#0E2236" emissive={BLUE} emissiveIntensity={2.2} flatShading toneMapped={false} /></mesh>
      {/* el teorema al centro (resiste) */}
      <mesh ref={center} position={[0, 0, 0]}><icosahedronGeometry args={[1.8, 0]} /><meshStandardMaterial color="#0E2236" emissive={GOLD} emissiveIntensity={2.4} flatShading toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 16 — Williamson hold-up: dos engranajes que se traban ═════════════════╗
function HoldUp({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const gA = useRef<THREE.Mesh>(null);
  const gB = useRef<THREE.Mesh>(null);
  const lockMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const span = end - start;
    const lock = smooth(local(t, start + span * 0.4, start + span * 0.7));
    // giran libres y luego se traban (hold-up)
    const speed = lerpN(0.04, 0.003, lock);
    if (gA.current) gA.current.rotation.z += speed;
    if (gB.current) gB.current.rotation.z -= speed;
    if (lockMat.current) lockMat.current.emissiveIntensity = lock * (2 + Math.sin(t * 5));
  });
  return (
    <group ref={g} position={[0, 3.5, 0]}>
      <mesh ref={gA} position={[-2, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2, 0.6, 8, 14]} /><meshStandardMaterial color="#2A1810" emissive={CYAN} emissiveIntensity={1.8} metalness={0.4} toneMapped={false} /></mesh>
      <mesh ref={gB} position={[2, 0, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[2, 0.6, 8, 14]} /><meshStandardMaterial color="#2A1810" emissive={GOLD} emissiveIntensity={1.8} metalness={0.4} toneMapped={false} /></mesh>
      {/* destello rojo del trabón */}
      <mesh position={[0, 0, 0]}><sphereGeometry args={[0.7, 16, 16]} /><meshStandardMaterial ref={lockMat} color={RED} emissive={RED} emissiveIntensity={0} toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 17 — Legado: línea de tiempo 1932→2013 (21→99 años) ══════════════════╗
function Legacy({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const beads = useRef<THREE.Mesh[]>([]);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const N = 7;
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < N; i++) {
      const m = beads.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.1), start + 2 + i * (span * 0.1)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p * 0.7);
      m.rotation.y += 0.03;
    }
    if (lineMat.current) lineMat.current.opacity = smooth(local(t, start + 1, start + span * 0.5)) * 0.5;
  });
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let i = 0; i < N - 1; i++) pos.push(-9 + i * 3, 3.5, 0, -9 + (i + 1) * 3, 3.5, 0);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }, []);
  return (
    <group ref={g} position={[0, 0, 0]}>
      <lineSegments geometry={lineGeo}><lineBasicMaterial ref={lineMat} color={GOLD} transparent opacity={0} toneMapped={false} /></lineSegments>
      {Array.from({ length: N }).map((_, i) => (
        <mesh key={i} ref={m => { if (m) beads.current[i] = m; }} position={[-9 + i * 3, 3.5, 0]} visible={false}>
          <icosahedronGeometry args={[1, 0]} />
          <meshStandardMaterial color="#0E2236" emissive={i === N - 1 ? GOLD : BLUE} emissiveIntensity={i === N - 1 ? 2.8 : 1.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 18 — Cierre: cadena Akerlof→Coase→instituciones ══════════════════════╗
function ClosingChain({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const nodes = useRef<THREE.Mesh[]>([]);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const colors = ['#5AA0D0', GOLD, GREEN, PURPLE];
  const xs = [-6.5, -2.2, 2.2, 6.5];
  const span = end - start;
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos: number[] = [];
    for (let i = 0; i < 3; i++) pos.push(xs[i], 3.5, 0, xs[i + 1], 3.5, 0);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return geo;
  }, []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 4; i++) {
      const m = nodes.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 1 + i * (span * 0.12), start + 3 + i * (span * 0.12)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.001 + p);
      m.rotation.y += 0.03;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = (i === 1 ? 2.8 : 1.8) + Math.sin(t * 1.5 + i) * 0.3;
    }
    if (lineMat.current) lineMat.current.opacity = smooth(local(t, start + 3, start + span * 0.6)) * 0.5;
  });
  return (
    <group ref={g} position={[0, 0, 0]}>
      <lineSegments geometry={lineGeo}><lineBasicMaterial ref={lineMat} color={GOLD} transparent opacity={0} toneMapped={false} /></lineSegments>
      {xs.map((x, i) => (
        <mesh key={i} ref={m => { if (m) nodes.current[i] = m; }} position={[x, 3.5, 0]} visible={false}>
          <icosahedronGeometry args={[1.5, 0]} />
          <meshStandardMaterial color="#0E2236" emissive={colors[i]} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Cámara: 18 cortes, CERCA (llenar el cuadro), ángulos variados ───────────
function buildCamKeys(): CineCamKey[] {
  const LOOK: [number, number, number] = [0, 3.5, 0];
  const shots: { p0: [number, number, number]; p1: [number, number, number]; look?: [number, number, number] }[] = [
    { p0: [-6, 5, 14],   p1: [5, 4, 11],    look: [0, 4, 0] },     // 01 Apple vs freelancers
    { p0: [7, 5, 12],    p1: [2, 4, 8],     look: [0, 4, 0] },     // 02 jerarquía
    { p0: [-9, 4, 13],   p1: [8, 4, 13],    look: [0, 3, 0] },     // 03 fábricas pan
    { p0: [4, 5, 11],    p1: [-2, 4, 8],    look: [0, 4, 0] },     // 04 paper
    { p0: [-7, 5, 12],   p1: [3, 4, 9],     look: [0, 3.5, 0] },   // 05 engranajes
    { p0: [6, 4, 10],    p1: [-2, 3.5, 8],  look: [0, 2.5, 0] },   // 06 balanza
    { p0: [-5, 5, 13],   p1: [4, 4.5, 10],  look: [0, 3.5, 0] },   // 07 burbuja óptima
    { p0: [5, 6, 13],    p1: [-3, 5, 10],   look: [0, 4.5, 0] },   // 08 Ford vertical (alto)
    { p0: [-7, 5, 12],   p1: [4, 4, 9],     look: [0, 3.5, 0] },   // 09 Toyota red
    { p0: [-8, 4, 12],   p1: [7, 4, 11],    look: [0, 3.5, 0] },   // 10 Apple híbrido pan
    { p0: [4, 5, 13],    p1: [-3, 4.5, 10], look: [0, 3.5, 0] },   // 11 internet encoge
    { p0: [-7, 4, 11],   p1: [3, 4, 9],     look: [0, 3.5, 0] },   // 12 teorema
    { p0: [-6, 4, 12],   p1: [5, 3, 9],     look: [0, 2, 0] },     // 13 río
    { p0: [5, 5, 11],    p1: [-2, 4, 8],    look: [0, 3.5, 0] },   // 14 propiedad
    { p0: [-6, 4, 11],   p1: [4, 4, 9],     look: [0, 3.5, 0] },   // 15 críticas
    { p0: [5, 4, 10],    p1: [-2, 4, 8],    look: [0, 3.5, 0] },   // 16 hold-up
    { p0: [-9, 4, 13],   p1: [8, 4, 12],    look: [0, 3.5, 0] },   // 17 legado pan
    { p0: [-8, 5, 13],   p1: [2, 5, 11],    look: [0, 3.5, 0] },   // 18 cierre
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
  'Tu profesor dijo que el mercado es lo más eficiente. Entonces: Apple tiene 165 mil empleados. ¿Por qué no contrata 165 mil freelancers cada vez que hace un iPhone?',
  'Porque algo no cuadra. Si el mercado es tan eficiente, ¿por qué dentro de las empresas vives en jerarquía? Tu jefe te manda, no te pregunta el precio. Eso es lo contrario de un mercado.',
  '1932. Un inglés de 21 años, Ronald Coase, visita fábricas. Pregunta: ¿por qué hacen esta pieza adentro en lugar de comprarla afuera? Las respuestas no caben en ningún libro.',
  '1937. Publica "La naturaleza de la empresa". Once páginas. Casi nadie le hace caso por tres décadas. Pero le va a ganar el Nobel 54 años después.',
  'Toda transacción de mercado tiene costos invisibles: buscar al proveedor, negociar, escribir el contrato, verificar la calidad, vigilar, resolver disputas. Son los costos de transacción.',
  'Cada empresa, para cada actividad, se pregunta: ¿la hago adentro o la compro afuera? Elige la opción más barata. Y así, sin que nadie lo diseñe, surge el tamaño óptimo de cada empresa.',
  'La empresa crece internalizando: contrata, integra, fusiona. Hasta que coordinar internamente cuesta más que pagar al mercado. Ahí frena. Ese es su tamaño.',
  '1920. Henry Ford lo lleva al extremo: compra minas, fundiciones, ferrocarriles, fábricas, distribución. Todo. Integración vertical. Porque entonces transactar en el mercado era carísimo.',
  '50 años después, Toyota hace lo opuesto: coordina cientos de proveedores externos. Justo a tiempo. ¿Por qué? Los costos de transactar bajaron. La confianza repetida reemplaza el contrato.',
  'Apple hoy es híbrido: diseña adentro (Cupertino), produce afuera (Foxconn). Diseñar requiere coordinación intensa; producir es una receta repetible. Escoge bisturí por bisturí.',
  'Coase predijo el internet sin saberlo: cuando los costos de transacción caen, las empresas encogen. Hoy un emprendedor con Stripe y AWS compite con gigantes. Uber: 30 mil empleados, 5 millones de conductores que no lo son.',
  'El teorema de Coase (1960): si los costos de transacción fueran cero, no importaría a quién le des la propiedad — las partes negocian hasta el óptimo, sin gobierno.',
  'Una fábrica contamina un río. El pescador pierde su pesca. Coase: si pueden negociar libremente, llegan al óptimo solos. Quizás el pescador paga para que limpie. El mercado encuentra la solución.',
  'Pero en el mundo real los costos casi nunca son cero. Negociar entre miles de pescadores y una fábrica es imposible. Por eso SÍ importa a quién le das el derecho. Eso justifica la regulación.',
  'Lo criticaron de los dos lados. La izquierda: ¿los pobres negociando con corporaciones? La derecha lo abrazó contra la regulación. Coase: no era una receta, era un experimento mental.',
  'Williamson llevó esto adelante (Nobel 2009): la especificidad de los activos. Si inviertes en algo que solo sirve con un proveedor, te puede chantajear. Es el hold-up. Por eso se integran.',
  'Coase tenía 21 años cuando empezó. Tenía 99 cuando murió, en 2013. Su pregunta sigue viva: cada vez que el internet, las plataformas o la IA hacen colapsar un costo de transacción, una empresa se acorta o se rompe.',
  'Akerlof te enseñó que los mercados pueden morirse. Coase te enseña qué pasa después: cuando el mercado no alcanza, los humanos construyen empresas, contratos, instituciones. La economía es la ciencia de lo que sustituye al mercado cuando falla.',
];

export default function CoaseClase() {
  const subtitles = SUBS.map((text, i) => ({ text, at: T[i], until: beatEnd(i) }));
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      audio="/audio/clase-coase/narration.mp3?v=1"
      duration={END}
      chapter="Coase · 1991 · por qué existen las empresas"
      fov={54}
      cameraPos={[-6, 5, 14]}
      postfx={{ intensity: 1.2, threshold: 0.44, vignette: 0.8, aberration: 0.0005 }}
      subtitles={subtitles}
      title={{ text: '¿Por qué existen las empresas?', at: T[0] + 0.3, until: beatEnd(0) }}
    >
      <CineCamera keys={buildCamKeys()} live={1} />

      <NebulaWorld
        url="/limones-nebula-lite.bin"
        scale={46}
        holeR={18}
        firstIgnite={T[5]}
        chain={[
          T[6], T[6] + 3,
          T[7], T[7] + 3,
          T[9], T[9] + 3, T[9] + 6,
          T[10], T[10] + 3,
          T[16], T[16] + 3, T[16] + 6,
          T[17], T[17] + 3, T[17] + 6,
        ]}
        dawnAt={T[16]}
        beatTimes={T}
        calmFrom={END - 5}
      />

      <ambientLight intensity={0.2} color="#2A2640" />
      <directionalLight position={[5, 12, 4]} intensity={0.5} color="#FFE6C0" />

      <TimedGroup inAt={T[0]} outAt={T[1]}><AppleVsFreelancers start={T[0]} end={T[1]} /></TimedGroup>
      <TimedGroup inAt={T[1]} outAt={T[2]} pscale={0.72}><HierarchyVsMarket start={T[1]} end={T[2]} /></TimedGroup>
      <TimedGroup inAt={T[2]} outAt={T[3]} pscale={0.58}><CoaseVisits start={T[2]} end={T[3]} /></TimedGroup>
      <TimedGroup inAt={T[3]} outAt={T[4]}><ThePaper start={T[3]} end={T[4]} /></TimedGroup>
      <TimedGroup inAt={T[4]} outAt={T[5]} pscale={0.6}><TransactionCosts start={T[4]} end={T[5]} /></TimedGroup>
      <TimedGroup inAt={T[5]} outAt={T[6]} pscale={0.58}><MakeOrBuy start={T[5]} end={T[6]} /></TimedGroup>
      <TimedGroup inAt={T[6]} outAt={T[7]}><OptimalSize start={T[6]} end={T[7]} /></TimedGroup>
      <TimedGroup inAt={T[7]} outAt={T[8]}><FordVertical start={T[7]} end={T[8]} /></TimedGroup>
      <TimedGroup inAt={T[8]} outAt={T[9]} pscale={0.78}><ToyotaNetwork start={T[8]} end={T[9]} /></TimedGroup>
      <TimedGroup inAt={T[9]} outAt={T[10]} pscale={0.62}><AppleHybrid start={T[9]} end={T[10]} /></TimedGroup>
      <TimedGroup inAt={T[10]} outAt={T[11]} pscale={0.72}><InternetShrinks start={T[10]} end={T[11]} /></TimedGroup>
      <TimedGroup inAt={T[11]} outAt={T[12]} pscale={0.64}><CoaseTheorem start={T[11]} end={T[12]} /></TimedGroup>
      <TimedGroup inAt={T[12]} outAt={T[13]} pscale={0.6}><RiverExternality start={T[12]} end={T[13]} /></TimedGroup>
      <TimedGroup inAt={T[13]} outAt={T[14]} pscale={0.68}><PropertyRights start={T[13]} end={T[14]} /></TimedGroup>
      <TimedGroup inAt={T[14]} outAt={T[15]} pscale={0.58}><Critiques start={T[14]} end={T[15]} /></TimedGroup>
      <TimedGroup inAt={T[15]} outAt={T[16]}><HoldUp start={T[15]} end={T[16]} /></TimedGroup>
      <TimedGroup inAt={T[16]} outAt={T[17]} pscale={0.5}><Legacy start={T[16]} end={T[17]} /></TimedGroup>
      <TimedGroup inAt={T[17]} outAt={END} pscale={0.54}><ClosingChain start={T[17]} end={END} /></TimedGroup>

      {/* ── PALABRAS-ANCLA: fijan la idea, EXACTO cuando Matilda la dice (forced
          alignment). El beat de costos (b5) muestra las 6 ideas en secuencia. ── */}
      <AnchorWord text="FREELANCERS" after={T[0]} pos={[0, 6.4, 1]} color={CYAN} />
      <AnchorWord text="JERARQUÍA" after={T[1]} pos={[0, 7.2, 1]} color={GOLD} />
      <AnchorWord text="ADENTRO" match="adentro" after={T[2]} pos={[-2.6, 6.6, 1]} color={GOLD} width={4.2} />
      <AnchorWord text="O AFUERA" match="afuera" after={T[2]} pos={[2.6, 5.6, 1]} color={CYAN} width={4.2} />
      <AnchorWord text="EL ARTÍCULO" match="artículo" after={T[3]} pos={[0, 7.4, 1]} color={GOLD} />
      {/* b5 — los 6 costos de transacción, uno por uno como se nombran */}
      <AnchorWord text="BUSCAR" match="buscar" after={T[4]} pos={[-2.0, 7.4, 1]} color="#FF7A1A" width={3.8} height={1.15} hold={2.2} />
      <AnchorWord text="NEGOCIAR" match="negociar" after={T[4]} pos={[2.0, 6.2, 1]} color={GOLD} width={4.0} height={1.15} hold={2.2} />
      <AnchorWord text="CONTRATO" match="contrato" after={T[4]} pos={[-2.0, 5.0, 1]} color="#FF7A1A" width={4.0} height={1.15} hold={2.2} />
      <AnchorWord text="VERIFICAR" match="verificar" after={T[4]} pos={[2.0, 3.8, 1]} color={GOLD} width={4.2} height={1.15} hold={2.2} />
      <AnchorWord text="VIGILAR" match="vigilar" after={T[4]} pos={[-2.0, 2.6, 1]} color="#FF7A1A" width={3.8} height={1.15} hold={2.2} />
      <AnchorWord text="DISPUTAS" match="disputas" after={T[4]} pos={[2.0, 1.6, 1]} color={RED} width={4.0} height={1.15} hold={2.6} />
      <AnchorWord text="COSTOS DE TRANSACCIÓN" match="transacción" after={T[4] + 14} pos={[0, 8.2, 1]} color={GOLD} width={9} height={1.0} hold={4} />
      <AnchorWord text="¿MÁS BARATA?" match="barata" after={T[5]} pos={[0, 6.2, 1]} color={GOLD} width={5.5} />
      <AnchorWord text="TAMAÑO ÓPTIMO" match="óptimo" after={T[6]} pos={[0, 7.6, 1]} color={GOLD} width={8} height={1.1} />
      <AnchorWord text="INTEGRACIÓN VERTICAL" match="vertical" after={T[7]} pos={[0, 9.5, 1]} color={GOLD} width={9} height={1.0} />
      <AnchorWord text="JUSTO A TIEMPO" match="justo" after={T[8]} pos={[0, 7.4, 1]} color={CYAN} width={7.5} height={1.1} />
      <AnchorWord text="HÍBRIDO" match="híbrido" after={T[9]} pos={[0, 7.2, 1]} color={GOLD} />
      <AnchorWord text="ENCOGEN" match="encogen" after={T[10]} pos={[0, 7.4, 1]} color={GREEN} />
      <AnchorWord text="TEOREMA DE COASE" match="teorema" after={T[11]} pos={[0, 7.2, 1]} color={GOLD} width={9} height={1.05} />
      <AnchorWord text="CONTAMINA" match="contamina" after={T[12]} pos={[0, 7.6, 1]} color={RED} />
      <AnchorWord text="¿DE QUIÉN ES?" match="propiedad" after={T[13]} pos={[0, 7.2, 1]} color={GOLD} width={6.5} />
      <AnchorWord text="EXPERIMENTO MENTAL" match="experimento" after={T[14]} pos={[0, 7.2, 1]} color={BLUE} width={9} height={1.0} />
      <AnchorWord text="HOLD-UP" match="hold" after={T[15]} pos={[0, 6.4, 1]} color={RED} />
      <AnchorWord text="INTERNET · IA · CRIPTO" match="internet" after={T[16]} pos={[0, 7.4, 1]} color={CYAN} width={9} height={1.0} />
      <AnchorWord text="INSTITUCIONES" match="instituciones" after={T[17]} pos={[0, 7.2, 1]} color={GOLD} width={9} height={1.1} />
    </CineStage>
  );
}
