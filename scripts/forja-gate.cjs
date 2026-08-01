#!/usr/bin/env node
/**
 * La Forja — PORTERO MAESTRO (forja-gate)
 * ========================================
 * UNA sola manera de probar La Forja COMPLETA. Corre todas las suites de
 * verificación del CAD/CAE (kernel B-Rep, FEA, generativo, croquis, planos,
 * impresión) y emite un reporte PASS/FAIL por área + un JSON máquina-legible.
 *
 * Filosofía del proyecto: "compila ≠ funciona". Cada suite valida un INVARIANTE
 * (volumen exacto, Euler V−E+F=2, σ=F/A vs FEA, compliance↓ del generativo,
 * DOF del croquis, HLR de planos), no "se ve bien". El gate falla (exit 1) si
 * cualquier invariante se rompe.
 *
 * ROBUSTO A CWD: se ancla a la raíz del repo vía __dirname y lanza cada hijo con
 * cwd = raíz, así `node --import tsx ...` resuelve `tsx` sin depender del shell.
 * (Un `ssh` pelón cae en $HOME — por eso NO confiamos en el cwd del shell.)
 *
 *   node scripts/forja-gate.cjs              # todas las suites node (sin navegador)
 *   node scripts/forja-gate.cjs --json out.json
 *   node scripts/forja-gate.cjs --only kernel,physics
 *   node scripts/forja-gate.cjs --ui http://localhost:5001/forja-brep.html  # + e2e GPU
 */
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const repoRoot = path.resolve(__dirname, '..');
const NODE = process.execPath;
const VITEST = path.join(repoRoot, 'node_modules', '.bin', 'vitest');

// ── args ────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function argVal(flag) {
  const i = argv.indexOf(flag);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}
const onlyGroups = (argVal('--only') || '').split(',').filter(Boolean);
const jsonOut = argVal('--json');
const uiUrl = argVal('--ui');
const perTimeout = Number(argVal('--timeout') || 200) * 1000;

