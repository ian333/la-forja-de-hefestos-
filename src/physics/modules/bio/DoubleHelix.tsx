/**
 * Doble hélice B-DNA — geometría canónica de Arnott-Hukins / Olson.
 *
 * Render:
 *   - Dos backbones (strand 1 sense, strand 2 antisense) como tubos
 *     Catmull-Rom sobre los fosfatos; esferas emissivas en cada P.
 *   - Base pairs como dos "platos" rectangulares coloreados por base,
 *     con 2 o 3 líneas de puente de hidrógeno entre ellos (A-T = 2, G-C = 3).
 *   - Major / minor groove quedan correctamente asimétricos por el offset
 *     angular de 155° entre strands (ver B_DNA.grooveOffsetDeg).
 *
 * Todo a escala real en ångström — no hay falsificación visual.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import {
  B_DNA,
  BASE_COLOR,
  BRCA1_FRAGMENT,
  HUMAN_TELOMERE_REPEAT,
  TATA_CONTEXT,
  buildDuplex,
  complement,
  gcContent,
  hbondsFor,
  isPurine,
  reverseComplement,
  tmWallace,
  type Base,
} from '@/lib/bio/dna';

interface Preset {
  id: string;
  name: string;
  sequence: string;
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: 'synthetic',
    name: 'Síntesis ATCG×12',
    sequence: 'ATCG'.repeat(12),
    note: 'Secuencia artificial repetitiva — 48 bp, ~4.6 vueltas. Útil para leer la geometría B-form pura.',
  },
  {
    id: 'telomere',
    name: 'Telómero humano (TTAGGG)×8',
    sequence: HUMAN_TELOMERE_REPEAT.repeat(8),
    note: 'Repetición telomérica humana (Blackburn 1978). 48 bp, rica en G → puede formar G-cuádruple in vivo.',
  },
  {
    id: 'tata',
    name: 'Caja TATA (promotor)',
    sequence: TATA_CONTEXT,
    note: 'Consenso TATAAAA del núcleo promotor eucariota. 18 bp. Sitio de unión de TBP / TFIID.',
  },
  {
    id: 'brca1',
    name: 'BRCA1 (exón 11, humano)',
    sequence: BRCA1_FRAGMENT,
    note: '60 bp del CDS de BRCA1 (NM_007294). Humana real — no sintética.',
  },
];

export default function DoubleHelix() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('synthetic');
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [showBackbones, setBackbones] = useState(true);
  const [showBases, setBases] = useState(true);
  const [showHBonds, setHBonds] = useState(true);
  const [showAxis, setAxis] = useState(true);

  const duplex = useMemo(() => buildDuplex(preset.sequence), [preset.sequence]);

  return (
    <div className="grid grid-cols-[1fr_340px] gap-0 h-full">
      <div className="relative">
        <HelixViewport
          duplex={duplex}
          sequence={preset.sequence}
          showBackbones={showBackbones}
          showBases={showBases}
          showHBonds={showHBonds}
          showAxis={showAxis}
        />
        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">preset&nbsp;&nbsp;&nbsp;&nbsp;</span>= {preset.name}</div>
          <div><span className="text-[#64748B]">longitud&nbsp;&nbsp;</span>= {duplex.lengthA.toFixed(1)} Å ({(duplex.lengthA / 10).toFixed(1)} nm)</div>
          <div><span className="text-[#64748B]">vueltas&nbsp;&nbsp;&nbsp;</span>= {duplex.turns.toFixed(2)}</div>
          <div><span className="text-[#64748B]">bp&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {duplex.frames.length}</div>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Secuencia">
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
                {p.name}
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
              <p>Dos hileras de bolitas se enroscan una sobre la otra: eso es el <strong>esqueleto</strong> del DNA.</p>
              <p>Entre ellas hay <strong>escalones</strong> de colores — las letras A, T, G, C. Cada letra solo se pega con su pareja: A↔T (2 hilitos) y G↔C (3 hilitos).</p>
              <p>El surco mayor es el hueco ancho, el menor es el estrecho. Tus genes viven escritos en este código.</p>
            </div>
          </Section>
        ) : (
          <Section title="Geometría B-form (canónica)">
            <Row label="rise/bp"   value={`${B_DNA.rise} Å`} />
            <Row label="twist/bp"  value={`${B_DNA.twistDeg}°`} />
            <Row label="bp/vuelta" value={`${(360 / B_DNA.twistDeg).toFixed(2)}`} />
            <Row label="r P"       value={`${B_DNA.rPhosphate} Å`} />
            <Row label="groove ∠"  value={`${B_DNA.grooveOffsetDeg}° / ${360 - B_DNA.grooveOffsetDeg}°`} />
            <Row label="minor W×D" value={`${B_DNA.minorGrooveWidth}×${B_DNA.minorGrooveDepth} Å`} />
            <Row label="major W×D" value={`${B_DNA.majorGrooveWidth}×${B_DNA.majorGrooveDepth} Å`} />
            <div className="mt-2 text-[10px] text-[#64748B]">
              Arnott-Hukins (1972) / Olson (2001). Strand 2 rotada +155° sobre el eje para el asimétrico major/minor groove.
            </div>
          </Section>
        )}

        <Section title="Estadísticas">
          <Row label="GC%"           value={`${(gcContent(preset.sequence) * 100).toFixed(1)}%`} />
          <Row label="Tm (Wallace)"  value={`${tmWallace(preset.sequence)} °C`} />
          <Row label="Puentes H"     value={`${puentesTotales(preset.sequence)}`} />
        </Section>

        <Section title="Visualización">
          <Toggle value={showBackbones} onChange={setBackbones} label="Cadenas (backbones)" />
          <Toggle value={showBases}     onChange={setBases}     label="Pares de bases" />
          <Toggle value={showHBonds}    onChange={setHBonds}    label="Puentes de H" />
          <Toggle value={showAxis}      onChange={setAxis}      label="Eje helicoidal" />
        </Section>

        <Section title="Secuencia 5'→3'">
          <div className="font-mono text-[10px] leading-snug break-all">
            {preset.sequence.split('').map((c, i) => (
              <span key={i} style={{ color: BASE_COLOR[c as Base] ?? '#64748B' }}>{c}</span>
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] leading-snug break-all opacity-70">
            <span className="text-[#64748B]">compl. 3'→5': </span>
            {complement(preset.sequence).split('').map((c, i) => (
              <span key={i} style={{ color: BASE_COLOR[c as Base] ?? '#64748B' }}>{c}</span>
            ))}
          </div>
          <div className="mt-2 font-mono text-[10px] leading-snug break-all opacity-50">
            <span className="text-[#64748B]">rev-compl. 5'→3': </span>
            {reverseComplement(preset.sequence)}
          </div>
        </Section>
      </aside>
    </div>
  );
}

function puentesTotales(seq: string): number {
  let n = 0;
  for (const c of seq.toUpperCase()) {
    if (c === 'A' || c === 'T' || c === 'G' || c === 'C') n += hbondsFor(c as Base);
  }
  return n;
}

interface DuplexData {
  atoms: ReturnType<typeof buildDuplex>['atoms'];
  frames: ReturnType<typeof buildDuplex>['frames'];
  lengthA: number;
  turns: number;
}

function HelixViewport({
  duplex, sequence, showBackbones, showBases, showHBonds, showAxis,
}: {
  duplex: DuplexData;
  sequence: string;
  showBackbones: boolean;
  showBases: boolean;
  showHBonds: boolean;
  showAxis: boolean;
}) {
  // Pick camera distance based on duplex length so short and long sequences
  // both land in frame. Camera sits on +x, looking along -x at the duplex
  // whose axis is +z; we offset vertically to look at the middle.
  const midZ = duplex.lengthA / 2;
  const camDist = Math.max(45, 1.3 * duplex.lengthA);

  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [camDist, 5, midZ], fov: 38, near: 0.5, far: 1000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[60, 30, midZ]} intensity={1.2} color="#B3E5FC" distance={0} decay={0} />
        <pointLight position={[-50, -20, midZ]} intensity={0.7} color="#FFAB91" distance={0} decay={0} />
        <OrbitControls
          target={[0, 0, midZ]}
          enablePan enableZoom enableRotate enableDamping dampingFactor={0.08}
        />
        <HelixScene
          duplex={duplex}
          sequence={sequence}
          showBackbones={showBackbones}
          showBases={showBases}
          showHBonds={showHBonds}
          showAxis={showAxis}
        />
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.9} luminanceThreshold={0.2} luminanceSmoothing={0.45} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function HelixScene({
  duplex, sequence, showBackbones, showBases, showHBonds, showAxis,
}: {
  duplex: DuplexData;
  sequence: string;
  showBackbones: boolean;
  showBases: boolean;
  showHBonds: boolean;
  showAxis: boolean;
}) {
  const { scene } = useThree();
  const particleTex = useMemo(() => getParticleTexture(), []);
  const rootRef = useRef<THREE.Group>(null);
  const selfRotation = useRef<THREE.Group>(null);

  useEffect(() => {
    const g = rootRef.current!;
    while (g.children.length) {
      const ch = g.children[0];
      g.remove(ch);
      disposeDeep(ch);
    }

    const N = duplex.frames.length;
    const s1Points: THREE.Vector3[] = [];
    const s2Points: THREE.Vector3[] = [];
    for (const a of duplex.atoms) {
      const v = new THREE.Vector3(a.p[0], a.p[1], a.p[2]);
      if (a.strand === 1) s1Points.push(v);
      else s2Points.push(v);
    }

    // --- Backbones (Catmull-Rom tubes + phosphate spheres with halos) ---
    if (showBackbones) {
      const strand1 = makeBackbone(s1Points, '#64B5F6', particleTex);
      const strand2 = makeBackbone(s2Points, '#F06292', particleTex);
      g.add(strand1);
      g.add(strand2);
    }

    // --- Base pairs: two colored plates meeting in the middle of each bp ---
    if (showBases) {
      for (const a of duplex.atoms) {
        const col = BASE_COLOR[a.base];
        // Plate spans from the sugar C1' inward toward the helix axis.
        // Purines project ~1 Å further into the interior (larger ring system).
        const inward = isPurine(a.base) ? 1.2 : 0.6;
        const plateDepth = B_DNA.rSugar - inward;
        const width = B_DNA.rSugar - plateDepth; // radial thickness of plate
        const plate = new THREE.Mesh(
          new THREE.BoxGeometry(width, 3.0, 1.4),
          new THREE.MeshStandardMaterial({
            color: col,
            emissive: new THREE.Color(col),
            emissiveIntensity: 0.7,
            roughness: 0.45,
            metalness: 0.15,
          }),
        );
        // Center the plate on the midpoint between the sugar C1' and the
        // base-edge N1/N9 projection, oriented radially outward.
        const angle = Math.atan2(a.c1[1], a.c1[0]);
        const rCenter = (B_DNA.rSugar + plateDepth) / 2;
        plate.position.set(
          rCenter * Math.cos(angle),
          rCenter * Math.sin(angle),
          a.p[2],
        );
        plate.rotation.z = angle;
        g.add(plate);

        // A subtle halo on each base so the bloom picks them up like the atom lab.
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: particleTex,
          color: new THREE.Color(col),
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }));
        halo.scale.set(2.2, 2.2, 2.2);
        halo.position.copy(plate.position);
        g.add(halo);
      }
    }

    // --- Hydrogen bonds (dashed segments between strand1 base and strand2 base) ---
    if (showHBonds) {
      const frames = duplex.frames;
      for (let i = 0; i < frames.length; i++) {
        const f = frames[i];
        const hb = hbondsFor(f.base1);
        const theta1 = f.theta;
        const theta2 = theta1 + (B_DNA.grooveOffsetDeg * Math.PI) / 180;
        const r1 = B_DNA.rBaseEdge;
        const r2 = B_DNA.rBaseEdge;
        const p1 = new THREE.Vector3(r1 * Math.cos(theta1), r1 * Math.sin(theta1), f.z);
        const p2 = new THREE.Vector3(r2 * Math.cos(theta2), r2 * Math.sin(theta2), f.z);
        // For A-T (2 bonds) draw two parallel lines; for G-C (3 bonds) three.
        for (let b = 0; b < hb; b++) {
          const off = (b - (hb - 1) / 2) * 0.5; // Å vertical offset
          const geom = new THREE.BufferGeometry().setFromPoints([
            p1.clone().add(new THREE.Vector3(0, 0, off)),
            p2.clone().add(new THREE.Vector3(0, 0, off)),
          ]);
          const mat = new THREE.LineDashedMaterial({
            color: 0xFFFFFF,
            dashSize: 0.3,
            gapSize: 0.35,
            transparent: true,
            opacity: 0.55,
          });
          const line = new THREE.Line(geom, mat);
          line.computeLineDistances();
          g.add(line);
        }
      }
    }

    // --- Helix axis ---
    if (showAxis) {
      const axisMat = new THREE.LineDashedMaterial({
        color: 0x4FC3F7, dashSize: 1.2, gapSize: 0.8, transparent: true, opacity: 0.35,
      });
      const axisGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, -3),
        new THREE.Vector3(0, 0, duplex.lengthA + 3),
      ]);
      const axis = new THREE.Line(axisGeom, axisMat);
      axis.computeLineDistances();
      g.add(axis);
    }

    return () => {
      while (g.children.length) {
        const ch = g.children[0];
        g.remove(ch);
        disposeDeep(ch);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, sequence, showBackbones, showBases, showHBonds, showAxis, particleTex]);

  useFrame((_, dt) => {
    // Slow idle rotation so the asymmetry of major/minor groove is always
    // visible in a screenshot without needing user interaction.
    if (selfRotation.current) selfRotation.current.rotation.z += dt * 0.12;
  });

  return (
    <group ref={selfRotation}>
      <group ref={rootRef} />
    </group>
  );
}

function makeBackbone(points: THREE.Vector3[], color: string, haloTex: THREE.Texture): THREE.Group {
  const grp = new THREE.Group();
  if (points.length < 2) return grp;
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(64, points.length * 8), 0.7, 10, false),
    new THREE.MeshStandardMaterial({
      color,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.3,
    }),
  );
  grp.add(tube);

  for (const p of points) {
    const sph = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 20, 20),
      new THREE.MeshStandardMaterial({
        color,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.9,
        roughness: 0.3,
        metalness: 0.4,
      }),
    );
    sph.position.copy(p);
    grp.add(sph);

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: haloTex,
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }));
    halo.scale.set(2.8, 2.8, 2.8);
    halo.position.copy(p);
    grp.add(halo);
  }
  return grp;
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
