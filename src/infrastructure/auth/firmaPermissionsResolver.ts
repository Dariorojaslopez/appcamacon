import prisma from '../../lib/prisma';
import {
  FIRMA_PERM_TOKEN,
  FIRMA_SLOT_KEYS,
  type FirmaSlotKey,
  defaultFirmaPermisosPorSlot,
  defaultPuedeFirmarEnSlot,
  defaultRoleTieneTokenFirma,
} from '../../shared/firmaPolicies';

/** Si la tabla aún no existe (migración pendiente), no romper: usar defaults. */
async function firmaRowsForRole(role: string) {
  try {
    return await prisma.roleFirmaPermission.findMany({ where: { role } });
  } catch {
    return [];
  }
}

export async function dbRoleTieneTokenFirma(role: string): Promise<boolean> {
  const rows = await firmaRowsForRole(role);
  if (rows.length === 0) return defaultRoleTieneTokenFirma(role);
  return rows.some((r) => r.permKey === FIRMA_PERM_TOKEN);
}

export async function dbPuedeFirmarEnSlot(role: string, slot: FirmaSlotKey): Promise<boolean> {
  const rows = await firmaRowsForRole(role);
  if (rows.length === 0) return defaultPuedeFirmarEnSlot(role, slot);
  const keys = new Set(rows.map((r) => r.permKey));
  return keys.has(FIRMA_PERM_TOKEN) && keys.has(slot);
}

export async function dbFirmaPermisosPorSlot(role: string): Promise<Record<FirmaSlotKey, boolean>> {
  const out: Record<FirmaSlotKey, boolean> = {
    responsableDiligenciamiento: false,
    residenteObra: false,
    auxiliarIngenieria: false,
    vistoBuenoDirectorObra: false,
  };
  const rows = await firmaRowsForRole(role);
  if (rows.length === 0) return defaultFirmaPermisosPorSlot(role);
  const keys = new Set(rows.map((r) => r.permKey));
  const hasToken = keys.has(FIRMA_PERM_TOKEN);
  for (const slot of FIRMA_SLOT_KEYS) {
    out[slot] = hasToken && keys.has(slot);
  }
  return out;
}
