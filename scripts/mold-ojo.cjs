/**
 * EL OJO DEL MOLDE — genera las LÁMINAS visuales y las deja listas para juzgar.
 * ============================================================================
 * "el proceso está lleno de imágenes y verificaciones visuales y acá solo veo
 *  números" (user 2026-08-04). Cierto: el libro tiene 283 figuras y enseña
 * COMPARANDO diseños. Este script dibuja las figuras del libro con NUESTROS
 * datos y renderiza PNG + un MANIFIESTO para que un agente con ojos las juzgue
 * (mismo patrón que critic-eye.cjs para el cine).
 *
 * LA PRUEBA VISUAL: para cada pieza se dibuja el par del libro —
 *   Fig 11.10 (rejilla uniforme, el antipatrón NOMBRADO) contra
 *   Fig 11.11 (pines junto al agarre, lo que ahora hace la Máquina)
 * con la MISMA pieza y el MISMO número de pines. Si nuestro layout sirve, se
 * tiene que VER.
 *
 * Uso: node --import tsx scripts/mold-ojo.cjs [--out /tmp/mold-ojo]
 */
const path = require('path');
const fs = require('fs');

function arg(n, d) { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : d; }
const OUT = arg('--out', '/tmp/mold-ojo');

// caja abierta (fondo + 4 paredes) = la pieza de la Fig 11.11: la fuerza vive en las paredes
function boxAt(x0, y0, z0, x1, y1, z1) {
  const P = [x0,y0,z0, x1,y0,z0, x1,y1,z0, x0,y1,z0, x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1];
  const I = [0,2,1, 0,3,2,  4,5,6, 4,6,7,  0,1,5, 0,5,4,  2,3,7, 2,7,6,  3,0,4, 3,4,7,  1,2,6, 1,6,5];
  return { P, I };
}
function shellMesh(L, W, H, t) {
  const cajas = [boxAt(0,0,0, L,W,t), boxAt(0,0,t, t,W,H), boxAt(L-t,0,t, L,W,H), boxAt(t,0,t, L-t,t,H), boxAt(t,W-t,t, L-t,W,H)];
  const P = [], I = [];
  for (const c of cajas) { const off = P.length / 3; P.push(...c.P); I.push(...c.I.map((i) => i + off)); }
  return { positions: new Float32Array(P), indices: new Uint32Array(I) };
}

