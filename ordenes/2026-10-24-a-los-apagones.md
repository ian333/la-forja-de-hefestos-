# ORDEN A: LOS APAGONES — lo que un ingeniero desmiente en 10 minutos sale de la pantalla y del papel

ESTADO: hoy
PRIORIDAD: 1

BASE: eeeb24e (el worktree nació de origin/main con 3 commits de fogata de Sinué que no están en main; `--ff-only` no podía: la rama, sin trabajo propio, se puso en main con `git reset --hard main`; los 3 commits siguen en origin/main)

OBJETIVO: el debate de 25 expertos encontró rótulos y números que la app enseña sin haberlos medido. Cada uno se APAGA o se
REESCRIBE para que diga exactamente lo que se midió (jueces A y C, sección 4 de cada uno). Nada de cálculos nuevos salvo el de la
barra (Eq 9.6), que ya existe en `cooling.ts:38`. Es la condición para volver a filmar y para el primer demo.

## LO QUE SE APAGA O SE REESCRIBE (cada renglón con su archivo; verifícalo antes de tocarlo)
1. **«N puntos débiles en el molde»** (`FocoMolde3D.tsx` ~L302) → «0 choques entre barrenos» + subtítulo «revisé N pares agua contra
   barreno · no revisé: agua contra agua, pines contra guías, acero contra plástico». N sale de `foco.pares` (no lo inventes).
2. **«DFM 100/100»** (hoja de análisis, `ForgeBRepStudio.tsx` ~L4070): sale de `checkDFM` con solo la pared nominal (`moldmachine.ts:189`,
   NO lo toques: es de B). En la hoja: «DFM declarado (pared nominal): no revisa costillas, postes ni filetes» y sin el ✓.
3. **Cifras en USD y $/pieza** (`expediente.ts:62`, hoja de análisis, cotización de la pieza): mientras no exista la tarifa del cliente
   en MXN (orden G, semana 2), se enseñan las HORAS del modelo de Kazmer (cap. 3) y NINGUNA cifra de dinero; el renglón dice «costo de
   referencia: falta tu tarifa por hora (MXN)». La banda A-050 y el $/pieza se ocultan (dependen del ciclo de 134 s).
4. **El ciclo de 134 s** (`foco-lentes.ts:442` aplica placa Eq 9.5 a cada vóxel): en la tarjeta del enfriamiento y en todo lugar donde
   se diga «tu ciclo», el par honesto: «lo más grueso (postes ⌀8): entre 65 s (barra, Eq 9.6) y 136 s (placa, Eq 9.5) · la pared de
   3.2 mm: 21.7 s». La barra: `coolingTimeRod` de `cooling.ts:38` con el MISMO material y el espesor del vóxel más lento como diámetro.
   El mapa de colores se queda como está (placa: es la cota alta, se rotula así).
5. **«PP» literal** de la pieza (`useMoldStudio.ts:561`) → el material del intake (`intake.material ?? 'ABS'`). `mold-drawing-set.ts:321`
   cae a PP: que caiga al material del intake.
6. **«16 líneas»** (`useMoldStudio.ts:1425`, título de la estación 6) → «16 tramos» (`segmentos.length` cuenta extensiones y cruces).
7. **El cajetín** (`mold-drawings.ts:102-107`): fuera «Ra 0.8 cavidad · Ra 3.2 resto», «ISO 2768-mK», «H7 · roscas 6H» y «DIBUJÓ: La Forja
   CAD». Queda: «TOLERANCIA GENERAL: la fija el fabricante del molde» · «GENERÓ: La Forja (software)» · «REVISÓ: ____» · «APROBÓ: ____».
   Los ajustes que SÍ calcula `fits.ts` se quedan donde estén.
8. **El ✓ verde junto a «pendientes de firma»** (tarjeta DECISIONES del expediente, `ForgeBRepStudio.tsx` ~L10050) → ◇ ámbar mientras
   haya pendientes; el título del expediente lleva «BORRADOR» mientras haya una sola decisión sin firmar.
9. **«50 de 50 puntos tocan»** (`inspeccion-recorrido.ts:54-73`, 10×5 rayos que NO alcanzan los postes ⌀8): el punto 1 de la inspección
   deja de afirmar «el macho llena tu pieza»; dice lo que mide: «N rayos sobre el techo del macho: todos tocan la pieza a ≤ 0.5 mm ·
   no revisa rasgos menores de ~10 mm (postes, nervios)». Si el `err %` de la báscula de `parting.ts` (~L313) está disponible para la
   pieza soltada, súmalo en una línea («báscula: bloque = cavidad + núcleo + pieza, error x.x %»); si no está, no lo inventes y anótalo.
