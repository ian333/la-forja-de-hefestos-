/**
 * LA PIEL DEL FUTURO — cyberpunk + holograma de cine (ian, 2026-10-22: «definitivamente cyberpunk combinado con holograma de cine»).
 * ============================================================================
 * Sale de la investigación de tres agentes (Downloads/el-futuro/: cyberpunk · holograma · futuro-real, con contraste WCAG y
 * daltonismo medidos). La mezcla:
 *   · del HOLOGRAMA DE CINE la ESTRUCTURA: vacío azul marino, vidrio, hilos finos, el acero que se vuelve holograma de hielo,
 *     «todo se apaga menos lo que está en duda», la reglita número-contra-límite en cada hallazgo;
 *   · del CYBERPUNK la ENERGÍA: neón con significado — falla ◆ #FF2D55, de panzazo ◇ naranja #FF8A1F, colada magenta — el
 *     AMARILLO DEL OPERADOR #FCEE0A («tú estás aquí»: el paso actual, la tecla, la selección; NUNCA un dato), la barra de los 9
 *     pasos siempre visible, Chakra Petch, y el ruido de pantalla SOLO en el mundo 3D (el número se dibuja limpio).
 * La regla de ian de foco-lentes.ts se queda: CIAN = lo MEDIDO, VIOLETA = lo SIMULADO (más trama, por daltonismo).
 * Falla / aviso / cumple NO se distinguen solo por color: forma (◆ ◇ ✓), signo y palabra («NO CUMPLE»).
 *
 * UNA sola fuente: el CSS del estudio (variables --ds-*), el Foco, la inspección, la transición y los colores del molde leen de aquí.
 */
export const PIEL = {
  fondo: {
    vacio: '#03070B',          // el negro del visor (azul marino casi negro; nunca morado)
    bruma: '#07121A',
    vidrio: 'rgba(6,16,22,0.93)',   // paneles y fichas
    vidrioAlto: 'rgba(12,30,40,0.96)',
    hilo: 'rgba(159,196,214,0.22)', // filetes de 1 px
    hiloFuerte: 'rgba(159,196,214,0.48)',
  },
  texto: { primario: '#E6F1F6', secundario: '#9DB3BF', tenue: '#7A93A3', numero: '#F4FAFC', sobreAcento: '#04060A' },
  /** «tú estás aquí» — el paso actual, la tecla, lo seleccionado. Nunca un dato. */
  operador: '#FCEE0A',
  medido: '#22E1FF',
  simulado: '#B57BFF',
  falla: '#FF2D55', fallaTexto: '#FF8FA3',
  aviso: '#FF8A1F', avisoTexto: '#FFB877',
  cumple: '#E6F1F6',
  mundo: {
    aceroHolo: '#9FC4D6',      // el acero vuelto holograma bajo el Foco (hielo)
    aceroSolido: '#5B6B78',
    pieza: '#EADFC8',          // marfil: el plástico real
    agua: '#2F8CFF',
    colada: '#FF2BD6',         // el plástico caliente en su tubo: neón magenta
    botadores: '#C7D5EA',      // cromo (el latón chocaba con el naranja del aviso)
    bronce: '#86704E',
  },
  /** rampa térmica (brasa → isoterma blanca 97.6 °C → frío) */
  termica: ['#FFF3C2', '#FFC23A', '#FF7A1F', '#FF4527', '#FFFFFF', '#8FA2FF', '#3049FF'],
  fuente: {
    titulo: "'Chakra Petch','Barlow',system-ui,sans-serif",
    cuerpo: "'Barlow',system-ui,sans-serif",
    mono: "'JetBrains Mono',ui-monospace,Menlo,monospace",
  },
} as const;

/** el color de un veredicto, y su forma (nunca solo color) */
export const VEREDICTO_PIEL = {
  falla: { color: PIEL.falla, texto: PIEL.fallaTexto, forma: '◆', palabra: 'NO CUMPLE' },
  aviso: { color: PIEL.aviso, texto: PIEL.avisoTexto, forma: '◇', palabra: 'DE PANZAZO' },
  ok: { color: PIEL.cumple, texto: PIEL.cumple, forma: '✓', palabra: 'CUMPLE' },
} as const;

/** el CSS de la piel: las fuentes (self-hosted, OFL — public/fonts/LICENCIAS-OFL.txt), las variables del estudio y el
 *  ruido de pantalla SOLO sobre el visor 3D. Va DESPUÉS del CSS del estudio: lo pisa por orden, sin tocar sus 600 reglas. */
export const PIEL_CSS = `
@font-face{font-family:'Chakra Petch';font-weight:500;font-display:swap;src:url(/fonts/chakra-petch-500.woff2) format('woff2')}
@font-face{font-family:'Chakra Petch';font-weight:600;font-display:swap;src:url(/fonts/chakra-petch-600.woff2) format('woff2')}
@font-face{font-family:'Chakra Petch';font-weight:700;font-display:swap;src:url(/fonts/chakra-petch-700.woff2) format('woff2')}
@font-face{font-family:'Barlow';font-weight:400;font-display:swap;src:url(/fonts/barlow-400.woff2) format('woff2')}
@font-face{font-family:'Barlow';font-weight:500;font-display:swap;src:url(/fonts/barlow-500.woff2) format('woff2')}
@font-face{font-family:'Barlow';font-weight:600;font-display:swap;src:url(/fonts/barlow-600.woff2) format('woff2')}
@font-face{font-family:'JetBrains Mono';font-weight:100 800;font-display:swap;src:url(/fonts/jetbrains-mono.woff2) format('woff2')}
:root{
  --ds-bg:${PIEL.fondo.vacio}; --ds-panel:#07141B; --ds-panel2:#0C1D27; --ds-raise:#12283A;
  --ds-line:${PIEL.fondo.hilo}; --ds-line2:${PIEL.fondo.hiloFuerte};
  --ds-text:${PIEL.texto.primario}; --ds-dim:${PIEL.texto.secundario}; --ds-faint:${PIEL.texto.tenue};
  --ds-accent:${PIEL.medido}; --ds-accent-ink:#021216; --ds-brand:${PIEL.operador};
  --ds-sky:${PIEL.mundo.agua}; --ds-nebula:${PIEL.simulado};
}
.fb-root{font-family:${PIEL.fuente.cuerpo};}
.fb-header,.fb-ws-tabs button,.fb-tb-row button{font-family:${PIEL.fuente.titulo};letter-spacing:.06em;}
.fb-ws-tabs button.on{color:${PIEL.operador} !important;border-bottom-color:${PIEL.operador} !important;}
/* el riel de los 9 pasos ocupa la franja de arriba del visor: la barra de vistas (ISO·SUP·FRE) baja un renglón */
.fb-hud-view{top:182px !important;}
.fb-root.fb-ribbon-min .fb-hud-view{top:102px !important;}
/* el ruido de pantalla vive SOLO en el mundo 3D: líneas de barrido muy tenues + viñeta (el HUD queda limpio encima) */
.fb-viewport::after{content:'';position:absolute;inset:0;pointer-events:none;z-index:3;
  background:repeating-linear-gradient(0deg,rgba(34,225,255,0.028) 0 1px,transparent 1px 3px),
             radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 60%,rgba(1,8,14,0.55) 100%);}
`;
