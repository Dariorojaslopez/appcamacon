'use client';

import { useEffect, useMemo, useState } from 'react';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

type InformeDia = { fecha: string; informeNo: string | null };
type RegistroDia = { fecha: string; consecutivo: number };

type Props = {
  fechaDesde: string;
  fechaHasta: string;
  selectedDate: string;
  informes: InformeDia[];
  registros: RegistroDia[];
  obraStart?: string | null;
  obraEnd?: string | null;
  onSelectDate: (ymd: string) => void;
};

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

function monthKey(y: number, m: number): number {
  return y * 12 + m;
}

function fromMonthKey(k: number): { y: number; m: number } {
  const y = Math.floor((k - 1) / 12);
  const m = ((k - 1) % 12) + 1;
  return { y, m };
}

function clampViewMonth(y: number, m: number, minKey: number | null, maxKey: number | null) {
  let k = monthKey(y, m);
  if (minKey != null && k < minKey) return fromMonthKey(minKey);
  if (maxKey != null && k > maxKey) return fromMonthKey(maxKey);
  return { y, m };
}

function inObraRange(ymd: string, obraStart: string | null, obraEnd: string | null): boolean {
  if (obraStart && ymd < obraStart) return false;
  if (obraEnd && ymd > obraEnd) return false;
  return true;
}

