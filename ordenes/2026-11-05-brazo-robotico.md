# ORDEN H: el brazo robótico completo, en vivo (agente de fondo)

ESTADO: hoy. ian presente: «un agente de fondo el B… un brazo robótico completo, medición de campos magnéticos en vivo».

BASE: d675896

OBJETIVO: el brazo de 3 ejes de `src/forja/mech/brazo.ts` (juntas cicloidales) simulado COMPLETO y en vivo. Los tres dominios van acoplados en lazo cerrado:
- **dinámica de cuerpo rígido:** gravedad, carga, fricción;
- **eléctrico:** cada junta con su motor DC (R, L, k_t, k_e) y su reductor cicloidal; la fcem regresa al circuito;
- **campo magnético** de las corrientes de los motores, con un gaussímetro que se arrastra.

Va en módulos PUROS más una escena con el patrón de `ArcoVivo.tsx`. NO toca `ForgeBRepStudio.tsx`: la integración al lobby y al estudio la hace la sesión principal.

## YA-EXISTE (prueba de ausencia)

- `src/forja/mech/brazo.ts`, `armgen.ts`, `dinamica.ts` y `cycloidal.ts`: solo cuentas estáticas, sin dinámica temporal, sin motor eléctrico y sin escena viva.
- `src/lib/circuitos/spice.ts` (MNA), `src/lib/physics/em.ts` (motor de campos v2) y `src/forja/brep/CampoReal.tsx`: se reutilizan.

## TOCA

- (nada)

## CREA

- src/forja/brep/brazoVivo.ts
- src/forja/brep/BrazoVivo.tsx
- src/forja/brep/__tests__/brazoVivo.test.ts

## BORRA

- (nada)

## PREEXISTENTE

- public/
- videos/
- scripts/
- models/
- docs/
- ordenes/
- src/forja/brep/ForgeBRepStudio.tsx
- src/forja/brep/ArcoVivo.tsx
- src/forja/brep/arcoFisica.ts
- src/forja/brep/CampoReal.tsx
- src/forja/brep/plumaSistema.ts
- src/forja/brep/PlumaCircuito.tsx
- src/forja/brep/__tests__/plumaSistema.test.ts
- src/lib/physics/

## EVIDENCIA (se declara ANTES de trabajar)

- `vitest` en iangpu (`/home/ian/forja-diag`) con estas pruebas:
  - sin fricción ni par, la energía se conserva (< 0.5 % en 10 s);
  - el par estático coincide con `jointTorques` de `brazo.ts`;
  - el motor en estado estable cumple ω = (V − I·R)/k_e;
  - el control PD llega a la posición pedida.
- `tsc --noEmit` en iangpu, sin errores nuevos en sus archivos.

## CIERRE (2026-11-05)

- **orden vs entregado:** el agente B entregó solo los 3 archivos de CREA, sin tocar el estudio. Lo que hay:
  - la dinámica de 3 ejes (base, hombro y codo) con gravedad, carga y fricción;
  - por junta, un motor DC R-L-fcem con planetaria 5:1 + cicloidal 17:1 (config B de `brazo.ts`), 85:1 en total;
  - control PID + peso, y par computado;
  - las trayectorias tomar/dejar, saludo y sostener;
  - el campo B de los inducidos y de los cables de cada motor, trazado una vez a 1 A y escalado por la corriente viva;
  - un gaussímetro arrastrable que suma todas las fuentes.
- **números** (reporte del agente, vitest en iangpu):
  - energía sin fricción en 10 s: deriva de 1.8e-8 %;
  - par estático hombro/codo: 9.7048/5.4464 N·m, contra 9.70/5.45 de `jointTorques`;
  - motor en estado estable: ω = 135.776 rad/s = (V − I·R)/k_e;
  - error final 0.03° (PID y par computado); tomar y dejar con 2.4 mm de error y 1.2° de seguimiento máximo;
  - balance de energía: 3e-6 %;
  - gaussímetro contra µ0·I/2πr: error < 1e-3.
- **evidencia:** 12/12 pruebas; `tsc` sin errores nuevos en sus archivos; integrado y visto con GPU en la orden J.
- **preguntas abiertas** (supuestos del agente):
  - los motores son de catálogo (⌀40 de 150 W y ⌀30 de 60 W a 24 V), y la planetaria 5:1 es un supuesto;
  - el campo no tiene hierro ni imán, así que afuera del motor está sobreestimado;
  - el pulso de las líneas brinca cuando la corriente cambia de signo.
