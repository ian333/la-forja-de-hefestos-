/* Visualiza el contacto conforme + el filete. 4 paneles: (A) chaflán agudo (Kt↑, cortante)
   vs filete-curva (Kt↓, continuo), (B) yoyo (punta) vs conforme (abraza), (C) conformidad↑
   → área↑ y presión↓, (D) fricción vs área: PLANA si flota (full-film). Su resultado es un
   vector → se VE. node --import tsx scripts/contacto-viz.ts → forja-shots/contacto/contacto.html */
import * as fs from 'fs';
import { notchKt, eStar, effectiveRadius_mm, hertzLine, frictionForce_N } from '../src/forja/mech/contacto-conforme';

const GOLD = '#d8a657', INK = '#0d1218', STEEL = '#9fb3c8', GREEN = '#7ee081', RED = '#e06c6c', BLUE = '#6fb6c9';
const DIR = '/home/ian/Orkesta/la-forja/forja-shots/contacto';
fs.mkdirSync(DIR, { recursive: true });
const Es = eStar();

// ── Panel A: chaflán AGUDO (Kt↑, cortante) vs FILETE curva (Kt↓, continuo) ──
function filletPanel(): string {
  // izq: esquina aguda con líneas de esfuerzo apretándose; der: filete suave
  const ax = 90, ay = 150, bx = 330, by = 150;
  // Kt curve abajo
  const x0 = 40, y0 = 290, W = 460, H = 70;
  let kt = ''; const rMax = 1.6, ktMax = 8;
  for (let i = 1; i <= 120; i++) { const r = (rMax * i) / 120; const K = Math.min(ktMax, notchKt(1.2, r)); const X = x0 + W * (i / 120); const Y = y0 - (K / ktMax) * H; kt += `${i > 1 ? 'L' : 'M'}${X.toFixed(1)},${Y.toFixed(1)} `; }
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">chaflán AGUDO (cortante) → FILETE curva (continuo)</text>
  <path d="M${ax - 50},${ay - 40} L${ax},${ay - 40} L${ax},${ay + 40} L${ax + 50},${ay + 40}" fill="none" stroke="${STEEL}" stroke-width="3"/>
  ${[0, 1, 2, 3].map(i => `<line x1="${ax - 6 - i * 4}" y1="${ay - 36 + i * 3}" x2="${ax - 2}" y2="${ay - 2 - i * 2}" stroke="${RED}" stroke-width="2"/>`).join('')}
  <circle cx="${ax}" cy="${ay}" r="4" fill="${RED}"/>
  <text x="${ax}" y="${ay + 64}" fill="${RED}" font-size="11" text-anchor="middle">esquina aguda · Kt→∞</text>
  <path d="M${bx - 50},${by - 40} L${bx},${by - 40} Q${bx + 28},${by - 40} ${bx + 28},${by} L${bx + 28},${by + 12} Q${bx + 28},${by + 40} ${bx + 60},${by + 40}" fill="none" stroke="${STEEL}" stroke-width="3"/>
  ${[0, 1, 2, 3].map(i => `<line x1="${bx - 4 - i * 6}" y1="${by - 30 + i * 6}" x2="${bx + 6}" y2="${by - 18 + i * 6}" stroke="${GREEN}" stroke-width="2"/>`).join('')}
  <text x="${bx + 10}" y="${by + 64}" fill="${GREEN}" font-size="11" text-anchor="middle">filete (curva) · Kt bajo</text>
  <path d="${kt}" fill="none" stroke="${GOLD}" stroke-width="2.5"/>
  <text x="${x0}" y="${y0 + 16}" fill="${STEEL}" font-size="11">radio de filete →   (Kt cae al redondear: esfuerzo CONTINUO, no cortante)</text>`;
}

// ── Panel B: YOYO (punta) vs CONFORME (el valle abraza al rodillo) ──
function conformPanel(): string {
  const ax = 130, ay = 150, bx = 380, by = 150, Rr = 34;
  // yoyo: rodillo tocando un vértice (punta) — contacto puntito
  // conforme: rodillo metido en un valle que lo abraza — contacto arco ancho
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">contacto: YOYO (punta) → CONFORME (abraza)</text>
  <circle cx="${ax}" cy="${ay}" r="${Rr}" fill="${STEEL}22" stroke="${STEEL}" stroke-width="2"/>
  <path d="M${ax - 60},${ay + Rr + 30} L${ax},${ay + Rr + 2} L${ax + 60},${ay + Rr + 30}" fill="none" stroke="${GOLD}" stroke-width="3"/>
  <circle cx="${ax}" cy="${ay + Rr + 1}" r="4" fill="${RED}"/>
  <text x="${ax}" y="${ay + Rr + 50}" fill="${RED}" font-size="11" text-anchor="middle">punta · poca área · presión ALTA</text>
  <text x="${ax}" y="${ay - Rr - 8}" fill="${STEEL}" font-size="11" text-anchor="middle">rodillo</text>
  <circle cx="${bx}" cy="${by}" r="${Rr}" fill="${STEEL}22" stroke="${STEEL}" stroke-width="2"/>
  <path d="M${bx - 64},${by + Rr + 26} Q${bx},${by + Rr - 16} ${bx + 64},${by + Rr + 26}" fill="none" stroke="${GOLD}" stroke-width="3"/>
  <path d="M${bx - 26},${by + Rr - 4} A ${Rr} ${Rr} 0 0 0 ${bx + 26},${by + Rr - 4}" fill="none" stroke="${GREEN}" stroke-width="5"/>
  <text x="${bx}" y="${by + Rr + 46}" fill="${GREEN}" font-size="11" text-anchor="middle">valle abraza · MÁS área · presión BAJA</text>
  <text x="40" y="300" fill="${BLUE}" font-size="12">el valle del lóbulo abraza al rodillo → el disco se centra por FUERA también (no yoyo)</text>`;
}

