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
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

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

// ── entorno de SOFTBOXES (acero rudo: fondo oscuro + franjas de luz brillantes
//    que se reflejan como en un taller fotográfico, no un cuarto uniforme) ──
function StudioEnv() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const s = new THREE.Scene();
    s.background = new THREE.Color('#05070c');
    const softbox = (w: number, h: number, color: string, pos: [number, number, number]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
      m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
    };
    softbox(9, 5, '#ffffff', [-5, 6, 4]);       // key blanca arriba-izq
    softbox(7, 7, '#8fb0ff', [7, 2, 2]);        // fill fría derecha
    softbox(5, 9, '#ffdca6', [1, -2, -7]);      // rim cálida atrás
    softbox(12, 2, '#c8d4e6', [0, -6, 3]);      // franja inferior (piso)
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(s, 0.02);
    scene.environment = env.texture;
    scene.background = new THREE.Color('#080a0f');
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
// barreno de agua a lo ANCHO (local X) → perpendicular a la sección → CÍRCULO en la cara del corte
const boreX = (r: number, len: number, z: number, y = 0) => new THREE.CylinderGeometry(r, r, len, 40).rotateZ(Math.PI / 2).translate(0, y, z);
const pinZ = (r: number, len: number, x: number, z: number) => { const g = new THREE.CylinderGeometry(r, r, len, 28).rotateX(Math.PI / 2); return g.translate(x, 0, z); };

// textura de FRESADO procedural (marcas de herramienta) → la cara del corte
// refleja la luz en franjas como acero recién maquinado, no un panel vacío.
function makeMillTexture(size = 512): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y++) {                 // líneas finas de herramienta
    const v = Math.max(60, Math.min(210, 122 + Math.floor(Math.random() * 26) + Math.sin(y * 0.6) * 7));
    g.strokeStyle = `rgb(${v},${v},${v})`; g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(size, y + 0.5); g.stroke();
  }
  for (let i = 0; i < 60; i++) {                    // rayones brillantes ocasionales
    const y = Math.random() * size;
    g.strokeStyle = `rgba(220,220,220,${0.08 + Math.random() * 0.12})`;
    g.beginPath(); g.moveTo(0, y); g.lineTo(size, y + (Math.random() * 6 - 3)); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 4); t.anisotropy = 8;
  return t;
}

