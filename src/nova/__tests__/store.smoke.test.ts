import { describe, it, expect, beforeAll } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';

// SSR smoke: monta la tienda completa sin DOM. Atrapa imports rotos y crashes
// de render. localStorage no existe en node → stub mínimo.
beforeAll(() => {
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
});

describe('NovaStore — smoke SSR', () => {
  it('monta y muestra hero, kits, catálogo y footer', async () => {
    const { default: NovaStore } = await import('../NovaStore');
    const html = renderToStaticMarkup(createElement(NovaStore));
    expect(html).toContain('NOVA');
    expect(html).toContain('ya sabes usar');           // hero
    expect(html).toContain('Luz nocturna');            // kit estrella
    expect(html).toContain('42 piezas');               // catálogo
    expect(html).toContain('pruébalo gratis');          // CTA diferenciador
    expect(html).toContain('24-48');                    // badge entrega
    expect(html).toContain('gaiaprime');                // marca
  });

  it('los 42 SKUs del catálogo se renderizan', async () => {
    const { CATALOGO } = await import('@/lib/nova/catalogo');
    const { default: NovaStore } = await import('../NovaStore');
    const html = renderToStaticMarkup(createElement(NovaStore));
    // cada SKU aparece por su id (placa de especificación)
    const missing = CATALOGO.filter((s) => !html.includes(s.id));
    expect(missing.map((s) => s.id)).toEqual([]);
  });
});
