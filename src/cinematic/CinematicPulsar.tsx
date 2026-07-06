/**
 * CinematicPulsar — el FARO del cosmos. Una estrella de neutrones que gira con su
 * eje magnético INCLINADO respecto al de rotación: los haces de emisión de los
 * polos barren el espacio y, cuando cruzan nuestra línea de visión, vemos un PULSO.
 * (El mecanismo del faro = lo que descubrió Jocelyn Bell en 1967.)
 *
 * FÍSICA REAL (reusa la del magnetar, Thompson & Duncan; Kaspi & Beloborodov):
 *   · Campo dipolar, línea de campo r(θ) = L·sin²θ.
 *   · Eje magnético inclinado un ángulo TILT respecto al eje de rotación (Y).
 *     poleAxis(t) = Ry(2π t/P) · Rx(TILT) · ŷ  → precesa en cono al girar.
 *   · Casquetes polares calientes (únicas zonas brillantes de la corteza).
 *   · Periodo P real (pulsar lento ~1.4 s para que el barrido se VEA; honesto).
 *   · El pulso = el haz apuntando a la cámara: |poleAxis · v̂_cam| → 1.
 *
 * CINE: cámara WeightedRig (pura en t) + CinematicPostFX (bloom → los polos
 * revientan). Determinista: window.__cinematicPulsar.renderAt(t) función PURA de t.
 *
 * Parametrizable por URL (?P=&tilt=&incl=&dur=) — un build, muchos pulsares.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { makeRenderer } from '@/lib/webgl-fallback';
import CinematicPostFX from './CinematicPostFX';
import NSLensed from './NSLensed';
import PulsarNebula from './PulsarNebula';
import PulsarParticles from './PulsarParticles';
import NebulaVolume from './NebulaVolume';
import PulsarEngine from './PulsarEngine';
import { spherical, lerp, smooth, WeightedRig, type CameraState, type Vec3 } from './CinematicCamera';

const R_STAR = 1.0;

function readParams() {
  const q = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search) : new URLSearchParams('');
  const n = (k: string, d: number) => {
    const v = parseFloat(q.get(k) ?? ''); return Number.isFinite(v) ? v : d;
  };
  const has = (k: string) => q.get(k) !== null;
  return {
    P: n('P', 1.4),          // periodo de rotación (s) — pulsar lento, barrido visible
    tilt: n('tilt', 35),     // inclinación eje magnético vs rotación (°)
    incl: n('incl', 28),     // inclinación baja: el mapa NICER se lee de FRENTE
    dur: n('dur', 24),       // duración del plano (s)
    beamLen: n('beamLen', 16), // largo del haz (·R)
    // ── override de cámara para STILLS (cámara FIJA, ángulos a gusto) ──
    camOver: has('az') || has('phi') || has('dist') || has('fov'),
    az: n('az', -0.1),       // azimut (rad)
    phiDeg: n('phi', 16),    // elevación (°)
    dist: n('dist', 82),     // distancia
    fovDeg: n('fov', 40),    // campo de visión (°)
    // ── look de la nube de partículas (menos "atascada": sub↑, size↓, exp↓) ──
    psize: n('size', 2.3),   // tamaño de punto
    pexp: n('exp', 0.34),    // exposición
    psub: n('sub', 1),       // submuestreo (2=mitad de partículas, 3=un tercio…)
    pcrisp: n('crisp', 1.5), // nitidez: potencia de densidad (↑ = hilos más finos)
    core: n('core', 1),      // 1=con núcleo púlsar, 0=nebulosa pura (sin morado central)
    // ── logo GAIA Prime DENTRO de la escena 3D (aditivo → bloom lo abraza, mezclado) ──
    logo: n('logo', 0),       // 0=sin logo, 1=con α GAIA Prime
    logoScale: n('logoScale', 34), // tamaño del plano (unidades de escena)
    logoInt: n('logoInt', 1.0),    // intensidad/brillo del logo
    sat: n('sat', 0.2),       // saturación postFX (riqueza de color, ref Cangrejo) — barrer por URL
    contrast: n('contrast', 0.16),
    // ── EL GRIAL: raymarcher de densidad (hilos crisp desde la física) ──
    clip: n('clip', 0),       // 1 = modo VIDEO: cámara PURA en t (rig sin lag) → lotes sin costura
    vol: n('vol', 0),         // 1 = raymarcher de volumen (en vez de puntos)
    vthresh: n('vthresh', 0.12), // umbral de densidad (↑ = hilos más selectivos)
    vsoft: n('vsoft', 0.10),  // ancho del borde del umbral (↓ = más filoso)
    vgamma: n('vgamma', 1.1), // contraste de densidad
    vexp: n('vexp', 0.5),     // exposición del volumen
    vabsorb: n('vabsorb', 5.0), // absorción (↑ = el frente tapa el fondo, más 3D)
  };
}
const PAR = readParams();
const DURATION = Math.max(2, PAR.dur);
const TILT = (PAR.tilt * Math.PI) / 180;

// ── Líneas de campo dipolar: r(θ)=L·sin²θ, varias conchas y azimuts ──
function buildFieldLines(): THREE.BufferGeometry {
  const L_SHELLS = [1.3, 1.7, 2.3, 3.2, 4.5];
  const AZ = 10;            // azimuts por concha
  const SEG = 60;           // segmentos por línea
  const pts: number[] = [];
  for (const L of L_SHELLS) {
    for (let a = 0; a < AZ; a++) {
      const phi = (a / AZ) * Math.PI * 2;
      const cphi = Math.cos(phi), sphi = Math.sin(phi);
      let prev: THREE.Vector3 | null = null;
      // θ desde donde la línea sale de la estrella (r=R) hasta el ecuador
      const th0 = Math.asin(Math.sqrt(R_STAR / L));
      for (let s = 0; s <= SEG; s++) {
        const th = th0 + (Math.PI - 2 * th0) * (s / SEG);
        const r = L * Math.sin(th) * Math.sin(th);
        if (r < R_STAR * 0.98) { prev = null; continue; }
        const x = r * Math.sin(th) * cphi;
        const z = r * Math.sin(th) * sphi;
        const y = r * Math.cos(th);
        const v = new THREE.Vector3(x, y, z);
        if (prev) { pts.push(prev.x, prev.y, prev.z, v.x, v.y, v.z); }
        prev = v;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  return g;
}

// ── Material del haz (cono): aditivo, se desvanece a lo largo + brilla en el pulso ──
function makeBeamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uIntensity: { value: 0.3 }, uColor: { value: new THREE.Color(0.6, 0.8, 1.0) } },
    vertexShader: /* glsl */`
      varying float vY; varying vec2 vUv;
      void main(){ vUv=uv; vY=position.y; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uIntensity; uniform vec3 uColor; varying float vY; varying vec2 vUv;
      void main(){
        // el cono apunta +Y desde el polo; base ancha brillante, punta tenue
        float along = clamp(vY, 0.0, 1.0);
        float fall = pow(1.0 - along, 1.6);            // se apaga a lo largo
        float edge = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 1.5); // núcleo del haz
        float a = fall * edge * uIntensity;
        gl_FragColor = vec4(uColor * a * 0.9, a);
      }`,
  });
}

