/**
 * Prueba SMTP (Gmail) con las variables del .env del proyecto.
 *
 * Uso:
 *   node scripts/test-smtp.mjs
 *   node scripts/test-smtp.mjs --send-to=correo@ejemplo.com
 */
import nodemailer from 'nodemailer';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnvFile() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = val;
  }
}

function clean(v) {
  return String(v ?? '').trim();
}

function normalizePass(pass) {
  return pass.replace(/\s+/g, '');
}

function extractEmail(raw) {
  const t = clean(raw);
  const m = t.match(/<([^>]+)>/);
  if (m) return m[1].trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return t.toLowerCase();
  return null;
}

loadEnvFile();

const host = clean(process.env.SMTP_HOST);
const user = clean(process.env.SMTP_USER).toLowerCase();
const rawPass = clean(process.env.SMTP_PASS);
const pass = normalizePass(rawPass);
const port = Number(clean(process.env.SMTP_PORT) || '587');
const fromRaw = clean(process.env.MAIL_FROM) || user;
const fromEmail = extractEmail(fromRaw) ?? user;
const fromHeader = fromRaw.includes('<') ? fromRaw : `"SIGOCC Camacon" <${fromEmail}>`;

console.log('--- Diagnóstico SMTP ---');
console.log('Host:', host || '(vacío)');
console.log('Puerto:', port);
console.log('Usuario:', user || '(vacío)');
console.log('Longitud contraseña (sin espacios):', pass.length);
console.log('Contraseña tenía espacios en .env:', rawPass.includes(' ') ? 'sí' : 'no');
console.log('MAIL_FROM:', fromHeader);
if (fromEmail && fromEmail !== user) {
  console.warn('AVISO: MAIL_FROM y SMTP_USER no coinciden.');
}
if (!host || !user || !pass) {
  console.error('\nFaltan variables SMTP en .env');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  requireTLS: port === 587,
  auth: { user, pass },
});

console.log('\nVerificando conexión con Gmail...');
try {
  await transporter.verify();
  console.log('OK: autenticación SMTP correcta.');
} catch (e) {
  console.error('FALLO verify():', e?.message || e);
  console.error('\nRevise: contraseña de aplicación (16 caracteres), 2FA activa, SMTP_USER = correo completo.');
  process.exit(1);
}

const sendArg = process.argv.find((a) => a.startsWith('--send-to='));
const sendTo = sendArg ? sendArg.slice('--send-to='.length).trim() : '';
if (sendTo) {
  console.log(`\nEnviando correo de prueba a ${sendTo}...`);
  await transporter.sendMail({
    from: fromHeader,
    to: sendTo,
    subject: 'SIGOCC Camacon - Prueba SMTP',
    text: 'Correo de prueba. Si lo recibe, el SMTP está bien configurado.',
  });
  console.log('OK: correo enviado.');
}
