/**
 * RÓTULOS, LEYENDAS Y COTAS DENTRO DE LA ESCENA 3D.
 * ============================================================================
 * Las dos vistas de campo devuelven un `<group>` — no tienen overlay DOM propio,
 * así que TODO lo que tiene que quedar IMPRESO (el factor de exageración, δ, el
 * criterio de pandeo con sus dos números, la leyenda de la escala fija) vive
 * aquí, dibujado en un `<canvas>` 2D y montado como SPRITE.
 *
 * POR QUÉ SPRITE Y NO `<Text>` de drei: la regla de la casa prohíbe drei/Text en
 * un Canvas con postFX, y además troika sale a buscar una fuente por red — una
 * pantalla de medición no puede depender de un CDN. Un CanvasTexture es
 * autocontenido, usa la JetBrains Mono que la página ya cargó (con respaldo a
 * `monospace`) y siempre mira a la cámara.
 */
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { rampaHex, norm } from './estudio-vivo-datos';
import { envolver, lineasLeyenda, ROTULO_PX, ROTULO_PAD, type Escala, type LineaRotulo } from './vista3d-comun';

const ORO = '#c9a227';
const MONO = "'JetBrains Mono', ui-monospace, monospace";

export type { LineaRotulo } from './vista3d-comun';

/* ────────────────────────────────────────────────────────────────────────── */
/* El canvas del rótulo                                                       */
/* ────────────────────────────────────────────────────────────────────────── */

const PX = ROTULO_PX;     // altura de cuerpo, en px de textura
const PAD = ROTULO_PAD;

function medirAncho(ctx: CanvasRenderingContext2D, lineas: LineaRotulo[]): number {
  let w = 0;
  for (const l of lineas) {
    ctx.font = `${l.peso ?? 400} ${Math.round(PX * (l.sz ?? 1))}px ${MONO}`;
    w = Math.max(w, ctx.measureText(l.txt).width);
  }
  return w;
}

/** Dibuja la tarjeta de datos. Devuelve el canvas (para hacer la textura). */
export function canvasRotulo(lineas: LineaRotulo[], max = 999): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  lineas = lineas.flatMap((l) => envolver(l, max));
  const alturas = lineas.map((l) => Math.round(PX * (l.sz ?? 1) * 1.45));
  const w = Math.ceil(medirAncho(ctx, lineas)) + PAD * 2;
  const h = alturas.reduce((a, b) => a + b, 0) + PAD * 2;
  cv.width = Math.max(64, w); cv.height = Math.max(32, h);
  const c = cv.getContext('2d')!;

  c.fillStyle = 'rgba(9,14,23,0.90)';
  c.strokeStyle = 'rgba(34,48,70,1)';
  c.lineWidth = 3;
  redondeado(c, 2, 2, cv.width - 4, cv.height - 4, 14);
  c.fill(); c.stroke();

  let y = PAD;
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    const sz = Math.round(PX * (l.sz ?? 1));
    c.font = `${l.peso ?? 400} ${sz}px ${MONO}`;
    c.fillStyle = l.color ?? '#dbe5f2';
    c.textBaseline = 'top';
    c.fillText(l.txt, PAD, y + (alturas[i] - sz) / 2 - 1);
    y += alturas[i];
  }
  return cv;
}

