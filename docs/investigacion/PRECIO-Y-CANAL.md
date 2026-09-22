# CÓMO SE COBRA Y POR DÓNDE ENTRA — el canal que ya teníamos

> ian, 2026-09-22: «no venderé a mano, necesitamos un approach automatizado, y en JA-VAZ
> tenemos una amplia base de datos de clientes que nos han comprado… entonces si no cobraremos
> por asiento, ¿cómo cobraremos el sistema?».

## 1 · Lo que hay en la base (medido hoy en gaia_core, ATLAS)

| dato | valor | lectura |
|---|---|---|
| clientes registrados | **21,745** | el activo que no estábamos usando |
| con RFC | **21,480** | son NEGOCIOS, no consumidores sueltos |
| compraron alguna vez | 15,137 | |
| activos 12 meses | **8,701** | |
| activos 3 meses | **2,311** | |
| **≥3 compras en 12 m** | **410** | concentran **$225.2 M de los $233.7 M** del año (96 %) |
| ≥12 compras en 12 m | **76** | el taller que compra cada mes: el cliente ideal del ERP |
| con teléfono capturado | 7,827 de 21,745 | **el cuello de botella real** |
| activos 3 m **con teléfono** | **149** | no se puede automatizar lo que no se puede contactar |
| activos 3 m con correo | 294 | |

**El hallazgo:** no nos falta audiencia, nos falta el teléfono de la audiencia que ya nos compra.
149 contactables contra 2,311 activos es un bug de captura, no un problema de mercado.

## 2 · El canal automatizado que ya poseemos: el documento

Cada nota, remisión y factura que sale del sistema es un contacto que nadie nos puede quitar
(187,102 notas + 14,469 facturas históricas; siguen saliendo todos los días). No depende de
Meta, no tiene costo por mensaje, no lo apaga una política.

**La secuencia, sin una sola llamada:**
1. **Arreglar el dato.** Toda nota/factura nueva pide (o confirma) el WhatsApp del cliente al
   momento de cerrarla. Meta de 30 días: pasar de 149 a 1,500 activos contactables.
2. **El documento como puerta.** El PDF lleva un pie con liga corta: *«Ve lo que te deben y tu
   historial: gaia.mx/tu-cuenta»* — entra con su teléfono, sin contraseña.
3. **La cuenta ya viene llena.** Es lo único que ningún competidor puede copiar: el cliente de
   JA-VAZ entra y **ve SUS compras, SUS saldos y SUS facturas** desde 2020, no una pantalla
   vacía. Alegra y Bind le piden que capture; nosotros se lo damos hecho.
4. **Disparadores, no campañas.** Tercera compra en 90 días → invitación automática. Pidió
   factura dos veces en un mes → invitación al plan. Saldo vencido → la libreta de cobranza.
5. **Los videos alimentan a ESE público**, no al revés: se mandan por el mismo canal, y la
   serie deja de ser el origen del embudo para ser su material de apoyo.

## 3 · Cómo se cobra (nunca por asiento)

Tres razones para matar el asiento: el mercado lo está repreciando (2026), castiga justo lo que
queremos —que metan a toda su gente—, y $500/usuario es 3× el ARPU real de Siigo.

**Se cobra POR NEGOCIO y POR RESULTADO. Usuarios ilimitados siempre.**

| Plan | Precio | Qué incluye | Para quién |
|---|---|---|---|
| **Libreta** | $0 para siempre | cobranza, notas de venta, 10 timbres/mes | el imán y la fuente de datos |
| **Taller** | **$699/mes** | 150 timbres, órdenes de trabajo, inventario de 1 sucursal, cobranza por WhatsApp · timbre extra $3 | los 76 que compran cada mes |
| **Refaccionaria** | **$1,899/mes** | multisucursal, 600 timbres, compras y proveedores, Athena | los 410 recurrentes grandes |
| **Consumo** | $0 fijo + **$8 por timbre** + $3 por orden cerrada | todo lo del Taller, sin piso | el que factura poco y odia mensualidades |

**Y el que de verdad escala: CANAL.** JA-VAZ paga **$249/mes por taller activo conectado** y se
lo regala a sus clientes. El taller opera gratis; JA-VAZ compra lealtad y ve la demanda real de
refacciones antes que nadie; GAIA factura por taller conectado y entra a cientos de negocios
con una sola venta. **100 talleres = $24,900/mes.** Es el mismo modelo con el que Clip y
Mercado Pago regalan la terminal: el que gana con el flujo paga la herramienta.

**Aritmética sobre la base propia, sin vender a mano:**
- 410 recurrentes × 25 % de adopción × $699 = **$71,600/mes**
- o 300 talleres conectados por JA-VAZ × $249 = **$74,700/mes**
- Ambas cosas juntas, si funcionan: ~$146,000/mes de MRR con **cero** adquisición pagada.

## 4 · Por qué este precio aguanta la comparación

No competimos con el facturador (Alegra $249, Siigo ~$169, el SAT gratis): **ahí regalamos**.
Cobramos arriba, donde ellos no están: órdenes de trabajo, inventario por sucursal, cobranza y
el historial que ya traemos cargado. El que solo quiere timbrar se queda en Libreta y nos deja
su dato; el que opera un taller paga $699 porque le ahorra un día de trabajo al mes.

## 5 · Lo que hay que construir para poder cobrar así (en este orden)

1. **Captura de teléfono en el cierre de nota** (1 campo, sin lo cual nada de arriba existe).
2. **Entrar con teléfono, sin contraseña**, y ver tu historial (la cuenta pre-llena).
3. **Medidor de timbres y órdenes** por negocio → es lo que se factura.
4. **Cobro** por negocio y por consumo en Stripe (hoy es suscripción personal, no multi-negocio).
5. **Panel de canal** para JA-VAZ: talleres conectados y activos del mes.

Sin el punto 1 y el 2, los demás no sirven: el modelo entero se sostiene en que el cliente
entre y **vea lo suyo** el primer día.
