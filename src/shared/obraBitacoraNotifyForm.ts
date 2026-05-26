import { BITACORA_NOTIFY_USERS_PER_ROLE_MAX } from '../lib/projectBitacoraNotifyUsers';

export const OBRA_BITACORA_NOTIFY_FORM_SLOTS = BITACORA_NOTIFY_USERS_PER_ROLE_MAX;

export type ObraBitacoraNotifyFormFields = {
  bitacoraNotifyContratistaUserIds: string[];
  bitacoraNotifyInterventorUserIds: string[];
  bitacoraNotifyIduUserIds: string[];
};

export function emptyObraBitacoraNotifyFormFields(): ObraBitacoraNotifyFormFields {
  const slots = () => Array<string>(OBRA_BITACORA_NOTIFY_FORM_SLOTS).fill('');
  return {
    bitacoraNotifyContratistaUserIds: slots(),
    bitacoraNotifyInterventorUserIds: slots(),
    bitacoraNotifyIduUserIds: slots(),
  };
}

function padNotifySlots(ids?: string[]): string[] {
  const arr = [...(ids ?? [])];
  while (arr.length < OBRA_BITACORA_NOTIFY_FORM_SLOTS) arr.push('');
  return arr.slice(0, OBRA_BITACORA_NOTIFY_FORM_SLOTS);
}

export function obraBitacoraNotifyFormFromObra(o: {
  bitacoraNotifyContratistaUserIds?: string[];
  bitacoraNotifyInterventorUserIds?: string[];
  bitacoraNotifyIduUserIds?: string[];
}): ObraBitacoraNotifyFormFields {
  return {
    bitacoraNotifyContratistaUserIds: padNotifySlots(o.bitacoraNotifyContratistaUserIds),
    bitacoraNotifyInterventorUserIds: padNotifySlots(o.bitacoraNotifyInterventorUserIds),
    bitacoraNotifyIduUserIds: padNotifySlots(o.bitacoraNotifyIduUserIds),
  };
}

export function bitacoraNotifyPayloadFromForm(form: ObraBitacoraNotifyFormFields) {
  const compact = (slots: string[]) => slots.map((s) => s.trim()).filter(Boolean);
  return {
    bitacoraNotifyContratistaUserIds: compact(form.bitacoraNotifyContratistaUserIds),
    bitacoraNotifyInterventorUserIds: compact(form.bitacoraNotifyInterventorUserIds),
    bitacoraNotifyIduUserIds: compact(form.bitacoraNotifyIduUserIds),
  };
}

export function countBitacoraNotifyAssignments(form: ObraBitacoraNotifyFormFields): number {
  const p = bitacoraNotifyPayloadFromForm(form);
  return (
    p.bitacoraNotifyContratistaUserIds.length +
    p.bitacoraNotifyInterventorUserIds.length +
    p.bitacoraNotifyIduUserIds.length
  );
}
