/**
 * GATE DE LA CELDA CORTADA — recuperar el ORDEN en frontera NO alineada al vóxel.
 * ============================================================================
 * EL PROBLEMA (medido por el arnés de MMS, 2026-08-05): cuando el dato de frontera
 * viene de la SUPERFICIE REAL de la pieza y se aplica en la cara del vóxel, el
 * esquema pierde su orden. El dato queda desplazado hasta h/2 del sitio correcto y,
 * peor, el patrón de escalones CAMBIA con cada malla: el error deja de bajar
 * monótono. Sobre la carcasa Hammond 1554B daba p = 0.66 con R² = 0.51.
 *
 * EL ARREGLO (Shortley-Weller / celda cortada): en vez de suponer que la superficie
 * está a h/2, se usa la DISTANCIA VERDADERA d del centro de celda a la superficie a
 * lo largo de la normal de la cara, y el dato se evalúa AHÍ. La conductancia de
 * frontera pasa de A·k/(h/2) a A·k/d.
 *
 * EL EXPERIMENTO: una ESFERA — la peor frontera posible para una rejilla cartesiana,
 * porque ninguna cara se alinea y θ = d/h se reparte por todo (0,1]. Se resuelve el
 * MISMO problema manufacturado de las dos formas y se mide el orden observado:
 *
 *    ESCALONADO  (d = h/2 siempre)   → debe DEGRADARSE
 *    CELDA CORTADA (d = distancia real) → debe RECUPERAR el orden
 *
 * Si la celda cortada no gana, el arreglo no sirve y hay que decirlo.
 *
 * Uso: node --import tsx scripts/verif-celda-cortada-test.cjs
 */
