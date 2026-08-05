/**
 * GATE DEL ARNÉS DE RENDER 3D — src/forja/verificacion/fiducial.ts
 * =============================================================================
 * "Siempre tienes problemas para identificar errores en visión 3D." Es cierto, y las
 * causas son estructurales: la proyección es ambigua, un render EQUIVOCADO se ve bien,
 * lo sub-píxel es invisible, y el MODELO y el DIBUJO DEL MODELO se confunden.
 *
 * Este gate NO verifica contra "se ve bien". Verifica contra:
 *
 *  F0  LA CONVENCIÓN. Mi cámara reproduce la de `mold/visibilidad.ts`
 *      (`proyectarParaLamina`) salvo escala y traslación, SIN reflexión ni rotación.
 *      Si me inventé otra convención, todo lo demás mide otra cosa.
 *  F1  FORMA CERRADA. La proyección medida = la trigonometría explícita, < 1e-9 px.
 *      Dos caminos de cálculo distintos (Gram-Schmidt vs trig), mismo número.
 *  F2..F7 EL RENDER CORRUPTO SOBRE EL FIDUCIAL. Escala 2×, ejes intercambiados,
 *      espejo, permutación PAR, anisotropía y roll: cada uno tiene que FALLAR y
 *      decir CUÁL de los tres (escala / ejes / mano).
 *  F8  HONESTIDAD. Desde una vista con |w·(1,1,1)| = 0 la mano NO es medible, y el
 *      arnés lo DECLARA en vez de afirmar que está bien.
 *  T1..T4 TRIANGULACIÓN. Punto 3D conocido recuperado desde pares de vistas con
 *      residuo cero-máquina; control negativo con la profundidad invertida; y el
 *      caso degenerado (vistas paralelas) reportado como NO determinado.
 *  D1..D5 DIFERENCIAL. Traslación (el caso real: abrir 40 mm corre la bbox 40 mm),
 *      rotación y escala, con control negativo de signo.
 *  X1..X6 DISTINGUIBILIDAD SOBRE ESCENA REAL (la taza del libro, §4.1.2/§7.1.3).
 *      El espejo de un cuerpo de revolución es IDÉNTICO: el arnés tiene que dar 0.00
 *      y decir "esta vista no discrimina". Con una taza QUIRAL el número tiene que
 *      despegar. Ese número es el que dice si una vista sirve como evidencia.
 *  P1..P4 TAMAÑO MÍNIMO. El caso real del tunnel gate a 1.5 px.
 *
 * REGLA DURA: si un check falla, se DIAGNOSTICA. Jamás se afloja la tolerancia.
 * Uso: node --import tsx scripts/verif-render3d-test.cjs
 */
const path = require('path');
const fs = require('fs');

let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
const sec = (t) => console.log(`\n── ${t} ${'─'.repeat(Math.max(0, 72 - t.length))}`);

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURES — las mismas mallas del gate de visibilidad (mismo estándar de rigor)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TAZA del libro (§4.1.2 Fig 4.6 · §7.1.3 Fig 7.1). Cuerpo de REVOLUCIÓN: por eso
 * sirve de caso brutal para la distinguibilidad — su espejo es ELLA MISMA.
 *
 * ⚠ EL TESELADO TIENE MANO, aunque el sólido no. Partir cada cuadrilátero SIEMPRE por
 * la misma diagonal hace que la malla —no la pieza— sea QUIRAL: su espejo es otro
 * poliedro. Eso metía un falso positivo enorme en la distinguibilidad (medido: 46 %
 * de "diferencia" entre la taza y su espejo, que son el MISMO sólido). Con
 * `simetrico` la diagonal se elige por el signo de cos(ángulo medio), y entonces el
 * espejo x→−x manda el teselado EXACTAMENTE a sí mismo. Se deja el modo estándar
 * (`simetrico:false`) porque el gate lo usa para MEDIR ese artefacto en vez de
 * fingir que no existe.
 */
function taza(o) {
  const { rExt, rInt, h, baseT, rimR, rimZ, rimT, n } = o;
  const sim = o.simetrico !== false;
  const P = [], I = [];
  const ring = (r, z) => { const b = P.length / 3; for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; P.push(r * Math.cos(a), r * Math.sin(a), z); } return b; };
  const pt = (x, y, z) => { const b = P.length / 3; P.push(x, y, z); return b; };
  const each = (f) => { for (let i = 0; i < n; i++) f(i, (i + 1) % n); };
  /** diagonal del cuadrilátero i: type-1 = P0–P2, type-2 = P1–P3 */
  const tipo1 = (i) => (sim ? Math.cos(((i + 0.5) / n) * 2 * Math.PI) >= 0 : true);
  const quad = (p0, p1, p2, p3, i) => { if (tipo1(i)) I.push(p0, p1, p2, p0, p2, p3); else I.push(p0, p1, p3, p1, p2, p3); };
  const cilExt = (r, zA, zB) => { const A = ring(r, zA), B = ring(r, zB); each((i, j) => quad(A + i, A + j, B + j, B + i, i)); };
  const cilInt = (r, zA, zB) => { const A = ring(r, zA), B = ring(r, zB); each((i, j) => quad(A + i, B + i, B + j, A + j, i)); };
  const anilloUp = (rIn, rOut, z) => { const N = ring(rIn, z), O = ring(rOut, z); each((i, j) => quad(N + i, O + i, O + j, N + j, i)); };
  const anilloDn = (rIn, rOut, z) => { const N = ring(rIn, z), O = ring(rOut, z); each((i, j) => quad(N + i, N + j, O + j, O + i, i)); };
  const discoUp = (r, z) => { const A = ring(r, z), C = pt(0, 0, z); each((i, j) => I.push(C, A + i, A + j)); };
  const discoDn = (r, z) => { const A = ring(r, z), C = pt(0, 0, z); each((i, j) => I.push(C, A + j, A + i)); };
  discoDn(rExt, 0); cilExt(rExt, 0, rimZ); anilloDn(rExt, rimR, rimZ);
  cilExt(rimR, rimZ, rimZ + rimT); anilloUp(rExt, rimR, rimZ + rimT);
  cilExt(rExt, rimZ + rimT, h); anilloUp(rInt, rExt, h);
  cilInt(rInt, baseT, h); discoUp(rInt, baseT);
  return { positions: Float32Array.from(P), indices: Uint32Array.from(I) };
}

/** caja con normales SALIENTES (idéntica a la del gate de visibilidad) */
function caja(x0, y0, z0, x1, y1, z1, P, I) {
  const b = P.length / 3;
  P.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0, x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  const f = [[0, 3, 2], [0, 2, 1], [4, 5, 6], [4, 6, 7], [0, 1, 5], [0, 5, 4], [2, 3, 7], [2, 7, 6], [1, 2, 6], [1, 6, 5], [3, 0, 4], [3, 4, 7]];
  for (const t of f) I.push(b + t[0], b + t[1], b + t[2]);
}

