'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IconChevronDown } from './icons';

export type InformeSearchableOption = { value: string; label: string };

type Props = {
  id: string;
  value: string;
  options: InformeSearchableOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  emptyOptionLabel: string;
  searchPlaceholder?: string;
  className?: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Bottom sheet en portal: viewport estrecha o dispositivo táctil sin hover “finos”.
 * 1023px cubre Chrome Android en “sitio de escritorio” (~980px) donde antes quedaba el panel inline roto.
 * Complemento: coarse pointer + sin hover (tablets / algunos móviles anchos).
 */
const SHEET_MEDIA = [
  '(max-width: 1023px)',
  '(hover: none) and (pointer: coarse) and (max-width: 1366px)',
].join(', ');

function useNarrowSheet() {
  const [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const mq = window.matchMedia(SHEET_MEDIA);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return narrow;
}

export function InformeSearchableSelect({
  id,
  value,
  options,
  onChange,
  disabled = false,
  emptyOptionLabel,
  searchPlaceholder = 'Buscar…',
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const narrowSheet = useNarrowSheet();
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => [{ value: '', label: emptyOptionLabel }, ...options], [options, emptyOptionLabel]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return rows;
    return rows.filter((r) => normalize(r.label).includes(q));
  }, [rows, query]);

  const selectedLabel = useMemo(() => {
    const hit = rows.find((r) => r.value === value);
    return hit?.label ?? emptyOptionLabel;
  }, [rows, value, emptyOptionLabel]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), narrowSheet ? 150 : 0);
    return () => window.clearTimeout(t);
  }, [open, narrowSheet]);

  useEffect(() => {
    if (!open || !narrowSheet) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open, narrowSheet]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  const listboxId = `${id}-listbox`;

  const panel = open && !disabled && (
    <div
      ref={panelRef}
      className={`informe-searchable-panel ${narrowSheet ? 'informe-searchable-panel--sheet' : ''}`}
      role="presentation"
    >
      {narrowSheet && (
        <div className="informe-searchable-sheet-header">
          <span className="informe-searchable-sheet-title">Elegir opción</span>
          <button type="button" className="informe-searchable-sheet-close" aria-label="Cerrar" onClick={close}>
            ×
          </button>
        </div>
      )}
      <div className="informe-searchable-search">
        <input
          ref={searchRef}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          className="form-input informe-searchable-filter"
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Filtrar opciones"
          onKeyDown={(e) => e.stopPropagation()}
        />
      </div>
      <ul id={listboxId} className="informe-searchable-list" role="listbox">
        {filtered.length === 0 ? (
          <li className="informe-searchable-empty informe-searchable-li" role="option">
            Sin coincidencias
          </li>
        ) : (
          filtered.map((r) => (
            <li key={r.value === '' ? '__empty' : r.value} className="informe-searchable-li" role="none">
              <button
                type="button"
                role="option"
                aria-selected={value === r.value}
                className={`informe-searchable-item${value === r.value ? ' informe-searchable-item-active' : ''}`}
                onClick={() => {
                  onChange(r.value);
                  close();
                }}
              >
                {r.label}
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );

  return (
    <>
      <div className={`informe-searchable ${className}`.trim()} ref={wrapRef}>
        <button
          type="button"
          id={id}
          className={`informe-searchable-trigger form-input ${disabled ? 'informe-searchable-trigger-disabled' : ''}`}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listboxId}
          onClick={() => {
            if (disabled) return;
            setOpen((o) => !o);
            if (open) setQuery('');
          }}
        >
          <span className="informe-searchable-trigger-text">{selectedLabel}</span>
          <span className="informe-searchable-chevron" aria-hidden>
            <IconChevronDown open={open} />
          </span>
        </button>
        {!narrowSheet && panel}
      </div>
      {narrowSheet &&
        panel &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="informe-searchable-backdrop" aria-hidden onClick={close} />
            {panel}
          </>,
          document.body,
        )}
    </>
  );
}
