/**
 * MoldScene — los componentes 3D del MOLDE dentro de la escena del Part Studio:
 * pintura de flujo/térmica sobre la pieza, driver de apertura+EXPULSIÓN (stripper
 * incluido), térmica transitoria, overlay FEA, aristas CAD y la NUBE DE ALARMA
 * de colisiones. Extraído del monolito ForgeBRepStudio (paso 2 de la review
 * 2026-07-24: a 10k líneas ningún detalle sobrevive). Regla del archivo:
 * NADA de estado de UI aquí — puros componentes de escena + sus helpers.
 */
import * as THREE from 'three';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { type MoldPart } from '../mold/mold-plano-set';
import { meshContact } from '../mold/collision';
import { type MoldAnalysis } from '../mold/mold-analysis';
import { surfaceFlowLength, paintFlowColors } from '../mold/flowlen-surface';
import { type MoldFeaOverlay } from '../mold/mold-fea';
import { type ThermalSim } from '../mold/mold-thermal-fdm';

function thermalRamp(t: number): [number, number, number] {
  const x = Math.max(0, Math.min(1, t));
  return x < 0.25 ? [0, x * 4 * 0.8, 1]
    : x < 0.5 ? [0, 0.8 + (x - 0.25) * 0.8, 1 - (x - 0.25) * 4]
    : x < 0.75 ? [(x - 0.5) * 4, 1, 0]
    : [1, 1 - (x - 0.75) * 3.4, 0];
}

// TÉRMICO TRANSITORIO VIVO: avanza la PDE (FDM 3D) y pinta (a) el plano de la
// partición y (b) los CUERPOS A/B por vértice — con rayos X se ve POR DENTRO.
/** ⏱ t_c LOCAL SOBRE LA PIEZA: cada vértice coloreado por lo que tarda SU pared
 *  (Eq 9.5) — azul enfría rápido, ROJO detiene el ciclo. Si hay consejo de baffle,
 *  se dibuja el BAFFLE FANTASMA (cian) desde la línea B hasta bajo la zona. */
