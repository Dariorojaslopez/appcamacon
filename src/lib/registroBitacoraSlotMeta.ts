export type RegistroBitacoraSlotGuardado = {
  usuario: string | null;
  guardadoEn: string | null;
};

/** Texto para etiqueta: usuario, fecha y hora del último guardado de la sección. */
export function formatRegistroBitacoraGuardado(meta: RegistroBitacoraSlotGuardado): string | null {
  const usuario = meta.usuario?.trim() ?? '';
  const raw = meta.guardadoEn?.trim() ?? '';
  if (!usuario && !raw) return null;

  if (!raw) {
    return usuario ? `Último guardado (identificación): ${usuario}` : null;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    return usuario ? `Último guardado (identificación): ${usuario}` : null;
  }

  const fecha = d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const hora = d.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return `Último guardado (identificación): ${usuario || '—'} · ${fecha} ${hora}`;
}
