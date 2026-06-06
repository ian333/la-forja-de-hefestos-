import * as fs from 'fs';
import { cuspHeight, lobeRoughnessAtTilt, worstOverhangDeg, compareStrategies, envelopeReduction } from '../src/forja/mech/print45';
const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const D='/home/ian/Orkesta/la-forja/forja-shots/brazo'; fs.mkdirSync(D,{recursive:true});
const strat=compareStrategies(0.2,0.7); const env=envelopeReduction({cyc1H:30,postH:42,cyc2H:26});

// Panel 1: escalonado — cusp vs angulo de la cara
function p1(){
  const x0=70,y0=210,W=420,H=150; let curve='';
  for(let i=0;i<=90;i++){const c=cuspHeight(i,0.2); const X=x0+W*(i/90); const Y=y0-(c/0.2)*H; curve+=`${i?'L':'M'}${X.toFixed(1)},${Y.toFixed(1)} `;}
  const m=(ang,lbl,col)=>{const X=x0+W*(ang/90),Y=y0-(cuspHeight(ang,0.2)/0.2)*H; return `<circle cx="${X}" cy="${Y}" r="5" fill="${col}"/><text x="${X}" y="${Y-9}" fill="${col}" font-size="10" text-anchor="middle">${lbl} ${cuspHeight(ang,0.2).toFixed(2)}mm</text>`;};
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">escalonado: la rugosidad depende del ángulo</text>
  <line x1="${x0}" y1="${y0}" x2="${x0+W}" y2="${y0}" stroke="${STEEL}44"/><path d="${curve}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  ${m(90,'vertical',GREEN)} ${m(45,'45°',BLUE)} ${m(10,'casi plano',RED)}
  <text x="${x0+W}" y="${y0+18}" fill="${STEEL}" font-size="11" text-anchor="end">ángulo de la cara (90°=vertical) →</text>
  <text x="20" y="${y0+40}" fill="${BLUE}" font-size="11">lóbulo vertical = LISO; a 45° = 0.14mm; acostado (cic.2) = 0.2mm (lo peor)</text>`;
}
// Panel 2: las 3 estrategias
function p2(){
  let rows=''; strat.forEach((s,i)=>{const y=64+i*60;const col=s.pieces===1&&s.bothSelfSupport?GREEN:(s.bothSelfSupport?GOLD:RED);
    rows+=`<text x="20" y="${y}" fill="${col}" font-size="13" font-weight="bold">${s.name}</text>
    <text x="20" y="${y+18}" fill="${STEEL}" font-size="11">${s.pieces} pieza(s) · lóbulo ${s.lobeRoughness_mm}mm (${s.precisionPct}% del gap) · ${s.bothSelfSupport?'auto-soporta ✓':'FALLA ✗'}</text>`;});
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">las 3 estrategias de impresión</text>${rows}`;
}
// Panel 3: el premio del 45 + el balance
function p3(){
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">el 45°: 1 pieza, 34% más chico</text>
  <rect x="40" y="60" width="${env.upright_mm*1.8}" height="26" fill="${STEEL}55"/><text x="${40+env.upright_mm*1.8+8}" y="78" fill="${STEEL}" font-size="12">vertical ${env.upright_mm}mm</text>
  <rect x="40" y="96" width="${env.at45_mm*1.8}" height="26" fill="${GREEN}"/><text x="${40+env.at45_mm*1.8+8}" y="114" fill="${GREEN}" font-size="12">a 45° ${env.at45_mm}mm (−${env.reductionPct}%)</text>
  <text x="20" y="150" fill="${BLUE}" font-size="12">el balance: solo a 45° AMBOS cicloidales llegan a 45° de voladizo (peor cara = ${worstOverhangDeg(45)}°)</text>
  <text x="20" y="172" fill="${STEEL}" font-size="11">menos → cic.2 acostado falla; más → cic.1 falla. 45° reparte parejo.</text>
  <text x="20" y="200" fill="${GREEN}" font-size="13" font-weight="bold">★ veredicto: 45° = 1 pieza + chico, paga 20% de precisión del gap</text>
  <text x="20" y="220" fill="${STEEL}" font-size="11">el cono autocentra y el gap absorbe ese 0.14mm → robusto. Precisión fina = 2 módulos.</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}.wide{grid-column:1/-1}</style></head>
<body><h1>Imprimir el gimbal a 45° — ¿una pieza? ¿precisión?</h1><div class="sub">A 45° ambos cicloidales auto-soportan (1 pieza) y el robot es 34% más chico; paga 0.14mm de rugosidad en el lóbulo (20% del gap), que el cono + el gap absorben.</div>
<div class="grid"><div class="card">${svg(520,290,p1())}</div><div class="card">${svg(520,290,p2())}</div><div class="card wide">${svg(900,250,p3())}</div></div></body></html>`;
fs.writeFileSync(`${D}/print45.html`,html); console.log('VIZ ok');
