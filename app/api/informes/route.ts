import { NextRequest, NextResponse } from 'next/server';
import { verifyAccessToken } from '../../../src/infrastructure/auth/tokens';
import prisma from '../../../src/lib/prisma';
import { resolveJornadaCatalogoId } from '../../../src/lib/informeDailyScope';
import { informeCerradoJsonResponse } from '../../../src/lib/informeCerrado';

function padNumber(value: number, width: number): string {
  return String(value).padStart(width, '0');
}

/** null = no tocar frente en el PATCH; error = 400 */
async function resolveFrenteObraForPatch(
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ frenteObra: string | null; frenteObraCatalogoId: string | null } | { error: string } | null> {
  if (!('frenteObra' in body) && !('frenteObraCatalogoId' in body)) return null;

  const catalogId = body.frenteObraCatalogoId;
  const texto = body.frenteObra;

  const cidRaw =
    catalogId != null && String(catalogId).trim() ? String(catalogId).trim() : '';
  const useCatalog = Boolean(cidRaw && cidRaw !== 'local');

  if (useCatalog) {
    const cat = await prisma.frenteObraCatalog.findFirst({
      where: { id: cidRaw, projectId, isActive: true },
    });
    if (!cat) return { error: 'Frente de obra no válido para esta obra' };
    return { frenteObra: cat.nombre, frenteObraCatalogoId: cat.id };
  }

  const t = texto != null && String(texto).trim() ? String(texto).trim() : null;
  return { frenteObra: t, frenteObraCatalogoId: null };
}

/** null = no tocar contratista en el PATCH; error = 400 */
async function resolveContratistaForPatch(
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ contratista: string | null; contratistaCatalogoId: string | null } | { error: string } | null> {
  if (!('contratista' in body) && !('contratistaCatalogoId' in body)) return null;

  const catalogId = body.contratistaCatalogoId;
  const texto = body.contratista;

  const cidRaw =
    catalogId != null && String(catalogId).trim() ? String(catalogId).trim() : '';
  const useCatalog = Boolean(cidRaw && cidRaw !== 'local');

  if (useCatalog) {
    const cat = await prisma.contratistaCatalog.findFirst({
      where: { id: cidRaw, projectId, isActive: true },
    });
    if (!cat) return { error: 'Contratista no válido para esta obra' };
    return { contratista: cat.nombre, contratistaCatalogoId: cat.id };
  }

  const t = texto != null && String(texto).trim() ? String(texto).trim() : null;
  return { contratista: t, contratistaCatalogoId: null };
}

/** null = no tocar encargado en el PATCH; error = 400 */
async function resolveEncargadoReporteForPatch(
  projectId: string,
  body: Record<string, unknown>,
): Promise<
  { encargadoReporte: string | null; encargadoReporteCatalogoId: string | null } | { error: string } | null
> {
  if (!('encargadoReporte' in body) && !('encargadoReporteCatalogoId' in body)) return null;

  const catalogId = body.encargadoReporteCatalogoId;
  const texto = body.encargadoReporte;

  const cidRaw =
    catalogId != null && String(catalogId).trim() ? String(catalogId).trim() : '';
  const useCatalog = Boolean(cidRaw && cidRaw !== 'local');

  if (useCatalog) {
    const cat = await prisma.encargadoReporteCatalog.findFirst({
      where: { id: cidRaw, projectId, isActive: true },
    });
    if (!cat) return { error: 'Encargado de reporte no válido para esta obra' };
    return { encargadoReporte: cat.nombre, encargadoReporteCatalogoId: cat.id };
  }

  const t = texto != null && String(texto).trim() ? String(texto).trim() : null;
  return { encargadoReporte: t, encargadoReporteCatalogoId: null };
}

/** null = no tocar cargo en el PATCH; error = 400 */
async function resolveCargoForPatch(
  projectId: string,
  body: Record<string, unknown>,
): Promise<{ cargo: string | null; cargoCatalogoId: string | null } | { error: string } | null> {
  if (!('cargo' in body) && !('cargoCatalogoId' in body)) return null;

  const catalogId = body.cargoCatalogoId;
  const texto = body.cargo;

  const cidRaw =
    catalogId != null && String(catalogId).trim() ? String(catalogId).trim() : '';
  const useCatalog = Boolean(cidRaw && cidRaw !== 'local');

  if (useCatalog) {
    const cat = await prisma.cargoCatalog.findFirst({
      where: { id: cidRaw, projectId, isActive: true },
    });
    if (!cat) return { error: 'Cargo no válido para esta obra' };
    return { cargo: cat.nombre, cargoCatalogoId: cat.id };
  }

  const t = texto != null && String(texto).trim() ? String(texto).trim() : null;
  return { cargo: t, cargoCatalogoId: null };
}

