/** mold-interference.cjs — CHECK NUMÉRICO: ¿alguna placa se mete en otra? (bbox Z). */
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:5178/forja-brep.html';
(async () => {
  const b = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome-stable',
    args: ['--no-sandbox','--headless=new','--ignore-gpu-blocklist','--enable-gpu','--use-angle=gl','--window-size=1400,900'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  try {
    await p.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await p.waitForFunction('!!(window.__forgeBrep && window.__forgeBrep.moldGeom)', { timeout: 120000 });
    // esperar a que el molde (Tupper de mold-live.json) esté armado
    await p.waitForFunction('window.__forgeBrep.moldGeom().length > 5', { timeout: 60000 }).catch(()=>{});
    await p.waitForTimeout(1500);
    const geom = await p.evaluate(() => window.__forgeBrep.moldGeom());
    // placas del STACK (deben apilarse, NO traslaparse en Z)
    const PLATE_ROLES = ['bottom','ejector','ejector-ret','support','B','A','clamp'];
    const plates = geom.filter((g) => PLATE_ROLES.includes(g.role) || /^Placa/i.test(g.name));
    const zr = plates.map((g) => ({ role: g.role, name: g.name.slice(0,26), z0: g.min[2], z1: g.max[2] }))
      .sort((a,b)=>a.z0-b.z0);
    const eps = 0.4;
    const overlaps = [];
    for (let i=0;i<zr.length;i++) for (let j=i+1;j<zr.length;j++){
      const a=zr[i], c=zr[j];
      const ov = Math.min(a.z1,c.z1) - Math.max(a.z0,c.z0);
      if (ov > eps) overlaps.push({ a:`${a.role}[${a.z0},${a.z1}]`, b:`${c.role}[${c.z0},${c.z1}]`, overlapMm:+ov.toFixed(2) });
    }
    const pins = geom.find((g)=>g.role==='pines');
    const A = zr.find(z=>z.role==='A'), B = zr.find(z=>z.role==='B');
    const parting = A ? A.z0 : (B ? B.z1 : null);
    // TODAS las partes con su bbox completo, ordenadas por z
    const all = geom.map((g)=>({ role:g.role, x:[g.min[0],g.max[0]], y:[g.min[1],g.max[1]], z:[g.min[2],g.max[2]] }))
      .sort((a,b)=>a.z[0]-b.z[0]);
    // rieles/pilares vs placa EXPULSORA: ¿pasan por [40,71] sin librar? (traslape 3D)
    const ej = geom.find(g=>g.role==='ejector'), ret = geom.find(g=>g.role==='ejector-ret');
    const box3 = (a,b)=>{ const ov=(k)=>Math.min(a.max[k],b.max[k])-Math.max(a.min[k],b.min[k]); const oz=ov(2),ox=ov(0),oy=ov(1); return (oz>eps&&ox>eps&&oy>eps)?{oz:+oz.toFixed(1),ox:+ox.toFixed(1),oy:+oy.toFixed(1)}:null; };
    const ejInterf = [];
    for (const g of geom){ if(['ejector','ejector-ret','pines'].includes(g.role)) continue;
      for (const plate of [ej,ret].filter(Boolean)){ const o=box3(g,plate); if(o) ejInterf.push({parte:g.role, placa:plate.role, ov:o}); } }
    const out = {
      nParts: geom.length,
      stackZ: zr,
      overlaps,
      pines: pins ? { z:[pins.min[2],pins.max[2]], parting, cruzaParting: parting!=null && pins.max[2] > parting + eps } : 'NO HAY PINES',
      ejectorPlateInterf: ejInterf,   // ¿algo interpenetra la placa expulsora/retenedora?
      allParts: all,
    };
    console.log(JSON.stringify(out, null, 2));
  } catch (e) { console.log(JSON.stringify({ fatal: String(e).slice(0,300) }, null, 2)); }
  finally { await b.close(); }
})();
