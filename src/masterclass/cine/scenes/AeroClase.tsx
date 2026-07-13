/**
 * AeroClase — clase 1 de aeronáutica: ¿POR QUÉ VUELA UN AVIÓN?
 * (Anderson, Fundamentals of Aerodynamics, caps. 1, 3-4 — hecho luz)
 *
 * Arco (cada línea narrada = un beat; la animación ES la explicación):
 *   GANCHO    01 200 toneladas colgadas del aire
 *   EL MITO   02 "recorre más camino" · 03 parcelas medidas: NUNCA se reencuentran · 04 algo invisible
 *   EL MAPA   05 Joukowski: el ala era un círculo · 06 solución exacta
 *   KUTTA     07 la solución absurda (Γ=0, el borde explota) · 08 el flujo sale limpio
 *   GAMMA     09 el aire GIRA alrededor del ala · 10 L = ρ·V·Γ (el teorema)
 *   PRESIÓN   11 Bernoulli al revés: el ala se CHUPA hacia arriba
 *   EL ÁNGULO 12 α=0 muere · 13 α=8 despierta (Cl=2πα) · 14 α=12 crece
 *   HONESTIDAD 15 α=15: pérdida — la teoría ya no ve · 16 el borde del cuchillo
 *   SEMILLA   17 La Forja: el flujo es tuyo
 *
 * FÍSICA: todo sale de src/aero/potencial.ts (Joukowski exacto, RK4,
 * verificado por potencial.test.ts — ∮u·dl = Γ). Las parcelas del mito son
 * integración temporal REAL: la de arriba llega antes porque el campo lo dice,
 * no porque lo dibujamos. Lo único evocativo (etiquetado): el shimmer rojo del
 * stall (la teoría potencial no ve separación — eso DICE la narración) y la
 * velocidad ×4 del vórtice ligado (legibilidad).
 *
 * Determinismo: TODO es puro en t (timeRef) — renderAt(t) reproducible.
 */

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CineStage, CineCamera, useCineTime } from '@/masterclass/cine';
import type { CineCamKey } from '@/masterclass/cine/CineCamera';
import {
  JOUKOWSKI_A as A, kuttaGamma, flowVelocity, cpValue, cpToColor,
  integrateParcel, integrateStreamline, nacaProfile, seedField,
} from '@/aero/potencial';

const DEG = Math.PI / 180;
const CHORD = 4 * A;           // cuerda de la placa de Joukowski = 2.08
const GOLD = '#FDB813';
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const smooth = (x: number) => { const c = clamp(x, 0, 1); return c * c * (3 - 2 * c); };
const local = (t: number, a: number, b: number) => clamp((t - a) / (b - a), 0, 1);
const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

// ── Beats (provisional hasta medir la voz real con assemble-narracion) ─────
const T = [0.5, 10.0, 18.5, 27.0, 34.5, 42.5, 50.5, 59.0, 67.5, 76.0,
  84.5, 93.5, 101.5, 110.0, 118.0, 126.5, 135.0];
const END = 146;
const beatEnd = (i: number) => (i < T.length - 1 ? T[i + 1] : END);

// α por beat (rad). El marco del flujo rota +α: freestream SIEMPRE horizontal
// en pantalla y el ala se inclina — exactamente la misma física, rotada rígida.
const ALPHA_TABLE: [number, number][] = [
  [T[0], 8 * DEG], [T[11], 0], [T[12], 8 * DEG], [T[13], 12 * DEG],
  [T[14], 15 * DEG], [T[15], 8 * DEG],
];
function alphaAt(t: number): number {
  let prev = ALPHA_TABLE[0][1];
  for (const [tk, ak] of ALPHA_TABLE) {
    if (t < tk) break;
    const s = smooth(local(t, tk, tk + 0.8));
    prev = lerpN(prev, ak, s);
  }
  return prev;
}

// corte seco estándar (ventanas [inAt, outAt) sin traslape)
function fadeGroup(g: THREE.Group | null, t: number, inAt: number, outAt: number) {
  if (!g) return false;
  const on = t >= inAt && t < outAt;
  g.visible = on;
  if (!on) return false;
  g.scale.setScalar(Math.min(1, 0.0001 + (t - inAt) / 0.15));
  return true;
}

