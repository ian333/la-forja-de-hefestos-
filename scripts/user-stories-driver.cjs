#!/usr/bin/env node
/**
 * user-stories-driver.cjs — 10 user stories E2E del flujo de CUENTA + COBRO.
 * Corre EN iangpu (navegador + vite). API mockeada (deterministas). Cada historia:
 * setup → navega → actúa → ASSERT (pasa/falla) → screenshot.
 * Salida: /tmp/cad-us/ (shots/US##.png + report.json)
 */
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/cad-us';
const SHOTS = path.join(OUT, 'shots');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(SHOTS, { recursive: true });
const BASE = process.env.UI_BASE || 'http://localhost:5001';
const results = [];

const ME = (over) => ({ email: 'x@x.com', name: null, has_customer: false, access: { active_plans: [], active: false }, subscription: null, ...over });

async function vis(page, text, timeout = 8000) {
  await page.getByText(text, { exact: false }).first().waitFor({ state: 'visible', timeout });
}
async function waitFor(fn, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('timeout esperando condición');
}

async function story(browser, id, name, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.route(/checkout\.stripe\.com/, r => r.abort());           // no salir a Stripe
  const page = await ctx.newPage();
  let pass = true, err = null;
  try { await fn(page, ctx); } catch (e) { pass = false; err = String(e.message || e).slice(0, 280); }
  try { await page.screenshot({ path: path.join(OUT, `shots/${id}.png`) }); } catch (e) {}
  results.push({ id, name, pass, err, shot: `shots/${id}.png` });
  console.log(`  ${pass ? '✅' : '❌'} ${id} — ${name}${err ? '  («' + err + '»)' : ''}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--no-sandbox', '--ignore-gpu-blocklist'] });

  // US1 — Visitante ve los planes y el contenido gratis
  await story(browser, 'US01', 'Visitante ve planes + contenido gratis', async (page) => {
    await page.goto(`${BASE}/precios.html`, { waitUntil: 'domcontentloaded' });
    await vis(page, 'El contenido es gratis');
    await vis(page, 'GAIA Laboratorios');
    await vis(page, 'GAIA Física + CAD');
  });

  // US2 — Elegir un plan abre el modal de correo
  await story(browser, 'US02', 'Elegir plan abre el modal de correo', async (page) => {
    await page.goto(`${BASE}/precios.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Entrar por \$100/ }).click();
    await page.getByPlaceholder('tu@correo.com').waitFor({ state: 'visible', timeout: 6000 });
  });

  // US3 — Checkout llama a la API con plan+correo correctos
  await story(browser, 'US03', 'Checkout llama a la API con plan+correo', async (page) => {
    let body = null;
    await page.route('**/checkout', async (route) => { body = route.request().postDataJSON(); await route.fulfill({ json: { checkout_url: 'https://checkout.stripe.com/c/pay/cs_test' } }); });
    await page.goto(`${BASE}/precios.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Entrar por \$100/ }).click();
    await page.getByPlaceholder('tu@correo.com').fill('ana@ipn.mx');
    await page.getByRole('checkbox').check();                 // aceptar T&C (gate legal)
    await page.getByRole('button', { name: /Continuar al pago/ }).click();
    await waitFor(() => body && body.plan === 'GAIA_LABS' && body.email === 'ana@ipn.mx');
  });

  // US4 — Correo inválido es rechazado sin llamar a la API
  await story(browser, 'US04', 'Correo inválido rechazado sin llamar API', async (page) => {
    let called = false;
    await page.route('**/checkout', (r) => { called = true; return r.fulfill({ json: {} }); });
    await page.goto(`${BASE}/precios.html`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Entrar por \$100/ }).click();
    await page.getByPlaceholder('tu@correo.com').fill('sin-arroba');
    await page.getByRole('checkbox').check();                 // habilita el botón; el correo inválido debe frenar igual
    await page.getByRole('button', { name: /Continuar al pago/ }).click();
    await vis(page, 'correo válido');
    if (called) throw new Error('la API fue llamada con correo inválido');
  });

  // US5 — 1-click con sesión: va directo a Stripe sin pedir correo
  await story(browser, 'US05', '1-click con sesión (sin pedir correo)', async (page, ctx) => {
    await page.route('**/auth/me', (r) => r.fulfill({ json: ME({ email: 'ya@unam.mx' }) }));
    let body = null;
    await page.route('**/checkout', async (route) => { body = route.request().postDataJSON(); await route.fulfill({ json: { checkout_url: 'https://checkout.stripe.com/c/pay/cs_1c' } }); });
    await ctx.addInitScript(() => localStorage.setItem('gaia_session', 'fake.jwt'));
    await page.goto(`${BASE}/precios.html`, { waitUntil: 'domcontentloaded' });
    await vis(page, 'ya@unam.mx');                         // indicador de sesión en el header
    await page.getByRole('button', { name: /Desbloquear/ }).click();
    await vis(page, 'Pagas como');                         // 1-click: NO vuelve a pedir el correo
    await page.getByRole('checkbox').check();              // solo confirmar T&C
    await page.getByRole('button', { name: /Continuar al pago/ }).click();
    await waitFor(() => body && body.plan === 'GAIA_FISICA_CAD' && body.email === 'ya@unam.mx');
  });

  // US6 — Login magic-link: pedir enlace muestra "revisa tu correo"
  await story(browser, 'US06', 'Login magic-link → "revisa tu correo"', async (page) => {
    await page.route('**/auth/request-link', (r) => r.fulfill({ json: { sent: true } }));
    await page.goto(`${BASE}/cuenta.html`, { waitUntil: 'domcontentloaded' });
    await vis(page, 'Entra a GAIA');
    await page.getByPlaceholder('tu@correo.com').fill('estu@ipn.mx');
    await page.getByRole('button', { name: /Enviarme el enlace/ }).click();
    await vis(page, 'Revisa tu correo');
  });

  // US7 — Cuenta con sesión, SIN plan → upsell a planes
  await story(browser, 'US07', 'Cuenta sin plan muestra upsell', async (page, ctx) => {
    await page.route('**/auth/me', (r) => r.fulfill({ json: ME({ email: 'nuevo@x.com' }) }));
    await ctx.addInitScript(() => localStorage.setItem('gaia_session', 'fake.jwt'));
    await page.goto(`${BASE}/cuenta.html`, { waitUntil: 'domcontentloaded' });
    await vis(page, 'nuevo@x.com');
    await vis(page, 'Ver planes');
  });

  // US8 — Cuenta con plan ACTIVO muestra la suscripción + gestionar
  await story(browser, 'US08', 'Cuenta con plan activo muestra suscripción', async (page, ctx) => {
    const sub = { plan: 'GAIA_FISICA_CAD', plan_name: 'GAIA Física + CAD', status: 'active', cancel_at_period_end: false, current_period_end: 1790000000, amount: 30000, currency: 'mxn', interval: 'month' };
    await page.route('**/auth/me', (r) => r.fulfill({ json: ME({ email: 'pro@unam.mx', has_customer: true, access: { active_plans: ['GAIA_FISICA_CAD'], active: true }, subscription: sub }) }));
    await ctx.addInitScript(() => localStorage.setItem('gaia_session', 'fake.jwt'));
    await page.goto(`${BASE}/cuenta.html`, { waitUntil: 'domcontentloaded' });
    await vis(page, 'GAIA Física + CAD');
    await vis(page, 'Activa');
    await vis(page, 'Gestionar');
  });

  // US9 — Editar el nombre del perfil y que persista
  await story(browser, 'US09', 'Editar nombre del perfil', async (page, ctx) => {
    await page.route('**/auth/me', (r) => {
      if (r.request().method() === 'PATCH') return r.fulfill({ json: { email: 'edit@x.com', name: 'Ana López' } });
      return r.fulfill({ json: ME({ email: 'edit@x.com' }) });
    });
    await ctx.addInitScript(() => localStorage.setItem('gaia_session', 'fake.jwt'));
    await page.goto(`${BASE}/cuenta.html`, { waitUntil: 'domcontentloaded' });
    await page.getByText('Agrega tu nombre').click();
    await page.getByPlaceholder('Tu nombre').fill('Ana López');
    await page.getByRole('button', { name: /Guardar/ }).click();
    await vis(page, 'Ana López');
  });

  // US10 — Sesión expirada (401) limpia y vuelve al login
  await story(browser, 'US10', 'Sesión expirada (401) vuelve al login', async (page, ctx) => {
    await page.route('**/auth/me', (r) => r.fulfill({ status: 401, json: { detail: 'Sesión inválida o expirada.' } }));
    await ctx.addInitScript(() => localStorage.setItem('gaia_session', 'expirada'));
    await page.goto(`${BASE}/cuenta.html`, { waitUntil: 'domcontentloaded' });
    await vis(page, 'Entra a GAIA');
  });

  await browser.close();
  const passed = results.filter(r => r.pass).length;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ when: new Date().toISOString(), passed, total: results.length, results }, null, 2));
  console.log(`\n══ ${passed}/${results.length} user stories PASARON ══`);
  process.exit(passed === results.length ? 0 : 1);
})().catch(e => { console.error('DRIVER FATAL:', e.message || e); process.exit(2); });
