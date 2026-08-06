/**
 * "Cómo sabemos que es verdad" — 14 escenas, 4K 3840×2160, MUDO con texto en pantalla.
 * Plan aprobado: _story/plan.html. Los números son MEDIDOS (ver `fuente` de cada escena).
 *
 * Escenas ESTÁTICAS: se rinde 1 PNG por card (20 cards) y el ensamble usa el demuxer
 * `concat` con `duration` (un decode por card, no por cuadro).
 *
 * Receta canónica: viewport 1920×1080 + deviceScaleFactor 2 → 3840×2160 exactos.
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OJO = '/tmp/mold-ojo';
const LAM = path.join(ROOT, '_laminas');
const OUT = path.join(ROOT, '_verdad', 'cards');

const GOLD = '#c9a227', INK = '#e9eef5', MUT = '#8fa3bd', BAD = '#ff5c5c',
      OK = '#59d98c', WARN = '#ffb347', GROUND = '#0b0f16', HAIR = '#243044',
      PANEL = '#141a24';
const F = "'JetBrains Mono','DejaVu Sans Mono',monospace";

/* ---------- las 22 vistas, en el orden del LIBRO (= scripts/mold-ojo-video.cjs) ---------- */
const VISTAS = [
  { L: 'L13', t: 'espesor de pared',      f: `${OJO}/espesor.png`,   g: 0 },
  { L: 'L12', t: 'draft',                 f: `${OJO}/draft.png`,     g: 0 },
  { L: 'L22', t: 'undercuts',             f: `${OJO}/undercuts.png`, g: 0 },
  { L: 'L21', t: 'la ve el usuario',      f: `${OJO}/usuario.png`,   g: 0 },
  { L: 'L11', t: 'partición a 5°',        f: `${LAM}/L11-bezel-crudo.png`, g: 1 },
  { L: 'L2',  t: 'planta de partición',   f: `${OJO}/particion.png`, g: 1 },
  { L: 'L4',  t: 'molde vs máquina',      f: `${OJO}/maquina.png`,   g: 1 },
  { L: 'L5',  t: 'sección por el sprue',  f: `${LAM}/L5-bezel.png`,  g: 1 },
  { L: 'L7',  t: 'detalle de compuerta',  f: `${LAM}/L7-pin-point.png`, g: 2 },
  { L: 'L14', t: 'isócronas del frente',  f: `${OJO}/frente.png`,    g: 2 },
  { L: 'L15', t: 'lay-flat a mano',       f: `${LAM}/L15-uniforme.png`, g: 2 },
  { L: 'L8',  t: 'venteo',                f: `${OJO}/venteo.png`,    g: 2 },
  { L: 'L10', t: 'circuito de agua',      f: `${OJO}/agua.png`,      g: 2 },
  { L: 'L9',  t: 'núcleo esbelto',        f: `${LAM}/L9-bueno.png`,  g: 2 },
  { L: 'L18', t: 'térmica a 2 °C',        f: `${OJO}/termica.png`,   g: 2 },
  { L: 'L16', t: 'contracción',           f: `${OJO}/contraccion.png`, g: 3 },
  { L: 'L17', t: 'alabeo',                f: `${OJO}/alabeo.png`,    g: 3 },
  { L: 'L1',  t: 'expulsores vs agarre',  f: `${OJO}/carcasa-rpi4-stl-real-agarre.png`, g: 3 },
  { L: 'L6',  t: 'apertura y expulsión',  f: `${LAM}/L6-caja-corredera.png`, g: 3 },
  { L: 'L19', t: 'von Mises',             f: `${LAM}/L19-vonmises.png`, g: 3 },
  { L: 'L20', t: 'deflexión vs venteo',   f: `${OJO}/deflexion.png`, g: 3 },
  { L: 'L3',  t: 'placa de soporte',      f: `${OJO}/soporte.png`,   g: 3 },
];
const GRUPOS = [
  'pieza — lo que el molde tiene que copiar',
  'partición y sección — dónde se abre el acero',
  'llenado · venteo · térmica — lo que pasa adentro',
  'contracción · expulsión · estructura — lo que aguanta',
];

