"use client";

import {
  useState,
  useEffect,
  Suspense,
  useCallback,
  use,
  useMemo,
  useRef,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  getOrdenServicioEditBootstrap,
  updateOrdenServicio,
  type OrdenServicioDetail,
} from "../../api";
import {
  clientesClient,
  type ClienteSearchResult,
} from "@/lib/api/clientes-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  ClienteSolicitanteCombobox,
  type ClienteSolicitanteOption,
} from "../../nuevo/cliente-solicitante-combobox";
import {
  ArrowLeft,
  User,
  Calendar,
  CreditCard,
  Briefcase,
  GanttChart,
  Loader2,
  Trash2,
  Plus,
  Save
} from "lucide-react";
import { useUserRole } from "@/hooks/use-user-role";
import { DashboardLayout } from "@/components/dashboard";
import { cn } from "@/components/ui/utils";
import {
  bogotaDateTimeToUtcIso,
  bogotaDateToUtcIso,
  pickerDateToYmd,
  utcIsoToBogotaHm,
  utcIsoToBogotaYmd,
  ymdToPickerDate,
} from "@/utils/date-utils";

const URGENCIAS = [
  { value: "BAJA", label: "Baja (SLA 48h)" },
  { value: "MEDIA", label: "Media (SLA 24h)" },
  { value: "ALTA", label: "Alta (SLA 12h)" },
  { value: "CRITICA", label: "Crítica (SLA Inmediato)" },
];

const NIVELES_INFESTACION = [
  { value: "BAJO", label: "Bajo - Presencia ocasional" },
  { value: "MEDIO", label: "Medio - Avistamientos regulares" },
  { value: "ALTO", label: "Alto - Foco establecido" },
  { value: "CRITICO", label: "Crítico - Plaga fuera de control" },
  { value: "PREVENTIVO", label: "Preventivo - Sin presencia" },
];

const TIPOS_VISITA = [
  { value: "DIAGNOSTICO_INICIAL", label: "Diagnóstico Inicial" },
  { value: "NUEVO", label: "Nuevo" },
  { value: "CITA_VERIFICACION", label: "Cita de Verificación" },
  { value: "SERVICIO_REFUERZO", label: "Servicio Refuerzo" },
  { value: "REPROGRAMADO", label: "Reprogramado" },
  { value: "NO_CONCRETADO", label: "No Concretado" },
  { value: "GARANTIA", label: "Garantía" },
];

const GARANTIA_VISIT_TYPE = "GARANTIA";

const normalizeVisitTypeValue = (value?: string | null) => {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return "";

  if (normalized === "DIAGNOSTICO") return "DIAGNOSTICO_INICIAL";
  if (normalized === "SEGUIMIENTO") return "CITA_VERIFICACION";
  if (normalized === "REINCIDENCIA") return "GARANTIA";
  if (normalized === "PREVENTIVO" || normalized === "CORRECTIVO") return "SERVICIO_REFUERZO";

  return normalized;
};

const utcIsoToLocalDateTimeInput = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const METODOS_PAGO_BASE = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia Bancaria" },
  { value: "CREDITO", label: "Crédito / Por Cobrar" },
  { value: "BONO", label: "Bono / Descuento" },
  { value: "CORTESIA", label: "Cortesía (No se cobra)" },
  { value: "PENDIENTE", label: "Pendiente por definir" },
];

const TIPOS_FACTURACION = [
  { value: "UNICO", label: "Servicio único / Eventual" },
  { value: "CONTRATO_MENSUAL", label: "Parte de contrato mensual" },
  { value: "PLAN_TRIMESTRAL", label: "Parte de plan trimestral" },
  { value: "PLAN_SEMESTRAL", label: "Parte de plan semestral" },
  { value: "PLAN_ANUAL", label: "Parte de plan anual" },
];

const ESTADOS_ORDEN = [
  { value: "NUEVO", label: "Nuevo" },
  { value: "PROCESO", label: "En Proceso" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "PROGRAMADO", label: "Programado" },
  { value: "LIQUIDADO", label: "Liquidado" },
  { value: "TECNICO_FINALIZO", label: "Técnico Finalizó" },
  { value: "REPROGRAMADO", label: "Reprogramado" },
  { value: "SIN_CONCRETAR", label: "Sin Concretar" },
];

interface Direccion {
  id: string;
  direccion: string;
  nombreSede?: string | null;
  barrio?: string | null;
  municipio?: string | null;
  linkMaps?: string | null;
}

interface Operador {
  id: string;
  nombre: string;
  telefono?: string;
}

interface BreakdownLine {
  metodo: string;
  monto: string | number;
  banco?: string;
  referencia?: string;
}

type FinancialLockSnapshot = {
  financialLock?: boolean | null;
  estadoPago?: string | null;
  estadoServicio?: string | null;
  liquidadoAt?: string | null;
};

const HARD_FINANCIAL_LOCK_STATES = new Set([
  "CONCILIADO",
]);

const getFinancialLockState = (orden?: FinancialLockSnapshot | null) => {
  if (!orden) {
    return { locked: false, reason: "" };
  }

  if (orden.financialLock) {
    return {
      locked: true,
      reason:
        "La orden ya tiene un hito contable registrado. Los datos financieros quedaron congelados.",
    };
  }

  if (orden.liquidadoAt || orden.estadoServicio === "LIQUIDADO") {
    return {
      locked: true,
      reason:
        "La orden ya fue liquidada. Cualquier ajuste financiero debe tramitarse por el flujo contable.",
    };
  }

  if (orden.estadoPago && HARD_FINANCIAL_LOCK_STATES.has(orden.estadoPago)) {
    return {
      locked: true,
      reason:
        "El pago ya fue conciliado. Los datos financieros quedaron congelados y cualquier ajuste debe pasar por el flujo contable.",
    };
  }

  return { locked: false, reason: "" };
};

