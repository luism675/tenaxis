"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Clock3,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { DashboardLayout } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Map as MapView,
  MapControls,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  type MapRef,
  type MapViewport,
} from "@/components/ui/map";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/utils";
import { useUserRole } from "@/hooks/use-user-role";
import {
  getScopedRole,
  resolveAvailableEmpresaIds,
  type ScopeAwareUser,
} from "@/lib/access-scope";
import { authClient } from "@/lib/api/auth-client";
import {
  enterpriseClient,
  type Enterprise,
} from "@/lib/api/enterprise-client";
import {
  operatorLocationsClient,
  type OperatorLastLocationDto,
} from "@/lib/api/operator-locations-client";
import {
  getBrowserAccessScope,
  getBrowserScopedEnterpriseId,
} from "@/lib/browser-access-scope";
import { getBrowserCookie } from "@/lib/api/browser-client";
import { formatBogotaDateTime } from "@/utils/date-utils";

type OperatorWithCoordinates = OperatorLastLocationDto & {
  lastLocation: NonNullable<OperatorLastLocationDto["lastLocation"]>;
};

type EmpresaFilterOption = Pick<Enterprise, "id" | "nombre">;

const BOGOTA_CENTER: [number, number] = [-74.0721, 4.711];

const ROLE_LABELS: Record<string, string> = {
  OPERADOR: "Operador",
  ASESOR: "Asesor",
  COORDINADOR: "Coordinador",
  ADMIN: "Admin",
  SU_ADMIN: "SU Admin",
};