/* ---------------------------- chasis de página ---------------------------- */
const page = (inner, extra = '') => `<!doctype html><meta charset="utf-8">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{width:1920px;height:1080px;background:${GROUND};color:${INK};
       font-family:${F};overflow:hidden;position:relative;
       -webkit-font-smoothing:antialiased}
  b{font-weight:700}
  .gold{color:${GOLD}} .mut{color:${MUT}} .bad{color:${BAD}} .ok{color:${OK}} .warn{color:${WARN}}
  ${extra}
</style><body>${inner}</body>`;

/* barra de acto + reloj, común a las escenas con lámina */
const cinta = (acto, tc) => `
<div style="position:absolute;left:44px;right:44px;bottom:20px;display:flex;
            justify-content:space-between;font-size:15px;color:#54657d;letter-spacing:.09em">
  <span>LA FORJA · LA MÁQUINA DE MOLDES · cómo sabemos que es verdad</span>
  <span>${acto} &nbsp;·&nbsp; ${tc}</span>
</div>`;

/* Escena con lámina: lámina contenida a la izquierda, riel de texto a la derecha. */
function conLamina({ svg, acto, tc, titulo, cuerpo, rotulo, dato, tags = [], fuente, tsize = 38 }) {
  const tagHtml = tags.map((t) => {
    const c = t.k === 'bad' ? BAD : t.k === 'ok' ? OK : t.k === 'warn' ? WARN : MUT;
    const b = t.k === 'mut' ? HAIR : c;
    return `<span style="border:1px solid ${b};color:${c};font-size:14px;font-weight:700;
            padding:4px 10px;border-radius:2px;letter-spacing:.03em">${t.t}</span>`;
  }).join('');
  return page(`
<div style="position:absolute;inset:0;display:flex;padding:34px 44px 52px;gap:30px">
  <!-- lámina -->
  <div style="width:1310px;flex:none;display:flex;align-items:center;justify-content:center">
    ${svg.replace('<svg ', '<svg style="max-width:1310px;max-height:994px;width:auto;height:auto" ')}
  </div>
  <!-- riel -->
  <div style="flex:1;display:flex;flex-direction:column;padding-top:8px">
    <div style="color:${GOLD};font-size:15px;font-weight:700;letter-spacing:.17em">${acto}</div>
    <div style="font-size:${tsize}px;font-weight:700;line-height:1.16;margin:14px 0 0;letter-spacing:-.01em">${titulo}</div>
    <div style="height:2px;background:${HAIR};margin:20px 0 18px"></div>
    <div style="color:#b6c6da;font-size:19px;line-height:1.72">${cuerpo}</div>
    <div style="flex:1"></div>
    <div style="border-left:3px solid ${GOLD};padding:12px 0 12px 16px;background:rgba(201,162,39,.055)">
      <div style="color:${MUT};font-size:13px;letter-spacing:.15em;margin-bottom:8px">${rotulo}</div>
      <div style="font-size:26px;font-weight:700;line-height:1.42">${dato}</div>
    </div>
    ${tags.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:16px">${tagHtml}</div>` : ''}
    <div style="color:#54657d;font-size:14px;margin-top:16px;line-height:1.55">${fuente}</div>
  </div>
</div>${cinta(acto, tc)}`);
}

/* ------------------------------- las cards ------------------------------- */
const cards = [];   // { name, seconds, html }
const add = (name, seconds, html) => cards.push({ name, seconds, html });

/* 1 · 0:00 · 5 s — TÍTULO (sin música, sin logo) */
add('01-titulo', 5, page(`
<div style="height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 150px">
  <div style="color:${GOLD};font-size:22px;font-weight:700;letter-spacing:.22em">LA FORJA · LA MÁQUINA DE MOLDES</div>
  <div style="font-size:96px;font-weight:700;margin:34px 0 0;letter-spacing:-.02em;line-height:1.06">Cómo sabemos<br>que es verdad</div>
  <div style="width:210px;height:3px;background:${GOLD};margin:44px 0 40px"></div>
  <div style="color:${MUT};font-size:26px;line-height:1.7;max-width:1250px">
    Ya teníamos las 22 láminas del libro. Esto es lo que vino después: construir el
    instrumento que revisa al instrumento — y lo que encontró dentro de nuestro propio código.
  </div>
</div>`));

/* 2 · 0:05 · 12 s — LAS 22 VISTAS EN BARRIDO (4 sub-cards × 3 s) */
for (let g = 0; g < 4; g++) {
  const celdas = VISTAS.map((v) => {
    const on = v.g === g;
    return `<div style="border:1px solid ${on ? GOLD : HAIR};border-radius:3px;overflow:hidden;
                background:${PANEL};opacity:${on ? 1 : 0.26};position:relative;min-height:0;min-width:0;
                display:flex;flex-direction:column">
      <div style="flex:1;min-height:0;overflow:hidden;display:flex;align-items:center;justify-content:center;background:${GROUND}">
        <img src="file://${v.f}" style="width:100%;height:100%;object-fit:cover;object-position:center top">
      </div>
      <div style="font-size:12px;padding:4px 7px;color:${on ? GOLD : MUT};white-space:nowrap;
                  overflow:hidden;text-overflow:ellipsis;border-top:1px solid ${on ? GOLD : HAIR}">
        <b>${v.L}</b> ${v.t}</div>
    </div>`;
  }).join('');
  add(`02-barrido-${g + 1}`, 3, page(`
<div style="position:absolute;inset:0;padding:30px 44px 52px;display:flex;flex-direction:column">
  <div style="display:flex;justify-content:space-between;align-items:baseline">
    <div>
      <span style="color:${GOLD};font-size:15px;font-weight:700;letter-spacing:.17em">ACTO 1 — LO QUE YA SE VE</span>
      <span style="font-size:26px;font-weight:700;margin-left:18px">Las 22 vistas del libro, dibujadas con nuestros datos</span>
    </div>
    <div style="color:${OK};font-size:19px;font-weight:700">22 vistas · 122 verificaciones · 359 checks en verde</div>
  </div>
  <div style="color:${GOLD};font-size:20px;font-weight:700;margin:14px 0 12px">
    ${'▍'} ${GRUPOS[g]}</div>
  <div style="flex:1;min-height:0;display:grid;grid-template-columns:repeat(6,1fr);
              grid-template-rows:repeat(4,minmax(0,1fr));gap:11px">
    ${celdas}
  </div>
</div>${cinta('ACTO 1', '0:05')}`));
}

/* 3 · 0:17 · 8 s — LA LÁMINA QUE DESTAPA EL DEFECTO */
add('03-L5', 8, conLamina({
  svg: fs.readFileSync(`${LAM}/L5-bezel.svg`, 'utf8'),
  acto: 'ACTO 1 — LO QUE YA SE VE', tc: '0:17',
  titulo: 'La lámina que destapa el defecto',
  cuerpo: `Las dos líneas de agua azules quedan <b>arriba</b> del lomo del inserto:
           enfrían la placa, no el inserto. El dibujo lo hace obvio; la tabla de números no.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `<span class="bad">V4.7 VIOLA</span> — el inserto usa<br>un <span class="bad">+22 fijo</span> en vez de 3·⌀`,
  tags: [{ k: 'bad', t: 'defecto real' }, { k: 'mut', t: 'L5 · §4.2.1' }],
  fuente: 'L5-bezel · sección por el eje del sprue, molde cerrado',
}));

