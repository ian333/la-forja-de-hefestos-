/**
 * Visor de estructuras PDB estilo ChimeraX / PyMOL.
 *
 * Carga PDB reales del RCSB Protein Data Bank:
 *   - 1UBQ  ubiquitina (76 aa) — la proteína "todo lo etiqueta para degradar"
 *   - 4HHB  hemoglobina humana (4 cadenas + 4 grupos hemo + Fe) — transporte de O₂
 *   - 1HSG  proteasa del VIH con saquinavir — primer fármaco anti-SIDA basado en estructura
 *   - 1CRN  crambina (46 aa) — proteína didáctica ultra-pequeña (X-ray 0.48 Å)
 *
 * Representaciones:
 *   - Cartoon: tubo Catmull-Rom suave sobre Cα, coloreado por estructura
 *     secundaria (α-hélice roja, hoja β amarilla, coil gris-azulado).
 *   - Átomos (CPK): esferas con radio vdW, color por elemento.
 *   - Ligandos (HETATM): siempre stick + sphere, independiente del modo —
 *     son quienes cuentan la historia del fármaco.
 *
 * El PDB se fetch-ea del RCSB bajo demanda (HTTPS con CORS abierto).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import {
  parsePDB, VDW_RADIUS, ELEMENT_COLOR, COVALENT_RADIUS,
  type Structure, type Residue, type Atom, type Element,
} from '@/lib/bio/pdb';

interface Preset {
  id: string;
  pdbId: string;
  name: string;
  subtitle: string;
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: 'ubiquitin', pdbId: '1UBQ',
    name: 'Ubiquitina (1UBQ)',
    subtitle: '76 residuos — etiqueta "degradar"',
    note: 'La etiqueta molecular que marca proteínas para su reciclaje en el proteasoma. Premio Nobel 2004 (Hershko, Ciechanover, Rose).',
  },
  {
    id: 'crambin', pdbId: '1CRN',
    name: 'Crambina (1CRN)',
    subtitle: '46 residuos — cristal a 0.48 Å',
    note: 'Proteína de semilla de la abyssinica. Una de las estructuras de mayor resolución del PDB. Didáctica por su tamaño.',
  },
  {
    id: 'hemoglobin', pdbId: '4HHB',
    name: 'Hemoglobina (4HHB)',
    subtitle: '4 cadenas α₂β₂ + 4 hemo (Fe)',
    note: 'La proteína que transporta O₂ en la sangre. Cada subunidad lleva un grupo hemo con hierro. Un defecto en un residuo = anemia falciforme.',
  },
  {
    id: 'hiv-protease', pdbId: '1HSG',
    name: 'Proteasa VIH + saquinavir (1HSG)',
    subtitle: 'Drug design estructural',
    note: 'La proteasa viral cortada en sus sitios activos, con el primer inhibidor de proteasa aprobado (saquinavir, 1995). Bajó la mortalidad del SIDA a 1/10.',
  },
];

type RepresentationMode = 'cartoon' | 'atoms' | 'cartoon-atoms';

export default function ProteinViewer() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('ubiquitin');
  const preset = PRESETS.find(p => p.id === presetId)!;

  const [structure, setStructure] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<RepresentationMode>('cartoon-atoms');
  const [showLigand, setShowLigand] = useState(true);
  const [showWater, setShowWater] = useState(false);

  useEffect(() => {
    let aborted = false;
    setStructure(null);
    setError(null);
    setLoading(true);
    fetch(`https://files.rcsb.org/download/${preset.pdbId}.pdb`)
      .then(r => {
        if (!r.ok) throw new Error(`RCSB ${r.status}`);
        return r.text();
      })
      .then(text => {
        if (aborted) return;
        const s = parsePDB(text);
        setStructure(s);
        setLoading(false);
      })
      .catch(err => {
        if (aborted) return;
        setError(String(err.message || err));
        setLoading(false);
      });
    return () => { aborted = true; };
  }, [preset.pdbId]);

  const stats = useMemo(() => {
    if (!structure) return null;
    const nAtoms = structure.atoms.length;
    const nAA = structure.chains.reduce((acc, c) => acc + c.residues.length, 0);
    const nChains = structure.chains.length;
    const nHet = structure.hetGroups.filter(h => h.resName !== 'HOH').length;
    const nWater = structure.hetGroups.filter(h => h.resName === 'HOH').length;
    return { nAtoms, nAA, nChains, nHet, nWater };
  }, [structure]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <ProteinViewport
          structure={structure}
          mode={mode}
          showLigand={showLigand}
          showWater={showWater}
        />
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5 max-w-[560px]">
          <div><span className="text-[#64748B]">pdb&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {preset.pdbId}</div>
          <div className="truncate"><span className="text-[#64748B]">nombre&nbsp;&nbsp;</span>= {preset.name}</div>
          {structure?.title && <div className="truncate max-w-[540px]"><span className="text-[#64748B]">título&nbsp;&nbsp;</span>= {structure.title}</div>}
          {stats && (
            <div><span className="text-[#64748B]">átomos&nbsp;&nbsp;</span>= {stats.nAtoms} · aa = {stats.nAA} · cadenas = {stats.nChains} · HET = {stats.nHet}</div>
          )}
          {loading && <div className="text-[#FDB813]">cargando {preset.pdbId} desde RCSB…</div>}
          {error && <div className="text-[#EF5350]">error: {error}</div>}
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Estructura">
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPresetId(p.id)}
                data-testid={`preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  presetId === p.id
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}
              >
                <div>{p.name}</div>
                <div className="text-[10px] text-[#64748B]">{p.subtitle}</div>
              </button>
            ))}
          </div>
          <div className="mt-3 text-[10px] text-[#64748B] leading-relaxed">
            {preset.note}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que ves">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>Una proteína es como un collar muy largo y complicado, hecho de 20 tipos de cuentas (aminoácidos).</p>
              <p>Las <span className="text-[#EF5350]">espirales rojas</span> son <strong>α-hélices</strong>, los <span className="text-[#FFEE58]">listones amarillos</span> son <strong>hojas β</strong>, y el resto son curvas.</p>
              <p>Cada proteína tiene una forma única. Esa forma decide qué hace: transportar oxígeno, digerir comida, atacar virus.</p>
            </div>
          </Section>
        ) : (
          <Section title="Representación">
            <div className="grid grid-cols-1 gap-1.5">
              {(['cartoon', 'cartoon-atoms', 'atoms'] as RepresentationMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`text-left px-3 py-1.5 rounded-md border text-[11px] font-mono transition ${
                    mode === m
                      ? 'bg-[#1E293B] border-[#4FC3F7]/40 text-white'
                      : 'border-[#1E293B] text-[#94A3B8] hover:text-white'
                  }`}
                >
                  {m === 'cartoon' ? 'cartoon (ChimeraX)' : m === 'atoms' ? 'átomos CPK' : 'cartoon + átomos'}
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section title="Filtros">
          <Toggle value={showLigand} onChange={setShowLigand} label="Ligandos / cofactores (HET)" />
          <Toggle value={showWater}  onChange={setShowWater}  label="Aguas cristalográficas" />
        </Section>

        <Section title="Leyenda">
          <LegendRow color="#EF5350" label="α-hélice" />
          <LegendRow color="#FFEE58" label="hoja β" />
          <LegendRow color="#64B5F6" label="coil / loop" />
          <LegendRow color="#8A8A8A" label="C" />
          <LegendRow color="#3050F8" label="N" />
          <LegendRow color="#FF0D0D" label="O" />
          <LegendRow color="#FFFF30" label="S" />
          <LegendRow color="#E06633" label="Fe (hemo)" />
        </Section>

        {stats && (
          <Section title="Contenido">
            <Row label="cadenas"  value={`${stats.nChains}`} />
            <Row label="residuos" value={`${stats.nAA}`} />
            <Row label="átomos"   value={`${stats.nAtoms}`} />
            <Row label="ligandos" value={`${stats.nHet}`} />
            <Row label="aguas"    value={`${stats.nWater}`} />
          </Section>
        )}
      </aside>
    </div>
  );
}

function ProteinViewport({
  structure, mode, showLigand, showWater,
}: {
  structure: Structure | null;
  mode: RepresentationMode;
  showLigand: boolean;
  showWater: boolean;
}) {
  const center = structure?.bbox.center ?? [0, 0, 0];
  const extent = structure
    ? Math.max(
        structure.bbox.max[0] - structure.bbox.min[0],
        structure.bbox.max[1] - structure.bbox.min[1],
        structure.bbox.max[2] - structure.bbox.min[2],
      )
    : 40;
  const camDist = Math.max(40, extent * 2.2);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [center[0] + camDist * 0.6, center[1] + camDist * 0.3, center[2] + camDist * 0.8], fov: 40, near: 0.5, far: 4000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[center[0] + 80, center[1] + 50, center[2] + 40]} intensity={1.2} color="#B3E5FC" distance={0} decay={0} />
        <pointLight position={[center[0] - 60, center[1] - 30, center[2] - 40]} intensity={0.7} color="#FFAB91" distance={0} decay={0} />
        <OrbitControls ref={controlsRef} target={center as [number, number, number]} enablePan enableZoom enableRotate enableDamping dampingFactor={0.08} />
        <CameraFitter
          center={center as [number, number, number]}
          camDist={camDist}
          controlsRef={controlsRef}
          key={structure ? `${center[0].toFixed(1)}|${center[1].toFixed(1)}|${center[2].toFixed(1)}|${camDist.toFixed(1)}` : 'empty'}
        />
        {structure && (
          <ProteinScene
            structure={structure}
            mode={mode}
            showLigand={showLigand}
            showWater={showWater}
          />
        )}
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.85} luminanceThreshold={0.25} luminanceSmoothing={0.4} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

/**
 * The Canvas `camera` prop is only read on mount — when we switch presets,
 * the camera doesn't reposition. This component reads `camera` out of R3F
 * and snaps it to frame the new bbox whenever center/camDist changes.
 * It also resets OrbitControls' target + internal state.
 */
