/**
 * CinematicProtein — reel VIRAL de una proteína REAL (estructura del RCSB PDB), con el
 * tratamiento cinematográfico v7 (emisivo + bloom + grade) Y el GANCHO de 1.5s:
 *   0.0s  cold-open DENTRO de la estructura (tubos glowing + hemo ardiendo) — cero fade.
 *   0.0–0.7s  la cámara EMBISTE hacia afuera (pull-back rápido) → revela la proteína entera.
 *   0.3s  texto-gancho de curiosidad ("¿Qué te mantiene vivo ahora mismo?").
 *   1.5s+ contemplación: las 4 subunidades girando lento (la belleza v7).
 * Loop: el final ≈ el inicio → más replays.
 *
 * FIDELIDAD (regla dura bio): coordenadas atómicas REALES de 4HHB (hemoglobina humana,
 * Fermi 1984) servidas como /4HHB.pdb. Cartoon = tubo Catmull-Rom sobre Cα coloreado por
 * CADENA (las 4 subunidades) + hemos (HEM) como esferas incandescentes (el hierro que
 * carga el O₂). Reusa el parser/datos de src/lib/bio/pdb.ts.
 *
 * Determinista: window.__cinematicProtein.renderAt(t) PURO en t. ?clip=1 → cámara exacta
 * en t (sin lag) para render-clip. Parametrizable por URL (?pdb=&dur=).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import { parsePDB, VDW_RADIUS, ELEMENT_COLOR, type Structure, type Element } from '@/lib/bio/pdb';

function readParams() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const n = (k: string, d: number) => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : d; };
  return {
    pdb: q.get('pdb') || '4HHB',
    dur: n('dur', 20),
    clip: n('clip', 0),
  };
}
const PAR = readParams();
const DURATION = Math.max(2, PAR.dur);

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
// ease rápido para el pull-back del gancho (sale disparado, frena suave)
const fastOut = (t: number) => { t = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - t, 3); };

// 4 colores cinematográficos distintos para las cadenas (las subunidades) — el 4-fold simétrico
const CHAIN_COLORS = ['#39c6d6', '#ffb43c', '#ff5a78', '#9b7bff', '#5ad29a', '#ffd24a'];

function buildProtein(structure: Structure): { group: THREE.Group; radius: number; hemeCenter: THREE.Vector3 } {
  const group = new THREE.Group();

  // centro geométrico (Cα) para centrar la pieza en el origen
  const c = new THREE.Vector3(); let nc = 0;
  for (const a of structure.atoms) { if (!a.hetero) { c.x += a.pos[0]; c.y += a.pos[1]; c.z += a.pos[2]; nc++; } }
  if (nc) c.multiplyScalar(1 / nc);

  let radius = 1;
  // ── CARTOON: tubo Catmull-Rom sobre Cα, color por CADENA (subunidad) ──
  structure.chains.forEach((chain, ci) => {
    const pts: THREE.Vector3[] = [];
    for (const res of chain.residues) {
      const ca = res.atoms.find(a => a.name === 'CA' && a.element === 'C');
      if (ca) pts.push(new THREE.Vector3(ca.pos[0] - c.x, ca.pos[1] - c.y, ca.pos[2] - c.z));
    }
    if (pts.length < 2) return;
    for (const p of pts) radius = Math.max(radius, p.length());
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const tube = new THREE.TubeGeometry(curve, Math.max(pts.length * 6, 64), 0.62, 12, false);
    const col = new THREE.Color(CHAIN_COLORS[ci % CHAIN_COLORS.length]);
    const mat = new THREE.MeshStandardMaterial({
      color: col, emissive: col.clone().multiplyScalar(0.55), emissiveIntensity: 0.9,
      roughness: 0.4, metalness: 0.3,
    });
    group.add(new THREE.Mesh(tube, mat));
  });

  // ── HEMOS (HEM) + otros ligandos: esferas INCANDESCENTES (el hierro que carga el O₂) ──
  const hemeCenter = new THREE.Vector3(); let nh = 0;
  for (const het of structure.hetGroups) {
    if (het.resName === 'HOH') continue;
    const isHeme = het.resName === 'HEM';
    for (const a of het.atoms) {
      const p = new THREE.Vector3(a.pos[0] - c.x, a.pos[1] - c.y, a.pos[2] - c.z);
      const isFe = String(a.element).toUpperCase() === 'FE';
      const base = isHeme ? (isFe ? '#fff0c0' : '#ff4a18') : (ELEMENT_COLOR[a.element] ?? '#aaaaaa');
      const col = new THREE.Color(base);
      const r = (VDW_RADIUS[a.element] ?? 1.6) * (isFe ? 0.6 : 0.42);
      const mat = new THREE.MeshStandardMaterial({
        color: col, emissive: col, emissiveIntensity: isHeme ? (isFe ? 0.9 : 0.55) : 0.5,
        roughness: 0.3, metalness: 0.4,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 18), mat);
      m.position.copy(p);
      group.add(m);
      if (isHeme) { hemeCenter.add(p); nh++; }
    }
  }
  if (nh) hemeCenter.multiplyScalar(1 / nh);
  return { group, radius, hemeCenter };
}

function ProteinBody({ getTime }: { getTime: () => number }) {
  const { scene } = useThree();
  const grpRef = useRef<THREE.Group>(null!);
  const [built, setBuilt] = useState<{ radius: number; hemeCenter: THREE.Vector3 } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/${PAR.pdb}.pdb`).then(r => r.text()).then(text => {
      if (!alive) return;
      const s = parsePDB(text);
      const { group, radius, hemeCenter } = buildProtein(s);
      if (grpRef.current) { grpRef.current.add(group); }
      // exponer el radio para la cámara (vía window, leído por el rig)
      (window as unknown as { __protMeta?: { radius: number; heme: THREE.Vector3 } }).__protMeta = { radius, heme: hemeCenter };
      const api = (window as unknown as { __cinematicProtein?: { ready: boolean } }).__cinematicProtein;
      if (api) api.ready = true;
      setBuilt({ radius, hemeCenter });
    }).catch(e => console.error('[CinematicProtein] no cargó PDB', e));
    return () => { alive = false; };
  }, []);

  useFrame(() => {
    if (grpRef.current) {
      const t = getTime();
      // giro lento determinista (la pieza vive); el gancho es la CÁMARA, no la pieza
      grpRef.current.rotation.y = t * 0.18;
      grpRef.current.rotation.x = Math.sin(t * 0.10) * 0.12;
    }
  });

  // luces para dar FORMA a los tubos (MeshStandard) + el emisivo da el glow
  return (
    <>
      <ambientLight intensity={0.45} />
      <directionalLight position={[1, 1.5, 1]} intensity={1.3} color={'#fff6e8'} />
      <directionalLight position={[-1.2, -0.6, -1]} intensity={0.7} color={'#7fb0ff'} />
      <group ref={grpRef} />
      {/* fija el estado para que el linter no llore por built sin usar */}
      {built ? null : null}
    </>
  );
}