/* 4 · 0:25 · 10 s — CUANDO EL DIBUJO MIENTE */
add('04-L7', 10, conLamina({
  svg: fs.readFileSync(`${LAM}/L7-pin-point.svg`, 'utf8'),
  acto: 'ACTO 2 — EL PROBLEMA', tc: '0:25',
  titulo: 'Cuando el dibujo miente',
  cuerpo: `El modelo estaba bien. Los números estaban bien. Pero las cotas del cono
           estaban cruzadas, y la lámina decía que el reverse taper iba al revés —
           justo el veredicto que esa lámina existe para dar.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `⌀1.62 arriba · ⌀1.20 abajo<br><span class="bad">invertidas</span>`,
  tags: [{ k: 'bad', t: 'solo se vio mirando' }, { k: 'mut', t: 'L7 · Fig 7.1' }],
  fuente: 'L7-pin-point · detalle de la compuerta',
}));

/* 5 · 0:35 · 6 s — LA REGLA */
add('05-regla', 6, conLamina({
  svg: fs.readFileSync(`${LAM}/FIDUCIAL-arnes.svg`, 'utf8'),
  acto: 'ACTO 2 — EL PROBLEMA', tc: '0:35',
  titulo: 'La regla del render corrupto',
  cuerpo: `Tira de control: el mismo objeto renderizado bien, espejeado, y girado 12°.
           Si no distingues cuál es cuál, esa imagen no prueba nada.`,
  rotulo: 'EN PANTALLA',
  dato: `Si la versión corrupta se ve igual,<br>la imagen <span class="bad">NO es evidencia</span>`,
  tags: [{ k: 'ok', t: 'triada + cubo + esfera' }, { k: 'mut', t: 'arnés de render 3D' }],
  fuente: 'FIDUCIAL-arnes · fiducial de calibración',
}));

/* 6 · 0:41 · 12 s — FABRICAR LA RESPUESTA (MMS) */
add('06-MMS', 12, conLamina({
  svg: fs.readFileSync(`${LAM}/MMS-convergencia.svg`, 'utf8'),
  acto: 'ACTO 3 — EL TRUCO', tc: '0:41',
  titulo: 'Fabricar la respuesta',
  cuerpo: `No existe solución exacta para una carcasa real, así que se inventa una:
           se propone la respuesta, se sustituye en la ecuación para sacar el término
           fuente, y la respuesta exacta queda garantizada por construcción.
           En cualquier geometría.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `orden <span class="ok">1.981</span> sobre una carcasa<br>Hammond <b>REAL</b> (teórico 2)`,
  tags: [{ k: 'ok', t: 'MMS' }, { k: 'mut', t: 'Roache · ASME V&V 20' }],
  fuente: 'scripts/verif-mms-termico-test.cjs · thermal-steady.ts',
}));

