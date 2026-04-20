# ChemLab — Lecciones ejecutables

Cada archivo de este directorio es una **clase completa** que un profesor puede correr en vivo frente al grupo, o un estudiante leer y modificar en casa. No hace falta instalar nada fuera de este repositorio.

## Ejecutar

```bash
npm run lesson examples/chem/01-arrhenius.ts
npm run lesson examples/chem/02-vida-media.ts
# ... etc
```

O todas de un tirón:

```bash
for f in examples/chem/0*.ts; do npm run lesson "$f"; done
```

## Índice

| # | Archivo | Tema | Conceptos clave |
|---|---------|------|-----------------|
| 1 | `01-arrhenius.ts` | ¿Por qué la cocina no explota? | k = A·exp(−Ea/RT), sensibilidad a T |
| 2 | `02-vida-media.ts` | La firma de una reacción de primer orden | t½ = ln(2)/k, independencia de C₀ |
| 3 | `03-le-chatelier.ts` | Le Chatelier con Haber-Bosch | equilibrio, ΔH, compromiso T↔rendimiento |
| 4 | `04-reaccion-en-serie.ts` | El intermediario fugaz A→B→C | estado estacionario, t_max analítico |
| 5 | `05-lotka-volterra.ts` | Oscilaciones químicas | no-linealidad, Belousov-Zhabotinsky |
| 6 | `06-catalisis-enzimatica.ts` | Por qué el H₂O₂ burbujea en la herida | enzimas bajan Ea, factor 10⁸ |
| 7 | `07-diseno-reactor-industrial.ts` | Diseño industrial: PFR vs CSTR, runaway | ingeniería de reactores, balance de energía, stiff solver |

## Cómo adaptarlas a tu clase

Cada lección sigue la misma estructura:

1. **Pregunta de entrada** (en el header del archivo) — la motivación, algo cotidiano que el estudiante reconoce.
2. **Pizarra de fórmulas** — las ecuaciones relevantes impresas limpio.
3. **Simulación numérica** — corre el motor, produce trayectorias, mide observables.
4. **Observación** — compara la teoría con lo medido. Tabla + gráfica ASCII.
5. **Ejercicios** — preguntas para modificar parámetros y re-correr.

Para hacer una lección nueva:

1. Copia `01-arrhenius.ts` como plantilla.
2. Cambia los parámetros y la narrativa.
3. Corre `npm run lesson examples/chem/tu-nueva-leccion.ts`.

## Filosofía

Estas lecciones **no son tutoriales de un software** — son **sesiones de física computacional**. La herramienta es un medio; el objetivo es que el estudiante:

- Vea la realidad chemical comportarse y coincidir con lo que predice el libro.
- Cambie números y vea consecuencias en tiempo real.
- Se convenza de que "todo son fórmulas, solo hay que simularlas".

La Forja no intenta reemplazar al profesor. Le da al profesor un pizarrón que responde.
