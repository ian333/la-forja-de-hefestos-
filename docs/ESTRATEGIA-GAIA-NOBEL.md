# ESTRATEGIA GAIA — por qué esto funciona, con la ciencia de los Nobel

> Hermano de `NOVA-ESTRATEGIA-NOBEL.md` (que es para kits/constructores). **Este es para
> GAIA: la universidad, los videos y el ERP.** Escrito 2026-07-27, a partir de datos reales
> del canal (18,420 vistas del reel del agua), de la telemetría del sitio y de literatura
> económica verificada. No es una corazonada ordenada bonito: cada afirmación trae su dato.

---

## 0. El inventario honesto (qué hay, no qué queremos)

| activo | estado real |
|---|---|
| **GAIA Prime (Orkesta)** | ERP/SaaS multi-tenant EN PRODUCCIÓN. ~198,000 líneas Python · 423 endpoints · 36 modelos ORM · 9 modelos ML · 13 calculadoras financieras · 250 métricas · facturación SAT. **Ha manejado +10 millones de pesos en facturación.** |
| **Canal (química/física)** | 3,007 seguidores · 150.2K vistas/30 días. El reel "El puente": 18,420 vistas, +338 seguidores (2.7% del alcance), 431 guardados. |
| **La Forja (CAD/moldes)** | ~6 meses para estar terminada. |
| **Universidad (web)** | Publicada, con biblioteca de videos y masterclases. **~75 visitas a la portada en 7 días; 14 llegadas desde Instagram; 94% del tráfico somos nosotros.** |

**La lectura cruda:** el producto que puede facturar YA existe y está probado. Lo que no existe
es el puente entre la audiencia que crece y la caja que factura. Y ese puente **no es un link en la bio**.

---

## 1. Lo que realmente vendes: el COMPLEMENTO, no el ERP

La intuición de Ian —*"al taquero no le sirven 250 métricas… pero si le enseño CÓMO FUNCIONA LA
ECONOMÍA, con ciencia real y no con libros de motivación, sabrá usar GAIA en su totalidad"*—
no es marketing. Es un resultado empírico documentado:

- **Más del 70% de las implementaciones de ERP no alcanzan su objetivo de negocio** (Gartner);
  solo **~23%** se consideran exitosas; el rango de falla citado es **55-75%**.
- La causa **no es el software**: **60-70%** de los colapsos son organizacionales/humanos, y la
  mala gestión del cambio explica **>42%** de las fallas.
- Brynjolfsson (MIT): **70-80% del gasto en IT se va en activos organizacionales complementarios**.
  En su descomposición del intangible, **el capital de IT es ~10% y los complementos
  organizacionales el ~75%**.

> **El ERP vale 10%. Saber usarlo vale 75%.** Odoo, Oracle y SAP venden el 10% y te dejan solo
> con el 75% (o te cobran consultores por él). **GAIA regala el 75%.**

Nombre técnico: **capacidad de absorción** — la habilidad de usar conocimiento externo depende del
conocimiento previo. Sin economía, las 250 métricas son ruido. Con economía, son la empresa.

**Consecuencia práctica:** nunca hay que anunciar el ERP (nadie ve comerciales de ERP — Ian tampoco).
Se enseña economía, y el ERP viene incluido. **El acceso ES la escuela.**

---

## 2. La transferencia de señal (Spence, 2001) — por qué la química vende contaduría

> *"Si puedo simular moléculas de agua, toda la tabla periódica y agujeros negros — obvio puedo
> llevar tu contaduría."*

Eso es señalización de manual. Una señal solo separa si es **prohibitivamente cara de imitar para
el que no tiene la calidad**. Ningún vendedor de ERP del mundo puede producir química cuántica
ab initio renderizada en 4K. El que resuelve Schrödinger evidentemente puede con un CFDI.

**El canal de química no vende por targeting — vende por transferencia de competencia.** Es el
mejor comercial de ERP jamás hecho, precisamente porque no habla del ERP.

### Corolario que quita presión: **la economía NO tiene que ser viral**
- **Química/física = la SEÑAL** → alcance, credibilidad, farmeo. KPI: vistas, seguidores, guardados.
- **Economía = el COMPLEMENTO** → lo que hace usable a GAIA. KPI: que exista y se entienda.

Que las cápsulas de economía "se fueran a cero" en alcance **deja de ser un problema**: no necesitan
alcance, necesitan **estar ahí cuando el cliente llegue**. El alcance lo trae la química.

---

## 3. La regla que explica el 0: **SIMULAR, no ilustrar**

