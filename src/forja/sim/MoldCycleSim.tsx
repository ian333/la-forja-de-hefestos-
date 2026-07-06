/**
 * SIMULACIÓN VIVA DEL CICLO DE INYECCIÓN — dentro de La Forja (no un video externo).
 * ==================================================================================
 * TODO AL MISMO TIEMPO, alimentado por el motor físico `cycle-engine.ts` (Kazmer):
 *  · CIERRE/APERTURA/EXPULSIÓN: cinemática real del molde de 2 placas (carreras).
 *  · LLENADO: la pieza aparece por el FRENTE real (base radial → pared sube), no un fade.
 *  · TÉRMICO: SECCIÓN VIVA — clipping plane + textura FDM del campo de temperatura,
 *    partida en mitad fija / mitad móvil (viaja con el core al abrir).
 *  · ESTRÉS: F_apertura = P·A vs clamp → deflexión de placas → aviso de FUGA (FLASH)
 *    parpadeando en la línea de partición. ESO es lo que verifica un simulador.
 *  · AGUA: partículas recorriendo los canales, coloreadas por el ΔT del refrigerante.
 * Superpoderes: sección, rayos-X, demo "placa delgada" (provoca el flash a propósito).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createCycleSim, type CycleState } from './cycle-engine';

// ── molde del VASO (cup Kazmer): dimensiones del export canónico ──
const W = 140, D = 140, Z_PART = 70;
const CUP_RO = 30, CUP_RI = 27, CUP_H = 70, CUP_BASE = 3;

// rejilla FDM alineada a la geometría: x∈[-70,70], z∈[-30,125] (1 celda = 1 mm)
const GRID = {
  nx: 140, ny: 155, hM: 1e-3,
  cavX0: 40, cavX1: 100,          // base del vaso: x ∈ [-30, 30]
  cavY0: 30, cavY1: 33,           // z ∈ [0, 3] (el slab de plástico)
  channels: [
    { x: 30, y: 15, r: 3.2 }, { x: 70, y: 15, r: 3.2 }, { x: 110, y: 15, r: 3.2 },   // agua placa cavidad (z=-15)
    { x: 30, y: 115, r: 3.2 }, { x: 70, y: 115, r: 3.2 }, { x: 110, y: 115, r: 3.2 }, // agua placa core (z=+85)
  ],
  fillMode: 'center' as const,          // gate central del vaso → el frente 2D sale del CENTRO
};
const CH_FIX = [{ x: -40, z: -15 }, { x: 0, z: -15 }, { x: 40, z: -15 }];
const CH_MOV = [{ x: -40, z: 85 }, { x: 0, z: 85 }, { x: 40, z: 85 }];

// CÁMARA DELIBERADA: presets por momento del ciclo (el drive corta por beat con
// window.__cycleCam('nombre'); el lerp con peso vive en useFrame). Nada de random.
const CAM_PRESETS: Record<string, { pos: [number, number, number]; tgt: [number, number, number] }> = {
  frontal:     { pos: [122, -208, 148], tgt: [0, 0, 15] },
  tresCuartos: { pos: [185, -155, 195], tgt: [0, 0, 35] },
  slab:        { pos: [38, -128, 46],   tgt: [0, 0, 4] },     // close-up del frente llenando
  apertura:    { pos: [238, -192, 262], tgt: [0, -18, 82] },  // 3/4 alta: molde abierto + pieza saliendo
  low:         { pos: [98, -218, 16],   tgt: [0, 0, 58] },    // contrapicada dramática (FLASH)
};

const cycleParams = (thinPlate: boolean) => ({
  flowLenM: 0.1, wallM: 0.003, vMeanMs: 0.35, projAreaM2: Math.PI * 0.03 * 0.03,
  clampTons: thinPlate ? 8 : 45,
  bendSpanM: 0.16, bendWM: 0.2, bendHM: thinPlate ? 0.03 : 0.1,   // 30 mm → δ 31 µm > venteo 20 µm = FUGA
  tCoolS: 18.91, grid: GRID,
});

const PHASE_LABEL: Record<string, string> = {
  cierre: 'CIERRE', inyeccion: 'INYECCIÓN', empaque: 'EMPAQUE', enfriamiento: 'ENFRIAMIENTO',
  apertura: 'APERTURA', expulsion: 'EXPULSIÓN', caida: 'CAÍDA', retorno: 'RETORNO',
};

function plateWithHole(w: number, d: number, h: number, holeR: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, holeR, 0, Math.PI * 2, true); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 48 });
}
function tube(ro: number, ri: number, h: number) {
  const s = new THREE.Shape(); s.absarc(0, 0, ro, 0, Math.PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, ri, 0, Math.PI * 2, true); s.holes.push(hole);
  return new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 48 });
}
const boxG = (w: number, d: number, h: number) => new THREE.BoxGeometry(w, d, h);
const cylZ = (r: number, h: number, seg = 32) => new THREE.CylinderGeometry(r, r, h, seg).rotateX(Math.PI / 2);

interface SceneProps {
  playing: boolean; speed: number; section: boolean; xray: boolean; thinPlate: boolean; orbit: boolean;
  stRef: React.MutableRefObject<CycleState | null>;
}

function MoldScene({ playing, speed, section, xray, thinPlate, orbit, stRef }: SceneProps) {
  const sim = useMemo(() => createCycleSim(cycleParams(thinPlate)), [thinPlate]);
  const secPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5), []);
  // la pieza tiene SU propia copia del plano de sección: al expulsar/caer viaja
  // hacia la cámara (y<0) y el plano compartido se la COMÍA (invisible en v1)
  const partSecPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e5), []);
  const fillPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e5), []);

  // materiales de acero (compartidos, con clipping de sección) — refs para rayos-X
  const steel = useMemo(() => {
    const mk = (color: string, metal = 0.45, rough = 0.48) => new THREE.MeshStandardMaterial({
      color, metalness: metal, roughness: rough, side: THREE.DoubleSide,
      clippingPlanes: [secPlane], transparent: true, opacity: 1,
    });
    return {
      cavity: mk('#8fa3bd'), core: mk('#8d9cb0'), clamp: mk('#7c8ba0'), rail: mk('#6b7a8f'),
      ejector: mk('#c9a227', 0.5, 0.42), pin: mk('#e0b840', 0.55, 0.3), pilar: mk('#9fb0c4', 0.55, 0.3),
      sprue: mk('#d08040', 0.5, 0.4),
    };
  }, [secPlane]);
  const plasticMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff7a1f', emissive: '#e85d08', emissiveIntensity: 1.0, metalness: 0, roughness: 0.5,
    clippingPlanes: [fillPlane, partSecPlane], side: THREE.DoubleSide,
  }), [fillPlane, partSecPlane]);
  const waterTubeMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2b7fff', transparent: true, opacity: 0.3, metalness: 0.1, roughness: 0.2,
    clippingPlanes: [secPlane],
  }), [secPlane]);
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff2222', transparent: true, opacity: 0.5, toneMapped: false, side: THREE.DoubleSide,
  }), []);

  useEffect(() => {
    const mats = Object.values(steel);
    for (const m of mats) m.opacity = xray ? 0.26 : 1;
    waterTubeMat.opacity = xray ? 0.55 : 0.3;
  }, [xray, steel, waterTubeMat]);

  // textura de la SECCIÓN VIVA (una imagen FDM, dos quads: mitad fija / mitad móvil)
  const thermTex = useMemo(() => {
    const t0 = sim.thermalTexture();
    const tex = new THREE.DataTexture(t0.data.slice(), t0.w, t0.h, THREE.RGBAFormat);
    tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
    return tex;
  }, [sim]);
  const thermMat = useMemo(() => new THREE.MeshBasicMaterial({ map: thermTex, toneMapped: false, side: THREE.DoubleSide }), [thermTex]);
  const quadFixG = useMemo(() => {                                  // z ∈ [-30, 70] → v ∈ [0, 100/155]
    const g = new THREE.PlaneGeometry(W, 100);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (100 / 155));
    g.rotateX(Math.PI / 2); return g;
  }, []);
  const quadMovG = useMemo(() => {                                  // z ∈ [70, 125] → v ∈ [100/155, 1]
    const g = new THREE.PlaneGeometry(W, 55);
    const uv = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, 100 / 155 + uv.getY(i) * (55 / 155));
    g.rotateX(Math.PI / 2); return g;
  }, []);

  // agua: puntos que RECORREN los canales (26 por canal × 6)
  const NPART = 26;
  const water = useMemo(() => {
    const mk = (chs: { x: number; z: number }[]) => {
      const n = chs.length * NPART;
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.PointsMaterial({ size: 3.4, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, clippingPlanes: [secPlane] });
      return { g, m, pos, col, chs };
    };
    return { fix: mk(CH_FIX), mov: mk(CH_MOV) };
  }, [secPlane]);

  // geometrías (una sola vez — nada de hooks dentro de JSX/map)
  const geo = useMemo(() => ({
    cavityWall: plateWithHole(W, D, CUP_H, CUP_RO + 0.05),
    cavityBase: boxG(W, D, 30), support: boxG(W, D, 25), rail: boxG(40, D, 60),
    rearClamp: boxG(W, D, 20), pilar: cylZ(10, 155),
    waterTube: new THREE.CylinderGeometry(3.2, 3.2, D, 20),
    ejPlate: boxG(W - 100, D - 30, 10), ejRetainer: boxG(W - 100, D - 30, 14), pin: cylZ(2.5, 76, 16),
    corePlate: boxG(W, D, 30), coreBoss: tube(CUP_RI, 3, CUP_H - CUP_BASE), topClamp: boxG(W, D, 20),
    sprueBush: cylZ(8, 26, 24), locRing: cylZ(20, 5, 32), sprueRod: cylZ(3, 122, 16),
    cupBase: cylZ(CUP_RO, CUP_BASE, 48), cupWall: tube(CUP_RO, CUP_RI, CUP_H - CUP_BASE),
    flashRing: (() => {                                        // MARCO en la partición (no mantel)
      const s = new THREE.Shape();
      s.moveTo(-(W + 10) / 2, -(D + 10) / 2); s.lineTo((W + 10) / 2, -(D + 10) / 2);
      s.lineTo((W + 10) / 2, (D + 10) / 2); s.lineTo(-(W + 10) / 2, (D + 10) / 2); s.closePath();
      const h = new THREE.Path();
      h.moveTo(-(W - 4) / 2, -(D - 4) / 2); h.lineTo(-(W - 4) / 2, (D - 4) / 2);
      h.lineTo((W - 4) / 2, (D - 4) / 2); h.lineTo((W - 4) / 2, -(D - 4) / 2); h.closePath();
      s.holes.push(h);
      return new THREE.ExtrudeGeometry(s, { depth: 2.2, bevelEnabled: false });
    })(), floor: boxG(900, 900, 2),
  }), []);

  const movingRef = useRef<THREE.Group>(null!);
  const ejectorRef = useRef<THREE.Group>(null!);
  const partRef = useRef<THREE.Group>(null!);
  const baseRef = useRef<THREE.Mesh>(null!);
  const sprueRodRef = useRef<THREE.Mesh>(null!);
  const flashRef = useRef<THREE.Mesh>(null!);
  const quadsRef = useRef<THREE.Group>(null!);
  const quadMovRef = useRef<THREE.Mesh>(null!);
  const frame = useRef(0); const waterPhase = useRef(0);
  const controlsRef = useRef<any>(null);
  const camPreset = useRef<{ pos: THREE.Vector3; tgt: THREE.Vector3 } | null>(null);
  useEffect(() => {
    (window as any).__cycleCam = (name: string) => {
      const p2 = CAM_PRESETS[name];
      if (p2) camPreset.current = { pos: new THREE.Vector3(...p2.pos), tgt: new THREE.Vector3(...p2.tgt) };
      return !!p2;
    };
    return () => { delete (window as any).__cycleCam; };
  }, []);
  const COLD = useMemo(() => new THREE.Color('#cfc6ba'), []);   // ABS natural (crema) — azul+luz cálida daba LILA
  const HOT = useMemo(() => new THREE.Color('#ff8c1e'), []);
  const W_IN = useMemo(() => new THREE.Color('#35c0ff'), []);
  const W_OUT = useMemo(() => new THREE.Color('#ffd23f'), []);
  const tmpC = useMemo(() => new THREE.Color(), []);

  useFrame(({ camera }, delta) => {
    secPlane.constant = section ? 0 : 1e5;
    const stPrev = stRef.current;
    const ejecting = !!stPrev && (stPrev.ejectMm > 0.5 || stPrev.partDropMm > 0.5);
    partSecPlane.constant = section && !ejecting ? 0 : 1e5;      // pieza LIBRE fuera del molde
    // cámara con PESO: lerp exponencial hacia el preset pedido por el drive
    if (camPreset.current && controlsRef.current) {
      const a = 1 - Math.exp(-2.2 * Math.min(delta, 0.1));
      camera.position.lerp(camPreset.current.pos, a);
      controlsRef.current.target.lerp(camPreset.current.tgt, a);
    }
    controlsRef.current?.update();                               // sin esto la órbita NUNCA gira
    if (!playing) return;
    const dt = Math.min(delta, 1 / 30) * speed;
    const st = sim.step(dt);
    stRef.current = st;
    (window as unknown as { __cycleSimState?: CycleState }).__cycleSimState = st;

    // cinemática: mitad móvil + paquete eyector + pieza
    movingRef.current.position.z = st.openMm;
    ejectorRef.current.position.z = st.ejectMm;
    const drop = st.partDropMm;
    partRef.current.visible = st.partVisible;
    // sale hacia la cámara y ATERRIZA en el piso (z=-204+radio), sin atravesarlo
    partRef.current.position.set(0, -Math.min(drop * 1.4, 96), Math.max(st.ejectMm - Math.max(0, drop - 60) * 1.35, -201));
    partRef.current.rotation.x = Math.min(drop / 260, 1) * 1.35;   // se vuelca al caer

    // LLENADO por frente real: base radial (0→30 mm) y luego la pared sube (30→100 mm)
    const s = st.fillFrac * 100;
    const bs = Math.max(1e-3, Math.min(1, s / 30));
    baseRef.current.scale.set(bs, bs, 1);
    fillPlane.constant = CUP_BASE + Math.max(0, s - 30) + (s > 99 ? 6 : 0);
    if (sprueRodRef.current) sprueRodRef.current.visible = st.fillFrac > 0.05 && ['inyeccion', 'empaque', 'enfriamiento', 'apertura'].includes(st.phase);

    // el plástico ENFRÍA de verdad: color por T̄ del FDM
    const u = Math.max(0, Math.min(1, (st.meltTempC - 60) / 180));
    plasticMat.color.lerpColors(COLD, HOT, u);
    plasticMat.emissive.lerpColors(COLD, HOT, u);
    plasticMat.emissiveIntensity = 0.06 + 1.05 * u;            // caliente BRILLA, fría = crema mate (visible por la point light)

    // FUGA (flash) parpadeando en la línea de partición
    flashRef.current.visible = st.flash;
    flashMat.opacity = 0.3 + 0.45 * Math.abs(Math.sin(st.t * 9));

    // agua: avanzar partículas + color entrada→salida por ΔT real
    waterPhase.current += dt * 120;
    const dTu = Math.max(0, Math.min(1, st.heatToWaterW / 15000));   // Q real (W/m de seccion)
    for (const side of [water.fix, water.mov]) {
      for (let c = 0; c < side.chs.length; c++) for (let i = 0; i < NPART; i++) {
        const k = c * NPART + i;
        const y = (((waterPhase.current + i * (D / NPART) + c * 17) % D) + D) % D - D / 2;
        side.pos[k * 3] = side.chs[c].x; side.pos[k * 3 + 1] = y; side.pos[k * 3 + 2] = side.chs[c].z;
        tmpC.lerpColors(W_IN, W_OUT, ((y + D / 2) / D) * dTu);
        side.col[k * 3] = tmpC.r; side.col[k * 3 + 1] = tmpC.g; side.col[k * 3 + 2] = tmpC.b;
      }
      side.g.attributes.position.needsUpdate = true;
      side.g.attributes.color.needsUpdate = true;
    }

    // sección viva: refrescar la textura FDM (cada 6 frames)
    quadsRef.current.visible = section;
    if (quadMovRef.current) quadMovRef.current.visible = section;
    if (frame.current++ % 6 === 0 && section) {
      const t = sim.thermalTexture();
      (thermTex.image.data as Uint8Array).set(t.data);
      thermTex.needsUpdate = true;
    }
  });

  return (
    <group>
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#7d90ac', '#241d14', 0.75]} />
      <directionalLight position={[240, -320, 420]} intensity={2.1} />
      <directionalLight position={[-260, 220, 160]} intensity={0.65} color="#9db8ff" />
      <directionalLight position={[0, -400, -80]} intensity={0.35} color="#ffd9a0" />
      <OrbitControls ref={controlsRef} makeDefault target={[0, 0, 15]} autoRotate={orbit} autoRotateSpeed={2.2} maxDistance={1400} />

      {/* piso de referencia (la pieza CAE hasta acá) */}
      <mesh position={[0, 0, -205]} geometry={geo.floor}><meshStandardMaterial color="#10151d" roughness={0.85} metalness={0.2} /></mesh>
      {/* luz cálida a la zona de la pieza: que el vaso SE VEA al abrir/caer */}
      <pointLight position={[0, -95, 45]} intensity={2.2} distance={340} decay={1.6} color="#ffd9b0" />

      {/* ── MITAD FIJA (lado cavidad + paquete eyector) ── */}
      <group>
        <mesh geometry={geo.cavityWall} material={steel.cavity} />
        <mesh geometry={geo.cavityBase} material={steel.cavity} position={[0, 0, -15]} />
        <mesh geometry={geo.support} material={steel.clamp} position={[0, 0, -42.5]} />
        <mesh geometry={geo.rail} material={steel.rail} position={[-50, 0, -85]} />
        <mesh geometry={geo.rail} material={steel.rail} position={[50, 0, -85]} />
        <mesh geometry={geo.rearClamp} material={steel.clamp} position={[0, 0, -125]} />
        {[[-48, -48], [48, -48], [-48, 48], [48, 48]].map(([x, y], i) => (
          <mesh key={i} geometry={geo.pilar} material={steel.pilar} position={[x, y, 22.5]} />
        ))}
        {CH_FIX.map((c, i) => (
          <mesh key={i} geometry={geo.waterTube} material={waterTubeMat} position={[c.x, 0, c.z]} />
        ))}
        <points geometry={water.fix.g} material={water.fix.m} />
      </group>

      {/* paquete EYECTOR (sube con ejectMm y empuja el labio del vaso) */}
      <group ref={ejectorRef}>
        <mesh geometry={geo.ejPlate} material={steel.ejector} position={[0, 0, -95]} />
        <mesh geometry={geo.ejRetainer} material={steel.ejector} position={[0, 0, -83]} />
        {[0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((a, i) => (
          <mesh key={i} geometry={geo.pin} material={steel.pin}
            position={[28.5 * Math.cos(a), 28.5 * Math.sin(a), -38]} />
        ))}
      </group>

      {/* ── MITAD MÓVIL (core + clamp superior + sprue) — abre subiendo openMm ── */}
      <group ref={movingRef}>
        <mesh geometry={geo.corePlate} material={steel.core} position={[0, 0, 85]} />
        <mesh geometry={geo.coreBoss} material={steel.core} position={[0, 0, CUP_BASE]} />
        <mesh geometry={geo.topClamp} material={steel.clamp} position={[0, 0, 110]} />
        <mesh geometry={geo.sprueBush} material={steel.sprue} position={[0, 0, 107]} />
        <mesh geometry={geo.locRing} material={steel.sprue} position={[0, 0, 122.5]} />
        <mesh ref={sprueRodRef} geometry={geo.sprueRod} material={plasticMat} position={[0, 0, 64]} visible={false} />
        {CH_MOV.map((c, i) => (
          <mesh key={i} geometry={geo.waterTube} material={waterTubeMat} position={[c.x, 0, c.z]} />
        ))}
        <points geometry={water.mov.g} material={water.mov.m} />
        {/* sección viva de la mitad móvil: viaja con el core al abrir */}
        <mesh ref={quadMovRef} geometry={quadMovG} material={thermMat} position={[0, -0.08, 97.5]} />
      </group>

      {/* ── LA PIEZA (vaso): base crece radial + pared revelada por el frente ── */}
      <group ref={partRef} visible={false}>
        <mesh ref={baseRef} geometry={geo.cupBase} material={plasticMat} position={[0, 0, CUP_BASE / 2]} />
        <mesh geometry={geo.cupWall} material={plasticMat} position={[0, 0, CUP_BASE]} />
      </group>

      {/* aviso de FUGA en la línea de partición */}
      <mesh ref={flashRef} geometry={geo.flashRing} material={flashMat} position={[0, 0, Z_PART]} visible={false} />

      {/* sección viva — mitad fija */}
      <group ref={quadsRef} visible={false}>
        <mesh geometry={quadFixG} material={thermMat} position={[0, -0.08, 20]} />
      </group>
    </group>
  );
}

