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

function monthKey(y: number, m: number): number {
  return y * 12 + m;
}

function fromMonthKey(k: number): { y: number; m: number } {
  const y = Math.floor((k - 1) / 12);
  const m = ((k - 1) % 12) + 1;
  return { y, m };
}

function vigenciaBounds(obraStart: string | null, obraEnd: string | null) {
  let minKey: number | null = null;
  let maxKey: number | null = null;
  const s = obraStart ? parseYmd(obraStart) : null;
  const e = obraEnd ? parseYmd(obraEnd) : null;
  if (s) minKey = monthKey(s.y, s.m);
  if (e) maxKey = monthKey(e.y, e.m);
  return { minKey, maxKey };
}

function clampViewMonth(y: number, m: number, minKey: number | null, maxKey: number | null) {
  let k = monthKey(y, m);
  if (minKey != null && k < minKey) return fromMonthKey(minKey);
  if (maxKey != null && k > maxKey) return fromMonthKey(maxKey);
  return { y, m };
}

export function InformeDiarioCalendario({ projectId, jornadaId, selectedDate, onSelectDate }: Props) {
  const initial = parseYmd(selectedDate) ?? {
    y: new Date().getFullYear(),
    m: new Date().getMonth() + 1,
    d: new Date().getDate(),
  };
  const [expanded, setExpanded] = useState(false);
  const [viewYear, setViewYear] = useState(initial.y);
  const [viewMonth, setViewMonth] = useState(initial.m);
  const [days, setDays] = useState<DayStatus[]>([]);
  const [obraStart, setObraStart] = useState<string | null>(null);
  const [obraEnd, setObraEnd] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { minKey, maxKey } = useMemo(() => vigenciaBounds(obraStart, obraEnd), [obraStart, obraEnd]);
  const viewKey = monthKey(viewYear, viewMonth);
  const canPrev = minKey == null || viewKey > minKey;
  const canNext = maxKey == null || viewKey < maxKey;

  useEffect(() => {
    setExpanded(false);
    setObraStart(null);
    setObraEnd(null);
    setDays([]);
  }, [projectId, jornadaId]);

  useEffect(() => {
    const p = parseYmd(selectedDate);
    if (!p) return;
    const clamped = clampViewMonth(p.y, p.m, minKey, maxKey);
    setViewYear(clamped.y);
    setViewMonth(clamped.m);
  }, [selectedDate, minKey, maxKey]);

  useEffect(() => {
    const clamped = clampViewMonth(viewYear, viewMonth, minKey, maxKey);
    if (clamped.y !== viewYear || clamped.m !== viewMonth) {
      setViewYear(clamped.y);
      setViewMonth(clamped.m);
    }
  }, [minKey, maxKey, viewYear, viewMonth]);

  const fetchCalendario = useCallback(
    async (year: number, month: number, loadDays: boolean) => {
      if (!projectId || !jornadaId) return;
      if (loadDays) {
        setLoading(true);
        setError(null);
      }
      try {
        const qs = new URLSearchParams({
          projectId,
          jornadaId,
          year: String(year),
          month: String(month),
        });
        const res = await fetch(`/api/informes/calendario?${qs}`, { credentials: 'include' });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? 'Error al cargar calendario');
        setObraStart(data.obraStart ?? null);
        setObraEnd(data.obraEnd ?? null);
        if (loadDays) setDays(Array.isArray(data.days) ? data.days : []);
      } catch (e) {
        if (loadDays) {
          setDays([]);
          setError(e instanceof Error ? e.message : 'Error de conexión');
        }
      } finally {
        if (loadDays) setLoading(false);
      }
    },
    [projectId, jornadaId],
  );

  useEffect(() => {
    const p = parseYmd(selectedDate);
    const y = p?.y ?? new Date().getFullYear();
    const m = p?.m ?? new Date().getMonth() + 1;
    void fetchCalendario(y, m, false);
  }, [projectId, jornadaId, selectedDate, fetchCalendario]);

  useEffect(() => {
    if (!expanded) return;
    void fetchCalendario(viewYear, viewMonth, true);
  }, [expanded, viewYear, viewMonth, fetchCalendario]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const offset = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const byDate = new Map(days.map((d) => [d.date, d]));
    const grid: Array<DayStatus | null> = [];
    for (let i = 0; i < offset; i += 1) grid.push(null);
    for (let d = 1; d <= days.length; d += 1) {
      const ymd = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      grid.push(
        byDate.get(ymd) ?? {
          date: ymd,
          hasInforme: false,
          informeCerrado: false,
          informeNo: null,
          inObraRange: true,
        },
      );
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
    const clamped = clampViewMonth(y, m, minKey, maxKey);
    if (monthKey(clamped.y, clamped.m) === viewKey) return;
    setViewYear(clamped.y);
    setViewMonth(clamped.m);
  };

  if (!projectId || !jornadaId) return null;

  const vigenciaLabel =
    obraStart || obraEnd ? ` · ${obraStart ?? '—'} — ${obraEnd ?? '—'}` : '';

  return (
    <div className="informe-calendario-block">
      <button
        type="button"
        className="informe-calendario-toggle"
        aria-expanded={expanded}
        aria-controls="informe-calendario-panel"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="informe-calendario-toggle-icon" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
        <span className="informe-calendario-toggle-text">
          {expanded ? 'Ocultar calendario de informes' : 'Mostrar calendario de informes'}
        </span>
        {!expanded && (obraStart || obraEnd) ? (
          <span className="informe-calendario-toggle-hint">Vigencia obra{vigenciaLabel}</span>
        ) : null}
      </button>

      {expanded ? (
        <div id="informe-calendario-panel" className="informe-calendario" aria-label="Calendario de informes por fecha">
          <div className="informe-calendario-header">
            <button
              type="button"
              className="informe-calendario-nav"
              onClick={() => goMonth(-1)}
              disabled={!canPrev}
              aria-label="Mes anterior"
              title={!canPrev ? 'Primer mes de vigencia de la obra' : undefined}
            >
              ‹
            </button>
            <span className="informe-calendario-title">
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
              {loading ? ' · …' : ''}
            </span>
            <button
              type="button"
              className="informe-calendario-nav"
              onClick={() => goMonth(1)}
              disabled={!canNext}
              aria-label="Mes siguiente"
              title={!canNext ? 'Último mes de vigencia de la obra' : undefined}
            >
              ›
            </button>
          </div>
          {error ? <p className="informe-calendario-error">{error}</p> : null}
          {(obraStart || obraEnd) && (
            <p className="informe-calendario-hint">
              Vigencia obra: {obraStart ?? '—'} — {obraEnd ?? '—'}
              {!canPrev && !canNext ? ' · solo este mes' : !canPrev ? ' · inicio de vigencia' : !canNext ? ' · fin de vigencia' : ''}
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
      ) : null}
    </div>
  );
}
