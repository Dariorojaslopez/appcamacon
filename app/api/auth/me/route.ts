import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import { generarTokenFirma } from '../../../../src/infrastructure/auth/firmaToken';
import {
  dbFirmaPermisosPorSlot,
  dbRoleTieneTokenFirma,
} from '../../../../src/infrastructure/auth/firmaPermissionsResolver';
import prisma from '../../../../src/lib/prisma';

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let payload;
  try {
    payload = verifyAccessToken(accessToken);
  } catch (error: unknown) {
    console.error('auth/me verify token:', error);
    return NextResponse.json({ error: 'Sesión inválida o expirada' }, { status: 401 });
  }

  let allowedMenus: string[] = [];
  try {
    const permissions = await prisma.roleMenuPermission.findMany({
      where: { role: payload.role },
      select: { menuKey: true },
    });
    allowedMenus = permissions.map((p) => p.menuKey);
  } catch (error: unknown) {
    console.error('auth/me permisos:', error);
  }

  const role = payload.role;
  const puedeVerToken = await dbRoleTieneTokenFirma(role);
  const firmaToken = puedeVerToken ? generarTokenFirma(payload.sub, role) : null;
  const firmaSlotPermissions = await dbFirmaPermisosPorSlot(role);

  return NextResponse.json({
    user: {
      id: payload.sub,
      identification: payload.identification,
      email: payload.email,
      name: payload.name,
      role,
    },
    allowedMenus,
    firmaToken,
    firmaSlotPermissions,
  });
}
