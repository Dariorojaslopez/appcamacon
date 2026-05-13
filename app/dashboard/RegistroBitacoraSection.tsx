'use client';

import { useCallback, useRef, useState, type RefObject } from 'react';
import { InformeSearchableSelect, type InformeSearchableOption } from './InformeSearchableSelect';
import { SignaturePadField, type SignaturePadFieldHandle } from './SignaturePadField';

const MAX_FILE = 10 * 1024 * 1024;

type Props = {
  obraOptions: InformeSearchableOption[];
  loadingObras: boolean;
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
  fotoLabel: string;
  onPickFoto: (file: File | null) => void;
  sigRef: RefObject<SignaturePadFieldHandle | null>;
  onClearFirma: () => void;
};

function SlotBlock({ title, observaciones, onObservaciones, fotoLabel, onPickFoto, sigRef, onClearFirma }: SlotProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="registro-bitacora-slot">
      <h2 className="section-title" style={{ marginTop: 0 }}>
        {title}
      </h2>
      <div className="form-field">
        <label className="form-label">Observaciones</label>
        <textarea
          className="form-input registro-bitacora-textarea"
          rows={4}
          value={observaciones}
          onChange={(e) => onObservaciones(e.target.value)}
          placeholder="Escriba las observaciones…"
        />
      </div>
      <div className="form-field">
        <label className="form-label">Foto</label>
        <input
          ref={inputRef}
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
          <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()}>
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
          Dibuje en el recuadro con el dedo o el mouse.
        </p>
        <div className="signature-pad-wrap">
          <SignaturePadField ref={sigRef} />
        </div>
        <button type="button" className="btn-secondary" style={{ marginTop: '0.5rem' }} onClick={onClearFirma}>
          Borrar firma
        </button>
      </div>
    </div>
  );
}

export function RegistroBitacoraSection({ obraOptions, loadingObras }: Props) {
  const [projectId, setProjectId] = useState('');
  const [obsC, setObsC] = useState('');
  const [obsI, setObsI] = useState('');
  const [obsD, setObsD] = useState('');
  const [fotoC, setFotoC] = useState<File | null>(null);
  const [fotoI, setFotoI] = useState<File | null>(null);
  const [fotoD, setFotoD] = useState<File | null>(null);
  const [labelC, setLabelC] = useState('');
  const [labelI, setLabelI] = useState('');
  const [labelD, setLabelD] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const sigC = useRef<SignaturePadFieldHandle>(null);
  const sigI = useRef<SignaturePadFieldHandle>(null);
  const sigD = useRef<SignaturePadFieldHandle>(null);

  const validateFoto = useCallback((file: File | null, setLabel: (s: string) => void): boolean => {
    if (!file) return true;
    if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type)) {
      setErr('Las fotos deben ser JPG o PNG.');
      return false;
    }
    if (file.size > MAX_FILE) {
      setErr('Cada foto puede pesar como máximo 10 MB.');
      return false;
    }
    setLabel(file.name);
    return true;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErr(null);
    if (!projectId) {
      setErr('Seleccione una obra.');
      return;
    }
    setSaving(true);
    try {
      let urlFotoC: string | null = null;
      let urlFotoI: string | null = null;
      let urlFotoD: string | null = null;
      if (fotoC) urlFotoC = await uploadEvidenciaFoto(fotoC, projectId);
      if (fotoI) urlFotoI = await uploadEvidenciaFoto(fotoI, projectId);
      if (fotoD) urlFotoD = await uploadEvidenciaFoto(fotoD, projectId);

      let urlFirmaC: string | null = null;
      let urlFirmaI: string | null = null;
      let urlFirmaD: string | null = null;
      const fc = sigC.current?.toPngFile() ?? null;
      const fi = sigI.current?.toPngFile() ?? null;
      const fd = sigD.current?.toPngFile() ?? null;
      if (fc) urlFirmaC = await uploadEvidenciaFoto(fc, projectId);
      if (fi) urlFirmaI = await uploadEvidenciaFoto(fi, projectId);
      if (fd) urlFirmaD = await uploadEvidenciaFoto(fd, projectId);

      const res = await fetch('/api/registro-bitacora', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
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
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'No se pudo guardar');

      setMsg('Registro guardado correctamente.');
      setObsC('');
      setObsI('');
      setObsD('');
      setFotoC(null);
      setFotoI(null);
      setFotoD(null);
      setLabelC('');
      setLabelI('');
      setLabelD('');
      sigC.current?.clear();
      sigI.current?.clear();
      sigD.current?.clear();
    } catch (er: unknown) {
      setErr(er instanceof Error ? er.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="shell-card shell-card-wide registro-bitacora-shell">
      <h1 className="shell-title">Registro de bitácora</h1>
      <p className="shell-text">
        Seleccione la obra y complete contratista, interventoría e IDU. Cada bloque incluye observaciones, una foto
        opcional y firma dibujada (se guardan en la misma nube de evidencias de la obra).
      </p>

      {msg && <p className="feedback feedback-success">{msg}</p>}
      {err && <p className="feedback feedback-error">{err}</p>}

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

        <div className="section-divider" />
        <SlotBlock
          title="Contratista"
          observaciones={obsC}
          onObservaciones={setObsC}
          fotoLabel={labelC}
          onPickFoto={onPickC}
          sigRef={sigC}
          onClearFirma={() => sigC.current?.clear()}
        />
        <div className="section-divider" />
        <SlotBlock
          title="Interventoría"
          observaciones={obsI}
          onObservaciones={setObsI}
          fotoLabel={labelI}
          onPickFoto={onPickI}
          sigRef={sigI}
          onClearFirma={() => sigI.current?.clear()}
        />
        <div className="section-divider" />
        <SlotBlock
          title="IDU"
          observaciones={obsD}
          onObservaciones={setObsD}
          fotoLabel={labelD}
          onPickFoto={onPickD}
          sigRef={sigD}
          onClearFirma={() => sigD.current?.clear()}
        />

        <button type="submit" className="btn-primary" disabled={saving || loadingObras || obraOptions.length === 0}>
          {saving ? 'Guardando…' : 'Guardar registro'}
        </button>
      </form>
    </section>
  );
}
