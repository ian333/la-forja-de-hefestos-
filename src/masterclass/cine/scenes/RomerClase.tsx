/**
 * RomerClase — masterclass cine del premio 2018 (Paul Romer): crecimiento
 * endógeno. EL HACK PARA CRECER SIN TENER NADA. 25 escenas demostrativas.
 *
 * Arco (cada línea narrada = una escena; la animación ES la explicación, R4.3):
 *   ENIGMA      01 Corea vs Ghana · 02 no fue petróleo/oro/suerte · 03 te incluye a ti
 *   CAPITAL     04 acumula fierros · 05 cada máquina rinde menos · 06 te estancas · 07 ¿por qué no se apaga?
 *   EL RESIDUO  08 capital+trabajo = mitad · 09 el fantasma · 10 Romer: son IDEAS
 *   NO-RIVAL    11 propiedad mágica · 12 das taco→lo pierdes (rival) · 13 das receta→la conservas (no-rival) · 14 mil cocinas
 *   CRECIENTES  15 se combinan · 16 rueda→coche→teléfono · 17 bola de nieve · 18 decreciente vs creciente
 *   INCENTIVO   19 ¿quién inventa? · 20 patentes/exclusiva · 21 el equilibrio fino
 *   ANIMAL      22 la mona de Koshima · 23 el animal que acumula recetas (cultura)
 *   EL HACK     24 país sin capital despega · 25 franquicia la receta (Nobel)
 *
 * Center-stage: un objeto por plano, fondo negro, bloom; la cámara CORTA a cada
 * beat y deriva. Voz Matilda (25 líneas, 0.6 s de aire entre cada una) intacta.
 */

import { useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import AtomModel from '@/masterclass/assets/gltf/AtomModel';
import { CineStage, CineCamera, CineModel, useCineTime } from '@/masterclass/cine';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';

const FACTORY = '/models/library/buildings/factory.glb';
const MONKEY = '/models/library/animals/monkey.glb';
AtomModel.preload(FACTORY);
AtomModel.preload(MONKEY);

// Inicio de habla de cada una de las 25 líneas (medido del audio Matilda con
// 0.6 s de silencio entre líneas). Los beats y subtítulos se clavan aquí.
const T = [0.45, 12.05, 18.92, 28.35, 37.54, 48.01, 56.66, 65.93, 76.49, 85.84,
  95.42, 101.98, 112.22, 119.9, 129.98, 137.58, 148.37, 156.67, 165.32, 171.48,
  180.44, 188.44, 197.79, 206.75, 215.78];
const END = 226;
const beatEnd = (i: number) => (i < 24 ? T[i + 1] : END);

const GOLD = '#FDB813';
const BLUE = '#46C2FF';
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;
const local = (t: number, start: number, end: number) => clamp((t - start) / (end - start), 0, 1);

// CORTE SECO de escena (como una masterclass de verdad): cada escena es visible
// ESTRICTAMENTE dentro de su beat [inAt, outAt). Las ventanas adyacentes NO se
// traslapan (outAt de una = inAt de la siguiente), así que nunca hay dos escenas
// encimadas; el corte visual coincide con el corte de cámara. Un ramp de 0.15 s
// al entrar evita el pop de un frame.
function fadeGroup(g: THREE.Group | null, t: number, inAt: number, outAt: number) {
  if (!g) return false;
  const on = t >= inAt && t < outAt;
  g.visible = on;
  if (!on) return false;
  g.scale.setScalar(Math.min(1, 0.0001 + (t - inAt) / 0.15));
  return true;
}

// Envuelve GLBs externos (CineModel) para que salgan de cuadro al fin del beat.
function TimedGroup({ inAt, outAt, children }: { inAt: number; outAt: number; children: ReactNode }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  useFrame(() => fadeGroup(g.current, timeRef.current, inAt, outAt));
  return <group ref={g}>{children}</group>;
}

// ╔═══ 01 — Corea vs Ghana: dos ciudades iguales; una despega ════════════════╗
function TwoCities({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const korea = useRef<THREE.Group>(null);
  const heights = useMemo(() => [1.2, 1.8, 1.0, 1.5, 0.9], []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const p = local(t, start + (end - start) * 0.45, end); // Corea despega en la 2ª mitad
    if (korea.current) korea.current.scale.y = 1 + smooth(p) * 3.2;
  });
  const tower = (x: number, h: number, c: string, e: number) => (
    <mesh position={[x, h / 2, 0]}>
      <boxGeometry args={[0.6, h, 0.6]} />
      <meshStandardMaterial color="#11151F" emissive={c} emissiveIntensity={e} toneMapped={false} />
    </mesh>
  );
  return (
    <group ref={g}>
      {/* Ghana (izquierda) — se queda */}
      <group position={[-4.5, 0, 0]}>{heights.map((h, i) => <group key={i} position={[(i - 2) * 0.9, 0, 0]}>{tower(0, h, '#5A6275', 0.5)}</group>)}</group>
      {/* Corea (derecha) — despega */}
      <group ref={korea} position={[4.5, 0, 0]}>{heights.map((h, i) => <group key={i} position={[(i - 2) * 0.9, 0, 0]}>{tower(0, h, GOLD, 0.9)}</group>)}</group>
    </group>
  );
}

// ╔═══ 02 — No fue petróleo, ni oro, ni suerte: tres objetos tachados ════════╗
function MisconStrike({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const crosses = useRef<THREE.Group[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 3; i++) {
      const struck = local(t, start + span * (0.18 + i * 0.24), start + span * (0.42 + i * 0.24));
      if (mats.current[i]) mats.current[i].emissiveIntensity = lerpN(0.9, 0.06, smooth(struck));
      if (crosses.current[i]) { crosses.current[i].visible = struck > 0.01; crosses.current[i].scale.setScalar(smooth(struck)); }
    }
  });
  const items = [
    { x: -3, geo: <cylinderGeometry args={[0.6, 0.6, 1.6, 20]} />, c: '#3A2E12' }, // barril petróleo
    { x: 0, geo: <boxGeometry args={[1.4, 0.7, 0.8]} />, c: GOLD },                  // lingote oro
    { x: 3, geo: <boxGeometry args={[1.1, 1.1, 1.1]} />, c: '#7C8296' },             // dado suerte
  ];
  return (
    <group ref={g} position={[0, 1.4, 0]}>
      {items.map((it, i) => (
        <group key={i} position={[it.x, 0, 0]}>
          <mesh>{it.geo}<meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m; }} color="#11151F" emissive={it.c} emissiveIntensity={0.9} toneMapped={false} /></mesh>
          <group ref={(c) => { if (c) crosses.current[i] = c; }} visible={false}>
            <mesh rotation={[0, 0, Math.PI / 4]}><boxGeometry args={[2, 0.16, 0.16]} /><meshStandardMaterial color="#FF2E2E" emissive="#FF2E2E" emissiveIntensity={2} toneMapped={false} /></mesh>
            <mesh rotation={[0, 0, -Math.PI / 4]}><boxGeometry args={[2, 0.16, 0.16]} /><meshStandardMaterial color="#FF2E2E" emissive="#FF2E2E" emissiveIntensity={2} toneMapped={false} /></mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

// ╔═══ 03 — Te incluye a ti: un comal solitario, cálido ══════════════════════╗
function Comal({ start, end, x = 0 }: { start: number; end: number; x?: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const m = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (m.current) m.current.rotation.y += 0.004;
  });
  return (
    <group ref={g} position={[x, 1.1, 0]}>
      <mesh ref={m} rotation={[-0.35, 0, 0]}>
        <cylinderGeometry args={[1.0, 1.0, 0.14, 40]} />
        <meshStandardMaterial color="#1C1206" emissive="#FF7A1A" emissiveIntensity={0.85} metalness={0.4} roughness={0.5} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ╔═══ 04/05/06 — Capital: monedas que se afilan y se estancan (meseta) ══════╗
function CapitalBar({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const COINS = 8;
  const thick = useMemo(() => { const a: number[] = []; let h = 0.6; for (let i = 0; i < COINS; i++) { a.push(h); h *= 0.62; } return a; }, []);
  const radius = useMemo(() => Array.from({ length: COINS }, (_, i) => 0.40 + 0.34 * Math.pow(0.64, i)), []);
  const GAP = 0.07;
  const rest = useMemo(() => { const r: number[] = []; let s = 0.45; for (let i = 0; i < COINS; i++) { r.push(s + thick[i] / 2); s += thick[i] + GAP; } return r; }, [thick]);
  const landT = useMemo(() => thick.map((_, i) => T[4] + 0.6 + i * 1.05), [thick]); // caen durante L5
  const meshes = useRef<THREE.Mesh[]>([]);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < COINS; i++) {
      const mesh = meshes.current[i]; if (!mesh) continue;
      const p = clamp((t - (landT[i] - 0.8)) / 0.8, 0, 1);
      mesh.visible = p > 0;
      mesh.position.y = lerpN(rest[i] + 6.5, rest[i], smooth(p));
      const mat = mats.current[i];
      if (mat) mat.emissiveIntensity = p >= 1 ? 1.1 : 0.25;
    }
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[1.0, 1.1, 0.4, 32]} /><meshStandardMaterial color="#23262E" metalness={0.6} roughness={0.4} /></mesh>
      {thick.map((h, i) => (
        <mesh key={i} ref={(mm) => { if (mm) meshes.current[i] = mm; }} position={[0, rest[i], 0]}>
          <cylinderGeometry args={[radius[i], radius[i], h, 30]} />
          <meshStandardMaterial ref={(mm) => { if (mm) mats.current[i] = mm; }} color="#7A5A12" emissive={GOLD} emissiveIntensity={0.25} metalness={0.7} roughness={0.3} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ╔═══ 07 — ¿Por qué no se apaga? Una chispa desconocida que pulsa ═══════════╗
function CuriositySpark({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const m = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    if (mat.current) mat.current.emissiveIntensity = 1.2 + pulse * 2.4;
    if (m.current) { m.current.rotation.y += 0.03; m.current.rotation.x += 0.02; m.current.position.y = 3.6 + pulse * 0.2; }
  });
  return (
    <group ref={g}>
      <mesh ref={m} position={[0, 3.6, 0]}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshStandardMaterial ref={mat} color="#0E2236" emissive="#FFFFFF" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ╔═══ 08 — El residuo: capital+trabajo llenan media meta; arriba, el vacío ══╗
function ResidualBars({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Mesh>(null);
  const lab = useRef<THREE.Mesh>(null);
  const voidMat = useRef<THREE.MeshStandardMaterial>(null);
  const H = 6;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const p = smooth(local(t, start + 0.4, start + (end - start) * 0.55));
    const h = (H / 2) * p;
    if (cap.current) { cap.current.scale.y = Math.max(0.001, h); cap.current.position.y = h / 2; }
    if (lab.current) { lab.current.scale.y = Math.max(0.001, h); lab.current.position.y = h / 2; }
    if (voidMat.current) voidMat.current.opacity = 0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t * 2.5)) * p;
  });
  return (
    <group ref={g}>
      {/* marco "crecimiento total" */}
      <mesh position={[0, H / 2, 0]}><boxGeometry args={[3, H, 1.6]} /><meshStandardMaterial color={GOLD} transparent opacity={0.05} emissive={GOLD} emissiveIntensity={0.15} toneMapped={false} /></mesh>
      {/* la mitad explicada */}
      <mesh ref={cap} position={[-0.7, 0, 0]}><boxGeometry args={[1.0, 1, 1.0]} /><meshStandardMaterial color="#6A7080" emissive="#3A4150" emissiveIntensity={0.5} toneMapped={false} /></mesh>
      <mesh ref={lab} position={[0.7, 0, 0]}><boxGeometry args={[1.0, 1, 1.0]} /><meshStandardMaterial color="#4A7A9A" emissive="#1E3A5F" emissiveIntensity={0.5} toneMapped={false} /></mesh>
      {/* la mitad sin explicar */}
      <mesh position={[0, H * 0.75, 0]}><boxGeometry args={[2.6, H / 2, 1.2]} /><meshStandardMaterial ref={voidMat} color={GOLD} transparent opacity={0.12} emissive={GOLD} emissiveIntensity={0.7} toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 09/10 — El fantasma se vuelve IDEA (residuo → glyph nítido) ═══════════╗
function MysteryReveal({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const blobMat = useRef<THREE.MeshStandardMaterial>(null);
  const idea = useRef<THREE.Mesh>(null);
  const ideaMat = useRef<THREE.MeshStandardMaterial>(null);
  const reveal = T[9]; // nombre: "ideas"
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const r = smooth(local(t, reveal, reveal + 1.2));
    if (blobMat.current) blobMat.current.emissiveIntensity = lerpN(0.7, 0.0, r);
    if (idea.current) { idea.current.visible = r > 0.01; idea.current.scale.setScalar(0.0001 + r); idea.current.rotation.y += 0.05; idea.current.rotation.x += 0.02; }
    if (ideaMat.current) ideaMat.current.emissiveIntensity = 0.3 + r * 2.6;
  });
  return (
    <group ref={g} position={[0, 2.2, 0]}>
      <mesh><icosahedronGeometry args={[1.0, 2]} /><meshStandardMaterial ref={blobMat} color="#0C0F18" emissive="#8A6A30" emissiveIntensity={0.7} roughness={0.9} flatShading toneMapped={false} /></mesh>
      <mesh ref={idea} visible={false}><icosahedronGeometry args={[0.85, 0]} /><meshStandardMaterial ref={ideaMat} color="#0E2236" emissive={GOLD} emissiveIntensity={0.3} toneMapped={false} /></mesh>
    </group>
  );
}

// Glyph de idea reutilizable
function ideaMesh(r: number, color = GOLD, intensity = 1.8) {
  return (
    <>
      <icosahedronGeometry args={[r, 0]} />
      <meshStandardMaterial color="#0E2236" emissive={color} emissiveIntensity={intensity} toneMapped={false} />
    </>
  );
}

// ╔═══ 11 — Propiedad mágica: una sola idea, brillando ══════════════════════╗
function SingleIdea({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const m = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (m.current) { m.current.rotation.y += 0.05; m.current.rotation.x += 0.02; m.current.position.y = 2.2 + Math.sin(t * 1.5) * 0.12; }
  });
  return <group ref={g}><mesh ref={m} position={[0, 2.2, 0]}>{ideaMesh(0.9)}</mesh></group>;
}

// ╔═══ 12/13 — No-rivalidad: moneda que se transfiere vs idea que se copia ═══╗
function NonRival({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const rivalCoin = useRef<THREE.Mesh>(null);
  const tuDiscMat = useRef<THREE.MeshStandardMaterial>(null);
  const idea0 = useRef<THREE.Mesh>(null);
  const ideaCopy = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const rp = smooth(local(t, T[11] + 1.0, T[11] + 4.0)); // L12: la moneda se va
    if (rivalCoin.current) { rivalCoin.current.position.x = lerpN(-2.2, 2.2, rp); rivalCoin.current.rotation.z += 0.05; }
    if (tuDiscMat.current) tuDiscMat.current.emissiveIntensity = rp > 0.95 ? 0.05 : 0.6;
    const cp = smooth(local(t, T[12] + 0.6, T[12] + 3.2)); // L13: la idea se copia
    if (ideaCopy.current) {
      ideaCopy.current.visible = cp > 0.01;
      ideaCopy.current.position.x = lerpN(-2.2, 2.2, cp);
      ideaCopy.current.rotation.y += 0.06;
      ideaCopy.current.scale.setScalar(Math.min(1, 0.0001 + smooth(cp * 1.4)));
    }
    if (idea0.current) { idea0.current.rotation.y += 0.05; idea0.current.rotation.x += 0.02; }
  });
  return (
    <group ref={g}>
      {/* fila RIVAL (oro) */}
      <mesh position={[-2.2, 2.45, 0]}><cylinderGeometry args={[0.7, 0.7, 0.08, 28]} /><meshStandardMaterial ref={tuDiscMat} color="#1A1E28" emissive={GOLD} emissiveIntensity={0.6} toneMapped={false} /></mesh>
      <mesh position={[2.2, 2.45, 0]}><cylinderGeometry args={[0.7, 0.7, 0.08, 28]} /><meshStandardMaterial color="#1A1E28" emissive="#3A2E08" emissiveIntensity={0.2} toneMapped={false} /></mesh>
      <mesh ref={rivalCoin} position={[-2.2, 2.7, 0]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.45, 0.45, 0.12, 24]} /><meshStandardMaterial color="#7A5A12" emissive={GOLD} emissiveIntensity={1.2} metalness={0.7} roughness={0.3} toneMapped={false} /></mesh>
      {/* fila NO-RIVAL (idea azul) */}
      <mesh position={[-2.2, 0.65, 0]}><cylinderGeometry args={[0.7, 0.7, 0.08, 28]} /><meshStandardMaterial color="#1A1E28" emissive="#1E3A5F" emissiveIntensity={0.4} toneMapped={false} /></mesh>
      <mesh position={[2.2, 0.65, 0]}><cylinderGeometry args={[0.7, 0.7, 0.08, 28]} /><meshStandardMaterial color="#1A1E28" emissive="#1E3A5F" emissiveIntensity={0.4} toneMapped={false} /></mesh>
      <mesh ref={idea0} position={[-2.2, 1.1, 0]}>{ideaMesh(0.42, BLUE, 1.6)}</mesh>
      <mesh ref={ideaCopy} position={[-2.2, 1.1, 0]} visible={false}>{ideaMesh(0.42, BLUE, 1.6)}</mesh>
    </group>
  );
}

// ╔═══ 14 — Mil cocinas: una idea se copia a una multitud ════════════════════╗
function IdeaToMany({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const M = 16;
  const targets = useMemo(() => Array.from({ length: M }, (_, i) => {
    const a = (i / M) * Math.PI * 2; const r = 4.2 + (i % 3) * 0.6;
    return [Math.cos(a) * r, 2.2 + Math.sin(i * 1.7) * 1.4, Math.sin(a) * r] as [number, number, number];
  }), []);
  const copies = useRef<THREE.Mesh[]>([]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < M; i++) {
      const m = copies.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * 0.18, start + 2.4 + i * 0.18));
      m.visible = p > 0.01;
      m.position.set(lerpN(0, targets[i][0], p), lerpN(2.2, targets[i][1], p), lerpN(0, targets[i][2], p));
      m.scale.setScalar(0.0001 + p * 0.55);
      m.rotation.y += 0.06;
    }
  });
  return (
    <group ref={g}>
      <mesh position={[0, 2.2, 0]}>{ideaMesh(0.7)}</mesh>
      {targets.map((_, i) => <mesh key={i} ref={(m) => { if (m) copies.current[i] = m; }} visible={false}>{ideaMesh(0.42)}</mesh>)}
    </group>
  );
}

