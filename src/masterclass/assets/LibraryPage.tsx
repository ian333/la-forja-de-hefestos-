/**
 * LibraryPage — catálogo visual interactivo de todos los assets de la
 * masterclass library. Vive en /library.html.
 *
 * Sirve dos propósitos:
 *   1. Verificación visual rápida ("¿se ve atom-style? ¿bloom correcto?").
 *   2. Dogfood para la IA siguiente: ver qué hay disponible al planear
 *      una escena nueva sin tener que leer todos los .tsx.
 *
 * Layout:
 *   ┌──────────────────────────────────────────┐
 *   │  HEADER · modes toggle                    │
 *   │  [solid] [wireframe] [edges] (atom)       │
 *   ├──────────────────────────────────────────┤
 *   │                                            │
 *   │   ◯Lemon  ◯Apple  ◯Cherry  ◯Bill  ◯Coin   │   ← Capa 2 shapes
 *   │   ──────────────────────────────────────   │
 *   │   GLBs (Capa 3 — descargas pendientes)    │
 *   │   [pending lemon] [pending factory] ...   │   ← AtomModel cuando .glb existe
 *   └──────────────────────────────────────────┘
 */

import { useState, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRef } from 'react';
import { Lemon, Apple, Cherry, Bill, Coin } from './shapes';
import type { ShapeMode } from './shapes/_BaseShape';
import AtomModel from './gltf/AtomModel';
import { LIBRARY_LIST, CATEGORIES, type LibraryEntry } from './gltf/manifest';
import PostFX from '../scenes/_postFX';

// ─────────────────────────────────────────────────────────────
// Display cell — un slot con grid posicionado, auto-rotate, label flotante.

interface CellProps {
  position: [number, number, number];
  label: string;
  pending?: boolean;
  children: React.ReactNode;
}

function Cell({ position, label, pending, children }: CellProps) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.35;
  });
  return (
    <group position={position}>
      <group ref={groupRef}>
        {children}
      </group>
      {/* Pedestal sutil debajo */}
      <mesh position={[0, -1.4, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.95, 1.05, 32]} />
        <meshBasicMaterial color={pending ? '#444' : '#FDB813'} transparent opacity={pending ? 0.20 : 0.35} toneMapped={false} />
      </mesh>
      {/* Label HTML overlay via raycasting es complejo — usamos texture canvas */}
      <CellLabel text={label} pending={pending} />
    </group>
  );
}

