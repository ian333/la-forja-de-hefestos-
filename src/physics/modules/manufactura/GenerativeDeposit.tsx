/**
 * Deposición generativa 3D — SIMULACION: del diseño generativo al vóxel (xyz).
 *
 * Selector de FIGURAS generativas reales de manufactura aditiva: TPMS (giroide,
 * diamante, Schwarz-P = superficies mínimas triplemente periódicas), celosía de
 * struts, y ménsula topológica (SIMP). Se imprimen vóxel por vóxel, CAPA POR CAPA
 * hacia arriba (xyz). El GAP es la perilla maestra: contacto (gota=gap, tiro 0)
 * vs vuelo (ordeño + tiro balístico 3D). Color por temperatura. Todo de números.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { useAudience } from '@/physics/context';
import LessonPanel, { type Lesson } from '@/math/lesson/LessonPanel';
import { tempColor } from '@/lib/physics/metalDrop';
import {
  FIGURES, figure3D, planFill3D, regimeOf, dGotaMm, weOf, CRIT_GAP_MM, type Voxel3D,
} from '@/lib/physics/genDeposit';

const N = 18;               // resolución del cubo (n³)
const PARTW = 5;            // lado de la pieza en escena
const BASE = -2.4;          // base (la pieza crece hacia arriba)
const SCALE = 1.6;          // unidades por mm (gap/gota — exagerado para verse)
const VHEAD_VIS = 120e-3;   // velocidad de cabezal para el tiro VISIBLE (real ~40; tiro ∝v)
const fmt = (x: number, d = 0) => isFinite(x) ? x.toFixed(d) : '∞';
const tfallMs = (g: number) => { const h = g * 1e-3, v = 0.3; return (-v + Math.sqrt(v * v + 2 * 9.81 * h)) / 9.81; };

interface GDLesson { presetId: string; }
const PRESETS = [
  { id: 'contacto', name: 'Fino — contacto (gap chico)', gap: 0.10,
    note: 'Gap < crítico: la gota TOCA antes de soltarse → el gap fija tamaño y posición, tiro 0, exacto. Superficie/detalle.' },
  { id: 'vuelo', name: 'Relleno — vuelo (gap grande)', gap: 0.35,
    note: 'Gap > crítico: la gota VUELA y cae adelante (tiro). El RP2350 compensa con lead. Bulto/relleno.' },
];

const LESSON: Lesson<GDLesson> = {
  hook: {
    title: 'Diseño generativo en metal, gota a gota — las figuras que solo el AM puede hacer.',
    body: `Elige una figura: los TPMS (giroide, diamante, Schwarz-P) son superficies mínimas triplemente periódicas — las celosías de aligeramiento que se usan en aeroespacial y prótesis, imposibles de mecanizar. O la ménsula topológica (SIMP). Aquí se imprimen vóxel por vóxel, capa por capa hacia arriba.

El GAP manda: chico = la gota toca antes de soltarse (contacto, exacta); grande = vuela y cae adelante (relleno). Y modela la UNIÓN: nada se imprime en el aire — cada gota se funde a lo que ya está (sustrato o vóxel previo), y los voladizos llevan SOPORTE (gris, removible). Todo emerge de la física: gota resonante + balística + mojado + adhesión.`,
  },
  steps: [
    { title: 'Figura + gap', duration: 6000,
      body: 'Cambia de figura y mueve el GAP. Bajo el crítico = CONTACTO (exacto, tiro 0). Arriba = VUELO (cae adelante, el RP2350 corrige con lead).',
      formula: 'gap < d_ordeño → contacto · vóxel = huella mojado ≈ 1.7·d_gota',
      keyframes: [{ at: 0, state: { presetId: 'contacto' } }] },
  ],
  connect: {
    body: 'El boom: vóxel de metal de tamaño variable, colocable en 3D, en una máquina barata = el primitivo del diseño generativo (TPMS, lattices, topología). Hoy eso solo lo hace el láser-powder-bed, carísimo. Aquí emerge de controlar la gota.',
    links: [],
  },
};

export default function GenerativeDeposit() {
  const { audience } = useAudience();
  const [figureId, setFigureId] = useState('giroide');
  const [gap, setGap] = useState(0.10);
  const [adaptive, setAdaptive] = useState(true);
  const [running, setRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [presetId, setPresetId] = useState('contacto');

  const occ = useMemo(() => figure3D(figureId, N), [figureId]);
  const fill = useMemo(() => planFill3D(occ, N, adaptive), [occ, adaptive]);
  const progress = useRef(0);
  const gapRef = useRef(gap); useEffect(() => { gapRef.current = gap; }, [gap]);
  const runRef = useRef(running); useEffect(() => { runRef.current = running; }, [running]);
  const spRef = useRef(speed); useEffect(() => { spRef.current = speed; }, [speed]);
  useEffect(() => { progress.current = 0; }, [figureId, adaptive]);
  const reset = () => { progress.current = 0; };

  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0, last = 0;
    const tick = () => { const n = performance.now(); if (n - last > 100) { force(x => x + 1); last = n; } raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);

  const reg = regimeOf(gap), dG = dGotaMm(gap);
  const idx = Math.min(Math.floor(progress.current), fill.length);
  const pct = fill.length ? Math.round(100 * idx / fill.length) : 0;
  const figName = FIGURES.find(f => f.id === figureId)?.name ?? figureId;
  const supN = fill.reduce((a, v) => a + (v.type === 'support' ? 1 : 0), 0);
  const supPct = fill.length ? Math.round(100 * supN / fill.length) : 0;
  const apply = (id: string) => { const p = PRESETS.find(x => x.id === id); if (p) { setPresetId(id); setGap(p.gap); } };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] grid-rows-[minmax(220px,1fr)_minmax(180px,45vh)] lg:grid-rows-1 gap-0 h-full">
      <div className="relative">
        <Stage cameraDistance={8} autoRotate bloomIntensity={1.0} bloomThreshold={0.12}>
          <Scene key={figureId + adaptive} fill={fill} progress={progress} gapRef={gapRef} runRef={runRef} spRef={spRef} />
        </Stage>

        <div className="absolute top-4 left-4 rounded-lg bg-[#0B0F17]/75 backdrop-blur border border-[#1E293B] px-4 py-2.5 font-mono text-[11px] text-[#CBD5E1] space-y-0.5">
          <div><span className="text-[#64748B]">figura</span>= <span className="text-[#67E8F9]">{figName}</span></div>
          <div><span className="text-[#64748B]">avance</span>= <span className="text-[#FCD34D]">{pct}%</span> ({idx}/{fill.length})</div>
          <div><span className="text-[#64748B]">gap&nbsp;&nbsp;&nbsp;</span>= {fmt(gap, 2)} mm <span className="text-[#475569]">(crít {fmt(CRIT_GAP_MM, 2)})</span></div>
          <div><span className="text-[#64748B]">d_gota</span>= {fmt(dG, 3)} mm · We {fmt(weOf(dG), 3)}</div>
          <div><span className="text-[#64748B]">soporte</span>= <span className="text-[#94A3B8]">{supPct}%</span> <span className="text-[#475569]">(removible)</span></div>
          <div className="pt-1">{reg === 'contacto'
            ? <span className="text-[#86EFAC]">◆ CONTACTO · tiro 0</span>
            : <span className="text-[#FDBA74]">➤ VUELO · tiro+lead</span>}</div>
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-[#0B0F17]/90 backdrop-blur border border-[#1E293B] rounded-lg px-3 py-2">
          <IconBtn onClick={() => setRunning(r => !r)} active={running}>{running ? '❚❚' : '▶'}</IconBtn>
          <IconBtn onClick={reset} title="Reiniciar">↺</IconBtn>
        </div>
        <div className="absolute bottom-4 left-4 text-[10px] font-mono text-[#64748B] bg-[#0B0F17]/70 rounded px-2 py-1">
          diseño generativo 3D · modela la UNIÓN (nada en el aire) + soporte gris
        </div>
      </div>

      <LessonPanel<GDLesson>
        lesson={LESSON}
        onApplyState={(p) => { if (p.presetId) apply(p.presetId); }}
        sandbox={
          <>
            <Section title="Figura generativa">
              <div className="grid grid-cols-1 gap-1.5">
                {FIGURES.map(f => (
                  <button key={f.id} onClick={() => setFigureId(f.id)} data-testid={`fig-${f.id}`}
                    className={`text-left px-3 py-2 rounded-md border text-[12px] transition ${figureId === f.id
                      ? 'bg-gradient-to-br from-[#0e7490]/40 to-[#1e3a8a]/30 border-[#22D3EE]/40 text-white'
                      : 'border-[#1E293B] text-[#94A3B8] hover:border-[#334155] hover:text-white'}`}>{f.name}</button>
                ))}
              </div>
            </Section>

            <Section title="El GAP — perilla maestra">
              <Slider label="gap [mm]" v={gap} min={0.04} max={0.5} step={0.01} on={setGap} fix={2} />
              <div className="text-[10px] text-[#64748B] mb-2">crítico {fmt(CRIT_GAP_MM, 2)} mm · {reg === 'contacto' ? 'CONTACTO (exacto)' : 'VUELO (tiro)'}</div>
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {PRESETS.map(p => (
                  <button key={p.id} onClick={() => apply(p.id)} data-testid={`preset-${p.id}`}
                    className={`px-2 py-1.5 rounded-md border text-[11px] ${presetId === p.id ? 'border-[#FB923C]/50 text-white bg-[#7C2D12]/30' : 'border-[#1E293B] text-[#94A3B8]'}`}>{p.id}</button>
                ))}
              </div>
              <Toggle label="Resolución adaptativa" on={adaptive} set={setAdaptive} />
              <Slider label="velocidad" v={speed} min={0.25} max={4} step={0.25} on={setSpeed} fix={2} />
            </Section>

            {audience !== 'child' && (
              <Section title="Estado (vivo)">
                <Row label="figura" value={figName} />
                <Row label="régimen" value={reg} />
                <Row label="d_gota" value={`${fmt(dG, 3)} mm`} />
                <Row label="vóxel ≈1.7·d" value={`${fmt(dG * 1.7, 3)} mm`} />
                <Row label="We" value={fmt(weOf(dG), 3)} />
                <Row label="vóxeles" value={`${idx}/${fill.length}`} />
              </Section>
            )}

            <Section title="Física (lo que junta)">
              <div className="text-[11px] font-mono text-[#CBD5E1] leading-snug space-y-1">
                <div className="text-white">TPMS: giroide/diamante/Schwarz-P</div>
                <div>gap &lt; d_ordeño → contacto (tiro 0)</div>
                <div>vóxel = huella mojado ≈ 1.7·d_gota</div>
                <div>We = ρv²d/γ &lt;&lt; 1 → moja, no salpica</div>
              </div>
            </Section>
          </>
        }
      />
    </div>
  );
}

function Scene({ fill, progress, gapRef, runRef, spRef }: {
  fill: Voxel3D[]; progress: React.MutableRefObject<number>;
  gapRef: React.MutableRefObject<number>; runRef: React.MutableRefObject<boolean>; spRef: React.MutableRefObject<number>;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const torch = useRef<THREE.Group>(null);
  const drop = useRef<THREE.Mesh>(null);
  const dropMat = useRef<THREE.MeshStandardMaterial>(null);
  const gapline = useRef<THREE.Mesh>(null);
  const arc = useRef<THREE.Line>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const col = useMemo(() => new THREE.Color(), []);
  const CS = PARTW / N;
  const sx = (c: number) => (c - N / 2 + 0.5) * CS;             // X
  const sz = (c: number) => (c - N / 2 + 0.5) * CS;             // Z
  const sy = (c: number) => BASE + c * CS;                      // Y (altura)
  const arcGeom = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(17 * 3), 3)); return g; }, []);

  useFrame((_, dt) => {
    const m = mesh.current; if (!m) return;
    const rate = Math.max(8, fill.length / 18);
    if (runRef.current) progress.current = Math.min(progress.current + dt * rate * spRef.current, fill.length + 0.001);
    const p = progress.current, idx = Math.floor(p), frac = p - idx;
    const gapMm = gapRef.current, reg = regimeOf(gapMm), dGmm = dGotaMm(gapMm);
    const gapS = Math.min(Math.max(gapMm * SCALE, 0.06), 0.7);
    const dS = Math.max(dGmm * SCALE, 0.05);
    const footS = Math.max(0.7 * CS, 1.7 * dGmm * SCALE);

    for (let i = 0; i < fill.length; i++) {
      const v = fill[i];
      if (i >= idx) { dummy.scale.set(0, 0, 0); dummy.position.set(0, -50, 0); }
      else {
        const r = v.size * footS;
        dummy.position.set(sx(v.cx), sy(v.cz), sz(v.cy));
        if (v.type === 'support') {
          dummy.scale.set(r * 0.3, r * 0.55, r * 0.3);          // pilar delgado removible
          col.setRGB(0.30, 0.33, 0.39);                          // gris (soporte)
        } else {
          dummy.scale.setScalar(r * 0.55);
          const T = Math.max(180, 1520 - (idx - i) * 70);
          const [rr, gg, bb] = tempColor(T); col.setRGB(rr, gg, bb);  // pieza: temperatura
        }
        m.setColorAt(i, col);
      }
      dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true;

    const done = idx >= fill.length;
    const tgt = fill[Math.min(idx, fill.length - 1)];
    const prev = fill[Math.max(0, Math.min(idx, fill.length - 1) - 1)];
    if (tgt) {
      const tX = sx(tgt.cx), tZ = sz(tgt.cy), tY = sy(tgt.cz);
      let dx = tX - sx(prev.cx), dz = tZ - sz(prev.cy); const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
      const throwS = (reg === 'vuelo' ? VHEAD_VIS * tfallMs(gapMm) * 1e3 : 0) * SCALE;
      const lX = tX - dx * throwS, lZ = tZ - dz * throwS, lY = tY + gapS;
      if (torch.current) torch.current.position.set(lX, lY, lZ);
      if (drop.current) {
        const f = Math.min(frac, 1);
        drop.current.position.set(lX + (tX - lX) * f, lY + (tY - lY) * f * f, lZ + (tZ - lZ) * f);
        drop.current.scale.setScalar(dS * 0.5); drop.current.visible = !done;
      }
      if (gapline.current) { gapline.current.position.set(lX, lY - gapS / 2, lZ); gapline.current.scale.set(1, gapS, 1); gapline.current.visible = !done; }
      if (arc.current) {
        const g = arc.current.geometry as THREE.BufferGeometry; const pos = g.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k <= 16; k++) { const f = k / 16; pos.setXYZ(k, lX + (tX - lX) * f, lY + (tY - lY) * f * f, lZ + (tZ - lZ) * f); }
        pos.needsUpdate = true; arc.current.visible = reg === 'vuelo' && !done;
      }
    }
    if (dropMat.current) { const [r, g, b] = tempColor(1500); dropMat.current.color.setRGB(r, g, b); dropMat.current.emissive.setRGB(r, g, b); }
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, fill.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial toneMapped={false} metalness={0.45} roughness={0.4} vertexColors={false} />
      </instancedMesh>

      <group ref={torch} position={[0, BASE + 0.5, 0]}>
        <mesh position={[0, 0.55, 0]}><cylinderGeometry args={[0.045, 0.045, 1.0, 14]} /><meshStandardMaterial color="#9aa3b2" metalness={0.7} roughness={0.35} /></mesh>
        <mesh position={[0, 0.03, 0]}><coneGeometry args={[0.08, 0.14, 16]} /><meshStandardMaterial color="#c08a3e" metalness={0.6} roughness={0.4} emissive="#3a1c06" emissiveIntensity={0.4} /></mesh>
      </group>
      <mesh ref={drop}><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial ref={dropMat} metalness={0.2} roughness={0.3} emissiveIntensity={1.3} toneMapped={false} /></mesh>
      <mesh ref={gapline}><cylinderGeometry args={[0.012, 0.012, 1, 8]} /><meshBasicMaterial color="#22D3EE" transparent opacity={0.75} toneMapped={false} /></mesh>
      {/* @ts-expect-error three line */}
      <line ref={arc} geometry={arcGeom}><lineBasicMaterial color="#FDBA74" transparent opacity={0.6} toneMapped={false} /></line>

      <mesh position={[0, BASE - 0.2, 0]}>
        <cylinderGeometry args={[PARTW * 0.75, PARTW * 0.8, 0.3, 40]} />
        <meshStandardMaterial color="#23272f" metalness={0.5} roughness={0.6} />
      </mesh>
      <gridHelper args={[PARTW + 3, 28, '#1E293B', '#152030']} position={[0, BASE - 0.05, 0]} />
    </>
  );
}