function inRangoConsulta(ymd: string, desde: string, hasta: string): boolean {
  return ymd >= desde && ymd <= hasta;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function RegistroBitacoraRangoCalendario({
  fechaDesde,
  fechaHasta,
  selectedDate,
  informes,
  registros,
  obraStart = null,
  obraEnd = null,
  onSelectDate,
}: Props) {
  const hastaParsed = parseYmd(fechaHasta) ?? parseYmd(fechaDesde);
  const initial = hastaParsed ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
    d: new Date().getDate(),
  };

  const [expanded, setExpanded] = useState(true);
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m);

  const minKey = useMemo(() => {
    const desde = parseYmd(fechaDesde);
    const obra = obraStart ? parseYmd(obraStart) : null;
    const keys: number[] = [];
    if (desde) keys.push(monthKey(desde.y, desde.m));
    if (obra) keys.push(monthKey(obra.y, obra.m));
    return keys.length ? Math.max(...keys) : null;
  }, [fechaDesde, obraStart]);

  const maxKey = useMemo(() => {
    const hasta = parseYmd(fechaHasta);
    const obra = obraEnd ? parseYmd(obraEnd) : null;
    const keys: number[] = [];
    if (hasta) keys.push(monthKey(hasta.y, hasta.m));
    if (obra) keys.push(monthKey(obra.y, obra.m));
    return keys.length ? Math.min(...keys) : null;
  }, [fechaHasta, obraEnd]);

  const viewKey = monthKey(viewYear, viewMonth);
  const canPrev = minKey == null || viewKey > minKey;
  const canNext = maxKey == null || viewKey < maxKey;

  const informeByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const inf of informes) {
      const list = map.get(inf.fecha) ?? [];
      if (inf.informeNo) list.push(inf.informeNo);
      map.set(inf.fecha, list);
    }
    return map;
  }, [informes]);

  const registroByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const reg of registros) {
      map.set(reg.fecha, reg.consecutivo);
    }
    return map;
  }, [registros]);

  useEffect(() => {
    const p = parseYmd(fechaHasta) ?? parseYmd(fechaDesde);
    if (!p) return;
    const clamped = clampViewMonth(p.y, p.m, minKey, maxKey);
    setViewYear(clamped.y);
    setViewMonth(clamped.m);
  }, [fechaDesde, fechaHasta, minKey, maxKey]);

  useEffect(() => {
    const clamped = clampViewMonth(viewYear, viewMonth, minKey, maxKey);
    if (clamped.y !== viewYear || clamped.m !== viewMonth) {
      setViewYear(clamped.y);
      setViewMonth(clamped.m);
    }
  }, [viewYear, viewMonth, minKey, maxKey]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const totalDays = daysInMonth(viewYear, viewMonth);
    const grid: Array<{ ymd: string; dayNum: number } | null> = [];
    for (let i = 0; i < offset; i += 1) grid.push(null);
    for (let d = 1; d <= totalDays; d += 1) {
      const ymd = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      grid.push({ ymd, dayNum: d });
    }
    return grid;
  }, [viewYear, viewMonth]);

  const goMonth = (delta: number) => {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    const clamped = clampViewMonth(y, m, minKey, maxKey);
    if (monthKey(clamped.y, clamped.m) === viewKey) return;
    setViewYear(clamped.y);
    setViewMonth(clamped.m);
  };

  const rangoLabel = `${fechaDesde} — ${fechaHasta}`;
  const diasConDatos = useMemo(() => {
    const fechas = new Set<string>();
    for (const inf of informes) fechas.add(inf.fecha);
    for (const reg of registros) fechas.add(reg.fecha);
    return fechas.size;
  }, [informes, registros]);

  return (
    <div className="informe-calendario-block registro-bitacora-rango-calendario">
      <button
        type="button"
        className="informe-calendario-toggle"
        aria-expanded={expanded}
        aria-controls="registro-bitacora-rango-calendario-panel"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="informe-calendario-toggle-icon" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
        <span className="informe-calendario-toggle-text">
          {expanded ? 'Ocultar calendario del rango' : 'Mostrar calendario del rango'}
        </span>
        {!expanded ? (
          <span className="informe-calendario-toggle-hint">
            {rangoLabel}
            {diasConDatos > 0 ? ` · ${diasConDatos} día${diasConDatos === 1 ? '' : 's'} con datos` : ''}
          </span>
        ) : null}
      </button>

      {expanded ? (
        <div
          id="registro-bitacora-rango-calendario-panel"
          className="informe-calendario"
          aria-label="Calendario de días con datos en el rango consultado"
        >
        <div className="informe-calendario-header">
          <button
            type="button"
            className="informe-calendario-nav"
            onClick={() => goMonth(-1)}
            disabled={!canPrev}
            aria-label="Mes anterior"
            title={!canPrev ? 'Primer mes del rango consultado' : undefined}
          >
            ‹
          </button>
          <span className="informe-calendario-title">
            {MONTH_NAMES[viewMonth - 1]} {viewYear}
          </span>
          <button
            type="button"
            className="informe-calendario-nav"
            onClick={() => goMonth(1)}
            disabled={!canNext}
            aria-label="Mes siguiente"
            title={!canNext ? 'Último mes del rango consultado' : undefined}
          >
            ›
          </button>
        </div>
        <p className="informe-calendario-hint">
          Rango consultado: {rangoLabel}
          {(obraStart || obraEnd) && (
            <>
              {' '}
              · Vigencia obra: {obraStart ?? '—'} — {obraEnd ?? '—'}
            </>
          )}
        </p>
        <div className="informe-calendario-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <div className="informe-calendario-grid" role="grid">
          {cells.map((cell, idx) => {
            if (!cell) {
              return <span key={`empty-${idx}`} className="informe-calendario-cell informe-calendario-cell--empty" />;
            }
            const { ymd, dayNum } = cell;
            const enObra = inObraRange(ymd, obraStart ?? null, obraEnd ?? null);
            const enRango = inRangoConsulta(ymd, fechaDesde, fechaHasta);
            const hasInforme = informeByDate.has(ymd);
            const hasRegistro = registroByDate.has(ymd);
            const hasData = hasInforme || hasRegistro;
            const isSelected = ymd === selectedDate;
            const consecutivo = registroByDate.get(ymd);

            let stateClass = 'informe-calendario-cell--none';
            if (!enObra || !enRango) stateClass = 'informe-calendario-cell--out';
            else if (hasData) stateClass = 'informe-calendario-cell--rango-data';

            const clickable = enObra && enRango && hasData;
            const titleParts: string[] = [];
            if (!enObra) titleParts.push('Fuera de vigencia de la obra');
            else if (!enRango) titleParts.push('Fuera del rango consultado');
            else if (hasData) {
              if (consecutivo != null) titleParts.push(`Folio ${consecutivo}`);
              else titleParts.push('Con datos');
            } else titleParts.push('Sin datos');

            return (
              <button
                key={ymd}
                type="button"
                role="gridcell"
                disabled={!clickable}
                title={titleParts.join(' · ') || undefined}
                className={`informe-calendario-cell ${stateClass}${isSelected ? ' informe-calendario-cell--selected' : ''}`}
                onClick={() => clickable && onSelectDate(ymd)}
              >
                <span className="informe-calendario-day-num">{dayNum}</span>
              </button>
            );
          })}
        </div>
        <div className="informe-calendario-legend">
          <span className="informe-calendario-legend-item informe-calendario-legend-item--rango-data">
            Con datos
          </span>
          <span className="informe-calendario-legend-item informe-calendario-legend-item--none">Sin datos</span>
        </div>
        <p className="informe-calendario-hint registro-bitacora-rango-calendario-foot">
          Clic en un día con datos para abrirlo en el formulario de arriba.
        </p>
        </div>
      ) : null}
    </div>
  );
}
