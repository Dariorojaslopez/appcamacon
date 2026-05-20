import prisma from './prisma';
import { parseInformeDayUtc } from './registroBitacoraFecha';

export function normalizeReportDate(dateStr: string): Date | null {
  return parseInformeDayUtc(dateStr);
}

export type JornadaResolveResult =
  | { valid: true; id: string }
  | { valid: false; status: number; error: string };

export async function resolveJornadaCatalogoId(jornadaId: string | null | undefined): Promise<JornadaResolveResult> {
  const id = (jornadaId ?? '').trim();
  if (!id) {
    return { valid: false, status: 400, error: 'jornadaId es requerido (seleccione la jornada del informe).' };
  }
  const row = await prisma.jornadaCatalog.findFirst({
    where: { id, isActive: true },
    select: { id: true },
  });
  if (!row) {
    return {
      valid: false,
      status: 400,
      error: 'Jornada no encontrada o inactiva. Configúrela en Configuración → Jornadas.',
    };
  }
  return { valid: true, id: row.id };
}

export function informeScopeWhere(projectId: string, date: Date, jornadaCatalogoId: string) {
  return { projectId, date, jornadaCatalogoId };
}