function MoldSection({ plane, xray }: {
  plane: THREE.Plane; xray: boolean;
}) {
  const Z = useMemo(zStack, []);
  const mid = (a: number[]) => (a[0] + a[1]) / 2;
  const clip = xray ? [] : [plane];                // rayos X = sin corte, bloque entero fantasma
  const mill = useMemo(() => makeMillTexture(), []);

  // aceros: cuerpo pulido + cara de corte con TEXTURA de fresado (refleja en franjas)
  const steel = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#6b727c', metalness: 0.75, roughness: 0.42, envMapIntensity: 0.75,
    bumpMap: mill, bumpScale: 0.25, roughnessMap: mill,
    clippingPlanes: clip, clipShadows: true, side: THREE.DoubleSide,
    transparent: xray, opacity: xray ? 0.22 : 1, depthWrite: !xray,
  }), [plane, xray, mill]);
  const capMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#8b95a2', metalness: 0.62, roughness: 0.44, envMapIntensity: 0.75,   // acero fresado que REFLEJA
    emissive: '#262b33', emissiveIntensity: 0.22,
    bumpMap: mill, bumpScale: 0.6, roughnessMap: mill,                            // marcas de herramienta = textura + brillo en franjas
    stencilWrite: true, stencilRef: 0, stencilFunc: THREE.NotEqualStencilFunc,
    stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, stencilZPass: THREE.ReplaceStencilOp,
    side: THREE.DoubleSide,
  }), [mill]);

  const cavityMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#20262f', metalness: 0.7, roughness: 0.6, clippingPlanes: clip, side: THREE.DoubleSide,
  }), [plane, xray]);
  const waterMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2f9fe0', emissive: '#1789d8', emissiveIntensity: 1.3, metalness: 0.1, roughness: 0.35,
    clippingPlanes: clip, side: THREE.DoubleSide,
  }), [plane, xray]);
  const pinMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#e6bf46', metalness: 0.65, roughness: 0.34, emissive: '#4a3a10', emissiveIntensity: 0.4,
    envMapIntensity: 0.8, clippingPlanes: clip, side: THREE.DoubleSide,
  }), [plane, xray]);

  // UN SOLO BLOQUE de acero (5 placas fusionadas) → cap de esténcil LIMPIO (sin
  // costuras dentadas). Las placas se distinguen por líneas de partición grabadas.
  const block = useMemo(() => {
    const parts = [
      boxG(MOLD.X, MOLD.Y, Z.bottomClamp[1] - Z.bottomClamp[0], mid(Z.bottomClamp)),
      boxG(MOLD.X, MOLD.Y, Z.support[1] - Z.support[0], mid(Z.support)),
      boxG(MOLD.X, MOLD.Y, Z.B[1] - Z.B[0], mid(Z.B)),
      boxG(MOLD.X, MOLD.Y, Z.A[1] - Z.A[0], mid(Z.A)),
      boxG(MOLD.X, MOLD.Y, Z.topClamp[1] - Z.topClamp[0], mid(Z.topClamp)),
    ];
    return mergeGeometries(parts, false);
  }, [Z]);

  // features reveladas por el corte (se dibujan DESPUÉS del cap → se ven "dentro")
  const cavityG = useMemo(() => boxG(MOLD.cavityX, MOLD.cavityY, MOLD.cavityDepth, Z.A[0] + MOLD.cavityDepth / 2), [Z]);
  const zCoolA = Z.A[0] + 22, zCoolB = Z.B[1] - 22;   // agua en A (arriba de cavidad) y en B (abajo)
  const coolBore = useMemo(() => [   // barrenos a lo ancho → círculos en la cara del corte, a 2 profundidades
    [zCoolA, -MOLD.coolInsetY], [zCoolA, MOLD.coolInsetY], [zCoolB, -MOLD.coolInsetY], [zCoolB, MOLD.coolInsetY],
  ].map(([z, y]) => ({ bore: boreX(MOLD.coolDia / 2 + 1.4, MOLD.X + 1, z, y), water: boreX(MOLD.coolDia / 2, MOLD.X + 2, z, y) })), [Z]);
  const pinZc = (Z.support[0] + (Z.A[0] + MOLD.cavityDepth)) / 2, pinLen = (Z.A[0] + MOLD.cavityDepth) - Z.support[0];
  const pinG = useMemo(() => [-MOLD.pinInsetX, 0, MOLD.pinInsetX].map((x) => pinZ(MOLD.pinDia / 2, pinLen, x, pinZc)), [Z]);
  // líneas de partición grabadas (finas, oscuras) en las caras del bloque
  const partingLines = useMemo(() => [Z.support[0], Z.B[0], Z.A[0], Z.topClamp[0]], [Z]);

  // ── RELLENOS DE SECCIÓN MACIZOS: lo que se VE en la cara del corte (discos/bolsas
  //    rellenos, no aritos huecos). Aparecen cuando el corte llega al centro. ──
  const zCavity = Z.A[0] + MOLD.cavityDepth / 2;
  const fillsRef = useRef<THREE.Group>(null!);
  useFrame(() => { if (fillsRef.current) fillsRef.current.visible = !xray && plane.constant < 2.5; });
  const mkFill = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ ...o, side: THREE.DoubleSide, depthTest: false, depthWrite: false });
  const discBlue = useMemo(() => mkFill({ color: '#3aa6e8', emissive: '#1f8fd8', emissiveIntensity: 1.7, roughness: 0.3, metalness: 0.1 }), []);
  const rectGold = useMemo(() => mkFill({ color: '#f0c94e', emissive: '#7a5c12', emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.5 }), []);
  const rectCav = useMemo(() => mkFill({ color: '#0e1116', emissive: '#060809', emissiveIntensity: 0.2, roughness: 0.8, metalness: 0.1 }), []);

  const cap = MOLD.X * 1.5;
  return (
    <group>
      <StudioEnv />
      {/* BLOQUE: en corte, macizo con cap de esténcil; en rayos X, fantasma entero */}
      {xray
        ? <mesh geometry={block} material={steel} renderOrder={2} />
        : <CutSolid geometry={block} plane={plane} steel={steel} capMat={capMat} renderOrder={2} capSize={cap} />}
      {/* líneas de partición entre placas (grabado) */}
      {partingLines.map((z, i) => (
        <mesh key={'pl' + i} position={[0, 0, z]} renderOrder={4}>
          <boxGeometry args={[MOLD.X + 0.4, MOLD.Y + 0.4, 0.6]} />
          <meshStandardMaterial color="#20242b" metalness={0.6} roughness={0.7} clippingPlanes={clip} transparent={xray} opacity={xray ? 0.5 : 1} />
        </mesh>
      ))}
      {/* CAVIDAD 3D (la pieza): en rayos X se ve la bolsa entera dentro del acero */}
      <mesh geometry={cavityG} material={cavityMat} renderOrder={11} />
      {/* anatomía 3D: tubos de agua + pines (completos en rayos X, seccionados en corte) */}
      {coolBore.map((c, i) => (
        <mesh key={'c' + i} geometry={c.water} material={waterMat} renderOrder={12} />
      ))}
      {pinG.map((g, i) => <mesh key={'p' + i} geometry={g} material={pinMat} renderOrder={12} />)}

      {/* RELLENOS MACIZOS sobre la cara del corte (x≈0), cada uno mirando +X.
          PlaneGeometry(W,H) + rotationY π/2: W→altura (Z local), H→profundidad (Y local). */}
      <group ref={fillsRef} renderOrder={16}>
        {/* la CAVIDAD: bolsa oscura real (corte de la pieza) — cavityDepth alto × cavityY hondo */}
        <mesh position={[0, 0, zCavity]} rotation={[0, Math.PI / 2, 0]} material={rectCav} renderOrder={16}>
          <planeGeometry args={[MOLD.cavityDepth + 1, MOLD.cavityY]} />
        </mesh>
        {/* 4 barrenos de AGUA: discos azules rellenos */}
        {[[-MOLD.coolInsetY, zCoolA], [MOLD.coolInsetY, zCoolA], [-MOLD.coolInsetY, zCoolB], [MOLD.coolInsetY, zCoolB]].map(([y, z], i) => (
          <mesh key={'wf' + i} position={[0, y, z]} rotation={[0, Math.PI / 2, 0]} material={discBlue} renderOrder={17}>
            <circleGeometry args={[MOLD.coolDia / 2, 32]} />
          </mesh>
        ))}
        {/* PIN de expulsión al centro: barra dorada vertical — pinLen alto × pinDia ancho */}
        <mesh position={[0, 0, pinZc]} rotation={[0, Math.PI / 2, 0]} material={rectGold} renderOrder={17}>
          <planeGeometry args={[pinLen, MOLD.pinDia]} />
        </mesh>
      </group>
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

interface SceneProps { playing: boolean; speed: number; xray: boolean; tRef: React.MutableRefObject<number>; }
function Scene({ playing, speed, xray, tRef }: SceneProps) {
  const Z = useMemo(zStack, []);
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), MOLD.X / 2), []);
  const { gl } = useThree();
  const controlsRef = useRef<any>(null);
  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);

  // el plano de corte BARRE de la cara +X hacia el centro (a través del pin central)
  useFrame(({ camera }, delta) => {
    if (playing) tRef.current += Math.min(delta, 1 / 30) * speed;
    const t = tRef.current;
    const sweep = Math.min(1, t / 3.4);                     // 3.4 s de barrido
    const e = 1 - Math.pow(1 - sweep, 3);
    plane.constant = (MOLD.X / 2) * (1 - e);                // de +60 (cara) a 0 (centro)
    // órbita lenta cinematográfica alrededor del eje vertical una vez hecho el corte
    if (t > 3.4) {
      const a = 0.62 + (t - 3.4) * 0.1, R = 440;
      camera.position.x = Math.sin(a) * R;
      camera.position.z = Math.cos(a) * R;
      camera.position.y = 150 + Math.sin((t - 3.4) * 0.15) * 20;
    }
    controlsRef.current?.update();
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <hemisphereLight args={['#c2d2e8', '#332d24', 0.9]} />
      <directionalLight position={[360, 220, 260]} intensity={2.6} color="#fff2e0" castShadow />{/* clave sobre la cara del corte */}
      <directionalLight position={[-240, 180, 140]} intensity={1.1} color="#8fb0ff" />
      <directionalLight position={[40, 260, -160]} intensity={0.9} color="#ffd9a8" />{/* rim cálido */}
      {/* molde DERECHO: stack local-Z → world-Y (arriba); depth local-Y → world-Z (al fondo) */}
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -TOTAL_Z / 2, 0]}>
        <MoldSection plane={plane} xray={xray} />
        {!xray && <CutEdge plane={plane} />}
      </group>
      <OrbitControls ref={controlsRef} enablePan enableZoom target={[0, 6, 0]} />
    </>
  );
}

