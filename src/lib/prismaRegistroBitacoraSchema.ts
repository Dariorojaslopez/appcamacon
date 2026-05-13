import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export function prismaIndicaTablaRegistroBitacoraDesactualizada(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2022' || error.code === 'P2021') return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /column .* does not exist in the current database/i.test(msg) ||
    /The column `[^`]+` does not exist/i.test(msg) ||
    /relation "registro_bitacora_obra" does not exist/i.test(msg)
  );
}

export function jsonRegistroBitacoraSchemaPendiente(): NextResponse {
  return NextResponse.json(
    {
      error:
        'La base de datos del servidor no incluye aún las columnas del registro de bitácora (fecha, consecutivo, clima). Aplique las migraciones de Prisma en producción o ejecute el SQL equivalente sobre la tabla registro_bitacora_obra.',
      code: 'REGISTRO_BITACORA_SCHEMA',
    },
    { status: 503 },
  );
}
