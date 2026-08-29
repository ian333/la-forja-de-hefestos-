/**
 * COTAS EN 3D DENTRO DEL STUDIO — "es una hueva ir midiendo en Fusion. COTAS EN 3D,
 * las más importantes. Encontrarás errores: como no hay suficiente información en
 * pantalla no extraes todos los errores" (user 2026-07-15).
 *
 * El diagnóstico se cumplió DOS veces: el bug M16-vs-M10 se cazó porque el panel tenía
 * texto, y el de "el tornillo se come el asiento del inserto" (12/12 barrenos, auditor
 * en verde) se cazó porque las cotas pusieron `ancho 381`, `bolsa 332` y `tornillo x 23`
 * JUNTOS en pantalla. La aritmética saltó sola. Las cotas no son comodidad de UI: son
 * el INSTRUMENTO DE AUDITORÍA.
 *
 * Cada cota trae DOS cifras — lo que la RECETA dice y lo que el SÓLIDO mide — porque una
 * cota que solo repite el parámetro es decoración; una que las enfrenta es un detector.
 *
 * ARQUITECTURA (2 gotchas del proyecto respetados):
 *  · Texto en divs HUD FUERA del Canvas, no `drei <Text>` (crashea con EffectComposer).
 *  · Posicionamiento IMPERATIVO (refs + useFrame mutando style.transform): cero
 *    re-renders de React por frame — el mismo patrón de MoldOpenDriver.
 * Archivo PROPIO a propósito: ForgeBRepStudio ya son ~5.8k líneas con 70 useState y está
 * anotado "partirlo ANTES de más features". Lo nuevo nace afuera.
 */
import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Dim3D } from '../mold/mold-dimensions';

export interface CotaSet { role: string; dims: Dim3D[] }

const COL_OK = '#7ee0a0', COL_BAD = '#ff6b6b', COL_PLAIN = '#f2c14e';
/**
 * PALETA — el molde conserva la suya (verde cumple / rojo viola / ámbar dato).
 * EL FOCO (U3, investigación de Horizon Zero Dawn) trae la suya: el cuerpo de la
 * pieza en CIAN frío = lo que la máquina MIDIÓ, y en ÁMBAR lo que EXIGE atención.
 * Son dos IDIOMAS distintos a propósito: en Horizon el holograma y la tiza no se
 * parecen para que sepas sin pensar cuál es cuál.
 */
export interface PaletaCota { ok: string; bad: string; plain: string }
export const PALETA_MOLDE: PaletaCota = { ok: COL_OK, bad: COL_BAD, plain: COL_PLAIN };
export const PALETA_FOCO: PaletaCota = { ok: '#5fd4f5', bad: '#ff6b6b', plain: '#5fd4f5' };
const colorDe = (d: Dim3D, p: PaletaCota) => (d.ok === false ? p.bad : d.ok === true ? p.ok : p.plain);
const colorOf = (d: Dim3D) => colorDe(d, PALETA_MOLDE);

/**
 * Texto de la cota. DOS modos, porque son dos preguntas distintas:
 *  · 'auditoria' (el molde): receta vs realidad, nunca una sola cifra — una cota
 *    que repite el parámetro es decoración; una que las enfrenta es un detector.
 *  · 'medida' (EL FOCO): aquí NO hay receta. La envolvente de tu pieza no se
 *    "declaró" en ningún lado: se midió. Escribir "22 = 22 ✓" sería justamente la
 *    decoración que este archivo prohíbe. Se escribe el número, con su unidad.
 */
export function cotaLabel(d: Dim3D, modo: 'auditoria' | 'medida' = 'auditoria'): string {
  if (modo === 'medida') {
    const v = d.measured ?? d.value;
    return `${d.label} ${v.toFixed(1)} mm`;
  }
  if (d.measured == null) return `${d.label} ${d.value}`;
  return d.ok ? `${d.label} ${d.value} = ${d.measured} ✓` : `${d.label} ${d.value} ≠ ${d.measured} ✗`;
}

