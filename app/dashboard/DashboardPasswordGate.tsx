'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ForcePasswordChangeModal } from './ForcePasswordChangeModal';

type MeResponse = {
  user?: { name?: string };
  mustChangePassword?: boolean;
  error?: string;
};

export function DashboardPasswordGate({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [mustChange, setMustChange] = useState(false);
  const [userName, setUserName] = useState('');

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = (await res.json()) as MeResponse;
      if (!res.ok) {
        setMustChange(false);
        return;
      }
      setMustChange(data.mustChangePassword === true);
      setUserName(data.user?.name?.trim() || 'Usuario');
    } catch {
      setMustChange(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const handleSuccess = () => {
    setMustChange(false);
    try {
      sessionStorage.removeItem('sigocc_mustChangePassword');
    } catch {
      // ignorar
    }
  };

  if (loading) {
    return (
      <div className="force-password-loading" aria-live="polite">
        Cargando…
      </div>
    );
  }

  return (
    <>
      {children}
      {mustChange ? <ForcePasswordChangeModal userName={userName} onSuccess={handleSuccess} /> : null}
    </>
  );
}
