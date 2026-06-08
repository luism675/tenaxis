"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Input,
  Button,
  Skeleton,
  Label,
  DatePicker,
  Combobox,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";
import {
  Search,
  Filter,
  RotateCcw,
  FileText,
  Plus,
  Download,
  Loader2,
  Calendar,
  Clock,
  User,
  Wallet,
  MoreHorizontal,
  Eye,
  EyeOff,
  Pencil,
  Copy,
  Send,
  CreditCard,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MapPin,
  Upload,
  Receipt,
  Image as ImageIcon,
  ExternalLink,
  Trash2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserX,
  PlayCircle,
  Truck,
  AlertTriangle,
  Zap,
  ArrowDownUp,
  Bookmark,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useUserRole } from "@/hooks/use-user-role";
import { cn, getStorageUrl } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";
import { enterpriseClient, type Enterprise } from "@/lib/api/enterprise-client";
import { exportMultiToExcel } from "@/lib/utils/export-helper";
import {
  completeFollowUp,
  confirmOrdenUpload,
  createSignedDownloadUrl,
  createSignedUploadUrl,
  deleteOrdenServicio,
  exportOrdenesServicio,
  getDepartments,
  getEstadoServicios,
  getMetodosPago,
  getMunicipalities,
  getOperators,
  getOrdenServicio,
  getTenantMemberships,
  getOrdenesServicio,
  getServiciosKpis,
  notifyLiquidationWebhook,
  notifyServiceOperatorWebhook,
  triggerReinforcementsJob,
  type ClienteDTO,
  type ExportOrdenesServicioPayload,
  type GeolocalizacionItem,
  type DepartmentDTO,
  type MunicipalityDTO,
  type OrdenServicioDetail,
  type ServicioExportRow,
  type ServiciosKpis,
  updateOrdenServicio,
  uploadToSupabaseSignedUrl,
  type OrdenServicioRaw,
} from "./api";
import {
  createDashboardPreset,
  deleteDashboardPreset,
  listDashboardPresets,
  PRESET_COLOR_STYLES,
  type DashboardPreset,
  type DashboardPresetColorToken,
  updateDashboardPreset,
} from "../presets-api";
import {
  addDaysToYmd,
  bogotaDateTimeToUtcIso,
  formatBogotaDate,
  formatBogotaDateTime,
  formatBogotaTime,
  startOfBogotaWeekYmd,
  utcIsoToBogotaYmd,
  pickerDateToYmd,
  toBogotaYmd,
  ymdToPickerDate,
} from "@/utils/date-utils";
import { getBrowserScopedEnterpriseId } from "@/lib/browser-access-scope";

// Remove local interface OrdenServicioRaw as it is now imported

interface Servicio {
  id: string;
  cliente: string;
  clienteFull: ClienteDTO;
  servicioEspecifico: string;
  fecha: string;
  hora: string;
  tecnico: string;
  tecnicoId?: string;
  estadoServicio: string;
  urgencia: string;
  empresaId: string;
  raw: OrdenServicioRaw;
  followUps: Servicio[];
  isFollowUp?: boolean;
}

interface FollowUpRow extends Servicio {
  parentId: string;
  parentNumero: string;
  parentCliente: string;
  parentServicio: string;
}

interface ServiciosListCacheEntry {
  data: Servicio[];
  meta: {
    totalCount: number;
    totalPages: number;
  };
}

interface FetchServiciosOptions {
  forceRefresh?: boolean;
}

type ServicioRawClient = OrdenServicioRaw & {
  __detailLoaded?: boolean;
};

type FollowUpRecord = NonNullable<OrdenServicioRaw["seguimientos"]>[number];

function getServicioAddress(raw: OrdenServicioRaw) {
  return {
    direccionTexto: raw.direccionTexto || raw.direccion?.direccion || "",
    barrio: raw.barrio || raw.direccion?.barrio || "",
    municipio: raw.municipio || raw.direccion?.municipio || "",
    departamento: raw.departamento || raw.direccion?.departamento || "",
    bloque: raw.bloque || raw.direccion?.bloque || "",
    piso: raw.piso || raw.direccion?.piso || "",
    unidad: raw.unidad || raw.direccion?.unidad || "",
    tipoUbicacion: raw.tipoUbicacion || raw.direccion?.tipoUbicacion || "",
    linkMaps: raw.linkMaps || raw.direccion?.linkMaps || "",
    zonaNombre: raw.zona?.nombre || "",
  };
}

function joinExportValues(values: Array<string | null | undefined>, separator = " | ") {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join(separator);
}

function buildExportPhonesLabel(row: ServicioExportRow) {
  return joinExportValues([row.telefonoCliente, row.telefono2Cliente]);
}

function buildExportObservationsLabel(row: ServicioExportRow) {
  return joinExportValues(
    [
      row.observacion ? `Observación inicial: ${row.observacion}` : null,
      row.observacionFinal ? `Observación final: ${row.observacionFinal}` : null,
      row.condicionesHigiene ? `Condiciones higiene: ${row.condicionesHigiene}` : null,
      row.condicionesLocal ? `Condiciones local: ${row.condicionesLocal}` : null,
      row.diagnosticoTecnico ? `Diagnóstico técnico: ${row.diagnosticoTecnico}` : null,
      row.hallazgosEstructurales ? `Hallazgos estructurales: ${row.hallazgosEstructurales}` : null,
      row.intervencionRealizada ? `Intervención realizada: ${row.intervencionRealizada}` : null,
      row.recomendacionesObligatorias
        ? `Recomendaciones obligatorias: ${row.recomendacionesObligatorias}`
        : null,
    ],
  );
}

function extractTenaxisDocsPath(value?: string | null) {
  const rawPath = typeof value === "string" ? value.trim() : "";
  if (!rawPath) return "";

  const decodePath = (path: string) => {
    const normalizedPath = path.replace(/^\/+/, "").trim();
    if (!normalizedPath) return "";

    try {
      return decodeURIComponent(normalizedPath);
    } catch {
      return normalizedPath;
    }
  };

  const extractFromStoragePath = (pathname: string) => {
    const cleanPath = pathname.replace(/^\/+/, "");
    const match = cleanPath.match(
      /^storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
    );

    if (!match || match[1] !== "tenaxis-docs") return "";

    return decodePath(match[2]);
  };

  if (/^https?:\/\//i.test(rawPath)) {
    try {
      return extractFromStoragePath(new URL(rawPath).pathname) || rawPath;
    } catch {
      return rawPath;
    }
  }

  const cleanPath = rawPath.split("?")[0].split("#")[0].replace(/^\/+/, "");
  const storagePath = extractFromStoragePath(cleanPath);
  if (storagePath) return storagePath;

  return cleanPath.startsWith("tenaxis-docs/")
    ? decodePath(cleanPath.slice("tenaxis-docs/".length))
    : decodePath(cleanPath);
}

