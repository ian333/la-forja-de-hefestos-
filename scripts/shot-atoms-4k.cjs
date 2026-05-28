#!/usr/bin/env node
/**
 * shot-atoms-4k.cjs — Screenshot 4K de átomos seleccionados de la tabla periódica.
 *
 * Abre lab.html, selecciona cada elemento, oculta UI (dock + header),
 * espera a que el átomo renderice, y captura en 3840×2160.
 *
 * Uso en iangpu:
 *   DISPLAY=:0 GALLIUM_DRIVER=d3d12 MESA_D3D12_DEFAULT_ADAPTER_NAME=NVIDIA \
 *     node scripts/shot-atoms-4k.cjs
 */

'use strict';

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const W = 3840;
const H = 2160;
const BASE_URL = process.env.BASE_URL || 'http://localhost:5174';
const OUT_DIR = path.join(__dirname, '..', 'dist-video', 'atoms-4k');

// Elementos interesantes: los que tienen orbitales visualmente distintos
// Z, nombre, descripción
const ATOMS = [
  [1,  'H',  'Hidrógeno — 1s¹'],
  [2,  'He', 'Helio — 1s²'],
  [6,  'C',  'Carbono — 2s²2p²'],
  [7,  'N',  'Nitrógeno — 2s²2p³'],
  [8,  'O',  'Oxígeno — 2s²2p⁴'],
  [10, 'Ne', 'Neón — 2s²2p⁶'],
  [11, 'Na', 'Sodio — 3s¹'],
  [14, 'Si', 'Silicio — 3s²3p²'],
  [15, 'P',  'Fósforo — 3s²3p³'],
  [16, 'S',  'Azufre — 3s²3p⁴'],
  [17, 'Cl', 'Cloro — 3s²3p⁵'],
  [18, 'Ar', 'Argón — 3s²3p⁶'],
  [20, 'Ca', 'Calcio — 4s²'],
  [22, 'Ti', 'Titanio — 3d²4s²'],
  [24, 'Cr', 'Cromo — 3d⁵4s¹'],
  [26, 'Fe', 'Hierro — 3d⁶4s²'],
  [29, 'Cu', 'Cobre — 3d¹⁰4s¹'],
  [30, 'Zn', 'Zinc — 3d¹⁰4s²'],
  [33, 'As', 'Arsénico — 4s²3d¹⁰4p³'],
  [35, 'Br', 'Bromo — 4s²3d¹⁰4p⁵'],
  [36, 'Kr', 'Kriptón — 4s²3d¹⁰4p⁶'],
  [47, 'Ag', 'Plata — 4d¹⁰5s¹'],
  [53, 'I',  'Yodo — 5s²4d¹⁰5p⁵'],
  [54, 'Xe', 'Xenón — 5s²4d¹⁰5p⁶'],
  [74, 'W',  'Wolframio — 4f¹⁴5d⁴6s²'],
  [79, 'Au', 'Oro — 4f¹⁴5d¹⁰6s¹'],
  [82, 'Pb', 'Plomo — 4f¹⁴5d¹⁰6s²6p²'],
  [92, 'U',  'Uranio — 5f³6d¹7s²'],
];

const LAUNCH_ARGS = [
  '--no-sandbox',
  '--headless=new',
  '--ignore-gpu-blocklist',
  '--enable-gpu', '--enable-gpu-rasterization', '--enable-zero-copy',
  '--enable-webgl', '--enable-accelerated-2d-canvas',
  '--disable-software-rasterizer',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  `--window-size=${W},${H}`,
];

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`\n⚛  Atom 4K Screenshot Capture`);
  console.log(`   ${W}×${H} · ${ATOMS.length} elements · GPU render\n`);

  const browser = await chromium.launch({
    headless: false,
    executablePath: '/usr/bin/google-chrome-stable',
    args: LAUNCH_ARGS,
  });

  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });

  const page = await ctx.newPage();

  // Navigate to lab
  console.log(`  → loading ${BASE_URL}/lab.html`);
  await page.goto(`${BASE_URL}/lab.html`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  // Hide dock (periodic table sidebar) and header for clean captures
  await page.evaluate(() => {
    // Hide header
    const header = document.querySelector('header');
    if (header) header.style.display = 'none';
    // Hide dock/sidebar
    const aside = document.querySelector('aside');
    if (aside) aside.style.display = 'none';
    // Hide all overlay panels (info badges, etc)
    document.querySelectorAll('[class*="absolute"]').forEach(el => {
      if (el.closest && el.closest('canvas')) return;
      if (el.tagName === 'CANVAS') return;
      if (el.classList.contains('fixed') && el.style.pointerEvents === 'none') return;
      const rect = el.getBoundingClientRect();
      if (rect.width < window.innerWidth * 0.5 && rect.height < window.innerHeight * 0.5) {
        el.style.display = 'none';
      }
    });
  });

  for (const [z, symbol, desc] of ATOMS) {
    console.log(`  ⚛ Z=${z} ${symbol} — ${desc}`);

    // Show dock, find and click the element button by its symbol
    await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (aside) aside.style.display = '';
    });
    await page.waitForTimeout(300);

    // Click element by symbol text content
    const clicked = await page.evaluate((sym) => {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        const bold = btn.querySelector('[class*="font-bold"]');
        if (bold && bold.textContent.trim() === sym) {
          btn.click();
          return true;
        }
      }
      return false;
    }, symbol);

    if (!clicked) {
      console.log(`    ⚠ could not click ${symbol}, skipping`);
      continue;
    }

    // Hide dock again
    await page.evaluate(() => {
      const aside = document.querySelector('aside');
      if (aside) aside.style.display = 'none';
      // Re-hide overlays
      document.querySelectorAll('[class*="absolute"]').forEach(el => {
        if (el.closest && el.closest('canvas')) return;
        if (el.tagName === 'CANVAS') return;
        if (el.classList.contains('fixed') && el.style.pointerEvents === 'none') return;
        const rect = el.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.5 && rect.height < window.innerHeight * 0.5) {
          el.style.display = 'none';
        }
      });
      // Also hide the subshell toggle panel
      document.querySelectorAll('[class*="bg-black"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width < 400 && rect.height < 400) el.style.display = 'none';
      });
    });

    // Wait for orbital cloud to render
    await page.waitForTimeout(4000);

    // Screenshot
    const filename = `atom-${String(z).padStart(3, '0')}-${symbol}.png`;
    await page.screenshot({
      path: path.join(OUT_DIR, filename),
      type: 'png',
    });
    console.log(`    ✓ ${filename}`);
  }

  await browser.close();
  console.log(`\n✓ Done! ${ATOMS.length} screenshots in ${OUT_DIR}\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
