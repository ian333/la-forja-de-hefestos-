# ORDEN: LA CARRERA CABE — la caja expulsora se dimensiona por la pieza (hoy es un literal de 66 mm y ninguna pieza de más de 23 mm puede expulsarse)

ESTADO: proximo
PRIORIDAD: 1

BASE: 777b020

OBJETIVO: que el molde de TU pieza pueda EXPULSARLA. `packageToAssemblySpec` (mold-plano-set.ts) clava
`bottomClamp: 36, ejectorHousing: 66, topClamp: 36` para cualquier pieza. Con la expulsora (28 % de la caja = 18) y la
retenedora (20 % = 13) adentro y 4 mm de descanso quedan **31 mm** libres; la carcasa pide H + 8 = **41.3**. En el video 35
la retenedora entra 10 mm en la placa de soporte cada ciclo. Le debe al camino de la carcasa el check «la carrera cabe»
del paso 6 (ROJO desde 2026-09-21, a propósito).

## LO QUE SE MIDIÓ (2026-09-21 · orden el-portamoldes-de-tu-pieza)
- Carcasa 1594C: libre 31.0 mm · pedida 41.3 mm. El aviso ya sale en la tira («⚠ la carrera no cabe: 31 < 41.3 mm») y en
  la ficha de la estación 8; `data-carrera-libre` / `data-carrera-pedida` en `molde-de-la-pieza`.
- La regla que sale de la propia aritmética del stack: libre = EH − 4 − 0.28·EH − 0.20·EH ⇒ EH ≥ (carrera + 4 + holgura)/0.52.
  Carcasa: (41.3 + 9)/0.52 = 96.7 → la serie comercial que YA vive en el código (`COMMERCIAL_PLATE_THK`, platesizing.ts) da
  el siguiente escalón. NO inventar catálogo: usar esa serie y declarar la holgura con su cita del libro.
- **EL CUBO FIRMADO tiene el mismo defecto** (H 40 → carrera 48 > 31). Mover la caja mueve TODA la pila (la partición deja
  de ser 146 en el cubo y 160 en la carcasa) y con ella los números literales de `ciclo-dado-test` (266 checks) y del
  acta R92. Por eso es su propia orden y pide el simón de ian: ¿el cubo se re-firma con su caja correcta, o la regla
  aplica solo cuando la carrera no cabe (y el cubo tampoco cabe)?

## EJERCICIOS
- [ ] la regla de la caja expulsora con su cita (Kazmer cap 11/12 · Fig 1.6) y la serie comercial del código.
- [ ] `packageToAssemblySpec` la aplica; la cotización (masa de acero) y las 17 láminas se mueven con ella: UNA verdad.
- [ ] el cubo: decisión de ian; si se re-firma, los literales del test se actualizan con su acta.
- [ ] camino: el check «la carrera cabe» en verde; las 20 piezas como juez (ninguna con carrera > caja).

## TOCA
- (se declara al abrir)

## CREA
- (nada)

## EVIDENCIA (se declara ANTES de trabajar)
- `carreraLibre ≥ carreraPedida` en las 20 piezas; en el paseo la retenedora se detiene ANTES del soporte.
