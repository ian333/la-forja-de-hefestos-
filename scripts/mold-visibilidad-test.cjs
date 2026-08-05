/**
 * GATE DE VISIBILIDAD — el predicado de Kazmer (§4.1.2 · §4.1.4 · §7.1.3 · §11.2.5).
 *
 * El libro no da un número que checar, así que NO se puede "verificar contra la tabla".
 * Se verifica contra GEOMETRÍA ANALÍTICA e INVARIANTES que no dependen de mi código:
 *
 *  V1  CONVEXIDAD ⇒ CERO AUTO-OCLUSIÓN. En un cuerpo convexo, toda cara que mira al
 *      observador se ve: no hay nada que se interponga. Si el z-buffer reporta área
 *      oculta > 0 en un cubo/esfera/cilindro, el rasterizado está mintiendo.
 *  V2  ESFERA, UNA VISTA = MEDIA ESFERA. Área visible = 2πr² exacto (analítico).
 *  V3  OCLUSIÓN CON ÁREA CONOCIDA. Caja grande con caja chica encima: lo que se
 *      esconde desde arriba es EXACTAMENTE la huella de la chica (a² mm²). El error
 *      contra ese número analítico es la calidad real del oclusor.
 *  V4  CONSERVACIÓN. visible + oculta + nunca-frontal = área total. Sin fugas.
 *  V5  CONVERGENCIA EN RESOLUCIÓN. Duplicar el z-buffer no puede cambiar el veredicto.
 *  V6  EL PAR DEL LIBRO (V7.1, Fig 7.1 "Re-locating gates for improved aesthetics").
 *      Gate "on side wall" = superficie VISIBLE (malo). Gate "below side wall" = NO
 *      visible (bueno). Si el motor no reproduce ese par, no sirve para juzgar §7.
 *  V7  EL PAR DEL LIBRO (V4.3, Fig 4.6 "Two parting line locations for cup").
 *      Partición cerca del labio = visible (malo); en la base del reborde = oculta.
 *  V8  CARA DE ASIENTO OCULTA. Ninguna vista de uso mira hacia arriba desde abajo:
 *      la base sobre la que se apoya la taza NUNCA es visible.
 *
 * Uso: node --import tsx scripts/mold-visibilidad-test.cjs
 */
const path = require('path');
let fails = 0;
const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };

/** caja axis-aligned como 12 triángulos, normales SALIENTES. */
function caja(x0, y0, z0, x1, y1, z1, P, I) {
  const b = P.length / 3;
  P.push(x0, y0, z0, x1, y0, z0, x1, y1, z0, x0, y1, z0,
         x0, y0, z1, x1, y0, z1, x1, y1, z1, x0, y1, z1);
  const f = [
    [0, 3, 2], [0, 2, 1],   // z0 (normal −Z)
    [4, 5, 6], [4, 6, 7],   // z1 (+Z)
    [0, 1, 5], [0, 5, 4],   // y0 (−Y)
    [2, 3, 7], [2, 7, 6],   // y1 (+Y)
    [1, 2, 6], [1, 6, 5],   // x1 (+X)
    [3, 0, 4], [3, 4, 7],   // x0 (−X)
  ];
  for (const t of f) I.push(b + t[0], b + t[1], b + t[2]);
}

/**
 * esfera UV con normales SALIENTES.
 * ⚠ 2026-08-05: tenía el devanado INVERTIDO (volumen −4181 en vez de +4189) y el
 * comentario decía "salientes". Aquí era inofensivo — el z-buffer no depende del
 * sentido y el área de media esfera es la misma por simetría — pero es exactamente
 * el bug que `verificacion/matricula.ts` existe para cazar, viviendo en el gate.
 * Lo destapó el censo de mallas. Ahora el devanado es correcto Y el check V0b lo
 * verifica por volumen, igual que la taza.
 */
function esfera(r, nu, nv) {
  const P = [], I = [];
  for (let j = 0; j <= nv; j++) {
    const th = (j / nv) * Math.PI;
    for (let i = 0; i <= nu; i++) {
      const ph = (i / nu) * 2 * Math.PI;
      P.push(r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th));
    }
  }
  const id = (i, j) => j * (nu + 1) + i;
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    I.push(id(i, j), id(i + 1, j + 1), id(i + 1, j));
    I.push(id(i, j), id(i, j + 1), id(i + 1, j + 1));
  }
  return { positions: Float32Array.from(P), indices: Uint32Array.from(I) };
}