Experimento real y limpio: cuando el canal pasó de renderizar átomos a la **brújula y la imprenta**,
el alcance **se fue a cero**. Tres lentes Nobel dan la misma respuesta:

- **Spence (2001):** el video de química es una señal **separadora** (casi nadie puede producirla);
  el de la imprenta es **agrupadora** (miles pueden) → no informa nada sobre quién eres.
- **Krugman (2008):** en mercado saturado (divulgación histórica) la diferenciación tiende a 0. En
  nicho vacío (química cuántica hecha cine) hay **rendimientos crecientes**: cada video mejora el
  motor y abarata el siguiente.
- **Akerlof (2001):** el público paga lo **verificable**. En el video del agua llegaron químicos a
  discutir — esa verificación *es* el producto. La brújula no tiene nada que verificar.

> **El foso no es "contenido de ciencia": es SIMULAR UN SISTEMA REAL.**
> Todo lo simulado (átomos, moléculas, campos) funcionó. Todo lo ilustrado (brújula, imprenta) murió.
> La economía no está muerta como tema — está muerta **como ilustración**.

---

## 4. Cómo hacer economía visualmente HERMOSA (el problema real)

Mismo principio que las moléculas: **la belleza EMERGE del cálculo, no se dibuja.** Cambia qué son
las partículas. Tres de las cuatro reusan motores que ya existen en el repo:

1. **Los limones de Akerlof — la nube que se MUERE.** *(reusa `O2Cloud`)* 50,000 agentes como
   partículas; brillantes = coches buenos, opacos = limones. Se corre el modelo real: los buenos
   **abandonan el mercado uno por uno** hasta quedar puro polvo oscuro. Un mercado muriéndose se ve
   como una estrella apagándose — y no es metáfora, es el modelo corriendo.
2. **Emparejamiento (Diamond-Mortensen-Pissarides, 2010) — idéntico a "El puente".** *(reusa `wpair`)*
   Dos nubes (trabajadores/vacantes) con fricción real de búsqueda; al emparejarse **se enciende un
   puente**, el mismo visual que el enlace de hidrógeno. Y es literalmente cierto: los dos son
   procesos de emparejamiento.
3. **El dinero como FLUIDO (Leontief, 1973)** *(reusa el motor CFD del estudio Viento)*: la matriz
   insumo-producto REAL de México (INEGI) como campo de flujo — dónde se estanca y dónde se drena.
4. **La red de pagos REAL de GAIA** — +10 millones de pesos de transacciones reales, anonimizadas,
   como una red viva con el dinero viajando como pulsos de luz. *"Esto no es una simulación: es
   dinero real moviéndose por México."* **Foso máximo**: nadie más tiene esa data, y ES la demo del ERP.

---

## 5. La escuela GRATIS y cómo capitalizar sin romperla

**Decisión tomada: la escuela es gratis, sí o sí.** Y hay un modelo probado que la respeta:

**La jugada Autodesk/Fusion.** Autodesk regala a los estudiantes **la versión profesional COMPLETA,
no una recortada**, porque **el estudiante no es el cliente: es el canal.** Aprende → los empleadores
contratan por esa habilidad → las empresas se estandarizan → lock-in por entrenamiento, flujos de
trabajo y formatos. Es exactamente cómo Ian aprendió Fusion antes de que fuera de paga.

**Diseño que preserva la gratuidad (screening por USO, no por capacidad):**
- **Gratis:** aprender + uso académico, con toda la potencia.
- **Se paga:** **uso comercial** (facturarle a un cliente), integración, soporte.
- **Nunca** se cobra por aprender.

**Número honesto que evita un error de plan financiero:** en EdTech la conversión freemium→pago
promedia **~2.6%** (vs ~3.7% del SaaS general). **Convertir estudiantes es mal negocio.** El dinero
de Autodesk no está en el estudiante: está en la empresa que después lo contrata. El canal educativo
es un activo de **2-5 años**, no una fuente de caja de este trimestre.

### Rutas de caja mientras La Forja madura (6 meses)
1. **Facturación SAT (GAIA Prime) — la más rápida:** demanda legalmente obligatoria y recurrente,
   y ya está construida. No necesita marketing masivo: necesita **los primeros 10 clientes**. El
   cuello es confianza, no features → garantía explícita + empezar por la red que ya confía.
   **Palanca clave: el CONTADOR.** Es el guardián de la facturación en México y **uno atiende de 20 a
   50 PyMEs** → convertir un contador ≈ convertir 30 clientes, sin anuncios. Y un contador que aprende
   economía real contigo se vuelve distribuidor, porque le das lo que Odoo/Oracle no: entender.