// ── Panel C: conformidad ↑ → ancho (área) ↑ y presión pico ↓ ──
function sweepPanel(): string {
  const x0 = 70, y0 = 250, W = 460, H = 175, Wp = 1733;
  const Rvs: number[] = []; for (let i = 0; i <= 100; i++) Rvs.push(3.06 + (8 - 3.06) * (i / 100)); // valle 3.06→8 (abraza→suelto)
  const data = Rvs.map(Rv => { const Rstar = effectiveRadius_mm(3, Rv); const hz = hertzLine({ Wprime_Npm: Wp, Rstar_mm: Rstar, Estar_Pa: Es }); return { conf: 3 / Rv, w: hz.contactWidth_mm, p: hz.pMax_MPa }; });
  const wMax = Math.max(...data.map(d => d.w)), pMax = Math.max(...data.map(d => d.p));
  // x = conformidad (Rr/Rvalley): 0 (suelto, yoyo) → ~1 (abraza). Mapear conf de min..max.
  const cMin = Math.min(...data.map(d => d.conf)), cMax = Math.max(...data.map(d => d.conf));
  const xC = (c: number) => x0 + W * ((c - cMin) / (cMax - cMin));
  let wC = '', pC = '';
  data.forEach((d, i) => { wC += `${i ? 'L' : 'M'}${xC(d.conf).toFixed(1)},${(y0 - (d.w / wMax) * H).toFixed(1)} `; pC += `${i ? 'L' : 'M'}${xC(d.conf).toFixed(1)},${(y0 - (d.p / pMax) * H).toFixed(1)} `; });
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">más conforme → más ÁREA, menos PRESIÓN</text>
  <line x1="${x0}" y1="${y0}" x2="${x0 + W}" y2="${y0}" stroke="${STEEL}44"/>
  <path d="${wC}" fill="none" stroke="${GREEN}" stroke-width="2.5"/>
  <path d="${pC}" fill="none" stroke="${RED}" stroke-width="2.5"/>
  <text x="${x0 + W}" y="${y0 - (data[data.length - 1].w / wMax) * H - 6}" fill="${GREEN}" font-size="11" text-anchor="end">ancho de contacto (área) ↑</text>
  <text x="${x0 + W}" y="${y0 - (data[data.length - 1].p / pMax) * H + 14}" fill="${RED}" font-size="11" text-anchor="end">presión pico ↓</text>
  <text x="${x0}" y="${y0 + 18}" fill="${STEEL}" font-size="11">← suelto (yoyo)        conformidad Rr/Rvalle        abraza →</text>`;
}

// ── Panel D: fricción vs área — PLANA si flota (full-film), sube si frontera ──
function frictionPanel(): string {
  const x0 = 70, y0 = 240, W = 460, H = 150, load = 10;
  // full-film: F = μ_t·carga (no depende del área) → línea PLANA
  // frontera: aproximamos F que crece con el área real (penaliza)
  const ff = frictionForce_N({ regime: 'full-film', load_N: load });
  const fbBase = frictionForce_N({ regime: 'frontera', load_N: load });
  const fMax = fbBase * 1.6;
  let ffL = '', fbL = '';
  for (let i = 0; i <= 100; i++) { const area = i / 100; const X = x0 + W * area; ffL += `${i ? 'L' : 'M'}${X},${(y0 - (ff / fMax) * H).toFixed(1)} `; const fb = fbBase * (0.7 + 0.9 * area); fbL += `${i ? 'L' : 'M'}${X},${(y0 - (fb / fMax) * H).toFixed(1)} `; }
  return `
  <text x="40" y="26" fill="${GOLD}" font-size="14" font-weight="bold">fricción vs área: PLANA si FLOTA (la clave)</text>
  <line x1="${x0}" y1="${y0}" x2="${x0 + W}" y2="${y0}" stroke="${STEEL}44"/>
  <path d="${fbL}" fill="none" stroke="${RED}" stroke-width="2.5"/>
  <path d="${ffL}" fill="none" stroke="${GREEN}" stroke-width="3"/>
  <text x="${x0 + W}" y="${y0 - (ff / fMax) * H - 8}" fill="${GREEN}" font-size="11" text-anchor="end">FULL-FILM: F = μ_t·carga (área no importa)</text>
  <text x="${x0 + W}" y="${y0 - (fbBase * 1.6 / fMax) * H + 14}" fill="${RED}" font-size="11" text-anchor="end">frontera: F sube con el área (roza)</text>
  <text x="${x0}" y="${y0 + 18}" fill="${STEEL}" font-size="11">área de contacto →</text>
  <text x="40" y="${y0 + 40}" fill="${BLUE}" font-size="12">"más área sin subir fricción" SÓLO si flota → por eso el autocentrado es la condición</text>`;
}

const svg = (w: number, h: number, inner: string) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"><rect width="${w}" height="${h}" fill="${INK}"/>${inner}</svg>`;
const html = `<!doctype html><html><head><meta charset="utf8"><style>body{margin:0;background:${INK};font-family:system-ui;color:${STEEL}}h1{color:${GOLD};text-align:center;padding:16px 0 4px;font-size:21px}.sub{text-align:center;font-size:13px;padding-bottom:10px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:12px}.card{background:#121a22;border:1px solid ${GOLD}33;border-radius:10px;padding:8px}</style></head>
<body><h1>Cicloides: curvas continuas + contacto conforme</h1>
<div class="sub">Chaflán→filete = esfuerzo continuo (no cortante) · valle que abraza = más área, menos presión · y la fricción NO sube si flota.</div>
<div class="grid">
<div class="card">${svg(560, 320, filletPanel())}</div>
<div class="card">${svg(560, 320, conformPanel())}</div>
<div class="card">${svg(560, 290, sweepPanel())}</div>
<div class="card">${svg(560, 300, frictionPanel())}</div>
</div></body></html>`;
fs.writeFileSync(`${DIR}/contacto.html`, html);
console.log('VIZ ok → ' + DIR + '/contacto.html');
