export type EquipoMaterialPdfFila = {
  descripcion: string;
  estado: string;
};

export function mapEquiposMaterialesParaPdf(
  equipos: { descripcion: string; estado: string | null }[],
): EquipoMaterialPdfFila[] {
  return equipos.map((e) => ({
    descripcion: (e.descripcion ?? '').trim() || '—',
    estado: (e.estado ?? '').trim() || '—',
  }));
}