function CameraFitter({
  center, camDist, controlsRef,
}: {
  center: [number, number, number];
  camDist: number;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(
      center[0] + camDist * 0.6,
      center[1] + camDist * 0.3,
      center[2] + camDist * 0.8,
    );
    camera.near = Math.max(0.5, camDist * 0.01);
    camera.far = Math.max(2000, camDist * 40);
    camera.lookAt(center[0], center[1], center[2]);
    camera.updateProjectionMatrix();
    const ctl = controlsRef.current;
    if (ctl) {
      ctl.target.set(center[0], center[1], center[2]);
      ctl.update();
    }
  }, [camera, center, camDist, controlsRef]);
  return null;
}

const SS_COLOR: Record<'H' | 'E' | 'L', string> = {
  H: '#EF5350', // α-helix: red
  E: '#FFEE58', // β-sheet: yellow
  L: '#64B5F6', // coil: blue
};

function ProteinScene({
  structure, mode, showLigand, showWater,
}: {
  structure: Structure;
  mode: RepresentationMode;
  showLigand: boolean;
  showWater: boolean;
}) {
  const rootRef = useRef<THREE.Group>(null);
  const particleTex = useMemo(() => getParticleTexture(), []);
  const selfRotRef = useRef<THREE.Group>(null);

  useEffect(() => {
    const g = rootRef.current!;
    while (g.children.length) {
      const c = g.children[0];
      g.remove(c);
      disposeDeep(c);
    }

    const showCartoon = mode === 'cartoon' || mode === 'cartoon-atoms';
    const showAtoms   = mode === 'atoms'   || mode === 'cartoon-atoms';

    // --- Cartoon: smooth tube through Cα with color by SS ---
    if (showCartoon) {
      for (const chain of structure.chains) {
        const caList: { pos: THREE.Vector3; ss: 'H' | 'E' | 'L'; idx: number }[] = [];
        let idx = 0;
        for (const res of chain.residues) {
          const ca = res.atoms.find(a => a.name === 'CA' && a.element === 'C');
          if (ca) caList.push({ pos: new THREE.Vector3(...ca.pos), ss: res.ss, idx: idx++ });
        }
        if (caList.length < 2) continue;
        const curve = new THREE.CatmullRomCurve3(caList.map(c => c.pos), false, 'catmullrom', 0.5);
        // We rebuild the tube as short segments (each between adjacent Cα) so
        // we can color it per-secondary-structure. Full-tube-with-vertex-colors
        // is possible but fiddly — short segments are simpler and still smooth
        // when the tube segments share endpoints.
        const segments = Math.max(caList.length * 6, 64);
        const tubeGeom = new THREE.TubeGeometry(curve, segments, 0.85, 10, false);
        // Build vertex colors by sampling ss at each segment
        const colors = new Float32Array(tubeGeom.attributes.position.count * 3);
        for (let i = 0; i < tubeGeom.attributes.position.count; i++) {
          const u = i / tubeGeom.attributes.position.count;
          const caIdx = Math.min(caList.length - 1, Math.floor(u * caList.length));
          const col = new THREE.Color(SS_COLOR[caList[caIdx].ss]);
          colors[i*3+0] = col.r; colors[i*3+1] = col.g; colors[i*3+2] = col.b;
        }
        tubeGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        const tubeMat = new THREE.MeshStandardMaterial({
          vertexColors: true,
          emissive: new THREE.Color(0x331111),
          emissiveIntensity: 0.35,
          roughness: 0.45,
          metalness: 0.25,
        });
        const tube = new THREE.Mesh(tubeGeom, tubeMat);
        g.add(tube);
      }
    }

    // --- Atoms: CPK spheres (van der Waals radii) ---
    if (showAtoms) {
      // Group atoms by element so we can use InstancedMesh (huge perf win for
      // multi-thousand-atom structures like hemoglobin).
      const byElement = new Map<Element, Atom[]>();
      for (const a of structure.atoms) {
        if (a.hetero && a.resName === 'HOH' && !showWater) continue;
        if (a.hetero && a.resName !== 'HOH' && !showLigand) continue;
        let list = byElement.get(a.element);
        if (!list) { list = []; byElement.set(a.element, list); }
        list.push(a);
      }
      const tmp = new THREE.Object3D();
      for (const [elt, list] of byElement) {
        const color = ELEMENT_COLOR[elt] ?? '#AAAAAA';
        const r = (VDW_RADIUS[elt] ?? 1.6) * 0.35; // scale down to 35% vdW so structures stay legible
        const geom = new THREE.SphereGeometry(r, 16, 16);
        const mat = new THREE.MeshStandardMaterial({
          color,
          emissive: new THREE.Color(color),
          emissiveIntensity: 0.4,
          roughness: 0.4,
          metalness: 0.2,
        });
        const mesh = new THREE.InstancedMesh(geom, mat, list.length);
        for (let i = 0; i < list.length; i++) {
          tmp.position.set(list[i].pos[0], list[i].pos[1], list[i].pos[2]);
          tmp.updateMatrix();
          mesh.setMatrixAt(i, tmp.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
        g.add(mesh);
      }
    }

    // --- Ligands (always as sticks + spheres so they pop visually, regardless of mode) ---
    if (showLigand) {
      for (const het of structure.hetGroups) {
        if (het.resName === 'HOH') continue;
        // Atoms as spheres
        for (const a of het.atoms) {
          const color = ELEMENT_COLOR[a.element] ?? '#AAAAAA';
          const r = (VDW_RADIUS[a.element] ?? 1.6) * 0.45;
          const mat = new THREE.MeshStandardMaterial({
            color,
            emissive: new THREE.Color(color),
            emissiveIntensity: 0.7,
            roughness: 0.35,
            metalness: 0.25,
          });
          const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 20), mat);
          m.position.set(a.pos[0], a.pos[1], a.pos[2]);
          g.add(m);
          // Sprite halo for bloom pickup
          const halo = new THREE.Sprite(new THREE.SpriteMaterial({
            map: particleTex,
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }));
          halo.scale.set(r * 6, r * 6, r * 6);
          halo.position.copy(m.position);
          g.add(halo);
        }
        // Bonds inferred by distance (covalent radii sum × 1.25 tolerance)
        const atoms = het.atoms;
        for (let i = 0; i < atoms.length; i++) {
          for (let j = i + 1; j < atoms.length; j++) {
            const a = atoms[i], b = atoms[j];
            const ra = COVALENT_RADIUS[a.element] ?? 1.0;
            const rb = COVALENT_RADIUS[b.element] ?? 1.0;
            const cutoff = (ra + rb) * 1.25;
            const dx = a.pos[0] - b.pos[0], dy = a.pos[1] - b.pos[1], dz = a.pos[2] - b.pos[2];
            const d = Math.sqrt(dx*dx + dy*dy + dz*dz);
            if (d > 0.4 && d < cutoff) {
              const mid = new THREE.Vector3(
                (a.pos[0] + b.pos[0]) / 2,
                (a.pos[1] + b.pos[1]) / 2,
                (a.pos[2] + b.pos[2]) / 2,
              );
              const dir = new THREE.Vector3(b.pos[0]-a.pos[0], b.pos[1]-a.pos[1], b.pos[2]-a.pos[2]).normalize();
              const cyl = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.18, d, 10),
                new THREE.MeshStandardMaterial({
                  color: '#DDDDDD',
                  emissive: new THREE.Color('#888888'),
                  emissiveIntensity: 0.4,
                  roughness: 0.5, metalness: 0.2,
                }),
              );
              cyl.position.copy(mid);
              cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
              g.add(cyl);
            }
          }
        }
      }
    }

    // --- Waters (tiny transparent dots) ---
    if (showWater) {
      const list = structure.hetGroups.filter(h => h.resName === 'HOH');
      const geom = new THREE.SphereGeometry(0.35, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: '#BBDEFB', emissive: new THREE.Color('#64B5F6'), emissiveIntensity: 0.3,
        transparent: true, opacity: 0.55, roughness: 0.2, metalness: 0.1,
      });
      const mesh = new THREE.InstancedMesh(geom, mat, list.length);
      const tmp = new THREE.Object3D();
      for (let i = 0; i < list.length; i++) {
        const atom = list[i].atoms[0]; if (!atom) continue;
        tmp.position.set(atom.pos[0], atom.pos[1], atom.pos[2]);
        tmp.updateMatrix();
        mesh.setMatrixAt(i, tmp.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      g.add(mesh);
    }

    return () => {
      while (g.children.length) {
        const c = g.children[0];
        g.remove(c);
        disposeDeep(c);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structure, mode, showLigand, showWater, particleTex]);

  useFrame((_, dt) => {
    if (selfRotRef.current) selfRotRef.current.rotation.y += dt * 0.08;
  });

  // Recenter & auto-rotate around bbox center so everything is visible.
  const center = structure.bbox.center;
  return (
    <group ref={selfRotRef} position={[center[0], center[1], center[2]]}>
      <group position={[-center[0], -center[1], -center[2]]} ref={rootRef} />
    </group>
  );
}

function disposeDeep(obj: THREE.Object3D) {
  obj.traverse(child => {
    const mesh = child as THREE.Mesh & { material?: THREE.Material | THREE.Material[] };
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      if (Array.isArray(mesh.material)) mesh.material.forEach(m => m.dispose());
      else mesh.material.dispose();
    }
  });
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className="text-white">{value}</span>
    </div>
  );
}
function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 py-1 cursor-pointer text-[12px] text-[#CBD5E1]">
      <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} className="accent-[#4FC3F7]" />
      {label}
    </label>
  );
}
function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-mono py-0.5">
      <span className="w-3 h-3 rounded-sm" style={{ background: color, boxShadow: `0 0 6px ${color}88` }} />
      <span className="text-[#CBD5E1]">{label}</span>
    </div>
  );
}
