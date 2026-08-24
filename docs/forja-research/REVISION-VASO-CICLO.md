# REVISIÓN — EL VASO CONTRA LA MÁQUINA DEL CICLO (1 producto → 10)

> Turno de **revisión**, no de cambios (pedido de ian). El vaso ya carga como
> proyecto #2; aquí está el mapa de por qué NO tiene el ciclo del cubo y qué hay
> que cambiar, estación por estación. Nada de esto se arregló todavía.

## El estado, en una línea
La máquina E1→E12 no es una "máquina de moldes": es **la máquina DEL CUBO**. Cada
motor `estacion*Dado` tiene el cubo cableado por dentro (dimensiones, geometría,
o el `MachineSpec`). El vaso carga, se edita… y no puede entrar al ciclo porque
ningún motor sabe recibir otra pieza.

**Evidencia visual (3 ss):**
1. `lobby.png` — EL VASO es tarjeta de proyecto #2, junto a EL DADO.
2. `cargado.png` — carga como pieza EDITABLE: Boceto→Extrude→Shell, vol
   **27,416.679 mm³** = π·40²·20 − π·37²·17 exacto.
3. `cubo-ciclo.png` — el cubo SÍ despliega las 12 estaciones (Admisión→El acta);
   el panel dice "cubo MACIZO 50×50×50" y "dado 40×40×40" — geometría cableada.

## La raíz: dónde vive el cubo (con archivo y línea)

| Qué | Dónde | Cómo está cableado al cubo |
|---|---|---|
| Spec de la pieza | `estudio-molde-datos.ts` `DADO_SPEC` | `MachineSpec` literal 40×40×40, pared 2, ABS, 100k/año |
| Sólido de la pieza | `dadoRectoShape` / `dadoDraftShape` / `dadoUndercutShape` | `makeBox(40,40,40)` − `makeBox(36,36,39)` — cubo puro |
| Test de interior | `dentroDadoLocal(x,y,z)` | `z∈[0,40]`, insets con `tan(1.5°)`, piso `z<2` — cubo con draft |
| DFM (E1) | `estacion1Dado()` | **sin argumentos**: compara macizo 50³ vs dado 40³ |
| Economía (E2) | `estacion2Dado()` | **sin argumentos**: `moldMachine(DADO_SPEC)` |
| Eyección A_eff | `estacion10Dado` | `effectiveArea({h:0.002, L:0.040, W:0.040})` — caja 40 |
| Enchufe del ciclo | `useMoldStudio.loadDado` | crea `ciclo:{estacion:1, e1:estacion1Dado()}` con partes del cubo |

Los motores E4–E12 SÍ reciben `pkg` y `DatumsColada` como parámetros — pero el
`pkg` que les llega **siempre** es `moldMachine(DADO_SPEC)`, y el campo de
llenado (E5) usa `dentroDadoLocal`. O sea: la firma acepta parámetros, pero el
único que los llama es el cubo.

## Qué haría falta para 10 productos (el trabajo del próximo turno)

El patrón a introducir es **un contrato de PIEZA** que la máquina reciba, en vez
de leer el cubo:

```
PartSpec = {
  kind: 'box' | 'cup' | 'flat' | …
  solid: Shape                    // dadoRectoShape → el sólido del árbol del usuario
  inCavity: (x,y,z) => boolean    // dentroDadoLocal → test del sólido real
  machineSpec: MachineSpec        // DADO_SPEC → derivado de la bbox + material del doc
  wallMm, draftDeg, aEffM2 …       // hoy literales
}
```

Y cada motor pasa de `estacion1Dado()` a `estacion1(part)`. Trabajo estación×estación:

1. **E1 DFM** — recibir la pieza y su material; el "control negativo" (macizo)
   se deriva de la bbox, no se hardcodea a 50³.
2. **E2 Economía** — `moldMachine(part.machineSpec)`, no `DADO_SPEC`.
3. **E3 Arquitectura** — `construirAceroE3` ya toma `pkg`; falta que parta el
   SÓLIDO DE LA PIEZA (hoy `dadoDraftShape`), no el cubo. **Aquí muere el vaso
   recto**: `splitMold` necesita draft o un eje de revolución; un vaso de
   paredes rectas sin draft no parte (es el hallazgo del draft ciego a cilindros).
4. **E4 Llenado** — `flujoMm` y `wallMm` de la pieza, no `=2`.
5. **E5 Alimentación** — `inCavity = part.inCavity`, no `dentroDadoLocal`.
6. **E6–E9** — reciben `pkg`+`datums`; correcto una vez que `pkg` y `datums`
   salgan de la pieza real.
7. **E10 Expulsión** — `aEffM2` de la pieza; y **conectar el check §11.2.5**
   (¿caben los pines?) que hoy falta — para el vaso HONDO eso obliga stripper.
8. **E11–E12** — estructurales; heredan lo de arriba.

**Puente pieza→molde (bloqueador #0):** hoy `cursoRef.current.pieza` solo lo
escriben piezas hardcodeadas. El vaso del árbol no llega a MOLD TOOLS
(deshabilitado). Sin este puente, ningún producto nuevo entra al ciclo.

## Orden de ataque sugerido (no ejecutado)
1. El **puente** pieza-del-árbol → `cursoRef.current.pieza` (desbloquea todo).
2. `PartSpec` + `estacion1/estacion2` parametrizados (las dos sin-args de hoy).
3. E3 con el sólido de la pieza + decidir el camino del vaso recto (stripper /
   revolución) — es donde el vaso y el cubo DIVERGEN de verdad.
4. §11.2.5 en E10 (el check que ya se documentó como faltante).

## Lo que NO se tocó (a propósito, es revisión)
Cero motores modificados. El gate del cubo sigue **181/181** (no se tocó la
máquina). Los tres hallazgos previos (eyección sin §11.2.5, draft ciego a
cilindros, puente ausente) se confirman aquí como los tres bloqueadores del
paso "1 producto → 10".
