/* Visualiza la VERDAD honesta: esférico (punto, balero de BOLAS) concentra MÁS que el
   barril (línea, balero de RODILLOS). + el límite de lock (no negativo exacto) + la
   decisión. node --import tsx scripts/esferico-viz.ts → forja-shots/esferico/esferico.html */
import * as fs from 'fs';
import { eStar, effRadiusSphere, hertzSphere, hertzLine, lockLimit } from '../src/forja/mech/esferico';

const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const DIR='/home/ian/Orkesta/la-forja/forja-shots/esferico'; fs.mkdirSync(DIR,{recursive:true});
const Es=eStar(), F=10.4, Rstar=effRadiusSphere(3,3.825);
const sph=hertzSphere({F_N:F,Rstar_mm:Rstar,Estar_Pa:Es});
const ln=hertzLine({Wprime_Npm:F/0.006,Rstar_mm:Rstar,Estar_Pa:Es}); const lnArea=2*ln.halfWidth_mm*6;

// Panel 1: BOLA (punto) vs RODILLO/BARRIL (línea) — parche + presión
function p1(){
  const cy=150;
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">balero de BOLAS (punto) vs RODILLOS (línea)</text>
  <text x="150" y="56" fill="${STEEL}" font-size="12" text-anchor="middle">ESFERA — punto</text>
  <circle cx="150" cy="${cy}" r="46" fill="none" stroke="${STEEL}" stroke-width="1.5"/>
  <circle cx="150" cy="${cy}" r="9" fill="${RED}"/>
  <text x="150" y="${cy+70}" fill="${RED}" font-size="11" text-anchor="middle">área ${sph.area_mm2.toFixed(2)} mm² · p ${sph.pMax_MPa.toFixed(0)} MPa</text>
  <text x="430" y="56" fill="${STEEL}" font-size="12" text-anchor="middle">BARRIL — línea</text>
  <rect x="384" y="${cy-46}" width="92" height="92" rx="6" fill="none" stroke="${STEEL}" stroke-width="1.5"/>
  <rect x="426" y="${cy-40}" width="8" height="80" rx="4" fill="${GREEN}"/>
  <text x="430" y="${cy+70}" fill="${GREEN}" font-size="11" text-anchor="middle">área ${lnArea.toFixed(2)} mm² · p ${ln.pMax_MPa.toFixed(0)} MPa</text>
  <text x="40" y="270" fill="${BLUE}" font-size="12">la LÍNEA reparte a lo largo del diente; el PUNTO concentra → el BARRIL carga más</text>`;
}
// Panel 2: el LÍMITE de lock — el socket NO puede ser el negativo exacto
function p2(){
  const lim=lockLimit(3,0.6,1.5), cx=290,cy=160;
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">el socket NO puede ser el negativo EXACTO</text>
  <circle cx="${cx-70}" cy="${cy}" r="40" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <path d="M${cx-70-44},${cy} A44 44 0 1 1 ${cx-70+44},${cy}" fill="none" stroke="${RED}" stroke-width="4"/>
  <text x="${cx-70}" y="${cy+62}" fill="${RED}" font-size="11" text-anchor="middle">exacto → TRABA ✗</text>
  <circle cx="${cx+90}" cy="${cy}" r="40" fill="none" stroke="${GOLD}" stroke-width="2"/>
  <path d="M${cx+90-50},${cy-4} A50 50 0 1 1 ${cx+90+50},${cy-4}" fill="none" stroke="${GREEN}" stroke-width="3" stroke-dasharray="2 3"/>
  <text x="${cx+90}" y="${cy+62}" fill="${GREEN}" font-size="11" text-anchor="middle">socket + δ → GIRA ✓</text>
  <text x="40" y="250" fill="${STEEL}" font-size="12">δ mín = gap(0.6) + fracción de órbita = ${lim.minDelta_mm} mm. El GAP DE ACEITE es lo que permite el giro.</text>
  <text x="40" y="270" fill="${BLUE}" font-size="11">conformidad útil &lt; 1 (nunca el negativo exacto, o se traba)</text>`;
}
// Panel 3: la decisión — carga (barril) vs centrado 2 ejes + desalineación (esfera)
function p3(){
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">la decisión (y el ganador: BARRIL esférico)</text>
  <text x="40" y="60" fill="${GREEN}" font-size="13">BARRIL (línea):</text>
  <text x="60" y="80" fill="${STEEL}" font-size="12">+ MÁS carga (reparte) · + menos esfuerzo · centra 1 eje (radial)</text>
  <text x="40" y="110" fill="${VIOLET}" font-size="13">ESFERA (punto):</text>
  <text x="60" y="130" fill="${STEEL}" font-size="12">− menos carga (concentra) · + centra 2 EJES · + tolera desalineación</text>
  <line x1="40" y1="150" x2="520" y2="150" stroke="${GOLD}33"/>
  <text x="40" y="178" fill="${GOLD}" font-size="13" font-weight="bold">★ BARRIL ESFÉRICO (rodillo abarrilado):</text>
  <text x="60" y="198" fill="${STEEL}" font-size="12">contacto de LÍNEA (mucha carga) + corona que tolera desalineación.</text>
  <text x="60" y="216" fill="${GREEN}" font-size="12">= lo mejor de ambos. Es lo que ya tienes (el barril simétrico).</text>
  <text x="40" y="250" fill="${BLUE}" font-size="11">si priorizas CARGA → barril. Si priorizas CENTRADO 2D/desalineación → esfera (pagando carga).</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}.wide{grid-column:1 / -1}</style></head>
<body><h1>Esférico vs Barril — la verdad honesta (bolas vs rodillos)</h1>
<div class="sub">El esférico (punto) concentra MÁS esfuerzo que el barril (línea). El barril carga más; la esfera centra en 2 ejes.</div>
<div class="grid">
<div class="card">${svg(560,290,p1())}</div>
<div class="card">${svg(560,290,p2())}</div>
<div class="card wide">${svg(1130,270,p3())}</div>
</div></body></html>`;
fs.writeFileSync(`${DIR}/esferico.html`,html); console.log('VIZ ok → '+DIR+'/esferico.html');
