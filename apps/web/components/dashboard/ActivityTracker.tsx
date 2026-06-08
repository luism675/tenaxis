"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteBrowserCookie } from "@/lib/api/browser-client";
import { authClient } from "@/lib/api/auth-client";
import { monitoringClient } from "@/lib/api/monitoreo-client";

const INACTIVITY_THRESHOLD = 5 * 60 * 1000;
const AUTO_LOGOUT_TIME = 10 * 60 * 1000;
const HEARTBEAT_INTERVAL = 60 * 1000;
const SESSION_VALIDATION_INTERVAL = 60 * 1000;
const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "pointerdown",
  "pointermove",
  "keydown",
  "click",
  "scroll",
  "wheel",
  "touchstart",
  "touchmove",
  "input",
  "focusin",
  "dragstart",
] as const;

function isUnauthorizedError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  return (
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("sesión inválida") ||
    message.includes("sesion invalida") ||
    message.includes("revocada")
  );
}

export function ActivityTracker() {
  const pathname = usePathname();
  const router = useRouter();
  // Inicializar en 0 para evitar llamada impura en renderizado
  const lastActivityRef = useRef<number>(0);
  const isClosingSessionRef = useRef(false);
  const heartbeatInFlightRef = useRef(false);
  const sessionValidationInFlightRef = useRef(false);

  const sendEvent = useCallback(
    async (tipo: string, descripcion?: string) => {
      try {
        await monitoringClient.trackEvent({
          tipo,
          descripcion,
          ruta: pathname,
        });
      } catch (_e) {
        // Fallo silencioso
      }
    },
    [pathname],
  );

  const sendHeartbeat = useCallback(async (inactiveMinutes: number = 0) => {
    if (heartbeatInFlightRef.current) return;
    heartbeatInFlightRef.current = true;

    try {
      await monitoringClient.sendHeartbeat(inactiveMinutes);
    } catch (_e) {
      // Ignorar
    } finally {
      heartbeatInFlightRef.current = false;
    }
  }, []);

  const closeLocalSession = useCallback(
    (title: string, description: string) => {
      if (isClosingSessionRef.current) return;
      isClosingSessionRef.current = true;

      deleteBrowserCookie("access_token");
      deleteBrowserCookie("x-enterprise-id");
      deleteBrowserCookie("x-test-role");
      deleteBrowserCookie("sesion_id");

      toast.error(title, {
        description,
        duration: 10000,
      });

      router.push("/iniciar-sesion");
    },
    [router],
  );

  const handleLogout = useCallback(async () => {
    await sendEvent(
      "SESSION_TIMEOUT",
      "Cierre de sesión automático por 10 minutos de inactividad",
    );

    try {
      await authClient.logout();
    } catch (_error) {
      // Ignorar errores de logout remoto y limpiar sesion local igual.
    }

    closeLocalSession(
      "Sesión Expirada",
      "Se ha cerrado tu sesión automáticamente tras 10 minutos de inactividad por seguridad.",
    );
  }, [sendEvent, closeLocalSession]);

  const validateCurrentSession = useCallback(async () => {
    if (isClosingSessionRef.current || sessionValidationInFlightRef.current) {
      return;
    }

    if (
      typeof document !== "undefined" &&
      document.visibilityState === "hidden"
    ) {
      return;
    }

    sessionValidationInFlightRef.current = true;

    try {
      await authClient.getProfile({ skip401Redirect: true });
    } catch (error) {
      if (!isUnauthorizedError(error)) return;

      closeLocalSession(
        "Sesión Cerrada",
        "Tu sesión fue cerrada por seguridad. Volvé a iniciar sesión para continuar.",
      );
    } finally {
      sessionValidationInFlightRef.current = false;
    }
  }, [closeLocalSession]);

  useEffect(() => {
    // Establecer actividad inicial en el montaje
    lastActivityRef.current = Date.now();

    // No trackear en la página de login
    if (pathname === "/iniciar-sesion") return;

    // Registrar cambio de página
    sendEvent("PAGE_VIEW", `Usuario entró a ${pathname}`);
    validateCurrentSession();

    const isWhatsappRoute = pathname?.startsWith("/dashboard/whatsapp");

    // 1. Rastrear cambios de foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendEvent("FOCO_PERDIDO", "El usuario cambió de pestaña o minimizó");
      } else {
        updateActivity();
        validateCurrentSession();
        sendEvent("FOCO_RECUPERADO", "El usuario regresó a la pestaña");
      }
    };

    // 2. Rastrear actividad real
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Especial para iframes (WhatsApp)
    const handleBlur = () => {
      // Si el usuario hace clic en un iframe, el window pierde el foco
      // pero el activeElement será el iframe.
      setTimeout(() => {
        if (document.activeElement instanceof HTMLIFrameElement) {
          updateActivity();
        }
      }, 100);
    };

    // 3. Intervalo de Heartbeat e Inactividad
    const heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const timeSinceLastActivity = now - lastActivityRef.current;

      // Si estamos en WhatsApp y el iframe tiene el foco, actualizamos actividad
      if (
        isWhatsappRoute &&
        document.activeElement instanceof HTMLIFrameElement
      ) {
        updateActivity();
        sendHeartbeat(0);
        return;
      }

      if (timeSinceLastActivity >= INACTIVITY_THRESHOLD) {
        sendHeartbeat(1);
        if (timeSinceLastActivity < INACTIVITY_THRESHOLD + HEARTBEAT_INTERVAL) {
          sendEvent(
            "INACTIVIDAD_INICIO",
            "El usuario entró en estado de inactividad",
          );
        }
      } else {
        sendHeartbeat(0);
      }
    }, HEARTBEAT_INTERVAL);

    const sessionValidationTimer = setInterval(() => {
      validateCurrentSession();
    }, SESSION_VALIDATION_INTERVAL);

    // 4. Intervalo de Cierre de Sesión (Chequeo más frecuente)
    const logoutCheckTimer = setInterval(() => {
      const now = Date.now();

      // Si estamos en WhatsApp y el iframe tiene el foco, no cerramos sesión
      if (
        isWhatsappRoute &&
        document.activeElement instanceof HTMLIFrameElement
      ) {
        updateActivity();
        return;
      }

      if (now - lastActivityRef.current >= AUTO_LOGOUT_TIME) {
        handleLogout();
      }
    }, 30 * 1000);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    ACTIVITY_EVENTS.forEach((eventName) => {
      document.addEventListener(eventName, updateActivity, {
        capture: true,
        passive: true,
      });
    });
    window.addEventListener("focus", updateActivity);
    window.addEventListener("blur", handleBlur);

    return () => {
      clearInterval(heartbeatTimer);
      clearInterval(sessionValidationTimer);
      clearInterval(logoutCheckTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      ACTIVITY_EVENTS.forEach((eventName) => {
        document.removeEventListener(eventName, updateActivity, true);
      });
      window.removeEventListener("focus", updateActivity);
      window.removeEventListener("blur", handleBlur);
    };
  }, [
    pathname,
    sendEvent,
    sendHeartbeat,
    handleLogout,
    validateCurrentSession,
  ]);

  return null;
}
