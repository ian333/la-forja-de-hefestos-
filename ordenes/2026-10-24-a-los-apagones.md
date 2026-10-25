# ORDEN A: LOS APAGONES — lo que un ingeniero desmiente en 10 minutos sale de la pantalla y del papel

ESTADO: hoy
PRIORIDAD: 1

BASE: (el agente pone `git rev-parse --short HEAD` tras `git merge --ff-only main`)

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

## CIERRE (se llena al terminar)
