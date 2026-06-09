import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import CircuitSimulator from '../CircuitSimulator';
import NovaLab from '../NovaLab';

// Smoke test: monta cada componente en el servidor (corre toda la ruta de
// render — useState/useMemo, motor MNA, esquemático SVG — sin DOM ni rAF).
// Cataloga crashes de render; no reemplaza el typecheck completo en iangpu.

describe('render smoke — Electrónica & Circuitos', () => {
  it('CircuitSimulator monta y dibuja el esquemático + voltajes', () => {
    const html = renderToStaticMarkup(createElement(CircuitSimulator));
    expect(html).toContain('Esquemático');
    expect(html).toContain('Divisor de voltaje'); // tab del primer preset
    expect(html).toMatch(/V<\/text>|V<\/tspan>|\dV/);  // alguna lectura de voltaje
  });

  it('NovaLab monta y dibuja el PCB + prácticas', () => {
    const html = renderToStaticMarkup(createElement(NovaLab));
    expect(html).toContain('NOVA OMNI');
    expect(html).toContain('RP2350');
    expect(html).toContain('Hola mundo'); // primera práctica
    expect(html).toContain('GP25');        // código real del blink
  });
});
