import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../../../../src/infrastructure/auth/tokens';
import prisma from '../../../../../../src/lib/prisma';
import { parseItemCatalogExcelBuffer } from '../../../../../../src/lib/itemCatalogExcel';
import { loadActiveUnidadCodigos } from '../../../../../../src/lib/unidadCatalog';
import { assertSubchapterBelongsToProject } from '../../../../../../src/lib/budgetHierarchy';
import { importItemCatalogExcelRows } from '../../../../../../src/lib/itemCatalogImport';

const MAX_BYTES = 5 * 1024 * 1024;

async function ensureAdmin(req: NextRequest) {
  const authCookie = req.cookies.get('access_token')?.value;
  if (!authCookie) return { ok: false as const, status: 401, error: 'No autenticado' };
  const payload = verifyAccessToken(authCookie);
  if (payload.role !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'No autorizado' };
  return { ok: true as const };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await ensureAdmin(req);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const formData = await req.formData();
    const file = formData.get('file');
    const projectId = String(formData.get('projectId') ?? '').trim();
    const subchapterId = String(formData.get('subchapterId') ?? '').trim();

    if (!projectId) {
      return NextResponse.json({ error: 'Seleccione una obra (projectId).' }, { status: 400 });
    }
    if (!subchapterId) {
      return NextResponse.json(
        { error: 'Seleccione capítulo / subcapítulo en el formulario antes de importar.' },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });
    }

    const subOk = await assertSubchapterBelongsToProject(prisma, projectId, subchapterId);
    if (!subOk) {
      return NextResponse.json({ error: 'Subcapítulo no válido para esta obra' }, { status: 400 });
    }

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Archivo Excel requerido (.xlsx)' }, { status: 400 });
    }

    const blob = file as File;
    if (blob.size === 0) {
      return NextResponse.json({ error: 'Archivo vacío' }, { status: 400 });
    }
    if (blob.size > MAX_BYTES) {
      return NextResponse.json({ error: 'El archivo excede 5 MB' }, { status: 400 });
    }

    const name = (blob.name || '').toLowerCase();
    if (!name.endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Use un archivo .xlsx (plantilla descargada desde la app)' }, { status: 400 });
    }

    const buffer = Buffer.from(await blob.arrayBuffer());
    const validUnidadCodigos = await loadActiveUnidadCodigos(prisma);
    const parsed = await parseItemCatalogExcelBuffer(buffer, validUnidadCodigos);

    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      return NextResponse.json(
        {
          error: 'El Excel tiene errores y no se importó ninguna fila.',
          parseErrors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const imported = await importItemCatalogExcelRows(projectId, subchapterId, parsed.rows);
    const allErrors = [...parsed.errors, ...imported.errors];

    console.info(
      '[items/importar-excel]',
      JSON.stringify({
        projectId,
        subchapterId,
        filasLeidas: parsed.rows.length,
        creados: imported.created,
        actualizados: imported.updated,
        errores: allErrors.length,
      }),
    );

    if (allErrors.length > 0) {
      console.error('[items/importar-excel] detalle errores:', JSON.stringify(allErrors, null, 2));
    }

    const ok = imported.created + imported.updated > 0;
    return NextResponse.json(
      {
        ok,
        created: imported.created,
        updated: imported.updated,
        parseErrors: parsed.errors,
        importErrors: imported.errors,
        errors: allErrors,
        message: ok
          ? `Importación: ${imported.created} creado(s), ${imported.updated} actualizado(s).${
              allErrors.length ? ` ${allErrors.length} fila(s) con error.` : ''
            }`
          : 'No se importó ningún ítem. Revise los errores por fila.',
      },
      { status: ok ? 200 : 400 },
    );
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err?.name === 'TokenExpiredError' || err?.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[items/importar-excel] FALLO:', msg, error);
    return NextResponse.json({ error: msg || 'Error al importar Excel' }, { status: 500 });
  }
}