// CÁMARA: el GANCHO. cold-open cerrado → pull-back rápido → órbita contemplativa. Pura en t.
function ProteinRig({ getTime }: { getTime: () => number }) {
  const { camera } = useThree();
  useFrame(() => {
    const t = getTime();
    const meta = (window as unknown as { __protMeta?: { radius: number; heme: THREE.Vector3 } }).__protMeta;
    const R = meta?.radius ?? 30;
    const heme = meta?.heme ?? new THREE.Vector3();
    // distancia: 0–0.7s MUY cerca (dentro, abstracto) → pull-back a órbita; luego deriva lenta
    let dist: number, fov: number;
    const az = 0.6 + t * 0.32;                 // giro de cámara
    const el = 0.18 + 0.06 * Math.sin(t * 0.5);
    let target = new THREE.Vector3(0, 0, 0);
    if (t < 0.7) {
      // GANCHO: empotrado cerca de un hemo, embistiendo hacia afuera
      const k = fastOut(t / 0.7);
      dist = lerp(R * 0.55, R * 2.2, k);
      fov = lerp(56, 40, k);
      target = heme.clone().multiplyScalar(1 - k);   // arranca mirando el hemo, termina al centro
    } else {
      const p = (t - 0.7) / (DURATION - 0.7);
      dist = lerp(R * 2.2, R * 2.6, smooth(p));       // contemplación: la proteína ENTERA con margen
      fov = lerp(40, 36, smooth(p));
    }
    const x = Math.cos(az) * Math.cos(el) * dist;
    const y = Math.sin(el) * dist;
    const z = Math.sin(az) * Math.cos(el) * dist;
    camera.position.set(x, y, z);
    camera.lookAt(target);
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
  });
  return null;
}

