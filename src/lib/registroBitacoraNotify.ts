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

  const byEmail = new Map<string, { email: string; name: string }>();
  for (const u of users) {
    const email = u.email?.trim();
    if (!email) continue;
    if (!byEmail.has(email.toLowerCase())) {
      byEmail.set(email.toLowerCase(), { email, name: u.name });
    }
  }

  if (byEmail.size === 0) {
    return { emailsSent: 0, skipReason: 'sin_correo_destinatario' };
  }

  let emailsSent = 0;
  for (const { email, name } of Array.from(byEmail.values())) {
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
  }

  return { emailsSent };
}
