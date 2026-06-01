/**
 * TerminosPortal — Términos y Condiciones de GAIA.
 *
 * Plantilla razonable en español mexicano. Los datos del negocio están como
 * PLACEHOLDERS ([RAZÓN SOCIAL], [RFC], etc.) — reemplázalos antes de publicar.
 * NO es asesoría legal; revísalo con un abogado antes de producción.
 */
import LegalShell, { Bullets, type LegalSection } from '../legal/LegalShell';

// ── Datos del negocio (REEMPLAZA antes de publicar) ──
const EMPRESA = '[RAZÓN SOCIAL]';
const NOMBRE_COMERCIAL = 'GAIA';
const RFC = '[RFC]';
const DOMICILIO = '[DOMICILIO FISCAL]';
const CORREO_CONTACTO = '[correo de contacto]';
const SITIO = 'university.gaiaprime.com.mx';
const JURISDICCION = '[CIUDAD], México';

const SECTIONS: LegalSection[] = [
  {
    heading: 'Quiénes somos',
    body: (
      <p>
        Este sitio ({SITIO}) y el servicio {NOMBRE_COMERCIAL} son operados por {EMPRESA},
        con RFC {RFC} y domicilio en {DOMICILIO} (el «Operador», «nosotros»).
        Al usar el sitio o contratar un plan, aceptas estos Términos y Condiciones.
        Si no estás de acuerdo, no uses el servicio.
      </p>
    ),
  },
  {
    heading: 'Qué ofrecemos',
    body: (
      <>
        <p>
          {NOMBRE_COMERCIAL} es una plataforma educativa. El <b>contenido informativo</b> (videos,
          escenas, explicaciones) es <b>gratuito</b>. Los planes de pago desbloquean
          herramientas adicionales:
        </p>
        <Bullets items={[
          'Laboratorios y simulaciones interactivas.',
          'Herramientas de diseño (CAD) cuando estén disponibles.',
          'Cómputo para simulaciones pesadas, descargas y certificados, según el plan.',
        ]} />
        <p>
          Las funciones marcadas como «próximamente» pueden no estar disponibles al
          momento de la contratación y se habilitan de forma gradual.
        </p>
      </>
    ),
  },
  {
    heading: 'Cuenta y acceso',
    body: (
      <>
        <p>
          El acceso se liga a tu correo electrónico mediante un enlace de un solo uso
          («magic-link»); no usamos contraseñas. Eres responsable de mantener el control
          de tu correo y de toda actividad realizada desde tu cuenta.
        </p>
        <p>
          Debes ser mayor de edad o contar con autorización de tu tutor para contratar
          un plan de pago. La información que proporciones debe ser veraz y vigente.
        </p>
      </>
    ),
  },
  {
    heading: 'Precios, pagos y suscripciones',
    body: (
      <>
        <p>
          Los precios se muestran en pesos mexicanos (MXN) e incluyen los impuestos
          aplicables salvo que se indique lo contrario. Los pagos se procesan a través
          de <b>Stripe</b>; nosotros no almacenamos los datos completos de tu tarjeta.
        </p>
        <Bullets items={[
          'Los planes mensuales se renuevan automáticamente cada mes hasta que los canceles.',
          'Los planes anuales cubren el periodo indicado al contratar.',
          'Puedes cancelar la renovación en cualquier momento desde tu cuenta; conservas el acceso hasta el final del periodo ya pagado.',
          'Podemos ajustar precios a futuro; te avisaremos antes de que aplique a tu siguiente renovación.',
        ]} />
      </>
    ),
  },
  {
    heading: 'Cancelaciones y reembolsos',
    body: (
      <>
        <p>
          Puedes cancelar la renovación de tu suscripción cuando quieras desde el portal
          de tu cuenta. La cancelación detiene cobros futuros; no genera, por sí sola,
          un reembolso del periodo en curso.
        </p>
        <p>
          Si consideras que existió un cobro indebido o un problema con el servicio,
          escríbenos a {CORREO_CONTACTO} y lo revisaremos conforme a la legislación
          aplicable en materia de protección al consumidor.
        </p>
      </>
    ),
  },
  {
    heading: 'Uso aceptable',
    body: (
      <>
        <p>Al usar {NOMBRE_COMERCIAL} te comprometes a no:</p>
        <Bullets items={[
          'Revender, redistribuir o compartir tu acceso de pago con terceros.',
          'Intentar vulnerar, sobrecargar o acceder sin autorización a la plataforma o a su infraestructura.',
          'Usar el cómputo provisto para fines ilícitos, abusivos o ajenos al propósito educativo.',
          'Infringir derechos de propiedad intelectual nuestros o de terceros.',
        ]} />
        <p>
          Podemos suspender o cancelar el acceso ante un incumplimiento, sin perjuicio
          de las acciones legales que correspondan.
        </p>
      </>
    ),
  },
  {
    heading: 'Propiedad intelectual',
    body: (
      <p>
        El contenido, marca, software y materiales de {NOMBRE_COMERCIAL} son propiedad
        del Operador o de sus licenciantes. Te otorgamos una licencia personal,
        limitada, no exclusiva e intransferible para usar el servicio conforme a estos
        Términos. Lo que tú crees con las herramientas (diseños, exportaciones) es tuyo,
        salvo el software y los activos base que te permitimos usar.
      </p>
    ),
  },
  {
    heading: 'Disponibilidad y «tal cual»',
    body: (
      <p>
        Hacemos un esfuerzo razonable por mantener el servicio disponible, pero se
        proporciona «tal cual» y «según disponibilidad». No garantizamos que esté libre
        de errores o interrupciones. Las simulaciones tienen fines educativos y no
        sustituyen asesoría profesional ni resultados de ingeniería certificados.
      </p>
    ),
  },
  {
    heading: 'Limitación de responsabilidad',
    body: (
      <p>
        En la medida permitida por la ley, el Operador no será responsable por daños
        indirectos, incidentales o consecuentes derivados del uso o imposibilidad de uso
        del servicio. Nada en estos Términos limita derechos que la ley te reconoce de
        forma irrenunciable.
      </p>
    ),
  },
  {
    heading: 'Datos personales',
    body: (
      <p>
        El tratamiento de tus datos personales se rige por nuestro{' '}
        <a href="/privacidad.html" className="text-[#4FC3F7] hover:underline">Aviso de Privacidad</a>,
        que forma parte de estos Términos.
      </p>
    ),
  },
  {
    heading: 'Cambios a estos Términos',
    body: (
      <p>
        Podemos actualizar estos Términos. La versión vigente siempre estará publicada en
        esta página con su fecha de actualización. Si los cambios son relevantes, te lo
        haremos saber por un medio razonable. El uso continuado del servicio implica tu
        aceptación de la versión vigente.
      </p>
    ),
  },
  {
    heading: 'Ley aplicable y jurisdicción',
    body: (
      <p>
        Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Para
        cualquier controversia, las partes se someten a los tribunales competentes de{' '}
        {JURISDICCION}, renunciando a cualquier otro fuero que pudiera corresponderles.
      </p>
    ),
  },
  {
    heading: 'Contacto',
    body: (
      <p>
        Para dudas sobre estos Términos, escríbenos a {CORREO_CONTACTO}.
      </p>
    ),
  },
];

export default function TerminosPortal() {
  return (
    <LegalShell
      kicker="Documento legal"
      title="Términos y Condiciones"
      updatedAt="31 de mayo de 2026"
      intro={
        <p>
          Estos Términos y Condiciones regulan el uso de {NOMBRE_COMERCIAL} y la
          contratación de sus planes de pago. Léelos con atención: al crear una cuenta o
          contratar un plan, confirmas que los aceptas.
        </p>
      }
      sections={SECTIONS}
      footerNote={
        <p>
          Plantilla de referencia. No constituye asesoría jurídica. Reemplaza los datos
          del negocio entre corchetes y revísala con tu abogado antes de publicar.
        </p>
      }
    />
  );
}
