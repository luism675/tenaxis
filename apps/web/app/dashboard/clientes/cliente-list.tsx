"use client";

import React, { useState, useMemo, useEffect, useDeferredValue, useTransition, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import {
  AlertCircle,
  Plus,
  Search,
  Building2,
  User,
  Trophy,
  Target,
  Phone,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Eye,
  EyeOff,
  BarChart3,
  Activity,
  Settings,
  Pencil,
  Trash2,
  FileText,
  Mail,
  MapPin,
  Fingerprint,
  Calendar,
  Filter,
  RotateCcw,
  Zap,
  Check,
  Clock,
  ClipboardCheck,
  ShieldCheck,
  Box,
  ArrowUpDown,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { toast } from "sonner";
import { Contact } from "lucide-react";
import { apiFetch } from "@/lib/api/base-client";
import { clientesClient } from "@/lib/api/clientes-client";
import { clientesKpisClient, type ClientesDashboardKpisResponse } from "@/lib/api/clientes-kpis-client";
import { sugerenciasClient } from "@/lib/api/sugerencias-clientes-client";
import { configClient } from "@/lib/api/config-client";
import { serviciosClient } from "@/lib/api/servicios-client";
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
  formatBogotaDate,
  formatBogotaTime,
  pickerDateToYmd,
  toBogotaYmd,
  utcIsoToBogotaYmd,
  ymdToPickerDate,
} from "@/utils/date-utils";
import { getBrowserCookie } from "@/lib/api/browser-client";
import { useUserRole } from "@/hooks/use-user-role";
import {
  getBrowserAccessScope,
  getBrowserScopedEnterpriseId,
} from "@/lib/browser-access-scope";
import type { AccessScope } from "@/lib/access-scope";
import { geoClient } from "@/lib/api/geo-client";

export interface Cliente {
  id: string;
  nombre?: string | null;
  apellido?: string | null;
  razonSocial?: string | null;
  tipoCliente: "PERSONA" | "EMPRESA";
  segmentoNegocio?: string;
  segmento?: string | {
    id: string;
    nombre: string;
  };
  nivelRiesgo?: string;
  riesgo?: {
    id: string;
    nombre: string;
    color?: string;
  };
  clasificacion?: "ORO" | "PLATA" | "BRONCE" | "RIESGO";
  score?: number;
  telefono: string;
  telefono2?: string;
  correo?: string;
  numeroDocumento?: string;
  tipoDocumento?: string;
  nit?: string;
  createdAt?: string;
  updatedAt?: string;
  aceptaMarketing?: boolean;
  actividadEconomica?: string;
  cargoContacto?: string;
  fechaConsentimiento?: string;
  frecuenciaServicio?: number;
  frecuenciaSugerida?: number;
  metrajeTotal?: number | string;
  origenCliente?: string;
  planActual?: string;
  proximaVisita?: string;
  ultimaVisita?: string;
  representanteLegal?: string;
  subsegmento?: string;
  ticketPromedio?: number | string;
  tipoInteres?: {
    id: string;
    nombre: string;
  };
  empresa?: {
    id: string;
    nombre: string;
  };
  creadoPor?: {
    user: {
      nombre: string;
      apellido: string;
    }
  };
  direcciones?: {
    id: string;
    direccion: string;
    municipio?: string;
    municipioId?: string;
    departmentId?: string;
    municipioRel?: {
      id: string;
      name: string;
      departmentId: string;
    };
    barrio?: string;
    piso?: string;
    bloque?: string;
    unidad?: string;
    nombreSede?: string;
    nombreContacto?: string;
    telefonoContacto?: string;
    cargoContacto?: string;
    tipoUbicacion?: string;
    clasificacionPunto?: string;
    horarioInicio?: string;
    horarioFin?: string;
    latitud?: number;
    longitud?: number;
    restricciones?: string;
    validadoPorSistema?: boolean;
  }[];
  vehiculos?: {
    id: string;
    placa: string;
    marca?: string;
    modelo?: string;
    color?: string;
    tipo?: string;
  }[];
  configuracionesOperativas?: ConfiguracionOperativa[];
  ordenesServicio?: OrdenServicio[];
  dashboardSegments?: Array<"riesgoFuga" | "upsellPotencial" | "dormidos" | "operacionEstable">;
}

type ClientPortalLinkResponse = {
  url?: string;
  expiresAt?: string | null;
};

interface Department {
  id: string;
  name: string;
  code: string;
}

interface Municipality {
  id: string;
  name: string;
  code: string;
  departmentId: string;
}

interface ElementoPredefinido {
  nombre: string;
  tipo: string;
  ubicacion?: string;
}

interface ConfiguracionOperativa {
  id: string;
  direccionId?: string | null;
  direccion?: {
    id: string;
    direccion: string;
  } | null;
  protocoloServicio?: string | null;
  observacionesFijas?: string | null;
  requiereFirmaDigital: boolean;
  requiereFotosEvidencia: boolean;
  duracionEstimada?: number | null;
  frecuenciaSugerida?: number | null;
  elementosPredefinidos?: ElementoPredefinido[] | null;
}

export interface Sugerencia {
  id: string;
  clienteId: string;
  tipo: string;
  prioridad: string;
  estado: string;
  titulo: string;
  descripcion: string;
  creadoAt: string;
  cliente?: Cliente;
}

export interface SugerenciaStats {
  pendientesPorPrioridad: Record<string, number>;
  tasaAceptacion: number;
  tiempoPromedioEjecucionMin: number;
  totalHoy: number;
}

interface SugerenciasPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

interface ClienteListProps {
  initialClientes: Cliente[];
  initialPagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  } | null;
  initialSugerencias?: Sugerencia[];
  sugerenciasStats?: SugerenciaStats | null;
  initialDepartments?: Department[];
  initialMunicipalities?: Municipality[];
}

const SCORE_COLORS = {
  ORO: "border-amber-200 bg-amber-100 text-amber-800",
  PLATA: "border-slate-200 bg-slate-100 text-slate-600",
  BRONCE: "border-amber-200 bg-amber-50 text-amber-800",
  RIESGO: "border-red-200 bg-red-50 text-red-700",
};

const RIESGO_LABELS = {
  BAJO: { label: "Riesgo bajo", color: "border-border bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  MEDIO: { label: "Riesgo Medio", color: "text-amber-600 bg-amber-500/10 border-amber-500/20", dot: "bg-amber-500" },
  ALTO: { label: "Riesgo Alto", color: "text-red-600 bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
  CRITICO: { label: "Crítico", color: "text-red-600 bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
  "PLAGA ALTA": { label: "Plaga Alta", color: "text-red-600 bg-red-500/10 border-red-500/20", dot: "bg-red-500" },
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
  "REPROGRAMADO": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  "SIN_CONCRETAR": "bg-slate-500/10 text-slate-600 border-slate-500/20",
  "DEFAULT": "bg-muted text-muted-foreground border-border",
};

const clientesDialogContentClass = "overflow-hidden border-border bg-background p-0 shadow-xl";
const clientesDialogHeaderClass = "border-b border-border bg-card px-5 py-4";
const clientesDialogBodyClass = "px-5 py-4";
const clientesDialogFooterClass = "border-t border-border bg-card px-5 py-3";
const clientesDialogTitleClass = "text-[15px] font-medium tracking-tight text-foreground";
const clientesDialogDescriptionClass = "mt-1 text-[11px] text-muted-foreground";
const clientesDialogInputClass = "h-9 rounded-[4px] border-border bg-background text-[12px] font-medium text-foreground";
const clientesDialogButtonClass = "h-8 rounded-[4px] text-[10px] font-medium tracking-[0.08em]";
const clientesDialogIconClass = "flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground";

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fallback below covers browsers that block clipboard access.
    }
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
}

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

type TipoClienteFilter = "all" | Cliente["tipoCliente"];

const normalizeTipoClienteFilter = (
  value?: string | null,
): TipoClienteFilter =>
  value === "PERSONA" || value === "EMPRESA" ? value : "all";

const createDefaultClientesFilters = () => ({
  empresas: [] as string[],
  departamento: "all",
  municipio: "all",
  barrio: "",
  clasificacion: "all",
  segmento: "all",
  riesgo: "all",
  tipoCliente: "all" as TipoClienteFilter,
  fechaDesde: "",
  fechaHasta: "",
});

type ClientesFilters = ReturnType<typeof createDefaultClientesFilters>;
type ClientesSortConfig = { key: string; direction: "asc" | "desc" } | null;

const CLIENTES_UI_CACHE_BASE_KEY = "tenaxis:dashboard:clientes:ui-state:v1";

interface ClientesUiCacheState {
  scopeEmpresaId: string | null;
  activeSegment: string;
  search: string;
  currentPage: number;
  sortConfig: ClientesSortConfig;
  onlySinVisita: boolean;
  onlyWithPendingPayments: boolean;
  onlySinServicios: boolean;
  filters: ClientesFilters;
}

const buildClientesUiCacheKey = (
  tenantId?: string | null,
  empresaId?: string | null,
) =>
  `${CLIENTES_UI_CACHE_BASE_KEY}:tenant:${tenantId || "sin-conglomerado"}:empresa:${
    empresaId || "sin-empresa"
  }`;

const readClientesUiCache = (
  cacheKey: string,
  scopeEmpresaId: string | null,
): ClientesUiCacheState | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(cacheKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<ClientesUiCacheState> | null;
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

    const parsedFilters: Partial<ClientesFilters> =
      parsed.filters && typeof parsed.filters === "object"
        ? parsed.filters
        : {};

    return {
      scopeEmpresaId: parsedScopeEmpresaId ?? scopeEmpresaId,
      activeSegment:
        typeof parsed.activeSegment === "string" ? parsed.activeSegment : "all",
      search: typeof parsed.search === "string" ? parsed.search : "",
      currentPage:
        typeof parsed.currentPage === "number" && parsed.currentPage > 0
          ? Math.floor(parsed.currentPage)
          : 1,
      sortConfig:
        parsed.sortConfig &&
        typeof parsed.sortConfig.key === "string" &&
        (parsed.sortConfig.direction === "asc" ||
          parsed.sortConfig.direction === "desc")
          ? parsed.sortConfig
          : null,
      onlySinVisita: Boolean(parsed.onlySinVisita),
      onlyWithPendingPayments: Boolean(parsed.onlyWithPendingPayments),
      onlySinServicios: Boolean(parsed.onlySinServicios),
      filters: {
        ...createDefaultClientesFilters(),
        ...parsedFilters,
        empresas: Array.isArray(parsedFilters.empresas)
          ? parsedFilters.empresas.filter(
              (empresaId): empresaId is string => typeof empresaId === "string",
            )
          : [],
        tipoCliente: normalizeTipoClienteFilter(parsedFilters.tipoCliente),
      },
    };
  } catch {
    return null;
  }
};

interface OrdenServicio {
  id: string;
  numeroOrden?: string;
  estadoServicio: string;
  estadoPago?: string;
  servicio?: {
    nombre: string;
  };
  fechaVisita?: string;
  direccionTexto?: string;
  tecnico?: {
    user: {
      nombre: string;
      apellido: string;
    }
  };
  valorCotizado?: number;
  valorPagado?: number;
  valorRepuestos?: number;
}

