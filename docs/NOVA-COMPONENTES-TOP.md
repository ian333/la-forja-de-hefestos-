# NOVA — Qué stockear: los componentes que la gente MÁS usa

> Investigación 2026-06-10 (deep-research: 106 agentes, 23 fuentes, verificación adversarial).
> Tesis: stockear empíricamente lo que aparece en los proyectos más populares — el mismo
> truco de JLCPCB con sus "basic parts" (los que salen en más diseños = $0 de feeder).

## TL;DR

La evidencia converge en un **núcleo claro**. Los proyectos de principiante más populares
(familia NE555, seguidor de línea Arduino, primeros proyectos blink/botón) y los kits ya
vendidos en México (UNIT Electronics) comparten **el mismo BOM recurrente**. Eso define el catálogo.

**La oportunidad para NOVA NO es la existencia del catálogo** (UNIT, 330ohms, AG, Steren ya
venden casi todo) — **es precio + disponibilidad consistente + empaquetar "kits estrella"
basados en proyectos verificados, enseñando a usarlos** (nuestro diferenciador).

---

## (A) El núcleo obligatorio — "siempre presentes" [confianza alta]

Convergen 3 fuentes independientes (kit UNIT ESP32, ELEGOO Basic, Arduino Starter oficial):

- **Protoboard** (830 puntos) + **jumpers/Dupont**
- **Resistencias E12**: 10Ω, 100Ω, **220Ω, 330Ω, 1kΩ**, 2kΩ, 5.1kΩ, **10kΩ**, 100kΩ
  (220/1k/10k son universales — aparecen en las 3 fuentes; ELEGOO marca 100/220/1k/10k como "frequently used" 50pcs vs 25pcs de los raros)
- **LEDs** multicolor (rojo/amarillo/verde/azul/blanco)
- **Push buttons** + **headers**
- **Potenciómetro 10k**, **buzzer** (activo/pasivo)

## (B) Las estrellas de semiconductor/módulo [confianza alta]

| Componente | Por qué (evidencia) | LCSC (C#####) |
|---|---|---|
| **NE555** timer | Ancla 10 proyectos de principiante por sí solo; ~1,000M unidades/año | — |
| **BC547** NPN (TH) | Servo controller, clap switch (2×); "el NPN de propósito general más usado" | — |
| BJTs SMD básicos JLC | SS8050, S8050, S9013, SS8550, MMBT3904/5551/5401 | C2150, C2146, C6749, C8542, C20526, C2145, C8326 |
| **IRF540 / IRFZ44N** | MOSFET de potencia: control de motor DC (3×), dimmer LED; intercambiables 12V | — |
| **LM2596 / 7805 / AMS1117** | Reguladores (buck + lineales) | AMS1117 = C6186 ($0.13) |
| **LM358 / LM393** | Op-amp / comparador | C7950 ($0.07) / C7955 ($0.07) |
| **ULN2003 / L293D / L298N** | Drivers de motor/relé | ULN2003 = C7512 ($0.19) |
| **ESP32** (DevKit V1, C3 SuperMini) / ESP8266 / Arduino Uno-Nano-Mega | Los cerebros | — |
| Sensores: **DHT11, HC-SR04, PIR HC-SR501** | Temp/humedad, distancia, movimiento | — |
| **Módulos relé** 1/2/4/8 canales | Conmutar 127V desde 5V | — |
| Otros con C# útil | 74HC595 = C5947 ($0.09), CH340G = C14267 ($0.36), STM32F103C8T6 = C8734 ($1.61) | |

> Sourcing: existe el dataset **JLCPCB-Basic-Parts (691 filas)** con C#####, stock, MFR y precio USD
> por parte → es el mapa directo a LCSC para nuestro "lote".

## (C) Kits estrella candidatos (proyectos ÚTILES y verificados)

1. **Familia NE555** (10 proyectos en uno): flasher, clap switch, sensor luz/oscuridad,
   alarma temporizada, control de velocidad DC, dimmer, touch switch, LED chaser.
   → BOM: 555, BC547, IRF540/IRFZ44, R/C comunes, LEDs, pot. **Ya simulamos casi todo.**
2. **Seguidor de línea Arduino** (estrella absoluto de principiante):
   Arduino UNO + driver L298N (o L293D) + 2 sensores IR + 2 motores DC con caja (BO 60RPM 6V).
3. **Kit 10 prácticas ESP32** (lo que vende UNIT a $269 MXN): ESP32 + DHT11 + PIR + LEDs +
   R E12 + jumpers + pot 10k + buttons + buzzer + relé 5V.
4. **Luz nocturna / alarma de temp / dimmer / probador de pilas** — ya construidos y verificados
   en nuestro Banco de Trabajo (NOVA).

## (D) Contexto LATAM — qué ya hay y precio de referencia

- **UNIT Electronics**: stockea el núcleo completo (ESP32 DevKit V1/C4, C3 SuperMini, ESP8266,
  Arduino Uno/Nano/Mega, DHT11, HC-SR04, kit 37 sensores KY, LM2596, 7805 SMD, LM358N, relés 1-8ch).
  Vende kits por prácticas: **ESP32 10-prácticas $269 / UNO 13-prácticas $249 / Starter 20-prácticas $447 MXN**.
  Sucursales GDL/CDMX, 4.9/5 con 394 reseñas → **categoría comercial madura, no hueco de existencia.**
- **330ohms**: HC-SR04 a **$40 MXN** (≈ USD 2.2) — benchmark de precio commodity.

## Lo que faltó / a verificar (open questions)

1. **Ranking cuantitativo real** de proyectos por vistas/clones (OSHWLab/YouTube): se confirmó
   que las métricas EXISTEN (OSHWLab da views/likes/comments/clones por proyecto; "Stars" 2026 = 71
   proyectos, 2025 = 174) pero NO se extrajo la tabla numérica → requiere scraping directo de
   `oshwlab.com/explore` ordenado por copies.
2. **Comparativa de precio sistemática** Steren vs AG vs UNIT vs 330ohms del top-20 → **es la
   oportunidad de negocio central y quedó como hipótesis, no dato.** (Dónde sale caro / se agota.)
3. **TH vs SMD**: el maker-principiante LATAM va a TH/protoboard (2N2222, 555 DIP, L293D DIP);
   el sourcing barato vía LCSC está en SMD. ¿Stockear ambos?
4. **Costo landed real** (LCSC→México: flete + aduana + IVA + MOQ) por kit, para fijar precio
   competitivo vs los $249-447 de UNIT.

## Fuentes clave
- circuits-diy.com (familia 555), circuitdigest.com (seguidor de línea)
- uelectronics.com (UNIT, catálogo + kits + manual oficial), 330ohms.com
- github.com/josemariaaraujo/JLCPCB-Basic-Parts (CSV 691 partes con C#####)
- oshwlab.com/explore (métricas open-hardware), circuito.io, elegoo, store.arduino.cc
