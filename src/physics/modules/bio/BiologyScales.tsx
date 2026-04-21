/**
 * Zoom multi-escala de la biología molecular — de célula a par de bases.
 *
 * Siete niveles (~ Powers of Ten de Eames, pero adentro de la célula):
 *   0: célula eucariota (~20 µm)
 *   1: núcleo              (~6 µm)
 *   2: cromosoma metafase  (~1.4 µm)
 *   3: fibra 30 nm         (~30 nm)
 *   4: nucleosoma          (~11 nm)
 *   5: doble hélice B      (~2 nm)
 *   6: par de bases        (~1 nm / 10 Å)
 *
 * Cada nivel se renderiza como su propia escena 3D. Al cambiar el slider
 * el fondo cross-fade entre escenas usando opacidad para dar sensación
 * de zoom continuo, y una cinta de barra de escala traduce "unidad en
 * pantalla = X metros" en todo momento.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import { BIO_SCALES, formatLength, getScale } from '@/lib/bio/scales';
import { BASE_COLOR, buildDuplex } from '@/lib/bio/dna';

export default function BiologyScales() {
  const { audience } = useAudience();
  const [level, setLevel] = useState(0);
  const scale = getScale(level);

  return (
    <div className="grid grid-cols-[1fr_360px] gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0">
        <ScalesViewport level={level} />

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div>
            <span className="text-[#64748B]">nivel&nbsp;&nbsp;&nbsp;&nbsp;</span>
            = <span style={{ color: scale.accent }}>{scale.name}</span>
          </div>
          <div><span className="text-[#64748B]">tamaño&nbsp;&nbsp;&nbsp;</span>= {formatLength(scale.sizeM)}</div>
          <div><span className="text-[#64748B]">Å&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {scale.sizeA.toExponential(2)}</div>
        </div>

        {/* Botones de navegación */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-3 py-2">
          <button
            onClick={() => setLevel(Math.max(0, level - 1))}
            disabled={level === 0}
            className="px-3 py-1 rounded border border-[#334155] text-[12px] text-white hover:border-[#4FC3F7] disabled:opacity-30"
          >
            ← alejar
          </button>
          <span className="text-[11px] text-[#64748B] font-mono px-2">
            {level + 1}/{BIO_SCALES.length}
          </span>
          <button
            onClick={() => setLevel(Math.min(BIO_SCALES.length - 1, level + 1))}
            disabled={level === BIO_SCALES.length - 1}
            className="px-3 py-1 rounded border border-[#334155] text-[12px] text-white hover:border-[#4FC3F7] disabled:opacity-30"
          >
            acercar →
          </button>
        </div>
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Ruta de zoom">
          <div className="grid grid-cols-1 gap-1">
            {BIO_SCALES.map((s, i) => (
              <button
                key={s.id}
                data-testid={`preset-${s.id}`}
                onClick={() => setLevel(i)}
                className={`text-left px-3 py-2 rounded-md border text-[12px] transition flex items-center justify-between ${
                  i === level
                    ? 'bg-gradient-to-br from-[#1E40AF]/30 to-[#7E22CE]/30 border-[#4FC3F7]/40 text-white'
                    : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'
                }`}
                style={i === level ? { borderColor: s.accent } : undefined}
              >
                <span>{i + 1}. {s.name}</span>
                <span className="text-[#64748B] font-mono text-[10px]">{formatLength(s.sizeM)}</span>
              </button>
            ))}
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="¿Qué estamos viendo?">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed">
              {scale.body}
            </div>
          </Section>
        ) : (
          <>
            <Section title="Descripción">
              <div className="text-[11px] text-[#CBD5E1] leading-relaxed">
                {scale.body}
              </div>
            </Section>
            <Section title="Datos duros">
              <div className="text-[10px] text-[#64748B] leading-relaxed font-mono">
                {scale.fact}
              </div>
            </Section>
          </>
        )}

        <Section title="Factor de compactación">
          <div className="text-[11px] text-[#CBD5E1] leading-relaxed">
            Si desenrollaras todo el DNA de una sola célula humana mediría
            ~2 m. La célula mide 20 µm. El DNA tiene que comprimirse un factor
            <span className="text-[#FFCA28] font-mono"> 10⁵</span> en volumen
            para caber — eso es lo que hacen cada uno de los niveles que ves
            aquí.
          </div>
        </Section>

        <Section title="Powers of Ten">
          <div className="text-[10px] text-[#64748B] leading-relaxed">
            Inspiración: la película de Charles &amp; Ray Eames (1977) que
            va de la galaxia al átomo factor 10 a la vez. Aquí hacemos lo
            mismo adentro de una célula humana — 4 órdenes de magnitud en
            longitud, 12 en volumen.
          </div>
        </Section>
      </aside>
    </div>
  );
}

