/**
 * EL CORTE DEL MOLDE — el material cortándose de verdad (no una figura hueca).
 * =============================================================================
 * Un bloque de acero de molde REAL siendo seccionado: el plano de corte BARRE y
 * revela la anatomía interna (cavidad, líneas de enfriamiento, pines de
 * expulsión, placas del mold base). Tres cosas lo hacen ver "rudo" y no de
 * juguete:
 *
 *  1. ACERO PBR con MAPA DE ENTORNO (RoomEnvironment procedural): el metal sin
 *     reflejos se ve muerto/plano; con env map refleja como acero pulido/fresado.
 *  2. CAPS DE ESTÉNCIL (técnica de three.js clipping-stencil): la cara cortada se
 *     LLENA de acero sólido. Sin esto, un sólido recortado se ve hueco por dentro
 *     = "figura". Con esto, se ve un bloque macizo rebanado.
 *  3. El plano BARRE (no aparece de golpe): se SIENTE el corte, con una línea
 *     caliente de fresado en el filo.
 *
 * Las cotas salen del molde REAL (bezel del libro por defecto, o el `diseno` de
 * moldMachine). Determinista: window.__cutRenderAt(t) puro para el pipeline 4K.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ── cotas del molde (mm) — bezel del libro por defecto ──────────────
const MOLD = {
  X: 240, Y: 160,                 // planta (ancho × fondo)
  clamp: 30, support: 46, B: 66, A: 76, topClamp: 30,   // espesores de placa (Z)
  cavityDepth: 10, cavityX: 150, cavityY: 100,          // bolsa de cavidad
  coolDia: 11, coolInsetY: 34,    // líneas de agua ⌀ + separación del centro
  pinDia: 6, pinInsetX: 45,       // pines de expulsión
};
const TOTAL_Z = MOLD.clamp + MOLD.support + MOLD.B + MOLD.A + MOLD.topClamp;   // 248 mm
const zStack = () => {
  const z0 = 0;
  const bottomClamp = [z0, z0 + MOLD.clamp];
  const support = [bottomClamp[1], bottomClamp[1] + MOLD.support];
  const B = [support[1], support[1] + MOLD.B];
  const A = [B[1], B[1] + MOLD.A];
  const topClamp = [A[1], A[1] + MOLD.topClamp];
  return { bottomClamp, support, B, A, topClamp, total: topClamp[1] };
};

// ── entorno procedural (reflejos de acero, sin assets externos) ──────
function StudioEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = env.texture;
    scene.background = new THREE.Color('#0a0c10');
    return () => { env.texture.dispose(); pmrem.dispose(); };
  }, [gl, scene]);
  return null;
}

// ── técnica de esténcil: rellena la cara cortada como sólido macizo ──
function stencilGroup(geometry: THREE.BufferGeometry, plane: THREE.Plane, renderOrder: number) {
  const group = new THREE.Group();
  const baseMat: THREE.MeshBasicMaterialParameters & any = {
    depthWrite: false, depthTest: false, colorWrite: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc,
  };
  const backMat = new THREE.MeshBasicMaterial({ ...baseMat, side: THREE.BackSide });
  backMat.clippingPlanes = [plane];
  backMat.stencilFail = THREE.IncrementWrapStencilOp;
  backMat.stencilZFail = THREE.IncrementWrapStencilOp;
  backMat.stencilZPass = THREE.IncrementWrapStencilOp;
  const back = new THREE.Mesh(geometry, backMat); back.renderOrder = renderOrder; group.add(back);

  const frontMat = new THREE.MeshBasicMaterial({ ...baseMat, side: THREE.FrontSide });
  frontMat.clippingPlanes = [plane];
  frontMat.stencilFail = THREE.DecrementWrapStencilOp;
  frontMat.stencilZFail = THREE.DecrementWrapStencilOp;
  frontMat.stencilZPass = THREE.DecrementWrapStencilOp;
  const front = new THREE.Mesh(geometry, frontMat); front.renderOrder = renderOrder; group.add(front);
  return group;
}

/** Un sólido de acero recortado por el plano + su cara cortada MACIZA (esténcil). */
function CutSolid({ geometry, plane, steel, capMat, renderOrder, capSize }: {
  geometry: THREE.BufferGeometry; plane: THREE.Plane; steel: THREE.Material; capMat: THREE.Material;
  renderOrder: number; capSize: number;
}) {
  const sGroup = useMemo(() => stencilGroup(geometry, plane, renderOrder), [geometry, plane, renderOrder]);
  const capRef = useRef<THREE.Mesh>(null!);
  const po = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    // orienta y coloca el cap sobre el plano de corte cada frame
    if (!capRef.current) return;
    plane.coplanarPoint(po.position);
    po.lookAt(po.position.x - plane.normal.x, po.position.y - plane.normal.y, po.position.z - plane.normal.z);
    capRef.current.position.copy(po.position);
    capRef.current.quaternion.copy(po.quaternion);
  });
  return (
    <group>
      <primitive object={sGroup} />
      <mesh geometry={geometry} material={steel} renderOrder={renderOrder + 1} />
      {/* cap: se dibuja donde el esténcil != 0 (dentro del sólido) → cara maciza */}
      <mesh ref={capRef} renderOrder={renderOrder + 1.5} material={capMat}>
        <planeGeometry args={[capSize, capSize]} />
      </mesh>
    </group>
  );
}

