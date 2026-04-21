/**
 * 🎨 La Forja — AI-Editable Scene (DIAGNOSTIC MODE — escena vacía)
 * =================================================================
 * Temporalmente en vacío para aislar causa del freeze del navegador.
 * Si con esto carga, el problema era el escritorio+joint demo.
 *
 * Cuando quieras el escritorio de vuelta, restaura del commit anterior
 * o pídele a Claude que lo regenere. El DSL sigue disponible:
 *
 *   export default defineScene((f) => {
 *     f.add(f.box({ size: [1, 0.5, 0.8], at: [0, 0.25, 0], name: 'Caja' }));
 *   });
 */

import { defineScene } from './api';

export default defineScene((_f) => {
  // Escena vacía — el viewport arranca sin work.
});
