# META, paso a paso: la parte de Meta del embudo de GAIA

> Verificado contra la documentación de Meta el **22 de septiembre de 2026**.
> Junto a cada fuente va la fecha «Updated» que mostraba esa página de Meta ese día.
>
> Cómo leer esta guía:
> - **Fuente:** = Meta lo dice en esa página. Si la pantalla no coincide, abre la fuente: ahí está la versión vigente.
> - **⚠ no verificado:** = no lo encontré escrito por Meta. Te digo qué buscar si no coincide.
> - La interfaz a veces sale en inglés: el nombre en inglés va entre paréntesis y en *cursiva*.
> - Las casillas `- [ ]` son para ir palomeando.

---

## 1. Qué necesitamos y por qué (5 renglones)

1. Hoy la API no nos deja ver los comentarios ni los DMs de la gente: solo los de quien tiene «rol» en nuestra app.
2. Pasa porque la app está en **modo Desarrollo**: Meta esconde lo que generan las personas sin rol.
3. La app vieja «GAIA» no se puede publicar (8 casos de uso de anuncios a medias, y Meta no deja quitarlos). Se queda como está.
4. Hacemos una **app nueva, solo con Instagram**, la pasamos a **Activo** y volvemos a iniciar sesión con @gaiaprime_mx.
5. En paralelo **verificamos el negocio** (EQUIPO AUTOMOTRIZ JA-VAZ): tarda hasta 14 días hábiles y es la red de seguridad (y sirve para WhatsApp).

Fuentes:
- Modo Desarrollo: «Any data generated while an app is in Development mode, such as test posts, can only be seen by role users.» → https://developers.facebook.com/documentation/development/build-and-test/app-modes (Updated May 5, 2025)
- Casos de uso: «Use cases cannot be removed after you create your app.» → https://developers.facebook.com/documentation/development/create-an-app (Updated Sep 16, 2025)

---

## La respuesta corta (léela antes que nada)

**¿Para leer y contestar comentarios y DMs en NUESTRA propia cuenta hace falta App Review o verificación del negocio?**

- **Según Meta, no.** Su tabla oficial dice, textual:
  «My app is only for a business I own or manage. | No login or Instagram Login | **Standard Access** | App Review: **Not required**».
  Fuente: https://developers.facebook.com/documentation/instagram-platform/app-review (Updated Jun 30, 2026)
- «If your app only serves your Instagram professional account or an account you manage, **Standard Access is all your app needs**.»
  Fuente: https://developers.facebook.com/documentation/instagram-platform/overview (Updated Sep 16, 2026)
- La verificación del negocio es para **Advanced Access** (apps que atienden cuentas ajenas): «This access level requires App Review and Business Verification.» Misma fuente.
- **Lo que sí hace falta:** sacar la app de Desarrollo (botón «Publicar» → Activo). Eso no pide App Review.

**Dos dudas que solo el panel de Meta resuelve** (por eso la verificación arranca HOY, en paralelo):

1. Meta se contradice en si «Publicar» exige negocio verificado:
   - Guía de Instagram (May 14, 2025): «You're required to connect your app to a business that has completed Business Verification before you can publish your app.» → https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app
   - Configuración básica (Oct 18, 2023): «Si bien la verificación no es necesaria para activar tu app, no podrás acceder a los datos que no te pertenecen hasta que se haya completado la verificación.» → https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings
2. Meta avisa que con Standard Access «Some features may not work properly until your app has been granted Advanced Access.» → https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api (Updated May 6, 2026)
   Si ya en Activo la API sigue en 0, vamos al **Plan B** (sección 5.3): App Review, que sí exige verificación.

**Webhooks (avisos en tiempo real):** esos sí exigen Activo + Advanced Access + verificación («Advanced Access is required to receive `comments` and `live_comments` webhook notifications»; tabla «Business Verification: Required»). Fuente: https://developers.facebook.com/documentation/instagram-platform/webhooks (Updated Sep 16, 2026).
Nuestro código **no usa webhooks**: pregunta a la API cada 5 minutos. Por eso no nos frenan.

---

## 2. Verificación del portafolio de negocio (arráncala hoy)

Tiempo: 20 a 30 min para llenar (estimado nuestro) + **hasta 14 días hábiles** de Meta (oficial).

### 2.1 Antes de empezar

- [ ] Tener **control total** del portafolio «Gaia Prime». Si no puedes entrar al Centro de seguridad, no lo tienes.
  Fuente: https://www.facebook.com/business/help/2058515294227817
- [ ] Un documento que pruebe el **nombre legal** (uno basta; sube el más claro). Meta acepta:
  - «Certificado de constitución/estatutos de la sociedad» → tu **acta constitutiva**.
  - «Registro o licencia del negocio».
  - «Documento fiscal oficial del negocio: puede incluir un certificado fiscal. **No se aceptan los documentos fiscales presentados por el propio negocio**.»
  - «Extracto bancario del negocio» → estado de cuenta a nombre de la empresa.
  - «Factura de servicios públicos» → **solo** para dirección y teléfono, con el nombre legal impreso. No sirve para el nombre.
  - Deben estar vigentes, emitidos por la autoridad, y el español es idioma aceptado. Tapa datos personales que no hagan falta.
  Fuente: https://www.facebook.com/business/help/159334372093366
