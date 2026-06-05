/* Tablero de pruebas de carga del brazo: (1) capacidad radial×axial, (2) torques por junta +
   discos óptimos, (3) la combinación radial+axial. node --import tsx scripts/brazo-viz.ts */
import * as fs from 'fs';
import { jointTorques, cycloidalCapacity, sizeArm, armKinematics } from '../src/forja/mech/brazo';
const GOLD='#d8a657',INK='#0d1218',STEEL='#9fb3c8',GREEN='#7ee081',RED='#e06c6c',BLUE='#6fb6c9',VIOLET='#b58cf0';
const D='/home/ian/Orkesta/la-forja/forja-shots/brazo'; fs.mkdirSync(D,{recursive:true});
const LINKS=[450,400,350];
const tq=jointTorques({links:LINKS,payloadKg:0.5});
const arm=sizeArm({links:LINKS,payloadKg:0.5},[28,24,20],{SF:2.5,t:6}); // R proporcional al brazo

// Panel 1: heatmap capacidad vs R (radial) × N (axial)
function heat(){
  const x0=70,y0=60,cw=64,ch=42; const Rs=[18,22,26,30,34],Ns=[2,3,4,5];
  const Tmax=cycloidalCapacity({N:5,t:6,R:34});
  let cells='';
  Ns.forEach((N,j)=>{Rs.forEach((R,i)=>{const T=cycloidalCapacity({N,t:6,R});const h=Math.round(200*T/Tmax);
    cells+=`<rect x="${x0+i*cw}" y="${y0+j*ch}" width="${cw-2}" height="${ch-2}" fill="hsl(${35+h*0.6},70%,${20+h*0.18}%)"/><text x="${x0+i*cw+cw/2}" y="${y0+j*ch+ch/2+4}" fill="#0d1218" font-size="11" text-anchor="middle" font-weight="bold">${T.toFixed(0)}</text>`;});});
  let xl=''; Rs.forEach((R,i)=>xl+=`<text x="${x0+i*cw+cw/2}" y="${y0+Ns.length*ch+16}" fill="${STEEL}" font-size="11" text-anchor="middle">R=${R}</text>`);
  let yl=''; Ns.forEach((N,j)=>yl+=`<text x="${x0-8}" y="${y0+j*ch+ch/2+4}" fill="${STEEL}" font-size="11" text-anchor="end">${N}d</text>`);
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">capacidad (N·m): radial × axial</text>
  ${cells}${xl}${yl}
  <text x="${x0}" y="${y0+Ns.length*ch+34}" fill="${BLUE}" font-size="11">→ radial R (cuadrático)    ↓ axial nº discos (lineal)    [t=6mm]</text>`;
}
// Panel 2: torques por junta + discos asignados
function joints(){
  const x0=40,y0=70,bw=80; const Tmax=Math.max(...tq.jointTorque_Nm)*1.1;
  let bars=''; arm.joints.forEach((jt,i)=>{const x=x0+i*150;const h=160*jt.torqueReq_Nm/Tmax;
    bars+=`<rect x="${x}" y="${y0+160-h}" width="${bw}" height="${h}" fill="${[RED,GOLD,GREEN][i]}" rx="4"/>
    <text x="${x+bw/2}" y="${y0+160-h-8}" fill="${[RED,GOLD,GREEN][i]}" font-size="13" text-anchor="middle" font-weight="bold">${jt.torqueReq_Nm} N·m</text>
    <text x="${x+bw/2}" y="${y0+178}" fill="${STEEL}" font-size="12" text-anchor="middle">${jt.joint}</text>
    <text x="${x+bw/2}" y="${y0+196}" fill="${GOLD}" font-size="12" text-anchor="middle">R${jt.R} · ${jt.N} discos</text>
    <text x="${x+bw/2}" y="${y0+212}" fill="${BLUE}" font-size="10" text-anchor="middle">×${jt.margin} margen</text>`;});
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">carga por junta → discos (SF 2.5, robusto)</text>
  <text x="20" y="46" fill="${STEEL}" font-size="11">brazo ${armKinematics(LINKS).reach_m}m · ${tq.armMass_kg}kg + 0.5kg carga</text>${bars}`;
}
// Panel 3: la combinación radial+axial
function combo(){
  return `<text x="20" y="26" fill="${GOLD}" font-size="14" font-weight="bold">combinar radial + axial (lo que pediste)</text>
  <text x="20" y="56" fill="${BLUE}" font-size="12">RADIAL (R²): eficiente, corto → fácil de centrar. Pero R grande = junta gorda.</text>
  <text x="20" y="80" fill="${VIOLET}" font-size="12">AXIAL (N): reparte la carga → robusto, cada disco menos cargado. Pero eje más largo.</text>
  <line x1="20" y1="96" x2="540" y2="96" stroke="${GOLD}33"/>
  <text x="20" y="124" fill="${GREEN}" font-size="13" font-weight="bold">★ La receta: R proporcional al brazo + 3 discos</text>
  <text x="36" y="146" fill="${STEEL}" font-size="12">hombro: R${arm.joints[0].R} + ${arm.joints[0].N} discos (pila ${arm.joints[0].stackLength_mm}mm) → ${arm.joints[0].capacity_Nm} N·m</text>
  <text x="36" y="166" fill="${STEEL}" font-size="12">la carga se reparte en ${arm.joints[0].N} contactos × menos esfuerzo c/u = ROBUSTO</text>
  <text x="36" y="186" fill="${STEEL}" font-size="12">+ eje corto (pila ${arm.joints[0].stackLength_mm}mm) = se autocentra con los conos</text>
  <text x="20" y="214" fill="${RED}" font-size="11">si necesitas MÁS torque: sube R (cuadrático) antes que muchos discos (eje flojo)</text>`;
}
const svg=(w,h,i)=>`<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${i}</svg>`;
const html=`<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}.wide{grid-column:1/-1}</style></head>
<body><h1>Brazo de 3 eslabones — pruebas de carga + tamaño óptimo</h1><div class="sub">Capacidad ∝ N·t·R². Hombro 8.5 N·m → R proporcional + 3 discos (axial reparte, robusto) con eje corto que se autocentra.</div>
<div class="grid"><div class="card">${svg(440,300,heat())}</div><div class="card">${svg(540,300,joints())}</div><div class="card wide">${svg(900,230,combo())}</div></div></body></html>`;
fs.writeFileSync(`${D}/brazo.html`,html); console.log('VIZ ok → '+D+'/brazo.html');
