/**
 * Dogma central: DNA → mRNA → proteína.
 *
 * Visualización en 3 carriles horizontales:
 *   1. DNA (doble hélice corta sobre +x)
 *   2. RNA polimerasa moviéndose, mRNA creciendo hacia la derecha
 *   3. Ribosoma (esferas grande/pequeña) leyendo el mRNA, cadena proteica creciendo
 *
 * El estado lógico vive en CentralDogmaState (lib/bio/central-dogma.ts)
 * y se avanza en useFrame. La escena sólo renderiza en base al estado.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { OrbitControls } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction, KernelSize } from 'postprocessing';
import { useAudience } from '@/physics/context';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import {
  CENTRAL_DOGMA_PRESETS,
  DEFAULT_RATES,
  buildCentralDogma,
  finishedState,
  initialState,
  stepDogma,
  type CentralDogmaData,
  type CentralDogmaState,
  type DogmaRates,
} from '@/lib/bio/central-dogma';
import { BASE_COLOR, type Base } from '@/lib/bio/dna';
import { AMINO_ACIDS, type AACode } from '@/lib/bio/aminoacids';

// Colores de RNA: las mismas bases que DNA, pero U (reemplaza T) en violeta.
const RNA_COLOR: Record<string, string> = {
  A: BASE_COLOR.A,
  U: '#AB47BC',
  G: BASE_COLOR.G,
  C: BASE_COLOR.C,
};

const DNA_RISE = 3.4;       // Å por base — usado como spacing visual
const LANE_DNA_Y = 10;
const LANE_RNA_Y = 0;
const LANE_PROTEIN_Y = -12;
const LANE_CENTER_Y = (LANE_DNA_Y + LANE_PROTEIN_Y) / 2; // -1
const RIBOSOME_X_PAD = 18;   // Å detrás del extremo del DNA
const PROTEIN_AA_SPACING = 3.0;

export default function CentralDogma() {
  const { audience } = useAudience();
  const [presetId, setPresetId] = useState<string>('synth');
  const preset = CENTRAL_DOGMA_PRESETS.find(p => p.id === presetId)!;
  const data = useMemo(() => buildCentralDogma(preset.codingDna), [preset.codingDna]);

  const [rates, setRates] = useState<DogmaRates>(DEFAULT_RATES);
  const [playing, setPlaying] = useState(true);
  const [state, setState] = useState<CentralDogmaState>(() => initialState());

  const stateRef = useRef(state);
  stateRef.current = state;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const ratesRef = useRef(rates);
  ratesRef.current = rates;
  const dataRef = useRef(data);
  dataRef.current = data;

  // Reiniciar cuando cambie el preset.
  useEffect(() => { setState(initialState()); }, [presetId]);

  return (
    <div className="grid grid-cols-[1fr_360px] gap-0 h-full min-h-0 overflow-hidden">
      <div className="relative min-h-0">
        <DogmaViewport data={data} state={state} />

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/85 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">gen&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {preset.gene}</div>
          <div><span className="text-[#64748B]">producto&nbsp;</span>= {preset.product}</div>
          <div><span className="text-[#64748B]">fase&nbsp;&nbsp;&nbsp;&nbsp;</span>= <PhaseTag phase={state.phase} /></div>
          <div><span className="text-[#64748B]">t&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>= {state.elapsed.toFixed(2)} s</div>
        </div>

        <Ticker
          onTick={(dt) => {
            if (!playingRef.current) return;
            const s = stateRef.current;
            if (s.phase === 'done') return;
            setState(prev => stepDogma(prev, dataRef.current, ratesRef.current, dt));
          }}
        />
      </div>

      <aside className="border-l border-[#1E293B] bg-[#0B0F17] overflow-y-auto">
        <Section title="Secuencia">
          <div className="grid grid-cols-1 gap-1.5">
            {CENTRAL_DOGMA_PRESETS.map(p => (
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

        <Section title="Control">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setPlaying(v => !v)}
              data-testid="dogma-playpause"
              className="flex-1 px-3 py-2 rounded-md border border-[#334155] text-[12px] text-white hover:border-[#4FC3F7]"
            >
              {playing ? 'pausa' : 'reproducir'}
            </button>
            <button
              onClick={() => setState(initialState())}
              data-testid="dogma-reset"
              className="flex-1 px-3 py-2 rounded-md border border-[#334155] text-[12px] text-[#CBD5E1] hover:border-[#F48FB1]"
            >
              reiniciar
            </button>
            <button
              onClick={() => setState(finishedState(data))}
              className="flex-1 px-3 py-2 rounded-md border border-[#334155] text-[12px] text-[#CBD5E1] hover:border-[#FFCA28]"
            >
              finalizar
            </button>
          </div>
          <RateSlider
            label="RNAP (nt/s)"
            value={rates.ntPerSecond}
            min={2} max={60} step={1}
            onChange={v => setRates(r => ({ ...r, ntPerSecond: v }))}
          />
          <RateSlider
            label="ribosoma (aa/s)"
            value={rates.aaPerSecond}
            min={1} max={20} step={1}
            onChange={v => setRates(r => ({ ...r, aaPerSecond: v }))}
          />
          <div className="mt-2 text-[10px] text-[#64748B] leading-relaxed">
            Valores reales medidos in vivo: RNAP II ≈ 30 nt/s (Ardehali &amp; Lis 2009); ribosoma ≈ 6 aa/s (Ingolia 2011).
          </div>
        </Section>

        {audience === 'child' ? (
          <Section title="Lo que estás viendo">
            <div className="text-[12px] text-[#CBD5E1] leading-relaxed space-y-2">
              <p><strong>1 — Arriba</strong>: un trozo de DNA, la receta. Un motor (verde) lo va copiando letra por letra.</p>
              <p><strong>2 — Medio</strong>: el mensajero (mRNA) lleva la copia al taller.</p>
              <p><strong>3 — Abajo</strong>: el ribosoma — el taller — lee el mensaje de 3 en 3 letras y engancha una pieza (aminoácido) por cada triplete.</p>
              <p>Al final queda la proteína: el robot que hará el trabajo en la célula.</p>
            </div>
          </Section>
        ) : (
          <Section title="Mecanismo">
            <div className="text-[11px] text-[#CBD5E1] leading-relaxed space-y-1.5">
              <p><strong className="text-[#4FC3F7]">Transcripción</strong> — RNAP II desenrolla la hélice, copia la plantilla 3'→5' emitiendo mRNA 5'→3'. T → U.</p>
              <p><strong className="text-[#F48FB1]">Transporte</strong> — mRNA maduro (capped, poliadenilado, spliced) sale del núcleo.</p>
              <p><strong className="text-[#FFCA28]">Traducción</strong> — ribosoma (60S + 40S) lee 3 nt/codón, tRNA carga aminoácidos, peptidil-transferasa forma el enlace peptídico.</p>
            </div>
          </Section>
        )}

        <Section title="Progreso">
          <Progress label="mRNA" value={state.mrnaLength} max={data.coding.length} unit="nt" />
          <Progress
            label="proteína"
            value={state.proteinLength}
            max={data.stopIndex >= 0 ? data.stopIndex : data.codons.length}
            unit="aa"
          />
        </Section>

        <Section title="Codón en el ribosoma">
          <CurrentCodon data={data} state={state} />
        </Section>

        <Section title="Secuencias">
          <div className="font-mono text-[10px] leading-snug break-all">
            <div className="text-[#64748B] mb-0.5">coding 5'→3'</div>
            {data.coding.split('').map((c, i) => {
              const read = i < state.rnapIndex;
              return (
                <span key={i} style={{ color: read ? BASE_COLOR[c as Base] : '#334155' }}>{c}</span>
              );
            })}
          </div>
          <div className="mt-2 font-mono text-[10px] leading-snug break-all">
            <div className="text-[#64748B] mb-0.5">mRNA 5'→3'</div>
            {data.mrna.split('').map((c, i) => {
              const visible = i < state.mrnaLength;
              if (!visible) return <span key={i} className="text-[#1E293B]">·</span>;
              return <span key={i} style={{ color: RNA_COLOR[c] ?? '#64748B' }}>{c}</span>;
            })}
          </div>
          <div className="mt-2 font-mono text-[10px] leading-snug break-all">
            <div className="text-[#64748B] mb-0.5">proteína (1-letter)</div>
            {data.protein.split('').map((c, i) => {
              const visible = i < state.proteinLength;
              const info = AMINO_ACIDS[c as AACode];
              if (!visible) return <span key={i} className="text-[#1E293B]">·</span>;
              return <span key={i} style={{ color: info?.color ?? '#CBD5E1' }}>{c}</span>;
            })}
          </div>
        </Section>
      </aside>
    </div>
  );
}

function Ticker({ onTick }: { onTick: (dt: number) => void }) {
  // Componente invisible que sólo enlaza un loop rAF fuera de Canvas.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (t: number) => {
      // Cap at 0.5s so if the tab is backgrounded (or rAF is throttled by the
      // browser) we don't drop most of the elapsed time — but a single giant
      // dt also won't blow up this linear state machine.
      const dt = Math.min(0.5, (t - last) / 1000);
      last = t;
      onTick(dt);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function PhaseTag({ phase }: { phase: CentralDogmaState['phase'] }) {
  const label =
    phase === 'transcribing' ? 'transcripción' :
    phase === 'transport' ? 'transporte' :
    phase === 'translating' ? 'traducción' : 'completo';
  const color =
    phase === 'transcribing' ? '#4FC3F7' :
    phase === 'transport' ? '#F48FB1' :
    phase === 'translating' ? '#FFCA28' : '#81C784';
  return <span style={{ color }}>{label}</span>;
}

function CameraFitter({
  midX, camDist, controlsRef,
}: {
  midX: number; camDist: number; controlsRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(midX, LANE_CENTER_Y + 4, camDist);
    camera.lookAt(midX, LANE_CENTER_Y, 0);
    camera.updateProjectionMatrix();
    const ctl = controlsRef.current;
    if (ctl) { ctl.target.set(midX, LANE_CENTER_Y, 0); ctl.update(); }
  }, [camera, midX, camDist, controlsRef]);
  return null;
}

function DogmaViewport({ data, state }: { data: CentralDogmaData; state: CentralDogmaState }) {
  // Longitud total del "escenario" en X — DNA + padding + espacio para la proteína
  // creciendo a la izquierda del ribosoma.
  const dnaLen = data.coding.length * DNA_RISE;
  const ribosomeRight = dnaLen + RIBOSOME_X_PAD + 22; // margen derecho para el ribosoma
  const midX = ribosomeRight / 2;
  const totalLength = ribosomeRight;
  // Distancia para que todo entre en el frustum con margen. fov=46 + aspecto
  // ~1.16 → horiz half-width ≈ camDist·tan(23°)·1.16. Queremos que cubra
  // totalLength/2 + margen; usamos factor 1.4.
  const camDist = Math.max(60, totalLength * 1.4);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div
      className="relative w-full h-full"
      style={{ background: 'radial-gradient(ellipse at center, #0B0F17 0%, #05060A 85%)' }}
    >
      <Canvas
        camera={{ position: [midX, LANE_CENTER_Y + 4, camDist], fov: 46, near: 0.5, far: 2000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[midX, 30, 40]} intensity={1.3} color="#B3E5FC" distance={0} decay={0} />
        <pointLight position={[midX, -25, 40]} intensity={0.7} color="#FFAB91" distance={0} decay={0} />
        <OrbitControls
          ref={controlsRef as React.MutableRefObject<OrbitControlsImpl>}
          target={[midX, LANE_CENTER_Y, 0]}
          enablePan enableZoom enableRotate enableDamping dampingFactor={0.08}
        />
        <CameraFitter midX={midX} camDist={camDist} controlsRef={controlsRef} />
        <DogmaScene data={data} state={state} totalLength={totalLength} />
        <EffectComposer multisampling={4}>
          <Bloom intensity={0.85} luminanceThreshold={0.2} luminanceSmoothing={0.45} mipmapBlur kernelSize={KernelSize.LARGE} />
          <Vignette offset={0.25} darkness={0.55} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      </Canvas>
    </div>
  );
}

function DogmaScene({
  data, state, totalLength,
}: { data: CentralDogmaData; state: CentralDogmaState; totalLength: number }) {
  const particleTex = useMemo(() => getParticleTexture(), []);
  // Cada base ocupa DNA_RISE en x.
  const xOfNt = (i: number) => i * DNA_RISE;

  // -------- DNA backbone (arriba) --------
  const dnaGroup = useMemo(() => {
    const g = new THREE.Group();
    const N = data.coding.length;
    // Dos tubos Catmull-Rom con ligera oscilación sinusoidal en z para dar
    // sensación de doble hélice sin calcular toda la geometría B-DNA.
    const s1: THREE.Vector3[] = [];
    const s2: THREE.Vector3[] = [];
    for (let i = 0; i < N; i++) {
      const x = xOfNt(i);
      const theta = (i / N) * Math.PI * 2 * (N / 10.5);
      s1.push(new THREE.Vector3(x, LANE_DNA_Y + Math.cos(theta) * 1.6, Math.sin(theta) * 1.6));
      s2.push(new THREE.Vector3(x, LANE_DNA_Y - Math.cos(theta) * 1.6, -Math.sin(theta) * 1.6));
    }
    const mk = (pts: THREE.Vector3[], color: string) => {
      const curve = new THREE.CatmullRomCurve3(pts);
      return new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(64, pts.length * 4), 0.5, 8, false),
        new THREE.MeshStandardMaterial({
          color, emissive: new THREE.Color(color),
          emissiveIntensity: 0.55, roughness: 0.4, metalness: 0.3,
        }),
      );
    };
    g.add(mk(s1, '#64B5F6'));
    g.add(mk(s2, '#F06292'));

    // Base "escalones": pequeños cubos coloreados en cada posición.
    for (let i = 0; i < N; i++) {
      const base = data.coding[i] as Base;
      const col = BASE_COLOR[base] ?? '#CBD5E1';
      const cube = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 2.4, 0.6),
        new THREE.MeshStandardMaterial({
          color: col, emissive: new THREE.Color(col),
          emissiveIntensity: 0.8, roughness: 0.4,
        }),
      );
      cube.position.set(xOfNt(i), LANE_DNA_Y, 0);
      g.add(cube);
    }
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.coding]);

  // Posición del RNAP y nodos del mRNA.
  const rnapX = xOfNt(state.rnapIndex);

  // El mRNA que ha sido transcrito viaja desde la posición actual del RNAP
  // formando una curva que desciende hacia el ribosoma. Representamos los
  // nucleótidos ya emitidos como una polyline de esferas coloreadas.
  const mrnaPoints = useMemo(() => {
    const nNt = Math.floor(state.mrnaLength);
    const pts: { x: number; y: number; z: number; c: string }[] = [];
    // El mRNA se desenrolla desde el RNAP (estando ya transcrita la parte 0..nNt).
    // Para presentarlo: primeros (80%) siguen una curva suave desde el DNA
    // hacia LANE_RNA_Y, últimos pegados al RNAP.
    for (let i = 0; i < nNt; i++) {
      const x = xOfNt(i);
      // Interpolar y desde DNA hasta RNA lane, en función de distancia al RNAP.
      // Los emitidos primero están más abajo (más viejos); los recientes cerca del RNAP.
      const dist = Math.max(0, rnapX - x);
      // Distancia característica: ~10 Å detrás del RNAP y ya está en su altura final.
      const t = Math.min(1, dist / 15);
      const y = LANE_DNA_Y + (LANE_RNA_Y - LANE_DNA_Y) * t;
      const z = 4 * Math.sin(t * Math.PI * 0.5); // arquea suavemente hacia +z
      const base = data.mrna[i];
      pts.push({ x, y, z, c: RNA_COLOR[base] ?? '#CBD5E1' });
    }
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.mrnaLength, rnapX, data.mrna]);

  // Ribosoma posicionado justo después del extremo del DNA (a la derecha).
  const ribosomeX = data.coding.length * DNA_RISE + RIBOSOME_X_PAD;

  // Protein: cadena creciendo a la izquierda del ribosoma (hacia +x desde él).
  const proteinAAs = useMemo(() => {
    const n = Math.floor(state.proteinLength);
    const res: { x: number; y: number; z: number; c: string; code: AACode }[] = [];
    for (let i = 0; i < n; i++) {
      const code = data.protein[i] as AACode;
      const info = AMINO_ACIDS[code];
      const x = ribosomeX - 10 - i * PROTEIN_AA_SPACING;
      const y = LANE_PROTEIN_Y + Math.sin(i * 0.8) * 1.5;
      const z = Math.cos(i * 0.5) * 1.5;
      res.push({ x, y, z, c: info?.color ?? '#CBD5E1', code });
    }
    return res;
  }, [state.proteinLength, data.protein, ribosomeX]);

  // mRNA en el ribosoma: cuando está en fase translating, mostrar el mRNA
  // extendido horizontalmente cerca del ribosoma para que se vea que
  // se lee codón por codón.
  const translatingActive = state.phase === 'translating' || state.phase === 'done';
  const codonInRibosome = Math.floor(state.ribosomeCodon);

  return (
    <group>
      {/* DNA backbone */}
      <primitive object={dnaGroup} />

      {/* RNA polimerasa — esfera semi-translúcida verde/cyan con halo */}
      {state.phase === 'transcribing' && (
        <group position={[rnapX, LANE_DNA_Y, 0]}>
          <mesh>
            <sphereGeometry args={[3.2, 32, 32]} />
            <meshStandardMaterial
              color="#26C6DA" emissive="#26C6DA" emissiveIntensity={0.9}
              transparent opacity={0.75} roughness={0.3} metalness={0.5}
            />
          </mesh>
          <sprite scale={[9, 9, 9]}>
            <spriteMaterial
              map={particleTex} color="#80DEEA" transparent opacity={0.55}
              blending={THREE.AdditiveBlending} depthWrite={false}
            />
          </sprite>
        </group>
      )}

      {/* mRNA nucleótidos ya emitidos */}
      {mrnaPoints.map((pt, i) => (
        <mesh key={i} position={[pt.x, pt.y, pt.z]}>
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshStandardMaterial
            color={pt.c} emissive={pt.c} emissiveIntensity={0.9}
            roughness={0.3} metalness={0.4}
          />
        </mesh>
      ))}

      {/* mRNA "en transporte": cuando phase === transport, mover una onda luminosa */}
      {state.phase === 'transport' && (
        <mesh position={[
          xOfNt(data.coding.length) + (ribosomeX - xOfNt(data.coding.length)) * state.transportT,
          LANE_RNA_Y,
          0,
        ]}>
          <sphereGeometry args={[2.5, 24, 24]} />
          <meshStandardMaterial color="#F48FB1" emissive="#F48FB1" emissiveIntensity={1.0} />
        </mesh>
      )}

      {/* Ribosoma: 2 esferas (subunidad grande y pequeña) — siempre visible
          como ancla. Opacidad reducida mientras esperamos al mRNA. */}
      <group position={[ribosomeX, LANE_RNA_Y - 2, 0]}>
        <mesh position={[0, 2, 0]}>
          <sphereGeometry args={[5.5, 32, 32]} />
          <meshStandardMaterial
            color="#5C6BC0" emissive="#3949AB"
            emissiveIntensity={translatingActive ? 0.6 : 0.25}
            transparent opacity={translatingActive ? 0.75 : 0.35}
            roughness={0.5}
          />
        </mesh>
        <mesh position={[0, -2.5, 0]}>
          <sphereGeometry args={[4.0, 32, 32]} />
          <meshStandardMaterial
            color="#7E57C2" emissive="#512DA8"
            emissiveIntensity={translatingActive ? 0.6 : 0.25}
            transparent opacity={translatingActive ? 0.75 : 0.35}
            roughness={0.5}
          />
        </mesh>
        <sprite scale={[14, 14, 14]}>
          <spriteMaterial
            map={particleTex} color="#B39DDB" transparent
            opacity={translatingActive ? 0.4 : 0.15}
            blending={THREE.AdditiveBlending} depthWrite={false}
          />
        </sprite>
      </group>

      {/* mRNA pasando por el ribosoma (horizontal, 3 codones visibles) */}
      {translatingActive && data.codons.map((codon, ci) => {
        // Sólo dibujar codones cercanos al actual (ventana de ±3 codones).
        if (Math.abs(ci - codonInRibosome) > 3) return null;
        const offset = (ci - codonInRibosome) * 3.6;
        return (
          <group key={ci} position={[ribosomeX + offset - 10, LANE_RNA_Y + 3, 0]}>
            {codon.rna.split('').map((nt, j) => (
              <mesh key={j} position={[j * 0.9, 0, 0]}>
                <sphereGeometry args={[0.5, 12, 12]} />
                <meshStandardMaterial
                  color={RNA_COLOR[nt] ?? '#CBD5E1'}
                  emissive={RNA_COLOR[nt] ?? '#CBD5E1'}
                  emissiveIntensity={ci === codonInRibosome ? 1.3 : 0.6}
                />
              </mesh>
            ))}
          </group>
        );
      })}

      {/* Proteína — cadena de esferas grandes coloreadas por propiedad */}
      {proteinAAs.map((aa, i) => (
        <group key={i} position={[aa.x, aa.y, aa.z]}>
          <mesh>
            <sphereGeometry args={[1.4, 20, 20]} />
            <meshStandardMaterial
              color={aa.c} emissive={aa.c} emissiveIntensity={0.85}
              roughness={0.35} metalness={0.3}
            />
          </mesh>
          <sprite scale={[3.4, 3.4, 3.4]}>
            <spriteMaterial
              map={particleTex} color={aa.c} transparent opacity={0.35}
              blending={THREE.AdditiveBlending} depthWrite={false}
            />
          </sprite>
        </group>
      ))}

      {/* Línea conectando AAs del péptido: enlace peptídico */}
      {proteinAAs.length > 1 && (
        <BondTube points={proteinAAs.map(a => new THREE.Vector3(a.x, a.y, a.z))} />
      )}

      {/* Etiquetas de carril (flechas + guía) */}
      <LaneLabel x={0} y={LANE_DNA_Y + 6} label="DNA" color="#64B5F6" />
      <LaneLabel x={0} y={LANE_RNA_Y + 6} label="mRNA" color="#F48FB1" />
      <LaneLabel x={0} y={LANE_PROTEIN_Y + 6} label="proteína" color="#FFCA28" />
    </group>
  );
}

