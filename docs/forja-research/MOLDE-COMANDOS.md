# MOLDE-COMANDOS.md — El registro command-native de La Forja

> **El molde es la antorcha.** De todos los dominios de La Forja, el molde de inyección es el más
> maduro: ~15 módulos Kazmer resueltos con física real, un orquestador que va de *spec del cliente*
> a *molde completo + cotización + planos*, y una batería de auditores numéricos. Este documento es
> el **registro canónico** de lo que el molde sabe hacer — el vocabulario que un agente invoca sin
> tocar código.

## 1 · La antorcha: por qué command-native

La Forja deja de ser un monolito de botones y pasa a ser un **registro de comandos**. Cada capacidad
del molde es un verbo con firma estable, invocable por el mismo patrón desde la UI, desde un agente o
desde otro comando:

```js
ui.run('mold.machine', {
  Lmm: 120, Wmm: 80, Hmm: 40,
  surfaceMm2: 24000, volumeMm3: 96000, wallMm: 2.5,
  annualVolume: 250000, plastic: 'ABS', finish: 'SPI B-3'
})
// → MoldPackage { dfm, arch, cavidades, cotización §3.3, costo/pieza §3.4,
//                 diseño físico, máquina, precio, entrega }
```

El molde es la antorcha porque **el registro ya está poblado de física verificada**: cada `forjaFn`
apunta a una ecuación de Kazmer/Shigley/ISO aterrizada en un componente comercial. El trabajo restante
no es inventar — es **cablear los huesos que faltan** (§3) y **calcular los estudios que el molde aún
no predice** (§4).

**Convención del registro:**
- `dominio.verbo` en minúsculas con puntos. El **dominio** es la etapa física; el **verbo** la acción.
- Un comando = una `forjaFn` canónica. Los duplicados entre dominios (el gran espejo `planos-costeo`)
  colapsan a **un** comando.
- `status`: **implementado** (física verificada, en producción) · **parcial** (existe pero con límite
  declarado) · **falta** (hueso pelón, esperando al agente).

**Balance del registro:** 184 comandos canónicos · **157 implementados** · 18 parciales · **9 faltantes**.

---

## 2 · EL REGISTRO CANÓNICO

### 2.1 Orquestador — de spec del cliente a molde completo

| Comando | Params (firma) | forjaFn | Status |
|---|---|---|---|
| `ui.run('mold.machine', {…})` | `MachineSpec {Lmm,Wmm,Hmm, cavityShape?, surfaceMm2, volumeMm3, wallMm, annualVolume, plastic?, finish?, abrasive?, corrosive?, mirror?, undercuts?, margin?}` | `moldmachine.ts:moldMachine` | implementado |
| `ui.run('arch.optimize', {…})` | grid `arch[cold-2p\|cold-3p\|hot] × cav[1,2,4,8,16]` + restricción throughput `nMin` | `moldmachine.ts:moldMachine` (bloque OPT) | implementado |
| `ui.run('mold.physicaldesign', {…})` | `spec, win, base, insertos, melt, plastic` | `moldmachine.ts:physicalDesign` | implementado |
| `ui.run('report.build', {…})` | `spec, dfm, metal, win, base, precioMolde, semanas, breakEven, diseno` | `moldmachine.ts:buildReport` | implementado |
| `ui.run('factory.generate', {…})` | `oc, part: PartSpec, {archs?, cavityOptions?}` | `factory.ts:moldFactory` | implementado |
| `ui.run('variant.analyze', {…})` | `oc, part, arch, cav, melt` → `MoldVariant` | `factory.ts:analyzeVariant` | implementado |
| `ui.run('tech.choose', {…})` | `feat: geometría/undercuts/roscas` | `moldtech.ts:chooseMoldTechnology` | implementado |

### 2.2 DFM & moldeabilidad — la puerta 0

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('dfm.check', {…})` | `DFMPart {nominalWallMm, surface{roughnessUm}, draftDeg?, ribs?, bosses?, corners?, undercuts?}` | `dfm.ts:checkDFM` | implementado |
| `ui.run('dfm.fromMesh', {…})` | `{mesh{positions,indices}, o?{finish?,resin?,wallMm?}}` → veredicto {si\|mecanismos\|no} + undercut + draft + pared + orientación | `dfm-mesh.ts:dfmFromMesh` | implementado |
| `ui.run('draft.forFinish', {roughnessUm})` | µm de textura → draft recomendado (Tabla 2.14) | `dfm.ts:draftForFinish` | implementado |
| `ui.run('draft.analyze', {…})` | `{oc, shape, pullDir=[0,0,1], minAngleDeg}` (B-Rep) \| `{mesh}` | `mold.ts:draftAnalysis` | implementado |
| `ui.run('part.pickDrawAxis', {mesh, wallMm?})` | elige eje de desmoldeo minimizando undercuts | `draw-axis.ts:pickDrawAxis` | implementado |

> `dfm.fromMesh` es UNA llamada con múltiples vistas (`moldability.verdict`, `undercut.detect`,
> `wall.measure`, `draft.analyzeMesh`, `orient.recommend`, `sideaction.plan`). Se expone como un comando.

### 2.3 Llenado & alimentación (§5–8)

**Llenado (filling.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('fill.velocity.converge', {m, hMeters, v0?, iters?})` | iteración v̄→γ̇→µ→v̄ (libro p.105) | `filling.ts:convergeVelocity` | implementado |
| `ui.run('fill.velocity.recommended', {m, muPaS})` | Eq 5.23 balance corte↔calor | `filling.ts:recommendedVelocity` | implementado |
| `ui.run('fill.shearrate.newtonian', {vMean, hMeters})` | Eq 5.24 γ̇=6v̄/H | `filling.ts:shearRateNewtonian` | implementado |
| `ui.run('fill.shearrate.powerlaw', {vMean, hMeters, n})` | Eq 5.21 | `filling.ts:shearRatePowerLaw` | implementado |
| `ui.run('melt.viscosity', {m, shearRate})` | µ=k·γ̇^(n−1) | `filling.ts:viscosityPowerLaw` | implementado |
| `ui.run('fill.pressuredrop.segment', {m, lMeters, hMeters, vMean})` | Eq 5.22 | `filling.ts:pressureDropSegment` | implementado |
| `ui.run('fill.pressure', {m, segments[{L,H,v}]})` | Σ Eq 5.22 (lay-flat §5.5.2) | `filling.ts:fillingPressure` | implementado |
| `ui.run('fill.report', {m, opts{flowLengthM, wallM, projectedAreaM2, packFactor?}})` | v̄, γ̇, ΔP, F_clamp | `filling.ts:fillingReport` | **parcial** — `packFactor` escalar, no perfil de empaque |
| `ui.run('clamp.force', {pCavityPa, aProjectedM2})` | Eq 5.29 F=P·A | `filling.ts:clampForceN` | implementado |
| `ui.run('clamp.tons', {pPa, aM2})` | Eq 5.29 → ton métricas | `filling.ts:clampMetricTons` | implementado |

