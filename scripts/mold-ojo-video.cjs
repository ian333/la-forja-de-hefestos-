/**
 * VIDEO OVERALL DE EL OJO — renderiza las 22 vistas canónicas a cuadros 4K.
 * Cada lámina se monta en un escenario 1920×1080 (contain, centrada) con un
 * chip L# en la esquina; screenshot a deviceScaleFactor 2 → 3840×2160 exactos.
 * Orden = el flujo del LIBRO (pieza → partición → sección → llenado → venteo →
 * térmica → contracción → expulsión → estructura), no el número de lámina.
 */
const fs = require('fs');
const path = require('path');

const OJO = '/tmp/mold-ojo';
const LAM = path.resolve(__dirname, '..', '_laminas');
const OUT = path.resolve(__dirname, '..', '_overall');

const SLIDES = [
  { L: 'L13', tema: 'espesor de pared · §2.3.1', f: `${OJO}/espesor.svg` },
  { L: 'L12', tema: 'draft · §2.3.6', f: `${OJO}/draft.svg` },
  { L: 'L22', tema: 'undercuts · §2.3.7', f: `${OJO}/undercuts.svg` },
  { L: 'L21', tema: 'la ve el usuario · §7.1.3', f: `${OJO}/usuario.svg` },
  { L: 'L11', tema: 'partición a 5° · §4.1.3', f: `${LAM}/L11-bezel-crudo.svg` },
  { L: 'L2', tema: 'planta de partición · §4.3.1', f: `${OJO}/particion.svg` },
  { L: 'L4', tema: 'molde vs máquina · §4.3.3', f: `${OJO}/maquina.svg` },
  { L: 'L5', tema: 'sección por el sprue · Fig 1.6', f: `${LAM}/L5-bezel.svg` },
  { L: 'L7', tema: 'detalle de compuerta · §7.2', f: `${LAM}/L7-pin-point.svg` },
  { L: 'L14', tema: 'isócronas del frente · §5.5.4', f: `${OJO}/frente.svg` },
  { L: 'L15', tema: 'lay-flat a mano · §5.5.4', f: `${LAM}/L15-uniforme.svg` },
  { L: 'L8', tema: 'venteo · §8.2.3', f: `${OJO}/venteo.svg` },
  { L: 'L10', tema: 'circuito de agua · §9.2.7', f: `${OJO}/agua.svg` },
  { L: 'L9', tema: 'núcleo esbelto · Tabla 9.3', f: `${LAM}/L9-bueno.svg` },
  { L: 'L18', tema: 'térmica a 2 °C · Fig 9.11', f: `${OJO}/termica.svg` },
  { L: 'L16', tema: 'contracción · §10.1', f: `${OJO}/contraccion.svg` },
  { L: 'L17', tema: 'alabeo · §10.3.1', f: `${OJO}/alabeo.svg` },
  { L: 'L1', tema: 'expulsores vs agarre · §11.2.5', f: `${OJO}/carcasa-rpi4-stl-real-agarre.svg` },
  { L: 'L6', tema: 'apertura y expulsión · §11.4', f: `${LAM}/L6-caja-corredera.svg` },
  { L: 'L19', tema: 'von Mises · §12.1.1', f: `${LAM}/L19-vonmises.svg` },
  { L: 'L20', tema: 'deflexión vs venteo · §12.1.2', f: `${OJO}/deflexion.svg` },
  { L: 'L3', tema: 'placa de soporte · §12.2.3', f: `${OJO}/soporte.svg` },
];

const FONT = "'JetBrains Mono',monospace";
const page = (inner) => `<body style="margin:0;width:1920px;height:1080px;background:#0b0f16;font-family:${FONT};overflow:hidden">${inner}</body>`;

const INTRO = page(`
<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 130px;box-sizing:border-box">
  <div style="color:#c9a227;font-size:26px;font-weight:700;letter-spacing:.14em">LA FORJA · LA MÁQUINA DE MOLDES</div>
  <div style="color:#e9eef5;font-size:84px;font-weight:700;margin:26px 0 10px">EL OJO</div>
  <div style="color:#e9eef5;font-size:40px;font-weight:700;margin-bottom:34px">las 22 vistas del libro, dibujadas con nuestros datos</div>
  <div style="color:#8fa3bd;font-size:24px;line-height:1.75;max-width:1500px">
    Kazmer enseña comparando figuras — el molde bueno junto al malo. Estas láminas reproducen esas
    figuras con los datos MEDIDOS de cada pieza, con escala de color fija para contar contornos como
    los cuenta el libro. Cada una tiene su gate: geometría y física ANALÍTICAS, no números copiados.
  </div>
  <div style="color:#59d98c;font-size:26px;font-weight:700;margin-top:40px">22 vistas · 122 verificaciones del pliego · 8 gates · 359 checks en verde</div>
</div>`);

const OUTRO = page(`
<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 130px;box-sizing:border-box">
  <div style="color:#e9eef5;font-size:56px;font-weight:700;margin-bottom:36px">lo que EL OJO ya cazó</div>
  <div style="color:#c3d0e0;font-size:26px;line-height:2.0;max-width:1620px">
    · la altura del inserto usa un <span style="color:#ff5c5c">+22 fijo</span> — dos líneas de agua enfrían la placa, no el inserto<br>
    · la mejilla se dimensiona con el ⌀ estimado mientras el circuito rutea otro (⌀6.35 vs ⌀11.1)<br>
    · un <span style="color:#ff5c5c">Math.round</span> bajo un piso steel-safe — 1.99⌀ donde la Eq 9.22 pide 2⌀<br>
    · la carrera de expulsión no cabe en el housing: pide 57 mm, hay 31<br>
    · el pin contorneado de §11.2.5 cruza la línea de agua de §9.2 (la colisión de Fig 9.9)<br>
    · el espesor por esfera inscrita infla L_max 20 % en las esquinas
  </div>
  <div style="color:#c9a227;font-size:28px;font-weight:700;margin-top:44px">ninguno lo vio un número solo — todos salieron al DIBUJAR y MIRAR</div>
</div>`);

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome-stable', args: ['--no-sandbox'] });
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });

  const shot = async (html, name) => {
    await pg.setContent(html);
    await pg.screenshot({ path: path.join(OUT, name), clip: { x: 0, y: 0, width: 1920, height: 1080 }, timeout: 30000 });
    console.log('→', name);
  };

  await shot(INTRO, '00-intro.png');
  let n = 1;
  for (const s of SLIDES) {
    if (!fs.existsSync(s.f)) { console.log('❌ FALTA', s.f); process.exitCode = 2; continue; }
    const svg = fs.readFileSync(s.f, 'utf8');
    const html = page(`
      <div style="height:100%;display:flex;align-items:center;justify-content:center;padding:26px;box-sizing:border-box">
        <div style="max-width:100%;max-height:100%;display:flex">${svg.replace('<svg ', '<svg style="max-width:1868px;max-height:1028px;width:auto;height:100%" ')}</div>
      </div>
      <div style="position:absolute;top:24px;right:28px;background:#141a24;border:1px solid #c9a227;border-radius:6px;padding:10px 18px;color:#c9a227;font-size:22px;font-weight:700">${s.L} · ${s.tema} · ${n}/22</div>`);
    await shot(html, `${String(n).padStart(2, '0')}-${s.L}.png`);
    n++;
  }
  await shot(OUTRO, '23-outro.png');
  await browser.close();
  console.log(`listo: ${fs.readdirSync(OUT).filter((f) => f.endsWith('.png')).length} cuadros en ${OUT}`);
})().catch((e) => { console.log('FATAL', e.message); process.exit(1); });