2. **Costeo/cotización de moldes como SERVICIO (no software):** vender el OUTPUT antes que la
   herramienta ("mándame la pieza → molde dimensionado + costeo en 48h"). Ticket alto, no espera a que
   La Forja termine, y **cada trabajo entrena y valida el producto con un cliente pagando**.
   ⚠️ Tope duro: 2-3 trabajos/mes, o el medio año se vuelve año y medio.
3. **Pipeline de video científico como servicio** (laboratorios, editoriales, EdTech): tómalo si cae,
   no lo persigas — es por proyecto, no recurrente.

---

## 6. La trampa de medir (Holmström, 2016)

El **problema de multitarea**: cuando premias la tarea medible, el esfuerzo se fuga de la no-medible.
Instagram penaliza los links → el canal medible está roto → **optimizar clics produciría videos
click-baity y destruiría la credibilidad científica, que es EL activo.**

**Métricas correctas para el canal:** composición de la audiencia (¿aparecen químicos en comentarios?),
**guardados/likes** (firma de enseñanza: 29-39% en los ganadores), seguidores nuevos por alcance.
**Métrica correcta del negocio:** clientes que facturan con GAIA. Son dos sistemas distintos y **no
deben medirse con la misma vara**.

---

## 7. El plan tal como está hoy

1. **Farmear con química/física hasta ~100k** — señal costosa de imitar, 1 video diario.
   Regla dura: **cada video carga un cálculo real**; el día que salga uno con animación inventada,
   se cae el foso (y la audiencia que verifica es la primera que lo caza).
2. **Entonces revelar el hub** — Ingeniería, Física, Química y Economía. El *"¿a poco no que hacías
   videos de química?"* es el reveal, no una incoherencia: siempre fue un hub.
3. **La economía entra SIMULADA** (§4), nunca ilustrada. No necesita ser viral.
4. **La caja mientras tanto**: contadores + facturación (§5.1), costeo de moldes acotado (§5.2).
5. **La Forja termina** y hereda la audiencia farmeada (la jugada Fusion, a 2-5 años).

### Riesgos que hay que decir en voz alta
- Escuela gratis + farmeo + cero ingreso = un hobby carísimo. **No necesita pivote ni
  especialización: necesita UNA cosa que facture ahora** (ya existe: GAIA Prime).
- El servicio (moldes) puede comerse el tiempo de La Forja. Topes.
- La transferencia de señal (§2) es real pero **lenta**: no esperes que el reel de hoy traiga el
  cliente de mañana.

### Lo que NO sabemos todavía (y hay que medir, Banerjee-Duflo-Kremer 2019)
- ¿Un video de "un negocio real simulado con GAIA" retiene como los de química? **Prueba barata: uno
  solo, medido contra los de química.** Si retiene, se encontró la veta que une contenido y caja.
- ¿Cuántos contadores hacen falta para los primeros 10 clientes? Se sabe intentándolo, no pensándolo.

---

## Fuentes
- Gartner / Panorama / Prosci / Godlan (2025) sobre tasas y causas de falla de ERP:
  [ECI](https://www.ecisolutions.com/blog/the-2-million-mistake-why-70-of-erp-implementations-fail/) ·
  [Godlan](https://godlan.com/erp-implementation-failure-statistics/) ·
  [Prosci](https://www.prosci.com/blog/why-do-erp-implementations-fail)
- Brynjolfsson, Hitt & Yang, *Intangible Assets: Computers and Organizational Capital*, Brookings (2002):
  [PDF](https://www.brookings.edu/wp-content/uploads/2002/01/2002a_bpea_brynjolfsson.pdf) ·
  [Wired for Innovation (ITIF)](https://www2.itif.org/Brynjolfsson.pdf)
- Estrategia educativa de Autodesk y lock-in:
  [Umbrex](https://umbrex.com/resources/company-profiles/autodesk/) ·
  [KoalaGains](https://koalagains.com/stocks/NASDAQ/ADSK/business-and-moat) ·
  [Ondsel](https://ondsel.com/blog/hard-lessons/)
- Benchmarks de conversión freemium (EdTech ~2.6%):
  [Userpilot](https://userpilot.com/blog/freemium-to-premium/) ·
  [First Page Sage](https://firstpagesage.com/seo-blog/saas-freemium-conversion-rates/)
- Catálogo de los 56 Nobel de Economía del repo: `src/economia/nobel-catalog.ts`
