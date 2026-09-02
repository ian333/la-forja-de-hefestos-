# LISTA DE MATERIAL — Instalación inyectora Tianjian PL1200/370 + impresora de metal

> Fecha: 2026-08-28 · Operador: ian · Proyecto: La Forja
> **Todo precio es referencia verificada en la fuente citada. Confirmar al comprar.**

---

## 🚨 ANTES DE COMPRAR NADA: 3 datos de la PLACA de la máquina

La placa de datos (etiqueta metálica en el gabinete eléctrico) manda sobre cualquier catálogo:

| Dato | Por qué es crítico |
|---|---|
| **VOLTAJE (V) y FASES** | Decide TODO el calibre. 380V de fábrica china vs 220V/440V del taller |
| **FRECUENCIA (Hz)** | Si es 50 Hz y la conectas a 60 Hz, la bomba gira 20% más rápido y **sobrecarga el motor** |
| **CORRIENTE NOMINAL (A)** | El número exacto para el cálculo. Todo lo de abajo es cálculo desde catálogo |

**Foto de la placa antes de comprar cobre.** Un error de voltaje aquí cuesta $20,000+ en cable equivocado.

---

## ⚠️ CORRECCIÓN MAYOR: la máquina es de 120 TONELADAS, no de 37

En la nomenclatura Haitian/Tianjian **el número del modelo ES la fuerza de cierre en kN**:

```
PL1200 / 370
  │       └── unidad de inyección (~370 cm³ de referencia)
  └────────── 1200 kN = 120 TONELADAS de cierre
```

Confirmado en 3 fuentes: catálogo oficial Tianjian Pluto, tabla Haitian Mars III (MA1200 = 1200 kN),
y una unidad física de 2016 vendida en Brasil. **La serie PL empieza en PL860 (86 t) — no existe un
Tianjian de 37 t.** Dimensionar para 37 t habría dejado la instalación corta por 3× = incendio.

### Especificaciones confirmadas (catálogo oficial Pluto)

| Parámetro | Valor |
|---|---|
| Fuerza de cierre | **1,200 kN = 120 ton** |
| **Motor de bomba hidráulica** | **13 kW** (catálogo 2015 dice 11 kW; unidad real 2016 dice 13 — usar 13) |
| **Resistencias de barril** | **9.75 kW** |
| **TOTAL INSTALADO** | **22.75 kW** |
| Voltaje de fábrica | 380 V / 3F / 50 Hz (versión 460V/60Hz existe para América) |
| Husillo (A/B/C) | 36 / 40 / 45 mm |
| Peso de inyección PS | 157 / 194 / 246 g |
| Presión de inyección | 231 / 187 / 148 MPa |
| Dimensiones (L×A×H) | **4.39 × 1.15 × 1.98 m** |
| **Peso de máquina** | **4.2 toneladas** |
| Tanque de aceite | 190 L |
| Agua de enfriamiento | **~22 L/min** (aceite) + 15-40 L/min (molde) → torre/chiller **40-60 L/min** |

---

## ⚡ CÁLCULO ELÉCTRICO (NOM-001-SEDE: 125% del motor mayor + 100% del resto)

| Voltaje | I motor | I resist. | **I total** | I ampacidad | **CABLE** | **ITM 3P** | Tierra |
|---|---|---|---|---|---|---|---|
| **220 V** | 44.6 A | 25.6 A | **70.2 A** | 81.3 A | **3 AWG** | **90 A** | 8 AWG |
| **380 V** | 25.8 A | 14.8 A | **40.6 A** | 47.1 A | **6 AWG** | **50 A** | 10 AWG |
| **440 V** | 22.3 A | 12.8 A | **35.1 A** | 40.7 A | **8 AWG** | **50 A** | 10 AWG |
| 460 V | 21.3 A | 12.2 A | 33.6 A | 38.9 A | 8 AWG | 40 A | 10 AWG |

*Corrección por temperatura de taller a 40 °C ya aplicada (factor 0.88, tabla 310-15).*

#### ⚠ TODO ESTO ES RMS A PLENA CARGA, NO PICOS (pregunta de ian, 2026-08-31)

Las corrientes de la tabla son **RMS de régimen permanente**: `I = P/(√3·V·fp·η)` con fp 0.85
y η 0.90 para el motor, y fp 1 para las resistencias. **El 1.25 NO es un factor de pico** —
es el margen que el código exige sobre el motor MAYOR por ser carga continua.