// ═══ EL MARCO DEL FLUJO: rota −α(t) — el freestream del campo sube a +α
// (U·e^{−iα} → (Ucosα, +Usinα)); girando −α el viento queda horizontal en
// pantalla y el ala nariz-ARRIBA. Rotación rígida: la física no cambia. ═════
function FlowFrame({ children }: { children: React.ReactNode }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  useFrame(() => { if (g.current) g.current.rotation.z = -alphaAt(timeRef.current); });
  return <group ref={g}>{children}</group>;
}

// ═══ EL ALA (NACA 0012 de piel sobre la placa del campo, cuerda 2.08) ═══════
function Wing() {
  const geo = useMemo(() => {
    const prof = nacaProfile(0.12, 60);
    const shape = new THREE.Shape();
    shape.moveTo(prof[0].x * CHORD - CHORD / 2, prof[0].y * CHORD);
    for (let i = 1; i < prof.length; i++) shape.lineTo(prof[i].x * CHORD - CHORD / 2, prof[i].y * CHORD);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 2.6, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -1.3);
    return g;
  }, []);
  return (
    <group>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#8FA8C8" emissive="#1D4ED8" emissiveIntensity={0.34}
          metalness={0.72} roughness={0.28} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#60A5FA" emissive="#93C5FD" emissiveIntensity={1.0}
          wireframe transparent opacity={0.10} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ═══ PARTÍCULAS DEL FLUJO (parcelas reales, tiempo físico, puras en t) ══════
interface FlowWindows { windows: [number, number][]; alpha: number; gamma?: number }
const Z_PLANES = [-1.1, -0.55, 0, 0.55, 1.1];
const PER_PATH = 3;

function useParcelPaths(alpha: number, gamma?: number) {
  return useMemo(() => {
    const paths: { pos: Float32Array; col: Float32Array; n: number; dur: number }[] = [];
    for (let r = 0; r < 26; r++) {
      const sy = -1.7 + (r / 25) * 3.4;
      const [fx, fy] = seedField(-2.8, sy, alpha); // entrada pareja en PANTALLA
      const pts = integrateParcel(fx, fy, alpha, 520, 0.015, gamma !== undefined ? { gamma } : undefined);
      if (pts.length < 20) continue;
      const pos = new Float32Array(pts.length * 2);
      const col = new Float32Array(pts.length * 3);
      for (let k = 0; k < pts.length; k++) {
        pos[k * 2] = pts[k].x; pos[k * 2 + 1] = pts[k].y;
        const [u, v] = flowVelocity(pts[k].x, pts[k].y, alpha, gamma !== undefined ? { gamma } : undefined);
        const [cr, cg, cb] = cpToColor(cpValue(u, v));
        col[k * 3] = cr * 0.72; col[k * 3 + 1] = cg * 0.72; col[k * 3 + 2] = cb * 0.72;
      }
      paths.push({ pos, col, n: pts.length, dur: pts.length * 0.015 });
    }
    return paths;
  }, [alpha, gamma]);
}

function FlowParticles({ windows, alpha, gamma }: FlowWindows) {
  const timeRef = useCineTime();
  const paths = useParcelPaths(alpha, gamma);
  const N = paths.length * Z_PLANES.length * PER_PATH;
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
    return g;
  }, [N]);
  const mat = useMemo(() => new THREE.PointsMaterial({
    vertexColors: true, size: 0.045, sizeAttenuation: true, transparent: true,
    opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);
  const ptsRef = useRef<THREE.Points>(null);

  useFrame(() => {
    const t = timeRef.current;
    const win = windows.find(([a, b]) => t >= a && t < b);
    if (ptsRef.current) ptsRef.current.visible = !!win;
    if (!win) return;
    const posA = geo.getAttribute('position') as THREE.BufferAttribute;
    const colA = geo.getAttribute('color') as THREE.BufferAttribute;
    let w = 0;
    for (let p = 0; p < paths.length; p++) {
      const path = paths[p];
      for (let zi = 0; zi < Z_PLANES.length; zi++) {
        for (let j = 0; j < PER_PATH; j++) {
          const jit = (((p * 7 + zi * 13 + j * 29) % 17) / 17) * (path.dur / PER_PATH);
          const tau = ((t - win[0]) + j * (path.dur / PER_PATH) + jit) % path.dur;
          const fk = Math.min(tau / 0.015, path.n - 1.001);
          const k = Math.floor(fk), fr = fk - k;
          const x = lerpN(path.pos[k * 2], path.pos[(k + 1) * 2], fr);
          const y = lerpN(path.pos[k * 2 + 1], path.pos[(k + 1) * 2 + 1], fr);
          posA.setXYZ(w, x, y, Z_PLANES[zi]);
          colA.setXYZ(w, path.col[k * 3], path.col[k * 3 + 1], path.col[k * 3 + 2]);
          w++;
        }
      }
    }
    posA.needsUpdate = true; colA.needsUpdate = true;
  });
  return <points ref={ptsRef} geometry={geo} material={mat} />;
}

// ═══ EL MITO: dos parcelas reales (arriba/abajo) — la de arriba GANA ════════
function MythParcels({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const up = useRef<THREE.Mesh>(null);
  const dn = useRef<THREE.Mesh>(null);
  const upTrail = useRef<THREE.Line>(null);
  const dnTrail = useRef<THREE.Line>(null);

  const data = useMemo(() => {
    const mk = (sy: number) => {
      const [fx, fy] = seedField(-2.6, sy, 8 * DEG); // entrada en PANTALLA ±0.25
      const pts = integrateParcel(fx, fy, 8 * DEG, 1100, 0.01);
      const pos = new Float32Array(pts.length * 3);
      for (let k = 0; k < pts.length; k++) { pos[k * 3] = pts[k].x; pos[k * 3 + 1] = pts[k].y; pos[k * 3 + 2] = 0; }
      const crossIdx = pts.findIndex(q => q.x > 1.3);
      return { pos, n: pts.length, cross: crossIdx < 0 ? pts.length - 1 : crossIdx };
    };
    return { up: mk(0.25), dn: mk(-0.25) };
  }, []);

  const trailGeo = (d: { pos: Float32Array; n: number }) => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(d.pos, 3));
    gg.setDrawRange(0, 0);
    gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
    return gg;
  };
  const upGeo = useMemo(() => trailGeo(data.up), [data]);
  const dnGeo = useMemo(() => trailGeo(data.dn), [data]);

  const SLOW = 2.2; // cámara lenta ×2.2 (mismo factor para AMBAS: la carrera es justa)
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const tau = Math.max(0, (t - start - 1.2) / SLOW);
    const place = (d: { pos: Float32Array; n: number; cross: number }, mesh: THREE.Mesh | null, trail: THREE.Line | null, geo: THREE.BufferGeometry) => {
      const idx = Math.min(Math.floor(tau / 0.01), d.n - 1);
      if (mesh) {
        mesh.position.set(d.pos[idx * 3], d.pos[idx * 3 + 1], 0);
        // pulso al cruzar el borde de salida
        const crossT = d.cross * 0.01;
        const dtc = tau - crossT;
        const pulse = dtc > 0 && dtc < 0.9 ? 1 + 0.9 * Math.exp(-dtc * 4) * Math.abs(Math.sin(dtc * 18)) : 1;
        mesh.scale.setScalar(pulse);
      }
      geo.setDrawRange(0, Math.max(0, idx));
      if (trail) trail.visible = idx > 1;
    };
    place(data.up, up.current, upTrail.current as unknown as THREE.Line, upGeo);
    place(data.dn, dn.current, dnTrail.current as unknown as THREE.Line, dnGeo);
  });

  return (
    <group ref={g}>
      <mesh ref={up}><sphereGeometry args={[0.075, 20, 20]} />
        <meshStandardMaterial color="#3A2E08" emissive={GOLD} emissiveIntensity={3.2} toneMapped={false} /></mesh>
      <mesh ref={dn}><sphereGeometry args={[0.075, 20, 20]} />
        <meshStandardMaterial color="#062A33" emissive="#22D3EE" emissiveIntensity={3.2} toneMapped={false} /></mesh>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <line ref={upTrail as never} geometry={upGeo}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <line ref={dnTrail as never} geometry={dnGeo}>
        <lineBasicMaterial color="#22D3EE" transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
      </line>
    </group>
  );
}

