/**
 * GATE DEL SDF 3D VERDADERO — `mold/sdf-malla.ts`.
 * ============================================================================
 * Un campo que cambia de signo en la superficie NO es un SDF. Un SDF de verdad
 * cumple la ECUACIÓN EIKONAL |∇φ| = 1 en casi todo punto (falla solo en el eje
 * medial, donde la distancia deja de ser diferenciable). Ése es el invariante
 * que separa un sdf real de una aproximación que "se ve bien", y es el que aquí
 * decide. La aproximación de LOSA EN Z que se venía usando NO lo cumple en las
 * paredes laterales, y el gate lo mide para probar que el cambio valía la pena.
 *
 * La vara es ANALÍTICA:
 *   esfera  φ(p) = |p − c| − R        exacto en todo punto
 *   caja    φ(p) = |q|₊ + min(max q,0) con q = |p−c| − medio   (SDF cerrado de caja)
 *
 * Uso: node --import tsx scripts/verif-sdf-malla-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

function esferaMalla(r, cx, cy, cz, nu, nv) {
  const P = [], I = [];
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * 2 * Math.PI;
      P.push(cx + r * Math.sin(th) * Math.cos(ph), cy + r * Math.sin(th) * Math.sin(ph), cz + r * Math.cos(th));
    }
  }
  const id = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    I.push(id(i, j), id(i + 1, j + 1), id(i + 1, j));
    I.push(id(i, j), id(i, j + 1), id(i + 1, j + 1));
  }
  return { positions: Float32Array.from(P), indices: Uint32Array.from(I) };
}

function cajaMalla(x0, y0, z0, x1, y1, z1) {
  const P = [x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1];
  const f = [[0, 3, 2], [0, 2, 1], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4],
             [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7]];
  const I = []; for (const t of f) I.push(...t);
  return { positions: Float32Array.from(P), indices: Uint32Array.from(I) };
}

/** SDF analítico de una caja (Quilez): q = |p−c| − medio */
const sdfCaja = (px, py, pz, cx, cy, cz, hx, hy, hz) => {
  const qx = Math.abs(px - cx) - hx, qy = Math.abs(py - cy) - hy, qz = Math.abs(pz - cz) - hz;
  const fx = Math.max(qx, 0), fy = Math.max(qy, 0), fz = Math.max(qz, 0);
  return Math.hypot(fx, fy, fz) + Math.min(Math.max(qx, qy, qz), 0);
};

