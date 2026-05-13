'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { InformeSearchableSelect, type InformeSearchableOption } from './InformeSearchableSelect';
import { SignaturePadField, type SignaturePadFieldHandle } from './SignaturePadField';
import { IconMic } from './icons';
import { startSpeechDictado, type WebSpeechRecognition } from '../../src/lib/speechDictado';

const MAX_FILE = 10 * 1024 * 1024;

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
  interventoriaObservaciones: string;
  interventoriaFotoUrl: string | null;
  interventoriaFirmaUrl: string | null;
  iduObservaciones: string;
  iduFotoUrl: string | null;
  iduFirmaUrl: string | null;
};

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
  firmaImagenLabel: string;
  onPickFirmaImagen: (file: File | null) => void;
  onLimpiarFirma: () => void;
};

function SlotBlock({
  title,
  observaciones,
  onObservaciones,
  onDictarObs,
  fotoLabel,
  onPickFoto,
  sigRef,
  firmaImagenLabel,
  onPickFirmaImagen,
  onLimpiarFirma,
}: SlotProps) {
  const fotoInputRef = useRef<HTMLInputElement>(null);
  const firmaFileRef = useRef<HTMLInputElement>(null);
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
        <label className="form-label">Firma</label>
        <p className="informe-label-hint" style={{ marginTop: 0 }}>
          Dibuje en el recuadro o cargue una imagen de la firma (JPG o PNG, máx. 10 MB).
        </p>
        <input
          ref={firmaFileRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            onPickFirmaImagen(f);
            e.target.value = '';
          }}
        />
        <div className="registro-bitacora-foto-row">
          <button type="button" className="btn-secondary" onClick={() => firmaFileRef.current?.click()}>
            Cargar firma (imagen)
          </button>
          <span className="shell-text-muted" style={{ fontSize: '0.85rem' }}>
            {firmaImagenLabel || 'Opcional si ya dibujó arriba'}
          </span>
        </div>
        <div className="signature-pad-wrap" style={{ marginTop: '0.65rem' }}>
          <SignaturePadField ref={sigRef} />
        </div>
        <button type="button" className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onLimpiarFirma}>
          Borrar firma (dibujo e imagen)
        </button>
      </div>
    </div>
  );
}