// ── catálogo de suites ──────────────────────────────────────────────
// group: área del producto · n: nombre · cmd/args · que verifica
const SUITES = [
  { group: 'kernel', n: 'occt-brep',     why: 'caja/cilindro/cut: topología+volumen EXACTO, STEP roundtrip, normales unit',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-brep-test.cjs'] },
  { group: 'kernel', n: 'occt-extrude',  why: 'perfil 2D→sólido: rect & círculo extruidos V/Euler exactos, malla, STEP',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-extrude-test.cjs'] },
  { group: 'kernel', n: 'occt-features', why: 'barreno, revolve (Pappus), shell/vaciado, props de masa, enumerar caras/aristas, fillet/chamfer selectivo',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-features-test.cjs'] },
  { group: 'kernel', n: 'mold-filling', why: 'Kazmer cap 5: ΔP power-law 83.2MPa + clamp 99ton EXACTOS (bezel)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-filling-test.cjs'] },
  { group: 'kernel', n: 'mold-feed', why: 'Kazmer cap 6: hot runner 5.9/8.8/16.7MPa + optimizador R 5.0/4.4/4.4mm EXACTOS',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-feed-test.cjs'] },
  { group: 'kernel', n: 'mold-ejection', why: 'Kazmer cap 11: VECTOR de expulsión (σ/F_normal/F_stick + peso g REAL + cinemática 50mm/s + pandeo Euler); cup 1.8kN/bezel 4.7kN',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-ejection-test.cjs'] },
  { group: 'kernel', n: 'mold-cost', why: 'Kazmer cap 3: break-even cold/hot 615,385 pzas + tabla 3.1 exacta',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-cost-test.cjs'] },
  { group: 'kernel', n: 'mold-shrinkage', why: 'Kazmer cap 10: Tait pvT doble dominio, v(405K,66MPa)=9.65e-4 y s=0.31% EXACTOS (bezel)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-shrinkage-test.cjs'] },
  { group: 'kernel', n: 'mold-structural', why: 'Kazmer cap 12: compresión 17MPa/corte 21.8/flexión 0.056mm EXACTOS + veredicto FLASH',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-structural-test.cjs'] },
  { group: 'kernel', n: 'mold-platesizing', why: 'Kazmer §12.1+§9.2.5 TAMAÑO DE PLACA → placa COMERCIAL: soporte por deflexión (bezel 176mm→optimiza a 36mm/4 pilares), cavidad por enfriamiento (tapa 27mm)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-platesizing-test.cjs'] },
  { group: 'kernel', n: 'mold-machinesizing', why: 'Kazmer §4.3.3+cap5+cap11 TAMAÑO DE MÁQUINA: 4 restricciones (cierre/shot/presión/expulsión) → inyectora comercial; cup 400kN/IM-50, bezel 1400kN/IM-250, expulsión 0.5% del clamp EXACTO',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-machinesizing-test.cjs'] },
  { group: 'kernel', n: 'mold-cores', why: 'Kazmer §12.3 CORES: axial 216MPa/δ0.06, hoop 240MPa + Ø_int máx 31mm fatiga vs 38mm sobrepresión, flexión I 5.1e-7/δ0.03mm + interlock ×0.1 (cup EXACTO)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-cores-test.cjs'] },
  { group: 'kernel', n: 'mold-ejectortypes', why: 'Kazmer §11.3.2-5 TIPOS DE EXPULSOR: blade (pandeo, bezel L_máx 93mm) + sleeve/stripper + undercut elástico (tapa ε1.3%/F1200N/τ1.7MPa EXACTO) + selector por geometría',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-ejectortypes-test.cjs'] },
  { group: 'kernel', n: 'mold-slendercore', why: 'Kazmer §9.3.5 Tabla 9.3 CORES ESBELTOS: selector de enfriamiento axial por Ø de core (inserto/baffle/bubbler/heat-pipe/pin), baffle preferido, pared por §12.3',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-slendercore-test.cjs'] },
  { group: 'kernel', n: 'mold-assembly', why: 'PLANO DE ENSAMBLE: cada pieza calculada como pieza mecánica (11 comps) + BOM + sección A-A + cajetín ISO 7200 + notas de análisis; bezel completo',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-assembly-test.cjs'] },
  { group: 'kernel', n: 'mold-flowleaders', why: 'Kazmer §5.5.5 FLOW LEADERS: espesor balanceado H=H·(L/Lref)·√(μr) para eliminar race-tracking; contenedor del libro EXACTO (280/210mm → pared 1.5mm, v75%)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-flowleaders-test.cjs'] },
  { group: 'kernel', n: 'mold-moldtech', why: 'Kazmer §13.9 TECNOLOGÍAS: selector por criterios del libro (undercut externo→split cavity §13.9.1, estética total→reverse ejection §13.9.4, rosca→unscrewing, lateral→slide)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-moldtech-test.cjs'] },
  { group: 'kernel', n: 'kazmer-parts', why: 'BANCO: construir las 4 piezas REALES del libro con el kernel B-Rep (cup/lid/jabonera/bezel); el bezel reveló que el fillet trueca en geom. delgada → filletAllEdgesResilient (baja radio o degrada); las 4 construyen + bezel→STEP',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/kazmer-parts-build.cjs'] },
  { group: 'kernel', n: 'isoview', why: 'VISTA ISOMÉTRICA sombreada (painter\'s + back-face cull) de la malla del kernel → SVG A3; cubo 12 tri → 6 caras visibles',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/isoview-test.cjs'] },
  { group: 'kernel', n: 'mold-sideactions', why: 'Kazmer §11.3.6-8 MOLDES CON MOVIMIENTO: core pull 44kN/⌀75→82.55std, angle pin 35+25mm EXACTOS, decisor slide/pull',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-sideactions-test.cjs'] },
  { group: 'kernel', n: 'mold-fasteners', why: 'Kazmer §12.4: tornillo del molde peor-caso 362kg/47kN → M10 DIN 912 del CATÁLOGO real',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-fasteners-test.cjs'] },
  { group: 'kernel', n: 'mold-gating', why: 'Kazmer cap 7: γ̇ gates 111k/132k, R=1.03mm, ΔP 1.9/1.9/1.3 MPa EXACTOS + tabla 10 tipos',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-gating-test.cjs'] },
  { group: 'kernel', n: 'mold-venting', why: 'Kazmer cap 8: venteo h_min 0.06mm (aire viscoso) / h_max por flash + tabla handbooks',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-venting-test.cjs'] },
  { group: 'kernel', n: 'mold-contratos', why: 'CONTRATOS: los criterios de aceptación del CLIENTE por subsistema (§6.4 feed, cap 8 venteo) — exige que el contrato diga la verdad: lo no medido NUNCA cuenta como cumplido',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-contratos-test.cjs'] },
  { group: 'kernel', n: 'mold-venteo-ubicaciones', why: 'DÓNDE va cada venteo (§8.2.2): sale del campo de flujo, NO de la figura. La prueba decisiva: una pieza cuyo brazo DELGADO está más CERCA que el grueso — el venteo debe ir al delgado (se llena al final por resistencia, §5.5.5 race tracking), no al punto más lejano. Elegir por distancia manda el venteo al lugar equivocado y el molde sale quemado',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-venteo-ubicaciones-test.cjs'] },
  { group: 'kernel', n: 'mold-cooling', why: 'Kazmer cap 9: t_c placa/barra (Eq 9.5/9.6) contra ejemplos del libro (8.4/18.9/22.9s), sim 1D transitoria (Eq 9.4), Q por ciclo',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-cooling-test.cjs'] },
  { group: 'kernel', n: 'mold-engine', why: 'MOTOR DE MOLDES cap 6: draft analysis, shrinkage, core&cavity con shut-offs (tina+tapa refs exactas), split plano (jabonera)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-engine-test.cjs'] },
  { group: 'kernel', n: 'sim-cycle', why: 'MOTOR DEL CICLO (sim viva): 8 fases, P(t) power-law del frente, F_apertura vs clamp→FLASH, FDM k-armónica (effusividad <95°C), textura sección',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/sim-cycle-test.cjs'] },
  { group: 'kernel', n: 'mold-drawings', why: 'PLANOS DE TALLER del molde: tabla de barrenos fiel al registro (X/Y/⌀/prof/tipo), BOM+globos, achurado, línea de partición',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-drawings-test.cjs'] },
  { group: 'kernel', n: 'mold-base', why: 'Kazmer cap 4 + Apéndice B: insertos 3⌀/cheek=profundidad, base estándar+aspecto 2:1, HM320 fiel, 11 metales EXACTOS (α≡k/ρcp) + selector',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-base-test.cjs'] },
  { group: 'kernel', n: 'mold-dfm', why: 'Kazmer §2.3 DFM: costilla 70%/4×/10×, boss 70%, filete 150/50%, draft 0.5° mín + Tabla 2.14 exacta, undercuts, jetting',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-dfm-test.cjs'] },
  { group: 'kernel', n: 'mold-dfm-mesh', why: 'EL LIBRO DELIMITA LAS FIGURAS (medido en la MALLA): undercuts Fig 2.7 por columnas (túnel→side-action, cavidad sellada→NO moldeable), draft §2.3.6 por normales, pared §2.3.1 erosionada; Benchy/carcasa RPi4 reales',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-dfm-mesh-test.cjs'] },
  { group: 'kernel', n: 'mold-mecanismos', why: 'GENERADOR de partes móviles §11.3.6-7 (Eq 11.24 F=44kN, Eq 11.25 bore=75mm, Eq 11.26 perno 35+25=60mm AL DECIMAL) + colada CALIENTE §6.3.3 (manifold+boquillas+thrust pads); túnel medido→core pull [0,1]; pirámide→0',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-mecanismos-test.cjs'] },
  { group: 'kernel', n: 'mold-termico3d', why: 'TÉRMICO 3D REAL: depósito con la FORMA de la pieza (espesor local→hot spot 3D, conservación 0.0%), isosuperficie marching-tetrahedra (esfera 4πr² −0.2%), sliceAxis X/Y/Z',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-termico3d-test.cjs'] },
  { group: 'kernel', n: 'mold-tc', why: 't_c LOCAL por pared medida (Eq 9.5: ratio (12/2)²=36 EXACTO, == coolingTimePlate) + CONSEJO de agua: cubierto ✓ / lateral→MOVER línea / profundo sin línea A→BAFFLE §9.3.5.2 con marcador',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-tc-test.cjs'] },
  { group: 'kernel', n: 'mold-audit', why: 'AUDITOR geométrico (caza errores que el ojo no ve): contención lateral/vertical, agua en su placa, pin alcanza partición, insertos flanquean, colada conecta, holguras; CERO críticos en bezel+carcasa+embudo+benchy',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-audit-test.cjs'] },
  { group: 'kernel', n: 'mold-parts', why: 'ENSAMBLE 3D: buildMoldParts → 25 componentes con coordenadas reales (placas+pines con cabeza+agua+guías+tornillos ROSCADOS ensamblados+colada+insertos tallados A/B); holguras agua↔barreno y línea↔impresión medidas',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-parts-test.cjs'] },
  { group: 'kernel', n: 'mold-threads', why: 'ROSCA REAL (no barra lisa): superficie ISO 68-1 r(φ,z) procedural a CUALQUIER paso (M1×0.25 ultra-chico → M64), ultraliviana (<12k tris/40mm) + acoplamiento tornillo↔barreno (mismo Ø/paso/sentido = se unen las placas)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-threads-test.cjs'] },
  { group: 'kernel', n: 'kicad-draft', why: 'CALIBRACIÓN del medidor de salida (caja con ángulo CONOCIDO: 0°→100% bajo mín, 1/3/7°→0% — sin esto un banco malo se confunde con un medidor malo) + banco contra 12 piezas de KiCad. HALLAZGO: los modelos de KiCad son aproximaciones VISUALES sin salida, no CAD de producción → no existe corpus gratis de CAD inyectable; por eso la herramienta que AGREGA salida es el producto',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/kicad-draft-test.cjs'] },
  { group: 'kernel', n: 'termico-cross', why: 'CRUCE DEL TÉRMICO ("parte de que está mal"): la analítica Eq 9.5 reproduce los ejemplos del libro (8.4/18.9 s) y la LEY t_c ∝ h² sale EXACTA (4.000× y 9.000× — la prueba más fuerte porque NO depende de α/T_melt/T_eject); el FDM 3D, camino INDEPENDIENTE, cae en el rango de Fig 9.7 (60-93 °C). Dos caminos a la misma física: si divergen uno miente',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/termico-cross.cjs'] },
  { group: 'kernel', n: 'mold-interlocks', why: 'AUTOCENTRADO §12.2.5 (el molde se arma centrado solo → el error de maquinado se corrige en el armado): reproduce el EJEMPLO DEL LIBRO al número (vaso 40MPa·⌀19.05·H50 → F=19,050 N, τ=67 MPa < 300 del S7); macho PASANTE en B + hembra CIEGA en A; ≥5° §4.1.3 o la fuerza de cierre los traba; elige el MÁS GRANDE que aguanta y cabe; y NO se encima con la tornillería (se corre por el costado)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-interlocks-test.cjs'] },
  { group: 'kernel', n: 'campo-operador', why: 'EL SUSTRATO ÚNICO DE SIMULACIÓN ("estandaricemos el sistema completo… ahí está el operador" — user). Había SIETE rejillas artesanales (flowlen/thermal-fdm/cycle-engine/tc-map/mold-analysis/viento/dfm-mesh), cada una con su idx(), frontera y render. `src/forja/campo/campo.ts` las va a sustituir: Campo3/CampoVec3 + grad/div/lap/sample verificados contra ANALÍTICA, y el operador 𝔄 de difusión — cara DST-I Dirichlet cuyos modos son eigenfunciones EXACTAS del laplaciano DISCRETO (1e-7) ⇒ paso temporal EXACTO para CUALQUIER dt como producto tensor de 3 LUTs 1D (el patrón del framework, literal). El contraste: con dt 6× el límite, el espectral da err 8e-9 y el explícito CRECE cuando la física manda decaer — el porqué de los sub-pasitos de kínder, demostrado. Ancla: reproduce la placa del libro Eq 9.5 (8.40 s EXACTO, mismo ancla que termico-cross = TERCER camino a la misma física) y t∝h²=4.000. El gate cazó 2 bugs míos del sustrato: eje z TRANSPUESTO (invisible en rejilla cúbica → el test usa 9×7×5) y ejes de tamaño 1 tratados como "bordes en cero" (un campo 1D recibía −4v/h² espurio). Techo declarado: α constante (mezclas acero/plástico = rotar de cara, después) y transformada por matriz (~128³; FFT si el generativo pide más)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/campo-test.cjs'] },
  { group: 'kernel', n: 'mold-racetrack', why: 'LA PRUEBA DE QUE SIMULA FLUJO ("simulación de flujo, no está bien simulado" — user; tenía razón y el error era de fondo: Dijkstra pesado por DISTANCIA trata igual una pared de 1 mm y una de 3 mm, y el fundido NO. Peor: yo citaba §5.5.5 —flow leaders, VARIAR el espesor para balancear— con una sim que no podía ver el espesor: la herramienta no podía hacer aquello para lo que la citaba). Ahora el costo del salto es la RESISTENCIA (Eq 5.22: ΔP ∝ L/H^(1+n); con el n=0.348 del ABS, duplicar H hace el paso 2.5× más fácil) y el espesor local sale de un EDT del hueco, no de un parámetro. LA PRUEBA: dos brazos de IGUAL longitud, uno de 1 mm y otro de 3 → el grueso gasta 51% ⇒ RACE TRACKING emerge solo, y el adelanto cae donde predice la ecuación (0.506 vs 0.393 de los brazos: el resto del camino es común). Y el cierre: engrosar el delgado a 3 mm hace que los dos lleguen A LA VEZ (0.0% — Eq 5.30). Sin espesor, esto era imposible de probar',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-racetrack-test.cjs'] },
  { group: 'kernel', n: 'plate-cost', why: 'COSTO POR PLACA ("cada placa individual debe de cotizarse, estoy 100% seguro de que el libro lo pone así" — user). FUI A VERIFICAR Y EL LIBRO NO LO PONE ASÍ: §3.3.2 Eq 3.15 es `C = $830 + M·κ`, UNA fórmula para todo el mold base, porque asume que se COMPRA armado (DME/HASCO) — lo que sí desglosa son los INSERTOS §3.3.1. Pero el instinto era bueno: en LATAM el taller CORTA acero y necesita ver placa por placa. Así que el desglose existe como EXTENSIÓN NUESTRA, con contrato duro: LA SUMA CUADRA CON LA Eq 3.15 (error 0%) y con el $3,700 del bezel del libro suma EXACTAMENTE $3,700. Cada placa con su acero real (P20 $5.25/kg vs base $3.55) y los aceros fuera de la Tabla 3.7 lo DECLARAN. Etiquetarlo como Kazmer habría sido fabricar una cita',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/plate-cost-test.cjs'] },
  { group: 'kernel', n: 'import-cycles', why: 'ANTI-CICLOS: en producción reventó el CAD entero con "Cannot access \'kn\' before initialization" (TDZ) por un ciclo plano-set → interlocks → plano-set. Lo GRAVE es que el ciclo llevaba días ahí SIN reventar: el bundler evaluaba en un orden que por suerte funcionaba, y un import nuevo (de otro módulo, nada que ver) cambió ese orden y explotó. TypeScript no ve los ciclos (borra los tipos, no los valores) y `vite dev` tampoco (ESM perezoso): SOLO truena en el bundle, y no siempre. Es el peor bug posible — invisible hasta que le pega al usuario. Fix: mover la función a su CAPA (insertDims a mold-drawing-set, donde ya vive cavityFootprint), no meter un import de vuelta',
    cmd: NODE, args: ['scripts/import-cycles-test.cjs'] },
  { group: 'kernel', n: 'mold-flowlen', why: 'LA LONGITUD DE FLUJO se MIDE del hueco A/B ("no debe de ser una fórmula de una figura: ¿cómo calcularás el relleno de una carcasa de laptop? ¿o una pistola de agua?" — user, cachándome escribiendo `tupperFlowPath()`, la fórmula del vaso a mano, que además daba πR²·pared = SOLO EL FONDO y se comía el 82% de la pieza: ESA era la razón de "solo se inyecta un disco"). El libro no razona por figuras: razona por L (§5.5.5). Aquí se voxeliza el hueco y se corre Dijkstra 26-vecinos desde la compuerta ⇒ vaso, carcasa de laptop y placa CON OBSTÁCULO con la MISMA función. La prueba decisiva: el frente RODEA el acero (115.9 mm contra 96 en línea recta) y lo que no tiene camino al gate se reporta como short shot (§5.5)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-flowlen-test.cjs'] },
  { group: 'kernel', n: 'mold-flow-cross', why: 'DOS CAMINOS a la MISMA física del flujo — la prueba más fuerte que hay, porque no depende de que yo tenga razón sino de que coincidan: VÓXEL (rejilla 3D del hueco, general y lento) vs SUPERFICIE (Dijkstra sobre la malla, ms ⇒ vive en el CAD; es el "dual domain" de los solvers comerciales, válido porque toda pieza de inyección es de pared delgada §2.3.1). Si el L máx de los dos diverge, uno miente. Así se cazó el rayo +Z: el vóxel daba 33 cc contra 50.5 del kernel (−34%, justo la pared, porque las paredes quedaban de canto al rayo) y "se veía bien" sin el segundo camino',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-flow-cross.cjs'] },
  { group: 'kernel', n: 'mold-llenado', why: 'EL LLENADO ("la animación no es real y no veo cómo pasa por los canales" — user; tenía razón en las dos). El motor hacía `fillFrac = u`: "lo llenado = el tiempo que pasó", una regla de tres, no física. Ahora el frente sale de CONSERVACIÓN DE VOLUMEN a caudal constante (V = Q·t) y la FORMA decide la ley: tira V=w·h·L → L ∝ t (lineal); disco con gate central V=π·r²·h → r ∝ √t (DESACELERA). Verificado al número: a medio tiempo el disco va al 70.3% del radio (√0.5 = 70.7%) y su volumen sí crece lineal (error 0.013). El lineal era correcto POR CASUALIDAD para el rectángulo — el cuadrado tapaba el error, el vaso redondo lo destapó. Además el alimentador (cap 6) se llena ANTES que la cavidad y PAGA su presión (+4.1 MPa): antes el plástico aparecía ya dentro y el bebedero salía gratis',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-llenado-test.cjs'] },
  { group: 'kernel', n: 'mold-tornillos', why: 'LA TORNILLERÍA DEL ENSAMBLE ("¿como que los tornillos atornillan la placa A y B? wuuuuuut… están MAL CALCULADOS y DESCONECTADO" — user, viéndolos flotar en la apertura; tenía razón y con números era peor). Mide la MALLA publicada, no la intención: (1) NADIE cruza la partición — A y B se separan CADA ciclo, un tornillo entre ellas impide abrir; (2) TODO tornillo AGARRA la placa que dice sujetar — el del núcleo salía de `bottomClamp+tB` y quedaba 32 mm CORTO de la placa B, no atornillaba nada; (3) NADIE invade el hueco del expulsor — el mismo cruzaba por donde viaja la placa expulsora. Cazó además que mi PROPIO fix seguía cruzando 14 mm: `boltMesh(L)` mide headH+L y la cabeza no se descontaba',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-tornillos-test.cjs'] },
  { group: 'kernel', n: 'mold-apertura', why: 'LA CARRERA §6.3.2 ("el movimiento debe de tener cota pues se está calculando cuánto se abrirá, no?" — la respuesta era NO): reproduce el ancla de la Tabla 6.1 al número (264+75=339 y la carrera 75 del libro ES 2.5×30 de pieza ⇒ el modelo reproduce la tabla, no la imita). Cazó DOS agujeros del mismo origen — el número no estaba en pantalla: la animación abría 80 mm FIJO (53% del recorrido del tupper) y el selector juzgaba el daylight con el molde CERRADO ⇒ 25 moldes aprobados que la máquina NO puede abrir (hasta 92 mm). El barrido queda en 0 y UNA sola fuente manda (animación + layout + selector leen la misma función)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-apertura-test.cjs'] },
  { group: 'kernel', n: 'tupper', why: 'EL TUPPER — pieza REAL diseñada CON las reglas del libro (croquis→extruir→salida Tabla 2.14→radios §2.3.4 solo verticales→vaciar §2.3.1), no un STL bajado. PRUEBA CRUZADA: da 0.0% de cara sin salida vs ~83% de los STL de impresión y ~91% de KiCad ⇒ el DFM siempre tuvo razón, las FUENTES eran malas. Cascarón 8.9% del macizo, MOLDEABLE dos placas, la Máquina lo cotiza viable',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/tupper-test.cjs'] },
  { group: 'kernel', n: 'mold-timeline', why: 'LÍNEA DE TIEMPO editable (el generador emite RECETA, no malla muerta): croquis→extruir→barrenos→bolsa como lo haría un humano, cada paso con su cita del libro; las cotas CUADRAN con el spec (381×297×56), EDITAR el espesor cambia el sólido, SUPRIMIR deja más material, y una cota imposible se ataja ANTES del kernel con mensaje en español (sin guardas, extruir 0 corrompe el heap del WASM y el CAD ya no vuelve)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-timeline-test.cjs'] },
  { group: 'kernel', n: 'mold-heads', why: 'CABEZAS + CHAFLANES por REGLA (no catálogo): ISO 4762 k=d exacto en M3..M24 · ISO 10642 cono 90° ⇒ k=(dk−d)/2 · ISO 4753 punta a 45° hasta Ø menor (0.541·P, redondeada si Ø<3) · ISO 4017 chaflán 30° trunca el hexágono (arcos en las caras) · botón con cúpula TRUNCADA; honestidad tabla-vs-regla marcada',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-heads-test.cjs'] },
  { group: 'kernel', n: 'mold-fastener-load', why: 'TORNILLERÍA POR CARGA (Shigley cap.8 + FED-STD-H28): capacidad ∝ d² (M6→M12 ×4.2), LONGITUD DE ENGRANE (más blando→más engrane), plan que reparte con N≥4 que CABE + par de apriete + alternativas (pocos grandes vs muchos chicos)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-fastener-load-test.cjs'] },
  { group: 'kernel', n: 'mold-threeplate', why: 'Kazmer §6.3.2: doble partición A-B/A-X, bolts, apertura 2-3×h, v=184+13·log(F) y Tabla 6.1 EXACTA (0.36/1.19s, 339/558mm), sucker pin §6.5.2',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-threeplate-test.cjs'] },
  { group: 'kernel', n: 'mold-cost-detailed', why: 'Kazmer §3.3 costeo DETALLADO: reproduce el laptop bezel EXACTO ($435 material, 258h/$25,800 maq, 34h/$1,700 acabado, 538kg base, ≈$74,800 total) + Tablas 3.4-3.11',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-cost-detailed-test.cjs'] },
  { group: 'kernel', n: 'mold-machine', why: 'LA MÁQUINA (orquestador): DFM→optimiza arch×cav por costo total→cotización §3.3+costo/pza §3.4 (material $0.063 EXACTO)→veredicto; bezel→cold×1, cubeta gruesa 20M→hot×16, DFM gate rechaza esquina viva',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-machine-test.cjs'] },
  { group: 'kernel', n: 'mold-unscrewing', why: 'Kazmer §13.9.2-3 NÚCLEOS MÓVILES (roscas/tubos): vueltas=L/paso, torque=μ·(ΔT·CTE·E)·A·r, collapse 6%⌀, hélice gruesa vs planetario; 64 tapas→planetario (Fig 13.32)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-unscrewing-test.cjs'] },
  { group: 'kernel', n: 'mold-coolinglines', why: 'Kazmer §9.2.3-6 LÍNEAS DE ENFRIAMIENTO (flujo real, no 2D): caudal Eq9.13, Ø turbulencia Re>4000 Eq9.15, Ø presión Eq9.17, plug DME; cup/lid EXACTO (6.2e-5 m³/s, 3.7-20mm, 6.35mm)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/mold-coolinglines-test.cjs'] },
  { group: 'kernel', n: 'occt-sweep-loft', why: 'loft (prisma A·h, tronco h/3·(a²+b²+ab)) + sweep (cilindro πr²L, codo suave sin truncar)',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/occt-sweep-loft-test.cjs'] },
  { group: 'physics', n: 'fea',          why: 'FEA real K·u=f vs analítico: barra axial σ=F/A & δ=FL/AE, viga voladizo',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/fea-node-test.cjs'] },
  { group: 'physics', n: 'topopt',       why: 'generativo SIMP (voladizo): compliance↓, volumen conservado, densidades acotadas, vacío creado',
    cmd: NODE, args: ['--import', 'tsx', 'scripts/topopt-node-test.cjs'] },
  { group: 'unit', n: 'vitest-forja',    why: 'croquis (solver DOF/L-M), planos (HLR), topopt-AM (auto-soporte 45°), soportes, evolución GA',
    cmd: VITEST, args: ['run', 'src/forja', '--reporter=dot'] },
];

// e2e por GPU (opcional, requiere preview vivo en iangpu)
if (uiUrl) {
  SUITES.push({
    group: 'e2e', n: 'forja-brep-ui', why: 'Part Studio por clics reales: extrude→barreno→fillet→shell + panel de análisis (GPU/ANGLE)',
    cmd: NODE, args: ['scripts/forja-brep-ui-verify.cjs'], env: { URL: uiUrl },
  });
  SUITES.push({
    group: 'e2e', n: 'sweep-loft-ui', why: 'Loft + Sweep (recta/codo/hélice) por clics reales → sólidos válidos (GPU/ANGLE)',
    cmd: NODE, args: ['scripts/forja-sweep-loft-ui-verify.cjs'], env: { URL: uiUrl },
  });
}

const suites = onlyGroups.length
  ? SUITES.filter((s) => onlyGroups.includes(s.group))
  : SUITES;

// ── runner ──────────────────────────────────────────────────────────
function tail(s, nLines = 18) {
  const lines = String(s || '').replace(/\s+$/, '').split('\n');
  return lines.slice(-nLines).join('\n');
}
// Señales suaves de fallo en la salida (por si una suite olvida exit≠0).
const FAIL_RE = /(\bFAIL\b|\b✗\b|❌|Error:|AssertionError|throw new|✘|\bfailed\b)/;
const PASS_RE = /(\bPASS\b|✓|✔|TODO OK|todos? (?:los? )?(?:tests?|invariantes?).*(?:ok|pas)|✅)/i;

function run(s) {
  const started = Date.now();
  const r = spawnSync(s.cmd, s.args, {
    cwd: repoRoot,
    encoding: 'utf8',
    timeout: perTimeout,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, ...(s.env || {}) },
  });
  const ms = Date.now() - started;
  const out = (r.stdout || '') + (r.stderr || '');
  const timedOut = r.error && r.error.code === 'ETIMEDOUT';
  const exit = timedOut ? 124 : (typeof r.status === 'number' ? r.status : 1);
  // Verdad principal = exit code. Señal suave de respaldo si exit=0 pero el
  // texto grita FAIL y nunca dice PASS (atrapa suites que no propagan el código).
  let pass = exit === 0;
  if (pass && FAIL_RE.test(out) && !PASS_RE.test(out)) pass = false;
  return { ...s, exit, pass, ms, timedOut, tailOut: tail(out), bytes: out.length };
}

// ── ejecución ───────────────────────────────────────────────────────
const C = { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', dim: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' };
console.log(`${C.b}⚒  La Forja · Portero Maestro${C.x}  ${C.dim}(${suites.length} suites · raíz ${repoRoot})${C.x}\n`);

const results = [];
for (const s of suites) {
  process.stdout.write(`  ▸ ${C.b}${s.group}/${s.n}${C.x} ${C.dim}— ${s.why}${C.x}\n`);
  const res = run(s);
  results.push(res);
  const tag = res.pass ? `${C.g}✓ PASS${C.x}` : res.timedOut ? `${C.y}⧖ TIMEOUT${C.x}` : `${C.r}✗ FAIL${C.x}`;
  process.stdout.write(`    ${tag} ${C.dim}(${(res.ms / 1000).toFixed(1)}s · exit ${res.exit})${C.x}\n`);
  if (!res.pass) {
    process.stdout.write(`${C.dim}    ┄┄┄ últimas líneas ┄┄┄${C.x}\n`);
    process.stdout.write(res.tailOut.split('\n').map((l) => '    ' + l).join('\n') + '\n');
    process.stdout.write(`${C.dim}    ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄${C.x}\n`);
  }
}

// ── resumen ─────────────────────────────────────────────────────────
const passed = results.filter((r) => r.pass).length;
const failed = results.length - passed;
console.log(`\n${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.x}`);
console.log(`${C.b}RESUMEN${C.x}`);
const byGroup = {};
for (const r of results) (byGroup[r.group] ||= []).push(r);
for (const [g, rs] of Object.entries(byGroup)) {
  const p = rs.filter((x) => x.pass).length;
  const ok = p === rs.length;
  console.log(`  ${ok ? C.g + '✓' : C.r + '✗'} ${g.padEnd(8)}${C.x} ${p}/${rs.length}  ${C.dim}${rs.map((x) => (x.pass ? '·' : x.n)).join(' ')}${C.x}`);
}
console.log(`${C.b}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${C.x}`);
console.log(`  ${failed === 0 ? C.g + '✓ TODO VERDE' : C.r + '✗ ' + failed + ' SUITE(S) ROTA(S)'}${C.x}  ${C.dim}(${passed}/${results.length})${C.x}\n`);

if (jsonOut) {
  const report = {
    when: new Date().toISOString(),
    repoRoot,
    passed, failed, total: results.length,
    suites: results.map(({ group, n, why, exit, pass, ms, timedOut }) => ({ group, n, why, exit, pass, ms, timedOut })),
  };
  fs.writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  console.log(`${C.dim}reporte JSON → ${jsonOut}${C.x}`);
}

process.exit(failed === 0 ? 0 : 1);
