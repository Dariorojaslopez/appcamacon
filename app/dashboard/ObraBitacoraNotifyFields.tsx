'use client';

import {
  OBRA_BITACORA_NOTIFY_FORM_SLOTS,
  type ObraBitacoraNotifyFormFields,
} from '../../src/shared/obraBitacoraNotifyForm';

type NotifyRoleKey = 'contratista' | 'interventor' | 'idu';

const ROLE_CONFIG: { key: NotifyRoleKey; field: keyof ObraBitacoraNotifyFormFields; label: string }[] = [
  { key: 'contratista', field: 'bitacoraNotifyContratistaUserIds', label: 'Contratista' },
  { key: 'interventor', field: 'bitacoraNotifyInterventorUserIds', label: 'Interventoría' },
  { key: 'idu', field: 'bitacoraNotifyIduUserIds', label: 'IDU' },
];

type Props = {
  form: ObraBitacoraNotifyFormFields;
  onChange: (next: ObraBitacoraNotifyFormFields) => void;
  usersOptions: { id: string; name: string; email: string }[];
  idPrefix: string;
};

export function ObraBitacoraNotifyFields({ form, onChange, usersOptions, idPrefix }: Props) {
  const sortedUsers = [...usersOptions].sort((a, b) => a.name.localeCompare(b.name, 'es'));

  const setSlot = (field: keyof ObraBitacoraNotifyFormFields, index: number, value: string) => {
    const slots = [...form[field]];
    slots[index] = value;
    onChange({ ...form, [field]: slots });
  };

  return (
    <>
      <p className="informe-label-hint" style={{ marginBottom: '0.75rem' }}>
        Asigne hasta {OBRA_BITACORA_NOTIFY_FORM_SLOTS} usuarios por rol. Cuando uno guarde su sección en el
        registro de bitácora, los demás usuarios configurados recibirán un correo.
      </p>
      {ROLE_CONFIG.map(({ key, field, label }) => (
        <div key={key} className="form-field" style={{ marginBottom: '0.85rem' }}>
          <span className="form-label" style={{ display: 'block', marginBottom: '0.35rem' }}>
            Usuarios {label}
          </span>
          {Array.from({ length: OBRA_BITACORA_NOTIFY_FORM_SLOTS }, (_, i) => (
            <div key={`${key}-${i}`} style={{ marginBottom: '0.35rem' }}>
              <label className="shell-text-muted" style={{ fontSize: '0.8rem' }} htmlFor={`${idPrefix}-${key}-${i}`}>
                Usuario {i + 1}
              </label>
              <select
                id={`${idPrefix}-${key}-${i}`}
                className="form-input"
                value={form[field][i] ?? ''}
                onChange={(e) => setSlot(field, i, e.target.value)}
              >
                <option value="">— Sin asignar —</option>
                {sortedUsers.map((u) => (
                  <option key={`${key}-${i}-${u.id}`} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
