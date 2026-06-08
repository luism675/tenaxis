import { cookies } from "next/headers";
import { getServerApiUrl } from "@/lib/api/url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const normalizeEmpresaId = (empresaId?: string | null) => {
  if (!empresaId || empresaId === "all" || empresaId === "undefined") {
    return undefined;
  }

  return empresaId;
};

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const upstreamHeaders = new Headers();
  upstreamHeaders.set("Authorization", `Bearer ${token}`);
  upstreamHeaders.set("Accept", "text/event-stream");

  const enterpriseId = cookieStore.get("x-enterprise-id")?.value;
  const testRole = cookieStore.get("x-test-role")?.value;

  if (enterpriseId) {
    upstreamHeaders.set("x-enterprise-id", enterpriseId);
  }

  if (testRole) {
    upstreamHeaders.set("x-test-role", testRole);
  }

  const incomingUrl = new URL(request.url);
  const empresaId = normalizeEmpresaId(incomingUrl.searchParams.get("empresaId"));
  const params = new URLSearchParams();

  if (empresaId) {
    params.set("empresaId", empresaId);
  }

  const query = params.toString();
  const upstreamUrl = `${getServerApiUrl()}/ordenes-servicio/follow-ups/notifications-stream${query ? `?${query}` : ""}`;
  const upstreamResponse = await fetch(upstreamUrl, {
    method: "GET",
    headers: upstreamHeaders,
    cache: "no-store",
    signal: request.signal,
  });

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const message = await upstreamResponse.text();
    return new Response(message || "Unable to connect notifications stream", {
      status: upstreamResponse.status,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  return new Response(upstreamResponse.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
