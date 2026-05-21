import { NextRequest, NextResponse } from 'next/server';
import { authFromRequest, isAuthPayload } from '../../../src/lib/requireProjectAccess';
import { listAccessibleProjects } from '../../../src/lib/userProjectAccess';

/** Lista obras activas asignadas al usuario (selector en informes). SUPER_ADMIN ve todas. */
export async function GET(req: NextRequest) {
  try {
    const auth = authFromRequest(req);
    if (!isAuthPayload(auth)) return auth;

    const obras = await listAccessibleProjects(auth.sub, auth.role);
    return NextResponse.json({
      obras: obras.map((o) => ({
        id: o.id,
        consecutivo: o.consecutivo,
        name: o.name,
        code: o.code,
      })),
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al listar obras' }, { status: 500 });
  }
}
