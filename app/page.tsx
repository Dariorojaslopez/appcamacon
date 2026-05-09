'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginResponse {
  user?: {
    id: string;
    identification: string;
    email: string;
    name: string;
    role: string;
  };
  allowedMenus?: string[];
  error?: string;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function HomePage() {
  const router = useRouter();
  const [identification, setIdentification] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installAvailable, setInstallAvailable] = useState(false);

  // Registro básico del service worker para PWA
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.error('Error al registrar el service worker', err));

    const handler = (e: Event) => {
      const deferredEvent = e as BeforeInstallPromptEvent;
      deferredEvent.preventDefault();
      setInstallPrompt(deferredEvent);
      setInstallAvailable(true);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setInstallAvailable(false);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallAvailable(false);
      setInstallPrompt(null);
    }
  };

  const handleInstallHelpClick = () => {
    if (typeof window === 'undefined') return;
    const ua = window.navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(ua);
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isEdge = /edg\//.test(ua);
    const isChrome = /chrome/.test(ua) && !isEdge;

    let message = 'Para instalar la app, abre el menu del navegador y usa "Instalar aplicacion".';
    if (isAndroid && isChrome) {
      message = 'Chrome Android: abre el menu (tres puntos) y toca "Instalar aplicacion" o "Agregar a pantalla principal".';
    } else if (isAndroid && isEdge) {
      message = 'Edge Android: abre el menu y selecciona "Instalar esta aplicacion".';
    } else if (isIOS) {
      message = 'iPhone/iPad: toca Compartir y luego "Agregar a pantalla de inicio".';
    } else if (isChrome || isEdge) {
      message = 'En escritorio: usa el icono de instalar en la barra de direcciones o el menu del navegador.';
    }
    window.alert(message);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identification, password }),
      });

      const data: LoginResponse = await res.json();

      if (!res.ok || data.error) {
        setError(data.error ?? 'Error al iniciar sesión');
        return;
      }

      if (data.user) {
        if (Array.isArray(data.allowedMenus)) {
          try {
            sessionStorage.setItem('sigocc_allowedMenus', JSON.stringify(data.allowedMenus));
          } catch {
            // ignorar si no hay sessionStorage
          }
        }
        /* replace: evita que «Atrás» en Android vuelva al login con sesión aún válida */
        router.replace('/dashboard');
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!identification) {
      setError('Ingresa tu número de identificación para restablecer la contraseña.');
      return;
    }
    setRecovering(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identification }),
      });

      const data = (await res.json()) as { message?: string; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? 'No se pudo restablecer la contraseña.');
        return;
      }

      setMessage(
        data.message ??
          'Si el usuario existe, se ha restablecido la contraseña. Usa tu identificación como nueva contraseña.',
      );
    } catch (err) {
      console.error(err);
      setError('Error de conexión con el servidor.');
    } finally {
      setRecovering(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-hero">
        <div className="auth-hero-overlay" />
        <div className="auth-hero-content">
          <h1 className="auth-title">SIGOCC Camacon</h1>
          <p className="auth-subtitle">
            Control diario de obra, equipos y personal, optimizado para campo.
          </p>
        </div>
      </div>

      <section className="auth-card" aria-label="Inicio de sesión">
        <div className="auth-login-logo-wrap">
          <img
            src="/images/logo_login.png"
            alt="Camacon App"
            className="auth-login-logo"
          />
        </div>
        <h2 className="auth-card-title">Ingresar al sistema</h2>
        <p className="auth-card-description">
          Accede con tu número de identificación y contraseña asignada.
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-field">
            <label className="form-label" htmlFor="identification">
              Número de identificación
            </label>
            <input
              id="identification"
              type="text"
              className="form-input"
              inputMode="numeric"
              autoComplete="username"
              value={identification}
              onChange={(e) => setIdentification(e.target.value)}
              placeholder="Ej: 123456789"
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              className="form-input"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Ingresa tu contraseña"
              required
            />
          </div>

          <button type="submit" disabled={loading || recovering} className="btn-primary">
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        <form onSubmit={handleForgotPassword} className="auth-form forgot-form">
          <button
            type="submit"
            disabled={recovering || loading}
            className="btn-secondary"
          >
            {recovering ? 'Restableciendo...' : 'Olvidé mi contraseña'}
          </button>
        </form>

        {message && <p className="feedback feedback-success">{message}</p>}
        {error && <p className="feedback feedback-error">{error}</p>}

        {installAvailable ? (
          <button type="button" className="btn-secondary" onClick={handleInstallClick}>
            Instalar aplicación en este dispositivo
          </button>
        ) : (
          <button type="button" className="btn-secondary" onClick={handleInstallHelpClick}>
            Cómo instalar aplicación
          </button>
        )}
      </section>
    </main>
  );
}