export default function MoldSectionReveal({ onClose }: { onClose?: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [xray, setXray] = useState(false);
  const tRef = useRef(0);

  useEffect(() => {
    // render determinista: congela la reproducción y fija t exacto por frame
    (window as any).__cutRenderAt = (t: number) => { setPlaying(false); tRef.current = t; };
    (window as any).__cutReset = () => { tRef.current = 0; };
    (window as any).__cutXray = (on: boolean) => setXray(!!on);   // rayos X para el render/QA
    return () => { delete (window as any).__cutRenderAt; delete (window as any).__cutReset; delete (window as any).__cutXray; };
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: '#0a0c10' }}>
      <Canvas
        gl={{ antialias: true, stencil: true, alpha: false, powerPreference: 'high-performance' }}
        camera={{ position: [410, 150, 210], fov: 34, near: 1, far: 4000 }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.05; }}
      >
        <color attach="background" args={['#0a0c10']} />
        <Scene playing={playing} speed={speed} xray={xray} tRef={tRef} />
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
        <button onClick={() => setXray((x) => !x)} style={{ ...btn, ...(xray ? { background: '#123', borderColor: '#4a90d9', color: '#8fd0ff' } : {}) }}>👁 rayos X {xray ? 'ON' : ''}</button>
      </div>
      {onClose && <button onClick={onClose} style={{ ...btn, position: 'absolute', top: 16, right: 16 }}>✕ cerrar</button>}
    </div>
  );
}
const btn: React.CSSProperties = {
  background: '#1a2028', color: '#dfe6ef', border: '1px solid #2e3a48', borderRadius: 8,
  padding: '7px 12px', font: '600 13px ui-monospace,monospace', cursor: 'pointer',
};