function hasValidCoordinates(
  operator: OperatorLastLocationDto,
): operator is OperatorWithCoordinates {
  const lat = operator.lastLocation?.latitud;
  const lng = operator.lastLocation?.longitud;

  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function getOperatorLocationKey(
  operator: Pick<OperatorLastLocationDto, "operatorId" | "empresaId">,
) {
  return `${operator.operatorId}:${operator.empresaId}`;
}

function dedupeOperatorsByScope(rows: OperatorLastLocationDto[]) {
  const byOperatorEmpresa = new Map<string, OperatorLastLocationDto>();

  for (const row of rows) {
    const key = getOperatorLocationKey(row);
    const current = byOperatorEmpresa.get(key);

    if (
      !current ||
      (!hasValidCoordinates(current) && hasValidCoordinates(row))
    ) {
      byOperatorEmpresa.set(key, row);
    }
  }

  return Array.from(byOperatorEmpresa.values());
}

function formatRole(role?: string | null) {
  if (!role) return "Sin rol";
  return ROLE_LABELS[role] ?? role.replaceAll("_", " ");
}

function formatLastArrival(value?: string | null) {
  if (!value) return "Sin llegada registrada";

  try {
    return formatBogotaDateTime(value, "es-CO");
  } catch {
    return value;
  }
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "OP";
}

function buildMapLink(operator: OperatorWithCoordinates) {
  const explicitLink = operator.lastLocation.linkMaps?.trim();

  if (explicitLink) {
    return explicitLink;
  }

  return `https://www.google.com/maps?q=${operator.lastLocation.latitud},${operator.lastLocation.longitud}`;
}

function getViewportForOperators(
  operators: OperatorWithCoordinates[],
): Pick<MapViewport, "center" | "zoom" | "bearing" | "pitch"> {
  if (operators.length === 0) {
    return {
      center: BOGOTA_CENTER,
      zoom: 11,
      bearing: 0,
      pitch: 0,
    };
  }

  const average = operators.reduce(
    (acc, operator) => ({
      lat: acc.lat + operator.lastLocation.latitud,
      lng: acc.lng + operator.lastLocation.longitud,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    center: [average.lng / operators.length, average.lat / operators.length],
    zoom: operators.length === 1 ? 14 : 11,
    bearing: 0,
    pitch: 0,
  };
}

function LoadingRows() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="rounded-[4px] border border-border bg-card p-3 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-[4px]" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OperatorCard({
  operator,
  selected,
  onSelect,
}: {
  operator: OperatorLastLocationDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasCoordinates = hasValidCoordinates(operator);
  const location = operator.lastLocation;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group w-full rounded-[5px] border bg-card p-3 text-left shadow-sm transition-colors hover:border-[#01ADFB]/30 hover:bg-muted/40",
        selected
          ? "border-[#01ADFB]/40 bg-[#01ADFB]/5"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border text-[10px] font-semibold",
            hasCoordinates
              ? "border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[#01ADFB]"
              : "border-border bg-muted/40 text-muted-foreground",
          )}
        >
          {getInitials(operator.operatorName)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium leading-5 text-foreground">
                {operator.operatorName}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {formatRole(operator.operatorRole)}
              </p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 rounded px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em]",
                hasCoordinates
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
                  : "border-amber-500/20 bg-amber-500/10 text-amber-600",
              )}
            >
              {hasCoordinates ? "Ubicado" : "Sin GPS"}
            </Badge>
          </div>

          <div className="mt-3 space-y-1.5 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock3 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {formatLastArrival(location?.llegada)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                Orden {location?.numeroOrden || "sin número"}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="line-clamp-2">
                {location?.clienteNombre || "Cliente no registrado"}
                {location?.direccionTexto ? ` · ${location.direccionTexto}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

function OperatorPopup({ operator }: { operator: OperatorWithCoordinates }) {
  return (
    <div className="w-72 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-[#01ADFB]/20 bg-[#01ADFB]/10 text-[10px] font-semibold text-[#01ADFB]">
          {getInitials(operator.operatorName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-popover-foreground">
            {operator.operatorName}
          </p>
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {formatRole(operator.operatorRole)}
          </p>
        </div>
      </div>

      <div className="rounded-[5px] border border-border/60 bg-background/80 p-3 text-[11px] text-muted-foreground">
        <p className="font-medium text-foreground">
          Orden {operator.lastLocation.numeroOrden || "sin número"}
        </p>
        <p className="mt-1">
          {operator.lastLocation.clienteNombre || "Cliente no registrado"}
        </p>
        <p className="mt-1 line-clamp-2">
          {operator.lastLocation.direccionTexto || "Dirección no registrada"}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold text-muted-foreground">
          {formatLastArrival(operator.lastLocation.llegada)}
        </span>
        <a
          href={buildMapLink(operator)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-[4px] bg-[#01ADFB] px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 transition hover:bg-[#0199df]"
        >
          Abrir
          <ArrowUpRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}

function OperatorLocationsContent() {
  const router = useRouter();
  const { checkPermission, isLoading: isLoadingRole } = useUserRole();
  const mapRef = useRef<MapRef | null>(null);
  const [operators, setOperators] = useState<OperatorLastLocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedOperatorKey, setSelectedOperatorKey] = useState<string | null>(
    null,
  );
  const [empresaOptions, setEmpresaOptions] = useState<EmpresaFilterOption[]>(
    [],
  );
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<
    string | undefined
  >(undefined);
  const [canFilterByEmpresa, setCanFilterByEmpresa] = useState(false);
  const [empresaFilterReady, setEmpresaFilterReady] = useState(false);
  const [mapViewport, setMapViewport] = useState<
    Pick<MapViewport, "center" | "zoom" | "bearing" | "pitch">
  >(getViewportForOperators([]));

  useEffect(() => {
    if (!isLoadingRole && !checkPermission("TEAM_VIEW")) {
      router.replace("/dashboard");
    }
  }, [checkPermission, isLoadingRole, router]);

  useEffect(() => {
    let isMounted = true;

    async function loadEmpresaFilter() {
      try {
        const [profile, empresas] = await Promise.all([
          authClient.getProfile(),
          enterpriseClient.getAll(),
        ]);

        if (!isMounted) return;

        const scopedRole = getScopedRole(profile.role);
        const allowedEmpresaIds = resolveAvailableEmpresaIds(
          profile as ScopeAwareUser | null,
        );
        const scopedEmpresas =
          allowedEmpresaIds.length > 0
            ? empresas.filter((empresa) => allowedEmpresaIds.includes(empresa.id))
            : empresas;
        const canUseEmpresaFilter =
          (scopedRole === "ADMIN" || scopedRole === "SU_ADMIN") &&
          scopedEmpresas.length > 1;
        const storedEmpresaId =
          localStorage.getItem("current-enterprise-id") ||
          getBrowserCookie("x-enterprise-id") ||
          undefined;
        const initialEmpresaId = scopedEmpresas.some(
          (empresa) => empresa.id === storedEmpresaId,
        )
          ? storedEmpresaId
          : scopedEmpresas[0]?.id;

        setEmpresaOptions(scopedEmpresas);
        setCanFilterByEmpresa(canUseEmpresaFilter);
        setSelectedEmpresaId(canUseEmpresaFilter ? initialEmpresaId : undefined);
      } catch {
        if (!isMounted) return;
        setEmpresaOptions([]);
        setCanFilterByEmpresa(false);
        setSelectedEmpresaId(undefined);
      } finally {
        if (isMounted) {
          setEmpresaFilterReady(true);
        }
      }
    }

    void loadEmpresaFilter();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const scope = getBrowserAccessScope();
      const empresaId =
        getBrowserScopedEnterpriseId(scope) ?? selectedEmpresaId;
      const rows = await operatorLocationsClient.getLastLocations({
        empresaId,
      });
      const uniqueRows = dedupeOperatorsByScope(rows);
      const rowsWithCoordinates = uniqueRows.filter(hasValidCoordinates);

      setOperators(uniqueRows);
      setMapViewport(getViewportForOperators(rowsWithCoordinates));
      setSelectedOperatorKey((current) => {
        if (
          current &&
          uniqueRows.some((row) => getOperatorLocationKey(row) === current)
        ) {
          return current;
        }

        return rowsWithCoordinates[0]
          ? getOperatorLocationKey(rowsWithCoordinates[0])
          : null;
      });
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudieron cargar las ubicaciones.";

      setError(message);
      toast.error("No se pudieron cargar las ubicaciones de operadores.");
    } finally {
      setLoading(false);
    }
  }, [selectedEmpresaId]);

  useEffect(() => {
    if (!empresaFilterReady) return;
    void loadLocations();
  }, [empresaFilterReady, loadLocations]);

  useEffect(() => {
    if (!mapRef.current || loading || error) return;

    mapRef.current.easeTo({
      center: mapViewport.center,
      zoom: mapViewport.zoom,
      bearing: mapViewport.bearing,
      pitch: mapViewport.pitch,
      duration: 450,
      essential: true,
    });
  }, [error, loading, mapViewport]);

  const operatorsWithCoordinates = useMemo(
    () => operators.filter(hasValidCoordinates),
    [operators],
  );

  const operatorsWithoutCoordinates =
    operators.length - operatorsWithCoordinates.length;

  const filteredOperators = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return operators;

    return operators.filter((operator) => {
      const location = operator.lastLocation;
      return [
        operator.operatorName,
        operator.operatorRole,
        location?.numeroOrden,
        location?.clienteNombre,
        location?.direccionTexto,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [operators, search]);

  const selectedOperator = useMemo(
    () =>
      operators.find(
        (operator) => getOperatorLocationKey(operator) === selectedOperatorKey,
      ) ?? null,
    [operators, selectedOperatorKey],
  );

  const locatedPercentage = operators.length
    ? Math.round((operatorsWithCoordinates.length / operators.length) * 100)
    : 0;
  const selectedEmpresaLabel =
    empresaOptions.find((empresa) => empresa.id === selectedEmpresaId)?.nombre ??
    "Todas las empresas";

  return (
    <DashboardLayout overflowHidden>
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="shrink-0 border-b border-border bg-card px-4 py-4 sm:px-6 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px] border border-border bg-muted/40 text-muted-foreground">
                <LocateFixed className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Badge className="rounded border border-[#01ADFB]/20 bg-[#01ADFB]/10 px-2 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-[#01ADFB] hover:bg-[#01ADFB]/10">
                    MAPCN
                  </Badge>
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                    Supervisión territorial
                  </span>
                </div>
                <h1 className="truncate text-[18px] font-medium tracking-tight text-foreground">
                  Ubicaciones de operadores
                </h1>
                <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-muted-foreground">
                  Última referencia registrada por el equipo en campo para
                  coordinar la operación diaria.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              {canFilterByEmpresa ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full justify-between rounded-[4px] border-border bg-card px-3 text-[11px] font-medium text-foreground shadow-sm hover:bg-muted sm:w-72"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-[#01ADFB]" />
                        <span className="truncate">{selectedEmpresaLabel}</span>
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-72 rounded-[5px] border-border bg-card p-2 shadow-xl"
                  >
                    <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Filtrar empresa
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => setSelectedEmpresaId(undefined)}
                      className="cursor-pointer rounded-[4px] px-2 py-2 text-[12px] font-medium"
                    >
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">
                        Todas las empresas
                      </span>
                      {!selectedEmpresaId ? (
                        <Check className="h-3.5 w-3.5 text-[#01ADFB]" />
                      ) : null}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {empresaOptions.map((empresa) => (
                      <DropdownMenuItem
                        key={empresa.id}
                        onClick={() => setSelectedEmpresaId(empresa.id)}
                        className="cursor-pointer rounded-[4px] px-2 py-2 text-[12px] font-medium"
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">
                          {empresa.nombre}
                        </span>
                        {selectedEmpresaId === empresa.id ? (
                          <Check className="h-3.5 w-3.5 text-[#01ADFB]" />
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <Card className="min-w-36 rounded-[4px] border-border bg-card shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Operadores
                      </p>
                      <UsersRound className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
                      {loading ? "—" : operators.length}
                    </p>
                  </CardContent>
                </Card>
                <Card className="min-w-36 rounded-[4px] border-border bg-card shadow-sm">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Con GPS
                      </p>
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-600">
                      {loading ? "—" : `${locatedPercentage}%`}
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-3 p-3 lg:p-4">
          <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
            <Card className="min-h-0 overflow-hidden rounded-[5px] border-border bg-card shadow-sm">
              <CardContent className="relative h-full min-h-[520px] overflow-hidden p-0">
                {error ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-6">
                    <div className="max-w-md rounded-[5px] border border-destructive/20 bg-destructive/5 p-5 text-center shadow-sm">
                      <AlertTriangle className="mx-auto h-9 w-9 text-destructive" />
                      <h2 className="mt-4 text-[15px] font-medium">
                        No se pudo cargar el mapa
                      </h2>
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        {error}
                      </p>
                      <Button
                        type="button"
                        className="mt-5 h-8 rounded-[4px] bg-[#01ADFB] px-3 text-[10px] font-medium tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 hover:bg-[#0199df]"
                        onClick={() => void loadLocations()}
                      >
                        Reintentar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!error && !loading && operatorsWithCoordinates.length === 0 ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 p-6">
                    <div className="max-w-md text-center">
                      <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-[5px] border border-amber-500/20 bg-amber-500/10 text-amber-600">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <h2 className="mt-4 text-[15px] font-medium">
                        Todavía no hay coordenadas válidas
                      </h2>
                      <p className="mt-2 text-[12px] text-muted-foreground">
                        Hay operadores disponibles, pero todavía no registraron
                        una ubicación válida desde campo.
                      </p>
                    </div>
                  </div>
                ) : null}

                <MapView
                  ref={mapRef}
                  className="h-full w-full"
                  center={BOGOTA_CENTER}
                  zoom={11}
                  bearing={0}
                  pitch={0}
                  loading={loading}
                >
                  <MapControls
                    position="top-right"
                    showCompass
                    showFullscreen
                    showLocate
                    locateDisabled
                    locateDisabledLabel="Ubicación del navegador bloqueada"
                  />
                  {operatorsWithCoordinates.map((operator) => {
                    const operatorKey = getOperatorLocationKey(operator);
                    const isSelected = selectedOperatorKey === operatorKey;

                    return (
                      <MapMarker
                        key={operatorKey}
                        latitude={operator.lastLocation.latitud}
                        longitude={operator.lastLocation.longitud}
                        onClick={() => setSelectedOperatorKey(operatorKey)}
                        anchor="bottom"
                      >
                        <MarkerContent>
                          <div
                            className={cn(
                              "relative flex h-9 w-9 items-center justify-center rounded-[5px] border-2 border-white bg-[#01ADFB] text-[10px] font-semibold text-white shadow-sm shadow-[#01ADFB]/30 transition-transform",
                              isSelected && "scale-110 bg-slate-950",
                            )}
                          >
                            <span className="relative">
                              {getInitials(operator.operatorName)}
                            </span>
                          </div>
                        </MarkerContent>
                        <MarkerPopup
                          closeButton
                          className="rounded-[5px] border-border p-4 shadow-xl"
                        >
                          <OperatorPopup operator={operator} />
                        </MarkerPopup>
                      </MapMarker>
                    );
                  })}
                </MapView>

                <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-[5px] border border-border bg-card px-3 py-2 text-foreground shadow-sm">
                  <div className="flex items-center gap-2">
                    <LocateFixed className="h-3.5 w-3.5 text-[#01ADFB]" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em]">
                      {operatorsWithCoordinates.length} puntos activos
                    </span>
                  </div>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {operatorsWithoutCoordinates} sin coordenadas
                  </p>
                </div>
              </CardContent>
            </Card>

            <aside className="flex min-h-0 flex-col rounded-[5px] border border-border bg-card shadow-sm">
              <div className="shrink-0 border-b border-border px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      Panel operativo
                    </p>
                    <h2 className="mt-1 text-[15px] font-medium text-foreground">
                      Última ubicación
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-[4px] border-border bg-card px-3 text-[10px] font-medium tracking-[0.08em] shadow-sm hover:bg-muted"
                    disabled={loading}
                    onClick={() => void loadLocations()}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only">Actualizar</span>
                  </Button>
                </div>
              </div>

              <div className="grid shrink-0 grid-cols-2 gap-3 px-4 py-3">
                <div className="rounded-[4px] border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em]">
                      Con GPS
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                    {operatorsWithCoordinates.length}
                  </p>
                </div>
                <div className="rounded-[4px] border border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <UsersRound className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-[10px] font-medium uppercase tracking-[0.14em]">
                      Sin GPS
                    </span>
                  </div>
                  <p className="mt-2 text-xl font-semibold tabular-nums text-foreground">
                    {operatorsWithoutCoordinates}
                  </p>
                </div>
              </div>

              <div className="shrink-0 border-y border-border px-4 py-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar operador, orden, cliente..."
                    className="h-9 rounded-[4px] border-border bg-muted/50 pl-9 text-[12px] font-medium text-foreground shadow-sm transition-all focus:border-[#01ADFB]/30 focus:bg-card focus:ring-2 focus:ring-[#01ADFB]/15"
                  />
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {loading ? <LoadingRows /> : null}

                {!loading && !error && filteredOperators.length === 0 ? (
                  <div className="flex min-h-64 flex-col items-center justify-center rounded-[5px] border border-dashed border-border bg-muted/20 p-6 text-center">
                    <UserRound className="h-9 w-9 text-muted-foreground" />
                    <h3 className="mt-3 text-[13px] font-medium">
                      No hay operadores para mostrar
                    </h3>
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      Probá limpiar la búsqueda o revisar los filtros activos.
                    </p>
                  </div>
                ) : null}

                {!loading &&
                  !error &&
                  filteredOperators.map((operator) => {
                    const operatorKey = getOperatorLocationKey(operator);

                    return (
                      <OperatorCard
                        key={operatorKey}
                        operator={operator}
                        selected={selectedOperatorKey === operatorKey}
                        onSelect={() => setSelectedOperatorKey(operatorKey)}
                      />
                    );
                  })}
              </div>

              {selectedOperator && hasValidCoordinates(selectedOperator) ? (
                <a
                  href={buildMapLink(selectedOperator)}
                  target="_blank"
                  rel="noreferrer"
                  className="mx-4 mb-4 flex h-9 shrink-0 items-center justify-between rounded-[4px] bg-[#01ADFB] px-3 text-[10px] font-medium uppercase tracking-[0.08em] text-white shadow-sm shadow-[#01ADFB]/20 transition-colors hover:bg-[#0199df]"
                >
                  <span className="inline-flex items-center gap-2">
                    <Navigation className="h-3.5 w-3.5" />
                    Abrir operador seleccionado
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </aside>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function OperatorLocationsPage() {
  return <OperatorLocationsContent />;
}
