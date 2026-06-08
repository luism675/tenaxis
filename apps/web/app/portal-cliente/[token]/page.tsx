import { notFound } from "next/navigation";
import { CalendarClock, CheckCircle2, Clock3, History, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import { getServerApiUrl } from "@/lib/api/url";
import { cn } from "@/components/ui/utils";
import { DownloadPortalPdfButton } from "./download-portal-pdf-button";
import type { PortalPublicResponse, PortalServicio } from "./types";
import {
  formatPortalDate,
  getClienteEnterprise,
  getClienteDocument,
  getClienteName,
  getSelectedServices,
  getServiceAssignee,
  getServiceCode,
  getServiceDate,
  getServiceLocation,
  getServiceSummary,
  getServiceTitle,
  normalizeStatus,
} from "./format";

type ClientPortalPageProps = {
  params: Promise<{ token: string }>;
};

export const metadata = {
  title: "Portal del cliente | Tenaxis",
  description: "Consulta de visitas e historial de atención.",
};

async function getPortalData(token: string) {
  const response = await fetch(
    `${getServerApiUrl()}/client-portal/public/${encodeURIComponent(token)}`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    },
  );

  if ([400, 403, 404, 410].includes(response.status)) {
    return null;
  }

  if (!response.ok) {
    throw new Error("No se pudo consultar el portal del cliente.");
  }

  const payload = (await response.json()) as PortalPublicResponse | { data?: PortalPublicResponse };
  return "data" in payload && payload.data ? payload.data : (payload as PortalPublicResponse);
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-slate-300 bg-white/70 p-6 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-2 leading-6">{description}</p>
    </div>
  );
}

