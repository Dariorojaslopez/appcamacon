'use client';

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
}: Props) {
  const editable = !state.tieneInformeDiario && !loading;

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

  return (
    <div className="registro-bitacora-dia-informe">
      <h3 className="shell-title" style={{ fontSize: '1rem', marginTop: 0 }}>
        Datos del día (clima, personal y equipos)
      </h3>
      {state.tieneInformeDiario ? (
        <p className="informe-label-hint" style={{ marginTop: 0 }}>
          Hay informe diario para esta fecha: la información se toma del informe y no se puede editar aquí.
        </p>
      ) : (
        <p className="informe-label-hint" style={{ marginTop: 0 }}>
          No hay informe diario para esta fecha. Complete los datos manualmente; se guardan al pulsar «Guardar
          registro».
        </p>
      )}

      <div className="informe-franja-clima-wrap" style={{ marginBottom: '1rem' }}>
        <table className="users-table informe-franja-clima-table">
          <thead>
            <tr>
              <th className="informe-franja-clima-th-franja">Franja del día</th>
              <th className="informe-franja-clima-th-tipo">
                {editable ? 'Condición climática' : 'Condición climática'}
              </th>
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

      <table className="users-table" style={{ marginBottom: '1rem' }}>
        <thead>
          <tr>
            <th colSpan={2}>Personal</th>
          </tr>
          <tr>
            <th>Cargo</th>
            <th style={{ width: '7rem' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {state.personalPorCargo.length === 0 && !editable ? (
            <tr>
              <td colSpan={2} className="shell-text-muted">
                —
              </td>
            </tr>
          ) : null}
          {state.personalPorCargo.map((row, idx) => (
            <tr key={`p-${idx}`}>
              <td>
                {editable ? (
                  <input
                    className="form-input"
                    value={row.cargo}
                    placeholder="Ej. Inspector técnico"
                    onChange={(e) => {
                      const next = [...state.personalPorCargo];
                      next[idx] = { ...next[idx], cargo: e.target.value };
                      setPersonal(next);
                    }}
                  />
                ) : (
                  row.cargo
                )}
              </td>
              <td>
                {editable ? (
                  <input
                    className="form-input"
                    type="number"
                    min={0}
                    value={row.total || ''}
                    onChange={(e) => {
                      const next = [...state.personalPorCargo];
                      const n = parseInt(e.target.value, 10);
                      next[idx] = { ...next[idx], total: Number.isFinite(n) && n >= 0 ? n : 0 };
                      setPersonal(next);
                    }}
                  />
                ) : (
                  row.total
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && state.personalPorCargo.length < REGISTRO_MANUAL_PERSONAL_MAX ? (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginBottom: '1rem' }}
          onClick={() => setPersonal([...state.personalPorCargo, emptyRegistroPersonalManualRow()])}
        >
          Agregar cargo
        </button>
      ) : null}

      <table className="users-table" style={{ marginBottom: '0.5rem' }}>
        <thead>
          <tr>
            <th colSpan={2}>Equipos y materiales</th>
          </tr>
          <tr>
            <th>Descripción</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {state.equipos.length === 0 && !editable ? (
            <tr>
              <td colSpan={2} className="shell-text-muted">
                —
              </td>
            </tr>
          ) : null}
          {state.equipos.map((row, idx) => (
            <tr key={`e-${idx}`}>
              <td>
                {editable ? (
                  <input
                    className="form-input"
                    value={row.descripcion}
                    placeholder="Ej. Camión"
                    onChange={(e) => {
                      const next = [...state.equipos];
                      next[idx] = { ...next[idx], descripcion: e.target.value };
                      setEquipos(next);
                    }}
                  />
                ) : (
                  row.descripcion
                )}
              </td>
              <td>
                {editable ? (
                  <input
                    className="form-input"
                    value={row.estado}
                    placeholder="Ej. Operativo"
                    onChange={(e) => {
                      const next = [...state.equipos];
                      next[idx] = { ...next[idx], estado: e.target.value };
                      setEquipos(next);
                    }}
                  />
                ) : (
                  row.estado
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editable && state.equipos.length < REGISTRO_MANUAL_EQUIPOS_MAX ? (
        <button
          type="button"
          className="btn-secondary"
          style={{ marginBottom: '1.25rem' }}
          onClick={() => setEquipos([...state.equipos, emptyRegistroEquipoManualRow()])}
        >
          Agregar equipo
        </button>
      ) : null}
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
