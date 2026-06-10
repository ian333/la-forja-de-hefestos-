/**
 * MicroscopioCorriente — bajar del símbolo del circuito a la FÍSICA REAL.
 *
 * No "cablecitos con puntitos". Aquí se VE y se SIENTE lo que de verdad pasa:
 *   1. RESISTENCIA — estás DENTRO del alambre: un mar de electrones con
 *      estelas, chocando contra la red. La red VIBRA al calentarse (eso son
 *      los fonones) y se pone al rojo. P ∝ E² = I²R.
 *   2. BOBINA — el campo magnético REAL (Biot-Savart): el brillo de cada
 *      línea es |B| de verdad (feroz adentro, tenue afuera) y hay flujo
 *      circulando por ellas. La corriente que lo causa se ve correr en el cobre.
 *   3. LED — la unión dispara fotones-estela del color exacto del band gap
 *      (λ = h·c/E_g) y la luz ILUMINA la escena: enciendes un LED de verdad.
 *
 * Física en src/lib/circuitos/microfisica.ts (12 tests vs fórmula).
 * Brillo por materiales emisivos + sprites additive — sin EffectComposer,
 * para que se vea igual de bien en el teléfono de un estudiante en LATAM.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import {
  makeRng, stepDrude, helixSegments, biotSavart,
  bandgapToWavelengthNm, wavelengthToRGB, type Vec3, type DrudeElectron,
} from '@/lib/circuitos/microfisica';

type View = 'resistencia' | 'bobina' | 'led';

const HUD: Record<View, string> = {
  resistencia: 'Estás DENTRO del alambre · cada chispa es un electrón entregando su energía a la red',
  bobina: 'El brillo de cada línea es |B| real (Biot-Savart) · el flujo te dice la dirección',
  led: 'Cada destello en la unión es un electrón cayendo a un hueco · el fotón sale con λ = h·c/E_g',
};

export default function MicroscopioCorriente() {
  const [view, setView] = useState<View>('resistencia');
  const [voltage, setVoltage] = useState(2.2);
  const [current, setCurrent] = useState(2.5);
  const [ledV, setLedV] = useState(3.0); // arriba del gap del azul: arranca ENCENDIDO
  const [material, setMaterial] = useState(4); // azul por default: el premio Nobel

  const tabs: { id: View; label: string; icon: string }[] = [
    { id: 'resistencia', label: 'Resistencia → calor', icon: '🔥' },
    { id: 'bobina', label: 'Bobina → campo', icon: '🧲' },
    { id: 'led', label: 'LED → luz', icon: '💡' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3 h-full p-3 overflow-hidden">
      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                t.id === view ? 'bg-[#d4b050] text-[#181d2e] border-[#d4b050]'
                              : 'bg-[#1e2538] text-[#a0947e] border-[#2c2818] hover:border-[#3e3624]'}`}>
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-h-0 rounded-lg border border-[#2c2818] overflow-hidden bg-black" style={{ minHeight: 420 }}>
          <Stage key={view}
            cameraDistance={view === 'resistencia' ? 6.5 : view === 'bobina' ? 6 : 6}
            autoRotate enablePan={false} bgColor="#030407">
            {view === 'resistencia' && <ResistorScene voltage={voltage} />}
            {view === 'bobina' && <CoilScene current={current} />}
            {view === 'led' && <LedScene voltage={ledV} eg={LED_MATERIALS[material].eg} />}
          </Stage>
          {/* HUD cinematográfico (DOM, nunca drei Text) */}
          <div className="absolute bottom-2 left-3 right-3 pointer-events-none">
            <span className="text-[11px] font-mono text-[#a0947e] bg-[#03040a]/70 px-2 py-1 rounded">
              {HUD[view]}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        {view === 'resistencia' && <ResistorPanel voltage={voltage} setVoltage={setVoltage} />}
        {view === 'bobina' && <CoilPanel current={current} setCurrent={setCurrent} />}
        {view === 'led' && (
          <LedPanel voltage={ledV} setVoltage={setLedV} material={material} setMaterial={setMaterial} />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 1) RESISTENCIA — dentro del alambre (Drude + fonones visibles)
// ════════════════════════════════════════════════════════════════════════

const NXI = 10, NYI = 4, NZI = 4;
const N_IONS = NXI * NYI * NZI;
const N_E = 260;
const BOX = { x: 3.6, y: 1.25, z: 1.25 };
const WIRE_R = Math.hypot(BOX.y, BOX.z) * 1.18;

const COLD = new THREE.Color('#232c44');   // ion frío: azul metálico apagado
const WARM = new THREE.Color('#ff6a13');   // al rojo
const HOT = new THREE.Color('#fff3d6');    // blanco incandescente
const tmpColor = new THREE.Color();
function tempToColor(t: number, out: THREE.Color): THREE.Color {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.55) out.copy(COLD).lerp(WARM, x / 0.55);
  else out.copy(WARM).lerp(HOT, (x - 0.55) / 0.45);
  return out;
}

function ionLattice(): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < NXI; i++)
    for (let j = 0; j < NYI; j++)
      for (let k = 0; k < NZI; k++)
        pts.push([
          ((i + 0.5) / NXI - 0.5) * 2 * BOX.x,
          ((j + 0.5) / NYI - 0.5) * 2 * BOX.y,
          ((k + 0.5) / NZI - 0.5) * 2 * BOX.z,
        ]);
  return pts;
}

