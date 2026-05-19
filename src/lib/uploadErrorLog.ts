/** Registro estructurado de fallos de subida (servidor). */
export function logUploadFailure(
  tag: string,
  context: Record<string, unknown>,
  error: unknown,
): string {
  const err = error instanceof Error ? error : new Error(String(error));
  const message = err.message?.trim() || 'Error desconocido al subir';

  const payload = {
    tag,
    at: new Date().toISOString(),
    ...context,
    errorName: err.name,
    errorMessage: message,
    stack: err.stack?.split('\n').slice(0, 12) ?? [],
  };

  console.error(`[${tag}]`, message);
  console.error(`[${tag}] detalle:`, JSON.stringify(payload, null, 2));

  return message;
}
