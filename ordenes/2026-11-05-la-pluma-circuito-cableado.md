# ORDEN I: La Pluma de verdad. Circuito vivo, cableado real, placas y temperatura

ESTADO: hoy. ian presente:

> «simón el circuito en La Pluma, JUSTO. ARMA LOS CABLES DEL SISTEMA, PARA QUE NO HAYA ERRORES… CUIDA TEMPERATURA, CUIDA TAMAÑO, REDUCE, ACOMODA LA PLACA DE COMPONENTES, PON UNA PCB DE CONTROL… la OMNI… quiero más realismo, una vista interesante… falta el cableado real… hay basura en la UI»

BASE: d675896

OBJETIVO: el sistema eléctrico de La Pluma como UNA sola fuente de verdad, en datos, de la que sale todo. Los números vienen de los agentes 05, 02, 04 y 10 (`docs/investigacion-arco/11-SINTESIS.md`): buck a 100 kHz, choque de 15 µH, shunt + INA240, sin Q3, D2 que limita la salida, termostato NC y puente H del alimentador.

1. **El circuito, simulado VIVO en el navegador** con el MNA que ya existe (`src/lib/circuitos/spice.ts`):
   - IRFB4227 con su compuerta, D1, choque, bus y capacitores;
   - la LRS con su límite de 1200 W;
   - el cable y el arco como carga viva.

   El control PI del firmware decide la compuerta en cada periodo. La corriente REAL que sale del circuito es la que mueve la gota (`arcoFisica.ts`), y el voltaje del arco regresa al circuito: lazo cerrado.
2. **El diagrama:** el esquemático en vivo (SVG) con voltajes en los nodos, corriente que corre por los cables, la compuerta y un osciloscopio.
3. **Temperatura:** las pérdidas reales (conducción, conmutación, diodo, choque, shunt) alimentan una red térmica (unión → disipador → aire, con el ventilador). Se pintan las temperaturas y se juzga cada pieza contra su límite.
4. **El cableado real, en datos:**
   - conectores con pines con nombre, y cables con calibre, color por función y largo medido de la ruta 3D;
   - el revisor que caza errores: pin sin conectar, red con dos fuentes, calibre corto para su corriente, caída de voltaje, polaridad DCEN, lazo de potencia grande;
   - la lista de corte.
5. **Las placas acomodadas y el banco reducido:**
   - una placa de potencia con el lazo Q1–D1–Cf apretado;
   - una PCB de control con las convenciones de NOVA OMNI (RP2350, INA, buck);
   - la base más chica;
   - los cables reales en 3D saliendo de los datos.
6. **La basura de la UI:** el panel DOCUMENTO vacío y HISTORIA encimada sobre CARAS en el banco.

## YA-EXISTE (prueba de ausencia)

- `spice.ts`: MNA con R, L, C, fuente V/I, diodo Shockley, MOSFET de datasheet y `transientStep`. Hoy solo lo usan los circuitos de juguete del laboratorio. No hay modelo de La Pluma completa ni de su cableado.
- `ArcoVivo.tsx` y `arcoFisica.ts`: la gota con una corriente IDEAL (sin el circuito, sin el límite de la LRS).
- `bancoArcoDoc` en `ForgeBRepStudio.tsx`: la electrónica como piezas sueltas y cajas marcador, sin pines ni cables reales.
- La placa NOVA OMNI (`src/physics/modules/electronica/NovaLab.tsx`), cuyas convenciones (RP2350, INA226, TPS54xx) se reutilizan. El TPS5430 aguanta solo 36 V, así que a 48 V va un TPS54360.

## TOCA

- src/forja/brep/ForgeBRepStudio.tsx

## CREA

- src/forja/brep/ArcoVivo.tsx
- src/forja/brep/arcoFisica.ts
- src/forja/brep/plumaSistema.ts
- src/forja/brep/PlumaCircuito.tsx
- src/forja/brep/__tests__/plumaSistema.test.ts

## BORRA

- (nada)

## PREEXISTENTE

- public/
- videos/
- scripts/
- models/
- docs/
- ordenes/
- src/lib/physics/
- src/forja/brep/CampoReal.tsx
- src/forja/brep/brazoVivo.ts
- src/forja/brep/BrazoVivo.tsx
- src/forja/brep/__tests__/brazoVivo.test.ts

## EVIDENCIA (se declara ANTES de trabajar)

- **`vitest` en iangpu:**
  - el buck en estado estable da ⟨V_sw⟩ ≈ D·V_bus;
  - el PI sigue la referencia de 40 A con rizo ≈ V·D(1−D)/(L·f);
  - con el hueco largo, el límite de 1200 W de la LRS se nota;
  - el revisor del cableado caza errores sembrados (calibre corto, pin suelto, polaridad invertida, dos fuentes en una red) y da 0 errores en el arnés real;
  - la red térmica en estado estable da T = Ta + P·Σθ.
- **Costo:** pasos de MNA por cuadro y FPS con la simulación prendida, en iangpu con GPU.
- **Capturas con GPU real:** el banco con las placas y los cables reales, el esquemático vivo, el mapa de temperatura y la lista de corte.
- `tsc` sin errores nuevos.
- `orden-gate` en VERDE.
- **Censo** sin lienzos nuevos.
- **Despliegue** y bundle publicado verificado.

## CIERRE (2026-11-05)

