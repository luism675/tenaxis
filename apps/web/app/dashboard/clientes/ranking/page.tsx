"use client";

import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowUpDown,
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Contact,
  RotateCcw,
  Search,
  ShieldAlert,
  Star,
  Trophy,
  Wallet,
  XCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/components/ui/utils";
import {
  clientesClient,
  type ClienteRankingItem,
  type ClientesRankingKpisQuery,
  type ClientesRankingKpisResponse,
  type ClientesRankingQuery,
  type ClientesRankingResponse,
} from "@/lib/api/clientes-client";
import { useUserRole } from "@/hooks/use-user-role";

type RankingSort = NonNullable<ClientesRankingQuery["sort"]>;
type RankingClassification = NonNullable<
  ClienteRankingItem["clasificacionSugerida"]
>;

const PAGE_SIZE = 25;

const currencyFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("es-CO");

const classificationStyles: Record<RankingClassification, string> = {
  ORO: "border-amber-200 bg-amber-100 text-amber-800",
  PLATA: "border-slate-200 bg-slate-100 text-slate-600",
  BRONCE: "border-orange-200 bg-orange-100 text-orange-800",
  RIESGO: "border-red-200 bg-red-50 text-red-700",
};

function formatCurrency(value: number) {
  return currencyFormatter.format(value || 0);
}