export async function POST(req: NextRequest) {
  try {
    const authCookie = req.cookies.get('access_token')?.value;
    if (!authCookie) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
    const payload = verifyAccessToken(authCookie);
    const userId = payload.sub as string;

    const body = (await req.json()) as {
      projectId: string;
      date: string;
      jornadaId?: string;
      jornadaCatalogoId?: string;
      frenteObra?: string;
      frenteObraCatalogoId?: string | null;
      contratista?: string;
      contratistaCatalogoId?: string | null;
      encargadoReporte?: string;
      encargadoReporteCatalogoId?: string | null;
      cargo?: string;
      cargoCatalogoId?: string | null;
      horaEntrada?: string;
      horaSalida?: string;
      huboSuspension?: boolean;
      motivoSuspension?: string;
      horaSuspension?: string;
      horaReinicio?: string;
      tipoClima?: string;
      horasClima?: number;
      condiciones?: string;
      actividades?: string;
      incidentes?: string;
    };

    const { projectId, date } = body;
    if (!projectId || !date) {
      return NextResponse.json(
        { error: 'Obra (projectId) y fecha son requeridos' },
        { status: 400 },
      );
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, isActive: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Obra no encontrada o inactiva' }, { status: 400 });
    }

    const reportDate = new Date(date);
    if (Number.isNaN(reportDate.getTime())) {
      return NextResponse.json({ error: 'Fecha no válida' }, { status: 400 });
    }
    reportDate.setUTCHours(0, 0, 0, 0);

    const jr = await resolveJornadaCatalogoId(body.jornadaId ?? body.jornadaCatalogoId);
    if (jr.valid === false) {
      return NextResponse.json({ error: jr.error }, { status: jr.status });
    }

    const existing = await prisma.informeDiario.findFirst({
      where: { projectId, date: reportDate, jornadaCatalogoId: jr.id },
      select: { id: true, informeCerrado: true },
    });

    if (existing) {
      if (existing.informeCerrado) return informeCerradoJsonResponse();

      const frentePatch = await resolveFrenteObraForPatch(projectId, body as Record<string, unknown>);
      if (frentePatch && 'error' in frentePatch) {
        return NextResponse.json({ error: frentePatch.error }, { status: 400 });
      }
      const frentePatchOk = frentePatch && !('error' in frentePatch) ? frentePatch : null;

      const contratistaPatch = await resolveContratistaForPatch(projectId, body as Record<string, unknown>);
      if (contratistaPatch && 'error' in contratistaPatch) {
        return NextResponse.json({ error: contratistaPatch.error }, { status: 400 });
      }
      const contratistaPatchOk = contratistaPatch && !('error' in contratistaPatch) ? contratistaPatch : null;

      const encargadoPatch = await resolveEncargadoReporteForPatch(projectId, body as Record<string, unknown>);
      if (encargadoPatch && 'error' in encargadoPatch) {
        return NextResponse.json({ error: encargadoPatch.error }, { status: 400 });
      }
      const encargadoPatchOk = encargadoPatch && !('error' in encargadoPatch) ? encargadoPatch : null;

      const cargoPatch = await resolveCargoForPatch(projectId, body as Record<string, unknown>);
      if (cargoPatch && 'error' in cargoPatch) {
        return NextResponse.json({ error: cargoPatch.error }, { status: 400 });
      }
      const cargoPatchOk = cargoPatch && !('error' in cargoPatch) ? cargoPatch : null;

      const informe = await prisma.informeDiario.update({
        where: { id: existing.id },
        data: {
          userId, // último usuario que editó
          huboSuspension: body.huboSuspension ?? false,
          motivoSuspension: body.motivoSuspension?.trim() || null,
          horaSuspension: body.horaSuspension?.trim() || null,
          horaReinicio: body.horaReinicio?.trim() || null,
          tipoClima: body.tipoClima?.trim() || null,
          horasClima: typeof body.horasClima === 'number' ? body.horasClima : null,
          ...(frentePatchOk
            ? {
                frenteObra: frentePatchOk.frenteObra,
                frenteObraCatalogoId: frentePatchOk.frenteObraCatalogoId,
              }
            : {}),
          ...(contratistaPatchOk
            ? {
                contratista: contratistaPatchOk.contratista,
                contratistaCatalogoId: contratistaPatchOk.contratistaCatalogoId,
              }
            : {}),
          ...(encargadoPatchOk
            ? {
                encargadoReporte: encargadoPatchOk.encargadoReporte,
                encargadoReporteCatalogoId: encargadoPatchOk.encargadoReporteCatalogoId,
              }
            : {}),
          ...(cargoPatchOk
            ? { cargo: cargoPatchOk.cargo, cargoCatalogoId: cargoPatchOk.cargoCatalogoId }
            : {}),
          horaEntrada: body.horaEntrada?.trim() || null,
          horaSalida: body.horaSalida?.trim() || null,
          condiciones: body.condiciones?.trim() || null,
          actividades: body.actividades?.trim() || null,
          incidentes: body.incidentes?.trim() || null,
        },
      });
      return NextResponse.json({ informe, upsert: 'updated' }, { status: 200 });
    }

    const maxByProject = await prisma.informeDiario.aggregate({
      where: { projectId },
      _max: { informeConsecutivo: true, centroTrabajoConsecutivo: true },
    });

    const nextInformeConsecutivo = (maxByProject._max.informeConsecutivo ?? 0) + 1;
    const nextCentroTrabajoConsecutivo = (maxByProject._max.centroTrabajoConsecutivo ?? 0) + 1;

    const year = reportDate.getUTCFullYear();
    const informeNo = `IDO-${year}-${padNumber(nextInformeConsecutivo, 3)}`;
    const centroTrabajo = `CT-${padNumber(nextCentroTrabajoConsecutivo, 3)}`;

    let frenteObraFinal: string | null = body.frenteObra?.trim() || null;
    let frenteObraCatalogoFinal: string | null = null;
    const frenteCreatePatch = await resolveFrenteObraForPatch(projectId, body as Record<string, unknown>);
    if (frenteCreatePatch && 'error' in frenteCreatePatch) {
      return NextResponse.json({ error: frenteCreatePatch.error }, { status: 400 });
    }
    if (frenteCreatePatch && !('error' in frenteCreatePatch)) {
      frenteObraFinal = frenteCreatePatch.frenteObra;
      frenteObraCatalogoFinal = frenteCreatePatch.frenteObraCatalogoId;
    }

    let contratistaFinal: string | null = body.contratista?.trim() || null;
    let contratistaCatalogoFinal: string | null = null;
    const contratistaCreatePatch = await resolveContratistaForPatch(projectId, body as Record<string, unknown>);
    if (contratistaCreatePatch && 'error' in contratistaCreatePatch) {
      return NextResponse.json({ error: contratistaCreatePatch.error }, { status: 400 });
    }
    if (contratistaCreatePatch && !('error' in contratistaCreatePatch)) {
      contratistaFinal = contratistaCreatePatch.contratista;
      contratistaCatalogoFinal = contratistaCreatePatch.contratistaCatalogoId;
    }

    let encargadoReporteFinal: string | null = body.encargadoReporte?.trim() || null;
    let encargadoReporteCatalogoFinal: string | null = null;
    const encargadoCreatePatch = await resolveEncargadoReporteForPatch(projectId, body as Record<string, unknown>);
    if (encargadoCreatePatch && 'error' in encargadoCreatePatch) {
      return NextResponse.json({ error: encargadoCreatePatch.error }, { status: 400 });
    }
    if (encargadoCreatePatch && !('error' in encargadoCreatePatch)) {
      encargadoReporteFinal = encargadoCreatePatch.encargadoReporte;
      encargadoReporteCatalogoFinal = encargadoCreatePatch.encargadoReporteCatalogoId;
    }

    let cargoFinal: string | null = body.cargo?.trim() || null;
    let cargoCatalogoFinal: string | null = null;
    const cargoCreatePatch = await resolveCargoForPatch(projectId, body as Record<string, unknown>);
    if (cargoCreatePatch && 'error' in cargoCreatePatch) {
      return NextResponse.json({ error: cargoCreatePatch.error }, { status: 400 });
    }
    if (cargoCreatePatch && !('error' in cargoCreatePatch)) {
      cargoFinal = cargoCreatePatch.cargo;
      cargoCatalogoFinal = cargoCreatePatch.cargoCatalogoId;
    }

    const informe = await prisma.informeDiario.create({
      data: {
        userId,
        projectId,
        date: reportDate,
        jornadaCatalogoId: jr.id,
        informeConsecutivo: nextInformeConsecutivo,
        informeNo,
        centroTrabajoConsecutivo: nextCentroTrabajoConsecutivo,
        centroTrabajo,
        huboSuspension: body.huboSuspension ?? false,
        motivoSuspension: body.motivoSuspension?.trim() || null,
        horaSuspension: body.horaSuspension?.trim() || null,
        horaReinicio: body.horaReinicio?.trim() || null,
        tipoClima: body.tipoClima?.trim() || null,
        horasClima: typeof body.horasClima === 'number' ? body.horasClima : null,
        frenteObra: frenteObraFinal,
        frenteObraCatalogoId: frenteObraCatalogoFinal,
        contratista: contratistaFinal,
        contratistaCatalogoId: contratistaCatalogoFinal,
        encargadoReporte: encargadoReporteFinal,
        encargadoReporteCatalogoId: encargadoReporteCatalogoFinal,
        cargo: cargoFinal,
        cargoCatalogoId: cargoCatalogoFinal,
        horaEntrada: body.horaEntrada?.trim() || null,
        horaSalida: body.horaSalida?.trim() || null,
        condiciones: body.condiciones?.trim() || null,
        actividades: body.actividades?.trim() || null,
        incidentes: body.incidentes?.trim() || null,
      },
    });

    return NextResponse.json({ informe, upsert: 'created' }, { status: 201 });
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: 'Sesión expirada' }, { status: 401 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Error al guardar informe' }, { status: 500 });
  }
}
