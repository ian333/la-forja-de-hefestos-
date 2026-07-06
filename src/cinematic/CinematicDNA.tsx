/**
 * CinematicDNA — el ADN estilo DREW BERRY / WEHI.TV (ciencia + cine), VIVO: la doble hélice
 * B-form se DESABROCHA en una horquilla de replicación que avanza (los strands se separan).
 *   · esqueleto = rope ROJO-CARMÍN granulado (esferas = textura molecular, no plástico)
 *   · peldaños = pares de bases CREMA (se rompen al pasar la horquilla)
 *   · fondo = bokeh cálido morado/marrón (sopa celular, profundidad — COLOR EN LAS SOMBRAS, no negro)
 *   · AURA = el campo eléctrico real (cara-i / Operador Ian, /dna-field.bin) glowing alrededor — el DIFERENCIADOR
 * Geometría REAL B-form (src/lib/bio/dna.ts: rise 3.4 Å, twist 34.29°, rP 9.4 Å). Ciencia = gancho.
 * Determinista renderAt(t) puro en t. ?clip=1 → cámara exacta + dpr 1 (render-clip).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import { B_DNA } from '@/lib/bio/dna';

function readParams() {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const n = (k: string, d: number) => { const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : d; };
  return { dur: n('dur', 20), clip: n('clip', 0), fieldExp: n('field', 0.10), sat: n('sat', 0.3) };
}
const PAR = readParams();
const DURATION = Math.max(2, PAR.dur);
const NBP = 38;                         // pares de base visibles
const SUB = 7;                          // esferas por bp (rope granulada)
const SCL = 0.34;                       // Å → escena
const RISE = B_DNA.rise * SCL;
const TW = (B_DNA.twistDeg * Math.PI) / 180;
const RP = B_DNA.rPhosphate * SCL;
const OFFS = (B_DNA.grooveOffsetDeg * Math.PI) / 180;
const HALF = (NBP * RISE) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

// posición de un punto del strand (s=0|1) en bp continuo u, con DESABROCHE sobre la horquilla yf.
// Bajo la horquilla: doble hélice intacta. Sobre ella: los dos strands se ABREN (Y de replicación).
function strandPoint(u: number, s: 0 | 1, forkU: number, out: THREE.Vector3) {
  const th = u * TW + (s === 1 ? OFFS : 0);
  const y = u * RISE - HALF;
  let r = RP, x = Math.cos(th) * r, z = Math.sin(th) * r;
  if (u > forkU) {
    // splay: separa los strands hacia lados opuestos + endereza (desabrochado)
    const k = Math.min(1, (u - forkU) * 0.16);
    const sideway = (s === 0 ? -1 : 1) * k * RP * 3.2;
    x = lerp(x, sideway, k * 0.9);
    z = lerp(z, z * (1 - k * 0.5), 1);
  }
  out.set(x, y, z);
}

function HelixReplication({ getTime }: { getTime: () => number }) {
  const strandRef = useRef<THREE.InstancedMesh>(null!);
  const rungRef = useRef<THREE.InstancedMesh>(null!);
  const NS = NBP * SUB * 2;             // esferas de esqueleto (2 strands)
  const NR = NBP;                       // peldaños
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const pa = useMemo(() => new THREE.Vector3(), []);
  const pb = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const t = getTime();
    // la horquilla AVANZA por la hélice (replicación): de arriba hacia el centro y sigue
    const forkU = lerp(NBP * 0.95, NBP * 0.25, smooth((t % DURATION) / DURATION));
    const spin = t * 0.16;               // giro lento (vivo)
    const cs = Math.cos(spin), sn = Math.sin(spin);
    // esqueleto: SUB esferas interpoladas por bp, por strand
    let idx = 0;
    for (let s = 0 as 0 | 1; s <= 1; s = (s + 1) as 0 | 1) {
      for (let i = 0; i < NBP; i++) {
        for (let k = 0; k < SUB; k++) {
          const u = i + k / SUB;
          strandPoint(u, s, forkU, pa);
          const x = pa.x * cs - pa.z * sn, z = pa.x * sn + pa.z * cs;  // giro en Y
          dummy.position.set(x, pa.y, z); dummy.scale.setScalar(1);
          dummy.updateMatrix(); strandRef.current.setMatrixAt(idx++, dummy.matrix);
        }
      }
    }
    strandRef.current.instanceMatrix.needsUpdate = true;
    // peldaños: solo BAJO la horquilla (intactos); sobre ella, escala 0 (rotos)
    for (let i = 0; i < NBP; i++) {
      const u = i + 0.5;
      strandPoint(u, 0, forkU, pa); strandPoint(u, 1, forkU, pb);
      const ax = pa.x * cs - pa.z * sn, az = pa.x * sn + pa.z * cs;
      const bx = pb.x * cs - pb.z * sn, bz = pb.x * sn + pb.z * cs;
      const mid = dummy.position.set((ax + bx) / 2, (pa.y + pb.y) / 2, (az + bz) / 2);
      const len = Math.hypot(ax - bx, pa.y - pb.y, az - bz);
      const broken = u > forkU;
      dummy.position.copy(mid);
      dummy.scale.set(broken ? 0.0001 : 1, broken ? 0.0001 : len, broken ? 0.0001 : 1);
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(bx - ax, pb.y - pa.y, bz - az).normalize());
      dummy.updateMatrix(); rungRef.current.setMatrixAt(i, dummy.matrix);
    }
    rungRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 3, 2]} intensity={1.5} color={'#fff0e0'} />
      <directionalLight position={[-2, -1, -2]} intensity={0.6} color={'#ff9a7a'} />
      {/* esqueleto rojo-carmín granulado */}
      <instancedMesh ref={strandRef} args={[undefined, undefined, NS]} frustumCulled={false}>
        <sphereGeometry args={[RP * 0.16, 10, 10]} />
        <meshStandardMaterial color={'#d8284c'} emissive={'#7a0f24'} emissiveIntensity={0.55} roughness={0.5} metalness={0.15} />
      </instancedMesh>
      {/* peldaños crema (pares de bases) */}
      <instancedMesh ref={rungRef} args={[undefined, undefined, NR]} frustumCulled={false}>
        <cylinderGeometry args={[RP * 0.07, RP * 0.07, 1, 8]} />
        <meshStandardMaterial color={'#efe0a8'} emissive={'#5a4d1e'} emissiveIntensity={0.4} roughness={0.6} metalness={0.1} />
      </instancedMesh>
    </>
  );
}

