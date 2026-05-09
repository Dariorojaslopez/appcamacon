/**
 * Modelo financiero tipo hoja BASE (tabulación): costos, retenciones, estampillas, ingreso neto y utilidad.
 * Porcentajes centralizados en {@link DEFAULT_BASE_FINANCIERO_CONFIG} para extensión sin romper filas existentes.
 */

export type BaseFinancieroRates = {
  calificacion: number;
  amortizacion: number;
  retencion6: number;
  reteIca: number;
  retencionRenta: number;
  contribucionEspecial: number;
  estampillaUniversidadDistrital: number;
  estampillaProCultura: number;
  estampillaProPersonasMayores: number;
  estampillaUniversidadPedagogica: number;
  costoEjecucionBcEntidad: number;
};

export type BaseFinancieroConfig = {
  rubroDefault: string;
  rates: BaseFinancieroRates;
  /** Nuevas claves se suman en descuentos si `incluirEnDescuento` es true (extensible). */
  impuestosExtra: Array<{
    key: string;
    label: string;
    rate: number;
    incluirEnDescuento: boolean;
  }>;
};

export const DEFAULT_BASE_FINANCIERO_CONFIG: BaseFinancieroConfig = {
  rubroDefault: '1. OBRA',
  rates: {
    calificacion: 1,
    amortizacion: 0.2,
    retencion6: 0.06,
    reteIca: 0.0076,
    retencionRenta: 0.025,
    contribucionEspecial: 0.05,
    estampillaUniversidadDistrital: 0.01,
    estampillaProCultura: 0.005,
    estampillaProPersonasMayores: 0.02,
    estampillaUniversidadPedagogica: 0.005,
    costoEjecucionBcEntidad: 0.7,
  },
  impuestosExtra: [],
};

export type PrecioTabulacionInput = {
  /** ITEM → identificador (código contractual). */
  itemId: string;
  descripcion: string;
  observaciones?: string;
  unidad?: string | null;
  cantidad: number;
  valorUnitario: number;
  rubro?: string;
};

export type BaseFinancieroFila = {
  rubro: string;
  idItem: string;
  descripcion: string;
  observaciones: string;
  unidad: string;
  cantidadActa: number;
  valorUnitario: number;
  totalBase: number;
  costoTotalConAiuEntidad: number;
  calificacion: number;
  costoTotalConAiuEntidadCalificacion: number;
  amortizacion: number;
  retencion6: number;
  totalAPagar: number;
  reteIca: number;
  retencionRenta: number;
  contribucionEspecial: number;
  estampillaUniversidadDistrital: number;
  estampillaProCultura: number;
  estampillaProPersonasMayores: number;
  estampillaUniversidadPedagogica: number;
  descuentoImpuestosYEstampillas: number;
  totalIngresoAlBanco: number;
  costoEjecucionConBcEntidad: number;
  utilidadActaCobro: number;
  /** Montos de impuestos extra (misma clave que config). */
  impuestosExtraMontos: Record<string, number>;
};

function roundMoney(n: number, decimals = 2): number {
  if (!Number.isFinite(n)) return 0;
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
}

function asFinite(n: unknown, fallback = 0): number {
  const x = typeof n === 'number' ? n : Number(n);
  return Number.isFinite(x) ? x : fallback;
}

export function mergeBaseFinancieroConfig(
  partial: Partial<BaseFinancieroConfig> & { rates?: Partial<BaseFinancieroRates> },
): BaseFinancieroConfig {
  const rates: BaseFinancieroRates = {
    ...DEFAULT_BASE_FINANCIERO_CONFIG.rates,
    ...partial.rates,
  };
  return {
    rubroDefault: partial.rubroDefault ?? DEFAULT_BASE_FINANCIERO_CONFIG.rubroDefault,
    rates,
    impuestosExtra: Array.isArray(partial.impuestosExtra)
      ? partial.impuestosExtra
      : DEFAULT_BASE_FINANCIERO_CONFIG.impuestosExtra,
  };
}

/**
 * Una fila BASE a partir de cantidad × valor unitario y la configuración de tasas.
 */
