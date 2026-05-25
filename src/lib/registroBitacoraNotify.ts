import prisma from './prisma';
import {
  BITACORA_NOTIFY_OTHER_SLOTS,
  projectNotifyUserIdForSlot,
} from './projectBitacoraNotifyUsers';
import { sendRegistroBitacoraNotifyEmail, isEmailConfigured } from '../infrastructure/email/mailer';
import {
  REGISTRO_BITACORA_SLOT_LABELS,
  type RegistroBitacoraSlotKey,
} from '../shared/registroBitacoraPermissions';

export type BitacoraNotifyResult = {
  emailsSent: number;
  /** Motivo cuando no se envió ningún correo (diagnóstico en logs / API). */
  skipReason?: 'smtp_no_configurado' | 'sin_seccion_guardada' | 'obra_sin_destinatarios' | 'sin_correo_destinatario';
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

  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    select: {
      name: true,
      code: true,
      bitacoraNotifyContratistaUserId: true,
      bitacoraNotifyInterventorUserId: true,
      bitacoraNotifyIduUserId: true,
    },
  });
  if (!project) {
    return { emailsSent: 0, skipReason: 'obra_sin_destinatarios' };
  }

  const recipientIds: string[] = [];
  for (const savedSlot of params.savedSlots) {
    for (const otherSlot of BITACORA_NOTIFY_OTHER_SLOTS[savedSlot]) {
      const uid = projectNotifyUserIdForSlot(project, otherSlot);
      if (uid && !recipientIds.includes(uid)) {
        recipientIds.push(uid);
      }
    }
  }
  if (recipientIds.length === 0) {
    console.warn('notifyBitacoraSaveToOthers: obra sin otros usuarios asignados para notificar', {
      projectId: params.projectId,
      savedSlots: params.savedSlots,
      savedByUserId: params.savedByUserId,
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

  let emailsSent = 0;
  for (const u of users) {
    const email = u.email?.trim();
    if (!email) continue;
    await sendRegistroBitacoraNotifyEmail({
      to: email,
      recipientName: u.name,
      obraName: project.name,
      obraCode: project.code,
      fechaYmd: params.fechaYmd,
      savedByName: params.savedByName,
      savedSectionLabel: savedSlotLabels,
      appUrl: appBase ? `${appBase}/dashboard` : undefined,
    });
    emailsSent += 1;
  }

  if (emailsSent === 0) {
    return { emailsSent: 0, skipReason: 'sin_correo_destinatario' };
  }

  return { emailsSent };
}