(async () => {
  const R = (p) => path.resolve(__dirname, '..', 'src', 'forja', 'mold', p);
  const { gripEjectorLayout } = await import(R('eject-layout.ts'));
  const { laminaExpulsores, laminasToHTML } = await import(R('laminas-visuales.ts'));
  const { parseSTL } = await import(R('stl.ts'));
  fs.mkdirSync(OUT, { recursive: true });

  // ── las piezas: una sintética con paredes claras + una REAL del banco ──
  const piezas = [{ nombre: 'concha 120×80×25', mesh: shellMesh(120, 80, 25, 4), pinDiaMm: 6, nPins: 12, wallMm: 4 }];
  const stl = path.resolve(__dirname, '..', 'test-parts', 'rpi4-bottom.stl');
  if (fs.existsSync(stl)) piezas.push({ nombre: 'carcasa RPi4 (STL real)', mesh: parseSTL(fs.readFileSync(stl).buffer), pinDiaMm: 8, nPins: 12, wallMm: 1.5 });

  const laminas = [];
  for (const p of piezas) {
    const g = gripEjectorLayout(p.mesh, { nPins: p.nPins, pinDiaMm: p.pinDiaMm, wallMm: p.wallMm });
    if (!g.grid) { console.log(`(salta ${p.nombre}: sin raster)`); continue; }
    // EL ANTIPATRÓN, con la MISMA pieza y el MISMO conteo: rejilla uniforme al
    // 15 % del borde — exactamente lo que hacía el colocador viejo (Fig 11.10).
    const b = g.grid, anchoMm = b.nx * b.sx, altoMm = b.ny * b.sy;
    const n = Math.max(1, g.positions.length || p.nPins);
    const nx = Math.max(2, Math.round(Math.sqrt(n))), ny = Math.ceil(n / nx);
    const rejilla = [];
    const mx = anchoMm * 0.15, my = altoMm * 0.15;
    for (let r = 0; r < ny && rejilla.length < n; r++) for (let c = 0; c < nx && rejilla.length < n; c++)
      rejilla.push({ x: b.x0 + mx + (c * (anchoMm - 2 * mx)) / Math.max(1, nx - 1),
                     y: b.y0 + my + (r * (altoMm - 2 * my)) / Math.max(1, ny - 1) });

    const slug = p.nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const mal = laminaExpulsores(g, { pinDiaMm: p.pinDiaMm, nombre: `${p.nombre} · REJILLA (antipatrón)`, posiciones: rejilla, modo: 'rejilla' });
    const bien = laminaExpulsores(g, { pinDiaMm: p.pinDiaMm, nombre: `${p.nombre} · POR AGARRE`, modo: 'agarre' });
    // ids ÚNICOS por pieza: con `expulsores-rejilla` a secas, la segunda pieza
    // sobreescribía a la primera y el par desaparecía (lo cazó la lámina misma)
    laminas.push({ ...mal, id: `${slug}-rejilla` }, { ...bien, id: `${slug}-agarre` });
    console.log(`${p.nombre}: ${g.nParedes} columnas de pared · ${g.positions.length} pines por agarre vs ${rejilla.length} en rejilla`);
  }

  // ── LÁMINA DEL AGUA §9.2.7 (TOP-1 del libro): la tríada 9.9→9.10→9.11 ──
  {
    const { laminaAgua } = await import(R('laminas-visuales.ts'));
    const { moldMachine } = await import(R('moldmachine.ts'));
    const { packageToAssemblySpec } = await import(R('mold-plano-set.ts'));
    const { coolingCircuit, plateDepth, plateDefs, cavityGrid, cavityFootprint } = await import(R('mold-drawing-set.ts'));
    const { plateStackZ } = await import(R('mold-plano-set.ts'));
    const { coordAudit } = await import(R('mold-coords.ts'));
    const vaso = moldMachine({ name: 'vaso Kazmer', Lmm: 100, Wmm: 100, Hmm: 60, cavityShape: 'round',
      surfaceMm2: 30000, volumeMm3: 60000, wallMm: 3, plastic: 'ABS', annualVolume: 200000, totalVolume: 1000000 });
    const s = packageToAssemblySpec(vaso);
    const D = plateDepth(s), z = plateStackZ(s), cc = coolingCircuit(s, D);
    const defs = plateDefs(s);
    const tA = defs.find((d) => d.role === 'A')?.thick ?? 40, tB = defs.find((d) => d.role === 'B')?.thick ?? 40;
    const { fy } = cavityFootprint(s), celdas = cavityGrid(s, D);
    // TODAS las impresiones que la sección corta (el molde es multi-cavidad):
    // medir contra una sola daba "136 mm de la impresión" con el canal pegado a otra
    const ysUnicos = [...new Set(celdas.map((c) => c.cy))].sort((a, b) => a - b);
    const impresiones = ysUnicos.map((y) => ({ y0: y - fy / 2, y1: y + fy / 2 }));
    const cy = celdas[0].cy;
    // los canales corren en X → en el corte perpendicular se ven como círculos
    const canales = [];
    for (const g of cc.segs) {
      if (g.y0 !== g.y1) continue;
      canales.push({ y: g.y0, z: z.A - Math.min(tB - cc.diaMm / 2 - 1, cc.zBehindMm), lado: 'B' });
    }
    if (cc.zAboveMm != null) canales.push({ y: cy, z: z.A + Math.min(cc.zAboveMm, tA - cc.diaMm / 2 - 1), lado: 'A' });
    const med = coordAudit(s).medidas;
    laminas.push(laminaAgua({
      nombre: `${s.name} · circuito real`, depthMm: D, zPart: z.A, tA, tB,
      impresiones, cavDepthMm: s.cavity.depthMm,
      // dónde vive la impresión: si la placa A la aloja (A ≳ prof), el macho SUBE
      ladoImpresion: tA >= s.cavity.depthMm ? 'A' : 'B',
      canales, diaMm: cc.diaMm, holguraMinMm: med.holguraAguaMm,
    }));
    console.log(`agua: ${canales.length} canales ⌀${cc.diaMm} · ${impresiones.length} impresiones · holgura ${med.holguraAguaMm} mm`);
  }

  // ── LÁMINA DEL FRENTE §5.5.4 (L14, la de mayor rendimiento del libro) ──
  {
    const { laminaFrente } = await import(R('laminas-visuales.ts'));
    const { flowFieldFromMesh } = await import(R('revisar-modelo.ts'));
    const { enumerarVenteos, clasificarCierres, frenteEnPlanta } = await import(R('venting-locations.ts'));
    // el VASO del libro: 100 mm de ancho, 60 de profundidad — el caso EXACTO de
    // §5.5.4 ("the 60 mm depth is more than one-half the 100 mm width")
    const Rv = 50, Hv = 60, Wv = 3;
    const P = [], I = [];
    const NSEG = 48;
    const anillo = (r, z, base) => { for (let a = 0; a < NSEG; a++) { const th = 2*Math.PI*a/NSEG; P.push(r*Math.cos(th), r*Math.sin(th), z); } return base; };
    // vaso = cilindro hueco: pared exterior, interior, fondo y borde
    let b0 = P.length/3; anillo(Rv, 0, b0); let b1 = P.length/3; anillo(Rv, Hv, b1);
    let b2 = P.length/3; anillo(Rv-Wv, Wv, b2); let b3 = P.length/3; anillo(Rv-Wv, Hv, b3);
    const quad = (a,b,c,d) => I.push(a,b,c, a,c,d);
    for (let a = 0; a < NSEG; a++) { const n = (a+1)%NSEG;
      quad(b0+a, b1+a, b1+n, b0+n);            // exterior
      quad(b2+a, b2+n, b3+n, b3+a);            // interior
      quad(b1+a, b3+a, b3+n, b1+n);            // borde superior
    }
    const cFondo = P.length/3; P.push(0,0,0); const cFondoT = P.length/3; P.push(0,0,Wv);
    for (let a = 0; a < NSEG; a++) { const n = (a+1)%NSEG;
      I.push(cFondo, b0+n, b0+a);              // fondo exterior
      I.push(cFondoT, b2+a, b2+n);             // fondo interior
    }
    const meshVaso = { positions: new Float32Array(P), indices: new Uint32Array(I) };
    const campo = flowFieldFromMesh(meshVaso, { wallMm: Wv, maxVoxels: 120000 });
    const plan = enumerarVenteos(campo, { nMaquinar: 8 });
    const cls = clasificarCierres(campo, plan.maquinar);
    const planta = frenteEnPlanta(campo);
    laminas.push(laminaFrente(planta, {
      nombre: 'vaso Kazmer ⌀100 × 60 (el caso de §5.5.4)',
      venteos: cls, profMm: Hv, anchoMm: 2 * Rv,
    }));
    console.log(`frente: campo ${campo.nx}×${campo.ny}×${campo.nz} · ${plan.nCandidatos} cierres · ${cls.filter(c=>c.interior).length} trampas de gas`);
  }

  // ── HTML + PNG por lámina (para que el OJO las abra con Read) ──
  const html = path.join(OUT, 'laminas.html');
  fs.writeFileSync(html, laminasToHTML(laminas, 'Láminas visuales del molde'));
  for (const l of laminas) fs.writeFileSync(path.join(OUT, `${l.id}.svg`), l.svg);

  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--headless=new', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width: 1040, height: 800 }, deviceScaleFactor: 2 });
  for (const l of laminas) {
    await page.setContent(`<body style="margin:0;background:#0b0f16">${l.svg}</body>`);
    await page.screenshot({ path: path.join(OUT, `${l.id}.png`), clip: { x: 0, y: 0, width: 1000, height: 760 } });
  }
  await browser.close();

  // ── EL MANIFIESTO para el agente con ojos ──
  const brief = [
    '# OJO DEL MOLDE — láminas a juzgar',
    '',
    'El libro de Kazmer enseña COMPARANDO figuras. Estas láminas se dibujan con los',
    'datos REALES de la Máquina. Ábrelas con Read (son PNG, las vas a VER) y júzgalas',
    'contra el criterio del libro que cada una declara.',
    '',
    ...laminas.flatMap((l) => [
      `## ${l.titulo}`,
      `- **Cita:** ${l.cita}`,
      `- **Imagen:** ${path.join(OUT, `${l.id}.png`)}`,
      `- **Qué mirar:** ${l.queMirar}`,
      '',
    ]),
    '## El veredicto que se espera',
    'Para cada PAR (rejilla vs agarre) de la misma pieza: ¿se VE la diferencia que el',
    'libro describe? ¿los pines "por agarre" caen junto a las zonas ámbar y los de',
    '"rejilla" quedan tirados en el gris? Si NO se ve, nuestro layout no sirve por más',
    'que los números digan que sí.',
  ].join('\n');
  fs.writeFileSync(path.join(OUT, 'ojo-brief.md'), brief);

  // ── EL GATE DEL JUICIO VISUAL ────────────────────────────────────────────
  // Lo que protege: que el veredicto de la lámina NO MIENTA. La primera versión
  // pintaba VERDE "los pines JUNTO al agarre ✓" sobre una rejilla con los pines
  // tirados en el centro (umbral keepOut+8 inventado). Un juez visual que aprueba
  // el antipatrón del libro es peor que no tenerlo.
  let fails = 0;
  const check = (n, c, d) => { console.log(` ${c ? '✓' : '❌'} ${n} — ${d}`); if (!c) fails++; };
  const veredicto = (l) => (/✗/.test(l.svg) ? 'MAL' : /✓ los/.test(l.svg) ? 'BIEN' : 'plana');
  // los pares de expulsores van de dos en dos; las demás láminas se juzgan aparte
  const pares = laminas.filter((l) => /-rejilla$|-agarre$/.test(l.id));
  let distinguio = 0;
  for (let i = 0; i < pares.length; i += 2) {
    const rej = pares[i], agr = pares[i + 1];
    if (!agr) break;
    const pieza = rej.titulo.replace(/ · REJILLA.*/, '').replace('Planta del núcleo · expulsores — ', '');
    // El layout POR AGARRE debe aprobar SIEMPRE: es lo que la Máquina produce.
    check(`${pieza}: el layout POR AGARRE aprueba (Fig 11.11)`,
      veredicto(agr) === 'BIEN', `veredicto ${veredicto(agr)}`);
    // La rejilla NO siempre reprueba, y exigirlo sería MENTIR al revés: en una
    // pieza ANGOSTA la rejilla al 15 % ya cae junto a las paredes (RPi4: huella
    // de 64 mm, pines a 9.6 mm del borde, límite 21.1). El antipatrón §11.2.5
    // duele donde hay distancia que recorrer. Se reporta, no se exige.
    if (veredicto(rej) === 'MAL') distinguio++;
    console.log(`   · ${pieza}: rejilla ${veredicto(rej)} vs agarre ${veredicto(agr)}${veredicto(rej) === 'BIEN' ? ' (pieza angosta: la rejilla también cae junto al agarre — verdad geométrica)' : ''}`);
  }
  check('la lámina DISTINGUE el antipatrón en al menos una pieza (si nunca reprobara, sería un sello)',
    distinguio >= 1, `${distinguio} de ${pares.length / 2} pares con rejilla reprobada`);
  check('cada lámina cita el libro (§) y dice qué mirar',
    laminas.every((l) => /§\d+\.\d/.test(l.cita) && l.queMirar.length > 30),
    laminas.map((l) => l.cita.split(' ·')[0]).join(', '));
  check('la lámina del AGUA juzga la tríada §9.2.7 (choca / lejos / bien), no solo choques',
    laminas.some((l) => l.id === 'agua' && /Fig 9\.9/.test(l.cita) && /9\.10/.test(l.svg + l.queMirar)),
    laminas.find((l) => l.id === 'agua') ? 'presente' : 'AUSENTE');
  check('los PNG existen y pesan (se pueden abrir con ojos)',
    laminas.every((l) => fs.statSync(path.join(OUT, `${l.id}.png`)).size > 20000), 'todos >20 KB');

  console.log(`\n${fails === 0 ? '✅' : '❌'} ${laminas.length} láminas → ${OUT}`);
  console.log(`   manifiesto: ${path.join(OUT, 'ojo-brief.md')}`);
  console.log('VERIFY_RESULT=' + JSON.stringify({ pass: fails === 0, fails, laminas: laminas.map((l) => l.id) }));
  process.exit(fails === 0 ? 0 : 2);
})().catch((e) => { console.error('FATAL', String(e && e.stack || e).slice(0, 600)); process.exit(1); });
