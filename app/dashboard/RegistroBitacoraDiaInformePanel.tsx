'use client';

import { useEffect } from 'react';
import { InformeSearchableSelect, type InformeSearchableOption } from './InformeSearchableSelect';
import {
  REGISTRO_MANUAL_EQUIPOS_MAX,
  REGISTRO_MANUAL_PERSONAL_MAX,
  emptyRegistroClimaFranjasForm,
  emptyRegistroEquipoManualRow,
  emptyRegistroPersonalManualRow,
  type RegistroClimaFranjasForm,
  type RegistroEquipoManualRow,
  type RegistroPersonalManualRow,
} from '../../src/shared/registroBitacoraDiaInforme';

export type RegistroBitacoraDiaInformeState = {
  tieneInformeDiario: boolean;
  climaFranjas: RegistroClimaFranjasForm;
  personalPorCargo: RegistroPersonalManualRow[];
  equipos: RegistroEquipoManualRow[];
};

type Props = {
  state: RegistroBitacoraDiaInformeState;
  onChange: (next: RegistroBitacoraDiaInformeState) => void;
  tipoCondicionOptions: InformeSearchableOption[];
  loading?: boolean;
  bloqueado?: boolean;
};

function climaLabel(codigo: string, options: InformeSearchableOption[]): string {
  if (!codigo) return '—';
  const hit = options.find((o) => o.value === codigo);
  return hit?.label ?? codigo;
}