(async () => {
  const S = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'sdf-malla.ts'));

  // ── A · ESFERA contra la fórmula cerrada ──────────────────────────────────
  {
    const R = 12, C = [20.31, 19.77, 20.13];              // centro FUERA de rejilla
    const m = esferaMalla(R, C[0], C[1], C[2], 128, 64);
    const g = { nx: 40, ny: 40, nz: 40, dxMm: 1, x0: 0, y0: 0, z0: 0 };
    const r = S.sdfDeMalla(m, g, { bandaCeldas: 4 });
    let peor = 0, peorSigno = 0, n = 0;
    for (let k = 0; k < g.nz; k++) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
      const p = [(i + 0.5), (j + 0.5), (k + 0.5)];
      const teo = Math.hypot(p[0] - C[0], p[1] - C[1], p[2] - C[2]) - R;
      if (Math.abs(teo) > r.bandaMm) continue;             // fuera de banda: saturado a propósito
      const med = r.sdf[(k * g.ny + j) * g.nx + i];
      peor = Math.max(peor, Math.abs(med - teo)); n++;
      if (Math.sign(med) !== Math.sign(teo) && Math.abs(teo) > 0.05) peorSigno++;
    }
    check('A1 ESFERA: la distancia medida = |p−c| − R en toda la banda',
      peor < 0.02,
      `peor error ${peor.toExponential(3)} mm sobre ${n} celdas (la malla es facetada: el error es la faceta, no el método)`);
    check('A2 ESFERA: el SIGNO nunca se equivoca',
      peorSigno === 0, `${peorSigno} celdas con signo malo`);
    check('A3 la malla está cerrada: cero columnas con cruces impares',
      r.columnasImpares === 0, `${r.columnasImpares} columnas impares · ${r.exactas} exactas, ${r.saturadas} saturadas · ${r.ms} ms`);
  }

  // ── B · CAJA contra el SDF cerrado (incluye aristas y esquinas) ───────────
  {
    const B = [8.37, 9.13, 10.29, 29.41, 28.83, 27.67];   // caja FUERA de rejilla
    const m = cajaMalla(...B);
    const g = { nx: 38, ny: 38, nz: 38, dxMm: 1, x0: 0, y0: 0, z0: 0 };
    const r = S.sdfDeMalla(m, g, { bandaCeldas: 4 });
    const c = [(B[0] + B[3]) / 2, (B[1] + B[4]) / 2, (B[2] + B[5]) / 2];
    const hh = [(B[3] - B[0]) / 2, (B[4] - B[1]) / 2, (B[5] - B[2]) / 2];
    let peor = 0, n = 0, malSigno = 0;
    for (let k = 0; k < g.nz; k++) for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
      const teo = sdfCaja(i + 0.5, j + 0.5, k + 0.5, c[0], c[1], c[2], hh[0], hh[1], hh[2]);
      if (Math.abs(teo) > r.bandaMm) continue;
      const med = r.sdf[(k * g.ny + j) * g.nx + i];
      peor = Math.max(peor, Math.abs(med - teo)); n++;
      if (Math.sign(med) !== Math.sign(teo) && Math.abs(teo) > 0.05) malSigno++;
    }
    check('B1 CAJA: coincide con el SDF cerrado también en ARISTAS y ESQUINAS',
      peor < 1e-4, `peor error ${peor.toExponential(3)} mm sobre ${n} celdas`);
    check('B2 CAJA: signo correcto en todas',
      malSigno === 0, `${malSigno} celdas con signo malo`);
  }

  // ── C · EL INVARIANTE QUE MANDA: |∇φ| = 1 ────────────────────────────────
  // Un sdf de verdad cumple la eikonal. Se mide sobre la ESFERA (sin eje medial
  // dentro de la banda) y se contrasta con la aproximación de LOSA EN Z, que es
  // lo que el térmico venía usando en las paredes laterales.
  {
    const R = 12, C = [20.31, 19.77, 20.13];
    const m = esferaMalla(R, C[0], C[1], C[2], 128, 64);
    const g = { nx: 40, ny: 40, nz: 40, dxMm: 1, x0: 0, y0: 0, z0: 0 };
    const r = S.sdfDeMalla(m, g, { bandaCeldas: 4 });
    const idx = (i, j, k) => (k * g.ny + j) * g.nx + i;
    // LOSA EN Z (la aproximación vieja): por columna, φ = max(zBot − z, z − zTop)
    const losa = new Float32Array(g.nx * g.ny * g.nz).fill(g.dxMm);
    for (let j = 0; j < g.ny; j++) for (let i = 0; i < g.nx; i++) {
      const dx2 = (i + 0.5 - C[0]) ** 2 + (j + 0.5 - C[1]) ** 2;
      if (dx2 >= R * R) continue;
      const half = Math.sqrt(R * R - dx2);
      const zB = C[2] - half, zT = C[2] + half;
      for (let k = 0; k < g.nz; k++) {
        const zc = k + 0.5;
        losa[idx(i, j, k)] = Math.max(zB - zc, zc - zT);
      }
    }
    const eikonal = (campo) => {
      let peor = 0, suma = 0, n = 0;
      for (let k = 1; k < g.nz - 1; k++) for (let j = 1; j < g.ny - 1; j++) for (let i = 1; i < g.nx - 1; i++) {
        const c0 = campo[idx(i, j, k)];
        if (Math.abs(c0) > 2.5) continue;                  // solo cerca de la superficie
        const gx = (campo[idx(i + 1, j, k)] - campo[idx(i - 1, j, k)]) / 2;
        const gy = (campo[idx(i, j + 1, k)] - campo[idx(i, j - 1, k)]) / 2;
        const gz = (campo[idx(i, j, k + 1)] - campo[idx(i, j, k - 1)]) / 2;
        const gm = Math.hypot(gx, gy, gz);
        const e = Math.abs(gm - 1);
        peor = Math.max(peor, e); suma += e; n++;
      }
      return { peor, medio: suma / Math.max(1, n), n };
    };
    const eS = eikonal(r.sdf), eL = eikonal(losa);
    console.log(`\n  EIKONAL |∇φ|−1 · sdf 3D: medio ${eS.medio.toExponential(2)} peor ${eS.peor.toFixed(3)} (n=${eS.n})`);
    console.log(`                 · losa z : medio ${eL.medio.toExponential(2)} peor ${eL.peor.toFixed(3)} (n=${eL.n})`);
    check('C1 el SDF 3D cumple la EIKONAL |∇φ| = 1 en promedio a mejor de 2 %',
      eS.medio < 0.02,
      `|∇φ|−1 medio = ${eS.medio.toExponential(3)} — es lo que hace que sea una DISTANCIA y no solo un campo con el signo bien`);
    check('C2 la aproximación de LOSA EN Z NO la cumple (por eso había que cambiarla)',
      eL.medio > eS.medio * 5,
      `losa ${eL.medio.toExponential(2)} vs sdf ${eS.medio.toExponential(2)} → ${(eL.medio / eS.medio).toFixed(0)}× peor · en las paredes laterales el gradiente se dispara`);
  }

  // ── D · CONTROL NEGATIVO: malla ABIERTA ⇒ se declara, no se finge ─────────
  // Y su PUNTO CIEGO, medido: el signo sale de la paridad de cruces en Z, así que
  // un agujero en una cara HORIZONTAL se ve y uno en una cara VERTICAL no — una cara
  // vertical no aporta ningún cruce en z. Mi primera versión de este control borraba
  // justo la cara x0 (vertical) y daba 0 columnas impares: el control tenía razón y
  // el fixture estaba mal. Se deja el caso como límite DECLARADO, no como aprobado.
  {
    const g = { nx: 36, ny: 36, nz: 36, dxMm: 1, x0: 0, y0: 0, z0: 0 };
    const m = cajaMalla(8, 8, 8, 28, 28, 28);
    const idx = Array.from(m.indices);
    // caras del generador: [z0, z0, z1, z1, y0, y0, y1, y1, x1, x1, x0, x0]
    const sinTecho = { positions: m.positions, indices: Uint32Array.from([...idx.slice(0, 6), ...idx.slice(12)]) };
    const sinLado = { positions: m.positions, indices: Uint32Array.from(idx.slice(0, idx.length - 6)) };
    const rT = S.sdfDeMalla(sinTecho, g, { bandaCeldas: 3 });
    const rL = S.sdfDeMalla(sinLado, g, { bandaCeldas: 3 });
    check('D1 CONTROL: con el TECHO borrado (cara horizontal) el sdf DECLARA columnas impares',
      rT.columnasImpares > 0,
      `${rT.columnasImpares} columnas con cruces impares — el signo ahí no es de fiar y se dice`);
    check('D2 LÍMITE DECLARADO: un agujero en cara VERTICAL es INVISIBLE a la paridad en z',
      rL.columnasImpares === 0,
      `${rL.columnasImpares} impares con la cara x0 borrada — la malla SÍ está rota y este check NO la ve. Quien valida cierre es verificacion/matricula.ts (cuenta aristas de frontera); este solo cubre el eje de la paridad`);
  }

  // ── E · INVARIANCIA: trasladar la malla y la rejilla juntas no cambia nada ─
  {
    const R = 9, C = [15.37, 14.81, 15.29];
    const g = { nx: 30, ny: 30, nz: 30, dxMm: 1, x0: 0, y0: 0, z0: 0 };
    const a = S.sdfDeMalla(esferaMalla(R, C[0], C[1], C[2], 96, 48), g, { bandaCeldas: 3 });
    const D = 7;
    const b = S.sdfDeMalla(esferaMalla(R, C[0] + D, C[1] + D, C[2] + D, 96, 48),
      { ...g, x0: D, y0: D, z0: D }, { bandaCeldas: 3 });
    let peor = 0;
    for (let n = 0; n < a.sdf.length; n++) peor = Math.max(peor, Math.abs(a.sdf[n] - b.sdf[n]));
    check('E1 INVARIANCIA por traslación (malla + rejilla juntas)',
      peor < 1e-4, `peor diferencia ${peor.toExponential(2)} mm`);
  }

  console.log(`\n${fails === 0 ? '✅ TODO VERDE — es un SDF de verdad, no un campo con el signo bien' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 900)); process.exit(1); });
