/* Visualiza el sistema de G-code K1: (1) el toolpath real de una capa, (2) el campo de
   uniones → fan/gap (Poisson a favor), (3) snippet del G-code, (4) stats + límites K1.
   node --import tsx scripts/gcode-viz.ts → forja-shots/gcode/gcode.html */
import * as fs from 'fs';
import { discLayerToolpath } from '../src/forja/mech/generador-impresion';
import { discToGcode, bondParams } from '../src/forja/mech/gcode-k1';
import { K1 } from '../src/forja/mech/printsim';

const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const DIR='/home/ian/Orkesta/la-forja/forja-shots/gcode'; fs.mkdirSync(DIR,{recursive:true});
const P={lobes:10,R:27,Rr:2,E:1,shaftD:11,outPinD:4,outPins:6,T:6.8};
const tp=discLayerToolpath(P);
const g=discToGcode(P,{layerH:0.2});

// Panel 1: el TOOLPATH de una capa (lo que la K1 traza)
function pathPanel(){
  const cx=200,cy=180,sc=4.6; const col={perimetro:GOLD,barreno:BLUE,relleno:GREEN,viaje:'#334'};
  let paths='';
  for(const s of tp.segs){ if(s.pts.length<2)continue; let d=''; s.pts.forEach((p,i)=>{d+=`${i?'L':'M'}${(cx+p.x*sc).toFixed(1)},${(cy-p.y*sc).toFixed(1)} `;});
    paths+=`<path d="${d}" fill="none" stroke="${col[s.type]}" stroke-width="${s.type==='viaje'?0.5:1.4}" ${s.type==='viaje'?'stroke-dasharray="2 2" opacity="0.5"':''}/>`; }
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">el TOOLPATH que traza la K1 (1 capa)</text>${paths}
  <text x="20" y="340" fill="${GOLD}" font-size="11">━ perímetro</text><text x="120" y="340" fill="${BLUE}" font-size="11">━ barrenos</text><text x="220" y="340" fill="${GREEN}" font-size="11">━ relleno</text><text x="310" y="340" fill="${STEEL}" font-size="11">┈ viajes</text>`;
}
// Panel 2: campo de UNIONES → fan/gap (Poisson a favor)
function bondPanel(){
  const bonds=['fundido','holgura','cuello','hilo']; const cols={fundido:RED,holgura:GREEN,cuello:GOLD,hilo:VIOLET};
  let rows=''; bonds.forEach((b,i)=>{const bp=bondParams(b);const y=70+i*55;
    rows+=`<text x="20" y="${y}" fill="${cols[b]}" font-size="14" font-weight="bold">${b}</text>
    <text x="120" y="${y}" fill="${STEEL}" font-size="12">gap ${bp.gapMm}mm · fan ${bp.fanPct}%</text>
    <text x="20" y="${y+18}" fill="${STEEL}" font-size="10.5">${bp.note}</text>`;});
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">Poisson a favor: el FAN decide si suelda</text>
  <text x="20" y="44" fill="${BLUE}" font-size="11">fan alto enfría → no suelda (gira) · fan bajo → suelda (rígido)</text>${rows}`;
}
// Panel 3: snippet del G-code
function codePanel(){
  const lines=g.gcode.split('\n').slice(0,20);
  let t=''; lines.forEach((l,i)=>{const c=l.startsWith(';')?'#6b7d8f':l.startsWith('M10')||l.startsWith('M14')||l.startsWith('M19')?GOLD:l.startsWith('M106')?GREEN:STEEL; t+=`<text x="18" y="${44+i*15}" fill="${c}" font-family="monospace" font-size="11">${l.replace(/→/g,'-&gt;').slice(0,52)}</text>`;});
  return `<text x="18" y="24" fill="${GOLD}" font-size="14" font-weight="bold">G-code real K1 (Klipper) — disco-k1.gcode</text>${t}`;
}
// Panel 4: stats + límites K1
function statsPanel(){
  const rows=[['capas',g.layers],['líneas G-code',g.lines.toLocaleString()],['filamento',g.filament_mm+' mm ('+g.filament_cm3+' cm³)'],['tiempo estimado',g.est_min+' min'],
    ['—','—'],['K1 flujo máx',K1.maxFlow+' mm³/s (capa la velocidad)'],['K1 aceleración',K1.maxAccel+' mm/s²'],['K1 velocidad máx',K1.maxSpeed+' mm/s'],['nozzle / cama','210°C / 60°C']];
  let t=''; rows.forEach((r,i)=>{const y=64+i*26; if(r[0]==='—'){t+=`<line x1="20" y1="${y-8}" x2="380" y2="${y-8}" stroke="${GOLD}33"/>`;return;} t+=`<text x="20" y="${y}" fill="${STEEL}" font-size="12">${r[0]}</text><text x="200" y="${y}" fill="${GOLD}" font-size="12">${r[1]}</text>`;});
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">stats + límites físicos K1</text>${t}`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>La Forja → G-code para la K1</h1><div class="sub">Del toolpath + los límites físicos (fusión/Poisson, flujo, aceleración) al código G real. El FAN aterriza el campo de uniones.</div>
<div class="grid"><div class="card">${svg(440,355,pathPanel())}</div><div class="card">${svg(440,355,bondPanel())}</div>
<div class="card">${svg(440,330,codePanel())}</div><div class="card">${svg(440,330,statsPanel())}</div></div></body></html>`;
fs.writeFileSync(`${DIR}/gcode.html`,html); console.log('VIZ ok → '+DIR+'/gcode.html');
