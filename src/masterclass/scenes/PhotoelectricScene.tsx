/**
 * PhotoelectricScene — el efecto fotoeléctrico, 3D-real.
 *
 *  - Placa metálica con átomos visibles (iones positivos + nube electrónica).
 *  - Fotones incidentes: esferitas que vienen en haz, color por frecuencia.
 *  - Al impactar la placa, el fotón se absorbe y un electrón sale eyectado
 *    con K = h·f − W. La velocidad real escala con sqrt(2K/m).
 *  - Función trabajo W del zinc (4.3 eV) por defecto.
 *
 * Phase-awareness:
 *   - '02-experimento' · default
 *   - '03-clasica'      · onda clásica + nota de predicción
 *   - '04-lenard'       · intensidad 2x (más fotones, misma velocidad)
 *   - '05-frecuencia'   · barrido de frecuencia (color cambia)
 *   - '09-formula'      · HUD con K = hf − W prominente
 *   - '12-sim-intensidad' · barrido de intensidad
 *   - '13-sim-frecuencia' · barrido de frecuencia
 *
 * Unidades: trabajamos en eV y normalizamos las frecuencias para que la
 * pantalla muestre rango visible→UV (1e14 Hz → 1.5e15 Hz). Las constantes
 * son reales — no jugamos con la física, jugamos con la escala visual.
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface PhotoelectricSceneProps {
  phase?: string;
}

// ─── Constantes físicas reales ────────────────────────────────────────────
const PLANCK_H_eVs = 4.136e-15;        // h en eV·s
const WORK_FUNCTION_eV = 4.30;         // zinc (Lenard usó zinc)
const ELECTRON_MASS_eV = 0.511e6;      // mc² del electrón en eV
const C_LIGHT = 2.998e8;               // m/s

// ─── Mapeo escala visual ↔ frecuencia real ────────────────────────────────
// La frecuencia normalizada FREQ ∈ [0, 1] mapea a Hz reales:
//   f_real = 4e14 + FREQ * 1.5e15   (visible→UV profundo)
// Umbral del zinc (4.3 eV): f_0 = W/h ≈ 1.04e15 Hz → FREQ ≈ 0.43
function freqRealFromNormalized(n: number): number {
  return 4e14 + n * 1.5e15;
}
function photonEnergyEV(freqNorm: number): number {
  return PLANCK_H_eVs * freqRealFromNormalized(freqNorm);
}
function kineticMaxEV(freqNorm: number, workEV: number): number {
  return Math.max(0, photonEnergyEV(freqNorm) - workEV);
}
function electronSpeedScale(keEV: number): number {
  // v = c · sqrt(2K/(mc²)). Para K~few eV, v << c, no relativista.
  // Para visualización escalamos a algo razonable en el canvas.
  if (keEV <= 0) return 0;
  const vReal = C_LIGHT * Math.sqrt(2 * keEV / ELECTRON_MASS_eV);
  // vReal ~ 6e5 m/s para 1 eV. Lo mapeamos a "unidades canvas/seg" tipo 2-4.
  return Math.min(5, vReal / 2.5e5);
}

// ─── Color del fotón según frecuencia normalizada ─────────────────────────
function photonColor(freqNorm: number): THREE.Color {
  // 0 = rojo, 0.4 = verde, 0.6 = azul, 1 = violeta/UV
  if (freqNorm < 0.25) return new THREE.Color('#FF3D3D');        // rojo
  if (freqNorm < 0.40) return new THREE.Color('#FB923C');        // naranja
  if (freqNorm < 0.50) return new THREE.Color('#FACC15');        // amarillo
  if (freqNorm < 0.65) return new THREE.Color('#22D3EE');        // azul
  if (freqNorm < 0.80) return new THREE.Color('#A78BFA');        // violeta
  return new THREE.Color('#F472B6');                              // UV (rosa fluo)
}

// ─── Pool de fotones que vuelan al metal ──────────────────────────────────
const N_PHOTONS = 24;
const N_ELECTRONS = 18;

interface PhotonState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  active: boolean;
  freqNorm: number;
}

interface ElectronState {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  active: boolean;
}

// Plate occupies x ∈ [-3, 3], z ∈ [-1.5, 1.5], y = 0 (top face)
const PLATE_Y = 0;
const PLATE_HALF_X = 3;
const PLATE_HALF_Z = 1.5;

function makePhotonPool(): PhotonState[] {
  return Array.from({ length: N_PHOTONS }, () => ({
    pos: new THREE.Vector3(0, 10, 0),
    vel: new THREE.Vector3(0, 0, 0),
    active: false,
    freqNorm: 0.5,
  }));
}
function makeElectronPool(): ElectronState[] {
  return Array.from({ length: N_ELECTRONS }, () => ({
    pos: new THREE.Vector3(0, -10, 0),
    vel: new THREE.Vector3(0, 0, 0),
    age: 0,
    active: false,
  }));
}

function spawnPhoton(p: PhotonState, freqNorm: number) {
  const x0 = (Math.random() - 0.5) * PLATE_HALF_X * 1.4;
  const z0 = (Math.random() - 0.5) * PLATE_HALF_Z * 1.4;
  p.pos.set(x0 - 3, 5, z0);                  // viene desde arriba-izquierda
  p.vel.set(2.5, -3.5, 0);                    // diagonal hacia la placa
  p.active = true;
  p.freqNorm = freqNorm;
}
function spawnElectron(e: ElectronState, atX: number, atZ: number, kineticEV: number) {
  e.pos.set(atX, PLATE_Y + 0.05, atZ);
  const v = electronSpeedScale(kineticEV);
  // dispersión aleatoria hacia arriba (cono)
  const angle = (Math.random() - 0.5) * 0.6;
  const azim = Math.random() * Math.PI * 2;
  e.vel.set(v * Math.sin(angle) * Math.cos(azim), v * Math.cos(angle), v * Math.sin(angle) * Math.sin(azim));
  e.age = 0;
  e.active = true;
}

// ─── Photons (instanced) ──────────────────────────────────────────────────
function Photons({
  poolRef,
  electronsRef,
  freqRef,
  intensityRef,
  workEVRef,
  phaseRef,
}: {
  poolRef: React.MutableRefObject<PhotonState[]>;
  electronsRef: React.MutableRefObject<ElectronState[]>;
  freqRef: React.MutableRefObject<number>;
  intensityRef: React.MutableRefObject<number>;
  workEVRef: React.MutableRefObject<number>;
  phaseRef: React.MutableRefObject<string>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorTmp = useMemo(() => new THREE.Color(), []);
  const spawnAccumRef = useRef(0);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const inst = meshRef.current;
    const pool = poolRef.current;
    const electrons = electronsRef.current;
    const phase = phaseRef.current;
    const isClassicalDemo = phase === '03-clasica';
    if (isClassicalDemo) {
      // ocultar fotones en escena clásica (mostraremos onda en otro lado)
      for (let i = 0; i < pool.length; i++) {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      return;
    }
    // Spawn rate por intensidad (fotones/seg)
    const spawnRate = 12 * intensityRef.current;
    spawnAccumRef.current += dt * spawnRate;
    while (spawnAccumRef.current > 1) {
      spawnAccumRef.current -= 1;
      const slot = pool.findIndex(p => !p.active);
      if (slot >= 0) spawnPhoton(pool[slot], freqRef.current);
    }

    // Advance + colisión con placa
    for (let i = 0; i < pool.length; i++) {
      const p = pool[i];
      if (!p.active) {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        if (inst.instanceColor) inst.setColorAt(i, colorTmp.set('#000'));
        continue;
      }
      p.pos.addScaledVector(p.vel, dt);
      // colisión: y cruza PLATE_Y y está dentro de la placa
      if (p.pos.y <= PLATE_Y + 0.05 && Math.abs(p.pos.x) < PLATE_HALF_X && Math.abs(p.pos.z) < PLATE_HALF_Z) {
        const k = kineticMaxEV(p.freqNorm, workEVRef.current);
        if (k > 0) {
          const slot = electrons.findIndex(e => !e.active);
          if (slot >= 0) spawnElectron(electrons[slot], p.pos.x, p.pos.z, k);
        }
        // absorber siempre, suba o no electrón (la energía se va a calor)
        p.active = false;
        continue;
      }
      // descartar si voló fuera de pantalla
      if (p.pos.y < -2 || p.pos.x > 8) {
        p.active = false;
        continue;
      }
      dummy.position.copy(p.pos);
      dummy.scale.setScalar(0.13);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      if (inst.instanceColor) inst.setColorAt(i, photonColor(p.freqNorm));
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_PHOTONS]} castShadow>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        emissive="#FFFFFF"
        emissiveIntensity={2.5}
        color="#FFFFFF"
        toneMapped={false}
      />
    </instancedMesh>
  );
}

// ─── Electrons ─────────────────────────────────────────────────────────────
function Electrons({
  poolRef,
}: {
  poolRef: React.MutableRefObject<ElectronState[]>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, dt) => {
    if (!meshRef.current) return;
    const inst = meshRef.current;
    const pool = poolRef.current;
    for (let i = 0; i < pool.length; i++) {
      const e = pool[i];
      if (!e.active) {
        dummy.position.set(0, -50, 0);
        dummy.scale.setScalar(0.001);
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
        continue;
      }
      e.pos.addScaledVector(e.vel, dt);
      e.age += dt;
      if (e.pos.y > 8 || e.age > 3) {
        e.active = false;
        continue;
      }
      dummy.position.copy(e.pos);
      dummy.scale.setScalar(0.11);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, N_ELECTRONS]}>
      <sphereGeometry args={[1, 16, 16]} />
      <meshStandardMaterial
        color="#22D3EE"
        emissive="#22D3EE"
        emissiveIntensity={2.8}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

// ─── Onda EM clásica (solo en fase '03-clasica') ──────────────────────────
function ClassicalWave({ visible }: { visible: boolean }) {
  const lineRef = useRef<THREE.Line>(null);
  const positions = useMemo(() => new Float32Array(120 * 3), []);
  const geomRef = useRef<THREE.BufferGeometry>(null);

  useFrame(({ clock }) => {
    if (!geomRef.current || !visible) return;
    const t = clock.elapsedTime * 4;
    for (let i = 0; i < 120; i++) {
      const u = i / 119;
      const x = -3 + u * 4.5;
      const y = 5 - u * 4.5;
      const phase = u * 18 - t;
      const wave = Math.sin(phase) * 0.35;
      positions[i * 3] = x + wave * 0.7;
      positions[i * 3 + 1] = y + wave * 0.7;
      positions[i * 3 + 2] = 0;
    }
    const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
  });

  if (!visible) return null;
  return (
    <line ref={lineRef as any}>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute
          attach="attributes-position"
          count={120}
          array={positions}
          itemSize={3}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#FACC15" linewidth={2} transparent opacity={0.85} />
    </line>
  );
}

// ─── Placa metálica con átomos ────────────────────────────────────────────
function MetalPlate() {
  // Rejilla de átomos visible en la cara superior
  const atomPositions = useMemo(() => {
    const pts: [number, number, number][] = [];
    const stepX = 0.4;
    const stepZ = 0.4;
    for (let x = -PLATE_HALF_X + stepX / 2; x < PLATE_HALF_X; x += stepX) {
      for (let z = -PLATE_HALF_Z + stepZ / 2; z < PLATE_HALF_Z; z += stepZ) {
        pts.push([x, PLATE_Y, z]);
      }
    }
    return pts;
  }, []);

  return (
    <group>
      {/* Placa principal */}
      <mesh position={[0, PLATE_Y - 0.15, 0]} receiveShadow>
        <boxGeometry args={[PLATE_HALF_X * 2, 0.3, PLATE_HALF_Z * 2]} />
        <meshStandardMaterial
          color="#475569"
          metalness={0.85}
          roughness={0.35}
          emissive="#1E293B"
          emissiveIntensity={0.3}
        />
      </mesh>
      {/* Átomos (iones positivos) */}
      {atomPositions.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial
            color="#94A3B8"
            emissive="#94A3B8"
            emissiveIntensity={0.4}
            metalness={0.7}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Escena R3F principal ─────────────────────────────────────────────────
function Scene({
  phaseRef,
  freqRef,
  intensityRef,
  workEVRef,
  classicalVisibleRef,
}: {
  phaseRef: React.MutableRefObject<string>;
  freqRef: React.MutableRefObject<number>;
  intensityRef: React.MutableRefObject<number>;
  workEVRef: React.MutableRefObject<number>;
  classicalVisibleRef: React.MutableRefObject<boolean>;
}) {
  const photonsRef = useRef(makePhotonPool());
  const electronsRef = useRef(makeElectronPool());

  // Animate parameters per-phase
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const phase = phaseRef.current;
    switch (phase) {
      case '03-clasica':
        intensityRef.current = 0;          // ocultar fotones
        classicalVisibleRef.current = true;
        break;
      case '04-lenard':
      case '12-sim-intensidad': {
        // Pulsar intensidad: 1x → 2x → 1x cada 6 s
        classicalVisibleRef.current = false;
        const cycle = (Math.sin(t * 0.7) + 1) / 2;
        intensityRef.current = 1.0 + cycle * 1.0;     // 1.0 → 2.0
        freqRef.current = 0.62;                        // azul, sobre umbral
        break;
      }
      case '05-frecuencia':
      case '13-sim-frecuencia': {
        // Barrido de frecuencia 0.2 → 0.9 → 0.2 cada 8 s
        classicalVisibleRef.current = false;
        const cycle = (Math.sin(t * 0.5) + 1) / 2;
        freqRef.current = 0.2 + cycle * 0.7;
        intensityRef.current = 1.4;
        break;
      }
      case '09-formula':
        classicalVisibleRef.current = false;
        freqRef.current = 0.7;
        intensityRef.current = 1.3;
        break;
      default:
        // '02-experimento' y otros
        classicalVisibleRef.current = false;
        freqRef.current = 0.62;
        intensityRef.current = 1.2;
        break;
    }
    workEVRef.current = WORK_FUNCTION_eV;
  });

  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[6, 10, 6]} intensity={0.9} castShadow />
      <pointLight position={[-4, 3, 2]} intensity={0.6} color="#A78BFA" />

      <MetalPlate />
      <Photons
        poolRef={photonsRef}
        electronsRef={electronsRef}
        freqRef={freqRef}
        intensityRef={intensityRef}
        workEVRef={workEVRef}
        phaseRef={phaseRef}
      />
      <Electrons poolRef={electronsRef} />
      <ClassicalWave visible={classicalVisibleRef.current} />
    </>
  );
}