/* 7 · 0:53 · 8 s — LOS CONTROLES NEGATIVOS (tarjeta) */
add('07-negativos', 8, page(`
<div style="position:absolute;inset:0;padding:52px 90px 62px;display:flex;flex-direction:column">
  <div style="color:${GOLD};font-size:15px;font-weight:700;letter-spacing:.17em">ACTO 3 — EL TRUCO</div>
  <div style="font-size:52px;font-weight:700;margin:16px 0 10px">Los controles negativos</div>
  <div style="color:${MUT};font-size:23px;line-height:1.65;max-width:1500px">
    Se meten bugs a propósito y se mira la pendiente. Un arnés que no reprueba no es un
    arnés: es un sello. Estos cuatro <b style="color:${INK}">tenían</b> que caerse de la recta h² — y se cayeron.
  </div>
  <div style="flex:1;min-height:0;display:grid;grid-template-columns:1fr 1fr;
              grid-template-rows:repeat(2,minmax(0,1fr));gap:20px;margin:24px 0 20px">
    ${[
      ['signo del operador', '0.014', 'error ×1028 contra la exacta', BAD],
      ['CF en el nodo de adentro', '0.91', 'se cae de la recta h²', WARN],
      ['índice corrido una celda', '—', 'la pendiente lo delata igual', WARN],
      ['dato en la CARA del vóxel', '1.29', 'vs 1.99 con la celda cortada', WARN],
    ].map(([b, o, v, c]) => `
    <div style="border:1px solid ${HAIR};border-left:3px solid ${c};border-radius:3px;
                background:${PANEL};padding:24px 30px;display:flex;flex-direction:column;
                justify-content:center;min-height:0">
      <div style="color:${MUT};font-size:15px;letter-spacing:.14em;margin-bottom:10px">BUG PLANTADO</div>
      <div style="color:${INK};font-size:29px;font-weight:700;margin-bottom:14px">${b}</div>
      <div style="display:flex;align-items:baseline;gap:18px">
        <div style="color:${c};font-size:62px;font-weight:700;font-variant-numeric:tabular-nums;line-height:1">${o}</div>
        <div style="color:${c};font-size:21px">${v}</div>
      </div>
    </div>`).join('')}
  </div>
  <div style="display:flex;gap:44px;align-items:center">
    <div style="border-left:3px solid ${GOLD};padding:10px 0 10px 16px">
      <div style="color:${MUT};font-size:13px;letter-spacing:.15em;margin-bottom:6px">EL NÚMERO QUE ATERRIZA</div>
      <div style="font-size:28px;font-weight:700">signo del operador → orden <span class="bad">0.014</span> · error <span class="bad">×1028</span></div>
    </div>
    <div style="display:flex;gap:10px">
      <span style="border:1px solid ${WARN};color:${WARN};font-size:16px;font-weight:700;padding:6px 12px;border-radius:2px">4 bugs plantados</span>
      <span style="border:1px solid ${OK};color:${OK};font-size:16px;font-weight:700;padding:6px 12px;border-radius:2px">4 cazados</span>
    </div>
  </div>
</div>${cinta('ACTO 3', '0:53')}`));

