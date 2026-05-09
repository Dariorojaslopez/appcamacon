import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../src/lib/prisma';
import { MENU_KEYS } from '../../../../../src/shared/menuPermissions';
import {
  FIRMA_PERM_ADMIN_KEYS,
  FIRMA_PERM_TOKEN,
  FIRMA_SLOT_KEYS,
} from '../../../../../src/shared/firmaPolicies';

export async function GET(req: NextRequest) {
  const accessToken = req.cookies.get('access_token')?.value;
  if (!accessToken) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  let payload;
  try {
    payload = verifyAccessToken(accessToken);
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error('roles/permissions verify:', error);
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (payload.role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  try {
    const roleLabels = await prisma.roleLabel.findMany({ orderBy: { role: 'asc' } });
    const all = await prisma.roleMenuPermission.findMany();
    let allFirma: { role: string; permKey: string }[] = [];
    try {
      allFirma = await prisma.roleFirmaPermission.findMany();
    } catch (firmaErr) {
      console.warn(
        '[permisos] RoleFirmaPermission no disponible. Ejecuta: npx prisma db push',
        firmaErr,
      );
    }
    const byRole: Record<string, string[]> = {};
    for (const r of roleLabels) {
      byRole[r.role] = all.filter((p) => p.role === r.role).map((p) => p.menuKey);
    }
    const byRoleFirma: Record<string, string[]> = {};
    for (const r of roleLabels) {
      byRoleFirma[r.role] = allFirma.filter((p) => p.role === r.role).map((p) => p.permKey);
    }

    return NextResponse.json({
      roles: roleLabels.map((r) => ({
        role: r.role,
        label: r.label,
        menuKeys: byRole[r.role] ?? [],
        firmaPermKeys: byRoleFirma[r.role] ?? [],
      })),
      menuKeys: [...MENU_KEYS],
      firmaPermKeysCatalog: [...FIRMA_PERM_ADMIN_KEYS],
    });
  } catch (error: unknown) {
    console.error('GET /api/admin/roles/permissions:', error);
    return NextResponse.json(
      {
        error: 'Error al cargar permisos. Comprueba que las tablas existan (npx prisma db push && npx prisma db seed).',
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const accessToken = req.cookies.get('access_token')?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = verifyAccessToken(accessToken);
    if (payload.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }

    const body = await req.json();
    const { role, menuKeys, firmaPermKeys } = body as {
      role?: string;
      menuKeys?: string[];
      firmaPermKeys?: string[];
    };
    if (!role || !Array.isArray(menuKeys)) {
      return NextResponse.json(
        { error: 'Se requieren role y menuKeys (array)' },
        { status: 400 },
      );
    }
    const roleExists = await prisma.roleLabel.findUnique({ where: { role } });
    if (!roleExists) {
      return NextResponse.json(
        { error: 'El rol no existe. Créelo en Administrar roles.' },
        { status: 400 },
      );
    }

    const validKeys = menuKeys.filter((k: string) =>
      MENU_KEYS.includes(k as (typeof MENU_KEYS)[number]),
    );

    await prisma.roleMenuPermission.deleteMany({ where: { role } });

    if (validKeys.length > 0) {
      await prisma.roleMenuPermission.createMany({
        data: validKeys.map((menuKey: string) => ({ role, menuKey })),
        skipDuplicates: true,
      });
    }

    const allowedFirma = new Set<string>([FIRMA_PERM_TOKEN, ...FIRMA_SLOT_KEYS]);
    if (firmaPermKeys !== undefined) {
      if (!Array.isArray(firmaPermKeys)) {
        return NextResponse.json({ error: 'firmaPermKeys debe ser un array' }, { status: 400 });
      }
      const validFirma = firmaPermKeys.filter(
        (k: string) => typeof k === 'string' && allowedFirma.has(k),
      ) as string[];
      await prisma.roleFirmaPermission.deleteMany({ where: { role } });
      if (validFirma.length > 0) {
        await prisma.roleFirmaPermission.createMany({
          data: validFirma.map((permKey) => ({ role, permKey })),
          skipDuplicates: true,
        });
      }
    }

    const firmaSaved = await prisma.roleFirmaPermission.findMany({ where: { role } });

    return NextResponse.json({
      role,
      menuKeys: validKeys,
      firmaPermKeys: firmaSaved.map((r) => r.permKey),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al guardar permisos';
    console.error('PUT /api/admin/roles/permissions:', error);
    return NextResponse.json(
      { error: message, details: error instanceof Error ? error.stack : undefined },
      { status: 500 },
    );
  }
}
