/**
 * Docking interactivo estilo AutoDock Vina — el juego que jugaron Roche/Merck
 * entre 1989-1994 para diseñar saquinavir, el primer inhibidor de proteasa
 * aprobado contra VIH (1995).
 *
 *   - Proteína: HIV-1 protease homodímero (1HSG) como cartoon ribbon.
 *   - Ligando: saquinavir (HETATM del mismo archivo) como CPK agarrable.
 *   - El usuario arrastra/rota el ligando con PivotControls.
 *   - En cada frame reevaluamos el score Vina-like (5 términos) y lo mostramos
 *     con barras. Cuando el total baja de −5 kcal/mol aprox, el simulador
 *     considera que "encaja".
 *
 * No es un minimizador, es un juguete. Pero la función de score es la de Vina
 * real; los pesos vienen de Trott & Olson 2010.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PivotControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import {
  parsePDB, ELEMENT_COLOR, VDW_RADIUS, COVALENT_RADIUS,
  type Structure, type Atom,
} from '@/lib/bio/pdb';
import {
  buildDockLigand, buildProteinAtoms, ProteinGrid, scoreDocking,
  type DockAtom, type ProteinAtom, type ScoreBreakdown,
} from '@/lib/bio/docking';

const PDB_ID = '1HSG';
// Starting offset (Å) from the native centroid. Chosen so the ligand sits just
// outside the protease surface: a few hundred contacts (bars move) but few to
// no hard clashes, so the score shows a moderately-positive ΔG that the player
// can drive down by sliding into the pocket.
const START_OFFSET: [number, number, number] = [28, 18, 10];
const SUCCESS_THRESHOLD = -4.5;

interface Bundle {
  structure: Structure;
  protein: ProteinAtom[];
  grid: ProteinGrid;
  ligandAtoms: Atom[];         // raw (with original PDB coords, for ghost render)
  dock: DockAtom[];            // atoms centered on centroid, for scoring
  nativeCentroid: [number, number, number];
  caBackbone: THREE.Vector3[][]; // one array per chain, of Cα positions
  bbox: Structure['bbox'];
}

export default function Docking() {
  const { audience } = useAudience();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGhost, setShowGhost] = useState(true);
  const [pivotMode, setPivotMode] = useState<'both' | 'translate' | 'rotate'>('both');
  const [resetNonce, setResetNonce] = useState(0);
  const scoreRef = useRef<ScoreBreakdown>({
    gauss1: 0, gauss2: 0, repulsion: 0, hydrophobic: 0, hbond: 0,
    total: 0, nContacts: 0, clashCount: 0,
  });
  const [uiScore, setUiScore] = useState<ScoreBreakdown>(scoreRef.current);
  const [docked, setDocked] = useState(false);

  useEffect(() => {
    let aborted = false;
    setBundle(null);
    setError(null);
    fetch(`https://files.rcsb.org/download/${PDB_ID}.pdb`)
      .then(r => {
        if (!r.ok) throw new Error(`RCSB ${r.status}`);
        return r.text();
      })
      .then(text => {
        if (aborted) return;
        const structure = parsePDB(text);
        // Saquinavir is the only non-water, non-ion HETATM group in 1HSG.
        const ligRes = structure.hetGroups.filter(h => h.resName !== 'HOH' && h.atoms.length > 5);
        if (ligRes.length === 0) throw new Error('no ligand found in 1HSG');
        const ligandAtoms = ligRes.flatMap(r => r.atoms);
        const { atoms: dock, centroid } = buildDockLigand(ligandAtoms);
        const protein = buildProteinAtoms(structure.atoms);
        const grid = new ProteinGrid(protein);
        // Collect Cα per chain for the cartoon.
        const caBackbone: THREE.Vector3[][] = structure.chains.map(c => {
          const out: THREE.Vector3[] = [];
          for (const res of c.residues) {
            const ca = res.atoms.find(a => a.name === 'CA' && a.element === 'C');
            if (ca) out.push(new THREE.Vector3(...ca.pos));
          }
          return out;
        }).filter(list => list.length >= 2);
        setBundle({
          structure, protein, grid, ligandAtoms, dock,
          nativeCentroid: centroid, caBackbone, bbox: structure.bbox,
        });
      })
      .catch(err => {
        if (!aborted) setError(String(err.message || err));
      });
    return () => { aborted = true; };
  }, []);

  const deltaKcal = uiScore.total;
  const hintForChild =
    uiScore.clashCount > 3 ? 'Te estás chocando con la proteína — aléjate.' :
    uiScore.nContacts === 0 ? 'Muévelo más cerca del centro de la proteína (el anillo azul).' :
    deltaKcal > -1 ? 'Estás en contacto. Gira y desliza para que encaje mejor.' :
    deltaKcal > SUCCESS_THRESHOLD ? 'Muy cerca. Afina el giro.' :
    '¡Encajado! El saquinavir se asentó en el bolsillo.';

  return (
    <div className="grid grid-cols-[1fr_340px] gap-0 h-full">
      <div className="relative">
        <DockViewport
          bundle={bundle}
          showGhost={showGhost}
          pivotMode={pivotMode}
          resetNonce={resetNonce}
          scoreRef={scoreRef}
          onUiScore={(s) => {
            setUiScore(s);
            setDocked(s.total < SUCCESS_THRESHOLD);
          }}
        />
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5 max-w-[560px]">
          <div><span className="text-[#64748B]">sistema&nbsp;</span>= proteasa VIH-1 + saquinavir · {PDB_ID}</div>
          <div><span className="text-[#64748B]">score&nbsp;&nbsp;&nbsp;</span>= scoring Vina aproximado (Trott &amp; Olson 2010)</div>
          {error && <div className="text-[#EF5350]">error: {error}</div>}
          {!bundle && !error && <div className="text-[#FDB813]">cargando {PDB_ID}…</div>}
          {bundle && (
            <div className="text-[#94A3B8] text-[10px] mt-1 italic">
              {hintForChild}
            </div>
          )}
        </div>
        {docked && (
          <div className="absolute top-4 right-4 rounded-lg bg-gradient-to-br from-[#22C55E]/20 to-[#16A34A]/30 border border-[#22C55E]/50 px-4 py-3 font-mono text-[12px] text-white">
            <div className="text-[14px] font-semibold">✓ Encajado</div>
            <div className="text-[10px] text-[#BBF7D0]">ΔG ≈ {deltaKcal.toFixed(2)} kcal/mol</div>
          </div>
        )}
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Función de score">
          <ScoreRow label="ΔG total" value={`${deltaKcal.toFixed(2)} kcal/mol`} bold highlight={docked} />
          <Bar label="gauss 1 (atractivo d≈0)" v={uiScore.gauss1}     max={60} color="#4FC3F7" unit="" />
          <Bar label="gauss 2 (d≈3 Å)"          v={uiScore.gauss2}     max={150} color="#81D4FA" unit="" />
          <Bar label="repulsión (clashes)"       v={uiScore.repulsion}  max={50} color="#EF5350" unit="" signed />
          <Bar label="hidrofóbico (C-C)"         v={uiScore.hydrophobic} max={30} color="#FFB74D" unit="" />
          <Bar label="H-bond (N/O polares)"      v={uiScore.hbond}       max={5} color="#BA68C8" unit="" />
          <div className="mt-2 pt-2 border-t border-[#1E293B] text-[10px] text-[#64748B]">
            contactos &lt; 8 Å: <span className="text-white font-mono">{uiScore.nContacts}</span> · clashes: <span className={`font-mono ${uiScore.clashCount > 0 ? 'text-[#EF5350]' : 'text-white'}`}>{uiScore.clashCount}</span>
          </div>
        </Section>

        <Section title="Control">
          <div className="grid grid-cols-3 gap-1 mb-2">
            {(['both', 'translate', 'rotate'] as const).map(m => (
              <button key={m} onClick={() => setPivotMode(m)}
                className={`px-2 py-1.5 rounded-md border text-[10px] font-mono transition ${
                  pivotMode === m
                    ? 'bg-[#1E293B] border-[#4FC3F7]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
                }`}
              >
                {m === 'both' ? 'mover+girar' : m === 'translate' ? 'solo mover' : 'solo girar'}
              </button>
            ))}
          </div>
          <button onClick={() => setResetNonce(n => n + 1)}
            className="w-full px-3 py-1.5 rounded-md border border-[#1E293B] hover:border-[#4FC3F7]/40 text-[11px] font-mono text-[#CBD5E1] hover:text-white transition"
          >
            reiniciar pose del ligando
          </button>
          <div className="mt-2">
            <label className="flex items-center gap-2 py-1 cursor-pointer text-[11px] text-[#CBD5E1]">
              <input type="checkbox" checked={showGhost} onChange={e => setShowGhost(e.target.checked)} className="accent-[#4FC3F7]" />
              mostrar pose nativa (fantasma)
            </label>
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="¿Qué estás jugando?">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>La <strong>proteasa</strong> es una máquina viral con forma de llave de tuercas. Si la dejas trabajar, el virus del SIDA se reproduce.</p>
              <p>El <strong>saquinavir</strong> es un tapón con la forma exacta del hueco de la máquina. Si lo metes bien, la máquina se atasca y el virus no puede crecer.</p>
              <p>Tu misión: mover el tapón al hueco y girarlo hasta que el número verde (ΔG) sea lo más negativo posible.</p>
            </div>
          </Section>
        ) : (
          <Section title="Fondo científico">
            <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
              <p>Proteasa VIH-1: homodímero C₂, cada cadena 99 aa. El sitio activo con <strong>Asp25</strong> catalítico está en la interfaz dimérica, cubierto por dos "flaps" flexibles.</p>
              <p>Saquinavir (Ro31-8959, 1995): el primer inhibidor de proteasa aprobado. IC₅₀ ≈ 2 nM contra proteasa VIH-1. Redujo mortalidad SIDA 10× cuando se combinó con NRTIs (HAART).</p>
              <p>Scoring: 5 términos Vina (2 gaussianos atractivos, 1 repulsión, 1 hidrofóbico, 1 H-bond) con pesos publicados. Para evitar costo O(N·M) corremos con grid espacial 8 Å.</p>
            </div>
          </Section>
        )}

        <Section title="Objetivo">
          <div className="text-[11px] text-[#CBD5E1] font-mono leading-relaxed">
            ΔG &lt; <span className="text-[#22C55E]">{SUCCESS_THRESHOLD}</span> kcal/mol → encajado<br/>
            sin clashes → sin overlap vdW<br/>
            n contactos &gt; 40 → en el bolsillo
          </div>
        </Section>
      </aside>
    </div>
  );
}

function DockViewport({
  bundle, showGhost, pivotMode, resetNonce, scoreRef, onUiScore,
}: {
  bundle: Bundle | null;
  showGhost: boolean;
  pivotMode: 'both' | 'translate' | 'rotate';
  resetNonce: number;
  scoreRef: React.RefObject<ScoreBreakdown>;
  onUiScore: (s: ScoreBreakdown) => void;
}) {
  const center = bundle?.bbox.center ?? [0, 0, 0];
  const extent = bundle
    ? Math.max(
        bundle.bbox.max[0] - bundle.bbox.min[0],
        bundle.bbox.max[1] - bundle.bbox.min[1],
        bundle.bbox.max[2] - bundle.bbox.min[2],
      )
    : 60;
  const camDist = Math.max(60, extent * 2.0);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  return (
    <div className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}>
      <Canvas
        camera={{ position: [center[0] + camDist * 0.6, center[1] + camDist * 0.2, center[2] + camDist * 0.8], fov: 40, near: 0.5, far: 2000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[center[0] + 100, center[1] + 60, center[2] + 40]} intensity={1.2} color="#B3E5FC" distance={0} decay={0} />
        <pointLight position={[center[0] - 80, center[1] - 40, center[2] - 50]} intensity={0.7} color="#FFAB91" distance={0} decay={0} />
        <OrbitControls ref={controlsRef} target={center as [number, number, number]} makeDefault enablePan enableZoom enableRotate enableDamping dampingFactor={0.08} />
        <CameraFitter center={center as [number, number, number]} camDist={camDist} controlsRef={controlsRef}
          key={bundle ? `${center[0].toFixed(1)}|${camDist.toFixed(1)}` : 'empty'} />
        {bundle && (
          <DockScene
            bundle={bundle}
            showGhost={showGhost}
            pivotMode={pivotMode}
            resetNonce={resetNonce}
            scoreRef={scoreRef}
            onUiScore={onUiScore}
          />
        )}
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.75} luminanceThreshold={0.28} luminanceSmoothing={0.4} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function CameraFitter({
  center, camDist, controlsRef,
}: {
  center: [number, number, number];
  camDist: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(center[0] + camDist * 0.6, center[1] + camDist * 0.2, center[2] + camDist * 0.8);
    camera.lookAt(center[0], center[1], center[2]);
    camera.updateProjectionMatrix();
    const ctl = controlsRef.current;
    if (ctl) { ctl.target.set(center[0], center[1], center[2]); ctl.update(); }
  }, [camera, center, camDist, controlsRef]);
  return null;
}

function DockScene({
  bundle, showGhost, pivotMode, resetNonce, scoreRef, onUiScore,
}: {
  bundle: Bundle;
  showGhost: boolean;
  pivotMode: 'both' | 'translate' | 'rotate';
  resetNonce: number;
  scoreRef: React.RefObject<ScoreBreakdown>;
  onUiScore: (s: ScoreBreakdown) => void;
}) {
  const particleTex = useMemo(() => getParticleTexture(), []);
  const ligandGroupRef = useRef<THREE.Group>(null);
  const pivotMatrix = useMemo(() => new THREE.Matrix4(), []);
  const lastScoreAt = useRef(0);

  // Reset pose whenever resetNonce changes.
  useEffect(() => {
    const g = ligandGroupRef.current;
    if (!g) return;
    const start: [number, number, number] = [
      bundle.nativeCentroid[0] + START_OFFSET[0],
      bundle.nativeCentroid[1] + START_OFFSET[1],
      bundle.nativeCentroid[2] + START_OFFSET[2],
    ];
    g.position.set(...start);
    g.quaternion.identity();
    g.updateMatrix();
    pivotMatrix.copy(g.matrix);
  }, [resetNonce, bundle.nativeCentroid, pivotMatrix]);

  // ─ Score loop (10 Hz throttled for React state; 60 Hz into ref) ─
  const worldPos = useMemo(() => new THREE.Vector3(), []);
  const worldQuat = useMemo(() => new THREE.Quaternion(), []);
  useFrame(() => {
    const g = ligandGroupRef.current;
    if (!g) return;
    g.getWorldPosition(worldPos);
    g.getWorldQuaternion(worldQuat);
    const s = scoreDocking(
      bundle.dock,
      bundle.grid,
      [worldPos.x, worldPos.y, worldPos.z],
      [worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w],
    );
    scoreRef.current = s;
    const now = performance.now();
    if (now - lastScoreAt.current > 80) {
      lastScoreAt.current = now;
      onUiScore(s);
    }
  });

  // Activate axes based on pivot mode.
  const activeAxes: [boolean, boolean, boolean] = [true, true, true];
  const disableRot = pivotMode === 'translate';
  const disableTrans = pivotMode === 'rotate';

  return (
    <>
      {/* Protein cartoon backbone (tube) */}
      {bundle.caBackbone.map((caList, ci) => (
        <CartoonTube key={ci} points={caList} color={ci === 0 ? '#4FC3F7' : '#F48FB1'} />
      ))}

      {/* Pocket indicator — ring at native centroid */}
      <mesh position={bundle.nativeCentroid}>
        <torusGeometry args={[4.5, 0.25, 12, 64]} />
        <meshBasicMaterial color="#81D4FA" transparent opacity={0.5} />
      </mesh>
      <sprite position={bundle.nativeCentroid} scale={[10, 10, 10]}>
        <spriteMaterial
          map={particleTex}
          color="#4FC3F7"
          transparent
          opacity={0.22}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Ghost: native pose of saquinavir */}
      {showGhost && (
        <group>
          {bundle.ligandAtoms.map((a, i) => {
            const color = ELEMENT_COLOR[a.element] ?? '#AAAAAA';
            const r = (VDW_RADIUS[a.element] ?? 1.6) * 0.3;
            return (
              <mesh key={`gh-${i}`} position={a.pos}>
                <sphereGeometry args={[r, 12, 12]} />
                <meshBasicMaterial color={color} transparent opacity={0.18} depthWrite={false} />
              </mesh>
            );
          })}
        </group>
      )}

      {/* Grabbable ligand */}
      <PivotControls
        anchor={[0, 0, 0]}
        scale={100}
        fixed
        depthTest={false}
        lineWidth={2.5}
        activeAxes={activeAxes}
        disableRotations={disableRot}
        disableSliders={disableTrans}
        autoTransform
      >
        <group ref={ligandGroupRef}>
          <LigandMesh atoms={bundle.ligandAtoms} centroid={bundle.nativeCentroid} particleTex={particleTex} />
        </group>
      </PivotControls>
    </>
  );
}