// ── geometrías del mold base (planta X×Y, apiladas en Z) ─────────────
const boxG = (x: number, y: number, z: number, cz: number) => { const g = new THREE.BoxGeometry(x, y, z); g.translate(0, 0, cz); return g; };
const boreY = (r: number, len: number, x: number, z: number) => { const g = new THREE.CylinderGeometry(r, r, len, 40); g.translate(0, 0, 0); g.rotateX(0); return g.translate(x, 0, z); };   // eje Y
const pinZ = (r: number, len: number, x: number, z: number) => { const g = new THREE.CylinderGeometry(r, r, len, 28).rotateX(Math.PI / 2); return g.translate(x, 0, z); };

function MoldSection({ plane, playing, speed, tRef }: {
  plane: THREE.Plane; playing: boolean; speed: number; tRef: React.MutableRefObject<number>;
}) {
  const Z = useMemo(zStack, []);
  const mid = (a: number[]) => (a[0] + a[1]) / 2;

  // aceros: base pulido OSCURO (no styrofoam) + cara recién fresada satinada
  const steel = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#565c66', metalness: 1.0, roughness: 0.34, envMapIntensity: 0.55,
    clippingPlanes: [plane], clipShadows: true, side: THREE.DoubleSide,
  }), [plane]);
  const steelCore = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#4c525c', metalness: 1.0, roughness: 0.3, envMapIntensity: 0.55, clippingPlanes: [plane], side: THREE.DoubleSide,
  }), [plane]);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#8a929d', metalness: 0.95, roughness: 0.52, envMapIntensity: 0.45,   // fresado fresco satinado, más claro
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
    side: THREE.DoubleSide,
  }), []);
  const capCore = useMemo(() => { const m = capMat.clone(); m.color = new THREE.Color('#7e868f'); return m; }, [capMat]);

  const cavityMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#20262f', metalness: 0.7, roughness: 0.6, clippingPlanes: [plane], side: THREE.DoubleSide,
  }), [plane]);
  const waterMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#1f6fb0', emissive: '#0d4e86', emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.4,
    clippingPlanes: [plane], side: THREE.DoubleSide,
  }), [plane]);
  const pinMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#d9b23a', metalness: 1.0, roughness: 0.28, envMapIntensity: 1.1, clippingPlanes: [plane], side: THREE.DoubleSide,
  }), [plane]);

  // placas (planta X×Y), la A con la bolsa de cavidad restada
  const plates = useMemo(() => {
    const { X, Y } = MOLD;
    // placa A con cavidad: shape con hueco central, extruida en Z
    const aShape = new THREE.Shape();
    aShape.moveTo(-X / 2, -Y / 2); aShape.lineTo(X / 2, -Y / 2); aShape.lineTo(X / 2, Y / 2); aShape.lineTo(-X / 2, Y / 2); aShape.closePath();
    return {
      bottomClamp: boxG(X, Y, Z.bottomClamp[1] - Z.bottomClamp[0], mid(Z.bottomClamp)),
      support: boxG(X, Y, Z.support[1] - Z.support[0], mid(Z.support)),
      B: boxG(X, Y, Z.B[1] - Z.B[0], mid(Z.B)),
      Alower: boxG(X, Y, MOLD.A - MOLD.cavityDepth, Z.A[0] + (MOLD.A - MOLD.cavityDepth) / 2),  // resto de A sobre la cavidad
      topClamp: boxG(X, Y, Z.topClamp[1] - Z.topClamp[0], mid(Z.topClamp)),
    };
  }, [Z]);

  const cavityG = useMemo(() => boxG(MOLD.cavityX, MOLD.cavityY, MOLD.cavityDepth, Z.A[0] + MOLD.cavityDepth / 2), [Z]);
  // líneas de enfriamiento: barrenos en Y a ambos lados, en A y en B
  const coolG = useMemo(() => [
    boreY(MOLD.coolDia / 2, MOLD.Y + 4, -MOLD.coolInsetY, Z.A[0] + 16),
    boreY(MOLD.coolDia / 2, MOLD.Y + 4, MOLD.coolInsetY, Z.A[0] + 16),
    boreY(MOLD.coolDia / 2, MOLD.Y + 4, -MOLD.coolInsetY, Z.B[1] - 16),
    boreY(MOLD.coolDia / 2, MOLD.Y + 4, MOLD.coolInsetY, Z.B[1] - 16),
  ], [Z]);
  // pines de expulsión: suben por B/support hasta la cara de cavidad
  const pinG = useMemo(() => {
    const zc = (Z.support[0] + Z.A[0]) / 2, len = Z.A[0] - Z.support[0];
    return [-MOLD.pinInsetX, 0, MOLD.pinInsetX].map((x) => pinZ(MOLD.pinDia / 2, len, x, zc));
  }, [Z]);

  const cap = MOLD.X * 1.4;
  return (
    <group>
      <StudioEnv />
      {/* placas de acero, cada una con su cap de esténcil → cara maciza */}
      <CutSolid geometry={plates.bottomClamp} plane={plane} steel={steel} capMat={capMat} renderOrder={1} capSize={cap} />
      <CutSolid geometry={plates.support} plane={plane} steel={steelCore} capMat={capCore} renderOrder={3} capSize={cap} />
      <CutSolid geometry={plates.B} plane={plane} steel={steelCore} capMat={capCore} renderOrder={5} capSize={cap} />
      <CutSolid geometry={plates.Alower} plane={plane} steel={steel} capMat={capMat} renderOrder={7} capSize={cap} />
      <CutSolid geometry={plates.topClamp} plane={plane} steel={steel} capMat={capMat} renderOrder={9} capSize={cap} />
      {/* anatomía revelada por el corte */}
      <mesh geometry={cavityG} material={cavityMat} renderOrder={12} />
      {coolG.map((g, i) => <mesh key={'c' + i} geometry={g} material={waterMat} renderOrder={13} />)}
      {pinG.map((g, i) => <mesh key={'p' + i} geometry={g} material={pinMat} renderOrder={13} />)}
    </group>
  );
}