export function calcularFilaBaseFinanciero(
  input: PrecioTabulacionInput,
  config: BaseFinancieroConfig = DEFAULT_BASE_FINANCIERO_CONFIG,
): BaseFinancieroFila {
  const cantidad = roundMoney(asFinite(input.cantidad), 6);
  const valorUnitario = roundMoney(asFinite(input.valorUnitario), 6);
  const totalBase = roundMoney(cantidad * valorUnitario, 2);
  const r = config.rates;

  const costoTotalConAiuEntidad = roundMoney(totalBase, 2);
  const calificacion = asFinite(r.calificacion, 1);
  const costoTotalConAiuEntidadCalificacion = roundMoney(totalBase * calificacion, 2);
  const amortizacion = roundMoney(totalBase * r.amortizacion, 2);
  const retencion6 = roundMoney(totalBase * r.retencion6, 2);
  const totalAPagar = roundMoney(totalBase - amortizacion - retencion6, 2);

  const reteIca = roundMoney(totalBase * r.reteIca, 2);
  const retencionRenta = roundMoney(totalBase * r.retencionRenta, 2);
  const contribucionEspecial = roundMoney(totalBase * r.contribucionEspecial, 2);
  const estampillaUniversidadDistrital = roundMoney(totalBase * r.estampillaUniversidadDistrital, 2);
  const estampillaProCultura = roundMoney(totalBase * r.estampillaProCultura, 2);
  const estampillaProPersonasMayores = roundMoney(totalBase * r.estampillaProPersonasMayores, 2);
  const estampillaUniversidadPedagogica = roundMoney(totalBase * r.estampillaUniversidadPedagogica, 2);

  const impuestosExtraMontos: Record<string, number> = {};
  let sumaExtraDescuento = 0;
  for (const ext of config.impuestosExtra) {
    const m = roundMoney(totalBase * asFinite(ext.rate), 2);
    impuestosExtraMontos[ext.key] = m;
    if (ext.incluirEnDescuento) sumaExtraDescuento += m;
  }

  const descuentoImpuestosYEstampillas = roundMoney(
    reteIca +
      retencionRenta +
      contribucionEspecial +
      estampillaUniversidadDistrital +
      estampillaProCultura +
      estampillaProPersonasMayores +
      estampillaUniversidadPedagogica +
      sumaExtraDescuento,
    2,
  );

  const totalIngresoAlBanco = roundMoney(totalAPagar - descuentoImpuestosYEstampillas, 2);
  const costoEjecucionConBcEntidad = roundMoney(totalBase * r.costoEjecucionBcEntidad, 2);
  const utilidadActaCobro = roundMoney(totalIngresoAlBanco - costoEjecucionConBcEntidad, 2);

  return {
    rubro: (input.rubro ?? '').trim() || config.rubroDefault,
    idItem: String(input.itemId ?? '').trim(),
    descripcion: String(input.descripcion ?? '').trim(),
    observaciones: String(input.observaciones ?? '').trim(),
    unidad: String(input.unidad ?? '').trim(),
    cantidadActa: cantidad,
    valorUnitario,
    totalBase,
    costoTotalConAiuEntidad,
    calificacion,
    costoTotalConAiuEntidadCalificacion,
    amortizacion,
    retencion6,
    totalAPagar,
    reteIca,
    retencionRenta,
    contribucionEspecial,
    estampillaUniversidadDistrital,
    estampillaProCultura,
    estampillaProPersonasMayores,
    estampillaUniversidadPedagogica,
    descuentoImpuestosYEstampillas,
    totalIngresoAlBanco,
    costoEjecucionConBcEntidad,
    utilidadActaCobro,
    impuestosExtraMontos,
  };
}

export function construirBaseFinancieroDesdePrecios(
  items: PrecioTabulacionInput[],
  config?: BaseFinancieroConfig,
): BaseFinancieroFila[] {
  const cfg = config ?? DEFAULT_BASE_FINANCIERO_CONFIG;
  return items.map((row) => calcularFilaBaseFinanciero(row, cfg));
}

/** Índice de columna 1-based → letra Excel (A, B, …, Z, AA, …). */
export function excelColumnLetter(index1Based: number): string {
  let n = index1Based;
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Mapea fila de catálogo de ítems (precios) al input del modelo BASE. */
export function mapItemCatalogoAPrecioInput(row: {
  codigo: string;
  descripcion: string;
  unidad?: string | null;
  cantidad?: number | null;
  precioUnitario?: number | null;
  observaciones?: string | null;
  rubro?: string | null;
}): PrecioTabulacionInput {
  return {
    itemId: String(row.codigo ?? '').trim(),
    descripcion: String(row.descripcion ?? '').trim(),
    observaciones: row.observaciones != null ? String(row.observaciones) : '',
    unidad: row.unidad ?? '',
    cantidad: asFinite(row.cantidad, 0),
    valorUnitario: asFinite(row.precioUnitario, 0),
    rubro: row.rubro != null ? String(row.rubro) : undefined,
  };
}

/** Actividad del informe + precio unitario del catálogo → una fila BASE. */
export function mapActividadAPrecioInput(row: {
  itemContractual: string;
  descripcion: string;
  observacionTexto?: string | null;
  unidadMedida?: string | null;
  cantidadTotal?: number | null;
  precioUnitarioCatalogo: number | null | undefined;
  rubro?: string | null;
}): PrecioTabulacionInput {
  return {
    itemId: String(row.itemContractual ?? '').trim(),
    descripcion: String(row.descripcion ?? '').trim(),
    observaciones: row.observacionTexto != null ? String(row.observacionTexto) : '',
    unidad: row.unidadMedida ?? '',
    cantidad: asFinite(row.cantidadTotal, 0),
    valorUnitario: asFinite(row.precioUnitarioCatalogo, 0),
    rubro: row.rubro != null ? String(row.rubro) : undefined,
  };
}
