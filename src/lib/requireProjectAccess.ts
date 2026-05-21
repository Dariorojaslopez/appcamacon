import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken, type JwtPayload } from '../infrastructure/auth/tokens';
import {
  findAccessibleProject,
  isUnrestrictedProjectAccess,
  listAccessibleProjectIds,
} from './userProjectAccess';

export function authFromRequest(req: NextRequest): JwtPayload | NextResponse {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  try {
    return verifyAccessToken(authCookie);
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 });
  }
}

export function isAuthPayload(v: JwtPayload | NextResponse): v is JwtPayload {
  return !(v instanceof NextResponse);
}

export async function requireAccessibleProject(
  payload: JwtPayload,
  projectId: string | null | undefined,
): Promise<NextResponse | null> {
  const id = String(projectId ?? '').trim();
  if (!id) return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
  const project = await findAccessibleProject(payload.sub, payload.role, id);
  if (!project) {
    return NextResponse.json({ error: 'No tiene permiso para esta obra' }, { status: 403 });
  }
  return null;
}

/** null = sin filtro (todas las obras activas). Array vacío = ninguna obra. */
export async function accessibleProjectIdsForUser(payload: JwtPayload): Promise<string[] | null> {
  if (isUnrestrictedProjectAccess(payload.role)) return null;
  return listAccessibleProjectIds(payload.sub);
}
