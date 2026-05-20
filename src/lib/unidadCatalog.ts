import type { PrismaClient } from '@prisma/client';

export const UNIDAD_TIPO_CALCULO_VALUES = ['m3', 'm2', 'length', 'manual', 'none'] as const;
export type UnidadTipoCalculo = (typeof UNIDAD_TIPO_CALCULO_VALUES)[number];

export const UNIDAD_TIPO_CALCULO_LABELS: Record<UnidadTipoCalculo, string> = {
  m3: 'Volumen (L × A × H)',
  m2: 'Área (L × A)',
  length: 'Longitud (L)',
  manual: 'Cantidad manual',
  none: 'Sin dimensiones (solo cantidad)',
};

const CODIGO_RE = /^[a-z0-9_]{1,32}$/;

export function isValidUnidadCodigo(codigo: string): boolean {
  return CODIGO_RE.test(codigo);
}

export function baseCodigoFromUnidadNombre(nombre: string): string {
  const s = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 28);
  return s || 'unidad';
}

export function parseUnidadTipoCalculo(raw: unknown): UnidadTipoCalculo | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  return (UNIDAD_TIPO_CALCULO_VALUES as readonly string[]).includes(v) ? (v as UnidadTipoCalculo) : null;
}

export async function uniqueUnidadCodigo(prisma: PrismaClient, base: string): Promise<string> {
  let c = base.slice(0, 32);
  let n = 0;
  for (;;) {
    const exists = await prisma.unidadCatalog.findFirst({ where: { codigo: c }, select: { id: true } });
    if (!exists) return c;
    n += 1;
    const suf = `_${n}`;
    c = (base.slice(0, Math.max(1, 32 - suf.length)) + suf).slice(0, 32);
  }
}

export async function loadActiveUnidadCodigos(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.unidadCatalog.findMany({
    where: { isActive: true },
    select: { codigo: true },
  });
  return new Set(rows.map((r) => r.codigo));
}

export async function resolveActiveUnidadCodigo(
  prisma: PrismaClient,
  raw: string | null | undefined,
  normalize: (v: string | null | undefined) => string | null,
): Promise<string | null> {
  const codigo = normalize(raw);
  if (!codigo) return null;
  const row = await prisma.unidadCatalog.findFirst({
    where: { codigo, isActive: true },
    select: { codigo: true },
  });
  return row?.codigo ?? null;
}
