/**
 * ModelCloud — cualquier .glb se vuelve NUBE DE PUNTOS.
 * ============================================================================
 * POR QUÉ EXISTE (ian, 2026-08-29, viendo las vacas de Ostrom): "la animación
 * está hermosa, pero las vacas se ven horribles, necesitamos una mejor manera
 * de animar". Tenía razón, y el dato lo confirmó: OSTROM fue lo PEOR del lote
 * en las tres columnas (13.2 s vistos de 52, cero compartidos), y lo único que
 * lo distingue del resto es que su sujeto es geometría sólida.
 *
 * EL DIAGNÓSTICO: `AtomModel mode="atom"` pinta el .glb como relleno translúcido
 * MÁS un overlay de aristas. Con un modelo de pocos polígonos eso enseña cada
 * arista del polígono — se ven cajas. Y rompe el idioma del canal: TODO lo que
 * funciona (el puente, el enlace naciendo, el copo) son nubes donde la forma
 * EMERGE de la densidad de puntos, nunca superficies.
 *
 * LA CURA: se muestrea la SUPERFICIE de la malla (MeshSurfaceSampler, ponderado
 * por área de triángulo → densidad uniforme) y se dibuja como sprites aditivos.
 * La silueta la da la densidad, igual que en las moléculas. La ley del canon
 * aplica igual aquí: "la masa la da la DENSIDAD y el BRILLO del punto, no el
 * radio" — sprites GRANDES y TENUES, jamás puntos duros y brillantes.
 *
 *   <ModelCloud src="/models/library/animals/cow.glb" color="#EDE6CE"
 *               n={2600} fitTo={2} size={0.055} brightness={0.9} />
 */
import { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/examples/jsm/math/MeshSurfaceSampler.js';

export interface ModelCloudProps {
  src: string;
  /** cuántos puntos. 2-4k basta para una silueta legible a 4K. */
  n?: number;
  color?: string;
  /** normaliza el bounding box mayor a este tamaño (como AtomModel.fitTo) */
  fitTo?: number;
  /** radio del sprite en unidades de mundo */
  size?: number;
  brightness?: number;
  /** respiración: amplitud del temblor por punto (0 = quieto) */
  jitter?: number;
  /** semilla para que dos instancias del mismo modelo NO tengan los mismos puntos */
  seed?: number;
  /** 'add' (default) para sujetos sobre NEGRO — es lo que hace que las moléculas brillen.
   *  'normal' para objetos sobre un fondo ILUMINADO: el aditivo solo SUMA, así que sobre un
   *  pasto verde brillante no puede producir una vaca ámbar — sale verde igual (medido
   *  2026-08-29, dos intentos). Con blending normal + depthWrite el objeto OCLUYE y su color
   *  es el suyo. Regla: fondo negro → add; fondo con luz → normal. */
  blend?: 'add' | 'normal';
}

/** sprite redondo y suave. Un punto DURO se ve digital; el degradado es lo que
 *  hace que mil puntos se lean como una nube y no como confeti. */
const spriteCache = new Map<string, THREE.CanvasTexture>();
function softSprite(): THREE.CanvasTexture {
  const k = 'soft';
  const hit = spriteCache.get(k);
  if (hit) return hit;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  spriteCache.set(k, tex);
  return tex;
}

export default function ModelCloud({
  src, n = 2600, color = '#EDE6CE', fitTo = 0, size = 0.055,
  brightness = 0.9, jitter = 0.006, seed = 0, blend = 'add',
}: ModelCloudProps) {
  const { scene } = useGLTF(src) as unknown as { scene: THREE.Group };
  const ptsRef = useRef<THREE.Points>(null);

  const { geom, base } = useMemo(() => {
    // 1) juntar TODAS las mallas del glb en una sola, en espacio del modelo.
    const src3: THREE.BufferGeometry[] = [];
    const clone = scene.clone(true);
    clone.updateMatrixWorld(true);
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.geometry) return;
      const g = m.geometry.clone();
      g.applyMatrix4(m.matrixWorld);
      // el sampler solo necesita posición; deshacerse del resto evita choques de atributos
      const keep = new THREE.BufferGeometry();
      keep.setAttribute('position', g.getAttribute('position'));
      if (g.index) keep.setIndex(g.index);
      src3.push(keep.toNonIndexed());
    });
    if (!src3.length) return { geom: new THREE.BufferGeometry(), base: new Float32Array(0) };

    // 2) fusionar a mano (sin BufferGeometryUtils: una dependencia menos)
    let total = 0; for (const g of src3) total += g.getAttribute('position').count;
    const pos = new Float32Array(total * 3);
    let off = 0;
    for (const g of src3) { pos.set(g.getAttribute('position').array as Float32Array, off); off += g.getAttribute('position').count * 3; }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    merged.computeVertexNormals();

    // 3) normalizar tamaño y centrar (mismo contrato que AtomModel.fitTo)
    merged.computeBoundingBox();
    const bb = merged.boundingBox!;
    const c = new THREE.Vector3(); bb.getCenter(c);
    const s = new THREE.Vector3(); bb.getSize(s);
    const k = fitTo > 0 ? fitTo / Math.max(s.x, s.y, s.z, 1e-6) : 1;
    merged.translate(-c.x, -c.y, -c.z);
    merged.scale(k, k, k);

    // 4) MUESTREAR LA SUPERFICIE. El sampler pondera por área de triángulo, así que
    //    la densidad sale uniforme sobre la piel y no se apelmaza en los vértices.
    const sampler = new MeshSurfaceSampler(new THREE.Mesh(merged)).build();
    const out = new Float32Array(n * 3);
    const p = new THREE.Vector3();
    for (let i = 0; i < n; i++) { sampler.sample(p); out[i * 3] = p.x; out[i * 3 + 1] = p.y; out[i * 3 + 2] = p.z; }

    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(out.slice(), 3));
    return { geom: gg, base: out };
  }, [scene, n, fitTo]);

  const mat = useMemo(() => new THREE.PointsMaterial({
    color: new THREE.Color(color), size, sizeAttenuation: true,
    map: softSprite(), transparent: true, opacity: brightness,
    alphaTest: blend === 'normal' ? 0.28 : 0,      // recorta el halo para que la silueta CORTE
    blending: blend === 'normal' ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: blend === 'normal', toneMapped: blend === 'normal',
  }), [color, size, brightness, blend]);

  // RESPIRACIÓN determinista (pura en t): sin ella la nube se ve congelada, con
  // ella "vive" como las moléculas. Cero random en runtime — la escena tiene que
  // seguir siendo reproducible cuadro a cuadro para el render por lotes.
  useFrame(({ clock }) => {
    const pts = ptsRef.current;
    if (!pts || !base.length || jitter <= 0) return;
    const t = clock.elapsedTime;
    const a = (pts.geometry.getAttribute('position') as THREE.BufferAttribute);
    const arr = a.array as Float32Array;
    for (let i = 0; i < base.length; i += 3) {
      const f = i * 0.37 + seed;
      arr[i] = base[i] + Math.sin(t * 1.7 + f) * jitter;
      arr[i + 1] = base[i + 1] + Math.sin(t * 2.1 + f * 1.3) * jitter;
      arr[i + 2] = base[i + 2] + Math.cos(t * 1.9 + f * 0.7) * jitter;
    }
    a.needsUpdate = true;
  });

  return <points ref={ptsRef} geometry={geom} material={mat} />;
}
