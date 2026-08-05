# Cadena: LA FORMA MANDA — cronograma 5-7 de agosto 2026

> Las tres cadenas anteriores (ENLACES, EL JALÓN, EL AGUA) contestan todas la misma pregunta:
> **qué mantiene unidos a estos átomos**. La máquina siempre apuntó al enlace.
>
> El hexámero fue el más completo porque fue la primera vez que apuntó a lo que un enlace
> **HACE** — una forma que llega hasta un copo de nieve. Esta cadena vive ahí: cosas que tocas
> todos los días cuyo comportamiento lo decide una forma que puedes **contar o ver**.

**El canon NO se modifica.** Es agnóstico a la molécula: física → guion → voz → beats → render →
QA de ojo → cápsula → publicar. Lo único nuevo por cadena es el script de física. Esa fue la
apuesta de la arquitectura de manifiestos y ya se pagó tres veces.

---

## Las 4 piezas — el arco

Cada una es una versión **más fuerte** de la misma afirmación. Ese escalón es la cadena.

| # | pieza | la forma | el remate cotidiano |
|---|-------|----------|---------------------|
| 1 | **El codo** | un enlace doble dobla la cadena | por qué el aceite es líquido y la mantequilla sólida |
| 2 | **Las dos puntas** | una molécula con un extremo que ama el agua y otro que la odia | por qué el jabón levanta la grasa |
| 3 | **El espejo** | la misma molécula volteada | menta y comino: mismos átomos, olor distinto |
| 4 | **El mismo átomo** | carbono con 4 vecinos o con 3 | diamante y grafito: lo que corta vidrio y lo que deja raya |

La 4 es el remate por la misma razón que el copo cerró el agua: **ya no hay nada que cambiar
salvo la forma**. Mismo elemento, mismos enlaces, propiedades opuestas.

---

## Cronograma

### Miércoles 5 (hoy, lo que queda)
- **Manifiesto de la pieza 1** (`videos/mol-grasa-el-codo.json`) — Regla #0.5: el video es datos.
- **Motor de física de la cadena**: `scripts/precompute-cadena.py`. Es la inversión grande del
  día y la que hace baratas las otras tres.
- **Gate de FÍSICA + gate de FORMA** corriendo. El de forma NO es opcional: en el prisma del
  hexámero la energía salió correcta sobre una geometría desarmada y casi reporté un resultado
  falso. Si la pieza depende de que se vea un codo, **hay que medir el codo en grados**.

### Jueves 6
- **Pieza 1 ENTREGADA** de punta a punta: guion → voz (con `voz-check`) → beats → 4K → QA de
  ojo → cápsula → publicar.
- Física de la **pieza 2** (jabón) montada sobre el mismo motor.
- 🔔 **Cae la primera lectura de telemetría** (~1.6 días desde la frontera del miércoles 12:43).
  Solo leer la tendencia; con menos de ~300 sesiones no se concluye nada.

### Viernes 7
- **Pieza 2 ENTREGADA.**
- Física de las piezas **3 y 4**.

### Honestidad del cronograma
**Las piezas 3 y 4 NO caben en tres días.** Caen sábado/lunes. Prometer cuatro entregadas con un
motor nuevo de por medio sería mentir: la referencia de ~2 h/pieza vale cuando el motor YA existe
(así entró cada molécula desde CO), y aquí el primer día se va casi entero en construirlo.

---

## Lo que cambia técnicamente respecto al agua

**Moléculas más grandes.** El ácido oleico son 54 átomos (~500 funciones de base) contra los 18
del hexámero. Ahí la GPU sí conviene — `gpu4pyscf` empieza a ganar arriba de ~350 bf, y por
debajo de ~150 pierde. Ver [[reference_gpu4pyscf_iangpu]]: `LD_LIBRARY_PATH=/usr/lib/wsl/lib`.

**El sujeto ya no es un anillo.** Las tomas del registro (`ringFaceOn`, `ringEdgeToFace`,
`ringOne`…) son genéricas en N pero suponen un anillo. Una cadena larga necesita tomas propias
—recorrerla a lo largo, verla de perfil— que se agregan a `CAMERA_SHOTS` como datos, sin tocar
la maquinaria.

**La ley de encuadre.** Mide `rCore` sobre todos los `pts` y clava la cámara para que el sujeto
entero quepa. En una cadena de 18 carbonos eso deja la molécula chiquita. Ya existe la salida:
`rCore` por toma (ver `ringOne`), que fue lo que desbloqueó el close-up del hexámero.

---

## Lo que NO vamos a prometer

- **El olfato** (pieza 3): podemos mostrar que son imágenes de espejo. El mecanismo del receptor
  necesita una proteína y NO lo vamos a inventar. Se dice "la nariz las distingue", no se explica
  cómo. Misma disciplina que `honestidad_del_copo`.
- **El cristal** (pieza 4): un fragmento finito de carbono NO es un diamante. Se muestra el
  MOTIVO —4 vecinos en tetraedro contra 3 en plano— y se dice que se repite. Igual que con el
  hielo: lo que se repite es la forma, no que esto SEA el cristal.