/** LÍNEAS de cota dentro del Canvas (geometría cruda, sin drei). */
export function CotaLines({ sets, paleta = PALETA_MOLDE }: { sets: CotaSet[]; paleta?: PaletaCota }) {
  const geom = useMemo(() => {
    const ok: number[] = [], bad: number[] = [], plain: number[] = [];
    for (const s of sets) for (const d of s.dims) {
      const arr = d.ok === false ? bad : d.ok === true ? ok : plain;
      arr.push(d.a[0], d.a[1], d.a[2], d.b[0], d.b[1], d.b[2]);
    }
    const mk = (a: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g; };
    return { ok: mk(ok), bad: mk(bad), plain: mk(plain) };
  }, [sets]);
  return (
    <group renderOrder={999}>
      <lineSegments geometry={geom.ok}><lineBasicMaterial color={paleta.ok} depthTest={false} transparent opacity={0.95} /></lineSegments>
      <lineSegments geometry={geom.plain}><lineBasicMaterial color={paleta.plain} depthTest={false} transparent opacity={0.95} /></lineSegments>
      {/* las MALAS más gruesas y siempre encima: el error no se esconde */}
      <lineSegments geometry={geom.bad}><lineBasicMaterial color={paleta.bad} depthTest={false} linewidth={3} /></lineSegments>
    </group>
  );
}

/** DRIVER: proyecta cada cota a pantalla y mueve su div. Imperativo = 0 re-renders.
 *  ⚠ DEBE colgar del MISMO grupo que el molde: la escena rota el modelo −90° en X
 *  (el CAD es Z-arriba, three.js Y-arriba) y lo sube +8. Si se proyecta con las
 *  coordenadas CRUDAS de la receta, las etiquetas se van lejos de la geometría —
 *  salían amontonadas abajo-izquierda, fuera del molde. `localToWorld` del propio
 *  group aplica la cadena de transforms sea cual sea, sin duplicarla a mano. */
