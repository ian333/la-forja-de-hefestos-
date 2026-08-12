# ORDEN: LA CAVIDAD Y EL LÍQUIDO — el molde que se VE es el molde que talla, y se cruzan por número

BASE: e7e8449

OBJETIVO: ian: *"se sigue viendo raro… está mal el molde, algo se rompió. El llenado es
sobre la CAVIDAD: el molde simplemente genera una cavidad con forma, y aquí parece que
está todo desconectado — la cavidad y el líquido."*

Medido con `moldGeom()` sobre la escena real, tenía razón LITERAL — **tres marcos
conviven en pantalla**:

```
cavidad        z 146..206     ✓ volteada (bien)
nucleo         z 164..217.5   ✗ el explode +34 lo CLAVA a través de la cavidad
pieza          z 145.5..185.5 ✓
particion      z 39.1..39.9   ✗ MARCO LOCAL VIEJO — 107 mm abajo del molde real
placa-a-ghost  z −79..−13     ✗ marco viejo, bajo cero
placa-b-ghost  z 96..118      ✗ marco viejo
colada         z 185.5..248   ✓
```

Los display-parts de la E3 (`partPlano`, `placaA`, `placaB`) se construyen con literales
del marco local (`z=39.1`, `z=−79`, `z=96`) que nunca pasaron por el mapa — **CUARTA
instancia de la familia "coordenadas absolutas que asumen la pieza en el origen"** — y el
explode del núcleo (+34) era "alejarse de la cavidad" con boca arriba y ahora es
atravesarla. Por eso el líquido levita entre cajas de otro mundo: la cota `partición
146 ✓` apunta a un plano dibujado en z=39.

## LO QUE DICE LA FÍSICA / LA INDUSTRIA (la vuelta que pidió ian)
- **El dominio del flujo ES la cavidad** — el hueco que el acero deja. En
  Moldflow/Moldex3D el dominio nace del MODELO DE LA PIEZA (escalado por contracción) y
  el acero entra como condición de frontera térmica/estructural; la coherencia
  pieza↔acero la garantiza el proceso de diseño (el acero se TALLA de la pieza). Nuestro
  campo por predicado analítico es esa misma práctica — pero la coherencia hay que
  **medirla**, no asumirla:
- **EL CRUCE QUE FALTABA**: `splitMold` ya contabiliza el hueco del acero
  (`vols.piezaEscalada`, el que cierra Σ = bloque). El volumen de PIEZA del campo de
  llenado debe COINCIDIR con ese hueco medido del acero. Si el molde se rompe, el número
  delata — cavidad y líquido conectados por MEDICIÓN, no por fe.
- **La vista**: la industria enseña el llenado SOBRE la pieza con el molde fuera o en
  SECCIÓN; lo que jamás enseña es un molde en otro marco. Con los display-parts
  corregidos, la cavidad ABRAZA al líquido (fantasma), que es la relación que ian pide ver.

## LO QUE SE CONSTRUYE
1. `partPlano` / `placaA` / `placaB` en el marco REAL: partición en `zPartBase`, placa A
   (66, aloja la cavidad) ARRIBA de la partición, placa B (22, aloja el respaldo) ABAJO —
   las cotas del stack, no literales.
2. El explode del núcleo cambia de signo (−34: el núcleo ABRE hacia B, alejándose), y el
   lift de las cotas del macho con él.
3. Los flags del RAYO se voltean con el molde: la CAVIDAD ahora sube (+Z, lado A) y el
   NÚCLEO baja (−Z). El gate local no cambia (prueba en marco local, teorema invariante).
4. **GATE nuevo**: `vol(pieza del campo) ≈ vols.piezaEscalada del acero` (±5 %) — el
   cruce cavidad↔líquido.

## YA-EXISTE
- `colocacionEnLaBase` (el mapa) · `plateStackZ` (las cotas de placas) ·
  `splitMold.vols.piezaEscalada` (el hueco del acero, ya medido) · `moldGeom()` (el
  inventario que destapó esto).

