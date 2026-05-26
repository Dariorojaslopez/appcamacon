import prisma from './prisma';
import {
  BITACORA_NOTIFY_ROLES,
  type BitacoraNotifyRole,
  type ProjectBitacoraNotifyByRole,
  emptyNotifyByRole,
  parseNotifyUserIdsArray,
  parseOptionalNotifyUserId,
} from './projectBitacoraNotifyUsers';

type NotifyBody = {
  bitacoraNotifyContratistaUserIds?: unknown;
  bitacoraNotifyInterventorUserIds?: unknown;
  bitacoraNotifyIduUserIds?: unknown;
  bitacoraNotifyContratistaUserId?: unknown;
  bitacoraNotifyInterventorUserId?: unknown;
  bitacoraNotifyIduUserId?: unknown;
};

function legacySingleToArray(v: unknown): string[] | undefined {
  const parsed = parseOptionalNotifyUserId(v);
  if (parsed === undefined) return undefined;
  return parsed ? [parsed] : [];
}

export function parseBitacoraNotifyByRoleFromBody(body: NotifyBody): ProjectBitacoraNotifyByRole | null {
  const legacyMap: Record<BitacoraNotifyRole, { arr?: unknown; single?: unknown }> = {
    contratista: {
      arr: body.bitacoraNotifyContratistaUserIds,
      single: body.bitacoraNotifyContratistaUserId,
    },
    interventor: {
      arr: body.bitacoraNotifyInterventorUserIds,
      single: body.bitacoraNotifyInterventorUserId,
    },
    idu: {
      arr: body.bitacoraNotifyIduUserIds,
      single: body.bitacoraNotifyIduUserId,
    },
  };

  let anyField = false;
  const result = emptyNotifyByRole();

  for (const role of BITACORA_NOTIFY_ROLES) {
    const { arr, single } = legacyMap[role];
    const fromArr = parseNotifyUserIdsArray(arr);
    if (fromArr !== undefined) {
      anyField = true;
      result[role] = fromArr;
      continue;
    }
    const fromSingle = legacySingleToArray(single);
    if (fromSingle !== undefined) {
      anyField = true;
      result[role] = fromSingle;
    }
  }

  return anyField ? result : null;
}

export async function validateBitacoraNotifyUserIds(
  byRole: ProjectBitacoraNotifyByRole,
): Promise<{ error: string } | null> {
  const allIds: string[] = [];
  for (const role of BITACORA_NOTIFY_ROLES) {
    allIds.push(...byRole[role]);
  }
  const uniqueIds = allIds.filter((id, index, arr) => arr.indexOf(id) === index);
  if (uniqueIds.length === 0) return null;

  const found = await prisma.user.count({
    where: { id: { in: uniqueIds }, isActive: true },
  });
  if (found !== uniqueIds.length) {
    return { error: 'Uno o más usuarios de notificación de bitácora no son válidos o están inactivos.' };
  }
  return null;
}

export async function syncProjectBitacoraNotifyUsers(
  projectId: string,
  byRole: ProjectBitacoraNotifyByRole,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.projectBitacoraNotifyUser.deleteMany({ where: { projectId } });
    const rows: { projectId: string; role: string; userId: string; sortOrder: number }[] = [];
    for (const role of BITACORA_NOTIFY_ROLES) {
      byRole[role].forEach((userId, sortOrder) => {
        rows.push({ projectId, role, userId, sortOrder });
      });
    }
    if (rows.length > 0) {
      await tx.projectBitacoraNotifyUser.createMany({ data: rows });
    }
  });
}

/** @deprecated usar parseBitacoraNotifyByRoleFromBody + syncProjectBitacoraNotifyUsers */
export async function buildObraNotifyDataFromBody(body: NotifyBody): Promise<
  | { notifyByRole: ProjectBitacoraNotifyByRole | null }
  | { error: string }
> {
  const notifyByRole = parseBitacoraNotifyByRoleFromBody(body);
  if (!notifyByRole) return { notifyByRole: null };
  const validation = await validateBitacoraNotifyUserIds(notifyByRole);
  if (validation) return validation;
  return { notifyByRole };
}