/**
 * TAZA del libro (§4.1.2 Fig 4.6 · §7.1.3 Fig 7.1): cilindro hueco con base y un
 * REBORDE anular que sobresale. La cara de ABAJO del reborde es literalmente el
 * "underneath a side wall" que Kazmer recomienda para la compuerta.
 * Todas las caras con NORMAL SALIENTE — el check de volumen lo verifica.
 */
function taza(o) {
  const { rExt, rInt, h, baseT, rimR, rimZ, rimT, n } = o;
  const P = [], I = [];
  const ring = (r, z) => { const b = P.length / 3; for (let i = 0; i < n; i++) { const a = (i / n) * 2 * Math.PI; P.push(r * Math.cos(a), r * Math.sin(a), z); } return b; };
  const pt = (x, y, z) => { const b = P.length / 3; P.push(x, y, z); return b; };
  const each = (f) => { for (let i = 0; i < n; i++) f(i, (i + 1) % n); };
  // cilindro con normal HACIA AFUERA del eje
  const cilExt = (r, zA, zB) => { const A = ring(r, zA), B = ring(r, zB); each((i, j) => I.push(A + i, A + j, B + j, A + i, B + j, B + i)); };
  // cilindro con normal HACIA EL EJE (pared interior de la taza)
  const cilInt = (r, zA, zB) => { const A = ring(r, zA), B = ring(r, zB); each((i, j) => I.push(A + i, B + i, B + j, A + i, B + j, A + j)); };
  // anillo plano, normal +Z / −Z
  const anilloUp = (rIn, rOut, z) => { const N = ring(rIn, z), O = ring(rOut, z); each((i, j) => I.push(N + i, O + i, O + j, N + i, O + j, N + j)); };
  const anilloDn = (rIn, rOut, z) => { const N = ring(rIn, z), O = ring(rOut, z); each((i, j) => I.push(N + i, N + j, O + j, N + i, O + j, O + i)); };
  // disco lleno, normal +Z / −Z
  const discoUp = (r, z) => { const A = ring(r, z), C = pt(0, 0, z); each((i, j) => I.push(C, A + i, A + j)); };
  const discoDn = (r, z) => { const A = ring(r, z), C = pt(0, 0, z); each((i, j) => I.push(C, A + j, A + i)); };

  discoDn(rExt, 0);                        // 1 base de ASIENTO (nunca visible)
  cilExt(rExt, 0, rimZ);                   // 2 pared exterior baja
  anilloDn(rExt, rimR, rimZ);              // 3 cara de ABAJO del reborde ← "underneath a side wall"
  cilExt(rimR, rimZ, rimZ + rimT);         // 4 canto del reborde
  anilloUp(rExt, rimR, rimZ + rimT);       // 5 cara de arriba del reborde
  cilExt(rExt, rimZ + rimT, h);            // 6 pared exterior alta (donde va la partición MALA)
  anilloUp(rInt, rExt, h);                 // 7 labio
  cilInt(rInt, baseT, h);                  // 8 pared interior
  discoUp(rInt, baseT);                    // 9 fondo interior
  return { positions: Float32Array.from(P), indices: Uint32Array.from(I) };
}

