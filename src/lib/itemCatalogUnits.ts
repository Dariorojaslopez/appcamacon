import type { PrismaClient } from '@prisma/client';
import { isValidUnidadCodigo, resolveActiveUnidadCodigo } from './unidadCatalog';

/** Unidades por defecto (semilla en BD). */
export const ITEM_CATALOG_UNIT_VALUES = ['m3', 'm2', 'ml', 'm', 'und', 'kg', 'ton', 'l'] as const;

export const ITEM_CATALOG_UNIT_FALLBACK_OPTIONS: { value: string; label: string }[] = [
  { value: 'm3', label: 'm³ — Volumen (L × A × H)' },
  { value: 'm2', label: 'm² — Área (L × A)' },
  { value: 'ml', label: 'ml — Longitud' },
  { value: 'm', label: 'm — Longitud simple' },
  { value: 'und', label: 'und — Conteo' },
  { value: 'kg', label: 'kg — Peso' },
  { value: 'ton', label: 'ton — Peso' },
  { value: 'l', label: 'l — Litros' },
];

export function normalizeItemCatalogUnit(raw: string | null | undefined): string | null {
  let u0 = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!u0) return null;
  if (/[—–]/.test(u0)) {
    u0 = u0.split(/[—–]/)[0].trim();
  }
  const map: Record<string, string> = {
    m3: 'm3',
    'm³': 'm3',
    m2: 'm2',
    'm²': 'm2',
    ml: 'ml',
    m: 'm',
    und: 'und',
    un: 'und',
    u: 'und',
    kg: 'kg',
    ton: 'ton',
    t: 'ton',
    l: 'l',
    lt: 'l',
    litro: 'l',
    litros: 'l',
  };
  if (map[u0]) return map[u0];
  if ((ITEM_CATALOG_UNIT_VALUES as readonly string[]).includes(u0)) return u0;
  // Unidades creadas en Configuración → Unidades (código alfanumérico en catálogo)
  if (isValidUnidadCodigo(u0)) return u0;
  return null;
}

export function itemCatalogUnitLabel(value: string): string {
  const labels: Record<string, string> = {
    m3: 'm³',
    m2: 'm²',
    ml: 'ml',
    m: 'm',
    und: 'und',
    kg: 'kg',
    ton: 'ton',
    l: 'l',
  };
  return labels[value] ?? value;
}

export async function resolveItemCatalogUnidadForSave(
  prisma: PrismaClient,
  raw: string | null | undefined,
): Promise<{ ok: true; codigo: string } | { ok: false; error: string }> {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) {
    return { ok: false, error: 'La unidad es requerida' };
  }
  const codigo = await resolveActiveUnidadCodigo(prisma, trimmed, normalizeItemCatalogUnit);
  if (!codigo) {
    return {
      ok: false,
      error: 'Unidad no válida. Créela en Configuración → Unidades antes de usarla.',
    };
  }
  return { ok: true, codigo };
}
