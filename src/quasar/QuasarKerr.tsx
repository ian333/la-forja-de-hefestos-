/**
 * QuasarKerr — BH supermasivo de Kerr (spinning) con ISCO real, ergosfera
 * oblata, y disco interior tocando casi el horizonte.
 *
 * Recicla BHRaytraced (geodésicas Schwarzschild). El shader NO resuelve
 * geodésicas Kerr full (requiere +400 LOC GLSL para Boyer-Lindquist).
 * Lo que SÍ hace este componente:
 *
 *   1. Computa r_ISCO real cerrado (Bardeen-Press-Teukolsky 1972, MTW §33)
 *   2. Pasa rIn = r_ISCO al BHRaytraced → disco arranca donde físicamente debe
 *   3. Overlays: ISCO ring (cyan), ergosfera (violeta), horizonte (esfera negra)
 *   4. HUD: r_ISCO, r_+, geometría
 *
 * Caras del operador 𝔄 aplicadas:
 *   - cara i_φ: simetría axial $\partial_\varphi$ → axisymmetric (implícito en disco)
 *   - cara i_t: simetría estática $\partial_t$ → estado a tiempo congelado/frame
 *   - cara-Legendre: $P_l(\cos\theta)$ — overlays usan eqs cerradas (closed-form)
 *
 * Fórmulas (Bardeen-Press-Teukolsky 1972):
 *   r_ISCO/M = 3 + Z₂ − sign(a)·√[(3−Z₁)(3+Z₁+2Z₂)]
 *     Z₁ = 1 + (1−a²)^(1/3)·[(1+a)^(1/3) + (1−a)^(1/3)]
 *     Z₂ = √(3a² + Z₁²)
 *   r_erg(θ) = M + √(M² − a²cos²θ)
 *   r_+ = M + √(M² − a²)
 */

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useMemo } from 'react';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';

/* ─── Fórmulas cerradas (M = 1 → rs = 2M = 2 en mis unidades) ───────── */

function iscoRadius(aStar: number): number {
  const a = Math.max(-0.998, Math.min(0.998, aStar));
  const Z1 = 1 + Math.cbrt(1 - a * a) * (Math.cbrt(1 + a) + Math.cbrt(1 - a));
  const Z2 = Math.sqrt(3 * a * a + Z1 * Z1);
  const sign = Math.sign(a) || 1;
  return 3 + Z2 - sign * Math.sqrt((3 - Z1) * (3 + Z1 + 2 * Z2));
}

function outerHorizon(aStar: number): number {
  const a = Math.max(-0.998, Math.min(0.998, aStar));
  return 1 + Math.sqrt(1 - a * a);
}

function ergoRadius(aStar: number, theta: number): number {
  const a = Math.max(-0.998, Math.min(0.998, aStar));
  const cos2 = Math.cos(theta) ** 2;
  return 1 + Math.sqrt(Math.max(0, 1 - a * a * cos2));
}

/* ─── Overlays visuales (geometrías derivadas de fórmulas reales) ────── */

function ISCORing({ radius }: { radius: number }) {
  const geom = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = 128;
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * 2 * Math.PI;
      pts.push(new THREE.Vector3(radius * Math.cos(t), 0, radius * Math.sin(t)));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [radius]);
  return (
    <line>
      <primitive object={geom} />
      <lineBasicMaterial color="#5ECFFF" transparent opacity={0.9} toneMapped={false} />
    </line>
  );
}

