'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type DayStatus = {
  date: string;
  hasInforme: boolean;
  informeCerrado: boolean;
  informeNo: string | null;
  inObraRange: boolean;
};

type Props = {
  projectId: string;
  jornadaId: string;
  selectedDate: string;
  onSelectDate: (ymd: string) => void;
};

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

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function InformeDiarioCalendario({ projectId, jornadaId, selectedDate, onSelectDate }: Props) {
  const initial = parseYmd(selectedDate) ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
    d: new Date().getDate(),
  };
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m);
  const [days, setDays] = useState<DayStatus[]>([]);
  const [obraStart, setObraStart] = useState<string | null>(null);
  const [obraEnd, setObraEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMonth = useCallback(async () => {
    if (!projectId || !jornadaId) {
      setDays([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        projectId,
        jornadaId,
        year: String(viewYear),
        month: String(viewMonth),
      });
      const res = await fetch(`/api/informes/calendario?${qs}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Error al cargar calendario');
      setDays(Array.isArray(data.days) ? data.days : []);
      setObraStart(data.obraStart ?? null);
      setObraEnd(data.obraEnd ?? null);
    } catch (e) {
      setDays([]);
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [projectId, jornadaId, viewYear, viewMonth]);

  useEffect(() => {
    void fetchMonth();
  }, [fetchMonth]);

  useEffect(() => {
    const p = parseYmd(selectedDate);
    if (p && (p.y !== viewYear || p.m !== viewMonth)) {
      setViewYear(p.y);
      setViewMonth(p.m);
    }
  }, [selectedDate, viewYear, viewMonth]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const byDate = new Map(days.map((d) => [d.date, d]));
    const grid: Array<DayStatus | null> = [];
    for (let i = 0; i < offset; i += 1) grid.push(null);
    for (let d = 1; d <= days.length; d += 1) {
      const ymd = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      grid.push(byDate.get(ymd) ?? { date: ymd, hasInforme: false, informeCerrado: false, informeNo: null, inObraRange: true });
    }
    return grid;
  }, [days, viewYear, viewMonth]);

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
    setViewYear(y);
    setViewMonth(m);
  };

  if (!projectId || !jornadaId) return null;

  return (
    <div className="informe-calendario" aria-label="Calendario de informes por fecha">
      <div className="informe-calendario-header">
        <button type="button" className="informe-calendario-nav" onClick={() => goMonth(-1)} aria-label="Mes anterior">
          ‹
        </button>
        <span className="informe-calendario-title">
          {MONTH_NAMES[viewMonth - 1]} {viewYear}
          {loading ? ' · …' : ''}
        </span>
        <button type="button" className="informe-calendario-nav" onClick={() => goMonth(1)} aria-label="Mes siguiente">
          ›
        </button>
      </div>
      {error ? <p className="informe-calendario-error">{error}</p> : null}
      {(obraStart || obraEnd) && (
        <p className="informe-calendario-hint">
          Vigencia obra: {obraStart ?? '—'} — {obraEnd ?? '—'}
        </p>
      )}
      <div className="informe-calendario-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <div className="informe-calendario-grid" role="grid">
        {cells.map((day, idx) => {
          if (!day) {
            return <span key={`empty-${idx}`} className="informe-calendario-cell informe-calendario-cell--empty" />;
          }
          const dayNum = Number(day.date.slice(8, 10));
          const isSelected = day.date === selectedDate;
          let stateClass = 'informe-calendario-cell--none';
          if (!day.inObraRange) stateClass = 'informe-calendario-cell--out';
          else if (day.hasInforme && day.informeCerrado) stateClass = 'informe-calendario-cell--cerrado';
          else if (day.hasInforme) stateClass = 'informe-calendario-cell--abierto';
          return (
            <button
              key={day.date}
              type="button"
              role="gridcell"
              disabled={!day.inObraRange}
              title={
                !day.inObraRange
                  ? 'Fuera del rango de la obra'
                  : day.hasInforme
                    ? day.informeCerrado
                      ? `Cerrado · ${day.informeNo ?? ''}`
                      : `Abierto · ${day.informeNo ?? ''}`
                    : 'Sin informe (clic para abrir esa fecha)'
              }
              className={`informe-calendario-cell ${stateClass}${isSelected ? ' informe-calendario-cell--selected' : ''}`}
              onClick={() => day.inObraRange && onSelectDate(day.date)}
            >
              <span className="informe-calendario-day-num">{dayNum}</span>
            </button>
          );
        })}
      </div>
      <div className="informe-calendario-legend">
        <span className="informe-calendario-legend-item informe-calendario-legend-item--abierto">Abierto (editable)</span>
        <span className="informe-calendario-legend-item informe-calendario-legend-item--cerrado">Cerrado (solo lectura)</span>
        <span className="informe-calendario-legend-item informe-calendario-legend-item--none">Sin informe</span>
      </div>
    </div>
  );
}
