/**
 * EL FOCO DEL MOLDE · LA CAPA VISUAL — escanear el molde como Aloy escanea una máquina.
 * ============================================================================
 * ian (2026-10-06): «el uso de la Forja debería sentirse como estar en una película futurista, como Horizon
 * Zero Dawn / Forbidden West. TENEMOS EL FOCO, MEJÓRALO PARA QUE TE AYUDE A IDENTIFICAR ERRORES».
 *
 * Lo que toma de Horizon (y por qué sirve para encontrar errores, no solo para verse bonito):
 *   · EL PULSO: una onda sale del centro del molde y lo barre; lo que la onda toca se ENCIENDE. El ojo sigue
 *     la onda y llega solo a los puntos débiles — no hay que buscarlos en una lista.
 *   · LOS PUNTOS DÉBILES: en la máquina, el componente que hay que romper brilla y pulsa. Aquí pulsa el LUGAR
 *     exacto del error (el punto medio de la cota que lo mide), con la cota dibujada entre los dos cuerpos.
 *   · LA FICHA: nombre + un dato en lenguaje natural, unida a su lugar por una línea guía. Las fichas NO se
 *     enciman: cada cuadro se acomodan por prioridad (fallas primero) en el primer hueco libre.
 *   · EL COLOR DICE QUÉ ES: cian = lo que el Foco midió; rojo = falla; ámbar = pasa de panzazo. (La regla de
 *     origen de foco-lentes.ts: cian medido / violeta simulado — aquí todo es medido, nada simulado.)
 *
 * Arquitectura (los gotchas del proyecto, los mismos de MoldCotas3D):
 *   · `FocoMoldeEscena` va DENTRO del Canvas y DENTRO del grupo del molde (hereda la rotación −90° X y el +8):
 *     dibuja el pulso, los rombos y las cotas, y proyecta cada cuadro las fichas — imperativo, 0 re-renders.
 *   · `FocoMoldeHUD` va FUERA del Canvas (texto en DOM, nunca drei <Text> con EffectComposer).
 *   · Uniforms con useMemo una vez + `.value` mutado en useFrame.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Hallazgo, ResultadoFoco } from '../mold/foco-molde';
import type { PuntoRecorrido, MarcaRecorrido, BarraRecorrido } from '../mold/inspeccion-recorrido';
import { PIEL } from './piel-futuro';

/** la paleta del Foco SALE de la piel (cyberpunk + holograma, 2026-10-22): cian = medido, rojo neón = falla, naranja = de panzazo */
export const FOCO = {
  cian: PIEL.medido,
  cianTenue: 'rgba(34,225,255,0.32)',
  falla: PIEL.falla,
  aviso: PIEL.aviso,
  fondo: PIEL.fondo.vidrio,
  tinta: PIEL.texto.primario,
  gris: PIEL.texto.secundario,
};
const colorSev = (h: Hallazgo) => (h.sev === 'falla' ? FOCO.falla : FOCO.aviso);

/** Duración del pulso (s): sale, barre, se apaga. */
const PULSO_S = 2.4;

export interface FocoRefs {
  fichas: React.MutableRefObject<Array<HTMLDivElement | null>>;
  guias: React.MutableRefObject<SVGSVGElement | null>;
}

/* ───────────────────── dentro del Canvas ───────────────────── */

