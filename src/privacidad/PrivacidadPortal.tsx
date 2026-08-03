/**
 * PrivacidadPortal — Aviso de Privacidad de GAIA (estilo LFPDPPP, México).
 *
 * Plantilla razonable en español mexicano. Datos del negocio como PLACEHOLDERS
 * ([RAZÓN SOCIAL], [RFC], etc.) — reemplázalos antes de publicar. NO es asesoría
 * legal; revísalo con un abogado / verifica los requisitos del INAI.
 */
import LegalShell, { Bullets, type LegalSection } from '../legal/LegalShell';

// ── Datos del responsable (REEMPLAZA antes de publicar) ──
const EMPRESA = 'Sebastián Vázquez Andrade';
const NOMBRE_COMERCIAL = 'GAIA';
const DOMICILIO = 'C.P. 15000, Ciudad de México';
const CORREO_ARCO = 'privacidad@gaiaprime.com.mx';
const SITIO = 'university.gaiaprime.com.mx';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Responsable de tus datos',
    body: (
      <p>
        {EMPRESA}, que opera {NOMBRE_COMERCIAL} ({SITIO}), con domicilio en {DOMICILIO}
        (el «Responsable»), es responsable del tratamiento de tus datos personales,
        conforme a la Ley Federal de Protección de Datos Personales en Posesión de los
        Particulares (LFPDPPP) y su Reglamento.
      </p>
    ),
  },
  {
    heading: 'Qué datos recabamos',
    body: (
      <>
        <p>Para prestarte el servicio podemos recabar:</p>
        <Bullets items={[
          'Datos de identificación y contacto: correo electrónico y, si lo proporcionas, tu nombre.',
          'Datos de la cuenta: planes activos, fechas de suscripción y registros de acceso.',
          'Datos de pago: los procesa Stripe; nosotros guardamos un identificador de cliente y el estado de tu suscripción, no los datos completos de tu tarjeta.',
          'Datos técnicos mínimos: dirección IP y registros necesarios para seguridad y para evitar abuso (por ejemplo, límites de envío de enlaces).',
          'Datos de uso agregados: qué páginas y secciones se visitan, qué elementos del laboratorio se tocan, cuánto tarda el sitio en tu dispositivo y qué errores ocurren. Sirven para arreglar y mejorar los laboratorios. No grabamos tu sesión, ni lo que escribes, ni el movimiento de tu ratón, ni construimos perfiles de personas.',
        ]} />
        <p>
          No recabamos datos personales sensibles. No solicitamos información que no sea
          necesaria para las finalidades aquí descritas.
        </p>
      </>
    ),
  },
  {
    heading: 'Para qué usamos tus datos (finalidades)',
    body: (
      <>
        <p><b>Finalidades primarias</b> (necesarias para el servicio):</p>
        <Bullets items={[
          'Crear y administrar tu cuenta y darte acceso mediante enlace de un solo uso.',
          'Procesar tus pagos y administrar tu suscripción a través de Stripe.',
          'Brindarte soporte y enviarte avisos importantes sobre tu cuenta o el servicio.',
          'Garantizar la seguridad de la plataforma y prevenir fraude o abuso.',
          'Medir de forma agregada el uso y el rendimiento del sitio para corregir fallas y mejorar los laboratorios.',
        ]} />
        <p><b>Finalidades secundarias</b> (no necesarias; puedes oponerte):</p>
        <Bullets items={[
          'Enviarte novedades educativas o comunicaciones sobre nuevos laboratorios.',
        ]} />
        <p>
          Si no deseas que tus datos se usen para finalidades secundarias, puedes
          manifestarlo escribiendo a {CORREO_ARCO}. Tu negativa no será motivo para
          negarte el servicio.
        </p>
      </>
    ),
  },
  {
    heading: 'Con quién compartimos tus datos (transferencias)',
    body: (
      <>
        <p>
          Para operar, usamos proveedores que tratan datos por nuestra cuenta y bajo
          obligaciones de confidencialidad:
        </p>
        <Bullets items={[
          'Stripe — procesamiento de pagos.',
          'Resend — envío de correos transaccionales (enlaces de acceso, avisos).',
          'Cloudflare — entrega e infraestructura de red.',
        ]} />
        <p>
          No vendemos tus datos personales. Solo los compartimos cuando sea necesario
          para prestar el servicio, cuando lo exija la ley, o cuando una autoridad
          competente lo requiera.
        </p>
      </>
    ),
  },
  {
    heading: 'Tus derechos ARCO',
    body: (
      <>
        <p>
          Tienes derecho a <b>Acceder</b> a tus datos, <b>Rectificarlos</b> si son
          inexactos, <b>Cancelarlos</b> cuando consideres que no se requieren, y
          <b> Oponerte</b> a su tratamiento para fines específicos. También puedes
          revocar tu consentimiento.
        </p>
        <p>
          Para ejercer estos derechos, envía tu solicitud a {CORREO_ARCO} indicando tu
          nombre, el correo asociado a tu cuenta y el derecho que deseas ejercer.
          Responderemos en los plazos que marca la ley.
        </p>
      </>
    ),
  },
  {
    heading: 'Conservación y seguridad',
    body: (
      <p>
        Conservamos tus datos mientras tengas una cuenta activa y por el tiempo necesario
        para cumplir obligaciones legales, fiscales y de seguridad. Aplicamos medidas
        técnicas y administrativas razonables para proteger tus datos contra pérdida,
        uso indebido o acceso no autorizado.
      </p>
    ),
  },
  {
    heading: 'Cookies y tecnologías similares',
    body: (
      <p>
        Usamos almacenamiento local del navegador para mantener tu sesión iniciada. No
        usamos cookies de publicidad de terceros. Puedes borrar este almacenamiento
        desde tu navegador, aunque esto cerrará tu sesión.
      </p>
    ),
  },
  {
    heading: 'Cambios al Aviso de Privacidad',
    body: (
      <p>
        Podemos actualizar este Aviso. La versión vigente siempre estará publicada en
        esta página, con su fecha de actualización. Si los cambios son sustanciales, te
        lo notificaremos por un medio razonable.
      </p>
    ),
  },
  {
    heading: 'Contacto',
    body: (
      <p>
        Para cualquier duda sobre este Aviso o sobre el tratamiento de tus datos,
        escríbenos a {CORREO_ARCO}.
      </p>
    ),
  },
];

export default function PrivacidadPortal() {
  return (
    <LegalShell
      kicker="Documento legal"
      title="Aviso de Privacidad"
      updatedAt="31 de mayo de 2026"
      intro={
        <p>
          En {NOMBRE_COMERCIAL} cuidamos tu información. Este Aviso explica qué datos
          personales recabamos, para qué los usamos, con quién los compartimos y cómo
          puedes ejercer tus derechos.
        </p>
      }
      sections={SECTIONS}
      footerNote={
        <p>
          Plantilla de referencia conforme a la LFPDPPP. No constituye asesoría jurídica.
          Reemplaza los datos del responsable entre corchetes y verifica los requisitos
          aplicables (INAI) antes de publicar.
        </p>
      }
    />
  );
}
