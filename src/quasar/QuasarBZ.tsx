/**
 * QuasarBZ — quásar Blandford-Znajek con streamlines PRECOMPUTADAS.
 *
 * Carga /precomputed/quasar-bz-jet.bin (generado por scripts/quasar/precompute-bz-jet.cjs):
 *   256 streamlines × 192 puntos cada una, sobre BH Kerr a*=0.95, 6×10⁹ M☉.
 *   Cada punto trae [x, y, z, B, γ, n, j_synchrotron].
 *
 * Renderiza:
 *   • Líneas como Three.LineSegments (más barato que Tubes para 49k puntos)
 *   • Color por sincrotrón × Doppler-boost dependiente del ángulo de visión
 *   • Counter-jet (mirror z→-z) Doppler-DIMMED automáticamente — los
 *     observadores reales ven el jet acercándose mucho más brillante que el
 *     que se aleja (factor δ^(2+α) ≈ 100-10000×)
 *   • Disco de acreción usando BHRaytraced (geodésicas Schwarzschild reales)
 *   • Bloom + tonemap para que el jet se vea volumétrico
 *
 * El cálculo es 100% física real: McKinney-Narayan 2007 jet geometry, BZ
 * monopole field, Vlahakis-Königl Lorentz acceleration, Rybicki-Lightman
 * synchrotron emissivity, Lind-Blandford Doppler factor.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';

interface BZData {
  N_LINES: number;
  N_POINTS: number;
  positions: Float32Array;   // (N_LINES × N_POINTS) × 3
  brightness: Float32Array;  // (N_LINES × N_POINTS)  · j_sync normalizado
  gamma: Float32Array;       // (N_LINES × N_POINTS)
  indices: Uint32Array;      // line segments
}

async function loadBZData(): Promise<BZData> {
  const res = await fetch('/precomputed/quasar-bz-jet.bin');
  if (!res.ok) throw new Error(`failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  const N_LINES  = dv.getUint32(0, true);
  const N_POINTS = dv.getUint32(4, true);
  const dataView = new Float32Array(buf, 8);

  const total = N_LINES * N_POINTS;
  const positions  = new Float32Array(total * 3);
  const brightness = new Float32Array(total);
  const gamma      = new Float32Array(total);

  // Escala: el binario está en unidades de r_g (gravitational radius).
  // Reescalamos para que el jet visible quepa ~30 unidades de mundo.
  const SCALE = 0.0008;  // r_g → world units

  let jMax = 0;
  for (let i = 0; i < total; i++) {
    const stride = 8;  // x,y,z,B,γ,n,j,pad
    jMax = Math.max(jMax, dataView[i * stride + 6]);
  }

  for (let i = 0; i < total; i++) {
    const stride = 8;
    positions[i*3+0] = dataView[i*stride+0] * SCALE;
    positions[i*3+1] = dataView[i*stride+2] * SCALE;   // z → Y mundo
    positions[i*3+2] = dataView[i*stride+1] * SCALE;
    brightness[i] = dataView[i*stride+6] / jMax;
    gamma[i]      = dataView[i*stride+4];
  }

  // Build line segment indices: cada streamline → N_POINTS-1 segmentos
  const segCount = N_LINES * (N_POINTS - 1);
  const indices = new Uint32Array(segCount * 2);
  for (let line = 0; line < N_LINES; line++) {
    for (let pt = 0; pt < N_POINTS - 1; pt++) {
      const i = line * (N_POINTS - 1) + pt;
      indices[i*2+0] = line * N_POINTS + pt;
      indices[i*2+1] = line * N_POINTS + pt + 1;
    }
  }

  return { N_LINES, N_POINTS, positions, brightness, gamma, indices };
}

function JetMesh({ data, mirror = false }: { data: BZData; mirror?: boolean }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const groupRef = useRef<THREE.Group>(null);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position',   new THREE.BufferAttribute(data.positions,  3));
    g.setAttribute('brightness', new THREE.BufferAttribute(data.brightness, 1));
    g.setAttribute('gamma',      new THREE.BufferAttribute(data.gamma,      1));
    g.setIndex(new THREE.BufferAttribute(data.indices, 1));
    return g;
  }, [data]);

  useFrame(({ camera }) => {
    if (!matRef.current) return;
    // Pasa la dirección de observación al shader para Doppler-boost.
    // Las partículas se mueven en +Y mundo (jet axis); mirror → -Y.
    const viewDir = new THREE.Vector3();
    camera.getWorldDirection(viewDir).negate();   // de cámara a escena: dirección "hacia"
    matRef.current.uniforms.uObserverDir.value.copy(viewDir);
  });

  return (
    <group ref={groupRef} scale={mirror ? [1, -1, 1] : [1, 1, 1]}>
      <lineSegments geometry={geom}>
        <shaderMaterial
          ref={matRef}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          uniforms={{
            uObserverDir: { value: new THREE.Vector3(0, 0, 1) },
            uAlphaSpec:   { value: 0.7 },     // spectral index AGN
            uMirror:      { value: mirror ? 1.0 : 0.0 },
            uBoost:       { value: 1.0 },
          }}
          vertexShader={`
            attribute float brightness;
            attribute float gamma;
            varying float vBrightness;
            varying float vGamma;
            varying float vDoppler;
            uniform vec3 uObserverDir;
            uniform float uAlphaSpec;
            uniform float uMirror;
            void main() {
              vBrightness = brightness;
              vGamma = gamma;

              // Velocidad del fluido jet: dirección Y mundo (mirror → -Y).
              vec3 vJet = vec3(0.0, uMirror > 0.5 ? -1.0 : 1.0, 0.0);
              // β del flujo: β = √(1 − 1/γ²)
              float beta = sqrt(max(0.0, 1.0 - 1.0/(gamma*gamma)));
              // cosθ_obs = v̂·n̂  (n̂ = uObserverDir apuntando HACIA observador)
              float cosTheta = dot(vJet, normalize(uObserverDir));
              // Factor Doppler δ = 1/[γ·(1 − β·cosθ)]
              float delta = 1.0 / (gamma * (1.0 - beta * cosTheta) + 1e-6);
              // Brightness boosted as δ^(2+α) (Lind-Blandford)
              vDoppler = pow(max(delta, 0.001), 2.0 + uAlphaSpec);

              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying float vBrightness;
            varying float vGamma;
            varying float vDoppler;
            uniform float uBoost;
            void main() {
              float intensity = vBrightness * vDoppler * uBoost;

              // Color por γ (proxy de spectral hardening): bajo γ rojo, alto γ azul-blanco
              vec3 hot  = vec3(0.55, 0.78, 1.00);   // blue: γ alto
              vec3 mid  = vec3(1.00, 0.95, 0.80);   // white: γ medio
              vec3 cool = vec3(1.00, 0.45, 0.25);   // orange-red: γ bajo (lejos)
              float gn  = clamp((vGamma - 4.0) / 10.0, 0.0, 1.0);
              vec3 col  = mix(mix(cool, mid, gn*2.0), hot, max(0.0, gn-0.5)*2.0);

              // Saturación con intensidad
              float visI = clamp(pow(intensity, 0.35) * 1.4, 0.0, 1.0);
              vec3 final = col * visI;
              gl_FragColor = vec4(final, visI * 0.95);
            }
          `}
        />
      </lineSegments>
    </group>
  );
}

function Scene() {
  const [data, setData] = useState<BZData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    loadBZData().then(setData).catch(e => setErr(String(e)));
  }, []);

  if (err) return null;
  if (!data) return null;

  return (
    <>
      {/* Disco + horizonte central via raytracer Schwarzschild */}
      <BHRaytraced
        rs={0.04}
        rIn={2.5}
        rOut={6.0}
        inclinationDeg={70}
        diskOpacity={1.0}
        dopplerStrength={1.0}
        starDensity={1.3}
        starSeed={2.8}
        diskTint="#FFE0A0"
        photonRing
      />
      {/* Jet principal (up) */}
      <JetMesh data={data} />
      {/* Counter-jet (mirror) — observado mucho más débil por Doppler-dim */}
      <JetMesh data={data} mirror />
    </>
  );
}

