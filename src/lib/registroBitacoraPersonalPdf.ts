export type PersonalPorCargoPdf = {
  cargo: string;
  total: number;
};

/** Agrupa el personal del informe por cargo y cuenta personas. */
export function agruparPersonalPorCargo(
  personal: { cargo: string | null | undefined }[],
): PersonalPorCargoPdf[] {
  const map = new Map<string, number>();
  for (const p of personal) {
    const cargo = (p.cargo ?? '').trim() || 'Sin cargo';
    map.set(cargo, (map.get(cargo) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => a.cargo.localeCompare(b.cargo, 'es'));
}