// ╔═══ 15 — Se combinan: dos ideas se juntan y nace una tercera ══════════════╗
function CombineTwo({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const c = useRef<THREE.Mesh>(null);
  const cMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const merge = smooth(local(t, start + 0.8, start + (end - start) * 0.55));
    if (a.current) { a.current.position.x = lerpN(-3, 0, merge); a.current.rotation.y += 0.05; a.current.visible = merge < 0.98; }
    if (b.current) { b.current.position.x = lerpN(3, 0, merge); b.current.rotation.y -= 0.05; b.current.visible = merge < 0.98; }
    const born = smooth(local(t, start + (end - start) * 0.5, start + (end - start) * 0.8));
    if (c.current) { c.current.visible = born > 0.01; c.current.scale.setScalar(0.0001 + born * 1.1); c.current.rotation.y += 0.04; }
    if (cMat.current) cMat.current.emissiveIntensity = 0.3 + born * 2.8;
  });
  return (
    <group ref={g} position={[0, 2.3, 0]}>
      <mesh ref={a} position={[-3, 0, 0]}>{ideaMesh(0.55, BLUE, 1.6)}</mesh>
      <mesh ref={b} position={[3, 0, 0]}>{ideaMesh(0.55, '#B36BFF', 1.6)}</mesh>
      <mesh ref={c} visible={false}><octahedronGeometry args={[0.85, 0]} /><meshStandardMaterial ref={cMat} color="#0E2236" emissive={GOLD} emissiveIntensity={0.3} toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 16 — Cadena: rueda→carreta→coche→teléfono (complejidad que se acumula) ╗
function CombineChain({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const groups = useRef<THREE.Group[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < 4; i++) {
      const grp = groups.current[i]; if (!grp) continue;
      const p = smooth(local(t, start + 0.8 + i * (span * 0.2), start + 1.8 + i * (span * 0.2)));
      grp.visible = p > 0.01;
      grp.scale.setScalar(0.0001 + p);
      grp.children.forEach((ch) => { ch.rotation.y += 0.01; });
    }
  });
  const X = [-6, -2, 2, 6];
  const wheel = (x: number, y: number, s = 0.28) => <mesh position={[x, y, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[s, s * 0.4, 8, 16]} /><meshStandardMaterial color="#11151F" emissive={GOLD} emissiveIntensity={1.4} toneMapped={false} /></mesh>;
  const box = (x: number, y: number, w: number, h: number, d: number, c = GOLD, e = 1.4) => <mesh position={[x, y, 0]}><boxGeometry args={[w, h, d]} /><meshStandardMaterial color="#11151F" emissive={c} emissiveIntensity={e} toneMapped={false} /></mesh>;
  return (
    <group ref={g} position={[0, 1.6, 0]}>
      {/* 0: rueda */}
      <group ref={(gg) => { if (gg) groups.current[0] = gg; }} position={[X[0], 0, 0]} visible={false}>{wheel(0, 0, 0.7)}</group>
      {/* 1: carreta = caja + 2 ruedas */}
      <group ref={(gg) => { if (gg) groups.current[1] = gg; }} position={[X[1], 0, 0]} visible={false}>{box(0, 0.4, 1.2, 0.5, 0.7)}{wheel(-0.4, -0.05)}{wheel(0.4, -0.05)}</group>
      {/* 2: coche = cuerpo + cabina + 2 ruedas */}
      <group ref={(gg) => { if (gg) groups.current[2] = gg; }} position={[X[2], 0, 0]} visible={false}>{box(0, 0.45, 1.5, 0.45, 0.7)}{box(0.1, 0.85, 0.8, 0.4, 0.6)}{wheel(-0.5, 0.05)}{wheel(0.5, 0.05)}</group>
      {/* 3: teléfono = slab oscuro + pantalla brillante */}
      <group ref={(gg) => { if (gg) groups.current[3] = gg; }} position={[X[3], 0.5, 0]} visible={false}>{box(0, 0, 0.7, 1.4, 0.12, '#1A2030', 0.4)}{box(0, 0, 0.56, 1.2, 0.16, BLUE, 2.2)}</group>
    </group>
  );
}

// ╔═══ 17 — Bola de nieve: árbol de ideas que se duplica 1→2→4→8→16 ═════════╗
function buildTree() {
  const nodes: { x: number; y: number; z: number }[] = [];
  const levelOf: number[] = [];
  const lines: [number, number][] = [];
  const LEVELS = 6;
  let prevStart = 0, prevCount = 0;
  for (let L = 0; L < LEVELS; L++) {
    const n = Math.min(1 << L, 24);
    const W = 1.2 + L * L * 0.85;
    const y = 1.0 + L * 1.85;
    const startIdx = nodes.length;
    for (let k = 0; k < n; k++) {
      const x = n === 1 ? 0 : (-W / 2 + (k + 0.5) * (W / n));
      const z = (((k * 7 + L * 13) % 9) - 4) * 0.22;
      nodes.push({ x, y, z }); levelOf.push(L);
      if (L > 0) lines.push([prevStart + (k % Math.max(1, prevCount)), nodes.length - 1]);
    }
    prevStart = startIdx; prevCount = n;
  }
  return { nodes, lines, levelOf };
}
function IdeaTree({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const { nodes, lines, levelOf } = useMemo(() => buildTree(), []);
  const mats = useRef<THREE.MeshStandardMaterial[]>([]);
  const lineMat = useRef<THREE.LineBasicMaterial>(null);
  const appearT = useMemo(() => levelOf.map((L) => start + 0.6 + (L / 6) * (end - start - 1.4)), [levelOf, start, end]);
  const lineGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(lines.length * 6);
    lines.forEach(([a, b], i) => { const A = nodes[a], B = nodes[b]; pos.set([A.x, A.y, A.z, B.x, B.y, B.z], i * 6); });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return geo;
  }, [nodes, lines]);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < nodes.length; i++) {
      const m = mats.current[i]; if (!m) continue;
      m.emissiveIntensity = 0.05 + smooth((t - appearT[i]) / 0.5) * 2.6;
    }
    if (lineMat.current) lineMat.current.opacity = smooth((t - (start + 1.0)) / 2.0) * 0.32;
  });
  return (
    <group ref={g}>
      <lineSegments geometry={lineGeo}><lineBasicMaterial ref={lineMat} color={GOLD} transparent opacity={0} toneMapped={false} /></lineSegments>
      {nodes.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}><sphereGeometry args={[0.17, 14, 14]} /><meshStandardMaterial ref={(m) => { if (m) mats.current[i] = m; }} color="#16202C" emissive={GOLD} emissiveIntensity={0.05} toneMapped={false} /></mesh>
      ))}
    </group>
  );
}