/* 8 · 1:01 · 8 s — KIRSCH */
add('08-kirsch', 8, conLamina({
  svg: fs.readFileSync(`${LAM}/L19-vonmises.svg`, 'utf8'),
  acto: 'ACTO 3 — EL TRUCO', tc: '1:01',
  titulo: 'La vara que no se discute',
  cuerpo: `Placa infinita con agujero a tracción: la teoría dice que el esfuerzo se
           triplica en el borde. Exacto, desde 1898. Si el solver no lo reproduce,
           no sirve para juzgar barrenos.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `Kirsch <span class="ok">Kt = 3.00264</span><br>error <span class="ok">0.088 %</span> · orden <b>2.46</b>`,
  tags: [{ k: 'ok', t: 'elasticidad analítica' }, { k: 'mut', t: 'Kirsch 1898' }],
  fuente: 'L19-vonmises · el mapa que este solver tiene permiso de dibujar',
}));

/* 9 · 1:09 · 6 s — LA BARRA DE ERROR (los timecodes del plan mandan: 1:09 → 1:15) */
add('09-GCI', 6, conLamina({
  svg: fs.readFileSync(`${LAM}/GCI-banda.svg`, 'utf8'),
  acto: 'ACTO 3 — EL TRUCO', tc: '1:09',
  titulo: 'La barra de error',
  cuerpo: `Moldflow calcula esto y no se lo pone al cliente en la mano. Aquí el número
           se entrega con su incertidumbre — y cuando la malla no alcanza, la lámina
           lo dice en vez de fingir precisión.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `σ_max <span class="warn">590.8 ± 92.9 MPa</span> (95 %)<br>y <span class="bad">FUERA</span> de rango asintótico`,
  tags: [{ k: 'warn', t: 'banda indicativa' }, { k: 'mut', t: 'GCI · Roache' }],
  fuente: 'scripts/verif-gci-test.cjs · GCI-banda',
}));

/* 10 · 1:15 · 10 s — EIKONAL */
add('10-eikonal', 10, conLamina({
  svg: fs.readFileSync(`${LAM}/CELDA-CORTADA.svg`, 'utf8'),
  acto: 'ACTO 4 — LO QUE CAZAMOS', tc: '1:15',
  // el riel mide ~492 css px: a 29 px caben los 26 caracteres de la 1ª línea
  // sin dejar "bien" huérfano en un renglón solo.
  titulo: 'Un campo con el signo bien<br>no es una distancia', tsize: 29,
  cuerpo: `La prueba es la ecuación eikonal: en un campo de distancia de verdad,
           |grad phi| vale exactamente 1 en todos lados. La aproximación de losa
           en z que veníamos usando no se acercaba.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `sdf 3D <span class="ok">0.00166</span> · losa en z <span class="bad">1.08</span><br><span class="bad">650× peor</span>`,
  tags: [{ k: 'ok', t: 'C1 cumple' }, { k: 'bad', t: 'C2 la losa no' }],
  fuente: 'scripts/verif-sdf-malla-test.cjs · C1/C2 · |grad phi|−1 medio',
}));

/* 11 · 1:25 · 10 s — EL CENSO DEL BANCO */
add('11-matricula', 10, conLamina({
  svg: fs.readFileSync(`${LAM}/MATRICULA-banco.svg`, 'utf8'),
  acto: 'ACTO 4 — LO QUE CAZAMOS', tc: '1:25',
  titulo: 'El censo del banco',
  cuerpo: `Cada malla reducida a cinco números. Recorrido por las 73 piezas reales
           del banco de inyección, con las incoherentes encendiéndose en rojo.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `<span class="bad">5 de 73</span> rotas — 2 eran culpa<br>del teselado, 3 de la pieza`,
  tags: [{ k: 'bad', t: 'el DFM corría sobre ellas' }, { k: 'ok', t: '70/73 hoy' }],
  fuente: 'scripts/verif-matricula-test.cjs · MATRICULA-banco',
}));