## TOCA
- src/forja/brep/useMoldStudio.ts
- scripts/ciclo-dado-test.cjs

## CREA
- (nada)

## BORRA
- (nada)

## PREEXISTENTE (otra sesión en paralelo — NO es mío, no entra a mis commits)
- index.html
- public/comando/
- public/atrio/
- public/precomputed/
- scripts/comando-catalogo.cjs
- scripts/reels-web.py
- scripts/guiones/
- scripts/video-subs.py
- scripts/video.sh
- scripts/voz-check.py
- scripts/precompute-atom-orbitals.py
- scripts/verificar-orbitales.py
- scripts/radios-orbitales.py
- videos/
- src/cinematic/
- src/lib/chem/

## EVIDENCIA (declarada antes de trabajar)
- `moldGeom()` DESPUÉS del arreglo: particion en z≈146 · placa A 146..212 · placa B
  124..146 · nucleo SIN traslape con cavidad (explode −34) — UN solo marco.
- el RAYO sigue `SALE / atrapadas 0` con los flags volteados, y su control negativo
  sigue reprobando.
- GATE: `vol pieza del campo ≈ piezaEscalada del acero` (±5 %) — el cruce
  cavidad↔líquido, en números.
- capturas con OJOS: la cavidad fantasma ABRAZA al líquido; nada levita en otro marco.
- video 4K re-renderizado si el visual cambia lo entregado — juzgado y a AMBAS PCs.
- `node scripts/ciclo-dado-test.cjs` 0 fallan · `node scripts/orden-gate.cjs` VERDE.

## CIERRE (2026-08-12)

- **gate 82 pasan · 0 fallan** · orden-gate VERDE · VIDEO 4K APROBADO 8/8 →
  `dado-cavidad-4k.mp4`, entregado a AMBAS PCs + `/mnt/e/forja-videos`.

- **`moldGeom()` DESPUÉS, un solo marco** (antes: tres marcos conviviendo):
  particion z 145.6..146.4 (EN la partición real) · placa A 146..212 (abraza la cavidad)
  · placa B 124..146 · nucleo abierto hacia B sin roce (explode −40; 183.5−40 < 146) ·
  cavidad 146..206 · pieza 145.5..185.5 · colada 185.5..248.

- **EL CRUCE CAVIDAD↔LÍQUIDO, medido**: volumen de pieza del CAMPO **14.10 cc** vs hueco
  del ACERO (`splitMold.vols.piezaEscalada`) **14.13 cc** — 0.2 % de diferencia. El
  molde genera la cavidad; el líquido la llena; y ahora un NÚMERO los ata: si el acero
  se rompe, el check delata.

- **el RAYO volteó con el molde**: cavidad sube (+Z, lado A) · núcleo baja (−Z) — sigue
  `SALE, 0 atrapadas` y el control del draft invertido sigue reprobando.

- **DOS bugs míos cazados en esta orden**:
  1. los display-parts con literales del marco local (z=39.1 / −79 / 96) — la CUARTA
     instancia de la familia de coordenadas absolutas, y la causa literal del "parece
     todo desconectado";
  2. `col` usada fuera de su scope en el handler (vive dentro de construirAceroE3) —
     ReferenceError silencioso dentro del try: la E3 moría sin botón de E4. La clase
     del bug del onE4. La colocación viaja en `acero.colocacion`.

- **la respuesta de industria/física** (lo que pidió ian): el dominio del flujo ES la
  cavidad; en Moldflow/Moldex3D nace del MODELO de la pieza (escalado) y el acero entra
  como frontera térmica — la coherencia pieza↔acero la garantiza el proceso (el acero se
  talla DE la pieza) y aquí, además, se MIDE (el cruce de 0.2 %). La vista de industria
  enseña el llenado sobre la pieza con el molde fantasma o en sección — nunca un molde
  en otro marco.
