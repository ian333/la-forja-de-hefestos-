/* La arquitectura: cicloidales = DOF, discos = carga. 2 ángulos = 2 cicloidales.
   node --import tsx scripts/arquitectura-viz.ts → forja-shots/brazo/arquitectura.png */
import * as fs from 'fs';
const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const D='/home/ian/Orkesta/la-forja/forja-shots/brazo'; fs.mkdirSync(D,{recursive:true});

// Panel 1: 1 cicloidal = 1 eje. discos = carga, no DOF.
function p1(){
  const cx=210,cy=160;
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">1 cicloidal = 1 movimiento (1 eje)</text>
  <ellipse cx="${cx}" cy="${cy}" rx="70" ry="70" fill="${STEEL}18" stroke="${STEEL}" stroke-width="2"/>
  <line x1="${cx}" y1="${cy-95}" x2="${cx}" y2="${cy+95}" stroke="${GREEN}" stroke-width="2" stroke-dasharray="5 4"/>
  <path d="M${cx+78},${cy-30} A40 40 0 0 1 ${cx+78},${cy+30}" fill="none" stroke="${GREEN}" stroke-width="2.5" marker-end="url(#ah)"/>
  <text x="${cx+86}" y="${cy+4}" fill="${GREEN}" font-size="12">gira 1 eje</text>
  ${[0,1,2].map(i=>`<rect x="${cx-30}" y="${cy-22+i*15}" width="60" height="10" rx="2" fill="${GOLD}"/>`).join('')}
  <text x="${cx}" y="${cy+78}" fill="${GOLD}" font-size="11" text-anchor="middle">discos = CARGA (no DOF)</text>
  <text x="20" y="300" fill="${BLUE}" font-size="12">el que imprimiste: 1 movimiento. Apilar discos NO da un 2º movimiento.</text>`;
}
// Panel 2: 2 cicloidales perpendiculares = 2 DOF (gimbal)
function p2(){
  const cx=200,cy=150;
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">2 ángulos = 2 cicloidales (gimbal)</text>
  <ellipse cx="${cx}" cy="${cy+40}" rx="55" ry="22" fill="${VIOLET}22" stroke="${VIOLET}" stroke-width="2"/>
  <line x1="${cx}" y1="${cy-60}" x2="${cx}" y2="${cy+90}" stroke="${VIOLET}" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="${cx+60}" y="${cy+44}" fill="${VIOLET}" font-size="11">cic. 1: AXIAL (yaw)</text>
  <ellipse cx="${cx}" cy="${cy-30}" rx="22" ry="50" fill="${RED}22" stroke="${RED}" stroke-width="2"/>
  <line x1="${cx-75}" y1="${cy-30}" x2="${cx+75}" y2="${cy-30}" stroke="${RED}" stroke-width="2" stroke-dasharray="4 3"/>
  <text x="${cx+30}" y="${cy-70}" fill="${RED}" font-size="11">cic. 2: RADIAL (pitch)</text>
  <text x="20" y="300" fill="${GREEN}" font-size="12">cic.1 mueve a cic.2 → el eslabón gira en 2 ejes → ángulo radial Y axial ✓</text>`;
}
// Panel 3: el brazo — la cuenta (DOF vs carga desacoplados)
function p3(){
  const rows=[
    ['hombro · base-yaw','cicloidal 1 (eje vertical)','3 discos','axial'],
    ['hombro · pitch','cicloidal 2 (eje horizontal)','3 discos','radial'],
    ['codo','cicloidal 3','2 discos','radial'],
  ];
  let t=''; rows.forEach((r,i)=>{const y=70+i*44; const c=[VIOLET,RED,GOLD][i];
    t+=`<circle cx="40" cy="${y-4}" r="8" fill="${c}"/><text x="58" y="${y}" fill="${STEEL}" font-size="13">${r[0]}</text>
    <text x="270" y="${y}" fill="${c}" font-size="12">${r[1]}</text><text x="540" y="${y}" fill="${GOLD}" font-size="12">${r[2]}</text>`;});
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">el brazo esférico: 3 cicloidales = 3 DOF</text>
  <text x="20" y="46" fill="${STEEL}" font-size="11">hombro 2-DOF (2 cicloidales: yaw+pitch) + codo (1) = workspace esférico</text>${t}
  <line x1="20" y1="200" x2="640" y2="200" stroke="${GOLD}33"/>
  <text x="20" y="224" fill="${GREEN}" font-size="13" font-weight="bold">desacoplado:  nº CICLOIDALES = los movimientos · nº DISCOS = la carga</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${GREEN}"/></marker></defs><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}.wide{grid-column:1/-1}</style></head>
<body><h1>Arquitectura: cicloidales = movimientos, discos = carga</h1><div class="sub">Lo que cachaste: 1 cicloidal = 1 eje. Para ángulo radial Y axial = 2 cicloidales. Los discos son carga, no DOF.</div>
<div class="grid"><div class="card">${svg(440,320,p1())}</div><div class="card">${svg(440,320,p2())}</div><div class="card wide">${svg(900,250,p3())}</div></div></body></html>`;
fs.writeFileSync(`${D}/arquitectura.html`,html); console.log('VIZ ok → '+D+'/arquitectura.html');
