/* Hoja del MARCO (las fórmulas dibujadas): (1) φ-dispersión filotaxis, (2) cola de milano
   auto-soporte, (3) la desigualdad maestra del gap. node --import tsx scripts/marco-viz.ts */
import * as fs from 'fs';
const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const D='/home/ian/Orkesta/la-forja/forja-shots/marco'; fs.mkdirSync(D,{recursive:true});
const PHI=(1+Math.sqrt(5))/2, PSI=2*Math.PI/(PHI*PHI); // ángulo áureo

// Panel 1: filotaxis — n puntos al ángulo áureo (dispersión óptima)
function phyllo(){
  const cx=200,cy=185,c=11; let pts='';
  for(let n=1;n<=140;n++){const th=n*PSI, r=c*Math.sqrt(n); const x=cx+r*Math.cos(th), y=cy+r*Math.sin(th);
    const col=`hsl(${(n*PSI*180/Math.PI)%360},55%,60%)`; pts+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${col}"/>`;}
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">φ-dispersión (filotaxis): puertos de grasa</text>
  ${pts}
  <text x="20" y="335" fill="${STEEL}" font-size="12">θ_n = n·137.507°,  r_n = c·√n</text>
  <text x="20" y="353" fill="${BLUE}" font-size="11">ninguno se alinea · densidad uniforme · óptimo para cualquier n</text>`;
}
// Panel 2: cola de milano (auto-soporte + captura) con la holgura
function dovetail(){
  const cx=210,cy=150; const A='#2a3744';
  // riel (trapecio invertido) + carro que lo abraza
  const rail=`M${cx-50},${cy+60} L${cx-30},${cy} L${cx+30},${cy} L${cx+50},${cy+60} Z`;
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">junta lineal: cola de milano</text>
  <path d="${rail}" fill="${GOLD}55" stroke="${GOLD}" stroke-width="2"/>
  <text x="${cx}" y="${cy+45}" fill="${GOLD}" font-size="11" text-anchor="middle">riel (fijo)</text>
  <path d="M${cx-72},${cy+70} L${cx-72},${cy-12} L${cx+72},${cy-12} L${cx+72},${cy+70} L${cx+56},${cy+70} L${cx+36},${cy-4} L${cx-36},${cy-4} L${cx-56},${cy+70} Z" fill="${BLUE}33" stroke="${BLUE}" stroke-width="2"/>
  <text x="${cx}" y="${cy-20}" fill="${BLUE}" font-size="11" text-anchor="middle">carro (desliza en ẑ)</text>
  <path d="M${cx+30},${cy} l14,0 m-14,0 l10,18" stroke="${GREEN}" stroke-width="1.5" fill="none"/>
  <text x="${cx+48}" y="${cy+14}" fill="${GREEN}" font-size="12">θ ≥ 45°</text>
  <text x="20" y="250" fill="${STEEL}" font-size="11.5">θ ≥ 45° → auto-soporta SIN soporte Y atrapa el carro (no se levanta)</text>
  <text x="20" y="270" fill="${STEEL}" font-size="11.5">holgura normal a cada flanco = g_modelo · canal de grasa en V</text>
  <text x="20" y="290" fill="${VIOLET}" font-size="11.5">L_carro ≥ 2·(brazo de carga) → no se atora (regla del cajón)</text>`;
}
// Panel 3: la desigualdad maestra del gap (con SF)
function master(){
  const x0=30,sc=300; const gmin=0.30,delta=0.12;
  const bar=(y,g,col,lbl)=>{const eff=g-2*delta;const sf=eff/gmin;return `
    <text x="${x0}" y="${y-6}" fill="${col}" font-size="12">${lbl} g=${g}</text>
    <rect x="${x0}" y="${y}" width="${eff*sc}" height="16" fill="${col}88"/>
    <rect x="${x0+eff*sc}" y="${y}" width="${2*delta*sc}" height="16" fill="${RED}44"/>
    <text x="${x0+g*sc+6}" y="${y+13}" fill="${STEEL}" font-size="10.5">SF ${sf.toFixed(2)} ${sf>=1.5?'✓':'✗'}</text>`;};
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">la desigualdad maestra del gap</text>
  <text x="20" y="48" fill="${GREEN}" font-size="14">g_modelo ≥ SF·g_min + 2δ</text>
  <line x1="${x0+gmin*sc}" y1="70" x2="${x0+gmin*sc}" y2="200" stroke="${'#e0a96c'}" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="${x0+gmin*sc+4}" y="84" fill="#e0a96c" font-size="10">g_min 0.30 (funde abajo)</text>
  ${bar(100,0.55,RED,'fundía')}
  ${bar(140,0.69,GREEN,'SF 1.5')}
  ${bar(180,0.8,BLUE,'SF 1.9')}
  <text x="20" y="225" fill="${STEEL}" font-size="11">▮ efectivo  ▮ crecimiento de pared 2δ (se come el gap)</text>
  <text x="20" y="245" fill="${BLUE}" font-size="11">g_min ≈ k·h (difusión térmica) · δ ≈ 0.12 sobre-extrusión</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>El marco, dibujado — mecanismos internos limpios</h1><div class="sub">φ dispersa las features · la cola de milano auto-soporta y captura · la desigualdad maestra fija el gap con SF</div>
<div class="grid"><div class="card">${svg(420,370,phyllo())}</div><div class="card">${svg(420,370,dovetail())}</div><div class="card">${svg(420,370,master())}</div></div></body></html>`;
fs.writeFileSync(`${D}/marco.html`,html); console.log('VIZ ok → '+D+'/marco.html');
