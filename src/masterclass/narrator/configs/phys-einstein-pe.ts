/**
 * Callouts del NarratorOverlay para la masterclass Einstein 1905.
 *
 * Mapa sceneId (del manifest.json) → secuencia de callouts sincronizada
 * con audio.currentTime. Cada callout aparece en `atSec` y desaparece en
 * `untilSec` (default atSec+4). Fade automático.
 *
 * Por ahora solo está poblado el '04-lenard' como prototipo. Las demás
 * scenes pueden añadirse aquí sin tocar el componente — el overlay solo
 * actúa donde haya config.
 */

import type { NarratorConfig } from '../types';

export const PHYS_EINSTEIN_PE_CALLOUTS: NarratorConfig = {
  // ═══════════════════════ 04 · LENARD APPARATUS ═══════════════════════
  '04-lenard': {
    callouts: [
      // ─── Intro: título grande ─────────────────────────────────────────
      {
        type: 'big',
        atSec: 0.3,
        untilSec: 3.0,
        at: { x: '50%', y: '38%' },
        text: 'LENARD · 1902',
        subtext: 'el experimento decisivo',
        color: '#FDB813',
      },

      // ─── Etiquetas iniciales: 2.8-7.5s ("Tubo de vacío…voltímetro") ──
      // Aparecen escalonadas según orden en la narración
      {
        type: 'label',
        atSec: 3.0,
        untilSec: 8.5,
        at: { x: '30%', y: '24%' },
        text: 'lámpara UV',
        size: 'md',
        color: '#FACC15',
      },
      {
        type: 'label',
        atSec: 4.2,
        untilSec: 8.5,
        at: { x: '32%', y: '60%' },
        text: 'cátodo · Zn',
        size: 'md',
        color: '#94A3B8',
      },
      {
        type: 'label',
        atSec: 5.5,
        untilSec: 8.5,
        at: { x: '70%', y: '60%' },
        text: 'ánodo colector',
        size: 'md',
        color: '#94A3B8',
      },
      {
        type: 'label',
        atSec: 6.8,
        untilSec: 8.5,
        at: { x: '50%', y: '82%' },
        text: 'amperímetro',
        size: 'md',
        color: '#FDB813',
      },

      // ─── "Aumenta intensidad al doble" (10-13.5s) ────────────────────
      {
        type: 'pulse',
        atSec: 10.0,
        untilSec: 13.8,
        at: { x: '30%', y: '24%' },
        color: '#FACC15',
        maxRadiusPct: 15,
      },
      {
        type: 'big',
        atSec: 10.3,
        untilSec: 13.8,
        at: { x: '50%', y: '22%' },
        text: 'I × 2',
        subtext: 'intensidad al doble',
        color: '#FACC15',
      },

      // ─── "Salen el doble de electrones, la corriente sube" (13.5-19s)
      {
        type: 'spotlight',
        atSec: 14.0,
        untilSec: 19.0,
        center: { x: '50%', y: '82%' },
        radiusPct: 20,
        darken: 0.55,
      },
      {
        type: 'arrow',
        atSec: 14.3,
        untilSec: 19.0,
        at: { x: '50%', y: '78%' },
        dir: 'down',
        text: 'corriente × 2  ↑',
        color: '#22D3EE',
      },
      {
        type: 'pulse',
        atSec: 14.3,
        untilSec: 19.0,
        at: { x: '50%', y: '82%' },
        color: '#22D3EE',
        maxRadiusPct: 10,
      },

      // ─── EL MOMENTO CLAVE: v_max NO CAMBIA (19-25s) ──────────────────
      {
        type: 'big',
        atSec: 19.5,
        untilSec: 25.0,
        at: { x: '50%', y: '45%' },
        text: 'v_max  =  IGUAL',
        subtext: 'la energía por electrón NO depende de la intensidad',
        color: '#EF4444',
        fadeMs: 500,
      },

      // ─── Cierre: "no patea más fuerte, patea más veces" (25-29.5s) ───
      {
        type: 'label',
        atSec: 25.2,
        untilSec: 29.5,
        at: { x: '50%', y: '90%' },
        text: 'patea más veces · NO más fuerte',
        size: 'lg',
        color: '#FDB813',
      },
    ],
  },
};