// ─── Top-level con HUD ─────────────────────────────────────────────────────
export default function PhotoelectricScene({ phase = '02-experimento' }: PhotoelectricSceneProps) {
  const phaseRef = useRef(phase);
  const freqRef = useRef(0.62);
  const intensityRef = useRef(1.2);
  const workEVRef = useRef(WORK_FUNCTION_eV);
  const classicalVisibleRef = useRef(false);

  // HUD live spans
  const hudFreqRef = useRef<HTMLSpanElement>(null);
  const hudEnergyRef = useRef<HTMLSpanElement>(null);
  const hudKineticRef = useRef<HTMLSpanElement>(null);
  const hudIntensityRef = useRef<HTMLSpanElement>(null);

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const captionByPhase: Record<string, string> = {
    '02-experimento': 'placa + luz · ¿salen electrones?',
    '03-clasica':     'predicción clásica: onda EM (no funciona)',
    '04-lenard':      'Lenard 1902 · más intensidad ⇒ más electrones, MISMA velocidad',
    '05-frecuencia':  'sube la frecuencia ⇒ sube K · debajo de f₀ → nada',
    '09-formula':     'K = h·f − W · un fotón, un electrón',
    '12-sim-intensidad': 'sim · intensidad ×2 (cuenta los electrones)',
    '13-sim-frecuencia': 'sim · frecuencia varía (cuenta su velocidad)',
  };
  const caption = captionByPhase[phase] ?? '';

  const showFormulaHud = phase === '09-formula' || phase === '04-lenard' || phase === '05-frecuencia';

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #0A0E1A 0%, #03050A 85%)' }}
    >
      <Canvas
        shadows
        camera={{ position: [4.5, 5.5, 7], fov: 42 }}
        onCreated={() => {
          const update = () => {
            const fNorm = freqRef.current;
            const fHz = freqRealFromNormalized(fNorm);
            const Ephoton = photonEnergyEV(fNorm);
            const K = kineticMaxEV(fNorm, workEVRef.current);
            if (hudFreqRef.current) {
              hudFreqRef.current.textContent =
                `f = ${(fHz / 1e14).toFixed(2)} × 10¹⁴ Hz`;
            }
            if (hudEnergyRef.current) {
              hudEnergyRef.current.textContent =
                `hf = ${Ephoton.toFixed(2)} eV`;
            }
            if (hudKineticRef.current) {
              hudKineticRef.current.textContent =
                K > 0 ? `K = ${K.toFixed(2)} eV` : `K = 0 (debajo umbral)`;
            }
            if (hudIntensityRef.current) {
              hudIntensityRef.current.textContent =
                `I = ${intensityRef.current.toFixed(2)}`;
            }
            requestAnimationFrame(update);
          };
          update();
        }}
      >
        <Scene
          phaseRef={phaseRef}
          freqRef={freqRef}
          intensityRef={intensityRef}
          workEVRef={workEVRef}
          classicalVisibleRef={classicalVisibleRef}
        />
        <OrbitControls
          enableDamping
          enableZoom={false}
          enablePan={false}
          enableRotate={false}
          target={[0, 0.5, 0]}
        />
      </Canvas>

      {/* Caption */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#22D3EE] tracking-[0.3em] uppercase">
          Efecto fotoeléctrico · zinc · W = 4.30 eV
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">{caption}</div>
      </div>

      {/* HUD live: f, hf, K, I */}
      <div className="absolute top-1/2 left-6 -translate-y-1/2 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#22D3EE]/30 bg-black/40 backdrop-blur-sm space-y-1">
          <div className="text-[10px] font-mono text-[#22D3EE] uppercase tracking-[0.2em]">
            En vivo
          </div>
          <div className="text-[14px] font-mono leading-tight text-white">
            <span ref={hudFreqRef}>f = 5.20 × 10¹⁴ Hz</span>
          </div>
          <div className="text-[14px] font-mono leading-tight text-white">
            <span ref={hudEnergyRef}>hf = 2.15 eV</span>
          </div>
          <div className="text-[14px] font-mono leading-tight text-[#FDB813]">
            <span ref={hudKineticRef}>K = 0 (debajo umbral)</span>
          </div>
          <div className="text-[12px] font-mono leading-tight text-[#94A3B8]">
            <span ref={hudIntensityRef}>I = 1.20</span>
          </div>
        </div>
      </div>

      {/* Formula HUD */}
      {showFormulaHud && (
        <div className="absolute top-8 right-8 pointer-events-none">
          <div className="px-5 py-3 rounded-md border border-[#A78BFA]/40 bg-black/45 backdrop-blur-sm">
            <div className="text-[10px] font-mono text-[#A78BFA] uppercase tracking-[0.2em] mb-1">
              Einstein 1905
            </div>
            <div className="text-[24px] font-mono leading-none text-white">
              K = h·f − W
            </div>
            <div className="text-[10px] font-mono text-[#64748B] mt-2">
              un fotón · un electrón · todo o nada
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-6 right-6 pointer-events-none">
        <div className="flex items-center gap-2 text-[10px] font-mono">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#A78BFA]" />
          <span className="text-[#94A3B8]">fotón (color = f)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono mt-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#22D3EE]" />
          <span className="text-[#94A3B8]">electrón (v ∝ √K)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono mt-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-[#475569]" />
          <span className="text-[#94A3B8]">placa de zinc</span>
        </div>
      </div>
    </div>
  );
}
