import type { MutableRefObject } from 'react';

/** Subconjunto de la API Web Speech usada aquí (sin depender de lib DOM opcional). */
export type WebSpeechRecognition = {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: Array<Array<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

const VOICE_INSECURE_DEV_ORIGINS = new Set(
  (process.env.NEXT_PUBLIC_VOICE_INSECURE_DEV_ORIGINS ?? '')
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

function isPrivateLanIPv4(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
  const m = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m) {
    const n = Number(m[1]);
    return n >= 16 && n <= 31;
  }
  return false;
}

export function voiceInsecureDevOriginMatch(): boolean {
  if (typeof window === 'undefined') return false;
  const origin = window.location.origin.toLowerCase();
  if (VOICE_INSECURE_DEV_ORIGINS.has(origin)) return true;
  if (process.env.NODE_ENV !== 'development') return false;
  try {
    const u = new URL(window.location.href);
    if (u.protocol !== 'http:') return false;
    return isPrivateLanIPv4(u.hostname);
  } catch {
    return false;
  }
}

type DictadoParams = {
  onTranscript: (text: string) => void;
  onError: (message: string) => void;
  recognitionRef: MutableRefObject<WebSpeechRecognition | null>;
};
/**
 * Dictado por voz (Web Speech API), mismo criterio de https/micrófono que el informe diario.
 */
export async function startSpeechDictado({ onTranscript, onError, recognitionRef }: DictadoParams): Promise<void> {
  const allowInsecureLanVoice = voiceInsecureDevOriginMatch();
  if (typeof window !== 'undefined' && !window.isSecureContext && !allowInsecureLanVoice) {
    onError(
      'El dictado requiere una página segura (https o localhost). En el celular use: npm run dev:https y abra https://SU_IP:3000 (acepte la advertencia del certificado), o un túnel tipo ngrok.',
    );
    return;
  }

  const w = window as unknown as {
    SpeechRecognition?: new () => WebSpeechRecognition;
    webkitSpeechRecognition?: new () => WebSpeechRecognition;
  };  const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!SpeechRecognitionCtor) {
    onError(
      'Dictado no disponible en este navegador. En Android use Chrome actualizado; evite WebView o navegadores sin soporte de reconocimiento de voz.',
    );
    return;
  }

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: unknown) {
      const name = String((err as { name?: string })?.name ?? '');
      const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError';
      const lanHint =
        allowInsecureLanVoice && typeof window !== 'undefined' && !window.isSecureContext
          ? ` En el PC ejecute «npm run dev:https» y en el celular abra https://${window.location.host}/… (aviso del certificado: Avanzado → continuar). Alternativa: chrome://flags → «Insecure origins treated as secure» → ${window.location.origin}.`
          : '';
      onError(
        denied
          ? 'Micrófono bloqueado. En Chrome: candado del sitio → Micrófono → Permitir; en Android también Ajustes → Apps → Chrome → Permisos.' +
              lanHint
          : name === 'SecurityError'
            ? 'El navegador bloqueó el micrófono en http por IP. Use la flag “Insecure origins treated as secure” con esta URL o sirva el sitio con https.' +
                lanHint
            : 'No se pudo usar el micrófono. Cierre otras apps que lo usen (llamadas, grabadora) e intente de nuevo.' + lanHint,
      );
      return;
    }
  }

  try {
    try {
      recognitionRef.current?.abort();
    } catch {
      /* noop */
    }

    const recognition = new SpeechRecognitionCtor();
    recognitionRef.current = recognition;
    recognition.continuous = false;
    recognition.lang = 'es-CO';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event?.results?.[0]?.[0]?.transcript ?? '';      const text = String(transcript).trim();
      if (!text) return;
      onTranscript(text);
    };
    recognition.onerror = (ev) => {      const code = String(ev?.error ?? '');
      if (code === 'aborted') return;
      const perm = 'Permiso de micrófono denegado o bloqueado. Revíselo en ajustes del sitio o del navegador.';
      const net =
        'El dictado en Android usa servicios de Google y requiere internet. Si falla, pruebe otra red o escriba el texto.';
      const msgs: Record<string, string> = {
        'not-allowed': perm,
        'service-not-allowed': perm,
        network: net,
        'no-speech': 'No se detectó voz. Hable después del pitido e intente otra vez.',
        'audio-capture': 'No se pudo usar el micrófono. Compruebe que no esté en uso por otra app.',
      };
      onError(
        msgs[code] ?? 'No se pudo capturar voz. Verifique permisos del micrófono o escriba el texto.',
      );
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
    recognition.start();
  } catch {
    onError('No se pudo iniciar el dictado por voz.');
  }
}