**El arranque no dimensiona el cable.** Un arranque directo del motor de 13 kW jala
**≈270-310 A a 220 V (6-7× la nominal) durante 1-3 s**. El cobre no se calienta en 3 segundos
(inercia térmica), así que ese pico NO entra al calibre. Lo que sí decide:
- **la curva del ITM** — necesita curva **C o D**, no B, o dispara en cada arranque;
- **la protección contra SOBRECARGA** vive en el relevador térmico del arrancador, no en el ITM;
- **la caída de tensión en el arranque** (y el transformador, si hay).

#### 🔧 EL 3 AWG: por qué salió, y por qué NO lo vas a comprar

El 3 AWG salió de usar la columna de **75 °C** (cable THW). Recalculado (se necesitan
**81.3 A** tras el factor 0.88):

| Calibre | THW 75 °C | THHN/THWN-2 90 °C † |
|---|---|---|
| 6 AWG | 57.2 A ❌ | 65.0 A ❌ |
| **4 AWG** | 74.8 A ❌ | **83.6 A ✅** |
| 3 AWG | 88.0 A ✅ | 96.8 A ✅ |
| **2 AWG** | **101.2 A ✅** | 114.4 A ✅ |

† con cable de 90 °C se corrige la columna de 90 y el resultado se **topa** en la de 75,
porque las terminales del ITM y del arrancador son de 75 °C (110-14(c)).

**Conclusión práctica:** el **3 AWG es un calibre impar** — en México se surten 8, 6, 4, 2,
1/0; el 3 y el 5 casi nadie los tiene en piso. Dos salidas legales:
- **4 AWG THHN/THWN-2 (90 °C)** — pasa con 83.6 A contra 81.3 requeridos. Margen de **2.8 %**:
  es legal pero delgado, y obliga a que TODO el cable sea de 90 °C (no THW).
- **2 AWG** — sobra (101 A) y se consigue en cualquier lado. **Es lo que se compra.** Cuesta
  más que el 3, así que a 220 V el cobre sube todavía más de los $16,998.

Y por eso mismo: **a 440 V esto se acaba** — 8 AWG, calibre común, ~1/3 del costo, sin
discusión de columnas ni de disponibilidad.

### 💰 EL VOLTAJE DECIDE EL PRESUPUESTO (cobre, corrida de 30 m, 4 hilos)

| Voltaje | Calibre | $/metro | **Costo de la corrida** |
|---|---|---|---|
| 220 V | 3 AWG | ~$142 | **$16,998** |
| 380 V | 6 AWG | ~$73 | **$8,767** |
| **440 V** | **8 AWG** | **~$47** | **$5,647** |

**A 440 V el cobre cuesta la tercera parte que a 220 V.** Si el taller tiene 440, úsalo.

### Caída de tensión (máx. 3% recomendado) — ambos escenarios pasan holgados

| Distancia | 220 V con 3 AWG | 440 V con 8 AWG |
|---|---|---|
| 15 m | 0.53% ✅ | 0.43% ✅ |
| 30 m | 1.06% ✅ | 0.85% ✅ |
| 50 m | 1.78% ✅ | 1.42% ✅ |
| 80 m | 2.85% ✅ | 2.27% ✅ |

### Tubería (conduit), 3 fases + tierra, relleno 40%

| Escenario | Tubo |
|---|---|
| 220 V (4 hilos de 3 AWG) | **1-1/4" (35 mm)** |
| 440 V (4 hilos de 8 AWG) | **3/4" (21 mm)** |

### 🔴 Si la máquina es 380V/50Hz y el taller tiene 220V

- Transformador **ELEVADOR 220→380 V de 37.5 kVA** (demanda 24.2 kVA + 25% de margen)
- **Y el problema de 50→60 Hz**: la bomba gira 20% más rápido → demanda 15.6 kW en vez de 13
  → peor caso a 220 V: **79 A, cable 2 AWG, ITM 100 A**. Solución limpia: **variador (VFD)**.

---

## 📋 LISTA DE COMPRA — ELÉCTRICO (inyectora)

Marcado para el escenario **440 V** (el recomendado). Si resulta 220 V: **2 AWG** (el 3 AWG no se surte) / ITM 90 A curva C / tubo 1-1/4".