export function MoldTcPaint({ part, map, cells, marker }: {
  part: MoldPart; map: TcMap;
  cells: Array<{ cx: number; cy: number }>;
  marker?: WaterAdvice['marker'];
}) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
    g.setIndex(new THREE.BufferAttribute(part.indices, 1));
    // cada vértice → su cavidad más cercana → coords LOCALES de la pieza → color
    const P = part.positions;
    const local = new Float32Array(P.length);
    for (let i = 0; i < P.length; i += 3) {
      let best = cells[0], bd = 1e18;
      for (const c of cells) {
        const d = Math.abs(P[i] - c.cx) + Math.abs(P[i + 1] - c.cy);
        if (d < bd) { bd = d; best = c; }
      }
      local[i] = P[i] - (best.cx - map.pw / 2);
      local[i + 1] = P[i + 1] - (best.cy - map.ph / 2);
      local[i + 2] = P[i + 2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(paintTcColors({ positions: local } as any, map), 3));
    return g;
  }, [part, map, cells]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <group>
      <mesh geometry={geo} renderOrder={4}>
        {/* SIN luz ni tonemapping: un mapa CAE es dato, no objeto iluminado —
            las luces + ACES pasteleaban el colormap a blanco */}
        <meshBasicMaterial vertexColors toneMapped={false} depthTest={false} transparent opacity={0.92} />
      </mesh>
      {marker && (
        <group position={[marker.x, marker.y, (marker.z0 + marker.z1) / 2]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[marker.diaMm / 2, marker.diaMm / 2, Math.max(4, marker.z1 - marker.z0), 20]} />
            <meshBasicMaterial color="#3ce0e0" transparent opacity={0.5} depthWrite={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[marker.diaMm / 2 + 1.2, marker.diaMm / 2 + 1.2, Math.max(4, marker.z1 - marker.z0), 20]} />
            <meshBasicMaterial color="#3ce0e0" wireframe transparent opacity={0.35} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/** 💧 EL LLENADO EN 3D SOBRE LA PIEZA — §5.5.5, la longitud de flujo MEDIDA del hueco.
 *
 *  "no debe de ser una fórmula de una figura: ¿cómo calcularás el relleno de una carcasa
 *   de laptop? ¿o una pistola de agua? SE TIENE QUE CALCULAR CON EL MOLDE A/B" (user).
 *  Por eso aquí NO hay ninguna fórmula de vaso: se mide L (la distancia que el fundido
 *  recorre POR la pieza desde la compuerta) con Dijkstra sobre la malla — el camino "dual
 *  domain" que usan los solvers comerciales para pared delgada, que es TODA pieza de
 *  inyección (§2.3.1). Un vaso, una carcasa o un juguete entran igual: solo cambia la malla.
 *
 *  El COLOR no decora: dice CUÁNDO llegó el fundido. Amarillo = entró primero (el gate);
 *  morado = lo último, donde llega más frío y a máxima presión; ROJO = nunca se llena
 *  (short shot §5.5). El frente avanza imperativo (mutando el atributo `color`): cero
 *  re-renders de React por cuadro, el patrón de `MoldOpenDriver`.
 */
/** REVELADO del fundido en la COLADA: el frente baja del bushing al gate antes
 *  de que la pieza empiece a pintarse — POR FIN se VE el canal y su flujo.
 *  Pintado POR VÉRTICES (como MoldFlowPaint, probado): clippingPlanes son de
 *  espacio MUNDO y el grupo del molde va transformado (CAD Z-arriba) — el
 *  plano recortaba en un eje ajeno y el cono jamás se veía. */
export function FeedFill({ part, delayS }: { part: MoldPart; delayS: number }) {
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
    g.setIndex(new THREE.BufferAttribute(part.indices, 1));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(part.positions.length), 3));
    return g;
  }, [part]);
  useEffect(() => () => geo.dispose(), [geo]);
  const zr = useMemo(() => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 2; i < part.positions.length; i += 3) { const z = part.positions[i]; if (z < lo) lo = z; if (z > hi) hi = z; }
    return { lo, hi };
  }, [part]);
  const t0 = useRef(0);
  useFrame(({ clock }) => {
    if (!t0.current) t0.current = clock.elapsedTime;
    const period = delayS + 1 / 0.35 + 0.7;                      // mismo reloj que MoldFlowPaint
    const tt = (clock.elapsedTime - t0.current) % period;
    const f = Math.min(1, tt / delayS);
    const attr = geo.getAttribute('color') as THREE.BufferAttribute;
    const col = attr.array as Float32Array;
    const P = part.positions;
    const T = part.flowT;
    if (T && part.flowTotalS) {
      // MODO RED (Figs 6.13-6.17): cada vértice enciende cuando el frente LE
      // LLEGA por su ruta — SE VE la carga repartiéndose en cada bifurcación.
      const simT = f * part.flowTotalS;
      const band = 0.05 * part.flowTotalS;                 // frente CONTINUO, no switch
      for (let i = 0, v = 0; i < P.length; i += 3, v++) {
        const k = Math.max(0, Math.min(1, (simT - T[v]) / band));
        col[i] = 0.16 + k * 0.84; col[i + 1] = 0.15 + k * 0.47; col[i + 2] = 0.13 + k * 0.01;
      }
    } else {
      const zFront = zr.hi - f * (zr.hi - zr.lo);                // el frente BAJA (sprue directo)
      for (let i = 0; i < P.length; i += 3) {
        if (P[i + 2] >= zFront) { col[i] = 1.0; col[i + 1] = 0.62; col[i + 2] = 0.14; }
        else { col[i] = 0.16; col[i + 1] = 0.15; col[i + 2] = 0.13; }
      }
    }
    attr.needsUpdate = true;
  });
  return (
    <mesh geometry={geo} renderOrder={9}>
      <meshBasicMaterial vertexColors toneMapped={false} depthTest={false} transparent opacity={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}

export function MoldFlowPaint({ part, gate, wallMm, speed = 0.35, delayS = 0 }: {
  part: MoldPart;
  gate: { x: number; y: number; z: number } | Array<{ x: number; y: number; z: number }>;
  /** pared nominal (mm) — empareja las caras opuestas de la pared (dual domain) */
  wallMm: number;
  /** fracción del recorrido por segundo (0.35 ⇒ ~3 s de punta a punta). La inyección REAL
   *  dura 0.35 s de un ciclo de 25 (1.4 %): a tiempo real son 21 cuadros y no se ve nada.
   *  Esto es cámara lenta HONESTA — el reloj de la izquierda dice los segundos de verdad. */
  speed?: number;
  /** espera (s) mientras la COLADA se llena antes de pintar la pieza */
  delayS?: number;
}) {
  // ⚠ LA MALLA MANDA — y la del kernel es GRUESA (aristas de 32.8 mm de media, hasta 135).
  // Dijkstra sobre aristas NO puede ir recto en una malla así: ZIGZAGUEA. Medido contra el
  // vóxel (que atraviesa el hueco y da 137.95 ≈ radio 70 + alto 65): la superficie daba
  // 254.9 mm, **85 % de más**. Lo cazó el cruce de los dos caminos; sin él "se veía bien".
  // Por eso `surfaceFlowLength` recibe `wallMm`: empareja las caras opuestas de la pared
  // (dual domain) y baja el error de 126 % a 85 %. Sigue sin ser bueno: el pintado sirve
  // para VER POR DÓNDE va el frente (el orden de llegada es correcto), pero la L en mm
  // NO es de fiar hasta que la malla se afine o esto lea del vóxel. El panel lo DICE.
  const sf = useMemo(
    () => surfaceFlowLength(
      { positions: part.positions, indices: part.indices, normals: part.normals },
      gate, wallMm),
    [part, gate, wallMm],
  );
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(part.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(part.normals, 3));
    g.setIndex(new THREE.BufferAttribute(part.indices, 1));
    g.setAttribute('color', new THREE.BufferAttribute(paintFlowColors(sf, 0), 3));
    return g;
  }, [part, sf]);
  useEffect(() => () => geo.dispose(), [geo]);
  const t0 = useRef(0);
  useFrame(({ clock }) => {
    if (!t0.current) t0.current = clock.elapsedTime;
    const period = delayS + 1.25 / speed + (delayS ? 0.7 - 0.25 / speed : 0);
    const tt = (clock.elapsedTime - t0.current) % period;
    const u = Math.max(0, (tt - delayS) * speed) % 1.25;             // 0..1 y una pausa llena (espera la colada)
    const front = Math.min(1, u) * sf.maxFlowLenMm;
    const attr = geo.getAttribute('color') as THREE.BufferAttribute;
    const col = paintFlowColors(sf, front);
    (attr.array as Float32Array).set(col);
    attr.needsUpdate = true;
    (window as unknown as { __flowFront?: { frontMm: number; maxMm: number } }).__flowFront =
      { frontMm: +front.toFixed(1), maxMm: sf.maxFlowLenMm };
  });
  return (
    <group>
      <mesh geometry={geo} renderOrder={8}>
        {/* SIN luz ni tonemapping: un mapa de flujo es DATO, no objeto iluminado — las
            luces + ACES pastelean el colormap (la misma lección que el mapa de t_c) */}
        <meshBasicMaterial vertexColors toneMapped={false} depthTest={false} transparent opacity={0.92} />
      </mesh>
      {/* la(s) COMPUERTA(s): por donde entra el fundido */}
      {(Array.isArray(gate) ? gate : [gate]).map((g, gi) => (
      <mesh key={gi} position={[g.x, g.y, g.z]}>
        <sphereGeometry args={[2.2, 16, 12]} />
        <meshBasicMaterial color="#57e6a8" toneMapped={false} />
      </mesh>))}
    </group>
  );
}