const gl = makeRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });

function QuasarBZ() {
  return (
    <div className="w-full h-full relative" style={{ background: '#000' }}>
      <Canvas
        camera={{ position: [40, 12, 40], fov: 38, near: 0.001, far: 500 }}
        gl={gl}
        dpr={[0.55, 1]}
      >
        <Scene />
        <OrbitControls
          enablePan={false}
          enableZoom
          autoRotate
          autoRotateSpeed={0.12}
          minDistance={8}
          maxDistance={200}
        />
        <EffectComposer>
          <Bloom intensity={1.5} luminanceThreshold={0.15} luminanceSmoothing={0.6} radius={0.85} />
        </EffectComposer>
      </Canvas>

      <div className="absolute top-6 left-6 text-[11px] font-mono text-[#94A3B8] space-y-1 max-w-md">
        <div className="text-[#FFE5A0] font-semibold">Quasar BZ · precomputed streamlines</div>
        <div>BH: 6×10⁹ M☉ · a* = 0.95 · r₊ = 1.31 M</div>
        <div>256 field lines × 192 puntos · γ_∞ ≈ 14.2</div>
        <div className="text-[#475569] text-[10px] mt-2">
          field: McKinney–Narayan 2007 (z ∝ R^1.6)<br/>
          acceleration: Vlahakis–Königl 2003<br/>
          synchrotron: Rybicki–Lightman §6.2<br/>
          Doppler boost: Lind–Blandford 1985 (δ^(2+α), α=0.7)
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[10px] font-mono text-[#475569]">
        precomputed offline · loaded as Float32 binary · GPU renders ~50k samples/frame
      </div>
    </div>
  );
}

export default memo(QuasarBZ);
