/**
 * ParticleSandbox — MD con muchas partículas, visualización en tiempo real.
 *
 * Corre el integrador Velocity Verlet + LJ + termostato Berendsen en cada
 * frame. Renderiza con InstancedMesh (económico, 1000+ partículas a 60fps).
 * Temperatura es literal: velocidad cuadrática media. Densidad es literal:
 * N / V. Presión emerge de colisiones.
 *
 * Los estudiantes SIENTEN qué es "caliente" cuando ven las partículas
 * frenéticas, y qué es "frío" cuando se agregan formando clusters.
 */

import { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  createState, stepVerlet, berendsenThermostat,
  instantaneousTemperature, countByType, applyReactions,
  TYPE_PRESETS, type MdState, type ParticleType, type ReactionRule,
} from '@/lib/chem/quantum/md';

interface ParticleSandboxProps {
  height?: number;
  /** Config inicial */
  initialCounts: Map<ParticleType, number>;
  boxSize: number;
  targetT: number;
  /** Reglas de reacción (opcional) */
  reactionRules?: ReactionRule[];
  /** Paso temporal */
  dt?: number;
  /** Pasos de MD por frame de render */
  stepsPerFrame?: number;
  /** Control externo: se puede pausar */
  playing: boolean;
  /** Callback con estado instantáneo */
  onStats?: (stats: { T: number; counts: Record<string, number>; step: number; time: number }) => void;
}

function ParticleMesh({ stateRef, typeInstances }: {
  stateRef: React.MutableRefObject<MdState>;
  typeInstances: Record<number, { mesh: { current: THREE.InstancedMesh | null }; maxCount: number }>;
}) {
  const tempObj = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const state = stateRef.current;
    if (!state) return;

    // Por tipo, contar y colocar instancias visibles
    const typeIndexCounter: Record<number, number> = {};
    for (const tIdx in typeInstances) typeIndexCounter[tIdx] = 0;

    const halfBox = state.boxSize / 2;

    for (let i = 0; i < state.N; i++) {
      const tIdx = state.typeIdx[i];
      const inst = typeInstances[tIdx];
      if (!inst?.mesh.current) continue;
      const instIdx = typeIndexCounter[tIdx] ?? 0;
      if (instIdx >= inst.maxCount) {
        typeIndexCounter[tIdx] = instIdx + 1;
        continue;
      }
      tempObj.position.set(
        state.positions[i * 3 + 0] - halfBox,
        state.positions[i * 3 + 1] - halfBox,
        state.positions[i * 3 + 2] - halfBox,
      );
      const sigma = state.types[tIdx].sigma;
      tempObj.scale.setScalar(sigma * 0.5);
      tempObj.updateMatrix();
      inst.mesh.current.setMatrixAt(instIdx, tempObj.matrix);
      typeIndexCounter[tIdx] = instIdx + 1;
    }

    // Ocultar instancias sobrantes (poniéndolas fuera de vista)
    const offMatrix = new THREE.Matrix4().makeTranslation(1e6, 0, 0);
    for (const tIdx in typeInstances) {
      const inst = typeInstances[tIdx];
      if (!inst.mesh.current) continue;
      const used = typeIndexCounter[tIdx] ?? 0;
      for (let k = used; k < inst.maxCount; k++) {
        inst.mesh.current.setMatrixAt(k, offMatrix);
      }
      inst.mesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      {Object.entries(typeInstances).map(([tIdx, inst]) => {
        const type = stateRef.current.types[Number(tIdx)];
        return (
          <instancedMesh
            key={tIdx}
            ref={(m) => { inst.mesh.current = m; }}
            args={[undefined, undefined, inst.maxCount]}
          >
            <sphereGeometry args={[1, 16, 16]} />
            <meshStandardMaterial
              color={type.color}
              roughness={0.4}
              metalness={0.1}
              emissive={type.color}
              emissiveIntensity={0.15}
            />
          </instancedMesh>
        );
      })}
    </>
  );
}

function BoxOutline({ size }: { size: number }) {
  const half = size / 2;
  return (
    <lineSegments>
      <edgesGeometry args={[new THREE.BoxGeometry(size, size, size)]} />
      <lineBasicMaterial color="#334155" transparent opacity={0.6} />
    </lineSegments>
  );
}

function Simulator({
  stateRef,
  dt,
  targetT,
  stepsPerFrame,
  rules,
  playing,
  onStats,
}: {
  stateRef: React.MutableRefObject<MdState>;
  dt: number;
  targetT: number;
  stepsPerFrame: number;
  rules?: ReactionRule[];
  playing: boolean;
  onStats?: ParticleSandboxProps['onStats'];
}) {
  const stepCount = useRef(0);
  const tickCount = useRef(0);

  useFrame(() => {
    if (!playing) return;
    const state = stateRef.current;
    for (let s = 0; s < stepsPerFrame; s++) {
      stepVerlet(state, dt);
      // Termostato cada paso (suave)
      berendsenThermostat(state, targetT, dt, 0.5);
    }
    stepCount.current += stepsPerFrame;
    // Reacciones cada pocos pasos (caro por N²)
    if (rules && rules.length && stepCount.current % (5 * stepsPerFrame) === 0) {
      applyReactions(state, rules);
    }
    tickCount.current++;
    // Stats cada ~4 frames para no saturar re-renders
    if (tickCount.current % 4 === 0 && onStats) {
      onStats({
        T: instantaneousTemperature(state),
        counts: countByType(state),
        step: stepCount.current,
        time: state.time,
      });
    }
  });

  return null;
}

export default function ParticleSandbox({
  height = 460,
  initialCounts,
  boxSize,
  targetT,
  reactionRules,
  dt = 0.005,
  stepsPerFrame = 4,
  playing,
  onStats,
}: ParticleSandboxProps) {
  const [resetKey, setResetKey] = useState(0);

  const stateRef = useRef<MdState>(
    createState(initialCounts, boxSize, targetT, 42),
  );

  // Re-crear state al cambiar condiciones iniciales
  useEffect(() => {
    stateRef.current = createState(initialCounts, boxSize, targetT, Date.now());
    setResetKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(Array.from(initialCounts.entries()).map(([t, c]) => [t.name, c])), boxSize]);

  // Prepara instancedMesh refs por tipo (máximo = suma N o uno específico)
  const typeInstances = useMemo(() => {
    const out: Record<number, { mesh: { current: THREE.InstancedMesh | null }; maxCount: number }> = {};
    for (let i = 0; i < stateRef.current.types.length; i++) {
      out[i] = { mesh: { current: null }, maxCount: stateRef.current.N };
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, reactionRules]);

  return (
    <div
      style={{ height }}
      className="w-full rounded-xl overflow-hidden bg-[radial-gradient(ellipse_at_center,_#0f1117_0%,_#05060a_100%)]"
    >
      <Canvas
        camera={{ position: [boxSize * 1.2, boxSize * 0.8, boxSize * 1.2], fov: 45 }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.25} />
        <directionalLight position={[boxSize, boxSize, boxSize]} intensity={0.8} />
        <BoxOutline size={boxSize} />
        <ParticleMesh stateRef={stateRef} typeInstances={typeInstances} />
        <Simulator
          stateRef={stateRef}
          dt={dt}
          targetT={targetT}
          stepsPerFrame={stepsPerFrame}
          rules={reactionRules}
          playing={playing}
          onStats={onStats}
        />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={boxSize * 0.5}
          maxDistance={boxSize * 4}
        />
      </Canvas>
    </div>
  );
}

export { TYPE_PRESETS };