/** APERTURA ANIMADA del molde: el lado A (clamp/A/inserto-cav/agua-a/colada/anillo/
 *  bujes/platina fija) SUBE y cada corredera se RETRAE con la cinemática REAL del
 *  perno inclinado: u = min(S, apertura·tanφ) — la S se alcanza exactamente en la
 *  apertura requerida L·cosφ del estudio (Eq 11.26). Imperativo (refs), 0 re-renders.
 *  `window.__moldOpen(t)` fija t∈[0..1] determinista para capturas; null lo suelta.
 *
 *  La CARRERA viene del estudio (§6.3.2: 2.5 × altura de pieza), no de un número
 *  fijo: había un `OPEN = 80` inventado que para el tupper (60 mm de fondo → 150 mm
 *  de carrera) animaba el 53 % del recorrido — el molde de la pantalla no era el
 *  molde del estudio. El mismo dato faltaba en el selector de máquina, que juzgaba
 *  el daylight con el molde CERRADO y aprobaba máquinas incapaces de abrirlo. */
// 'tornillos-cav' = los que sujetan la sujeción superior a la placa A: están ATORNILLADOS
// a ella, así que suben CON ella. Los 'tornillos-core' se quedan con B. Cuando era UN solo
// componente ('tornillos') con las dos mitades, ninguno se movía y los de cavidad quedaban
// flotando en el hueco, como si amarraran A con B — lo que el user cazó a ojo.
const MOLD_A_SIDE = new Set(['clamp', 'A', 'inserto-cav', 'agua-a', 'colada', 'anillo', 'bujes', 'platina-fija', 'tornillos-cav']);
export function MoldOpenDriver({ refs, ctl, parts, openMm, ejectMm, stripperRing }: {
  refs: React.MutableRefObject<Record<string, THREE.Group | null>>;
  ctl: React.MutableRefObject<{ on: boolean; manual: number | null; manualE: number | null; t0: number }>;
  parts: MoldPart[];
  /** carrera REAL de la partición (§6.3.2 = 2.5 × altura de pieza), NO un número fijo */
  openMm: number;
  /** carrera de EXPULSIÓN (≥ profundidad de pieza, cap 11: para LIBRAR el núcleo) */
  ejectMm: number;
  /** molde STRIPPER (§11.3.4): la placa B es el ANILLO flotante — las barras lo
   *  empujan y su labio desnuda el vaso del macho (Fig 11.21). Sin esta bandera el
   *  rol 'B' caía al else (posición 0) y la expulsión era invisible: "no entiendo
   *  cómo se expulsa" (user 2026-07-24). */
  stripperRing?: boolean;
}) {
  useEffect(() => {
    // __moldOpen(t, e?): t = fracción de APERTURA, e = fracción de EXPULSIÓN —
    // determinista para capturas (sin e no había forma de fotografiar el viaje
    // del anillo/pines). null suelta el control manual.
    (window as any).__moldOpen = (t: number | null, e?: number | null) => { ctl.current.manual = t; ctl.current.manualE = e ?? null; };
    return () => { delete (window as any).__moldOpen; };
  }, [ctl]);
  useFrame(() => {
    const c = ctl.current;
    const OPEN = openMm;                                         // mm de carrera del lado A (del estudio, §6.3.2)
    let frac = 0, eFrac = 0;
    if (c.manual != null) { frac = Math.max(0, Math.min(1, c.manual)); eFrac = c.manualE != null ? Math.max(0, Math.min(1, c.manualE)) : 0; }
    else if (c.on) {
      // EL CICLO CON EXPULSIÓN — "los eyectores no eyectan cuando doy play" (user
      // 2026-07-16): el ▶ solo ABRÍA. Un ciclo real expulsa: abre → los pines EMPUJAN
      // la pieza (carrera ≥ profundidad, para LIBRAR el núcleo, cap 11) → retraen → cierra.
      const t = (performance.now() - c.t0) / 1000;
      const cyc = (t % 8) / 8;                                   // 8 s: abre·EYECTA·retrae·cierra
      frac = cyc < 0.3 ? cyc / 0.3 : cyc < 0.72 ? 1 : 1 - (cyc - 0.72) / 0.28;
      eFrac = cyc < 0.34 ? 0 : cyc < 0.48 ? (cyc - 0.34) / 0.14 : cyc < 0.58 ? 1
        : cyc < 0.7 ? 1 - (cyc - 0.58) / 0.12 : 0;
      frac = frac * frac * (3 - 2 * frac);                       // suavizado
      eFrac = eFrac * eFrac * (3 - 2 * eFrac);
    }
    const O = OPEN * frac, E = ejectMm * eFrac;
    for (const pt of parts) {
      const g = refs.current[pt.role];
      if (!g) continue;
      if (MOLD_A_SIDE.has(pt.role) || pt.role.endsWith('-fijo')) {
        g.position.set(0, 0, O);                                 // perno/inserto/talón van con A
      } else if (pt.role === 'pines' || pt.role === 'ejector' || pt.role === 'ejector-ret' || pt.role === 'pieza'
        || pt.role === 'pines-retorno' || (stripperRing && pt.role === 'B')) {
        // 'pines-retorno' viaja SIEMPRE: van atornillados a la placa expulsora
        // (en el stripper son LAS BARRAS que empujan el anillo — quietas, el
        // anillo subía "empujado por nada", cazado a ojo en key-eject-mid).
        // el PAQUETE EXPULSOR (placa + retenedora + pines) y LA PIEZA suben juntos:
        // los pines están atornillados a la retenedora y la pieza viaja empujada.
        // En el STRIPPER también viaja el ANILLO (placa B flotante): las barras lo
        // empujan y el labio de su barreno pela el vaso del macho por TODO el borde.
        g.position.set(0, 0, E);
      } else if (pt.kin) {
        const u = Math.min(pt.kin.strokeMm, O * Math.tan(pt.kin.angleDeg * Math.PI / 180));
        g.position.set(pt.kin.dir[0] * u, pt.kin.dir[1] * u, 0);
      } else if (g.position.lengthSq() > 0) {
        g.position.set(0, 0, 0);
      }
    }
  });
  return null;
}

