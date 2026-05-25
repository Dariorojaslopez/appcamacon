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

/** Al guardar un slot, notificar a los otros dos roles configurados en la obra. */
export const BITACORA_NOTIFY_OTHER_SLOTS: Record<
  RegistroBitacoraSlotKey,
  readonly RegistroBitacoraSlotKey[]
> = {
  contratista: ['interventor', 'idu'],
  interventor: ['contratista', 'idu'],
  idu: ['contratista', 'interventor'],
};

export function parseOptionalNotifyUserId(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}
