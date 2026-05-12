import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Términos del servicio | Camacon App',
  description: 'Términos del servicio de la aplicación de informes diarios de obra de Camacon.',
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="legal-kicker">Camacon App</p>
        <h1>Términos del servicio</h1>
        <p className="legal-updated">Última actualización: 12 de mayo de 2026</p>

        <p>
          Estos términos regulan el uso de la aplicación de informes diarios de obra de Camacon,
          disponible en appinformediario.camacon.com.co. Al acceder o usar la aplicación, el usuario
          acepta utilizarla únicamente para fines laborales, administrativos y operativos autorizados
          por Camacon.
        </p>

        <h2>Uso autorizado</h2>
        <p>
          La aplicación está destinada a usuarios autorizados por Camacon para registrar, consultar y
          administrar información relacionada con proyectos de construcción, informes diarios,
          evidencias, personal, equipos, materiales, calidad, firmas y demás actividades de obra.
        </p>

        <h2>Cuentas y seguridad</h2>
        <p>
          Cada usuario es responsable de proteger sus credenciales de acceso y de cerrar sesión en
          dispositivos compartidos. Está prohibido compartir cuentas, acceder con credenciales de otra
          persona o intentar eludir controles de autenticación, roles o permisos.
        </p>

        <h2>Exactitud de la información</h2>
        <p>
          El usuario debe registrar información completa, veraz y oportuna. Los informes,
          observaciones, horarios, fotografías, firmas y demás evidencias pueden ser usados como
          soporte técnico, operativo, contractual o administrativo de los proyectos.
        </p>

        <h2>Registros fotográficos y ubicación</h2>
        <p>
          La aplicación puede permitir seleccionar archivos, tomar fotografías y asociar datos de
          ubicación cuando el usuario otorga los permisos correspondientes. Si el usuario niega o
          revoca permisos de cámara, archivos o geolocalización, algunas funciones pueden quedar
          limitadas o registrarse sin coordenadas.
        </p>

        <h2>Integración con Google Drive</h2>
        <p>
          Camacon puede usar Google Drive para almacenar evidencias y archivos asociados a las obras.
          El usuario acepta que las evidencias cargadas se guarden en las carpetas autorizadas por la
          compañía y que puedan ser consultadas por usuarios con permisos operativos o administrativos.
        </p>

        <h2>Uso indebido</h2>
        <p>
          No está permitido cargar contenido malicioso, ilegal, ofensivo, ajeno a la operación de la
          obra o que infrinja derechos de terceros. Camacon podrá restringir el acceso, eliminar
          registros indebidos o tomar medidas administrativas cuando detecte uso no autorizado.
        </p>

        <h2>Disponibilidad del servicio</h2>
        <p>
          Camacon procura mantener la aplicación disponible y funcional, pero el servicio puede verse
          afectado por mantenimientos, fallas de conectividad, indisponibilidad de terceros,
          navegadores, dispositivos, proveedores de nube o integraciones externas.
        </p>

        <h2>Propiedad y confidencialidad</h2>
        <p>
          La información registrada en la aplicación pertenece a Camacon o a los proyectos
          correspondientes, según aplique. El usuario debe tratar la información como confidencial y
          no divulgarla fuera de los canales autorizados.
        </p>

        <h2>Cambios en los términos</h2>
        <p>
          Camacon puede actualizar estos términos para reflejar cambios legales, técnicos u
          operativos. La versión publicada en esta página será la versión vigente para el uso de la
          aplicación.
        </p>

        <h2>Contacto</h2>
        <p>
          Para preguntas sobre estos términos, comunícate con Camacon a través de los canales
          administrativos oficiales de la compañía.
        </p>

        <p className="legal-note">
          Esta página es pública para fines de transparencia y validación de integraciones como
          Google OAuth.
        </p>
      </section>
    </main>
  );
}