const MAX_SPARKS = 90;
interface Spark { x: number; y: number; z: number; life: number; heat: number }

function ResistorScene({ voltage }: { voltage: number }) {
  const sprite = useMemo(() => getParticleTexture(), []);
  const ions = useMemo(ionLattice, []);
  const phases = useMemo(() => ions.map((_, i) => [i * 1.7, i * 2.3, i * 3.1] as Vec3), [ions]);
  const temps = useRef(new Float32Array(N_IONS));
  const ionsRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // halos de calor de los iones
  const haloGeom = useRef<THREE.BufferGeometry>(null);
  const haloPos = useMemo(() => new Float32Array(N_IONS * 3), []);
  const haloCol = useMemo(() => new Float32Array(N_IONS * 3), []);

  // electrones + estelas (streak desde una posición rezagada)
  const eState = useRef<DrudeElectron[]>([]);
  const lagPos = useRef(new Float32Array(N_E * 3));
  if (eState.current.length === 0) {
    const rng0 = makeRng(42);
    eState.current = Array.from({ length: N_E }, () => ({
      x: (rng0() - 0.5) * 2 * BOX.x,
      y: (rng0() - 0.5) * 2 * BOX.y,
      z: (rng0() - 0.5) * 2 * BOX.z,
      vx: 0, vy: 0, vz: 0,
    }));
    eState.current.forEach((e, i) => {
      lagPos.current[i * 3] = e.x; lagPos.current[i * 3 + 1] = e.y; lagPos.current[i * 3 + 2] = e.z;
    });
  }
  const eGeom = useRef<THREE.BufferGeometry>(null);
  const ePos = useMemo(() => new Float32Array(N_E * 3), []);
  const eCol = useMemo(() => new Float32Array(N_E * 3), []);
  const trailGeom = useRef<THREE.BufferGeometry>(null);
  const trailPos = useMemo(() => new Float32Array(N_E * 2 * 3), []);
  const trailCol = useMemo(() => new Float32Array(N_E * 2 * 3), []);

  // chispas de impacto
  const sparks = useRef<Spark[]>([]);
  const spGeom = useRef<THREE.BufferGeometry>(null);
  const spPos = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const spCol = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);

  const rng = useMemo(() => makeRng(20260609), []);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = state.clock.elapsedTime;
    const accel = voltage * 1.1;
    const tau = 0.2, vth = 2.4;
    const T = temps.current;
    const E = eState.current;

    // ── electrones (2 sub-pasos) ──
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < N_E; i++) {
        const e = E[i];
        const r = stepDrude(e, accel, dt * 0.5, tau, vth, rng);
        if (Math.abs(e.y) > BOX.y) { e.vy *= -1; e.y = Math.sign(e.y) * BOX.y; }
        if (Math.abs(e.z) > BOX.z) { e.vz *= -1; e.z = Math.sign(e.z) * BOX.z; }
        if (e.x > BOX.x) { e.x -= 2 * BOX.x; lagPos.current[i * 3] -= 2 * BOX.x; }
        if (e.x < -BOX.x) { e.x += 2 * BOX.x; lagPos.current[i * 3] += 2 * BOX.x; }
        if (r.collided) {
          // calor de Joule al ion más cercano
          if (r.work > 0) {
            let best = 0, bestd = Infinity;
            for (let k = 0; k < N_IONS; k++) {
              const dx = e.x - ions[k][0], dy = e.y - ions[k][1], dz = e.z - ions[k][2];
              const d = dx * dx + dy * dy + dz * dz;
              if (d < bestd) { bestd = d; best = k; }
            }
            T[best] = Math.min(1.25, T[best] + r.work * 0.8);
          }
          // chispa SOLO si el arrastre del campo dominó el impacto (no el jiggle térmico)
          if (sparks.current.length < MAX_SPARKS && r.work > 0.05 && rng() < 0.3) {
            sparks.current.push({ x: e.x, y: e.y, z: e.z, life: 1, heat: Math.min(1, r.work * 6) });
          }
        }
      }
    }
    // difusión + enfriamiento
    for (let k = 0; k < N_IONS; k++) T[k] *= 0.976;

    // ── iones: color + VIBRACIÓN térmica (fonones) ──
    const mesh = ionsRef.current;
    if (mesh) {
      for (let k = 0; k < N_IONS; k++) {
        const amp = 0.015 + T[k] * 0.11;
        const p = ions[k], ph = phases[k];
        dummy.position.set(
          p[0] + Math.sin(t * 23 + ph[0]) * amp,
          p[1] + Math.sin(t * 29 + ph[1]) * amp,
          p[2] + Math.sin(t * 31 + ph[2]) * amp,
        );
        const s = 1 + T[k] * 0.25;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        mesh.setMatrixAt(k, dummy.matrix);
        tempToColor(T[k], tmpColor);
        mesh.setColorAt(k, tmpColor);
        // halo: invisible frío, brasa saturada caliente (más luz ≠ más color)
        const glow = Math.min(1, T[k]) ** 2 * 0.5;
        haloPos[k * 3] = dummy.position.x; haloPos[k * 3 + 1] = dummy.position.y; haloPos[k * 3 + 2] = dummy.position.z;
        haloCol[k * 3] = tmpColor.r * glow; haloCol[k * 3 + 1] = tmpColor.g * glow * 0.85; haloCol[k * 3 + 2] = tmpColor.b * glow * 0.6;
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (haloGeom.current) {
      (haloGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (haloGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // ── electrones + estelas ──
    for (let i = 0; i < N_E; i++) {
      const e = E[i];
      // la cola persigue a la cabeza → streak proporcional a la velocidad
      lagPos.current[i * 3] += (e.x - lagPos.current[i * 3]) * 0.18;
      lagPos.current[i * 3 + 1] += (e.y - lagPos.current[i * 3 + 1]) * 0.18;
      lagPos.current[i * 3 + 2] += (e.z - lagPos.current[i * 3 + 2]) * 0.18;
      ePos[i * 3] = e.x; ePos[i * 3 + 1] = e.y; ePos[i * 3 + 2] = e.z;
      const sp = Math.min(1, Math.hypot(e.vx, e.vy, e.vz) / (vth * 1.8));
      eCol[i * 3] = 0.25 + sp * 0.45; eCol[i * 3 + 1] = 0.62 + sp * 0.38; eCol[i * 3 + 2] = 1.0;
      trailPos[i * 6] = e.x; trailPos[i * 6 + 1] = e.y; trailPos[i * 6 + 2] = e.z;
      trailPos[i * 6 + 3] = lagPos.current[i * 3]; trailPos[i * 6 + 4] = lagPos.current[i * 3 + 1]; trailPos[i * 6 + 5] = lagPos.current[i * 3 + 2];
      const tb = 0.55 + sp * 0.45;
      trailCol[i * 6] = 0.15 * tb; trailCol[i * 6 + 1] = 0.5 * tb; trailCol[i * 6 + 2] = 1.0 * tb;
      trailCol[i * 6 + 3] = 0; trailCol[i * 6 + 4] = 0.03; trailCol[i * 6 + 5] = 0.08; // cola muere a negro
    }
    if (eGeom.current) {
      (eGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (eGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
    if (trailGeom.current) {
      (trailGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (trailGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // ── chispas ──
    const S = sparks.current;
    for (let i = S.length - 1; i >= 0; i--) { S[i].life -= dt * 3.2; if (S[i].life <= 0) S.splice(i, 1); }
    for (let i = 0; i < MAX_SPARKS; i++) {
      if (i < S.length) {
        const s = S[i];
        spPos[i * 3] = s.x; spPos[i * 3 + 1] = s.y; spPos[i * 3 + 2] = s.z;
        const b = s.life * s.life * (0.6 + s.heat);
        spCol[i * 3] = 1.0 * b; spCol[i * 3 + 1] = 0.85 * b; spCol[i * 3 + 2] = 0.55 * b;
      } else { spPos[i * 3] = 9999; spCol[i * 3] = 0; spCol[i * 3 + 1] = 0; spCol[i * 3 + 2] = 0; }
    }
    if (spGeom.current) {
      (spGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (spGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group>
      {/* pared del alambre: estás adentro de un conductor, no en el vacío */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WIRE_R, WIRE_R, BOX.x * 2.3, 36, 1, true]} />
        <meshStandardMaterial color="#3a2f1d" emissive="#1a1206" emissiveIntensity={0.5}
          transparent opacity={0.16} side={THREE.BackSide} roughness={0.6} metalness={0.8} depthWrite={false} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[WIRE_R, WIRE_R, BOX.x * 2.3, 36, 1, true]} />
        <meshBasicMaterial color="#5a4624" transparent opacity={0.06} side={THREE.FrontSide}
          blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      {/* iones (la red cristalina) */}
      <instancedMesh ref={ionsRef} args={[undefined, undefined, N_IONS]}>
        <sphereGeometry args={[0.13, 14, 14]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* halos de incandescencia */}
      <points>
        <bufferGeometry ref={haloGeom}>
          <bufferAttribute attach="attributes-position" args={[haloPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[haloCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.85} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      {/* estelas de los electrones (la VELOCIDAD se siente) */}
      <lineSegments>
        <bufferGeometry ref={trailGeom}>
          <bufferAttribute attach="attributes-position" args={[trailPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[trailCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.85} depthWrite={false}
          blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
      {/* electrones */}
      <points>
        <bufferGeometry ref={eGeom}>
          <bufferAttribute attach="attributes-position" args={[ePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[eCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.28} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      {/* chispas de colisión */}
      <points>
        <bufferGeometry ref={spGeom}>
          <bufferAttribute attach="attributes-position" args={[spPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[spCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.85} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 2) BOBINA — el campo con su intensidad real y flujo circulando
// ════════════════════════════════════════════════════════════════════════

const COIL = { turns: 6, radius: 0.85, length: 3.0 };

interface FieldLine { pos: Float32Array; mag: Float32Array; count: number }

function CoilScene({ current }: { current: number }) {
  const sprite = useMemo(() => getParticleTexture(), []);
  const segs = useMemo(() => helixSegments(COIL.turns, COIL.radius, COIL.length, 24), []);
  const coilCurve = useMemo(() => {
    const pts = segs.map((s) => new THREE.Vector3(...s.a));
    pts.push(new THREE.Vector3(...segs[segs.length - 1].b));
    return new THREE.CatmullRomCurve3(pts);
  }, [segs]);

  // líneas de campo con |B| por vértice (normalizado al B del centro)
  const lines = useMemo<FieldLine[]>(() => traceFieldLines(segs), [segs]);

  // geometrías de línea con color ∝ |B| (se reescala al cambiar corriente)
  const lineGeoms = useRef<(THREE.BufferGeometry | null)[]>([]);
  useEffect(() => {
    const g = Math.min(1, current / 5);
    lines.forEach((L, i) => {
      const geom = lineGeoms.current[i];
      if (!geom) return;
      const col = geom.getAttribute('color') as THREE.BufferAttribute;
      for (let k = 0; k < L.count; k++) {
        const b = Math.pow(L.mag[k], 0.4) * (0.18 + 0.85 * g);
        col.setXYZ(k, 0.30 * b, 0.62 * b, 1.0 * b);
      }
      col.needsUpdate = true;
    });
  }, [current, lines]);

  // flujo: partículas avanzando por las líneas, rapidez ∝ |B| y corriente
  const flow = useMemo(() => {
    const list: { line: number; t: number }[] = [];
    lines.forEach((L, li) => {
      const n = Math.max(3, Math.floor(L.count / 38));
      for (let k = 0; k < n; k++) list.push({ line: li, t: (k / n) * L.count });
    });
    return list;
  }, [lines]);
  const flowGeom = useRef<THREE.BufferGeometry>(null);
  const flowPos = useMemo(() => new Float32Array(flow.length * 3), [flow]);
  const flowCol = useMemo(() => new Float32Array(flow.length * 3), [flow]);

  // corriente visible: electrones corriendo por el cobre
  const N_CE = 70;
  const coilE = useRef(Array.from({ length: N_CE }, (_, i) => i / N_CE));
  const ceGeom = useRef<THREE.BufferGeometry>(null);
  const cePos = useMemo(() => new Float32Array(N_CE * 3), []);
  const ceCol = useMemo(() => new Float32Array(N_CE * 3), []);
  const tmpV = useMemo(() => new THREE.Vector3(), []);

  const coilMat = useRef<THREE.MeshStandardMaterial>(null);
  const glowMats = useRef<(THREE.SpriteMaterial | null)[]>([]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const g = Math.min(1, current / 5);
    const pulse = 0.9 + 0.1 * Math.sin(state.clock.elapsedTime * 2.4);

    // flujo por las líneas
    for (let i = 0; i < flow.length; i++) {
      const f = flow[i];
      const L = lines[f.line];
      const k = Math.floor(f.t) % L.count;
      const m = L.mag[k];
      f.t += (4 + 90 * m) * (0.25 + g) * dt;
      if (f.t >= L.count - 1) f.t = 0;
      const kk = Math.floor(f.t), frac = f.t - kk;
      const k2 = Math.min(kk + 1, L.count - 1);
      flowPos[i * 3] = L.pos[kk * 3] * (1 - frac) + L.pos[k2 * 3] * frac;
      flowPos[i * 3 + 1] = L.pos[kk * 3 + 1] * (1 - frac) + L.pos[k2 * 3 + 1] * frac;
      flowPos[i * 3 + 2] = L.pos[kk * 3 + 2] * (1 - frac) + L.pos[k2 * 3 + 2] * frac;
      const b = Math.pow(L.mag[kk], 0.35) * (0.25 + g) * 1.6 * pulse;
      flowCol[i * 3] = 0.45 * b; flowCol[i * 3 + 1] = 0.75 * b; flowCol[i * 3 + 2] = 1.0 * b;
    }
    if (flowGeom.current) {
      (flowGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (flowGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // electrones en el cobre (la CAUSA del campo)
    const speed = 0.012 + g * 0.12;
    for (let i = 0; i < N_CE; i++) {
      coilE.current[i] = (coilE.current[i] + speed * dt) % 1;
      coilCurve.getPointAt(coilE.current[i], tmpV);
      cePos[i * 3] = tmpV.x; cePos[i * 3 + 1] = tmpV.y; cePos[i * 3 + 2] = tmpV.z;
      const b = 0.5 + g * 0.8;
      ceCol[i * 3] = 1.0 * b; ceCol[i * 3 + 1] = 0.75 * b; ceCol[i * 3 + 2] = 0.35 * b;
    }
    if (ceGeom.current) {
      (ceGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (ceGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    if (coilMat.current) coilMat.current.emissiveIntensity = 0.35 + g * 1.3;
    glowMats.current.forEach((m, i) => { if (m) m.opacity = (0.05 + g * 0.22) * pulse * (1 - i * 0.25); });
  });

  return (
    <group>
      {/* la bobina de cobre */}
      <mesh>
        <tubeGeometry args={[coilCurve, 360, 0.075, 10, false]} />
        <meshStandardMaterial ref={coilMat} color="#b06a28" emissive="#ff7a22"
          emissiveIntensity={0.6} metalness={0.75} roughness={0.3} toneMapped={false} />
      </mesh>
      {/* corriente corriendo por el cobre */}
      <points>
        <bufferGeometry ref={ceGeom}>
          <bufferAttribute attach="attributes-position" args={[cePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[ceCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.22} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      {/* núcleo de campo: glow volumétrico dentro del solenoide */}
      {[0, -0.9, 0.9].map((x, i) => (
        <sprite key={i} position={[x, 0, 0]} scale={[2.6 - Math.abs(x), 1.7, 1]}>
          <spriteMaterial ref={(m) => { glowMats.current[i] = m; }} map={sprite} color="#3f86ff"
            transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </sprite>
      ))}
      {/* líneas de campo — brillo = |B| real */}
      {lines.map((L, i) => (
        <line key={i}>
          <bufferGeometry ref={(geo) => { lineGeoms.current[i] = geo as THREE.BufferGeometry | null; }}>
            <bufferAttribute attach="attributes-position" args={[L.pos, 3]} />
            <bufferAttribute attach="attributes-color" args={[new Float32Array(L.count * 3), 3]} />
          </bufferGeometry>
          <lineBasicMaterial vertexColors transparent opacity={1} depthWrite={false}
            blending={THREE.AdditiveBlending} toneMapped={false} />
        </line>
      ))}
      {/* flujo del campo */}
      <points>
        <bufferGeometry ref={flowGeom}>
          <bufferAttribute attach="attributes-position" args={[flowPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[flowCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.3} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}

/** Traza líneas de campo (dirección de B) guardando |B| normalizado por vértice. */
function traceFieldLines(segs: Array<{ a: Vec3; b: Vec3 }>): FieldLine[] {
  const out: FieldLine[] = [];
  const ds = 0.07, steps = 360, bounds = 4.6;
  const Bc = biotSavart([0, 0, 0], segs, 1);
  const Bmax = Math.hypot(Bc[0], Bc[1], Bc[2]);

  const seeds: Vec3[] = [];
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    for (const rr of [0.22, 0.5, 0.74]) {
      seeds.push([0, rr * COIL.radius * Math.cos(ang), rr * COIL.radius * Math.sin(ang)]);
    }
  }
  for (const seed of seeds) {
    const fwd = integrate(seed, +1);
    const bwd = integrate(seed, -1);
    bwd.reverse();
    const all = [...bwd, ...fwd];
    const pos = new Float32Array(all.length * 3);
    const mag = new Float32Array(all.length);
    all.forEach((p, i) => {
      pos[i * 3] = p.p[0]; pos[i * 3 + 1] = p.p[1]; pos[i * 3 + 2] = p.p[2];
      mag[i] = Math.min(1, p.m / Bmax);
    });
    out.push({ pos, mag, count: all.length });
  }
  return out;

  function integrate(start: Vec3, dir: number): Array<{ p: Vec3; m: number }> {
    const path: Array<{ p: Vec3; m: number }> = [];
    let p: Vec3 = [...start] as Vec3;
    for (let i = 0; i < steps; i++) {
      const B = biotSavart(p, segs, 1);
      const m = Math.hypot(B[0], B[1], B[2]);
      if (m < 1e-20) break;
      p = [p[0] + (B[0] / m) * ds * dir, p[1] + (B[1] / m) * ds * dir, p[2] + (B[2] / m) * ds * dir];
      path.push({ p, m });
      if (Math.abs(p[0]) > bounds || Math.hypot(p[1], p[2]) > bounds) break;
    }
    return path;
  }
}

// ════════════════════════════════════════════════════════════════════════
// 3) LED — la unión dispara fotones y la luz LLENA la escena
// ════════════════════════════════════════════════════════════════════════

const LED_MATERIALS = [
  { name: 'Infrarrojo (AlGaAs)', eg: 1.4 },
  { name: 'Rojo (AlGaInP)', eg: 1.9 },
  { name: 'Ámbar', eg: 2.1 },
  { name: 'Verde (InGaN)', eg: 2.4 },
  { name: 'Azul (InGaN)', eg: 2.7 },
  { name: 'Violeta', eg: 3.0 },
];

const N_CARR = 110;
const MAXPH = 160;   // fotones-estela
const MAXFL = 50;    // destellos de recombinación

interface PhotonStreak { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }
interface Flash { x: number; y: number; z: number; life: number }

function LedScene({ voltage, eg }: { voltage: number; eg: number }) {
  const sprite = useMemo(() => getParticleTexture(), []);
  const color = useMemo(() => {
    const [r, g, b] = wavelengthToRGB(bandgapToWavelengthNm(eg));
    return new THREE.Color(r, g, b);
  }, [eg]);
  const on = voltage >= eg;
  const drive = Math.max(0, voltage - eg);

  const rng = useMemo(() => makeRng(7), []);
  const carriers = useRef(
    Array.from({ length: N_CARR * 2 }, (_, i) => ({
      hole: i < N_CARR,
      x: (i < N_CARR ? -1 : 1) * (0.4 + (i % N_CARR) / N_CARR * 2.4),
      y: (Math.sin(i * 7.7) * 0.8),
      z: (Math.cos(i * 5.3) * 0.8),
      lx: 0, ly: 0, lz: 0, // cola de la estela
    })),
  );
  useEffect(() => {
    carriers.current.forEach((c) => { c.lx = c.x; c.ly = c.y; c.lz = c.z; });
  }, []);

  const photons = useRef<PhotonStreak[]>([]);
  const flashes = useRef<Flash[]>([]);

  const cGeom = useRef<THREE.BufferGeometry>(null);
  const cPos = useMemo(() => new Float32Array(N_CARR * 2 * 3), []);
  const cCol = useMemo(() => new Float32Array(N_CARR * 2 * 3), []);
  const ctGeom = useRef<THREE.BufferGeometry>(null);
  const ctPos = useMemo(() => new Float32Array(N_CARR * 2 * 2 * 3), []);
  const ctCol = useMemo(() => new Float32Array(N_CARR * 2 * 2 * 3), []);

  const phGeom = useRef<THREE.BufferGeometry>(null);  // estelas de fotón (líneas)
  const phPos = useMemo(() => new Float32Array(MAXPH * 2 * 3), []);
  const phCol = useMemo(() => new Float32Array(MAXPH * 2 * 3), []);
  const flGeom = useRef<THREE.BufferGeometry>(null);  // destellos (points)
  const flPos = useMemo(() => new Float32Array(MAXFL * 3), []);
  const flCol = useMemo(() => new Float32Array(MAXFL * 3), []);

  const domeMat = useRef<THREE.MeshPhysicalMaterial>(null);
  const junctionMat = useRef<THREE.MeshBasicMaterial>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const glowMat = useRef<THREE.SpriteMaterial>(null);
  const recentRecomb = useRef(0);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const C = carriers.current;
    const driftV = on ? 0.6 + drive * 1.3 : 0.05;
    recentRecomb.current *= 0.92;

    for (let i = 0; i < C.length; i++) {
      const c = C[i];
      const toward = c.hole ? 1 : -1;
      c.x += toward * driftV * dt + (rng() - 0.5) * 0.045;
      c.y += (rng() - 0.5) * 0.04; c.z += (rng() - 0.5) * 0.04;
      c.y *= 0.999; c.z *= 0.999;
      c.lx += (c.x - c.lx) * 0.15; c.ly += (c.y - c.ly) * 0.15; c.lz += (c.z - c.lz) * 0.15;
      // recombinación en la unión
      if (on && Math.abs(c.x) < 0.16 && rng() < 0.55) {
        recentRecomb.current += 1;
        if (flashes.current.length < MAXFL) flashes.current.push({ x: 0, y: c.y * 0.6, z: c.z * 0.6, life: 1 });
        if (photons.current.length < MAXPH) {
          const th = rng() * Math.PI * 2, ph = Math.acos(2 * rng() - 1);
          const sp = 4.5 + drive * 2;
          photons.current.push({
            x: 0, y: c.y * 0.6, z: c.z * 0.6,
            vx: Math.sin(ph) * Math.cos(th) * sp,
            vy: Math.cos(ph) * sp * 0.8 + 1.4,
            vz: Math.sin(ph) * Math.sin(th) * sp,
            life: 1,
          });
        }
        c.x = c.hole ? -2.8 : 2.8; c.y = (rng() - 0.5) * 1.6; c.z = (rng() - 0.5) * 1.6;
        c.lx = c.x; c.ly = c.y; c.lz = c.z;
      }
      if (c.x > 3 || c.x < -3) { c.x = c.hole ? -2.8 : 2.8; c.lx = c.x; }
    }

    // buffers de portadores + estelas
    for (let i = 0; i < C.length; i++) {
      const c = C[i];
      cPos[i * 3] = c.x; cPos[i * 3 + 1] = c.y; cPos[i * 3 + 2] = c.z;
      if (c.hole) { cCol[i * 3] = 1; cCol[i * 3 + 1] = 0.38; cCol[i * 3 + 2] = 0.18; }
      else { cCol[i * 3] = 0.28; cCol[i * 3 + 1] = 0.62; cCol[i * 3 + 2] = 1; }
      ctPos[i * 6] = c.x; ctPos[i * 6 + 1] = c.y; ctPos[i * 6 + 2] = c.z;
      ctPos[i * 6 + 3] = c.lx; ctPos[i * 6 + 4] = c.ly; ctPos[i * 6 + 5] = c.lz;
      ctCol[i * 6] = cCol[i * 3] * 0.7; ctCol[i * 6 + 1] = cCol[i * 3 + 1] * 0.7; ctCol[i * 6 + 2] = cCol[i * 3 + 2] * 0.7;
      ctCol[i * 6 + 3] = 0; ctCol[i * 6 + 4] = 0; ctCol[i * 6 + 5] = 0;
    }
    if (cGeom.current) {
      (cGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (cGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
    if (ctGeom.current) {
      (ctGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (ctGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // fotones-estela
    const P = photons.current;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.life -= dt * 1.1;
      if (p.life <= 0 || Math.hypot(p.x, p.y, p.z) > 6) P.splice(i, 1);
    }
    const STREAK = 0.09;
    for (let i = 0; i < MAXPH; i++) {
      if (i < P.length) {
        const p = P[i];
        phPos[i * 6] = p.x; phPos[i * 6 + 1] = p.y; phPos[i * 6 + 2] = p.z;
        phPos[i * 6 + 3] = p.x - p.vx * STREAK; phPos[i * 6 + 4] = p.y - p.vy * STREAK; phPos[i * 6 + 5] = p.z - p.vz * STREAK;
        const b = Math.max(0, p.life) * 1.5;
        phCol[i * 6] = color.r * b; phCol[i * 6 + 1] = color.g * b; phCol[i * 6 + 2] = color.b * b;
        phCol[i * 6 + 3] = 0; phCol[i * 6 + 4] = 0; phCol[i * 6 + 5] = 0;
      } else {
        phPos[i * 6] = 9999; phPos[i * 6 + 3] = 9999;
        for (let k = 0; k < 6; k++) phCol[i * 6 + k] = 0;
      }
    }
    if (phGeom.current) {
      (phGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (phGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // destellos
    const F = flashes.current;
    for (let i = F.length - 1; i >= 0; i--) { F[i].life -= dt * 4.5; if (F[i].life <= 0) F.splice(i, 1); }
    for (let i = 0; i < MAXFL; i++) {
      if (i < F.length) {
        const f = F[i];
        flPos[i * 3] = f.x; flPos[i * 3 + 1] = f.y; flPos[i * 3 + 2] = f.z;
        const b = f.life * f.life * 2.2;
        flCol[i * 3] = Math.min(1.5, color.r * b + 0.4 * b);
        flCol[i * 3 + 1] = Math.min(1.5, color.g * b + 0.4 * b);
        flCol[i * 3 + 2] = Math.min(1.5, color.b * b + 0.4 * b);
      } else { flPos[i * 3] = 9999; flCol[i * 3] = 0; flCol[i * 3 + 1] = 0; flCol[i * 3 + 2] = 0; }
    }
    if (flGeom.current) {
      (flGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (flGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }

    // la LUZ de verdad: ilumina domo, piso y todo lo standard
    const emit = on ? Math.min(1, recentRecomb.current / 6) : 0;
    if (lightRef.current) {
      lightRef.current.color.copy(color);
      lightRef.current.intensity = on ? 6 + emit * 26 + drive * 10 : 0;
    }
    if (domeMat.current) {
      domeMat.current.emissive.copy(color);
      domeMat.current.emissiveIntensity = on ? 0.12 + emit * 0.5 : 0.015;
    }
    if (junctionMat.current) {
      junctionMat.current.color.copy(color).multiplyScalar(on ? 0.5 + emit * 1.6 : 0.12);
    }
    if (glowMat.current) {
      glowMat.current.color.copy(color);
      glowMat.current.opacity = on ? 0.1 + emit * 0.38 : 0;
    }
  });

  return (
    <group>
      {/* la luz REAL del LED (ilumina la escena) */}
      <pointLight ref={lightRef} position={[0, 0.6, 0]} distance={14} decay={1.6} intensity={0} />
      {/* piso que recibe la luz — sin esto no "sientes" que alumbra */}
      <mesh position={[0, -1.9, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7, 48]} />
        <meshStandardMaterial color="#11141c" roughness={0.55} metalness={0.1} />
      </mesh>
      {/* domo de vidrio */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[1.55, 28, 28, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
        <meshPhysicalMaterial ref={domeMat} color="#ffffff" transparent opacity={0.07}
          roughness={0.05} metalness={0} transmission={0} emissive="#000000"
          emissiveIntensity={0.05} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* halo del domo (el resplandor que ves al mirar un LED prendido) */}
      <sprite position={[0, 0.45, 0]} scale={[4.6, 4.6, 1]}>
        <spriteMaterial ref={glowMat} map={sprite} transparent opacity={0}
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* la unión P-N */}
      <mesh>
        <boxGeometry args={[0.05, 2.1, 2.1]} />
        <meshBasicMaterial ref={junctionMat} transparent opacity={0.5} toneMapped={false}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* zonas P y N (bloques semiconductores tenues) */}
      <mesh position={[-1.55, 0, 0]}>
        <boxGeometry args={[2.9, 1.9, 1.9]} />
        <meshStandardMaterial color="#2a1410" transparent opacity={0.22} roughness={0.7} depthWrite={false} />
      </mesh>
      <mesh position={[1.55, 0, 0]}>
        <boxGeometry args={[2.9, 1.9, 1.9]} />
        <meshStandardMaterial color="#0e1830" transparent opacity={0.22} roughness={0.7} depthWrite={false} />
      </mesh>
      {/* estelas de portadores */}
      <lineSegments>
        <bufferGeometry ref={ctGeom}>
          <bufferAttribute attach="attributes-position" args={[ctPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[ctCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.8} depthWrite={false}
          blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
      {/* portadores */}
      <points>
        <bufferGeometry ref={cGeom}>
          <bufferAttribute attach="attributes-position" args={[cPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[cCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.3} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      {/* fotones como ESTELAS de luz */}
      <lineSegments>
        <bufferGeometry ref={phGeom}>
          <bufferAttribute attach="attributes-position" args={[phPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[phCol, 3]} />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={1} depthWrite={false}
          blending={THREE.AdditiveBlending} toneMapped={false} />
      </lineSegments>
      {/* destellos de recombinación */}
      <points>
        <bufferGeometry ref={flGeom}>
          <bufferAttribute attach="attributes-position" args={[flPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[flCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.9} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Paneles laterales
// ════════════════════════════════════════════════════════════════════════

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Slider({ label, value, set, min, max, step, fmt }: {
  label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-[12px] mb-1">
        <span className="text-[#c9bfa8]">{label}</span>
        <span className="font-mono text-[#ead080]">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => set(parseFloat(e.target.value))} className="w-full accent-[#d4b050]" />
    </label>
  );
}

function ResistorPanel({ voltage, setVoltage }: { voltage: number; setVoltage: (v: number) => void }) {
  const heat = Math.min(1, (voltage * voltage) / 16);
  return (
    <>
      <Panel title="Qué estás viendo">
        <p className="text-[13px] text-[#c9bfa8] leading-relaxed">
          Estás <b>dentro del alambre</b>. La corriente NO es "puntitos que viajan": es un mar de electrones
          que <b>apenas avanza</b> (~mm/s) sobre un caos térmico brutal. Cada <b>chispa</b> es un electrón
          chocando contra un ion{' '}y entregándole su energía. Mira la red: cuando se calienta, <b>VIBRA</b> —
          esa vibración ES el calor (fonones).
        </p>
      </Panel>
      <Panel title="Sube el voltaje y mira la red ponerse al rojo">
        <Slider label="Voltaje (campo E)" value={voltage} set={setVoltage} min={0.2} max={4} step={0.1}
          fmt={(v) => `${v.toFixed(1)} V`} />
        <div className="mt-2">
          <div className="text-[11px] text-[#a0947e] mb-1">Calor disipado (∝ V², esto ES I²R)</div>
          <div className="h-2.5 rounded-full bg-[#1e2538] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${heat * 100}%`, background: 'linear-gradient(90deg,#d4b050,#ff5a1a)' }} />
          </div>
        </div>
      </Panel>
      <Panel title="La idea clave">
        <p className="text-[12px] text-[#a0947e] leading-relaxed">
          El doble de voltaje no calienta el doble: calienta <b>cuatro veces</b> (P = V²/R = I²R). Por eso
          una resistencia "quema" y un foco incandescente alumbra: la red vibra tan fuerte que brilla.
        </p>
      </Panel>
    </>
  );
}

function CoilPanel({ current, setCurrent }: { current: number; setCurrent: (v: number) => void }) {
  return (
    <>
      <Panel title="Qué estás viendo">
        <p className="text-[13px] text-[#c9bfa8] leading-relaxed">
          Los puntos ámbar corriendo por el cobre son la <b>corriente</b>. Ella crea el campo: el <b>brillo de
          cada línea es |B| real</b> (integrado con Biot-Savart) — feroz y recto adentro, tenue y en lazos
          afuera. El flujo azul te dice la <b>dirección</b>.
        </p>
      </Panel>
      <Panel title="Sube la corriente y enciende el campo">
        <Slider label="Corriente" value={current} set={setCurrent} min={0.2} max={5} step={0.1}
          fmt={(v) => `${v.toFixed(1)} A`} />
        <p className="text-[11px] text-[#a0947e] mt-2 leading-relaxed">
          Más corriente = más campo y más energía guardada (½L·i²). Así funciona un electroimán, un motor,
          y la bobina del boost que funde metal en La Forja.
        </p>
      </Panel>
      <Panel title="La idea clave">
        <p className="text-[12px] text-[#a0947e] leading-relaxed">
          Mover carga <b>crea</b> magnetismo. Cambiar ese campo <b>crea</b> voltaje (Faraday). Ese ida y
          vuelta es todo el electromagnetismo: motores, transformadores, antenas.
        </p>
      </Panel>
    </>
  );
}

function LedPanel({ voltage, setVoltage, material, setMaterial }: {
  voltage: number; setVoltage: (v: number) => void; material: number; setMaterial: (i: number) => void;
}) {
  const eg = LED_MATERIALS[material].eg;
  const nm = bandgapToWavelengthNm(eg);
  const on = voltage >= eg;
  return (
    <>
      <Panel title="Qué estás viendo">
        <p className="text-[13px] text-[#c9bfa8] leading-relaxed">
          En la unión, un <b style={{ color: '#5b9bff' }}>electrón</b> cae a un <b style={{ color: '#ff7a4d' }}>hueco</b> y
          suelta exactamente la energía del <b>band gap</b> como un <b>fotón</b> (las estelas que salen
          disparadas). λ = h·c/E_g: el color lo manda el <b>material</b>, no el voltaje. Cuando enciende,
          la luz <b>ilumina el piso</b> — está alumbrando de verdad.
        </p>
      </Panel>
      <Panel title="Elige el material (su gap = su color)">
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {LED_MATERIALS.map((m, i) => (
            <button key={m.name} onClick={() => setMaterial(i)}
              className={`text-[11px] px-2 py-1.5 rounded border text-left ${
                i === material ? 'border-[#d4b050] bg-[#1e2538] text-[#ead080]' : 'border-[#2c2818] bg-[#14160f] text-[#a0947e]'}`}>
              {m.name}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-mono text-[#a0947e]">E_g = {eg.toFixed(1)} eV → λ ≈ {nm.toFixed(0)} nm</div>
        {material === 4 && (
          <p className="text-[10px] text-[#6a5e4e] mt-1.5 leading-relaxed">
            El LED azul valió el Nobel 2014 (Akasaki, Amano, Nakamura): sin gap grande no hay azul, y sin azul no hay blanco.
          </p>
        )}
      </Panel>
      <Panel title="Súbelo sobre el voltaje de encendido">
        <Slider label="Voltaje directo" value={voltage} set={setVoltage} min={0.5} max={3.6} step={0.05}
          fmt={(v) => `${v.toFixed(2)} V`} />
        <div className={`text-[12px] mt-1 font-medium ${on ? 'text-[#4ade80]' : 'text-[#6a5e4e]'}`}>
          {on ? '● Encendido — recombinando y emitiendo luz' : `○ Apagado — necesita ≥ ${eg.toFixed(1)} V (el gap)`}
        </div>
      </Panel>
    </>
  );
}