function MagFrame() {
  const grp = useRef<THREE.Group>(null!);
  const fieldGeo = useMemo(buildFieldLines, []);
  const beamMatTop = useMemo(makeBeamMaterial, []);
  const beamMatBot = useMemo(makeBeamMaterial, []);
  const capTop = useRef<THREE.Mesh>(null!);
  const capBot = useRef<THREE.Mesh>(null!);
  const fieldMat = useMemo(() => new THREE.LineBasicMaterial({
    color: new THREE.Color(0.25, 0.55, 1.0), transparent: true, opacity: 0.5,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }), []);

  useFrame(({ camera }) => {
    const w = (window as unknown as { __cinematicPulsar?: { t: number } }).__cinematicPulsar;
    const t = w ? w.t : 0;
    const rot = (2 * Math.PI * t) / PAR.P;
    // orientación del marco magnético: Ry(rot)·Rx(tilt)
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0));
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), TILT);
    q.multiplyQuaternions(qy, qx);
    grp.current.quaternion.copy(q);
    // PULSO: eje magnético (local +Y) en mundo vs dirección a la cámara
    const poleAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
    const toCam = camera.position.clone().normalize();
    const align = Math.abs(poleAxis.dot(toCam));          // 1 cuando el haz apunta a la cámara
    const pulse = Math.pow(THREE.MathUtils.clamp((align - 0.6) / 0.4, 0, 1), 2.4);
    const baseI = 0.03 + pulse * 0.5;
    beamMatTop.uniforms.uIntensity.value = baseI;
    beamMatBot.uniforms.uIntensity.value = baseI;
    const capE = 0.7 + pulse * 2.6;
    (capTop.current.material as THREE.MeshBasicMaterial).color.setRGB(0.55 * capE, 0.75 * capE, capE);
    (capBot.current.material as THREE.MeshBasicMaterial).color.setRGB(0.55 * capE, 0.75 * capE, capE);
  });

  const beamLen = PAR.beamLen;
  return (
    <group ref={grp}>
      {/* líneas de campo dipolar */}
      <lineSegments geometry={fieldGeo} material={fieldMat} />
      {/* casquetes polares calientes */}
      <mesh ref={capTop} position={[0, R_STAR * 0.96, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#b3d9ff" toneMapped={false} />
      </mesh>
      <mesh ref={capBot} position={[0, -R_STAR * 0.96, 0]}>
        <sphereGeometry args={[0.16, 24, 24]} />
        <meshBasicMaterial color="#b3d9ff" toneMapped={false} />
      </mesh>
      {/* haces (conos) desde cada polo, a lo largo de ±Y */}
      <mesh position={[0, R_STAR + beamLen / 2, 0]} material={beamMatTop}>
        <coneGeometry args={[beamLen * 0.055, beamLen, 32, 1, true]} />
      </mesh>
      <mesh position={[0, -(R_STAR + beamLen / 2), 0]} rotation={[Math.PI, 0, 0]} material={beamMatBot}>
        <coneGeometry args={[beamLen * 0.055, beamLen, 32, 1, true]} />
      </mesh>
    </group>
  );
}

// Superficie de la estrella de neutrones con TEXTURA DE DATOS REALES:
// el mapa NICER de PSR J0030+0451 (Riley 2019) — una mancha chica + una media
// luna alargada, AMBAS en el mismo hemisferio (no antipodales). Color de cuerpo
// negro a ~10^6 K. La rotación hace barrer los puntos calientes = pulso térmico.
function NeutronStar() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uRot: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vNobj; varying vec3 vNview; varying vec3 vView;
      void main(){
        vNobj = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vNview = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uRot; varying vec3 vNobj; varying vec3 vNview; varying vec3 vView;
      vec3 spin(vec3 p, float a){ float c=cos(a), s=sin(a); return vec3(c*p.x - s*p.z, p.y, s*p.x + c*p.z); }
      float cap(vec3 n, vec3 c, float cr){ return smoothstep(cr, mix(cr,1.0,0.45), dot(n, normalize(c))); }
      void main(){
        vec3 n = spin(normalize(vNobj), -uRot);
        // ── Mapa NICER J0030 (Riley 2019): mancha + media luna, MISMO hemisferio ──
        float spot = cap(n, vec3(0.60, 0.77, 0.22), cos(radians(8.0)));   // mancha chica
        float cre = 0.0;                                                   // media luna = arco
        cre = max(cre, cap(n, vec3(-0.10, 0.82, 0.565), cos(radians(6.0))));
        cre = max(cre, cap(n, vec3(-0.287, 0.82, 0.497), cos(radians(6.0))));
        cre = max(cre, cap(n, vec3(-0.44, 0.82, 0.369), cos(radians(6.0))));
        float h = max(spot, cre);
        float pole = pow(abs(n.y), 5.0);                                   // casquetes algo cálidos
        vec3 crust = vec3(0.014, 0.020, 0.045) + vec3(0.03, 0.04, 0.07) * pole;
        vec3 hot   = vec3(0.62, 0.80, 1.0);            // punto caliente (blanco-azul)
        vec3 col = crust + hot * pow(h, 0.7) * 1.7;    // visible CON FORMA (no blob blanco)
        float limb = pow(max(dot(normalize(vNview), vView), 0.0), 0.5);  // limbo
        col *= mix(0.32, 1.0, limb);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), []);
  useFrame(() => {
    const w = (window as unknown as { __cinematicPulsar?: { t: number } }).__cinematicPulsar;
    mat.uniforms.uRot.value = (2 * Math.PI * (w ? w.t : 0)) / PAR.P;
  });
  return <mesh material={mat}><sphereGeometry args={[R_STAR, 96, 96]} /></mesh>;
}

