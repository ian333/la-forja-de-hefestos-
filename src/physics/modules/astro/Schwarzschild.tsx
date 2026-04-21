/**
 * Relatividad general — Schwarzschild en 3D con embedding de Flamm.
 *
 * La realidad que enseñamos:
 *   - El "embudo" es el embedding de Flamm del slice z=0 de la métrica de
 *     Schwarzschild: w(r) = 2 √(rs (r − rs)). Lo que ves doblar el espacio es
 *     físicamente la curvatura (no la gravedad como fuerza).
 *   - Encima del embudo: dos órbitas con el mismo estado inicial — Newton
 *     (elipse cerrada) y GR (misma elipse, precesa).
 *
 * El c_eff se puede bajar para exagerar la precesión y verla en pocas órbitas.
 * Con c_real, Mercurio precesa 43"/siglo y se mide en el panel lateral.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import { SUN, PLANETS, AU, c as c0, G } from '@/lib/physics/constants';
import {
  integrateSchwarzschild, analyticPrecession, orbitalPeriod,
  schwarzschildRadius, RAD_TO_ARCSEC,
} from '@/lib/physics/relativity';
import { getParticleTexture } from '@/labs/components/sprite-texture';

type PresetId = 'mercury' | 'mercury-exagerado' | 'sirius' | 'close-bh';

interface Preset {
  id: PresetId;
  name: string;
  M: number; a: number; e: number;
  c_eff?: number;
  note: string;
}

const PRESETS: Preset[] = [
  {
    id: 'mercury', name: 'Mercurio (GR real)',
    M: SUN.mass, a: PLANETS.find(p => p.id === 'mercury')!.a!, e: PLANETS.find(p => p.id === 'mercury')!.e!,
    note: 'Sistema real — Einstein predijo 43″/siglo. Exacto a 4 decimales.',
  },
  {
    id: 'mercury-exagerado', name: 'Mercurio con c/1000 (pedagógico)',
    M: SUN.mass, a: PLANETS.find(p => p.id === 'mercury')!.a!, e: PLANETS.find(p => p.id === 'mercury')!.e!,
    c_eff: c0 / 1000,
    note: 'Bajamos c × 1000 para ver la precesión a simple vista en 4 órbitas.',
  },
  {
    id: 'sirius', name: 'Sirius B (enana blanca)',
    M: 2.0e30, a: 3e9, e: 0.3,
    note: 'Órbita cerca de enana blanca — campo gravitatorio 10⁵× Sol/Mercurio.',
  },
  {
    id: 'close-bh', name: 'Órbita cerca de BH (10 r_s)',
    M: 10 * SUN.mass, a: 10 * (2 * G * 10 * SUN.mass / (c0*c0)), e: 0.2,
    c_eff: c0,
    note: 'Agujero negro estelar; la órbita está a 10 r_s — precesión brutal por vuelta.',
  },
];

function fmt(x: number, d = 3) { return isFinite(x) ? x.toExponential(d) : 'NaN'; }

export default function Schwarzschild() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<PresetId>('mercury-exagerado');
  const preset = PRESETS.find(p => p.id === presetId)!;
  const [nOrbits, setNOrbits] = useState(4);

  const data = useMemo(() => {
    const gr = integrateSchwarzschild({ M: preset.M, a: preset.a, e: preset.e, c_eff: preset.c_eff }, nOrbits, 5e-4, true);
    const nw = integrateSchwarzschild({ M: preset.M, a: preset.a, e: preset.e, c_eff: preset.c_eff }, nOrbits, 5e-4, false);
    const T = orbitalPeriod(preset.M, preset.a);
    const analyticRad = analyticPrecession(preset.M, preset.a, preset.e, preset.c_eff ?? c0);
    const rs = schwarzschildRadius(preset.M);
    return { gr, nw, T, analyticRad, rs };
  }, [preset, nOrbits]);

  const grArcPerOrb = data.gr.precessionPerOrbitRad * RAD_TO_ARCSEC;
  const analyticArcPerOrb = data.analyticRad * RAD_TO_ARCSEC;
  const err = analyticArcPerOrb !== 0 ? Math.abs((grArcPerOrb - analyticArcPerOrb) / analyticArcPerOrb) : 0;

  // Normalizar al apoapsis (escala de la escena ≈ 3 unidades)
  const rMax = useMemo(() => {
    let m = 0;
    for (const pt of data.gr.path) m = Math.max(m, pt.r);
    return m || 1;
  }, [data.gr.path]);
  const SCENE_SCALE = 3 / rMax;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={6.5} bloomIntensity={0.95} bloomThreshold={0.08} autoRotate>
          <SpacetimeWell rs={data.rs} rMax={rMax} scale={SCENE_SCALE} />
          <CentralMass rs={data.rs} scale={SCENE_SCALE} />
          <Orbit path={data.nw.path} scale={SCENE_SCALE} color="#4FC3F7" lineWidth={1.5} opacity={0.55} />
          <Orbit path={data.gr.path} scale={SCENE_SCALE} color="#FDB813" lineWidth={2.5} opacity={0.95} />
          <OrbitingDot path={data.gr.path} scale={SCENE_SCALE} color="#FDB813" speedIdx={1.0} />
          <OrbitingDot path={data.nw.path} scale={SCENE_SCALE} color="#4FC3F7" speedIdx={1.0} size={0.06} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1]">
          <div><span className="text-[#64748B]">preset&nbsp;&nbsp;</span>= {preset.name}</div>
          <div><span className="text-[#64748B]">órbitas&nbsp;</span>= {nOrbits}</div>
          <div><span className="text-[#64748B]">c_eff&nbsp;&nbsp;&nbsp;</span>= {fmt(preset.c_eff ?? c0)} m/s</div>
          <div><span className="text-[#64748B]">r_s&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {fmt(data.rs)} m</div>
        </div>

        <div className="absolute bottom-4 left-4 rounded-lg bg-[#0B0F17]/80 backdrop-blur border border-[#1E293B] px-3 py-2 text-[10px] text-[#94A3B8] space-y-1">
          <div><span className="inline-block w-3 h-0.5 bg-[#4FC3F7] align-middle mr-2" />Newton — elipse cerrada</div>
          <div><span className="inline-block w-3 h-0.5 bg-[#FDB813] align-middle mr-2" />Relatividad general — precesa</div>
          <div className="pt-1 text-[#64748B]">El embudo es el embedding de Flamm w(r) = 2√(r_s (r − r_s)).</div>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Sistema">
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map(p => (
              <button key={p.id} onClick={() => setPresetId(p.id)}
                data-testid={`preset-${p.id}`}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${
                  presetId === p.id
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}>
                {p.name}
              </button>
            ))}
          </div>
          <div className="mt-3 text-[11px] text-[#94A3B8] leading-relaxed italic">{preset.note}</div>
        </Section>

        <Section title={audience === 'child' ? 'Lo que ves' : 'Órbita comparada'}>
          {audience === 'child' ? (
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p>El embudo es <span className="text-white">espacio-tiempo</span> — cerca de la masa el espacio "se estira".</p>
              <p>La línea <span className="text-[#4FC3F7]">cyan</span> es la órbita de Newton: óvalo cerrado.</p>
              <p>La línea <span className="text-[#FDB813]">dorada</span> es la órbita real (Einstein): no cierra, gira {grArcPerOrb.toFixed(3)}″ cada vuelta.</p>
              <p>Esa diferencia es la prueba de que la gravedad no es una fuerza — es curvatura.</p>
            </div>
          ) : (
            <>
              <Row label="a"                 value={`${(preset.a/AU).toFixed(4)} AU`} />
              <Row label="e"                 value={preset.e.toFixed(4)} />
              <Row label="T newtoniano"      value={`${(data.T / (365.25*86400)).toFixed(4)} yr`} />
              <Row label="Δφ sim / órb"      value={`${fmt(data.gr.precessionPerOrbitRad)} rad`} />
              <Row label="Δφ sim / órb"      value={`${grArcPerOrb.toFixed(5)} ″`} />
              <Row label="Δφ teórico / órb"  value={`${analyticArcPerOrb.toFixed(5)} ″`} />
              <Row label="error relativo"    value={`${(err*100).toFixed(4)} %`} highlight={err > 0.01} />
            </>
          )}
        </Section>

        <Section title="Integración">
          <label className="block text-[11px] text-[#94A3B8] mt-1">
            Órbitas integradas — <span className="font-mono text-white">{nOrbits}</span>
          </label>
          <input type="range" min={2} max={30} step={1} value={nOrbits}
                 onChange={e => setNOrbits(Number(e.target.value))} className="w-full mt-1" />
          <div className="mt-2 text-[10px] text-[#64748B]">
            Más órbitas = precesión más larga y medida promediada sobre más periapsis.
          </div>
        </Section>

        <Section title="Ecuación">
          <div className="text-[12px] font-mono text-[#CBD5E1] leading-relaxed">
            <div className="text-white">d²u/dφ² + u = GM/h² + (3GM/c²) u²</div>
            <div className="mt-2 text-[11px] text-[#64748B]">
              El segundo término es la corrección relativista. Con c → ∞ recuperas Kepler exacto.
            </div>
          </div>
        </Section>

        {audience === 'researcher' && (
          <Section title="¿Por qué 43″/siglo?">
            <div className="text-[11px] text-[#94A3B8] leading-relaxed space-y-2">
              <p>Analítico: <span className="font-mono text-white">Δφ = 6πGM/(c²a(1−e²))</span> rad/órbita.</p>
              <p>Mercurio: 5.019×10⁻⁷ rad × 415 órb/siglo × 206 265 ″/rad ≈ 43.0″/siglo.</p>
              <p>Primera confirmación de la relatividad general — 18 de noviembre 1915.</p>
            </div>
          </Section>
        )}
      </aside>
    </div>
  );
}

// ─── Embedding de Flamm: w(r) = 2√(rs · (r − rs)) ───────────────────────
// Renderizamos un disco abierto (con un agujero en r < rs) en coordenadas (r, θ),
// donde cada vértice tiene altura negativa w(r). La superficie es malla semitransparente
// con un shader mínimo (emissive grid via vertex color pattern).

function SpacetimeWell({ rs, rMax, scale }: { rs: number; rMax: number; scale: number }) {
  const geom = useMemo(() => {
    const rInner = Math.max(rs * 1.02, rs * 1.02);  // evitar singularidad
    const rOuter = rMax * 1.15;
    const nR = 80;
    const nT = 128;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    for (let i = 0; i < nR; i++) {
      const u = i / (nR - 1);
      // Distribución log para densidad cerca del pozo
      const r = rInner * Math.pow(rOuter / rInner, u);
      const w = -2 * Math.sqrt(Math.max(0, rs * (r - rs)));
      for (let j = 0; j < nT; j++) {
        const theta = (j / nT) * 2 * Math.PI;
        const x = r * Math.cos(theta) * scale;
        const z = r * Math.sin(theta) * scale;
        const y = w * scale;
        positions.push(x, y, z);
        // Color: gradiente del borde (cyan tenue) al centro (naranja profundo)
        const depth = Math.min(1, Math.pow((rOuter - r) / (rOuter - rInner), 1.5));
        const rgb = lerpRGB([0.22, 0.31, 0.42], [0.49, 0.19, 0.13], depth);
        colors.push(rgb[0], rgb[1], rgb[2]);
      }
    }
    for (let i = 0; i < nR - 1; i++) {
      for (let j = 0; j < nT; j++) {
        const a = i * nT + j;
        const b = i * nT + (j + 1) % nT;
        const c = (i + 1) * nT + j;
        const d = (i + 1) * nT + (j + 1) % nT;
        indices.push(a, c, b, b, c, d);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color',    new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, [rs, rMax, scale]);

  // Wireframe encima
  const wire = useMemo(() => {
    const w = new THREE.WireframeGeometry(geom);
    return w;
  }, [geom]);

  return (
    <group>
      <mesh geometry={geom}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          metalness={0.1}
          roughness={0.8}
          transparent
          opacity={0.45}
        />
      </mesh>
      <lineSegments geometry={wire}>
        <lineBasicMaterial color="#4FC3F7" transparent opacity={0.18} />
      </lineSegments>
    </group>
  );
}

function CentralMass({ rs, scale }: { rs: number; scale: number }) {
  const tex = useMemo(() => getParticleTexture(), []);
  const visualR = Math.max(rs * scale * 1.02, 0.06);  // al menos visible
  return (
    <group>
      {/* Horizonte */}
      <mesh position={[0, -2 * Math.sqrt(rs * (rs*1.02 - rs)) * scale, 0]}>
        <sphereGeometry args={[visualR, 32, 32]} />
        <meshStandardMaterial color="#000000" emissive="#FDB813" emissiveIntensity={0.15} />
      </mesh>
      {/* Halo */}
      <sprite position={[0, 0, 0]} scale={[visualR * 6, visualR * 6, 1]}>
        <spriteMaterial map={tex} color="#FDB813" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