// ═══ JOUKOWSKI: el círculo se DESENROLLA en la placa (z = ζ + s·a²/ζ) ═══════
function JoukowskiMorph({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const lineRef = useRef<THREE.LineLoop>(null);
  const NPTS = 180;
  const geo = useMemo(() => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NPTS * 3), 3));
    gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6);
    return gg;
  }, []);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    // s: 0 (círculo) → 1 (placa). Aparece arriba, se transforma y BAJA al ala.
    const s = smooth(local(t, start + 1.0, start + 4.5));
    const drop = smooth(local(t, start + 5.0, start + 6.5));
    const lift = 1.9 * (1 - drop);
    const posA = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < NPTS; k++) {
      const th = (k / NPTS) * 2 * Math.PI;
      const zr = A * Math.cos(th), zi = A * Math.sin(th);
      // z = ζ + s·a²/ζ  (en |ζ|=a: a²/ζ = conj(ζ))
      const x = zr + s * zr;
      const y = zi - s * zi;
      posA.setXYZ(k, x, y + lift, 0.02);
    }
    posA.needsUpdate = true;
    if (lineRef.current) {
      const m = lineRef.current.material as THREE.LineBasicMaterial;
      m.opacity = 0.9 * (1 - smooth(local(t, end - 1.2, end - 0.3)));
    }
  });
  return (
    <group ref={g}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <lineLoop ref={lineRef as never} geometry={geo}>
        <lineBasicMaterial color={GOLD} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
      </lineLoop>
    </group>
  );
}