export function RegistroBitacoraSection({ obraOptions, loadingObras }: Props) {
  const [projectId, setProjectId] = useState('');
  const [fechaDia, setFechaDia] = useState(localYmd);
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
  const [firmaCFile, setFirmaCFile] = useState<File | null>(null);
  const [firmaIFile, setFirmaIFile] = useState<File | null>(null);
  const [firmaDFile, setFirmaDFile] = useState<File | null>(null);
  const [firmaCLabel, setFirmaCLabel] = useState('');
  const [firmaILabel, setFirmaILabel] = useState('');
  const [firmaDLabel, setFirmaDLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [voiceErr, setVoiceErr] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<PersistedUrls>(emptyPersisted);

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
        setFechaDia((prev) => clampYmd(prev, data.fechaMin ?? null, data.fechaMax ?? null));
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
      setFirmaCFile(null);
      setFirmaIFile(null);
      setFirmaDFile(null);
      setFirmaCLabel('');
      setFirmaILabel('');
      setFirmaDLabel('');
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
    setFirmaCFile(null);
    setFirmaIFile(null);
    setFirmaDFile(null);
    setFirmaCLabel(r.contratistaFirmaUrl ? 'Firma guardada' : '');
    setFirmaILabel(r.interventoriaFirmaUrl ? 'Firma guardada' : '');
    setFirmaDLabel(r.iduFirmaUrl ? 'Firma guardada' : '');
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

  useEffect(() => {
    if (!firmaCFile && persisted.contratistaFirmaUrl) setFirmaCLabel('Firma guardada');
    if (!firmaCFile && !persisted.contratistaFirmaUrl) setFirmaCLabel('');
  }, [firmaCFile, persisted.contratistaFirmaUrl]);
  useEffect(() => {
    if (!firmaIFile && persisted.interventoriaFirmaUrl) setFirmaILabel('Firma guardada');
    if (!firmaIFile && !persisted.interventoriaFirmaUrl) setFirmaILabel('');
  }, [firmaIFile, persisted.interventoriaFirmaUrl]);
  useEffect(() => {
    if (!firmaDFile && persisted.iduFirmaUrl) setFirmaDLabel('Firma guardada');
    if (!firmaDFile && !persisted.iduFirmaUrl) setFirmaDLabel('');
  }, [firmaDFile, persisted.iduFirmaUrl]);

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

  const onPickFirmaC = (f: File | null) => {
    setErr(null);
    if (f && !validateFoto(f, setFirmaCLabel)) return;
    setFirmaCFile(f);
    if (!f) setFirmaCLabel('');
  };
  const onPickFirmaI = (f: File | null) => {
    setErr(null);
    if (f && !validateFoto(f, setFirmaILabel)) return;
    setFirmaIFile(f);
    if (!f) setFirmaILabel('');
  };
  const onPickFirmaD = (f: File | null) => {
    setErr(null);
    if (f && !validateFoto(f, setFirmaDLabel)) return;
    setFirmaDFile(f);
    if (!f) setFirmaDLabel('');
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
    setSaving(true);
    try {
      let urlFotoC: string | null = null;
      let urlFotoI: string | null = null;
      let urlFotoD: string | null = null;
      if (fotoC) urlFotoC = await uploadEvidenciaFoto(fotoC, projectId);
      else urlFotoC = persisted.contratistaFotoUrl;
      if (fotoI) urlFotoI = await uploadEvidenciaFoto(fotoI, projectId);
      else urlFotoI = persisted.interventoriaFotoUrl;
      if (fotoD) urlFotoD = await uploadEvidenciaFoto(fotoD, projectId);
      else urlFotoD = persisted.iduFotoUrl;

      let urlFirmaC: string | null = null;
      let urlFirmaI: string | null = null;
      let urlFirmaD: string | null = null;
      if (firmaCFile) urlFirmaC = await uploadEvidenciaFoto(firmaCFile, projectId);
      else {
        const fc = sigC.current?.toPngFile() ?? null;
        if (fc) urlFirmaC = await uploadEvidenciaFoto(fc, projectId);
        else urlFirmaC = persisted.contratistaFirmaUrl;
      }
      if (firmaIFile) urlFirmaI = await uploadEvidenciaFoto(firmaIFile, projectId);
      else {
        const fi = sigI.current?.toPngFile() ?? null;
        if (fi) urlFirmaI = await uploadEvidenciaFoto(fi, projectId);
        else urlFirmaI = persisted.interventoriaFirmaUrl;
      }
      if (firmaDFile) urlFirmaD = await uploadEvidenciaFoto(firmaDFile, projectId);
      else {
        const fd = sigD.current?.toPngFile() ?? null;
        if (fd) urlFirmaD = await uploadEvidenciaFoto(fd, projectId);
        else urlFirmaD = persisted.iduFirmaUrl;
      }

      const res = await fetch('/api/registro-bitacora', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          fecha: fechaDia,
          contratista: {
            observaciones: obsC,
            fotoUrl: urlFotoC,
            firmaUrl: urlFirmaC,
          },
          interventoria: {
            observaciones: obsI,
            fotoUrl: urlFotoI,
            firmaUrl: urlFirmaI,
          },
          idu: {
            observaciones: obsD,
            fotoUrl: urlFotoD,
            firmaUrl: urlFirmaD,
          },
        }),
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
    if (!fechaDia) {
      setErr('Seleccione la fecha del registro.');
      return;
    }
    window.open(
      `/api/registro-bitacora/pdf?projectId=${encodeURIComponent(projectId)}&fecha=${encodeURIComponent(fechaDia)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <section className="shell-card shell-card-wide registro-bitacora-shell">
      <h1 className="shell-title">Registro de bitácora</h1>

      {msg && <p className="feedback feedback-success">{msg}</p>}
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

        <div className="form-field" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button type="button" className="btn-secondary" onClick={handleImprimir} disabled={!projectId || !fechaDia}>
            Imprimir / PDF del día
          </button>
          <span className="informe-label-hint">Abre una vista para imprimir o guardar PDF (requiere haber guardado el registro).</span>
        </div>

        <div className="section-divider" />
        <SlotBlock
          title="Contratista"
          observaciones={obsC}
          onObservaciones={setObsC}
          onDictarObs={() => dictar(setObsC)}
          fotoLabel={labelC}
          onPickFoto={onPickC}
          sigRef={sigC}
          firmaImagenLabel={firmaCLabel}
          onPickFirmaImagen={onPickFirmaC}
          onLimpiarFirma={() => {
            sigC.current?.clear();
            setFirmaCFile(null);
            setFirmaCLabel('');
            setPersisted((p) => ({ ...p, contratistaFirmaUrl: null }));
          }}
        />
        <div className="section-divider" />
        <SlotBlock
          title="Interventoría"
          observaciones={obsI}
          onObservaciones={setObsI}
          onDictarObs={() => dictar(setObsI)}
          fotoLabel={labelI}
          onPickFoto={onPickI}
          sigRef={sigI}
          firmaImagenLabel={firmaILabel}
          onPickFirmaImagen={onPickFirmaI}
          onLimpiarFirma={() => {
            sigI.current?.clear();
            setFirmaIFile(null);
            setFirmaILabel('');
            setPersisted((p) => ({ ...p, interventoriaFirmaUrl: null }));
          }}
        />
        <div className="section-divider" />
        <SlotBlock
          title="IDU"
          observaciones={obsD}
          onObservaciones={setObsD}
          onDictarObs={() => dictar(setObsD)}
          fotoLabel={labelD}
          onPickFoto={onPickD}
          sigRef={sigD}
          firmaImagenLabel={firmaDLabel}
          onPickFirmaImagen={onPickFirmaD}
          onLimpiarFirma={() => {
            sigD.current?.clear();
            setFirmaDFile(null);
            setFirmaDLabel('');
            setPersisted((p) => ({ ...p, iduFirmaUrl: null }));
          }}
        />

        <button
          type="submit"
          className="btn-primary"
          disabled={saving || loadingObras || loadingRegistro || obraOptions.length === 0 || !projectId}
        >
          {saving ? 'Guardando…' : 'Guardar registro'}
        </button>
      </form>
    </section>
  );
}