// ╔═══ 18/24 — Payoff: capital plano vs ideas que se disparan ════════════════╗
function PayoffBars({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const cap = useRef<THREE.Mesh>(null);
  const idea = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const dt = Math.max(0, t - start);
    const hc = 2.4 * (1 - Math.exp(-1.0 * dt));
    const hi = Math.min(26, 0.5 * Math.exp(0.40 * dt));
    if (cap.current) { cap.current.scale.y = Math.max(0.001, hc); cap.current.position.y = hc / 2; }
    if (idea.current) { idea.current.scale.y = Math.max(0.001, hi); idea.current.position.y = hi / 2; }
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.1, 0]}><boxGeometry args={[6, 0.2, 2]} /><meshStandardMaterial color="#23262E" metalness={0.5} roughness={0.5} /></mesh>
      <mesh ref={cap} position={[-1.6, 0, 0]}><boxGeometry args={[1.2, 1, 1.2]} /><meshStandardMaterial color="#6A7080" emissive="#3A4150" emissiveIntensity={0.4} toneMapped={false} /></mesh>
      <mesh ref={idea} position={[1.6, 0, 0]}><boxGeometry args={[1.2, 1, 1.2]} /><meshStandardMaterial color="#7A5A12" emissive={GOLD} emissiveIntensity={1.4} toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 19 — ¿Quién inventa? El creador se apaga mientras otros copian gratis ═╗