/**
 * TAZA QUIRAL: la misma taza + una OREJA a 0° y un BOSSE a +90°. El espejo x→−x
 * manda la oreja a 180° y deja el bosse en 90°, así que el ángulo relativo pasa de
 * +90° a −90°: NINGÚN giro alrededor del eje arregla las dos a la vez. Es quiral de
 * verdad, no "asimétrica". Es el control positivo de la distinguibilidad.
 */
function tazaQuiral(g) {
  const base = taza(g);
  const P = Array.from(base.positions), I = Array.from(base.indices);
  caja(g.rExt - 1, -7, 20, g.rExt + 9, 7, 40, P, I);          // oreja a 0°
  caja(-5, g.rExt - 1, 8, 5, g.rExt + 6, 18, P, I);           // bosse a +90°
  return { positions: Float32Array.from(P), indices: Uint32Array.from(I) };
}

const GEO = { rExt: 20, rInt: 18, h: 60, baseT: 2, rimR: 24, rimZ: 52, rimT: 3, n: 96 };

const rel = (a, b) => Math.abs(a - b) / Math.max(1e-12, Math.abs(b));

(async () => {
  const V = await import(path.resolve(__dirname, '..', 'src', 'forja', 'mold', 'visibilidad.ts'));
  const A = await import(path.resolve(__dirname, '..', 'src', 'forja', 'verificacion', 'fiducial.ts'));

  const FID = A.fiducialPorDefecto(40);
  /** vista GENÉRICA a propósito: nada de simetrías que confundan un intercambio de
   *  ejes con un espejo (eso se prueba aparte, en F8b). */
  const camGen = { nombre: 'genérica', dir: [-0.42, -0.73, -0.54], arriba: [0, 0, 1], k: 6.25, cx: 540, cy: 380, mira: [0, 0, 0] };
  const camIso = { nombre: 'isométrica (−1,−1,−1)', dir: [-1, -1, -1], arriba: [0, 0, 1], k: 4.2, cx: 312, cy: 452, mira: [0, 0, 0] };

  // ═══════════════════════════════════════════════════════════════════════════
  sec('F0 · LA CONVENCIÓN: mi cámara = la de visibilidad.ts (no inventé otra)');
  // ═══════════════════════════════════════════════════════════════════════════
  {
    const Pc = [], Ic = []; caja(-10, -6, -4, 14, 9, 11, Pc, Ic);
    const cubo = { positions: Float32Array.from(Pc), indices: Uint32Array.from(Ic) };
    const dir = [-0.42, -0.73, -0.54];
    const vis = V.clasificarVisibilidad(cubo, { res: 128, vistas: [{ nombre: 'g', dir }] });
    const proy = V.proyectarParaLamina(cubo, vis, { vista: 0, ancho: 600, alto: 600 });
    // reproduzco su criterio de descarte para saber QUÉ triángulo es cada cara
    const w = (() => { const L = Math.hypot(...dir); return dir.map((x) => x / L); })();
    const mios = [], suyos = [];
    let kk = 0;
    for (let t = 0; t * 3 < Ic.length; t++) {
      const a = Ic[t * 3] * 3, b = Ic[t * 3 + 1] * 3, c = Ic[t * 3 + 2] * 3;
      const A0 = [Pc[a], Pc[a + 1], Pc[a + 2]], B0 = [Pc[b], Pc[b + 1], Pc[b + 2]], C0 = [Pc[c], Pc[c + 1], Pc[c + 2]];
      const nx = (B0[1] - A0[1]) * (C0[2] - A0[2]) - (B0[2] - A0[2]) * (C0[1] - A0[1]);
      const ny = (B0[2] - A0[2]) * (C0[0] - A0[0]) - (B0[0] - A0[0]) * (C0[2] - A0[2]);
      const nz = (B0[0] - A0[0]) * (C0[1] - A0[1]) - (B0[1] - A0[1]) * (C0[0] - A0[0]);
      if (nx * w[0] + ny * w[1] + nz * w[2] >= 0) continue;
      const cara = proy.caras[kk++];
      for (const [m, PP] of [[0, A0], [1, B0], [2, C0]]) {
        mios.push(A.proyectar({ nombre: 'x', dir, arriba: [0, 0, 1], k: 1, cx: 0, cy: 0 }, PP));
        suyos.push([cara.pts[m * 2], cara.pts[m * 2 + 1]]);
      }
    }
    const cen = (L) => L.reduce((s, p) => [s[0] + p[0] / L.length, s[1] + p[1] / L.length], [0, 0]);
    const cm = cen(mios), cs = cen(suyos);
    const rmsm = Math.sqrt(mios.reduce((s, p) => s + (p[0] - cm[0]) ** 2 + (p[1] - cm[1]) ** 2, 0) / mios.length);
    const rmss = Math.sqrt(suyos.reduce((s, p) => s + (p[0] - cs[0]) ** 2 + (p[1] - cs[1]) ** 2, 0) / suyos.length);
    const a1 = mios.map((p) => [(p[0] - cm[0]) / rmsm, (p[1] - cm[1]) / rmsm]);
    const b1 = suyos.map((p) => [(p[0] - cs[0]) / rmss, (p[1] - cs[1]) / rmss]);
    const fit = A.ajusteO2(a1, b1);
    check('F0 mi proyección = proyectarParaLamina salvo escala+traslación (sin rotación ni espejo)',
      fit.resRot < 1e-9 && Math.abs(fit.angRot) < 1e-9,
      `residuo de rotación ${fit.resRot.toExponential(2)} · ángulo ${(fit.angRot * 180 / Math.PI).toExponential(2)}° · reflexión ${fit.resRefl.toExponential(2)} (debe ser >0: si el espejo también ajustara, la nube sería simétrica y el check no probaría nada)`);
    check('F0b la escala relativa es POSITIVA y única (no hay volteo escondido)',
      rmss / rmsm > 0 && fit.resRefl > 1e-3,
      `k_suyo/k_mio = ${(rmss / rmsm).toFixed(6)} px/mm · ${mios.length} vértices cruzados`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  sec('F1 · FORMA CERRADA: proyección medida = trigonometría explícita');
  // ═══════════════════════════════════════════════════════════════════════════
  const camsOK = [camGen, camIso,
    { nombre: 'frente', dir: [0, 1, 0], arriba: [0, 0, 1], k: 6, cx: 400, cy: 400 },
    { nombre: 'oblicua baja', dir: [0.31, -0.22, 0.92], arriba: [0, 0, 1], k: 9.5, cx: 500, cy: 300, mira: [3, -2, 5] },
  ];
  let peorF1 = 0, vFid = null;
  for (const cam of camsOK) {
    const p = A.proyectarFiducial(FID, cam);
    const v = A.verificarFiducial(p);
    if (cam === camIso) vFid = v;
    peorF1 = Math.max(peorF1, v.residuoPx);
    check(`F1[${cam.nombre}] residuo < 1e-9 px y diagnóstico OK`,
      v.residuoPx < 1e-9 && (v.diagnostico === 'OK' || v.diagnostico === 'MANO-NO-MEDIBLE') && v.escalaOK && v.ejesOK,
      `residuo ${v.residuoPx.toExponential(3)} px · k ${v.kEsfera.toFixed(9)} vs ${cam.k} · área triada ${v.areaTriadaMedida.toFixed(4)} vs ${v.areaTriadaCerrada.toFixed(4)} px² · ${v.diagnostico}`);
  }
  {
    const cam = camIso;
    const C = A.formaCerradaFiducial(FID, cam);
    const p = A.proyectarFiducial(FID, cam);
    const areaCubo = A.areaPoligono(A.cascoConvexo(p.cubo));
    check('F1e la silueta MEDIDA del cubo = a²k²(|wx|+|wy|+|wz|) (casco convexo vs analítico)',
      rel(areaCubo, C.areaCubo) < 1e-12,
      `${areaCubo.toFixed(6)} vs ${C.areaCubo.toFixed(6)} px² → error relativo ${rel(areaCubo, C.areaCubo).toExponential(2)}`);
    check('F1f la esfera proyecta un CÍRCULO exacto (rMax/rMin = 1) de radio kR',
      Math.abs(vFid.ovaloEsfera - 1) < 1e-9 && rel(vFid.kEsfera * FID.R, C.rEsfera) < 1e-12,
      `óvalo ${vFid.ovaloEsfera.toFixed(12)} · radio ${(vFid.kEsfera * FID.R).toFixed(6)} vs ${C.rEsfera.toFixed(6)} px`);
    check('F1g el poder de mano de la isométrica es el MÁXIMO posible (√3)',
      Math.abs(vFid.poderMano - Math.sqrt(3)) < 1e-12,
      `|w·(1,1,1)| = ${vFid.poderMano.toFixed(9)} de √3 = ${Math.sqrt(3).toFixed(9)} → es la vista que MÁS discrimina el espejo`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  sec('F2..F7 · EL RENDER CORRUPTO SOBRE EL FIDUCIAL: falla Y dice cuál de los tres');
  // ═══════════════════════════════════════════════════════════════════════════
  const esperado = {
    // Un mapa 3D IMPAR (transponer dos ejes, espejar el modelo) rompe LOS DOS canales:
    // toda reflexión ES una transposición compuesta con un giro, así que separarlas es
    // geométricamente imposible y el arnés lo dice con "EJES+MANO" en vez de elegir una.
    // El espejo de IMAGEN sí sale limpio como MANO: los ejes quedan alineables en O(2).
    'escala-2x': 'ESCALA', 'ejes-XY': 'EJES+MANO', 'ejes-YZ': 'EJES+MANO', 'ejes-ciclico': 'EJES',
    'espejo-imagen': 'MANO', 'espejo-modelo': 'EJES+MANO', 'profundidad': 'MANO',
    'anisotropo': 'NO-ORTOGRAFICA', 'roll': 'ENCUADRE',
  };
  const tablaCorrupcion = [];
  for (const c of A.corrupciones()) {
    const p = A.proyectarFiducial(FID, c.camara(camGen), { mapa: c.mapa, declarar: camGen });
    const v = A.verificarFiducial(p);
    tablaCorrupcion.push({ tipo: c.tipo, diag: v.diagnostico, residuo: +v.residuoPx.toFixed(3), escala: v.escalaOK, ejes: v.ejesOK, mano: v.manoOK });
    check(`F2[${c.tipo}] el fiducial la CAZA y la diagnostica "${esperado[c.tipo]}"`,
      v.diagnostico === esperado[c.tipo] && v.residuoPx > 1e-6,
      `diagnóstico=${v.diagnostico} · residuo ${v.residuoPx.toFixed(2)} px · escalaOK=${v.escalaOK} ejesOK=${v.ejesOK} manoOK=${v.manoOK} — ${(v.porque[0] ?? '').slice(0, 70)}`);
  }
  {
    // la firma tiene que ser DISTINTA por corrupción: si dos dieran lo mismo, el
    // arnés no podría decir "cuál de los tres" y solo diría "algo está mal".
    const esc = tablaCorrupcion.find((t) => t.tipo === 'escala-2x');
    const esp = tablaCorrupcion.find((t) => t.tipo === 'espejo-imagen');
    const ejx = tablaCorrupcion.find((t) => t.tipo === 'ejes-XY');
    check('F3 las TRES firmas son independientes: escala 2× no toca ejes ni mano; el espejo de imagen no toca escala ni ejes; el intercambio de ejes sí toca ejes',
      esc.escala === false && esc.ejes === true && esc.mano === true
      && esp.escala === true && esp.ejes === true && esp.mano === false
      && ejx.escala === true && ejx.ejes === false,
      `escala2x(esc=${esc.escala},ejes=${esc.ejes},mano=${esc.mano}) espejo(${esp.escala},${esp.ejes},${esp.mano}) ejesXY(${ejx.escala},${ejx.ejes},${ejx.mano})`);
    const cic = tablaCorrupcion.find((t) => t.tipo === 'ejes-ciclico');
    check('F4 la permutación PAR (X→Y→Z→X) NO altera la mano — la caza el canal de EJES, no el del espejo',
      cic.mano === true && cic.ejes === false && cic.diag === 'EJES',
      `mano=${cic.mano} (correcta, la permutación es par) · ejes=${cic.ejes} · residuo ${cic.residuo} px`);
  }
  {
    // F5 — el mismo intercambio de ejes desde una vista SIMÉTRICA: ahí X↔Y ES el
    // espejo, y el arnés tiene que decir MANO en vez de inventar que separó los ejes.
    const camSim = { nombre: 'simétrica X=Y', dir: [-1, -1, -1], arriba: [0, 0, 1], k: 5, cx: 400, cy: 400 };
    const p = A.proyectarFiducial(FID, camSim, { mapa: (q) => [q[1], q[0], q[2]], declarar: camSim });
    const v = A.verificarFiducial(p);
    check('F5 desde una vista SIMÉTRICA el intercambio X↔Y es indistinguible de un espejo: el arnés dice MANO y lo CONFIESA',
      v.diagnostico === 'MANO' && v.resReflPx < 1e-9 && v.porque.some((s) => /permutaci/i.test(s)),
      `diag=${v.diagnostico} · residuo de reflexión ${v.resReflPx.toExponential(2)} px (cero ⇒ la medida ES la correcta espejeada) · "${(v.porque.find((s) => /permutaci/i.test(s)) ?? '').slice(0, 78)}"`);
  }
  {
    // F6 — HONESTIDAD: vista con |w·(1,1,1)| = 0. El área firmada de la triada vale
    // 0 y su SIGNO no lleva información: la mano NO es medible desde ahí.
    const camCiega = { nombre: 'ciega a la mano', dir: [1, -1, 0], arriba: [0, 0, 1], k: 6, cx: 400, cy: 400 };
    const p = A.proyectarFiducial(FID, camCiega);
    const v = A.verificarFiducial(p);
    check('F6 vista con |w·(1,1,1)|=0: la mano NO es medible y el arnés lo DECLARA (no afirma que está bien)',
      v.poderMano < 1e-12 && v.manoMedible === false && v.manoOK === false && v.diagnostico === 'MANO-NO-MEDIBLE'
      && Math.abs(v.areaTriadaMedida) < 1e-9 && v.residuoPx < 1e-9,
      `poder ${v.poderMano.toExponential(2)} · área firmada ${v.areaTriadaMedida.toExponential(2)} px² (las 3 puntas salen COLINEALES) · residuo ${v.residuoPx.toExponential(2)} px · ${v.diagnostico}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  sec('T · TRIANGULACIÓN MULTI-VISTA');
  // ═══════════════════════════════════════════════════════════════════════════
  const P_REAL = [17.3, -8.45, 31.9];
  const vistas3 = [
    { nombre: 'frente', dir: [0, 1, 0], arriba: [0, 0, 1], k: 7.1, cx: 400, cy: 400 },
    { nombre: 'derecha', dir: [-1, 0, 0], arriba: [0, 0, 1], k: 5.3, cx: 380, cy: 420 },
    { nombre: 'oblicua', dir: [-0.42, -0.73, -0.54], arriba: [0, 0, 1], k: 6.25, cx: 540, cy: 380 },
    { nombre: 'alta', dir: [0.31, -0.22, 0.92], arriba: [0, 0, 1], k: 9.5, cx: 500, cy: 300 },
  ];
  let triRes = 0, triErr = 0, triResCorrupto = 0, triDispCorrupta = 0;
  {
    const p2 = vistas3.map((c) => A.proyectar(c, P_REAL));
    const r = A.triangular(vistas3, p2);
    triRes = r.residuoPx;
    triErr = Math.hypot(r.punto3D[0] - P_REAL[0], r.punto3D[1] - P_REAL[1], r.punto3D[2] - P_REAL[2]);
    check('T1 punto 3D conocido recuperado desde 4 vistas: residuo de reproyección ~0 y error 3D ~0',
      r.residuoPx < 1e-9 && triErr < 1e-9 && r.determinado,
      `residuo ${r.residuoPx.toExponential(3)} px · error 3D ${triErr.toExponential(3)} mm · condición ${r.condicion.toFixed(2)} · ${r.nEcuaciones} ecuaciones`);

    const pares = A.triangularPorPares(vistas3, p2);
    check('T2 TODOS los pares de vistas dan el mismo punto (la ortográfica es exacta: dispersión ~0)',
      pares.dispersionMm < 1e-9 && pares.pares.every((q) => q.determinado && q.residuoPx < 1e-9),
      `${pares.pares.length} pares · dispersión ${pares.dispersionMm.toExponential(3)} mm · peor residuo ${Math.max(...pares.pares.map((q) => q.residuoPx)).toExponential(2)} px`);
  }
  {
    // CONTROL NEGATIVO. En ortográfica la profundidad NO entra en la imagen: invertirla
    // es mirar desde el OTRO LADO, y como u = v×w también voltea, la imagen sale
    // ESPEJADA. Por eso el residuo revienta — y ese es justo el punto: el defecto de
    // profundidad se manifiesta como un espejo, no como "nada".
    const CULPABLE = 1;
    const real = vistas3.map((c, i) => (i === CULPABLE ? { ...c, dir: [-c.dir[0], -c.dir[1], -c.dir[2]] } : c));
    const p2 = real.map((c) => A.proyectar(c, P_REAL));
    const r = A.triangular(vistas3, p2);      // se declaran las vistas ORIGINALES
    triResCorrupto = r.residuoPx;
    const pares = A.triangularPorPares(vistas3, p2);
    triDispCorrupta = pares.dispersionMm;
    // CRITERIO: el residuo tiene que ser visible A ESCALA DE PÍXEL (>1 px, o sea que
    // el error se ve en la imagen) y la nube de pares tiene que abrirse en MILÍMETROS.
    // No pongo un número redondo inventado: 1 px es el grano de la propia evidencia.
    check('T3 CONTROL NEGATIVO: una vista con la PROFUNDIDAD INVERTIDA revienta el residuo y abre la nube de pares',
      r.residuoPx > 1 && triDispCorrupta > 1,
      `residuo ${r.residuoPx.toFixed(2)} px contra ${triRes.toExponential(2)} del sano (${(r.residuoPx / Math.max(triRes, 1e-15)).toExponential(1)}×) · los pares se abren ${triDispCorrupta.toFixed(2)} mm contra ~1e-14 mm · error 3D ${Math.hypot(r.punto3D[0] - P_REAL[0], r.punto3D[1] - P_REAL[1], r.punto3D[2] - P_REAL[2]).toFixed(2)} mm`);

    // ¿QUIÉN MIENTE? El máximo residuo NO sirve: los mínimos cuadrados reparten el
    // error entre todas las vistas y la culpable puede quedar en tercer lugar (medido).
    // Lo que sí sirve es DEJAR UNA FUERA: quitar a la mentirosa hace colapsar el residuo.
    const loo = vistas3.map((_, i) => {
      const idx = vistas3.map((__, j) => j).filter((j) => j !== i);
      return { fuera: vistas3[i].nombre, res: A.triangular(idx.map((j) => vistas3[j]), idx.map((j) => p2[j])).residuoPx };
    });
    const mejor = loo.reduce((a, b) => (b.res < a.res ? b : a));
    const peorResiduoIngenuo = r.porVista.reduce((a, b) => (b.errPx > a.errPx ? b : a)).vista;
    check('T3b LEAVE-ONE-OUT señala a la vista mentirosa (el máximo residuo por vista NO basta)',
      mejor.fuera === vistas3[CULPABLE].nombre && mejor.res < 1e-9,
      `quitando "${mejor.fuera}" el residuo cae a ${mejor.res.toExponential(2)} px · ${loo.filter((l) => l !== mejor).map((l) => `sin ${l.fuera}: ${l.res.toFixed(1)} px`).join(' · ')} — y OJO: el máximo residuo por vista apuntaba a "${peorResiduoIngenuo}", que es INOCENTE`);
  }
  {
    // caso degenerado: dos vistas PARALELAS no determinan la profundidad. No se finge.
    const par = [vistas3[0], { ...vistas3[0], nombre: 'frente-bis', k: 9, cx: 100, cy: 700 }];
    const p2 = par.map((c) => A.proyectar(c, P_REAL));
    const r = A.triangular(par, p2);
    const libre = Math.abs(r.direccionLibre[1]);
    check('T4 dos vistas PARALELAS: NO determinado, y la dirección libre es la de la mirada',
      r.determinado === false && libre > 0.999,
      `condición ${r.condicion.toExponential(2)} · dirección libre (${r.direccionLibre.map((x) => x.toFixed(3)).join(', ')}) ≈ ±Y = la mirada · residuo ${r.residuoPx.toExponential(2)} px (¡bajo, y aun así el punto NO está determinado: por eso el residuo solo no basta!)`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  sec('D · TEST DIFERENCIAL: la DERIVADA de la imagen contra un delta 3D conocido');
  // ═══════════════════════════════════════════════════════════════════════════
  const cup = taza(GEO);
  const ANCLAS = [[GEO.rExt, 0, 30], [0, GEO.rInt, 55], [-13, -13, GEO.baseT]];
  const camD = { nombre: 'oblicua-D', dir: [-0.42, -0.73, -0.54], arriba: [0, 0, 1], k: 6.25, cx: 540, cy: 380 };
  /** el "render" bajo juicio: proyecta anclas y mide bbox + área de silueta (casco) */
  const hacerRender = (cam, deform) => (T) => {
    const U = deform ? (p) => deform(T(p)) : T;
    const an = ANCLAS.map((p) => A.proyectar(cam, U(p)));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const nube = [];
    for (let i = 0; i < cup.positions.length; i += 3) {
      const q = A.proyectar(cam, U([cup.positions[i], cup.positions[i + 1], cup.positions[i + 2]]));
      nube.push(q);
      if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1];
    }
    return { anclas: an, bbox: { x0, y0, x1, y1 }, areaPx2: A.areaPoligono(A.cascoConvexo(nube)) };
  };
  const rSano = hacerRender(camD);
  let difTrasErr = 0, difTrasErrMalo = 0;
  {
    // EL CASO REAL: abrir el molde 40 mm corre la imagen EXACTAMENTE 40 mm × escala.
    const delta = { tipo: 'traslacion', nombre: 'abrir el molde 40 mm en −Z', t: [0, 0, -40] };
    const r = A.testDiferencial(rSano, delta, { camara: camD, anclas3D: ANCLAS });
    difTrasErr = r.err;
    const dxy = Math.hypot(r.bboxEsperada[0], r.bboxEsperada[1]);
    check('D1 traslación de 40 mm: la imagen se corre lo predicho, y NADA más (ancho de bbox intacto)',
      r.err < 1e-9,
      `err ${r.err.toExponential(3)} px · corrimiento medido (${r.bboxMedida[0].toFixed(6)}, ${r.bboxMedida[1].toFixed(6)}) px = ${dxy.toFixed(4)} px = 40 mm × ${camD.k} px/mm × escorzo ${(dxy / (40 * camD.k)).toFixed(6)}`);
    check('D1b los tres escalares de la traslación cuadran (ΔX, ΔY y Δancho=0)',
      r.escalares.every((e) => e.err < 1e-9),
      r.escalares.map((e) => `${e.nombre.split('(')[0].trim()}=${e.medido.toFixed(4)}/${e.esperado.toFixed(4)}`).join(' · '));

    // CONTROL NEGATIVO 1: el render aplica el delta con el SIGNO CAMBIADO
    const rMalo = (T) => rSano((p) => { const q = T(p); return [2 * p[0] - q[0], 2 * p[1] - q[1], 2 * p[2] - q[2]]; });
    const rm = A.testDiferencial(rMalo, delta, { camara: camD, anclas3D: ANCLAS });
    difTrasErrMalo = rm.err;
    check('D2 CONTROL NEGATIVO (signo invertido): el cuadro estático se ve igual de bien, la DERIVADA no',
      rm.err > 100,
      `err ${rm.err.toFixed(2)} px contra ${difTrasErr.toExponential(2)} del sano — el corrimiento medido es (${rm.bboxMedida[0].toFixed(2)}, ${rm.bboxMedida[1].toFixed(2)}) y se esperaba (${rm.bboxEsperada[0].toFixed(2)}, ${rm.bboxEsperada[1].toFixed(2)})`);

    // CONTROL NEGATIVO 2: el render mueve por el EJE EQUIVOCADO (−Z pedido, +X hecho)
    const rEje = (T) => rSano((p) => { const q = T(p); const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]]; return [p[0] + d[2], p[1] + d[0], p[2] + d[1]]; });
    const re = A.testDiferencial(rEje, delta, { camara: camD, anclas3D: ANCLAS });
    check('D3 CONTROL NEGATIVO (eje equivocado): también revienta, y por un valor distinto al del signo',
      re.err > 100 && Math.abs(re.err - difTrasErrMalo) > 1,
      `err ${re.err.toFixed(2)} px · corrimiento medido (${re.bboxMedida[0].toFixed(2)}, ${re.bboxMedida[1].toFixed(2)}) vs esperado (${re.bboxEsperada[0].toFixed(2)}, ${re.bboxEsperada[1].toFixed(2)})`);
  }
  {
    // ESCALA: el área de la imagen va por s² con CUALQUIER cámara. Invariante puro.
    const delta = { tipo: 'escala', s: 1.35, centro: [0, 0, 30] };
    const r = A.testDiferencial(rSano, delta, { camara: camD, anclas3D: ANCLAS });
    const eArea = r.escalares.find((e) => /ÁREA/.test(e.nombre));
    check('D4 escala s=1.35: el ÁREA de la silueta va por s² y las longitudes por s (sin usar la cámara)',
      r.errAnclasPx < 1e-9 && r.escalares.every((e) => e.err < 1e-9),
      `área medida ${eArea.medido.toFixed(9)}× vs s²=${eArea.esperado.toFixed(9)} · err anclas ${r.errAnclasPx.toExponential(2)} px`);
    const rMalo = (T) => rSano((p) => { const q = T(p); return [q[0], q[1], p[2] + (q[2] - p[2]) * 0.5]; });
    const rm = A.testDiferencial(rMalo, delta, { camara: camD, anclas3D: ANCLAS });
    check('D4b CONTROL NEGATIVO: una escala NO uniforme (Z a la mitad) rompe el invariante de área',
      rm.escalares.some((e) => e.err > 0.01),
      `peor escalar ${Math.max(...rm.escalares.map((e) => e.err)).toFixed(6)} · err anclas ${rm.errAnclasPx.toFixed(3)} px`);
  }
  {
    // ROTACIÓN sobre el EJE DE VISTA: la imagen gira ese mismo ángulo y conserva
    // toda longitud. Otro invariante que no depende de la orientación de la cámara.
    const bw = A.baseCamara(camD).w;
    const delta = { tipo: 'rotacion', eje: bw, ang: 23 * Math.PI / 180, centro: [0, 0, 30] };
    const r = A.testDiferencial(rSano, delta, { camara: camD, anclas3D: ANCLAS });
    const eAng = r.escalares.find((e) => /ángulo/i.test(e.nombre));
    check('D5 rotación de 23° sobre el eje de vista: la imagen gira 23° y conserva longitudes',
      r.errAnclasPx < 1e-9 && r.escalares.every((e) => e.err < 1e-9),
      `ángulo medido ${(eAng.medido * 180 / Math.PI).toFixed(9)}° vs ${(eAng.esperado * 180 / Math.PI).toFixed(9)}° · err anclas ${r.errAnclasPx.toExponential(2)} px`);
    // El render bajo juicio, cuando le piden girar +23°, gira −23°. Se detecta la
    // llamada de referencia (identidad) para no corromper también la pose base: si se
    // corrompen las dos, la DIFERENCIA sale cero y el control negativo no prueba nada.
    const Rmal = A.transformacionDe({ tipo: 'rotacion', eje: bw, ang: -23 * Math.PI / 180, centro: [0, 0, 30] });
    const esIdentidad = (T) => { const q = T([1.7, -2.3, 0.9]); return Math.abs(q[0] - 1.7) < 1e-12 && Math.abs(q[1] + 2.3) < 1e-12 && Math.abs(q[2] - 0.9) < 1e-12; };
    const rm = A.testDiferencial((T) => rSano(esIdentidad(T) ? ((p) => p) : Rmal), delta, { camara: camD, anclas3D: ANCLAS });
    const eAngM = rm.escalares.find((e) => /ángulo/i.test(e.nombre));
    check('D5b CONTROL NEGATIVO: girar al REVÉS da el ángulo con el signo cambiado (46° de error)',
      Math.abs(Math.abs(eAngM.err * 180 / Math.PI) - 46) < 1e-6 && rm.errAnclasPx > 10,
      `error de ángulo ${(eAngM.err * 180 / Math.PI).toFixed(6)}° · err anclas ${rm.errAnclasPx.toFixed(2)} px`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  sec('X · DISTINGUIBILIDAD SOBRE ESCENA REAL — ¿esta imagen es EVIDENCIA?');
  // ═══════════════════════════════════════════════════════════════════════════
  const RES_IMG = 320;
  const VISTAS = V.vistasTaza();
  /**
   * UNA imagen = UNA malla vista desde UNA cámara declarada. Se compara siempre con
   * la MISMA cámara (el modelo cambia, la cámara no) porque ése es el escenario real:
   * la lámina se dibujó desde donde dice, y lo que está en duda es la pieza.
   * El canal de sombreado sale de `clasificarVisibilidad` — el motor ya verificado —,
   * y la profundidad es POR VÉRTICE (si no, se mide la teselación: ver §5 del módulo).
   */
  const imagenDe = (mesh, vista) => {
    const vis = V.clasificarVisibilidad(mesh, { res: 384, vistas: [vista] });
    const cam = { nombre: vista.nombre, dir: vista.dir, k: 1, cx: 0, cy: 0 };
    const proy = A.proyectarMallaParaImagen(mesh, cam, { visTri: vis.fracMaxTri, ancho: 600, alto: 620, ajustar: true });
    return A.rasterizarProyeccion(proy, { res: RES_IMG });
  };
  const cupEsp = A.espejarMalla(cup, 0);
  const quiral = tazaQuiral(GEO);
  const quiEsp = A.espejarMalla(quiral, 0);

  {
    // X0 · mi proyector y el de visibilidad.ts pintan LA MISMA silueta, píxel a píxel.
    // Sin esto, todo lo que sigue mediría mi rasterizador y no el motor del proyecto.
    const vis = V.clasificarVisibilidad(cup, { res: 384, vistas: [VISTAS[5]] });
    const suya = A.rasterizarProyeccion(V.proyectarParaLamina(cup, vis, { vista: 0, ancho: 600, alto: 620 }), { res: RES_IMG });
    const mia = imagenDe(cup, VISTAS[5]);
    let dif = 0; for (let i = 0; i < mia.mask.length; i++) if (mia.mask[i] !== suya.mask[i]) dif++;
    check('X0 mi rasterización y la de proyectarParaLamina dan la MISMA silueta, píxel a píxel',
      dif === 0 && suya.zConstante === true && mia.zConstante === false,
      `${dif} píxeles de diferencia sobre ${mia.nPix} de pieza · la suya trae z CONSTANTE por triángulo (${suya.zConstante}), la mía z POR VÉRTICE (${!mia.zConstante})`);
  }

  const tabla = [];
  let mejorLisa = 0, mejorQuiral = 0, mejorVistaQuiral = '—', peorQuiral = Infinity, peorVistaQuiral = '—';
  for (const vista of VISTAS) {
    const dLisa = A.distinguibilidad(imagenDe(cup, vista), imagenDe(cupEsp, vista));
    const det = A.distinguibilidadDetalle(imagenDe(quiral, vista), imagenDe(quiEsp, vista));
    tabla.push({ vista: vista.nombre, lisa: dLisa, quiral: det.pctPieza, discrimina: det.discrimina, sil: det.pctSilueta, prof: det.pctProfundidad });
    mejorLisa = Math.max(mejorLisa, dLisa);
    if (det.pctPieza > mejorQuiral) { mejorQuiral = det.pctPieza; mejorVistaQuiral = vista.nombre; }
    if (det.pctPieza < peorQuiral) { peorQuiral = det.pctPieza; peorVistaQuiral = vista.nombre; }
  }
  console.log('\n   vista           espejo de la taza LISA    espejo de la taza QUIRAL   ¿la vista es evidencia?');
  for (const r of tabla) console.log(`   ${r.vista.padEnd(14)} ${(r.lisa.toFixed(4) + ' %').padStart(20)} ${(r.quiral.toFixed(2) + ' %').padStart(23)}    ${r.discrimina ? 'SÍ' : 'NO — no discrimina'}`);

  check('X1 el espejo de la taza LISA (cuerpo de revolución) es INDISTINGUIBLE en las 7 vistas: distancia 0.00 %',
    mejorLisa === 0,
    `máximo sobre las 7 vistas = ${mejorLisa.toFixed(6)} % — el espejo de un sólido de revolución ES el mismo sólido, así que NINGUNA lámina de la taza puede servir como prueba de que la mano está bien`);
  {
    const vd = A.verificarDiscriminacion('taza lisa · oblicua-A', 'espejo x→−x', imagenDe(cup, VISTAS[5]), imagenDe(cupEsp, VISTAS[5]));
    check('X2 y el arnés lo DICE: esEvidencia=false con el veredicto "esta vista no discrimina"',
      vd.esEvidencia === false && /NO DISCRIMINA/.test(vd.detalle.veredicto),
      `distancia ${vd.distancia.toFixed(6)} % < umbral ${A.UMBRAL_DISCRIMINA_PCT} % · IoU ${vd.detalle.iou.toFixed(6)} · "${vd.detalle.veredicto.slice(0, 96)}"`);
  }
  check('X3 CONTROL POSITIVO: con la taza QUIRAL (oreja a 0° + bosse a 90°) el espejo SÍ se distingue',
    mejorQuiral >= A.UMBRAL_DISCRIMINA_PCT,
    `mejor vista "${mejorVistaQuiral}" con ${mejorQuiral.toFixed(2)} % de la huella distinta (umbral ${A.UMBRAL_DISCRIMINA_PCT} %) — ESE es el número que dice si la vista sirve de evidencia`);
  check('X4 y el arnés dice CUÁLES vistas sirven y cuáles no: el ranking es el entregable',
    tabla.filter((t) => t.discrimina).length >= 1 && peorQuiral < mejorQuiral,
    `${tabla.filter((t) => t.discrimina).length} de ${tabla.length} vistas califican · mejor "${mejorVistaQuiral}" ${mejorQuiral.toFixed(2)} % · peor "${peorVistaQuiral}" ${peorQuiral.toFixed(2)} %`);
  {
    const a = imagenDe(cup, VISTAS[0]);
    check('X5 la métrica da EXACTAMENTE 0 para dos renders idénticos (no tiene ruido de fondo)',
      A.distinguibilidad(a, a) === 0,
      `d(A,A) = ${A.distinguibilidad(a, a)} · ${a.nPix} px de pieza en el cuadro`);
  }
  let artefactoTeselado = 0, artefactoSombreado = 0;
  {
    // EL FALSO POSITIVO, MEDIDO Y NOMBRADO. La MISMA taza con el teselado estándar
    // (una sola diagonal por cuadrilátero) es una malla QUIRAL aunque el sólido no lo
    // sea. Con la métrica GEOMÉTRICA (silueta + profundidad por vértice) el artefacto
    // es CERO EXACTO. Con el canal de SOMBREADO encendido —que es una cantidad POR
    // TRIÁNGULO— el mismo par da 67 %: puro artefacto. Por eso el sombreado no cuenta
    // por defecto, y por eso este check existe: para que el número quede escrito.
    const std = taza({ ...GEO, simetrico: false });
    const stdEsp = A.espejarMalla(std, 0);
    const ia = imagenDe(std, VISTAS[5]), ib = imagenDe(stdEsp, VISTAS[5]);
    const geo = A.distinguibilidadDetalle(ia, ib);
    const conSomb = A.distinguibilidadDetalle(ia, ib, { usarSombreado: true });
    artefactoTeselado = geo.pctPieza; artefactoSombreado = conSomb.pctPieza;
    check('X6 la métrica GEOMÉTRICA es invariante al teselado (0 exacto); el canal de SOMBREADO no lo es, y por eso está apagado',
      artefactoTeselado === 0 && geo.pctSilueta === 0 && geo.pctProfundidad === 0 && artefactoSombreado > 50,
      `mismo sólido, otra diagonal → geométrica ${artefactoTeselado.toFixed(6)} % (silueta 0, profundidad 0 al bit) · con sombreado ${artefactoSombreado.toFixed(2)} % de PURO ARTEFACTO. Ese 67 % es exactamente el tipo de número que haría "ver" un espejo donde no lo hay`);
  }
  {
    // la misma métrica contra una corrupción de MODELO: ejes Y↔Z intercambiados.
    const swap = (m) => { const P = new Float32Array(m.positions.length); for (let i = 0; i < m.positions.length; i += 3) { P[i] = m.positions[i]; P[i + 1] = m.positions[i + 2]; P[i + 2] = m.positions[i + 1]; } const I = new Uint32Array(m.indices.length); for (let t = 0; t + 2 < m.indices.length; t += 3) { I[t] = m.indices[t]; I[t + 1] = m.indices[t + 2]; I[t + 2] = m.indices[t + 1]; } return { positions: P, indices: I }; };
    const det = A.distinguibilidadDetalle(imagenDe(cup, VISTAS[5]), imagenDe(swap(cup), VISTAS[5]));
    check('X7 la MISMA métrica caza una corrupción de MODELO (ejes Y↔Z) sobre la taza lisa',
      det.discrimina && det.pctPieza > 20,
      `${det.pctPieza.toFixed(2)} % de la huella cambia (silueta ${det.pctSilueta.toFixed(2)} % · profundidad ${det.pctProfundidad.toFixed(2)} % · sombreado ${det.pctSombreado.toFixed(2)} %) · IoU ${det.iou.toFixed(3)}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  sec('P · TAMAÑO MÍNIMO EN PANTALLA — el caso del tunnel gate a 1.5 px');
  // ═══════════════════════════════════════════════════════════════════════════
  // Lámina real: 1000 px de ancho para un molde de 200 mm → 5 px/mm.
  const camLam = { nombre: 'lámina L7 (1000 px / 200 mm)', dir: [0, 1, 0], arriba: [0, 0, 1], k: 5, cx: 500, cy: 380 };
  const RASGOS = [
    { nombre: 'tunnel gate ⌀0.30 mm', tamanoMm: 0.30, en: [20, 0, 8], queSeJuzga: 'si el cono abre hacia la pieza o hacia la colada' },
    { nombre: 'ángulo de salida 1.5° en pared de 30 mm', tamanoMm: 30 * Math.tan(1.5 * Math.PI / 180), en: [20, 0, 30], queSeJuzga: 'si la pared tiene salida o está a plomo' },
    { nombre: 'radio de filete R1.2', tamanoMm: 1.2, en: [20, 0, 52], queSeJuzga: 'si es filete o chaflán' },
    { nombre: 'reborde de 3 mm', tamanoMm: GEO.rimT, en: [24, 0, 53], queSeJuzga: 'el espesor del reborde' },
    { nombre: 'altura de la taza (60 mm)', tamanoMm: GEO.h, dir: [0, 0, 1], en: [0, 0, 30], queSeJuzga: 'la proporción general' },
  ];
  const vt = A.verificarTamanoMinimo(RASGOS, camLam);
  for (const r of vt.rasgos) console.log(`   ${r.ok ? '✓' : '✗'} ${r.nombre.padEnd(42)} ${r.px.toFixed(2).padStart(8)} px  (mín ${r.minPx})${r.recuadro ? `  → recuadro ${r.recuadro.zoom}× lado ${r.recuadro.ladoPx} px` : ''}`);
  const gate = vt.rasgos[0];
  check('P1 el tunnel gate ⌀0.30 mm a 5 px/mm mide 1.50 px y REPRUEBA (el caso real que nadie podía ver)',
    Math.abs(gate.px - 1.5) < 1e-9 && gate.ok === false && !!gate.recuadro,
    `${gate.px.toFixed(2)} px contra ${gate.minPx} exigidos → recuadro obligatorio a ${gate.recuadro.zoom}× (lado ${gate.recuadro.ladoPx} px), centrado en (${gate.recuadro.centroPx.map((x) => x.toFixed(0)).join(', ')})`);
  check('P2 el rasgo GRANDE de la misma lámina sí pasa: la función no reprueba por reprobar',
    vt.rasgos[4].ok === true && vt.rasgos[3].ok === true,
    `altura de la taza ${vt.rasgos[4].px.toFixed(0)} px · reborde ${vt.rasgos[3].px.toFixed(0)} px`);
  check('P3 el ESCORZO entra en la cuenta: la altura de 60 mm ⟂ a la mirada proyecta el 100 %',
    Math.abs(vt.rasgos[4].escorzo - 1) < 1e-12 && Math.abs(vt.rasgos[4].px - GEO.h * camLam.k) < 1e-9,
    `escorzo √(1−(d·w)²) = ${vt.rasgos[4].escorzo.toFixed(9)} → ${vt.rasgos[4].px.toFixed(2)} px = 60 mm × 5 px/mm`);
  {
    const dEscorzo = { ...RASGOS[4], nombre: 'la misma altura vista DE CANTO', dir: [0, 1, 0] };
    const ve = A.verificarTamanoMinimo([dEscorzo], camLam);
    check('P3b y el mismo rasgo MIRADO DE CANTO colapsa a 0 px: reprueba, como debe',
      ve.rasgos[0].px < 1e-9 && ve.rasgos[0].ok === false,
      `escorzo ${ve.rasgos[0].escorzo.toExponential(2)} → ${ve.rasgos[0].px.toExponential(2)} px (el rasgo existe pero ESA vista no lo puede juzgar)`);
  }
  check('P4 la escala necesaria es accionable: dice a cuánto hay que subir la lámina',
    Math.abs(A.escalaNecesaria(0.30) - 40) < 1e-9,
    `un ⌀0.30 mm necesita ${A.escalaNecesaria(0.30).toFixed(1)} px/mm para llegar a ${A.MIN_PX_DEFECTO} px; la lámina tiene ${camLam.k} px/mm → falta ${(A.escalaNecesaria(0.30) / camLam.k).toFixed(1)}×`);

  // ═══════════════════════════════════════════════════════════════════════════
  sec('LA LÁMINA — _laminas/FIDUCIAL-arnes.svg');
  // ═══════════════════════════════════════════════════════════════════════════
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });
  /** cámara de la LÁMINA: isométrica pura, que es la que MÁS discrimina la mano
   *  (|w·(1,1,1)| = √3, el máximo posible), encuadrada en el panel izquierdo. */
  const camLamina = { nombre: 'isométrica (−1,−1,−1)', dir: [-1, -1, -1], arriba: [0, 0, 1], k: 5.2, cx: 312, cy: 396, mira: FID.origen };
  const proyIso = A.proyectarFiducial(FID, camLamina);
  const vIso = A.verificarFiducial(proyIso);
  const lam = A.laminaFiducial({
    fiducial: FID, camara: camLamina, veredicto: vIso,
    nombre: 'triada + cubo + esfera · verificado contra forma cerrada, triangulación, derivada y render corrupto',
    filas: [
      { que: 'TRIANGULACIÓN 4 vistas (residuo)', valor: `${triRes.toExponential(2)} px · error 3D ${triErr.toExponential(2)} mm`, estado: triRes < 1e-9 ? 'OK' : 'MAL' },
      { que: 'CONTROL NEG.: profundidad invertida', valor: `${triResCorrupto.toFixed(1)} px · los pares se abren ${triDispCorrupta.toFixed(1)} mm`, estado: (triResCorrupto > 1 && triDispCorrupta > 1) ? 'OK' : 'MAL' },
      { que: 'DIFERENCIAL: abrir 40 mm', valor: `err ${difTrasErr.toExponential(2)} px · signo al revés → ${difTrasErrMalo.toFixed(0)} px`, estado: difTrasErr < 1e-9 ? 'OK' : 'MAL' },
      { que: 'DISTINGUIBILIDAD taza LISA vs su espejo', valor: `${mejorLisa.toFixed(4)} % → esa vista NO ES EVIDENCIA`, estado: 'AVISO' },
      { que: 'DISTINGUIBILIDAD taza QUIRAL vs su espejo', valor: `${mejorQuiral.toFixed(2)} % (${mejorVistaQuiral}) → sí discrimina`, estado: mejorQuiral >= A.UMBRAL_DISCRIMINA_PCT ? 'OK' : 'MAL' },
      { que: 'ARTEFACTO DE TESELADO (falso positivo)', valor: `${artefactoTeselado.toFixed(4)} % geométrico · ${artefactoSombreado.toFixed(0)} % si cuenta el sombreado`, estado: artefactoTeselado === 0 ? 'OK' : 'MAL' },
      { que: 'HALLAZGO — tunnel gate ⌀0.30 en la lámina L7', valor: `${gate.px.toFixed(2)} px < ${gate.minPx} exigidos → recuadro ${gate.recuadro.zoom}× obligatorio`, estado: 'MAL' },
    ],
    notas: ['fiducial: residuo maestro cero-máquina contra la forma cerrada'],
  });
  fs.writeFileSync(path.join(outDir, 'FIDUCIAL-arnes.svg'), lam.svg);
  check('L1 la lámina se escribe, cierra bien y trae el fiducial dibujado Y el panel numérico',
    lam.svg.startsWith('<svg') && lam.svg.trim().endsWith('</svg>')
    && /class="fid"/.test(lam.svg) && /DIAGNÓSTICO/.test(lam.svg)
    && (lam.svg.match(/>X</g) || []).length >= 1 && (lam.svg.match(/>Y</g) || []).length >= 1 && (lam.svg.match(/>Z</g) || []).length >= 1,
    `${(lam.svg.length / 1024).toFixed(1)} kB · _laminas/FIDUCIAL-arnes.svg · diagnóstico ${vIso.diagnostico}`);
  check('L2 el fiducial de la lámina PASA su propia verificación (el dibujo y los números cuentan lo mismo)',
    vIso.diagnostico === 'OK' && vIso.residuoPx < 1e-9,
    `residuo ${vIso.residuoPx.toExponential(2)} px · poder de mano ${vIso.poderMano.toFixed(4)} (máximo posible) · ${vIso.diagnostico}`);

  console.log(`\n  ${lam.queMirar}`);
  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    fiducialResiduoPx: +peorF1.toExponential(3),
    corrupciones: tablaCorrupcion.map((t) => `${t.tipo}:${t.diag}`),
    triangulacionResiduoPx: +triRes.toExponential(3),
    triangulacionErrMm: +triErr.toExponential(3),
    triangulacionCorruptaPx: +triResCorrupto.toFixed(2),
    triangulacionDispersionCorruptaMm: +triDispCorrupta.toFixed(3),
    diferencialErrPx: +difTrasErr.toExponential(3),
    diferencialSignoMaloPx: +difTrasErrMalo.toFixed(2),
    distinguibilidadTazaLisaPct: +mejorLisa.toFixed(6),
    artefactoTeseladoGeomPct: +artefactoTeselado.toFixed(4),
    artefactoTeseladoSombreadoPct: +artefactoSombreado.toFixed(2),
    distinguibilidadTazaQuiralPct: +mejorQuiral.toFixed(3),
    vistasQueSonEvidencia: `${tabla.filter((t) => t.discrimina).length}/${tabla.length}`,
    gatePx: +gate.px.toFixed(2), gateZoomExigido: gate.recuadro.zoom,
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 1200)); process.exit(1); });