export function RegistroBitacoraDiaInformePanel({
  state,
  onChange,
  tipoCondicionOptions,
  loading,
  bloqueado = false,
}: Props) {
  const editable = !state.tieneInformeDiario && !bloqueado;
  const inputsDisabled = Boolean(loading) || bloqueado;

  useEffect(() => {
    if (!editable || loading) return;
    const needsPersonal = state.personalPorCargo.length === 0;
    const needsEquipos = state.equipos.length === 0;
    if (!needsPersonal && !needsEquipos) return;
    onChange({
      ...state,
      personalPorCargo: needsPersonal ? [emptyRegistroPersonalManualRow()] : state.personalPorCargo,
      equipos: needsEquipos ? [emptyRegistroEquipoManualRow()] : state.equipos,
    });
    // Solo al pasar a modo manual vacío (p. ej. tras cargar el día sin informe).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onChange/state completos re-dispararían en bucle
  }, [editable, loading, state.tieneInformeDiario, state.personalPorCargo.length, state.equipos.length]);

  const setClima = (key: keyof RegistroClimaFranjasForm, value: string) => {
    onChange({
      ...state,
      climaFranjas: { ...state.climaFranjas, [key]: value },
    });
  };

  const setPersonal = (rows: RegistroPersonalManualRow[]) => {
    onChange({ ...state, personalPorCargo: rows });
  };

  const setEquipos = (rows: RegistroEquipoManualRow[]) => {
    onChange({ ...state, equipos: rows });
  };

  const personalRows =
    state.personalPorCargo.length > 0
      ? state.personalPorCargo
      : editable
        ? [emptyRegistroPersonalManualRow()]
        : [];

  const equiposRows =
    state.equipos.length > 0 ? state.equipos : editable ? [emptyRegistroEquipoManualRow()] : [];

  return (
    <div className="registro-bitacora-dia-informe">
      <h3 className="shell-title" style={{ fontSize: '1rem', marginTop: 0 }}>
        Datos del día (clima, personal y equipos)
      </h3>
      {state.tieneInformeDiario ? (
        <p className="informe-label-hint" style={{ marginTop: 0 }}>
          Los datos del día ya están registrados y no se pueden editar aquí.
        </p>
      ) : (
        <p className="informe-label-hint" style={{ marginTop: 0 }}>
          Complete los datos en las tablas siguientes; se guardan al pulsar «Guardar registro».
        </p>
      )}

      <div className="informe-franja-clima-wrap registro-dia-informe-block">
        <table className="users-table informe-franja-clima-table registro-dia-informe-table">
          <thead>
            <tr>
              <th colSpan={2} className="registro-dia-informe-band">
                Condición climática por franja
              </th>
            </tr>
            <tr>
              <th className="informe-franja-clima-th-franja">Franja del día</th>
              <th className="informe-franja-clima-th-tipo">Condición climática</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Mañana</strong>
              </td>
              <td>
                {editable ? (
                  <InformeSearchableSelect
                    id="rb-clima-manana"
                    value={state.climaFranjas.manana}
                    disabled={inputsDisabled}
                    emptyOptionLabel="Seleccione…"
                    searchPlaceholder="Buscar tipo…"
                    options={tipoCondicionOptions}
                    onChange={(v) => setClima('manana', v)}
                  />
                ) : (
                  climaLabel(state.climaFranjas.manana, tipoCondicionOptions)
                )}
              </td>
            </tr>
            <tr>
              <td>
                <strong>Tarde</strong>
              </td>
              <td>
                {editable ? (
                  <InformeSearchableSelect
                    id="rb-clima-tarde"
                    value={state.climaFranjas.tarde}
                    disabled={inputsDisabled}
                    emptyOptionLabel="Seleccione…"
                    searchPlaceholder="Buscar tipo…"
                    options={tipoCondicionOptions}
                    onChange={(v) => setClima('tarde', v)}
                  />
                ) : (
                  climaLabel(state.climaFranjas.tarde, tipoCondicionOptions)
                )}
              </td>
            </tr>
            <tr>
              <td>
                <strong>Noche</strong>
              </td>
              <td>
                {editable ? (
                  <InformeSearchableSelect
                    id="rb-clima-noche"
                    value={state.climaFranjas.noche}
                    disabled={inputsDisabled}
                    emptyOptionLabel="Seleccione…"
                    searchPlaceholder="Buscar tipo…"
                    options={tipoCondicionOptions}
                    onChange={(v) => setClima('noche', v)}
                  />
                ) : (
                  climaLabel(state.climaFranjas.noche, tipoCondicionOptions)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="registro-dia-informe-block">
        <div className="registro-dia-informe-toolbar">
          <span className="registro-dia-informe-band registro-dia-informe-band--standalone">Personal</span>
          {editable && state.personalPorCargo.length < REGISTRO_MANUAL_PERSONAL_MAX ? (
            <button
              type="button"
              className="btn-secondary registro-dia-informe-add-btn"
              disabled={inputsDisabled}
              onClick={() => setPersonal([...state.personalPorCargo, emptyRegistroPersonalManualRow()])}
            >
              + Agregar cargo
            </button>
          ) : null}
        </div>
        <div className="registro-dia-informe-table-scroll">
          <table className="users-table registro-dia-informe-table registro-dia-informe-table--personal">
            <thead>
              <tr>
                <th>Cargo</th>
                <th className="registro-dia-informe-th-narrow">Total</th>
                {editable ? <th className="registro-dia-informe-th-action" aria-label="Acciones" /> : null}
              </tr>
            </thead>
            <tbody>
              {personalRows.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 3 : 2} className="shell-text-muted registro-dia-informe-empty">
                    Sin personal registrado
                  </td>
                </tr>
              ) : (
                personalRows.map((row, idx) => (
                  <tr key={`p-${idx}`}>
                    <td data-label="Cargo">
                      {editable ? (
                        <input
                          className="form-input registro-dia-informe-input"
                          value={row.cargo}
                          disabled={inputsDisabled}
                          placeholder="Ej. Inspector técnico"
                          onChange={(e) => {
                            const next = [...(state.personalPorCargo.length ? state.personalPorCargo : personalRows)];
                            next[idx] = { ...next[idx], cargo: e.target.value };
                            setPersonal(next);
                          }}
                        />
                      ) : (
                        row.cargo
                      )}
                    </td>
                    <td data-label="Total" className="registro-dia-informe-td-center">
                      {editable ? (
                        <input
                          className="form-input registro-dia-informe-input registro-dia-informe-input--total"
                          type="number"
                          min={0}
                          disabled={inputsDisabled}
                          value={row.total === 0 ? '' : row.total}
                          onChange={(e) => {
                            const next = [...(state.personalPorCargo.length ? state.personalPorCargo : personalRows)];
                            const n = parseInt(e.target.value, 10);
                            next[idx] = {
                              ...next[idx],
                              total: Number.isFinite(n) && n >= 0 ? n : 0,
                            };
                            setPersonal(next);
                          }}
                        />
                      ) : (
                        row.total
                      )}
                    </td>
                    {editable ? (
                      <td className="registro-dia-informe-td-action">
                        <button
                          type="button"
                          className="btn-secondary registro-dia-informe-remove-btn"
                          disabled={inputsDisabled || personalRows.length <= 1}
                          title="Quitar fila"
                          onClick={() => {
                            const base = state.personalPorCargo.length ? state.personalPorCargo : personalRows;
                            const next = base.filter((_, i) => i !== idx);
                            setPersonal(next.length > 0 ? next : [emptyRegistroPersonalManualRow()]);
                          }}
                        >
                          Quitar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="registro-dia-informe-block">
        <div className="registro-dia-informe-toolbar">
          <span className="registro-dia-informe-band registro-dia-informe-band--standalone">
            Equipos y materiales
          </span>
          {editable && state.equipos.length < REGISTRO_MANUAL_EQUIPOS_MAX ? (
            <button
              type="button"
              className="btn-secondary registro-dia-informe-add-btn"
              disabled={inputsDisabled}
              onClick={() => setEquipos([...state.equipos, emptyRegistroEquipoManualRow()])}
            >
              + Agregar equipo
            </button>
          ) : null}
        </div>
        <div className="registro-dia-informe-table-scroll">
          <table className="users-table registro-dia-informe-table registro-dia-informe-table--equipos">
            <thead>
              <tr>
                <th>Descripción</th>
                <th className="registro-dia-informe-th-estado">Estado</th>
                {editable ? <th className="registro-dia-informe-th-action" aria-label="Acciones" /> : null}
              </tr>
            </thead>
            <tbody>
              {equiposRows.length === 0 ? (
                <tr>
                  <td colSpan={editable ? 3 : 2} className="shell-text-muted registro-dia-informe-empty">
                    Sin equipos registrados
                  </td>
                </tr>
              ) : (
                equiposRows.map((row, idx) => (
                  <tr key={`e-${idx}`}>
                    <td data-label="Descripción">
                      {editable ? (
                        <input
                          className="form-input registro-dia-informe-input"
                          value={row.descripcion}
                          disabled={inputsDisabled}
                          placeholder="Ej. Camión"
                          onChange={(e) => {
                            const next = [...(state.equipos.length ? state.equipos : equiposRows)];
                            next[idx] = { ...next[idx], descripcion: e.target.value };
                            setEquipos(next);
                          }}
                        />
                      ) : (
                        row.descripcion
                      )}
                    </td>
                    <td data-label="Estado">
                      {editable ? (
                        <input
                          className="form-input registro-dia-informe-input"
                          value={row.estado}
                          disabled={inputsDisabled}
                          placeholder="Ej. Operativo"
                          onChange={(e) => {
                            const next = [...(state.equipos.length ? state.equipos : equiposRows)];
                            next[idx] = { ...next[idx], estado: e.target.value };
                            setEquipos(next);
                          }}
                        />
                      ) : (
                        row.estado
                      )}
                    </td>
                    {editable ? (
                      <td className="registro-dia-informe-td-action">
                        <button
                          type="button"
                          className="btn-secondary registro-dia-informe-remove-btn"
                          disabled={inputsDisabled || equiposRows.length <= 1}
                          title="Quitar fila"
                          onClick={() => {
                            const base = state.equipos.length ? state.equipos : equiposRows;
                            const next = base.filter((_, i) => i !== idx);
                            setEquipos(next.length > 0 ? next : [emptyRegistroEquipoManualRow()]);
                          }}
                        >
                          Quitar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function emptyRegistroBitacoraDiaInformeState(): RegistroBitacoraDiaInformeState {
  return {
    tieneInformeDiario: false,
    climaFranjas: emptyRegistroClimaFranjasForm(),
    personalPorCargo: [],
    equipos: [],
  };
}
