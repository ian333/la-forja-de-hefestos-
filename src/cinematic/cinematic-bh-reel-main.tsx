/**
 * Entry del comercial por BEATS — "El fotón que cae".
 *
 * Monta CinematicBHReel con la cadena por defecto (el comercial del brief:
 * B1 completo → B2/B3 recortados → cola de B4). El render offline lo maneja por
 * window.__cinematicBHReel.renderAt(t).
 *
 * ── REGISTRO EN VITE (hacer a mano, NO se edita vite.config.ts aquí) ─────────
 * Crear el HTML de entrada `cinematic-bh-reel.html` en la raíz del repo (junto a
 * cinematic-bh.html), apuntando a este módulo:
 *
 *   <!DOCTYPE html>
 *   <html lang="es" translate="no">
 *   <head>
 *     <meta charset="UTF-8" />
 *     <title>El fotón que cae · Cinematic Reel · La Forja</title>
 *     <style>html,body,#root{height:100%;margin:0;padding:0;background:#000;overflow:hidden}</style>
 *   </head>
 *   <body>
 *     <div id="root"></div>
 *     <script type="module" src="/src/cinematic/cinematic-bh-reel-main.tsx"></script>
 *   </body>
 *   </html>
 *
 * Y añadir el input a vite.config.ts (rollupOptions.input), junto a los demás
 * cinematic-*:
 *
 *   "cinematic-bh-reel": resolve(import.meta.dirname, "cinematic-bh-reel.html"),
 *
 * ── RENDER OFFLINE (en iangpu) ───────────────────────────────────────────────
 *   node scripts/render-cinematic.cjs \
 *     --url http://localhost:4173/cinematic-bh-reel.html \
 *     --out bh-reel --duration 34 --fps 24 --subframes 8 --hook __cinematicBHReel
 *
 * (duration = la duración total de la cadena; léela de window.__cinematicBHReel
 *  .duration. El cache por beat se hace por window.__cinematicBHReel.beats[].)
 */

import { createRoot } from 'react-dom/client';
import CinematicBHReel from './CinematicBHReel';
import '../main.css';

createRoot(document.getElementById('root')!).render(<CinematicBHReel />);
