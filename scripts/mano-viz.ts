/* Deriva la mano de 3 dedos, dibujada: (1) un dedo = cadena de codos + tendón-puente +
   brazo de momento, (2) la palma con 3 dedos a 120° y soportes φ-dispersos de 1 punto,
   (3) el campo de uniones del tendón. node --import tsx scripts/mano-viz.ts */
import * as fs from 'fs';
const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const D='/home/ian/Orkesta/la-forja/forja-shots/mano'; fs.mkdirSync(D,{recursive:true});
const PHI=(1+Math.sqrt(5))/2, PSI=2*Math.PI/(PHI*PHI);

// Panel 1: un DEDO — cadena de codos curlada + tendón flexor + brazos de momento
function finger(){
  const L=[78,58,44]; const th=[0.5,0.7,0.9]; // largos px, ángulos codo
  let x=60,y=300,phi=-Math.PI/2; const joints=[[x,y]]; let seg=''; let tendon=`M${x+14},${y}`;
  for(let i=0;i<3;i++){phi+=th[i]; const nx=x+L[i]*Math.cos(phi), ny=y+L[i]*Math.sin(phi);
    seg+=`<line x1="${x}" y1="${y}" x2="${nx.toFixed(0)}" y2="${ny.toFixed(0)}" stroke="${STEEL}" stroke-width="13" stroke-linecap="round"/>`;
    // tendón flexor a brazo r del eje
    const rx=x+14*Math.cos(phi-Math.PI/2), ry=y+14*Math.sin(phi-Math.PI/2);
    tendon+=` L${rx.toFixed(0)},${ry.toFixed(0)} L${(nx+14*Math.cos(phi-Math.PI/2)).toFixed(0)},${(ny+14*Math.sin(phi-Math.PI/2)).toFixed(0)}`;
    x=nx;y=ny;joints.push([x,y]);}
  let codos=''; joints.slice(0,3).forEach((j,i)=>{codos+=`<circle cx="${j[0]}" cy="${j[1]}" r="7" fill="${INK}" stroke="${GOLD}" stroke-width="2.5"/><text x="${j[0]+10}" y="${j[1]-8}" fill="${GOLD}" font-size="11">codo ${i+1}</text>`;});
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">un dedo: codos + tendón (músculo)</text>
  ${seg}${codos}<path d="${tendon}" fill="none" stroke="${RED}" stroke-width="2.5" stroke-dasharray="1 0"/>
  <circle cx="${joints[3][0]}" cy="${joints[3][1]}" r="5" fill="${RED}"/><text x="${joints[3][0]+8}" y="${joints[3][1]}" fill="${RED}" font-size="11">ancla (fundido)</text>
  <text x="20" y="345" fill="${RED}" font-size="11">━ tendón a brazo r → τ_i = T·r_i · T = F·L/r</text>
  <text x="20" y="362" fill="${BLUE}" font-size="11">1 tendón / 3 codos → agarre adaptativo (se conforma)</text>`;
}
// Panel 2: palma — 3 dedos a 120° + soportes φ-dispersos de 1 punto
function palm(){
  const cx=200,cy=195; let fingers='';
  for(let k=0;k<3;k++){const a=-Math.PI/2+k*2*Math.PI/3; const bx=cx+34*Math.cos(a),by=cy+34*Math.sin(a);
    const tx=cx+120*Math.cos(a),ty=cy+120*Math.sin(a);
    fingers+=`<line x1="${bx}" y1="${by}" x2="${tx}" y2="${ty}" stroke="${STEEL}" stroke-width="11" stroke-linecap="round"/><text x="${tx}" y="${ty}" fill="${STEEL}" font-size="10" text-anchor="middle">dedo ${k+1}</text>`;}
  let sup=''; for(let n=1;n<=80;n++){const th=n*PSI, r=8*Math.sqrt(n); const x=cx+r*Math.cos(th), y=cy+r*Math.sin(th); if(r<60) sup+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2" fill="${VIOLET}"/>`;}
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">palma: 3 dedos 120° + soportes φ</text>
  <circle cx="${cx}" cy="${cy}" r="34" fill="${A(GOLD)}" stroke="${GOLD}" stroke-width="2"/>${fingers}${sup}
  <text x="20" y="345" fill="${GREEN}" font-size="11">3 dedos a 120° = agarre estable (3 puntos)</text>
  <text x="20" y="362" fill="${VIOLET}" font-size="11">• soportes 1-punto al ángulo áureo → no chocan, sin virutas</text>`;
}
const A=(c)=>c+'22';
// Panel 3: el campo de uniones del tendón (libre vs fundido)
function bond(){
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">el hilo: voladizo LIBRE → ancla FUNDIDA</text>
  <line x1="40" y1="120" x2="360" y2="120" stroke="${STEEL}" stroke-width="6"/>
  <text x="40" y="108" fill="${STEEL}" font-size="11">guías (soporte reusado)</text>
  <path d="M40,120 q160,40 320,0" fill="none" stroke="${GREEN}" stroke-width="3" stroke-dasharray="6 4"/>
  <text x="120" y="175" fill="${GREEN}" font-size="11">tendón = puente LIBRE (gap ≥ SF·g_min+2δ, desliza)</text>
  <circle cx="360" cy="120" r="6" fill="${RED}"/><text x="300" y="108" fill="${RED}" font-size="11">FUNDIDO (ancla)</text>
  <text x="40" y="215" fill="${BLUE}" font-size="11.5">fan ALTO en el tendón → no suelda a la guía (Poisson a favor)</text>
  <text x="40" y="235" fill="${STEEL}" font-size="11">fan BAJO en el ancla → suelda. Doble función del soporte:</text>
  <text x="40" y="253" fill="${STEEL}" font-size="11">imprime sostiene el voladizo → después es la guía del hilo.</text>
  <text x="40" y="280" fill="${VIOLET}" font-size="11">frangible = 1 punto → F_b=τ·A→0 → rompe limpio, viruta se queda en el soporte</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>La mano de 3 dedos — derivada</h1><div class="sub">1 tendón/dedo curla 3 codos (adaptativo) · el hilo nace voladizo libre y se funde en el ancla · soportes φ de 1 punto (guía + sin virutas)</div>
<div class="grid"><div class="card">${svg(420,375,finger())}</div><div class="card">${svg(420,375,palm())}</div><div class="card">${svg(420,300,bond())}</div></div></body></html>`;
fs.writeFileSync(`${D}/mano.html`,html); console.log('VIZ ok → '+D+'/mano.html');
