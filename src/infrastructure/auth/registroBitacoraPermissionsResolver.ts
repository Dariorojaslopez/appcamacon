import prisma from '../../lib/prisma';
import {
  REGISTRO_BITACORA_CONFIGURED_MARKER,
  REGISTRO_BITACORA_SLOT_KEYS,
  type RegistroBitacoraSlotKey,
  defaultRegistroBitacoraSlotsForRole,
  isRegistroBitacoraSlotKey,
} from '../../shared/registroBitacoraPermissions';

async function bitacoraPermissionStateForRole(role: string): Promise<{
  configured: boolean;
  slots: RegistroBitacoraSlotKey[];
}> {
  try {
    const rows = await prisma.roleRegistroBitacoraPermission.findMany({ where: { role } });
    const configured = rows.some((r) => r.slotKey === REGISTRO_BITACORA_CONFIGURED_MARKER);
    const slots = rows.map((r) => r.slotKey).filter(isRegistroBitacoraSlotKey);
    return { configured, slots };
  } catch {
    return { configured: false, slots: [] };
  }
}

export async function dbRegistroBitacoraSlotsForRole(role: string): Promise<RegistroBitacoraSlotKey[]> {
  const { configured, slots } = await bitacoraPermissionStateForRole(role);
  if (configured) return slots;
  if (slots.length > 0) return slots;
  return defaultRegistroBitacoraSlotsForRole(role);
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