**Longitud de flujo & soldaduras (flowlen.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('flow.measure', {…})` | voxeliza hueco, L geodésica desde gate, resistencia ∝ΔP, short-shot | `flowlen.ts:measureFlowLength` | **parcial** — depende de resolución de celda vs pared |
| `ui.run('weld.detect', {…})` | máscara donde chocan frentes de gates distintos | `flowlen.ts:computeWeldMask` | **parcial** — UBICA, no cuantifica severidad/T |
| `ui.run('fill.front', {f})` | frente ordenado por iso-resistencia | `flowlen.ts:createFlowFront` | **parcial** — sin eje de tiempo físico (s) |

**Balanceo de paredes (flowleaders.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('flowleader.thickness', {hNominalMm, lRegionMm, lRefMm, muRatio?})` | Eq 5.33 | `flowleaders.ts:flowLeaderThickness` | implementado |
| `ui.run('flowleader.velocityratio', {lRegionMm, lRefMm})` | Eq 5.32 | `flowleaders.ts:flowLeaderVelocityRatio` | implementado |
| `ui.run('flowleader.design', {nominalMm, regions[{name,flowLenMm}], muRatio?})` | balanceo §5.5.5 | `flowleaders.ts:designFlowLeaders` | implementado |

**Colada / runners (feed.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('runner.reynolds', {rhoKgM3, VdotM3s, muPaS, dMeters})` | Eq 6.2 | `feed.ts:reynolds` | implementado |
| `ui.run('runner.shearrate', {VdotM3s, rMeters})` | Eq 6.4 | `feed.ts:shearRateRunner` | implementado |
| `ui.run('runner.pressuredrop', {m, seg})` | Eq 6.5 power-law | `feed.ts:pressureDropRunner` | implementado |
| `ui.run('feed.pressuredrop', {m, path[]})` | ΣΔP nozzle→gate | `feed.ts:feedPressureDrop` | implementado |
| `ui.run('feed.volume', {segments[]})` | Eq 6.6 Σ count·L·πR² (colada = desperdicio) | `feed.ts:feedVolume` | implementado |
| `ui.run('runner.minradius', {m, L, VdotM3s, dPmaxPa})` | Eq 6.8 | `feed.ts:minRunnerRadius` | implementado |
| `ui.run('feed.optimize', {m, path, dPmaxPa})` | §6.4.5 reparte ΔP ∝ L (Eq 6.9) | `feed.ts:optimizeFeedSystem` | implementado |

**Compuertas / gates (gating.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('gate.types', {type})` | Tabla 7.1 propiedades de 10 gates | `gating.ts:GATE_TABLE` | implementado |
| `ui.run('gate.shearrate.strip', {VdotM3s, wM, hM})` | Tabla 7.2 γ̇=6V̇/(Wh²) | `gating.ts:shearRateStrip` | implementado |
| `ui.run('gate.shearrate.cyl', {VdotM3s, rM})` | Tabla 7.2 γ̇=4V̇/(πR³) | `gating.ts:shearRateCyl` | implementado |
| `ui.run('gate.minradius', {VdotM3s, shearMax})` | §7.3 R=∛(4V̇/πγ̇max) | `gating.ts:gateRadiusForShear` | implementado |
| `ui.run('gate.pressuredrop.strip', {m, L, W, H, Vdot})` | Tabla 7.3 power-law | `gating.ts:gateDropStripPL` | implementado |
| `ui.run('gate.pressuredrop.cyl', {muPaS, L, R, Vdot})` | Tabla 7.3 Newtoniano | `gating.ts:gateDropCylNewt` | implementado |
| `ui.run('gate.design', {type, wallMm, VdotM3s, shearMaxS, widthMm?})` | §7.3.1-2 espesor + veredicto | `gating.ts:gateDesign` | implementado |

**Venteo (venting.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('vent.maxThickness', {lFlashM?, muMeltPaS?, rampPaS?, tFlashS?})` | §8.2 profundidad máx sin rebaba | `venting.ts:ventMaxThickness` | implementado |
| `ui.run('vent.design', {VdotAirM3s, lM, wM, lFlashM})` | §8 mín (que salga aire) + máx + VENT_TABLE | `venting.ts:ventDesign` | implementado |

### 2.4 Enfriamiento (§9)

**Tiempo de ciclo térmico (cooling.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('cooling.time.plate', {hMeters, m})` | Eq 9.5 t_c placa | `cooling.ts:coolingTimePlate` | implementado |
| `ui.run('cooling.time.rod', {dMeters, m})` | Eq 9.6 t_c barra | `cooling.ts:coolingTimeRod` | implementado |
| `ui.run('cooling.time.ruleofthumb', {hMm})` | Eq 9.8 t_c≈2h² | `cooling.ts:coolingTimeRuleOfThumb` | implementado |
| `ui.run('cooling.temp.centerline', {hMeters, tSeconds, m, terms?})` | Eq 9.4 serie de Fourier | `cooling.ts:centerlineTemperature` | implementado |
| `ui.run('cooling.curve', {hMeters, m, tMax, steps?})` | muestrea Eq 9.4 → [{t,T}] | `cooling.ts:coolingCurve` | implementado |
| `ui.run('cooling.heat', {mKg, cpJPerKgC, m})` | Eq 9.10 Q=m·cp·ΔT | `cooling.ts:heatToRemove` | implementado |
| `ui.run('cooling.report', {sections[], m})` | recorre secciones → t_c que domina | `cooling.ts:coolingReport` | implementado |

**Líneas de agua (coolinglines.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('coolant.flow.rate', {qLineW, dTallowC, c?})` | Eq 9.13 caudal | `coolinglines.ts:coolantFlowRate` | implementado |
| `ui.run('coolant.reynolds', {flowM3s, diaM, c?})` | Eq 9.14 (>4000 turbulento) | `coolinglines.ts:reynolds` | implementado |
| `ui.run('coolant.diameter.max', {flowM3s, c?})` | Eq 9.15 Dmax turbulento | `coolinglines.ts:maxLineDiameter` | implementado |
| `ui.run('coolant.diameter.min', {flowM3s, lineLenM, dPmaxPa, c?})` | Eq 9.17 Dmin por ΔP | `coolinglines.ts:minLineDiameter` | implementado |
| `ui.run('coolant.pressure.drop', {flowM3s, lineLenM, diaM, c?})` | Eq 9.16/9.18 | `coolinglines.ts:linePressureDrop` | implementado |
| `ui.run('coolingline.design', {qTotalW, nLines, lineLenM, dTallowC?, dPmaxPa?, coolant?})` | RESUELVE el circuito + plug DME + controlador | `coolinglines.ts:designCoolingLines` | implementado |
| `ui.run('coolingline.route', {spec, D})` | serpentín (segs, Ø, z detrás/arriba) | `mold-drawing-set.ts:coolingCircuit` | **parcial** — cuerpo fuera de los módulos núcleo |
| `ui.run('cooling.slenderCore', {coreDiaMm, coreLenMm})` | §9.2.4 baffle/bubbler/heat-pipe | `slendercore.ts:chooseSlenderCoreCooling` | implementado |
| `ui.run('cooling.linedia.select', {partMaxMm})` | §4.2.1 Ø por tamaño de molde | `moldbase.ts:coolingLineDia` | implementado |

**Campo térmico 3D (mold-thermal-fdm.ts + mold-tc-map.ts + mold-analysis.ts):**

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('thermal.sim', {spec, o?{cell?,coolantC?,partMesh?}})` | PDE de calor 3D (espectral + Robin agua); métodos `.step/.slice/.sliceAxis/.sampleAt` | `mold-thermal-fdm.ts:createThermalSim` | implementado |
| `ui.run('tc.map.local', {mesh, o?{cellMm?}})` | t_c local por columna + hot spot que detiene el ciclo | `mold-tc-map.ts:tcLocalMap` | implementado |
| `ui.run('tc.paint', {mesh, map})` | colorea la pieza por t_c (azul→rojo) | `mold-tc-map.ts:paintTcColors` | implementado |
| `ui.run('water.advice', {spec, map})` | ¿el agua cubre el hot spot? propone línea/baffle | `mold-tc-map.ts:waterAdvice` | implementado |
| `ui.run('thermal.surfaceField', {spec, o?})` | T superficial por resistencias en serie (Eq 9.7+9.20) | `mold-analysis.ts:surfaceTemperatureField` | implementado |
| `ui.run('cooling.stressK', {HoverD})` | K concentración del barreno de agua (Fig 9.4) | `mold-analysis.ts:coolingStressConcentration` | implementado |
| `ui.run('cooling.heatFluxVariance', {WoverH})` | Eq 9.23 ΔQ̇% (Menges) | `mold-analysis.ts:heatFluxVariancePct` | implementado |

### 2.5 Expulsión (§11)

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('ejection.stress.residual', {m})` | Eq 11.5 σ=E·CTE·ΔT | `ejection.ts:residualStress` | implementado |
| `ui.run('ejection.force.scalar', {m, draftDeg, aEffM2})` | Eq 11.7 F=µ·cos(draft)·σ·A | `ejection.ts:ejectionForce` | implementado |
| `ui.run('ejection.vector.solve', {m, o{aEffM2, draftDeg, massKg?, ejectAxis?, gravityDir?, g?}})` | Fig 11.5 balance Newton (peso g REAL) | `ejection.ts:ejectionVector` | implementado |
| `ui.run('ejection.kinematics.solve', {o{fMachineMaxN, fEjectN, ejectVelMs?, strokeM}})` | §11 SF, t=carrera/v | `ejection.ts:ejectionKinematics` | implementado |
| `ui.run('part.effectivearea.compute', {o{h,L,W,nWalls?,hWall?,nRibs?,…}})` | Eq 11.8 área de contacto | `ejection.ts:effectiveArea` | implementado |
| `ui.run('ejectorpin.buckling.check', {o{diaMm, freeLenMm, fPerPinN, eSteelPa?, K?}})` | §11.2.4 Euler SF≥2 | `ejection.ts:pinBuckling` | implementado |
| `ui.run('ejectorpin.size', {m, fEjectN, nPins, wallM, sigmaFatiguePa?})` | Eq 11.10 (fatiga) + Eq 11.12 (cortante) | `ejection.ts:ejectorPinSizing` | implementado |
| `ui.run('ejectorblade.inertia', {wMm, hMm})` | Eq 11.17 I=WH³/12 | `ejectortypes.ts:bladeInertiaM4` | implementado |
| `ui.run('ejectorblade.buckling.force', {wMm, hMm, lMm, ePa?})` | Eq 11.18 | `ejectortypes.ts:bladeBucklingForceN` | implementado |
| `ui.run('ejectorblade.maxlength', {fBladeN, wMm, hMm, ePa?})` | Eq 11.19 | `ejectortypes.ts:bladeMaxLengthMm` | implementado |
| `ui.run('ejectorblade.check', {o{fEjectN, nBlades, widthMm, thickMm, actualLenMm}})` | §11.3.2 veredicto pandeo | `ejectortypes.ts:checkEjectorBlade` | implementado |
| `ui.run('undercut.strain', {deltaMm, lMm})` | Eq 11.20 ε=δ/L | `ejectortypes.ts:undercutStrain` | implementado |
| `ui.run('undercut.force', {m, o{deltaMm, lMm, aEffM2, draftDeg?}})` | Eq 11.23 | `ejectortypes.ts:undercutEjectForceN` | implementado |
| `ui.run('undercut.shear', {fEjectN, phiMm, hMm})` | §11.3.5 τ=F/(π·φ·h) | `ejectortypes.ts:undercutShearMPa` | implementado |
| `ui.run('undercut.check', {m, o{deltaMm, lMm, aEffM2, phiMm, hMm, strainYieldPct?}})` | §11.3.5 ¿expulsable elástico? | `ejectortypes.ts:checkUndercut` | implementado |
| `ui.run('ejector.type.choose', {feat{rib?,boss?,fullPerimeter?,thinWall?,flatPushArea?}})` | §11.3.1-4 pin/blade/sleeve/stripper | `ejectortypes.ts:chooseEjectorType` | implementado |
| `ui.run('eject.unscrew', {t, strokeMm, m})` | roscas internas: torque, hélice, collapsible | `unscrewing.ts:unscrewTorque` | implementado |
| `ui.run('ejectorsleeve.check', {…})` | §11.3.3 sleeve + stack-up concentricidad | — | **falta** |
| `ui.run('stripperplate.check', {…})` | §11.3.4 fuerza perimetral + deflexión placa | — | **falta** |

### 2.6 Partición core/cavity

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('part.insert', {oc})` | Insert>Part: silueta declarada de la percha (partición no plana) | `curso-flow.ts:insertarPercha` | **parcial** — sin Shell/nervaduras |
| `ui.run('shrinkage.scale', {oc, pieza, factor?})` | Scale ×1.015 sobre centroide | `mold.ts:scaleForShrinkage` | **parcial** — isotrópica, no direccional |
| `ui.run('cavity.layout', {oc, piezaE})` | Move/Copy 2 cavidades rotadas ±90° | `curso-flow.ts:layoutDosCavidades` | **parcial** — no balancea flujo |
| `ui.run('partingline.detect', {oc, bodies, deflection?})` | Parting Lines 'at ± draft transition' → MENSAJE_VERDE | `curso-flow.ts:lineaParticion` | implementado |
| `ui.run('partingline.loops', {mesh, opts?})` | núcleo del detector: lazos cerrados + shut-offs internos | `parting.ts:partingLoops` | implementado |
| `ui.run('mold.split.plano', {oc, bodies, opts?})` | Tooling Split PLANO (exige zMax−zMin<0.05) | `curso-flow.ts:toolingSplitCurso` | implementado |
| `ui.run('mold.split.carve', {oc, bodies, opts?})` | Split NO PLANO por heightfield → MALLAS | `curso-flow.ts:toolingSplitCursoCarve` | **parcial** — salida malla, no B-Rep |
| `ui.run('mold.split.knife', {oc, piezaEscalada, opts?})` | Split B-Rep genérico (cuchilla cosida) | `parting.ts:splitNoPlano` | **parcial** — lazos estrella-convexos (falla en L/percha) |
| `ui.run('mold.splitByPlane', {oc, pieza, scale?, block?, zSplit?})` | Método 1 (jabonera): bloque−pieza por plano | `mold.ts:splitMoldByPlane` | implementado |
| `ui.run('mold.split', {oc, pieza, scale?, pinch?, plateThickness?, shutOffs?})` | Método 2 core&cavity (Fig 6-34) | `mold.ts:splitMold` | implementado |
| `ui.run('bbox.compute', {oc, shape})` | envolvente del B-Rep | `mold.ts:shapeBBox` | implementado |
| `ui.run('guides.drill', {oc, cavity, core, opts?})` | Hole Wizard: 4× buje Ø48 + 4× perno Ø35 | `curso-flow.ts:guiasCurso` | implementado |
| `ui.run('shutoff.window', {…})` | shut-off de ventanas (columna abanico al centroide) | `parting.ts:splitNoPlano` (VENTANAS) | **parcial** — solo camino cuchilla |
| `ui.run('shutoff.patch', {…})` | Delete-Face-and-Patch controlado con flag de mitad | `parting.ts:partingLoops` | **parcial** — se tapan solos, sin control de mitad |
| `ui.run('secondcavity.mirror', {oc, piezaE})` | Move/Copy Body para 2ª cavidad | `curso-flow.ts:layoutDosCavidades` | **parcial** — copia sólido, no espeja superficies |
| `ui.run('core.stress.axial', {pMPa, phiTopMm, phiOuterMm, phiInnerMm})` | Eq 12.19 σ axial + δ | `cores.ts:axialStress` | implementado |
| `ui.run('core.stress.hoop', {pMPa, phiCoreMm, hWallMm})` | Eq 12.20-22 hoop, h_min, Ø_int máx | `cores.ts:hoopStress` | implementado |
| `ui.run('core.stress.bending', {dPMPa, phiOuterMm, phiInnerMm, heightMm, interlocked?})` | Eq 12.25-26 δ flexión (interlock ÷10) | `cores.ts:coreBendingMm` | implementado |
| `ui.run('core.design', {meltPressureMPa, phiOuterMm, phiInnerMm, heightMm, metalKey?, interlocked?})` | §12.3 diseño acoplado del core hueco | `cores.ts:designCore` | implementado |
| `ui.run('sideaction.extract', {…})` | Mold Tools>Core: inserto lateral desde croquis+cara | — | **falta** |
| `ui.run('draft.apply', {oc, shape, neutralPlane, faces[], angleDeg})` | Draft feature (aplicar el ángulo, no solo diagnosticar) | — | **falta** |
| `ui.run('fillet.apply', {oc, shape, edges, radiusMm})` | cadena R20→R10→R5→R4 (matar esquinas) | — | **falta** |
| `ui.run('chamfer.apply', {oc, shape, edges, distMm, angleDeg?})` | Chamfer 10×45° base / 1×45° testigo | — | **falta** |
| `ui.run('partingsurface.build', {oc, partingLoop, midPlane, depthMm})` | superficie de partición como CUERPO editable | — | **falta** |
| `ui.run('shutoff.deleteface', {oc, surfaceBody, cylFaces})` | Delete-and-Patch de caras cilíndricas | — | **falta** |
| `ui.run('interlock.build', {oc, body, cornerRectMm, filletR, draftDeg, clearanceMm})` | interlocks de esquina manuales | — | **falta** |

### 2.7 Mecanismos (side-actions, interlocks, 3 placas)

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('sideaction.plan', {region\|sa, o?})` | Eq 11.24 F + Eq 11.26 L perno + Eq 11.25 bore; VETO §13.9.1 | `mold-sideaction-gen.ts:planSideAction` | implementado |
| `ui.run('sideaction.planBatch', {regions[], o?{max?}})` | por región, filtra y ordena, tope max=4 | `mold-sideaction-gen.ts:planSideActions` | implementado |
| `ui.run('sideaction.planFromSpec', {sa, coreHmm?, foot?})` | reproduce el bezel del libro (sin malla) | `mold-sideaction-gen.ts:planFromSpec` | implementado |
| `ui.run('sideaction.study', {plan, o?{pitchMm}})` | veredictos Eq 11.20/11.24/11.26 + §11.3.7 | `mold-sideaction-gen.ts:sideActionVerdicts` | implementado |
| `ui.run('sideaction.envelope', {plan})` | sobre en dirección de jale | `mold-sideaction-gen.ts:envelopeMm` | implementado |
| `ui.run('slideunit.pick', {coreWmm, coreHmm, strokeMm})` | unidad comercial más chica CU-25..90 | `mechanism-catalog.ts:pickSlideUnit` | implementado |
| `ui.run('slideunit.list', {})` | catálogo SLIDE_UNITS | `mechanism-catalog.ts:SLIDE_UNITS` | implementado |
| `ui.run('interlock.plan', {spec, o?{pMeltMPa?}})` | Eq 12.18 τ; Ø máx que aguanta+cabe; §12.2.5 | `mold-interlocks.ts:planInterlocks` | implementado |
| `ui.run('interlock.shear', {pMeltMPa, widthMm, hCavityMm, areaMm2})` | Eq 12.18 τ=F/A | `mold-interlocks.ts:interlockShear` | implementado |
| `ui.run('threeplate.layout', {partHeightMm, clampTons, openFactorAB?, plates?})` | §6.3.2 stack + particiones A-B/A-X | `threeplate.ts:threePlateLayout` | implementado |
| `ui.run('mold.openingVelocity', {clampTons})` | v=184+13·log10(F) (Tabla 6.1) | `threeplate.ts:moldOpeningVelocity` | implementado |
| `ui.run('mold.openingStroke', {partHeightMm, factor?})` | §6.3.2 carrera A-B = factor·altura | `threeplate.ts:moldOpeningStrokeMm` | implementado |
| `ui.run('mold.daylightNeeded', {stackMm, openStrokeMm})` | Tabla 6.1 daylight = cierre + carrera | `threeplate.ts:daylightNeededMm` | implementado |
| `ui.run('threeplate.openingSequence', {layout, u})` | cinemática doble apertura §6.3.2 | `threeplate.ts:openingSequence` | implementado |
| `ui.run('feed.compare', {twoPlate, threePlate, clampTons})` | comparativa 2 vs 3 placas (Tabla 6.1) | `threeplate.ts:compareFeedSystems` | implementado |
| `ui.run('suckerpin.design', {runnerDiaMm})` | §6.5.2 retiene la colada en la X | `threeplate.ts:suckerPinDesign` | implementado |

### 2.8 Estructura, placas & análisis (§12)

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('plate.support', {clampTons\|fN, spanM, widthM, maxPillars})` | deflexión + nº pilares óptimo | `platesizing.ts:optimizeSupportPlate` | implementado |
| `ui.run('plate.cavity', {cavityDepthMm, lineDiaMm\|pMeltMPa})` | §9.2.5 espesor placa cavidad | `platesizing.ts:sizeCavityPlate` | implementado |
| `ui.run('plate.snapCommercial', {tMm})` | redondeo a espesor comercial | `platesizing.ts:snapToCommercialPlate` | implementado |
| `ui.run('plate.bending', {F_N, span, width, thk})` | Eq 12.10 δ viga → riesgo rebaba | `structural.ts:plateBending` | **parcial** — solo factory; en master lo cubre `plate.support` |
| `ui.run('structural.plates', {spec, pMeltMPa?})` | corte + flexión + pilares + cheek (Eq 12.8-17) | `mold-analysis.ts:moldStructural` | implementado |
| `ui.run('analysis.byComponent', {spec, o?{pMeltMPa?}})` | verdicts placa por placa (Euler pin, compresión, masa) | `mold-analysis.ts:componentAnalysis` | implementado |
| `ui.run('analysis.full', {spec, o?{pMeltMPa?, coolantC?}})` | térmico(§9) + estructural(§12) unificado | `mold-analysis.ts:moldAnalysis` | implementado |
| `ui.run('fea.buildSolid', {K, oc, spec})` | sólido de análisis (puente de flexión Fig 12.11) | `mold-fea.ts:buildMoldFeaSolid` | implementado |
| `ui.run('fea.run', {K, oc, spec, o?{pMeltMPa?, resolution?}})` | FEA volumétrico REAL (tet + CG) vs viga conservadora | `mold-fea.ts:runMoldFea` | implementado |
| `ui.run('audit.geometry', {parts, spec})` | batería geométrica anti-bug sobre bboxes reales | `mold-audit.ts:auditMold` | implementado |
| `ui.run('coords.audit', {spec})` | §12.4 features + capacidad por tornillo | `mold-coords.ts:coordAudit` | implementado |

### 2.9 Base, insertos, máquina & material (§4)

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('metal.select', {produccionAnual?, resinaAbrasiva?, resinaCorrosiva?, pulidoEspejo?, prototipo?})` | §4.4 + Ap. B: 11 aceros con DIN/W-Nr | `moldbase.ts:selectMetal` | implementado |
| `ui.run('insert.size', {Lmm, Wmm, depthMm})` | §4.2.2 altura + cheek | `moldbase.ts:sizeInserts` | **parcial** — el macho del core se dimensiona aparte |
| `ui.run('base.select', {ins, layout{nx, ny}})` | §4.3 base estándar 196-996 mm, aspecto ≤2:1 | `moldbase.ts:selectMoldBase` | implementado |
| `ui.run('machine.check', {mold, mc})` | §4.3.3 tie bars, daylight, shot 25-50%, clamp | `moldbase.ts:checkMachine` | implementado |
| `ui.run('machine.requirements', {o{projectedAreaM2, cavityPressureMPa, partVolumeCc, nCav, fillPressureMPa, ejectionForceN, clampSF?, pressureSF?}})` | Eq 5.29 + shot + presión + expulsión | `machinesizing.ts:machineRequirements` | implementado |
| `ui.run('machine.select', {req, mold{wmm, lmm, stackMm, openStrokeMm}, catalog?})` | inyectora mínima; reporta restricción que gobierna | `machinesizing.ts:selectInjectionMachine` | implementado |

### 2.10 Roscas & tornillería (§12.4, ISO 68-1, Shigley)

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('bolt.capacity', {t})` | Shigley cap 8 Fp=At·Sp (12.9) | `mold-fasteners.ts:boltCapacityKN` | implementado |
| `ui.run('bolt.engagement.length', {t, plateSyMPa})` | FED-STD-H28 Le | `mold-fasteners.ts:engagementLengthMm` | implementado |
| `ui.run('fastener.plan', {spec, o?{half?, loadKN?}})` | §12.4 Fig 12.33 izaje n_g=10 → Ø+N mínimo | `mold-fasteners.ts:fastenerPlan` | implementado |
| `ui.run('fastener.select', {fN, sigmaPa?})` | §12.4.2 DIN por tensión (σ_ult 800 MPa) | `fasteners.ts:selectMoldScrew` | implementado |
| `ui.run('plate.yield.lookup', {spec})` | fluencia del acero del barreno | `mold-fasteners.ts:plateYieldMPa` | implementado |
| `ui.run('thread.dims', {d, P})` | ISO 68-1 triángulo métrico | `mold-threads.ts:threadDims` | implementado |
| `ui.run('thread.resolve', {dMm, o?{fine?, hand?, starts?, internal?}})` | Ø medido → ThreadSpec (auto-detección) | `mold-threads.ts:resolveThread` | implementado |
| `ui.run('thread.parse', {desig})` | parser 'M10×1.5' → ThreadSpec | `mold-threads.ts:parseThread` | implementado |
| `ui.run('thread.mate.check', {bolt, hole})` | ¿acopla tornillo↔barreno? | `mold-threads.ts:threadsMate` | implementado |
| `ui.run('thread.chamfer.cap', {dz, major, pitch})` | ISO 4753 chaflán de punta | `mold-threads.ts:chamferCapR` | implementado |
| `ui.run('thread.mesh.build', {spec, length, o?})` | superficie helicoidal como malla | `mold-threads.ts:threadSurfaceMesh` | implementado |
| `ui.run('shaft.mesh.build', {r, z0, z1, nPhi?})` | cilindro liso del vástago | `mold-threads.ts:plainShaftMesh` | implementado |
| `ui.run('thread.realness.measure', {mesh})` | auditoría: variación radial ≈ h=0.54·P | `mold-threads.ts:threadRealnessMm` | implementado |
| `ui.run('mesh.normals.compute', {pos, idx})` | normales por acumulación de caras | `mold-threads.ts:computeNormals` | implementado |
| `ui.run('head.resolve', {std, dMm})` | cabeza DIN + asiento + chaflán | `mold-heads.ts:resolveHead` | implementado |

### 2.11 Costeo (§3)

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('cost.total', {o, n})` | Eq 3.1 C=C_fijo + n·C_marginal | `cost.ts:totalCost` | implementado |
| `ui.run('cost.breakEven', {a, b})` | Eq 3.1 ΔC_fijo/ΔC_marginal | `cost.ts:breakEven` | implementado |
| `ui.run('cost.choose', {options[], n})` | arquitectura más barata al volumen n | `cost.ts:chooseMold` | implementado |
| `ui.run('cost.perPart', {o, n})` | Tabla 3.1 C/pza amortizado | `cost.ts:costPerPart` | implementado |
| `ui.run('cost.estimateMold', {CostInputs})` | §3.3 costeo DETALLADO | `moldcost-detailed.ts:estimateMoldCost` | implementado |
| `ui.run('cost.estimatePart', {moldUSD, qty, …})` | §3.4 costo por pieza | `moldcost-detailed.ts:estimatePartCost` | implementado |
| `ui.run('cost.mold.simple', {arch, cav, projAreaMm2, nSlides})` | estimador simplificado | `factory.ts:estimateMoldCost` | **parcial** — aproximado vs §3.3 detallado |

### 2.12 Planos, cotas & entregables

| Comando | Params | forjaFn | Status |
|---|---|---|---|
| `ui.run('stack.build', {spec})` | apilado de placas + planos z de partición | `mold-assembly.ts:buildMoldStack` | implementado |
| `ui.run('drawing.assembly', {spec})` | lámina de ENSAMBLE: sección A-A + BOM + notas | `mold-assembly.ts:moldAssemblyDrawing` | implementado |
| `ui.run('drawing.set', {spec, analysisRows?})` | ENTREGABLE: set completo A3 → PDF | `mold-drawing-set.ts:moldDrawingSet` | implementado |
| `ui.run('drawing.plate', {PlateSpec})` | plano individual: planta + vistas + tabla barrenos | `mold-drawings.ts:renderPlateDrawing` | implementado |
| `ui.run('drawing.analysisSheet', {spec, rows})` | HOJA DE INGENIERÍA: cada barreno con § y veredicto | `mold-drawing-set.ts:analysisSheet` | implementado |
| `ui.run('plate.defs', {spec})` | §4 definición de 7 placas | `mold-drawing-set.ts:plateDefs` | implementado |
| `ui.run('plate.holes', {spec, role})` | §12.4 layout simétrico de barrenos por rol | `mold-drawing-set.ts:standardHoles` | implementado |
| `ui.run('plate.holeLegend', {holes})` | leyenda de propósito | `mold-drawing-set.ts:holeLegend` | implementado |
| `ui.run('cavity.footprint', {spec})` | huella en planta de la cavidad | `mold-drawing-set.ts:cavityFootprint` | implementado |
| `ui.run('cavity.grid', {spec, D})` | rejilla multi-cavidad centrada | `mold-drawing-set.ts:cavityGrid` | implementado |
| `ui.run('cavity.openings', {spec, D})` | aberturas por impresión (round/rect) | `mold-drawing-set.ts:cavityOpenings` | implementado |
| `ui.run('plano.set', {spec})` | planos con COLOR: 4 iso por placa translúcida | `mold-plano-set.ts:buildPlateSolid` | implementado |
| `ui.run('dims.component', {c})` | cotas 3D de placa desde la receta | `mold-dimensions.ts:componentDims` | implementado |
| `ui.run('dims.part', {c})` | cotas 3D de la pieza (boca/alto/salida/R/pared) | `mold-dimensions.ts:partDims` | implementado |
| `ui.run('dims.verify', {dims, measure, tolMm?})` | DETECTOR: receta vs sólido reconstruido | `mold-dimensions.ts:verifyDims` | implementado |
| `ui.run('recipe.mold', {spec}\|{spec, role})` | receta EDITABLE (croquis→extruir→bolsa→barrenos) | `mold-recipe.ts:moldRecipe` | **parcial** — solo placas A/B; faltan clamp/soporte/housing |
| `ui.run('shrink.pvt', {c: TaitCoeffs, tK, pPa})` | contracción por EOS pvT de Tait → escala | `shrinkage.ts:shrinkage` | **parcial** — solo factory, ISOTRÓPICA |

---

## 3 · HUECOS — los huesos que le faltan a la UI

Lo que un agente pide y hoy **no** encuentra en el registro (o encuentra a medias).

### 3.1 Faltantes duros (`status='falta'` — 9 comandos)

Geometría de modelado que hoy se **diagnostica** pero no se **ejecuta**, y verificaciones que
`chooseEjectorType` promete pero nadie cumple:

| Comando | Qué falta | Bloqueado por |
|---|---|---|
| `draft.apply` | inclinar caras (neutral-plane). Hoy `draft.analyze` solo diagnostica. | envolver `BRepOffsetAPI_DraftAngle` |
| `fillet.apply` | cadena R20→R10→R5→R4 en el pipeline del molde (`filletAllEdgesResilient` existe en el kernel, no aquí) | cablear kernel → pipeline |
| `chamfer.apply` | chaflán de base + testigo de orientación | idem |
| `partingsurface.build` | superficie de partición como **B-Rep editable** (hoy solo el equivalente sólido: cuchilla/heightfield) | Surface-Extrude + Trim + Knit |
| `shutoff.deleteface` | Delete-and-Patch de caras cilíndricas (barrenos de orejas/bisagras) | parcheo de cara cilíndrica |
| `sideaction.extract` | extraer el inserto lateral desde croquis+cara (los mecanismos existen, no cableados a este pipeline) | cablear `planSideAction` → geometría |
| `interlock.build` | interlocks de esquina como geometría (hoy solo `planInterlocks` numérico) | Move Face −1mm holgura |
| `ejectorsleeve.check` | §11.3.3 dimensionado del sleeve + stack-up de concentricidad | falta la fn (a diferencia de pin/blade) |
| `stripperplate.check` | §11.3.4 fuerza perimetral + deflexión de la placa stripper | idem |

### 3.2 Parciales (`status='parcial'` — 18 comandos)

Existen pero con **límite declarado**. Los tres cuellos de botella:

- **Salida malla, no B-Rep editable:** `mold.split.carve` (heightfield) y `weld.detect`/`flow.measure`/`fill.front`
  (campos voxelizados). Sirven para VER y decidir, no para seguir modelando encima.
- **Geometría estrella-convexa:** `mold.split.knife` (`splitNoPlano`) se auto-interseca en formas L /
  percha larga — por eso existe `.carve` como escape.
- **Aislado del orquestador:** muchos módulos ricos (`feed.optimize`, `gate.design`, `vent.design`,
  `plate.bending`, `screw.size`, `shrink.pvt`, `cavity.grid`) **solo viven en `factory.ts`**; el producto
  principal `mold.machine` los sustituye por factores fijos (runnerVolume 0.02/0.25, packFactor escalar,
  contracción ×1.015). **`moldMachine` ni siquiera importa `venting`** → gap del entregable estrella.

Otros parciales: `part.insert`/`shrinkage.scale`/`cavity.layout`/`secondcavity.mirror` (adaptaciones
declaradas del curso, sin balanceo de flujo), `shutoff.window`/`shutoff.patch` (sin control de a qué
mitad va el acero), `insert.size` (no dimensiona el macho del core), `recipe.mold` (solo placas A/B),
`coolingline.route` (cuerpo fuera de los módulos núcleo), `cost.mold.simple` (aproximado), `fill.report`
(packFactor escalar).

---

## 4 · ESTUDIOS QUE FALTAN — la física que el molde aún no calcula

La lista dedup de estudios de ingeniería que el molde **debería** predecir y no. Agrupados por familia,
más severos primero. **Este es el backlog científico del molde.**

### 4.1 Los que aparecen en CASI TODOS los módulos (deuda transversal)

| # | Estudio | Estado actual | Impacto |
|---|---|---|---|
| 1 | **Warpage / alabeo** | inexistente en todos los módulos | distorsión diferencial al enfriar; el molde tiene el campo térmico 3D que lo alimentaría pero no lo usa |
| 2 | **Contracción DIRECCIONAL / anisotrópica** | solo `scaleForShrinkage` isotrópica ×1.015 | semicristalinos (PP) contraen distinto flujo vs transversal → cotas fuera de tolerancia; falta shrinkage **tensorial** |
| 3 | **Venteo: DÓNDE + cuánto** | `vent.design` da el land límite; `flow.measure`/`weld.detect` ubican el atrapamiento | pero nadie **diseña** el venteo (posición, 5-20µm) ni detecta air-traps/quemado diésel; `moldMachine` ni importa venting |
| 4 | **Fuerza de cierre por área proyectada REAL** | `projectedAreaM2` es siempre **INPUT**; `clampFor` usa bbox L×W | ignora la silueta real (con orificios) **y** el área proyectada de la COLADA (sprue/runner); crítico para elegir prensa |
| 5 | **Vida a FATIGA del acero (S-N / ciclos)** | `MOLD_METALS.fatigueLimitMPa` es límite ESTÁTICO; `P_max=σe/K` | ninguna fn cuenta **ciclos a falla** ni acumula daño; falta fatiga térmica de superficie (heat checking/crazing) |

### 4.2 Llenado, empaque & defectos de flujo

- **Presión/tiempo de empaque (packing/holding) real y congelamiento de compuerta (gate freeze/seal time):**
  hoy `fill.report` usa un `packFactor` escalar; no hay curva de sostenimiento ni cuándo cerrar el flujo.
- **Fuerza de cierre por presión PICO de empaque** (no la de llenado, conservadora — el propio código lo advierte).
- **RESISTENCIA de la línea de soldadura** (no solo su ubicación): `weld.detect` marca DÓNDE; falta el knock-down
  mecánico/óptico por temperatura y ángulo de encuentro de los frentes.
- **Tiempo de llenado REAL en segundos + perfil V/P:** `fill.front` ordena por resistencia, sin eje de tiempo físico.
- **Rechupe (sink marks) cuantitativo** por relación costilla/pared y presión (hoy solo la regla ≤70% cualitativa).
- **Jetting / chorro en el gate:** criterio de velocidad de entrada vs tipo de gate.
- **Calentamiento viscoso / shear heating** en gate y runner (sube T_melt local).
- **Contracción vía PVT con presión** (no solo ΔT térmico).
- **Orientación de fibra / anisotropía** para materiales cargados (fibra de vidrio).

### 4.3 Balanceo & multi-cavidad

- **Balance reológico automático de runners multi-cavidad** (llenado simultáneo, natural vs artificial):
  `feed.optimize` dimensiona UNA ruta nozzle→gate, no ajusta geometría para que todas las cavidades llenen a la vez.
- **Balance térmico del hot-runner:** potencia por zona, ΔT a lo largo del manifold, control de arranque
  (el manifold se dibuja, no se calcula).
- **Costo del runner frío / scrap regranulado:** `feed.volume` da el volumen, no lo convierte en % desperdicio/costo.
- **Nº de cavidades limitado por CALIDAD/tolerancia**, no solo economía+throughput (el optimizador es puramente económico).

### 4.4 Térmico avanzado

- **Coeficiente de convección h REAL:** el térmico usa `h=1000 W/m²·°C` hardcodeado; falta derivarlo del flujo
  con Nusselt/Dittus-Boelter (`Nu=0.023·Re^0.8·Pr^0.4`) y realimentar la frontera de Robin.
- **ΔT progresivo del refrigerante entrada→salida** acoplado al campo (hoy T_coolant constante por barreno).
- **Balance controlador vs calor/ciclo:** `designCoolingLines` valida caudal máx pero no compara Q (`heatToRemove`)
  contra `coolKW` del controlador (Tabla 9.1).
- **Balance térmico núcleo vs cavidad** (ΔT entre mitades → la pieza contrae hacia el core; clave para expulsión).
- **Biblioteca de propiedades térmicas reales ≠ ABS:** todo corre con α/T_eject del ABS (`material.esProxy` lo
  declara honestamente) — faltan PP, PE, PC, POM… para que los segundos sean de la resina real.
- **Uniformidad steady-state entre cavidades** como métrica de calidad (más allá del transitorio).

### 4.5 Expulsión, estructura & mecánica del bloque

- **Fuerza de expulsión DERIVADA:** `machine.requirements` toma `ejectionForceN` como INPUT; `componentAnalysis`
  usa el heurístico ~5% de F. Falta la fuerza real (contracción×fricción×área) + nº/Ø de expulsores.
- **Retorno de la placa expulsora:** return pins, resortes, fuerza y secuencia (inexistente).
- **Fuerza de apertura del molde y desprendimiento del bebedero (sprue break).**
- **Stack-up de concentricidad del sleeve (§11.3.3) y deflexión del stripper (§11.3.4)** — se ELIGEN, no se dimensionan.
- **Respiración del molde:** deflexión de tie-bars y paralelismo de platinas bajo inyección.
- **Deflexión ABSOLUTA de pared lateral vs tolerancia** (`planInterlocks` calcula el beneficio ÷2, no el valor absoluto).
- **Pandeo/flexión del perno angular** (se dimensiona L Eq 11.26, nunca el Ø contra Euler), **ángulo de auto-bloqueo
  y fuerza del heel block**, **presión de contacto/desgaste del gib de bronce**, **resorte de retorno de la corredera**
  (todos afirmados, ninguno calculado).
- **Deflexión de la LÍNEA DE PARTICIÓN bajo presión** (rebaba por apertura de placas, no solo flexión global).
- **Deflexión de placas de soporte y pilares** bajo presión de cavidad (hoy a cotas del curso).

### 4.6 Calidad dimensional & vida útil

- **Stack-up de TOLERANCIAS / GD&T y Cpk** sobre cotas moldeadas (`verifyDims` compara UNA pieza; falta propagar
  la cadena de armado: posición de cavidad, concentricidad de pilares).
- **Ventana de proceso:** ¿la pieza sale en tolerancia? (contracción + deflexión de core + alabeo combinados).
- **Desgaste / erosión de compuerta y cavidad por resina abrasiva** (`metal.select` elige acero por abrasividad,
  no cuantifica ciclos de vida del inserto).
- **Draft mínimo vs profundidad de textura SPI** para liberar sin arrastre (hoy `draftDeg` solo alimenta la fuerza
  de expulsión, no la liberación de textura).
- **Concentración de esfuerzo Kt cuantificada** en esquinas/filetes vivos (§2.3.4 solo aplica la regla cualitativa).

---

*Registro canónico del molde — 184 comandos · 157 implementados · 18 parciales · 9 faltantes. El molde es
la antorcha: la física ya está poblada. Los agentes construyen sobre este vocabulario.*
