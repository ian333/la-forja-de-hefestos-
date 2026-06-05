/* Simula el ensamble: el runout del eje → la malla CHOCA. node --import tsx scripts/ensamble-viz.ts */
import * as fs from 'fs';
import { worstMeshOverDirections, runoutOneBearing, runoutCone } from '../src/forja/mech/ensamble';
const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const D='/home/ian/Orkesta/la-forja/forja-shots/ensamble'; fs.mkdirSync(D,{recursive:true});
const GB={lobes:10,R:27,Rr:2,E:1,gap:0.8,discs:3};
const r1=runoutOneBearing(0.4,30,8), rc=runoutCone();

// Panel 1: amplificación del runout (voladizo vs 2 conos)
function p1(){
  const cx=120,top=40,bot=300;
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">por qué cabecea: 1 apoyo = voladizo</text>
  <line x1="${cx}" y1="${bot}" x2="${cx-3}" y2="${top}" stroke="${RED}" stroke-width="4"/>
  <rect x="${cx-18}" y="${bot-28}" width="36" height="28" fill="${STEEL}33" stroke="${STEEL}"/><text x="${cx}" y="${bot+16}" fill="${STEEL}" font-size="10" text-anchor="middle">1 apoyo (ℓ=8)</text>
  <line x1="${cx}" y1="${top+4}" x2="${cx+85}" y2="${top+4}" stroke="${RED}" stroke-width="1.5" stroke-dasharray="3 2"/>
  <text x="${cx+90}" y="${top+8}" fill="${RED}" font-size="12">runout ${r1}mm ✗</text>
  <text x="${cx-90}" y="${(top+bot)/2}" fill="${RED}" font-size="11">disco arriba</text>
  <!-- 2 conos -->
  <text x="290" y="24" fill="${GOLD}" font-size="13" font-weight="bold">2 conos</text>
  <line x1="320" y1="${top}" x2="320" y2="${bot}" stroke="${GREEN}" stroke-width="4"/>
  <path d="M306,${bot} L320,${bot-22} L334,${bot} Z" fill="${GREEN}44" stroke="${GREEN}"/><path d="M306,${top} L320,${top+22} L334,${top} Z" fill="${GREEN}44" stroke="${GREEN}"/>
  <text x="345" y="${(top+bot)/2}" fill="${GREEN}" font-size="11">runout ~0 ✓</text>
  <text x="290" y="${bot+16}" fill="${STEEL}" font-size="10">conos asientan (gravedad)</text>`;
}
// Panel 2: malla vs decentrado (cruza cero = CHOCA)
function p2(){
  const x0=70,y0=200,W=440,H=140; const dMax=3.6; const pts=[];
  for(let i=0;i<=60;i++){const d=dMax*i/60; pts.push({d,m:worstMeshOverDirections(GB,d).worst});}
  const mMax=1.0,mMin=-2.4; const ym=(m)=>y0-((m-mMin)/(mMax-mMin))*H; const xd=(d)=>x0+W*(d/dMax);
  let curve=''; pts.forEach((p,i)=>curve+=`${i?'L':'M'}${xd(p.d).toFixed(1)},${ym(p.m).toFixed(1)} `);
  const y0line=ym(0);
  const m1=worstMeshOverDirections(GB,r1).worst;
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">malla vs decentrado: bajo 0 = CHOCA</text>
  <rect x="${x0}" y="${y0line}" width="${W}" height="${y0-y0line}" fill="${RED}10"/>
  <line x1="${x0}" y1="${y0line}" x2="${x0+W}" y2="${y0line}" stroke="${RED}" stroke-width="1.5" stroke-dasharray="5 3"/>
  <text x="${x0+4}" y="${y0line-5}" fill="${RED}" font-size="11">malla = 0 (debajo: lóbulo dentro del rodillo = CHOCA)</text>
  <path d="${curve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  <circle cx="${xd(rc)}" cy="${ym(worstMeshOverDirections(GB,rc).worst)}" r="6" fill="${GREEN}"/><text x="${xd(rc)+8}" y="${ym(worstMeshOverDirections(GB,rc).worst)-4}" fill="${GREEN}" font-size="11">cono (δ~0) LIBRA</text>
  ${r1<=dMax?`<circle cx="${xd(r1)}" cy="${ym(m1)}" r="6" fill="${RED}"/><text x="${xd(r1)-10}" y="${ym(m1)+18}" fill="${RED}" font-size="11">1 apoyo CHOCA</text>`:`<text x="${x0+W-150}" y="${y0+18}" fill="${RED}" font-size="11">1 apoyo (δ=${r1}) sale de la gráfica → CHOCA fuerte</text>`}
  <text x="${x0+W}" y="${y0+18}" fill="${STEEL}" font-size="11" text-anchor="end">decentrado δ (runout) →</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1.3fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>Simulación del ensamble — dónde CHOCA</h1><div class="sub">El runout del eje descentra los discos → los lóbulos entran en los rodillos. 1 apoyo (3.4mm) CHOCA; los conos (~0) LIBRAN. = lo que pasó en la pieza física.</div>
<div class="grid"><div class="card">${svg(440,330,p1())}</div><div class="card">${svg(560,240,p2())}</div></div></body></html>`;
fs.writeFileSync(`${D}/ensamble.html`,html); console.log('VIZ ok → '+D+'/ensamble.html');
