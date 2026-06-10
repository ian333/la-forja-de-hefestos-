import { describe, it, expect } from 'vitest';
import { TABLEROS, aplicarControl, type TableroArmado } from '../recetas-armadas';
import { buildNetlist } from '../protoboard';
import { skuById } from '../catalogo';
import { dcOperatingPoint } from '@/lib/circuitos/spice';

/**
 * Corriente por el LED = corriente por su resistor en serie (robusto, sale
 * directo de Ohm sobre los nodos; no depende de la exponencial del diodo).
 * El resistor en serie es el que comparte EXACTAMENTE un nodo con el LED.
 */
function ledCurrent(t: TableroArmado, valorControl?: number): number {
  let placements = t.placements;
  if (valorControl != null && t.interactives[0]) {
    placements = aplicarControl(placements, t.interactives[0], valorControl);
  }
  const net = buildNetlist(placements, t.jumpers);
  const op = dcOperatingPoint(net.circuit);
  expect(op, `${t.recetaId}: el circuito debe resolver`).not.toBeNull();
  const ledPins = net.nodePin.get('led');
  if (!ledPins) return 0;
  const ledNodes = new Set(ledPins);
  for (const p of placements) {
    if (skuById(p.skuId)?.spice?.kind !== 'R') continue;
    const rp = net.nodePin.get(p.id);
    if (!rp) continue;
    const shared = rp.filter((n) => ledNodes.has(n)).length;
    if (shared === 1) {
      const ohms = (skuById(p.skuId)!.spice as { kind: 'R'; ohms: number }).ohms;
      return Math.abs((op!.v[rp[0]] ?? 0) - (op!.v[rp[1]] ?? 0)) / ohms;
    }
  }
  return 0;
}

describe('tableros armados — circuitos útiles que SÍ corren', () => {
  it('hay tableros y cada uno construye un netlist sin warnings críticos', () => {
    expect(TABLEROS.length).toBeGreaterThanOrEqual(4);
    for (const t of TABLEROS) {
      const net = buildNetlist(t.placements, t.jumpers);
      // sin fuente sería crítico; estos siempre la tienen
      expect(net.warnings.some((w) => w.includes('fuente'))).toBe(false);
      expect(dcOperatingPoint(net.circuit), t.recetaId).not.toBeNull();
      // todo control apunta a una pieza que existe
      for (const it of t.interactives) {
        expect(t.placements.some((p) => p.id === it.placementId)).toBe(true);
      }
    }
  });

  it('LUZ NOCTURNA: prende a oscuras, apaga con luz', () => {
    const t = TABLEROS.find((x) => x.recetaId === 'luz-nocturna')!;
    const iOscuro = ledCurrent(t, 0.0);  // noche
    const iDia = ledCurrent(t, 1.0);     // pleno sol
    expect(iOscuro).toBeGreaterThan(0.01);  // LED claramente encendido (>10 mA)
    expect(iDia).toBeLessThan(0.001);        // prácticamente apagado
  });

  it('ALARMA DE CALOR: dispara al calentar, callada en frío', () => {
    const t = TABLEROS.find((x) => x.recetaId === 'alarma-calor')!;
    const iFrio = ledCurrent(t, 15);   // 15 °C
    const iCaliente = ledCurrent(t, 85); // 85 °C
    expect(iCaliente).toBeGreaterThan(0.01);
    expect(iCaliente).toBeGreaterThan(iFrio * 5); // la alarma sube claramente con el calor
  });

  it('DIMMER: más resistencia de la perilla = menos corriente en el LED', () => {
    const t = TABLEROS.find((x) => x.recetaId === 'dimmer-led')!;
    const iBrillante = ledCurrent(t, 0.05); // poca R
    const iTenue = ledCurrent(t, 0.95);     // mucha R
    expect(iBrillante).toBeGreaterThan(iTenue);
    expect(iBrillante).toBeGreaterThan(0.005);
  });

  it('PROBADOR DE PILAS: brilla con pila buena, muere con pila baja', () => {
    const t = TABLEROS.find((x) => x.recetaId === 'indicador-bateria')!;
    const iBuena = ledCurrent(t, 9);
    const iMuerta = ledCurrent(t, 1.2); // por debajo del gap del LED rojo
    expect(iBuena).toBeGreaterThan(0.01);
    expect(iMuerta).toBeLessThan(0.0005);
  });
});
