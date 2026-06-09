/**
 * MicroscopioCorriente — bajar del símbolo del circuito a la FÍSICA REAL.
 *
 * No "cablecitos con puntitos". Aquí se VE lo que de verdad pasa:
 *   1. RESISTENCIA — los electrones aceleran en el campo E, chocan contra la
 *      red de iones y le entregan su energía → la red se PONE AL ROJO. Eso es
 *      "la corriente se vuelve calor" (Drude, potencia ∝ E² = I²R).
 *   2. BOBINA — el campo magnético REAL (Biot-Savart) enhebra la espira:
 *      recto adentro, en lazos afuera. Subir la corriente lo enciende.
 *   3. LED — un electrón cae a un hueco en la unión y suelta un FOTÓN cuyo
 *      color lo fija el band gap del material (λ = h·c/E_g), no el voltaje.
 *
 * Toda la física sale de src/lib/circuitos/microfisica.ts (12 tests vs fórmula).
 * El brillo viene de materiales emisivos + halos additive (Stage no usa bloom
 * por compatibilidad de GPU — sirve igual en teléfonos).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import Stage from '@/physics/components/Stage';
import { getParticleTexture } from '@/labs/components/sprite-texture';
import {
  makeRng, stepDrude, helixSegments, biotSavart,
  bandgapToWavelengthNm, wavelengthToRGB, type Vec3, type DrudeElectron,
} from '@/lib/circuitos/microfisica';

type View = 'resistencia' | 'bobina' | 'led';

export default function MicroscopioCorriente() {
  const [view, setView] = useState<View>('resistencia');
  const [voltage, setVoltage] = useState(2.2);   // resistencia
  const [current, setCurrent] = useState(2.5);   // bobina
  const [ledV, setLedV] = useState(2.4);          // led
  const [material, setMaterial] = useState(2); // índice de material LED

  // reset de sliders al cambiar de vista (cada vista tiene su rango propio)
  const tabs: { id: View; label: string; icon: string }[] = [
    { id: 'resistencia', label: 'Resistencia → calor', icon: '🔥' },
    { id: 'bobina', label: 'Bobina → campo', icon: '🧲' },
    { id: 'led', label: 'LED → luz', icon: '💡' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-3 h-full p-3 overflow-hidden">
      {/* Escena 3D */}
      <div className="flex flex-col gap-3 min-h-0">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setView(t.id)}
              className={`px-3 py-1.5 rounded-md text-[12px] font-medium border transition-colors ${
                t.id === view ? 'bg-[#d4b050] text-[#181d2e] border-[#d4b050]'
                              : 'bg-[#1e2538] text-[#a0947e] border-[#2c2818] hover:border-[#3e3624]'}`}>
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 rounded-lg border border-[#2c2818] overflow-hidden bg-black" style={{ minHeight: 380 }}>
          <Stage cameraDistance={view === 'resistencia' ? 9 : 7} autoRotate={view === 'bobina'} enablePan={false} bgColor="#04060a">
            {view === 'resistencia' && <ResistorScene voltage={voltage} />}
            {view === 'bobina' && <CoilScene current={current} />}
            {view === 'led' && <LedScene voltage={ledV} eg={LED_MATERIALS[material].eg} />}
          </Stage>
        </div>
      </div>

      {/* Explicación + controles */}
      <div className="flex flex-col gap-3 min-h-0 overflow-auto">
        {view === 'resistencia' && <ResistorPanel voltage={voltage} setVoltage={setVoltage} />}
        {view === 'bobina' && <CoilPanel current={current} setCurrent={setCurrent} />}
        {view === 'led' && (
          <LedPanel voltage={ledV} setVoltage={setLedV} material={material} setMaterial={setMaterial} />
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 1) RESISTENCIA — la corriente se vuelve calor (Drude)
// ════════════════════════════════════════════════════════════════════════

const NX = 8, NY = 3, NZ = 3;          // red de iones
const N_IONS = NX * NY * NZ;
const N_E = 130;                        // electrones
const BOX = { x: 4.2, y: 1.5, z: 1.5 }; // medio-anchos de la caja

const COLD = new THREE.Color(0.10, 0.16, 0.34);
const WARM = new THREE.Color(1.0, 0.42, 0.08);
const HOT = new THREE.Color(1.0, 0.95, 0.85);
const tmpColor = new THREE.Color();
function tempToColor(t: number, out: THREE.Color): THREE.Color {
  const x = Math.min(1, Math.max(0, t));
  if (x < 0.5) out.copy(COLD).lerp(WARM, x / 0.5);
  else out.copy(WARM).lerp(HOT, (x - 0.5) / 0.5);
  return out;
}

function ionPositions(): Vec3[] {
  const pts: Vec3[] = [];
  for (let i = 0; i < NX; i++)
    for (let j = 0; j < NY; j++)
      for (let k = 0; k < NZ; k++) {
        const x = ((i + 0.5) / NX - 0.5) * 2 * BOX.x;
        const y = ((j + 0.5) / NY - 0.5) * 2 * BOX.y;
        const z = ((k + 0.5) / NZ - 0.5) * 2 * BOX.z;
        pts.push([x, y, z]);
      }
  return pts;
}

function ResistorScene({ voltage }: { voltage: number }) {
  const ionsRef = useRef<THREE.InstancedMesh>(null);
  const ions = useMemo(ionPositions, []);
  const temps = useRef<Float32Array>(new Float32Array(N_IONS));
  const haloGeom = useRef<THREE.BufferGeometry>(null);
  const haloColors = useMemo(() => new Float32Array(N_IONS * 3), []);
  const haloPos = useMemo(() => {
    const a = new Float32Array(N_IONS * 3);
    ions.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = p[1]; a[i * 3 + 2] = p[2]; });
    return a;
  }, [ions]);

  // electrones
  const eState = useRef<DrudeElectron[]>(
    Array.from({ length: N_E }, (_, i) => ({
      x: (i / N_E - 0.5) * 2 * BOX.x,
      y: (Math.sin(i * 12.9) * 0.5) * BOX.y,
      z: (Math.cos(i * 7.3) * 0.5) * BOX.z,
      vx: 0, vy: 0, vz: 0,
    })),
  );
  const eGeom = useRef<THREE.BufferGeometry>(null);
  const ePos = useMemo(() => new Float32Array(N_E * 3), []);
  const eCol = useMemo(() => new Float32Array(N_E * 3), []);
  const rng = useMemo(() => makeRng(20260609), []);
  const sprite = useMemo(() => getParticleTexture(), []);

  // matriz base de los iones (posición fija)
  useEffect(() => {
    const mesh = ionsRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    ions.forEach((p, i) => { m.setPosition(p[0], p[1], p[2]); mesh.setMatrixAt(i, m); });
    mesh.instanceMatrix.needsUpdate = true;
  }, [ions]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    const accel = voltage * 0.9;          // el campo E ∝ voltaje
    const tau = 0.22, vth = 2.6;          // jiggle térmico ≫ arrastre (real)
    const T = temps.current;
    // 1) electrones: Drude + depósito de calor en el ion más cercano
    const E = eState.current;
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < N_E; i++) {
        const e = E[i];
        const r = stepDrude(e, accel, step * 0.5, tau, vth, rng);
        // rebote suave en y,z; reciclado periódico en x (corriente continua)
        if (Math.abs(e.y) > BOX.y) { e.vy *= -1; e.y = Math.sign(e.y) * BOX.y; }
        if (Math.abs(e.z) > BOX.z) { e.vz *= -1; e.z = Math.sign(e.z) * BOX.z; }
        if (e.x > BOX.x) e.x -= 2 * BOX.x;
        if (e.x < -BOX.x) e.x += 2 * BOX.x;
        if (r.collided && r.work > 0) {
          // ion más cercano recibe el calor de Joule (trabajo del campo)
          let best = 0, bestd = Infinity;
          for (let k = 0; k < N_IONS; k++) {
            const dx = e.x - ions[k][0], dy = e.y - ions[k][1], dz = e.z - ions[k][2];
            const d = dx * dx + dy * dy + dz * dz;
            if (d < bestd) { bestd = d; best = k; }
          }
          T[best] = Math.min(1.4, T[best] + r.work * 5.5);
        }
      }
    }
    // 2) enfriamiento (Newton) + difusión leve
    for (let k = 0; k < N_IONS; k++) T[k] *= 0.975;

    // 3) pintar iones (color del core) + halos (brillo = calor)
    const mesh = ionsRef.current;
    if (mesh) {
      for (let k = 0; k < N_IONS; k++) {
        tempToColor(T[k], tmpColor);
        mesh.setColorAt(k, tmpColor);
        const b = Math.min(1, T[k] * 1.1);
        haloColors[k * 3] = tmpColor.r * b; haloColors[k * 3 + 1] = tmpColor.g * b; haloColors[k * 3 + 2] = tmpColor.b * b;
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    if (haloGeom.current) (haloGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;

    // 4) electrones a buffer (brillo ∝ rapidez)
    for (let i = 0; i < N_E; i++) {
      const e = E[i];
      ePos[i * 3] = e.x; ePos[i * 3 + 1] = e.y; ePos[i * 3 + 2] = e.z;
      const sp = Math.min(1, Math.hypot(e.vx, e.vy, e.vz) / (vth * 1.6));
      eCol[i * 3] = 0.5 + sp * 0.5; eCol[i * 3 + 1] = 0.8; eCol[i * 3 + 2] = 1.0;
    }
    if (eGeom.current) {
      (eGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (eGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
  });

  return (
    <group>
      {/* iones (núcleos sólidos) */}
      <instancedMesh ref={ionsRef} args={[undefined, undefined, N_IONS]}>
        <sphereGeometry args={[0.16, 16, 16]} />
        {/* instanceColor (setColorAt) multiplica este color base; sin vertexColors */}
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {/* halos de calor */}
      <points>
        <bufferGeometry ref={haloGeom}>
          <bufferAttribute attach="attributes-position" args={[haloPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[haloColors, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={1.7} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} opacity={0.9} />
      </points>
      {/* electrones */}
      <points>
        <bufferGeometry ref={eGeom}>
          <bufferAttribute attach="attributes-position" args={[ePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[eCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.5} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      {/* flecha del campo E */}
      <FieldArrow voltage={voltage} />
    </group>
  );
}

function FieldArrow({ voltage }: { voltage: number }) {
  // una flecha tenue que indica la dirección del campo E (causa del arrastre)
  const y = -BOX.y - 0.7;
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, BOX.x * 1.7, 8]} />
        <meshBasicMaterial color={new THREE.Color(0.3, 0.5, 1).multiplyScalar(0.4 + voltage * 0.1)} toneMapped={false} />
      </mesh>
      <mesh position={[BOX.x * 0.9, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.12, 0.3, 10]} />
        <meshBasicMaterial color={new THREE.Color(0.4, 0.6, 1)} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ════════════════════════════════════════════════════════════════════════
// 2) BOBINA — el campo magnético real (Biot-Savart)
// ════════════════════════════════════════════════════════════════════════

const COIL = { turns: 6, radius: 0.85, length: 3.2 };

function CoilScene({ current }: { current: number }) {
  const segs = useMemo(() => helixSegments(COIL.turns, COIL.radius, COIL.length, 40), []);

  // tubo de la bobina (cobre)
  const coilCurve = useMemo(() => {
    const pts = segs.map((s) => new THREE.Vector3(...s.a));
    pts.push(new THREE.Vector3(...segs[segs.length - 1].b));
    return new THREE.CatmullRomCurve3(pts);
  }, [segs]);

  // líneas de campo: integrar la DIRECCIÓN de B desde semillas
  const fieldLines = useMemo(() => traceFieldLines(segs), [segs]);

  const matRef = useRef<THREE.LineBasicMaterial[]>([]);
  const coilMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((state) => {
    // brillo de las líneas ∝ corriente (energía ½Li²); leve pulso
    const pulse = 0.85 + 0.15 * Math.sin(state.clock.elapsedTime * 2);
    const g = Math.min(1, current / 5);
    matRef.current.forEach((m) => { if (m) m.opacity = (0.25 + 0.6 * g) * pulse; });
    if (coilMat.current) coilMat.current.emissiveIntensity = 0.3 + g * 0.9;
  });

  return (
    <group>
      <mesh>
        <tubeGeometry args={[coilCurve, 400, 0.07, 10, false]} />
        <meshStandardMaterial ref={coilMat} color="#c87b3a" emissive="#ff8a3a"
          emissiveIntensity={0.6} metalness={0.7} roughness={0.35} toneMapped={false} />
      </mesh>
      {fieldLines.map((pts, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[pts, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            ref={(m) => { if (m) matRef.current[i] = m; }}
            color="#7cc4ff" transparent opacity={0.5} depthWrite={false}
            blending={THREE.AdditiveBlending} toneMapped={false} />
        </line>
      ))}
    </group>
  );
}

/** Traza líneas de campo siguiendo la dirección de B (Biot-Savart) por RK simple. */
function traceFieldLines(segs: Array<{ a: Vec3; b: Vec3 }>): Float32Array[] {
  const lines: Float32Array[] = [];
  const ds = 0.06, steps = 420;
  const bounds = 4.5;
  // semillas: anillo dentro del solenoide en el plano medio (varios radios/ángulos)
  const seeds: Vec3[] = [];
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    for (const rr of [0.25, 0.55]) {
      seeds.push([0, rr * COIL.radius * Math.cos(ang), rr * COIL.radius * Math.sin(ang)]);
    }
  }
  for (const seed of seeds) {
    const fwd = integrate(seed, +1);
    const bwd = integrate(seed, -1).reverse();
    const all = [...bwd, ...fwd];
    const arr = new Float32Array(all.length * 3);
    all.forEach((p, i) => { arr[i * 3] = p[0]; arr[i * 3 + 1] = p[1]; arr[i * 3 + 2] = p[2]; });
    lines.push(arr);
  }
  return lines;

  function integrate(start: Vec3, dir: number): Vec3[] {
    const path: Vec3[] = [];
    let p: Vec3 = [...start] as Vec3;
    for (let i = 0; i < steps; i++) {
      const B = biotSavart(p, segs, 1);
      const mag = Math.hypot(B[0], B[1], B[2]);
      if (mag < 1e-20) break;
      const ux = (B[0] / mag) * dir, uy = (B[1] / mag) * dir, uz = (B[2] / mag) * dir;
      p = [p[0] + ux * ds, p[1] + uy * ds, p[2] + uz * ds];
      if (Math.abs(p[0]) > bounds || Math.hypot(p[1], p[2]) > bounds) { path.push(p); break; }
      path.push(p);
    }
    return path;
  }
}

// ════════════════════════════════════════════════════════════════════════
// 3) LED — el color sale del band gap (recombinación → fotón)
// ════════════════════════════════════════════════════════════════════════

const LED_MATERIALS = [
  { name: 'Infrarrojo (AlGaAs)', eg: 1.4 },
  { name: 'Rojo (AlGaInP)', eg: 1.9 },
  { name: 'Ámbar', eg: 2.1 },
  { name: 'Verde (InGaN)', eg: 2.4 },
  { name: 'Azul (InGaN)', eg: 2.7 },
  { name: 'Violeta', eg: 3.0 },
];

interface Photon { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number }

function LedScene({ voltage, eg }: { voltage: number; eg: number }) {
  const sprite = useMemo(() => getParticleTexture(), []);
  const color = useMemo(() => {
    const [r, g, b] = wavelengthToRGB(bandgapToWavelengthNm(eg));
    return new THREE.Color(r, g, b);
  }, [eg]);
  const on = voltage >= eg;                  // enciende sobre el band gap
  const drive = Math.max(0, voltage - eg);   // qué tan duro lo empujas

  // portadores: electrones (N, derecha) y huecos (P, izquierda)
  const N_CARR = 70;
  const carriers = useRef(
    Array.from({ length: N_CARR * 2 }, (_, i) => ({
      hole: i < N_CARR,
      x: (i < N_CARR ? -1 : 1) * (0.4 + Math.random() * 2.2),
      y: (Math.random() - 0.5) * 1.6,
      z: (Math.random() - 0.5) * 1.6,
    })),
  );
  const photons = useRef<Photon[]>([]);
  const rng = useMemo(() => makeRng(7), []);

  const eGeom = useRef<THREE.BufferGeometry>(null);
  const eCol = useMemo(() => new Float32Array(N_CARR * 2 * 3), []);
  const ePos = useMemo(() => new Float32Array(N_CARR * 2 * 3), []);
  const phGeom = useRef<THREE.BufferGeometry>(null);
  const MAXPH = 200;
  const phPos = useMemo(() => new Float32Array(MAXPH * 3), []);
  const phCol = useMemo(() => new Float32Array(MAXPH * 3), []);
  const domeMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    const C = carriers.current;
    const driftV = on ? 0.4 + drive * 0.9 : 0.04; // bajo umbral: casi quietos
    for (let i = 0; i < C.length; i++) {
      const c = C[i];
      const toward = c.hole ? 1 : -1; // huecos van +x, electrones -x (hacia la unión)
      c.x += toward * driftV * step + (rng() - 0.5) * 0.05;
      c.y += (rng() - 0.5) * 0.04;
      c.z += (rng() - 0.5) * 0.04;
      // recombinación en la unión (|x|<0.25): emite fotón y se recicla
      if (on && ((c.hole && c.x > -0.2) || (!c.hole && c.x < 0.2)) && Math.abs(c.x) < 0.35) {
        if (photons.current.length < MAXPH && rng() < 0.5) {
          const th = rng() * Math.PI * 2, ph = Math.acos(2 * rng() - 1);
          const sp = 2.2 + drive;
          photons.current.push({
            x: 0, y: c.y * 0.5, z: c.z * 0.5,
            vx: Math.sin(ph) * Math.cos(th) * sp,
            vy: Math.abs(Math.cos(ph)) * sp + 1, // sesgo hacia arriba (sale por el domo)
            vz: Math.sin(ph) * Math.sin(th) * sp, life: 1,
          });
        }
        // reciclar el portador al borde
        c.x = c.hole ? -2.6 : 2.6;
        c.y = (rng() - 0.5) * 1.6; c.z = (rng() - 0.5) * 1.6;
      }
      // si se pasó de largo sin recombinar, reciclar
      if (c.x > 2.8) c.x = -2.6;
      if (c.x < -2.8) c.x = 2.6;
    }
    // portadores a buffer
    for (let i = 0; i < C.length; i++) {
      const c = C[i];
      ePos[i * 3] = c.x; ePos[i * 3 + 1] = c.y; ePos[i * 3 + 2] = c.z;
      if (c.hole) { eCol[i * 3] = 1; eCol[i * 3 + 1] = 0.35; eCol[i * 3 + 2] = 0.2; }
      else { eCol[i * 3] = 0.3; eCol[i * 3 + 1] = 0.6; eCol[i * 3 + 2] = 1; }
    }
    if (eGeom.current) {
      (eGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (eGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
    // fotones
    const P = photons.current;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.x += p.vx * step; p.y += p.vy * step; p.z += p.vz * step;
      p.life -= step * 0.8;
      if (p.life <= 0 || p.y > 5) P.splice(i, 1);
    }
    for (let i = 0; i < MAXPH; i++) {
      if (i < P.length) {
        const p = P[i];
        phPos[i * 3] = p.x; phPos[i * 3 + 1] = p.y; phPos[i * 3 + 2] = p.z;
        const b = Math.max(0, p.life);
        phCol[i * 3] = color.r * b; phCol[i * 3 + 1] = color.g * b; phCol[i * 3 + 2] = color.b * b;
      } else {
        phPos[i * 3] = 9999; phCol[i * 3] = 0; phCol[i * 3 + 1] = 0; phCol[i * 3 + 2] = 0;
      }
    }
    if (phGeom.current) {
      (phGeom.current.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
      (phGeom.current.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true;
    }
    // el domo brilla con el color del gap cuando está encendido
    if (domeMat.current) {
      domeMat.current.emissive.copy(color);
      domeMat.current.emissiveIntensity = on ? 0.4 + drive * 0.8 : 0.02;
    }
  });

  return (
    <group>
      {/* domo del LED */}
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[1.5, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.62]} />
        <meshStandardMaterial ref={domeMat} color={color} transparent opacity={0.16}
          emissive={color} emissiveIntensity={0.1} roughness={0.1} metalness={0} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {/* plano de la unión */}
      <mesh>
        <boxGeometry args={[0.06, 2.4, 2.4]} />
        <meshBasicMaterial color={on ? color : new THREE.Color(0.2, 0.2, 0.25)} transparent opacity={0.35} toneMapped={false} />
      </mesh>
      {/* portadores */}
      <points>
        <bufferGeometry ref={eGeom}>
          <bufferAttribute attach="attributes-position" args={[ePos, 3]} />
          <bufferAttribute attach="attributes-color" args={[eCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.4} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
      {/* fotones */}
      <points>
        <bufferGeometry ref={phGeom}>
          <bufferAttribute attach="attributes-position" args={[phPos, 3]} />
          <bufferAttribute attach="attributes-color" args={[phCol, 3]} />
        </bufferGeometry>
        <pointsMaterial map={sprite} size={0.7} sizeAttenuation vertexColors transparent
          depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </points>
    </group>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Paneles laterales (explicación + 1 control)
// ════════════════════════════════════════════════════════════════════════

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[#2c2818] bg-[#0d1018] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[#6a5e4e] pb-1.5">{title}</div>
      {children}
    </div>
  );
}

function Slider({ label, value, set, min, max, step, fmt }: {
  label: string; value: number; set: (v: number) => void; min: number; max: number; step: number; fmt: (v: number) => string;
}) {
  return (
    <label className="block">
      <div className="flex justify-between text-[12px] mb-1">
        <span className="text-[#c9bfa8]">{label}</span>
        <span className="font-mono text-[#ead080]">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => set(parseFloat(e.target.value))} className="w-full accent-[#d4b050]" />
    </label>
  );
}

function ResistorPanel({ voltage, setVoltage }: { voltage: number; setVoltage: (v: number) => void }) {
  const heat = Math.min(1, (voltage * voltage) / 16); // ∝ V² (I²R)
  return (
    <>
      <Panel title="Qué estás viendo">
        <p className="text-[13px] text-[#c9bfa8] leading-relaxed">
          La corriente NO es "puntitos que viajan". Es un mar de electrones que <b>apenas avanza</b> (arrastre
          lento, ~mm/s) montado sobre un caos térmico brutal. Cada vez que un electrón <b>choca contra un ion</b>
          de la red, le entrega la energía que el campo le dio → la red <b>se calienta</b>.
        </p>
      </Panel>
      <Panel title="Sube el voltaje y mira la red ponerse al rojo">
        <Slider label="Voltaje (campo E)" value={voltage} set={setVoltage} min={0.2} max={4} step={0.1}
          fmt={(v) => `${v.toFixed(1)} V`} />
        <div className="mt-2">
          <div className="text-[11px] text-[#a0947e] mb-1">Calor disipado (∝ V², esto ES I²R)</div>
          <div className="h-2.5 rounded-full bg-[#1e2538] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${heat * 100}%`, background: 'linear-gradient(90deg,#d4b050,#ff5a1a)' }} />
          </div>
        </div>
      </Panel>
      <Panel title="La idea clave">
        <p className="text-[12px] text-[#a0947e] leading-relaxed">
          El doble de voltaje no calienta el doble: calienta <b>cuatro veces</b>. La potencia va como el
          cuadrado (P = V²/R = I²R). Por eso una resistencia "quema" y un foco incandescente alumbra.
        </p>
      </Panel>
    </>
  );
}

function CoilPanel({ current, setCurrent }: { current: number; setCurrent: (v: number) => void }) {
  return (
    <>
      <Panel title="Qué estás viendo">
        <p className="text-[13px] text-[#c9bfa8] leading-relaxed">
          La corriente en la espira crea un <b>campo magnético real</b> (líneas azules). Adentro corre
          <b> recto y fuerte</b>; afuera se cierra en <b>lazos</b>. No lo inventamos: cada línea se traza
          integrando <b>Biot-Savart</b> sobre el alambre.
        </p>
      </Panel>
      <Panel title="Sube la corriente y enciende el campo">
        <Slider label="Corriente" value={current} set={setCurrent} min={0.2} max={5} step={0.1}
          fmt={(v) => `${v.toFixed(1)} A`} />
        <p className="text-[11px] text-[#a0947e] mt-2 leading-relaxed">
          El campo (y la energía guardada ½L·i²) crece con la corriente. Así funciona un electroimán,
          un relevador, un motor y la bobina del boost que funde metal en La Forja.
        </p>
      </Panel>
      <Panel title="La idea clave">
        <p className="text-[12px] text-[#a0947e] leading-relaxed">
          Mover carga (corriente) <b>crea</b> magnetismo. Cambiar ese campo <b>crea</b> voltaje (Faraday).
          Ese ida y vuelta es todo el electromagnetismo: motores, transformadores, antenas.
        </p>
      </Panel>
    </>
  );
}

function LedPanel({ voltage, setVoltage, material, setMaterial }: {
  voltage: number; setVoltage: (v: number) => void; material: number; setMaterial: (i: number) => void;
}) {
  const eg = LED_MATERIALS[material].eg;
  const nm = bandgapToWavelengthNm(eg);
  const on = voltage >= eg;
  return (
    <>
      <Panel title="Qué estás viendo">
        <p className="text-[13px] text-[#c9bfa8] leading-relaxed">
          En la unión, un <b style={{ color: '#5b9bff' }}>electrón</b> cae a un <b style={{ color: '#ff7a4d' }}>hueco</b> y
          suelta exactamente la energía del <b>band gap</b>. Esa energía sale como un <b>fotón</b> de color fijo:
          λ = h·c/E_g. Por eso el color lo manda el <b>material</b>, no el voltaje.
        </p>
      </Panel>
      <Panel title="Elige el material (su gap = su color)">
        <div className="grid grid-cols-2 gap-1.5 mb-2">
          {LED_MATERIALS.map((m, i) => (
            <button key={m.name} onClick={() => setMaterial(i)}
              className={`text-[11px] px-2 py-1.5 rounded border text-left ${
                i === material ? 'border-[#d4b050] bg-[#1e2538] text-[#ead080]' : 'border-[#2c2818] bg-[#14160f] text-[#a0947e]'}`}>
              {m.name}
            </button>
          ))}
        </div>
        <div className="text-[11px] font-mono text-[#a0947e]">E_g = {eg.toFixed(1)} eV → λ ≈ {nm.toFixed(0)} nm</div>
      </Panel>
      <Panel title="Súbelo sobre el voltaje de encendido">
        <Slider label="Voltaje directo" value={voltage} set={setVoltage} min={0.5} max={3.6} step={0.05}
          fmt={(v) => `${v.toFixed(2)} V`} />
        <div className={`text-[12px] mt-1 font-medium ${on ? 'text-[#4ade80]' : 'text-[#6a5e4e]'}`}>
          {on ? '● Encendido — recombinando y emitiendo luz' : `○ Apagado — necesita ≥ ${eg.toFixed(1)} V (el gap)`}
        </div>
      </Panel>
    </>
  );
}