// ═══ EL BORDE DE SALIDA: Γ=0 (absurdo, rojo) → Kutta (limpio, cian) ═════════
function TrailingEdgeDrama({ start, mid, end }: { start: number; mid: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const hot = useRef<THREE.Mesh>(null);
  const wrongRef = useRef<THREE.Group>(null);
  const cleanRef = useRef<THREE.Group>(null);

  const build = (gamma?: number) => {
    const geos: THREE.BufferGeometry[] = [];
    for (const sy of [-0.04, -0.08, -0.13, -0.19]) {
      const [fx, fy] = seedField(-2.6, sy, 8 * DEG); // justo bajo el ala (pantalla)
      const pts = integrateStreamline(fx, fy, 8 * DEG, 260, 0.026, gamma !== undefined ? { gamma } : undefined);
      const pos = new Float32Array(pts.length * 3);
      for (let k = 0; k < pts.length; k++) { pos[k * 3] = pts[k].x; pos[k * 3 + 1] = pts[k].y; pos[k * 3 + 2] = 0; }
      const gg = new THREE.BufferGeometry();
      gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 10);
      geos.push(gg);
    }
    return geos;
  };
  const wrong = useMemo(() => build(0), []);
  const clean = useMemo(() => build(undefined), []);

  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const inWrong = t < mid;
    if (wrongRef.current) wrongRef.current.visible = inWrong;
    if (cleanRef.current) cleanRef.current.visible = !inWrong;
    if (hot.current) {
      const m = hot.current.material as THREE.MeshStandardMaterial;
      if (inWrong) {
        m.emissiveIntensity = 3.4 + 2.2 * Math.sin((t - start) * 9); // el borde ARDE
        hot.current.scale.setScalar(1 + 0.25 * Math.sin((t - start) * 9));
      } else {
        m.emissiveIntensity = lerpN(3.0, 0.35, smooth(local(t, mid, mid + 1.4))); // se calma
        hot.current.scale.setScalar(1);
      }
    }
  });
  return (
    <group ref={g}>
      <group ref={wrongRef}>
        {wrong.map((gg, i) => (
          /* eslint-disable-next-line react/no-unknown-property */
          <line key={i} geometry={gg}>
            <lineBasicMaterial color="#FF4B2E" transparent opacity={0.95} blending={THREE.AdditiveBlending} depthWrite={false} />
          </line>
        ))}
      </group>
      <group ref={cleanRef} visible={false}>
        {clean.map((gg, i) => (
          /* eslint-disable-next-line react/no-unknown-property */
          <line key={i} geometry={gg}>
            <lineBasicMaterial color="#34E0C8" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
          </line>
        ))}
      </group>
      <mesh ref={hot} position={[CHORD / 2, 0, 0]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#2A0A02" emissive="#FF6B35" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ═══ EL VÓRTICE LIGADO: lazos cerrados alrededor del ala (Γ real, vel ×4) ═══
function BoundVortex({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const RADII = [1.25 * A, 1.62 * A, 2.05 * A];
  const NPART = 46;
  const GAMMA = kuttaGamma(8 * DEG);

  const loops = useMemo(() => RADII.map(r => {
    // el lazo mapeado z = ζ + a²/ζ con |ζ| = r (elipse alrededor de la placa)
    const map = (th: number): [number, number] => {
      const zr = r * Math.cos(th), zi = r * Math.sin(th);
      const m2 = r * r;
      return [zr + A * A * zr / m2, zi - A * A * zi / m2];
    };
    const line = new Float32Array(121 * 3);
    for (let k = 0; k <= 120; k++) {
      const [x, y] = map((k / 120) * 2 * Math.PI);
      line[k * 3] = x; line[k * 3 + 1] = y; line[k * 3 + 2] = 0;
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(line, 3));
    lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6);
    return { r, map, lineGeo, omega: GAMMA / (2 * Math.PI * r * r) };
  }), []);

  const ptsGeo = useMemo(() => {
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RADII.length * NPART * 3), 3));
    gg.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6);
    return gg;
  }, []);
  const ptsMat = useMemo(() => new THREE.PointsMaterial({
    color: GOLD, size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.95,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);

  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const posA = ptsGeo.getAttribute('position') as THREE.BufferAttribute;
    let w = 0;
    for (const L of loops) {
      for (let j = 0; j < NPART; j++) {
        const th0 = (j / NPART) * 2 * Math.PI;
        // sentido HORARIO (θ decrece): +x arriba, −x abajo — el giro que suma
        // velocidad encima del ala. ×4 de velocidad por legibilidad.
        const th = th0 - L.omega * 4 * (t - start);
        const [x, y] = L.map(th);
        posA.setXYZ(w, x, y, 0.03);
        w++;
      }
    }
    posA.needsUpdate = true;
  });
  return (
    <group ref={g}>
      {loops.map((L, i) => (
        /* eslint-disable-next-line react/no-unknown-property */
        <lineLoop key={i} geometry={L.lineGeo}>
          <lineBasicMaterial color={GOLD} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} />
        </lineLoop>
      ))}
      <points geometry={ptsGeo} material={ptsMat} />
    </group>
  );
}