function BondTube({ points }: { points: THREE.Vector3[] }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.3), [points]);
  const geom = useMemo(
    () => new THREE.TubeGeometry(curve, Math.max(32, points.length * 4), 0.35, 8, false),
    [curve, points.length],
  );
  return (
    <mesh geometry={geom}>
      <meshStandardMaterial
        color="#FFCA28" emissive="#FFCA28" emissiveIntensity={0.4}
        roughness={0.5} transparent opacity={0.85}
      />
    </mesh>
  );
}

function LaneLabel({ x, y, label, color }: { x: number; y: number; label: string; color: string }) {
  // Una barra horizontal emissive como separador visual de carril (los
  // labels textuales van en el HUD del sidebar — no queremos sprites 2D
  // textuales aquí para evitar complicaciones con drei Html).
  return (
    <mesh position={[x - 8, y, 0]}>
      <boxGeometry args={[1.2, 0.25, 0.25]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
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

function Progress({ label, value, max, unit }: { label: string; value: number; max: number; unit: string }) {
  const pct = max === 0 ? 0 : Math.min(1, value / max);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-[11px] font-mono text-[#CBD5E1] mb-1">
        <span className="text-[#64748B]">{label}</span>
        <span>{Math.floor(value)}/{max} {unit}</span>
      </div>
      <div className="h-1.5 rounded-full bg-[#1E293B] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#4FC3F7] to-[#AB47BC]"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

function CurrentCodon({ data, state }: { data: CentralDogmaData; state: CentralDogmaState }) {
  if (state.phase === 'transcribing' || state.phase === 'transport') {
    return <div className="text-[11px] text-[#64748B]">(esperando al ribosoma…)</div>;
  }
  const idx = Math.min(data.codons.length - 1, Math.floor(state.ribosomeCodon));
  const c = data.codons[idx];
  const isStop = c.aa === '*';
  const info = !isStop ? AMINO_ACIDS[c.aa as AACode] : null;
  return (
    <div className="text-[12px] space-y-1.5">
      <div className="font-mono text-[16px] flex gap-1">
        {c.rna.split('').map((nt, i) => (
          <span key={i} style={{ color: RNA_COLOR[nt] ?? '#CBD5E1' }}>{nt}</span>
        ))}
      </div>
      <div className="text-[11px]">
        <span className="text-[#64748B]">→ aminoácido: </span>
        {isStop ? (
          <span className="text-[#EF5350]">STOP</span>
        ) : (
          <span style={{ color: info?.color ?? '#CBD5E1' }}>
            {info?.three} ({c.aa}) — {info?.name}
          </span>
        )}
      </div>
      {!isStop && info && (
        <div className="text-[10px] text-[#64748B]">
          propiedad: {info.property} · masa: {info.mass.toFixed(2)} Da
        </div>
      )}
    </div>
  );
}

function RateSlider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block mb-2 text-[11px] text-[#CBD5E1]">
      <div className="flex justify-between mb-1 font-mono">
        <span className="text-[#64748B]">{label}</span>
        <span>{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-[#4FC3F7]"
      />
    </label>
  );
}