export function FocoMoldeEscena({ foco, t0, sel, refs, centro, radio }: {
  foco: ResultadoFoco;
  /** performance.now() del escaneo — el pulso y el encendido se miden desde aquí */
  t0: number;
  /** hallazgo elegido (índice) o null */
  sel: number | null;
  refs: FocoRefs;
  /** centro y radio del molde (marco del molde, mm) — de ahí sale la onda */
  centro: [number, number, number];
  radio: number;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const ancla = useRef<THREE.Group>(null);
  const v = useRef(new THREE.Vector3()).current;
  const H = foco.hallazgos;

  // EL PULSO: una cáscara esférica con brillo de borde (fresnel) que crece y se desvanece.
  const pulso = useMemo(() => ({
    uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(FOCO.cian) } },
    vertexShader: /* glsl */`
      varying vec3 vN; varying vec3 vV;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uT; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main() {
        float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        float vida = (1.0 - uT) * smoothstep(0.0, 0.08, uT);
        gl_FragColor = vec4(uColor * (0.6 + 1.6 * fres), (0.05 + 0.85 * fres) * vida);
      }`,
  }), []);
  const pulsoMesh = useRef<THREE.Mesh>(null);
  // una MARCA por lugar (el mismo problema en 4 retornos = 4 rombos, 1 ficha)
  const marcas = useMemo(() => H.flatMap((h, i) => h.lugares.map((l, j) => ({ h, i, j, l }))), [H]);
  const rombos = useRef<Array<THREE.Group | null>>([]);
  const anillos = useRef<Array<THREE.Mesh | null>>([]);

  // las cotas de cada hallazgo (de un cuerpo al otro) — líneas crudas, siempre encima
  const cotas = useMemo(() => {
    const f: number[] = [], a: number[] = [];
    for (const h of H) for (const l of h.lugares) (h.sev === 'falla' ? f : a).push(...l.cota[0], ...l.cota[1]);
    const mk = (arr: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); return g; };
    return { f: mk(f), a: mk(a) };
  }, [H]);

  // tamaños medidos de cada ficha (se miden una vez: su texto no cambia mientras dura el escaneo)
  const tam = useRef<Array<[number, number]>>([]);

  useFrame(() => {
    const g = ancla.current; if (!g) return;
    const t = (performance.now() - t0) / 1000;
    const u = Math.min(1, t / PULSO_S);
    // la onda avanza PAREJA (solo suaviza la salida): así cada error se enciende cuando la onda lo alcanza — que se
    // VEA que el escaneo lo encontró. Con ease-out barría todo el molde en 0.15 s y no revelaba nada (captura 2026-10-06).
    const rOnda = radio * 1.15 * (u < 0.1 ? (u / 0.1) * (u / 0.1) * 0.1 : u);
    if (pulsoMesh.current) {
      pulsoMesh.current.visible = u < 1;
      pulsoMesh.current.scale.setScalar(Math.max(1e-3, rOnda));
      pulso.uniforms.uT.value = u;
    }

    // los rombos se ENCIENDEN cuando la onda los alcanza, y luego pulsan
    const vivo: boolean[] = [];
    const qp = new THREE.Quaternion(); g.getWorldQuaternion(qp); qp.invert();
    marcas.forEach(({ h, i, l }, m) => {
      const d = Math.hypot(l.lugar[0] - centro[0], l.lugar[1] - centro[1], l.lugar[2] - centro[2]);
      const on = rOnda >= d || u >= 1;
      if (on) vivo[i] = true;
      const r = rombos.current[m];
      if (r) {
        r.visible = on;
        const late = 1 + 0.18 * Math.sin(t * (h.sev === 'falla' ? 6.0 : 3.5) + m);
        // con uno ELEGIDO, los demás se encogen: el ojo va a uno solo
        r.scale.setScalar((sel == null ? 1 : sel === i ? 1.5 : 0.45) * late);
        r.rotation.z = t * 0.9;
        // LO ÚNICO QUE TIEMBLA ES UNA FALLA (cyberpunk): un salto breve y determinista (puro en t: el reloj virtual lo filma igual)
        const salto = h.sev === 'falla' && ((t * 1.7 + m * 0.31) % 1) < 0.06;
        r.position.set(salto ? 0.9 * Math.sin(t * 91 + m) : 0, salto ? 0.6 * Math.cos(t * 73 + m) : 0, 0);
      }
      const a = anillos.current[m];
      if (a) {
        a.visible = on && (sel == null || sel === i);
        const fase = ((t * 0.9 + m * 0.37) % 1);
        a.scale.setScalar(1 + 2.4 * fase);
        (a.material as THREE.MeshBasicMaterial).opacity = 0.75 * (1 - fase);
        a.quaternion.copy(qp).multiply(camera.quaternion);              // de frente a la cámara, en el marco del molde
      }
    });

    // LAS FICHAS: proyectar, acomodar sin encimarse (fallas primero), y tirar la línea guía
    const W = size.width, Hh = size.height;
    const puestos: Array<[number, number, number, number]> = [];
    const svg = refs.guias.current;
    const lineas = svg ? (svg.querySelectorAll('line') as NodeListOf<SVGLineElement>) : null;
    H.forEach((h, i) => {
      const el = refs.fichas.current[i];
      const ln = lineas?.[i];
      if (!el) return;
      const L0 = h.lugares[0].lugar;
      v.set(L0[0], L0[1], L0[2]); g.localToWorld(v); v.project(camera);
      if (v.z > 1 || !vivo[i] || (sel != null && sel !== i)) { el.style.opacity = '0'; el.style.pointerEvents = 'none'; if (ln) ln.setAttribute('opacity', '0'); return; }
      const px = (v.x * 0.5 + 0.5) * W, py = (-v.y * 0.5 + 0.5) * Hh;
      let [w, hh] = tam.current[i] ?? [0, 0];
      if (!w) { w = el.offsetWidth; hh = el.offsetHeight; if (w) tam.current[i] = [w, hh]; }
      const sep = 34;
      const cand: Array<[number, number]> = [
        [px + sep, py - sep - hh], [px + sep, py + sep], [px - sep - w, py - sep - hh], [px - sep - w, py + sep],
        [px + sep * 2.2, py - hh / 2], [px - sep * 2.2 - w, py - hh / 2], [px - w / 2, py - sep * 2.4 - hh], [px - w / 2, py + sep * 2.4],
      ];
      let pos: [number, number] | null = null;
      for (const [x, y] of cand) {
        if (x < 362 || y < 64 || x + w > W - 8 || y + hh > Hh - 96) continue;          // la columna del HUD y la tira de abajo
        if (x + w > W - 430 && y < 260) continue;                                    // el cubo de vistas
        if (puestos.some(([a, b, c, d]) => x < c + 6 && x + w + 6 > a && y < d + 6 && y + hh + 6 > b)) continue;
        pos = [x, y]; break;
      }
      if (!pos) { el.style.opacity = sel === i ? '1' : '0'; if (ln) ln.setAttribute('opacity', '0'); if (sel !== i) return; pos = cand[0]; }
      puestos.push([pos[0], pos[1], pos[0] + w, pos[1] + hh]);
      el.style.opacity = '1'; el.style.pointerEvents = 'auto';
      el.style.transform = `translate(${pos[0]}px,${pos[1]}px)`;
      if (ln) {
        // la guía llega a la esquina de la ficha más cercana al punto
        const ex = pos[0] > px ? pos[0] : pos[0] + w, ey = pos[1] > py ? pos[1] : pos[1] + hh;
        ln.setAttribute('x1', String(px)); ln.setAttribute('y1', String(py));
        ln.setAttribute('x2', String(ex)); ln.setAttribute('y2', String(ey));
        ln.setAttribute('opacity', '0.9');
      }
    });
  });

  return (
    <group ref={ancla}>
      {/* el pulso */}
      <mesh ref={pulsoMesh} position={centro} renderOrder={990}>
        <sphereGeometry args={[1, 64, 32]} />
        <shaderMaterial args={[pulso]} transparent depthWrite={false} depthTest={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
      </mesh>
      {/* las cotas de los hallazgos */}
      <lineSegments geometry={cotas.f} renderOrder={1000}><lineBasicMaterial color={FOCO.falla} depthTest={false} transparent opacity={0.95} /></lineSegments>
      <lineSegments geometry={cotas.a} renderOrder={1000}><lineBasicMaterial color={FOCO.aviso} depthTest={false} transparent opacity={0.95} /></lineSegments>
      {/* los puntos débiles */}
      {marcas.map(({ h, j, l }, m) => (
        <group key={`${h.id}#${j}`} position={l.lugar}>
          <group ref={(o) => { rombos.current[m] = o; }} visible={false}>
            <lineSegments renderOrder={1001}>
              <edgesGeometry args={[new THREE.OctahedronGeometry(4.2, 0)]} />
              <lineBasicMaterial color={colorSev(h)} depthTest={false} transparent opacity={1} />
            </lineSegments>
            <mesh renderOrder={1001}>
              <octahedronGeometry args={[1.8, 0]} />
              <meshBasicMaterial color={colorSev(h)} depthTest={false} transparent opacity={0.95} />
            </mesh>
          </group>
          <mesh ref={(o) => { anillos.current[m] = o; }} visible={false} renderOrder={1001}>
            <ringGeometry args={[5.2, 5.9, 48]} />
            <meshBasicMaterial color={colorSev(h)} depthTest={false} transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/* ───────────────────── fuera del Canvas ───────────────────── */

/** LA REGLITA (la pidieron las tres investigaciones de color): dónde cae el número de hoy contra su límite. El 0 = se tocan;
 *  la marca blanca = el mínimo; el relleno va del 0 al número (hacia la izquierda si se meten uno en otro). */
function Reglita({ h }: { h: Hallazgo }) {
  const lo = Math.min(h.medido, 0) - 0.6, hi = Math.max(h.limite * 1.6, h.medido + 0.6, 1);
  const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  const c = colorSev(h);
  const a = Math.min(0, h.medido), b = Math.max(0, h.medido);
  return (
    <div style={{ position: 'relative', height: 10, marginTop: 6 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 4, height: 2, background: 'rgba(159,196,214,0.18)' }} />
      <div style={{ position: 'absolute', left: x(a), width: `calc(${x(b)} - ${x(a)})`, top: 3, height: 4, background: c, boxShadow: `0 0 8px ${c}88` }} />
      <div title="0 · se tocan" style={{ position: 'absolute', left: x(0), top: 0, width: 1, height: 10, background: PIEL.texto.tenue }} />
      {h.limite > 0 && <div title={`mínimo ${h.limite}`} style={{ position: 'absolute', left: x(h.limite), top: -1, width: 2, height: 12, background: PIEL.cumple }} />}
    </div>
  );
}

const corte = (px: number) => `polygon(${px}px 0, 100% 0, 100% calc(100% - ${px}px), calc(100% - ${px}px) 100%, 0 100%, 0 ${px}px)`;
const mono = `600 12px ${PIEL.fuente.mono}`;
const etiqueta: React.CSSProperties = { font: `600 10.5px ${PIEL.fuente.titulo}`, letterSpacing: '0.18em', textTransform: 'uppercase' };

export function FocoMoldeHUD({ foco, pieza, sel, onSel, onCerrar, refs }: {
  foco: ResultadoFoco;
  pieza: string;
  sel: number | null;
  onSel: (i: number | null) => void;
  onCerrar: () => void;
  refs: FocoRefs;
}) {
  const H = foco.hallazgos;
  const nF = H.filter((h) => h.sev === 'falla').length, nA = H.length - nF;
  const barrenos = foco.cilindros.length;
  return (
    <div data-testid="foco-molde" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8 }}>
      {/* en el Foco solo existe el molde: los paneles del CAD se apartan (los mismos que aparta el inspector) */}
      <style>{['feature-tree', 'op-panel', 'analysis-panel', 'face-list', 'sim-panel', 'curso-report', 'params-panel', 'escala-enfriamiento', 'ficha-en-el-mundo', 'mold-cotas-overlay']
        .map((t) => `[data-testid="${t}"]{opacity:0 !important;pointer-events:none !important;transition:opacity .3s}`).join('\n')}</style>
      {/* el viñeteado del Foco: el mundo se enfría, el centro queda limpio */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 52%, rgba(0,0,0,0) 55%, rgba(0,18,30,0.55) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, opacity: 0.07, backgroundImage: 'repeating-linear-gradient(0deg, #4fd8ff 0 1px, transparent 1px 4px)' }} />

      {/* las guías de cada ficha */}
      <svg ref={(e) => { refs.guias.current = e; }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
        {H.map((h) => <line key={h.id} stroke={colorSev(h)} strokeWidth={1.2} opacity={0} />)}
      </svg>

      {/* las fichas flotantes */}
      {H.map((h, i) => (
        <div key={h.id} ref={(e) => { refs.fichas.current[i] = e; }} data-testid={`foco-ficha-${i}`}
          onClick={() => onSel(sel === i ? null : i)}
          style={{
            position: 'absolute', left: 0, top: 0, opacity: 0, pointerEvents: 'auto', cursor: 'pointer',
            maxWidth: sel === i ? 340 : 250, padding: '6px 10px 7px', background: FOCO.fondo,
            borderLeft: `2px solid ${colorSev(h)}`, clipPath: corte(7), color: FOCO.tinta,
            boxShadow: `0 0 18px ${colorSev(h)}22`, transition: 'opacity 220ms',
          }}>
          {/* LOS APAGONES (2026-10-24, debate de 25 expertos): «punto débil» prometía un juicio del molde entero; la ficha
              solo sabe de su par de barrenos (o de la punta de un pin contra el núcleo). Se rotula como lo que es: una falla. */}
          <div style={{ ...etiqueta, color: colorSev(h) }}>{h.sev === 'falla' ? '◆ falla' : '◇ de panzazo'}</div>
          <div style={{ font: '600 13px/1.25 Barlow,system-ui,sans-serif', marginTop: 2 }}>{h.titulo}</div>
          <div style={{ font: mono, marginTop: 3, color: colorSev(h) }}>
            {h.tipo === 'agua-atraviesa' ? `se meten ${(-h.medido).toFixed(2)} mm` : h.tipo === 'piel-sobre-punta' ? `${h.medido.toFixed(2)} mm de acero` : `${h.medido.toFixed(2)} mm de acero`}
            <span style={{ color: FOCO.gris }}>{h.tipo === 'piel-sobre-punta' ? ' · debe ser 0' : ` · mín ${h.limite.toFixed(2)}`}</span>
          </div>
          <Reglita h={h} />
          {sel === i && <div style={{ font: '400 12px/1.45 Barlow,system-ui,sans-serif', marginTop: 6, color: '#bcd7e4' }}>{h.frase}</div>}
        </div>
      ))}

      {/* la cabecera del escaneo */}
      <div style={{ position: 'absolute', left: 18, top: 62, width: 330, padding: '12px 16px 13px', background: 'rgba(3,12,20,0.94)',
        clipPath: corte(10), borderTop: `1px solid ${FOCO.cianTenue}`, color: FOCO.tinta, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ ...etiqueta, color: FOCO.cian }}>◈ Foco · escaneo del molde</div>
          <button onClick={onCerrar} title="cerrar el Foco (Q)" style={{ ...etiqueta, background: 'none', border: `1px solid ${FOCO.cianTenue}`, color: FOCO.gris, padding: '2px 6px', cursor: 'pointer' }}>Q</button>
        </div>
        <div style={{ font: `700 19px ${PIEL.fuente.titulo}`, letterSpacing: '0.04em', marginTop: 6 }}>{pieza}</div>
        {/* «945 pares» contra «915» en el resumen (Kazmer, cuadro 58.5): dos conteos de la misma cosa. Kazmer §4: «al comprador le
            importa el peor par, no cuántos se midieron» — el conteo se quita; lo que se revisó se dice en palabras, y el peor par está
            en la lista de abajo (y en el punto «menos acero junto al agua» de la inspección). */}
        <div style={{ font: '400 12px/1.4 Barlow,system-ui,sans-serif', color: FOCO.gris, marginTop: 2 }}>
          {barrenos} barrenos identificados, cada uno medido eje a eje contra el agua
        </div>
        {/* EL ALCANCE (LOS APAGONES, 2026-10-24): el escaneo mide el AGUA contra cada barreno vecino (`foco-molde.ts`, el doble
            lazo agua × vecinos) y la punta de cada pin contra el núcleo — nada más. «0 puntos débiles en el molde» prometía el
            molde entero; lo que NO revisa se dice aquí, junto al número, no en una nota aparte. */}
        <div data-testid="foco-alcance" style={{ font: '400 11.5px/1.4 Barlow,system-ui,sans-serif', color: FOCO.gris, marginTop: 4 }}>
          revisé el agua contra cada barreno vecino y la punta de cada pin contra el núcleo · no revisé: agua contra agua, pines contra guías, acero contra plástico
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <div style={{ flex: 1, padding: '6px 8px', border: `1px solid ${nF ? FOCO.falla : FOCO.cianTenue}`, clipPath: corte(5) }}>
            <div style={{ font: '700 22px Barlow,system-ui,sans-serif', color: nF ? FOCO.falla : FOCO.cian, textShadow: nF ? `0 0 12px ${FOCO.falla}88` : 'none' }}>{nF}</div>
            <div style={{ ...etiqueta, color: FOCO.gris }}>{nF === 1 ? 'choque entre barrenos' : 'choques entre barrenos'}</div>
          </div>
          <div style={{ flex: 1, padding: '6px 8px', border: `1px solid ${nA ? FOCO.aviso : FOCO.cianTenue}`, clipPath: corte(5) }}>
            <div style={{ font: '700 22px Barlow,system-ui,sans-serif', color: nA ? FOCO.aviso : FOCO.cian }}>{nA}</div>
            <div style={{ ...etiqueta, color: FOCO.gris }}>de panzazo</div>
          </div>
        </div>
        {H.length === 0 && <div style={{ font: '500 13px Barlow,system-ui,sans-serif', color: FOCO.cian, marginTop: 10 }}>Nada que reportar en lo revisado: ninguna línea de agua se acerca a un barreno vecino bajo ½·⌀ y cada pin entra hasta su punta.</div>}
      </div>

      {/* la lista: cada hallazgo, un clic → la cámara vuela ahí */}
      {H.length > 0 && (
        // la cabecera creció dos renglones (el alcance): la lista baja 40 px para no quedar debajo
        <div style={{ position: 'absolute', left: 18, top: 288, width: 330, maxHeight: 'calc(100% - 370px)', overflowY: 'auto', pointerEvents: 'auto',
          display: 'flex', flexDirection: 'column', gap: 6 }}>
          {H.map((h, i) => (
            <button key={h.id} data-testid={`foco-hallazgo-${i}`} onClick={() => onSel(sel === i ? null : i)} style={{
              textAlign: 'left', padding: '7px 10px', background: sel === i ? 'rgba(10,32,48,0.96)' : 'rgba(3,12,20,0.92)', color: FOCO.tinta,
              border: 'none', borderLeft: `2px solid ${colorSev(h)}`, clipPath: corte(6), cursor: 'pointer',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ font: '600 12px/1.3 Barlow,system-ui,sans-serif' }}>{h.titulo}</span>
                <span style={{ font: mono, color: colorSev(h), whiteSpace: 'nowrap' }}>{h.tipo === 'agua-atraviesa' ? `−${(-h.medido).toFixed(2)}` : h.medido.toFixed(2)} mm</span>
              </div>
              <Reglita h={h} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═════════════════════ LA INSPECCIÓN · EL RECORRIDO (paso 7, 2026-10-22 · según Kazmer, 2026-10-29) ═════════════════════
 * ian: «el análisis del video del inspector no es algo aparte: es parte del pipeline». Cada punto se presenta con su vista
 * (aislar + corte + cámara, los pone el estudio), sus MARCAS en la escena (que aparecen una a una, como si el escáner las fuera
 * encontrando) y su tarjeta: el capítulo, la pregunta, el número de hoy, el límite, el veredicto, la frase física.
 * LA REGLA DE CÁMARA DE KAZMER (orden I): «primero 2 s de contexto con el molde completo y el punto marcado, después el macro»
 * — `CONTEXTO_S`: durante esos 2 s la escena marca el LUGAR (anillo que late + cruz) sobre el molde entero; las marcas del punto
 * nacen cuando arranca el macro. Lo exagerado lleva su «×N» en la tarjeta. */

/** los segundos de CONTEXTO con que arranca cada punto (Kazmer: «2 s de contexto con el molde completo y el punto marcado») */
export const CONTEXTO_S = 2;

const COLOR_MARCA: Record<MarcaRecorrido['color'], string> = { ok: PIEL.medido, falla: FOCO.falla, aviso: FOCO.aviso, neutro: '#8fa3b0', pin: PIEL.mundo.botadores };
const COLOR_VEREDICTO = { ok: PIEL.cumple, falla: FOCO.falla, aviso: FOCO.aviso } as const;
const TEXTO_VEREDICTO = { ok: '✓ CUMPLE', falla: '✗ NO CUMPLE', aviso: '◇ DE PANZAZO' } as const;

export function RecorridoEscena({ punto, t0, etiquetas, pieza, pinta, clip }: {
  punto: PuntoRecorrido; t0: number;
  /** los rótulos DOM de `punto.etiquetas` (los dibuja RecorridoHUD; aquí se proyectan cada cuadro) */
  etiquetas?: React.MutableRefObject<Array<HTMLDivElement | null>>;
  /** la pieza del molde y sus colores por vértice (la lente de ENFRIAMIENTO llevada al marco del molde) */
  pieza?: { positions: Float32Array; indices: Uint32Array; normals?: Float32Array } | null;
  pinta?: Float32Array | null;
  clip?: THREE.Plane[] | null;
}) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const ancla = useRef<THREE.Group>(null);
  const grupos = useRef<Array<THREE.Object3D | null>>([]);
  const ctxRing = useRef<THREE.Mesh>(null), ctxCruz = useRef<THREE.Group>(null);
  const pintada = useRef<THREE.Mesh>(null);
  const v = useRef(new THREE.Vector3()).current;
  const M = punto.marcas;
  // el círculo del tope: THREE.Line (en JSX `<line>` es la línea de SVG). Las POLILÍNEAS (la deformada ×N, la huella) van como
  // TUBO: una línea de WebGL mide 1 px a cualquier distancia y la deformada de la placa no se leía (captura 2026-10-29).
  const lineas = useMemo(() => M.map((m) => {
    if (m.tipo === 'circulo') {
      const pts: number[] = []; const r = m.r ?? 5;
      for (let k = 0; k <= 96; k++) { const a = (k / 96) * Math.PI * 2; pts.push(m.p[0] + r * Math.cos(a), m.p[1] + r * Math.sin(a), m.p[2]); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: COLOR_MARCA[m.color], depthTest: false, transparent: true, opacity: 0.95 }));
      l.renderOrder = 1002; l.visible = false; return l as THREE.Object3D;
    }
    if (m.tipo !== 'linea' || !m.pts || m.pts.length < 2) return null;
    const camino = new THREE.CurvePath<THREE.Vector3>();
    for (let k = 1; k < m.pts.length; k++) camino.add(new THREE.LineCurve3(new THREE.Vector3(...m.pts[k - 1]), new THREE.Vector3(...m.pts[k])));
    const g = new THREE.TubeGeometry(camino as unknown as THREE.Curve<THREE.Vector3>, Math.max(8, (m.pts.length - 1) * 2), m.color === 'neutro' ? 0.55 : 0.95, 6, false);
    const t = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: COLOR_MARCA[m.color], depthTest: false, transparent: true, opacity: 0.95, toneMapped: false }));
    t.renderOrder = 1002; t.visible = false; return t as THREE.Object3D;
  }), [M]);
  const geoCruz = useMemo(() => M.map((m) => {
    if (m.tipo !== 'cruz') return null; const s = 7;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([m.p[0] - s, m.p[1], m.p[2], m.p[0] + s, m.p[1], m.p[2], m.p[0], m.p[1] - s, m.p[2], m.p[0], m.p[1] + s, m.p[2]], 3));
    return g;
  }), [M]);
  // LA PIEZA PINTADA con el campo de la lente (solo en el macro): misma malla que el molde, colores por vértice, el corte la recorta
  // Los colores de la lente están en sRGB (se escriben «como se ven», foco-lentes.ts) y un atributo de color three lo toma LINEAL:
  // sin pasarlos a lineal la rampa salía lavada (el azul «listo pronto» se veía cian, captura 2026-10-29). Y el material va sin luz
  // (el color es el dato), así que la forma se HORNEA con N·L fijo — la misma receta de RayoPaint: sin ella el poste cortado no se leía.
  const geoPinta = useMemo(() => {
    if (!pieza || !pinta || pinta.length !== pieza.positions.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pieza.positions, 3));
    g.setIndex(new THREE.BufferAttribute(pieza.indices, 1));
    if (pieza.normals && pieza.normals.length === pieza.positions.length) g.setAttribute('normal', new THREE.BufferAttribute(pieza.normals, 3)); else g.computeVertexNormals();
    const N = g.getAttribute('normal') as THREE.BufferAttribute;
    const L = new THREE.Vector3(0.4, 0.45, 0.8).normalize();
    const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const col = new Float32Array(pinta.length);
    for (let v = 0; v < pinta.length / 3; v++) {
      const sh = 0.55 + 0.45 * Math.abs(N.getX(v) * L.x + N.getY(v) * L.y + N.getZ(v) * L.z);
      for (let k = 0; k < 3; k++) col[v * 3 + k] = lin(pinta[v * 3 + k]) * sh;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [pieza, pinta]);
  useEffect(() => () => { geoPinta?.dispose(); }, [geoPinta]);
  useFrame(() => {
    const t = (performance.now() - t0) / 1000;
    const tm = t - CONTEXTO_S;                               // el MACRO arranca a los 2 s
    // EL CONTEXTO: el lugar marcado sobre el molde entero, latiendo; se apaga al empezar el macro
    const enCtx = t < CONTEXTO_S + 0.25;
    const g = ancla.current;
    if (ctxRing.current) {
      ctxRing.current.visible = enCtx;
      const fase = (t * 1.3) % 1; ctxRing.current.scale.setScalar(1 + 1.6 * fase);
      (ctxRing.current.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - fase) * (enCtx ? 1 : 0);
      if (g) { const qp = new THREE.Quaternion(); g.getWorldQuaternion(qp); qp.invert(); ctxRing.current.quaternion.copy(qp).multiply(camera.quaternion); }
    }
    if (ctxCruz.current) { ctxCruz.current.visible = enCtx; ctxCruz.current.rotation.z = t * 0.8; }
    if (pintada.current) pintada.current.visible = tm >= 0;
    // las marcas aparecen una a una en 1.4 s desde que arranca el macro; el círculo y las líneas se DIBUJAN; la `ventana` las apaga
    M.forEach((m, i) => {
      const o = grupos.current[i]; if (!o) return;
      const ti = 0.3 + (i / Math.max(1, M.length)) * 1.4;
      const k = Math.max(0, Math.min(1, (tm - ti) / (m.tipo === 'linea' ? 0.9 : 0.25)));
      const dentro = !m.ventana || (tm >= m.ventana[0] && tm <= m.ventana[1]);
      o.visible = k > 0 && dentro;
      if (m.tipo === 'punto') o.scale.setScalar(k * (1 + 0.25 * Math.max(0, 1 - (tm - ti) / 0.5)));
      const l = lineas[i] as (THREE.Line | THREE.Mesh | null);
      if (l) { const gi = l.geometry; const n = gi.index ? gi.index.count : (gi.getAttribute('position') as THREE.BufferAttribute).count; gi.setDrawRange(0, Math.max(gi.index ? 3 : 2, Math.floor(n * k / (gi.index ? 3 : 1)) * (gi.index ? 3 : 1))); }
    });
    // LOS RÓTULOS 3D (pines con su fuerza): proyectar cada cuadro; nacen con el macro
    const E = punto.etiquetas ?? [];
    if (etiquetas && g) E.forEach((e, i) => {
      const el = etiquetas.current[i]; if (!el) return;
      v.set(e.p[0], e.p[1], e.p[2]); g.localToWorld(v); v.project(camera);
      const vivo = tm >= 0.6 + i * 0.12 && v.z < 1;
      el.style.opacity = vivo ? '1' : '0';
      const px = (v.x * 0.5 + 0.5) * size.width, py = (-v.y * 0.5 + 0.5) * size.height;
      // se abanican: los de la izquierda se van a la izquierda, los de la derecha a la derecha (no se enciman sobre la pieza)
      const izq = px - el.offsetWidth - 14, margen = Math.min(580, size.width * 0.38);
      const x = v.x < 0 && izq > margen ? izq : px + 14;   // a la izquierda solo si no cae bajo la tarjeta
      el.style.transform = `translate(${x}px, ${py - 9}px)`;
    });
  });
  const ctxR = 18;
  // el lugar del contexto en el color del veredicto, pero lo que CUMPLE va en cian (lo medido): en blanco no se leía sobre el acero
  const ctxColor = punto.veredicto === 'ok' ? PIEL.medido : COLOR_VEREDICTO[punto.veredicto];
  return (
    <group ref={ancla}>
      {/* EL CONTEXTO: el lugar del punto, sobre el molde entero */}
      <group position={punto.contexto}>
        <mesh ref={ctxRing} renderOrder={1003}>
          <ringGeometry args={[ctxR, ctxR + 3, 64]} />
          <meshBasicMaterial color={ctxColor} depthTest={false} transparent opacity={0.9} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
        <group ref={ctxCruz}>
          <lineSegments renderOrder={1003}>
            <edgesGeometry args={[new THREE.OctahedronGeometry(7, 0)]} />
            <lineBasicMaterial color={ctxColor} depthTest={false} transparent opacity={1} toneMapped={false} />
          </lineSegments>
          <mesh renderOrder={1003}>
            <octahedronGeometry args={[3, 0]} />
            <meshBasicMaterial color={ctxColor} depthTest={false} transparent opacity={0.95} toneMapped={false} />
          </mesh>
        </group>
      </group>
      {/* la pieza pintada (si el punto la pide) */}
      {geoPinta && (
        <mesh ref={pintada} geometry={geoPinta} renderOrder={6} visible={false}>
          <meshBasicMaterial vertexColors toneMapped={false} side={THREE.DoubleSide} clippingPlanes={clip ?? undefined} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
        </mesh>
      )}
      {M.map((m, i) => (
        m.tipo === 'punto' ? (
          <mesh key={i} ref={(o) => { grupos.current[i] = o; }} position={m.p} renderOrder={1002} visible={false}>
            <sphereGeometry args={[m.r ?? (m.color === 'pin' ? 2.2 : 1.7), 16, 12]} />
            <meshBasicMaterial color={COLOR_MARCA[m.color]} depthTest={false} transparent opacity={0.95} />
          </mesh>
        ) : m.tipo === 'cruz' ? (
          <lineSegments key={i} ref={(o) => { grupos.current[i] = o; }} geometry={geoCruz[i]!} renderOrder={1002} visible={false}>
            <lineBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.95} />
          </lineSegments>
        ) : (
          <primitive key={i} object={lineas[i]!} ref={(o: THREE.Object3D | null) => { grupos.current[i] = o; }} />
        )
      ))}
    </group>
  );
}

/** LA CIFRA EN MONO, LAS PALABRAS EN CUERPO (crítica 2026-10-23: «la mono escribe frases» — «50 de 50 puntos tocan» en mono ocupaba
 *  680 px y parecía terminal). Parte «3.49 mm de acero» en ['', '3.49 mm', 'de acero'] y «abre 152.5 mm» en ['abre', '152.5 mm', '']. */
export function partirCifra(s: string): [string, string, string] {
  const t = s.split(' '); const esNum = (x: string) => /^[−-]?[\d.,]+$/.test(x); const esUnidad = (x: string) => /^(mm|s|%|°C|mm²|mm³|MPa|kN|N|t)$/.test(x);
  const i = t.findIndex(esNum); if (i < 0) return [s, '', ''];
  let j = i + 1;
  for (;;) {
    if (j < t.length && (esNum(t[j]) || esUnidad(t[j]))) { j++; continue; }
    if (j + 1 < t.length && t[j] === 'de' && esNum(t[j + 1])) { j += 2; continue; }
    break;
  }
  return [t.slice(0, i).join(' '), t.slice(i, j).join(' '), t.slice(j).join(' ')];
}

/** LA BARRA de la tarjeta: el número de hoy contra su límite, en la misma escala (el tope es la marca blanca). */
function BarraRec({ b }: { b: BarraRecorrido }) {
  const c = b.veredicto === 'neutro' ? '#8fb4c6' : COLOR_VEREDICTO[b.veredicto];
  const hi = Math.max(b.valor, b.limite ?? 0) * 1.15 || 1;
  const pct = (x: number) => `${Math.max(0, Math.min(100, (x / hi) * 100))}%`;
  const dec = b.valor >= 100 ? 0 : b.valor >= 10 ? 1 : b.valor >= 1 ? 2 : 4;
  return (
    <div style={{ marginTop: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ font: `500 12.5px ${PIEL.fuente.cuerpo}`, color: '#a9c4d2' }}>{b.etiqueta}</span>
        <span style={{ whiteSpace: 'nowrap' }}>
          <span style={{ font: `700 14px ${PIEL.fuente.mono}`, color: c }}>{b.valor.toFixed(dec)} {b.unidad}</span>
          {b.nota && <span style={{ font: `500 11.5px ${PIEL.fuente.cuerpo}`, color: FOCO.gris }}> · {b.nota}</span>}
        </span>
      </div>
      <div style={{ position: 'relative', height: 6, marginTop: 3, background: 'rgba(159,196,214,0.14)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: pct(b.valor), background: c, boxShadow: `0 0 8px ${c}66` }} />
        {b.limite != null && <div title={`límite ${b.limite}`} style={{ position: 'absolute', left: pct(b.limite), top: -3, width: 2, height: 12, background: '#ffffff' }} />}
      </div>
    </div>
  );
}

export function RecorridoHUD({ puntos, idx, onIdx, auto, onAuto, onCerrar, etiquetas, fin }: {
  puntos: PuntoRecorrido[]; idx: number; onIdx: (i: number) => void; auto: boolean; onAuto: (v: boolean) => void; onCerrar: () => void;
  etiquetas?: React.MutableRefObject<Array<HTMLDivElement | null>>;
  /** el recorrido terminó (el último punto ya cumplió su tiempo): la filmadora lo lee */
  fin?: boolean;
}) {
  const p = puntos[idx]; if (!p) return null;
  const c = COLOR_VEREDICTO[p.veredicto];
  const total = puntos.reduce((s, q) => s + q.dur, 0);
  return (
    <div data-testid="inspeccion-recorrido" data-idx={idx} data-id={p.id} data-veredicto={p.veredicto} data-n={puntos.length} data-dur-total={total.toFixed(1)} data-fin={fin ? 1 : 0}
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9 }}>
      <style>{['feature-tree', 'op-panel', 'analysis-panel', 'face-list', 'sim-panel', 'curso-report', 'params-panel', 'escala-enfriamiento', 'ficha-en-el-mundo', 'mold-cotas-overlay']
        .map((t) => `[data-testid="${t}"]{opacity:0 !important;pointer-events:none !important}`).join('\n')}</style>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 48%, rgba(0,0,0,0) 58%, rgba(0,14,24,0.5) 100%)' }} />
      {/* los rótulos 3D del punto (los proyecta RecorridoEscena) */}
      {(p.etiquetas ?? []).map((e, i) => (
        <div key={`${p.id}-${i}`} ref={(el) => { if (etiquetas) etiquetas.current[i] = el; }} data-testid={`insp-etiqueta-${i}`}
          style={{ position: 'absolute', left: 0, top: 0, opacity: 0, whiteSpace: 'nowrap', font: `600 12px ${PIEL.fuente.mono}`, color: COLOR_MARCA[e.color],
            background: 'rgba(3,12,20,0.88)', borderLeft: `2px solid ${COLOR_MARCA[e.color]}`, padding: '2px 7px', transition: 'opacity 200ms' }}>{e.texto}</div>
      ))}
      {/* la tarjeta termina arriba del carril del subtítulo (y ≤ 1600 a 4K) y no pasa del 34 % del ancho: el corte es del 3D */}
      <div data-testid="insp-tarjeta" style={{ position: 'absolute', left: 22, bottom: 196, width: 'min(560px, 37vw)', maxHeight: 'calc(100% - 276px)', overflow: 'hidden', padding: '13px 20px 14px', background: 'rgba(3,12,20,0.93)',
        clipPath: corte(12), borderLeft: `3px solid ${c}`, color: FOCO.tinta, pointerEvents: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ ...etiqueta, color: FOCO.cian }}>◈ {p.capitulo} · punto {idx + 1} de {puntos.length}</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onIdx(Math.max(0, idx - 1))} style={{ ...etiqueta, background: 'none', border: `1px solid ${FOCO.cianTenue}`, color: FOCO.gris, padding: '2px 7px', cursor: 'pointer' }}>◀</button>
            <button onClick={() => onAuto(!auto)} style={{ ...etiqueta, background: 'none', border: `1px solid ${FOCO.cianTenue}`, color: auto ? FOCO.cian : FOCO.gris, padding: '2px 7px', cursor: 'pointer' }}>{auto ? '❚❚' : '▶'}</button>
            <button onClick={() => onIdx(Math.min(puntos.length - 1, idx + 1))} style={{ ...etiqueta, background: 'none', border: `1px solid ${FOCO.cianTenue}`, color: FOCO.gris, padding: '2px 7px', cursor: 'pointer' }}>▶▶</button>
            <button onClick={onCerrar} style={{ ...etiqueta, background: 'none', border: `1px solid ${FOCO.cianTenue}`, color: FOCO.gris, padding: '2px 7px', cursor: 'pointer' }}>✕</button>
          </div>
        </div>
        {/* LOS ROJOS DEL DICTAMEN que este punto enseña (Kazmer: «una revisión de diseño existe para ver los rojos») */}
        {(p.rojos?.length ?? 0) > 0 && (
          <div data-testid="insp-rojos" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
            {p.rojos!.map((r) => <span key={r} style={{ ...etiqueta, letterSpacing: '0.12em', color: FOCO.falla, border: `1px solid ${FOCO.falla}88`, padding: '1px 6px' }}>✗ {r}</span>)}
            <span style={{ font: `500 11.5px ${PIEL.fuente.cuerpo}`, color: FOCO.gris, alignSelf: 'center' }}>{p.id === 'dictamen' ? 'en el dictamen' : p.id === 'cierre' ? 'por decidir' : 'del dictamen, aquí'}</span>
          </div>
        )}
        <div style={{ font: `600 23px/1.2 ${PIEL.fuente.titulo}`, marginTop: 7 }}>{p.pregunta}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
          {(() => { const [a, n, z] = partirCifra(p.numero); return (
            <div data-testid="insp-numero" style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              {a && <span style={{ font: `500 17px ${PIEL.fuente.cuerpo}`, color: c }}>{a}</span>}
              <span style={{ font: `700 31px ${PIEL.fuente.mono}`, color: c, textShadow: `0 0 16px ${c}55` }}>{n || p.numero}</span>
              {z && <span style={{ font: `500 17px ${PIEL.fuente.cuerpo}`, color: c }}>{z}</span>}
            </div>); })()}
          <div style={{ font: `500 13px ${PIEL.fuente.cuerpo}`, color: FOCO.gris }}>{p.limite}</div>
          <div style={{ ...etiqueta, color: c, marginLeft: 'auto' }}>{p.textoVeredicto ?? TEXTO_VEREDICTO[p.veredicto]}</div>
        </div>
        {p.exagera && <div data-testid="insp-exagera" style={{ ...etiqueta, display: 'inline-block', marginTop: 6, color: '#04060A', background: FOCO.aviso, padding: '2px 8px' }}>{p.exagera} · exagerada</div>}
        {(p.barras?.length ?? 0) > 0 && <div data-testid="insp-barras" style={{ marginTop: 4 }}>{p.barras!.map((b, i) => <BarraRec key={i} b={b} />)}</div>}
        <div style={{ font: `400 14px/1.4 ${PIEL.fuente.cuerpo}`, marginTop: 8, color: '#c3dce8' }}>{p.frase}</div>
        {p.falta && <div data-testid="insp-falta" style={{ font: `500 12px/1.4 ${PIEL.fuente.cuerpo}`, marginTop: 7, color: PIEL.avisoTexto }}>◌ {p.falta}</div>}
        <div style={{ font: `400 11.5px/1.35 ${PIEL.fuente.cuerpo}`, marginTop: 6, color: '#7f9fb3' }}>{p.regla}</div>
        <div style={{ display: 'flex', gap: 4, marginTop: 11 }}>
          {puntos.map((q, i) => (
            <div key={q.id} title={q.pregunta} onClick={() => onIdx(i)} style={{ flex: q.dur, height: 4, cursor: 'pointer',
              background: i < idx ? COLOR_VEREDICTO[q.veredicto] : i === idx ? c : 'rgba(79,216,255,0.15)', opacity: i <= idx ? 1 : 0.8 }} />
          ))}
        </div>
      </div>
    </div>
  );
}