// ── barra / número del HUD ──
function Bar({ label, value, max, unit, warn, testid }: { label: string; value: number; max: number; unit: string; warn?: boolean; testid?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, opacity: 0.85 }}>
        <span>{label}</span>
        <span data-testid={testid} style={{ color: warn ? '#ff5c5c' : '#e9eef5', fontWeight: 700 }}>{value.toFixed(1)} {unit}</span>
      </div>
      <div style={{ height: 5, background: '#1a2230', borderRadius: 3, marginTop: 2 }}>
        <div style={{ height: 5, width: `${pct}%`, background: warn ? '#ff4444' : '#4c9fff', borderRadius: 3, transition: 'width 120ms linear' }} />
      </div>
    </div>
  );
}

const BTN: React.CSSProperties = {
  background: 'rgba(20,28,40,0.92)', border: '1px solid #2c3a50', color: '#dfe7f2', cursor: 'pointer',
  borderRadius: 7, padding: '6px 10px', fontSize: 11.5, fontFamily: "'JetBrains Mono', monospace",
};
const BTN_ON: React.CSSProperties = { ...BTN, background: '#4c9fff', color: '#08111f', borderColor: '#4c9fff', fontWeight: 700 };

export default function MoldCycleSim({ onClose }: { onClose: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [section, setSection] = useState(true);
  const [xray, setXray] = useState(false);
  const [thinPlate, setThinPlate] = useState(false);
  const [orbit, setOrbit] = useState(false);
  const [hud, setHud] = useState<CycleState | null>(null);
  const stRef = useRef<CycleState | null>(null);
  useEffect(() => {
    const id = setInterval(() => { if (stRef.current) setHud({ ...stRef.current }); }, 110);
    return () => clearInterval(id);
  }, []);
  const piezas = hud ? hud.cycle - 1 + (['caida', 'retorno'].includes(hud.phase) ? 1 : 0) : 0;
  // HUD legible en grabaciones 4K nativas: escala x2 por transform (no toca el canvas)
  const k = typeof window !== 'undefined' && window.innerWidth >= 3000 ? 2 : 1;

  return (
    <div data-testid="cycle-view" style={{ position: 'fixed', inset: 0, zIndex: 90, background: '#05070b', fontFamily: "'JetBrains Mono', monospace", color: '#e9eef5' }}>
      <Canvas gl={{ antialias: true }} camera={{ position: [122, -208, 148], fov: 42, near: 1, far: 5000, up: [0, 0, 1] }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.setClearColor('#05070b'); }}>
        <MoldScene playing={playing} speed={speed} section={section} xray={xray} thinPlate={thinPlate} orbit={orbit} stRef={stRef} />
      </Canvas>

      {/* título */}
      <div style={{ position: 'absolute', top: 14, left: 18, pointerEvents: 'none', transform: `scale(${k})`, transformOrigin: 'top left' }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 1 }}>CICLO DE INYECCIÓN · SIMULACIÓN VIVA</div>
        <div style={{ fontSize: 10.5, opacity: 0.65, marginTop: 2 }}>
          vaso ABS pared 3 mm · molde 2 placas · física Kazmer (llenado + clamp/fuga + FDM térmico + agua)
        </div>
      </div>

      {/* aviso de FUGA */}
      {hud?.flash && (
        <div data-testid="cycle-flash" style={{
          position: 'absolute', top: 60 * k, left: '50%', transform: `translateX(-50%) scale(${k})`, transformOrigin: 'top center',
          background: 'rgba(160,10,10,0.92)', border: '1px solid #ff6666', borderRadius: 8,
          padding: '8px 16px', fontSize: 12.5, fontWeight: 800, animation: 'cycleBlink 0.5s infinite alternate',
        }}>
          ⚠ FUGA (FLASH) — δ = {hud.deflectionMm.toFixed(3)} mm &gt; venteo 0.020 mm: el plástico ABRE el molde
        </div>
      )}

      {/* tarjeta de estado */}
      <div style={{ position: 'absolute', top: 58, right: 16, width: 235, background: 'rgba(10,14,22,0.9)', border: '1px solid #223046', borderRadius: 10, padding: '11px 13px', transform: `scale(${k})`, transformOrigin: 'top right' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span data-testid="cycle-phase" style={{ fontSize: 13, fontWeight: 800, color: '#4c9fff' }}>{hud ? PHASE_LABEL[hud.phase] : '—'}</span>
          <span data-testid="cycle-clock" style={{ fontSize: 12, opacity: 0.8 }}>{hud ? hud.t.toFixed(1) : '0.0'} s</span>
        </div>
        <Bar label="Llenado" value={(hud?.fillFrac ?? 0) * 100} max={100} unit="%" testid="cycle-fill" />
        <Bar label="P inyección" value={hud?.pressureMPa ?? 0} max={30} unit="MPa" testid="cycle-p" />
        <Bar label="F apertura (P·A)" value={hud?.openForceTons ?? 0} max={thinPlate ? 10 : 45} unit="ton" warn={(hud?.clampMarginTons ?? 1) < 0} testid="cycle-fopen" />
        <Bar label="Deflexión placas" value={(hud?.deflectionMm ?? 0) * 1000} max={40} unit="µm" warn={!!hud?.flash} testid="cycle-defl" />
        <Bar label="Acero máx" value={hud?.steelMaxC ?? 60} max={120} unit="°C" testid="cycle-steel" />
        <Bar label="Q̇ al agua" value={hud?.heatToWaterW ?? 0} max={18000} unit="W/m" testid="cycle-water" />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, opacity: 0.85, marginTop: 4 }}>
          <span>T̄ plástico</span><span data-testid="cycle-melt">{(hud?.meltTempC ?? 0).toFixed(0)} °C</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 3 }}>
          <span>margen clamp</span>
          <span data-testid="cycle-margin" style={{ color: (hud?.clampMarginTons ?? 1) < 5 ? '#ff5c5c' : '#59d98c', fontWeight: 700 }}>
            {(hud?.clampMarginTons ?? 0).toFixed(1)} ton
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 3 }}>
          <span>piezas producidas</span><span data-testid="cycle-parts" style={{ fontWeight: 800, color: '#ffd23f' }}>{piezas}</span>
        </div>
      </div>

      {/* línea de fases */}
      <div style={{ position: 'absolute', bottom: 62 * k, left: '50%', transform: `translateX(-50%) scale(${k})`, transformOrigin: 'bottom center', display: 'flex', gap: 5 }}>
        {Object.entries(PHASE_LABEL).map(([k, v]) => (
          <div key={k} style={{
            padding: '4px 9px', borderRadius: 6, fontSize: 9.5, letterSpacing: 0.5,
            background: hud?.phase === k ? '#4c9fff' : 'rgba(16,22,34,0.85)',
            color: hud?.phase === k ? '#08111f' : '#8fa0b8', fontWeight: hud?.phase === k ? 800 : 500,
            border: '1px solid #223046',
          }}>{v}</div>
        ))}
      </div>

      {/* controles */}
      <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: `translateX(-50%) scale(${k})`, transformOrigin: 'bottom center', display: 'flex', gap: 7, alignItems: 'center' }}>
        <button data-testid="cycle-play" style={playing ? BTN_ON : BTN} onClick={() => setPlaying((p) => !p)}>{playing ? '⏸' : '▶'}</button>
        {[1, 2, 4, 8].map((v) => (
          <button key={v} data-testid={`cycle-speed-${v}`} style={speed === v ? BTN_ON : BTN} onClick={() => setSpeed(v)}>×{v}</button>
        ))}
        <button data-testid="cycle-section" style={section ? BTN_ON : BTN} onClick={() => setSection((s) => !s)}>🔪 Sección</button>
        <button data-testid="cycle-xray" style={xray ? BTN_ON : BTN} onClick={() => setXray((x) => !x)}>👁 Rayos X</button>
        <button data-testid="cycle-orbit" style={orbit ? BTN_ON : BTN} onClick={() => setOrbit((o) => !o)}>🎥 Órbita</button>
        <button data-testid="cycle-flashdemo" style={thinPlate ? { ...BTN_ON, background: '#ff4444', borderColor: '#ff4444' } : BTN}
          onClick={() => setThinPlate((t) => !t)} title="Placas de 30 mm + clamp de 8 ton: δ 31 µm > venteo → FUGA">
          ⚠ Placa delgada
        </button>
        <button data-testid="cycle-close" style={BTN} onClick={onClose}>✕ Cerrar</button>
      </div>
      <style>{`@keyframes cycleBlink { from { opacity: 1; } to { opacity: 0.55; } }`}</style>
    </div>
  );
}