10. **Volumen < 5,000** cotiza aluminio y la hoja calcula P20: la clave `'Al QC-7'` (`moldbase.ts:58`) contra `'QC-7'` en `ACEROS_MOLDE`
    (`cooling-design.ts:60`, `mold-drawing-set.ts:322` con `?? ACEROS_MOLDE.P20`). Arreglo mínimo: que la búsqueda encuentre el QC-7 y,
    si una clave no existe, que REVIENTE con un rótulo «material sin datos» en vez de caer en silencio a P20.

## YA-EXISTE
- `cooling.ts:38` `coolingTimeRod` (Eq 9.6), usado hoy solo para el bebedero. `foco.pares` y `foco.cilindros` en `foco-molde.ts`.
- La línea de alcance del dictamen y el ◆◇✓ ya entraron (4373705); el expediente ya dice «DICTAMEN · antes del molde».

## TOCA
- scripts/ciclo-dado-test.cjs
- scripts/mold-assembly-test.cjs
- src/forja/brep/FocoMolde3D.tsx
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/mold/inspeccion-recorrido.ts
- src/forja/mold/expediente.ts
- src/forja/mold/mold-drawings.ts
- src/forja/mold/foco-lentes.ts
- src/forja/mold/mold-drawing-set.ts
- src/forja/brep/useMoldStudio.ts

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE
- (nada)

## EVIDENCIA
- Gate VERDE en tu worktree; tsc sin errores nuevos contra tu base.
- Capturas 4K (Read y juicio tuyo) de: el Foco (07b), la tarjeta del enfriamiento (03), la hoja de análisis (08), el cajetín de una
  lámina, el expediente (09) y el punto 1 de la inspección (07c). En ninguna aparece «puntos débiles», «100/100», «USD», «$», «PP»,
  «134 s» solo, «50 de 50», «ISO 2768», «Ra 0.8» ni «DIBUJÓ: La Forja CAD».
- El par del ciclo leído del DOM: barra ≈ 65 s y placa ≈ 136 s para la 1594C Box (cuentas del juez C: 65.2 y 135.6).

## ENMIENDA 2026-10-24 (el agente A, a medio camino)
- **scripts/mold-assembly-test.cjs** entra al TOCA: es la suite `mold-assembly` de `forja-gate.cjs` y su check `cajetin` exigía
  `ISO 2768` en el SVG — el renglón 7 lo apaga, así que el check medía justo lo inventado. Se reescribe para medir lo nuevo
  («la fija el fabricante del molde», REVISÓ, APROBÓ) y que lo inventado NO vuelva (ISO 2768 / Ra 0.8 / La Forja CAD / roscas 6H).
  Par de control: el check nuevo sobre el cajetín VIEJO (copia de main en iangpu) da `cajetin:false`; sobre el nuevo, `true`.
- **scripts/ciclo-dado-test.cjs** entra al TOCA (ACTA R94): el check «LENTE · la ficha habla ESPAÑOL…» exigía `/ciclo lo manda/`
  en el titular del enfriamiento — exactamente la frase que el renglón 4 apaga. Mismo check (266 siguen siendo 266): ahora exige
  el par «barra, Eq 9.6» / «placa, Eq 9.5», que NO diga «ciclo lo manda», y que los números cuadren (barra = Eq 9.6 y placa =
  Eq 9.5 del MISMO espesor, barra < placa). Par de control: el titular viejo lo reprueba; el nuevo lo pasa.
- **ForgeBRepStudio.tsx, dos líneas fuera de las regiones del superticket** (mismo archivo, ya en el TOCA): ~L5457 (el punto 1 de
  la inspección recibe la báscula de la E3, renglón 9) y ~L7401 (el reloj del enfriamiento recibe la cota de barra, renglón 4).
  Ninguna toca `abrirArchivo` (~L5220, orden C).

## CIERRE (2026-10-24 · MEDIDO, no contado)

Pieza: 1594C Box, app real en forja-dev4 (vite dev :5195, GPU real ANGLE D3D12 RTX 4070 Ti), modo camino. Capturas 4K
(1536×864 · DPR 2.5 → 3840×2160) en `/home/ian/el-plan-dev4/despues3/` (corrida buena: d → partición → molde, como el runner;
E7 con sus 8 pines, 14 componentes, molde en 134 s): 03-enfriamiento, 03b-enfriamiento-mapa, 04-dictamen, 07b-foco, 07c-punto1,
08-hoja-analisis, 08b-lamina-cajetin, 09-expediente (+ `.txt` del texto visible, `medido.json`, `expediente.html` descargado) y
`despues/` (primera corrida, sin dictamen). El arnés: `/home/ian/el-plan-dev4/apagones-mirada.cjs`. ANTES = la película (`Downloads/la-pelicula/critica/cuadros/`, 03 · 07b · 07c · 08 · 09).
Todo texto VISIBLE de cada captura (nodos con opacidad ≥ 0.05 y en pantalla) se guardó en `<cuadro>.txt` y se pasó por la lista de
la orden: «puntos débiles», «100/100», «USD», «$», «PP», «50 de 50», «ISO 2768», «Ra 0.8», «DIBUJÓ», «La Forja CAD», y «134 s»
sin su par → **0 hallazgos en los 7 cuadros** (03, 03b mapa, 04, 07b, 07c, 08 hoja, 08b lámina, 09).