export function MoldTransientThermal({ sim, z, parts, xray, sliceAxis = 'z', sliceFrac = 0.5 }: {
  sim: ThermalSim; z: number; parts: MoldPart[]; xray: boolean;
  sliceAxis?: 'x' | 'y' | 'z'; sliceFrac?: number;
}) {
  const [tick, setTick] = useState(0);
  // CONTINUO, no a brincos. Antes: `setInterval(() => sim.step(2.5), 260)` — 2.5 s de
  // física cada 260 ms de reloj = ~10 cuadros por MINUTO simulado: el campo saltaba de
  // golpe y se veía por escalones ("no es continuo, se ve que va por pasos, eso es de
  // kinder" — user 2026-07-15). El problema no era la PDE (adentro ya sub-divide a `dtMax`
  // estable): era el MUESTREO de la pantalla, groserísimo.
  // Ahora se avanza el tiempo simulado que de verdad transcurrió × la velocidad, cada
  // FRAME (requestAnimationFrame ≈ 60 Hz) ⇒ 24× más muestras y el color fluye.
  useEffect(() => {
    let raf = 0, last = performance.now(), pendiente = 0;
    const SPEED = 10;                                        // 10× tiempo real
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      // ACUMULAR y disparar a ~9 Hz: el costo de un paso espectral es FIJO (no depende
      // del dt — esa es su gracia), así que pagarlo cada frame era tirar 60 pasos/s
      // donde 9 rinden lo mismo. Y cada setTick reconstruye rebanadas e isosuperficies:
      // eso también iba a 60 Hz. "se traba, va lento" (user) — era esto.
      pendiente += dt * SPEED;
      if (pendiente >= 1.0) {
        sim.step(pendiente);
        pendiente = 0;
        setTick((t) => t + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [sim]);
  const lo = sim.coolantC, hi = sim.coolantC + 30;        // rango fijo → colores estables
  const bodies = useMemo(() => parts.filter((p) => !p.role.startsWith('platina')).map((p) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(p.positions, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(p.normals, 3));
    g.setIndex(new THREE.BufferAttribute(p.indices, 1));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(p.positions.length), 3));
    return { role: p.role, g };
  }), [parts]);
  useEffect(() => () => bodies.forEach((b) => b.g.dispose()), [bodies]);
  useEffect(() => {   // repintar vértices con la T del grid (cada tick)
    for (const b of bodies) {
      const pos = b.g.getAttribute('position') as THREE.BufferAttribute;
      const col = b.g.getAttribute('color') as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const T = sim.sampleAt(pos.getX(i), pos.getY(i), pos.getZ(i));
        const [r, gg, bb] = thermalRamp((T - lo) / (hi - lo));
        col.setXYZ(i, r, gg, bb);
      }
      col.needsUpdate = true;
    }
  }, [tick, bodies, sim, lo, hi]);
  // CASCARONES 3D (isosuperficies, cada 4 ticks): la burbuja de calor que crece con
  // los ciclos y que las líneas de agua muerden — el térmico EN 3D, no una capa
  const shells = useMemo(() => {
    if (tick % 4 !== 0 && tick > 0) return null;
    const span = sim.maxC - sim.coolantC;
    if (span < 6) return [];   // aún no hay burbuja que valga (evita cascarón-ruido)
    // blending NORMAL y opacidad baja: aditivo satura a BLANCO (más luz ≠ más color).
    // PISO de +4 °C en el nivel bajo: sin piso, la iso ~ambiente envolvía las camisas
    // FRÍAS del agua y parecían "tubos fantasma" (feedback user: "¿tubos de inyección
    // en el eje equivocado?") — los cascarones solo abrazan el CALOR.
    const levels: Array<[number, string, number]> = [
      [Math.max(sim.coolantC + 4, sim.coolantC + 0.35 * span), '#ffd24a', 0.16],
      [sim.coolantC + 0.60 * span, '#ff8c2e', 0.26],
      [sim.coolantC + 0.85 * span, '#ff3b2e', 0.40],
    ];
    return levels.map(([lv, color, op]) => {
      const m = isoSurface(sim.T, sim.nx, sim.ny, sim.nz, lv, sim.dx, sim.x0, sim.y0, sim.z0);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
      return { g, color, op, lv };
    });
  }, [tick, sim]);   // eslint-disable-line react-hooks/exhaustive-deps
  const lastShells = useRef<typeof shells>(null);
  if (shells) { lastShells.current?.forEach((s) => s.g.dispose()); lastShells.current = shells; }
  const drawShells = lastShells.current ?? [];
  const sliceF = useMemo(() => sim.sliceAxis(sliceAxis, sliceFrac), [sim, sliceAxis, sliceFrac, tick]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <group>
      {bodies.map((b) => (
        <mesh key={b.role} geometry={b.g} renderOrder={3}>
          <meshStandardMaterial vertexColors transparent opacity={xray ? 0.35 : 0.55} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {drawShells.map((s, i) => (
        <mesh key={i} geometry={s.g} renderOrder={5}>
          <meshBasicMaterial color={s.color} transparent opacity={s.op} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <MoldThermalSliceAxis sim={sim} axis={sliceAxis} field={sliceF} />
    </group>
  );
}

/** REBANADA térmica en CUALQUIER eje: plano texturizado con el campo, colocado en
 *  la cota real del corte — recorres el molde por dentro (X/Y/Z + slider). */
function MoldThermalSliceAxis({ sim, axis, field }: {
  sim: ThermalSim; axis: 'x' | 'y' | 'z';
  field: ReturnType<ThermalSim['sliceAxis']>;
}) {
  const { tex, geo } = useMemo(() => {
    const { nu, nv, u1, v1, posMm, T, minC, maxC } = field;
    const data = new Uint8Array(nu * nv * 4);
    const span = Math.max(0.1, maxC - minC);
    for (let n = 0; n < nu * nv; n++) {
      const t = (T[n] - minC) / span;
      const c = t < 0.25 ? [0, t * 4 * 0.8, 1]
        : t < 0.5 ? [0, 0.8 + (t - 0.25) * 0.8, 1 - (t - 0.25) * 4]
        : t < 0.75 ? [(t - 0.5) * 4, 1, 0]
        : [1, 1 - (t - 0.75) * 3.4, 0];
      data[n * 4] = c[0] * 255; data[n * 4 + 1] = c[1] * 255; data[n * 4 + 2] = c[2] * 255; data[n * 4 + 3] = 235;
    }
    const tx = new THREE.DataTexture(data, nu, nv, THREE.RGBAFormat);
    tx.needsUpdate = true;
    tx.magFilter = THREE.LinearFilter; tx.minFilter = THREE.LinearFilter;
    // plano a MANO en coords de mundo (cero líos de rotación): u/v según el eje
    const g = new THREE.BufferGeometry();
    let corners: number[];
    if (axis === 'z') corners = [0, 0, posMm, u1, 0, posMm, u1, v1, posMm, 0, v1, posMm];
    else if (axis === 'x') corners = [posMm, 0, 0, posMm, u1, 0, posMm, u1, v1, posMm, 0, v1];
    else corners = [0, posMm, 0, u1, posMm, 0, u1, posMm, v1, 0, posMm, v1];
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(corners), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    return { tex: tx, geo: g };
  }, [field, axis]);
  useEffect(() => () => { tex.dispose(); geo.dispose(); }, [tex, geo]);
  return (
    <mesh geometry={geo} renderOrder={6}>
      <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  );
}

// FEA MECÁNICO: superficie del paquete B+soporte+rieles coloreada por von Mises.
export function MoldFeaMesh({ ov }: { ov: MoldFeaOverlay }) {
  const g = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(ov.positions, 3));
    if (ov.normals.length) geo.setAttribute('normal', new THREE.BufferAttribute(ov.normals, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(ov.colors, 3));
    geo.setIndex(new THREE.BufferAttribute(ov.indices, 1));
    if (!ov.normals.length) geo.computeVertexNormals();   // frontera de tets: normales suaves
    return geo;
  }, [ov]);
  useEffect(() => () => g.dispose(), [g]);
  return (
    <mesh geometry={g} renderOrder={1}>
      <meshStandardMaterial vertexColors metalness={0.1} roughness={0.55} side={THREE.DoubleSide} />
    </mesh>
  );
}

// CAMPO DE TEMPERATURA en la superficie de cavidad (Kazmer Fig 9.7): plano en la
// línea de partición coloreado por vértice (azul=frío sobre línea de agua, rojo=
// caliente entre líneas). El campo viene de mold-analysis (resistencias Eq 9.7+9.20).
function MoldThermalPlane({ field, z }: { field: MoldAnalysis['thermal']['field']; z: number }) {
  const geo = useMemo(() => {
    const { nx, ny, x0, y0, x1, y1, T, minC, maxC } = field;
    const g = new THREE.PlaneGeometry(x1 - x0, y1 - y0, nx - 1, ny - 1);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, 0);
    const colors = new Float32Array((nx * ny) * 3);
    const span = Math.max(0.1, maxC - minC);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      // PlaneGeometry ordena vértices de arriba a abajo → fila espejo
      const vi = ((ny - 1 - j) * nx + i) * 3;
      const t = (T[j * nx + i] - minC) / span;
      // rampa térmica azul→cian→verde→amarillo→rojo
      const c = t < 0.25 ? [0, t * 4 * 0.8, 1]
        : t < 0.5 ? [0, 0.8 + (t - 0.25) * 0.8, 1 - (t - 0.25) * 4]
        : t < 0.75 ? [(t - 0.5) * 4, 1, 0]
        : [1, 1 - (t - 0.75) * 3.4, 0];
      colors[vi] = c[0]; colors[vi + 1] = c[1]; colors[vi + 2] = c[2];
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return g;
  }, [field]);
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh geometry={geo} position={[0, 0, z]} renderOrder={4}>
      <meshBasicMaterial vertexColors transparent opacity={0.92} depthWrite={false} side={THREE.DoubleSide} />
    </mesh>
  );
}

// ARISTAS del molde como líneas nítidas (look CAD, mismas que el doc principal):
// definen los bordes y matan el aliasing de paredes delgadas vistas de canto.
export function MoldEdges({ pts, clip }: { pts: Float32Array; clip?: THREE.Plane[] | null }) {
  const g = useMemo(() => {
    const b = new THREE.BufferGeometry();
    b.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    return b;
  }, [pts]);
  useEffect(() => () => g.dispose(), [g]);
  return (
    <lineSegments geometry={g} renderOrder={2}>
      <lineBasicMaterial color="#26313f" transparent opacity={0.85} clippingPlanes={clip ?? undefined} />
    </lineSegments>
  );
}

// 🚨 NUBE DE ALARMA: bolitas ROJAS en cada punto donde dos sólidos comparten acero.
// depthTest=false + renderOrder alto → se ven ATRAVESANDO las placas translúcidas (el
// punto es que la colisión SALTE desde cualquier ángulo, no que se esconda dentro).
export function AlarmCloud({ pts }: { pts: Float32Array }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const n = pts.length / 3;
  useEffect(() => {
    const m = ref.current; if (!m) return;
    const d = new THREE.Object3D();
    for (let i = 0; i < n; i++) { d.position.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
    m.instanceMatrix.needsUpdate = true;
  }, [pts, n]);
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, Math.max(1, n)]} renderOrder={999} frustumCulled={false}>
      <sphereGeometry args={[2.2, 8, 8]} />
      <meshBasicMaterial color="#ff1030" toneMapped={false} depthTest={false} transparent opacity={0.9} />
    </instancedMesh>
  );
}

