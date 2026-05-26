'use client';

import { FormEvent, useState } from 'react';

type Props = {
  userName: string;
  onSuccess: () => void;
};

export function ForcePasswordChangeModal({ userName, onSuccess }: Props) {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La confirmación no coincide.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(data.error ?? 'No se pudo actualizar la contraseña.');
        return;
      }
      onSuccess();
    } catch {
      setError('Error de conexión con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="force-password-backdrop" role="presentation">
      <div
        className="sigocc-alert-modal force-password-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="force-password-title"
      >
        <h2 id="force-password-title" className="sigocc-alert-modal-title">
          Defina su nueva contraseña
        </h2>
        <p className="sigocc-alert-modal-text">
          Hola <strong>{userName}</strong>, ingresó con una contraseña temporal enviada por correo. Por seguridad,
          debe elegir una contraseña nueva antes de continuar en el sistema.
        </p>
        <form onSubmit={handleSubmit} className="force-password-form">
          <div className="form-field">
            <label className="form-label" htmlFor="force-new-password">
              Nueva contraseña
            </label>
            <input
              id="force-new-password"
              className="form-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label className="form-label" htmlFor="force-confirm-password">
              Confirmar contraseña
            </label>
            <input
              id="force-confirm-password"
              className="form-input"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          {error ? (
            <p className="feedback feedback-error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn-primary sigocc-alert-modal-btn" disabled={loading}>
            {loading ? 'Guardando…' : 'Guardar y continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
