# EL MUNDO 2026 — qué cambió afuera que nos cambia el plan

**Fecha de corte: 22 de septiembre de 2026.** Analista de entorno, GAIA PRIME.
Regla: cada fuerza = qué pasó (fuente + fecha) → qué significa → qué decisión cambia.
Lo que no pude verificar con fuente 2025-2026 va marcado **⚠ no verificado**.

---

## 1. El precio por asiento se está muriendo — y nosotros cobramos por asiento

**Qué pasó.** Febrero 2026: el "SaaSpocalypse" borró ~285 mil millones de USD de valuaciones SaaS
en 48 horas, con la tesis explícita de que nadie pagará $50-200 por asiento/mes por software rígido
([Taskade, 2026](https://www.taskade.com/blog/saaspocalypse-explained); [Oliver Wyman, abr-2026](https://www.oliverwyman.com/our-expertise/insights/2026/apr/how-agentic-ai-reshaping-saas-valuations.html)).
El precio por asiento cayó de 21 % a 15 % de las empresas SaaS en 12 meses; los modelos híbridos
subieron de 27 % a 41 %. Zendesk cobra **$1.50 USD por resolución automatizada**; SAP está moviéndose
a cobrar por *trabajo hecho* (reconciliaciones autónomas) y no por contadores conectados
([Deloitte, 4-jun-2026](https://dart.deloitte.com/USDART/home/publications/deloitte/industry/technology/accounting-outcome-based-pricing-agentic-ai); [ERP Today, 2026](https://erp.today/sap-ai-pricing-outcome-based-erp-economics/)).

**Qué significa.** `$500/usuario/mes` es exactamente la estructura que el mercado está repreciando.
Además invita al cliente a comprar 1 licencia y compartirla.

**Decisión que cambia.** Reempaquetar el precio del ERP a **por resultado medible**: por CFDI timbrado,
por orden de trabajo cerrada, por conciliación hecha — con piso mensual. Nunca "por usuario".

## 2. El código ya no es el foso; el cumplimiento sí

**Qué pasó.** Los agentes de código tiraron el costo de construir software; los que menos sufrieron el
repricing fueron los *sistemas de registro verticales* — "nadie vibe-codea el cumplimiento de una farmacia
ni la facturación de una clínica" ([MarTech, 2026](https://martech.org/vibe-coding-is-hollowing-out-the-martech-stack-fast/); [Boilerplate Hub, 2026](https://boilerplatehub.com/blog/vertical-saas-after-saaspocalypse)).
En paralelo el SAT endureció: la nueva fracción IX del art. 29-A del CFF declara **falso** un CFDI que no
ampare una operación real; RMF 2026 trae nuevas reglas de cancelación y requisitos a PAC; complemento de
hidrocarburos obligatorio desde el **24-abr-2026**; nuevas validaciones de nómina desde el **1-ene-2026**
([Sovos, 2026](https://sovos.com/mx/blog/iva/rmf-2026-cambios-cfdi/); [El Imparcial, 25-may-2026](https://www.elimparcial.com/tij/columnas/2026/05/25/fiscalizacion-digital-2026-el-sat-endurece-el-control-sobre-cfdi-y-materialidad-fiscal/)).
**No existe CFDI 5.0**: la única versión vigente sigue siendo 4.0 ([Alegra, 2026](https://blog.alegra.com/mexico/cfdi-5-0/)).

**Qué significa.** Nuestras features genéricas (inventario, analítica, UI) las clona cualquiera en un fin
de semana. Lo que no se clona es timbrado, cancelación, materialidad y el expediente que aguanta revisión.

**Decisión que cambia.** Dejar de invertir horas en features bonitas; invertir en **cumplimiento como producto**
(timbrado, cancelación 2026, evidencia de materialidad). Ese es el activo defendible.

## 3. Reforma fiscal 2026 a plataformas: un dolor nuevo, fechado y con nombre

**Qué pasó.** Desde el **1-ene-2026** las plataformas digitales retienen **2.5 % de ISR** en venta de bienes
y servicios (antes 1 %), 2.1 % en transporte/entrega, 4 % en hospedaje, y **20 % si no hay RFC**; IVA retenido
8 % con RFC y 16 % sin él. El SAT puede exigir acceso en línea y en tiempo real a la información de la
plataforma, y suspender el servicio de quien no cumpla
([gigstack, 2026](https://blog.gigstack.pro/post/reforma-fiscal-2026-plataformas-digitales-retenciones-isr-iva-mexico); [Mercado Pago, 2026](https://www.mercadopago.com.mx/blog/nuevas-retenciones-ventas-en-plataformas)).

**Qué significa.** Decenas de miles de vendedores chicos amanecieron con dinero retenido que **es acreditable
pero solo si lo saben reclamar**. Es dolor con fecha, con monto y con culpable.

**Decisión que cambia.** El gancho del ERP deja de ser "factura fácil" (commodity) y pasa a ser
**"recupera tus retenciones de plataforma"**. Un capítulo de Don Chuy sobre esto, y la calculadora de
retenciones como segunda herramienta gratuita.

## 4. WhatsApp deja de ser gratis para bots el 1-oct-2026 — en 9 días

**Qué pasó.** Documentación oficial de Meta: desde el **1-oct-2026** los *service messages* (respuestas
no-plantilla dentro de la ventana de 24 h, incluidas las de tu bot) **se cobran por mensaje**, sin escalones
por volumen; las plantillas *utility* dentro de la ventana, gratis desde jul-2025, **también se cobran**.
El Meta Business Agent ya se cobra desde el **1-ago-2026** a **$2.00 USD por millón de tokens**
([Meta for Developers](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages)).
Tarifa base México: utility **$0.0080 USD/msg**, marketing $0.0436, autenticación $0.0207, más markup del
BSP de $0.003-0.010 ([ominiflow, 2026](https://ominiflow.com/whatsapp-api-pricing/mexico)).
⚠ no verificado: el "colchón de 1,000 mensajes de servicio gratis al mes" lo repiten varios BSP
([SendPulse](https://sendpulse.com/blog/whatsapp-service-message-pricing)), pero **la doc de Meta no lo menciona**.

**Qué significa.** El tramo DM → WhatsApp del embudo pasa de costo cero a costo marginal por conversación,
justo cuando el MRR es ~0.

**Decisión que cambia.** No montar el embudo sobre la **API** de WhatsApp todavía: quedarse en **DM de Instagram**
(gratis) y en la **app gratuita de WhatsApp Business** (que no entra en este cobro). Si algún día se usa API,
presupuestar costo-por-lead antes de encenderla.

## 5. Pagar por alcance se encareció; el algoritmo premia justo nuestro embudo

**Qué pasó.** CPM de Meta +20 % interanual ($11.82 → $14.19) y **CPA +38 %** ($27.66 → $38.19)
([get-ryze, 2026](https://www.get-ryze.ai/blog/cost-per-acquisition-benchmarks-2026); [Triple Whale, 2026](https://www.triplewhale.com/blog/facebook-ads-benchmarks)).
Mosseri confirmó el orden de ranking en 2026: **tiempo visto → envíos por alcance (sends) → likes por alcance**;
los envíos son el mejor predictor de retención a 6 meses ([Socialync, 2026](https://www.socialync.io/blog/adam-mosseri-shares-instagram-algorithm-2026)).
Contenido original recibe 40-60 % más distribución que reposts; 10+ reposts en 30 días = fuera de recomendaciones
([SocialPilot, 2026](https://www.socialpilot.co/blog/instagram-instagram-reels-algorithm)).
⚠ no verificado: el múltiplo exacto "un send pesa 3-5× un like" sale de blogs, no de Meta.

**Qué significa.** Comprar tráfico para un producto sin MRR es tirar dinero; y nuestro CTA natural
("mándaselo a tu compa") es a la vez el motor de alcance y la puerta del embudo.

**Decisión que cambia.** Cero anuncios pagados este trimestre. **KPI #1 = sends/alcance**, no likes ni views.
Cada capítulo de Don Chuy cierra pidiendo el envío por DM a una persona concreta ("mándaselo al de la tienda").

## 6. La audiencia no es el mercado (y Argentina está en contracción)

**Qué pasó.** 43 % de nuestra audiencia es argentina, 15 % chilena, 15 % colombiana, 15 % mexicana — y el ERP
solo habla CFDI. En Argentina las **ventas minoristas pyme acumulan -2.4 % en 2026** (agosto -0.2 % i.a.,
julio -3.6 %), con pérdida de poder adquisitivo y endeudamiento familiar como causas
([CAME vía BAE Negocios, 6-sep-2026](https://www.baenegocios.com/economia/las-ventas-minoristas-volvieron-a-caer-en-agosto-y-acumulan-una-baja-del-2-4-en-2026-2172/)).
Inflación acumulada ene-jul 16.8 % (INDEC, vía la actualización del monotributo de ARCA de agosto-2026,
[Perfil](https://www.perfil.com/noticias/economia/arca-publico-nueva-tabla-monotributo-cuales-escalas-topes-cuotas-desde-agosto-2026-a40.phtml)).
ARCA amplía la factura electrónica con la **RG 5866/2026**, con cronograma 1-jul-2026 → 1-mar-2027
([El Economista, 2026](https://eleconomista.com.ar/economia/arca-cambia-factura-electronica-deberan-hacer-contribuyentes-cuando-n97500)).
⚠ no verificado: que los **monotributistas** queden obligados desde el 1-nov-2026 (aparece en resúmenes,
no en la nota que pude leer del cronograma oficial).
Dato de contraste: el canal online de esos mismos comercios argentinos creció **+17.6 % i.a.**

**Qué significa.** El 73 % de la audiencia vive donde el producto no aplica, y donde el comercio se está
encogiendo. La única parte del embudo que sí es exportable es la **libreta del fiado** (no tiene fiscal).

**Decisión que cambia.** Separar el negocio en dos: **libreta gratis multinacional** (fiado, caja, recordatorio
por WhatsApp — sirve en AR/CL/CO/MX) como imán y medidor; y **ERP solo-México**, cuya adquisición deja de
depender de la serie y pasa a depender de contadores y de vendedores en plataformas. No forzar a la audiencia
argentina hacia el CFDI.

## 7. El piso de precio de "libreta + factura" en LATAM ya está puesto

**Qué pasó.** Treinta (7 millones de negocios, 21 países incl. México) cobra **$39,900 COP/mes (~$10 USD)**
el plan app y **$79,900 COP (~$20 USD)** el plan con facturación electrónica ilimitada — y **no tiene plan gratis**
([Treinta, precios 2026](https://treinta.co/planes-y-precios)). Alegra México arranca en **$187 MXN/mes**
(POS $149, ERP $974) con 15 días de prueba ([Alegra](https://www.alegra.com/mexico/precios/)).
El propio **SAT regala el timbrado** para contribuyentes de bajo volumen
([Mercado Pago](https://www.mercadopago.com.mx/blog/programas-gratuitos-facturacion-electronica)).
Mercado Pago y Clip regalan el punto de venta (catálogo, roles, reportes) amarrado al procesamiento de pagos.

**Qué significa.** Nadie está regalando la libreta del fiado *con* factura; pero facturar solo ya es gratis
(SAT) y la capa de POS ya se regala a cambio del flujo de pagos. Nuestro hueco real es angosto y está arriba,
no abajo.

**Decisión que cambia.** No competir con la libreta (ahí se regala o cuesta $10). Usarla como imán y cobrar
arriba: retenciones de plataforma, órdenes de trabajo y analítica — lo que Treinta/Alegra no hacen.

---

## Contexto macro que NO cambia ninguna decisión (va aquí para no volverlo a investigar)

- Banxico mantuvo la tasa en **6.50 %** el 6-ago-2026; inflación estimada ~4.0-4.2 % para el cierre 2026
  ([Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/mexico/banxico-pausa-su-ciclo-de-bajas-y-mantiene-en-7-la-tasa-de-interes/)).
  ⚠ hay fuentes que citan 7 % para 2026; tomar 6.50 % con reserva.
- Remesas: **+3.1 % en el primer semestre 2026** ($30,759 M USD) pese al impuesto de 1 % vigente desde
  el 1-ene-2026; el envío promedio subió 5 % y el número de operaciones bajó 1.8 %
  ([Banxico vía Latinus, 3-ago-2026](https://latinus.us/economia/2026/8/3/remesas-en-mexico-repuntan-un-31-interanual-durante-el-primer-semestre-de-2026-banxico-180606.html)).
- T-MEC: la revisión del 1-jul-2026 **no terminó el tratado**; EEUU no apoyó extenderlo a 2042 y se pasa a
  revisiones anuales hasta 2036. 85 % de las exportaciones mexicanas siguen con arancel cero si certifican origen
  ([Holland & Knight, jul-2026](https://www.hklaw.com/en/insights/publications/2026/07/mexico-ante-una-nueva-etapa-continuidad-del-tmec)).
  Afecta a manufactura exportadora, no a la tiendita de Don Chuy.
- TikTok EEUU sigue operando: el **TikTok USDS Joint Venture LLC** quedó constituido el 22-ene-2026
  (Oracle, Silver Lake y MGX con 15 % cada uno; ByteDance ~20 %)
  ([TechCrunch, 23-ene-2026](https://techcrunch.com/2026/01/23/heres-whats-you-should-know-about-the-us-tiktok-deal/)).
  Conclusión: publicar en TikTok EEUU no es riesgo regulatorio hoy.
- Adopción de IA en PYMES: entre 47 % y 89 % según la definición, pero **solo 17.7 % le paga a un proveedor de IA**
  (JPMorgan Chase Institute, 4.6 M de cuentas) y **8.8 %** la usa en producción (ago-2025)
  ([capsulecrm, 2026](https://capsulecrm.com/blog/small-business-ai-adoption-statistics/)).
  En México, solo **26 %** de las empresas inició transformación digital y de ellas 12 % son PyMEs
  ([CAINTRA](https://www.caintra.org.mx/en/tema-destacado/la-digitalizacion-un-reto-urgente-para-las-pymes-en-mexico-ccm/)).
  Traducción: vender "IA" a la tiendita no vende; vender "que no te multen" sí.

---

## Las 3 que, si son ciertas, nos obligan a cambiar de estrategia

1. **Murió el precio por asiento.** Si es cierto, `$500/usuario/mes` no tiene mercado: hay que reempaquetar
   todo el ERP a precio por resultado antes de firmar el primer cliente, no después.
2. **La audiencia (73 % fuera de México) nunca va a comprar CFDI.** Si es cierto, la serie no es un embudo de
   ventas: es una marca. Entonces o el producto se vuelve multinacional y sin fiscal, o la adquisición del ERP
   se construye aparte (contadores, vendedores de plataformas) y se deja de medir la serie por MRR.
3. **El foso es el cumplimiento, no el código.** Si es cierto, cada hora en features genéricas es una hora
   regalada a quien las clona en un fin de semana; el único activo defendible es timbrado + materialidad +
   retenciones, más el canal.