function redondeado(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Canvas de la LEYENDA de una escala FIJA: barra de rampa + marcas + riesgo. */
export function canvasLeyenda(e: Escala, max = 52): HTMLCanvasElement {
  // los renglones se arman en el módulo PURO (`lineasLeyenda`) para que el
  // encuadre pueda MEDIR la leyenda antes de que exista el canvas
  const { cab, marcas, pie } = lineasLeyenda(e, max);
  const base = canvasRotulo([...cab, ...marcas, ...pie]);

  // la barra de rampa + el punto de color de cada marca, encima de la tarjeta
  const c = base.getContext('2d')!;
  const yMarca0 = PAD + cab.reduce((a, l) => a + Math.round(PX * (l.sz ?? 1) * 1.45), 0);
  const hMarca = Math.round(PX * 0.78 * 1.45);
  const barX = PAD + 2, barW = 12;
  const barY0 = yMarca0 + 3, barH = hMarca * e.marcas.length - 6;
  const g = c.createLinearGradient(0, barY0 + barH, 0, barY0);
  for (let i = 0; i <= 10; i++) g.addColorStop(i / 10, rampaHex(i / 10));
  c.fillStyle = g;
  c.fillRect(barX, barY0, barW, barH);
  c.strokeStyle = '#2a3a52'; c.lineWidth = 1.5;
  c.strokeRect(barX, barY0, barW, barH);
  e.marcas.forEach((m, i) => {
    c.fillStyle = rampaHex(norm(m.v, e.dom));
    c.fillRect(barX + barW + 6, barY0 + i * hMarca + hMarca * 0.28, 11, 11);
  });
  return base;
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Componentes                                                                */
/* ────────────────────────────────────────────────────────────────────────── */

function useTextura(hacer: () => HTMLCanvasElement, deps: React.DependencyList): THREE.CanvasTexture {
  const tex = useMemo(() => {
    const t = new THREE.CanvasTexture(hacer());
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

export interface PropsRotulo {
  lineas: LineaRotulo[];
  position: [number, number, number];
  /** ancho del rótulo en unidades de MUNDO del grupo padre */
  ancho: number;
  /** anclaje del sprite: 'centro' | 'sup-izq' | 'inf-izq' | 'sup-der' */
  ancla?: 'centro' | 'sup-izq' | 'inf-izq' | 'sup-der';
  /** envolver a N caracteres (el ancho del sprite es fijo: renglones largos = letra chica) */
  max?: number;
  testid?: string;
}

/** Tarjeta de datos que siempre mira a la cámara y NUNCA la tapa la geometría. */
export function Rotulo({ lineas, position, ancho, ancla = 'sup-izq', max = 999 }: PropsRotulo) {
  const clave = useMemo(() => lineas.map((l) => `${l.txt}|${l.color}|${l.peso}|${l.sz}`).join('§') + `|${max}`, [lineas, max]);
  const tex = useTextura(() => canvasRotulo(lineas, max), [clave]);
  const img = tex.image as HTMLCanvasElement;
  const alto = ancho * (img.height / img.width);
  const ref = useRef<THREE.Sprite>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = ancla === 'centro' ? [0.5, 0.5] : ancla === 'sup-izq' ? [0, 1] : ancla === 'inf-izq' ? [0, 0] : [1, 1];
    ref.current.center.set(c[0], c[1]);
  }, [ancla, tex]);
  return (
    <sprite ref={ref} position={position} scale={[ancho, alto, 1]} renderOrder={40}>
      <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

/** La leyenda de una escala FIJA, en la escena. */
export function Leyenda({ escala, position, ancho, ancla = 'inf-izq' }: {
  escala: Escala; position: [number, number, number]; ancho: number; ancla?: PropsRotulo['ancla'];
}) {
  const tex = useTextura(() => canvasLeyenda(escala), [escala.titulo, escala.dom[0], escala.dom[1]]);
  const img = tex.image as HTMLCanvasElement;
  const alto = ancho * (img.height / img.width);
  const ref = useRef<THREE.Sprite>(null);
  useEffect(() => {
    if (!ref.current) return;
    const c = ancla === 'centro' ? [0.5, 0.5] : ancla === 'sup-izq' ? [0, 1] : ancla === 'inf-izq' ? [0, 0] : [1, 1];
    ref.current.center.set(c[0], c[1]);
  }, [ancla, tex]);
  return (
    <sprite ref={ref} position={position} scale={[ancho, alto, 1]} renderOrder={40}>
      <spriteMaterial map={tex} transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </sprite>
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/* Geometría de anotación                                                     */
/* ────────────────────────────────────────────────────────────────────────── */

/** Cilindro entre dos puntos (una LÍNEA que sí se ve: `linewidth` de WebGL no
 *  existe, así que las cotas se dibujan con varillas). */
export function Varilla({ a, b, radio, color, opacidad = 1, sinProfundidad = false }: {
  a: [number, number, number]; b: [number, number, number];
  radio: number; color: string; opacidad?: number; sinProfundidad?: boolean;
}) {
  const { pos, quat, largo } = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = new THREE.Vector3().subVectors(vb, va);
    const L = d.length() || 1e-6;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return { pos: new THREE.Vector3().addVectors(va, vb).multiplyScalar(0.5), quat: q, largo: L };
  }, [a, b]);
  return (
    <mesh position={pos} quaternion={quat} renderOrder={sinProfundidad ? 30 : 0}>
      <cylinderGeometry args={[radio, radio, largo, 12]} />
      <meshBasicMaterial color={color} transparent={opacidad < 1 || sinProfundidad} opacity={opacidad} depthTest={!sinProfundidad} toneMapped={false} />
    </mesh>
  );
}

/** Polilínea gruesa (cadena de varillas) — para el arco de curvatura. */
export function Polilinea({ puntos, radio, color, opacidad = 1 }: {
  puntos: Array<[number, number, number]>; radio: number; color: string; opacidad?: number;
}) {
  return (
    <group>
      {puntos.slice(1).map((p, i) => (
        <Varilla key={i} a={puntos[i]} b={p} radio={radio} color={color} opacidad={opacidad} sinProfundidad />
      ))}
    </group>
  );
}

/**
 * COTA entre dos puntos: varilla + dos travesaños + rótulo. Es la diferencia
 * entre "se ve que se dobla" y "se dobla ESTO" — y sin ella una vista de alabeo
 * es una animación bonita.
 */
export function Cota({ a, b, texto, ancho, radio, color = ORO, anclaTexto = 'sup-izq' }: {
  a: [number, number, number]; b: [number, number, number];
  texto: LineaRotulo[]; ancho: number; radio: number; color?: string;
  anclaTexto?: PropsRotulo['ancla'];
}) {
  const tr = useMemo(() => {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const d = new THREE.Vector3().subVectors(vb, va).normalize();
    // perpendicular estable: el eje del mundo menos alineado con d
    const ax = Math.abs(d.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3().crossVectors(d, ax).normalize().multiplyScalar(radio * 7);
    return {
      a0: [va.x - p.x, va.y - p.y, va.z - p.z] as [number, number, number],
      a1: [va.x + p.x, va.y + p.y, va.z + p.z] as [number, number, number],
      b0: [vb.x - p.x, vb.y - p.y, vb.z - p.z] as [number, number, number],
      b1: [vb.x + p.x, vb.y + p.y, vb.z + p.z] as [number, number, number],
      med: [(va.x + vb.x) / 2, (va.y + vb.y) / 2, (va.z + vb.z) / 2] as [number, number, number],
    };
  }, [a, b, radio]);
  return (
    <group>
      <Varilla a={a} b={b} radio={radio} color={color} sinProfundidad />
      <Varilla a={tr.a0} b={tr.a1} radio={radio} color={color} sinProfundidad />
      <Varilla a={tr.b0} b={tr.b1} radio={radio} color={color} sinProfundidad />
      <Rotulo lineas={texto} position={tr.med} ancho={ancho} ancla={anclaTexto} max={46} />
    </group>
  );
}
