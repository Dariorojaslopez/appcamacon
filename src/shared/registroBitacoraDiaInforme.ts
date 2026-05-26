export const REGISTRO_MANUAL_PERSONAL_MAX = 20;
export const REGISTRO_MANUAL_EQUIPOS_MAX = 20;

export type RegistroPersonalManualRow = {
  cargo: string;
  total: number;
};

export type RegistroEquipoManualRow = {
  descripcion: string;
  estado: string;
};

export type RegistroClimaFranjasForm = {
  manana: string;
  tarde: string;
  noche: string;
};

export function emptyRegistroClimaFranjasForm(): RegistroClimaFranjasForm {
  return { manana: '', tarde: '', noche: '' };
}

export function emptyRegistroPersonalManualRow(): RegistroPersonalManualRow {
  return { cargo: '', total: 0 };
}

export function emptyRegistroEquipoManualRow(): RegistroEquipoManualRow {
  return { descripcion: '', estado: '' };
}