function formatPercent(value: number) {
  return `${numberFormatter.format(value || 0)}%`;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin visitas";

  return new Intl.DateTimeFormat("es-CO", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
}

function getSortDirection(
  currentSort: RankingSort,
  sort: RankingSort,
  currentDir: "asc" | "desc",
) {
  if (currentSort !== sort) return "desc";
  return currentDir === "desc" ? "asc" : "desc";
}

function getPercentPillClass(value: number, dangerAt: number, warnAt: number) {
  if (value >= dangerAt) return "bg-red-50 text-red-700 border-red-100";
  if (value >= warnAt) return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-muted text-muted-foreground border-border";
}

function getClassificationIcon(classification: RankingClassification) {
  if (classification === "RIESGO") return AlertTriangle;
  if (classification === "ORO") return Star;
  return Award;
}

export default function ClientesRankingPage() {
  const router = useRouter();
  const { checkPermission, isLoading: isLoadingRole, role } = useUserRole();
  const [data, setData] = useState<ClientesRankingResponse | null>(null);
  const [kpisData, setKpisData] =
    useState<ClientesRankingKpisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingKpis, setIsLoadingKpis] = useState(false);
  const [isApplyingRanges, setIsApplyingRanges] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kpisError, setKpisError] = useState<string | null>(null);
  const [rangesMessage, setRangesMessage] = useState<string | null>(null);
  const [rangesError, setRangesError] = useState<string | null>(null);
  const [showIndicators, setShowIndicators] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<RankingSort>("ranking");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    if (!isLoadingRole && !checkPermission("CLIENT_VIEW")) {
      router.replace("/dashboard");
    }
  }, [checkPermission, isLoadingRole, router]);

  const query = useMemo<ClientesRankingQuery>(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: deferredSearch,
      sort,
      dir,
      from,
      to,
    }),
    [deferredSearch, dir, from, page, sort, to],
  );

  const kpisQuery = useMemo<ClientesRankingKpisQuery>(
    () => ({
      search: deferredSearch,
      from,
      to,
    }),
    [deferredSearch, from, to],
  );

  const loadRanking = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await clientesClient.getRanking(query);
      setData(response);
      if (response.pagination.page !== page) {
        setPage(response.pagination.page);
      }
    } catch (loadError) {
      console.error("Error loading clientes ranking:", loadError);
      setError("No se pudo cargar el ranking de clientes.");
    } finally {
      setIsLoading(false);
    }
  }, [page, query]);

  const loadKpis = useCallback(
    async (refresh = false) => {
      try {
        setIsLoadingKpis(true);
        setKpisError(null);
        const response = await clientesClient.getRankingKpis({
          ...kpisQuery,
          refresh,
        });
        setKpisData(response);
      } catch (loadError) {
        console.error("Error loading clientes ranking indicators:", loadError);
        setKpisError("No se pudieron cargar los indicadores.");
      } finally {
        setIsLoadingKpis(false);
      }
    },
    [kpisQuery],
  );

  const applyRecommendedRanges = useCallback(async () => {
    const confirmed = window.confirm(
      "Se actualizará la clasificación de los clientes según el ranking actual. ¿Continuamos?",
    );

    if (!confirmed) return;

    try {
      setIsApplyingRanges(true);
      setRangesMessage(null);
      setRangesError(null);

      const response = await clientesClient.applyRankingClassifications(kpisQuery);

      const followUpMessage =
        response.tareasRetencionCreadas > 0
          ? ` Se prepararon ${numberFormatter.format(response.tareasRetencionCreadas)} seguimientos prioritarios.`
          : "";

      setRangesMessage(
        response.actualizados > 0
          ? `Se actualizaron ${numberFormatter.format(response.actualizados)} clientes.${followUpMessage}`
          : "Los clientes ya tenían el rango correcto.",
      );

      await loadRanking();

      if (showIndicators) {
        await loadKpis(true);
      }
    } catch (applyError) {
      console.error("Error applying clientes ranking classifications:", applyError);
      setRangesError("No se pudieron actualizar los rangos.");
    } finally {
      setIsApplyingRanges(false);
    }
  }, [kpisQuery, loadKpis, loadRanking, showIndicators]);

  useEffect(() => {
    if (isLoadingRole || !checkPermission("CLIENT_VIEW")) return;

    void loadRanking();
  }, [checkPermission, isLoadingRole, loadRanking]);

  useEffect(() => {
    setKpisData(null);
    setKpisError(null);
    setRangesMessage(null);
    setRangesError(null);
  }, [deferredSearch, from, to]);

  useEffect(() => {
    if (isLoadingRole || !checkPermission("CLIENT_VIEW") || !showIndicators) {
      return;
    }

    void loadKpis();
  }, [checkPermission, isLoadingRole, loadKpis, showIndicators]);

  const handleSort = (nextSort: RankingSort) => {
    setDir((currentDir) => getSortDirection(sort, nextSort, currentDir));
    setSort(nextSort);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setFrom("");
    setTo("");
    setPage(1);
    setSort("ranking");
    setDir("desc");
  };

  const activeFilters = Boolean(
    search || from || to || sort !== "ranking" || dir !== "desc",
  );
  const canApplyRanges =
    role === "SU_ADMIN" || role === "ADMIN" || role === "COORDINADOR";
  const overview = kpisData?.overview;
  const rows = data?.items ?? [];
  const pagination = data?.pagination;
  const maxScore = Math.max(...rows.map((row) => row.scoreComercial), 1);

  if (isLoadingRole) {
    return (
      <DashboardLayout overflowHidden>
        <div className="flex h-full items-center justify-center bg-background">
          <p className="animate-pulse text-xs font-medium text-muted-foreground">
            Preparando ranking...
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout overflowHidden>
      <div className="flex h-full flex-col bg-background px-3 py-3 sm:px-4 lg:px-5">
        <h2 className="sr-only">
          Ranking de clientes por valor, continuidad y cumplimiento operativo
        </h2>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[8px] border border-border bg-card shadow-sm">
          <header className="flex shrink-0 flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border border-border bg-muted text-muted-foreground">
                <Trophy className="h-4 w-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-medium tracking-tight text-foreground">
                  Ranking de clientes
                </h1>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  Clasificación por valor, continuidad y cumplimiento operativo
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-1.5">
              <Button
                variant={showIndicators ? "default" : "outline"}
                size="sm"
                onClick={() => setShowIndicators((value) => !value)}
                className="h-7 rounded-[6px] px-3 text-[11px] font-medium"
              >
                <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                {showIndicators ? "Ocultar indicadores" : "Ver indicadores"}
              </Button>
              {canApplyRanges ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void applyRecommendedRanges()}
                  disabled={isApplyingRanges || isLoading}
                  className="h-7 rounded-[6px] px-3 text-[11px] font-medium"
                >
                  <Award
                    className={cn(
                      "h-3.5 w-3.5",
                      isApplyingRanges && "animate-pulse",
                    )}
                    aria-hidden="true"
                  />
                  Aplicar rangos
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadRanking()}
                disabled={isLoading}
                className="h-7 rounded-[6px] px-3 text-[11px] font-medium"
              >
                <RotateCcw
                  className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
                  aria-hidden="true"
                />
                Actualizar
              </Button>
              <Link href="/dashboard/clientes">
                <span className="inline-flex h-7 items-center justify-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Contact className="h-3.5 w-3.5" aria-hidden="true" />
                  Cartera
                </span>
              </Link>
            </div>
          </header>

          {rangesMessage ? (
            <p className="mx-6 mt-3 shrink-0 rounded-[6px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
              {rangesMessage}
            </p>
          ) : null}
          {rangesError ? (
            <p className="mx-6 mt-3 shrink-0 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
              {rangesError}
            </p>
          ) : null}

          {showIndicators ? (
            <div className="shrink-0 border-b border-border px-4 py-3 lg:px-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground">
                    Indicadores del ranking
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    Lectura comercial de los clientes en la vista actual.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadKpis(true)}
                  disabled={isLoadingKpis}
                  className="h-7 rounded-[6px] px-3 text-[11px] font-medium"
                >
                  <RotateCcw
                    className={cn(
                      "h-3.5 w-3.5",
                      isLoadingKpis && "animate-spin",
                    )}
                    aria-hidden="true"
                  />
                  Actualizar
                </Button>
              </div>

              <div className="grid min-w-max grid-flow-col auto-cols-[minmax(150px,1fr)] gap-2 overflow-x-auto pb-1 lg:min-w-0 lg:grid-flow-row lg:grid-cols-6">
                {[
                  {
                    label: "Clientes evaluados",
                    value: overview
                      ? numberFormatter.format(overview.totalClientes)
                      : "—",
                    icon: Contact,
                  },
                  {
                    label: "Monto pagado",
                    value: overview ? formatCurrency(overview.totalPagado) : "—",
                    icon: Wallet,
                  },
                  {
                    label: "Ticket promedio",
                    value: overview ? formatCurrency(overview.promedioTicket) : "—",
                    icon: BarChart3,
                  },
                  {
                    label: "Servicios",
                    value: overview
                      ? numberFormatter.format(overview.totalServicios)
                      : "—",
                    icon: Trophy,
                  },
                  {
                    label: "Cancelación",
                    value: overview
                      ? formatPercent(overview.porcentajeCancelacion)
                      : "—",
                    icon: XCircle,
                  },
                  {
                    label: "Clientes en riesgo",
                    value: overview
                      ? numberFormatter.format(overview.clientesEnRiesgo)
                      : "—",
                    icon: ShieldAlert,
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex min-h-[68px] items-center gap-2 rounded-[6px] border border-border bg-muted/30 p-3"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[6px] border border-border bg-card text-muted-foreground">
                      <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] text-muted-foreground">
                        {item.label}
                      </p>
                      <p
                        className={cn(
                          "truncate text-[15px] font-medium leading-tight text-foreground",
                          isLoadingKpis && "animate-pulse",
                        )}
                      >
                        {item.value}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {kpisError ? (
                <p className="mt-3 rounded-[6px] border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium text-red-700">
                  {kpisError}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:px-6">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Buscar cliente, documento o teléfono..."
                className="h-8 rounded-[6px] border-border bg-muted pl-9 text-[11px] font-normal shadow-none placeholder:text-muted-foreground"
              />
            </div>
            <Input
              type="date"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
              className="h-8 rounded-[6px] border-border bg-card text-[11px] text-muted-foreground shadow-none lg:w-36"
            />
            <Input
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
              className="h-8 rounded-[6px] border-border bg-card text-[11px] text-muted-foreground shadow-none lg:w-36"
            />
            {activeFilters ? (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border border-border bg-card px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Borrar filtros
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
            <table className="w-full min-w-[1180px] table-fixed border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-muted">
                <tr className="border-b border-border">
                  <th className="w-[62px] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    <SortButton onClick={() => handleSort("ranking")}>
                      Rank
                    </SortButton>
                  </th>
                  <th className="w-[92px] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    Puntaje
                  </th>
                  <th className="w-[22%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    <SortButton onClick={() => handleSort("cliente")}>
                      Cliente
                    </SortButton>
                  </th>
                  <th className="w-[11%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    <SortButton onClick={() => handleSort("totalPagado")}>
                      Monto pagado
                    </SortButton>
                  </th>
                  <th className="w-[10%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    <SortButton onClick={() => handleSort("ticketPromedio")}>
                      Ticket
                    </SortButton>
                  </th>
                  <th className="w-[9%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    <SortButton onClick={() => handleSort("liquidados")}>
                      Tomados
                    </SortButton>
                  </th>
                  <th className="w-[9%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    <SortButton onClick={() => handleSort("cancelacion")}>
                      Cancelación
                    </SortButton>
                  </th>
                  <th className="w-[9%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    <SortButton onClick={() => handleSort("noTomados")}>
                      No tomados
                    </SortButton>
                  </th>
                  <th className="w-[10%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    Clasificación
                  </th>
                  <th className="w-[11%] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.07em] text-muted-foreground">
                    Última visita
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {rows.map((row) => {
                  const classification = row.clasificacionSugerida;
                  const ClassificationIcon = getClassificationIcon(classification);
                  const scorePercent = Math.max(
                    4,
                    Math.round((row.scoreComercial / maxScore) * 100),
                  );

                  return (
                    <tr
                      key={row.clienteId}
                      className="transition-colors hover:bg-muted/60"
                    >
                      <td className="px-3 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex h-5 min-w-7 items-center justify-center rounded-[4px] border px-1.5 text-[10px] font-medium",
                            row.rank <= 3
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          #{row.rank}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium tabular-nums text-foreground">
                            {numberFormatter.format(row.scoreComercial)}{" "}
                            <span className="text-[9px] text-muted-foreground">
                              pts
                            </span>
                          </div>
                          <div className="mt-1 h-[3px] w-9 rounded-full bg-border">
                            <div
                              className="h-[3px] rounded-full bg-[#5B7CFA]"
                              style={{ width: `${scorePercent}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/clientes/${row.clienteId}/editar`}
                            className="block truncate text-[12px] font-medium text-foreground transition-colors hover:text-[#5B7CFA]"
                          >
                            {row.cliente}
                          </Link>
                          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                            {row.empresa?.nombre || "Sin empresa"} · {row.telefono}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3 align-middle text-[12px] font-medium tabular-nums text-foreground">
                        {formatCurrency(row.totalPagado)}
                      </td>
                      <td className="px-3 py-3 align-middle text-[11px] tabular-nums text-muted-foreground">
                        {formatCurrency(row.ticketPromedio)}
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <p className="text-[12px] font-medium tabular-nums text-foreground">
                          {numberFormatter.format(row.liquidados)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          de {numberFormatter.format(row.totalServicios)}
                        </p>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-[4px] border px-2 py-0.5 text-[10px] font-medium tabular-nums",
                            getPercentPillClass(row.porcentajeCancelacion, 35, 20),
                          )}
                        >
                          {formatPercent(row.porcentajeCancelacion)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex rounded-[4px] border px-2 py-0.5 text-[10px] font-medium tabular-nums",
                            getPercentPillClass(row.porcentajeNoToma, 30, 15),
                          )}
                        >
                          {formatPercent(row.porcentajeNoToma)}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[10px] font-medium",
                            classificationStyles[classification],
                          )}
                        >
                          <ClassificationIcon
                            className="h-2.5 w-2.5"
                            aria-hidden="true"
                          />
                          {classification}
                        </span>
                      </td>
                      <td className="px-3 py-3 align-middle text-[11px] text-muted-foreground">
                        {formatDate(row.ultimaVisita)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!isLoading && rows.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="mb-4 h-10 w-10 text-muted-foreground/40" />
                <h2 className="text-base font-medium text-foreground">
                  Sin resultados
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  No se encontraron clientes para el ranking actual.
                </p>
              </div>
            ) : null}

            {isLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <Search className="mb-4 h-10 w-10 animate-pulse text-muted-foreground/40" />
                <p className="text-xs font-medium text-muted-foreground">
                  Preparando ranking...
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
                <AlertCircle className="mb-4 h-10 w-10 text-red-500/60" />
                <h2 className="text-base font-medium text-foreground">
                  No se pudo cargar
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <Button
                  className="mt-4 h-8 rounded-[6px] px-3 text-[11px] font-medium"
                  onClick={() => void loadRanking()}
                >
                  Reintentar
                </Button>
              </div>
            ) : null}
          </div>

          <footer className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground lg:px-6">
            <span>
              Mostrando{" "}
              {pagination?.total ? (pagination.page - 1) * pagination.limit + 1 : 0}
              –
              {pagination
                ? Math.min(pagination.page * pagination.limit, pagination.total)
                : 0}{" "}
              de {numberFormatter.format(pagination?.total ?? 0)}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Página anterior"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={!pagination?.hasPrevPage || isLoading}
                className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="px-2 text-[11px] font-medium text-foreground">
                {pagination?.page ?? 1} / {pagination?.totalPages ?? 1}
              </span>
              <button
                type="button"
                aria-label="Página siguiente"
                onClick={() => setPage((current) => current + 1)}
                disabled={!pagination?.hasNextPage || isLoading}
                className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </DashboardLayout>
  );
}

function SortButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 whitespace-nowrap transition-colors hover:text-foreground"
    >
      {children}
      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}