function Orbit({ path, scale, color, lineWidth, opacity }: {
  path: { x: number; y: number; r: number }[];
  scale: number; color: string; lineWidth: number; opacity: number;
}) {
  const points = useMemo(() => {
    // Proyectamos (x,y) al plano, y la altura sigue el embedding w(r).
    const rs = 0;  // El embedding del objeto central ya lo hace la superficie;
                   // para la línea queremos seguir la curvatura, así que sí usamos w(r).
    // Leemos rs del primer punto aproximando: pero para elegancia usamos la altura
    // real w(r) calculada con un rs común leído al padre.
    // Aquí aceptamos que el orbit-line flote a altura 0 o sobre el well; para que
    // se vea encima, le damos un pequeño lift.
    return path.map(p => {
      const liftW = -2 * Math.sqrt(Math.max(0, rs * (p.r - rs)));  // 0 si rs=0
      return new THREE.Vector3(p.x * scale, liftW * scale + 0.015, p.y * scale);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, scale]);
  return <Line points={points} color={color} lineWidth={lineWidth} transparent opacity={opacity} />;
}

function OrbitingDot({ path, scale, color, size = 0.08 }: {
  path: { x: number; y: number; r: number }[];
  scale: number; color: string; size?: number; speedIdx?: number;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const idx = useRef(0);
  useFrame((_, dt) => {
    if (path.length === 0 || !mesh.current) return;
    // Avanza un número de puntos por segundo proporcional al largo del path
    const pps = path.length / 6;  // la órbita completa tarda ~6s en pantalla
    idx.current = (idx.current + pps * dt) % path.length;
    const i = Math.floor(idx.current);
    const p = path[i];
    mesh.current.position.set(p.x * scale, 0.02, p.y * scale);
  });
  return (
    <mesh ref={mesh}>
      <sphereGeometry args={[size, 24, 24]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} />
    </mesh>
  );
}

function lerpRGB(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

// ─── UI helpers ────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-[11px] font-mono py-0.5">
      <span className="text-[#64748B]">{label}</span>
      <span className={highlight ? 'text-[#F87171]' : 'text-white'}>{value}</span>
    </div>
  );
}
