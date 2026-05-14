/**
 * ComptonKickScene — la dispersión Compton, 1923.
 *
 *   Rayo X energético entra desde la izquierda con momento p = h/λ.
 *   Choca con electrón en reposo. Rebota a ángulo θ con MENOR energía
 *   (longitud de onda mayor). El electrón recula con el momento perdido.
 *
 *   La fórmula: Δλ = (h / mc) · (1 − cos θ).
 *
 *   Vectores de momento visibles + paralelogramo de conservación.
 *   El fotón no solo tiene energía. Tiene momento. Cuántica completa.
 *
 *   Fase: '11-compton'
 */

import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Props { phase?: string }

const COMPTON_WAVELENGTH = 2.426e-12;   // h/(m_e c) en metros

interface CollisionState {
  t: number;          // 0..1 dentro del ciclo
  thetaDeg: number;   // ángulo de dispersión actual
  lambdaIn: number;   // longitud de onda inicial (Å)
}

function PhotonAxis({
  state,
}: { state: React.MutableRefObject<CollisionState> }) {
  // El fotón viaja de (-5, 0, 0) a (0, 0, 0), después sale en ángulo θ
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const s = state.current;
    const t = s.t;
    const thetaRad = s.thetaDeg * Math.PI / 180;
    let pos: THREE.Vector3;
    let color: string;
    if (t < 0.5) {
      // entra de izq a centro
      const u = t / 0.5;
      pos = new THREE.Vector3(-5 + u * 5, 0, 0);
      color = '#A78BFA';  // X-ray (violeta)
    } else {
      // sale dispersado con λ mayor (más rojo)
      const u = (t - 0.5) / 0.5;
      pos = new THREE.Vector3(
        0 + u * 5 * Math.cos(thetaRad),
        0 + u * 5 * Math.sin(thetaRad),
        0,
      );
      color = '#FACC15';  // shifted (amarillo / IR-ish)
    }
    meshRef.current.position.copy(pos);
    if (matRef.current) {
      matRef.current.color.set(color);
      matRef.current.emissive.set(color);
    }
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.18, 20, 20]} />
      <meshStandardMaterial
        ref={matRef as any}
        color="#A78BFA"
        emissive="#A78BFA"
        emissiveIntensity={3}
        toneMapped={false}
      />
    </mesh>
  );
}

function RecoilingElectron({
  state,
}: { state: React.MutableRefObject<CollisionState> }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!meshRef.current) return;
    const s = state.current;
    const t = s.t;
    const thetaRad = s.thetaDeg * Math.PI / 180;
    // dirección del electrón: opuesta a la del fotón saliente, pero conservando
    // el momento longitudinal. Ángulo phi del electrón cumple:
    //   tan(phi) = sin(θ) / (lambda_out/lambda_in - cos(θ))  (approx clásico)
    // Para visualización suficiente: phi = -θ/2 a -45° en magnitud.
    const phi = -Math.min(0.9, thetaRad / 1.7);
    let pos: THREE.Vector3;
    if (t < 0.5) {
      pos = new THREE.Vector3(0, 0, 0);   // en reposo
    } else {
      const u = (t - 0.5) / 0.5;
      pos = new THREE.Vector3(u * 4 * Math.cos(phi), u * 4 * Math.sin(phi), 0);
    }
    meshRef.current.position.copy(pos);
  });
  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.22, 20, 20]} />
      <meshStandardMaterial color="#22D3EE" emissive="#22D3EE" emissiveIntensity={2.4} toneMapped={false} />
    </mesh>
  );
}