| # | antes (película / base) | después (leído del DOM de la app) |
|---|---|---|
| 1 Foco | «0 puntos débiles en el molde» | «0 choques entre barrenos» + «revisé 915 pares agua contra barreno · no revisé: agua contra agua, pines contra guías, acero contra plástico» (76 barrenos, 915 pares, 0 fallas, 2 de panzazo: interlocks 3.49 y bujes 3.65 contra 3.17) |
| 2 hoja | «DFM · moldeabilidad DFM · 100/100 ✓» | «DFM declarado (pared nominal) · moldeabilidad DFM sin puntaje · no revisa costillas, postes ni filetes», sin ✓ (`/100\/100/` en el SVG de la hoja: false) |
| 3 dinero | decisiones «molde $49,344 · pieza $0.42»; hoja de cotización USD + $/pza + banda A-050 | «cold-2placas × 1 cav — insertos: 45 h de maquinado + 16 h de acabado (Kazmer cap. 3)» + «costo de referencia: falta tu tarifa por hora (MXN)»; tarjeta ◇ «61 h de insertos». Expediente descargado: 0 «$»/«USD» fuera de los SVG |
| 4 ciclo | «El ciclo lo manda lo más lento: 134 s… ese máximo es tu ciclo» · «134 s abre» | «Lo más grueso (8.0 mm, en 4 lugares): entre 64.7 s (barra, Eq 9.6) y 134 s (placa, Eq 9.5) · la pared de 3.2 mm: 21.5 s»; reloj: marcas «64.7 s barra» y «134 s placa»; `reloj-par` data-barra 64.7 · data-placa 134.5 |
| 5 PP | pieza `material: 'PP'` literal; hoja de agua cae a PP | pieza = material del intake (`?? 'ABS'`); la hoja cae a ABS y una resina sin datos revienta |
| 6 E6 | «16 líneas» | «16 tramos» (código; la tarjeta de la E6 vive ~20 s del armado y no la capturé) |
| 7 cajetín | Ra 0.8 · ISO 2768-mK · H7·6H · DIBUJÓ La Forja CAD | MATERIAL · GENERÓ La Forja (software) · TOLERANCIA GENERAL la fija el fabricante del molde · REVISÓ ____ · ESCALA · UNIDADES · APROBÓ ____ · HOJA |
| 8 expediente | ✓ verde «7 · 5 pendientes de firma» | ◇ ámbar «7 · 5 pendientes de firma» y título «BORRADOR · Expediente · 1594C Box» (también el `<h1>` del archivo descargado) |
| 9 punto 1 | «¿El macho llena tu pieza? 50 de 50 puntos tocan» | «¿El techo del macho toca tu pieza? 50 rayos tocan la pieza … uno cada 5.8 × 18.7 mm; un poste o un nervio más chico puede caer entre dos rayos» + «Báscula del acero: cavidad + macho + pieza = bloque, error 0.04 %» (la báscula SÍ existe para la pieza soltada: `verificacionE3`, Σ de la E3) |
| 10 QC-7 | aluminio calculado como P20 (base: k 32 · hLineMax 32 mm · P_melt máx 175.4 MPa, en silencio); SS420 → P20 | QC-7 encontrado (k 160 · hLineMax 160 mm · P_melt máx 63.8 MPa); «AISI P20» = P20; SS420/D2/Cu 940… → «material sin datos» (revienta) |

**El par del ciclo contra el juez C (65.2 / 135.6):** la app da 64.7 / 134.5 porque usa `ABS_KAZMER` con T_expulsión 97.6 °C
(la que el libro usa en sus propias cuentas, cooling.ts), el juez usó 96.7 (el texto). Mismo material en las dos cotas, ninguna
cifra nueva: `coolingTimeRod` (Eq 9.6) ya existía.

**Pruebas:** orden-gate VERDE · tsc 67 errores = 67 de la base (0 nuevos, comparación `norm`) · el cubo **267/267** (la base de hoy
ya trae 267, no 266) · par de control del cubo: el test nuevo sobre el código de main da 266/267 y reprueba justo la ficha
(«El ciclo lo manda lo más lento…» · sin par) · par de control del cajetín: el check nuevo sobre el cajetín viejo `cajetin:false`,
sobre el nuevo `true` · 16 suites de forja-gate que importan los módulos tocados: 14 pasan, `mold-apertura-l6` y `mold-revisar`
fallan IGUAL en main (mismas líneas ✗) — el «revienta» cazó que 21 specs a mano usan «AISI P20»: se reconoce el prefijo.