/* 12 · 1:35 · 14 s — SIETE DEFECTOS (3 sub-cards que escriben la lista) */
const DEFECTOS = [
  ['1', 'altura del inserto', 'un <b>+22 fijo</b> en vez de 3·⌀ — el agua enfría la placa, no el inserto'],
  ['2', 'mejilla vs circuito', 'se dimensiona con el ⌀ estimado mientras el circuito rutea otro (⌀6.35 vs ⌀11.1)'],
  ['3', 'piso steel-safe', 'un <b>Math.round</b> debajo — 1.99⌀ donde la Eq 9.22 pide 2⌀'],
  ['4', 'carrera de expulsión', 'pide 57 mm y en el housing hay 31'],
  ['5', 'pin contorneado', 'cruza la línea de agua de §9.2 — la colisión de Fig 9.9'],
  ['6', 'espesor por esfera', 'infla L_max 20 % en las esquinas'],
  ['7', 'check C3 de convergencia', 'reportaba convergencia refinando <b>0.44 %</b> donde el parámetro que manda mueve <b>8.08 %</b>'],
];
for (let k = 0; k < 3; k++) {
  const hasta = [3, 5, 7][k];
  const filas = DEFECTOS.map(([n, q, d], i) => {
    const on = i < hasta;
    const enChecks = i >= 3;   // 4 de los 7 viven dentro de checks de calidad
    return `<div style="display:flex;gap:22px;align-items:baseline;padding:29px 0;
              border-top:1px solid ${HAIR};opacity:${on ? 1 : 0.14}">
      <div style="color:${enChecks ? WARN : BAD};font-size:24px;font-weight:700;width:36px;flex:none">${n}</div>
      <div style="color:${INK};font-size:25px;font-weight:700;width:420px;flex:none">${q}</div>
      <div style="color:#b6c6da;font-size:23px;line-height:1.5;flex:1">${on ? d : ''}</div>
    </div>`;
  }).join('');
  add(`12-defectos-${k + 1}`, [5, 4, 5][k], page(`
<div style="position:absolute;inset:0;padding:48px 90px 62px;display:flex;flex-direction:column">
  <div style="color:${GOLD};font-size:15px;font-weight:700;letter-spacing:.17em">ACTO 4 — LO QUE CAZAMOS</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin:14px 0 8px">
    <div style="font-size:48px;font-weight:700">Siete defectos en código que dábamos por bueno</div>
    <div style="font-size:44px;font-weight:700;color:${BAD};font-variant-numeric:tabular-nums">${hasta}<span style="color:${MUT};font-size:26px">/7</span></div>
  </div>
  <div style="color:${MUT};font-size:21px;line-height:1.6;max-width:1560px;margin-bottom:12px">
    Ninguno se encontró mirando. Cuatro vivían dentro de <b style="color:${WARN}">checks de calidad</b> —
    que es donde nadie mira, porque cuando salen verdes uno sigue adelante.
  </div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center">${filas}</div>
  ${hasta === 7 ? `<div style="border-left:3px solid ${GOLD};padding:11px 0 11px 16px;margin-top:6px">
    <div style="color:${MUT};font-size:13px;letter-spacing:.15em;margin-bottom:6px">EL NÚMERO QUE ATERRIZA</div>
    <div style="font-size:26px;font-weight:700">C3 reportaba convergencia refinando <span class="bad">0.44 %</span>
      donde el parámetro que manda mueve <span class="bad">8.08 %</span></div>
  </div>` : `<div style="height:96px"></div>`}
</div>${cinta('ACTO 4', '1:35')}`));
}

/* 13 · 1:49 · 10 s — LA CADENA TÉRMICA */
add('13-termica', 10, conLamina({
  svg: fs.readFileSync(`${LAM}/L9-bueno.svg`, 'utf8'),
  acto: 'ACTO 4 — LO QUE CAZAMOS', tc: '1:49',
  titulo: 'La cadena térmica',
  cuerpo: `Tres capas, cada una visible solo después de quitar la de encima: se arregla
           la posición de la interfaz y no mejora nada; el error real era el volumen;
           y al arreglar el volumen aparece que la rejilla no resuelve la pared.`,
  rotulo: 'EL NÚMERO QUE ATERRIZA',
  dato: `celda <span class="bad">7 mm</span> · pared <span class="bad">1.5 mm</span><br>
         el <span class="bad">100 %</span> de los vóxeles "plástico"<br>tienen el centro FUERA de la pared`,
  tags: [{ k: 'warn', t: '3 capas encadenadas' }, { k: 'mut', t: 'mold-thermal-fdm' }],
  fuente: 'L9-bueno · sección del inserto de núcleo · dispositivo de enfriamiento',
}));