// ── filo caliente del corte (línea de fresado que se SIENTE) ─────────
function CutEdge({ plane }: { plane: THREE.Plane }) {
  const ref = useRef<THREE.Mesh>(null!);
  const po = useMemo(() => new THREE.Object3D(), []);
  useFrame(() => {
    if (!ref.current) return;
    plane.coplanarPoint(po.position);
    po.lookAt(po.position.x - plane.normal.x, po.position.y - plane.normal.y, po.position.z - plane.normal.z);
    ref.current.position.copy(po.position);
    ref.current.quaternion.copy(po.quaternion);
  });
  return (
    <mesh ref={ref} renderOrder={20}>
      <planeGeometry args={[MOLD.X * 1.5, TOTAL_Z * 1.6]} />
      <meshBasicMaterial color="#ff6a1a" transparent opacity={0.05} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

interface SceneProps { playing: boolean; speed: number; tRef: React.MutableRefObject<number>; }
function Scene({ playing, speed, tRef }: SceneProps) {
  const Z = useMemo(zStack, []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), MOLD.X * 0.75), []);
  const { gl } = useThree();
  const controlsRef = useRef<any>(null);
  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  // el plano de corte BARRE de +X hacia el centro (0), luego se queda
  useFrame((_s, delta) => {
    if (playing) tRef.current += Math.min(delta, 1 / 30) * speed;
    const t = tRef.current;
    const sweep = Math.min(1, t / 3.2);                     // 3.2 s de barrido
    const e = 1 - Math.pow(1 - sweep, 3);
    plane.constant = MOLD.X * 0.75 * (1 - e) + 2 * e;       // de +X a ~centro
    controlsRef.current?.update();
  });

  return (
    <>
      <ambientLight intensity={0.14} />
      <directionalLight position={[280, -200, 360]} intensity={2.7} color="#fff2e0" castShadow />
      <directionalLight position={[-240, 180, 140]} intensity={0.7} color="#7fa8ff" />
      <directionalLight position={[40, 260, -160]} intensity={0.5} color="#ffd9a8" />{/* rim cálido */}
      <group position={[0, 0, -Z.total / 2]}>
        <MoldSection plane={plane} playing={playing} speed={speed} tRef={tRef} />
        <CutEdge plane={plane} />
      </group>
      <OrbitControls ref={controlsRef} enablePan enableZoom target={[0, 0, 0]} />
    </>
  );
}