### ACTA R94 (el cubo)
- check «LENTE · la ficha habla ESPAÑOL…» · antes exigía `/ciclo lo manda/` en el titular del enfriamiento · ahora exige
  «barra, Eq 9.6» y «placa, Eq 9.5», que NO diga «ciclo lo manda», y el par numérico (barra = Eq 9.6 y placa = Eq 9.5 del MISMO
  espesor, barra < placa) · por qué: renglón 4 de esta orden (Eq 9.5 de placa sobre un poste no es un ciclo). En el cubo:
  «Lo más grueso (3.2 mm, en 9 lugares): entre 10.4 s (barra, Eq 9.6) y 21.5 s (placa, Eq 9.5) · la pared de 2.3 mm: 10.8 s».

### Visto, es de otra orden (no lo toqué)
- «manda el bebedero (75.7 s)» en la tarjeta de la estación 6 (useMoldStudio, misma línea que «16 tramos»): compara el bebedero con
  la PARED, no con los postes (64.7–134 s) → semana 2, «ciclo con forma».
- Dinero en DISEÑO (no en el camino): MoldPanels.tsx (panel E2: «molde $…», «$/pza», banda A-050, «precio molde») y detalles de
  criterios económicos en mold-contratos.ts («costo/pieza $…», «gana … ($…)») → B/C tocan esos archivos; para la orden G.
- `mold-plano-set.ts:1599` rotula la lámina «Pieza moldeada · 4 vistas» con `material: 'ABS'` LITERAL; `useMoldStudio.ts` E3 escribe
  «(P20)» literal en la compra; `estudio-molde-datos.ts` «P20 SOLO donde se moldea» literal en la cotización.
- `MoldMachinePanel.tsx:44` (la Máquina de Moldes, fuera del camino) también imprime «DFM … 100/100».
- Dos tablas de aluminio no cuadran: `ACEROS_MOLDE['QC-7']` k = 160 W/m°C y `MOLD_METALS['Al QC-7']` k = 142 (moldbase.ts). No
  cambié ningún número (la orden: «arreglo mínimo»).
- La carrera del arranque (la conocida de filma-camino) me pegó en tiempo REAL: con D (dictamen) y luego MOLDE a los 0.8 s, la E2
  corrió con la pieza MACIZA → E7 sin pines, 13 componentes, y el costo de referencia salió 958 h (943 + 16, la maciza) en vez
  de 61 (45 + 16). Corrida descartada (`despues2/`, solo vale su cajetín y la tarjeta de decisiones, que no dependen del acero). Con el
  orden del runner (D → partición → molde) sale bien. No es de esta orden; la anoto porque el «costo de referencia» la delata.
- `scripts/inspecciona-molde.cjs` (coordinador) lee la ficha del enfriamiento con «el ciclo lo manda lo más lento»: su punto 5.1
  caerá a 'info' hasta que lea el par. `caminos/la-carcasa-de-mitsubishi.md` paso 7 rotula su check «0 puntos débiles».

### Archivos tocados (para la fusión)
- src/forja/brep/FocoMolde3D.tsx — FocoMoldeHUD: rótulo de la ficha, cabecera (choques + alcance), lista baja 40 px, «nada que reportar».
- src/forja/brep/ForgeBRepStudio.tsx — import L45-46; hoja de análisis (fila DFM L4071-4075); memo del expediente (L4104-4120); punto 1
  de la inspección (L5457-5459, báscula); prop del reloj (L7401); tarjeta del expediente (L10058-10090);
  RelojEnfriamientoDriver/EscalaEnElMundo (L10319-10475); expedienteHTML (L10600-10637). Nada en abrirArchivo (C).
- src/forja/brep/useMoldStudio.ts — `cursoPart` (L561-563) y título de la E6 (L1427-1428). Nada en el intake (B).
- src/forja/mold/expediente.ts — `horasDelModelo`, `SIN_TARIFA`, opciones de arquitectura.
- src/forja/mold/foco-lentes.ts — `Lente.ciclo`, lente ENFRIAMIENTO (titular, cuerpo, parada, ref).
- src/forja/mold/inspeccion-recorrido.ts — `rejillaDelMacho` (+ parámetro `bascula`).
- src/forja/mold/mold-drawing-set.ts — `aceroTermico`, `plasticoTermico` y su uso en `coolingCircuitDesign`.
- src/forja/mold/mold-drawings.ts — `titleBlock` (cajetín).
- scripts/ciclo-dado-test.cjs (ACTA R94) · scripts/mold-assembly-test.cjs (check del cajetín) — ver ENMIENDA.
