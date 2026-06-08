"use client";

import { usePathname } from "next/navigation";

type ChatwootPersistentFrameProps = {
  src?: string;
};

const DEFAULT_SRC = "/chatwoot-proxy/app/accounts/1/dashboard";

export function ChatwootPersistentFrame({
  src = DEFAULT_SRC,
}: ChatwootPersistentFrameProps) {
  const pathname = usePathname();
  const isWhatsappRoute = pathname?.startsWith("/dashboard/whatsapp") ?? false;

  return (
    <div
      aria-hidden={!isWhatsappRoute}
      className={
        isWhatsappRoute
          ? "absolute inset-0 z-20 flex bg-background"
          : "pointer-events-none absolute inset-0 -z-10 opacity-0"
      }
    >
      <iframe
        className="h-full w-full border-0"
        src={src}
        title="Chatwoot"
      />
    </div>
  );
}
