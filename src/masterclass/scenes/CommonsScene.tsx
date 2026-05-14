/**
 * CommonsScene — Tragedia de los Comunes (Hardin 1968) + Ostrom (Nobel 2009).
 *
 * Simulación agente-basada real con visuales cinemáticos:
 *   • Grid 32×32 de tiles de pasto + 3072 blades animadas con viento.
 *   • Animales con cuerpo + cabeza, rotación por velocidad, bobbing.
 *   • Particles cuando comen pasto. Marcadores de muerte.
 *   • Cielo gradiente con sol que se mueve. Niebla atmosférica.
 *   • Cámara que orbita y respira.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

const GRID = 32;
const GRID_HALF = GRID / 2;
const TILE = 0.6;
const FIELD_HALF = GRID_HALF * TILE;

const REGROWTH = 0.012;
const GRAZE_RATE = 0.32;
const ENERGY_FROM_GRASS = 0.20;
const ENERGY_DECAY = 0.08;
const ENERGY_DEATH = -0.5;
const ANIMAL_SPEED = 4.0;

const HERDER_COLORS = ['#FDB813', '#34D399', '#F472B6', '#60A5FA', '#A78BFA', '#EF4444'];
const BLADES_PER_TILE = 3;
const MAX_PARTICLES = 120;
const MAX_DEATH_MARKERS = 40;

interface PhaseConfig {
  initialPerHerder: number;
  cooperation: number;
  label: string;
  labelColor: string;
}

function configForPhase(phase: string): PhaseConfig {
  const p = phase.toLowerCase();
  if (p.match(/tragedia|colapso|hardin|libre/)) {
    return { initialPerHerder: 7, cooperation: 0, label: '○ libre · sin reglas', labelColor: '#EF4444' };
  }
  if (p.match(/ostrom|reglas|monitoreo|castigos|principios|sustent|cooperaci|comunal|conf/)) {
    return { initialPerHerder: 4, cooperation: 0.85, label: '● Ostrom · cooperación', labelColor: '#34D399' };
  }
  return { initialPerHerder: 3, cooperation: 0.5, label: '◐ baseline', labelColor: '#FDB813' };
}

interface Animal {
  herder: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  energy: number;
  alive: boolean;
  bobPhase: number;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  color: THREE.Color;
}

interface DeathMarker {
  x: number;
  y: number;
  age: number;
}

// ─────────────────────────────────────────────────────────────────
// Sky dome with gradient

function SkyDome() {
  const geometry = useMemo(() => new THREE.SphereGeometry(120, 32, 16), []);
  const material = useMemo(() => {
    const uniforms = {
      topColor: { value: new THREE.Color('#1a2540') },
      midColor: { value: new THREE.Color('#3a3060') },
      botColor: { value: new THREE.Color('#5a4a30') },
    };
    return new THREE.ShaderMaterial({
      uniforms,
      side: THREE.BackSide,
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 midColor;
        uniform vec3 botColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          vec3 col;
          if (h > 0.0) {
            col = mix(midColor, topColor, smoothstep(0.0, 0.7, h));
          } else {
            col = mix(midColor, botColor, smoothstep(0.0, -0.3, h));
          }
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);
  return <mesh geometry={geometry} material={material} />;
}

// ─────────────────────────────────────────────────────────────────
// Sun

function Sun() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.elapsedTime * 0.04;
    ref.current.position.set(
      Math.cos(t) * 60,
      30 + 8 * Math.sin(t * 0.7),
      Math.sin(t) * 60,
    );
  });
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[3, 24, 16]} />
      <meshBasicMaterial color="#FFE5A0" />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────────
// Grass blades (instanced thin tapered shapes)

function GrassBlades({
  grass,
  totalBlades,
  blades,
}: {
  grass: Float32Array;
  totalBlades: number;
  blades: Array<{ tileIdx: number; ox: number; oz: number; rot: number; height: number }>;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bladeColor = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    // initial paint
    for (let i = 0; i < totalBlades; i++) {
      const b = blades[i];
      const tx = b.tileIdx % GRID;
      const ty = Math.floor(b.tileIdx / GRID);
      const wx = (tx - GRID_HALF) * TILE + b.ox;
      const wz = (ty - GRID_HALF) * TILE + b.oz;
      dummy.position.set(wx, 0.3, wz);
      dummy.rotation.set(0, b.rot, 0);
      dummy.scale.set(0.04, b.height, 0.04);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      bladeColor.setRGB(0.2, 0.7, 0.3);
      mesh.setColorAt(i, bladeColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [blades, totalBlades, dummy, bladeColor]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh) return;
    const t = clock.elapsedTime;

    for (let i = 0; i < totalBlades; i++) {
      const b = blades[i];
      const tx = b.tileIdx % GRID;
      const ty = Math.floor(b.tileIdx / GRID);
      const wx = (tx - GRID_HALF) * TILE + b.ox;
      const wz = (ty - GRID_HALF) * TILE + b.oz;
      const g = grass[b.tileIdx];

      // Wind sway
      const sway = 0.18 * Math.sin(t * 1.6 + wx * 0.3 + wz * 0.2) * g;
      const height = (0.10 + b.height * 0.55) * Math.max(0.05, g);
      const tipX = sway * height * 0.8;

      dummy.position.set(wx + tipX * 0.3, height * 0.5, wz);
      dummy.rotation.set(sway * 0.4, b.rot, sway * 0.6);
      dummy.scale.set(0.045, height, 0.045);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Color: brighter green when healthy, dry-yellow when low
      const r = 0.35 - 0.20 * g;
      const gc = 0.30 + 0.55 * g;
      const bc = 0.10 + 0.20 * g;
      bladeColor.setRGB(r, gc, bc);
      mesh.setColorAt(i, bladeColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, totalBlades]}>
      <coneGeometry args={[1, 1, 4, 1, false]} />
      <meshStandardMaterial
        color="#FFFFFF"
        roughness={0.85}
        metalness={0}
        emissive="#0A1505"
        emissiveIntensity={0.25}
      />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────
// Cinematic camera

function CinematicCamera() {
  const { camera } = useThree();
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const orbit = t * 0.06;
    const r = 19 + 2 * Math.sin(t * 0.18);
    const h = 13 + 3 * Math.sin(t * 0.11);
    camera.position.set(Math.sin(orbit) * r, h, Math.cos(orbit) * r);
    camera.lookAt(0, 0.5 + 0.3 * Math.sin(t * 0.25), 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Main simulation

function CommonsSim({
  phase,
  onStats,
}: {
  phase: string;
  onStats: (s: { grass: number; alive: number; dead: number }) => void;
}) {
  const config = useMemo(() => configForPhase(phase), [phase]);

  const grass = useMemo(() => {
    const g = new Float32Array(GRID * GRID);
    for (let i = 0; i < g.length; i++) g[i] = 1;
    return g;
  }, [phase]);

  const animals = useMemo<Animal[]>(() => {
    const out: Animal[] = [];
    const numHerders = HERDER_COLORS.length;
    for (let h = 0; h < numHerders; h++) {
      for (let a = 0; a < config.initialPerHerder; a++) {
        const angle = (h / numHerders) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
        const r = 5 + Math.random() * 3;
        out.push({
          herder: h,
          x: GRID_HALF + Math.cos(angle) * r,
          y: GRID_HALF + Math.sin(angle) * r,
          vx: (Math.random() - 0.5) * 2,
          vy: (Math.random() - 0.5) * 2,
          energy: 1,
          alive: true,
          bobPhase: Math.random() * Math.PI * 2,
        });
      }
    }
    return out;
  }, [phase, config.initialPerHerder]);

  const animalsPerHerder = useMemo(() => {
    const counts = new Array(HERDER_COLORS.length).fill(0);
    for (const a of animals) counts[a.herder]++;
    return counts;
  }, [animals]);

  // Grass blades — 3 per tile, fixed offsets
  const { blades, totalBlades } = useMemo(() => {
    const N = GRID * GRID * BLADES_PER_TILE;
    const arr: Array<{ tileIdx: number; ox: number; oz: number; rot: number; height: number }> = [];
    const rng = (s: number) => { const x = Math.sin(s * 12.9898) * 43758.5453; return x - Math.floor(x); };
    for (let i = 0; i < N; i++) {
      const tileIdx = Math.floor(i / BLADES_PER_TILE);
      arr.push({
        tileIdx,
        ox: (rng(i * 1.1) - 0.5) * TILE * 0.75,
        oz: (rng(i * 2.3) - 0.5) * TILE * 0.75,
        rot: rng(i * 3.7) * Math.PI * 2,
        height: 0.6 + rng(i * 5.1) * 0.5,
      });
    }
    return { blades: arr, totalBlades: N };
  }, [phase]);

  // Particle pool for grazing
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: MAX_PARTICLES }, () => ({
      x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0, life: 0, color: new THREE.Color('#34D399'),
    }));
  }, [phase]);
  const nextParticleRef = useRef(0);

  // Death markers
  const deathMarkers = useMemo<DeathMarker[]>(() => [], [phase]);

  const grassMeshRef = useRef<THREE.InstancedMesh>(null);
  const animalBodyMeshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const animalHeadMeshes = useRef<(THREE.InstancedMesh | null)[]>([]);
  const particleMeshRef = useRef<THREE.InstancedMesh>(null);
  const deathMeshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tileColor = useMemo(() => new THREE.Color(), []);
  const partColor = useMemo(() => new THREE.Color(), []);

  // Initial tile setup
  useEffect(() => {
    const mesh = grassMeshRef.current;
    if (!mesh) return;
    for (let i = 0; i < GRID * GRID; i++) {
      const x = i % GRID;
      const y = Math.floor(i / GRID);
      dummy.position.set((x - GRID_HALF) * TILE, 0.05, (y - GRID_HALF) * TILE);
      dummy.scale.set(TILE * 0.98, 0.10, TILE * 0.98);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      tileColor.setRGB(0.18, 0.45, 0.20);
      mesh.setColorAt(i, tileColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [phase, dummy, tileColor]);

  const statsCounterRef = useRef(0);

  useFrame(({ clock }, dtRaw) => {
    const dt = Math.min(dtRaw, 1 / 30);
    const t = clock.elapsedTime;
    const mesh = grassMeshRef.current;
    if (!mesh) return;

    // 1. Regrow grass
    for (let i = 0; i < grass.length; i++) {
      if (grass[i] < 1) grass[i] = Math.min(1, grass[i] + REGROWTH * dt * 60);
    }

    // 2. Animals — move + eat + energy
    let alive = 0;
    let dead = 0;
    for (const a of animals) {
      if (!a.alive) { dead++; continue; }
      alive++;

      const tx = Math.floor(a.x);
      const ty = Math.floor(a.y);
      const idx = ty * GRID + tx;
      const grassHere = grass[idx];

      a.vx += (Math.random() - 0.5) * 0.6;
      a.vy += (Math.random() - 0.5) * 0.6;

      if (config.cooperation > 0 && Math.random() < config.cooperation && grassHere < 0.3) {
        let best = grassHere;
        let bestDx = 0, bestDy = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = tx + dx, ny = ty + dy;
            if (nx < 1 || nx >= GRID - 1 || ny < 1 || ny >= GRID - 1) continue;
            const ng = grass[ny * GRID + nx];
            if (ng > best) { best = ng; bestDx = dx; bestDy = dy; }
          }
        }
        a.vx = a.vx * 0.4 + bestDx * 2.0;
        a.vy = a.vy * 0.4 + bestDy * 2.0;
      }

      const sp = Math.hypot(a.vx, a.vy);
      const maxSpeed = config.cooperation > 0 ? ANIMAL_SPEED * 0.7 : ANIMAL_SPEED;
      if (sp > maxSpeed) {
        a.vx = (a.vx / sp) * maxSpeed;
        a.vy = (a.vy / sp) * maxSpeed;
      }

      a.x += a.vx * dt;
      a.y += a.vy * dt;
      if (a.x < 1) { a.x = 1; a.vx = Math.abs(a.vx); }
      if (a.x > GRID - 1) { a.x = GRID - 1; a.vx = -Math.abs(a.vx); }
      if (a.y < 1) { a.y = 1; a.vy = Math.abs(a.vy); }
      if (a.y > GRID - 1) { a.y = GRID - 1; a.vy = -Math.abs(a.vy); }

      let restraint = 1.0;
      if (config.cooperation > 0 && grassHere < 0.4) {
        restraint = 1 - config.cooperation * 0.6;
      }
      const eaten = Math.min(grassHere, GRAZE_RATE * restraint * dt * 60);
      grass[idx] -= eaten;

      // Emit grazing particle when eating significantly
      if (eaten > 0.04 && Math.random() < 0.15) {
        const pi = nextParticleRef.current;
        const p = particles[pi];
        p.x = (a.x - GRID_HALF) * TILE + (Math.random() - 0.5) * 0.2;
        p.y = 0.5;
        p.z = (a.y - GRID_HALF) * TILE + (Math.random() - 0.5) * 0.2;
        p.vx = (Math.random() - 0.5) * 1.2;
        p.vy = 1.5 + Math.random() * 1.0;
        p.vz = (Math.random() - 0.5) * 1.2;
        p.life = 1.0;
        p.color.set('#7CFF7C');
        nextParticleRef.current = (pi + 1) % MAX_PARTICLES;
      }

      a.energy += eaten * ENERGY_FROM_GRASS - ENERGY_DECAY * dt;
      if (a.energy > 1.5) a.energy = 1.5;
      if (a.energy < ENERGY_DEATH) {
        a.alive = false;
        // Emit death marker
        if (deathMarkers.length < MAX_DEATH_MARKERS) {
          deathMarkers.push({ x: a.x, y: a.y, age: 0 });
        }
        // Emit death particles (dark)
        for (let pp = 0; pp < 5; pp++) {
          const pi = nextParticleRef.current;
          const p = particles[pi];
          p.x = (a.x - GRID_HALF) * TILE;
          p.y = 0.8;
          p.z = (a.y - GRID_HALF) * TILE;
          p.vx = (Math.random() - 0.5) * 2.5;
          p.vy = 1.5 + Math.random() * 2.0;
          p.vz = (Math.random() - 0.5) * 2.5;
          p.life = 1.5;
          p.color.set('#FF5040');
          nextParticleRef.current = (pi + 1) % MAX_PARTICLES;
        }
      }
    }

    // 3. Grass tiles — flat ground with color variation
    let totalGrass = 0;
    for (let i = 0; i < grass.length; i++) {
      const g = grass[i];
      totalGrass += g;
      const x = i % GRID;
      const y = Math.floor(i / GRID);
      const height = 0.08 + g * 0.05;
      dummy.position.set((x - GRID_HALF) * TILE, height / 2, (y - GRID_HALF) * TILE);
      dummy.scale.set(TILE * 0.98, height, TILE * 0.98);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);

      // Subtle dirt color so blades pop on top
      const r = 0.40 - 0.18 * g;
      const gC = 0.20 + 0.35 * g;
      const b = 0.10 + 0.10 * g;
      tileColor.setRGB(r, gC, b);
      mesh.setColorAt(i, tileColor);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // 4. Animals — body + head per herder, with rotation by velocity and bobbing
    for (let h = 0; h < HERDER_COLORS.length; h++) {
      const bodyMesh = animalBodyMeshes.current[h];
      const headMesh = animalHeadMeshes.current[h];
      if (!bodyMesh || !headMesh) continue;
      let counter = 0;
      for (const a of animals) {
        if (a.herder !== h) continue;
        if (counter >= bodyMesh.count) break;
        if (a.alive) {
          const dir = Math.atan2(a.vy, a.vx);
          const bobY = Math.abs(Math.sin(t * 6 + a.bobPhase)) * 0.10;
          const wx = (a.x - GRID_HALF) * TILE;
          const wz = (a.y - GRID_HALF) * TILE;

          // Body (slightly stretched ovoid)
          dummy.position.set(wx, 0.65 + bobY, wz);
          dummy.rotation.set(0, -dir, 0);
          dummy.scale.set(0.42, 0.32, 0.30);
          dummy.updateMatrix();
          bodyMesh.setMatrixAt(counter, dummy.matrix);

          // Head (slightly forward and up)
          const headDist = 0.32;
          const hx = wx + Math.cos(dir) * headDist;
          const hz = wz + Math.sin(dir) * headDist;
          dummy.position.set(hx, 0.78 + bobY, hz);
          dummy.rotation.set(0, -dir, 0);
          dummy.scale.set(0.20, 0.18, 0.18);
          dummy.updateMatrix();
          headMesh.setMatrixAt(counter, dummy.matrix);
        } else {
          dummy.position.set(0, -100, 0);
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          bodyMesh.setMatrixAt(counter, dummy.matrix);
          headMesh.setMatrixAt(counter, dummy.matrix);
        }
        counter++;
      }
      bodyMesh.instanceMatrix.needsUpdate = true;
      headMesh.instanceMatrix.needsUpdate = true;
    }

    // 5. Particles
    const pmesh = particleMeshRef.current;
    if (pmesh) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = particles[i];
        if (p.life > 0) {
          p.life -= dt;
          p.vy -= 5.5 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          if (p.y < 0.05) p.life = 0;
        }
        if (p.life > 0) {
          dummy.position.set(p.x, p.y, p.z);
          const s = 0.10 * Math.min(1, p.life * 2);
          dummy.scale.setScalar(s);
          dummy.rotation.set(0, 0, 0);
          dummy.updateMatrix();
          pmesh.setMatrixAt(i, dummy.matrix);
          pmesh.setColorAt(i, p.color);
        } else {
          dummy.position.set(0, -1000, 0);
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          pmesh.setMatrixAt(i, dummy.matrix);
        }
      }
      pmesh.instanceMatrix.needsUpdate = true;
      if (pmesh.instanceColor) pmesh.instanceColor.needsUpdate = true;
    }

    // 6. Death markers
    const dmesh = deathMeshRef.current;
    if (dmesh) {
      for (let i = 0; i < MAX_DEATH_MARKERS; i++) {
        if (i < deathMarkers.length) {
          const d = deathMarkers[i];
          d.age += dt;
          const dwx = (d.x - GRID_HALF) * TILE;
          const dwz = (d.y - GRID_HALF) * TILE;
          dummy.position.set(dwx, 0.18, dwz);
          dummy.rotation.set(0, t * 0.2 + i, 0);
          const s = Math.min(0.22, d.age * 0.3) * Math.max(0.3, 1 - d.age * 0.02);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          dmesh.setMatrixAt(i, dummy.matrix);
        } else {
          dummy.position.set(0, -1000, 0);
          dummy.scale.setScalar(0.0001);
          dummy.updateMatrix();
          dmesh.setMatrixAt(i, dummy.matrix);
        }
      }
      dmesh.instanceMatrix.needsUpdate = true;
    }

    // 7. HUD update (throttled)
    statsCounterRef.current++;
    if (statsCounterRef.current >= 10) {
      statsCounterRef.current = 0;
      onStats({ grass: totalGrass / (GRID * GRID), alive, dead });
    }
  });

  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.45} color="#9BB5DD" />
      <directionalLight position={[20, 30, 15]} intensity={1.1} color="#FFF5E0" castShadow />
      <directionalLight position={[-15, 10, -8]} intensity={0.32} color="#7BA8FF" />
      <hemisphereLight args={['#86A8FF', '#3A2818', 0.32]} />

      {/* Atmosphere */}
      <fog attach="fog" args={['#3a3050', 28, 80]} />

      {/* Sky and sun */}
      <SkyDome />
      <Sun />

      {/* Distant ground border ring for depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <ringGeometry args={[FIELD_HALF + 1, 90, 64, 1]} />
        <meshStandardMaterial color="#2A1F18" roughness={1} />
      </mesh>

      {/* Grass dirt tiles */}
      <instancedMesh ref={grassMeshRef} args={[undefined, undefined, GRID * GRID]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.92} metalness={0} />
      </instancedMesh>

      {/* Grass blades */}
      <GrassBlades grass={grass} totalBlades={totalBlades} blades={blades} />

      {/* Animals: body */}
      {HERDER_COLORS.map((color, h) => {
        const count = animalsPerHerder[h];
        if (count === 0) return null;
        return (
          <instancedMesh
            key={`body-${h}`}
            ref={(el) => { animalBodyMeshes.current[h] = el; }}
            args={[undefined, undefined, count]}
          >
            <sphereGeometry args={[1, 14, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.4}
              roughness={0.55}
              metalness={0.1}
            />
          </instancedMesh>
        );
      })}

      {/* Animals: head */}
      {HERDER_COLORS.map((color, h) => {
        const count = animalsPerHerder[h];
        if (count === 0) return null;
        return (
          <instancedMesh
            key={`head-${h}`}
            ref={(el) => { animalHeadMeshes.current[h] = el; }}
            args={[undefined, undefined, count]}
          >
            <sphereGeometry args={[1, 12, 10]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={0.7}
              roughness={0.45}
              metalness={0.15}
            />
          </instancedMesh>
        );
      })}

      {/* Grazing/death particles */}
      <instancedMesh ref={particleMeshRef} args={[undefined, undefined, MAX_PARTICLES]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFFFF"
          emissiveIntensity={1.6}
          roughness={0.4}
        />
      </instancedMesh>

      {/* Death markers (small dark crosses) */}
      <instancedMesh ref={deathMeshRef} args={[undefined, undefined, MAX_DEATH_MARKERS]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#1A1010"
          emissive="#3A0A0A"
          emissiveIntensity={0.6}
          roughness={0.3}
        />
      </instancedMesh>
    </>
  );
}

export default function CommonsScene({ phase }: { phase: string }) {
  const config = useMemo(() => configForPhase(phase), [phase]);
  const [stats, setStats] = useState({ grass: 1, alive: 0, dead: 0 });

  return (
    <div
      className="w-full h-full relative"
      style={{ background: 'radial-gradient(ellipse at 50% 30%, #1a2540 0%, #03050A 80%)' }}
    >
      <Canvas
        camera={{ position: [0, 14, 18], fov: 45 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
      >
        <CommonsSim key={phase} phase={phase} onStats={setStats} />
        <CinematicCamera />
      </Canvas>

      {/* HUD top-left */}
      <div className="absolute top-6 left-6 text-[11px] font-mono space-y-1.5 pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Pastores</div>
        <div className="flex gap-2 mt-1.5">
          {HERDER_COLORS.map((color, i) => (
            <span
              key={i}
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: color, boxShadow: `0 0 10px ${color}` }}
            />
          ))}
        </div>
        <div className="text-[#94A3B8] mt-1">6 pastores comparten el pasto</div>
      </div>

      {/* HUD top-right */}
      <div className="absolute top-6 right-6 text-[11px] font-mono space-y-1 pointer-events-none text-right">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Régimen</div>
        <div style={{ color: config.labelColor }}>{config.label}</div>
      </div>

      {/* HUD bottom */}
      <div className="absolute bottom-32 left-6 text-[11px] font-mono space-y-1 pointer-events-none">
        <div className="text-[10px] uppercase tracking-[0.3em] text-[#64748B]">Estado</div>
        <div className="flex gap-5 mt-1">
          <div>
            <span className="text-[#475569]">Pasto: </span>
            <span style={{ color: stats.grass > 0.4 ? '#34D399' : stats.grass > 0.15 ? '#FDB813' : '#EF4444' }}>
              {(stats.grass * 100).toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-[#475569]">Vivos: </span>
            <span className="text-[#E2E8F0]">{stats.alive}</span>
          </div>
          {stats.dead > 0 && (
            <div>
              <span className="text-[#475569]">Muertos: </span>
              <span className="text-[#EF4444]">{stats.dead}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