// ------------------------- viewport & scenes -------------------------

// Distancia de cámara característica por nivel (en las unidades de la escena,
// que son "world units" ~ proporcionales a la magnitud del objeto principal).
const CAM_DIST = [165, 95, 95, 75, 26, 80, 24];

function ScalesViewport({ level }: { level: number }) {
  const controlsRef = useRef<any>(null);
  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [0, 0, CAM_DIST[0]], fov: 40, near: 0.1, far: 5000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <CameraFitter level={level} controlsRef={controlsRef} />
        <ambientLight intensity={0.35} />
        <pointLight position={[60, 40, 80]} intensity={1.3} color="#B3E5FC" distance={0} decay={0} />
        <pointLight position={[-50, -30, 50]} intensity={0.7} color="#FFAB91" distance={0} decay={0} />
        <OrbitControls ref={controlsRef} target={[0, 0, 0]} enablePan enableZoom enableRotate enableDamping dampingFactor={0.08} />
        <ActiveScene level={level} />
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.9} luminanceThreshold={0.22} luminanceSmoothing={0.45} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function CameraFitter({ level, controlsRef }: { level: number; controlsRef: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  useEffect(() => {
    const d = CAM_DIST[level] ?? 80;
    camera.position.set(0, 0, d);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const c = controlsRef.current;
    if (c) {
      c.target.set(0, 0, 0);
      c.update();
    }
  }, [level, camera, controlsRef]);
  return null;
}

function ActiveScene({ level }: { level: number }) {
  switch (level) {
    case 0: return <CellScene />;
    case 1: return <NucleusScene />;
    case 2: return <ChromosomeScene />;
    case 3: return <ChromatinScene />;
    case 4: return <NucleosomeScene />;
    case 5: return <HelixScene />;
    case 6: return <BasePairScene />;
    default: return null;
  }
}

function useParticle() {
  return useMemo(() => getParticleTexture(), []);
}

function Rotator({ children, speed = 0.08 }: { children: React.ReactNode; speed?: number }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += dt * speed; });
  return <group ref={ref}>{children}</group>;
}

