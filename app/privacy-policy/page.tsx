import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Política de privacidad | Camacon App',
  description: 'Política de privacidad de la aplicación de informes diarios de obra de Camacon.',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <section className="legal-card">
        <p className="legal-kicker">Camacon App</p>
        <h1>Política de privacidad</h1>
        <p className="legal-updated">Última actualización: 12 de mayo de 2026</p>

        <p>
          Esta política explica cómo Camacon trata la información registrada en la aplicación de
          informes diarios de obra, disponible en appinformediario.camacon.com.co. La aplicación se
          usa para documentar actividades, personal, equipos, materiales, evidencias fotográficas,
          firmas y demás información operativa de los proyectos de construcción.
        </p>

        <h2>Información que recopilamos</h2>
        <p>
          Podemos recopilar datos de identificación y acceso de los usuarios autorizados, datos de
          las obras, información registrada en informes diarios, observaciones, firmas, fotografías,
          archivos adjuntos, fechas, horarios, datos de proveedores y registros asociados a equipos,
          materiales, calidad y evidencias.
        </p>
        <p>
          Cuando el usuario carga o toma un registro fotográfico, la aplicación puede solicitar
          acceso a la cámara y a la ubicación del dispositivo. La geolocalización se usa únicamente
          para asociar coordenadas, precisión y fecha/hora al registro fotográfico correspondiente.
          Si el usuario no concede el permiso de ubicación, la fotografía puede cargarse igualmente
          y el sistema guarda el estado de permiso sin coordenadas.
        </p>

        <h2>Uso de la información</h2>
        <p>
          Usamos la información para generar y conservar informes de obra, soportar seguimiento
          técnico y administrativo, consultar evidencias, controlar permisos por rol, respaldar
          procesos internos y cumplir obligaciones contractuales, operativas o legales relacionadas
          con los proyectos.
        </p>

        <h2>Uso de Google Drive</h2>
        <p>
          La aplicación puede integrarse con Google Drive para guardar evidencias fotográficas y
          archivos asociados a una obra. Al autorizar Google Drive, la aplicación recibe permisos
          para crear y consultar archivos necesarios para la operación de informes y evidencias. No
          usamos el acceso a Google Drive para fines publicitarios ni para leer archivos ajenos a la
          operación autorizada.
        </p>

        <h2>Base legal y permisos del dispositivo</h2>
        <p>
          El uso de cámara, archivos y ubicación depende de permisos concedidos por el usuario desde
          el navegador o dispositivo. Estos permisos pueden ser revocados en cualquier momento desde
          la configuración del navegador o del sistema operativo. Si se revoca un permiso, algunas
          funciones pueden quedar limitadas, pero el sistema seguirá permitiendo registrar la
          información que no dependa de dicho permiso.
        </p>

        <h2>Conservación y seguridad</h2>
        <p>
          Conservamos la información durante el tiempo necesario para administrar los proyectos,
          atender auditorías, respaldar informes y cumplir obligaciones aplicables. Aplicamos
          controles de autenticación, roles de usuario, cookies de sesión seguras y medidas técnicas
          razonables para proteger la información frente a accesos no autorizados.
        </p>

        <h2>Compartición de datos</h2>
        <p>
          La información puede ser consultada por usuarios autorizados de Camacon y por terceros que
          presten servicios necesarios para la operación, como proveedores de nube, almacenamiento,
          correo o infraestructura. No vendemos datos personales ni usamos la información para
          publicidad comportamental.
        </p>

        <h2>Derechos del titular</h2>
        <p>
          Los titulares pueden solicitar consulta, actualización, corrección o eliminación de sus
          datos cuando corresponda, de acuerdo con la ley aplicable y las obligaciones de conservación
          propias de los proyectos. Las solicitudes serán revisadas por Camacon antes de su
          ejecución.
        </p>

        <h2>Contacto</h2>
        <p>
          Para consultas sobre esta política o sobre el tratamiento de datos personales, comunícate
          con Camacon a través de los canales administrativos oficiales de la compañía.
        </p>

        <p className="legal-note">
          Esta página es pública para fines de transparencia y validación de integraciones como
          Google OAuth.
        </p>
      </section>
    </main>
  );
}
