# CONTRATO DE LOS AGENTES — PLIEGO AERO

> Léelo completo antes de escribir una línea. Es el mismo ejercicio que produjo el pliego de
> Kazmer (moldes), que sí funcionó. **Español mexicano** (tú/tienes/eleva, NUNCA vos/tenés).

## Qué estamos haciendo

Un cliente real —una empresa que diseña aeronaves— nos entregó sus manuales de proceso y nos
contrató para construirle el software **y la escuela** con que entrenará a sus ingenieros.
Los manuales son tres libros:

| Archivo | Autor | Rol |
|---|---|---|
| `docs/forja-research/manuales/aero/txt/raymer.txt` | Raymer, *Aircraft Design: A Conceptual Approach* 6ª ed. | **EL CLIENTE PRINCIPAL** — el PROCESO de diseño a mano |
| `docs/forja-research/manuales/aero/txt/anderson.txt` | Anderson, *Fundamentals of Aerodynamics* 6ª ed. | **EL MOTOR** — de dónde salen los coeficientes; sus ejemplos son fixtures |
| `docs/forja-research/manuales/aero/txt/bertin.txt` | Bertin & Cummings, *Aerodynamics for Engineers* 6ª ed. | **LO APLICADO** — vortex-lattice, capa límite, high-lift, herramientas |

**El autor NO es un profesor: es el cliente en la entrevista de requisitos.** Cada
"should", "typically", "historically", "rule of thumb", "must", "in practice" es un
**requisito funcional dicho en prosa**. Tu trabajo es traducirlo a software y a escuela.

El cliente ya opinó sobre nuestro producto (Raymer §2.1.4): *"This emphasis on trade studies
poses a problem for high-end CAD systems. They are too good! They've been tailored for
production part design, not the 'everything will change' environment of conceptual design."*
Ese es el hueco de mercado. La Forja es un CAD paramétrico de diseño **conceptual**.

## Las 7 reglas duras

1. **PROHIBIDO INVENTAR.** Toda afirmación cita § y página del libro. Si el libro no lo dice,
   no existe. Si necesitas extender algo más allá del libro, márcalo `[EXTENSIÓN DECLARADA]`
   con el motivo. Esta regla ya nos costó caro una vez: no la rompas.
2. **Cita LITERAL** entre comillas cuando la frase es el requisito. Traduce después, no en vez.
3. **Los ejemplos numéricos son FIXTURES DE TEST.** Este es el entregable más valioso.
   Formato obligatorio, uno por ejemplo resuelto del libro:
   ```
   FIXTURE anderson-ej-1.1 [§1.5, p.XX]
   entradas: M=2, alpha=0, c=100mm, cuña 5°, p_inf=101325 Pa
   salida esperada: D'=1.24e4 N/m, cd=0.022, reparto presión/fricción 85/15
   tolerancia: 1% (el libro redondea a 4 cifras)
   ```
4. **Fórmulas con su RANGO DE VALIDEZ y sus supuestos.** Una fórmula sin su dominio es una
   mentira futura. Anota qué se rompe fuera del rango (el cliente entrena ingenieros: el
   ingeniero debe saber CUÁNDO la ecuación deja de ver).
5. **Declara lo NO OBSERVADO.** El texto viene de `pdftotext`: las figuras, gráficas y tablas
   que eran imagen NO están. Si un requisito depende de una figura que no puedes leer, dilo
   explícitamente en la sección final "NO OBSERVADO" con el número de figura. Nunca la
   inventes ni la deduzcas.
6. **Marca el costo de cómputo** de cada método: `[NAVEGADOR]` (milisegundos, interactivo),
   `[PRECÓMPUTO]` (se calcula una vez en la GPU y se sirve como tabla/campo),
   `[GPU-VIVO]` (exige un solver corriendo en iangpu). Tenemos una RTX 4070 Ti: lo que se
   pueda precomputar, se precomputa.
7. **Cada bloque entrega también ESCUELA.** El cliente va a entrenar ingenieros. De tu bloque
   saca las lecciones: qué construye el alumno, qué mueve, qué debe VER pasar, y contra qué
   número del libro se verifica. La escuela vive **dentro del CAD** (`forja-brep.html`):
   el alumno DIBUJA la geometría con croquis y cotas y la analiza con un estudio — no es un
   simulador de juguete aparte.

## Estructura obligatoria de tu entregable

Escribe **un solo archivo** en `docs/forja-research/aero-pliego/<tu-nombre>.md`:

```
# <Libro> caps X–Y — <título>
Fuente: txt/<libro>.txt líneas A–B (leído completo). Fecha, autor del análisis.

## 0. MAPA — qué hay en estos capítulos y por qué le importa al cliente

## 1. REQUISITOS FUNCIONALES  (formato: [dominio] [§] requisito (APRENDER/CONSTRUIR/ambos))
   dominio = geometria | aero2d | aero3d | compresible | viscoso | sizing | pesos |
             estabilidad | performance | costos | optimizacion | escuela

## 2. FÍSICA — fórmulas, rango de validez, supuestos, qué se rompe fuera

## 3. FIXTURES DE TEST  (todos los ejemplos numéricos resueltos, formato de la regla 3)

## 4. DECISIONES HUMANAS — dónde el libro dice que juzga el ingeniero y el software NO debe decidir

## 5. COSTO DE CÓMPUTO — tabla método × [NAVEGADOR|PRECÓMPUTO|GPU-VIVO] + por qué

## 6. ESCUELA — lecciones que salen de este bloque (construir → mover → ver → verificar contra el número)

## 7. NO OBSERVADO — figuras/tablas que eran imagen y no pude leer (por número)

## 8. LO QUE MÁS ME SORPRENDIÓ — lo que una máquina lineal se salta y aquí sí importa
```

## Cómo leer sin quemar contexto

- Usa `Read` con `offset`/`limit` sobre el `.txt` (no abras el PDF).
- Usa `Grep` sobre el `.txt` para localizar términos, ejemplos ("EXAMPLE"), y fórmulas.
- Lee **todo tu rango**. No muestrees: el cliente pagó por cobertura, no por un resumen.

## Lo que YA existe en la Forja (no lo reinventes, léelo antes)

- `docs/forja-research/pliegos/pliego-aero.md` — 3,872 líneas, ya trata a Raymer como cliente.
- `docs/forja-research/aero/CURRICULUM-AERO.md` y `PLAN-ESCUELA-AERO-EN-EL-CAD.md`.
- `src/aero/` — motor ya construido con 25 tests: `atmosfera.ts` (ISA), `potencial.ts`
  (flujo potencial, elementos elementales), `cuna-anderson.ts` (Ej. 1.1 supersónico).
- El pliego de moldes (`docs/forja-research/kazmer-pliego/`) es el ejemplo del formato ganador.