// Vector arrow as line + cone tip
function MomentumArrow({
  fromRef, toRef, color, label,
}: {
  fromRef: React.MutableRefObject<THREE.Vector3>;
  toRef: React.MutableRefObject<THREE.Vector3>;
  color: string;
  label?: string;
}) {
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const positions = useMemo(() => new Float32Array(6), []);
  const tipRef = useRef<THREE.Mesh>(null);
  const labelRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!geomRef.current || !tipRef.current || !labelRef.current) return;
    const a = fromRef.current;
    const b = toRef.current;
    positions[0] = a.x; positions[1] = a.y; positions[2] = a.z;
    positions[3] = b.x; positions[4] = b.y; positions[5] = b.z;
    const attr = geomRef.current.attributes.position as THREE.BufferAttribute;
    attr.needsUpdate = true;
    // tip
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    tipRef.current.position.copy(b);
    tipRef.current.lookAt(b.clone().add(dir));
    tipRef.current.rotateX(Math.PI / 2);
    labelRef.current.position.copy(b.clone().add(dir.multiplyScalar(0.3)));
  });

  return (
    <group>
      <line>
        <bufferGeometry ref={geomRef}>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={positions}
            itemSize={3}
            args={[positions, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={2.5} transparent opacity={0.95} />
      </line>
      <mesh ref={tipRef}>
        <coneGeometry args={[0.08, 0.18, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {label && (
        <group ref={labelRef}>
          <Text fontSize={0.16} color={color} anchorX="center" anchorY="middle" material-toneMapped={false}>
            {label}
          </Text>
        </group>
      )}
    </group>
  );
}

function MomentumVectors({ state }: { state: React.MutableRefObject<CollisionState> }) {
  // p_in: de (-2, 0, 0) a (-0.4, 0, 0)
  // p_out_photon: del origen a magnitud reducida en dirección θ
  // p_out_electron: del origen en dirección phi
  const pInFrom = useRef(new THREE.Vector3(-2.2, -1.3, 0));
  const pInTo   = useRef(new THREE.Vector3(-0.5, -1.3, 0));
  const pOutPFrom = useRef(new THREE.Vector3(0.3, -1.3, 0));
  const pOutPTo   = useRef(new THREE.Vector3(1.5, -0.6, 0));
  const pOutEFrom = useRef(new THREE.Vector3(0.3, -1.3, 0));
  const pOutETo   = useRef(new THREE.Vector3(1.5, -2.0, 0));

  useFrame(() => {
    const s = state.current;
    const thetaRad = s.thetaDeg * Math.PI / 180;
    const magOut = 0.75;  // |p_out_photon| < |p_in| (perdió energía)
    pOutPTo.current.set(
      0.3 + magOut * Math.cos(thetaRad),
      -1.3 + magOut * Math.sin(thetaRad),
      0,
    );
    const phi = -Math.min(0.9, thetaRad / 1.7);
    const magE = Math.sqrt(1 - magOut * magOut + 2 * (1 - magOut * Math.cos(thetaRad))) * 0.7;
    pOutETo.current.set(
      0.3 + magE * Math.cos(phi),
      -1.3 + magE * Math.sin(phi),
      0,
    );
  });

  return (
    <group>
      <MomentumArrow fromRef={pInFrom} toRef={pInTo} color="#A78BFA" label="p_γ (in)" />
      <MomentumArrow fromRef={pOutPFrom} toRef={pOutPTo} color="#FACC15" label="p_γ' (out)" />
      <MomentumArrow fromRef={pOutEFrom} toRef={pOutETo} color="#22D3EE" label="p_e (recoil)" />
    </group>
  );
}

function Scene({ state }: { state: React.MutableRefObject<CollisionState> }) {
  return (
    <>
      <ambientLight intensity={0.55} />
      <pointLight position={[3, 4, 3]} intensity={0.8} color="#A78BFA" />
      <pointLight position={[-3, 4, 3]} intensity={0.5} color="#22D3EE" />
      <PhotonAxis state={state} />
      <RecoilingElectron state={state} />
      <MomentumVectors state={state} />
      {/* origen / target */}
      <mesh position={[0, 0, 0]}>
        <torusGeometry args={[0.18, 0.015, 8, 32]} />
        <meshBasicMaterial color="#94A3B8" />
      </mesh>
    </>
  );
}

export default function ComptonKickScene({ phase: _phase = '11-compton' }: Props) {
  const state = useRef<CollisionState>({ t: 0, thetaDeg: 90, lambdaIn: 0.071 });
  const thetaHudRef = useRef<HTMLSpanElement>(null);
  const dLambdaHudRef = useRef<HTMLSpanElement>(null);
  const lambdaOutHudRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      // ciclo de 3s. ángulo θ: sweep 30° → 150° en ciclos
      const cycleLen = 3.0;
      const cyclePos = (t % cycleLen) / cycleLen;
      state.current.t = cyclePos;
      // cuando cyclePos pasa a 0 (nuevo ciclo), elegimos un θ aleatorio determinístico
      const cycleIdx = Math.floor(t / cycleLen);
      const thetaDegList = [30, 60, 90, 120, 150];
      state.current.thetaDeg = thetaDegList[cycleIdx % thetaDegList.length];
      // calcular Δλ = (h/mc)(1 - cos θ) [en Å]
      const thetaRad = state.current.thetaDeg * Math.PI / 180;
      const dLambdaM = COMPTON_WAVELENGTH * (1 - Math.cos(thetaRad));
      const dLambdaA = dLambdaM * 1e10;        // metros → Å
      const lambdaInA = state.current.lambdaIn;
      const lambdaOutA = lambdaInA + dLambdaA;
      if (thetaHudRef.current) thetaHudRef.current.textContent = `${state.current.thetaDeg}°`;
      if (dLambdaHudRef.current) dLambdaHudRef.current.textContent = `${dLambdaA.toFixed(4)} Å`;
      if (lambdaOutHudRef.current) lambdaOutHudRef.current.textContent = `${lambdaOutA.toFixed(4)} Å`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at center, #0E1A2E 0%, #03050A 80%)' }}
    >
      <Canvas camera={{ position: [0, 0.3, 6.5], fov: 42 }}>
        <Scene state={state} />
        <OrbitControls enableDamping enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0, 0]} />
      </Canvas>

      <div className="absolute top-6 left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="text-[10px] font-mono text-[#A78BFA] tracking-[0.3em] uppercase">
          Compton, 1923 · el fotón TIENE momento
        </div>
        <div className="text-[10px] font-mono text-[#64748B] mt-1">
          rayo X choca con electrón libre · billar cuántico
        </div>
      </div>

      <div className="absolute bottom-6 left-6 pointer-events-none">
        <div className="px-5 py-3 rounded-md border border-[#A78BFA]/30 bg-black/55 backdrop-blur-sm space-y-1.5">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#A78BFA]">
            Δλ = (h / m_e c)(1 − cos θ)
          </div>
          <div className="text-[12px] font-mono text-white">
            θ = <span ref={thetaHudRef} className="text-[#FACC15] font-bold">90°</span>
          </div>
          <div className="text-[12px] font-mono text-white">
            λ_in = 0.0710 Å (Mo Kα)
          </div>
          <div className="text-[12px] font-mono text-white">
            Δλ = <span ref={dLambdaHudRef} className="text-[#22D3EE]">0.0243 Å</span>
          </div>
          <div className="text-[12px] font-mono text-white pt-1 border-t border-[#1E293B]">
            λ_out = <span ref={lambdaOutHudRef} className="text-[#FACC15] font-bold">0.0953 Å</span>
          </div>
          <div className="text-[10px] font-mono text-[#64748B] pt-1">
            h/(m_e c) = 2.426 × 10⁻¹² m
          </div>
        </div>
      </div>
    </div>
  );
}
