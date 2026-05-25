import type { Prisma } from '@prisma/client';

const notifyUserSelect = { id: true, name: true, email: true } as const;

export const adminObraInclude = {
  bitacoraNotifyContratistaUser: { select: notifyUserSelect },
  bitacoraNotifyInterventorUser: { select: notifyUserSelect },
  bitacoraNotifyIduUser: { select: notifyUserSelect },
} satisfies Prisma.ProjectInclude;

export type AdminObraRow = Prisma.ProjectGetPayload<{ include: typeof adminObraInclude }>;

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
    bitacoraNotifyContratistaUserId: o.bitacoraNotifyContratistaUserId,
    bitacoraNotifyInterventorUserId: o.bitacoraNotifyInterventorUserId,
    bitacoraNotifyIduUserId: o.bitacoraNotifyIduUserId,
    bitacoraNotifyContratistaUser: o.bitacoraNotifyContratistaUser,
    bitacoraNotifyInterventorUser: o.bitacoraNotifyInterventorUser,
    bitacoraNotifyIduUser: o.bitacoraNotifyIduUser,
  };
}
