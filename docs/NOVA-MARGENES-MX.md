# NOVA — Dónde está el margen (comparativa MX vs LCSC)

> Investigación 2026-06-10 (109 agentes, 26 fuentes, verificación adversarial 3 votos;
> precios verificados EN VIVO contra páginas de producto, varios vía headless Chrome
> por el Cloudflare de uelectronics). 21 claims confirmados, 4 refutados y descartados.

## TL;DR — el margen vive en 3 lugares

1. **KITS (el más claro y verificado):** UNIT vende el Kit UNO a **$249** (y $182.26 a 25 pzs
   mayoreo) — y un revendedor (Aragón) **revende el mismo kit UNIT a $650-900 MXN**. El canal
   de reventa multiplica **2.6-3.6×**. Empaquetar componentes baratos + prácticas ES el negocio.
   Y NOVA empaqueta mejor que nadie: el kit + el simulador donde YA lo armaste.
2. **ICs "jellybean" (markup porcentual brutal):** NE555 cuesta **~$0.78 MXN** en LCSC
   (clon SOP-8; el DIP TI ~$0.9-1.8 MXN); AMS1117-3.3 **~$1.8-3.6 MXN**. El precio MX típico de
   $8-15 por estas piezas implica **5-15× sobre origen**. Aun pagando importación queda espacio.
3. **Sensores premium caros + escasos:** DHT22 a **$140 MXN con SOLO 3 pzs** en Sandorobotics
   (mercado disperso: $56 en Tecneu hasta $200-220 en Aragón). Precio disperso + stock bajo =
   la señal clásica de dónde entrar.

## Dónde NO pelear por precio (commodity ya eficiente)

- **DHT11**: $25 MXN (≈1.8× LCSC antes de impuestos) — sin espacio.
- **HC-SR04**: AG a **$29 MXN** (hasta $25.33 a 50+), 59 pzs en línea + 900 en camino;
  330ohms a $40. Aquí se compite por **disponibilidad/servicio/educación**, no por precio.
- ESP32: WROOM-32 bare ~$76 MXN qty1 en LCSC ($52-55 a 100+); el precio de calle del DevKit
  está disperso ($290 en tiendadeelectronica = extremo alto; el punto medio quedó sin verificar).

## La estructura de costo de importación (el dato que cambia las cuentas)

- IVA **16%** sobre importación, arancel sobre **base CIF** (precio + flete + seguro).
- ⚠️ **Desde ago-2025 México aplica ~33.5% de tarifa global a paquetería courier desde China**
  (se eliminó el de minimis para países sin TLC). → importar por courier cuesta ~**1.33×**
  el precio LCSC+flete; el markup real es 25-35% menor que el aparente.
- **Implicación estratégica:** la vía courier es para probar; el modelo de LOTE (pre-orden
  agregada + importación formal con pedimento) es donde el costo aterrizado baja de verdad.
  El "lote" que ya definimos no es solo logística — es la ventaja fiscal.

## Drivers de motor — matiz importante

- El **L293D original ST cuesta $75 MXN ya en LCSC** (29 pzs de stock en China) — mal candidato.
- El margen está en el **MÓDULO genérico L298N** (~$50-90 MXN de calle), no en el IC de marca.
  (El precio del módulo estándar en los 4 grandes quedó sin verificar — pendiente.)

## Honestidad de cobertura (lo que NO se verificó)

- **Steren: cero precios verificados** (el más grande en tiendas físicas — hueco de datos).
- Sin precio MX confirmado: Arduino Uno/Nano, BC547, 2N2222, IRF540N/IRFZ44N, LM2596, 7805,
  LM358/393, ULN2003, PIR, relés, protoboard, jumpers, resistencias, LEDs.
- **2 precios REFUTADOS (no usar):** "UNIT ESP32 a $147" y "AG Uno R3 original a $240".
- Falta: costeo línea-por-línea del BOM del kit UNIT ($249) contra LCSC, y costo aterrizado
  courier vs pedimento por volumen.

## Las jugadas (cruzando con la estrategia Nobel y la escalera)

1. **Kit + simulador = el producto.** El margen del kit (2.6-3.6× en reventa) + nuestro
   diferenciador (lo armaste ANTES en el banco) + nudges (carrito por default). Primer SKU
   estrella: nuestro kit de la familia 555 / luz nocturna, costeado desde LCSC.
2. **Jellybeans como gancho de margen**: 555, AMS1117, transistores — margen alto incluso
   con la tarifa courier; en lote formal, mejor.
3. **DHT22-pattern**: catálogo de "sensores premium" caros+escasos en MX (DHT22 confirmado;
   verificar PIR, BME280, etc. con el mismo patrón).
4. **No pelear DHT11/HC-SR04 por precio** — venderlos al precio de mercado CON la lección
   (capturas el margen normal sin guerra de centavos).
5. **El lote/pre-orden es ventaja fiscal**, no solo logística: importación formal agregada
   esquiva la tarifa courier del 33.5%.
6. **La escalera de máquinas** (plotter→CNC→PLC→brazo) vive ARRIBA de esta tabla: el margen
   de los kits de máquina será aún mayor (más valor agregado, cero competencia local que enseñe).

## Fuentes clave (verificadas 2026-06-10)
- uelectronics.com (kits UNO/ESP32 + tablas de volumen, vía headless/Wayback)
- aragonelectronica.com (reventa kit $650-900), sandorobotics.com (DHT22/DHT11/L298N 4ch)
- agelectronica.com (HC-SR04 $29, tiers), 330ohms.com (HC-SR04 $40)
- lcsc.com en vivo: C5125085 (NE555), C6186 (AMS1117), C82899 (WROOM-32), L293D ST
- trade.gov (IVA/CIF, 2026-02-09) + Ley Aduanera Arts. 64-65 + tarifa courier 2025