- ⚠ no verificado: Meta no menciona la **Constancia de Situación Fiscal (CSF)** por nombre. La emite el SAT (autoridad), así que encaja en «certificado fiscal». La **declaración anual NO** sirve (la presenta el propio negocio). Si rechazan la CSF, sube el acta constitutiva.
- [ ] El sitio debe cargar con **https**: https://gaiaprime.com.mx (respondió bien el 22-sep). Meta rechaza si el sitio no carga, no es HTTPS o lleva a una página de error.
  Fuente: https://www.facebook.com/business/help/2342133782492969

### 2.2 El nombre: «Gaia Prime» contra «EQUIPO AUTOMOTRIZ JA-VAZ»

- En el formulario va el **nombre legal**, idéntico a tu CSF o acta. Meta: «Verifica que los detalles que ingreses coincidan exactamente con la información de tu entidad comercial legal.»
  Fuente: https://www.facebook.com/business/help/2058515294227817
- El portafolio puede seguir llamándose «Gaia Prime». ⚠ no verificado: no encontré una página de Meta que exija que el nombre del portafolio sea el legal. Si al enviar te marca discrepancia, busca «Información del negocio» (*Business info*) en la configuración del portafolio.
- Recomendado (baja el riesgo de rechazo): que el pie de gaiaprime.com.mx diga «GAIA Prime es una marca de EQUIPO AUTOMOTRIZ JA-VAZ». Para WhatsApp, Meta lo pide textual: el nombre visible «debe tener una relación evidente con el nombre legal de tu empresa» y ser coherente «con fuentes externas, como el sitio web». Fuente: https://www.facebook.com/business/help/757569725593362
- **Hallazgo nuestro:** el aviso de privacidad publicado hoy nombra como Responsable a «Sebastián Vázquez Andrade», no a la persona moral. Conviene alinearlo antes de enviar. Lo cambiamos nosotros cuando lo autorices.

### 2.3 Pasos

- [ ] **Entra a:** https://business.facebook.com/latest/settings/security_center → «Centro de seguridad» (*Security Center*).
  - Arriba, en el selector de portafolios, elige **Gaia Prime** (id 1011228924697309).
  - Atajo ⚠ no verificado (el parámetro no está documentado): https://business.facebook.com/latest/settings/security_center?business_id=1011228924697309
- [ ] **Botón:** «Iniciar verificación» (*Start verification*).
  - Si ves «No cumple los requisitos para la verificación» (*Ineligible for verification*): Meta dice que te la pedirá «desde una plataforma diferente». Para nosotros sería el panel de la app. ⚠ no verificado dónde exactamente: Meta lo documenta en «Revisión > Verificación» (*Review > Verification*) y, en una página de 2023, en «Configuración > Básica > Verificación» (*Settings > Basic > Verification*).