function CellLabel({ text, pending }: { text: string; pending?: boolean }) {
  const tex = useRef<THREE.CanvasTexture | null>(null);
  if (!tex.current) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = pending ? '#666' : '#FFE5A0';
    ctx.font = '600 56px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 64);
    if (pending) {
      ctx.font = '400 28px monospace';
      ctx.fillStyle = '#999';
      ctx.fillText('· pending download ·', 256, 110);
    }
    tex.current = new THREE.CanvasTexture(canvas);
    tex.current.minFilter = THREE.LinearFilter;
    tex.current.magFilter = THREE.LinearFilter;
  }
  return (
    <mesh position={[0, -1.9, 0]}>
      <planeGeometry args={[3.0, 0.75]} />
      <meshBasicMaterial map={tex.current} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

// ─────────────────────────────────────────────────────────────
// Placeholder cube — cuando un GLB no está available todavía.

function PendingPlaceholder({ color }: { color: string }) {
  return (
    <group>
      <mesh>
        <boxGeometry args={[1.2, 1.2, 1.2]} />
        <meshBasicMaterial color={color} wireframe transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {/* "?" en el centro */}
      <mesh position={[0, 0, 0.61]}>
        <planeGeometry args={[0.6, 0.6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.7}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

// ─────────────────────────────────────────────────────────────
// Grid layout — calcula posiciones para n items en filas de COLS.

const COLS = 7;
const COL_SPACING = 4.0;
const ROW_SPACING = 4.5;

function gridPosition(index: number, totalRows: number): [number, number, number] {
  const col = index % COLS;
  const row = Math.floor(index / COLS);
  const x = (col - (COLS - 1) / 2) * COL_SPACING;
  const z = (row - (totalRows - 1) / 2) * ROW_SPACING;
  return [x, 0, z];
}

// ─────────────────────────────────────────────────────────────
// Camera director — slow orbital sobre toda la grid.

function CameraOrbit() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime;
    // Slow orbit, vista alta tipo top-down isométrica para ver todo el grid
    const orbit = 0.05 + t * 0.025;
    const dist = 24;
    const height = 28 + 2 * Math.sin(t * 0.08);
    camera.position.set(Math.sin(orbit) * dist, height, Math.cos(orbit) * dist);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

// ─────────────────────────────────────────────────────────────
// Scene content

interface SceneProps {
  mode: ShapeMode;
}

function SceneContent({ mode }: SceneProps) {
  // Capa 2 shapes — siempre disponibles
  const shapesRow = [
    { key: 'lemon', node: <Lemon scale={1.0} mode={mode} /> },
    { key: 'apple', node: <Apple scale={1.0} mode={mode} /> },
    { key: 'cherry', node: <Cherry scale={1.0} mode={mode} /> },
    { key: 'bill', node: <Bill scale={0.9} mode={mode} /> },
    { key: 'coin', node: <Coin scale={0.9} mode={mode} /> },
  ];

  // Capa 3 — solo los marcados available; otros como placeholder
  const glbItems: LibraryEntry[] = LIBRARY_LIST;

  const totalRowsShapes = Math.ceil(shapesRow.length / COLS);
  const totalRowsGlb = Math.ceil(glbItems.length / COLS);
  // Offset Z para que GLBs vayan detrás de shapes
  const SHAPES_ZOFFSET = -((totalRowsShapes + totalRowsGlb) / 2) * ROW_SPACING + ROW_SPACING / 2;
  const GLB_ZOFFSET = SHAPES_ZOFFSET + totalRowsShapes * ROW_SPACING + 1.5;

  return (
    <>
      <ambientLight intensity={0.30} />
      <directionalLight position={[5, 12, 5]} intensity={0.6} color="#FFB870" />
      <directionalLight position={[-5, 8, -5]} intensity={0.4} color="#7FB0FF" />

      <CameraOrbit />

      {/* Fondo: starfield muy sutil */}
      <fog attach="fog" args={['#050308', 10, 50]} />

      {/* Shapes row */}
      <group position={[0, 0, SHAPES_ZOFFSET]}>
        {shapesRow.map((s, i) => {
          const [x, y, z] = gridPosition(i, totalRowsShapes);
          return (
            <Cell key={s.key} position={[x, y, z]} label={s.key}>
              {s.node}
            </Cell>
          );
        })}
      </group>

      {/* GLB row */}
      <group position={[0, 0, GLB_ZOFFSET]}>
        {glbItems.map((entry, i) => {
          const [x, y, z] = gridPosition(i, totalRowsGlb);
          return (
            <Cell key={entry.name} position={[x, y, z]} label={entry.name} pending={!entry.available}>
              {entry.available ? (
                <Suspense fallback={<PendingPlaceholder color={entry.color} />}>
                  <AtomModel
                    src={entry.src}
                    color={entry.color}
                    scale={entry.defaultScale}
                    mode={mode}
                  />
                </Suspense>
              ) : (
                <PendingPlaceholder color={entry.color} />
              )}
            </Cell>
          );
        })}
      </group>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Top-level

export default function LibraryPage() {
  const [mode, setMode] = useState<ShapeMode>('atom');

  // Stats por categoría
  const stats = CATEGORIES.map(cat => {
    const items = LIBRARY_LIST.filter(e => e.category === cat);
    const available = items.filter(e => e.available).length;
    return { cat, total: items.length, available };
  }).filter(s => s.total > 0);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      <Canvas
        camera={{ position: [10, 12, 18], fov: 45, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.18,
          alpha: false,
        }}
        dpr={[1, 2]}
      >
        <SceneContent mode={mode} />
        <PostFX
          intensity={1.6}
          threshold={0.20}
          smoothing={0.45}
          vignette={0.65}
          vignetteOffset={0.22}
          aberration={0.0010}
        />
      </Canvas>

      {/* HUD overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Header */}
        <div className="absolute top-6 left-6 right-6 flex justify-between items-start pointer-events-auto">
          <div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-[#FFE5A0]/60 font-mono">
              Masterclass · Asset Library
            </div>
            <div className="text-[20px] text-[#FFE5A0]/90 font-mono mt-1">
              Capa 2 shapes + Capa 3 GLBs
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2 font-mono">
            {(['solid', 'wireframe', 'edges', 'atom'] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 text-[11px] uppercase tracking-wider border transition-all ${
                  mode === m
                    ? 'border-[#FDB813] text-[#FDB813] bg-[#FDB813]/10'
                    : 'border-[#FFE5A0]/20 text-[#FFE5A0]/40 hover:text-[#FFE5A0]/70 hover:border-[#FFE5A0]/40'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Footer stats */}
        <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end font-mono text-[10px]">
          <div className="text-[#FFE5A0]/40 max-w-md leading-relaxed">
            <div>orbita auto · sin controles</div>
            <div className="mt-1 opacity-70">
              capa 2 (shapes propios) → siempre disponible<br/>
              capa 3 (GLBs Quaternius/Kenney) → ver MASTERCLASS_ASSETS.md
            </div>
          </div>
          <div className="text-[#FFE5A0]/50 text-right">
            {stats.map(s => (
              <div key={s.cat}>
                <span className="text-[#FFE5A0]/30 uppercase tracking-widest">{s.cat}</span>{' '}
                <span className={s.available === s.total ? 'text-[#34D399]' : 'text-[#FDB813]'}>
                  {s.available}/{s.total}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