function resolveSoportePagoUrl(bucket: string, path?: unknown) {
  const normalizedPath =
    typeof path === "string"
      ? path
      : typeof path === "object" && path !== null && "path" in path && typeof path.path === "string"
        ? path.path
        : typeof path === "object" && path !== null && "url" in path && typeof path.url === "string"
          ? path.url
          : "";

  if (!normalizedPath) return "";
  if (/^(https?:)?\/\//i.test(normalizedPath)) return normalizedPath;
  return getStorageUrl(bucket, normalizedPath.replace(/^\/+/, ""));
}

function getSoportePagoPath(value?: unknown) {
  if (typeof value === "string") {
    return extractTenaxisDocsPath(value);
  }

  if (typeof value === "object" && value !== null) {
    if ("path" in value && typeof value.path === "string") {
      return extractTenaxisDocsPath(value.path);
    }

    if ("url" in value && typeof value.url === "string") {
      return extractTenaxisDocsPath(value.url);
    }
  }

  return "";
}

function isClientTransferSupport(value?: unknown) {
  const path = getSoportePagoPath(value);
  if (!path) return false;

  if (typeof value !== "object" || value === null) {
    return true;
  }

  if (!("tipo" in value) || typeof value.tipo !== "string") {
    return true;
  }

  const normalizedType = value.tipo.trim().toUpperCase();
  if (!normalizedType) return true;

  return normalizedType.includes("TRANSFERENCIA");
}

const VISITA_EVIDENCE_PUBLIC_BASE_URL =
  "https://supabase.servilutioncrm.cloud/storage/v1/object/public/tenaxis-docs/";

function resolveVisitaEvidenceUrl(path?: string | null) {
  const normalizedPath = typeof path === "string" ? path.trim() : "";

  if (!normalizedPath) return "";
  if (/^(https?:)?\/\//i.test(normalizedPath)) return normalizedPath;

  return `${VISITA_EVIDENCE_PUBLIC_BASE_URL}${normalizedPath.replace(/^\/+/, "")}`;
}

const IMAGE_EVIDENCE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "heic",
  "heif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  "image/apng": "apng",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
};

interface TrabajoEvidenceImageDownload {
  url: string;
  source: string;
  filename: string;
}

function sanitizeDownloadNamePart(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function getEvidencePathname(value: string) {
  try {
    return new URL(value).pathname;
  } catch {
    return value.split("?")[0]?.split("#")[0] || value;
  }
}

function getEvidenceExtension(value: string) {
  const pathname = getEvidencePathname(value);
  const lastSegment = pathname.split("/").pop() || "";
  const extension = lastSegment.includes(".") ? lastSegment.split(".").pop()?.toLowerCase() || "" : "";
  return extension;
}

function shouldAttemptImageEvidenceDownload(value: string) {
  const extension = getEvidenceExtension(value);
  return !extension || IMAGE_EVIDENCE_EXTENSIONS.has(extension);
}

function getBlobImageExtension(blobType: string, fallbackSource: string) {
  return IMAGE_MIME_EXTENSIONS[blobType.toLowerCase()] || getEvidenceExtension(fallbackSource) || "jpg";
}

function resolveTrabajoEvidenceUrl(path?: string | null) {
  const normalizedPath = typeof path === "string" ? path.trim() : "";

  if (!normalizedPath) return "";
  if (/^(https?:)?\/\//i.test(normalizedPath)) return normalizedPath;

  return resolveSoportePagoUrl("tenaxis-docs", normalizedPath);
}

function getTrabajoEvidenceImageDownloads(
  raw: Partial<OrdenServicioRaw> | null | undefined,
  ordenId?: string,
): TrabajoEvidenceImageDownload[] {
  if (!raw) return [];

  const orderPart = sanitizeDownloadNamePart(ordenId || raw.numeroOrden || raw.id || "orden");
  const rawImages: Array<{ source: string; label: string }> = [];

  if (raw.evidenciaPath?.trim()) {
    rawImages.push({ source: raw.evidenciaPath.trim(), label: "principal" });
  }

  raw.evidencias?.forEach((evidencia, idx) => {
    if (evidencia.path?.trim()) {
      rawImages.push({ source: evidencia.path.trim(), label: `trabajo-${idx + 1}` });
    }
  });

  const seen = new Set<string>();

  return rawImages.flatMap((image, idx) => {
    const url = resolveTrabajoEvidenceUrl(image.source);

    if (!url || seen.has(url) || !shouldAttemptImageEvidenceDownload(image.source)) {
      return [];
    }

    seen.add(url);

    const extension = getEvidenceExtension(image.source);
    const filename = `orden-${orderPart}-evidencia-${sanitizeDownloadNamePart(image.label || `${idx + 1}`)}${
      extension ? `.${extension}` : ""
    }`;

    return [{ url, source: image.source, filename }];
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}


interface LiquidarTransferenciaForm {
  id: string;
  monto: string;
  fechaPago: string;
  referenciaPago: string;
  banco: string;
  observacion: string;
  comprobanteFile: File | null;
  existingPath?: string;
  persisted?: boolean;
  persistedMetadataLocked?: boolean;
}

const parseCurrencyInput = (value?: string) =>
  Number.parseFloat((value || "").replace(/\./g, "")) || 0;

const formatCurrencyInput = (value?: number | string | null) => {
  const normalized =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value ?? "").replace(/[^\d.-]/g, ""));

  if (!Number.isFinite(normalized) || normalized <= 0) {
    return "";
  }

  return normalized.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const toPaymentInputDate = (value?: string | null) => {
  if (!value) return toBogotaYmd();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  try {
    return utcIsoToBogotaYmd(value);
  } catch {
    return value.slice(0, 10);
  }
};

const toStoredPaymentInputDate = (value?: string | null) =>
  value ? toPaymentInputDate(value) : "";

const normalizeBankSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const COLOMBIAN_BANKS = [
  { name: "Bancolombia", aliases: "banco colombia" },
  { name: "Davivienda", aliases: "" },
  { name: "Banco de Bogotá", aliases: "banco de bogota" },
  { name: "BBVA", aliases: "banco bilbao vizcaya argentaria" },
  { name: "Banco de Occidente", aliases: "" },
  { name: "Banco Popular", aliases: "" },
  { name: "Banco AV Villas", aliases: "av villas" },
  { name: "Banco Caja Social", aliases: "" },
  { name: "Scotiabank Colpatria", aliases: "colpatria" },
  { name: "Itaú", aliases: "itau" },
  { name: "Banco Agrario", aliases: "" },
  { name: "Banco Falabella", aliases: "" },
  { name: "Banco Pichincha", aliases: "" },
  { name: "Banco W", aliases: "" },
  { name: "Bancoomeva", aliases: "" },
  { name: "Banco Finandina", aliases: "" },
  { name: "Nequi", aliases: "" },
  { name: "Daviplata", aliases: "davi plata" },
  { name: "Lulo Bank", aliases: "lulo" },
  { name: "Nu", aliases: "nubank" },
  { name: "RappiPay", aliases: "rappi pay" },
  { name: "Movii", aliases: "" },
  { name: "Powwi", aliases: "" },
  { name: "Ualá", aliases: "uala" },
  { name: "Dale", aliases: "" },
] as const;

const COLOMBIAN_BANK_OPTIONS = COLOMBIAN_BANKS.map(({ name, aliases }) => ({
  value: name,
  label: name,
  searchText: `${normalizeBankSearchText(name)} ${aliases}`.trim(),
}));

const getBankComboboxOptions = (currentValue?: string) => {
  const normalizedCurrentValue = currentValue?.trim();

  if (!normalizedCurrentValue) return COLOMBIAN_BANK_OPTIONS;

  const clearBankOption = {
    value: "",
    label: "Sin banco definido",
    searchText: "sin banco definido limpiar pendiente",
  };

  const currentValueExists = COLOMBIAN_BANK_OPTIONS.some(
    (option) => option.value === normalizedCurrentValue,
  );

  if (currentValueExists) return [clearBankOption, ...COLOMBIAN_BANK_OPTIONS];

  return [
    clearBankOption,
    {
      value: normalizedCurrentValue,
      label: normalizedCurrentValue,
      searchText: normalizeBankSearchText(normalizedCurrentValue),
    },
    ...COLOMBIAN_BANK_OPTIONS,
  ];
};

const toOptionalString = (value?: string | null) => value ?? undefined;

const formatGeoCoordinate = (value?: number | string | null) => {
  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue.toFixed(6) : "N/A";
};

const getGeoOperatorName = (geo: GeolocalizacionItem) => {
  const fullName = [geo.membership?.user?.nombre, geo.membership?.user?.apellido]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");

  return fullName || "SIN OPERADOR";
};

const getPersonFullName = (
  person?: { user?: { nombre?: string | null; apellido?: string | null } } | null,
  fallback = "SIN REGISTRO",
) => {
  const fullName = [person?.user?.nombre, person?.user?.apellido]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ");

  return fullName || fallback;
};

const getGeoDurationLabel = (geo: GeolocalizacionItem) => {
  if (!geo.llegada) {
    return "Pendiente";
  }

  if (!geo.salida) {
    return "En curso";
  }

  const start = new Date(geo.llegada);
  const end = new Date(geo.salida);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Duración no disponible";
  }

  return `${Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60)))} minutos`;
};

type DateSortOrder = "asc" | "desc";

const isServicioScheduledInFuture = (orden?: Partial<OrdenServicioRaw> | null) => {
  if (!orden?.fechaVisita) return false;

  const visitDate = new Date(orden.fechaVisita);
  if (Number.isNaN(visitDate.getTime())) return false;

  const scheduledDateTime = new Date(visitDate);

  if (orden.horaInicio) {
    const visitTime = new Date(orden.horaInicio);
    if (!Number.isNaN(visitTime.getTime())) {
      scheduledDateTime.setHours(visitTime.getHours(), visitTime.getMinutes(), 0, 0);
    }
  }

  return scheduledDateTime > new Date();
};

type ReinforcementsJobResponse = Awaited<ReturnType<typeof triggerReinforcementsJob>>;

const reinforcementCountFormatter = new Intl.NumberFormat("es-CO");

const formatReinforcementMetric = (
  value: number,
  singular: string,
  plural = `${singular}s`,
) => `${reinforcementCountFormatter.format(value)} ${value === 1 ? singular : plural}`;

type ReinforcementsToastTone = "success" | "warning" | "neutral";

interface ReinforcementsDiagnosticReason {
  count: number;
  label: string;
}

interface ReinforcementsToastMetric {
  label: string;
  value: string;
}

interface ReinforcementsToastViewModel {
  tone: ReinforcementsToastTone;
  title: string;
  summary: string;
  metrics: ReinforcementsToastMetric[];
  topReasons: ReinforcementsDiagnosticReason[];
  remainingReasonsCount: number;
}

const getReinforcementsDiagnosticReasons = (
  result: ReinforcementsJobResponse,
): ReinforcementsDiagnosticReason[] => {
  return [
    { count: result.omitidasPorFechaCorte, label: "Fuera de fecha de corte" },
    { count: result.omitidasConRefuerzosActivos, label: "Ya tenían refuerzos activos" },
    { count: result.omitidasSinSeguimientoConfigurado, label: "Sin seguimiento configurado" },
    { count: result.omitidasPorSerRefuerzo, label: "Ya eran refuerzos" },
    { count: result.omitidasSinReglasProgramacion, label: "Sin reglas de programación" },
    { count: result.omitidasSinFechaServicio, label: "Sin fecha de servicio" },
  ]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
};

const buildReinforcementsToastViewModel = (
  result: ReinforcementsJobResponse,
): ReinforcementsToastViewModel => {
  const diagnosticReasons = getReinforcementsDiagnosticReasons(result);
  const tone: ReinforcementsToastTone =
    result.procesadas > 0 ? "success" : result.elegibles > 0 ? "warning" : "neutral";

  const title =
    tone === "success"
      ? "Refuerzos procesados"
      : tone === "warning"
        ? "Sin refuerzos creados"
        : "Sin casos elegibles";

  const summary =
    tone === "success"
      ? `Se crearon ${formatReinforcementMetric(result.procesadas, "refuerzo")} de ${formatReinforcementMetric(result.elegibles, "caso", "casos")} elegibles.`
      : tone === "warning"
        ? `Se detectaron ${formatReinforcementMetric(result.elegibles, "caso", "casos")} elegibles, pero ninguno cumplió las condiciones finales para crear refuerzos.`
        : "No se encontraron órdenes elegibles para crear refuerzos en esta ejecución.";

  return {
    tone,
    title,
    summary,
    metrics: [
      { label: "Creados", value: reinforcementCountFormatter.format(result.procesadas) },
      { label: "Elegibles", value: reinforcementCountFormatter.format(result.elegibles) },
      { label: "Evaluadas", value: reinforcementCountFormatter.format(result.evaluadas) },
    ],
    topReasons: diagnosticReasons.slice(0, 3),
    remainingReasonsCount: Math.max(0, diagnosticReasons.length - 3),
  };
};

const renderReinforcementsToastContent = (result: ReinforcementsJobResponse) => {
  const viewModel = buildReinforcementsToastViewModel(result);
  const toneStyles = {
    success: {
      icon: CheckCircle2,
      iconWrapper: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
      metricCard: "border-emerald-500/15 bg-emerald-500/[0.06]",
    },
    warning: {
      icon: AlertTriangle,
      iconWrapper: "border-amber-500/20 bg-amber-500/10 text-amber-600",
      metricCard: "border-amber-500/15 bg-amber-500/[0.06]",
    },
    neutral: {
      icon: Activity,
      iconWrapper: "border-sky-500/20 bg-sky-500/10 text-sky-600",
      metricCard: "border-sky-500/15 bg-sky-500/[0.06]",
    },
  } as const;

  const toneConfig = toneStyles[viewModel.tone];
  const ToneIcon = toneConfig.icon;

  return (
    <div className="w-full max-w-[360px] space-y-3">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border",
            toneConfig.iconWrapper,
          )}
        >
          <ToneIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-none text-foreground">
            {viewModel.title}
          </p>
          <p className="text-[13px] leading-5 text-muted-foreground">
            {viewModel.summary}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {viewModel.metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn("rounded-[5px] border px-3 py-2", toneConfig.metricCard)}
          >
            <p className="text-base font-semibold leading-none text-foreground">
              {metric.value}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {metric.label}
            </p>
          </div>
        ))}
      </div>

      {viewModel.topReasons.length > 0 ? (
        <div className="rounded-[5px] border border-border/60 bg-background/80 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Descartes relevantes
            </p>
            {viewModel.remainingReasonsCount > 0 ? (
              <span className="text-[10px] font-medium text-muted-foreground">
                +{viewModel.remainingReasonsCount} más
              </span>
            ) : null}
          </div>

          <div className="space-y-1.5">
            {viewModel.topReasons.map((reason) => (
              <div
                key={reason.label}
                className="flex items-center justify-between gap-3 rounded-[5px] bg-muted/40 px-2.5 py-2"
              >
                <span className="text-[13px] leading-4 text-foreground">
                  {reason.label}
                </span>
                <span className="rounded-[4px] border border-border/60 bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {reinforcementCountFormatter.format(reason.count)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const renderReinforcementsLoadingToast = () => (
  <div className="space-y-1">
    <p className="text-sm font-semibold text-foreground">Procesando refuerzos...</p>
    <p className="text-[13px] leading-5 text-muted-foreground">
      Estamos evaluando órdenes elegibles y validando los descartes operativos.
    </p>
  </div>
);

const SERVICIOS_UI_CACHE_BASE_KEY = "tenaxis:dashboard:servicios:ui-state:v2";
const SERVICIOS_LIST_CACHE_MAX_ENTRIES = 8;

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SERVICIOS_FILTER_DEFAULTS = {
  estado: "all",
  estadoPago: "all",
  metodoPago: "all",
  tecnico: "all",
  urgencia: "all",
  creador: "all",
  departamento: "all",
  municipio: "all",
  empresa: "all",
  tipo: "all",
  fechaInicio: "",
  fechaFin: "",
};

const buildServiciosUiCacheKey = (
  tenantId?: string | null,
  empresaId?: string | null,
) =>
  `${SERVICIOS_UI_CACHE_BASE_KEY}:tenant:${tenantId || "sin-conglomerado"}:empresa:${
    empresaId || "sin-empresa"
  }`;

const SIN_TECNICO_FILTER_VALUE = "SIN_TECNICO";

const isSinTecnicoFilter = (value: string) => value === SIN_TECNICO_FILTER_VALUE;

type ServiciosFiltersState = typeof SERVICIOS_FILTER_DEFAULTS;

const SERVICIOS_STATE_QUERY_PARAMS = new Set([
  "search",
  "preset",
  "estado",
  "estadoPago",
  "metodoPago",
  "tecnico",
  "urgencia",
  "creador",
  "departamento",
  "municipio",
  "empresa",
  "tipo",
  "fechaInicio",
  "fechaFin",
]);

const hasServiciosStateQueryParams = (search: string) => {
  const params = new URLSearchParams(search);
  return Array.from(params.keys()).some((key) =>
    SERVICIOS_STATE_QUERY_PARAMS.has(key),
  );
};

const normalizeServiciosFiltersState = (
  value?: Partial<ServiciosFiltersState> | null,
): ServiciosFiltersState => ({
  ...SERVICIOS_FILTER_DEFAULTS,
  ...(value && typeof value === "object" ? value : {}),
  empresa: SERVICIOS_FILTER_DEFAULTS.empresa,
});

const normalizeMetodoPagoBase = (value?: string) => {
  if (!value) return undefined;

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  if (PAYMENT_METHOD_OPTIONS.some((option) => option.id === normalized)) {
    return normalized;
  }

  if (normalized.includes("EFECT")) return "EFECTIVO";
  if (normalized.includes("TRANSFER")) return "TRANSFERENCIA";
  if (normalized.includes("CREDI") || normalized.includes("TARJETA")) return "CREDITO";
  if (normalized.includes("BONO")) return "BONO";
  if (normalized.includes("CORT")) return "CORTESIA";
  if (normalized.includes("PEND")) return "PENDIENTE";
  if (normalized.includes("QR")) return "TRANSFERENCIA";

  return undefined;
};

const resolveMetodoPagoFilterQuery = (
  metodoPago: string,
  metodosPagoOptions: Array<{ id: string; nombre: string }>,
) => {
  if (!metodoPago || metodoPago === "all") return {};

  const selectedValues = metodoPago
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const normalizedBases = Array.from(
    new Set(
      selectedValues
        .map((selectedValue) => {
          if (!UUID_V4_REGEX.test(selectedValue)) {
            return normalizeMetodoPagoBase(selectedValue) ?? selectedValue;
          }

          const matchedOption = metodosPagoOptions.find(
            (option) => option.id === selectedValue,
          );

          return normalizeMetodoPagoBase(matchedOption?.nombre);
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (selectedValues.length > 1) {
    return normalizedBases.length > 0
      ? { metodosPagoBase: normalizedBases.join(",") }
      : {};
  }

  const selectedValue = selectedValues[0];
  if (!selectedValue) return {};

  if (!UUID_V4_REGEX.test(selectedValue)) {
    const normalizedBase = normalizeMetodoPagoBase(selectedValue);
    return normalizedBase ? { metodoPagoBase: normalizedBase } : {};
  }

  const matchedOption = metodosPagoOptions.find((option) => option.id === selectedValue);
  const normalizedBase = normalizeMetodoPagoBase(matchedOption?.nombre);

  return normalizedBase
    ? { metodoPagoBase: normalizedBase }
    : { metodoPagoId: selectedValue };
};

const resolveMetodoPagoExportPayload = (
  metodoPago: string,
  metodosPagoOptions: Array<{ id: string; nombre: string }>,
) => {
  const query = resolveMetodoPagoFilterQuery(metodoPago, metodosPagoOptions);

  return {
    ...query,
    metodosPagoBase: Array.isArray(query.metodosPagoBase)
      ? query.metodosPagoBase
      : typeof query.metodosPagoBase === "string"
        ? query.metodosPagoBase.split(",").map((value) => value.trim()).filter(Boolean)
        : undefined,
  };
};

const parseMetodoPagoFilterValue = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => Boolean(item) && item !== "all");

const stringifyMetodoPagoFilterValue = (values: string[]) =>
  values.length > 0 ? values.join(",") : "all";

const SEARCH_DEBOUNCE_MS = 350;

const buildServiciosListCacheKey = (query: Record<string, unknown>) =>
  JSON.stringify(
    Object.entries(query)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [
        key,
        Array.isArray(value) ? [...value].sort() : value,
      ]),
  );

const mergeServicioDetailIntoRaw = (
  servicio: Servicio,
  detail: OrdenServicioDetail,
): Servicio => ({
  ...servicio,
  raw: {
    ...servicio.raw,
    ...(detail as unknown as OrdenServicioRaw),
    __detailLoaded: true,
  } as ServicioRawClient,
});

const hasServicioDetailLoaded = (servicio?: Servicio | null) =>
  Boolean(servicio && (servicio.raw as ServicioRawClient).__detailLoaded);

interface ServiciosUiCacheState {
  scopeEmpresaId: string | null;
  search: string;
  viewMode: "servicios" | "seguimientos";
  activePreset: string;
  activeOperationalFilter: string | null;
  currentPage: number;
  filters: ServiciosFiltersState;
}

const readServiciosUiCache = (
  cacheKey: string,
  scopeEmpresaId: string | null,
): ServiciosUiCacheState | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ServiciosUiCacheState> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const parsedScopeEmpresaId =
      typeof parsed.scopeEmpresaId === "string" && parsed.scopeEmpresaId.trim()
        ? parsed.scopeEmpresaId
        : null;

    if (
      parsedScopeEmpresaId &&
      scopeEmpresaId &&
      parsedScopeEmpresaId !== scopeEmpresaId
    ) {
      return null;
    }

    return {
      scopeEmpresaId: parsedScopeEmpresaId ?? scopeEmpresaId,
      search: typeof parsed.search === "string" ? parsed.search : "",
      viewMode: parsed.viewMode === "seguimientos" ? "seguimientos" : "servicios",
      activePreset: typeof parsed.activePreset === "string" ? parsed.activePreset : "all",
      activeOperationalFilter:
        typeof parsed.activeOperationalFilter === "string"
          ? parsed.activeOperationalFilter
          : null,
      currentPage:
        typeof parsed.currentPage === "number" && parsed.currentPage > 0
          ? Math.floor(parsed.currentPage)
          : 1,
      filters: normalizeServiciosFiltersState(parsed.filters),
    };
  } catch {
    return null;
  }
};

const createTransferenciaForm = (
  partial?: Partial<LiquidarTransferenciaForm>,
): LiquidarTransferenciaForm => ({
  id:
    partial?.id ||
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
  monto: partial?.monto || "",
  fechaPago: partial?.fechaPago ?? toBogotaYmd(),
  referenciaPago: partial?.referenciaPago || "",
  banco: partial?.banco || "",
  observacion: partial?.observacion || "",
  comprobanteFile: partial?.comprobanteFile || null,
  existingPath: partial?.existingPath,
  persisted: partial?.persisted ?? false,
  persistedMetadataLocked: partial?.persistedMetadataLocked ?? false,
});

const getStoredTransferencias = (
  orden?: Partial<OrdenServicioRaw> | null,
): LiquidarTransferenciaForm[] => {
  if (!orden) return [];

  const soportes = Array.isArray(orden.comprobantePago)
    ? orden.comprobantePago.filter((item) => isClientTransferSupport(item))
    : [];

  const transferencias = soportes.flatMap((soporte, idx) => {
    const existingPath = getSoportePagoPath(soporte);
    if (!existingPath) return [];

    const soporteData =
      typeof soporte === "object" && soporte !== null
        ? (soporte as {
            monto?: number;
            fechaPago?: string | null;
            fecha?: string | null;
            referenciaPago?: string | null;
            banco?: string | null;
            observacion?: string | null;
          })
        : undefined;
    const soporteFecha = soporteData?.fechaPago || soporteData?.fecha;
    const soporteReferencia = soporteData?.referenciaPago || "";
    const soporteMonto = formatCurrencyInput(soporteData?.monto);
    const persistedMetadataLocked =
      Boolean(existingPath) &&
      parseCurrencyInput(soporteMonto) > 0 &&
      Boolean(soporteFecha) &&
      Boolean(soporteReferencia.trim());

    return [
      createTransferenciaForm({
        id: `stored-${idx}-${existingPath}`,
        monto: soporteMonto,
        fechaPago: toStoredPaymentInputDate(soporteFecha),
        referenciaPago: soporteReferencia,
        banco: soporteData?.banco || "",
        observacion: soporteData?.observacion || "",
        existingPath,
        persisted: true,
        persistedMetadataLocked,
      }),
    ];
  });

  if (transferencias.length > 0) {
    return transferencias;
  }

  const legacyPath =
    typeof orden.comprobantePago === "string"
      ? orden.comprobantePago
      : undefined;

  if (orden.referenciaPago || orden.fechaPago || legacyPath) {
    return [
      createTransferenciaForm({
        id: `legacy-${orden.id || "orden"}`,
        monto: formatCurrencyInput(orden.valorPagado),
        fechaPago: toStoredPaymentInputDate(orden.fechaPago),
        referenciaPago: orden.referenciaPago || "",
        existingPath: legacyPath,
        persisted: true,
        persistedMetadataLocked:
          Boolean(legacyPath) &&
          parseCurrencyInput(formatCurrencyInput(orden.valorPagado)) > 0 &&
          Boolean(orden.fechaPago) &&
          Boolean(orden.referenciaPago?.trim()),
      }),
    ];
  }

  return [];
};

const getInitialTransferencias = (
  orden?: Partial<OrdenServicioRaw> | null,
): LiquidarTransferenciaForm[] => {
  const storedTransferencias = getStoredTransferencias(orden);

  if (storedTransferencias.length > 0) {
    return storedTransferencias;
  }

  const breakdown = orden?.desglosePago || [];
  const hasTransfer = breakdown.length > 0
    ? breakdown.some((b) => b.metodo.toUpperCase().includes("TRANSFERENCIA") && Number(b.monto) > 0)
    : orden?.metodoPago?.nombre?.toUpperCase().includes("TRANSFERENCIA");

  return hasTransfer ? [createTransferenciaForm()] : [];
};

const hasStoredTransferEvidence = (orden?: Partial<OrdenServicioRaw> | null) => {
  if (!orden) return false;

  if (Array.isArray(orden.comprobantePago)) {
    return orden.comprobantePago.some(
      (item) => isClientTransferSupport(item) && Boolean(getSoportePagoPath(item)),
    );
  }

  return isClientTransferSupport(orden.comprobantePago);
};

const getUniqueTransferSupportTotal = (comprobantePago?: unknown) => {
  if (!Array.isArray(comprobantePago)) return 0;

  const seenPaths = new Set<string>();

  return comprobantePago.reduce((total, item) => {
    if (!isClientTransferSupport(item)) return total;

    const path = getSoportePagoPath(item);
    if (!path || seenPaths.has(path)) return total;

    seenPaths.add(path);

    const monto =
      typeof item === "object" && item !== null && "monto" in item
        ? Number(item.monto || 0)
        : 0;

    return Number.isFinite(monto) && monto > 0 ? total + monto : total;
  }, 0);
};

const getPaymentBreakdownTotal = (desglosePago?: OrdenServicioRaw["desglosePago"]) =>
  Array.isArray(desglosePago)
    ? desglosePago.reduce((total, item) => total + Number(item.monto || 0), 0)
    : 0;

const getDisplayPaidValue = (orden?: Partial<OrdenServicioRaw> | null) => {
  if (!orden) return 0;

  const rawPaidValue = Number(orden.valorPagado || 0);
  const breakdownTotal = getPaymentBreakdownTotal(orden.desglosePago);
  const supportPaidValue = getUniqueTransferSupportTotal(orden.comprobantePago);
  const cappedPaidValue =
    breakdownTotal > 0 && rawPaidValue > breakdownTotal
      ? breakdownTotal
      : rawPaidValue;

  return cappedPaidValue || supportPaidValue || breakdownTotal;
};

const HARD_FINANCIAL_LOCK_STATES = new Set([
  "CONCILIADO",
]);

const OPERATIONALLY_LIQUIDATABLE_PAYMENT_STATES = new Set([
  "EFECTIVO_DECLARADO",
  "PAGADO",
  "CORTESIA",
]);

const canCompleteOperationalLiquidation = (
  orden?: Partial<OrdenServicioRaw> | null,
) => {
  if (!orden) return false;
  if (orden.liquidadoAt || orden.estadoServicio === "LIQUIDADO") return false;

  return Boolean(
    orden.estadoPago &&
      OPERATIONALLY_LIQUIDATABLE_PAYMENT_STATES.has(orden.estadoPago),
  );
};

const getFinancialLockMeta = (orden?: Partial<OrdenServicioRaw> | null) => {
  if (!orden) {
    return { locked: false, reason: "", allowsOperationalLiquidation: false };
  }

  if (canCompleteOperationalLiquidation(orden)) {
    return { locked: false, reason: "", allowsOperationalLiquidation: true };
  }

  if (orden.financialLock) {
    return {
      locked: true,
      allowsOperationalLiquidation: false,
      reason:
        "Bloqueo financiero activo. Esta orden ya no admite recaudo ni liquidación manual desde el listado.",
    };
  }

  if (orden.liquidadoAt || orden.estadoServicio === "LIQUIDADO") {
    return {
      locked: true,
      allowsOperationalLiquidation: false,
      reason:
        "La orden ya fue liquidada. Cualquier ajuste financiero debe pasar por contabilidad.",
    };
  }

  if (orden.estadoPago && HARD_FINANCIAL_LOCK_STATES.has(orden.estadoPago)) {
    return {
      locked: true,
      allowsOperationalLiquidation: false,
      reason:
        "El pago ya fue conciliado. Desde este punto los ajustes financieros deben seguir el flujo contable.",
    };
  }

  return { locked: false, reason: "", allowsOperationalLiquidation: false };
};

const getSettlementFlowMeta = (orden?: Partial<OrdenServicioRaw> | null) => {
  const financialLock = getFinancialLockMeta(orden);
  const breakdown = orden?.desglosePago || [];
  const hasCash =
    breakdown.some((b) => b.metodo.toUpperCase().includes("EFECTIVO") && Number(b.monto) > 0) ||
    Boolean(orden?.metodoPago?.nombre?.toUpperCase().includes("EFECTIVO"));
  const hasTransfer =
    breakdown.some((b) => b.metodo.toUpperCase().includes("TRANSFERENCIA") && Number(b.monto) > 0) ||
    Boolean(orden?.metodoPago?.nombre?.toUpperCase().includes("TRANSFERENCIA")) ||
    hasStoredTransferEvidence(orden);

  const now = new Date();
  const visitDate = orden?.fechaVisita ? new Date(orden.fechaVisita) : null;
  const visitTime = orden?.horaInicio ? new Date(orden.horaInicio) : null;
  let isFuture = false;

  if (visitDate) {
    const scheduledDateTime = new Date(visitDate);
    if (visitTime) {
      scheduledDateTime.setHours(visitTime.getHours(), visitTime.getMinutes(), 0, 0);
    }
    isFuture = scheduledDateTime > now;
  }

  if (isFuture) {
    return {
      financialLock,
      isFuture,
      hasCash,
      hasTransfer,
      title: "Registrar anticipo",
      description: "Registrá un pago anticipado sin cerrar la orden. El servicio sigue programado.",
      submitLabel: "Registrar anticipo",
      summaryLabel: "Monto anticipado",
      accent: "sky" as const,
    };
  }

  if (hasCash) {
    return {
      financialLock,
      isFuture,
      hasCash,
      hasTransfer,
      title: "Registrar recaudo",
      description: "Registrá el efectivo declarado. Contabilidad recalcula y concilia después.",
      submitLabel: "Registrar recaudo",
      summaryLabel: "Monto declarado",
      accent: "blue" as const,
    };
  }

  return {
    financialLock,
    isFuture,
    hasCash,
    hasTransfer,
    title: "Liquidar servicio",
    description: "Cerrá la orden por medios no efectivos. El sistema valida el cierre antes de confirmarlo.",
    submitLabel: "Liquidar servicio",
    summaryLabel: "Monto a liquidar",
    accent: "emerald" as const,
  };
};

const ESTADO_STYLING: Record<string, string> = {
  "NUEVO": "bg-muted text-muted-foreground border-border",
  "PROCESO": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "EN PROCESO": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "CANCELADO": "bg-destructive/10 text-destructive border-destructive/20",
  "PROGRAMADO": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "LIQUIDADO": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "TECNICO_FINALIZO": "bg-green-500/10 text-green-600 border-green-500/20",
  "TECNICO FINALIZO": "bg-green-500/10 text-green-600 border-green-500/20",
  "TECNICO FINALIZADO": "bg-green-500/10 text-green-600 border-green-500/20",
  "REPROGRAMADO": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "SIN_CONCRETAR": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  "SIN CONCRETAR": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  "DEFAULT": "bg-muted text-muted-foreground border-border",
};

const ESTADO_ROW_HOVER_STYLING: Record<string, string> = {
  "NUEVO": "hover:bg-muted/60 hover:shadow-[inset_4px_0_0_rgb(100_116_139)]",
  "PROCESO": "hover:bg-amber-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(245_158_11)]",
  "EN PROCESO": "hover:bg-amber-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(245_158_11)]",
  "CANCELADO": "hover:bg-destructive/10 hover:shadow-[inset_4px_0_0_rgb(239_68_68)]",
  "PROGRAMADO": "hover:bg-blue-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(59_130_246)]",
  "LIQUIDADO": "hover:bg-emerald-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(16_185_129)]",
  "TECNICO_FINALIZO": "hover:bg-green-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(34_197_94)]",
  "TECNICO FINALIZO": "hover:bg-green-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(34_197_94)]",
  "TECNICO FINALIZADO": "hover:bg-green-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(34_197_94)]",
  "REPROGRAMADO": "hover:bg-indigo-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(99_102_241)]",
  "SIN_CONCRETAR": "hover:bg-slate-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(100_116_139)]",
  "SIN CONCRETAR": "hover:bg-slate-500/[0.08] hover:shadow-[inset_4px_0_0_rgb(100_116_139)]",
  "DEFAULT": "hover:bg-muted/50 hover:shadow-[inset_4px_0_0_rgb(100_116_139)]",
};

const getEstadoRowHoverClassName = (estado?: string | null) =>
  ESTADO_ROW_HOVER_STYLING[estado?.trim().toUpperCase() || "DEFAULT"] ||
  ESTADO_ROW_HOVER_STYLING.DEFAULT;

const URGENCIA_STYLING: Record<string, string> = {
  "ALTA": "bg-red-500 text-white shadow-sm",
  "MEDIA": "bg-amber-500 text-white shadow-sm",
  "BAJA": "bg-emerald-500 text-white shadow-sm",
  "CRITICA": "bg-red-700 text-white shadow-sm",
};

const ESTADO_PAGO_STYLING: Record<string, string> = {
  "PENDIENTE": "bg-amber-500/10 text-amber-600 border-amber-500/20",
  "EFECTIVO_DECLARADO": "bg-blue-500/10 text-blue-600 border-blue-500/20",
  "CONSIGNADO": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "CONCILIADO": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "ANTICIPO": "bg-sky-500/10 text-sky-600 border-sky-500/20",
  "PAGADO": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  "CREDITO": "bg-purple-500/10 text-purple-600 border-purple-500/20",
  "PARCIAL": "bg-orange-500/10 text-orange-600 border-orange-500/20",
  "CORTESIA": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  "DEFAULT": "bg-muted text-muted-foreground border-border",
};

const ESTADO_PAGO_OPTIONS = [
  { id: "PENDIENTE", nombre: "PENDIENTE" },
  { id: "PARCIAL", nombre: "PARCIAL" },
  { id: "EFECTIVO_DECLARADO", nombre: "EFECTIVO DECLARADO" },
  { id: "PAGADO", nombre: "PAGADO" },
  { id: "CREDITO", nombre: "CRÉDITO" },
  { id: "CONCILIADO", nombre: "CONCILIADO" },
  { id: "CORTESIA", nombre: "CORTESÍA" },
];

const PAYMENT_METHOD_OPTIONS = [
  { id: "EFECTIVO", nombre: "EFECTIVO" },
  { id: "TRANSFERENCIA", nombre: "TRANSFERENCIA" },
  { id: "CREDITO", nombre: "CRÉDITO" },
  { id: "BONO", nombre: "BONO" },
  { id: "CORTESIA", nombre: "CORTESÍA" },
  { id: "PENDIENTE", nombre: "PENDIENTE" },
];

const SERVICE_PRESET_OPTIONS = [
  { key: "all", label: "TODOS" },
  { key: "HOY", label: "HOY" },
  { key: "MANANA", label: "MAÑANA" },
  { key: "SEMANA", label: "SEMANA" },
  { key: "PAGO_PENDIENTE", label: "PAGO PEND." },
  { key: "RECHAZADOS", label: "RECHAZADOS" },
  { key: "VENCIDOS", label: "VENCIDOS" },
  { key: "SIN_TECNICO", label: "SIN TÉCNICO" },
  { key: "PENDIENTES_LIQUIDAR", label: "PEND. LIQUIDAR" },
] as const;

const FOLLOW_UP_PRESET_OPTIONS = [
  { key: "all", label: "TODOS" },
  { key: "ACCIONES_PENDIENTES", label: "ACC. PENDIENTE" },
  { key: "SEGUIMIENTOS_CON_LLAMADAS", label: "CON LLAMADA" },
  { key: "SEGUIMIENTOS_SIN_LLAMADAS", label: "SIN LLAMADA" },
  { key: "RECHAZADOS", label: "RECHAZADOS" },
] as const;

const SERVICE_PRESET_KEYS = SERVICE_PRESET_OPTIONS.map((preset) => preset.key);
const FOLLOW_UP_PRESET_KEYS = FOLLOW_UP_PRESET_OPTIONS.map((preset) => preset.key);

const VISIT_TYPE_NORMALIZATION: Record<string, string> = {
  DIAGNOSTICO: "DIAGNOSTICO_INICIAL",
  DIAGNOSTICO_INICIAL: "DIAGNOSTICO_INICIAL",
  PREVENTIVO: "SERVICIO_REFUERZO",
  CORRECTIVO: "SERVICIO_REFUERZO",
  SERVICIO_REFUERZO: "SERVICIO_REFUERZO",
  SEGUIMIENTO: "CITA_VERIFICACION",
  CITA_VERIFICACION: "CITA_VERIFICACION",
  REINCIDENCIA: "GARANTIA",
  GARANTIA: "GARANTIA",
  NO_CONCRETADO: "NO_CONCRETADO",
  NUEVO: "NUEVO",
  REPROGRAMADO: "REPROGRAMADO",
};

const VISIT_TYPE_LABELS: Record<string, string> = {
  DIAGNOSTICO_INICIAL: "Diagnóstico Inicial",
  SERVICIO_REFUERZO: "Servicio Refuerzo",
  CITA_VERIFICACION: "Cita de Verificación",
  GARANTIA: "Garantía",
  NO_CONCRETADO: "No Concretado",
  NUEVO: "Nuevo",
  REPROGRAMADO: "Reprogramado",
};

const normalizeVisitType = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return null;
  return VISIT_TYPE_NORMALIZATION[normalized] || normalized;
};

const formatVisitTypeLabel = (value?: string | null) => {
  const normalized = normalizeVisitType(value);
  if (!normalized) return "N/A";
  return VISIT_TYPE_LABELS[normalized] || normalized;
};

const resolveServicioDisplayName = (orden: OrdenServicioRaw) => {
  const multipleServicios = Array.isArray(orden.serviciosSeleccionados)
    ? orden.serviciosSeleccionados
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item))
    : [];

  if (multipleServicios.length > 0) {
    return multipleServicios.join(", ");
  }

  return orden.servicio?.nombre || "Servicio General";
};

const getFollowUpRecords = (orden: OrdenServicioRaw): FollowUpRecord[] =>
  Array.isArray(orden.seguimientos) ? orden.seguimientos.filter(Boolean) : [];

const getFollowUpRecordTimestamp = (value?: string | null) => {
  if (!value) return Number.NEGATIVE_INFINITY;

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
};

const getPendingFollowUpRecords = (orden: OrdenServicioRaw) =>
  getFollowUpRecords(orden)
    .filter((item) => item?.status === "PENDIENTE")
    .sort(
      (a, b) =>
        getFollowUpRecordTimestamp(a.dueAt) - getFollowUpRecordTimestamp(b.dueAt),
    );

const getCompletedFollowUpRecords = (orden: OrdenServicioRaw) =>
  getFollowUpRecords(orden)
    .filter(
      (item) =>
        item?.status === "ACEPTADO" ||
        item?.status === "RECHAZADO" ||
        Boolean(item?.completedAt),
    )
    .sort(
      (a, b) =>
        getFollowUpRecordTimestamp(
          b.completedAt ?? b.contactedAt ?? b.updatedAt ?? b.createdAt,
        ) -
        getFollowUpRecordTimestamp(
          a.completedAt ?? a.contactedAt ?? a.updatedAt ?? a.createdAt,
        ),
    );

const getLatestFollowUpStatus = (orden: OrdenServicioRaw) =>
  getFollowUpRecords(orden)[0]?.status || "";

const hasPendingFollowUp = (orden: OrdenServicioRaw) =>
  getPendingFollowUpRecords(orden).length > 0;

const hasRegisteredFollowUpCall = (orden: OrdenServicioRaw) =>
  getCompletedFollowUpRecords(orden).length > 0;

const formatFollowUpLabel = (value?: string | null, fallback = "SIN DATO") => {
  if (!value?.trim()) return fallback;
  return value.replace(/_/g, " ");
};

const canEditOrdenTecnica = (orden: OrdenServicioRaw) => {
  const tipoVisita = normalizeVisitType(orden.tipoVisita);

  return (
    !orden.ordenPadreId ||
    tipoVisita === "NUEVO" ||
    tipoVisita === "SERVICIO_REFUERZO" ||
    hasRegisteredFollowUpCall(orden)
  );
};

const getResolvedFollowUpStatus = (orden: OrdenServicioRaw) => {
  const latestStatus = getLatestFollowUpStatus(orden);
  if (hasPendingFollowUp(orden)) return "";
  return latestStatus === "ACEPTADO" || latestStatus === "RECHAZADO"
    ? latestStatus
    : "";
};

const SERVICE_STATUS_DISPLAY_MAP: Record<string, string> = {
  PROCESO: "EN PROCESO",
  TECNICO_FINALIZO: "TECNICO FINALIZADO",
  SIN_CONCRETAR: "SIN CONCRETAR",
};

const mapOrdenToServicio = (
  os: OrdenServicioRaw,
  isFollowUp = Boolean(os.ordenPadreId) && Boolean(getResolvedFollowUpStatus(os)),
): Servicio => {
  const clienteLabel =
    os.cliente.tipoCliente === "EMPRESA"
      ? os.cliente.razonSocial || "Empresa"
      : `${os.cliente.nombre || ""} ${os.cliente.apellido || ""}`.trim();

  const displayStatus =
    SERVICE_STATUS_DISPLAY_MAP[os.estadoServicio || ""] ||
    os.estadoServicio ||
    "NUEVO";

  return {
    id: os.numeroOrden || os.id.substring(0, 8).toUpperCase(),
    cliente: clienteLabel,
    clienteFull: os.cliente,
    servicioEspecifico: resolveServicioDisplayName(os),
    fecha: os.fechaVisita ? formatBogotaDate(os.fechaVisita) : "Sin fecha",
    hora: os.horaInicio ? formatBogotaTime(os.horaInicio) : "Sin hora",
    tecnico: os.tecnico?.user
      ? `${os.tecnico.user.nombre} ${os.tecnico.user.apellido}`
      : "Sin asignar",
    tecnicoId: os.tecnicoId ?? undefined,
    estadoServicio: displayStatus,
    urgencia: os.urgencia || "BAJA",
    empresaId: os.empresaId,
    raw: os,
    followUps: (os.ordenesHijas || []).map((child) =>
      mapOrdenToServicio(child, true),
    ),
    isFollowUp,
  };
};

const FOLLOW_UP_STATUS_STYLING: Record<string, string> = {
  PENDIENTE:
    "border-amber-200 bg-amber-50 text-amber-700",
  ACEPTADO:
    "border-emerald-200 bg-emerald-50 text-emerald-700",
  RECHAZADO:
    "border-rose-200 bg-rose-50 text-rose-700",
  DEFAULT:
    "border-zinc-200 bg-zinc-50 text-zinc-600",
};

const servicesPanelClass = "rounded-[5px] border border-border bg-card shadow-sm";
const servicesHeaderActionClass =
  "h-8 flex-1 rounded-[4px] border-border bg-card px-3 text-[10px] font-medium tracking-[0.08em] text-foreground shadow-sm hover:bg-muted sm:flex-none";
const servicesPrimaryActionClass =
  "h-8 flex-1 rounded-[4px] border-none bg-[#01ADFB] px-3 text-[10px] font-medium tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-[#0197dc] sm:flex-none";
const servicesToolbarButtonClass =
  "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[4px] border border-border bg-card px-3 text-[10px] font-medium tracking-[0.08em] text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground";
const servicesTableHeadClass =
  "bg-muted/50 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
const servicesCellClass = "px-3 py-3 text-[11px] align-middle lg:px-4";
const servicesTextWrapClass = "min-w-0 break-words [overflow-wrap:anywhere]";
const servicesBadgeClass =
  "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] border";
const servicesDialogContentClass = "overflow-hidden border-border bg-background p-0 shadow-xl";
const servicesDialogHeaderClass = "border-b border-border bg-card px-5 py-4";
const servicesDialogBodyClass = "px-5 py-4";
const servicesDialogFooterClass = "border-t border-border bg-card px-5 py-3";
const servicesDialogTitleClass = "text-[15px] font-medium tracking-tight text-foreground";
const servicesDialogDescriptionClass = "mt-1 text-[11px] text-muted-foreground";
const servicesDialogLabelClass = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
const servicesDialogInputClass = "h-9 rounded-[4px] border-border bg-background text-[12px] font-medium text-foreground";
const servicesFilterComboboxTriggerClass =
  "h-9 rounded-[4px] border-border bg-background px-3 py-2 text-left text-[12px] font-medium text-foreground shadow-sm transition-all hover:bg-muted/40 focus:border-[#01ADFB]/30 focus:bg-card focus:ring-2 focus:ring-[#01ADFB]/15 disabled:bg-muted/40";
const servicesFilterComboboxContentClass = "z-[70] mt-1 rounded-[5px] border-border bg-card shadow-xl";
const servicesDialogButtonClass = "h-8 rounded-[4px] text-[10px] font-medium tracking-[0.08em]";
const servicesDropdownContentClass = "rounded-[5px] border-border bg-card p-2 shadow-xl";
const servicesDropdownItemClass =
  "flex cursor-pointer items-center gap-3 rounded-[4px] py-2 text-[11px] font-medium text-foreground hover:bg-muted";
const servicesDetailLabelClass = "text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground";

const VIEW_MODE_OPTIONS = [
  { key: "servicios", label: "Servicios" },
  { key: "seguimientos", label: "Seguimientos" },
] as const;

type ViewMode = (typeof VIEW_MODE_OPTIONS)[number]["key"];

const CUSTOM_PRESET_COLORS: DashboardPresetColorToken[] = [
  "slate",
  "red",
  "orange",
  "amber",
  "emerald",
  "teal",
  "sky",
  "blue",
  "indigo",
  "pink",
];

const EXPORT_PRESET_OPTIONS = [
  { value: "none", label: "SIN PRESET" },
  { value: "HOY", label: "HOY" },
  { value: "MANANA", label: "MAÑANA" },
  { value: "SEMANA", label: "SEMANA" },
  { value: "VENCIDOS", label: "VENCIDOS" },
  { value: "SIN_TECNICO", label: "SIN TÉCNICO" },
  { value: "PENDIENTES_LIQUIDAR", label: "PEND. LIQUIDAR" },
] as const;

type ExportPresetValue = NonNullable<ExportOrdenesServicioPayload["preset"]>;

const DATE_EXPORT_PRESETS = new Set<ExportPresetValue>(["HOY", "MANANA", "SEMANA"]);

const SERVICE_ONLY_EXPORT_PRESETS = new Set<ExportPresetValue>([
  "VENCIDOS",
  "SIN_TECNICO",
  "PENDIENTES_LIQUIDAR",
]);

function ServiciosSkeleton({ showKPIs = true }: { showKPIs?: boolean }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {showKPIs && (
        <div className="mb-3 shrink-0 overflow-x-auto pb-1">
          <div className="grid min-w-max grid-flow-col auto-cols-[minmax(132px,1fr)] gap-2 lg:min-w-0 lg:grid-flow-row lg:grid-cols-7">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="flex min-h-[62px] animate-pulse items-center gap-3 rounded-[4px] border border-border bg-card p-3 shadow-sm">
              <Skeleton className="h-8 w-8 rounded-[4px]" />
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-5 w-8" />
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
      <div className={cn("flex-1 overflow-hidden", servicesPanelClass)}>
        <div className="flex justify-between border-b border-border px-4 py-3 lg:px-5">
          <Skeleton className="h-9 w-1/2 rounded-[4px]" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28 rounded-[4px]" />
            <Skeleton className="h-9 w-32 rounded-[4px]" />
          </div>
        </div>
        <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
        <thead>
          <tr className={cn("border-b border-border", servicesTableHeadClass)}>
            <th className="px-3 py-2 lg:px-4">ID</th>
            <th className="px-3 py-2 lg:px-4">Cliente / Servicio</th>
            <th className="px-3 py-2 lg:px-4">Programación</th>
            <th className="px-3 py-2 lg:px-4">Técnico</th>
            <th className="px-3 py-2 lg:px-4">Tipo visita</th>
            <th className="px-3 py-2 lg:px-4">Estado ops</th>
            <th className="px-3 py-2 lg:px-4">Estado pago</th>
            <th className="px-3 py-2 text-right lg:px-4">···</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {[...Array(5)].map((_, i) => (
            <tr key={i} className="animate-pulse">
              <td className={servicesCellClass}><Skeleton className="h-7 w-20 rounded-[4px]" /></td>
              <td className={servicesCellClass}><div className="space-y-2"><Skeleton className="h-4 w-48" /><Skeleton className="h-3 w-32" /></div></td>
              <td className={servicesCellClass}><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-20" /></div></td>
              <td className={servicesCellClass}><div className="flex items-center gap-2"><Skeleton className="h-7 w-7 rounded-[4px]" /><Skeleton className="h-4 w-28" /></div></td>
              <td className={servicesCellClass}><Skeleton className="h-7 w-20 rounded-[4px]" /></td>
              <td className={servicesCellClass}><Skeleton className="h-7 w-24 rounded-[4px]" /></td>
              <td className={servicesCellClass}><Skeleton className="h-7 w-24 rounded-[4px]" /></td>
              <td className={cn(servicesCellClass, "text-right")}><div className="flex justify-end gap-2"><Skeleton className="h-8 w-8 rounded-[4px]" /><Skeleton className="h-8 w-8 rounded-[4px]" /></div></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  );
}

function ServiciosContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const currentServiciosReturnTo = useMemo(() => {
    const query = searchParams.toString();
    return `${pathname}${query ? `?${query}` : ""}`;
  }, [pathname, searchParams]);
  const encodedServiciosReturnTo = useMemo(
    () => encodeURIComponent(currentServiciosReturnTo),
    [currentServiciosReturnTo],
  );
  const { checkPermission, isLoading: isLoadingRole, tenantId } = useUserRole();
  const canViewServices = checkPermission("SERVICE_VIEW");
  const canCreateServices = checkPermission("SERVICE_CREATE");
  const canEditServices = checkPermission("SERVICE_EDIT");
  const canManageServices = checkPermission("SERVICE_MANAGE");
  const canExportServices = checkPermission("SERVICE_EXPORT");

  useEffect(() => {
    if (!isLoadingRole && !canViewServices) {
      router.replace("/dashboard");
    }
  }, [canViewServices, isLoadingRole, router]);

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    searchParams.get("search") || "",
  );
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedServicio, setSelectedServicio] = useState<Servicio | null>(null);
  const [selectedServicioDetailLoading, setSelectedServicioDetailLoading] =
    useState(false);
  const selectedServicioAddress = useMemo(
    () => (selectedServicio ? getServicioAddress(selectedServicio.raw) : null),
    [selectedServicio],
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVisitaModalOpen, setIsVisitaModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [isLiquidarModalOpen, setIsLiquidarModalOpen] = useState(false);
  const [isViewLiquidationModalOpen, setIsViewLiquidationModalOpen] = useState(false);
  const transferenciaFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [showKPIs, setShowKPIs] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<ViewMode>(
    searchParams.get("tab") === "seguimientos" ? "seguimientos" : "servicios",
  );
  const [activePreset, setActivePreset] = useState(searchParams.get("preset") || "all");
  const [dateSortOrder, setDateSortOrder] = useState<DateSortOrder>("desc");
  const [showOperationalQueue, setShowOperationalQueue] = useState(false);
  const [expandedOperationalSections, setExpandedOperationalSections] = useState<Record<string, boolean>>({
    SIN_ASIGNAR_HOY: true,
    POR_INICIAR: true,
    EN_EJECUCION: true,
    PENDIENTES_CIERRE: true,
    CON_INCIDENCIA: true,
    ATRASADOS: true,
  });
  const [activeOperationalFilter, setActiveOperationalFilter] = useState<string | null>(null);
  const [kpis, setKpis] = useState<ServiciosKpis | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [isProcessingJob, setIsProcessingJob] = useState(false);
  const [hasRestoredUiState, setHasRestoredUiState] = useState(false);
  const [restoredServiciosUiCacheKey, setRestoredServiciosUiCacheKey] =
    useState<string | null>(null);
  const skipNextServiciosUiCacheWriteRef = useRef(false);
  const hasLoadedServiciosRef = useRef(false);
  const lastServiciosFetchModeRef = useRef<ViewMode | null>(null);
  const serviciosFetchSequenceRef = useRef(0);
  const serviciosListCacheRef = useRef<Map<string, ServiciosListCacheEntry>>(
    new Map(),
  );
  const serviciosAbortRef = useRef<AbortController | null>(null);
  const selectedServicioDetailCacheRef = useRef<
    Record<string, OrdenServicioDetail>
  >({});

  const invalidateServiciosListCache = useCallback(() => {
    serviciosFetchSequenceRef.current += 1;
    serviciosListCacheRef.current.clear();
  }, []);

  const storeServiciosListCache = useCallback(
    (cacheKey: string, entry: ServiciosListCacheEntry) => {
      const cache = serviciosListCacheRef.current;
      if (cache.has(cacheKey)) {
        cache.delete(cacheKey);
      }

      cache.set(cacheKey, entry);

      while (cache.size > SERVICIOS_LIST_CACHE_MAX_ENTRIES) {
        const oldestKey = cache.keys().next().value;
        if (!oldestKey) break;
        cache.delete(oldestKey);
      }
    },
    [],
  );

  const handleTriggerJob = async () => {
    setIsProcessingJob(true);
    const toastId = toast.loading(renderReinforcementsLoadingToast());
    try {
      const res = await triggerReinforcementsJob();
      toast.success(renderReinforcementsToastContent(res), { id: toastId, duration: 9000 });
      invalidateServiciosListCache();
      await fetchServicios(false, { forceRefresh: true });
    } catch (error) {
      console.error("Error triggering job:", error);
      toast.error("No se pudieron procesar los refuerzos", { id: toastId });
    } finally {
      setIsProcessingJob(false);
    }
  };

  const operationalCounts = useMemo(() => {
    const today = toBogotaYmd();
    const counts = {
      sinAsignarHoy: 0,
      porIniciar: 0,
      enEjecucion: 0,
      pendientesCierre: 0,
      conIncidencia: 0,
      atrasados: 0,
    };

    for (const servicio of servicios) {
      const estado = servicio.estadoServicio;
      const visitYmd = servicio.raw.fechaVisita
        ? utcIsoToBogotaYmd(servicio.raw.fechaVisita)
        : null;

      if (visitYmd === today && !servicio.tecnicoId) counts.sinAsignarHoy += 1;
      if (visitYmd === today && estado === "PROGRAMADO") counts.porIniciar += 1;
      if (estado === "PROCESO" || estado === "EN PROCESO") counts.enEjecucion += 1;
      if (
        estado === "TECNICO_FINALIZO" ||
        estado === "TECNICO FINALIZO" ||
        estado === "TECNICO FINALIZADO"
      ) {
        counts.pendientesCierre += 1;
      }
      if (estado === "SIN_CONCRETAR" || estado === "SIN CONCRETAR") {
        counts.conIncidencia += 1;
      }
      if (
        visitYmd &&
        visitYmd < today &&
        !["LIQUIDADO", "CANCELADO", "SIN_CONCRETAR", "SIN CONCRETAR"].includes(
          estado,
        )
      ) {
        counts.atrasados += 1;
      }
    }

    return counts;
  }, [servicios]);

  const toggleOperationalSection = (key: string) => {
    setExpandedOperationalSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const applyOperationalFilter = (filter: string | null) => {
    setActiveOperationalFilter(filter);
    setViewMode("servicios");
    if (filter) {
      setActivePreset("all");
    }
    setCurrentPage(1);
  };
  const [customPresets, setCustomPresets] = useState<DashboardPreset[]>([]);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [exportEnterpriseMode, setExportEnterpriseMode] = useState<"all" | "selected">("all");
  const [exportEmpresaIds, setExportEmpresaIds] = useState<string[]>([]);
  const [availableEnterprises, setAvailableEnterprises] = useState<Enterprise[]>([]);
  const [exportEmpresaSearch, setExportEmpresaSearch] = useState("");
  const [exportPreset, setExportPreset] = useState<string>("none");
  const [exportDateRange, setExportDateRange] = useState({
    fechaInicio: "",
    fechaFin: "",
  });
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpRow | null>(null);
  const [selectedFollowUpRecordId, setSelectedFollowUpRecordId] = useState<string | null>(null);
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [presetForm, setPresetForm] = useState<{
    name: string;
    colorToken: DashboardPresetColorToken;
    isShared: boolean;
  }>({
    name: "",
    colorToken: "sky",
    isShared: false,
  });
  const [followUpForm, setFollowUpForm] = useState({
    contactedAt: "",
    channel: "LLAMADA",
    outcome: "CONTACTADO",
    resolution: "ACEPTADO" as "ACEPTADO" | "RECHAZADO",
    notes: "",
    nextActionAt: "",
  });

  const [liquidarData, setLiquidarData] = useState<{
    breakdown: Array<{
      metodo: string;
      monto: string;
      banco?: string;
      referencia?: string;
      observacion?: string;
    }>;
    observacionFinal: string;
    transferencias: LiquidarTransferenciaForm[];
  }>({
    breakdown: [{ metodo: "PENDIENTE", monto: "" }],
    observacionFinal: "",
    transferencias: [createTransferenciaForm()],
  });

  const normalizedActivePreset =
    viewMode === "seguimientos"
      ? FOLLOW_UP_PRESET_KEYS.includes(activePreset as (typeof FOLLOW_UP_PRESET_KEYS)[number])
        ? activePreset
        : "all"
      : SERVICE_PRESET_KEYS.includes(activePreset as (typeof SERVICE_PRESET_KEYS)[number])
        ? activePreset
        : "all";

  const activePresetOptions =
    viewMode === "seguimientos" ? FOLLOW_UP_PRESET_OPTIONS : SERVICE_PRESET_OPTIONS;

  const resolvedBackendPreset =
    viewMode === "seguimientos"
      ? normalizedActivePreset === "all"
        ? "SEGUIMIENTOS"
        : normalizedActivePreset
      : normalizedActivePreset === "all" || normalizedActivePreset === "PAGO_PENDIENTE"
        ? undefined
        : normalizedActivePreset;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDownloadingEvidenceImages, setIsDownloadingEvidenceImages] = useState(false);
  const [openingStoragePath, setOpeningStoragePath] = useState<string | null>(null);
  const [isDeletingServicio, setIsDeletingServicio] = useState(false);
  const [uploadConfig, setUploadConfig] = useState<{ id: string; field: "facturaElectronica" | "comprobantePago" | "evidenciaPath" } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Servicio | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  const triggerUpload = (id: string, field: "facturaElectronica" | "comprobantePago" | "evidenciaPath") => {
    if (fileInputRef.current) {
      fileInputRef.current.multiple = field === "evidenciaPath";
    }
    setUploadConfig({ id, field });
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  const openFreshStorageUrl = useCallback(
    async (ordenId: string, rawPath: unknown, label = "archivo") => {
      const path = getSoportePagoPath(rawPath);

      if (!path) {
        toast.error(`No encontramos el ${label}.`);
        return;
      }

      if (/^https?:\/\//i.test(path)) {
        window.open(path, "_blank", "noopener,noreferrer");
        return;
      }

      const popup = window.open("about:blank", "_blank");
      if (popup) {
        popup.opener = null;
      }

      setOpeningStoragePath(`${ordenId}:${path}`);

      try {
        const { signedUrl } = await createSignedDownloadUrl(ordenId, path);

        if (popup) {
          popup.location.href = signedUrl;
          return;
        }

        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        popup?.close();
        console.error("No se pudo abrir el archivo", error);
        toast.error(`No pudimos abrir el ${label}. Intentá nuevamente.`);
      } finally {
        setOpeningStoragePath(null);
      }
    },
    [],
  );

  const [filters, setFilters] = useState<ServiciosFiltersState>(() =>
    normalizeServiciosFiltersState({
      estado: searchParams.get("estado") || SERVICIOS_FILTER_DEFAULTS.estado,
      estadoPago: searchParams.get("estadoPago") || SERVICIOS_FILTER_DEFAULTS.estadoPago,
      metodoPago: searchParams.get("metodoPago") || SERVICIOS_FILTER_DEFAULTS.metodoPago,
      tecnico: searchParams.get("tecnico") || SERVICIOS_FILTER_DEFAULTS.tecnico,
      urgencia: searchParams.get("urgencia") || SERVICIOS_FILTER_DEFAULTS.urgencia,
      creador: searchParams.get("creador") || SERVICIOS_FILTER_DEFAULTS.creador,
      departamento:
        searchParams.get("departamento") || SERVICIOS_FILTER_DEFAULTS.departamento,
      municipio: searchParams.get("municipio") || SERVICIOS_FILTER_DEFAULTS.municipio,
      empresa: SERVICIOS_FILTER_DEFAULTS.empresa,
      tipo: searchParams.get("tipo") || SERVICIOS_FILTER_DEFAULTS.tipo,
      fechaInicio: searchParams.get("fechaInicio") || SERVICIOS_FILTER_DEFAULTS.fechaInicio,
      fechaFin: searchParams.get("fechaFin") || SERVICIOS_FILTER_DEFAULTS.fechaFin,
    }),
  );
  const [filterDraft, setFilterDraft] = useState<ServiciosFiltersState>(filters);
  const [filterOptions, setOptions] = useState<{
    estados: { id: string; nombre: string }[];
    estadosPago: { id: string; nombre: string }[];
    metodosPago: { id: string; nombre: string }[];
    tecnicos: { id: string; nombre: string }[];
    creadores: { id: string; nombre: string }[];
    departamentos: DepartmentDTO[];
    municipios: MunicipalityDTO[];
    empresas: { id: string; nombre: string }[];
    tiposVisita: string[];
  }>({
    estados: [],
    estadosPago: ESTADO_PAGO_OPTIONS,
    metodosPago: PAYMENT_METHOD_OPTIONS,
    tecnicos: [],
    creadores: [],
    departamentos: [],
    municipios: [],
    empresas: [],
    tiposVisita: [],
  });

  const metodoPagoFilterOptions = useMemo(() => {
    const mapped = filterOptions.metodosPago
      .map((option) => {
        const normalizedBase = normalizeMetodoPagoBase(option.nombre) ?? normalizeMetodoPagoBase(option.id);
        if (!normalizedBase) return null;
        return {
          value: normalizedBase,
          label: option.nombre.toUpperCase(),
        };
      })
      .filter((option): option is { value: string; label: string } => option !== null);

    const deduped = new Map<string, { value: string; label: string }>();
    for (const option of mapped) {
      if (!deduped.has(option.value)) {
        deduped.set(option.value, option);
      }
    }

    return Array.from(deduped.values());
  }, [filterOptions.metodosPago]);

  const draftMetodoPagoValues = useMemo(
    () => parseMetodoPagoFilterValue(filterDraft.metodoPago),
    [filterDraft.metodoPago],
  );

  const draftMetodoPagoFilterLabel = useMemo(() => {
    if (draftMetodoPagoValues.length === 0) {
      return "TODOS LOS MÉTODOS DE PAGO";
    }

    if (draftMetodoPagoValues.length === 1) {
      return (
        metodoPagoFilterOptions.find(
          (option) => option.value === draftMetodoPagoValues[0],
        )?.label || draftMetodoPagoValues[0]
      );
    }

    return `${draftMetodoPagoValues.length} MÉTODOS SELECCIONADOS`;
  }, [metodoPagoFilterOptions, draftMetodoPagoValues]);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const itemsPerPage = 10;

  const getScopedEnterpriseId = useCallback(() => {
    if (typeof window === "undefined") return undefined;
    const lockedId = getBrowserScopedEnterpriseId();
    if (lockedId) return lockedId;
    return localStorage.getItem("current-enterprise-id") || undefined;
  }, []);

  const scopedEnterpriseId = getScopedEnterpriseId() ?? null;

  const serviciosUiCacheKey = useMemo(
    () => buildServiciosUiCacheKey(tenantId, scopedEnterpriseId),
    [scopedEnterpriseId, tenantId],
  );

  const isServiciosUiStateReady =
    hasRestoredUiState && restoredServiciosUiCacheKey === serviciosUiCacheKey;

  const clearServiciosUiCache = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(serviciosUiCacheKey);
  }, [serviciosUiCacheKey]);

  const fetchOptions = useCallback(async () => {
    try {
      const empresaId = getScopedEnterpriseId();
      const currentTenantId = tenantId;

      const [estados, metodosPago, tecnicos, departments, munis, memberships] = await Promise.all([
        getEstadoServicios(empresaId),
        getMetodosPago(empresaId),
        getOperators(empresaId),
        getDepartments(),
        getMunicipalities(),
        currentTenantId ? getTenantMemberships(currentTenantId) : Promise.resolve([]),
      ]);

      const coreEstados = [
        { id: "NUEVO", nombre: "NUEVO" },
        { id: "PROGRAMADO", nombre: "PROGRAMADO" },
        { id: "PROCESO", nombre: "EN PROCESO" },
        { id: "TECNICO_FINALIZO", nombre: "TÉCNICO FINALIZÓ" },
        { id: "LIQUIDADO", nombre: "LIQUIDADO" },
        { id: "REPROGRAMADO", nombre: "REPROGRAMADO" },
        { id: "CANCELADO", nombre: "CANCELADO" },
        { id: "SIN_CONCRETAR", nombre: "SIN CONCRETAR" },
      ];

      const ADMIN_ROLES = ["SU_ADMIN", "ADMIN", "COORDINADOR", "ASESOR"];
      const administrativeMembers = (Array.isArray(memberships) ? memberships : [])
        .filter(m => ADMIN_ROLES.includes(m.role))
        .map(m => ({
          id: m.id,
          nombre: `${m.user.nombre || ""} ${m.user.apellido || ""}`.trim() || "Sin nombre"
        }));

      setOptions(prev => ({
        ...prev,
        estados: Array.isArray(estados) && estados.length > 0 ? (estados as Array<{id: string, nombre: string}>) : coreEstados,
        estadosPago: ESTADO_PAGO_OPTIONS,
        metodosPago: Array.isArray(metodosPago) && metodosPago.length > 0
          ? (metodosPago as Array<{ id: string; nombre: string }>)
          : PAYMENT_METHOD_OPTIONS,
        creadores: administrativeMembers,
        tecnicos: (Array.isArray(tecnicos) ? (tecnicos as Array<{ id: string, nombre?: string, user?: { nombre?: string, apellido?: string } }>) : []).map(t => ({
          id: t.id,
          nombre: t.nombre || `${t.user?.nombre || ""} ${t.user?.apellido || ""}`.trim() || "Sin nombre"
        })),
        departamentos: Array.isArray(departments) ? departments as DepartmentDTO[] : [],
        municipios: Array.isArray(munis) ? munis as MunicipalityDTO[] : [],
      }));
    } catch (error) {
      console.error("Error fetching filter options", error);
    }
  }, [getScopedEnterpriseId, tenantId]);

  const fetchServicios = useCallback(
    async (resetPage = false, options: FetchServiciosOptions = {}) => {
      const pageToFetch = resetPage ? 1 : currentPage;
      if (resetPage) setCurrentPage(1);

      const empresaId = getScopedEnterpriseId();
      const today = toBogotaYmd();
      const effectiveFilters =
        activePreset === "PAGO_PENDIENTE"
          ? {
              ...filters,
              estadoPago: "PENDIENTE",
              fechaFin:
                filters.fechaFin && filters.fechaFin < today
                  ? filters.fechaFin
                  : today,
            }
          : filters;
      const sinTecnicoFilterActive = isSinTecnicoFilter(effectiveFilters.tecnico);
      const requestQuery = {
        empresaId,
        search: debouncedSearch,
        page: pageToFetch,
        limit: itemsPerPage,
        estado: effectiveFilters.estado,
        estadoPago: effectiveFilters.estadoPago,
        ...resolveMetodoPagoFilterQuery(
          effectiveFilters.metodoPago,
          filterOptions.metodosPago,
        ),
        tecnicoId: sinTecnicoFilterActive ? undefined : effectiveFilters.tecnico,
        sinTecnico: sinTecnicoFilterActive ? true : undefined,
        urgencia: effectiveFilters.urgencia,
        creadorId: effectiveFilters.creador,
        departamento: effectiveFilters.departamento,
        municipio: effectiveFilters.municipio,
        tipoVisita: effectiveFilters.tipo,
        fechaInicio: effectiveFilters.fechaInicio,
        fechaFin: effectiveFilters.fechaFin,
        preset: resolvedBackendPreset,
        dateSortOrder,
        includeFollowUps: viewMode === "seguimientos" ? true : undefined,
      };
      const cacheKey = buildServiciosListCacheKey({
        viewMode,
        ...requestQuery,
      });
      const fetchSequence = ++serviciosFetchSequenceRef.current;
      const cachedEntry = options.forceRefresh
        ? undefined
        : serviciosListCacheRef.current.get(cacheKey);

      serviciosAbortRef.current?.abort();

      if (cachedEntry) {
        serviciosAbortRef.current = null;
        setServicios(cachedEntry.data);
        setTotalPages(cachedEntry.meta.totalPages);
        setTotalCount(cachedEntry.meta.totalCount);
        hasLoadedServiciosRef.current = true;
        lastServiciosFetchModeRef.current = viewMode;
        setLoading(false);
        setIsRefreshing(false);
        return cachedEntry.data;
      }

      const controller = new AbortController();
      serviciosAbortRef.current = controller;
      const isFirstLoad = !hasLoadedServiciosRef.current;
      const isViewModeChange =
        lastServiciosFetchModeRef.current !== null &&
        lastServiciosFetchModeRef.current !== viewMode;
      const shouldShowBlockingLoader = isFirstLoad || isViewModeChange;

      if (isViewModeChange) {
        setServicios([]);
        setTotalPages(1);
        setTotalCount(0);
      }

      if (shouldShowBlockingLoader) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      try {
        const response = await getOrdenesServicio(requestQuery, {
          signal: controller.signal,
        });

        const { data: ordenesData, meta } = response;

        const mapped: Servicio[] = ordenesData.map((os: OrdenServicioRaw) => mapOrdenToServicio(os));
        const isLatestFetch = fetchSequence === serviciosFetchSequenceRef.current;

        if (isLatestFetch) {
          storeServiciosListCache(cacheKey, {
            data: mapped,
            meta: {
              totalCount: meta.total,
              totalPages: meta.totalPages,
            },
          });
          setServicios(mapped);
          setTotalPages(meta.totalPages);
          setTotalCount(meta.total);
          lastServiciosFetchModeRef.current = viewMode;
        }

        return mapped;
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          return [];
        }
        if (fetchSequence === serviciosFetchSequenceRef.current) {
          console.error("Error loading services", error);
          toast.error("Error al cargar las órdenes de servicio");
        }
        return [];
      } finally {
        if (fetchSequence === serviciosFetchSequenceRef.current) {
          if (serviciosAbortRef.current === controller) {
            serviciosAbortRef.current = null;
          }
          if (isFirstLoad) {
            hasLoadedServiciosRef.current = true;
          }
          if (shouldShowBlockingLoader) {
            setLoading(false);
          }
          setIsRefreshing(false);
        }
      }
    },
    [
      activePreset,
      getScopedEnterpriseId,
      debouncedSearch,
      currentPage,
      itemsPerPage,
      filters,
      resolvedBackendPreset,
      filterOptions.metodosPago,
      dateSortOrder,
      viewMode,
      storeServiciosListCache,
    ],
  );

  const ensureSelectedServicioDetail = useCallback(async (servicio: Servicio) => {
    const cachedDetail = selectedServicioDetailCacheRef.current[servicio.raw.id];
    if (cachedDetail) {
      const merged = mergeServicioDetailIntoRaw(servicio, cachedDetail);
      setSelectedServicio((current) =>
        current?.raw.id === servicio.raw.id ? merged : current,
      );
      return merged;
    }

    setSelectedServicioDetailLoading(true);
    try {
      const detail = await getOrdenServicio(servicio.raw.id);
      selectedServicioDetailCacheRef.current[servicio.raw.id] = detail;

      const merged = mergeServicioDetailIntoRaw(servicio, detail);
      setSelectedServicio((current) =>
        current?.raw.id === servicio.raw.id ? merged : current,
      );
      return merged;
    } catch (error) {
      console.error("Error loading service detail", error);
      toast.error("No fue posible cargar el detalle completo del servicio");
      return servicio;
    } finally {
      setSelectedServicioDetailLoading(false);
    }
  }, []);

  const invalidateServicioDetailCache = useCallback((servicioId: string) => {
    delete selectedServicioDetailCacheRef.current[servicioId];
  }, []);

  const handleDownloadTrabajoEvidenceImages = useCallback(
    async (servicio: Servicio) => {
      if (isDownloadingEvidenceImages) return;

      const evidenceImages = getTrabajoEvidenceImageDownloads(servicio.raw, servicio.id);

      if (evidenceImages.length === 0) {
        toast.info("Esta orden no tiene imágenes de evidencia del trabajo para descargar.");
        return;
      }

      const toastId = toast.loading(
        `Descargando ${evidenceImages.length} imagen${evidenceImages.length === 1 ? "" : "es"} de evidencia...`,
      );

      setIsDownloadingEvidenceImages(true);

      let downloaded = 0;
      let skipped = 0;
      let failed = 0;

      for (const evidence of evidenceImages) {
        try {
          const response = await fetch(evidence.url);

          if (!response.ok) {
            failed += 1;
            continue;
          }

          const blob = await response.blob();

          if (blob.type && !blob.type.toLowerCase().startsWith("image/")) {
            skipped += 1;
            continue;
          }

          const hasExtension = Boolean(getEvidenceExtension(evidence.filename));
          const filename = hasExtension
            ? evidence.filename
            : `${evidence.filename}.${getBlobImageExtension(blob.type || "", evidence.source)}`;

          downloadBlob(blob, filename);
          downloaded += 1;

          await new Promise((resolve) => window.setTimeout(resolve, 120));
        } catch (error) {
          console.error("Error downloading evidence image", error);
          failed += 1;
        }
      }

      setIsDownloadingEvidenceImages(false);

      if (downloaded > 0) {
        toast.success(
          skipped > 0 || failed > 0
            ? `${downloaded} imagen${downloaded === 1 ? "" : "es"} descargada${downloaded === 1 ? "" : "s"}. ${skipped + failed} archivo${skipped + failed === 1 ? "" : "s"} no se pudieron descargar como imagen.`
            : `${downloaded} imagen${downloaded === 1 ? "" : "es"} descargada${downloaded === 1 ? "" : "s"}.`,
          { id: toastId },
        );
        return;
      }

      toast.error("No fue posible descargar imágenes de evidencia para esta orden.", { id: toastId });
    },
    [isDownloadingEvidenceImages],
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !uploadConfig || isUploading) return;

    setIsUploading(true);
    const labelMap: Record<string, string> = {
      "facturaElectronica": "factura",
      "comprobantePago": "comprobante",
      "evidenciaPath": "evidencia"
    };
    const label = labelMap[uploadConfig.field] || "archivo";
    const toastId = toast.loading(`Subiendo ${label}...`);

    try {
      const kind =
        uploadConfig.field === "facturaElectronica"
          ? "facturaElectronica"
          : uploadConfig.field === "comprobantePago"
            ? "comprobantePago"
            : "evidencias";

      const uploadedPaths: string[] = [];
      for (const file of Array.from(files)) {
        const signed = await createSignedUploadUrl(uploadConfig.id, kind, file.name);
        await uploadToSupabaseSignedUrl(signed.path, signed.token, file);
        uploadedPaths.push(signed.path);
      }

      await confirmOrdenUpload(uploadConfig.id, kind, uploadedPaths);
      invalidateServicioDetailCache(uploadConfig.id);
      toast.success(
        uploadConfig.field === "evidenciaPath"
          ? `${uploadedPaths.length} evidencia(s) subida(s) exitosamente`
          : `${label.charAt(0).toUpperCase() + label.slice(1)} subida exitosamente`,
        { id: toastId },
      );
      
      invalidateServiciosListCache();
      const updatedList = await fetchServicios(false, { forceRefresh: true });
      if (updatedList.length > 0 && selectedServicio) {
        const refreshed = updatedList.find(s => s.raw.id === selectedServicio.raw.id);
        if (refreshed) setSelectedServicio(refreshed);
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(`Error al subir el archivo`, { id: toastId });
    } finally {
      setIsUploading(false);
      setUploadConfig(null);
      if (e.target) e.target.value = "";
    }
  };

  const handleLiquidar = async () => {
    if (!selectedServicio) return;

    let toastId: string | number | undefined;
    try {
      const transferenciasWithResolvedFiles = liquidarData.transferencias.map((transferencia) => ({
        ...transferencia,
        comprobanteFile:
          transferencia.comprobanteFile ??
          transferenciaFileInputRefs.current[transferencia.id]?.files?.[0] ??
          null,
      }));

      const processedBreakdown = liquidarData.breakdown.map(line => ({
        ...line,
        monto: parseCurrencyInput(line.monto),
      }));

      // Determinar si hay efectivo en el desglose
      const hasCash = processedBreakdown.some(
        (b) => normalizeMetodoPagoBase(b.metodo) === "EFECTIVO" && b.monto > 0,
      );
      const hasTransfer = processedBreakdown.some(
        (b) => normalizeMetodoPagoBase(b.metodo) === "TRANSFERENCIA" && b.monto > 0,
      );

      const canCloseLockedOrder = canCompleteOperationalLiquidation(
        selectedServicio.raw,
      ) && !hasTransfer;

      if (canCloseLockedOrder) {
        setIsUploading(true);
        toastId = toast.loading("Liquidando servicio...");

        await updateOrdenServicio(selectedServicio.raw.id, {
          estadoServicio: "LIQUIDADO",
          observacionFinal: liquidarData.observacionFinal || undefined,
        });
        invalidateServicioDetailCache(selectedServicio.raw.id);

        toast.success("Servicio liquidado exitosamente.", { id: toastId });
        invalidateServiciosListCache();
        const updatedList = await fetchServicios(false, { forceRefresh: true });
        if (updatedList.length > 0) {
          const refreshed = updatedList.find(
            (s) => s.raw.id === selectedServicio.raw.id,
          );
          if (refreshed) setSelectedServicio(refreshed);
        }
        setIsLiquidarModalOpen(false);
        return;
      }
      const storedTransferencias = transferenciasWithResolvedFiles.filter((transferencia) => transferencia.persisted);
      const storedTransferenciasToProcess = storedTransferencias;
      const draftTransferencias = transferenciasWithResolvedFiles.filter(
        (transferencia) => !transferencia.persisted,
      );
      const activeDraftTransferencias = draftTransferencias.filter((transferencia) => {
        const monto = parseCurrencyInput(transferencia.monto);

        return (
          monto > 0 ||
          transferencia.referenciaPago.trim().length > 0 ||
          transferencia.banco.trim().length > 0 ||
          transferencia.observacion.trim().length > 0 ||
          Boolean(transferencia.comprobanteFile)
        );
      });
      const hasExistingTransferProof =
        storedTransferencias.some((transferencia) => Boolean(transferencia.existingPath?.trim())) ||
        hasStoredTransferEvidence(selectedServicio.raw);
      const needsTransferProof = hasTransfer && !hasCash;

      if (needsTransferProof && !liquidarData.observacionFinal.trim()) {
        toast.error("La observación de cierre es obligatoria para registrar transferencias.");
        return;
      }

      if (needsTransferProof && activeDraftTransferencias.length === 0 && !hasExistingTransferProof) {
        toast.error("Debés registrar al menos una transferencia con comprobante para liquidar.");
        return;
      }

      const transferenciasPendientesPorCompletar = [
        ...storedTransferenciasToProcess,
        ...activeDraftTransferencias,
      ];

      const invalidTransferencia = transferenciasPendientesPorCompletar.find((transferencia) => {
        const monto = parseCurrencyInput(transferencia.monto);

        return (
          monto <= 0 ||
          !transferencia.fechaPago ||
          !transferencia.referenciaPago.trim() ||
          (!transferencia.comprobanteFile && !transferencia.existingPath)
        );
      });

      if (invalidTransferencia) {
        toast.error("Cada transferencia nueva debe tener monto, fecha, referencia y comprobante.");
        return;
      }

      if (hasTransfer && hasCash && activeDraftTransferencias.length === 0 && !hasExistingTransferProof) {
        toast(
          "El efectivo se registrará ahora y la transferencia quedará pendiente de soporte.",
          { icon: "ℹ️" },
        );
      }

      setIsUploading(true);
      toastId = toast.loading("Liquidando servicio...");

      const processedTransferencias: Array<{
        monto: number;
        comprobantePath: string;
        referenciaPago: string;
        fechaPago: string;
        banco?: string;
        observacion?: string;
      }> = [];

      for (const transferencia of [...storedTransferenciasToProcess, ...activeDraftTransferencias]) {
        let comprobantePath = transferencia.existingPath || "";

        if (transferencia.comprobanteFile) {
          const signed = await createSignedUploadUrl(
            selectedServicio.raw.id,
            "comprobantePago",
            transferencia.comprobanteFile.name,
          );
          await uploadToSupabaseSignedUrl(
            signed.path,
            signed.token,
            transferencia.comprobanteFile,
          );
          comprobantePath = signed.path;
        }

        processedTransferencias.push({
          monto: parseCurrencyInput(transferencia.monto),
          comprobantePath,
          referenciaPago: transferencia.referenciaPago.trim(),
          fechaPago: transferencia.fechaPago,
          banco: transferencia.banco.trim() || undefined,
          observacion: transferencia.observacion.trim() || undefined,
        });
      }

      const transferenciasPayload = processedTransferencias;

      const primaryTransferencia =
        transferenciasPayload[0] ||
        (storedTransferencias[0]
          ? {
              monto: parseCurrencyInput(storedTransferencias[0].monto),
              comprobantePath: storedTransferencias[0].existingPath || "",
              referenciaPago: storedTransferencias[0].referenciaPago.trim(),
              fechaPago: storedTransferencias[0].fechaPago,
              banco: storedTransferencias[0].banco.trim() || undefined,
              observacion: storedTransferencias[0].observacion.trim() || undefined,
            }
          : null);

      // Validación Temporal para Anticipos
      const now = new Date();
      const visitDate = selectedServicio.raw.fechaVisita ? new Date(selectedServicio.raw.fechaVisita) : null;
      const visitTime = selectedServicio.raw.horaInicio ? new Date(selectedServicio.raw.horaInicio) : null;
      let isFuture = false;

      if (visitDate) {
        const scheduledDateTime = new Date(visitDate);
        if (visitTime) scheduledDateTime.setHours(visitTime.getHours(), visitTime.getMinutes(), 0, 0);
        isFuture = scheduledDateTime > now;
      }

      // Lógica de Estado:
      // 1. Si es futuro -> Mantenemos el estado actual (es un ANTICIPO, el servicio no ha ocurrido)
      // 2. Si ya pasó y tiene efectivo -> TECNICO_FINALIZO (esperando conciliación)
      // 3. Si ya pasó y es 100% transferencia -> LIQUIDADO (cierre total)
      let nuevoEstado = selectedServicio.raw.estadoServicio || "PROGRAMADO";
      if (!isFuture) {
        nuevoEstado = hasCash ? "TECNICO_FINALIZO" : "LIQUIDADO";
      }

      await updateOrdenServicio(selectedServicio.raw.id, {
        desglosePago: processedBreakdown.map((line) => ({
          ...line,
          referencia:
            line.metodo === "TRANSFERENCIA"
              ? primaryTransferencia?.referenciaPago || line.referencia
              : line.referencia,
        })),
        observacionFinal: liquidarData.observacionFinal,
        fechaPago: primaryTransferencia?.fechaPago || undefined,
        comprobantePago: primaryTransferencia?.comprobantePath || undefined,
        referenciaPago: primaryTransferencia?.referenciaPago || undefined,
        transferencias:
          transferenciasPayload.length > 0 ? transferenciasPayload : undefined,
        confirmarMovimientoFinanciero: true,
        estadoServicio: nuevoEstado,
      });
      invalidateServicioDetailCache(selectedServicio.raw.id);

      let successMsg = "Pago registrado correctamente.";
      if (isFuture) successMsg = "Anticipo registrado. El servicio sigue programado.";
      else if (hasTransfer && hasCash && transferenciasPayload.length === 0 && !hasExistingTransferProof) {
        successMsg = "Efectivo registrado. La transferencia quedó pendiente de soporte.";
      }
      else if (nuevoEstado === "LIQUIDADO" && hasTransfer) successMsg = "Transferencia confirmada con soporte. Servicio liquidado exitosamente.";
      else if (nuevoEstado === "LIQUIDADO") successMsg = "Servicio liquidado exitosamente.";
      else if (hasTransfer) successMsg = "Transferencia confirmada. El recaudo en efectivo sigue pendiente.";
      else successMsg = "Recaudo registrado. Pendiente conciliación de efectivo.";

      toast.success(successMsg, { id: toastId });

      if (nuevoEstado === "LIQUIDADO") {
        notifyLiquidationWebhook({
          telefono: selectedServicio.clienteFull.telefono || "",
          cliente: selectedServicio.cliente,
          fecha: selectedServicio.fecha,
          servicio: selectedServicio.servicioEspecifico,
          idServicio: selectedServicio.raw.id,
        }).catch(err => console.error("Error notifying webhook:", err));
      }

      setIsLiquidarModalOpen(false);
      setLiquidarData({
        breakdown: [{ metodo: "PENDIENTE", monto: "" }],
        observacionFinal: "",
        transferencias: [createTransferenciaForm()],
      });
      
      invalidateServiciosListCache();
      const updatedList = await fetchServicios(false, { forceRefresh: true });
      if (updatedList.length > 0 && selectedServicio) {
        const refreshed = updatedList.find(s => s.raw.id === selectedServicio.raw.id);
        if (refreshed) setSelectedServicio(refreshed);
      }
    } catch (error) {
      console.error("Liquidation error:", error);
      const errorMessage =
        error instanceof Error && error.message.trim()
          ? error.message
          : "Error al procesar la liquidación";
      toast.error(errorMessage, toastId ? { id: toastId } : undefined);
    } finally {
      setIsUploading(false);
    }
  };

  const openLiquidationModalForServicio = useCallback((servicio: Servicio) => {
    const settlementMeta = getSettlementFlowMeta(servicio.raw);
    const currentBreakdown = servicio.raw.desglosePago && servicio.raw.desglosePago.length > 0
      ? servicio.raw.desglosePago.map(d => ({
          metodo: d.metodo,
          monto: d.monto.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "."),
          banco: toOptionalString(d.banco),
          referencia: toOptionalString(d.referencia),
          observacion: toOptionalString(d.observacion)
        }))
      : [{
          metodo: servicio.raw.metodoPago?.nombre || (settlementMeta.hasCash ? "EFECTIVO" : "TRANSFERENCIA"),
          monto: (servicio.raw.valorCotizado || "").toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
        }];

    setSelectedServicio(servicio);
    setLiquidarData({
      breakdown: currentBreakdown,
      observacionFinal: servicio.raw.observacionFinal || "",
      transferencias: getInitialTransferencias(servicio.raw),
    });
    setIsLiquidarModalOpen(true);
  }, []);

  const handleLiquidateAction = useCallback(async (servicio: Servicio) => {
    openLiquidationModalForServicio(servicio);
  }, [openLiquidationModalForServicio]);

  const fetchKpis = useCallback(async (options?: { refresh?: boolean }) => {
    setKpisLoading(true);
    try {
      const empresaId = getScopedEnterpriseId();
      const today = toBogotaYmd();
      const effectiveFilters =
        activePreset === "PAGO_PENDIENTE"
          ? {
              ...filters,
              estadoPago: "PENDIENTE",
              fechaFin:
                filters.fechaFin && filters.fechaFin < today
                  ? filters.fechaFin
                  : today,
            }
          : filters;
      const sinTecnicoFilterActive = isSinTecnicoFilter(effectiveFilters.tecnico);
      const data = await getServiciosKpis({
        empresaId,
        search: debouncedSearch,
        estado: effectiveFilters.estado,
        estadoPago: effectiveFilters.estadoPago,
        ...resolveMetodoPagoFilterQuery(effectiveFilters.metodoPago, filterOptions.metodosPago),
        tecnicoId: sinTecnicoFilterActive ? undefined : effectiveFilters.tecnico,
        sinTecnico: sinTecnicoFilterActive ? true : undefined,
        urgencia: effectiveFilters.urgencia,
        creadorId: effectiveFilters.creador,
        departamento: effectiveFilters.departamento,
        municipio: effectiveFilters.municipio,
        tipoVisita: effectiveFilters.tipo,
        fechaInicio: effectiveFilters.fechaInicio,
        fechaFin: effectiveFilters.fechaFin,
        preset: resolvedBackendPreset,
        refresh: options?.refresh ? true : undefined,
      });
      setKpis(data);
    } catch (error) {
      console.error("Error loading KPI data", error);
    } finally {
      setKpisLoading(false);
    }
  }, [activePreset, filters, getScopedEnterpriseId, resolvedBackendPreset, debouncedSearch, filterOptions.metodosPago]);

  const handleToggleKpis = () => {
    if (showKPIs) {
      setKpis(null);
    }
    setShowKPIs((current) => !current);
  };

  const handleRefreshKpis = () => {
    void fetchKpis({ refresh: true });
  };

  const fetchCustomPresets = useCallback(async () => {
    try {
      const data = await listDashboardPresets("SERVICIOS");
      setCustomPresets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading custom presets", error);
    }
  }, []);

  const buildServiciosPresetSnapshot = () => ({
    search,
    filters,
    activePreset,
    viewMode,
    scopeEmpresaId: getScopedEnterpriseId() ?? null,
  });

  const applyCustomPreset = (preset: DashboardPreset) => {
    const payload = (preset.filters || {}) as {
      search?: string;
      filters?: typeof filters;
      activePreset?: string;
      viewMode?: ViewMode;
      scopeEmpresaId?: string | null;
    };
    const currentScopeEmpresaId = getScopedEnterpriseId() ?? null;

    if (
      payload.scopeEmpresaId &&
      currentScopeEmpresaId &&
      payload.scopeEmpresaId !== currentScopeEmpresaId
    ) {
      toast.error("Este atajo pertenece a otra empresa.");
      return;
    }

    setSearch(payload.search || "");
    setFilters(normalizeServiciosFiltersState(payload.filters));
    setActivePreset(payload.activePreset || "all");
    setViewMode(payload.viewMode || "servicios");
    setCurrentPage(1);
  };

  const openCreatePresetModal = () => {
    setEditingPresetId(null);
    setPresetForm({
      name: "",
      colorToken: "sky",
      isShared: false,
    });
    setIsPresetModalOpen(true);
  };

  const openEditPresetModal = (preset: DashboardPreset) => {
    setEditingPresetId(preset.id);
    setPresetForm({
      name: preset.name,
      colorToken: preset.colorToken,
      isShared: preset.isShared,
    });
    setIsPresetModalOpen(true);
  };

  const handleSavePreset = async () => {
    if (!presetForm.name.trim()) {
      toast.error("El preset necesita un nombre");
      return;
    }

    try {
      if (editingPresetId) {
        await updateDashboardPreset(editingPresetId, {
          name: presetForm.name.trim(),
          colorToken: presetForm.colorToken,
          isShared: presetForm.isShared,
          filters: buildServiciosPresetSnapshot(),
        });
        toast.success("Preset actualizado");
      } else {
        await createDashboardPreset({
          module: "SERVICIOS",
          name: presetForm.name.trim(),
          colorToken: presetForm.colorToken,
          isShared: presetForm.isShared,
          filters: buildServiciosPresetSnapshot(),
        });
        toast.success("Preset creado");
      }
      setIsPresetModalOpen(false);
      fetchCustomPresets();
    } catch (error) {
      console.error("Error saving preset", error);
      toast.error("No fue posible guardar el preset");
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await deleteDashboardPreset(id);
      setCustomPresets((prev) => prev.filter((p) => p.id !== id));
      toast.success("Preset eliminado");
    } catch (error) {
      console.error("Error deleting preset", error);
      toast.error("No fue posible eliminar el preset");
    }
  };

  const loadAvailableEnterprises = useCallback(async () => {
    try {
      const items = await enterpriseClient.getAll();
      setAvailableEnterprises(items);
    } catch (error) {
      console.error("Error loading enterprises for export", error);
      toast.error("No fue posible cargar las empresas");
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        e.preventDefault();
        setShowOperationalQueue((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      serviciosAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasStateQueryParams = hasServiciosStateQueryParams(window.location.search);
    if (!hasStateQueryParams) {
      skipNextServiciosUiCacheWriteRef.current = true;
      const cachedState = readServiciosUiCache(serviciosUiCacheKey, scopedEnterpriseId);
      const requestedTab = searchParams.get("tab");
      if (cachedState) {
        setSearch(cachedState.search);
        setViewMode(
          requestedTab === "seguimientos" ? "seguimientos" : cachedState.viewMode,
        );
        setActivePreset(cachedState.activePreset);
        setActiveOperationalFilter(cachedState.activeOperationalFilter);
        setCurrentPage(cachedState.currentPage);
        setFilters(cachedState.filters);
      } else if (requestedTab === "seguimientos") {
        setViewMode("seguimientos");
      }
    }

    setHasRestoredUiState(true);
    setRestoredServiciosUiCacheKey(serviciosUiCacheKey);
  }, [scopedEnterpriseId, searchParams, serviciosUiCacheKey]);

  useEffect(() => {
    if (activePreset === normalizedActivePreset) return;
    setActivePreset(normalizedActivePreset);
  }, [activePreset, normalizedActivePreset]);

  useEffect(() => {
    if (showFilters) return;
    setFilterDraft(filters);
  }, [filters, showFilters]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    if (!isServiciosUiStateReady || typeof window === "undefined") return;

    const nextParams = new URLSearchParams();
    if (search) nextParams.set("search", search);
    if (viewMode !== "servicios") nextParams.set("tab", viewMode);
    if (activePreset !== "all") nextParams.set("preset", activePreset);
    if (filters.estado !== "all") nextParams.set("estado", filters.estado);
    if (filters.estadoPago !== "all") nextParams.set("estadoPago", filters.estadoPago);
    if (filters.metodoPago !== "all") nextParams.set("metodoPago", filters.metodoPago);
    if (filters.tecnico !== "all") nextParams.set("tecnico", filters.tecnico);
    if (filters.urgencia !== "all") nextParams.set("urgencia", filters.urgencia);
    if (filters.creador !== "all") nextParams.set("creador", filters.creador);
    if (filters.departamento !== "all") nextParams.set("departamento", filters.departamento);
    if (filters.municipio !== "all") nextParams.set("municipio", filters.municipio);
    if (filters.tipo !== "all") nextParams.set("tipo", filters.tipo);
    if (filters.fechaInicio) nextParams.set("fechaInicio", filters.fechaInicio);
    if (filters.fechaFin) nextParams.set("fechaFin", filters.fechaFin);

    const nextQuery = nextParams.toString();
    const currentQuery = window.location.search.replace(/^\?/, "");
    if (nextQuery !== currentQuery) {
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      window.history.replaceState(window.history.state, "", nextUrl);
    }
  }, [activePreset, filters, isServiciosUiStateReady, pathname, search, viewMode]);

  useEffect(() => {
    if (!isServiciosUiStateReady || typeof window === "undefined") return;

    const nextState: ServiciosUiCacheState = {
      scopeEmpresaId: scopedEnterpriseId,
      search,
      viewMode,
      activePreset,
      activeOperationalFilter,
      currentPage,
      filters,
    };

    const isDefaultState =
      nextState.search === "" &&
      nextState.viewMode === "servicios" &&
      nextState.activePreset === "all" &&
      nextState.activeOperationalFilter === null &&
      nextState.currentPage === 1 &&
      Object.entries(SERVICIOS_FILTER_DEFAULTS).every(
        ([key, value]) => nextState.filters[key as keyof ServiciosFiltersState] === value,
      );

    if (isDefaultState) {
      skipNextServiciosUiCacheWriteRef.current = false;
      window.localStorage.removeItem(serviciosUiCacheKey);
      return;
    }

    if (skipNextServiciosUiCacheWriteRef.current) {
      skipNextServiciosUiCacheWriteRef.current = false;
      return;
    }

    window.localStorage.setItem(serviciosUiCacheKey, JSON.stringify(nextState));
  }, [
    activeOperationalFilter,
    activePreset,
    currentPage,
    filters,
    isServiciosUiStateReady,
    search,
    scopedEnterpriseId,
    serviciosUiCacheKey,
    viewMode,
  ]);

  useEffect(() => {
    if (activeOperationalFilter) {
      // Logic handled in filteredServicios
    }
  }, [activeOperationalFilter]);

  useEffect(() => {
    if (!isServiciosUiStateReady) return;
    fetchServicios();
  }, [fetchServicios, isServiciosUiStateReady]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  useEffect(() => {
    if (!isServiciosUiStateReady) return;
    if (!showKPIs) return;
    fetchKpis();
  }, [fetchKpis, isServiciosUiStateReady, showKPIs]);

  useEffect(() => {
    fetchCustomPresets();
  }, [fetchCustomPresets]);

  useEffect(() => {
    if (!isExportModalOpen || availableEnterprises.length > 0) return;
    void loadAvailableEnterprises();
  }, [availableEnterprises.length, isExportModalOpen, loadAvailableEnterprises]);

  useEffect(() => {
    if (!selectedServicio) return;
    if (!(isModalOpen || isVisitaModalOpen || isViewLiquidationModalOpen)) return;
    if (hasServicioDetailLoaded(selectedServicio)) return;

    void ensureSelectedServicioDetail(selectedServicio);
  }, [
    ensureSelectedServicioDetail,
    isModalOpen,
    isVisitaModalOpen,
    isViewLiquidationModalOpen,
    selectedServicio,
  ]);

  const updateFilters = useCallback(
    (
      updater: typeof filters | ((prev: typeof filters) => typeof filters),
    ) => {
      setCurrentPage(1);
      setFilters(updater);
    },
    [],
  );

  const updateFilterDraft = useCallback(
    (
      updater:
        | ServiciosFiltersState
        | ((prev: ServiciosFiltersState) => ServiciosFiltersState),
    ) => {
      setFilterDraft(updater);
    },
    [],
  );

  const toggleDraftMetodoPagoFilter = useCallback((value: string) => {
    updateFilterDraft((currentFilters) => {
      const selectedValues = new Set(parseMetodoPagoFilterValue(currentFilters.metodoPago));

      if (selectedValues.has(value)) {
        selectedValues.delete(value);
      } else {
        selectedValues.add(value);
      }

      return {
        ...currentFilters,
        metodoPago: stringifyMetodoPagoFilterValue(Array.from(selectedValues)),
      };
    });
  }, [updateFilterDraft]);

  const openFiltersSheet = useCallback(() => {
    setFilterDraft(filters);
    setShowFilters(true);
  }, [filters]);

  const applyFilterDraft = useCallback(() => {
    setCurrentPage(1);
    setFilters(filterDraft);
    setShowFilters(false);
  }, [filterDraft]);

  const clearFilterDraft = useCallback(() => {
    const defaultFilters = { ...SERVICIOS_FILTER_DEFAULTS };
    skipNextServiciosUiCacheWriteRef.current = false;
    clearServiciosUiCache();
    invalidateServiciosListCache();
    setFilterDraft(defaultFilters);
    setActivePreset("all");
    setActiveOperationalFilter(null);
    updateFilters(defaultFilters);
  }, [clearServiciosUiCache, invalidateServiciosListCache, updateFilters]);

  const draftFilteredMunicipalityOptions = useMemo(() => {
    if (filterDraft.departamento === "all") return [];
    return filterOptions.municipios.filter(
      (municipio) => municipio.departmentId === filterDraft.departamento,
    );
  }, [filterDraft.departamento, filterOptions.municipios]);

  const applyPreset = (preset: string) => {
    setCurrentPage(1);
    setActivePreset(preset);

    const today = toBogotaYmd();
    const tomorrow = addDaysToYmd(today, 1);
    const baseFilters = { ...SERVICIOS_FILTER_DEFAULTS };

    if (preset === "HOY") {
      updateFilters({ ...baseFilters, fechaInicio: today, fechaFin: today });
      return;
    }

    if (preset === "MANANA") {
      updateFilters({ ...baseFilters, fechaInicio: tomorrow, fechaFin: tomorrow });
      return;
    }

    if (preset === "SEMANA") {
      const start = startOfBogotaWeekYmd(today);
      const end = addDaysToYmd(start, 6);
      updateFilters({
        ...baseFilters,
        fechaInicio: start,
        fechaFin: end,
      });
      return;
    }

    if (preset === "PAGO_PENDIENTE") {
      updateFilters({
        ...baseFilters,
        estadoPago: "PENDIENTE",
        fechaFin: today,
      });
      return;
    }

    if (preset === "SIN_TECNICO") {
      updateFilters(baseFilters);
      return;
    }

    if (preset === "PENDIENTES_LIQUIDAR") {
      updateFilters({ ...baseFilters, estado: "TECNICO_FINALIZO" });
      return;
    }

    if (preset === "VENCIDOS") {
      updateFilters({ ...baseFilters, fechaFin: today });
      return;
    }

    updateFilters(baseFilters);
  };

  const resetAllFilters = useCallback(() => {
    skipNextServiciosUiCacheWriteRef.current = false;
    clearServiciosUiCache();
    invalidateServiciosListCache();
    setSearch("");
    setActivePreset("all");
    setActiveOperationalFilter(null);
    setCurrentPage(1);
    updateFilters({
      ...SERVICIOS_FILTER_DEFAULTS,
    });
    toast.info("Filtros restablecidos");
  }, [clearServiciosUiCache, invalidateServiciosListCache, updateFilters]);

  const hasActiveFilters = search !== "" ||
    activePreset !== "all" ||
    activeOperationalFilter !== null ||
    filters.estado !== "all" ||
    filters.estadoPago !== "all" ||
    filters.metodoPago !== "all" ||
    filters.tecnico !== "all" ||
    filters.urgencia !== "all" ||
    filters.creador !== "all" ||
    filters.departamento !== "all" ||
    filters.municipio !== "all" ||
    filters.empresa !== "all" ||
    filters.tipo !== "all" ||
    filters.fechaInicio !== "" ||
    filters.fechaFin !== "";

  const activeFilterCount = useMemo(
    () =>
      Object.entries(SERVICIOS_FILTER_DEFAULTS).reduce((count, [key, value]) => {
        const currentValue = filters[key as keyof ServiciosFiltersState];
        return currentValue !== value ? count + 1 : count;
      }, 0),
    [filters],
  );

  const draftFilterCount = useMemo(
    () =>
      Object.entries(SERVICIOS_FILTER_DEFAULTS).reduce((count, [key, value]) => {
        const currentValue = filterDraft[key as keyof ServiciosFiltersState];
        return currentValue !== value ? count + 1 : count;
      }, 0),
    [filterDraft],
  );

  const visibleServicios = useMemo(
    () =>
      servicios.filter((servicio) => {
        if (activePreset !== "PAGO_PENDIENTE") {
          return true;
        }

        const visitType = normalizeVisitType(servicio.raw.tipoVisita);
        const paymentStatus = servicio.raw.estadoPago?.trim().toUpperCase();

        return (
          paymentStatus === "PENDIENTE" &&
          visitType !== "NO_CONCRETADO" &&
          !isServicioScheduledInFuture(servicio.raw)
        );
      }),
    [activePreset, servicios],
  );

  const followUpRows: FollowUpRow[] = useMemo(
    () =>
      viewMode === "seguimientos"
        ? visibleServicios.map((os) => ({
            ...os,
            parentId: os.raw.ordenPadreId || "",
            parentNumero:
              os.raw.ordenPadre?.numeroOrden ||
              os.raw.ordenPadreId?.substring(0, 8).toUpperCase() ||
              "",
            parentCliente: os.cliente,
            parentServicio: os.servicioEspecifico,
          }))
        : [],
    [viewMode, visibleServicios],
  );

  const activeRows =
    viewMode === "seguimientos" ? followUpRows : visibleServicios;

  // Since we use server-side pagination, we don't need to filter or slice locally for the main list
  // The API already returned the correct page based on search and filters
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedServicios = visibleServicios;
  const paginatedFollowUps = followUpRows;

  const selectedPendingFollowUps = useMemo(
    () => (selectedFollowUp ? getPendingFollowUpRecords(selectedFollowUp.raw) : []),
    [selectedFollowUp],
  );

  const selectedCompletedFollowUps = useMemo(
    () => (selectedFollowUp ? getCompletedFollowUpRecords(selectedFollowUp.raw) : []),
    [selectedFollowUp],
  );

  const selectedFollowUpRecord = useMemo(() => {
    if (!selectedFollowUp) return null;

    return (
      getFollowUpRecords(selectedFollowUp.raw).find(
        (item) => item.id === selectedFollowUpRecordId,
      ) ||
      selectedPendingFollowUps[0] ||
      selectedCompletedFollowUps[0] ||
      null
    );
  }, [
    selectedCompletedFollowUps,
    selectedFollowUp,
    selectedFollowUpRecordId,
    selectedPendingFollowUps,
  ]);

  const isManagingPendingFollowUp =
    selectedFollowUpRecord?.status === "PENDIENTE" || !selectedFollowUpRecord;

  const latestSelectedCompletedFollowUp = selectedCompletedFollowUps[0] || null;
  const hasLatestSelectedRejection =
    latestSelectedCompletedFollowUp?.status === "RECHAZADO";

  const toUtcIsoFromDateTimeLocal = (value: string) => {
    const [datePart, timePart] = value.split("T");
    if (!datePart || !timePart) return "";
    return bogotaDateTimeToUtcIso(datePart, timePart);
  };

  const getCurrentDateTimeLocalValue = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const min = String(now.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const formatDateTimeLocalValue = (value?: string | null) => {
    if (!value) return getCurrentDateTimeLocalValue();

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return getCurrentDateTimeLocalValue();

    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  };

  const buildFollowUpFormState = (targetRecord?: FollowUpRecord | null) => ({
    contactedAt: formatDateTimeLocalValue(targetRecord?.contactedAt),
    channel: targetRecord?.channel || "LLAMADA",
    outcome: targetRecord?.outcome || "CONTACTADO",
    resolution: (targetRecord?.status === "RECHAZADO" ? "RECHAZADO" : "ACEPTADO") as
      | "ACEPTADO"
      | "RECHAZADO",
    notes: targetRecord?.notes || "",
    nextActionAt: "",
  });

  const syncSelectedFollowUpRecord = (
    followUp: FollowUpRow,
    recordId?: string | null,
  ) => {
    const allRecords = getFollowUpRecords(followUp.raw);
    const pendingRecords = getPendingFollowUpRecords(followUp.raw);
    const completedRecords = getCompletedFollowUpRecords(followUp.raw);

    const targetRecord =
      (recordId ? allRecords.find((item) => item.id === recordId) : null) ||
      pendingRecords[0] ||
      completedRecords[0] ||
      null;

    const sourceRecord =
      targetRecord?.status === "PENDIENTE"
        ? completedRecords[0] || targetRecord
        : targetRecord;

    setSelectedFollowUpRecordId(targetRecord?.id ?? null);
    setFollowUpForm(buildFollowUpFormState(sourceRecord));
  };

  const openFollowUpModal = (followUp: FollowUpRow, recordId?: string | null) => {
    setSelectedFollowUp(followUp);
    syncSelectedFollowUpRecord(followUp, recordId);
    setIsFollowUpModalOpen(true);
  };

  const handleCompleteFollowUp = async () => {
    if (!selectedFollowUp) return;
    if (!followUpForm.contactedAt || !followUpForm.channel || !followUpForm.outcome || !followUpForm.notes.trim()) {
      toast.error("Completa fecha, canal, resultado y notas del seguimiento");
      return;
    }

    setSavingFollowUp(true);
    try {
      await completeFollowUp(selectedFollowUpRecord?.id || selectedFollowUp.raw.id, {
        contactedAt: toUtcIsoFromDateTimeLocal(followUpForm.contactedAt),
        channel: followUpForm.channel,
        outcome: followUpForm.outcome,
        resolution: followUpForm.resolution,
        notes: followUpForm.notes.trim(),
        nextActionAt: isManagingPendingFollowUp && followUpForm.nextActionAt
          ? toUtcIsoFromDateTimeLocal(followUpForm.nextActionAt)
          : undefined,
      });

      invalidateServiciosListCache();
      await fetchServicios(false, { forceRefresh: true });
      toast.success(
        isManagingPendingFollowUp
          ? "Seguimiento registrado correctamente"
          : "Llamada actualizada correctamente",
      );
      setIsFollowUpModalOpen(false);
      setSelectedFollowUp(null);
      setSelectedFollowUpRecordId(null);
    } catch (error) {
      console.error("Error completing follow-up", error);
      toast.error(error instanceof Error ? error.message : "No se pudo registrar el seguimiento");
    } finally {
      setSavingFollowUp(false);
    }
  };

  const toggleFollowUpsRow = (servicioId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [servicioId]: !prev[servicioId],
    }));
  };

  const handleCopy = (servicio: Servicio) => {
    const address = getServicioAddress(servicio.raw);
    const formattedValorCotizado = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    }).format(servicio.raw.valorCotizado || 0);
    const serviciosSeleccionados = Array.isArray(servicio.raw.serviciosSeleccionados)
      ? servicio.raw.serviciosSeleccionados
          .map((item) => item?.trim())
          .filter((item): item is string => Boolean(item))
      : [];
    const servicioPrincipal = servicio.servicioEspecifico || resolveServicioDisplayName(servicio.raw);

    const serviceFields = [
      `Servicio específico: ${servicioPrincipal || "N/A"}`,
      serviciosSeleccionados.length > 0
        ? `Servicios específicos: ${serviciosSeleccionados.join(", ")}`
        : null,
      `Tipo de visita: ${formatVisitTypeLabel(servicio.raw.tipoVisita)}`,
      `Estado servicio: ${servicio.estadoServicio || servicio.raw.estadoServicio || "N/A"}`,
      `Urgencia: ${servicio.urgencia || "N/A"}`,
      servicio.raw.tipoFacturacion && `Tipo facturación: ${servicio.raw.tipoFacturacion}`,
    ].filter((value): value is string => Boolean(value));

    const addressFields = [
      `Dirección principal: ${address.direccionTexto || "No especificada"}`,
      address.barrio && `Barrio: ${address.barrio}`,
      address.municipio && `Municipio: ${address.municipio}`,
      `Bloque / Torre / Conjunto: ${address.bloque || "No Concretado"}`,
      `Apto / Piso / Local: ${address.piso || "No Concretado"}`,
      `Unidad / Edificio / Vereda: ${address.unidad || "No Concretado"}`,
      `Link Maps: ${address.linkMaps || "No Concretado"}`,
    ].filter((value): value is string => Boolean(value));

    const observationFields = [
      servicio.raw.diagnosticoTecnico && `Diagnóstico técnico: ${servicio.raw.diagnosticoTecnico}`,
    ].filter((value): value is string => Boolean(value));

    const text = [
      `*ORDEN DE SERVICIO:* #${servicio.raw.numeroOrden || servicio.id}`,
      "",
      `*Cliente:* ${servicio.cliente}`,
      `*Empresa:* ${servicio.raw.empresa?.nombre || "N/A"}`,
      `*Programación:* ${servicio.fecha} a las ${servicio.hora}`,
      `*Técnico:* ${servicio.tecnico}`,
      "",
      "*SERVICIO*",
      ...serviceFields.map((field) => `• ${field}`),
      "",
      "*DIRECCIÓN*",
      ...addressFields.map((field) => `• ${field}`),
      "",
      "*FINANZAS*",
      `• Método pago: ${servicio.raw.metodoPago?.nombre || "N/A"}`,
      `• Valor cotizado: ${formattedValorCotizado}`,
      "",
      "*OBSERVACIONES Y DETALLES TÉCNICOS*",
      ...(observationFields.length > 0
        ? observationFields.map((field) => `• ${field}`)
        : ["• Sin observaciones registradas"]),
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => toast.success("Información copiada")).catch(() => toast.error("Error al copiar"));
  };

  const handleNotifyOperator = async (servicio: Servicio) => {
    const tecnicoId = servicio.raw.tecnicoId;
    if (!tecnicoId) { toast.error("No hay un técnico asignado"); return; }
    const toastId = toast.loading(`Notificando al técnico...`);
    try {
      const ops = await getOperators(servicio.raw.empresaId);
      const operator = (Array.isArray(ops) ? ops : []).find((o) => o.id === tecnicoId);
      if (!operator?.telefono) { toast.error("El técnico no tiene teléfono registrado", { id: toastId }); return; }
      const os = servicio.raw;
      const dateObj = os.fechaVisita && os.horaInicio ? new Date(os.horaInicio) : new Date();
      const operatorName = operator.nombre || `${operator.user?.nombre || ""} ${operator.user?.apellido || ""}`.trim() || "TECNICO";
      const res = await notifyServiceOperatorWebhook({
        telefonoOperador: operator.telefono,
        numeroOrden: `#${os.numeroOrden || os.id.slice(0, 8).toUpperCase()}`,
        cliente: servicio.cliente,
        servicio: servicio.servicioEspecifico.toUpperCase(),
        programacion: `${formatBogotaDate(dateObj)} a las ${formatBogotaTime(dateObj, "es-CO", { hour: "numeric", minute: "2-digit" })}`,
        tecnico: operatorName,
        estado: os.estadoServicio || "NUEVO",
        urgencia: os.urgencia || "BAJA",
        direccion: os.direccionTexto || "N/A",
        linkMaps: os.linkMaps || "N/A",
        municipio: os.municipio || "N/A",
        barrio: os.barrio || "N/A",
        detalles: [os.bloque && `B: ${os.bloque}`, os.piso && `P: ${os.piso}`, os.unidad && `U: ${os.unidad}`].filter(Boolean).join(" - ") || "N/A",
        valorCotizado: new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(os.valorCotizado || 0),
        metodosPago: os.metodoPago?.nombre || "Pendiente",
        idServicio: os.id,
        observaciones: os.observacion || "Sin observaciones"
      });
      if (res.success) toast.success("Técnico notificado", { id: toastId });
      else toast.error("Error al notificar", { id: toastId });
    } catch (_error) { toast.error("Error al procesar notificación", { id: toastId }); }
  };

  const openDeleteModal = (servicio: Servicio) => {
    setDeleteTarget(servicio);
    setDeleteReason("");
    setIsDeleteModalOpen(true);
  };

  const filteredExportEnterprises = useMemo(() => {
    const searchToken = exportEmpresaSearch.trim().toLowerCase();
    if (!searchToken) return availableEnterprises;
    return availableEnterprises.filter((empresa) =>
      empresa.nombre.toLowerCase().includes(searchToken),
    );
  }, [availableEnterprises, exportEmpresaSearch]);

  const toggleExportEmpresa = (empresaId: string) => {
    setExportEmpresaIds((prev) =>
      prev.includes(empresaId)
        ? prev.filter((id) => id !== empresaId)
        : [...prev, empresaId],
    );
  };

  const resetExportModal = useCallback(() => {
    setExportEnterpriseMode("all");
    setExportEmpresaIds([]);
    setExportEmpresaSearch("");
    setExportPreset("none");
    setExportDateRange({
      fechaInicio: "",
      fechaFin: "",
    });
  }, []);

  const handleExportExcel = async () => {
    if (isExportingExcel || !canExportServices) return;

    if (
      exportDateRange.fechaInicio &&
      exportDateRange.fechaFin &&
      exportDateRange.fechaInicio > exportDateRange.fechaFin
    ) {
      toast.error("La fecha inicial no puede ser mayor a la fecha final");
      return;
    }

    if (exportEnterpriseMode === "selected" && exportEmpresaIds.length === 0) {
      toast.error("Selecciona al menos una empresa");
      return;
    }

    setIsExportingExcel(true);
    const toastId = toast.loading("Generando Excel...");

    try {
      const selectedExportPreset =
        exportPreset !== "none" ? (exportPreset as ExportPresetValue) : undefined;
      const today = toBogotaYmd();
      const tomorrow = addDaysToYmd(today, 1);
      const presetDateRange =
        selectedExportPreset && DATE_EXPORT_PRESETS.has(selectedExportPreset)
          ? selectedExportPreset === "HOY"
            ? { fechaInicio: today, fechaFin: today }
            : selectedExportPreset === "MANANA"
              ? { fechaInicio: tomorrow, fechaFin: tomorrow }
              : {
                  fechaInicio: startOfBogotaWeekYmd(today),
                  fechaFin: addDaysToYmd(startOfBogotaWeekYmd(today), 6),
                }
          : null;
      const servicePreset =
        selectedExportPreset && SERVICE_ONLY_EXPORT_PRESETS.has(selectedExportPreset)
          ? selectedExportPreset
          : !selectedExportPreset && SERVICE_ONLY_EXPORT_PRESETS.has(normalizedActivePreset as ExportPresetValue)
            ? (normalizedActivePreset as ExportPresetValue)
            : undefined;
      const baseExportPayload: ExportOrdenesServicioPayload = {
        includeAllEmpresas: exportEnterpriseMode === "all",
        empresaIds: exportEnterpriseMode === "selected" ? exportEmpresaIds : undefined,
        fechaInicio:
          exportDateRange.fechaInicio ||
          presetDateRange?.fechaInicio ||
          filters.fechaInicio ||
          undefined,
        fechaFin:
          exportDateRange.fechaFin ||
          presetDateRange?.fechaFin ||
          filters.fechaFin ||
          undefined,
        search: search.trim() || undefined,
        estado: filters.estado !== "all" ? filters.estado : undefined,
        estadoPago: filters.estadoPago !== "all" ? filters.estadoPago : undefined,
        ...resolveMetodoPagoExportPayload(filters.metodoPago, filterOptions.metodosPago),
        tecnicoId:
          filters.tecnico !== "all" && !isSinTecnicoFilter(filters.tecnico)
            ? filters.tecnico
            : undefined,
        sinTecnico: isSinTecnicoFilter(filters.tecnico) ? true : undefined,
        urgencia: filters.urgencia !== "all" ? filters.urgencia : undefined,
        creadorId: filters.creador !== "all" ? filters.creador : undefined,
        departamento: filters.departamento !== "all" ? filters.departamento : undefined,
        municipio: filters.municipio !== "all" ? filters.municipio : undefined,
        tipoVisita: filters.tipo !== "all" ? filters.tipo : undefined,
      };

      const serviceExportRows = await exportOrdenesServicio({
        ...baseExportPayload,
        ...(servicePreset ? { preset: servicePreset } : {}),
      });

      const serviceRows = serviceExportRows;
      const exportFilenameRange =
        baseExportPayload.fechaInicio || baseExportPayload.fechaFin
          ? `${baseExportPayload.fechaInicio || "inicio"}_${baseExportPayload.fechaFin || "fin"}`
          : toBogotaYmd();

      await exportMultiToExcel({
        datasets: [
          {
            sheetName: "Servicios",
            title: "Reporte operativo de servicios",
            headers: [
              "Nro. Orden",
              "Estado",
              "Fecha Creación",
              "Empresa",
              "Cliente",
              "Documento Cliente",
              "Teléfono Cliente",
              "Correo Cliente",
              "Servicio",
              "Tipo Servicio",
              "Zona",
              "OPERADOR",
              "Creado Por",
              "Dirección",
              "Link Maps",
              "Municipio",
              "Departamento",
              "Barrio",
              "Unidad",
              "Bloque",
              "Piso",
              "Fecha visita",
              "Hora visita",
              "Valor cotizado",
              "Valor cobrado",
              "Método pago",
              "Observaciones",
            ],
            data: serviceRows.map((row: ServicioExportRow) => [
              row.numeroOrden,
              row.estadoServicio || "",
              formatBogotaDateTime(row.creadaEn),
              row.empresa,
              row.cliente,
              row.documentoCliente || "",
              buildExportPhonesLabel(row),
              row.correoCliente || "",
              row.serviciosSeleccionados || row.servicio,
              formatVisitTypeLabel(row.tipoServicio || row.tipoVisita),
              row.zona || "",
              row.tecnico,
              row.creador,
              row.direccion || "",
              row.linkMaps || "",
              row.municipio || "",
              row.departamento || "",
              row.barrio || "",
              row.unidad || "",
              row.bloque || "",
              row.piso || "",
              row.fechaVisita ? formatBogotaDate(row.fechaVisita) : "",
              row.horaInicio ? formatBogotaTime(row.horaInicio) : "",
              row.valorCotizado,
              row.valorPagado,
              row.metodoPago,
              buildExportObservationsLabel(row),
            ]),
            columnWidths: [
              14, 16, 20, 22, 28, 20, 24, 30, 26, 18, 18, 24, 24, 38,
              32, 18, 18, 18, 16, 14, 12, 14, 12, 16, 16, 20, 56,
            ],
            wrapTextColumns: [7, 13, 14, 26],
            currencyColumns: [23, 24],
            hyperlinkColumns: [14],
            variant: "simple",
          },
        ],
        filename: `servicios_${exportFilenameRange}`,
        mainTitle: "Reporte de órdenes de servicio",
      });

      toast.success(
        `Excel generado con ${serviceRows.length} servicio(s)`,
        { id: toastId },
      );
      setIsExportModalOpen(false);
      resetExportModal();
    } catch (error) {
      console.error("Error exporting services", error);
      toast.error("No fue posible generar el Excel", { id: toastId });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const closeDeleteModal = (force = false) => {
    if (isDeletingServicio && !force) return;
    setIsDeleteModalOpen(false);
    setDeleteTarget(null);
    setDeleteReason("");
  };

  const handleDeleteServicio = async () => {
    if (!deleteTarget) return;

    const reason = deleteReason.trim();
    if (!reason) {
      toast.error("La observación de anulación es obligatoria");
      return;
    }

    setIsDeletingServicio(true);
    const toastId = toast.loading("Anulando servicio...");

    try {
      await deleteOrdenServicio(deleteTarget.raw.id, reason);
      toast.success("Servicio anulado correctamente", { id: toastId });

      if (selectedServicio?.raw.id === deleteTarget.raw.id) {
        setSelectedServicio(null);
        setIsModalOpen(false);
      }

      closeDeleteModal(true);
      invalidateServiciosListCache();
      await fetchServicios(false, { forceRefresh: true });
      if (showKPIs) {
        void fetchKpis({ refresh: true });
      } else {
        setKpis(null);
      }
    } catch (error) {
      console.error("Error deleting service", error);
      toast.error(
        error instanceof Error ? error.message : "No fue posible anular el servicio",
        { id: toastId },
      );
    } finally {
      setIsDeletingServicio(false);
    }
  };

  const isSixSeven = search === "67";
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }),
    [],
  );
  const serviciosKpiCards = useMemo(
    () => [
      { label: "Total", val: kpis?.total ?? 0, icon: FileText, color: "bg-primary", preset: "all" },
      { label: "Prog. Hoy", val: kpis?.programadosHoy ?? 0, icon: Calendar, color: "bg-[#01ADFB]", preset: "HOY" },
      { label: "En Curso", val: kpis?.enCurso ?? 0, icon: Activity, color: "bg-[#01ADFB]", preset: "all" },
      { label: "Vencidos", val: kpis?.vencidosSla ?? 0, icon: AlertCircle, color: "bg-muted-foreground", preset: "VENCIDOS" },
      { label: "% SLA", val: `${(kpis?.cumplimientoSlaPct ?? 0).toFixed(1)}%`, icon: CheckCircle2, color: "bg-primary", preset: "all" },
      { label: "Recaudo Hoy", val: currencyFormatter.format(kpis?.recaudoHoy ?? 0), icon: CreditCard, color: "bg-[#01ADFB]", preset: "HOY" },
      { label: "Sin Evid.", val: kpis?.sinEvidencia ?? 0, icon: XCircle, color: "bg-muted-foreground", preset: "all" },
    ],
    [currencyFormatter, kpis],
  );

  if (isLoadingRole) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">
        Validando permisos...
      </div>
    );
  }

  if (!canViewServices) {
    return null;
  }

  return (
    <DashboardLayout overflowHidden>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes six-seven-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-40px); }
        }
        .animate-six-seven {
          animation: six-seven-bounce 0.4s infinite ease-in-out;
        }
      `}} />
      <div className={cn("flex flex-col h-full bg-background transition-all duration-500", isSixSeven && "animate-six-seven")}>
        <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/40 text-muted-foreground">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-medium tracking-tight text-foreground">
                  Órdenes de servicio
                </h1>
                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                  Control operativo y trazabilidad de servicios técnicos
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                onClick={handleTriggerJob}
                disabled={isProcessingJob}
                variant="outline"
                className={cn(
                  servicesHeaderActionClass,
                  "border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB] hover:bg-[#01ADFB]/15 hover:text-[#01ADFB]",
                )}
              >
                <RotateCcw className={cn("h-3.5 w-3.5", isProcessingJob && "animate-spin")} />
                Procesar refuerzos
              </Button>
              <Button
                onClick={() => setShowOperationalQueue(true)}
                className="h-8 flex-1 rounded-[4px] border-none bg-amber-500 px-3 text-[10px] font-medium tracking-[0.08em] text-white shadow-sm shadow-amber-500/20 transition-colors hover:bg-amber-600 sm:flex-none"
              >
                <Zap className="h-3.5 w-3.5 fill-current" />
                Cola operativa
                {operationalCounts.atrasados + operationalCounts.sinAsignarHoy + operationalCounts.conIncidencia > 0 && (
                  <span className="ml-1 rounded-[4px] bg-white px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
                    {operationalCounts.atrasados + operationalCounts.sinAsignarHoy + operationalCounts.conIncidencia}
                  </span>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={handleToggleKpis} className={servicesHeaderActionClass}>
                {showKPIs ? <><EyeOff className="h-3.5 w-3.5" /> Ocultar KPI</> : <><Eye className="h-3.5 w-3.5" /> Ver KPI</>}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 px-4 py-4 sm:px-6 lg:px-10">
          <div className="max-w-[1600px] mx-auto w-full h-full flex flex-col">
            {loading ? <ServiciosSkeleton showKPIs={showKPIs} /> : (
              <>
                {showKPIs && (
                  <div className={cn("mb-3 shrink-0 p-3", servicesPanelClass)}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          Indicadores de servicios
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          Resumen operativo de la vista actual.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleRefreshKpis}
                        disabled={kpisLoading}
                        className="h-8 shrink-0 rounded-[4px] px-3 text-[10px] font-medium tracking-[0.08em]"
                      >
                        <RotateCcw className={cn("h-3.5 w-3.5", kpisLoading && "animate-spin")} />
                        Actualizar
                      </Button>
                    </div>

                    {!kpis ? (
                      <div className="grid min-w-max grid-flow-col auto-cols-[minmax(132px,1fr)] gap-2 overflow-x-auto pb-1 lg:min-w-0 lg:grid-flow-row lg:grid-cols-7">
                        {Array.from({ length: 7 }).map((_, index) => (
                          <div key={index} className="min-h-[62px] rounded-[4px] border border-border bg-card p-3 shadow-sm">
                            <div className="flex min-w-0 items-center gap-3">
                              <Skeleton className="h-8 w-8 shrink-0 rounded-[4px]" />
                              <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-2.5 w-20" />
                                <Skeleton className="h-5 w-14" />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="grid min-w-max grid-flow-col auto-cols-[minmax(132px,1fr)] gap-2 overflow-x-auto pb-1 lg:min-w-0 lg:grid-flow-row lg:grid-cols-7">
                        {serviciosKpiCards.map((item) => (
                          <button key={item.label} onClick={() => applyPreset(item.preset)} disabled={kpisLoading} className="min-h-[62px] rounded-[4px] border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-muted disabled:opacity-60">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] text-white", item.color)}><item.icon className="h-3.5 w-3.5" /></div>
                              <div className="min-w-0">
                                <p className="truncate text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">{item.label}</p>
                                <p className="truncate text-base font-medium leading-tight text-foreground">{item.val}</p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {isRefreshing && (
                  <div className="mb-2 flex items-center justify-end">
                    <div className="rounded-[4px] border border-border bg-card px-3 py-1 text-[10px] font-medium tracking-[0.08em] text-muted-foreground">
                      Actualizando resultados...
                    </div>
                  </div>
                )}

                <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", servicesPanelClass)}>
                  <div className="grid shrink-0 grid-cols-1 gap-3 border-b border-border bg-card px-4 py-3 lg:px-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
                    <div className="flex min-w-0 flex-1 flex-col gap-3">
                      <div className="flex w-full gap-1 overflow-x-auto border-b border-border sm:w-fit">
                        {VIEW_MODE_OPTIONS.map((option) => (
                          <button
                            key={option.key}
                            onClick={() => {
                              setViewMode(option.key);
                              setCurrentPage(1);
                            }}
                            className={cn(
                              "h-9 shrink-0 border-b-2 px-3 text-[11px] font-medium tracking-[0.02em] transition-colors",
                              viewMode === option.key
                                ? "border-[#01ADFB] text-[#01ADFB]"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="group relative min-w-0 flex-1">
                          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-[#01ADFB]" />
                          <Input placeholder={viewMode === "seguimientos" ? "Buscar seguimientos..." : "Buscar por orden, teléfono, documento o nombre..."} className="h-9 rounded-[4px] border-border bg-muted/50 pl-9 text-[12px] font-medium text-foreground shadow-sm transition-all focus:border-[#01ADFB]/30 focus:bg-card focus:ring-2 focus:ring-[#01ADFB]/15" value={search} onChange={(e) => { setCurrentPage(1); setSearch(e.target.value); }} />
                        </div>
                        <button onClick={openFiltersSheet} className={cn(servicesToolbarButtonClass, activeFilterCount > 0 && "border-[#01ADFB]/30 bg-[#01ADFB]/10 text-[#01ADFB] hover:bg-[#01ADFB]/15 hover:text-[#01ADFB]")}>
                          <Filter className="h-3.5 w-3.5" />
                          Filtros
                          {activeFilterCount > 0 ? (
                            <span className="rounded-[4px] bg-[#01ADFB] px-1.5 py-0.5 text-[9px] leading-none text-white">
                              {activeFilterCount}
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setCurrentPage(1);
                            setDateSortOrder((current) => (current === "desc" ? "asc" : "desc"));
                          }}
                          className={cn(servicesToolbarButtonClass, "border-[#01ADFB]/20 bg-[#01ADFB]/5 text-[#0b6b8a] hover:border-[#01ADFB]/40 hover:bg-[#01ADFB]/10 hover:text-[#0b6b8a]")}
                          aria-label={`Ordenar por fecha: ${dateSortOrder === "desc" ? "más recientes primero" : "más antiguos primero"}`}
                          title={`Orden global de servicios filtrados: ${dateSortOrder === "desc" ? "más recientes primero" : "más antiguos primero"}`}
                        >
                          <ArrowDownUp className="h-3.5 w-3.5" />
                          {dateSortOrder === "desc" ? "Fecha: recientes primero" : "Fecha: antiguos primero"}
                        </button>
                        {hasActiveFilters && (
                          <button
                            onClick={resetAllFilters}
                            className={cn(servicesToolbarButtonClass, "border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white")}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Borrar filtros
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 xl:self-end xl:justify-end">
                      {canExportServices ? (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsExportModalOpen(true)}
                          className={servicesToolbarButtonClass}
                        >
                          <Download className="h-3.5 w-3.5" />
                          Excel
                        </Button>
                      ) : null}
                      {canCreateServices ? (
                        <Link href="/dashboard/servicios/nuevo" className="flex-1 sm:flex-none"><div className={cn(servicesPrimaryActionClass, "flex items-center justify-center gap-2 cursor-pointer")}><Plus className="h-3.5 w-3.5" /><span>Nueva orden</span></div></Link>
                      ) : null}
                    </div>
                  </div>
                  <div className="border-b border-border bg-card px-4 py-2 lg:px-5">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                      {activePresetOptions.map((preset) => (
                        <button
                          key={preset.key}
                          onClick={() => applyPreset(preset.key)}
                          className={cn(
                            "h-7 shrink-0 rounded-[4px] border px-3 text-[10px] font-medium tracking-[0.06em] transition-colors",
                            normalizedActivePreset === preset.key
                              ? "bg-[#01ADFB] text-white border-[#01ADFB]"
                              : "bg-background text-muted-foreground border-border hover:bg-muted",
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                      {customPresets.map((preset) => (
                        <div key={preset.id} className="inline-flex shrink-0 items-center gap-1">
                          <button
                            onClick={() => applyCustomPreset(preset)}
                            className={cn(
                              "h-7 shrink-0 rounded-[4px] border px-3 text-[10px] font-medium tracking-[0.06em] transition-colors",
                              PRESET_COLOR_STYLES[preset.colorToken] || "border-border bg-background text-foreground",
                            )}
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => openEditPresetModal(preset)}
                            className="h-7 w-7 rounded-[4px] border border-border bg-background text-muted-foreground hover:text-foreground"
                            title="Editar preset"
                          >
                            <Pencil className="h-3.5 w-3.5 mx-auto" />
                          </button>
                          <button
                            onClick={() => handleDeletePreset(preset.id)}
                            className="h-7 w-7 rounded-[4px] border border-border bg-background text-muted-foreground hover:text-destructive"
                            title="Eliminar preset"
                          >
                            <Trash2 className="h-3.5 w-3.5 mx-auto" />
                          </button>
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openCreatePresetModal}
                        className="h-7 shrink-0 rounded-[4px] border-dashed text-[10px] font-medium tracking-[0.06em]"
                      >
                        + Nuevo preset
                      </Button>
                    </div>
                  </div>

                  <Sheet
                    open={showFilters}
                    onOpenChange={(open) => {
                      if (open) setFilterDraft(filters);
                      setShowFilters(open);
                    }}
                  >
                    <SheetContent side="right" className="w-full border-border p-0 sm:max-w-[420px]">
                      <SheetHeader className="border-b border-border bg-card px-5 py-4 pr-12">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/40 text-muted-foreground">
                            <Filter className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <SheetTitle className="text-[13px] font-medium tracking-tight">
                              Filtros de servicios
                            </SheetTitle>
                            <SheetDescription className="mt-1 text-[11px]">
                              Ajustá criterios sin perder de vista la operación.
                            </SheetDescription>
                          </div>
                          {draftFilterCount > 0 ? (
                            <span className="ml-auto rounded-[4px] border border-[#01ADFB]/20 bg-[#01ADFB]/10 px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] text-[#01ADFB]">
                              {draftFilterCount} activo{draftFilterCount === 1 ? "" : "s"}
                            </span>
                          ) : null}
                        </div>
                      </SheetHeader>

                      <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Creador</Label>
                            <Combobox
                              value={filterDraft.creador}
                              onChange={(v) => updateFilterDraft(f => ({ ...f, creador: v }))}
                              options={[{ value: "all", label: "TODOS LOS CREADORES" }, ...filterOptions.creadores.map(c => ({ value: c.id, label: c.nombre.toUpperCase() }))]}
                              triggerClassName={servicesFilterComboboxTriggerClass}
                              contentClassName={servicesFilterComboboxContentClass}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Técnico</Label>
                            <Combobox
                              value={filterDraft.tecnico}
                              onChange={(v) => updateFilterDraft(f => ({ ...f, tecnico: v }))}
                              options={[
                                { value: "all", label: "TODOS LOS TECNICOS" },
                                { value: SIN_TECNICO_FILTER_VALUE, label: "SIN TÉCNICO / OPERADOR" },
                                ...filterOptions.tecnicos.map(t => ({ value: t.id, label: t.nombre.toUpperCase() })),
                              ]}
                              triggerClassName={servicesFilterComboboxTriggerClass}
                              contentClassName={servicesFilterComboboxContentClass}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Departamento</Label>
                            <Combobox
                              value={filterDraft.departamento}
                              onChange={(v) => updateFilterDraft(f => ({ ...f, departamento: v, municipio: "all" }))}
                              options={[{ value: "all", label: "TODOS LOS DEPARTAMENTOS" }, ...filterOptions.departamentos.map(d => ({ value: d.id, label: d.name.toUpperCase() }))]}
                              triggerClassName={servicesFilterComboboxTriggerClass}
                              contentClassName={servicesFilterComboboxContentClass}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Municipio</Label>
                            <Combobox
                              value={filterDraft.municipio}
                              onChange={(v) => updateFilterDraft(f => ({ ...f, municipio: v }))}
                              options={[{ value: "all", label: "TODOS LOS MUNICIPIOS" }, ...draftFilteredMunicipalityOptions.map(m => ({ value: m.name.toUpperCase(), label: m.name.toUpperCase() }))]}
                              disabled={filterDraft.departamento === "all"}
                              triggerClassName={servicesFilterComboboxTriggerClass}
                              contentClassName={servicesFilterComboboxContentClass}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Estado</Label>
                            <Combobox
                              value={filterDraft.estado}
                              onChange={(v) => updateFilterDraft(f => ({ ...f, estado: v }))}
                              options={[{ value: "all", label: "TODOS LOS ESTADOS" }, ...filterOptions.estados.map(e => ({ value: e.id, label: e.nombre.toUpperCase() }))]}
                              triggerClassName={servicesFilterComboboxTriggerClass}
                              contentClassName={servicesFilterComboboxContentClass}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Estado de pago</Label>
                            <Combobox
                              value={filterDraft.estadoPago}
                              onChange={(v) => updateFilterDraft(f => ({ ...f, estadoPago: v }))}
                              options={[{ value: "all", label: "TODOS LOS ESTADOS DE PAGO" }, ...filterOptions.estadosPago.map(e => ({ value: e.id, label: e.nombre.toUpperCase() }))]}
                              triggerClassName={servicesFilterComboboxTriggerClass}
                              contentClassName={servicesFilterComboboxContentClass}
                            />
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Método de pago</Label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <button
                                  type="button"
                                  className="flex h-9 w-full items-center justify-between rounded-[4px] border border-border bg-background px-3 py-2 text-[12px] font-medium text-foreground shadow-sm transition-all focus:border-[#01ADFB]/30 focus:bg-card focus:outline-none"
                                >
                                  <span className={cn("truncate text-left", draftMetodoPagoValues.length === 0 && "text-zinc-400")}>
                                    {draftMetodoPagoFilterLabel}
                                  </span>
                                  <ChevronDown className="h-4 w-4 text-zinc-400" />
                                </button>
                              </PopoverTrigger>
                              <PopoverContent align="start" className="w-[320px] rounded-[5px] border border-border p-2 shadow-xl">
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => updateFilterDraft((currentFilters) => ({ ...currentFilters, metodoPago: "all" }))}
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-[4px] px-3 py-2 text-left text-[11px] font-medium uppercase tracking-[0.08em] transition-colors hover:bg-muted",
                                      draftMetodoPagoValues.length === 0 && "bg-[#01ADFB]/10 text-[#01ADFB]",
                                    )}
                                  >
                                    <span>Todos los métodos de pago</span>
                                    {draftMetodoPagoValues.length === 0 ? <CheckCircle2 className="h-4 w-4" /> : null}
                                  </button>
                                  <div className="max-h-60 space-y-1 overflow-y-auto pr-1 custom-scrollbar">
                                    {metodoPagoFilterOptions.map((option) => {
                                      const checked = draftMetodoPagoValues.includes(option.value);

                                      return (
                                        <label
                                          key={option.value}
                                          className={cn(
                                             "flex cursor-pointer items-center justify-between rounded-[4px] px-3 py-2 text-[11px] font-medium uppercase tracking-[0.08em] transition-colors hover:bg-muted",
                                            checked && "bg-[#01ADFB]/10 text-[#01ADFB]",
                                          )}
                                        >
                                          <span className="truncate pr-3">{option.label}</span>
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleDraftMetodoPagoFilter(option.value)}
                                            className="h-4 w-4 rounded border-border text-[#01ADFB] focus:ring-[#01ADFB]"
                                          />
                                        </label>
                                      );
                                    })}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="space-y-2 sm:col-span-2">
                            <Label className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Rango de fechas</Label>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <DatePicker date={filterDraft.fechaInicio ? ymdToPickerDate(filterDraft.fechaInicio) : undefined} onChange={(d) => updateFilterDraft(f => ({ ...f, fechaInicio: pickerDateToYmd(d) }))} className="h-9 rounded-[4px] border-border bg-background text-[12px]" placeholder="INICIO" />
                              <DatePicker date={filterDraft.fechaFin ? ymdToPickerDate(filterDraft.fechaFin) : undefined} onChange={(d) => updateFilterDraft(f => ({ ...f, fechaFin: pickerDateToYmd(d) }))} className="h-9 rounded-[4px] border-border bg-background text-[12px]" placeholder="FIN" />
                            </div>
                          </div>
                        </div>
                      </div>

                      <SheetFooter className="border-t border-border bg-background px-5 py-3 sm:grid sm:grid-cols-[auto_auto_1fr] sm:items-center sm:gap-2 sm:space-x-0">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowFilters(false)}
                          className="h-8 rounded-[4px] text-[10px] font-medium tracking-[0.08em]"
                        >
                          Cerrar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={clearFilterDraft}
                          className="h-8 rounded-[4px] text-[10px] font-medium tracking-[0.08em]"
                        >
                          Limpiar
                        </Button>
                        <Button
                          type="button"
                          onClick={applyFilterDraft}
                          className="h-8 rounded-[4px] bg-[#01ADFB] text-[10px] font-medium tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-[#0199df] sm:justify-self-end"
                        >
                          Aplicar filtros
                          {draftFilterCount > 0 ? ` (${draftFilterCount})` : ""}
                        </Button>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>

                  <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-auto">
                      {viewMode === "seguimientos" ? (
                        <div className="min-w-[920px] divide-y divide-border">
                          {paginatedFollowUps.map((s) => {
                            const pendingFollowUps = getPendingFollowUpRecords(s.raw);
                            const completedFollowUps = getCompletedFollowUpRecords(s.raw);
                            const nextPendingFollowUp = pendingFollowUps[0];
                            const latestCompletedFollowUp = completedFollowUps[0];
                            const latestCompletedFollowUpRejected =
                              latestCompletedFollowUp?.status === "RECHAZADO";
                            const primaryFollowUpActionLabel =
                              pendingFollowUps.length > 0
                                ? latestCompletedFollowUpRejected
                                  ? "Revisar rechazo"
                                  : "Gestionar pendiente"
                                : completedFollowUps.length > 0
                                  ? "Editar llamada"
                                  : "Registrar llamada";

                            return (
                              <div
                                key={s.raw.id}
                                className={cn(
                                  "grid cursor-pointer grid-cols-[220px_minmax(0,1fr)_auto] gap-4 px-4 py-3 transition-[background-color,box-shadow]",
                                  getEstadoRowHoverClassName(s.estadoServicio),
                                )}
                                onClick={() => { setSelectedServicio(s); setIsModalOpen(true); }}
                              >
                                <div className={cn("min-w-0 space-y-2", servicesTextWrapClass)}>
                                  <div className="space-y-1">
                                    <p className="break-words text-[12px] font-medium leading-5 text-foreground">
                                      {s.cliente}
                                    </p>
                                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                                      <span className="min-w-0 break-words text-[10px] text-muted-foreground">
                                        {s.servicioEspecifico}
                                      </span>
                                      <span className={cn("rounded px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.08em]", URGENCIA_STYLING[s.urgencia])}>
                                        {s.urgencia}
                                      </span>
                                    </div>
                                    <p className="font-mono text-[10px] text-muted-foreground">#{s.id}</p>
                                  </div>

                                  <div className="flex flex-wrap gap-1.5">
                                    <span className="inline-flex items-center rounded-[4px] border border-border bg-muted/40 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                                      {completedFollowUps.length} llamada{completedFollowUps.length === 1 ? "" : "s"}
                                    </span>
                                    <span className={cn(
                                      "inline-flex items-center rounded-[4px] border px-2 py-1 text-[9px] font-medium",
                                      pendingFollowUps.length > 0
                                        ? "border-amber-500/20 bg-amber-500/10 text-amber-700"
                                        : "border-border bg-muted/40 text-muted-foreground",
                                    )}>
                                      {pendingFollowUps.length} acci{pendingFollowUps.length === 1 ? "ón" : "ones"} pendiente{pendingFollowUps.length === 1 ? "" : "s"}
                                    </span>
                                  </div>

                                  {latestCompletedFollowUp ? (
                                    <div
                                      className={cn(
                                        "rounded-[4px] border px-3 py-2",
                                        latestCompletedFollowUpRejected
                                          ? "border-rose-200 bg-rose-50"
                                          : "border-emerald-200 bg-emerald-50/70",
                                      )}
                                    >
                                      <div className="flex flex-wrap items-center gap-2">
                                        {latestCompletedFollowUpRejected ? (
                                          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-rose-600" />
                                        ) : (
                                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                                        )}
                                        <p
                                          className={cn(
                                            "text-[10px] font-medium uppercase tracking-[0.08em]",
                                            latestCompletedFollowUpRejected
                                              ? "text-rose-700"
                                              : "text-emerald-700",
                                          )}
                                        >
                                          Última decisión: {formatFollowUpLabel(latestCompletedFollowUp.status, "GESTIONADO")}
                                        </p>
                                      </div>
                                      <p className="mt-1 break-words text-[10px] text-muted-foreground">
                                        {formatBogotaDateTime(latestCompletedFollowUp.completedAt || latestCompletedFollowUp.contactedAt || s.raw.createdAt)} · {formatFollowUpLabel(latestCompletedFollowUp.channel)} · {formatFollowUpLabel(latestCompletedFollowUp.outcome)}
                                      </p>
                                      {latestCompletedFollowUpRejected && latestCompletedFollowUp.notes ? (
                                        <p className="mt-1 line-clamp-2 break-words text-xs text-rose-700">
                                          Nota: {latestCompletedFollowUp.notes}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <p className="text-[10px] text-muted-foreground">
                                      Sin llamadas registradas todavía
                                    </p>
                                  )}
                                </div>

                                <div className="min-w-0 border-l border-border pl-4">
                                  <div className={cn("min-w-0 space-y-1", servicesTextWrapClass)}>
                                    <p className="break-words text-[11px] font-medium text-foreground">{s.parentCliente}</p>
                                    <p className="break-words text-[10px] text-muted-foreground">{s.parentServicio}</p>
                                    <Link
                                      href={`/dashboard/servicios/${s.parentId}/editar?returnTo=${encodedServiciosReturnTo}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="inline-flex items-center gap-1 text-[10px] font-medium text-[#01ADFB] hover:underline"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                      Ver madre #{s.parentNumero}
                                    </Link>
                                  </div>

                                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1.5">
                                      <Calendar className="h-3.5 w-3.5" /> {s.fecha}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <Clock className="h-3.5 w-3.5" /> {s.hora}
                                    </span>
                                    <span className="inline-flex min-w-0 items-center gap-1.5">
                                      <User className="h-3.5 w-3.5 shrink-0" />
                                      <span className="min-w-0 break-words">{s.tecnico}</span>
                                    </span>
                                  </div>

                                  <div className="mt-3 flex flex-wrap gap-1.5">
                                    <span className={cn(servicesBadgeClass, ESTADO_STYLING[s.estadoServicio] || ESTADO_STYLING.DEFAULT)}>
                                      {s.estadoServicio}
                                    </span>
                                    {latestCompletedFollowUp ? (
                                      <span className={cn(servicesBadgeClass, FOLLOW_UP_STATUS_STYLING[latestCompletedFollowUp.status || "DEFAULT"] || FOLLOW_UP_STATUS_STYLING.DEFAULT)}>
                                        Última: {formatFollowUpLabel(latestCompletedFollowUp.status, "GESTIONADO")}
                                      </span>
                                    ) : null}
                                    {nextPendingFollowUp ? (
                                      <span className={cn(servicesBadgeClass, FOLLOW_UP_STATUS_STYLING[nextPendingFollowUp.status || "DEFAULT"] || FOLLOW_UP_STATUS_STYLING.DEFAULT)}>
                                        Pendiente: {formatFollowUpLabel(nextPendingFollowUp.followUpType, "SEGUIMIENTO")}
                                      </span>
                                    ) : null}
                                  </div>

                                  {nextPendingFollowUp ? (
                                    <p className="mt-2 text-[10px] font-medium text-amber-700">
                                      Próxima acción {formatFollowUpLabel(nextPendingFollowUp.followUpType, "SEGUIMIENTO")} · {formatBogotaDate(nextPendingFollowUp.dueAt || s.raw.fechaVisita || s.raw.createdAt)}
                                    </p>
                                  ) : null}
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openFollowUpModal(
                                        s,
                                        latestCompletedFollowUpRejected
                                          ? latestCompletedFollowUp?.id
                                          : undefined,
                                      );
                                    }}
                                    className={cn(
                                      "h-8 whitespace-nowrap rounded-[4px] border px-3 text-[10px] font-medium tracking-[0.08em] transition-colors",
                                      latestCompletedFollowUpRejected && pendingFollowUps.length > 0
                                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                                        : "border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB] hover:bg-[#01ADFB]/15",
                                    )}
                                  >
                                    {primaryFollowUpActionLabel}
                                  </button>
                                  <div className="flex gap-1.5">
                                    {completedFollowUps.length > 0 ? (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); openFollowUpModal(s, completedFollowUps[0].id); }}
                                        className="h-8 rounded-[4px] border border-border bg-background px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                                      >
                                        Historial
                                      </button>
                                    ) : null}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setSelectedServicio(s); setIsModalOpen(true); }}
                                      className="h-8 rounded-[4px] border border-border bg-background px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                                    >
                                      Ver
                                    </button>
                                    {canEditServices && canEditOrdenTecnica(s.raw) ? (
                                      <Link
                                        href={`/dashboard/servicios/${s.raw.id}/editar?returnTo=${encodedServiciosReturnTo}`}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex h-8 items-center rounded-[4px] border border-border bg-background px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                                          Editar
                                        </div>
                                      </Link>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                      {viewMode !== "seguimientos" ? (
                      <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
                        <thead>
          <tr className={cn("sticky top-0 z-10 border-b border-border", servicesTableHeadClass)}>
            <th className="w-[92px] px-3 py-2 lg:px-4">ID</th>
            <th className="w-[25%] px-3 py-2 lg:px-4">Cliente / Servicio</th>
            <th className="w-[13%] px-3 py-2 lg:px-4">Programación</th>
            <th className="w-[14%] px-3 py-2 lg:px-4">Técnico</th>
            <th className="w-[10%] px-3 py-2 text-center lg:px-4">Tipo visita</th>
            <th className="w-[12%] px-3 py-2 text-center lg:px-4">Estado ops</th>
            <th className="w-[13%] px-3 py-2 text-center lg:px-4">Estado pago</th>
            <th className="w-[76px] px-3 py-2 text-right lg:px-4">···</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {paginatedServicios.map((s) => (
            <React.Fragment key={s.raw.id}>
              <tr 
                className={cn(
                  "group cursor-pointer transition-[background-color,box-shadow]",
                  getEstadoRowHoverClassName(s.estadoServicio),
                )}
                onClick={() => { setSelectedServicio(s); setIsModalOpen(true); }}
              >
                <td className={servicesCellClass}><span className="inline-flex rounded border border-border bg-muted/40 px-2 py-1 font-mono text-[10px] font-medium text-muted-foreground">{s.id}</span></td>
                <td className={servicesCellClass}>
                  <div className={cn("min-w-0 space-y-1", servicesTextWrapClass)}>
                    <p className="break-words text-[12px] font-medium leading-5 text-foreground">{s.cliente}</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                      <span className="min-w-0 break-words text-[10px] text-muted-foreground">{s.servicioEspecifico}</span>
                      {(() => {
                        const resolvedFollowUpStatus = getResolvedFollowUpStatus(s.raw);
                        if (!resolvedFollowUpStatus) return null;

                        const badgeClassName =
                          resolvedFollowUpStatus === "ACEPTADO"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : "bg-rose-100 text-rose-700 border-rose-200";

                        return (
                          <span className={cn("rounded border px-1.5 py-0.5 text-[8px] font-medium", badgeClassName)}>
                            {resolvedFollowUpStatus === "ACEPTADO"
                              ? "seguimiento aceptado"
                              : "seguimiento rechazado"}
                          </span>
                        );
                      })()}
                      <span className={cn("rounded px-1.5 py-0.5 text-[8px] font-medium uppercase tracking-[0.08em]", URGENCIA_STYLING[s.urgencia])}>{s.urgencia}</span>
                    </div>
                  </div>
                </td>
                <td className={servicesCellClass}><div className="space-y-1"><div className="flex items-center gap-1.5 text-[11px] text-foreground"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {s.fecha}</div><div className="flex items-center gap-1.5 text-[10px] text-muted-foreground"><Clock className="h-3.5 w-3.5" /> {s.hora}</div></div></td>
                <td className={servicesCellClass}><div className="flex min-w-0 items-center gap-2"><div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted/40"><User className="h-3.5 w-3.5 text-muted-foreground" /></div><span className="min-w-0 break-words text-[11px] text-muted-foreground">{s.tecnico}</span></div></td>

                {/* 1. TIPO DE VISITA */}
                <td className={cn(servicesCellClass, "text-center")}>
                  <span className="inline-flex rounded border border-border bg-muted/50 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                    {formatVisitTypeLabel(s.raw.tipoVisita)}
                  </span>
                </td>

                {/* 2. ESTADO OPERATIVO */}
                <td className={cn(servicesCellClass, "text-center")}>
                  <span className={cn(
                    servicesBadgeClass,
                    ESTADO_STYLING[s.estadoServicio] || ESTADO_STYLING["DEFAULT"]
                  )}>
                    {s.estadoServicio}
                  </span>
                </td>

                {/* 3. ESTADO DE PAGO */}
                <td className={cn(servicesCellClass, "text-center")}>
                  <div className="flex flex-col items-center gap-1.5">
                    {(() => {
                      const financialLock = getFinancialLockMeta(s.raw);

                      return financialLock.locked ? (
                        <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[9px] font-medium text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> Congelada
                        </span>
                      ) : null;
                    })()}
                    <span className={cn(
                      servicesBadgeClass,
                      ESTADO_PAGO_STYLING[s.raw.estadoPago || "PENDIENTE"] || ESTADO_PAGO_STYLING["DEFAULT"]
                    )}>
                      {s.raw.estadoPago || "PENDIENTE"}
                    </span>

                    {/* Visualización del método de pago con Popover si es mixto */}
                    {s.raw.desglosePago && s.raw.desglosePago.length > 0 ? (
                      s.raw.desglosePago.length > 1 ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="flex cursor-pointer items-center gap-1 text-[9px] font-medium text-[#01ADFB] underline-offset-2 transition-all hover:underline">
                                <div className="h-1.5 w-1.5 rounded-[4px] bg-[#01ADFB] animate-pulse" />
                                Múltiples métodos
                              </button>
                            </PopoverTrigger>
                            <PopoverContent align="center" className="w-64 rounded-[5px] border-border p-4 shadow-xl">
                              <div className="space-y-3">
                                <p className="border-b border-border pb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Detalle de pago mixto</p>
                                <div className="space-y-2">
                                  {s.raw.desglosePago.map((d, idx) => (
                                    <div key={idx} className="flex items-center justify-between rounded-[4px] border border-border bg-muted/30 p-2">
                                      <span className="text-[9px] font-medium uppercase text-foreground">{d.metodo}</span>
                                      <span className="text-xs font-medium text-foreground">$ {Number(d.monto).toLocaleString()}</span>
                                    </div>
                                  ))}
                                </div>
                                <div className="pt-2 border-t border-border flex justify-between items-center">
                                  <span className="text-[9px] font-medium uppercase text-muted-foreground">Total</span>
                                  <span className="text-sm font-medium text-emerald-600">$ {getDisplayPaidValue(s.raw).toLocaleString()}</span>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <span className="text-[9px] font-medium text-muted-foreground">
                          {s.raw.desglosePago[0].metodo}
                        </span>
                      )
                    ) : (
                      <span className="text-[9px] font-medium text-muted-foreground">
                        {s.raw.metodoPago?.nombre || "No definido"}
                      </span>
                    )}
                  </div>
                </td>

                <td className={cn(servicesCellClass, "text-right")}>
                  <div className="flex justify-end gap-2">
                    {s.followUps.length > 0 ? (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFollowUpsRow(s.raw.id); }}
                        className="flex h-8 items-center gap-1.5 rounded-[4px] border border-amber-200 bg-amber-50 px-2.5 text-amber-700 transition-colors hover:bg-amber-100"
                        title={expandedRows[s.raw.id] ? "Ocultar seguimientos" : "Ver seguimientos"}
                      >
                        <span className="text-[10px] font-medium tracking-[0.08em]">Seg.</span>
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expandedRows[s.raw.id] && "rotate-180")} />
                      </button>
                    ) : null}
                    <div onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className={cn("w-[200px]", servicesDropdownContentClass)}>
                          <p className="mb-1 border-b border-border px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Acciones de servicio</p>
                          <DropdownMenuItem 
                            onClick={() => { setSelectedServicio(s); setIsModalOpen(true); }}
                            className={servicesDropdownItemClass}
                          >
                            <Eye className="h-3.5 w-3.5 text-[#01ADFB]" /> Ver detalles
                          </DropdownMenuItem>

            {canEditServices && canEditOrdenTecnica(s.raw) ? (
              <Link href={`/dashboard/servicios/${s.raw.id}/editar?returnTo=${encodedServiciosReturnTo}`} onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem className={servicesDropdownItemClass}>
                  <Pencil className="h-3.5 w-3.5 text-amber-600" /> Editar orden
                </DropdownMenuItem>
              </Link>
                          ) : null}

                          <DropdownMenuItem 
                            onClick={() => handleCopy(s)}
                            className={servicesDropdownItemClass}
                          >
                            <Copy className="h-3.5 w-3.5 text-purple-600" /> Copiar info
                          </DropdownMenuItem>

                          {canManageServices ? (
                            <>
                              <DropdownMenuItem onClick={() => handleNotifyOperator(s)} className={servicesDropdownItemClass}>
                                <Send className="h-3.5 w-3.5 text-[#01ADFB]" /> Enviar a técnico
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setSelectedServicio(s); setIsVisitaModalOpen(true); }} className={servicesDropdownItemClass}>
                                <MapPin className="h-3.5 w-3.5 text-emerald-500" /> Evidencia de visita
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => triggerUpload(s.raw.id, "facturaElectronica")} className={servicesDropdownItemClass}>
                                <Upload className="h-3.5 w-3.5 text-blue-500" /> Subir factura
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={getFinancialLockMeta(s.raw).locked}
                                onClick={() => triggerUpload(s.raw.id, "comprobantePago")}
                                className={cn(servicesDropdownItemClass, "disabled:pointer-events-none disabled:opacity-50")}
                              >
                                <Receipt className="h-3.5 w-3.5 text-orange-500" /> Subir comprobante
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => triggerUpload(s.raw.id, "evidenciaPath")} className={servicesDropdownItemClass}>
                                <ImageIcon className="h-3.5 w-3.5 text-indigo-500" /> Subir evidencias
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openDeleteModal(s)} className="flex cursor-pointer items-center gap-3 rounded-[4px] py-2 text-[11px] font-medium text-destructive hover:bg-destructive/10">
                                <Trash2 className="h-3.5 w-3.5" /> Anular servicio
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          ) : null}

                          {(() => {
                            const settlementMeta = getSettlementFlowMeta(s.raw);
                            const financialLock = settlementMeta.financialLock;

                            return (
                              <>
                                {s.raw.liquidadoAt || s.raw.estadoServicio === "LIQUIDADO" ? (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedServicio(s);
                                      setIsViewLiquidationModalOpen(true);
                                    }}
                                    className="flex cursor-pointer items-center gap-3 rounded-[4px] py-2 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/10"
                                  >
                                    <Receipt className="h-3.5 w-3.5" /> Ver liquidación
                                  </DropdownMenuItem>
                                ) : financialLock.locked ? (
                                  <DropdownMenuItem disabled className="flex items-start gap-3 rounded-[4px] py-2 text-[11px] font-medium text-amber-700 opacity-100">
                                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5" />
                                    <span className="leading-relaxed">
                                      <span className="block tracking-[0.08em]">Orden congelada</span>
                                      <span className="text-[10px] font-medium normal-case">{financialLock.reason}</span>
                                    </span>
                                  </DropdownMenuItem>
                                ) : !s.raw.fechaVisita ? null : (
                                  <DropdownMenuItem
                                    onClick={() => {
                                      void handleLiquidateAction(s);
                                    }}
                                    className={cn(
                                      "flex cursor-pointer items-center gap-3 rounded-[4px] py-2 text-[11px] font-medium",
                                      settlementMeta.accent === "sky" && "text-sky-600 hover:bg-sky-500/10",
                                      settlementMeta.accent === "blue" && "text-blue-600 hover:bg-blue-500/10",
                                      settlementMeta.accent === "emerald" && "text-emerald-600 hover:bg-emerald-500/10",
                                    )}
                                  >
                                    {settlementMeta.isFuture ? <CreditCard className="h-3.5 w-3.5" /> : settlementMeta.hasCash ? <Wallet className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                                    {settlementMeta.title}
                                  </DropdownMenuItem>
                                )}
                              </>
                            );
                          })()}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </td>
              </tr>
              {expandedRows[s.raw.id] && s.followUps.length > 0 ? (
                <tr className="bg-amber-50/60">
                  <td colSpan={8} className="px-3 py-3 lg:px-4">
                    <div className="overflow-hidden rounded-[5px] border border-amber-200 bg-card">
                      <div className="flex items-center justify-between border-b border-amber-100 px-4 py-3">
                        <div>
                          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-amber-700">Seguimientos de la orden</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">Visitas vinculadas a esta orden madre.</p>
                        </div>
                        <span className="text-[10px] font-medium tracking-[0.08em] text-amber-700">{s.followUps.length} seguimiento(s)</span>
                      </div>
                      <div className="divide-y divide-amber-100">
                        {s.followUps.map((child) => {
                          const latestStatus = getLatestFollowUpStatus(child.raw) || "DEFAULT";
                          return (
                            <div key={child.raw.id} className="grid grid-cols-1 gap-4 px-4 py-3 lg:grid-cols-[1.2fr_1fr_1fr_auto]">
                              <div className={servicesTextWrapClass}>
                                <p className="break-words text-[12px] font-medium text-foreground">{child.servicioEspecifico}</p>
                                <p className="mt-1 text-[10px] text-muted-foreground">
                                  {formatVisitTypeLabel(child.raw.tipoVisita)} • #{child.id}
                                </p>
                                <p className="mt-2 break-words text-[11px] text-muted-foreground">{child.raw.observacion || "Seguimiento vinculado"}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Programación</p>
                                <p className="mt-1 text-[12px] font-medium text-foreground">{child.fecha}</p>
                                <p className="text-xs text-muted-foreground">{child.hora}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Seguimiento</p>
                                <span className={cn(servicesBadgeClass, "mt-1", FOLLOW_UP_STATUS_STYLING[latestStatus] || FOLLOW_UP_STATUS_STYLING.DEFAULT)}>
                                  {latestStatus === "DEFAULT" ? "SIN REGISTRO" : latestStatus}
                                </span>
                              </div>
                              <div className="flex items-start justify-end gap-2">
                                <button
                                  onClick={() => { setSelectedServicio(child); setIsModalOpen(true); }}
                                  className="h-8 rounded-[4px] border border-border bg-background px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  Ver
                                </button>
                                {canEditServices && canEditOrdenTecnica(child.raw) ? (
                                  <Link href={`/dashboard/servicios/${child.raw.id}/editar?returnTo=${encodedServiciosReturnTo}`}>
                                    <div className="flex h-8 items-center rounded-[4px] border border-border bg-background px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                                      Editar
                                    </div>
                                  </Link>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                      ) : null}
                    </div>
                    {!loading && !isRefreshing && activeRows.length === 0 && <div className="flex flex-1 flex-col items-center justify-center px-6 py-14 text-center"><AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/40" /><h2 className="text-sm font-medium text-foreground">Sin resultados</h2><p className="mt-1 text-[12px] text-muted-foreground">{viewMode === "seguimientos" ? "No se encontraron seguimientos para tu búsqueda." : "No se encontraron órdenes para tu búsqueda."}</p></div>}
                    <div className="flex shrink-0 items-center justify-between border-t border-border bg-card px-4 py-3">
                      <div className="flex items-center gap-4">
                        <span className="text-[11px] text-muted-foreground">
                          Mostrando {totalCount ? Math.min(startIndex + 1, totalCount) : 0}-{totalCount ? Math.min(startIndex + activeRows.length, totalCount) : 0} de {totalCount}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                          className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>

                        <div className="flex items-center gap-1">
                          {Array.from({ length: totalPages }, (_, i) => i + 1)
                            .filter((page) => {
                              return page === 1 || page === totalPages || (page >= currentPage - 1 && page <= currentPage + 1);
                            })
                            .map((page, index, array) => (
                              <React.Fragment key={page}>
                                {index > 0 && array[index - 1] !== page - 1 && (
                                  <span className="px-2 text-muted-foreground">...</span>
                                )}
                                <button
                                  onClick={() => setCurrentPage(page)}
                                  className={cn(
                                    "flex h-7 min-w-7 items-center justify-center rounded-[4px] px-2 text-[11px] font-medium transition-colors",
                                    currentPage === page
                                      ? "bg-[#01ADFB] text-white shadow-sm shadow-[#01ADFB]/20"
                                      : "bg-background border border-border text-foreground hover:bg-muted",
                                  )}
                                >
                                  {page}
                                </button>
                              </React.Fragment>
                            ))}
                        </div>

                        <button
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages || totalPages === 0}
                          className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-border bg-background text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <Dialog open={isPresetModalOpen} onOpenChange={setIsPresetModalOpen}>
        <DialogContent className={cn("max-w-md", servicesDialogContentClass)}>
          <DialogHeader className={servicesDialogHeaderClass}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/50 text-[#01ADFB]">
                <Bookmark className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className={servicesDialogTitleClass}>
                  {editingPresetId ? "Editar preset" : "Nuevo preset"}
                </DialogTitle>
                <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>
                  Guardá los filtros actuales con nombre, color y visibilidad.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className={cn("space-y-4", servicesDialogBodyClass)}>
            <div className="space-y-2">
              <Label className={servicesDialogLabelClass}>Nombre</Label>
              <Input
                value={presetForm.name}
                onChange={(e) => setPresetForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: vencidos zona norte"
                className={servicesDialogInputClass}
              />
            </div>

            <div className="space-y-2">
              <Label className={servicesDialogLabelClass}>Color</Label>
              <div className="flex flex-wrap gap-2">
                {CUSTOM_PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setPresetForm((prev) => ({ ...prev, colorToken: color }))}
                    className={cn(
                      "h-7 rounded-[4px] border px-2 text-[9px] font-medium uppercase tracking-[0.08em] transition-shadow",
                      PRESET_COLOR_STYLES[color],
                      presetForm.colorToken === color && "ring-2 ring-[#01ADFB]/35 ring-offset-1 ring-offset-background",
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className={servicesDialogLabelClass}>Visibilidad</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPresetForm((prev) => ({ ...prev, isShared: false }))}
                  className={cn(
                    "h-8 rounded-[4px] border text-[10px] font-medium tracking-[0.08em] transition-colors",
                    !presetForm.isShared ? "bg-[#01ADFB] text-white border-[#01ADFB]" : "bg-background border-border text-muted-foreground",
                  )}
                >
                  Privado
                </button>
                <button
                  type="button"
                  onClick={() => setPresetForm((prev) => ({ ...prev, isShared: true }))}
                  className={cn(
                    "h-8 rounded-[4px] border text-[10px] font-medium tracking-[0.08em] transition-colors",
                    presetForm.isShared ? "bg-[#01ADFB] text-white border-[#01ADFB]" : "bg-background border-border text-muted-foreground",
                  )}
                >
                  Compartido
                </button>
              </div>
            </div>
          </div>
          <div className={cn("flex gap-2", servicesDialogFooterClass)}>
              <Button variant="outline" className={cn("flex-1 border-border bg-card", servicesDialogButtonClass)} onClick={() => setIsPresetModalOpen(false)}>
                Cancelar
              </Button>
              <Button className={cn("flex-1 bg-[#01ADFB] text-white hover:bg-[#0197dc]", servicesDialogButtonClass)} onClick={handleSavePreset}>
                Guardar preset
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isExportModalOpen}
        onOpenChange={(open) => {
          setIsExportModalOpen(open);
          if (!open && !isExportingExcel) {
            resetExportModal();
          }
        }}
      >
        <DialogContent className={cn("max-w-3xl", servicesDialogContentClass)}>
          <DialogHeader className={servicesDialogHeaderClass}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/50 text-[#01ADFB]">
                <Download className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className={servicesDialogTitleClass}>Descargar Excel</DialogTitle>
                <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>
                  Seleccioná empresa y preset. Si no definís fechas, se descargan los registros del alcance elegido.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className={cn("space-y-4", servicesDialogBodyClass)}>
            <div className="space-y-3">
              <Label className={servicesDialogLabelClass}>Empresas</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setExportEnterpriseMode("all")}
                  className={cn(
                    "h-8 rounded-[4px] border text-[10px] font-medium tracking-[0.08em] transition-colors",
                    exportEnterpriseMode === "all"
                      ? "border-[#01ADFB] bg-[#01ADFB] text-white"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setExportEnterpriseMode("selected")}
                  className={cn(
                    "h-8 rounded-[4px] border text-[10px] font-medium tracking-[0.08em] transition-colors",
                    exportEnterpriseMode === "selected"
                      ? "border-[#01ADFB] bg-[#01ADFB] text-white"
                      : "border-border bg-background text-muted-foreground",
                  )}
                >
                  Una o varias
                </button>
              </div>

              {exportEnterpriseMode === "selected" ? (
                <div className="space-y-3">
                  <Input
                    value={exportEmpresaSearch}
                    onChange={(e) => setExportEmpresaSearch(e.target.value)}
                    placeholder="Buscar empresa..."
                    className={servicesDialogInputClass}
                  />
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded-[5px] border border-border bg-muted/20 p-2 custom-scrollbar">
                    {filteredExportEnterprises.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[12px] text-muted-foreground">
                        No se encontraron empresas.
                      </p>
                    ) : (
                      filteredExportEnterprises.map((empresa) => {
                        const selected = exportEmpresaIds.includes(empresa.id);
                        return (
                          <button
                            key={empresa.id}
                            type="button"
                            onClick={() => toggleExportEmpresa(empresa.id)}
                            className={cn(
                              "flex w-full min-w-0 items-center justify-between gap-3 rounded-[4px] border px-3 py-2 text-left transition-colors",
                              selected
                                ? "border-[#01ADFB] bg-[#01ADFB]/10 text-foreground"
                                : "border-border bg-background text-muted-foreground hover:bg-muted",
                            )}
                          >
                            <span className={cn("text-[12px] font-medium text-foreground", servicesTextWrapClass)}>{empresa.nombre}</span>
                            <span className={cn(
                              "shrink-0 text-[9px] font-medium uppercase tracking-[0.1em]",
                              selected ? "text-[#01ADFB]" : "text-muted-foreground",
                            )}>
                              {selected ? "Seleccionada" : "Seleccionar"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className={servicesDialogLabelClass}>Fecha inicial</Label>
                <DatePicker
                  date={exportDateRange.fechaInicio ? ymdToPickerDate(exportDateRange.fechaInicio) : undefined}
                  onChange={(date) => setExportDateRange((prev) => ({ ...prev, fechaInicio: pickerDateToYmd(date) }))}
                  placeholder="Inicio"
                />
              </div>
              <div className="space-y-2">
                <Label className={servicesDialogLabelClass}>Fecha final</Label>
                <DatePicker
                  date={exportDateRange.fechaFin ? ymdToPickerDate(exportDateRange.fechaFin) : undefined}
                  onChange={(date) => setExportDateRange((prev) => ({ ...prev, fechaFin: pickerDateToYmd(date) }))}
                  placeholder="Fin"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className={servicesDialogLabelClass}>Preset</Label>
              <Combobox
                value={exportPreset}
                onChange={setExportPreset}
                options={EXPORT_PRESET_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                placeholder="Selecciona un preset..."
              />
            </div>
          </div>
          <div className={cn("flex gap-2", servicesDialogFooterClass)}>
              <Button
                variant="outline"
                className={cn("flex-1 border-border bg-card", servicesDialogButtonClass)}
                disabled={isExportingExcel}
                onClick={() => {
                  setIsExportModalOpen(false);
                  resetExportModal();
                }}
              >
                Cancelar
              </Button>
              <Button className={cn("flex-1 bg-[#01ADFB] text-white hover:bg-[#0197dc]", servicesDialogButtonClass)} disabled={isExportingExcel} onClick={handleExportExcel}>
                {isExportingExcel ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    Generar Excel
                    <Download className="ml-2 h-3.5 w-3.5" />
                  </>
                )}
              </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}><DialogContent className={cn("max-w-6xl h-[92vh] flex flex-col", servicesDialogContentClass)}>
        <div className="relative shrink-0 border-b border-border bg-card px-5 py-4">
          <div className="absolute right-12 top-4 hidden items-center gap-2 md:flex">
             <div className={cn("rounded border px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] shadow-sm", ESTADO_STYLING[selectedServicio?.estadoServicio || ""] || ESTADO_STYLING["DEFAULT"])}>
                {selectedServicio?.estadoServicio}
             </div>
             <div className={cn("rounded px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] shadow-sm", URGENCIA_STYLING[selectedServicio?.urgencia || ""])}>
                Prioridad {selectedServicio?.urgencia}
             </div>
          </div>
          <DialogHeader>
            <div className="flex min-w-0 items-center gap-3 md:pr-72">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/50 text-[#01ADFB]">
                <FileText className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className={cn(servicesDialogTitleClass, servicesTextWrapClass)}>Expediente de orden <span className="text-[#01ADFB]">#{selectedServicio?.id}</span></DialogTitle>
                <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>Trazabilidad operativa y financiera del servicio</DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-5 custom-scrollbar lg:p-6">
          {selectedServicioDetailLoading && selectedServicio && !hasServicioDetailLoaded(selectedServicio) ? (
            <div className="mb-6 flex items-center gap-3 rounded-[5px] border border-[#01ADFB]/20 bg-[#01ADFB]/5 px-4 py-3 text-sm font-semibold text-[#0b6b8a]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando detalle completo del servicio...
            </div>
          ) : null}
          {selectedServicio && (() => {
            const evidenceImages = getTrabajoEvidenceImageDownloads(selectedServicio.raw, selectedServicio.id);
            const comprobantePago = selectedServicio.raw.comprobantePago;
            const hasPaymentSupport = Boolean(selectedServicio.raw.facturaElectronica) ||
              (Array.isArray(comprobantePago)
                ? comprobantePago.length > 0
                : typeof comprobantePago === "string" && comprobantePago.trim().length > 0);
            const formatMoney = (value: number | null | undefined) =>
              new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);
            const interiorDetails = [
              selectedServicioAddress?.bloque ? `Bloque: ${selectedServicioAddress.bloque}` : null,
              selectedServicioAddress?.piso ? `Apto / piso: ${selectedServicioAddress.piso}` : null,
              selectedServicioAddress?.unidad ? `Unidad: ${selectedServicioAddress.unidad}` : null,
              selectedServicioAddress?.tipoUbicacion ? `Tipo: ${selectedServicioAddress.tipoUbicacion}` : null,
            ].filter(Boolean).join(" · ") || "N/A";
            const selectedServicesLabel = Array.isArray(selectedServicio.raw.serviciosSeleccionados) && selectedServicio.raw.serviciosSeleccionados.length > 0
              ? selectedServicio.raw.serviciosSeleccionados.join(", ")
              : selectedServicio.servicioEspecifico || selectedServicio.raw.servicio?.nombre || "N/A";
            const createdByName = getPersonFullName(selectedServicio.raw.creadoPor);
            const createdAtLabel = selectedServicio.raw.createdAt ? formatBogotaDateTime(selectedServicio.raw.createdAt) : "N/A";
            const parentOrderLabel = selectedServicio.raw.ordenPadre?.numeroOrden || selectedServicio.raw.ordenPadreId || "N/A";
            const paymentDateLabel = selectedServicio.raw.fechaPago ? formatBogotaDate(selectedServicio.raw.fechaPago) : "N/A";
            const paidValue = getDisplayPaidValue(selectedServicio.raw);
            const sectionClass = "border-b border-border pb-4 last:border-b-0 last:pb-0";
            const openGridClass = "grid grid-cols-1 gap-y-3 md:divide-x md:divide-border";
            const SectionHeading = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
              <div className="mb-3 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {icon}
                {children}
              </div>
            );
            const InfoCell = ({ label, children, className, valueClassName }: { label: string; children: React.ReactNode; className?: string; valueClassName?: string }) => (
              <div className={cn("min-w-0 md:px-4 md:first:pl-0 md:last:pr-0", className)}>
                <p className={servicesDetailLabelClass}>{label}</p>
                <div className={cn("mt-1 text-[12px] font-medium leading-snug text-foreground", servicesTextWrapClass, valueClassName)}>{children}</div>
              </div>
            );
            const NoteLine = ({ label, value }: { label: string; value?: string | null }) => (
              <div className="min-w-0 border-l border-border pl-3">
                <p className={servicesDetailLabelClass}>{label}</p>
                <p className={cn("mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-foreground", servicesTextWrapClass)}>
                  {value || "Sin información registrada"}
                </p>
              </div>
            );

            return (
              <div className="space-y-5">
                <section className={sectionClass}>
                  <SectionHeading icon={<FileText className="h-3.5 w-3.5 text-[#01ADFB]" />}>
                    Información general
                  </SectionHeading>
                  <div className={cn(openGridClass, "md:grid-cols-4")}>
                    <InfoCell label="ID servicio">#{selectedServicio.id}</InfoCell>
                    <InfoCell label="Número orden">{selectedServicio.raw.numeroOrden || "N/A"}</InfoCell>
                    <InfoCell label="Estado actual">
                      <span className={cn("inline-flex rounded-[4px] px-2 py-0.5 text-[10px] font-medium", ESTADO_STYLING[selectedServicio.raw.estadoServicio || ""] || ESTADO_STYLING.DEFAULT)}>
                        {selectedServicio.estadoServicio || selectedServicio.raw.estadoServicio || "N/A"}
                      </span>
                    </InfoCell>
                    <InfoCell label="Fecha creación">{createdAtLabel}</InfoCell>
                  </div>
                  <div className="mt-3 border-l border-border pl-3">
                    <InfoCell label="Creado por" className="md:px-0">{createdByName}</InfoCell>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <div className="min-w-0 space-y-5">
                    <section className={sectionClass}>
                      <SectionHeading icon={<User className="h-3.5 w-3.5 text-[#01ADFB]" />}>
                        Cliente y contacto
                      </SectionHeading>
                      <div className={cn(openGridClass, "md:grid-cols-2")}>
                        <InfoCell label="Nombre / razón social">
                          {selectedServicio.cliente}
                          <span className="mt-0.5 block text-[10px] font-medium text-[#01ADFB]">{selectedServicio.clienteFull.tipoCliente || "Cliente"}</span>
                        </InfoCell>
                        <InfoCell label="Documento / NIT">{selectedServicio.clienteFull.tipoDocumento || "DOC"} {selectedServicio.clienteFull.numeroDocumento || selectedServicio.clienteFull.nit || "N/A"}</InfoCell>
                      </div>
                      <div className={cn(openGridClass, "mt-3 md:grid-cols-2")}>
                        <InfoCell label="Contacto directo">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span>{selectedServicio.clienteFull.telefono || "N/A"}</span>
                            {selectedServicio.clienteFull.telefono ? (
                              <a
                                href={`https://wa.me/57${selectedServicio.clienteFull.telefono.replace(/\s+/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-2 w-2 rounded-[4px] bg-emerald-500"
                                aria-label="Abrir WhatsApp"
                              />
                            ) : null}
                          </div>
                          {selectedServicio.clienteFull.telefono2 ? <span className="mt-0.5 block text-[10px] text-muted-foreground">{selectedServicio.clienteFull.telefono2}</span> : null}
                        </InfoCell>
                        <InfoCell label="Correo electrónico" valueClassName="lowercase text-[11px]">{selectedServicio.clienteFull.correo || "N/A"}</InfoCell>
                      </div>
                    </section>

                    <section className={sectionClass}>
                      <SectionHeading icon={<MapPin className="h-3.5 w-3.5 text-[#01ADFB]" />}>
                        Ubicación del servicio
                      </SectionHeading>
                      <div>
                        <p className={servicesDetailLabelClass}>Dirección principal</p>
                        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
                          <p className={cn("text-[12px] font-medium text-foreground", servicesTextWrapClass)}>{selectedServicioAddress?.direccionTexto || "N/A"}</p>
                          {selectedServicioAddress?.linkMaps ? (
                            <Button variant="outline" size="sm" asChild className={cn("border-[#01ADFB]/20 bg-transparent text-[#01ADFB] hover:bg-[#01ADFB]/10", servicesDialogButtonClass)}>
                              <a href={selectedServicioAddress.linkMaps} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5" /> Mapa
                              </a>
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div className={cn(openGridClass, "mt-3 md:grid-cols-2")}>
                        <InfoCell label="Municipio / Depto">{[selectedServicioAddress?.municipio, selectedServicioAddress?.departamento].filter(Boolean).join(" / ") || "N/A"}</InfoCell>
                        <InfoCell label="Zona">{selectedServicioAddress?.zonaNombre || selectedServicio.raw.zona?.nombre || "N/A"}</InfoCell>
                      </div>
                      <div className={cn(openGridClass, "mt-3 md:grid-cols-2")}>
                        <InfoCell label="Barrio">{selectedServicioAddress?.barrio || "N/A"}</InfoCell>
                        <InfoCell label="Detalles interior">{interiorDetails}</InfoCell>
                      </div>
                      {selectedServicio.raw.vehiculo ? (
                        <div className="mt-3 border-l border-[#01ADFB]/35 pl-3">
                          <p className={servicesDetailLabelClass}>Vehículo asociado</p>
                          <p className={cn("mt-1 text-[12px] font-medium text-foreground", servicesTextWrapClass)}>
                            {selectedServicio.raw.vehiculo.placa} · {selectedServicio.raw.vehiculo.marca || "N/A"} {selectedServicio.raw.vehiculo.modelo || ""} · {selectedServicio.raw.vehiculo.color || "N/A"} · {selectedServicio.raw.vehiculo.tipo || "N/A"}
                          </p>
                        </div>
                      ) : null}
                    </section>

                    <section className={sectionClass}>
                      <SectionHeading icon={<Activity className="h-3.5 w-3.5 text-[#01ADFB]" />}>
                        Estado y observaciones
                      </SectionHeading>
                      <div className={cn(openGridClass, "md:grid-cols-3")}>
                        <InfoCell label="Nivel infestación">{selectedServicio.raw.nivelInfestacion || "N/A"}</InfoCell>
                        <InfoCell label="Cond. higiene">{selectedServicio.raw.condicionesHigiene || "N/A"}</InfoCell>
                        <InfoCell label="Cond. local">{selectedServicio.raw.condicionesLocal || "N/A"}</InfoCell>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <NoteLine label="Observaciones generales" value={selectedServicio.raw.observacion} />
                        <NoteLine label="Observación final" value={selectedServicio.raw.observacionFinal} />
                        <NoteLine label="Diagnóstico técnico" value={selectedServicio.raw.diagnosticoTecnico} />
                        <NoteLine label="Intervención realizada" value={selectedServicio.raw.intervencionRealizada} />
                        <NoteLine label="Hallazgos estructurales" value={selectedServicio.raw.hallazgosEstructurales} />
                        <NoteLine label="Recomendaciones" value={selectedServicio.raw.recomendacionesObligatorias || selectedServicio.raw.recomendacionesSugeridas} />
                      </div>
                    </section>

                    {(evidenceImages.length > 0 || canManageServices) ? (
                      <section className={sectionClass}>
                        <SectionHeading icon={<ImageIcon className="h-3.5 w-3.5 text-pink-500" />}>
                          Evidencias
                        </SectionHeading>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground">Registro visual asociado a la orden</p>
                          <div className="flex flex-wrap gap-2">
                            {evidenceImages.length > 0 ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => void handleDownloadTrabajoEvidenceImages(selectedServicio)}
                                disabled={isDownloadingEvidenceImages || selectedServicioDetailLoading}
                                aria-label={`Descargar ${evidenceImages.length} imagen${evidenceImages.length === 1 ? "" : "es"} de evidencia del trabajo`}
                                className={cn("border-pink-500/20 bg-transparent px-3 text-pink-600 hover:bg-pink-500/10 disabled:cursor-not-allowed disabled:opacity-60", servicesDialogButtonClass)}
                              >
                                {isDownloadingEvidenceImages ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                Descargar ({evidenceImages.length})
                              </Button>
                            ) : null}
                            {canManageServices ? (
                              <Button variant="ghost" size="sm" onClick={() => triggerUpload(selectedServicio.raw.id, "evidenciaPath")} className={cn("text-[#01ADFB] hover:bg-[#01ADFB]/10", servicesDialogButtonClass)}>
                                + Añadir fotos
                              </Button>
                            ) : null}
                          </div>
                        </div>
                        {evidenceImages.length > 0 ? (
                          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                            {evidenceImages.map((evidence, idx) => (
                              <a key={evidence.url} href={evidence.url} target="_blank" rel="noopener noreferrer" className="relative h-20 w-28 shrink-0 overflow-hidden rounded-[4px] border border-border bg-muted/30">
                                <Image src={evidence.url} alt={`Evidencia ${idx + 1}`} fill className="object-cover" />
                                <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[8px] font-medium text-foreground">Ver</span>
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </section>
                    ) : null}
                  </div>

                  <aside className="min-w-0 space-y-5 lg:border-l lg:border-border lg:pl-5">
                    <section className={sectionClass}>
                      <SectionHeading icon={<Zap className="h-3.5 w-3.5 text-amber-500" />}>
                        Detalle del servicio
                      </SectionHeading>
                      <div className="space-y-3">
                        <InfoCell label="Empresa" className="md:px-0">{selectedServicio.raw.empresa?.nombre || "N/A"}</InfoCell>
                        <InfoCell label="Tipo visita" className="md:px-0">{formatVisitTypeLabel(selectedServicio.raw.tipoVisita)}</InfoCell>
                        <InfoCell label="Servicio específico" className="md:px-0">{selectedServicesLabel}</InfoCell>
                        <InfoCell label="Técnico asignado" className="md:px-0" valueClassName={selectedServicio.tecnico === "Sin asignar" ? "text-orange-600 italic" : undefined}>{selectedServicio.tecnico}</InfoCell>
                        <div className={cn(openGridClass, "md:grid-cols-2")}>
                          <InfoCell label="Prioridad">{selectedServicio.urgencia || "N/A"}</InfoCell>
                          <InfoCell label="Facturación">{selectedServicio.raw.tipoFacturacion || "N/A"}</InfoCell>
                        </div>
                        <InfoCell label="Frecuencia sugerida" className="md:px-0">{selectedServicio.raw.frecuenciaSugerida ? `${selectedServicio.raw.frecuenciaSugerida} días` : "N/A"}</InfoCell>
                        {selectedServicio.raw.ordenPadreId ? <InfoCell label="Orden madre" className="md:px-0">{parentOrderLabel}</InfoCell> : null}
                      </div>
                    </section>

                    <section className={sectionClass}>
                      <SectionHeading icon={<Calendar className="h-3.5 w-3.5 text-[#01ADFB]" />}>
                        Programación
                      </SectionHeading>
                      <div className={cn(openGridClass, "md:grid-cols-3 lg:grid-cols-1 lg:divide-x-0 lg:divide-y")}>
                        <InfoCell label="Fecha de visita">{selectedServicio.fecha}</InfoCell>
                        <InfoCell label="Hora inicio">{selectedServicio.hora}</InfoCell>
                        <InfoCell label="Hora fin">{selectedServicio.raw.horaFin ? formatBogotaTime(selectedServicio.raw.horaFin) : "Sin hora"}</InfoCell>
                      </div>
                    </section>

                    <section className={sectionClass}>
                      <SectionHeading icon={<CreditCard className="h-3.5 w-3.5 text-emerald-600" />}>
                        Información financiera
                      </SectionHeading>
                      <div className="space-y-3">
                        <div className={cn(openGridClass, "md:grid-cols-3 lg:grid-cols-1 lg:divide-x-0 lg:divide-y")}>
                          <InfoCell label="Valor cotizado">{formatMoney(selectedServicio.raw.valorCotizado)}</InfoCell>
                          <InfoCell label="Valor repuestos">{formatMoney(selectedServicio.raw.valorRepuestos ?? 0)}</InfoCell>
                          <InfoCell label="Valor pagado" valueClassName={paidValue > 0 ? "text-emerald-600" : "text-muted-foreground"}>{formatMoney(paidValue)}</InfoCell>
                        </div>
                        <div className={cn(openGridClass, "md:grid-cols-2 lg:grid-cols-1 lg:divide-x-0 lg:divide-y")}>
                          <InfoCell label="Método de pago">{selectedServicio.raw.metodoPago?.nombre || "N/A"}</InfoCell>
                          <InfoCell label="Estado pago" valueClassName={selectedServicio.raw.estadoPago === "PAGADO" ? "text-emerald-600" : "text-amber-600"}>{selectedServicio.raw.estadoPago || "Pendiente"}</InfoCell>
                        </div>
                        <div className={cn(openGridClass, "md:grid-cols-2 lg:grid-cols-1 lg:divide-x-0 lg:divide-y")}>
                          <InfoCell label="Entidad financiera">{selectedServicio.raw.entidadFinanciera?.nombre || "N/A"}</InfoCell>
                          <InfoCell label="Referencia pago">{selectedServicio.raw.referenciaPago || "N/A"}</InfoCell>
                        </div>
                        <InfoCell label="Fecha pago" className="md:px-0">{paymentDateLabel}</InfoCell>
                      </div>
                    </section>

                    {hasPaymentSupport ? (
                      <section className={sectionClass}>
                        <SectionHeading icon={<FileText className="h-3.5 w-3.5 text-orange-500" />}>
                          Soportes
                        </SectionHeading>
                        <div className="grid grid-cols-1 gap-2">
                          {selectedServicio.raw.facturaElectronica ? (() => {
                            const path = getSoportePagoPath(selectedServicio.raw.facturaElectronica);
                            const isOpening = openingStoragePath === `${selectedServicio.raw.id}:${path}`;

                            return (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-auto min-h-8 justify-start rounded-[4px] border-orange-200 bg-transparent px-2.5 py-1.5 text-[10px] font-medium text-orange-700 hover:bg-orange-50"
                                disabled={isOpening}
                                onClick={() => openFreshStorageUrl(selectedServicio.raw.id, selectedServicio.raw.facturaElectronica, "factura")}
                              >
                                {isOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                                Ver factura
                              </Button>
                            );
                          })() : null}
                          {Array.isArray(comprobantePago) ? (
                            comprobantePago.map((soporte, i) => {
                              const path = getSoportePagoPath(soporte.path);
                              const isOpening = openingStoragePath === `${selectedServicio.raw.id}:${path}`;

                              return (
                                <Button
                                  type="button"
                                  key={i}
                                  variant="outline"
                                  className="h-auto min-h-8 justify-start rounded-[4px] border-blue-200 bg-transparent px-2.5 py-1.5 text-[10px] font-medium text-blue-700 hover:bg-blue-50"
                                  disabled={isOpening}
                                  onClick={() => openFreshStorageUrl(selectedServicio.raw.id, soporte.path, "comprobante")}
                                >
                                  {isOpening ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                                  Comprobante #{i + 1}
                                </Button>
                              );
                            })
                          ) : typeof comprobantePago === "string" ? (
                            <Button
                              type="button"
                              variant="outline"
                              className="h-auto min-h-8 justify-start rounded-[4px] border-blue-200 bg-transparent px-2.5 py-1.5 text-[10px] font-medium text-blue-700 hover:bg-blue-50"
                              disabled={openingStoragePath === `${selectedServicio.raw.id}:${getSoportePagoPath(comprobantePago)}`}
                              onClick={() => openFreshStorageUrl(selectedServicio.raw.id, comprobantePago, "comprobante")}
                            >
                              {openingStoragePath === `${selectedServicio.raw.id}:${getSoportePagoPath(comprobantePago)}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Receipt className="h-3.5 w-3.5" />}
                              Ver comprobante
                            </Button>
                          ) : null}
                        </div>
                      </section>
                    ) : null}
                  </aside>
                </div>
              </div>
            );
          })()}
        </div>

        {selectedServicio && (
          <div className="z-10 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 shadow-[0_-10px_20px_rgba(0,0,0,0.03)]">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className={cn("border-border bg-card px-4 shadow-sm hover:bg-muted", servicesDialogButtonClass)}>
              Cerrar
            </Button>

            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              {/* ACCIÓN PRINCIPAL SEGÚN ESTADO */}
              {(() => {
                const settlementMeta = getSettlementFlowMeta(selectedServicio.raw);
                const financialLock = settlementMeta.financialLock;

                if (selectedServicio.raw.liquidadoAt || selectedServicio.raw.estadoServicio === "LIQUIDADO") {
                  return (
                    <Button 
                      onClick={() => setIsViewLiquidationModalOpen(true)}
                      className="h-8 shrink-0 rounded-[4px] bg-emerald-600 px-4 text-[10px] font-medium tracking-[0.08em] text-white shadow-sm shadow-emerald-600/20 hover:bg-emerald-700"
                    >
                      <Receipt className="h-3.5 w-3.5" /> Ver liquidación
                    </Button>
                  );
                }

                if (!selectedServicio.raw.fechaVisita) return null;

                return (
                  <Button
                    disabled={financialLock.locked}
                    onClick={() => {
                      void handleLiquidateAction(selectedServicio);
                    }}
                    className={cn(
                      "h-8 shrink-0 rounded-[4px] px-4 text-[10px] font-medium tracking-[0.08em] shadow-sm",
                      settlementMeta.accent === "sky" && "bg-sky-600 text-white shadow-sky-600/20 hover:bg-sky-700",
                      settlementMeta.accent === "blue" && "bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-700",
                      settlementMeta.accent === "emerald" && "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700",
                    )}
                  >
                    {settlementMeta.isFuture ? <CreditCard className="h-3.5 w-3.5" /> : settlementMeta.hasCash ? <Wallet className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    {settlementMeta.title}
                  </Button>
                );
              })()}

              {/* ACCIÓN DE SEGUIMIENTO SI ES FOLLOW-UP */}
              {selectedServicio.isFollowUp && (
                <Button 
                  onClick={() => openFollowUpModal(selectedServicio as unknown as FollowUpRow)}
                  className="h-8 shrink-0 rounded-[4px] bg-amber-500 px-4 text-[10px] font-medium tracking-[0.08em] text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Registrar llamada
                </Button>
              )}

            {canEditServices || canManageServices ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border-border bg-card p-0 shadow-sm hover:bg-muted">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className={cn("w-[200px]", servicesDropdownContentClass)}>
                  <p className="mb-1 border-b border-border px-2 pb-2 pt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Opciones</p>
  {canEditServices && canEditOrdenTecnica(selectedServicio.raw) ? (
    <DropdownMenuItem onClick={() => router.push(`/dashboard/servicios/${selectedServicio.raw.id}/editar?returnTo=${encodedServiciosReturnTo}`)} className={servicesDropdownItemClass}>
      <Pencil className="h-3.5 w-3.5 text-amber-600" /> Editar orden técnica
    </DropdownMenuItem>
  ) : null}
                  {canManageServices ? (
                    <>
                      <DropdownMenuItem onClick={() => { setSelectedServicio(selectedServicio); setIsVisitaModalOpen(true); }} className={servicesDropdownItemClass}>
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" /> Ver ruta geográfica
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="my-2" />
                      <DropdownMenuItem onClick={() => openDeleteModal(selectedServicio)} className="flex cursor-pointer items-center gap-3 rounded-[4px] py-2 text-[11px] font-medium text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-3.5 w-3.5" /> Anular registro
                      </DropdownMenuItem>
                    </>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            </div>
          </div>
        )}
      </DialogContent></Dialog>

      <Dialog open={isDeleteModalOpen} onOpenChange={(open) => { if (!open) closeDeleteModal(); }}>
        <DialogContent className={cn("max-w-xl", servicesDialogContentClass)}>
          <DialogHeader className={servicesDialogHeaderClass}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-destructive/20 bg-destructive/10 text-destructive">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className={servicesDialogTitleClass}>Anular servicio</DialogTitle>
                <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>
                  La orden sale del flujo operativo y conserva su historial para auditoría.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {deleteTarget ? (
            <>
            <div className={cn("space-y-4", servicesDialogBodyClass)}>
              <div className="space-y-1.5 rounded-[5px] border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-destructive">Servicio a anular</p>
                <p className={cn("text-[13px] font-medium text-foreground", servicesTextWrapClass)}>#{deleteTarget.id} · {deleteTarget.cliente}</p>
                <p className={cn("text-[11px] font-medium text-muted-foreground", servicesTextWrapClass)}>{deleteTarget.servicioEspecifico} · {deleteTarget.fecha} · {deleteTarget.hora}</p>
              </div>

              <div className="space-y-2">
                <Label className={servicesDialogLabelClass}>
                  Observación obligatoria
                </Label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Ej: Orden duplicada, creada por error, reprogramada en una nueva orden..."
                  className="min-h-[128px] w-full rounded-[4px] border border-border bg-background px-3 py-2 text-[12px] font-medium text-foreground outline-none transition focus:border-destructive"
                  disabled={isDeletingServicio}
                />
                <p className="text-xs text-muted-foreground">
                  Se bloqueará la anulación si la orden ya tiene impacto financiero, nómina o servicios hijos activos.
                </p>
              </div>
            </div>
              <div className={cn("flex gap-2", servicesDialogFooterClass)}>
                <Button
                  variant="outline"
                  onClick={() => closeDeleteModal()}
                  className={cn("flex-1 border-border bg-card", servicesDialogButtonClass)}
                  disabled={isDeletingServicio}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleDeleteServicio}
                  className={cn("flex-1 bg-destructive text-white hover:bg-destructive/90", servicesDialogButtonClass)}
                  disabled={isDeletingServicio}
                >
                  {isDeletingServicio ? "Anulando..." : "Confirmar anulación"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={canManageServices && isLiquidarModalOpen} onOpenChange={setIsLiquidarModalOpen}>
        <DialogContent className={cn("flex max-h-[92vh] w-[min(96vw,72rem)] max-w-5xl flex-col", servicesDialogContentClass)}>
          <div className={cn("shrink-0", servicesDialogHeaderClass)}>
            <DialogHeader>
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/50 text-emerald-600">
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <DialogTitle className={cn(servicesDialogTitleClass, servicesTextWrapClass)}>
                    {selectedServicio ? getSettlementFlowMeta(selectedServicio.raw).title : "Registrar movimiento"}
                  </DialogTitle>
                  <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>
                    {selectedServicio
                      ? getSettlementFlowMeta(selectedServicio.raw).description
                      : "Registro operativo del movimiento financiero de la orden."}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
          </div>

          {selectedServicio
              ? (() => {
                  const settlementMeta = getSettlementFlowMeta(selectedServicio.raw);
                  const hasTransferSupport = hasStoredTransferEvidence(selectedServicio.raw);

                  return (
                    <>
                      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar md:px-6">
                        <div className="space-y-5">
                        {settlementMeta.financialLock.locked ? (
                          <div className="rounded-[5px] border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em]">Orden congelada</p>
                            <p className="mt-1 font-medium">{settlementMeta.financialLock.reason}</p>
                          </div>
                        ) : null}

                        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                          <div className="rounded-[5px] border border-emerald-500/20 bg-emerald-500/5 p-4 md:p-5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{settlementMeta.summaryLabel}</p>
                            <div className="mt-2 flex items-end justify-between gap-4">
                              <p className="text-3xl font-bold leading-none text-emerald-600 md:text-[2.5rem]">
                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(selectedServicio.raw.valorCotizado || 0)}
                              </p>
                              <CheckCircle2 className="h-9 w-9 shrink-0 text-emerald-500/30 md:h-10 md:w-10" />
                            </div>
                          </div>

                          <div className="rounded-[5px] border border-border bg-muted/20 px-4 py-3 text-xs font-medium leading-relaxed text-muted-foreground">
                            {settlementMeta.isFuture
                              ? "Este registro deja la orden programada. No representa cierre ni conciliación final."
                              : settlementMeta.hasTransfer
                                ? settlementMeta.hasCash
                                  ? hasTransferSupport
                                    ? "La parte de transferencia ya tiene soporte cargado. El efectivo sigue su ruta de recaudo."
                                    : "La parte de transferencia requiere comprobante, referencia y observación. El efectivo sigue su ruta de recaudo."
                                  : hasTransferSupport
                                    ? "La transferencia ya tiene soporte cargado. Podés cerrar la orden con esa evidencia."
                                    : "La transferencia requiere comprobante, referencia y observación antes de cerrar la orden."
                                : "Este registro declara recaudo. Contabilidad recalcula y valida antes de conciliar."}
                          </div>
                        </div>

                        <div className="space-y-3">
                          <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Desglose de Pago</Label>
                          <div className="space-y-3">
                            {liquidarData.breakdown.map((item, idx) => (
                              <div key={idx} className="rounded-[5px] border border-border bg-muted/30 p-3 md:p-4">
                                <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
                                  <div className="space-y-2 min-w-0">
                                    <Label className="text-[9px] font-semibold uppercase text-muted-foreground">Método</Label>
                                      <select
                                        value={item.metodo}
                                      onChange={(e) =>
                                        setLiquidarData((prev) => {
                                          const newBreakdown = [...prev.breakdown];
                                          newBreakdown[idx].metodo = e.target.value;

                                          return { ...prev, breakdown: newBreakdown };
                                        })
                                      }
                                      className="h-10 w-full rounded-[5px] border border-border bg-background px-3 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                      {PAYMENT_METHOD_OPTIONS.map((m) => (
                                        <option key={m.id} value={m.nombre}>
                                          {m.nombre.toUpperCase()}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="space-y-2 min-w-0">
                                    <Label className="text-[9px] font-semibold uppercase text-muted-foreground">Monto ($)</Label>
                                      <Input
                                        placeholder="0"
                                        value={item.monto}
                                      onChange={(e) =>
                                        setLiquidarData((prev) => {
                                          const val = e.target.value
                                            .replace(/\D/g, "")
                                            .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                                          const newBreakdown = [...prev.breakdown];
                                          newBreakdown[idx].monto = val;

                                          return { ...prev, breakdown: newBreakdown };
                                        })
                                      }
                                      className="h-10 bg-background font-bold text-sm"
                                    />
                                  </div>

                                  {liquidarData.breakdown.length > 1 && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      onClick={() =>
                                        setLiquidarData((prev) => ({
                                          ...prev,
                                          breakdown: prev.breakdown.filter((_, i) => i !== idx),
                                        }))
                                      }
                                      className="h-10 w-full rounded-[5px] border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white transition-all md:w-10 shrink-0"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setLiquidarData(prev => ({
                                ...prev,
                                breakdown: [...prev.breakdown, { metodo: PAYMENT_METHOD_OPTIONS[0]?.nombre || "EFECTIVO", monto: "" }]
                              }));
                            }}
                            className="h-10 w-full rounded-[5px] border-2 border-dashed text-[10px] font-semibold uppercase tracking-[0.12em] gap-2 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <Plus className="h-4 w-4" /> Agregar Método de Pago
                          </Button>
                        </div>

                        <div className="space-y-4">
                          {liquidarData.breakdown.some((item) => item.metodo === "TRANSFERENCIA") ||
                          liquidarData.transferencias.length > 0 ? (
                            <div className="space-y-4">
                              <div className="flex flex-col gap-3 rounded-[5px] border border-border bg-muted/10 p-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="min-w-0">
                                  <Label className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                    Transferencias
                                  </Label>
                                  <p className="mt-1 max-w-2xl text-[10px] font-medium leading-relaxed text-muted-foreground">
                                    Podés ver las ya registradas y cargar una segunda o tercera transferencia con su banco y comprobante.
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setLiquidarData((prev) => ({
                                      ...prev,
                                      transferencias: [...prev.transferencias, createTransferenciaForm()],
                                    }))
                                  }
                                  className="h-9 rounded-[5px] border-dashed px-3 text-[10px] font-semibold uppercase tracking-[0.12em] lg:shrink-0"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Agregar transferencia
                                </Button>
                              </div>

                              <div className="space-y-3">
                                {liquidarData.transferencias.map((transferencia, idx) => (
                                  <div key={transferencia.id} className="rounded-[5px] border border-border bg-muted/20 p-3 md:p-4">
                                    {(() => {
                                      return (
                                        <>
                                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                                          Transferencia #{idx + 1}
                                        </p>
                                        <p className="text-[10px] font-medium text-muted-foreground">
                                          {transferencia.persisted
                                            ? "Transferencia registrada: podés validar o corregir sus datos antes de conciliar."
                                            : "Nueva transferencia a registrar"}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {transferencia.persisted ? (
                                          <span className="rounded-[4px] border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
                                            Registrada
                                          </span>
                                        ) : liquidarData.transferencias.filter((item) => !item.persisted).length > 1 ? (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() =>
                                              setLiquidarData((prev) => ({
                                                ...prev,
                                                transferencias: prev.transferencias.filter((item) => item.id !== transferencia.id),
                                              }))
                                            }
                                            className="h-9 w-9 rounded-[5px] border-destructive/20 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white"
                                          >
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        ) : null}
                                      </div>
                                    </div>

                                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                      <div className="space-y-2 min-w-0">
                                        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Monto</Label>
                                        <Input
                                          value={transferencia.monto}
                                          onChange={(e) =>
                                            setLiquidarData((prev) => ({
                                              ...prev,
                                              transferencias: prev.transferencias.map((item) =>
                                                item.id === transferencia.id
                                                  ? {
                                                      ...item,
                                                      monto: e.target.value
                                                        .replace(/\D/g, "")
                                                        .replace(/\B(?=(\d{3})+(?!\d))/g, "."),
                                                    }
                                                  : item,
                                              ),
                                            }))
                                          }
                                          placeholder="Ej. 50.000"
                                          className="h-10 bg-background font-bold text-sm"
                                        />
                                      </div>

                                      <div className="space-y-2 min-w-0">
                                        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Fecha de pago</Label>
                                        <Input
                                          type="date"
                                          value={transferencia.fechaPago}
                                          onChange={(e) =>
                                            setLiquidarData((prev) => ({
                                              ...prev,
                                              transferencias: prev.transferencias.map((item) =>
                                                item.id === transferencia.id ? { ...item, fechaPago: e.target.value } : item,
                                              ),
                                            }))
                                          }
                                          className="h-10 bg-background text-sm font-medium"
                                        />
                                      </div>

                                      <div className="space-y-2 min-w-0">
                                        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Referencia</Label>
                                        <Input
                                          value={transferencia.referenciaPago}
                                          onChange={(e) =>
                                            setLiquidarData((prev) => ({
                                              ...prev,
                                              transferencias: prev.transferencias.map((item) =>
                                                item.id === transferencia.id ? { ...item, referenciaPago: e.target.value } : item,
                                              ),
                                            }))
                                          }
                                          placeholder="Ej. 94839274"
                                          className="h-10 bg-background font-bold text-sm"
                                        />
                                      </div>

                                      <div className="space-y-2 min-w-0">
                                        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Banco</Label>
                                        <Combobox
                                          value={transferencia.banco.trim()}
                                          onChange={(value) =>
                                            setLiquidarData((prev) => ({
                                              ...prev,
                                              transferencias: prev.transferencias.map((item) =>
                                                item.id === transferencia.id ? { ...item, banco: value } : item,
                                              ),
                                            }))
                                          }
                                          options={getBankComboboxOptions(transferencia.banco)}
                                          placeholder="Seleccioná banco"
                                          emptyMessage="No encontramos ese banco."
                                          triggerClassName="h-10 border-border bg-background text-sm font-medium"
                                          contentClassName="z-[70]"
                                        />
                                      </div>

                                      <div className="space-y-2 sm:col-span-2 xl:col-span-2 min-w-0">
                                        <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Comprobante</Label>
                                        {transferencia.existingPath ? (
                                          <div className="space-y-2">
                                            <button
                                              type="button"
                                              disabled={
                                                openingStoragePath ===
                                                `${selectedServicio.raw.id}:${getSoportePagoPath(transferencia.existingPath)}`
                                              }
                                              onClick={() =>
                                                openFreshStorageUrl(
                                                  selectedServicio.raw.id,
                                                  transferencia.existingPath,
                                                  "comprobante",
                                                )
                                              }
                                              className="flex h-10 items-center gap-2 rounded-[5px] border border-emerald-500/20 bg-emerald-500/5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700"
                                            >
                                              {openingStoragePath ===
                                              `${selectedServicio.raw.id}:${getSoportePagoPath(transferencia.existingPath)}` ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                              ) : (
                                                <ExternalLink className="h-3.5 w-3.5" />
                                              )}
                                              Ver comprobante cargado
                                            </button>
                                            <Input
                                              type="file"
                                              accept="application/pdf,image/*"
                                              ref={(node) => {
                                                if (node) {
                                                  transferenciaFileInputRefs.current[transferencia.id] = node;
                                                  return;
                                                }

                                                delete transferenciaFileInputRefs.current[transferencia.id];
                                              }}
                                              onChange={(e) =>
                                                setLiquidarData((prev) => ({
                                                  ...prev,
                                                  transferencias: prev.transferencias.map((item) =>
                                                    item.id === transferencia.id
                                                      ? { ...item, comprobanteFile: e.target.files?.[0] || null }
                                                      : item,
                                                  ),
                                                }))
                                              }
                                              className="h-10 bg-background py-1 font-medium text-sm file:mr-3 file:h-8 file:rounded-[5px] file:border-0 file:bg-amber-600 file:px-3 file:text-xs file:font-bold file:text-white"
                                            />
                                            {transferencia.comprobanteFile ? (
                                              <p className="text-[10px] font-medium text-amber-700">
                                                Nuevo comprobante listo para reemplazar el actual: {transferencia.comprobanteFile.name}
                                              </p>
                                            ) : null}
                                          </div>
                                        ) : (
                                          <Input
                                            type="file"
                                            accept="application/pdf,image/*"
                                            ref={(node) => {
                                              if (node) {
                                                transferenciaFileInputRefs.current[transferencia.id] = node;
                                                return;
                                              }

                                              delete transferenciaFileInputRefs.current[transferencia.id];
                                            }}
                                            onChange={(e) =>
                                              setLiquidarData((prev) => ({
                                                ...prev,
                                                transferencias: prev.transferencias.map((item) =>
                                                  item.id === transferencia.id
                                                    ? { ...item, comprobanteFile: e.target.files?.[0] || null }
                                                    : item,
                                                ),
                                              }))
                                            }
                                            className="h-10 bg-background py-1 font-medium text-sm file:mr-3 file:h-8 file:rounded-[5px] file:border-0 file:bg-emerald-600 file:px-3 file:text-xs file:font-bold file:text-white"
                                          />
                                        )}
                                      </div>
                                    </div>

                                    <div className="mt-3 space-y-2">
                                      <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Observación de transferencia</Label>
                                      <textarea
                                        value={transferencia.observacion}
                                        onChange={(e) =>
                                          setLiquidarData((prev) => ({
                                            ...prev,
                                            transferencias: prev.transferencias.map((item) =>
                                              item.id === transferencia.id ? { ...item, observacion: e.target.value } : item,
                                            ),
                                          }))
                                        }
                                        className="min-h-[72px] w-full rounded-[5px] border border-border bg-background p-3 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-70"
                                        placeholder="Notas de esta transferencia..."
                                      />
                                    </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-2">
                            <Label className="text-[10px] font-semibold uppercase text-muted-foreground">Observación de Cierre</Label>
                            <textarea
                              value={liquidarData.observacionFinal}
                              onChange={(e) =>
                                setLiquidarData((prev) => ({
                                  ...prev,
                                  observacionFinal: e.target.value,
                                }))
                              }
                              className="w-full min-h-[96px] rounded-[5px] border border-border bg-muted p-4 text-sm font-medium text-foreground outline-none focus:ring-2 focus:ring-emerald-500/20"
                              placeholder="Notas adicionales..."
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className={cn("shrink-0", servicesDialogFooterClass)}>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setIsLiquidarModalOpen(false)} className={cn("flex-1 border-border bg-card", servicesDialogButtonClass)}>Cancelar</Button>
                        <Button
                          onClick={handleLiquidar}
                          disabled={isUploading || settlementMeta.financialLock.locked}
                          className={cn(
                            "flex-1 shadow-sm",
                            servicesDialogButtonClass,
                            settlementMeta.accent === "emerald" && "bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700",
                            settlementMeta.accent === "blue" && "bg-blue-600 text-white shadow-blue-600/20 hover:bg-blue-700",
                            settlementMeta.accent === "sky" && "bg-sky-600 text-white shadow-sky-600/20 hover:bg-sky-700",
                          )}
                        >
                          {isUploading ? "Procesando..." : settlementMeta.submitLabel}
                        </Button>
                      </div>
                    </div>
                  </>
                );
              })()
            : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={isFollowUpModalOpen}
        onOpenChange={(open) => {
          if (!savingFollowUp) {
            setIsFollowUpModalOpen(open);
            if (!open) {
              setSelectedFollowUp(null);
              setSelectedFollowUpRecordId(null);
            }
          }
        }}
      >
        <DialogContent className={cn("flex max-h-[90vh] max-w-4xl flex-col", servicesDialogContentClass)}>
          <DialogHeader className={cn("shrink-0", servicesDialogHeaderClass)}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/50 text-amber-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className={servicesDialogTitleClass}>Gestionar seguimientos</DialogTitle>
                <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>
                  Registrá llamadas, corregí gestiones previas y revisá las acciones pendientes del servicio.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedFollowUp ? (
            <>
              <div className={cn("min-h-0 flex-1 space-y-4 overflow-y-auto custom-scrollbar", servicesDialogBodyClass)}>
              <div className="rounded-[5px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-emerald-700">Seguimiento seleccionado</p>
                <div className="mt-2 space-y-1">
                  <p className={cn("text-[13px] font-medium text-foreground", servicesTextWrapClass)}>{selectedFollowUp.cliente}</p>
                  <p className={cn("text-[12px] text-muted-foreground", servicesTextWrapClass)}>{selectedFollowUp.servicioEspecifico}</p>
                  <p className="text-xs font-medium text-muted-foreground">Programado para {selectedFollowUp.fecha} a las {selectedFollowUp.hora}</p>
                </div>
              </div>

              {hasLatestSelectedRejection && latestSelectedCompletedFollowUp ? (
                <div className="rounded-[5px] border border-rose-300 bg-rose-50 px-5 py-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[5px] border border-rose-200 bg-white text-rose-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-rose-700">
                        Antes de volver a llamar
                      </p>
                      <p className="mt-1 text-sm font-bold uppercase text-rose-950">
                        La última gestión quedó marcada como RECHAZADO
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-rose-700/80">
                        {formatBogotaDateTime(latestSelectedCompletedFollowUp.completedAt || latestSelectedCompletedFollowUp.contactedAt || selectedFollowUp.raw.createdAt)} · {formatFollowUpLabel(latestSelectedCompletedFollowUp.channel, "LLAMADA")} · {formatFollowUpLabel(latestSelectedCompletedFollowUp.outcome, "SIN RESULTADO")}
                      </p>
                      <p className="mt-2 text-sm text-rose-900">
                        No gestiones esta acción a ciegas: revisá la observación anterior para no llamar dos veces a un cliente que ya rechazó.
                      </p>
                      {latestSelectedCompletedFollowUp.notes ? (
                        <div className="mt-3 rounded-[5px] border border-rose-200 bg-white/70 px-4 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-rose-700">
                            Observación del rechazo
                          </p>
                          <p className="mt-1 line-clamp-3 text-sm text-rose-950">
                            {latestSelectedCompletedFollowUp.notes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div
                  className={cn(
                    "rounded-[5px] border px-4 py-4",
                    hasLatestSelectedRejection
                      ? "border-rose-200 bg-rose-50/70"
                      : "border-emerald-200 bg-emerald-50/70",
                  )}
                >
                  <p
                    className={cn(
                      "text-[10px] font-semibold uppercase tracking-[0.14em]",
                      hasLatestSelectedRejection ? "text-rose-700" : "text-emerald-700",
                    )}
                  >
                    Llamadas registradas
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{selectedCompletedFollowUps.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {latestSelectedCompletedFollowUp
                      ? `Última decisión ${formatFollowUpLabel(latestSelectedCompletedFollowUp.status, "GESTIONADO")} · ${formatBogotaDateTime(latestSelectedCompletedFollowUp.completedAt || latestSelectedCompletedFollowUp.contactedAt || selectedFollowUp.raw.createdAt)}`
                      : "Todavía no hay llamadas registradas"}
                  </p>
                </div>
                <div className="rounded-[5px] border border-amber-200 bg-amber-50/70 px-4 py-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">Acciones pendientes</p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{selectedPendingFollowUps.length}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedPendingFollowUps[0]
                      ? `Próxima acción ${formatBogotaDate(selectedPendingFollowUps[0].dueAt || selectedFollowUp.raw.fechaVisita || selectedFollowUp.raw.createdAt)}`
                      : "No quedan acciones pendientes"}
                  </p>
                </div>
                <div className={cn("rounded-[5px] border px-4 py-4", isManagingPendingFollowUp ? "border-amber-200 bg-amber-50/70" : "border-sky-200 bg-sky-50/70")}>
                  <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", isManagingPendingFollowUp ? "text-amber-700" : "text-sky-700")}>
                    Registro activo
                  </p>
                  <p className="mt-2 text-sm font-bold uppercase text-foreground">
                    {isManagingPendingFollowUp ? "Acción pendiente" : "Llamada registrada"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedFollowUpRecord
                      ? `${formatFollowUpLabel(selectedFollowUpRecord.followUpType, "SEGUIMIENTO")} · ${formatFollowUpLabel(selectedFollowUpRecord.status, "PENDIENTE")}`
                      : "Elegí un registro para gestionarlo"}
                  </p>
                </div>
              </div>

              {selectedPendingFollowUps.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">Acciones pendientes</p>
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      {hasLatestSelectedRejection
                        ? "Revisá el rechazo antes de llamar"
                        : "Seleccioná una para registrarla"}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {selectedPendingFollowUps.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => syncSelectedFollowUpRecord(selectedFollowUp, item.id)}
                        className={cn(
                          "rounded-[5px] border px-4 py-4 text-left transition-all",
                          selectedFollowUpRecord?.id === item.id
                            ? hasLatestSelectedRejection
                              ? "border-rose-300 bg-rose-50 shadow-sm"
                              : "border-amber-300 bg-amber-50 shadow-sm"
                            : hasLatestSelectedRejection
                              ? "border-rose-200 bg-rose-50/40 hover:border-rose-300 hover:bg-rose-50"
                              : "border-border bg-card hover:border-amber-200 hover:bg-amber-50/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                              {formatFollowUpLabel(item.followUpType, "SEGUIMIENTO")}
                            </p>
                            <p className="text-sm font-bold uppercase text-foreground">
                              Vence {formatBogotaDate(item.dueAt || selectedFollowUp.raw.fechaVisita || selectedFollowUp.raw.createdAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Estado {formatFollowUpLabel(item.status, "PENDIENTE")}
                            </p>
                          </div>
                          <span className={cn("inline-flex items-center rounded-[4px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]", FOLLOW_UP_STATUS_STYLING[item.status || "DEFAULT"] || FOLLOW_UP_STATUS_STYLING.DEFAULT)}>
                            {formatFollowUpLabel(item.status, "PENDIENTE")}
                          </span>
                        </div>
                        {item.notes ? (
                          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.notes}</p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedCompletedFollowUps.length > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">Llamadas registradas</p>
                    <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                      Podés abrir cualquiera para revisarla o corregirla
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {selectedCompletedFollowUps.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => syncSelectedFollowUpRecord(selectedFollowUp, item.id)}
                        className={cn(
                          "rounded-[5px] border px-4 py-4 text-left transition-all",
                          selectedFollowUpRecord?.id === item.id
                            ? item.status === "RECHAZADO"
                              ? "border-rose-300 bg-rose-50 shadow-sm"
                              : "border-emerald-300 bg-emerald-50 shadow-sm"
                            : item.status === "RECHAZADO"
                              ? "border-rose-200 bg-rose-50/60 hover:border-rose-300 hover:bg-rose-50"
                              : "border-border bg-card hover:border-emerald-200 hover:bg-emerald-50/50",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <p
                              className={cn(
                                "text-[10px] font-semibold uppercase tracking-[0.14em]",
                                item.status === "RECHAZADO" ? "text-rose-700" : "text-emerald-700",
                              )}
                            >
                              {formatFollowUpLabel(item.channel, "LLAMADA")}
                            </p>
                            <p className="text-sm font-bold uppercase text-foreground">
                              {formatBogotaDateTime(item.completedAt || item.contactedAt || selectedFollowUp.raw.createdAt)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatFollowUpLabel(item.outcome, "SIN RESULTADO")} · {formatFollowUpLabel(item.status, "GESTIONADO")}
                            </p>
                          </div>
                          <span className={cn("inline-flex items-center rounded-[4px] border px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]", FOLLOW_UP_STATUS_STYLING[item.status || "DEFAULT"] || FOLLOW_UP_STATUS_STYLING.DEFAULT)}>
                            {formatFollowUpLabel(item.status, "GESTIONADO")}
                          </span>
                        </div>
                        {item.notes ? (
                          <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{item.notes}</p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className={cn("rounded-[5px] border px-4 py-4", isManagingPendingFollowUp ? "border-amber-200 bg-amber-50/70" : "border-sky-200 bg-sky-50/70")}>
                <p className={cn("text-[10px] font-semibold uppercase tracking-[0.14em]", isManagingPendingFollowUp ? "text-amber-700" : "text-sky-700")}>
                  {isManagingPendingFollowUp ? "Gestión en curso" : "Edición de llamada"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-foreground">
                  <span>{formatFollowUpLabel(selectedFollowUpRecord?.followUpType, "SEGUIMIENTO")}</span>
                  <span className="text-muted-foreground">•</span>
                  <span>{formatFollowUpLabel(selectedFollowUpRecord?.status, isManagingPendingFollowUp ? "PENDIENTE" : "GESTIONADO")}</span>
                  {selectedFollowUpRecord?.dueAt ? (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span>Vence {formatBogotaDate(selectedFollowUpRecord.dueAt)}</span>
                    </>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {isManagingPendingFollowUp && hasLatestSelectedRejection
                    ? "Hay una acción pendiente, pero la última llamada fue rechazada. Confirmá la observación antes de volver a contactar al cliente."
                    : isManagingPendingFollowUp
                      ? "Completá esta acción pendiente y, si hace falta, dejá programada la próxima gestión."
                      : "Acá podés revisar o corregir una llamada ya registrada sin perder el historial visible en la TAB."}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fecha y hora de contacto</Label>
                  <Input type="datetime-local" value={followUpForm.contactedAt} onChange={(e) => setFollowUpForm((current) => ({ ...current, contactedAt: e.target.value }))} className="h-11 rounded-[5px] border-border font-medium" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Canal</Label>
                  <Combobox
                    value={followUpForm.channel}
                    onChange={(value) => setFollowUpForm((current) => ({ ...current, channel: value }))}
                    options={[
                      { value: "LLAMADA", label: "LLAMADA" },
                      { value: "WHATSAPP", label: "WHATSAPP" },
                      { value: "CORREO", label: "CORREO" },
                      { value: "VISITA", label: "VISITA" },
                    ]}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Resultado</Label>
                  <Combobox
                    value={followUpForm.outcome}
                    onChange={(value) => setFollowUpForm((current) => ({ ...current, outcome: value }))}
                    options={[
                      { value: "CONTACTADO", label: "CONTACTADO" },
                      { value: "NO_CONTESTA", label: "NO CONTESTA" },
                      { value: "REPROGRAMAR", label: "REPROGRAMAR" },
                      { value: "CIERRE_EXITOSO", label: "CIERRE EXITOSO" },
                      { value: "REQUIERE_ESCALACION", label: "REQUIERE ESCALACION" },
                    ]}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Decisión del cliente</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      type="button"
                      variant={followUpForm.resolution === "ACEPTADO" ? "default" : "outline"}
                      onClick={() => setFollowUpForm((current) => ({ ...current, resolution: "ACEPTADO" }))}
                      className="h-11 rounded-[5px] text-[10px] font-semibold uppercase tracking-[0.12em]"
                    >
                      Aceptado
                    </Button>
                    <Button
                      type="button"
                      variant={followUpForm.resolution === "RECHAZADO" ? "destructive" : "outline"}
                      onClick={() => setFollowUpForm((current) => ({ ...current, resolution: "RECHAZADO" }))}
                      className="h-11 rounded-[5px] text-[10px] font-semibold uppercase tracking-[0.12em]"
                    >
                      Rechazado
                    </Button>
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Notas</Label>
                  <textarea
                    value={followUpForm.notes}
                    onChange={(e) => setFollowUpForm((current) => ({ ...current, notes: e.target.value }))}
                    placeholder="Ej: Se llamó al cliente, confirmó satisfacción y no requiere nueva visita."
                    className="min-h-[120px] w-full rounded-[5px] border border-border bg-background px-4 py-3 text-sm font-medium text-foreground outline-none transition focus:border-[#01ADFB]"
                  />
                </div>
                {isManagingPendingFollowUp ? (
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Programar próxima acción</Label>
                    <Input type="datetime-local" value={followUpForm.nextActionAt} onChange={(e) => setFollowUpForm((current) => ({ ...current, nextActionAt: e.target.value }))} className="h-11 rounded-[5px] border-border font-medium" />
                    <p className="text-xs text-muted-foreground">
                      Si completás este seguimiento pero necesitás otra gestión, dejá acá la nueva fecha y se creará una acción pendiente.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[5px] border border-sky-200 bg-sky-50/70 px-4 py-4 md:col-span-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700">Edición segura</p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Estás corrigiendo una llamada ya registrada. La fecha original de cierre se conserva para proteger la trazabilidad.
                    </p>
                  </div>
                )}
              </div>

              </div>

              <div className={cn("shrink-0 flex justify-end gap-2", servicesDialogFooterClass)}>
                <Button type="button" variant="outline" onClick={() => { setIsFollowUpModalOpen(false); setSelectedFollowUp(null); setSelectedFollowUpRecordId(null); }} disabled={savingFollowUp} className={servicesDialogButtonClass}>Cancelar</Button>
                <Button type="button" onClick={handleCompleteFollowUp} disabled={savingFollowUp} className={cn("bg-emerald-600 text-white hover:bg-emerald-700", servicesDialogButtonClass)}>
                  {savingFollowUp
                    ? "Guardando..."
                    : isManagingPendingFollowUp
                      ? "Guardar gestión"
                      : "Actualizar llamada"}
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={isVisitaModalOpen} onOpenChange={setIsVisitaModalOpen}>
        <DialogContent className={cn("max-h-[90vh] max-w-4xl overflow-y-auto custom-scrollbar", servicesDialogContentClass)}>
          <DialogHeader className={servicesDialogHeaderClass}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/50 text-emerald-600">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className={servicesDialogTitleClass}>Evidencia de visita</DialogTitle>
                <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>Trazabilidad geográfica y fotográfica del servicio.</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          {selectedServicio && (
            <div className={cn("space-y-4", servicesDialogBodyClass)}>
              {selectedServicioDetailLoading && !hasServicioDetailLoaded(selectedServicio) ? (
                <div className="flex items-center gap-3 rounded-[5px] border border-[#01ADFB]/20 bg-[#01ADFB]/5 px-4 py-3 text-[12px] font-medium text-[#0b6b8a]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cargando evidencia de visita...
                </div>
              ) : selectedServicio.raw.geolocalizaciones && selectedServicio.raw.geolocalizaciones.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {selectedServicio.raw.geolocalizaciones.map((geo, idx) => (
                    <div key={geo.id} className="space-y-4 rounded-[5px] border border-border bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] bg-emerald-500/10">
                            <MapPin className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground">Visita #{idx + 1}</p>
                            <p className={cn("text-[10px] font-medium text-muted-foreground", servicesTextWrapClass)}>{getGeoOperatorName(geo)}</p>
                          </div>
                        </div>
                        {geo.linkMaps && (
                          <Button variant="outline" size="sm" asChild className={cn("shrink-0 border-border bg-card px-3", servicesDialogButtonClass)}>
                            <a href={geo.linkMaps} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3.5 w-3.5" /> Ver en Maps
                            </a>
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-[4px] bg-emerald-500" />
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Llegada</p>
                            </div>
                            <p className="text-xs font-bold text-foreground">
                              {geo.llegada ? formatBogotaDateTime(geo.llegada) : "Pendiente"}
                            </p>
                          </div>
                          <div className="aspect-video relative rounded-[5px] border border-border bg-muted overflow-hidden flex items-center justify-center">
                            {geo.fotoLlegada ? (
                              <Image
                                src={resolveVisitaEvidenceUrl(geo.fotoLlegada)}
                                alt="Foto Llegada"
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="text-center space-y-2">
                                <ImageIcon className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Sin foto de llegada</p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-2 rounded-[4px] bg-red-500" />
                              <p className="text-[10px] font-semibold text-muted-foreground uppercase">Salida</p>
                            </div>
                            <p className="text-xs font-bold text-foreground">{geo.salida ? formatBogotaDateTime(geo.salida) : "Pendiente"}</p>
                          </div>
                          <div className="aspect-video relative rounded-[5px] border border-border bg-muted overflow-hidden flex items-center justify-center">
                            {geo.fotoSalida ? (
                              <Image
                                src={resolveVisitaEvidenceUrl(geo.fotoSalida)}
                                alt="Foto Salida"
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="text-center space-y-2">
                                <ImageIcon className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                                <p className="text-[10px] font-bold text-muted-foreground uppercase">Sin foto de salida</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-border grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase">Coordenadas</p>
                          <p className="font-mono text-xs font-bold text-foreground">
                            {formatGeoCoordinate(geo.latitud)}, {formatGeoCoordinate(geo.longitud)}
                          </p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-[9px] font-semibold text-muted-foreground uppercase">Duración</p>
                          <p className="text-xs font-bold text-foreground">{getGeoDurationLabel(geo)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-[5px] border border-dashed border-border bg-muted/20 py-16 text-center">
                  <MapPin className="mb-3 h-10 w-10 text-muted-foreground/30" />
                  <h3 className="text-sm font-medium text-foreground">Sin registros de geolocalización</h3>
                  <p className="mt-1 text-[11px] text-muted-foreground">El técnico no ha marcado su llegada a este servicio.</p>
                </div>
              )}
              <div className="flex justify-end border-t border-border pt-4">
                <Button variant="outline" onClick={() => setIsVisitaModalOpen(false)} className={cn("border-border bg-card px-4", servicesDialogButtonClass)}>Cerrar evidencias</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="application/pdf,image/*" disabled={isUploading} />

      {/* PANEL LATERAL: COLA OPERATIVA */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] transform flex-col border-l border-border bg-background shadow-xl transition-transform duration-300 ease-in-out",
        showOperationalQueue ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="shrink-0 border-b border-border bg-card px-5 py-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-amber-500/20 bg-amber-500/10">
                <Zap className="h-4 w-4 fill-amber-500 text-amber-600" />
              </div>
              <h2 className={cn(servicesDialogTitleClass, servicesTextWrapClass)}>Cola operativa pendiente</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setShowOperationalQueue(false)} className="h-8 w-8 shrink-0 rounded-[4px] hover:bg-muted">
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
          <p className={cn("text-[11px] leading-relaxed text-muted-foreground", servicesTextWrapClass)}>
            Priorización de despacho y ejecución diaria de servicios técnicos.
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 custom-scrollbar">
          {/* SECCIONES DE LA COLA */}
          {[
            {
              title: "Sin asignar hoy",
              items: servicios.filter(s => s.raw.fechaVisita && utcIsoToBogotaYmd(s.raw.fechaVisita) === toBogotaYmd() && !s.tecnicoId),
              color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100", icon: UserX, filterKey: "SIN_ASIGNAR_HOY"
            },
            {
              title: "Por iniciar",
              items: servicios.filter(s => s.raw.fechaVisita && utcIsoToBogotaYmd(s.raw.fechaVisita) === toBogotaYmd() && s.estadoServicio === "PROGRAMADO"),
              color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100", icon: PlayCircle, filterKey: "POR_INICIAR"
            },
            {
              title: "En ejecución",
              items: servicios.filter(s => ["PROCESO", "EN PROCESO"].includes(s.estadoServicio)),
              color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", icon: Truck, filterKey: "EN_EJECUCION"
            },
            {
              title: "Pendientes de cierre",
              items: servicios.filter(s => ["TECNICO_FINALIZO", "TECNICO FINALIZO", "TECNICO FINALIZADO"].includes(s.estadoServicio)),
              color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100", icon: CheckCircle2, filterKey: "PENDIENTES_CIERRE"
            },
            {
              title: "Con incidencia",
              items: servicios.filter(s => ["SIN_CONCRETAR", "SIN CONCRETAR"].includes(s.estadoServicio)),
              color: "text-red-600", bg: "bg-red-50", border: "border-red-100", icon: AlertTriangle, filterKey: "CON_INCIDENCIA"
            },
            {
              title: "Atrasados",
              items: servicios.filter(s => {
                const visitYmd = s.raw.fechaVisita ? utcIsoToBogotaYmd(s.raw.fechaVisita) : null;
                return visitYmd && visitYmd < toBogotaYmd() && !["LIQUIDADO", "CANCELADO", "SIN_CONCRETAR", "SIN CONCRETAR"].includes(s.estadoServicio);
              }),
              color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", icon: Clock, filterKey: "ATRASADOS"
            },
          ].map((section) => (
            <div key={section.title} className="space-y-3">
              <button
                onClick={() => toggleOperationalSection(section.filterKey)}
                className="w-full flex items-center justify-between border-b border-border pb-2 group/header"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <section.icon className={cn("h-4 w-4", section.color)} />
                  <h3 className={cn("text-[10px] font-medium uppercase tracking-[0.14em] text-foreground transition-colors group-hover/header:text-amber-600", servicesTextWrapClass)}>{section.title}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("px-2 py-0.5 rounded-[4px] text-[9px] font-semibold", section.bg, section.color)}>
                    {section.items.length}
                  </span>
                  <ChevronDown className={cn(
                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
                    expandedOperationalSections[section.filterKey] ? "rotate-0" : "-rotate-90"
                  )} />
                </div>
              </button>

              {expandedOperationalSections[section.filterKey] && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  {section.items.length === 0 ? (
                    <p className="px-2 text-[10px] italic text-muted-foreground">No hay pendientes en esta categoría.</p>
                  ) : (
                    section.items.slice(0, 5).map((s) => (
                      <div
                        key={s.raw.id}
                        className="group cursor-pointer rounded-[5px] border border-border bg-card p-3 shadow-sm transition-all hover:border-amber-500/50 hover:shadow-md"
                        onClick={() => {
                          setSelectedServicio(s);
                          setIsModalOpen(true);
                        }}
                      >
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <span className="text-[9px] font-semibold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                            #{s.id}
                          </span>
                          <span className={cn("text-[8px] font-semibold uppercase px-2 py-0.5 rounded shadow-sm", URGENCIA_STYLING[s.urgencia])}>
                            {s.urgencia}
                          </span>
                        </div>
                        <p className={cn("mb-1 text-[12px] font-medium text-foreground", servicesTextWrapClass)}>{s.cliente}</p>
                        <p className={cn("mb-3 text-[10px] font-medium text-muted-foreground", servicesTextWrapClass)}>{s.servicioEspecifico}</p>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span className="text-[9px] font-bold">{s.fecha}</span>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                        </div>
                      </div>
                    ))
                  )}
                  {section.items.length > 5 && (
                    <Button
                      variant="link"
                      className="w-full text-[9px] font-semibold uppercase text-[#01ADFB] h-auto p-0"
                      onClick={() => {
                        applyOperationalFilter(section.filterKey);
                        setShowOperationalQueue(false);
                      }}
                    >
                      Ver los {section.items.length} pendientes
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="shrink-0 border-t border-border bg-card px-5 py-3">
          <Button
            className={cn("w-full bg-amber-500 text-white shadow-sm shadow-amber-500/20 hover:bg-amber-600", servicesDialogButtonClass)}
            onClick={() => {
              resetAllFilters();
              setViewMode("servicios");
              setShowOperationalQueue(false);
            }}
          >
            Ver todos los servicios
          </Button>
        </div>
      </div>

      <Dialog open={isViewLiquidationModalOpen} onOpenChange={setIsViewLiquidationModalOpen}>
        <DialogContent className={cn("max-h-[90vh] max-w-2xl overflow-y-auto custom-scrollbar", servicesDialogContentClass)}>
          <DialogHeader className={servicesDialogHeaderClass}>
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
                <Receipt className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <DialogTitle className={servicesDialogTitleClass}>Detalle de liquidación</DialogTitle>
                <DialogDescription className={cn(servicesDialogDescriptionClass, servicesTextWrapClass)}>
                  Resumen financiero y auditoría del cierre de la orden.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {selectedServicio && (
            <div className={cn("space-y-4", servicesDialogBodyClass)}>
              {/* Encabezado rápido */}
              <div className="flex items-start justify-between gap-4 rounded-[5px] border border-border bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className={servicesDialogLabelClass}>Orden</p>
                  <p className="font-bold text-foreground">#{selectedServicio.id}</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className={servicesDialogLabelClass}>Cliente</p>
                  <p className={cn("font-medium text-foreground", servicesTextWrapClass)}>{selectedServicio.cliente}</p>
                </div>
              </div>

              {/* Montos destacados */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-[5px] border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-600">Total pagado</p>
                  <p className="break-words text-xl font-semibold text-emerald-600">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(getDisplayPaidValue(selectedServicio.raw))}
                  </p>
                </div>
                <div className="rounded-[5px] border border-border bg-muted/30 p-4">
                  <p className="mb-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Valor cotizado</p>
                  <p className="break-words text-xl font-semibold text-foreground opacity-60">
                    {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(selectedServicio.raw.valorCotizado || 0)}
                  </p>
                </div>
              </div>

              {/* Desglose de Pago */}
              <div className="space-y-3">
                <Label className={servicesDialogLabelClass}>Desglose de métodos de pago</Label>
                <div className="overflow-hidden rounded-[5px] border border-border divide-y divide-border">
                  {selectedServicio.raw.desglosePago && selectedServicio.raw.desglosePago.length > 0 ? (
                    selectedServicio.raw.desglosePago.map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-card">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-[5px] bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                            {p.metodo.includes("EFECTIVO") ? <Wallet className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-foreground uppercase">{p.metodo}</p>
                            {p.referencia && <p className="text-[9px] font-bold text-muted-foreground uppercase">REF: {p.referencia}</p>}
                          </div>
                        </div>
                        <p className="text-sm font-bold text-foreground">{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p.monto)}</p>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-xs font-bold text-muted-foreground italic">
                      No hay información de desglose detallada.
                    </div>
                  )}
                </div>
              </div>

              {/* Auditoría y Soporte */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className={servicesDialogLabelClass}>Liquidado por</Label>
                  <div className="space-y-4 rounded-[5px] border border-border bg-muted/30 p-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Creado Por</p>
                      <p className="text-sm font-bold text-foreground uppercase">
                        {getPersonFullName(selectedServicio.raw.creadoPor)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Liquidado Por</p>
                      <p className="text-sm font-bold text-foreground uppercase">
                        {selectedServicio.raw.liquidadoPor ? getPersonFullName(selectedServicio.raw.liquidadoPor, "Registro automático") : "Registro automático"}
                      </p>
                      <p className="text-[10px] font-medium text-muted-foreground mt-1">
                        {selectedServicio.raw.liquidadoAt ? formatBogotaDateTime(selectedServicio.raw.liquidadoAt) : "Fecha no registrada"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className={servicesDialogLabelClass}>Soportes de pago</Label>
                  <div className="flex flex-col gap-2">
                    {(() => {
                      const soportes = selectedServicio.raw.comprobantePago;

                      // Caso 1: No hay soportes
                      if (!soportes || (Array.isArray(soportes) && soportes.length === 0)) {
                        return (
                          <div className="h-[52px] flex items-center justify-center rounded-[5px] border border-dashed border-border bg-muted/10 text-[9px] font-semibold text-muted-foreground uppercase">
                            Sin comprobantes adjuntos
                          </div>
                        );
                      }

                      // Caso 2: Es un array (Nuevo formato)
                      if (Array.isArray(soportes)) {
                        return soportes.map((sop, idx) => {
                          const tipoSoporte =
                            typeof sop?.tipo === "string" && sop.tipo.trim().length > 0
                              ? sop.tipo.replace(/_/g, " ")
                              : `COMPROBANTE ${idx + 1}`;
                          const path = getSoportePagoPath(sop.path);
                          const isOpening =
                            openingStoragePath ===
                            `${selectedServicio.raw.id}:${path}`;

                          return (
                          <Button
                            type="button"
                            key={`soporte-${idx}`}
                            variant="outline"
                            className="w-full h-11 rounded-[5px] border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 font-bold text-[9px] uppercase tracking-[0.12em] gap-2 justify-start px-4"
                            disabled={isOpening}
                            onClick={() =>
                              openFreshStorageUrl(
                                selectedServicio.raw.id,
                                sop.path,
                                "comprobante",
                              )
                            }
                          >
                            {isOpening ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" />
                            )}
                            {tipoSoporte}
                          </Button>
                          );
                        });
                      }

                      // Caso 3: Es un string (Legado)
                      return (
                        <Button
                          variant="outline"
                          className="w-full h-11 rounded-[5px] border-emerald-500/20 bg-emerald-500/5 text-emerald-600 hover:bg-emerald-500/10 font-bold text-[9px] uppercase tracking-[0.12em] gap-2 justify-start px-4"
                          asChild
                        >
            <a href={resolveSoportePagoUrl("EvidenciaOrdenServicio", soportes as unknown as string)} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3.5 w-3.5" /> Soporte principal
                          </a>
                        </Button>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Observación Final */}
              <div className="space-y-2">
                <Label className={servicesDialogLabelClass}>Observaciones de cierre</Label>
                <div className="min-h-[80px] rounded-[5px] border border-border bg-muted/30 p-4">
                  <p className={cn("text-sm font-medium italic text-foreground", servicesTextWrapClass)}>
                    {selectedServicio.raw.observacionFinal || "Sin observaciones adicionales."}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 border-t border-border pt-4">
                <Button
                  className={cn("flex-1 bg-foreground text-background", servicesDialogButtonClass)}
                  onClick={() => setIsViewLiquidationModalOpen(false)}
                >
                  Cerrar visualización
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* OVERLAY PARA CERRAR PANEL */}
      {showOperationalQueue && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[45]"
          onClick={() => setShowOperationalQueue(false)}
        />
      )}
    </DashboardLayout>
  );
}

export default function ServiciosPageWrapper() {
  return (
    <Suspense fallback={<ServiciosSkeleton />}>
      <ServiciosContent />
    </Suspense>
  );
}