function FreeRider({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const creatorMat = useRef<THREE.MeshStandardMaterial>(null);
  const grabs = useRef<THREE.Mesh[]>([]);
  const seats = useMemo(() => Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2; return [Math.cos(a) * 3.4, 2.2, Math.sin(a) * 3.4] as [number, number, number]; }), []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const drain = smooth(local(t, start + 1.5, end - 0.5));
    if (creatorMat.current) creatorMat.current.emissiveIntensity = lerpN(2.2, 0.15, drain); // el creador se queda sin nada
    for (let i = 0; i < 5; i++) {
      const m = grabs.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.8 + i * 0.25, start + 2.2 + i * 0.25));
      m.visible = p > 0.01;
      m.position.set(lerpN(0, seats[i][0], p), 2.2, lerpN(0, seats[i][2], p));
      m.scale.setScalar(0.0001 + p * 0.5);
      m.rotation.y += 0.06;
    }
  });
  return (
    <group ref={g}>
      <mesh position={[0, 2.2, 0]}><icosahedronGeometry args={[0.8, 0]} /><meshStandardMaterial ref={creatorMat} color="#0E2236" emissive={GOLD} emissiveIntensity={2.2} toneMapped={false} /></mesh>
      {seats.map((_, i) => <mesh key={i} ref={(m) => { if (m) grabs.current[i] = m; }} visible={false}>{ideaMesh(0.4)}</mesh>)}
    </group>
  );
}