// Nivel 0 — célula entera. Membrana ~ esfera translúcida con organelos dentro.
function CellScene() {
  const tex = useParticle();
  const organelles = useMemo(() => {
    // Posiciones pseudo-aleatorias estables para mitocondrias + RE.
    const seed = 1.7;
    const rng = (i: number) => {
      const v = Math.sin(i * seed) * 43758.5453;
      return v - Math.floor(v);
    };
    const out: { kind: 'mito' | 'er'; pos: [number, number, number]; rot: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const r = 20 + rng(i) * 14;
      const phi = rng(i * 3 + 1) * Math.PI * 2;
      const costh = rng(i * 5 + 2) * 1.6 - 0.8;
      const sinth = Math.sqrt(1 - costh * costh);
      out.push({
        kind: 'mito',
        pos: [r * sinth * Math.cos(phi), r * costh * 0.4, r * sinth * Math.sin(phi)],
        rot: rng(i * 11 + 7) * Math.PI,
      });
    }
    for (let i = 0; i < 10; i++) {
      const r = 15 + rng(i + 50) * 12;
      const phi = rng(i * 7 + 33) * Math.PI * 2;
      out.push({
        kind: 'er',
        pos: [r * Math.cos(phi), (rng(i + 77) - 0.5) * 8, r * Math.sin(phi)],
        rot: rng(i + 99) * Math.PI,
      });
    }
    return out;
  }, []);

  return (
    <Rotator speed={0.05}>
      {/* Membrana plasmática — esfera grande translúcida con halo */}
      <mesh>
        <sphereGeometry args={[40, 48, 48]} />
        <meshStandardMaterial
          color="#1E88E5" emissive="#0D47A1" emissiveIntensity={0.2}
          transparent opacity={0.08} roughness={0.6}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[40.5, 48, 48]} />
        <meshBasicMaterial color="#4FC3F7" wireframe transparent opacity={0.2} />
      </mesh>
      {/* Núcleo */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[12, 32, 32]} />
        <meshStandardMaterial
          color="#7E57C2" emissive="#512DA8" emissiveIntensity={0.55}
          transparent opacity={0.75} roughness={0.4}
        />
      </mesh>
      <sprite scale={[28, 28, 28]}>
        <spriteMaterial map={tex} color="#B39DDB" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>

      {/* Mitocondrias y RE */}
      {organelles.map((o, i) => (
        <group key={i} position={o.pos} rotation={[0, o.rot, 0]}>
          {o.kind === 'mito' ? (
            <mesh>
              <capsuleGeometry args={[1.6, 4.5, 8, 16]} />
              <meshStandardMaterial color="#FF7043" emissive="#BF360C" emissiveIntensity={0.5} roughness={0.4} />
            </mesh>
          ) : (
            <mesh>
              <torusGeometry args={[2.2, 0.5, 8, 20]} />
              <meshStandardMaterial color="#26A69A" emissive="#004D40" emissiveIntensity={0.4} roughness={0.5} />
            </mesh>
          )}
        </group>
      ))}
    </Rotator>
  );
}

// Nivel 1 — núcleo. Doble membrana con poros + cromatina difusa adentro.
function NucleusScene() {
  const tex = useParticle();
  const pores = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 36; i++) {
      const phi = (i / 6) * Math.PI * 2 + i * 0.1;
      const costh = Math.sin(i * 0.9);
      const sinth = Math.sqrt(1 - costh * costh);
      const r = 28;
      out.push([r * sinth * Math.cos(phi), r * costh, r * sinth * Math.sin(phi)]);
    }
    return out;
  }, []);
  const chromatinBlobs = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < 40; i++) {
      const a = i * 2.39996;
      const r = 14 + (Math.sin(i * 1.3)) * 6;
      out.push([r * Math.cos(a), Math.sin(i * 0.7) * 10, r * Math.sin(a)]);
    }
    return out;
  }, []);

  return (
    <Rotator speed={0.06}>
      {/* Membrana externa */}
      <mesh>
        <sphereGeometry args={[28, 48, 48]} />
        <meshStandardMaterial color="#7E57C2" emissive="#4527A0" emissiveIntensity={0.35} transparent opacity={0.15} />
      </mesh>
      {/* Membrana interna */}
      <mesh>
        <sphereGeometry args={[25.5, 48, 48]} />
        <meshStandardMaterial color="#5C6BC0" emissive="#283593" emissiveIntensity={0.25} transparent opacity={0.18} />
      </mesh>
      {/* Poros nucleares como anillos coloreados */}
      {pores.map((p, i) => (
        <Pore key={i} position={p} />
      ))}
      {/* Cromatina — blobs rosados difusos */}
      {chromatinBlobs.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <sphereGeometry args={[2.2 + (i % 3) * 0.4, 20, 20]} />
            <meshStandardMaterial color="#F48FB1" emissive="#AD1457" emissiveIntensity={0.45} roughness={0.4} />
          </mesh>
          <sprite scale={[6, 6, 6]}>
            <spriteMaterial map={tex} color="#F8BBD0" transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      ))}
    </Rotator>
  );
}