/** volumen con signo por el teorema de la divergencia — negativo o cero ⇒ normales al revés. */
function volumen(m) {
  const P = m.positions, I = m.indices; let v6 = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t] * 3, b = I[t + 1] * 3, c = I[t + 2] * 3;
    v6 += P[a] * (P[b + 1] * P[c + 2] - P[b + 2] * P[c + 1])
        - P[a + 1] * (P[b] * P[c + 2] - P[b + 2] * P[c])
        + P[a + 2] * (P[b] * P[c + 1] - P[b + 1] * P[c]);
  }
  return v6 / 6;
}

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const V = await import(R('visibilidad.ts'));

  // ── V1 · CONVEXIDAD ⇒ CERO AUTO-OCLUSIÓN ────────────────────────────────────
  const Pc = [], Ic = []; caja(0, 0, 0, 20, 20, 20, Pc, Ic);
  const cubo = { positions: Float32Array.from(Pc), indices: Uint32Array.from(Ic) };
  const vc = V.clasificarVisibilidad(cubo, { res: 256 });
  check('V1a cubo convexo: CERO área oculta por sí misma',
    vc.areaOcultaPorSiMismaMm2 === 0,
    `oculta=${vc.areaOcultaPorSiMismaMm2.toFixed(4)} mm² (debe ser exactamente 0)`);

  const esf = esfera(10, 96, 48);
  {
    const vTeo = (4 / 3) * Math.PI * 1000;
    const vMed = volumen(esf);
    const e = Math.abs(vMed - vTeo) / vTeo * 100;
    check('V0b fixture: la esfera es sólida con normales SALIENTES (volumen analítico)',
      vMed > 0 && e < 0.5,
      `V=${vMed.toFixed(1)} vs teórico ${vTeo.toFixed(1)} mm³ → error ${e.toFixed(3)} % (tenía el devanado INVERTIDO hasta 2026-08-05)`);
  }
  const ve = V.clasificarVisibilidad(esf, { res: 256 });
  check('V1b esfera convexa: CERO área oculta por sí misma',
    ve.areaOcultaPorSiMismaMm2 === 0,
    `oculta=${ve.areaOcultaPorSiMismaMm2.toFixed(4)} mm²`);

  // ── V2 · ESFERA, UNA VISTA = MEDIA ESFERA (analítico 2πr²) ───────────────────
  const v1 = V.clasificarVisibilidad(esf, { res: 1024, vistas: [{ nombre: 'única', dir: [0, 0, -1] }] });
  const teo = 2 * Math.PI * 10 * 10;
  const errPct = Math.abs(v1.areaVisibleMm2 - teo) / teo * 100;
  check('V2 esfera desde 1 vista = 2πr² (media esfera, analítico)',
    errPct < 1.5,
    `visible=${v1.areaVisibleMm2.toFixed(2)} vs teórico ${teo.toFixed(2)} mm² → error ${errPct.toFixed(2)} %`);

  // ── V3 · OCLUSIÓN CON ÁREA ANALÍTICA CONOCIDA ───────────────────────────────
  // caja 40×40×10 con caja 12×12×10 encima: desde arriba se esconden 12×12 = 144 mm²
  const Ps = [], Is = [];
  caja(0, 0, 0, 40, 40, 10, Ps, Is);
  caja(14, 14, 10, 26, 26, 20, Ps, Is);
  const torre = { positions: Float32Array.from(Ps), indices: Uint32Array.from(Is) };
  const vt = V.clasificarVisibilidad(torre, { res: 1024, vistas: [{ nombre: 'arriba', dir: [0, 0, -1] }] });
  const errOcl = Math.abs(vt.areaOcultaPorSiMismaMm2 - 144) / 144 * 100;
  check('V3 oclusión medida = huella analítica de la caja de encima (144 mm²)',
    errOcl < 5,
    `oculta=${vt.areaOcultaPorSiMismaMm2.toFixed(2)} vs 144.00 mm² → error ${errOcl.toFixed(2)} %`);

  // ── V4 · CONSERVACIÓN ───────────────────────────────────────────────────────
  let sumTri = 0; for (let i = 0; i < vt.areaTri.length; i++) sumTri += vt.areaTri[i];
  const cerrado = Math.abs(sumTri - vt.areaTotalMm2) < 1e-3;
  const noExcede = vt.areaVisibleMm2 + vt.areaOcultaPorSiMismaMm2 <= vt.areaTotalMm2 + 1e-6;
  check('V4 conservación: Σárea_tri = área_total y visible+oculta ≤ total',
    cerrado && noExcede,
    `Σtri=${sumTri.toFixed(2)} total=${vt.areaTotalMm2.toFixed(2)} vis+ocl=${(vt.areaVisibleMm2 + vt.areaOcultaPorSiMismaMm2).toFixed(2)}`);

  // ── V5 · CONVERGENCIA EN RESOLUCIÓN ─────────────────────────────────────────
  const r256 = V.clasificarVisibilidad(torre, { res: 256, vistas: [{ nombre: 'arriba', dir: [0, 0, -1] }] });
  const r512 = V.clasificarVisibilidad(torre, { res: 512, vistas: [{ nombre: 'arriba', dir: [0, 0, -1] }] });
  const d1 = Math.abs(r256.areaOcultaPorSiMismaMm2 - r512.areaOcultaPorSiMismaMm2);
  const d2 = Math.abs(r512.areaOcultaPorSiMismaMm2 - vt.areaOcultaPorSiMismaMm2);
  check('V5 convergencia: el área oculta se estabiliza al subir la resolución',
    d2 <= d1 + 1e-6 && d2 < 5,
    `256→512 Δ=${d1.toFixed(3)}  512→1024 Δ=${d2.toFixed(3)} mm² (debe encoger)`);

  // ── LA TAZA DEL LIBRO ───────────────────────────────────────────────────────
  const GEO = { rExt: 20, rInt: 18, h: 60, baseT: 2, rimR: 24, rimZ: 52, rimT: 3, n: 96 };
  const cup = taza(GEO);
  // V0 · la malla del fixture es sólida y con normales salientes. Si esto falla, todo
  // lo de abajo mide una pieza distinta a la que creo estar midiendo.
  const volTeo = Math.PI * (GEO.rExt ** 2 * GEO.h + (GEO.rimR ** 2 - GEO.rExt ** 2) * GEO.rimT
    - GEO.rInt ** 2 * (GEO.h - GEO.baseT));
  const volMed = volumen(cup);
  const errVol = Math.abs(volMed - volTeo) / volTeo * 100;
  check('V0 fixture: la taza es sólida cerrada con normales SALIENTES (volumen analítico)',
    volMed > 0 && errVol < 0.5,
    `V=${volMed.toFixed(1)} vs teórico ${volTeo.toFixed(1)} mm³ → error ${errVol.toFixed(3)} %`);

  const vcup = V.clasificarVisibilidad(cup, { res: 768 });

  // V6 · Fig 7.1 — gate EN la pared lateral vs. DEBAJO del reborde
  const gateEnPared = vcup.puntoVisible([GEO.rExt, 0, 30]);        // media altura, cara exterior
  const gateBajoReborde = vcup.puntoVisible([22, 0, GEO.rimZ]);    // cara inferior del reborde
  check('V6 §7.1.3 Fig 7.1 — gate EN la pared lateral cae en superficie VISIBLE (malo)',
    gateEnPared.visible === true,
    `vis=${gateEnPared.vis.toFixed(3)} desde [${gateEnPared.vistas.join(', ')}] → vestigio a la vista`);
  check('V6 §7.1.3 Fig 7.1 — gate DEBAJO del reborde cae en superficie NO visible (bueno)',
    gateBajoReborde.visible === false,
    `vis=${gateBajoReborde.vis.toFixed(3)} → "underneath a side wall", el libro lo recomienda`);

  // V7 · Fig 4.6 — partición cerca del labio vs. en la base del reborde
  const partLabio = vcup.puntoVisible([GEO.rExt, 0, 59]);          // exterior, junto al labio
  const partBaseReborde = gateBajoReborde;                          // bajo el reborde (mismo sitio)
  check('V7 §4.1.2 Fig 4.6 — partición junto al labio: superficie VISIBLE (malo)',
    partLabio.visible === true,
    `vis=${partLabio.vis.toFixed(3)} → "witness line and possible flash… unusable"`);
  check('V7 §4.1.2 Fig 4.6 — partición en la base del reborde: NO visible (bueno)',
    partBaseReborde.visible === false,
    `vis=${partBaseReborde.vis.toFixed(3)} → "a better location… at the bottom of the rim"`);

  // V8 · la cara de asiento nunca se ve
  const asiento = vcup.puntoVisible([10, 0, 0]);
  check('V8 la base de asiento (−Z) NUNCA es visible con las vistas de uso',
    asiento.visible === false,
    `vis=${asiento.vis.toFixed(3)}`);

  // controles negativos: que el oclusor no tape de más
  const interior = vcup.puntoVisible([5, 0, GEO.baseT]);
  check('control: el fondo INTERIOR de la taza sí se ve desde arriba',
    interior.visible === true,
    `vis=${interior.vis.toFixed(3)} (si diera oculto, el oclusor taparía de más)`);
  const rimArriba = vcup.puntoVisible([22, 0, GEO.rimZ + GEO.rimT]);
  check('control: la cara de ARRIBA del reborde sí se ve (mismo anillo, otra cara)',
    rimArriba.visible === true,
    `vis=${rimArriba.vis.toFixed(3)} — separa abajo/arriba a 3 mm: el predicado no confunde caras`);

  const pctVis = vcup.areaVisibleMm2 / vcup.areaTotalMm2 * 100;
  console.log(`\n  taza: ${(vcup.areaTotalMm2).toFixed(0)} mm² totales · ${pctVis.toFixed(1)} % visible · ` +
    `${vcup.areaOcultaPorSiMismaMm2.toFixed(0)} mm² tapados por la propia pieza · ${vcup.vistas.length} vistas`);

  // ── L21 · LA LÁMINA, Y EL PAR DEL LIBRO DIBUJADO ────────────────────────────
  const LV = await import(R('laminas-visuales.ts'));
  const fs = require('fs');
  const outDir = path.resolve(__dirname, '..', '_laminas');
  fs.mkdirSync(outDir, { recursive: true });

  // MALO (Fig 7.1 izquierda): compuerta EN la pared lateral + partición junto al labio
  // BUENO (Fig 7.1 derecha): compuerta y partición DEBAJO del reborde
  const anillo = (r, z, n) => Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI; return [r * Math.cos(a), r * Math.sin(a), z];
  });
  const casos = [
    { id: 'malo', et: 'MALO — Fig 7.1 "gating on side wall"', marcas: [
      { tipo: 'compuerta', nombre: 'compuerta en pared lateral', puntos: [[GEO.rExt, 0, 30]] },
      { tipo: 'particion', nombre: 'partición junto al labio', puntos: anillo(GEO.rExt, 59, 48) },
    ] },
    { id: 'bueno', et: 'BUENO — Fig 7.1 "gating below side wall"', marcas: [
      { tipo: 'compuerta', nombre: 'compuerta bajo el reborde', puntos: [[22, 0, GEO.rimZ]] },
      { tipo: 'particion', nombre: 'partición en la base del reborde', puntos: anillo(22, GEO.rimZ, 48) },
    ] },
  ];
  const res21 = {};
  for (const c of casos) {
    const ver = V.juzgarMarcas(vcup, c.marcas);
    const proy = V.proyectarParaLamina(cup, vcup, { vista: 5, ancho: 590, alto: 610, marcas: c.marcas, veredictos: ver });
    const lam = LV.laminaUsuario(proy, {
      nombre: `taza del libro — ${c.et}`,
      pctVisible: vcup.areaVisibleMm2 / vcup.areaTotalMm2 * 100,
      areaOcultaMm2: vcup.areaOcultaPorSiMismaMm2,
      veredictos: ver, vistasDeclaradas: vcup.vistasDeclaradas, nVistas: vcup.vistas.length,
    });
    fs.writeFileSync(path.join(outDir, `L21-${c.id}.svg`), lam.svg);
    res21[c.id] = ver.map((v) => v.estado);
  }
  check('L21 el par de la Fig 7.1: el MALO sale VIOLA en compuerta Y partición',
    res21.malo[0] === 'VIOLA' && res21.malo[1] === 'VIOLA',
    `compuerta=${res21.malo[0]} partición=${res21.malo[1]}`);
  check('L21 el par de la Fig 7.1: el BUENO sale CUMPLE en ambas',
    res21.bueno[0] === 'CUMPLE' && res21.bueno[1] === 'CUMPLE',
    `compuerta=${res21.bueno[0]} partición=${res21.bueno[1]}`);
  console.log(`\n  láminas en _laminas/L21-malo.svg y _laminas/L21-bueno.svg`);

  console.log(`\n${fails === 0 ? '✅ TODO VERDE' : `❌ ${fails} fallaron`}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({
    pass: fails === 0, fails,
    esferaErrPct: +errPct.toFixed(3), oclusionErrPct: +errOcl.toFixed(3),
    cuboOculta: vc.areaOcultaPorSiMismaMm2, tazaPctVisible: +pctVis.toFixed(2),
    gateEnPared: gateEnPared.visible, gateBajoReborde: gateBajoReborde.visible,
  }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.log('FATAL:', String((e && e.stack) || e).slice(0, 800)); process.exit(1); });