export default function MoldSectionReveal({ onClose }: { onClose?: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const tRef = useRef(0);

  useEffect(() => {
    (window as any).__cutRenderAt = (t: number) => { tRef.current = t; };
    (window as any).__cutReset = () => { tRef.current = 0; };
    return () => { delete (window as any).__cutRenderAt; delete (window as any).__cutReset; };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0a0c10' }}>
      <Canvas
        gl={{ antialias: true, stencil: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [360, -300, 250], fov: 32, near: 1, far: 4000 }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
      >
        <color attach="background" args={['#0a0c10']} />
        <Scene playing={playing} speed={speed} tRef={tRef} />
      </Canvas>

      {/* HUD */}
      <div style={{ position: 'absolute', top: 16, left: 16, color: '#dfe6ef', font: '600 13px ui-monospace,monospace', textShadow: '0 1px 3px #000', lineHeight: 1.6 }}>
        <div style={{ fontSize: 15, color: '#ffb066' }}>EL CORTE DEL MOLDE · acero seccionándose</div>
        <div style={{ opacity: 0.8 }}>bezel · 240×160 mm · P20 · cavidad + agua ⌀11 + pines ⌀6</div>
      </div>
      <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => setPlaying((p) => !p)} style={btn}>{playing ? '⏸' : '▶'}</button>
        <button onClick={() => { tRef.current = 0; }} style={btn}>⟲ corte</button>
        <button onClick={() => setSpeed((s) => (s >= 2 ? 0.5 : s + 0.5))} style={btn}>{speed}×</button>
      </div>
      {onClose && <button onClick={onClose} style={{ ...btn, position: 'absolute', top: 16, right: 16 }}>✕ cerrar</button>}
    </div>
  );
}
const btn: React.CSSProperties = {
  background: '#1a2028', color: '#dfe6ef', border: '1px solid #2e3a48', borderRadius: 8,
  padding: '7px 12px', font: '600 13px ui-monospace,monospace', cursor: 'pointer',
};