function Pore({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.Mesh>(null);
  const rot = useMemo(() => {
    const dir = new THREE.Vector3(...position).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const e = new THREE.Euler().setFromQuaternion(q);
    return [e.x, e.y, e.z] as [number, number, number];
  }, [position]);
  return (
    <mesh ref={ref} position={position} rotation={rot}>
      <torusGeometry args={[1.6, 0.4, 8, 16]} />
      <meshStandardMaterial color="#FFCA28" emissive="#FF8F00" emissiveIntensity={1.0} />
    </mesh>
  );
}

// Nivel 2 — cromosoma metafase. Forma de X, 2 cromátidas unidas por centrómero.
function ChromosomeScene() {
  return (
    <Rotator speed={0.08}>
      {/* Dos brazos largos por cromátida (4 brazos en total) */}
      <Chromatid rot={[0, 0, 0.12]} color="#F06292" />
      <Chromatid rot={[0, 0, -0.12]} color="#EC407A" />
      {/* Centrómero — unión en el medio */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[3.5, 24, 24]} />
        <meshStandardMaterial color="#FFCA28" emissive="#FF8F00" emissiveIntensity={1.0} />
      </mesh>
    </Rotator>
  );
}

function Chromatid({ rot, color }: { rot: [number, number, number]; color: string }) {
  // Forma de elipsoide alargado arriba + otro abajo, separadas por el centrómero.
  return (
    <group rotation={rot}>
      <mesh position={[0, 12, 0]}>
        <capsuleGeometry args={[3.5, 14, 16, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.45} />
      </mesh>
      <mesh position={[0, -12, 0]}>
        <capsuleGeometry args={[3.5, 14, 16, 24]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.45} />
      </mesh>
    </group>
  );
}

// Nivel 3 — fibra de cromatina: "beads on a string" enrollada.
function ChromatinScene() {
  const beads = useMemo(() => {
    const n = 30;
    const pts: [number, number, number][] = [];
    // Zigzag helicoidal que sugiere el 2-start de la fibra 30 nm.
    for (let i = 0; i < n; i++) {
      const t = i / n * Math.PI * 6;
      const r = 12;
      const x = r * Math.cos(t);
      const z = r * Math.sin(t);
      const y = (i - n / 2) * 1.3;
      pts.push([x, y, z]);
    }
    return pts;
  }, []);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(
    beads.map(p => new THREE.Vector3(...p))
  ), [beads]);
  const tubeGeom = useMemo(() => new THREE.TubeGeometry(curve, 120, 0.5, 10, false), [curve]);

  return (
    <Rotator speed={0.1}>
      {/* Linker DNA entre nucleosomas como tubo */}
      <mesh geometry={tubeGeom}>
        <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
      {/* Nucleosomas como "cuentas" */}
      {beads.map((p, i) => (
        <group key={i} position={p}>
          <mesh>
            <sphereGeometry args={[2.2, 20, 20]} />
            <meshStandardMaterial color="#F48FB1" emissive="#AD1457" emissiveIntensity={0.55} roughness={0.4} />
          </mesh>
          <mesh>
            <torusGeometry args={[2.4, 0.4, 10, 24]} />
            <meshStandardMaterial color="#4FC3F7" emissive="#4FC3F7" emissiveIntensity={0.6} />
          </mesh>
        </group>
      ))}
    </Rotator>
  );
}

// Nivel 4 — un solo nucleosoma. Disco con DNA enrollado 1.65 vueltas.
function NucleosomeScene() {
  const tex = useParticle();
  const dnaPoints = useMemo(() => {
    const turns = 1.65;
    const n = 200;
    const pts: THREE.Vector3[] = [];
    const r = 5.0;
    const height = 4.5;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const theta = t * turns * Math.PI * 2;
      const y = (t - 0.5) * height;
      pts.push(new THREE.Vector3(r * Math.cos(theta), y, r * Math.sin(theta)));
    }
    return pts;
  }, []);
  const dnaTube = useMemo(
    () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(dnaPoints), 256, 0.5, 12, false),
    [dnaPoints],
  );

  return (
    <Rotator speed={0.12}>
      {/* Octámero de histonas — cilindro aplanado */}
      <mesh>
        <cylinderGeometry args={[4.2, 4.2, 3.2, 48]} />
        <meshStandardMaterial color="#F48FB1" emissive="#AD1457" emissiveIntensity={0.35} roughness={0.5} />
      </mesh>
      {/* 4 dímeros internos sugeridos como 4 esferas */}
      {[0, 1, 2, 3].map(i => {
        const a = (i / 4) * Math.PI * 2;
        return (
          <mesh key={i} position={[2.2 * Math.cos(a), 0, 2.2 * Math.sin(a)]}>
            <sphereGeometry args={[1.5, 20, 20]} />
            <meshStandardMaterial color="#CE93D8" emissive="#7B1FA2" emissiveIntensity={0.7} />
          </mesh>
        );
      })}
      {/* DNA enrollado */}
      <mesh geometry={dnaTube}>
        <meshStandardMaterial color="#64B5F6" emissive="#1565C0" emissiveIntensity={0.6} roughness={0.4} />
      </mesh>
      <sprite scale={[18, 18, 18]}>
        <spriteMaterial map={tex} color="#F8BBD0" transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </Rotator>
  );
}

