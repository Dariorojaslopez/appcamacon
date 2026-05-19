/** Secciones del registro de bitácora (contratista / interventor / IDU). */

export const REGISTRO_BITACORA_SLOT_KEYS = ['contratista', 'interventor', 'idu'] as const;

export type RegistroBitacoraSlotKey = (typeof REGISTRO_BITACORA_SLOT_KEYS)[number];

export const REGISTRO_BITACORA_SLOT_LABELS: Record<RegistroBitacoraSlotKey, string> = {
  contratista: 'Contratista',
  interventor: 'Interventor',
  idu: 'IDU',
};

const DEFAULT_SLOTS_BY_ROLE: Partial<Record<string, readonly RegistroBitacoraSlotKey[]>> = {
  SUPER_ADMIN: REGISTRO_BITACORA_SLOT_KEYS,
  CONTRATISTA: ['contratista'],
  INTERVENTOR: ['interventor'],
  IDU: ['idu'],
};

/** Fallback cuando el rol no tiene filas en RoleRegistroBitacoraPermission. */
export function defaultRegistroBitacoraSlotsForRole(role: string): RegistroBitacoraSlotKey[] {
  const d = DEFAULT_SLOTS_BY_ROLE[role];
  if (d) return [...d];
  return [];
}

export function isRegistroBitacoraSlotKey(v: string): v is RegistroBitacoraSlotKey {
  return (REGISTRO_BITACORA_SLOT_KEYS as readonly string[]).includes(v);
}