- **orden vs entregado:** los 6 puntos, más 2 que salieron al ver las capturas.
  1. **Circuito vivo:** el MNA de `spice.ts` a 100 kHz con 12 nodos, el PI del firmware por periodo (mide la corriente PROMEDIO del periodo y arrastra el resto del PWM como un timer de 1500 niveles), y lazo cerrado con la gota. La LRS se modela como la hoja de datos: arriba de su tope (I_LRS_MAX 30 A, supuesto 120 % de 25 A) **limita corriente y el bus se cae**, y se apaga solo si la sobrecarga dura 5 s. El primer modelo se «apagaba» en el primer pico de 20 µs: era un error mío, se quitó.
  2. **Esquemático vivo** (SVG) con su osciloscopio de 40 µs. Las pestañas son ⚡ circuito, 🔌 cables, 📍 pines RP2350 y 🌡 límites.
  3. **Térmica:** red RC que corre «como si el arco no parara» más el estado estable, y se juzga cada pieza contra su límite. Hay calor en el 3D.
  4. **Arnés:** 23 cables C01–C23 con ruta 3D, calibre, color y etiqueta. El revisor tiene 9 reglas (E1–E9) y saca la lista de corte.
  5. **Placas y base:** placa de potencia de 150×92, PCB de control negra de 110×75 con RP2350B, TPS54360, TPS62933 y DRV8874, base de 380×280×100, y **NTC en el disipador y en el choque** (GP45/GP46).
  6. **UI:**
     - DOCUMENTO colapsado ya no se estira;
     - HISTORIA ya no se encima;
     - la leyenda de piezas pasó al riel;
     - **el riel empezaba debajo de la cinta**: la cinta mide 44+89 px y el riel arrancaba en 106, así que tapaba el primer panel; ahora arranca en 138;
     - Parámetros y Análisis abren colapsados en el banco;
     - el panel del circuito ya no pisa el chip de atajos.
  - **Extra 1, el mapa de pines del RP2350B** (`PINES`, `revisarPines`, P1–P8), revisado contra el SDK: las tablas de PWM y de UART coinciden byte a byte con `rp2350b_interface_pins.json`, y ADC_BASE_PIN 40 viene de `platform_defs.h`. El RP2350B da **8 ADC** (GP40–47), contra 3 libres del Pico 2: eso devuelve los NTC.
  - **Extra 2, RAYOS X y una vista de abrir:**
    - la cubierta y las paredes se vuelven fantasma (`RefPart.rayos`), con botón en la leyenda;
    - el banco abre con `ArcoDoc.vista`: arriba del panel del circuito, con la burbuja del DETALLE A a la derecha.
- **números:**
  - **MNA:** 37 µs/paso; I = 39.99 A con un arco de 21 V; rizo 7.07 A pp, contra 7.91 de la fórmula.
  - **Bus:** 20 A rms; el electrolítico se lleva 13.0 A (6.5 A por capacitor contra ~5 A nominales: **límite**) y la película 5.87 A.
  - **LRS:**
    - arco de 21 V: 70 % (884 W);
    - arco de 31 V: 107 % (1288 W);
    - arco de 46 V: el buck de 48 V no lo sostiene (0.6 A con D = 0.85);
    - 70 A × 30 V: limita a 27.8 A, el bus cae a 35.5 V, la salida baja a 38.1 A y **no se apaga**.
  - **Térmica:** Q1 12.9 W → 62 °C, D1 14.7 W → 71 °C, choque 17.1 W → 81 °C, disipador 49 °C.
  - **Pines:** 22 GPIO, 7/8 ADC; compuerta GP0 en el slice 0A a 100 kHz = 1500 niveles; motor GP2 en el slice 1A a 20 kHz; ventilador GP6 en el slice 3A a 25 kHz.
  - **Cableado:** 23 cables, 0 errores y 0 avisos.
  - **Banco:** 223 piezas, 295,354 triángulos, abre en 2.5–3.7 s, **60.2 fps** con circuito + gota + campos (en producción).
- **evidencia:**
  - `vitest` en iangpu: 17/17 de plumaSistema, con estos errores sembrados que el revisor caza:
    - cableado: calibre corto, pin suelto, polaridad, dos fuentes y fase sin PARO;
    - pines: el motor en el slice de la compuerta, un ADC del Pico 2, un pin repetido, una UART mal puesta y un hilo del plano repetido;
    - la LRS limitando.
  - `tsc`: 58 errores, igual que la base.
  - El gate da VERDE y el censo sigue sin lienzos nuevos.
  - Desplegado en `forja-brep-CODUKV9k.js`, y `curl --compressed` encuentra «pines RP2350», «rayos X», «LIMITA 30 A» y `rp2350b_interface_pins`.
  - Capturas con GPU (d3d12, RTX 4070 Ti) de la copia aislada y de producción.
  - **Lección:** sin `GALLIUM_DRIVER=d3d12` Chrome cae a SwiftShader y da 0.7 fps; no era la simulación.
- **preguntas abiertas:**
  - el orden de los bornes de la LRS y la lógica de su RC (están SUPUESTOS);
  - el ESR real de los electrolíticos: con el rizo de 6.5 A cada uno, ¿3 capacitores o uno de bajo ESR?;
  - si hay contacto de 220 V;
  - las fotos y medidas del alimentador, y el voltaje de su motor.