// campo de estrellas de fondo (contexto en el void NEGRO)
function Starfield() {
  const geo = useMemo(() => {
    const N = 1400; const pos = new Float32Array(N * 3);
    let s = 1234.567;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < N; i++) {
      const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, r = 60 + rnd() * 40;
      const rr = Math.sqrt(1 - u * u);
      pos[i * 3] = r * rr * Math.cos(th); pos[i * 3 + 1] = r * u; pos[i * 3 + 2] = r * rr * Math.sin(th);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  return (
    <points geometry={geo}>
      <pointsMaterial size={0.18} color={'#cfe0ff'} transparent opacity={0.7} sizeAttenuation toneMapped={false} />
    </points>
  );
}

// PLANETA — ANCLA DE ESCALA (horizonte planetario, el truco más fuerte de §1).
// El púlsar DOMINA el cielo sobre la superficie de un mundo, que su luz FRÍA
// azul-blanca (Planck NS) baña. Regolito real (relieve fbm + bump). El pulso del
// faro late sobre el suelo (uPulse). Esfera GRANDE muy abajo → horizonte gentil.
function Planet({ getPulse }: { getPulse: () => number }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uPulse: { value: 0 } },
    vertexShader: /* glsl */`
      varying vec3 vWorld; varying vec3 vN; varying vec3 vObj;
      void main(){
        vObj = normalize(position);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz; vN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform float uPulse;
      varying vec3 vWorld; varying vec3 vN; varying vec3 vObj;
      float hash(vec3 p){ p=fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                   mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z); }
      float fbm(vec3 p){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.05; a*=0.5; } return v; }
      void main(){
        float fine = fbm(vObj*70.0);
        // textura MUY sutil (sin moteado de baja frecuencia = sin nube)
        vec3 N = normalize(vN + (fine-0.5)*0.22*vec3(fbm(vObj*105.0+1.7), fbm(vObj*105.0+5.3), fbm(vObj*105.0+9.1)));
        vec3 L  = normalize(-vWorld);                          // hacia el púlsar (origen)
        vec3 Vd = normalize(cameraPosition - vWorld);
        float diff = max(dot(N, L), 0.0);
        // SILUETA: el primer plano (cerca) cae a NEGRO; solo la banda del HORIZONTE
        // (lejos, el limbo que encara al púlsar) se ilumina. Gradiente por distancia.
        float d = length(cameraPosition - vWorld);
        float horizon = smoothstep(60.0, 150.0, d);
        // BORDE del limbo que cacha la luz fría (firma del horizonte planetario).
        float rim = pow(1.0 - max(dot(normalize(vN), Vd), 0.0), 3.5) * diff;
        vec3 cold = vec3(0.62,0.74,1.0);                       // luz FRÍA del púlsar
        vec3 base = vec3(0.17,0.16,0.15) * (0.9 + 0.16*fine);
        float pulseGain = 1.0 + uPulse*1.9;                    // el faro barre → el mundo LATE
        vec3 col = base * diff * cold * horizon * 3.2 * pulseGain;
        col += cold * rim * 0.9 * pulseGain;                   // BORDE brillante
        col += base * 0.005;                                   // ambiente casi nulo → silueta
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), []);
  useFrame(() => { mat.uniforms.uPulse.value = getPulse ? getPulse() : 0; });
  return (
    <mesh material={mat} position={[0, -332, -30]}>
      <sphereGeometry args={[300, 180, 180]} />
    </mesh>
  );
}

// EL FARO (mecanismo de Bell) SIN geometría — "la luz barre el mundo". El eje
// magnético inclinado TILT precesa con la rotación; cuando su haz cruza la línea de
// visión calculamos el PULSO (alineación eje↔cámara), que hace LATIR el suelo del
// planeta (el faro barriendo el mundo) — sin conos aditivos (rompían el postFX).
function PulseDriver({ getTime, onPulse }: { getTime: () => number; onPulse: (p: number) => void }) {
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), []);
  const xax = useMemo(() => new THREE.Vector3(1, 0, 0), []);
  const qy = useMemo(() => new THREE.Quaternion(), []);
  const qx = useMemo(() => new THREE.Quaternion(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const axis = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const rot = (2 * Math.PI * getTime()) / PAR.P;
    qy.setFromAxisAngle(up, rot);
    qx.setFromAxisAngle(xax, TILT);
    q.multiplyQuaternions(qy, qx);
    axis.copy(up).applyQuaternion(q);
    const len = camera.position.length() || 1;
    const align = Math.abs(axis.dot(camera.position) / len);     // 1 cuando el haz apunta a la cámara
    onPulse(Math.pow(THREE.MathUtils.clamp((align - 0.5) / 0.5, 0, 1), 2.0));
  });
  return null;   // SIN geometría → no toca el render (seguro con el postFX)
}

// LOGO GAIA Prime DENTRO de la escena 3D — billboard ADITIVO al centro de la nebulosa.
// El PNG tiene fondo NEGRO PURO → aditivo no suma nada (cero cuadrado); la α dorada se
// SUMA a la luz del gas y el bloom de CinematicPostFX la abraza, y las partículas (que se
// dibujan después) pasan POR DELANTE → la marca queda MEZCLADA con el sistema, no montada.
function GaiaMark({ scale, intensity, url = '/gaia-alpha.png' }:
  { scale: number; intensity: number; url?: string }) {
  const [tex, setTex] = useState<THREE.Texture | null>(null);
  useEffect(() => {
    const l = new THREE.TextureLoader();
    l.load(url, (t) => { (t as THREE.Texture).colorSpace = THREE.SRGBColorSpace; setTex(t); });
  }, [url]);
  const ref = useRef<THREE.Mesh>(null!);
  // Blend NORMAL con alfa por luminancia: el negro del PNG → transparente, la α dorada →
  // OPACA y nítida ENCIMA del gas (se lee perfecto). Su glow se desvanece suave al void.
  const mat = useMemo(() => tex ? new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
    blending: THREE.NormalBlending,
    uniforms: { uTex: { value: tex }, uInt: { value: intensity } },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D uTex; uniform float uInt; varying vec2 vUv;
      void main(){
        vec3 c = texture2D(uTex, vUv).rgb;
        float lum = max(c.r, max(c.g, c.b));
        float a = smoothstep(0.03, 0.40, lum) * uInt;   // fondo negro → transparente
        gl_FragColor = vec4(c, a);
      }`,
  }) : null, [tex, intensity]);
  useFrame(({ camera }) => { if (ref.current) ref.current.quaternion.copy(camera.quaternion); });
  if (!mat) return null;
  return (
    <mesh ref={ref} material={mat} renderOrder={-70} frustumCulled={false}>
      <planeGeometry args={[scale, scale]} />
    </mesh>
  );
}