// AURA: el campo eléctrico real (cara-i) glowing alrededor — subtle, el diferenciador.
function FieldAura({ getTime }: { getTime: () => number }) {
  const [geo, setGeo] = useState<THREE.BufferGeometry | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/dna-field.bin').then(r => r.arrayBuffer()).then(buf => {
      if (!alive) return;
      const f = new Float32Array(buf); const n = Math.floor(f.length / 4);
      const LZ = 142.8, cz = LZ / 2; const SC = 0.34;
      // submuestreo: solo el AURA (descarta lo muy cercano al eje = el esqueleto, ya es geometría)
      const px: number[] = [], br: number[] = [];
      for (let i = 0; i < n; i += 2) {
        const x = f[i*4], y = f[i*4+1], z = f[i*4+2];
        const rc = Math.hypot(x, y);
        if (rc < 11) continue;                       // descarta el esqueleto; deja el aura
        px.push(x*SC, (z-cz)*SC, y*SC); br.push(f[i*4+3]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(px, 3));
      g.setAttribute('aBright', new THREE.Float32BufferAttribute(br, 1));
      setGeo(g);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    uniforms: { uExp: { value: PAR.fieldExp }, uTime: { value: 0 } },
    vertexShader: `attribute float aBright; uniform float uTime; varying float vB;
      void main(){ float a=uTime*0.16; mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a)); vec3 p=position; p.xz=R*p.xz;
        vB=aBright; vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=2.0*(300.0/-mv.z); }`,
    fragmentShader: `precision highp float; uniform float uExp; varying float vB;
      void main(){ vec2 d=gl_PointCoord-0.5; float r2=dot(d,d); if(r2>0.25) discard; float a=exp(-r2*3.5);
        vec3 c=vec3(0.25,0.7,1.0)*(0.2+0.8*vB)*a*uExp; gl_FragColor=vec4(c,a); }`,
  }), []);
  const tr = useRef(getTime); tr.current = getTime;
  useFrame(() => { mat.uniforms.uTime.value = tr.current(); });
  if (!geo) return null;
  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={-30} />;
}

// FONDO: bokeh cálido (sopa celular) — color en las sombras, profundidad. Billboard a cámara.
function CellBokeh() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ camera }) => {
    if (ref.current) {
      ref.current.quaternion.copy(camera.quaternion);
      ref.current.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(260));
    }
  });
  const mat = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false, depthTest: false, toneMapped: false,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `precision highp float; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5); }
      void main(){
        vec2 d=vUv-0.5; float r=length(d)*1.5;
        vec3 base=mix(vec3(0.10,0.045,0.10), vec3(0.025,0.012,0.035), clamp(r,0.0,1.0)); // morado cálido → profundo
        // blobs de bokeh suaves (sopa celular desenfocada)
        for(int i=0;i<7;i++){ float fi=float(i);
          vec2 c=vec2(h(vec2(fi,1.0))-0.5, h(vec2(fi,2.0))-0.5)*1.3;
          float dd=length((vUv-0.5)-c); float b=smoothstep(0.34,0.0,dd)*0.05;
          base += b*vec3(0.5,0.18,0.32); }
        gl_FragColor=vec4(base,1.0);
      }`,
  }), []);
  return <mesh ref={ref} renderOrder={-100} frustumCulled={false} material={mat}><planeGeometry args={[820,1320]} /></mesh>;
}

