import { NextResponse } from 'next/server';
import type { PrismaClient } from '@prisma/client';

/** Mensaje unificado para 403 cuando el informe diario (obra+fecha+jornada) está cerrado por firmas. */
export const INFORME_CERRADO_MSG =
  'Este informe está cerrado (cuatro firmas completas). No se puede editar.';

export function informeCerradoJsonResponse() {
  return NextResponse.json({ error: INFORME_CERRADO_MSG }, { status: 403 });
}

export type InformeDailyScope = {
  projectId: string;
  date: Date;
  jornadaCatalogoId: string;
};

/** Si existe un informe para el alcance y está cerrado, devuelve la respuesta 403; si no, null. */
export async function assertInformeNoCerrado(
  prisma: PrismaClient,
  scope: InformeDailyScope,
): Promise<NextResponse | null> {
  const row = await prisma.informeDiario.findFirst({
    where: scope,
    select: { informeCerrado: true },
  });
  if (row?.informeCerrado) return informeCerradoJsonResponse();
  return null;
}