// Nivel 5 — doble hélice B con ~20 bp.
function HelixScene() {
  const duplex = useMemo(() => buildDuplex('ATCGATCGATCGATCGATCG'), []);
  const tex = useParticle();
  const dnaGroup = useMemo(() => {
    const g = new THREE.Group();
    const s1: THREE.Vector3[] = [];
    const s2: THREE.Vector3[] = [];
    for (const a of duplex.atoms) {
      const v = new THREE.Vector3(a.p[0], a.p[2] - duplex.lengthA / 2, a.p[1]);
      if (a.strand === 1) s1.push(v);
      else s2.push(v);
    }
    const mk = (pts: THREE.Vector3[], color: string) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      const mesh = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 128, 0.7, 12, false),
        new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.3 }),
      );
      return mesh;
    };
    g.add(mk(s1, '#64B5F6'));
    g.add(mk(s2, '#F06292'));
    // Base plates
    for (const a of duplex.atoms) {
      const color = BASE_COLOR[a.base];
      const angle = Math.atan2(a.c1[1], a.c1[0]);
      const r = 3.5;
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(3.0, 1.4, 0.6),
        new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 0.7 }),
      );
      plate.position.set(r * Math.cos(angle), a.p[2] - duplex.lengthA / 2, r * Math.sin(angle));
      plate.rotation.y = -angle;
      g.add(plate);
    }
    return g;
  }, [duplex]);

  return (
    <Rotator speed={0.1}>
      <primitive object={dnaGroup} />
      <sprite scale={[30, 30, 30]}>
        <spriteMaterial map={tex} color="#4FC3F7" transparent opacity={0.2} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </Rotator>
  );
}

