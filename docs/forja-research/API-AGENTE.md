# La Forja — API de Agente (la maneja una IA o un humano)

> Visión del fundador: *"al final del día habrá IAs que lo manejen"*. Esta es esa
> API: construir máquinas y calcular su mecánica **por la interfaz**
> (`window.__forgeBrep`), sin hardcodear geometría — igual que lo haría un humano.

## Las tres piezas

1. **`scripts/forja-agent.cjs` — el SDK `ForjaAgent`.** Envuelve Playwright +
   `window.__forgeBrep` en verbos limpios. Una IA (o un script humano) construye y
   analiza sin tocar el código de la app. Cada acción pasa por la app instrumentada
   → **genera telemetría real**.

2. **`src/forja/mech/dinamica.ts` — física real (PURA, 14/14 tests).** Peso,
   fricción/tracción (Coulomb `F=μN`), pendiente máx (`tanθ≤μ`), rodadura, torque de
   rueda (`τ=Fr`), torque de sostén de brazo (momento estático). Sin curvas inventadas.

3. **`scripts/demo-maquinas.cjs` — la demostración.** Una IA construye un CARRO y un
   ROBOT por la interfaz y calcula su mecánica. Correr:
   `node --import tsx scripts/demo-maquinas.cjs`.

## Qué hace el SDK (verbos)

```js
const { ForjaAgent } = require('./forja-agent.cjs');
const a = await new ForjaAgent().open();          // navegador GPU + app lista
// CONSTRUIR (todo por la interfaz):
await a.newDoc();
await a.sketch({ kind:'rect', width:140, height:70 });
await a.updateOpByType('extrude', { depth:14 });
await a.material('alu');
await a.addComponent('cyl', { r:22, h:14, x:55, y:28, z:-7 });  // ensamblaje
// ANALIZAR (por el kernel, vía la interfaz):
const kg  = await a.massKg();        // peso/masa del ENSAMBLE (exacto)
const fea = await a.fea({ N:500 });  // von Mises + FOS
// CAPTURAR:
await a.shot('/tmp/x.png');
console.log(a.telemetry());          // {total, by_type, errors}
await a.close();
```

## Resultado de la demo (medido, 2026-06-23)

**Carro (rover 4×4)** — chasis = placa extruida; 4 ruedas = cilindros. Por la interfaz.
| magnitud | valor |
|---|---|
| masa (del kernel) | 0.60 kg |
| peso | 5.89 N |
| carga por rueda | 1.47 N |
| tracción máx (μ=0.7) | 4.12 N |
| **pendiente máx sin patinar** | **35°** (=atan 0.7) |
| torque por rueda | 0.023 N·m |
| sube 20° / 40° | sí / no |

**Robot (brazo 2 eslabones)** — base + 2 cajas acodadas. Por la interfaz.
| magnitud | valor |
|---|---|
| masa ensamble | 0.279 kg |
| alcance | 0.21 m |
| **torque de sostén (hombro)** | **1.26 N·m** |
| torque (codo) | 0.48 N·m |
| torque solo de la carga (0.5 kg) | 1.03 N·m |

## Telemetría (corregida esta sesión)

- **Cada operación** ahora emite `forja.op {op}` (antes solo FEA/generativo). También
  `forja.export`, `forja.plano`, `forja.op {op:'component'}`. → se ve QUÉ se usa.
- Se **eliminó el warning deprecado** `PCFSoftShadowMap` (Canvas `shadows="percentage"`):
  la telemetría pasó de **50 `console_warn`/sesión a 0**.

## Gaps que la visión "carro/robot" DESTAPA (para la siguiente etapa de la API)

1. **Rotación de componentes solo en Z (`rz`).** No se puede orientar una rueda
   (eje horizontal) ni armar ensambles 3D reales. **Falta rotación 3-ejes + juntas**
   (revoluta/prismática) con DOF — es el M2 del plan maestro, ahora con caso de uso
   concreto (carro/robot). Sin esto las ruedas salen como cilindros verticales.
2. **Un solo material por ensamble.** No se mezcla rueda de hule + chasis de aluminio;
   la masa de máquinas multi-material es aproximada. Falta material por componente.
3. **Sin dinámica de cuerpos.** `dinamica.ts` es cuasi-estático (sin inercias ni
   contacto). Para "manejar" el carro/robot en simulación falta integrador (DAE).

> Regla: la geometría se genera por la interfaz; la física (dinamica.ts) entra con
> su gate analítico (14/14) antes de mostrarse. Compila ≠ funciona.
