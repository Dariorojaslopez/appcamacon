/** Unidades válidas del catálogo de ítems (compartido formulario / Excel). */
export const ITEM_CATALOG_UNIT_VALUES = ['m3', 'm2', 'ml', 'm', 'und', 'kg', 'ton', 'l'] as const;

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
