import type { Prisma } from '@prisma/client';
import { BITACORA_NOTIFY_ROLES, notifyUserIdsByRole } from './projectBitacoraNotifyUsers';

const notifyUserSelect = { id: true, name: true, email: true } as const;

export const adminObraInclude = {
  bitacoraNotifyUsers: {
    include: { user: { select: notifyUserSelect } },
  },
} satisfies Prisma.ProjectInclude;

export type AdminObraRow = Prisma.ProjectGetPayload<{ include: typeof adminObraInclude }>;

function serializeNotifyUsers(o: AdminObraRow) {
  const byRole = notifyUserIdsByRole(o);
  const usersByRole = Object.fromEntries(
    BITACORA_NOTIFY_ROLES.map((role) => [
      role,
      [...o.bitacoraNotifyUsers]
        .filter((n) => n.role === role)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((n) => n.user),
    ]),
  ) as Record<
    (typeof BITACORA_NOTIFY_ROLES)[number],
    { id: string; name: string; email: string }[]
  >;

  return {
    bitacoraNotifyContratistaUserIds: byRole.contratista,
    bitacoraNotifyInterventorUserIds: byRole.interventor,
    bitacoraNotifyIduUserIds: byRole.idu,
    bitacoraNotifyContratistaUsers: usersByRole.contratista,
    bitacoraNotifyInterventorUsers: usersByRole.interventor,
    bitacoraNotifyIduUsers: usersByRole.idu,
  };
}

export function serializeAdminObra(o: AdminObraRow) {
  return {
    id: o.id,
    consecutivo: o.consecutivo,
    name: o.name,
    description: o.description,
    code: o.code,
    startDate: o.startDate,
    endDate: o.endDate,
    evidenciasOnedriveShareUrl: o.evidenciasOnedriveShareUrl,
    evidenciasGoogleDriveFolderId: o.evidenciasGoogleDriveFolderId,
    logoUrl: o.logoUrl,
    isActive: o.isActive,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    ...serializeNotifyUsers(o),
  };
}
