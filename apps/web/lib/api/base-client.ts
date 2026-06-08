import { buildApiUrl } from "@/lib/api/url";

const DEFAULT_API_TIMEOUT_MS = 30_000;
const shouldLogApiClient = process.env.NODE_ENV !== "production";

type ApiFetchOptions = RequestInit & {
  includeEnterpriseId?: boolean;
  skip401Redirect?: boolean;
  timeoutMs?: number;
};

export async function getAuthHeaders(
  isFormData = false,
  options: { includeEnterpriseId?: boolean } = {},
) {
  let token: string | undefined;
  let enterpriseId: string | undefined;
  let testRole: string | undefined;

  // Detectar si estamos en el servidor o en el cliente
  if (typeof window === "undefined") {
    // Servidor: Usamos cookies() de next/headers
    try {
      const { cookies } = await import("next/headers");
      const cookieStore = await cookies();
      token = cookieStore.get("access_token")?.value;
      enterpriseId = cookieStore.get("x-enterprise-id")?.value;
      testRole = cookieStore.get("x-test-role")?.value;
    } catch (e) {
      console.warn("[API Client] Error accessing cookies on server:", e);
    }
  } else {
    // Cliente: Usamos document.cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(";").shift();
      return undefined;
    };
    token = getCookie("access_token");
    enterpriseId = getCookie("x-enterprise-id");
    testRole = getCookie("x-test-role");
  }

  const { includeEnterpriseId = true } = options;
  const headers: Record<string, string> = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (includeEnterpriseId && enterpriseId) {
    headers["x-enterprise-id"] = enterpriseId;
  }

  if (testRole) {
    headers["x-test-role"] = testRole;
  }

  return headers;
}

export async function apiFetch<T>(
  endpoint: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    includeEnterpriseId,
    skip401Redirect,
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    signal,
    ...fetchOptions
  } = options;
  const isFormData = fetchOptions.body instanceof FormData;
  const headers = {
    ...(await getAuthHeaders(isFormData, { includeEnterpriseId })),
    ...(fetchOptions.headers as Record<string, string>),
  };

  const url = buildApiUrl(endpoint);
  if (shouldLogApiClient) {
    console.log(`[API Client] Fetching: ${fetchOptions.method || "GET"} ${url}`);
  }

  const controller = new AbortController();
  let didTimeout = false;
  const timeoutId =
    timeoutMs > 0
      ? setTimeout(() => {
          didTimeout = true;
          controller.abort();
        }, timeoutMs)
      : null;

  const abortFromCaller = () => controller.abort();
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortFromCaller, { once: true });
    }
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      cache: "no-store",
      headers,
      signal: controller.signal,
    });

    if (shouldLogApiClient) {
      console.log(`[API Client] Response: ${response.status} ${url}`);
    }

    const contentType = response.headers.get("content-type");
    let result: unknown;
    
    if (contentType && contentType.includes("application/json")) {
      result = await response.json();
    } else {
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${text || response.statusText}`);
      }
      result = text;
    }

    if (!response.ok) {
      console.error(`[API Client] Error response:`, result);
      
      // Manejar token expirado (401)
      if (
        response.status === 401 &&
        typeof window !== "undefined" &&
        !skip401Redirect
      ) {
        console.warn("[API Client] Session expired (401). Redirecting to login...");
        
        // Limpiar cookies en el cliente
        document.cookie = "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";
        document.cookie = "x-enterprise-id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";
        document.cookie = "x-test-role=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";
        document.cookie = "sesion_id=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax";
        
        // Evitar bucles de redirección si ya estamos en la página de login
        if (!window.location.pathname.includes('/iniciar-sesion')) {
          window.location.href = '/iniciar-sesion?expired=true';
        }

        throw new Error("Tu sesión expiró. Volvé a iniciar sesión.");
      }

      throw new Error((result as { message?: string })?.message || `API Error: ${response.status}`);
    }

    const isPaginated = 
      result && 
      typeof result === "object" && 
      "data" in (result as object) && 
      "meta" in (result as object);

    if (isPaginated) {
      return result as T;
    }

    return ((result as { data?: T } | null)?.data || result) as T;
  } catch (error) {
    if (didTimeout) {
      throw new Error("La solicitud tardó demasiado. Intentá nuevamente.");
    }

    const normalizedError = {
      name:
        error && typeof error === "object" && "name" in error
          ? String((error as { name?: unknown }).name ?? "Error")
          : error instanceof Error
            ? error.name
            : "Error",
      message: error instanceof Error ? error.message : String(error),
      cause: error instanceof Error ? (error as { cause?: unknown }).cause : undefined,
      stack: error instanceof Error ? error.stack : undefined,
      raw:
        error instanceof Error
          ? undefined
          : typeof error === "object"
            ? JSON.stringify(error, Object.getOwnPropertyNames(error), 2)
            : String(error),
    };

    console.error(`[API Client] Fetch failed for ${url}: ${normalizedError.message}`, normalizedError);
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    signal?.removeEventListener("abort", abortFromCaller);
  }
}
