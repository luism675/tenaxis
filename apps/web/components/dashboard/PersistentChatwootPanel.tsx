"use client";

import { usePathname } from "next/navigation";
import { RefreshCcw, Users, MessageSquare } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { getBrowserEffectiveScopeAwareUser } from "@/lib/browser-access-scope";

const CHATWOOT_DASHBOARD_PATH = "/chatwoot-proxy/app/accounts/1/dashboard";
const WHATSAPP_ROUTE = "/dashboard/whatsapp";

const chatwootPanelActivationStore = (() => {
  let activatedForUserKey: string | null = null;
  const listeners = new Set<() => void>();

  const emitChange = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      return activatedForUserKey;
    },
    activateFor(userKey: string) {
      if (activatedForUserKey === userKey) {
        return;
      }

      activatedForUserKey = userKey;
      emitChange();
    },
    reset() {
      if (activatedForUserKey === null) {
        return;
      }

      activatedForUserKey = null;
      emitChange();
    },
  };
})();

function getCurrentChatwootUserKey(): string | null {
  const currentUser = getBrowserEffectiveScopeAwareUser();

  if (!currentUser) {
    return null;
  }

  if (currentUser.id) {
    return `${currentUser.tenantId ?? "tenant"}:${currentUser.id}`;
  }

  if (currentUser.email) {
    return `${currentUser.tenantId ?? "tenant"}:${currentUser.email}`;
  }

  return null;
}

export function PersistentChatwootPanel() {
  const pathname = usePathname();
  const [frameKey, setFrameKey] = useState(0);
  const currentUserKey = getCurrentChatwootUserKey();
  const activatedForUserKey = useSyncExternalStore(
    chatwootPanelActivationStore.subscribe,
    chatwootPanelActivationStore.getSnapshot,
    chatwootPanelActivationStore.getSnapshot,
  );

  const isWhatsAppRoute = pathname?.startsWith(WHATSAPP_ROUTE) ?? false;
  const shouldMountPanel =
    isWhatsAppRoute ||
    (!!currentUserKey && activatedForUserKey === currentUserKey);

  useEffect(() => {
    if (!currentUserKey) {
      chatwootPanelActivationStore.reset();
      return;
    }

    if (
      activatedForUserKey !== null &&
      activatedForUserKey !== currentUserKey
    ) {
      chatwootPanelActivationStore.reset();
    }
  }, [activatedForUserKey, currentUserKey]);

  useEffect(() => {
    if (!isWhatsAppRoute || !currentUserKey) {
      return;
    }

    chatwootPanelActivationStore.activateFor(currentUserKey);
  }, [currentUserKey, isWhatsAppRoute]);

  if (!shouldMountPanel) {
    return null;
  }

  return (
    <div
      aria-hidden={!isWhatsAppRoute}
      style={{ left: "var(--dashboard-sidebar-offset, 0px)" }}
      className={[
        "fixed right-0 bottom-0 top-20 z-20 transition-all duration-300 lg:top-24",
        isWhatsAppRoute
          ? "visible opacity-100 pointer-events-auto"
          : "invisible opacity-0 pointer-events-none",
      ].join(" ")}
    >
      <div className="flex h-full w-full flex-col bg-white dark:bg-slate-950">
        <div className="flex h-10 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6 dark:border-white/5 dark:bg-slate-950">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-[#25D366]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-[#021359] dark:text-white">
                WhatsApp Live
              </span>
            </div>

            <div className="hidden items-center gap-2 text-slate-400 md:flex">
              <Users className="h-3.5 w-3.5" />
              <p className="text-[10px] font-medium italic">
                Tip: Si ves el nombre de un companero en el chat, el ya lo esta
                atendiendo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setFrameKey((currentKey) => currentKey + 1)}
              className="group flex items-center gap-2 text-slate-400 transition-colors hover:text-[#01ADFB]"
              title="Refrescar conexión"
              type="button"
            >
              <span className="text-[9px] font-bold uppercase tracking-tight opacity-0 transition-opacity group-hover:opacity-100">
                Refrescar chat
              </span>
              <RefreshCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-slate-50 dark:bg-slate-900">
          <iframe
            key={frameKey}
            src={CHATWOOT_DASHBOARD_PATH}
            className="relative z-10 h-full w-full border-none"
            title="WhatsApp Team"
            allow="camera; microphone; clipboard-read; clipboard-write; geolocation"
          />

          <div className="absolute inset-0 -z-10 flex flex-col items-center justify-center bg-white dark:bg-slate-950">
            <div className="flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-slate-50 dark:bg-white/5">
              <MessageSquare className="h-4 w-4 text-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