- [ ] Escribe nombre legal, dirección (C.P. 15000, CDMX), teléfono y sitio web (`https://gaiaprime.com.mx`).
- [ ] Confirma los datos. Si no encuentra tu empresa: «Mi negocio no aparece» (*My business isn't listed*) o «Ninguno coincide» (*None of these match*) → sube el documento de 2.1.
- [ ] Elige cómo confirmar: **correo, teléfono, mensaje de texto, mensaje de WhatsApp o verificación de dominio**.
  - Sugerido: correo **contacto@gaiaprime.com.mx** (mismo dominio que el sitio). Meta avisa que con correo «es posible que se te solicite que presentes pruebas de propiedad del dominio». Fuente: https://www.facebook.com/business/help/159334372093366
  - Verificación de dominio (la más sólida):
    - [ ] Entra a https://business.facebook.com/settings/owned-domains («Dominios», en «Seguridad de la marca»).
    - [ ] «+ Agregar» → «Crear un dominio» → escribe `gaiaprime.com.mx` (sin `www` ni `https`) → «Agregar».
    - [ ] Elige «Actualizar el registro TXT de DNS con tu registro de dominio», copia el TXT y pégalo en tu DNS.
    - [ ] «Verificar dominio».
    Fuente: https://www.facebook.com/business/help/321167023127050
- [ ] Confirma y clic en **«Listo»** (*Done*).

**Sabes que salió si:** ves un mensaje de que Meta recibió tu solicitud. El estado se consulta en el mismo Centro de seguridad.
Fuente: https://www.facebook.com/business/help/863987813384785

**Cuánto tarda:** «Las decisiones sobre las solicitudes de verificación pueden demorar hasta 14 días laborables.» Fuente: https://www.facebook.com/business/help/2058515294227817

**Si la rechazan:**
- Motivos que Meta lista: información falsa o engañosa, reclamar un negocio que no representas, eludir la revisión, sitio que no carga / sin HTTPS / con enlace a error.
- «Es posible que cumplas con los requisitos para presentar una apelación»: se ve en el Centro de seguridad.
- Fuente: https://www.facebook.com/business/help/2342133782492969
- Ojo: «Si editas la información de tu negocio, deberás completar el proceso de verificación nuevamente.» Decide los datos una sola vez.

---

## 3. Crear la app nueva, solo con Instagram

### 3.1 Crear

- [ ] **Entra a:** https://developers.facebook.com/apps/creation/
- [ ] «Detalles de la app» (*App details*): nombre y correo de contacto → «Siguiente» (*Next*).
  - Nombre sugerido: **GAIA Libreta**. No uses «Instagram», «IG», «Facebook» ni «FB» en el nombre: Meta lo rechaza.
    Fuente: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings
- [ ] «Casos de uso» (*Use cases*): elige **solo** «Administrar mensajes y contenido en Instagram» (*Manage messaging & content on Instagram*) → «Siguiente».
  - Uno solo, porque los casos de uso no se pueden quitar después (fue lo que atoró a la app vieja).
  - ⚠ Si no aparece con ese nombre: busca «Instagram» en esa pantalla. La guía vieja de Meta (May 14, 2025) da otro camino: «Otro» (*Other*) → tipo «Empresa» (*Business*) → en el panel, producto «Instagram» → «Configurar» (*Set up*). Los dos caminos terminan en la misma sección (3.2).
- [ ] Negocio (*Business*): «Un portfolio comercial no verificado» (*An unverified business portfolio*) → **Gaia Prime** → «Siguiente». Meta permite ligar un portafolio sin verificar.
- [ ] «Requisitos» (*Requirements*) → «Siguiente».
- [ ] «Información general» (*Overview*) → «Ir al panel» (*Go to dashboard*).

**Sabes que salió si:** estás en el panel de la app nueva y en «Panel» (*Dashboard*) aparece un solo caso de uso, el de Instagram.
Fuente: https://developers.facebook.com/documentation/development/create-an-app (Updated Sep 16, 2025)

### 3.2 «Configuración de la API con inicio de sesión con Instagram» (*API setup with Instagram login*)

Fuente de toda esta sección: https://developers.facebook.com/documentation/development/create-an-app/instagram-use-case (Updated Mar 15, 2026)

- [ ] En «Panel», clic en «Personalizar el caso de uso de administración de mensajes y contenido en Instagram» (*Customize the Manage messaging and content on Instagram use case*).
- [ ] Menú izquierdo: «Configuración de la API con inicio de sesión con Instagram».
- [ ] Ahí están el **«identificador de la app de Instagram»** (*Instagram app ID*) y la **«clave secreta de la app de Instagram»** (*Instagram app secret*). Esos dos pide nuestro comando.
  - No confundir con el identificador de la app de Meta que sale arriba del panel. Meta: las apps con inicio de sesión de Instagram usan «the Instagram app ID displayed on the Instagram > API setup with Instagram login section». Fuente: https://developers.facebook.com/documentation/instagram-platform/overview
- [ ] Clic en «Agregar todos los permisos necesarios» (*Add all required permissions*).
- [ ] Menú «Permisos y funciones» (*Permissions and features*): confirma que estén los 5 que pide nuestro login:
  `instagram_business_basic`, `instagram_business_content_publish`, `instagram_business_manage_comments`, `instagram_business_manage_insights`, `instagram_business_manage_messages`. Agrega los que falten.
  - ⚠ no verificado: si falta uno, el login puede fallar con un error de «scope». Si pasa, regresa aquí.

### 3.3 La cuenta como evaluador de Instagram (*Instagram tester*)

- [ ] Sección «Generar tokens de acceso» (*Generate access tokens*) → «Agregar cuenta» (*Add account*) → «Continuar» (*Continue*) → inicia sesión como **@gaiaprime_mx** → «Guardar» (*Save*) → «De acuerdo» (*Got it*).
- La cuenta debe ser **pública**. Se puede ver o quitar también en «Roles de la app > Roles» (*App Roles > Roles*).
  Fuente: https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app (paso 7)

**Sabes que salió si:** @gaiaprime_mx aparece en la lista de «Generar tokens de acceso».

- ⚠ no verificado: la documentación vigente no menciona aceptar ninguna invitación. Si en «Roles de la app > Roles» la cuenta aparece «Pendiente» (*Pending*): entra con @gaiaprime_mx a https://www.instagram.com/accounts/manage_access/ → «Invitaciones de evaluador» (*Tester invites*) → «Aceptar» (*Accept*). Ese camino viene de la API vieja (Basic Display) y de foros, no de una página vigente de Meta.
- **No** agregues tu cuenta personal como evaluador: echaría a perder la prueba del paso 8.

### 3.4 La URI de redirección

- [ ] Sección «Configurar inicio de sesión de empresa de Instagram» (*Set up Instagram business login*) → «Configurar» (*Set up*).
- [ ] En «URL de redireccionamiento» (*Redirect URL*) pega exacto: `https://university.gaiaprime.com.mx/ig-oauth/` → «Guardar» (*Save*).
- [ ] Clic en «Configuración de inicio de sesión del negocio» (*Business login settings*). En «URI de redireccionamiento de OAuth» (*OAuth redirect URIs*) debe estar esa misma URL, **con la diagonal final**.
  Meta: «Make sure this exactly matches one of the base URIs… the App Dashboard might have added a trailing slash.»
  Fuente: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login (Updated Mar 13, 2026)
- [ ] En esa ventana también están «URL de devolución de llamada para autorización cancelada» (*Deauthorize callback URL*) y «URL de solicitud de eliminación de datos» (*Data deletion request URL*).
  - ⚠ no verificado: si el panel no deja guardar sin ellas, pon `https://university.gaiaprime.com.mx/privacidad.html` en las dos. Meta las describe como direcciones que «llaman» a nuestro servidor, y hoy no tenemos ese servicio. Si no las exige, déjalas vacías.
- **Sáltate** «Configurar webhooks»: no los usamos.
- **Sáltate** «Completar la revisión de la app»: Meta dice «Solo se requiere si creas soluciones para clientes.» (misma fuente de 3.2).

---

## 4. Configuración básica

- [ ] **Entra a:** menú izquierdo «Configuración de la app > Básica» (*App settings > Basic*).
- [ ] Llena lo que Meta marca como necesario para pasar a modo activo:
  - [ ] «Nombre visible» (*Display Name*).
  - [ ] «Correo electrónico de contacto» (*Contact Email*): contacto@gaiaprime.com.mx
  - [ ] «URL de la política de privacidad» (*Privacy Policy URL*): https://university.gaiaprime.com.mx/privacidad.html
  - [ ] «URL de las Condiciones del servicio» (*Terms of Service URL*): https://university.gaiaprime.com.mx/terminos.html
  - [ ] «Eliminación de datos de usuarios» (*User Data Deletion*): la URL de instrucciones → https://university.gaiaprime.com.mx/privacidad.html
    - Meta: esa URL «puede ser la sección relevante de la política de privacidad», y «Developers need to specify either a data deletion callback instruction URL or a callback URL». Nuestro aviso ya explica cómo pedir la cancelación de datos (derechos ARCO) a privacidad@gaiaprime.com.mx.
    - Fuente: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback
  - [ ] «Ícono de la app» (*App Icon*): 1024 × 1024, **sin** logos de Instagram, Facebook ni WhatsApp.
    Fuente del tamaño: https://developers.facebook.com/documentation/instagram-platform/app-review
  - [ ] «Categoría» (*Category*): «Negocio y páginas» (*Business and Pages*).
    Fuente: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/app-categories
  - [ ] «Propósito de la app» (*App Purpose*). ⚠ Meta lo lista en una página de 2023; si el campo no aparece, ignóralo.
- [ ] Guarda. ⚠ no verificado el nombre exacto del botón («Guardar cambios» / *Save changes*).

Fuente de la lista: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings (Updated Oct 18, 2023: la más vieja de esta guía; manda lo que pida el panel).

**Sabes que salió si:** al entrar a «Publicar» (paso 5) no te regresa a completar la configuración.

Recomendado (no bloquea): que el aviso de privacidad mencione Instagram (leemos los comentarios y mensajes que nos mandan) y a EQUIPO AUTOMOTRIZ JA-VAZ.

---

## 5. Poner la app en Activo (*Live*)

### 5.1 Lo que dice Meta, con citas

| Tema | Qué dice Meta | Fuente (Updated) |
|---|---|---|
| App Review para tu propia cuenta | «My app is only for a business I own or manage \| Instagram Login \| Standard Access \| **Not required**» | [app-review](https://developers.facebook.com/documentation/instagram-platform/app-review) (Jun 30, 2026) |
| Nivel de acceso | «If your app only serves your Instagram professional account or an account you manage, Standard Access is all your app needs.» | [overview](https://developers.facebook.com/documentation/instagram-platform/overview) (Sep 16, 2026) |
| Verificación | «You must complete Business Verification if your app requires Advanced Access; if your app will be used by app users who do not have a Role on the app itself…» | [overview](https://developers.facebook.com/documentation/instagram-platform/overview) (Sep 16, 2026) |
| Mensajes | «Standard Access if your app serves Instagram professional accounts you own or manage… Some features may not work properly until your app has been granted Advanced Access» | [messaging-api](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api) (May 6, 2026) |
| Conversaciones y comentarios | «Standard Access if your app serves Instagram professional accounts you own or manage and have added to your app in the App Dashboard» | [conversations-api](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/conversations-api) (Jul 31, 2024) · [comment-moderation](https://developers.facebook.com/documentation/instagram-platform/comment-moderation) (Jun 2, 2025) |
| Por qué hoy vemos 0 | «Any data generated while an app is in Development mode… can only be seen by role users.» | [app-modes](https://developers.facebook.com/documentation/development/build-and-test/app-modes) (May 5, 2025) |
| Cuándo hay que publicar | «If your app will access content you don't own or manage, or you have implemented a product, such as webhooks, that requires your app to be published» | [instagram-use-case](https://developers.facebook.com/documentation/development/create-an-app/instagram-use-case) (Mar 15, 2026) |
| ¿Publicar pide verificación? | Sí: «You're required to connect your app to a business that has completed Business Verification before you can publish your app.» / No: «Si bien la verificación no es necesaria para activar tu app…» | [create-an-instagram-app](https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app) (May 14, 2025) · [basic-settings](https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings) (Oct 18, 2023) |

**Nuestra lectura:** con Standard Access y la app en Activo debería bastar, sin App Review. Lo que no se puede saber desde afuera: si «Publicar» exigirá la verificación, y si la API entrega los datos de la gente sin rol con Standard Access. Eso lo contesta la prueba del paso 8.

### 5.2 Pasos

- [ ] Menú izquierdo: **«Publicar»** (*Publish*; en algunas versiones *Publish > Go live*).
- [ ] Meta: «Si se requiere alguna configuración de la app, se te indicará que la actualices.» Arregla lo que pida.
- [ ] Revisa los casos de uso y clic en el botón **«Publicar»** abajo (*Publish* / *Go live*).
  Fuentes: https://developers.facebook.com/documentation/development/create-an-app/instagram-use-case y https://developers.facebook.com/documentation/development/release (Updated May 5, 2025)

**Sabes que salió si:** el panel ya no dice «Desarrollo» y marca la app como publicada. ⚠ no verificado: la etiqueta exacta del estado («Activo», «Publicada», *Live*).

- **Si «Publicar» te pide verificación del negocio:** espera el paso 2 y regresa. Todo lo demás ya queda listo.
- **Si «Publicar» sale gris sin decir por qué:** manda la captura de la sección 11.

### 5.3 Plan B: solo si en Activo la API sigue sin ver a la gente

Cuándo: el paso 8 falla con la app Activa, el interruptor prendido y un token sacado después de ambos.

- Requiere: **negocio verificado** + **App Review** para Advanced Access de `instagram_business_manage_comments` e `instagram_business_manage_messages`.
- Dónde: «Configuración de la API con inicio de sesión con Instagram» → flecha de «Completar la revisión de la app» (*Complete app review*) → «Ir a revisión de la app» (*Go to app review*) → te lleva a «Revisión > Solicitudes» (*App Review > Requests*) → «Editar» (*Edit*).
- Te pide: ícono, política de privacidad, categoría; instrucciones para que un revisor de Meta pruebe; por cada permiso, una descripción y un video de pantalla; y al menos una llamada exitosa a la API.
- Ojo: Meta pide «Confirm that your app can be loaded and tested externally» y que el botón de inicio de sesión se vea. Nuestro embudo es un script sin pantalla: habría que armar una página de demostración. Eso lo hacemos nosotros si llegamos aquí.
- ⚠ no verificado: Meta no publica un plazo fijo de App Review en las páginas revisadas.
- Fuente: https://developers.facebook.com/documentation/instagram-platform/app-review (Updated Jun 30, 2026)

---

## 6. Interruptor en la app de Instagram: «Permitir acceso a los mensajes»

En el teléfono, con la sesión de **@gaiaprime_mx**:

- [ ] Ve a tu perfil y toca **«Menú»** arriba a la derecha.
- [ ] «Mensajes y respuestas a historias» (*Messages and story replies*).
- [ ] «Solicitudes de mensajes» (*Message requests*).
- [ ] En «Herramientas conectadas» (*Connected tools*), **activa** «Permitir acceso a los mensajes» (*Allow access to messages*).

**Sabes que salió si:** el botón queda en activado. Meta: «Si activas la opción, cualquier persona que tenga acceso autorizado a… apps de terceros conectadas podrá ver y enviar mensajes desde tu cuenta de Instagram.»
Fuente: https://www.facebook.com/help/instagram/791161338412168 («Administrar el acceso a los mensajes de Instagram en las apps»)

- ⚠ Si no ves «Solicitudes de mensajes», busca «Controles de mensajes» (*Message controls*): así lo describen guías de terceros.
- El 21 de septiembre ya se prendió en @gaiaprime_mx. Solo confirma que siga prendido.

---

## 7. Los comandos (ya existen)

- [ ] **Respaldo primero** (para poder regresar a la app vieja si algo falla al publicar reels):
  ```
  cp ~/.config/gaia-pub/instagram-app.json   ~/.config/gaia-pub/instagram-app.json.antes-app-nueva
  cp ~/.config/gaia-pub/instagram-token.json ~/.config/gaia-pub/instagram-token.json.antes-app-nueva
  ```
  Por qué: `app` y `login` reescriben esos dos archivos, y el publicador de reels usa los mismos. La app vieja en Meta no se toca; lo que cambia es con qué credenciales trabaja esta máquina.

- [ ] Guarda el ID y el secreto de la app nueva:
  ```
  cd ~/Orkesta/la-forja && python3 scripts/subir-instagram.py app
  ```
  - Te pide «Instagram app ID» (solo números) y «Instagram app secret» (no se ve al pegarlo; es normal).
  - **Salió bien si** imprime: `✓ …/.config/gaia-pub/instagram-app.json (app <tu id>) · ahora: subir-instagram.py login`
  - Si imprime `✗ id o secreto raros; no escribo nada`: pegaste el ID de la app de Meta o el secreto incompleto.

- [ ] Inicia sesión (hazlo **después** del paso 5 y del paso 6):
  ```
  cd ~/Orkesta/la-forja && python3 scripts/subir-instagram.py login
  ```
  - Imprime una URL larga de `instagram.com/oauth/authorize`. Ábrela en el navegador con la sesión de **@gaiaprime_mx** (si estás con tu cuenta personal, usa una ventana privada).
  - Acepta los permisos. ⚠ no verifiqué el texto exacto del botón («Permitir» / *Allow*).
  - El navegador te lleva a `https://university.gaiaprime.com.mx/ig-oauth/?code=XXXX#_`. Copia lo que va después de `code=` y pégalo en la terminal. El `#_` no importa: el script lo quita.
  - Meta: el código «is valid for 1 hour and can only be used once». Fuente: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
  - **Salió bien si** imprime: `✓ token de 60 días para @gaiaprime_mx (ig_id …) → …/instagram-token.json`
  - Si sale `Matching code was not found or was already used`: repite `login` con un código nuevo.

- Nota para nosotros: `cola-publicar.py` copia a PRIME el token más nuevo. Desde el siguiente `armar`, PRIME también publicará y contestará con la app nueva.

---

## 8. La prueba de punta a punta

- [ ] **Tú:** desde tu cuenta **personal** de Instagram (que NO sea evaluador de la app nueva), manda un DM a @gaiaprime_mx que diga **LIBRETA**. Avísanos.
- [ ] **Nosotros:**
  ```
  cd ~/Orkesta/la-forja && python3 scripts/dm-libreta.py estado
  ```
  Solo lee. No manda nada, ni aquí ni en Meta.

**Salió bien si:**
- «(a) conversaciones que ve la API:» ya no es 0 y aparece tu @ con `'LIBRETA'`.
- «(d) DMs con la palabra sin atender: 1».

- [ ] **Extra (comentarios):** pide a alguien sin rol en la app que comente LIBRETA en el reel de Don Chuy → «(c) comentarios con la palabra sin atender: 1».

**Si (a) y (c) siguen en 0, revisa en este orden:**
1. ¿La app dice publicada/Activa? (paso 5)
2. ¿El interruptor está prendido? (paso 6)
3. ¿El token se sacó después de 5 y 6? Si no, repite `login`.
4. Si todo sí: Plan B (5.3). Mándanos la salida completa de `estado`.

Reglas de Meta que el script ya respeta:
- DM: solo dentro de 24 h desde el último mensaje de la persona. Fuente: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api
- Respuesta privada a un comentario: una sola y dentro de 7 días. Tope: 750 por hora. Fuentes: https://developers.facebook.com/documentation/instagram-platform/private-replies (Updated Jun 30, 2026) y https://developers.facebook.com/documentation/instagram-platform/overview
- Un DM de alguien que no nos sigue cae en «Solicitudes»; si esa conversación pasa 30 días sin actividad, la API ya no la devuelve. Fuente: conversations-api (arriba).

---

## 9. Fase 2: WhatsApp Business Platform (la API)

Para el re-contacto diario («corte» de la libreta). **No bloquea nada de lo de arriba.**

### 9.1 Qué hace falta

- **Verificación del negocio: no para empezar.** Un portafolio nuevo puede escribir (fuera de la ventana de 24 h) a **250** personas distintas por día. Verificar el negocio lo sube a **2,000**.
  Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
- **Un número que no esté en WhatsApp:** «Numbers already in use with WhatsApp cannot be registered unless they are deleted first.» Debe poder recibir llamada o SMS; celular es lo recomendado.
  Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers
- **Nombre visible** que cumpla reglas: relación evidente con el nombre legal, sin «oficial» ni «verificado», sin marcas de Meta, sin formato de URL o correo, sin promociones.
  Fuente: https://www.facebook.com/business/help/757569725593362
- **Plantillas aprobadas** para escribir fuera de la ventana de 24 h. Revisión: «up to 24 hours».
  Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review
- **Método de pago** en la cuenta de WhatsApp Business (ver 9.4).

### 9.2 El número 55 7363 3622: tres caminos

| Camino | Qué pasa | Fuente |
|---|---|---|
| A. Número nuevo (SIM nueva) solo para la API | Lo más simple. El 55 7363 3622 sigue igual. | phone-numbers (arriba) |
| B. Borrar la cuenta de WhatsApp de ese número y pasarlo a la API | Se pierde el historial; ya no se usa en la app mientras esté en la API. Respalda chats antes. | [migrate-existing-number](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/migrate-existing-whatsapp-number-to-a-business-account) |
| C. Si está en **WhatsApp Business app**: usarlo en la app y en la API a la vez («Coexistence») | Solo entrando «using a partner» que lo soporte; conserva historial; tope de 20 mensajes/seg. | [migrate-existing-number](https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/migrate-existing-whatsapp-number-to-a-business-account) · [coexistence](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users) |

- Si el número está en **WhatsApp normal** (*WhatsApp Messenger*), el camino C no aplica: solo A o B.
- Recomendación: **A**.

### 9.3 Pasos (fase 2)

- [ ] Crea **otra app** (no le agregues WhatsApp a la de Instagram: los casos de uso no se quitan). ⚠ no verifiqué si ambos casos de uso son compatibles en una sola app; separadas no hay duda.
- [ ] **Entra a:** https://developers.facebook.com/apps → «Crear app» (*Create App*) → nombre y correo → caso de uso **«Conectarse con los clientes a través de WhatsApp»** (*Connect with customers through WhatsApp*) → portafolio **Gaia Prime** → «Siguiente» → «Crear app» (*Create app*).
- [ ] Te lleva a «Personalizar caso de uso > Conectar en WhatsApp > Inicio rápido» (*Customize use case > Connect on WhatsApp > Quickstart*) → «Comenzar a usar la API» (*Start using the API*).
- [ ] En «Configuración de la API» (*API Setup*): «Crear una cuenta de WhatsApp Business» (*Create a WhatsApp Business account*) y sigue las instrucciones.
- [ ] Agrega el número (camino A, B o C) y su nombre visible.
- [ ] Token permanente: https://business.facebook.com/latest/settings → «Usuarios del sistema» (*System users*) → «Agregar» (*Add+*) → «Asignar activos» (*Assign Assets*): la app con *Manage app* en control total y la cuenta de WhatsApp con *Manage WhatsApp Business accounts* en control total → «Generar token» (*Generate token*) con `business_management`, `whatsapp_business_messaging`, `whatsapp_business_management`.
  ⚠ no verificado: los nombres en español de estos menús (la guía de Meta los documenta en inglés).
- [ ] El registro final del número para la API (llamada `register`) lo hacemos nosotros.
- [ ] Método de pago en el centro de facturación (*Billing Hub*): https://business.facebook.com/billing_hub/ ⚠ no verificado el nombre en español del menú.
- [ ] Plantillas: https://business.facebook.com/latest/whatsapp_manager/message_templates → crear → esperar «Activa» (*Active*).

Fuente de los pasos: https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started (Updated Jun 16, 2026)

**Sabes que salió si:** en https://business.facebook.com/latest/whatsapp_manager/ → «Herramientas de la cuenta > Números de teléfono» (*Account tools > Phone numbers*) el número dice «Conectado» (*Connected*). ⚠ no verificado el nombre en español del menú.

### 9.4 Costos en México (por MENSAJE, no por conversación)

- Meta ya **no cobra por conversación**: «Effective July 1, 2025, Meta charges on a per-message basis». Cobra cada **plantilla entregada**, según su categoría y el país del número que la recibe.
- Hoy los mensajes normales (sin plantilla) dentro de la ventana de 24 h son gratis, y las plantillas de utilidad dentro de esa ventana también.
- Si la persona llega desde un anuncio «Click to WhatsApp» o el botón de una página de Facebook: todo gratis 72 horas.
- Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (Updated Sep 10, 2026)

Tarifas a números de México (+52), por mensaje, en pesos (la tarjeta en dólares va entre paréntesis):

| Categoría | Hoy (desde 1-jul-2026) | Desde el 1-oct-2026 |
|---|---|---|
| Marketing | $0.5614 (USD 0.0305) | **$0.7298** (USD 0.0397) |
| Utilidad | $0.1565 (USD 0.0085) | $0.1565 (USD 0.0085) |
| Autenticación | $0.1565 (USD 0.0085) | $0.1565 (USD 0.0085) |
| Servicio (respuesta normal dentro de 24 h) | gratis | **$0.1565** (USD 0.0085), con **1,000 gratis al mes por número** |

Fuente: tarjetas CSV/XLSX en MXN y USD enlazadas en la página de precios (arriba), «effective July 1, 2026» y «effective October 1, 2026». Versión interactiva: https://business.whatsapp.com/products/platform-pricing

**Lo que cambia el 1 de octubre de 2026 (en 9 días):**
- Se empiezan a cobrar las respuestas normales dentro de la ventana de 24 h, con 1,000 gratis al mes por número.
- Se empiezan a cobrar las plantillas de utilidad dentro de la ventana de 24 h.
- Sin método de pago, Meta entrega las respuestas hasta agotar las 1,000 gratis y después **deja de entregarlas**.
- Fuente: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing (sección de tarifas del 1 de octubre) y https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages

**Ejemplo (cuenta nuestra, con tarifas oficiales):** 100 personas × 30 cortes al mes = 3,000 plantillas.
- Como utilidad: 3,000 × $0.1565 = **$469.50 al mes**.
- Si Meta la clasifica como marketing: 3,000 × $0.7298 = **$2,189.40 al mes**.
- La categoría la decide Meta al aprobar la plantilla, y «a business accepts the charges associated with the category applied to the template at time of use». Revísala antes de usarla.

---

## 10. Tabla final

| # | Paso | Dónde | Tiempo | Depende de |
|---|---|---|---|---|
| 2 | Verificar el negocio | Centro de seguridad del portafolio | 20-30 min + hasta 14 días hábiles (oficial) | Control total, CSF o acta, sitio con https |
| 3 | Crear la app nueva | developers.facebook.com/apps/creation | ~15 min (estimado) | Nada (sirve el portafolio sin verificar) |
| 3.3 | @gaiaprime_mx como evaluador | «Generar tokens de acceso» | 2 min | 3 |
| 3.4 | URI de redirección | «Configuración de inicio de sesión del negocio» | 2 min | 3 |
| 4 | Configuración básica | «Configuración de la app > Básica» | ~10 min | Ícono 1024, URLs legales |
| 5 | Publicar (Activo) | «Publicar» | 1 min | 3, 4 (y quizá 2) |
| 6 | Interruptor de mensajes | App de Instagram | 1 min | Nada |
| 7 | `app` + `login` | Terminal | 5 min | 3, 5, 6 |
| 8 | Prueba LIBRETA | DM + `dm-libreta.py estado` | 10 min | 7 |
| 5.3 | Plan B: App Review | «Revisión > Solicitudes» | ⚠ sin plazo publicado | 2 + página de demostración |
| 9 | WhatsApp API | Nueva app + WhatsApp Manager | ~1 h + plantillas hasta 24 h | Número libre, método de pago; 2 para pasar de 250/día |

---

## 11. Si algo no coincide

**Qué buscar primero:**
- Abre la **Fuente** del paso. Arriba dice «Updated»: si es más nueva que el 22-sep-2026, manda la página.
- Si un enlace `developers.facebook.com/docs/...` da error, cambia `/docs/` por `/documentation/` (Meta movió su documentación; las dos formas conviven).
- En el panel de apps, busca por el nombre en inglés de esta guía: a veces el español cambia y el inglés no.

**A quién preguntar:**
- Soporte para desarrolladores: https://developers.facebook.com/support/ → «Get Help» → «Ask a question» o «Contact Direct Support». Meta responde en 2 días hábiles.
  Fuente: https://developers.facebook.com/documentation/development/support
- Reportar un error del panel: https://developers.facebook.com/support/bugs/
- Foro de desarrolladores: https://developers.facebook.com/community/
- Ayuda de negocio (verificación, portafolio): https://www.facebook.com/business/help y https://business.facebook.com/business-support-home
- ¿Meta está caída? https://metastatus.com/ ⚠ (el enlace que trae la documentación, developers.facebook.com/status/dashboard/, da 404 hoy).

**Qué captura mandarnos:**
- Pantalla completa, con la **barra de direcciones** visible.
- El **menú izquierdo** del panel de la app.
- En «Publicar»: la lista de requisitos, con lo que está en gris o en rojo.
- En «Roles de la app > Roles»: cómo aparece @gaiaprime_mx.
- En «Configuración de la API con inicio de sesión con Instagram»: la pantalla completa, **con la clave secreta tapada**.
- En el Centro de seguridad: el estado de la verificación.
- Si falla un comando: el texto completo que imprimió (el script nunca imprime el token).

---

## Fuentes (todas leídas el 22-sep-2026)

Meta for Developers:
- Instagram Platform overview (Updated Sep 16, 2026): https://developers.facebook.com/documentation/instagram-platform/overview
- App Review for Instagram API (Jun 30, 2026): https://developers.facebook.com/documentation/instagram-platform/app-review
- Webhooks (Sep 16, 2026): https://developers.facebook.com/documentation/instagram-platform/webhooks
- Send Messages (May 6, 2026): https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api
- Private Replies (Jun 30, 2026): https://developers.facebook.com/documentation/instagram-platform/private-replies
- Conversations API (Jul 31, 2024): https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/conversations-api
- Comment Moderation (Jun 2, 2025): https://developers.facebook.com/documentation/instagram-platform/comment-moderation
- Business Login for Instagram (Mar 13, 2026): https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/business-login
- Customize the Instagram use case (Mar 15, 2026): https://developers.facebook.com/documentation/development/create-an-app/instagram-use-case
- Create a Meta app for the Instagram API (May 14, 2025): https://developers.facebook.com/docs/instagram-platform/create-an-instagram-app
- Create an App with Meta (Sep 16, 2025): https://developers.facebook.com/documentation/development/create-an-app
- App Modes (May 5, 2025): https://developers.facebook.com/documentation/development/build-and-test/app-modes
- Publish / Release (May 5, 2025): https://developers.facebook.com/documentation/development/release
- Basic Settings (Oct 18, 2023): https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/basic-settings
- Data Deletion Callback: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/data-deletion-callback
- App Categories: https://developers.facebook.com/documentation/development/create-an-app/app-dashboard/app-categories
- Access Levels: https://developers.facebook.com/docs/graph-api/overview/access-levels
- Developer Support: https://developers.facebook.com/documentation/development/support
- WhatsApp Get Started (Jun 16, 2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- WhatsApp Pricing (Sep 10, 2026): https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing
- WhatsApp non-template pricing: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing/non-template-messages
- WhatsApp phone numbers: https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers
- WhatsApp migrate existing number: https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/migrate-existing-whatsapp-number-to-a-business-account
- WhatsApp coexistence: https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users
- WhatsApp display names: https://developers.facebook.com/documentation/business-messaging/whatsapp/display-names
- WhatsApp messaging limits: https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits
- WhatsApp template review: https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-review

Servicio de ayuda de Meta para empresas / Instagram:
- Cómo verificar tu negocio: https://www.facebook.com/business/help/2058515294227817
- Información sobre la verificación: https://www.facebook.com/business/help/1095661473946872
- Documentos oficiales aceptados: https://www.facebook.com/business/help/159334372093366
- Por qué se rechazó: https://www.facebook.com/business/help/2342133782492969
- Dónde ver el estado: https://www.facebook.com/business/help/863987813384785
- Verificar tu dominio: https://www.facebook.com/business/help/321167023127050
- Normas del nombre visible de WhatsApp: https://www.facebook.com/business/help/757569725593362
- Acceso a los mensajes de Instagram en las apps: https://www.facebook.com/help/instagram/791161338412168

WhatsApp Business: https://business.whatsapp.com/products/platform-pricing