const path = require('path');
const fs = require('fs');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'verificacion', p);
  const M = await import(R('mms.ts'));

  // ── la solución manufacturada: suave, sin simetría con la rejilla ──────────
  const ms = M.msTrigExp({ a: 2.1, b: 1.7, c: 1.3, k0: 32, amp: 40, t0: 60 });

  /** Dominio ESFÉRICO de radio Rm centrado en el centro de la caja, con el centro
   *  DESPLAZADO una fracción irracional de h para que ninguna malla lo "acierte". */
  function correr(n, L, Rm, cortada) {
    const malla = M.mallaCubo(n, L, 0, 0, 0);
    const h = malla.h;
    const N = n * n * n;
    const C = [L / 2 + h * 0.137, L / 2 - h * 0.081, L / 2 + h * 0.219];  // centro fuera de rejilla
    const dist = (x, y, z) => Math.hypot(x - C[0], y - C[1], z - C[2]) - Rm;  // <0 adentro
    const activa = new Uint8Array(N);
    const kA = new Float64Array(N).fill(32);
    const sA = new Float64Array(N);
    let nAct = 0;
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const idx = (k * n + j) * n + i;
      const [x, y, z] = M.centroCelda(malla, i, j, k);
      if (dist(x, y, z) < 0) { activa[idx] = 1; nAct++; }
      sA[idx] = ms.fuente(x, y, z);
    }
    const sol = M.resolverFV({
      malla, activa, k: kA, s: sA,
      frontera: (c) => {
        // el punto donde la normal de la cara corta la ESFERA, por bisección sobre
        // la función distancia. Es el dato que el escalonado ignora.
        const cx = malla.x0 + (c.i + 0.5) * h, cy = malla.y0 + (c.j + 0.5) * h, cz = malla.z0 + (c.k + 0.5) * h;
        let lo = 0, hi = h * 1.5;
        for (let it = 0; it < 60; it++) {
          const mid = (lo + hi) / 2;
          const p = [cx + c.n[0] * mid, cy + c.n[1] * mid, cz + c.n[2] * mid];
          if (dist(p[0], p[1], p[2]) < 0) lo = mid; else hi = mid;
        }
        const d = (lo + hi) / 2;
        const px = cx + c.n[0] * d, py = cy + c.n[1] * d, pz = cz + c.n[2] * d;
        // EL DATO SIEMPRE SALE DE LA SUPERFICIE REAL — es lo único que uno conoce de
        // la pieza del cliente. Lo que cambia es DÓNDE se cree que está:
        //   ESCALONADO: se impone en la cara del vóxel suponiendo h/2 → la CF queda
        //               desplazada hasta media celda, y el desplazamiento CAMBIA con
        //               la malla. Ése es el error que mata el orden.
        //   CORTADA:    se declara la distancia verdadera d.
        // (Evaluar T* EN la cara no reproduce el problema: T* resuelve la EDP en todo
        //  el espacio, así que sobre el dominio escalonado sigue siendo exacta. Mi
        //  primera versión de este test hacía eso y daba orden 2 en los dos casos.)
        return cortada
          ? { tipo: 'dirichlet', T: ms.T(px, py, pz), dReal: d }
          : { tipo: 'dirichlet', T: ms.T(px, py, pz) };
      },
    }, { tolRel: 1e-13, maxIters: 40000 });
    const e = M.normasError(malla, activa, sol.T, ms.T);
    return { h, l2: e.l2, linf: e.linf, celdas: nAct, iters: sol.iters };
  }

  const L = 1.0, Rm = 0.40;
  const NS = [24, 32, 44, 60];
  const series = { escalonado: [], cortada: [] };
  console.log('\n══ ESFERA fuera de rejilla · el mismo MMS resuelto de dos formas ══');
  for (const modo of ['escalonado', 'cortada']) {
    for (const n of NS) {
      const r = correr(n, L, Rm, modo === 'cortada');
      series[modo].push({ h: r.h, e: r.l2 });
      console.log(`  ${modo.padEnd(11)} n=${String(n).padStart(3)} h=${r.h.toFixed(5)} celdas=${String(r.celdas).padStart(6)} L2=${r.l2.toExponential(3)} Linf=${r.linf.toExponential(3)}`);
    }
  }
  const pEsc = M.ordenObservado(series.escalonado);
  const pCor = M.ordenObservado(series.cortada);
  console.log(`\n  ESCALONADO   p = ${pEsc.p.toFixed(3)}  R² = ${pEsc.R2.toFixed(4)}`);
  console.log(`  CELDA CORTADA p = ${pCor.p.toFixed(3)}  R² = ${pCor.R2.toFixed(4)}`);

  // ── LOS CHECKS ────────────────────────────────────────────────────────────
  check('C1 el ESCALONADO degrada el orden en frontera no alineada (si no, no había problema)',
    pEsc.p < 1.5,
    `p = ${pEsc.p.toFixed(3)} (el esquema es de orden 2; con la CF a h/2 sobre una esfera se cae)`);

  check('C2 la CELDA CORTADA lo RECUPERA por encima de 1.7',
    pCor.p > 1.7,
    `p = ${pCor.p.toFixed(3)} · R² = ${pCor.R2.toFixed(4)}`);

  check('C3 y el ajuste es LIMPIO (R² > 0.99): baja como potencia, no a saltos',
    pCor.R2 > 0.99,
    `R² cortada ${pCor.R2.toFixed(4)} vs escalonada ${pEsc.R2.toFixed(4)}`);

  const ratio = series.escalonado[NS.length - 1].e / series.cortada[NS.length - 1].e;
  check('C4 en la malla más fina la cortada es AL MENOS 5× más exacta',
    ratio > 5,
    `L2 escalonado ${series.escalonado[NS.length - 1].e.toExponential(2)} vs cortada ${series.cortada[NS.length - 1].e.toExponential(2)} → ${ratio.toFixed(1)}× mejor`);

  const monot = series.cortada.every((p, i) => i === 0 || p.e < series.cortada[i - 1].e);
  check('C5 la cortada baja MONÓTONA (el escalonado zigzaguea porque el patrón cambia)',
    monot,
    series.cortada.map((p) => p.e.toExponential(2)).join(' → '));

  // ── CONTROL: en una frontera SÍ alineada (cubo), las dos deben coincidir ──
  {
    const n = 32, malla = M.mallaCubo(n, L, 0, 0, 0), h = malla.h;
    const N = n * n * n;
    const kA = new Float64Array(N).fill(32), sA = new Float64Array(N);
    for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const [x, y, z] = M.centroCelda(malla, i, j, k);
      sA[(k * n + j) * n + i] = ms.fuente(x, y, z);
    }
    const cor = (usarD) => {
      const sol = M.resolverFV({
        malla, k: kA, s: sA,
        frontera: (c) => (usarD
          ? { tipo: 'dirichlet', T: ms.T(c.x, c.y, c.z), dReal: h / 2 }
          : { tipo: 'dirichlet', T: ms.T(c.x, c.y, c.z) }),
      }, { tolRel: 1e-13, maxIters: 40000 });
      return M.normasError(malla, undefined, sol.T, ms.T).l2;
    };
    const a = cor(false), b = cor(true);
    check('C6 CONTROL: en el CUBO (frontera alineada) dReal = h/2 no cambia NADA',
      Math.abs(a - b) / Math.max(a, 1e-30) < 1e-12,
      `L2 sin dReal ${a.toExponential(6)} vs con dReal=h/2 ${b.toExponential(6)} — la extensión no altera el caso alineado`);
  }

  // ── la lámina ─────────────────────────────────────────────────────────────
  const OUT = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(OUT, { recursive: true });
  const svg = M.laminaConvergencia([
    { nombre: 'ESCALONADO · el dato de la superficie impuesto en la CARA del voxel', color: '#ff5c5c', puntos: series.escalonado, ajuste: pEsc, punteada: true },
    { nombre: 'CELDA CORTADA · el dato en la SUPERFICIE con su distancia declarada', color: '#59d98c', puntos: series.cortada, ajuste: pCor },
  ], {
    titulo: 'CELDA CORTADA · el orden que la frontera escalonada se comía',
    sub: 'esfera FUERA de rejilla · mismo MMS, misma malla, misma fuente — lo unico que cambia es DONDE se aplica el dato',
    ordenRef: 2,
  });
  fs.writeFileSync(path.join(OUT, 'CELDA-CORTADA.svg'), svg);
  console.log(`\n  lámina en _laminas/CELDA-CORTADA.svg`);

  console.log(`\n${fails === 0 ? '✅ TODO VERDE — la celda cortada recupera el orden' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    pEscalonado: +pEsc.p.toFixed(4), r2Escalonado: +pEsc.R2.toFixed(4),
    pCortada: +pCor.p.toFixed(4), r2Cortada: +pCor.R2.toFixed(4),
    mejoraFina: +ratio.toFixed(1),
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 900)); process.exit(1); });