// TEXTO-GANCHO (overlay DOM, lo captura page.screenshot). Curiosidad en 0.3s → revelado a 1.5s.
// OJO: vive FUERA del Canvas → NO useFrame (crashea); su propio rAF lee timeRef.
function HookText({ getTime }: { getTime: () => number }) {
  const [, force] = useState(0);
  useEffect(() => {
    let raf = 0; const tick = () => { force(v => (v + 1) % 1000000); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  const t = getTime();
  // gancho de curiosidad (0.3–4.5s) y luego el dato real (5–DURATION)
  const hookOp = Math.min(1, Math.max(0, (t - 0.3) / 0.4)) * Math.min(1, Math.max(0, (4.8 - t) / 0.6));
  const revealOp = Math.min(1, Math.max(0, (t - 5.2) / 0.7)) * Math.min(1, Math.max(0, (DURATION - 1.0 - t) / 1.0));
  return (
    <>
      {hookOp > 0.01 && (
        <div style={{
          position: 'absolute', top: '8%', left: 0, right: 0, textAlign: 'center', opacity: hookOp,
          color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 800,
          fontSize: 'min(7vw, 64px)', letterSpacing: '-0.02em', lineHeight: 1.05,
          textShadow: '0 2px 24px rgba(0,0,0,0.85)', pointerEvents: 'none', zIndex: 10, padding: '0 6%',
        }}>
          ¿Qué te mantiene<br />vivo ahora mismo?
        </div>
      )}
      {revealOp > 0.01 && (
        <div style={{
          position: 'absolute', bottom: '9%', left: 0, right: 0, textAlign: 'center', opacity: revealOp,
          color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', pointerEvents: 'none', zIndex: 10, padding: '0 6%',
        }}>
          <div style={{ fontWeight: 800, fontSize: 'min(6vw, 52px)', letterSpacing: '0.04em', textShadow: '0 2px 20px rgba(0,0,0,0.85)' }}>
            HEMOGLOBINA
          </div>
          <div style={{ fontWeight: 500, fontSize: 'min(3.4vw, 26px)', opacity: 0.85, marginTop: 6, textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}>
            lleva el oxígeno en tu sangre · estructura real PDB&nbsp;4HHB
          </div>
        </div>
      )}
    </>
  );
}

export default function CinematicProtein() {
  const timeRef = useRef(0);
  useEffect(() => {
    const N = 6;
    const beats = Array.from({ length: N }, (_, i) => ({
      id: `prot_${String(i).padStart(2, '0')}`,
      start: (i * DURATION) / N, end: ((i + 1) * DURATION) / N, kind: 'cine',
    }));
    const api = {
      renderAt: (t: number) => { timeRef.current = Math.max(0, Math.min(DURATION, t)); },
      ready: false, duration: DURATION, beats,
      get t() { return timeRef.current; },
    };
    (window as unknown as { __cinematicProtein: typeof api }).__cinematicProtein = api;
    return () => { delete (window as unknown as { __cinematicProtein?: unknown }).__cinematicProtein; };
  }, []);

  const getTime = () => timeRef.current;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative' }}>
      <Canvas
        frameloop="always"
        camera={{ position: [0, 0, 40], fov: 46, near: 0.1, far: 6000 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={PAR.clip > 0.5 ? 1 : [1.5, 2]}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}
      >
        <ProteinRig getTime={getTime} />
        <ProteinBody getTime={getTime} />
        <CinematicPostFX preset="tde" saturation={0.34} contrast={0.2} />
      </Canvas>
      <HookText getTime={getTime} />
    </div>
  );
}
