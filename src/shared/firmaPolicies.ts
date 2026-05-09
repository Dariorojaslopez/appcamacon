/**
 * Valores por defecto de firma (si un rol no tiene filas en RoleFirmaPermission).
 * La configuración efectiva se administra en Usuarios → Permisos de firma (Evidencias).
 */

export const FIRMA_PERM_TOKEN = 'token';

export const FIRMA_SLOT_KEYS = [
  'responsableDiligenciamiento',
  'residenteObra',
  'auxiliarIngenieria',
  'vistoBuenoDirectorObra',
] as const;

export type FirmaSlotKey = (typeof FIRMA_SLOT_KEYS)[number];

/** Columnas del panel admin (orden) */
export const FIRMA_PERM_ADMIN_KEYS = ['token', ...FIRMA_SLOT_KEYS] as const;

export const FIRMA_PERM_LABELS: Record<(typeof FIRMA_PERM_ADMIN_KEYS)[number], string> = {
  token: 'Código barra',
  responsableDiligenciamiento: 'Firma · Responsable diligenciamiento',
  residenteObra: 'Firma · Residente de obra',
  auxiliarIngenieria: 'Firma · Auxiliar de ingeniería',
  vistoBuenoDirectorObra: 'Firma · Visto bueno director',
};

export const FIRMA_SLOT_LABELS: Record<FirmaSlotKey, string> = {
  responsableDiligenciamiento: 'Responsable de diligenciamiento',
  residenteObra: 'Residente de obra',
  auxiliarIngenieria: 'Auxiliar de ingeniería',
  vistoBuenoDirectorObra: 'Visto bueno director de obra',
};

const DEFAULT_ROLES_CON_TOKEN = new Set([
  'SUPER_ADMIN',
  'DIRECTOR',
  'RESIDENTE_TECNICO',
  'INSPECTOR_TECNICO',
  'INSPECTOR_SSTMA',
]);

const DEFAULT_FIRMA_ROLES_POR_SLOT: Record<FirmaSlotKey, readonly string[]> = {
  responsableDiligenciamiento: ['INSPECTOR_TECNICO', 'INSPECTOR_SSTMA', 'SUPER_ADMIN', 'DIRECTOR'],
  residenteObra: ['RESIDENTE_TECNICO', 'SUPER_ADMIN', 'DIRECTOR'],
  auxiliarIngenieria: ['INSPECTOR_TECNICO', 'INSPECTOR_SSTMA', 'SUPER_ADMIN', 'DIRECTOR'],
  vistoBuenoDirectorObra: ['DIRECTOR', 'SUPER_ADMIN'],
};

/** Fallback cuando no hay registros en BD para el rol */
export function defaultRoleTieneTokenFirma(role: string): boolean {
  return DEFAULT_ROLES_CON_TOKEN.has(role);
}

export function defaultPuedeFirmarEnSlot(role: string, slot: FirmaSlotKey): boolean {
  if (!defaultRoleTieneTokenFirma(role)) return false;
  return (DEFAULT_FIRMA_ROLES_POR_SLOT[slot] as readonly string[]).includes(role);
}

export function defaultFirmaPermisosPorSlot(role: string): Record<FirmaSlotKey, boolean> {
  return {
    responsableDiligenciamiento: defaultPuedeFirmarEnSlot(role, 'responsableDiligenciamiento'),
    residenteObra: defaultPuedeFirmarEnSlot(role, 'residenteObra'),
    auxiliarIngenieria: defaultPuedeFirmarEnSlot(role, 'auxiliarIngenieria'),
    vistoBuenoDirectorObra: defaultPuedeFirmarEnSlot(role, 'vistoBuenoDirectorObra'),
  };
}