// ╔═══ 20 — Patente: la idea bajo un domo de exclusiva, con anillo girando ═══╗
function Excludability({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const ring = useRef<THREE.Mesh>(null);
  const idea = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (ring.current) ring.current.rotation.z += 0.03;
    if (idea.current) { idea.current.rotation.y += 0.05; idea.current.rotation.x += 0.02; }
  });
  return (
    <group ref={g} position={[0, 2.2, 0]}>
      <mesh ref={idea}>{ideaMesh(0.7)}</mesh>
      <mesh><sphereGeometry args={[1.35, 24, 24]} /><meshStandardMaterial color={BLUE} transparent opacity={0.12} emissive={BLUE} emissiveIntensity={0.5} side={THREE.DoubleSide} toneMapped={false} /></mesh>
      <mesh ref={ring} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[1.5, 0.05, 8, 48]} /><meshStandardMaterial color={BLUE} emissive={BLUE} emissiveIntensity={2} toneMapped={false} /></mesh>
    </group>
  );
}

// ╔═══ 21 — El equilibrio: una balanza proteger ↔ compartir que se nivela ════╗
function BalanceScale({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const beam = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const p = local(t, start + 0.5, end);
    // oscila y se asienta en equilibrio (0)
    const ang = Math.cos(p * Math.PI * 3) * (1 - smooth(p)) * 0.28;
    if (beam.current) beam.current.rotation.z = ang;
  });
  return (
    <group ref={g} position={[0, 1.6, 0]}>
      <mesh position={[0, -0.4, 0]}><coneGeometry args={[0.5, 1.4, 4]} /><meshStandardMaterial color="#2A2E38" emissive="#15171D" emissiveIntensity={0.3} /></mesh>
      <group ref={beam} position={[0, 0.5, 0]}>
        <mesh><boxGeometry args={[4.2, 0.16, 0.3]} /><meshStandardMaterial color="#3A3E48" emissive="#23262E" emissiveIntensity={0.4} toneMapped={false} /></mesh>
        {/* izq: proteger (domo/candado) */}
        <mesh position={[-2, -0.5, 0]}><sphereGeometry args={[0.5, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#11151F" emissive="#B36BFF" emissiveIntensity={1.2} toneMapped={false} /></mesh>
        {/* der: compartir (ideas) */}
        <mesh position={[1.7, -0.5, 0]}>{ideaMesh(0.34, GOLD, 1.6)}</mesh>
        <mesh position={[2.3, -0.5, 0]}>{ideaMesh(0.34, GOLD, 1.6)}</mesh>
      </group>
    </group>
  );
}

// ╔═══ 23 — Cultura: recetas que se apilan sobre la tropa ════════════════════╗
function CultureStack({ start, end, x = 7 }: { start: number; end: number; x?: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const items = useRef<THREE.Mesh[]>([]);
  const N = 6;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let i = 0; i < N; i++) {
      const m = items.current[i]; if (!m) continue;
      const p = smooth(local(t, start + 0.6 + i * 0.6, start + 1.4 + i * 0.6));
      m.visible = p > 0.01;
      m.scale.setScalar(0.0001 + p * 0.34);
      m.position.y = lerpN(3.2 + i * 0.55 + 1.5, 3.2 + i * 0.55, p);
      m.rotation.y += 0.04;
    }
  });
  return <group ref={g} position={[x, 0, 0]}>{Array.from({ length: N }).map((_, i) => <mesh key={i} ref={(m) => { if (m) items.current[i] = m; }} visible={false}>{ideaMesh(0.34)}</mesh>)}</group>;
}

