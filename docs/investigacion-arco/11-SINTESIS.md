# SÍNTESIS: los 10 agentes en un solo plan (2026-11-05)

Diez reportes (`01`–`10` en esta carpeta). Cada número tiene su script en `scripts/investigacion-arco/` o una fuente citada. Aquí va lo que queda en pie, lo que murió, las contradicciones entre agentes (resueltas) y el ORDEN de los experimentos. **Nada está medido en el banco todavía: todo es modelo + literatura.**

## 1. La respuesta a las preguntas de ian

| pregunta | respuesta | reporte |
|---|---|---|
| ¿«Millones de ondas»? | **No.** La gota solo aprovecha 9–25 números por gota. La forma óptima es **bang-bang en fase con la velocidad de la gota** (la cuadratura del lente 𝔄): suelta en 4.8 ciclos con 100 % de éxito, contra 70 % del chirp a ciegas y 0 % con 3 tonos. | 01 |
| ¿Resonancia de campos para concentrar energía en la punta? | **No.** La punta solo recibe la corriente media ⟨I⟩. La HF, el efecto piel y los tanques LC no le llegan o quedan fuera de alcance. Las perillas reales son el largo de arco (cada mm se lleva ~400 W), DCEN (+29–50 % de fusión) y el stickout. | 02 |
| ¿Gases ionizados y una atmósfera propia con campos? | **No.** Fuera del arco no queda gas ionizado que agarrar: 0.3–0.4 % a 1–1.7 mm, recombinado en ns, y 1 atm pediría campos de 1 a 1800 T. La palanca real es el **largo de arco corto** y una forma de onda sin pulsos lentos grandes. | 03 |
| ¿Detectar contacto, distancia y temperatura? | **Contacto y cuello: sí** (11 µs; aviso 50–114 µs antes de reventar). **Distancia: depende de E**, cuántos V da cada mm de arco: 10 (ian) contra 1.1 (literatura). **Temperatura del alambre:** solo en cortos o toques. **Del charco:** por su frecuencia, o con un termopar de €4.60. | 04 |
| ¿Menos componentes y más control? | **63 → 47 piezas (−25 %)**, validado en 21 simulaciones ngspice, ganando control: menos energía al reventar, salida acotada y lazo de cables pequeño. | 05 |
| ¿Control absoluto con un cable? | **No del todo.** Con I sola se controlan 8 de 13 estados. Lo mínimo es **I(t) + motor del alimentador** (+2 bobinas si se apunta). Para sensar bastan **V e I** con lock-ins. Hallazgo del lente: una sola corriente controla DOS promedios, ⟨I⟩ y ⟨I²⟩; con eso se fijan aparte la temperatura de la punta y el stickout. | 06 |
| ¿El charco es otra campana? | **Sí**, a 310–680 Hz en nuestro proceso. **Puede tapar el oído de la gota**: pasa-altas de 4.º orden a 450 Hz antes del lock-in. Da el ancho y la temperatura de la capa; la altura la da el DC del arco. | 07 |
| ¿Qué tan rápido y preciso? | El arco mete ~50 J/mm³ (5× lo que cuesta fundir). **La pieza limita.** Cubo de 20 mm: 87 min sobre loseta, 17 sobre disipador. Pared de 3–4.5 mm, capa de 1 mm, altura ±30 µm. **La escoria es el bloqueo principal de «sin gas, mismo material».** | 08 |
| ¿El campo del banco tuerce el arco? ¿Se puede apuntar? | B en el arco 0.17–0.33 mT (bajo el umbral). **La causa es la placa, no los cables.** Apuntar la gota con campo es **FALSO** (el arco se dobla primero). Lo prometedor es **apuntar el ARCO** con 2–4 vueltas del retorno en serie (130–270 µm, <1 W). | 09 |
| ¿Nadie lo ha hecho? | **Falso para el núcleo**: Kentucky ya soltaba la gota por oscilación en fase en 1997–2002, con patentes expiradas, libres de usar. **Lo nuevo es la combinación**: el oído en lazo cerrado más el disparo que se adelanta, dos corrientes base, el bang-bang en fase, alambre sin gas en DCEN y un buck de 48 V. | 10 |

## 2. Lo que MURIÓ (no se vuelve a proponer sin dato nuevo)

- Multitono, chirp a ciegas y bombeo 2ω, este también con retroalimentación (01).
- Constricción por HF, efecto piel, campo axial y tanque LC (02).
- Confinamiento magnético, cortina de viento iónico y campo para proteger (03).
- Apuntar la GOTA con bobina (03, 09). `apuntar2.py` hay que rehacerlo: su actuador mueve el arco.
- Quitar el choque, la topología sin IR2110 y el observador volt-segundo como sensor de corriente (05).
- Seguir al motor gota a gota (05). Sí sirve en promedio, como cuenta de masa.
- Sincronizar la gota con el charco para bajar la salpicadura (07).
- Imprimir sin quitar la escoria, el autoprotegido sin escoria y el E71T-GS estructural de varias pasadas (08).
- **El canon con 3 m/min, 75 gotas/s y gota libre a 60 A** (02, 06, 08).

## 3. Contradicciones entre agentes, resueltas

- **Q3, el crowbar.** El 04 dice que se queda (con 41 µH la corriente tarda 349–607 µs en bajar). El 05 dice que se va (con 15 µH y la orden «V < 8 V → 10 A», revienta a 9.6 A). **Los dos tienen razón según el choque.** Q3 solo sale junto con el choque de 15 µH, y se valida en la carga falsa (E1).
- **Gotas por segundo.** El 02 da ~24 y el 08 ~41 (depende de cuánto metal trae el tubular y de cuánto funde a 40 A). Los dos tumban el 75 del canon. Se mide en E2/E3.
- **E en V/mm.** El 02 predice que la quema DCEN sube a 305 V/s (224–382), consistente con los 10 V/mm de ian. El 04 da 350 V/s si E = 10 y 38 V/s si E = 1.1. **La quema lo decide** (E2).
- **Campo de una pinza mal puesta.** El 03 supuso 0.8 mT; el 09 calcula 0.1–0.33 mT para el banco v2. Vale el 09, que tiene la geometría real.