// EL GUION — 3 vantages FIJOS (teletransportes = cortes secos), cámara quieta que
// CONTEMPLA. Cada ventana es casi estática (leve deriva = parallax); el corte entre
// ellas es el "teletransporte" del testigo.
const D2R = Math.PI / 180;
function cameraProgram(t: number): CameraState {
  // STILLS: cámara FIJA por URL (?az=&phi=&dist=&fov=) → ángulos a gusto, sin deriva.
  if (PAR.camOver) {
    const pos = spherical(PAR.az, PAR.phiDeg * D2R, PAR.dist);
    return { pos, target: [0, 0, 0], fov: PAR.fovDeg };
  }
  const p = t / DURATION;
  // [v7] órbita ANCHA contemplativa que deja a la nebulosa LLENAR el cuadro + push-in suave.
  const dist = lerp(90, 80, smooth(p));
  const azim = -0.4 + p * 0.7;          // deriva lenta = parallax
  const phi = 18 * D2R;
  const pos = spherical(azim, phi, dist);
  const target: Vec3 = [0, 0, 0];
  return { pos, target, fov: lerp(40, 37, smooth(p)) };
}

export default function CinematicPulsar() {
  const timeRef = useRef(0);
  const pulseRef = useRef(0);   // pulso del faro (lo escribe Beams, lo lee Planet)
  useEffect(() => {
    const N = 6;
    const beats = Array.from({ length: N }, (_, i) => ({
      id: `puls_${String(i).padStart(2, '0')}`,
      start: (i * DURATION) / N, end: ((i + 1) * DURATION) / N, kind: 'cine',
    }));
    const api = {
      renderAt: (t: number) => { timeRef.current = Math.max(0, Math.min(DURATION, t)); },
      ready: true, duration: DURATION, beats,
      get t() { return timeRef.current; },
    };
    (window as unknown as { __cinematicPulsar: typeof api }).__cinematicPulsar = api;
    return () => { delete (window as unknown as { __cinematicPulsar?: unknown }).__cinematicPulsar; };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', background: '#000' }}>
      <Canvas
        frameloop="always"
        camera={{ position: [0, 8, 34], fov: 42, near: 0.01, far: 2000 }}
        gl={makeRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })}
        dpr={PAR.clip > 0.5 ? 1 : [1.5, 2]}
        onCreated={({ gl }) => { gl.toneMapping = THREE.NoToneMapping; }}
      >
        <WeightedRig programAt={cameraProgram} getT={() => timeRef.current} dt={1 / 60}
          lag={PAR.clip > 0.5 ? 0.0001 : 0.4}
          posAmp={PAR.clip > 0.5 ? 0 : 0.08} targetAmp={PAR.clip > 0.5 ? 0 : 0.04} />
        {/* NEBULOSA DE VIENTO DE PÚLSAR (estilo Cangrejo) — el MAR de sincrotrón +
            filamentos que LLENA el cuadro, con el púlsar/toro/jet en el corazón. */}
        {/* Fondo: glo suave de sincrotrón + estrellas (filamentos del noise BAJOS — la
            estructura nítida la dan las PARTÍCULAS de la física, no el ruido). */}
        {PAR.vol > 0.5 ? (
          /* EL GRIAL: densidad física → raymarcher con umbral nítido = HILOS FILOSOS */
          <NebulaVolume url="/turb-nebula-vol.bin" dim={192} scale={30}
            getTime={() => timeRef.current} exposure={PAR.vexp} thresh={PAR.vthresh}
            soft={PAR.vsoft} gamma={PAR.vgamma} absorb={PAR.vabsorb} starSeed={2.2} />
        ) : (<>
          <PulsarNebula rNeb={30} period={PAR.P} getTime={() => timeRef.current}
            exposure={0.30} maxSteps={120} tilt={24} linearOutput starSeed={2.2} coreGain={PAR.core} />
          {/* FILAMENTOS REALES: nube de partículas de la simulación Rayleigh-Taylor
              (concentración física = nitidez de navaja). */}
          <PulsarParticles url="/turb-nebula.bin" scale={24.0} size={PAR.psize}
            getTime={() => timeRef.current} exposure={PAR.pexp} />
        </>)}
        {/* EL MOTOR del púlsar (núcleo + toro + jets) — el corazón que lo hace púlsar. */}
        {/* motor desactivado: versión SIN el púlsar (solo nebulosa) */}
        {/* <PulsarEngine .../> */}
        {/* LOGO GAIA Prime mezclado en el gas (aditivo, bloom lo abraza, partículas delante) */}
        {PAR.logo > 0.5 && <GaiaMark scale={PAR.logoScale} intensity={PAR.logoInt} />}
        <CinematicPostFX preset="pulsar" saturation={PAR.sat} contrast={PAR.contrast} />
      </Canvas>
    </div>
  );
}