// CÁMARA: planos fijos (teletransportes) que CONTEMPLAN la horquilla viva. Pura en t.
function dnaShot(t: number) {
  const seg = DURATION / 5; const i = Math.min(4, Math.floor(t / seg));
  const p = (t - i * seg) / seg; const sp = smooth(p);
  const a = [0.5, 1.4, 2.4, 3.2, 4.1][i] + p * 0.12;
  const dist = [34, 30, 40, 28, lerp(60, 120, sp)][i];
  const ty = [HALF * 0.25, 0, HALF * 0.1, -HALF * 0.15, 0][i];
  const fov = [44, 40, 46, 42, lerp(40, 34, sp)][i];
  return { pos: [Math.cos(a) * dist, ty + dist * 0.14, Math.sin(a) * dist] as [number, number, number],
           target: [0, ty, 0] as [number, number, number], fov };
}
function DNARig({ getTime }: { getTime: () => number }) {
  const { camera } = useThree();
  useFrame(() => {
    const s = dnaShot(getTime());
    camera.position.set(...s.pos); camera.lookAt(s.target[0], s.target[1], s.target[2]);
    const c = camera as THREE.PerspectiveCamera; if (c.fov !== s.fov) { c.fov = s.fov; c.updateProjectionMatrix(); }
  });
  return null;
}

const CAPTIONS: { title: string; sub?: string; pos: 'top' | 'bottom' }[] = [
  { title: 'Esto es tu ADN\nreplicándose', pos: 'top' },
  { title: '10.5 escalones por vuelta', sub: '3.4 Å por paso · giro 34.3° (B-form real)', pos: 'top' },
  { title: 'La horquilla lo desabrocha', sub: 'cada hebra es molde de una nueva', pos: 'bottom' },
  { title: 'Envuelto en su campo', sub: 'el esqueleto negativo (Poisson · cara-i)', pos: 'bottom' },
  { title: '2 metros de ADN', sub: 'en CADA célula tuya · 3 mil millones de letras', pos: 'bottom' },
];
function DNACaptions({ getTime }: { getTime: () => number }) {
  const [, force] = useState(0);
  useEffect(() => { let r = 0; const tk = () => { force(v => (v + 1) % 1e6); r = requestAnimationFrame(tk); }; r = requestAnimationFrame(tk); return () => cancelAnimationFrame(r); }, []);
  const t = getTime(); const seg = DURATION / 5; const i = Math.min(4, Math.floor(t / seg)); const lt = t - i * seg;
  const op = Math.min(1, Math.max(0, (lt - 0.35) / 0.45)) * Math.min(1, Math.max(0, (seg - 0.45 - lt) / 0.5));
  if (op < 0.01) return null;
  const c = CAPTIONS[i];
  const base: React.CSSProperties = { position: 'absolute', left: 0, right: 0, textAlign: 'center', color: '#fff', opacity: op,
    fontFamily: 'Inter, system-ui, sans-serif', pointerEvents: 'none', zIndex: 10, padding: '0 6%', ...(c.pos === 'top' ? { top: '7%' } : { bottom: '8%' }) };
  return (<div style={base}>
    <div style={{ fontWeight: 800, fontSize: 'min(6.6vw,58px)', lineHeight: 1.07, whiteSpace: 'pre-line', textShadow: '0 2px 24px rgba(0,0,0,0.9)' }}>{c.title}</div>
    {c.sub && <div style={{ fontWeight: 500, fontSize: 'min(3.4vw,26px)', opacity: 0.86, marginTop: 8, textShadow: '0 2px 16px rgba(0,0,0,0.92)' }}>{c.sub}</div>}
  </div>);
}

export default function CinematicDNA() {
  const timeRef = useRef(0);
  useEffect(() => {
    const N = 6;
    const beats = Array.from({ length: N }, (_, i) => ({ id: `dna_${String(i).padStart(2,'0')}`, start: (i*DURATION)/N, end: ((i+1)*DURATION)/N, kind: 'cine' }));
    const api = { renderAt: (t: number) => { timeRef.current = Math.max(0, Math.min(DURATION, t)); }, ready: true, duration: DURATION, beats, get t() { return timeRef.current; } };
    (window as unknown as { __cinematicDNA: typeof api }).__cinematicDNA = api;
    return () => { delete (window as unknown as { __cinematicDNA?: unknown }).__cinematicDNA; };
  }, []);
  const getTime = () => timeRef.current;
  return (
    <div style={{ width: '100%', height: '100%', background: '#000', position: 'relative' }}>
      <Canvas frameloop="always" camera={{ position: [0, 0, 40], fov: 44, near: 0.1, far: 4000 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={PAR.clip > 0.5 ? 1 : [1.5, 2]} onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}>
        <DNARig getTime={getTime} />
        <CellBokeh />
        <FieldAura getTime={getTime} />
        <HelixReplication getTime={getTime} />
        <CinematicPostFX preset="tde" saturation={PAR.sat} contrast={0.18} />
      </Canvas>
      <DNACaptions getTime={getTime} />
    </div>
  );
}
