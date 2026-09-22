# CÓMO LO HACEMOS — el plan de correo, escrito para alguien que nunca ha vendido

> ian, 2026-09-22: «tenemos correos y tenemos la automatización de los correos… en verdad jamás
> he vendido nada, yo hago el software… ¿cómo lo hacemos?».

## La idea que quita el miedo

**Tú no vas a vender. Vas a ENTREGAR algo que ya es de ellos.** El correo no dice «cómprame»:
dice «te abrimos tu cuenta y adentro están tus compras desde 2020». El que entra y ve sus
propios números se vende solo. Tú nada más contestas a los que respondan.

Eso no es una frase bonita: es la Ley 1 de los Nobel del embudo (Akerlof/Spence/Stiglitz 2001).
Una señal solo convence si al farsante le costaría carísimo imitarla. **Ningún competidor puede
mandar ese correo**, porque nadie más tiene las 187 mil notas de tus clientes.

## Los segmentos (medidos hoy en gaia_core)

| | Quiénes | Total | Con correo | Qué se les manda |
|---|---|---|---|---|
| **A** | te compran **cada mes** (≥12/año) | 76 | **71** | su cuenta, con su historial adentro |
| **B** | recurrentes (3-11/año) | 334 | **172** | lo mismo, una semana después |
| **C** | activos con 1-2 compras | 8,291 | 866 | nada todavía |
| **D** | dormidos (+12 meses sin volver) | 6,437 | **5,247** | otra campaña: volver a comprar, no ERP |

**Se empieza por A: 71 correos.** No es poco: son los 71 negocios que más te compran en México.

## La secuencia (3 correos, 12 días, todo automático)

### Correo 1 — día 0 · «Tu cuenta ya está abierta» (a los 71 de A)
Asunto: **Te abrimos tu cuenta, {Nombre} — ya trae tus compras**

> Hola {Nombre}:
>
> Nos han comprado **{n} veces este año**. Todas esas notas y facturas ya están en un solo
> lugar, y desde hoy usted puede entrar a verlas cuando quiera.
>
> **[Entrar a mi cuenta]** ← no necesita contraseña, el botón lo reconoce
>
> Adentro encuentra: sus compras desde {primer_año}, sus facturas para descargar, y lo que
> quedó pendiente de pago.
>
> Es gratis y no cambia nada de cómo nos compra.
>
> — {Ian}, GAIA PRIME

**Por qué funciona:** no pide nada, entrega algo que ya es suyo, y el dato concreto ({n} veces)
prueba en un renglón que no es publicidad masiva.

### Correo 2 — día 5 · SOLO a quien entró · «¿Y si sus notas salieran de aquí?»
Asunto: **{Nombre}, ¿le pasamos también sus ventas?**

> Ya vio sus compras. Lo mismo sirve para lo que usted vende: notas, facturas al SAT,
> qué le deben sus clientes y de qué se le está acabando.
>
> **60 días sin costo.** Si le sirve, son $699 al mes por el negocio completo, con toda su
> gente adentro, sin cobrar por usuario.
>
> **[Quiero probarlo]** · ¿Dudas? Conteste este correo, lo lee una persona.

### Correo 3 — día 12 · SOLO a quien NO abrió · una sola línea
Asunto: **Sus facturas, en un solo lugar**

> {Nombre}: le dejamos sus compras y facturas aquí, por si le sirve. **[Entrar]**

## Lo que hay que construir (y no es un ERP nuevo)

| # | Qué | Por qué sin esto no hay correo | Dónde |
|---|---|---|---|
| 1 | **Entrar con liga mágica** (sin contraseña) | el correo entero se sostiene en ese botón | `university-api` ya tiene magic-link; se apunta a `clients` |
| 2 | **Portal del cliente, solo lectura**: sus compras, sus facturas, su saldo | es lo que se entrega | `modules/mercuria` ya tiene los datos; falta la vista |
| 3 | **Envío + medición** (abrió, entró, volvió) | sin medir, no se sabe si funcionó | `modules/mercuria/emails.py` + Resend, ya configurado |
| 4 | Medidor de timbres/órdenes por negocio | es lo que se cobra en el plan Taller | después del correo 2 |

**Semana 1:** 1 y 2. **Semana 2:** el correo 1 a los 71. **Semana 3:** correos 2 y 3, y se mide.

## Qué esperar, con números honestos

- Correos a A: **71**. Abren (clientes activos, asunto con su nombre): 40-60 % → **~35**.
- Entran a la cuenta: la mitad de los que abren → **~18**.
- Prueban el plan Taller: 20-30 % de los que entran → **4-5 pruebas**.
- Pagan después de 60 días: la mitad → **2-3 clientes** = **$1,400-2,100/mes** de MRR.

Parece poco y es todo lo contrario: **son los primeros pesos**, salen de 71 correos, y luego se
repite con los 172 de B, con los 866 de C y con el canal de JA-VAZ. La misma máquina, más lista.

## La regla para que no se rompa

Una sola campaña a la vez, y **nunca** a los 21 mil. Un correo a quien no te compra hace un año
es spam; a los 71 que te compran cada mes es servicio. Si el correo 1 no llega a 25 % de
entradas, no se manda el siguiente: se arregla el correo.