| # | Material | Cant. | Precio ref. | Dónde |
|---|---|---|---|---|
| 1 | Cable THW-LS **8 AWG** (negro, rojo, azul) 600 V | 3 × 40 m | ~$47/m | [ML: cable thw 8 awg](https://listado.mercadolibre.com.mx/cable-thw-8-awg) · [Elektron](https://www.elektron.com.mx) |
| 2 | Cable THW **10 AWG verde** (tierra) | 40 m | ~$30/m | ídem |
| 3 | **Interruptor termomagnético 3P 50 A** (Square D / Siemens / ABB) | 1 | $250-600 | [ML: itm 3 polos 50a](https://listado.mercadolibre.com.mx/interruptor-termomagnetico-3-polos-50-amperes) |
| 4 | **Caja/centro de carga 4 líneas** (3F + N) o interruptor de seguridad con fusibles | 1 | $800-2,500 | [ML: interruptor de seguridad 3 fases](https://listado.mercadolibre.com.mx/interruptor-de-seguridad-3-fases) |
| 5 | Tubo **conduit galvanizado pared gruesa 3/4"** (tramos 3 m) | 14 tramos | $180-260 c/u | [ML: tubo conduit 3/4](https://listado.mercadolibre.com.mx/tubo-conduit-galvanizado-pared-gruesa-3-4) |
| 6 | Conectores/coples conduit 3/4" | 20 pzas | $15-30 c/u | ídem |
| 7 | **Zapatas de compresión** para 8 AWG | 8 pzas | $25-45 c/u | [ML: zapata compresion 8 awg](https://listado.mercadolibre.com.mx/zapata-de-compresion-8-awg) |
| 8 | Varilla de tierra copperweld 5/8" × 3 m + conector | 1 | $450-700 | [ML: varilla copperweld](https://listado.mercadolibre.com.mx/varilla-copperweld-5-8-3-metros) |
| 9 | 🚨 **Relevador de falta de fase / protector trifásico** ← LA ALERTA | 1 | $600-1,800 | [ML: relevador falta de fase](https://listado.mercadolibre.com.mx/relevador-falta-de-fase-trifasico) |
| 10 | Caja de registro/condulets, abrazaderas, tornillería | lote | ~$800 | ferretería |

### 🚨 Sobre "la alerta" (punto 9) — es lo más importante de esta lista

Un **relevador de falta de fase** (o protector de voltaje trifásico) desconecta la máquina si:
falta una fase, se invierte la secuencia, o el voltaje sale de rango.

**Sin él, una fase caída hace que el motor de 13 kW arranque en 2 fases → se quema en minutos.**
Cuesta $600-1,800. Reponer el motor cuesta $40,000+. Es el seguro más barato de la instalación.

---

## 🏗️ PISO — reparar, nivelar y pintar

### La física primero

La máquina son **4.2 toneladas sobre ~6 pies de apoyo = 700 kg por pie.**

| Apoyo | Presión |
|---|---|
| Pie de 10×10 cm | 0.69 MPa (7.0 kg/cm²) |
| **Pie sobre placa de 20×20 cm** | **0.17 MPa (1.7 kg/cm²)** |

Un concreto f'c=200 resiste ~20 MPa: **no se aplasta ni de lejos**. El riesgo real es
**PUNZONAMIENTO** de una losa delgada (<10 cm) o agrietada — por eso se reparan las grietas
ANTES y se ponen **placas de acero repartidoras** bajo cada pie.

### ⚠️ El orden correcto (equivocarlo = tirar el dinero)

1. **Picar y limpiar** cada bache/socavón hasta concreto sano
2. **Mortero de reparación** en los huecos (NO autonivelante — ese es para planitud, máx. 25 mm, y necesita base sana)
3. **Autonivelante** solo si falta planitud general
4. **Primario/sellador** epóxico
5. **Epóxico 2 manos**

### Material por área tratada

| Área | Reparación (sacos 25 kg) | Autonivelante (sacos 20 kg) | Epóxico 2 manos |
|---|---|---|---|
| 12 m² | 2 | 3 | 4.0 L = 1 cubeta 19 L |
| **20 m²** | **2** | **5** | **6.7 L = 1 cubeta** |
| 30 m² | 3 | 8 | 10.0 L = 1 cubeta |
| 50 m² | 5 | 13 | 16.7 L = 1 cubeta |

| # | Material | Precio ref. verificado | Dónde |
|---|---|---|---|
| 11 | **Mortero nivelador Cemix 25 kg** (reparación) | **$454** | [Sikamart](https://sikamart.com.mx/producto/mortero-nivelador-cemix-25kg/) |
| 12 | **Autonivelante Cemix 20 kg** | **$551-877** | [Gilsa $551](https://www.gilsa.com/autonivelante-cemix-20kg.html) · [Sikamart $877](https://sikamart.com.mx/producto/mortero-autonivelante-cemix-20kg/) |
| 13 | Alternativa: **Sika Level-125** 22.7 kg (rinde 3.9 m² @ 3.2 mm) | ~$700 | [ML: sika level](https://listado.mercadolibre.com.mx/mortero-autonivelante-sika) |
| 14 | **Pintura epóxica piso industrial** cubeta 19 L (Comex Pimex / Sherwin) | $2,500-4,500 | [ML: pintura epoxica piso](https://listado.mercadolibre.com.mx/pintura-epoxica-para-piso-industrial) |
| 15 | Primario epóxico / sellador | 1 cubeta | $1,800-3,000 | ídem |
| 16 | **Placas de acero 20×20 cm × 1/2"** bajo cada pie | 6 pzas | ~$250 c/u | herrería local |
| 17 | Disco de corte concreto, cepillo de alambre, llana, rodillo epóxico | lote | ~$1,200 | ferretería |

---

## 🔩 IMPRESORA DE METAL (LA FUENTE) — pedido paralelo

### AG Electrónica — [agelectronica.com](https://agelectronica.com)

| # | Parte | Cant. | Precio | Uso |
|---|---|---|---|---|
| 18 | **LRS-1200-48** fuente 48V/25A/1200W | 1 | $3,603 | EL RÍO (ya en carrito) |
| 19 | **IRFB4227PBF** MOSFET 200V/65A/19.7 mΩ | 3 | $59 c/u | LA VÁLVULA |
| 20 | **TC4422CPA** driver 9 A DIP-8 no-inversor | 2 | $36 c/u | gate |
| 21 | **MBR40100CT** Schottky 100V/40A | 2 | $18 c/u | freewheel |
| 22 | **1.5KE68A** TVS (clamp 92 V) | 4 | $10 c/u | protección drain |
| 23 | **1N4744A** zener 15 V | 10 | $2.50 c/u | protección gate |
| 24 | **RASPBERRY-PI-PICO-2** (RP2350) | 1 | $141 | EL CEREBRO |
| 25 | **CE-2200/200V** capacitor 2200 µF | 5 | $132 c/u | LA PRESA |
| 26 | Disipador TO-220/247 · MICA2 · pasta térmica | lote | ~$150 | montaje |

### UNIT Electronics — [uelectronics.com](https://uelectronics.com)

| # | Parte | Cant. | Precio | Uso |
|---|---|---|---|---|
| 27 | **Módulo ACS758-100U** Hall 100 A aislado | 1 | $99 | sensor de corriente (pico de ignición 70 A) |

### Alambre (feedstock)

| # | Material | Precio | Dónde |
|---|---|---|---|
| 28 | **Microalambre Infra ER70S-6 0.023" (0.6 mm) sólido** 1 kg | **$159** | [Infra en línea](https://infraenlinea.com/microalambre-infra-welding-wire-0-023-1-kg.html) |
| 29 | Cuerdas de guitarra lisas .010/.011 (banco, 0.25-0.28 mm) | $12-27 c/u | tienda de música |

---

## 📊 RESUMEN DE PRESUPUESTO

| Rubro | Escenario 440 V | Escenario 220 V |
|---|---|---|
| Cable (30 m) | $5,647 | $16,998 |
| Protecciones + tubería + accesorios | ~$6,000 | ~$7,500 |
| **Subtotal eléctrico** | **~$12,000** | **~$25,000** |
| Piso (20 m²: reparar + nivelar + epóxico) | ~$12,000 | ~$12,000 |
| Impresora de metal (AG + UNIT + alambre) | ~$4,600 | ~$4,600 |
| **TOTAL** | **~$29,000** | **~$42,000** |
| *Si necesita transformador 37.5 kVA* | *+$35,000-60,000* | — |

---

## ✅ ORDEN DE EJECUCIÓN

1. **Foto de la placa de datos** → confirma V/Hz/A → congela el calibre
2. Verificar qué voltaje hay disponible en el taller (y capacidad del transformador de la acometida)
3. Reparar piso → nivelar → epóxico (curado ~7 días antes de mover la máquina)
4. Maniobra de la máquina (4.2 t — montacargas de 5 t mínimo)
5. Canalización, cableado, tierra física, relevador de falta de fase
6. Agua de enfriamiento (torre/chiller 40-60 L/min, agua ≤28 °C, 0.2-0.6 MPa)
7. Energizar, verificar secuencia de fases, prueba en vacío

---

## 📚 FUENTES

- [Catálogo oficial Tianjian Pluto (PDF)](https://www.nesher.com.ar/files/Catalogo%20Tianjian%20Pluto.pdf) — specs del PL1200/370
- [Unidad real PL1200/370 2016 (Vieira Máquinas)](https://www.vieiramaquinas.com.br/usada/Injetora-plastico-haitian-TIANJIAN-plutao-pl1200-370)
- [Manual Haitian IMM](https://pdfcoffee.com/imm-480-haitian-pdf-free.html) — alimentación eléctrica y agua
- [Haitian Mars III (Haitian México)](https://www.haitianmexico.com/wp-content/uploads/2023/10/MarsIII-Tech-600-12000-20200805.pdf)
- [Cable THW 6 AWG 100 m — Elektron $7,306](https://www.elektron.com.mx/caja-100-mts-cable-negro-thw-calibre-6-awg-condumex-vinanel)
- NOM-001-SEDE — Art. 430 (motores), Tabla 310-15(b)(16) (ampacidad), Tabla 250-122 (tierra)

**Nota sobre MercadoLibre:** su sitio bloquea consultas automatizadas (muro de login en los resultados
de búsqueda, incluso con navegador real). Los links de arriba son búsquedas listas para abrir a mano;
los precios verificados vienen de proveedores con precio público.

---

# ⚡⚡ CÁLCULO DEFINITIVO — 220 V / 3 FASES / 3 HILOS (confirmado por ian)

## La corriente

| Concepto | Valor |
|---|---|
| I motor a plena carga (FLC) | **44.6 A** |
| I resistencias del barril | **25.6 A** |
| **I total de operación** | **70.2 A** |
| Ampacidad NOM (1.25 × motor + resto) | **81.3 A** |
| Arranque directo del motor (6-8× FLC) | **268-357 A** por 1-3 s |

## 🎯 LA DECISIÓN: cable 2 AWG + ITM 3P de 100 A

| Calibre | Ampacidad @40 °C | Caída a 30 m | Veredicto |
|---|---|---|---|
| 3 AWG | 88.0 A | 1.07% | mínimo NOM, **queda al filo** |
| **2 AWG** | **101.2 A** | **0.85%** | ✅ **RECOMENDADO** |
| 1 AWG | 114.4 A | 0.67% | margen extra, más caro |

**Por qué 2 AWG y no 3:** con ITM de 100 A, el 2 AWG da 101 A → todo coherente. Y si la máquina
resulta ser 50 Hz corriendo a 60 Hz (bomba a 15.6 kW = 79 A), **aguanta sin recablear**. La
diferencia de precio contra el 3 AWG no justifica quedarse corto.

**Rango legal del interruptor** (NOM 430-52: hasta 250% del FLC del motor + otras cargas):
mínimo **81 A** — máximo **137 A**. El 100 A queda centrado y es la medida más comercial.

### Cableado de la derivación

```
3 × 2 AWG THW (fases)  +  1 × 8 AWG verde (tierra)   →   TUBO CONDUIT 1-1/4"
```
*Sin neutro: es delta 3 hilos.* Caída de tensión con 2 AWG: 0.85% a 30 m, 2.26% a 80 m, 2.83% a 100 m.
**Tierra:** 8 AWG (NOM Tabla 250-122 para ITM de 100 A) + varilla copperweld 5/8" × 3 m, ≤25 Ω.

---

## 📋 CUADRO DE CARGAS Y PASTILLAS — centro de carga 220 V 3F 3 hilos

| # | Circuito | I oper. | Polos | **PASTILLA** | Cable | Tierra |
|---|---|---|---|---|---|---|
| 1 | **INYECTORA PL1200** (13 kW motor + 9.75 kW resist.) | 70.2 A | 3P | **100 A** | 2 AWG | 8 AWG |
| 2 | Chiller / torre de enfriamiento (~3 HP) | 7.5 A | 3P | 20 A | 12 AWG | 12 AWG |
| 3 | Compresor de aire (5 HP) | 12.7 A | 3P | 30 A | 10 AWG | 10 AWG |
| 4 | Banco / impresora de metal (2 kW @220 V) | 9.1 A | 2P | 20 A | 12 AWG | 12 AWG |
| 5 | Transformador 220→127 V, 3 kVA (contactos y luz) | 7.9 A | 3P | 20 A | 12 AWG | 12 AWG |
| | **Suma de corrientes** | **107.4 A** | | | | |
| | **Demanda** (inyectora 100% + resto 75%) | **98.1 A** | | | | |

- **Interruptor PRINCIPAL del centro de carga: 125 A 3P**
- **Acometida al tablero: 3 × 1/0 AWG + tierra 6 AWG**

> Ajusta los circuitos 2, 3 y 5 según lo que realmente tengas (si no hay compresor ni chiller, el
> principal baja a 100 A y la acometida a 2 AWG).

## 🔴 REVISA TU ACOMETIDA CFE ANTES DE COMPRAR NADA

```
Demanda del taller:  98.1 A a 220 V 3F  =  37.4 kVA
Solo la inyectora:                          26.7 kVA
```

| Transformador de acometida | Veredicto |
|---|---|
| 15 kVA | ❌ NO ALCANZA |
| 25 kVA | ❌ NO ALCANZA |
| 37.5 kVA | ⚠️ AL FILO |
| **50 kVA o más** | ✅ OK |

**Si tu servicio es menor a 50 kVA hay que tramitar aumento de carga con CFE.** Ese trámite tarda
semanas — arráncalo YA, en paralelo con todo lo demás. Es el camino crítico del proyecto.

---

## 🧯 LOS 3 EQUIPOS DE PROTECCIÓN (y por qué son tres distintos)

### 1. INTERRUPTOR DE SEGURIDAD (la "caja de fusibles") — junto a la máquina

**La NOM 430-102(b) exige un medio de desconexión A LA VISTA de la máquina.** No basta el tablero
si está en otra pared: el técnico que mete la mano tiene que poder cortar y ver que está cortado.

- **3 polos, 100 A, 240 V, con porta-fusibles, NEMA 1** (interior)
- **Fusibles de cartucho 100 A clase RK5 con retardo** (dual element) — el retardo es lo que
  aguanta los 268 A del arranque sin volarse. Máximo legal: 175% × FLC + resto = **104 A**.

| Producto verificado | Precio | Fuente |
|---|---|---|
| **Interruptor de seguridad 100 A NEMA 1, D323N Schneider** | **$6,557.43** | [Elektron](https://www.elektron.com.mx) |
| Interruptor de seguridad 100 A NEMA 3R, D323NRB (intemperie) | $11,975.03 | Elektron |
| Servicio general sin porta-fusible, 3P 100 A | $5,177.54 | Elektron |

> Elektron vende Schneider de línea premium. **En MercadoLibre el mismo tipo de equipo
> (Square D genérico o similar) suele estar entre $2,500 y $5,000.**
> Búsqueda: [interruptor de seguridad 3 polos 100 amp](https://listado.mercadolibre.com.mx/interruptor-de-seguridad-3-polos-100-amp)

### 2. CENTRO DE CARGA — el tablero del taller

| Producto verificado | Precio | Fuente |
|---|---|---|
| **Centro de carga QO zapatas principales 125 A, trifásico, 12 espacios** | **$4,337.42** | [Elektron](https://www.elektron.com.mx) |
| Centro de carga QO 125 A trifásico QO320 | $6,864.82 | Elektron |
| Frente para centro de carga trifásico 12 espacios, QOC16US | $868.94 | Elektron |
| Gabinete NEMA 3R para interruptor QO3100BNRB | $3,635.10 | Elektron |

> Los centros "4 hilos" traen barra de neutro; con delta de 3 hilos simplemente **no la usas**.
> Búsqueda ML: [centro de carga trifasico 12 circuitos](https://listado.mercadolibre.com.mx/centro-de-carga-trifasico-12-circuitos)

### 3. LAS PASTILLAS

| Producto verificado | Precio | Fuente |
|---|---|---|
| **Pastilla QO3100, 3 polos, 100 A** (la de la inyectora) | **$3,650.61** | [Elektron](https://www.elektron.com.mx) |
| Pastillas 3P 30 A y 20 A (compresor, chiller, transformador) | $800-1,500 c/u | ídem |
| Pastilla 2P 20 A (banco) | $400-800 | ídem |

> ⚠️ **La pastilla debe ser de la MISMA marca y línea que el centro de carga** (QO con QO, Siemens
> con Siemens). No son intercambiables. Ahí es donde la gente se equivoca y acaba comprando dos veces.
> Búsqueda ML: [pastilla 3x100 QO](https://listado.mercadolibre.com.mx/interruptor-termomagnetico-3x100)

### 4. 🚨 RELEVADOR DE FALTA DE FASE — *la alerta*

Un relevador solo **avisa y da un contacto seco**; para que realmente corte hace falta algo que abra:

- **Opción barata y elegante:** cablear el contacto del relevador al **circuito de control /
  paro de emergencia de la propia máquina** (aprovecha el contactor que la máquina ya trae dentro).
  Costo: solo el relevador, **$600-1,800**.
- **Opción independiente:** relevador + **contactor 3P 100 A** ($2,000-4,000 extra). Más caro,
  pero no depende de meterle mano al tablero de la inyectora.

Búsqueda: [relevador falta de fase trifasico](https://listado.mercadolibre.com.mx/relevador-falta-de-fase-trifasico)

---

## 🛒 LISTA DE COMPRA FINAL — ELÉCTRICO (220 V 3 hilos)

| # | Material | Cant. | Precio ref. |
|---|---|---|---|
| 1 | **Cable THW 2 AWG** (negro/rojo/azul) 600 V | 3 × (dist. + 10%) m | ~$176/m |
| 2 | **Cable THW 8 AWG verde** (tierra) | 1 × (dist. + 10%) m | ~$47/m |
| 3 | **Tubo conduit galvanizado pared gruesa 1-1/4"** | tramos de 3 m | $280-400 c/u |
| 4 | Coples, conectores y curvas 1-1/4" | lote | ~$1,200 |
| 5 | **Interruptor de seguridad 3P 100 A c/fusibles NEMA 1** | 1 | $2,500-6,557 |
| 6 | **Fusibles cartucho 100 A RK5 retardo** | 3 (+3 repuesto) | $150-400 c/u |
| 7 | **Centro de carga trifásico 125 A, 12 espacios** | 1 | $4,337 |
| 8 | **Pastilla 3P 100 A** (inyectora) | 1 | $3,650 |
| 9 | Pastillas 3P 30 A / 3P 20 A / 2P 20 A | 1 / 2 / 1 | $400-1,500 c/u |
| 10 | **Relevador de falta de fase 220 V** | 1 | $600-1,800 |
| 11 | Zapatas de compresión 2 AWG | 8 | $45-80 c/u |
| 12 | Varilla copperweld 5/8" × 3 m + conector | 1 | $450-700 |
| 13 | Transformador 220→127 V 3 kVA (si quieres contactos 127 V) | 1 | $6,000-12,000 |

**Subtotal eléctrico estimado: $35,000 - $55,000** (según distancia, marca y si va el transformador).

---

# 💻 SOFTWARE DE LA MÁQUINA Y TELEMETRÍA

## Qué controlador trae (probable, confirmar con foto del gabinete)

El panel de las fotos —pantalla a color + teclado de membrana F1-F10 + numérico alfanumérico— es el
patrón de los controladores chinos **Techmation (弘讯)** o **Keqiang (科强, familia T6)**, NO el de KEBA
(KEBA KePlast usa otra disposición). Tianjian es la marca económica del grupo Haitian; las series
altas (Mars/MA) sí llevan KEBA, las económicas suelen llevar Techmation/Keqiang.

**Acción:** abrir el gabinete y fotografiar la etiqueta de la tarjeta del controlador. Eso decide todo lo demás.

## 🔴 Hallazgo duro: Haitian de esa época NO tenía interfaz de datos

Se revisó la ficha técnica europea de la serie Mars/Mars II (gama SUPERIOR a la tuya) y lo único que existe es:

```
Robot interface EUROMAP 67
Mechanical robot interface EUROMAP 18
USB connection for data transfer
```

**Cero menciones de EUROMAP 63, OPC-UA o MES.** No hay puerto Ethernet de datos que "escanear".
(Dato adicional: EUROMAP 63 ni siquiera es un puerto TCP — es intercambio de archivos por carpeta
compartida SMB, y es opción de pago que activa el fabricante.)

**Traducción:** la máquina no habla. Si quieres datos, hay que sacárselos por fuera.

## Las 3 rutas para sacarle datos (de más barata a más completa)

### 1. 🥇 PINZA DE CORRIENTE sobre el cable del motor — *la que ya sabemos hacer*

- **Instalación: 10-15 minutos, sin tocar la máquina ni invalidar garantía.**
- Da: ciclo, tiempo de operación, paros, deriva del ciclo, conteo de piezas (ciclos × cavidades), **OEE**.
- **Límite honesto: NO da temperaturas, presiones ni consignas.** Para SPC de proceso no sirve.
- 💡 **Ya tenemos el hardware y la habilidad**: es el MISMO RP2350 + sensor Hall que estamos
  comprando para la impresora de metal. Un CT split-core (tipo SCT-013, ~$200) se abre y se cierra
  sobre el cable sin desconectar nada. La firma de corriente del motor **es** el ciclo de la máquina.

### 2. Gateway de IO digital (torreta de 3 colores)

`WTGIMM-IO-NET` o `ELINK102-IO` — traen perfil listo para inyectora leyendo la torreta.
Más barato que el gateway serie si solo quieres OEE. Ningún proveedor publica precio.

### 3. Gateway serie sobre el protocolo del controlador

- **`WTGNet-HT/F`** — ficha: `https://www.lookskys.com/htmf/765.html` · config con `WTGLink`
- **`NET100-KQ`** (星汉) — cubre **T6H3** · `http://www.xinghan-iiot.com/product/show-33.html`
  ⚠️ abrir por **HTTP**, el HTTPS da error TLS

**Evidencia fuerte de que NO requiere licencia del fabricante:** en la tabla de compatibilidad del
proveedor, otras marcas SÍ están marcadas con requisito (`Zhafir: 需开通opcua`, `Engel: 需要开通EM63或EM77`,
`Sumitomo: 需开通socket/em77`, `Welltec: 需要开通modbusTcp`) mientras que **las filas de Techmation /
Keqiang / KEBA no llevan marca alguna.** No es marketing: es un catálogo que se contradice a sí mismo
cuando le convendría no hacerlo — y tu controlador cae del lado bueno.

## EUROMAP 67 (conector de robot) — datos eléctricos verificados contra el estándar v1.11

Por si se quiere derivar señales para automatizar o monitorear:

```
Señales por CONTACTO (relé / interruptor / semiconductor)
Potencial de referencia:  18-36 VDC        Tensión máxima:  <= 50 VDC
Corriente mínima de señalización: 6 mA
Alimentación desde la inyectora:  pin A9 = 24 VDC / 2 A
Conector de 50 pines (filas 9-7-9)
```

⚠️ **Máquinas más viejas traen EUROMAP 12 (16 pines) en vez del 67** — verificar cuál antes de
comprar conector. (La ruta es real: la patente US 11,613,023 describe un edge device sobre el EU67.)

## Lo que NO se pudo verificar (honestidad)

- ❌ **La especificación del protocolo Keqiang T6 no es pública** — los proveedores la venden junto
  con el hardware. Si se quisiera hacer en casa: cable en Y + analizador serie entre 9600 y 115200 baudios;
  la trama de la familia Techmation *sería* `inicio → longitud → comando → datos → checksum → fin`,
  pero eso es **PROBABLE**, de resúmenes de búsqueda, no de fuente abierta verificada.
- ❌ Artículos técnicos de CSDN bloqueados por WAF; Zhihu dio 403 — incluido uno que prometía
  escritura bidireccional: **tratarlo como falso hasta demostrarlo en la máquina física**.
- ❌ Ningún proveedor de gateways publica precios.
- ❌ No se localizó manual de operación en PDF del PL1200 específico.

## Recomendación

**Empezar por la pinza de corriente.** Es reversible, barata, no toca la máquina, y la construimos
nosotros con el mismo stack (RP2350 + Hall) que ya está en el carrito. Si después hace falta SPC de
proceso (temperaturas, presiones, consignas), ahí sí se evalúa el gateway serie —
pero primero hay que saber qué tarjeta trae el gabinete.