## 4. Hechos de hardware que cambian el banco YA

- **La LRS-1200-48 solo acepta 180–305 Vac**: no prende a 127 V. Hace falta un contacto de **220 V**, y el PARO corta los dos polos de AC (el remoto de la LRS no es a prueba de fallas) (05, 10).
- A 40 A, un hueco de más de ~1.4 mm pasa el 105 % de la LRS y se apaga a los 5 s. La ventana real de la gota libre es **40–45 A** (05, 06).
- El Pico 2 solo tiene **3 ADC libres**, y GP29 es VSYS/3 interno: el NTC del plan no se puede. Termostato NC en el lazo SD (04, 05).
- Para los picos del bang-bang (70–100 A), **D1 de 150–200 V**. Shunt de 0.5 mΩ + INA240 en vez del ACS758 (01, 05).
- **Seguridad** (10): caja de arco más extractor de ≥150 m³/h con ducto a la calle (el humo con Mn es el riesgo #1), sombra 11, extintor ABC, P100 hasta validar la caja y la hoja de seguridad del 13750.

## 5. El banco v2 cambia así (la orden de La Forja que sigue)

1. **Mesa:** fuera la loseta. Placa de acero o aluminio con agua (o disipador), mordazas, y **marco de cobre bajo todo el perímetro de la placa** como contacto + (campo en el arco 0.19 → 0.06 mT; lazo 3.49 → 0.06–0.15 µH) (05, 08, 09).
2. **Antorcha** alimentada por su eje, recta ≥100–150 mm antes de doblar (09).
3. **Circuito mínimo (05):**
   - buck lado alto a 100 kHz;
   - choque de 15 µH (18 vueltas);
   - shunt + INA240;
   - una sola Rg de 22 Ω (sin TVS ni snubber si el lazo Q1–D1–Cf mide ≤ 15–20 nH);
   - Cout de 1 µF + D2;
   - termostato NC;
   - puente H del motor con fcem en GP28;
   - pieza al +, alambre a tierra (DCEN).
4. **Cabeza:** cepillo rotativo + aire, para la escoria entre capas (08).
5. **Caja de arco + extractor** (10).

## 6. El firmware que sale de todo

- **Toque y cuello:**
  - toque de punta a 10/20/30 A, que da R y L de los cables;
  - cuello a 5 mΩ, que pide 10 A (o Q3);
  - regla de escoria: sin toque tras (stickout + hueco)/v_f → parar y cortar la punta (04).
- **Lazo de largo de arco obligatorio** (CV): con alimentación fija, 1 % de error mueve el arco 0.93 mm (02, 06).
- **El oído:**
  - EKF de 6 estados con dos corrientes base;
  - pasa-altas de 450 Hz contra el charco;
  - piloto 25/55 A;
  - soltar con bang-bang 10↔I_max por el signo de la velocidad estimada;
  - la caída se confirma por un salto de V mayor a +4 V (01, 04, 07).
- **Atmósfera:** el arco más corto estable (V_min + 1–2 V) y nada de picos >2.5·⟨I⟩ por debajo de ~700 Hz (03).
- **Térmica:** espera por capa según la altura (08).

## 7. EL ORDEN de los experimentos (seguridad primero; lo barato y decisivo antes)

| # | experimento | decide | piezas nuevas | reporte |
|---|---|---|---|---|
| E0 | contacto de 220 V, PARO de AC, caja + extractor (prueba de humo), sombra 11, extintor | poder prender seguro | contacto, extractor | 10 |
| E1 | 10 min midiendo el motor del alimentador + **la etapa mínima con carga falsa de 0.6 Ω en agua** a 40 A | el circuito mínimo: Vds ≤ 80 V, D1 ~63 V, INA240 ±0.5 A del amperímetro; si D1 pasa de 90 V, vuelve el snubber | shunt, INA240 | 05 |
| E2 | **la quema**: arco a 40 A, se para el motor 80 ms y se lee la rampa de V | E: 350 V/s → 10 V/mm; 38 V/s → 1.1 V/mm | ninguna | 04, 02 |
| E3 | **100 golpecitos** de 10 A × 0.8 ms sobre 40 A, escuchando 3 ms | si el oído existe: f₂·a^1.5 = 204 Hz·mm^1.5 ±20 %, Q ≥ 25, la fase | ninguna | 06, 01 |
| E4 | puntos de 0.25 a 6 s en la placa de 3 mm, V a ≥50 kS/s, Ø con vernier | el charco como sensor: f ∝ D^−3/2 y caída al perforar | ninguna | 07 |
| E5 | gota por gota, chirp del canon contra bang-bang | el bang-bang gana ≥2 ciclos y 100 % contra 70 % | ninguna | 01 |
| E6 | puntos con bobina de ±0.5 mT a 40 y 70 A | manda el arco (333 µm) o la gota (≤5 µm) | bobina de prueba | 09 |
| E7 | 12 cordones: 3 voltajes × 4 ondas, contar poros | si el largo de arco y la onda protegen | ninguna | 03 |
| E8 | dos paredes gemelas de 15 capas (cepillada contra no) | **la escoria**: pesar, cortar, doblar | cepillo | 08 |

**Si E3 sale mal** (no aparece la línea de la gota, o Q < 10), el oído del canon no existe y el plan cambia de sensor antes de gastar en lo demás.