// ═══ CAMPO DE PRESIÓN Cp (azul empuja abajo / rojo chupa arriba) ════════════
function PressureCloud({ windows, alpha }: FlowWindows) {
  const timeRef = useCineTime();
  const ref = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const NG = 46, step = 4.6 / NG;
    for (let ix = 0; ix < NG; ix++) {
      for (let iy = 0; iy < NG; iy++) {
        const px = -2.3 + ix * step + step / 2;
        const py = -2.3 + iy * step + step / 2;
        const [u, v] = flowVelocity(px, py, alpha);
        if (u === 0 && v === 0) continue;
        const c = cpValue(u, v);
        if (Math.abs(c) < 0.12) continue; // solo donde la presión DICE algo
        const [r, gg, b] = cpToColor(c);
        for (const pz of [-0.9, 0, 0.9]) {
          positions.push(px, py, pz);
          colors.push(r * 0.5, gg * 0.5, b * 0.5);
        }
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
    bg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    return bg;
  }, [alpha]);
  const mat = useMemo(() => new THREE.PointsMaterial({
    vertexColors: true, size: 0.05, sizeAttenuation: true, transparent: true,
    opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);
  useFrame(() => {
    const t = timeRef.current;
    const win = windows.find(([a, b]) => t >= a && t < b);
    if (ref.current) ref.current.visible = !!win;
    if (win) mat.opacity = 0.5 * smooth(local(t, win[0], win[0] + 1.2));
  });
  return <points ref={ref} geometry={geo} material={mat} />;
}

// ═══ FLECHA DE SUSTENTACIÓN (L = ρ·U·Γ — crece con α) ═══════════════════════
function LiftArrow({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    const L = kuttaGamma(alphaAt(t)) * 1.225; // ρ·U·Γ con U=1
    const h = Math.max(0.02, L * 1.15);
    if (shaft.current) { shaft.current.scale.y = h; shaft.current.position.y = 0.35 + h / 2; }
    if (head.current) head.current.position.y = 0.35 + h + 0.11;
  });
  return (
    <group ref={g}>
      <mesh ref={shaft} position={[0, 0.8, 0]}>
        <cylinderGeometry args={[0.028, 0.028, 1, 12]} />
        <meshStandardMaterial color="#0A2812" emissive="#4ADE80" emissiveIntensity={2.2} toneMapped={false} />
      </mesh>
      <mesh ref={head}>
        <coneGeometry args={[0.085, 0.24, 14]} />
        <meshStandardMaterial color="#0A2812" emissive="#22C55E" emissiveIntensity={2.6} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ═══ AVISO DE PÉRDIDA (evocativo, ETIQUETADO: la teoría no ve separación) ═══
function StallWarning({ start, end }: { start: number; end: number }) {
  const timeRef = useCineTime();
  const g = useRef<THREE.Group>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame(() => {
    const t = timeRef.current;
    if (!fadeGroup(g.current, t, start, end)) return;
    if (mat.current) mat.current.opacity = 0.14 + 0.13 * (0.5 + 0.5 * Math.sin((t - start) * 6.3));
  });
  return (
    // en coords del CAMPO el ala es horizontal — el plano abraza el dorso trasero
    <group ref={g} position={[0.45, 0.14, 0]}>
      <mesh>
        <planeGeometry args={[1.15, 0.34]} />
        <meshBasicMaterial ref={mat} color="#FF3A2E" transparent opacity={0.2}
          blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Cámara: 17 cortes con deriva; el ala LLENA el cuadro ────────────────────
interface Shot { p0: [number, number, number]; p1: [number, number, number]; look?: [number, number, number] }
const SHOTS: Shot[] = [
  { p0: [2.6, 1.2, 4.6], p1: [1.6, 0.7, 3.4] },                       // 01 hero push-in
  { p0: [0.4, 0.35, 4.6], p1: [0.2, 0.25, 4.0], look: [-0.4, 0, 0] }, // 02 carrera lateral
  { p0: [0.9, 0.3, 3.7], p1: [1.15, 0.25, 3.1], look: [0.5, 0, 0] },  // 03 borde de salida
  { p0: [0.4, 2.7, 3.1], p1: [0.2, 2.2, 2.7] },                       // 04 vista cenital
  { p0: [0, 0.9, 4.9], p1: [0, 0.6, 4.2], look: [0, 0.7, 0] },        // 05 morph frontal
  { p0: [-1.4, 0.5, 4.3], p1: [1.2, 0.5, 4.0] },                      // 06 dolly lateral
  { p0: [1.8, -0.6, 2.3], p1: [1.5, -0.2, 1.7], look: [1.04, 0, 0] }, // 07 macro TE (abajo)
  { p0: [1.9, 0.55, 2.1], p1: [1.55, 0.3, 1.6], look: [1.04, 0, 0] }, // 08 macro TE (calma)
  { p0: [1.8, 1.5, 3.9], p1: [-1.2, 1.2, 4.0] },                      // 09 vórtice orbital
  { p0: [0.4, -1.0, 4.5], p1: [0.3, 0.4, 3.7], look: [0, 0.3, 0] },   // 10 teorema (low hero)
  { p0: [0.2, 0.15, 4.7], p1: [0.1, 0.3, 3.8] },                      // 11 presión lateral
  { p0: [0.8, 0.3, 4.5], p1: [0.5, 0.2, 4.0] },                       // 12 α=0 calma
  { p0: [1.5, 0.85, 4.2], p1: [1.0, 0.6, 3.5] },                      // 13 α=8 despierta
  { p0: [1.2, -0.7, 3.9], p1: [0.9, -0.2, 3.2] },                     // 14 α=12 dramático
  { p0: [1.9, 1.7, 3.0], p1: [1.4, 1.3, 2.5], look: [0.3, 0.2, 0] },  // 15 stall ominoso
  { p0: [-2.2, 1.0, 4.4], p1: [2.0, 0.8, 4.1] },                      // 16 filo del cuchillo
  { p0: [0, 1.7, 6.4], p1: [0, 1.1, 5.2] },                           // 17 semilla wide
];
function buildCamKeys(): CineCamKey[] {
  const keys: CineCamKey[] = [];
  for (let i = 0; i < SHOTS.length; i++) {
    const t0 = T[i], t1 = beatEnd(i);
    const lk = SHOTS[i].look ?? ([0, 0, 0] as [number, number, number]);
    keys.push({ t: t0, pos: SHOTS[i].p0, look: lk, cut: true });
    keys.push({ t: Math.max(t0 + 0.1, t1 - 0.08), pos: SHOTS[i].p1, look: lk });
  }
  return keys;
}

const SUBS = [
  'Doscientas toneladas de avión… colgadas del aire. De algo que NO puedes ver. ¿Quién las carga?',
  'En la escuela te contaron: el aire de arriba recorre más camino, y corre para alcanzar al de abajo.',
  'Mentira. Míralo: las dos parcelas salen juntas… y NUNCA se reencuentran. La de arriba llega antes.',
  'El aire de arriba no corre por alcanzar a nadie. Corre por otra cosa. Algo invisible.',
  'Para verla, Joukowski hizo magia: convirtió el ala en un círculo. z = ζ + a²/ζ.',
  'Alrededor de un círculo el flujo tiene solución EXACTA. Y el mapa la regresa al ala. Sin aproximar.',
  'Pero la matemática permite un absurdo: aire doblando el borde de salida a velocidad infinita. Mira el borde.',
  'La naturaleza lo prohíbe. Kutta lo escribió: el flujo sale LIMPIO del borde. Una sola solución sobrevive.',
  'Y esa solución esconde el secreto: en neto, el aire GIRA alrededor del ala. Eso es la circulación: Γ.',
  'El teorema más limpio de la aerodinámica: la sustentación es ρ·V·Γ. Exacta. Kutta-Joukowski.',
  '¿Y Bernoulli? Cierto, pero al revés: la circulación acelera el aire de arriba, la presión cae… y el ala se CHUPA hacia arriba.',
  'Baja el ángulo a cero: la circulación muere. Γ = 0, sustentación cero. El campo queda simétrico.',
  'Inclínala ocho grados: Γ despierta. El coeficiente de sustentación es 2π·α. Solo importa el ÁNGULO.',
  'Doce grados: más circulación, más succión. La fórmula dice que puedes subir para siempre…',
  'La realidad dice NO. A quince grados el flujo se desprende del ala: PÉRDIDA. Aquí esta teoría ya no ve.',
  'Ese es el filo del cuchillo: todo avión vuela con suficiente ángulo para cargarte… sin caer en pérdida.',
  'Esto fue Anderson, capítulo cuatro, hecho luz. En La Forja el flujo es tuyo: ven a jugar con él.',
];

export default function AeroClase() {
  const subtitles = SUBS.map((text, i) => ({ text, at: T[i], until: beatEnd(i) }));
  return (
    <CineStage
      mood="studio"
      envIntensity={0.35}
      duration={END}
      chapter="Aeronáutica · clase 1 · por qué vuela"
      fov={50}
      cameraPos={[2.6, 1.2, 4.6]}
      postfx={{ intensity: 1.15, threshold: 0.42, vignette: 0.78, aberration: 0.0005 }}
      subtitles={subtitles}
      title={{ text: '¿Por qué vuela un avión?', at: T[0] + 0.3, until: beatEnd(0) }}
    >
      <CineCamera keys={buildCamKeys()} />
      <ambientLight intensity={0.16} color="#243050" />
      <directionalLight position={[4, 8, 6]} intensity={0.5} color="#DCE8FF" />

      <FlowFrame>
        <Wing />
        {/* el flujo (parcelas físicas) por ventana de α — corte seco entre beats */}
        <FlowParticles alpha={8 * DEG} windows={[[T[0], T[11]], [T[12], T[13]], [T[15], END]]} />
        <FlowParticles alpha={0} windows={[[T[11], T[12]]]} />
        <FlowParticles alpha={12 * DEG} windows={[[T[13], T[14]]]} />
        <FlowParticles alpha={15 * DEG} windows={[[T[14], T[15]]]} />

        <MythParcels start={T[1]} end={beatEnd(3)} />
        <JoukowskiMorph start={T[4]} end={beatEnd(5)} />
        <TrailingEdgeDrama start={T[6]} mid={T[7]} end={beatEnd(7)} />
        <BoundVortex start={T[8]} end={beatEnd(9)} />

        <PressureCloud alpha={8 * DEG} windows={[[T[10], T[11]], [T[12], T[13]]]} />
        <PressureCloud alpha={0} windows={[[T[11], T[12]]]} />
        <PressureCloud alpha={12 * DEG} windows={[[T[13], T[14]]]} />
        <PressureCloud alpha={15 * DEG} windows={[[T[14], T[15]]]} />

        <StallWarning start={T[14]} end={beatEnd(14)} />
      </FlowFrame>

      {/* la sustentación es ⊥ al freestream (horizontal en pantalla) → la
          flecha vive FUERA del marco rotado, vertical de verdad */}
      <LiftArrow start={T[9]} end={END} />
    </CineStage>
  );
}
