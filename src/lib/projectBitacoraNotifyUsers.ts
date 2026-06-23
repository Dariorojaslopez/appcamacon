import type { RegistroBitacoraSlotKey } from '../shared/registroBitacoraPermissions';

export const BITACORA_NOTIFY_USERS_PER_ROLE_MAX = 20;

export type BitacoraNotifyRole = 'contratista' | 'interventor' | 'idu';

export const BITACORA_NOTIFY_ROLES: BitacoraNotifyRole[] = ['contratista', 'interventor', 'idu'];

export type ProjectBitacoraNotifyByRole = Record<BitacoraNotifyRole, string[]>;

export type ProjectBitacoraNotifyRow = {
  bitacoraNotifyUsers: { role: string; userId: string; sortOrder: number }[];
};

export function notifyUserIdsByRole(project: ProjectBitacoraNotifyRow): ProjectBitacoraNotifyByRole {
  const result: ProjectBitacoraNotifyByRole = {
    contratista: [],
    interventor: [],
    idu: [],
  };
  const sorted = [...project.bitacoraNotifyUsers].sort(
    (a, b) => a.role.localeCompare(b.role) || a.sortOrder - b.sortOrder,
  );
  for (const row of sorted) {
    const role = row.role as BitacoraNotifyRole;
    if (!BITACORA_NOTIFY_ROLES.includes(role)) continue;
    if (!result[role].includes(row.userId)) {
      result[role].push(row.userId);
    }
  }
  for (const role of BITACORA_NOTIFY_ROLES) {
    result[role] = result[role].slice(0, BITACORA_NOTIFY_USERS_PER_ROLE_MAX);
  }
  return result;
}

export function projectNotifyUserIdsForSlot(
  project: ProjectBitacoraNotifyRow,
  slot: RegistroBitacoraSlotKey,
): string[] {
  return notifyUserIdsByRole(project)[slot as BitacoraNotifyRole] ?? [];
}

/** Todos los usuarios asignados en la obra para notificación (sin duplicar id). */
export function allBitacoraNotifyRecipientIds(project: ProjectBitacoraNotifyRow): string[] {
  const ids: string[] = [];
  for (const role of BITACORA_NOTIFY_ROLES) {
    for (const id of notifyUserIdsByRole(project)[role]) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export function parseNotifyUserIdsArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v)) return [];
  const ids: string[] = [];
  for (const item of v) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed || ids.includes(trimmed)) continue;
    ids.push(trimmed);
    if (ids.length >= BITACORA_NOTIFY_USERS_PER_ROLE_MAX) break;
  }
  return ids;
}

/** @deprecated compatibilidad API antigua (un solo id) */
export function parseOptionalNotifyUserId(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

export function emptyNotifyByRole(): ProjectBitacoraNotifyByRole {
  return { contratista: [], interventor: [], idu: [] };
}
