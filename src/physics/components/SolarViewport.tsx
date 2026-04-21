/**
 * Real N-body viewport. Units inside the store are SI; rendering uses a
 * display scale (DS) chosen by the viewport to keep things visible.
 *
 * - Body radii are NOT to scale — the Sun would be a single pixel at AU
 *   scale. We draw a log-scaled "visual radius" so bodies are selectable.
 * - Trails store `maxTrail` past positions in sim space, re-rendered every
 *   frame.
 */

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import type { SimState, Body } from '@/lib/physics/nbody';
import { stateToElements, sampleOrbitPath } from '@/lib/physics/kepler';
import { getParticleTexture } from '@/labs/components/sprite-texture';

interface Props {
  stateRef: React.MutableRefObject<SimState>;
  displayScale: number;                 // multiply meters by this → scene units
  trailLength: number;                  // max trail points per body
  showLabels: boolean;
  showOrbits: boolean;
  visualRadius: (b: Body, ds: number) => number;
}

export default function SolarViewport({
  stateRef, displayScale, trailLength, showLabels, showOrbits, visualRadius,
}: Props) {
  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [0, 2.5, 4], fov: 50, near: 0.001, far: 10000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.25} />
        <pointLight position={[0, 0, 0]} intensity={3} color="#FDB813" distance={0} decay={0} />
        <Stars radius={100} depth={60} count={2500} factor={2} fade speed={0.3} />
        <OrbitControls enablePan enableZoom enableRotate zoomSpeed={0.7} />
        <SceneContents
          stateRef={stateRef}
          displayScale={displayScale}
          trailLength={trailLength}
          showLabels={showLabels}
          showOrbits={showOrbits}
          visualRadius={visualRadius}
        />
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.85} luminanceThreshold={0.15} luminanceSmoothing={0.4} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function SceneContents({
  stateRef, displayScale, trailLength, showLabels, showOrbits, visualRadius,
}: Props) {
  const { scene } = useThree();
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const haloRef = useRef<Map<string, THREE.Sprite>>(new Map());
  const trailsRef = useRef<Map<string, { pts: THREE.Points; geom: THREE.BufferGeometry; cursor: number; count: number; cap: number }>>(new Map());
  const orbitLinesRef = useRef<Map<string, { line: THREE.Line; centralId: string | null }>>(new Map());
  const particleTex = useMemo(() => getParticleTexture(), []);

  // Build / rebuild meshes whenever the body list changes
  const bodyIds = useMemo(
    () => stateRef.current.bodies.map(b => b.id).join('|'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stateRef.current.bodies.length, stateRef.current.bodies.map(b => b.id).join('|')],
  );

  useEffect(() => {
    const clear = () => {
      for (const m of meshesRef.current.values()) { scene.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
      for (const h of haloRef.current.values()) { scene.remove(h); (h.material as THREE.Material).dispose(); }
      for (const t of trailsRef.current.values()) { scene.remove(t.pts); t.geom.dispose(); (t.pts.material as THREE.Material).dispose(); }
      for (const o of orbitLinesRef.current.values()) { scene.remove(o.line); o.line.geometry.dispose(); (o.line.material as THREE.Material).dispose(); }
      meshesRef.current.clear();
      haloRef.current.clear();
      trailsRef.current.clear();
      orbitLinesRef.current.clear();
    };
    clear();

    // Heuristic central body: most massive in state (stays constant → use at build time only).
    const bodies = stateRef.current.bodies;
    const mostMassive = bodies.reduce<Body | null>((best, cur) => (!best || cur.mass > best.mass ? cur : best), null);

    for (const b of bodies) {
      const r = visualRadius(b, displayScale);
      const geom = new THREE.SphereGeometry(r, 32, 32);
      const isSun = b.id === 'sun' || b.color === '#FDB813';
      const mat = new THREE.MeshStandardMaterial({
        color: b.color,
        emissive: new THREE.Color(b.color),
        emissiveIntensity: isSun ? 0.95 : 1.2,
        roughness: 0.5,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      meshesRef.current.set(b.id, mesh);

      // Sprite halo — bloom pickup even when the body is a few pixels.
      // Kept modest so halos don't dominate the frame in tight-orbit presets.
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: particleTex,
        color: new THREE.Color(b.color),
        transparent: true,
        opacity: isSun ? 0.9 : 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      const haloScale = isSun ? Math.min(0.38, r * 2.2) : Math.min(0.14, Math.max(0.06, r * 2.0));
      halo.scale.set(haloScale, haloScale, haloScale);
      scene.add(halo);
      haloRef.current.set(b.id, halo);

      // Trail as additive point cloud (matches atom/pendulum visual language)
      const cap = trailLength;
      const tgeom = new THREE.BufferGeometry();
      tgeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(cap * 3), 3));
      tgeom.setDrawRange(0, 0);
      const col = new THREE.Color(b.color);
      const tmat = new THREE.PointsMaterial({
        color: col,
        map: particleTex,
        alphaMap: particleTex,
        size: Math.max(r * 1.1, 0.04),
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pts = new THREE.Points(tgeom, tmat);
      scene.add(pts);
      trailsRef.current.set(b.id, { pts, geom: tgeom, cursor: 0, count: 0, cap });

      // Kepler reference ellipse — only for bound orbits around the most-massive body.
      // Equal-mass systems (binary / figure-8) would give a degenerate / chaotic
      // osculating ellipse, so skip when the mass ratio is close to 1.
      const massRatio = mostMassive ? b.mass / mostMassive.mass : 1;
      if (mostMassive && b !== mostMassive && massRatio < 0.5) {
        const rRel: [number, number, number] = [
          b.pos[0] - mostMassive.pos[0], b.pos[1] - mostMassive.pos[1], b.pos[2] - mostMassive.pos[2],
        ];
        const vRel: [number, number, number] = [
          b.vel[0] - mostMassive.vel[0], b.vel[1] - mostMassive.vel[1], b.vel[2] - mostMassive.vel[2],
        ];
        try {
          const el = stateToElements(rRel, vRel, mostMassive.mass);
          const rStart = Math.hypot(rRel[0], rRel[1], rRel[2]);
          // Sanity: reject wildly-elongated ellipses (osculating glitch)
          const apo = el.a * (1 + el.e);
          if (el.e < 0.95 && apo < rStart * 6) {
          const pts3 = sampleOrbitPath(el, 256);
          if (pts3.length > 0) {
            const positions = new Float32Array(pts3.length * 3);
            for (let k = 0; k < pts3.length; k++) {
              positions[k*3+0] = pts3[k][0];
              positions[k*3+1] = pts3[k][1];
              positions[k*3+2] = pts3[k][2];
            }
            const geom = new THREE.BufferGeometry();
            geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            const mat = new THREE.LineBasicMaterial({
              color: new THREE.Color(b.color),
              transparent: true,
              opacity: 0.55,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            });
            const line = new THREE.Line(geom, mat);
            scene.add(line);
            orbitLinesRef.current.set(b.id, { line, centralId: mostMassive.id });
          }
          }
        } catch {
          // ignore — skip reference orbit for this body
        }
      }
    }

    return clear;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, bodyIds, trailLength, displayScale]);

  // Per-frame: push positions into meshes, halos, trails, and keep orbit lines
  // centered on their central body (COM drift, binary wobble, etc).
  useFrame(() => {
    const s = stateRef.current;
    const byId = new Map<string, Body>();
    for (const b of s.bodies) byId.set(b.id, b);

    for (const b of s.bodies) {
      const m = meshesRef.current.get(b.id);
      if (m) m.position.set(b.pos[0] * displayScale, b.pos[1] * displayScale, b.pos[2] * displayScale);
      const halo = haloRef.current.get(b.id);
      if (halo && m) halo.position.copy(m.position);

      const t = trailsRef.current.get(b.id);
      if (!t) continue;
      if (showOrbits) {
        const arr = (t.geom.attributes.position as THREE.BufferAttribute).array as Float32Array;
        const i = t.cursor;
        arr[i*3+0] = b.pos[0] * displayScale;
        arr[i*3+1] = b.pos[1] * displayScale;
        arr[i*3+2] = b.pos[2] * displayScale;
        t.cursor = (i + 1) % t.cap;
        t.count = Math.min(t.count + 1, t.cap);
        (t.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true;
        t.geom.setDrawRange(0, t.count);
        t.pts.visible = true;
      } else {
        t.pts.visible = false;
      }
    }

    for (const [bodyId, o] of orbitLinesRef.current) {
      const central = o.centralId ? byId.get(o.centralId) : null;
      if (!central) { o.line.visible = false; continue; }
      o.line.visible = showOrbits;
      o.line.position.set(central.pos[0] * displayScale, central.pos[1] * displayScale, central.pos[2] * displayScale);
      o.line.scale.setScalar(displayScale);
      // hide own-orbit line for the central body (never populated, defensive)
      if (bodyId === o.centralId) o.line.visible = false;
    }
  });

  return (
    <>
      {showLabels && stateRef.current.bodies.map(b => (
        <BodyLabel key={b.id} body={b} displayScale={displayScale} />
      ))}
    </>
  );
}

function BodyLabel({ body, displayScale }: { body: Body; displayScale: number }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    g.position.set(body.pos[0] * displayScale, body.pos[1] * displayScale, body.pos[2] * displayScale);
  });
  return (
    <group ref={groupRef}>
      <Html style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          color: body.color,
          fontSize: 10,
          fontFamily: 'JetBrains Mono, monospace',
          whiteSpace: 'nowrap',
          transform: 'translate(10px, -8px)',
          textShadow: '0 0 4px #000, 0 0 4px #000',
        }}>
          {body.name}
        </div>
      </Html>
    </group>
  );
}
