import prisma from '../../lib/prisma';
import {
  REGISTRO_BITACORA_SLOT_KEYS,
  type RegistroBitacoraSlotKey,
  defaultRegistroBitacoraSlotsForRole,
  isRegistroBitacoraSlotKey,
} from '../../shared/registroBitacoraPermissions';

async function slotRowsForRole(role: string) {
  try {
    const rows = await prisma.roleRegistroBitacoraPermission.findMany({ where: { role } });
    return rows.map((r) => r.slotKey).filter(isRegistroBitacoraSlotKey);
  } catch {
    return [];
  }
}

export async function dbRegistroBitacoraSlotsForRole(role: string): Promise<RegistroBitacoraSlotKey[]> {
  const rows = await slotRowsForRole(role);
  if (rows.length === 0) return defaultRegistroBitacoraSlotsForRole(role);
  return rows;
}

export async function dbPuedeEditarRegistroBitacoraSlot(
  role: string,
  slot: RegistroBitacoraSlotKey,
): Promise<boolean> {
  const slots = await dbRegistroBitacoraSlotsForRole(role);
  return slots.includes(slot);
}

export function registroBitacoraSlotsToFlags(
  slots: RegistroBitacoraSlotKey[],
): Record<RegistroBitacoraSlotKey, boolean> {
  const out = Object.fromEntries(REGISTRO_BITACORA_SLOT_KEYS.map((k) => [k, false])) as Record<
    RegistroBitacoraSlotKey,
    boolean
  >;
  for (const s of slots) out[s] = true;
  return out;
}
