import prisma from './prisma';
import { parseOptionalNotifyUserId } from './projectBitacoraNotifyUsers';

export async function buildObraNotifyDataFromBody(body: {
  bitacoraNotifyContratistaUserId?: unknown;
  bitacoraNotifyInterventorUserId?: unknown;
  bitacoraNotifyIduUserId?: unknown;
}): Promise<
  | {
      bitacoraNotifyContratistaUserId?: string | null;
      bitacoraNotifyInterventorUserId?: string | null;
      bitacoraNotifyIduUserId?: string | null;
    }
  | { error: string }
> {
  const data: Record<string, string | null> = {};
  const fields = [
    ['bitacoraNotifyContratistaUserId', body.bitacoraNotifyContratistaUserId],
    ['bitacoraNotifyInterventorUserId', body.bitacoraNotifyInterventorUserId],
    ['bitacoraNotifyIduUserId', body.bitacoraNotifyIduUserId],
  ] as const;

  const idsToValidate: string[] = [];
  for (const [key, raw] of fields) {
    const parsed = parseOptionalNotifyUserId(raw);
    if (parsed === undefined) continue;
    data[key] = parsed;
    if (parsed) idsToValidate.push(parsed);
  }

  const uniqueIds = [...new Set(idsToValidate)];
  if (uniqueIds.length > 0) {
    const found = await prisma.user.count({
      where: { id: { in: uniqueIds }, isActive: true },
    });
    if (found !== uniqueIds.length) {
      return { error: 'Uno o más usuarios de notificación de bitácora no son válidos o están inactivos.' };
    }
  }

  return data;
}
