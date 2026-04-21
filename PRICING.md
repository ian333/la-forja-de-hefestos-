# La Forja de Hefestos — Modelo de Negocio

> **Regla de oro: cobra donde hay dinero, regala donde hay hambre.**

---

## Filosofía

Autodesk, MATLAB, Adobe, JetBrains: TODOS regalan licencias a estudiantes. ¿Por qué? Porque cuando ese estudiante sale y llega a Pemex, a Condumex, a Bimbo, a una farma, va a exigir la herramienta que ya sabe usar. El regalo al estudiante es la conquista del mercado empresarial de aquí a 5 años.

Cobrarle $50 o $100 pesos al estudiante del Poli que ya está comiendo Maruchan para llegar a fin de quincena es un error estratégico Y humano. Perdiste al usuario, no pagaste tu servidor con $50 pesos, y quemaste la posibilidad de que te recomiende.

**Los estudiantes no pagan, las empresas donde trabajan pagan después.** Esa es la jugada larga.

---

## Tiers de Precio

| Tier | Quién | Precio | Qué obtiene |
|------|-------|--------|-------------|
| **Student** | Correo `@ipn.mx`, `@unam.mx`, `@comunidad.unam.mx` verificado | **GRATIS** | Acceso completo + cuota de compute mensual (ej: 10 hrs GPU/mes). Si pasa de eso, paga solo por compute adicional |
| **Hobbyist / Individual** | Cualquiera sin correo institucional | **$199/mes** o **$1,499/año** | Todo menos compute intensivo |
| **Profesional / Freelance** | Ingeniero independiente | **$899/mes** | Compute generoso + simuladores avanzados |
| **Small Business** (1–10 personas) | Pymes, consultorías | **$3,499/mes por asiento** | Todo + soporte |
| **Enterprise / Laboratorio** | Farma, petrolera, universidad privada, centro de investigación | **$15,000–50,000/mes** custom | Todo + integración + SLA + onboarding |

---

## ¿Conviene cobrar caro?

**Sí, pero solo a enterprise.** Un Bayer, un Genomma Lab, una UAM con presupuesto de investigación, un CINVESTAV — esos pagan $30,000 MXN al mes sin parpadear si el producto les ahorra un ingeniero o reemplaza una licencia de SolidWorks ($50K USD/año por asiento). Ese es el verdadero margen.

El estudiante individual nunca va a ser fuente de ingresos. Pero es fuente de:
- **Adopción** — base de usuarios desde el primer día
- **Testimonio** — prueba social en Twitter/LinkedIn
- **Comunidad** — feedback, bug reports, ideas
- **Contratación futura** — talento que ya conoce la plataforma

Invertir en estudiantes es marketing + R&D humano, no caridad.

---

## Compute: el detalle técnico

Simulaciones serias de química/genoma queman GPU. Aunque el software sea gratis para estudiantes, el compute se paga siempre — por alguien.

| Tipo de simulación | Corre en | Costo para estudiantes |
|--------------------|----------|----------------------|
| **Ligeras** (átomo, electrones, compuertas lógicas, motor visual) | CPU local del usuario | Gratis sin límite |
| **Pesadas** (proteína, drug-docking, genoma) | GPU en la nube | Créditos gratis mensuales (~10 hrs), después pago por uso a costo |

Así no te quiebras regalando compute.

---

## Realidad del bolsillo estudiantil (MXN)

| Perfil | Capacidad de pago mensual |
|--------|--------------------------|
| Estudiante promedio Poli/UNAM | $0 – $100 (con dolor) |
| Estudiante posgrado con beca CONACYT | Hasta $300 |
| Ingeniero recién egresado trabajando | $500 – $800 |

Por eso el modelo no es "qué pueden pagar los estudiantes" sino **"los estudiantes no pagan, las empresas donde trabajan pagan después."**

---

## Dominios institucionales para verificación

```
@ipn.mx
@unam.mx
@comunidad.unam.mx
@tec.mx
@itesm.mx
@uam.mx
@cinvestav.mx
@conacyt.mx
```

Se puede expandir a cualquier `.edu.mx` verificado.
