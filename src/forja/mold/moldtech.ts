/**
 * TECNOLOGÍAS DE MOLDE §13.9 — selector por la geometría/requisito de la pieza.
 * ==============================================================================
 * El cap 13 del libro es DESCRIPTIVO (survey de tecnologías, sin ecuaciones). Este
 * módulo reproduce los CRITERIOS DE SELECCIÓN del libro (no inventa números): dada
 * la característica que impide un desmoldeo recto, recomienda la tecnología §13.9:
 *
 *  · §13.9.1 SPLIT CAVITY — undercut(s) EXTERNO(s) ⊥ a la apertura: la cavidad se
 *    parte en dos mitades que se separan por acción de leva (gibs en slideways;
 *    ej. bolos, Fig 13.29).
 *  · §13.9.2 COLLAPSIBLE / §13.9.3 ROTATING — rosca/undercut INTERNO: núcleo
 *    colapsable o rotatorio para desenroscar (ver [[project_forja_printinplace_math]]
 *    y unscrewing.ts, que ya trae las ecuaciones de vueltas/torque).
 *  · §13.9.4 REVERSE EJECTION — superficie 100% ESTÉTICA (sin marcas de expulsor):
 *    cavidad al lado MÓVIL, core+expulsores al FIJO, accionados por cilindros
 *    hidráulicos (el rod de la máquina queda del lado inútil; Fig 13.33).
 *  · undercut LATERAL simple → slide/lifter (§11.3.6-7, ver sideactions.ts).
 *
 * PURO: node-testeable. Sólo lógica de decisión (criterios del libro), sin
 * fórmulas inventadas.
 */

export type MoldTech = 'split-cavity' | 'collapsible-core' | 'unscrewing' | 'reverse-ejection' | 'side-action' | 'estandar';

export interface MoldTechChoice { tech: MoldTech; seccion: string; porQue: string; notas: string[] }

/**
 * Recomienda la tecnología de molde §13.9 según la característica de la pieza que
 * complica el desmoldeo. Reproduce los criterios del libro (cap 13).
 */
export function chooseMoldTechnology(feat: {
  externalUndercut?: boolean;        // undercut EXTERNO ⊥ a la apertura (rosca externa, cuello)
  internalThread?: boolean;          // rosca o undercut INTERNO
  fullyAestheticSurface?: boolean;   // toda la cara visible debe quedar sin marcas
  sideUndercut?: boolean;            // undercut lateral simple (ventana, clip)
  internalCollapsible?: boolean;     // undercut interno que colapsa (vs rosca completa)
}): MoldTechChoice {
  const notas: string[] = [];
  // la superficie estética total manda sobre todo (define de qué lado va el core)
  if (feat.fullyAestheticSurface) {
    notas.push('el rod expulsor de la máquina queda del lado móvil (inútil) → cilindros hidráulicos en el fijo (§13.9.4)');
    return { tech: 'reverse-ejection', seccion: '§13.9.4', porQue: 'superficie 100% estética: cavidad al lado móvil, core+expulsores al fijo → la cara opuesta al core sale sin defectos', notas };
  }
  if (feat.externalUndercut) {
    notas.push('la cavidad se parte en 2 mitades sobre gibs/slideways, separadas por leva al abrir (Fig 13.29, bolos)');
    return { tech: 'split-cavity', seccion: '§13.9.1', porQue: 'undercut(s) EXTERNO(s) ⊥ a la apertura que un slide simple no resuelve → molde de cavidad partida', notas };
  }
  if (feat.internalThread) {
    notas.push('ver unscrewing.ts: vueltas=L/paso, torque=μ·ΔT·CTE·E·A·r; muchas cavidades → engranes planetarios');
    return { tech: 'unscrewing', seccion: '§13.9.3', porQue: 'rosca INTERNA: núcleo rotatorio que desenrosca la pieza al expulsar', notas };
  }
  if (feat.internalCollapsible) {
    return { tech: 'collapsible-core', seccion: '§13.9.2', porQue: 'undercut INTERNO que colapsa: núcleo colapsable (6%·⌀, comercial 13-90mm)', notas };
  }
  if (feat.sideUndercut) {
    return { tech: 'side-action', seccion: '§11.3.6-7', porQue: 'undercut lateral simple: slide o lifter accionado por angle pin (ver sideactions.ts)', notas };
  }
  return { tech: 'estandar', seccion: '§11.2', porQue: 'sin undercuts: desmoldeo recto con pines de expulsión estándar', notas };
}