/* 14 · 1:59 · 10 s — CIERRE */
const HECHO = [
  'MMS sobre carcasa real — orden 1.981',
  'Kirsch Kt = 3.00264 · error 0.088 %',
  'GCI con banda al 95 % en la lámina',
  'arnés de render 3D con control negativo',
  'matrícula de malla — 70/73 del banco',
  'SDF 3D que cumple la eikonal (650× mejor)',
];
const FALTA = [
  'la rejilla no resuelve la pared de 1.5 mm',
  'σ_max 590.8 MPa sigue FUERA de rango asintótico',
  '3 piezas del banco siguen rotas de origen',
  'el +22 fijo del inserto sigue sin corregir',
  'ensamble genérico del molde, sin módulo',
];
add('14-cierre', 10, page(`
<div style="position:absolute;inset:0;padding:56px 90px 62px;display:flex;flex-direction:column">
  <div style="color:${GOLD};font-size:15px;font-weight:700;letter-spacing:.17em">ACTO 5 — DÓNDE ESTAMOS</div>
  <div style="flex:1;display:flex;gap:70px;margin-top:34px">
    <div style="flex:1">
      <div style="color:${OK};font-size:26px;font-weight:700;letter-spacing:.06em;
                  border-bottom:2px solid ${OK};padding-bottom:12px">VERIFICADO</div>
      ${HECHO.map((h) => `<div style="display:flex;gap:16px;font-size:24px;line-height:1.5;
        color:#c3d0e0;padding:26px 0;border-bottom:1px solid ${HAIR}">
        <span style="color:${OK}">✓</span><span>${h}</span></div>`).join('')}
    </div>
    <div style="flex:1">
      <div style="color:${WARN};font-size:26px;font-weight:700;letter-spacing:.06em;
                  border-bottom:2px solid ${WARN};padding-bottom:12px">ABIERTO</div>
      ${FALTA.map((h) => `<div style="display:flex;gap:16px;font-size:24px;line-height:1.5;
        color:#c3d0e0;padding:26px 0;border-bottom:1px solid ${HAIR}">
        <span style="color:${WARN}">·</span><span>${h}</span></div>`).join('')}
    </div>
  </div>
  <div style="text-align:center;margin-top:40px">
    <div style="width:150px;height:3px;background:${GOLD};margin:0 auto 30px"></div>
    <div style="font-size:66px;font-weight:700;letter-spacing:-.01em">lo verificado no es lo terminado</div>
    <div style="color:${MUT};font-size:21px;margin-top:20px">con nombre y número, no con adjetivos</div>
  </div>
</div>${cinta('ACTO 5', '1:59')}`));

/* --------------------------------- render --------------------------------- */
(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = path.join(ROOT, '_verdad', 'html');
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(tmp, { recursive: true });

  const { chromium } = require('playwright');
  const browser = await chromium.launch({
    headless: true, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox', '--allow-file-access-from-files', '--font-render-hinting=none'],
  });
  const pg = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });

  const t0 = Date.now();
  const lista = [];
  for (const c of cards) {
    const hp = path.join(tmp, `${c.name}.html`);
    fs.writeFileSync(hp, c.html);
    await pg.goto('file://' + hp, { waitUntil: 'load' });
    await pg.evaluate(() => Promise.all(
      Array.from(document.images).map((i) => i.complete ? 0 : i.decode().catch(() => 0))));
    const png = path.join(OUT, `${c.name}.png`);
    await pg.screenshot({ path: png, clip: { x: 0, y: 0, width: 1920, height: 1080 }, timeout: 30000 });
    lista.push({ png, s: c.seconds });
    console.log(`→ ${c.name}  ${c.seconds}s`);
  }
  await browser.close();

  // lista para el demuxer concat (un decode por card, NO por cuadro)
  let txt = '';
  for (const l of lista) txt += `file '${l.png}'\nduration ${l.s}\n`;
  txt += `file '${lista[lista.length - 1].png}'\n`;   // último repetido: lo pide el demuxer
  fs.writeFileSync(path.join(ROOT, '_verdad', 'lista.txt'), txt);

  const total = lista.reduce((a, b) => a + b.s, 0);
  console.log(`\n${lista.length} cards · ${total}s (${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}) · ${((Date.now() - t0) / 1000).toFixed(1)}s de render`);
  if (total !== 129) { console.log(`❌ el plan pide 129 s, salieron ${total}`); process.exit(2); }
})().catch((e) => { console.log('FATAL', e); process.exit(1); });
