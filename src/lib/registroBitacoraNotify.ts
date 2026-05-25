import prisma from './prisma';
import { allBitacoraNotifyRecipientIds } from './projectBitacoraNotifyUsers';
import { loadProjectBitacoraNotify } from './loadProjectBitacoraNotify';
import { sendRegistroBitacoraNotifyEmail, isEmailConfigured } from '../infrastructure/email/mailer';
import {
  REGISTRO_BITACORA_SLOT_LABELS,
  type RegistroBitacoraSlotKey,
} from '../shared/registroBitacoraPermissions';

export type BitacoraNotifySkipReason =
  | 'smtp_no_configurado'
  | 'sin_seccion_guardada'
  | 'obra_sin_destinatarios'
  | 'sin_correo_destinatario'
  | 'error_envio';

export type BitacoraNotifyResult = {
  emailsSent: number;
  skipReason?: BitacoraNotifySkipReason;
};

function smtpErrorHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.slice(0, 200);
}

export async function notifyBitacoraSaveToOthers(params: {
  projectId: string;
  fechaYmd: string;
  savedSlots: RegistroBitacoraSlotKey[];
  savedByUserId: string;
  savedByName: string;
}): Promise<BitacoraNotifyResult> {
  if (!isEmailConfigured()) {
    console.warn('notifyBitacoraSaveToOthers: SMTP no configurado');
    return { emailsSent: 0, skipReason: 'smtp_no_configurado' };
  }
  if (params.savedSlots.length === 0) {
    return { emailsSent: 0, skipReason: 'sin_seccion_guardada' };
  }

  const project = await loadProjectBitacoraNotify(params.projectId);
  if (!project) {
    return { emailsSent: 0, skipReason: 'obra_sin_destinatarios' };
  }

  const recipientIds = allBitacoraNotifyRecipientIds(project);
  if (recipientIds.length === 0) {
    console.warn('notifyBitacoraSaveToOthers: obra sin usuarios de notificación en BD', {
      projectId: params.projectId,
      code: project.code,
    });
    return { emailsSent: 0, skipReason: 'obra_sin_destinatarios' };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds }, isActive: true },
    select: { id: true, email: true, name: true },
  });

  const savedSlotLabels = params.savedSlots
    .map((s) => REGISTRO_BITACORA_SLOT_LABELS[s])
    .join(', ');
  const appBase =
    (process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '') ||
    '';

  const byEmail: Record<string, { email: string; name: string }> = {};
  for (const u of users) {
    const email = u.email?.trim();
    if (!email) continue;
    const key = email.toLowerCase();
    if (!byEmail[key]) {
      byEmail[key] = { email, name: u.name };
    }
  }

  const recipients = Object.keys(byEmail).map((k) => byEmail[k]);
  if (recipients.length === 0) {
    return { emailsSent: 0, skipReason: 'sin_correo_destinatario' };
  }

  let emailsSent = 0;
  let lastSmtpError: string | undefined;

  for (const { email, name } of recipients) {
    try {
      await sendRegistroBitacoraNotifyEmail({
        to: email,
        recipientName: name,
        obraName: project.name,
        obraCode: project.code,
        fechaYmd: params.fechaYmd,
        savedByName: params.savedByName,
        savedSectionLabel: savedSlotLabels,
        appUrl: appBase ? `${appBase}/dashboard` : undefined,
      });
      emailsSent += 1;
    } catch (err) {
      lastSmtpError = smtpErrorHint(err);
      console.error('notifyBitacoraSaveToOthers: fallo envío a', email, err);
    }
  }

  if (emailsSent === 0) {
    console.error('notifyBitacoraSaveToOthers: ningún correo enviado', lastSmtpError);
    return { emailsSent: 0, skipReason: 'error_envio' };
  }

  return { emailsSent };
}
