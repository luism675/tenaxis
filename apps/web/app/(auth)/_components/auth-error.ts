const AUTH_ERROR_PATTERNS: Array<{ test: RegExp; message: string }> = [
  {
    test: /network|failed to fetch|load failed|fetch failed/i,
    message:
      "No pudimos conectar con Tenaxis. Verifica tu conexión e inténtalo de nuevo.",
  },
  {
    test: /timeout|timed out|abort/i,
    message: "La solicitud tardó demasiado. Intenta nuevamente en unos segundos.",
  },
  {
    test: /401|unauthorized|credenciales|invalid credentials|incorrect/i,
    message:
      "Tus credenciales no son válidas. Revisa tu correo y contraseña.",
  },
  {
    test: /403|forbidden|permission/i,
    message: "Tu cuenta no tiene permisos para continuar con esta acción.",
  },
  {
    test: /404|not found/i,
    message:
      "No encontramos la información solicitada. Revisa el enlace e inténtalo otra vez.",
  },
  {
    test: /409|already exists|ya existe/i,
    message:
      "Ya existe una cuenta con esos datos. Intenta iniciar sesión o usa otro correo.",
  },
  {
    test: /429|too many requests|rate limit/i,
    message:
      "Has hecho demasiados intentos. Espera un momento antes de volver a probar.",
  },
  {
    test: /500|internal server error|unexpected/i,
    message:
      "Tuvimos un problema interno. Nuestro equipo ya debería estar viéndolo.",
  },
  {
    test: /password.*match|coinciden/i,
    message: "Las contraseñas no coinciden. Revísalas y vuelve a intentarlo.",
  },
  {
    test: /password.*6|at least 6|mínimo/i,
    message: "La contraseña debe tener al menos 6 caracteres.",
  },
  {
    test: /invalid.*email|correo/i,
    message: "Ingresa un correo válido para continuar.",
  },
  {
    test: /expired|session/i,
    message: "Tu sesión o enlace expiró. Solicita uno nuevo para continuar.",
  },
];

export function getAuthErrorMessage(
  error: unknown,
  fallback = "Ocurrió un error inesperado. Intenta nuevamente.",
) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.trim();

  if (!normalized) {
    return fallback;
  }

  const matched = AUTH_ERROR_PATTERNS.find(({ test }) => test.test(normalized));
  return matched?.message ?? normalized;
}
