/**
 * Entry del comercial de cine del QUÁSAR — "La batería rotacional del universo".
 *
 * Monta CinematicQuasar (escena DETERMINISTA por beats, 9:16). El render offline
 * lo maneja por window.__cinematicQuasar.renderAt(t).
 *
 * ── REGISTRO EN VITE (hacer a mano, NO se edita vite.config.ts aquí) ─────────
 * El HTML de entrada `cinematic-quasar.html` ya existe en la raíz del repo (junto
 * a cinematic-bh.html), apuntando a este módulo. Falta SOLO añadir el input a
 * vite.config.ts (rollupOptions.input), junto a los demás cinematic-*:
 *
 *   "cinematic-quasar": resolve(import.meta.dirname, "cinematic-quasar.html"),
 *
 * (Va justo después de "cinematic-bh-reel" en el bloque input de vite.config.ts.)
 *
 * ── RENDER OFFLINE (en iangpu — el ÚNICO nodo R3F-headless-GPU) ──────────────
 * Recordar: iangpu tiene su PROPIO filesystem → scp el source editado ANTES del
 * vite build, si no el video sale con código viejo. Render frame a frame:
 *
 *   node scripts/render-cinematic.cjs \
 *     --url http://localhost:4173/cinematic-quasar.html \
 *     --out quasar-reel --duration 33 --fps 24 --subframes 8 --hook __cinematicQuasar
 *
 * (duration = window.__cinematicQuasar.duration = 33s; cache por beat vía
 *  window.__cinematicQuasar.beats[].)
 */

import { createRoot } from 'react-dom/client';
import CinematicQuasar from './CinematicQuasar';
import '../main.css';

createRoot(document.getElementById('root')!).render(<CinematicQuasar />);
