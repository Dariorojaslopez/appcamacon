import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../src/lib/prisma';
import { toYmdUtc } from '../../../../src/lib/registroBitacoraFecha';
import { authFromRequest, isAuthPayload, requireAccessibleProject } from '../../../../src/lib/requireProjectAccess';
import { loadProjectBitacoraNotify } from '../../../../src/lib/loadProjectBitacoraNotify';
import { allBitacoraNotifyRecipientIds } from '../../../../src/lib/projectBitacoraNotifyUsers';

export async function GET(req: NextRequest) {
  try {
    const auth = authFromRequest(req);
    if (!isAuthPayload(auth)) return auth;

    const projectId = req.nextUrl.searchParams.get('projectId')?.trim() ?? '';
    if (!projectId) {
      return NextResponse.json({ error: 'projectId es requerido' }, { status: 400 });
    }
    const denied = await requireAccessibleProject(auth, projectId);
    if (denied) return denied;


    const p = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        startDate: true,
        endDate: true,
        logoUrl: true,
        consecutivo: true,
        bitacoraPermitirEditarDiasAnteriores: true,
      },
    });
    if (!p) return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 404 });

    const notifyRow = await loadProjectBitacoraNotify(projectId);
    const notifyUserIds = notifyRow ? allBitacoraNotifyRecipientIds(notifyRow) : [];
    let notifyEmails: string[] = [];
    if (notifyUserIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: notifyUserIds }, isActive: true },
        select: { email: true },
      });
      const seen = new Set<string>();
      for (const u of users) {
        const e = u.email?.trim().toLowerCase();
        if (e && !seen.has(e)) {
          seen.add(e);
          notifyEmails.push(u.email.trim());
        }
      }
    }

    return NextResponse.json({
      id: p.id,
      name: p.name,
      code: p.code,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      endDate: p.endDate ? p.endDate.toISOString() : null,
      fechaMin: p.startDate ? toYmdUtc(p.startDate) : null,
      fechaMax: p.endDate ? toYmdUtc(p.endDate) : null,
      logoUrl: p.logoUrl,
      consecutivoObra: p.consecutivo,
      bitacoraNotifyConfigurado: notifyEmails.length > 0,
      bitacoraNotifyEmails: notifyEmails,
      bitacoraPermitirEditarDiasAnteriores: p.bitacoraPermitirEditarDiasAnteriores,
    });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error('GET /api/registro-bitacora/proyecto', error);
    return NextResponse.json({ error: 'Error al cargar la obra' }, { status: 500 });
  }
}
