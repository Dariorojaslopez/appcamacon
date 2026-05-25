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

export async function notifyBitacoraSaveToOthers(params: {
  projectId: string;
  fechaYmd: string;
  savedSlots: RegistroBitacoraSlotKey[];
  savedByUserId: string;
  savedByName: string;
}): Promise<void> {
  if (!isEmailConfigured() || params.savedSlots.length === 0) return;

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
  if (!project) return;

  const recipientIds: string[] = [];
  for (const savedSlot of params.savedSlots) {
    for (const otherSlot of BITACORA_NOTIFY_OTHER_SLOTS[savedSlot]) {
      const uid = projectNotifyUserIdForSlot(project, otherSlot);
      if (uid && uid !== params.savedByUserId && !recipientIds.includes(uid)) {
        recipientIds.push(uid);
      }
    }
  }
  if (recipientIds.length === 0) return;

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

  for (const u of users) {
    const email = u.email?.trim();
    if (!email) continue;
    try {
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
    } catch (err) {
      console.error('notifyBitacoraSaveToOthers: fallo envío a', email, err);
    }
  }
}
