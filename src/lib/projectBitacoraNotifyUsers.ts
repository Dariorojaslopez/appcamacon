import type { RegistroBitacoraSlotKey } from '../shared/registroBitacoraPermissions';

export type ProjectBitacoraNotifyUserIds = {
  bitacoraNotifyContratistaUserId: string | null;
  bitacoraNotifyInterventorUserId: string | null;
  bitacoraNotifyIduUserId: string | null;
};

export const PROJECT_BITACORA_NOTIFY_USER_ID_FIELDS = [
  'bitacoraNotifyContratistaUserId',
  'bitacoraNotifyInterventorUserId',
  'bitacoraNotifyIduUserId',
] as const;

export function projectNotifyUserIdForSlot(
  project: ProjectBitacoraNotifyUserIds,
  slot: RegistroBitacoraSlotKey,
): string | null {
  switch (slot) {
    case 'contratista':
      return project.bitacoraNotifyContratistaUserId;
    case 'interventor':
      return project.bitacoraNotifyInterventorUserId;
    case 'idu':
      return project.bitacoraNotifyIduUserId;
    default:
      return null;
  }
}

/** Todos los usuarios asignados en la obra para notificación (sin duplicar id). */
export function allBitacoraNotifyRecipientIds(project: ProjectBitacoraNotifyUserIds): string[] {
  const ids: string[] = [];
  for (const id of [
    project.bitacoraNotifyContratistaUserId,
    project.bitacoraNotifyInterventorUserId,
    project.bitacoraNotifyIduUserId,
  ]) {
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

export function parseOptionalNotifyUserId(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}