// Núcleo del MODO ALARMA (compartido por el botón de la UI y la API de auto-revisión):
// corre el estudio de contacto por VOLUMEN sobre la figura real y junta la nube de puntos
// donde dos sólidos comparten acero. La 'pieza' y las platinas quedan fuera (contacto/contexto).
export function computeMoldAlarm(parts: MoldPart[], fitMm = 0.6, volFitMm3 = 15): { cloud: Float32Array; collisions: Array<{ a: string; b: string; volMm3: number; penMm: number }> } {
  const IGNORE = new Set(['pieza', 'platina-fija', 'platina-movil']);
  const bbox = (P: Float32Array) => { const mn: [number, number, number] = [1e18, 1e18, 1e18], mx: [number, number, number] = [-1e18, -1e18, -1e18]; for (let i = 0; i < P.length; i += 3) for (let k = 0; k < 3; k++) { if (P[i + k] < mn[k]) mn[k] = P[i + k]; if (P[i + k] > mx[k]) mx[k] = P[i + k]; } return { mn, mx }; };
  const ov = (a: any, b: any) => { for (let k = 0; k < 3; k++) if (Math.min(a.mx[k], b.mx[k]) - Math.max(a.mn[k], b.mn[k]) <= 0.4) return false; return true; };
  const P = parts.filter((pt) => !IGNORE.has(pt.role)).map((pt) => ({ role: pt.role, positions: pt.positions, indices: pt.indices, bb: bbox(pt.positions) }));
  const cloud: number[] = [], collisions: Array<{ a: string; b: string; volMm3: number; penMm: number }> = [];
  for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
    if (!ov(P[i].bb, P[j].bb)) continue;
    const c = meshContact({ positions: P[i].positions, indices: P[i].indices }, { positions: P[j].positions, indices: P[j].indices }, { collect: true });
    if (c.volMm3 > volFitMm3 || c.penMm > fitMm) { collisions.push({ a: P[i].role, b: P[j].role, volMm3: c.volMm3, penMm: c.penMm }); if (c.cloud) for (const v of c.cloud) cloud.push(v); }
  }
  collisions.sort((x, y) => y.volMm3 - x.volMm3);
  return { cloud: new Float32Array(cloud), collisions };
}
