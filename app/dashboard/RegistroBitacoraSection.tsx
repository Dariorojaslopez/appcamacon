'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { InformeSearchableSelect, type InformeSearchableOption } from './InformeSearchableSelect';
import { SignaturePadField, type SignaturePadFieldHandle } from './SignaturePadField';
import { IconMic } from './icons';
import { startSpeechDictado, type WebSpeechRecognition } from '../../src/lib/speechDictado';
import {
  REGISTRO_BITACORA_SLOT_KEYS,
  REGISTRO_BITACORA_SLOT_LABELS,
  type RegistroBitacoraSlotKey,
} from '../../src/shared/registroBitacoraPermissions';
import {
  MAX_REGISTRO_FIRMA_DOCS,
  mergeLegacyFirmaUrl,
  type RegistroBitacoraFirmaDoc,
} from '../../src/shared/registroBitacoraFirmaDocs';

const MAX_FILE = 10 * 1024 * 1024;

const REGISTRO_DOC_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,application/pdf,.doc,.docx,.xls,.xlsx';

type FirmaDocRow = {
  id: string;
  name: string;
  url: string | null;
  file: File | null;
};

function newFirmaDocRowId(): string {
  return `d-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function firmaRowsFromApi(
  firmaUrl: string | null,
  firmaDocs: RegistroBitacoraFirmaDoc[],
): FirmaDocRow[] {
  return mergeLegacyFirmaUrl(firmaUrl, firmaDocs).map((d, i) => ({
    id: `saved-${i}-${d.url.slice(-16)}`,
    name: d.name,
    url: d.url,
    file: null,
  }));
}

function validateRegistroDoc(file: File): string | null {
  const mime = (file.type || '').toLowerCase();
  const allowedMime = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
  ];
  const okMime = mime && allowedMime.includes(mime);
  const okExt = /\.(jpe?g|png|gif|webp|pdf|doc|docx|xls|xlsx)$/i.test(file.name);
  if (!okMime && !okExt) {
    return 'Use imagen (JPG, PNG), PDF, Word (.doc, .docx) o Excel (.xls, .xlsx).';
  }
  if (file.size > MAX_FILE) return 'Cada archivo puede pesar como máximo 10 MB.';
  return null;
}

function localYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function clampYmd(val: string, min: string | null, max: string | null): string {
  let v = val;
  if (min && v < min) v = min;
  if (max && v > max) v = max;
  return v;
}

type Props = {
  obraOptions: InformeSearchableOption[];
  loadingObras: boolean;
};

type ProyectoMeta = {
  fechaMin: string | null;
  fechaMax: string | null;
  name: string;
  code: string;
};

type ProyectoApiResponse = ProyectoMeta & {
  error?: string;
};

type PersistedUrls = {
  contratistaFotoUrl: string | null;
  contratistaFirmaUrl: string | null;
  interventoriaFotoUrl: string | null;
  interventoriaFirmaUrl: string | null;
  iduFotoUrl: string | null;
  iduFirmaUrl: string | null;
};

const emptyPersisted: PersistedUrls = {
  contratistaFotoUrl: null,
  contratistaFirmaUrl: null,
  interventoriaFotoUrl: null,
  interventoriaFirmaUrl: null,
  iduFotoUrl: null,
  iduFirmaUrl: null,
};

type ApiRegistro = {
  consecutivo: number;
  contratistaObservaciones: string;
  contratistaFotoUrl: string | null;
  contratistaFirmaUrl: string | null;
  contratistaFirmaDocs?: RegistroBitacoraFirmaDoc[];
  interventoriaObservaciones: string;
  interventoriaFotoUrl: string | null;
  interventoriaFirmaUrl: string | null;
  interventoriaFirmaDocs?: RegistroBitacoraFirmaDoc[];
  iduObservaciones: string;
  iduFotoUrl: string | null;
  iduFirmaUrl: string | null;
  iduFirmaDocs?: RegistroBitacoraFirmaDoc[];
};

async function uploadRegistroDocumento(file: File, projectId: string): Promise<RegistroBitacoraFirmaDoc> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);
  const res = await fetch('/api/uploads/registro-documento', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  const data = (await res.json()) as {
    url?: string;
    previewUrl?: string;
    name?: string;
    contentType?: string;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? 'Error al subir documento');
  const url = data.previewUrl || data.url;
  if (!url) throw new Error('Respuesta sin URL');
  return {
    url: String(url),
    name: data.name || file.name,
    contentType: data.contentType || file.type || undefined,
  };
}

async function uploadEvidenciaFoto(file: File, projectId: string): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('projectId', projectId);
  const res = await fetch('/api/uploads/evidencia-foto', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  const data = (await res.json()) as { url?: string; previewUrl?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Error al subir archivo');
  const url = data.previewUrl || data.url;
  if (!url) throw new Error('Respuesta sin URL');
  return String(url);
}

type SlotProps = {
  title: string;
  observaciones: string;
  onObservaciones: (v: string) => void;
  onDictarObs: () => void;
  fotoLabel: string;
  onPickFoto: (file: File | null) => void;
  sigRef: RefObject<SignaturePadFieldHandle | null>;
  firmaDocRows: FirmaDocRow[];
  onAddFirmaDocs: (files: FileList | null) => void;
  onRemoveFirmaDoc: (id: string) => void;
  onLimpiarFirmaDibujo: () => void;
  onQuitarTodosDocumentos: () => void;
};

function SlotBlock({
  title,
  observaciones,
  onObservaciones,
  onDictarObs,
  fotoLabel,
  onPickFoto,
  sigRef,
  firmaDocRows,
  onAddFirmaDocs,
  onRemoveFirmaDoc,
  onLimpiarFirmaDibujo,
  onQuitarTodosDocumentos,
}: SlotProps) {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const firmaDocsInputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="registro-bitacora-slot">
      <h2 className="section-title" style={{ marginTop: 0 }}>
        {title}
      </h2>
      <div className="form-field">
        <label className="form-label">Observaciones</label>
        <div className="informe-input-wrap registro-bitacora-obs-wrap">
          <textarea
            className="form-input registro-bitacora-textarea"
            rows={4}
            value={observaciones}
            onChange={(e) => onObservaciones(e.target.value)}
            placeholder="Escriba las observaciones…"
          />
          <button
            type="button"
            className="informe-icon-button"
            aria-label="Dictar observaciones"
            onClick={() => void onDictarObs()}
          >
            <IconMic />
          </button>
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Foto</label>
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onPickFoto(f);
            e.target.value = '';
          }}
        />
        <div className="registro-bitacora-foto-row">
          <button type="button" className="btn-secondary" onClick={() => fotoInputRef.current?.click()}>
            Elegir imagen
          </button>
          <span className="shell-text-muted" style={{ fontSize: '0.85rem' }}>
            {fotoLabel || 'JPG o PNG · máx. 10 MB'}
          </span>
        </div>
      </div>
      <div className="form-field">
        <label className="form-label">Firma y documentos</label>
        <p className="informe-label-hint" style={{ marginTop: 0 }}>
          Puede dibujar la firma, adjuntar varios documentos (imagen, PDF, Word, Excel; máx. 10 MB c/u, hasta{' '}
          {MAX_REGISTRO_FIRMA_DOCS} archivos).
        </p>
        <input
          ref={firmaDocsInputRef}
          type="file"
          accept={REGISTRO_DOC_ACCEPT}
          multiple
          className="sr-only"
          onChange={(e) => {
            onAddFirmaDocs(e.target.files);
            e.target.value = '';
          }}
        />
        <div className="registro-bitacora-foto-row">
          <button type="button" className="btn-secondary" onClick={() => firmaDocsInputRef.current?.click()}>
            Agregar documentos
          </button>
          {firmaDocRows.length > 0 ? (
            <button type="button" className="btn-secondary" onClick={onQuitarTodosDocumentos}>
              Quitar todos los documentos
            </button>
          ) : null}
        </div>
        {firmaDocRows.length > 0 ? (
          <ul className="registro-bitacora-firma-docs-list">
            {firmaDocRows.map((row) => (
              <li key={row.id} className="registro-bitacora-firma-doc-item">
                <span className="registro-bitacora-firma-doc-name" title={row.name}>
                  {row.name}
                  {row.file ? ' (nuevo)' : ''}
                </span>
                {row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="registro-bitacora-firma-doc-link"
                  >
                    Ver
                  </a>
                ) : null}
                <button
                  type="button"
                  className="btn-secondary registro-bitacora-firma-doc-remove"
                  onClick={() => onRemoveFirmaDoc(row.id)}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="shell-text-muted" style={{ fontSize: '0.85rem', margin: '0.35rem 0 0' }}>
            Sin documentos adjuntos.
          </p>
        )}
        <div className="signature-pad-wrap" style={{ marginTop: '0.65rem' }}>
          <SignaturePadField ref={sigRef} />
        </div>
        <button type="button" className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onLimpiarFirmaDibujo}>
          Borrar firma dibujada
        </button>
      </div>
    </div>
  );
}

type RangoResumen = {
  totalDias: number;
  conRegistro: number;
  conInforme?: number;
  registros: { fecha: string; consecutivo: number }[];
  informes?: { fecha: string; informeNo: string | null }[];
};

export function RegistroBitacoraSection({ obraOptions, loadingObras }: Props) {
  const [projectId, setProjectId] = useState('');
  const [fechaDia, setFechaDia] = useState(localYmd);
  const [fechaDesde, setFechaDesde] = useState(localYmd);
  const [fechaHasta, setFechaHasta] = useState(localYmd);
  const [rangoResumen, setRangoResumen] = useState<RangoResumen | null>(null);
  const [loadingRango, setLoadingRango] = useState(false);
  const [proyectoMeta, setProyectoMeta] = useState<ProyectoMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingRegistro, setLoadingRegistro] = useState(false);
  const [consecutivo, setConsecutivo] = useState<number | null>(null);

  const [obsC, setObsC] = useState('');
  const [obsI, setObsI] = useState('');
  const [obsD, setObsD] = useState('');
  const [fotoC, setFotoC] = useState<File | null>(null);
  const [fotoI, setFotoI] = useState<File | null>(null);
  const [fotoD, setFotoD] = useState<File | null>(null);
  const [labelC, setLabelC] = useState('');
  const [labelI, setLabelI] = useState('');
  const [labelD, setLabelD] = useState('');
  const [firmaRowsC, setFirmaRowsC] = useState<FirmaDocRow[]>([]);
  const [firmaRowsI, setFirmaRowsI] = useState<FirmaDocRow[]>([]);
  const [firmaRowsD, setFirmaRowsD] = useState<FirmaDocRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedUrls>(emptyPersisted);
  const [slotFlags, setSlotFlags] = useState<Record<RegistroBitacoraSlotKey, boolean> | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(true);

  const sigC = useRef<SignaturePadFieldHandle>(null);
  const sigI = useRef<SignaturePadFieldHandle>(null);
  const sigD = useRef<SignaturePadFieldHandle>(null);
  const speechRecognitionRef = useRef<WebSpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      try {
        speechRecognitionRef.current?.abort();
      } catch {
        /* noop */
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadingSlots(true);
      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = (await res.json()) as {
          registroBitacoraSlots?: Partial<Record<RegistroBitacoraSlotKey, boolean>>;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setSlotFlags(null);
          return;
        }
        const flags = Object.fromEntries(
          REGISTRO_BITACORA_SLOT_KEYS.map((k) => [k, Boolean(data.registroBitacoraSlots?.[k])]),
        ) as Record<RegistroBitacoraSlotKey, boolean>;
        setSlotFlags(flags);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canSlot = useCallback(
    (slot: RegistroBitacoraSlotKey) => slotFlags?.[slot] === true,
    [slotFlags],
  );

  useEffect(() => {
    if (!projectId) {
      setProyectoMeta(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingMeta(true);
      setErr(null);
      try {
        const res = await fetch(`/api/registro-bitacora/proyecto?projectId=${encodeURIComponent(projectId)}`, {
          credentials: 'include',
        });
        const data = (await res.json()) as ProyectoApiResponse;
        if (cancelled) return;
        if (!res.ok) {
          setErr(data.error ?? 'No se pudo cargar la obra');
          setProyectoMeta(null);
          return;
        }
        setProyectoMeta({
          fechaMin: data.fechaMin ?? null,
          fechaMax: data.fechaMax ?? null,
          name: data.name,
          code: data.code,
        });
        const min = data.fechaMin ?? null;
        const max = data.fechaMax ?? null;
        setFechaDia((prev) => clampYmd(prev, min, max));
        setFechaHasta((prev) => clampYmd(prev, min, max));
        setFechaDesde((prev) => {
          const hoy = clampYmd(localYmd(), min, max);
          const hasta = clampYmd(prev || hoy, min, max);
          const desdeMes = hoy.slice(0, 8) + '01';
          return clampYmd(desdeMes < (min ?? desdeMes) ? min ?? desdeMes : desdeMes, min, max);
        });
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const applyRegistro = useCallback((r: ApiRegistro | null) => {
    if (!r) {
      setConsecutivo(null);
      setObsC('');
      setObsI('');
      setObsD('');
      setPersisted(emptyPersisted);
      setFotoC(null);
      setFotoI(null);
      setFotoD(null);
      setLabelC('');
      setLabelI('');
      setLabelD('');
      setFirmaRowsC([]);
      setFirmaRowsI([]);
      setFirmaRowsD([]);
      sigC.current?.clear();
      sigI.current?.clear();
      sigD.current?.clear();
      return;
    }
    setConsecutivo(r.consecutivo);
    setObsC(r.contratistaObservaciones ?? '');
    setObsI(r.interventoriaObservaciones ?? '');
    setObsD(r.iduObservaciones ?? '');
    setPersisted({
      contratistaFotoUrl: r.contratistaFotoUrl,
      contratistaFirmaUrl: r.contratistaFirmaUrl,
      interventoriaFotoUrl: r.interventoriaFotoUrl,
      interventoriaFirmaUrl: r.interventoriaFirmaUrl,
      iduFotoUrl: r.iduFotoUrl,
      iduFirmaUrl: r.iduFirmaUrl,
    });
    setFotoC(null);
    setFotoI(null);
    setFotoD(null);
    setLabelC(r.contratistaFotoUrl ? 'Imagen guardada' : '');
    setLabelI(r.interventoriaFotoUrl ? 'Imagen guardada' : '');
    setLabelD(r.iduFotoUrl ? 'Imagen guardada' : '');
    setFirmaRowsC(firmaRowsFromApi(r.contratistaFirmaUrl, r.contratistaFirmaDocs ?? []));
    setFirmaRowsI(firmaRowsFromApi(r.interventoriaFirmaUrl, r.interventoriaFirmaDocs ?? []));
    setFirmaRowsD(firmaRowsFromApi(r.iduFirmaUrl, r.iduFirmaDocs ?? []));
    sigC.current?.clear();
    sigI.current?.clear();
    sigD.current?.clear();
  }, []);

  useEffect(() => {
    if (!projectId) {
      applyRegistro(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingRegistro(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/registro-bitacora?projectId=${encodeURIComponent(projectId)}&fecha=${encodeURIComponent(fechaDia)}`,
          { credentials: 'include' },
        );
        const data = (await res.json()) as { registro?: ApiRegistro | null; error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setErr(data.error ?? 'No se pudo cargar el registro');
          applyRegistro(null);
          return;
        }
        applyRegistro(data.registro ?? null);
      } finally {
        if (!cancelled) setLoadingRegistro(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, fechaDia, applyRegistro]);

  useEffect(() => {
    if (!projectId || !fechaDesde || !fechaHasta) {
      setRangoResumen(null);
      return;
    }
    if (fechaDesde > fechaHasta) {
      setRangoResumen(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoadingRango(true);
      try {
        const qs = new URLSearchParams({
          projectId,
          fechaDesde,
          fechaHasta,
        });
        const res = await fetch(`/api/registro-bitacora/rango?${qs}`, { credentials: 'include' });
        const data = (await res.json()) as RangoResumen & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setRangoResumen(null);
          return;
        }
        setRangoResumen({
          totalDias: data.totalDias,
          conRegistro: data.conRegistro,
          conInforme: data.conInforme,
          registros: data.registros ?? [],
          informes: data.informes ?? [],
        });
      } finally {
        if (!cancelled) setLoadingRango(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, fechaDesde, fechaHasta]);

  useEffect(() => {
    if (!fotoC && persisted.contratistaFotoUrl) setLabelC('Imagen guardada');
    if (!fotoC && !persisted.contratistaFotoUrl) setLabelC('');
  }, [fotoC, persisted.contratistaFotoUrl]);
  useEffect(() => {
    if (!fotoI && persisted.interventoriaFotoUrl) setLabelI('Imagen guardada');
    if (!fotoI && !persisted.interventoriaFotoUrl) setLabelI('');
  }, [fotoI, persisted.interventoriaFotoUrl]);
  useEffect(() => {
    if (!fotoD && persisted.iduFotoUrl) setLabelD('Imagen guardada');
    if (!fotoD && !persisted.iduFotoUrl) setLabelD('');
  }, [fotoD, persisted.iduFotoUrl]);

  const validateFoto = useCallback((file: File | null, setLabel: (s: string) => void): boolean => {
    if (!file) return true;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setErr('Las imágenes deben ser JPG o PNG.');
      return false;
    }
    if (file.size > MAX_FILE) {
      setErr('Cada archivo puede pesar como máximo 10 MB.');
      return false;
    }
    setLabel(file.name);
    return true;
  }, []);

  const dictar = useCallback((setter: Dispatch<SetStateAction<string>>) => {
    setVoiceErr(null);
    void startSpeechDictado({
      recognitionRef: speechRecognitionRef,
      onTranscript: (text) => setter((p) => (p.trim() ? `${p.trim()} ${text}` : text)),
      onError: (m) => setVoiceErr(m),
    });
  }, []);

  const onPickC = (f: File | null) => {
    setErr(null);
    if (f && !validateFoto(f, setLabelC)) return;
    setFotoC(f);
    if (!f) setLabelC('');
  };
  const onPickI = (f: File | null) => {
    setErr(null);
    if (f && !validateFoto(f, setLabelI)) return;
    setFotoI(f);
    if (!f) setLabelI('');
  };
  const onPickD = (f: File | null) => {
    setErr(null);
    if (f && !validateFoto(f, setLabelD)) return;
    setFotoD(f);
    if (!f) setLabelD('');
  };

  const addFirmaDocs = useCallback(
    (files: FileList | null, setRows: Dispatch<SetStateAction<FirmaDocRow[]>>) => {
      if (!files?.length) return;
      setErr(null);
      const added: FirmaDocRow[] = [];
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        const vErr = validateRegistroDoc(f);
        if (vErr) {
          setErr(vErr);
          continue;
        }
        added.push({ id: newFirmaDocRowId(), name: f.name, url: null, file: f });
      }
      if (added.length === 0) return;
      setRows((prev) => [...prev, ...added].slice(0, MAX_REGISTRO_FIRMA_DOCS));
    },
    [],
  );

  const rowsToFirmaDocs = async (rows: FirmaDocRow[], pid: string): Promise<RegistroBitacoraFirmaDoc[]> => {
    const out: RegistroBitacoraFirmaDoc[] = [];
    for (const row of rows) {
      if (row.file) {
        out.push(await uploadRegistroDocumento(row.file, pid));
      } else if (row.url) {
        out.push({ url: row.url, name: row.name });
      }
    }
    return out;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!projectId) {
      setErr('Seleccione una obra.');
      return;
    }
    if (!fechaDia) {
      setErr('Seleccione la fecha del registro.');
      return;
    }
    const allowed = REGISTRO_BITACORA_SLOT_KEYS.filter((s) => canSlot(s));
    if (allowed.length === 0) {
      setErr('Su rol no tiene permiso para guardar ninguna sección del registro de bitácora.');
      return;
    }

    setSaving(true);
    try {
      const body: {
        projectId: string;
        fecha: string;
        contratista?: {
          observaciones: string;
          fotoUrl: string | null;
          firmaUrl: string | null;
          firmaDocs: RegistroBitacoraFirmaDoc[];
        };
        interventoria?: {
          observaciones: string;
          fotoUrl: string | null;
          firmaUrl: string | null;
          firmaDocs: RegistroBitacoraFirmaDoc[];
        };
        idu?: {
          observaciones: string;
          fotoUrl: string | null;
          firmaUrl: string | null;
          firmaDocs: RegistroBitacoraFirmaDoc[];
        };
      } = { projectId, fecha: fechaDia };

      if (canSlot('contratista')) {
        let urlFotoC: string | null = null;
        let urlFirmaC: string | null = null;
        if (fotoC) urlFotoC = await uploadEvidenciaFoto(fotoC, projectId);
        else urlFotoC = persisted.contratistaFotoUrl;
        const fc = sigC.current?.toPngFile() ?? null;
        if (fc) urlFirmaC = await uploadEvidenciaFoto(fc, projectId);
        else urlFirmaC = persisted.contratistaFirmaUrl;
        const firmaDocsC = await rowsToFirmaDocs(firmaRowsC, projectId);
        body.contratista = {
          observaciones: obsC,
          fotoUrl: urlFotoC,
          firmaUrl: urlFirmaC,
          firmaDocs: firmaDocsC,
        };
      }

      if (canSlot('interventor')) {
        let urlFotoI: string | null = null;
        let urlFirmaI: string | null = null;
        if (fotoI) urlFotoI = await uploadEvidenciaFoto(fotoI, projectId);
        else urlFotoI = persisted.interventoriaFotoUrl;
        const fi = sigI.current?.toPngFile() ?? null;
        if (fi) urlFirmaI = await uploadEvidenciaFoto(fi, projectId);
        else urlFirmaI = persisted.interventoriaFirmaUrl;
        const firmaDocsI = await rowsToFirmaDocs(firmaRowsI, projectId);
        body.interventoria = {
          observaciones: obsI,
          fotoUrl: urlFotoI,
          firmaUrl: urlFirmaI,
          firmaDocs: firmaDocsI,
        };
      }

      if (canSlot('idu')) {
        let urlFotoD: string | null = null;
        let urlFirmaD: string | null = null;
        if (fotoD) urlFotoD = await uploadEvidenciaFoto(fotoD, projectId);
        else urlFotoD = persisted.iduFotoUrl;
        const fd = sigD.current?.toPngFile() ?? null;
        if (fd) urlFirmaD = await uploadEvidenciaFoto(fd, projectId);
        else urlFirmaD = persisted.iduFirmaUrl;
        const firmaDocsD = await rowsToFirmaDocs(firmaRowsD, projectId);
        body.idu = {
          observaciones: obsD,
          fotoUrl: urlFotoD,
          firmaUrl: urlFirmaD,
          firmaDocs: firmaDocsD,
        };
      }

      const res = await fetch('/api/registro-bitacora', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; consecutivo?: number };
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');

      setMsg(res.status === 201 ? 'Registro creado correctamente.' : 'Registro actualizado correctamente.');
      if (typeof data.consecutivo === 'number') setConsecutivo(data.consecutivo);

      const reload = await fetch(
        `/api/registro-bitacora?projectId=${encodeURIComponent(projectId)}&fecha=${encodeURIComponent(fechaDia)}`,
        { credentials: 'include' },
      );
      const reloadJson = (await reload.json()) as { registro?: ApiRegistro | null };
      if (reload.ok) applyRegistro(reloadJson.registro ?? null);
    } catch (er: unknown) {
      setErr(er instanceof Error ? er.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleImprimir = () => {
    setErr(null);
    if (!projectId) {
      setErr('Seleccione una obra para imprimir.');
      return;
    }
    if (!fechaDesde || !fechaHasta) {
      setErr('Indique el rango de fechas para imprimir.');
      return;
    }
    if (fechaDesde > fechaHasta) {
      setErr('La fecha inicial no puede ser posterior a la final.');
      return;
    }
    if (rangoResumen && (rangoResumen.conInforme ?? 0) === 0) {
      setErr(
        'No hay informes diarios en ese rango. Cree el informe en «Datos generales» (obra y fecha) antes de imprimir.',
      );
      return;
    }
    const qs = new URLSearchParams({
      projectId,
      fechaDesde,
      fechaHasta,
    });
    window.open(`/api/registro-bitacora/pdf?${qs}`, '_blank', 'noopener,noreferrer');
  };

  const irADiaRegistro = (ymd: string) => {
    setFechaDia(ymd);
    setErr(null);
    setMsg(null);
  };

  return (
    <section className="shell-card shell-card-wide registro-bitacora-shell">
      <h1 className="shell-title">Registro de bitácora</h1>

      {err && <p className="feedback feedback-error">{err}</p>}
      {voiceErr && <p className="feedback feedback-error">{voiceErr}</p>}

      <form className="auth-form" onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
        <div className="form-field">
          <label className="form-label" htmlFor="rb-obra">
            Obra
          </label>
          {loadingObras ? (
            <p className="shell-text-muted">Cargando obras…</p>
          ) : (
            <InformeSearchableSelect
              id="rb-obra"
              value={projectId}
              options={obraOptions}
              onChange={setProjectId}
              emptyOptionLabel="Seleccione una obra…"
              searchPlaceholder="Buscar obra…"
            />
          )}
        </div>

        <div className="form-field">
          <label className="form-label" htmlFor="rb-fecha">
            Día del registro
          </label>
          <input
            id="rb-fecha"
            type="date"
            className="form-input"
            value={fechaDia}
            min={proyectoMeta?.fechaMin ?? undefined}
            max={proyectoMeta?.fechaMax ?? undefined}
            onChange={(e) => {
              const v = e.target.value;
              setFechaDia(clampYmd(v, proyectoMeta?.fechaMin ?? null, proyectoMeta?.fechaMax ?? null));
            }}
            disabled={!projectId || loadingMeta}
          />
          {loadingMeta && <p className="shell-text-muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>Cargando fechas de la obra…</p>}
          {!loadingMeta && proyectoMeta && (proyectoMeta.fechaMin || proyectoMeta.fechaMax) && (
            <p className="informe-label-hint" style={{ marginTop: '0.35rem' }}>
              Solo puede elegir fechas entre el inicio y el fin configurados para esta obra
              {proyectoMeta.fechaMin && proyectoMeta.fechaMax
                ? ` (${proyectoMeta.fechaMin} — ${proyectoMeta.fechaMax}).`
                : proyectoMeta.fechaMin
                  ? ` (desde ${proyectoMeta.fechaMin}).`
                  : ` (hasta ${proyectoMeta.fechaMax}).`}
            </p>
          )}
          {!loadingMeta && proyectoMeta && !proyectoMeta.fechaMin && !proyectoMeta.fechaMax && (
            <p className="informe-label-hint" style={{ marginTop: '0.35rem' }}>
              Esta obra no tiene fechas de inicio y fin en el sistema; puede usar cualquier día del calendario.
            </p>
          )}
        </div>

        {consecutivo != null && (
          <p className="shell-text-muted" style={{ marginTop: 0 }}>
            Consecutivo de este registro: <strong>{consecutivo}</strong>
          </p>
        )}
        {loadingRegistro && projectId && <p className="shell-text-muted">Cargando datos del día…</p>}

        <div className="section-divider" />
        <h2 className="section-title" style={{ marginBottom: '0.75rem' }}>
          Consultar e imprimir por rango
        </h2>
        <p className="informe-label-hint" style={{ marginTop: 0, marginBottom: '1rem' }}>
          Elija un rango de fechas: se listan los informes diarios (obra + fecha) y se genera una hoja por cada uno, con
          sus franjas de clima (mañana, tarde, noche) y la bitácora del mismo día si existe.
        </p>

        <div className="registro-bitacora-rango-fechas">
          <div className="form-field">
            <label className="form-label" htmlFor="rb-desde">
              Desde
            </label>
            <input
              id="rb-desde"
              type="date"
              className="form-input"
              value={fechaDesde}
              min={proyectoMeta?.fechaMin ?? undefined}
              max={proyectoMeta?.fechaMax ?? undefined}
              disabled={!projectId || loadingMeta}
              onChange={(e) => {
                const v = clampYmd(e.target.value, proyectoMeta?.fechaMin ?? null, proyectoMeta?.fechaMax ?? null);
                setFechaDesde(v);
                if (fechaHasta && v > fechaHasta) setFechaHasta(v);
              }}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="rb-hasta">
              Hasta
            </label>
            <input
              id="rb-hasta"
              type="date"
              className="form-input"
              value={fechaHasta}
              min={proyectoMeta?.fechaMin ?? undefined}
              max={proyectoMeta?.fechaMax ?? undefined}
              disabled={!projectId || loadingMeta}
              onChange={(e) => {
                const v = clampYmd(e.target.value, proyectoMeta?.fechaMin ?? null, proyectoMeta?.fechaMax ?? null);
                setFechaHasta(v);
                if (fechaDesde && v < fechaDesde) setFechaDesde(v);
              }}
            />
          </div>
        </div>

        {loadingRango && projectId && <p className="shell-text-muted">Buscando registros en el rango…</p>}
        {!loadingRango && rangoResumen && projectId && (
          <p className="shell-text-muted" style={{ marginTop: 0 }}>
            En el rango hay <strong>{rangoResumen.conInforme ?? 0}</strong> informe
            {(rangoResumen.conInforme ?? 0) === 1 ? '' : 's'} diario
            {(rangoResumen.conInforme ?? 0) === 1 ? '' : 's'} (una hoja por informe) y{' '}
            <strong>{rangoResumen.conRegistro}</strong> registro{rangoResumen.conRegistro === 1 ? '' : 's'} de bitácora
            por día.
          </p>
        )}
        {!loadingRango && rangoResumen && (rangoResumen.informes?.length ?? 0) > 0 && (
          <ul className="registro-bitacora-rango-lista">
            {rangoResumen.informes!.map((inf, i) => (
              <li key={`${inf.fecha}-${inf.informeNo ?? i}`}>
                <button type="button" className="registro-bitacora-rango-link" onClick={() => irADiaRegistro(inf.fecha)}>
                  {inf.fecha} · {inf.informeNo ?? 'sin número'}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="form-field registro-bitacora-print-wrap">
          <button
            type="button"
            className="registro-bitacora-print-btn"
            onClick={handleImprimir}
            disabled={
              !projectId ||
              !fechaDesde ||
              !fechaHasta ||
              loadingRango ||
              (rangoResumen != null && (rangoResumen.conInforme ?? 0) === 0)
            }
          >
            <span className="registro-bitacora-print-btn-title">Vista previa e imprimir PDF del rango</span>
            <span className="registro-bitacora-print-btn-hint">
              Una hoja por informe diario, con clima mañana/tarde/noche (máx. 93 días).
            </span>
          </button>
        </div>

        <div className="section-divider" />
        {loadingSlots ? (
          <p className="shell-text-muted">Cargando permisos de su rol…</p>
        ) : slotFlags && !REGISTRO_BITACORA_SLOT_KEYS.some((s) => canSlot(s)) ? (
          <p className="feedback feedback-error">
            Su rol no tiene ninguna sección asignada en el registro de bitácora. Pida al administrador que configure
            permisos en Usuarios → Permisos de menú.
          </p>
        ) : null}

        {canSlot('contratista') ? (
          <>
            <SlotBlock
              title={REGISTRO_BITACORA_SLOT_LABELS.contratista}
              observaciones={obsC}
              onObservaciones={setObsC}
              onDictarObs={() => dictar(setObsC)}
              fotoLabel={labelC}
              onPickFoto={onPickC}
              sigRef={sigC}
              firmaDocRows={firmaRowsC}
              onAddFirmaDocs={(files) => addFirmaDocs(files, setFirmaRowsC)}
              onRemoveFirmaDoc={(id) => setFirmaRowsC((rows) => rows.filter((r) => r.id !== id))}
              onLimpiarFirmaDibujo={() => {
                sigC.current?.clear();
                setPersisted((p) => ({ ...p, contratistaFirmaUrl: null }));
              }}
              onQuitarTodosDocumentos={() => setFirmaRowsC([])}
            />
            <div className="section-divider" />
          </>
        ) : null}

        {canSlot('interventor') ? (
          <>
            <SlotBlock
              title={REGISTRO_BITACORA_SLOT_LABELS.interventor}
              observaciones={obsI}
              onObservaciones={setObsI}
              onDictarObs={() => dictar(setObsI)}
              fotoLabel={labelI}
              onPickFoto={onPickI}
              sigRef={sigI}
              firmaDocRows={firmaRowsI}
              onAddFirmaDocs={(files) => addFirmaDocs(files, setFirmaRowsI)}
              onRemoveFirmaDoc={(id) => setFirmaRowsI((rows) => rows.filter((r) => r.id !== id))}
              onLimpiarFirmaDibujo={() => {
                sigI.current?.clear();
                setPersisted((p) => ({ ...p, interventoriaFirmaUrl: null }));
              }}
              onQuitarTodosDocumentos={() => setFirmaRowsI([])}
            />
            <div className="section-divider" />
          </>
        ) : null}

        {canSlot('idu') ? (
          <>
            <SlotBlock
              title={REGISTRO_BITACORA_SLOT_LABELS.idu}
              observaciones={obsD}
              onObservaciones={setObsD}
              onDictarObs={() => dictar(setObsD)}
              fotoLabel={labelD}
              onPickFoto={onPickD}
              sigRef={sigD}
              firmaDocRows={firmaRowsD}
              onAddFirmaDocs={(files) => addFirmaDocs(files, setFirmaRowsD)}
              onRemoveFirmaDoc={(id) => setFirmaRowsD((rows) => rows.filter((r) => r.id !== id))}
              onLimpiarFirmaDibujo={() => {
                sigD.current?.clear();
                setPersisted((p) => ({ ...p, iduFirmaUrl: null }));
              }}
              onQuitarTodosDocumentos={() => setFirmaRowsD([])}
            />
            <div className="section-divider" />
          </>
        ) : null}

        <button
          type="submit"
          className="btn-primary"
          disabled={
            saving ||
            loadingObras ||
            loadingRegistro ||
            loadingSlots ||
            obraOptions.length === 0 ||
            !projectId ||
            !REGISTRO_BITACORA_SLOT_KEYS.some((s) => canSlot(s))
          }
        >
          {saving ? 'Guardando…' : 'Guardar registro'}
        </button>
        {msg && (
          <p className="feedback feedback-success" style={{ marginTop: '1rem', marginBottom: 0 }}>
            {msg}
          </p>
        )}
      </form>
    </section>
  );
}
