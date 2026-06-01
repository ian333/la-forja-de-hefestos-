import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// =====================================================================
// ScaleReference — objeto de referencia de escala (el truco de Interstellar)
// ---------------------------------------------------------------------
// Una sonda/derelicto low-poly que deriva MUY pequena en el encuadre.
// Sin referencia el agujero negro no asusta: este punto que apenas se
// reconoce como artificial le da MAGNITUD, peso y parallax a la escena.
//
// Fisicamente NEUTRO: solo composicion/escala, no toca ninguna fisica.
// DETERMINISTA: posicion y rotacion son funcion PURA de t (prop). Nada
// de Math.random ni del clock de three: el render offline frame a frame
// debe ser 100% reproducible.
//
// Las luces de posicion EMITEN HDR (toneMapped={false}): el ACES global
// del postFX las tonemap-ea una sola vez; el Bloom las convierte en motas
// que pulsan. Sin doble tonemap.
// =====================================================================

// pseudo-random determinista (hash de enteros) — NADA de Math.random
function hash11(x: number): number {
  const h = Math.sin(x * 127.1) * 43758.5453;
  return h - Math.floor(h);
}

// smoothstep puro (sin depender de THREE.MathUtils): borde suave en [e0..e1]
function smoothstep(x: number, e0: number, e1: number): number {
  const u = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return u * u * (3 - 2 * u);
}

// parpadeo determinista de una baliza: cuadrada con duty cycle, fase por seed.
// Devuelve intensidad emisiva en [base..peak]. Funcion PURA de (t, seed).
function blink(t: number, seed: number, hz: number, base: number, peak: number): number {
  const phase = hash11(seed * 7.31);
  const duty = 0.18 + 0.12 * hash11(seed * 3.77); // fraccion encendida
  const cyc = (t * hz + phase) % 1;
  // borde suave para que el Bloom no haga stepping feo entre frames
  const edge = 0.04;
  const on = smoothstep(cyc, 0, edge) * (1 - smoothstep(cyc, duty - edge, duty));
  return base + (peak - base) * on;
}

// ---------------------------------------------------------------------
// Parametros de la trayectoria de deriva. Todo lento y suave: el objeto
// SALE del encuadre con el tiempo (camara con peso, sujeto que se va).
// ---------------------------------------------------------------------
export interface DriftPath {
  /** centro de la deriva en mundo */
  center?: [number, number, number];
  /** amplitud del lazo de deriva por eje */
  amplitude?: [number, number, number];
  /** velocidad angular del lazo (rad/seg de t) por eje — manten bajo */
  speed?: [number, number, number];
  /** deriva lineal constante (el objeto se aleja/cruza el encuadre) por eje/seg */
  drift?: [number, number, number];
  /** velocidad de tumbo (rad/seg de t) por eje del cuerpo */
  tumble?: [number, number, number];
}

const DEFAULT_PATH: Required<DriftPath> = {
  center: [6.2, 1.4, -3.0],
  amplitude: [0.9, 0.5, 0.7],
  speed: [0.013, 0.019, 0.011],
  drift: [-0.018, 0.004, 0.009],
  tumble: [0.06, 0.021, 0.034],
};

export interface ScaleReferenceProps {
  /** tiempo de la escena (seg). El parent lo pasa dentro de su renderAt(t). */
  t: number;
  /**
   * Fuente SÍNCRONA opcional del t: si se pasa, el useFrame lee getT() en cada
   * tick en vez del prop `t` (cero skew de 1 frame vs la cámara, cero setState en
   * el camino de render determinista). PURA en t igual: la deriva sigue siendo
   * función pura del tiempo que devuelve getT.
   */
  getT?: () => number;
  /**
   * escala global del derelicto. Mantenlo DIMINUTO frente al sujeto:
   * debe ser una mota apenas reconocible como artificial. Default ~0.05.
   */
  scale?: number;
  /** color base de las luces de posicion / casco emisivo */
  emissiveColor?: THREE.ColorRepresentation;
  /** parametros de la trayectoria de deriva (ver DriftPath) */
  path?: DriftPath;
  /** semilla para variar fases de balizas entre instancias */
  seed?: number;
}

// posicion del derelicto: funcion PURA de t (lazo suave + deriva lineal)
function driftPosition(t: number, p: Required<DriftPath>, out: THREE.Vector3): THREE.Vector3 {
  out.set(
    p.center[0] + Math.sin(t * p.speed[0] * Math.PI * 2) * p.amplitude[0] + t * p.drift[0],
    p.center[1] + Math.sin(t * p.speed[1] * Math.PI * 2 + 1.3) * p.amplitude[1] + t * p.drift[1],
    p.center[2] + Math.sin(t * p.speed[2] * Math.PI * 2 + 2.7) * p.amplitude[2] + t * p.drift[2],
  );
  return out;
}

/**
 * Derelicto de escala: anillo tipo Endurance + cuerpo central (cilindro +
 * paneles) + balizas de posicion rojas/verdes parpadeantes. Tumba lento.
 *
 * Uso (dentro de una escena con EffectComposer/ACES):
 *   <ScaleReference t={t} scale={0.05} emissiveColor="#ff5a3c" />
 *
 * El parent debe llamarlo con el MISMO t que usa en window.__cinematic*.renderAt.
 */
