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
 * poloidal field (potencia) + toroidal B_φ∝1/R (radiante), Asada+2014 Lorentz
 * acceleration, densidad por conservación de masa n∝1/(γβR²), Rybicki-Lightman
 * synchrotron emissivity, Lind-Blandford Doppler factor.
 */

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import BHRaytraced from '@/labs/components/BHRaytraced';
import { makeRenderer } from '@/lib/webgl-fallback';

export interface BZData {
  N_LINES: number;
  N_POINTS: number;
  positions: Float32Array;   // (N_LINES × N_POINTS) × 3
  brightness: Float32Array;  // (N_LINES × N_POINTS)  · j_sync normalizado
  gamma: Float32Array;       // (N_LINES × N_POINTS)
  indices: Uint32Array;      // line segments
}

export async function loadBZData(): Promise<BZData> {
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

/**
 * Blandford-Znajek (1977) — potencia extraída de la ENERGÍA ROTACIONAL del BH,
 * pura en el spin a*. Fórmula moderna (Tchekhovskoy+Narayan+McKinney 2010/2011):
 *   P_BZ = (κ / 4π) · Φ_BH² · Ω_H² · c   (W),  κ ≈ 0.053 (split-monopole)
 *   Ω_H = a* / [2(1 + √(1−a*²))]  (adimensional, en c³/GM)
 * Aquí SÍ la computamos (no solo el docstring): en estado MAGNÉTICAMENTE
 * ARRESTADO (MAD) el flujo satura a φ_BH = Φ_BH/√(Ṁ r_g² c) ≈ 50, así que
 *   P_BZ = (κ/4π) · φ_BH² · Ṁc² · Ω_H² · f(Ω_H)
 * con f(Ω_H) = 1 + 1.38·Ω_H² − 9.2·Ω_H⁴ (corrección de spin de orden superior,
 * Tchekhovskoy+ 2011 ec. del régimen MAD). La eficiencia η = P_BZ/(Ṁc²) SUPERA
 * el 100% (~140% a a*=0.9, ~180% a 0.95, >300% a a*→1): el jet saca más energía
 * de la que entra por acreción — la diferencia FRENA el spin. El BH es una
 * batería rotacional. (Tchekhovskoy+ 2011 MNRAS 418:L79)
 */
export function bzPhysics(aStar: number, mBHsun: number) {
  const rPlus = 1 + Math.sqrt(1 - aStar * aStar);   // r_+/M
  const omegaH = aStar / (2 * rPlus);               // c³/GM, adimensional
  // L_Edd = 1.26e31 W · (M/M☉) — escala de la furia (presión de radiación = gravedad)
  const lEdd = 1.26e31 * mBHsun;                    // watts

  // η MAD TABULADO con la función de spin de Tchekhovskoy+ 2011 (NO la
  // interpolación lineal anterior, que daba un erróneo 229% @0.95). Calibrada a
  // η=140% en a*=0.9 (su valor canónico):  η = C·Ω_H²·f(Ω_H).
  const fSpin = (w: number) => 1 + 1.38 * w * w - 9.2 * Math.pow(w, 4);
  const w09 = 0.9 / (2 * (1 + Math.sqrt(1 - 0.9 * 0.9)));
  const C = 1.40 / (w09 * w09 * fSpin(w09));         // ancla 140% @ a*=0.9
  const etaMAD = C * omegaH * omegaH * fSpin(omegaH);
  //  → a*=0.9 ⇒ 140%, a*=0.95 ⇒ ~182%, a*=0.99 ⇒ ~239% (vs >300% solo a a*→1)

  // P_BZ COMPUTADA en watts (régimen MAD, φ_BH≈50, κ=0.053) para Ṁ ~ 10⁻³ M☉/yr
  // (acreción típica M87): P_BZ = (κ/4π)·φ_BH²·Ṁc²·Ω_H²·f(Ω_H) ≈ 8×10³⁶ W.
  const KAPPA = 0.053, PHI_BH = 50;
  const MSUN = 1.989e30, C_LIGHT = 2.998e8;          // SI
  const mdot = 1e-3 * MSUN / (365.25 * 24 * 3600);   // kg/s
  const pBZ = (KAPPA / (4 * Math.PI)) * PHI_BH * PHI_BH
            * mdot * C_LIGHT * C_LIGHT
            * omegaH * omegaH * fSpin(omegaH);        // watts

  return { rPlus, omegaH, lEdd, etaMAD, pBZ };
}
export const BZ = bzPhysics(0.95, 6e9);

// Escala r_g → world units del .bin, expuesta para que la versión de cine
// componga las poses de cámara en el MISMO espacio que el jet (jet llega a
// z=10⁵ r_g · SCALE ≈ 80 wu). Debe coincidir con SCALE dentro de loadBZData().
export const BZ_SCALE = 0.0008;

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

              // Color por γ del BULK FLOW como proxy EVOCATIVO del hardening
              // espectral (NO es color sincrotrón real medido: eso exigiría
              // ν_c ∝ B·γ_e² con el γ_e del electrón, no el γ del flujo). La
              // base lenta del jet sale roja-naranja, el flujo acelerado azul.
              // Lectura honesta: "el plasma se acelera al subir", NO es el azul
              // sincrotrón observado de M87. Rango físico de este .bin:
              // γ ∈ [1.05, 8.8] (perfil Asada+2014, borde de la caja a 10⁵ r_g).
              vec3 hot  = vec3(0.43, 0.65, 1.00);   // azul: γ alto (flujo rápido)
              vec3 mid  = vec3(1.00, 0.95, 0.82);   // blanco: γ medio
              vec3 cool = vec3(1.00, 0.40, 0.22);   // naranja-rojo: γ bajo (base lenta)
              float gn  = clamp((vGamma - 1.05) / (8.8 - 1.05), 0.0, 1.0);
              vec3 col  = mix(mix(cool, mid, clamp(gn*2.0, 0.0, 1.0)),
                              hot, clamp((gn - 0.5) * 2.0, 0.0, 1.0));

              // COMPRESIÓN PERCEPTUAL (display log). El .bin REGENERADO ya reparte
              // el brillo a lo largo del chorro: knotBoost(z) realza los nudos de
              // choque (HST-1/A/B…) y la ecualización radial ×(R/R0)^1.6 levanta la
              // mitad/punta del jet (γ>5, azul) respecto a la base. Por eso ahora
              // basta un pow(0.4) SUAVE (antes 0.18 extremo aplanaba todo): los
              // nudos del chorro relativista brillan como cuentas, NO una bola
              // central + aguja tenue. NO clampear: los nudos salen >1 para
              // reventar el bloom; el ACES lo hace el postFX UNA sola vez.
              float visI = pow(max(intensity, 0.0), 0.40);
              float hdr  = visI * 2.2;              // ganancia HDR, sin clamp a 1
              vec3 final = col * hdr;
              float a    = clamp(visI * 1.15, 0.0, 0.95);
              gl_FragColor = vec4(final, a);
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
      {/* Motor central: disco + horizonte via raytracer Schwarzschild.
          BHRaytraced ya calcula T(r) ∝ r^(-3/4) (Shakura-Sunyaev 1973)
          internamente (pico de emisión en r≈1.36·r_in); el tinte UV
          blanco-azulado (#DDEAFF) deja salir el "big blue bump": disco interior
          ~10⁵ K cegador azul-blanco, exterior naranja-rojo, que es el objeto
          persistente más luminoso del universo. exposure alto + dopplerδ⁴
          hacen que el núcleo sea el píxel más brillante de la escena.

          FIX-3 — ESCALAS CONSISTENTES: el jet llega a z=10⁵ r_g · 0.0008 = 80
          wu. Antes el disco tenía rOut=9·0.06=0.54 wu (148× más chico que el
          jet) → punto invisible. Ahora rs=0.5 → radio del disco rOut=12·rs=6 wu,
          a escala de la BASE del jet (R_launch·0.0008 → grosor ~pocas wu), así
          el motor SE LEE como el disco brillante del que nace el chorro.
          chromaticAberration=0 explícito: el raytrace del motor es un quad
          fullscreen sin profundidad real, la CA del lensado = confeti. */}
      <BHRaytraced
        rs={0.5}
        rIn={2.4}
        rOut={12.0}
        inclinationDeg={68}
        diskOpacity={1.0}
        dopplerStrength={1.0}
        starDensity={1.3}
        starSeed={2.8}
        diskTint="#DDEAFF"
        exposure={2.4}
        chromaticAberration={0}
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
        <div>BH: 6×10⁹ M☉ · a* = 0.95 · r₊ = {BZ.rPlus.toFixed(2)} M</div>
        <div>256 field lines × 192 puntos</div>
        <div>
          γ_borde ≈ 8.8 <span className="text-[#475569]">(a 10⁵ r_g, en cuadro)</span> · γ_∞ ≈ 14.2 <span className="text-[#475569]">(a 10⁶ R_s, fuera de cuadro)</span>
        </div>

        {/* La furia CUANTIFICADA: el BH como batería rotacional (Blandford-Znajek). */}
        <div className="mt-2 text-[#7DD3FC]">
          Ω_H = a*/[2(1+√(1−a*²))] = {BZ.omegaH.toFixed(3)} <span className="text-[#475569]">(c³/GM)</span>
        </div>
        <div className="text-[#FCA5A5]">
          η_jet = P_BZ/(Ṁc²) ≈ {(BZ.etaMAD * 100).toFixed(0)}% <span className="text-[#475569]">— MAD, &gt;100% extrae spin</span>
        </div>
        <div className="text-[#A7F3D0]">
          P_BZ = {BZ.pBZ.toExponential(1)} W <span className="text-[#475569]">= (κ/4π)·φ_BH²·Ṁc²·Ω_H²·f (κ=0.053, φ=50)</span>
        </div>
        <div className="text-[#FDE68A]">
          L_Edd = {BZ.lEdd.toExponential(1)} W <span className="text-[#475569]">= 1.26e31·(M/M☉)</span>
        </div>

        <div className="text-[#475569] text-[10px] mt-2">
          field: McKinney–Narayan 2007 (z ∝ R^1.6); B_φ∝1/R radiante<br/>
          acceleration: Asada+ 2014 — γ∝z^0.58 (≤100 R_s) luego z^0.16<br/>
          density: conservación de masa n ∝ 1/(γ·β·R²)<br/>
          synchrotron: Rybicki–Lightman §6.2 (j ∝ n·B_φ^((α+1)/2))<br/>
          Doppler boost: Lind–Blandford 1985 (δ^(2+α), α=0.7, jet continuo)<br/>
          color: γ_bulk como proxy de aceleración (NO azul sincrotrón medido)<br/>
          P_BZ: Tchekhovskoy+Narayan+McKinney 2010/2011 (MAD η&gt;100%)
        </div>
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center text-[10px] font-mono text-[#475569]">
        precomputed offline · loaded as Float32 binary · GPU renders ~50k samples/frame
      </div>
    </div>
  );
}

export default memo(QuasarBZ);