export function CotaDriver({ sets, refs }: { sets: CotaSet[]; refs: React.MutableRefObject<Array<HTMLDivElement | null>> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const anchor = useRef<THREE.Group>(null);
  const v = useRef(new THREE.Vector3()).current;
  useFrame(() => {
    const g = anchor.current;
    if (!g) return;
    let i = 0;
    for (const s of sets) for (const d of s.dims) {
      const el = refs.current[i++];
      if (!el) continue;
      v.set((d.a[0] + d.b[0]) / 2, (d.a[1] + d.b[1]) / 2, (d.a[2] + d.b[2]) / 2);
      g.localToWorld(v);          // ← la cota vive en el marco del molde, no en el mundo
      v.project(camera);
      // detrás de la cámara → esconder (si no, el label aparece espejeado del otro lado)
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = '';
      el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * size.width}px,${(-v.y * 0.5 + 0.5) * size.height}px)`;
    }
  });
  // ancla vacía: hereda los transforms del grupo del molde para localToWorld
  return <group ref={anchor} />;
}

/** COTA VIVA DE LA APERTURA (§6.3.2) — "el movimiento debe de tener cota pues se está
 *  calculando cuánto se abrirá, no?" (user). La respuesta era NO: la animación tenía un
 *  `OPEN = 80` inventado y el selector de máquina juzgaba el daylight con el molde
 *  CERRADO — aprobaba máquinas que no lo pueden abrir (25 casos en el barrido).
 *
 *  Esta cota NO recalcula la carrera: LEE la posición real de la placa A (lo que la
 *  animación de verdad puso en pantalla) y la enfrenta con la que manda el estudio. Si
 *  el driver se despega del libro, la cota lo delata — igual que las cotas estáticas
 *  enfrentan receta vs sólido. Una cota que repite el parámetro es decoración.
 *
 *  Va DENTRO del Canvas y cuelga del grupo del molde (localToWorld, mismo gotcha del
 *  −90° en X que amontonaba las etiquetas fuera del molde). */
export function CotaApertura({ refs, openMm, z0, x, y, labelRef }: {
  /** los mismos refs que mueve MoldOpenDriver: de ahí sale la apertura REAL */
  refs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  /** carrera que manda el estudio (§6.3.2 = 2.5 × altura de pieza) */
  openMm: number;
  /** z del plano de partición (plateStackZ(spec).A) */
  z0: number;
  /** dónde plantar la cota (afuera del molde, en el plano de partición) */
  x: number; y: number;
  labelRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const anchor = useRef<THREE.Group>(null);
  const v = useRef(new THREE.Vector3()).current;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // 3 segmentos = 6 vértices: línea vertical + garra abajo + garra arriba
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Array(18).fill(0), 3));
    return g;
  }, []);
  const mat = useRef<THREE.LineBasicMaterial>(null);
  useFrame(() => {
    const g = anchor.current;
    if (!g) return;
    // la apertura REAL en pantalla = lo que el driver le puso a la placa A
    const O = refs.current['A']?.position.z ?? 0;
    const T = 8;                                            // garras de la cota
    const p = geom.getAttribute('position') as THREE.BufferAttribute;
    const arr = p.array as Float32Array;
    const set = (i: number, ax: number, ay: number, az: number) => { arr[i * 3] = ax; arr[i * 3 + 1] = ay; arr[i * 3 + 2] = az; };
    set(0, x, y, z0);          set(1, x, y, z0 + O);        // la carrera
    set(2, x - T, y, z0);      set(3, x + T, y, z0);        // garra: partición
    set(4, x - T, y, z0 + O);  set(5, x + T, y, z0 + O);    // garra: hasta dónde subió
    p.needsUpdate = true;
    geom.computeBoundingSphere();
    // llena = verde; a medio camino = ámbar. El color NO miente sobre el estado.
    const full = openMm > 0 && O >= openMm - 0.5;
    if (mat.current) mat.current.color.set(full ? COL_OK : COL_PLAIN);
    const el = labelRef.current;
    if (!el) return;
    v.set(x, y, z0 + O / 2);
    g.localToWorld(v);                                      // marco del molde, no el mundo
    v.project(camera);
    if (v.z > 1) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.color = full ? COL_OK : COL_PLAIN;
    el.style.borderColor = `${full ? COL_OK : COL_PLAIN}55`;
    el.textContent = `apertura ${O.toFixed(0)} / ${openMm.toFixed(0)} mm`;
    el.style.transform = `translate(-50%,-50%) translate(${(v.x * 0.5 + 0.5) * size.width}px,${(-v.y * 0.5 + 0.5) * size.height}px)`;
  });
  return (
    <group ref={anchor} renderOrder={999}>
      <lineSegments geometry={geom}>
        <lineBasicMaterial ref={mat} color={COL_PLAIN} depthTest={false} transparent opacity={0.95} />
      </lineSegments>
    </group>
  );
}

/** etiqueta de la cota de apertura (FUERA del Canvas; el texto lo escribe CotaApertura). */
export function CotaAperturaLabel({ labelRef, why }: {
  labelRef: React.MutableRefObject<HTMLDivElement | null>; why: string;
}) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }}>
      <div ref={labelRef} data-testid="cota-apertura" title={why}
        style={{
          position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap',
          font: '600 11px ui-monospace,Menlo,monospace', color: COL_PLAIN,
          background: 'rgba(10,12,17,0.86)', border: `1px solid ${COL_PLAIN}55`,
          borderRadius: 3, padding: '1px 5px', letterSpacing: '0.2px',
        }} />
    </div>
  );
}

/** OVERLAY de etiquetas (va FUERA del Canvas, encima del viewport). */
export function CotaLabels({ sets, refs, paleta = PALETA_MOLDE, testid = 'mold-cotas-overlay', modo = 'auditoria' }: {
  sets: CotaSet[]; refs: React.MutableRefObject<Array<HTMLDivElement | null>>; paleta?: PaletaCota; testid?: string;
  modo?: 'auditoria' | 'medida';
}) {
  const flat = sets.flatMap((s) => s.dims.map((d) => ({ d, role: s.role })));
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 6 }} data-testid={testid}>
      {flat.map(({ d, role }, i) => (
        <div key={`${role}-${d.id}`} ref={(el) => { refs.current[i] = el; }}
          data-testid={`cota-${role}-${d.id}`}
          title={d.why ?? ''}
          style={{
            position: 'absolute', left: 0, top: 0, whiteSpace: 'nowrap',
            font: '600 11px ui-monospace,Menlo,monospace', color: colorDe(d, paleta),
            background: 'rgba(10,12,17,0.86)', border: `1px solid ${colorDe(d, paleta)}55`,
            borderRadius: 3, padding: '1px 5px', letterSpacing: '0.2px',
          }}>
          {cotaLabel(d, modo)}
        </div>
      ))}
    </div>
  );
}
