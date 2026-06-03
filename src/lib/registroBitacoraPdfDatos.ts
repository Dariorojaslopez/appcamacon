import type { RegistroBitacoraObra } from '@prisma/client';
import { informeTieneFranjaClima, type InformeDiarioPdfRow } from './registroBitacoraClimaPdf';
import { parseEquiposManualJson, parsePersonalManualJson } from './registroBitacoraDiaInforme';
import { parseFirmaDocsJson } from '../shared/registroBitacoraFirmaDocs';
import type { RegistroBitacoraPdfDia } from './registroBitacoraPdfHtml';

function textoTieneValor(s: string | null | undefined): boolean {
  return Boolean(s?.trim());
}

function registroTieneFirmaOAdjuntos(
  firmaUrl: string | null | undefined,
  firmaDocs: unknown,
): boolean {
  if (textoTieneValor(firmaUrl)) return true;
  return parseFirmaDocsJson(firmaDocs).length > 0;
}

/** Registro de bitácora guardado con al menos un dato útil (no solo fila vacía). */
export function registroBitacoraTieneDatosParaPdf(reg: RegistroBitacoraObra): boolean {
  if (
    textoTieneValor(reg.franjaClimaMananaCodigo) ||
    textoTieneValor(reg.franjaClimaTardeCodigo) ||
    textoTieneValor(reg.franjaClimaNocheCodigo)
  ) {
    return true;
  }

  const personal = parsePersonalManualJson(reg.contratistaPersonalManual);
  if (personal.some((p) => textoTieneValor(p.cargo) && (p.total ?? 0) > 0)) return true;

  const equipos = parseEquiposManualJson(reg.contratistaEquiposManual);
  if (equipos.some((e) => textoTieneValor(e.descripcion))) return true;

  if (textoTieneValor(reg.contratistaObservaciones) || textoTieneValor(reg.contratistaFotoUrl)) {
    return true;
  }
  if (registroTieneFirmaOAdjuntos(reg.contratistaFirmaUrl, reg.contratistaFirmaDocs)) return true;

  if (textoTieneValor(reg.interventoriaObservaciones) || textoTieneValor(reg.interventoriaFotoUrl)) {
    return true;
  }
  if (registroTieneFirmaOAdjuntos(reg.interventoriaFirmaUrl, reg.interventoriaFirmaDocs)) return true;

  if (textoTieneValor(reg.iduObservaciones) || textoTieneValor(reg.iduFotoUrl)) return true;
  if (registroTieneFirmaOAdjuntos(reg.iduFirmaUrl, reg.iduFirmaDocs)) return true;

  return false;
}

/** Informe diario con clima, personal o equipos registrados. */
export function informeDiarioTieneDatosParaPdf(informe: InformeDiarioPdfRow): boolean {
  if (informeTieneFranjaClima(informe)) return true;
  if (informe.personal?.some((p) => textoTieneValor(p.cargo))) return true;
  if (informe.equipos?.some((e) => textoTieneValor(e.descripcion))) return true;
  return false;
}

/** Hoja ya armada para el PDF: ¿lleva contenido más allá de encabezados vacíos? */
export function paginaRegistroBitacoraPdfTieneDatos(dia: RegistroBitacoraPdfDia): boolean {
  const climaConValor = dia.climaFilas.some((f) => {
    const html = f.tiempoHtml.replace(/<[^>]+>/g, '').trim();
    return html && html !== '—';
  });
  if (climaConValor) return true;
  if (dia.personalPorCargo.length > 0) return true;
  if (dia.equiposMateriales.length > 0) return true;
  if (dia.secciones.some(
    (s) =>
      textoTieneValor(s.observaciones) ||
      textoTieneValor(s.fotoUrl) ||
      textoTieneValor(s.firmaUrl) ||
      s.firmaDocs.length > 0,
  )) {
    return true;
  }
  return false;
}