// ── helpers ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (<div className="p-4 border-b border-[#1E293B]"><div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#64748B] mb-3">{title}</div>{children}</div>);
}
function Row({ label, value }: { label: string; value: string }) {
  return (<div className="flex items-baseline justify-between text-[11px] font-mono py-0.5"><span className="text-[#64748B]">{label}</span><span className="text-white">{value}</span></div>);
}
function Slider({ label, v, min, max, step, on, fix = 2 }: { label: string; v: number; min: number; max: number; step: number; on: (v: number) => void; fix?: number }) {
  return (<div className="mb-2"><div className="flex items-baseline justify-between text-[11px] font-mono"><span className="text-[#64748B]">{label}</span><span className="text-white">{v.toFixed(fix)}</span></div>
    <input type="range" min={min} max={max} step={step} value={v} onChange={e => on(Number(e.target.value))} className="w-full" /></div>);
}
function Toggle({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) {
  return (<button onClick={() => set(!on)} className="w-full flex items-center justify-between text-[12px] mb-2 px-2 py-1.5 rounded-md border border-[#1E293B] hover:border-[#334155]">
    <span className="text-[#CBD5E1]">{label}</span><span className={`w-9 h-5 rounded-full relative transition ${on ? 'bg-[#22D3EE]/70' : 'bg-[#1E293B]'}`}><span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${on ? 'left-4' : 'left-0.5'}`} /></span></button>);
}
function IconBtn({ children, onClick, active, title }: { children: React.ReactNode; onClick: () => void; active?: boolean; title?: string }) {
  return (<button onClick={onClick} title={title} className={`w-9 h-9 rounded-md border text-[14px] flex items-center justify-center transition ${active ? 'border-[#22D3EE]/50 text-white bg-[#0e7490]/30' : 'border-[#1E293B] text-[#94A3B8] hover:text-white hover:border-[#334155]'}`}>{children}</button>);
}