function ServiceCard({
  title,
  servicio,
  accent = "sky",
}: {
  title: string;
  servicio?: PortalServicio | null;
  accent?: "sky" | "navy";
}) {
  if (!servicio) {
    return (
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <EmptyState
          title="Sin datos para mostrar"
          description="Cuando haya una visita asociada, la vas a ver reflejada en esta sección."
        />
      </div>
    );
  }

  return (
    <article className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.07)]">
      <div
        className={cn(
          "h-1.5",
          accent === "sky" ? "bg-[#01ADFB]" : "bg-[#021359]",
        )}
      />
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{title}</p>
        <div className="mt-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
              {getServiceTitle(servicio)}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{getServiceCode(servicio)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {normalizeStatus(servicio.estado)}
          </span>
        </div>
        <dl className="mt-6 grid gap-4 text-sm text-slate-600">
          <div className="flex gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#01ADFB]" aria-hidden="true" />
            <div>
              <dt className="font-semibold text-slate-900">Fecha</dt>
              <dd>{getServiceDate(servicio)}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#01ADFB]" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="font-semibold text-slate-900">Lugar</dt>
              <dd className="break-words">{getServiceLocation(servicio)}</dd>
            </div>
          </div>
          <div className="flex gap-3">
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[#01ADFB]" aria-hidden="true" />
            <div>
              <dt className="font-semibold text-slate-900">Equipo asignado</dt>
              <dd>{getServiceAssignee(servicio)}</dd>
            </div>
          </div>
        </dl>
        {getSelectedServices(servicio).length > 0 ? (
          <div className="mt-6 rounded-[1rem] bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
              Servicios incluidos
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {getSelectedServices(servicio).join(" · ")}
            </p>
          </div>
        ) : null}
        {servicio.recomendaciones ? (
          <div className="mt-4 rounded-[1rem] border border-[#01ADFB]/20 bg-[#01ADFB]/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#021359]">
              Recomendaciones
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{servicio.recomendaciones}</p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function HistoryItem({ servicio }: { servicio: PortalServicio }) {
  return (
    <li className="rounded-[1.25rem] border border-slate-200 bg-white p-5 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {getServiceCode(servicio)}
          </p>
          <h3 className="mt-2 text-base font-semibold text-slate-950">{getServiceTitle(servicio)}</h3>
          <p className="mt-1 text-sm text-slate-500">{getServiceDate(servicio)}</p>
        </div>
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {normalizeStatus(servicio.estado)}
        </span>
      </div>
      <p className="mt-4 break-words text-sm leading-6 text-slate-600">{getServiceSummary(servicio)}</p>
      {getSelectedServices(servicio).length > 0 ? (
        <p className="mt-2 text-xs font-medium text-slate-500">
          {getSelectedServices(servicio).join(" · ")}
        </p>
      ) : null}
      <p className="mt-3 text-xs font-medium text-slate-500">{getServiceLocation(servicio)}</p>
    </li>
  );
}

function PortalUnavailable() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-5 py-10 text-slate-950">
      <section className="mx-auto flex min-h-[72vh] max-w-2xl items-center justify-center">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#01ADFB]">
            Portal del cliente
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-[#021359]">
            No pudimos mostrar la información ahora
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Intentá nuevamente en unos minutos o contactá a tu asesor para recibir ayuda.
          </p>
        </div>
      </section>
    </main>
  );
}

export default async function ClientPortalPage({ params }: ClientPortalPageProps) {
  const { token } = await params;

  if (!token) {
    notFound();
  }

  let data: PortalPublicResponse | null;
  try {
    data = await getPortalData(token);
  } catch {
    return <PortalUnavailable />;
  }

  if (!data) {
    notFound();
  }

  const clienteName = getClienteName(data.cliente);
  const clienteEnterprise = getClienteEnterprise(data.cliente);

  return (
    <main className="min-h-screen bg-[#f8fafc] text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(1,173,251,0.18),transparent_36%),linear-gradient(135deg,#ffffff_0%,#eef6ff_55%,#f8fafc_100%)] px-5 py-10 sm:py-14">
        <div className="absolute right-[-12rem] top-[-12rem] h-96 w-96 rounded-full border border-[#01ADFB]/20" />
        <div className="relative mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#01ADFB]/25 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[#021359] shadow-sm">
                <ShieldCheck className="h-3.5 w-3.5 text-[#01ADFB]" aria-hidden="true" />
                Portal del cliente
              </div>
              <h1 className="mt-6 text-4xl font-semibold tracking-[-0.06em] text-[#021359] sm:text-6xl">
                {clienteName}
              </h1>
              <div className="mt-5 flex flex-wrap gap-3 text-sm text-slate-600">
                <span className="rounded-full bg-white px-4 py-2 shadow-sm">{getClienteDocument(data.cliente)}</span>
                {clienteEnterprise ? (
                  <span className="rounded-full bg-white px-4 py-2 shadow-sm">{clienteEnterprise}</span>
                ) : null}
                <span className="rounded-full bg-white px-4 py-2 shadow-sm">{data.cliente.correo || "Correo no registrado"}</span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
                  <Phone className="h-3.5 w-3.5 text-[#01ADFB]" aria-hidden="true" />
                  {data.cliente.telefono || "Teléfono no registrado"}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end">
              <DownloadPortalPdfButton data={data} />
              <p className="text-xs text-slate-500">
                Información actualizada: {formatPortalDate(data.generadoAt, true)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-2">
        <ServiceCard title="Próxima visita" servicio={data.proximoServicio} accent="sky" />
        <ServiceCard title="Última atención" servicio={data.ultimoServicio} accent="navy" />
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#01ADFB]">
              <History className="h-4 w-4" aria-hidden="true" />
              Historial
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[#021359]">
              Atenciones registradas
            </h2>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <CheckCircle2 className="h-4 w-4 text-[#01ADFB]" aria-hidden="true" />
            {data.historial.length} {data.historial.length === 1 ? "registro" : "registros"}
          </div>
        </div>

        {data.historial.length === 0 ? (
          <EmptyState
            title="Todavía no hay historial"
            description="Cuando se registren atenciones para este cliente, aparecerán acá."
          />
        ) : (
          <ol className="grid gap-4">
            {data.historial.map((servicio, index) => (
              <HistoryItem key={servicio.id || `${getServiceCode(servicio)}-${index}`} servicio={servicio} />
            ))}
          </ol>
        )}
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <span>Tenaxis · Gestión de servicios</span>
          <span className="inline-flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Consultá con tu asesor si necesitás ajustar una visita.
          </span>
        </div>
      </footer>
    </main>
  );
}