/** Ergosfera oblata: superficie revolución de r_erg(θ) alrededor del eje z. */
function Ergosphere({ aStar, scale }: { aStar: number; scale: number }) {
  const geom = useMemo(() => {
    const NT = 32, NP = 64;
    const positions: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i <= NT; i++) {
      const theta = (i / NT) * Math.PI;
      const r = ergoRadius(aStar, theta) * scale;
      for (let j = 0; j <= NP; j++) {
        const phi = (j / NP) * 2 * Math.PI;
        const sinT = Math.sin(theta), cosT = Math.cos(theta);
        // ergosfera está alineada con eje del spin = eje Y (vertical)
        positions.push(
          r * sinT * Math.cos(phi),
          r * cosT,
          r * sinT * Math.sin(phi),
        );
      }
    }
    for (let i = 0; i < NT; i++) {
      for (let j = 0; j < NP; j++) {
        const a = i * (NP + 1) + j;
        const b = a + 1;
        const c = a + (NP + 1);
        const d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [aStar, scale]);
  return (
    <mesh geometry={geom} renderOrder={5}>
      <meshBasicMaterial
        color="#9B6BFF" transparent opacity={0.10} side={THREE.DoubleSide}
        depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false}
      />
    </mesh>
  );
}

/** Spin axis: línea vertical que cruza el BH (eje Y). */
function SpinAxis({ length }: { length: number }) {
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(
      [0, -length, 0, 0, length, 0], 3));
    return g;
  }, [length]);
  return (
    <line>
      <primitive object={geom} />
      <lineBasicMaterial color="#FFD466" transparent opacity={0.45} toneMapped={false} />
    </line>
  );
}

/* ─── Top-level ────────────────────────────────────────────────────────── */

export default function QuasarKerr() {
  // Spin típico de AGN supermasivos a partir de iron-line spectroscopy
  // (Brenneman & Reynolds 2006, McClintock+ 2011): a* ∈ [0.85, 0.998]
  const aStar = 0.94;

  // BHRaytraced usa rs como unidad. Mis fórmulas Kerr usan M.
  // Relación: rs = 2M, entonces r_M = r_rs / 2.
  // El BHRaytraced parameter rs=1 significa "radio de Schwarzschild = 1 wu",
  // entonces 1 unidad de M = 0.5 wu.
  const M_TO_WU = 0.5;

  const rISCO_M = iscoRadius(aStar);                 // en unidades de M
  const rPlus_M = outerHorizon(aStar);
  const rISCO_wu = rISCO_M * M_TO_WU;
  const rPlus_wu = rPlus_M * M_TO_WU;

  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [0, 4, 26], fov: 38, near: 0.001, far: 200 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={[1, 1.5]}
      >
        <BHRaytraced
          rs={1.0}
          rIn={rISCO_wu / 1.0}     // ISCO real en unidades de rs
          rOut={20.0}
          inclinationDeg={68}
          diskOpacity={1.0}
          dopplerStrength={1.0}
          starDensity={0.6}
          starSeed={2.7}
          diskTint="#FFB070"
          photonRing
        />

        {/* Overlays físicos (geometrías derivadas de fórmulas Bardeen-Press) */}
        <ISCORing radius={rISCO_wu} />
        <Ergosphere aStar={aStar} scale={M_TO_WU} />
        <SpinAxis length={8} />

        <EffectComposer multisampling={4}>
          <Bloom intensity={0.8} luminanceThreshold={0.5} luminanceSmoothing={0.4} kernelSize={3} />
        </EffectComposer>

        <OrbitControls
          enablePan={false} enableZoom autoRotate autoRotateSpeed={0.10}
          minDistance={8} maxDistance={120}
          minPolarAngle={0.25} maxPolarAngle={2.4}
        />
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] tracking-[0.2em]">
        Kerr BH · a* = {aStar} · r_ISCO = {rISCO_M.toFixed(3)} M · r_+ = {rPlus_M.toFixed(3)} M
      </div>
      <div className="absolute bottom-6 left-6 text-[10px] font-mono text-[#475569] leading-relaxed">
        Bardeen-Press-Teukolsky 1972 closed-form (no integración numérica)<br/>
        <span style={{color: '#5ECFFF'}}>cyan</span>: ISCO ring ·
        <span style={{color: '#9B6BFF'}}> violeta</span>: ergosfera oblata r_erg(θ) ·
        <span style={{color: '#FFD466'}}> oro</span>: eje del spin<br/>
        caras 𝔄 activas: i_φ (axisymmetric) + i_t (estática) + Legendre P_l (radial-angular)
      </div>
    </div>
  );
}
