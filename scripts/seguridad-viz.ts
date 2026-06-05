/* Visualiza el FACTOR DE SEGURIDAD: por qué se funde (gap modelo vs real) + el SF por
   interfaz + lo estructural. node --import tsx scripts/seguridad-viz.ts → forja-shots/seguridad/seguridad.html */
import * as fs from 'fs';
import { effectiveGap, fusionSF, requiredModelGap, PRINT, structuralSF, PLA_STRENGTH } from '../src/forja/mech/factor-seguridad';

const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',AMBER='#e0a96c';
const D='/home/ian/Orkesta/la-forja/forja-shots/seguridad'; fs.mkdirSync(D,{recursive:true});

// Panel 1: el budget del gap — por qué se funde (modelo → crecimiento → efectivo vs g_min)
function budgetPanel(){
  const x0=40,W=440,sc=320/1.0; // 1mm = 320px
  const bar=(y,gap,lbl,col)=>{const eff=effectiveGap(gap);const grow=2*PRINT.overExtrudePerSide;
    return `<text x="${x0}" y="${y-8}" fill="${col}" font-size="12">${lbl}: modelo ${gap}mm</text>
    <rect x="${x0}" y="${y}" width="${eff*sc}" height="20" fill="${col}88"/>
    <rect x="${x0+eff*sc}" y="${y}" width="${grow*sc}" height="20" fill="${RED}55"/>
    <text x="${x0+eff*sc+grow*sc+6}" y="${y+15}" fill="${STEEL}" font-size="11">efectivo ${eff.toFixed(2)} · SF ${fusionSF(gap).toFixed(2)} ${fusionSF(gap)>=1.5?'✓':'✗ funde'}</text>`;};
  const gMinX=x0+PRINT.fusionGapMin*sc;
  return `<text x="${x0}" y="24" fill="${GOLD}" font-size="14" font-weight="bold">por qué se funde: el gap REAL &lt; el del modelo</text>
  <line x1="${gMinX}" y1="44" x2="${gMinX}" y2="220" stroke="${AMBER}" stroke-width="1.5" stroke-dasharray="4 3"/>
  <text x="${gMinX+4}" y="56" fill="${AMBER}" font-size="11">g_min fusión 0.30 (abajo de aquí = funde)</text>
  ${bar(80,0.55,'ACTUAL',RED)}
  ${bar(140,0.69,'SF 1.5',GREEN)}
  ${bar(200,0.8,'SF 1.9',BLUE)}
  <text x="${x0}" y="250" fill="${STEEL}" font-size="11">▮ gap efectivo (impreso)   ▮ crecimiento de pared (2×${PRINT.overExtrudePerSide}=${(2*PRINT.overExtrudePerSide).toFixed(2)}mm, se come el gap)</text>
  <text x="${x0}" y="270" fill="${BLUE}" font-size="12">gap_modelo ≥ SF·g_min + 2·crecimiento → para SF 1.5: ${requiredModelGap(1.5)}mm</text>`;
}
// Panel 2: SF estructural — el otro dominio (va sobrado)
function structPanel(){
  const items=[['contacto barril',9,'tensil',PLA_STRENGTH.tensileMPa],['journal',7,'tensil',PLA_STRENGTH.tensileMPa],['cuello frangible',6,'cortante',PLA_STRENGTH.shearMPa]];
  let rows=''; items.forEach((it,i)=>{const sf=structuralSF(it[1],it[3]);const y=70+i*46;const col=sf>=2?GREEN:RED;
    rows+=`<text x="20" y="${y}" fill="${STEEL}" font-size="12">${it[0]}</text>
    <text x="180" y="${y}" fill="${STEEL}" font-size="11">${it[1]} MPa / ${it[3]} (${it[2]})</text>
    <text x="350" y="${y}" fill="${col}" font-size="13" font-weight="bold">SF ${sf}</text>`;});
  return `<text x="20" y="24" fill="${GOLD}" font-size="14" font-weight="bold">estructural: σ admisible = resistencia / SF</text>
  <text x="20" y="44" fill="${BLUE}" font-size="11">aquí va SOBRADO (PLA aguanta; el problema era el gap, no el esfuerzo)</text>${rows}
  <text x="20" y="220" fill="${STEEL}" font-size="11">objetivo SF estructural ≥ 2 · todos lo cumplen (barril SF 5.5)</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>Factor de seguridad — por qué se fundía + el fix</h1><div class="sub">El gap del MODELO no es el real (las paredes crecen). SF_fusión = gap_efectivo / g_min. El actual estaba en ~1.0 (cero margen).</div>
<div class="grid"><div class="card">${svg(520,290,budgetPanel())}</div><div class="card">${svg(520,290,structPanel())}</div></div></body></html>`;
fs.writeFileSync(`${D}/seguridad.html`,html); console.log('VIZ ok → '+D+'/seguridad.html');