// ╔═══ 25 — Franquicia: un comal se copia en una parrilla de comales ═════════╗
function Franchise({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const cells = useMemo(() => { const a: [number, number][] = []; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) a.push([(c - 1.5) * 2.4, (r - 1.5) * 2.4]); return a; }, []);
  // ordenar por distancia al centro para que se "propaguen" hacia afuera
  const order = useMemo(() => cells.map((_, i) => i).sort((a, b) => (cells[a][0] ** 2 + cells[a][1] ** 2) - (cells[b][0] ** 2 + cells[b][1] ** 2)), [cells]);
  const meshes = useRef<THREE.Mesh[]>([]);
  const span = end - start;
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    for (let k = 0; k < cells.length; k++) {
      const idx = order[k];
      const m = meshes.current[idx]; if (!m) continue;
      const p = smooth(local(t, start + 0.6 + k * (span * 0.5 / cells.length), start + 1.4 + k * (span * 0.5 / cells.length)));
      m.visible = p > 0.01;
      m.scale.setScalar(0.0001 + p);
      m.rotation.z += 0.005;
    }
  });
  return (
    <group ref={g} rotation={[-Math.PI / 2 + 0.55, 0, 0]} position={[0, 1.4, 0]}>
      {cells.map(([cx, cz], i) => (
        <mesh key={i} ref={(m) => { if (m) meshes.current[i] = m; }} position={[cx, cz, 0]} visible={false}>
          <cylinderGeometry args={[0.9, 0.9, 0.12, 32]} />
          <meshStandardMaterial color="#1C1206" emissive="#FF7A1A" emissiveIntensity={0.9} metalness={0.4} roughness={0.5} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Cámara: 25 cortes con deriva. Variada en ángulo/altura/distancia. ───────
const LOOK: [number, number, number] = [0, 2, 0];
interface Shot { p0: [number, number, number]; p1: [number, number, number]; look?: [number, number, number]; }
const SHOTS: Shot[] = [
  { p0: [-2, 8, 26], p1: [2, 6, 19] },                              // 01 establish
  { p0: [9, 4, 13], p1: [3, 3, 9], look: [0, 1.6, 0] },             // 02 misconception
  { p0: [3, 1.6, 6.5], p1: [0.8, 1.2, 4], look: [0, 1.1, 0] },      // 03 comal
  { p0: [-10, 5, 13], p1: [-5, 3.4, 9.5], look: [0, 2.2, 0] },      // 04 fierros
  { p0: [7, 3, 11], p1: [2.5, 2, 7], look: [0, 1.8, 0] },           // 05 capital build
  { p0: [-6, 2, 9], p1: [-3, 1.6, 6.5], look: [0, 1.7, 0] },        // 06 plateau low
  { p0: [0, 9, 15], p1: [0, 5, 9], look: [0, 3, 0] },               // 07 curiosity
  { p0: [8, 5, 15], p1: [3, 4, 10], look: [0, 3, 0] },              // 08 residual
  { p0: [-7, 4, 12], p1: [-3, 3, 8], look: [0, 2.2, 0] },           // 09 mystery
  { p0: [5, 3, 10], p1: [1.5, 2.5, 6.5], look: [0, 2.2, 0] },       // 10 reveal idea
  { p0: [-4, 2.5, 8], p1: [-2, 2.2, 6], look: [0, 2.2, 0] },        // 11 single idea
  { p0: [6, 3, 11], p1: [2, 2.4, 7], look: [0, 2, 0] },             // 12 rival
  { p0: [-6, 3, 11], p1: [-2, 2.4, 7], look: [0, 1.6, 0] },         // 13 non-rival
  { p0: [0, 12, 18], p1: [0, 8, 13], look: [0, 2.4, 0] },           // 14 to many (high)
  { p0: [7, 3, 10], p1: [2.5, 2.6, 7], look: [0, 2.3, 0] },         // 15 combine two
  { p0: [-13, 4, 13], p1: [11, 4, 13], look: [0, 2.0, 0] },         // 16 chain pan L→R
  { p0: [0, 16, 24], p1: [3, 12, 18], look: [0, 5, 0] },            // 17 tree explosion
  { p0: [8, 5, 16], p1: [2, 4, 11], look: [0, 4, 0] },              // 18 payoff
  { p0: [-5, 3, 10], p1: [-2, 2.6, 7], look: [0, 2.2, 0] },         // 19 free-rider
  { p0: [5, 3, 9], p1: [1.5, 2.4, 6], look: [0, 2.2, 0] },          // 20 patente
  { p0: [0, 4, 12], p1: [0, 3, 8], look: [0, 2.0, 0] },             // 21 balanza
  { p0: [11, 5, 13], p1: [7, 3, 9.5], look: [7, 1.8, 0] },          // 22 mono
  { p0: [12, 6, 14], p1: [7, 4.5, 10], look: [7, 3.4, 0] },         // 23 cultura
  { p0: [-8, 6, 17], p1: [0, 4, 11], look: [0, 4, 0] },             // 24 payoff triunfal
  { p0: [0, 11, 18], p1: [0, 6.5, 12], look: [0, 1.4, 0] },         // 25 franquicia
];
function buildCamKeys(): CineCamKey[] {
  const keys: CineCamKey[] = [];
  for (let i = 0; i < 25; i++) {
    const t0 = T[i], t1 = beatEnd(i);
    const lk = SHOTS[i].look ?? LOOK;
    keys.push({ t: t0, pos: SHOTS[i].p0, look: lk, cut: true });
    keys.push({ t: Math.max(t0 + 0.1, t1 - 0.08), pos: SHOTS[i].p1, look: lk });
  }
  return keys;
}

const SUBS = [
  'Corea del Sur, 1960: más pobre que Ghana. Hoy, 20 veces más rica. ¿Qué pasó?',
  'No fue el petróleo. No fue el oro. No fue la suerte.',
  'Lo que pasó ahí te incluye a ti, al taquero, a México entero. Es un truco.',
  'Por años la receta fue una: acumula fierros. Máquinas, fábricas, capital.',
  'La primera máquina te cambia la vida. La décima ya casi no suma.',
  'Le metes más… y dejas de crecer. Te estancas: rendimientos decrecientes.',
  'Si el capital fuera todo, el crecimiento se habría apagado. Pero no se apagó.',
  'Capital + trabajo solo explican la mitad del crecimiento. ¿Y la otra mitad?',
  'Venía de algo que no podías tocar ni pesar. Un fantasma: el residuo.',
  'Romer le puso nombre: eran las IDEAS. El conocimiento. Las recetas.',
  'Las ideas tienen una propiedad mágica que ningún fierro tiene. Míralo.',
  'Si te doy mi taco, me quedo sin taco. Las cosas son rivales.',
  'Pero si te doy mi receta… los dos la tenemos. Una idea es NO-rival.',
  'Una receta la usan mil cocinas a la vez. Se copia gratis, sin gastarse.',
  'Y se combinan: juntas dos ideas y nace una tercera que no existía.',
  'Rueda + caja: carreta. + motor: coche. + chip: lo que traes en la bolsa.',
  'Más ideas = más combinaciones. No es una suma: es bola de nieve.',
  'El capital tiene rendimientos decrecientes. Las ideas, crecientes.',
  'Pero si se copian gratis… ¿quién se rompe la cabeza inventándolas?',
  'Por eso hay patentes y secretos: un ratito de exclusiva para que valga la pena.',
  'El equilibrio de Romer: proteger para que inventen, compartir para crecer.',
  'Una mona en Japón aprendió a lavar el camote. La tropa entera la copió.',
  'Nadie perdió nada. Somos el animal que acumula recetas: cultura.',
  'Un país sin capital puede despegar. No lo necesitas todo: necesitas ideas.',
  'El taquero que la pega no compra más comales: franquicia la receta.',
];

export default function RomerClase() {
  const subtitles = SUBS.map((text, i) => ({ text, at: T[i], until: beatEnd(i) }));
  return (
    <CineStage
      mood="starry_night"
      envIntensity={0.42}
      audio="/audio/clase-romer/narration.mp3"
      duration={END}
      chapter="Romer · 2018 · el hack para crecer"
      fov={50}
      cameraPos={[0, 8, 26]}
      postfx={{ intensity: 1.5, threshold: 0.3, vignette: 0.82, aberration: 0.0006 }}
      subtitles={subtitles}
    >
      <CineCamera keys={buildCamKeys()} />

      {/* Piso + atmósfera */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.6, 0]}>
        <planeGeometry args={[140, 140]} />
        <meshStandardMaterial color="#05060E" roughness={0.5} metalness={0.4} emissive="#070914" emissiveIntensity={0.1} />
      </mesh>
      <fog attach="fog" args={['#02010A', 24, 80]} />
      <ambientLight intensity={0.2} color="#1E2440" />
      <directionalLight position={[4, 10, 5]} intensity={0.4} color="#FFE6C0" />

      {/* ─── 25 escenas, cada una visible sólo en su beat ─── */}
      <TwoCities start={T[0]} end={beatEnd(0)} />
      <MisconStrike start={T[1]} end={beatEnd(1)} />
      <Comal start={T[2]} end={beatEnd(2)} />
      <TimedGroup inAt={T[3]} outAt={beatEnd(3)}>
        <CineModel src={FACTORY} position={[-2.6, 0, -1]} at={T[3] + 0.2} color="#8A90A4" glow={0.7} fitTo={3.0} floatAmp={0} />
        <CineModel src={FACTORY} position={[0.4, 0, -2]} at={T[3] + 0.9} color="#7C8296" glow={0.6} fitTo={2.7} floatAmp={0} />
        <CineModel src={FACTORY} position={[2.9, 0, -0.6]} at={T[3] + 1.6} color="#7A8096" glow={0.6} fitTo={2.4} floatAmp={0} />
      </TimedGroup>
      <CapitalBar start={T[4]} end={beatEnd(6)} />
      <CuriositySpark start={T[6]} end={beatEnd(6)} />
      <ResidualBars start={T[7]} end={beatEnd(7)} />
      <MysteryReveal start={T[8]} end={beatEnd(9)} />
      <SingleIdea start={T[10]} end={beatEnd(10)} />
      <NonRival start={T[11]} end={beatEnd(12)} />
      <IdeaToMany start={T[13]} end={beatEnd(13)} />
      <CombineTwo start={T[14]} end={beatEnd(14)} />
      <CombineChain start={T[15]} end={beatEnd(15)} />
      <IdeaTree start={T[16]} end={beatEnd(16)} />
      <PayoffBars start={T[17]} end={beatEnd(17)} />
      <FreeRider start={T[18]} end={beatEnd(18)} />
      <Excludability start={T[19]} end={beatEnd(19)} />
      <BalanceScale start={T[20]} end={beatEnd(20)} />
      <TimedGroup inAt={T[21]} outAt={beatEnd(22)}>
        <CineModel src={MONKEY} position={[6.4, 0.5, 0]} at={T[21]} color="#E8B27A" glow={1.1} fitTo={2.6} floatAmp={0.12} spin={0.2} />
        <CineModel src={MONKEY} position={[8.4, 0.4, -1.6]} at={T[22] + 0.3} color="#D9A56E" glow={0.9} fitTo={2.2} floatAmp={0.1} spin={-0.18} />
      </TimedGroup>
      <CultureStack start={T[22]} end={beatEnd(22)} x={7} />
      <PayoffBars start={T[23]} end={beatEnd(23)} />
      <Franchise start={T[24]} end={beatEnd(24)} />
    </CineStage>
  );
}