// Nivel 6 — par de bases A-T a nivel atómico (simplificado).
function BasePairScene() {
  // Posiciones aproximadas de los átomos clave en un par A-T en B-form.
  // Los tomamos del nucleótido estándar (Olson 2001) con reducción al plano y-z.
  // No necesitamos coordenadas exactas — solo la INTUICIÓN de átomos + H-bonds.
  const ATOMS: { el: 'C' | 'N' | 'O' | 'H'; pos: [number, number, number]; r: number; col: string }[] = [
    // Adenina (izquierda) — anillo de 6 + anillo de 5
    { el: 'N', pos: [-2.0,  1.3, 0], r: 0.55, col: '#3F51B5' },
    { el: 'C', pos: [-3.3,  1.6, 0], r: 0.55, col: '#616161' },
    { el: 'N', pos: [-4.0,  0.5, 0], r: 0.55, col: '#3F51B5' },
    { el: 'C', pos: [-3.4, -0.7, 0], r: 0.55, col: '#616161' },
    { el: 'C', pos: [-2.0, -0.8, 0], r: 0.55, col: '#616161' },
    { el: 'C', pos: [-1.2,  0.4, 0], r: 0.55, col: '#616161' },
    { el: 'N', pos: [-3.7,  2.8, 0], r: 0.55, col: '#3F51B5' },
    { el: 'N', pos: [-4.0, -1.9, 0], r: 0.55, col: '#3F51B5' },
    { el: 'C', pos: [-5.0, -1.2, 0], r: 0.55, col: '#616161' },
    { el: 'N', pos: [-5.3,  0.2, 0], r: 0.55, col: '#3F51B5' },

    // Timina (derecha)
    { el: 'N', pos: [ 1.6,  1.2, 0], r: 0.55, col: '#3F51B5' },
    { el: 'C', pos: [ 2.8,  0.5, 0], r: 0.55, col: '#616161' },
    { el: 'N', pos: [ 2.7, -0.9, 0], r: 0.55, col: '#3F51B5' },
    { el: 'C', pos: [ 1.5, -1.6, 0], r: 0.55, col: '#616161' },
    { el: 'C', pos: [ 0.3, -1.0, 0], r: 0.55, col: '#616161' },
    { el: 'C', pos: [ 0.4,  0.5, 0], r: 0.55, col: '#616161' },
    { el: 'O', pos: [ 3.9,  1.1, 0], r: 0.55, col: '#D32F2F' },
    { el: 'O', pos: [ 1.7, -2.8, 0], r: 0.55, col: '#D32F2F' },
    { el: 'C', pos: [-0.9,  1.2, 0], r: 0.55, col: '#616161' }, // methyl

    // H-bond donors (N-H)
    { el: 'H', pos: [-3.1,  2.0, 0], r: 0.3, col: '#BDBDBD' },
    { el: 'H', pos: [ 1.7,  2.1, 0], r: 0.3, col: '#BDBDBD' },
  ];
  const BONDS: [number, number][] = [
    // Adenina intra-anillo
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0],
    [1, 6], [3, 7], [7, 8], [8, 9], [9, 2],
    // Timina intra-anillo
    [10, 11], [11, 12], [12, 13], [13, 14], [14, 15], [15, 10],
    [11, 16], [13, 17], [15, 18],
  ];
  // Enlaces de hidrógeno A-T (2 bonds)
  const HBONDS: [number, number][] = [
    [19, 10], // A-N1-H → T-N3-H? — approximate for visual
    [20, 17], // T-O4...H-N
  ];

  const tex = useParticle();

  return (
    <Rotator speed={0.15}>
      {/* Átomos */}
      {ATOMS.map((a, i) => (
        <group key={i} position={a.pos}>
          <mesh>
            <sphereGeometry args={[a.r, 20, 20]} />
            <meshStandardMaterial color={a.col} emissive={a.col} emissiveIntensity={0.85} roughness={0.3} metalness={0.3} />
          </mesh>
          <sprite scale={[a.r * 3.5, a.r * 3.5, a.r * 3.5]}>
            <spriteMaterial map={tex} color={a.col} transparent opacity={0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
          </sprite>
        </group>
      ))}
      {/* Enlaces covalentes — cilindros delgados */}
      {BONDS.map(([i, j], k) => (
        <BondCyl key={`b${k}`} a={ATOMS[i].pos} b={ATOMS[j].pos} color="#90A4AE" radius={0.12} />
      ))}
      {/* H-bonds dashed (usamos un cilindro semitransparente blanco) */}
      {HBONDS.map(([i, j], k) => (
        <BondCyl key={`h${k}`} a={ATOMS[i].pos} b={ATOMS[j].pos} color="#FFFFFF" radius={0.06} opacity={0.5} />
      ))}
    </Rotator>
  );
}

function BondCyl({
  a, b, color, radius, opacity = 1,
}: {
  a: [number, number, number]; b: [number, number, number];
  color: string; radius: number; opacity?: number;
}) {
  const { mid, len, rot } = useMemo(() => {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const midV = va.clone().add(vb).multiplyScalar(0.5);
    const dir = vb.clone().sub(va);
    const length = dir.length();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    return {
      mid: [midV.x, midV.y, midV.z] as [number, number, number],
      len: length,
      rot: [e.x, e.y, e.z] as [number, number, number],
    };
  }, [a, b]);

  return (
    <mesh position={mid} rotation={rot}>
      <cylinderGeometry args={[radius, radius, len, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

// ------------------------- sidebar helpers -------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 border-b border-[#1E293B]">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>
      {children}
    </div>
  );
}