function CartoonTube({ points, color }: { points: THREE.Vector3[]; color: string }) {
  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    return new THREE.TubeGeometry(curve, Math.max(points.length * 6, 64), 0.75, 10, false);
  }, [points]);
  if (!geom) return null;
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.25}
        roughness={0.45}
        metalness={0.25}
        transparent
        opacity={0.75}
      />
    </mesh>
  );
}

function LigandMesh({
  atoms, centroid, particleTex,
}: {
  atoms: Atom[];
  centroid: [number, number, number];
  particleTex: THREE.Texture;
}) {
  // Precompute bonds (covalent radii × 1.25) in local coordinates.
  const { localPositions, bonds } = useMemo(() => {
    const localPositions: [number, number, number][] = atoms.map(a => [
      a.pos[0] - centroid[0], a.pos[1] - centroid[1], a.pos[2] - centroid[2],
    ]);
    const bonds: [number, number][] = [];
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const ra = COVALENT_RADIUS[atoms[i].element] ?? 1.0;
        const rb = COVALENT_RADIUS[atoms[j].element] ?? 1.0;
        const cut = (ra + rb) * 1.25;
        const dx = atoms[i].pos[0] - atoms[j].pos[0];
        const dy = atoms[i].pos[1] - atoms[j].pos[1];
        const dz = atoms[i].pos[2] - atoms[j].pos[2];
        const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (d > 0.4 && d < cut) bonds.push([i, j]);
      }
    }
    return { localPositions, bonds };
  }, [atoms, centroid]);

  return (
    <>
      {atoms.map((a, i) => {
        const color = ELEMENT_COLOR[a.element] ?? '#AAAAAA';
        const r = (VDW_RADIUS[a.element] ?? 1.6) * 0.42;
        return (
          <group key={`a-${i}`} position={localPositions[i]}>
            <mesh>
              <sphereGeometry args={[r, 20, 20]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.75}
                roughness={0.3}
                metalness={0.3}
              />
            </mesh>
            <sprite scale={[r * 6, r * 6, r * 6]}>
              <spriteMaterial
                map={particleTex}
                color={color}
                transparent
                opacity={0.6}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </sprite>
          </group>
        );
      })}
      {bonds.map(([i, j], k) => {
        const a = localPositions[i], b = localPositions[j];
        const mid: [number, number, number] = [(a[0]+b[0])/2, (a[1]+b[1])/2, (a[2]+b[2])/2];
        const dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const dir = new THREE.Vector3(dx/len, dy/len, dz/len);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
        return (
          <mesh key={`b-${k}`} position={mid} quaternion={q}>
            <cylinderGeometry args={[0.22, 0.22, len, 10]} />
            <meshStandardMaterial color="#DDDDDD" emissive="#888888" emissiveIntensity={0.4} roughness={0.5} metalness={0.2} />
          </mesh>
        );
      })}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}

function ScoreRow({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between text-[12px] font-mono py-0.5 ${bold ? 'mb-2' : ''}`}>
      <span className={bold ? 'text-[#CBD5E1]' : 'text-[#64748B]'}>{label}</span>
      <span className={`${bold ? 'text-[14px]' : 'text-[12px]'} ${highlight ? 'text-[#4ADE80]' : 'text-white'}`}>{value}</span>
    </div>
  );
}

function Bar({ label, v, max, color, unit, signed }: { label: string; v: number; max: number; color: string; unit: string; signed?: boolean }) {
  const pct = Math.min(100, (Math.abs(v) / max) * 100);
  const sign = signed && v > 0.1 ? 'neg' : v < -0.1 ? 'pos' : 'neutral';
  const barColor = sign === 'neg' ? '#EF5350' : color;
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-[10px] font-mono text-[#94A3B8]">
        <span>{label}</span>
        <span className="text-white">{v.toFixed(2)}{unit}</span>
      </div>
      <div className="h-1 bg-[#1E293B] rounded overflow-hidden">
        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  );
}