const getClienteDisplayName = (cliente: ClienteSearchResult) =>
  cliente.tipoCliente === "EMPRESA"
    ? cliente.razonSocial || "Empresa sin nombre"
    : `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim() ||
      "Cliente sin nombre";

const getClienteDocument = (cliente: ClienteSearchResult) =>
  cliente.numeroDocumento?.trim() || cliente.nit?.trim() || "";

const getClienteSearchDescription = (cliente: ClienteSearchResult) =>
  [cliente.telefono?.trim(), cliente.telefono2?.trim(), getClienteDocument(cliente)]
    .filter(Boolean)
    .join(" • ");

function EditarServicioContent({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");
  const { checkPermission, isLoading: isLoadingRole } = useUserRole();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedClienteData, setSelectedClienteData] =
    useState<ClienteSearchResult | null>(null);
  const [clienteSearchQuery, setClienteSearchQuery] = useState("");
  const [clienteSearchResults, setClienteSearchResults] = useState<
    ClienteSearchResult[]
  >([]);
  const [clienteSearchLoading, setClienteSearchLoading] = useState(false);
  const [clienteSearchError, setClienteSearchError] = useState<string | null>(null);
  const clienteSearchRequestRef = useRef(0);
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [serviciosEmpresa, setServiciosEmpresa] = useState<
    Array<{ id: string; nombre: string }>
  >([]);

  // Form State
  const [selectedCliente, setSelectedCliente] = useState("");
  const [selectedDireccion, setSelectedDireccion] = useState("");
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [selectedOperador, setSelectedOperador] = useState("");

  useEffect(() => {
    if (!isLoadingRole && !checkPermission("SERVICE_EDIT")) {
      router.replace("/dashboard/servicios");
    }
  }, [isLoadingRole, checkPermission, router]);
  const [direccionesCliente, setDireccionesCliente] = useState<Direccion[]>([]);

  // Custom logic states
  const [nivelInfestacion, setNivelInfestacion] = useState("");
  const [frecuenciaRecomendada, setFrecuenciaRecomendada] = useState<number | "">("");

  // Form Fields
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<string[]>([]);
  const [tipoVisita, setTipoVisita] = useState("");
  const [urgencia, setUrgencia] = useState("");
  const [diagnosticoTecnico, setDiagnosticoTecnico] = useState("");
  const [intervencionRealizada, setIntervencionRealizada] = useState("");
  const [hallazgosEstructurales, setHallazgosEstructurales] = useState("");
  const [recomendacionesObligatorias, setRecomendacionesObligatorias] =
    useState("");
  const [huboSellamiento, setHuboSellamiento] = useState("");
  const [huboRecomendacionEstructural, setHuboRecomendacionEstructural] =
    useState("");
  const [fechaVisita, setFechaVisita] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaInicioReal, setHoraInicioReal] = useState("");
  const [horaFinReal, setHoraFinReal] = useState("");
  const [duracionMinutos, setDuracionMinutos] = useState("60");
  const [valorCotizado, setValorCotizado] = useState("");
  const [valorMaterialesInsumos, setValorMaterialesInsumos] = useState("");
  const [breakdown, setBreakdown] = useState<Array<{ metodo: string; monto: string; banco?: string; referencia?: string }>>([
    { metodo: "EFECTIVO", monto: "" }
  ]);
  const [tipoFacturacion, setTipoFacturacion] = useState("");
  const [estadoServicio, setEstadoServicio] = useState("");
  const isGarantia = tipoVisita === GARANTIA_VISIT_TYPE;
  const [isFinancialLockActive, setIsFinancialLockActive] = useState(false);
  const [financialLockReason, setFinancialLockReason] = useState("");

  // Persistimos solo contexto operativo no sensible; evitamos exponer datos contables en la URL.
  const syncToUrl = useCallback(() => {
    const params = new URLSearchParams();
    if (returnTo) params.set("returnTo", returnTo);
    if (selectedCliente) params.set("cliente", selectedCliente);
    if (selectedDireccion) params.set("direccion", selectedDireccion);
    if (selectedOperador) params.set("operador", selectedOperador);
    if (serviciosSeleccionados.length > 0) params.set("servicios", serviciosSeleccionados.join(","));
    if (tipoVisita) params.set("tipoVisita", tipoVisita);
    if (nivelInfestacion) params.set("nivel", nivelInfestacion);
    if (urgencia) params.set("urgencia", urgencia);
    if (fechaVisita) params.set("fecha", fechaVisita);
    if (horaInicio) params.set("hora", horaInicio);
    if (duracionMinutos) params.set("duracion", duracionMinutos);
    if (tipoFacturacion) params.set("facturacion", tipoFacturacion);
    if (frecuenciaRecomendada) params.set("frecuencia", frecuenciaRecomendada.toString());

    const queryString = params.toString();
    const newUrl = `${window.location.pathname}${queryString ? `?${queryString}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, [
    returnTo, selectedCliente, selectedDireccion, selectedOperador, serviciosSeleccionados,
    tipoVisita, nivelInfestacion, urgencia, fechaVisita, horaInicio,
    duracionMinutos, tipoFacturacion, frecuenciaRecomendada,
  ]);

  useEffect(() => {
    syncToUrl();
  }, [syncToUrl]);
  // --- END URL PERSISTENCE LOGIC ---

  useEffect(() => {
    if (!isGarantia) {
      return;
    }

    setValorCotizado("0");
    setBreakdown([{ metodo: "CORTESIA", monto: "0" }]);
  }, [isGarantia]);

  const clienteOptions = useMemo<ClienteSolicitanteOption[]>(() => {
    const hydratedResults = selectedClienteData
      ? [
          selectedClienteData,
          ...clienteSearchResults.filter(
            (cliente) => cliente.id !== selectedClienteData.id,
          ),
        ]
      : clienteSearchResults;

    return hydratedResults.map((cliente) => ({
      id: cliente.id,
      label: getClienteDisplayName(cliente),
      description: getClienteSearchDescription(cliente),
    }));
  }, [clienteSearchResults, selectedClienteData]);

  const selectedClienteOption = useMemo<ClienteSolicitanteOption | null>(() => {
    if (!selectedClienteData || selectedClienteData.id !== selectedCliente) {
      return clienteOptions.find((option) => option.id === selectedCliente) ?? null;
    }

    return {
      id: selectedClienteData.id,
      label: getClienteDisplayName(selectedClienteData),
      description: getClienteSearchDescription(selectedClienteData),
    };
  }, [clienteOptions, selectedCliente, selectedClienteData]);

  const searchClientes = useCallback(async (rawQuery: string) => {
    const requestId = ++clienteSearchRequestRef.current;
    setClienteSearchLoading(true);
    setClienteSearchError(null);

    try {
      const results = await clientesClient.search(rawQuery, {
        limit: 10,
        includeEnterpriseId: false,
      });

      if (requestId !== clienteSearchRequestRef.current) {
        return;
      }

      setClienteSearchResults(results);
    } catch (error) {
      if (requestId !== clienteSearchRequestRef.current) {
        return;
      }

      console.error("Error searching clientes", error);
      setClienteSearchResults([]);
      setClienteSearchError("No pudimos cargar clientes. Probá de nuevo.");
    } finally {
      if (requestId === clienteSearchRequestRef.current) {
        setClienteSearchLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void searchClientes(clienteSearchQuery);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [clienteSearchQuery, searchClientes]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const bootstrap = await getOrdenServicioEditBootstrap(id);

        if (!bootstrap?.orden) {
          toast.error("No se encontró la orden de servicio");
          router.push("/dashboard/servicios");
          return;
        }

        const orderData = bootstrap.orden as OrdenServicioDetail &
          FinancialLockSnapshot;
        const currentClient = bootstrap.cliente ?? null;
        const financialLock = getFinancialLockState(orderData);

        setClienteSearchResults(currentClient ? [currentClient] : []);
        setOperadores(
          (bootstrap.operadores ?? []).map((operator) => ({
            id: operator.id,
            nombre: operator.nombre || "Operador sin nombre",
            telefono: operator.telefono,
          })),
        );
        setServiciosEmpresa(Array.isArray(bootstrap.servicios) ? bootstrap.servicios : []);
        setIsFinancialLockActive(financialLock.locked);
        setFinancialLockReason(financialLock.reason);

        // --- URL OVERRIDE LOGIC ---
        const urlParams = new URLSearchParams(window.location.search);
        
        const getVal = (param: string, dbVal: any /* eslint-disable-line @typescript-eslint/no-explicit-any */) => urlParams.get(param) ?? dbVal;
        const initialClienteId = getVal("cliente", orderData.clienteId);

        setSelectedCliente(initialClienteId);
        setSelectedClienteData(
          currentClient && currentClient.id === initialClienteId ? currentClient : null,
        );
        setSelectedEmpresa(orderData.empresaId);
        setSelectedOperador(getVal("operador", orderData.tecnicoId || ""));
        const urlServicios = urlParams.get("servicios") || urlParams.get("servicio");
        const orderServicios =
          urlServicios?.split(",").map((value) => value.trim()).filter(Boolean) ||
          orderData.serviciosSeleccionados?.filter(Boolean) ||
          (orderData.servicio?.nombre ? [orderData.servicio.nombre] : []);
        setServiciosSeleccionados(orderServicios);
        setTipoVisita(normalizeVisitTypeValue(getVal("tipoVisita", orderData.tipoVisita || "")));
        setNivelInfestacion(getVal("nivel", orderData.nivelInfestacion || ""));
        
        const urlFrecuencia = urlParams.get("frecuencia");
        setFrecuenciaRecomendada(urlFrecuencia ? Number(urlFrecuencia) : (orderData.frecuenciaSugerida ? Number(orderData.frecuenciaSugerida) : ""));
        
        setUrgencia(getVal("urgencia", orderData.urgencia || ""));
        setDiagnosticoTecnico(orderData.diagnosticoTecnico || orderData.observacion || "");
        setIntervencionRealizada(
          orderData.intervencionRealizada || orderData.observacionFinal || "",
        );
        setHallazgosEstructurales(orderData.hallazgosEstructurales || "");
        setRecomendacionesObligatorias(orderData.recomendacionesObligatorias || "");
        setHuboSellamiento(
          typeof orderData.huboSellamiento === "boolean"
            ? String(orderData.huboSellamiento)
            : "",
        );
        setHuboRecomendacionEstructural(
          typeof orderData.huboRecomendacionEstructural === "boolean"
            ? String(orderData.huboRecomendacionEstructural)
            : "",
        );
        setHoraInicioReal(utcIsoToLocalDateTimeInput(orderData.horaInicioReal));
        setHoraFinReal(utcIsoToLocalDateTimeInput(orderData.horaFinReal));
        
        const dbValorCotizado = orderData.valorCotizado?.toString() || "";
        const formattedDbValor = dbValorCotizado.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        setValorCotizado(formattedDbValor);

        const dbValorMaterialesInsumos = orderData.valorRepuestos?.toString() || "";
        const formattedDbValorMaterialesInsumos = dbValorMaterialesInsumos
          .replace(/\D/g, "")
          .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        setValorMaterialesInsumos(formattedDbValorMaterialesInsumos);

        // Cargar desglose de pago
        if (orderData.desglosePago && Array.isArray(orderData.desglosePago) && orderData.desglosePago.length > 0) {
          setBreakdown((orderData.desglosePago as unknown as BreakdownLine[]).map(l => ({
            metodo: l.metodo,
            banco: l.banco,
            referencia: l.referencia,
            monto: (l.monto ?? 0).toString().replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".")
          })));
        } else {
          setBreakdown([{ metodo: "EFECTIVO", monto: formattedDbValor }]);
        }

        setTipoFacturacion(getVal("facturacion", orderData.tipoFacturacion || ""));
        setEstadoServicio(orderData.estadoServicio || "NUEVO");
        
        if (urlParams.get("fecha")) {
          setFechaVisita(urlParams.get("fecha")!);
        } else if (orderData.fechaVisita) {
          setFechaVisita(utcIsoToBogotaYmd(orderData.fechaVisita));
        }

        if (urlParams.get("hora")) {
          setHoraInicio(urlParams.get("hora")!);
        } else if (orderData.horaInicio) {
          setHoraInicio(utcIsoToBogotaHm(orderData.horaInicio));
        }

        const urlDuracion = urlParams.get("duracion");
        setDuracionMinutos(urlDuracion || orderData.duracionMinutos?.toString() || "60");

        const selectedClientFromBootstrap =
          currentClient && currentClient.id === initialClienteId ? currentClient : null;
        setDireccionesCliente(
          (selectedClientFromBootstrap?.direcciones ?? []) as Direccion[],
        );
        setSelectedDireccion(getVal("direccion", orderData.direccionId || ""));

      } catch (e) {
        console.error("Error loading order data", e);
        toast.error("Error al cargar los datos de la orden");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, router]);

  const handleClienteChange = (option: ClienteSolicitanteOption | null) => {
    if (!option) {
      setSelectedCliente("");
      setSelectedClienteData(null);
      setDireccionesCliente([]);
      setSelectedDireccion("");
      return;
    }

    const clientId = option.id;
    const cliente =
      selectedClienteData?.id === clientId
        ? selectedClienteData
        : clienteSearchResults.find((candidate) => candidate.id === clientId) ?? null;
    const dirs = (cliente?.direcciones ?? []) as Direccion[];

    setSelectedCliente(clientId);
    setSelectedClienteData(cliente);
    setDireccionesCliente(dirs);
    setSelectedDireccion(dirs.length > 0 ? dirs[0].id : "");
  };

  const handleNivelInfestacionChange = (val: string) => {
    setNivelInfestacion(val);
    if (!val) {
      setFrecuenciaRecomendada("");
      return;
    }
    let suggestedDays = 30;
    switch (val) {
      case "CRITICO": suggestedDays = 7; break;
      case "ALTO": suggestedDays = 15; break;
      case "MEDIO": suggestedDays = 30; break;
      case "BAJO": suggestedDays = 60; break;
      case "PREVENTIVO": suggestedDays = 90; break;
    }
    setFrecuenciaRecomendada(suggestedDays);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (
      !selectedCliente ||
      !selectedEmpresa ||
      serviciosSeleccionados.length === 0 ||
      !diagnosticoTecnico.trim()
    ) {
      toast.error("Completa los campos obligatorios");
      setSaving(false);
      return;
    }

    const payload = {
      clienteId: selectedCliente,
      empresaId: selectedEmpresa,
      tecnicoId: selectedOperador || null,
      direccionId: selectedDireccion || undefined,
      servicioId: serviciosEmpresa.find((item) => item.nombre === serviciosSeleccionados[0])?.id,
      servicioEspecifico: serviciosSeleccionados[0] || undefined,
      serviciosSeleccionados: serviciosSeleccionados.length > 0 ? serviciosSeleccionados : undefined,
      urgencia: urgencia || undefined,
      diagnosticoTecnico: diagnosticoTecnico.trim() || undefined,
      intervencionRealizada: intervencionRealizada.trim() || undefined,
      hallazgosEstructurales: hallazgosEstructurales.trim() || undefined,
      recomendacionesObligatorias:
        recomendacionesObligatorias.trim() || undefined,
      huboSellamiento: huboSellamiento ? huboSellamiento === "true" : undefined,
      huboRecomendacionEstructural:
        huboRecomendacionEstructural
          ? huboRecomendacionEstructural === "true"
          : undefined,
      nivelInfestacion: nivelInfestacion || undefined,
      tipoVisita: tipoVisita || undefined,
      frecuenciaSugerida: frecuenciaRecomendada ? Number(frecuenciaRecomendada) : undefined,
      tipoFacturacion: tipoFacturacion || undefined,
      valorCotizado: isFinancialLockActive
        ? undefined
        : valorCotizado
          ? Number(valorCotizado.replace(/\./g, ""))
          : undefined,
      valorRepuestos: isFinancialLockActive
        ? undefined
        : valorMaterialesInsumos
          ? Number(valorMaterialesInsumos.replace(/\./g, ""))
          : undefined,
      desglosePago: isFinancialLockActive
        ? undefined
        : breakdown.map(line => ({
            ...line,
            monto: parseFloat(line.monto.replace(/\./g, "")) || 0
          })),
      estadoServicio: isFinancialLockActive ? undefined : estadoServicio || undefined,
      fechaVisita: fechaVisita ? bogotaDateToUtcIso(fechaVisita) : undefined,
      horaInicio: (fechaVisita && horaInicio) ? bogotaDateTimeToUtcIso(fechaVisita, horaInicio) : undefined,
      horaInicioReal: horaInicioReal
        ? new Date(horaInicioReal).toISOString()
        : undefined,
      horaFinReal: horaFinReal ? new Date(horaFinReal).toISOString() : undefined,
      duracionMinutos: Number(duracionMinutos),
    };

    try {
      const updatedOrden = await updateOrdenServicio(id, payload);

      if (updatedOrden.picoPlacaWarning) {
        toast.warning(updatedOrden.picoPlacaWarning.message, { duration: 9000 });
      }

      toast.success("Orden de servicio actualizada correctamente");
      router.push(returnTo || "/dashboard/servicios");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error al actualizar la orden";
      toast.error(errorMessage);
      setSaving(false);
    }
  };

  if (isLoadingRole) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm font-bold uppercase tracking-widest text-muted-foreground">
        Validando permisos...
      </div>
    );
  }

  if (!checkPermission("SERVICE_EDIT")) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-azul-1" />
        <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Cargando protocolo de edición...</p>
      </div>
    );
  }

  const selectedDireccionData = direccionesCliente.find((direccion) => direccion.id === selectedDireccion);
  const selectedOperatorLabel = operadores.find((operador) => operador.id === selectedOperador)?.nombre || "Sin asignar";
  const selectedClientMeta = selectedClienteData ? getClienteSearchDescription(selectedClienteData) : "Seleccioná un cliente para validar contacto y sedes";
  const breakdownTotal = breakdown.reduce((sum, line) => sum + (parseFloat(line.monto.replace(/\./g, "")) || 0), 0);
  const targetAmount = parseFloat(valorCotizado.replace(/\./g, "")) || 0;
  const isBreakdownAligned = breakdownTotal === targetAmount;
  const editPanelClass = "rounded-[5px] border border-border bg-card shadow-sm";
  const editSectionClass = "border-b border-border pb-5 last:border-b-0 last:pb-0";
  const editLabelClass = "text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground";
  const editInputClass = "h-9 rounded-[4px] border-border bg-background text-[12px] font-medium text-foreground focus-visible:ring-1 focus-visible:ring-[#01ADFB]/35";
  const editComboboxTriggerClass =
    "h-9 rounded-[4px] border-border bg-background px-3 py-2 text-left text-[12px] font-medium text-foreground shadow-sm transition-all hover:bg-muted/40 focus:border-[#01ADFB]/40 focus:bg-card focus:ring-1 focus:ring-[#01ADFB]/20 disabled:bg-muted/40";
  const editComboboxContentClass = "z-[60] mt-1 rounded-[5px] border-border bg-card shadow-xl";
  const editTextareaClass = "min-h-[92px] w-full resize-none rounded-[4px] border border-border bg-background px-3 py-2.5 text-[12px] font-medium leading-relaxed text-foreground outline-none focus:border-[#01ADFB]/40 focus:ring-1 focus:ring-[#01ADFB]/20";
  const editGhostButtonClass = "h-8 rounded-[4px] border-border bg-card px-3 text-[10px] font-medium tracking-[0.08em] text-muted-foreground hover:bg-muted";
  const editPrimaryButtonClass = "h-8 rounded-[4px] bg-[#01ADFB] px-4 text-[10px] font-medium tracking-[0.08em] text-white hover:bg-[#0197dc]";
  const fieldGroupClass = "space-y-1.5 min-w-0";

  const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
    <div className="mb-4 flex min-w-0 items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-muted/40 text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <h2 className="text-[13px] font-medium tracking-tight text-foreground">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p> : null}
      </div>
    </div>
  );

  return (
    <div className="h-full min-h-0 p-4 sm:p-6 lg:p-10">
      <div className="mx-auto flex h-full w-full max-w-[1500px] min-h-0 flex-col">
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", editPanelClass)}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => router.back()} className="h-8 w-8 shrink-0 rounded-[4px] border-border bg-background text-muted-foreground hover:bg-muted">
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h1 className="break-words text-[15px] font-medium tracking-tight text-foreground">Editar orden de servicio</h1>
                {estadoServicio ? (
                  <span className="rounded-[4px] border border-[#01ADFB]/20 bg-[#01ADFB]/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#01ADFB]">
                    {estadoServicio}
                  </span>
                ) : null}
                {isFinancialLockActive ? (
                  <span className="rounded-[4px] border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-amber-700">
                    Cierre financiero
                  </span>
                ) : null}
              </div>
              <p className="mt-1 break-words text-[11px] text-muted-foreground">Actualización operativa y financiera del servicio #{id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-5 custom-scrollbar lg:p-6">
          <form id="servicio-form" onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-5">
              <section className={editSectionClass}>
                <SectionHeader icon={<User className="h-4 w-4" />} title="Cliente y punto de servicio" subtitle="Identificá quién solicita el servicio y dónde se ejecuta." />
                <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)] md:gap-6">
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Cliente solicitante <span className="text-red-500">*</span></Label>
                    <ClienteSolicitanteCombobox
                      options={clienteOptions}
                      value={selectedCliente}
                      selectedOption={selectedClienteOption}
                      searchValue={clienteSearchQuery}
                      onSearchChange={setClienteSearchQuery}
                      onSelect={handleClienteChange}
                      loading={clienteSearchLoading}
                      error={clienteSearchError}
                      placeholder="Buscar por teléfono, documento o nombre..."
                      recentMessage="Mostramos los clientes recientes mientras empezás a buscar."
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                    <div className="min-w-0 border-l border-border pl-3">
                      <p className="truncate text-[10px] text-muted-foreground">
                        {selectedClienteData ? selectedClientMeta : "Cliente pendiente"}
                      </p>
                    </div>
                    <Button type="button" variant="ghost" className="h-7 w-fit px-0 text-[10px] font-medium text-[#01ADFB] hover:bg-transparent hover:text-[#0197dc]" onClick={() => router.push("/dashboard/clientes/nuevo")}>
                      + Registrar nuevo cliente
                    </Button>
                  </div>

                  <div aria-hidden="true" className="hidden bg-border md:block" />

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Dirección <span className="text-red-500">*</span></Label>
                    <Combobox
                      options={[
                        { value: "", label: selectedCliente ? "Seleccionar sede disponible..." : "Primero seleccione un cliente" },
                        ...(Array.isArray(direccionesCliente) ? direccionesCliente : []).map(d => ({
                          value: d.id,
                          label: `${d.direccion} - ${d.nombreSede || d.barrio}`
                        }))
                      ]}
                      value={selectedDireccion}
                      onChange={setSelectedDireccion}
                      disabled={!selectedCliente}
                      placeholder="Seleccionar sede..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                    <div className="min-w-0 border-l border-border pl-3">
                      <p className="break-words text-[11px] font-medium text-foreground">{selectedDireccionData?.direccion || "Sede pendiente"}</p>
                      <p className="mt-0.5 break-words text-[10px] text-muted-foreground">
                        {[selectedDireccionData?.barrio, selectedDireccionData?.municipio].filter(Boolean).join(" · ") || "Sin ubicación seleccionada"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className={editSectionClass}>
                <SectionHeader icon={<Briefcase className="h-4 w-4" />} title="Especificaciones técnicas" subtitle="Configurá alcance, prioridad y criterios técnicos de la orden." />
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Estado del servicio <span className="text-red-500">*</span></Label>
                    <Combobox
                      options={[{ value: "", label: "Seleccionar estado..." }, ...ESTADOS_ORDEN.map(est => ({ value: est.value, label: est.label }))]}
                      value={estadoServicio}
                      onChange={setEstadoServicio}
                      placeholder="Estado..."
                      hideSearch
                      disabled={isFinancialLockActive}
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                    {isFinancialLockActive ? <p className="text-[10px] font-medium text-amber-700">El estado se gestiona desde el cierre financiero.</p> : null}
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Servicios específicos <span className="text-red-500">*</span></Label>
                    <Combobox
                      options={[
                        { value: "", label: selectedEmpresa ? "Seleccionar servicio para añadir..." : "Primero seleccione una empresa" },
                        ...(Array.isArray(serviciosEmpresa) ? serviciosEmpresa : [])
                          .filter(s => !serviciosSeleccionados.includes(s.nombre))
                          .map(s => ({ value: s.nombre, label: s.nombre }))
                      ]}
                      value=""
                      onChange={(val) => {
                        if (val) {
                          setServiciosSeleccionados((current) =>
                            current.includes(val) ? current : [...current, val],
                          );
                        }
                      }}
                      disabled={!selectedEmpresa}
                      placeholder="Buscar servicio..."
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                    {serviciosSeleccionados.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {serviciosSeleccionados.map((srv, idx) => (
                          <span key={idx} className="inline-flex max-w-full items-center gap-1 rounded border border-[#01ADFB]/20 bg-[#01ADFB]/10 px-2 py-1 text-[10px] font-medium text-[#01ADFB]">
                            <span className="min-w-0 break-words">{srv}</span>
                            <button
                              type="button"
                              onClick={() => setServiciosSeleccionados((current) => current.filter((service) => service !== srv))}
                              className="shrink-0 text-[#01ADFB] hover:text-red-500 focus:outline-none"
                              aria-label={`Quitar ${srv}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Tipo de visita <span className="text-red-500">*</span></Label>
                    <Combobox
                      options={[{ value: "", label: "Seleccionar visita..." }, ...TIPOS_VISITA.map(t => ({ value: t.value, label: t.label }))]}
                      value={tipoVisita}
                      onChange={setTipoVisita}
                      placeholder="Visita..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                    {isGarantia ? <p className="text-[10px] font-medium text-amber-700">La garantía se valida con el historial del cliente y se liquida en 0.</p> : null}
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Nivel de infestación</Label>
                    <Combobox
                      options={[{ value: "", label: "Seleccionar nivel..." }, ...NIVELES_INFESTACION.map(n => ({ value: n.value, label: n.label }))]}
                      value={nivelInfestacion}
                      onChange={handleNivelInfestacionChange}
                      placeholder="Nivel..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Frecuencia sugerida</Label>
                    <Input type="number" value={frecuenciaRecomendada} onChange={(e) => setFrecuenciaRecomendada(e.target.value ? Number(e.target.value) : "")} placeholder="Días" className={editInputClass} />
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Urgencia</Label>
                    <Combobox
                      options={[{ value: "", label: "Seleccionar urgencia..." }, ...URGENCIAS.map(u => ({ value: u.value, label: u.label }))]}
                      value={urgencia}
                      onChange={setUrgencia}
                      placeholder="Urgencia..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Hubo sellamiento</Label>
                    <Combobox
                      options={[{ value: "", label: "Seleccionar..." }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                      value={huboSellamiento}
                      onChange={setHuboSellamiento}
                      placeholder="Sellamiento..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Recomendación estructural</Label>
                    <Combobox
                      options={[{ value: "", label: "Seleccionar..." }, { value: "true", label: "Sí" }, { value: "false", label: "No" }]}
                      value={huboRecomendacionEstructural}
                      onChange={setHuboRecomendacionEstructural}
                      placeholder="Recomendación..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                  </div>
                </div>
              </section>

              <section className={editSectionClass}>
                <SectionHeader icon={<GanttChart className="h-4 w-4" />} title="Registro técnico" subtitle="Documentá diagnóstico, ejecución y recomendaciones para trazabilidad." />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Diagnóstico técnico <span className="text-red-500">*</span></Label>
                    <textarea value={diagnosticoTecnico} onChange={(e) => setDiagnosticoTecnico(e.target.value)} className={editTextareaClass} placeholder="Describe causa del problema, evaluación técnica y contexto encontrado..." required />
                  </div>
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Intervención realizada</Label>
                    <textarea value={intervencionRealizada} onChange={(e) => setIntervencionRealizada(e.target.value)} className={editTextareaClass} placeholder="Detalla el trabajo ejecutado por el técnico..." />
                  </div>
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Hallazgos estructurales</Label>
                    <textarea value={hallazgosEstructurales} onChange={(e) => setHallazgosEstructurales(e.target.value)} className={editTextareaClass} placeholder="Registra grietas, accesos, filtraciones u otros hallazgos físicos..." />
                  </div>
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Recomendaciones obligatorias</Label>
                    <textarea value={recomendacionesObligatorias} onChange={(e) => setRecomendacionesObligatorias(e.target.value)} className={editTextareaClass} placeholder="Indica acciones correctivas o estructurales obligatorias para el cliente..." />
                  </div>
                </div>
              </section>

              <section className={editSectionClass}>
                <SectionHeader icon={<Calendar className="h-4 w-4" />} title="Agenda operativa" subtitle="Fecha, tiempos reales y asignación técnica." />
                <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-5">
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Fecha de ejecución <span className="text-red-500">*</span></Label>
                    <DatePicker date={fechaVisita ? ymdToPickerDate(fechaVisita) : undefined} onChange={(d) => setFechaVisita(pickerDateToYmd(d))} className={editInputClass} />
                  </div>
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Hora programada <span className="text-red-500">*</span></Label>
                    <TimePicker value={horaInicio} onChange={setHoraInicio} className={editInputClass} />
                  </div>
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Inicio real</Label>
                    <Input type="datetime-local" value={horaInicioReal} onChange={(e) => setHoraInicioReal(e.target.value)} className={editInputClass} />
                  </div>
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Fin real</Label>
                    <Input type="datetime-local" value={horaFinReal} onChange={(e) => setHoraFinReal(e.target.value)} className={editInputClass} />
                  </div>
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Duración <span className="text-red-500">*</span></Label>
                    <Combobox
                      options={[{ value: "60", label: "60 minutos" }, { value: "90", label: "90 minutos" }, { value: "120", label: "120 minutos" }, { value: "180", label: "180 minutos" }]}
                      value={duracionMinutos}
                      onChange={setDuracionMinutos}
                      placeholder="Duración..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                  </div>
                  <div className={cn(fieldGroupClass, "md:col-span-2 xl:col-span-2")}>
                    <Label className={editLabelClass}>Operador</Label>
                    <Combobox
                      options={[{ value: "", label: "Por asignar" }, ...(Array.isArray(operadores) ? operadores : []).map(o => ({ value: o.id, label: o.nombre }))]}
                      value={selectedOperador}
                      onChange={setSelectedOperador}
                      placeholder="Operador..."
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                    <p className="text-[10px] text-muted-foreground">Asignación actual: {selectedOperatorLabel}</p>
                  </div>
                </div>
              </section>
            </div>

            <aside className="min-w-0 space-y-5 lg:sticky lg:top-0 lg:max-h-[calc(100vh-12rem)] lg:self-start lg:overflow-y-auto lg:border-l lg:border-border lg:pl-5 lg:pr-1 custom-scrollbar">
              <section className={editSectionClass}>
                {isFinancialLockActive ? (
                  <div className="mb-4 border-l border-amber-500/50 bg-amber-500/5 px-3 py-2.5 text-[11px] text-amber-800">
                    <p className="font-medium uppercase tracking-[0.12em]">Orden con cierre financiero</p>
                    <p className="mt-1 leading-relaxed">{financialLockReason}</p>
                  </div>
                ) : null}
                <SectionHeader icon={<CreditCard className="h-4 w-4" />} title="Plan de cobro" subtitle="Valores, facturación y desglose del recaudo." />
                <div className="space-y-4">
                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Tarifa del servicio <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-muted-foreground">$</span>
                      <Input
                        type="text"
                        value={valorCotizado}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          const formatted = val.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                          setValorCotizado(formatted);

                          if (breakdown.length === 1 && (!breakdown[0].monto || breakdown[0].monto === valorCotizado)) {
                            const newBreakdown = [...breakdown];
                            newBreakdown[0].monto = formatted;
                            setBreakdown(newBreakdown);
                          }
                        }}
                        placeholder="0"
                        required
                        disabled={isGarantia || isFinancialLockActive}
                        className={cn(editInputClass, "pl-7 tabular-nums")}
                      />
                    </div>
                    {isGarantia ? <p className="text-[10px] font-medium text-emerald-700">La garantía se conserva con tarifa 0 y sin cobro manual.</p> : null}
                    {isFinancialLockActive ? <p className="text-[10px] font-medium text-amber-700">La tarifa ya no se modifica desde esta vista.</p> : null}
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Materiales e insumos</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] font-medium text-muted-foreground">$</span>
                      <Input
                        type="text"
                        value={valorMaterialesInsumos}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          const formatted = val.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                          setValorMaterialesInsumos(formatted);
                        }}
                        placeholder="0"
                        disabled={isFinancialLockActive}
                        className={cn(editInputClass, "pl-7 tabular-nums")}
                      />
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted-foreground">Incluye repuestos, consumibles u otros materiales usados en la orden.</p>
                  </div>

                  <div className={fieldGroupClass}>
                    <Label className={editLabelClass}>Tipo de facturación</Label>
                    <Combobox
                      options={[{ value: "", label: "Seleccionar facturación..." }, ...TIPOS_FACTURACION.map(m => ({ value: m.value, label: m.label }))]}
                      value={tipoFacturacion}
                      onChange={setTipoFacturacion}
                      placeholder="Facturación..."
                      hideSearch
                      triggerClassName={editComboboxTriggerClass}
                      contentClassName={editComboboxContentClass}
                    />
                  </div>
                </div>
              </section>

              <section className={editSectionClass}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className={editLabelClass}>Desglose de cobro</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Distribuí el valor por método de pago.</p>
                  </div>
                  <Button type="button" variant="outline" className={editGhostButtonClass} onClick={() => setBreakdown([...breakdown, { metodo: "EFECTIVO", monto: "" }])} disabled={isGarantia || isFinancialLockActive}>
                    <Plus className="h-3.5 w-3.5" /> Añadir
                  </Button>
                </div>

                <div className="space-y-3">
                  {breakdown.map((line, index) => (
                    <div key={index} className="relative border-l border-border pl-3">
                      {breakdown.length > 1 ? (
                        <button
                          type="button"
                          disabled={isFinancialLockActive}
                          onClick={() => setBreakdown(breakdown.filter((_, i) => i !== index))}
                          className="absolute right-0 top-0 text-muted-foreground hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label={`Quitar método ${index + 1}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className={fieldGroupClass}>
                          <Label className={editLabelClass}>Método</Label>
                          <Combobox
                            options={METODOS_PAGO_BASE.map((m: { value: string; label: string }) => ({ value: m.value, label: m.label }))}
                            value={line.metodo}
                            disabled={isGarantia || isFinancialLockActive}
                            onChange={(val) => {
                              const newBreakdown = [...breakdown];
                              newBreakdown[index] = { ...line, metodo: val };
                              setBreakdown(newBreakdown);
                            }}
                            placeholder="Método..."
                            hideSearch
                            triggerClassName={editComboboxTriggerClass}
                            contentClassName={editComboboxContentClass}
                          />
                        </div>

                        <div className={fieldGroupClass}>
                          <Label className={editLabelClass}>Monto</Label>
                          <Input
                            type="text"
                            value={line.monto}
                            disabled={isGarantia || isFinancialLockActive}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              const formatted = val.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
                              const newBreakdown = [...breakdown];
                              newBreakdown[index] = { ...line, monto: formatted };
                              setBreakdown(newBreakdown);
                            }}
                            placeholder="0"
                            className={cn(editInputClass, "tabular-nums")}
                          />
                        </div>
                      </div>

                      {line.metodo === "TRANSFERENCIA" ? (
                        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className={fieldGroupClass}>
                            <Label className={editLabelClass}>Banco / entidad</Label>
                            <Input
                              value={line.banco || ""}
                              disabled={isGarantia || isFinancialLockActive}
                              onChange={(e) => {
                                const newBreakdown = [...breakdown];
                                newBreakdown[index] = { ...line, banco: e.target.value };
                                setBreakdown(newBreakdown);
                              }}
                              placeholder="Ej: Bancolombia, Nequi..."
                              className={editInputClass}
                            />
                          </div>
                          <div className={fieldGroupClass}>
                            <Label className={editLabelClass}>Referencia</Label>
                            <Input
                              value={line.referencia || ""}
                              disabled={isGarantia || isFinancialLockActive}
                              onChange={(e) => {
                                const newBreakdown = [...breakdown];
                                newBreakdown[index] = { ...line, referencia: e.target.value };
                                setBreakdown(newBreakdown);
                              }}
                              placeholder="Nº comprobante"
                              className={editInputClass}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
                  <div>
                    <p className={editLabelClass}>Total desglose</p>
                    <p className={cn("mt-1 text-[14px] font-medium tabular-nums", isBreakdownAligned ? "text-emerald-600" : "text-amber-600")}>
                      $ {breakdownTotal.toLocaleString()}
                    </p>
                  </div>
                  <p className="max-w-[150px] text-right text-[10px] leading-relaxed text-muted-foreground">
                    {isBreakdownAligned ? "Cuadra con la tarifa." : "Revisá el total frente a la tarifa."}
                  </p>
                </div>
              </section>
            </aside>
          </form>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            <GanttChart className="h-4 w-4 shrink-0 text-[#01ADFB]" />
            <p className="break-words">
              {isFinancialLockActive
                ? "Se guardarán solo ajustes operativos permitidos para esta orden."
                : "Revisá los cambios antes de guardar la orden."}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button variant="outline" onClick={() => router.back()} className={editGhostButtonClass}>Descartar</Button>
            <Button type="submit" form="servicio-form" disabled={saving} className={editPrimaryButtonClass}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Guardar cambios
            </Button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export default function EditarServicioPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  return (
    <DashboardLayout overflowHidden>
      <Suspense fallback={<div className="flex h-[80vh] items-center justify-center text-sm text-zinc-500 animate-pulse font-bold uppercase tracking-widest">Iniciando protocolo de edición...</div>}>
        <EditarServicioContent id={resolvedParams.id} />
      </Suspense>
    </DashboardLayout>
  );
}
