/** Lee y normaliza variables SMTP (Gmail / Google Workspace). */

const EMAIL_IN_ANGLE = /<([^>]+)>/;

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromHeader: string;
};

function cleanEnv(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

/** Gmail muestra la contraseña de aplicación con espacios; SMTP exige 16 caracteres sin espacios. */
export function normalizeSmtpAppPassword(pass: string): string {
  return pass.replace(/\s+/g, '');
}

export function extractEmailAddress(raw: string): string | null {
  const t = cleanEnv(raw);
  if (!t) return null;
  const m = t.match(EMAIL_IN_ANGLE);
  if (m?.[1]) return m[1].trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return t.toLowerCase();
  return null;
}

export function buildMailFromHeader(fromRaw: string, fallbackUser: string): string {
  const trimmed = cleanEnv(fromRaw);
  if (trimmed.includes('<')) return trimmed;
  const email = extractEmailAddress(trimmed) ?? fallbackUser;
  if (trimmed && trimmed !== email) {
    return `"${trimmed.replace(/"/g, '')}" <${email}>`;
  }
  return `"SIGOCC Camacon" <${email}>`;
}

export function readSmtpConfig(): SmtpConfig | null {
  const host = cleanEnv(process.env.SMTP_HOST);
  const user = cleanEnv(process.env.SMTP_USER).toLowerCase();
  const pass = normalizeSmtpAppPassword(cleanEnv(process.env.SMTP_PASS));
  const portRaw = cleanEnv(process.env.SMTP_PORT);
  const port = portRaw ? Number(portRaw) : 587;
  const fromRaw = cleanEnv(process.env.MAIL_FROM) || user;

  if (!host || !user || !pass || !Number.isFinite(port)) return null;

  const fromEmail = extractEmailAddress(fromRaw) ?? user;
  const fromHeader = buildMailFromHeader(fromRaw, fromEmail);

  return { host, port, user, pass, fromHeader };
}

export function isSmtpConfigured(): boolean {
  return readSmtpConfig() != null;
}

export type SmtpDiagnostic = {
  configured: boolean;
  host?: string;
  port?: number;
  user?: string;
  fromHeader?: string;
  passLength?: number;
  passHasSpaces?: boolean;
  userMatchesFrom?: boolean;
  issues: string[];
};

/** Diagnóstico sin exponer la contraseña. */
export function diagnoseSmtpEnv(): SmtpDiagnostic {
  const rawPass = cleanEnv(process.env.SMTP_PASS);
  const cfg = readSmtpConfig();
  const issues: string[] = [];

  if (!cfg) {
    if (!cleanEnv(process.env.SMTP_HOST)) issues.push('Falta SMTP_HOST.');
    if (!cleanEnv(process.env.SMTP_USER)) issues.push('Falta SMTP_USER.');
    if (!rawPass) issues.push('Falta SMTP_PASS.');
    return { configured: false, issues };
  }

  const fromEmail = extractEmailAddress(cleanEnv(process.env.MAIL_FROM) || cfg.user);
  const userMatchesFrom = !fromEmail || fromEmail === cfg.user;

  if (rawPass.includes(' ')) {
    issues.push(
      'SMTP_PASS contiene espacios (típico al copiar la contraseña de aplicación de Google). El sistema los quita al enviar; en el .env del servidor puede dejarlos o usar 16 caracteres seguidos.',
    );
  }
  if (cfg.pass.length !== 16 && cfg.host.includes('gmail')) {
    issues.push(
      `Tras quitar espacios, SMTP_PASS tiene ${cfg.pass.length} caracteres; la contraseña de aplicación de Google suele tener 16.`,
    );
  }
  if (!userMatchesFrom) {
    issues.push(
      `MAIL_FROM (${fromEmail}) no coincide con SMTP_USER (${cfg.user}). En Gmail deben ser la misma cuenta.`,
    );
  }
  if (cfg.port !== 587 && cfg.port !== 465) {
    issues.push('SMTP_PORT recomendado para Gmail: 587 (STARTTLS) o 465 (SSL).');
  }

  return {
    configured: true,
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    fromHeader: cfg.fromHeader,
    passLength: cfg.pass.length,
    passHasSpaces: rawPass.includes(' '),
    userMatchesFrom,
    issues,
  };
}
