import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import { diagnoseSmtpEnv, readSmtpConfig } from '../../lib/smtpConfig';

export function isEmailConfigured(): boolean {
  return readSmtpConfig() != null;
}

export function getSmtpDiagnostic() {
  return diagnoseSmtpEnv();
}

function createMailTransporter() {
  const cfg = readSmtpConfig();
  if (!cfg) {
    throw new Error('SMTP no configurado');
  }

  const options: SMTPTransport.Options = {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: {
      user: cfg.user,
      pass: cfg.pass,
    },
  };

  if (cfg.port === 587) {
    options.requireTLS = true;
  }

  return { transporter: nodemailer.createTransport(options), fromHeader: cfg.fromHeader };
}

/** Verifica conexión y credenciales sin enviar correo al usuario final. */
export async function verifySmtpConnection(): Promise<void> {
  const { transporter } = createMailTransporter();
  await transporter.verify();
}

/** Mismo envío que usa «olvidé contraseña» y las notificaciones de bitácora. */
export async function sendPlainTextEmail(params: { to: string; subject: string; text: string }) {
  const cfg = readSmtpConfig();
  if (!cfg) {
    console.warn('SMTP no está configurado.');
    return;
  }

  const { transporter, fromHeader } = createMailTransporter();
  await transporter.sendMail({
    from: fromHeader,
    to: params.to,
    subject: params.subject,
    text: params.text,
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  temporaryPassword: string;
}) {
  const text = [
    `Hola ${params.name},`,
    '',
    'Has solicitado restablecer tu contraseña en SIGOCC Camacon.',
    'Hemos generado una contraseña temporal para que puedas ingresar:',
    '',
    `Contraseña temporal: ${params.temporaryPassword}`,
    '',
    'Por seguridad, una vez ingreses al sistema te recomendamos cambiarla desde el menú de perfil.',
    '',
    'Si no solicitaste este cambio, ignora este correo.',
  ].join('\n');

  await sendPlainTextEmail({
    to: params.to,
    subject: 'SIGOCC Camacon - Nueva contraseña temporal',
    text,
  });
}

export async function sendRegistroBitacoraNotifyEmail(params: {
  to: string;
  recipientName: string;
  obraName: string;
  obraCode: string;
  fechaYmd: string;
  savedByName: string;
  savedSectionLabel: string;
  appUrl?: string;
}) {
  const lines = [
    `Hola ${params.recipientName},`,
    '',
    `Se actualizo el registro de bitacora de la obra "${params.obraName}" (${params.obraCode}).`,
    `Fecha del registro: ${params.fechaYmd}.`,
    `Seccion actualizada: ${params.savedSectionLabel}.`,
    `Registrado por: ${params.savedByName}.`,
    '',
    'Le notificamos para que revise y complete su seccion en el registro de bitacora si corresponde.',
  ];
  if (params.appUrl) {
    lines.push('', `Ingrese al sistema: ${params.appUrl}`);
  }
  lines.push('', 'Este es un mensaje automatico. No responda a este correo.');

  await sendPlainTextEmail({
    to: params.to,
    subject: `SIGOCC Camacon - Bitacora actualizada (${params.obraCode})`,
    text: lines.join('\n'),
  });
}
