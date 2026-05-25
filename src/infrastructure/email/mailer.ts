import nodemailer from 'nodemailer';

const smtpHost = process.env.SMTP_HOST;
const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const fromEmail = process.env.MAIL_FROM || smtpUser;

export function isEmailConfigured() {
  return Boolean(smtpHost && smtpUser && smtpPass && fromEmail);
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  temporaryPassword: string;
}) {
  if (!isEmailConfigured()) {
    console.warn('SMTP no está configurado. No se envió el correo de restablecimiento.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const subject = 'SIGOCC Camacon - Nueva contraseña temporal';
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

  await transporter.sendMail({
    from: fromEmail,
    to: params.to,
    subject,
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
  if (!isEmailConfigured()) {
    console.warn('SMTP no está configurado. No se envió la notificación de bitácora.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const subject = `SIGOCC Camacon - Bitácora actualizada (${params.obraCode})`;
  const lines = [
    `Hola ${params.recipientName},`,
    '',
    `Se actualizó el registro de bitácora de la obra «${params.obraName}» (${params.obraCode}).`,
    `Fecha del registro: ${params.fechaYmd}.`,
    `Sección actualizada: ${params.savedSectionLabel}.`,
    `Registrado por: ${params.savedByName}.`,
    '',
    'Como usted está asignado a esta obra para seguimiento de bitácora, le notificamos para que revise y complete su sección si corresponde.',
  ];
  if (params.appUrl) {
    lines.push('', `Ingrese al sistema: ${params.appUrl}`);
  }
  lines.push('', 'Este es un mensaje automático. No responda a este correo.');

  await transporter.sendMail({
    from: fromEmail,
    to: params.to,
    subject,
    text: lines.join('\n'),
  });
}

