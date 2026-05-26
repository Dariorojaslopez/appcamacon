/** Rol con acceso total; no debe quedar inactivo por flujos automáticos. */
export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return role === SUPER_ADMIN_ROLE;
}