export function ClienteList({ 
  initialClientes, 
  initialPagination = null,
  initialSugerencias = [],
  sugerenciasStats,
  initialDepartments = [], 
  initialMunicipalities = [] 
}: ClienteListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { checkPermission, isLoading: isLoadingRole, tenantId } = useUserRole();
  const [_isRoutingPending, startRoutingTransition] = useTransition();

  const [mounted, setMounted] = useState(false);
  const [hasRestoredUiState, setHasRestoredUiState] = useState(false);
  const [restoredClientesUiCacheKey, setRestoredClientesUiCacheKey] =
    useState<string | null>(null);
  const [accessScope, setAccessScope] = useState<AccessScope | null>(null);
  const skipNextClientesUiCacheWriteRef = useRef(false);
  const didSkipInitialClientsFetch = useRef(false);
  const lastClientesFetchCacheKeyRef = useRef<string | null>(null);
  const clientesUiStateRestoreSourceRef = useRef<
    "query" | "cache" | "empty" | null
  >(null);
  const clientesFetchAbortRef = useRef<AbortController | null>(null);
  const [clientesData, setClientesData] = useState<Cliente[]>(initialClientes);
  const [pagination, setPagination] = useState(initialPagination);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [showKPIs, setShowKPIs] = useState(true);
  const [kpisData, setKpisData] = useState<ClientesDashboardKpisResponse | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);
  const [kpisError, setKpisError] = useState<string | null>(null);
  const [kpisRequestedOnce, setKpisRequestedOnce] = useState(false);
  
  // URL Persistence
  const [activeSegment, setActiveSegment] = useState<string>(searchParams.get("segment") || "all");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const deferredSearch = useDeferredValue(search);
  const [currentPage, setCurrentPage] = useState(Number(searchParams.get("page")) || 1);
  const [sortConfig, setSortConfig] = useState<ClientesSortConfig>(
    searchParams.get("sort") 
      ? { key: searchParams.get("sort")!, direction: (searchParams.get("dir") as "asc" | "desc") || "asc" }
      : null
  );

  const [onlySinVisita, setOnlySinVisita] = useState(searchParams.get("sinVisita") === "true");
  const [onlyWithPendingPayments, setOnlyWithPendingPayments] = useState(searchParams.get("pendingPayments") === "true");
  const [onlySinServicios, setOnlySinServicios] = useState(searchParams.get("sinServicios") === "true");
  const [filters, setFilters] = useState<ClientesFilters>({
    ...createDefaultClientesFilters(),
    empresas: searchParams.get("empresas")?.split(",").filter(Boolean) || [],
    departamento: searchParams.get("dept") || "all",
    municipio: searchParams.get("muni") || "all",
    barrio: searchParams.get("barrio") || "",
    clasificacion: searchParams.get("class") || "all",
    segmento: searchParams.get("seg") || "all",
    riesgo: searchParams.get("risk") || "all",
    tipoCliente: normalizeTipoClienteFilter(searchParams.get("tipoCliente")),
    fechaDesde: searchParams.get("from") || "",
    fechaHasta: searchParams.get("to") || "",
  });

  const scopedEnterpriseId = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const scopedEmpresaId = accessScope
      ? getBrowserScopedEnterpriseId(accessScope)
      : null;

    return (
      scopedEmpresaId ||
      getBrowserCookie("x-enterprise-id") ||
      window.localStorage.getItem("current-enterprise-id") ||
      null
    );
  }, [accessScope]);

  const clientesUiCacheKey = useMemo(
    () => buildClientesUiCacheKey(tenantId, scopedEnterpriseId),
    [scopedEnterpriseId, tenantId],
  );

  const isClientesUiStateReady =
    mounted &&
    hasRestoredUiState &&
    restoredClientesUiCacheKey === clientesUiCacheKey;

  const clearClientesUiCache = useCallback(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(clientesUiCacheKey);
  }, [clientesUiCacheKey]);

  // Sync state to URL
  useEffect(() => {
    if (!isClientesUiStateReady) return;
    const params = new URLSearchParams();
    if (activeSegment !== "all") params.set("segment", activeSegment);
    if (deferredSearch) params.set("search", deferredSearch);
    if (currentPage > 1) params.set("page", currentPage.toString());
    if (sortConfig) {
      params.set("sort", sortConfig.key);
      params.set("dir", sortConfig.direction);
    }
    if (onlySinVisita) params.set("sinVisita", "true");
    if (onlyWithPendingPayments) params.set("pendingPayments", "true");
    if (onlySinServicios) params.set("sinServicios", "true");
    if (filters.empresas.length > 0) params.set("empresas", filters.empresas.join(","));
    if (filters.departamento !== "all") params.set("dept", filters.departamento);
    if (filters.municipio !== "all") params.set("muni", filters.municipio);
    if (filters.barrio) params.set("barrio", filters.barrio);
    if (filters.clasificacion !== "all") params.set("class", filters.clasificacion);
    if (filters.segmento !== "all") params.set("seg", filters.segmento);
    if (filters.riesgo !== "all") params.set("risk", filters.riesgo);
    if (filters.tipoCliente !== "all") params.set("tipoCliente", filters.tipoCliente);
    if (filters.fechaDesde) params.set("from", filters.fechaDesde);
    if (filters.fechaHasta) params.set("to", filters.fechaHasta);

    const query = params.toString();
    startRoutingTransition(() => {
      router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
    });
  }, [activeSegment, deferredSearch, currentPage, sortConfig, filters, pathname, router, isClientesUiStateReady, onlySinVisita, onlyWithPendingPayments, onlySinServicios, startRoutingTransition]);

  useEffect(() => {
    if (!isLoadingRole && !checkPermission("CLIENT_VIEW")) {
      router.replace("/dashboard");
    }
  }, [isLoadingRole, checkPermission, router]);

  const [showSuggestionsQueue, setShowSuggestionsQueue] = useState(false);
  const SUGERENCIAS_PAGE_SIZE = 12;
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>(initialSugerencias);
  const [sugerenciasPagination, setSugerenciasPagination] = useState<SugerenciasPagination | null>(null);
  const [localSugerenciasStats, setLocalSugerenciasStats] = useState<SugerenciaStats | null>(sugerenciasStats || null);
  const [sugerenciasLoading, setSugerenciasLoading] = useState(false);
  const [sugerenciasLoadingMore, setSugerenciasLoadingMore] = useState(false);
  const [sugerenciasError, setSugerenciasError] = useState<string | null>(null);
  const didLoadSugerenciasRef = useRef(initialSugerencias.length > 0);
  const didLoadSugerenciasStatsRef = useRef(Boolean(sugerenciasStats));
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [municipalities, setMunicipalities] = useState<Municipality[]>(initialMunicipalities);
  const clientes = clientesData;

  const loadKpis = useCallback(
    async (forceRefresh = false) => {
      if (kpisLoading) {
        return;
      }

      if (kpisRequestedOnce && !forceRefresh) {
        return;
      }

      try {
        const controller = new AbortController();
        setKpisLoading(true);
        setKpisError(null);

        const response = await clientesKpisClient.getDashboardKpis({
          refresh: forceRefresh,
          signal: controller.signal,
          timeoutMs: 12_000,
        });
        setKpisData(response);
      } catch (error) {
        console.error("Error loading clientes KPIs:", error);
        setKpisError(error instanceof Error ? error.message : "Error inesperado");
      } finally {
        setKpisRequestedOnce(true);
        setKpisLoading(false);
      }
    },
    [kpisLoading, kpisRequestedOnce],
  );

  const [empresaSearch, setEmpresaSearch] = useState("");
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedClienteForConfig, setSelectedClienteForConfig] = useState<Cliente | null>(null);
  const [selectedClienteForHistory, setSelectedClienteForHistory] = useState<Cliente | null>(null);
  const [selectedClienteForSuggestions, setSelectedClienteForSuggestions] = useState<Cliente | null>(null);
  const [clienteToDelete, setClienteToDelete] = useState<Cliente | null>(null);
  const [portalLinkLoadingClienteId, setPortalLinkLoadingClienteId] = useState<string | null>(null);

  const getSegmentoNombre = (cliente: Cliente) =>
    typeof cliente.segmento === "string"
      ? cliente.segmento
      : cliente.segmento?.nombre || cliente.segmentoNegocio || "";

  const getRiesgoNombre = (cliente: Cliente) =>
    cliente.riesgo?.nombre || cliente.nivelRiesgo || "";

  const loadSugerenciasPage = useCallback(
    async (page: number, mode: "replace" | "append" = "replace") => {
      if (mode === "replace" && sugerenciasLoading) {
        return;
      }

      if (mode === "append" && sugerenciasLoadingMore) {
        return;
      }

      try {
        setSugerenciasError(null);
        if (mode === "replace") {
          setSugerenciasLoading(true);
        } else {
          setSugerenciasLoadingMore(true);
        }

        const response = await sugerenciasClient.getPage(page, SUGERENCIAS_PAGE_SIZE);

        const nextSugerencias = response.sugerencias as Sugerencia[];
        setSugerencias((prev) =>
          mode === "append" ? [...prev, ...nextSugerencias] : nextSugerencias,
        );
        setSugerenciasPagination(response.pagination);
        didLoadSugerenciasRef.current = true;
      } catch (error) {
        console.error("Error loading sugerencias clientes:", error);
        setSugerenciasError(
          error instanceof Error ? error.message : "No se pudieron cargar las sugerencias",
        );
      } finally {
        if (mode === "replace") {
          setSugerenciasLoading(false);
        } else {
          setSugerenciasLoadingMore(false);
        }
      }
    },
    [SUGERENCIAS_PAGE_SIZE, sugerenciasLoading, sugerenciasLoadingMore],
  );

  const loadSugerenciasStats = useCallback(async (forceRefresh = false) => {
    if (!forceRefresh && didLoadSugerenciasStatsRef.current && localSugerenciasStats) {
      return;
    }

    try {
      const stats = await sugerenciasClient.getStats();
      setLocalSugerenciasStats(stats);
      didLoadSugerenciasStatsRef.current = true;
    } catch (error) {
      console.error("Error loading sugerencias stats:", error);
    }
  }, [localSugerenciasStats]);

  const loadMoreSugerencias = useCallback(() => {
    if (sugerenciasLoadingMore || !sugerenciasPagination?.hasNextPage) {
      return;
    }

    void loadSugerenciasPage(sugerenciasPagination.page + 1, "append");
  }, [loadSugerenciasPage, sugerenciasLoadingMore, sugerenciasPagination]);

  const handleUpdateSugerencia = async (id: string, nuevoEstado: string) => {
    try {
      await apiFetch(`/sugerencias-clientes/${id}/estado`, {
        method: "PATCH",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      await Promise.all([
        loadSugerenciasStats(true),
        loadSugerenciasPage(sugerenciasPagination?.page || 1, "replace"),
      ]);
      toast.success(`Sugerencia ${nuevoEstado.toLowerCase()} correctamente`);
    } catch (error) {
      console.error("Error updating suggestion status:", error);
      toast.error("Error al actualizar la sugerencia");
    }
  };

  const suggestions = useMemo(() => {
    if (!selectedClienteForSuggestions) return [];
    const client = selectedClienteForSuggestions;
    const todayYmd = toBogotaYmd();
    const list = [];

    // 1. Programar visita (si próxima visita vencida o vacía con frecuencia definida)
    const proximaVencida =
      !client.proximaVisita ||
      utcIsoToBogotaYmd(client.proximaVisita) < todayYmd;
    const tieneFrecuencia = Number(client.frecuenciaSugerida || client.frecuenciaServicio || 0) > 0;
    
    if (proximaVencida && tieneFrecuencia) {
      list.push({
        id: "programar-visita",
        title: "Programar Visita de Seguimiento",
        description: "La fecha de próxima visita está vencida o no ha sido programada, pero el cliente tiene una frecuencia de servicio establecida.",
        icon: Calendar,
        color: "text-blue-600 bg-blue-50",
        actionLabel: "Ir a Programación",
        action: () => {
          if (!checkPermission("SERVICE_CREATE")) {
            toast.error("No tienes permisos para crear servicios.");
            return;
          }
          router.push(`/dashboard/servicios/nuevo?clienteId=${client.id}`);
          setSelectedClienteForSuggestions(null);
        }
      });
    }

    // 2. Reactivar cliente (si dormido)
    const isDormido = client.dashboardSegments?.includes("dormidos");
    if (isDormido) {
      list.push({
        id: "reactivar-cliente",
        title: "Retomar cliente sin atención reciente",
        description: "Este cliente no ha registrado actividad en los últimos 120 días. Se recomienda contacto comercial inmediato.",
        icon: RotateCcw,
        color: "text-slate-600 bg-slate-50",
        actionLabel: "Registrar Contacto",
        action: () => {
          toast.info("Función de registro de contacto en desarrollo");
          setSelectedClienteForSuggestions(null);
        }
      });
    }

    // 3. Ofrecer upsell (si upsell potencial y consentimiento marketing activo)
    const isUpsell = client.dashboardSegments?.includes("upsellPotencial");
    if (isUpsell && client.aceptaMarketing) {
      list.push({
        id: "ofrecer-upsell",
        title: "Proponer servicio complementario",
        description: "El cliente tiene buen historial de compra y autoriza comunicaciones. Ideal para ofrecer servicios relacionados.",
        icon: Zap,
        color: "text-amber-600 bg-amber-50",
        actionLabel: "Generar Oferta",
        action: () => {
          toast.info("Generando propuesta comercial automática...");
          setSelectedClienteForSuggestions(null);
        }
      });
    }

    // 4. Revisar configuración operativa (si datos críticos incompletos)
    const sinDirecciones = !client.direcciones || client.direcciones.length === 0;
    const sinConfig = !client.configuracionesOperativas || client.configuracionesOperativas.length === 0;
    if (sinDirecciones || sinConfig) {
      list.push({
        id: "revisar-config",
        title: "Completar Configuración Operativa",
        description: "Faltan datos críticos (sedes o protocolos) para garantizar una ejecución técnica perfecta.",
        icon: Settings,
        color: "text-purple-600 bg-purple-50",
        actionLabel: "Configurar Ahora",
        action: () => {
          setSelectedClienteForConfig(client);
          setSelectedClienteForSuggestions(null);
        }
      });
    }

    return list;
  }, [selectedClienteForSuggestions, router, checkPermission]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [serviceHistory, setServiceHistory] = useState<OrdenServicio[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [activeConfigs, setActiveConfigs] = useState<ConfiguracionOperativa[]>([]);
  const [currentConfigSede, setCurrentConfigSede] = useState("all");

  const [configForm, setConfigForm] = useState({
    protocoloServicio: "",
    observacionesFijas: "",
    requiereFirmaDigital: true,
    requiereFotosEvidencia: true,
    duracionEstimada: 60,
    frecuenciaSugerida: 30,
    elementosPredefinidos: [] as ElementoPredefinido[],
  });

  const [newElement, setNewElement] = useState({
    nombre: "",
    tipo: "Estación de Cebo",
    ubicacion: "",
  });

  const [showFilters, setShowFilters] = useState(false);
  const [customPresets, setCustomPresets] = useState<DashboardPreset[]>([]);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetForm, setPresetForm] = useState<{
    name: string;
    colorToken: DashboardPresetColorToken;
    isShared: boolean;
  }>({
    name: "",
    colorToken: "sky",
    isShared: false,
  });
  const pendingSugerencias = useMemo(
    () => sugerencias.filter((s) => s.estado === "PENDIENTE"),
    [sugerencias]
  );
  const recentManagedSugerencias = useMemo(
    () =>
      sugerencias
        .filter((s) => s.estado !== "PENDIENTE")
        .sort((a, b) => new Date(b.creadoAt).getTime() - new Date(a.creadoAt).getTime())
        .slice(0, 8),
    [sugerencias]
  );

  const handleDelete = (cliente: Cliente) => {
    setClienteToDelete(cliente);
  };

  const confirmDelete = async () => {
    if (!clienteToDelete) return;
    const id = clienteToDelete.id;
    setClienteToDelete(null);
    toast.promise(clientesClient.delete(id), {
      loading: "Eliminando cliente...",
      success: () => "Cliente eliminado correctamente",
      error: (err) => err.message || "Error al eliminar el cliente",
    });
  };

  const handleCopyClientPortal = async (cliente: Cliente) => {
    if (portalLinkLoadingClienteId) {
      return;
    }

    try {
      setPortalLinkLoadingClienteId(cliente.id);
      const portalBaseUrl = `${window.location.origin}/portal-cliente`;
      const response = await apiFetch<ClientPortalLinkResponse>(
        `/client-portal/clients/${cliente.id}/link`,
        {
          method: "POST",
          body: JSON.stringify({ baseUrl: portalBaseUrl }),
        },
      );

      if (!response.url) {
        throw new Error("No se recibió el enlace del portal.");
      }

      await copyTextToClipboard(response.url);

      const expiresAtDate = response.expiresAt ? new Date(response.expiresAt) : null;
      const expiresAt =
        expiresAtDate && !Number.isNaN(expiresAtDate.getTime())
          ? new Intl.DateTimeFormat("es-CO", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "America/Bogota",
            }).format(expiresAtDate)
          : null;

      toast.success(
        expiresAt
          ? `Portal del cliente copiado. Vigente hasta ${expiresAt}.`
          : "Portal del cliente copiado.",
      );
    } catch (error) {
      console.error("Error copying client portal link:", error);
      toast.error("No se pudo preparar el portal del cliente. Intentá nuevamente.");
    } finally {
      setPortalLinkLoadingClienteId(null);
    }
  };

  React.useEffect(() => {
    setMounted(true);
    setAccessScope(getBrowserAccessScope());
  }, []);

  useEffect(() => {
    if (!mounted || isLoadingRole) {
      return;
    }

    const hasQueryParams =
      typeof window !== "undefined" &&
      window.location.search.replace(/^\?/, "").length > 0;

    if (!hasQueryParams) {
      skipNextClientesUiCacheWriteRef.current = true;
      const cachedState = readClientesUiCache(
        clientesUiCacheKey,
        scopedEnterpriseId,
      );
      if (cachedState) {
        clientesUiStateRestoreSourceRef.current = "cache";
        setActiveSegment(cachedState.activeSegment);
        setSearch(cachedState.search);
        setCurrentPage(cachedState.currentPage);
        setSortConfig(cachedState.sortConfig);
        setOnlySinVisita(cachedState.onlySinVisita);
        setOnlyWithPendingPayments(cachedState.onlyWithPendingPayments);
        setOnlySinServicios(cachedState.onlySinServicios);
        setFilters(cachedState.filters);
      } else {
        clientesUiStateRestoreSourceRef.current = "empty";
      }
    } else {
      clientesUiStateRestoreSourceRef.current = "query";
    }

    setHasRestoredUiState(true);
    setRestoredClientesUiCacheKey(clientesUiCacheKey);
  }, [clientesUiCacheKey, isLoadingRole, mounted, scopedEnterpriseId]);

  useEffect(() => {
    if (!isClientesUiStateReady || typeof window === "undefined") {
      return;
    }

    const nextState: ClientesUiCacheState = {
      scopeEmpresaId: scopedEnterpriseId,
      activeSegment,
      search,
      currentPage,
      sortConfig,
      onlySinVisita,
      onlyWithPendingPayments,
      onlySinServicios,
      filters,
    };

    const isDefaultState =
      nextState.activeSegment === "all" &&
      nextState.search === "" &&
      nextState.currentPage === 1 &&
      nextState.sortConfig === null &&
      !nextState.onlySinVisita &&
      !nextState.onlyWithPendingPayments &&
      !nextState.onlySinServicios &&
      Object.entries(createDefaultClientesFilters()).every(([key, value]) => {
        const filterValue = nextState.filters[key as keyof ClientesFilters];
        return Array.isArray(value)
          ? Array.isArray(filterValue) && filterValue.length === 0
          : filterValue === value;
      });

    if (isDefaultState) {
      skipNextClientesUiCacheWriteRef.current = false;
      window.localStorage.removeItem(clientesUiCacheKey);
      return;
    }

    if (skipNextClientesUiCacheWriteRef.current) {
      skipNextClientesUiCacheWriteRef.current = false;
      return;
    }

    window.localStorage.setItem(clientesUiCacheKey, JSON.stringify(nextState));
  }, [
    activeSegment,
    clientesUiCacheKey,
    currentPage,
    filters,
    isClientesUiStateReady,
    onlySinServicios,
    onlySinVisita,
    onlyWithPendingPayments,
    search,
    scopedEnterpriseId,
    sortConfig,
  ]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    let isCancelled = false;

    async function loadSecondaryData() {
      try {
        const shouldLoadDepartments = initialDepartments.length === 0;
        const shouldLoadMunicipalities = initialMunicipalities.length === 0;

        if (!shouldLoadDepartments && !shouldLoadMunicipalities) {
          return;
        }

        const [loadedDepartments, loadedMunicipalities] = await Promise.all([
          shouldLoadDepartments
            ? geoClient.getDepartments()
            : Promise.resolve(initialDepartments),
          shouldLoadMunicipalities
            ? geoClient.getMunicipalities()
            : Promise.resolve(initialMunicipalities),
        ]);

        if (isCancelled) return;

        setDepartments(loadedDepartments || []);
        setMunicipalities(loadedMunicipalities || []);
      } catch (error) {
        if (!isCancelled) {
          console.error("Error loading secondary clientes data:", error);
        }
      }
    }

    void loadSecondaryData();

    return () => {
      isCancelled = true;
    };
  }, [
    mounted,
    initialDepartments,
    initialMunicipalities,
  ]);

  useEffect(() => {
    if (!mounted || !showSuggestionsQueue) {
      return;
    }

    if (!didLoadSugerenciasRef.current) {
      void loadSugerenciasPage(1, "replace");
    }

    if (!didLoadSugerenciasStatsRef.current) {
      void loadSugerenciasStats();
    }
  }, [
    mounted,
    showSuggestionsQueue,
    loadSugerenciasPage,
    loadSugerenciasStats,
  ]);

  useEffect(() => {
    if (!mounted || !showKPIs) {
      return;
    }

    if (!kpisRequestedOnce) {
      void loadKpis();
    }
  }, [mounted, showKPIs, kpisRequestedOnce, loadKpis]);

  useEffect(() => {
    if (!isClientesUiStateReady) {
      return;
    }

    if (lastClientesFetchCacheKeyRef.current !== clientesUiCacheKey) {
      lastClientesFetchCacheKeyRef.current = clientesUiCacheKey;
      didSkipInitialClientsFetch.current = false;
    }

    if (!didSkipInitialClientsFetch.current) {
      didSkipInitialClientsFetch.current = true;
      if (clientesUiStateRestoreSourceRef.current !== "cache") {
        return;
      }
    }

    let isCancelled = false;
    clientesFetchAbortRef.current?.abort();
    const controller = new AbortController();
    clientesFetchAbortRef.current = controller;
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    params.set("limit", "10");

    if (activeSegment !== "all") params.set("segment", activeSegment);
    if (deferredSearch) params.set("search", deferredSearch);
    if (sortConfig) {
      params.set("sort", sortConfig.key);
      params.set("dir", sortConfig.direction);
    }
    if (onlySinVisita) params.set("sinVisita", "true");
    if (onlyWithPendingPayments) params.set("pendingPayments", "true");
    if (onlySinServicios) params.set("sinServicios", "true");
    if (filters.empresas.length > 0) params.set("empresas", filters.empresas.join(","));
    if (filters.departamento !== "all") params.set("dept", filters.departamento);
    if (filters.municipio !== "all") params.set("muni", filters.municipio);
    if (filters.barrio) params.set("barrio", filters.barrio);
    if (filters.clasificacion !== "all") params.set("class", filters.clasificacion);
    if (filters.segmento !== "all") params.set("seg", filters.segmento);
    if (filters.riesgo !== "all") params.set("risk", filters.riesgo);
    if (filters.tipoCliente !== "all") params.set("tipoCliente", filters.tipoCliente);
    if (filters.fechaDesde) params.set("from", filters.fechaDesde);
    if (filters.fechaHasta) params.set("to", filters.fechaHasta);

    async function loadClientesPage() {
      try {
        setIsPageLoading(true);
        const response = await apiFetch<{
          clientes: Cliente[];
          pagination: NonNullable<ClienteListProps["initialPagination"]>;
        }>(`/clientes/dashboard-data?${params.toString()}`, {
          cache: "no-store",
          includeEnterpriseId: true,
          signal: controller.signal,
        });

        if (isCancelled) return;

        setClientesData(response.clientes || []);
        setPagination(response.pagination || null);

        if (response.pagination && response.pagination.page !== currentPage) {
          setCurrentPage(response.pagination.page);
        }
      } catch (error) {
        if ((error as Error)?.name === "AbortError") {
          return;
        }

        if (!isCancelled) {
          console.error("Error loading paginated clientes:", error);
          toast.error("No se pudieron cargar los clientes");
        }
      } finally {
        if (!isCancelled) {
          setIsPageLoading(false);
        }
      }
    }

    void loadClientesPage();

    return () => {
      isCancelled = true;
      controller.abort();
      if (clientesFetchAbortRef.current === controller) {
        clientesFetchAbortRef.current = null;
      }
    };
  }, [
    isClientesUiStateReady,
    clientesUiCacheKey,
    currentPage,
    activeSegment,
    deferredSearch,
    sortConfig,
    filters,
    onlySinVisita,
    onlyWithPendingPayments,
    onlySinServicios,
  ]);

  useEffect(() => {
    if (!accessScope || !isClientesUiStateReady) {
      return;
    }

    const scopedEnterpriseId = getBrowserScopedEnterpriseId(accessScope);
    if (accessScope.isEmpresaLocked) {
      if (!scopedEnterpriseId) {
        return;
      }

      setTimeout(() => {
        setFilters((prev) => {
          if (
            prev.empresas.length === 1 &&
            prev.empresas[0] === scopedEnterpriseId
          ) {
            return prev;
          }

          return {
            ...prev,
            empresas: [scopedEnterpriseId],
          };
        });
        setEmpresaSearch("");
      }, 0);
      return;
    }

    setEmpresaSearch("");
  }, [accessScope, isClientesUiStateReady]);

  const filterOptions = useMemo(() => {
    if (!mounted) return { municipios: [], segmentos: [], clasificaciones: [], riesgos: [], empresas: [], departamentos: [] };
    const departamentos = departments.length > 0
      ? [...departments].sort((a, b) => a.name.localeCompare(b.name))
      : Array.from(new Set(clientes.flatMap((c: Cliente) => c.direcciones?.map((d) => d.departmentId).filter(Boolean) || [])))
          .map(id => ({ id: String(id), name: String(id), code: String(id) }));
    const municipios = municipalities.length > 0
      ? municipalities
          .filter(m => filters.departamento === "all" || m.departmentId === filters.departamento)
          .sort((a, b) => a.name.localeCompare(b.name))
      : Array.from(new Set(clientes.flatMap((c: Cliente) => c.direcciones?.map((d) => d.municipio).filter((m: string | undefined): m is string => !!m) || [])))
          .sort();
    const segmentos = Array.from(new Set(clientes.map(getSegmentoNombre).filter((s): s is string => !!s))).sort();
    const clasificaciones = ["ORO", "PLATA", "BRONCE", "RIESGO"];
    const riesgos = Array.from(new Set(clientes.map(getRiesgoNombre).filter((r): r is string => !!r))).sort();
    const empresas = Array.from(
      new Map(
        clientes
          .filter((c: Cliente) => c.empresa)
          .map((c: Cliente) => [c.empresa!.id, { id: c.empresa!.id, nombre: c.empresa!.nombre }])
      ).values()
    ).sort((a, b) => a.nombre.localeCompare(b.nombre));
    return { municipios, segmentos, clasificaciones, riesgos, empresas, departamentos };
  }, [clientes, mounted, filters.departamento, departments, municipalities]);

  const handleSort = (key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "desc" };
    });
  };

  const openClienteExpediente = (cliente: Cliente) => {
    setSelectedCliente(cliente);
  };

  const handleClienteRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    cliente: Cliente,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openClienteExpediente(cliente);
  };

  const itemsPerPage = pagination?.limit || 10;
  const totalPages = pagination?.totalPages || 0;
  const paginatedClientes = clientes;

  const activeFiltersCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "empresas") return (value as string[]).length > 0;
    if (key === "municipio" || key === "departamento" || key === "clasificacion" || key === "segmento" || key === "riesgo" || key === "tipoCliente") return value !== "all";
    return !!value;
  }).length;

  const hasActiveFilters = activeFiltersCount > 0 || search !== "" || activeSegment !== "all" || onlySinVisita || onlyWithPendingPayments || onlySinServicios;

  const resetFilters = () => {
    skipNextClientesUiCacheWriteRef.current = false;
    clearClientesUiCache();
    setFilters(createDefaultClientesFilters());
    setSortConfig(null);
    setSearch("");
    setActiveSegment("all");
    setCurrentPage(1);
    setOnlySinVisita(false);
    setOnlyWithPendingPayments(false);
    setOnlySinServicios(false);
  };

  const buildClientesPresetSnapshot = () => ({
    activeSegment,
    search,
    sortConfig,
    onlySinVisita,
    onlyWithPendingPayments,
    onlySinServicios,
    filters,
  });

  const applyCustomPreset = (preset: DashboardPreset) => {
    const payload = (preset.filters || {}) as {
      activeSegment?: string;
      search?: string;
      sortConfig?: { key: string; direction: "asc" | "desc" } | null;
      onlySinVisita?: boolean;
      onlyWithPendingPayments?: boolean;
      onlySinServicios?: boolean;
      filters?: Partial<ClientesFilters>;
    };
    const presetFilters = payload.filters;

    setActiveSegment(payload.activeSegment || "all");
    setSearch(payload.search || "");
    setSortConfig(payload.sortConfig || null);
    setOnlySinVisita(Boolean(payload.onlySinVisita));
    setOnlyWithPendingPayments(Boolean(payload.onlyWithPendingPayments));
    setOnlySinServicios(Boolean(payload.onlySinServicios));
    setFilters({
      ...createDefaultClientesFilters(),
      ...presetFilters,
      empresas: Array.isArray(presetFilters?.empresas)
        ? presetFilters.empresas
        : [],
      tipoCliente: normalizeTipoClienteFilter(presetFilters?.tipoCliente),
    });
    setCurrentPage(1);
  };

  const openCreatePresetModal = () => {
    setEditingPresetId(null);
    setPresetForm({ name: "", colorToken: "sky", isShared: false });
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

  const savePreset = async () => {
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
          filters: buildClientesPresetSnapshot(),
        });
        toast.success("Preset actualizado");
      } else {
        await createDashboardPreset({
          module: "CLIENTES",
          name: presetForm.name.trim(),
          colorToken: presetForm.colorToken,
          isShared: presetForm.isShared,
          filters: buildClientesPresetSnapshot(),
        });
        toast.success("Preset creado");
      }
      setIsPresetModalOpen(false);
      const data = await listDashboardPresets("CLIENTES");
      setCustomPresets(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error saving preset", error);
      toast.error("No fue posible guardar el preset");
    }
  };

  const removePreset = async (id: string) => {
    try {
      await deleteDashboardPreset(id);
      setCustomPresets((prev) => prev.filter((p) => p.id !== id));
      toast.success("Preset eliminado");
    } catch (error) {
      console.error("Error deleting preset", error);
      toast.error("No fue posible eliminar el preset");
    }
  };

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, filters, activeSegment]);

  useEffect(() => {
    let mountedPreset = true;
    const run = async () => {
      try {
        const data = await listDashboardPresets("CLIENTES");
        if (!mountedPreset) return;
        setCustomPresets(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error loading clientes presets", error);
      }
    };
    void run();
    return () => {
      mountedPreset = false;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isCtrlD = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d";

      if (isCtrlD) {
        event.preventDefault();
        setShowSuggestionsQueue((prev) => !prev);
        return;
      }

      if (showSuggestionsQueue) {
        event.preventDefault();
        setShowSuggestionsQueue(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showSuggestionsQueue]);

  React.useEffect(() => {
    const loadConfigs = async () => {
      if (!selectedClienteForConfig) return;
      setConfigLoading(true);
      const configs = await configClient.getClienteOperativa(selectedClienteForConfig.id) as ConfiguracionOperativa[];
      setActiveConfigs(configs);
      const globalConfig = configs.find(c => !c.direccionId);
      if (globalConfig) {
        setConfigForm({
          protocoloServicio: globalConfig.protocoloServicio || "",
          observacionesFijas: globalConfig.observacionesFijas || "",
          requiereFirmaDigital: globalConfig.requiereFirmaDigital,
          requiereFotosEvidencia: globalConfig.requiereFotosEvidencia,
          duracionEstimada: globalConfig.duracionEstimada || 60,
          frecuenciaSugerida: globalConfig.frecuenciaSugerida || 30,
          elementosPredefinidos: (globalConfig.elementosPredefinidos as unknown as ElementoPredefinido[]) || [],
        });
      } else {
        setConfigForm({
          protocoloServicio: "",
          observacionesFijas: "",
          requiereFirmaDigital: true,
          requiereFotosEvidencia: true,
          duracionEstimada: 60,
          frecuenciaSugerida: 30,
          elementosPredefinidos: [],
        });
      }
      setCurrentConfigSede("all");
      setConfigLoading(false);
    };
    loadConfigs();
  }, [selectedClienteForConfig]);

  React.useEffect(() => {
    const loadHistory = async () => {
      if (!selectedClienteForHistory) return;
      setHistoryLoading(true);
      const history = await serviciosClient.getAll(undefined, selectedClienteForHistory.id);
      setServiceHistory(history as unknown as OrdenServicio[]);
      setHistoryLoading(false);
    };
    loadHistory();
  }, [selectedClienteForHistory]);

  const handleSedeChange = (sedeValue: string) => {
    setCurrentConfigSede(sedeValue);
    const config = activeConfigs.find(c =>
      sedeValue === "all" ? !c.direccionId : c.direccion?.direccion === sedeValue
    );
    if (config) {
      setConfigForm({
        protocoloServicio: config.protocoloServicio || "",
        observacionesFijas: config.observacionesFijas || "",
        requiereFirmaDigital: config.requiereFirmaDigital,
        requiereFotosEvidencia: config.requiereFotosEvidencia,
        duracionEstimada: config.duracionEstimada || 60,
        frecuenciaSugerida: config.frecuenciaSugerida || 30,
        elementosPredefinidos: (config.elementosPredefinidos as ElementoPredefinido[]) || [],
      });
    } else {
      setConfigForm({
        protocoloServicio: "",
        observacionesFijas: "",
        requiereFirmaDigital: true,
        requiereFotosEvidencia: true,
        duracionEstimada: 60,
        frecuenciaSugerida: 30,
        elementosPredefinidos: [],
      });
    }
  };

  const handleAddElement = () => {
    if (!newElement.nombre || !newElement.tipo) {
      toast.error("Nombre y Tipo son obligatorios");
      return;
    }
    setConfigForm(prev => ({
      ...prev,
      elementosPredefinidos: [...prev.elementosPredefinidos, { ...newElement }]
    }));
    setNewElement({ nombre: "", tipo: "Estación de Cebo", ubicacion: "" });
  };

  const handleRemoveElement = (index: number) => {
    setConfigForm(prev => ({
      ...prev,
      elementosPredefinidos: prev.elementosPredefinidos.filter((_, i) => i !== index)
    }));
  };

  const handleSaveConfig = async () => {
    if (!selectedClienteForConfig) return;
    const empresaId =
      getBrowserScopedEnterpriseId(accessScope) ?? getBrowserCookie("x-enterprise-id");
    if (!empresaId) {
      toast.error("No se encontró la empresa activa");
      return;
    }
    const direccionId = currentConfigSede === "all"
      ? null
      : selectedClienteForConfig.direcciones?.find(d => d.direccion === currentConfigSede)?.id || null;
    const payload = {
      clienteId: selectedClienteForConfig.id,
      empresaId,
      direccionId,
      ...configForm,
    };
    toast.promise(configClient.upsertOperativa(payload), {
      loading: "Guardando configuración...",
      success: () => {
        setSelectedClienteForConfig(null);
        return "Configuración guardada exitosamente";
      },
      error: (err) => err.message || "Error al guardar la configuración",
    });
  };

  if (!mounted || isLoadingRole) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="animate-pulse text-xs font-medium text-muted-foreground">
          Sincronizando cartera...
        </div>
      </div>
    );
  }

  if (!checkPermission("CLIENT_VIEW")) {
    return null;
  }

  return (
    <div className="relative isolate flex h-full flex-col bg-background px-3 py-3 sm:px-4 lg:px-5">
      {/* Sub-Header Estratégico */}
      <div className="relative z-20 shrink-0 rounded-t-[8px] border border-border bg-card px-4 py-3 shadow-sm lg:px-6">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-border bg-muted text-muted-foreground">
              <Contact className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-medium tracking-tight text-foreground">
                Cartera de clientes
              </h1>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                Gestión estratégica y segmentación de la base instalada.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">
            {checkPermission("CLIENT_CREATE") && (
              <Link href="/dashboard/clientes/nuevo" className="shrink-0">
                <span className="inline-flex h-7 items-center justify-center gap-1.5 rounded-[6px] bg-[#5B7CFA] px-3 text-[11px] font-medium text-white transition-colors hover:bg-[#4f6fe8]">
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Nuevo cliente
                </span>
              </Link>
            )}
            <Button
              onClick={() => setShowSuggestionsQueue(true)}
              className="h-7 rounded-[6px] bg-amber-500 px-3 text-[11px] font-medium text-white transition-colors hover:bg-amber-600"
            >
              <Zap className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              Cola Operativa
              {((localSugerenciasStats?.pendientesPorPrioridad
                ? Number(localSugerenciasStats.pendientesPorPrioridad.CRITICA || 0) +
                  Number(localSugerenciasStats.pendientesPorPrioridad.ALTA || 0) +
                  Number(localSugerenciasStats.pendientesPorPrioridad.MEDIA || 0) +
                  Number(localSugerenciasStats.pendientesPorPrioridad.BAJA || 0)
                : sugerencias.filter((s) => s.estado === "PENDIENTE").length) > 0) && (
                <span className="ml-1 rounded-full bg-white px-1.5 py-0.5 text-[9px] font-medium text-amber-600">
                  {localSugerenciasStats?.pendientesPorPrioridad
                    ? Number(localSugerenciasStats.pendientesPorPrioridad.CRITICA || 0) +
                      Number(localSugerenciasStats.pendientesPorPrioridad.ALTA || 0) +
                      Number(localSugerenciasStats.pendientesPorPrioridad.MEDIA || 0) +
                      Number(localSugerenciasStats.pendientesPorPrioridad.BAJA || 0)
                    : sugerencias.filter((s) => s.estado === "PENDIENTE").length}
                </span>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowKPIs(!showKPIs)}
              className="h-7 rounded-[6px] px-3 text-[11px] font-medium"
            >
              {showKPIs ? (
                <>
                  <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                  Ocultar indicadores
                </>
              ) : (
                <>
                  <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                  Ver indicadores
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadKpis(true)}
              disabled={kpisLoading}
              className="h-7 rounded-[6px] px-3 text-[11px] font-medium"
            >
              <RotateCcw
                className={cn("h-3.5 w-3.5", kpisLoading && "animate-spin")}
                aria-hidden="true"
              />
              Actualizar
            </Button>
          </div>
        </div>
      </div>

      {/* Contenedor Principal de Datos */}
      <div className="relative z-0 min-h-0 flex-1">
        <div className="flex h-full w-full flex-col">

          {/* KPI Cards Grid */}
          {showKPIs && (
            <div className="relative z-0 shrink-0 border-x border-b border-border bg-card px-4 py-3 lg:px-6">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                  Indicadores de clientes · Resumen comercial de la vista actual
                </p>
              </div>

              {kpisLoading ? (
                <div className="grid min-w-max grid-flow-col auto-cols-[minmax(150px,1fr)] gap-2 overflow-x-auto pb-1 lg:min-w-0 lg:grid-flow-row lg:grid-cols-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="min-h-[68px] rounded-[6px] border border-border bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : kpisError ? (
                <div className="rounded-[6px] border border-red-200 bg-red-50 p-3 text-[11px] font-medium text-red-700">
                  No se pudieron cargar los indicadores en este momento.
                </div>
              ) : kpisData?.overview ? (
                <div className="grid min-w-max grid-flow-col auto-cols-[minmax(150px,1fr)] gap-2 overflow-x-auto pb-1 lg:min-w-0 lg:grid-flow-row lg:grid-cols-5">
                  {[
                    { label: "Total de clientes", val: kpisData.overview.total, icon: User, color: "bg-primary" },
                    { label: "Clientes empresa", val: kpisData.overview.empresas, icon: Building2, color: "bg-[#01ADFB]" },
                    { label: "Clientes Oro", val: kpisData.overview.oro, icon: Trophy, color: "bg-[#01ADFB]" },
                    { label: "Atención prioritaria", val: kpisData.overview.riesgoCritico, icon: AlertCircle, color: "bg-muted-foreground" },
                    { label: "Salud promedio", val: kpisData.overview.avgScore, icon: Activity, color: "bg-muted-foreground" },
                  ].map((item, i) => (
                    <div key={i} className="flex min-h-[68px] items-center gap-2 rounded-[6px] border border-border bg-muted/30 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border bg-card text-muted-foreground">
                        <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[10px] text-muted-foreground">{item.label}</p>
                        <p className="truncate text-[15px] font-medium leading-tight text-foreground">{item.val}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {!kpisLoading && !kpisError && (
                <div className="mt-3 flex items-center justify-between gap-3 overflow-x-auto rounded-[6px] border border-border bg-muted/30 px-3 py-2 scrollbar-hide">
                  <div className="flex items-center gap-1.5">
                    {[
                      { id: "all", label: "Todos", title: "Muestra todos los clientes.", count: pagination?.total ?? kpisData?.overview?.total ?? 0, icon: Target, tone: undefined },
                      { id: "riesgoFuga", label: "Por retener", title: "Clientes que conviene contactar para conservarlos.", count: kpisData?.segmentacion?.riesgoFuga?.count ?? 0, icon: AlertCircle, tone: "danger" },
                      { id: "upsellPotencial", label: "Oportunidad comercial", title: "Clientes con potencial para ofrecer servicios complementarios.", count: kpisData?.segmentacion?.upsellPotencial?.count ?? 0, icon: Trophy, tone: "warn" },
                      { id: "dormidos", label: "Sin atención reciente", title: "Clientes que llevan mucho tiempo sin atención registrada.", count: kpisData?.segmentacion?.dormidos?.count ?? 0, icon: Clock, tone: undefined },
                      { id: "operacionEstable", label: "Al día", title: "Clientes con operación estable y sin señales urgentes.", count: kpisData?.segmentacion?.operacionEstable?.count ?? 0, icon: ShieldCheck, tone: undefined },
                    ].map((seg) => (
                      <button
                        key={seg.id}
                        title={seg.title || seg.label}
                        onClick={() => {
                          if (seg.id === "all") {
                            resetFilters();
                          } else {
                            setActiveSegment(seg.id);
                            setCurrentPage(1);
                            setOnlySinVisita(false);
                          }
                        }}
                        className={cn(
                          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                          activeSegment === seg.id
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                            : "border-border bg-card text-muted-foreground hover:bg-muted",
                          seg.tone === "danger" && activeSegment !== seg.id && "text-red-600",
                          seg.tone === "warn" && activeSegment !== seg.id && "text-amber-600",
                        )}
                      >
                        <seg.icon className="h-3 w-3" aria-hidden="true" />
                        {seg.label}
                        <span
                          className={cn(
                            "rounded-full px-1.5 text-[10px] font-medium",
                            activeSegment === seg.id
                              ? "bg-indigo-200 text-indigo-700"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {seg.count}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-b-[8px] border border-border bg-card shadow-sm">
            {/* Barra de Filtros Unificada */}
            <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:px-6">
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <Input
                    placeholder="Buscar por nombre, apellido, número o documento..."
                    className="h-8 rounded-[6px] border-border bg-muted pl-9 text-[11px] font-normal shadow-none placeholder:text-muted-foreground"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={cn(
                    "flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border px-3 text-[11px] font-medium transition-colors",
                    activeFiltersCount > 0
                      ? "border-[#5B7CFA] bg-indigo-50 text-indigo-700"
                      : "border-border bg-card text-muted-foreground hover:bg-muted",
                    showFilters && "border-foreground bg-foreground text-background"
                  )}
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{showFilters ? "Ocultar" : "Filtros"}</span>
                </button>

                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Borrar filtros</span>
                  </button>
                )}
              </div>

              </div>

              {/* Presets de Filtro Rápidos */}
              <div className="flex items-center gap-2 overflow-x-auto border-b border-border bg-card px-4 py-2.5 scrollbar-hide lg:px-6">
                <span className="mr-1 shrink-0 text-[10px] font-medium uppercase tracking-[0.05em] text-muted-foreground">Atajos</span>
                {[
                  { label: "Atención prioritaria", title: "Muestra clientes que necesitan gestión pronto.", icon: AlertCircle, color: "hover:border-red-500 hover:bg-red-50", action: () => { resetFilters(); setFilters(f => ({ ...f, riesgo: "CRITICO" })); } },
                  { 
                    label: "Sin visita agendada",
                    title: "Muestra clientes que no tienen una próxima atención programada.",
                    icon: Calendar, 
                    color: onlySinVisita ? "border-purple-500 bg-purple-50 text-purple-700" : "hover:border-purple-500 hover:bg-purple-50", 
                    action: () => { 
                      const newValue = !onlySinVisita;
                      resetFilters(); 
                      setOnlySinVisita(newValue);
                      if (newValue) setSortConfig({ key: "proximaVisita", direction: "asc" }); 
                    } 
                  },
                  { 
                    label: "Con pagos pendientes",
                    title: "Muestra clientes con saldos por resolver.",
                    icon: FileText, 
                    color: onlyWithPendingPayments ? "border-red-500 bg-red-50 text-red-700" : "hover:border-red-500 hover:bg-red-50", 
                    action: () => { 
                      const newValue = !onlyWithPendingPayments;
                      resetFilters(); 
                      setOnlyWithPendingPayments(newValue);
                    } 
                  },
                  { 
                    label: "Sin historial",
                    title: "Muestra clientes sin atenciones registradas.",
                    icon: Box, 
                    color: onlySinServicios ? "border-amber-500 bg-amber-50 text-amber-700" : "hover:border-amber-500 hover:bg-amber-50", 
                    action: () => { 
                      const newValue = !onlySinServicios;
                      resetFilters(); 
                      setOnlySinServicios(newValue);
                    } 
                  },
                  {
                    label: "Personas",
                    title: "Muestra clientes registrados como personas.",
                    icon: User,
                    color: filters.tipoCliente === "PERSONA" ? "border-[#01ADFB] bg-[#01ADFB]/10 text-[#01ADFB]" : "hover:border-[#01ADFB] hover:bg-[#01ADFB]/10",
                    action: () => {
                      const newValue = filters.tipoCliente === "PERSONA" ? "all" : "PERSONA";
                      resetFilters();
                      setFilters((f) => ({ ...f, tipoCliente: newValue }));
                    },
                  },
                  {
                    label: "Clientes empresa",
                    title: "Muestra clientes registrados como empresas.",
                    icon: Building2,
                    color: filters.tipoCliente === "EMPRESA" ? "border-slate-900 bg-slate-900 text-white" : "hover:border-slate-900 hover:bg-slate-100",
                    action: () => {
                      const newValue = filters.tipoCliente === "EMPRESA" ? "all" : "EMPRESA";
                      resetFilters();
                      setFilters((f) => ({ ...f, tipoCliente: newValue }));
                    },
                  },
                ].map((preset, i) => (
                  <button
                    key={i}
                    title={preset.title || preset.label}
                    onClick={preset.action}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border border-border bg-background px-2.5 py-1.5 text-[10px] font-medium transition-colors",
                      preset.color
                    )}
                  >
                    <preset.icon className="h-3 w-3" aria-hidden="true" />
                    {preset.label}
                  </button>
                ))}
                {customPresets.map((preset) => (
                  <div key={preset.id} className="inline-flex items-center gap-1">
                    <button
                      onClick={() => applyCustomPreset(preset)}
                      className={cn(
                        "flex items-center gap-1.5 whitespace-nowrap rounded-[5px] border px-2.5 py-1.5 text-[10px] font-medium transition-colors",
                        PRESET_COLOR_STYLES[preset.colorToken] || "border-border bg-background text-foreground",
                      )}
                    >
                      {preset.name}
                    </button>
                    <button
                      onClick={() => openEditPresetModal(preset)}
                      className="h-7 w-7 rounded-[5px] border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Editar preset"
                    >
                      <Pencil className="h-3.5 w-3.5 mx-auto" />
                    </button>
                    <button
                      onClick={() => removePreset(preset.id)}
                      className="h-7 w-7 rounded-md border border-border bg-background text-muted-foreground hover:text-destructive"
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
                  className="h-7 rounded-[5px] px-2.5 text-[10px] font-medium"
                >
                  + Nuevo atajo
                </Button>
              </div>

              {/* Integrated Filter Panel */}
            {showFilters && (
              <div className="max-h-[55vh] overflow-y-auto border-b border-border bg-muted/30 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300 custom-scrollbar lg:px-6">
                <div className="mx-auto">
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="flex items-center gap-2 text-[12px] font-medium text-foreground">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> Segmentación avanzada
                      </h3>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        Refiná los resultados de la cartera de clientes
                      </p>
                    </div>
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-1.5 rounded-[6px] border border-border px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> REINICIAR FILTROS
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                    {/* Empresa visible según alcance */}
                    {!accessScope?.isEmpresaLocked && filterOptions.empresas.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-[11px] text-muted-foreground">Empresa Responsable</Label>
                        <Input
                          placeholder="FILTRAR POR NOMBRE..."
                          value={empresaSearch}
                          onChange={(e) => setEmpresaSearch(e.target.value)}
                          className="mb-2 h-8 rounded-[6px] border border-border bg-background text-[11px] text-foreground shadow-none"
                        />
                        <div className="flex max-h-32 flex-col gap-2 overflow-y-auto rounded-[6px] border border-border bg-background p-3 custom-scrollbar">
                          {filterOptions.empresas
                            .filter(emp => emp.nombre.toLowerCase().includes(empresaSearch.toLowerCase()))
                            .map((emp: { id: string, nombre: string }) => (
                            <label key={emp.id} className="group flex cursor-pointer items-center gap-2 text-[11px] font-medium text-foreground">
                              <div className={cn(
                                "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-border transition-colors",
                                filters.empresas.includes(emp.id) ? "bg-[#01ADFB] border-[#01ADFB]" : "bg-background group-hover:border-[#01ADFB]"
                              )}>
                                {filters.empresas.includes(emp.id) && <Check className="h-3 w-3 text-white" />}
                              </div>
                              <input
                                type="checkbox"
                                className="hidden"
                                checked={filters.empresas.includes(emp.id)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFilters(prev => ({
                                    ...prev,
                                    empresas: checked
                                      ? [...prev.empresas, emp.id]
                                      : prev.empresas.filter(id => id !== emp.id)
                                  }));
                                }}
                              />
                              <span className="truncate flex-1" title={emp.nombre}>{emp.nombre}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Tipo de Cliente */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Tipo de Cliente</Label>
                      <Combobox
                        options={[
                          { value: "all", label: "TODOS LOS TIPOS" },
                          { value: "PERSONA", label: "PERSONA NATURAL" },
                          { value: "EMPRESA", label: "EMPRESA" },
                        ]}
                        value={filters.tipoCliente}
                        onChange={(val) => setFilters(prev => ({ ...prev, tipoCliente: normalizeTipoClienteFilter(val) }))}
                        placeholder="Seleccionar..."
                        className="h-8 rounded-[6px] text-[11px]"
                        hideSearch
                      />
                    </div>

                    {/* Departamento */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Departamento</Label>
                      <Combobox
                        options={[
                          { value: "all", label: "TODOS LOS DEPARTAMENTOS" },
                          ...filterOptions.departamentos.map(d => ({ value: d.id || "", label: d.name.toUpperCase() }))
                        ]}
                        value={filters.departamento}
                        onChange={(val) => {
                          setFilters(prev => ({ ...prev, departamento: val, municipio: "all" }));
                        }}
                        placeholder="Seleccionar..."
                        className="h-8 rounded-[6px] text-[11px]"
                      />
                    </div>

                    {/* Municipio */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Municipio / Localidad</Label>
                      <Combobox
                        options={[
                          { value: "all", label: "TODOS LOS MUNICIPIOS" },
                          ...filterOptions.municipios.map(m => typeof m === 'string' ? { value: m, label: m.toUpperCase() } : { value: m.id || "", label: m.name.toUpperCase() })
                        ]}
                        value={filters.municipio}
                        onChange={(val) => setFilters(prev => ({ ...prev, municipio: val }))}
                        placeholder="Seleccionar..."
                        className="h-8 rounded-[6px] text-[11px]"
                        disabled={filters.departamento === "all" && initialDepartments.length > 0}
                      />
                    </div>

                    {/* Barrio */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Barrio / Sector</Label>
                      <Input
                        placeholder="EJ: EL POBLADO"
                        value={filters.barrio}
                        onChange={(e) => setFilters(prev => ({ ...prev, barrio: e.target.value }))}
                        className="h-8 rounded-[6px] border border-border bg-background text-[11px] text-foreground shadow-none"
                      />
                    </div>

                    {/* Clasificación */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Clasificación Scoring</Label>
                      <Combobox
                        options={[
                          { value: "all", label: "TODAS LAS CATEGORÍAS" },
                          ...filterOptions.clasificaciones.map(c => ({ value: c, label: c }))
                        ]}
                        value={filters.clasificacion}
                        onChange={(val) => setFilters(prev => ({ ...prev, clasificacion: val }))}
                        placeholder="Seleccionar..."
                        className="h-8 rounded-[6px] text-[11px]"
                        hideSearch
                      />
                    </div>

                    {/* Segmento */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Segmento de Negocio</Label>
                      <Combobox
                        options={[
                          { value: "all", label: "TODOS LOS SEGMENTOS" },
                          ...filterOptions.segmentos.map(s => ({ value: s, label: s.toUpperCase() }))
                        ]}
                        value={filters.segmento}
                        onChange={(val) => setFilters(prev => ({ ...prev, segmento: val }))}
                        placeholder="Seleccionar..."
                        className="h-8 rounded-[6px] text-[11px]"
                      />
                    </div>

                    {/* Riesgo */}
                    <div className="space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Nivel de Riesgo Operativo</Label>
                      <Combobox
                        options={[
                          { value: "all", label: "TODOS LOS NIVELES" },
                          ...filterOptions.riesgos.map(r => ({ value: r, label: r.toUpperCase() }))
                        ]}
                        value={filters.riesgo}
                        onChange={(val) => setFilters(prev => ({ ...prev, riesgo: val }))}
                        placeholder="Seleccionar..."
                        className="h-8 rounded-[6px] text-[11px]"
                        hideSearch
                      />
                    </div>

                    {/* Rango de Fechas */}
                    <div className="lg:col-span-2 space-y-2">
                      <Label className="text-[11px] text-muted-foreground">Rango de Fecha de Registro</Label>
                      <div className="flex items-start gap-2">
                        <DatePicker
                          date={filters.fechaDesde ? ymdToPickerDate(filters.fechaDesde) : undefined}
                          onChange={(d) => setFilters(prev => ({ ...prev, fechaDesde: pickerDateToYmd(d) }))}
                          className="h-8 flex-1 rounded-[6px] border-border bg-background text-[11px]"
                          placeholder="FECHA INICIAL"
                        />
                        <span className="text-[10px] font-medium text-muted-foreground">AL</span>
                        <DatePicker
                          date={filters.fechaHasta ? ymdToPickerDate(filters.fechaHasta) : undefined}
                          onChange={(d) => setFilters(prev => ({ ...prev, fechaHasta: pickerDateToYmd(d) }))}
                          className="h-8 flex-1 rounded-[6px] border-border bg-background text-[11px]"
                          placeholder="FECHA FINAL"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end border-t border-border pt-3">
                    <Button
                      onClick={() => setShowFilters(false)}
                      className="h-8 rounded-[6px] bg-foreground px-4 text-[11px] font-medium text-background transition-opacity hover:opacity-90"
                    >
                      Aplicar y cerrar
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Tabla con Scroll Interno */}
            <div className="min-h-0 flex-1 overflow-hidden">
              <div className="h-full overflow-auto custom-scrollbar">
                <table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 z-10 border-b border-border bg-muted">
                      <th 
                        className="w-[22%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground cursor-pointer transition-colors hover:text-foreground"
                        onClick={() => handleSort("nombre")}
                      >
                        <div className="flex items-center gap-2">
                          Cliente / Perfil
                          <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === "nombre" ? "text-[#01ADFB]" : "opacity-30")} />
                        </div>
                      </th>
                      <th className="w-[18%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Contacto</th>
                      <th 
                        className="w-[12%] px-3 py-2 text-center text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground cursor-pointer transition-colors hover:text-foreground"
                        onClick={() => handleSort("score")}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Clasificación
                          <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === "score" ? "text-[#01ADFB]" : "opacity-30")} />
                        </div>
                      </th>
                      <th className="w-[11%] px-3 py-2 text-center text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Segmentación</th>
                      <th 
                        className="px-3 py-2 text-center text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground cursor-pointer transition-colors hover:text-foreground"
                        onClick={() => handleSort("riesgo")}
                      >
                        <div className="flex items-center justify-center gap-2">
                          Riesgo
                          <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === "riesgo" ? "text-[#01ADFB]" : "opacity-30")} />
                        </div>
                      </th>
                      <th 
                        className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground cursor-pointer transition-colors hover:text-foreground"
                        onClick={() => handleSort("proximaVisita")}
                      >
                        <div className="flex items-center gap-2">
                          Próxima Visita
                          <ArrowUpDown className={cn("h-3 w-3", sortConfig?.key === "proximaVisita" ? "text-[#01ADFB]" : "opacity-30")} />
                        </div>
                      </th>
                      <th className="px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">Ubicación</th>
                      <th className="w-[56px] py-2 pl-3 pr-5 text-right text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">···</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {paginatedClientes.map((cliente) => (
                      <tr
                        key={cliente.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`Ver expediente de ${
                          cliente.tipoCliente === "EMPRESA"
                            ? cliente.razonSocial || "cliente empresa"
                            : `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim() || "cliente persona natural"
                        }`}
                        className="group cursor-pointer transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B7CFA]"
                        onClick={() => openClienteExpediente(cliente)}
                        onKeyDown={(event) => handleClienteRowKeyDown(event, cliente)}
                      >
                        <td className="px-3 py-3 align-middle">
                          <div className="flex items-start gap-2">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-border bg-muted text-muted-foreground">
                              {cliente.tipoCliente === "EMPRESA" ? <Building2 className="h-3.5 w-3.5" aria-hidden="true" /> : <User className="h-3.5 w-3.5" aria-hidden="true" />}
                            </div>
                            <div className="min-w-0">
                              <span className="block max-w-[150px] truncate text-[12px] font-medium text-foreground sm:max-w-[200px] lg:max-w-[280px]">
                                {cliente.tipoCliente === "EMPRESA" ? cliente.razonSocial : `${cliente.nombre} ${cliente.apellido}`}
                              </span>
                              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                {cliente.tipoCliente === "EMPRESA" ? "NIT" : (cliente.tipoDocumento || "CC")}: {cliente.tipoCliente === "EMPRESA" ? (cliente.nit || "S/N") : (cliente.numeroDocumento || "S/N")}
                              </div>
                              <span className="mt-1 inline-flex rounded-[3px] border border-border bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                                {cliente.tipoCliente === "EMPRESA" ? "Corporativo" : "Persona natural"}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                              <Phone className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                              {cliente.telefono}
                              <span className={cn("h-1.5 w-1.5 rounded-full", cliente.correo ? "bg-emerald-500" : "bg-slate-400")} />
                            </div>
                            {cliente.correo && (
                              <div className="flex max-w-[120px] items-center gap-1.5 truncate text-[10px] text-muted-foreground">
                                <Mail className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                                {cliente.correo}
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-3 py-3 align-middle text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className={cn(
                              "inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium",
                              SCORE_COLORS[(cliente.clasificacion || "BRONCE") as keyof typeof SCORE_COLORS]
                            )}>
                              <Trophy className="h-2.5 w-2.5" aria-hidden="true" />
                              {cliente.clasificacion || "BRONCE"}
                            </div>
                            <span className="text-[10px] text-muted-foreground">{cliente.score || 0} pts</span>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-middle text-center">
                          <div className="inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-muted px-2 py-0.5">
                            <Target className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                            <span className="text-[10px] font-medium text-foreground">
                              {getSegmentoNombre(cliente) || "Otro"}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-middle text-center">
                          {(() => {
                            const riesgoNombre = getRiesgoNombre(cliente) || "BAJO";
                            const labelInfo = RIESGO_LABELS[riesgoNombre.toUpperCase() as keyof typeof RIESGO_LABELS] || {
                              label: riesgoNombre,
                              color: "text-muted-foreground bg-muted",
                              dot: "bg-muted-foreground"
                            };
                            return (
                              <div className={cn(
                                "inline-flex rounded-[4px] border px-2 py-0.5 text-[10px] font-medium",
                                labelInfo.color
                              )}>
                                {labelInfo.label}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-3 py-3 align-middle text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-foreground">
                              <Calendar className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                              {cliente.proximaVisita ? formatBogotaDate(cliente.proximaVisita) : "Pendiente"}
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {cliente.frecuenciaServicio ? `Cada ${cliente.frecuenciaServicio} días` : "Puntual"}
                            </span>
                          </div>
                        </td>

                        <td className="px-3 py-3 align-middle">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <MapPin className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                              <span className="max-w-[150px] truncate text-[11px] font-medium text-foreground">
                                {cliente.direcciones?.[0]?.direccion || "Sin dirección"}
                              </span>
                            </div>
                            <span className="ml-4 text-[10px] text-muted-foreground">
                              {cliente.direcciones?.[0]?.municipio || "S/M"}
                            </span>
                          </div>
                        </td>

                        <td
                          className="py-3 pl-3 pr-5 text-right align-middle"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex h-7 w-7 items-center justify-center rounded-[5px] border border-border bg-muted text-muted-foreground transition-colors hover:bg-foreground hover:text-background">
                                <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 rounded-[6px] border border-border bg-card p-1 shadow-xl">
                              <DropdownMenuItem
                                onClick={() => openClienteExpediente(cliente)}
                                className="flex cursor-pointer items-center gap-2 rounded-[5px] py-2 text-[11px] font-medium text-foreground hover:bg-muted"
                              >
                                <Eye className="h-4 w-4 text-[#01ADFB]" /> Ver Expediente
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSelectedClienteForSuggestions(cliente)}
                                className="flex cursor-pointer items-center gap-2 rounded-[5px] py-2 text-[11px] font-medium text-foreground hover:bg-muted"
                              >
                                <Zap className="h-4 w-4 text-amber-500" /> Sugerencias
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSelectedClienteForHistory(cliente)}
                                className="flex cursor-pointer items-center gap-2 rounded-[5px] py-2 text-[11px] font-medium text-foreground hover:bg-muted"
                              >
                                <FileText className="h-4 w-4 text-purple-600" /> Historial O.S
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={portalLinkLoadingClienteId === cliente.id}
                                onClick={() => void handleCopyClientPortal(cliente)}
                                className="flex cursor-pointer items-center gap-2 rounded-[5px] py-2 text-[11px] font-medium text-foreground hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
                              >
                                <Copy className="h-4 w-4 text-[#01ADFB]" />
                                {portalLinkLoadingClienteId === cliente.id
                                  ? "Preparando portal"
                                  : "Copiar portal del cliente"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setSelectedClienteForConfig(cliente)}
                                className="flex cursor-pointer items-center gap-2 rounded-[5px] py-2 text-[11px] font-medium text-foreground hover:bg-muted"
                              >
                                <Settings className="h-4 w-4 text-muted-foreground" /> Configuración
                              </DropdownMenuItem>
                              {checkPermission("CLIENT_EDIT") && (
                                <Link href={`/dashboard/clientes/${cliente.id}/editar`}>
                                  <DropdownMenuItem className="flex cursor-pointer items-center gap-2 rounded-[5px] py-2 text-[11px] font-medium text-foreground hover:bg-muted">
                                    <Pencil className="h-4 w-4 text-amber-600" /> Editar Perfil
                                  </DropdownMenuItem>
                                </Link>
                              )}
                              <DropdownMenuSeparator className="bg-border" />
                              {checkPermission("CLIENT_DELETE") && (
                                <DropdownMenuItem
                                  onClick={() => handleDelete(cliente)}
                                  className="flex cursor-pointer items-center gap-2 rounded-[5px] py-2 text-[11px] font-medium text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-4 w-4" /> Eliminar Cartera
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {paginatedClientes.length === 0 && !isPageLoading && (
                  <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                    <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground/40" />
                    <h2 className="text-base font-medium text-foreground">Sin resultados</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {hasActiveFilters
                        ? "No se encontraron clientes para su búsqueda."
                        : "Todavía no hay clientes registrados."}
                    </p>
                  </div>
                )}
                {isPageLoading && (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                    <Search className="mb-4 h-10 w-10 animate-pulse opacity-40" />
                    <p className="text-xs font-medium">Cargando clientes...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Paginación */}
            <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground lg:px-6">
              <div className="flex items-center gap-4">
                <span className="text-[11px] text-muted-foreground">
                  Mostrando {pagination?.total ? ((pagination.page - 1) * itemsPerPage) + 1 : 0}-{pagination?.total ? Math.min(pagination.total, pagination.page * itemsPerPage) : 0} de {pagination?.total ?? 0}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(page => {
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
                            "flex h-6 w-6 items-center justify-center rounded-[5px] text-[11px] font-medium transition-colors",
                            currentPage === page
                              ? "bg-[#5B7CFA] text-white"
                              : "border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          {page}
                        </button>
                      </React.Fragment>
                    ))}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || totalPages === 0}
                  className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div> {/* closes div (4) flex-1 bg-card */}
        </div> {/* closes div (3) max-w-[1600px] */}
      </div> {/* closes div (2) flex-1 min-h-0 px-4 ... */}

      {/* Modal de Detalles del Cliente - REDISEÑADO PARA MOSTRAR TODA LA INFO */}
      <Dialog open={!!selectedCliente} onOpenChange={(open) => !open && setSelectedCliente(null)}>
        <DialogContent className={cn("max-w-4xl", clientesDialogContentClass)}>
          <DialogHeader className="sr-only">
            <DialogTitle>Detalles del Cliente</DialogTitle>
          </DialogHeader>
          {selectedCliente && (
            <div className="flex flex-col h-[90vh]">
              {/* Header Estratégico */}
              <div className={cn(clientesDialogHeaderClass, "flex shrink-0 items-center justify-between gap-4")}>
                <div className="flex min-w-0 items-center gap-3">
                  <div className={clientesDialogIconClass}>
                    {selectedCliente.tipoCliente === "EMPRESA" ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  <div className="flex flex-col">
                    <h2 className={clientesDialogTitleClass}>
                      {selectedCliente.tipoCliente === "EMPRESA" ? (selectedCliente.razonSocial || "S/N") : `${selectedCliente.nombre || ''} ${selectedCliente.apellido || ''}`.trim()}
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="rounded-[4px] border border-border bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
                        {selectedCliente.tipoCliente === "EMPRESA" ? "Corporativo" : "Persona Natural"}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">
                        ID: {selectedCliente.id}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <div className={cn(
                    "inline-flex items-center gap-1 rounded-[4px] border px-2 py-1 text-[10px] font-medium",
                    SCORE_COLORS[selectedCliente.clasificacion || "BRONCE"]
                  )}>
                    <Trophy className="h-3 w-3" />
                    {selectedCliente.clasificacion || "BRONCE"}
                  </div>
                  <div className="flex items-center gap-2 rounded-[4px] border border-border bg-muted px-2 py-1">
                    <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Puntaje</span>
                    <span className="text-[11px] font-medium text-foreground">{selectedCliente.score || 0} pts</span>
                  </div>
                </div>
              </div>

              {/* Contenido con Scroll Interno */}
              <div className={cn(clientesDialogBodyClass, "flex-1 overflow-y-auto space-y-5 bg-background custom-scrollbar")}>

                {/* 1. SECCIÓN: RESUMEN ESTRATÉGICO */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-[5px] border border-border bg-card p-4">
                    <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-2">Segmento Negocio</p>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-[4px] bg-[#01ADFB]/10 flex items-center justify-center text-[#01ADFB]">
                        <Target className="h-4 w-4" />
                      </div>
                      <span className={cn(
                        "text-[12px] font-medium uppercase",
                        getSegmentoNombre(selectedCliente) ? "text-foreground" : "text-muted-foreground"
                      )}>
                        {getSegmentoNombre(selectedCliente) || "No Definido"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-[5px] border border-border bg-card p-4">
                    <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-2">Nivel de Riesgo</p>
                    {(() => {
                      const riesgoNombre = getRiesgoNombre(selectedCliente) || "BAJO";
                      const labelInfo = RIESGO_LABELS[riesgoNombre.toUpperCase() as keyof typeof RIESGO_LABELS] || {
                        label: riesgoNombre,
                        color: "text-muted-foreground bg-muted",
                        dot: "bg-muted-foreground"
                      };
                      return (
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-[4px] flex items-center justify-center", labelInfo.color)}>
                            <AlertCircle className="h-4 w-4" />
                          </div>
                          <span className={cn("text-[12px] font-medium uppercase text-foreground")}>
                            {labelInfo.label}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="rounded-[5px] border border-border bg-card p-4">
                    <p className="text-[9px] font-medium uppercase tracking-[0.12em] text-muted-foreground mb-2">Plan Actual</p>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-[4px] bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <Zap className="h-4 w-4" />
                      </div>
                      <span className="text-[12px] font-medium text-foreground uppercase">
                        {selectedCliente.planActual || "Plan Estándar"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. SECCIÓN: DATOS DE IDENTIDAD Y PERFIL */}
                <div className="space-y-4">
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-3 px-1">
                    <Fingerprint className="h-4 w-4 text-[#01ADFB]" /> Identidad y Perfil Corporativo
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 garounded-[5px] border border-border bg-card p-4 p-4">
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Tipo Documento</p>
                      <p className={cn("text-[11px] font-medium", selectedCliente.tipoDocumento ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.tipoDocumento || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Número / NIT</p>
                      <p className={cn("text-[11px] font-medium font-mono", (selectedCliente.nit || selectedCliente.numeroDocumento) ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.nit || selectedCliente.numeroDocumento || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Origen Cliente</p>
                      <p className={cn("text-[11px] font-medium", selectedCliente.origenCliente ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.origenCliente || "Desconocido"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Tipo Interés</p>
                      <p className={cn("text-[11px] font-medium", selectedCliente.tipoInteres?.nombre ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.tipoInteres?.nombre || "No definido"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Subsegmento</p>
                      <p className={cn("text-[11px] font-medium", selectedCliente.subsegmento ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.subsegmento || "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Act. Económica</p>
                      <p className={cn("text-[11px] font-medium", selectedCliente.actividadEconomica ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.actividadEconomica || "No Registrada"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Metraje Total</p>
                      <p className={cn("text-[11px] font-medium", selectedCliente.metrajeTotal ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.metrajeTotal ? `${selectedCliente.metrajeTotal} m²` : "N/A"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium text-muted-foreground uppercase">Rep. Legal</p>
                      <p className={cn("text-[11px] font-medium", selectedCliente.representanteLegal ? "text-foreground" : "text-muted-foreground")}>
                        {selectedCliente.representanteLegal || "No Definido"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. SECCIÓN: CONTACTO Y TRAZABILIDAD */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-3 px-1">
                      <Phone className="h-4 w-4 text-emerald-600" /> Líneas de Contacto
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-4 p-4 bg-muted rounded-[5px] border border-border">
                        <div className="h-8 w-8 rounded-[4px] bg-background flex items-center justify-center text-muted-foreground shadow-sm border border-border"><Phone className="h-4 w-4" /></div>
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground">Teléfono Principal</p>
                          <p className="text-[12px] font-bold text-foreground">{selectedCliente.telefono}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-muted rounded-[5px] border border-border">
                        <div className="h-8 w-8 rounded-[4px] bg-background flex items-center justify-center text-muted-foreground shadow-sm border border-border"><Phone className="h-4 w-4" /></div>
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground">Teléfono Secundario</p>
                          <p className="text-[12px] font-bold text-foreground">{selectedCliente.telefono2 || "N/A"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 p-4 bg-muted rounded-[5px] border border-border">
                        <div className="h-8 w-8 rounded-[4px] bg-background flex items-center justify-center text-muted-foreground shadow-sm border border-border"><Mail className="h-4 w-4" /></div>
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground">Correo Electrónico</p>
                          <p className="text-[12px] font-bold text-foreground">{selectedCliente.correo || "Sin correo"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-3 px-1">
                      <Calendar className="h-4 w-4 text-purple-600" /> Cronología y Métricas
                    </h3>
                    <div className="rounded-[5px] border border-border bg-card p-4 grid grid-cols-2 gap-y-6 gap-x-4">
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase">Creado El</p>
                        <p className="text-[11px] font-medium text-foreground">{selectedCliente.createdAt ? formatBogotaDate(selectedCliente.createdAt) : "N/A"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase">Última Visita</p>
                        <p className="text-[11px] font-medium text-foreground">{selectedCliente.ultimaVisita ? formatBogotaDate(selectedCliente.ultimaVisita) : "Ninguna"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase">Próxima Visita</p>
                        <p className="text-[11px] font-medium text-[#01ADFB]">{selectedCliente.proximaVisita ? formatBogotaDate(selectedCliente.proximaVisita) : "Pendiente"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase">Frecuencia (Días)</p>
                        <p className="text-[11px] font-medium text-foreground">{selectedCliente.frecuenciaServicio || "Puntual"}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase">Ticket Promedio</p>
                        <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">${Number(selectedCliente.ticketPromedio || 0).toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-medium text-muted-foreground uppercase">Marketing</p>
                        <span className={cn(
                          "text-[9px] font-medium px-2 py-0.5 rounded-md",
                          selectedCliente.aceptaMarketing 
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                            : "bg-destructive/10 text-destructive"
                        )}>
                          {selectedCliente.aceptaMarketing ? "AUTORIZADO" : "DENEGADO"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. SECCIÓN: SEDES Y UBICACIONES */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-3">
                      <MapPin className="h-4 w-4 text-orange-600" /> Sedes Operativas Registradas
                    </h3>
                    <span className="text-[10px] font-medium text-[#01ADFB] bg-[#01ADFB]/10 px-3 py-1 rounded-full uppercase">
                      {selectedCliente.direcciones?.length || 0} Sedes
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedCliente.direcciones?.map((dir, idx) => (
                      <div key={idx} className="rounded-[5px] border border-border bg-card p-4 relative group overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#01ADFB]/20 group-hover:bg-[#01ADFB] transition-colors" />
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#01ADFB]" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.08em]">{dir.nombreSede || `SEDE #${idx + 1}`}</span>
                          </div>
                          <span className="text-[9px] font-medium px-2 py-0.5 rounded bg-background border border-border text-foreground uppercase">
                            {dir.tipoUbicacion || "No Def."}
                          </span>
                        </div>
                        <h4 className="text-[12px] font-medium text-foreground mb-4">{dir.direccion}</h4>

                        <div className="grid grid-cols-2 gap-y-4 gap-x-2 border-t border-border pt-4">
                          <div className="space-y-1">
                            <p className="text-[9px] font-medium text-muted-foreground uppercase">Municipio</p>
                            <p className="text-[11px] font-medium text-foreground">{dir.municipio || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-medium text-muted-foreground uppercase">Barrio</p>
                            <p className="text-[11px] font-medium text-foreground">{dir.barrio || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-medium text-muted-foreground uppercase">Contacto</p>
                            <p className="text-[11px] font-medium text-foreground">{dir.nombreContacto || "N/A"}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-[9px] font-medium text-muted-foreground uppercase">Tel. Sede</p>
                            <p className="text-[11px] font-medium text-foreground">{dir.telefonoContacto || "N/A"}</p>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <p className="text-[9px] font-medium text-muted-foreground uppercase">Punto Crítico</p>
                            <p className="text-[11px] font-medium text-foreground">{dir.clasificacionPunto || "No Especificado"}</p>
                          </div>
                          <div className="col-span-2 space-y-1">
                            <p className="text-[9px] font-medium text-muted-foreground uppercase">Horario Operativo</p>
                            <p className="text-[11px] font-medium text-foreground">
                              {dir.horarioInicio && dir.horarioFin ? `${dir.horarioInicio} - ${dir.horarioFin}` : "Sin restricciones"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(!selectedCliente.direcciones || selectedCliente.direcciones.length === 0) && (
                      <div className="col-span-2 py-10 text-center border-2 border-dashed border-border rounded-[5px]">
                        <MapPin className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.08em]">Sin sedes operativas vinculadas</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 5. SECCIÓN: FLOTA VEHICULAR */}
                <div className="space-y-4 pb-10">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-3">
                      <Settings className="h-4 w-4 text-blue-600" /> Parque Automotor Vinculado
                    </h3>
                    <span className="text-[10px] font-medium text-foreground bg-muted px-3 py-1 rounded-full uppercase">
                      {selectedCliente.vehiculos?.length || 0} Vehículos
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {selectedCliente.vehiculos?.map((veh, idx) => (
                      <div key={idx} className="p-4 bg-muted rounded-[5px] border border-border flex flex-col items-center text-center group transition-all hover:border-foreground shadow-sm">
                        <div className="h-9 w-9 rounded-[4px] bg-background border border-border flex items-center justify-center mb-3 text-muted-foreground group-hover:text-foreground transition-colors shadow-sm">
                          <Settings className="h-4 w-4" />
                        </div>
                        <p className="text-[11px] font-medium text-foreground uppercase tracking-[0.08em] mb-1">{veh.placa}</p>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase">{veh.marca} {veh.modelo}</p>
                      </div>
                    ))}
                    {(!selectedCliente.vehiculos || selectedCliente.vehiculos.length === 0) && (
                      <div className="col-span-4 py-8 text-center border-2 border-dashed border-border rounded-[5px]">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.12em]">Sin vehículos registrados</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Footer con Acciones */}
              <div className={cn(clientesDialogFooterClass, "shrink-0 flex justify-end gap-2")}>
                {checkPermission("CLIENT_EDIT") && (
                  <button
                    onClick={() => router.push(`/dashboard/clientes/${selectedCliente.id}/editar`)}
                    className={cn("flex-1 bg-[#01ADFB] text-white hover:bg-[#0197dc]", clientesDialogButtonClass)}
                  >
                    Editar Perfil Estratégico
                  </button>
                )}
                <button
                  onClick={() => setSelectedCliente(null)}
                  className={cn("border border-border bg-background px-4 text-muted-foreground hover:bg-muted hover:text-foreground", clientesDialogButtonClass)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIGURACIÓN OPERATIVA - SERVICIOS */}
      <Dialog
        open={!!selectedClienteForConfig}
        onOpenChange={(open) => !open && setSelectedClienteForConfig(null)}
      >
        <DialogContent className={cn("max-w-5xl", clientesDialogContentClass)}>
          <DialogHeader className="sr-only">
            <DialogTitle>Configuración Operativa</DialogTitle>
          </DialogHeader>
          {selectedClienteForConfig && (
            <div className="flex flex-col h-[85vh]">
              {/* Header Contextual */}
              <div className="shrink-0 px-5 py-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="h-9 w-9 rounded-[5px] bg-[#01ADFB] flex items-center justify-center text-white shadow-sm shadow-[#01ADFB]/20">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-medium text-foreground tracking-tight uppercase">
                      Configuración Operativa
                    </h2>
                    <p className="text-[11px] font-bold text-muted-foreground mt-0.5 uppercase tracking-[0.08em]">
                      {selectedClienteForConfig.tipoCliente === "EMPRESA" ? selectedClienteForConfig.razonSocial : `${selectedClienteForConfig.nombre} ${selectedClienteForConfig.apellido}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-medium text-[#01ADFB] bg-[#01ADFB]/10 px-3 py-1 rounded-full uppercase">
                    Configuración del servicio
                  </span>
                  <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.08em]">
                    ID: {selectedClienteForConfig.id.split('-')[0]}...
                  </span>
                </div>
              </div>

              {/* Contenido Scrollable */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-8 custom-scrollbar">

                {configLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <Settings className="h-8 w-8 text-muted-foreground/50 animate-spin mb-4" />
                    <p className="text-[11px] text-muted-foreground">Preparando configuración...</p>
                  </div>
                ) : (
                  <>
                    {/* Selector de Sede para Configuración Específica */}
                    <div className="p-4 rounded-[5px] bg-[#01ADFB]/5 border border-[#01ADFB]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-8 w-8 rounded-[4px] bg-background flex items-center justify-center text-[#01ADFB] shadow-sm border border-border">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <h4 className="text-[11px] font-medium text-foreground uppercase">Ámbito de Configuración</h4>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Define si los cambios aplican a todas las sedes o una específica</p>
                        </div>
                      </div>
                      <div className="w-full md:w-64">
                        <Select
                          value={currentConfigSede}
                          onChange={(e) => handleSedeChange(e.target.value)}
                          className="h-11 text-[11px] font-bold bg-background border-border"
                        >
                          <option value="all">Todas las Sedes (Global)</option>
                          {selectedClienteForConfig.direcciones?.map((dir, i) => (
                            <option key={i} value={dir.direccion}>{dir.nombreSede || dir.direccion.substring(0, 20)}</option>
                          ))}
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Columna Izquierda: Protocolos y Notas */}
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                            <ClipboardCheck className="h-4 w-4 text-[#01ADFB]" /> Protocolo de Servicio Estándar
                          </h3>
                          <textarea
                            value={configForm.protocoloServicio}
                            onChange={(e) => setConfigForm(prev => ({ ...prev, protocoloServicio: e.target.value }))}
                            className="w-full h-40 rounded-[5px] border border-border bg-card p-4 text-[11px] font-medium text-foreground focus:ring-2 focus:ring-[#01ADFB]/20 focus:border-[#01ADFB] transition-all resize-none"
                            placeholder="Escribe aquí las instrucciones fijas para el técnico (EPP requerido, químicos permitidos, restricciones de acceso...)"
                          />
                          <p className="text-[9px] font-bold text-muted-foreground italic">* Este texto se usará como guía en las próximas órdenes de servicio.</p>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-600" /> Observaciones Administrativas
                          </h3>
                          <textarea
                            value={configForm.observacionesFijas}
                            onChange={(e) => setConfigForm(prev => ({ ...prev, observacionesFijas: e.target.value }))}
                            className="w-full h-32 rounded-[5px] border border-border bg-card p-4 text-[11px] font-medium text-foreground focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                            placeholder="Notas internas para el personal de oficina (condiciones de pago, horarios de atención, contactos de emergencia...)"
                          />
                        </div>
                      </div>

                      {/* Columna Derecha: Reglas y Agendamiento */}
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                            <Clock className="h-4 w-4 text-emerald-600" /> Parámetros de Agendamiento
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-[5px] bg-background border border-border shadow-sm">
                              <Label className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2 block">Duración Estimada</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={configForm.duracionEstimada}
                                  onChange={(e) => setConfigForm(prev => ({ ...prev, duracionEstimada: parseInt(e.target.value) || 0 }))}
                                  className="h-9 text-[11px] font-medium w-20 border-border bg-background"
                                />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Minutos</span>
                              </div>
                            </div>
                            <div className="p-4 rounded-[5px] bg-background border border-border shadow-sm">
                              <Label className="text-[9px] font-medium uppercase tracking-[0.08em] text-muted-foreground mb-2 block">Frecuencia Sugerida</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  value={configForm.frecuenciaSugerida}
                                  onChange={(e) => setConfigForm(prev => ({ ...prev, frecuenciaSugerida: parseInt(e.target.value) || 0 }))}
                                  className="h-9 text-[11px] font-medium w-20 border-border bg-background"
                                />
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">Días</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-purple-600" /> Reglas de Validación
                          </h3>
                          <div className="space-y-3 rounded-[5px] border border-border bg-card p-4">
                            <label className="flex items-center justify-between cursor-pointer group">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-medium text-foreground uppercase tracking-tight">Firma Digital Obligatoria</span>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">No permite finalizar sin firma del cliente</span>
                              </div>
                              <div
                                onClick={() => setConfigForm(prev => ({ ...prev, requiereFirmaDigital: !prev.requiereFirmaDigital }))}
                                className={cn(
                                  "h-6 w-11 rounded-full flex items-center px-1 transition-all",
                                  configForm.requiereFirmaDigital ? "bg-[#01ADFB]" : "bg-muted-foreground/30"
                                )}
                              >
                                <div className={cn(
                                  "h-4 w-4 rounded-full bg-white transition-all transform",
                                  configForm.requiereFirmaDigital ? "translate-x-5" : "translate-x-0"
                                )} />
                              </div>
                            </label>
                            <div className="h-px bg-border" />
                            <label className="flex items-center justify-between cursor-pointer group">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-medium text-foreground uppercase tracking-tight">Fotos de Evidencia</span>
                                <span className="text-[9px] font-bold text-muted-foreground uppercase">Exigir fotos de antes y después del servicio</span>
                              </div>
                              <div
                                onClick={() => setConfigForm(prev => ({ ...prev, requiereFotosEvidencia: !prev.requiereFotosEvidencia }))}
                                className={cn(
                                  "h-6 w-11 rounded-full flex items-center px-1 transition-all",
                                  configForm.requiereFotosEvidencia ? "bg-[#01ADFB]" : "bg-muted-foreground/30"
                                )}
                              >
                                <div className={cn(
                                  "h-4 w-4 rounded-full bg-white transition-all transform",
                                  configForm.requiereFotosEvidencia ? "translate-x-5" : "translate-x-0"
                                )} />
                              </div>
                            </label>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <h3 className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground flex items-center gap-2">
                            <Box className="h-4 w-4 text-blue-600" /> Activos / Elementos Predefinidos
                          </h3>
                          
                          {/* Formulario rápido para nuevo elemento */}
                          <div className="grid grid-cols-3 gap-2 bg-muted p-3 rounded-[5px] border border-border">
                            <div className="space-y-1">
                              <Label className="text-[8px] font-medium text-muted-foreground uppercase">Nombre / Tag</Label>
                              <Input 
                                placeholder="Eje: Estación 01" 
                                value={newElement.nombre}
                                onChange={(e) => setNewElement(prev => ({ ...prev, nombre: e.target.value }))}
                                className="h-8 text-[10px] border-border bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[8px] font-medium text-muted-foreground uppercase">Tipo</Label>
                              <Select 
                                value={newElement.tipo}
                                onChange={(e) => setNewElement(prev => ({ ...prev, tipo: e.target.value }))}
                                className="h-8 text-[10px] border-border bg-background"
                              >
                                <option value="Estación de Cebo">Estación de Cebo</option>
                                <option value="Trampa de Luz">Trampa de Luz</option>
                                <option value="Extintor">Extintor</option>
                                <option value="Unidad AC">Unidad AC</option>
                                <option value="Tablero Eléctrico">Tablero Eléctrico</option>
                                <option value="Otro">Otro</option>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[8px] font-medium text-muted-foreground uppercase">Acción</Label>
                              <Button 
                                size="sm" 
                                onClick={handleAddElement}
                                className="h-8 w-full bg-[#01ADFB] hover:bg-blue-600 text-white text-[9px] font-bold uppercase"
                              >
                                <Plus className="h-3 w-3 mr-1" /> Añadir
                              </Button>
                            </div>
                            <div className="col-span-3 space-y-1">
                              <Label className="text-[8px] font-medium text-muted-foreground uppercase">Ubicación / Notas</Label>
                              <Input 
                                placeholder="Eje: Pasillo de servicio, al lado de la puerta principal" 
                                value={newElement.ubicacion}
                                onChange={(e) => setNewElement(prev => ({ ...prev, ubicacion: e.target.value }))}
                                className="h-8 text-[10px] border-border bg-background"
                              />
                            </div>
                          </div>

                          {/* Lista de elementos agregados */}
                          <div className="space-y-2 mt-4">
                            {configForm.elementosPredefinidos.length === 0 ? (
                              <div className="border-2 border-dashed border-border rounded-[5px] p-4 text-center">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.08em]">No hay elementos configurados</p>
                                <p className="text-[9px] font-medium text-muted-foreground/60 mt-1 lowercase italic">Ej: Trampas de luz, Extintores, Aires acondicionados...</p>
                              </div>
                            ) : (
                              <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {configForm.elementosPredefinidos.map((el, i) => (
                                  <div key={i} className="flex items-center justify-between p-3 rounded-[4px] bg-background border border-border shadow-sm group">
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-[4px] bg-[#01ADFB]/10 flex items-center justify-center text-[#01ADFB] border border-[#01ADFB]/20">
                                        <Box className="h-4 w-4" />
                                      </div>
                                      <div>
                                        <p className="text-[11px] font-medium text-foreground leading-tight uppercase">{el.nombre}</p>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">
                                          {el.tipo} {el.ubicacion ? `| ${el.ubicacion}` : ""}
                                        </p>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => handleRemoveElement(i)}
                                      className="h-4 w-4 rounded-[4px] bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 border border-destructive/20"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Footer de Acciones */}
              <div className="shrink-0 px-5 py-4 border-t border-border bg-card flex items-center justify-end gap-4">
                <button
                  onClick={() => setSelectedClienteForConfig(null)}
                  disabled={configLoading}
                  className="px-4 h-8 rounded-[4px] text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={configLoading}
                  className="px-4 h-8 rounded-[4px] bg-[#01ADFB] text-[11px] font-medium uppercase tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL DE HISTORIAL DE SERVICIOS */}
      <Dialog 
        open={!!selectedClienteForHistory} 
        onOpenChange={(open) => !open && setSelectedClienteForHistory(null)}
      >
        <DialogContent className={cn("max-w-5xl", clientesDialogContentClass)}>
          <DialogHeader className="sr-only">
            <DialogTitle>Historial de Servicios</DialogTitle>
          </DialogHeader>
          {selectedClienteForHistory && (
            <div className="flex flex-col h-[85vh]">
              {/* Header con Info del Cliente */}
              <div className="shrink-0 px-5 py-4 border-b border-border bg-card flex items-center justify-between">
                <div className="flex items-center gap-5">
                  <div className="h-9 w-9 rounded-[5px] bg-[#01ADFB] flex items-center justify-center text-white shadow-sm shadow-[#01ADFB]/20">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-medium text-foreground tracking-tight uppercase">
                      Historial de Servicios
                    </h2>
                    <p className="text-[11px] font-bold text-muted-foreground mt-0.5 uppercase tracking-[0.08em]">
                      {selectedClienteForHistory.tipoCliente === "EMPRESA" ? selectedClienteForHistory.razonSocial : `${selectedClienteForHistory.nombre} ${selectedClienteForHistory.apellido}`}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-[10px] font-medium text-[#01ADFB] bg-[#01ADFB]/10 px-3 py-1 rounded-full uppercase">
                    {serviceHistory.length} Servicios Registrados
                  </span>
                </div>
              </div>

              {/* Lista de Servicios */}
              <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
                {historyLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                    <Calendar className="h-8 w-8 text-muted-foreground/30 animate-bounce mb-4" />
                    <p className="text-[11px] text-muted-foreground">Consultando Expediente...</p>
                  </div>
                ) : serviceHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-8 w-8 rounded-full bg-card flex items-center justify-center mb-4 border border-border">
                      <Search className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                    <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.08em]">Sin servicios Previos</h3>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">Este cliente aún no registra órdenes de servicio en el sistema.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {serviceHistory.map((orden: OrdenServicio) => (
                      <div key={orden.id} className="p-4 rounded-[5px] bg-card border border-border hover:border-[#01ADFB] transition-all group shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-5">
                            <div className="h-9 w-9 rounded-[5px] bg-card flex items-center justify-center text-muted-foreground group-hover:text-[#01ADFB] transition-colors border border-border">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-[11px] font-medium text-foreground uppercase tracking-tight">#{orden.numeroOrden || 'S/N'}</span>
                                <span className={cn(
                                  "text-[9px] font-medium px-2 py-0.5 rounded-md uppercase border border-border shadow-sm",
                                  ESTADO_STYLING[orden.estadoServicio] || ESTADO_STYLING["DEFAULT"]
                                )}>
                                  {orden.estadoServicio}
                                </span>
                              </div>
                              <h4 className="text-[12px] font-bold text-foreground">{orden.servicio?.nombre || 'Servicio General'}</h4>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase">
                                  <Calendar className="h-3 w-3" />
                                  {orden.fechaVisita ? formatBogotaDate(orden.fechaVisita) : 'Pendiente'}
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase">
                                  <MapPin className="h-3 w-3" />
                                  {orden.direccionTexto?.substring(0, 30) || 'Sede Principal'}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-10">
                            <div className="hidden md:flex flex-col items-end">
                              <p className="text-[10px] text-muted-foreground">Técnico Asignado</p>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="h-4 w-4 rounded-full bg-[#01ADFB]/10 flex items-center justify-center text-[10px] font-bold text-[#01ADFB]">
                                  {orden.tecnico?.user?.nombre?.charAt(0) || 'T'}
                                </div>
                                <span className="text-[11px] font-bold text-foreground">
                                  {orden.tecnico?.user?.nombre} {orden.tecnico?.user?.apellido}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <p className="text-[10px] text-muted-foreground">Valor</p>
                              <p className="text-[12px] font-medium text-foreground mt-1">${Number(orden.valorCotizado || 0).toLocaleString()}</p>
                            </div>
                            <button className="h-8 w-8 rounded-[4px] border border-border flex items-center justify-center hover:bg-[#01ADFB] hover:text-white transition-all text-muted-foreground">
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={cn(clientesDialogFooterClass, "shrink-0 flex items-center justify-end")}>
                <button 
                  onClick={() => setSelectedClienteForHistory(null)}
                  className={cn("px-4 bg-[#01ADFB] text-white hover:bg-[#0197dc]", clientesDialogButtonClass)}
                >
                  Cerrar Historial
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isPresetModalOpen} onOpenChange={setIsPresetModalOpen}>
        <DialogContent className={cn("max-w-md", clientesDialogContentClass)}>
          <DialogHeader className={clientesDialogHeaderClass}>
            <DialogTitle className={clientesDialogTitleClass}>
              {editingPresetId ? "Editar Preset" : "Nuevo Preset"}
            </DialogTitle>
            <DialogDescription className={clientesDialogDescriptionClass}>
              Guarda los filtros actuales de clientes con nombre, color y visibilidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Nombre</Label>
              <Input
                value={presetForm.name}
                onChange={(e) => setPresetForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ej: Riesgo + pagos pendientes"
                className={clientesDialogInputClass}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Color</Label>
              <div className="flex flex-wrap gap-2">
                {CUSTOM_PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setPresetForm((prev) => ({ ...prev, colorToken: color }))}
                    className={cn(
                      "h-8 px-2 rounded-md border text-[9px] font-medium uppercase",
                      PRESET_COLOR_STYLES[color],
                      presetForm.colorToken === color && "ring-2 ring-[#01ADFB]",
                    )}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Visibilidad</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPresetForm((prev) => ({ ...prev, isShared: false }))}
                  className={cn(
                    "h-9 rounded-[4px] border text-[10px] font-medium uppercase",
                    !presetForm.isShared ? "bg-[#01ADFB] text-white border-[#01ADFB]" : "bg-background border-border text-muted-foreground",
                  )}
                >
                  Privado
                </button>
                <button
                  type="button"
                  onClick={() => setPresetForm((prev) => ({ ...prev, isShared: true }))}
                  className={cn(
                    "h-9 rounded-[4px] border text-[10px] font-medium uppercase",
                    presetForm.isShared ? "bg-[#01ADFB] text-white border-[#01ADFB]" : "bg-background border-border text-muted-foreground",
                  )}
                >
                  Compartido
                </button>
              </div>
            </div>

            <div className={cn(clientesDialogFooterClass, "-mx-5 -mb-4 mt-2 flex gap-2")}>
              <Button variant="outline" className={cn("flex-1", clientesDialogButtonClass)} onClick={() => setIsPresetModalOpen(false)}>
                Cancelar
              </Button>
              <Button className={cn("flex-1 bg-[#01ADFB] text-white hover:bg-[#0197dc]", clientesDialogButtonClass)} onClick={savePreset}>
                Guardar Preset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN - PERSONALIZADO */}
      <Dialog
        open={!!clienteToDelete}
        onOpenChange={(open) => !open && setClienteToDelete(null)}
      >
        <DialogContent className={cn("max-w-md", clientesDialogContentClass)}>
          <DialogHeader className="sr-only">
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          {clienteToDelete && (
            <div className="flex flex-col">
              <div className="flex flex-col items-center px-5 py-5 text-center">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[5px] border border-destructive/20 bg-destructive/10 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                </div>
                
                <h3 className={clientesDialogTitleClass}>
                  ¿Eliminar este cliente?
                </h3>
                
                <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">
                  Estás a punto de eliminar a <span className="font-medium text-foreground">
                    {clienteToDelete.tipoCliente === "EMPRESA" ? clienteToDelete.razonSocial : `${clienteToDelete.nombre} ${clienteToDelete.apellido}`}
                  </span>. Esta acción no se puede deshacer y afectará el historial operativo vinculado.
                </p>
              </div>

              <div className={cn(clientesDialogFooterClass, "flex justify-end gap-2")}>
                <button
                  onClick={() => setClienteToDelete(null)}
                  className={cn("flex-1 border border-border bg-background text-muted-foreground hover:bg-muted", clientesDialogButtonClass)}
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className={cn("flex-1 bg-destructive text-destructive-foreground hover:opacity-90", clientesDialogButtonClass)}
                >
                  Eliminar Ahora
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* MODAL DE SUGERENCIAS ESTRATÉGICAS */}
      <Dialog
        open={!!selectedClienteForSuggestions}
        onOpenChange={(open) => !open && setSelectedClienteForSuggestions(null)}
      >
        <DialogContent className={cn("max-w-2xl", clientesDialogContentClass)}>
          <DialogHeader className="sr-only">
            <DialogTitle>Acciones Sugeridas</DialogTitle>
          </DialogHeader>
          {selectedClienteForSuggestions && (
            <div className="flex flex-col">
              {/* Header Contextual */}
              <div className="shrink-0 px-5 py-4 border-b border-border bg-card flex items-center gap-5">
                <div className="h-9 w-9 rounded-[5px] bg-[#01ADFB] flex items-center justify-center text-white shadow-sm shadow-[#01ADFB]/20">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-[15px] font-medium text-foreground tracking-tight uppercase">
                    Acciones Sugeridas
                  </h2>
                  <p className="text-[11px] font-bold text-muted-foreground mt-0.5 uppercase tracking-[0.08em]">
                    Sugerencias para {selectedClienteForSuggestions.tipoCliente === "EMPRESA" ? selectedClienteForSuggestions.razonSocial : `${selectedClienteForSuggestions.nombre} ${selectedClienteForSuggestions.apellido}`}
                  </p>
                </div>
              </div>

              {/* Lista de Sugerencias */}
              <div className={cn(clientesDialogBodyClass, "max-h-[60vh] space-y-3 overflow-y-auto custom-scrollbar")}>
                {suggestions.length === 0 ? (
                  <div className="py-10 text-center flex flex-col items-center">
                    <ShieldCheck className="h-9 w-9 text-emerald-500 mb-4 opacity-20" />
                    <p className="text-[12px] font-medium text-muted-foreground uppercase tracking-[0.08em]">Operación al día</p>
                    <p className="text-[11px] text-muted-foreground mt-1">No hay acciones urgentes pendientes para este cliente.</p>
                  </div>
                ) : (
                  suggestions.map((sug) => (
                    <div key={sug.id} className="rounded-[5px] border border-border bg-card p-4 hover:border-[#01ADFB] transition-all group flex items-start gap-4 shadow-sm">
                      <div className={cn("h-9 w-9 shrink-0 rounded-[5px] flex items-center justify-center", sug.color)}>
                        <sug.icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-[12px] font-medium text-foreground uppercase tracking-tight mb-1">{sug.title}</h4>
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">{sug.description}</p>
                        <Button
                          onClick={sug.action}
                          className={cn("bg-foreground px-3 text-background hover:opacity-90", clientesDialogButtonClass)}
                        >
                          {sug.actionLabel}
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className={cn(clientesDialogFooterClass, "flex justify-end")}>
                <button
                  onClick={() => setSelectedClienteForSuggestions(null)}
                  className={cn("px-4 text-muted-foreground hover:bg-muted", clientesDialogButtonClass)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PANEL LATERAL: COLA DE TAREAS SUGERIDAS (HOY) */}
      {showSuggestionsQueue && (
        <button
          type="button"
          aria-label="Cerrar panel de cola operativa pendiente"
          onClick={() => setShowSuggestionsQueue(false)}
          className="fixed inset-0 z-[90] bg-black/20 backdrop-blur-[1px] cursor-default"
        />
      )}
      <div className={cn(
        "fixed inset-y-0 right-0 w-full sm:w-[450px] bg-background border-l border-border shadow-2xl z-[100] transition-transform duration-500 ease-in-out transform flex flex-col",
        showSuggestionsQueue ? "translate-x-0" : "translate-x-full"
      )} role="dialog" aria-modal="true" aria-label="Cola operativa pendiente">
        {/* Header del Panel */}
        <div className="shrink-0 p-8 border-b border-border bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Cola Operativa Pendiente</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Tareas abiertas priorizadas</p>
            </div>
          </div>
          <button
            onClick={() => setShowSuggestionsQueue(false)}
            className="h-10 w-10 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground transition-all"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Stats del Panel */}
        {localSugerenciasStats && (
          <div className="p-6 grid grid-cols-3 gap-3 border-b border-border bg-muted/10">
            <div className="p-3 rounded-2xl bg-background border border-border text-center">
              <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Aceptación</p>
              <p className="text-sm font-black text-[#01ADFB]">{localSugerenciasStats.tasaAceptacion}%</p>
            </div>
            <div className="p-3 rounded-2xl bg-background border border-border text-center">
              <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">T. Ejecución</p>
              <p className="text-sm font-black text-amber-600">{Math.round(localSugerenciasStats.tiempoPromedioEjecucionMin)}m</p>
            </div>
            <div className="p-3 rounded-2xl bg-background border border-border text-center">
              <p className="text-[8px] font-black text-muted-foreground uppercase mb-1">Pendientes</p>
              <p className="text-sm font-black text-red-600">{localSugerenciasStats.pendientesPorPrioridad.CRITICA + localSugerenciasStats.pendientesPorPrioridad.ALTA}</p>
            </div>
          </div>
        )}

        {/* Lista de Tareas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {sugerenciasLoading && !didLoadSugerenciasRef.current ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="p-5 rounded-3xl bg-card border border-border shadow-sm animate-pulse">
                  <div className="h-4 w-24 rounded bg-muted mb-4" />
                  <div className="h-5 w-4/5 rounded bg-muted mb-2" />
                  <div className="h-4 w-full rounded bg-muted mb-2" />
                  <div className="h-4 w-3/4 rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : sugerenciasError ? (
            <div className="rounded-3xl border border-destructive/20 bg-destructive/10 p-5 text-center">
              <p className="text-sm font-black uppercase tracking-widest text-destructive">No se pudo cargar la cola</p>
              <p className="text-xs mt-1 text-muted-foreground">{sugerenciasError}</p>
              <Button
                variant="outline"
                className="mt-4 h-10 rounded-xl border-border text-xs font-black uppercase tracking-widest"
                onClick={() => void loadSugerenciasPage(1, "replace")}
              >
                Reintentar
              </Button>
            </div>
          ) : pendingSugerencias.length === 0 ? (
            <div className="space-y-6">
              <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
                <ClipboardCheck className="mx-auto h-12 w-12 text-emerald-500 mb-3" />
                <p className="text-sm font-black uppercase tracking-widest text-emerald-700">Operación al día</p>
                <p className="text-xs mt-1 text-muted-foreground">No hay pendientes activos en la cola operativa.</p>
                {localSugerenciasStats && (
                  <p className="text-[10px] mt-2 font-bold uppercase tracking-widest text-muted-foreground">
                    Creadas hoy: <span className="text-foreground">{localSugerenciasStats.totalHoy}</span>
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                  Últimas sugerencias gestionadas
                </h4>
                {recentManagedSugerencias.length === 0 ? (
                  <div className="rounded-2xl border border-border bg-card p-4 text-center">
                    <p className="text-xs text-muted-foreground">Aún no hay histórico de sugerencias procesadas.</p>
                  </div>
                ) : (
                  recentManagedSugerencias.map((sug) => (
                    <div key={sug.id} className="p-4 rounded-2xl bg-card border border-border shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <span className={cn(
                          "text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest",
                          sug.estado === "EJECUTADA" && "bg-emerald-100 text-emerald-700",
                          sug.estado === "ACEPTADA" && "bg-blue-100 text-blue-700",
                          sug.estado === "DESCARTADA" && "bg-slate-100 text-slate-700"
                        )}>
                          {sug.estado}
                        </span>
                        <span className="text-[9px] font-bold text-muted-foreground">
                          {formatBogotaDate(sug.creadoAt)}
                        </span>
                      </div>
                      <p className="text-xs font-black uppercase tracking-wider text-foreground leading-tight mb-1">{sug.titulo}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{sug.descripcion}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            pendingSugerencias.map((sug) => (
                <div key={sug.id} className="p-5 rounded-3xl bg-card border border-border shadow-sm hover:border-[#01ADFB] transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest",
                      sug.prioridad === "CRITICA" ? "bg-red-100 text-red-700" :
                      sug.prioridad === "ALTA" ? "bg-amber-100 text-amber-700" :
                      "bg-blue-100 text-blue-700"
                    )}>
                      {sug.prioridad}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground">
                      {formatBogotaTime(sug.creadoAt)}
                    </span>
                  </div>
                  
                  <h4 className="text-sm font-black text-foreground uppercase tracking-tight leading-tight mb-1">{sug.titulo}</h4>
                  <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{sug.descripcion}</p>
                  
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateSugerencia(sug.id, "ACEPTADA")}
                      className="flex-1 h-9 rounded-xl bg-[#01ADFB] text-[10px] font-black uppercase tracking-widest"
                    >
                      Aceptar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateSugerencia(sug.id, "DESCARTADA")}
                      className="h-9 rounded-xl border-border text-[10px] font-black uppercase tracking-widest"
                    >
                      Descartar
                    </Button>
                  </div>
                </div>
              ))
          )}

          {sugerenciasLoadingMore && (
            <div className="rounded-2xl border border-border bg-card p-4 text-center animate-pulse">
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Cargando más sugerencias...</p>
            </div>
          )}

          {sugerenciasPagination?.hasNextPage && !sugerenciasLoading && (
            <Button
              variant="outline"
              onClick={loadMoreSugerencias}
              className="w-full h-11 rounded-2xl border-border bg-background text-[10px] font-black uppercase tracking-widest"
            >
              Cargar más sugerencias
            </Button>
          )}
        </div>

        {/* Footer del Panel */}
        <div className="shrink-0 p-8 border-t border-border bg-muted/30">
          <Button
            onClick={() => setShowSuggestionsQueue(false)}
            className="w-full h-12 rounded-xl bg-foreground text-background text-xs font-black uppercase tracking-[0.2em]"
          >
            Volver a la Cartera
          </Button>
        </div>
      </div>
    </div>
  );
}