export function ScaleReference({
  t,
  getT,
  scale = 0.05,
  emissiveColor = '#cdd6ff',
  path,
  seed = 0,
}: ScaleReferenceProps) {
  const groupRef = useRef<THREE.Group>(null);

  // ref vivo a getT para leerlo en useFrame sin closure stale.
  const getTRef = useRef(getT);
  getTRef.current = getT;

  // path resuelto una sola vez (estable). Si cambia el prop, se recalcula.
  const cfg = useMemo<Required<DriftPath>>(() => ({ ...DEFAULT_PATH, ...path }), [path]);

  // scratch reutilizable: cero allocs por frame, determinismo intacto
  const posScratch = useMemo(() => new THREE.Vector3(), []);

  // colores derivados estables
  const hullColor = useMemo(() => new THREE.Color('#10131c'), []);
  const baseEmissive = useMemo(() => new THREE.Color(emissiveColor), [emissiveColor]);

  // geometria de balizas: refs para mutar emissiveIntensity por frame
  const beaconRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

  // balizas (luces de posicion): rojo babor / verde estribor + blanca cola.
  // posiciones FIJAS en el cuerpo; el parpadeo es lo que vive en t.
  const beacons = useMemo(() => {
    return [
      { pos: new THREE.Vector3(-0.62, 0.0, 0.0), color: new THREE.Color('#ff2b1f'), hz: 0.55, peak: 26, seed: seed + 1 }, // babor (rojo)
      { pos: new THREE.Vector3(0.62, 0.0, 0.0), color: new THREE.Color('#27ff5a'), hz: 0.62, peak: 26, seed: seed + 2 }, // estribor (verde)
      { pos: new THREE.Vector3(0.0, 0.0, -0.52), color: new THREE.Color('#ffffff'), hz: 1.30, peak: 34, seed: seed + 3 }, // estrobo cola (blanca, rapida)
      { pos: new THREE.Vector3(0.0, 0.34, 0.30), color: baseEmissive.clone(), hz: 0.40, peak: 14, seed: seed + 4 }, // baliza dorsal tenue
    ];
  }, [seed, baseEmissive]);

  // anillo Endurance: modulos distribuidos en el toro (greebles = detalle = escala)
  const ringModules = useMemo(() => {
    const n = 12;
    const arr: { angle: number; jitter: number }[] = [];
    for (let i = 0; i < n; i++) {
      arr.push({ angle: (i / n) * Math.PI * 2, jitter: 0.85 + 0.3 * hash11(i + seed * 11) });
    }
    return arr;
  }, [seed]);

  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;

    // t SÍNCRONO: si hay getT, lo leemos del ref en este mismo tick; si no, el prop.
    const tt = getTRef.current ? getTRef.current() : t;

    // ---- posicion: funcion PURA de t ----
    driftPosition(tt, cfg, posScratch);
    g.position.copy(posScratch);

    // ---- tumbo: rotacion = funcion PURA de t ----
    g.rotation.set(tt * cfg.tumble[0], tt * cfg.tumble[1], tt * cfg.tumble[2]);

    // escala global aplicada al grupo (cuerpo modelado a ~1 unidad)
    g.scale.setScalar(scale);

    // ---- parpadeo determinista de balizas ----
    for (let i = 0; i < beacons.length; i++) {
      const mat = beaconRefs.current[i];
      if (!mat) continue;
      mat.emissiveIntensity = blink(tt, beacons[i].seed, beacons[i].hz, 0.0, beacons[i].peak);
    }
  });

  return (
    <group ref={groupRef}>
      {/* ---- cuerpo central: cilindro + paneles (casco oscuro, mate) ---- */}
      <mesh castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[0.16, 0.16, 1.05, 12]} />
        <meshStandardMaterial color={hullColor} roughness={0.78} metalness={0.55} />
      </mesh>

      {/* tope/proa: pequeno cono para que se lea direccionalidad */}
      <mesh position={[0, 0.58, 0]}>
        <coneGeometry args={[0.16, 0.22, 12]} />
        <meshStandardMaterial color={hullColor} roughness={0.7} metalness={0.6} />
      </mesh>

      {/* paneles solares: dos boxes finos como alas (parallax silhouette) */}
      <mesh position={[0.0, 0.05, 0.0]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[0.02, 1.7, 0.42]} />
        <meshStandardMaterial
          color={'#0a1430'}
          roughness={0.35}
          metalness={0.2}
          emissive={baseEmissive}
          emissiveIntensity={0.25}
        />
      </mesh>
      <mesh position={[0.0, -0.18, 0.0]} rotation={[Math.PI / 2, 0, 0]}>
        <boxGeometry args={[0.9, 0.02, 0.3]} />
        <meshStandardMaterial color={'#0a1430'} roughness={0.35} metalness={0.2} />
      </mesh>

      {/* ---- anillo tipo Endurance, en plano dorsal ---- */}
      <group position={[0, 0.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <torusGeometry args={[0.7, 0.05, 8, 36]} />
          <meshStandardMaterial color={hullColor} roughness={0.7} metalness={0.6} />
        </mesh>
        {/* modulos del anillo: greebles = micro-estructura = sensacion de escala */}
        {ringModules.map((m, i) => (
          <mesh
            key={i}
            position={[Math.cos(m.angle) * 0.7, Math.sin(m.angle) * 0.7, 0]}
            rotation={[0, 0, m.angle]}
          >
            <boxGeometry args={[0.1 * m.jitter, 0.09, 0.12 * m.jitter]} />
            <meshStandardMaterial color={'#181c28'} roughness={0.75} metalness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ---- debris/shard suelto que tumba cerca (rompe la simetria) ---- */}
      <mesh position={[0.95, -0.35, 0.4]} rotation={[t * 0.11, t * 0.07, t * 0.05]}>
        <icosahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial color={'#0d1018'} roughness={0.9} metalness={0.4} flatShading />
      </mesh>

      {/* ---- balizas de posicion: motas EMISIVAS HDR (toneMapped off) ---- */}
      {beacons.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial
            ref={(el) => {
              beaconRefs.current[i] = el;
            }}
            color={'#000000'}
            emissive={b.color}
            emissiveIntensity={0}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default ScaleReference;
